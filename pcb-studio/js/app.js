import { LAYERS, snap, padWorld, compBox, ratsnest, convexHull, serialize, deserialize, sameSide } from './core.js';
import { PARTS, PART, CATS, alternatives } from './library.js';
import { PRESETS, generateGPU, emptyBoard } from './templates.js';
import { Router } from './router.js';
import { scatterTargets, anneal, overlapPairs, planRegions } from './placer.js';
import { draw, toWorld, flipOf } from './render.js';
import { exportKicad, importKicad, packPart, unpackPart } from './kicad.js';
import { View3D } from './view3d.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cv = $('cv'), ctx = cv.getContext('2d');

const S = {
  board: null, router: null, view: { x: 0, y: 0, z: 3, flip: 1 }, cw: 0, ch: 0, dpr: 1,
  sel: new Set(), hiNet: null, hiGroup: null, layerVis: [true, true, true, true],
  show: { rats: true, zones: true, far: true, labels: true },
  rats: [], zones: [], regions: null, ghost: null, wire: null, marquee: null, hoverPad: null,
};
let tool = 'select', dirty = true, liveRoute = true, pinNet = null, pinGroup = null;
let v3 = null, v3on = false, ioKind = 'json';
let undo = [], run = null, playing = false, speed = 1, t0 = 0, elapsed = 0;

// ───────── 基板の入れ替え・再計算 ─────────
function setBoard(b, route = true) {
  S.board = b; S.sel.clear(); S.hiNet = pinNet = null; S.hiGroup = pinGroup = null; S.ghost = null; S.wire = null;
  S.router = new Router(b);
  if (route) S.router.routeAllSync();
  fit(); refreshAll();
}
function refresh() { S.rats = S.show.rats ? ratsnest(S.board) : []; S.zones = zones(); dirty = true; }
function refreshAll() { refresh(); renderInspector(); renderStats(); renderLegend(); renderBom(); if (v3on) v3.setBoard(S.board); }
function zones() {
  const b = S.board, out = [];
  const gpu = b.comps.find(c => c.part.family === 'gpu');
  const width = { VCORE: Math.max(8, Math.min(18, (gpu ? gpu.part.val : 300) / 40)), VMEM: 6, '+12V': 6, '+12V_IN': 7, '+1V8': 3.5, '+PEX': 3.5 };
  for (const name of Object.keys(width)) {
    const n = b.nets.get(name); if (!n) continue;
    const w = width[name], nodes = [], seen = new Set();
    for (const p of n.pins) {
      const c = p.c; if (seen.has(c)) continue; seen.add(c);
      if (c.part.pads.length > 60) { // 大型 BGA は面で受ける
        const B = compBox(c, -Math.min(w / 2, c.part.w / 4));
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) nodes.push({ x: B.x0 + (B.x1 - B.x0) * i / 2, y: B.y0 + (B.y1 - B.y0) * j / 2 });
      } else nodes.push({ x: c.x, y: c.y });
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
    out.push({ name, w, nodes, edges });
  }
  return out;
}
function fit() {
  const b = S.board;
  S.view.z = Math.max(0.5, Math.min((S.cw - 24) / (b.w + 10), (S.ch - 90) / (b.gridH + 12)));
  S.view.x = b.w / 2 - 1; S.view.y = b.gridH / 2 + 3; dirty = true;
}
function pushUndo() { undo.push(JSON.stringify(serialize(S.board))); if (undo.length > 30) undo.shift(); }
function doUndo() {
  if (run) return;
  const s = undo.pop(); if (!s) return toast('これ以上戻せません');
  const v = { ...S.view };
  setBoard(deserialize(JSON.parse(s), PART)); S.view = v; toast('元に戻しました');
}
// 変更を確定：グリッドを作り直し、影響を受けたネットを再配線する
function commit(nets = []) {
  const R = S.router, b = S.board, set = new Set(nets);
  for (const n of set) R.ripNet(n);
  for (const n of R.rebuild()) { R.ripNet(n); set.add(n); }
  const list = [...set].filter(n => b.nets.get(n.name) === n);
  if (liveRoute && list.length) {
    for (const _ of R.routeMany(list));
    const fails = list.filter(n => n.route && n.route.fails.length).length;
    toast(`${list.length} 本を再配線${fails ? `（${fails} 本は未完了）` : ''}`);
  }
  refreshAll();
}
const netsOfSel = () => { const s = new Set(); for (const c of S.sel) for (const n of S.board.netsOf(c)) if (n.cls !== 'plane') s.add(n); return s; };

// ───────── ヒットテスト ─────────
const nearSide = () => (S.view.flip < 0 ? 'B' : 'T');
function compAt(w) {
  let best = null, ba = 1e18;
  for (const c of S.board.comps) {
    const near = c.side === nearSide() || c.part.th;
    if (!near && !S.show.far) continue;
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
  const order = (S.view.flip < 0 ? [3, 2, 1, 0] : [0, 1, 2, 3]).filter(l => S.layerVis[l]);
  return { net: S.router.netAt(w.x, w.y, order), hit: null };
}

// ───────── ポインタ操作 ─────────
const ptrs = new Map();
let drag = null, pinch = null;
const evPos = e => { const r = cv.getBoundingClientRect(); return { sx: e.clientX - r.left, sy: e.clientY - r.top }; };
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId);
  const { sx, sy } = evPos(e); ptrs.set(e.pointerId, { sx, sy });
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.sx - b.sx, a.sy - b.sy), z: S.view.z }; drag = null; return; }
  const w = toWorld(S, sx, sy);
  if (e.button === 1 || e.button === 2 || run) { drag = { kind: 'pan', sx, sy, vx: S.view.x, vy: S.view.y }; return; }
  if (S.ghost) { placeGhost(e.shiftKey); return; }
  if (tool === 'wire') { wireClick(w, e.altKey); return; }
  const c = compAt(w);
  if (c) {
    if (e.shiftKey) { S.sel.has(c) ? S.sel.delete(c) : S.sel.add(c); }
    else if (!S.sel.has(c)) { S.sel.clear(); S.sel.add(c); }
    drag = { kind: 'move', w0: w, orig: new Map([...S.sel].map(k => [k, { x: k.x, y: k.y }])), moved: false };
    renderInspector(); dirty = true; return;
  }
  if (e.shiftKey) { drag = { kind: 'marquee', sx, sy }; return; }
  drag = { kind: 'pan', sx, sy, vx: S.view.x, vy: S.view.y, click: true };
});
cv.addEventListener('pointermove', e => {
  const { sx, sy } = evPos(e);
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { sx, sy });
  if (pinch && ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    S.view.z = Math.max(0.5, Math.min(60, pinch.z * Math.hypot(a.sx - b.sx, a.sy - b.sy) / pinch.d)); dirty = true; return;
  }
  const w = toWorld(S, sx, sy);
  if (S.ghost) { S.ghost.x = snap(w.x); S.ghost.y = snap(w.y); dirty = true; }
  if (S.wire) { S.wire.to = w; dirty = true; }
  if (!drag) { hover(w, sx, sy); return; }
  if (drag.kind === 'pan') {
    if (Math.hypot(sx - drag.sx, sy - drag.sy) > 3) drag.click = false;
    S.view.x = drag.vx - (sx - drag.sx) / S.view.z / flipOf(S); S.view.y = drag.vy - (sy - drag.sy) / S.view.z; dirty = true;
  } else if (drag.kind === 'move') {
    const dx = snap(w.x - drag.w0.x), dy = snap(w.y - drag.w0.y);
    if (!drag.moved && (dx || dy)) { drag.moved = true; pushUndo(); drag.nets = netsOfSel(); for (const n of drag.nets) S.router.ripNet(n); }
    if (drag.moved) { for (const [c, o] of drag.orig) { c.x = o.x + dx; c.y = o.y + dy; } refresh(); }
  } else if (drag.kind === 'marquee') { S.marquee = { x0: drag.sx, y0: drag.sy, x1: sx, y1: sy }; dirty = true; }
});
const endPtr = e => {
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
  } else if (d.kind === 'pan' && d.click && !run) {
    const { net } = netAt(toWorld(S, d.sx, d.sy));
    pinNet = net && net.cls !== 'plane' ? net : null; S.hiNet = pinNet;
    if (S.sel.size) { S.sel.clear(); renderInspector(); }
    dirty = true;
  }
};
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => {
  e.preventDefault();
  const { sx, sy } = evPos(e), w = toWorld(S, sx, sy);
  S.view.z = Math.max(0.5, Math.min(60, S.view.z * Math.exp(-e.deltaY * 0.0015)));
  const w2 = toWorld(S, sx, sy);
  S.view.x += (w.x - w2.x) * flipOf(S); S.view.y += w.y - w2.y; dirty = true;
}, { passive: false });
cv.addEventListener('pointerleave', () => { $('tip').hidden = true; if (!pinNet && S.hiNet) { S.hiNet = null; dirty = true; } });

function hover(w, sx, sy) {
  const tip = $('tip');
  if (run) { tip.hidden = true; return; }
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
  if (!html) { const c = compAt(w); if (c) html = `<b>${esc(c.ref)}</b> ${esc(c.part.pn)}<br>${esc(c.part.name)}`; }
  tip.hidden = !html;
  if (html) { tip.innerHTML = html; tip.style.left = Math.min(S.cw - 190, sx + 14) + 'px'; tip.style.top = Math.max(4, sy - 8) + 'px'; }
}

// ───────── 編集操作 ─────────
function rotateSel() {
  if (S.ghost) { S.ghost.rot = (S.ghost.rot + 90) % 360; dirty = true; return; }
  if (!S.sel.size || run) return;
  pushUndo(); const nets = netsOfSel(); for (const c of S.sel) c.rot = (c.rot + 90) % 360; commit(nets);
}
function flipSel() {
  if (!S.sel.size || run) return;
  pushUndo(); const nets = netsOfSel();
  for (const c of S.sel) if (!c.part.th) c.side = c.side === 'T' ? 'B' : 'T';
  commit(nets);
}
function deleteSel() {
  if (!S.sel.size || run) return;
  pushUndo(); const nets = netsOfSel(); for (const n of nets) S.router.ripNet(n);
  for (const c of S.sel) S.board.remove(c);
  S.sel.clear(); commit(nets);
}
function startPlace(part) {
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
  const b = S.board, base = [...S.sel][0]; if (!base || run) return;
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
const STAGES = [['scatter', '散布'], ['anneal', '焼きなまし'], ['route', '配線'], ['flip', '裏面確認'], ['top', '表面へ']];
function stage(id, text) {
  for (const el of document.querySelectorAll('#stages li')) {
    const i = STAGES.findIndex(s => s[0] === el.dataset.s), k = STAGES.findIndex(s => s[0] === id);
    el.className = i < k ? 'done' : i === k ? 'on' : '';
  }
  if (text != null) $('status').textContent = text;
}
function* routeStage(nets) {
  const R = S.router;
  R.ripAll(); R.rebuild(); refresh();
  let k = 0;
  for (const ev of R.routeMany(nets || [...S.board.nets.values()])) {
    const what = ev.phase === 'route' ? 'route' : ev.phase === 'ripup' ? '引き剥がし再配線' : ev.phase === 'tune' ? '等長化（ミアンダ挿入）' : '再配線';
    stage('route', `route | ${ev.i}/${ev.total} ${what} ${ev.key || ev.net.name}`);
    $('prog').value = ev.i / ev.total;
    if (++k % Math.max(1, Math.round(speed)) === 0) { refresh(); yield; if (speed < 1) yield; }
  }
  refresh();
}
function* flipStage() {
  const ease = t => (1 - Math.cos(Math.PI * t)) / 2;
  stage('flip', '基板を裏返して裏面の部品と配線を確認');
  if (v3on) {
    const e0 = v3.el;
    for (let t = 0; t < 1; t += 0.014 * speed) { v3.el = e0 - 2 * Math.abs(e0) * ease(t); v3.dirty = true; $('prog').value = t; yield; }
    for (let t = 0; t < 1; t += 0.012 * speed) yield;
    stage('top', '表面に戻る');
    for (let t = 0; t < 1; t += 0.014 * speed) { v3.el = e0 - 2 * Math.abs(e0) * (1 - ease(t)); v3.dirty = true; $('prog').value = t; yield; }
    v3.el = e0; v3.dirty = true; return;
  }
  for (let t = 0; t < 1; t += 0.014 * speed) { S.view.flip = 1 - 2 * ease(t); $('prog').value = t; dirty = true; yield; }
  S.view.flip = -1; dirty = true;
  for (let t = 0; t < 1; t += 0.012 * speed) yield;
  stage('top', '表面に戻る');
  for (let t = 0; t < 1; t += 0.014 * speed) { S.view.flip = -1 + 2 * ease(t); $('prog').value = t; dirty = true; yield; }
  S.view.flip = 1; dirty = true;
}
function* autoLayout(seed) {
  const b = S.board;
  S.router.ripAll(); S.sel.clear(); S.hiNet = pinNet = null;
  S.regions = [...planRegions(b)].map(([g, r]) => ({ ...r, label: (b.group(g) || {}).label || g, color: (b.group(g) || {}).color || '#fff' }));
  const tg = scatterTargets(b, seed), from = new Map([...tg.keys()].map(c => [c, { x: c.x, y: c.y }]));
  stage('scatter', S.regions.length ? `scatter: 電源の流れ（12V 入力 → VRM → GPU）でグループ領域を割り当て、その中へ散布 (seed ${seed})` : `scatter: 各グループの部品を、配線が望む位置の周りへ散布 (seed ${seed})`);
  for (let t = 0; t < 1; t += 0.02 * speed) {
    const e = t * t * (3 - 2 * t);
    for (const [c, p] of tg) { const o = from.get(c); c.x = o.x + (p.x - o.x) * e; c.y = o.y + (p.y - o.y) * e; }
    $('prog').value = t; refresh(); yield;
  }
  for (const [c, p] of tg) { c.x = p.x; c.y = p.y; }
  const an = anneal(b, seed, 140);
  for (let done = false; !done;) {
    let ev = null;
    for (let i = 0; i < Math.max(1, Math.round(speed)); i++) { const r = an.next(); if (r.done) { done = true; break; } ev = r.value; }
    if (ev) {
      stage('anneal', ev.legal ? `legalize: 重なり解消 ${ev.legal} 回目 | overlap ${ev.overlap.toFixed(2)} mm²`
        : `anneal: move ${ev.move}/${ev.total} | T ${ev.T.toFixed(3)} | cost ${Math.round(ev.cost)} | overlap ${ev.overlap.toFixed(2)} mm²`);
      $('prog').value = ev.move / ev.total;
    }
    refresh(); yield;
  }
  S.regions = null;
  yield* routeStage();
  yield* flipStage();
}
function* routeOnly() { yield* routeStage(); }
function play(gen) {
  if (run) return;
  pushUndo(); S.ghost = null; setTool('select');
  run = gen; playing = true; t0 = performance.now(); elapsed = 0;
  document.body.classList.add('running'); $('btnPause').textContent = '一時停止';
}
function finish(msg) {
  run = null; playing = false; S.regions = null; document.body.classList.remove('running');
  S.view.flip = S.view.flip < 0 ? -1 : 1;
  for (const c of S.board.comps) { c.x = snap(c.x); c.y = snap(c.y); }
  for (const n of S.router.rebuild()) S.router.ripNet(n);
  stage('', msg); for (const el of document.querySelectorAll('#stages li')) el.className = msg.startsWith('完了') ? 'done' : '';
  $('prog').value = 1; refreshAll();
}

// ───────── 3D 表示・保存読込 ─────────
function toggle3d() {
  if (!v3) v3 = new View3D($('cv3'));
  if (!v3.ok) return toast('3D ライブラリを読み込めませんでした（ネットワークを確認してください）');
  v3on = !v3on;
  $('cv3').hidden = !v3on; $('explodeWrap').hidden = !v3on; $('btn3d').setAttribute('aria-pressed', v3on); $('tip').hidden = true;
  if (v3on) { v3.resize(S.cw, S.ch, S.dpr); v3.setBoard(S.board); toast('3D 表示：ドラッグで回転、Shift+ドラッグで移動、ホイールで拡大。編集は 2D に戻って行います'); }
}
const saveData = () => ({ ...serialize(S.board), custom: [...new Set(S.board.comps.map(c => c.part))].filter(p => p.cat === 'kicad').map(packPart) });
function loadText(text) {
  const t = text.trim();
  let b;
  if (t.startsWith('(kicad_pcb')) b = importKicad(t, p => { PART[p.id] = p; });
  else { const d = JSON.parse(t); for (const p of d.custom || []) PART[p.id] = unpackPart(p); b = deserialize(d, PART); }
  pushUndo(); setBoard(b);
  const st = S.router.stats();
  toast(`読み込みました：${b.comps.length} 部品・配線 ${st.routed}/${st.total}`);
  stage('', t.startsWith('(kicad_pcb') ? 'KiCad 基板を取り込み、このツールのグリッドで再配線しました（元の配線は使いません）。' : '読み込みました。');
}
async function saveFile() {
  const kicad = ioKind === 'kicad', text = $('ioText').value, msg = $('ioMsg');
  const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
  if (dl) {
    try { await dl.save({ filename: kicad ? 'gpu-board.kicad_pcb.txt' : 'gpu-board.json', data: text }); msg.textContent = kicad ? '保存しました。ファイル名末尾の .txt を外すと KiCad で開けます。' : '保存しました。'; }
    catch (err) { msg.textContent = err && err.code === 'declined' ? '保存を取り消しました。' : 'この画面では保存できません。「コピー」を使ってください。'; }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = kicad ? 'gpu-board.kicad_pcb' : 'gpu-board.json';
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
  if (run) return;
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
  const b = S.board, st = S.router.stats(), ov = overlapPairs(b);
  let off = 0;
  for (const c of b.comps) { const B = compBox(c); if (c.part.family !== 'pcie' && (B.x0 < 0 || B.y0 < 0 || B.x1 > b.w || B.y1 > b.h)) off++; }
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
  $('stats').innerHTML = `<table>${rows.join('')}</table>`;
}
function renderLegend() {
  const b = S.board, cnt = {};
  for (const c of b.comps) cnt[c.group] = (cnt[c.group] || 0) + 1;
  $('legend').innerHTML = b.groups.filter(g => cnt[g.id]).map(g => `<button data-g="${g.id}" aria-pressed="${pinGroup === g.id}"><i style="background:${g.color}"></i>${esc(g.label)} <span>(${g.kind}) ${cnt[g.id]}</span></button>`).join('');
}
function renderBom() {
  const m = new Map();
  for (const c of S.board.comps) m.set(c.part, (m.get(c.part) || 0) + 1);
  const rows = [...m].sort((a, b) => b[1] - a[1]).map(([p, n]) => `<tr><td class="num">${n}</td><td><span class="pn">${esc(p.pn)}</span><br><span class="dim">${esc(p.mfr)}・${esc(p.name)}</span></td></tr>`);
  $('bom').innerHTML = `<table>${rows.join('')}</table>`; $('bomN').textContent = `${m.size} 品種 / ${S.board.comps.length} 点`;
}
function renderLayers() {
  $('layers').innerHTML = LAYERS.map(l => `<label class="ck"><input type="checkbox" data-layer="${l.id}" id="ly${l.id}" checked><i style="background:${l.color}"></i>${l.label}</label>`).join('')
    + [['rats', '未配線（ラッツネスト）'], ['zones', '電源プレーン領域'], ['far', '反対面の部品'], ['labels', '部品ラベル']].map(([k, t]) => `<label class="ck"><input type="checkbox" data-show="${k}" id="sh_${k}" checked>${t}</label>`).join('');
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
  else if (d.g) { pinGroup = pinGroup === d.g ? null : d.g; S.hiGroup = pinGroup; renderLegend(); dirty = true; }
  else if (d.tab) { for (const b of document.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', b === t); $('tabLib').hidden = d.tab !== 'lib'; $('tabGen').hidden = d.tab !== 'gen'; }
  else if (d.act === 'rot') rotateSel(); else if (d.act === 'flip') flipSel(); else if (d.act === 'del') deleteSel();
  else if (d.act === 'lock') { for (const c of S.sel) c.fixed = !c.fixed; renderInspector(); }
  else if (t.id === 'btnUndo') doUndo();
  else if (t.id === 'btnRoute') { if (!run) { play(routeOnly()); } }
  else if (t.id === 'btnUnroute') { if (!run) { pushUndo(); S.router.ripAll(); refreshAll(); toast('配線をすべて消去しました'); } }
  else if (t.id === 'btnBack') { if (!run) { S.view.flip = S.view.flip < 0 ? 1 : -1; S.sel.clear(); renderInspector(); t.setAttribute('aria-pressed', S.view.flip < 0); dirty = true; } }
  else if (t.id === 'btnFit') { if (v3on) v3.frameAll(); else fit(); }
  else if (t.id === 'btnPlay') play(autoLayout(parseInt($('seed').value, 10) || 1));
  else if (t.id === 'btnPause') { if (run) { playing = !playing; t.textContent = playing ? '一時停止' : '再開'; if (playing) t0 = performance.now() - elapsed; } }
  else if (t.id === 'btnStop') { if (run) finish('中止しました。ここから手動で調整できます。'); }
  else if (t.id === 'btnGen') genFromForm();
  else if (t.id === 'btnEmpty') { if (!run) { pushUndo(); setBoard(emptyBoard()); toast('空の基板を作成しました。ライブラリから部品を配置してください'); } }
  else if (t.id === 'btn3d') toggle3d();
  else if (t.id === 'btnIO' || t.id === 'ioJson') { ioKind = 'json'; $('ioText').value = JSON.stringify(saveData()); $('ioMsg').textContent = 'JSON を表示中'; if (!$('io').open) $('io').showModal(); }
  else if (t.id === 'ioKicad') { ioKind = 'kicad'; $('ioText').value = exportKicad(S.board); $('ioMsg').textContent = `KiCad 形式を表示中（${Math.round($('ioText').value.length / 1024)} KB）`; }
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
  else if (t.id === 'ioFile' && t.files[0]) { const fr = new FileReader(); fr.onload = () => { try { loadText(String(fr.result)); $('io').close(); } catch (err) { $('ioMsg').textContent = '読み込めません: ' + err.message; } t.value = ''; }; fr.readAsText(t.files[0]); }
});
$('libq').addEventListener('input', renderLibrary);
$('explode').addEventListener('input', e => { if (v3) { v3.explode = parseFloat(e.target.value); v3.sync(); } });
document.addEventListener('keydown', e => {
  if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); doUndo(); }
  else if (k === 'r') rotateSel(); else if (k === 'f') flipSel();
  else if (k === 'delete' || k === 'backspace') { e.preventDefault(); deleteSel(); }
  else if (k === 'v') setTool('select'); else if (k === 'w') setTool('wire');
  else if (k === 'b') $('btnBack').click();
  else if (k === '3') toggle3d();
  else if (k === 'escape') { S.ghost = null; S.wire = null; S.sel.clear(); pinNet = S.hiNet = null; renderInspector(); dirty = true; }
});

function resize() {
  const r = cv.parentElement.getBoundingClientRect();
  S.dpr = Math.min(2, window.devicePixelRatio || 1); S.cw = Math.max(50, r.width); S.ch = Math.max(50, r.height);
  cv.width = Math.round(S.cw * S.dpr); cv.height = Math.round(S.ch * S.dpr); dirty = true;
  if (v3on) v3.resize(S.cw, S.ch, S.dpr);
}
new ResizeObserver(() => { const first = !S.cw; resize(); if (first && S.board) fit(); }).observe(cv.parentElement);

function frame(now) {
  if (run && playing) {
    elapsed = now - t0;
    const s = Math.floor(elapsed / 1000); $('clock').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    let r;
    try { r = run.next(); } catch (err) { console.error(err); r = { done: true }; }
    if (r.done) finish('完了。部品をドラッグして調整できます。');
    dirty = true;
  }
  if (v3on) {
    if (run && playing) { v3.sync(); if (now - v3.texAt > 600) v3.paint(); }
    if (v3.dirty) v3.render();
  } else if (dirty) { dirty = false; draw(ctx, S); }
  requestAnimationFrame(frame);
}

// ───────── 起動 ─────────
$('stages').innerHTML = STAGES.map(([id, t]) => `<li data-s="${id}">${t}</li>`).join('');
$('gPreset').innerHTML = Object.entries(PRESETS).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join('');
$('gPreset').value = 'highend';
fillGen(); renderLibrary(); renderLayers(); resize();
setBoard(generateGPU(PRESETS.highend));
stage('', 'リファレンス配置を表示中。「自動レイアウトを再生」で 散布 → 焼きなまし → 配線 → 裏面確認 を実行します。');
requestAnimationFrame(frame);
window.__pcb = { S, play, autoLayout, get v3() { return v3; } };
