#!/usr/bin/env python3
"""
国土交通省「全国の人流オープンデータ (1km メッシュ別の滞在人口)」から、対象範囲にかかるメッシュの
2019 年 (コロナ禍前。みなとみらい21地区の来街者数は 2024 年に 2019 年比 99% まで回復) の値を集計して data/jinryu.json を作る。
  出典: https://www.geospatial.jp/ckan/dataset/mlit-1km-fromto  (政府標準利用規約)
  dayflag 0=休日 1=平日 2=全日 / timezone 0=昼 (11〜14 時台) 1=深夜 (1〜4 時台) 2=終日。値は 1 か月間の 1 日あたり平均の滞在人口。
出力: メッシュごとの 平日昼・平日深夜・休日昼・休日深夜 (年平均) と月別の値、メッシュ矩形 (原点相対 m)、対象範囲との重なり率。
人流モデルの較正 (tools/calibrate_people.mjs) と検証表示に使う。時間帯は昼と深夜の 2 区分しか無いので、時間帯分布の較正には使えない。
"""
import collections, csv, io, json, os, urllib.request, zipfile
from pyproj import Transformer

HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "..", "data")
WORK = os.environ.get("MM_WORK", "/tmp/mm")
GN = (-18292.7, -60134.6); BOX = (-1300, -1350, 1500, 1200)
URL = "https://www.geospatial.jp/ckan/dataset/8fd79f08-00e6-4d14-9c89-e3bdca66af11/resource/2faa20e9-2007-4a6a-bf6a-f5ece6823707/download/monthly_mdp_mesh1km_14.zip"
YEAR = "2019"

def mesh_bounds(code):
    p, u, q, v, r, w = int(code[0:2]), int(code[2:4]), int(code[4]), int(code[5]), int(code[6]), int(code[7])
    lat0 = p / 1.5 + q / 12 + r / 120; lon0 = u + 100 + v / 8 + w / 80
    return lat0, lon0, lat0 + 1 / 120, lon0 + 1 / 80

def main():
    d = os.path.join(WORK, "jinryu"); os.makedirs(d, exist_ok=True); fn = os.path.join(d, "mesh14.zip")
    if not os.path.exists(fn) or os.path.getsize(fn) < 1e6:
        open(fn, "wb").write(urllib.request.urlopen(urllib.request.Request(URL, headers={"User-Agent": "minatomirai-3d/1.0"}), timeout=180).read())
    pl2geo = Transformer.from_crs("EPSG:6677", "EPSG:6668", always_xy=True); geo2pl = Transformer.from_crs("EPSG:6668", "EPSG:6677", always_xy=True)
    lon0, lat0 = pl2geo.transform(BOX[0] + GN[0], BOX[1] + GN[1]); lon1, lat1 = pl2geo.transform(BOX[2] + GN[0], BOX[3] + GN[1])
    want = {}
    for p in range(int(lat0 * 120), int(lat1 * 120) + 1):
        for u in range(int(lon0 * 80), int(lon1 * 80) + 1):
            la, lo = p / 120, u / 80
            a = int(la * 1.5); b = int(lo - 100); q = int((la * 1.5 - a) * 8 + 1e-9); v = int((lo - 100 - b) * 8 + 1e-9)
            r = int(round((la - a / 1.5 - q / 12) * 120)); w = int(round((lo - 100 - b - v / 8) * 80))
            want[f"{a}{b}{q}{v}{r}{w}"] = True
    z = zipfile.ZipFile(fn)
    val = collections.defaultdict(lambda: collections.defaultdict(float))   # mesh -> (month, dayflag, tz) -> pop (区をまたぐメッシュは合算)
    for n in z.namelist():
        if not n.endswith(".csv.zip") or f"/{YEAR}/" not in n: continue
        zz = zipfile.ZipFile(io.BytesIO(z.read(n))); rd = csv.reader(io.StringIO(zz.read(zz.namelist()[0]).decode("utf-8", "replace"))); next(rd)
        for m, pref, city, y, mo, df, tz, pop in rd:
            if m in want: val[m][(int(mo), int(df), int(tz))] += float(pop)
    out = []
    for m in sorted(val):
        la0, lo0, la1, lo1 = mesh_bounds(m)
        xs, ys = geo2pl.transform([lo0, lo1, lo1, lo0], [la0, la0, la1, la1])
        x0 = min(xs) - GN[0]; x1 = max(xs) - GN[0]; y0 = min(ys) - GN[1]; y1 = max(ys) - GN[1]
        ov = max(0, min(x1, BOX[2]) - max(x0, BOX[0])) * max(0, min(y1, BOX[3]) - max(y0, BOX[1])) / ((x1 - x0) * (y1 - y0))
        if ov <= 0: continue
        v = val[m]; months = sorted({k[0] for k in v})
        mean = lambda df, tz: round(sum(v.get((mo, df, tz), 0) for mo in months) / len(months))
        out.append({"id": m, "rect": [round(x0), round(y0), round(x1), round(y1)], "overlap": round(ov, 3),
                    "wkDay": mean(1, 0), "wkNight": mean(1, 1), "holDay": mean(0, 0), "holNight": mean(0, 1),
                    "monthWkDay": [round(v.get((mo, 1, 0), 0)) for mo in range(1, 13)], "monthHolDay": [round(v.get((mo, 0, 0), 0)) for mo in range(1, 13)]})
    js = {"source": "国土交通省 全国の人流オープンデータ (1kmメッシュ別の滞在人口) 2019年", "url": "https://www.geospatial.jp/ckan/dataset/mlit-1km-fromto", "year": int(YEAR),
          "note": "昼=11〜14時台, 深夜=1〜4時台の滞在人口 (月別の1日平均) の年平均", "meshes": out}
    json.dump(js, open(os.path.join(DATA, "jinryu.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print("jinryu.json meshes", len(out)); [print(" ", o["id"], o["rect"], o["overlap"], o["wkDay"], o["wkNight"], o["holDay"]) for o in out]

if __name__ == "__main__":
    main()
