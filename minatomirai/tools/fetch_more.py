#!/usr/bin/env python3
"""
分析レイヤ用の追加データを取得して data/stats_mesh.json に足す (tools/fetch_stats.py の後に実行)。
  1. PLATEAU 都市計画決定情報 用途地域 (urf UseDistrict, MVT z14) → 10 m 格子に用途地域コードと指定容積率を焼く (zoning)
  2. 経済センサス‐活動調査 500m メッシュ 産業小分類 (e-Stat 統計GIS 表 T001164) → 宿泊・集客施設・百貨店の従業者数、医療の事業所数 (econ.cells に追記)
  3. 全国の人流オープンデータ 市区町村単位発地別 (2019 年) → 西区・中区の滞在人口の発地構成 (origin)
"""
import base64, collections, csv, io, json, math, os, urllib.request, zipfile
import numpy as np
from PIL import Image, ImageDraw
from pyproj import Transformer
import mapbox_vector_tile as mvt

HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "..", "data")
WORK = os.environ.get("MM_WORK", "/tmp/mm"); D = os.path.join(WORK, "stats"); os.makedirs(D, exist_ok=True)
GN = (-18292.7, -60134.6); BOX = (-1300, -1350, 1500, 1200); CELL = 10; NX = (BOX[2] - BOX[0]) // CELL; NY = (BOX[3] - BOX[1]) // CELL
geo2pl = Transformer.from_crs("EPSG:6668", "EPSG:6677", always_xy=True); pl2geo = Transformer.from_crs("EPSG:6677", "EPSG:6668", always_xy=True)
UA = {"User-Agent": "minatomirai-3d/1.0"}
ZONES = ["第1種低層住居専用地域", "第2種低層住居専用地域", "第1種中高層住居専用地域", "第2種中高層住居専用地域", "第1種住居地域", "第2種住居地域", "準住居地域", "田園住居地域", "近隣商業地域", "商業地域", "準工業地域", "工業地域", "工業専用地域"]

def get(url, fn, min_size=200):
    p = os.path.join(D, fn)
    if not os.path.exists(p) or os.path.getsize(p) < min_size:
        try: open(p, "wb").write(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180).read())
        except Exception: open(p, "wb").write(b"")
    return p

def zoning():
    cat = {x["id"]: x for x in json.load(open(os.path.join(WORK, "plateau_catalog.json")))["datasets"]}; url = cat["14100_urf_UseDistrict"]["url"]
    z = 14; n = 2 ** z
    lon0, lat0 = pl2geo.transform(BOX[0] + GN[0], BOX[1] + GN[1]); lon1, lat1 = pl2geo.transform(BOX[2] + GN[0], BOX[3] + GN[1])
    tx = lambda lon: int((lon + 180) / 360 * n); ty = lambda lat: int((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n)
    code_img = Image.new("L", (NX, NY), 0); far_img = Image.new("L", (NX, NY), 0); dc = ImageDraw.Draw(code_img); df = ImageDraw.Draw(far_img); seen = set(); keys = collections.Counter(); cnt = collections.Counter()
    for x in range(tx(lon0), tx(lon1) + 1):
        for y in range(ty(lat1), ty(lat0) + 1):
            p = get(url.replace("{z}", str(z)).replace("{x}", str(x)).replace("{y}", str(y)), f"urf_{z}_{x}_{y}.mvt")
            if os.path.getsize(p) == 0: continue
            d = mvt.decode(open(p, "rb").read())
            for layer, v in d.items():
                ext = v.get("extent", 4096)
                def px(pt):
                    lon = (x + pt[0] / ext) / n * 360 - 180; yy = (y + (1 - pt[1] / ext)) / n; lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * yy))))
                    lx, ly = geo2pl.transform(lon, lat); return ((lx - GN[0] - BOX[0]) / CELL, NY - (ly - GN[1] - BOX[1]) / CELL)   # 画像は上が北
                for f in v["features"]:
                    pr = f["properties"]; keys.update(pr.keys()); name = pr.get("urf_function")
                    if name not in ZONES: continue
                    code = ZONES.index(name) + 1; far = 0
                    try:
                        a = json.loads(pr.get("attributes", "{}")); fr = a.get("urf:floorAreaRate") or a.get("urf:floorAreaRatio")
                        if fr: far = float(fr); far = far * 100 if far <= 20 else far
                    except Exception: pass
                    g = f["geometry"]; polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"] if g["type"] == "MultiPolygon" else []
                    for poly in polys:
                        ring = [px(pt) for pt in poly[0]]
                        if len(ring) < 3: continue
                        dc.polygon(ring, fill=code); df.polygon(ring, fill=int(min(255, round(far / 10)))); cnt[name] += 1
                        for hole in poly[1:]:
                            hr = [px(pt) for pt in hole]
                            if len(hr) >= 3: dc.polygon(hr, fill=0); df.polygon(hr, fill=0)
    code = np.flipud(np.array(code_img)); far = np.flipud(np.array(far_img))   # 行 0 = 南
    print("  zoning polygons", dict(cnt)); print("  cells by zone", {ZONES[c - 1]: int((code == c).sum()) for c in np.unique(code) if c}); print("  FAR values (%)", sorted({int(v) * 10 for v in np.unique(far) if v}))
    return {"name": "PLATEAU 都市計画決定情報 用途地域（横浜市 2024）", "src": "PLATEAU urf UseDistrict (MVT)", "zones": ZONES, "nx": int(NX), "ny": int(NY), "grid": base64.b64encode(code.astype(np.uint8).tobytes()).decode(), "far": base64.b64encode(far.astype(np.uint8).tobytes()).decode(), "hasFar": bool((far > 0).any())}

def econ_detail(cells):
    z = zipfile.ZipFile(get("https://www.e-stat.go.jp/gis/statmap-search/data?statsId=T001164&code=5339&downloadType=2", "T001164.zip", 1000))
    t = z.read(z.namelist()[0]).decode("cp932", "replace").split("\n"); head = [h.replace("　", "").strip() for h in t[1].split(",")]
    first = lambda nm: head.index(nm); second = lambda nm: head.index(nm, head.index(nm) + 1)   # 1 回目 = 事業所数, 2 回目 = 従業者数
    num = lambda v: float(v) if v not in ("", "*", "-") else 0.0
    rows = {r.split(",")[0]: r.rstrip("\r").split(",") for r in t[2:] if r.strip()}
    for c in cells:
        r = rows.get(c["id"])
        if not r: continue
        c["empHotel"] = num(r[second("Ｍ751旅館，ホテル")]); c["empDept"] = num(r[second("Ｉ561百貨店，総合スーパー")])
        c["empAttr"] = sum(num(r[second(n)]) for n in ("Ｎ801映画館", "Ｎ802興行場（別掲を除く），興行団", "Ｏ82C博物館，美術館", "Ｏ82D動物園，植物園，水族館"))
        c["estMed"] = sum(num(r[first(n)]) for n in ("Ｐ831病院", "Ｐ832一般診療所", "Ｐ833歯科診療所"))
    print("  econ detail: hotel", round(sum(c.get("empHotel", 0) for c in cells)), "attraction", round(sum(c.get("empAttr", 0) for c in cells)), "dept", round(sum(c.get("empDept", 0) for c in cells)), "medical est", round(sum(c.get("estMed", 0) for c in cells)))

def origin():
    fn = os.path.join(WORK, "jinryu", "fromto14.zip"); os.makedirs(os.path.dirname(fn), exist_ok=True)
    if not os.path.exists(fn): open(fn, "wb").write(urllib.request.urlopen(urllib.request.Request("https://www.geospatial.jp/ckan/dataset/8fd79f08-00e6-4d14-9c89-e3bdca66af11/resource/2ad49a15-8c5d-426f-b718-6d90c0e658ed/download/monthly_fromto_city_14.zip", headers=UA), timeout=180).read())
    z = zipfile.ZipFile(fn); acc = collections.defaultdict(float); months = collections.defaultdict(set)
    for n in z.namelist():
        if not n.endswith(".csv.zip") or "/2019/" not in n: continue
        zz = zipfile.ZipFile(io.BytesIO(z.read(n))); rd = csv.reader(io.StringIO(zz.read(zz.namelist()[0]).decode("utf-8", "replace"))); next(rd)
        for year, month, df, tz, pref, city, fa, pop in rd:
            if city in ("14103", "14104"): acc[(city, int(df), int(tz), int(fa))] += float(pop); months[city].add(month)
    out = {"name": "全国の人流オープンデータ（市区町村単位発地別）2019 年", "areas": ["同じ区内", "神奈川県内の他市区町村", "関東の他都県", "それ以外"], "cities": []}
    for city, nm in (("14103", "横浜市西区"), ("14104", "横浜市中区")):
        m = max(1, len(months[city])); out["cities"].append({"code": city, "n": nm, "wkDay": [round(acc[(city, 1, 0, a)] / m) for a in range(4)], "holDay": [round(acc[(city, 0, 0, a)] / m) for a in range(4)], "wkNight": [round(acc[(city, 1, 1, a)] / m) for a in range(4)]})
        print(" ", nm, out["cities"][-1])
    return out

def main():
    p = os.path.join(DATA, "stats_mesh.json"); js = json.load(open(p))
    print("zoning ..."); js["zoning"] = zoning()
    print("econ detail ..."); econ_detail(js["econ"]["cells"])
    print("origin ..."); js["origin"] = origin()
    json.dump(js, open(p, "w"), ensure_ascii=False, separators=(",", ":")); print("stats_mesh.json", os.path.getsize(p) // 1024, "KB")

if __name__ == "__main__":
    main()
