#!/usr/bin/env python3
"""検証用の STEP を作る（CadQuery / OpenCASCADE）。ANGLEX とは別の CAD カーネルで、鋼材の立体（隅の丸み・穴・長穴つき）を
ばらばらの位置と向きに置いて 1 つの STEP にまとめる。dev/flows/ux21.js が「立体 → 部材」の自動変換の確認に使う。
準備: pip install cadquery     実行: python dev/samples/make_steel_step.py dev/samples/steel"""
import sys, json, math
import cadquery as cq

out = sys.argv[1] if len(sys.argv) > 1 else '.'

def angle(A, B, t, L, r1=6.5, r2=4.5):
    pts = [(0, 0), (A, 0), (A, t), (t, t), (t, B), (0, B)]
    w = cq.Workplane('XY').polyline(pts).close().extrude(L)
    w = w.edges(cq.selectors.BoxSelector((t - 0.1, t - 0.1, -1), (t + 0.1, t + 0.1, L + 1))).fillet(r1)          # 根元の丸み
    w = w.edges(cq.selectors.BoxSelector((A - 0.1, t - 0.1, -1), (A + 0.1, t + 0.1, L + 1))).fillet(r2)          # 脚先の丸み
    w = w.edges(cq.selectors.BoxSelector((t - 0.1, B - 0.1, -1), (t + 0.1, B + 0.1, L + 1))).fillet(r2)
    return w

def channel(H, B, t1, t2, L):
    pts = [(0, 0), (B, 0), (B, t2), (t1, t2), (t1, H - t2), (B, H - t2), (B, H), (0, H)]
    return cq.Workplane('XY').polyline(pts).close().extrude(L)

def hole_y(w, x, z, d, depth=40):      # 面 y = 0（水平脚・平鋼の面）を貫く丸穴
    return w.cut(cq.Workplane('XZ').center(x, z).circle(d / 2).extrude(-depth).translate((0, -1, 0)))

def slot_y(w, x, z, d, length, depth=40):   # 面 y = 0 を貫く長穴（長さ方向 z）
    return w.cut(cq.Workplane('XZ').center(x, z).slot2D(length, d, 90).extrude(-depth).translate((0, -1, 0)))

def hole_x(w, y, z, d, depth=40):      # 面 x = 0（垂直脚・ウェブ）を貫く丸穴
    return w.cut(cq.Workplane('YZ').center(y, z).circle(d / 2).extrude(depth).translate((-1, 0, 0)))

items = []
# 1) 山形鋼 L-50x50x6 L=600: 水平脚に φ15 × 2、垂直脚に長穴 11×25
a = angle(50, 50, 6, 600); a = hole_y(a, 25, 50, 15); a = hole_y(a, 25, 550, 15); a = hole_x(a, 30, 300, 11)
a = a.cut(cq.Workplane('YZ').center(30, 150).slot2D(25, 11, 90).extrude(40).translate((-1, 0, 0)))
items.append(('L-50x50x6', 600, [('A', 50, 25, 15, None), ('A', 550, 25, 15, None), ('B', 300, 30, 11, None), ('B', 150, 30, 11, 25)], a, (0, 0, 0), (0, 0, 1), 0))
# 2) 溝形鋼 [-75x40x5x7 L=500: ウェブに φ12 × 2
c = channel(75, 40, 5, 7, 500); c = hole_x(c, 37.5, 100, 12); c = hole_x(c, 37.5, 400, 12)
items.append(('[-75x40x5x7', 500, [('web', 100, 37.5, 12, None), ('web', 400, 37.5, 12, None)], c, (300, 100, 0), (1, 0, 0), 90))
# 3) 平鋼 FB-6x50 L=300: 穴なし（斜めに配置）
f = cq.Workplane('XY').rect(50, 6, centered=False).extrude(300)
items.append(('FB-6x50', 300, [], f, (-200, 300, 150), (0, 1, 0), 35))
# 4) 板 PL-9x150x150: φ15 × 4（アンカー穴）
p = cq.Workplane('XY').rect(150, 9, centered=False).extrude(150)
for (x, z) in [(25, 25), (125, 25), (25, 125), (125, 125)]: p = hole_y(p, x, z, 15)
items.append(('PL-9x150x150', 150, [('face', 25, 25, 15, None), ('face', 25, 125, 15, None), ('face', 125, 25, 15, None), ('face', 125, 125, 15, None)], p, (600, -200, 50), (0, 0, 1), 20))
# 5) 角パイプ □-50x50x2.3 L=400
s = cq.Workplane('XY').rect(50, 50, centered=False).extrude(400).cut(cq.Workplane('XY').rect(50 - 4.6, 50 - 4.6, centered=False).extrude(400).translate((2.3, 2.3, 0)))
items.append(('□-50x50x2.3', 400, [], s, (-400, -300, 0), (1, 1, 0), 60))
# 6) 鋼管 φ60.5x3.2 L=350
t = cq.Workplane('XY').circle(60.5 / 2).circle(60.5 / 2 - 3.2).extrude(350)
items.append(('STK-60.5x3.2', 350, [], t, (200, 400, 300), (1, 0, 1), 45))

asm = cq.Assembly()
expected = []
for i, (spec, L, holes, w, pos, axis, deg) in enumerate(items):
    w2 = w.rotate((0, 0, 0), axis, deg).translate(pos)
    asm.add(w2, name=f'part{i + 1}')
    expected.append({'spec': spec, 'length': L, 'holes': [{'face': f, 'z': z, 's': s_, 'd': d, 'slot': sl} for (f, z, s_, d, sl) in holes]})
asm.save(f'{out}/steel_set.step')
cq.exporters.export(items[0][3].rotate((0, 0, 0), (0, 1, 0), 30).translate((100, 50, 20)), f'{out}/angle_only.step')
cq.exporters.export(items[0][3].rotate((0, 0, 0), (0, 1, 0), 30).translate((100, 50, 20)), f'{out}/angle_only.stl', tolerance=0.02, angularTolerance=0.1)
json.dump(expected, open(f'{out}/expected.json', 'w'), ensure_ascii=False, indent=1)
print('wrote', len(items), 'solids')
