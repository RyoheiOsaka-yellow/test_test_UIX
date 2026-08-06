// WINKY 3D アクションプロトタイプ
// 添付イラスト(白い鳥の着ぐるみ+水色ボディの WINKY)をトゥーンシェーディング+
// 均一太さの黒アウトライン(法線オフセット方式)で再現。
// キャラクターは「おまつり(うちわ)」と「野球(バット)」の 2 体を切り替え可能。

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------- 基本セットアップ ----------
const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdfeeff);
scene.fog = new THREE.Fog(0xdfeeff, 20, 46);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 3.0, 9.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.35, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 3.5;
controls.maxDistance = 18;
controls.maxPolarAngle = Math.PI * 0.52;
controls.autoRotateSpeed = 2.4;

// ---------- ライティング ----------
scene.add(new THREE.HemisphereLight(0xffffff, 0xc0d0e4, 1.5));

const sun = new THREE.DirectionalLight(0xfff4e0, 1.2);
sun.position.set(5, 9, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -7;
sun.shadow.camera.right = 7;
sun.shadow.camera.top = 7;
sun.shadow.camera.bottom = -7;
sun.shadow.radius = 4;
scene.add(sun);

// ---------- 地面 ----------
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(32, 64),
  new THREE.MeshStandardMaterial({ color: 0xf2f7ee, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const track = new THREE.Group();
{
  const dotMat = new THREE.MeshStandardMaterial({ color: 0xc5d8bd, roughness: 1 });
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 12), dotMat);
    dot.position.set(Math.cos(a) * 3.6, 0.011, Math.sin(a) * 3.6);
    track.add(dot);
  }
}
scene.add(track);

// ---------- イラストのカラーパレット ----------
const C = {
  outline: 0x1c1c24,
  skin:    0xaeeaf5,  // 水色ボディ
  white:   0xffffff,  // 着ぐるみ・翼
  yellow:  0xf5c31d,  // くちばし・前髪・鈴
  cheek:   0xf6a8c9,  // ほっぺ
  deepPink:0xef4d8e,  // アンテナの玉
  padPink: 0xf76fd0,  // 肉球
  fanPink: 0xe73562,  // うちわ
  batOrange:0xf7941d, // バット
  wood:    0xdca85a,  // うちわの柄
};

// 3 階調のセルシェーディング用グラデーションマップ
const gradientMap = new THREE.DataTexture(new Uint8Array([175, 220, 255]), 3, 1, THREE.RedFormat);
gradientMap.minFilter = THREE.NearestFilter;
gradientMap.magFilter = THREE.NearestFilter;
gradientMap.needsUpdate = true;

function toon(color) {
  return new THREE.MeshToonMaterial({ color, gradientMap });
}
const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: C.outline, side: THREE.BackSide });

// 頂点を法線方向に一定距離ふくらませたアウトライン用ジオメトリ。
// スケール方式と違い、パーツの大小によらず線の太さが揃う。
function outlineGeo(geo, t) {
  const g = geo.clone();
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) + nor.getX(i) * t,
      pos.getY(i) + nor.getY(i) * t,
      pos.getZ(i) + nor.getZ(i) * t
    );
  }
  return g;
}

// メッシュ生成: トゥーン材質+黒アウトライン+影
function part(geo, color, outlineWidth = 0.02) {
  const mesh = new THREE.Mesh(geo, toon(color));
  mesh.castShadow = true;
  if (outlineWidth > 0) {
    mesh.add(new THREE.Mesh(outlineGeo(geo, outlineWidth), OUTLINE_MAT));
  }
  return mesh;
}

// ---------- テクスチャ描画(Canvas) ----------
// おなかの「WINK」— アーチ状に並んだ手書き風の青文字
function makeWinkTexture() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 160;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#4a7de8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 76px "Arial Rounded MT Bold", "Hiragino Maru Gothic ProN", sans-serif';
  const letters = ['W', 'I', 'N', 'K'];
  const xs = [-105, -35, 35, 105];
  for (let i = 0; i < 4; i++) {
    const dx = xs[i];
    ctx.save();
    ctx.translate(256 + dx, 82 + Math.pow(dx / 105, 2) * 16);
    ctx.rotate(dx * 0.001);
    ctx.fillText(letters[i], 0, 0);
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 8;
  return tex;
}

// うちわの面 — ピンク地・黒縁・扇の骨・「祭」
function makeUchiwaTexture() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 512;
  const ctx = cv.getContext('2d');
  const cx = 256, cy = 240, r = 205;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#e73562';
  ctx.fill();

  // 扇の骨(下端から放射状)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = 'rgba(28,28,36,0.85)';
  ctx.lineWidth = 5;
  for (let a = -64; a <= 64; a += 16) {
    const rad = (a - 90) * Math.PI / 180;
    ctx.beginPath();
    ctx.moveTo(cx, 500);
    ctx.lineTo(cx + Math.cos(rad) * 640, 500 + Math.sin(rad) * 640);
    ctx.stroke();
  }
  ctx.restore();

  // 縁取り
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#1c1c24';
  ctx.lineWidth = 12;
  ctx.stroke();

  // 「祭」
  ctx.fillStyle = '#1c1c24';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 210px "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif';
  ctx.fillText('祭', cx, cy + 6);

  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 8;
  return tex;
}

// ほっぺ — ふんわりにじむ円形グラデーション
function makeBlushTexture() {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  g.addColorStop(0, 'rgba(246,146,196,0.95)');
  g.addColorStop(0.7, 'rgba(246,146,196,0.55)');
  g.addColorStop(1, 'rgba(246,146,196,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}
const blushTex = makeBlushTexture();

function blush(size) {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(size, size * 0.82),
    new THREE.MeshBasicMaterial({ map: blushTex, transparent: true, depthWrite: false })
  );
}

// ---------- WINKY キャラクター ----------
const root = new THREE.Group();
scene.add(root);

const body = new THREE.Group();
body.position.y = 0.55;
root.add(body);

// 胴体(水色のまるいからだ)
const torso = part(new THREE.SphereGeometry(0.45, 40, 30), C.skin, 0.022);
torso.scale.set(1, 1.05, 0.9);
body.add(torso);

// おなかの「WINK」
const winkText = new THREE.Mesh(
  new THREE.PlaneGeometry(0.6, 0.19),
  new THREE.MeshBasicMaterial({ map: makeWinkTexture(), transparent: true, depthWrite: false })
);
winkText.position.set(0, -0.05, 0.405);
winkText.rotation.x = -0.15;
body.add(winkText);

// 鈴(スリット入り)
const bell = part(new THREE.SphereGeometry(0.08, 20, 16), C.yellow, 0.014);
bell.position.set(0, 0.28, 0.38);
body.add(bell);
const bellSlit = new THREE.Mesh(
  new THREE.TorusGeometry(0.078, 0.009, 6, 24, Math.PI * 0.8),
  new THREE.MeshBasicMaterial({ color: C.outline })
);
bellSlit.rotation.z = Math.PI * 0.1;
bell.add(bellSlit);
const bellDot = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), new THREE.MeshBasicMaterial({ color: C.outline }));
bellDot.position.set(0, -0.045, 0.062);
bell.add(bellDot);

// 着ぐるみの尻尾(3枚の羽根)
const tail = new THREE.Group();
tail.position.set(0, -0.05, -0.42);
for (const [i, ang] of [[0, -0.35], [1, 0], [2, 0.35]].entries()) {
  const feather = part(new THREE.CapsuleGeometry(0.07, 0.22, 6, 12), C.white, 0.018);
  feather.rotation.x = -2.1;
  feather.rotation.y = ang;
  feather.position.set(Math.sin(ang) * 0.12, 0.02 - Math.abs(ang) * 0.03, -0.1);
  feather.scale.z = 0.55;
  tail.add(feather);
}
body.add(tail);

// ---------- 頭(フード+顔+鳥+翼) ----------
const head = new THREE.Group();
head.position.y = 0.85;
body.add(head);

// 白いフード — 顔のまわりに白いふちが見えるよう奥に配置
const hood = part(new THREE.SphereGeometry(0.66, 40, 30), C.white, 0.024);
hood.position.set(0, 0.3, -0.12);
hood.scale.set(1, 1, 0.82);
head.add(hood);

// 水色の顔
const face = part(new THREE.SphereGeometry(0.55, 40, 30), C.skin, 0.022);
face.position.set(0, 0.25, 0.05);
head.add(face);

// 黄色い前髪(3つのふさ)
for (const [x, s] of [[-0.14, 0.09], [0, 0.115], [0.14, 0.09]]) {
  const tuft = part(new THREE.SphereGeometry(s, 18, 14), C.yellow, 0.016);
  tuft.position.set(x, 0.68, 0.4);
  tuft.scale.set(1, 1.2, 0.7);
  head.add(tuft);
}

// 左目(ぱっちり黒目+三日月ハイライト)
const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 18), new THREE.MeshBasicMaterial({ color: C.outline }));
eyeL.position.set(-0.19, 0.32, 0.56);
eyeL.scale.set(0.9, 1.25, 0.45);
head.add(eyeL);
const eyeHi = new THREE.Mesh(
  new THREE.TorusGeometry(0.045, 0.017, 8, 16, Math.PI * 0.85),
  new THREE.MeshBasicMaterial({ color: 0xffffff })
);
eyeHi.position.set(-0.2, 0.35, 0.63);
eyeHi.rotation.z = 0.5;
head.add(eyeHi);

// 右目(ウインク+目じりのまつ毛)
const winkEye = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.02, 8, 18, Math.PI), new THREE.MeshBasicMaterial({ color: C.outline }));
winkEye.position.set(0.2, 0.34, 0.58);
head.add(winkEye);
const lash = new THREE.Mesh(new THREE.CapsuleGeometry(0.017, 0.05, 4, 8), new THREE.MeshBasicMaterial({ color: C.outline }));
lash.position.set(0.285, 0.36, 0.565);
lash.rotation.z = -0.9;
head.add(lash);

// ω の口(2 つの下向きアーチ)
for (const sx of [-1, 1]) {
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.018, 8, 18, Math.PI), new THREE.MeshBasicMaterial({ color: C.outline }));
  arc.position.set(sx * 0.048, 0.16, 0.6);
  arc.rotation.x = Math.PI; // ∪ 型
  head.add(arc);
}

// ほっぺ(ふんわりグラデーション)
for (const sx of [-1, 1]) {
  const cheek = blush(0.2);
  cheek.position.set(sx * 0.36, 0.17, 0.485);
  cheek.rotation.y = sx * 0.55;
  head.add(cheek);
}

// ---------- 鳥の頭(フードの上) ----------
const bird = new THREE.Group();
bird.position.set(0, 0.86, -0.04);
bird.scale.setScalar(1.25);
head.add(bird);

const neck = part(new THREE.CapsuleGeometry(0.1, 0.22, 6, 14), C.white, 0.018);
neck.position.set(0, 0.12, 0.04);
neck.rotation.x = 0.25;
bird.add(neck);

const birdHead = part(new THREE.SphereGeometry(0.2, 28, 20), C.white, 0.018);
birdHead.position.set(0, 0.32, 0.1);
bird.add(birdHead);

// くちばし
const beak = part(new THREE.ConeGeometry(0.09, 0.34, 14), C.yellow, 0.014);
beak.position.set(0, 0.3, 0.32);
beak.rotation.x = Math.PI / 2;
beak.scale.set(1, 1, 0.55);
bird.add(beak);

// 鳥の目(左: 点 / 右: ウインク)
const birdEyeL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ color: C.outline }));
birdEyeL.position.set(-0.1, 0.38, 0.23);
bird.add(birdEyeL);
const birdWink = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.011, 6, 12, Math.PI), new THREE.MeshBasicMaterial({ color: C.outline }));
birdWink.position.set(0.1, 0.39, 0.24);
bird.add(birdWink);

// 鳥のほっぺ
for (const sx of [-1, 1]) {
  const bc = blush(0.1);
  bc.position.set(sx * 0.14, 0.3, 0.24);
  bc.rotation.y = sx * 0.5;
  bird.add(bc);
}

// アンテナ(ばねのように揺れる)
const antenna = new THREE.Group();
antenna.position.set(0.02, 0.45, 0.08);
bird.add(antenna);
const antennaRod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), new THREE.MeshBasicMaterial({ color: C.outline }));
antennaRod.position.y = 0.1;
antenna.add(antennaRod);
const antennaBall = part(new THREE.SphereGeometry(0.055, 16, 12), C.deepPink, 0.012);
antennaBall.position.y = 0.24;
antenna.add(antennaBall);

// ---------- 翼(着ぐるみの羽・左右) ----------
function makeWing(side) {
  // 4 枚の平らな羽根を扇状に並べた翼(外側ほど長い)
  const wing = new THREE.Group();
  const feathers = [
    { ang: 0.12, len: 0.6, r: 0.125 },
    { ang: 0.5,  len: 0.66, r: 0.115 },
    { ang: 0.88, len: 0.56, r: 0.1 },
    { ang: 1.2,  len: 0.42, r: 0.085 },
  ];
  for (let i = 0; i < feathers.length; i++) {
    const { ang, len, r } = feathers[i];
    const feather = part(new THREE.CapsuleGeometry(r, len, 6, 14), C.white, 0.02);
    feather.rotation.z = -side * (Math.PI / 2 - ang);
    feather.position.set(
      side * Math.cos(ang) * (len * 0.42 + 0.18),
      Math.sin(ang) * (len * 0.42 + 0.18),
      -0.03 * i
    );
    feather.scale.z = 0.6; // 平らな羽根
    wing.add(feather);
  }
  return wing;
}
const wingL = makeWing(-1);
wingL.position.set(-0.56, 0.42, -0.18);
wingL.rotation.z = 0.1;
head.add(wingL);

const wingR = makeWing(1);
wingR.position.set(0.56, 0.42, -0.18);
wingR.rotation.z = -0.1;
head.add(wingR);

// ---------- 手足 ----------
function makeLimb(len, radius) {
  const pivot = new THREE.Group();
  const limb = part(new THREE.CapsuleGeometry(radius, len, 8, 16), C.skin, 0.02);
  limb.position.y = -(len / 2 + radius);
  pivot.add(limb);
  pivot.userData.limb = limb;
  return pivot;
}

const armL = makeLimb(0.2, 0.1);
armL.position.set(-0.5, 0.22, 0.06);
body.add(armL);

const armR = makeLimb(0.2, 0.1);
armR.position.set(0.5, 0.22, 0.06);
body.add(armR);

// 左手のひらの肉球(手をふると見える)
{
  const palm = armL.userData.limb;
  const big = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 10), toon(C.padPink));
  big.position.set(0, -0.2, 0.085);
  big.scale.set(1, 1.1, 0.35);
  palm.add(big);
  for (const [x, y] of [[-0.05, -0.13], [0, -0.115], [0.05, -0.13]]) {
    const bean = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), toon(C.padPink));
    bean.position.set(x, y, 0.09);
    bean.scale.z = 0.35;
    palm.add(bean);
  }
}

const legL = makeLimb(0.12, 0.12);
legL.position.set(-0.2, -0.4, 0);
body.add(legL);

const legR = makeLimb(0.12, 0.12);
legR.position.set(0.2, -0.4, 0);
body.add(legR);

// 足先の肉球
for (const leg of [legL, legR]) {
  const foot = leg.userData.limb;
  for (const [x, y, s] of [[0, -0.3, 0.045], [-0.05, -0.24, 0.026], [0.05, -0.24, 0.026]]) {
    const pad = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), toon(C.padPink));
    pad.position.set(x, y, 0.075);
    pad.scale.z = 0.4;
    foot.add(pad);
  }
}

// ---------- 持ち物(キャラクター切り替え) ----------
function makeUchiwa() {
  const g = new THREE.Group();
  const handle = part(new THREE.CylinderGeometry(0.026, 0.032, 0.38, 10), C.wood, 0.014);
  handle.position.y = -0.08;
  g.add(handle);

  // 本体はうすい円盤、面はテクスチャ(骨・縁取り・祭)
  const fan = part(new THREE.SphereGeometry(0.4, 32, 24), C.fanPink, 0.018);
  fan.position.y = 0.48;
  fan.scale.set(1, 1.04, 0.13);
  g.add(fan);

  const faceTex = makeUchiwaTexture();
  for (const zs of [1, -1]) {
    const facePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 1.0),
      new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, depthWrite: false })
    );
    facePlane.position.set(0, 0.445, zs * 0.062);
    if (zs < 0) facePlane.rotation.y = Math.PI;
    g.add(facePlane);
  }
  return g;
}

function makeBat() {
  const g = new THREE.Group();
  const bat = part(new THREE.CylinderGeometry(0.11, 0.05, 0.95, 16), C.batOrange, 0.018);
  bat.position.y = 0.5;
  g.add(bat);
  const tip = part(new THREE.SphereGeometry(0.11, 16, 12), C.batOrange, 0.018);
  tip.position.y = 0.98;
  tip.scale.y = 0.7;
  g.add(tip);
  const knob = part(new THREE.SphereGeometry(0.065, 12, 10), C.white, 0.014);
  knob.position.y = 0.0;
  knob.scale.y = 0.6;
  g.add(knob);
  return g;
}

const PROPS = { uchiwa: makeUchiwa(), bat: makeBat() };
const CHAR_LABELS = { uchiwa: 'おまつり WINKY', bat: '野球 WINKY' };
let currentChar = 'uchiwa';

// 腕(x回転 -1.15)で前上方に構えるぶんを打ち消して、
// うちわは正面向き・バットは斜め上向きにする
PROPS.uchiwa.rotation.set(1.05, 0, 0);
PROPS.bat.rotation.set(0.9, 0, -0.35);

for (const p of Object.values(PROPS)) {
  p.position.set(0.04, -0.36, 0); // 手の先
  p.visible = false;
  armR.userData.limb.add(p);
}

function setCharacter(name) {
  const changed = currentChar !== name;
  currentChar = name;
  for (const [k, p] of Object.entries(PROPS)) p.visible = (k === name);
  if (changed) propPop.t = 0; // ポンッと現れる演出をリスタート
  document.getElementById('btnCharUchiwa').classList.toggle('active', name === 'uchiwa');
  document.getElementById('btnCharBat').classList.toggle('active', name === 'bat');
  document.getElementById('charLabel').textContent = CHAR_LABELS[name];
}

// ---------- アニメーション状態マシン ----------
const easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const smoothstep = (t) => t * t * (3 - 2 * t);
const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
// 角度を [-π, π] に正規化(走行停止時に何回転も巻き戻らないように)
const wrapAngle = (a) => ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

const LOOP_STATES = ['idle', 'run', 'dance'];
const STATE_LABELS = { idle: '待機', run: '走る', dance: 'ダンス' };
const ONESHOT_LABELS = { jump: 'はねる!', spin: 'スピン!', wave: '手をふる', bow: 'おじぎ', flip: 'バク宙!' };
const ONESHOT_DURATIONS = { jump: 0.75, spin: 0.8, wave: 1.3, bow: 1.4, flip: 1.0 };

const anim = {
  state: 'idle',
  blend: { idle: 1, run: 0, dance: 0 },
  oneShot: null,
  runAngle: 0,
  heading: 0,
  spinOffset: 0,
};

const stateLabel = document.getElementById('stateLabel');
const stateButtons = {
  idle: document.getElementById('btnIdle'),
  run: document.getElementById('btnRun'),
  dance: document.getElementById('btnDance'),
};

function updateLabel() {
  stateLabel.textContent = '状態: ' + (anim.oneShot ? ONESHOT_LABELS[anim.oneShot.name] : STATE_LABELS[anim.state]);
}

function setState(next) {
  if (next === 'run' && anim.state !== 'run') {
    // いま向いている方向から走り出せるよう、コース上の角度を同期する
    anim.runAngle = anim.heading - Math.PI;
  }
  anim.state = next;
  for (const s of LOOP_STATES) stateButtons[s].classList.toggle('active', s === next);
  updateLabel();
}

function triggerOneShot(name) {
  if (anim.oneShot) return;
  anim.oneShot = { name, t: 0, duration: ONESHOT_DURATIONS[name] };
  updateLabel();
}

function toggleSpinCam() {
  controls.autoRotate = !controls.autoRotate;
  document.getElementById('btnAutoRotate').classList.toggle('active', controls.autoRotate);
}

document.getElementById('btnIdle').addEventListener('click', () => setState('idle'));
document.getElementById('btnRun').addEventListener('click', () => setState('run'));
document.getElementById('btnDance').addEventListener('click', () => setState('dance'));
document.getElementById('btnJump').addEventListener('click', () => triggerOneShot('jump'));
document.getElementById('btnSpin').addEventListener('click', () => triggerOneShot('spin'));
document.getElementById('btnWave').addEventListener('click', () => triggerOneShot('wave'));
document.getElementById('btnBow').addEventListener('click', () => triggerOneShot('bow'));
document.getElementById('btnFlip').addEventListener('click', () => triggerOneShot('flip'));
document.getElementById('btnAutoRotate').addEventListener('click', toggleSpinCam);
document.getElementById('btnCharUchiwa').addEventListener('click', () => setCharacter('uchiwa'));
document.getElementById('btnCharBat').addEventListener('click', () => setCharacter('bat'));

window.addEventListener('keydown', (e) => {
  if (e.code === 'Digit1') setState('idle');
  if (e.code === 'Digit2') setState('run');
  if (e.code === 'Digit3') setState('dance');
  if (e.code === 'Space') { e.preventDefault(); triggerOneShot('jump'); }
  if (e.code === 'KeyS') triggerOneShot('spin');
  if (e.code === 'KeyW') triggerOneShot('wave');
  if (e.code === 'KeyB') triggerOneShot('bow');
  if (e.code === 'KeyF') triggerOneShot('flip');
  if (e.code === 'KeyR') toggleSpinCam();
  if (e.code === 'KeyC') setCharacter(currentChar === 'uchiwa' ? 'bat' : 'uchiwa');
});

// ---------- ループ状態のポーズ ----------
function applyIdle(time, w) {
  if (w <= 0.001) return;
  body.scale.y += Math.sin(time * 2.2) * 0.025 * w;
  body.position.y += Math.sin(time * 2.2) * 0.012 * w;
  head.rotation.z += Math.sin(time * 0.9) * 0.04 * w;
  bird.rotation.z += Math.sin(time * 1.4) * 0.06 * w;
  wingL.rotation.z += Math.sin(time * 2.0) * 0.06 * w;
  wingR.rotation.z += -Math.sin(time * 2.0) * 0.06 * w;
  tail.rotation.x += Math.sin(time * 1.8) * 0.1 * w;
  armL.rotation.z += 0.15 * w + Math.sin(time * 2.2) * 0.04 * w;
}

function applyRun(time, w, dt) {
  if (w <= 0.001) return;
  const cycle = time * 11;

  anim.runAngle += dt * 0.9 * w;
  const R = 3.6;
  root.position.x = Math.cos(-anim.runAngle) * R * w;
  root.position.z = Math.sin(-anim.runAngle) * R * w;
  if (anim.state === 'run') {
    anim.heading = anim.runAngle + Math.PI; // 進行方向(円の接線方向)
  }

  armL.rotation.x += Math.sin(cycle) * 1.1 * w;
  armR.rotation.x += Math.sin(cycle + Math.PI) * 0.7 * w;
  legL.rotation.x += Math.sin(cycle + Math.PI) * 1.2 * w;
  legR.rotation.x += Math.sin(cycle) * 1.2 * w;

  // sin^2 で折り返しのカクつきがない弾み+カーブへの内傾(バンク)
  body.position.y += Math.pow(Math.sin(cycle), 2) * 0.12 * w;
  body.rotation.x += 0.2 * w;
  body.rotation.z += 0.09 * w;
  head.rotation.x += -0.1 * w;
  bird.rotation.x += -0.15 * w;
  wingL.rotation.z += (0.5 + Math.sin(cycle) * 0.12) * w;  // 翼を後ろへなびかせる
  wingR.rotation.z += (-0.5 - Math.sin(cycle) * 0.12) * w;
  tail.rotation.x += (0.25 + Math.sin(cycle) * 0.1) * w;
}

function applyDance(time, w) {
  if (w <= 0.001) return;
  const beat = time * 6;

  body.position.y += Math.pow(Math.sin(beat), 2) * 0.09 * w;
  body.rotation.z += Math.sin(beat) * 0.1 * w;
  body.rotation.y += Math.sin(beat * 0.5) * 0.25 * w;

  armL.rotation.z += (0.9 + Math.sin(beat) * 1.1) * w;
  armR.rotation.z += (-0.5 + Math.sin(beat) * 0.5) * w;

  legL.rotation.x += Math.max(0, Math.sin(beat)) * 0.5 * w;
  legR.rotation.x += Math.max(0, -Math.sin(beat)) * 0.5 * w;

  head.rotation.z += Math.sin(beat + 0.5) * 0.12 * w;
  bird.rotation.z += Math.sin(beat * 2) * 0.15 * w;
  wingL.rotation.z += Math.abs(Math.sin(beat)) * 0.5 * w;   // 翼をパタパタ
  wingR.rotation.z += -Math.abs(Math.sin(beat)) * 0.5 * w;
  tail.rotation.x += Math.sin(beat * 2) * 0.2 * w;
}

// ---------- ワンショットアクション ----------
function applyJump(t) {
  if (t < 0.18) {
    const k = t / 0.18;
    body.scale.y *= 1 - 0.22 * k;
    body.scale.x *= 1 + 0.12 * k;
    body.scale.z *= 1 + 0.12 * k;
  } else {
    const k = (t - 0.18) / 0.82;
    root.position.y = Math.sin(k * Math.PI) * 1.5;
    const stretch = Math.sin(k * Math.PI) * 0.16;
    body.scale.y *= 1 + stretch;
    body.scale.x *= 1 - stretch * 0.5;
    body.scale.z *= 1 - stretch * 0.5;
    armL.rotation.z += 2.4 * Math.sin(k * Math.PI);
    wingL.rotation.z += 0.9 * Math.sin(k * Math.PI);
    wingR.rotation.z += -0.9 * Math.sin(k * Math.PI);
    legL.rotation.x += -0.5 * Math.sin(k * Math.PI);
    legR.rotation.x += -0.5 * Math.sin(k * Math.PI);
    if (k > 0.92) {
      const land = (k - 0.92) / 0.08;
      body.scale.y *= 1 - 0.15 * Math.sin(land * Math.PI);
    }
  }
}

function applySpin(t) {
  // 予備動作(逆ひねり)→ 一気に 1 回転
  if (t < 0.22) {
    anim.spinOffset = -0.3 * smoothstep(t / 0.22);
    body.rotation.y += -0.15 * smoothstep(t / 0.22);
  } else {
    const k = (t - 0.22) / 0.78;
    anim.spinOffset = -0.3 + (Math.PI * 2 + 0.3) * easeInOut(k);
  }
  root.position.y += Math.pow(Math.sin(t * Math.PI), 2) * 0.25;
  armL.rotation.z += 1.2 * Math.sin(t * Math.PI);
  wingL.rotation.z += 0.6 * Math.sin(t * Math.PI);
  wingR.rotation.z += -0.6 * Math.sin(t * Math.PI);
}

function applyWave(t) {
  // 左手(肉球のある手)を大きくふる挨拶(出入りを smoothstep で丸める)
  const raise = smoothstep(Math.min(1, t / 0.25)) * smoothstep(Math.min(1, (1 - t) / 0.25));
  armL.rotation.z += 2.6 * raise;
  armL.rotation.x += Math.sin(t * Math.PI * 6) * 0.5 * raise;
  head.rotation.z += 0.12 * raise;
  body.rotation.z += -0.06 * raise;
}

function applyBow(t) {
  let k;
  if (t < 0.3) k = easeInOut(t / 0.3);
  else if (t < 0.7) k = 1;
  else k = 1 - easeInOut((t - 0.7) / 0.3);
  body.rotation.x += 0.6 * k;
  head.rotation.x += 0.12 * k;
  bird.rotation.x += 0.2 * k;
  armL.rotation.x += -0.3 * k;
  wingL.rotation.z += -0.2 * k;
  wingR.rotation.z += 0.2 * k;
}

function applyFlip(t) {
  if (t < 0.15) {
    const k = t / 0.15;
    body.scale.y *= 1 - 0.28 * k;
    body.scale.x *= 1 + 0.14 * k;
    body.scale.z *= 1 + 0.14 * k;
    body.rotation.x += 0.2 * k;
  } else {
    const k = (t - 0.15) / 0.85;
    root.position.y = Math.sin(k * Math.PI) * 2.0;
    body.rotation.x += -Math.PI * 2 * easeInOut(k);
    const tuck = Math.sin(k * Math.PI);
    legL.rotation.x += -1.6 * tuck;
    legR.rotation.x += -1.6 * tuck;
    armL.rotation.x += -1.2 * tuck;
    wingL.rotation.z += 1.0 * tuck;
    wingR.rotation.z += -1.0 * tuck;
    if (k > 0.9) {
      const land = (k - 0.9) / 0.1;
      body.scale.y *= 1 - 0.2 * Math.sin(land * Math.PI);
      body.scale.x *= 1 + 0.1 * Math.sin(land * Math.PI);
    }
  }
}

const ONESHOT_FN = { jump: applyJump, spin: applySpin, wave: applyWave, bow: applyBow, flip: applyFlip };

// ---------- メインループ ----------
const clock = new THREE.Clock();

// 減衰バネ(体の上下動に遅れて反応し、余韻を残して揺れる)
// アンテナ・鳥の頭・尻尾・鈴が同じ信号に追従して「揺れもの」を表現する
const spring = { x: 0, v: 0, prevY: 0 };
const SPRING_K = 70;   // ばね定数
const SPRING_C = 7;    // 減衰

// まばたき・翼の羽ばたき(ランダム間隔の生体アニメーション)
const blink = { t: 1, next: 2.5 };
const flutter = { t: 1, next: 4 };

// キャラ切り替え時に持ち物がポンッと現れる演出
const propPop = { t: 1 };

function resetPose() {
  body.scale.set(1, 1, 1);
  body.position.y = 0.55;
  body.rotation.set(0, 0, 0);
  head.rotation.set(0, 0, 0);
  bird.rotation.set(0, 0, 0);
  wingL.rotation.set(0, 0, 0.1);
  wingR.rotation.set(0, 0, -0.1);
  tail.rotation.set(0, 0, 0);
  armL.rotation.set(0, 0, 0.15);
  armR.rotation.set(-1.15, 0, -0.45); // 持ち物をかかげる腕
  legL.rotation.set(0, 0, 0);
  legR.rotation.set(0, 0, 0);
  root.position.y = 0;
  anim.spinOffset = 0;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  for (const s of ['run', 'dance']) {
    const target = anim.state === s ? 1 : 0;
    anim.blend[s] += (target - anim.blend[s]) * Math.min(1, dt * 6);
  }
  anim.blend.idle = Math.max(0, 1 - anim.blend.run - anim.blend.dance);

  if (anim.state !== 'run') {
    root.position.x *= 1 - Math.min(1, dt * 3);
    root.position.z *= 1 - Math.min(1, dt * 3);
    // 最短方向に向き直る(±πに正規化してから減衰)
    anim.heading = wrapAngle(anim.heading) * (1 - Math.min(1, dt * 3));
  }

  resetPose();
  // ウェイトを smoothstep に通してブレンドの入り・抜きを柔らかく
  applyIdle(time, smoothstep(anim.blend.idle));
  applyRun(time, smoothstep(anim.blend.run), dt);
  applyDance(time, smoothstep(anim.blend.dance));

  if (anim.oneShot) {
    anim.oneShot.t += dt;
    const { name, t, duration } = anim.oneShot;
    if (t >= duration) {
      anim.oneShot = null;
      updateLabel();
    } else {
      ONESHOT_FN[name](t / duration);
    }
  }

  root.rotation.y = anim.heading + anim.spinOffset;

  // ---- 揺れもの(減衰バネ物理) ----
  const bodyY = root.position.y + body.position.y;
  const vy = dt > 0 ? (bodyY - spring.prevY) / dt : 0;
  spring.prevY = bodyY;
  const springTarget = THREE.MathUtils.clamp(-vy * 0.16, -0.6, 0.6);
  spring.v += (-SPRING_K * (spring.x - springTarget) - SPRING_C * spring.v) * dt;
  spring.x += spring.v * dt;
  antenna.rotation.x = spring.x;
  antenna.rotation.z = Math.sin(time * 2.6) * 0.05;
  bird.rotation.x += spring.x * 0.22;   // 鳥の頭が遅れてついてくる
  tail.rotation.x += spring.x * 0.5;    // 尻尾の羽根がはねる
  bell.position.y = 0.28 + spring.x * 0.018; // 鈴もわずかに揺れる

  // ---- まばたき(左目のみ・ランダム間隔) ----
  if (time > blink.next) {
    blink.t = 0;
    blink.next = time + 2.2 + Math.random() * 3;
  }
  blink.t += dt;
  const blinkK = blink.t < 0.16 ? 1 - 0.92 * Math.sin((blink.t / 0.16) * Math.PI) : 1;
  eyeL.scale.y = 1.25 * blinkK;
  eyeHi.visible = blinkK > 0.5;

  // ---- 翼のはためき(待機中にときどきパタパタッ) ----
  if (time > flutter.next) {
    flutter.t = 0;
    flutter.next = time + 3.5 + Math.random() * 3.5;
  }
  flutter.t += dt;
  if (flutter.t < 0.5) {
    const p = flutter.t / 0.5;
    const flap = Math.sin(p * Math.PI * 5) * 0.28 * (1 - p) * anim.blend.idle;
    wingL.rotation.z += flap;
    wingR.rotation.z += -flap;
  }

  // ---- キャラ切り替えの持ち物ポップイン ----
  if (propPop.t < 1) {
    propPop.t = Math.min(1, propPop.t + dt / 0.3);
    PROPS[currentChar].scale.setScalar(Math.max(0.001, easeOutBack(propPop.t)));
  }

  controls.update();
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

setCharacter('uchiwa');
animate();
