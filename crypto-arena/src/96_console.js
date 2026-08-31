
/* ================================================================
   オートメーション・コンソール（別ページ）
   稼働中のジャーニー / リアルタイム配信ストリーム / フェーズ別の
   時間分布 / 効果サマリ を1画面に置き、タイムライン再生に同期させる。
================================================================ */
const autoPage = document.createElement('div');
autoPage.id = 'autopage';
autoPage.innerHTML =
  '<div id="ap-kpi"></div>' +
  '<div id="ap-grid">' +
    '<div id="ap-left"><div class="ap-h">ジャーニー</div><div id="ap-jlist"></div></div>' +
    '<div id="ap-mid">' +
      '<div class="ap-h">リアルタイム配信ストリーム <span id="ap-clock"></span></div>' +
      '<canvas id="ap-chart" height="130"></canvas>' +
      '<div id="ap-stream"></div>' +
    '</div>' +
    '<div id="ap-right"><div class="ap-h">効果サマリ</div><div id="ap-sum"></div></div>' +
  '</div>';
document.body.appendChild(autoPage);

function openAuto() {
  if (!AUTO.built) buildAutomation();
  AUTO.page = true;
  autoPage.style.display = 'flex';
  document.getElementById('panel').style.display = 'none';
  autoStep(timeState.min);
  renderAutoConsole();
}
function closeAuto() {
  AUTO.page = false;
  autoPage.style.display = 'none';
  document.getElementById('panel').style.display = 'flex';
}

function renderAutoConsole() {
  if (!AUTO.page) return;
  computeAutoKpi();
  const k = AUTO.kpi;

  document.getElementById('ap-kpi').innerHTML =
    '<div class="ap-title">⚡ MARKETING AUTOMATION' +
    '<small>トリガー × セグメント × アクションを、試合当日のタイムラインに同期して実行</small></div>' +
    [[fmt(k.active) + '<small> / ' + JOURNEYS.length + '</small>', '稼働ジャーニー', ''],
     [fmt(k.aud), 'のべ対象人数', 'k'],
     [fmt(Object.values(AUTO.byJ).reduce((a, b) => a + b.sent, 0)), '本日 配信済み', ''],
     [fmt(Math.round(k.cv)), '増分CV', 'g'],
     [usd(k.rev), '増分売上', 'g'],
     [k.roas.toFixed(1) + '<small>×</small>', '増分ROAS', 'p']]
      .map(x => '<div class="kpi"><div class="v ' + x[2] + '">' + x[0] + '</div>' +
                '<div class="l">' + x[1] + '</div></div>').join('') +
    '<button class="close-x" id="ap-x" style="margin-left:auto">✕</button>';
  document.getElementById('ap-x').onclick = closeAuto;

  /* --- ジャーニー一覧（フェーズ別） --- */
  const phases = ['pre', 'arrive', 'in', 'exit', 'post'];
  document.getElementById('ap-jlist').innerHTML = phases.map(p => {
    const list = JOURNEYS.filter(j => TRIG[j.trig].ph === p);
    if (!list.length) return '';
    return '<div class="ap-ph" style="border-color:' + hex(PHASE_COL[p]) + '">' +
      '<span style="color:' + hex(PHASE_COL[p]) + '">' + PHASE_NAME[p] + '</span></div>' +
      list.map(J => {
        const B = AUTO.byJ[J.id] || { aud: 0, sent: 0, rev: 0 };
        const live = B.sent > 0 && B.sent < B.aud;
        return '<div class="ap-j' + (J.on ? '' : ' off') + '" data-j="' + J.id + '">' +
          '<div class="ap-j-t">' + TRIG[J.trig].icon + ' ' + J.name +
            '<span class="ap-sw" style="background:' + (J.on ? hex(PHASE_COL[p]) : '#39445c') + '"></span></div>' +
          '<div class="ap-j-m">' + TRIG[J.trig].n + ' → ' + CHANNELS[J.ch].name +
            ' ／ 対象 <b>' + fmt(B.aud) + '</b>' +
            (B.sent ? ' ／ 配信 <b style="color:var(--acc)">' + fmt(B.sent) + '</b>' : '') +
            (live ? ' <span class="ap-live">LIVE</span>' : '') + '</div>' +
          '<div class="ap-j-w">' + J.why + '</div>' +
          '<div class="ap-j-m">増分 <b style="color:var(--gold)">' + usd(B.rev || 0) + '</b>' +
            ' ／ コスト ' + usd(B.cost || 0) + '</div>' +
        '</div>';
      }).join('');
  }).join('');
  autoPage.querySelectorAll('[data-j]').forEach(d => d.onclick = () => {
    const J = JOURNEYS.find(x => x.id === d.dataset.j);
    J.on = !J.on;
    buildAutomation(); autoStep(timeState.min); renderAutoConsole();
  });

  /* --- ストリーム --- */
  document.getElementById('ap-clock').textContent =
    clockStr(timeState.min) + '　' + phaseAt(timeState.min);
  const st = document.getElementById('ap-stream');
  st.innerHTML = AUTO.log.length ? AUTO.log.map(e =>
    '<div class="ap-ev" style="border-left-color:' + hex(PHASE_COL[TRIG[e.j.trig].ph]) + '">' +
    '<div class="ap-ev-h"><b>' + clockStr(e.t) + '</b> ' + TRIG[e.j.trig].icon + ' ' +
      TRIG[e.j.trig].n + '<span class="ap-ev-ch">' + CHANNELS[e.j.ch].name + '</span></div>' +
    '<div class="ap-ev-b">' + e.fid + ' ／ Sec ' + e.sec + ' Row ' + e.row + ' Seat ' + e.num +
      ' ／ <span style="color:' + hex(SEGMENTS[e.seg].color) + '">' + SEGMENTS[e.seg].name + '</span></div>' +
    '<div class="ap-ev-m">「' + e.msg + '」</div></div>').join('')
    : '<div class="ap-empty">▶ タイムラインを再生すると、条件に合致した個客へ' +
      '実際に配信が飛びます。<br>17:00 ゲート開場から発火が始まります。</div>';
  st.querySelectorAll('.ap-ev').forEach((d, n) => {
    d.onclick = () => {
      const e = AUTO.log[n];
      closeAuto(); setLevel('arena', true);
      setTimeout(() => showFanCard(e.i), 500);
    };
  });

  /* --- 右: サマリ --- */
  const byCh = {};
  for (const J of JOURNEYS) {
    if (!J.on) continue;
    const B = AUTO.byJ[J.id];
    const e = byCh[J.ch] || (byCh[J.ch] = { n: 0, rev: 0 });
    e.n += B.aud; e.rev += B.rev;
  }
  const rank = JOURNEYS.filter(j => j.on).map(j => ({ j, B: AUTO.byJ[j.id] }))
    .sort((a, b) => b.B.rev - a.B.rev);
  document.getElementById('ap-sum').innerHTML =
    '<div class="sec-t">フェーズ別 増分売上（USD）</div>' +
    phases.map(p => {
      const e = k.byPhase[p]; if (!e) return '';
      return '<div class="bar-row"><span>' + PHASE_NAME[p] + '</span>' +
        '<div class="bar"><i style="width:' + (e.rev / Math.max(1, k.rev) * 100).toFixed(1) +
        '%;background:' + hex(PHASE_COL[p]) + '"></i></div><b>' + usd(e.rev) + '</b></div>';
    }).join('') +
    '<div class="sec-t" style="margin-top:10px">チャネル別 対象人数</div>' +
    Object.keys(byCh).map(c => bar(CHANNELS[c].name, byCh[c].n, k.aud || 1, '#00c2ff')).join('') +
    '<div class="sec-t" style="margin-top:10px">増分売上 ランキング</div>' +
    rank.slice(0, 8).map(r => '<div class="bar-row"><span title="' + r.j.name + '">' +
      r.j.name.replace(/^[^｜]*｜/, '') + '</span><div class="bar"><i style="width:' +
      (r.B.rev / Math.max(1, rank[0].B.rev) * 100).toFixed(1) + '%;background:' +
      hex(PHASE_COL[TRIG[r.j.trig].ph]) + '"></i></div><b>' + usd(r.B.rev) + '</b></div>').join('') +
    '<div class="hint" style="margin-top:10px">効果は<b>コントロール群との差分（増分）</b>のみ。' +
    'バッチ配信（来場前・帰宅後）は当日タイムラインに乗らないため、' +
    '対象人数と効果に含めた上でストリームには流していません。</div>' +
    '<div class="row-btns" style="margin-top:10px">' +
    '<button class="tool-btn" id="ap-seat" style="width:auto;padding:7px 12px">💺 座席で見る（接触本数）</button>' +
    '<button class="tool-btn" id="ap-csv" style="width:auto;padding:7px 12px">📤 配信ログCSV</button></div>';
  const q = id => document.getElementById(id);
  if (q('ap-seat')) q('ap-seat').onclick = () => {
    closeAuto(); seatMode = 'journey'; setLevel('arena', true);
    setTimeout(() => { repaintSeats(); renderPanel(); }, 400);
  };
  if (q('ap-csv')) q('ap-csv').onclick = autoExportCSV;

  drawAutoChart();
}

/* --- フェーズ別の配信時間分布 --- */
function drawAutoChart() {
  const cv = document.getElementById('ap-chart');
  if (!cv) return;
  const dpr = devicePixelRatio;
  cv.width = cv.clientWidth * dpr; cv.height = 130 * dpr;
  const c = cv.getContext('2d'), W = cv.width, H = cv.height;
  c.clearRect(0, 0, W, H);
  const BINS = 108, bin = {};                       // 15:00-24:00 を5分刻み
  for (const e of AUTO.sched) {
    const b = Math.floor((e.t - T0) / 5);
    if (b < 0 || b >= BINS) continue;
    const p = TRIG[JOURNEYS.find(x => x.id === e.j).trig].ph;
    (bin[p] = bin[p] || new Float64Array(BINS))[b]++;
  }
  let mx = 1;
  const tot = new Float64Array(BINS);
  for (const p in bin) for (let i = 0; i < BINS; i++) { tot[i] += bin[p][i]; if (tot[i] > mx) mx = tot[i]; }
  const bw = W / BINS;
  const order = ['pre', 'arrive', 'in', 'exit', 'post'];
  const stack = new Float64Array(BINS);
  for (const p of order) {
    if (!bin[p]) continue;
    c.fillStyle = hex(PHASE_COL[p]);
    for (let i = 0; i < BINS; i++) {
      const h = bin[p][i] / mx * (H - 22 * dpr);
      c.fillRect(i * bw, H - 16 * dpr - stack[i] - h, Math.max(1, bw - 1), h);
      stack[i] += h;
    }
  }
  /* 現在時刻のカーソル */
  const cx = (timeState.min - T0) / (T1 - T0) * W;
  c.strokeStyle = '#ffffff'; c.lineWidth = 1.5 * dpr;
  c.beginPath(); c.moveTo(cx, 0); c.lineTo(cx, H - 16 * dpr); c.stroke();
  c.fillStyle = '#8590a8'; c.font = (9 * dpr) + 'px sans-serif'; c.textAlign = 'center';
  for (let h = 15; h <= 24; h += 1) {
    const x = (h * 60 - T0) / (T1 - T0) * W;
    c.fillText(h + ':00', x, H - 3 * dpr);
  }
}

/* --- 配信ログの書き出し --- */
function autoExportCSV() {
  const rows = ['fire_time,journey_id,journey,trigger,phase,channel,offer,fan_id,' +
                'section,row,seat,segment,region,ltv_usd,renew_prob,message'];
  for (const e of AUTO.sched) {
    const J = JOURNEYS.find(x => x.id === e.j);
    if (!J || !J.on) continue;
    const s = SEAT.list[e.i], f = fanAt(e.i);
    let msg = ''; try { msg = typeof J.msg === 'function' ? J.msg(f, s) : String(J.msg); } catch (x) { }
    rows.push([clockStr(e.t), J.id, '"' + J.name + '"', TRIG[J.trig].n, PHASE_NAME[TRIG[J.trig].ph],
      J.ch, J.offer, f.fid, s.sec, s.row + 1, s.num, f.seg, '"' + f.reg.n + '"',
      f.ltv, (1 - f.churn).toFixed(3), '"' + msg.replace(/"/g, '""') + '"'].join(','));
  }
  const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'automation_log_' + curGame + '_' + (rows.length - 1) + 'rows.csv';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('配信ログを書き出しました — <b>' + fmt(rows.length - 1) + ' 行</b>', 4000);
}
