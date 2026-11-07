"""Parametric CAD model of the active wheelchair (CadQuery / OpenCascade).
Coordinates: X forward, Y lateral (+Y = left), Z up, ground z = 0, mm.
Outputs: out/model.json (tessellated parts + mass properties) and out/wheelchair_assembly.step
"""
import math, json, time, sys, os
import cadquery as cq
from cadquery import Vector as V
from cadlib import *

P = dict(seatWidth=400, seatDepth=420, seatHeightF=480, seatHeightR=440, wheelInch=24, camber=3.0, backH=380, casterInch=5, axleOffset=0)
if '--params' in sys.argv:   # JSON exported from the dashboard (設計 → CAD 再生成パラメータを書き出し)
    pj = json.load(open(sys.argv[sys.argv.index('--params') + 1], encoding='utf-8'))
    P.update({k: float(v) for k, v in (pj.get('params', pj)).items() if k in P})
    print('params override:', P)
sw, sd, shf, shr = P['seatWidth'], P['seatDepth'], P['seatHeightF'], P['seatHeightR']
Rw, cr = P['wheelInch'] * 25.4 / 2, P['casterInch'] * 25.4 / 2
yr, xf, xr = sw / 2 + 12, sd / 2, -sd / 2
ax, yw, cx, cyc = -sd / 2 + 45 + P['axleOffset'], sw / 2 + 72, sd / 2 + 70, sw / 2 - 32
cam = P['camber']; bh = P['backH']
RO, RI = 16.0, 14.2
S = (1, -1)
T0 = time.time()

MATERIALS = {
  'アルミ 7005':{'d':2.78,'cls':'metal'},'アルミ 6061':{'d':2.70,'cls':'metal'},'チタン Ti-6Al-4V':{'d':4.43,'cls':'metal'},'SUS304':{'d':7.93,'cls':'metal'},
  '軸受鋼 SUJ2':{'d':7.80,'cls':'metal'},'黄銅 C3604':{'d':8.50,'cls':'metal'},'CFRP':{'d':1.55,'cls':'composite'},'ナイロン 66':{'d':1.14,'cls':'plastic'},
  'ABS':{'d':1.05,'cls':'plastic'},'ポリウレタン (ソリッド)':{'d':1.20,'cls':'elastomer'},'ゴム (タイヤケーシング)':{'d':1.10,'cls':'elastomer'},
  'ブチルゴム':{'d':0.95,'cls':'elastomer'},'ゴム (グリップ)':{'d':1.10,'cls':'elastomer'},'ポリエステル布':{'d':0.60,'cls':'textile'},'ウレタンフォーム':{'d':0.06,'cls':'foam'}
}
GROUPS = [('A1','駆動輪 Assy','#3aa0d8'),('A2','フレーム Assy','#e39b2c'),('A3','シート Assy','#8b5cd6'),('A4','走行安全部品','#3fae6a')]
PARTS = []   # dicts: id, name, en, group, mat, mb, color, tool, inst:[(solid, ex)]
import re
FASTENER = re.compile('ボルト|ナット|ピン|ニップル|リベット')
def part(id, name, en, group, mat, mb, color, tool, inst, shell=False, qty=None, alt=False):
    PARTS.append(dict(id=id, name=name, en=en, group=group, mat=mat, mb=mb, color=color, tool=tool, inst=inst, shell=shell, qty=qty or len(inst), alt=alt, fastener=bool(FASTENER.search(name))))
    print(f'{id:6} {name:18} x{len(inst):<3} {sum(s.Volume() for s,_ in inst)/1000:8.1f} cm3  {time.time()-T0:5.1f}s', flush=True)

def side(solid, s, local_y=0.0):
    """Wheel-local (axis = +Y, centre at origin) -> world: mirror for s<0, camber, translate to hub."""
    sol = solid.val() if isinstance(solid, cq.Workplane) else solid
    if s < 0: sol = sol.mirror("XZ")
    sol = sol.rotate(V(0,0,0), V(1,0,0), s * cam)
    return sol.translate(V(ax, s * yw, Rw))
def exv(x, y, z): return (x, y, z)

# ───────── A1 駆動輪 Assy ─────────
# hub: revolve about Y (lateral). Profile in XY workplane: local x = radial, local y = axial
hub_prof = [(12,-30),(22,-30),(22,-24),(42,-24),(42,-20),(26,-20),(26,20),(42,20),(42,24),(22,24),(22,30),(12,30)]
hub = cq.Workplane("XY").polyline(hub_prof).close().revolve(360,(0,0,0),(0,1,0))
for yy in (-22, 22):
    hub = hub.cut(cq.Workplane("XZ").workplane(offset=-yy-3).polarArray(36, 0, 360, 12).circle(1.3).extrude(6))
hub_s = hub.val()
rim_prof = [(268,-11),(282,-11),(282,-4),(276,-4),(276,4),(282,4),(282,11),(268,11)]
rim = cq.Workplane("XY").polyline(rim_prof).close().revolve(360,(0,0,0),(0,1,0))
rim = rim.cut(cq.Workplane("XY").polyline([(269.5,-9.5),(280.5,-9.5),(280.5,-5.5),(274.5,-5.5),(274.5,5.5),(280.5,5.5),(280.5,9.5),(269.5,9.5)]).close().revolve(360,(0,0,0),(0,1,0)))
rim_s = rim.val()
spokes, nipples = [], []
for i in range(24):
    a = i / 24 * 2 * math.pi; yh = 22 if i % 2 else -22
    ah = a; ar = a + math.radians(12)   # tangential lacing offset
    p_h = V(36*math.cos(ah), yh, 36*math.sin(ah)); p_r = V(270*math.cos(ar), yh*0.25, 270*math.sin(ar))
    spokes.append(straight_tube(p_h.toTuple(), p_r.toTuple(), 1.0).val())
    d = (p_r - p_h).normalized(); pn = p_r - d * 2
    nipples.append(straight_tube(pn.toTuple(), (pn + d * 12).toTuple(), 2.5).val())
tire_s = cq.Workplane("XY").moveTo(Rw-13.5+13, 0).circle(13).circle(10.5).revolve(360,(0,0,0),(0,1,0)).val() if False else None
tire = cq.Workplane("XY").center(Rw-13.5, 0).circle(13).revolve(360,(-(Rw-13.5),0,0),(-(Rw-13.5),1,0))
tire = tire.cut(cq.Workplane("XY").center(Rw-13.5, 0).circle(10.5).revolve(360,(-(Rw-13.5),0,0),(-(Rw-13.5),1,0)))
tire_s = tire.val()
itube = cq.Workplane("XY").center(Rw-13.5, 0).circle(10).revolve(360,(-(Rw-13.5),0,0),(-(Rw-13.5),1,0))
itube = itube.cut(cq.Workplane("XY").center(Rw-13.5, 0).circle(9).revolve(360,(-(Rw-13.5),0,0),(-(Rw-13.5),1,0))).val()
hr = Rw - 50
hrim = cq.Workplane("XY").center(hr, 36).circle(9.5).revolve(360,(-hr,0,0),(-hr,1,0))
hrim = hrim.cut(cq.Workplane("XY").center(hr, 36).circle(8).revolve(360,(-hr,0,0),(-hr,1,0))).val()
standoffs, hbolts = [], []
for i in range(6):
    a = i / 6 * 2 * math.pi + 0.26; c, s_ = math.cos(a), math.sin(a)
    standoffs.append(place(cq.Workplane("XY").circle(5).extrude(26), (275*c, 10, 275*s_), ROT_Z_TO_Y))
    hbolts.append(place(socket_cap(5, 40), (275*c, 44, 275*s_), [((1,0,0),90)]))
qr_axle = cq.Workplane("XY").circle(6.35).extrude(150).faces(">Z").workplane().circle(7.5).extrude(6)
qr_axle = qr_axle.cut(cq.Workplane("XY").workplane(offset=20).circle(6.35).circle(5.2).extrude(3)).val()
qr_axle = place(qr_axle, (0, -80, 0), ROT_Z_TO_Y)   # from inner end (-80) to outer (+76)
qr_nut = place(hex_nut(12, 19, 8), (0, -88, 0), ROT_Z_TO_Y)
bearings = [place(cq.Workplane("XY").circle(14).circle(6.35).extrude(8), (0, y, 0), ROT_Z_TO_Y) for y in (-30, 22)]

def wheel_part(id, seq_name, en, mat, mb, color, tool, solids, dist, group='A1'):
    inst = []
    for s in S:
        for sol in solids: inst.append((side(sol, s), exv(0, s*dist, 0)))
    part(id, seq_name, en, group, mat, mb, color, tool, inst)
wheel_part('P-110','クイックリリースアクスル','Quick-release Axle 1/2" × 150','チタン Ti-6Al-4V','buy','#c7cdd6','QR ボタン押下',[qr_axle],760)
wheel_part('P-111','アクスル調整ナット','Axle Adjustment Nut M12','SUS304','buy','#9aa3ae','スパナ 19 mm',[qr_nut],900)
wheel_part('P-109','ハンドリム取付ボルト M5×40','Handrim Bolt M5×40','SUS304','buy','#b9c1cc','六角レンチ 4 mm',hbolts,820)
wheel_part('P-108','ハンドリムスタンドオフ','Handrim Standoff φ10×26','アルミ 6061','make','#4a4f57','手作業',standoffs,740)
wheel_part('P-107','ハンドリム','Handrim φ19 (anodized)','アルミ 6061','buy','#2e3238','手作業',[hrim],660)
wheel_part('P-105','タイヤ 24×1','Tire 24×1" casing','ゴム (タイヤケーシング)','buy','#34373d','タイヤレバー',[tire_s],560)
wheel_part('P-106','インナーチューブ','Inner Tube 24×1"','ブチルゴム','buy','#1b1c1f','手作業',[itube],500)
wheel_part('P-104','ニップル 14G','Spoke Nipple 14G','黄銅 C3604','buy','#b08d3c','ニップルレンチ',nipples,430)
wheel_part('P-103','スポーク 14G','Spoke 14G (2.0 mm)','SUS304','buy','#c9cfd8','ニップルレンチ',spokes,380)
wheel_part('P-102','リム 24"','Rim 24" double-wall','アルミ 6061','buy','#1f2226','手作業',[rim_s],320)
wheel_part('P-101','ハブ','Hub (flanged, 24H)','アルミ 6061','make','#2a2d33','手作業',[hub_s],260)
wheel_part('P-112','ハブベアリング 6001','Hub Bearing 6001-2RS','軸受鋼 SUJ2','buy','#8a929e','ベアリングプーラー',bearings,200)

# ───────── A2 フレーム Assy ─────────
frame_solids = []
for s in S:
    y = s * yr
    frame_solids.append(bent_tube([(cx, s*cyc, cr+55),(cx, s*cyc, 200),(xf, y, shf),(xr, y, shr),(ax, s*(yr+10), Rw+25)], RO, RI).val())
    frame_solids.append(straight_tube((xf, y, shf), (xf+150, s*(sw/2-45), 135), RO, RI).val())
frame_solids.append(straight_tube((ax, -(yr+10), Rw+25), (ax, yr+10, Rw+25), RO, RI).val())
yAt = lambda x: shr + (shf-shr)*(x-xr)/(xf-xr)
for x in (xr+50, xf-70): frame_solids.append(straight_tube((x, -yr, yAt(x)-2), (x, yr, yAt(x)-2), 13, 11).val())
frame_solids.append(straight_tube((xf+160, -(sw/2-45), 120), (xf+160, sw/2-45, 120), 13, 11).val())
part('P-201','メインフレーム (リジッド)','Rigid Main Frame φ32 t1.8 bent tube','A2','アルミ 7005','make','#25282d','—',[(f,(0,0,0)) for f in frame_solids],shell=True,qty=1)

plate = cq.Workplane("XZ").rect(64,112).extrude(-8).edges("|Y").fillet(6)
plate = plate.faces(">Y").workplane().slot2D(60,10,90).cutThruAll()
plate = plate.faces(">Y").workplane().rect(40,80,forConstruction=True).vertices().hole(8.5)
plate_s = plate.val()
inst=[]; bolts=[]; nuts=[]
for s in S:
    y = s*(yr+24); inst.append((plate_s.translate(V(ax, y, Rw+8)), exv(0, s*90, -160)))
    for dx,dz in ((-20,-40),(20,-40),(-20,40),(20,40)):
        bolts.append((place(hex_bolt(8,25), (ax+dx, s*(yr+30), Rw+8+dz), [((1,0,0),-90*s)]), exv(0, s*130, -160)))
        nuts.append((place(hex_nut(8), (ax+dx, s*(yr+10), Rw+8+dz), [((1,0,0),-90*s)]), exv(0, s*150, -160)))
part('P-202','アクスルプレート','Axle Plate (camber adjust, slotted)','A2','アルミ 7005','make','#33363c','六角レンチ 6 mm',inst)
part('P-203','六角ボルト M8×25','Hex Bolt M8×25','A2','SUS304','buy','#b9c1cc','スパナ 13 mm',bolts)
part('P-204','六角ナット M8','Hex Nut M8','A2','SUS304','buy','#aab2bd','スパナ 13 mm',nuts)

bk_solids=[]
for s in S:
    y=s*yr; bk_solids.append(bent_tube([(xr-12, y, shr),(xr-40, y, shr+bh),(xr-40, y*0.999, shr+bh)], 14, 12.2).val() if False else straight_tube((xr-12,y,shr),(xr-40,y,shr+bh),14,12.2).val())
bk_solids.append(straight_tube((xr-40,-yr,shr+bh),(xr-40,yr,shr+bh),12,10.2).val())
part('P-205','バックレストフレーム','Folding Backrest Frame','A2','アルミ 7005','make','#2a2d33','手作業 (折りたたみヒンジ)',[(b,(-270,0,170)) for b in bk_solids],qty=1)
part('P-206','バックレストヒンジピン','Backrest Hinge Pin φ10','A2','SUS304','buy','#c9cfd8','手作業',[(place(cq.Workplane("XY").circle(5).extrude(50).faces(">Z").workplane().circle(8).extrude(3),(xr-12,s*(yr+28),shr+8),[((1,0,0),90*s)]),exv(0,s*150,0)) for s in S])
lever = cq.Workplane("XY").rect(48,14).extrude(8).edges("|Z").fillet(6).union(cq.Workplane("XY").center(-18,0).circle(6).extrude(-14)).val()
part('P-207','QR 折りたたみレバー','Quick-release Folding Lever','A2','アルミ 6061','buy','#3a3e45','手作業',[(place(lever,(xr-28,s*(yr+22),shr+22)),exv(-300,s*60,300)) for s in S])
part('P-208','プッシュハンドル','Push Handle (removable)','A2','アルミ 6061','make','#33363c','手作業 (QR レバー)',[(bent_tube([(xr-40,s*yr,shr+bh),(xr-100,s*yr,shr+bh+4),(xr-150,s*yr,shr+bh+10)],13.5,11.5).val(),exv(-420,0,220)) for s in S])
grip = cq.Workplane("XY").circle(16).circle(12.5).extrude(95).val()
part('P-209','ハンドルグリップ','Handle Grip (rubber)','A2','ゴム (グリップ)','buy','#1e2024','手作業',[(place(grip,(xr-55,s*yr,shr+bh+3),[((0,1,0),-96)]),exv(-480,0,240)) for s in S])

fork = cq.Workplane("XY").rect(36,50).extrude(12).edges("|Z").fillet(8)
fork = fork.union(cq.Workplane("XY").circle(9).extrude(-6))
for yy in (-19, 19):
    arm = cq.Workplane("XZ").workplane(offset=-yy).center(12,-(cr+8)/2+6).rect(12,cr+20).extrude(-6 if yy>0 else 6).edges("|Y").fillet(5)
    fork = fork.union(arm)
fork_s = fork.val()
cw_prof=[(12,-11),(cr-6,-11),(cr,-7),(cr,7),(cr-6,11),(12,11)]
cwheel = cq.Workplane("XY").polyline(cw_prof).close().revolve(360,(0,0,0),(0,1,0)).val()
inst_f=[];inst_w=[];inst_b=[];inst_n=[];inst_cb=[];inst_sb=[];inst_sn=[];inst_sbear=[]
for s in S:
    yc=s*cyc; fx=cx; fz=cr+50
    inst_f.append((place(fork_s,(fx,yc,fz)),exv(150,s*90,-30)))
    inst_w.append((place(cwheel,(fx+20,yc,cr)),exv(200,s*120,-110)))
    for yy in (-6,6): inst_cb.append((place(cq.Workplane("XY").circle(11).circle(4).extrude(7),(fx+20,yc+yy*0+ (yy*1.0),cr),ROT_Z_TO_Y),exv(200,s*135,-110)))
    inst_b.append((place(hex_bolt(8,45),(fx+20,yc-26,cr),[((1,0,0),-90)]),exv(200,s*150,-110)))
    inst_n.append((place(hex_nut(8),(fx+20,yc+20,cr),[((1,0,0),-90)]),exv(200,s*170,-110)))
    inst_sb.append((place(hex_bolt(12,110,8,19),(fx,yc,fz+10),[]),exv(150,s*90,150)))
    inst_sn.append((place(hex_nut(12,19,10),(fx,yc,fz+118)),exv(150,s*90,190)))
    for zz in (fz+20,fz+100): inst_sbear.append((place(cq.Workplane("XY").circle(14).circle(6).extrude(8),(fx,yc,zz)),exv(150,s*90,100)))
part('P-210','キャスターフォーク','Caster Fork (aluminium)','A2','アルミ 6061','buy','#2b2e34','スパナ 19 mm',inst_f)
part('P-211','キャスターステムボルト M12×110','Caster Stem Bolt M12×110','A2','SUS304','buy','#b9c1cc','スパナ 19 mm',inst_sb)
part('P-212','ステムナット M12','Stem Nut M12 nyloc','A2','SUS304','buy','#aab2bd','スパナ 19 mm',inst_sn)
part('P-217','ステムベアリング 6001','Stem Bearing 6001-2RS','A2','軸受鋼 SUJ2','buy','#8a929e','ベアリングプーラー',inst_sbear)
part('P-213','キャスターホイール 5"','Caster Wheel 5" PU','A2','ポリウレタン (ソリッド)','buy','#1a1c20','スパナ 13 mm',inst_w)
part('P-216','キャスターベアリング 608','Caster Bearing 608-2RS','A2','軸受鋼 SUJ2','buy','#8a929e','ベアリングプーラー',inst_cb)
part('P-214','キャスターアクスルボルト M8×45','Caster Axle Bolt M8×45','A2','SUS304','buy','#b9c1cc','スパナ 13 mm',inst_b)
part('P-215','六角ナット M8 (キャスター)','Hex Nut M8 nyloc','A2','SUS304','buy','#aab2bd','スパナ 13 mm',inst_n)

fp = cq.Workplane("XY").rect(150, sw-70).extrude(4).edges("|Z").fillet(10)
fp = fp.faces(">Z").workplane().pushPoints([(0,(sw-70)/2-30),(0,-(sw-70)/2+30)]).slot2D(60,8).cutThruAll()
fp = fp.union(cq.Workplane("XY").center(0,(sw-70)/2-2).rect(150,4).extrude(12)).union(cq.Workplane("XY").center(0,-(sw-70)/2+2).rect(150,4).extrude(12)).val()
part('P-218','フットプレート','Footplate (one-piece, slotted)','A2','アルミ 6061','make','#2f3237','六角レンチ 5 mm',[(place(fp,(xf+178,0,100),[((0,1,0),10)]),exv(230,0,-40))])
clamp = cq.Workplane("XY").circle(20).circle(16.2).extrude(24).union(cq.Workplane("XY").center(24,0).rect(20,14).extrude(24)).val()
inst_c=[];inst_cbt=[];inst_cn=[]
for s in S:
    y=s*(sw/2-45); inst_c.append((place(clamp,(xf+160,y,122),ROT_Z_TO_Y),exv(260,0,-40)))
    inst_cbt.append((place(hex_bolt(6,30),(xf+184,y+12*s,122),[((1,0,0),90*s)]),exv(300,0,-40)))
    inst_cn.append((place(hex_nut(6),(xf+184,y-12*s,122),[((1,0,0),90*s)]),exv(340,0,-40)))
part('P-219','フットプレートクランプ','Footplate Clamp','A2','アルミ 6061','make','#3a3e45','六角レンチ 5 mm',inst_c)
part('P-220','六角ボルト M6×30','Hex Bolt M6×30','A2','SUS304','buy','#b9c1cc','スパナ 10 mm',inst_cbt)
part('P-221','六角ナット M6','Hex Nut M6','A2','SUS304','buy','#aab2bd','スパナ 10 mm',inst_cn)
sg = cq.Workplane("XZ").rect(250,175).extrude(-3).edges("|Y").fillet(20).faces(">Y").workplane().pushPoints([(-90,-60),(90,-60)]).hole(6.5).val()
part('P-222','サイドガード','Side Guard (CFRP)','A2','CFRP','buy','#1c1e22','六角レンチ 4 mm',[(sg.translate(V(ax+40,s*(yr+32),shr+65)),exv(0,s*70,230)) for s in S])
part('P-223','サイドガード取付ボルト M6×16','Side Guard Bolt M6×16','A2','SUS304','buy','#b9c1cc','六角レンチ 4 mm',[(place(socket_cap(6,16),(ax+40+dx,s*(yr+36),shr+5),[((1,0,0),90*s)]),exv(0,s*120,230)) for s in S for dx in (-90,90)])
cap = cq.Workplane("XY").circle(16).extrude(6).faces(">Z").workplane().circle(14).extrude(14).val()
part('P-224','チューブエンドキャップ','Tube End Cap (ABS)','A2','ABS','buy','#1e2024','手作業',[(place(cap,(ax,s*(yr+16),Rw+25),[((1,0,0),90*s)]),exv(0,s*120,-60)) for s in S])

# ───────── A3 シート Assy ─────────
slope = math.degrees(math.atan2(shf-shr, sd)); zmid=(shf+shr)/2
cush = cq.Workplane("XY").rect(sd-30, sw-10).extrude(50).edges("|Z").fillet(15).edges(">Z").fillet(8)
cush = cush.cut(cq.Workplane("XY").workplane(offset=50).center(-40,0).rect(sd-120,sw-80).extrude(-6).edges("|Z").fillet(30)).val()
part('P-301','シートクッション','Seat Cushion (contoured foam)','A3','ウレタンフォーム','buy','#26282c','手作業 (面ファスナー)',[(place(cush,(0,0,zmid+8),[((0,1,0),-slope)]),exv(0,0,300))])
sling = cq.Workplane("XY").rect(sd-40, sw+24).extrude(3).edges("|Z").fillet(8).val()
part('P-303','シートスリング','Seat Sling (tension adjustable)','A3','ポリエステル布','buy','#232529','六角レンチ 3 mm',[(place(sling,(0,0,zmid+4),[((0,1,0),-slope)]),exv(0,0,180))])
strap = cq.Workplane("XY").rect(60,25).extrude(3).val()
inst_s=[];inst_sb2=[]
for s in S:
    for x in (xr+80, xf-80):
        inst_s.append((place(strap,(x,s*yr,yAt(x)-19)),exv(0,0,220)))
        for dx in (-20,20): inst_sb2.append((place(socket_cap(5,10),(x+dx,s*yr,yAt(x)-30),[((1,0,0),180)]),exv(0,0,260)))
part('P-304','スリング固定ストラップ','Sling Retention Strap','A3','ナイロン 66','buy','#2a2d33','六角レンチ 3 mm',inst_s)
part('P-305','ストラップボルト M5×10','Strap Bolt M5×10','A3','SUS304','buy','#b9c1cc','六角レンチ 3 mm',inst_sb2)
bup = cq.Workplane("YZ").rect(sw+16, bh-90).extrude(4).edges("|X").fillet(10).val()
part('P-306','バックレスト張地','Backrest Upholstery','A3','ポリエステル布','buy','#2b2e33','手作業 (面ファスナー)',[(place(bup,(xr-30,0,shr+bh*0.52),[((0,1,0),-6)]),exv(-170,0,120))])
tstrap = cq.Workplane("YZ").rect(sw+30, 25).extrude(2).val()
part('P-307','張地テンションストラップ','Upholstery Tension Strap','A3','ナイロン 66','buy','#3a3e45','手作業 (面ファスナー)',[(place(tstrap,(xr-34,0,shr+bh*0.52+dz),[((0,1,0),-6)]),exv(-230,0,140)) for dz in (-90,0,90)])

# ───────── A4 走行安全部品 ─────────
lock_body = cq.Workplane("XY").rect(40,26).extrude(28).edges("|Z").fillet(4).val()
inst_lb=[];inst_ll=[];inst_lp=[];inst_lc=[];inst_lcb=[];inst_lcn=[]
for s in S:
    y=s*(yr+40); mx,mz=ax+175,Rw+55
    inst_lb.append((place(lock_body,(mx,y,mz)),exv(130,s*60,120)))
    inst_ll.append((bent_tube([(mx,y,mz+10),(mx+30,y,mz+90),(mx+60,y,mz+125)],5,0).val(),exv(130,s*60,120)))
    inst_lp.append((place(cq.Workplane("XY").circle(4).extrude(34),(mx,y-17*s,mz+10),[((1,0,0),-90*s)]),exv(130,s*100,120)))
    inst_lc.append((place(cq.Workplane("XY").circle(22).circle(16.2).extrude(24).union(cq.Workplane("XY").center(0,-26*s).rect(30,16).extrude(24)).val(),(mx,s*yr,yAt(mx)),[((0,1,0),90)]),exv(130,s*40,120)))
    for dx in (-8,8):
        inst_lcb.append((place(hex_bolt(6,35),(mx+dx,s*(yr+10),yAt(mx)-30),[((1,0,0),180)]),exv(130,s*40,160)))
        inst_lcn.append((place(hex_nut(6),(mx+dx,s*(yr+10),yAt(mx)-30+40*0-5),[]),exv(130,s*40,80)))
part('P-401','ホイールロック本体','Wheel Lock Body (push-to-lock)','A4','アルミ 6061','buy','#2b2e34','六角レンチ 5 mm',inst_lb)
part('P-402','ロックレバー','Wheel Lock Lever','A4','SUS304','buy','#9aa3ae','手作業',inst_ll)
part('P-403','レバーピボットピン','Lever Pivot Pin φ8','A4','SUS304','buy','#c9cfd8','ピンポンチ',inst_lp)
part('P-404','ロッククランプ','Lock Clamp (rail mount)','A4','アルミ 6061','make','#3a3e45','六角レンチ 5 mm',inst_lc)
part('P-405','六角ボルト M6×35','Hex Bolt M6×35','A4','SUS304','buy','#b9c1cc','スパナ 10 mm',inst_lcb)
part('P-406','六角ナット M6 (ロック)','Hex Nut M6','A4','SUS304','buy','#aab2bd','スパナ 10 mm',inst_lcn)
inst_at=[];inst_aw=[];inst_ab=[];inst_an=[];inst_ac=[]
for s in S:
    y=s*(yr+10)
    inst_at.append((bent_tube([(ax-8,y,Rw-30),(ax-120,y,120),(ax-185,y,70)],10,8.4).val(),exv(-320,s*40,0)))
    aw = cq.Workplane("XY").polyline([(4,-9),(22,-9),(24,-6),(24,6),(22,9),(4,9)]).close().revolve(360,(0,0,0),(0,1,0)).val()
    inst_aw.append((aw.translate(V(ax-200,y,24)),exv(-320,s*40,0)))
    inst_ab.append((place(hex_bolt(6,40),(ax-200,y-20*s,24),[((1,0,0),-90*s)]),exv(-320,s*80,0)))
    inst_an.append((place(hex_nut(6),(ax-200,y+16*s,24),[((1,0,0),-90*s)]),exv(-320,s*100,0)))
    inst_ac.append((place(cq.Workplane("XY").circle(22).circle(16.2).extrude(20).union(cq.Workplane("XY").center(0,-22).rect(24,14).extrude(20)).val(),(ax,y,Rw+25),ROT_Z_TO_Y),exv(-320,s*40,-40)))
part('P-407','転倒防止バー','Anti-tip Bar φ20 bent','A4','アルミ 6061','make','#3a3e45','六角レンチ 5 mm',inst_at)
part('P-408','転倒防止ホイール','Anti-tip Wheel φ48','A4','ポリウレタン (ソリッド)','buy','#1a1c20','スパナ 10 mm',inst_aw)
part('P-409','六角ボルト M6×40','Hex Bolt M6×40','A4','SUS304','buy','#b9c1cc','スパナ 10 mm',inst_ab)
part('P-410','六角ナット M6 (転倒防止)','Hex Nut M6 nyloc','A4','SUS304','buy','#aab2bd','スパナ 10 mm',inst_an)
part('P-411','転倒防止クランプ','Anti-tip Clamp (camber tube)','A4','アルミ 6061','make','#3a3e45','六角レンチ 5 mm',inst_ac)

# ───────── 代替部品 (部品数削減シナリオ用) ─────────
# S1: ストレートプルスポーク (ニップル一体) + アイレット付きリム
sp_alt, eyelets = [], []
for i in range(24):
    a = i / 24 * 2 * math.pi; yh = 22 if i % 2 else -22
    ar = a + math.radians(12)
    p_h = V(36*math.cos(a), yh, 36*math.sin(a)); p_r = V(270*math.cos(ar), yh*0.25, 270*math.sin(ar))
    d = (p_r - p_h).normalized()
    sp_alt.append(straight_tube(p_h.toTuple(), p_r.toTuple(), 1.0).union(straight_tube((p_r - d*14).toTuple(), (p_r + d*2).toTuple(), 2.6)).val())
    eyelets.append(straight_tube((p_r - d*4).toTuple(), (p_r + d*4).toTuple(), 4.5).val())
rim_alt = rim_s
for e in eyelets: rim_alt = rim_alt.fuse(e)
wheel_part('P-103B','スポーク (ストレートプル・ニップル一体)','Straight-pull Spoke with integrated thread end','SUS304','buy','#c9cfd8','スポークレンチ',sp_alt,380)
PARTS[-1]['alt']=True
wheel_part('P-102B','リム 24" (ねじ付アイレット)','Rim 24" with threaded eyelets','アルミ 6061','buy','#1f2226','手作業',[rim_alt],320)
PARTS[-1]['alt']=True
# S2: クランプ一体型アクスルプレート + ピンチボルト M8×40 ×4
ring = cq.Workplane("XY").circle(23).circle(16.2).extrude(26).union(cq.Workplane("XY").center(0,-27).rect(24,16).extrude(26))
ring = ring.cut(cq.Workplane("XY").center(0,-27).rect(24,2.5).extrude(26)).val()
inst=[];pb=[]
for s_ in S:
    y=s_*(yr+24)
    plate_c = plate_s.translate(V(ax,y,Rw+8)).fuse(place(ring,(ax,y-11*s_,Rw+25),ROT_Z_TO_Y))
    inst.append((plate_c,exv(0,s_*90,-160)))
    for dz in (-10,10): pb.append((place(hex_bolt(8,40),(ax+16,y-11*s_,Rw-4+dz),[((0,1,0),-90)]),exv(0,s_*130,-160)))
part('P-202B','アクスルプレート (クランプ一体)','Axle Plate with integrated camber-tube clamp','A2','アルミ 7005','make','#33363c','六角レンチ 6 mm',inst,alt=True)
part('P-203B','ピンチボルト M8×40','Pinch Bolt M8×40','A2','SUS304','buy','#b9c1cc','スパナ 13 mm',pb,alt=True)
# S3: ベアリング一体圧入キャスターホイール
inst=[]
for s_ in S:
    yc=s_*cyc; w = cwheel.translate(V(cx+20,yc,cr))
    for yy in (-6,6): w = w.fuse(place(cq.Workplane("XY").circle(11).circle(4).extrude(7),(cx+20,yc+yy,cr),ROT_Z_TO_Y))
    inst.append((w,exv(200,s_*120,-110)))
part('P-213B','キャスターホイール 5" (ベアリング一体)','Caster Wheel 5" with pressed-in bearings','A2','ポリウレタン (ソリッド)','buy','#1a1c20','スパナ 13 mm',inst,alt=True)
# S4: クリップオンサイドガード (工具不要)
sg_c = sg.fuse(cq.Workplane("XY").center(-90,0).rect(30,18).extrude(14).val().translate(V(0,0,-87.5))).fuse(cq.Workplane("XY").center(90,0).rect(30,18).extrude(14).val().translate(V(0,0,-87.5)))
part('P-222B','サイドガード (クリップオン)','Clip-on Side Guard (CFRP, tool-free)','A2','CFRP','buy','#1c1e22','手作業',[(sg_c.translate(V(ax+40,s_*(yr+32),shr+65)),exv(0,s_*70,230)) for s_ in S],alt=True)
# S5: ストラップ一体シートスリング (面ファスナー固定)
sl = sling
for s_ in S:
    for x in (xr+80, xf-80): sl = sl.fuse(strap.translate(V(x, s_*(yr), -24)).translate(V(0,0,0)))
part('P-303B','シートスリング (ストラップ一体)','Seat Sling with integrated hook-and-loop straps','A3','ポリエステル布','buy','#232529','手作業 (面ファスナー)',[(place(sl,(0,0,zmid+4),[((0,1,0),-slope)]),exv(0,0,180))],alt=True)

SCENARIOS = [
  dict(id='S0',name='ベースライン (現行設計)',desc='53 品番 / 254 点の現行構成',remove=[],add=[]),
  dict(id='S1',name='ストレートプルスポーク',desc='ニップルを廃止しスポーク端にねじ一体化。リムはねじ付アイレット。',remove=['P-102','P-103','P-104'],add=['P-102B','P-103B']),
  dict(id='S2',name='クランプ一体型アクスルプレート',desc='M8 ボルト・ナット 16 点をピンチボルト 4 本に。プレートにカンバーチューブクランプを一体化。',remove=['P-202','P-203','P-204'],add=['P-202B','P-203B']),
  dict(id='S3',name='ベアリング一体キャスター',desc='608 ベアリングを圧入済みホイールとして調達。',remove=['P-213','P-216'],add=['P-213B']),
  dict(id='S4',name='クリップオンサイドガード',desc='取付ボルト 4 本を廃止し、クリップタブで工具不要に。',remove=['P-222','P-223'],add=['P-222B']),
  dict(id='S5',name='ストラップ一体スリング',desc='固定ストラップとボルト 12 点を廃止し、面ファスナー一体化。',remove=['P-303','P-304','P-305'],add=['P-303B']),
]
SCENARIOS.append(dict(id='S6',name='全案適用',desc='S1〜S5 をすべて適用',remove=sorted({r for sc in SCENARIOS for r in sc['remove']}),add=sorted({a for sc in SCENARIOS for a in sc['add']})))

# ───────── sequence (disassembly order) ─────────
SEQ = ['P-301','P-110','P-111','P-109','P-108','P-107','P-105','P-106','P-104','P-103','P-103B','P-102','P-102B','P-101','P-112',
       'P-409','P-410','P-408','P-407','P-411','P-405','P-406','P-402','P-403','P-401','P-404',
       'P-209','P-208','P-207','P-206','P-307','P-306','P-205','P-223','P-222','P-222B','P-305','P-304','P-303','P-303B',
       'P-220','P-221','P-219','P-218','P-215','P-214','P-216','P-213','P-213B','P-212','P-217','P-211','P-210','P-203','P-204','P-203B','P-202','P-202B','P-224','P-201']
assert sorted(SEQ)==sorted(p['id'] for p in PARTS), set(SEQ)^set(p['id'] for p in PARTS)

# ───────── export ─────────
os.makedirs('out', exist_ok=True)
tol = float(sys.argv[1]) if len(sys.argv)>1 else 0.7
out = {'params':P,'materials':MATERIALS,'groups':GROUPS,'seq':SEQ,'scenarios':SCENARIOS,'parts':[]}
tri_total=0
for p in PARTS:
    rec = dict(id=p['id'],name=p['name'],en=p['en'],group=p['group'],mat=p['mat'],mb=p['mb'],color=p['color'],tool=p['tool'],shell=p['shell'],qty=p['qty'],pieces=len(p['inst']),alt=p['alt'],fastener=p['fastener'],inst=[])
    for sol,ex in p['inst']:
        m = mesh_record(sol, ex, tol, 0.45); tri_total += m['n']; rec['inst'].append(m)
    out['parts'].append(rec)
json.dump(out, open('out/model.json','w'))
base=[p for p in PARTS if not p['alt']]
print(f'baseline {len(base)} parts / {sum(len(p["inst"]) for p in base)} pieces · alt parts {len(PARTS)-len(base)}')
print(f'parts {len(PARTS)}  pieces {sum(len(p["inst"]) for p in PARTS)}  triangles {tri_total}  json {os.path.getsize("out/model.json")/1e6:.1f} MB  {time.time()-T0:.0f}s')
if '--step' in sys.argv:
    asm = cq.Assembly(name='ActiveChair_Assy')
    for p in PARTS:
        if p['alt']: continue
        for k,(sol,_) in enumerate(p['inst']): asm.add(sol, name=f"{p['id']}_{k+1}", color=cq.Color(p['color']))
    asm.save('out/wheelchair_assembly.step'); print('STEP written', os.path.getsize('out/wheelchair_assembly.step')/1e6, 'MB', f'{time.time()-T0:.0f}s')
