#!/usr/bin/env python3
"""
PLATEAU 横浜市 2024 の CityGML (建築物) から、建物ごとの災害リスク属性を取り出す。
  uro:TsunamiRiskAttribute (津波浸水想定) / uro:HighTideRiskAttribute (高潮浸水想定) / uro:RiverFloodingRiskAttribute (洪水浸水想定) の浸水深 depth [m]
3D Tiles の属性には入っていないので、PLATEAU の CityGML 配信 API (メッシュ単位で gml を取得) を使う。
  https://api.plateauview.mlit.go.jp/datacatalog/citygml/m:<3次メッシュコード>
なお横浜市のデータには 用途・階数・延床面積 (bldg:usage, storeysAboveGround, uro:totalFloorArea) は入っていない (確認済み)。
出力: $MM_WORK/out/bldg_risk.json  {gml_id: [津波m, 高潮m, 洪水m]}  → build_data.py が建物メタの rk に付ける。
"""
import gzip, json, os, re, urllib.request, concurrent.futures as cf

HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "..", "data")
WORK = os.environ.get("MM_WORK", "/tmp/mm"); D = os.path.join(WORK, "citygml"); os.makedirs(D, exist_ok=True)
UA = {"User-Agent": "minatomirai-3d/1.0", "Accept-Encoding": "gzip"}
RISK = (("TsunamiRiskAttribute", 0), ("HighTideRiskAttribute", 1), ("RiverFloodingRiskAttribute", 2))

def fetch(code):
    fn = os.path.join(D, f"{code}_bldg.gml")
    if os.path.exists(fn) and os.path.getsize(fn) > 1e5: return fn
    api = json.loads(urllib.request.urlopen(urllib.request.Request(f"https://api.plateauview.mlit.go.jp/datacatalog/citygml/m:{code}", headers={"User-Agent": UA["User-Agent"]}), timeout=60).read())
    urls = [f["url"] for c in api.get("cities", []) for f in c.get("files", {}).get("bldg", []) if f["code"] == code]
    if not urls: return None
    raw = urllib.request.urlopen(urllib.request.Request(urls[0], headers=UA), timeout=600).read()
    if raw[:2] == b"\x1f\x8b": raw = gzip.decompress(raw)
    open(fn, "wb").write(raw); return fn

def parse(fn):
    out = {}; t = open(fn, encoding="utf-8", errors="replace").read()
    for m in re.finditer(r'<bldg:Building gml:id="([^"]+)">(.*?)</bldg:Building>', t, flags=re.S):
        gid, body = m.group(1), m.group(2); v = [0.0, 0.0, 0.0]; hit = False
        for tag, i in RISK:
            for blk in re.finditer(rf"<uro:{tag}>(.*?)</uro:{tag}>", body, flags=re.S):
                d = re.search(r"<uro:depth[^>]*>([0-9.]+)<", blk.group(1))
                if d: v[i] = max(v[i], float(d.group(1))); hit = True
        if hit: out[gid] = [round(x, 2) for x in v]
    return out, len(re.findall(r"<bldg:Building gml:id", t))

def main():
    codes = [m["id"] for m in json.load(open(os.path.join(DATA, "jinryu.json")))["meshes"]]
    with cf.ThreadPoolExecutor(4) as ex: files = list(ex.map(fetch, codes))
    risk = {}; total = 0
    for code, fn in zip(codes, files):
        if not fn: print(" ", code, "no file"); continue
        r, n = parse(fn); risk.update(r); total += n; print(" ", code, "buildings", n, "with risk", len(r))
    os.makedirs(os.path.join(WORK, "out"), exist_ok=True); json.dump(risk, open(os.path.join(WORK, "out", "bldg_risk.json"), "w"))
    c = [sum(1 for v in risk.values() if v[i] > 0) for i in range(3)]
    print("buildings", total, "risk attrs", len(risk), "tsunami/hightide/flood", c, "max depth", [max((v[i] for v in risk.values()), default=0) for i in range(3)])

if __name__ == "__main__":
    main()
