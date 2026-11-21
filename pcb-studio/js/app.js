import { LAYERS, snap, padWorld, compBox, boxOverlap, ratsnest, serialize, deserialize, sameSide } from './core.js';
import { PARTS, PART, CATS, alternatives } from './library.js';
import { PRESETS, generateGPU, emptyBoard } from './templates.js';
import { Router } from './router.js';
import { planLayout, anneal, resyncPlan } from './placer.js';
import { draw, toWorld, flipOf } from './render.js';
import { exportKicad, importKicad, kicadProject, packPart, unpackPart } from './kicad.js';
import { planePlan } from './planes.js';
import { electrical } from './electrical.js';
import { View3D } from './view3d.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cv = $('cv'), ctx = cv.getContext('2d');

const S = {
  board: null, router: null, view: { x: 0, y: 0, z: 3, flip: 1 }, cw: 0, ch: 0, dpr: 1,
  sel: new Set(), hiNet: null, hiGroup: null, layerVis: [true, true, true, true],
  show: { rats: true, zones: true, flow: !matchMedia('(prefers-reduced-motion: reduce)').matches, pvias: true, far: true, labels: true }, style: 'design', time: 0,
  rats: [], zones: [], regions: null, issues: [], ghost: null, wire: null, marquee: null, hoverPad: null,
};
let tool = 'select', dirty = true, liveRoute = true, pinNet = null, pinGroup = null;
let v3 = null, v3on = false, ioKind = 'json';
let redo = [];
// 自動レイアウトの記録（巻き戻し用）と、段階ごとの一時停止
let stageProg = 0;
let rec = null, recPos = 0, replay = false, stepWait = false, stepGo = false, phase = '', curStage = '', userCam = false;
const opts = { regions: true, pack: true, tune: true, step: false, effort: 1 };
let undo = [], run = null, playing = false, speed = 1, t0 = 0, elapsed = 0;

// ───────── 基板の入れ替え・再計算 ─────────
function setBoard(b, route = true) {
  dropRec(); S.board = b; S.sel.clear(); S.hiNet = pinNet = null; S.hiGroup = pinGroup = null; S.ghost = null; S.wire = null;
  S.router = new Router(b);
  if (route) S.router.routeAllSync();
  fit(); refreshAll();
}
function refresh() {
  S.rats = S.show.rats ? ratsnest(S.board) : []; S.zones = v3on ? [] : zones(); dirty = true;
  if (v3on) { let t = 0, r = 0; for (const n of S.board.nets.values()) if (n.cls !== 'plane' && n.pins.length > 1) { t++; if (n.route && n.route.segs.length) r++; } v3.pour = t ? r / t : 0; }
}
function refreshAll() { refresh(); renderInspector(); renderStats(); renderNets(); renderLegend(); renderBom(); renderGuide(); if (v3on) v3.setBoard(S.board, S); }
function zones() {
  const b = S.board, out = [];
  const gpu = b.comps.find(c => c.part.family === 'gpu');
  const width = { VCORE: Math.max(8, Math.min(18, (gpu ? gpu.part.val : 300) / 40)), VMEM: 6, '+12V': 6, '+12V_IN': 7, '+1V8': 3.5, '+PEX': 3.5 };
  for (const name of Object.keys(width)) {
    const n = b.nets.get(name); if (!n || n.cls !== 'plane') continue;
    const w = width[name], nodes = [], seen = new Set();
    for (const p of n.pins) {
      const c = p.c; if (seen.has(c)) continue; seen.add(c);
      if (c.part.pads.length > 60) { // 大型 BGA は面で受ける
        const B = compBox(c, -Math.min(w / 2, c.part.w / 4));
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) nodes.push({ x: B.x0 + (B.x1 - B.x0) * i / 2, y: B.y0 + (B.y1 - B.y0) * j / 2 });
      } else { // 2 端子で相手側が別の電源、または電源コネクタ → このレールへの供給元
        const other = c.part.pads.length === 2 ? Object.values(c.padNet).find(x => x !== name) : null;
        nodes.push({ x: c.x, y: c.y, src: (other && other !== 'GND' && !(name === '+12V_IN')) || /^pwrconn/.test(c.part.family) });
      }
    }
    if (nodes.length < 2) continue;
    const edges = [], d = new Float64Array(nodes.length).fill(1e18), from = new Int32Array(nodes.length), inT = new Uint8Array(nodes.length);
    let cur = 0; inT[0] = 1;
    for (let k = 1; k < nodes.length; k++) {
      let bi = -1;
      for (let i = 0; i < nodes.length; i++) {
        if (inT[i]) continue;
        const q = (nodes[i].x - nodes[cur].x) ** 2 + (nodes[i].y - nodes[cur].y) ** 2;
        if (q < d[i]) { d[i] = q; from[i] = cur; }
        if (bi < 0 || d[i] < d[bi]) bi = i;
      }
      inT[bi] = 1; edges.push([from[bi], bi]); cur = bi;
    }
    // 供給元から木をたどって、電流の向き（供給元 → 負荷）を決める
    const adj = nodes.map(() => []), flow = [], vis = new Uint8Array(nodes.length);
    for (const [i, j] of edges) { adj[i].push(j); adj[j].push(i); }
    let q = nodes.map((nd, i) => (nd.src ? i : -1)).filter(i => i >= 0);
    for (const i of q) vis[i] = 1;
    while (q.length) { const nx2 = []; for (const i of q) for (const j of adj[i]) if (!vis[j]) { vis[j] = 1; flow.push([i, j]); nx2.push(j); } q = nx2; }
    out.push({ name, w, nodes, edges, flow });
  }
  return out;
}
function fit() {
  const b = S.board; if (v3on) v3.frameAll();
  S.view.z = Math.max(0.5, Math.min((S.cw - 24) / (b.w + 10), (S.ch - 90) / (b.gridH + 12)));
  S.view.x = b.w / 2 - 1; S.view.y = b.gridH / 2 + 3; dirty = true;
}
function pushUndo(keepRedo) { undo.push(JSON.stringify(serialize(S.board))); if (undo.length > 30) undo.shift(); if (!keepRedo) redo = []; }
function restore(from, to, msg) {
  if (run || blocked()) return;
  const snap2 = from.pop(); if (!snap2) return toast(from === undo ? 'これ以上戻せません' : 'やり直す操作がありません');
  to.push(JSON.stringify(serialize(S.board)));
  const v = { ...S.view };
  setBoard(deserialize(JSON.parse(snap2), PART)); S.view = v; toast(msg);
}
const doUndo = () => restore(undo, redo, '元に戻しました');
const doRedo = () => restore(redo, undo, 'やり直しました');
// 変更を確定：グリッドを作り直し、影響を受けたネットを再配線する
function commit(nets = []) {
  if (run && phase !== 'routed') { for (const c of S.board.comps) { c.x = snap(c.x); c.y = snap(c.y); } refresh(); renderInspector(); if (v3on) v3.paint(S, true); return; }   // 配線前の段階では位置だけ反映
  if (!run) dropRec();
  const R = S.router, b = S.board, set = new Set(nets);
  for (const n of set) R.ripNet(n);
  for (const n of R.rebuild()) { R.ripNet(n); set.add(n); }
  const list = [...set].filter(n => b.nets.get(n.name) === n);
  if (liveRoute) {
    for (const _ of R.routeMany(list));
  }
  if (liveRoute && list.length) {
    const fails = list.filter(n => n.route && n.route.fails.length).length;
    toast(`${list.length} 本を再配線${fails ? `（${fails} 本は未完了）` : ''}`);
  }
  refreshAll();
}
const netsOfSel = () => { const s = new Set(); for (const c of S.sel) for (const n of S.board.netsOf(c)) if (n.cls !== 'plane') s.add(n); return s; };

// ───────── ヒットテスト ─────────
const nearSide = () => (v3on ? v3.side() : S.view.flip < 0 ? 'B' : 'T');
function compAt(w, sx, sy) {
  if (v3on && sx != null) { const c = v3.pick(sx, sy); if (c) return c; }
  let best = null, ba = 1e18;
  for (const c of S.board.comps) {
    const near = c.side === nearSide() || c.part.th;
    if (!near && (v3on || !S.show.far)) continue;
    const B = compBox(c, 0.2);
    if (w.x < B.x0 || w.x > B.x1 || w.y < B.y0 || w.y > B.y1) continue;
    const a = c.part.w * c.part.h * (near ? 1 : 1e6);
    if (a < ba) { ba = a; best = c; }
  }
  return best;
}
function padAt(w) {
  for (const c of S.board.comps) {
    if (c.side !== nearSide() && !c.part.th) continue;
    const B = compBox(c, 0.5);
    if (w.x < B.x0 || w.x > B.x1 || w.y < B.y0 || w.y > B.y1) continue;
    for (const pad of c.part.pads) {
      const p = padWorld(c, pad);
      if (Math.abs(w.x - p.x) <= p.w / 2 + 0.15 && Math.abs(w.y - p.y) <= p.h / 2 + 0.15) return { c, pad, p };
    }
  }
  return null;
}
function netAt(w) {
  const hit = padAt(w);
  if (hit) { const nm = hit.c.padNet[hit.pad.n]; return { net: nm ? S.board.nets.get(nm) : null, hit }; }
  const order = (nearSide() === 'B' ? [3, 2, 1, 0] : [0, 1, 2, 3]).filter(l => S.layerVis[l]);
  return { net: S.router.netAt(w.x, w.y, order), hit: null };
}

// ───────── ポインタ操作（2D・3D 共通）─────────
const ptrs = new Map(), cv3 = $('cv3');
let drag = null, pinch = null, lastPaint = 0;
const evPos = e => { const r = cv.parentElement.getBoundingClientRect(); return { sx: e.clientX - r.left, sy: e.clientY - r.top }; };
const toW = (sx, sy) => (v3on ? v3.point(sx, sy) : toWorld(S, sx, sy)) || { x: -9999, y: -9999 };
const editable = () => !run || stepWait;
// 再生位置が途中のあいだは編集できない
function blocked(quiet) {
  if (run || !rec || recPos >= rec.frames.length - 1) return false;
  if (!quiet) toast('再生位置が途中です。シークバーを右端まで進めると編集できます');
  return true;
}
function onDown(e) {
  e.currentTarget.setPointerCapture(e.pointerId);
  const { sx, sy } = evPos(e); ptrs.set(e.pointerId, { sx, sy });
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.sx - b.sx, a.sy - b.sy), z: S.view.z }; drag = null; return; }
  const w = toW(sx, sy), alt = e.button === 1 || e.button === 2;
  const nav = () => { drag = v3on ? { kind: alt || e.shiftKey ? 'pan3' : 'orbit', sx, sy, lx: sx, ly: sy, click: !alt } : { kind: 'pan', sx, sy, vx: S.view.x, vy: S.view.y, click: !alt }; };
  if (alt || !editable() || blocked(true)) { nav(); return; }
  if (S.ghost) { placeGhost(e.shiftKey); return; }
  if (tool === 'wire') { wireClick(w, e.altKey); return; }
  const c = compAt(w, sx, sy);
  if (c) {
    if (e.shiftKey) { S.sel.has(c) ? S.sel.delete(c) : S.sel.add(c); }
    else if (!S.sel.has(c)) { S.sel.clear(); S.sel.add(c); }
    drag = { kind: 'move', w0: w, orig: new Map([...S.sel].map(k => [k, { x: k.x, y: k.y }])), moved: false };
    renderInspector(); dirty = true; return;
  }
  if (e.shiftKey && !v3on) { drag = { kind: 'marquee', sx, sy }; return; }
  nav();
}
function onMove(e) {
  const { sx, sy } = evPos(e);
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { sx, sy });
  if (pinch && ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.sx - b.sx, a.sy - b.sy);
    if (v3on) { v3.zoom(pinch.d / d); pinch.d = d; } else S.view.z = Math.max(0.5, Math.min(60, pinch.z * d / pinch.d));
    dirty = true; return;
  }
  const w = toW(sx, sy);
  if (S.ghost) { S.ghost.x = snap(w.x); S.ghost.y = snap(w.y); dirty = true; }
  if (S.wire) { S.wire.to = w; dirty = true; }
  if (!drag) { hover(w, sx, sy); return; }
  if (Math.hypot(sx - drag.sx, sy - drag.sy) > 3) drag.click = false;
  if (drag.kind === 'orbit' || drag.kind === 'pan3') {
    v3[drag.kind === 'orbit' ? 'orbit' : 'pan'](sx - drag.lx, sy - drag.ly); drag.lx = sx; drag.ly = sy; userCam = true;
  } else if (drag.kind === 'pan') {
    S.view.x = drag.vx - (sx - drag.sx) / S.view.z / flipOf(S); S.view.y = drag.vy - (sy - drag.sy) / S.view.z; dirty = true;
  } else if (drag.kind === 'move') {
    const dx = snap(w.x - drag.w0.x), dy = snap(w.y - drag.w0.y);
    if (!drag.moved && (dx || dy)) { drag.moved = true; pushUndo(); drag.nets = netsOfSel(); for (const n of drag.nets) S.router.ripNet(n); }
    if (drag.moved) {
      for (const [c, o] of drag.orig) { c.x = o.x + dx; c.y = o.y + dy; }
      refresh();
      if (v3on && performance.now() - lastPaint > 140) { v3.paint(S, true); lastPaint = performance.now(); }
    }
  } else if (drag.kind === 'marquee') { S.marquee = { x0: drag.sx, y0: drag.sy, x1: sx, y1: sy }; dirty = true; }
}
function endPtr(e) {
  ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
  if (!drag) return;
  const d = drag; drag = null;
  if (d.kind === 'move' && d.moved) commit(d.nets);
  else if (d.kind === 'marquee' && S.marquee) {
    const a = toWorld(S, S.marquee.x0, S.marquee.y0), b = toWorld(S, S.marquee.x1, S.marquee.y1);
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    S.sel.clear();
    for (const c of S.board.comps) if ((c.side === nearSide() || c.part.th) && c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1) S.sel.add(c);
    S.marquee = null; renderInspector(); dirty = true;
  } else if (d.click && d.kind !== 'move' && editable()) {
    const { net } = netAt(toW(d.sx, d.sy));
    pinNet = net && net.cls !== 'plane' ? net : null; S.hiNet = pinNet;
    if (S.sel.size) { S.sel.clear(); renderInspector(); }
    dirty = true;
  }
}
function onWheel(e) {
  e.preventDefault();
  if (v3on) { v3.zoom(Math.exp(e.deltaY * 0.0012)); userCam = true; return; }
  const { sx, sy } = evPos(e), w = toWorld(S, sx, sy);
  S.view.z = Math.max(0.5, Math.min(60, S.view.z * Math.exp(-e.deltaY * 0.0015)));
  const w2 = toWorld(S, sx, sy);
  S.view.x += (w.x - w2.x) * flipOf(S); S.view.y += w.y - w2.y; dirty = true;
}
for (const el of [cv, cv3]) {
  el.addEventListener('pointerdown', onDown); el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', endPtr); el.addEventListener('pointercancel', endPtr);
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('pointerleave', () => { $('tip').hidden = true; if (!pinNet && S.hiNet) { S.hiNet = null; dirty = true; } });
}

function hover(w, sx, sy) {
  const tip = $('tip');
  if (!editable()) { tip.hidden = true; return; }
  const { net, hit } = netAt(w);
  const hp = tool === 'wire' && hit ? hit.p : null;
  if (hp !== S.hoverPad) { S.hoverPad = hp; dirty = true; }
  const h = net && net.cls !== 'plane' ? net : null;
  const want = h || pinNet;
  if (want !== S.hiNet) { S.hiNet = want; dirty = true; }
  let html = '';
  if (hit) html = `<b>${esc(hit.c.ref)}</b> ピン ${esc(hit.pad.n)}<br>${net ? esc(net.name) : '未接続'}`;
  else if (net) html = `<b>${esc(net.name)}</b>`;
  if (net && net.cls !== 'plane' && net.route) html += `<br>${net.pins.length} ピン・${net.route.len.toFixed(1)} mm・ビア ${net.route.vias.length}${net.route.tuned ? '・等長調整済' : ''}${net.cls === 'diff' ? '<br>差動ペア' : ''}`;
  else if (net && net.cls === 'plane') html += '<br>電源プレーン（内層ベタ）';
  if (!html || (v3on && !hit)) { const c = compAt(w, sx, sy); if (c) html = `<b>${esc(c.ref)}</b> ${esc(c.part.pn)}<br>${esc(c.part.name)}`; }
  tip.hidden = !html;
  if (html) { tip.innerHTML = html; tip.style.left = Math.min(S.cw - 190, sx + 14) + 'px'; tip.style.top = Math.max(4, sy - 8) + 'px'; }
}

// ───────── 編集操作 ─────────
function rotateSel() {
  if (S.ghost) { S.ghost.rot = (S.ghost.rot + 90) % 360; dirty = true; return; }
  if (!S.sel.size || !editable() || blocked()) return;
  pushUndo(); const nets = netsOfSel(); for (const c of S.sel) c.rot = (c.rot + 90) % 360; commit(nets);
}
function flipSel() {
  if (!S.sel.size || !editable() || blocked()) return;
  pushUndo(); const nets = netsOfSel();
  for (const c of S.sel) if (!c.part.th) c.side = c.side === 'T' ? 'B' : 'T';
  commit(nets);
}
function deleteSel() {
  if (!S.sel.size || run || blocked()) return;
  pushUndo(); const nets = netsOfSel(); for (const n of nets) S.router.ripNet(n);
  for (const c of S.sel) S.board.remove(c);
  S.sel.clear(); commit(nets);
}
function startPlace(part) {
  if (blocked()) return;
  setTool('select'); S.sel.clear();
  S.ghost = { part, x: snap(S.view.x), y: snap(S.view.y), rot: 0, side: nearSide(), padNet: {} };
  toast(`${part.pn} を配置：基板上をクリック（R で回転、Esc で中止）`); dirty = true; renderInspector();
}
function placeGhost(keep) {
  const g = S.ghost; pushUndo();
  const c = S.board.add(g.part, g.x, g.y, { rot: g.rot, side: g.part.th ? 'T' : g.side, group: 'grp_misc' });
  if (!keep) { S.ghost = null; S.sel.clear(); S.sel.add(c); }
  commit([]);
}
function wireClick(w, alt) {
  const hit = padAt(w), b = S.board;
  if (!hit) { S.wire = null; dirty = true; return; }
  if (alt) { // ピンを切り離す
    const nm = hit.c.padNet[hit.pad.n]; if (!nm) return;
    pushUndo(); const n = b.nets.get(nm); S.router.ripNet(n); b.disconnect(hit.c, hit.pad.n); commit([n]); return;
  }
  if (!S.wire) { S.wire = { c: hit.c, pad: hit.pad.n, from: hit.p, to: w }; dirty = true; return; }
  const A = S.wire; S.wire = null;
  if (A.c === hit.c && A.pad === hit.pad.n) { dirty = true; return; }
  pushUndo();
  const na = A.c.padNet[A.pad], nb = hit.c.padNet[hit.pad.n];
  let target = na || nb || b.newNetName();
  if (na && nb && na !== nb) { // 2 つのネットを統合
    const keep = b.nets.get(na).cls === 'plane' ? na : b.nets.get(nb).cls === 'plane' ? nb : na, gone = keep === na ? nb : na;
    const g = b.nets.get(gone); S.router.ripNet(g);
    for (const p of [...g.pins]) b.connect(p.c, p.p, keep, b.nets.get(keep).cls);
    target = keep;
  }
  const cls = b.nets.has(target) ? b.nets.get(target).cls : 'signal';
  b.connect(A.c, A.pad, target, cls); b.connect(hit.c, hit.pad.n, target, cls);
  commit([b.nets.get(target)]);
}
function swapPart(newPart, all) {
  const b = S.board, base = [...S.sel][0]; if (!base || run || blocked()) return;
  pushUndo();
  const targets = all ? b.comps.filter(c => c.part === base.part) : [...S.sel].filter(c => c.part.family === newPart.family);
  const nets = new Set();
  for (const c of targets) {
    for (const n of b.netsOf(c)) if (n.cls !== 'plane') nets.add(n);
    for (const p of Object.keys(c.padNet)) if (!newPart.padMap[p]) b.disconnect(c, p);
    c.part = newPart;
  }
  commit(nets); toast(`${targets.length} 個を ${newPart.pn} に置換`);
}
function setTool(t) {
  tool = t; S.wire = null; S.hoverPad = null;
  for (const b of document.querySelectorAll('[data-tool]')) b.setAttribute('aria-pressed', b.dataset.tool === t);
  cv.style.cursor = t === 'wire' ? 'crosshair' : 'default'; dirty = true;
}

// ───────── 自動レイアウトの再生 ─────────
const STAGES = [['scatter', '計画・整列'], ['anneal', '焼きなまし'], ['route', '配線'], ['flip', '裏面確認'], ['top', '表面へ']];
function stage(id, text) {
  for (const el of document.querySelectorAll('#stages li')) {
    const i = STAGES.findIndex(s => s[0] === el.dataset.s), k = STAGES.findIndex(s => s[0] === id);
    el.className = i < k ? 'done' : i === k ? 'on' : '';
  }
  curStage = id;
  if (text != null) $('status').textContent = text;
}
// 段階の合間で止めて、手直しを受け付ける
function* gate(next) {
  if (!opts.step) return;
  stepWait = true; stepGo = false; document.body.classList.add('waiting');
  $('status').textContent = `一時停止中：部品をつかんで手直しできます。「次の段階へ」で ${next} に進みます。`;
  while (!stepGo) yield;
  stepWait = false; document.body.classList.remove('waiting');
}
function* routeStage(nets) {
  const R = S.router;
  R.tune = opts.tune; R.ripAll(); R.rebuild(); refresh();
  let k = 0;
  for (const ev of R.routeMany(nets || [...S.board.nets.values()])) {
    const what = ev.phase === 'route' ? 'route' : ev.phase === 'ripup' ? '引き剥がし再配線' : ev.phase === 'tune' ? '等長化（ミアンダ挿入）' : '再配線';
    stage('route', `route | ${ev.i}/${ev.total} ${what} ${ev.key || ev.net.name}`);
    stageProg = ev.i / ev.total;
    if (++k % Math.max(1, Math.round(speed)) === 0) { refresh(); yield; if (speed < 1) yield; }
  }
  phase = 'routed'; refresh(); if (v3on) v3.paint(S);
}
function* flipStage() {
  const ease = t => (1 - Math.cos(Math.PI * t)) / 2;
  stage('flip', '基板を裏返して裏面の部品と配線を確認');
  if (v3on) {
    const e0 = v3.el;
    for (let t = 0; t < 1; t += 0.014 * speed) { v3.el = e0 - 2 * Math.abs(e0) * ease(t); v3.dirty = true; stageProg = t; yield; }
    for (let t = 0; t < 1; t += 0.012 * speed) yield;
    stage('top', '表面に戻る');
    for (let t = 0; t < 1; t += 0.014 * speed) { v3.el = e0 - 2 * Math.abs(e0) * (1 - ease(t)); v3.dirty = true; stageProg = t; yield; }
    v3.el = e0; v3.dirty = true; return;
  }
  for (let t = 0; t < 1; t += 0.014 * speed) { S.view.flip = 1 - 2 * ease(t); stageProg = t; dirty = true; yield; }
  S.view.flip = -1; dirty = true;
  for (let t = 0; t < 1; t += 0.012 * speed) yield;
  stage('top', '表面に戻る');
  for (let t = 0; t < 1; t += 0.014 * speed) { S.view.flip = -1 + 2 * ease(t); stageProg = t; dirty = true; yield; }
  S.view.flip = 1; dirty = true;
}
function* autoLayout(seed) {
  const b = S.board;
  S.router.ripAll(); S.sel.clear(); S.hiNet = pinNet = null;
  const plan = planLayout(b, seed, opts.pack, opts.regions), tg = plan.targets;
  S.regions = [...plan.regions].map(([g, r]) => ({ ...r, label: (b.group(g) || {}).label || g, color: (b.group(g) || {}).color || '#fff' }));
  const from = new Map([...tg.keys()].map(c => [c, { x: c.x, y: c.y }]));
  const pi = plan.info;
  stage('scatter', pi.blocks + pi.facing ? `plan: 電源の流れで領域を割り当て → 相ブロック ${pi.blocks} 個を列に整列・${pi.facing} ブロックを GPU のボール正面へ・裏面コンデンサ ${pi.grid} 個を格子に (seed ${seed})`
    : `scatter: 各ブロックを、配線が望む位置の周りへ散布 (seed ${seed})`);
  for (let t = 0; t < 1; t += 0.014 * speed) {
    const e = t * t * (3 - 2 * t);
    for (const [c, p] of tg) { const o = from.get(c); c.x = o.x + (p.x - o.x) * e; c.y = o.y + (p.y - o.y) * e; if (t > 0.5) c.rot = p.rot; }
    stageProg = t; refresh(); yield;
  }
  for (const [c, p] of tg) { c.x = p.x; c.y = p.y; c.rot = p.rot; }
  refresh(); for (let t = 0; t < 1; t += 0.03 * speed) yield;
  yield* gate('焼きなまし');
  resyncPlan(plan);
  const an = anneal(b, seed, 60, plan, opts.effort);
  for (let done = false; !done;) {
    let ev = null;
    for (let i = 0; i < Math.max(1, Math.round(speed)); i++) { const r = an.next(); if (r.done) { done = true; break; } ev = r.value; }
    if (ev) {
      stage('anneal', ev.legal ? `legalize: 重なり解消 ${ev.legal} 回目 | overlap ${ev.overlap.toFixed(2)} mm²`
        : `anneal: move ${ev.move}/${ev.total} | T ${ev.T.toFixed(3)} | cost ${Math.round(ev.cost)} | overlap ${ev.overlap.toFixed(2)} mm²`);
      stageProg = ev.move / ev.total;
    }
    refresh(); yield;
  }
  yield* gate('配線');
  S.regions = null;
  yield* routeStage();
  yield* gate('裏面確認');
  yield* flipStage();
}
function* routeOnly() { yield* routeStage(); }
function play(gen) {
  if (run || blocked()) return;
  pushUndo(); S.ghost = null; setTool('select'); dropRec(); startRec(); phase = 'place'; userCam = false; replay = false;
  run = gen; playing = true; elapsed = 0;
  document.body.classList.add('running'); $('btnPause').textContent = '一時停止';
}
function finish(msg) {
  run = null; playing = false; stepWait = false; phase = ''; S.regions = null; document.body.classList.remove('running', 'waiting');
  S.view.flip = S.view.flip < 0 ? -1 : 1;
  for (const c of S.board.comps) { c.x = snap(c.x); c.y = snap(c.y); }
  for (const n of S.router.rebuild()) S.router.ripNet(n);
  stage('', msg); for (const el of document.querySelectorAll('#stages li')) el.className = msg.startsWith('完了') ? 'done' : '';
  refreshAll();
  if (rec) { // 記録を閉じて、シークバーで巻き戻せるようにする
    S.router.log = null; recFrame(); rec.applied = rec.log.length / 2; recPos = rec.frames.length - 1;
    const sk = $('seek'); sk.max = recPos; sk.value = recPos; sk.disabled = false; document.body.classList.add('hasrec');
  }
}
function startRec() {
  rec = { comps: S.board.comps.filter(c => !c.fixed), frames: [], log: [], base: new Map([...S.board.nets.values()].map(n => [n, n.route])), applied: 0 };
  S.router.log = rec.log; recPos = 0; $('seek').disabled = true; $('seek').value = 0; $('seek').max = 1000;
}
function dropRec() { if (!rec) return; rec = null; replay = false; if (S.router) S.router.log = null; document.body.classList.remove('hasrec'); $('seek').disabled = true; }
function recFrame() {
  const pos = new Float32Array(rec.comps.length * 3);
  rec.comps.forEach((c, i) => { pos[3 * i] = c.x; pos[3 * i + 1] = c.y; pos[3 * i + 2] = c.rot; });
  rec.frames.push({ st: curStage, text: $('status').textContent, pos, log: rec.log.length / 2, el: v3 ? v3.el : 0, flip: S.view.flip, reg: S.regions, t: elapsed });
}
// 記録した時点の状態を表示する（配置と、その時点までに引かれた配線）
function showFrame(i) {
  const f = rec.frames[i]; recPos = i;
  rec.comps.forEach((c, j) => { c.x = f.pos[3 * j]; c.y = f.pos[3 * j + 1]; c.rot = f.pos[3 * j + 2]; });
  if (f.log < rec.applied) { for (const n of S.board.nets.values()) n.route = rec.base.get(n) || null; rec.applied = 0; }
  for (let k = rec.applied; k < f.log; k++) rec.log[2 * k].route = rec.log[2 * k + 1];
  rec.applied = f.log;
  stage(f.st, f.text); S.regions = f.reg; S.sel.clear();
  if (i === rec.frames.length - 1) for (const el of document.querySelectorAll('#stages li')) el.className = 'done';
  if (v3on) v3.el = f.el; else S.view.flip = f.flip;
  $('seek').value = i; clock(f.t);
  refresh();
  if (v3on && (performance.now() - lastPaint > 90 || i === rec.frames.length - 1)) { v3.paint(S); lastPaint = performance.now(); }
}
function clock(ms) { const s2 = Math.floor(ms / 1000); $('clock').textContent = `${Math.floor(s2 / 60)}:${String(s2 % 60).padStart(2, '0')}`; }

// ───────── 3D 表示・保存読込 ─────────
function toggle3d(quiet) {
  if (!v3) v3 = new View3D(cv3);
  if (!v3.ok) { if (!quiet) toast('3D ライブラリを読み込めませんでした（ネットワークを確認してください）'); return; }
  v3on = !v3on;
  cv3.hidden = !v3on; $('explodeWrap').hidden = !v3on; $('btn3d').setAttribute('aria-pressed', v3on); $('tip').hidden = true; S.sel.clear();
  if (v3on) v3.style = S.style, v3.resize(S.cw, S.ch, S.dpr);
  if (!S.board) return;
  refresh(); if (v3on) v3.setBoard(S.board, S);
  renderInspector();
}
const saveData = () => ({ ...serialize(S.board), custom: [...new Set(S.board.comps.map(c => c.part))].filter(p => p.cat === 'kicad').map(packPart) });
function loadText(text) {
  const t = text.trim();
  if (blocked()) return;
  let b;
  if (t.startsWith('(kicad_pcb')) b = importKicad(t, p => { PART[p.id] = p; });
  else { const d = JSON.parse(t); for (const p of d.custom || []) PART[p.id] = unpackPart(p); b = deserialize(d, PART); }
  pushUndo(); setBoard(b);
  const st = S.router.stats();
  toast(`読み込みました：${b.comps.length} 部品・配線 ${st.routed}/${st.total}`);
  stage('', t.startsWith('(kicad_pcb') ? 'KiCad 基板を取り込み、このツールのグリッドで再配線しました（元の配線は使いません）。' : '読み込みました。');
}
async function saveFile() {
  const kicad = ioKind !== 'json', text = $('ioText').value, msg = $('ioMsg');
  const base = ioKind === 'pro' ? 'gpu-board.kicad_pro' : 'gpu-board.kicad_pcb';
  const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
  if (dl) {
    try { await dl.save({ filename: kicad ? base + '.txt' : 'gpu-board.json', data: text }); msg.textContent = kicad ? '保存しました。ファイル名末尾の .txt を外すと KiCad で開けます。' : '保存しました。'; }
    catch (err) { msg.textContent = err && err.code === 'declined' ? '保存を取り消しました。' : 'この画面では保存できません。「コピー」を使ってください。'; }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = kicad ? base : 'gpu-board.json';
  document.body.appendChild(a); a.click(); a.remove(); msg.textContent = '保存を開始しました。始まらない場合は「コピー」を使ってください。';
}

// ───────── パネル描画 ─────────
function renderLibrary() {
  const q = $('libq').value.trim().toLowerCase();
  let html = '';
  for (const [cat, label] of CATS) {
    const list = PARTS.filter(p => p.cat === cat && (!q || `${p.name} ${p.mfr} ${p.pn} ${p.pkg} ${p.spec}`.toLowerCase().includes(q)));
    if (!list.length) continue;
    html += `<details ${q || cat === 'drmos' ? 'open' : ''}><summary>${label}<span class="n">${list.length}</span></summary>`;
    for (const p of list) html += `<div class="part" title="${esc(p.note || '')}">
      <div class="pt"><span class="pn">${esc(p.pn)}</span><span class="badge ${p.ok ? 'ok' : 'un'}">${p.ok ? '出典確認' : '未確認'}</span></div>
      <div class="pd">${esc(p.mfr)}・${esc(p.name)}</div>
      <div class="pd dim">${esc(p.pkg)}・${esc(p.spec)}・搭載例: ${esc(p.seen)}</div>
      <button class="mini" data-place="${p.id}">基板に配置</button></div>`;
    html += '</details>';
  }
  $('lib').innerHTML = html || '<p class="dim">該当する部品がありません。</p>';
}
function fillGen() {
  const opt = (fam, sel) => PARTS.filter(p => fam.includes(p.family)).map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.mfr)} ${esc(p.pn)}</option>`).join('');
  const p = PRESETS[$('gPreset').value];
  $('gGpu').innerHTML = opt(['gpu'], p.gpu); $('gVram').innerHTML = opt(['vram'], p.vram);
  $('gDrmos').innerHTML = opt(['drmos'], p.drmos); $('gInd').innerHTML = opt(['ind'], p.ind);
  $('gCtl').innerHTML = opt(['ctl'], p.ctl); $('gConn').innerHTML = opt(['pwrconn', 'pwrconn8'], p.conn);
  $('gNVram').value = p.nVram; $('gVcore').value = p.vcore; $('gVmem').value = p.vmem; $('gNConn').value = p.nConn;
}
function genFromForm() {
  if (run || blocked()) return;
  const p = PRESETS[$('gPreset').value], num = (id, lo, hi) => Math.max(lo, Math.min(hi, parseInt($(id).value, 10) || lo));
  pushUndo();
  setBoard(generateGPU({ ...p, gpu: $('gGpu').value, vram: $('gVram').value, drmos: $('gDrmos').value, ind: $('gInd').value, ctl: $('gCtl').value, conn: $('gConn').value,
    nVram: num('gNVram', 1, 18), vcore: num('gVcore', 2, 24), vmem: num('gVmem', 1, 8), nConn: num('gNConn', 1, 3) }));
  stage('', '生成しました。部品をドラッグすると配線が追従します。'); toast(`${S.board.comps.length} 部品の基板を生成・配線しました`);
}
function renderInspector() {
  const el = $('insp'), sel = [...S.sel];
  if (S.ghost) { el.innerHTML = `<p class="dim">配置中: <b>${esc(S.ghost.part.pn)}</b><br>クリックで確定、Shift+クリックで連続配置。</p>`; return; }
  if (!sel.length) { el.innerHTML = '<p class="dim">部品をクリックすると詳細と代替部品を表示します。Shift+ドラッグで範囲選択。</p>'; return; }
  const c = sel[0], p = c.part, same = sel.every(x => x.part.family === p.family);
  const alts = alternatives(p);
  let h = sel.length > 1 ? `<div class="ih">${sel.length} 個を選択</div>` : `<div class="ih"><span class="pn">${esc(c.ref)}</span> ${esc(p.pn)} <span class="badge ${p.ok ? 'ok' : 'un'}">${p.ok ? '出典確認' : '未確認'}</span></div>`;
  if (sel.length === 1) {
    const g = S.board.group(c.group);
    h += `<dl><dt>品名</dt><dd>${esc(p.mfr)}・${esc(p.name)}</dd><dt>パッケージ</dt><dd>${esc(p.pkg)}</dd><dt>仕様</dt><dd>${esc(p.spec)}</dd>
      <dt>搭載例</dt><dd>${esc(p.seen)}</dd><dt>位置</dt><dd class="num">X ${c.x.toFixed(1)} / Y ${c.y.toFixed(1)} mm・${c.rot}°・${c.side === 'T' ? '表面' : '裏面'}</dd>
      <dt>グループ</dt><dd>${g ? esc(g.label) : '-'}</dd></dl>${p.note ? `<p class="dim">${esc(p.note)}</p>` : ''}`;
  }
  h += `<div class="row"><button class="mini" data-act="rot">90°回転</button><button class="mini" data-act="flip">表裏</button>
    <button class="mini" data-act="lock">${c.fixed ? '固定を解除' : '位置を固定'}</button><button class="mini warn" data-act="del">削除</button></div>`;
  if (same && alts.length > 1) {
    h += `<label class="fl" for="alt">代替部品に置換</label><select id="alt">${alts.map(a => `<option value="${a.id}" ${a === p ? 'selected' : ''}>${esc(a.mfr)} ${esc(a.pn)}（${esc(a.spec)}）</option>`).join('')}</select>
      <label class="ck"><input type="checkbox" id="altAll" checked> 同じ型番 ${S.board.comps.filter(x => x.part === p).length} 個をまとめて置換</label>`;
  }
  if (sel.length === 1) {
    const sig = Object.entries(c.padNet).map(([pad, nm]) => [pad, S.board.nets.get(nm)]).filter(([, n]) => n && n.cls !== 'plane');
    const planes = {};
    for (const nm of Object.values(c.padNet)) { const n = S.board.nets.get(nm); if (n && n.cls === 'plane') planes[nm] = (planes[nm] || 0) + 1; }
    h += `<div class="sub">信号ピン ${sig.length}</div><div class="pins">${sig.slice(0, 60).map(([pad, n]) => `<button class="pin" data-net="${esc(n.name)}"><span>${esc(pad)}</span>${esc(n.name)}${n.route && n.route.fails.length ? ' ⚠' : ''}</button>`).join('') || '<span class="dim">なし</span>'}</div>
      <div class="sub">電源プレーン</div><div class="dim">${Object.entries(planes).map(([k, v]) => `${esc(k)}×${v}`).join('、') || 'なし'}</div>`;
  }
  el.innerHTML = h;
}
function renderStats() {
  const b = S.board, st = S.router.stats(), issues = [];
  let off = 0, ov = 0;
  for (let i = 0; i < b.comps.length; i++) {
    const c = b.comps[i], B = compBox(c), A = compBox(c, -0.05);
    if (c.part.family !== 'pcie' && (B.x0 < 0 || B.y0 < 0 || B.x1 > b.w || B.y1 > b.h)) { off++; issues.push({ t: `基板外: ${c.ref}`, x: c.x, y: c.y, side: c.side }); }
    for (let j = i + 1; j < b.comps.length; j++) { const o = b.comps[j]; if (sameSide(c, o) && boxOverlap(A, compBox(o, -0.05)) > 0) { ov++; issues.push({ t: `重なり: ${c.ref} と ${o.ref}`, x: (c.x + o.x) / 2, y: (c.y + o.y) / 2, side: c.side }); } }
  }
  for (const n of b.nets.values()) {
    if (n.cls === 'plane' || n.pins.length < 2) continue;
    const bad = n.route ? n.route.fails : n.pins.map((_, i) => i).slice(1);
    for (const i of bad) { const p = n.pins[i], q = padWorld(p.c, p.c.part.padMap[p.p]); issues.push({ t: `未接続: ${n.name}（${p.c.ref}）`, x: q.x, y: q.y, side: p.c.side }); }
  }
  for (const n of b.nets.values()) if (n.cls === 'plane' && n.route) for (const i of n.route.fails) { const p = n.pins[i], q = padWorld(p.c, p.c.part.padMap[p.p]); issues.push({ t: `プレーン未接続: ${n.name}（${p.c.ref}）`, x: q.x, y: q.y, side: p.c.side }); }
  S.issues = issues;
  const pads = b.comps.reduce((s, c) => s + c.part.pads.length, 0);
  const fam = f => b.comps.filter(c => c.part.family === f);
  const gpu = fam('gpu')[0], dm = fam('drmos').filter(c => c.group === 'grp_vcore');
  const amps = dm.reduce((s, c) => s + (c.part.val || 0), 0), need = gpu ? gpu.part.val / 1.0 : 0;
  const gb = fam('vram').reduce((s, c) => s + c.part.val, 0);
  const pin = [...fam('pwrconn'), ...fam('pwrconn8')].reduce((s, c) => s + c.part.val, 0) + (fam('pcie').length ? 75 : 0);
  const rows = [], row = (k, v, cls = '') => rows.push(`<tr class="${cls}"><th>${k}</th><td>${v}</td></tr>`);
  const pill = (ok, t) => `<span class="pill ${ok ? 'good' : 'bad'}">${t}</span>`;
  row('部品 / パッド', `${b.comps.length} / ${pads.toLocaleString()}`);
  row('配線ネット', `${st.routed} / ${st.total} ${pill(st.routed === st.total, st.total ? Math.round(st.routed / st.total * 100) + '%' : '-')}`);
  row('未接続', `${st.fails} 箇所 ${pill(!st.fails, st.fails ? '要対応' : 'OK')}`);
  row('配線長 / ビア', `${Math.round(st.len).toLocaleString()} mm / ${st.vias}`);
  if (st.pPins) row('プレーン接続', `${(st.pPins - st.pFail).toLocaleString()} / ${st.pPins.toLocaleString()} ピン（ビア ${st.pVias.toLocaleString()}）${pill(!st.pFail, st.pFail ? '未接続 ' + st.pFail : 'OK')}`);
  const plan = planePlan(b);
  if (plan.rails.length) row('層構成', `<span title="${esc(plan.stack.join(' / '))}">${plan.copper} 層（信号 4・GND ${plan.gnd}・電源 ${plan.power}）</span>`);
  const ms = S.router.matchStats();
  if (ms.groups) row('等長グループ', `${ms.good} / ${ms.groups} 組が ±1mm 以内 ${pill(ms.good === ms.groups, ms.good === ms.groups ? 'OK' : `最大差 ${ms.worst.toFixed(1)}mm`)}`);
  row('部品の重なり', `${ov} 組 ${pill(!ov, ov ? '要対応' : 'OK')}`);
  row('基板外', `${off} 個 ${pill(!off, off ? '要対応' : 'OK')}`);
  if (gpu) {
    row('Vcore VRM', `${dm.length} 相 × 定格 = ${amps} A`);
    row('GPU 想定電流', `約 ${Math.round(need)} A（${gpu.part.val} W ÷ 1.0 V の概算）`);
    row('VRM 余裕率', `${need ? (amps / need).toFixed(2) : '-'} 倍 ${pill(amps >= need * 1.3, amps >= need * 1.3 ? '十分' : '不足気味')}`);
    row('入力電力', `${pin} W 供給可 / GPU ${gpu.part.val} W ${pill(pin >= gpu.part.val * 1.05, pin >= gpu.part.val * 1.05 ? 'OK' : '不足')}`);
    row('VRAM', `${fam('vram').length} 枚 = ${gb} GB`);
    for (const c of fam('ctl')) { const n = Object.keys(c.padNet).filter(k => k.startsWith('PWM')).length; if (n > c.part.val) row('コントローラ', `${esc(c.part.pn)} は最大 ${c.part.val} 相（${n} 相接続）${pill(false, '位相ダブラ要')}`); }
  }
  const el = electrical(b);
  const elec = el.length ? `<div class="sub">電源経路の概算（2oz プレーン 1 層あたり）</div><table class="elec"><tr><th>レール</th><th>電流</th><th>経路</th><th>降下</th><th>損失</th></tr>${el.map(e => {
    const need = Math.ceil(e.pct / 2);
    return `<tr><td>${esc(e.name)}</td><td class="num">${Math.round(e.I)} A</td><td class="num">${e.L.toFixed(0)}×${e.W.toFixed(0)} mm</td><td class="num">${e.mV.toFixed(1)} mV<br><span class="dim">${e.pct.toFixed(1)}%</span></td><td class="num">${e.loss.toFixed(1)} W${need > 1 ? `<br><span class="pill bad">${need} 層必要</span>` : '<br><span class="pill good">1 層で可</span>'}</td></tr>`;
  }).join('')}</table><p class="dim">経路は供給元（インダクタ等）から負荷までの平均距離 × 有効幅。降下 2% 以内を目安に必要なプレーン枚数を示します。銅箔温度・ビア・リターン経路は含みません。</p>` : '';
  $('stats').innerHTML = `<table>${rows.join('')}</table>` + elec + (issues.length
    ? `<div class="sub">問題 ${issues.length} 件（クリックでその場所へ）</div><div class="pins">${issues.slice(0, 30).map((q, i) => `<button class="pin bad" data-issue="${i}">${esc(q.t)}</button>`).join('')}</div>`
    : '<div class="sub ok">配置・接続の問題は見つかりません</div>');
}
function focusAt(x, y, z) { S.view.x = x; S.view.y = y; if (z) S.view.z = z; if (v3on) v3.focus(x, y, Math.max(60, Math.min(v3.dist, 2600 / (z || 9)))); dirty = true; }
function showTab(k) { for (const b of document.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', b.dataset.tab === k); $('tabGuide').hidden = k !== 'guide'; $('tabLib').hidden = k !== 'lib'; $('tabGen').hidden = k !== 'gen'; }
function renderNets() {
  const q = $('netq').value.trim().toLowerCase();
  const all = [...S.board.nets.values()].filter(n => n.cls !== 'plane' && n.pins.length > 1);
  const list = all.filter(n => !q || n.name.toLowerCase().includes(q))
    .sort((a, b2) => ((b2.route ? b2.route.fails.length : 9) - (a.route ? a.route.fails.length : 9)) || ((b2.route ? b2.route.len : 0) - (a.route ? a.route.len : 0)));
  const cls = { signal: '信号', diff: '差動', power: '電源' };
  $('nets').innerHTML = `<table>${list.slice(0, 50).map(n => {
    const r = n.route, bad = !r || r.fails.length;
    return `<tr><td><button class="pin${bad ? ' bad' : ''}" data-netfocus="${esc(n.name)}">${esc(n.name)}</button></td><td class="dim">${cls[n.cls] || ''}</td><td class="num">${r ? r.len.toFixed(1) : '-'}</td><td class="dim">${bad ? '未完了' : r.tuned ? '等長' : r.vias.length ? 'ビア' + r.vias.length : ''}</td></tr>`;
  }).join('')}</table>`;
  $('netN').textContent = `${list.length} / ${all.length} 本${list.length > 50 ? '（上位 50 本を表示）' : ''}`;
}
function renderLegend() {
  const b = S.board, cnt = {};
  for (const c of b.comps) cnt[c.group] = (cnt[c.group] || 0) + 1;
  $('legend').innerHTML = b.groups.filter(g => cnt[g.id]).map(g => `<button data-g="${g.id}" aria-pressed="${pinGroup === g.id}" title="${esc(g.label)}・${cnt[g.id]} 部品"><i style="background:${g.color}"></i>${esc(g.id)} (${g.kind})</button>`).join('')
    + '<button disabled><i style="background:#b4bac0"></i>fixed</button>';
}
// 「作り方」ガイド：いまの状態から各ステップの進み具合を示す
function renderGuide() {
  const b = S.board, st = S.router.stats(), iss = S.issues || [];
  const ov = iss.filter(q => /^(重なり|基板外)/.test(q.t)).length, un = iss.length - ov;
  const kind = b.meta && b.meta.kind === 'gpu' ? (PRESETS[$('gPreset').value] || {}).label || 'GPU 基板' : b.meta && b.meta.kind === 'kicad' ? 'KiCad から取り込み' : '空の基板';
  const steps = [
    ['構成を決める', `${kind}・${b.comps.length} 部品・${b.w}×${b.h} mm`, b.comps.length > 0, [['構成を選んで生成', 'tab:gen']]],
    ['部品を選ぶ', '基板上の部品をクリックすると、右のパネルで代替部品にまとめて置換できます。', b.comps.length > 0, [['ライブラリから追加', 'tab:lib']]],
    ['配置する', ov ? `重なり・基板外 ${ov} 件` : '重なりなし。部品はつかんで動かせます（R で回転、F で表裏）', b.comps.length > 0 && !ov, [['自動レイアウト', 'btnPlay'], ['段階ごとに止めて進める', 'step']]],
    ['配線する', st.total ? `${st.routed} / ${st.total} 本・プレーン接続 ${st.pPins - st.pFail} / ${st.pPins}` : '結線ツールでパッド同士をつなぐとネットができます', st.total > 0 && st.routed === st.total, [['自動配線', 'btnRoute']]],
    ['検査する', un + ov ? `問題 ${un + ov} 件` : '問題は見つかりません', b.comps.length > 0 && !(un + ov), un + ov ? [['最初の問題へ', 'issue']] : []],
    ['書き出す', 'KiCad (.kicad_pcb と設計ルール) または JSON', null, [['保存・読込', 'btnIO']]],
  ];
  $('guide').innerHTML = steps.map(([t, d, ok, acts], i) => `<li class="${ok === true ? 'ok' : ok === false ? 'todo' : ''}"><div class="gh"><b>${i + 1}</b>${t}${ok === true ? '<span class="pill good">済</span>' : ok === false ? '<span class="pill bad">未</span>' : ''}</div><div class="dim">${esc(d)}</div><div class="row">${acts.map(([l, go]) => `<button class="mini" data-go="${go}">${l}</button>`).join('')}</div></li>`).join('');
}
function renderBom() {
  const m = new Map();
  for (const c of S.board.comps) m.set(c.part, (m.get(c.part) || 0) + 1);
  const rows = [...m].sort((a, b) => b[1] - a[1]).map(([p, n]) => `<tr><td class="num">${n}</td><td><span class="pn">${esc(p.pn)}</span><br><span class="dim">${esc(p.mfr)}・${esc(p.name)}</span></td></tr>`);
  $('bom').innerHTML = `<table>${rows.join('')}</table>`; $('bomN').textContent = `${m.size} 品種 / ${S.board.comps.length} 点`;
}
function renderLayers() {
  $('layers').innerHTML = LAYERS.map(l => `<label class="ck"><input type="checkbox" data-layer="${l.id}" id="ly${l.id}" checked><i style="background:${l.color}"></i>${l.label}</label>`).join('')
    + [['rats', '未配線（ラッツネスト）'], ['zones', '電源プレーン領域'], ['flow', '電流の流れ'], ['pvias', 'プレーン接続ビア'], ['far', '反対面の部品'], ['labels', '部品ラベル']].map(([k, t]) => `<label class="ck"><input type="checkbox" data-show="${k}" id="sh_${k}" checked>${t}</label>`).join('');
  for (const k of Object.keys(S.show)) { const e = $('sh_' + k); if (e) e.checked = S.show[k]; }
}
let toastT = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600); }

// ───────── イベント配線 ─────────
document.addEventListener('click', e => {
  const t = e.target.closest('button, [data-tab]'); if (!t) return;
  const d = t.dataset;
  if (d.tool) setTool(d.tool);
  else if (d.place) { if (!run) startPlace(PART[d.place]); }
  else if (d.net) { pinNet = S.board.nets.get(d.net) || null; S.hiNet = pinNet; dirty = true; }
  else if (d.netfocus) {
    const n = S.board.nets.get(d.netfocus); if (!n) return;
    pinNet = S.hiNet = n;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of n.pins) { const q = padWorld(p.c, p.c.part.padMap[p.p]); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
    focusAt((x0 + x1) / 2, (y0 + y1) / 2, Math.max(2.5, Math.min(26, (S.cw - 60) / (x1 - x0 + 16), (S.ch - 160) / (y1 - y0 + 16))));
  }
  else if (d.issue) { const q = S.issues[+d.issue]; if (q) { if ((q.side === 'B') !== (nearSide() === 'B')) $('btnBack').click(); focusAt(q.x, q.y, Math.max(S.view.z, 9)); } }
  else if (d.g) { pinGroup = pinGroup === d.g ? null : d.g; S.hiGroup = pinGroup; renderLegend(); dirty = true; }
  else if (d.tab) showTab(d.tab);
  else if (d.go) {
    if (d.go.startsWith('tab:')) showTab(d.go.slice(4));
    else if (d.go === 'step') { opts.step = true; $('oStep').checked = true; $('btnPlay').click(); }
    else if (d.go === 'issue') { const q = document.querySelector('[data-issue]'); if (q) q.click(); }
    else $(d.go).click();
  }
  else if (t.id === 'btnNext') stepGo = true;
  else if (t.id === 'btnReplay') {
    if (!rec || run) return;
    replay = !replay; if (replay && recPos >= rec.frames.length - 1) showFrame(0);
    t.textContent = replay ? '⏸' : '▶';
  }
  else if (d.act === 'rot') rotateSel(); else if (d.act === 'flip') flipSel(); else if (d.act === 'del') deleteSel();
  else if (d.act === 'lock') { for (const c of S.sel) c.fixed = !c.fixed; renderInspector(); }
  else if (t.id === 'btnUndo') doUndo();
  else if (t.id === 'btnRedo') doRedo();
  else if (t.id === 'btnRoute') { if (!run) { play(routeOnly()); } }
  else if (t.id === 'btnUnroute') { if (!run) { pushUndo(); S.router.ripAll(); refreshAll(); toast('配線をすべて消去しました'); } }
  else if (t.id === 'btnBack' && v3on) { v3.el = -v3.el; v3.dirty = true; S.sel.clear(); renderInspector(); dirty = true; }
  else if (t.id === 'btnBack') { if (!run) { S.view.flip = S.view.flip < 0 ? 1 : -1; S.sel.clear(); renderInspector(); t.setAttribute('aria-pressed', S.view.flip < 0); dirty = true; } }
  else if (t.id === 'btnFit') { if (v3on) v3.frameAll(); else fit(); }
  else if (t.id === 'btnPlay') play(autoLayout(parseInt($('seed').value, 10) || 1));
  else if (t.id === 'btnPause') { if (run) { playing = !playing; t.textContent = playing ? '一時停止' : '再開';  } }
  else if (t.id === 'btnStop') { if (run) finish('中止しました。ここから手動で調整できます。'); }
  else if (t.id === 'btnGen') genFromForm();
  else if (t.id === 'btnEmpty') { if (!run) { pushUndo(); setBoard(emptyBoard()); toast('空の基板を作成しました。ライブラリから部品を配置してください'); } }
  else if (t.id === 'btn3d') toggle3d();
  else if (t.id === 'btnStyle') { S.style = S.style === 'real' ? 'design' : 'real'; t.setAttribute('aria-pressed', S.style === 'real'); dirty = true; if (v3on) { v3.style = S.style; v3.sync(); } }
  else if (t.id === 'ioPro') { ioKind = 'pro'; $('ioText').value = kicadProject(); $('ioMsg').textContent = 'KiCad の設計ルール。gpu-board.kicad_pro として .kicad_pcb と同じフォルダに置いてください。'; }
  else if (t.id === 'btnIO' || t.id === 'ioJson') { ioKind = 'json'; $('ioText').value = JSON.stringify(saveData()); $('ioMsg').textContent = 'JSON を表示中'; if (!$('io').open) $('io').showModal(); }
  else if (t.id === 'ioKicad') { ioKind = 'kicad'; $('ioText').value = exportKicad(S.board); $('ioMsg').textContent = `KiCad 形式を表示中（${Math.round($('ioText').value.length / 1024)} KB）。開いたら B キーでゾーンを塗りつぶしてください。`; }
  else if (t.id === 'ioSave') saveFile();
  else if (t.id === 'ioCopy') { navigator.clipboard.writeText($('ioText').value).then(() => { $('ioMsg').textContent = 'コピーしました'; }, () => { $('ioText').select(); $('ioMsg').textContent = '選択しました。Ctrl+C でコピーしてください'; }); }
  else if (t.id === 'ioLoad') { if (run) return; try { loadText($('ioText').value); $('io').close(); } catch (err) { $('ioMsg').textContent = '読み込めません: ' + err.message; } }
  else if (t.id === 'ioClose') $('io').close();
});
document.addEventListener('change', e => {
  const t = e.target, d = t.dataset;
  if (d.layer) { S.layerVis[+d.layer] = t.checked; dirty = true; }
  else if (d.show) { S.show[d.show] = t.checked; refresh(); }
  else if (t.id === 'alt') swapPart(PART[t.value], $('altAll').checked);
  else if (t.id === 'gPreset') fillGen();
  else if (t.id === 'speed') speed = parseFloat(t.value);
  else if (t.id === 'live') liveRoute = t.checked;
  else if (t.id === 'oRegions') opts.regions = t.checked; else if (t.id === 'oPack') opts.pack = t.checked; else if (t.id === 'oTune') opts.tune = t.checked; else if (t.id === 'oStep') opts.step = t.checked;
  else if (t.id === 'oEffort') opts.effort = parseFloat(t.value);
  else if (t.id === 'ioFile' && t.files[0]) { const fr = new FileReader(); fr.onload = () => { try { loadText(String(fr.result)); $('io').close(); } catch (err) { $('ioMsg').textContent = '読み込めません: ' + err.message; } t.value = ''; }; fr.readAsText(t.files[0]); }
});
$('libq').addEventListener('input', renderLibrary);
$('netq').addEventListener('input', renderNets);
$('seek').addEventListener('input', e => { if (rec && !run) { replay = false; $('btnReplay').textContent = '▶'; showFrame(+e.target.value); } });
$('explode').addEventListener('input', e => { if (v3) { v3.explode = parseFloat(e.target.value); v3.sync(); } });
document.addEventListener('keydown', e => {
  if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); doRedo(); }
  else if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); doUndo(); }
  else if (k === 'r') rotateSel(); else if (k === 'f') flipSel();
  else if (k === 'delete' || k === 'backspace') { e.preventDefault(); deleteSel(); }
  else if (k === 'v') setTool('select'); else if (k === 'w') setTool('wire');
  else if (k === 'b') $('btnBack').click();
  else if (k === '3') toggle3d();
  else if (k === ' ' && run) { e.preventDefault(); $('btnPause').click(); }
  else if (k === 'escape') { S.ghost = null; S.wire = null; S.sel.clear(); pinNet = S.hiNet = null; renderInspector(); dirty = true; }
});

function resize() {
  const r = cv.parentElement.getBoundingClientRect();
  S.dpr = Math.min(2, window.devicePixelRatio || 1); S.cw = Math.max(50, r.width); S.ch = Math.max(50, r.height);
  cv.width = Math.round(S.cw * S.dpr); cv.height = Math.round(S.ch * S.dpr); dirty = true;
  if (v3on) v3.resize(S.cw, S.ch, S.dpr);
}
new ResizeObserver(() => { const first = !S.cw; resize(); if (first && S.board) fit(); }).observe(cv.parentElement);

let frameNo = 0;
const CAM = { scatter: -0.55, anneal: -0.15, route: 0.4, flip: 0.4, top: -0.3 };
function frame(now) {
  if (run && playing) {
    if (!stepWait) { elapsed += 1000 / 60; clock(elapsed); }
    let r;
    try { r = run.next(); } catch (err) { console.error(err); r = { done: true }; }
    if (r.done) finish('完了。部品をつかんで調整できます。シークバーで作成の過程を巻き戻せます。');
    else if (rec && !stepWait) { recFrame(); $('seek').value = (Math.max(0, STAGES.findIndex(q => q[0] === curStage)) + Math.min(1, stageProg)) * 200; }
    if (v3on && !userCam && run && CAM[curStage] != null) { v3.az += (CAM[curStage] - v3.az) * 0.025; v3.dirty = true; }   // 段階ごとに見る角度を変える
    dirty = true;
  } else if (replay && rec) {
    const n = Math.min(rec.frames.length - 1, recPos + Math.max(1, Math.round(speed)));
    showFrame(n);
    if (n >= rec.frames.length - 1) { replay = false; $('btnReplay').textContent = '▶'; refreshAll(); }
  }
  S.time = now / 1000;
  if (S.show.flow && S.show.zones && !v3on && !document.hidden && (frameNo++ & 1)) dirty = true;
  if (v3on) {
    if (dirty) { dirty = false; v3.sync(S); }
    if (run && playing && now - v3.texAt > 450) v3.paint(S);
    if (v3.dirty) v3.render();
  } else if (dirty) { dirty = false; draw(ctx, S); }
  requestAnimationFrame(frame);
}

// ───────── 起動 ─────────
$('stages').innerHTML = STAGES.map(([id, t]) => `<li data-s="${id}">${t}</li>`).join('');
$('gPreset').innerHTML = Object.entries(PRESETS).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join('');
$('gPreset').value = 'highend';
fillGen(); renderLibrary(); renderLayers(); resize();
toggle3d(true);
setBoard(generateGPU(PRESETS.highend));
stage('', 'リファレンス配置を表示中。部品はつかんで動かせます。「自動レイアウト」で 計画・整列 → 焼きなまし → 配線 → 裏面確認 を実行します。');
requestAnimationFrame(frame);
window.__pcb = { S, play, autoLayout, get v3() { return v3; } };
