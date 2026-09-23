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


def test_access_matrix_distributes_arrivals_by_frontage_density():
    """到着人数は列和 1 で配られ、店舗密度（100m あたりの POI 数）に比例する."""
    import geopandas as gpd
    from shapely.geometry import LineString, Point

    from jinryu.od import access_matrix

    # 同じゾーンのリンク 2 本。長さは 2:1、店舗は 4 つ対 1 つ → 密度は 2:1
    links = gpd.GeoDataFrame(
        {
            "u": ["n1", "n1"],
            "v": ["n2", "n3"],
            "length_m": [200.0, 100.0],
            "geometry": [
                LineString([(130.4000, 33.5900), (130.4022, 33.5900)]),
                LineString([(130.4000, 33.5910), (130.4011, 33.5910)]),
            ],
        },
        crs="EPSG:4326",
    )
    zones = pd.DataFrame({"node_id": ["n1"], "zone_id": ["z1"]})
    pts = [Point(130.4002 + 0.0004 * i, 33.59002) for i in range(4)]
    pts.append(Point(130.4002, 33.59102))
    poi = gpd.GeoDataFrame(geometry=pts, crs="EPSG:4326")
    col = np.asarray(access_matrix(links, zones, poi, {"z1": 0}, radius_m=20.0).todense()).ravel()
    assert abs(col.sum() - 1.0) < 1e-6
    assert abs(col[0] / col[1] - 2.0) < 1e-3

    # 沿道に店舗が無いゾーンは均等配分（列和 1 を保つ）
    empty = access_matrix(links, zones, poi.iloc[:0], {"z1": 0}, radius_m=20.0)
    ec = np.asarray(empty.todense()).ravel()
    assert abs(ec.sum() - 1.0) < 1e-6 and abs(ec[0] - ec[1]) < 1e-6


def _grid(*rows):
    return [{"block_cv": {"spearman": s}, "in_sample": {"mape": m}} for s, m in rows]


def test_choose_grid_point_prefers_lower_mape_among_near_ties():
    """順位が誤差以下の差しかないなら、絶対値の誤差が小さいほうを採る."""
    from jinryu.calibrate import choose_grid_point

    # 実際に起きたケース: CV 0.515 が 2 点。in-sample の 0.001 差で MAPE 1.915 が選ばれていた
    i, n = choose_grid_point(_grid((0.377, 1.959), (0.515, 1.682), (0.515, 1.915), (0.510, 2.161)))
    assert (i, n) == (1, 3)  # 0.510 も 0.01 以内なので候補は 3 点


def test_choose_grid_point_ignores_clearly_worse_ranks():
    """順位が明確に劣る点は、MAPE が良くても採らない."""
    from jinryu.calibrate import choose_grid_point

    i, _ = choose_grid_point(_grid((0.20, 0.1), (0.60, 0.9)))
    assert i == 1


def test_choose_grid_point_survives_missing_metrics():
    """指標が出せなかった点（観測が少ない等）が混ざっても落ちない."""
    from jinryu.calibrate import choose_grid_point

    i, _ = choose_grid_point(_grid((None, None), (0.50, 0.8), (0.50, None)))
    assert i == 1


def test_write_back_chosen_keeps_comments_and_adds_missing_keys(tmp_path, monkeypatch):
    """採用値の書き戻しは、説明コメントと桁揃えを保ち、無いキーは足す."""
    import yaml

    from jinryu import calibrate, config

    cfg = tmp_path / "coefficients.yaml"
    cfg.write_text(
        "od:\n"
        "  half_distance_m: 179        # 距離抵抗 f(d)=exp(-ln2·d/half_distance)\n"
        "  zone_cell_m: 150            # 集約グリッド\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(config, "CONFIG_DIR", tmp_path)
    monkeypatch.setattr(config, "area_file", lambda: "area.yaml")
    calibrate.write_back_chosen({"half_distance_m": 450, "access_weight": 100.0, "scale_k": 0.4383})

    text = cfg.read_text(encoding="utf-8")
    assert "# 距離抵抗 f(d)=exp(-ln2·d/half_distance)" in text
    assert "# 集約グリッド" in text
    od = yaml.safe_load(text)["od"]
    assert od["half_distance_m"] == 450
    assert od["access_weight"] == 100
    assert od["calibrated_scale_k"] == 0.4383
    assert od["zone_cell_m"] == 150


def test_write_html_combines_areas_with_toggle(tmp_path):
    """複数エリアの部品を 1 つの HTML にまとめ、差し込み漏れが無いこと."""
    import base64
    import gzip
    import json
    import re

    from jinryu.export_html import write_html

    def bundle(key, label):
        raw = json.dumps({"area": {"name": label}}).encode()
        return {
            "key": key,
            "label": label,
            "title": f"人流ポテンシャル {label}",
            "scope": f"{label}全域",
            "data_gz": base64.b64encode(gzip.compress(raw)).decode(),
            "basemap": {"url": "data:image/jpeg;base64,AA==", "coords": [[0, 0]] * 4},
            "prefmap": {"url": "data:image/jpeg;base64,AA==", "coords": [[0, 0]] * 4},
            "stats": {"links": 1, "buildings": 1},
        }

    out = write_html([bundle("fukuoka", "福岡"), bundle("okayama", "岡山")], tmp_path / "x.html")
    html = out.read_text(encoding="utf-8")
    assert "<title>人流ポテンシャル 福岡・岡山</title>" in html
    assert not re.search(r"__[A-Z_]+__", html.split("<script>", 1)[0])  # 見出し側に差し込み漏れが無い
    assert "/*__AREAS__*/" not in html and "__TITLE__" not in html and "__DESCRIPTION__" not in html
    areas = json.loads(re.search(r"const AREAS = (\[.*?\]);\n", html, re.S).group(1))
    assert [a["key"] for a in areas] == ["fukuoka", "okayama"]
    assert json.loads(gzip.decompress(base64.b64decode(areas[1]["data_gz"])))["area"]["name"] == "岡山"
