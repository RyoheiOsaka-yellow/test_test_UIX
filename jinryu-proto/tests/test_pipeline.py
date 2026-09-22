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


def test_station_nodes_attaches_subway_to_underground():
    """地下鉄の駅だけ地下ノードに繋ぎ替え、JR の行は地上のまま残す."""
    import geopandas as gpd
    from shapely.geometry import LineString

    from jinryu.pipeline import station_nodes

    nodes = pd.DataFrame(
        {
            "node_id": ["surf1", "surf2", "und1", "und2"],
            "lon": [130.4000, 130.4010, 130.40005, 130.4011],
            "lat": [33.5900, 33.5900, 33.59003, 33.5901],
        }
    )
    links = gpd.GeoDataFrame(
        {
            "u": ["surf1", "und1"],
            "v": ["surf2", "und2"],
            "level": [0, -1],
            "geometry": [
                LineString([(130.4000, 33.5900), (130.4010, 33.5900)]),
                LineString([(130.40005, 33.59003), (130.4011, 33.5901)]),
            ],
        },
        crs="EPSG:4326",
    )
    st = pd.DataFrame(
        {
            "station_id": ["s1", "s2"],
            "name": ["天神", "博多"],
            "operator": ["福岡市", "九州旅客鉄道"],
            "line": ["1号線(空港線)", "鹿児島線"],
            "passengers_per_day": [1000.0, 2000.0],
            "lon": [130.4000, 130.4000],
            "lat": [33.5900, 33.5900],
        }
    )
    coef = {"od": {"subway": {"underground_attach": True, "operator_pattern": "福岡市", "max_attach_m": 400}}}
    out = station_nodes(st, nodes, links, coef)
    assert out.node_id.tolist() == ["und1", "surf1"]
    # 無効時は全駅が最寄りノード
    off = station_nodes(st, nodes, links, {"od": {"subway": {"underground_attach": False}}})
    assert off.node_id.tolist() == ["surf1", "surf1"]


def test_access_matrix_distributes_arrivals_along_frontage():
    """到着人数は沿道リンクへ列和 1 で配られ、店舗の多いリンクに厚く乗る."""
    import geopandas as gpd
    from shapely.geometry import LineString, Point

    from jinryu.od import access_matrix

    # 同じゾーンに同じ長さのリンクが 2 本。片方にだけ店舗が 3 つ面している
    links = gpd.GeoDataFrame(
        {
            "u": ["n1", "n1"],
            "v": ["n2", "n3"],
            "length_m": [100.0, 100.0],
            "geometry": [
                LineString([(130.4000, 33.5900), (130.4011, 33.5900)]),
                LineString([(130.4000, 33.5910), (130.4011, 33.5910)]),
            ],
        },
        crs="EPSG:4326",
    )
    zones = pd.DataFrame({"node_id": ["n1"], "zone_id": ["z1"]})
    poi = gpd.GeoDataFrame(
        {"geometry": [Point(130.4002 + 0.0002 * i, 33.59002) for i in range(3)]}, crs="EPSG:4326"
    )
    A = access_matrix(links, zones, poi, {"z1": 0})
    col = np.asarray(A.todense()).ravel()
    assert abs(col.sum() - 1.0) < 1e-6
    # 店舗 3 つぶん重み (1+3) : 1 になる
    assert abs(col[0] / col[1] - 4.0) < 1e-4
