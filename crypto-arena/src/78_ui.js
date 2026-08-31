
/* ================================================================
   UI 基盤 — SVGアイコン / 折りたたみセクション / アイコンレール
   文字ラベルで説明していた操作をアイコンに寄せ、
   すべてのパネルを畳めるようにする。
   アイコン単独のボタンには必ず data-tip（ホバー説明）を付ける。
================================================================ */
const ICONS = {
  /* レベル */
  site:    'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z M9 3v15 M15 6v15',
  plaza:   'M3 21h18 M5 21V8l7-5 7 5v13 M10 21v-6h4v6',
  bowl:    'M12 3c5 0 9 2 9 4.5S17 12 12 12 3 10 3 7.5 7 3 12 3z M3 7.5v6C3 16 7 18 12 18s9-2 9-4.5v-6',
  bolt:    'M13 2L4 14h7l-1 8 9-12h-7z',
  /* 表示モード */
  solid:   'M12 2l9 5v10l-9 5-9-5V7z M12 12l9-5 M12 12v10 M12 12L3 7',
  points:  'M5 5h.01 M12 5h.01 M19 5h.01 M5 12h.01 M12 12h.01 M19 12h.01 M5 19h.01 M12 19h.01 M19 19h.01',
  wire:    'M12 2l9 5v10l-9 5-9-5V7z M3 7l9 5 9-5 M12 12v10',
  blue:    'M4 3h16v18H4z M8 7h8 M8 11h8 M8 15h5',
  /* レイヤー */
  users:   'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  tag:     'M20.6 13.4L12 22l-9-9V3h10z M7.5 7.5h.01',
  route:   'M6 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M18 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M9 16h6a3 3 0 0 0 3-3',
  target:  'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  gem:     'M6 3h12l4 6-10 12L2 9z M2 9h20 M12 3L8 9l4 12 4-12z',
  alert:   'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z M12 9v4 M12 17h.01',
  chart:   'M3 3v18h18 M7 15l4-4 3 3 5-6',
  ticket:  'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4z M12 6v2 M12 12v2',
  eye:     'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  badge:   'M12 2l3 6 6 .9-4.5 4.3 1.1 6.3L12 16.5 6.4 19.5l1.1-6.3L3 8.9 9 8z',
  dollar:  'M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  /* ツール */
  map2d:   'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z M9 3v15 M15 6v15',
  play:    'M6 3l14 9-14 9z',
  pause:   'M7 4h3v16H7z M14 4h3v16h-3z',
  down:    'M12 3v13 M7 11l5 5 5-5 M4 21h16',
  filter:  'M3 4h18l-7 8v7l-4 2v-9z',
  layers:  'M12 2L2 7l10 5 10-5z M2 12l10 5 10-5 M2 17l10 5 10-5',
  ruler:   'M4 20L20 4 M4 20l-2-2L18 2l2 2z M8 14l2 2 M11 11l2 2 M14 8l2 2',
  cut:     'M6 3v12 M18 3v12 M3 15h18 M9 19h6',
  plus:    'M12 5v14 M5 12h14',
  pencil:  'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  trash:   'M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v6 M14 11v6',
  close:   'M18 6L6 18 M6 6l12 12',
  chev:    'M6 9l6 6 6-6',
  save:    'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z M17 21v-8H7v8 M7 3v5h8',
  refresh: 'M23 4v6h-6 M1 20v-6h6 M3.5 9a9 9 0 0 1 14.9-3.4L23 10 M1 14l4.6 4.4A9 9 0 0 0 20.5 15',
  csv:     'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 13h6 M9 17h6',
  gauge:   'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z M12 12l4-4',
  clock:   'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2',
  bell:    'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0',
  /* 交通 */
  car:     'M5 17h14 M6 17v2 M18 17v2 M4 13l1.5-5A2 2 0 0 1 7.4 6.5h9.2a2 2 0 0 1 1.9 1.5L20 13v4H4z M7 15h.01 M17 15h.01',
  train:   'M8 21l-2 2 M16 21l2 2 M4 15V5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z M4 10h16 M9 14h.01 M15 14h.01',
  walk:    'M13 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M10 22l2-6-2-3V8l4-1 3 4 3 1 M10 13l-3 3-1 6',
  ride:    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l4 2',
};
function ic(n, sz, cls) {
  const d = ICONS[n];
  if (!d) return '';
  return '<svg class="ic' + (cls ? ' ' + cls : '') + '" width="' + (sz || 15) + '" height="' +
    (sz || 15) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round">' +
    d.split(' M').map((p, i) => '<path d="' + (i ? 'M' + p : p) + '"/>').join('') + '</svg>';
}

/* ---- ホバー説明（アイコン単独ボタン用） ---- */
const uiTip = document.createElement('div');
uiTip.id = 'ui-tip';
document.body.appendChild(uiTip);
document.addEventListener('mouseover', e => {
  const t = e.target.closest && e.target.closest('[data-tip]');
  if (!t) return;
  uiTip.textContent = t.dataset.tip;
  uiTip.style.display = 'block';
  const r = t.getBoundingClientRect(), b = uiTip.getBoundingClientRect();
  uiTip.style.left = clamp(r.left + r.width / 2 - b.width / 2, 6, innerWidth - b.width - 6) + 'px';
  uiTip.style.top = (r.top > b.height + 10 ? r.top - b.height - 7 : r.bottom + 7) + 'px';
});
document.addEventListener('mouseout', e => {
  if (e.target.closest && e.target.closest('[data-tip]')) uiTip.style.display = 'none';
});

/* ---- 折りたたみセクション ---- */
const UI = { closed: new Set(['ui-poi', 'ui-infra', 'ui-price', 'ui-bim']), rail: false };
function sec(id, icon, title, body, opt) {
  opt = opt || {};
  const off = UI.closed.has(id);
  return '<div class="sec sec-c' + (off ? ' off' : '') + '" data-sec="' + id + '">' +
    '<div class="sec-hd" data-sectog="' + id + '">' +
      '<span class="sec-ic">' + ic(icon, 14) + '</span>' +
      '<span class="sec-ti">' + title + '</span>' +
      (opt.badge ? '<span class="sec-bd">' + opt.badge + '</span>' : '') +
      '<span class="sec-ch">' + ic('chev', 13) + '</span>' +
    '</div>' +
    '<div class="sec-bd-wrap">' + body + '</div></div>';
}
function bindSections(root) {
  (root || document).querySelectorAll('[data-sectog]').forEach(h => h.onclick = () => {
    const id = h.dataset.sectog;
    if (UI.closed.has(id)) UI.closed.delete(id); else UI.closed.add(id);
    const s = h.parentElement;
    s.classList.toggle('off', UI.closed.has(id));
    if (!UI.closed.has(id)) flushVizVisible(s);
  });
}
function flushVizVisible(root) {
  root.querySelectorAll('canvas[data-viz]').forEach(cv => {
    if (cv.__spec) {
      ({ line: vizLine, bars: vizBars, hbars: vizHBars, donut: vizDonut, scatter: vizScatter,
         funnel: vizFunnel, heat: vizHeat, spark: vizSpark }[cv.__spec.type] || vizBars)(cv, cv.__spec);
    }
  });
}

/* ---- アイコンレール（パネル全体の畳み込み） ---- */
const RAIL_ITEMS = {
  site:  [['ui-view', 'layers', '表示モード'], ['ui-pc', 'points', '点群ツール'],
          ['ui-stat', 'chart', 'サイト構成'], ['ui-infra', 'train', '交通インフラ'],
          ['ui-flow', 'route', '移動経路'], ['ui-heat', 'gauge', '賑わい'],
          ['ui-od', 'target', 'OD分析'], ['ui-iso', 'clock', '到達圏'],
          ['ui-poi', 'tag', 'POI']],
  plaza: [['ui-plz', 'plaza', 'エントランス'], ['ui-gate', 'ticket', 'ゲート'],
          ['ui-bim', 'layers', 'BIM要素']],
  arena: [['ui-game', 'ticket', '興行'], ['ui-kpi', 'chart', 'KPI'],
          ['ui-map', 'target', '席マッピング'], ['ui-layer', 'layers', '座席レイヤー'],
          ['ui-seg', 'tag', 'セグメント構成'], ['ui-reg', 'route', '商圏'],
          ['ui-price', 'dollar', '価格最適化'], ['ui-indoor', 'users', '場内動線'],
          ['ui-bim', 'plaza', 'BIM表示'], ['ui-tool', 'filter', 'ツール']],
};
function renderRail() {
  const items = RAIL_ITEMS[level] || RAIL_ITEMS.site;
  return '<div id="rail">' +
    '<button class="rail-b rail-x" data-tip="パネルを開く" id="rail-open">' + ic('chev', 16) + '</button>' +
    items.map(it => '<button class="rail-b" data-railto="' + it[0] + '" data-tip="' + it[2] + '">' +
      ic(it[1], 17) + '</button>').join('') + '</div>';
}
function setRail(on) {
  UI.rail = on;
  const p = document.getElementById('panel'), r = document.getElementById('rail-wrap');
  p.style.display = on ? 'none' : 'flex';
  r.style.display = on ? 'block' : 'none';
  if (on) {
    r.innerHTML = renderRail();
    document.getElementById('rail-open').onclick = () => setRail(false);
    r.querySelectorAll('[data-railto]').forEach(b => b.onclick = () => {
      UI.closed.delete(b.dataset.railto);
      setRail(false);
      const t = document.querySelector('[data-sec="' + b.dataset.railto + '"]');
      if (t) { t.classList.remove('off'); t.scrollIntoView({ block: 'nearest' }); flushVizVisible(t); }
    });
  }
}
