#!/usr/bin/env python3
"""実データ前処理: 地理院DEM5A（地形）・兵庫県DSM 1m（城郭レリーフ・点群・建物高さ）→ osm/real.json（base64 Int16 グリッド）
   座標系: 中心 (CLAT, CLON) からの m、x=東, y=北。"""
import json, math, os, sys, zipfile, base64, glob, io
import numpy as np, pyproj
from PIL import Image, ImageDraw

GEO = 'geo'; OSM = 'osm'
CLAT, CLON = 34.8380, 134.6915
MX = 111320 * math.cos(math.radians(CLAT)); MY = 110574
def proj(lat, lon): return (lon - CLON) * MX, (lat - CLAT) * MY

# ---------- DEM mosaic (z15, 3.92 m/px) ----------
meta = json.load(open(f'{GEO}/dem_meta.json')); DEM = np.load(f'{GEO}/dem_mosaic.npy')
z, x0, y0, n = meta['z'], meta['x0'], meta['y0'], meta['n']
def lonlat2px(lon, lat):
    tx = (lon + 180) / 360 * 2**z; ty = (1 - np.log(np.tan(np.radians(lat)) + 1 / np.cos(np.radians(lat))) / np.pi) / 2 * 2**z
    return (tx - x0) * 256, (ty - y0) * 256
def local2lonlat(x, y): return CLON + x / MX, CLAT + y / MY
def dem_at(x, y):
    """local meters -> DEM elevation (bilinear)"""
    lon, lat = local2lonlat(np.asarray(x, dtype=np.float64), np.asarray(y, dtype=np.float64))
    px, py = lonlat2px(lon, lat)
    px = np.clip(px, 0, DEM.shape[1] - 1.001); py = np.clip(py, 0, DEM.shape[0] - 1.001)
    i0 = np.floor(px).astype(int); j0 = np.floor(py).astype(int); fx = px - i0; fy = py - j0
    return (DEM[j0, i0] * (1 - fx) * (1 - fy) + DEM[j0, i0 + 1] * fx * (1 - fy) + DEM[j0 + 1, i0] * (1 - fx) * fy + DEM[j0 + 1, i0 + 1] * fx * fy)

def grid(x0_, x1_, y0_, y1_, step, fn):
    xs = np.arange(x0_, x1_ + 1e-6, step); ys = np.arange(y0_, y1_ + 1e-6, step)
    X, Y = np.meshgrid(xs, ys)
    return xs, ys, fn(X, Y)
def b64i16(arr, scale=10):
    a = np.clip(np.round(np.nan_to_num(arr, nan=-999) * scale), -32768, 32767).astype('<i2')
    return base64.b64encode(a.tobytes()).decode('ascii')
def b64u8(arr): return base64.b64encode(np.asarray(arr, dtype=np.uint8).tobytes()).decode('ascii')

out = {}
# 広域地形 40m / 中心部 8m
xs, ys, Hw = grid(-6600, 6600, -6600, 6600, 40, dem_at)
out['terrain_wide'] = {'x0': -6600, 'y0': -6600, 'step': 40, 'nx': len(xs), 'ny': len(ys), 'h': b64i16(Hw)}
xs, ys, Hi = grid(-1500, 1500, -1700, 1300, 8, dem_at)
out['terrain_inner'] = {'x0': -1500, 'y0': -1700, 'step': 8, 'nx': len(xs), 'ny': len(ys), 'h': b64i16(Hi)}
print('terrain wide', Hw.shape, 'inner', Hi.shape, 'range', Hw.min(), Hw.max())

# ---------- DSM 1m (兵庫県) ----------
tr = pyproj.Transformer.from_crs('EPSG:6673', 'EPSG:4326', always_xy=True)
CORE = (-1000, -1500, 1050, 700)   # x0,y0,x1,y1 (m) 点群・建物高さの対象
DSM = {}   # dict[(ix,iy)] -> z at 1m grid over CORE (as array)
W = CORE[2] - CORE[0] + 1; Hh = CORE[3] - CORE[1] + 1
D = np.full((Hh, W), np.nan, dtype=np.float32)
for zf in sorted(glob.glob(f'{GEO}/dsm/*.zip')):
    zz = zipfile.ZipFile(zf)
    for info in zz.infolist():
        with zz.open(info) as f:
            head = f.readline().decode().split()
        e0, n0 = float(head[0]), float(head[1]); lon, lat = tr.transform(e0, n0); lx, ly = proj(lat, lon)
        # ファイル範囲（約1.25km×1km）が CORE と交差するか粗判定
        if lx < CORE[0] - 1500 or lx > CORE[2] + 1500 or ly > CORE[3] + 1500 or ly < CORE[1] - 1500:
            print('skip', info.filename, round(lx), round(ly)); continue
        print('load', info.filename, round(lx), round(ly), flush=True)
        with zz.open(info) as f:
            arr = np.loadtxt(io.TextIOWrapper(f, encoding='ascii'), dtype=np.float64)
        lon, lat = tr.transform(arr[:, 0], arr[:, 1]); lx, ly = proj(lat, lon)
        ix = np.round(lx - CORE[0]).astype(int); iy = np.round(ly - CORE[1]).astype(int)
        m = (ix >= 0) & (ix < W) & (iy >= 0) & (iy < Hh)
        D[iy[m], ix[m]] = arr[m, 2]
print('DSM core coverage', 1 - np.isnan(D).mean())
np.save(f'{GEO}/dsm_core.npy', D)
# nDSM
XX, YY = np.meshgrid(np.arange(CORE[0], CORE[2] + 1), np.arange(CORE[1], CORE[3] + 1))
G = dem_at(XX, YY); ND = D - G

# ---------- 建物・水域ポリゴンをラスタ化（クラス分け・高さ推定用） ----------
scene = json.load(open(f'{OSM}/scene_data.json'))
def rasterize(polys, val, img):
    dr = ImageDraw.Draw(img)
    for p in polys:
        pts = [(x - CORE[0], y - CORE[1]) for x, y in p]
        if len(pts) >= 3: dr.polygon(pts, fill=val)
cls = Image.new('L', (W, Hh), 0)   # 0 ground
rasterize(scene['lu']['water'] + scene['lu']['moat'], 3, cls)
ids = Image.new('I', (W, Hh), 0)
dr = ImageDraw.Draw(ids); dr2 = ImageDraw.Draw(cls)
for i, b in enumerate(scene['buildings']):
    pts = [(x - CORE[0], y - CORE[1]) for x, y in b['p']]
    if len(pts) >= 3: dr.polygon(pts, fill=i + 1); dr2.polygon(pts, fill=1)
for p in scene['mid']:
    pts = [(x - CORE[0], y - CORE[1]) for x, y in p]
    if len(pts) >= 3: dr2.polygon(pts, fill=1)
CLS = np.array(cls); IDS = np.array(ids)
veg = (CLS == 0) & (ND >= 2.0); CLS[veg] = 2
# 建物高さ: フットプリント内 nDSM の 80パーセンタイル
heights = {}
flat = IDS.ravel(); nd = ND.ravel()
order = np.argsort(flat); sf = flat[order]; sn = nd[order]
starts = np.searchsorted(sf, np.arange(1, len(scene['buildings']) + 1)); ends = np.searchsorted(sf, np.arange(1, len(scene['buildings']) + 1), side='right')
n_ok = 0
for i, (s, e) in enumerate(zip(starts, ends)):
    v = sn[s:e]; v = v[~np.isnan(v)]
    if len(v) >= 6:
        h = float(np.percentile(v, 80))
        if 2.5 <= h <= 130: heights[i] = round(h, 1); n_ok += 1
print('building heights from DSM', n_ok, '/', len(scene['buildings']))
out['bldg_h'] = heights

# ---------- 城郭レリーフ（2m）と 点群（3m）----------
def sub(x0_, x1_, y0_, y1_, step):
    sx = slice(x0_ - CORE[0], x1_ - CORE[0] + 1, step); sy = slice(y0_ - CORE[1], y1_ - CORE[1] + 1, step)
    return sx, sy
CAST = (-380, 560, -340, 560)
sx, sy = sub(CAST[0], CAST[1], CAST[2], CAST[3], 2)
Dc = D[sy, sx]; Nc = ND[sy, sx]; Cc = CLS[sy, sx]
# 欠損は DEM で補完
Dc = np.where(np.isnan(Dc), G[sy, sx], Dc)
out['castle'] = {'x0': CAST[0], 'y0': CAST[2], 'step': 2, 'nx': Dc.shape[1], 'ny': Dc.shape[0], 'h': b64i16(Dc), 'nd': b64i16(np.nan_to_num(Nc, nan=0)), 'c': b64u8(Cc)}
print('castle grid', Dc.shape, 'keep top', np.nanmax(Dc[(sy.start+ (165-CAST[2])//2 - 20):(sy.start+(165-CAST[2])//2+20), :] if False else Dc))
PC = (-900, 900, -1450, 700)
sx, sy = sub(PC[0], PC[1], PC[2], PC[3], 3)
Dp = D[sy, sx]; Np = ND[sy, sx]; Cp = CLS[sy, sx]
valid = ~np.isnan(Dp)
out['pc'] = {'x0': PC[0], 'y0': PC[2], 'step': 3, 'nx': Dp.shape[1], 'ny': Dp.shape[0], 'h': b64i16(Dp), 'nd': b64i16(np.nan_to_num(Np, nan=0)), 'c': b64u8(Cp), 'valid': int(valid.sum())}
print('pointcloud grid', Dp.shape, 'valid', valid.sum())
# 大天守付近の DSM 断面（素屋根期でないか確認）
kx, ky = 215, 165
prof = D[ky - CORE[1], (kx - 40 - CORE[0]):(kx + 41 - CORE[0])]
print('keep profile E-W (DSM):', np.round(prof[::4], 1).tolist())
json.dump(out, open(f'{OSM}/real.json', 'w'))
print('wrote real.json', os.path.getsize(f'{OSM}/real.json'))
