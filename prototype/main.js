// WINKY 3D アクションプロトタイプ
// 添付イラスト(白い鳥の着ぐるみ+水色ボディの WINKY)をトゥーンシェーディング+
// 黒アウトライン(反転ハル)で再現。キャラクターは「おまつり(うちわ)」と
// 「野球(バット)」の 2 体を切り替え可能。

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
  padPink: 0xf77fd0,  // 肉球
  fanPink: 0xe73562,  // うちわ
  batOrange:0xf7941d, // バット
  wood:    0xdca85a,  // うちわの柄
  textBlue:0x4a7de8,  // WINK 文字
};

function toon(color) {
  return new THREE.MeshToonMaterial({ color });
}
const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: C.outline, side: THREE.BackSide });

// メッシュ生成: トゥーン材質+黒アウトライン(反転ハル)+影
function part(geo, color, outlineScale = 1.06) {
  const mesh = new THREE.Mesh(geo, toon(color));
  mesh.castShadow = true;
  if (outlineScale > 0) {
    const ol = new THREE.Mesh(geo, OUTLINE_MAT);
    ol.scale.setScalar(outlineScale);
    mesh.add(ol);
  }
  return mesh;
}

// 文字テクスチャ(WINK / 祭)
function textPlane(text, { font, color, w, h, pw, ph }) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(pw, ph),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true })
  );
  return plane;
}

// ---------- WINKY キャラクター ----------
// root(位置・向き) > body(スクワッシュ) > {胴体, head(フード・鳥・翼), armL/R, legL/R}
const root = new THREE.Group();
scene.add(root);

const body = new THREE.Group();
body.position.y = 0.55;
root.add(body);

// 胴体(水色のまるいからだ)
const torso = part(new THREE.SphereGeometry(0.45, 32, 24), C.skin);
torso.scale.set(1, 1.05, 0.9);
body.add(torso);

// おなかの「WINK」文字
const winkText = textPlane('WINK', {
  font: 'bold 58px "Comic Sans MS", "Hiragino Maru Gothic ProN", sans-serif',
  color: '#4a7de8', w: 256, h: 96, pw: 0.62, ph: 0.23,
});
winkText.position.set(0, -0.08, 0.415);
winkText.rotation.x = -0.15;
body.add(winkText);

// 鈴(フードのあごの下にぶら下がる)
const bell = part(new THREE.SphereGeometry(0.08, 16, 12), C.yellow, 1.1);
bell.position.set(0, 0.28, 0.38);
body.add(bell);

// ---------- 頭(フード+顔+鳥+翼) ----------
const head = new THREE.Group();
head.position.y = 0.85;
body.add(head);

// 白いフード(着ぐるみ)— 顔のまわりに白いふちが見えるよう奥に配置
const hood = part(new THREE.SphereGeometry(0.66, 32, 24), C.white, 1.04);
hood.position.set(0, 0.3, -0.12);
hood.scale.set(1, 1, 0.82);
head.add(hood);

// 水色の顔
const face = part(new THREE.SphereGeometry(0.55, 32, 24), C.skin, 1.045);
face.position.set(0, 0.25, 0.05);
head.add(face);

// 黄色い前髪(3つのふさ)
for (const [x, s] of [[-0.14, 0.09], [0, 0.115], [0.14, 0.09]]) {
  const tuft = part(new THREE.SphereGeometry(s, 16, 12), C.yellow, 1.12);
  tuft.position.set(x, 0.68, 0.4);
  tuft.scale.set(1, 1.2, 0.7);
  head.add(tuft);
}

// 左目(ぱっちり黒目+ハイライト)
const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 16), new THREE.MeshBasicMaterial({ color: C.outline }));
eyeL.position.set(-0.19, 0.32, 0.56);
eyeL.scale.set(0.9, 1.25, 0.45);
head.add(eyeL);
const hi = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
hi.position.set(-0.155, 0.38, 0.62);
head.add(hi);

// 右目(ウインク)
const winkEye = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 8, 16, Math.PI), new THREE.MeshBasicMaterial({ color: C.outline }));
winkEye.position.set(0.2, 0.34, 0.58);
head.add(winkEye);

// ω の口(2 つの下向きアーチ)
for (const sx of [-1, 1]) {
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 8, 16, Math.PI), new THREE.MeshBasicMaterial({ color: C.outline }));
  arc.position.set(sx * 0.045, 0.16, 0.6);
  arc.rotation.x = Math.PI; // ∪ 型
  head.add(arc);
}

// ほっぺ
for (const sx of [-1, 1]) {
  const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10), toon(C.cheek));
  cheek.position.set(sx * 0.38, 0.18, 0.46);
  cheek.scale.set(1, 0.8, 0.4);
  head.add(cheek);
}

// ---------- 鳥の頭(フードの上) ----------
const bird = new THREE.Group();
bird.position.set(0, 0.86, -0.04);
bird.scale.setScalar(1.25);
head.add(bird);

const neck = part(new THREE.CapsuleGeometry(0.1, 0.22, 6, 14), C.white, 1.1);
neck.position.set(0, 0.12, 0.04);
neck.rotation.x = 0.25;
bird.add(neck);

const birdHead = part(new THREE.SphereGeometry(0.2, 24, 18), C.white, 1.07);
birdHead.position.set(0, 0.32, 0.1);
bird.add(birdHead);

// くちばし
const beak = part(new THREE.ConeGeometry(0.09, 0.34, 12), C.yellow, 1.1);
beak.position.set(0, 0.3, 0.32);
beak.rotation.x = Math.PI / 2;
beak.scale.set(1, 1, 0.55);
bird.add(beak);

// 鳥の目(左: 点 / 右: ウインク)
const birdEyeL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: C.outline }));
birdEyeL.position.set(-0.1, 0.38, 0.23);
bird.add(birdEyeL);
const birdWink = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.01, 6, 12, Math.PI), new THREE.MeshBasicMaterial({ color: C.outline }));
birdWink.position.set(0.1, 0.39, 0.24);
bird.add(birdWink);

// 鳥のほっぺ
for (const sx of [-1, 1]) {
  const bc = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), toon(C.cheek));
  bc.position.set(sx * 0.15, 0.3, 0.18);
  bc.scale.set(1, 0.8, 0.5);
  bird.add(bc);
}

// アンテナ(ピンクの玉)
const antennaRod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), new THREE.MeshBasicMaterial({ color: C.outline }));
antennaRod.position.set(0.02, 0.55, 0.08);
bird.add(antennaRod);
const antennaBall = part(new THREE.SphereGeometry(0.055, 14, 10), C.deepPink, 1.12);
antennaBall.position.set(0.02, 0.67, 0.08);
bird.add(antennaBall);

// ---------- 翼(着ぐるみの羽・左右) ----------
function makeWing(side) {
  // 3 枚の羽根を扇状に並べた翼。ピボットはフードとの付け根
  const wing = new THREE.Group();
  const angles = [0.2, 0.6, 1.0];
  for (let i = 0; i < angles.length; i++) {
    const ang = angles[i];
    const feather = part(new THREE.CapsuleGeometry(0.13 - i * 0.014, 0.58, 6, 14), C.white, 1.07);
    // 羽根の長軸(y)を外側斜め上に向ける
    feather.rotation.z = -side * (Math.PI / 2 - ang);
    feather.position.set(
      side * Math.cos(ang) * 0.42,
      Math.sin(ang) * 0.42,
      -0.03 * i
    );
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
  const limb = part(new THREE.CapsuleGeometry(radius, len, 6, 14), C.skin, 1.08);
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

const legL = makeLimb(0.12, 0.12);
legL.position.set(-0.2, -0.4, 0);
body.add(legL);

const legR = makeLimb(0.12, 0.12);
legR.position.set(0.2, -0.4, 0);
body.add(legR);

// 足先の肉球(ピンク)
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
  const handle = part(new THREE.CylinderGeometry(0.025, 0.03, 0.34, 10), C.wood, 1.15);
  handle.position.y = -0.08;
  g.add(handle);
  const fan = part(new THREE.SphereGeometry(0.38, 28, 20), C.fanPink, 1.05);
  fan.position.y = 0.42;
  fan.scale.set(1, 1.05, 0.14);
  g.add(fan);
  const matsuri = textPlane('祭', {
    font: 'bold 150px "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif',
    color: '#1c1c24', w: 200, h: 200, pw: 0.5, ph: 0.5,
  });
  matsuri.position.set(0, 0.42, 0.07);
  g.add(matsuri);
  const matsuri2 = matsuri.clone();
  matsuri2.rotation.y = Math.PI;
  matsuri2.position.z = -0.07;
  g.add(matsuri2);
  return g;
}

function makeBat() {
  const g = new THREE.Group();
  const bat = part(new THREE.CylinderGeometry(0.11, 0.05, 0.95, 14), C.batOrange, 1.08);
  bat.position.y = 0.5;
  g.add(bat);
  const tip = part(new THREE.SphereGeometry(0.11, 14, 10), C.batOrange, 1.08);
  tip.position.y = 0.98;
  tip.scale.y = 0.7;
  g.add(tip);
  const knob = part(new THREE.SphereGeometry(0.065, 12, 8), C.white, 1.1);
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
  p.position.y = -0.36; // 手の先
  p.visible = false;
  armR.userData.limb.add(p);
}

function setCharacter(name) {
  currentChar = name;
  for (const [k, p] of Object.entries(PROPS)) p.visible = (k === name);
  document.getElementById('btnCharUchiwa').classList.toggle('active', name === 'uchiwa');
  document.getElementById('btnCharBat').classList.toggle('active', name === 'bat');
  document.getElementById('charLabel').textContent = CHAR_LABELS[name];
}

// ---------- アニメーション状態マシン ----------
const easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

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
  armL.rotation.z += 0.15 * w + Math.sin(time * 2.2) * 0.04 * w;
  if (!PROPS[currentChar]) armR.rotation.z += -0.15 * w;
}

function applyRun(time, w, dt) {
  if (w <= 0.001) return;
  const cycle = time * 11;

  anim.runAngle += dt * 0.9 * w;
  const R = 3.6;
  root.position.x = Math.cos(-anim.runAngle) * R * w;
  root.position.z = Math.sin(-anim.runAngle) * R * w;
  anim.heading = anim.runAngle + Math.PI; // 進行方向(円の接線方向)

  armL.rotation.x += Math.sin(cycle) * 1.1 * w;
  armR.rotation.x += Math.sin(cycle + Math.PI) * 0.7 * w;
  legL.rotation.x += Math.sin(cycle + Math.PI) * 1.2 * w;
  legR.rotation.x += Math.sin(cycle) * 1.2 * w;

  body.position.y += Math.abs(Math.sin(cycle)) * 0.12 * w;
  body.rotation.x += 0.2 * w;
  head.rotation.x += -0.1 * w;
  bird.rotation.x += -0.15 * w;
  wingL.rotation.z += (0.5 + Math.sin(cycle) * 0.12) * w;  // 翼を後ろへなびかせる
  wingR.rotation.z += (-0.5 - Math.sin(cycle) * 0.12) * w;
}

function applyDance(time, w) {
  if (w <= 0.001) return;
  const beat = time * 6;

  body.position.y += Math.abs(Math.sin(beat)) * 0.09 * w;
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
    wingL.rotation.z += 0.9 * Math.sin(k * Math.PI);   // 翼を大きく広げる
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
  anim.spinOffset = Math.PI * 2 * easeInOut(t);
  root.position.y += Math.sin(t * Math.PI) * 0.25;
  armL.rotation.z += 1.2 * Math.sin(t * Math.PI);
  wingL.rotation.z += 0.6 * Math.sin(t * Math.PI);
  wingR.rotation.z += -0.6 * Math.sin(t * Math.PI);
}

function applyWave(t) {
  // 左手(持ち物と反対の手)を大きくふる挨拶
  const raise = Math.min(1, t / 0.2) * Math.min(1, (1 - t) / 0.2);
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

function resetPose() {
  body.scale.set(1, 1, 1);
  body.position.y = 0.55;
  body.rotation.set(0, 0, 0);
  head.rotation.set(0, 0, 0);
  bird.rotation.set(0, 0, 0);
  wingL.rotation.set(0, 0, 0.15);
  wingR.rotation.set(0, 0, -0.15);
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
    anim.heading *= 1 - Math.min(1, dt * 3);
  }

  resetPose();
  applyIdle(time, anim.blend.idle);
  applyRun(time, anim.blend.run, dt);
  applyDance(time, anim.blend.dance);

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
