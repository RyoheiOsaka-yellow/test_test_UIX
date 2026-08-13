/* ============================================================
   XBUILD — station_app.js
   既存ビューア（新宿駅 構内図 3D 等）へ人流データフロー層を載せるアダプタ。
   ------------------------------------------------------------
   ホストへの要求は最小:
     window.__app = { scene, graph: { nodes: Map<id,{pos,ordinal}>, links: [] } }
   ホストのシーングラフ・レンダループ・UI・データには一切手を入れない。
   このファイルだけが three.js と DOM を参照する（SPEC.md §22）。

   座標系: ホストは Y-up（x=東 / y=高さ / z=-北）、エンジンは Z-up。
   変換はここで閉じる。フロア展開スライダには scale.y で追随する。
   ============================================================ */

'use strict';

const { Graph } = require('./cook');
const { toRenderBuffers } = require('./convert');
const { reg, setNetwork, setFloorHeight } = require('./station_nodes');

const HOST = (typeof window !== 'undefined' && window.__app) || null;
if (!HOST) throw new Error('host viewer not found (window.__app)');

const FLOOR_H = 30;      // ホストのフロア間隔
const NODE_LIFT = 1.5;   // ホストがノード位置に足している浮かし
const DRAW_LIFT = 1.6;   // 描画時に床から浮かせる量

/* ============================================================
   0. three.js の入手
   ------------------------------------------------------------
   このホストは `window.__THREE__` に版番号の文字列しか置いていない
   （名前空間ではない）。バンドラで畳まれた three にも触れないため、
   **シーンに実在するオブジェクトからコンストラクタを収穫する**。
   結果として、three の公開方法が違う他のビューアにも移植できる。
   ============================================================ */

function harvestTHREE(scene) {
  const T = window.__THREE__ || window.THREE;
  if (T && typeof T === 'object' && T.Group && T.Points && T.BufferGeometry) return T;

  const out = {};
  scene.traverse((o) => {
    if (!out.Group && o.isGroup) out.Group = o.constructor;
    if (!out.Points && o.isPoints) {
      out.Points = o.constructor;
      out.BufferGeometry = o.geometry.constructor;
      const pa = o.geometry.attributes.position;
      if (pa) out.BufferAttribute = pa.constructor;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (m && m.isPointsMaterial) out.PointsMaterial = m.constructor;
    }
    if (!out.LineSegments && o.isLineSegments && !o.isLineSegments2) {
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (m && m.isLineBasicMaterial) {
        out.LineSegments = o.constructor;
        out.LineBasicMaterial = m.constructor;
        if (!out.BufferGeometry) out.BufferGeometry = o.geometry.constructor;
        if (!out.BufferAttribute && o.geometry.attributes.position)
          out.BufferAttribute = o.geometry.attributes.position.constructor;
      }
    }
  });
  const missing = ['Group', 'Points', 'PointsMaterial', 'LineSegments', 'LineBasicMaterial',
                   'BufferGeometry', 'BufferAttribute'].filter(k => !out[k]);
  if (missing.length) throw new Error('could not harvest three.js constructors: ' + missing.join(', '));
  return out;
}

const THREE = harvestTHREE(HOST.scene);

/* ============================================================
   1. ホストの歩行ネットワークをエンジンへ取り込む
   ============================================================ */

/**
 * 出入口フラグ。ホストの実行時グラフは pos と ordinal しか持たないので、
 * 埋め込み GeoJSON の in_out（歩行空間ネットワークデータの出入口区分）を直接読む。
 * 手に入らなければ「次数1のノード = 行き止まり」を出入口の代用にする。
 */
function entranceFlags(ids) {
  const data = window.__EMBEDDED_DATA;
  if (!data) return null;
  const key = Object.keys(data).find(k => /node\.geojson$/i.test(k));
  if (!key || !data[key] || !Array.isArray(data[key].features)) return null;
  const map = new Map();
  for (const f of data[key].features) {
    const p = f.properties || {};
    if (p.node_id != null) map.set(p.node_id, Number(p.in_out) === 1 ? 1 : 0);
  }
  const flags = ids.map(id => map.get(id) || 0);
  return flags.some(v => v === 1) ? flags : null;
}

function importNetwork() {
  const hg = HOST.graph;
  const ids = [...hg.nodes.keys()];
  const index = new Map();
  ids.forEach((id, i) => index.set(id, i));

  const flags = entranceFlags(ids);
  const nodes = ids.map((id, i) => {
    const n = hg.nodes.get(id);
    const ord = n.ordinal != null ? n.ordinal : 0;
    return {
      id,
      x: n.pos.x,
      y: -n.pos.z,          // host z = -north
      z: ord * FLOOR_H,     // 浮かしは描画側で足す
      ordinal: ord,
      inout: flags ? flags[i] : 0,
    };
  });

  const links = [];
  let dangling = 0;
  for (const l of hg.links) {
    const a = index.get(l.startId), b = index.get(l.endId);
    if (a === undefined || b === undefined) { dangling++; continue; }
    const pts = (l.points || []).map(p => [p.x, -p.z, p.y - NODE_LIFT]);
    links.push({ a, b, pts: pts.length >= 2 ? pts : null, len: l.length, oneWay: !!l.oneWay });
  }

  if (!flags) {   // 出入口が判らないホスト向けの代用
    const deg = new Int32Array(nodes.length);
    for (const l of links) { deg[l.a]++; deg[l.b]++; }
    for (let i = 0; i < nodes.length; i++) if (deg[i] === 1) nodes[i].inout = 1;
  }

  setFloorHeight(FLOOR_H);
  const net = setNetwork({ name: '歩行空間ネットワーク', nodes, links, dangling });
  net.entranceSource = flags ? 'in_out (GeoJSON)' : 'degree-1 fallback';
  return net;
}

const net = importNetwork();

/* ============================================================
   2. データフロー グラフ
   ============================================================ */

const flowGraph = new Graph(reg);
flowGraph.add('stationagents', {
  count: 800, mode: 'both', destFloors: '-2,-1', window: 120, dwell: 25, speed: 1.0, minRoute: 40,
}, 'agents1');
flowGraph.add('stationload', {}, 'load1');
flowGraph.connect('agents1', 'load1', 0);
flowGraph.displayNode = 'agents1';

/* ============================================================
   3. 描画レイヤ（P6.5 の差分更新をそのまま持ち込む）
   ============================================================ */

const root = new THREE.Group();
root.name = 'xbuild-flow';
HOST.scene.add(root);

let agentObj = null, loadObj = null;
const stats = { inPlace: 0, rebuilt: 0, lastCookMs: 0, cooked: 0 };

/** エンジン Z-up (x,y,z) -> ホスト Y-up (x, z+lift, -y)。配列を破壊的に変換する */
function toHostSpace(arr) {
  for (let i = 0; i < arr.length; i += 3) {
    const ey = arr[i + 1], ez = arr[i + 2];
    arr[i + 1] = ez + DRAW_LIFT;
    arr[i + 2] = -ey;
  }
  return arr;
}

/**
 * ホストは three r15x 以降で色管理が有効。頂点色はリニア色として扱われるため、
 * 手調整パレット（sRGB 前提）をそのまま渡すと明るく転ぶ。ここで逆変換しておく。
 */
function toLinear(arr) {
  for (let i = 0; i < arr.length; i++) {
    const c = arr[i];
    arr[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  return arr;
}

const ADDITIVE = 2;   // THREE.AdditiveBlending（名前空間が無いので定数値で指定する）

function makePoints(bufs, size) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(bufs.points.position, 3));
  g.setAttribute('color', new THREE.BufferAttribute(bufs.points.color, 3));
  const m = new THREE.PointsMaterial({
    size, vertexColors: true, sizeAttenuation: false,
    transparent: true, opacity: 1, depthWrite: false,
    blending: ADDITIVE,           // 暗背景で発光して見える
    depthTest: !state.xray,       // 貫通表示なら全フロアの人が同時に見える
  });
  const o = new THREE.Points(g, m);
  o.renderOrder = 20;
  o.frustumCulled = false;
  return o;
}

function makeLines(bufs) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(bufs.lines.position, 3));
  g.setAttribute('color', new THREE.BufferAttribute(bufs.lines.color, 3));
  const m = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false,
    blending: ADDITIVE, depthTest: !state.xray,
  });
  const o = new THREE.LineSegments(g, m);
  o.renderOrder = 19;
  o.frustumCulled = false;
  return o;
}

function dispose(obj) {
  if (!obj) return null;
  root.remove(obj);
  obj.geometry.dispose();
  obj.material.dispose();
  return null;
}

/** 頂点数が同じなら BufferGeometry を作り直さない（SPEC §20.2） */
function updateOrRebuild(obj, bufs, kind, size) {
  const src = kind === 'points' ? bufs.points : bufs.lines;
  if (!src.count) return dispose(obj);
  toHostSpace(src.position);
  toLinear(src.color);
  if (obj && obj.geometry.attributes.position.array.length === src.position.length) {
    obj.geometry.attributes.position.array.set(src.position);
    obj.geometry.attributes.position.needsUpdate = true;
    obj.geometry.attributes.color.array.set(src.color);
    obj.geometry.attributes.color.needsUpdate = true;
    stats.inPlace++;
    return obj;
  }
  dispose(obj);
  const next = kind === 'points' ? makePoints(bufs, size) : makeLines(bufs);
  root.add(next);
  stats.rebuilt++;
  return next;
}

/* ============================================================
   4. UI（ホストのパネル意匠に合わせた追加パネル）
   ============================================================ */

const ui = document.createElement('div');
ui.id = 'xbuild-flow-panel';
ui.innerHTML = `
<style>
#xbuild-flow-panel{position:fixed;right:14px;bottom:14px;z-index:20;width:252px;
  padding:12px 14px;background:rgba(8,12,24,.86);border:1px solid rgba(120,180,255,.22);
  border-radius:10px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
  font:12px/1.5 'Hiragino Kaku Gothic ProN','Hiragino Sans','Noto Sans JP',sans-serif;
  color:#c6d4e8;user-select:none;max-height:calc(100vh - 28px);overflow-y:auto}
#xbuild-flow-panel h3{font-size:13px;font-weight:600;letter-spacing:.12em;color:#eaf4ff;margin:0}
#xbuild-flow-panel .sub{font-size:9px;letter-spacing:.2em;color:#5f7ba0;margin:2px 0 8px}
#xbuild-flow-panel .sep{height:1px;background:rgba(120,180,255,.16);margin:8px 0}
#xbuild-flow-panel label{display:flex;align-items:center;gap:8px;padding:3px 0;cursor:pointer}
#xbuild-flow-panel .lab{font-size:10px;letter-spacing:.1em;color:#7d93b5;margin:6px 0 2px}
#xbuild-flow-panel input[type=range]{width:100%;accent-color:#00b7d9;cursor:pointer;margin:0}
#xbuild-flow-panel input[type=checkbox]{accent-color:#00b7d9;cursor:pointer}
#xbuild-flow-panel select{width:100%;background:rgba(20,28,48,.9);color:#dfe8f5;
  border:1px solid rgba(120,180,255,.24);border-radius:5px;padding:3px 6px;font:inherit;font-size:11px;cursor:pointer}
#xbuild-flow-panel select:hover{border-color:#00e5ff;color:#fff}
#xbuild-flow-panel .val{color:#00e5ff;font-size:10px}
#xbuild-flow-panel table{width:100%;border-collapse:collapse;font-size:10px;
  font-variant-numeric:tabular-nums;margin-top:2px}
#xbuild-flow-panel td{padding:1px 0;color:#8ea3c0;vertical-align:top}
#xbuild-flow-panel td:last-child{text-align:right;color:#c6d4e8;white-space:nowrap}
#xbuild-flow-panel .warn{color:#ffcf6b} #xbuild-flow-panel .cache{color:#5f7ba0}
#xbuild-flow-panel .ok{color:#6fe0a0}
</style>
<h3>XBUILD 人流エンジン</h3>
<div class="sub">DATAFLOW LAYER</div>
<label><input type="checkbox" id="xf-on" checked> 表示</label>
<label><input type="checkbox" id="xf-play" checked> 再生</label>
<label><input type="checkbox" id="xf-load"> リンク混雑度</label>
<label><input type="checkbox" id="xf-xray" checked> 貫通表示（全フロア）</label>
<div class="sep"></div>
<div class="lab">エージェント数 <span class="val" id="xf-count-v">800</span></div>
<input type="range" id="xf-count" min="100" max="4000" step="100" value="800">
<div class="lab">速度 <span class="val" id="xf-speed-v">×1.0</span></div>
<input type="range" id="xf-speed" min="0.2" max="6" step="0.2" value="1">
<div class="lab">出発の分散 <span class="val" id="xf-window-v">120s</span></div>
<input type="range" id="xf-window" min="10" max="600" step="10" value="120">
<div class="lab">最低経路長 <span class="val" id="xf-minroute-v">40m</span></div>
<input type="range" id="xf-minroute" min="0" max="300" step="10" value="40">
<div class="lab">経路</div>
<select id="xf-mode">
  <option value="both">入場 + 退場</option>
  <option value="in">入場（出入口 → 目的階）</option>
  <option value="out">退場（目的階 → 出入口）</option>
</select>
<div class="lab">色分け</div>
<select id="xf-color">
  <option value="state">状態</option>
  <option value="floor">フロア</option>
  <option value="progress">進捗</option>
  <option value="speed">歩行速度</option>
  <option value="routeLen">経路長</option>
</select>
<div class="lab">目的地の階（ダミー需要）</div>
<select id="xf-dest">
  <option value="-2,-1">地下2階 / 地下1階</option>
  <option value="-1">地下1階</option>
  <option value="-2">地下2階</option>
  <option value="0">地上1階</option>
  <option value="2">2階</option>
  <option value="-3,-2,-1">地下全階</option>
</select>
<div class="sep"></div>
<table id="xf-report"></table>
`;
document.body.appendChild(ui);

const $ = (sel) => ui.querySelector(sel);
const state = { on: true, play: true, showLoad: false, xray: true, colorBy: 'state', time: 0 };
let needsCook = true;

function bindRange(id, fmt, apply) {
  const el = $(id), out = $(id + '-v');
  el.addEventListener('input', () => {
    const v = parseFloat(el.value);
    if (out) out.textContent = fmt(v);
    apply(v);
    needsCook = true;
  });
}

const agentNode = () => flowGraph.get('agents1');

bindRange('#xf-count', v => String(v), v => agentNode().setParam('count', v | 0));
bindRange('#xf-speed', v => '×' + v.toFixed(1), v => agentNode().setParam('speed', v));
bindRange('#xf-window', v => v + 's', v => agentNode().setParam('window', v));
bindRange('#xf-minroute', v => v + 'm', v => agentNode().setParam('minRoute', v));

$('#xf-mode').addEventListener('change', e => { agentNode().setParam('mode', e.target.value); needsCook = true; });
$('#xf-dest').addEventListener('change', e => { agentNode().setParam('destFloors', e.target.value); needsCook = true; });
$('#xf-color').addEventListener('change', e => { state.colorBy = e.target.value; needsCook = true; });
$('#xf-on').addEventListener('change', e => { state.on = e.target.checked; root.visible = state.on; });
$('#xf-play').addEventListener('change', e => { state.play = e.target.checked; });
$('#xf-load').addEventListener('change', e => {
  state.showLoad = e.target.checked;
  if (!state.showLoad) loadObj = dispose(loadObj);
  needsCook = true;
});
$('#xf-xray').addEventListener('change', e => {
  state.xray = e.target.checked;
  for (const o of [agentObj, loadObj]) {
    if (!o) continue;
    o.material.depthTest = !state.xray;
    o.material.needsUpdate = true;
  }
});

/* ============================================================
   5. 評価ループ
   ------------------------------------------------------------
   ホストのレンダループには触らない。独立した rAF でバッファだけ更新し、
   描画はホストが毎フレーム行う（非破壊拡張）。
   ============================================================ */

/* 暗背景に加算合成で重ねるので、全域が明るいランプを使う（§22.4） */
const RAMP = { state: 'flow', floor: 'vivid', progress: 'flow', speed: 'flow', routeLen: 'vivid' };
const RANGE = { state: [0, 2], progress: [0, 1] };

const expandEl = document.getElementById('floor-expand');

function cookFrame() {
  const t0 = performance.now();
  const base = flowGraph.cookCount;
  const geo = flowGraph.cook('agents1', { time: state.time });
  const bufs = toRenderBuffers(geo, {
    colorBy: state.colorBy,
    ramp: RAMP[state.colorBy] || 'yellow',
    range: RANGE[state.colorBy],
  });
  agentObj = updateOrRebuild(agentObj, bufs, 'points', 5.0);

  if (state.showLoad) {
    const lgeo = flowGraph.cook('load1', { time: state.time });
    const lbufs = toRenderBuffers(lgeo, { colorBy: 'loadNorm', ramp: 'heat', range: [0, 1] });
    loadObj = updateOrRebuild(loadObj, lbufs, 'lines');
  }
  stats.lastCookMs = performance.now() - t0;
  stats.cooked = flowGraph.cookCount - base;
  renderReport(geo);
}

function renderReport(geo) {
  const d = (n) => { const a = geo.detail.get(n); return a ? a.get(0) : 0; };
  const rows = [
    ['歩行 / 滞留 / 待機', `${d('walking')} / ${d('dwelling')} / ${d('waiting')}`],
    ['平均経路長', d('meanRoute').toFixed(0) + ' m'],
    ['出入口 / 目的地', `${d('entrances')} / ${d('destNodes')}`],
    ['ネットワーク', `${net.nodes.length} 点 / ${net.links.length} 辺`],
  ];
  for (const [id, r] of Object.entries(flowGraph.report())) {
    const st = r.error ? `<span class="warn">${String(r.error).slice(0, 40)}</span>`
      : (stats.cooked > 0 ? `<span class="ok">${r.ms}ms</span>` : '<span class="cache">キャッシュ</span>');
    rows.push([id, `${r.points ? r.points + ' 点' : r.prims + ' 辺'} ${st}`]);
  }
  rows.push(['更新', `差分 ${stats.inPlace} / 再構築 ${stats.rebuilt}`]);
  rows.push(['t', state.time.toFixed(1) + ' s']);
  $('#xf-report').innerHTML = rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');
}

let last = performance.now();
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  // フロア展開スライダに追随（ホストは scale.y / position.y で表現している）
  if (expandEl) {
    const ex = parseFloat(expandEl.value);
    if (isFinite(ex) && root.scale.y !== ex) root.scale.y = ex;
  }

  if (!state.on) return;
  if (state.play) { state.time += dt; needsCook = true; }
  if (needsCook) { cookFrame(); needsCook = false; }
}

cookFrame();
loop();

/* 検証 / 操作用フック */
window.__xbflow = {
  graph: flowGraph, net, root, stats, state,
  cook: (t) => { state.time = t; cookFrame(); },
  setParam: (k, v) => { agentNode().setParam(k, v); cookFrame(); },
  positions: () => {
    const a = agentObj && agentObj.geometry.attributes.position;
    return a ? Array.from(a.array) : [];
  },
  counts: () => ({
    agents: agentObj ? agentObj.geometry.attributes.position.count : 0,
    loadLines: loadObj ? loadObj.geometry.attributes.position.count / 2 : 0,
  }),
};
