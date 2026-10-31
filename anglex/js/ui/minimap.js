// ミニマップ: 3D の隅に全体の俯瞰（上から見た部材の外形）を小さく出し、いま見ている範囲を枠で示す。枠をドラッグ／地図をクリックで移動。
import { $, h } from './common.js';
import * as THREE from 'three';
export function installMinimap(app) {
  const stage = $('#d3stage') || $('#stage'); if (!stage || stage.querySelector('.minimap')) return null; const v = app.viewer;
  const W = 180, H = 130; const cv = h('canvas', { class: 'mm-canvas', width: W * 2, height: H * 2, style: { width: W + 'px', height: H + 'px' } }); const btn = h('button', { class: 'mm-toggle', title: 'ミニマップを畳む／開く' }, '▾ 地図');
  const box = h('div', { class: 'minimap' }, cv, btn); stage.append(box); const st = { on: true, drag: false }; app.minimap = st;
  try { if (localStorage.getItem('anglex.minimap') === '0') { st.on = false; box.classList.add('closed'); btn.textContent = '▸ 地図'; } } catch { }
  btn.addEventListener('click', () => { st.on = !st.on; box.classList.toggle('closed', !st.on); btn.textContent = st.on ? '▾ 地図' : '▸ 地図'; try { localStorage.setItem('anglex.minimap', st.on ? '1' : '0'); } catch { } if (st.on) draw(); });
  // 世界 → 地図（上から: x 右, z 下）
  let map = null; const fitMap = () => { const bb = new THREE.Box3().setFromObject(v.modelRoot); if (bb.isEmpty()) { map = null; return; } const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2; const span = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z, 1000) * 1.6; const s = Math.min(W / span, H / span); map = { cx, cz, s, cy: (bb.min.y + bb.max.y) / 2 }; };
  const toMap = (x, z) => [W / 2 + (x - map.cx) * map.s, H / 2 + (z - map.cz) * map.s]; const fromMap = (mx, my) => [map.cx + (mx - W / 2) / map.s, map.cz + (my - H / 2) / map.s];
  // 視野の足跡: 画面 4 隅のレイを モデル中心高さの水平面と交差
  const footprint = () => { const cam = v.activeCamera; const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -map.cy); const ray = new THREE.Raycaster(); const out = []; for (const [nx, ny] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ray.setFromCamera(new THREE.Vector2(nx, ny), cam); const p = new THREE.Vector3(); const hit = ray.ray.intersectPlane(plane, p); if (!hit) { const far = ray.ray.at(20000, new THREE.Vector3()); out.push([far.x, far.z]); } else out.push([p.x, p.z]); } return out; };
  const draw = () => { if (!st.on) return; fitMap(); const g = cv.getContext('2d'); g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(255,255,255,.92)'; g.fillRect(0, 0, W, H); if (!map) return;
    for (const inst of app.model.instances) { const gr = app.groups.get(inst.id); if (!gr) continue; const bb = new THREE.Box3().setFromObject(gr); if (bb.isEmpty()) continue; const [x0, y0] = toMap(bb.min.x, bb.min.z), [x1, y1] = toMap(bb.max.x, bb.max.z); const sel = inst.id === app.selection || app.multi?.has?.(inst.id); g.fillStyle = sel ? 'rgba(37,99,235,.55)' : 'rgba(80,90,105,.45)'; g.strokeStyle = sel ? '#2563eb' : '#4c5a6b'; g.lineWidth = 1; g.fillRect(x0, y0, Math.max(2, x1 - x0), Math.max(2, y1 - y0)); g.strokeRect(x0, y0, Math.max(2, x1 - x0), Math.max(2, y1 - y0)); }
    const fp = footprint().map(([x, z]) => toMap(x, z)); g.beginPath(); fp.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fillStyle = 'rgba(217,164,65,.18)'; g.fill(); g.strokeStyle = '#d9a441'; g.lineWidth = 1.5; g.stroke();
    const t = toMap(v.controls.target.x, v.controls.target.z); g.fillStyle = '#c0392b'; g.beginPath(); g.arc(t[0], t[1], 3, 0, Math.PI * 2); g.fill(); g.fillStyle = '#555'; g.font = '9px sans-serif'; g.fillText('N↑', 4, 10); };
  // クリック／ドラッグで目標点を移動（高さは維持）
  const moveTo = (mx, my, animate) => { if (!map) return; const [x, z] = fromMap(mx, my); const t0 = v.controls.target.clone(); const t1 = new THREE.Vector3(x, t0.y, z); const d = t1.clone().sub(t0); const p1 = v.camera.position.clone().add(d); if (animate) { v.pushView(); v.animateTo(p1, t1, { ms: 300 }); } else { v.controls.target.copy(t1); v.camera.position.copy(p1); v.controls.update(); v.invalidate(2); } };
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
  cv.addEventListener('pointerdown', e => { st.drag = true; try { cv.setPointerCapture(e.pointerId); } catch { } const [mx, my] = pos(e); moveTo(mx, my, true); e.preventDefault(); });
  cv.addEventListener('pointermove', e => { if (!st.drag) return; const [mx, my] = pos(e); moveTo(mx, my, false); });
  cv.addEventListener('pointerup', () => { st.drag = false; }); cv.addEventListener('pointercancel', () => { st.drag = false; });
  let raf = null; const req = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = null; draw(); }); };
  v.controls.addEventListener('change', req); app.model.on('change', () => setTimeout(req, 50)); st.redraw = req; st.draw = draw; draw(); return box;
}
