// カタログ製品のサムネイル（小さな 3D スナップ）: 専用の軽量レンダラで 1 件ずつ生成してキャッシュ
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildInstance } from '../bim/build.js';
import { familyById } from '../bim/families.js';
import { resolveParams } from '../bim/params.js';
import { productParams } from './catalog.js';

const W = 240, H = 160; let R = null; const cache = new Map(); const queue = []; let pumping = false;
function renderer() {
  if (R) return R;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' }); r.setPixelRatio(1); r.setSize(W, H, false); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.background = null; try { const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; } catch { }
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 0.9)); const sun = new THREE.DirectionalLight(0xfff4e6, 1.5); sun.position.set(1, 2.2, 1.4); scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, W / H, 1, 100000); R = { r, scene, cam }; return R;
}
export function thumbFor(p, sku, cb) { const key = p.pid + '|' + (sku ? sku.sku : ''); if (cache.has(key)) { cb(cache.get(key)); return; } if (queue.some(j => j.key === key)) { queue.find(j => j.key === key).cbs.push(cb); return; } queue.push({ p, sku, key, cbs: [cb] }); pump(); }
function pump() { if (pumping) return; pumping = true; const step = () => { const job = queue.shift(); if (!job) { pumping = false; return; } let url = null; try { url = render(job.p, job.sku); } catch (e) { console.warn('thumb', job.key, e.message); } cache.set(job.key, url); for (const cb of job.cbs) cb(url); setTimeout(step, 0); }; setTimeout(step, 0); }
function render(p, sku) {
  const pp = productParams(p, sku); const fam = familyById(pp.familyId); if (!fam) return null; const params = resolveParams(fam.params, pp.params); const parts = fam.parts(params, { model: { joints: [], instances: [] }, inst: {} });
  const g = buildInstance(parts, { lod: 200, showRefs: true, showSite: true }); const { r, scene, cam } = renderer(); scene.add(g);
  let box = new THREE.Box3(); for (const ch of g.children) if (!ch.userData.ref) box.expandByObject(ch); if (box.isEmpty()) box = new THREE.Box3().setFromObject(g); if (box.isEmpty()) { scene.remove(g); return null; } const c = box.getCenter(new THREE.Vector3()); const size = box.getSize(new THREE.Vector3()); const s = Math.max(size.length(), 50);
  cam.position.copy(c).add(new THREE.Vector3(0.95, 0.6, 1.1).normalize().multiplyScalar(s * 0.95)); cam.lookAt(c); cam.near = Math.max(1, s * 0.02); cam.far = s * 6; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  r.render(scene, cam); const url = r.domElement.toDataURL('image/png'); scene.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); return url;
}
export function thumbCacheSize() { return cache.size; }
