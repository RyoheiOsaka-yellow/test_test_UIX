// カタログ製品のサムネイル（小さな 3D スナップ）: 専用の軽量レンダラで 1 件ずつ生成してキャッシュ
// 永続化: IndexedDB（anglex-thumbs）に書き込み、次回以降は描画せずに即表示。IndexedDB が使えない環境は localStorage（上限あり）へ
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildInstance } from '../bim/build.js';
import { familyById } from '../bim/families.js';
import { resolveParams } from '../bim/params.js';
import { productParams } from './catalog.js';
import { CATALOG } from '../data/catalog.js';

const W = 240, H = 160, VER = 'v3'; // VER: 描画仕様を変えたら上げる（旧キャッシュを無効化）
let R = null; const cache = new Map(); const queue = []; let pumping = false;
const STORE_KEY = 'anglex.thumbs.' + VER + '.' + String(CATALOG.generatedAt || CATALOG.products.length);

// ---- 永続ストア（IndexedDB → localStorage フォールバック）----
let dbP = null, loaded = null; const pendingWrites = new Map(); let flushT = null;
function openDB() { if (dbP) return dbP; dbP = new Promise(res => { try { const rq = indexedDB.open('anglex-thumbs', 1); rq.onupgradeneeded = () => { rq.result.createObjectStore('thumbs'); }; rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); rq.onblocked = () => res(null); } catch { res(null); } }); return dbP; }
// 初回に全件をメモリへ読み込む（1 トランザクション）。以後は同期的にヒットする
export function loadThumbCache() {
  if (loaded) return loaded;
  loaded = (async () => {
    const db = await openDB();
    if (db) { try { const rows = await new Promise((res, rej) => { const tx = db.transaction('thumbs', 'readonly'); const rq = tx.objectStore('thumbs').get(STORE_KEY); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => rej(rq.error); }); if (rows) for (const [k, v] of Object.entries(rows)) if (!cache.has(k)) cache.set(k, v); return cache.size; } catch (e) { console.warn('thumb cache load', e.message); } }
    try { const raw = localStorage.getItem(STORE_KEY); if (raw) for (const [k, v] of Object.entries(JSON.parse(raw))) if (!cache.has(k)) cache.set(k, v); } catch { }
    return cache.size;
  })();
  return loaded;
}
function scheduleFlush() { if (flushT) return; flushT = setTimeout(() => { flushT = null; flush(); }, 800); } // スロットル（描画が続いても一定間隔で保存される）
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { clearTimeout(flushT); flushT = null; flush(); } });
async function flush() {
  if (!pendingWrites.size) return; pendingWrites.clear(); const obj = {}; for (const [k, v] of cache) if (v) obj[k] = v;
  const db = await openDB();
  if (db) { try { await new Promise((res, rej) => { const tx = db.transaction('thumbs', 'readwrite'); tx.objectStore('thumbs').put(obj, STORE_KEY); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); return; } catch (e) { console.warn('thumb cache save', e.message); } }
  try { const s = JSON.stringify(obj); if (s.length < 4.5e6) localStorage.setItem(STORE_KEY, s); } catch { }
}
export async function clearThumbCache() { cache.clear(); pendingWrites.clear(); const db = await openDB(); if (db) try { await new Promise(res => { const tx = db.transaction('thumbs', 'readwrite'); tx.objectStore('thumbs').clear(); tx.oncomplete = res; tx.onerror = res; }); } catch { } try { localStorage.removeItem(STORE_KEY); } catch { } }

function renderer() {
  if (R) return R;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' }); r.setPixelRatio(1); r.setSize(W, H, false); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.background = null; try { const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; } catch { }
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 0.9)); const sun = new THREE.DirectionalLight(0xfff4e6, 1.5); sun.position.set(1, 2.2, 1.4); scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, W / H, 1, 100000); R = { r, scene, cam }; return R;
}
export const thumbKey = (p, sku) => p.pid + '|' + (sku ? sku.sku : '');
// cb(url) は キャッシュヒット時は同期、未生成時は描画後に呼ばれる
export function thumbFor(p, sku, cb) { const key = thumbKey(p, sku); if (cache.has(key)) { cb(cache.get(key)); return; } if (queue.some(j => j.key === key)) { queue.find(j => j.key === key).cbs.push(cb); return; } queue.push({ p, sku, key, cbs: [cb] }); pump(); }
export function thumbCached(p, sku) { return cache.get(thumbKey(p, sku)) || null; }
let renderMs = 0, renderN = 0; export const thumbRenderAvg = () => renderN ? renderMs / renderN : 0;
function pump() { if (pumping) return; pumping = true; const step = () => { const job = queue.shift(); if (!job) { pumping = false; return; } let url = null; const t0 = performance.now(); try { url = render(job.p, job.sku); } catch (e) { console.warn('thumb', job.key, e.message); } renderMs += performance.now() - t0; renderN++; cache.set(job.key, url); if (url) { pendingWrites.set(job.key, 1); scheduleFlush(); } for (const cb of job.cbs) cb(url); setTimeout(step, 0); }; setTimeout(step, 0); }
// 空き時間に残りを先回りで生成（次回以降の表示を即時にする）。表示中の行が優先されるよう、1 件ずつ低優先で積む
export function warmThumbs(items, { budgetMs = 8000 } = {}) {
  const t0 = performance.now(); const todo = items.filter(([p, sku]) => !cache.has(thumbKey(p, sku)));
  const idle = window.requestIdleCallback || (f => setTimeout(() => f({ timeRemaining: () => 8 }), 60));
  const next = () => { if (!todo.length || performance.now() - t0 > budgetMs) return; if (renderN >= 3 && thumbRenderAvg() > 150) return; /* 遅い GPU（ソフトウェア描画など）では先回り生成をやめ、表示中の行だけ生成する */ if (queue.length) { idle(next); return; } const [p, sku] = todo.shift(); thumbFor(p, sku, () => idle(next)); };
  idle(next); return todo.length;
}
function render(p, sku) {
  const pp = productParams(p, sku); const fam = familyById(pp.familyId); if (!fam) return null; const params = resolveParams(fam.params, pp.params); const parts = fam.parts(params, { model: { joints: [], instances: [] }, inst: {} });
  const g = buildInstance(parts, { lod: 200, showRefs: true, showSite: true }); const { r, scene, cam } = renderer(); scene.add(g);
  let box = new THREE.Box3(); for (const ch of g.children) if (!ch.userData.ref) box.expandByObject(ch); if (box.isEmpty()) box = new THREE.Box3().setFromObject(g); if (box.isEmpty()) { scene.remove(g); return null; } const c = box.getCenter(new THREE.Vector3()); const size = box.getSize(new THREE.Vector3()); const s = Math.max(size.length(), 50);
  cam.position.copy(c).add(new THREE.Vector3(0.95, 0.6, 1.1).normalize().multiplyScalar(s * 0.95)); cam.lookAt(c); cam.near = Math.max(1, s * 0.02); cam.far = s * 6; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  r.render(scene, cam); let url = r.domElement.toDataURL('image/webp', 0.86); if (!url.startsWith('data:image/webp')) url = r.domElement.toDataURL('image/png'); scene.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); return url;
}
export function thumbCacheSize() { return cache.size; }
