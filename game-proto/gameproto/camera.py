"""Camera geometry helpers (pinhole intrinsics, poses, reprojection).

Conventions (same as the GaME reference code):
  * ``pose`` is a 4x4 world-to-camera matrix (points are mapped with
    ``p_cam = pose @ p_world``).
  * Camera looks down +Z, +X right, +Y down (OpenCV convention).
  * ``intrinsics`` is a 3x3 K matrix ``[[fx, 0, cx], [0, fy, cy], [0, 0, 1]]``.
"""
from __future__ import annotations

import numpy as np


def make_intrinsics(width: int, height: int, fov_x_deg: float = 70.0) -> np.ndarray:
    """Build a pinhole K matrix from image size and horizontal field of view."""
    fx = 0.5 * width / np.tan(np.deg2rad(fov_x_deg) / 2.0)
    fy = fx
    cx, cy = width / 2.0, height / 2.0
    return np.array([[fx, 0.0, cx], [0.0, fy, cy], [0.0, 0.0, 1.0]], dtype=np.float64)


def look_at(eye: np.ndarray, target: np.ndarray, up=(0.0, -1.0, 0.0)) -> np.ndarray:
    """Return a world-to-camera pose for a camera at ``eye`` looking at ``target``.

    ``up`` defaults to -Y because the camera frame has +Y pointing down.
    """
    eye = np.asarray(eye, dtype=np.float64)
    target = np.asarray(target, dtype=np.float64)
    up = np.asarray(up, dtype=np.float64)
    z = target - eye
    z /= np.linalg.norm(z)
    # OpenCV camera frame: x (right) x y (down) = z (forward)  =>  x = y x z, y = z x x
    x = np.cross(z, up)
    if np.linalg.norm(x) < 1e-8:  # looking straight along up
        x = np.array([1.0, 0.0, 0.0])
    x /= np.linalg.norm(x)
    y = np.cross(z, x)
    c2w = np.eye(4)
    c2w[:3, 0], c2w[:3, 1], c2w[:3, 2], c2w[:3, 3] = x, y, z, eye
    return np.linalg.inv(c2w)


def backproject(depth: np.ndarray, intrinsics: np.ndarray, pose: np.ndarray,
                mask: np.ndarray | None = None) -> np.ndarray:
    """Lift depth pixels to world-space 3D points.

    Args:
        depth: (H, W) metric depth, 0 marks invalid pixels.
        intrinsics: (3, 3) K matrix.
        pose: (4, 4) world-to-camera.
        mask: optional (H, W) bool mask restricting which pixels are lifted.

    Returns:
        (M, 3) world points for the valid (and masked) pixels, in row-major
        pixel order.
    """
    h, w = depth.shape
    valid = depth > 0
    if mask is not None:
        valid = valid & mask.astype(bool)
    v, u = np.nonzero(valid)
    z = depth[v, u]
    fx, fy, cx, cy = intrinsics[0, 0], intrinsics[1, 1], intrinsics[0, 2], intrinsics[1, 2]
    x = (u + 0.5 - cx) / fx * z
    y = (v + 0.5 - cy) / fy * z
    cam = np.stack([x, y, z, np.ones_like(z)], axis=1)
    world = (np.linalg.inv(pose) @ cam.T).T
    return world[:, :3]


def project(points_world: np.ndarray, intrinsics: np.ndarray, pose: np.ndarray):
    """Project world points into a camera.

    Returns:
        ``(uv, depth, in_front)`` where ``uv`` is (M, 2) float pixel coordinates,
        ``depth`` is (M,) camera-space Z and ``in_front`` is a bool mask.
    """
    hom = np.concatenate([points_world, np.ones((points_world.shape[0], 1))], axis=1)
    cam = (pose @ hom.T)[:3]
    depth = cam[2]
    in_front = depth > 1e-6
    uv = (intrinsics @ cam)[:2] / np.where(in_front, depth, 1.0)
    return uv.T, depth, in_front


def reproject_points(start_depth, start_pose, start_intrinsics, end_depth, end_pose,
                     end_intrinsics, start_mask=None, occlusion_slack: float = 1.0):
    """Port of ``utils.reproject_points`` from GaME.

    Lifts ``start_depth`` (optionally restricted by ``start_mask``) into 3D and
    projects it into the end camera. Returns two (H, W) depth images in the end
    frame: ``occluded`` keeps only points that are not clearly behind the end
    frame's observed depth (``d - occlusion_slack < end_depth``), ``unfiltered``
    keeps all reprojected points.
    """
    h, w = end_depth.shape
    pts = backproject(start_depth, start_intrinsics, start_pose, start_mask)
    unfiltered = np.zeros((h, w), dtype=np.float32)
    occluded = np.zeros((h, w), dtype=np.float32)
    if pts.shape[0] == 0:
        return occluded, unfiltered
    uv, d, in_front = project(pts, end_intrinsics, end_pose)
    uv, d = uv[in_front], d[in_front]
    ui, vi = np.floor(uv[:, 0]).astype(int), np.floor(uv[:, 1]).astype(int)
    ok = (ui >= 0) & (ui < w) & (vi >= 0) & (vi < h)
    ui, vi, d = ui[ok], vi[ok], d[ok]
    unfiltered[vi, ui] = d
    visible = (d - occlusion_slack) < end_depth[vi, ui]
    occluded[vi[visible], ui[visible]] = d[visible]
    return occluded, unfiltered
