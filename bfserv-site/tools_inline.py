#!/usr/bin/env python3
"""Build self-contained single-file HTML pages (CSS/JS/images inlined as data URIs).
Output: ../dist-html/bfserv-*.html  — every page works standalone; links point to sibling files."""
import base64, mimetypes, pathlib, re, json

ROOT = pathlib.Path(__file__).parent
OUT = ROOT.parent / 'dist-html'
OUT.mkdir(exist_ok=True)

PAGES = {
    'index.html': 'bfserv-top.html',
    'bicycle/index.html': 'bfserv-bicycle.html',
    'bicycle/prices/index.html': 'bfserv-bicycle-prices.html',
    'bicycle/guide/index.html': 'bfserv-bicycle-guide.html',
    'wheelchair/index.html': 'bfserv-wheelchair.html',
    'airstation/index.html': 'bfserv-airstation.html',
    'airstation/products/index.html': 'bfserv-airstation-products.html',
    'airstation/support/index.html': 'bfserv-airstation-support.html',
    'airstation/cases/index.html': 'bfserv-airstation-cases.html',
    'plus/index.html': 'bfserv-plus.html',
    'company/index.html': 'bfserv-company.html',
    'contact/index.html': 'bfserv-contact.html',
    'privacy/index.html': 'bfserv-privacy.html',
}

def data_uri(path: pathlib.Path) -> str:
    mime = mimetypes.guess_type(str(path))[0] or 'application/octet-stream'
    if path.suffix == '.svg': mime = 'image/svg+xml'
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()

def resolve(src_page: pathlib.Path, ref: str) -> pathlib.Path:
    return (src_page.parent / ref).resolve()

for src, outname in PAGES.items():
    page = ROOT / src
    html = page.read_text(encoding='utf-8')

    # 1) stylesheet -> <style>
    def css_repl(m):
        css = (ROOT / 'assets/css/main.css').read_text(encoding='utf-8')
        return '<style>\n' + css + '\n</style>'
    html = re.sub(r'<link rel="stylesheet" href="[^"]*assets/css/main\.css">', css_repl, html)

    # 2) scripts -> inline (keep order)
    def js_repl(m):
        p = resolve(page, m.group(1))
        return '<script>\n' + p.read_text(encoding='utf-8') + '\n</script>'
    html = re.sub(r'<script src="([^"]+)" defer></script>', js_repl, html)

    # 3) favicon
    html = re.sub(r'(<link rel="icon" href=")([^"]+)(")', lambda m: m.group(1) + data_uri(resolve(page, m.group(2))) + m.group(3), html)

    # 4) <img src> -> data URI
    def img_repl(m):
        ref = m.group(2)
        if ref.startswith('data:') or ref.startswith('http'): return m.group(0)
        return m.group(1) + data_uri(resolve(page, ref)) + m.group(3)
    html = re.sub(r'(<img[^>]*\ssrc=")([^"]+)(")', img_repl, html)

    # 5) ring carousel logos: provide an asset map and rewrite data-src to ''
    m = re.search(r'data-src="([^"]+)" data-items="([^"]+)"', html)
    if m:
        base = m.group(1); items = m.group(2).split(',')
        amap = {f: data_uri(resolve(page, base + f)) for f in items}
        html = html.replace(f'data-src="{base}"', 'data-src=""')
        html = html.replace('<script>\n' + (ROOT / 'assets/js/ring.js').read_text(encoding='utf-8'),
                            '<script>window.BF_ASSET_MAP=' + json.dumps(amap) + ';</script>\n<script>\n' + (ROOT / 'assets/js/ring.js').read_text(encoding='utf-8').replace("img.src = src + file;", "img.src = (window.BF_ASSET_MAP && window.BF_ASSET_MAP[file]) || (src + file);"))

    # 6) internal links -> sibling standalone files
    def link_repl(m):
        ref = m.group(2)
        if ref.startswith(('#', 'tel:', 'mailto:', 'http', 'data:')): return m.group(0)
        target, _, frag = ref.partition('#')
        try:
            rel = resolve(page, target).relative_to(ROOT).as_posix()
        except ValueError:
            return m.group(0)
        if rel in PAGES:
            return m.group(1) + PAGES[rel] + ('#' + frag if frag else '') + m.group(3)
        return m.group(0)
    html = re.sub(r'(<a[^>]*\shref=")([^"]+)(")', link_repl, html)

    (OUT / outname).write_text(html, encoding='utf-8')
    print(f'{outname}: {len(html)//1024} KB')
