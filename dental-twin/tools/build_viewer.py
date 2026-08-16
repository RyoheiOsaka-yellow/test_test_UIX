#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_viewer.py — 単一HTMLビューアを組み立てる（外部依存ゼロ）

  $ python3 tools/build_viewer.py [出力パス]
  既定の出力先: dist/dental_twin_v1.html
"""

import base64, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
os.makedirs(DIST, exist_ok=True)
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(DIST, "dental_twin_v1.html")


def rd(p, binary=False):
    if binary:
        with open(p, "rb") as f:
            return f.read()
    with open(p, "r", encoding="utf-8") as f:
        return f.read()


shell = rd(os.path.join(ROOT, "src", "viewer_shell.html"))
three = rd(os.path.join(ROOT, "lib", "three.min.js"))
gltf = rd(os.path.join(ROOT, "lib", "GLTFLoader.js"))
app = rd(os.path.join(ROOT, "src", "viewer_app.js"))
glb = rd(os.path.join(DIST, "dental_template.glb"), binary=True)
find = json.loads(rd(os.path.join(ROOT, "data", "findings_sample.json")))

b64 = base64.b64encode(glb).decode("ascii")

lib = "<script>\n" + three + "\n</script>\n<script>\n" + gltf + "\n</script>"
data = ("<script>\nwindow.__DENTAL_GLB_B64=\"" + b64 + "\";\n"
        "window.__FINDINGS=" + json.dumps(find, ensure_ascii=False, separators=(",", ":"))
        + ";\n</script>")
appjs = "<script>\n" + app + "\n</script>"

for tag, content in (("<!--LIB-->", lib), ("<!--DATA-->", data), ("<!--APP-->", appjs)):
    assert shell.count(tag) == 1, "アンカー重複/欠落: " + tag
    shell = shell.replace(tag, content)

with open(OUT, "w", encoding="utf-8") as f:
    f.write(shell)

print("[OK] %s  %.2f MB" % (os.path.relpath(OUT, ROOT), os.path.getsize(OUT) / 1024 / 1024))
