#!/usr/bin/env python3
"""
架空の超高層商業複合ビル「みなとみらい セントラルタワー（架空）」をデータパックに追加する。
  - 敷地: 既存の建物・道路・水面・緑地に重ならない最大の空地 (既定: 新高島北側の空き街区)
  - 形状: 面取り正方形の低層部 (商業 6 層) + セットバック付きタワー (オフィス/ホテル) + 展望階 + 冠部。高さ 331 m (エリア最高)
  - フロアガイド: MARK IS の階ごとの用途構成比を参考に、架空テナント名を生成 (source=fictional)
  - 歩行者ネットワーク: 正面エントランスを最寄りの地上ノードへ接続
データパック (data/minatomirai.pack) と data/floorguide.csv を直接更新する。build_data.py の後に実行する (冪等)。
"""
import csv, gzip, json, math, os, random, struct

HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "..", "data")
PACK = os.path.join(DATA, "minatomirai.pack"); CSV = os.path.join(DATA, "floorguide.csv")
NAME = "みなとみらい セントラルタワー（架空）"
SITE = (-407.6, 373.2)          # 敷地中心 (東, 北) m: 新高島駅南西の空き街区 (約 140 m × 125 m)
FLOOR_H = 3.6                    # main.js の階分解と同じ階高
FLOORS_ABOVE = 85; CROWN = 25.0  # 85F × 3.6 = 306 m + 冠部 25 m = 331 m

def load_pack():
    raw = gzip.decompress(open(PACK, "rb").read()); n = struct.unpack("<I", raw[:4])[0]
    header = json.loads(raw[4:4 + n].decode("utf-8")); base = 4 + n; blobs = {}
    for name, b in header["blobs"].items():
        size = 2 if b["fmt"] == "h" else 4
        blobs[name] = list(struct.unpack("<%d%s" % (b["length"], "h" if b["fmt"] == "h" else "I"), raw[base + b["offset"]: base + b["offset"] + b["length"] * size]))
    return header, blobs

def write_pack(header, blobs):
    body = b""; header["blobs"] = {}
    for name, (arr, fmt) in blobs.items():
        data = struct.pack("<%d%s" % (len(arr), fmt), *arr)
        header["blobs"][name] = {"offset": len(body), "length": len(arr), "fmt": fmt}; body += data
    hj = json.dumps(header, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    open(PACK, "wb").write(gzip.compress(struct.pack("<I", len(hj)) + hj + body, 9))

# ---- 形状 ----------------------------------------------------------------
def chamfered_square(cx, cy, half, cut, ang=0.0, half_b=None):
    """面取り付き長方形 (half: 主軸方向の半幅, half_b: 直交方向の半幅)。反時計回り。"""
    hb = half if half_b is None else half_b
    pts = []
    for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
        a = [(sx * half, sy * (hb - cut)), (sx * (half - cut), sy * hb)]
        if sx * sy < 0: a.reverse()
        pts += a
    # 反時計回りに整える
    pts = sorted(pts, key=lambda p: math.atan2(p[1], p[0]))
    c, s = math.cos(ang), math.sin(ang)
    return [(cx + x * c - y * s, cy + x * s + y * c) for x, y in pts]

class MeshBuilder:
    def __init__(self): self.v = []; self.t = []
    def add_tri(self, a, b, c):
        i = len(self.v); self.v += [a, b, c]; self.t.append((i, i + 1, i + 2))
    def add_quad(self, a, b, c, d):  # a,b,c,d 反時計回り (外から見て)
        self.add_tri(a, b, c); self.add_tri(a, c, d)
    def prism(self, ring_lo, z0, ring_hi, z1):
        n = len(ring_lo)
        for i in range(n):
            a = ring_lo[i]; b = ring_lo[(i + 1) % n]; c = ring_hi[(i + 1) % n]; d = ring_hi[i]
            self.add_quad((a[0], a[1], z0), (b[0], b[1], z0), (c[0], c[1], z1), (d[0], d[1], z1))
    def cap(self, ring, z, up=True):
        cx = sum(p[0] for p in ring) / len(ring); cy = sum(p[1] for p in ring) / len(ring); n = len(ring)
        for i in range(n):
            a = ring[i]; b = ring[(i + 1) % n]
            if up: self.add_tri((cx, cy, z), (a[0], a[1], z), (b[0], b[1], z))
            else: self.add_tri((cx, cy, z), (b[0], b[1], z), (a[0], a[1], z))

def build_geometry(cx, cy, ground):
    mb = MeshBuilder(); ang = math.radians(-33)  # 周辺街区の向き (みなとみらい大通りに平行)
    z = ground
    # 低層部 (B2-6F のうち地上 6 層): 110 m 角, 面取り 14 m
    pod = chamfered_square(cx, cy, 58, 12, ang, half_b=47); z_pod = z + 6 * FLOOR_H
    mb.cap(pod, z, up=False); mb.prism(pod, z, pod, z_pod); mb.cap(pod, z_pod)
    # 低層部の庇 (2F レベルに張り出す薄い板)
    canopy = chamfered_square(cx, cy, 63, 14, ang, half_b=52); zc = z + 2 * FLOOR_H
    mb.cap(canopy, zc, up=False); mb.prism(canopy, zc, canopy, zc + 0.6); mb.cap(canopy, zc + 0.6)
    # タワー: 62 m 角 → 52 m 角 (51F〜) → 44 m 角 (75F〜)
    segs = [(29, 8, 6, 50), (25, 7, 50, 74), (21, 6, 74, FLOORS_ABOVE)]
    for half, cut, f0, f1 in segs:
        ring = chamfered_square(cx, cy, half, cut, ang); z0 = z + f0 * FLOOR_H; z1 = z + f1 * FLOOR_H
        mb.cap(ring, z0, up=False); mb.prism(ring, z0, ring, z1); mb.cap(ring, z1)
        # 縦方向のフィン (ファサードの分節): 各辺の中央に浅い出っ張り
        for i in range(len(ring)):
            a = ring[i]; b = ring[(i + 1) % len(ring)]; L = math.hypot(b[0] - a[0], b[1] - a[1])
            if L < 20: continue
            nx, ny = (b[1] - a[1]) / L, -(b[0] - a[0]) / L   # 外向き法線
            for t in (0.33, 0.67):
                px, py = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
                ux, uy = (b[0] - a[0]) / L * 0.6, (b[1] - a[1]) / L * 0.6
                fin = [(px - ux, py - uy), (px + ux, py + uy), (px + ux + nx * 0.8, py + uy + ny * 0.8), (px - ux + nx * 0.8, py - uy + ny * 0.8)]
                mb.prism(fin, z0, fin, z1)
    # 冠部: 44 m 角から 18 m 角へ絞る四角錐台 + 尖塔
    top = z + FLOORS_ABOVE * FLOOR_H; r0 = chamfered_square(cx, cy, 21, 6, ang); r1 = chamfered_square(cx, cy, 9, 2.5, ang)
    mb.prism(r0, top, r1, top + CROWN * 0.7); mb.cap(r1, top + CROWN * 0.7)
    spire = chamfered_square(cx, cy, 1.2, 0.3, ang); mb.prism(spire, top + CROWN * 0.7, spire, top + CROWN); mb.cap(spire, top + CROWN)
    return mb

# ---- フロアガイド ------------------------------------------------------------
WORDS1 = ["ベイサイド", "ハーバー", "ミナト", "シーサイド", "ブルー", "ポート", "マリン", "グラン", "ノース", "セントラル", "アトリエ", "スカイ", "ルミナ", "ソラ", "テラス"]
WORDS2 = {"飲食": ["キッチン", "カフェ", "食堂", "ビストロ", "ダイニング", "ベーカリー", "ラーメン", "鮨", "グリル", "珈琲"],
          "物販": ["ストア", "ブティック", "雑貨店", "セレクト", "ブックス", "スポーツ", "コスメ", "トイズ", "マーケット", "ギャラリー"],
          "サービス": ["サロン", "クリニック", "スタジオ", "ラボ", "ジム", "教室", "トラベル", "フォト"],
          "医療": ["クリニック", "歯科", "薬局"], "公共": ["シネマ", "ホール", "ミュージアム", "ラウンジ"],
          "宿泊": ["ホテル"], "オフィス": ["株式会社", "合同会社", "法律事務所", "デザイン事務所", "ホールディングス", "テクノロジーズ"]}

def floor_mix(rows, floor):
    mix = {}
    for r in rows:
        if r["building"].startswith("MARK IS") and r["floor"] == floor: mix[r["category"]] = mix.get(r["category"], 0) + 1
    return mix

def gen_tenants(official_rows, rng):
    plan = [  # (階, 区画数, 参考階 or 用途)
        ("B2", 4, {"サービス": 3, "飲食": 1}), ("B1", 14, "B1"), ("1F", 16, "1F"), ("2F", 14, "2F"), ("3F", 14, "3F"), ("4F", 14, "4F"),
        ("5F", 10, {"飲食": 8, "公共": 2}), ("6F", 4, {"公共": 2, "飲食": 2}),
    ]
    rows = []
    for fl, n, ref in plan:
        mix = floor_mix(official_rows, ref) if isinstance(ref, str) else ref
        if not mix: mix = {"物販": 1}
        cats = sorted(mix.items(), key=lambda kv: -kv[1]); total = sum(mix.values())
        seq = []
        for c, k in cats: seq += [c] * max(1, round(n * k / total))
        seq = (seq * 3)[:n]; rng.shuffle(seq)
        for i, c in enumerate(seq, 1):
            name = rng.choice(WORDS1) + " " + rng.choice(WORDS2.get(c, WORDS2["物販"]))
            rows.append({"building": NAME, "floor": fl, "zone": str(i), "name": name, "category": c, "share": str(rng.choice([1, 1, 1.5, 2])), "source": "fictional", "url": "", "hours": "10:00〜21:00（架空）", "tel": "", "website": "", "genre": "架空テナント"})
    for f in range(7, 63):
        rows.append({"building": NAME, "floor": f"{f}F", "zone": "", "name": rng.choice(WORDS1) + " " + rng.choice(WORDS2["オフィス"]), "category": "オフィス", "share": "1", "source": "fictional", "url": "", "hours": "", "tel": "", "website": "", "genre": "架空テナント"})
    for f in range(63, 83):
        rows.append({"building": NAME, "floor": f"{f}F", "zone": "", "name": "ミナト スカイホテル（架空） 客室階", "category": "宿泊", "share": "1", "source": "fictional", "url": "", "hours": "", "tel": "", "website": "", "genre": "架空テナント"})
    rows += [{"building": NAME, "floor": "83F", "zone": "1", "name": "スカイダイニング ミナト（架空）", "category": "飲食", "share": "1", "source": "fictional", "url": "", "hours": "11:00〜23:00（架空）", "tel": "", "website": "", "genre": "架空テナント"},
             {"building": NAME, "floor": "84F", "zone": "1", "name": "展望ロビー セントラルビュー（架空）", "category": "公共", "share": "1", "source": "fictional", "url": "", "hours": "10:00〜22:00（架空）", "tel": "", "website": "", "genre": "架空テナント"},
             {"building": NAME, "floor": "85F", "zone": "1", "name": "スカイデッキ（架空）", "category": "公共", "share": "1", "source": "fictional", "url": "", "hours": "10:00〜21:00（架空）", "tel": "", "website": "", "genre": "架空テナント"}]
    return rows

def main():
    header, blobs = load_pack()
    metas = header["buildings"]["meta"]
    if any(m.get("n") == NAME for m in metas):
        print("already added; rebuilding from pack is not supported. Run build_data.py first."); return
    # 地盤高: 地形グリッドから
    t = header["terrain"]; grid = blobs["terrain"]
    i = int((SITE[0] - t["x0"]) / t["step"]); j = int((SITE[1] - t["y0"]) / t["step"]); ground = max(0.0, grid[j * t["nx"] + i] / 10)
    mb = build_geometry(SITE[0], SITE[1], ground)
    # 既存配列へ追加
    pos = blobs["bldg_pos"]; idx = blobs["bldg_idx"]; starts = header["buildings"]["starts"]
    base_v = len(pos) // 3; vmap = {}; newpos = []
    def vid(p):
        q = (int(round(p[0] * 10)), int(round(p[1] * 10)), int(round(p[2] * 10)))
        if q not in vmap: vmap[q] = base_v + len(newpos) // 3; newpos.extend(q)
        return vmap[q]
    tri0 = len(idx) // 3
    for a, b, c in mb.t: idx += [vid(mb.v[a]), vid(mb.v[b]), vid(mb.v[c])]
    pos += newpos; starts.append(len(idx) // 3)
    xs = [v[0] for v in mb.v]; ys = [v[1] for v in mb.v]; zs = [v[2] for v in mb.v]
    metas.append({"n": NAME, "parts": 1, "h": round(max(zs) - ground, 1), "fn": None, "c": [int(SITE[0] * 10), int(SITE[1] * 10)], "z": [round(min(zs), 1), round(max(zs), 1)],
                  "bb": [int(min(xs) * 10), int(min(ys) * 10), int(max(xs) * 10), int(max(ys) * 10)], "fictional": True})
    print("geometry: tris", len(mb.t), "height", round(max(zs) - ground, 1), "ground", ground)
    # ネットワーク: 南側エントランス → 最寄り地上ノード
    ang = math.radians(-33); ex = SITE[0] - math.sin(ang) * -49; ey = SITE[1] + math.cos(ang) * -49   # 南側 (直交方向 -) の正面
    nodes = header["network"]["nodes"]; links = header["network"]["links"]
    best = None; bd = 1e9
    for k, (x, y, lv) in enumerate(nodes):
        if lv != 0: continue
        d = math.hypot(x / 10 - ex, y / 10 - ey)
        if d < bd: bd = d; best = k
    e = len(nodes); nodes.append([int(ex * 10), int(ey * 10), 0])
    lobby = len(nodes); nodes.append([int(SITE[0] * 10), int(SITE[1] * 10), 0])
    links.append([e, lobby, 0, 0, int(ex * 10), int(ey * 10), int(SITE[0] * 10), int(SITE[1] * 10)])
    if best is not None and bd < 120: links.append([e, best, 0, 0, int(ex * 10), int(ey * 10), nodes[best][0], nodes[best][1]])
    header["labels"].append({"n": "セントラルタワー（架空）", "p": [SITE[0], SITE[1]], "h": 345, "kind": "station"})
    header["stations"].append({"st": NAME, "lv": 0, "cat": "gate", "n": "メインエントランス（架空）", "r": [[int((ex + dx) * 10), int((ey + dy) * 10)] for dx, dy in ((-6, -3), (6, -3), (6, 3), (-6, 3))]})
    write_pack(header, {"terrain": (blobs["terrain"], "h"), "bldg_pos": (pos, "h"), "bldg_idx": (idx, "I"), "brid_pos": (blobs["brid_pos"], "h"), "brid_idx": (blobs["brid_idx"], "I")})
    # フロアガイド
    rows = list(csv.DictReader(open(CSV, encoding="utf-8")))
    rows = [r for r in rows if r.get("source") != "fictional"]
    rng = random.Random(21)
    rows += gen_tenants(rows, rng)
    fields = ["building", "floor", "zone", "name", "category", "share", "source", "url", "hours", "tel", "website", "genre"]
    with open(CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore"); w.writeheader()
        for r in rows:
            for k in fields: r.setdefault(k, "")
            w.writerow(r)
    print("pack updated; floorguide rows", len(rows), "(fictional", sum(1 for r in rows if r["source"] == "fictional"), ")")

if __name__ == "__main__":
    main()
