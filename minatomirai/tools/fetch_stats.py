#!/usr/bin/env python3
"""
分析レイヤ用の公開統計を取得して data/stats_mesh.json を作る。
  1. 国勢調査 2020 (令和2年) 250m メッシュ「人口及び世帯」  e-Stat 統計地理情報システム 表 T001142
  2. 経済センサス‐活動調査 500m メッシュ「産業(大分類)別 事業所数・従業者数」  e-Stat 統計地理情報システム 表 T001162
  3. 国土数値情報 駅別乗降客数 (S12)  … 駅の乗降人員を一次資料で確認する (data/stations_ksj.json)
出典: 政府統計の総合窓口 (e-Stat) https://www.e-stat.go.jp/gis , 国土数値情報 https://nlftp.mlit.go.jp/ksj/ (いずれも出典明記で利用可)
'*' は秘匿。0 として扱う (秘匿メッシュは隣接メッシュに合算されている)。
"""
import io, json, os, re, urllib.request, zipfile
from pyproj import Transformer

HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "..", "data")
WORK = os.environ.get("MM_WORK", "/tmp/mm"); D = os.path.join(WORK, "stats"); os.makedirs(D, exist_ok=True)
GN = (-18292.7, -60134.6); BOX = (-1300, -1350, 1500, 1200)
geo2pl = Transformer.from_crs("EPSG:6668", "EPSG:6677", always_xy=True); pl2geo = Transformer.from_crs("EPSG:6677", "EPSG:6668", always_xy=True)
UA = {"User-Agent": "minatomirai-3d/1.0"}

def get(url, fn):
    p = os.path.join(D, fn)
    if not os.path.exists(p) or os.path.getsize(p) < 1000: open(p, "wb").write(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180).read())
    return p

def bounds(code):
    """地域メッシュコード (8 桁=1km, 9 桁=500m, 10 桁=250m) → (lat0, lon0, lat1, lon1)"""
    p, u, q, v, r, w = int(code[0:2]), int(code[2:4]), int(code[4]), int(code[5]), int(code[6]), int(code[7])
    lat0 = p / 1.5 + q / 12 + r / 120; lon0 = u + 100 + v / 8 + w / 80; dlat, dlon = 1 / 120, 1 / 80
    for ch in code[8:]:
        k = int(ch) - 1; dlat /= 2; dlon /= 2; lat0 += (k // 2) * dlat; lon0 += (k % 2) * dlon
    return lat0, lon0, lat0 + dlat, lon0 + dlon

def rect(code):
    la0, lo0, la1, lo1 = bounds(code); xs, ys = geo2pl.transform([lo0, lo1, lo1, lo0], [la0, la0, la1, la1])
    return [round(min(xs) - GN[0]), round(min(ys) - GN[1]), round(max(xs) - GN[0]), round(max(ys) - GN[1])]

def inbox(r): return r[2] > BOX[0] and r[0] < BOX[2] and r[3] > BOX[1] and r[1] < BOX[3]
def num(v):
    try: return float(v)
    except ValueError: return 0.0

def table(stats_id):
    z = zipfile.ZipFile(get(f"https://www.e-stat.go.jp/gis/statmap-search/data?statsId={stats_id}&code=5339&downloadType=2", stats_id + ".zip"))
    t = z.read(z.namelist()[0]).decode("cp932", "replace").split("\n"); head = [h.replace("　", "").strip() for h in t[1].split(",")]
    return head, [r.rstrip("\r").split(",") for r in t[2:] if r.strip()]

def main():
    out = {"census": {"name": "国勢調査 2020（令和2年）250m メッシュ 人口及び世帯", "src": "e-Stat 統計地理情報システム 表 T001142", "cells": []},
           "econ": {"name": "経済センサス‐活動調査 500m メッシュ 産業別 事業所数・従業者数", "src": "e-Stat 統計地理情報システム 表 T001162", "cells": []}}
    head, rows = table("T001142")
    ix = lambda name: head.index(name)
    c_pop, c_65, c_hh, c_15 = ix("人口（総数）"), ix("６５歳以上人口総数"), ix("世帯総数"), ix("０～１４歳人口総数")
    for r in rows:
        rc = rect(r[0])
        if inbox(rc): out["census"]["cells"].append({"id": r[0], "rect": rc, "pop": num(r[c_pop]), "p65": num(r[c_65]), "p14": num(r[c_15]), "hh": num(r[c_hh])})
    head, rows = table("T001162")
    # 列: 事業所数 (産業 21 区分) → 従業者数 (同 21 区分) → 男女別
    first = head.index("Ａ～Ｓ全産業"); second = head.index("Ａ～Ｓ全産業", first + 1); names = head[first:second]
    col = lambda nm, base: base + names.index(nm)
    for r in rows:
        rc = rect(r[0])
        if not inbox(rc): continue
        g = lambda nm, base: num(r[col(nm, base)])
        out["econ"]["cells"].append({"id": r[0], "rect": rc, "est": g("Ａ～Ｓ全産業", first), "emp": g("Ａ～Ｓ全産業", second),
            "empRetail": g("Ｉ卸売業，小売業", second), "empFood": g("Ｍ宿泊業，飲食サービス業", second), "empIT": g("Ｇ情報通信業", second), "empMfg": g("Ｅ製造業", second),
            "empPro": g("Ｌ学術研究，専門・技術サービス業", second), "empFin": g("Ｊ金融業，保険業", second), "empMed": g("Ｐ医療，福祉", second), "empPub": g("Ｓ公務（他に分類されるものを除く）", second),
            "estRetail": g("Ｉ卸売業，小売業", first), "estFood": g("Ｍ宿泊業，飲食サービス業", first)})
    json.dump(out, open(os.path.join(DATA, "stats_mesh.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print("census cells", len(out["census"]["cells"]), "pop", round(sum(c["pop"] for c in out["census"]["cells"])), "| econ cells", len(out["econ"]["cells"]), "emp", round(sum(c["emp"] for c in out["econ"]["cells"])), "est", round(sum(c["est"] for c in out["econ"]["cells"])))
    mm = [c for c in out["econ"]["cells"] if c["id"][:8] in ("53391540", "53391550", "53391541")]; print("  MM 中心 3 メッシュの従業者数", round(sum(c["emp"] for c in mm)))
    # ---- 国土数値情報 駅別乗降客数 ----
    try:
        z = zipfile.ZipFile(get("https://nlftp.mlit.go.jp/ksj/gml/data/S12/S12-24/S12-24_GML.zip", "S12-24_GML.zip"))
        gj = [n for n in z.namelist() if n.lower().endswith(".geojson")]; print("  S12 files", [n for n in z.namelist()][:6])
        js = json.loads(z.read(gj[0]).decode("utf-8", "replace")); want = ("みなとみらい", "新高島", "馬車道", "桜木町", "高島町", "横浜", "日本大通り", "関内"); st = []
        keys = None
        for f in js["features"]:
            p = f["properties"]; keys = keys or list(p.keys())
            if p.get("S12_001") in want:
                g = f["geometry"]["coordinates"]; pt = g[0] if isinstance(g[0][0], (int, float)) else g[0][0]
                if 139.60 < pt[0] < 139.66 and 35.43 < pt[1] < 35.48: st.append(p)
        json.dump({"name": "国土数値情報 駅別乗降客数 (S12)", "src": "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-S12-2023.html", "stations": st}, open(os.path.join(DATA, "stations_ksj.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        print("  S12 keys", keys[:12], "...", keys[-8:])
        for p in st: print("  ", p.get("S12_001"), p.get("S12_002"), p.get("S12_003"), [p[k] for k in keys[-8:]])
    except Exception as e:
        print("  S12 failed:", e)

if __name__ == "__main__":
    main()
