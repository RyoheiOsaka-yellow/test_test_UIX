// 3D の画面で基準線を引く。クリックした点を順につないで線にし、その場で架台（基準線フレーム）に組み込む。
//   ・引く面は、見ている向きから自動で選ぶ（上から見ていれば平面、横からなら立面）。Tab で切り替えられる
//   ・点は 50 mm の格子に乗る。すでにある線の端や線の途中の近くでは、そこに吸い付く（T 字や角を作りやすい）
//   ・直前の点から見て水平・鉛直に近いときは、まっすぐに揃える（Shift を押している間は揃えない）
//   ・Enter または Esc で終了、Backspace で 1 本戻す。同じ点をもう一度クリックすると、続きをやめて新しい線を始められる
import * as THREE from 'three';
import { h, toast } from './common.js';
import { parseWire, wireDSL } from '../bim/skeleton.js';

const GRID = 50; const PLANE_JA = { xy: '正面の立面（X–高さ）', zy: '側面の立面（奥行–高さ）', xz: '平面（X–奥行）' }; const ORDER = ['xy', 'zy', 'xz'];
const r1 = v => Math.round(v * 10) / 10;

export function startWireDraw(app, { inst = null, typeParams = null } = {}) { if (app.wireDraw) stopWireDraw(app, true); const v = app.viewer; if (app.view !== '3d') app.setView?.('3d');
  const st = app.wireDraw = { inst, typeParams: typeParams || { spec: 'L-50x50x6' }, last: null, plane: null, auto: true, added: 0, group: new THREE.Group(), cursor: null, hud: null }; st.group.name = 'wire-draw'; v.scene.add(st.group);
  const mat = new THREE.LineBasicMaterial({ color: 0xb4502d, depthTest: false, transparent: true }); st.band = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), mat); st.band.renderOrder = 999; st.band.visible = false; st.group.add(st.band);
  st.dot = new THREE.Mesh(new THREE.SphereGeometry(9, 12, 8), new THREE.MeshBasicMaterial({ color: 0x1f4e79, depthTest: false, transparent: true })); st.dot.renderOrder = 1000; st.dot.visible = false; st.group.add(st.dot);
  const stage = document.querySelector('#d3stage') || document.querySelector('#stage') || document.body; st.hud = h('div', { class: 'wire-hud', style: { position: 'absolute', left: '50%', top: '58px', transform: 'translateX(-50%)', zIndex: 40, background: '#1f1e1a', color: '#fff', borderRadius: '18px', padding: '6px 14px', fontSize: '13px', boxShadow: '0 6px 18px rgba(0,0,0,.25)', pointerEvents: 'none', whiteSpace: 'nowrap' } }, ''); stage.appendChild(st.hud);
  const el = v.renderer.domElement; st.onMove = e => { st.shift = e.shiftKey; const p = pointAt(app, e); st.cursor = p; redraw(app); }; el.addEventListener('pointermove', st.onMove);
  st.onKey = e => { if (e.target?.matches?.('input,textarea,select')) return; if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); stopWireDraw(app); } else if (e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); st.auto = false; st.plane = ORDER[(ORDER.indexOf(st.plane || 'xy') + 1) % 3]; redraw(app); } else if (e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); undoLast(app); } }; window.addEventListener('keydown', st.onKey, true);
  document.body.classList.add('wire-drawing'); el.style.cursor = 'crosshair'; redraw(app); toast('線を引く: 3D の中をクリックして点を置いていきます（Enter で終了）', 'info', 5000); return st; }
export function stopWireDraw(app, quiet = false) { const st = app.wireDraw; if (!st) return null; const v = app.viewer; v.renderer.domElement.removeEventListener('pointermove', st.onMove); window.removeEventListener('keydown', st.onKey, true); v.scene.remove(st.group); st.band.geometry.dispose(); st.dot.geometry.dispose(); st.hud.remove(); document.body.classList.remove('wire-drawing'); v.renderer.domElement.style.cursor = ''; app.wireDraw = null; v.invalidate?.();
  if (!quiet) { if (st.added && st.inst) { app.select?.(st.inst.id); app.refreshBrowser?.(); toast(`${st.inst.mark}: 線 ${st.added} 本を引きました。部材と端部は自動で組んであります`, 'ok', 5000); } else toast('線を引くのをやめました', 'info', 2500); } return st; }

// 今ある線（架台の座標）と、その節点（ワールド座標）
function curLines(app) { const st = app.wireDraw; if (!st.inst) return []; return parseWire(app.model.resolved(st.inst).lines); }
function toWorld(app, p) { const st = app.wireDraw; const g = st.inst ? app.groups.get(st.inst.id) : null; const w = new THREE.Vector3(...p); if (g) { g.updateWorldMatrix(true, false); w.applyMatrix4(g.matrixWorld); } return w; }
function toLocal(app, w) { const st = app.wireDraw; const g = st.inst ? app.groups.get(st.inst.id) : null; const q = w.clone(); if (g) { g.updateWorldMatrix(true, false); q.applyMatrix4(g.matrixWorld.clone().invert()); } return [r1(q.x), r1(q.y), r1(q.z)]; }
function autoPlane(app) { const v = app.viewer; const f = new THREE.Vector3(); v.activeCamera.getWorldDirection(f); if (Math.abs(f.y) > 0.72) return 'xz'; return Math.abs(f.z) >= Math.abs(f.x) ? 'xy' : 'zy'; }
// 画面の点 → 引く面の上の点（格子・節点・線への吸い付き、水平 / 鉛直への揃え）
export function pointAt(app, e) { const st = app.wireDraw; const v = app.viewer; const el = v.renderer.domElement; const r = el.getBoundingClientRect(); const cam = v.activeCamera; const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, cam);
  if (st.auto || !st.plane) st.plane = autoPlane(app); const base = st.last || new THREE.Vector3(0, 0, 0); const n = st.plane === 'xz' ? new THREE.Vector3(0, 1, 0) : st.plane === 'xy' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0); const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, base); const hit = new THREE.Vector3(); if (!ray.ray.intersectPlane(plane, hit)) return null;
  const px = w => { const q = w.clone().project(cam); return [(q.x + 1) / 2 * r.width + r.left, (1 - q.y) / 2 * r.height + r.top]; }; const near = (w, lim) => { const [x, y] = px(w); return Math.hypot(x - e.clientX, y - e.clientY) < lim; };
  // 1) 節点、2) 線の途中、3) 格子（+ 直前の点から水平・鉛直に揃える）
  const lines = curLines(app).map(l => ({ a: toWorld(app, l.a), b: toWorld(app, l.b) })); for (const l of lines) for (const q of [l.a, l.b]) if (near(q, 14)) return { w: q.clone(), snap: 'node' };
  for (const l of lines) { const ab = l.b.clone().sub(l.a); const L = ab.length(); if (L < 1) continue; const t = Math.max(0, Math.min(1, hit.clone().sub(l.a).dot(ab) / (L * L))); const q = l.a.clone().addScaledVector(ab, Math.round(t * L / GRID) * GRID / L); if (near(q, 11)) return { w: q, snap: 'line' }; }
  const g = x => Math.round(x / GRID) * GRID; const w = new THREE.Vector3(st.plane === 'zy' ? base.x : g(hit.x), st.plane === 'xz' ? base.y : g(hit.y), st.plane === 'xy' ? base.z : g(hit.z)); let snap = 'grid';
  if (st.last && !st.shift) { const d = w.clone().sub(st.last); const L = d.length(); if (L > 1) for (const ax of ['x', 'y', 'z']) { const rest = Math.hypot(...['x', 'y', 'z'].filter(k => k !== ax).map(k => d[k])); if (rest < Math.abs(d[ax]) * 0.12) { for (const k of ['x', 'y', 'z']) if (k !== ax) w[k] = st.last[k]; snap = 'axis'; break; } } }
  return { w, snap }; }
function redraw(app) { const st = app.wireDraw; if (!st) return; const c = st.cursor; st.dot.visible = !!c; if (c) { st.dot.position.copy(c.w); const s = Math.max(0.4, app.viewer.activeCamera.position.distanceTo(c.w) / 1400); st.dot.scale.setScalar(s); st.dot.material.color.set(c.snap === 'node' ? 0x2e8b57 : c.snap === 'line' ? 0xd08a00 : 0x1f4e79); }
  st.band.visible = !!(c && st.last); if (st.band.visible) { st.band.geometry.setFromPoints([st.last, c.w]); st.band.geometry.attributes.position.needsUpdate = true; }
  const L = c && st.last ? Math.round(c.w.distanceTo(st.last)) : null; st.hud.textContent = `線を引く ・ 面: ${PLANE_JA[st.plane || 'xy']}（Tab で切替）${c ? ` ・ ${c.snap === 'node' ? '端点に吸着' : c.snap === 'line' ? '線に吸着' : c.snap === 'axis' ? 'まっすぐ' : '格子 50'}` : ''}${L != null ? ` ・ 長さ ${L} mm` : ' ・ 始点をクリック'} ・ Enter で終了 ・ Backspace で 1 本戻す`; app.viewer.invalidate?.(); }
// クリック（main.js の onPick から呼ばれる）
export function wireDrawClick(app, e) { const st = app.wireDraw; if (!st) return false; st.shift = e.shiftKey; const p = pointAt(app, e); if (!p) return true; if (!st.last) { st.last = p.w.clone(); st.cursor = p; redraw(app); return true; }
  if (p.w.distanceTo(st.last) < 10) { st.last = null; redraw(app); return true; } /* 同じ点をもう一度 → 続きをやめる */ addSegment(app, st.last, p.w); st.last = p.w.clone(); st.cursor = p; redraw(app); return true; }
function ensureInst(app) { const st = app.wireDraw; if (st.inst) return st.inst; const tp = st.typeParams; const ty = app.model.addType('wire_frame', `基準線フレーム ${tp.spec || 'L-50x50x6'}`, tp); st.inst = app.model.addInstance(ty.id, { pos: [0, 0, 0], params: { lines: '' }, level: app.model.levels?.[0]?.id || null }); st.created = true; return st.inst; }
export function addSegment(app, a, b) { const st = app.wireDraw; const inst = ensureInst(app); if (st.created && !app.groups.get(inst.id)) { app.model.updateInstance(inst.id, { pos: [0, 0, 0] }); } const lines = st.created && !st.added ? [] : curLines(app); lines.push({ a: toLocal(app, a), b: toLocal(app, b), spec: null, name: null, rot: 0 }); app.model.updateInstance(inst.id, { params: { lines: wireDSL(lines) } }); app.rebuildInstance(inst); st.added++; app.refreshBrowser?.(); return inst; }
function undoLast(app) { const st = app.wireDraw; if (!st.inst || !st.added) return; const lines = curLines(app); const gone = lines.pop(); app.model.updateInstance(st.inst.id, { params: { lines: wireDSL(lines) } }); app.rebuildInstance(st.inst); st.added--; st.last = gone ? toWorld(app, gone.a) : null; redraw(app); }
