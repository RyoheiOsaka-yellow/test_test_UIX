"""JIS X 0410 地域メッシュコードのユーティリティ（1次〜3次、1kmメッシュ＝3次）."""

from __future__ import annotations

from shapely.geometry import Polygon, box


def mesh3_code(lat: float, lon: float) -> str:
    """緯度経度 → 3次メッシュ（1km）コード 8桁."""
    p = int(lat * 1.5)
    u = int(lon - 100)
    a = lat * 1.5 - p
    b = lon - 100 - u
    q = int(a * 8)
    v = int(b * 8)
    r = int((a * 8 - q) * 10)
    w = int((b * 8 - v) * 10)
    return f"{p:02d}{u:02d}{q}{v}{r}{w}"


def mesh3_bounds(code: str) -> tuple[float, float, float, float]:
    """3次メッシュコード → (lon_min, lat_min, lon_max, lat_max)."""
    code = str(code)
    assert len(code) == 8, code
    p, u = int(code[0:2]), int(code[2:4])
    q, v = int(code[4]), int(code[5])
    r, w = int(code[6]), int(code[7])
    lat_min = (p + q / 8 + r / 80) / 1.5
    lon_min = 100 + u + v / 8 + w / 80
    return lon_min, lat_min, lon_min + 1 / 80, lat_min + 1 / 120


def mesh3_polygon(code: str) -> Polygon:
    return box(*mesh3_bounds(code))


def mesh3_codes_in_bbox(bbox: tuple[float, float, float, float]) -> list[str]:
    lon_min, lat_min, lon_max, lat_max = bbox
    codes: set[str] = set()
    lat = lat_min
    while lat <= lat_max + 1e-9:
        lon = lon_min
        while lon <= lon_max + 1e-9:
            codes.add(mesh3_code(lat, lon))
            lon += 1 / 160
        lat += 1 / 240
    return sorted(codes)
