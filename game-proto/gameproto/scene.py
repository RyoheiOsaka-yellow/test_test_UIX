"""Synthetic RGB-D scene generator (stands in for the Flat/Aria datasets).

A scene is a room made of a floor, a back wall and a few axis-aligned coloured
boxes. A frame is rendered analytically by ray casting, which yields exactly
what the GaME dataset loaders provide: colour, metric depth, per-object
instance masks (playing the role of the SAM masks) and a world-to-camera pose.

Objects can be moved between "runs" to simulate long-term scene changes that
happen while the camera is not looking.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .camera import look_at, make_intrinsics


@dataclass
class Box:
    name: str
    center: np.ndarray          # (3,) world position
    size: np.ndarray            # (3,) full extents
    color: np.ndarray           # (3,) RGB in [0, 1]

    @property
    def lo(self) -> np.ndarray:
        return self.center - self.size / 2.0

    @property
    def hi(self) -> np.ndarray:
        return self.center + self.size / 2.0


@dataclass
class Room:
    """World: +X right, +Y down (floor at y = FLOOR_Y), +Z into the room."""
    width: float = 5.0          # extent along X, centred on 0
    depth: float = 5.0          # extent along Z, from 0 to depth
    height: float = 2.6
    floor_color: np.ndarray = field(default_factory=lambda: np.array([0.62, 0.58, 0.52]))
    wall_color: np.ndarray = field(default_factory=lambda: np.array([0.80, 0.82, 0.85]))
    boxes: list[Box] = field(default_factory=list)

    FLOOR_Y = 1.2  # camera height is 0 => floor is 1.2 m below the camera path

    def instance_names(self) -> list[str]:
        return ["floor", "wall_back", "wall_left", "wall_right", "ceiling"] + [b.name for b in self.boxes]

    def move_box(self, name: str, new_center) -> None:
        for b in self.boxes:
            if b.name == name:
                b.center = np.asarray(new_center, dtype=np.float64)
                return
        raise KeyError(name)

    def remove_box(self, name: str) -> None:
        self.boxes = [b for b in self.boxes if b.name != name]

    # ------------------------------------------------------------------ render
    def render(self, intrinsics: np.ndarray, pose: np.ndarray, width: int, height: int,
               mask_tiles: int = 1):
        """Ray-cast the room.

        ``mask_tiles`` > 1 splits the large planar instances (floor, walls,
        ceiling) into a ``mask_tiles x mask_tiles`` pixel grid of separate
        masks. SAM over-segments large surfaces into many pieces, and several
        GaME rules reason per mask, so this makes the synthetic masks more
        representative of the real setting.

        Returns a dict with ``color`` (H, W, 3) float32 in [0, 1], ``depth``
        (H, W) float32 metres (camera-space Z), ``instance`` (H, W) int32 ids
        indexing ``instance_names()`` (-1 = nothing hit), ``masks`` (N, H, W)
        bool one mask per instance that is visible, ``pose`` and ``intrinsics``.
        """
        fx, fy, cx, cy = intrinsics[0, 0], intrinsics[1, 1], intrinsics[0, 2], intrinsics[1, 2]
        u, v = np.meshgrid(np.arange(width) + 0.5, np.arange(height) + 0.5)
        dirs_cam = np.stack([(u - cx) / fx, (v - cy) / fy, np.ones_like(u)], axis=-1)  # (H, W, 3)
        c2w = np.linalg.inv(pose)
        origin = c2w[:3, 3]
        dirs_world = dirs_cam @ c2w[:3, :3].T
        # depth along the camera Z axis equals t for rays parametrised by dirs_cam (z = 1)
        t_best = np.full((height, width), np.inf)
        inst = np.full((height, width), -1, dtype=np.int32)
        color = np.zeros((height, width, 3), dtype=np.float32)
        names = self.instance_names()

        def hit_plane(axis: int, value: float, iid: int, col, bounds=None):
            nonlocal t_best, inst, color
            d = dirs_world[..., axis]
            with np.errstate(divide="ignore", invalid="ignore"):
                t = (value - origin[axis]) / d
            ok = (t > 1e-4) & (t < t_best) & np.isfinite(t)
            if bounds is not None:
                p = origin + t[..., None] * dirs_world
                for ax, (lo, hi) in bounds.items():
                    ok &= (p[..., ax] >= lo) & (p[..., ax] <= hi)
            t_best = np.where(ok, t, t_best)
            inst[ok] = iid
            color[ok] = col

        half_w = self.width / 2.0
        # floor (y = FLOOR_Y), back wall (z = depth), side walls (x = +-half_w)
        hit_plane(1, self.FLOOR_Y, 0, self.floor_color,
                  {0: (-half_w, half_w), 2: (0.0, self.depth)})
        hit_plane(2, self.depth, 1, self.wall_color,
                  {0: (-half_w, half_w), 1: (self.FLOOR_Y - self.height, self.FLOOR_Y)})
        hit_plane(0, -half_w, 2, self.wall_color * 0.92,
                  {2: (0.0, self.depth), 1: (self.FLOOR_Y - self.height, self.FLOOR_Y)})
        hit_plane(0, half_w, 3, self.wall_color * 0.92,
                  {2: (0.0, self.depth), 1: (self.FLOOR_Y - self.height, self.FLOOR_Y)})
        hit_plane(1, self.FLOOR_Y - self.height, 4, self.wall_color * 1.05,
                  {0: (-half_w, half_w), 2: (0.0, self.depth)})

        # boxes: slab test
        for k, box in enumerate(self.boxes):
            with np.errstate(divide="ignore", invalid="ignore"):
                inv_d = 1.0 / dirs_world
                t0 = (box.lo - origin) * inv_d
                t1 = (box.hi - origin) * inv_d
            tmin = np.minimum(t0, t1).max(axis=-1)
            tmax = np.maximum(t0, t1).min(axis=-1)
            ok = (tmax >= tmin) & (tmax > 1e-4) & (tmin < t_best)
            t_hit = np.where(tmin > 1e-4, tmin, tmax)
            ok &= t_hit > 1e-4
            # simple lambert-ish shading per face so faces are distinguishable
            p = origin + t_hit[..., None] * dirs_world
            face_shade = np.ones_like(t_hit)
            near_top = np.abs(p[..., 1] - box.lo[1]) < 1e-3
            near_side = (np.abs(p[..., 0] - box.lo[0]) < 1e-3) | (np.abs(p[..., 0] - box.hi[0]) < 1e-3)
            face_shade = np.where(near_top, 1.0, np.where(near_side, 0.72, 0.86))
            t_best = np.where(ok, t_hit, t_best)
            inst[ok] = 5 + k
            color[ok] = (box.color[None, None, :] * face_shade[..., None])[ok]

        depth = np.where(np.isfinite(t_best), t_best, 0.0).astype(np.float32)
        color = np.clip(color, 0.0, 1.0)
        mask_list = []
        for i in range(len(names)):
            m = inst == i
            if not m.any():
                continue
            if mask_tiles > 1 and i < 5:  # planar instances
                for ty in range(mask_tiles):
                    for tx in range(mask_tiles):
                        tile = np.zeros_like(m)
                        y0, y1 = ty * height // mask_tiles, (ty + 1) * height // mask_tiles
                        x0, x1 = tx * width // mask_tiles, (tx + 1) * width // mask_tiles
                        tile[y0:y1, x0:x1] = m[y0:y1, x0:x1]
                        if tile.any():
                            mask_list.append(tile)
            else:
                mask_list.append(m)
        masks = np.stack(mask_list, axis=0)
        return {
            "color": color,
            "depth": depth,
            "instance": inst,
            "masks": masks,
            "pose": pose.astype(np.float32),
            "intrinsics": intrinsics,
        }


def default_room() -> Room:
    """The demo room: a table in the middle, a chair on the left, a shelf on the right."""
    y_floor = Room.FLOOR_Y
    boxes = [
        Box("table", np.array([0.0, y_floor - 0.35, 3.0]), np.array([1.2, 0.7, 0.7]), np.array([0.55, 0.36, 0.22])),
        Box("chair", np.array([-1.5, y_floor - 0.25, 2.2]), np.array([0.5, 0.5, 0.5]), np.array([0.85, 0.25, 0.20])),
        Box("shelf", np.array([1.9, y_floor - 0.6, 4.4]), np.array([0.6, 1.2, 0.4]), np.array([0.20, 0.45, 0.80])),
    ]
    return Room(boxes=boxes)


def sweep_trajectory(num_frames: int, radius_x: float = 1.6, z_cam: float = 0.4,
                     look_z: float = 3.2) -> list[np.ndarray]:
    """Camera pans across the room from left to right and back, looking inward.

    The camera sits at height 0 (1.2 m above the floor), slides along X and
    always looks at a point on the back half of the room, so consecutive frames
    overlap (covisible) but the far-left and far-right ends of the sweep do
    not see each other's side of the room.
    """
    poses = []
    for i in range(num_frames):
        s = i / max(num_frames - 1, 1)
        x = -radius_x + 2.0 * radius_x * s
        eye = np.array([x, 0.0, z_cam])
        target = np.array([x * 0.8, 0.35, look_z])
        poses.append(look_at(eye, target))
    return poses


class SyntheticDataset:
    """Sequence of RGB-D frames rendered from a (possibly changed) room.

    Mirrors the interface of the GaME dataset classes: ``len()``,
    ``__getitem__`` returning color/depth/masks/pose/intrinsics, plus
    ``start_frame`` and ``run_id`` attributes.
    """

    def __init__(self, room: Room, poses: list[np.ndarray], width: int, height: int,
                 run_id: str = "run1", fov_x_deg: float = 70.0, start_frame: int = 0,
                 mask_tiles: int = 1):
        self.room = room
        self.mask_tiles = mask_tiles
        self.poses = poses
        self.width, self.height = width, height
        self.intrinsics = make_intrinsics(width, height, fov_x_deg)
        self.run_id = run_id
        self.start_frame = start_frame
        self._cache: dict[int, dict] = {}

    def __len__(self) -> int:
        return len(self.poses)

    def __getitem__(self, idx: int) -> dict:
        if idx not in self._cache:
            self._cache[idx] = self.room.render(self.intrinsics, self.poses[idx], self.width, self.height,
                                                mask_tiles=self.mask_tiles)
        return self._cache[idx]
