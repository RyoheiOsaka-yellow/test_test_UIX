
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
window.__kzT0=performance.now();

// ================= 基本セットアップ =================
const app = document.getElementById("app");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1117);
scene.fog = new THREE.Fog(0x0d1117, 400, 1200);

const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:"high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;      // 平行光の影はカメラ非依存 → シーン変化時のみ再描画
let shadowDirty = true;
function dirtyShadow(){ shadowDirty = true; }
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
app.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(55, innerWidth/innerHeight, 0.1, 4000);

// ---- ライティング: 環境光 + 半球光 + 太陽光（落影あり） + 青みの補助光 ----
const ambL = new THREE.AmbientLight(0xffffff, 0.30); scene.add(ambL);
const hemiL = new THREE.HemisphereLight(0x9fb8d8, 0x2a2f36, 0.55); scene.add(hemiL);
const dir = new THREE.DirectionalLight(0xfff1dc, 1.35);
dir.position.set(120, 260, 80); scene.add(dir);
dir.castShadow = true;
dir.shadow.mapSize.set(4096, 4096);
dir.shadow.bias = -0.0006; dir.shadow.normalBias = 0.35;
const dir2 = new THREE.DirectionalLight(0x88aaff, 0.22);
dir2.position.set(-90, 140, -120); scene.add(dir2);
let shadowsOn = true;
// 影のカメラ範囲を現在のビュー（敷地/建屋内）に合わせる
function fitShadow(){
  const site = (typeof ctx==="undefined") || ctx.kind==="site";
  const half = site ? SITE_W*0.78 : Math.max(ctx.W,ctx.D)*0.62;
  const sc=dir.shadow.camera;
  sc.left=-half; sc.right=half; sc.top=half; sc.bottom=-half; sc.near=10; sc.far=700;
  sc.updateProjectionMatrix();
  const ms = site? 4096 : 2048;
  if(dir.shadow.mapSize.x!==ms){
    dir.shadow.mapSize.set(ms,ms);
    if(dir.shadow.map){ dir.shadow.map.dispose(); dir.shadow.map=null; }
  }
  dir.shadow.normalBias = site? 0.35 : 0.06;
  dir.shadow.bias = site? -0.0006 : -0.0003;
  dir.shadow.needsUpdate=true; shadowDirty=true;
}
// 落影フラグの一括付与（透過・ワイヤー・Basic材質・ラベルは除外）
function applyShadows(root){
  root.traverse(o=>{
    if(!o.isMesh && !o.isInstancedMesh) return;
    if(o.isSprite) return;
    const mats=Array.isArray(o.material)? o.material : (o.material? [o.material] : []);
    const basic = mats.length>0 && mats.every(m=> m && m.isMeshBasicMaterial);
    const noCast = o.userData.noShadow || mats.some(m=> !m || m.wireframe || m.visible===false || (m.transparent && m.opacity<0.7));
    o.receiveShadow = !basic;
    o.castShadow = !noCast && !basic;
  });
}
// ---- 空（グラデーションドーム。フォグ色と地平線色を一致させる） ----
const skyMat=new THREE.ShaderMaterial({ side:THREE.BackSide, depthWrite:false, fog:false,
  uniforms:{ top:{value:new THREE.Color(0x0a1220)}, mid:{value:new THREE.Color(0x151d29)}, bot:{value:new THREE.Color(0x0d1117)} },
  vertexShader:"varying vec3 vW; void main(){ vW=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
  fragmentShader:"uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vW;\n"+
    "void main(){ float h=normalize(vW).y; vec3 c = h>0.0 ? mix(mid,top,pow(h,0.6)) : mix(mid,bot,clamp(-h*6.0,0.0,1.0));\n"+
    "  gl_FragColor=vec4(c,1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}" });
const sky=new THREE.Mesh(new THREE.SphereGeometry(3000,32,16), skyMat);
sky.frustumCulled=false; sky.renderOrder=-10; scene.add(sky);
function setSky(draw){
  const u=skyMat.uniforms;
  if(draw){ u.top.value.set(0xdde5ee); u.mid.value.set(0xf2f4f6); u.bot.value.set(0xf2f4f6);
    scene.background=new THREE.Color(0xf2f4f6); scene.fog=null; }
  else { u.top.value.set(0x0a1220); u.mid.value.set(0x151d29); u.bot.value.set(0x0d1117);
    scene.background=new THREE.Color(0x0d1117); scene.fog=new THREE.Fog(0x151d29, 420, 1300); }
}
setSky(false);
// ---- アスファルト質感（Canvasノイズ） ----
let _asphaltTex=null;
function asphaltTex(){
  if(_asphaltTex) return _asphaltTex;
  const cvs=document.createElement("canvas"); cvs.width=cvs.height=256;
  const c=cvs.getContext("2d"); c.fillStyle="#2a2f36"; c.fillRect(0,0,256,256);
  const rnd=sRand("asphalt");
  for(let i=0;i<9000;i++){
    const v=Math.floor(26+rnd()*44);
    c.fillStyle="rgba("+v+","+(v+3)+","+(v+8)+","+(0.3+rnd()*0.5).toFixed(2)+")";
    c.fillRect(rnd()*256,rnd()*256,1.6,1.6);
  }
  for(let i=0;i<40;i++){ c.fillStyle="rgba(20,22,26,"+(0.15+rnd()*0.25).toFixed(2)+")";
    c.beginPath(); c.ellipse(rnd()*256,rnd()*256,6+rnd()*22,3+rnd()*10,rnd()*3.14,0,6.3); c.fill(); }
  const tex=new THREE.CanvasTexture(cvs); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.anisotropy=8;
  tex.colorSpace=THREE.SRGBColorSpace;
  _asphaltTex=tex; return tex;
}

// ================= 敷地データ（加須工場配置図 1/750 からの読取・概算） =================
// ※座標・寸法は図面からの目視概算。実測CAD値が入れば sw と各値の差替えで補正可能。
let SITE_W = 260, SITE_D = 185;

// type: paint(ペイント工場) varnish(ワニス) tint(調色) wh(倉庫) hazwh(危険物倉庫)
//       lab(研究棟) office(事務所) tank(屋外タンク) gate(門) pond(池)
const TYPE_COLOR = { paint:0x58a6ff, varnish:0xd29922, tint:0xf778ba, wh:0x3fb950,
  hazwh:0xff7b72, lab:0xbc8cff, office:0x9da7b3, tank:0xc0c8d0, gate:0xe3b341, pond:0x2f81f7 };
const TYPE_NAME = { paint:"ペイント工場", varnish:"ワニス工場", tint:"調色工場", wh:"一般倉庫",
  hazwh:"危険物倉庫", lab:"研究棟", office:"事務所", tank:"屋外タンク", gate:"正門", pond:"池" };

const BUILDINGS = [
  // id, 名称, type, x, z, w(東西), d(南北), h, opt
  ["gate",   "正門",           "gate",   -52, -88, 12,  3, 5, {fixed:true, noOcc:true}],
  ["whGen",  "出荷倉庫 A〜E",  "wh",      34, -78, 72, 17, 8, {enter:true}],
  ["office", "事務所",         "office", -18, -39, 34,  9, 8, {}],
  ["paint1", "第一ペイント工場","paint",   40, -31, 38, 58, 13, {enter:true}],
  ["paint2", "第二ペイント工場","paint",   92, -49, 43.5, 38, 13, {enter:true}]   /* 平面寸法は図面260925: 43.5m×38m */,
  ["varnish","ワニス工場",     "varnish",  0, -13, 26, 22, 11, {enter:true}],
  ["tankA",  "屋外貯蔵タンク OT-1〜5","tank", 31, 6, 48, 10, 9, {tanks:5}],
  ["tankB",  "屋外タンク OT-7/8","tank",  13, 37, 20, 10, 9, {tanks:2}],
  ["tint",   "調色工場",       "tint",    35, 55, 22, 16, 8, {enter:true}],
  ["lab",    "研究棟",         "lab",     61, 30, 18, 28, 11, {enter:true}],
  ["whS",    "倉庫",           "wh",      52,  4, 10,  8, 5, {}],
  ["pond",   "池",             "pond",    73, 13, 15, 11, 0.4, {fixed:true}],
  ["whNew",  "原料倉庫",       "wh",     -84, -35, 40, 24, 9, {enter:true}],
  ["hazNew", "新危険物倉庫",   "hazwh", -112,  -9, 22, 28, 7, {enter:true}],
  ["hazA",   "危険物倉庫A",    "hazwh",  -92,  35, 26, 16, 6, {enter:true}],
  ["hazB",   "危険物倉庫B",    "hazwh",  -62,  45, 26, 16, 6, {enter:true}],
];

// 建屋間の物流フロー（便/日・仮値。実運用データで差替え）
const SITE_FLOWS = [
  ["hazA","paint1",12], ["hazB","paint2",10], ["hazNew","varnish",8],
  ["tankA","paint1",6], ["tankA","paint2",5],           // 実際は配管の可能性→要確認
  ["varnish","paint1",8], ["varnish","paint2",6],
  ["paint1","tint",8],  ["tint","whGen",8],
  ["paint1","whGen",10],["paint2","whGen",12],
  ["whGen","gate",16],  ["whNew","paint1",6], ["lab","paint1",2],
];

// ================= 建屋内部プリセット（アトミクス加須 現地取材ベース） =================
// proc: IN/OUT MILL(分散ミル) DSP(門型ディスパー槽) TNK(床置き調合槽) PTK(可搬ステン槽)
//       KVT(縦型KVタンク) FIL(充填ライン) CAN(一斗缶ブロック) DRM(ドラムパレット)
//       BAG(紙袋パレット) FRC(フレコン) NST(ネステナー) RCK(パレットラック)
//       SHL(顔料棚) EV(荷物用EV) HST(天井ホイスト) FEX(消火栓)
const PROC_COLOR = { IN:0x9da7b3, OUT:0x9da7b3, MILL:0x6fbf73, DSP:0x58a6ff, TNK:0x9aa3ad,
  PTK:0xc0c8d0, KVT:0xf778ba, FIL:0xd29922, CAN:0x3fb950, DRM:0x2f81f7, BAG:0xcfa96b,
  FRC:0xe8b04a, NST:0xf85149, RCK:0x58a6ff, SHL:0xbc8cff, EV:0xe8731a, HST:0xd29922, FEX:0xff7b72, IBC:0xd7dde2 };
const PROC_JP={ IN:"搬入口", OUT:"搬出口", MILL:"分散ミル", DSP:"ディスパー槽", TNK:"調合槽",
  PTK:"可搬槽", KVT:"KVタンク", FIL:"充填ライン", CAN:"製品缶", DRM:"ドラム", BAG:"原料袋",
  FRC:"フレコン", NST:"ネステナー", RCK:"ラック", SHL:"棚", IBC:"IBC", EV:"EV",
  HST:"ホイスト", FEX:"消火栓" };

const PRESETS = {
  paint: {  // 生産棟: 原料→分散→調合→KVタンク→充填→製品→出荷（ゾーニング）
    items:[["IN","搬入口",-.46,.00],
           ["BAG","原料(KC-1000)",-.40,-.22],["BAG","原料(ソフトン)",-.40,-.08],
           ["BAG","原料(酸化チタン)",-.40,.08],["FRC","フレコン(備北)",-.40,.24],
           ["DRM","溶剤ドラム",-.33,-.22],["FRC","顔料フレコン",-.33,.24],
           ["HST","天井ホイスト",-.36,.02],
           ["MILL","ATOM'X分散ミル M-1",-.27,-.16],["MILL","ATOM'X分散ミル M-2",-.27,.00],
           ["MILL","ATOM'X分散ミル M-3",-.27,.16],
           ["DSP","ディスパー槽 T-41",-.19,-.21,{num:"41"}],["DSP","ディスパー槽 T-43",-.19,-.06,{num:"43"}],
           ["DSP","ディスパー槽 T-47",-.19,.09,{num:"47"}],["DSP","ディスパー槽 T-48",-.19,.23,{num:"48"}],
           ["TNK","調合槽 T-203",-.11,-.15,{num:"203"}],["TNK","調合槽 T-208",-.11,.03,{num:"208"}],
           ["TNK","調合槽 T-220",-.11,.20,{num:"220"}],
           ["KVT","KVタンク KV-2",-.03,-.19,{kv:"green"}],["KVT","KVタンク KV-4",-.03,-.03,{kv:"pink"}],
           ["KVT","KVタンク KV-6",-.03,.12,{kv:"red"}],["KVT","KVタンク KV-8",-.03,.26,{kv:"green"}],
           ["FIL","SS-2000充填ライン 1",.06,-.15],["FIL","SS-2000充填ライン 2",.06,.03],
           ["FIL","KOYO缶充填機",.06,.20,{v:"koyo"}],
           ["CAN","銀缶(充填待ち)",.14,-.21,{v:"silver"}],["CAN","銀缶(充填待ち)",.14,.23,{v:"silver"}],
           ["CAN","製品(ハードライン)",.22,-.21,{v:"tiger"}],["CAN","製品(橙縞)",.22,-.06,{v:"orangeStripe"}],
           ["CAN","製品(フォルティス)",.22,.09,{v:"blueCheck"}],["CAN","製品(緑市松)",.22,.23,{v:"greenCheck"}],
           ["NST","ネステナー",.30,-.21],["DRM","製品ドラム",.30,-.03],
           ["DRM","製品ドラム",.30,.12],["IBC","IBCコンテナ",.30,.25],
           ["EV","荷物用EV",.38,-.22],["FEX","消火栓",.38,.26,{noOcc:true}],
           ["OUT","搬出口",.46,.00]],
    flows:[["IN","BAG",6],["IN","FRC",4],["IN","DRM",3],["BAG","MILL",8],["FRC","MILL",4],
           ["MILL","DSP",8],["DRM","DSP",3],["DSP","TNK",5],["TNK","KVT",6],["DSP","KVT",5],
           ["KVT","FIL",10],["FIL","CAN",10],["CAN","NST",3],["CAN","OUT",12],
           ["DRM","OUT",3],["IBC","OUT",2]] },
  varnish: {  // 反応槽→KV→充填→EPO缶
    items:[["IN","搬入口",-.44,.00],
           ["DRM","原料ドラム",-.36,-.20],["DRM","原料ドラム",-.36,.02],["BAG","樹脂原料",-.36,.22],
           ["TNK","反応槽 T-201",-.22,-.20,{num:"201"}],["TNK","反応槽 T-203",-.22,-.02,{num:"203"}],
           ["TNK","反応槽 T-208",-.22,.16,{num:"208"}],["TNK","反応槽 T-210",-.08,-.12,{num:"210"}],
           ["KVT","KVタンク",-.08,.12,{kv:"green"}],["KVT","KVタンク",.04,-.06,{kv:"pink"}],
           ["FIL","充填ライン 1",.16,-.14],["FIL","充填ライン 2",.16,.12],
           ["CAN","EPO缶パレット",.30,-.16,{v:"grayGreen"}],["CAN","EPO缶パレット",.30,.10,{v:"grayGreen"}],
           ["FEX","消火栓",.38,.22,{noOcc:true}],["OUT","搬出口",.44,.00]],
    flows:[["IN","DRM",5],["IN","BAG",3],["DRM","TNK",8],["BAG","TNK",3],["TNK","KVT",6],
           ["KVT","FIL",8],["FIL","CAN",8],["CAN","OUT",8]] },
  tint: {  // 調色: 顔料棚+可搬ステン槽群+ディスパー
    items:[["IN","搬入口",-.44,.00],
           ["SHL","顔料棚(赤色系)",-.34,-.20],["SHL","顔料棚(黄色系)",-.34,-.02],
           ["SHL","顔料棚(弁柄系)",-.34,.16],["SHL","顔料棚(チタン系)",-.22,-.22],
           ["PTK","可搬槽 7-1",-.18,-.06,{num:"7-1"}],["PTK","可搬槽 10-2",-.18,.10,{num:"10-2"}],
           ["PTK","可搬槽 10-3",-.18,.24,{num:"10-3"}],["PTK","可搬槽 15-2",-.08,-.18,{num:"15-2"}],
           ["PTK","可搬槽 15-3",-.08,-.02,{num:"15-3"}],["PTK","可搬槽 20-1",-.08,.14,{num:"20-1"}],
           ["PTK","可搬槽 20-2",.02,-.10,{num:"20-2"}],["PTK","可搬槽 5-1",.02,.22,{num:"5-1"}],
           ["DSP","調色ディスパー D-123",.12,-.16,{num:"123"}],["DSP","調色ディスパー D-124",.12,.08,{num:"124"}],
           ["FIL","小口充填 1",.26,-.14],["FIL","小口充填 2",.26,.10],
           ["CAN","製品(緑市松)",.34,-.18,{v:"greenCheck"}],["CAN","製品(青市松)",.34,.16,{v:"blueCheck"}],
           ["OUT","搬出口",.44,.00]],
    flows:[["IN","SHL",6],["SHL","PTK",8],["PTK","DSP",8],["DSP","FIL",6],["FIL","CAN",6],["CAN","OUT",6]] },
  wh: {  // 出荷/原料倉庫: 缶ブロックの列・ラック・ネステナー・ドラム
    items:[["IN","搬入口",-.47,.00],
           ["CAN","フォルティス(青市松)",-.40,-.22,{v:"blueCheck"}],["CAN","フロアクリーン(緑市松)",-.40,.22,{v:"greenCheck"}],
           ["CAN","ハードライン(トラ)",-.32,-.22,{v:"tiger"}],["CAN","ハードライン(橙縞)",-.32,.22,{v:"orangeStripe"}],
           ["CAN","銀缶(シンナー)",-.24,-.22,{v:"silver"}],["CAN","溶剤缶(5027)",-.24,.22,{v:"gray"}],
           ["CAN","フォルティス(青市松)",-.16,-.22,{v:"blueCheck"}],["CAN","EPO缶",-.16,.22,{v:"grayGreen"}],
           ["RCK","パレットラック 1",-.04,-.22],["RCK","パレットラック 2",-.04,.22],
           ["RCK","パレットラック 3",.06,-.22],["BAG","紙袋パレット",.06,.22],
           ["BAG","紙袋パレット",.16,-.22],["NST","ネステナー",.16,.22],
           ["NST","ネステナー",.26,-.22],["DRM","製品ドラム",.26,.22],
           ["DRM","製品ドラム",.34,-.22],["FRC","フレコン",.34,.22],
           ["IBC","IBCコンテナ",.40,-.20],["FEX","消火栓",.40,.24,{noOcc:true}],
           ["OUT","搬出口",.47,.00]],
    flows:[["IN","CAN",12],["CAN","OUT",16],["IN","RCK",6],["RCK","OUT",6],
           ["IN","BAG",5],["BAG","OUT",5],["DRM","OUT",5],["NST","OUT",4],
           ["FRC","OUT",3],["IBC","OUT",2]] },
  hazwh: {  // 危険物倉庫: ドラム・溶剤缶・消火栓
    items:[["IN","搬入口",-.42,.00],
           ["DRM","溶剤ドラム",-.32,-.20],["DRM","溶剤ドラム",-.32,.20],
           ["DRM","樹脂ドラム",-.16,-.20],["DRM","ドラム(青)",-.16,.20],
           ["DRM","ドラム(緑)",.00,-.20],["CAN","銀缶(溶剤5027)",.00,.20,{v:"gray"}],
           ["CAN","銀缶(溶剤)",.14,-.18,{v:"silver"}],["NST","ネステナー",.14,.20],
           ["IBC","IBCコンテナ",.26,-.18],["FEX","消火栓",.26,.22,{noOcc:true}],
           ["OUT","搬出口",.42,.00]],
    flows:[["IN","DRM",8],["DRM","OUT",8],["CAN","OUT",5],["NST","OUT",3],["IBC","OUT",2]] },
  lab: {  // 研究棟
    items:[["IN","入口",-.40,.00],["SHL","試験棚",-.24,-.18],["SHL","試験棚",-.24,.18],
           ["SHL","サンプル棚",-.06,-.18],["PTK","試作槽",-.06,.14,{num:"L-1"}],
           ["PTK","試作槽",.10,-.10,{num:"L-2"}],["FIL","試験充填",.22,.12],
           ["CAN","サンプル缶",.30,-.14,{v:"silver"}],["OUT","出口",.40,.00]],
    flows:[["IN","SHL",4],["SHL","PTK",3],["PTK","FIL",2],["FIL","CAN",2],["CAN","OUT",2]] },
};

// 設備の基準寸法（u に対する倍率 [w,d,h]）
const PROC_DIMS={ IN:[0.9,1.6,0.4], OUT:[0.9,1.6,0.4], MILL:[1.35,1.0,1.25], DSP:[1.45,1.45,1.65],
  TNK:[1.5,1.5,1.05], PTK:[0.85,0.85,0.95], KVT:[1.1,1.1,2.1], FIL:[2.3,0.9,1.05],
  CAN:[1.5,1.15,1.35], DRM:[1.35,1.0,0.95], BAG:[1.35,1.1,1.15], FRC:[0.95,0.95,1.3],
  NST:[1.5,0.95,1.7], RCK:[2.1,0.95,1.9], SHL:[1.7,0.6,1.6], EV:[1.3,1.3,3.4],
  HST:[3.2,0.5,2.6], FEX:[0.8,0.45,1.1], IBC:[1.0,1.0,1.15] };
const PROC_ELONG=new Set(["FIL","RCK","SHL","HST","IN","OUT","CAN","NST"]);
const LEGACY_SCALE=2.8;
const INT_SCALE=1;   // 表示用拡大率。内部平面寸法・経路長を実寸相当へ戻す際に使用。実測ではない。

// ================= 汎用エンジン（コンテキスト単位でA*・指標を計算） =================
const SPEED = { site:7000, interior:4000 }; // m/h

function newCtx(id, kind, W, D, cell, snap, items, flows, label){
  return { id, kind, W, D, cell, snap, items, flows, label,
    cols:0, rows:0, occ:null, routes:[], m:{total:0,longest:0,crossings:0,hours:0},
    baseline:null, cong:new Map() };
}
const snapTo = (v,s)=> Math.round(v/s)*s;

function buildGrid(ctx){
  ctx.cols = Math.ceil(ctx.W/ctx.cell); ctx.rows = Math.ceil(ctx.D/ctx.cell);
  ctx.occ = new Uint8Array(ctx.cols*ctx.rows);
  const margin = ctx.kind==="site" ? 1 : 0;
  ctx.items.forEach(it=>{
    if(it.noOcc) return;
    const c0=clampC(ctx, wToC(ctx, it.x-it.w/2)-margin), c1=clampC(ctx, wToC(ctx, it.x+it.w/2)+margin);
    const r0=clampR(ctx, wToR(ctx, it.z-it.d/2)-margin), r1=clampR(ctx, wToR(ctx, it.z+it.d/2)+margin);
    for(let c=c0;c<=c1;c++) for(let r=r0;r<=r1;r++) ctx.occ[r*ctx.cols+c]=1;
  });
}
const wToC=(ctx,x)=>Math.floor((x+ctx.W/2)/ctx.cell);
const wToR=(ctx,z)=>Math.floor((z+ctx.D/2)/ctx.cell);
const cToW=(ctx,c)=>-ctx.W/2+(c+0.5)*ctx.cell;
const rToW=(ctx,r)=>-ctx.D/2+(r+0.5)*ctx.cell;
const clampC=(ctx,c)=>Math.max(0,Math.min(ctx.cols-1,c));
const clampR=(ctx,r)=>Math.max(0,Math.min(ctx.rows-1,r));

function nearestFree(ctx,c,r){
  if(!ctx.occ[r*ctx.cols+c]) return [c,r];
  for(let rad=1; rad<Math.max(ctx.cols,ctx.rows); rad++){
    for(let dc=-rad;dc<=rad;dc++) for(let dr=-rad;dr<=rad;dr++){
      const nc=clampC(ctx,c+dc), nr=clampR(ctx,r+dr);
      if(!ctx.occ[nr*ctx.cols+nc]) return [nc,nr];
    }
  }
  return [c,r];
}
function reachable(ctx, sIdx){
  const cols=ctx.cols, rows=ctx.rows, occ=ctx.occ;
  const mark=new Uint8Array(cols*rows);
  const q=[sIdx]; mark[sIdx]=1; let size=1;
  while(q.length){
    const cur=q.pop();
    const cc=cur%cols, cr=(cur-cc)/cols;
    for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nc=cc+dc, nr=cr+dr;
      if(nc<0||nr<0||nc>=cols||nr>=rows) continue;
      const ni=nr*cols+nc;
      if(occ[ni]||mark[ni]) continue;
      mark[ni]=1; size++; q.push(ni);
    }
  }
  return {mark,size};
}
function nearestInRegion(ctx, mark, tc, tr){
  let best=-1, bd=Infinity;
  for(let r=0;r<ctx.rows;r++) for(let c=0;c<ctx.cols;c++){
    const i=r*ctx.cols+c;
    if(!mark[i]) continue;
    const d=(c-tc)*(c-tc)+(r-tr)*(r-tr);
    if(d<bd){ bd=d; best=i; }
  }
  return best;
}
// A*用 二分ヒープ（f値最小を O(log n) で取り出す）
class MinHeap{
  constructor(){ this.k=[]; this.v=[]; }
  get size(){ return this.k.length; }
  push(i,f){
    const k=this.k, v=this.v; k.push(f); v.push(i);
    let c=k.length-1;
    while(c>0){ const p=(c-1)>>1; if(k[p]<=k[c]) break;
      const tk=k[p]; k[p]=k[c]; k[c]=tk; const tv=v[p]; v[p]=v[c]; v[c]=tv; c=p; }
  }
  pop(){
    const k=this.k, v=this.v; const top=v[0];
    const lk=k.pop(), lv=v.pop();
    if(k.length){ k[0]=lk; v[0]=lv; let c=0; const n=k.length;
      for(;;){ const l=2*c+1, r=l+1; let m=c;
        if(l<n&&k[l]<k[m]) m=l; if(r<n&&k[r]<k[m]) m=r;
        if(m===c) break;
        const tk=k[m]; k[m]=k[c]; k[c]=tk; const tv=v[m]; v[m]=v[c]; v[c]=tv; c=m; }
    }
    return top;
  }
}
function astar(ctx, sx,sz, gx,gz){
  let [sc,sr]=nearestFree(ctx, clampC(ctx,wToC(ctx,sx)), clampR(ctx,wToR(ctx,sz)));
  let [gc,gr]=nearestFree(ctx, clampC(ctx,wToC(ctx,gx)), clampR(ctx,wToR(ctx,gz)));
  // 連結性の保証: 到達不能なら大きい方の連結領域を基準に、他端をその領域内の最近傍セルへ吸着
  {
    const cols0=ctx.cols;
    const sIdx0=sr*cols0+sc, gIdx0=gr*cols0+gc;
    const rs=reachable(ctx, sIdx0);
    if(!rs.mark[gIdx0]){
      const rg=reachable(ctx, gIdx0);
      if(rg.size>rs.size){
        const ni=nearestInRegion(ctx, rg.mark, sc, sr);
        if(ni>=0){ sc=ni%cols0; sr=(ni-sc)/cols0; }
      } else {
        const ni=nearestInRegion(ctx, rs.mark, gc, gr);
        if(ni>=0){ gc=ni%cols0; gr=(ni-gc)/cols0; }
      }
    }
  }
  const cols=ctx.cols, rows=ctx.rows, occ=ctx.occ, N=cols*rows;
  const g=new Float32Array(N).fill(Infinity), f=new Float32Array(N).fill(Infinity);
  const came=new Int32Array(N).fill(-1);
  const closed=new Uint8Array(N);
  const open=new MinHeap();          // 二分ヒープ（旧: Setの線形走査 → 起動・再計算を大幅高速化）
  const sIdx=sr*cols+sc, gIdx=gr*cols+gc;
  const oct=(c,r)=>{const dx=Math.abs(c-gc),dy=Math.abs(r-gr);return (dx+dy)+(1.41421-2)*Math.min(dx,dy);};
  g[sIdx]=0; f[sIdx]=oct(sc,sr); open.push(sIdx,f[sIdx]);
  const dirs=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.41421],[1,-1,1.41421],[-1,1,1.41421],[-1,-1,1.41421]];
  let guard=0;
  while(open.size){
    if(++guard>400000) break;
    let cur=open.pop();
    if(closed[cur]) continue;          // 遅延削除（古いエントリはスキップ）
    closed[cur]=1;
    if(cur===gIdx){
      const path=[];
      while(cur!==-1){ const c=cur%cols, r=(cur-c)/cols; path.push([cToW(ctx,c), rToW(ctx,r)]); cur=came[cur]; }
      return path.reverse();
    }
    const cc=cur%cols, cr=(cur-cc)/cols;
    for(const [dc,dr,w] of dirs){
      const nc=cc+dc, nr=cr+dr;
      if(nc<0||nr<0||nc>=cols||nr>=rows) continue;
      const ni=nr*cols+nc;
      if(occ[ni]||closed[ni]) continue;
      if(dc!==0&&dr!==0){ if(occ[cr*cols+nc]||occ[nr*cols+cc]) continue; }
      const tg=g[cur]+w;
      if(tg<g[ni]){ came[ni]=cur; g[ni]=tg; f[ni]=tg+oct(nc,nr); open.push(ni,f[ni]); }
    }
  }
  return null;
}
function endpoint(ctx, key){
  const ms = ctx.items.filter(it=> ctx.kind==="site" ? it.id===key : it.proc===key);
  if(!ms.length) return {x:0,z:0};
  let x=0,z=0; ms.forEach(m=>{x+=m.x;z+=m.z;});
  return {x:x/ms.length, z:z/ms.length};
}
// 経路と指標を計算（描画なし）
function computeData(ctx){
  if(ctx.kind==="interior") return v4Compute(ctx);
  buildGrid(ctx);
  ctx.routes = [];
  ctx.flows.forEach(([fk,tk,reps])=>{
    const a=endpoint(ctx,fk), b=endpoint(ctx,tk);
    let path = astar(ctx, a.x,a.z, b.x,b.z);
    let pts = (path && path.length>1) ? path.map(([x,z])=>({x,z})) : [{x:a.x,z:a.z},{x:b.x,z:b.z}];
    let len=0; for(let i=1;i<pts.length;i++) len+=Math.hypot(pts[i].x-pts[i-1].x, pts[i].z-pts[i-1].z);
    const srcIt = ctx.items.find(it=> ctx.kind==="site" ? it.id===fk : it.proc===fk);
    const modelLen=len; if(ctx.kind==="interior") len/=INT_SCALE;
    ctx.routes.push({ pts, len, modelLen, reps, fk, tk, color: srcIt? srcIt.color : 0x58a6ff });
  });
  let total=0, longest=0;
  ctx.routes.forEach(r=>{ total+=r.len*r.reps*2; longest=Math.max(longest,r.len); });
  let crossings=0;
  const segs=[];
  ctx.routes.forEach((r,ri)=>{ for(let i=1;i<r.pts.length;i++) segs.push([r.pts[i-1],r.pts[i],ri]); });
  for(let i=0;i<segs.length;i++) for(let j=i+1;j<segs.length;j++){
    if(segs[i][2]===segs[j][2]) continue;
    if(segInt(segs[i][0],segs[i][1],segs[j][0],segs[j][1])) crossings++;
  }
  const speed = ctx.kind==="site" ? SPEED.site : SPEED.interior;
  ctx.m = { total:Math.round(total), longest:Math.round(longest), crossings, hours: total/speed };
  return ctx.m;
}
function segInt(p1,p2,p3,p4){
  const d=(p2.x-p1.x)*(p4.z-p3.z)-(p2.z-p1.z)*(p4.x-p3.x);
  if(Math.abs(d)<1e-6) return false;
  const t=((p3.x-p1.x)*(p4.z-p3.z)-(p3.z-p1.z)*(p4.x-p3.x))/d;
  const u=((p3.x-p1.x)*(p2.z-p1.z)-(p3.z-p1.z)*(p2.x-p1.x))/d;
  return t>0.02&&t<0.98&&u>0.02&&u<0.98;
}

// ================= コンテキスト生成 =================
function makeSiteCtx(){
  const items = BUILDINGS.map(([id,name,type,x,z,w,d,h,opt])=>({
    id, name, proc:type, x, z, w, d, h, color:TYPE_COLOR[type],
    fixed:!!opt.fixed, enter:!!opt.enter, tanks:opt.tanks||0, noOcc:!!opt.noOcc }));
  return newCtx("site","site", SITE_W, SITE_D, 5, 5, items, SITE_FLOWS, "敷地全体");
}
function makeInteriorCtx(b){
  const preset = PRESETS[b.proc]; if(!preset) return null;
  const W=b.w*INT_SCALE, D=b.d*INT_SCALE, s=Math.min(W,D);
  const u=Math.min(Math.max(s*LEGACY_SCALE*0.16, 2.5), 7)/LEGACY_SCALE;
  const rot = D > W;   // 細長い建屋では工程ラインを長軸に沿わせ通路を確保
  const items = preset.items.map((entry, itemIndex)=>{
    const [proc,name,nx0,nz0,opts0]=entry;
    const opts=opts0||{};
    const nx = rot ? nz0 : nx0, nz = rot ? nx0 : nz0;
    const dm=PROC_DIMS[proc]||[1,1,0.9];
    let w=u*dm[0]*(opts.sw||1), d=u*dm[1]*(opts.sd||1), h=u*dm[2]*(opts.sh||1);
    if(rot && PROC_ELONG.has(proc)){ const t=w; w=d; d=t; }
    let x=Math.max(-W/2+w/2+0.5, Math.min(W/2-w/2-0.5, nx*W));
    let z=Math.max(-D/2+d/2+0.5, Math.min(D/2-d/2-0.5, nz*D));
    x=snapTo(x,0.25); z=snapTo(z,0.25);
    x=Math.max(-W/2+w/2, Math.min(W/2-w/2, x));
    z=Math.max(-D/2+d/2, Math.min(D/2-d/2, z));
    return { assetId:b.id+"-"+proc+"-"+String(itemIndex+1).padStart(3,"0"), evidence:"assumed", maintenance:0.8, notes:"", proc, name, x, z, w, d, h, bw:w, bd:d, rot:0,
             color:PROC_COLOR[proc]||0x9da7b3,
             fixed:(proc==="IN"||proc==="OUT"||proc==="EV"),
             noOcc:!!opts.noOcc||proc==="HST",
             variant:opts.v||null, num:opts.num||null, kv:opts.kv||null };
  });
  return newCtx(b.id, "interior", W, D, 2.5/LEGACY_SCALE, 0.25, items, preset.flows, b.name);
}

const siteCtx = makeSiteCtx();
const interiorCtxs = new Map();
siteCtx.items.forEach(b=>{ if(b.enter){ const c=makeInteriorCtx(b); if(c) interiorCtxs.set(b.id, c); } });

@@INCLUDE js/layouts.js@@
let ctx = siteCtx;           // アクティブなコンテキスト
let currentBuilding = null;  // 内部表示中の建屋

// ================= ラベルスプライト =================
function makeLabel(text, scale=1, color="#e6edf3"){
  if(drawMode && color==="#e6edf3") color="#22303e";
  const cvs=document.createElement("canvas"); cvs.width=512; cvs.height=112;
  const c=cvs.getContext("2d");
  c.font="700 52px 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";
  c.textAlign="center"; c.textBaseline="middle";
  c.shadowColor=drawMode? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)"; c.shadowBlur=10;
  c.fillStyle=color; c.fillText(text, 256, 56);
  const tex=new THREE.CanvasTexture(cvs); tex.anisotropy=4;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, depthWrite:false}));
  sp.scale.set(26*scale, 5.7*scale, 1);
  return sp;
}

// ================= 建屋モデル（敷地ビュー） =================
function makeBuildingMesh(b){
  const g = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: bimMode?0xaab4bf:0xe9ebe7,
    roughness:0.72, metalness:0.08, transparent:bimMode,
    opacity: bimMode? (b.enter?0.05:0.10) : 1 });
  const roofMat = new THREE.MeshStandardMaterial({ color: bimMode?0x1c2129:0x565e66,
    roughness:0.9, transparent:bimMode, opacity: bimMode?0.05:1 });
  if(b.proc==="tank"){
    const plat=new THREE.Mesh(new THREE.BoxGeometry(b.w,0.6,b.d),
      new THREE.MeshStandardMaterial({color:0x3a4250, roughness:0.9}));
    plat.position.y=0.3; g.add(plat);
    const n=b.tanks||3, r=Math.min(b.d*0.38, (b.w/n)*0.38);
    for(let i=0;i<n;i++){
      const t=new THREE.Mesh(new THREE.CylinderGeometry(r,r,b.h,20),
        new THREE.MeshStandardMaterial({color:0xd8dee5, roughness:0.35, metalness:0.55}));
      t.position.set(-b.w/2+(i+0.5)*(b.w/n), b.h/2+0.6, 0); g.add(t);
      const cap=new THREE.Mesh(new THREE.SphereGeometry(r,20,10,0,Math.PI*2,0,Math.PI/2),
        t.material); cap.position.set(t.position.x, b.h+0.6, 0); g.add(cap);
    }
    // 防液堤（コンクリ低壁）
    const bund=new THREE.MeshStandardMaterial({color:0x8f959c,roughness:0.9});
    const bw2=b.w+2.6, bd2=b.d+2.6;
    [[0,-bd2/2],[0,bd2/2]].forEach(([x2,z2])=>{
      const m2=new THREE.Mesh(new THREE.BoxGeometry(bw2,0.9,0.28),bund);
      m2.position.set(x2,0.45,z2); g.add(m2); });
    [[-bw2/2,0],[bw2/2,0]].forEach(([x2,z2])=>{
      const m2=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.9,bd2),bund);
      m2.position.set(x2,0.45,z2); g.add(m2); });
    // 点検櫓（階段塔+踊り場）
    const yag=new THREE.MeshStandardMaterial({color:0x6e7681,roughness:0.6,metalness:0.3});
    const yx=-b.w/2+1.3;
    [[-0.55,-0.55],[0.55,-0.55],[-0.55,0.55],[0.55,0.55]].forEach(([sx,sz])=>{
      const p2=new THREE.Mesh(new THREE.BoxGeometry(0.12,b.h+1.2,0.12),yag);
      p2.position.set(yx+sx,(b.h+1.2)/2,sz); g.add(p2); });
    for(let sy=1;sy<=4;sy++){
      const br2=new THREE.Mesh(new THREE.BoxGeometry(1.25,0.07,1.25),yag);
      br2.position.set(yx,(b.h+1.2)*sy/4-0.4,0); g.add(br2);
    }
    const plat2=new THREE.Mesh(new THREE.BoxGeometry(1.5,0.1,1.5),yag);
    plat2.position.set(yx,b.h+1.15,0); g.add(plat2);
    [[0,-0.75],[0,0.75]].forEach(([x2,z2])=>{
      const rl=new THREE.Mesh(new THREE.BoxGeometry(1.5,0.06,0.06),yag);
      rl.position.set(yx+x2,b.h+2.0,z2); g.add(rl); });
  } else if(b.proc==="pond"){
    const p=new THREE.Mesh(new THREE.CylinderGeometry(b.w/2, b.w/2, 0.3, 24),
      new THREE.MeshStandardMaterial({color:0x1f4a8f, roughness:0.15, metalness:0.4}));
    p.scale.z=b.d/b.w; p.position.y=0.15; g.add(p);
  } else if(b.proc==="gate"){
    const pil=new THREE.MeshStandardMaterial({color:0xb9c2cc, roughness:0.6});
    [-b.w/2, b.w/2].forEach(x=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(1.2,b.h,1.2),pil);
      m.position.set(x,b.h/2,0); g.add(m); });
    const bar=new THREE.Mesh(new THREE.BoxGeometry(b.w,0.4,0.3),
      new THREE.MeshStandardMaterial({color:0xe3b341})); bar.position.y=b.h*0.55; g.add(bar);
  } else {
    const body=new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), wallMat);
    body.position.y=b.h/2; g.add(body);
    const roof=new THREE.Mesh(new THREE.BoxGeometry(b.w*1.01, 0.5, b.d*1.01), roofMat);
    roof.position.y=b.h+0.25; g.add(roof);
    const edge=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(b.w,b.h,b.d)),
      new THREE.LineBasicMaterial({color: bimMode? (drawMode?0x4a5665:0x8b98a5) : (drawMode?0x39424e:0x30363d),
        transparent:true, opacity: bimMode?0.9:(drawMode?0.75:0.35)}));
    edge.position.y=b.h/2; g.add(edge);
    if(!bimMode){
      // ---- 外観写真ベースのファサード（白壁+連続窓帯+パラペット笠木） ----
      const winMat=new THREE.MeshStandardMaterial({color:0x2c3947,roughness:0.25,metalness:0.45});
      const mulMat=new THREE.MeshStandardMaterial({color:0xf2f4f1,roughness:0.6});
      const capMat=new THREE.MeshStandardMaterial({color:0x3a434e,roughness:0.6});
      const nFl=Math.max(1,Math.round(b.h/4.2));
      for(let f=0;f<nFl;f++){
        if(b.id==="whGen" && f===0) continue;
        const wy=(b.h/nFl)*(f+0.62);
        [-1,1].forEach(s=>{
          const m=new THREE.Mesh(new THREE.BoxGeometry(b.w*0.88,1.05,0.14),winMat);
          m.position.set(0,wy,s*(b.d/2+0.02)); g.add(m); });
        [-1,1].forEach(s=>{
          const m=new THREE.Mesh(new THREE.BoxGeometry(0.14,1.05,b.d*0.82),winMat);
          m.position.set(s*(b.w/2+0.02),wy,0); g.add(m); });
        const nMul=Math.max(3,Math.round(b.w/5));
        for(let i=1;i<nMul;i++){
          const m=new THREE.Mesh(new THREE.BoxGeometry(0.1,1.05,0.18),mulMat);
          m.position.set(-b.w*0.44+i*(b.w*0.88/nMul),wy,b.d/2+0.03); g.add(m);
          const m2=m.clone(); m2.position.z=-b.d/2-0.03; g.add(m2);
        }
      }
      const cap=new THREE.Mesh(new THREE.BoxGeometry(b.w*1.03,0.45,b.d*1.03),capMat);
      cap.position.y=b.h+0.2; g.add(cap);
      const band=new THREE.Mesh(new THREE.BoxGeometry(b.w*1.015,0.4,b.d*1.015),
        new THREE.MeshStandardMaterial({color:b.color,roughness:0.6}));
      band.position.y=b.h-0.78; g.add(band);
      // ---- 基礎立上り（建屋を地面に据える） ----
      const plinth=new THREE.Mesh(new THREE.BoxGeometry(b.w+1.6,0.26,b.d+1.6),
        new THREE.MeshStandardMaterial({color:0x6f7780,roughness:0.92}));
      plinth.position.y=0.13; g.add(plinth);
      // ---- 折板屋根のリブ（短辺方向・1本のマージメッシュ） ----
      {
        const alongX=b.w>=b.d, L2=alongX?b.w:b.d, S2=alongX?b.d:b.w;
        const n=Math.max(4,Math.floor(L2/1.0)); const ribs=[];
        for(let i=0;i<=n;i++){
          const u=-L2/2+0.5+i*((L2-1)/n);
          const rg= alongX? new THREE.BoxGeometry(0.16,0.12,S2*0.96) : new THREE.BoxGeometry(S2*0.96,0.12,0.16);
          rg.translate(alongX?u:0, b.h+0.56, alongX?0:u); ribs.push(rg);
        }
        g.add(new THREE.Mesh(mergeGeometries(ribs),
          new THREE.MeshStandardMaterial({color:0x6b737c,roughness:0.72,metalness:0.28})));
      }
      // ---- トップライト（採光帯） ----
      if(b.enter){
        const alongX=b.w>=b.d;
        const skM=new THREE.MeshStandardMaterial({color:0xbfe0f2,roughness:0.2,metalness:0.1,
          transparent:true,opacity:0.78,emissive:0x1d3a4d,emissiveIntensity:0.45});
        [-0.22,0.22].forEach(f=>{
          const m=new THREE.Mesh(alongX? new THREE.BoxGeometry(b.w*0.72,0.42,1.6) : new THREE.BoxGeometry(1.6,0.42,b.d*0.72), skM);
          m.position.set(alongX?0:f*b.w, b.h+0.76, alongX?f*b.d:0); m.userData.noShadow=true; g.add(m);
        });
      }
      // ---- 屋上機器（室外機・換気ファン） ----
      if(["paint","varnish","tint","lab","office"].includes(b.proc)){
        const rnd=sRand("roof"+b.id);
        const uM=new THREE.MeshStandardMaterial({color:0xb9c2cc,roughness:0.5,metalness:0.35});
        const fM=new THREE.MeshStandardMaterial({color:0x30343a,roughness:0.6});
        const nU=2+Math.round(rnd()*2);
        for(let i=0;i<nU;i++){
          const ux=(rnd()-0.5)*b.w*0.55, uz=(rnd()-0.5)*b.d*0.55;
          const u=new THREE.Mesh(new THREE.BoxGeometry(2.4,1.3,1.6),uM); u.position.set(ux,b.h+1.15,uz); g.add(u);
          const fan=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,0.25,12),fM); fan.position.set(ux+0.5,b.h+1.9,uz); g.add(fan);
        }
      }
      // ---- 竪樋（四隅） ----
      {
        const dpM=new THREE.MeshStandardMaterial({color:0x8a949e,roughness:0.6,metalness:0.3});
        [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>{
          const dp=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,b.h,6),dpM);
          dp.position.set(sx*(b.w/2-0.6),b.h/2,sz*(b.d/2+0.12)); g.add(dp);
        });
      }
      const shutMat=new THREE.MeshStandardMaterial({color:0x767f88,roughness:0.55,metalness:0.3});
      if((b.enter && b.id!=="whGen") || b.proc==="office"){
        const nSh= b.proc==="office"? 0 : Math.max(1,Math.round(b.w/22));
        for(let i=0;i<nSh;i++){
          const m=new THREE.Mesh(new THREE.BoxGeometry(4.4,3.8,0.16),shutMat);
          m.position.set(-b.w/2+(i+0.5)*(b.w/nSh),1.9,-b.d/2-0.03); g.add(m);
        }
        const door=new THREE.Mesh(new THREE.BoxGeometry(1.6,2.4,0.14),winMat);
        door.position.set(b.w*0.38,1.2,-b.d/2-0.03); g.add(door);
        const cano=new THREE.Mesh(new THREE.BoxGeometry(2.6,0.18,1.6),capMat);
        cano.position.set(b.w*0.38,2.8,-b.d/2-0.8); g.add(cano);
      }
      if(b.h>=11){
        const ph=new THREE.Mesh(new THREE.BoxGeometry(b.w*0.26,2.4,b.d*0.3),
          new THREE.MeshStandardMaterial({color:0xe9ebe7,roughness:0.7}));
        ph.position.set(-b.w*0.28,b.h+1.45,-b.d*0.2); g.add(ph);
        const phc=new THREE.Mesh(new THREE.BoxGeometry(b.w*0.27,0.25,b.d*0.31),capMat);
        phc.position.set(-b.w*0.28,b.h+2.72,-b.d*0.2); g.add(phc);
      }
    }
    if(bimMode && b.enter){
      const colMat=new THREE.MeshStandardMaterial({color:0x8b98a5,transparent:true,opacity:0.35,roughness:0.8});
      const nx=Math.max(2,Math.round(b.w/8)), nz2=Math.max(2,Math.round(b.d/8));
      const colGeo=new THREE.BoxGeometry(0.35,b.h,0.35);
      for(let i=0;i<=nx;i++){ [-b.d/2,b.d/2].forEach(z=>{
        const cm=new THREE.Mesh(colGeo,colMat); cm.position.set(-b.w/2+i*(b.w/nx), b.h/2, z); g.add(cm); }); }
      for(let i=1;i<nz2;i++){ [-b.w/2,b.w/2].forEach(x=>{
        const cm=new THREE.Mesh(colGeo,colMat); cm.position.set(x, b.h/2, -b.d/2+i*(b.d/nz2)); g.add(cm); }); }
      const tg=new THREE.BufferGeometry(); const tp=[];
      for(let i=0;i<=nx;i++){ const x=-b.w/2+i*(b.w/nx); tp.push(x,b.h,-b.d/2, x,b.h,b.d/2); }
      tg.setAttribute("position",new THREE.Float32BufferAttribute(tp,3));
      g.add(new THREE.LineSegments(tg,new THREE.LineBasicMaterial({color:0x738094,transparent:true,opacity:0.5})));
    }
  }
  if(b.id==="whGen" && !bimMode){
    // 北面に庇 + A〜E棟札 + シャッター開口
    const canopy=new THREE.Mesh(new THREE.BoxGeometry(b.w*0.97,0.35,3.2),
      new THREE.MeshStandardMaterial({color:0x8a949e,roughness:0.7}));
    canopy.position.set(0,5.4,-b.d/2-1.6); g.add(canopy);
    const shMat=new THREE.MeshStandardMaterial({color:0x5d6570,roughness:0.6,metalness:0.3});
    for(let i=0;i<5;i++){
      const x=-b.w/2+(i+0.5)*(b.w/5);
      const sh=new THREE.Mesh(new THREE.BoxGeometry(5.2,4.4,0.2),shMat);
      sh.position.set(x,2.2,-b.d/2-0.12); g.add(sh);
      const tag=makeLabel(["A","B","C","D","E"][i],0.55,"#e6edf3");
      tag.position.set(x,6.6,-b.d/2-1.8); g.add(tag);
    }
  }
  const lbl=makeLabel(b.name, Math.max(0.7, Math.min(1.4, b.w/40)));
  lbl.position.y=b.h+4.5; g.add(lbl);
  if(b.enter){
    const mark=makeLabel("⏎ 入れます", 0.5, "#58a6ff");
    mark.position.y=b.h+1.8; g.add(mark);
  }
  return g;
}

// ================= テクスチャ工房（Canvas製・写真の色柄を再現） =================
const spinDiscs=[];      // 攪拌中の塗料液面（回転アニメ対象）
const hoistAnims=[];     // 天井ホイスト（トロリー走行）
const craneAnims=[];     // 天井クレーン（走行×横行×巻上げ）
const evAnims=[];        // 荷物用EV（かご昇降）
const canTexCache={};
function canBlockMat(variant){
  if(canTexCache[variant]) return canTexCache[variant];
  const cvs=document.createElement("canvas"); cvs.width=256; cvs.height=256;
  const c=cvs.getContext("2d");
  const base=col=>{ c.fillStyle=col; c.fillRect(0,0,256,256); };
  if(variant==="blueCheck"||variant==="greenCheck"){
    base("#f4f6f8");
    c.fillStyle = variant==="blueCheck" ? "#2f9be0" : "#3fae5a";
    for(let y=0;y<16;y++) for(let x=0;x<16;x++) if((x+y)%2===0) c.fillRect(x*16,y*16,16,16);
    c.fillStyle="rgba(255,255,255,0.92)";
    for(let r=0;r<4;r++) c.fillRect(0,r*64+22,256,22);
  } else if(variant==="tiger"){
    base("#e8b820"); c.fillStyle="#20242a";
    for(let i=-8;i<16;i++){ c.save(); c.translate(i*32,0); c.rotate(-0.5); c.fillRect(0,-80,14,460); c.restore(); }
  } else if(variant==="orangeStripe"){
    base("#f0efec"); c.fillStyle="#e8731a";
    for(let i=0;i<8;i++) c.fillRect(i*32,0,16,256);
  } else if(variant==="silver"){
    const gr=c.createLinearGradient(0,0,256,0);
    gr.addColorStop(0,"#aeb5bc"); gr.addColorStop(.25,"#e6eaee"); gr.addColorStop(.5,"#c2c8ce");
    gr.addColorStop(.75,"#eef1f4"); gr.addColorStop(1,"#aeb5bc");
    c.fillStyle=gr; c.fillRect(0,0,256,256);
    c.fillStyle="#f8fafb";
    for(let r=0;r<4;r++) for(let q=0;q<4;q++) c.fillRect(q*64+16,r*64+18,32,26);
  } else {  // gray / grayGreen
    base("#6c7178"); c.fillStyle="#f4f4f2";
    for(let r=0;r<4;r++) for(let q=0;q<4;q++) c.fillRect(q*64+18,r*64+22,28,18);
    if(variant==="grayGreen"){ c.fillStyle="#3fae5a"; for(let r=0;r<4;r++) c.fillRect(0,r*64+6,256,9); }
  }
  c.strokeStyle="rgba(18,22,28,0.5)"; c.lineWidth=3;
  for(let i=0;i<=4;i++){
    c.beginPath(); c.moveTo(i*64,0); c.lineTo(i*64,256); c.stroke();
    c.beginPath(); c.moveTo(0,i*64); c.lineTo(256,i*64); c.stroke();
  }
  const tex=new THREE.CanvasTexture(cvs); tex.anisotropy=4;
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(2,2);
  const m=new THREE.MeshStandardMaterial({map:tex, roughness:0.42, metalness:0.32});
  canTexCache[variant]=m; return m;
}
let _bagMat=null;
function bagMat(){
  if(_bagMat) return _bagMat;
  const cvs=document.createElement("canvas"); cvs.width=128; cvs.height=128;
  const c=cvs.getContext("2d");
  c.fillStyle="#c8a36c"; c.fillRect(0,0,128,128);
  c.fillStyle="rgba(120,90,50,0.5)";
  for(let y=16;y<128;y+=32) c.fillRect(0,y,128,3);
  c.fillStyle="rgba(255,255,255,0.75)"; c.fillRect(18,40,44,20); c.fillRect(74,88,38,16);
  c.fillStyle="#a03030"; c.fillRect(20,42,40,5);
  const tex=new THREE.CanvasTexture(cvs); tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  _bagMat=new THREE.MeshStandardMaterial({map:tex, roughness:0.92});
  return _bagMat;
}
const swirlCache={};
function swirlMat(col){
  const key="s"+col;
  if(swirlCache[key]) return swirlCache[key];
  const cvs=document.createElement("canvas"); cvs.width=128; cvs.height=128;
  const c=cvs.getContext("2d");
  const cc=new THREE.Color(col);
  c.fillStyle="#"+cc.getHexString(); c.fillRect(0,0,128,128);
  const lighter="#"+cc.clone().lerp(new THREE.Color(0xffffff),0.28).getHexString();
  const darker ="#"+cc.clone().lerp(new THREE.Color(0x000000),0.30).getHexString();
  c.translate(64,64);
  [[lighter,0],[darker,2.1]].forEach(([col2,ph])=>{
    c.strokeStyle=col2; c.lineWidth=5; c.beginPath();
    for(let t=0;t<Math.PI*5.5;t+=0.12){
      const r=3+t*3.4, x=Math.cos(t+ph)*r, y=Math.sin(t+ph)*r;
      t===0? c.moveTo(x,y): c.lineTo(x,y);
    }
    c.stroke();
  });
  const tex=new THREE.CanvasTexture(cvs);
  const m=new THREE.MeshStandardMaterial({map:tex, roughness:0.3, metalness:0.05});
  swirlCache[key]=m; return m;
}
const dripCache={};
function dripMat(vi){          // 塗料ダレだらけのステンレス胴（現地写真の質感）
  const key="d"+(vi%4);
  if(dripCache[key]) return dripCache[key];
  const cvs=document.createElement("canvas"); cvs.width=128; cvs.height=128;
  const c=cvs.getContext("2d");
  const gr=c.createLinearGradient(0,0,128,0);
  gr.addColorStop(0,"#9aa2ab"); gr.addColorStop(.5,"#c6ccd3"); gr.addColorStop(1,"#9aa2ab");
  c.fillStyle=gr; c.fillRect(0,0,128,128);
  const rnd=sRand("drip"+(vi%4));
  const cols=["#8a8f98","#c79a1e","#17191d","#dfe3e8","#2f6db3","#7a3030","#2c5b3f","#c46a79"];
  for(let i=0;i<28;i++){
    const x=rnd()*128, w2=1.5+rnd()*3.5, len=8+rnd()*85, y0=rnd()*14;
    c.globalAlpha=0.35+rnd()*0.55;
    c.fillStyle=cols[Math.floor(rnd()*cols.length)];
    c.fillRect(x,y0,w2,len);
    c.beginPath(); c.arc(x+w2/2,y0+len,w2*0.7,0,6.3); c.fill();
  }
  c.globalAlpha=1;
  const tex=new THREE.CanvasTexture(cvs);
  tex.wrapS=THREE.RepeatWrapping; tex.repeat.set(2,1);
  dripCache[key]=new THREE.MeshStandardMaterial({map:tex,roughness:0.5,metalness:0.35});
  return dripCache[key];
}
let _tileMat=null;
function tileMat(){            // 白タイルの腰壁
  if(_tileMat) return _tileMat;
  const cvs=document.createElement("canvas"); cvs.width=128; cvs.height=64;
  const c=cvs.getContext("2d");
  c.fillStyle="#e6e4dc"; c.fillRect(0,0,128,64);
  c.strokeStyle="#b4b2aa"; c.lineWidth=2;
  for(let x=0;x<=128;x+=32){ c.beginPath();c.moveTo(x,0);c.lineTo(x,64);c.stroke(); }
  for(let y=0;y<=64;y+=16){ c.beginPath();c.moveTo(0,y);c.lineTo(128,y);c.stroke(); }
  const rnd=sRand("tile");
  c.globalAlpha=0.25; c.fillStyle="#6a6f66";
  for(let i=0;i<10;i++){ c.beginPath(); c.ellipse(rnd()*128,48+rnd()*16,9,5,0,0,6.3); c.fill(); }
  c.globalAlpha=1;
  const tex=new THREE.CanvasTexture(cvs);
  tex.wrapS=THREE.RepeatWrapping; tex.repeat.set(6,1);
  _tileMat=new THREE.MeshStandardMaterial({map:tex,roughness:0.55});
  return _tileMat;
}
function makeFloorTex(kind, W, D){
  const cvs=document.createElement("canvas");
  cvs.width=512; cvs.height=Math.max(96,Math.min(1024,Math.round(512*D/W)));
  const c=cvs.getContext("2d"), cw=cvs.width, ch=cvs.height;
  const rnd=sRand("floor:"+kind+":"+Math.round(W)+"x"+Math.round(D));
  const blotch=(col,n,rmin,rmax,alpha)=>{
    for(let i=0;i<n;i++){
      c.globalAlpha=alpha*(0.4+rnd()*0.6);
      c.fillStyle=col;
      const r=rmin+rnd()*(rmax-rmin);
      c.beginPath(); c.ellipse(rnd()*cw, rnd()*ch, r, r*(0.5+rnd()*0.7), rnd()*3.14, 0, 6.3); c.fill();
    }
    c.globalAlpha=1;
  };
  if(kind==="paint"||kind==="varnish"){       // 生産棟: 緑塗床+赤通路+色染み
    c.fillStyle="#3e6e52"; c.fillRect(0,0,cw,ch);
    blotch("#2c5140",60,8,42,0.5); blotch("#517f63",40,6,30,0.4);
    c.fillStyle="#8a4038"; c.fillRect(0,ch*0.42,cw,ch*0.16);   // 赤通路
    blotch("#6d332e",24,6,26,0.5);
    c.fillStyle="#e8e5dc";
    c.fillRect(0,ch*0.42-4,cw,4); c.fillRect(0,ch*0.58,cw,4);   // 白線
    for(let i=0;i<6;i++) c.fillRect(cw*0.30+i*14, ch*0.43, 8, ch*0.14);   // 横断歩道
    c.save(); c.translate(cw*0.62,ch*0.5); c.beginPath();
    c.moveTo(-14,6); c.lineTo(6,6); c.lineTo(6,12); c.lineTo(20,0);
    c.lineTo(6,-12); c.lineTo(6,-6); c.lineTo(-14,-6); c.closePath(); c.fill(); c.restore();  // 通行矢印
    c.beginPath(); c.arc(cw*0.85, ch*0.22, 16, 0, 6.3); c.fill();
    c.fillStyle="#2e8b4a";
    c.fillRect(cw*0.85-4, ch*0.22-12, 8, 24); c.fillRect(cw*0.85-12, ch*0.22-4, 24, 8);      // 緑十字
    ["#c79a1e","#2f6db3","#dfe3e8","#7a3030","#17191d"].forEach(col=>blotch(col,10,2,8,0.55));
  } else if(kind==="tint"){                    // 調色: 緑床+色まみれ
    c.fillStyle="#41705a"; c.fillRect(0,0,cw,ch);
    blotch("#2c5140",50,8,40,0.5);
    ["#c79a1e","#2f6db3","#dfe3e8","#a03030","#c46a79","#3fae5a","#17191d"].forEach(col=>blotch(col,16,2,10,0.6));
  } else if(kind==="wh"){                      // 倉庫: グレー土間+白線+ロケ番地
    c.fillStyle="#5d655f"; c.fillRect(0,0,cw,ch);
    blotch("#4a514c",50,10,50,0.5); blotch("#6e766f",30,8,36,0.4);
    c.fillStyle="#e8e5dc";
    c.fillRect(0,ch*0.40,cw,3); c.fillRect(0,ch*0.60,cw,3);
    c.font="700 34px sans-serif"; c.globalAlpha=0.8;
    for(let i=0;i<6;i++) c.fillText(String(18+i), 30+i*80, ch*0.55);
    c.globalAlpha=1;
  } else if(kind==="hazwh"){                   // 危険物: グレー+黄縁
    c.fillStyle="#61665f"; c.fillRect(0,0,cw,ch);
    blotch("#4d534d",40,10,44,0.5);
    c.strokeStyle="#d8b81e"; c.lineWidth=10; c.strokeRect(8,8,cw-16,ch-16);
  } else {                                     // lab等: コンクリ
    c.fillStyle="#70726f"; c.fillRect(0,0,cw,ch);
    blotch("#5b5d5a",40,10,40,0.5);
  }
  const tex=new THREE.CanvasTexture(cvs); tex.anisotropy=4;
  return tex;
}

// ================= 設備モデル（建屋内部ビュー / 現地写真ベース） =================
function makeLegacyEquipment(it){
  const { proc, w, d, h } = it;
  const g = new THREE.Group();
  const metal=(c=0xb9c2cc,r=0.5,m=0.45)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
  const B=(bw,bh,bd)=>new THREE.BoxGeometry(bw,bh,bd);
  const add=(geo,mat,x,y,z,rx,ry,rz)=>{ const me=new THREE.Mesh(geo,mat); me.position.set(x,y,z);
    if(rx)me.rotation.x=rx; if(ry)me.rotation.y=ry; if(rz)me.rotation.z=rz; g.add(me); return me; };
  const palletMat=new THREE.MeshStandardMaterial({color:0x8a6a3a,roughness:0.95});
  const pallet=(pw,pd)=>add(B(pw,0.22,pd),palletMat,0,0.11,0);
  const PAINTS=[0x8a8f98,0xc79a1e,0x17191d,0xdfe3e8,0x2f6db3,0x7a3030,0x2c5b3f];
  const pcol=()=>PAINTS[Math.abs(Math.round(it.x*7+it.z*13))%PAINTS.length];
  const stencil=(txt,y)=>{ const sp=makeLabel(txt,0.34,"#dfe3e8"); sp.position.y=y; g.add(sp); };

  if(proc==="MILL"){                       // ATOM'X サンドミル（若草色・塗料飛沫）
    const gm=new THREE.MeshStandardMaterial({color:0x86b48a,roughness:0.62,metalness:0.12});
    add(B(w*0.78,h*0.55,d*0.85),gm,-w*0.1,h*0.275,0);
    add(B(w*0.5,h*0.28,d*0.62),gm,-w*0.1,h*0.66,0);
    add(B(w*0.32,h*0.13,0.06),new THREE.MeshStandardMaterial({color:0x2b313b}),-w*0.1,h*0.3,d*0.44);
    add(new THREE.CylinderGeometry(w*0.15,w*0.15,h*0.48,12),metal(0xd8dee5,0.3,0.6), w*0.27,h*0.55,0);
    add(new THREE.CylinderGeometry(w*0.2,w*0.13,h*0.2,12),metal(0xcfd6dd,0.35,0.55), w*0.27,h*0.18,0);
    const curve=new THREE.CatmullRomCurve3([
      new THREE.Vector3(-w*0.1,h*0.8,0), new THREE.Vector3(-w*0.02,h*1.12,d*0.12),
      new THREE.Vector3(w*0.14,h*1.3,d*0.22)]);
    add(new THREE.TubeGeometry(curve,10,w*0.07,8),metal(0xc4ccd4,0.72,0.3),0,0,0);
  } else if(proc==="DSP"){                 // 門型昇降ディスパー + 開放槽（攪拌渦）
    add(new THREE.CylinderGeometry(w*0.4,w*0.4,h*0.42,20),dripMat(Math.abs(Math.round(it.x+it.z))),0,h*0.21,0);
    const disc=add(new THREE.CylinderGeometry(w*0.365,w*0.365,0.05,20), swirlMat(pcol()), 0,h*0.43,0);
    spinDiscs.push(disc);
    const pm=new THREE.MeshStandardMaterial({color:0x5e8f68,roughness:0.6});
    [-1,1].forEach(s=>add(B(0.28,h*0.95,0.28),pm,s*w*0.45,h*0.475,-d*0.3));
    add(B(w*0.98,0.3,0.3),pm,0,h*0.95,-d*0.3);
    add(B(w*0.28,h*0.3,d*0.3),pm,0,h*0.86,-d*0.1);
    add(new THREE.CylinderGeometry(0.07,0.07,h*0.5,8),metal(0x8a949e),0,h*0.6,0);
    add(new THREE.CylinderGeometry(0.045,0.045,w*0.92,6),metal(0x8a949e,0.6,0.4),0,h*0.5,d*0.38,0,0,Math.PI/2);
    add(B(w*0.2,0.012,w*0.15),new THREE.MeshStandardMaterial({color:0xf6f6f2,roughness:0.8}),w*0.16,h*0.45,d*0.1);  // 製造指図書
    if(it.num) stencil(it.num, h*0.62);
  } else if(proc==="TNK"){                 // 床置き調合槽（半開き蓋+渦）
    add(new THREE.CylinderGeometry(w*0.45,w*0.43,h*0.82,20),dripMat(Math.abs(Math.round(it.x))),0,h*0.41,0);
    const disc=add(new THREE.CylinderGeometry(w*0.41,w*0.41,0.05,20), swirlMat(pcol()),0,h*0.83,0);
    spinDiscs.push(disc);
    add(new THREE.CylinderGeometry(w*0.455,w*0.455,0.06,20,1,false,0,Math.PI),metal(0xc4ccd4,0.5,0.45),0,h*0.875,0);
    add(new THREE.CylinderGeometry(0.06,0.06,h*0.55,8),metal(0x6e7681),0,h*1.05,0);
    add(B(w*0.24,h*0.22,d*0.24),new THREE.MeshStandardMaterial({color:0x86b48a,roughness:0.6}),0,h*1.35,0);
    if(it.num) stencil(it.num, h*0.55);
  } else if(proc==="PTK"){                 // 可搬ステンレス槽（キャスター+番号）
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>
      add(new THREE.CylinderGeometry(0.09,0.09,0.16,8),metal(0x30343a,0.5,0.3),sx*w*0.3,0.08,sz*d*0.3));
    add(new THREE.CylinderGeometry(w*0.42,w*0.4,h*0.72,16),dripMat(Math.abs(Math.round(it.z))+1),0,0.16+h*0.36,0);
    add(new THREE.CylinderGeometry(w*0.43,w*0.43,0.05,16),metal(0xb6bcc2,0.5,0.5),0,0.16+h*0.745,0);
    add(B(w*0.6,0.05,0.08),metal(0x8a949e),0,0.16+h*0.5,d*0.44);   // ハンドル
    if(it.num) stencil(it.num, h*1.05);
  } else if(proc==="KVT"){                 // 縦型KVタンク（緑/ピンク/赤・逆円錐底）
    const cols={green:0x3f7d4e,pink:0xc46a79,red:0xa93b3b};
    const cm=new THREE.MeshStandardMaterial({color:cols[it.kv]||0x3f7d4e,roughness:0.55,metalness:0.25});
    const legMat=new THREE.MeshStandardMaterial({color:0x4a8a58,roughness:0.6});
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>add(B(0.18,h*0.42,0.18),legMat,sx*w*0.34,h*0.21,sz*d*0.34));
    add(new THREE.CylinderGeometry(w*0.44,w*0.1,h*0.24,16),cm,0,h*0.36,0);       // 逆円錐
    add(new THREE.CylinderGeometry(w*0.44,w*0.44,h*0.5,16),cm,0,h*0.73,0);       // 胴体
    add(new THREE.CylinderGeometry(w*0.34,w*0.44,h*0.08,16),cm,0,h*1.02,0);      // 天板
    add(new THREE.CylinderGeometry(0.08,0.08,h*0.14,8),metal(0x30343a),0,h*1.12,0);
    add(B(w*0.2,h*0.1,d*0.2),metal(0x30343a,0.55,0.3),0,h*1.2,0);                // 攪拌モーター
    add(new THREE.CylinderGeometry(0.05,0.05,h*0.3,6),metal(0x8a949e),0,h*0.2,w*0.2,0.5); // 排出配管
    add(new THREE.CylinderGeometry(0.03,0.03,h*0.45,6),
      new THREE.MeshStandardMaterial({color:0xe8f2f6,transparent:true,opacity:0.8}), w*0.47,h*0.62,0);  // レベル計
    [0.42,0.82].forEach(fy=>add(B(0.08,0.04,0.1),metal(0x6e7681),w*0.47,h*fy,0));
    const lad=metal(0x8a949e,0.55,0.4);
    [-1,1].forEach(s2=>add(B(0.045,h*0.96,0.045),lad,w*0.5+0.14,h*0.49,s2*0.17));
    for(let ry=0.12;ry<0.95;ry+=0.11) add(B(0.04,0.04,0.38),lad,w*0.5+0.14,h*ry,0);
    add(new THREE.TorusGeometry(w*0.42,0.028,5,14),lad,0,h*1.06,0,Math.PI/2);   // 天端手すり
  } else if(proc==="FIL"){                 // 充填ライン（コンベア+充填ヘッド+銀缶）
    const koyo=it.variant==="koyo";
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>
      add(B(0.16,h*0.42,0.16),metal(0x6e7681,0.6,0.3),sx*w*0.42,h*0.21,sz*d*0.28));
    add(B(w*0.96,h*0.08,d*0.6),metal(0x9aa3ad,0.5,0.4),0,h*0.45,0);
    for(let i=-3;i<=3;i++){ const rl=add(new THREE.CylinderGeometry(h*0.045,h*0.045,d*0.56,8),metal(0x70787f),i*w*0.13,h*0.49,0); rl.rotation.x=Math.PI/2; }
    const pm=koyo? new THREE.MeshStandardMaterial({color:0xd98cb0,roughness:0.5})
                 : new THREE.MeshStandardMaterial({color:0x86b48a,roughness:0.55});
    [-1,1].forEach(s=>add(B(0.2,h*0.55,0.2),pm,s*w*0.16,h*0.5+h*0.27,0));
    add(B(w*0.4,0.22,0.24),pm,0,h*1.02,0);
    add(B(0.16,h*0.3,0.16),metal(0x30343a),0,h*0.85,0);                          // 充填ヘッド
    add(B(w*0.2,h*0.34,0.1),pm,w*0.36,h*0.72,d*0.28);                            // 操作盤
    const canM=metal(0xd4d9de,0.35,0.6);
    for(let i=-2;i<=2;i++) add(B(w*0.09,h*0.2,w*0.09),canM,i*w*0.11,h*0.59,d*0.05);
  } else if(proc==="CAN"){                 // 一斗缶ブロックパレット（市松/トラ/銀）
    pallet(w*0.98,d*0.98);
    const side=canBlockMat(it.variant||"silver");
    const top=metal(0xd4d9de,0.35,0.5);
    const bx=new THREE.Mesh(B(w*0.94,h*0.8,d*0.94),[side,side,top,palletMat,side,side]);
    bx.position.y=0.22+h*0.4; g.add(bx);
    if(it.variant==="silver"||it.variant==="gray"){       // シュリンク包装の艶
      const wrap=new THREE.Mesh(B(w*0.97,h*0.84,d*0.97),
        new THREE.MeshStandardMaterial({color:0xf4f7fa,transparent:true,opacity:0.15,roughness:0.2}));
      wrap.position.y=0.22+h*0.42; g.add(wrap);
    }
  } else if(proc==="DRM"){                 // ドラムパレット
    pallet(w*0.98,d*0.98);
    const cols=[0x1f3a63,0x2c5b3f,0x2f6db3,0x9aa3ad,0x22262b];
    let i=Math.abs(Math.round(it.x+it.z));
    for(let sx=-1;sx<=1;sx+=2) for(let sz=-1;sz<=1;sz+=2){
      add(new THREE.CylinderGeometry(w*0.19,w*0.19,h*0.72,12),metal(cols[(i++)%5],0.42,0.5),
          sx*w*0.22,0.22+h*0.36,sz*d*0.22);
      add(new THREE.CylinderGeometry(w*0.195,w*0.195,0.03,12),metal(0xb6bcc2,0.4,0.5),
          sx*w*0.22,0.22+h*0.73,sz*d*0.22);
    }
  } else if(proc==="BAG"){                 // クラフト紙袋パレット
    pallet(w*0.98,d*0.98);
    const bm=bagMat();
    for(let ly=0;ly<4;ly++) for(let q=-1;q<=1;q++)
      add(B(w*0.42,h*0.18,d*0.8),bm, q*w*0.29, 0.22+h*(0.09+ly*0.185), 0, 0, q*0.05+ly*0.03);
  } else if(proc==="FRC"){                 // フレコンバッグ
    pallet(w*0.98,d*0.98);
    const fm=new THREE.MeshStandardMaterial({color:0xe8e4da,roughness:0.9});
    add(new THREE.CylinderGeometry(w*0.4,w*0.34,h*0.66,10),fm,0,0.22+h*0.33,0);
    add(new THREE.CylinderGeometry(w*0.16,w*0.16,h*0.1,8),fm,0,0.22+h*0.7,0);
    add(new THREE.TorusGeometry(w*0.3,0.03,6,12),metal(0xd0b060,0.8,0.1),0,0.22+h*0.62,0,Math.PI/2);
  } else if(proc==="NST"){                 // 赤ネステナー（2段+紙袋）
    const fr=new THREE.MeshStandardMaterial({color:0xb5382f,roughness:0.6});
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>add(B(0.14,h,0.14),fr,sx*w*0.46,h/2,sz*d*0.42));
    [0.5,1.0].forEach(fy=>{ add(B(w*0.96,0.1,0.14),fr,0,h*fy-0.05,-d*0.42); add(B(w*0.96,0.1,0.14),fr,0,h*fy-0.05,d*0.42); });
    const bm=bagMat();
    [0.02,0.52].forEach(fy=>{ for(let q=-1;q<=1;q++) add(B(w*0.27,h*0.3,d*0.7),bm,q*w*0.31,h*fy+h*0.16,0); });
  } else if(proc==="RCK"){                 // 青ビームのパレットラック
    const post=new THREE.MeshStandardMaterial({color:0xe4e0d2,roughness:0.6});
    const beam=new THREE.MeshStandardMaterial({color:0x2f6db3,roughness:0.55});
    [-1,0,1].forEach(q=>[-1,1].forEach(sz=>add(B(0.16,h,0.16),post,q*w*0.47,h/2,sz*d*0.42)));
    [0.34,0.66,0.98].forEach(fy=>[-1,1].forEach(sz=>add(B(w*0.98,0.12,0.12),beam,0,h*fy-0.06,sz*d*0.42)));
    const bm=bagMat(), gm=canBlockMat("gray");
    [0.02,0.34,0.66].forEach((fy,li)=>{ for(let q=-1;q<=1;q++){
      const mat=(q+li)%2===0? bm : gm;
      add(B(w*0.28,h*0.26,d*0.72),mat,q*w*0.32,h*fy+h*0.14,0);
    }});
  } else if(proc==="SHL"){                 // 顔料棚（色染みの缶・袋）
    const sf=new THREE.MeshStandardMaterial({color:0x9aa38e,roughness:0.7});
    [-1,1].forEach(sx=>[-1,1].forEach(sz=>add(B(0.1,h,0.1),sf,sx*w*0.47,h/2,sz*d*0.4)));
    [0.02,0.34,0.66,0.98].forEach(fy=>add(B(w*0.98,0.06,d*0.9),sf,0,h*fy,0));
    const cols=[0xc79a1e,0xa03030,0x2f6db3,0xc8a36c,0xdfe3e8,0x8a4b18];
    let ci=Math.abs(Math.round(it.x*3));
    [0.06,0.38,0.70].forEach(fy=>{ for(let q=-2;q<=2;q++)
      add(B(w*0.15,h*0.22,d*0.6),metal(cols[(ci++)%6],0.85,0.05),q*w*0.19,h*fy+h*0.12,0); });
  } else if(proc==="IBC"){                 // IBCコンテナ（白トート+銀枠）
    pallet(w*0.98,d*0.98);
    const fm=new THREE.MeshStandardMaterial({color:0xf0f2ec,roughness:0.55,transparent:true,opacity:0.92});
    add(B(w*0.8,h*0.72,d*0.8),fm,0,0.22+h*0.36,0);
    const fr=metal(0x8a949e,0.55,0.5);
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>add(B(0.07,h*0.75,0.07),fr,sx*w*0.41,0.22+h*0.375,sz*d*0.41));
    [0.25,0.5,0.72].forEach(fy=>{
      add(B(w*0.84,0.06,0.06),fr,0,0.22+h*fy,d*0.41);
      add(B(w*0.84,0.06,0.06),fr,0,0.22+h*fy,-d*0.41); });
    add(B(w*0.2,h*0.08,d*0.2),fr,0,0.22+h*0.78,0);
  } else if(proc==="EV"){                  // 荷物用エレベーター（オレンジ）
    const om=new THREE.MeshStandardMaterial({color:0xe8731a,roughness:0.55});
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>add(B(0.2,h,0.2),om,sx*w*0.44,h/2,sz*d*0.44));
    add(B(w*0.98,h*0.12,d*0.98),om,0,h*0.94,0);
    const cage=add(B(w*0.9,h*0.30,d*0.9),
      new THREE.MeshStandardMaterial({color:0x2b313b,roughness:0.7,transparent:true,opacity:0.55}),0,h*0.24,0);
    evAnims.push({mesh:cage, base:h*0.24, travel:h*0.5});
    const gate=new THREE.Mesh(B(w*0.86,h*0.5,0.04),
      new THREE.MeshStandardMaterial({color:0xd8b81e,roughness:0.6,transparent:true,opacity:0.5,side:THREE.DoubleSide}));
    gate.position.set(0,h*0.28,d*0.45); g.add(gate);
    stencil("600kg", h*0.8);
  } else if(proc==="HST"){                 // 天井走行ホイスト（原料⇔計量を往復・両端で吊り降ろし）
    add(B(w*0.98,0.2,0.28),metal(0x6e7681,0.5,0.5),0,h,0);                        // Iビーム
    const tro=new THREE.Group(); g.add(tro);
    const troBody=new THREE.Mesh(B(0.4,0.34,0.4),
      new THREE.MeshStandardMaterial({color:0xd8b81e,roughness:0.5}));
    troBody.position.set(0,h-0.28,0); tro.add(troBody);
    const loadG=new THREE.Group(); tro.add(loadG);
    const chain=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,h*0.32,6),metal(0x30343a));
    chain.position.set(0,h-0.28-h*0.16,0); loadG.add(chain);
    const frec=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.26,0.6,10),
      new THREE.MeshStandardMaterial({color:0x24262b,roughness:0.9}));
    frec.position.set(0,h-0.28-h*0.32-0.3,0); loadG.add(frec);
    hoistAnims.push({grp:tro, load:loadG, range:w*0.36, x:0, dir:1,
                     state:"move", dwell:0, spd:1.4, dip:h*0.42});
  } else if(proc==="FEX"){                 // 消火栓キャビネット
    add(B(w*0.9,h*0.9,d*0.9),new THREE.MeshStandardMaterial({color:0xc03028,roughness:0.55}),0,h*0.45,0);
    add(B(w*0.7,h*0.28,0.03),new THREE.MeshStandardMaterial({color:0xf2f2f0}),0,h*0.6,d*0.46);
  } else if(proc==="IN"||proc==="OUT"){    // 搬入出口（パレット+黄線）
    add(B(w*0.96,h*0.18,d*0.96),metal(0x7d868f,0.8,0.1),0,h*0.09,0);
    const pal=new THREE.MeshStandardMaterial({color:0x8a6a3a,roughness:0.95});
    const wood=new THREE.MeshStandardMaterial({color:0xa9854f,roughness:0.95});
    for(let i=-1;i<=1;i++){
      add(B(w*0.26,h*0.1,d*0.5),pal,0,h*0.23,i*d*0.3);
      add(B(w*0.24,h*0.22,d*0.45),wood,0,h*0.4,i*d*0.3);
    }
    add(B(0.6,0.05,d*0.96),new THREE.MeshStandardMaterial({color:0xe3b341}),w*0.4,h*0.21,0);
  } else {                                 // 汎用セル
    add(B(w*0.9,h*0.6,d*0.9),metal(0xc0c8d0),0,h*0.3,0);
    add(B(w*0.55,h*0.28,0.3),new THREE.MeshStandardMaterial({color:0x2b313b}),0,h*0.4,d*0.46);
    add(B(w*0.7,h*0.12,d*0.7),metal(0x9aa3ad),0,h*0.66,0);
  }
  addPrecisionParts(g,it);
  // 定位置管理の床区画線（設備と一緒に移動する）
  if(!["HST","IN","OUT"].includes(proc)){
    const lc = ["KVT","DSP","TNK","DRM","FRC"].includes(proc)? 0xd8b81e : 0xe8e5dc;
    const lm=new THREE.MeshBasicMaterial({color:lc,transparent:true,opacity:0.85});
    const fw=w+1.0, fd=d+1.0, lt=0.12;
    [[0,-fd/2,fw,lt],[0,fd/2,fw,lt],[-fw/2,0,lt,fd],[fw/2,0,lt,fd]].forEach(([ox,oz,ww,dd])=>{
      const ln=new THREE.Mesh(new THREE.PlaneGeometry(ww,dd),lm);
      ln.rotation.x=-Math.PI/2; ln.position.set(ox,0.045,oz); g.add(ln);
    });
  }
  return g;
}

// ================= シーン構築 =================
const siteGroup = new THREE.Group(); scene.add(siteGroup);
const intGroup  = new THREE.Group(); scene.add(intGroup); intGroup.visible=false;
const routeGroup = new THREE.Group(); scene.add(routeGroup);
const congGroup = new THREE.Group(); scene.add(congGroup);
const mepGroup = new THREE.Group(); scene.add(mepGroup); mepGroup.visible=false;
const clashGroup = new THREE.Group(); scene.add(clashGroup);
let snapGrid=null, ghostGroup=null;

const pickFloor = new THREE.Mesh(new THREE.PlaneGeometry(8000,8000),
  new THREE.MeshBasicMaterial({visible:false}));
pickFloor.rotation.x=-Math.PI/2; scene.add(pickFloor);

function clearGroup(g){
  while(g.children.length){
    const c=g.children.pop();
    c.traverse?.(o=>{ o.geometry?.dispose();
      const mats=Array.isArray(o.material)? o.material : (o.material?[o.material]:[]);
      mats.forEach(mt=>{ mt.map?.dispose?.(); mt.dispose?.(); });
    });
    c.geometry?.dispose();
  }
}

// ================= BIM / MEP モジュール =================
let bimMode=false;
let drawMode=false;
const SYSTEMS={
  SA:{name:"給気ダクト",     color:0x3b82f6},
  RA:{name:"還気ダクト",     color:0x2f9fd0},
  EA:{name:"排気ダクト",     color:0xd946ef},
  DC:{name:"集塵ダクト",     color:0xb9c1c9},
  HV:{name:"冷温水配管",     color:0xe0509a},
  FP:{name:"消火・SP配管",   color:0xef4444},
  PR:{name:"プロセス配管",   color:0x22d3ee},
  CA:{name:"圧縮空気配管",   color:0x86c8d8},
  SN:{name:"衛生・ﾕｰﾃｨﾘﾃｨ", color:0x22c55e},
  EL:{name:"電気ラック",     color:0x5b6572},
  EQ:{name:"空調・機械設備", color:0xd97706},
  RK:{name:"支持・架台",     color:0x8a949e},
};
const sysVis=Object.fromEntries(Object.keys(SYSTEMS).map(k=>[k,true]));
let mepAll=[]; const mepBGroups=new Map(); const mepIntGroups=new Map();
let rackGroup=null, rackSig="", mepSeq=0;
function mepEl(sys,kind,size,b){
  const el={ id:sys+"-"+String(++mepSeq).padStart(3,"0"), sys, kind, size,
    bId:b?b.id:"site", bName:b?b.name:"屋外", len:0, meshes:[] };
  mepAll.push(el); return el;
}
function sRand(seed){ let s=2166136261>>>0;
  for(const ch of seed) s=Math.imul(s^ch.charCodeAt(0),16777619)>>>0;
  return ()=>{ s=(Math.imul(s,1664525)+1013904223)>>>0; return s/4294967296; }; }
let mepMats={};
function mepMat(color,rough=0.45,metal=0.35){
  const k=color+"/"+rough+"/"+metal;
  if(!mepMats[k]) mepMats[k]=new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});
  return mepMats[k];
}
function addSeg(g,el,geo,mat,x,y,z,quat){
  const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z);
  if(quat) m.quaternion.copy(quat);
  m.userData.mep=el; g.add(m); el.meshes.push(m); return m;
}
function duct(g,el,path,W,H){
  const mat=mepMat(SYSTEMS[el.sys].color,0.35,0.45);
  const ribsX=[], ribsZ=[]; const dirs=[];
  for(let i=1;i<path.length;i++){
    const a=path[i-1], b=path[i];
    const dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2], len=Math.hypot(dx,dy,dz);
    if(len<0.01){ dirs.push(null); continue; }
    el.len+=len;
    const ax=Math.abs(dx), ay=Math.abs(dy), az=Math.abs(dz);
    let geo, axis=0;
    if(ax>=ay&&ax>=az){ geo=new THREE.BoxGeometry(len,H,W); axis=0; }
    else if(az>=ay)   { geo=new THREE.BoxGeometry(W,H,len); axis=2; }
    else              { geo=new THREE.BoxGeometry(W,len,W); axis=1; }
    addSeg(g,el,geo,mat,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);
    dirs.push(new THREE.Vector3(dx,dy,dz).normalize());
    if(len>3.5 && axis!==1){
      const nR=Math.floor(len/2.8);
      for(let r2=1;r2<=nR;r2++){
        const t2=r2/(nR+1);
        (axis===0?ribsX:ribsZ).push([a[0]+dx*t2, a[1]+dy*t2, a[2]+dz*t2]);
      }
    }
  }
  // コーナー: 充填キューブ + 45°ミタープレート（板金ダクトの継目）
  for(let i=1;i<path.length-1;i++){
    const d1=dirs[i-1], d2=dirs[i];
    if(!d1||!d2) continue;
    const s=Math.max(W,H)*1.05;
    addSeg(g,el,new THREE.BoxGeometry(s,s,s),mat,path[i][0],path[i][1],path[i][2]);
    _zA.crossVectors(d1,d2);
    if(_zA.lengthSq()>1e-6){
      _zA.normalize();
      _xA.copy(d1).sub(d2).normalize();      // ミター面の法線 = d1-d2
      _yA.copy(_zA);                          // ダクト高さ方向
      const zz=new THREE.Vector3().crossVectors(_xA,_yA);
      const plate=new THREE.Mesh(new THREE.BoxGeometry(0.08,H*1.16,W*1.5),mat);
      _m4b.makeBasis(_xA,_yA,zz);
      plate.quaternion.setFromRotationMatrix(_m4b);
      plate.position.set(path[i][0],path[i][1],path[i][2]);
      plate.userData.mep=el; plate.userData.noClash=true;
      g.add(plate); el.meshes.push(plate);
    }
  }
  if(ribsX.length) instAdd(g,el,new THREE.BoxGeometry(0.07,H*1.1,W*1.1),mat,ribsX);
  if(ribsZ.length) instAdd(g,el,new THREE.BoxGeometry(W*1.1,H*1.1,0.07),mat,ribsZ);
}
// 角丸レジューサー（拡縮）: 4角柱テーパーで矩形ダクトの縮小継手を表現
function ductReducer(g,el,x,y,z,dirV,Wbig,Wsmall){
  const geo=new THREE.CylinderGeometry(Wsmall*0.68,Wbig*0.68,1.5,4,1);
  geo.rotateY(Math.PI/4);
  _tq.setFromUnitVectors(_UP,dirV);
  addSeg(g,el,geo,mepMat(SYSTEMS[el.sys].color,0.35,0.45),x,y,z,_tq);
}
// 系統ラベル + 流れ方向矢印（コーンをインスタンス配置）
function flowMark(g, el, path, text, yOff=0.6){
  const col=SYSTEMS[el.sys].color;
  const coneGeo=new THREE.ConeGeometry(0.22,0.55,8);
  const mat=mepMat(col,0.35,0.3);
  const cones=[]; const segs=[];
  for(let i=1;i<path.length;i++){
    const a=path[i-1], b=path[i];
    const d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]];
    const len=Math.hypot(d[0],d[1],d[2]); if(len<0.02) continue;
    segs.push({a,d,len});
  }
  segs.forEach(sg=>{
    const dirV=new THREE.Vector3(sg.d[0],sg.d[1],sg.d[2]).normalize();
    if(Math.abs(dirV.y)>0.7) return;
    const q=new THREE.Quaternion().setFromUnitVectors(_UP,dirV);
    const n=Math.floor(sg.len/9);
    for(let j=1;j<=n;j++){
      const t2=j/(n+1);
      cones.push([sg.a[0]+sg.d[0]*t2, sg.a[1]+sg.d[1]*t2+yOff, sg.a[2]+sg.d[2]*t2, q.clone()]);
    }
  });
  if(cones.length) instAdd(g,el,coneGeo,mat,cones);
  if(segs.length){
    const sg=segs[0];
    const lbl=makeLabel(text, 0.42, "#"+col.toString(16).padStart(6,"0"));
    lbl.position.set(sg.a[0]+sg.d[0]*0.5, sg.a[1]+sg.d[1]*0.5+yOff+1.2, sg.a[2]+sg.d[2]*0.5);
    lbl.userData.mep=el; lbl.userData.noClash=true;
    g.add(lbl); el.meshes.push(lbl);
  }
}
const _UP=new THREE.Vector3(0,1,0), _Z=new THREE.Vector3(0,0,1);
const _tv=new THREE.Vector3(), _tq=new THREE.Quaternion();
const _xA=new THREE.Vector3(), _yA=new THREE.Vector3(), _zA=new THREE.Vector3(), _m4b=new THREE.Matrix4();
// 反復パーツ（ヘッド・フランジ・リブ・吊りボルト等）は1ドローコールに集約
function instAdd(g, el, geo, mat, list){
  if(!list.length) return null;
  const im=new THREE.InstancedMesh(geo, mat, list.length);
  const m4=new THREE.Matrix4(), pos=new THREE.Vector3(), scl=new THREE.Vector3();
  const qId=new THREE.Quaternion();
  list.forEach((p,i)=>{
    pos.set(p[0],p[1],p[2]); scl.set(1, p[4]||1, 1);
    m4.compose(pos, p[3]||qId, scl);
    im.setMatrixAt(i,m4);
  });
  im.userData.mep=el; im.userData.noClash=true;
  g.add(im); el.meshes.push(im);
  return im;
}
// 大径配管のコーナーをトーラス製エルボで滑らかに接続
function pipeElbow(g, el, cx,cy,cz, d1, d2, r, mat){
  _zA.crossVectors(d1,d2);
  if(_zA.lengthSq()<1e-6){
    addSeg(g,el,new THREE.SphereGeometry(r*1.3,8,6),mat,cx,cy,cz); return;
  }
  _zA.normalize();
  _xA.copy(d1).negate(); _yA.copy(d2);
  const R=Math.max(r*2.2,0.12);
  const m=new THREE.Mesh(new THREE.TorusGeometry(R,r,8,10,Math.PI/2),mat);
  _m4b.makeBasis(_xA,_yA,_zA);
  m.quaternion.setFromRotationMatrix(_m4b);
  m.position.set(cx,cy,cz);
  m.userData.mep=el; g.add(m); el.meshes.push(m);
}
// スパイラルダクト（銀・リブ環付き）
function spiralRun(g,el,path,r,col,ringStep,bandCol){
  const mat=mepMat(col||SYSTEMS.DC.color,0.35,0.7);
  const step=ringStep||1.2;
  const rings=[]; const bands=[]; const dirs=[];
  let ringIdx=0;
  for(let i=1;i<path.length;i++){
    const a=path[i-1], b=path[i];
    const dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2], len=Math.hypot(dx,dy,dz);
    if(len<0.01){ dirs.push(null); continue; }
    el.len+=len;
    _tv.set(dx,dy,dz).normalize(); dirs.push(_tv.clone());
    _tq.setFromUnitVectors(_UP,_tv);
    addSeg(g,el,new THREE.CylinderGeometry(r,r,len,12),mat,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,_tq);
    const qr=new THREE.Quaternion().setFromUnitVectors(_Z,_tv);
    const nRing=Math.floor(len/step);
    for(let j=1;j<=nRing;j++){
      const t2=j/(nRing+1);
      const rec=[a[0]+dx*t2, a[1]+dy*t2, a[2]+dz*t2, qr.clone()];
      // 4本に1本を系統色の識別バンドに
      if(bandCol && (ringIdx%4===3)) bands.push(rec); else rings.push(rec);
      ringIdx++;
    }
  }
  for(let i=1;i<path.length-1;i++){
    const d1=dirs[i-1], d2=dirs[i];
    if(d1&&d2) pipeElbow(g,el,path[i][0],path[i][1],path[i][2],d1,d2,r,mat);
  }
  if(rings.length) instAdd(g,el,new THREE.TorusGeometry(r*1.02,0.02,5,14),mat,rings);
  if(bands.length) instAdd(g,el,new THREE.TorusGeometry(r*1.03,0.045,5,14),mepMat(bandCol,0.4,0.4),bands);
}
function pipeRun(g,el,path,r,colOverride){
  const mat=mepMat(colOverride||SYSTEMS[el.sys].color,0.3,0.55);
  const flanges=[]; const dirs=[];
  for(let i=1;i<path.length;i++){
    const a=path[i-1], b=path[i];
    const dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2], len=Math.hypot(dx,dy,dz);
    if(len<0.01){ dirs.push(null); continue; }
    el.len+=len;
    _tv.set(dx,dy,dz).normalize(); dirs.push(_tv.clone());
    _tq.setFromUnitVectors(_UP,_tv);
    addSeg(g,el,new THREE.CylinderGeometry(r,r,len,8),mat,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,_tq);
    if(r>=0.05 && len>4){
      const nFl=Math.floor(len/5);
      for(let f2=1;f2<=nFl;f2++){
        const t2=f2/(nFl+1);
        flanges.push([a[0]+dx*t2, a[1]+dy*t2, a[2]+dz*t2, _tq.clone()]);
      }
    }
  }
  for(let i=1;i<path.length-1;i++){
    const d1=dirs[i-1], d2=dirs[i];
    if(!d1||!d2) continue;
    if(r>=0.045) pipeElbow(g,el,path[i][0],path[i][1],path[i][2],d1,d2,r,mat);
    else addSeg(g,el,new THREE.SphereGeometry(r*1.3,8,6),mat,path[i][0],path[i][1],path[i][2]);
  }
  if(flanges.length) instAdd(g,el,new THREE.CylinderGeometry(r*1.55,r*1.55,0.07,10),mat,flanges);
}
function trayRun(g,el,path,W,nCables){
  // はしご桁ケーブルラック: サイドレール2本 + 400mmピッチのラング + 実ケーブル束
  const mat=mepMat(SYSTEMS[el.sys].color,0.6,0.4);
  const rungsX=[], rungsZ=[];
  for(let i=1;i<path.length;i++){
    const a=path[i-1], b=path[i];
    const dx=b[0]-a[0], dz=b[2]-a[2], len=Math.hypot(dx,dz);
    if(len<0.01) continue;
    el.len+=len;
    const alongX = Math.abs(dx)>=Math.abs(dz);
    const railGeo = alongX? new THREE.BoxGeometry(len,0.13,0.05) : new THREE.BoxGeometry(0.05,0.13,len);
    [-1,1].forEach(s=>{
      const off=W/2-0.025;
      const m=new THREE.Mesh(railGeo,mat);
      m.position.set((a[0]+b[0])/2 + (alongX?0:s*off), a[1], (a[2]+b[2])/2 + (alongX?s*off:0));
      m.userData.mep=el; g.add(m); el.meshes.push(m);
    });
    const n=Math.floor(len/0.4);
    for(let j=1;j<=n;j++){
      const t2=j/(n+1);
      (alongX?rungsX:rungsZ).push([a[0]+dx*t2, a[1]-0.03, a[2]+dz*t2]);
    }
    // 実ケーブル束（太さ違い・わずかな垂れ）
    if(nCables && len>2){
      const cableCols=[0x1c1e22,0x2a2530,0x223042,0x3a2424,0x1e2a22,0x30302a];
      for(let c2=0;c2<nCables;c2++){
        const off=(nCables>1? (c2/(nCables-1)-0.5):0)*(W*0.7);
        const r2=0.015+((c2*7)%3)*0.006;
        const sag=0.05+((c2*5)%4)*0.02;
        const ox= alongX?0:off, oz= alongX?off:0;
        const curve=new THREE.CatmullRomCurve3([
          new THREE.Vector3(a[0]+ox, a[1]+0.06, a[2]+oz),
          new THREE.Vector3((a[0]+b[0])/2+ox, a[1]+0.04-sag, (a[2]+b[2])/2+oz),
          new THREE.Vector3(b[0]+ox, b[1]+0.06, b[2]+oz)]);
        const cm=new THREE.Mesh(new THREE.TubeGeometry(curve,10,r2,5),
          mepMat(cableCols[c2%6],0.85,0.1));
        cm.userData.mep=el; cm.userData.noClash=true;
        g.add(cm); el.meshes.push(cm);
      }
    }
  }
  if(rungsX.length) instAdd(g,el,new THREE.BoxGeometry(0.05,0.035,W*0.9),mat,rungsX);
  if(rungsZ.length) instAdd(g,el,new THREE.BoxGeometry(W*0.9,0.035,0.05),mat,rungsZ);
}
// ---- 制気口・ダンパー形状（マージジオメトリをインスタンス配置） ----
let _difGeoL=null, _grlGeoL=null, _dmpGeoL=null;
function diffuserGeo(){    // アネモ型吹出口: 同心角リング3段
  if(_difGeoL) return _difGeoL;
  const parts=[];
  const fr=new THREE.BoxGeometry(0.88,0.05,0.88); fr.translate(0,0.09,0); parts.push(fr);
  [[0.78,0.0],[0.56,-0.05],[0.34,-0.10]].forEach(([s,dy])=>{
    [[s,0.05,s/2,0],[s,0.05,-s/2,0],[0.05,s,0,s/2],[0.05,s,0,-s/2]].forEach(([wx,wz,oz,ox])=>{
      const ring=new THREE.BoxGeometry(wx,0.022,wz);
      ring.translate(ox,dy,oz); parts.push(ring);
    });
  });
  const cap=new THREE.BoxGeometry(0.2,0.022,0.2); cap.translate(0,-0.14,0); parts.push(cap);
  _difGeoL=mergeGeometries(parts); return _difGeoL;
}
function grilleGeo(){      // 還気グリル: フレーム + 横羽根ルーバー6枚
  if(_grlGeoL) return _grlGeoL;
  const parts=[];
  const fr=new THREE.BoxGeometry(0.98,0.44,0.045); parts.push(fr);
  for(let i=0;i<6;i++){
    const fin=new THREE.BoxGeometry(0.88,0.05,0.02);
    fin.rotateX(0.5);
    fin.translate(0, -0.155+i*0.062, 0.035);
    parts.push(fin);
  }
  _grlGeoL=mergeGeometries(parts); return _grlGeoL;
}
function damperGeo(){      // 風量ダンパー: 軸ピン + レバーハンドル + 操作板
  if(_dmpGeoL) return _dmpGeoL;
  const parts=[];
  const pin=new THREE.CylinderGeometry(0.028,0.028,0.66,6);
  pin.rotateZ(Math.PI/2); parts.push(pin);
  const quad=new THREE.BoxGeometry(0.02,0.17,0.17);
  quad.translate(0.35,0.04,0); parts.push(quad);
  const lever=new THREE.BoxGeometry(0.02,0.05,0.3);
  lever.rotateX(-0.6);
  lever.translate(0.37,0.1,0.09); parts.push(lever);
  const knob=new THREE.BoxGeometry(0.035,0.035,0.05);
  knob.translate(0.37,0.19,0.2); parts.push(knob);
  _dmpGeoL=mergeGeometries(parts); return _dmpGeoL;
}

// ---- 建屋MEP自動生成（q=密度係数, dense=内部高密度, items=設備実接続用 ） ----
function genBuildingMEP(b, q=1, dense=false, items=null){
  const startIdx=mepAll.length;
  const g=new THREE.Group();
  const rnd=sRand(b.id+(dense?":int":""));
  const W=b.w, D=b.d, H=b.h, type=b.proc;
  const long=W>=D, L=long?W:D, S=long?D:W;
  const P=(u,c,y)=> long? [u,y,c] : [c,y,u];
  const uOf=it=> long? it.x : it.z;
  const cOf=it=> long? it.z : it.x;
  const headGeo=new THREE.SphereGeometry(0.09,6,5);
  const qAxis = long? null : new THREE.Quaternion().setFromAxisAngle(_UP, Math.PI/2);
  const rodGeo=new THREE.CylinderGeometry(0.022,0.022,1,4);
  const rodMat=mepMat(0x9aa3ad,0.6,0.4);
  let elHang=null; const rods=[];
  if(dense) elHang=mepEl("RK","吊りボルト・支持金物","W3/8",b);
  const hang=(x,y,z,topY)=>{
    if(!dense||!elHang) return;
    const len=topY-y; if(len<0.3) return;
    rods.push([x,y+len/2,z,null,len]); elHang.len+=len;
  };
  const valveMat=mepMat(0xc03028,0.5,0.4);
  const gaugeMat=mepMat(0xf2f4f1,0.35,0.2);
  let elFlash=null;
  const flash=(x,z,s)=>{     // 屋根貫通部の防水フラッシング（角パン+笠）
    if(!elFlash) elFlash=mepEl("RK","屋根貫通フラッシング","-",b);
    addSeg(g,elFlash,new THREE.BoxGeometry(s*1.7,0.24,s*1.7),mepMat(0x8a949e,0.7,0.3),x,H+0.12,z);
    addSeg(g,elFlash,new THREE.CylinderGeometry(s*0.8,s,0.3,8),mepMat(0x9aa3ad,0.6,0.4),x,H+0.35,z);
  };
  const valve=(el,x,y,z)=>{
    if(!dense) return;
    addSeg(g,el,new THREE.BoxGeometry(0.22,0.28,0.22),valveMat,x,y,z);
    addSeg(g,el,new THREE.TorusGeometry(0.16,0.035,6,10),valveMat,x,y+0.3,z);
    addSeg(g,el,new THREE.CylinderGeometry(0.018,0.018,0.16,5),valveMat,x+0.16,y+0.18,z);
    const gd=addSeg(g,el,new THREE.CylinderGeometry(0.09,0.09,0.035,10),gaugeMat,x+0.16,y+0.32,z);
    gd.rotation.z=Math.PI/2; gd.userData.noClash=true;
  };

  const hasSA = type!=="hazwh";
  const ySA=H*0.60, uStart=-L*0.45, uEnd=L*0.32;
  const spB=7/q;
  if(hasSA){
    // ---- 給気ダクト SA ----
    const mw=Math.min(1.3, S*0.05+0.55);
    const main=mepEl("SA","角ダクト(主管+ﾚｼﾞｭｰｻｰ)", Math.round(mw*1000)+"×600→"+Math.round(mw*720)+"×450", b);
    const uMid=uStart+(uEnd-uStart)*0.58;
    duct(g,main,[P(uStart,-S*0.12,ySA), P(uMid-0.8,-S*0.12,ySA)], mw, 0.6);
    const pRd=P(uMid,-S*0.12,ySA);
    const dirU=long? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,0,1);
    ductReducer(g,main,pRd[0],pRd[1],pRd[2],dirU,mw,mw*0.72);
    duct(g,main,[P(uMid+0.8,-S*0.12,ySA), P(uEnd,-S*0.12,ySA), P(uEnd,-S*0.12,H+0.8)], mw*0.72, 0.5);
    flowMark(g,main,[P(uStart,-S*0.12,ySA), P(uEnd,-S*0.12,ySA)],"SA 給気");
    const pFsa=P(uEnd,-S*0.12,0);
    flash(pFsa[0],pFsa[2],mw*0.55);
    addSeg(g,main,new THREE.BoxGeometry(mw*0.78,0.22,mw*0.78),
      mepMat(0x2b2f36,0.85,0.05),pFsa[0],H+0.55,pFsa[2]);   // キャンバス継手
    if(dense){
      // トラピーズ支持（吊りボルト2本+形鋼チャンネル）
      const chansD=[];
      for(let u=uStart+4;u<uEnd;u+=5){
        chansD.push(P(u,-S*0.12,ySA-0.38));
        const pr1=P(u,-S*0.12-(mw/2+0.12),ySA-0.34), pr2=P(u,-S*0.12+(mw/2+0.12),ySA-0.34);
        hang(pr1[0],pr1[1],pr1[2],H); hang(pr2[0],pr2[1],pr2[2],H);
      }
      const chGeoD= long? new THREE.BoxGeometry(0.08,0.09,mw+0.6) : new THREE.BoxGeometry(mw+0.6,0.09,0.08);
      if(chansD.length && elHang) instAdd(g,elHang,chGeoD,rodMat,chansD);
    }
    const br=mepEl("SA","角ダクト(枝)+吹出口", "550×350", b);
    const badU = rnd()<0.6 ? uStart+(0.25+rnd()*0.5)*(uEnd-uStart) : null;
    const diffs=[]; const dmps=[];
    let k=0;
    for(let u=uStart+4; u<uEnd-1; u+=spB, k++){
      const side=(k%2===0)?1:-1;
      const cEnd= side>0? S*0.37 : -S*0.39;
      const y=(badU!==null && Math.abs(u-badU)<spB/2)? H*0.78 : ySA;
      duct(g,br,[P(u,-S*0.12,y), P(u,cEnd,y)], 0.55, 0.35);
      const pcT=P(u,-S*0.12,y);
      const teeC=addSeg(g,br,new THREE.BoxGeometry(0.68,0.46,0.68),
        mepMat(SYSTEMS.SA.color,0.35,0.45),pcT[0],pcT[1],pcT[2]);
      teeC.userData.noClash=true;
      const pdm=P(u, -S*0.12+side*1.35, y);
      dmps.push([pdm[0],pdm[1],pdm[2], qAxis? qAxis.clone():undefined]);
      const nDif = dense? 2 : 1;
      for(let j=1;j<=nDif;j++){
        const cj=-S*0.12+(cEnd+S*0.12)*(j/(nDif+0.15));
        duct(g,br,[P(u,cj,y-0.18), P(u,cj,y-0.75)],0.32,0.32);
        diffs.push(P(u,cj,y-0.85));
      }
    }
    if(diffs.length) instAdd(g,br,diffuserGeo(),mepMat(SYSTEMS.SA.color,0.4,0.4),diffs);
    if(dmps.length) instAdd(g,br,damperGeo(),mepMat(0x3a4148,0.45,0.5),dmps);
    // ---- 還気ダクト RA ----
    const ra=mepEl("RA","角ダクト(還気)", "800×500", b);
    const yRA=H*0.70;
    duct(g,ra,[P(uStart+2,S*0.05,yRA), P(uEnd-2,S*0.05,yRA), P(uEnd-2,S*0.05,H+0.6)],
         Math.min(1.1,mw*0.92), 0.5);
    flowMark(g,ra,[P(uStart+2,S*0.05,yRA), P(uEnd-2,S*0.05,yRA)],"RA 還気");
    const pFra=P(uEnd-2,S*0.05,0);
    flash(pFra[0],pFra[2],0.55);
    addSeg(g,ra,new THREE.BoxGeometry(0.95,0.2,0.95),
      mepMat(0x2b2f36,0.85,0.05),pFra[0],H+0.5,pFra[2]);   // キャンバス継手
    const grils=[]; const dmpsR=[]; const chansR=[]; let k2=0;
    for(let u=uStart+7; u<uEnd-3; u+=spB*1.4, k2++){
      const cEnd=(k2%2? -S*0.30 : S*0.33);
      const sideR=(cEnd>0)?1:-1;
      duct(g,ra,[P(u,S*0.05,yRA), P(u,cEnd,yRA)],0.5,0.32);
      const pcR=P(u,S*0.05,yRA);
      const teeR=addSeg(g,ra,new THREE.BoxGeometry(0.62,0.42,0.62),
        mepMat(SYSTEMS.RA.color,0.35,0.45),pcR[0],pcR[1],pcR[2]);
      teeR.userData.noClash=true;
      const pdmR=P(u, S*0.05+sideR*1.25, yRA);
      dmpsR.push([pdmR[0],pdmR[1],pdmR[2], qAxis? qAxis.clone():undefined]);
      const pg=P(u,cEnd,yRA-0.3);
      grils.push([pg[0],pg[1],pg[2], qAxis? qAxis.clone():undefined]);
      if(dense){
        chansR.push(P(u,S*0.05,yRA-0.34));
        const pr1=P(u,S*0.05-0.68,yRA-0.3), pr2=P(u,S*0.05+0.68,yRA-0.3);
        hang(pr1[0],pr1[1],pr1[2],H); hang(pr2[0],pr2[1],pr2[2],H);
      }
    }
    if(grils.length) instAdd(g,ra,grilleGeo(),mepMat(SYSTEMS.RA.color,0.45,0.4),grils);
    if(chansR.length && elHang){
      const chGeoR= long? new THREE.BoxGeometry(0.08,0.09,1.5) : new THREE.BoxGeometry(1.5,0.09,0.08);
      instAdd(g,ra,chGeoR,rodMat,chansR);
    }
    if(dmpsR.length) instAdd(g,ra,damperGeo(),mepMat(0x3a4148,0.45,0.5),dmpsR);
    // ---- 冷温水配管 HV（往還ペア+トラピーズ支持） ----
    const hv=mepEl("HV","冷温水配管(往還)","65A",b);
    const yHV=H*0.76;
    [-0.16,0.16].forEach(off=>{
      if(dense){
        // 立上りは裸管、横引きは銀ラッキング+識別バンド仕上げ
        pipeRun(g,hv,[P(uEnd,-S*0.05+off,H+0.6), P(uEnd,-S*0.05+off,yHV)],0.055);
        spiralRun(g,hv,[P(uEnd,-S*0.05+off,yHV), P(uStart+4,-S*0.05+off,yHV)],
          0.075, 0xd8dde2, 1.5, SYSTEMS.HV.color);
      } else {
        pipeRun(g,hv,[P(uEnd,-S*0.05+off,H+0.6), P(uEnd,-S*0.05+off,yHV),
                      P(uStart+4,-S*0.05+off,yHV)],0.055);
      }
    });
    flowMark(g,hv,[P(uEnd,-S*0.05,yHV), P(uStart+4,-S*0.05,yHV)],"CH 冷温水");
    if(dense){
      const chans=[];
      const chGeo = long? new THREE.BoxGeometry(0.08,0.08,0.7) : new THREE.BoxGeometry(0.7,0.08,0.08);
      for(let u=uStart+6;u<uEnd-2;u+=6){
        const p=P(u,-S*0.05,yHV-0.12); chans.push(p);
        const pr1=P(u,-S*0.05-0.28,yHV-0.08), pr2=P(u,-S*0.05+0.28,yHV-0.08);
        hang(pr1[0],pr1[1],pr1[2],H); hang(pr2[0],pr2[1],pr2[2],H);
      }
      if(chans.length) instAdd(g,elHang,chGeo,rodMat,chans);
    }
    [-0.16,0.16].forEach(off=>{
      const pFhv=P(uEnd,-S*0.05+off,0);
      flash(pFhv[0],pFhv[2],0.1);
    });
    const nF=dense?3:2;
    for(let j=1;j<=nF;j++){
      const uf=uStart+6+(uEnd-uStart-10)*(j/(nF+0.3));
      pipeRun(g,hv,[P(uf,-S*0.05-0.16,yHV), P(uf,-S*0.05-0.16,H*0.52)],0.045);
      pipeRun(g,hv,[P(uf,-S*0.05+0.16,yHV), P(uf,-S*0.05+0.16,H*0.52)],0.045);
      const p=P(uf,-S*0.05,H*0.48);
      addSeg(g,hv,new THREE.BoxGeometry(1.1,0.55,0.55),mepMat(SYSTEMS.HV.color,0.5,0.3),p[0],p[1],p[2]);
      valve(hv, ...P(uf,-S*0.05-0.16,H*0.62));
    }
    const ahu=mepEl("EQ","屋上空調機(AHU)","AHU-"+b.id.toUpperCase(),b);
    const pA=P(uEnd,-S*0.12,H+1.45);
    addSeg(g,ahu,new THREE.BoxGeometry(3.4,1.7,2.3),mepMat(0xc9975a,0.55,0.3),pA[0],pA[1],pA[2]);
    // 屋上冷媒・冷温水配管+鋼製支持架台
    const rf=mepEl("HV","屋上冷媒配管","40A",b);
    pipeRun(g,rf,[P(uEnd-1.8,-S*0.12,H+0.9), P(uStart+8,-S*0.12,H+0.9), P(uStart+8,-S*0.12,H+0.55)],0.045);
    spiralRun(g,rf,[P(uEnd-1.8,-S*0.12+0.25,H+0.9), P(uStart+10,-S*0.12+0.25,H+0.9)],0.05,0xc9ced4,1.6,SYSTEMS.HV.color);
    const rkMat=mepMat(SYSTEMS.RK.color,0.6,0.5);
    const rkEl=mepEl("RK","屋上配管架台","H-100",b);
    const feet=[];
    for(let u=uStart+10;u<uEnd-2;u+=8) feet.push(P(u,-S*0.12+0.1,H+0.62));
    if(feet.length) instAdd(g,rkEl,new THREE.BoxGeometry(0.14,0.55,0.8),rkMat,feet);
  }
  // ---- 排気ダクト EA ----
  if(["paint","varnish","tint","lab","hazwh"].includes(type)){
    const yEA=H*0.72, cEA=S*0.18, u0=-L*0.30, u1=L*0.18;
    const ea=mepEl("EA","角ダクト(排気)","700×450",b);
    duct(g,ea,[P(u0,cEA,yEA), P(u1,cEA,yEA), P(u1,cEA,H+0.6)], 0.7, 0.45);
    flowMark(g,ea,[P(u0,cEA,yEA), P(u1,cEA,yEA)],"EA 排気");
    const hd=mepEl("EA","排気フード・立下り","450×450",b);
    const nH = dense? 4 : 2;
    for(let j=0;j<nH;j++){
      const u=u0+(u1-u0)*((j+0.6)/(nH+0.2));
      duct(g,hd,[P(u,cEA,yEA-0.2), P(u,cEA,2.4)], 0.45, 0.45);
      const p=P(u,cEA,2.2);
      addSeg(g,hd,new THREE.BoxGeometry(1.5,0.5,1.5),mepMat(SYSTEMS.EA.color,0.4,0.4),p[0],p[1],p[2]);
      if(dense){ const ph=P(u,cEA,yEA+0.28); hang(ph[0],ph[1],ph[2],H); }
    }
    const fan=mepEl("EQ","屋上排気ファン","#7.5",b);
    const pF=P(u1,cEA,H+1.15);
    addSeg(g,fan,new THREE.CylinderGeometry(0.75,0.95,1.0,12),mepMat(SYSTEMS.EQ.color,0.5,0.4),pF[0],pF[1],pF[2]);
    const st=mepEl("EQ","排気スタック","φ500",b);
    const pS=P(u0,cEA,H+1.6);
    addSeg(g,st,new THREE.CylinderGeometry(0.26,0.26,2.6,10),mepMat(0xec8bc0,0.4,0.5),pS[0],pS[1],pS[2]);
    const pFea=P(u1,cEA,0);
    flash(pFea[0],pFea[2],0.42);
    flash(pS[0],pS[2],0.24);
  }
  // ---- 集塵スパイラルダクト DC（ミル・ディスパーへ実接続） ----
  if(dense && items){
    const dust=items.filter(it=>it.proc==="MILL"||it.proc==="DSP");
    if(dust.length){
      const us=dust.map(uOf), cs=dust.map(cOf);
      const uMin=Math.min(...us)-3, uMax=Math.max(...us)+3;
      const cM=cs.reduce((a2,v)=>a2+v,0)/cs.length;
      const yDC=H*0.55;
      const dm=mepEl("DC","集塵スパイラル(主管)","φ450",b);
      spiralRun(g,dm,[P(uMin,cM,yDC), P(uMax,cM,yDC), P(uMax,cM,H+0.5)], 0.23);
      flowMark(g,dm,[P(uMin,cM,yDC), P(uMax,cM,yDC)],"DC 集塵");
      const fx=mepEl("DC","集塵フレキ(機器接続)","φ180",b);
      const fxMat=mepMat(SYSTEMS.DC.color,0.6,0.4);
      dust.forEach(it=>{
        const p0=P(uOf(it),cM,yDC-0.15);
        const topY=it.h*0.92;
        const curve=new THREE.CatmullRomCurve3([
          new THREE.Vector3(p0[0],p0[1],p0[2]),
          new THREE.Vector3((p0[0]+it.x)/2,(yDC+topY)/2+1.2,(p0[2]+it.z)/2),
          new THREE.Vector3(it.x,topY,it.z)]);
        const fxm=addSeg(g,fx,new THREE.TubeGeometry(curve,12,0.09,8),fxMat,0,0,0);
        fxm.userData.noClash=true;   // 曲線チューブはAABBが大きく誤検知するため除外
        fx.len+=curve.getLength();
      });
      for(let u=uMin+3;u<uMax;u+=5){ const p=P(u,cM,yDC+0.25); hang(p[0],p[1],p[2],H); }
    }
  }
  // ---- スプリンクラー FP ----
  {
    const yFP=H*0.80;
    const fpm=mepEl("FP","SP主管","100A",b);
    pipeRun(g,fpm,[P(-L*0.46,0,yFP), P(L*0.46,0,yFP)], 0.09);
    flowMark(g,fpm,[P(-L*0.46,0,yFP), P(L*0.46,0,yFP)],"FP 消火");
    const fpr=mepEl("FP","SP立管(ｱﾗｰﾑ弁)","100A",b);
    pipeRun(g,fpr,[P(-L*0.46,0,yFP), P(-L*0.46,0,0.5), P(-L*0.40,0,0.5)], 0.09);
    valve(fpr, ...P(-L*0.46,0,1.4));
    if(dense){
      const av=mepEl("FP","アラーム弁ユニット","100A",b);
      const pAV=P(-L*0.46,0,0);
      addSeg(g,av,new THREE.CylinderGeometry(0.15,0.15,0.55,10),mepMat(0xc03028,0.4,0.45),pAV[0],0.95,pAV[2]);
      addSeg(g,av,new THREE.CylinderGeometry(0.05,0.05,0.4,6),mepMat(0xc03028,0.4,0.45),pAV[0]+0.2,1.1,pAV[2]);
      [0.14,-0.14].forEach(ox=>{
        const gd2=addSeg(g,av,new THREE.CylinderGeometry(0.075,0.075,0.03,10),gaugeMat,pAV[0]+ox,1.42,pAV[2]);
        gd2.rotation.z=Math.PI/2; gd2.userData.noClash=true;
      });
      const avl=makeLabel("アラーム弁",0.26,"#ff8880");
      avl.position.set(pAV[0],2.1,pAV[2]);
      avl.userData.mep=av; avl.userData.noClash=true;
      g.add(avl); av.meshes.push(avl);
    }
    const fpb=mepEl("FP","SP枝管+ヘッド","40A",b);
    const fMat=mepMat(SYSTEMS.FP.color,0.3,0.55);
    const spF = dense? 4.5 : 7/q;
    const hStep = dense? 4 : 6;
    const heads=[]; const sleeves=[];
    const qSleeve=new THREE.Quaternion().setFromUnitVectors(_UP,
      long? new THREE.Vector3(0,0,1) : new THREE.Vector3(1,0,0));
    for(let u=-L*0.46+3; u<L*0.46; u+=spF){
      pipeRun(g,fpb,[P(u,-S*0.45,yFP), P(u,S*0.45,yFP)], 0.045);
      const ps=P(u,0,yFP); sleeves.push([ps[0],ps[1],ps[2],qSleeve.clone()]);
      for(let c2=-S*0.40; c2<=S*0.42; c2+=hStep) heads.push(P(u,c2,yFP-0.14));
    }
    if(heads.length) instAdd(g,fpb,headGeo,fMat,heads);
    if(sleeves.length) instAdd(g,fpb,new THREE.CylinderGeometry(0.075,0.075,0.22,8),fMat,sleeves);
  }
  // ---- 電気ラック EL ----
  {
    const yEL=H*0.50, cEL=S*0.41;
    const tr=mepEl("EL","ケーブルラック+ケーブル束","W500",b);
    trayRun(g,tr,[P(-L*0.44,cEL,yEL), P(L*0.40,cEL,yEL)], 0.5, dense?7:0);
    trayRun(g,tr,[P(L*0.40,cEL,yEL), P(L*0.40,-S*0.20,yEL)], 0.4, dense?5:0);
    trayRun(g,tr,[P(-L*0.44,cEL,yEL+H*0.07), P(L*0.30,cEL,yEL+H*0.07)], 0.4, dense?4:0);
    const cnd=mepEl("EL","電線管(立下り)","E31",b);
    const nC=3+Math.round(q*2)+(dense?2:0);
    for(let i=0;i<nC;i++){
      const u=-L*0.40+rnd()*L*0.78;
      pipeRun(g,cnd,[P(u,cEL,yEL), P(u,cEL,1.0)], 0.035);
    }
    if(dense){ for(let u=-L*0.4;u<L*0.4;u+=7){ const p=P(u,cEL,yEL+0.06); hang(p[0],p[1],p[2],H); } }
    // 壁沿いのオレンジ電線管束（現地写真の特徴）
    const orn=mepEl("EL","電線管(橙・壁沿い)","G28",b);
    for(let j=0;j<3;j++)
      pipeRun(g,orn,[P(-L*0.42,S*0.465,H*0.30+j*0.15), P(L*0.38,S*0.465,H*0.30+j*0.15)],0.028,0xd97a2b);
    // 機器ごとの電源電線管（設備位置へ実接続・橙）
    if(dense && items){
      const pw=mepEl("EL","機器電源(電線管)","G28",b);
      items.filter(it=>["MILL","DSP","FIL","KVT","TNK"].includes(it.proc)).forEach(it=>{
        const uT=uOf(it), cT=cOf(it);
        pipeRun(g,pw,[P(uT,cEL,yEL), P(uT,cT,yEL), [it.x, it.h+0.12, it.z]],0.026,0xd97a2b);
      });
    }
    if(dense){
      // MCC盤2面 + トレイから盤天面へのケーブル束引き落とし
      const mcc=mepEl("EL","MCC盤+引込ケーブル","盤2面",b);
      const pnMat=mepMat(0xb9c2cc,0.5,0.3);
      const dkMat=mepMat(0x30343a,0.6,0.2);
      const cableCols2=[0x1c1e22,0x2a2530,0x223042,0x3a2424,0x1e2a22,0x30302a];
      [-L*0.15, L*0.10].forEach(uP=>{
        const pp=P(uP,cEL-0.95,1.15);
        addSeg(g,mcc, long? new THREE.BoxGeometry(1.9,2.3,0.55) : new THREE.BoxGeometry(0.55,2.3,1.9),
          pnMat,pp[0],pp[1],pp[2]);
        const pf=P(uP,cEL-1.25,1.5);
        addSeg(g,mcc, long? new THREE.BoxGeometry(1.7,1.6,0.03) : new THREE.BoxGeometry(0.03,1.6,1.7),
          dkMat,pf[0],pf[1],pf[2]);
        [[-0.35,0xc03028],[-0.1,0x3fae5a]].forEach(([ou,col])=>{
          const plp=P(uP+ou,cEL-1.27,2.05);
          const lampM=new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:0.7});
          const lm3=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.07,0.07),lampM);
          lm3.position.set(plp[0],plp[1],plp[2]); lm3.userData.mep=mcc;
          g.add(lm3); mcc.meshes.push(lm3);
        });
        for(let ci=0;ci<6;ci++){
          const off=(ci-2.5)*0.13;
          const a3=P(uP+off,cEL,yEL+0.06);
          const b3=P(uP+off*0.8,cEL-0.5,(yEL+2.4)/2);
          const c3=P(uP+off*0.55,cEL-0.95,2.32);
          const curve=new THREE.CatmullRomCurve3([
            new THREE.Vector3(a3[0],a3[1],a3[2]),
            new THREE.Vector3(b3[0],b3[1],b3[2]),
            new THREE.Vector3(c3[0],c3[1],c3[2])]);
          const cm3=new THREE.Mesh(new THREE.TubeGeometry(curve,10,0.02+((ci*3)%3)*0.004,5),
            mepMat(cableCols2[ci],0.85,0.1));
          cm3.userData.mep=mcc; cm3.userData.noClash=true;
          g.add(cm3); mcc.meshes.push(cm3);
        }
      });
    }
  }
  // ---- 衛生・排水 SN ----
  {
    const cSN=-S*0.44;
    const u0S=-L*0.30, u1S=L*0.46+2.0;
    const yAtSN=(u)=> 0.4 + (u1S-u)*0.01;         // 1/100勾配（搬出側へ流下）
    const sn=mepEl("SN","排水管(1/100勾配)","150A",b);
    pipeRun(g,sn,[P(u0S,cSN,yAtSN(u0S)), P(u1S,cSN,0.4)], 0.08);
    if(dense){
      const uWall=L/2, yWall=yAtSN(uWall);
      const qS2=new THREE.Quaternion().setFromUnitVectors(_UP,
        long? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,0,1));
      const pws=P(uWall,cSN,yWall);
      const sl2=addSeg(g,sn,new THREE.CylinderGeometry(0.14,0.14,0.62,8),
        mepMat(0x8a949e,0.6,0.4),pws[0],pws[1],pws[2],qS2);
      sl2.userData.noClash=true;
      const plG2= long? new THREE.BoxGeometry(0.06,0.5,0.5) : new THREE.BoxGeometry(0.5,0.5,0.06);
      const ppw=P(uWall-0.28,cSN,yWall);
      const pl3=addSeg(g,sn,plG2,mepMat(0x9aa3ad,0.6,0.3),ppw[0],ppw[1],ppw[2]);
      pl3.userData.noClash=true;
    }
    flowMark(g,sn,[P(u0S,cSN,yAtSN(u0S)), P(u1S,cSN,0.4)],"SN 排水",0.4);
    const slp=makeLabel("▽ 1/100", 0.32, "#4ade80");
    const pm=P((u0S+u1S)/2, cSN, yAtSN((u0S+u1S)/2)+1.9);
    slp.position.set(pm[0],pm[1],pm[2]);
    slp.userData.mep=sn; slp.userData.noClash=true;
    g.add(slp); sn.meshes.push(slp);
    [0.25,0.65].forEach(t2=>{               // 掃除口（キャップ+角ナット）
      const uC=u0S+(u1S-u0S)*t2;
      const pC2=P(uC,cSN,yAtSN(uC)+0.12);
      addSeg(g,sn,new THREE.CylinderGeometry(0.055,0.055,0.14,8),mepMat(SYSTEMS.SN.color,0.4,0.5),pC2[0],pC2[1],pC2[2]);
      addSeg(g,sn,new THREE.CylinderGeometry(0.07,0.07,0.03,6),mepMat(0xd8b81e,0.5,0.4),pC2[0],pC2[1]+0.08,pC2[2]);
    });
    const rd=mepEl("SN","竪樋(ルーフドレン)","100A",b);
    pipeRun(g,rd,[P(L*0.44,cSN,H+0.2), P(L*0.44,cSN,yAtSN(L*0.44))], 0.06);
    pipeRun(g,rd,[P(-L*0.40,cSN,H+0.2), P(-L*0.40,cSN,yAtSN(-L*0.40))], 0.06);
    [[L*0.44],[-L*0.40]].forEach(([uD])=>{
      const pFd=P(uD,cSN,0); flash(pFd[0],pFd[2],0.13);
    });
  }
  // ---- プロセス配管 PR（外部引込+タンクヘッダー実接続） ----
  if(["paint","varnish","tint"].includes(type)){
    const nP=2+(dense?2:1);
    const prNames=["溶剤","樹脂","希釈","洗浄"];
    for(let i=0;i<nP;i++){
      const pr=mepEl("PR","プロセス配管("+prNames[i%4]+")","80A",b);
      const uT=-L*0.06+i*2.0, y=H*0.40+i*0.28;
      pipeRun(g,pr,[P(uT,S/2+1.6,y), P(uT,-S*0.05,y), P(uT,-S*0.05,1.1)], 0.055);
      if(dense){
        // 壁貫通スリーブ+エスカッション板
        const ps2=P(uT,S/2,y);
        const qS=new THREE.Quaternion().setFromUnitVectors(_UP,
          long? new THREE.Vector3(0,0,1) : new THREE.Vector3(1,0,0));
        const sl=addSeg(g,pr,new THREE.CylinderGeometry(0.11,0.11,0.62,8),
          mepMat(0x8a949e,0.6,0.4),ps2[0],ps2[1],ps2[2],qS);
        sl.userData.noClash=true;
        const plGeo= long? new THREE.BoxGeometry(0.44,0.44,0.06) : new THREE.BoxGeometry(0.06,0.44,0.44);
        const ppl=P(uT,S/2-0.28,y);
        const pl2=addSeg(g,pr,plGeo,mepMat(0x9aa3ad,0.6,0.3),ppl[0],ppl[1],ppl[2]);
        pl2.userData.noClash=true;
      }
      valve(pr, ...P(uT,-S*0.05,H*0.30));
    }
    if(dense && items){
      const tanks=items.filter(it=>["DSP","TNK","KVT"].includes(it.proc));
      if(tanks.length){
        const us=tanks.map(uOf), cs=tanks.map(cOf);
        const uMin=Math.min(...us)-2, uMax=Math.max(...us)+2;
        const cH=cs.reduce((a2,v)=>a2+v,0)/cs.length;
        const yH=H*0.44;
        const hd2=mepEl("PR","樹脂・溶剤ヘッダー","65A",b);
        pipeRun(g,hd2,[P(uMin,cH,yH), P(uMax,cH,yH)],0.05);
        flowMark(g,hd2,[P(uMin,cH,yH), P(uMax,cH,yH)],"PR 樹脂/溶剤",0.5);
        const ov=mepEl("PR","流量計(OVAL)","LS5076",b);
        [0.3,0.7].forEach(t2=>{
          const pv=P(uMin+(uMax-uMin)*t2,cH,yH);
          addSeg(g,ov,new THREE.BoxGeometry(0.34,0.42,0.28),mepMat(0xe8e6df,0.5,0.2),pv[0],pv[1]-0.02,pv[2]);
          addSeg(g,ov,new THREE.BoxGeometry(0.2,0.12,0.05),mepMat(0x22262b,0.4,0.2),pv[0],pv[1]+0.16,pv[2]+0.15);
        });
        const dp=mepEl("PR","タンク供給管+弁","40A",b);
        tanks.forEach(it=>{
          const uT=uOf(it), cT=cOf(it);
          pipeRun(g,dp,[P(uT,cH,yH), P(uT,cT,yH), [it.x, it.h+0.25, it.z]],0.036);
          valve(dp, it.x, it.h+0.9, it.z);
        });
        for(let u=uMin+3;u<uMax;u+=6){ const p=P(u,cH,yH+0.05); hang(p[0],p[1],p[2],H); }
      }
      // タンク間オーバーフロー渡り配管（隣接槽の天端同士を接続）
      {
        const ov2=mepEl("PR","オーバーフロー渡り配管","40A",b);
        ["KVT","TNK"].forEach(pk=>{
          const tk=items.filter(it=>it.proc===pk);
          tk.sort((a2,b2)=>cOf(a2)-cOf(b2));
          for(let i2=0;i2<tk.length-1;i2++){
            const A=tk[i2], B2=tk[i2+1];
            const yA=A.h*0.9, yB=B2.h*0.9;
            pipeRun(g,ov2,[[A.x,yA,A.z],
              [(A.x+B2.x)/2, Math.max(yA,yB)+0.6, (A.z+B2.z)/2],
              [B2.x,yB,B2.z]], 0.042, SYSTEMS.PR.color);
          }
        });
      }
      // 床のカムロックマニホールド
      const mf=mepEl("PR","床配管ﾏﾆﾎｰﾙﾄﾞ(樹脂送り)","S-7,8",b);
      for(let i=0;i<3;i++){
        const p=P(-L*0.06+i*2.0, -S*0.05, 0.5);
        addSeg(g,mf,new THREE.CylinderGeometry(0.08,0.08,1.0,8),mepMat(SYSTEMS.PR.color,0.4,0.5),p[0],p[1],p[2]);
        addSeg(g,mf,new THREE.SphereGeometry(0.11,8,6),mepMat(0xc9975a,0.4,0.5),p[0],p[1]+0.55,p[2]);
      }
    }
  }
  // ---- 圧縮空気配管 CA（充填機・ディスパーへ実接続） ----
  if(dense && items){
    const air=items.filter(it=>it.proc==="FIL"||it.proc==="DSP");
    if(air.length){
      const ca=mepEl("CA","圧縮空気(主管)","25A",b);
      const yCA=H*0.34, cCA=-S*0.465;
      pipeRun(g,ca,[P(-L*0.44,cCA,yCA), P(L*0.44,cCA,yCA)],0.03);
      flowMark(g,ca,[P(-L*0.44,cCA,yCA), P(L*0.44,cCA,yCA)],"CA 圧空",0.45);
      // エアレシーバ（ヘッダータンク）
      const qRun=new THREE.Quaternion().setFromUnitVectors(_UP,
        long? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,0,1));
      const pHca=P(-L*0.44+1.1,cCA,yCA);
      addSeg(g,ca,new THREE.CylinderGeometry(0.17,0.17,1.3,10),
        mepMat(SYSTEMS.CA.color,0.4,0.5),pHca[0],pHca[1],pHca[2],qRun);
      const cad=mepEl("CA","圧縮空気(分岐)+FR","15A",b);
      air.forEach(it=>{
        const uT=uOf(it), cT=cOf(it);
        pipeRun(g,cad,[P(uT,cCA,yCA), P(uT,cT,yCA), [it.x, it.h*0.7, it.z]],0.02);
        // フィルタレギュレータ（本体+透明ボウル）
        addSeg(g,cad,new THREE.CylinderGeometry(0.05,0.05,0.17,8),
          mepMat(SYSTEMS.CA.color,0.4,0.5), it.x, it.h*0.7+0.1, it.z);
        addSeg(g,cad,new THREE.CylinderGeometry(0.037,0.028,0.13,8),
          mepMat(0xd9c06a,0.3,0.2), it.x, it.h*0.7-0.06, it.z);
      });
    }
  }
  // ---- 細径配管の大増設（壁面バンク・計装壁・ドレン網・床側溝） ----
  if(dense){
    const zinc=0xb8bfc6;
    const pipeBank=(el,u0b,u1b,cW,defs)=>{
      defs.forEach(df=>pipeRun(g,el,[P(u0b,cW,df.y),P(u1b,cW,df.y)],df.r,df.col));
      const ys=defs.map(d2=>d2.y);
      const yMin=Math.min(...ys), yMax=Math.max(...ys);
      const brGeo=new THREE.BoxGeometry(0.06,yMax-yMin+0.35,0.24);
      const list=[];
      const off=cW>0?0.14:-0.14;
      for(let u=u0b+2;u<u1b;u+=4.5) list.push(P(u,cW+off,(yMin+yMax)/2));
      if(list.length) instAdd(g,el,brGeo,mepMat(0x8a949e,0.6,0.4),list);
    };
    // 壁面多段配管バンク（両長辺壁: 亜鉛管+系統色の小径管）
    const bkA=mepEl("PR","壁面配管バンクA","20〜50A×9",b);
    pipeBank(bkA,-L*0.42,L*0.40,S*0.452,[
      {y:H*0.20,r:0.05,col:zinc},{y:H*0.20+0.14,r:0.04,col:zinc},{y:H*0.20+0.27,r:0.035,col:zinc},
      {y:H*0.20+0.39,r:0.03,col:zinc},{y:H*0.20+0.50,r:0.025,col:zinc},
      {y:H*0.50,r:0.04,col:SYSTEMS.PR.color},{y:H*0.50+0.13,r:0.035,col:SYSTEMS.SN.color},
      {y:H*0.50+0.25,r:0.03,col:SYSTEMS.CA.color},{y:H*0.50+0.36,r:0.04,col:SYSTEMS.FP.color}]);
    const bkB=mepEl("PR","壁面配管バンクB","15〜40A×9",b);
    pipeBank(bkB,-L*0.40,L*0.42,-S*0.452,[
      {y:H*0.33,r:0.045,col:zinc},{y:H*0.33+0.13,r:0.04,col:zinc},{y:H*0.33+0.25,r:0.035,col:zinc},
      {y:H*0.33+0.36,r:0.03,col:zinc},{y:H*0.33+0.46,r:0.025,col:zinc},{y:H*0.33+0.55,r:0.022,col:zinc},
      {y:H*0.58,r:0.02,col:SYSTEMS.CA.color},{y:H*0.58+0.1,r:0.018,col:zinc},{y:H*0.58+0.19,r:0.016,col:zinc}]);
    // 天井ユーティリティヘッダー（蒸気/還水/N2/希釈の4本）
    const ut=mepEl("PR","天井ﾕｰﾃｨﾘﾃｨﾍｯﾀﾞｰ","25〜50A×4",b);
    [[H*0.565,0.045,zinc],[H*0.565+0.13,0.04,zinc],
     [H*0.565+0.25,0.032,SYSTEMS.SN.color],[H*0.565+0.35,0.03,SYSTEMS.PR.color]]
      .forEach(([y2,r2,col2])=>pipeRun(g,ut,[P(-L*0.40,-S*0.22,y2),P(L*0.42,-S*0.22,y2)],r2,col2));
    for(let u=-L*0.38;u<L*0.40;u+=6){ const p=P(u,-S*0.22,H*0.565+0.45); hang(p[0],p[1],p[2],H); }
    if(["paint","varnish","tint"].includes(type)){
      // 計装・分配ヘッダー壁（立上り12本+緑ハンドル弁+圧力計）
      const iw=mepEl("PR","計装・分配ヘッダー壁","25A×12",b);
      const cWl=-S*0.452, u0i=-L*0.10, u1i=L*0.10;
      pipeRun(g,iw,[P(u0i,cWl,0.8),P(u1i,cWl,0.8)],0.05);
      pipeRun(g,iw,[P(u0i,cWl,H*0.30),P(u1i,cWl,H*0.30)],0.05);
      const nV=12, verts=[], wheels=[], gauges=[];
      const qWheel=new THREE.Quaternion().setFromUnitVectors(_Z,_UP);
      const nrm= long? new THREE.Vector3(0,0,1) : new THREE.Vector3(1,0,0);
      const qGauge=new THREE.Quaternion().setFromUnitVectors(_UP,nrm);
      for(let i=0;i<nV;i++){
        const u=u0i+(i+0.5)*(u1i-u0i)/nV;
        verts.push(P(u,cWl,(0.8+H*0.30)/2));
        wheels.push([...P(u,cWl+0.17,1.7),qWheel]);
        gauges.push([...P(u,cWl+0.15,2.4),qGauge]);
      }
      instAdd(g,iw,new THREE.CylinderGeometry(0.028,0.028,H*0.30-0.8,6),
        mepMat(SYSTEMS.PR.color,0.4,0.5),verts);
      instAdd(g,iw,new THREE.TorusGeometry(0.11,0.028,6,10),mepMat(0x2e8b4a,0.5,0.3),wheels);
      instAdd(g,iw,new THREE.CylinderGeometry(0.07,0.07,0.03,10),mepMat(0xf2f4f1,0.35,0.2),gauges);
      // 床側溝+グレーチング
      const gut=mepEl("SN","床側溝+ｸﾞﾚｰﾁﾝｸﾞ","W500",b);
      const cG=-S*0.40, gu0=-L*0.36, gu1=L*0.42;
      const chGeo= long? new THREE.BoxGeometry(gu1-gu0,0.06,0.5) : new THREE.BoxGeometry(0.5,0.06,gu1-gu0);
      const pch=P((gu0+gu1)/2,cG,0.03);
      addSeg(g,gut,chGeo,mepMat(0x22262b,0.9,0.1),pch[0],pch[1],pch[2]);
      const grGeo= long? new THREE.BoxGeometry(0.09,0.025,0.46) : new THREE.BoxGeometry(0.46,0.025,0.09);
      const grList=[];
      for(let u=gu0+0.3;u<gu1;u+=0.4) grList.push(P(u,cG,0.07));
      instAdd(g,gut,grGeo,mepMat(0x707a84,0.6,0.4),grList);
      // 機器ドレン網（全タンク類→側溝へ）
      if(items){
        const dr=mepEl("SN","機器ドレン配管","20A",b);
        items.filter(it=>["DSP","TNK","KVT","PTK"].includes(it.proc)).forEach(it=>{
          const uT=uOf(it);
          pipeRun(g,dr,[[it.x,0.45,it.z],[it.x,0.12,it.z], P(uT,cG,0.12)],0.022);
        });
      }
      // 計装エアチューブ（CA主管→計装壁）
      const tub=mepEl("CA","計装エアチューブ","6φ×6",b);
      for(let i=0;i<6;i++){
        const u=-L*0.095+i*(L*0.01);
        pipeRun(g,tub,[P(u,-S*0.465,H*0.34), P(u,cWl+0.02,2.6+i*0.12)],0.012,0xd8dee5);
      }
    }
    if(type==="wh"){
      // 原料倉庫の天井蛇行保温配管（現地写真の銀ジャケット）
      const sn2=mepEl("DC","天井保温配管(蛇行)","φ250",b);
      spiralRun(g,sn2,[P(-L*0.40,-S*0.15,H*0.62),P(-L*0.10,-S*0.15,H*0.62),
        P(-L*0.10,S*0.20,H*0.62),P(L*0.20,S*0.20,H*0.62),
        P(L*0.20,-S*0.05,H*0.62),P(L*0.42,-S*0.05,H*0.62)],0.13,0xc9ced4,1.4,SYSTEMS.SN.color);
    }
  }
  if(rods.length && elHang) instAdd(g,elHang,rodGeo,rodMat,rods);
  if(dense){ for(let i=startIdx;i<mepAll.length;i++) mepAll[i].int=true; }
  return g;
}
// ---- 屋外配管ラック（タンクヤード⇔工場） ----
function regenRacks(){
  const ids=["tankA","tankB","paint1","paint2","varnish"];
  const get=id=>siteCtx.items.find(i=>i.id===id);
  const sig=ids.map(id=>{const it=get(id); return it? Math.round(it.x)+","+Math.round(it.z):"";}).join(";");
  if(sig===rackSig && rackGroup) return;
  rackSig=sig;
  if(rackGroup){ mepAll=mepAll.filter(e=>!e.rack); clearGroup(rackGroup); mepGroup.remove(rackGroup); }
  rackGroup=new THREE.Group(); mepGroup.add(rackGroup);
  function mkRoute(fromId,toId){
    const a=get(fromId), c=get(toId); if(!a||!c) return null;
    if(Math.abs(a.x-c.x) < c.w/2){
      const sz=a.z + (c.z>a.z? a.d/2 : -a.d/2);
      const ez=c.z + (a.z>c.z? c.d/2+0.3 : -(c.d/2+0.3));
      return [[a.x,sz],[a.x,ez]];
    }
    const sx=a.x + (c.x>a.x? a.w/2+2.5 : -(a.w/2+2.5));
    const ez=c.z + (a.z>c.z? c.d/2+0.3 : -(c.d/2+0.3));
    return [[sx,a.z],[c.x,a.z],[c.x,ez]];
  }
  const tiers=[["PR","80A",0.085,4.35,"jacket",false],["PR","80A",0.085,4.65,null,true],
               ["FP","65A",0.065,4.95,null,false],["SN","50A(N2/ｴｱ)",0.055,5.25,null,false],
               ["CA","25A",0.032,5.50,null,false],["PR","40A",0.045,5.68,null,false],
               ["SN","25A",0.030,5.86,null,false]];
  [["tankA","paint1"],["tankA","paint2"],["tankB","varnish"]].forEach(([f,t])=>{
    const route=mkRoute(f,t); if(!route) return;
    tiers.forEach(([sys,size,r,y,style,loop])=>{
      const el=mepEl(sys,"屋外配管("+f+"→"+t+")"+(style?"・保温":""),size,null); el.rack=true;
      let path3=route.map(([x,z])=>[x,y,z]);
      if(loop){
        // 最長区間に伸縮ループ(Ω)を挿入
        let bi=0,bl=0;
        for(let i=1;i<route.length;i++){
          const l2=Math.hypot(route[i][0]-route[i-1][0],route[i][1]-route[i-1][1]);
          if(l2>bl){bl=l2;bi=i;}
        }
        if(bl>14){
          const a=route[bi-1], b2=route[bi];
          const mx=(a[0]+b2[0])/2, mz=(a[1]+b2[1])/2;
          const ux=(b2[0]-a[0])/bl, uz=(b2[1]-a[1])/bl;
          path3=[];
          route.forEach((pt,i)=>{
            if(i===bi){
              path3.push([mx-ux*1.5,y,mz-uz*1.5],[mx-ux*1.5,y+1.5,mz-uz*1.5],
                         [mx+ux*1.5,y+1.5,mz+uz*1.5],[mx+ux*1.5,y,mz+uz*1.5]);
            }
            path3.push([pt[0],y,pt[1]]);
          });
        }
      }
      if(style==="jacket") spiralRun(rackGroup,el,path3,r*1.25,0xc9ced4,1.6,SYSTEMS[sys].color);
      else pipeRun(rackGroup,el,path3,r);
    });
    const rk=mepEl("RK","配管ラック架台","H-200",null); rk.rack=true;
    const rMat=mepMat(SYSTEMS.RK.color,0.6,0.5);
    for(let i=1;i<route.length;i++){
      const ax=route[i-1][0], az=route[i-1][1], bx=route[i][0], bz=route[i][1];
      const dx=bx-ax, dz=bz-az, len=Math.hypot(dx,dz); if(len<2) continue;
      const ux=dx/len, uz=dz/len, px2=-uz, pz2=ux;
      for(let d3=1; d3<len; d3+=7){
        const x=ax+ux*d3, z=az+uz*d3;
        [-0.95,0.95].forEach(o=>{
          addSeg(rackGroup,rk,new THREE.BoxGeometry(0.26,6.5,0.26),rMat,x+px2*o,3.25,z+pz2*o);
        });
        const beamGeo=Math.abs(px2)>0.5? new THREE.BoxGeometry(2.3,0.22,0.22): new THREE.BoxGeometry(0.22,0.22,2.3);
        [4.1,5.5,6.15].forEach(y=>addSeg(rackGroup,rk,beamGeo,rMat,x,y,z));
      }
    }
  });
  // 建屋間パイプブリッジ（ワニス⇔第一ペイント、建屋移動に追従）
  {
    const va=get("varnish"), p1=get("paint1");
    if(va&&p1){
      const dirX = p1.x>va.x? 1 : -1;
      const sx=va.x+dirX*(va.w/2+0.2), ex=p1.x-dirX*(p1.w/2+0.2);
      const bz=Math.abs(va.z-p1.z)<p1.d/2? va.z : (va.z+p1.z)/2;
      const yB=6.2;
      const bel=mepEl("PR","渡り配管ブリッジ(ﾜﾆｽ⇔第一P)","50A×3",null); bel.rack=true;
      [[0,SYSTEMS.PR.color],[0.3,0xb8bfc6],[0.6,SYSTEMS.SN.color]].forEach(([dy,col])=>
        pipeRun(rackGroup,bel,[[sx,yB+dy,bz],[ex,yB+dy,bz]],0.05,col));
      const brk=mepEl("RK","ブリッジ架構","L-75",null); brk.rack=true;
      const bMat=mepMat(SYSTEMS.RK.color,0.6,0.5);
      [sx,ex].forEach(x=>{
        [-0.5,0.5].forEach(oz=>{
          addSeg(rackGroup,brk,new THREE.BoxGeometry(0.15,yB+1.2,0.15),bMat,x,(yB+1.2)/2,bz+oz);
        });
      });
      const spanLen=Math.max(0.5,Math.abs(ex-sx));
      [yB-0.25,yB+0.95].forEach(y=>{
        [-0.5,0.5].forEach(oz=>{
          addSeg(rackGroup,brk,new THREE.BoxGeometry(spanLen,0.12,0.12),bMat,(sx+ex)/2,y,bz+oz);
        });
      });
    }
  }
  buildLayersUI();
}
function ensureMEP(){
  if(mepBGroups.size) return;
  siteCtx.items.forEach(b=>{
    if(!b.enter) return;
    const g=genBuildingMEP(b, 1.4, false);
    mepBGroups.set(b.id,g); mepGroup.add(g);
  });
  buildLayersUI();
}
function disposeMEPAll(){
  clearHi(); clearClashes(); hideMepProp();
  clearGroup(mepGroup);
  mepBGroups.clear(); mepIntGroups.clear(); rackGroup=null; rackSig=""; mepAll=[]; mepSeq=0; mepMats={};
  const l=document.getElementById("layerList"); if(l) l.innerHTML="";
}
function applySysVis(){
  mepAll.forEach(el=>{ const v=sysVis[el.sys]; el.meshes.forEach(m=>{ m.visible=v; }); });
}
function updateMEPScene(){
  if(!bimMode){ mepGroup.visible=false; clashGroup.visible=false; return; }
  ensureMEP();
  if(ctx.kind==="site") regenRacks();
  mepGroup.visible=true; clashGroup.visible=true;
  siteCtx.items.forEach(b=>{ const g=mepBGroups.get(b.id); if(g) g.position.set(b.x,0,b.z); });
  if(ctx.kind==="interior"){
    mepBGroups.forEach(g=>{ g.visible=false; });
    if(rackGroup) rackGroup.visible=false;
    const bI=currentBuilding;
    const icI=interiorCtxs.get(bI.id);
    const sigI=icI? icI.items.map(it=>it.proc+it.x.toFixed(3)+","+it.z.toFixed(3)+","+it.w+","+it.d+","+it.h).join(";") : "";
    let ig=mepIntGroups.get(bI.id);
    if(ig && ig.userData.sig!==sigI){
      mepAll=mepAll.filter(e=>!(e.int && e.bId===bI.id));
      clearGroup(ig); mepGroup.remove(ig); mepIntGroups.delete(bI.id); ig=null;
    }
    if(!ig){
      const bs={ id:bI.id, name:bI.name, proc:bI.proc,
                 w:bI.w*INT_SCALE, d:bI.d*INT_SCALE, h:bI.h, x:0, z:0 };
      ig=genBuildingMEP(bs, 2.0, true, icI? icI.items : null);
      ig.userData.sig=sigI;
      mepIntGroups.set(bI.id, ig); mepGroup.add(ig);
    }
    mepIntGroups.forEach((g2,id)=>{ g2.visible=(id===currentBuilding.id); });
    ig.position.set(0,0,0);
  } else {
    mepIntGroups.forEach(g2=>{ g2.visible=false; });
    mepBGroups.forEach(g=>{ g.visible=true; });
    if(rackGroup) rackGroup.visible=true;
  }
  applySysVis();
  buildLayersUI();
  renderSchematic();
}
function buildLayersUI(){
  const wrap=document.getElementById("layerList"); if(!wrap) return;
  wrap.innerHTML="";
  const intView = ctx.kind==="interior" && currentBuilding;
  Object.entries(SYSTEMS).forEach(([k,s])=>{
    const els=mepAll.filter(e=>e.sys===k &&
      (intView ? (e.int && e.bId===currentBuilding.id) : !e.int));
    if(!els.length) return;
    const len=Math.round(els.reduce((a2,e)=>a2+e.len,0));
    const lab=document.createElement("label");
    lab.innerHTML='<input type="checkbox" '+(sysVis[k]?"checked":"")+'>'
      +'<span class="swatch" style="background:#'+s.color.toString(16).padStart(6,"0")+'"></span>'+s.name
      +'<span class="cnt">'+els.length+'件/'+len+'m</span>';
    lab.querySelector("input").onchange=(ev)=>{ sysVis[k]=ev.target.checked; applySysVis(); };
    wrap.appendChild(lab);
  });
}
// ---- MEP選択・属性表示 ----
const hiOrig=new Map(); let hiMats=[];
function mepHi(els){
  clearHi();
  if(!els||!els.length) return;
  els.forEach(el=>{
    const m2=new THREE.MeshStandardMaterial({color:SYSTEMS[el.sys].color,
      emissive:SYSTEMS[el.sys].color, emissiveIntensity:0.8, roughness:0.3});
    hiMats.push(m2);
    el.meshes.forEach(m=>{ if(!hiOrig.has(m)) hiOrig.set(m,m.material); m.material=m2; });
  });
}
function clearHi(){
  hiOrig.forEach((mat,m)=>{ m.material=mat; }); hiOrig.clear();
  hiMats.forEach(m=>m.dispose()); hiMats=[];
}
function pickMep(e){
  if(!bimMode||!mepGroup.visible) return null;
  toNdc(e); ray.setFromCamera(ndc,camera);
  const hits=ray.intersectObjects(mepGroup.children,true);
  for(const h of hits){
    let o=h.object, vis=true;
    while(o){ if(o.visible===false){vis=false;break;} o=o.parent; }
    if(vis && h.object.userData.mep) return {el:h.object.userData.mep, point:h.point};
  }
  return null;
}
function showMepProp(el){
  mepHi([el]);
  const sc=SYSTEMS[el.sys].color.toString(16).padStart(6,"0");
  document.getElementById("mepPropBody").innerHTML=
    '<h4><span class="swatch" style="background:#'+sc+'"></span>'+el.id+'</h4>'
    +'<div class="kv"><span>系統</span><b>'+SYSTEMS[el.sys].name+'</b></div>'
    +'<div class="kv"><span>種別</span><b>'+el.kind+'</b></div>'
    +'<div class="kv"><span>サイズ</span><b>'+el.size+'</b></div>'
    +'<div class="kv"><span>建屋</span><b>'+el.bName+'</b></div>'
    +'<div class="kv"><span>モデル経路長</span><b>'+el.len.toFixed(1)+' m</b></div>';
  document.getElementById("mepProp").style.display="block";
}
function hideMepProp(){ clearHi(); const p=document.getElementById("mepProp"); if(p) p.style.display="none"; }
// ---- 干渉チェック ----
let clashes=[];
function clearClashes(){ clearGroup(clashGroup); clashes=[];
  const p=document.getElementById("clashPanel"); if(p) p.style.display="none"; }
function runClash(){
  if(!bimMode) return;
  ensureMEP(); clearClashes();
  const scope = ctx.kind==="interior"? currentBuilding.id : null;
  const boxes=[];
  mepAll.forEach(el=>{
    if(el.sys==="RK"||el.sys==="EQ") return;
    if(scope){ if(!el.int || el.bId!==scope) return; }
    else if(el.int) return;
    el.meshes.forEach(m=>{
      if(!m.visible || m.userData.noClash) return;
      boxes.push({el, bb:new THREE.Box3().setFromObject(m)});
    });
  });
  const seen=new Set(); const inter=new THREE.Box3(); const sz=new THREE.Vector3();
  for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++){
    const A=boxes[i], B=boxes[j];
    if(A.el===B.el || A.el.sys===B.el.sys || A.el.bId!==B.el.bId) continue;
    if(!A.bb.intersectsBox(B.bb)) continue;
    inter.copy(A.bb).intersect(B.bb); inter.getSize(sz);
    if(Math.min(sz.x,sz.y,sz.z)<0.02) continue;
    const key=[A.el.id,B.el.id].sort().join("|");
    if(seen.has(key)) continue; seen.add(key);
    clashes.push({a:A.el, b:B.el, p:inter.getCenter(new THREE.Vector3())});
  }
  clashes.forEach(cl=>{
    const s=new THREE.Mesh(new THREE.SphereGeometry(0.6,10,8),
      new THREE.MeshBasicMaterial({color:0xff2d20,transparent:true,opacity:0.5,depthTest:false}));
    s.position.copy(cl.p); clashGroup.add(s);
  });
  renderClashUI();
  toast(clashes.length? "干渉チェック完了: "+clashes.length+"件を検出 — 一覧クリックでズーム"
                      : "干渉チェック完了: 表示中の系統に干渉はありません");
}
function renderClashUI(){
  const p=document.getElementById("clashPanel");
  if(!clashes.length){ p.style.display="none"; return; }
  p.style.display="block";
  document.getElementById("clashList").innerHTML=clashes.map((c,i)=>
    '<div class="ci" data-i="'+i+'"><b style="color:var(--bad)">C-'+String(i+1).padStart(2,"0")+'</b> '
    +c.a.id+' × '+c.b.id+'<br><span style="color:var(--sub);font-size:11px">'
    +SYSTEMS[c.a.sys].name+' × '+SYSTEMS[c.b.sys].name+' — '+c.a.bName+'</span></div>').join("");
  document.querySelectorAll("#clashPanel .ci").forEach(d=>{
    d.onclick=()=>{
      const c=clashes[+d.dataset.i];
      camGoal.target.set(c.p.x,c.p.y,c.p.z);
      camGoal.dist = ctx.kind==="site"? 55 : 24;
      camGoal.pitch=0.9;
      showMepProp(c.a); mepHi([c.a,c.b]);
    };
  });
}


// ================= 敷地外構（現地写真ベース） =================
function addSiteExtras(){
  const g=new THREE.Group(); siteGroup.add(g);
  const put=(mesh,x,y,z)=>{ mesh.position.set(x,y,z); g.add(mesh); return mesh; };
  const lineMat=new THREE.MeshBasicMaterial({color:0xe8e5dc});
  // ---- 駐車場（正門東側・社用車の白い車列） ----
  const parkX=-30, parkZ=-66;
  const carCols=[0xeceff1,0xdfe3e6,0x9aa3ad,0x394452,0xf4f6f8,0xcfd6dd];
  for(let i=0;i<7;i++){
    const ln=new THREE.Mesh(new THREE.PlaneGeometry(0.22,5.6),lineMat);
    ln.rotation.x=-Math.PI/2; put(ln, parkX-15+i*5, 0.06, parkZ);
    if(i<6){
      const car=new THREE.Mesh(new THREE.BoxGeometry(2.0,1.15,4.4),
        new THREE.MeshStandardMaterial({color:carCols[i],roughness:0.35,metalness:0.5}));
      put(car, parkX-12.5+i*5, 0.6, parkZ);
      const cab=new THREE.Mesh(new THREE.BoxGeometry(1.8,0.62,2.2),
        new THREE.MeshStandardMaterial({color:0x22262b,roughness:0.2,metalness:0.6}));
      put(cab, parkX-12.5+i*5, 1.45, parkZ-0.2);
    }
  }
  // ---- 松の木（外周・円錐3段の樹冠） ----
  const trunkM=new THREE.MeshStandardMaterial({color:0x6b4a2a,roughness:0.9});
  const pineM=new THREE.MeshStandardMaterial({color:0x2c5b35,roughness:0.85});
  const pineM2=new THREE.MeshStandardMaterial({color:0x35693f,roughness:0.85});
  const crown=[[3.3,3.6,3.6],[2.7,3.0,5.6],[2.0,2.6,7.3]];   // r,h,y
  [[-75,-88],[-98,-76],[6,-89],[104,-82],[122,20],[-100,-88],[40,-89],[75,-89],
   [-90,88],[-50,89],[-10,88],[30,89],[70,88],[110,89],
   [-126,-40],[-126,50],[126,-50],[126,55]].forEach(([px,pz],ti)=>{
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.42,4.5,7),trunkM),px,2.25,pz);
    crown.forEach(([r,h,y],i)=>{
      const c2=new THREE.Mesh(new THREE.ConeGeometry(r*(0.9+(ti%3)*0.06),h,9), (ti+i)%2? pineM : pineM2);
      put(c2,px+(i%2?0.3:-0.2),y,pz);
    });
  });
  // ---- 屋外ドラムヤード + IBC（タンクヤード東） ----
  const dCols=[0x2c5b3f,0x2f6db3,0x1f3a63,0x9aa3ad];
  for(let r=0;r<3;r++) for(let q=0;q<6;q++)
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.42,1.15,10),
      new THREE.MeshStandardMaterial({color:dCols[(r+q)%4],roughness:0.5,metalness:0.4})),
      93+q*1.1, 0.58, 6+r*1.3);
  for(let q=0;q<3;q++){
    put(new THREE.Mesh(new THREE.BoxGeometry(1.6,1.5,1.6),
      new THREE.MeshStandardMaterial({color:0xeef0ea,roughness:0.6,transparent:true,opacity:0.9})),
      93+q*2.2, 0.97, 11.5);
    put(new THREE.Mesh(new THREE.BoxGeometry(1.7,0.22,1.7),
      new THREE.MeshStandardMaterial({color:0x8a949e,roughness:0.6,metalness:0.4})),
      93+q*2.2, 0.11, 11.5);
  }
  // ---- 木パレットストック（出荷倉庫南側） ----
  const palM=new THREE.MeshStandardMaterial({color:0x9a7844,roughness:0.95});
  for(let q=0;q<4;q++)
    put(new THREE.Mesh(new THREE.BoxGeometry(2.4,1.6+(q%2)*0.6,2.4),palM), 6+q*2.9, 0.8+(q%2)*0.3, -64);
  // フォークリフト充電シェッド（屋根付き・出荷倉庫脇）
  {
    const shed=new THREE.Group(); g.add(shed);
    shed.position.set(23,0,-63);
    const sp2=new THREE.MeshStandardMaterial({color:0x8a949e,roughness:0.6,metalness:0.3});
    [[-2.3,-1.7],[2.3,-1.7],[-2.3,1.7],[2.3,1.7]].forEach(([sx,sz])=>{
      const p2=new THREE.Mesh(new THREE.BoxGeometry(0.15,3.2,0.15),sp2);
      p2.position.set(sx,1.6,sz); shed.add(p2);
    });
    const roof2=new THREE.Mesh(new THREE.BoxGeometry(5.4,0.14,4.2),
      new THREE.MeshStandardMaterial({color:0x5d6570,roughness:0.7}));
    roof2.position.set(0,3.27,0); shed.add(roof2);
    const chg2=new THREE.Mesh(new THREE.BoxGeometry(0.7,1.4,0.5),
      new THREE.MeshStandardMaterial({color:0x2f6db3,roughness:0.5}));
    chg2.position.set(-1.85,0.7,-1.2); shed.add(chg2);
    const fk2=makeForklift(false);
    fk2.rotation.y=Math.PI/2; fk2.position.set(0.4,0,0); shed.add(fk2);
  }
  // ---- 構内道路（アスファルト+外側線+破線中央線） ----
  const roadMat=new THREE.MeshStandardMaterial({color:0x30353c,roughness:0.95});
  const ROADS=[[-22,-60,186,8],[-55,-29,8,118],[115,-10,8,156],[0,68,230,8]];
  ROADS.forEach(([x,z,w2,d2])=>{
    const r2=new THREE.Mesh(new THREE.PlaneGeometry(w2,d2),roadMat);
    r2.rotation.x=-Math.PI/2; put(r2,x,0.02,z);
    const horiz=w2>=d2;
    [-1,1].forEach(s=>{
      const eg=new THREE.Mesh(new THREE.PlaneGeometry(horiz?w2:0.25, horiz?0.25:d2),lineMat);
      eg.rotation.x=-Math.PI/2;
      put(eg, x+(horiz?0:s*(w2/2-0.4)), 0.035, z+(horiz?s*(d2/2-0.4):0));
    });
    const nD=Math.floor((horiz?w2:d2)/8);
    for(let i2=0;i2<nD;i2++){
      const dl=new THREE.Mesh(new THREE.PlaneGeometry(horiz?3:0.22, horiz?0.22:3),lineMat);
      dl.rotation.x=-Math.PI/2;
      const off=-(horiz?w2:d2)/2+4+i2*8;
      put(dl, x+(horiz?off:0), 0.035, z+(horiz?0:off));
    }
  });
  // 横断歩道（事務所前）
  for(let i2=0;i2<6;i2++){
    const cw=new THREE.Mesh(new THREE.PlaneGeometry(0.9,6),lineMat);
    cw.rotation.x=-Math.PI/2; put(cw, -24+i2*1.8, 0.04, -60);
  }
  // ---- 緑地帯（外周植栽+生垣） ----
  const grassMat=new THREE.MeshStandardMaterial({color:0x27452e,roughness:0.95});
  [[0,-90.5,236,3.5],[0,90.5,236,3.5],[-128,0,3.5,178],[128,0,3.5,178]].forEach(([x,z,w2,d2])=>{
    const gp=new THREE.Mesh(new THREE.PlaneGeometry(w2,d2),grassMat);
    gp.rotation.x=-Math.PI/2; put(gp,x,0.018,z);
  });
  const bushMat=new THREE.MeshStandardMaterial({color:0x2f5a38,roughness:0.9});
  for(let x=-110;x<=110;x+=14){
    const bu=new THREE.Mesh(new THREE.SphereGeometry(1.1,7,5),bushMat);
    bu.scale.y=0.7; put(bu,x,0.6,-89.5);
    const bu2=bu.clone(); put(bu2,x+7,0.6,89.5);
  }
  for(let z=-80;z<=80;z+=16){
    const bu=new THREE.Mesh(new THREE.SphereGeometry(1.1,7,5),bushMat);
    bu.scale.y=0.7; put(bu,127.5,0.6,z);
  }
}

// Native metre geometry. Legacy equipment components are normalized to nominal dimensions.
function makeEquipment(it){
 const legacy=makeLegacyEquipment({...it,w:it.w*LEGACY_SCALE,d:it.d*LEGACY_SCALE,h:it.h*LEGACY_SCALE});
 legacy.updateMatrixWorld(true);
 const bounds=new THREE.Box3();legacy.traverse(o=>{if(o.isMesh){o.geometry.computeBoundingBox();const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);bounds.union(bb);}});
 const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 legacy.scale.set(it.w/Math.max(.01,size.x),it.h/Math.max(.01,size.y),it.d/Math.max(.01,size.z));
 legacy.position.set(-center.x*legacy.scale.x,-bounds.min.y*legacy.scale.y,-center.z*legacy.scale.z);
 const root=new THREE.Group();root.add(legacy);root.userData.v3Base=legacy;return root;
}
function v3Box(g,w,h,d,x,y,z,color=0x72848a){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.65,metalness:.24}));m.position.set(x,y,z);g.add(m);return m;}
function v3Beam(g,a,b,r,color=0x87989f){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),delta=vb.clone().sub(va);const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),6),new THREE.MeshStandardMaterial({color,metalness:.55,roughness:.4}));m.position.copy(va).add(vb).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());g.add(m);return m;}
function v3FloorLabel(g,text,x,z,scale=.12,color='#b8d3ce'){
 const c=document.createElement('canvas');c.width=512;c.height=128;const p=c.getContext('2d');p.font='600 46px sans-serif';p.textAlign='center';p.textBaseline='middle';p.fillStyle=color;p.fillText(text,256,64);
 const m=new THREE.Mesh(new THREE.PlaneGeometry(30*scale,7.5*scale),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(x,.025,z);g.add(m);return m;
}
function v3BuildStructure(b,ic){
 const W=ic.W,D=ic.D,H=b.h;
 const groups={};for(const k of ['frame','walls','roof','mezzanine','zones']){groups[k]=new THREE.Group();groups[k].name='v3-'+k;intGroup.add(groups[k]);}
 v3.groups=groups;v3.obstacles=[];
 const {frame,walls,roof,mezzanine,zones}=groups;
 const bays=Math.max(3,Math.ceil(D/7)),bay=D/bays;
 const column=(x,z)=>{v3Box(frame,.30,H,.30,x,H/2,z,0xadb9bd);v3Box(frame,.62,.10,.62,x,.05,z,0x66787f);v3.obstacles.push({x,z,w:.62,d:.62});};
 for(let i=0;i<=bays;i++){
  const z=-D/2+i*bay;column(-W/2+.3,z);column(W/2-.3,z);
  // Portal frame with bottom chord and alternating triangular webs.
  v3Box(frame,W-.6,.18,.15,0,H-.45,z,0xa0b1b8);
  v3Beam(frame,[-W/2+.3,H-.45,z],[0,H+1.3,z],.095);v3Beam(frame,[0,H+1.3,z],[W/2-.3,H-.45,z],.095);
  for(let j=0;j<8;j++){const x0=-W/2+.3+(W-.6)*j/8,x1=-W/2+.3+(W-.6)*(j+1)/8;const y1=H-.45+(1-Math.abs(x1)/(W/2-.3))*1.75;v3Beam(frame,[x0,H-.45,z],[x1,y1,z],.037,0x5d787f);}
 }
 for(const x of [-W*.45,-W*.25,0,W*.25,W*.45])v3Box(frame,.08,.12,D,x,H+1.3-Math.abs(x)/(W/2)*1.75,0,0x647d85);
 // Perimeter wall segments with real openings at the ends of the pedestrian aisle.
 const walkX=W*.40,doorWidth=2.0;
 for(const sign of [-1,1]){
  v3Box(walls,.16,H,D,sign*(W/2),H/2,0,0x647a82);
  const left=walkX-doorWidth/2+W/2,right=W/2-walkX-doorWidth/2;
  v3Box(walls,left,H,.16,-W/2+left/2,H/2,sign*D/2,0x768a8d);
  if(right>0)v3Box(walls,right,H,.16,W/2-right/2,H/2,sign*D/2,0x768a8d);
  v3Box(walls,doorWidth,H-2.4,.16,walkX,(H+2.4)/2,sign*D/2,0x768a8d);
  v3Box(walls,doorWidth+.16,.12,.18,walkX,2.42,sign*D/2,0xced7cf);
  const exit=makeLabel('出入口（仮）',.09,'#80e4b4');exit.position.set(walkX,2.9,sign*(D/2-.16));walls.add(exit);
  for(let i=0;i<bays;i++){
   const z=-D/2+(i+.5)*bay;const glass=v3Box(walls,.03,1.0,bay*.6,sign*(W/2-.1),Math.min(H*.55,4.5),z,0x9bc6d1);glass.material.transparent=true;glass.material.opacity=.35;
  }
 }
 const slope=Math.atan2(1.75,W/2),span=Math.hypot(W/2,1.75);
 [-1,1].forEach(sign=>{const panel=v3Box(roof,span,.10,D+.6,sign*W/4,H+.425,0,0x61747b);panel.rotation.z=-sign*slope;for(let i=0;i<bays;i++){const skylight=v3Box(roof,span*.35,.06,bay*.30,sign*W*.22,H+.65,-D/2+(i+.5)*bay,0xb8d6de);skylight.rotation.z=-sign*slope;}});
 // Suspended luminaires and cable suspension.
 for(let iz=0;iz<bays;iz++)for(const x of [-W*.25,W*.25]){
  const z=-D/2+(iz+.5)*bay,y=H-.9;const lamp=v3Box(frame,1.3,.07,.23,x,y,z,0xe3efe8);lamp.material.emissive.setHex(0xbbdfd3);lamp.material.emissiveIntensity=.45;
  [-.48,.48].forEach(off=>v3Beam(frame,[x+off,y,z],[x+off,H-.25,z],.009));
 }
 if(ic.drawing)twinStructure(b,ic,groups);
 if(['paint','varnish'].includes(b.proc)&&!ic.drawing){
  // Conceptual mezzanine at the west edge, retaining the central production area.
  const mh=Math.min(3.6,H*.35),mw=2.8,md=Math.min(12,D*.24),mx=-W/2+mw/2+.4,mz=0;
  v3Box(mezzanine,mw,.16,md,mx,mh,mz,0x829496);
  for(const z of [-md/2,md/2])for(const x of [mx-mw/2+.15,mx+mw/2-.15]){v3Box(mezzanine,.16,mh,.16,x,mh/2,z,0x536a73);v3.obstacles.push({x,z,w:.3,d:.3,layer:'mezzanine'});}
  const rail=(a,b)=>{v3Beam(mezzanine,[a[0],mh+1.1,a[1]],[b[0],mh+1.1,b[1]],.023,0xdbc251);v3Beam(mezzanine,[a[0],mh+.55,a[1]],[b[0],mh+.55,b[1]],.017,0xdbc251);const len=Math.hypot(a[0]-b[0],a[1]-b[1]);for(let t=0;t<=len;t+=1.3){const p=t/len;v3Beam(mezzanine,[a[0]+(b[0]-a[0])*p,mh,a[1]+(b[1]-a[1])*p],[a[0]+(b[0]-a[0])*p,mh+1.1,a[1]+(b[1]-a[1])*p],.021,0xdbc251);}};
  rail([mx+mw/2,-md/2],[mx+mw/2,md/2]);rail([mx-mw/2,-md/2],[mx+mw/2,-md/2]);
  const steps=Math.ceil(mh/.18),rise=mh/steps,tread=.25;
  for(let i=0;i<steps;i++)v3Box(mezzanine,1.15,.075,tread,mx,(i+1)*rise,md/2+(steps-i)*tread,0x8c9da4);
  [-.62,.62].forEach(dx=>v3Beam(mezzanine,[mx+dx,1.0,md/2+steps*tread],[mx+dx,mh+1.0,md/2],.024,0xdbc251));
  v3.obstacles.push({x:mx,z:md/2+steps*tread/2,w:1.4,d:steps*tread,layer:'mezzanine'});
  const tag=makeLabel('点検デッキ（仮）',.11,'#e8d780');tag.position.set(mx,mh+.2,0);mezzanine.add(tag);
 }
 // Painted zones follow the actual equipment group bounds.
 const families=[['原料受入',['IN','BAG','FRC','DRM'],0xa9a084],['分散',['MILL','DSP'],0x518a80],['調合・貯留',['TNK','KVT','PTK'],0x53819a],['充填',['FIL'],0xc6a965],['製品・搬出',['CAN','NST','OUT','RCK','IBC'],0x728f77]];
 families.forEach(([title,procs,color])=>{
  const items=ic.items.filter(i=>procs.includes(i.proc));if(!items.length)return;
  items.forEach(it=>{const plate=new THREE.Mesh(new THREE.PlaneGeometry(it.w+.5,it.d+.5),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.13,depthWrite:false}));plate.rotation.x=-Math.PI/2;plate.position.set(it.x,.013,it.z);zones.add(plate);});
  const it=items[Math.floor(items.length/2)];v3FloorLabel(zones,title,it.x,it.z+it.d/2+.5,.10);
 });
 if(!ic.drawing){const strip=v3Box(zones,1.5,.008,D-.9,walkX,.012,0,0x376c5b);strip.material.roughness=.95;
 for(const sign of [-1,1])v3Box(zones,.06,.012,D-.9,walkX+sign*.77,.025,0,0xcfdbc3);
 for(let z=-D/2+3;z<D/2-2;z+=6){v3FloorLabel(zones,'↑ WALK',walkX,z,.075,'#d5e8dc');}
 // Transverse markings at the two ends of the walking strip.
 for(const sign of [-1,1])for(let i=0;i<6;i++)v3Box(zones,2.1,.012,.16,walkX,.025,sign*(D/2-1.7)+i*.3-.75,0xd8dfc9);}
 const zero=makeLabel(ic.drawing?'1 unit = 1 m / '+ic.drawing.layout.scenarios[ic.drawing.scen]+' を読図':'1 unit = 1 m / 推定配置',.13,'#8dcabd');zero.position.set(0,.3,D/2+1.0);zones.add(zero);
 // Grid reference numbers at structural bays.
 for(let i=0;i<=bays;i++)v3FloorLabel(zones,String(i+1).padStart(2,'0'),-W/2+1.0,-D/2+i*bay,.06,'#a8b6bc');
 return groups;
}
function buildInteriorScene(b){
 v3ClearSection();clearGroup(intGroup);spinDiscs.length=0;hoistAnims.length=0;evAnims.length=0;craneAnims.length=0;
 const ic=interiorCtxs.get(b.id),W=ic.W,D=ic.D;
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(W+.6,D+.6),new THREE.MeshStandardMaterial({color:drawMode?0xe1e6e3:0x34494b,roughness:.92}));floor.rotation.x=-Math.PI/2;intGroup.add(floor);
 const grid=new THREE.GridHelper(Math.max(W,D),Math.round(Math.max(W,D)),drawMode?0xb2c1bb:0x46645e,drawMode?0xd2ddd5:0x3b5550);grid.position.y=.008;intGroup.add(grid);
 v3BuildStructure(b,ic);
 ic.items.forEach((it,i)=>{
  const g=makeEquipment({...it,w:it.bw??it.w,d:it.bd??it.d});g.rotation.y=-(it.rot||0)*Math.PI/2;g.position.set(it.x,0,it.z);g.userData.idx=i;g.traverse(o=>o.userData.idx=i);
  const lbl=makeLabel(it.name,.13);lbl.position.y=it.h+.65;lbl.userData.precisionLabel=true;lbl.visible=precisionState.labels;g.add(lbl);intGroup.add(g);it.mesh=g;
 });
 for(const it of ic.items.filter(i=>['DSP','FIL'].includes(i.proc)).slice(0,3)){const w=makeWorker();w.scale.setScalar(.54);w.position.set(it.x+it.w/2+.5,0,it.z);intGroup.add(w);}
 applyShadows(intGroup);v3ApplyLayers();updateMEPScene();
}

function buildSnapGrid(){
  if(snapGrid){ scene.remove(snapGrid); snapGrid.geometry?.dispose(); snapGrid.material?.dispose(); snapGrid=null; }
  const size=Math.max(ctx.W,ctx.D);
  snapGrid=new THREE.GridHelper(size, Math.round(size/ctx.snap), 0x58a6ff, 0x1f6feb);
  snapGrid.material.opacity=0.3; snapGrid.material.transparent=true;
  snapGrid.position.y=0.04; snapGrid.visible=moveMode; scene.add(snapGrid);
}

// ================= 経路描画 =================
let renderRoutes3D=[];
let routeTubes=[];
function renderRoutes(){
  clearGroup(routeGroup);
  renderRoutes3D=[];
  routeTubes=[];
  const y = ctx.kind==="site" ? 1.6 : 0.12;
  const base = ctx.kind==="site" ? 0.5 : 0.035;
  ctx.routes.forEach(r=>{
    if(r.blocked||r.pts.length<2){routeTubes.push(null);return;}
    const v=r.pts.map(p=>new THREE.Vector3(p.x,y,p.z));
    const curve=ctx.kind==="interior"?v4Curve(v):new THREE.CatmullRomCurve3(v,false,"centripetal");
    const tube=new THREE.Mesh(
      new THREE.TubeGeometry(curve, Math.max(8,v.length*2), base + r.reps*(ctx.kind==="site"?0.04:0.005), 8, false),
      new THREE.MeshStandardMaterial({color:r.color, emissive:r.color, emissiveIntensity:0.35, roughness:0.4}));
    routeGroup.add(tube);
    routeTubes.push(tube);
    renderRoutes3D.push({curve, len:r.modelLen??r.len, reps:r.reps, fk:r.fk, tk:r.tk});
  });
}

// ================= 混雑 =================
let congestionMode=false;
function renderCongestion(){
  clearGroup(congGroup);
  if(!congestionMode) return;
  const load=new Map();
  ctx.routes.forEach(r=>{
    r.pts.forEach(p=>{
      const c=clampC(ctx,wToC(ctx,p.x)), rr=clampR(ctx,wToR(ctx,p.z));
      const k=c+","+rr; load.set(k,(load.get(k)||0)+r.reps);
    });
  });
  ctx.cong.forEach((v,k)=>load.set(k,(load.get(k)||0)+v));
  let max=1; load.forEach(v=>max=Math.max(max,v));
  load.forEach((v,k)=>{
    const [c,r]=k.split(",").map(Number);
    const t=v/max;
    const col=new THREE.Color().setHSL((1-t)*0.33,0.9,0.5);
    const tile=new THREE.Mesh(new THREE.PlaneGeometry(ctx.cell,ctx.cell),
      new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.22+t*0.5}));
    tile.rotation.x=-Math.PI/2; tile.position.set(cToW(ctx,c),0.06,rToW(ctx,r));
    congGroup.add(tile);
  });
}

// ================= 稼働再生（作業者／フォークリフト） =================
let movers=[]; let playing=false;
function makeWorker(){
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.65,2.4,10),
    new THREE.MeshStandardMaterial({color:0xffd479,roughness:0.6})); body.position.y=1.2; g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.55,12,10),
    new THREE.MeshStandardMaterial({color:0xffe0a3})); head.position.y=2.7; g.add(head);
  return g;
}
function makeForklift(cargo){
  // トヨタGENEO風（アトミクス構内車のオレンジ）
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(2.4,1.5,3.4),
    new THREE.MeshStandardMaterial({color:0xe8731a,roughness:0.5})); body.position.y=1.15; g.add(body);
  const counter=new THREE.Mesh(new THREE.BoxGeometry(2.2,1.0,1.0),
    new THREE.MeshStandardMaterial({color:0x2b313b,roughness:0.7})); counter.position.set(0,1.0,-1.9); g.add(counter);
  const seat=new THREE.Mesh(new THREE.BoxGeometry(1.0,0.7,0.9),
    new THREE.MeshStandardMaterial({color:0x24262b})); seat.position.set(0,2.15,-0.6); g.add(seat);
  // ヘッドガード（4本柱+屋根）
  const gm=new THREE.MeshStandardMaterial({color:0x30343a,metalness:0.4,roughness:0.5});
  [[-0.9,0.6],[0.9,0.6],[-0.9,-1.2],[0.9,-1.2]].forEach(([sx,sz])=>{
    const p=new THREE.Mesh(new THREE.BoxGeometry(0.12,1.9,0.12),gm); p.position.set(sx,2.8,sz); g.add(p); });
  const roof=new THREE.Mesh(new THREE.BoxGeometry(2.0,0.1,2.1),gm); roof.position.set(0,3.8,-0.3); g.add(roof);
  const mast=new THREE.Mesh(new THREE.BoxGeometry(0.28,3.6,0.28),gm);
  const mast2=mast.clone();
  mast.position.set(-0.65,1.8,1.95); mast2.position.set(0.65,1.8,1.95); g.add(mast,mast2);
  const liftGrp=new THREE.Group(); g.add(liftGrp); g.userData.lift=liftGrp;
  const fork=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.14,1.5),
    new THREE.MeshStandardMaterial({color:0x9aa3ad,metalness:0.6})); fork.position.set(0,0.3,2.6); liftGrp.add(fork);
  g.userData.wheels=[];
  const rimM=new THREE.MeshStandardMaterial({color:0x9aa3ad,metalness:0.5,roughness:0.45});
  [[-1,-1.3],[1,-1.3],[-1,1.0],[1,1.0]].forEach(([sx,sz])=>{
    const w=new THREE.Mesh(new THREE.CylinderGeometry(0.48,0.48,0.4,12),
      new THREE.MeshStandardMaterial({color:0x1c2129}));
    w.rotation.z=Math.PI/2; w.position.set(sx*1.1,0.48,sz); g.add(w);
    const rim=new THREE.Mesh(new THREE.CylinderGeometry(0.27,0.27,0.42,8),rimM); w.add(rim);
    g.userData.wheels.push(w);
  });
  // 回転灯（稼働中に点滅）
  const beacon=new THREE.Mesh(new THREE.SphereGeometry(0.15,8,6),
    new THREE.MeshStandardMaterial({color:0xffa726,emissive:0xff8f00,emissiveIntensity:0.5}));
  beacon.position.set(0.7,3.95,-0.3); g.add(beacon); g.userData.beacon=beacon;
  if(cargo){
    const cg=new THREE.Group(); liftGrp.add(cg); g.userData.cargo=cg;
    const pal=new THREE.Mesh(new THREE.BoxGeometry(1.6,0.16,1.5),
      new THREE.MeshStandardMaterial({color:0x8a6a3a,roughness:0.95}));
    pal.position.set(0,0.48,2.6); cg.add(pal);
    const load=new THREE.Mesh(new THREE.BoxGeometry(1.5,1.05,1.4), canBlockMat("silver"));
    load.position.set(0,1.1,2.6); cg.add(load);
  }
  return g;
}
function makeTruck(label){
  const g=new THREE.Group();
  const chassis=new THREE.Mesh(new THREE.BoxGeometry(2.4,0.5,9.0),
    new THREE.MeshStandardMaterial({color:0x2b313b})); chassis.position.set(0,0.75,0); g.add(chassis);
  const cab=new THREE.Mesh(new THREE.BoxGeometry(2.3,1.9,1.8),
    new THREE.MeshStandardMaterial({color:0x2f6db3,roughness:0.4,metalness:0.3})); cab.position.set(0,1.9,3.4); g.add(cab);
  const win=new THREE.Mesh(new THREE.BoxGeometry(2.1,0.7,0.1),
    new THREE.MeshStandardMaterial({color:0x1c2733,roughness:0.2,metalness:0.6})); win.position.set(0,2.35,4.31); g.add(win);
  const box=new THREE.Mesh(new THREE.BoxGeometry(2.5,2.6,6.4),
    new THREE.MeshStandardMaterial({color:0xe8eaec,roughness:0.6})); box.position.set(0,2.35,-0.9); g.add(box);
  const band=new THREE.Mesh(new THREE.BoxGeometry(2.52,0.5,6.42),
    new THREE.MeshStandardMaterial({color:0x3fae5a})); band.position.set(0,1.55,-0.9); g.add(band);
  g.userData.wheels=[];
  const rimT=new THREE.MeshStandardMaterial({color:0xb6bcc2,metalness:0.5,roughness:0.4});
  [[-1.2,2.9],[1.2,2.9],[-1.2,-2.2],[1.2,-2.2],[-1.2,-3.4],[1.2,-3.4]].forEach(([sx,sz])=>{
    const w=new THREE.Mesh(new THREE.CylinderGeometry(0.52,0.52,0.35,10),
      new THREE.MeshStandardMaterial({color:0x14171c}));
    w.rotation.z=Math.PI/2; w.position.set(sx,0.52,sz); g.add(w);
    const rim=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,0.37,8),rimT); w.add(rim);
    g.userData.wheels.push(w);
  });
  const lbl=makeLabel(label,0.5,"#9fdcff"); lbl.position.set(0,4.4,0); g.add(lbl);
  return g;
}
function rebuildMovers(){
  movers.forEach(m=>{ scene.remove(m.mesh); m.mesh.traverse(o=>{o.geometry?.dispose();o.material?.dispose();}); });
  movers=[];
  const isSite = ctx.kind==="site";
  const LOGI=new Set(["IN","OUT","CAN","NST","DRM","BAG","FRC","IBC","RCK"]);
  renderRoutes3D.forEach(r=>{
    let g, speed;
    if(isSite){ g=makeForklift(true); speed=12; }
    else if(LOGI.has(r.fk)||LOGI.has(r.tk)){
      g=makeForklift(true); g.scale.setScalar(0.55); speed=3;
    } else { g=makeWorker(); g.scale.setScalar(0.54); speed=1.4; }
    if(ctx.kind==="interior"&&g.userData.lift){g.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());g.scale.x*=v4Ensure(ctx).vehicle.width/Math.max(.01,bounds.x);}
    g.visible=false; applyShadows(g); scene.add(g);
    movers.push({ mesh:g, curve:r.curve, len:r.len, t:Math.random(), speed, reps:r.reps, phase:Math.random()*6,
      dir:1, state:"go", dwell:0, toggled:false,
      dwellDur: g.userData.lift? 1.7 : 0.9 });
  });
  // 搬入トラック便（正門⇔倉庫バース、A*で建屋回避）
  if(isSite){
    const gate=siteCtx.items.find(i=>i.id==="gate");
    [["whGen","茨城便",(t)=>[t.x, t.z-t.d/2-4]],
     ["whNew","千葉便",(t)=>[t.x+t.w/2+4, t.z]]].forEach(([tid,label,dockOf],ti)=>{
      const tgt=siteCtx.items.find(i=>i.id===tid);
      if(!gate||!tgt) return;
      const [dx2,dz2]=dockOf(tgt);
      const path=astar(siteCtx, gate.x, gate.z+6, dx2, dz2);
      if(!path||path.length<2) return;
      const curve=new THREE.CatmullRomCurve3(
        path.map(([x,z])=>new THREE.Vector3(x,1,z)), false, "centripetal");
      const tk2=makeTruck(label); tk2.visible=false; applyShadows(tk2); scene.add(tk2);
      movers.push({mesh:tk2, curve, len:curve.getLength(), t:0.15+ti*0.4, speed:15, reps:4,
        dir:1, state:"go", dwell:0, toggled:false, dwellDur:4.5});
    });
  }
}
const _dum=new THREE.Object3D();
function updateMovers(dt){
  movers.forEach(m=>{
    m.mesh.visible=playing;
    if(!playing) return;
    const lift=m.mesh.userData.lift, cargo=m.mesh.userData.cargo;
    if(m.state==="dwell"){
      // 端点で一旦停止して荷役（フォーク昇降+荷の積み下ろし）
      m.dwell+=dt;
      const ph=Math.min(1, m.dwell/m.dwellDur);
      if(lift) lift.position.y = -0.24*(ph<0.5? ph*2 : (1-ph)*2);
      if(cargo && ph>=0.5 && !m.toggled){ cargo.visible=(m.dir===-1); m.toggled=true; }
      if(m.dwell>=m.dwellDur){
        m.state="go"; m.dir*=-1; m.dwell=0; m.toggled=false;
        if(lift) lift.position.y=0;
      }
      return;
    }
    m.t += m.dir*(m.speed*dt)/Math.max(m.len,1);
    if(m.t>=1){ m.t=1; m.state="dwell"; m.dwell=0; }
    else if(m.t<=0){ m.t=0; m.state="dwell"; m.dwell=0; }
    const tc=Math.max(0.001,Math.min(0.999,m.t));
    const p=m.curve.getPointAt(tc);
    const p2=m.curve.getPointAt(Math.max(0.0,Math.min(1.0,tc+m.dir*0.012)));
    m.phase=(m.phase||0)+dt*9;
    const whs=m.mesh.userData.wheels;
    const bob = whs? 0 : 0.07*Math.abs(Math.sin(m.phase));          // 作業者は歩行バウンド
    m.mesh.position.set(p.x,bob,p.z);
    if(p2.distanceToSquared(p)>1e-6){                                 // 進行方向をスムーズに追従
      _dum.position.copy(m.mesh.position); _dum.lookAt(p2.x,bob,p2.z);
      m.mesh.quaternion.slerp(_dum.quaternion, 0.2);
    }
    if(whs){ const ang=(m.speed*dt)/0.5; for(const w of whs) w.rotateY(-ang); }   // 車輪回転
    const bc=m.mesh.userData.beacon;
    if(bc) bc.material.emissiveIntensity=0.25+1.1*Math.max(0,Math.sin(m.phase*1.3));   // 回転灯
    const c=clampC(ctx,wToC(ctx,p.x)), r=clampR(ctx,wToR(ctx,p.z));
    const k=c+","+r;
    ctx.cong.set(k,(ctx.cong.get(k)||0)+dt*m.reps*0.2);
  });
  if(playing && congestionMode && Math.random()<0.04) renderCongestion();
}

// ================= 指標UI・全社集計 =================
function totalHours(){
  let h = siteCtx.m.hours||0;
  interiorCtxs.forEach(c=>{ h += c.m.hours||0; });
  return h;
}
let globalBaseHours = null;
function updateStatsUI(){
  const m=ctx.m;
  document.getElementById("statsTitle").textContent = "評価指標（SLP）— " + ctx.label;
  document.getElementById("mDist").textContent=m.total.toLocaleString();
  document.getElementById("mCross").textContent=m.crossings;
  document.getElementById("mCross").closest(".row").firstElementChild.textContent=ctx.kind==="interior"?"共有通路セル数":"動線交差";
  document.getElementById("mDist").closest(".row").firstElementChild.textContent=ctx.kind==="interior"?"搬送距離 / 日（成立分）":"搬送距離 / 日";
  document.getElementById("mLong").textContent=m.longest.toLocaleString();
  setDelta("dDist", m.total, ctx.baseline?.total);
  setDelta("dCross", m.crossings, ctx.baseline?.crossings);
  setDelta("dLong", m.longest, ctx.baseline?.longest);
  const th=totalHours();
  document.getElementById("mHours").textContent=th.toFixed(1);
  setDelta("dHours", +th.toFixed(1), globalBaseHours!=null? +globalBaseHours.toFixed(1):null);
  // 凡例
  const seen=new Map();
  ctx.items.forEach(it=>{ const key=ctx.kind==="site"? TYPE_NAME[it.proc]||it.proc : it.name;
    if(!seen.has(key)) seen.set(key, it.color); });
  document.getElementById("legend").innerHTML=[...seen.entries()]
    .map(([n,c])=>`<span class="swatch" style="background:#${c.toString(16).padStart(6,'0')}"></span>${n}`).join("　");
}
function setDelta(id, cur, baseVal){
  const el=document.getElementById(id);
  if(baseVal==null){ el.textContent=""; return; }
  const diff=+(cur-baseVal).toFixed(1);
  if(diff===0){ el.textContent="±0"; el.className="delta"; return; }
  const pct=baseVal? Math.round(diff/baseVal*100):0;
  el.textContent=(diff>0?"+":"")+diff+(baseVal?` (${pct>0?'+':''}${pct}%)`:"");
  el.className="delta "+(diff<0?"up":"down");
}

function recomputeActive(){
  shadowDirty=true;
  computeData(ctx);
  renderRoutes();
  rebuildMovers();
  renderCongestion();
  updateStatsUI();
  updateMEPScene();
  renderAnalysis();
  refreshPrecision();
  v3Sync();
  v4Sync();
  exSync();
  twinSync();
}

// ================= ビュー切替 =================
function enterBuilding(b){
  v3StopWalk();v3ClearSection();
  const ic=interiorCtxs.get(b.id);
  if(!ic){ toast(b.name+" の内部レイアウトは未定義です（次段で追加可能）"); return; }
  selected=null; updateSelUI();
  if(precisionState.tab==='exterior')pSetTab('space');
  currentBuilding=b;
  ctx=ic;
  siteGroup.visible=false; intGroup.visible=true;
  buildInteriorScene(b);
  buildSnapGrid();
  fitShadow();
  removeGhost();
  camGoal.target.set(0,2,0); camGoal.dist=Math.max(ic.W,ic.D)*0.85; camGoal.pitch=0.95; camGoal.yaw=0.4;
  document.getElementById("crumb").innerHTML="敷地全体 › <b>"+b.name+"</b>";
  document.getElementById("backBtn").style.display="";
  document.getElementById("optBtn").disabled=false;
  document.getElementById("playLbl").textContent="作業者が工程間を歩行";
  clearClashes(); hideMepProp();
  showPhotos(b.id);
  recomputeActive();
  toast(b.name+" 内部 — 設備を動かして工程動線を最適化"+(bimMode?"（BIM表示中: 天井MEPも表示）":""));
}
function exitBuilding(){
  v3StopWalk();v3ClearSection();
  select(null);
  currentBuilding=null;
  ctx=siteCtx;
  pSetTab('exterior');
  intGroup.visible=false; siteGroup.visible=true;
  clearGroup(intGroup);
  spinDiscs.length=0; hoistAnims.length=0; evAnims.length=0; craneAnims.length=0;
  buildSnapGrid();
  fitShadow();
  removeGhost();
  camGoal.target.set(0,4,0); camGoal.dist=SITE_W*1.05; camGoal.pitch=0.95; camGoal.yaw=0.2;
  document.getElementById("crumb").textContent="敷地全体";
  document.getElementById("backBtn").style.display="none";
  document.getElementById("optBtn").disabled=true;
  document.getElementById("playLbl").textContent="フォークリフトが建屋間を搬送";
  clearClashes(); hideMepProp();
  document.getElementById("photoPanel").style.display="none";
  buildSiteScene();   // BIM切替が内部で行われた場合も外観状態を同期
  recomputeActive();
}

// ================= カメラ =================
const camState={ yaw:0.2, pitch:1.42, dist:SITE_W*1.05, target:new THREE.Vector3(0,4,0) };
const camGoal={ yaw:0.2, pitch:1.42, dist:SITE_W*1.05, target:new THREE.Vector3(0,4,0) };
function setCam(name){
  if(v3.walk)v3StopWalk();
  const base = ctx.kind==="site" ? SITE_W : Math.max(ctx.W,ctx.D);
  if(name==="top"){ camGoal.pitch=0.18; camGoal.dist=base*1.1; }
  if(name==="iso"){ camGoal.pitch=0.95; camGoal.dist=base*1.0; }
  if(name==="eye"){ camGoal.pitch=1.42; camGoal.dist=base*0.42; }
  document.querySelectorAll("#nav [data-cam]").forEach(b=>b.classList.toggle("on", b.dataset.cam===name));
}
function applyCam(){
  if(v3.walk){v3ApplyWalk();return;}
  camState.yaw+=(camGoal.yaw-camState.yaw)*0.12;
  camState.pitch+=(camGoal.pitch-camState.pitch)*0.12;
  camState.dist+=(camGoal.dist-camState.dist)*0.12;
  camState.target.lerp(camGoal.target,0.12);
  const ph=Math.max(0.05,Math.min(1.55,camState.pitch));
  const x=camState.target.x+camState.dist*Math.sin(ph)*Math.cos(camState.yaw);
  const z=camState.target.z+camState.dist*Math.sin(ph)*Math.sin(camState.yaw);
  const y=camState.target.y+camState.dist*Math.cos(ph);
  camera.position.set(x,y,z); camera.lookAt(camState.target);
}

// ================= 入力 =================
const ray=new THREE.Raycaster(); const ndc=new THREE.Vector2();
let dragging=null, orbiting=false, panning=false, lastX=0,lastY=0, moveMode=false;
// ---- 設備の個別選択・編集 ----
let selected=null;
const selRing=new THREE.Mesh(
  new THREE.RingGeometry(0.9,1.0,48),
  new THREE.MeshBasicMaterial({color:0x58a6ff, transparent:true, opacity:0.85, side:THREE.DoubleSide}));
selRing.rotation.x=-Math.PI/2; selRing.position.y=0.06; selRing.visible=false; scene.add(selRing);
function updateSelUI(){
  const p=document.getElementById("selPanel");
  if(!selected){ p.style.display="none"; selRing.visible=false; return; }
  p.style.display="flex";
  document.getElementById("selName").textContent=selected.name;
  document.getElementById("selSize").textContent=(selected.w/INT_SCALE).toFixed(2)+" × "+(selected.d/INT_SCALE).toFixed(2)+" m（推定）"+(selected.fixed?"（固定・開口部）":"");
  document.getElementById("rotBtn").disabled=!!selected.fixed;
  document.getElementById("delBtn").disabled=!!selected.fixed;
  const r=Math.max(selected.w,selected.d)*0.72;
  selRing.scale.set(r,r,1);
  selRing.position.set(selected.x,0.06,selected.z);
  selRing.visible=true;
}
function select(it){ selected=it; updateSelUI(); precisionSelectionChanged(); twinSync(); }
function clampItem(it){
  it.x=Math.max(-ctx.W/2+it.w/2, Math.min(ctx.W/2-it.w/2, it.x));
  it.z=Math.max(-ctx.D/2+it.d/2, Math.min(ctx.D/2-it.d/2, it.z));
}
function refreshInterior(keepSel){
  if(ctx.kind!=="interior") return;
  const keep=keepSel?selected:null;
  buildInteriorScene(currentBuilding);
  selected = keep && ctx.items.includes(keep) ? keep : null;
  updateSelUI();
  recomputeActive();
}
function rotateSelected(){
  if(!selected || selected.fixed || ctx.kind!=="interior") return;
  selected.rot=((selected.rot||0)+1)%4;
  const odd=selected.rot%2===1;
  selected.w=odd?selected.bd:selected.bw;
  selected.d=odd?selected.bw:selected.bd;
  clampItem(selected);
  refreshInterior(true);
  toast(selected.name+" を回転（"+(selected.rot*90)+"°）");
}
function duplicateSelected(){
  if(!selected || ctx.kind!=="interior") return;
  const s=selected;
  const n=ctx.items.filter(i=>i.proc===s.proc).length+1;
  const base=s.name.replace(/・\d+$/,"");
  const it={ proc:s.proc, name:base+"・"+n, x:s.x+ctx.snap*2, z:s.z+ctx.snap*2,
             w:s.w, d:s.d, h:s.h, bw:s.bw??s.w, bd:s.bd??s.d, rot:s.rot||0,
             color:s.color, fixed:false,
             variant:s.variant||null, num:null, kv:s.kv||null, noOcc:!!s.noOcc };
  clampItem.call(null, it); // clampはctx参照
  ctx.items.push(it);
  selected=it;
  refreshInterior(true);
  toast(it.name+" を追加 — 同一工程は台数で分担され動線の重心が変わります");
}
function deleteSelected(){
  if(!selected || selected.fixed || ctx.kind!=="interior") return;
  const s=selected;
  const usedInFlow=ctx.flows.some(([a,b])=>a===s.proc||b===s.proc);
  const count=ctx.items.filter(i=>i.proc===s.proc).length;
  if(usedInFlow && count<=1){ toast("「"+s.name+"」は工程フローで使用中の最後の1台のため削除できません"); return; }
  ctx.items.splice(ctx.items.indexOf(s),1);
  selected=null;
  refreshInterior(false);
  toast(s.name+" を削除しました");
}
document.getElementById("rotBtn").onclick=rotateSelected;
document.getElementById("dupBtn").onclick=duplicateSelected;
document.getElementById("delBtn").onclick=deleteSelected;
document.getElementById("selCloseBtn").onclick=()=>select(null);
addEventListener("keydown",(e)=>{
  if(["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName)||e.target.isContentEditable) return;
  if(ctx.kind!=="interior" || !selected) return;
  if(e.key==="r"||e.key==="R"){ rotateSelected(); e.preventDefault(); }
  else if(e.key==="Delete"||e.key==="Backspace"){ deleteSelected(); e.preventDefault(); }
  else if(e.key==="Escape"){ select(null); }
  else if(e.key.startsWith("Arrow") && !selected.fixed){
    if(e.key==="ArrowLeft") selected.x-=ctx.snap;
    if(e.key==="ArrowRight") selected.x+=ctx.snap;
    if(e.key==="ArrowUp") selected.z-=ctx.snap;
    if(e.key==="ArrowDown") selected.z+=ctx.snap;
    clampItem(selected);
    selected.mesh?.position.set(selected.x,0,selected.z);
    updateSelUI(); recomputeActive(); e.preventDefault();
  }
});
function toNdc(e){ ndc.set((e.clientX/innerWidth)*2-1, -(e.clientY/innerHeight)*2+1); }
function activeGroup(){ return ctx.kind==="site" ? siteGroup : intGroup; }
function pickItem(e){if(window.__pdSpatialActive||window.__simActive)return null;
  toNdc(e); ray.setFromCamera(ndc,camera);
  const hits=ray.intersectObjects(activeGroup().children, true);
  for(const h of hits){
    const idx=h.object.userData.idx;
    if(idx==null) continue;
    const it=ctx.items[idx];
    if(it) return it;
  }
  return null;
}

// ================= ホバー表示（ハイライト枠 + ツールチップ） =================
const hoverBox=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1)),
  new THREE.LineBasicMaterial({color:0xffd166, transparent:true, opacity:0.95, depthTest:false}));
hoverBox.visible=false; hoverBox.renderOrder=5; scene.add(hoverBox);
const tipEl=document.getElementById("tip");
let hovered=null, hoverMep=null, lastHoverT=0;
function flowsOf(it){
  let inn=0, out=0;
  const key= ctx.kind==="site"? it.id : it.proc;
  ctx.flows.forEach(([a,b,r])=>{ if(a===key) out+=r; if(b===key) inn+=r; });
  return {inn,out};
}
function moveTip(e){
  if(!e) return;
  const pad=14, w=tipEl.offsetWidth, h=tipEl.offsetHeight;
  let x=e.clientX+pad, y=e.clientY+pad;
  if(x+w>innerWidth-8) x=e.clientX-w-pad;
  if(y+h>innerHeight-8) y=e.clientY-h-pad;
  tipEl.style.left=x+"px"; tipEl.style.top=y+"px";
}
function setHover(it, mep, e){
  hovered=it; hoverMep=mep;
  if(it){
    const h=Math.max(it.h,0.6);
    hoverBox.scale.set(it.w+0.6, h+0.3, it.d+0.6);
    hoverBox.position.set(it.x, h/2+0.1, it.z);
    hoverBox.visible=true;
    const f=flowsOf(it);
    if(ctx.kind==="site"){
      tipEl.innerHTML='<b>'+it.name+'</b><div class="sub"><span class="tag">'+(TYPE_NAME[it.proc]||it.proc)+'</span>'
        +it.w.toFixed(0)+'×'+it.d.toFixed(0)+' m ・ 高さ '+it.h.toFixed(0)+' m<br>物流 入 '+f.inn+' 便/日 ・ 出 '+f.out+' 便/日'
        +(it.enter? '<br>ダブルクリックで内部へ' : '')+(moveMode&&!it.fixed? '<br>ドラッグで移動（5m吸着）' : '')+'</div>';
    } else {
      tipEl.innerHTML='<b>'+it.name+'</b><div class="sub"><span class="tag">'+(PROC_JP[it.proc]||it.proc)+'</span>'
        +(it.w/INT_SCALE).toFixed(2)+'×'+(it.d/INT_SCALE).toFixed(2)+' m（平面・推定） / 高さ (m) '+it.h.toFixed(1)+'<br>工程動線 入 '+f.inn+' ・ 出 '+f.out+' 便/日'
        +(it.fixed? '<br>固定（開口部・昇降機）' : '<br>クリックで選択 ・ ドラッグで移動 ・ R 回転')+'</div>';
    }
    renderer.domElement.style.cursor = ((ctx.kind==="interior"&&!it.fixed)||(moveMode&&!it.fixed)||it.enter)? "pointer" : "default";
  } else if(mep){
    hoverBox.visible=false;
    const sc=SYSTEMS[mep.sys].color.toString(16).padStart(6,"0");
    tipEl.innerHTML='<b><span class="swatch" style="background:#'+sc+'"></span>'+mep.id+'</b><div class="sub">'
      +SYSTEMS[mep.sys].name+' ・ '+mep.kind+'<br>'+mep.size+' ・ 延長 '+mep.len.toFixed(1)+' m ・ '+mep.bName+'<br>クリックで属性パネル</div>';
    renderer.domElement.style.cursor="pointer";
  } else {
    hoverBox.visible=false; tipEl.style.display="none"; renderer.domElement.style.cursor=""; return;
  }
  tipEl.style.display="block";
  moveTip(e);
}
renderer.domElement.addEventListener("pointermove",(e)=>{
  if(dragging||orbiting||panning){ if(tipEl.style.display==="block") setHover(null,null,null); return; }
  const now=performance.now();
  if(now-lastHoverT<70){ if(tipEl.style.display==="block") moveTip(e); return; }
  lastHoverT=now;
  const it=pickItem(e);
  let mep=null;
  if(!it && bimMode && mepGroup.visible){ const mh=pickMep(e); mep=mh? mh.el : null; }
  if(it!==hovered || mep!==hoverMep) setHover(it,mep,e); else moveTip(e);
});
renderer.domElement.addEventListener("pointerleave",()=>setHover(null,null,null));

renderer.domElement.addEventListener("pointerdown",(e)=>{
  lastX=e.clientX; lastY=e.clientY;
  setHover(null,null,null);
  if(e.button===0 && autoOrbit && !tourTimer){ autoOrbit=false; }
  if(e.button===0){
    const it=pickItem(e);
    if(ctx.kind==="interior"){
      select(it||null);
      if(it && !it.fixed){ dragging=it; return; }
    } else if(moveMode && it && !it.fixed){ dragging=it; return; }
    if(bimMode && (ctx.kind==="site" ? !moveMode : !it)){
      const mh=pickMep(e);
      if(mh) showMepProp(mh.el); else hideMepProp();
    }
  }
  if(e.button===0) orbiting=true;
  if(e.button===2) panning=true;
});
addEventListener("pointermove",(e)=>{
  if(dragging){
    toNdc(e); ray.setFromCamera(ndc,camera);
    const hit=ray.intersectObject(pickFloor)[0];
    if(hit){
      let x=snapTo(hit.point.x, ctx.snap), z=snapTo(hit.point.z, ctx.snap);
      x=Math.max(-ctx.W/2+dragging.w/2, Math.min(ctx.W/2-dragging.w/2, x));
      z=Math.max(-ctx.D/2+dragging.d/2, Math.min(ctx.D/2-dragging.d/2, z));
      dragging.x=x; dragging.z=z; shadowDirty=true;
      dragging.mesh?.position.set(x,0,z);
      if(bimMode && ctx.kind==="site") mepBGroups.get(dragging.id)?.position.set(x,0,z);
      if(dragging===selected){ selRing.position.set(x,0.06,z); }
    }
    return;
  }
  const dx=e.clientX-lastX, dy=e.clientY-lastY; lastX=e.clientX; lastY=e.clientY;
  if(orbiting){ camGoal.yaw-=dx*0.005; camGoal.pitch=Math.max(0.05,Math.min(1.55,camGoal.pitch-dy*0.005)); camState.yaw=camGoal.yaw; camState.pitch=camGoal.pitch; }
  else if(panning){
    const s=camState.dist*0.0016;
    const right=new THREE.Vector3(Math.cos(camState.yaw+Math.PI/2),0,Math.sin(camState.yaw+Math.PI/2));
    const fwd=new THREE.Vector3(Math.cos(camState.yaw),0,Math.sin(camState.yaw));
    camGoal.target.addScaledVector(right,-dx*s); camGoal.target.addScaledVector(fwd,-dy*s);
    camState.target.copy(camGoal.target);
  }
});
addEventListener("pointerup",()=>{
  if(dragging){ dragging=null; recomputeActive(); }
  orbiting=false; panning=false;
});
renderer.domElement.addEventListener("contextmenu",e=>e.preventDefault());
renderer.domElement.addEventListener("wheel",(e)=>{
  e.preventDefault();
  const base = window.__simActive ? window.__simWheelBase : ctx.kind==="site" ? SITE_W : Math.max(ctx.W,ctx.D);
  camGoal.dist=Math.max(base*0.15, Math.min(base*3.0, camGoal.dist*(1+Math.sign(e.deltaY)*0.08)));
},{passive:false});
renderer.domElement.addEventListener("dblclick",(e)=>{
  if(ctx.kind!=="site") return;
  const it=pickItem(e);
  if(it && it.enter) enterBuilding(it);
  else if(it) toast(it.name+" の内部レイアウトは未定義です");
});

// ================= ゴースト =================
function removeGhost(){
  if(ghostGroup){ scene.remove(ghostGroup); ghostGroup.traverse(o=>{o.geometry?.dispose();o.material?.dispose();}); ghostGroup=null; }
  document.getElementById("ghostBtn").classList.remove("on");
}
function toggleGhost(){
  if(ghostGroup){ removeGhost(); return; }
  if(!ctx.baseline){ toast("先に「基準を記録」を押してください"); return; }
  ghostGroup=new THREE.Group();
  ctx.baseline.positions.forEach((p,i)=>{
    const it=ctx.items[i]; if(!it) return;
    const wire=new THREE.Mesh(new THREE.BoxGeometry(it.w, Math.max(it.h,1), it.d),
      new THREE.MeshBasicMaterial({color:0x58a6ff, wireframe:true, transparent:true, opacity:0.5}));
    wire.position.set(p.x, Math.max(it.h,1)/2, p.z);
    ghostGroup.add(wire);
  });
  scene.add(ghostGroup);
  document.getElementById("ghostBtn").classList.add("on");
}

// ================= 自動最適化 β（建屋内・山登り法） =================
let optimizing=false;
async function optimize(){
  if(ctx.kind!=="interior" || optimizing) return;
  optimizing=true;
  const btn=document.getElementById("optBtn");
  if(!ctx.baseline){
    ctx.baseline={ ...ctx.m, positions:ctx.items.map(it=>({x:it.x,z:it.z})) };
    if(globalBaseHours==null) globalBaseHours=totalHours();
  }
  const movable=ctx.items.filter(it=>!it.fixed);
  const overlaps=(it,x,z)=> ctx.items.some(o=> o!==it &&
    Math.abs(x-o.x) < (it.w+o.w)/2+2 && Math.abs(z-o.z) < (it.d+o.d)/2+2 );
  computeData(ctx);
  let best=ctx.m.objective??ctx.m.total;
  const start=ctx.m.total;
  const N=48;
  for(let i=0;i<N;i++){
    const it=movable[Math.floor(Math.random()*movable.length)];
    const ox=it.x, oz=it.z;
    // 近傍 or ランダム位置
    let x,z;
    if(Math.random()<0.6){
      x=snapTo(ox+(Math.random()*2-1)*ctx.snap*4, ctx.snap);
      z=snapTo(oz+(Math.random()*2-1)*ctx.snap*4, ctx.snap);
    } else {
      x=snapTo((Math.random()-0.5)*(ctx.W-it.w), ctx.snap);
      z=snapTo((Math.random()-0.5)*(ctx.D-it.d), ctx.snap);
    }
    x=Math.max(-ctx.W/2+it.w/2, Math.min(ctx.W/2-it.w/2, x));
    z=Math.max(-ctx.D/2+it.d/2, Math.min(ctx.D/2-it.d/2, z));
    if(overlaps(it,x,z)){ continue; }
    it.x=x; it.z=z;
    computeData(ctx);
    if((ctx.m.objective??ctx.m.total) < best - 0.5){
      best=ctx.m.objective??ctx.m.total;
      it.mesh?.position.set(x,0,z);
    } else {
      it.x=ox; it.z=oz;
    }
    if(i%20===0){
      btn.textContent=`最適化中… ${Math.round(i/N*100)}%`;
      await new Promise(r=>requestAnimationFrame(r));
    }
  }
  computeData(ctx);
  recomputeActive();
  btn.textContent="自動最適化 β";
  best=ctx.m.total;
  const imp=start>0 ? Math.round((start-best)/start*100) : 0;
  toast(imp>0 ? `最適化完了: 搬送距離 −${imp}%（${Math.round(start).toLocaleString()}→${Math.round(best).toLocaleString()} m/日）`
              : "現配置は既に良好です（有意な改善なし）");
  optimizing=false;
}

// ================= 敷地スケール変更 =================
document.getElementById("sw").onchange=(e)=>{
  const nw=Math.max(80,Math.min(600,+e.target.value||260));
  const k=nw/SITE_W;
  SITE_W=nw; SITE_D=Math.round(SITE_D*k);
  siteCtx.W=SITE_W; siteCtx.D=SITE_D;
  siteCtx.items.forEach(it=>{ it.x*=k; it.z*=k; it.w*=k; it.d*=k; it.h*=k; });
  interiorCtxs.clear();
  siteCtx.items.forEach(b=>{ if(b.enter){ const c=makeInteriorCtx(b); if(c) interiorCtxs.set(b.id,c); } });
  interiorCtxs.forEach(c=>computeData(c));
  if(ctx.kind!=="site") exitBuilding();
  disposeMEPAll();
  buildSiteScene(); buildSnapGrid(); fitShadow();
  camGoal.dist=SITE_W*1.05;
  recomputeActive();
  toast("敷地スケールを更新（全建屋・内部も比例スケール）");
};

// ================= 書出・読込 =================
document.getElementById("expBtn").onclick=()=>{
  const data={ schemaVersion:4,edition:"internal-simulation-6.0",simulation:window.__factorySim.export(),productivity:window.__factoryProductivity.export(),exterior:exExport(),units:"m",v4:v4Export(),view:v3ExportView(), precision:precisionExport(), siteW:SITE_W,
    site: siteCtx.items.map(it=>({id:it.id,x:it.x,z:it.z})),
    interiors: Object.fromEntries([...interiorCtxs.entries()].map(([id,c])=>
      [id, c.items.map(it=>({proc:it.proc,name:it.name,x:it.x,z:it.z,w:it.w,d:it.d,h:it.h,
                             bw:it.bw??it.w,bd:it.bd??it.d,rot:it.rot||0,
                             color:it.color,fixed:!!it.fixed,
                             variant:it.variant||null,num:it.num||null,kv:it.kv||null,noOcc:!!it.noOcc}))])) };
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,1)],{type:"application/json"}));
  a.download="kazo-layout.json"; a.click();
  toast("配置をJSONで書き出しました");
};
document.getElementById("impBtn").onclick=()=>document.getElementById("impFile").click();
document.getElementById("impFile").onchange=async(e)=>{
  const f=e.target.files[0]; if(!f) return;
  try{
    const data=v3Migrate(JSON.parse(await f.text()));
    validatePrecisionImport(data);
    v4Validate(data);
    if(data.simulation)window.__factorySim.validate(data.simulation);
    if(data.productivity)window.__factoryProductivity.validate(data.productivity);
    (data.site||[]).forEach(s=>{
      const it=siteCtx.items.find(i=>i.id===s.id);
      if(it){ it.x=s.x; it.z=s.z; it.mesh?.position.set(s.x,0,s.z); }
    });
    Object.entries(data.interiors||{}).forEach(([id,arr])=>{
      const c=interiorCtxs.get(id); if(!c) return;
      if(arr.length && arr[0].proc!==undefined){
        c.items = arr.map(p=>({proc:p.proc,name:p.name,x:p.x,z:p.z,w:p.w,d:p.d,h:p.h,
                               bw:p.bw??p.w,bd:p.bd??p.d,rot:p.rot||0,
                               color:p.color,fixed:!!p.fixed,
                               variant:p.variant||null,num:p.num||null,kv:p.kv||null,noOcc:!!p.noOcc}));
      } else {
        arr.forEach((p,i)=>{ if(c.items[i]){ c.items[i].x=p.x; c.items[i].z=p.z; } });
      }
      computeData(c);
    });
    applyPrecisionImport(data.precision);
    v4Import(data);
    exImport(data.exterior);
    if(data.simulation)window.__factorySim.import(data.simulation);
    if(data.productivity)window.__factoryProductivity.import(data.productivity);
    interiorCtxs.forEach(c=>computeData(c));
    if(data.view)v3ImportView(data.view);
    if(ctx.kind==="site") buildSiteScene();
    else refreshInterior(false);
    recomputeActive();
    toast("配置・設備属性を読み込みました");
  }catch(err){ toast("読込失敗: "+err.message); }
  e.target.value="";
};

// ================= UI =================
document.querySelectorAll("#nav [data-cam]").forEach(b=>b.onclick=()=>setCam(b.dataset.cam));
document.getElementById("backBtn").onclick=exitBuilding;
const moveBtn=document.getElementById("moveBtn");
moveBtn.onclick=()=>{ moveMode=!moveMode; moveBtn.classList.toggle("on",moveMode);
  if(snapGrid) snapGrid.visible=moveMode;
  toast(moveMode? (ctx.kind==="site"?"移動モード: 建屋をドラッグ（5m吸着・将来計画の検討用）":"吸着グリッドを表示（建屋内は常時ドラッグ可能）") :"移動モード解除"); };
const congBtn=document.getElementById("congBtn");
congBtn.onclick=()=>{ congestionMode=!congestionMode; congBtn.classList.toggle("on",congestionMode); renderCongestion(); };
document.getElementById("baseBtn").onclick=()=>{
  ctx.baseline={ ...ctx.m, positions:ctx.items.map(it=>({x:it.x,z:it.z})) };
  globalBaseHours=totalHours();
  updateStatsUI(); toast(ctx.label+" の現状を基準として記録");
};
document.getElementById("ghostBtn").onclick=toggleGhost;
document.getElementById("optBtn").onclick=optimize;
const playBtn=document.getElementById("playBtn");
playBtn.onclick=()=>{ playing=!playing; playBtn.textContent=playing?"⏸ 一時停止":"▶ 稼働再生"; };

// ================= 表示品質 / スクリーンショット / ガイドツアー / ショートカット / ミニマップ =================
let autoOrbit=false;
const shBtn=document.getElementById("shBtn");
shBtn.classList.add("on");
shBtn.onclick=()=>{
  shadowsOn=!shadowsOn;
  renderer.shadowMap.enabled=shadowsOn; dir.castShadow=shadowsOn;
  scene.traverse(o=>{ const ms=Array.isArray(o.material)?o.material:(o.material?[o.material]:[]); ms.forEach(m=>{ m.needsUpdate=true; }); });
  shBtn.classList.toggle("on",shadowsOn); shadowDirty=true;
  toast(shadowsOn? "影: ON — 太陽光の落影を描画" : "影: OFF — 描画負荷を軽減");
};
document.getElementById("shotBtn").onclick=()=>{
  const hv=hoverBox.visible; hoverBox.visible=false;
  renderer.render(scene,camera);
  const url=renderer.domElement.toDataURL("image/png");
  hoverBox.visible=hv;
  const d=new Date(), p2=n=>String(n).padStart(2,"0");
  const a=document.createElement("a");
  a.href=url; a.download="kazo-"+ctx.id+"-"+d.getFullYear()+p2(d.getMonth()+1)+p2(d.getDate())+"-"+p2(d.getHours())+p2(d.getMinutes())+".png";
  a.click();
  toast("現在の画面をPNGで保存しました");
};
// ---- ガイドツアー（主要機能を自動でめぐる） ----
const tourBtn=document.getElementById("tourBtn"), tourCap=document.getElementById("tourCap");
let tourTimer=null, tourStep=-1;
function closePanels(){
  if(document.getElementById("schPanel").style.display==="block") document.getElementById("schClose").onclick();
  if(anaOpen) document.getElementById("anaBtn").onclick();
  clearClashes(); hideMepProp(); select(null);
}
const TOUR=[
  { t:"敷地全体 — 16建屋の配置と物流動線", dur:7000,
    d:"アトミクス加須工場（敷地 260×185m）。建屋間の物流を日次便数に応じた太さの動線で表示し、搬送距離・動線交差・最長動線・全社物流工数をSLP指標で評価します。",
    run:()=>{ if(ctx.kind==="interior") exitBuilding(); closePanels(); if(bimMode) bimBtn.onclick(); setCam("top"); camGoal.yaw=0.2; autoOrbit=false; } },
  { t:"稼働再生 — フォークリフトとトラック便", dur:8000,
    d:"フォークリフトが建屋間を往復搬送し、正門からの茨城便・千葉便が倉庫バースへ到着。端点では荷役（フォーク昇降・積み下ろし）を行い、混雑表示で通行負荷の高いセルが分かります。",
    run:()=>{ setCam("iso"); if(!playing) playBtn.onclick(); autoOrbit=true; } },
  { t:"BIM表示 — 屋上機器と屋外配管ラック", dur:8000,
    d:"躯体を透過し、各建屋のAHU・排気ファン・ダクトと、タンクヤード⇔工場を結ぶ7段の屋外配管ラック（保温管・伸縮ループ付き）を表示。建屋をドラッグするとラックも追従再生成されます。",
    run:()=>{ if(!bimMode) bimBtn.onclick(); camGoal.target.set(35,4,-15); camGoal.dist=150; camGoal.pitch=1.0; autoOrbit=true; } },
  { t:"干渉チェック", dur:6000,
    d:"系統間のAABB干渉を自動検出。赤い球が干渉箇所で、一覧クリックでズームし両要素をハイライトします。",
    run:()=>{ runClash(); } },
  { t:"第一ペイント工場 — 内部の工程ライン", dur:9000,
    d:"原料 → 分散ミル → ディスパー → 調合槽 → KVタンク → 充填 → 製品の工程配置。設備はドラッグ・回転・複製・削除でき、動線と工数が即時に再計算されます。現地写真パネルで実態と比較できます。",
    run:()=>{ clearClashes(); const b=siteCtx.items.find(i=>i.id==="paint1"); if(b) enterBuilding(b); autoOrbit=true; } },
  { t:"天井MEP — 設備への実接続", dur:9000,
    d:"給気/還気/集塵/消火/プロセス/圧空/電気の各系統が設備位置へ実接続。吊りボルト・ダンパー・弁・圧力計・ケーブル束まで再現し、要素クリックで属性（ID/系統/サイズ/経路長）を表示します。",
    run:()=>{ camGoal.target.set(0,6,0); camGoal.dist=Math.max(ctx.W,ctx.D)*0.45; camGoal.pitch=1.15; } },
  { t:"単線系統図 — 3Dと連動", dur:6000,
    d:"表示中のMEPから系統図をSVGで自動生成。行クリックで系統の表示/非表示を3D表示・レイヤーと連動して切り替えます。",
    run:()=>{ if(document.getElementById("schPanel").style.display!=="block") document.getElementById("schBtn").onclick(); } },
  { t:"生産性分析 — 改善提案の自動計算", dur:8000,
    d:"搬送負荷TOP動線、フォーク/徒歩工数、必要フォークリフト台数、年間物流コストを算出。改善提案は動線重心方向への移動を評価し、ワンクリックで適用できます。",
    run:()=>{ document.getElementById("schClose").onclick(); if(!anaOpen) document.getElementById("anaBtn").onclick(); document.getElementById("anaSugBtn").onclick(); } },
  { t:"ツアー終了", dur:4500,
    d:"ここからは自由に操作してください。ダブルクリックで建屋内へ、BIM表示で配管系統、図面モードで白図表示、📷 保存で画面をPNG出力できます。",
    run:()=>{ if(anaOpen) document.getElementById("anaBtn").onclick(); if(ctx.kind==="interior") exitBuilding(); setCam("iso"); autoOrbit=false; } },
];
function showCap(s,i){
  tourCap.style.display="block";
  document.getElementById("tcStep").textContent="ガイドツアー "+(i+1)+" / "+TOUR.length;
  document.getElementById("tcTtl").textContent=s.t;
  document.getElementById("tcTxt").textContent=s.d;
  const bar=document.getElementById("tcBar");
  bar.style.transition="none"; bar.style.width="0%";
  void bar.offsetWidth;
  bar.style.transition="width "+s.dur+"ms linear"; bar.style.width="100%";
}
function nextTour(){
  tourStep++;
  if(tourStep>=TOUR.length){ stopTour(); return; }
  const s=TOUR[tourStep];
  try{ s.run(); }catch(err){ console.warn("tour step failed", err); }
  showCap(s,tourStep);
  tourTimer=setTimeout(nextTour, s.dur);
}
function startTour(){ if(tourTimer) return; tourStep=-1; tourBtn.classList.add("on"); nextTour(); }
function stopTour(){
  if(tourTimer) clearTimeout(tourTimer);
  tourTimer=null; tourStep=-1; autoOrbit=false;
  tourCap.style.display="none"; tourBtn.classList.remove("on");
}
tourBtn.onclick=()=>{ tourTimer? stopTour() : startTour(); };
document.getElementById("tcStop").onclick=stopTour;
document.getElementById("tcNext").onclick=()=>{ if(tourTimer){ clearTimeout(tourTimer); nextTour(); } };
// ---- キーボードショートカット ----
addEventListener("keydown",(e)=>{
  if(e.target.tagName==="INPUT" || e.metaKey || e.ctrlKey || e.altKey) return;
  const k=e.key.toLowerCase();
  if(k==="escape"){ if(tourTimer){ stopTour(); return; } if(ctx.kind==="interior" && !selected) exitBuilding(); return; }
  if(k==="b") bimBtn.onclick();
  else if(k==="p") playBtn.onclick();
  else if(k==="m") moveBtn.onclick();
  else if(k==="c") congBtn.onclick();
  else if(k==="t") tourBtn.onclick();
  else if(k==="o"){ autoOrbit=!autoOrbit; toast(autoOrbit? "自動回転: ON（ドラッグで解除）" : "自動回転: OFF"); }
  else if(k==="1") setCam("top"); else if(k==="2") setCam("iso"); else if(k==="3") setCam("eye");
});
// ---- ミニマップ（現在ビューの配置・動線・カメラ位置。クリックで注視点を移動） ----
const miniCvs=document.getElementById("miniCvs"), miniC=miniCvs.getContext("2d");
miniCvs.width=412; miniCvs.height=280;
function miniXform(){
  const pad=18, s=Math.min((miniCvs.width-pad*2)/ctx.W,(miniCvs.height-pad*2)/ctx.D);
  return { s, ox:miniCvs.width/2, oz:miniCvs.height/2 };
}
function drawMini(){
  const c=miniC, {s,ox,oz}=miniXform();
  const X=x=>ox+x*s, Z=z=>oz+z*s;
  c.clearRect(0,0,miniCvs.width,miniCvs.height);
  c.fillStyle="#151b23"; c.fillRect(X(-ctx.W/2),Z(-ctx.D/2),ctx.W*s,ctx.D*s);
  c.strokeStyle="#2f3a46"; c.lineWidth=1; c.strokeRect(X(-ctx.W/2),Z(-ctx.D/2),ctx.W*s,ctx.D*s);
  c.lineWidth=1.5; c.globalAlpha=0.55;
  ctx.routes.forEach(r=>{
    c.strokeStyle="#"+r.color.toString(16).padStart(6,"0"); c.beginPath();
    r.pts.forEach((p,i)=> i? c.lineTo(X(p.x),Z(p.z)) : c.moveTo(X(p.x),Z(p.z))); c.stroke();
  });
  c.globalAlpha=1;
  ctx.items.forEach(it=>{
    c.fillStyle="#"+it.color.toString(16).padStart(6,"0");
    c.globalAlpha= it.noOcc? 0.35 : 0.9;
    c.fillRect(X(it.x-it.w/2),Z(it.z-it.d/2),Math.max(2,it.w*s),Math.max(2,it.d*s));
  });
  c.globalAlpha=1;
  if(playing){
    c.fillStyle="#ffd166";
    movers.forEach(m=>{ if(!m.mesh.visible) return; c.beginPath(); c.arc(X(m.mesh.position.x),Z(m.mesh.position.z),3,0,6.3); c.fill(); });
  }
  if(hovered){ c.strokeStyle="#ffd166"; c.lineWidth=2; c.strokeRect(X(hovered.x-hovered.w/2)-1,Z(hovered.z-hovered.d/2)-1,hovered.w*s+2,hovered.d*s+2); }
  const cx=Math.max(4,Math.min(miniCvs.width-4,X(camera.position.x))), cz=Math.max(4,Math.min(miniCvs.height-4,Z(camera.position.z)));
  const tx=X(camState.target.x), tz=Z(camState.target.z);
  c.strokeStyle="#58a6ff"; c.lineWidth=1.5; c.setLineDash([4,3]);
  c.beginPath(); c.moveTo(cx,cz); c.lineTo(tx,tz); c.stroke(); c.setLineDash([]);
  c.fillStyle="#58a6ff"; c.beginPath(); c.arc(cx,cz,4.5,0,6.3); c.fill();
  c.strokeStyle="#ffffff"; c.lineWidth=1.5;
  c.beginPath(); c.moveTo(tx-7,tz); c.lineTo(tx+7,tz); c.moveTo(tx,tz-7); c.lineTo(tx,tz+7); c.stroke();
  document.getElementById("miniLbl").textContent=ctx.label;
}
miniCvs.onclick=(e)=>{
  const r=miniCvs.getBoundingClientRect(), {s,ox,oz}=miniXform();
  const px=(e.clientX-r.left)*(miniCvs.width/r.width), pz=(e.clientY-r.top)*(miniCvs.height/r.height);
  const wx=Math.max(-ctx.W/2,Math.min(ctx.W/2,(px-ox)/s)), wz=Math.max(-ctx.D/2,Math.min(ctx.D/2,(pz-oz)/s));
  camGoal.target.set(wx, ctx.kind==="site"?4:2, wz);
  const base = ctx.kind==="site" ? SITE_W : Math.max(ctx.W,ctx.D);
  camGoal.dist=Math.min(camGoal.dist, base*0.55);
};
// ================= 現地写真パネル =================
// 現地写真（Base64埋込 — 単一HTMLで動作）
const PHOTO_DATA={@@INCLUDE data/photos.inc.js@@
};
const PHOTO_MAP={
  paint1:["p43606207.jpg","p43606178.jpg","p43606071.jpg","p43606147.jpg","p43606076.jpg","p43606110.jpg"],
  paint2:["p43606189.jpg","p43606095.jpg","p43606271.jpg","p43606278.jpg","p43606060.jpg","p43606164.jpg"],
  varnish:["p43606084.jpg","p43606164.jpg"],
  tint:["p43606118.jpg","p43606133.jpg"],
  whGen:["p43606036.jpg","p43606110.jpg","p43606100.jpg","p43606030.jpg"],
  whNew:["p43606216.jpg","p43606247.jpg","p43606138.jpg","p43606240.jpg"],
  hazNew:["p43606228.jpg","p43606240.jpg"],
  hazA:["p43606044.jpg","p43606057.jpg"],
  hazB:["p43606228.jpg","p43606044.jpg"],
};
function showPhotos(bId){
  const p=document.getElementById("photoPanel"), list=PHOTO_MAP[bId];
  if(!list||!list.length){ p.style.display="none"; return; }
  document.getElementById("photoThumbs").innerHTML =
    list.map(f=>'<img src="'+(PHOTO_DATA[f]||("photos/"+f))+'" loading="lazy">').join("");
  p.style.display="block";
  document.querySelectorAll("#photoThumbs img").forEach(img=>{
    img.onclick=()=>{ document.getElementById("lightboxImg").src=img.src;
                      document.getElementById("lightbox").style.display="flex"; };
  });
}
document.getElementById("lightbox").onclick=()=>{
  document.getElementById("lightbox").style.display="none"; };

// ================= 生産性分析・改善提案・搬入最適化 =================
let anaOpen=false;
function overlapsItem(c2,it,x,z){
  return c2.items.some(o=> o!==it && !o.noOcc &&
    Math.abs(x-o.x) < (it.w+o.w)/2+1.5 && Math.abs(z-o.z) < (it.d+o.d)/2+1.5 );
}
function highlightRoute(i){
  routeTubes.forEach((t,j)=>{
    if(t?.material) t.material.emissiveIntensity = (i<0)? 0.35 : (j===i? 1.35 : 0.1);
  });
  const r=ctx.routes[i];
  if(r && r.pts.length){
    const mid=r.pts[Math.floor(r.pts.length/2)];
    camGoal.target.set(mid.x,2,mid.z);
    camGoal.dist=Math.max(28, camGoal.dist*0.8);
  }
}
const LOGI_ANA=new Set(["IN","OUT","CAN","NST","DRM","BAG","FRC","IBC","RCK"]);
function renderAnalysis(){
  if(!anaOpen) return;
  const body=document.getElementById("anaBody");
  const total=Math.max(1,ctx.m.total);
  const nm=k=> ctx.kind==="site" ? ((siteCtx.items.find(x=>x.id===k)||{}).name||k) : (PROC_JP[k]||k);
  const rows=ctx.routes.map((r,i)=>({i,fk:r.fk,tk:r.tk,load:Math.round(r.len*r.reps*2)}))
    .sort((a,b)=>b.load-a.load).slice(0,6);
  const hoursAll=totalHours();
  let forkM=0, walkM=0;
  ctx.routes.forEach(r=>{
    const L2=r.len*r.reps*2;
    if(ctx.kind==="site"||LOGI_ANA.has(r.fk)||LOGI_ANA.has(r.tk)) forkM+=L2; else walkM+=L2;
  });
  const forkH=forkM/(ctx.kind==="site"?SPEED.site:SPEED.interior);
  const walkH=walkM/SPEED.interior;
  const nFork=Math.max(1,Math.ceil(forkH/7.5*1.3));
  const cost=Math.round(hoursAll*250*3000/10000);
  body.innerHTML =
    '<div class="kv2">搬送負荷 TOP — '+(ctx.kind==="site"?"建屋間":"工程間")+'（クリックで動線を強調）</div>'
    + rows.map(r=>{
        const pct=Math.min(100,Math.round(r.load/total*100));
        return '<div class="ci anaRow" data-ri="'+r.i+'">'+nm(r.fk)+' → '+nm(r.tk)
          +'<span style="float:right;font-variant-numeric:tabular-nums">'+r.load.toLocaleString()+'m/日</span>'
          +'<div class="anaBar"><div style="width:'+pct+'%"></div></div></div>';
      }).join("")
    + '<div class="sep"></div>'
    + '<div class="row"><span>搬送(ﾌｫｰｸ/車両)</span><span class="v">'+forkH.toFixed(1)+' h/日</span></div>'
    + '<div class="row"><span>工程間(徒歩)</span><span class="v">'+walkH.toFixed(1)+' h/日</span></div>'
    + '<div class="row"><span>必要ﾌｫｰｸﾘﾌﾄ(概算)</span><span class="v">'+nFork+' 台</span></div>'
    + '<div class="row"><span>年間物流ｺｽﾄ概算</span><span class="v">'+cost.toLocaleString()+' 万円</span></div>'
    + '<div style="font-size:10px;color:var(--sub);line-height:1.5">7.5h/日・稼働率77%・3,000円/h・250日/年で換算</div>';
  document.querySelectorAll("#anaBody .anaRow").forEach(d=>{
    d.onclick=()=>highlightRoute(+d.dataset.ri);
  });
  document.getElementById("anaDockBtn").disabled = ctx.kind!=="interior";
}
function suggestImprovements(){
  computeData(ctx);
  const base=(ctx.m.objective??ctx.m.total);
  const rows=[...ctx.routes].sort((a,b)=>b.len*b.reps-a.len*a.reps).slice(0,4);
  const tried=new Set(); const sugg=[];
  rows.forEach(r=>{
    [[r.fk,r.tk],[r.tk,r.fk]].forEach(([mvKey,anKey])=>{
      const cands=ctx.items.filter(it=>
        (ctx.kind==="site"? it.id===mvKey : it.proc===mvKey) && !it.fixed && !it.noOcc);
      const an=endpoint(ctx,anKey);
      cands.forEach(it=>{
        if(tried.has(it)) return; tried.add(it);
        const ox=it.x, oz=it.z;
        let best=null;
        [0.35,0.55,0.75].forEach(f=>{
          let x=snapTo(ox+(an.x-ox)*f, ctx.snap), z=snapTo(oz+(an.z-oz)*f, ctx.snap);
          x=Math.max(-ctx.W/2+it.w/2, Math.min(ctx.W/2-it.w/2, x));
          z=Math.max(-ctx.D/2+it.d/2, Math.min(ctx.D/2-it.d/2, z));
          if(overlapsItem(ctx,it,x,z)) return;
          it.x=x; it.z=z; computeData(ctx);
          const d=base-(ctx.m.objective??ctx.m.total);
          if(d>0.5 && (!best||d>best.d)) best={x,z,d};
          it.x=ox; it.z=oz;
        });
        if(best && best.d/base>0.004)
          sugg.push({name:it.name, item:it, to:best, pct:best.d/base*100});
      });
    });
  });
  computeData(ctx);
  sugg.sort((a,b)=>b.to.d-a.to.d);
  return sugg.slice(0,4);
}
function applySuggestion(s){
  s.item.x=s.to.x; s.item.z=s.to.z;
  s.item.mesh?.position.set(s.to.x,0,s.to.z);
  if(ctx.kind==="interior") refreshInterior(false); else recomputeActive();
  toast(s.name+" を移動 — 搬送距離 −"+s.pct.toFixed(1)+"%");
}
function optimizeDocks(){
  if(ctx.kind!=="interior") return;
  computeData(ctx);
  const base=(ctx.m.objective??ctx.m.total);
  ctx.items.filter(it=>it.proc==="IN"||it.proc==="OUT").forEach(door=>{
    const onXWall = Math.abs(Math.abs(door.x)-(ctx.W/2-door.w/2))
                  < Math.abs(Math.abs(door.z)-(ctx.D/2-door.d/2));
    let best={x:door.x, z:door.z, total:(ctx.m.objective??ctx.m.total)};
    for(let t=-0.40; t<=0.401; t+=0.08){
      const x= onXWall? door.x
        : Math.max(-ctx.W/2+door.w/2, Math.min(ctx.W/2-door.w/2, snapTo(t*ctx.W,2.5)));
      const z= onXWall
        ? Math.max(-ctx.D/2+door.d/2, Math.min(ctx.D/2-door.d/2, snapTo(t*ctx.D,2.5)))
        : door.z;
      if(overlapsItem(ctx,door,x,z)) continue;
      const ox=door.x, oz=door.z;
      door.x=x; door.z=z; computeData(ctx);
      if((ctx.m.objective??ctx.m.total)<best.total-0.5) best={x,z,total:(ctx.m.objective??ctx.m.total)};
      door.x=ox; door.z=oz;
    }
    door.x=best.x; door.z=best.z; computeData(ctx);
  });
  refreshInterior(false);
  const imp=Math.round((base-(ctx.m.objective??ctx.m.total))/Math.max(1,base)*100);
  toast(imp>0? "搬入・搬出口を最適化しました — 搬送距離 −"+imp+"%"
            : "搬入・搬出口は現在位置がほぼ最適です");
}
document.getElementById("anaBtn").onclick=()=>{
  anaOpen=!anaOpen;
  document.getElementById("anaBtn").classList.toggle("on",anaOpen);
  document.getElementById("anaPanel").style.display=anaOpen?"block":"none";
  if(!anaOpen) highlightRoute(-1);
  renderAnalysis();
};
document.getElementById("anaSugBtn").onclick=async()=>{
  const b2=document.getElementById("anaSugBtn");
  b2.textContent="計算中…"; b2.disabled=true;
  await new Promise(r=>setTimeout(r,30));
  const sugg=suggestImprovements();
  const el2=document.getElementById("anaSug");
  el2.innerHTML = sugg.length
    ? '<div class="kv2" style="margin-top:8px">改善提案（配置の見直し）</div>'
      + sugg.map((s,i)=>'<div class="ci">'+s.name+' を動線重心へ移動'
        +'<span style="float:right;color:var(--good)">−'+s.pct.toFixed(1)+'%</span>'
        +'<br><button class="btn sApply" data-i="'+i+'" style="margin-top:4px">適用</button></div>').join("")
    : '<div style="color:var(--sub);margin-top:8px">有意な改善候補なし — 現配置は良好です</div>';
  el2.querySelectorAll(".sApply").forEach(bt=>{
    bt.onclick=()=>{ applySuggestion(sugg[+bt.dataset.i]); bt.disabled=true; bt.textContent="適用済"; };
  });
  b2.textContent="改善提案を計算"; b2.disabled=false;
};
document.getElementById("anaDockBtn").onclick=optimizeDocks;

// ================= 単線系統図（現在のビューのMEPから自動生成） =================
function renderSchematic(){
  const p=document.getElementById("schPanel");
  if(p.style.display!=="block") return;
  const intView=ctx.kind==="interior"&&currentBuilding;
  const els=mepAll.filter(e=> intView? (e.int&&e.bId===currentBuilding.id) : !e.int);
  const SRC={SA:"AHU",RA:"AHU",EA:"排気FAN",DC:"集塵機",HV:"チラー",FP:"ｱﾗｰﾑ弁",
             PR:"ﾀﾝｸﾔｰﾄﾞ",CA:"ｺﾝﾌﾟﾚｯｻ",SN:"排水桝",EL:"MCC盤"};
  const rows=[];
  Object.entries(SYSTEMS).forEach(([k,s])=>{
    if(k==="RK"||k==="EQ") return;
    const se=els.filter(e=>e.sys===k);
    if(!se.length) return;
    rows.push({k, name:s.name, color:s.color, n:se.length,
      len:Math.round(se.reduce((a2,e)=>a2+e.len,0)),
      size:(se[0].size||"").split("→")[0], vis:sysVis[k]});
  });
  const rowH=46, w2=596, h2=rows.length*rowH+18;
  let svg='<svg viewBox="0 0 '+w2+' '+h2+'" xmlns="http://www.w3.org/2000/svg">';
  svg+='<text x="10" y="14" fill="#8b949e" font-size="10">'+
    (intView? currentBuilding.name+"（建屋内系統）" : "敷地全体（屋外系統含む）")+'</text>';
  rows.forEach((r,i)=>{
    const y=38+i*rowH;
    const col="#"+r.color.toString(16).padStart(6,"0");
    svg+='<g class="schRow" data-k="'+r.k+'" style="cursor:pointer" opacity="'+(r.vis?1:0.25)+'">';
    svg+='<rect x="8" y="'+(y-13)+'" width="78" height="26" rx="4" fill="none" stroke="'+col+'" stroke-width="1.5"/>';
    svg+='<text x="47" y="'+(y+4)+'" fill="#c9d1d9" font-size="10" text-anchor="middle">'+SRC[r.k]+'</text>';
    svg+='<line x1="86" y1="'+y+'" x2="368" y2="'+y+'" stroke="'+col+'" stroke-width="3"/>';
    const nT=Math.min(14,Math.max(2,Math.round(r.len/40)));
    for(let t2=0;t2<nT;t2++){
      const x=104+t2*(246/nT);
      svg+='<line x1="'+x+'" y1="'+y+'" x2="'+x+'" y2="'+(y-9)+'" stroke="'+col+'" stroke-width="1.5"/>';
      svg+='<circle cx="'+x+'" cy="'+(y-11)+'" r="2" fill="'+col+'"/>';
    }
    svg+='<path d="M 372 '+(y-5)+' L 382 '+(y+5)+' M 372 '+(y+5)+' L 382 '+(y-5)+'" stroke="'+col+'" stroke-width="1.5"/>';
    svg+='<path d="M 388 '+(y-5)+' L 400 '+y+' L 388 '+(y+5)+' Z" fill="'+col+'"/>';
    svg+='<text x="408" y="'+(y-2)+'" fill="#e6edf3" font-size="11" font-weight="600">'+r.name+'</text>';
    svg+='<text x="408" y="'+(y+12)+'" fill="#8b949e" font-size="9">'+(r.size||"")+'　延長 '+r.len+'m / '+r.n+'要素</text>';
    svg+='</g>';
  });
  svg+='</svg>';
  document.getElementById("schBody").innerHTML=svg;
  document.querySelectorAll("#schBody .schRow").forEach(gr=>{
    gr.addEventListener("click",()=>{
      const k=gr.dataset.k;
      sysVis[k]=!sysVis[k];
      applySysVis(); buildLayersUI(); renderSchematic();
    });
  });
}
document.getElementById("schBtn").onclick=()=>{
  const p=document.getElementById("schPanel");
  const show=p.style.display!=="block";
  p.style.display=show?"block":"none";
  document.getElementById("schBtn").classList.toggle("on",show);
  renderSchematic();
};
document.getElementById("schClose").onclick=()=>{
  document.getElementById("schPanel").style.display="none";
  document.getElementById("schBtn").classList.remove("on");
};

const bimBtn=document.getElementById("bimBtn");
bimBtn.onclick=()=>{
  bimMode=!bimMode;
  bimBtn.classList.toggle("on",bimMode);
  document.getElementById("clashBtn").disabled=!bimMode;
  document.getElementById("schBtn").disabled=!bimMode;
  if(!bimMode){
    document.getElementById("schPanel").style.display="none";
    document.getElementById("schBtn").classList.remove("on");
  }
  document.getElementById("layers").style.display=bimMode?"block":"none";
  if(!bimMode){ hideMepProp(); clearClashes(); }
  if(ctx.kind==="site") buildSiteScene(); else refreshInterior(true);
  updateMEPScene();
  if(bimMode) setCam("iso");
  toast(bimMode? "BIM表示: 躯体を透過し設備・配管系統を表示 — 要素クリックで属性、レイヤーで系統切替"
               : "通常表示に戻しました");
};
document.getElementById("clashBtn").onclick=runClash;
const drawBtn=document.getElementById("drawBtn");
drawBtn.onclick=()=>{
  drawMode=!drawMode;
  drawBtn.classList.toggle("on",drawMode);
  setSky(drawMode);
  ambL.intensity = drawMode?0.75:0.30;
  hemiL.intensity = drawMode?0.85:0.55;
  hemiL.color.set(drawMode?0xffffff:0x9fb8d8); hemiL.groundColor.set(drawMode?0xdde3ea:0x2a2f36);
  dir.intensity  = drawMode?0.75:1.35;
  dir2.intensity = drawMode?0.1:0.22;
  disposeMEPAll();   // ラベル色を含め描画資産を再生成
  if(ctx.kind==="site") buildSiteScene(); else refreshInterior(true);
  updateMEPScene();
  toast(drawMode? "図面モード: 白背景のアイソメ調表示（BIM表示との併用が図面らしくなります）"
               : "通常表示に戻しました");
};
document.getElementById("mepPropClose").onclick=hideMepProp;
document.getElementById("clashClose").onclick=clearClashes;
// ---- 全パネル折りたたみ ----
[["nav","ナビ"],["tools","ツール"],["bimTools","BIM"],["stats","評価指標"],["play","稼働再生"],
 ["hint","操作ガイド"],["layers","MEPレイヤー"],["photoPanel","現地写真"],
 ["mepProp","MEP属性"],["clashPanel","干渉結果"],["anaPanel","生産性分析"],["schPanel","単線系統図"]].forEach(([id,label])=>{
  const p=document.getElementById(id); if(!p) return;
  const ttl=document.createElement("span"); ttl.className="pTitle"; ttl.textContent=label;
  const t=document.createElement("div"); t.className="pToggle"; t.textContent="−"; t.title="折りたたみ/展開";
  p.appendChild(ttl); p.appendChild(t);
  t.onclick=(e)=>{ e.stopPropagation();
    p.classList.toggle("collapsed");
    t.textContent = p.classList.contains("collapsed")? "＋" : "−"; };
});

// ================= toast =================
let toastT=null;
function toast(msg){ const t=document.getElementById("toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),3000); }

// ================= Exterior edition 4.1 =================
const exterior={light:'day',labels:false,landscape:true,context:true,clean:true,gateOpen:true,auto:false,groups:{},gateArms:[]};
function exMat(g,color,kind='metal'){
 const pool=g.userData.exMaterials||(g.userData.exMaterials=new Map()),key=color+':'+kind;if(pool.has(key))return pool.get(key);
 const m=new THREE.MeshStandardMaterial({color,roughness:kind==='concrete'?.94:kind==='glass'?.20:.58,metalness:kind==='concrete'?0:kind==='glass'?.35:.25});
 if(kind==='glass'){m.emissive.setHex(0xffd3a1);m.emissiveIntensity=exterior.light==='dusk'?.75:0;m.userData.exGlow=true;}
 if(kind==='lamp'){m.emissive.setHex(0xffe1ac);m.emissiveIntensity=exterior.light==='dusk'?2:.15;m.userData.exGlow=true;}
 pool.set(key,m);return m;
}
function exBox(g,w,h,d,x,y,z,color=0xa5aaa6,kind='metal'){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),exMat(g,color,kind));m.position.set(x,y,z);g.add(m);return m;}
function exCylinder(g,r,h,x,y,z,color=0xb5bdba,kind='metal',n=12){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,n),exMat(g,color,kind));m.position.set(x,y,z);g.add(m);return m;}
function exBeam(g,a,b,r,color=0x7e9291){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),v=bv.clone().sub(av);if(v.length()<.001)return;const m=exCylinder(g,r,v.length(),0,0,0,color);m.position.copy(av).add(bv).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return m;}
function exSign(g,text,w,h,x,y,z,ry=0,bg='#273f43',sub=''){
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;const c=canvas.getContext('2d');c.fillStyle=bg;c.fillRect(0,0,768,192);c.fillStyle='#e7f0e9';c.font='600 64px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,384,sub?72:96,720);if(sub){c.font='25px sans-serif';c.fillStyle='#a6c9be';c.fillText(sub,384,145,720);}const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:tex,roughness:.75,side:THREE.DoubleSide}));m.position.set(x,y,z);m.rotation.y=ry;g.add(m);return m;
}
function exTexture(b,kind){
 const c=document.createElement('canvas');c.width=c.height=512;const d=c.getContext('2d'),rnd=sRand('facade-'+b.id+kind);d.fillStyle=kind==='siding'?'#d0d4ce':'#e0e1d6';d.fillRect(0,0,512,512);
 for(let i=0;i<1500;i++){d.fillStyle=`rgba(83,85,67,${.015+rnd()*.035})`;d.fillRect(rnd()*512,rnd()*512,1+rnd()*5,1+rnd()*10);}
 if(kind==='siding')for(let x=0;x<512;x+=16){d.fillStyle='rgba(56,74,72,.10)';d.fillRect(x,0,3,512);d.fillStyle='rgba(255,255,255,.18)';d.fillRect(x+3,0,2,512);}
 else for(let x=0;x<512;x+=128){d.fillStyle='rgba(89,100,88,.12)';d.fillRect(x,0,1,512);}
 for(let i=0;i<28;i++){const x=rnd()*512;d.fillStyle='rgba(91,95,72,.045)';d.fillRect(x,350+rnd()*100,3+rnd()*8,180);}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(Math.max(b.w,b.d)/12,b.h/8);return t;
}
function exBake(g){
 g.updateMatrixWorld(true);const buckets=new Map();g.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material))return;let p=o,animated=false;while(p&&p!==g){if(p.userData.exAnimated) animated=true;p=p.parent;}if(animated)return;const k=o.material.uuid;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(o);});
 for(const list of buckets.values()){if(list.length<2)continue;const geometries=list.map(o=>{let geo=o.geometry.clone();if(geo.index){const n=geo.toNonIndexed();geo.dispose();geo=n;}geo.applyMatrix4(o.matrixWorld);return geo;});const merged=mergeGeometries(geometries);geometries.forEach(x=>x.dispose());if(!merged)continue;const m=new THREE.Mesh(merged,list[0].material);g.add(m);for(const o of list){o.parent.remove(o);o.geometry.dispose();}}
}
function exBuilding(b){
 if(bimMode)return makeBuildingMesh(b);
 const g=new THREE.Group(),w=b.w,d=b.d,h=b.h;
 if(b.proc==='tank'){
  exBox(g,w,.25,d,0,.125,0,0xa7a99e,'concrete');const n=b.tanks||3,r=Math.min(d*.30,w/n*.32);
  for(let i=0;i<n;i++){const x=-w/2+(i+.5)*w/n;exCylinder(g,r,h-.6,x,h/2,0,0xd9dcd3,'metal',32);const cap=new THREE.Mesh(new THREE.SphereGeometry(r,24,12,0,Math.PI*2,0,Math.PI/2),exMat(g,0xc9d0cb));cap.scale.y=.18;cap.position.set(x,h-.3,0);g.add(cap);
   for(const y of [h*.3,h*.65,h-.55]){const ring=new THREE.Mesh(new THREE.TorusGeometry(r+.03,.035,5,36),exMat(g,0x899b97));ring.rotation.x=Math.PI/2;ring.position.set(x,y,0);g.add(ring);}
   exCylinder(g,.13,.7,x,h+.25,0,0x7b9290);exBox(g,r*1.4,.10,.8,x,h-.12,-r*.72,0x7b8e8b);
   for(const dx of [-.32,.32])exBeam(g,[x+dx,.2,r+.18],[x+dx,h-.15,r+.18],.025);for(let y=.35;y<h-.25;y+=.32)exBeam(g,[x-.32,y,r+.18],[x+.32,y,r+.18],.019);
   exBeam(g,[x,h*.20,r],[x,h*.20,r+.65],.09,0x658a82);exBeam(g,[x,h*.20,r+.65],[x,.55,r+.65],.09,0x658a82);
   exSign(g,'OT-'+(i+1),r*.9,.55,x,h*.58,-r-.035,Math.PI,'#425654');
  }
  for(const z of [-d/2,d/2])exBox(g,w+.3,.85,.22,0,.425,z,0x949b92,'concrete');for(const x of [-w/2,w/2])exBox(g,.22,.85,d,x,.425,0,0x949b92,'concrete');
 }else if(b.proc==='gate'){
  const stone=0x9a9e94;for(const x of [-w/2,w/2]){exBox(g,.65,2.4,.7,x,1.2,0,stone,'concrete');exBox(g,.85,.12,.85,x,2.46,0,0x506660);}
  exBox(g,2.5,2.7,2.8,-w/2+1.85,1.35,.2,0xd9dfd6);exBox(g,2.8,.15,3.1,-w/2+1.85,2.77,.2,0x4c6868);exBox(g,2.0,.85,.045,-w/2+1.85,1.65,-1.23,0x476978,'glass');exSign(g,'受付',1.35,.32,-w/2+1.85,2.4,-1.26,Math.PI,'#314f4b');
  exSign(g,'加須工場',3.8,.9,w/2+2.25,1.65,-.14,Math.PI,'#32534e','KAZO FACTORY');exBox(g,4.2,2.2,.35,w/2+2.25,1.1,.05,0x61776f,'concrete');
  const arm=new THREE.Group();arm.userData.exAnimated=true;arm.position.set(-2.0,1.15,-.55);exBox(arm,6,.12,.14,3,0,0,0xe5e1c8);for(let x=.3;x<6;x+=1.1)exBox(arm,.32,.13,.15,x,0,0,0xab684a);arm.rotation.z=exterior.gateOpen?1.35:0;g.add(arm);exterior.gateArms.push(arm);exBox(g,.40,1.3,.45,-2,.65,-.55,0x536d68);
 }else if(b.proc==='pond'){
  const bank=exCylinder(g,w/2,.18,0,.09,0,0x819385,'concrete',40);bank.scale.z=d/w;
  const water=exCylinder(g,w*.45,.12,0,.13,0,0x5f9490,'metal',40);water.scale.z=d/w;
  for(let i=0;i<12;i++){const a=i*Math.PI*2/12;exBox(g,.18,.55,.18,Math.cos(a)*w*.46,.28,Math.sin(a)*d*.46,0x9ba995,'concrete');}
 }else{
  const warehouse=['wh','hazwh'].includes(b.proc),office=['office','lab'].includes(b.proc),wall=exMat(g,0xffffff,'concrete');wall.map=exTexture(b,warehouse?'siding':'plaster');
  const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),wall);body.position.y=h/2;g.add(body);
  exBox(g,w+.6,.28,d+.6,0,.14,0,0x969e95,'concrete');
  const band=warehouse?0x7c8781:0x9eaaa4;exBox(g,w+.05,.65,d+.05,0,.55,0,band,'concrete');
  // Seamed, shallow pitched roofs on production / warehouse buildings; parapets on offices.
  const rise=office?0:Math.min(1.5,w*.045),sl=Math.hypot(w/2,rise),a=Math.atan2(rise,w/2);
  if(office){exBox(g,w+.3,.24,d+.3,0,h+.12,0,0x718383);for(const sign of [-1,1]){exBox(g,w+.4,.45,.15,0,h+.34,sign*d/2,0x7c8d88);exBox(g,.15,.45,d,sign*w/2,h+.34,0,0x7c8d88);}}
  else for(const sign of [-1,1]){const panel=exBox(g,sl+.28,.14,d+.6,sign*w/4,h+rise/2,0,0x738684);panel.rotation.z=-sign*a;for(let z=-d/2+.4;z<d/2;z+=1.0){const rib=exBox(g,sl+.2,.09,.065,sign*w/4,h+rise/2+.09,z,0x839590);rib.rotation.z=-sign*a;}}
  // Clerestory windows and glazing mullions, with differentiated bay rhythms.
  const floors=office?Math.max(1,Math.round(h/3.5)):1;
  for(let f=0;f<floors;f++){
   const wy=office?(f+.58)*h/floors:h*.62,wh=office?1.5:1.0;
   for(const sign of [-1,1]){
    const bays=Math.max(2,Math.floor(w/5));for(let i=0;i<bays;i++){const x=-w/2+(i+.5)*w/bays,ww=Math.min(3.9,w/bays*.70);exBox(g,ww+.18,wh+.18,.13,x,wy,sign*(d/2+.03),0xdce2d8);exBox(g,ww,wh,.15,x,wy,sign*(d/2+.09),0x65858b,'glass');for(const xx of [-ww*.25,0,ww*.25])exBox(g,.055,wh,.17,x+xx,wy,sign*(d/2+.13),0xced9d3);}
    const sideBays=Math.max(2,Math.floor(d/6));for(let i=0;i<sideBays;i++){const z=-d/2+(i+.5)*d/sideBays,wd=Math.min(4.2,d/sideBays*.72);exBox(g,.13,wh+.18,wd+.18,sign*(w/2+.03),wy,z,0xdce2d8);exBox(g,.15,wh,wd,sign*(w/2+.09),wy,z,0x65858b,'glass');for(const zz of [-wd*.25,0,wd*.25])exBox(g,.17,wh,.055,sign*(w/2+.13),wy,z+zz,0xced9d3);}
   }
  }
  // Loading shutters, dock buffers, canopy structure and bay markings.
  const bays=b.id==='whGen'?5:office?0:Math.max(1,Math.floor(w/21)),opening=Math.min(4.6,w/Math.max(1,bays)*.6),sh=Math.min(4,h*.46);
  for(let i=0;i<bays;i++){const x=-w/2+(i+.5)*w/bays,z=-d/2-.14;
   exBox(g,opening+.3,sh+.15,.20,x,sh/2,z,0x6d807b);exBox(g,opening,sh,.24,x,sh/2,z-.05,0xa0aaa2);for(let y=.25;y<sh;y+=.22)exBox(g,opening,.025,.26,x,y,z-.07,0x7c8e86);
   exBox(g,opening+.6,.22,2.0,x,.11,z-.7,0xa5aaa0,'concrete');for(const dx of [-opening/2-.23,opening/2+.23]){exCylinder(g,.09,.95,x+dx,.475,z-.9,0xd3b46e);exBox(g,.17,.23,.17,x+dx,.50,z-.9,0x65706c);}
   const aw=opening+1.25;exBox(g,aw,.14,2.0,x,sh+.48,z-.6,0x607b79);exBeam(g,[x-aw/2+.2,sh+.32,z+.05],[x-aw/2+.2,sh+.32,z-1.3],.045);exBeam(g,[x+aw/2-.2,sh+.32,z+.05],[x+aw/2-.2,sh+.32,z-1.3],.045);
   exSign(g,b.id==='whGen'?String.fromCharCode(65+i):String(i+1).padStart(2,'0'),.8,.55,x,sh+.95,z-.16,Math.PI,'#385952');
  }
  const dx=w*.36,dz=-d/2-.18;exBox(g,1.45,2.25,.18,dx,1.125,dz,0x375958,'glass');exBox(g,1.7,.12,1.0,dx,2.48,dz-.35,0x68817c);
  exSign(g,b.name,Math.min(12,w*.55),.85,0,h-.85,-d/2-.2,Math.PI,'#32534e');
  // Eaves, downpipes, wall lights, condensers and roof ventilation caps.
  for(const sign of [-1,1]){exBox(g,.18,.18,d+.6,sign*(w/2+.12),h-.12,0,0x667d77);for(const z of [-d/2+.6,d/2-.6]){exBeam(g,[sign*(w/2+.17),h-.2,z],[sign*(w/2+.17),.25,z],.065,0x778f85);}}
  for(let i=0;i<Math.max(1,Math.floor(w/14));i++){const x=-w*.4+i*12;exBox(g,.6,.16,.3,x,Math.min(h-.9,4.8),-d/2-.25,0xece4bf,'lamp');}
  const nRoof=Math.max(1,Math.floor(d/16));for(let i=0;i<nRoof;i++){const z=-d*.30+i*d*.55/Math.max(1,nRoof-1);exCylinder(g,.26,.7,w*.15,h+rise*.7+.4,z,0x91a29a);exCylinder(g,.5,.12,w*.15,h+rise*.7+.8,z,0x728a82);}
  if(office||b.proc==='paint'){for(let i=0;i<2;i++){const x=-w*.25+i*3.0,z=d*.20;exBox(g,1.7,1.0,1.15,x,h+rise*.6+.65,z,0xc6cfc6);const fan=exCylinder(g,.33,.07,x,h+rise*.6+1.19,z,0x4c6663);for(let f=0;f<5;f++)exBox(g,1.2,.035,.04,x,h+rise*.6+.32+f*.13,z-.59,0x6c837a);}}
  if(!office){for(const sign of [-1,1]){const rooflight=exBox(g,w*.16,.11,d*.42,sign*w*.24,h+rise*.54+.13,0,0xa8c5c3,'glass');rooflight.rotation.z=-sign*a;}}
  if(h>=9&&!office){const x=w/2+.35,z=d/2-1.3;for(const zz of [-.33,.33])exBeam(g,[x,.3,z+zz],[x,h+.6,z+zz],.025);for(let y=.4;y<h+.5;y+=.32)exBeam(g,[x,y,z-.33],[x,y,z+.33],.018);}
 }
 exBake(g);
 const tag=makeLabel(b.name,Math.max(.45,Math.min(.9,w/60)),'#d8e8df');tag.position.y=h+3.4;tag.visible=exterior.labels;tag.userData.exLabel=true;g.add(tag);return g;
}
function exFree(x,z,w=1,d=1,pad=.4){return !siteCtx.items.some(b=>b.proc!=='gate'&&Math.abs(x-b.x)<(w+b.w)/2+pad&&Math.abs(z-b.z)<(d+b.d)/2+pad);}
function exTree(g,x,z,scale=1,seed='tree'){
 const rnd=sRand(seed);exCylinder(g,.14*scale,2.8*scale,x,1.4*scale,z,0x7a7258,'concrete',7);
 for(let i=0;i<6;i++){const a=i*2.4,r=i?(.6+rnd()*.4)*scale:0;const leaf=new THREE.Mesh(new THREE.IcosahedronGeometry((1.3+rnd()*.45)*scale,1),exMat(g,[0x5b7757,0x668661,0x76906a][i%3],'concrete'));leaf.position.set(x+Math.cos(a)*r,(2.7+rnd()*.7)*scale,z+Math.sin(a)*r);leaf.scale.y=.7;g.add(leaf);}
}
function exCar(g,x,z,col=0xdbe0d9,angle=0){const c=new THREE.Group();g.add(c);exBox(c,1.85,.65,4.2,0,.60,0,col);exBox(c,1.55,.58,2.3,0,1.18,-.15,0x4c6b71,'glass');exBox(c,1.70,.07,2.15,0,1.50,-.15,col);for(const sx of [-1,1])for(const zz of [-1.28,1.22]){const tire=exCylinder(c,.32,.18,sx*.90,.34,zz,0x344540);tire.rotation.z=Math.PI/2;}for(const sx of [-1,1])exBox(c,.45,.17,.05,sx*.56,.72,2.12,0xeee9c5,'lamp');c.position.set(x,0,z);c.rotation.y=angle;}
function exYard(){
 const g=new THREE.Group(),green=new THREE.Group(),context=new THREE.Group();siteGroup.add(g,green,context);exterior.groups={yard:g,landscape:green,context};
 const kx=SITE_W/260,kz=SITE_D/185;
 // Main circulation strips stay clear of building footprints. They are visual layout proposals.
 const roads=[[-43,-5,6,166],[-13,-64,238,6],[114,-7,6,162],[1,70,234,6],[-52,-84,6,9],[-47.5,-82,13,5]];
 for(const [xx,zz,ww,dd] of roads){const x=xx*kx,z=zz*kz,w=ww*kx,d=dd*kz,horiz=w>d,L=horiz?w:d,N=Math.ceil(L/2);for(let j=0;j<N;j++){const step=L/N,off=-L/2+(j+.5)*step,px=x+(horiz?off:0),pz=z+(horiz?0:off),rw=horiz?step+.01:w,rd=horiz?d:step+.01;if(!exFree(px,pz,rw,rd,.10))continue;exBox(g,rw,.015,rd,px,.006,pz,0x606d69,'concrete');for(const sign of [-1,1])exBox(g,horiz?rw:.10,.018,horiz?.10:rd,px+(horiz?0:sign*(w/2-.2)),.018,pz+(horiz?sign*(d/2-.2):0),0xd3d8c6,'concrete');if(j%4===1)exBox(g,horiz?step*.65:.12,.018,horiz?.12:step*.65,px,.02,pz,0xd4d6c6,'concrete');}}
 // Parking bays near the administration building.
 const parkingX=-20*kx,parkingZ=-55*kz;
 for(let i=0;i<6;i++){const x=parkingX+(i-2.5)*2.7;if(!exFree(x,parkingZ,2.5,5.2,.5))continue;exBox(g,2.55,.018,5.1,x,.014,parkingZ,0x7b8880,'concrete');for(const sign of [-1,1])exBox(g,.07,.025,5.0,x+sign*1.27,.025,parkingZ,0xe0e2d5,'concrete');exBox(g,2.4,.025,.08,x,.025,parkingZ+2.5,0xe0e2d5,'concrete');if(i!==4)exCar(g,x,parkingZ,[0xd9dfd6,0x94a29e,0xeff0e2,0x5a6c69,0x4c5f62,0xcbd3c8][i]);}
 // Perimeter fence, with a physical opening aligned to the gate.
 const gate=siteCtx.items.find(b=>b.proc==='gate'),gapMin=(gate?.x||-52)-(gate?.w||12)/2-.5,gapMax=(gate?.x||-52)+(gate?.w||12)/2+.5;
 const fence=(a,b)=>{const A=new THREE.Vector3(a[0],0,a[1]),B=new THREE.Vector3(b[0],0,b[1]),dist=A.distanceTo(B),n=Math.ceil(dist/3.5);for(let i=0;i<n;i++){const p=A.clone().lerp(B,i/n),q=A.clone().lerp(B,(i+1)/n);exCylinder(g,.045,1.9,p.x,.95,p.z,0x7a9186);for(const y of [.2,1.0,1.85])exBeam(g,[p.x,y,p.z],[q.x,y,q.z],.02,0x7d938a);for(let t=0;t<1;t+=.13){const x=p.x+(q.x-p.x)*t,z=p.z+(q.z-p.z)*t;exBeam(g,[x,.22,z],[x,1.82,z],.009,0x9cae9b);}}};
 const W=SITE_W/2,D=SITE_D/2;fence([-W,-D],[gapMin,-D]);fence([gapMax,-D],[W,-D]);fence([-W,D],[W,D]);fence([-W,-D],[-W,D]);fence([W,-D],[W,D]);
 // Planted perimeter with raised edges and low shrubs.
 for(const [x,z,w,d] of [[0,D-2,SITE_W-8,2.5],[-W+2,0,2.5,SITE_D-8],[W-2,0,2.5,SITE_D-8]]){exBox(g,w+.25,.14,d+.25,x,.07,z,0x9ea99b,'concrete');exBox(green,w,.08,d,x,.14,z,0x738664,'concrete');}
 for(let x=-W+7;x<W-6;x+=13)if(exFree(x,D-3,3,3))exTree(green,x,D-3,.9,'south'+x);
 for(let z=-D+10;z<D-6;z+=17)for(const sign of [-1,1])if(exFree(sign*(W-3),z,3,3))exTree(green,sign*(W-3),z,.8,'side'+z+sign);
 for(let x=-W+10;x<W-8;x+=15){if(x>gapMin-3&&x<gapMax+3)continue;if(exFree(x,-D+2.5,3,3))exTree(green,x,-D+2.5,.8,'north'+x);}
 // Ground lights, drains and simple wayfinding at circulation junctions.
 for(const [xx,zz] of [[-38,-76],[-38,-20],[-38,62],[106,-72],[106,-10],[106,63],[0,76],[65,76]]){const x=xx*kx,z=zz*kz;if(!exFree(x,z,1,1))continue;exCylinder(g,.085,6.2,x,3.1,z,0x7a8f86);exBeam(g,[x,6.05,z],[x+1.2,6.05,z],.045);exBox(g,.9,.10,.32,x+1.2,6.02,z,0xf1e6c5,'lamp');}
 for(const [x,z,txt] of [[-40,-67,'出荷倉庫 →'],[-39,63,'← 原料・危険物倉庫'],[109,61,'製造エリア']]){exCylinder(g,.04,2.5,x*kx,1.25,z*kz,0x7a8b81);exSign(g,txt,3.2,.65,x*kx,2.25,z*kz,Math.PI,'#32544b');}
 for(const x of [-30,-10,10,30,50,70])if(exFree(x*kx,-68*kz,1.1,.4))for(let i=0;i<8;i++)exBox(g,.09,.012,.42,x*kx+i*.13,.025,-68*kz,0x4c6159);
 // Low-detail surrounding blocks: scale context, not a survey of neighboring property.
 const road=exBox(context,SITE_W+60,.025,10,0,-.02,-D-7,0x6d7971,'concrete');for(let x=-W-20;x<W+20;x+=10)exBox(context,4,.015,.13,x,.002,-D-7,0xd7d9c9,'concrete');
 for(const [x,z,w,d,h] of [[-70,-125,64,26,9],[35,-125,52,20,7],[112,-130,40,30,11],[-165,-30,44,60,8],[167,20,40,70,11],[-60,125,70,26,6],[60,128,56,22,9]]){exBox(context,w,h,d,x*kx,h/2-.05,z*kz,0x9fa99c,'concrete');exBox(context,w+.2,.15,d+.2,x*kx,h,z*kz,0x8c9b90);}
 exBake(g);exBake(green);exBake(context);green.visible=exterior.landscape;context.visible=exterior.context;
}
function buildSiteScene(){
 clearGroup(siteGroup);exterior.gateArms=[];
 const outer=new THREE.Mesh(new THREE.PlaneGeometry(SITE_W*4,SITE_D*4),new THREE.MeshStandardMaterial({color:drawMode?0xe5e9e0:0x9ba88c,roughness:1}));outer.rotation.x=-Math.PI/2;outer.position.y=-.12;siteGroup.add(outer);
 const slab=new THREE.Mesh(new THREE.PlaneGeometry(SITE_W,SITE_D),new THREE.MeshStandardMaterial({color:drawMode?0xe5e9e2:0x939e90,roughness:.97}));slab.rotation.x=-Math.PI/2;slab.position.y=-.04;siteGroup.add(slab);
 for(let i=0;i<siteCtx.items.length;i++){const b=siteCtx.items[i],mesh=exBuilding(b);mesh.position.set(b.x,0,b.z);mesh.userData.idx=i;mesh.traverse(o=>{o.userData.idx=i;});siteGroup.add(mesh);b.mesh=mesh;}
 exYard();applyShadows(siteGroup);updateMEPScene();exLight();
}
function exLight(){
 if(drawMode){setSky(true);ambL.intensity=.75;hemiL.intensity=.85;dir.intensity=.75;return;}
 if(ctx.kind!=='site'){setSky(false);ambL.intensity=.30;hemiL.intensity=.55;hemiL.color.setHex(0x9fb8d8);hemiL.groundColor.setHex(0x2a2f36);dir.color.setHex(0xfff1dc);dir.intensity=1.35;dir.position.set(120,260,80);dir2.intensity=.22;renderer.toneMappingExposure=1.12;return;}
 const p={day:{top:0x7ea7bd,mid:0xc8d6ce,ground:0x9ca993,sun:0xfff0d5,position:[-110,210,-135],intensity:2.15,ambient:.60,hemi:1.05,exposure:1.12},late:{top:0x899bab,mid:0xdecbb1,ground:0xa79a80,sun:0xffc58b,position:[-200,90,-100],intensity:2.0,ambient:.48,hemi:.85,exposure:1.18},dusk:{top:0x263e57,mid:0x6d848e,ground:0x4f655d,sun:0xecc397,position:[-200,35,80],intensity:.65,ambient:.35,hemi:.68,exposure:1.32}}[exterior.light];
 skyMat.uniforms.top.value.setHex(p.top);skyMat.uniforms.mid.value.setHex(p.mid);skyMat.uniforms.bot.value.setHex(p.ground);scene.background=new THREE.Color(p.mid);scene.fog=new THREE.Fog(p.mid,350,1150);ambL.intensity=p.ambient;hemiL.intensity=p.hemi;hemiL.color.setHex(0xd5e4e6);hemiL.groundColor.setHex(p.ground);dir.color.setHex(p.sun);dir.position.set(...p.position);dir.intensity=p.intensity;dir2.intensity=.18;renderer.toneMappingExposure=p.exposure;
 siteGroup.traverse(o=>{const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)if(m?.userData.exGlow)m.emissiveIntensity=exterior.light==='dusk'?.85:0;});dirtyShadow();
}
function exCamera(mode){
 if(ctx.kind!=='site')exitBuilding();v3StopWalk();v3ClearSection();pSetTab('exterior');
 const gate=siteCtx.items.find(b=>b.proc==='gate'),wh=siteCtx.items.find(b=>b.id==='whGen'),tank=siteCtx.items.find(b=>b.id==='tankA');
 const presets={overall:{target:[0,3,-5],dist:SITE_W*1.03,pitch:.83,yaw:-1.9},gate:{target:[gate.x+3,2.5,gate.z+7],dist:40,pitch:1.28,yaw:-1.9},warehouse:{target:[wh.x,4,wh.z-3],dist:90,pitch:1.02,yaw:-1.72},tanks:{target:[tank.x,4,tank.z],dist:63,pitch:1.02,yaw:-1.4}};
 const p=presets[mode]||presets.overall;camGoal.target.set(...p.target);camGoal.dist=p.dist;camGoal.pitch=p.pitch;camGoal.yaw=p.yaw;autoOrbit=false;exterior.auto=false;exRender();
}
function exSync(){
 const site=ctx.kind==='site';routeGroup.visible=site&&exterior.clean?false:v3.routes;document.body.classList.toggle('exterior-focus',site&&exterior.clean);document.getElementById('exToolbar').hidden=!site;
 if(exterior.groups.landscape)exterior.groups.landscape.visible=exterior.landscape;if(exterior.groups.context)exterior.groups.context.visible=exterior.context;
 siteGroup.traverse(o=>{if(o.userData.exLabel)o.visible=exterior.labels;});
 document.querySelector('#precision h2').textContent=site?'工場の外観を、立体で確かめる。':'設備のつながりを、見える形に。';exLight();
 if(precisionState.tab==='exterior')exRender();
}
function exExport(){return {version:1,light:exterior.light,labels:exterior.labels,landscape:exterior.landscape,context:exterior.context,clean:exterior.clean,gateOpen:exterior.gateOpen};}
function exImport(p){if(!p||p.version!==1)return;if(['day','late','dusk'].includes(p.light))exterior.light=p.light;for(const k of ['labels','landscape','context','clean','gateOpen'])if(typeof p[k]==='boolean')exterior[k]=p[k];}
function exRender(){
 pBody.innerHTML=`<div id="v3Chapter">EXTERIOR / 4.1</div><h3 style="font-size:18px;margin:8px 0">加須工場・外観</h3><div class="v3-stage">建屋ごとの外壁、荷捌き口、屋外タンクと敷地の表情を確認できます。建屋をダブルクリックすると内部へ移動します。</div><div class="p-grid">${[['overall','敷地全景'],['gate','正門・受付'],['warehouse','出荷倉庫'],['tanks','屋外タンク']].map(([id,label])=>`<button class="btn" data-ex-cam="${id}">${label}</button>`).join('')}</div><label class="p-muted">光の設定<select id="exSun" aria-label="外観の光"><option value="day" ${exterior.light==='day'?'selected':''}>昼 / 質感を確認</option><option value="late" ${exterior.light==='late'?'selected':''}>午後 / 陰影を確認</option><option value="dusk" ${exterior.light==='dusk'?'selected':''}>夕景 / 灯りを確認</option></select></label>${[['labels','建屋名を重ねる'],['landscape','植栽を表示'],['context','周辺の参考建物を表示'],['clean','外観を広く表示'],['gateOpen','正門ゲートを開く']].map(([k,v])=>`<label class="v3-layer">${v}<input type="checkbox" data-ex-flag="${k}" ${exterior[k]?'checked':''}></label>`).join('')}<div class="p-actions"><button class="btn" id="exOrbit">${autoOrbit?'自動回転を停止':'ゆっくり自動回転'}</button><button class="btn" id="exCapture">画像を保存</button></div><div class="p-note">既存の配置・建屋寸法を継承。外壁・屋根・受付・植栽などの細部は外観提案です。敷地外の建物はスケール参考で、実景の再現ではありません。</div><div class="p-muted">窓枠・外壁目地・折板屋根・雨樋・室外機・換気口・ドック庇・車止め・タンク梯子・フェンス・植栽を追加。外構は外観表現で、物流経路や占有判定には未反映です。</div>`;
 pBody.querySelectorAll('[data-ex-cam]').forEach(b=>b.onclick=()=>exCamera(b.dataset.exCam));document.getElementById('exSun').onchange=e=>{exterior.light=e.target.value;exLight();};pBody.querySelectorAll('[data-ex-flag]').forEach(el=>el.onchange=()=>{exterior[el.dataset.exFlag]=el.checked;if(el.dataset.exFlag==='gateOpen')exterior.gateArms.forEach(a=>a.rotation.z=exterior.gateOpen?1.35:0);exSync();dirtyShadow();});document.getElementById('exOrbit').onclick=()=>{autoOrbit=!autoOrbit;exterior.auto=autoOrbit;exRender();};document.getElementById('exCapture').onclick=()=>document.getElementById('shotBtn').click();
}
function exInit(){for(const [id,view] of [['exAll','overall'],['exGate','gate'],['exWh','warehouse'],['exTanks','tanks']])document.getElementById(id).onclick=()=>exCamera(view);document.getElementById('exSunset').onclick=()=>{exterior.light=exterior.light==='dusk'?'day':'dusk';exSync();};}

// ================= V3 spatial model =================
const v3={layers:{frame:true,walls:false,roof:false,mezzanine:true,zones:true},groups:{},obstacles:[],walk:false,walkPos:new THREE.Vector3(),keys:new Set(),section:null,sectionObject:null,sectionSpin:null,fill:.48,routes:true};
const V3_SECTION_TYPES=new Set(['TNK','KVT','DSP','PTK','MILL','FIL']);
function v3ExportView(){return {layers:{...v3.layers},routes:v3.routes};}
function v3ImportView(p){for(const k of Object.keys(v3.layers))if(typeof p?.layers?.[k]==='boolean')v3.layers[k]=p.layers[k];if(typeof p?.routes==='boolean')v3.routes=p.routes;}
function v3Migrate(data){
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('配置データが不正です');
 if(data.schemaVersion!=null&&![1,2,3,4].includes(data.schemaVersion))throw Error('未対応の配置バージョンです');
 if(data.schemaVersion>=3){if(data.units!=='m'||(data.precision&&data.precision.interiorPlanScale!==1))throw Error('v3はメートル座標の配置データに対応しています');return data;}
 // v1/v2 used 2.8x plan coordinates and uncalibrated drawing height.
 const converted=JSON.parse(JSON.stringify(data));
 for(const arr of Object.values(converted.interiors||{})){if(!Array.isArray(arr))throw Error('設備配列が不正です');for(const it of arr)for(const k of ['x','z','w','d','h','bw','bd'])if(it[k]!=null){if(!Number.isFinite(it[k]))throw Error('旧版の設備座標が不正です');it[k]/=LEGACY_SCALE;}}
 converted.schemaVersion=3;converted.units='m';if(converted.precision){converted.precision.version=3;converted.precision.interiorPlanScale=1;for(const arr of Object.values(converted.precision.assetAttributes||{})){if(!Array.isArray(arr))throw Error('設備属性が不正です');for(const a of arr){if(a.evidence==='measured')a.evidence='assumed';a.notes=String(a.notes||'')+'\n[v3移行] 旧版の寸法・描画高さを1/2.8に変換。高さを含め実測再確認が必要。';}}}
 return converted;
}
function v3ApplyLayers(){for(const [k,g] of Object.entries(v3.groups))g.visible=!!v3.layers[k];routeGroup.visible=v3.routes;dirtyShadow();}
function v3RenderSpace(){
 const site=ctx.kind==='site';pBody.innerHTML=`<div id="v3Chapter">SPATIAL MODEL / 03</div><h3 style="font-size:17px;margin:7px 0">${pe(ctx.label)}</h3><div class="v3-stage">${site?'建屋を選ぶと構造・設備・作業者視点を切り替えられます。':'柱・梁・床面区画を重ねながら、設備の配置と内部構造を確認します。'}</div><div class="p-grid"><div><span class="p-muted">東西 × 南北</span><br><b>${ctx.W.toFixed(1)} × ${ctx.D.toFixed(1)} m</b></div><div><span class="p-muted">${site?'要素数':'建屋高さ（推定）'}</span><br><b>${site?ctx.items.length:currentBuilding.h.toFixed(1)+' m'}</b></div></div><div class="p-muted">建屋レイヤー</div>${[['frame','柱・梁・屋根トラス'],['walls','外壁・窓・開口'],['roof','屋根・採光帯'],['mezzanine','点検デッキ・階段'],['zones','工程区画・歩行帯']].map(([k,label])=>`<label class="v3-layer">${label}<input type="checkbox" data-v3-layer="${k}" ${v3.layers[k]?'checked':''} ${site?'disabled':''}></label>`).join('')}<label class="v3-layer">物流経路<input type="checkbox" id="v3Routes" ${v3.routes?'checked':''}></label><div class="p-actions"><button id="v3OpenCut" class="btn" ${site?'disabled':''}>内部を見渡す</button><button id="v3ShowShell" class="btn" ${site?'disabled':''}>外郭を表示</button></div><div class="p-actions"><button id="v3WalkPanel" class="btn" ${site?'disabled':''}>${v3.walk?'俯瞰へ戻る':'作業者の目線へ'}</button></div><div class="p-note">寸法・構造・歩行帯は既存配置をもとにした仮説モデル。点検デッキと階段は追加提案です。現場図面で更新してください。</div><details><summary>v3の操作と確認範囲</summary><p class="p-muted">設備台帳でタンク・ミル・充填機を選び「断面表示」で内部へ。作業者視点ではWASDまたは矢印で移動、←→で旋回、ドラッグで視線変更。Escで俯瞰へ戻ります。床面の設備・柱・階段との簡易接触を考慮します。階段昇降、車両旋回、避難判定は含みません。移動した配置は「配置を書出」で保存できます。</p></details>`;
 pBody.querySelectorAll('[data-v3-layer]').forEach(el=>el.onchange=()=>{v3.layers[el.dataset.v3Layer]=el.checked;v3ApplyLayers();});document.getElementById('v3Routes').onchange=e=>{v3.routes=e.target.checked;v3ApplyLayers();};
 document.getElementById('v3OpenCut').onclick=()=>{v3.layers.walls=false;v3.layers.roof=false;v3ApplyLayers();v3Overview();pRender();};document.getElementById('v3ShowShell').onclick=()=>{v3.layers.walls=true;v3.layers.roof=true;v3ApplyLayers();v3Overview();pRender();};document.getElementById('v3WalkPanel').onclick=()=>v3ToggleWalk();
}
function v3Overview(){v3StopWalk();v3ClearSection();camGoal.target.set(0,2,0);setCam('iso');v3Sync();}
function v3CanWalk(x,z){
 const radius=.28;if(Math.abs(x)>ctx.W/2-radius-.1||Math.abs(z)>ctx.D/2-radius-.1)return false;
 const obstacles=[...ctx.items.filter(it=>!it.noOcc&&!['IN','OUT'].includes(it.proc)),...v3.obstacles.filter(o=>!o.layer||v3.layers[o.layer])];
 return !obstacles.some(it=>Math.abs(x-it.x)<it.w/2+radius&&Math.abs(z-it.z)<it.d/2+radius);
}
function v3ToggleWalk(){
 if(v3.walk){v3Overview();pRender();return;}if(ctx.kind!=='interior')return;
 let start=null;for(let z=-ctx.D/2+2;z<ctx.D/2-2;z+=1){if(v3CanWalk(ctx.W*.4,z)){start=[ctx.W*.4,z];break;}}
 if(!start){toast('歩行の開始位置を確保できません。設備配置を確認してください');return;}
 v3ClearSection();select(null);v3.walk=true;v3.keys.clear();v3.walkPos.set(start[0],1.65,start[1]);camGoal.yaw=Math.PI/2;camGoal.pitch=1.45;
 v3.layers.walls=true;v3ApplyLayers();document.body.classList.add('v3-walk');v3Sync();pRender();toast('作業者視点：WASDで移動・ドラッグで視線・Escで俯瞰');
}
function v3StopWalk(){v3.walk=false;v3.keys.clear();document.body.classList.remove('v3-walk');document.getElementById('v3Walk').classList.remove('on');document.getElementById('v3BarLabel').textContent='1 unit = 1 m · 推定モデル';}
function v3ApplyWalk(){
 camera.position.copy(v3.walkPos);const vertical=Math.cos(Math.max(.2,Math.min(2.7,camGoal.pitch)));camera.lookAt(v3.walkPos.x+Math.cos(camGoal.yaw),v3.walkPos.y+vertical,v3.walkPos.z+Math.sin(camGoal.yaw));
}
function v3Tick(dt){
 if(v3.sectionSpin&&playing)v3.sectionSpin.rotation.y+=dt*1.1;
 if(!v3.walk)return;const k=v3.keys;
 if(k.has('ArrowLeft'))camGoal.yaw-=dt*1.25;if(k.has('ArrowRight'))camGoal.yaw+=dt*1.25;
 let f=(k.has('KeyW')||k.has('ArrowUp')?1:0)-(k.has('KeyS')||k.has('ArrowDown')?1:0),side=(k.has('KeyD')?1:0)-(k.has('KeyA')?1:0);const norm=Math.hypot(f,side)||1,speed=1.4*dt;
 const dx=(Math.cos(camGoal.yaw)*f-Math.sin(camGoal.yaw)*side)*speed/norm,dz=(Math.sin(camGoal.yaw)*f+Math.cos(camGoal.yaw)*side)*speed/norm;
 if(v3CanWalk(v3.walkPos.x+dx,v3.walkPos.z))v3.walkPos.x+=dx;if(v3CanWalk(v3.walkPos.x,v3.walkPos.z+dz))v3.walkPos.z+=dz;
}
function v3ClearSection(){
 if(v3.sectionObject){const base=v3.sectionObject.userData.v3Base;if(base)base.visible=true;const cut=v3.sectionObject.userData.v3Cut;if(cut){clearGroup(cut);v3.sectionObject.remove(cut);delete v3.sectionObject.userData.v3Cut;}}
 v3.section=null;v3.sectionObject=null;v3.sectionSpin=null;document.body.classList.remove('v3-section');document.getElementById('v3SectionCard').hidden=true;dirtyShadow();
}
function v3MakeSection(it){
 const g=new THREE.Group(),w=it.bw??it.w,d=it.bd??it.d,h=it.h;
 const steel=new THREE.MeshStandardMaterial({color:0xb0c6c9,roughness:.28,metalness:.6,side:THREE.DoubleSide});const liquid=new THREE.MeshStandardMaterial({color:0x37baa6,roughness:.30,metalness:.1,transparent:true,opacity:.76,side:THREE.DoubleSide});
 const add=(geo,mat,x,y,z)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);g.add(o);return o;};
 const r=Math.min(w,d)*.43;
 if(['TNK','KVT','DSP','PTK'].includes(it.proc)){
  const bottom=h*.14,bodyH=h*.64;
  add(new THREE.CylinderGeometry(r,r,bodyH,48,1,true,Math.PI/2,Math.PI),steel,0,bottom+bodyH/2,0);
  add(new THREE.CylinderGeometry(r,r,.045,48),steel,0,bottom,0);
  const jacket=add(new THREE.CylinderGeometry(r*1.07,r*1.07,bodyH*.8,48,1,true,Math.PI/2,Math.PI),new THREE.MeshStandardMaterial({color:0x397b91,transparent:true,opacity:.34,side:THREE.DoubleSide,metalness:.4}),0,bottom+bodyH/2,0);
  const fluidH=Math.max(.015,bodyH*v3.fill);add(new THREE.CylinderGeometry(r*.94,r*.94,fluidH,40),liquid,0,bottom+fluidH/2,0);
  v3Beam(g,[0,bottom+.08,0],[0,h*.86,0],.035,0xd5dfd9);
  const impeller=new THREE.Group();g.add(impeller);v3.sectionSpin=impeller;
  for(const y of [bottom+bodyH*.24,bottom+bodyH*.56])for(let j=0;j<4;j++){const a=j*Math.PI/2;const blade=v3Box(impeller,r*.56,.045,r*.16,Math.cos(a)*r*.36,y,Math.sin(a)*r*.36,0x91aab3);blade.rotation.y=-a;blade.rotation.z=.2;}
  for(const sign of [-1,1])v3Box(g,.045,bodyH*.80,r*.13,sign*r*.79,bottom+bodyH*.48,-r*.38,0x83a0ac);
  v3Box(g,r*.65,h*.12,r*.65,0,h*.90,0,0x536f70);
  for(const x of [-r,r])v3Beam(g,[x,bottom,0],[x,bottom+bodyH,0],.024,0xe2b94a);
  v3Beam(g,[0,bottom+.08,r*.2],[0,bottom+.08,d*.52],.04,0xa9c5ce);
 }else if(it.proc==='MILL'){
  v3Box(g,w*.9,h*.13,d*.9,0,h*.065,0,0x59796b);
  const cr=Math.min(d*.34,h*.26);const shell=add(new THREE.CylinderGeometry(cr,cr,w*.62,40,1,true,0,Math.PI),steel,0,h*.5,0);shell.rotation.z=Math.PI/2;
  const shaft=v3Beam(g,[-w*.39,h*.5,0],[w*.4,h*.5,0],.04);const discs=new THREE.Group();g.add(discs);
  for(let i=0;i<6;i++){const rotor=add(new THREE.CylinderGeometry(cr*.75,cr*.75,.035,24),steel,-w*.22+i*w*.08,h*.5,0);rotor.rotation.z=Math.PI/2;}
  const rng=sRand('mill-section');for(let i=0;i<36;i++){const a=rng()*Math.PI*2,rad=cr*.82*Math.sqrt(rng());add(new THREE.SphereGeometry(cr*.055,6,5),liquid,(rng()-.5)*w*.52,h*.5+Math.cos(a)*rad,Math.sin(a)*rad);}
  v3Box(g,w*.20,h*.34,d*.55,w*.37,h*.50,0,0x59796b);
 }else{
  v3Box(g,w*.95,.09,d*.82,0,h*.38,0,0x657e85);
  for(let i=0;i<12;i++)v3Beam(g,[-w*.43+i*w*.078,h*.44,-d*.30],[-w*.43+i*w*.078,h*.44,d*.30],d*.04);
  v3Beam(g,[-w*.32,h*.83,0],[w*.30,h*.83,0],.04,0x48b2c0);
  for(let i=0;i<3;i++){const x=-w*.22+i*w*.22;v3Beam(g,[x,h*.83,0],[x,h*.61,0],.023,0xd2dddd);const can=add(new THREE.CylinderGeometry(d*.12,d*.12,h*.17,16,1,true),steel,x,h*.54,0);add(new THREE.CylinderGeometry(d*.11,d*.11,h*.12,16),liquid,x,h*.515,0);}
 }
 return g;
}
function v3ToggleSection(){
 if(v3.section){v3ClearSection();v3Sync();return;}if(!selected||ctx.kind!=='interior'||!V3_SECTION_TYPES.has(selected.proc))return;
 v3StopWalk();const it=selected;const cut=v3MakeSection(it);it.mesh.userData.v3Base.visible=false;it.mesh.add(cut);it.mesh.userData.v3Cut=cut;v3.section=it;v3.sectionObject=it.mesh;applyShadows(cut);
 camGoal.target.set(it.x,it.h*.5,it.z);camGoal.dist=Math.max(it.w,it.d,it.h)*2.7+1;camGoal.pitch=1.05;camGoal.yaw=.8-(it.rot||0)*Math.PI/2;
 document.body.classList.add('v3-section');const tank=['TNK','KVT','DSP','PTK'].includes(it.proc),card=document.getElementById('v3SectionCard');card.hidden=false;
 card.innerHTML=`<span class="p-chip">EQUIPMENT SECTION</span><h3>${pe(it.name)}</h3><div class="p-muted">内部構造の説明モデル</div><ol>${(tank?['外槽と冷却ジャケット','中央攪拌軸・二段羽根','邪魔板・底部排出口']:it.proc==='MILL'?['分散室の半割断面','回転ディスク・分散媒体','駆動部・シャフト']:['供給ヘッダー・充填ノズル','缶と充填部','搬送ローラー']).map(t=>'<li>'+t+'</li>').join('')}</ol>${tank?`<label>液面 <b id="v3FillValue">${Math.round(v3.fill*100)}</b>%（説明用）<input id="v3Fill" aria-label="断面の液面" type="range" min="5" max="90" value="${Math.round(v3.fill*100)}"></label>`:''}<div class="p-note">内部仕様は機構説明用の仮説です。実機のメーカー仕様や製造図面を再現したものではありません。</div><button id="v3CloseSection" class="btn">断面を閉じる</button>`;
 document.getElementById('v3CloseSection').onclick=()=>{v3ClearSection();v3Sync();};if(tank)document.getElementById('v3Fill').oninput=e=>{v3.fill=+e.target.value/100;const prev=it.mesh.userData.v3Cut;clearGroup(prev);it.mesh.remove(prev);const next=v3MakeSection(it);it.mesh.userData.v3Cut=next;it.mesh.add(next);applyShadows(next);document.getElementById('v3FillValue').textContent=e.target.value;dirtyShadow();};v3Sync();
}
function v3Sync(){
 if(v3.section&&(!selected||v3.section!==selected||v3.sectionObject!==selected.mesh))v3ClearSection();
 v3ApplyLayers();document.getElementById('v3Walk').disabled=ctx.kind==='site';document.getElementById('v3Walk').classList.toggle('on',v3.walk);
 const b=document.getElementById('v3Section');b.disabled=!selected||ctx.kind!=='interior'||!V3_SECTION_TYPES.has(selected.proc);b.classList.toggle('on',!!v3.section);
 document.getElementById('v3BarLabel').textContent=v3.walk?'目線 1.65 m · WASD 移動 / ←→ 旋回 / Esc 戻る':'1 unit = 1 m · 推定モデル';
}
function v3InitUI(){
 document.getElementById('v3Overview').onclick=v3Overview;document.getElementById('v3Walk').onclick=v3ToggleWalk;document.getElementById('v3Section').onclick=v3ToggleSection;
 addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.target.isContentEditable)return;if(v3.walk){if(e.code==='Escape'){v3Overview();pRender();}else if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){v3.keys.add(e.code);e.preventDefault();}}});addEventListener('keyup',e=>v3.keys.delete(e.code));addEventListener('blur',()=>v3.keys.clear());
}

// ================= V4 connected equipment / reachability =================
const v4={records:{},tab:'pipes',showPipes:true,showPorts:true,showService:false,selectedLink:null,pipeResults:[],serviceResults:[],seq:0};
const v4Group=new THREE.Group();scene.add(v4Group);
const V4_PROCESS=new Set(['MILL','DSP','TNK','KVT','PTK','FIL']);
const V4_SYSTEMS={PR:{label:'製品・原料',color:0x59d6cc},HV:{label:'冷却水',color:0x6ba7ee},CA:{label:'圧縮空気',color:0xdbc673},EL:{label:'電源',color:0xc190db},EA:{label:'排気',color:0xec8f85}};
function v4Ports(it){
 if(!V4_PROCESS.has(it.proc))return [];
 return [{id:'feed',sys:'PR',dir:'in',label:'原料入口',p:[0,.8,-.5]},{id:'out',sys:'PR',dir:'out',label:'製品出口',p:[0,.25,.5]},
 {id:'cw-in',sys:'HV',dir:'in',label:'冷却水入口',p:[-.5,.48,0]},{id:'cw-out',sys:'HV',dir:'out',label:'冷却水戻り',p:[-.5,.72,.15]},
 {id:'power',sys:'EL',dir:'in',label:'電源接続',p:[.5,.65,0]},...(it.proc==='FIL'?[{id:'air',sys:'CA',dir:'in',label:'空気入口',p:[.5,.8,-.25]}]:[{id:'vent',sys:'EA',dir:'out',label:'排気口',p:[0,1,0]}])];
}
function v4Point(it,port){const w=it.bw??it.w,d=it.bd??it.d,a=-(it.rot||0)*Math.PI/2;let x=port.p[0]*w,z=port.p[2]*d;if(Math.abs(port.p[0])===.5)x+=Math.sign(x)*.08;if(Math.abs(port.p[2])===.5)z+=Math.sign(z)*.08;return new THREE.Vector3(it.x+Math.cos(a)*x+Math.sin(a)*z,port.p[1]*it.h,it.z-Math.sin(a)*x+Math.cos(a)*z);}
function v4PipePath(c,link){
 const a=c.items.find(i=>i.assetId===link.from.assetId),b=c.items.find(i=>i.assetId===link.to.assetId);if(!a||!b)return {error:'接続先設備がありません'};
 const ap=v4Ports(a).find(p=>p.id===link.from.portId),bp=v4Ports(b).find(p=>p.id===link.to.portId);if(!ap||!bp)return {error:'接続口がありません'};
 if(ap.dir!=='out'||bp.dir!=='in'||ap.sys!==bp.sys||a===b)return {error:'接続口の系統・方向が不整合'};
 const p=v4Point(a,ap),q=v4Point(b,bp),y=link.height;
 if(!Number.isFinite(y)||y<Math.max(p.y,q.y)+.1)return {error:'配管高さが接続口より低い'};
 const pts=[p,new THREE.Vector3(p.x,y,p.z),new THREE.Vector3(q.x,y,p.z),new THREE.Vector3(q.x,y,q.z),q].filter((v,i,arr)=>i===0||v.distanceTo(arr[i-1])>.0001);
 let len=0;for(let i=1;i<pts.length;i++)len+=pts[i].distanceTo(pts[i-1]);return {a,b,ap,bp,pts,len,sys:ap.sys};
}
function v4Ensure(c){
 ensureAssetIds(c);if(v4.records[c.id])return v4.records[c.id];
 const b=siteCtx.items.find(i=>i.id===c.id),r={vehicle:c.drawing?{width:.6,margin:.10}:{width:1.2,margin:.20},links:[],services:{}};v4.records[c.id]=r;
 if(c.kind==='interior'&&!c.drawing)for(const [fk,tk] of c.flows){if(!V4_PROCESS.has(fk)||!V4_PROCESS.has(tk)||fk===tk)continue;const a=c.items.filter(i=>i.proc===fk),d=c.items.filter(i=>i.proc===tk);for(let j=0;j<Math.max(a.length,d.length);j++){if(!a.length||!d.length)continue;const link={id:c.id+'-L'+String(r.links.length+1).padStart(3,'0'),from:{assetId:a[j%a.length].assetId,portId:'out'},to:{assetId:d[j%d.length].assetId,portId:'feed'},height:Math.max((b?.h||8)*.65,a[j%a.length].h+1,d[j%d.length].h+1),enabled:true,installedLength:null};const p=v4PipePath(c,link);if(!p.error)link.installedLength=p.len;r.links.push(link);}}
 return r;
}
function v4Structural(c){
 const b=siteCtx.items.find(i=>i.id===c.id);if(!b)return [];
 if(c.drawing)return c.drawing.obstacles;
 const out=[],n=Math.max(3,Math.ceil(c.D/7));for(let i=0;i<=n;i++)for(const sign of [-1,1])out.push({x:sign*(c.W/2-.3),z:-c.D/2+i*c.D/n,w:.62,d:.62,h:b.h,name:'柱'});
 if(['paint','varnish'].includes(b.proc)){const mh=Math.min(3.6,b.h*.35),mw=2.8,md=Math.min(12,c.D*.24),mx=-c.W/2+mw/2+.4,steps=Math.ceil(mh/.18);for(const z of [-md/2,md/2])for(const x of [mx-mw/2+.15,mx+mw/2-.15])out.push({x,z,w:.3,d:.3,h:mh,name:'デッキ支柱'});out.push({x:mx,z:md/2+steps*.25/2,w:1.4,d:steps*.25,h:mh,name:'階段'});}
 return out;
}
function v4NavGrid(c,width,margin){
 const cell=.4,cols=Math.ceil(c.W/cell),rows=Math.ceil(c.D/cell),pad=width/2+margin,occ=new Uint8Array(cols*rows);
 const obstacles=[...c.items.filter(i=>!i.noOcc&&!['IN','OUT'].includes(i.proc)),...v4Structural(c)];
 for(let r=0;r<rows;r++)for(let k=0;k<cols;k++){const x=-c.W/2+(k+.5)*cell,z=-c.D/2+(r+.5)*cell;let blocked=Math.abs(x)+pad+cell/2>c.W/2||Math.abs(z)+pad+cell/2>c.D/2;
 if(!blocked)blocked=obstacles.some(o=>Math.abs(x-o.x)<o.w/2+pad+cell/2&&Math.abs(z-o.z)<o.d/2+pad+cell/2);occ[r*cols+k]=blocked?1:0;}
 return {W:c.W,D:c.D,cell,cols,rows,occ,pad};
}
function v4Access(g,it){
 const points=[];const gap=g.pad+g.cell*1.5;
 for(const [x,z] of [[it.x-it.w/2-gap,it.z],[it.x+it.w/2+gap,it.z],[it.x,it.z-it.d/2-gap],[it.x,it.z+it.d/2+gap]]){
  const col=Math.floor((x+g.W/2)/g.cell),row=Math.floor((z+g.D/2)/g.cell);if(col<0||row<0||col>=g.cols||row>=g.rows)continue;const id=row*g.cols+col;if(!g.occ[id])points.push(id);
 }
 if(!points.length){const c0=Math.floor((it.x+g.W/2)/g.cell),r0=Math.floor((it.z+g.D/2)/g.cell);for(let rad=1;rad<12&&!points.length;rad++)for(let dc=-rad;dc<=rad;dc++)for(let dr=-rad;dr<=rad;dr++){if(Math.max(Math.abs(dc),Math.abs(dr))!==rad)continue;const col=c0+dc,row=r0+dr;if(col<0||row<0||col>=g.cols||row>=g.rows)continue;const id=row*g.cols+col;if(!g.occ[id])points.push(id);}}
 return points;
}
function v4Search(g,starts,ends){
 if(!starts.length||!ends.length)return null;
 const N=g.cols*g.rows,dist=new Float32Array(N).fill(Infinity),from=new Int32Array(N).fill(-1),closed=new Uint8Array(N),goals=new Set(ends),heap=new MinHeap();
 const h=i=>Math.min(...ends.map(e=>Math.abs(i%g.cols-e%g.cols)+Math.abs(Math.floor(i/g.cols)-Math.floor(e/g.cols))));
 starts.forEach(i=>{dist[i]=0;heap.push(i,h(i));});
 while(heap.size){let u=heap.pop();if(closed[u])continue;closed[u]=1;if(goals.has(u)){const path=[];while(u>=0){path.push({x:-g.W/2+(u%g.cols+.5)*g.cell,z:-g.D/2+(Math.floor(u/g.cols)+.5)*g.cell});u=from[u];}return path.reverse();}
  const col=u%g.cols,row=Math.floor(u/g.cols);for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=col+dc,z=row+dr;if(x<0||z<0||x>=g.cols||z>=g.rows)continue;const v=z*g.cols+x;if(g.occ[v]||closed[v])continue;const next=dist[u]+1;if(next<dist[v]){dist[v]=next;from[v]=u;heap.push(v,next+h(v));}}
 }return null;
}
function v4Compute(c){
 const rec=v4Ensure(c),g=v4NavGrid(c,rec.vehicle.width,rec.vehicle.margin);c.cols=g.cols;c.rows=g.rows;c.occ=g.occ;c.cell=g.cell;c.routes=[];c.pipeTransfers=[];
 for(const [fk,tk,reps,fline] of c.flows){const a=flowEnds(c,fk),b=flowEnds(c,tk),n=Math.max(a.length,b.length,1);for(let j=0;j<n;j++){
  const src=a[j%a.length],dst=b[j%b.length];const pipe=src&&dst?rec.links.find(l=>l.enabled&&l.from.assetId===src.assetId&&l.to.assetId===dst.assetId&&l.from.portId==='out'&&l.to.portId==='feed'):null;if(pipe){const p=v4PipePath(c,pipe);c.pipeTransfers.push({fromId:src.assetId,toId:dst.assetId,reps:reps/n,linkId:pipe.id,error:p.error||null,len:p.len??null});continue;}let pts=src&&dst?v4Search(g,v4Access(g,src),v4Access(g,dst)):null;
  const blocked=!pts;pts=pts||[];if(pts.length===1)pts.push({...pts[0],x:pts[0].x+.00001});let len=0;for(let k=1;k<pts.length;k++)len+=Math.hypot(pts[k].x-pts[k-1].x,pts[k].z-pts[k-1].z);
  c.routes.push({line:fline||null,fk,tk,reps:reps/n,fromId:src?.assetId,toId:dst?.assetId,fromName:src?.name||fk,toName:dst?.name||tk,pts,len,modelLen:len,blocked,color:src?.color??0x66dcc7});
 }}
 let total=0,longest=0,blocked=0,blockedReps=0;for(const r of c.routes){if(r.blocked){blocked++;blockedReps+=r.reps;}else{total+=r.len*r.reps*2;longest=Math.max(longest,r.len);}}
 // Shared grid cells form encounter candidates; this is not a traffic collision prediction.
 const used=new Map();c.routes.forEach((r,ri)=>r.pts.forEach(p=>{const key=p.x.toFixed(2)+','+p.z.toFixed(2);if(!used.has(key))used.set(key,new Set());used.get(key).add(ri);}));
 const crossings=[...used.values()].filter(v=>v.size>1).length;
 c.m={total:Math.round(total),longest:Math.round(longest),crossings,hours:total/SPEED.interior,blocked,blockedReps,objective:total+blockedReps*1000000};return c.m;
}
function v4Curve(points){const c=new THREE.CurvePath();for(let i=1;i<points.length;i++)c.add(new THREE.LineCurve3(points[i-1],points[i]));return c;}
function v4BoxFor(it){return new THREE.Box3(new THREE.Vector3(it.x-it.w/2,it.y||0,it.z-it.d/2),new THREE.Vector3(it.x+it.w/2,(it.y||0)+it.h,it.z+it.d/2));}
function v4SegmentBox(a,b,pad=.04){return new THREE.Box3().setFromPoints([a,b]).expandByScalar(pad);}
function v4Obstacles(c){const objects=[...c.items.filter(i=>!i.noOcc).map(it=>({id:it.assetId,name:it.name,box:v4BoxFor(it)})),...v4Structural(c).map(it=>({name:it.name,box:v4BoxFor(it)}))];
 if(c===ctx&&ctx.kind==='interior'){intGroup.updateMatrixWorld(true);for(const k of ['frame','roof','mezzanine'])v3.groups[k]?.traverse(o=>{if(o.isMesh)objects.push({name:k==='frame'?'柱・梁・トラス':k==='roof'?'屋根':'点検デッキ',box:new THREE.Box3().setFromObject(o)});});}return objects;
}
function v4EvaluatePipes(c){const r=v4Ensure(c),obstacles=v4Obstacles(c);return r.links.map(link=>{const p=v4PipePath(c,link),issues=[];if(p.error)issues.push(p.error);else if(link.enabled){for(const o of obstacles){if([p.a.assetId,p.b.assetId].includes(o.id))continue;for(let i=1;i<p.pts.length;i++)if(v4SegmentBox(p.pts[i-1],p.pts[i]).intersectsBox(o.box)){issues.push('干渉候補: '+o.name);break;}}if(link.installedLength!=null&&p.len>link.installedLength+.05)issues.push('基準長に対し '+(p.len-link.installedLength).toFixed(2)+' m不足');}return {...p,link,issues:[...new Set(issues)]};});}
function v4ServiceDefault(it){return {mode:'work',side:'front',depth:it.proc==='MILL'?1.5:1.0,width:Math.max(.8,Math.min(it.bw??it.w,1.5)),height:1.8};}
function v4ServiceBox(it,cfg){
 const w=it.bw??it.w,d=it.bd??it.d,a=-(it.rot||0)*Math.PI/2;
 if(cfg.mode==='lift')return new THREE.Box3(new THREE.Vector3(it.x-it.w/2,it.h+.04,it.z-it.d/2),new THREE.Vector3(it.x+it.w/2,it.h+.04+cfg.height,it.z+it.d/2));
 const sides={front:[0,d/2+cfg.depth/2+.02,cfg.width,cfg.depth],back:[0,-d/2-cfg.depth/2-.02,cfg.width,cfg.depth],left:[-w/2-cfg.depth/2-.02,0,cfg.depth,cfg.width],right:[w/2+cfg.depth/2+.02,0,cfg.depth,cfg.width]};const [x,z,ww,dd]=sides[cfg.side];
 const points=[];for(const sx of [-1,1])for(const sz of [-1,1]){const lx=x+sx*ww/2,lz=z+sz*dd/2;points.push(new THREE.Vector3(it.x+Math.cos(a)*lx+Math.sin(a)*lz,.04,it.z-Math.sin(a)*lx+Math.cos(a)*lz));}const box=new THREE.Box3().setFromPoints(points);box.max.y=cfg.height;return box;
}
function v4ServiceResults(c){const r=v4Ensure(c),obstacles=v4Obstacles(c);return c.items.filter(it=>V4_PROCESS.has(it.proc)).map(it=>{const cfg=r.services[it.assetId]||v4ServiceDefault(it),box=v4ServiceBox(it,cfg),issues=[];for(const o of obstacles){if(o.id===it.assetId)continue;if(box.intersectsBox(o.box))issues.push(o.name);}if(box.min.x<-c.W/2||box.max.x>c.W/2||box.min.z<-c.D/2||box.max.z>c.D/2)issues.push('建屋外周');for(const pipe of v4.pipeResults){if(pipe.error||!pipe.link.enabled)continue;for(let k=1;k<pipe.pts.length;k++)if(box.intersectsBox(v4SegmentBox(pipe.pts[k-1],pipe.pts[k]))){issues.push('配管 '+pipe.link.id);break;}}return {it,cfg,box,issues:[...new Set(issues)]};});}
function v4Draw(){
 clearGroup(v4Group);if(ctx.kind!=='interior')return;
 if(v4.showPorts)for(const it of ctx.items){if(selected&&selected!==it)continue;for(const p of v4Ports(it)){const m=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),new THREE.MeshBasicMaterial({color:V4_SYSTEMS[p.sys].color}));m.position.copy(v4Point(it,p));v4Group.add(m);}}
 if(v4.showPipes)for(const p of v4.pipeResults){if(p.error||!p.link.enabled)continue;const col=p.issues.length?0xe8a359:V4_SYSTEMS[p.sys].color;const focus=p.link.id===v4.selectedLink;const curve=v4Curve(p.pts);const m=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(24,p.pts.length*8),focus ? .075 : .04,8,false),new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:focus ? .5 : .12,metalness:.5,roughness:.4}));v4Group.add(m);
  if(focus){const label=makeLabel(p.link.id+' / '+p.len.toFixed(1)+' m',.10,p.issues.length?'#f0bb6e':'#76dece');label.position.copy(p.pts[2]).add(new THREE.Vector3(0,.35,0));v4Group.add(label);}
 }
 if(v4.showService&&selected){const r=v4.serviceResults.find(s=>s.it===selected);if(r){const col=r.issues.length?0xe8a359:0x66dcc7;const size=r.box.getSize(new THREE.Vector3()),mid=r.box.getCenter(new THREE.Vector3());const m=new THREE.Mesh(new THREE.BoxGeometry(size.x,size.y,size.z),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.10,depthWrite:false}));m.position.copy(mid);v4Group.add(m);const wire=new THREE.Box3Helper(r.box,col);v4Group.add(wire);}}
}
function v4Sync(){if(ctx.kind==='interior'){v4.pipeResults=v4EvaluatePipes(ctx);v4.serviceResults=v4ServiceResults(ctx);}else{v4.pipeResults=[];v4.serviceResults=[];}v4Draw();const n=document.getElementById('v4Status');n.textContent=ctx.kind==='interior'?`到達不可 ${ctx.m.blocked||0}件 / 配管確認 ${v4.pipeResults.filter(p=>p.issues.length).length}件`:'敷地全体の物流は従来の概算モデル';if(precisionState.tab==='engineering')v4Render();}
function v4Export(){return {version:1,records:JSON.parse(JSON.stringify(v4.records))};}
function v4Validate(data){if(!data.v4)return;const p=data.v4;if(p.version!==1||!p.records||Array.isArray(p.records)||typeof p.records!=='object')throw Error('v4接続データが不正です');
 for(const [id,r] of Object.entries(p.records)){if(!interiorCtxs.has(id)&&id!=='site')throw Error('v4建屋IDが不正です');if(!r.vehicle||!Number.isFinite(r.vehicle.width)||r.vehicle.width<.4||r.vehicle.width>4||!Number.isFinite(r.vehicle.margin)||r.vehicle.margin<0||r.vehicle.margin>1.5)throw Error('車両条件が範囲外です');if(!Array.isArray(r.links)||r.links.length>500)throw Error('接続配列が不正です');const ids=new Set();for(const l of r.links){if(typeof l.id!=='string'||ids.has(l.id)||!l.from||!l.to||typeof l.from.assetId!=='string'||typeof l.to.assetId!=='string'||typeof l.from.portId!=='string'||typeof l.to.portId!=='string'||typeof l.enabled!=='boolean'||!Number.isFinite(l.height)||l.height<.5||l.height>30||(l.installedLength!==null&&(!Number.isFinite(l.installedLength)||l.installedLength<0||l.installedLength>10000)))throw Error('接続属性が不正です');ids.add(l.id);}if(!r.services||Array.isArray(r.services)||typeof r.services!=='object')throw Error('保守設定が不正です');for(const a of Object.values(r.services)){if(!['work','panel','pull','lift'].includes(a.mode)||!['front','back','left','right'].includes(a.side)||!['depth','width','height'].every(k=>Number.isFinite(a[k])&&a[k]>=.2&&a[k]<=10))throw Error('保守空間の設定が不正です');}}
}
function v4Import(data){v4.records=data.v4?JSON.parse(JSON.stringify(data.v4.records)):{};v4.selectedLink=null;}

function v4ChooseAsset(id){const it=ctx.items.find(i=>i.assetId===id);if(!it)return;select(it);pSetTab('engineering');v4Sync();}
function v4FocusPipe(id){v4.selectedLink=id;const p=v4.pipeResults.find(p=>p.link.id===id);if(p&&!p.error){v3StopWalk();const box=new THREE.Box3().setFromPoints(p.pts);camGoal.target.copy(box.getCenter(new THREE.Vector3()));camGoal.dist=Math.max(10,box.getSize(new THREE.Vector3()).length()*1.8);camGoal.pitch=.95;}v4Draw();v4Render();}
function v4Render(){
 const site=ctx.kind==='site';const tabs=`<div class="v4-tabs">${[['pipes','配管接続'],['transport','搬送'],['service','保守作業']].map(([k,v])=>`<button class="btn ${v4.tab===k?'on':''}" data-v4-tab="${k}">${v}</button>`).join('')}</div>`;
 if(site){pBody.innerHTML=tabs+'<div class="p-note">v4の接続・車両幅・保守判定は建屋内部が対象です。上部の建屋選択から内部へ進んでください。</div>';return;}
 const r=v4Ensure(ctx),assetOptions=ctx.items.filter(i=>V4_PROCESS.has(i.proc)).map(i=>`<option value="${pe(i.assetId)}" ${selected===i?'selected':''}>${pe(i.name)}</option>`).join('');
 let body='';
 if(v4.tab==='pipes'){
 const bad=v4.pipeResults.filter(p=>p.issues.length).length;
 body=`<div class="p-kpis"><div><b>${r.links.length}</b><small>接続定義</small></div><div><b>${bad}</b><small>確認が必要</small></div><div><b>${v4.pipeResults.filter(p=>!p.error&&p.link.enabled).reduce((a,p)=>a+p.len,0).toFixed(0)}</b><small>仮配管延長 m</small></div></div><label class="v3-layer">配管を表示<input type="checkbox" id="v4PipeVis" ${v4.showPipes?'checked':''}></label><label class="v3-layer">接続口を表示<input type="checkbox" id="v4PortVis" ${v4.showPorts?'checked':''}></label><div class="p-note">工程順から作成した仮接続です。口位置・系統・配管高さを現場仕様と照合してください。背景のBIM配管とは別の検討用接続です。</div><details><summary>接続を追加</summary><form id="v4LinkForm"><label class="p-muted">供給設備<select name="fromAsset" id="v4FromAsset">${assetOptions}</select></label><label class="p-muted">供給口<select name="fromPort" id="v4FromPort"></select></label><label class="p-muted">受取設備<select name="toAsset" id="v4ToAsset">${assetOptions}</select></label><label class="p-muted">受取口<select name="toPort" id="v4ToPort"></select></label><label class="p-muted">架空配管高さ (m)<input name="height" type="number" step=".1" min=".5" max="30" value="${(currentBuilding.h*.7).toFixed(1)}" required></label><button class="btn on" style="margin-top:8px" type="submit">接続を追加</button></form></details><div id="v4Links">${v4.pipeResults.map(p=>`<button class="p-asset ${p.link.id===v4.selectedLink?'selected':''}" data-v4-link="${pe(p.link.id)}"><small>${pe(p.link.id)} · ${!p.link.enabled?'停止':p.issues.length?'要確認':'現在の条件で整合'}</small><strong>${pe(p.a?.name||p.link.from.assetId)} → ${pe(p.b?.name||p.link.to.assetId)}</strong><small>${p.error?pe(p.error):p.len.toFixed(2)+' m / '+pe(p.ap.label)+' → '+pe(p.bp.label)}</small></button>`).join('')}</div>`;
 const p=v4.pipeResults.find(p=>p.link.id===v4.selectedLink);if(p)body+=`<div class="v4-detail"><b>${pe(p.link.id)}</b><div class="p-muted">${p.link.installedLength==null?'基準長未登録':'登録基準長 '+p.link.installedLength.toFixed(2)+' m'} / 高さ ${p.link.height.toFixed(2)} m</div>${p.issues.length?'<ul>'+p.issues.map(x=>'<li>'+pe(x)+'</li>').join('')+'</ul>':'<p class="p-muted">現在の簡易判定では干渉・延長不足なし</p>'}<form id="v4HeightForm"><label class="p-muted">配管高さ (m)<input name="height" type="number" min=".5" max="30" step=".1" value="${p.link.height}" required></label><button class="btn" type="submit" style="margin-top:8px">配管高さを変更</button></form><div class="p-actions"><button id="v4SetLength" class="btn" ${p.error?'disabled':''}>現経路長を基準に</button><button id="v4ToggleLink" class="btn">${p.link.enabled?'接続を停止':'接続を有効化'}</button></div><div class="p-actions"><button id="v4RemoveLink" class="btn">接続定義を削除</button></div></div>`;
 }else if(v4.tab==='transport'){
 const blocked=ctx.routes.filter(p=>p.blocked);body=`<div class="p-kpis"><div><b>${ctx.routes.length}</b><small>設備間経路</small></div><div><b>${blocked.length}</b><small>到達不可</small></div><div><b>${ctx.m.total}</b><small>成立分 m/日</small></div></div><form id="v4VehicleForm"><div class="p-grid"><label>車両幅 (m)<input name="width" type="number" min=".4" max="4" step=".05" value="${r.vehicle.width}" required></label><label>片側余裕 (m)<input name="margin" type="number" min="0" max="1.5" step=".05" value="${r.vehicle.margin}" required></label></div><button class="btn on" type="submit">通行可能性を再計算</button></form><div class="v3-stage" style="margin-top:10px">判定幅 ${(r.vehicle.width+2*r.vehicle.margin).toFixed(2)} m<br>未到達の搬送 ${ctx.m.blockedReps.toFixed(1)}便/日<br>配管移送 ${ctx.pipeTransfers?.length||0}経路を搬送から分離<br>距離は成立した搬送経路のみの合計です。</div><div class="p-note">車両幅＋片側余裕で設備・柱・階段を拡張し、0.4 m格子で判定。出入口候補は設備の4面、便数は同工程の設備に均等配分する仮定です。有効な製品出口→原料入口の接続は配管移送と仮定し搬送距離から除外。接続停止時は搬送として再計算します。車長・旋回半径・対向待ちは未反映。</div><div class="p-actions"><button id="v4RouteVis" class="btn">${v3.routes?'動線を隠す':'動線を表示'}</button><button id="v4RouteCSV" class="btn">経路CSV</button></div>${ctx.routes.map((p,i)=>`<button class="p-asset" data-v4-route="${i}"><small style="color:${p.blocked?'#efb56c':'#87d5bf'}">${p.blocked?'到達不可':p.len.toFixed(1)+' m'} / ${p.reps.toFixed(1)}便/日</small><strong>${pe(p.fromName)} → ${pe(p.toName)}</strong></button>`).join('')}`;
 }else{
 const it=selected&&V4_PROCESS.has(selected.proc)?selected:null,s=it?v4.serviceResults.find(s=>s.it===it):null;
 body=`<label class="p-muted">対象設備<select id="v4ServiceAsset"><option value="">設備を選択</option>${assetOptions}</select></label><label class="v3-layer">作業空間を表示<input type="checkbox" id="v4ServiceVis" ${v4.showService?'checked':''}></label>`;
 if(s)body+=`<form id="v4ServiceForm"><div class="p-grid"><label>作業種類<select name="mode">${[['work','点検・作業'],['panel','盤扉の開放'],['pull','部品引き抜き'],['lift','上方の吊り上げ']].map(([k,v])=>`<option value="${k}" ${s.cfg.mode===k?'selected':''}>${v}</option>`).join('')}</select></label><label>機器の面<select name="side">${[['front','正面'],['back','背面'],['left','左側'],['right','右側']].map(([k,v])=>`<option value="${k}" ${s.cfg.side===k?'selected':''}>${v}</option>`).join('')}</select></label>${[['width','作業幅 (m)'],['depth','必要奥行 (m)'],['height','必要高さ (m)']].map(([k,l])=>`<label>${l}<input name="${k}" type="number" min=".2" max="10" step=".1" value="${s.cfg[k]}" required></label>`).join('')}</div><button class="btn on" type="submit">作業空間を更新</button></form><div class="v4-detail"><b>${s.issues.length?'干渉候補 '+s.issues.length+'件':'現在の条件では干渉候補なし'}</b>${s.issues.length?'<ul>'+s.issues.map(x=>'<li>'+pe(x)+'</li>').join('')+'</ul>':''}</div>`;
 body+='<div class="p-note">作業空間は仮寸法の矩形で判定します。機器の回転に追従します。吊り上げは設備上端から必要高さまでを確認し、作業幅・奥行・面の設定は使いません。盤扉も矩形包絡による保守的な判定です。</div><div class="p-muted">全設備の保守確認</div>'+v4.serviceResults.map(s=>`<button class="p-asset" data-v4-service="${pe(s.it.assetId)}"><strong>${pe(s.it.name)}</strong><small>${s.issues.length?'干渉候補 '+s.issues.length+'件':'現在の条件で干渉候補なし'}</small></button>`).join('');
 }
 pBody.innerHTML=tabs+body;pBody.querySelectorAll('[data-v4-tab]').forEach(b=>b.onclick=()=>{v4.tab=b.dataset.v4Tab;v4Render();});
 if(v4.tab==='pipes'){
  document.getElementById('v4PipeVis').onchange=e=>{v4.showPipes=e.target.checked;v4Draw();};document.getElementById('v4PortVis').onchange=e=>{v4.showPorts=e.target.checked;v4Draw();};pBody.querySelectorAll('[data-v4-link]').forEach(b=>b.onclick=()=>v4FocusPipe(b.dataset.v4Link));
  const ports=(side,dir)=>{const asset=document.getElementById('v4'+side+'Asset').value,it=ctx.items.find(i=>i.assetId===asset);document.getElementById('v4'+side+'Port').innerHTML=(it?v4Ports(it):[]).filter(p=>p.dir===dir).map(p=>`<option value="${pe(p.id)}">${pe(p.label)} / ${pe(V4_SYSTEMS[p.sys].label)}</option>`).join('');};
  ports('From','out');ports('To','in');document.getElementById('v4FromAsset').onchange=()=>ports('From','out');document.getElementById('v4ToAsset').onchange=()=>ports('To','in');document.getElementById('v4LinkForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);const link={id:ctx.id+'-L'+Date.now().toString(36)+'-'+(++v4.seq),from:{assetId:f.get('fromAsset'),portId:f.get('fromPort')},to:{assetId:f.get('toAsset'),portId:f.get('toPort')},height:Number(f.get('height')),enabled:true,installedLength:null};const p=v4PipePath(ctx,link);if(p.error){toast(p.error);return;}if(link.height>currentBuilding.h){toast('配管高さが建屋高さを超えています');return;}if(r.links.some(l=>l.from.assetId===link.from.assetId&&l.from.portId===link.from.portId&&l.to.assetId===link.to.assetId&&l.to.portId===link.to.portId)){toast('同じ接続が登録済みです');return;}link.installedLength=p.len;r.links.push(link);v4.selectedLink=link.id;recomputeActive();toast('仮接続を追加しました');};
  const p=v4.pipeResults.find(p=>p.link.id===v4.selectedLink);if(p){document.getElementById('v4HeightForm').onsubmit=e=>{e.preventDefault();const height=Number(new FormData(e.target).get('height'));if(!Number.isFinite(height)||height<.5||height>currentBuilding.h){toast('配管高さの範囲を確認してください');return;}const next={...p.link,height};const test=v4PipePath(ctx,next);if(test.error){toast(test.error);return;}p.link.height=height;recomputeActive();};document.getElementById('v4SetLength').onclick=()=>{if(!p.error)p.link.installedLength=p.len;v4Sync();};document.getElementById('v4ToggleLink').onclick=()=>{p.link.enabled=!p.link.enabled;recomputeActive();};document.getElementById('v4RemoveLink').onclick=()=>{r.links=r.links.filter(l=>l!==p.link);v4.selectedLink=null;recomputeActive();toast('接続定義を削除しました');};}
 }else if(v4.tab==='transport'){
  document.getElementById('v4VehicleForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),width=+f.get('width'),margin=+f.get('margin');if(!Number.isFinite(width)||!Number.isFinite(margin)||width<.4||width>4||margin<0||margin>1.5){toast('車両条件の範囲を確認してください');return;}r.vehicle={width,margin};ctx.baseline=null;recomputeActive();toast('幅・片側余裕を反映して経路を再計算しました');};
  document.getElementById('v4RouteVis').onclick=()=>{v3.routes=!v3.routes;v3ApplyLayers();v4Render();};document.getElementById('v4RouteCSV').onclick=()=>{const q=x=>'"'+String(x??'').replace(/^[=+@\t\r]/,"'$&").replace(/"/g,'""')+'"';const rows=[['from_id','to_id','from','to','status','length_m','trips_day','vehicle_width_m','side_margin_m'],...ctx.routes.map(p=>[p.fromId,p.toId,p.fromName,p.toName,p.blocked?'unreachable':'reachable',p.blocked?'':p.len.toFixed(3),p.reps,r.vehicle.width,r.vehicle.margin])];pDownload('\ufeff'+rows.map(r=>r.map(q).join(',')).join('\r\n'),'factory-routes-v4.csv','text/csv;charset=utf-8');};pBody.querySelectorAll('[data-v4-route]').forEach(b=>b.onclick=()=>{const i=+b.dataset.v4Route,p=ctx.routes[i];if(p.blocked){const it=ctx.items.find(it=>it.assetId===p.fromId);if(it){camGoal.target.set(it.x,1,it.z);camGoal.dist=15;}toast('車両幅を満たす連続経路が見つかりません');}else highlightRoute(i);});
 }else{
  document.getElementById('v4ServiceAsset').value=selected?.assetId||'';document.getElementById('v4ServiceAsset').onchange=e=>v4ChooseAsset(e.target.value);document.getElementById('v4ServiceVis').onchange=e=>{v4.showService=e.target.checked;v4Draw();};pBody.querySelectorAll('[data-v4-service]').forEach(b=>b.onclick=()=>v4ChooseAsset(b.dataset.v4Service));const form=document.getElementById('v4ServiceForm');if(form)form.onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),cfg={mode:f.get('mode'),side:f.get('side'),width:+f.get('width'),depth:+f.get('depth'),height:+f.get('height')};if(!['width','depth','height'].every(k=>Number.isFinite(cfg[k])&&cfg[k]>=.2&&cfg[k]<=10)){toast('保守寸法の範囲を確認してください');return;}r.services[selected.assetId]=cfg;v4.showService=true;v4Sync();};
 }
}

// ================= Precision workspace v4 =================
// No telemetry. Geometry and parameters are conceptual until supported by actual records.
const precisionState={tab:'exterior',details:true,clearance:false,labels:true,search:'',undo:[],issues:[]};
const precisionOverlay=new THREE.Group(); scene.add(precisionOverlay);
const pBody=document.getElementById('precisionBody');
const pEvidence={assumed:'推定・仮配置',photo:'写真参照',measured:'実測・仕様確認'};
const pProcess={MILL:['分散工程','モーター・冷却ジャケット・圧力計・出口弁'],DSP:['高速攪拌','昇降架台・操作盤・排出弁・接続口'],TNK:['調合・反応','攪拌機・圧力計・温度計・排出弁'],KVT:['中間貯留','液面計・バルブ・点検口・攪拌機'],PTK:['小口調合','液面目盛・排出弁・可搬容器'],FIL:['充填・包装','搬送ローラー・光電センサー・制御盤'],RCK:['保管','棚番・棚フレーム・床区画'],DRM:['原料・製品保管','容器・パレット・床区画'],IBC:['液体保管','容器・ケージ・床区画']};
const pe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pScale=()=>ctx.kind==='site'?1:INT_SCALE;
function ensureAssetIds(c){const used=new Set(); c.items.forEach((it,i)=>{if(!it.assetId||used.has(it.assetId)){let n=i+1;do{it.assetId=c.id+'-'+it.proc+'-'+String(n++).padStart(3,'0');}while(used.has(it.assetId));}used.add(it.assetId);it.evidence??='assumed';it.maintenance??=0.8;it.notes??='';});}
function pAllContexts(){return [siteCtx,...interiorCtxs.values()];}
function pSnapshot(){return ctx.items.map(({mesh,...it})=>JSON.parse(JSON.stringify(it)));}
function pPushUndo(){precisionState.undo.push({id:ctx.id,items:pSnapshot()});if(precisionState.undo.length>15)precisionState.undo.shift();}
function pDownload(data,name,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function precisionExport(){return {version:3,interiorPlanScale:INT_SCALE,assetAttributes:Object.fromEntries(pAllContexts().map(c=>{ensureAssetIds(c);return[c.id,c.items.map(it=>({assetId:it.assetId,evidence:it.evidence,maintenance:it.maintenance,notes:it.notes}))]}))};}
function validatePrecisionImport(data){
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('配置JSONの形式が違います');
 if(data.siteW!=null&&(!Number.isFinite(data.siteW)||Math.abs(data.siteW-SITE_W)>0.01))throw Error('敷地幅が異なります。現在の敷地幅に合う配置を使用してください');
 for(const p of data.site||[]){if(!Number.isFinite(p.x)||!Number.isFinite(p.z))throw Error('敷地座標が不正です');}
 for(const [id,arr] of Object.entries(data.interiors||{})){
  const c=interiorCtxs.get(id);if(!c)throw Error('不明な建屋: '+id);if(!Array.isArray(arr)||arr.length>500)throw Error('設備配列が不正です');
  for(const it of arr){for(const k of ['x','z'])if(!Number.isFinite(it[k]))throw Error('設備座標が不正です');if(it.proc!==undefined){if(!PROC_DIMS[it.proc]||typeof it.name!=='string'||it.name.length>120||/[<>]/.test(it.name))throw Error('設備情報が不正です');for(const k of ['w','d','h'])if(!Number.isFinite(it[k])||it[k]<=0)throw Error('寸法は正の数値で入力してください');if(it.w>c.W||it.d>c.D||it.h>100)throw Error('設備寸法が範囲外です');for(const k of ['bw','bd'])if(it[k]!=null&&(!Number.isFinite(it[k])||it[k]<=0||it[k]>Math.max(c.W,c.D)))throw Error('基準寸法が不正です');if(it.rot!=null&&(!Number.isInteger(it.rot)||it.rot<0||it.rot>3))throw Error('回転値が不正です');if(!Number.isInteger(it.color)||it.color<0||it.color>0xffffff)throw Error('設備色が不正です');}}
 }
 for(const arr of Object.values(data.precision?.assetAttributes||{})){if(!Array.isArray(arr))throw Error('設備属性が不正です');for(const a of arr){if(a.maintenance!=null&&(!Number.isFinite(a.maintenance)||a.maintenance<0||a.maintenance>5))throw Error('保守余白が不正です');if(a.evidence!=null&&!pEvidence[a.evidence])throw Error('確認区分が不正です');if(a.notes!=null&&typeof a.notes!=='string')throw Error('根拠メモが不正です');}}
}
function applyPrecisionImport(p){pAllContexts().forEach(c=>{ensureAssetIds(c);const arr=p?.assetAttributes?.[c.id]||[];c.items.forEach((it,i)=>{const a=arr[i];if(!a)return;it.assetId=String(a.assetId||it.assetId);it.evidence=pEvidence[a.evidence]?a.evidence:'assumed';it.maintenance=a.maintenance??0.8;it.notes=String(a.notes||'').slice(0,2000);});});precisionState.undo=[];selected=null;}
// Detail components stay attached to the equipment so edit / rotate / duplicate preserve alignment.
function addPrecisionParts(root,it){
 if(!precisionState.details)return;
 const process=['MILL','DSP','TNK','KVT','PTK'].includes(it.proc),fill=it.proc==='FIL';if(!process&&!fill)return;
 const {w,d,h}=it, sc=Math.min(w,d),g=new THREE.Group();g.name='precision-parts';root.add(g);
 const steel=new THREE.MeshStandardMaterial({color:0xb8c8cf,metalness:.72,roughness:.32});
 const graphite=new THREE.MeshStandardMaterial({color:0x263c46,metalness:.45,roughness:.55});
 const cyan=new THREE.MeshStandardMaterial({color:0x68d6cc,metalness:.2,roughness:.38});
 const yellow=new THREE.MeshStandardMaterial({color:0xe1b83e,roughness:.6});
 const add=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);g.add(m);return m;};
 const box=(x,y,z,ww,hh,dd,m=steel)=>add(new THREE.BoxGeometry(ww,hh,dd),m,x,y,z);
 const cyl=(a,b,r,mat=steel)=>{const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),v=vb.clone().sub(va);const m=add(new THREE.CylinderGeometry(r,r,v.length(),10),mat,...va.clone().add(vb).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return m;};
 const flange=(x,y,z,r)=>{const f=add(new THREE.CylinderGeometry(r,r,sc*.024,16),steel,x,y,z);f.rotation.x=Math.PI/2;for(let j=0;j<6;j++){const a=j*Math.PI/3;cyl([x+Math.cos(a)*r*.74,y+Math.sin(a)*r*.74,z-sc*.02],[x+Math.cos(a)*r*.74,y+Math.sin(a)*r*.74,z+sc*.02],sc*.012,graphite);}};
 if(process){
  // Outlet spool + paired flange + handwheel valve.
  const py=h*.26,pz=d*.43,r=sc*.045;
  cyl([0,py,pz],[0,py,d*.70],r);flange(0,py,d*.49,r*1.9);flange(0,py,d*.60,r*1.9);
  box(0,py,d*.65,r*2.7,r*2.4,r*2.6,graphite);cyl([0,py,d*.65],[0,py+sc*.17,d*.65],r*.36);
  const wheel=add(new THREE.TorusGeometry(sc*.09,sc*.012,6,16),cyan,0,py+sc*.18,d*.65);wheel.rotation.x=Math.PI/2;
  cyl([-sc*.085,py+sc*.18,d*.65],[sc*.085,py+sc*.18,d*.65],sc*.01,cyan);
  // Instrument face with readable, unit-free reference dial (not live telemetry).
  const gx=-w*.24,gy=h*.67,gz=d*.46,gr=sc*.073;
  cyl([gx,gy-sc*.15,gz],[gx,gy,gz],sc*.018);
  const dial=add(new THREE.CylinderGeometry(gr,gr,sc*.05,20),steel,gx,gy,gz);dial.rotation.x=Math.PI/2;
  const face=add(new THREE.CircleGeometry(gr*.83,24),new THREE.MeshBasicMaterial({color:0xe4ecea}),gx,gy,gz+sc*.029);
  for(let j=0;j<7;j++){const a=(.15+j*.117)*Math.PI*2;box(gx+Math.sin(a)*gr*.66,gy+Math.cos(a)*gr*.66,gz+sc*.031,sc*.008,sc*.018,sc*.006,graphite);}
  const needle=box(gx+gr*.10,gy+gr*.16,gz+sc*.037,sc*.008,gr*.73,sc*.008,graphite);needle.rotation.z=-.58;
  // Vertical sight glass and end connections.
  if(['TNK','KVT','PTK'].includes(it.proc)){
   box(w*.29,h*.61,d*.43,sc*.055,h*.35,sc*.035,graphite);
   box(w*.29,h*.59,d*.46,sc*.026,h*.23,sc*.025,cyan);
   [h*.43,h*.79].forEach(y=>cyl([w*.29,y,d*.30],[w*.29,y,d*.47],sc*.02));
  }
 }
 if(process||fill){
  // Operator control panel, display, selector switches and E-stop.
  const px=w*.38,pz=d*.34,py=h*.66;
  box(px,py,pz,sc*.24,sc*.32,sc*.10,graphite);box(px,py+sc*.06,pz+sc*.058,sc*.15,sc*.095,sc*.016,cyan);
  [0,1,2].forEach(j=>{const m=add(new THREE.CylinderGeometry(sc*.022,sc*.022,sc*.018,10),j===2?new THREE.MeshStandardMaterial({color:0xdc5048}):steel,px+(j-1)*sc*.067,py-sc*.07,pz+sc*.068);m.rotation.x=Math.PI/2;});
  cyl([px,py-sc*.18,pz],[px,h*.1,pz],sc*.019,graphite);
  const cable=new THREE.CatmullRomCurve3([new THREE.Vector3(px,h*.1,pz),new THREE.Vector3(px*.7,h*.07,pz*.5),new THREE.Vector3(w*.1,h*.13,0)]);
  add(new THREE.TubeGeometry(cable,10,sc*.012,5,false),graphite,0,0,0);
 }
 if(fill){
  for(let j=0;j<14;j++)cyl([-w*.42+j*w*.064,h*.44,-d*.31],[-w*.42+j*w*.064,h*.44,d*.31],d*.042);
  [-1,1].forEach(sign=>{cyl([-w*.45,h*.57,sign*d*.34],[w*.45,h*.57,sign*d*.34],d*.026,cyan);box(w*.12,h*.57,sign*d*.40,d*.10,d*.13,d*.10,graphite);});
  box(-w*.36,h*.58,d*.40,d*.07,d*.18,d*.09,yellow);
 }
}
function pCheck(c){
 const out=[],scale=c.kind==='site'?1:INT_SCALE,items=c.items.filter(i=>!i.noOcc);
 for(let a=0;a<items.length;a++){
  const it=items[a];if(Math.abs(it.x)+it.w/2>c.W/2+.01||Math.abs(it.z)+it.d/2>c.D/2+.01)out.push({type:'境界外',it,other:null});
  for(let b=a+1;b<items.length;b++){
   const o=items[b],dx=Math.abs(it.x-o.x)-(it.w+o.w)/2,dz=Math.abs(it.z-o.z)-(it.d+o.d)/2;
   if(dx<-.01&&dz<-.01)out.push({type:'設備の重なり',it,other:o});
   else if(c.kind==='interior'){
    const allowance=Math.max(it.maintenance??.8,o.maintenance??.8)*scale;
    if(dx<allowance&&dz<allowance)out.push({type:'保守余白に他設備',it,other:o});
   }
  }
  if(c.kind==='interior') {const pad=(it.maintenance??.8)*scale;if(Math.abs(it.x)+it.w/2+pad>c.W/2||Math.abs(it.z)+it.d/2+pad>c.D/2)out.push({type:'保守余白が壁に到達',it,other:null});}
 }
 return out;
}
function pOverlay(){
 clearGroup(precisionOverlay);if(!precisionState.clearance||ctx.kind!=='interior')return;
 const bad=new Set(precisionState.issues.flatMap(v=>[v.it,v.other]));
 ctx.items.filter(i=>!i.noOcc).forEach(it=>{
  const pad=(it.maintenance??.8)*INT_SCALE,col=bad.has(it)?0xe9a552:0x66dcc7;
  const x0=it.x-it.w/2-pad,x1=it.x+it.w/2+pad,z0=it.z-it.d/2-pad,z1=it.z+it.d/2+pad;
  const geo=new THREE.BufferGeometry().setFromPoints([[x0,.12,z0],[x1,.12,z0],[x1,.12,z1],[x0,.12,z1],[x0,.12,z0]].map(p=>new THREE.Vector3(...p)));
  const line=new THREE.Line(geo,new THREE.LineDashedMaterial({color:col,dashSize:.55,gapSize:.3,depthTest:false,transparent:true,opacity:.9}));line.computeLineDistances();line.renderOrder=10;precisionOverlay.add(line);
 });
}
function pFocus(it){
 const scale=pScale();camGoal.target.set(it.x,it.h*.44,it.z);camGoal.dist=Math.max(it.w,it.d,it.h)*3.4+8*scale;camGoal.pitch=1.0;camGoal.yaw=.8;
 if(ctx.kind==='interior')select(it);else{selected=it;precisionSelectionChanged();}
}
function pSetTab(tab){if(tab==='exterior'&&ctx.kind!=='site')exitBuilding();precisionState.tab=tab;document.querySelectorAll('[data-p-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.pTab===tab)));pRender();}
function precisionSelectionChanged(){v3ClearSection();if(selected){precisionState.tab='inspect';document.querySelectorAll('[data-p-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.pTab==='inspect')));}pRender();v3Sync();v4Sync();}
function pAssetList(){
 const query=precisionState.search.toLowerCase();const entries=ctx.items.filter(it=>(it.name+' '+it.assetId+' '+it.proc).toLowerCase().includes(query));
 const list=document.getElementById('pAssetList');if(!list)return;
 list.innerHTML=entries.map(it=>`<button class="p-asset ${selected===it?'selected':''}" data-asset="${ctx.items.indexOf(it)}"><small>${pe(it.assetId)} · ${pe(pEvidence[it.evidence])}</small><strong>${pe(it.name)} ${ctx.kind==='site'&&it.enter?' ↗':''}</strong></button>`).join('')||'<div class="p-empty">該当する設備はありません。</div>';
 list.querySelectorAll('[data-asset]').forEach(b=>b.onclick=()=>{const it=ctx.items[+b.dataset.asset];if(ctx.kind==='site'&&it.enter){precisionState.search='';enterBuilding(it);pSetTab('assets');}else pFocus(it);});
}
function pRender(){
 if(!pBody)return;const factor=pScale();if(precisionState.tab==='exterior'){exRender();return;}if(precisionState.tab==='space'){v3RenderSpace();return;}if(precisionState.tab==='engineering'){v4Render();return;}
 if(precisionState.tab==='assets'){
  const n=ctx.items.filter(i=>i.evidence==='measured').length;
  pBody.innerHTML=`<div class="p-muted">${pe(ctx.label)} / ${ctx.kind==='site'?'建屋を選んで内部へ':'設備を選んで詳細へ'}</div><div class="p-kpis"><div><b>${ctx.items.length}</b><small>${ctx.kind==='site'?'敷地内要素':'設備・開口'}</small></div><div><b>${n}</b><small>実測確認</small></div><div><b>${precisionState.issues.length}</b><small>配置の確認点</small></div></div><input id="pSearch" aria-label="設備を検索" placeholder="設備名・ID・工程で検索" value="${pe(precisionState.search)}"><div id="pAssetList"></div>`;
  document.getElementById('pSearch').oninput=e=>{precisionState.search=e.target.value;pAssetList();};pAssetList();return;
 }
 if(precisionState.tab==='inspect'){
  const it=selected;if(!it||!ctx.items.includes(it)){pBody.innerHTML='<div class="p-empty">設備台帳から対象を選ぶと、寸法・保守余白・確認根拠を編集できます。</div>';return;}
  const editable=ctx.kind==='interior',desc=pProcess[it.proc]||[PROC_JP[it.proc]||TYPE_NAME[it.proc]||it.proc,'既存モデルの形状を保持'];
  pBody.innerHTML=`<span class="p-chip">${pe(it.assetId)}</span><h3 style="margin:8px 0 2px;font-size:15px">${pe(it.name)}</h3><div class="p-muted">${pe(desc[0])} · ${pe(desc[1])}</div><div class="p-note">${editable?'幅・奥行・高さ・位置をメートル単位で管理。寸法は推定値です。実測図面・機器仕様書で更新してください。':'敷地要素の位置・寸法は既存モデルを継承しています。'}</div>${editable?`<form id="pEdit"><label class="p-muted">設備名称<input name="name" aria-label="設備名称" maxlength="100" value="${pe(it.name)}" required></label><div class="p-grid">${[['w','東西幅 (m)',it.w/factor],['d','南北奥行 (m)',it.d/factor],['h','高さ (m)',it.h],['maintenance','保守余白 (m)',it.maintenance??.8],['x','東西位置 (m)',it.x/factor],['z','南北位置 (m)',it.z/factor]].map(([k,label,v])=>`<label>${label}<input aria-label="${label}" type="number" step="0.01" name="${k}" value="${v.toFixed(2)}" ${['x','z'].includes(k)?'':`min="${k==='maintenance'?0:.1}"`} required ${it.fixed&&k!=='maintenance'?'disabled':''}></label>`).join('')}</div><label class="p-muted">情報の確認状況<select name="evidence" aria-label="情報の確認状況">${Object.entries(pEvidence).map(([k,v])=>`<option value="${k}" ${it.evidence===k?'selected':''}>${v}</option>`).join('')}</select></label><label class="p-muted">根拠・現地確認メモ<textarea name="notes" aria-label="根拠・現地確認メモ" rows="3" maxlength="2000" placeholder="図面番号、設備仕様、写真番号など">${pe(it.notes)}</textarea></label><div class="p-actions"><button class="btn on" type="submit">変更を反映</button><button class="btn" type="button" id="pUndo">編集を戻す</button></div></form>`:''}<div class="p-actions"><button class="btn" id="pFocus">設備へ寄る</button><button class="btn" id="pOverview">全体を見る</button><button class="btn" type="button" id="v3SectionInline">断面表示</button><button class="btn" type="button" id="v4OpenInline">接続・保守</button></div>`;
  document.getElementById('v4OpenInline').onclick=()=>{v4.tab='service';v4.showService=true;pSetTab('engineering');v4Sync();};document.getElementById('v3SectionInline').disabled=!V3_SECTION_TYPES.has(it.proc)||ctx.kind!=='interior';document.getElementById('v3SectionInline').onclick=()=>v3ToggleSection();document.getElementById('pFocus').onclick=()=>pFocus(it);document.getElementById('pOverview').onclick=v3Overview;
  if(editable){document.getElementById('pEdit').onsubmit=e=>{e.preventDefault();pApply(e.target,it);};document.getElementById('pUndo').onclick=pUndo;document.getElementById('pUndo').disabled=!precisionState.undo.some(h=>h.id===ctx.id);}return;
 }
 const measured=ctx.items.filter(i=>i.evidence==='measured').length;
 pBody.innerHTML=`<div class="p-muted">平面の占有範囲と保守余白を確認</div><div class="p-kpis"><div><b>${precisionState.issues.filter(i=>i.type==='設備の重なり').length}</b><small>重なり</small></div><div><b>${ctx.items.length-measured}</b><small>実測未確認</small></div><div><b>${ctx.routes.length}</b><small>工程間経路</small></div></div><div class="p-note">保守余白は初期仮値 0.8 m。設備ごとに変更できます。平面矩形による確認で、高さ方向や法規への適合判定は含みません。</div><div class="p-actions"><button class="btn" id="pToggleSpace">${precisionState.clearance?'保守余白を隠す':'保守余白を表示'}</button><button class="btn" id="pCSV">設備CSV</button></div><details style="margin:14px 0"><summary>試算の前提と限界</summary><p class="p-muted">建屋内部は車両幅・余裕を反映した格子経路です。設備ごとの便数は均等配分の仮定。到達不可経路は距離集計から除外し、未到達件数・便数を併記します。敷地全体は従来の重心経路による概算です。旋回半径・車長・荷役・待機は未反映。</p></details><div class="p-muted">確認点 ${precisionState.issues.length}件 · クリックで対象へ</div><div id="pIssueList">${precisionState.issues.slice(0,80).map((v,i)=>`<button class="p-asset" data-issue="${i}"><small style="color:#e9b65f">${pe(v.type)}</small><strong>${pe(v.it.name)}${v.other?' / '+pe(v.other.name):''}</strong></button>`).join('')||'<div class="p-empty">現在の判定条件では該当なし</div>'}</div>`;
 document.getElementById('pToggleSpace').onclick=()=>document.getElementById('clearanceBtn').click();document.getElementById('pCSV').onclick=pCSV;pBody.querySelectorAll('[data-issue]').forEach(b=>b.onclick=()=>pFocus(precisionState.issues[+b.dataset.issue].it));
}
function pApply(form,it){
 const f=new FormData(form),v=k=>Number(f.get(k));const fixed=it.fixed;
 const next={name:String(f.get('name')||'').trim(),w:fixed?it.w:v('w')*INT_SCALE,d:fixed?it.d:v('d')*INT_SCALE,h:fixed?it.h:v('h'),x:fixed?it.x:v('x')*INT_SCALE,z:fixed?it.z:v('z')*INT_SCALE,maintenance:v('maintenance'),evidence:f.get('evidence'),notes:String(f.get('notes')||'')};
 if(!next.name||/[<>]/.test(next.name)){toast('名称は通常の文字で入力してください');return;}
 if(!['w','d','h','x','z','maintenance'].every(k=>Number.isFinite(next[k]))||next.w<=0||next.d<=0||next.h<=0||next.h>100||next.w>ctx.W||next.d>ctx.D||next.maintenance<0||next.maintenance>5){toast('寸法・余白の範囲を確認してください（余白0〜5m）');return;}
 if(Math.abs(next.x)+next.w/2>ctx.W/2+.001||Math.abs(next.z)+next.d/2>ctx.D/2+.001){toast('設備が建屋の境界を越えています。位置または寸法を調整してください');return;}
 if(next.evidence==='measured'&&!next.notes.trim()){toast('実測・仕様確認の根拠をメモに入力してください');return;}
 pPushUndo();Object.assign(it,next);it.bw=(it.rot||0)%2?it.d:it.w;it.bd=(it.rot||0)%2?it.w:it.d;
 disposeMEPAll();refreshInterior(true);toast('形状・設備属性・距離試算を更新しました');
}
function pUndo(){const i=precisionState.undo.findLastIndex(h=>h.id===ctx.id);if(i<0)return;const h=precisionState.undo.splice(i,1)[0],id=selected?.assetId;ctx.items=h.items;selected=ctx.items.find(it=>it.assetId===id)||null;disposeMEPAll();refreshInterior(true);toast('直前の属性編集を戻しました');}
function pCSV(){
 const q=x=>'"'+String(x??'').replace(/^[=+@\t\r]/,"'$&").replace(/"/g,'""')+'"';
 const lines=[['設備ID','建屋','設備名','工程','東西幅_m_推定','南北奥行_m_推定','高さ (m)','東西位置_m_推定','南北位置_m_推定','保守余白_m_仮値','確認状況','根拠メモ']];
 const contexts=ctx.kind==='site'?[...interiorCtxs.values()]:[ctx];contexts.forEach(c=>{ensureAssetIds(c);c.items.forEach(it=>lines.push([it.assetId,c.label,it.name,it.proc,(it.w/INT_SCALE).toFixed(3),(it.d/INT_SCALE).toFixed(3),it.h,(it.x/INT_SCALE).toFixed(3),(it.z/INT_SCALE).toFixed(3),it.maintenance,pEvidence[it.evidence],it.notes]));});
 pDownload('\ufeff'+lines.map(row=>row.map(q).join(',')).join('\r\n'),'factory-equipment-register.csv','text/csv;charset=utf-8');toast('設備台帳を書き出しました');
}
function refreshPrecision(){
 pAllContexts().forEach(ensureAssetIds);if(selected&&!ctx.items.includes(selected))selected=null;
 const sel=document.getElementById('pBuilding');sel.innerHTML='<option value="site">敷地全体 / SITE OVERVIEW</option>'+siteCtx.items.filter(i=>i.enter).map(i=>`<option value="${pe(i.id)}">${pe(i.name)}</option>`).join('');sel.value=ctx.id;
 precisionState.issues=pCheck(ctx);pOverlay();pRender();
 document.getElementById('viewBadge').textContent=ctx.kind==='site'?'FLOW·LAB / CONNECTED EDITION V4 · 建屋を選んで内部へ':ctx.label+' · 寸法は推定 / 稼働アニメーションは説明用';
 document.getElementById('clearanceBtn').disabled=ctx.kind==='site';
}
document.getElementById('pBuilding').onchange=e=>{precisionState.search='';pSetTab('assets');if(e.target.value==='site')exitBuilding();else enterBuilding(siteCtx.items.find(b=>b.id===e.target.value));};
document.querySelectorAll('[data-p-tab]').forEach(b=>b.onclick=()=>pSetTab(b.dataset.pTab));
document.getElementById('precisionBtn').onclick=e=>{const p=document.getElementById('precision');p.hidden=!p.hidden;e.target.classList.toggle('on',!p.hidden);document.body.classList.toggle('precision-open',!p.hidden);};
document.body.classList.add('precision-open');
document.getElementById('photoPanel').classList.add('collapsed');document.querySelector('#photoPanel .pToggle').textContent='＋';
document.getElementById('detailBtn').onclick=e=>{precisionState.details=!precisionState.details;e.target.classList.toggle('on',precisionState.details);if(ctx.kind==='interior')refreshInterior(true);toast(precisionState.details?'計器・バルブ・制御盤などの詳細部品を表示':'詳細部品を省略して軽量表示');};
document.getElementById('clearanceBtn').onclick=e=>{precisionState.clearance=!precisionState.clearance;e.target.classList.toggle('on',precisionState.clearance);pOverlay();pRender();};
document.getElementById('labelsBtn').onclick=e=>{precisionState.labels=!precisionState.labels;e.target.classList.toggle('on',precisionState.labels);intGroup.traverse(o=>{if(o.userData.precisionLabel)o.visible=precisionState.labels;});};

v3InitUI();exInit();
// ================= 起動 =================
buildSiteScene();
buildSnapGrid();
fitShadow();
interiorCtxs.forEach(c=>computeData(c));  // 全建屋の内部指標を先に計算（全社工数のため）
setCam("iso");
recomputeActive();
exCamera('overall');

let prev=performance.now(), frameNo=0, prevPlaying=false, splashEl=document.getElementById("splash");
function hideSplash(){
  if(!splashEl) return;
  window.__kzT1=performance.now();
  const s=splashEl; splashEl=null;
  s.classList.add("out"); setTimeout(()=>s.remove(),700);
}
setTimeout(hideSplash, 2500);   // 非表示タブ等でrAFが止まっていてもスプラッシュを閉じる保険
renderer.setAnimationLoop(()=>{
  const now=performance.now(); const dt=Math.min(0.05,(now-prev)/1000); prev=now;
  if(autoOrbit) camGoal.yaw+=dt*0.07;
  v3Tick(dt); applyCam(); updateMovers(dt); window.__factorySim?.tick(dt);
  if(playing!==prevPlaying){ prevPlaying=playing; shadowDirty=true; }
  if(shadowsOn && (shadowDirty || (playing && frameNo%3===0) || frameNo%45===0)){
    renderer.shadowMap.needsUpdate=true; shadowDirty=false;
  }
  const tt=now*0.004;
  clashGroup.children.forEach((m,i)=>{ m.scale.setScalar(1+0.3*Math.sin(tt+i*1.7)); });
  if(playing) for(let i=0;i<spinDiscs.length;i++) spinDiscs[i].rotation.y+=dt*1.5;
  if(playing){
    const tA=now*0.001;
    hoistAnims.forEach(a=>{
      if(a.state==="dwell"){
        a.dwell+=dt;
        const ph=Math.min(1, a.dwell/2.4);
        a.load.position.y = -a.dip*(ph<0.5? ph*2 : (1-ph)*2);
        a.grp.rotation.z=0;
        if(a.dwell>=2.4){ a.state="move"; a.dir*=-1; a.dwell=0; a.load.position.y=0; }
        return;
      }
      a.x += a.dir*a.spd*dt;
      if(Math.abs(a.x)>=a.range){ a.x=Math.sign(a.x)*a.range; a.state="dwell"; a.dwell=0; }
      a.grp.position.x=a.x;
      a.grp.rotation.z=Math.sin(tA*1.5)*0.035*a.dir;
    });
    evAnims.forEach(a=>{ a.mesh.position.y=a.base+(0.5+0.5*Math.sin(tA*0.7))*a.travel; });
    craneAnims.forEach(a=>{
      const u=Math.sin(tA*0.11+a.ph)*a.range;
      const c=Math.sin(tA*0.21+a.ph*1.7)*a.spanRange;
      if(a.long){ a.crane.position.x=u; a.trol.position.z=c; }
      else      { a.crane.position.z=u; a.trol.position.x=c; }
      const dropT=Math.max(0,Math.sin(tA*0.13+a.ph*2.3));
      const drop=a.maxDrop*dropT*dropT;
      a.cable.scale.y=Math.max(0.05,drop);
      a.cable.position.y=a.yTop-drop/2;
      a.hook.position.y=a.yTop-drop;
    });
  }
  renderer.render(scene,camera);
  if((frameNo++&1)===0) drawMini();
  if(frameNo>2) hideSplash();
});
addEventListener("resize",()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });

toast("外観版 — 正門・倉庫・屋外タンクを切り替え、建屋をダブルクリックすると内部へ移動します");

// 検証・自動化用フック
window.__kz = {
  units:"m",
  enter:(id)=>{ const b=siteCtx.items.find(i=>i.id===id); if(b&&b.enter){ enterBuilding(b); return true; } return false; },
  exit:()=>exitBuilding(),
  state:()=>({ ctx:ctx.id, kind:ctx.kind, items:ctx.items.map(i=>i.proc+":"+i.name),
    discs:spinDiscs.length, bim:bimMode, mep:mepAll.length,
    hoists:hoistAnims.length, evs:evAnims.length,
    movers:movers.length, forkMovers:movers.filter(m=>m.mesh.children.length>8).length,
    interiors:[...interiorCtxs.keys()] }),
  tick:(n)=>{ for(let i=0;i<(n||60);i++){
    const tA=(performance.now()+i*33)*0.001;
    hoistAnims.forEach(a=>{ a.grp.position.x=Math.sin(tA*a.spd)*a.range; });
    evAnims.forEach(a=>{ a.mesh.position.y=a.base+(0.5+0.5*Math.sin(tA*0.7))*a.travel; });
  } return {hx:hoistAnims.map(a=>+a.grp.position.x.toFixed(2)),
            evy:evAnims.map(a=>+a.mesh.position.y.toFixed(2))}; },
  clash:()=>{ runClash(); return clashes.length; },
  sug:()=>suggestImprovements().map(s=>({n:s.name,pct:+s.pct.toFixed(1)})),
  dock:()=>{ optimizeDocks(); return ctx.m.total; },
  trucks:()=>movers.filter(m=>m.dwellDur>4).length,
  frames:()=>frameNo,
  render:()=>{ applyCam(); renderer.shadowMap.needsUpdate=true; renderer.render(scene,camera); drawMini(); return frameNo; },
  step:(sec,n)=>{ const N=n||30; const dt=(sec||1)/N; for(let i=0;i<N;i++) updateMovers(dt); renderer.shadowMap.needsUpdate=true; renderer.render(scene,camera); return movers.length; },
  perf:()=>({t0:window.__kzT0, tFirst:window.__kzT1, now:performance.now()}),
  tipState:()=>({disp:tipEl.style.display, html:tipEl.innerHTML.slice(0,80), hovered:hovered?hovered.name:null, box:hoverBox.visible}),
  moverPos:()=>movers.map(m=>({x:+m.mesh.position.x.toFixed(1), z:+m.mesh.position.z.toFixed(1), fork:!!m.mesh.userData.beacon, truck:m.dwellDur>4})),
  timeCompute:()=>{ const t0=performance.now(); computeData(ctx); return +(performance.now()-t0).toFixed(1); },
  tour:(on)=>{ on===false? stopTour() : startTour(); return tourStep; },
  tourNext:()=>{ if(tourTimer){ clearTimeout(tourTimer); nextTour(); } return tourStep; },
  shadows:(on)=>{ if(on!==shadowsOn) shBtn.onclick(); return shadowsOn; },
  hover:(x,y)=>{ setHover(null,null,null); const it=pickItem({clientX:x,clientY:y}); setHover(it,null,{clientX:x,clientY:y}); return it? it.name : null; },
  cam:(yaw,pitch,dist,tx,ty,tz)=>{
    camGoal.yaw=yaw; camGoal.pitch=pitch; camGoal.dist=dist; camGoal.target.set(tx,ty,tz);
    camState.yaw=yaw; camState.pitch=pitch; camState.dist=dist; camState.target.set(tx,ty,tz);
    applyCam(); },
  shot:async(name)=>{
    try{ if(playing) updateMovers(0.5); }catch(e){}
    const pr=renderer.getPixelRatio();
    renderer.setPixelRatio(1);
    renderer.setSize(1600,900,false);
    camera.aspect=1600/900; camera.updateProjectionMatrix();
    applyCam(); renderer.render(scene,camera);
    const durl=renderer.domElement.toDataURL("image/jpeg",0.9);
    renderer.setPixelRatio(pr);
    renderer.setSize(innerWidth,innerHeight);
    camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
    await fetch("http://localhost:8967/shot?name="+encodeURIComponent(name),{method:"POST",body:durl});
    return name; },
  bench:()=>{ const t0=performance.now();
    for(let i=0;i<20;i++) renderer.render(scene,camera);
    return +((performance.now()-t0)/20).toFixed(2); },
  info:()=>{ let n=0; scene.traverse(()=>n++);
    return { objs:n, calls:renderer.info.render.calls, tris:renderer.info.render.triangles,
             geoms:renderer.info.memory.geometries, texs:renderer.info.memory.textures }; },
};
// Source-coordinate view is isolated from the legacy editable geometry.
const pdSpatial=new THREE.Group();pdSpatial.visible=false;scene.add(pdSpatial);let pdHidden=[];
window.__productivityRestore3D=()=>{if(!window.__pdSpatialActive)return;window.__pdSpatialActive=false;pdSpatial.visible=false;for(const [o,v]of pdHidden)o.visible=v;pdHidden=[];document.body.classList.remove('pd-source-view');document.getElementById('pdSpatialCaption').hidden=true;};
window.__productivityShow3D=(config,areas)=>{
 window.__productivityRestore3D();if(ctx.kind!=='site')exitBuilding();exCamera('overall');moveMode=false;autoOrbit=false;playing=false;selected=null;updateSelUI();clearGroup(pdSpatial);
 const bounds=new Map();for(const a of areas){if(a.floor!==1)continue;const [x,y,w,d]=a.rect;if(!bounds.has(a.building))bounds.set(a.building,[x,y,x+w,y+d]);else{const b=bounds.get(a.building);b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x+w);b[3]=Math.max(b[3],y+d);}}
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(260,185,26,19),new THREE.MeshStandardMaterial({color:0xb3bfad,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.05;pdSpatial.add(floor);
 for(const [id,[x0,y0,x1,y1]]of bounds){const old=siteCtx.items.find(b=>b.id===id);if(!old)continue;const b={...old,w:x1-x0,d:y1-y0};const m=exBuilding(b);m.position.set((x0+x1)/2-130,0,57.5-(y0+y1)/2);pdSpatial.add(m);const label=makeLabel(old.name,.55,'#e6f0e3');label.position.set(m.position.x,b.h+3,m.position.z);pdSpatial.add(label);}
 for(const [name,on,x,y,col]of [['ワニス',config.moveV,config.vx,config.vy,0xd39b58],['調色',config.moveT,config.tx,config.ty,0xc37764]])if(on){const pole=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,18,8),new THREE.MeshBasicMaterial({color:col}));pole.position.set(x-130,9,57.5-y);pdSpatial.add(pole);const marker=new THREE.Mesh(new THREE.SphereGeometry(1.6,14,8),new THREE.MeshBasicMaterial({color:col}));marker.position.set(x-130,18,57.5-y);pdSpatial.add(marker);const label=makeLabel(name+' 移設候補（代表点）',.7,'#fff0d6');label.position.set(x-130,22,57.5-y);pdSpatial.add(label);}
 pdHidden=scene.children.filter(o=>o!==pdSpatial&&o!==sky&&!o.isLight&&!o.isCamera).map(o=>[o,o.visible]);pdHidden.forEach(([o])=>o.visible=false);pdSpatial.visible=true;window.__pdSpatialActive=true;applyShadows(pdSpatial);dirtyShadow();camGoal.target.set(-18,3,0);camGoal.dist=260;camGoal.pitch=.85;camGoal.yaw=-1.8;document.body.classList.add('pd-source-view');document.getElementById('pdSpatialCaption').hidden=false;
};
// Internal 3D observation and what-if workspace. Source geometry remains separate from hypothetical equipment.
const simData=window.__factoryProductivity.data,simReplay=JSON.parse(document.getElementById('simReplayData').textContent),simCore=window.FactorySimulation.create(simData,simReplay);
let simCfg=structuredClone(simCore.defaults),simState={mode:'replay',day:'2026-07-30',group:'all',building:'paint1',floor:'1',time:9*3600,speed:60,running:false,selectedEdge:null,phase:0},simMask=[],simActive=false;
const simGroup=new THREE.Group(),simArchitecture=new THREE.Group(),simFlow=new THREE.Group(),simActors=new THREE.Group();simGroup.add(simArchitecture,simFlow,simActors);scene.add(simGroup);simGroup.visible=false;let simTokens=[],simPeople=[],simMoveMeshes=[],simLastPanel=0,simDragging=null,simResult=simCore.evaluate(simCfg);
const simColors={'ワニス':0xcb9f51,'仕込み':0x6d9ca2,'調合':0x8d82b7,'充填':0x72a76c,'2B':0xd08660,'調色':0xc0779e,'物流':0x6888ab,'管理':0x929a8a,'生産管理':0x63988d};
const sn=(v,d=0)=>Number.isFinite(v)?v.toLocaleString('ja-JP',{maximumFractionDigits:d,minimumFractionDigits:d}):'未入力';const se=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const simClock=t=>[Math.floor(t/3600),Math.floor(t/60)%60,Math.floor(t)%60].map(v=>String(v).padStart(2,'0')).join(':');
const simBounds=Object.values(simCore.A).filter(a=>a.floor===1).reduce((m,a)=>{const [x,y,w,d]=a.rect;if(!m[a.building])m[a.building]=[x,y,x+w,y+d];else{const b=m[a.building];b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x+w);b[3]=Math.max(b[3],y+d);}return m;},{});
function simWorld(p){return new THREE.Vector3(p[0]-130,(p[2]===2?10:0)+.18,57.5-p[1]);}
function simVisibleArea(a){return a&&(simState.building==='all'||a.building===simState.building)&&(simState.floor==='both'||String(a.floor)===simState.floor);}
function simTracks(){return simReplay.tracks.filter(t=>t.day===simState.day&&(simState.group==='all'||t.group===simState.group));}
function simLimits(){const tracks=simTracks().filter(t=>t.start!==null);return tracks.length?[Math.min(...tracks.map(t=>t.start)),Math.max(...tracks.map(t=>t.end))]:[8*3600,17*3600];}
function simMat(col,opacity=1){return new THREE.MeshStandardMaterial({color:col,roughness:.85,transparent:opacity<1,opacity,depthWrite:opacity>=1});}
function simBox(g,w,h,d,x,y,z,col,opacity=1){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),simMat(col,opacity));m.position.set(x,y,z);g.add(m);return m;}
function simLabel(g,text,x,y,z,size=.45,color='#d8e3d3'){const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;const c=canvas.getContext('2d');c.font="600 60px Meiryo, sans-serif";c.textAlign='center';c.textBaseline='middle';c.shadowColor='rgba(248,251,241,.95)';c.shadowBlur=8;c.fillStyle=color==='#fff5da'?'#795323':'#294b38';c.fillText(text,512,64,980);const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;const l=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));l.scale.set(26*size,3.25*size,1);l.position.set(x,y,z);g.add(l);return l;}
function simResize(){if(!simActive)return;let left,width,height,bottom;if(innerWidth<=850){left=0;width=innerWidth;bottom=innerHeight*.5;height=innerHeight*.5-65;}else{left=innerWidth<=1150?253:303;width=innerWidth-left-(innerWidth<=1150?316:363);bottom=105;height=innerHeight-176;}height=Math.max(80,height);width=Math.max(80,width);window.__simViewport={left,bottom,width,height};renderer.setViewport(left,bottom,width,height);camera.aspect=width/height;camera.updateProjectionMatrix();}
function simFit(){const b=simState.building==='all'?[0,0,225,130]:simBounds[simState.building]||[0,0,225,130];camGoal.target.set((b[0]+b[2])/2-130,simState.floor==='2'?11:3,57.5-(b[1]+b[3])/2);const w=b[2]-b[0],d=b[3]-b[1];camGoal.dist=Math.max(w,d)*1.3+15;camGoal.pitch=.52;camGoal.yaw=-1.58;window.__simWheelBase=Math.max(w,d);}
function simBuild(){
 clearGroup(simArchitecture);clearGroup(simFlow);clearGroup(simActors);simTokens=[];simPeople=[];simMoveMeshes=[];
 const secs={};simData.daily.filter(r=>r.day===simState.day&&(simState.group==='all'||simState.group===r.group)).forEach(r=>Object.entries(r.areas).forEach(([a,s])=>secs[a]=(secs[a]||0)+s));const max=Math.max(1,...Object.values(secs));
 const areas=Object.values(simCore.A).filter(simVisibleArea);for(const a of areas){const[x,y,w,d]=a.rect,baseY=a.floor===2?10:0,c=simWorld([x+w/2,y+d/2,a.floor]);const color=new THREE.Color(0xdde7ce).lerp(new THREE.Color(0x78a178),Math.sqrt((secs[a.id]||0)/max)*.6);const slab=simBox(simArchitecture,w,.15,d,c.x,baseY,c.z,color);const edges=new THREE.LineSegments(new THREE.EdgesGeometry(slab.geometry),new THREE.LineBasicMaterial({color:0x8aa184}));edges.position.copy(slab.position);simArchitecture.add(edges);const name=a.name.replace(/^[12]F_第一ペイント_/,'第一 ').replace('第二ペイント_','第二 ');simLabel(simArchitecture,name,c.x,baseY+.3,c.z,Math.min(.55,w/35),'#e0ebd7');}
 // Low perimeter edges show only the diagram outline, never unprovided interior partitions.
 for(const [id,b]of Object.entries(simBounds)){if(simState.building!=='all'&&id!==simState.building)continue;const floors=id==='paint1'?[1,2]:[1];for(const fl of floors){if(simState.floor!=='both'&&String(fl)!==simState.floor)continue;const [x0,y0,x1,y1]=b,c=simWorld([(x0+x1)/2,(y0+y1)/2,fl]),baseY=fl===2?10:0;simBox(simArchitecture,x1-x0,.55,.18,c.x,baseY+.25,57.5-y1,0x9bac95,.75);simBox(simArchitecture,.18,.55,y1-y0,x0-130,baseY+.25,c.z,0x9bac95,.75);}}
 for(const st of simData.staff){if(simState.group!=='all'&&simState.group!==st.group)continue;const aid=simCore.home[st.group],a=simCore.A[aid],p=simCore.point(aid,simCfg,simState.mode==='plan'),dest=(simState.mode==='plan'&&((st.group==='ワニス'&&simCfg.moveV)||(st.group==='調色'&&simCfg.moveT)))?'paint2':a.building;if(simState.building!=='all'&&dest!==simState.building)continue;if(simState.floor!=='both'&&String(p[2])!==simState.floor)continue;const v=simWorld(p),offset=st.group==='調合'?3:st.group==='仕込み'?-3:0;const marker=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.2,.18,24),simMat(simColors[st.group],.8));marker.position.set(v.x+offset,v.y+.2,v.z);simArchitecture.add(marker);const num=simState.mode==='plan'?simCfg.planned[st.group]:simCfg.current[st.group];simLabel(simArchitecture,`${st.name} ${num}名`,v.x+offset,v.y+3,v.z,.5,'#fff5da');marker.userData.simMove=st.group==='ワニス'?'v':st.group==='調色'?'t':null;if(simState.mode==='plan'&&dest==='paint2'&&marker.userData.simMove)simMoveMeshes.push(marker);}
 if(simState.mode==='replay')for(const tr of simTracks()){const g=new THREE.Group();const body=new THREE.Mesh(new THREE.CylinderGeometry(.24,.30,.9,12),simMat(simColors[tr.group]||0x70998b));body.position.y=.72;g.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.24,12,8),simMat(0xe6c8a2));head.position.y=1.45;g.add(head);simLabel(g,`ID ${tr.uid} · ${tr.group}`,0,2.2,0,.38,'#eaf3e3');g.visible=false;simActors.add(g);simPeople.push({tr,g});}
 else{const selected=simResult.edges.filter(e=>(simState.group==='all'||e.group===simState.group)&&e.afterCount>0).filter(e=>{const a=simCore.point(e.from,simCfg,true),b=simCore.point(e.to,simCfg,true);const inBuilding=id=>{const ar=simCore.A[id];return simState.building==='all'||ar.building===simState.building||(simState.building==='paint2'&&((ar.building==='varnish'&&simCfg.moveV)||(ar.building==='tint'&&simCfg.moveT)));};return (inBuilding(e.from)||inBuilding(e.to))&&(simState.floor==='both'||String(a[2])===simState.floor||String(b[2])===simState.floor);});
 for(const [i,e]of selected.slice(0,120).entries()){const a=simWorld(simCore.point(e.from,simCfg,true)),b=simWorld(simCore.point(e.to,simCfg,true));a.y+=.8;b.y+=.8;const geo=new THREE.BufferGeometry().setFromPoints([a,b]),active=simState.selectedEdge===e.from+'>'+e.to+'>'+e.group;const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:active?0xe19748:simColors[e.group],transparent:true,opacity:active?1:.28}));simFlow.add(line);const ball=new THREE.Mesh(new THREE.SphereGeometry(active?.45:.24,8,6),new THREE.MeshBasicMaterial({color:simColors[e.group]}));simFlow.add(ball);simTokens.push({a,b,ball,phase:i*.173,rate:Math.max(.03,Math.min(.5,e.afterCount/80))});}}
 applyShadows(simArchitecture);dirtyShadow();simTick(0);
}
function simChange(key,value){const c=structuredClone(simCfg);c[key]=value;simCore.validate(c);simCfg=c;simResult=simCore.evaluate(c);simBuild();simPanel();}
function simInput(key,label,min,max,step=1){return `<label>${label}<input data-sim-cfg="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${simCfg[key]}"></label>`;}
function simPanel(){if(!simActive)return;const sh=document.getElementById('simShell'),r=simResult,lim=simLimits(),rows=r.rows.filter(x=>simState.group==='all'||x.group===simState.group),edgeList=r.edges.filter(e=>simState.group==='all'||e.group===simState.group).slice(0,8);const grp=simState.group==='all'?'調色':simState.group;const production=simCore.groups.includes(grp);const scopes=`${simState.mode==='replay'?'実測再生 / 日付別':'改善案 / 生産6工程の計測日平均'}`;
 sh.innerHTML=`<div class="sim-top"><div><div class="sim-small">FLOW LAB 6.0 / INTERNAL OPERATIONS</div><strong>工場内部 · 実測再生と改善シミュレーション</strong></div><div class="sim-actions"><button id="simSave">条件を保存</button><button id="simLoad">読込</button><button id="simDashboard">分析一覧</button><button id="simLegacy">仮設備を編集</button></div></div><div class="sim-hint"><span>${scopes}</span><span>床区画＝資料読図 / 工程札＝主な観測エリア</span>${simState.floor==='both'?'<span>2階を10m持ち上げて表示（表示上の間隔）</span>':''}</div><aside class="sim-side sim-left"><h3>表示・再生</h3><div class="sim-actions"><button data-sim-mode="replay" class="${simState.mode==='replay'?'on':''}">実測再生</button><button data-sim-mode="plan" class="${simState.mode==='plan'?'on':''}">改善案</button></div><div class="sim-fields"><label>建屋<select id="simBuilding">${[['all','工場内部 全体'],['paint1','第一ペイント'],['paint2','第二ペイント'],['varnish','ワニス工場'],['tint','調色工場'],['lab','研究棟'],['whGen','一般倉庫']].map(([id,n])=>`<option value="${id}" ${simState.building===id?'selected':''}>${n}</option>`).join('')}</select></label><label>階<select id="simFloor">${[['both','1F + 2F'],['1','1F'],['2','2F']].map(([v,n])=>`<option value="${v}" ${simState.floor===v?'selected':''}>${n}</option>`).join('')}</select></label></div><label>工程フィルター<select id="simGroup"><option value="all">すべて</option>${simData.groups.map(g=>`<option ${simState.group===g?'selected':''}>${se(g)}</option>`).join('')}</select></label><div class="sim-fields"><label>実測日<select id="simDay">${simData.days.map(d=>`<option ${simState.day===d?'selected':''}>${d}</option>`).join('')}</select></label><button id="simFit">視点を合わせる</button></div><p class="sim-legend">床の濃淡＝選択日の観測滞在時間。工程札の人数＝共有人員／計画人員で、この時刻の在室人数ではありません。</p><div class="sim-note">${simState.mode==='replay'?'人形は選択した日に計測されたIDのみ。位置を補間せず、通信断は非表示にします。日ごとに計測工程が異なります。':'移動する点は代表点間のフロー表現です。点の数・速さは便数や同時稼働人数の再現ではありません。実測の移動頻度を根拠に比較します。'}</div><div class="sim-separator"><h3>何を変えるか</h3><p class="sim-small">条件変更は改善案の計算に反映します。実測再生の座標は変えません。</p><label class="sim-check"><input type="checkbox" data-sim-cfg="moveV" ${simCfg.moveV?'checked':''}>ワニスを第二工場へ</label><div class="sim-fields">${simInput('vx','x（m）',169.3,214.5,.1)}${simInput('vy','y（m）',11.6,75.4,.1)}</div><label class="sim-check"><input type="checkbox" data-sim-cfg="moveT" ${simCfg.moveT?'checked':''}>調色を第二工場へ</label><div class="sim-fields">${simInput('tx','x（m）',169.3,214.5,.1)}${simInput('ty','y（m）',11.6,75.4,.1)}</div><p class="sim-small">改善案の丸い工程札をドラッグして候補位置を変更できます。必要面積・設備干渉は未確認。</p><label>調色 ↔ 研究棟の往来削減率（仮説）<input data-sim-cfg="researchReduction" type="range" min="0" max="1" step=".05" value="${simCfg.researchReduction}"><span>${sn(simCfg.researchReduction*100)}%削減</span></label><p class="sim-small">現場での検査・確認などによって往来を減らす仮説。目的は要確認。観測246回は変更しません。</p></div><div class="sim-separator"><h3>工程条件 ${se(grp)}</h3>${production?`<div class="sim-fields"><label>移動頻度（現状比）<input id="simFrequency" type="number" min="0" max="2" step=".05" value="${simCfg.frequency[grp]}"></label><label>計画人員（名）<input id="simPlanned" type="number" min="0" max="100" step="1" value="${simCfg.planned[grp]}"></label></div><label>直接作業など移動以外の工数<br>現状1名あたり 分/計測日（仮定）<input id="simDirect" type="number" min="0" max="960" step="1" value="${simCfg.direct[grp]??''}" placeholder="未入力"></label><p class="sim-small">工程フィルターで対象を変更。すべて表示中は調色の条件を編集。人数を減らすだけでは作業量を減らしません。</p>`:'この工程の人員計画は今回の生産6工程の対象外です。'}</div><details><summary>換算の仮定</summary><div class="sim-fields">${simInput('speed','速度 m/分',10,200)}${simInput('detour','迂回係数',1,5,.05)}${simInput('stairs','階移動 分/回',0,10,.1)}${simInput('hours','時/人日',1,16,.5)}${simInput('goal','目標人員',1,100)}</div><p class="sim-small">代表点の水平直線距離×迂回係数÷速度＋階移動時間。実歩行経路・旋回半径・運搬物は未反映です。勤務時間の変更は供給工数・人員換算に使い、観測ベースの移動回数は変えません。</p><button id="simReset">条件を初期値に戻す</button></details></aside><aside class="sim-side sim-right"><h3>何が変わるか</h3><p class="sim-small">計算範囲：生産6工程の計測日平均を現状${r.current}名へ換算。左の建屋・実測日は比較計算を絞り込みません。</p><div class="sim-result ${r.gain<0?'bad':''}"><span>モデル移動時間の短縮</span><b>${sn(r.gain,1)} 分/計測日</b><div class="sim-pair"><span>現状 ${sn(r.beforeMinutes)}分</span><span>改善案 ${sn(r.afterMinutes)}分</span></div><p class="sim-small">${r.gain<0?'負値は移動時間が増える試算。':'正値は移動時間が減る試算。'} 生産時間の実績差ではありません。</p></div><div class="sim-result"><span>水平直線距離の変化</span><b>${sn((r.beforeDistance-r.afterDistance)/1000,2)} km/計測日</b><div class="sim-pair"><span>現状 ${sn(r.beforeDistance/1000,2)}km</span><span>改善案 ${sn(r.afterDistance/1000,2)}km</span></div></div><div class="sim-result"><span>計画人員 / 全体目標</span><b>${r.planned}名 / ${r.goal}名</b><div class="sim-pair"><span>移動短縮換算 ${sn(r.fte,2)}人分</span><span>目標差 ${r.planned-r.goal}名</span></div><p class="sim-small">${r.current-r.goal}名分は${sn(r.goalMinutes)}分/日（${simCfg.hours}時間/人）。2名の削減配分は未指定のため、初期計画は24名です。</p></div><div class="sim-result"><span>計画人員に対する工数</span><b>${r.load===null?'直接工数 未入力':sn(r.load)+' / '+sn(r.capacity)+' 分'}</b><p class="sim-small">${r.load===null?'全6工程の移動以外の工数を入力すると全体を計算。空欄をゼロ扱いしません。':r.shortage>0?'工程ごとの不足 合計 '+sn(r.shortage)+'分。余力のある別工程と自動相殺しません。':'入力した仮定上は工程別の工数不足なし。品質・兼務・繁忙時は未評価。'}</p></div><h4>工程別の変化</h4><table><thead><tr><th>工程</th><th>短縮 分</th><th>計画負荷</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${se(x.group)}</td><td class="num">${sn(x.gain,1)}</td><td class="num">${x.load===null?'未入力':x.capacity===0?'人員なし':sn(x.utilization*100)+'%'}</td></tr>`).join('')}</tbody></table><h4>根拠となる移動と変更</h4>${edgeList.map((e,i)=>`<div class="sim-edge"><b>${se(e.group)} · ${se(e.from.split('|')[1])} → ${se(e.to.split('|')[1])}</b><div class="sim-small">観測 ${e.observed}回 / ${e.personDays} ID日</div><div class="sim-pair"><span>${sn(e.beforeCount,1)} → ${sn(e.afterCount,1)}回/日（人員換算）</span><span>${sn(e.gain,1)}分短縮</span></div><button data-sim-edge="${i}">3Dで強調</button></div>`).join('')}<details><summary>根拠と未取得データ</summary><p>位置ログ803,503件、22日。エリア間移動は30秒以上の安定滞在、観測4時間以上のID日を工程別に平均。回数は人の移動であり運搬便数ではありません。8時間への標準化はせず計測日平均で比較します。勤務内外・休憩の区分は未確認です。</p><p>工程札の位置は、その工程の主な観測エリアです。仕込み・調合は同じ区画が最多ですが、同じ設備を意味しません。設備座標・寸法・実稼働率・生産数量・直接工数は未取得です。</p><p>生産量/人時・OEE・2名削減の実現可否は未判定です。元資料と処理条件は「分析一覧」で確認できます。</p></details></aside><div class="sim-bottom"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><span class="sim-clock" id="simClock">${simClock(simState.time)}</span><span class="sim-small" id="simActorCount"></span></div><div class="sim-actions"><button id="simPlay">${simState.running?'停止':'再生'}</button><select id="simSpeed">${[1,10,30,60,120,300].map(v=>`<option value="${v}" ${simState.speed===v?'selected':''}>${v}倍速</option>`).join('')}</select></div></div><input id="simTime" aria-label="実測再生時刻" type="range" min="${lim[0]}" max="${lim[1]}" step="1" value="${simState.time}" ${simState.mode==='plan'?'disabled':''}><div class="sim-small">${simState.mode==='replay'?`${simState.day} ${simClock(lim[0])}〜${simClock(lim[1])} JST / 計測座標の保持表示`:'改善案はフローの説明アニメーション。時刻ごとの生産・待機の再現ではありません。'}</div></div><input id="simFile" type="file" accept=".json" hidden>`;
 sh.querySelectorAll('[data-sim-mode]').forEach(b=>b.onclick=()=>{simState.mode=b.dataset.simMode;simState.running=false;if(simState.mode==='plan'){simState.building='all';simState.floor='1';}simBuild();simFit();simPanel();});for(const [id,key]of [['simBuilding','building'],['simFloor','floor'],['simGroup','group'],['simDay','day']])document.getElementById(id).onchange=e=>{simState[key]=e.target.value;const lim=simLimits();simState.time=Math.min(lim[1],Math.max(lim[0],simState.time));simBuild();simPanel();if(key==='building'||key==='floor')simFit();};
 sh.querySelectorAll('[data-sim-cfg]').forEach(e=>e.onchange=()=>{try{simChange(e.dataset.simCfg,e.type==='checkbox'?e.checked:e.value.trim()===''?NaN:+e.value);}catch(err){alert(err.message);simPanel();}});for(const [id,key]of [['simFrequency','frequency'],['simPlanned','planned'],['simDirect','direct']]){const el=document.getElementById(id);if(el)el.onchange=()=>{try{const values={...simCfg[key],[grp]:el.value.trim()===''?(key==='direct'?null:NaN):+el.value};simChange(key,values);}catch(e){alert(e.message);simPanel();}};}
 sh.querySelectorAll('[data-sim-edge]').forEach(b=>b.onclick=()=>{const e=edgeList[+b.dataset.simEdge];simState.selectedEdge=e.from+'>'+e.to+'>'+e.group;simState.mode='plan';simState.building='all';simState.floor='both';simBuild();const a=simWorld(simCore.point(e.from,simCfg,true)),z=simWorld(simCore.point(e.to,simCfg,true));camGoal.target.copy(a).add(z).multiplyScalar(.5);camGoal.dist=Math.max(35,a.distanceTo(z)*1.6);simPanel();});
 document.getElementById('simFit').onclick=simFit;document.getElementById('simPlay').onclick=()=>{simState.running=!simState.running;document.getElementById('simPlay').textContent=simState.running?'停止':'再生';};document.getElementById('simSpeed').onchange=e=>simState.speed=+e.target.value;document.getElementById('simTime').oninput=e=>{simState.time=+e.target.value;simState.running=false;document.getElementById('simPlay').textContent='再生';simTick(0);};document.getElementById('simDashboard').onclick=()=>{simClose();document.getElementById('pdApp').hidden=false;window.__factoryProductivity.render();};document.getElementById('simLegacy').onclick=()=>{const id=simState.building==='all'?'paint1':simState.building;simClose();document.getElementById('pdApp').hidden=true;window.__kz.enter(id);toast('設備の位置・形状は従来の仮配置です。実測ログのエリア座標とは別モデルです。');};document.getElementById('simReset').onclick=()=>{simCfg=structuredClone(simCore.defaults);simResult=simCore.evaluate(simCfg);simBuild();simPanel();};document.getElementById('simSave').onclick=()=>pDownload(JSON.stringify({simulation:simCfg,sourceRows:803503,productivity:window.__factoryProductivity.export()},null,2),'factory-internal-simulation.json','application/json');document.getElementById('simLoad').onclick=()=>document.getElementById('simFile').click();document.getElementById('simFile').onchange=async e=>{try{const d=JSON.parse(await e.target.files[0].text());window.__factorySim.import(d.simulation);}catch(e){alert('読込失敗：'+e.message);}};simTick(0);
}
function simTick(dt){if(!simActive)return;if(simState.running){if(simState.mode==='replay'){const lim=simLimits();simState.time+=dt*simState.speed;if(simState.time>lim[1]){simState.time=lim[1];simState.running=false;const b=document.getElementById('simPlay');if(b)b.textContent='再生';}}else simState.phase+=dt;}let visible=0,known=0,jumps=0;for(const {tr,g}of simPeople){const p=simCore.position(tr,simState.time);if(p)known++;const a=p?simCore.A[simReplay.areas[p[5]]]:null;g.visible=!!p&&(simState.floor==='both'||String(p[4])===simState.floor)&&(simState.building==='all'||a?.building===simState.building);if(g.visible){const v=simWorld([p[2],p[3],p[4]]);g.position.copy(v);visible++;if(p[6])jumps++;}}
 for(const t of simTokens){const f=(t.phase+simState.phase*t.rate)%1;t.ball.position.copy(t.a).lerp(t.b,f);}const now=performance.now();if(dt===0||now-simLastPanel>100){simLastPanel=now;const c=document.getElementById('simClock'),t=document.getElementById('simTime'),n=document.getElementById('simActorCount');if(c)c.textContent=simState.mode==='replay'?simClock(simState.time):'FLOW';if(t)t.value=simState.time;if(n)n.textContent=simState.mode==='replay'?` / この表示 ${visible} ID・位置有効 ${known} ID${jumps?' / 座標飛び '+jumps+' ID':''}`:' / 仮説フロー表示';}}
function simOpen(){if(simActive)return;window.__productivityRestore3D?.();if(ctx.kind!=='site')exitBuilding();selected=null;updateSelUI();moveMode=false;playing=false;autoOrbit=false;v3StopWalk();simMask=scene.children.filter(o=>o!==simGroup&&o!==sky&&!o.isLight&&!o.isCamera).map(o=>[o,o.visible]);simMask.forEach(([o])=>o.visible=false);simGroup.visible=true;simActive=true;window.__simActive=true;document.getElementById('pdApp').hidden=true;document.getElementById('simShell').hidden=false;document.body.classList.add('sim-active');exterior.light='day';exLight();scene.background=new THREE.Color(0xe3eadb);simResize();simBuild();simFit();simPanel();}
function simClose(){if(!simActive)return;simActive=false;window.__simActive=false;simState.running=false;simGroup.visible=false;simMask.forEach(([o,v])=>o.visible=v);simMask=[];document.body.classList.remove('sim-active');document.getElementById('simShell').hidden=true;renderer.setViewport(0,0,innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();exSync();}
function simPointer(e){const v=window.__simViewport;ndc.set((e.clientX-v.left)/v.width*2-1,((innerHeight-e.clientY-v.bottom)/v.height)*2-1);ray.setFromCamera(ndc,camera);}
renderer.domElement.addEventListener('pointerdown',e=>{if(!simActive||simState.mode!=='plan'||e.button!==0)return;simPointer(e);const hit=ray.intersectObjects(simMoveMeshes)[0];if(hit){simDragging=hit.object.userData.simMove;orbiting=false;dragging=null;e.stopImmediatePropagation();renderer.domElement.setPointerCapture?.(e.pointerId);}},true);
addEventListener('pointermove',e=>{if(!simDragging)return;simPointer(e);const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-.18),p=new THREE.Vector3();if(ray.ray.intersectPlane(plane,p)){simCfg[simDragging+'x']=Math.max(169.3,Math.min(214.5,p.x+130));simCfg[simDragging+'y']=Math.max(11.6,Math.min(75.4,57.5-p.z));const m=simMoveMeshes.find(m=>m.userData.simMove===simDragging);if(m)m.position.set(simCfg[simDragging+'x']-130,.38,57.5-simCfg[simDragging+'y']);}e.stopImmediatePropagation();},true);
addEventListener('pointerup',e=>{if(!simDragging)return;simDragging=null;simResult=simCore.evaluate(simCfg);simBuild();simPanel();e.stopImmediatePropagation();},true);addEventListener('resize',()=>{if(simActive)simResize();});
window.__factorySim={open:simOpen,close:simClose,tick:simTick,core:simCore,get config(){return simCfg;},get state(){return simState;},evaluate:()=>simCore.evaluate(simCfg),export:()=>structuredClone(simCfg),validate:simCore.validate,import:c=>{simCore.validate(c);simCfg=structuredClone(c);simResult=simCore.evaluate(simCfg);if(simActive){simBuild();simPanel();}},scene:simGroup};
// 起動時は従来3D（敷地全景）を表示。FLOW LAB 6.0 は「実測再生」ボタンから開く。
document.getElementById('pdApp').hidden=true;
@@INCLUDE js/twin.js@@
