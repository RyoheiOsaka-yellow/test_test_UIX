#!/usr/bin/env python3
"""index.html の組み立て（src/ の断片 + SCENE_DATA）。build_scene.py から import されるほか、単体でも使える:
   python3 assemble.py <data_dir(scene_data.json, plateau.json, real.json)> <src_dir> <out.html>
   環境変数: EMBED_LIBS=0 で three.js/フォントを CDN 読込、EMBED_TILES=<dir> EMBED_OUT=<file> で埋め込み版、ARTIFACT_DIR=<dir> で多ファイル版"""
import os, sys, json, base64

def load_parts(SRC):
    order = json.load(open(os.path.join(SRC, 'build_order.json'), encoding='utf-8'))
    rd = lambda f: open(os.path.join(SRC, f), encoding='utf-8').read()
    head = rd(order['head'])
    core = rd(order['core'])
    mi = order['map_insert']; anchor = mi['after_anchor']
    assert core.count(anchor) == 1, 'map insert anchor not found'
    core = core.replace(anchor, anchor + rd(mi['file']))
    body = rd(order['config']) + '\n' + core + '\n' + rd(order['data_synthetic']) + '\n' + rd(order['sim']) + '\n'
    ui = rd(order['ui']); ia = order['init_anchor']
    assert ui.count(ia) == 1, 'init anchor not found'
    ui = ui.replace(ia, '\n'.join(rd(f) for f in order['before_init']) + '\n' + ia)
    return head, body + ui

def libs_head(head, embed, ASSETS):
    h = head
    if embed and os.path.isdir(ASSETS):
        rd = lambda f: open(os.path.join(ASSETS, f), encoding='utf-8').read()
        h = h.replace('<!--@FONTS-->', rd('fonts.css.html').rstrip('\n')).replace('<!--@LICENSES-->', rd('licenses.html').rstrip('\n'))
        h = h.replace('<!--@THREE-->', '<script>/**\n * @license\n * Copyright 2010-2021 Three.js Authors\n * SPDX-License-Identifier: MIT\n */\n' + rd('three.min.js') + '</script>')
    else:
        h = h.replace('<!--@FONTS-->', '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600&family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">')
        h = h.replace('<!--@LICENSES-->', '').replace('<!--@THREE-->', '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>')
    return h

def assemble(js, SRC, OUT):
    head, body = load_parts(SRC)
    ASSETS = os.environ.get('ASSETS_DIR', os.path.join(SRC, 'assets'))
    EMBED_LIBS = os.environ.get('EMBED_LIBS', '1') != '0'
    html = libs_head(head, EMBED_LIBS, ASSETS) + '\nconst SCENE_DATA = ' + js + ';\n' + body
    os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
    open(OUT, 'w', encoding='utf-8').write(html)
    print('wrote', OUT, len(html.encode('utf-8')), 'bytes')
    TILES = os.environ.get('EMBED_TILES')
    if TILES and os.path.isdir(TILES):
        td = {}
        for f in sorted(os.listdir(TILES)):
            if not f.endswith('.jpg') or os.path.getsize(os.path.join(TILES, f)) < 500: continue
            z, x, y = f[:-4].split('_')
            td[f'{z}/{x}/{y}'] = 'data:image/jpeg;base64,' + base64.b64encode(open(os.path.join(TILES, f), 'rb').read()).decode('ascii')
        tjs = 'const TILE_DATA = ' + json.dumps(td) + ';\n'
        h2 = libs_head(head, os.environ.get('EMBED_LIBS_ARTIFACT', '0') != '0', ASSETS)
        for tag in ('<!DOCTYPE html>', '<html lang="ja">', '<head>', '<meta charset="UTF-8">',
                    '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">', '</head>', '<body>'):
            h2 = h2.replace(tag + '\n', '').replace(tag, '')
        emb = (h2 + '\nconst SCENE_DATA = ' + js + ';\n' + tjs + body).replace('</body>\n</html>', '').rstrip() + '\n'
        out2 = os.environ.get('EMBED_OUT', OUT.replace('.html', '.embedded.html'))
        open(out2, 'w', encoding='utf-8').write(emb)
        print('wrote', out2, len(emb.encode('utf-8')), 'bytes', 'tiles', len(td))
        ADIR = os.environ.get('ARTIFACT_DIR')
        if ADIR:
            os.makedirs(os.path.join(ADIR, 'data'), exist_ok=True)
            open(os.path.join(ADIR, 'data', 'scene.js'), 'w', encoding='utf-8').write('window.SCENE_DATA_EXT = ' + js + ';\n')
            open(os.path.join(ADIR, 'data', 'tiles.js'), 'w', encoding='utf-8').write('window.TILE_DATA_EXT = ' + json.dumps(td) + ';\n')
            page = h2.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>', '<script src="data/scene.js"></script>\n<script src="data/tiles.js"></script>\n<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>', 1)
            page = (page + '\nconst SCENE_DATA = window.SCENE_DATA_EXT;\nconst TILE_DATA = window.TILE_DATA_EXT;\n' + body).replace('</body>\n</html>', '').rstrip() + '\n'
            open(os.path.join(ADIR, 'index.html'), 'w', encoding='utf-8').write(page)
            print('wrote artifact dir', ADIR, 'page', len(page.encode('utf-8')))

if __name__ == '__main__':
    DATA, SRC, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
    scene = json.load(open(os.path.join(DATA, 'scene_data.json'), encoding='utf-8'))
    for k, f in (('plateau', 'plateau.json'), ('real', 'real.json')):
        p = os.path.join(DATA, f)
        if os.path.exists(p):
            d = json.load(open(p, encoding='utf-8'))
            if k == 'plateau':
                scene['plateau'] = d; scene['buildings'] = [b for b in scene.get('buildings', []) if b.get('k') == 'castle']; scene['mid'] = []
            else:
                d.pop('bldg_h', None); scene['real'] = d
    assemble(json.dumps(scene, ensure_ascii=False, separators=(',', ':')), SRC, OUT)
