"""Gaussian model: parameters, activation, optimiser, add and prune.

A trimmed-down ``GaussianModel`` from the GaME/FlashSplat code base. Spherical
harmonics are replaced by a plain RGB colour per Gaussian (degree-0 SH), and
densification is not implemented (the prototype only runs the incremental
mapping loop, not the final refinement stage).
"""
from __future__ import annotations

import numpy as np
import torch
from scipy.spatial import cKDTree

from . import splat


def inverse_sigmoid(x: torch.Tensor) -> torch.Tensor:
    return torch.log(x / (1.0 - x))


class GaussianModel:
    PARAM_LRS = {"xyz": 1.6e-3, "rgb": 2.5e-3, "opacity": 5e-2, "scaling": 5e-3, "rotation": 1e-3}

    def __init__(self, device: str = "cpu"):
        self.device = device
        self._xyz = torch.zeros(0, 3, device=device)
        self._rgb = torch.zeros(0, 3, device=device)
        self._opacity = torch.zeros(0, 1, device=device)
        self._scaling = torch.zeros(0, 3, device=device)
        self._rotation = torch.zeros(0, 4, device=device)
        self.optimizer = None
        self._rebuild_optimizer()

    # ------------------------------------------------------------- activations
    @property
    def get_xyz(self) -> torch.Tensor:
        return self._xyz

    @property
    def get_rgb(self) -> torch.Tensor:
        return self._rgb.clamp(0.0, 1.0)

    @property
    def get_opacity(self) -> torch.Tensor:
        return torch.sigmoid(self._opacity)

    @property
    def get_scaling(self) -> torch.Tensor:
        return torch.exp(self._scaling)

    @property
    def get_rotation(self) -> torch.Tensor:
        return torch.nn.functional.normalize(self._rotation, dim=-1)

    @property
    def num_points(self) -> int:
        return self._xyz.shape[0]

    # --------------------------------------------------------------- optimiser
    def _rebuild_optimizer(self) -> None:
        params = []
        for name in self.PARAM_LRS:
            t = getattr(self, f"_{name}")
            t.requires_grad_(True)
            params.append({"params": [t], "lr": self.PARAM_LRS[name], "name": name})
        self.optimizer = torch.optim.Adam(params, lr=0.0, eps=1e-15)

    def _set_params(self, **tensors) -> None:
        for name, t in tensors.items():
            setattr(self, f"_{name}", t.detach().clone().to(self.device))
        self._rebuild_optimizer()

    # --------------------------------------------------------------- add/prune
    @torch.no_grad()
    def add_points(self, points: np.ndarray, colors: np.ndarray, init_opacity: float = 0.5,
                   scale_factor: float = 0.05) -> int:
        """Append Gaussians seeded from a coloured point cloud.

        Port of ``utils.add_points``: scale from the nearest-neighbour distance
        of each new point among all points (``sqrt(dist2 * 0.05)``), identity
        rotation, opacity 0.5.
        """
        if points.shape[0] == 0:
            return 0
        pts = torch.as_tensor(points, dtype=torch.float32)
        cols = torch.as_tensor(colors, dtype=torch.float32)
        all_pts = np.concatenate([self._xyz.detach().cpu().numpy(), points], axis=0)
        tree = cKDTree(all_pts)
        # simple_knn's distCUDA2 returns the mean squared distance to the 3 nearest neighbours
        d, _ = tree.query(points, k=4)
        dist2 = np.clip((d[:, 1:] ** 2).mean(axis=1), 1e-7, None) * scale_factor
        scales = torch.log(torch.sqrt(torch.as_tensor(dist2, dtype=torch.float32)))[:, None].repeat(1, 3)
        rots = torch.zeros(pts.shape[0], 4)
        rots[:, 0] = 1.0
        opac = inverse_sigmoid(torch.full((pts.shape[0], 1), init_opacity))
        self._set_params(
            xyz=torch.cat([self._xyz.detach(), pts]),
            rgb=torch.cat([self._rgb.detach(), cols]),
            opacity=torch.cat([self._opacity.detach(), opac]),
            scaling=torch.cat([self._scaling.detach(), scales]),
            rotation=torch.cat([self._rotation.detach(), rots]),
        )
        return pts.shape[0]

    @torch.no_grad()
    def prune_points(self, mask: torch.Tensor) -> int:
        """Remove the Gaussians where ``mask`` is True. Returns how many were removed."""
        mask = mask.to(torch.bool)
        n = int(mask.sum().item())
        if n == 0:
            return 0
        keep = ~mask
        self._set_params(
            xyz=self._xyz[keep], rgb=self._rgb[keep], opacity=self._opacity[keep],
            scaling=self._scaling[keep], rotation=self._rotation[keep])
        return n

    # ------------------------------------------------------------------ render
    def render(self, intrinsics, pose, width, height, background=None, used_mask=None):
        return splat.render(self.get_xyz, self.get_scaling, self.get_rotation, self.get_opacity,
                            self.get_rgb, intrinsics, pose, width, height,
                            background=background, used_mask=used_mask)

    def state_dict(self) -> dict:
        return {k: getattr(self, f"_{k}").detach().cpu().clone() for k in self.PARAM_LRS}

    def load_state_dict(self, state: dict) -> None:
        self._set_params(**state)
