import numpy as np

from gameproto.camera import backproject, look_at, make_intrinsics, project, reproject_points
from gameproto.scene import SyntheticDataset, default_room, sweep_trajectory


def test_look_at_is_opencv_frame():
    pose = look_at([0, 0, 0], [0, 0, 1])
    # a point 1 m ahead and 0.5 m below the camera (world +Y is down) is at +y in camera space
    p = pose @ np.array([0.0, 0.5, 1.0, 1.0])
    assert np.allclose(p[:3], [0.0, 0.5, 1.0])
    p = pose @ np.array([0.5, 0.0, 1.0, 1.0])  # to the right stays to the right
    assert np.allclose(p[:3], [0.5, 0.0, 1.0])


def test_backproject_project_roundtrip():
    K = make_intrinsics(64, 48)
    pose = look_at([0.3, 0.1, -0.5], [0.0, 0.2, 3.0])
    depth = np.full((48, 64), 2.5, dtype=np.float32)
    pts = backproject(depth, K, pose)
    uv, d, front = project(pts, K, pose)
    assert front.all()
    assert np.allclose(d, 2.5, atol=1e-5)
    v, u = np.mgrid[0:48, 0:64]
    assert np.allclose(uv[:, 0], u.reshape(-1) + 0.5, atol=1e-4)
    assert np.allclose(uv[:, 1], v.reshape(-1) + 0.5, atol=1e-4)


def test_reproject_frame_into_itself_reproduces_depth():
    ds = SyntheticDataset(default_room(), sweep_trajectory(3), 64, 48)
    f = ds[1]
    occluded, unfiltered = reproject_points(f["depth"], f["pose"], f["intrinsics"],
                                            f["depth"], f["pose"], f["intrinsics"])
    valid = f["depth"] > 0
    assert np.allclose(unfiltered[valid], f["depth"][valid], atol=1e-4)
    assert np.allclose(occluded[valid], f["depth"][valid], atol=1e-4)


def test_reproject_with_mask_only_lifts_masked_pixels():
    ds = SyntheticDataset(default_room(), sweep_trajectory(3), 64, 48)
    f0, f1 = ds[0], ds[1]
    chair = f0["masks"][list(f0["masks"].sum(axis=(1, 2)) > 0).index(True)]
    _, unfiltered = reproject_points(f0["depth"], f0["pose"], f0["intrinsics"],
                                     f1["depth"], f1["pose"], f1["intrinsics"], start_mask=chair)
    assert 0 < (unfiltered > 0).sum() <= chair.sum()
