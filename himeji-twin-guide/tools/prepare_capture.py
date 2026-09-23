# 撮影用コピーを作成：アプリ本体のクロージャ内に評価フック（window.__ev）を追加し、
# 図版用に埋め込みフォント（Noto Sans JP）を diagram/fonts.css へ書き出す。表示内容は変更しない。
import os
root=os.path.dirname(os.path.abspath(__file__))
s=open(os.path.join(root,'index.html'),encoding='utf-8').read()
tail=';\n})();\n</script>\n</body>\n</html>\n'
assert s.endswith(tail), 'HTML の末尾構造が想定と異なります'
open(os.path.join(root,'index_cap.html'),'w',encoding='utf-8').write(s[:-len(tail)]+';\nwindow.__ev=(src)=>eval(src);\n})();\n</script>\n</body>\n</html>\n')
i=s.find('<style>@font-face'); j=s.find('</style>',i)
os.makedirs(os.path.join(root,'diagram'),exist_ok=True)
open(os.path.join(root,'diagram','fonts.css'),'w',encoding='utf-8').write(s[i+7:j])
print('ok')
