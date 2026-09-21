"""End-to-end demo: a room changes while the camera is not looking.

Run 1: the camera sweeps the room, the chair is on the left (position A).
Change: the chair is moved to the right (position B) out of view.
Run 2: the camera sweeps again.

Two mappers process both runs with an identical pipeline:
  * ``static``: incremental Gaussian mapping that keeps trusting every old
    keyframe (change detection disabled);
  * ``game``:   the GaME port (dynamic scene adaptation + keyframe management).

Outputs (in ``output/``):
  metrics.json, comparison.png (GT / static / GaME for several run-2 views),
  occlusion_masks.png (which run-1 keyframe regions GaME decided are stale),
  sweep.gif (run-2 sweep, GT | static | GaME), log.txt
"""
from __future__ import annotations

import argparse
import copy
import json
import time
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw

from gameproto.game import GaME
from gameproto.scene import SyntheticDataset, default_room, sweep_trajectory

CHAIR_A = np.array([-1.5, 1.2 - 0.25, 2.2])
CHAIR_B = np.array([1.35, 1.2 - 0.25, 2.3])


def build_datasets(width: int, height: int, frames: int, mask_tiles: int = 1):
    room1 = default_room()
    room1.move_box("chair", CHAIR_A)
    room2 = copy.deepcopy(room1)
    room2.move_box("chair", CHAIR_B)
    traj = sweep_trajectory(frames)
    ds1 = SyntheticDataset(room1, traj, width, height, run_id="run1", mask_tiles=mask_tiles)
    ds2 = SyntheticDataset(room2, traj, width, height, run_id="run2", mask_tiles=mask_tiles)
    return ds1, ds2


def gaussians_in_box(model, center, size) -> int:
    """Gaussians inside the chair volume (floor points just below the seat are excluded)."""
    xyz = model.get_xyz.detach().numpy()
    lo, hi = center - size / 2, center + size / 2
    hi = hi.copy()
    hi[1] -= 0.04  # world +Y is down: stay clearly above the floor plane
    return int(np.all((xyz >= lo) & (xyz <= hi), axis=1).sum())


def upscale(img: np.ndarray, k: int) -> Image.Image:
    return Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).resize(
        (img.shape[1] * k, img.shape[0] * k), Image.NEAREST)


def label(img: Image.Image, text: str) -> Image.Image:
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 8 + 6 * len(text), 14], fill=(0, 0, 0))
    d.text((4, 2), text, fill=(255, 255, 255))
    return img


def hstack(imgs):
    w = sum(i.width for i in imgs) + 4 * (len(imgs) - 1)
    h = max(i.height for i in imgs)
    out = Image.new("RGB", (w, h), (30, 30, 30))
    x = 0
    for i in imgs:
        out.paste(i, (x, 0))
        x += i.width + 4
    return out


def vstack(imgs):
    w = max(i.width for i in imgs)
    h = sum(i.height for i in imgs) + 4 * (len(imgs) - 1)
    out = Image.new("RGB", (w, h), (30, 30, 30))
    y = 0
    for i in imgs:
        out.paste(i, (0, y))
        y += i.height + 4
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--width", type=int, default=80)
    ap.add_argument("--height", type=int, default=60)
    ap.add_argument("--frames", type=int, default=7)
    ap.add_argument("--first-iters", type=int, default=120)
    ap.add_argument("--iters", type=int, default=60)
    ap.add_argument("--single-iters", type=int, default=25)
    ap.add_argument("--out", type=str, default="output")
    ap.add_argument("--only", choices=["static", "game"], default=None)
    ap.add_argument("--ignore-policy", choices=["frame", "mask"], default="frame",
                    help="frame: reference behaviour (drop stale keyframes); mask: keep every keyframe, exclude only masked pixels")
    ap.add_argument("--tiles", type=int, default=1,
                    help="split floor/wall masks into an NxN grid of masks (SAM-like over-segmentation)")
    args = ap.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    log_lines = []

    def log(msg):
        print(msg, flush=True)
        log_lines.append(str(msg))

    ds1, ds2 = build_datasets(args.width, args.height, args.frames, mask_tiles=args.tiles)
    chair_size = np.array([0.5, 0.5, 0.5])

    base_config = {
        "first_keyframe_iters": args.first_iters,
        "keyframe_iters": args.iters,
        "single_frame_iters": args.single_iters,
        # scene-scale constants (the room is 5 m deep; the reference values are for larger scenes)
        "reproject_occlusion_slack": 0.3,
        "addition_cover_depth_gap": 0.3,
        "morph_kernel": 3,
        "seed_downsample": 3,
        "ignore_policy": args.ignore_policy,
    }
    systems = {
        "static": {**base_config, "change_detection": False},
        "game": {**base_config, "change_detection": True},
    }
    if args.only:
        systems = {args.only: systems[args.only]}

    results, models, mappers = {}, {}, {}
    for name, cfg in systems.items():
        log(f"===== {name} =====")
        t0 = time.time()
        mapper = GaME(cfg, log=log)
        mapper.train(ds1)
        after_run1 = mapper.evaluate(ds1)
        n_a_before = gaussians_in_box(mapper.gaussian_model, CHAIR_A, chair_size)
        log(f"[{name}] after run1: PSNR {after_run1['psnr']:.2f} dB, depth L1 {after_run1['depth_l1']:.4f} m, "
            f"N={mapper.gaussian_model.num_points}, gaussians in chair@A box: {n_a_before}")
        mapper.train(ds2)
        after_run2 = mapper.evaluate(ds2)
        n_a = gaussians_in_box(mapper.gaussian_model, CHAIR_A, chair_size)
        n_b = gaussians_in_box(mapper.gaussian_model, CHAIR_B, chair_size)
        elapsed = time.time() - t0
        log(f"[{name}] after run2 (evaluated on the CHANGED room): PSNR {after_run2['psnr']:.2f} dB, "
            f"depth L1 {after_run2['depth_l1']:.4f} m, N={mapper.gaussian_model.num_points}, "
            f"gaussians in chair@A box: {n_a}, chair@B box: {n_b}, "
            f"occlusion masks: {len(mapper.occlusion_masks)}, ignored frames: {sorted(mapper.ignored_frames)}, "
            f"time {elapsed:.0f}s")
        results[name] = {
            "run1_psnr": after_run1["psnr"], "run1_depth_l1": after_run1["depth_l1"],
            "run2_psnr": after_run2["psnr"], "run2_depth_l1": after_run2["depth_l1"],
            "run2_per_frame_psnr": after_run2["per_frame_psnr"],
            "run2_per_frame_depth_l1": after_run2["per_frame_depth_l1"],
            "num_gaussians": mapper.gaussian_model.num_points,
            "gaussians_in_chair_A_after_run1": n_a_before,
            "gaussians_in_chair_A_after_run2": n_a,
            "gaussians_in_chair_B_after_run2": n_b,
            "occlusion_masks": len(mapper.occlusion_masks),
            "ignored_frames": sorted(mapper.ignored_frames),
            "events": mapper.events,
            "seconds": elapsed,
        }
        models[name] = after_run2["renders"]
        mappers[name] = mapper

    (out_dir / "metrics.json").write_text(json.dumps(results, indent=2))
    (out_dir / "log.txt").write_text("\n".join(log_lines))

    # ---------------------------------------------------------------- visuals
    k = 4
    names = list(systems.keys())
    view_ids = [0, args.frames // 2, args.frames - 1]
    rows = []
    for i in view_ids:
        gt = ds2[i]["color"]
        row = [label(upscale(gt, k), f"GT run2 view {i}")]
        for name in names:
            r = models[name][i]["color"]
            ps = results[name]["run2_per_frame_psnr"][i]
            row.append(label(upscale(r, k), f"{name} {ps:.1f}dB"))
        rows.append(hstack(row))
    vstack(rows).save(out_dir / "comparison.png")

    # depth error maps for the same views
    rows = []
    for i in view_ids:
        gt_d = ds2[i]["depth"]
        row = [label(upscale(np.repeat((gt_d / 6.0)[..., None], 3, axis=-1), k), f"GT depth view {i}")]
        for name in names:
            err = np.abs(models[name][i]["depth"] - gt_d) * (gt_d > 0)
            heat = np.stack([np.clip(err / 0.5, 0, 1), np.clip(1 - err / 0.5, 0, 1) * 0.6, np.zeros_like(err)], axis=-1)
            row.append(label(upscale(heat, k), f"{name} |depth err| (red=0.5m)"))
        rows.append(hstack(row))
    vstack(rows).save(out_dir / "depth_error.png")

    # occlusion masks decided by GaME on run-1 keyframes
    if "game" in mappers:
        m = mappers["game"]
        tiles = []
        for fid, kf in m.keyframes.items():
            img = kf["color"].permute(1, 2, 0).numpy().copy()
            occ = m.occlusion_masks.get(fid)
            if occ is not None:
                o = occ.numpy()
                img[o] = img[o] * 0.3 + np.array([1.0, 0.4, 0.1]) * 0.7
            tag = f"kf{fid}" + (" IGNORED" if fid in m.ignored_frames else "") + (" masked" if occ is not None else "")
            tiles.append(label(upscale(img, k), tag))
        n = len(tiles)
        per_row = max(1, (n + 1) // 2)
        vstack([hstack(tiles[r:r + per_row]) for r in range(0, n, per_row)]).save(out_dir / "occlusion_masks.png")

    # sweep gif over run 2
    frames = []
    for i in range(args.frames):
        row = [label(upscale(ds2[i]["color"], k), f"GT run2 {i}")]
        for name in names:
            row.append(label(upscale(models[name][i]["color"], k), name))
        frames.append(hstack(row))
    frames[0].save(out_dir / "sweep.gif", save_all=True, append_images=frames[1:], duration=600, loop=0)

    log("\nSummary (run 2 = changed room):")
    log(f"{'system':8s} {'PSNR':>8s} {'depthL1':>9s} {'#G':>6s} {'chair@A':>8s} {'chair@B':>8s} {'occl':>5s} {'sec':>5s}")
    for name in names:
        r = results[name]
        log(f"{name:8s} {r['run2_psnr']:8.2f} {r['run2_depth_l1']:9.4f} {r['num_gaussians']:6d} "
            f"{r['gaussians_in_chair_A_after_run2']:8d} {r['gaussians_in_chair_B_after_run2']:8d} "
            f"{r['occlusion_masks']:5d} {r['seconds']:5.0f}")
    (out_dir / "log.txt").write_text("\n".join(log_lines))


if __name__ == "__main__":
    main()
