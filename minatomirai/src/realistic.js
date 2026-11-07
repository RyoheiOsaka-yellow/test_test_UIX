// リアル表示モード: 物理ベースの空と太陽 (時刻・季節)、影、航空写真の地表、反射する水面、樹木・街灯、AO。
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const LAT = 35.4578, LON = 139.6318;   // みなとみらい駅
export const realState = { hour: 15.0, month: 11, shadows: true, ao: true, reflections: true, photo: true, roads: true, traffic: true, exposure: 1.0 };

// 太陽位置 (高度・方位) : 簡易式。JST、均時差は無視
export function sunDirection(hour, month) {
  const N = Math.round((month - 0.5) * 30.4);
  const decl = 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + N) / 365);
  const solar = hour + (LON - 135) / 15;
  const H = (solar - 12) * 15 * Math.PI / 180, phi = LAT * Math.PI / 180;
  const sinEl = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(H);
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  const cosAz = (Math.sin(decl) - Math.sin(phi) * sinEl) / (Math.cos(phi) * Math.cos(el) + 1e-9);
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz))); if (H > 0) az = 2 * Math.PI - az;   // 北=0 時計回り
  return { el, az, dir: new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)) };
}

function waterNormalTexture(size = 512) {
  // タイル可能な値ノイズ fBm から法線マップを作る (正弦波の格子模様が遠景で目立つのを避ける)
  const c = document.createElement('canvas'); c.width = c.height = size; const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size); const d = img.data;
  const rnd = (x, y, o) => { const v = Math.sin(x * 127.1 + y * 311.7 + o * 74.7) * 43758.5453; return v - Math.floor(v); };
  const fade = t => t * t * (3 - 2 * t);
  const noise = (x, y, f, o) => { const xi = Math.floor(x * f), yi = Math.floor(y * f); const tx = fade(x * f - xi), ty = fade(y * f - yi); const w = (i, j) => rnd(((xi + i) % f + f) % f, ((yi + j) % f + f) % f, o);
    return (w(0, 0) * (1 - tx) + w(1, 0) * tx) * (1 - ty) + (w(0, 1) * (1 - tx) + w(1, 1) * tx) * ty; };
  const h = (x, y) => { let s = 0, a = 1, f = 4; for (let o = 0; o < 6; o++) { s += a * (noise(x, y, f, o) - 0.5); a *= 0.55; f *= 2; } return s; };
  const H = new Float32Array(size * size); for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) H[y * size + x] = h(x / size, y / size);
  const at = (x, y) => H[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 14, dy = (at(x, y + 1) - at(x, y - 1)) * 14;
    const n = new THREE.Vector3(-dx, -dy, 1).normalize(); const i = (y * size + x) * 4;
    d[i] = (n.x * 0.5 + 0.5) * 255; d[i + 1] = (n.y * 0.5 + 0.5) * 255; d[i + 2] = (n.z * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function initRealistic(ctx) {
  const { scene, renderer, sun, hemi, groups, header, terrainMesh, terrainSampler, flatShape, bldUniforms, composerPasses, treesGroup } = ctx;
  const R = {};
  // ---- 空 ----
  const sky = new Sky(); sky.scale.setScalar(20000); sky.visible = false; scene.add(sky);
  const su = sky.material.uniforms; su.turbidity.value = 1.4; su.rayleigh.value = 1.0; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.85;
  const pmrem = new THREE.PMREMGenerator(renderer); let envRT = null;
  // ---- 地表 (航空写真) ----
  let groundTex = null;
  if (window.__GROUND) { groundTex = new THREE.TextureLoader().load(window.__GROUND); groundTex.colorSpace = THREE.SRGBColorSpace; groundTex.anisotropy = 8; }
  const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, color: '#ffffff', roughness: 0.95, metalness: 0 });
  const groundPlain = new THREE.MeshStandardMaterial({ color: '#6b6f66', roughness: 1 });
  // ---- 水面 (反射) ----
  const seaShapes = header.water.sea.map(r => flatShape(r)).filter(Boolean);
  let water = null;
  if (seaShapes.length) {
    const geo = mergeGeometries(seaShapes.map(s => new THREE.ShapeGeometry(s)));
    water = new Water(geo, { textureWidth: 1024, textureHeight: 1024, waterNormals: waterNormalTexture(), sunDirection: new THREE.Vector3(0, 1, 0), sunColor: 0xffffff, waterColor: 0x0b3a5a, distortionScale: 0.8, fog: true, alpha: 1 });
    water.rotation.x = -Math.PI / 2; water.position.y = 0.3; water.visible = false; water.material.uniforms.size.value = 0.6; scene.add(water);
  }
  // ---- 樹木・街灯 (InstancedMesh) ----
  const trees = (header.trees || []).filter(t => t[2] === 0), lamps = (header.trees || []).filter(t => t[2] === 1);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
  const trunkG = new THREE.CylinderGeometry(0.22, 0.32, 1, 6), canopyG = new THREE.IcosahedronGeometry(1, 1);
  const trunkM = new THREE.MeshStandardMaterial({ color: '#5a4634', roughness: 1 }), canopyM = new THREE.MeshStandardMaterial({ color: '#3f7a3a', roughness: 0.9, flatShading: true });
  const trunk = new THREE.InstancedMesh(trunkG, trunkM, trees.length), canopy = new THREE.InstancedMesh(canopyG, canopyM, trees.length);
  const col = new THREE.Color();
  trees.forEach(([x, y], i) => {
    const px = x / 10, py = y / 10; const g = terrainSampler(px, py); const rnd = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    const h = 5 + rnd * 5, r = 2 + rnd * 2.2;
    P.set(px, g + h * 0.45, -py); S.set(1, h * 0.9, 1); M.compose(P, Q, S); trunk.setMatrixAt(i, M);
    P.set(px, g + h * 0.9, -py); S.set(r, r * 0.85, r); M.compose(P, Q, S); canopy.setMatrixAt(i, M);
    canopy.setColorAt(i, col.setHSL(0.27 + rnd * 0.08, 0.45, 0.28 + rnd * 0.12));
  });
  trunk.castShadow = canopy.castShadow = true; canopy.receiveShadow = true;
  const poleG = new THREE.CylinderGeometry(0.08, 0.12, 1, 5), lampG = new THREE.SphereGeometry(0.35, 6, 4);
  const poleM = new THREE.MeshStandardMaterial({ color: '#8a8f96', roughness: 0.6, metalness: 0.5 }), lampM = new THREE.MeshStandardMaterial({ color: '#fff2c8', emissive: '#ffd27a', emissiveIntensity: 0 });
  const pole = new THREE.InstancedMesh(poleG, poleM, lamps.length), lamp = new THREE.InstancedMesh(lampG, lampM, lamps.length);
  lamps.forEach(([x, y], i) => { const px = x / 10, py = y / 10; const g = terrainSampler(px, py); P.set(px, g + 4.5, -py); S.set(1, 9, 1); M.compose(P, Q, S); pole.setMatrixAt(i, M); P.set(px, g + 9.2, -py); S.set(1, 1, 1); M.compose(P, Q, S); lamp.setMatrixAt(i, M); });
  treesGroup.add(trunk, canopy, pole, lamp); treesGroup.visible = false;
  // ---- 影 ----
  renderer.shadowMap.enabled = false; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 1.2; sun.shadow.radius = 2;
  const sc = sun.shadow.camera; sc.left = -1700; sc.right = 1700; sc.top = 1500; sc.bottom = -1500; sc.near = 10; sc.far = 6000; sc.updateProjectionMatrix();
  scene.add(sun.target);
  let on = false; const saved = { sunPos: sun.position.clone(), sunInt: sun.intensity, sunCol: sun.color.clone(), hemiInt: hemi.intensity, hemiSky: hemi.color.clone(), hemiGround: hemi.groundColor.clone(), terrainMat: terrainMesh.material, exposure: renderer.toneMappingExposure };

  function updateSun() {
    const { el, dir } = sunDirection(realState.hour, realState.month);
    su.sunPosition.value.copy(dir);
    const day = THREE.MathUtils.smoothstep(el, -0.08, 0.18);   // 0 夜 .. 1 昼
    sun.position.copy(dir).multiplyScalar(3000); sun.target.position.set(0, 0, 0);
    sun.intensity = 0.05 + 2.4 * day; sun.color.setHSL(0.09, 0.6, 0.5 + 0.5 * THREE.MathUtils.smoothstep(el, 0, 0.35));
    hemi.intensity = 0.15 + 0.1 * day; hemi.color.setHSL(0.6, 0.5, 0.35 + 0.45 * day); hemi.groundColor.setHSL(0.1, 0.3, 0.12 + 0.3 * day);
    renderer.toneMappingExposure = realState.exposure * (0.85 - 0.4 * day);
    scene.fog.color.setHSL(0.58, 0.2 + 0.2 * day, 0.08 + 0.7 * day); scene.fog.density = 0.00022; scene.background = null;
    bldUniforms.uNight.value = 1 - day;            // 窓明かりは夜だけ
    lampM.emissiveIntensity = (1 - day) * 2.5; bldUniforms.uWindows.value = realState.windows !== false ? 1 : 0;
    if (water) { water.material.uniforms.sunDirection.value.copy(dir).normalize(); water.material.uniforms.sunColor.value.setScalar(0.2 + 0.6 * day); water.material.uniforms.waterColor.value.setHSL(0.56, 0.55, 0.05 + 0.1 * day); }
    if (envRT) envRT.dispose(); sky.visible = true; const mie = su.mieCoefficient.value; su.mieCoefficient.value = 0; envRT = pmrem.fromScene(sky, 0.04); su.mieCoefficient.value = mie; sky.visible = on; scene.environment = on ? envRT.texture : null;
    scene.environmentIntensity = 0.25 - 0.15 * day;
    if (ctx.farGround) ctx.farGround.material.color.setHSL(0.57, 0.08, 0.03 + 0.6 * day);
  }
  function enable(v) {
    on = v;
    sky.visible = v; if (water) water.visible = v && realState.reflections; treesGroup.visible = v;
    renderer.shadowMap.enabled = v && realState.shadows; renderer.shadowMap.needsUpdate = true;
    terrainMesh.material = v ? (realState.photo && groundTex ? groundMat : groundPlain) : saved.terrainMat; terrainMesh.receiveShadow = v; terrainMesh.position.y = v ? 0 : -0.4;
    composerPasses.gtao.enabled = v && realState.ao; composerPasses.smaa.enabled = v;
    if (v) updateSun();
    else { sun.position.copy(saved.sunPos); sun.intensity = saved.sunInt; sun.color.copy(saved.sunCol); hemi.intensity = saved.hemiInt; hemi.color.copy(saved.hemiSky); hemi.groundColor.copy(saved.hemiGround); renderer.toneMappingExposure = saved.exposure; scene.environment = null; bldUniforms.uNight.value = 1; }
    scene.traverse(o => { if (o.material && o.material.isMaterial) o.material.needsUpdate = true; });
  }
  function update(dt) { if (on && water && water.visible) water.material.uniforms.time.value += dt * 0.6; }
  function applyOptions() { if (on) enable(true); }
  return { enable, updateSun, update, applyOptions, get on() { return on; }, water, trunk, canopy };
}
