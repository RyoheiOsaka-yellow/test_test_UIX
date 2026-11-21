#!/usr/bin/env python3
"""src/ を1枚の index.html にまとめる。research/*.json（公式出典の調査結果）があれば法令・条例レジストリに埋め込む。
使い方: python3 build.py"""
import json, pathlib, re

root = pathlib.Path(__file__).resolve().parent
src = root / 'src'
reg = root / 'registry'


def load(name):
    p = reg / name
    return json.loads(p.read_text(encoding='utf-8')) if p.exists() else None


def registry_js():
    out = []
    laws = load('laws.json')
    if laws:
        out.append('LAWS=' + json.dumps(laws, ensure_ascii=False) + ';')
    ords = load('ordinances.json')
    if ords:
        out.append('ORD=' + json.dumps(ords, ensure_ascii=False) + ';')
    ind = load('industry.json')
    if ind:
        out.append('(function(){const add=' + json.dumps(ind, ensure_ascii=False) +
                   ';add.forEach(a=>{const i=INDBY[a.id];if(i)Object.keys(a).forEach(k=>{if(k!=="id"&&a[k]!=null)i[k]=a[k];});});})();')
    return '\n'.join(out)


js = '\n'.join((src / f).read_text(encoding='utf-8') for f in ['data.js', 'samples.js', 'engine.js', 'report.js', 'ai.js'])
js += '\n/* ── registry（公式出典の調査結果） ── */\n' + registry_js() + '\n'
js += (src / 'ui.js').read_text(encoding='utf-8')
html = (src / 'index.tpl.html').read_text(encoding='utf-8')
html = html.replace('/*{{CSS}}*/', (src / 'styles.css').read_text(encoding='utf-8')).replace('/*{{JS}}*/', js)
(root / 'index.html').write_text(html, encoding='utf-8')
print('built index.html', len(html), 'bytes')
