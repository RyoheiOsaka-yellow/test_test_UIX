#!/usr/bin/env python3
"""
公式フロアガイド PDF から階ごとのフロアマップを切り出し、下敷き画像 (data/underlays/*.jpg) と
配置パラメータの初期値 (data/underlays.json) を作る。
  MARK IS   : https://www.mec-markis.jp/mm/common/pdf/floorguide.pdf   (2ページ目に全階)
  ランドマークプラザ: https://www.yokohama-landmark.jp/upload/pdf/landmark_guide_JPEn.pdf (1-2ページ目)
切り出し範囲は 60dpi 画像上の座標で指定 (サイト改版時は要調整)。
"""
import json, os, subprocess, urllib.request
from PIL import Image

HERE = os.path.dirname(__file__)
OUTDIR = os.path.join(HERE, "..", "data", "underlays")
WORK = os.environ.get("MM_WORK", "/tmp/mm")
DPI = 150; REF = 60
PDFS = {
    "markis": "https://www.mec-markis.jp/mm/common/pdf/floorguide.pdf?202508",
    "lmp": "https://www.yokohama-landmark.jp/upload/pdf/landmark_guide_JPEn.pdf",
    "tokyu": "https://www.minatomirai-square.com/uploads/pdfs/minatomirai/000002/000002/a086b021.pdf",  # クイーンズスクエア横浜 Floor Map (全館)
}
# (pdf, page, x0, y0, x1, y1) @60dpi, building, floor, 初期回転(度: 建物主軸基準), 初期スケール
CROPS = [
    ("markis", 2, 60, 45, 212, 150, "MARK IS minatomirai", "B4", 0, 1.0),
    ("markis", 2, 60, 168, 212, 258, "MARK IS minatomirai", "B2", 0, 1.0),
    ("markis", 2, 60, 272, 212, 396, "MARK IS minatomirai", "B1", 0, 1.0),
    ("markis", 2, 68, 418, 470, 562, "MARK IS minatomirai", "1F", 0, 1.0),
    ("markis", 2, 540, 45, 840, 142, "MARK IS minatomirai", "2F", 0, 1.0),
    ("markis", 2, 540, 228, 840, 312, "MARK IS minatomirai", "3F", 0, 1.0),
    ("markis", 2, 540, 410, 835, 502, "MARK IS minatomirai", "4F", 0, 1.0),
    ("markis", 2, 540, 593, 760, 692, "MARK IS minatomirai", "5F", 0, 1.0),
    ("lmp", 1, 25, 48, 300, 262, "ランドマークプラザ", "5F", 0, 1.0),
    ("lmp", 1, 25, 275, 300, 482, "ランドマークプラザ", "4F", 0, 1.0),
    ("lmp", 1, 25, 498, 300, 692, "ランドマークプラザ", "3F", 0, 1.0),
    ("lmp", 1, 25, 705, 300, 922, "ランドマークプラザ", "2F", 0, 1.0),
    ("lmp", 2, 25, 65, 350, 302, "ランドマークプラザ", "1F", 0, 1.0),
    ("tokyu", 1, 60, 170, 190, 292, "クイーンズスクエア横浜", "B3", 0, 1.0),
    ("tokyu", 1, 300, 170, 460, 292, "クイーンズスクエア横浜", "B2", 0, 1.0),
    ("tokyu", 1, 530, 178, 720, 282, "クイーンズスクエア横浜", "B1", 0, 1.0),
    ("tokyu", 1, 105, 440, 462, 602, "クイーンズスクエア横浜", "1F", 0, 1.0),
    ("tokyu", 2, 100, 58, 462, 215, "クイーンズスクエア横浜", "2F", 0, 1.0),
    ("tokyu", 2, 85, 248, 462, 396, "クイーンズスクエア横浜", "3F", 0, 1.0),
    ("tokyu", 2, 28, 468, 352, 632, "クイーンズスクエア横浜", "4F", 0, 1.0),
]

ANCHORS = {  # 回転 (0/180°) 判定用: 画像内の相対位置 (u,v) にある地物名
    "MARK IS minatomirai": {"name": "横浜美術館", "u": 0.5, "v": 1.8},
    "ランドマークプラザ": {"name": "横浜ランドマークタワー", "u": 0.38, "v": 0.82},
}

def drawing_box(im):
    """白背景の中の図面本体の範囲 (画像に対する比率) を推定する。"""
    g = im.convert("L"); w, h = g.size; px = g.load()
    cols = [0] * w; rows = [0] * h
    for y in range(h):
        for x in range(w):
            if px[x, y] < 215: cols[x] += 1; rows[y] += 1
    def span(arr, n, frac):
        th = max(2, n * frac); idx = [i for i, v in enumerate(arr) if v >= th]
        return (idx[0], idx[-1] + 1) if idx else (0, len(arr))
    x0, x1 = span(cols, h, 0.04); y0, y1 = span(rows, w, 0.04)
    return [round(x0 / w, 4), round(y0 / h, 4), round(x1 / w, 4), round(y1 / h, 4)]

def main():
    os.makedirs(OUTDIR, exist_ok=True); os.makedirs(os.path.join(WORK, "pdf"), exist_ok=True)
    pages = {}
    for key, url in PDFS.items():
        pdf = os.path.join(WORK, "pdf", key + ".pdf")
        if not os.path.exists(pdf):
            open(pdf, "wb").write(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=120).read())
        prefix = os.path.join(WORK, "pdf", key + f"_{DPI}")
        subprocess.run(["pdftoppm", "-r", str(DPI), "-png", pdf, prefix], check=True, stderr=subprocess.DEVNULL)
        for p in (1, 2, 3, 4):
            fn = f"{prefix}-{p}.png"
            if os.path.exists(fn): pages[(key, p)] = Image.open(fn).convert("RGB")
    manifest = []
    old = {}
    mf = os.path.join(OUTDIR, "..", "underlays.json")
    if os.path.exists(mf):
        for u in json.load(open(mf)): old[(u["building"], u["floor"])] = u
    k = DPI / REF
    for pdf, page, x0, y0, x1, y1, bld, fl, rot, scale in CROPS:
        im = pages[(pdf, page)].crop((int(x0 * k), int(y0 * k), int(x1 * k), int(y1 * k)))
        if im.width > 1100: im = im.resize((1100, int(im.height * 1100 / im.width)), Image.LANCZOS)
        name = f"{pdf}_{fl}.jpg"; im.save(os.path.join(OUTDIR, name), "JPEG", quality=78, optimize=True)
        prev = old.get((bld, fl), {})
        manifest.append({"building": bld, "floor": fl, "file": name, "w": im.width, "h": im.height, "box": drawing_box(im), "anchor": ANCHORS.get(bld),
                         "rot": prev.get("rot", rot), "scale": prev.get("scale", scale), "dx": prev.get("dx", 0), "dy": prev.get("dy", 0), "opacity": prev.get("opacity", 0.8), "fit": prev.get("fit", False),
                         "source": "公式フロアガイド PDF"})
        print(name, im.size)
    json.dump(manifest, open(mf, "w"), ensure_ascii=False, indent=1)
    print("wrote", mf, len(manifest))

if __name__ == "__main__":
    main()
