'use strict';
/* ================================================================
   xStadium — Crypto.com Arena デジタルツイン / 1to1 マーケティング基盤
   L0 サイト俯瞰(DTLA実GIS) / L1 エントランス広場 / L2 ボウル内部(19,079席)
   GIS: OpenStreetMap (ODbL) — ローカルENU座標系 x=東(m), y=北(m) → 描画 z=-y
================================================================ */
const ld = { bar: document.getElementById('ld-bar'), st: document.getElementById('ld-st') };
const setLoad = (p, s) => { ld.bar.style.width = p + '%'; ld.st.textContent = s; };

/* ---- 汎用ユーティリティ ---- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hex = c => '#' + c.toString(16).padStart(6, '0');
const fmt = n => Math.round(n).toLocaleString('en-US');
const usd = n => '$' + fmt(n);
/* 決定的PRNG（合成データの再現性を担保 / mulberry32） */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash32 = (i, salt) => {
  let h = Math.imul(i ^ salt, 2654435761) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13;
  return h >>> 0;
};
const hrand = (i, salt) => hash32(i, salt) / 4294967296;
function pick(list, r) {            // [[value, weight], ...] から重み付き抽選
  let s = 0; for (const e of list) s += e[1];
  let x = r * s;
  for (const e of list) { x -= e[1]; if (x <= 0) return e[0]; }
  return list[list.length - 1][0];
}

/* IFC風属性を持つ部材のレジストリ（L1/L2 で共有） */
const BIM_ELEMS = [];
/* 表示トグル（L2 内部の見通し確保） */
const SHOW = { roof: false, truss: true, structure: true, suites: true, media: true };

/* ---- THREE 基本セットアップ ---- */
const wrap = document.getElementById('canvas-wrap');
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x080b12, 900, 5200);
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.6, 22000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x080b12, 1);
wrap.appendChild(renderer.domElement);
const el = renderer.domElement;

const hemi = new THREE.HemisphereLight(0xa8cbff, 0x101828, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 1.05);
sun.position.set(-700, 1100, 520);
scene.add(sun);
const fillLight = new THREE.DirectionalLight(0x5b8ce0, 0.45);
fillLight.position.set(600, 420, -700);
scene.add(fillLight);

/* ---- 軌道カメラ（ターゲット注視 / 慣性なし・確定的） ---- */
const cam = { tx: 0, ty: 0, tz: 0, dist: 1500, yaw: -0.62, pitch: 0.72,
              ttx: 0, tty: 0, ttz: 0, tdist: 1500, tyaw: -0.62, tpitch: 0.72, fly: 0 };
function applyCam(k) {
  if (k) {
    cam.tx = lerp(cam.tx, cam.ttx, k); cam.ty = lerp(cam.ty, cam.tty, k);
    cam.tz = lerp(cam.tz, cam.ttz, k); cam.dist = lerp(cam.dist, cam.tdist, k);
    cam.yaw = lerp(cam.yaw, cam.tyaw, k); cam.pitch = lerp(cam.pitch, cam.tpitch, k);
  }
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  camera.position.set(
    cam.tx + cam.dist * cp * Math.sin(cam.yaw),
    cam.ty + cam.dist * sp,
    cam.tz + cam.dist * cp * Math.cos(cam.yaw));
  camera.lookAt(cam.tx, cam.ty, cam.tz);
}
function flyTo(tx, ty, tz, dist, yaw, pitch) {
  cam.ttx = tx; cam.tty = ty; cam.ttz = tz;
  cam.tdist = dist; cam.tyaw = yaw; cam.tpitch = pitch; cam.fly = 1;
}
function setCam(tx, ty, tz, dist, yaw, pitch) {
  cam.tx = cam.ttx = tx; cam.ty = cam.tty = ty; cam.tz = cam.ttz = tz;
  cam.dist = cam.tdist = dist; cam.yaw = cam.tyaw = yaw; cam.pitch = cam.tpitch = pitch;
  cam.fly = 0; applyCam(0);
}

/* ---- トースト / 情報カード ---- */
const toastEl = document.getElementById('toast');
let toastTimer = null;
function toast(html, ms = 2800) {
  toastEl.innerHTML = html; toastEl.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.style.display = 'none', ms);
}
const infoEl = document.getElementById('info');
function showInfo(title, desc) {
  infoEl.querySelector('.t').textContent = title;
  infoEl.querySelector('.d').innerHTML = desc;
  infoEl.style.display = 'block';
}
const hideInfo = () => infoEl.style.display = 'none';

/* ---- リサイズ ---- */
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ---- 時間モデル（試合日タイムライン 15:00 → 24:00） ---- */
const T0 = 15 * 60, T1 = 24 * 60;
const timeState = { min: 17 * 60, play: false, speed: 26 };
const PHASES = [
  [15 * 60, '開場前'], [17 * 60, 'ゲート開場'], [18 * 60, '場内回遊・購買'],
  [19 * 60 + 30, 'ティップオフ'], [20 * 60 + 15, 'ハーフタイム'],
  [20 * 60 + 35, '後半'], [22 * 60, '終了・退場'], [23 * 60, '周辺回遊']
];
const phaseAt = m => { let p = PHASES[0][1]; for (const q of PHASES) if (m >= q[0]) p = q[1]; return p; };
const clockStr = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(Math.floor(m % 60)).padStart(2, '0');
/* 在館率カーブ: 開場から漸増 → 試合中ピーク → 終了後に急減 */
function occAt(m) {
  if (m < 17 * 60) return 0.02;
  if (m < 19 * 60 + 30) return 0.06 + 0.94 * smooth(17 * 60, 19 * 60 + 25, m);
  if (m < 22 * 60) return 1.0;
  return Math.max(0.0, 1 - smooth(22 * 60, 22 * 60 + 40, m));
}
