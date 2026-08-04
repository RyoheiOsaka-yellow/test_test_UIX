#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""参考 HTML (新宿駅 3D) をベースに渋谷駅版 HTML を組み立てる。"""
import json, re, sys

S = "/tmp/claude-0/-home-user-test-test-UIX/170288d1-e4df-5921-a92d-40f263747569/scratchpad"
SRC = "/root/.claude/uploads/170288d1-e4df-5921-a92d-40f263747569/a80f13bf-______3D.html"
OUT = sys.argv[1] if len(sys.argv) > 1 else f"{S}/shibuya.html"

html = open(SRC, encoding="utf-8").read()

# ---- 埋め込みデータ差し替え
m = re.search(r"window\.__EMBEDDED_DATA=", html)
start = m.end()
end = html.find("</script>", start)
data = open(f"{S}/shibuya_embedded.json", encoding="utf-8").read()
html = html[:start] + data + html[end:]

def sub1(old, new, label):
    global html
    n = html.count(old)
    assert n == 1, f"{label}: found {n} occurrences"
    html = html.replace(old, new)

# ---- アプリ定数
sub1("gn=[-12035.29,-34261.85]", "gn=[-11920.2,-37931.79]", "gn")
sub1(
    'qi=[{level:4,label:"4F",color:"#ff9db1"},{level:3,label:"3F",color:"#ffc36e"},'
    '{level:2,label:"2F",color:"#ffe66e"},{level:1,label:"1F",color:"#9dffb0"},'
    '{level:0,label:"GL",color:"#7ef0ff"},{level:-1,label:"B1",color:"#7fb2ff"},'
    '{level:-2,label:"B2",color:"#b48dff"},{level:-3,label:"B3",color:"#ff8df0"}]',
    'qi=[{level:3,label:"4F",color:"#ff9db1"},{level:2,label:"3F",color:"#ffc36e"},'
    '{level:1,label:"2F",color:"#ffe66e"},{level:0,label:"1F",color:"#7ef0ff"},'
    '{level:-1,label:"B1",color:"#7fb2ff"},{level:-2,label:"B2",color:"#b48dff"},'
    '{level:-3,label:"B3",color:"#ff8df0"},{level:-4,label:"B4",color:"#9dffb0"},'
    '{level:-5,label:"B5",color:"#ffa26e"}]',
    "qi")
sub1('Sh={B3:-3,B2:-2,B1:-1,0:0,1:1,2:2,"2out":2,3:3,"3out":3,4:4,"4out":4}',
     'Sh={B5:-5,B4:-4,B3:-3,B2:-2,B1:-1,0:0,1:1,2:2,3:3}', "Sh")
sub1('sf=["B3","B2","B1","0","1","2","2out","3","3out","4","4out"],Yx=sf,'
     'Zx=["B3","B2","B1","0","2","2out","3","3out","4","4out"]',
     'sf=["B5","B4","B3","B2","B1","0","1","2","3"],Yx=sf,Zx=sf', "sf")

# ---- データパス
html = html.replace("Shinjuku_node.geojson", "Shibuya_node.geojson")
html = html.replace("Shinjuku_link.geojson", "Shibuya_link.geojson")
html = html.replace("ShinjukuTerminal/ShinjukuTerminal_", "ShibuyaTerminal/ShibuyaTerminal_")

# ---- 表示テキスト
html = html.replace("新宿駅 構内図 3D", "渋谷駅 構内図 3D")
html = html.replace("SHINJUKU STATION INDOOR MAP", "SHIBUYA STATION INDOOR MAP")
sub1("道路（基盤地図情報）", "道路（OpenStreetMap）", "road label")
cred_old = re.search(r'<div id="credit">.*?</div>', html, re.S).group(0)
cred_new = ('<div id="credit">\n        出典:「歩行空間ネットワークデータ（東京都 渋谷南部）」'
            '(<a href="https://www.geospatial.jp/ckan/dataset/0401" target="_blank" rel="noopener">国土交通省</a>)'
            ' を加工して作成 ／\n        駅構内・周辺建物・鉄道・道路: © '
            '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
            ' contributors\n    </div>')
html = html.replace(cred_old, cred_new)

open(OUT, "w", encoding="utf-8").write(html)
print("written:", OUT, len(html), "chars")
