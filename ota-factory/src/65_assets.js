// ================= 実物 3D モデル（NVIDIA SimReady, CC BY 4.0 — codepawl/simready-glb 経由）=================
// 手続き生成の工場に、実在のフォークリフト・パレット・ラック・工具・安全設備などの GLB を重ねる。
// 読込は非同期：先に手続きモデル（fallback）を見せ、届いた順に差し替える。オフラインでも手続きモデルで成立する。
const HF = "https://huggingface.co/datasets/codepawl/simready-glb/resolve/main/";
const ASSET_CATALOG = {   // key: { a: asset 名, n: 表示名, tris: 元の三角形数(k) }
  forklift:   { a:"vehicle_forklift_orange_a01",          n:"フォークリフト（リーチ式）", tris:330 },
  forklift2:  { a:"vehicle_forklift_blue_a01",            n:"フォークリフト（待機）",     tris:330 },
  palletJack: { a:"palletJack_lowProfile_a01",            n:"ハンドパレット",             tris:181 },
  handTruck:  { a:"handTruck_convertible_steel_orange_a01", n:"台車（ハンドトラック）",  tris:109 },
  tiltTruck:  { a:"tiltTruck_gray_a01",                   n:"ダンプカート",               tris:146 },
  palletA:    { a:"pallet_assembly_a05",                  n:"パレット（箱積み）",         tris:89 },
  palletB:    { a:"pallet_assembly_b01",                  n:"パレット（部品）",           tris:53 },
  palletC:    { a:"pallet_assembly_yellow_a02",           n:"パレット（コンテナ）",       tris:260 },
  crate:      { a:"crate_plywood_b02",                    n:"木箱（出荷梱包）",           tris:20 },
  rack:       { a:"rack_large_empty_a01",                 n:"パレットラック 4 m",         tris:44 },
  ladder:     { a:"ladder_rolling_yellow_a02",            n:"移動式踏台",                 tris:269 },
  dockGate:   { a:"barrier_gate_safetyDock_a02",          n:"ドック安全ゲート",           tris:75 },
  floorSign:  { a:"sign_floor_movable_a01",               n:"フロアサイン",               tris:174 },
  extinguisher:{ a:"fireProtection_extinguisher_portable_b01", n:"消火器",               tris:50 },
  firstAid:   { a:"safety_firstAidCabinet_wallMounted_a01", n:"救急箱（壁付）",           tris:39 },
  eyewash:    { a:"safety_eyewashStation_stand_selfContained_a01", n:"洗眼器",           tris:228 },
  locker:     { a:"storage_locker_double_bench_b01",      n:"ロッカー（ベンチ付）",       tris:34 },
  welding:    { a:"powerTool_welding_station_a01",        n:"溶接機",                     tris:287 },
  toolCab:    { a:"equipment_rolling_tool_cabinet_a01",   n:"ツールキャビネット",         tris:500 },
  toolCart:   { a:"equipment_mechanic_tool_cart_g01",     n:"工具カート",                 tris:676 },
  cabinet:    { a:"furniture_workbench_modular_a01",      n:"工具保管キャビネット",       tris:90 },
  vise:       { a:"equipment_bench_vise_a01",             n:"万力",                       tris:106 },
  liftTable:  { a:"equipment_liftTable_scissorMobile_a01", n:"リフトテーブル",            tris:443 },
  partsWasher:{ a:"equipment_parts_washer_cabinet_b01",   n:"部品洗浄機",                 tris:180 },
  compressor: { a:"equipment_airCompressor_a01",          n:"空気圧縮機",                 tris:538 },
  airDryer:   { a:"equipment_airDryer_b01",               n:"エアドライヤ",               tris:207 },
  drum:       { a:"drum_steel_a01",                       n:"ドラム缶",                   tris:100 },
  drumBlue:   { a:"drum_plastic_blue_a02",                n:"ドラム缶（樹脂）",           tris:40 },
  ibc:        { a:"ibcTank_a02",                          n:"IBC タンク",                 tris:136 },
  sprayBooth: { a:"equipment_sprayBooth_painting_a01",    n:"塗装ブース",                 tris:1025 },
  conveyor:   { a:"conveyor_belt_a05",                    n:"ローラーコンベヤ",           tris:229 },
  cobot:      { a:"robotic_system_arm_b01",               n:"移動式協働ロボット",         tris:786 },
  fan:        { a:"climate_shopFan_floorAxial_a01",       n:"工場扇",                     tris:229 },
  trash:      { a:"trashCan_wheeled_black_a01",           n:"ごみ箱（車輪付）",           tris:88 },
  sofa:       { a:"sofa_visitor_a01",                     n:"ソファ（来客）",             tris:334 },
  coffee:     { a:"furniture_counter_coffeeStation_a01",  n:"コーヒーステーション",       tris:282 },
  printer:    { a:"computer_printer_office_a01",          n:"複合機",                     tris:29 },
  printer3d:  { a:"equipment_3d_printer_b01",             n:"3D プリンタ",                tris:394 },
  scope:      { a:"testingTool_oscilloscope_b01",         n:"オシロスコープ",             tris:175 },
  chair:      { a:"chair_office_amf_black_a01",           n:"オフィスチェア",             tris:32 },
};
const AS = { on:true, quality:"lod1", loader:null, cache:{}, placed:[], loaded:0, total:0, failed:0, bytes:0 };
function assetLoader(){ if (AS.loader) return AS.loader; const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder);
  const k = new KTX2Loader().setTranscoderPath("https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/basis/").detectSupport(renderer); l.setKTX2Loader(k); AS.loader = l; return l; }
// 重いアセット（原型 30 万三角形超）は選択品質より 1 段軽い LOD を使う
function effQuality(c){ const q = AS.quality; if (c.tris <= 300 || q === "lod2") return q; return q === "glb" ? "lod1" : "lod2"; }
function assetURL(c){ const q = effQuality(c); return q === "glb" ? `${HF}glb/${c.a}.glb` : `${HF}lods/${c.a}/${c.a}_${q}.glb`; }
{ const qp = new URLSearchParams(location.search).get("assets"); if (qp === "off") AS.on = false; else if (["lod1","lod2","glb"].includes(qp||"")) AS.quality = qp; }
function loadAsset(key){ const c = ASSET_CATALOG[key]; const ck = key + "@" + AS.quality; if (AS.cache[ck]) return AS.cache[ck];
  AS.cache[ck] = assetLoader().loadAsync(assetURL(c)).then(g => { const sc = g.scene; sc.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(sc); const size = bb.getSize(new THREE.Vector3()); const ctr = bb.getCenter(new THREE.Vector3());
    sc.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; if (o.material && o.material.transparent && o.material.opacity > 0.98) o.material.transparent = false; } });
    return { scene: sc, bb, size, ctr }; }); return AS.cache[ck]; }
// opts: parent, x, y, z, ry, scale, fit:{w|d|h}, fallback(Group), eqId, hideFallback(true)
function placeAsset(key, opts={}){
  const c = ASSET_CATALOG[key]; if (!c) return null; const holder = new THREE.Group(); holder.name = "asset_" + key; holder.position.set(opts.x||0, opts.y||0, opts.z||0); holder.rotation.y = opts.ry||0;
  holder.userData.extra = true; holder.userData.asset = key; holder.userData.layer = "assets"; if (opts.eqId) holder.userData.eqId = opts.eqId;
  if (opts.fallback){ opts.fallback.userData.fallback = true; holder.add(opts.fallback); }
  (opts.parent || scene).add(holder); const rec = { holder, key, opts, inst:null }; AS.placed.push(rec); AS.total++;
  if (AS.on) attachAsset(rec); return holder;
}
function attachAsset(rec){ const { holder, key, opts } = rec; loadAsset(key).then(r => { if (rec.inst) return; const inst = r.scene.clone(true); let s = opts.scale || 1;
    if (opts.fit){ const f = opts.fit; const sx = f.w ? f.w / r.size.x : Infinity, sz = f.d ? f.d / r.size.z : Infinity, sy = f.h ? f.h / r.size.y : Infinity; s = Math.min(sx, sz, sy); if (!isFinite(s)) s = 1; }
    inst.scale.setScalar(s); inst.position.set(-r.ctr.x * s, -r.bb.min.y * s, -r.ctr.z * s); inst.userData.assetInst = true; holder.add(inst); rec.inst = inst;
    if (opts.fallback && opts.hideFallback !== false) opts.fallback.visible = false; AS.loaded++; assetStatus(); dirtyShadow(); })
  .catch(err => { AS.failed++; console.warn("asset load failed", key, err?.message || err); assetStatus(); }); }
function assetStatus(){ const el = document.getElementById("assetStatus"); if (!el) return; const done = AS.loaded + AS.failed; el.textContent = AS.on ? (done < AS.total ? `実物モデル ${AS.loaded}/${AS.total} 読込中…` : `実物モデル ${AS.loaded} 点${AS.failed? `（${AS.failed} 失敗）`:""}`) : "実物モデル OFF"; el.style.color = done < AS.total ? "var(--acc)" : "var(--sub)"; }
function setAssetsOn(on){ AS.on = on; for (const rec of AS.placed){ if (rec.inst) rec.inst.visible = on; if (rec.opts.fallback) rec.opts.fallback.visible = !on || !rec.inst; if (on && !rec.inst) attachAsset(rec); } assetStatus(); dirtyShadow(); }
function setAssetQuality(q){ if (q === AS.quality) return; AS.quality = q; AS.cache = {}; AS.loaded = 0; AS.failed = 0; for (const rec of AS.placed){ if (rec.inst){ rec.holder.remove(rec.inst); rec.inst = null; } if (rec.opts.fallback) rec.opts.fallback.visible = true; if (AS.on) attachAsset(rec); } assetStatus(); }
function removeAssetsOf(parent){ for (let i = AS.placed.length - 1; i >= 0; i--){ const rec = AS.placed[i]; let p = rec.holder.parent, inside = false; while (p){ if (p === parent){ inside = true; break; } p = p.parent; } if (inside){ rec.holder.parent?.remove(rec.holder); AS.placed.splice(i, 1); AS.total--; if (rec.inst) AS.loaded--; } } assetStatus(); }
// 手続きモデルを fallback 用の Group にまとめる（Merger を使う既存関数を流用）
function fallbackGroup(fn){ const m = new Merger(); const g = new THREE.Group(); fn(m, g); m.flush(g); return g; }

// ---------- 配置：固定什器・外構 ----------
function buildAssets(){
  const g1 = floorGroup(1), g2 = floorGroup(2), g3 = floorGroup(3), site = layer("site"); const { x0, x1, z0, zh, z1, lv } = BLD;
  // 受入置場（東端）：パレット・木箱・踏台・ハンドパレット・台車・待機フォークリフト
  [["palletA", 40.6, -28.2, 0.1], ["palletB", 40.6, -26.4, 0], ["palletA", 40.6, -24.6, -0.15], ["palletC", 40.6, -22.6, 0.05]].forEach(([k,x,z,ry]) => placeAsset(k, { parent:g1, x, z, ry }));
  placeAsset("crate", { parent:g1, x:42.6, z:-27.2 }); placeAsset("crate", { parent:g1, x:42.6, z:-26.0, ry:0.1 }); placeAsset("crate", { parent:g1, x:42.6, y:1.02, z:-27.2, ry:-0.05 });
  placeAsset("ladder", { parent:g1, x:40.4, z:-20.2, ry:Math.PI/2 }); placeAsset("palletJack", { parent:g1, x:42.0, z:-13.6, ry:-Math.PI/2 }); placeAsset("handTruck", { parent:g1, x:42.9, z:-19.3, ry:Math.PI/2 });
  placeAsset("forklift2", { parent:g1, x:40.8, z:-9.0, ry:Math.PI/2 });
  // ドック：安全ゲート・フロアサイン・ごみ箱・出荷木箱
  for (const e of EQUIP.filter(e => e.kind === "dock")) placeAsset("dockGate", { parent:g1, x:42.1, z:e.z, ry:Math.PI/2 });
  placeAsset("floorSign", { parent:g1, x:38.8, z:-14.2 }); placeAsset("floorSign", { parent:g1, x:-12.6, z:-14.6 });
  placeAsset("trash", { parent:g1, x:43.2, z:-9.6 }); placeAsset("crate", { parent:g1, x:40.2, z:-3.6 }); placeAsset("crate", { parent:g1, x:41.4, z:-3.6, ry:0.08 });
  // 各ベイ境界の柱脇：消火器・救急箱
  for (const x of [-12, 4, 20, 36]){ placeAsset("extinguisher", { parent:g1, x:x+0.55, z:zh-0.95 }); placeAsset("firstAid", { parent:g1, x:x+1.45, y:1.25, z:zh-0.42, ry:Math.PI/2 }); }
  for (const x of [-30, 10]) placeAsset("extinguisher", { parent:g1, x, z:z0+1.0 });
  // 組立ベイ前の工場扇
  placeAsset("fan", { parent:g1, x:-8, z:-2.6, ry:Math.PI }); placeAsset("fan", { parent:g1, x:16, z:-2.6, ry:Math.PI });
  // 電子ラボ：洗眼器・オシロスコープは L4 のレーンフックで
  placeAsset("eyewash", { parent:g1, x:-5.2, z:16.6, ry:Math.PI/2 });
  // 休憩・更衣：ロッカー（手続きロッカー列を置換）
  for (let i=0;i<8;i++) placeAsset("locker", { parent:g1, x:29.3 + i*0.66, z:16.9, ry:Math.PI, fallback: i===0 ? fallbackGroup(m => lockerRow(m, 0, 5.3, 0, 0)) : null });
  // ロビー：来客ソファ（手続きソファを置換）
  placeAsset("sofa", { parent:g1, x:-34, z:13.2, ry:Math.PI/2, fallback: fallbackGroup(m => sofaSet(m, 0, 0, 0, 0)) });
  placeAsset("sofa", { parent:g1, x:-34, z:5.2, ry:-Math.PI/2, fallback: fallbackGroup(m => sofaSet(m, 0, 0, 0, Math.PI)) });
  placeAsset("cobot", { parent:g1, x:-26.5, z:14.6, ry:0.6 });   // ショールームの移動式協働ロボット
  // 2F：複合機の横に 3D プリンタ（HIL 近く）、3F：コーヒーステーション・複合機・3D プリンタ・会議室の椅子
  placeAsset("printer3d", { parent:g2, x:-5.6, y:lv[1], z:16.6 });
  placeAsset("coffee", { parent:g3, x:21.5, y:lv[2], z:16.4, ry:Math.PI/2 }); placeAsset("printer", { parent:g3, x:-30, y:lv[2], z:3.9 }); placeAsset("printer3d", { parent:g3, x:-20.6, y:lv[2]+0.98, z:16.2 });
  for (const [xa, xb] of [[-10,-3],[-3,4]]){ const cx = (xa+xb)/2, L = Math.min(xb-xa-2, 4.5); for (let i=0;i<Math.floor(L/0.8);i++) for (const dz of [-1.0, 1.0]) placeAsset("chair", { parent:g3, x:cx-L/2+0.5+i*0.8, y:lv[2], z:10+dz, ry: dz>0 ? Math.PI : 0 }); }
  // 北側：圧縮機・エアドライヤ（コンプレッサ室脇）、ダンプカート（ごみ置場）、ごみ箱
  placeAsset("compressor", { parent:site, x:-47.4, z:-38.8, ry:0 }); placeAsset("airDryer", { parent:site, x:-45.3, z:-38.9 }); placeAsset("tiltTruck", { parent:site, x:-51.5, z:-25.5, ry:0.3 }); placeAsset("trash", { parent:site, x:10, z:-31.0 });
  placeAsset("eyewash", { parent:site, x:-15.2, z:-31.3, ry:-Math.PI/2 });
}
// ---------- 配置：レーンの工程ごとの小物（生成・再生成のたびに呼ぶ）----------
const LANE_ASSETS = {   // kind → [asset, dx, dz, ry, opts]（局所座標：+z が正面＝通路側）
  load:   [["palletA", -1.4, 0, 0.2], ["palletB", 1.6, 0.2, 0]],
  mc5:    [["toolCab", 0, 1, 0, { front:true, dx:-0.45 }]],
  hmc:    [["toolCab", 0, 1, 0, { front:true, dx:0.45 }]],
  lathe:  [["toolCart", 0, 1, Math.PI/2, { front:true, dx:-0.4 }]],
  gantry: [["toolCab", 0, 1, 0, { front:true, dx:-0.5 }], ["ladder", 0, 1, 0, { front:true, dx:0.5 }]],
  wash:   [["partsWasher", 0, 1, Math.PI, { front:true, dx:0.5 }]],
  store:  [["handTruck", 0, 1, Math.PI, { front:true, dx:-0.4 }], ["crate", 0, 1, 0, { front:true, dx:0.5 }]],
  asmA:   [["liftTable", -7.6, 3.2, 0], ["toolCart", 5.6, -2.0, 0], ["crate", -7.6, -3.2, 0], ["palletB", -7.6, -1.4, 0.1]],
  asmB:   [["cabinet", 5.6, -3.0, 0], ["toolCab", 5.6, -1.6, 0], ["conveyor", -2.6, -3.3, Math.PI/2], ["vise", 5.5, 0.75, 0, { dz:2.6 }]],
  weld:   [["welding", -2.1, 2.0, 0], ["drum", 2.6, -2.6, 0]],
  finish: [["fan", 0, 1, Math.PI, { front:true, dx:-0.6 }], ["drumBlue", 0, 1, 0, { front:true, dx:0.6 }]],
  mask:   [["drum", -1.9, 0.8, 0], ["drum", -1.9, 0.1, 0.4], ["ibc", 0, 1, 0, { front:true, dx:0.8 }]],
  booth:  [["sprayBooth", 0, 0, Math.PI, { replace:true }]],
  wiring: [["scope", 0.6, 0.4, 0, { y:0.78 }]],
  panel:  [["toolCab", 0, 1, 0, { front:true, dx:0.6 }]],
  laser:  [["palletB", 0, 1, 0, { front:true, dx:-0.5 }]],
  brake:  [["handTruck", 0, 1, 0, { front:true, dx:0.6 }]],
  demo:   [["cobot", -0.2, 0.6, 0.4, { y:0.3 }]],
};
function laneAssets(obj){ removeAssetsOf(obj.group); for (const s of obj.sts.concat(obj.aux)){ const list = LANE_ASSETS[s.kind]; if (!list || !s.units) continue;
    for (const u of s.units){ const grp = obj.group.children.find(c => c.userData.eqId && c.userData.eqId === `${obj.lane.id}-S${s.idx}${s.n>1? String.fromCharCode(97+u.k) : ""}`); if (!grp) continue; const fp = s.fp;
      for (const [key, dx, dz, ry, o={}] of list){ const px = o.front ? (o.dx||0) * fp[0]*0.5 : dx, pz = o.front ? fp[1]/2 + 0.9 : (o.dz !== undefined ? o.dz : dz);
        if (o.replace){ const fb = new THREE.Group(); grp.children.filter(c => !c.isSprite && !c.userData.extra).forEach(c => fb.add(c)); grp.add(fb); placeAsset(key, { parent:grp, x:0, z:0, ry, fallback:fb, fit:{ w:fp[0]+0.4, d:fp[1]+0.9 } }); }
        else placeAsset(key, { parent:grp, x:px, y:o.y||0, z:pz, ry }); } } } }
// ---------- 動く物：フォークリフト（手続きモデルを fallback に）----------
function assetMover(key, fallback){ const holder = placeAsset(key, { parent:MOVERS, x:0, z:0, fallback }); return holder; }
// ---------- パレットラック：実物ラック 4 m × 2 ＋ パレット（手続きラックを fallback に）----------
function makeRackAsset(levels=3, bays=4){ const g = new THREE.Group(); const fb = makeRack(levels, bays);
  placeAsset("rack", { parent:g, x:-2, z:0, fallback:fb }); placeAsset("rack", { parent:g, x:2, z:0 });
  const rnd = sRand("rackAsset" + levels + bays); const floorKeys = ["palletA","palletC","palletA","palletB"];
  for (let i=0;i<4;i++){ const x = -3 + i*2; if (rnd() < 0.8) placeAsset(floorKeys[i % 4], { parent:g, x, z:-0.45, ry:(rnd()-0.5)*0.2 }); if (rnd() < 0.6) placeAsset("palletB", { parent:g, x, z:0.55, ry:(rnd()-0.5)*0.2 });
    if (rnd() < 0.7) placeAsset("palletB", { parent:g, x, y:2.1, z:-0.45, ry:(rnd()-0.5)*0.15 }); if (levels >= 4 && rnd() < 0.5) placeAsset("crate", { parent:g, x, y:2.1, z:0.55 }); }
  return g; }
