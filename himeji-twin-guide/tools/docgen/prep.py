# 画像の軽量化（docx用）とサイズ情報の収集
import json, glob, os
from PIL import Image
base=os.path.dirname(os.path.abspath(__file__)); root=os.path.dirname(base)
man=[]
for f in sorted(glob.glob(os.path.join(root,'manifest_*.json'))): man+=json.load(open(f,encoding='utf-8'))
order=['00_basic','01_L0','02_L1','03_L2','04_display','05_OD','06_tour','07_timeline','08_board','09_proposal','10_db','11_policy','12_area','13_compare']
d={}
for m in man: d[m['file']]=m
man=[m for m in d.values() if os.path.exists(os.path.join(root,'out',m['file']))]
man.sort(key=lambda m:(order.index(m['sec']), m['id']))
os.makedirs(os.path.join(base,'img'),exist_ok=True)
for m in man:
    src=os.path.join(root,'out',m['file']); im=Image.open(src); w,h=im.size; m['w'],m['h']=w,h
    stem=m['file'].replace('/','__').rsplit('.',1)[0]
    if m['kind']=='full':
        im=im.convert('RGB'); im=im.resize((1200,round(1200*h/w)),Image.LANCZOS); out=os.path.join(base,'img',stem+'.jpg'); im.save(out,'JPEG',quality=80,optimize=True,progressive=True); m['doc']=out; m['dtype']='jpg'
    else:
        out=os.path.join(base,'img',stem+'.jpg'); im.convert('RGB').save(out,'JPEG',quality=90,optimize=True,subsampling=0); m['doc']=out; m['dtype']='jpg'
json.dump(man,open(os.path.join(base,'manifest_all.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=1)
print(len(man),'images')
