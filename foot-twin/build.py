#!/usr/bin/env python3
"""build.py — src/ を単一 HTML へ組み立てる（SPEC §5-1, §12）

外部ファイル参照・CDN 参照をゼロにする。file:// で完全に動くこと。
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
OUT = os.path.join(ROOT, "dist", "foot_twin_v0.html")

# 依存順に積む。geom.js の CONST を他が参照するので順序を変えないこと。
MODULES = [
    "three.r128.min.js",
    "geom.js",
    "metrics.js",
    "cohort.js",
    "insole.js",
    "viewer.js",
    "ui.js",
]

MARKER = "<!--__SCRIPTS__-->"


def read(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as f:
        return f.read()


def main():
    shell = read("shell.html")
    assert shell.count(MARKER) == 1, "スクリプト差し込み位置マーカーが1つでない"

    parts = []
    own = []          # 自前モジュールのみ。three.js 本体は検査対象外。
    for m in MODULES:
        body = read(m)
        if m != "three.r128.min.js":
            own.append(body)
        parts.append("<!-- %s -->\n<script>\n%s\n</script>" % (m, body))
    html = shell.replace(MARKER, "\n".join(parts))

    # 規約1の機械チェック：文書全体に外部参照が残っていないこと
    for pat, why in [
        (r'<script[^>]+\bsrc\s*=', "外部 script src が残っている"),
        (r'<link[^>]+stylesheet', "外部 stylesheet 参照が残っている"),
        (r'<img[^>]+\bsrc\s*=\s*["\']https?:', "外部画像参照が残っている"),
    ]:
        hit = re.search(pat, html, re.M | re.I)
        assert hit is None, "%s: %r" % (why, hit.group(0) if hit else "")

    # 規約2・3の機械チェック：自前コードに file:// で落ちる書き方がないこと。
    # three.js 本体の FileLoader には fetch があるが、こちらからは呼ばない。
    ownsrc = "\n".join(own)
    for pat, why in [
        (r'\bfetch\s*\(', "fetch() は file:// で CORS に落ちるため使用禁止"),
        (r'^\s*import\s+', "ESM import は r128 UMD と混在させない"),
        (r'\blocalStorage\b|\bsessionStorage\b', "storage は規約4で禁止"),
    ]:
        hit = re.search(pat, ownsrc, re.M)
        assert hit is None, "%s: %r" % (why, hit.group(0) if hit else "")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(html)

    size = os.path.getsize(OUT)
    limit = 3 * 1024 * 1024
    print("built %s  %.2f MB" % (OUT, size / 1048576.0))
    if size > limit:
        print("FAIL: 3MB 超過（SPEC §11 受け入れ基準7）", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
