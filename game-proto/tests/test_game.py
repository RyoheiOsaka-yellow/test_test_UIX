"""Integration test: the GaME port forgets a moved object, the static baseline does not.

Runs the small synthetic scenario at a very low resolution so it finishes in
about a minute on CPU.
"""
import copy

import numpy as np
import pytest

from gameproto.game import GaME
from gameproto.scene import SyntheticDataset, default_room, sweep_trajectory

CHAIR_A = np.array([-1.5, 1.2 - 0.25, 2.2])
CHAIR_B = np.array([1.35, 1.2 - 0.25, 2.3])
SIZE = np.array([0.5, 0.5, 0.5])


def _inside(model, center):
    xyz = model.get_xyz.detach().numpy()
    lo, hi = center - SIZE / 2, center + SIZE / 2
    hi = hi.copy()
    hi[1] -= 0.04
    return int(np.all((xyz >= lo) & (xyz <= hi), axis=1).sum())


@pytest.fixture(scope="module")
def datasets():
    room1 = default_room()
    room1.move_box("chair", CHAIR_A)
    room2 = copy.deepcopy(room1)
    room2.move_box("chair", CHAIR_B)
    traj = sweep_trajectory(5)
    return (SyntheticDataset(room1, traj, 64, 48, run_id="run1"),
            SyntheticDataset(room2, traj, 64, 48, run_id="run2"))


def _config(change_detection):
    return {
        "first_keyframe_iters": 30, "keyframe_iters": 15, "single_frame_iters": 8,
        "reproject_occlusion_slack": 0.3, "addition_cover_depth_gap": 0.3,
        "morph_kernel": 3, "seed_downsample": 3, "change_detection": change_detection,
    }


@pytest.fixture(scope="module")
def runs(datasets):
    ds1, ds2 = datasets
    out = {}
    for name, cd in (("static", False), ("game", True)):
        m = GaME(_config(cd), log=lambda *_: None)
        m.train(ds1)
        a_before = _inside(m.gaussian_model, CHAIR_A)
        m.train(ds2)
        out[name] = {"mapper": m, "a_before": a_before, "a_after": _inside(m.gaussian_model, CHAIR_A),
                     "b_after": _inside(m.gaussian_model, CHAIR_B), "eval": m.evaluate(ds2)}
    return out


def test_run1_builds_chair_at_A(runs):
    assert runs["game"]["a_before"] > 50
    assert runs["static"]["a_before"] > 50


def test_game_removes_stale_chair_and_static_keeps_it(runs):
    g, s = runs["game"], runs["static"]
    assert g["a_after"] < 0.25 * g["a_before"], "GaME should prune most Gaussians of the moved chair"
    assert s["a_after"] > 0.5 * s["a_before"], "the static map keeps trusting the old observations"


def test_game_integrates_chair_at_B(runs):
    assert runs["game"]["b_after"] > 50


def test_game_flags_stale_keyframes(runs):
    m = runs["game"]["mapper"]
    run1_ids = [fid for fid in m.keyframes if fid < 5]
    assert any(fid in m.occlusion_masks for fid in run1_ids)
    assert any(ev["kind"] == "removal_pruned" and ev["gaussians"] > 0 for ev in m.events)
    assert any(ev["kind"] == "addition_detected" for ev in m.events)
    static = runs["static"]["mapper"]
    assert not static.occlusion_masks and not static.events


def test_game_is_more_accurate_on_changed_scene(runs):
    assert runs["game"]["eval"]["psnr"] > runs["static"]["eval"]["psnr"]
    assert runs["game"]["eval"]["depth_l1"] < runs["static"]["eval"]["depth_l1"]
