#!/usr/bin/env python3
"""単一 HTML ビルド: index.html + css + すべての ES モジュールを 1 ファイルに束ねる（import map の data: URL 方式）。
CDN ライブラリ（Three.js / PDF.js / pdf-lib / web-ifc / SheetJS / Poly Haven）はそのまま参照。 出力: dist/ANGLEX.html"""
import os, re, base64, json, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
import sys
OFFLINE = '--offline' in sys.argv; args = [a for a in sys.argv[1:] if not a.startswith('--')]
HTML = args[0] if len(args) > 0 else 'index.html'; CSS = args[1] if len(args) > 1 else 'css/app.css'; OUT = args[2] if len(args) > 2 else ('dist/ANGLEX_offline.html' if OFFLINE else 'dist/ANGLEX.html')
VEN = ROOT / 'vendor'
def data_url(path, mime):
    return 'data:' + mime + ';base64,' + base64.b64encode(pathlib.Path(path).read_bytes()).decode()
# オフライン版: CDN の URL 文字列を同梱 data: URL に置き換える（tools/vendor_three.py と vendor/ のファイルが必要）
VENDOR_URLS = {
    'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.esm.min.js': ('cdn.jsdelivr.net_npm_pdf-lib_1.17.1_dist_pdf-lib.esm.min.js', 'text/javascript'),
    'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js': ('cdn.jsdelivr.net_npm__pdf-lib_fontkit_1.1.1_dist_fontkit.umd.min.js', 'text/javascript'),
    'https://cdn.jsdelivr.net/npm/harfbuzzjs@0.4.6/hb-subset.wasm': ('cdn.jsdelivr.net_npm_harfbuzzjs_0.4.6_hb-subset.wasm', 'application/wasm'),
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js': ('cdn.jsdelivr.net_npm_xlsx_0.18.5_dist_xlsx.full.min.js', 'text/javascript'),
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.min.mjs': ('cdn.jsdelivr.net_npm_pdfjs-dist_4.6.82_build_pdf.min.mjs', 'text/javascript'),
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.worker.min.mjs': ('cdn.jsdelivr.net_npm_pdfjs-dist_4.6.82_build_pdf.worker.min.mjs', 'text/javascript'),
    'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js': ('tesseract/tesseract.min.js', 'text/javascript'),
    'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js': ('tesseract/worker.min.js', 'text/javascript'),
    'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js': ('tesseract/tesseract-core-simd-lstm.wasm.js', 'text/javascript'),
    'https://tessdata.projectnaptha.com/4.0.0_fast/eng.traineddata.gz': ('tesseract/eng.traineddata.gz', 'application/gzip'),
    'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr': ('dl.polyhaven.org_file_ph-assets_HDRIs_hdr_1k_studio_small_09_1k.hdr', 'application/octet-stream'),
}
vendor_data = {}
if OFFLINE:
    for url, (fn, mime) in VENDOR_URLS.items():
        f = VEN / fn
        if not f.exists(): raise SystemExit('vendor file missing: ' + fn + ' (run the curl list in README / tools/vendor_three.py)')
        vendor_data[url] = data_url(f, mime)
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
    if OFFLINE:
        for url, d in vendor_data.items(): src = src.replace(url, d)
        src = src.replace("globalThis.__anglexOffline", "true")
    mods['anglex:' + rel] = src
imports = {"three": "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js", "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/"}
if OFFLINE:
    # three 本体と addons（依存ごと）を同梱。addons 内の相対 import は anglex:vendor/... キーへ
    three_main = VEN / 'cdn.jsdelivr.net_npm_three_0.180.0_build_three.module.js'
    core = VEN / 'three' / 'build' / 'three.core.js'
    core_src = core.read_text(encoding='utf-8'); core_url = 'data:text/javascript;charset=utf-8;base64,' + base64.b64encode(core_src.encode('utf-8')).decode()
    main_src = three_main.read_text(encoding='utf-8').replace("'./three.core.js'", "'anglex:vendor/three/build/three.core.js'").replace('"./three.core.js"', '"anglex:vendor/three/build/three.core.js"')
    imports = {"three": 'data:text/javascript;charset=utf-8;base64,' + base64.b64encode(main_src.encode('utf-8')).decode(), "anglex:vendor/three/build/three.core.js": core_url}
    tv = VEN / 'three'
    addon_mods = {}
    for p in sorted(tv.rglob('*.js')):
        rel = p.relative_to(tv).as_posix()  # examples/jsm/...
        if rel.startswith('build/'): continue
        src = p.read_text(encoding='utf-8')
        def fixv(m, p=p):
            spec = m.group(2)
            if spec.startswith('.'):
                target = (p.parent / spec).resolve().relative_to(tv).as_posix()
                return m.group(1) + 'anglex:vendor/three/' + target + m.group(3)
            return m.group(0)
        src = re.sub(r"""((?:import|export)\s*(?:[^'";]*?\s*from\s*)?['"])([^'"]+)(['"])""", fixv, src)
        addon_mods['anglex:vendor/three/' + rel] = src
    for k, v in addon_mods.items():
        d = 'data:text/javascript;charset=utf-8;base64,' + base64.b64encode(v.encode('utf-8')).decode()
        imports[k] = d
        if k.startswith('anglex:vendor/three/examples/jsm/'): imports['three/addons/' + k[len('anglex:vendor/three/examples/jsm/'):]] = d
    mods = {k: v for k, v in mods.items()}
for k, v in mods.items():
    imports[k] = 'data:text/javascript;charset=utf-8;base64,' + base64.b64encode(v.encode('utf-8')).decode()
html = re.sub(r'<script type="importmap">.*?</script>', lambda m: '<script type="importmap">' + json.dumps({"imports": imports}) + '</script>', html, flags=re.S)
html = html.replace('<link rel="stylesheet" href="' + CSS + '">', '<style>\n' + css + '\n</style>')
if OFFLINE:
    html = re.sub(r'<link[^>]*fonts\.g(oogleapis|static)\.com[^>]*>\s*', '', html)  # Web フォントは参照しない（システムフォントで表示）
    html = html.replace('</head>', '<script>globalThis.__anglexOffline=true;</script>\n</head>', 1)
font = ROOT / 'fonts' / 'NotoSansJP-JIS.ttf'
fontTag = ('<script>window.__anglexFontB64=' + json.dumps(base64.b64encode(font.read_bytes()).decode()) + ';</script>\n') if font.exists() else ''
html = html.replace('<script type="module" src="js/main.js"></script>', fontTag + '<script type="module">import "anglex:js/main.js";</script>')
out = ROOT / OUT; out.parent.mkdir(exist_ok=True); out.write_text(html, encoding='utf-8')
print('wrote', out, round(out.stat().st_size / 1024), 'KB,', len(mods), 'modules', '(offline: vendored libs embedded)' if OFFLINE else '')
