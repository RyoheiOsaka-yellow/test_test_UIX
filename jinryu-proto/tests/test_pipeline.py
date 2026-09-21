import numpy as np
import pandas as pd

from jinryu.assign import accumulate, build_network, shortest_tree
from jinryu.downscale import downscale
from jinryu.od import gravity_row

COEF = {
    "alpha": {"weekday": {"day": {"office": 1.0, "residential": 0.2}}},
    "beta": {"enabled": False, "by_zone_code": {"default": 1.0}},
}


def test_downscale_conserves_mesh_population():
    b = pd.DataFrame(
        {
            "building_id": ["a", "b", "c", "d"],
            "mesh_code": ["m1", "m1", "m1", "m2"],
            "usage_class": ["office", "residential", "office", "residential"],
            "zoning": ["9", "9", "1", "1"],
            "gfa": [1000.0, 500.0, 200.0, 300.0],
            "gfa_is_estimated": [False, True, False, False],
            "floors_is_estimated": [False, False, False, False],
        }
    )
    mf = pd.DataFrame(
        {
            "mesh_code": ["m1", "m2"],
            "period": "2019-10",
            "day_type": "weekday",
            "time_band": "day",
            "population": [1234.0, 77.0],
        }
    )
    bp = downscale(mf, b, COEF)
    s = bp.merge(b[["building_id", "mesh_code"]]).groupby("mesh_code").pop_est.sum()
    assert abs(s["m1"] - 1234.0) < 0.01
    assert abs(s["m2"] - 77.0) < 0.01
    # α の効き: 業務 1000m² は住宅 500m² の 10 倍の重み
    a = bp.set_index("building_id").pop_est
    assert abs(a["a"] / a["b"] - 10.0) < 1e-3


def test_assignment_conserves_trips_on_path_graph():
    # 0 - 1 - 2 - 3 の直線グラフ。0 から 3 へ 10 トリップ → 全リンクに 10
    links = pd.DataFrame(
        {
            "link_id": ["l01", "l12", "l23"],
            "u": ["n0", "n1", "n2"],
            "v": ["n1", "n2", "n3"],
            "cost_m": [100.0, 100.0, 100.0],
        }
    )
    net = build_network(links)
    dist, pred = shortest_tree(net, net.idx("n0"), limit=1e9)
    loads = np.zeros((4, 1))
    loads[net.idx("n3"), 0] = 10.0
    flow = np.zeros((3, 1))
    accumulate(net, dist, pred, loads, flow)
    assert np.allclose(flow[:, 0], [10, 10, 10])


def test_gravity_row_sums_to_origin():
    T = gravity_row(50.0, np.array([1.0, 2.0, 3.0]), np.array([100.0, 500.0, np.inf]), 450.0, 2500.0)
    assert abs(T.sum() - 50.0) < 1e-9
    assert T[2] == 0.0
