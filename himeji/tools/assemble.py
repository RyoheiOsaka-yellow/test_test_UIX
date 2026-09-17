"""src/ のパーツと assets/ の地図画像・標高を結合して index.html を生成する。
使い方: python3 tools/assemble.py   (himeji/ ディレクトリで実行)
"""
import base64, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, ASSETS = os.path.join(ROOT, 'src'), os.path.join(ROOT, 'assets')
def b64(name, mime='image/webp'): return f'data:{mime};base64,' + base64.b64encode(open(os.path.join(ASSETS, name), 'rb').read()).decode()
html = ''.join(open(os.path.join(SRC, f), encoding='utf-8').read() for f in ['head.html', 'base.css', 'extra.css', 'js1_core.js', 'js2_scene.js', 'js3_sim.js', 'js4_ui.js'])
html = html.replace('__DEM_B64__', open(os.path.join(ASSETS, 'dem192.b64')).read().strip())
for key, name in [('PALE15', 'himeji_pale_z15_1792.webp'), ('PHOTO15', 'himeji_photo_z15.q75.webp'), ('PALE17', 'himeji_pale_z17.webp'), ('PHOTO17', 'himeji_photo_z17.q75.webp')]:
    html = html.replace(f"'__IMG_{key}__'", "'" + b64(name) + "'")
out = os.path.join(ROOT, 'index.html'); open(out, 'w', encoding='utf-8').write(html)
print(out, len(html.encode()), 'bytes')
