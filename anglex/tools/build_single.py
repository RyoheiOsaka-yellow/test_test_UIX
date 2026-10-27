#!/usr/bin/env python3
"""単一 HTML ビルド: index.html + css + すべての ES モジュールを 1 ファイルに束ねる（import map の data: URL 方式）。
CDN ライブラリ（Three.js / PDF.js / pdf-lib / web-ifc / SheetJS / Poly Haven）はそのまま参照。 出力: dist/ANGLEX.html"""
import os, re, base64, json, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
import sys
HTML = sys.argv[1] if len(sys.argv) > 1 else 'index.html'; CSS = sys.argv[2] if len(sys.argv) > 2 else 'css/app.css'; OUT = sys.argv[3] if len(sys.argv) > 3 else 'dist/ANGLEX.html'
html = (ROOT / HTML).read_text(encoding='utf-8')
css = (ROOT / CSS).read_text(encoding='utf-8')
mods = {}
for p in sorted((ROOT / 'js').rglob('*.js')):
    rel = p.relative_to(ROOT).as_posix()  # js/...
    src = p.read_text(encoding='utf-8')
    def fix(m):
        spec = m.group(2)
        if spec.startswith('.'):
            target = (p.parent / spec).resolve().relative_to(ROOT).as_posix()
            return m.group(1) + 'anglex:' + target + m.group(3)
        return m.group(0)
    src = re.sub(r"""((?:import|export)\s*(?:[^'";]*?\s*from\s*)?['"])([^'"]+)(['"])""", fix, src)
    src = re.sub(r"""(import\(\s*['"])(\.[^'"]+)(['"]\s*\))""", lambda m: m.group(1) + 'anglex:' + (p.parent / m.group(2)).resolve().relative_to(ROOT).as_posix() + m.group(3), src)
    mods['anglex:' + rel] = src
imports = {"three": "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js", "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/"}
for k, v in mods.items():
    imports[k] = 'data:text/javascript;charset=utf-8;base64,' + base64.b64encode(v.encode('utf-8')).decode()
html = re.sub(r'<script type="importmap">.*?</script>', lambda m: '<script type="importmap">' + json.dumps({"imports": imports}) + '</script>', html, flags=re.S)
html = html.replace('<link rel="stylesheet" href="' + CSS + '">', '<style>\n' + css + '\n</style>')
font = ROOT / 'fonts' / 'NotoSansJP-JIS.ttf'
fontTag = ('<script>window.__anglexFontB64=' + json.dumps(base64.b64encode(font.read_bytes()).decode()) + ';</script>\n') if font.exists() else ''
html = html.replace('<script type="module" src="js/main.js"></script>', fontTag + '<script type="module">import "anglex:js/main.js";</script>')
out = ROOT / OUT; out.parent.mkdir(exist_ok=True); out.write_text(html, encoding='utf-8')
print('wrote', out, round(out.stat().st_size / 1024), 'KB,', len(mods), 'modules')
