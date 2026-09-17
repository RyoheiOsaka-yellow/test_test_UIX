"""国土地理院 地理院タイルを取得して姫路市域のモザイク画像・標高グリッドを生成する。
使い方: python3 tools/fetch_tiles.py   (himeji/ ディレクトリで実行。assets/ に出力)
出典: 国土地理院 地理院タイル (淡色地図 pale / 全国最新写真 seamlessphoto / 標高タイル dem_png)
依存: pip install pillow numpy
"""
import os, base64
from concurrent.futures import ThreadPoolExecutor
import urllib.request
from PIL import Image
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets'); CACHE = os.path.join(ROOT, '.tilecache')
os.makedirs(OUT, exist_ok=True); os.makedirs(CACHE, exist_ok=True)
UA = {'User-Agent': 'Mozilla/5.0 (himeji-tourism-twin prototype; tile prefetch)'}

def get(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0: return path
    for _ in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r: data = r.read()
            open(path, 'wb').write(data); return path
        except Exception as e: err = e
    print('FAIL', url, err); return None

def mosaic(layer, z, x0, x1, y0, y1, ext):
    im = Image.new('RGB', ((x1 - x0) * 256, (y1 - y0) * 256), (230, 235, 240))
    jobs = [(f'https://cyberjapandata.gsi.go.jp/xyz/{layer}/{z}/{x}/{y}.{ext}', f'{CACHE}/{layer}_{z}_{x}_{y}.{ext}', x, y)
            for x in range(x0, x1) for y in range(y0, y1)]
    with ThreadPoolExecutor(8) as ex: list(ex.map(lambda j: get(j[0], j[1]), jobs))
    for url, p, x, y in jobs:
        if os.path.exists(p):
            try: im.paste(Image.open(p).convert('RGB'), ((x - x0) * 256, (y - y0) * 256))
            except Exception as e: print('bad', p, e)
    return im

# 市域 z15 9×9タイル (約9 km四方) — 大天守 = タイル(28644.4, 12997.1)
X0, X1, Y0, Y1 = 28639, 28648, 12992, 13001
mosaic('pale', 15, X0, X1, Y0, Y1, 'png').resize((1792, 1792), Image.LANCZOS).save(f'{OUT}/himeji_pale_z15_1792.webp', quality=70, method=6)
mosaic('seamlessphoto', 15, X0, X1, Y0, Y1, 'jpg').save(f'{OUT}/himeji_photo_z15.q75.webp', quality=75, method=6)
# 城〜駅 z17 6×11タイル (約1.5 km × 2.75 km)
CX0, CX1, CY0, CY1 = 114575, 114581, 51986, 51997
mosaic('pale', 17, CX0, CX1, CY0, CY1, 'png').save(f'{OUT}/himeji_pale_z17.webp', quality=70, method=6)
mosaic('seamlessphoto', 17, CX0, CX1, CY0, CY1, 'jpg').save(f'{OUT}/himeji_photo_z17.q75.webp', quality=75, method=6)
# 標高 (dem_png z14) → 192×192 グリッド (0.1 m 単位 uint16 LE, base64)
dem = mosaic('dem_png', 14, 14319, 14324, 6496, 6501, 'png')
a = np.asarray(dem).astype(np.int64); v = a[:, :, 0] * 65536 + a[:, :, 1] * 256 + a[:, :, 2]
h = np.where(v >= 2 ** 23, v - 2 ** 24, v) * 0.01
h = np.where((a[:, :, 0] == 128) & (a[:, :, 1] == 0) & (a[:, :, 2] == 0), 0, h)
crop = h[0:1152, 128:1280]; N = 192
g = np.clip(crop.reshape(N, 1152 // N, N, 1152 // N).mean(axis=(1, 3)), 0, None)
open(f'{OUT}/dem192.b64', 'w').write(base64.b64encode(np.round(g * 10).astype('<u2').tobytes()).decode())
print('done:', os.listdir(OUT))
