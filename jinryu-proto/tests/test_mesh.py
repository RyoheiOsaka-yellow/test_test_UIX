from jinryu import config
from jinryu.mesh import mesh3_bounds, mesh3_code, mesh3_codes_in_bbox


def test_roundtrip_center():
    for code in ["51337784", "52330703", "53394611"]:
        lon0, lat0, lon1, lat1 = mesh3_bounds(code)
        assert mesh3_code((lat0 + lat1) / 2, (lon0 + lon1) / 2) == code


def test_bbox_codes_match_config():
    assert mesh3_codes_in_bbox(config.bbox()) == sorted(config.area()["mesh3_codes"])
