// 表面仕上げマテリアル（プロシージャル）: 切削アルミ（フライス目・旋盤目）、SUS/鋼ヘアライン、電気亜鉛めっき、ねじ山法線
import * as THREE from 'three';
const cache = new Map();
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
function canvas(n) { const c = document.createElement('canvas'); c.width = c.height = n; return c; }
function tex(c, rep = 1) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 8; return t; }
export function normalFromHeight(src, strength = 2) {
  const n = src.width; const d = src.getContext('2d').getImageData(0, 0, n, n).data; const c = canvas(n); const o = c.getContext('2d'); const out = o.createImageData(n, n);
  const H = (x, y) => d[(((y + n) % n) * n + ((x + n) % n)) * 4] / 255;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength; const l = Math.hypot(dx, dy, 1); const i = (y * n + x) * 4; out.data[i] = (-dx / l * 0.5 + 0.5) * 255; out.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255; out.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; out.data[i + 3] = 255; }
  o.putImageData(out, 0, 0); return tex(c, 1);
}
// 切削アルミ: 細かい送りマーク（平行線）+ ごく薄い円弧状の刃跡
function milled(size = 512, seed = 5) {
  const r = rng(seed); const c = canvas(size); const g = c.getContext('2d'); const rc = canvas(size); const rg = rc.getContext('2d');
  g.fillStyle = '#d9dbdd'; g.fillRect(0, 0, size, size); rg.fillStyle = '#7a7a7a'; rg.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 2) { const v = 210 + r() * 16; g.strokeStyle = `rgba(${v},${v + 1},${v + 3},${0.2 + r() * 0.25})`; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y + r()); g.lineTo(size, y + r()); g.stroke(); const ro = 110 + r() * 30; rg.strokeStyle = `rgba(${ro},${ro},${ro},0.35)`; rg.beginPath(); rg.moveTo(0, y); rg.lineTo(size, y); rg.stroke(); }
  for (let i = 0; i < 26; i++) { const cx = r() * size, cy = r() * size, rad = 120 + r() * 300; g.strokeStyle = `rgba(255,255,255,${0.05 + r() * 0.08})`; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.stroke(); }
  const map = tex(c); map.colorSpace = THREE.SRGBColorSpace; return { map, roughnessMap: tex(rc), normalMap: normalFromHeight(rc, 0.35) };
}
// ヘアライン（SUS / 研磨鋼）
function hairline(size = 512, seed = 3, base = '#cfd2d5') {
  const r = rng(seed); const c = canvas(size); const g = c.getContext('2d'); const rc = canvas(size); const rg = rc.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, size, size); rg.fillStyle = '#6a6a6a'; rg.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) { const y = r() * size, w = 40 + r() * 300, v = 170 + r() * 60; g.strokeStyle = `rgba(${v},${v + 2},${v + 5},${0.25 + r() * 0.4})`; g.lineWidth = 0.6 + r(); g.beginPath(); g.moveTo(r() * size, y); g.lineTo(r() * size + w, y); g.stroke(); const ro = 90 + r() * 70; rg.strokeStyle = `rgba(${ro},${ro},${ro},0.4)`; rg.lineWidth = 1; rg.beginPath(); rg.moveTo(r() * size, y); rg.lineTo(r() * size + w, y); rg.stroke(); }
  const map = tex(c, 2); map.colorSpace = THREE.SRGBColorSpace; return { map, roughnessMap: tex(rc, 2), normalMap: normalFromHeight(rc, 0.5) };
}
function noise(size = 256, base = [196, 200, 206], amp = 12, seed = 11) {
  const r = rng(seed); const c = canvas(size); const g = c.getContext('2d'); const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) { const n = (r() - 0.5) * amp; img.data[i * 4] = base[0] + n; img.data[i * 4 + 1] = base[1] + n; img.data[i * 4 + 2] = base[2] + n; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0); const map = tex(c, 3); map.colorSpace = THREE.SRGBColorSpace; return { map };
}
export function threadNormalMap(pitchPx = 8, size = 128) {
  const key = 'thread' + pitchPx; if (cache.has(key)) return cache.get(key);
  const c = canvas(size); const g = c.getContext('2d'); const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) { const ph = ((y % pitchPx) / pitchPx) * Math.PI * 2; const ny = Math.sin(ph) * 0.85; const nz = Math.cos(ph) * 0.5 + 0.5; for (let x = 0; x < size; x++) { const i = (y * size + x) * 4; img.data[i] = 128; img.data[i + 1] = 128 + ny * 100; img.data[i + 2] = 160 + nz * 90; img.data[i + 3] = 255; } }
  g.putImageData(img, 0, 0); const t = tex(c, 1); cache.set(key, t); return t;
}
// 材質コード → マテリアル。UV は mm 単位（押出し形状）なので repeat を小さく取る
export function finishMaterial(code = 'AL', { uvScale = 1 / 60 } = {}) {
  const key = code + uvScale; if (cache.has(key)) return cache.get(key);
  let m; const low = !!globalThis.__inspectNoPBR;
  const setRep = t => { for (const k of ['map', 'roughnessMap', 'normalMap']) if (t[k]) t[k].repeat.set(uvScale, uvScale); return t; };
  switch (code) {
    case 'AL': { const t = low ? {} : setRep(milled()); m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, ...t, normalScale: new THREE.Vector2(0.12, 0.12), metalness: 0.78, roughness: 0.42, envMapIntensity: 1.05, clearcoat: 0.04, clearcoatRoughness: 0.5 }); if (low) m.color.set(0xd6d8da); break; }
    case 'S45C': { const t = low ? {} : setRep(hairline(512, 9, '#b9bcc0')); m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, ...t, normalScale: new THREE.Vector2(0.25, 0.25), metalness: 0.92, roughness: 0.34, envMapIntensity: 1.0, anisotropy: 0.5 }); if (low) m.color.set(0xb9bcc0); break; }
    case 'SUS': { const t = low ? {} : setRep(hairline()); m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, ...t, normalScale: new THREE.Vector2(0.35, 0.35), metalness: 0.95, roughness: 0.36, envMapIntensity: 1.05, anisotropy: 0.6 }); if (low) m.color.set(0xd2d5d9); break; }
    case 'EZ': { const t = low ? {} : setRep(noise(256, [200, 204, 212], 10, 11)); m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, ...t, metalness: 0.9, roughness: 0.3, envMapIntensity: 1.0 }); if (low) m.color.set(0xc6cad0); break; }
    case 'THREAD': m = new THREE.MeshStandardMaterial({ color: 0xb4b8bd, metalness: 0.9, roughness: 0.4, normalMap: low ? null : threadNormalMap(8), normalScale: new THREE.Vector2(1, 1) }); break;
    case 'GHOST': m = new THREE.MeshStandardMaterial({ color: 0x8b98a5, transparent: true, opacity: 0.28, roughness: 0.8, depthWrite: false }); break;
    default: m = new THREE.MeshStandardMaterial({ color: 0xb0b4b8, metalness: 0.7, roughness: 0.5 });
  }
  m.userData.finish = code; cache.set(key, m); return m;
}
