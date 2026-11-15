# 撮影した PNG を、PDF 用に軽い JPEG にする
import glob, os
from PIL import Image
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'img')
for p in sorted(glob.glob(os.path.join(d, '*.png'))):
    im = Image.open(p).convert('RGB')
    if im.width > 2200: im = im.resize((2200, round(im.height * 2200 / im.width)), Image.LANCZOS)
    im.save(p[:-4] + '.jpg', quality=84, optimize=True)
    print(os.path.basename(p), im.size)
