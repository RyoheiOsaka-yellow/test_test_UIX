#!/usr/bin/env python3
"""docs/OPEN_ITEMS.md → docs/spec/open_items.html（PDF 化は node dev/render-docs.mjs open_items.html）。
未決事項の一覧は Markdown を唯一の元とし、配布用の PDF はここから作る。対応する書式: 見出し・段落・箇条書き・番号つき・表・コード・太字・`コード`"""
import re, html, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
src = (ROOT / 'docs/OPEN_ITEMS.md').read_text(encoding='utf-8').split('\n')

def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    return re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', t)

out = []; i = 0; title = 'ANGLEX 未決事項と確認先'
while i < len(src):
    ln = src[i]
    if ln.startswith('```'):
        j = i + 1; buf = []
        while j < len(src) and not src[j].startswith('```'): buf.append(html.escape(src[j], quote=False)); j += 1
        out.append('<pre>' + '\n'.join(buf) + '</pre>'); i = j + 1; continue
    if ln.startswith('# '): title = ln[2:].strip(); i += 1; continue
    m = re.match(r'^(#{2,4}) (.*)$', ln)
    if m: n = len(m.group(1)); out.append(f'<h{n}>{inline(m.group(2))}</h{n}>'); i += 1; continue
    if ln.startswith('|'):
        rows = []
        while i < len(src) and src[i].startswith('|'): rows.append([c.strip() for c in src[i].strip().strip('|').split('|')]); i += 1
        head, body = rows[0], rows[2:]
        cls = ' class="num"' if head[0] == '#' else ''
        out.append(f'<table{cls}><tr>' + ''.join(f'<th>{inline(c)}</th>' for c in head) + '</tr>' + ''.join('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in r) + '</tr>' for r in body) + '</table>'); continue
    if re.match(r'^- ', ln):
        items = []
        while i < len(src) and re.match(r'^- ', src[i]): items.append(inline(src[i][2:])); i += 1
        out.append('<ul>' + ''.join(f'<li>{x}</li>' for x in items) + '</ul>'); continue
    if re.match(r'^\d+\. ', ln):
        items = []
        while i < len(src) and re.match(r'^\d+\. ', src[i]): items.append(inline(re.sub(r'^\d+\. ', '', src[i]))); i += 1
        out.append('<ol>' + ''.join(f'<li>{x}</li>' for x in items) + '</ol>'); continue
    if ln.strip(): out.append(f'<p>{inline(ln)}</p>')
    i += 1

m = re.match(r'^(.*?)（(.*)）$', title); name, when = (m.group(1), m.group(2)) if m else (title, '')
page = f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>{html.escape(name)}</title><link rel="stylesheet" href="doc.css"><style>
.hd{{border-bottom:3px solid var(--accent);padding-bottom:6pt;margin-bottom:8pt}}.hd .b{{font-size:9pt;letter-spacing:.2em;color:var(--ink3)}}.hd h1{{font-size:19pt;margin-top:2pt}}.hd .w{{font-size:9pt;color:var(--ink3);margin-top:2pt}}
table{{font-size:8.6pt}}th,td{{padding:3pt 5pt;vertical-align:top}}table.num td:first-child,table.num th:first-child{{white-space:nowrap;font-weight:700;color:var(--accent2);width:7mm}}
h2{{margin-top:12pt}}h3{{margin-top:8pt}}pre{{font-size:8pt;background:#f4f2ec;border:1px solid #ddd9cd;border-radius:4pt;padding:6pt 8pt;white-space:pre-wrap}}code{{font-size:.92em;background:#f1efe8;padding:0 2pt;border-radius:2pt}}
tr{{break-inside:avoid}}
</style></head><body>
<div class="hd"><div class="b">ANGLEX ／ ワールド化成　社内資料</div><h1>{html.escape(name)}</h1><div class="w">{html.escape(when)}</div></div>
{chr(10).join(out)}
</body></html>'''
(ROOT / 'docs/spec/open_items.html').write_text(page, encoding='utf-8'); print('wrote docs/spec/open_items.html', len(out), 'blocks')
