"""Port of ``src/entities/game.py`` (class ``GaME``) to the CPU prototype.

The control flow, thresholds and the order of operations follow the reference
implementation. Differences are noted inline with ``# NOTE``:

* rendering goes through :mod:`gameproto.splat` instead of the CUDA
  FlashSplat rasteriser (no object-label channels);
* the colour loss is plain L1 (no DSSIM term);
* the final densification/refinement stage is not ported;
* morphological kernels and the two metric slacks used by the reference
  (1.0 m occlusion slack, 2.0 m "saw through" gap) are configurable because
  the synthetic room is only 5 m deep;
* ``change_detection=False`` turns the whole change-detection machinery off,
  which yields the "static map" baseline that keeps trusting old keyframes.
"""
from __future__ import annotations

import random

import numpy as np
import torch
from scipy import ndimage
from scipy.spatial.transform import Rotation

from . import camera
from .model import GaussianModel
from .splat import psnr

DEFAULT_CONFIG = {
    # iteration counts
    "first_keyframe_iters": 200,
    "keyframe_iters": 200,
    "single_frame_iters": 50,          # the hard-coded ``optimize_model(50, only_frame_id=...)``
    # change detection thresholds (values from configs/aria/room0.yaml)
    "depth_change_threshold": 0.05,
    "color_error_threshold": 0.1,
    "min_opacity": 0.3,
    "removal_coverage_threshold": 0.01,
    "addition_coverage_threshold": 0.4,
    "occlusion_ignore_threshold": 0.2,
    "gaussian_seed_threshold": 0.1,
    "covis_ignore_threshold": 0.2,
    "keyframe_translation_diff": 0.01,
    "keyframe_rotation_diff_deg": 50.0,
    "isotropic_reg_weight": 0.5,
    # reference-code constants that depend on the scene scale
    "reproject_occlusion_slack": 1.0,  # ``d - 1 < gt_depth`` in reproject_points
    "addition_cover_depth_gap": 2.0,   # ``occluded + 2.0 < cov_depth`` in _propagate_addition_occlusions
    "addition_cover_min_score": 0.01,
    "morph_kernel": 5,
    "seed_downsample": 2,              # uniform_down_sample(2)
    "depth_error_median_factor": 40.0,
    "prune_opacity": 0.1,
    # prototype switches
    "change_detection": True,
    "seed": 0,
}


def _struct(k: int) -> np.ndarray:
    return np.ones((k, k), dtype=bool)


def _to_np(t: torch.Tensor) -> np.ndarray:
    return t.detach().cpu().numpy()


class GaME:
    """Gaussian Mapping for Evolving Scenes (CPU prototype)."""

    def __init__(self, config: dict | None = None, log=print):
        self.config = dict(DEFAULT_CONFIG)
        if config:
            self.config.update(config)
        self.log = log
        self.keyframes: dict[int, dict] = {}
        self.estimated_poses: dict[int, np.ndarray] = {}
        self.occlusion_masks: dict[int, torch.Tensor] = {}
        self.ignored_frames: set[int] = set()
        self._last_keyframe_id: int | None = None
        self.gaussian_model = GaussianModel()
        self.events: list[dict] = []          # log of detections for inspection
        self._rng = random.Random(self.config["seed"])
        torch.manual_seed(self.config["seed"])

    # ------------------------------------------------------------------ helpers
    def _hw(self, keyframe: dict) -> tuple[int, int]:
        return int(keyframe["depth"].shape[0]), int(keyframe["depth"].shape[1])

    def _render(self, keyframe: dict, background=None, used_mask=None):
        h, w = self._hw(keyframe)
        return self.gaussian_model.render(keyframe["intrinsics"], keyframe["pose"], w, h,
                                          background=background, used_mask=used_mask)

    def _record(self, kind: str, **info) -> None:
        info["kind"] = kind
        self.events.append(info)

    # --------------------------------------------------------- keyframe sampling
    def _sample_valid_keyframe(self, selected_frames, only_frame_id):
        """Sample a keyframe that is not ignored and not covered by occlusion masks."""
        if only_frame_id is not None:
            return only_frame_id
        thresh = self.config["occlusion_ignore_threshold"]
        active = [f for f in selected_frames if f not in self.ignored_frames]
        while True:
            if not active:
                return None
            keyframe_id = self._rng.choice(active)
            if keyframe_id not in self.occlusion_masks:
                return keyframe_id
            all_masks = self.keyframes[keyframe_id]["masks"]
            ignore_mask = self.occlusion_masks[keyframe_id]
            covered = (ignore_mask & all_masks).sum(dim=(1, 2)).float() / all_masks.sum(dim=(1, 2)).clamp_min(1).float()
            if (covered > thresh).any():
                self.ignored_frames.add(keyframe_id)
                self._record("ignore_frame", frame=keyframe_id, reason="occlusion_coverage")
                active.remove(keyframe_id)
            else:
                return keyframe_id

    # ------------------------------------------------------------- optimisation
    def optimize_model(self, iterations: int = 100, only_frame_id=None) -> None:
        """Optimise the Gaussians against (sampled) keyframes with occlusion-masked losses."""
        selected = list(self.keyframes.keys())
        if not selected or len(self.ignored_frames) == len(self.keyframes):
            self.log("no frames available")
            return
        model = self.gaussian_model
        background = torch.zeros(3)
        for iteration in range(iterations):
            keyframe_id = self._sample_valid_keyframe(selected, only_frame_id)
            if keyframe_id is None:
                return
            kf = self.keyframes[keyframe_id]
            out = self._render(kf, background=background)
            image, depth = out["render"], out["depth"]
            mask = (depth[0] > 0) & (kf["depth"] > 0)
            if self.occlusion_masks.get(keyframe_id) is not None:
                mask = mask & ~self.occlusion_masks[keyframe_id]
            mask = mask.float()
            color_loss = ((image - kf["color"]).abs().mean(0) * mask).mean()   # NOTE: no DSSIM term
            depth_loss = ((depth[0] - kf["depth"]).abs() * mask).mean()
            scaling = model.get_scaling
            reg_loss = self.config["isotropic_reg_weight"] * (scaling - scaling.mean(1, keepdim=True)).abs().mean()
            total = color_loss + depth_loss + reg_loss
            total.backward()
            with torch.no_grad():
                model.optimizer.step()
                model.optimizer.zero_grad(set_to_none=True)
                if iteration == iterations // 2 or iteration == iterations - 1:
                    prune = (model.get_opacity < self.config["prune_opacity"]).squeeze(1)
                    if prune.any():
                        model.prune_points(prune)

    # ------------------------------------------------------------- additions
    @torch.no_grad()
    def _find_added_geometry_masks(self, keyframe: dict) -> list[int]:
        """Masks where a large fraction of pixels is closer in reality than in the map."""
        eps = self.config["depth_change_threshold"]
        out = self._render(keyframe)
        render_depth, render_alpha = out["depth"][0], out["alpha"][0]
        valid_alpha = render_alpha > self.config["min_opacity"]
        depth_diff = keyframe["depth"] - render_depth
        new_geometry = []
        for i, mask in enumerate(keyframe["masks"]):
            mask_alpha = mask & valid_alpha
            mask_add = mask_alpha & (depth_diff < -eps)
            denom = (mask_alpha & (depth_diff < eps)).sum().item()
            add_area = mask_add.sum().item() / max(denom, 1)
            if add_area > self.config["addition_coverage_threshold"]:
                new_geometry.append(i)
        return new_geometry

    @torch.no_grad()
    def _propagate_addition_occlusions(self, keyframe: dict, new_geometry_indices: list[int]) -> None:
        """Reproject addition masks into covisible keyframes; mark those regions stale."""
        gt_depth = _to_np(keyframe["depth"])
        pose, K = _to_np(keyframe["pose"]), keyframe["intrinsics"]
        covisible_ids = self.get_covisible_keyframes(keyframe)
        gap = self.config["addition_cover_depth_gap"]
        for i in new_geometry_indices:
            mask = _to_np(keyframe["masks"][i])
            for covis_id in covisible_ids:
                cov = self.keyframes[covis_id]
                cov_depth = _to_np(cov["depth"])
                occluded, _ = camera.reproject_points(
                    gt_depth, pose, K, cov_depth, _to_np(cov["pose"]), cov["intrinsics"],
                    start_mask=mask, occlusion_slack=self.config["reproject_occlusion_slack"])
                hit = occluded > 0
                if not hit.any():
                    continue
                cover_score = (hit & (occluded + gap < cov_depth)).sum() / hit.sum()
                if cover_score > self.config["addition_cover_min_score"]:
                    closed = ndimage.binary_closing(hit, structure=_struct(self.config["morph_kernel"]))
                    closed = torch.as_tensor(closed | hit)
                    self.occlusion_masks[covis_id] = closed if covis_id not in self.occlusion_masks \
                        else (self.occlusion_masks[covis_id] | closed)
                    self._record("addition_occlusion", frame=covis_id, cover_score=float(cover_score),
                                 pixels=int(closed.sum()))
                if cover_score > self.config["covis_ignore_threshold"] and covis_id not in self.ignored_frames:
                    self.ignored_frames.add(covis_id)
                    self._record("ignore_frame", frame=covis_id, reason="addition_cover")

    @torch.no_grad()
    def detect_additions(self, keyframe: dict) -> list[int]:
        idx = self._find_added_geometry_masks(keyframe)
        if idx:
            self._record("addition_detected", masks=idx)
            self._propagate_addition_occlusions(keyframe, idx)
        return idx

    # -------------------------------------------------------------- removals
    @torch.no_grad()
    def _detect_conflicting_gaussians(self, keyframe: dict):
        """Gaussians that sit in front of the observed surface AND disagree in colour."""
        eps = self.config["depth_change_threshold"]
        h, w = self._hw(keyframe)
        out = self._render(keyframe)
        render_color, used, xy, gs_depth = out["render"], out["visibility_filter"], out["proj_xy"], out["gs_depth"]
        n = used.shape[0]
        fr_xy, fr_gs = xy[:, used], gs_depth[used]
        inframe = (fr_xy[0] < w) & (fr_xy[1] < h) & (fr_xy[0] > 0) & (fr_xy[1] > 0)
        sx = fr_xy[:, inframe].to(torch.long)
        sgd = fr_gs[inframe]
        if sx.shape[1] == 0:
            return None
        gt_depth_at = keyframe["depth"][sx[1], sx[0]]
        close = (gt_depth_at - sgd) > eps
        if close.sum() == 0:
            return None
        l1 = (keyframe["color"] - render_color).abs().mean(0)
        color_err = l1[sx[1], sx[0]] > self.config["color_error_threshold"]
        both = close & color_err
        if both.sum() == 0:
            return None
        prune_idx = torch.arange(n)[used][inframe][both]
        prune_mask = torch.zeros(n, dtype=torch.bool)
        prune_mask[prune_idx] = True
        # confirm the candidates form a visible 2D region
        conf = self._render(keyframe, background=torch.ones(3), used_mask=prune_mask)
        region = _to_np(conf["alpha"][0] > self.config["min_opacity"])
        region = ndimage.binary_erosion(region, structure=_struct(self.config["morph_kernel"]))
        return prune_mask if region.sum() > 0 else None

    @torch.no_grad()
    def _propagate_removal_masks(self, frame_id: int, keyframe: dict, removal_mask: torch.Tensor) -> int:
        """Expand the removal set using covisible frames, update occlusion masks, prune."""
        eps = self.config["depth_change_threshold"]
        covisible_ids = self.get_covisible_keyframes(keyframe)
        extra = torch.zeros_like(removal_mask)
        any_extra = False
        for covis_id in covisible_ids:
            if covis_id == frame_id:
                continue
            cov = self.keyframes[covis_id]
            h, w = self._hw(cov)
            out = self._render(cov, background=torch.zeros(3), used_mask=removal_mask)
            agree_depth = (out["depth"][0] - cov["depth"]).abs() < eps
            agree_color = (out["render"] - cov["color"]).abs().mean(0) < self.config["color_error_threshold"]
            alpha_ok = out["alpha"][0] > self.config["min_opacity"]
            agree = agree_depth & agree_color & alpha_ok
            self.occlusion_masks[covis_id] = agree.clone() if covis_id not in self.occlusion_masks \
                else (self.occlusion_masks[covis_id] | agree)
            if agree.any():
                self._record("removal_occlusion", frame=covis_id, pixels=int(agree.sum()))
            for mask in cov["masks"]:
                msum = max(mask.sum().item(), 1)
                coverage = (self.occlusion_masks[covis_id] & mask).sum().item() / msum
                if coverage > self.config["removal_coverage_threshold"]:
                    self.occlusion_masks[covis_id] = self.occlusion_masks[covis_id] | mask
                agreement = (mask & agree).sum().item() / msum
                if agreement > self.config["removal_coverage_threshold"]:
                    full = self._render(cov, background=torch.zeros(3))
                    cxy, cgd = full["proj_xy"], full["gs_depth"]
                    inframe = (cxy[0] < w) & (cxy[1] < h) & (cxy[0] > 0) & (cxy[1] > 0)
                    sx = cxy[:, inframe].to(torch.long)
                    in_mask = mask[sx[1], sx[0]]
                    fit_depth = (cgd[inframe] - cov["depth"][sx[1], sx[0]]).abs() < eps
                    hit = in_mask & fit_depth
                    if hit.any():
                        any_extra = True
                        extra[inframe] = extra[inframe] | hit
                        self.occlusion_masks[covis_id] = self.occlusion_masks[covis_id] | mask
        if any_extra:
            removal_mask = removal_mask | extra
        removed = self.gaussian_model.prune_points(removal_mask)
        self._record("removal_pruned", frame=frame_id, gaussians=int(removed))
        return removed

    @torch.no_grad()
    def detect_removals(self, frame_id: int, keyframe: dict) -> int:
        removal_mask = self._detect_conflicting_gaussians(keyframe)
        if removal_mask is None:
            return 0
        return self._propagate_removal_masks(frame_id, keyframe, removal_mask)

    # ---------------------------------------------------------- keyframe logic
    def is_keyframe(self, pose: np.ndarray) -> bool:
        if not self.keyframes:
            return True
        last = _to_np(self.keyframes[self._last_keyframe_id]["pose"])
        delta = np.linalg.inv(last) @ pose
        translation = np.linalg.norm(delta[:3, 3])
        rot = np.abs(Rotation.from_matrix(delta[:3, :3]).as_euler("xyz", degrees=True))
        return translation > self.config["keyframe_translation_diff"] or bool(np.any(rot > self.config["keyframe_rotation_diff_deg"]))

    def get_covisible_keyframes(self, keyframe: dict) -> list[int]:
        """Keyframe ids whose depth reprojects into ``keyframe``, sorted by ascending overlap."""
        gt_depth, pose, K = _to_np(keyframe["depth"]), _to_np(keyframe["pose"]), keyframe["intrinsics"]
        ids, scores = [], []
        for covis_id, cov in self.keyframes.items():
            occluded, _ = camera.reproject_points(
                _to_np(cov["depth"]), _to_np(cov["pose"]), cov["intrinsics"], gt_depth, pose, K,
                occlusion_slack=self.config["reproject_occlusion_slack"])
            score = int((occluded > 0).sum())
            if score > 0:
                ids.append(covis_id)
                scores.append(score)
        if scores:
            _, ids = zip(*sorted(zip(scores, ids)))
        return list(ids)

    # ---------------------------------------------------------------- seeding
    @torch.no_grad()
    def _add_gaussians(self, color: torch.Tensor, depth: torch.Tensor, pose: torch.Tensor, K) -> int:
        """Seed Gaussians where the map is empty, too far, or badly coloured."""
        if self.gaussian_model.num_points == 0:
            seeding = torch.ones_like(depth, dtype=torch.bool)
        else:
            h, w = depth.shape
            out = self.gaussian_model.render(K, pose, w, h, background=torch.ones(3))
            r_depth, r_alpha, r_color = out["depth"][0], out["alpha"][0], out["render"]
            depth_error = (depth - r_depth).abs()
            depth_error_mask = (r_depth > depth) & (depth_error > self.config["depth_error_median_factor"] * depth_error.median())
            alpha_mask = r_alpha < self.config["min_opacity"]
            seeding = alpha_mask | depth_error_mask
            l1 = (r_color - color).abs().mean(0)
            seeding = seeding | (l1 > self.config["gaussian_seed_threshold"])
        seeding = seeding & (depth > 0)
        pts = camera.backproject(_to_np(depth), K, _to_np(pose), _to_np(seeding))
        cols = _to_np(color.permute(1, 2, 0))[_to_np(seeding)]
        step = self.config["seed_downsample"]
        pts, cols = pts[::step], cols[::step]
        return self.gaussian_model.add_points(pts, cols)

    # ------------------------------------------------------------------ train
    def make_keyframe(self, sample: dict) -> dict:
        return {
            "color": torch.as_tensor(sample["color"], dtype=torch.float32).permute(2, 0, 1).contiguous(),
            "depth": torch.as_tensor(sample["depth"], dtype=torch.float32),
            "masks": torch.as_tensor(np.asarray(sample["masks"]), dtype=torch.bool),
            "pose": torch.as_tensor(sample["pose"], dtype=torch.float32),
            "intrinsics": np.asarray(sample["intrinsics"], dtype=np.float64),
        }

    def train(self, dataset, progress=None) -> None:
        """Process a dataset sequentially (port of ``GaME.train``)."""
        cd = self.config["change_detection"]
        for dataset_frame_idx in range(dataset.start_frame, len(dataset)):
            frame_id = len(self.estimated_poses)
            sample = dataset[dataset_frame_idx]
            pose = np.asarray(sample["pose"], dtype=np.float64)
            self.estimated_poses[frame_id] = pose
            if not self.is_keyframe(pose):
                continue
            kf = self.make_keyframe(sample)
            added_masks = []
            if cd and len(self.keyframes) > 2:
                added_masks = self.detect_additions(kf)
            self.keyframes[frame_id] = kf
            self._last_keyframe_id = frame_id
            seeded = self._add_gaussians(kf["color"], kf["depth"], kf["pose"], kf["intrinsics"])
            num_iters = self.config["first_keyframe_iters"] if frame_id == dataset.start_frame else self.config["keyframe_iters"]
            self.optimize_model(self.config["single_frame_iters"], only_frame_id=frame_id)
            removed = self.detect_removals(frame_id, kf) if cd else 0
            self.optimize_model(num_iters)
            msg = (f"[{dataset.run_id}] frame {frame_id:3d}: +{seeded} seeded, -{removed} removed, "
                   f"additions={added_masks}, N={self.gaussian_model.num_points}, "
                   f"occl_masks={len(self.occlusion_masks)}, ignored={sorted(self.ignored_frames)}")
            self.log(msg)
            if progress:
                progress(frame_id)

    # --------------------------------------------------------------- evaluate
    @torch.no_grad()
    def evaluate(self, dataset, frames=None) -> dict:
        """Render frames of ``dataset`` and compute PSNR / depth L1 against ground truth."""
        frames = list(range(len(dataset))) if frames is None else frames
        psnrs, l1s, renders = [], [], []
        for i in frames:
            s = dataset[i]
            kf = self.make_keyframe(s)
            h, w = kf["depth"].shape
            out = self.gaussian_model.render(kf["intrinsics"], kf["pose"], w, h)
            valid = kf["depth"] > 0
            psnrs.append(psnr(out["render"].clamp(0, 1), kf["color"]))
            l1s.append(((out["depth"][0] - kf["depth"]).abs() * valid).sum().item() / max(valid.sum().item(), 1))
            renders.append({"color": _to_np(out["render"].clamp(0, 1).permute(1, 2, 0)),
                            "depth": _to_np(out["depth"][0]), "alpha": _to_np(out["alpha"][0])})
        return {"psnr": float(np.mean(psnrs)), "depth_l1": float(np.mean(l1s)),
                "per_frame_psnr": psnrs, "per_frame_depth_l1": l1s, "renders": renders}
