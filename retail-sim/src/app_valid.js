/* =========================================================================
   モデル検証タブ
   - 創発した指標を「公開統計」「モデル設計レンジ」と突合して範囲内かを判定
   - 物理・幾何の不変条件をブラウザ上でその場で検査（内部整合性）
   - seed を振った反復実行で KPI の分布を出し、
     「設定を変えた効果」と「乱数のブレ」を切り分ける
   ========================================================================= */

/* 参照レンジ。出典が実在するものと、プロトタイプの設計レンジを区別して持つ。 */
function validRefs() {
  const conbini = FKEY === 'conbini';
  return [
    {
      k: '客単価', label: '客単価', unit: '円', fmt: v => fmtYenFull(v),
      lo: conbini ? 640 : 2000, hi: conbini ? 860 : 3100, kind: 'stat',
      src: conbini ? 'JFA コンビニ統計 748.5円（2025年11月・既存店）' : '百貨店デパ地下の想定客単価 2,500円（商業動態統計の構成比から設定）',
    },
    {
      k: '歩行速度', label: '店内歩行速度（平均）', unit: 'm/s', fmt: v => v.toFixed(2),
      lo: 0.55, hi: 1.05, kind: 'stat',
      src: '屋内・売場内の歩行は屋外（約1.3m/s）より遅く 0.6〜1.0m/s 程度',
    },
    {
      k: '最下行シェア', label: '最下行の視線シェア', unit: '', fmt: v => fmtPct(v, 1),
      lo: 0.05, hi: 0.13, kind: 'stat',
      src: 'アイトラッキング文献の最下段 8〜12%（本モデルは12×6格子の最下行で計測）',
    },
    {
      k: 'ゴールデンシェア', label: 'ゴールデン帯の視線シェア', unit: '', fmt: v => fmtPct(v, 0),
      lo: 0.40, hi: 0.70, kind: 'stat',
      src: 'ゴールデンゾーン 床上85〜150cm に什器売上の8〜9割（エイジス等の解説）',
    },
    {
      k: 'カメラ捕捉率', label: 'AIカメラ 視線秒の捕捉率', unit: '', fmt: v => fmtPct(v, 0),
      lo: 0.65, hi: 0.95, kind: 'design',
      src: '実機CCTVの取りこぼし（画角外・遮蔽・検出漏れ）を踏まえた設計レンジ',
    },
    {
      k: '棚前滞在', label: '棚前の平均滞在', unit: '秒', fmt: v => v.toFixed(1) + 's',
      lo: 8, hi: 45, kind: 'design',
      src: 'ペルソナ別の滞在係数 0.6〜1.6 × 基準10〜30秒',
    },
    {
      k: '視線獲得率', label: '視線獲得率（視線/通過）', unit: '', fmt: v => fmtPct(v, 0),
      lo: 0.25, hi: 0.85, kind: 'design',
      src: '通過した什器のうち0.7注視秒以上を獲得した割合',
    },
    {
      k: '立寄率', label: '立寄率（立寄/通過）', unit: '', fmt: v => fmtPct(v, 0),
      lo: 0.05, hi: 0.40, kind: 'design',
      src: '買い回り計画に基づく立寄。通過のほとんどは素通り',
    },
    {
      k: '立寄購買率', label: '立寄→購買', unit: '', fmt: v => fmtPct(v, 0),
      lo: 0.25, hi: 0.70, kind: 'design',
      src: '手取率 0.62 × 転換率（注意の量と質で変動）',
    },
    {
      k: '探索比率', label: '棚前4相のうち探索', unit: '', fmt: v => fmtPct(v, 0),
      lo: 0.40, hi: 0.70, kind: 'design',
      src: '定位14% / 探索 / 比較 / 取得16% の時間配分',
    },
  ];
}

/* =========================================================================
   スキャンパス（2D）
   追跡中の客の注視を、いま見ている什器の正面図に時系列で描く。
   アイトラッキングの標準的な出力そのもの:
     ・注視点の順序（番号と線）
     ・停留時間 ∝ 円の大きさ
     ・棚前4相で色分け
   ========================================================================= */
const SCAN_PHASE = { orient: ['#9aa9bc', '定位'], scan: ['#0f9fba', '探索'], compare: ['#c98500', '比較'], pick: ['#d55181', '取得'], pass: ['#7a8ba0', '通過'] };

function scanPanelTarget() {
  if (window.CLOUD && CLOUD.on && CLOUD.tracked && !CLOUD.tracked.done) return CLOUD.tracked;
  if (typeof followTarget !== 'undefined' && followTarget && !followTarget.done) return followTarget;
  return null;
}

function renderScanPanel() {
  const box = document.getElementById('scanpath');
  const cv = document.getElementById('cv-scan');
  const meta = document.getElementById('scan-meta');
  if (!box || !cv || !meta) return;
  const a = scanPanelTarget();
  const cur = a && a.scan && a.scan.length ? a.scan[a.scan.length - 1].sid : null;
  // いま（または直前に）見ていた什器に限定して描く
  const pts = a && a.scan ? a.scan.filter(p => p.sid === cur).slice(-24) : [];
  const s = cur ? shelfById[cur] : null;
  const setup = setupCanvas(cv, 150);
  if (!setup) return;
  const { ctx, w, h } = setup;
  ctx.clearRect(0, 0, w, h);
  if (!a || !s || pts.length < 1) {
    ctx.fillStyle = '#9aa9bc'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('追跡中の客が棚を見ると表示されます', w / 2, h / 2);
    meta.innerHTML = '';
    return;
  }
  const mL = 6, mR = 6, mT = 6, mB = 6;
  const pw = w - mL - mR, ph = h - mT - mB;
  const H = s.size[1];
  const isle = s.kind === 'island-case';
  // 棚段のガイド
  ctx.strokeStyle = 'rgba(92,113,134,0.22)'; ctx.lineWidth = 1;
  const tiers = H > 1.7 ? 4 : 3;
  for (let i = 0; i <= tiers; i++) {
    const y = mT + ph * (1 - i / tiers);
    ctx.beginPath(); ctx.moveTo(mL, y); ctx.lineTo(mL + pw, y); ctx.stroke();
  }
  // ゴールデンゾーン帯（床上85〜150cm）
  if (!isle) {
    const gy0 = mT + ph * (1 - Math.min(1, 1.50 / H)), gy1 = mT + ph * (1 - Math.min(1, 0.85 / H));
    ctx.fillStyle = 'rgba(201,133,0,0.10)'; ctx.fillRect(mL, gy0, pw, gy1 - gy0);
    ctx.strokeStyle = 'rgba(201,133,0,0.45)'; ctx.setLineDash([4, 3]);
    ctx.strokeRect(mL + 0.5, gy0 + 0.5, pw - 1, gy1 - gy0 - 1); ctx.setLineDash([]);
  }
  ctx.strokeStyle = 'rgba(92,113,134,0.55)'; ctx.strokeRect(mL + 0.5, mT + 0.5, pw - 1, ph - 1);

  const X = p => mL + clamp(p.u, 0, 1) * pw;
  const Y = p => mT + ph * (1 - clamp(isle ? (p.y - 0.5) / 0.55 : p.y / H, 0, 1));
  // 注視の順序（線）
  ctx.strokeStyle = 'rgba(27,61,92,0.5)'; ctx.lineWidth = 1.4;
  ctx.beginPath();
  pts.forEach((p, i) => { const x = X(p), y = Y(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.stroke();
  // 注視点（停留時間 ∝ 半径）
  pts.forEach((p, i) => {
    const r = 4 + Math.min(11, p.dur * 1.5);
    const col = (SCAN_PHASE[p.ph] || SCAN_PHASE.pass)[0];
    ctx.beginPath(); ctx.arc(X(p), Y(p), r, 0, Math.PI * 2);
    ctx.fillStyle = col + 'cc'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke();
    if (r >= 6) {
      ctx.fillStyle = '#fff'; ctx.font = '700 9px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), X(p), Y(p));
    }
  });
  ctx.textBaseline = 'alphabetic';

  const tot = pts.reduce((x, p) => x + p.dur, 0);
  const used = {};
  pts.forEach(p => used[p.ph] = (used[p.ph] || 0) + p.dur);
  meta.innerHTML = `
    <b>#${100000 + (a.id % 9000)}</b> ${a.persona.label} ・ <b>${s.name}</b><br>
    注視 ${pts.length}点 ／ 合計 ${tot.toFixed(1)}秒 ／ 平均停留 ${(tot / pts.length).toFixed(1)}秒
    ${a.cmpCount ? ` ／ 比較サッケード ${a.cmpCount}回` : ''}
    <div class="scan-leg">${Object.keys(used).map(k =>
      `<span><i style="background:${(SCAN_PHASE[k] || SCAN_PHASE.pass)[0]}"></i>${(SCAN_PHASE[k] || SCAN_PHASE.pass)[1]} ${used[k].toFixed(1)}s</span>`).join('')}</div>
    <div style="margin-top:3px;color:var(--text-faint)">円の大きさ＝停留時間／番号＝注視の順序／橙破線＝ゴールデンゾーン</div>`;
}
window.renderScanPanel = renderScanPanel;

/* ---------- 内部整合性チェック（不変条件をその場で検査） ---------- */
function runInvariants() {
  const act = agents.filter(a => !a.done);
  const out = [];
  // ① 視線レイが什器を貫通していないか
  let through = 0, rays = 0;
  act.forEach(a => {
    if (!a.gazing || !a.gazeHit) return;
    rays++;
    if (losBlocked(a.x, a.eyeH, a.z, a.gazeHit[0], a.gazeHit[1], a.gazeHit[2], a.gazeShelf)) through++;
  });
  out.push({ name: '視線が什器を貫通しない', ok: through === 0, got: `${through} / ${rays} 本`, want: '0本' });
  // ② 首の可動域
  let maxYaw = 0;
  act.forEach(a => {
    let d = (a.headYaw || 0) - a.heading;
    while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    maxYaw = Math.max(maxYaw, Math.abs(d) * 57.3);
  });
  out.push({ name: '頭部の回旋が首の可動域内', ok: maxYaw <= 74.5, got: maxYaw.toFixed(1) + '°', want: '≤ 74°' });
  // ③ 注視している棚＝最も強く計測された棚（中心視は1点）
  let m = 0, n = 0;
  act.forEach(a => { if (a.gazing && a.fix && a.gazeShelf) { n++; if (a.gazeShelf === a.fix.sid) m++; } });
  out.push({ name: '注視棚＝最大計測棚', ok: n === 0 || m / n >= 0.9, got: n ? `${m} / ${n}` : '—', want: '≥ 90%' });
  // ④ 客が什器にめり込んでいない
  let inside = 0;
  act.forEach(a => {
    SHELVES.forEach(s => {
      if (Math.abs(a.x - s.pos[0]) < s.size[0] / 2 - 0.05 && Math.abs(a.z - s.pos[2]) < s.size[2] / 2 - 0.05) inside++;
    });
  });
  out.push({ name: '客が什器にめり込まない', ok: inside === 0, got: inside + '人', want: '0人' });
  // ⑤ 視線を一度も受けていないセル
  let dead = 0, cells = 0;
  SHELVES.forEach(s => {
    const st = STATS.shelves[s.id];
    if (!st || !st.grid || s.kind === 'counter') return;
    for (let i = 0; i < st.grid.length; i++) { cells++; if (st.grid[i] < 1e-4) dead++; }
  });
  out.push({ name: '視線ゼロのセルが残らない', ok: dead <= Math.max(2, cells * 0.01), got: `${dead} / ${cells}`, want: '≤ 1%' });
  // ⑥ 計測値は真値を超えない
  let over = 0;
  SHELVES.forEach(s => { const st = STATS.shelves[s.id]; if (st && st.gazeSecObs > st.gazeSec * 1.001) over++; });
  out.push({ name: 'AIカメラ計測値 ≤ 真値', ok: over === 0, got: over + '売場', want: '0売場' });
  return out;
}

/* =========================================================================
   データ書き出し
   実店舗のPOS・人流データと突合できるよう、計測値を生データで出す。
   ブラウザ内で完結（サーバー不要）。
   ========================================================================= */
function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function downloadText(name, text, mime) {
  // Excel が UTF-8 を正しく開けるよう BOM を付ける
  const blob = new Blob(['﻿' + text], { type: (mime || 'text/csv') + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadCSV(name, header, rows) {
  downloadText(name, [header].concat(rows).map(r => r.map(csvEscape).join(',')).join('\n'));
}
const stamp = () => `${FKEY}_d${STATS.day}_${String(Math.floor(STATS.simSec / 3600)).padStart(2, '0')}${String(Math.floor(STATS.simSec / 60) % 60).padStart(2, '0')}`;

function exportShelfSummary() {
  const rows = SHELVES.map(s => {
    const st = STATS.shelves[s.id];
    const ph = st.phaseSec, phTot = ph.reduce((a, b) => a + b, 0) || 1;
    const back = st.putBackPrice + st.putBackOther;
    return [
      s.id, s.name, s.cat, s.kind, s.price, s.promoted ? 1 : 0,
      Math.round(st.passes * SF()), Math.round(st.gazes * SF()), Math.round(st.stops * SF()),
      Math.round(st.picks * SF()), Math.round(st.purchases * SF()),
      st.gazeSec.toFixed(1), st.gazeSecObs.toFixed(1),
      st.gazeSec > 0 ? (st.goldenSec / st.gazeSec).toFixed(4) : '',
      st.gazeSec > 30 ? (st.purchases / st.gazeSec * 1000).toFixed(2) : '',
      st.dwellN ? (st.attnSum / st.dwellN).toFixed(2) : '',
      st.purchases ? (st.attnBuySum / st.purchases).toFixed(2) : '',
      (ph[0] / phTot).toFixed(3), (ph[1] / phTot).toFixed(3), (ph[2] / phTot).toFixed(3), (ph[3] / phTot).toFixed(3),
      st.dwellN ? (st.candSum / st.dwellN).toFixed(2) : '',
      st.picks ? (back / st.picks).toFixed(3) : '', back ? (st.putBackPrice / back).toFixed(3) : '',
      st.coverage.toFixed(3), st.camMean.toFixed(2),
      st.cellTot ? (st.cellHit / st.cellTot).toFixed(3) : '',
    ];
  });
  downloadCSV(`shelf_summary_${stamp()}.csv`, [
    'shelf_id', 'shelf_name', 'category', 'fixture_kind', 'price_yen', 'is_promoted',
    'passes', 'gazes', 'stops', 'picks', 'purchases',
    'gaze_sec_true', 'gaze_sec_observed', 'golden_share', 'units_per_1000_gaze_sec',
    'attn_sec_mean', 'attn_sec_mean_buyers',
    'phase_orient', 'phase_scan', 'phase_compare', 'phase_pick',
    'candidates_mean', 'putback_rate', 'putback_price_share',
    'camera_coverage', 'camera_count_mean', 'cell_accuracy',
  ], rows);
}

function exportGazeGrid() {
  const rows = [];
  SHELVES.forEach(s => {
    const st = STATS.shelves[s.id];
    if (!st.grid) return;
    const isle = s.kind === 'island-case';
    for (let v = 0; v < GRID_V; v++) {
      for (let u = 0; u < GRID_U; u++) {
        const i = v * GRID_U + u;
        const hcm = isle ? '' : (((v + 0.5) / GRID_V) * s.size[1] * 100).toFixed(1);
        rows.push([s.id, s.name, u, v, hcm,
          isle ? '' : (hcm >= 85 && hcm <= 150 ? 1 : 0),
          st.grid[i].toFixed(3), st.gridObs[i].toFixed(3), st.gridRecent[i].toFixed(3)]);
      }
    }
  });
  downloadCSV(`gaze_grid_${stamp()}.csv`,
    ['shelf_id', 'shelf_name', 'col_u', 'row_v', 'height_cm', 'is_golden_zone',
     'gaze_sec_true', 'gaze_sec_observed', 'gaze_sec_last30min'], rows);
}

function exportScanpaths() {
  const rows = [];
  agents.filter(a => !a.done && a.scan && a.scan.length).forEach(a => {
    a.scan.forEach((p, i) => {
      const s = shelfById[p.sid];
      rows.push([100000 + (a.id % 9000), a.persona.key, a.persona.label, a.eyeH0.toFixed(2),
        i + 1, p.t, p.dur.toFixed(2), p.ph, p.sid, s ? s.name : '',
        p.u.toFixed(4), (s ? clamp(p.y / s.size[1], 0, 1) : 0).toFixed(4), (p.y * 100).toFixed(1),
        p.x.toFixed(3), p.y.toFixed(3), p.z.toFixed(3)]);
    });
  });
  downloadCSV(`scanpaths_${stamp()}.csv`,
    ['person_id', 'persona_key', 'persona', 'eye_height_m',
     'fixation_index', 'sim_time_sec', 'duration_sec', 'phase', 'shelf_id', 'shelf_name',
     'face_u', 'face_v', 'height_cm', 'world_x', 'world_y', 'world_z'], rows);
}

function exportMonteCarlo() {
  const names = Object.keys(MC.scenarios);
  if (!names.length) return;
  const keys = Object.keys(MC.scenarios[names[0]].results[0]);
  const rows = [];
  names.forEach(nm => MC.scenarios[nm].results.forEach((r, i) => {
    rows.push([nm, MC.scenarios[nm].settings, i + 1].concat(keys.map(k => (+r[k]).toFixed(4))));
  }));
  downloadCSV(`montecarlo_${stamp()}.csv`, ['scenario', 'settings', 'replication'].concat(keys), rows);
}

/* ---------- モンテカルロ ---------- */
const MC = { runs: [], busy: false, n: 6, scenarios: {}, cmpKey: null };

function mcStats(vals) {
  const a = vals.slice().sort((x, y) => x - y);
  const mean = a.reduce((s, v) => s + v, 0) / a.length;
  const sd = Math.sqrt(a.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(a.length - 1, 1));
  return { mean, sd, lo: a[0], hi: a[a.length - 1], p5: a[Math.floor(a.length * 0.05)], p95: a[Math.min(a.length - 1, Math.floor(a.length * 0.95))] };
}

/* 反復を1本ずつ走らせ、その都度 UI に返す（UIが固まらないよう分割実行） */
function mcRun(n, label, done) {
  if (MC.busy) return;
  MC.busy = true;
  const snap = snapshotSim();
  const results = [];
  const wasPaused = S.paused;
  S.paused = true;
  const step = i => {
    if (i >= n) {
      restoreSim(snap);
      S.paused = wasPaused;
      MC.busy = false;
      MC.scenarios[label] = { results, settings: scenarioLabel() };
      renderValid();
      if (done) done(results);
      return;
    }
    results.push(runReplication(BASE_SEED + 1009 * (i + 1)));
    const el = document.getElementById('mc-progress');
    if (el) el.textContent = `反復実行中… ${i + 1} / ${n}（seed を振って同じ1日を回しています）`;
    setTimeout(() => step(i + 1), 0);
  };
  setTimeout(() => step(0), 0);
}

function scenarioLabel() {
  return `広告${S.budget}万 / ノベルティ${S.novelty ? Math.round(S.novRate * 100) + '%' : 'なし'}`
    + ` / エンド${S.endcap ? '有' : '無'} / サイネージ${S.signage ? '有' : '無'}`
    + ` / ${WEATHER[S.weather].label} / 人流${S.traffic.toFixed(1)}×${S.rival ? ' / 競合セール' : ''}`;
}

/* ---------- 描画 ---------- */
const MC_KEYS = [
  { k: '売上', fmt: v => fmtYen(v) },
  { k: '来店', fmt: v => fmtNum(v) + '人' },
  { k: '販促個数', fmt: v => fmtNum(v) + '個' },
  { k: '欠品ロス', fmt: v => fmtNum(v) + '個' },
  { k: '客単価', fmt: v => fmtYenFull(v) },
  { k: '買上率', fmt: v => fmtPct(v, 1) },
  { k: '注視効率', fmt: v => v.toFixed(1) },
];

function renderValid() {
  const el = document.getElementById('valid-body');
  if (!el) return;
  const m = collectMetrics();
  const refs = validRefs();
  const rows = refs.map(r => {
    const v = m[r.k];
    const ok = v >= r.lo && v <= r.hi;
    const pos = clamp((v - r.lo) / Math.max(r.hi - r.lo, 1e-9), -0.25, 1.25);
    return { r, v, ok, pos };
  });
  const nOk = rows.filter(x => x.ok).length;
  const inv = runInvariants();
  const invOk = inv.filter(x => x.ok).length;

  const names = Object.keys(MC.scenarios);
  const cmp = names.length >= 2 ? mcCompare(names[names.length - 2], names[names.length - 1]) : null;

  el.innerHTML = `
    <div class="card">
      <div class="card-title" data-ccollapse>参照レンジとの突合<span class="hint">${nOk} / ${rows.length} が範囲内</span><span class="ctgl">▾</span></div>
      <div class="card-body">
        <div class="mde-text" style="margin-bottom:8px">
          シミュレーションから<b>創発した</b>指標（直接そう設定してはいない値）を、公開統計およびモデルの設計レンジと突合する。
          <span style="color:${COL.s1}">●</span> は実在の公開統計に紐づく指標、
          <span style="color:var(--text-faint)">●</span> はプロトタイプの設計レンジ。
          範囲外が出たら、モデルか較正のどちらかが壊れている。
        </div>
        ${rows.map(x => `
          <div class="sp-factor" style="align-items:flex-start">
            <span class="fl" style="width:168px">
              <span style="color:${x.r.kind === 'stat' ? COL.s1 : 'var(--text-faint)'}">●</span> ${x.r.label}
            </span>
            <span class="fb" style="height:16px;background:#eef2f7;position:relative;border-radius:8px">
              <span style="position:absolute;left:0;top:0;bottom:0;width:100%;border-radius:8px;background:linear-gradient(90deg,#fff 0%,${x.ok ? 'rgba(20,122,85,.16)' : 'rgba(197,48,48,.12)'} 12%,${x.ok ? 'rgba(20,122,85,.16)' : 'rgba(197,48,48,.12)'} 88%,#fff 100%)"></span>
              <span style="position:absolute;left:${(clamp(x.pos, 0, 1) * 100).toFixed(1)}%;top:1px;bottom:1px;width:3px;border-radius:2px;background:${x.ok ? COL.good : COL.bad};transform:translateX(-1.5px)"></span>
            </span>
            <span class="fv" style="width:150px;text-align:right">
              <b style="color:${x.ok ? COL.good : COL.bad}">${x.r.fmt(x.v)}</b>
              <span style="font-weight:400;color:var(--text-faint)"> / 参照 ${x.r.fmt(x.r.lo)}〜${x.r.fmt(x.r.hi)}</span>
            </span>
          </div>
          <div class="sd-note" style="margin:-2px 0 6px 178px">${x.r.src}</div>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-title" data-ccollapse>内部整合性チェック<span class="hint">${invOk} / ${inv.length} 合格・その場で検査</span><span class="ctgl">▾</span></div>
      <div class="card-body">
        <div class="mde-text" style="margin-bottom:7px">
          物理・幾何の不変条件を、いまこの瞬間の店内状態に対して実際に検査している（スクリーンショットではなく実行結果）。
        </div>
        <table style="width:100%">
          <thead><tr><th>不変条件</th><th>実測</th><th>期待</th><th>判定</th></tr></thead>
          <tbody>${inv.map(i => `
            <tr><td>${i.name}</td><td>${i.got}</td><td>${i.want}</td>
              <td><span style="color:${i.ok ? COL.good : COL.bad};font-weight:700">${i.ok ? '合格' : '不合格'}</span></td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-title" data-ccollapse>データ書き出し<span class="hint">実データとの突合用</span><span class="ctgl">▾</span></div>
      <div class="card-body">
        <div class="mde-text" style="margin-bottom:8px">
          計測値を生データのCSVで書き出す。実店舗のPOS・人流データと突合したり、
          外部の分析環境（R/Python/BI）へ持ち込むための導線。ブラウザ内で完結する。
        </div>
        <div class="sp-btnrow">
          <button id="ex-shelf">棚別サマリ</button>
          <button id="ex-grid">視線グリッド</button>
          <button id="ex-scan">スキャンパス</button>
          <button id="ex-mc" class="ghost" ${Object.keys(MC.scenarios).length ? '' : 'disabled'}>モンテカルロ結果</button>
        </div>
        <div class="sd-note" style="margin-top:7px">
          <b>棚別サマリ</b>: 売場×（通過/視線/立寄/手取/購買・視線秒の真値と計測値・ゴールデン帯シェア・注視効率・4相配分・戻し率・カメラカバレッジ）<br>
          <b>視線グリッド</b>: 売場×12×6セル×（床上高さ・ゴールデン帯フラグ・視線秒の真値/計測値/直近30分）<br>
          <b>スキャンパス</b>: 在店客×注視順×（停留時間・相・売場・棚面UV・床上高さ・ワールド座標）<br>
          <b>モンテカルロ結果</b>: シナリオ×反復×全KPI（反復実行を1回以上おこなうと有効）
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title" data-ccollapse>反復実行（モンテカルロ）<span class="hint">効果か、乱数のブレか</span><span class="ctgl">▾</span></div>
      <div class="card-body">
        <div class="mde-text" style="margin-bottom:8px">
          単一 seed の1本走行では「設定を変えた効果」と「乱数のブレ」が区別できない。
          seed を振って同じ1日（10:00→22:00）を ${MC.n} 回まわし、KPIの分布として出す。
          実行中は3D描画を止め、終わるとライブの状態をそのまま復元する。
        </div>
        <div class="sp-radio" id="mc-n">
          ${[6, 10, 16].map(n => `<button data-n="${n}" class="${MC.n === n ? 'active' : ''}">${n}反復</button>`).join('')}
        </div>
        <div class="sp-btnrow">
          <button id="mc-run" ${MC.busy ? 'disabled' : ''}>いまの設定で反復実行</button>
          <button id="mc-clear" class="ghost">結果を消去</button>
        </div>
        <div id="mc-progress" class="sd-note" style="margin-top:6px">${MC.busy ? '反復実行中…' : ''}</div>
        ${names.map(nm => {
          const sc = MC.scenarios[nm];
          return `<div class="power-box" style="margin-top:9px">
            <div style="font-weight:700;margin-bottom:2px">${nm}<span style="font-weight:400;color:var(--text-faint)"> ・ ${sc.results.length}反復</span></div>
            <div class="sd-note" style="margin-bottom:5px">${sc.settings}</div>
            ${MC_KEYS.map(mk => {
              const st = mcStats(sc.results.map(r => r[mk.k]));
              const cv = st.mean ? st.sd / Math.abs(st.mean) : 0;
              return `<div class="sp-factor"><span class="fl" style="width:88px">${mk.k}</span>
                <span class="fv" style="width:auto;text-align:left;font-weight:400">
                  <b>${mk.fmt(st.mean)}</b>
                  <span style="color:var(--text-faint)"> ± ${mk.fmt(st.sd)}（seedによる変動 ${fmtPct(cv, 1)}）
                  ／ 範囲 ${mk.fmt(st.lo)}〜${mk.fmt(st.hi)}</span></span></div>`;
            }).join('')}
          </div>`;
        }).join('')}
        ${cmp ? `
          <div class="power-box" style="margin-top:10px;border-color:${COL.s1}">
            <div style="font-weight:700;margin-bottom:4px">シナリオ比較: ${cmp.a} → ${cmp.b}</div>
            <div class="sd-note" style="margin-bottom:6px">
              同じ反復数どうしの差を、2標本のt検定で評価する。
              「seedのブレを超えた差か」がここで決まる。
            </div>
            ${cmp.rows.map(r => `
              <div class="sp-factor"><span class="fl" style="width:88px">${r.k}</span>
                <span class="fv" style="width:auto;text-align:left;font-weight:400">
                  <b style="color:${r.sig ? (r.diff > 0 ? COL.good : COL.bad) : 'var(--text-secondary)'}">${r.diff > 0 ? '+' : ''}${fmtPct(r.rel, 1)}</b>
                  <span style="color:var(--text-faint)"> （${r.fmt(r.diff)} ± ${r.fmt(r.ci)}・t=${r.t.toFixed(2)}）</span>
                  ${r.sig ? confChip('hi') : `<span style="color:var(--text-faint);font-size:10px">乱数のブレの範囲内</span>`}
                </span></div>`).join('')}
          </div>` : (names.length === 1
            ? `<div class="sd-note" style="margin-top:8px">設定を変えてもう一度実行すると、2つのシナリオの差を検定して比較します。</div>` : '')}
      </div>
    </div>`;

  [['ex-shelf', exportShelfSummary], ['ex-grid', exportGazeGrid],
   ['ex-scan', exportScanpaths], ['ex-mc', exportMonteCarlo]].forEach(([id, fn]) => {
    const b2 = document.getElementById(id);
    if (b2) b2.addEventListener('click', fn);
  });
  const nEl = document.getElementById('mc-n');
  if (nEl) nEl.addEventListener('click', e => {
    const b = e.target.closest('button[data-n]');
    if (!b) return;
    MC.n = +b.dataset.n; renderValid();
  });
  const runEl = document.getElementById('mc-run');
  if (runEl) runEl.addEventListener('click', () => {
    let nm = scenarioLabel();
    let i = 2; const base = nm;
    while (MC.scenarios[nm]) nm = base + ' #' + i++;
    document.getElementById('mc-progress').textContent = '反復実行中…';
    mcRun(MC.n, nm);
  });
  const clrEl = document.getElementById('mc-clear');
  if (clrEl) clrEl.addEventListener('click', () => { MC.scenarios = {}; renderValid(); });
}

/* 2つのシナリオの差を2標本t検定で評価 */
function mcCompare(aName, bName) {
  const A = MC.scenarios[aName].results, B = MC.scenarios[bName].results;
  const rows = MC_KEYS.map(mk => {
    const a = mcStats(A.map(r => r[mk.k])), b = mcStats(B.map(r => r[mk.k]));
    const se = Math.sqrt(a.sd ** 2 / A.length + b.sd ** 2 / B.length);
    const diff = b.mean - a.mean;
    const t = se > 1e-9 ? diff / se : 0;
    return {
      k: mk.k, fmt: mk.fmt, diff, ci: 1.96 * se, t,
      rel: a.mean ? diff / Math.abs(a.mean) : 0,
      sig: Math.abs(t) >= 1.96,
    };
  });
  return { a: aName, b: bName, rows };
}

window.renderValid = renderValid;
