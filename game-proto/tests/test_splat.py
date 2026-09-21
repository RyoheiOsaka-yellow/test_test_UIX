import numpy as np
import torch

from gameproto import splat
from gameproto.camera import look_at, make_intrinsics
from gameproto.model import GaussianModel


def _single(z=2.0, opacity=0.9):
    xyz = torch.tensor([[0.0, 0.0, z]])
    scaling = torch.tensor([[0.15, 0.15, 0.15]])
    rotation = torch.tensor([[1.0, 0.0, 0.0, 0.0]])
    op = torch.tensor([[opacity]])
    rgb = torch.tensor([[1.0, 0.0, 0.0]])
    return xyz, scaling, rotation, op, rgb


def test_single_gaussian_projects_to_principal_point():
    K = make_intrinsics(32, 24)
    pose = np.eye(4)
    out = splat.render(*_single(), K, pose, 32, 24)
    assert torch.allclose(out["proj_xy"][:, 0], torch.tensor([16.0, 12.0]))
    assert torch.isclose(out["gs_depth"][0], torch.tensor(2.0))
    peak = out["alpha"][0].argmax().item()
    # the projection lands on a pixel corner, so any of the 4 touching pixels may peak
    assert peak // 32 in (11, 12) and peak % 32 in (15, 16)
    assert torch.isclose(out["depth"][0, 12, 16], torch.tensor(2.0), atol=1e-4)
    assert out["render"][0, 12, 16] > 0.7 and out["render"][1, 12, 16] < 0.05
    assert out["visibility_filter"][0]


def test_used_mask_removes_gaussian_entirely():
    K = make_intrinsics(32, 24)
    out = splat.render(*_single(), K, np.eye(4), 32, 24, used_mask=torch.tensor([False]))
    assert out["alpha"].sum() == 0
    assert not out["visibility_filter"][0]


def test_front_gaussian_occludes_back_gaussian():
    K = make_intrinsics(32, 24)
    xyz = torch.tensor([[0.0, 0.0, 3.0], [0.0, 0.0, 1.5]])
    scaling = torch.full((2, 3), 0.08)
    rot = torch.tensor([[1.0, 0, 0, 0], [1.0, 0, 0, 0]])
    op = torch.tensor([[0.99], [0.99]])
    rgb = torch.tensor([[0.0, 0.0, 1.0], [0.0, 1.0, 0.0]])
    out = splat.render(xyz, scaling, rot, op, rgb, K, np.eye(4), 32, 24)
    assert out["render"][1, 12, 16] > 0.8      # green (front) wins
    assert out["render"][1, 12, 16] > 5 * out["render"][2, 12, 16]
    # alpha-weighted expected depth: dominated by the front Gaussian but blended with the back one
    assert 1.5 <= out["depth"][0, 12, 16].item() < 2.0


def test_model_add_and_prune_and_gradients():
    m = GaussianModel()
    pts = np.random.default_rng(0).uniform(-0.5, 0.5, size=(50, 3)) + np.array([0, 0, 2.0])
    n = m.add_points(pts, np.full((50, 3), 0.5))
    assert n == 50 and m.num_points == 50
    K = make_intrinsics(32, 24)
    out = m.render(K, look_at([0, 0, 0], [0, 0, 2]), 32, 24)
    loss = out["render"].mean() + out["depth"].mean()
    loss.backward()
    assert m._xyz.grad is not None and torch.isfinite(m._xyz.grad).all()
    m.optimizer.step()
    removed = m.prune_points(torch.arange(50) < 10)
    assert removed == 10 and m.num_points == 40
