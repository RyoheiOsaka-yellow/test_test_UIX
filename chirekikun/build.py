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


def registry_js(with_zones=False):
    out = []
    laws = load('laws.json')
    if laws:
        out.append('LAWS=' + json.dumps(laws, ensure_ascii=False) + ';')
    ords = load('ordinances.json')
    if ords:
        out.append('ORD=' + json.dumps(ords, ensure_ascii=False) + ';')
    zones = load('zones.json') if with_zones else None
    if zones:
        out.append('ZONES=' + json.dumps(zones, ensure_ascii=False, separators=(',', ':')) + ';')
    ind = load('industry.json')
    if ind:
        out.append('(function(){const add=' + json.dumps(ind, ensure_ascii=False) +
                   ';add.forEach(a=>{const i=INDBY[a.id];if(i)Object.keys(a).forEach(k=>{if(k!=="id"&&a[k]!=null)i[k]=a[k];});});})();')
    return '\n'.join(out)


def build(name, with_zones):
    js = '\n'.join((src / f).read_text(encoding='utf-8') for f in ['data.js', 'samples.js', 'engine.js', 'report.js', 'ai.js', 'demo.js'])
    js += '\n/* ── registry（公式出典の調査結果） ── */\n' + registry_js(with_zones) + '\n'
    js += (src / 'ui.js').read_text(encoding='utf-8')
    html = (src / 'index.tpl.html').read_text(encoding='utf-8')
    html = html.replace('/*{{CSS}}*/', (src / 'styles.css').read_text(encoding='utf-8')).replace('/*{{JS}}*/', js)
    (root / name).write_text(html, encoding='utf-8')
    print('built', name, len(html), 'bytes')


# index.html には、指定区域の公表台帳の写し（registry/zones.json）を入れない（自治体サイトの利用条件のため、リポジトリに含めない）。
# 手元に zones.json があるときは、台帳を埋め込んだ index.local.html を別に作る（.gitignore 済み）。
build('index.html', False)
if (reg / 'zones.json').exists():
    build('index.local.html', True)


def patch_screening():
    """以前の試作（screening.html）の条例表も、公式出典で確認したレジストリに差し替える。"""
    f = root / 'screening.html'
    ords = load('ordinances.json')
    if not f.exists() or not ords:
        return
    out = []
    for o in ords:
        rules = [{'art': r['art'], 'trigger': 'ledger' if r['trigger'] == 'zone' else r['trigger'], 'th': r.get('threshold'),
                  'title': (f"{int(r['threshold']):,}m²以上の" if r['trigger'] == 'area' and r.get('threshold') else '') + (r.get('heading') or ''),
                  'duty': r.get('duty') or r.get('summary') or '', 'conf': 'high' if r.get('verified') and r.get('url') else 'low'}
                 for r in o['rules'] if r.get('judge')]
        out.append({'pref': o['pref'], **({'city': o['city']} if o.get('city') else {}), 'name': o['name'], 'desk': o.get('desk') or '', 'rules': rules})
    t = f.read_text(encoding='utf-8')
    a, b = t.index('let ORD=['), t.index('const CONF_LABEL=')
    t = t[:a] + 'let ORD=' + json.dumps(out, ensure_ascii=False) + ';\n' + t[b:]
    t = t.replace("function ordFor(pref,city){return ORD.filter(o=>o.pref===pref&&(!o.city||(city&&city.startsWith(o.city))));}",
                  "function ordFor(pref,city){return ORD.filter(o=>o.pref===pref&&(!o.city||(city&&city.indexOf(o.city)>=0)));}")
    f.write_text(t, encoding='utf-8')
    print('patched screening.html ORD', len(out))


patch_screening()
