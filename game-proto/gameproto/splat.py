"""Minimal differentiable 3D Gaussian splatting renderer on CPU (PyTorch).

This is a dense, tile-free re-implementation of the forward pass of 3DGS that
is good enough for small images (e.g. 96x72) and a few thousand Gaussians. It
returns the same quantities the GaME code consumes from ``flashsplat_render``:

    render (3, H, W), depth (1, H, W), alpha (1, H, W),
    visibility_filter (N,) bool, proj_xy (2, N), gs_depth (N,)

and it supports ``used_mask`` to render only a subset of the Gaussians, which
GaME's removal detection relies on.
"""
from __future__ import annotations

import math

import torch


def quat_to_rotmat(q: torch.Tensor) -> torch.Tensor:
    """(N, 4) unit quaternions (w, x, y, z) -> (N, 3, 3) rotation matrices."""
    q = q / q.norm(dim=-1, keepdim=True).clamp_min(1e-8)
    w, x, y, z = q.unbind(-1)
    R = torch.stack([
        1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
        2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
        2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
    ], dim=-1).reshape(-1, 3, 3)
    return R


def render(xyz, scaling, rotation, opacity, rgb, intrinsics, pose, width, height,
           background=None, used_mask=None, chunk=1024, near=0.05, alpha_cutoff=1.0 / 255):
    """Rasterise Gaussians into an image.

    Args:
        xyz: (N, 3) world positions.
        scaling: (N, 3) positive scales (already exp-activated).
        rotation: (N, 4) quaternions (normalised inside).
        opacity: (N, 1) in [0, 1] (already sigmoid-activated).
        rgb: (N, 3) colours in [0, 1].
        intrinsics: (3, 3) tensor or ndarray.
        pose: (4, 4) world-to-camera tensor or ndarray.
        width, height: image size.
        background: (3,) background colour, defaults to black.
        used_mask: optional (N,) bool tensor; Gaussians outside it are skipped
            entirely (they neither contribute colour nor occlude).
        chunk: number of Gaussians processed per dense block.

    Returns:
        dict with ``render`` (3, H, W), ``depth`` (1, H, W) alpha-normalised
        expected depth (0 where alpha == 0), ``alpha`` (1, H, W),
        ``visibility_filter`` (N,) bool, ``proj_xy`` (2, N) float pixel
        coordinates and ``gs_depth`` (N,) camera-space depth per Gaussian.
    """
    device = xyz.device
    N = xyz.shape[0]
    K = torch.as_tensor(intrinsics, dtype=torch.float32, device=device)
    P = torch.as_tensor(pose, dtype=torch.float32, device=device)
    if background is None:
        background = torch.zeros(3, device=device)
    background = torch.as_tensor(background, dtype=torch.float32, device=device)

    out = {
        "render": background.view(3, 1, 1).expand(3, height, width).clone(),
        "depth": torch.zeros(1, height, width, device=device),
        "alpha": torch.zeros(1, height, width, device=device),
        "visibility_filter": torch.zeros(N, dtype=torch.bool, device=device),
        "proj_xy": torch.zeros(2, N, device=device),
        "gs_depth": torch.zeros(N, device=device),
        "radii": torch.zeros(N, device=device),
    }
    if N == 0:
        return out

    # --- transform + project -------------------------------------------------
    R_w2c, t_w2c = P[:3, :3], P[:3, 3]
    p_cam = xyz @ R_w2c.T + t_w2c                       # (N, 3)
    z = p_cam[:, 2]
    fx, fy, cx, cy = K[0, 0], K[1, 1], K[0, 2], K[1, 2]
    z_safe = z.clamp_min(near)
    u = fx * p_cam[:, 0] / z_safe + cx
    v = fy * p_cam[:, 1] / z_safe + cy
    out["proj_xy"] = torch.stack([u, v], dim=0).detach()
    out["gs_depth"] = z.detach()

    # --- 3D covariance -> 2D covariance (EWA) --------------------------------
    Rm = quat_to_rotmat(rotation)                        # (N, 3, 3)
    S = torch.diag_embed(scaling)                        # (N, 3, 3)
    M = Rm @ S
    cov3d = M @ M.transpose(1, 2)                        # (N, 3, 3)
    x_, y_ = p_cam[:, 0], p_cam[:, 1]
    zero = torch.zeros_like(z_safe)
    J = torch.stack([
        torch.stack([fx / z_safe, zero, -fx * x_ / z_safe ** 2], dim=-1),
        torch.stack([zero, fy / z_safe, -fy * y_ / z_safe ** 2], dim=-1),
    ], dim=1)                                            # (N, 2, 3)
    W = R_w2c.unsqueeze(0).expand(N, 3, 3)
    T = J @ W
    cov2d = T @ cov3d @ T.transpose(1, 2)                # (N, 2, 2)
    cov2d = cov2d + 0.3 * torch.eye(2, device=device)    # low-pass filter as in 3DGS
    det = cov2d[:, 0, 0] * cov2d[:, 1, 1] - cov2d[:, 0, 1] * cov2d[:, 1, 0]
    det = det.clamp_min(1e-8)
    inv_a = cov2d[:, 1, 1] / det
    inv_b = -cov2d[:, 0, 1] / det
    inv_d = cov2d[:, 0, 0] / det
    # screen-space radius (3 sigma of the larger eigenvalue)
    mid = 0.5 * (cov2d[:, 0, 0] + cov2d[:, 1, 1])
    lam = mid + torch.sqrt((mid * mid - det).clamp_min(0.1))
    radii = 3.0 * torch.sqrt(lam)
    out["radii"] = radii.detach()

    # --- culling --------------------------------------------------------------
    active = (z > near) & (u + radii > 0) & (u - radii < width) & (v + radii > 0) & (v - radii < height)
    if used_mask is not None:
        active = active & used_mask.to(device)
    idx = torch.nonzero(active).squeeze(1)
    if idx.numel() == 0:
        return out
    order = torch.argsort(z[idx])                        # front to back
    idx = idx[order]

    # --- dense alpha compositing, front to back -------------------------------
    ys, xs = torch.meshgrid(torch.arange(height, device=device, dtype=torch.float32) + 0.5,
                            torch.arange(width, device=device, dtype=torch.float32) + 0.5,
                            indexing="ij")
    px = torch.stack([xs.reshape(-1), ys.reshape(-1)], dim=1)   # (P, 2)

    trans = torch.ones(px.shape[0], device=device)               # running transmittance
    color = torch.zeros(px.shape[0], 3, device=device)
    depth = torch.zeros(px.shape[0], device=device)
    acc_alpha = torch.zeros(px.shape[0], device=device)
    vis = torch.zeros(N, dtype=torch.bool, device=device)

    for s in range(0, idx.numel(), chunk):
        ids = idx[s:s + chunk]
        dx = px[:, 0:1] - u[ids].unsqueeze(0)                    # (P, C)
        dy = px[:, 1:2] - v[ids].unsqueeze(0)
        power = -0.5 * (inv_a[ids] * dx * dx + inv_d[ids] * dy * dy) - inv_b[ids] * dx * dy
        g = torch.exp(power.clamp_max(0.0))
        a = (opacity[ids, 0].unsqueeze(0) * g).clamp_max(0.99)  # (P, C)
        a = torch.where(a < alpha_cutoff, torch.zeros_like(a), a)
        # exclusive cumulative transmittance inside the chunk (front to back)
        log_one_minus = torch.log1p(-a)
        T_in = torch.exp(torch.cumsum(log_one_minus, dim=1) - log_one_minus)  # (P, C)
        w = a * T_in * trans.unsqueeze(1)
        color = color + w @ rgb[ids]
        depth = depth + w @ z[ids]
        acc_alpha = acc_alpha + w.sum(dim=1)
        vis[ids] = (w.detach().max(dim=0).values > alpha_cutoff)
        trans = trans * torch.exp(log_one_minus.sum(dim=1))

    color = color + trans.unsqueeze(1) * background.unsqueeze(0)
    depth = torch.where(acc_alpha > 1e-6, depth / acc_alpha.clamp_min(1e-6), torch.zeros_like(depth))

    out["render"] = color.T.reshape(3, height, width)
    out["depth"] = depth.reshape(1, height, width)
    out["alpha"] = acc_alpha.reshape(1, height, width)
    out["visibility_filter"] = vis
    return out


def psnr(img: torch.Tensor, gt: torch.Tensor) -> float:
    mse = torch.mean((img - gt) ** 2).item()
    return float("inf") if mse == 0 else 10.0 * math.log10(1.0 / mse)
