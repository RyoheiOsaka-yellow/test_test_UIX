
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
    '<div id="ap-left"><div class="ap-h">ジャーニー' +
    '<button class="ap-new" id="ap-new" data-tip="ジャーニーを新規作成">' + ic('plus', 13) + '</button></div><div id="ap-jlist"></div></div>' +
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
  autoPage.classList.add('lightsurf');
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
            ' ／ コスト ' + usd(B.cost || 0) +
            (J.holdout ? ' ／ 対照 ' + fmt(B.hold || 0) : '') +
            (B.capped ? ' ／ <b style="color:var(--gold)">上限 ' + fmt(J.cap) + '</b>' : '') +
            (J.ab ? ' ／ <b style="color:var(--purple)">A/B</b>' : '') + '</div>' +
          '<button class="ap-edit" data-jedit="' + J.id + '" data-tip="条件・文面・A/Bを編集">' +
            ic('pencil', 12) + '編集</button>' +
        '</div>';
      }).join('');
  }).join('');
  autoPage.querySelectorAll('[data-j]').forEach(d => d.onclick = e => {
    if (e.target.dataset && e.target.dataset.jedit) return;
    const J = JOURNEYS.find(x => x.id === d.dataset.j);
    J.on = !J.on;
    buildAutomation(); autoStep(timeState.min); renderAutoConsole();
  });
  autoPage.querySelectorAll('[data-jedit]').forEach(b => b.onclick = e => {
    e.stopPropagation(); openJB(b.dataset.jedit);
  });
  const nb = document.getElementById('ap-new');
  if (nb) nb.onclick = () => openJB(null);

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
    '<div class="sec-t">フェーズ別 増分売上</div>' +
    vizCanvas({ type: 'hbars', rowH: 22, labW: 76, valW: 88, vFmt: usd,
      rows: phases.filter(p => k.byPhase[p]).map((p, i) =>
        ({ label: PHASE_NAME[p], value: Math.round(k.byPhase[p].rev), color: hex(PHASE_COL[p]),
           sub: '対象 ' + fmt(k.byPhase[p].aud) + ' 人 ／ 増分CV ' +
                fmt(Math.round(k.byPhase[p].inc)) })) }) +
    '<div class="sec-t" style="margin-top:10px">チャネル別 対象人数</div>' +
    vizCanvas({ type: 'donut', h: 156, legendRight: true, vFmt: v => fmt(v) + ' 人',
      slices: Object.keys(byCh).map((c2, i) => ({ label: CHANNELS[c2].name, value: byCh[c2].n,
        color: VIZ.ser[i % 8] })),
      center: { v: fmt(k.aud), l: 'のべ対象' } }, 156) +
    '<div class="sec-t" style="margin-top:10px">増分売上 ランキング</div>' +
    vizCanvas({ type: 'hbars', rowH: 22, labW: 128, valW: 88, vFmt: usd, limit: 9,
      rows: rank.map(r => ({ label: r.j.name.replace(/^[^｜]*｜/, ''),
        value: Math.round(r.B.rev), color: hex(PHASE_COL[TRIG[r.j.trig].ph]),
        sub: r.j.name + ' ／ 対象 ' + fmt(r.B.aud) + ' 人 ／ 対照 ' + fmt(r.B.hold || 0) })) }) +
    '<div class="hint" style="margin-top:10px">全ジャーニーに<b>ホールドアウト（既定10%・配信しない対照群）</b>' +
    'を置いています。効果は<b>対照群との差分（増分）</b>のみ。' +
    'バッチ配信（来場前・帰宅後）は当日タイムラインに乗らないため、' +
    '対象人数と効果に含めた上でストリームには流していません。</div>' +
    '<div class="ibar" style="margin-top:10px">' +
    '<button class="ib wide" id="ap-seat" data-tip="接触本数レイヤーで3D座席に反映">' +
      ic('bowl', 14) + '座席で見る</button>' +
    '<button class="ib wide" id="ap-csv" data-tip="発火時刻・チャネル・文面まで含めて出力">' +
      ic('csv', 14) + '配信ログCSV</button></div>';
  const q = id => document.getElementById(id);
  if (q('ap-seat')) q('ap-seat').onclick = () => {
    closeAuto(); seatMode = 'journey'; setLevel('arena', true);
    setTimeout(() => { repaintSeats(); renderPanel(); }, 400);
  };
  if (q('ap-csv')) q('ap-csv').onclick = autoExportCSV;

  drawAutoChart();
  flushViz();
}

/* --- フェーズ別の配信時間分布（積み上げ面 + 現在時刻カーソル） --- */
function drawAutoChart() {
  const cv = document.getElementById('ap-chart');
  if (!cv) return;
  const BINS = 54, step = (T1 - T0) / BINS;
  const bin = {};
  for (const e of AUTO.sched) {
    const b = Math.floor((e.t - T0) / step);
    if (b < 0 || b >= BINS) continue;
    const J = JOURNEYS.find(x => x.id === e.j);
    if (!J) continue;
    const ph = TRIG[J.trig].ph;
    (bin[ph] = bin[ph] || new Array(BINS).fill(0))[b]++;
  }
  const order = ['arrive', 'in', 'exit'].filter(p => bin[p]);
  const x = [];
  for (let i = 0; i < BINS; i++) x.push(clockStr(T0 + i * step));
  cv.__spec = { type: 'bars', stacked: true, h: 132, padL: 44, xTicks: 7, x,
    tipFmt: v => fmt(v) + ' 件',
    series: order.map(p => ({ name: PHASE_NAME[p], data: bin[p], color: hex(PHASE_COL[p]) })) };
  vizBars(cv, cv.__spec);
  /* 現在時刻カーソル */
  const c = cv.getContext('2d');
  const dpr = Math.min(devicePixelRatio, 2);
  const W = cv.width / dpr, H = cv.height / dpr;
  const P = { l: 44, r: 10, t: 10, b: 36 };
  const u = clamp((timeState.min - T0) / (T1 - T0), 0, 1);
  const cx = P.l + (W - P.l - P.r) * u;
  c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(cx, P.t - 4); c.lineTo(cx, H - P.b); c.stroke();
  c.fillStyle = '#e9edf6'; c.font = '600 9.5px Oswald, sans-serif'; c.textAlign = 'center';
  c.fillText(clockStr(timeState.min), cx, P.t - 6);
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
