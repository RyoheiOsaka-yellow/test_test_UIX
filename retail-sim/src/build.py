#!/usr/bin/env python3
"""retail-sim ビルドスクリプト: src/ の部品を単一HTML (retail-sim/index.html) に結合する。"""
import pathlib

base = pathlib.Path(__file__).resolve().parent
head = (base / 'head.html').read_text()
three = (base / 'vendor' / 'three.min.js').read_text()
core = (base / 'app_core.js').read_text()
dash = (base / 'app_dash.js').read_text()
shelf = (base / 'app_shelf.js').read_text()

out = (
    head
    + '\n<script>\n' + three + '\n</script>\n'
    + '<script>\n' + core + '\n' + dash + '\n' + shelf + '\n</script>\n'
    + '</body>\n</html>\n'
)
dest = base.parent / 'index.html'
dest.write_text(out)
print('written', dest, len(out), 'bytes')
