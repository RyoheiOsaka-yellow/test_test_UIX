#!/usr/bin/env python3
"""Bundle the whole site into ONE self-contained HTML (hash router, assets embedded once).
Output: ../dist-html/bfserv-all-in-one.html"""
import base64, mimetypes, pathlib, re, json
ROOT = pathlib.Path(__file__).parent
OUT = ROOT.parent / 'dist-html'; OUT.mkdir(exist_ok=True)
PAGES = ['index.html','bicycle/index.html','bicycle/prices/index.html','bicycle/guide/index.html','wheelchair/index.html',
         'airstation/index.html','airstation/products/index.html','airstation/support/index.html','airstation/cases/index.html',
         'plus/index.html','company/index.html','contact/index.html','privacy/index.html']
key_of = lambda rel: 'top' if rel == 'index.html' else rel[:-len('/index.html')]
assets = {}
def asset(path: pathlib.Path) -> str:
    rel = path.relative_to(ROOT).as_posix()
    if rel not in assets:
        mime = 'image/svg+xml' if path.suffix == '.svg' else (mimetypes.guess_type(str(path))[0] or 'application/octet-stream')
        assets[rel] = f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()
    return rel
def resolve(page, ref): return (page.parent / ref).resolve()

def convert(html, page):
    # images -> data-asset
    def img_repl(m):
        ref = m.group(2)
        if ref.startswith(('data:', 'http')): return m.group(0)
        return m.group(1) + 'data-asset="' + asset(resolve(page, ref)) + '" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="'
    html = re.sub(r'(<img[^>]*\s)src="([^"]+)"', img_repl, html)
    html = re.sub(r'\sloading="lazy"', '', html)
    # ring data-src
    m = re.search(r'data-src="([^"]+)" data-items="([^"]+)"', html)
    if m:
        for f in m.group(2).split(','): asset(resolve(page, m.group(1) + f))
        html = html.replace(f'data-src="{m.group(1)}"', 'data-src="assets/logos/"')
    # links
    def link_repl(m):
        ref = m.group(2)
        if ref.startswith(('#', 'tel:', 'mailto:', 'http', 'data:')): return m.group(0)
        target, _, frag = ref.partition('#')
        try: rel = resolve(page, target).relative_to(ROOT).as_posix()
        except ValueError: return m.group(0)
        if rel in PAGES: return m.group(1) + '#/' + key_of(rel) + ('?' + frag if frag else '') + m.group(3)
        return m.group(0)
    return re.sub(r'(<a[^>]*\shref=")([^"]+)(")', link_repl, html)

index = (ROOT / 'index.html').read_text(encoding='utf-8')
head = index[:index.find('<body')]
head = re.sub(r'<link rel="stylesheet" href="[^"]*assets/css/main\.css">', lambda m: '<style>\n' + (ROOT/'assets/css/main.css').read_text(encoding='utf-8') + '\n</style>', head)
head = re.sub(r'(<link rel="icon" href=")([^"]+)(")', lambda m: m.group(1) + 'data:image/svg+xml;base64,' + base64.b64encode(resolve(ROOT/'index.html', m.group(2)).read_bytes()).decode() + m.group(3), head)
head = head.replace('<title>', '<title>【全ページ一体版】', 1)
body_open = re.search(r'<body[^>]*>', index).group(0)
header_html = index[index.find('<a class="sr-only"'):index.find('<main id="main">')]
footer_html = index[index.find('</main>') + len('</main>'):index.find('<script src=')]
header_html = convert(header_html, ROOT/'index.html'); footer_html = convert(footer_html, ROOT/'index.html')

sections = []
for rel in PAGES:
    page = ROOT / rel; html = page.read_text(encoding='utf-8')
    body_attrs = re.search(r'<body[^>]*>', html).group(0)
    accent = re.search(r'data-accent="([^"]*)"', body_attrs).group(1)
    bcls = (re.search(r'class="([^"]*)"', body_attrs) or [None, ''])[1]
    title = re.search(r'<title>(.*?)</title>', html).group(1)
    inner = html[html.find('<main id="main">') + len('<main id="main">'):html.find('</main>')]
    inner = convert(inner, page)
    sections.append(f'<div class="sp-page" data-page="{key_of(rel)}" data-accent="{accent}" data-body-class="{bcls}" data-title="{title}" hidden>\n{inner}\n</div>')

scripts = ''.join('<script>\n' + (ROOT/'assets/js'/f).read_text(encoding='utf-8') + '\n</script>\n' for f in ['main.js','honeycomb.js','hero.js','fluid.js','ring.js','prices.js'])
scripts = scripts.replace("img.src = src + file;", "img.src = (window.BF_ASSETS && window.BF_ASSETS[src + file]) || (src + file);")
router = r'''
<style>.sp-page[hidden]{display:none}.sp-bar{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:95;background:rgba(20,20,20,.9);color:#fff;font:12px/1 "Helvetica Neue",Helvetica,Arial,sans-serif;letter-spacing:.06em;padding:8px 14px;border-radius:999px;backdrop-filter:blur(8px);display:flex;gap:8px;align-items:center;pointer-events:none}@media(max-width:720px){.sp-bar{display:none}}.sp-color{position:fixed;left:14px;bottom:14px;z-index:96;display:flex;align-items:center;gap:6px;padding:6px 8px 6px 14px;border-radius:999px;background:rgba(255,255,255,.92);backdrop-filter:blur(8px);box-shadow:0 10px 30px -12px rgba(0,0,0,.35),0 0 0 1px rgba(0,0,0,.06);font:600 12px/1 "Noto Sans JP",sans-serif;color:#141414}.sp-color span{margin-right:4px;color:#4b4a46}.sp-color button{white-space:nowrap;display:inline-flex;align-items:center;gap:6px;padding:7px 11px;border-radius:999px;border:0;background:transparent;font:inherit;cursor:pointer}.sp-color button i{width:12px;height:12px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}.sp-color button[aria-pressed="true"]{background:#141414;color:#fff}@media(max-width:720px){.sp-color{bottom:84px;left:12px;padding:4px}.sp-color span{display:none}.sp-color button{padding:6px 8px;font-size:11px}}</style>
<div class="sp-bar" aria-hidden="true">ALL-IN-ONE PREVIEW · <span id="sp-route">top</span></div>
<div class="sp-color" role="group" aria-label="出張自転車修理のカラー比較">
  <span>自転車修理カラー</span>
  <button type="button" data-bike="green" aria-pressed="true"><i style="background:#00a54f"></i>緑</button>
  <button type="button" data-bike="pink" aria-pressed="false"><i style="background:#e8408c"></i>ピンク</button>
  <button type="button" data-bike="black" aria-pressed="false"><i style="background:#141414"></i>黒</button>
</div>
<script>
(function(){
  var A = window.BF_ASSETS; document.querySelectorAll('img[data-asset]').forEach(function(i){ var d=A[i.getAttribute('data-asset')]; if(d) i.src=d; });
  var pages=[].slice.call(document.querySelectorAll('.sp-page'));
  function route(){
    var h=location.hash||'#/top'; if(h.indexOf('#/')!==0) return;
    var q=h.slice(2).split('?'); var key=q[0].replace(/\/$/,'')||'top'; var frag=q[1];
    var pg=document.querySelector('.sp-page[data-page="'+key+'"]')||pages[0];
    pages.forEach(function(p){ p.hidden = p!==pg; });
    document.body.setAttribute('data-accent', pg.getAttribute('data-accent'));
    document.body.className = (pg.getAttribute('data-body-class')||'') + ' is-ready';
    document.title = pg.getAttribute('data-title');
    document.getElementById('sp-route').textContent = key;
    if (window.BF_setMenu) window.BF_setMenu(false); else { document.body.classList.remove('menu-open'); document.documentElement.style.overflow=''; }
    window.scrollTo(0,0);
    requestAnimationFrame(function(){ window.dispatchEvent(new Event('resize')); if(frag){ var el=pg.querySelector('#'+frag); el&&el.scrollIntoView({behavior:'smooth'}); } });
  }
  window.addEventListener('hashchange', route); route();
  var btns=[].slice.call(document.querySelectorAll('.sp-color button'));
  function setBike(v){ if(v==='green') document.documentElement.removeAttribute('data-bike'); else document.documentElement.setAttribute('data-bike', v);
    btns.forEach(function(b){ b.setAttribute('aria-pressed', String(b.getAttribute('data-bike')===v)); });
    try{ localStorage.setItem('bf-bike', v); }catch(e){} }
  btns.forEach(function(b){ b.addEventListener('click', function(){ setBike(b.getAttribute('data-bike')); }); });
  var saved='green'; try{ saved=localStorage.getItem('bf-bike')||'green'; }catch(e){} setBike(saved);
})();
</script>'''
doc = (head + body_open + '\n<script>window.BF_ASSETS=' + json.dumps(assets) + ';</script>\n' + header_html +
       '<main id="main">\n' + '\n'.join(sections) + '\n</main>' + footer_html + scripts + router + '\n</body>\n</html>\n')
out = OUT / 'bfserv-all-in-one.html'; out.write_text(doc, encoding='utf-8')
print(f'{out.name}: {len(doc)//1024//1024} MB, assets: {len(assets)}')
