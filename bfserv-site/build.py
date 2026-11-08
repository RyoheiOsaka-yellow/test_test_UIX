#!/usr/bin/env python3
"""Tiny static builder: _src/pages/**/*.html (body + meta comment) + _src/partials -> site root.
Run:  python3 build.py   (no dependencies)"""
import os, re, pathlib
ROOT = pathlib.Path(__file__).parent
SRC = ROOT / '_src' / 'pages'
PART = ROOT / '_src' / 'partials'
partials = {p.stem: p.read_text(encoding='utf-8') for p in PART.glob('*.html')}
META_RE = re.compile(r'<!--\s*meta\s*(.*?)-->', re.S)

def render(tpl, ctx):
    out = tpl
    for k, v in partials.items():
        out = out.replace('{{partial:' + k + '}}', v)
    for k, v in ctx.items():
        out = out.replace('{{' + k + '}}', v)
    return out

count = 0
for src in sorted(SRC.rglob('*.html')):
    rel = src.relative_to(SRC)
    html = src.read_text(encoding='utf-8')
    m = META_RE.search(html)
    meta = {}
    if m:
        for line in m.group(1).strip().splitlines():
            if ':' in line:
                k, v = line.split(':', 1); meta[k.strip()] = v.strip()
        html = html[:m.start()] + html[m.end():]
    depth = len(rel.parts) - 1
    root = '../' * depth if depth else './'
    ctx = {
        'root': root,
        'title': meta.get('title', 'BFSERV'),
        'desc': meta.get('desc', ''),
        'accent': meta.get('accent', 'green'),
        'nav': meta.get('nav', ''),
        'body_class': meta.get('body_class', ''),
        'scripts': meta.get('scripts', '').replace('{{root}}', root),
        'canonical': 'https://bfserv.co.jp/' + rel.as_posix().replace('index.html', ''),
    }
    page = render(partials['head'], ctx) + render(partials['header'], ctx) + render(html, ctx) + render(partials['footer'], ctx)
    # mark current nav
    page = page.replace(f'data-nav="{ctx["nav"]}"', f'data-nav="{ctx["nav"]}" aria-current="page"') if ctx['nav'] else page
    out = ROOT / rel
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding='utf-8')
    count += 1
print(f'built {count} pages')
