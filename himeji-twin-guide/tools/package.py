# ZIP（機能別スクリーンショット）と INDEX.html / INDEX.csv を作成
import json, os, zipfile, shutil, html, csv, io, sys
from PIL import Image
root=os.path.dirname(os.path.abspath(__file__))
man=json.load(open(os.path.join(root,'docgen','manifest_all.json'),encoding='utf-8'))
nav={'sec':'00_basic','secName':'画面構成と基本操作','id':'00-00','file':'00_basic/00-00_navigation_map.png','title':'画面遷移・操作導線マップ','desc':'どのボタンから、どの画面・機能へ進むかを1枚にまとめた図（①階層のドリルダウン、②地図に重ねる分析レイヤー、③ダイアログ・分析ワークスペース）。','kind':'full','how':''}
items=[nav]+man
stage=os.path.join(root,'zipstage','himeji_twin_screenshots'); shutil.rmtree(os.path.dirname(stage),ignore_errors=True); os.makedirs(stage)
for m in items:
    src=os.path.join(root,'diagram','navmap.png') if m['id']=='00-00' else os.path.join(root,'out',m['file'])
    dst=os.path.join(stage,m['file']); os.makedirs(os.path.dirname(dst),exist_ok=True)
    if dst.endswith('.jpg'): Image.open(src).convert('RGB').save(dst,'JPEG',quality=85,optimize=True,progressive=True)
    else: shutil.copy2(src,dst)
# INDEX.html
secs=[]; 
for m in items:
    if not secs or secs[-1][0]!=m['sec']: secs.append((m['sec'],m['secName'],[]))
    secs[-1][2].append(m)
e=html.escape
cards=[]
for sec,name,lst in secs:
    cards.append(f'<section id="{sec}"><h2><span>{e(sec[:2])}</span>{e(name)} <small>{len(lst)}点</small></h2><div class="grid">')
    for m in lst:
        cls='card wide' if m['kind']=='full' else 'card crop'
        cards.append(f'<figure class="{cls}"><a href="{e(m["file"])}" target="_blank"><img loading="lazy" src="{e(m["file"])}" alt="{e(m["title"])}"></a><figcaption><b>{e(m["id"])}　{e(m["title"])}</b>{("<p>"+e(m["desc"])+"</p>") if m.get("desc") else ""}{("<p class=how>操作："+e(m["how"])+"</p>") if m.get("how") else ""}<code>{e(m["file"])}</code></figcaption></figure>')
    cards.append('</div></section>')
toc=''.join(f'<a href="#{s}">{e(s[:2])} {e(n)}</a>' for s,n,_ in secs)
page=f'''<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>機能別スクリーンショット一覧</title>
<style>:root{{--ink:#1d2a33;--sub:#5b6b76;--teal:#0d6f64;--line:#d7dee4;--bg:#f6f8fa}}*{{box-sizing:border-box}}body{{margin:0;font-family:"Yu Gothic","Hiragino Sans","Noto Sans JP",sans-serif;color:var(--ink);background:var(--bg)}}
header{{background:#fff;border-bottom:1px solid var(--line);padding:20px 28px;position:sticky;top:0;z-index:2}}h1{{margin:0 0 4px;font-size:20px}}header p{{margin:0;color:var(--sub);font-size:13px}}nav{{margin-top:10px;display:flex;flex-wrap:wrap;gap:6px}}nav a{{font-size:12px;padding:3px 9px;border:1px solid var(--line);border-radius:12px;color:var(--teal);text-decoration:none;background:#fff}}
main{{padding:10px 28px 40px;max-width:1500px;margin:auto}}h2{{font-size:17px;margin:28px 0 12px;display:flex;align-items:center;gap:8px}}h2 span{{background:var(--teal);color:#fff;border-radius:6px;padding:1px 8px;font-size:13px}}h2 small{{color:var(--sub);font-weight:400;font-size:12px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:14px}}.card{{margin:0;background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden}}.card.crop{{}}.card img{{display:block;width:100%;height:auto;background:#0b1720}}.card.crop img{{max-height:420px;object-fit:contain}}
figcaption{{padding:9px 12px 11px;font-size:12.5px;line-height:1.55}}figcaption b{{display:block;font-size:13.5px;margin-bottom:3px}}figcaption p{{margin:0 0 4px;color:#33434e}}figcaption .how{{color:var(--teal)}}code{{font-size:11px;color:var(--sub)}}</style></head>
<body><header><h1>姫路城 × 姫路市 観光動態デジタルツイン — 機能別スクリーンショット一覧</h1><p>全{len(items)}点。赤枠・番号は操作箇所を示す注釈です。画像をクリックすると原寸で開きます。数値はすべてダミーデータ／シナリオ推計です。</p><nav>{toc}</nav></header><main>{''.join(cards)}</main></body></html>'''
open(os.path.join(stage,'INDEX.html'),'w',encoding='utf-8').write(page)
with open(os.path.join(stage,'INDEX.csv'),'w',encoding='utf-8-sig',newline='') as f:
    w=csv.writer(f); w.writerow(['No.','章','ファイル','タイトル','説明','操作'])
    for m in items: w.writerow([m['id'],m['secName'],m['file'],m['title'],m.get('desc',''),m.get('how','')])
zp=sys.argv[1]
if os.path.exists(zp): os.remove(zp)
with zipfile.ZipFile(zp,'w',zipfile.ZIP_DEFLATED) as z:
    for dp,dn,fn in os.walk(stage):
        for n in sorted(fn):
            full=os.path.join(dp,n); arc=os.path.relpath(full,os.path.dirname(stage))
            z.write(full,arc, compress_type=zipfile.ZIP_STORED if n.endswith(('.jpg','.png')) else zipfile.ZIP_DEFLATED)
print('zip',zp,round(os.path.getsize(zp)/1e6,1),'MB',len(items),'images')
