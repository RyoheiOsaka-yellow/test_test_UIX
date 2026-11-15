#!/usr/bin/env python3
"""
横断歩道ごとの信号の有無と、周期・青時間を OSM から決めて data/signals.json に書く (src/people.js と src/analysis.js が読む)。
  信号の有無: 横断歩道の上にある OSM の横断歩道ノードのタグ (crossing=traffic_signals / uncontrolled など) を優先し、
              タグで決まらないものは、近く (25 m 以内) に信号機 (highway=traffic_signals) があれば信号あり。無ければ待ちなし
  周期      : 交差点でいちばん格の高い道路の種別で決める (幹線 130 秒、補助幹線 110 秒、その他の幹線 90 秒、細街路 70 秒)
  青時間    : 格の高い道路を渡る横断歩道は周期の 35% − 5 秒、格の低い道路を渡る横断歩道は 55% − 5 秒 (車の青の配分の逆)。
              同格どうしの交差点は 45% − 5 秒ずつで、横断歩道の向きで位相を分ける
周期と配分の数値は一般的な目安による仮定で、実際の信号の設定ではない。
"""
import json, math, os, sys, collections, zlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_data as B
from fit_underlays import load_pack, DATA
from shapely.geometry import LineString, Point
from shapely.strtree import STRtree

RANK = {"motorway": 6, "trunk": 6, "primary": 5, "secondary": 4, "tertiary": 3, "unclassified": 2, "residential": 2, "living_street": 1, "service": 1}
CYCLE = lambda r: 130 if r >= 5 else 110 if r == 4 else 90 if r == 3 else 70
NEAR_SIGNAL = 25.0      # 信号機がこの距離以内にあれば信号つきの横断歩道とみなす (m)
CLUSTER = 45.0          # 信号機をこの距離でまとめて 1 つの交差点とみなす (m)
NO_SIGNAL = {"uncontrolled", "zebra", "unmarked", "no"}

def main():
    nodes, ways, *_ = B.load_osm(); cache = {}
    sig_pts = []; cross_nodes = []   # 信号機 / 横断歩道ノード (x, y, 信号あり=True・なし=False・不明=None)
    for nid, (lon, lat, t) in nodes.items():
        hw = t.get("highway")
        if hw not in ("traffic_signals", "crossing"): continue
        x, y = B.to_local(lon, lat)
        if not (B.BOX[0] - 60 <= x <= B.BOX[2] + 60 and B.BOX[1] - 60 <= y <= B.BOX[3] + 60): continue
        if hw == "traffic_signals": sig_pts.append((x, y))
        else:
            c = t.get("crossing"); s = t.get("crossing:signals")
            flag = True if (c == "traffic_signals" or s == "yes") else False if (c in NO_SIGNAL or s == "no") else None
            cross_nodes.append((x, y, flag))
            if flag: sig_pts.append((x, y))
    roads = []; rrank = []
    for w, (nd, t) in ways.items():
        r = RANK.get((t.get("highway") or "").replace("_link", ""))
        if not r or t.get("tunnel") == "yes": continue
        pts = B.way_coords(nodes, ways, w, cache)
        if len(pts) >= 2: roads.append(LineString(pts)); rrank.append(r)
    rtree = STRtree(roads)
    rank_near = lambda geom, d: max((rrank[i] for i in rtree.query(geom.buffer(d)) if roads[i].distance(geom) <= d), default=0)
    # 横断歩道 = 横断歩道のリンクが節点でつながったまとまり
    header, _ = load_pack(); links = header["network"]["links"]; par = {}
    def find(v):
        while par.setdefault(v, v) != v: par[v] = par[par[v]]; v = par[v]
        return v
    cl = [i for i, l in enumerate(links) if len(l) > 9 and l[9] & 1]
    for i in cl: par[find(links[i][0])] = find(links[i][1])
    comps = collections.defaultdict(list)
    for i in cl: comps[find(links[i][0])].append(i)
    # 信号機を交差点にまとめる
    cell = collections.defaultdict(list)
    for k, (x, y) in enumerate(sig_pts): cell[(int(x // CLUSTER), int(y // CLUSTER))].append(k)
    sp = list(range(len(sig_pts)))
    def sfind(v):
        while sp[v] != v: sp[v] = sp[sp[v]]; v = sp[v]
        return v
    for (cx, cy), ks in cell.items():
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for a in ks:
                    for b in cell.get((cx + dx, cy + dy), []):
                        if a < b and math.hypot(sig_pts[a][0] - sig_pts[b][0], sig_pts[a][1] - sig_pts[b][1]) <= CLUSTER: sp[sfind(a)] = sfind(b)
    walks = []; stat = collections.Counter()
    for root, ids in comps.items():
        segs = [LineString([(links[i][4] / 10, links[i][5] / 10), (links[i][6] / 10, links[i][7] / 10)]) for i in ids]
        cx = sum(s.centroid.x for s in segs) / len(segs); cy = sum(s.centroid.y for s in segs) / len(segs); cpt = Point(cx, cy)
        crossed = max((rank_near(s, 1.5) for s in segs), default=0) or rank_near(cpt, 12)
        # タグで決まるか
        tagged = [f for (x, y, f) in cross_nodes if f is not None and min(s.distance(Point(x, y)) for s in segs) < 4]
        near = [k for k, (x, y) in enumerate(sig_pts) if math.hypot(x - cx, y - cy) <= NEAR_SIGNAL]
        if tagged: signal = any(tagged); stat["タグで判定"] += 1
        else: signal = bool(near); stat["信号機との距離で判定"] += 1
        if not signal: stat["信号なし"] += 1; continue
        if not near: near = sorted(range(len(sig_pts)), key=lambda k: math.hypot(sig_pts[k][0] - cx, sig_pts[k][1] - cy))[:1]
        dx = segs[0].coords[-1][0] - segs[0].coords[0][0]; dy = segs[0].coords[-1][1] - segs[0].coords[0][1]
        walks.append({"ids": ids, "x": cx, "y": cy, "crossed": crossed or 2, "inter": sfind(near[0]), "th": math.atan2(dy, dx) % math.pi})
        stat["信号あり"] += 1
    by_inter = collections.defaultdict(list)
    for w in walks: by_inter[w["inter"]].append(w)
    out = []; cyc = collections.Counter()
    for inter, ws in by_inter.items():
        pts = [sig_pts[k] for k in range(len(sig_pts)) if sfind(k) == inter]
        major = max([w["crossed"] for w in ws] + [rank_near(Point(p), 30) for p in pts]); minor = min(w["crossed"] for w in ws)
        C = CYCLE(major); phase = zlib.crc32(f"{round(pts[0][0])},{round(pts[0][1])}".encode()) % C; cyc[C] += len(ws)
        for w in ws:
            if major == minor or len(ws) == 1 and w["crossed"] >= major:
                # 同格の交差点 (または単独の横断歩道): 向きで位相を分ける。単独で幹線を渡るものは押しボタン式に近いので青は短め
                if len(ws) == 1: G = round(0.30 * C); start = 0
                else: G = round(0.45 * C - 5); start = 0 if math.pi / 4 < w["th"] < 3 * math.pi / 4 else C // 2
            elif w["crossed"] >= major: G = round(0.35 * C - 5); start = round(0.60 * C)   # 格の高い道路を渡る: 従道路側の青の間
            else: G = round(0.55 * C - 5); start = 0                                          # 格の低い道路を渡る: 主道路側の青の間
            off = (C - start - phase) % C
            for i in w["ids"]: out.append([links[i][4], links[i][5], links[i][6], links[i][7], C, G, off])
    res = {"source": "OpenStreetMap (highway=traffic_signals, highway=crossing の crossing / crossing:signals, 道路の種別)",
           "assumed": ["周期: 幹線 (primary 以上) 130 秒、secondary 110 秒、tertiary 90 秒、それ以外 70 秒", "青時間: 格の高い道路を渡る横断歩道は周期の 35% − 5 秒、格の低い道路を渡る横断歩道は 55% − 5 秒、同格の交差点は 45% − 5 秒", "単独の信号つき横断歩道は周期の 30%", "信号の記載が無い横断歩道は待ちなし"],
           "stats": {"crosswalks": len(comps), "signalized": stat["信号あり"], "unsignalized": stat["信号なし"], "byTag": stat["タグで判定"], "byDistance": stat["信号機との距離で判定"], "signalPoints": len(sig_pts), "intersections": len(by_inter), "byCycle": {str(k): v for k, v in sorted(cyc.items())}, "links": len(out)},
           "links": out}
    json.dump(res, open(os.path.join(DATA, "signals.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(json.dumps(res["stats"], ensure_ascii=False)); gs = collections.Counter((r[4], r[5]) for r in out); print(sorted(gs.items()))

if __name__ == "__main__":
    main()
