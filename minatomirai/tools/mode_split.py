#!/usr/bin/env python3
"""
鉄道以外で来る人の「手段の内訳」を、公開データから見積もって data/mode_split.json に書く (src/people_model.js が読む)。
  車   = 駐車場の収容台数 × 回転率 × 1 台あたりの人数
         収容台数: OSM の駐車場 (capacity タグ、無ければ面積 ÷ 27 m²、立体は × 階数)
                   + 主要施設の館内駐車場の実数 (data/parking_facilities.json, 公式サイトや案内サイトの掲載値)
                   + それ以外の大型施設 (延床 250 m² に 1 台の見積もり × 実数が分かる施設での補正比)
         回転率  : みなとみらい公共駐車場の利用実績 (2012 年度 369,328 台 ÷ 収容 1,154 台 ÷ 365 日 = 0.88 回/日)
  バス = 国土数値情報 バスルート (N07, 2011 年度) の系統別運行本数 (平日・土曜・日祝) の合計 × 1 便あたり範囲内で降りる人数 (仮定)
  残り = 範囲外から徒歩・自転車で来る人、範囲内の居住者・宿泊者など (総量 κ − 1 倍から車とバスを引いた残り)
使い方: N07 の神奈川県分 (N07-11_14_GML.zip) を $MM_WORK/mode/n07 に展開してから実行する。
"""
import json, math, os, re, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_data as B
from fit_underlays import load_pack, DATA

N07 = os.environ.get("N07_XML", os.path.join(os.environ.get("MM_WORK", "/tmp/mm"), "mode/n07/N07-11_14_GML/N07-11_14.xml"))
SPACE_M2 = 27.0          # 1 台あたりの面積 (車路を含む, 仮定)
MULTI_LEVELS = 5         # 立体駐車場の階数 (タグが無いとき, 仮定)
FLOOR_PER_SPACE = 250.0  # 大型施設の館内駐車場: 延床 250 m² に 1 台 (仮定)
BIG_FLOOR = 20000        # 館内駐車場を見込む施設の延床の下限 (m²)
PUBLIC_CAP = 1154        # みなとみらい公共駐車場の収容台数
TURNOVER = 369328 / PUBLIC_CAP / 365   # 同駐車場の 2012 年度の利用実績 369,328 台から
OCC = {"weekday": 1.3, "holiday": 1.9}   # 1 台あたりの人数 (仮定)
ALIGHT_PER_TRIP = 12     # バス 1 便あたり範囲内で降りる人数 (仮定)

def parking():
    nodes, ways, *_ = B.load_osm(); cache = {}; tagged = 0; surf = 0.0; multi = 0.0; n = 0
    cap_of = lambda t: int(t["capacity"]) if str(t.get("capacity", "")).isdigit() else 0
    for nid, (lon, lat, t) in nodes.items():
        if t.get("amenity") != "parking" or t.get("access") in ("private", "no"): continue
        if B.inbox(*B.to_local(lon, lat)): tagged += cap_of(t); n += 1
    for w, (nd, t) in ways.items():
        if t.get("amenity") != "parking" or t.get("access") in ("private", "no"): continue
        pts = B.way_coords(nodes, ways, w, cache)
        if len(pts) < 3: continue
        if not B.inbox(sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)): continue
        n += 1; c = cap_of(t)
        if c: tagged += c; continue
        a = abs(sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))) / 2
        if t.get("parking") == "multi-storey":
            lv = t.get("building:levels") or t.get("levels"); multi += a * (int(lv) if str(lv).isdigit() else MULTI_LEVELS)
        else: surf += a
    # 館内駐車場: 台数が分かる施設 (data/parking_facilities.json) は実数を使う。
    # 分からない大型施設は「延床 250 m² に 1 台」の見積もりに、実数が分かる施設での 実数 ÷ 見積もり の比を掛けて補正する
    header, _ = load_pack(); fac = json.load(open(os.path.join(DATA, "parking_facilities.json"))); est = [0.0] * len(fac); other = 0.0; nb = 0; pts = {}
    for m in header["buildings"]["meta"]:
        if m.get("u") == "res" or not m.get("a") or (m.get("n") and "架空" in m["n"]): continue
        fl = m["a"] * max(1, (m.get("h") or 0) / 4.2); k = next((i for i, f in enumerate(fac) if m.get("n") and any(re.search(q, m["n"]) for q in f["match"])), -1)
        if k >= 0:
            est[k] += fl / FLOOR_PER_SPACE
            if k not in pts or fl > pts[k][0]: pts[k] = (fl, m["c"])   # 発着点はその施設でいちばん大きい棟の位置
        elif fl >= BIG_FLOOR: other += fl / FLOOR_PER_SPACE; nb += 1
    known = sum(f["capacity"] for f in fac); use = [i for i, f in enumerate(fac) if f["match"] and not f.get("noRatio") and est[i] > 0]
    ratio = sum(fac[i]["capacity"] for i in use) / sum(est[i] for i in use)
    table = [{"name": f["name"], "capacity": f["capacity"], "kind": f["kind"], "est": round(est[i]) if f["match"] else None} for i, f in enumerate(fac)]
    return {"osmCount": n, "tagged": tagged, "surface": round(surf / SPACE_M2), "multi": round(multi / SPACE_M2), "known": known, "knownCount": len(fac), "officialCount": sum(1 for f in fac if f["kind"] == "公式"), "official": sum(f["capacity"] for f in fac if f["kind"] == "公式"), "ratio": round(ratio, 3),
            "otherRaw": round(other), "other": round(other * ratio), "inBuilding": round(known + other * ratio), "bigBuildings": nb, "facilities": table,
            "points": [[c[0], c[1], fac[k]["capacity"]] for k, (fl, c) in sorted(pts.items())]}

def buses():
    s = open(N07, encoding="utf-8", errors="replace").read(); curves = {}
    for m in re.finditer(r'<gml:Curve gml:id="(cv\d+)">(.*?)</gml:Curve>', s, re.S):
        v = list(map(float, re.search(r"<gml:posList>(.*?)</gml:posList>", m.group(2), re.S).group(1).split()))
        if any(35.44 < v[i] < 35.475 and 139.61 < v[i + 1] < 139.655 for i in range(0, len(v), 2)): curves[m.group(1)] = [B.to_local(v[i + 1], v[i]) for i in range(0, len(v), 2)]
    lines = collections.defaultdict(lambda: [0.0, 0.0, 0.0]); unknown = set()
    for m in re.finditer(r'<ksj:BusRoute gml:id="br\d+">(.*?)</ksj:BusRoute>', s, re.S):
        b = m.group(1); cv = re.search(r'href="#(cv\d+)"', b).group(1)
        if cv not in curves or not any(B.inbox(*p) for p in curves[cv]): continue
        g = lambda k: re.search(rf"<ksj:{k}>(.*?)</ksj:{k}>", b, re.S).group(1)
        key = (g("bsc"), g("boc"), g("bln")); f = [float(g(k) or 0) for k in ("rpd", "rps", "rph")]
        if f[0] > 990: unknown.add(key); continue   # 999.9 = 本数不明
        v = lines[key]
        for i in range(3): v[i] = max(v[i], f[i])
    # GTFS (tools/fetch_gtfs_bus.py の結果) があれば、その事業者の系統は N07 (2011 年度) ではなく現行ダイヤの便数を使う
    gt = None
    try: gt = json.load(open(os.path.join(DATA, "bus_gtfs.json")))
    except OSError: pass
    replaced = 0
    if gt:
        keys = [k for k in lines if any(a in k[1] or k[1] in a for a in gt["n07Operators"])]
        replaced = len(keys)
        for k in keys: del lines[k]
    tot = [round(sum(v[i] for v in lines.values())) for i in range(3)]
    if gt: tot = [tot[0] + gt["weekday"]["trips"], tot[1] + gt["saturday"]["trips"], tot[2] + gt["holiday"]["trips"]]
    top = sorted(((v[0], k[1], k[2]) for k, v in lines.items()), reverse=True)[:8]
    out = {"lines": len(lines), "unknown": len(unknown), "weekday": tot[0], "saturday": tot[1], "holiday": tot[2], "top": [[k, l, n] for n, k, l in top], "source": "国土数値情報 N07 (2011 年度)"}
    if gt: out.update({"source": "GTFS (" + "・".join(f["agency"] for f in gt["feeds"]) + ") + 国土数値情報 N07 (2011 年度)", "gtfs": {"feeds": gt["feeds"], "replacedLines": replaced, "weekday": gt["weekday"]["trips"], "holiday": gt["holiday"]["trips"]}, "hourly": gt["weekday"]["hourly"], "hourlyHoliday": gt["holiday"]["hourly"]})
    return out

def main():
    P = parking(); Bs = buses(); cap = P["tagged"] + P["surface"] + P["multi"] + P["inBuilding"]
    car = {d: round(cap * TURNOVER * OCC[d]) for d in OCC}                       # 1 日に車で来る人数 (片道)
    bus = {"weekday": Bs["weekday"] * ALIGHT_PER_TRIP, "holiday": Bs["holiday"] * ALIGHT_PER_TRIP}
    out = {"parking": {**P, "capacity": cap, "turnover": round(TURNOVER, 3), "occupancy": OCC}, "bus": {**Bs, "alightPerTrip": ALIGHT_PER_TRIP},
           "carPersons": car, "busPersons": bus,
           "sources": ["OpenStreetMap の駐車場 (amenity=parking)", "主要施設の駐車場の収容台数 (各施設の公式サイト・駐車場案内サイト, data/parking_facilities.json)", "みなとみらい公共駐車場の利用実績 (横浜市会資料, 2012 年度 369,328 台) と収容台数 1,154 台", "国土数値情報 バスルート N07 (2011 年度, 系統別の運行本数)", "横浜市 記者発表 みなとみらい 21 地区の来街者数 (手段別の内訳は非公表)"],
           "assumed": [f"駐車 1 台あたり {SPACE_M2:.0f} m²", f"立体駐車場は {MULTI_LEVELS} 階", f"台数が分からない延床 {BIG_FLOOR:,} m² 以上の施設は、延床 {FLOOR_PER_SPACE:.0f} m² に 1 台 × 補正比 {P['ratio']}", f"1 台あたり 平日 {OCC['weekday']} 人・休日 {OCC['holiday']} 人", f"バス 1 便あたり範囲内で {ALIGHT_PER_TRIP} 人が降りる"]}
    json.dump(out, open(os.path.join(DATA, "mode_split.json"), "w"), ensure_ascii=False, indent=1)
    print(json.dumps(out, ensure_ascii=False, indent=1))

if __name__ == "__main__":
    main()
