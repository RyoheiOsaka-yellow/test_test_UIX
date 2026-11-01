// ================= 稼働アニメーション：クレーン・AGV・作業者・トラック・フォークリフト =================
const MOVERS = new THREE.Group(); MOVERS.name = "movers"; MOVERS.userData.layer = "people";
let playing = true; let simT = 0;

function makeWorker(kind="hall"){ const g = new THREE.Group();
  const body = boxAt(g, 0.42, 0.62, 0.26, kind==="hall"? M.uniform : (Math.random()<0.5? M.shirt : M.uniform2), 0, 0.78, 0);
  cylAt(g, 0.11, 0.24, M.skin, 0, 1.42, 0, {seg:10}); if (kind==="hall") cylAt(g, 0.13, 0.1, M.helmet, 0, 1.62, 0, {seg:10});
  const lg = [boxAt(g, 0.16, 0.78, 0.2, kind==="hall"? M.uniform : M.chair, -0.11, 0, 0), boxAt(g, 0.16, 0.78, 0.2, kind==="hall"? M.uniform : M.chair, 0.11, 0, 0)];
  const arms = [boxAt(g, 0.1, 0.6, 0.12, M.skin, -0.28, 0.8, 0), boxAt(g, 0.1, 0.6, 0.12, M.skin, 0.28, 0.8, 0)];
  lg.forEach(l=>{ l.geometry.translate(0, -0.39, 0); l.position.y = 0.78; }); arms.forEach(a=>{ a.geometry.translate(0, -0.3, 0); a.position.y = 1.35; });
  g.userData.legs = lg; g.userData.arms = arms; return g; }

// 経路追従
class PathMover {
  constructor(obj, pts, speed, opts={}){ this.obj = obj; this.pts = pts.map(p=>new THREE.Vector3(p[0], p[1]??0, p[2]??p[1])); this.speed = speed; this.loop = opts.loop ?? true; this.pause = opts.pause ?? 0; this.seg = 0; this.t = 0; this.wait = 0; this.yoff = opts.yoff ?? 0; this.smoothTurn = opts.smoothTurn ?? true;
    this.lens = []; for (let i=0;i<this.pts.length-1;i++) this.lens.push(this.pts[i].distanceTo(this.pts[i+1])); this.obj.position.copy(this.pts[0]); this.obj.position.y += this.yoff; this.moving = true; }
  update(dt){
    if (this.wait > 0){ this.wait -= dt; this.moving = false; return; } this.moving = true;
    const n = this.pts.length - 1; if (n < 1) return;
    let a = this.pts[this.seg], b = this.pts[(this.seg+1) % this.pts.length]; if (!this.loop && this.seg >= n) return;
    const L = a.distanceTo(b) || 0.001; this.t += this.speed*dt / L;
    while (this.t >= 1){ this.t -= 1; this.seg = (this.seg + 1) % (this.loop ? this.pts.length : n); if (this.pause) this.wait = this.pause; a = this.pts[this.seg]; b = this.pts[(this.seg+1) % this.pts.length]; if (!this.loop && this.seg >= n){ this.t = 0; break; } }
    const p = a.clone().lerp(b, this.t); this.obj.position.set(p.x, p.y + this.yoff, p.z);
    const dir = b.clone().sub(a); if (dir.lengthSq() > 1e-6){ const yaw = Math.atan2(dir.x, dir.z); this.obj.rotation.y = this.smoothTurn ? lerpAngle(this.obj.rotation.y, yaw, Math.min(1, dt*6)) : yaw; }
  }
}
function lerpAngle(a, b, t){ let d = b - a; while (d > Math.PI) d -= 2*Math.PI; while (d < -Math.PI) d += 2*Math.PI; return a + d*t; }

function makeTruck(){ const g = new THREE.Group(); boxAt(g, 2.5, 2.6, 8.5, M.truckWhite, 0, 1.0, -1.5); boxAt(g, 2.4, 2.2, 2.2, std(0x2b4b8a,{metalness:0.4,roughness:0.4}), 0, 0.9, 4.2); boxAt(g, 2.2, 0.9, 0.06, M.glassTint, 0, 1.9, 5.3);
  boxAt(g, 2.5, 0.5, 10.5, M.darkSteel, 0, 0.5, 0); for (const z of [3.8, -2.0, -3.4]) for (const dx of [-1.1, 1.1]) cylAt(g, 0.5, 0.35, M.blackMatte, dx, 0.0, z, {rot:[0,0,Math.PI/2], seg:14});
  boxAt(g, 1.0, 0.2, 0.3, M.yellow, 0, 2.9, 5.2); return g; }
function makeForklift(){ const g = new THREE.Group(); boxAt(g, 1.1, 0.9, 2.2, M.rackOrange, 0, 0.3, 0); boxAt(g, 1.0, 0.1, 1.0, M.blackMatte, 0, 1.2, -0.3); for (const dx of [-0.45,0.45]) boxAt(g, 0.08, 2.0, 0.08, M.blackMatte, dx, 1.2, -0.3);
  boxAt(g, 0.5, 0.6, 0.5, M.uniform, 0, 1.2, -0.1); cylAt(g, 0.11, 0.24, M.skin, 0, 1.85, -0.1, {seg:8}); cylAt(g, 0.13, 0.1, M.helmet, 0, 2.05, -0.1, {seg:8});
  for (const dx of [-0.5,0.5]) boxAt(g, 0.06, 2.2, 0.1, M.darkSteel, dx, 0.0, 1.2); for (const dx of [-0.35,0.35]) boxAt(g, 0.1, 0.05, 1.0, M.darkSteel, dx, 0.1, 1.8);
  boxAt(g, 1.1, 0.14, 1.1, M.pallet, 0, 0.16, 1.9); boxAt(g, 0.9, 0.7, 0.9, M.box, 0, 0.3, 1.9);
  for (const z of [0.7, -0.7]) for (const dx of [-0.55,0.55]) cylAt(g, 0.3, 0.25, M.blackMatte, dx, 0.0, z, {rot:[0,0,Math.PI/2], seg:12}); return g; }

const movers = [];
function buildMovers(){
  scene.add(MOVERS);
  // ---- クレーン ----
  for (const [id, xa, xb, ph] of [["CR-01", -40, -2, 0], ["CR-02", 6, 40, 2.0]]){ const o = EQ_OBJ[id]; if (!o) continue; const c = o.group;
    ANIM.push({ update(t){ c.position.x = lerp(xa, xb, 0.5+0.5*Math.sin(t*0.12 + ph)); } }); animOverhead("crane", c, ph); }
  // ---- AGV ----
  { const o = EQ_OBJ["AGV-2"]; if (o){ movers.push(new PathMover(o.group, [[32,0,-14],[0,0,-14],[-30,0,-14],[-30,0,-6],[-14,0,-6],[-14,0,-14],[20,0,-14],[20,0,-24],[32,0,-24],[32,0,-14]], 1.4, { pause:2.5 })); } }
  { const o = EQ_OBJ["AGV-1"]; if (o){ movers.push(new PathMover(o.group, [[40,0,-14],[40,0,-28],[42.5,0,-28],[42.5,0,-15],[40,0,-9],[35,0,-9],[35,0,-14],[40,0,-14]], 1.2, { pause:3 })); } }
  // ---- 作業者（ホール）----
  const routes = [
    [[-36,-20],[-36,-13],[-24,-13],[-24,-6],[-36,-6]],
    [[-6,-6],[-6,-12],[6,-12],[6,-26],[-8,-26],[-8,-20]],
    [[10,-6],[18,-6],[18,-24],[12,-24],[12,-10]],
    [[22,-32],[34,-32],[34,-34],[22,-34]],
    [[40,-28],[40,-6],[36,-6],[36,-20]],
    [[-42,-2],[-42,-28],[-20,-28],[-20,-18]],
    [[-26,-10],[-14,-10],[-14,-4],[-26,-4]],
    [[22,-4],[22,-12],[30,-12],[30,-4]],
    [[-12,-16],[-12,-12],[2,-12],[2,-16]],
    [[4,-8],[4,-4],[16,-4],[16,-8]],
  ];
  routes.forEach((r, i)=>{ const w = makeWorker("hall"); MOVERS.add(w); const pts = r.map(([x,z])=>[x,0,z]); pts.push(pts[0]); movers.push(new PathMover(w, pts, 0.9+ (i%3)*0.15, { pause: 2 + i%4 })); });
  // 2F/3F 歩行者（バルコニー・テラス・通路）
  const lv = BLD.lv;
  [[lv[1], [[-34,1.0],[30,1.0]]], [lv[1], [[-20,20.5],[20,20.5]]], [lv[2], [[-30,1.8],[30,1.8]]], [lv[1], [[-5,15],[20,15]]], [lv[2], [[-34,15],[-12,15]]]].forEach(([y, r], i)=>{
    const w = makeWorker("office"); (y===lv[1]? floorGroup(2) : floorGroup(3)).add(w); const pts = r.map(([x,z])=>[x,y,z]); pts.push(...r.slice().reverse().map(([x,z])=>[x,y,z])); movers.push(new PathMover(w, pts, 0.8, { pause:3+i })); });
  // 外構：歩行者
  [[[-50,34],[-20,30],[-38,25],[-38,19]], [[20,38],[45,38],[45,30]], [[-10,36],[-30,36]]].forEach((r,i)=>{ const w = makeWorker("office"); MOVERS.add(w); const pts = r.map(([x,z])=>[x,0,z]); pts.push(...r.slice().reverse().map(([x,z])=>[x,0,z])); movers.push(new PathMover(w, pts, 0.9, { pause:2 })); });
  // 立ち作業者（固定）
  for (const [x,z,ry] of [[-39,-21,0],[-25,-21,0.5],[-20,-9,-1.2],[-4,-12,0.4],[-1,-19,2.5],[12,-13,-0.7],[28,-4,1.5],[23,-26,0],[-11,9,0],[0,8,1.2],[-23,11,0.3]]){ const w = makeWorker("hall"); w.position.set(x,0,z); w.rotation.y = ry; MOVERS.add(w); }
  // ---- トラック・フォークリフト ----
  const tr = makeTruck(); MOVERS.add(tr); movers.push(new PathMover(tr, [[54,0,80],[54,0,20],[54,0,-24],[47.5,0,-24],[54,0,-24],[54,0,60],[54,0,80]], 4.0, { pause:6, smoothTurn:true }));
  const tr2 = makeTruck(); tr2.position.set(48.5, 0, -16); tr2.rotation.y = Math.PI/2; MOVERS.add(tr2);  // ドック待機中
  const fk = makeForklift(); MOVERS.add(fk); movers.push(new PathMover(fk, [[40,0,-16],[40,0,-22],[30,0,-22],[30,0,-16],[40,0,-16]], 1.6, { pause:3 }));
}
function updateMovers(dt){
  simT += dt;
  for (const m of movers){ m.update(dt); const w = m.obj.userData; if (w.legs){ const ph = m.moving ? Math.sin(simT*7 + m.obj.id)*0.45 : 0; w.legs[0].rotation.x = ph; w.legs[1].rotation.x = -ph; w.arms[0].rotation.x = -ph*0.7; w.arms[1].rotation.x = ph*0.7; } }
  for (const a of ANIM) a.update(simT, dt);
}
