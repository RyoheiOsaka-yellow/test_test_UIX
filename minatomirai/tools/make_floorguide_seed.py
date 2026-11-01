#!/usr/bin/env python3
"""
フロアガイド CSV (data/floorguide.csv) の雛形を、データパック内の OSM 店舗 POI (階層つき) から生成する。
既存の CSV があれば、手入力行 (source 列が osm 以外) は保持し、osm 行だけ作り直す。

CSV 列: building,floor,zone,name,category,share,source
  building: 建物名 (パック内の建物名と部分一致)   floor: 1F / 2F / B1 ...   zone: 区画記号 (任意)
  name: テナント名   category: 飲食/物販/サービス/オフィス/医療/公共/宿泊/その他   share: 区画の相対幅 (既定 1)
"""
import csv, gzip, json, struct, os, sys
HERE = os.path.dirname(__file__)
PACK = os.path.join(HERE, "..", "data", "minatomirai.pack")
OUT = os.path.join(HERE, "..", "data", "floorguide.csv")
TARGETS = ["MARK IS minatomirai", "ランドマークプラザ", "クイーンズスクエア横浜", "Yokohama World Porters", "横浜ランドマークタワー"]

def load_header():
    raw = gzip.decompress(open(PACK, "rb").read())
    n = struct.unpack("<I", raw[:4])[0]
    return json.loads(raw[4:4 + n].decode("utf-8"))

def floor_label(lv):
    return f"B{-lv}" if lv < 0 else f"{lv + 1}F"

def main():
    h = load_header(); metas = h["buildings"]["meta"]; pois = h["poi"]
    rows = []
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            rows = [r for r in csv.DictReader(f) if r.get("source", "") not in ("osm", "")]
    for b, m in enumerate(metas):
        if not m.get("n") or not any(t in m["n"] for t in TARGETS): continue
        for q in pois:
            if q.get("b") == b and q.get("lv") is not None:
                rows.append({"building": m["n"], "floor": floor_label(q["lv"]), "zone": "", "name": q["n"], "category": q.get("c", "その他"), "share": "1", "source": "osm"})
    rows.sort(key=lambda r: (r["building"], r["floor"], r["name"]))
    with open(OUT, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["building", "floor", "zone", "name", "category", "share", "source"]); w.writeheader(); w.writerows(rows)
    print("wrote", OUT, len(rows), "rows")

if __name__ == "__main__":
    main()
