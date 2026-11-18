#!/usr/bin/env python3
"""マニュアル（印刷用 HTML → PDF）と、操作説明（1 ファイルの HTML）を作る。v1 / v2 / v3 それぞれ。

入力: tools/manual_content.py（本文）、撮影フォルダの <ver>_<name>.png と <ver>_marks.json（node dev/manual-shots.mjs v1 <撮影フォルダ> などで撮る）
      撮影フォルダを省くと、docs/spec/img/manual/ にある前回の写真（jpg）と印の位置を使う
出力:
  docs/spec/manual_v1.html …（印刷用。写真は docs/spec/img/manual/。PDF は node dev/render-docs.mjs manual_v1.html …）
  docs/guide/ANGLEX_v1_操作ガイド.html …（写真を埋め込んだ 1 ファイル。ブラウザで開いて、手順を送りながら見る）
使い方: python3 tools/build_manuals.py [--shots <撮影フォルダ>]
"""
import sys, json, base64, html, io, pathlib, datetime
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from manual_content import VERSIONS, COMMON_FAQ
ROOT = pathlib.Path(__file__).resolve().parent.parent
args = sys.argv[1:]
SHOTS = pathlib.Path(args[args.index('--shots') + 1]) if '--shots' in args else ROOT / 'docs' / 'spec' / 'img' / 'manual'
IMG = ROOT / 'docs' / 'spec' / 'img' / 'manual'; IMG.mkdir(parents=True, exist_ok=True)
GUIDE = ROOT / 'docs' / 'guide'; GUIDE.mkdir(parents=True, exist_ok=True)
TODAY = datetime.date.today()
DATE = f'{TODAY.year} 年 {TODAY.month} 月 {TODAY.day} 日'
esc = html.escape

try:
    from PIL import Image
except ImportError:
    Image = None


def jpeg(ver, name, width=1440, q=78):
    src = SHOTS / f'{ver}_{name}.png'
    out = IMG / f'{ver}_{name}.jpg'
    if not src.exists():
        return out.read_bytes() if out.exists() else None
    if Image:
        im = Image.open(src).convert('RGB')
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        buf = io.BytesIO(); im.save(buf, 'JPEG', quality=q, optimize=True, progressive=True); data = buf.getvalue()
    else:
        data = src.read_bytes()
    out.write_bytes(data)
    return data


def marks_of(ver):
    p = SHOTS / f'{ver}_marks.json'; keep = IMG / f'{ver}_marks.json'
    if p.exists():
        keep.write_text(p.read_text(encoding='utf-8'), encoding='utf-8')
    return json.loads(keep.read_text(encoding='utf-8')) if keep.exists() else {}


# ---------------- 印刷用マニュアル ----------------
MAN_CSS = """
.cover{min-height:250mm;display:flex;flex-direction:column;justify-content:center;gap:10pt;border-left:8pt solid var(--vc);padding-left:16pt;break-after:page}
.cover .b{font-size:10pt;letter-spacing:.3em;color:var(--ink3)}
.cover h1{font-size:30pt;margin:0}.cover .sub{font-size:15pt;color:var(--ink2)}
.cover .meta{font-size:10pt;color:var(--ink3);margin-top:18pt}
.cover .for{margin-top:14pt;font-size:10.5pt}.cover .for li{margin:2pt 0}
.toc{columns:2;font-size:10pt}.toc li{margin:2pt 0;break-inside:avoid}
.ch{break-before:page}
.ch h2{display:flex;align-items:center;gap:8pt;border-bottom:2pt solid var(--vc);padding-bottom:4pt}
.ch h2 .ic{display:inline-grid;place-items:center;width:22pt;height:22pt;border-radius:6pt;background:var(--vc);color:#fff;font-size:12pt}
.fig{position:relative;margin:8pt 0 4pt;border:1px solid #cfcabd;border-radius:4pt;overflow:hidden;break-inside:avoid}
.fig img{display:block;width:100%}
.fig .mk{position:absolute;width:15pt;height:15pt;margin:-7.5pt 0 0 -7.5pt;border-radius:50%;background:var(--vc);color:#fff;font:700 8.5pt sans-serif;display:flex;align-items:center;justify-content:center;line-height:1;font-variant-numeric:tabular-nums;border:1.5pt solid #fff;box-shadow:0 1pt 3pt rgba(0,0,0,.35)}
.fig .bx{position:absolute;border:1.6pt solid var(--vc);border-radius:3pt;background:rgba(255,255,255,.06)}
.legend{display:grid;grid-template-columns:repeat(2,1fr);gap:2pt 14pt;font-size:9pt;margin:2pt 0 8pt;break-inside:avoid}
.legend div{display:flex;align-items:center;gap:0}.legend span{flex:none;width:12pt;height:12pt;border-radius:50%;background:var(--vc);color:#fff;font:700 7.5pt sans-serif;display:flex;align-items:center;justify-content:center;line-height:1;font-variant-numeric:tabular-nums;margin-right:4pt}
ol.msteps{list-style:none;padding:0;margin:6pt 0;counter-reset:s}
ol.msteps>li{position:relative;padding:4pt 0 4pt 22pt;break-inside:avoid;font-size:10.5pt;line-height:1.65}
ol.msteps>li::before{counter-increment:s;content:counter(s);position:absolute;left:0;top:4pt;width:15pt;height:15pt;border-radius:50%;border:1.5pt solid var(--vc);color:var(--vc);font:700 8.5pt sans-serif;display:flex;align-items:center;justify-content:center;line-height:1;font-variant-numeric:tabular-nums;}
ol.msteps .see{font-size:9pt;color:var(--ink3)}
.box{border:1px solid #cfcabd;border-left:4pt solid var(--vc);border-radius:3pt;padding:6pt 9pt;margin:8pt 0;font-size:10pt;break-inside:avoid}
table.k td:first-child{white-space:nowrap;font-weight:700;width:46mm}
"""


def figure(ver, name, marks, only=None, img_path=True):
    ms = marks.get(name, [])
    if only is not None:
        ms = [m for m in ms if m['n'] in only]
    src = f'img/manual/{ver}_{name}.jpg'
    boxes = ''.join(f'<div class="bx" style="left:{m["box"][0]}%;top:{m["box"][1]}%;width:{m["box"][2]}%;height:{m["box"][3]}%"></div>' for m in ms if only)
    dots = ''.join(f'<div class="mk" style="left:{m["x"]}%;top:{m["y"]}%">{m["n"]}</div>' for m in ms)
    leg = ''.join(f'<div><span>{m["n"]}</span>{esc(m["label"])}</div>' for m in ms)
    return f'<div class="fig"><img src="{src}" alt="">{boxes}{dots}</div>' + (f'<div class="legend">{leg}</div>' if leg else '')


def manual(V):
    ver = V['key']; marks = marks_of(ver)
    for name in {s['shot'] for t in V['tasks'] for s in t['steps']} | {'main', 'work'}:
        jpeg(ver, name)
    first = {'v1': 'main', 'v2': 'mode', 'v3': 'work'}[ver]
    out = [f'<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>{esc(V["name"])} マニュアル</title><link rel="stylesheet" href="doc.css"><style>:root{{--vc:{V["accent"]}}}{MAN_CSS}</style></head><body>']
    out.append(f'<section class="cover"><div class="b">ANGLEX ／ FABRICATION INTELLIGENCE</div><h1>{esc(V["name"])} マニュアル</h1><div class="sub">{esc(V["sub"])}</div>'
               f'<p style="font-size:11pt;line-height:1.8;max-width:150mm">{esc(V["intro"])}</p><div class="for"><b>こんな方に</b><ul>{"".join(f"<li>{esc(x)}</li>" for x in V["for"])}</ul></div>'
               f'<div class="meta">提出元: ワールド化成　／　{DATE}　／　画面の HTML: {esc(V["file"])}</div></section>')
    out.append('<h2>目次</h2><ol class="toc">' + ''.join(f'<li>{esc(t["title"])}</li>' for t in V['tasks']) + '<li>キー操作の一覧</li><li>困ったとき</li></ol>')
    out.append('<h2>画面の全体</h2>' + figure(ver, first, marks))
    for t in V['tasks']:
        out.append(f'<section class="ch"><h2><span class="ic">{esc(t["icon"])}</span>{esc(t["title"])}</h2>')
        shown = []
        for s in t['steps']:
            if s['shot'] not in shown:
                same = [x for x in t['steps'] if x['shot'] == s['shot']]
                only = sorted({m for x in same for m in x.get('mark', [])})
                out.append(figure(ver, s['shot'], marks, only=only or None)); shown.append(s['shot'])
        out.append('<ol class="msteps">' + ''.join(f'<li>{esc(s["t"])}' + (f' <span class="see">（写真の {"・".join(str(m) for m in s["mark"])}）</span>' if s.get('mark') else '') + '</li>' for s in t['steps']) + '</ol></section>')
    out.append('<section class="ch"><h2><span class="ic">⌨</span>キー操作の一覧</h2><table class="k"><tr><th>キー・操作</th><th>すること</th></tr>' + ''.join(f'<tr><td>{esc(k)}</td><td>{esc(d)}</td></tr>' for k, d in V['keys']) + '</table>')
    out.append('<h2 style="margin-top:16pt">困ったとき</h2><table><tr><th style="width:52mm">こんなとき</th><th>こうしてください</th></tr>' + ''.join(f'<tr><td><b>{esc(q)}</b></td><td>{esc(a)}</td></tr>' for q, a in COMMON_FAQ) + '</table>')
    out.append('<div class="box">データはお使いのブラウザの中に保存され、外部には送られません。重量・金額・納期は参考値です。単価・工場・標準日数はサンプルの値です。</div></section></body></html>')
    p = ROOT / 'docs' / 'spec' / f'manual_{ver}.html'; p.write_text('\n'.join(out), encoding='utf-8'); return p


# ---------------- 操作説明（1 ファイル・手順を送って見る） ----------------
GUIDE_HTML = r"""<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>__TITLE__</title>
<style>
:root{--vc:__ACCENT__;--bg:#f6f7f5;--card:#fff;--ink:#111827;--ink2:#4b5563;--ink3:#9ca3af;--line:#e5e7eb;--hi:rgba(255,214,10,.9)}
@media (prefers-color-scheme:dark){:root{--bg:#121417;--card:#1b1f24;--ink:#f3f4f6;--ink2:#cbd5e1;--ink3:#7b8494;--line:#2c323a}}
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{font-family:"Hiragino Sans","Noto Sans JP","Yu Gothic UI","Meiryo",system-ui,sans-serif;background:var(--bg);color:var(--ink);display:grid;grid-template-columns:270px 1fr;min-height:100vh}
aside{border-right:1px solid var(--line);background:var(--card);padding:18px 12px;display:flex;flex-direction:column;gap:4px;overflow:auto;max-height:100vh;position:sticky;top:0}
.brand{padding:4px 10px 14px}.brand .b{font-size:11px;letter-spacing:.28em;color:var(--ink3)}.brand h1{font-size:19px;margin:4px 0 2px}.brand .s{font-size:12.5px;color:var(--ink2)}
.nav{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;border:none;background:none;color:var(--ink);font:inherit;font-size:13.5px;text-align:left;cursor:pointer}
.nav:hover{background:rgba(127,127,127,.1)}.nav.on{background:var(--vc);color:#fff}
.nav .i{width:24px;height:24px;border-radius:7px;display:grid;place-items:center;background:rgba(127,127,127,.14);font-size:12px;flex:none}.nav.on .i{background:rgba(255,255,255,.22)}
.nav .c{margin-left:auto;font-size:11px;opacity:.7}
.sep{height:1px;background:var(--line);margin:8px 6px}
main{padding:22px clamp(14px,3vw,36px) 40px;max-width:1240px;width:100%}
.top{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:12px}.top h2{margin:0;font-size:22px}.top .n{color:var(--ink3);font-size:13px}
.stage{position:relative;margin:0 auto;max-width:max(320px,calc((100vh - 270px) * 1.6));border-radius:14px;overflow:hidden;border:1px solid var(--line);background:#ddd;box-shadow:0 12px 36px rgba(0,0,0,.10)}
.stage img{display:block;width:100%;height:auto}
.mk{position:absolute;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;background:var(--vc);color:#fff;font:700 13px system-ui;display:flex;align-items:center;justify-content:center;line-height:1;font-variant-numeric:tabular-nums;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:default;transition:transform .2s,opacity .2s;opacity:.35}
.mk.on{opacity:1;transform:scale(1.12);animation:pulse 1.6s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(255,214,10,.75),0 2px 8px rgba(0,0,0,.35)}70%{box-shadow:0 0 0 14px rgba(255,214,10,0),0 2px 8px rgba(0,0,0,.35)}100%{box-shadow:0 0 0 0 rgba(255,214,10,0),0 2px 8px rgba(0,0,0,.35)}}
.bx{position:absolute;border:3px solid var(--hi);border-radius:8px;box-shadow:0 0 0 9999px rgba(10,12,16,.28);pointer-events:none;transition:all .25s}
.mk .tip{position:absolute;left:34px;top:50%;transform:translateY(-50%);white-space:nowrap;background:#111827;color:#fff;font:500 12px system-ui;padding:5px 9px;border-radius:8px;opacity:0;pointer-events:none;transition:opacity .15s}
.mk:hover .tip{opacity:1}.mk:hover{opacity:1}
.step{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:start;margin-top:16px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px}
.step .no{width:40px;height:40px;border-radius:12px;background:var(--vc);color:#fff;font:700 17px system-ui;display:flex;align-items:center;justify-content:center;line-height:1;font-variant-numeric:tabular-nums;}
.step p{margin:2px 0 0;font-size:15.5px;line-height:1.75}
.step .see{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.step .see span{font-size:12px;padding:3px 9px;border-radius:999px;background:rgba(127,127,127,.12);color:var(--ink2)}
.ctl{display:flex;align-items:center;gap:10px;margin-top:14px}
.ctl button{height:42px;padding:0 18px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:600 14px system-ui;cursor:pointer}
.ctl button.pri{background:var(--vc);border-color:var(--vc);color:#fff}.ctl button:disabled{opacity:.4;cursor:default}
.dots{display:flex;gap:6px;margin-left:auto}.dots i{width:9px;height:9px;border-radius:50%;background:var(--line);cursor:pointer}.dots i.on{background:var(--vc)}
.hint{font-size:12px;color:var(--ink3);margin-top:8px}
.panel{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin-top:6px}
table{border-collapse:collapse;width:100%;font-size:14px}td,th{border-bottom:1px solid var(--line);padding:9px 10px;text-align:left;vertical-align:top}th{color:var(--ink2);font-weight:600}
td.k{white-space:nowrap;font-weight:700}
kbd{font:600 12px ui-monospace,monospace;padding:2px 6px;border-radius:6px;border:1px solid var(--line);background:rgba(127,127,127,.08)}
.intro{font-size:15px;line-height:1.8;max-width:760px}.for li{margin:4px 0}
.legend{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:6px 18px;margin-top:12px;font-size:13.5px}
.legend div{display:flex;align-items:center}.legend span{flex:none;width:20px;height:20px;border-radius:50%;background:var(--vc);color:#fff;font:700 11px system-ui;display:flex;align-items:center;justify-content:center;line-height:1;font-variant-numeric:tabular-nums;margin-right:6px}
@media (max-width:860px){html,body{height:auto}body{grid-template-columns:1fr;align-content:start}aside{position:sticky;top:0;z-index:5;max-height:none;padding:10px 10px 8px;display:block;border-right:none;border-bottom:1px solid var(--line)}.brand{padding:2px 4px 8px}.brand h1{font-size:16px;display:inline;margin-right:8px}.brand .s{display:inline}#navs{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px}.nav{flex:none;padding:7px 10px;font-size:13px}.nav .c,.sep{display:none}}
</style></head><body>
<aside id="side"><div class="brand"><div class="b">ANGLEX 操作ガイド</div><h1>__NAME__</h1><div class="s">__SUB__</div></div><div id="navs"></div></aside>
<main id="main"></main>
<script>
const D = __DATA__;
const $ = s => document.querySelector(s); let cur = { page: 'about', step: 0 };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function nav() { const n = $('#navs'); n.innerHTML = ''; const add = (id, i, t, c) => { const b = document.createElement('button'); b.className = 'nav' + (cur.page === id ? ' on' : ''); b.innerHTML = `<span class="i">${esc(i)}</span>${esc(t)}${c ? `<span class="c">${c}</span>` : ''}`; b.onclick = () => go(id, 0); n.append(b); };
  add('about', '?', 'この画面について'); add('screen', '◫', '画面の見かた'); n.append(Object.assign(document.createElement('div'), { className: 'sep' }));
  D.tasks.forEach(t => add(t.id, t.icon, t.title, t.steps.length)); n.append(Object.assign(document.createElement('div'), { className: 'sep' })); add('keys', '⌨', 'キー操作'); add('faq', '!', '困ったとき'); }
function stage(shot, marks, only) { const img = D.img[shot]; if (!img) return '<div class="panel">（この写真はありません）</div>'; const ms = D.marks[shot] || []; let h = `<div class="stage"><img src="${img}" alt="">`;
  const hi = ms.filter(m => only && only.includes(m.n)); if (hi.length) { const x0 = Math.min(...hi.map(m => m.box[0])), y0 = Math.min(...hi.map(m => m.box[1])), x1 = Math.max(...hi.map(m => m.box[0] + m.box[2])), y1 = Math.max(...hi.map(m => m.box[1] + m.box[3])); if (hi.length === 1 || (x1 - x0) * (y1 - y0) < 6000) h += `<div class="bx" style="left:${x0 - .4}%;top:${y0 - .6}%;width:${x1 - x0 + .8}%;height:${y1 - y0 + 1.2}%"></div>`; }
  for (const m of ms) h += `<div class="mk${!only || only.includes(m.n) ? ' on' : ''}" style="left:${m.x}%;top:${m.y}%">${m.n}<span class="tip">${esc(m.label)}</span></div>`; return h + '</div>'; }
function go(page, step) { cur = { page, step }; history.replaceState(null, '', '#' + page + (step ? '-' + (step + 1) : '')); render(); nav(); scrollTo({ top: 0, behavior: 'smooth' }); }
function render() { const m = $('#main'); const t = D.tasks.find(x => x.id === cur.page);
  if (cur.page === 'about') { m.innerHTML = `<div class="top"><h2>${esc(D.name)}</h2><span class="n">${esc(D.sub)}</span></div><p class="intro">${esc(D.intro)}</p><div class="panel"><b>こんな方に</b><ul class="for">${D.for.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p style="margin:8px 0 0">画面の HTML: <b>${esc(D.file)}</b>（Chrome か Edge で開きます）</p></div><p class="hint">左の「やりたいこと」を選ぶと、写真の上の番号と手順の説明が 1 つずつ進みます。← → キーでも送れます。</p>${stage(D.first, D.marks)}`; return; }
  if (cur.page === 'screen') { const ms = D.marks[D.first] || []; m.innerHTML = `<div class="top"><h2>画面の見かた</h2><span class="n">番号にマウスを乗せると説明が出ます</span></div>${stage(D.first, D.marks)}<div class="legend">${ms.map(x => `<div><span>${x.n}</span>${esc(x.label)}</div>`).join('')}</div>`; return; }
  if (cur.page === 'keys') { m.innerHTML = `<div class="top"><h2>キー操作</h2></div><div class="panel"><table><tr><th>キー・操作</th><th>すること</th></tr>${D.keys.map(([k, d]) => `<tr><td class="k">${k.split(' / ').map(x => `<kbd>${esc(x)}</kbd>`).join(' / ')}</td><td>${esc(d)}</td></tr>`).join('')}</table></div>`; return; }
  if (cur.page === 'faq') { m.innerHTML = `<div class="top"><h2>困ったとき</h2></div><div class="panel"><table>${D.faq.map(([q, a]) => `<tr><td style="width:32%"><b>${esc(q)}</b></td><td>${esc(a)}</td></tr>`).join('')}</table></div>`; return; }
  const s = t.steps[cur.step]; const n = t.steps.length; const ms = (D.marks[s.shot] || []).filter(x => (s.mark || []).includes(x.n));
  m.innerHTML = `<div class="top"><h2>${esc(t.title)}</h2><span class="n">手順 ${cur.step + 1} / ${n}</span></div>${stage(s.shot, D.marks, s.mark && s.mark.length ? s.mark : null)}
    <div class="step"><div class="no">${cur.step + 1}</div><div><p>${esc(s.t)}</p>${ms.length ? `<div class="see">${ms.map(x => `<span>${x.n}　${esc(x.label)}</span>`).join('')}</div>` : ''}</div></div>
    <div class="ctl"><button id="prev" ${cur.step === 0 ? 'disabled' : ''}>← 前へ</button><button id="next" class="pri">${cur.step === n - 1 ? (nextTask(t) ? '次のやりたいことへ →' : 'おわり') : '次へ →'}</button><div class="dots">${t.steps.map((_, i) => `<i class="${i === cur.step ? 'on' : ''}" data-i="${i}"></i>`).join('')}</div></div>`;
  $('#prev').onclick = () => go(cur.page, Math.max(0, cur.step - 1)); $('#next').onclick = () => { if (cur.step < n - 1) go(cur.page, cur.step + 1); else { const nt = nextTask(t); if (nt) go(nt.id, 0); } }; m.querySelectorAll('.dots i').forEach(d => d.onclick = () => go(cur.page, +d.dataset.i)); }
function nextTask(t) { const i = D.tasks.indexOf(t); return D.tasks[i + 1] || null; }
addEventListener('keydown', e => { const t = D.tasks.find(x => x.id === cur.page); if (!t) return; if (e.key === 'ArrowRight') $('#next')?.click(); if (e.key === 'ArrowLeft') $('#prev')?.click(); });
{ const h = location.hash.slice(1).match(/^([a-z0-9]+)(?:-(\d+))?$/); if (h && (D.tasks.some(t => t.id === h[1]) || ['about', 'screen', 'keys', 'faq'].includes(h[1]))) cur = { page: h[1], step: h[2] ? +h[2] - 1 : 0 }; }
nav(); render();
</script></body></html>"""


def guide(V):
    ver = V['key']; marks = marks_of(ver); first = {'v1': 'main', 'v2': 'mode', 'v3': 'work'}[ver]
    names = {s['shot'] for t in V['tasks'] for s in t['steps']} | {first}
    imgs = {}
    for n in sorted(names):
        data = jpeg(ver, n)
        if data:
            imgs[n] = 'data:image/jpeg;base64,' + base64.b64encode(data).decode()
    D = {k: V[k] for k in ('name', 'sub', 'intro', 'for', 'file', 'tasks', 'keys')}
    D.update({'faq': COMMON_FAQ, 'marks': marks, 'img': imgs, 'first': first})
    page = (GUIDE_HTML.replace('__TITLE__', esc(f'{V["name"]} 操作ガイド')).replace('__NAME__', esc(V['name'])).replace('__SUB__', esc(V['sub'])).replace('__ACCENT__', V['accent'])
            .replace('__DATA__', json.dumps(D, ensure_ascii=False).replace('</', '<\\/')))
    p = GUIDE / f'ANGLEX_{ver}_操作ガイド.html'; p.write_text(page, encoding='utf-8'); return p


for V in VERSIONS:
    m = manual(V); g = guide(V)
    print('wrote', m.relative_to(ROOT), '/', g.relative_to(ROOT), f'{g.stat().st_size // 1024} KB')
