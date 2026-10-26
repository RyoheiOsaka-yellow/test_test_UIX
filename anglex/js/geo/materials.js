// 表面仕上げマテリアル（プロシージャルテクスチャ）— 溶融亜鉛めっきのスパングル、SUSヘアライン、電気亜鉛、サビ止め、黒皮、塩ビ、ゴム
import * as THREE from 'three';

const cache = new Map();
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
function canvas(n) { const c = document.createElement('canvas'); c.width = c.height = n; return c; }
function tex(c, repeat = 1) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 8; return t; }

// 溶融亜鉛めっき: スパングル（花模様結晶）— Voronoi 風セル + 明度差 + 粗さマップ
function spangle(size = 512, seed = 7) {
  const r = rng(seed); const c = canvas(size); const g = c.getContext('2d');
  const rc = canvas(size); const rg = rc.getContext('2d');
  const pts = []; for (let i = 0; i < 140; i++) pts.push([r() * size, r() * size, r(), r() * Math.PI * 2]);
  const img = g.createImageData(size, size), rimg = rg.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let best = 1e18, bi = 0, second = 1e18;
    for (let i = 0; i < pts.length; i++) {
      const dx = Math.abs(x - pts[i][0]), dy = Math.abs(y - pts[i][1]);
      const ddx = Math.min(dx, size - dx), ddy = Math.min(dy, size - dy);
      const d = ddx * ddx + ddy * ddy;
      if (d < best) { second = best; best = d; bi = i; } else if (d < second) second = d;
    }
    const edge = Math.min(1, (Math.sqrt(second) - Math.sqrt(best)) / 3.5); // セル境界で僅かに暗く
    const cell = pts[bi][2]; // セルごとの明度（結晶方位差）
    const fern = 0.5 + 0.5 * Math.sin((x * Math.cos(pts[bi][3]) + y * Math.sin(pts[bi][3])) * 0.35 + cell * 9); // 羽状模様
    const base = 200 + (cell - 0.5) * 22 + fern * 3 - (1 - edge) * 9 + (r() - 0.5) * 4;
    const i4 = (y * size + x) * 4; img.data[i4] = base; img.data[i4 + 1] = base + 2; img.data[i4 + 2] = base + 6; img.data[i4 + 3] = 255;
    const ro = 118 + (0.5 - cell) * 40 + (1 - edge) * 22 + fern * 8; rimg.data[i4] = rimg.data[i4 + 1] = rimg.data[i4 + 2] = ro; rimg.data[i4 + 3] = 255;
  }
  g.putImageData(img, 0, 0); rg.putImageData(rimg, 0, 0);
  const map = tex(c, 1); map.colorSpace = THREE.SRGBColorSpace; return { map, roughnessMap: tex(rc, 1), normalMap: normalFromHeight(rc, 0.9) };
}
// SUS304 ヘアライン: 横方向の筋
function hairline(size = 512, seed = 3) {
  const r = rng(seed); const c = canvas(size); const g = c.getContext('2d'); const rc = canvas(size); const rg = rc.getContext('2d');
  g.fillStyle = '#d0d3d6'; g.fillRect(0, 0, size, size); rg.fillStyle = '#6a6a6a'; rg.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) { const y = r() * size, w = 40 + r() * 300, v = 170 + r() * 60; g.strokeStyle = `rgba(${v},${v + 2},${v + 5},${0.25 + r() * 0.4})`; g.lineWidth = 0.6 + r(); g.beginPath(); g.moveTo(r() * size, y); g.lineTo(r() * size + w, y); g.stroke();
    const ro = 90 + r() * 70; rg.strokeStyle = `rgba(${ro},${ro},${ro},0.4)`; rg.lineWidth = 1; rg.beginPath(); rg.moveTo(r() * size, y); rg.lineTo(r() * size + w, y); rg.stroke(); }
  const map = tex(c, 2); map.colorSpace = THREE.SRGBColorSpace; return { map, roughnessMap: tex(rc, 2), normalMap: normalFromHeight(rc, 0.5) };
}
// 電気亜鉛めっき: 滑らかな淡青銀 + 微細ノイズ
function noise(size = 256, base = [196, 200, 206], amp = 12, seed = 11) {
  const r = rng(seed); const c = canvas(size); const g = c.getContext('2d'); const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) { const n = (r() - 0.5) * amp; img.data[i * 4] = base[0] + n; img.data[i * 4 + 1] = base[1] + n; img.data[i * 4 + 2] = base[2] + n; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0); const map = tex(c, 3); map.colorSpace = THREE.SRGBColorSpace; return { map };
}
// 黒皮（ミルスケール）: 暗灰 + 斑
function millscale(size = 512, seed = 5) {
  const r = rng(seed); const c = canvas(size); const g = c.getContext('2d'); g.fillStyle = '#3b3d40'; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) { const v = 40 + r() * 50; g.fillStyle = `rgba(${v},${v + 2},${v + 6},${0.15 + r() * 0.5})`; g.beginPath(); g.ellipse(r() * size, r() * size, 3 + r() * 30, 2 + r() * 12, r() * 3, 0, 6.3); g.fill(); }
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(120,80,50,${r() * 0.25})`; g.beginPath(); g.ellipse(r() * size, r() * size, 2 + r() * 10, 2 + r() * 6, r() * 3, 0, 6.3); g.fill(); }
  const map = tex(c, 2); map.colorSpace = THREE.SRGBColorSpace; return { map };
}
// ねじ山（円筒のUV v方向に縞）: 法線マップとして使う
export function threadNormalMap(pitchPx = 8, size = 128) {
  const key = 'thread' + pitchPx; if (cache.has(key)) return cache.get(key);
  const c = canvas(size); const g = c.getContext('2d'); const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) { const ph = ((y % pitchPx) / pitchPx) * Math.PI * 2; const ny = Math.sin(ph) * 0.85; const nz = Math.cos(ph) * 0.5 + 0.5;
    for (let x = 0; x < size; x++) { const i = (y * size + x) * 4; img.data[i] = 128; img.data[i + 1] = 128 + ny * 100; img.data[i + 2] = 160 + nz * 90; img.data[i + 3] = 255; } }
  g.putImageData(img, 0, 0); const t = tex(c, 1); cache.set(key, t); return t;
}
// 溶接ビードの波紋（リップル）法線マップ
export function weldNormalMap(size = 256) {
  const key = 'weldN'; if (cache.has(key)) return cache.get(key);
  const c = canvas(size); const g = c.getContext('2d'); const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size; // u: along bead, v: across
    const arc = Math.sin((u * 14 + Math.pow(Math.abs(v - 0.5) * 2, 1.4) * 1.6) * Math.PI * 2); // うろこ状の円弧
    const nx = arc * 0.7 * (0.4 + 0.6 * (1 - Math.abs(v - 0.5) * 2)); const ny = Math.cos((u * 14) * Math.PI * 2) * 0.25;
    const i = (y * size + x) * 4; img.data[i] = 128 + nx * 90; img.data[i + 1] = 128 + ny * 90; img.data[i + 2] = 230; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0); const t = tex(c, 1); cache.set(key, t); return t;
}

// 高さ場（canvas 明度）→ 法線マップ
export function normalFromHeight(srcCanvas, strength = 2.0) {
  const size = srcCanvas.width; const g = srcCanvas.getContext('2d'); const src = g.getImageData(0, 0, size, size).data; const c = canvas(size); const o = c.getContext('2d'); const out = o.createImageData(size, size);
  const H = (x, y) => src[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength; const l = Math.hypot(dx, dy, 1); const i = (y * size + x) * 4; out.data[i] = (-dx / l * 0.5 + 0.5) * 255; out.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255; out.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; out.data[i + 3] = 255; }
  o.putImageData(out, 0, 0); return tex(c, 1);
}
// Polyhaven（CC0）PBR テクスチャの非同期ロード。失敗時はプロシージャルのまま。
const PH = 'https://api.polyhaven.com/files/'; const phCache = new Map();
export async function loadPolyhaven(name, { res = '1k', repeat = 1 } = {}) {
  const key = name + res; if (phCache.has(key)) return phCache.get(key);
  const p = (async () => { const r = await fetch(PH + name); if (!r.ok) throw new Error('polyhaven ' + name); const f = await r.json(); const url = (k) => f[k]?.[res]?.jpg?.url; const ld = new THREE.TextureLoader(); ld.setCrossOrigin('anonymous');
    const load = u => new Promise((ok, ng) => u ? ld.load(u, t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 8; ok(t); }, undefined, ng) : ok(null));
    const [map, normalMap, armMap, roughMap] = await Promise.all([load(url('Diffuse')), load(url('nor_gl')), load(url('arm')), load(url('Rough'))]); if (map) map.colorSpace = THREE.SRGBColorSpace; return { map, normalMap, armMap, roughMap }; })();
  phCache.set(key, p); return p;
}
// 既存マテリアルへ Polyhaven マップを適用（アルベドは tint と乗算）
export function upgradeMaterial(m, name, { repeat = 1, normalScale = 0.6, useAlbedo = true } = {}) {
  if (globalThis.__anglexNoPBR) return m;
  loadPolyhaven(name, { repeat }).then(t => { if (!m) return; if (useAlbedo && t.map) { m.map = t.map; } if (t.normalMap) { m.normalMap = t.normalMap; m.normalScale = new THREE.Vector2(normalScale, normalScale); } if (t.roughMap) { m.roughnessMap = t.roughMap; } if (t.armMap) { m.aoMap = t.armMap; m.aoMapIntensity = 0.8; } m.needsUpdate = true; }).catch(() => { });
  return m;
}
export const FINISH_COLORS = { HDZ: 0xb9bdc2, HDZ35: 0xb9bdc2, HDZ55: 0xb5b9be, EZ: 0xc6cad0, SUS304: 0xd2d5d9, ZAM: 0xc0c4c8, PAINT: 0x8c3b2b, BLACK: 0x3d3f42, PVC: 0x9ea3a8, RUBBER: 0x222426, ZINC_PAINT: 0xa9adb1, BOLT: 0xb4b8bd, WELD: 0x6f7378, CONCRETE: 0xa8a39a, GLASS: 0x9ec8e0 };

// finish コード → MeshStandardMaterial（キャッシュ）
export function finishMaterial(finish = 'HDZ', opts = {}) {
  const key = finish + JSON.stringify(opts); if (cache.has(key)) return cache.get(key);
  let m;
  switch (finish) {
    case 'HDZ': case 'HDZ35': case 'HDZ45': case 'HDZ55': { const t = spangle(512, 7 + (finish.length)); m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: t.map, roughnessMap: t.roughnessMap, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.18, 0.18), metalness: 0.72, roughness: 0.5, envMapIntensity: 1.15, clearcoat: 0.05, clearcoatRoughness: 0.5 }); break; }
    case 'SUS304': case 'SUS': { const t = hairline(); m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: t.map, roughnessMap: t.roughnessMap, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.4, 0.4), metalness: 0.95, roughness: 0.36, envMapIntensity: 1.05, anisotropy: 0.6 }); upgradeMaterial(m, 'metal_plate', { repeat: 1, normalScale: 0.35, useAlbedo: false }); break; }
    case 'EZ': { const t = noise(256, [200, 204, 212], 10, 11); m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: t.map, metalness: 0.9, roughness: 0.28, envMapIntensity: 1.0 }); upgradeMaterial(m, 'metal_plate_02', { repeat: 1, normalScale: 0.25, useAlbedo: false }); break; }
    case 'ZAM': { const t = noise(256, [186, 190, 194], 14, 12); m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: t.map, metalness: 0.8, roughness: 0.45 }); break; }
    case 'PAINT': m = new THREE.MeshPhysicalMaterial({ color: FINISH_COLORS.PAINT, metalness: 0.0, roughness: 0.72, clearcoat: 0.15, clearcoatRoughness: 0.6 }); upgradeMaterial(m, 'metal_plate', { normalScale: 0.3, useAlbedo: false }); break;
    case 'BLACK': { const t = millscale(); m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: t.map, metalness: 0.55, roughness: 0.78 }); upgradeMaterial(m, 'rusty_metal_04', { repeat: 1, normalScale: 0.6, useAlbedo: false }); break; }
    case 'PVC': m = new THREE.MeshStandardMaterial({ color: FINISH_COLORS.PVC, metalness: 0.0, roughness: 0.55 }); break;
    case 'RUBBER': m = new THREE.MeshStandardMaterial({ color: FINISH_COLORS.RUBBER, metalness: 0.0, roughness: 0.95 }); break;
    case 'BOLT': { const t = noise(256, [190, 194, 200], 14, 31); m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: t.map, metalness: 0.92, roughness: 0.34, envMapIntensity: 1.0 }); break; }
    case 'THREAD': { m = new THREE.MeshStandardMaterial({ color: 0xaeb2b7, metalness: 0.9, roughness: 0.42, normalMap: threadNormalMap(8), normalScale: new THREE.Vector2(1.0, 1.0) }); break; }
    case 'WELD': { m = new THREE.MeshStandardMaterial({ color: 0x7c8086, metalness: 0.75, roughness: 0.55, normalMap: weldNormalMap(), normalScale: new THREE.Vector2(1.2, 1.2) }); break; }
    case 'CONCRETE': { const t = noise(256, [168, 164, 156], 22, 21); m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: t.map, metalness: 0, roughness: 0.95 }); upgradeMaterial(m, 'concrete_floor_02', { repeat: 20, normalScale: 0.7, useAlbedo: true }); break; }
    case 'PIPE': m = new THREE.MeshStandardMaterial({ color: 0x2a7d8c, metalness: 0.35, roughness: 0.5 }); break;
    case 'GHOST': m = new THREE.MeshStandardMaterial({ color: 0x8b98a5, transparent: true, opacity: 0.28, roughness: 0.8, depthWrite: false }); break;
    default: m = new THREE.MeshStandardMaterial({ color: opts.color || 0xb0b4b8, metalness: 0.7, roughness: 0.5 });
  }
  if (opts.color && finish !== 'PAINT') m.color.set(opts.color);
  m.userData.finish = finish; m.side = THREE.FrontSide; cache.set(key, m); return m;
}
export function clearMaterialCache() { cache.clear(); }
