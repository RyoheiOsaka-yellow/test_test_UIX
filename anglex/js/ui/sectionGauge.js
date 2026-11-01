// 断面ゲージ: 寄った部材の主部材の断面（実寸比の輪郭＋穴位置）をピルの下に小さく出す。穴にホバーすると 3D 上の対応する穴がリングで光る
import { $, h } from './common.js';
import { parseSpec, sectionOutline, sectionBox, decompose } from '../geo/profiles.js';
import { holePos } from '../bim/review.js';
import * as THREE from 'three';
export function installSectionGauge(app) {
  const stage = $('#d3stage') || $('#stage'); if (!stage || stage.querySelector('.section-gauge')) return null;
  const W = 190, H = 140; const cv = h('canvas', { width: W * 2, height: H * 2, style: { width: W + 'px', height: H + 'px' } }); const title = h('div', { class: 'sg-title' }); const sel = h('select', { class: 'sg-sel', title: 'どの部材の断面を見るか' });
  const close = h('button', { class: 'icon-btn', title: '断面ゲージを隠す（ピルの「断面」で再表示）', onClick: () => { st.on = false; try { localStorage.setItem('anglex.gauge', '0'); } catch { } refresh(); } }, '✕');
  const box = h('div', { class: 'section-gauge' }, h('div', { class: 'sg-head' }, title, sel, close), cv); stage.append(box);
  const st = { on: true, inst: null, parts: [], pi: 0, marks: [], rings: [] }; app.sectionGauge = st; try { st.on = localStorage.getItem('anglex.gauge') !== '0'; } catch { }
  sel.addEventListener('change', () => { st.pi = +sel.value; draw(); });
  const clearRings = () => { for (const r of st.rings) app.viewer.overlayRoot.remove(r); st.rings = []; app.viewer.invalidate(); };
  // 部材の主部材（断面が描ける member/plate）を列挙
  const candidates = inst => { let parts = []; try { parts = app.instanceParts(inst); } catch { } return parts.map((p, i) => ({ p, i })).filter(({ p }) => !p.ref && (p.kind === 'member' || p.kind === 'plate') && parseSpec(p.spec)); };
  const draw = () => { const g = cv.getContext('2d'); g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, W, H); st.marks = []; const c = st.parts[st.pi]; if (!c) return; const pt = c.p; const sp = parseSpec(pt.spec); const out = sectionOutline(sp); const bb = sectionBox(sp); if (!out || !bb || !bb.w || !bb.h) return;
    const pad = 16; const s = Math.min((W - pad * 2) / bb.w, (H - pad * 2 - 12) / bb.h); const ox = (W - bb.w * s) / 2 - bb.x0 * s, oy = (H - 12 - bb.h * s) / 2 - bb.y0 * s + 12; const X = x => ox + x * s, Y = y => H - (oy + y * s) + 12; /* y は上向き */
    g.beginPath(); out.forEach(([x, y], i) => i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))); g.closePath(); g.fillStyle = '#dfe6ee'; g.fill(); g.strokeStyle = '#334155'; g.lineWidth = 1.2; g.stroke();
    // 寸法（幅×高さ×厚）
    g.fillStyle = '#555'; g.font = '9px sans-serif'; g.fillText(`${Math.round(bb.w)}×${Math.round(bb.h)}${sp.t ? ' t' + sp.t : ''}`, 4, 10);
    // 穴: 面ごとに (x,y) へ写像。同じ位置に重なる穴は ×n でまとめる
    const plates = decompose(sp, pt.length || 100); const groups = new Map();
    for (const hh of (pt.holes || [])) { const pl = plates.find(q => q.name === hh.face) || plates[0]; if (!pl) continue; const [u, v] = pl.map(hh.z, hh.s); const loc = new THREE.Vector3(u, v, pl.t / 2).applyMatrix4(pl.M); const key = Math.round(loc.x) + ',' + Math.round(loc.y); const grp = groups.get(key) || { x: loc.x, y: loc.y, d: hh.d, holes: [], kind: hh.kind }; grp.holes.push(hh); groups.set(key, grp); }
    for (const grp of groups.values()) { const r = Math.max(3, grp.d * s / 2); const cx = X(grp.x), cy = Y(grp.y); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = grp.kind === 'anchor' ? '#fde68a' : '#fff'; g.fill(); g.strokeStyle = '#c0392b'; g.lineWidth = 1.2; g.stroke(); if (grp.holes.length > 1) { g.fillStyle = '#c0392b'; g.font = 'bold 9px sans-serif'; g.fillText('×' + grp.holes.length, cx + r + 1, cy - r); } st.marks.push({ cx, cy, r: Math.max(r, 6), grp }); }
    if (!groups.size) { g.fillStyle = '#888'; g.font = '10px sans-serif'; g.fillText('穴なし', W - 34, H - 4); }
  };
  const refresh = () => { const inst = st.inst; const show = st.on && inst && app.viewer.focusMode === 'zoom' && app.spot === inst.id; box.classList.toggle('on', !!show); clearRings(); if (!show) return; st.parts = candidates(inst); if (!st.parts.length) { box.classList.remove('on'); return; } if (st.pi >= st.parts.length) st.pi = 0; const withHoles = st.parts.findIndex(c => c.p.holes && c.p.holes.length); if (st.pi === 0 && withHoles > 0 && !st.userPick) st.pi = withHoles; sel.innerHTML = ''; st.parts.forEach((c, i) => sel.append(h('option', { value: i, selected: i === st.pi }, `${c.p.name || c.p.spec}${c.p.holes?.length ? `（穴 ${c.p.holes.length}）` : ''}`))); sel.style.display = st.parts.length > 1 ? '' : 'none'; title.textContent = st.parts[st.pi].p.spec; draw(); };
  sel.addEventListener('change', () => { st.userPick = true; });
  // ホバー → 3D の穴にリング
  const hitMark = e => { const r = cv.getBoundingClientRect(); const x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height; return st.marks.find(m => Math.hypot(m.cx - x, m.cy - y) <= m.r + 3) || null; };
  cv.addEventListener('pointermove', e => { const m = hitMark(e); if (m === st.hover) return; st.hover = m; clearRings(); cv.style.cursor = m ? 'pointer' : ''; cv.title = m ? `${m.grp.holes[0].slot ? '長穴' : '丸穴'} φ${m.grp.d} ×${m.grp.holes.length}（${{ anchor: 'アンカー', ubolt: 'Uボルト', rod: '吊ボルト', joint: '接合ボルト' }[m.grp.kind] || '一般'}）` : ''; if (!m) return; const inst = st.inst; const g = app.groups.get(inst.id); if (!g) return; g.updateWorldMatrix(true, false); const pt = st.parts[st.pi].p;
    for (const hh of m.grp.holes) { const p = holePos(pt, hh); if (!p) continue; const w = p.applyMatrix4(g.matrixWorld); const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.max(12, hh.d * 1.1), 2.2, 8, 24), new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false, transparent: true, opacity: 0.95 })); ring.position.copy(w); ring.lookAt(app.viewer.camera.position); ring.renderOrder = 999; ring.userData.gauge = true; app.viewer.overlayRoot.add(ring); st.rings.push(ring); } app.viewer.invalidate(2); });
  cv.addEventListener('pointerleave', () => { st.hover = null; clearRings(); cv.title = ''; });
  cv.addEventListener('click', e => { const m = hitMark(e); if (!m) return; const g = app.groups.get(st.inst.id); const pt = st.parts[st.pi].p; const p = holePos(pt, m.grp.holes[0]); if (!g || !p) return; g.updateWorldMatrix(true, false); app.viewer.focusPoint(p.applyMatrix4(g.matrixWorld), { ms: 300 }); });
  st.setInst = inst => { if (st.inst?.id !== inst?.id) { st.userPick = false; st.pi = 0; } st.inst = inst; refresh(); }; st.refresh = refresh; st.show = () => { st.on = true; try { localStorage.setItem('anglex.gauge', '1'); } catch { } refresh(); };
  app.model.on('change', () => { if (box.classList.contains('on')) setTimeout(refresh, 80); });
  return box;
}
