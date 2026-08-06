// WINKY 3D アクションプロトタイプ
// キャラクターは元の .ai データ(PDF互換なしのため抽出不可)のサムネイルを基に
// プリミティブで近似したもの。実データへの差し替え手順は README.md を参照。

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
scene.fog = new THREE.Fog(0xdfeeff, 18, 42);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 2.6, 7.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.15, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 3;
controls.maxDistance = 16;
controls.maxPolarAngle = Math.PI * 0.52;
controls.autoRotateSpeed = 2.4;

// ---------- ライティング ----------
scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c8e0, 0.9));

const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
sun.position.set(5, 8, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -6;
sun.shadow.camera.right = 6;
sun.shadow.camera.top = 6;
sun.shadow.camera.bottom = -6;
scene.add(sun);

// ---------- 地面 ----------
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(30, 64),
  new THREE.MeshStandardMaterial({ color: 0xf2f7ee, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// 走行感を出す装飾リング
const track = new THREE.Group();
{
  const dotMat = new THREE.MeshStandardMaterial({ color: 0xc5d8bd, roughness: 1 });
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 12), dotMat);
    dot.position.set(Math.cos(a) * 3.2, 0.011, Math.sin(a) * 3.2);
    track.add(dot);
  }
}
scene.add(track);

// ---------- マテリアル ----------
const M = {
  white:  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 }),
  patch:  new THREE.MeshStandardMaterial({ color: 0x3a3a42, roughness: 0.6 }),
  blue:   new THREE.MeshStandardMaterial({ color: 0x4a90e2, roughness: 0.6 }),
  pink:   new THREE.MeshStandardMaterial({ color: 0xf7a8c4, roughness: 0.7 }),
  dark:   new THREE.MeshStandardMaterial({ color: 0x22222a, roughness: 0.4 }),
  innerEar: new THREE.MeshStandardMaterial({ color: 0xf9d5e0, roughness: 0.8 }),
};

function shadowed(mesh) {
  mesh.castShadow = true;
  return mesh;
}

// ---------- WINKY キャラクター(リグ付き階層) ----------
// root(位置・向き) > body(スクワッシュ・回転) > {胴体, head, armL/R, legL/R, tail}
const root = new THREE.Group();
scene.add(root);

const body = new THREE.Group();
body.position.y = 0.62;
root.add(body);

const torso = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.46, 32, 24), M.white));
torso.scale.set(1, 1.12, 0.92);
torso.position.y = 0.1;
body.add(torso);

const pants = shadowed(new THREE.Mesh(
  new THREE.SphereGeometry(0.47, 32, 16, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45),
  M.blue
));
pants.scale.set(1, 1.12, 0.92);
pants.position.y = 0.1;
body.add(pants);

const backPatch = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 16), M.patch));
backPatch.position.set(0.18, 0.3, -0.33);
backPatch.scale.set(1.2, 1, 0.55);
body.add(backPatch);

// ---------- 頭 ----------
const head = new THREE.Group();
head.position.y = 0.78;
body.add(head);

const skull = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.52, 32, 24), M.white));
skull.scale.set(1.05, 0.95, 0.95);
head.add(skull);

function makeEar(patched) {
  const ear = new THREE.Group();
  const outer = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 4), patched ? M.patch : M.white));
  outer.rotation.y = Math.PI / 4;
  ear.add(outer);
  const inner = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 4), M.innerEar);
  inner.rotation.y = Math.PI / 4;
  inner.position.set(0, -0.03, 0.045);
  ear.add(inner);
  return ear;
}
const earL = makeEar(false);
earL.position.set(-0.3, 0.42, 0);
earL.rotation.z = 0.35;
head.add(earL);

const earR = makeEar(true);
earR.position.set(0.3, 0.42, 0);
earR.rotation.z = -0.35;
head.add(earR);

// 顔 — WINKY なのでウインク顔
const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), M.dark);
eyeL.position.set(-0.17, 0.05, 0.47);
head.add(eyeL);

const winkEye = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 8, 16, Math.PI), M.dark);
winkEye.position.set(0.17, 0.03, 0.47);
winkEye.rotation.x = Math.PI;
head.add(winkEye);

const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 8, 16, Math.PI), M.dark);
mouth.position.set(0, -0.1, 0.48);
mouth.rotation.x = Math.PI; // 上向きアーチ(笑顔)
head.add(mouth);

for (const sx of [-1, 1]) {
  const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), M.pink);
  cheek.position.set(sx * 0.3, -0.08, 0.42);
  cheek.scale.z = 0.4;
  head.add(cheek);
}

const facePatch = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), M.patch));
facePatch.position.set(-0.28, 0.3, 0.25);
facePatch.scale.set(1.1, 0.8, 0.7);
head.add(facePatch);

// ---------- 手足 ----------
function makeLimb(len, radius, mat) {
  const pivot = new THREE.Group();
  const limb = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(radius, len, 6, 12), mat));
  limb.position.y = -(len / 2 + radius);
  pivot.add(limb);
  return pivot;
}

const armL = makeLimb(0.3, 0.09, M.white);
armL.position.set(-0.46, 0.28, 0);
body.add(armL);

const armR = makeLimb(0.3, 0.09, M.white);
armR.position.set(0.46, 0.28, 0);
body.add(armR);

const legL = makeLimb(0.26, 0.11, M.white);
legL.position.set(-0.2, -0.28, 0);
body.add(legL);

const legR = makeLimb(0.26, 0.11, M.white);
legR.position.set(0.2, -0.28, 0);
body.add(legR);

const tail = new THREE.Group();
tail.position.set(0, 0.05, -0.42);
const tailMesh = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.3, 6, 12), M.white));
tailMesh.rotation.x = Math.PI / 2.6;
tailMesh.position.set(0, 0.08, -0.16);
tail.add(tailMesh);
const tailTip = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), M.patch));
tailTip.position.set(0, 0.2, -0.3);
tail.add(tailTip);
body.add(tail);

// ---------- アニメーション状態マシン ----------
// ループ状態: 'idle' | 'run' | 'dance'(ウェイトをクロスフェード)
// ワンショット: jump / spin / wave / bow / flip(状態の上に重ねがけ)
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

const LOOP_STATES = ['idle', 'run', 'dance'];
const STATE_LABELS = { idle: '待機', run: '走る', dance: 'ダンス' };
const ONESHOT_LABELS = { jump: 'はねる!', spin: 'スピン!', wave: '手をふる', bow: 'おじぎ', flip: 'バク宙!' };
const ONESHOT_DURATIONS = { jump: 0.75, spin: 0.8, wave: 1.3, bow: 1.4, flip: 1.0 };

const anim = {
  state: 'idle',
  blend: { idle: 1, run: 0, dance: 0 },
  oneShot: null,     // { name, t, duration }
  runAngle: 0,       // 円周走行の現在角度
  heading: 0,        // root の向き(スピンのオフセットと合成するため分離)
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
  if (anim.oneShot) return; // 再生中は新規受付しない
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
});

// ---------- ループ状態のポーズ ----------
function applyIdle(time, w) {
  if (w <= 0.001) return;
  body.scale.y += Math.sin(time * 2.2) * 0.03 * w;
  body.position.y += Math.sin(time * 2.2) * 0.015 * w;
  head.rotation.z += Math.sin(time * 0.9) * 0.05 * w;
  earL.rotation.z += Math.sin(time * 3.1) * 0.04 * w;
  earR.rotation.z += -Math.sin(time * 3.1 + 0.4) * 0.04 * w;
  armL.rotation.z += 0.18 * w + Math.sin(time * 2.2) * 0.04 * w;
  armR.rotation.z += -0.18 * w - Math.sin(time * 2.2) * 0.04 * w;
  tail.rotation.x += Math.sin(time * 1.6) * 0.12 * w;
}

function applyRun(time, w, dt) {
  if (w <= 0.001) return;
  const cycle = time * 11;

  anim.runAngle += dt * 0.9 * w;
  const R = 3.2;
  root.position.x = Math.cos(-anim.runAngle) * R * w;
  root.position.z = Math.sin(-anim.runAngle) * R * w;
  anim.heading = anim.runAngle + Math.PI; // 進行方向(円の接線方向)

  armL.rotation.x += Math.sin(cycle) * 1.1 * w;
  armR.rotation.x += Math.sin(cycle + Math.PI) * 1.1 * w;
  legL.rotation.x += Math.sin(cycle + Math.PI) * 1.2 * w;
  legR.rotation.x += Math.sin(cycle) * 1.2 * w;

  body.position.y += Math.abs(Math.sin(cycle)) * 0.12 * w;
  body.rotation.x += 0.22 * w;
  head.rotation.x += -0.12 * w;
  earL.rotation.x += -0.35 * w;
  earR.rotation.x += -0.35 * w;
  tail.rotation.x += (-0.4 + Math.sin(cycle) * 0.15) * w;
}

function applyDance(time, w) {
  if (w <= 0.001) return;
  const beat = time * 6; // リズム

  // 弾む&腰をふる
  body.position.y += Math.abs(Math.sin(beat)) * 0.09 * w;
  body.rotation.z += Math.sin(beat) * 0.12 * w;
  body.rotation.y += Math.sin(beat * 0.5) * 0.25 * w;

  // 腕を交互に突き上げる
  armL.rotation.z += (0.9 + Math.sin(beat) * 1.1) * w;
  armR.rotation.z += (-0.9 + Math.sin(beat) * 1.1) * w;

  // ステップ
  legL.rotation.x += Math.max(0, Math.sin(beat)) * 0.5 * w;
  legR.rotation.x += Math.max(0, -Math.sin(beat)) * 0.5 * w;

  // 頭・耳・しっぽもノリノリに
  head.rotation.z += Math.sin(beat + 0.5) * 0.15 * w;
  earL.rotation.z += Math.sin(beat * 2) * 0.15 * w;
  earR.rotation.z += -Math.sin(beat * 2 + 0.3) * 0.15 * w;
  tail.rotation.x += Math.sin(beat * 2) * 0.25 * w;
}

// ---------- ワンショットアクション ----------
function applyJump(t) {
  if (t < 0.18) {
    const k = t / 0.18; // 予備動作: しゃがむ
    body.scale.y *= 1 - 0.22 * k;
    body.scale.x *= 1 + 0.12 * k;
    body.scale.z *= 1 + 0.12 * k;
  } else {
    const k = (t - 0.18) / 0.82;
    root.position.y = Math.sin(k * Math.PI) * 1.5;
    const stretch = Math.sin(k * Math.PI) * 0.18;
    body.scale.y *= 1 + stretch;
    body.scale.x *= 1 - stretch * 0.5;
    body.scale.z *= 1 - stretch * 0.5;
    armL.rotation.z += 2.4 * Math.sin(k * Math.PI);
    armR.rotation.z += -2.4 * Math.sin(k * Math.PI);
    legL.rotation.x += -0.5 * Math.sin(k * Math.PI);
    legR.rotation.x += -0.5 * Math.sin(k * Math.PI);
    if (k > 0.92) {
      const land = (k - 0.92) / 0.08;
      body.scale.y *= 1 - 0.15 * Math.sin(land * Math.PI);
    }
  }
}

function applySpin(t) {
  // その場で1回転ターン(小さくホップしながら)
  anim.spinOffset = Math.PI * 2 * easeInOut(t);
  root.position.y += Math.sin(t * Math.PI) * 0.25;
  armL.rotation.z += 1.2 * Math.sin(t * Math.PI);
  armR.rotation.z += -1.2 * Math.sin(t * Math.PI);
  earL.rotation.z += 0.3 * Math.sin(t * Math.PI);
  earR.rotation.z += -0.3 * Math.sin(t * Math.PI);
}

function applyWave(t) {
  // 右手を大きくふる挨拶
  const raise = Math.min(1, t / 0.2) * Math.min(1, (1 - t) / 0.2); // 上げ下げのエンベロープ
  armR.rotation.z += -2.6 * raise;
  armR.rotation.x += Math.sin(t * Math.PI * 6) * 0.5 * raise; // ふりふり
  head.rotation.z += -0.12 * raise;
  body.rotation.z += 0.06 * raise;
}

function applyBow(t) {
  // ていねいなおじぎ(下げて → 保持 → 戻す)
  let k;
  if (t < 0.3) k = easeInOut(t / 0.3);
  else if (t < 0.7) k = 1;
  else k = 1 - easeInOut((t - 0.7) / 0.3);
  body.rotation.x += 0.65 * k;
  head.rotation.x += 0.15 * k;
  armL.rotation.x += -0.3 * k;
  armR.rotation.x += -0.3 * k;
  earL.rotation.x += 0.4 * k;
  earR.rotation.x += 0.4 * k;
}

function applyFlip(t) {
  if (t < 0.15) {
    const k = t / 0.15; // 予備動作: 深くしゃがむ
    body.scale.y *= 1 - 0.28 * k;
    body.scale.x *= 1 + 0.14 * k;
    body.scale.z *= 1 + 0.14 * k;
    body.rotation.x += 0.2 * k;
  } else {
    const k = (t - 0.15) / 0.85;
    root.position.y = Math.sin(k * Math.PI) * 1.9;      // 高く跳んで
    body.rotation.x += -Math.PI * 2 * easeInOut(k);      // 後方に1回転
    const tuck = Math.sin(k * Math.PI);                  // 空中で丸まる
    legL.rotation.x += -1.6 * tuck;
    legR.rotation.x += -1.6 * tuck;
    armL.rotation.x += -1.2 * tuck;
    armR.rotation.x += -1.2 * tuck;
    if (k > 0.9) {
      const land = (k - 0.9) / 0.1; // 着地スクワッシュ
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
  body.position.y = 0.62;
  body.rotation.set(0, 0, 0);
  head.rotation.set(0, 0, 0);
  earL.rotation.set(0, 0, 0.35);
  earR.rotation.set(0, 0, -0.35);
  armL.rotation.set(0, 0, 0.18);
  armR.rotation.set(0, 0, -0.18);
  legL.rotation.set(0, 0, 0);
  legR.rotation.set(0, 0, 0);
  tail.rotation.set(0, 0, 0);
  root.position.y = 0;
  anim.spinOffset = 0;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  // 状態ウェイトのクロスフェード
  for (const s of ['run', 'dance']) {
    const target = anim.state === s ? 1 : 0;
    anim.blend[s] += (target - anim.blend[s]) * Math.min(1, dt * 6);
  }
  anim.blend.idle = Math.max(0, 1 - anim.blend.run - anim.blend.dance);

  // 走行以外ではセンターへ滑らかに帰す
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

animate();
