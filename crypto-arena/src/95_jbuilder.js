
/* ================================================================
   ジャーニー ビルダー（編集可能 / A・Bテスト / ホールドアウト）
   ハードコードされたシナリオを、条件・チャネル・オファー・文面まで
   画面から作り替えられるようにする。
   効果は「ホールドアウト（配信しない対照群）に対する差」を実測し、
   二標本の比率差検定で有意かどうかまで出す。
================================================================ */
const JB = { open: false, edit: null, draft: null };

function blankJourney() {
  return { id: 'J-' + (Date.now() % 100000), on: true, trig: 'GATE_SCAN',
    ch: 'PUSH', offer: 'FB_OFFER', name: '新しいジャーニー',
    why: '', text: '{sec} から徒歩40秒の売店で使えるクーポンです',
    f: { seg: [], reg: [], mode: [], tier: [], ltvMin: 0, churnMax: 1, gamesMin: 0,
         optin: false, app: false },
    holdout: 0.10, ab: false, chB: 'EMAIL', offerB: 'MERCH', abShare: 0.5, custom: true };
}
/* 条件オブジェクト → 判定 */
function filterMatch(F, f, s) {
  if (F.seg.length && F.seg.indexOf(f.seg) < 0) return false;
  if (F.reg.length && F.reg.indexOf(f.reg.n) < 0) return false;
  if (F.mode.length && F.mode.indexOf(f.org.mode) < 0) return false;
  if (F.tier.length && F.tier.indexOf(s.tier) < 0) return false;
  if (f.ltv < F.ltvMin) return false;
  if ((1 - f.churn) > F.churnMax) return false;
  if (f.gamesLtm < F.gamesMin) return false;
  if (F.optin && !f.optin) return false;
  if (F.app && !f.app) return false;
  return true;
}
/* 文面テンプレートの差し込み */
function renderText(tpl, f, s) {
  return String(tpl)
    .replace(/\{sec\}/g, 'Sec ' + s.sec)
    .replace(/\{row\}/g, String(s.row + 1))
    .replace(/\{seat\}/g, String(s.num))
    .replace(/\{gate\}/g, f.gate)
    .replace(/\{tenure\}/g, String(f.tenure))
    .replace(/\{games\}/g, String(f.gamesLtm))
    .replace(/\{ltv\}/g, usd(f.ltv))
    .replace(/\{name\}/g, f.fid);
}

/* 何も配信しなくても自然に起きる割合（対 施策時反応率）。
   ホールドアウトの期待値はここから出す。 */
const ORGANIC_RATIO = 0.45;

/* ---- 正規分布と二標本比率差の検定 ---- */
function erf(x) {
  const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t
    + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
const normCdf = z => 0.5 * (1 + erf(z / Math.SQRT2));
function propTest(cv1, n1, cv0, n0) {
  if (n1 < 2 || n0 < 2) return { z: 0, p: 1, ok: false };
  const p1 = cv1 / n1, p0 = cv0 / n0;
  const pp = (cv1 + cv0) / (n1 + n0);
  const se = Math.sqrt(pp * (1 - pp) * (1 / n1 + 1 / n0));
  if (!se) return { z: 0, p: 1, ok: false };
  const z = (p1 - p0) / se;
  const p = 2 * (1 - normCdf(Math.abs(z)));
  return { z, p, ok: p < 0.05, p1, p0, lift: p0 > 0 ? p1 / p0 - 1 : 0 };
}

/* ================= UI ================= */
const jbModal = document.createElement('div');
jbModal.id = 'jb';
jbModal.innerHTML = '<div id="jb-box"><div id="jb-hd"><div class="t">✎ ジャーニー ビルダー</div>' +
  '<button class="close-x" id="jb-x">✕</button></div><div id="jb-body"></div></div>';
document.body.appendChild(jbModal);
document.getElementById('jb-x').onclick = () => closeJB();

function openJB(id) {
  const src = id ? JOURNEYS.find(j => j.id === id) : null;
  JB.edit = id || null;
  /* 既定シナリオには holdout / ab / abShare などのフィールドが無いものがあるので、
     雛形を土台に敷いてから上書きする（欠落したまま描画すると undefined.toFixed で落ちる）。 */
  const base = blankJourney();
  JB.draft = src
    ? Object.assign(base, JSON.parse(JSON.stringify(
        Object.assign({}, src, { cond: undefined, msg: undefined, f: src.f || base.f }))))
    : base;
  if (src && !src.f) {                      // 既定シナリオは条件式を持つので、雛形条件で開く
    JB.draft.f = blankJourney().f;
    JB.draft.locked = true;
  }
  if (src) JB.draft.text = src.text || (typeof src.msg === 'function' ? '' : String(src.msg || ''));
  JB.open = true;
  jbModal.style.display = 'flex';
  renderJB();
}
function closeJB() { JB.open = false; jbModal.style.display = 'none'; }

/* 対象人数のライブ計算 */
function jbAudience(D) {
  let n = 0;
  for (let i = 0; i < SEAT.list.length; i++) {
    if (!SNAP.sold[i]) continue;
    const s = SEAT.list[i], f = fanAt(i);
    if (filterMatch(D.f, f, s)) n++;
  }
  return n;
}
const jbChips = (key, list, sel) => '<div class="row-btns" data-jbm="' + key + '">' +
  list.map(x => '<button class="chip sm' + (sel.indexOf(x[0]) >= 0 ? ' active' : '') +
    '" data-v="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>';

function renderJB() {
  const D = JB.draft;
  const aud = D.locked ? (AUTO.byJ[JB.edit] ? AUTO.byJ[JB.edit].aud : 0) : jbAudience(D);
  const hold = Math.round(aud * D.holdout);
  const send = aud - hold;
  const bN = D.ab ? Math.round(send * D.abShare) : 0;
  const rng = (id, min, max, step, val, label) =>
    '<div class="sec-t" style="margin-top:8px">' + label + ' <b style="color:var(--acc)">' +
    val + '</b></div><input type="range" id="' + id + '" min="' + min + '" max="' + max +
    '" step="' + step + '" value="' + val + '" style="width:100%;accent-color:var(--acc)">';

  document.getElementById('jb-body').innerHTML =
    '<div class="bcard"><h4>① トリガーとアクション</h4>' +
    '<div class="sec-t">ジャーニー名</div>' +
    '<input id="jb-name" value="' + D.name.replace(/"/g, '&quot;') + '" class="jb-in">' +
    '<div class="sec-t" style="margin-top:8px">トリガー</div>' +
    '<div class="row-btns" data-jbs="trig">' + Object.keys(TRIG).map(t =>
      '<button class="chip sm' + (D.trig === t ? ' active' : '') + '" data-v="' + t + '">' +
      TRIG[t].icon + ' ' + TRIG[t].n + '</button>').join('') + '</div>' +
    '<div class="sec-t" style="margin-top:8px">チャネル</div>' +
    '<div class="row-btns" data-jbs="ch">' + Object.keys(CHANNELS).map(c =>
      '<button class="chip sm' + (D.ch === c ? ' active' : '') + '" data-v="' + c + '">' +
      CHANNELS[c].name + '</button>').join('') + '</div>' +
    '<div class="sec-t" style="margin-top:8px">オファー</div>' +
    '<div class="row-btns" data-jbs="offer">' + NBA_ACTIONS.map(a =>
      '<button class="chip sm' + (D.offer === a.id ? ' active' : '') + '" data-v="' + a.id + '">' +
      a.t + '</button>').join('') + '</div>' +
    '<div class="sec-t" style="margin-top:8px">配信文面</div>' +
    '<textarea id="jb-text" class="jb-in" rows="3">' + (D.text || '') + '</textarea>' +
    '<div class="hint" style="margin-top:6px">差し込み: <b>{sec}</b> 区画 / <b>{row}</b> 列 / ' +
    '<b>{seat}</b> 席番 / <b>{gate}</b> ゲート / <b>{tenure}</b> 継続年数 / ' +
    '<b>{games}</b> 来場回数 / <b>{ltv}</b> LTV</div></div>' +

    '<div class="bcard"><h4>② オーディエンス' +
      (D.locked ? '（既定シナリオは条件式で定義されています）' : '') + '</h4>' +
    (D.locked ? '<div class="hint">このジャーニーの条件はコード側の判定式です。' +
      '条件を変えたい場合は「複製して編集」で新規ジャーニーとして作り直してください。</div>' :
      '<div class="sec-t">セグメント</div>' +
      jbChips('seg', Object.keys(SEGMENTS).map(x => [x, SEGMENTS[x].name]), D.f.seg) +
      '<div class="sec-t" style="margin-top:8px">商圏</div>' +
      jbChips('reg', REGIONS.map(r => [r.n, r.n]), D.f.reg) +
      '<div class="sec-t" style="margin-top:8px">交通手段</div>' +
      jbChips('mode', [['CAR', '車'], ['METRO', 'Metro'], ['RIDESHARE', 'ライドシェア'],
                       ['WALK', '徒歩']], D.f.mode) +
      '<div class="sec-t" style="margin-top:8px">席ティア</div>' +
      jbChips('tier', [['FLOOR', 'フロア'], ['L100', '100L'], ['PRM', 'Premier'],
                       ['SUITE', 'Box'], ['L300', '300L']], D.f.tier) +
      rng('jb-ltv', 0, 120000, 2000, D.f.ltvMin, 'LTV 下限 $') +
      rng('jb-renew', 0, 1, 0.05, D.f.churnMax.toFixed(2), '更新見込 上限') +
      rng('jb-games', 0, 41, 1, D.f.gamesMin, '来場回数 下限') +
      '<div style="margin-top:8px">' +
      '<label class="ck-row"><input type="checkbox" id="jb-optin"' + (D.f.optin ? ' checked' : '') +
      '>メール配信可</label><label class="ck-row"><input type="checkbox" id="jb-app"' +
      (D.f.app ? ' checked' : '') + '>アプリ保有</label></div>') +
    '<div class="kpi-grid" style="margin-top:10px">' +
      '<div class="kpi"><div class="v">' + fmt(aud) + '</div><div class="l">対象人数</div></div>' +
      '<div class="kpi"><div class="v k">' + fmt(send) + '</div><div class="l">配信</div></div>' +
      '<div class="kpi"><div class="v p">' + fmt(hold) + '</div><div class="l">ホールドアウト</div></div>' +
      '<div class="kpi"><div class="v g">' + fmt(bN) + '</div><div class="l">B案</div></div>' +
    '</div></div>' +

    '<div class="bcard wide"><h4>③ 実験設計（ホールドアウト / A・Bテスト）</h4>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">' +
    '<div>' + rng('jb-hold', 0, 0.3, 0.01, D.holdout.toFixed(2), 'ホールドアウト率（配信しない対照群）') +
    '<div class="hint" style="margin-top:7px">対照群には<b>一切配信しません</b>。' +
    '何もしなくても自然に起きる分（施策時の ' + (ORGANIC_RATIO * 100).toFixed(0) +
    '% 相当）と比べることで、「配信したから起きた分」だけを測れます。' +
    '0にすると効果測定ができません。</div>' +
    '<label class="ck-row" style="margin-top:10px"><input type="checkbox" id="jb-ab"' +
    (D.ab ? ' checked' : '') + '>A/Bテストを行う</label>' +
    (D.ab ? '<div class="sec-t" style="margin-top:6px">B案 チャネル</div>' +
      '<div class="row-btns" data-jbs="chB">' + Object.keys(CHANNELS).map(c =>
        '<button class="chip sm' + (D.chB === c ? ' active' : '') + '" data-v="' + c + '">' +
        CHANNELS[c].name + '</button>').join('') + '</div>' +
      '<div class="sec-t" style="margin-top:6px">B案 オファー</div>' +
      '<div class="row-btns" data-jbs="offerB">' + NBA_ACTIONS.map(a =>
        '<button class="chip sm' + (D.offerB === a.id ? ' active' : '') + '" data-v="' + a.id + '">' +
        a.t + '</button>').join('') + '</div>' +
      rng('jb-abshare', 0.1, 0.9, 0.05, D.abShare.toFixed(2), 'B案への配分') : '') +
    '</div>' +
    '<div id="jb-result"></div></div>' +
    '<div class="row-btns" style="margin-top:12px">' +
    '<button class="tool-btn" id="jb-save" style="width:auto;padding:8px 16px">💾 保存して実行</button>' +
    (JB.edit ? '<button class="tool-btn" id="jb-dup" style="width:auto;padding:8px 16px">⧉ 複製して編集</button>' +
      (JOURNEYS.find(j => j.id === JB.edit) && JOURNEYS.find(j => j.id === JB.edit).custom ?
        '<button class="tool-btn" id="jb-del" style="width:auto;padding:8px 16px;border-color:var(--warn);color:var(--warn)">🗑 削除</button>' : '')
      : '') +
    '<button class="tool-btn" id="jb-cancel" style="width:auto;padding:8px 16px">キャンセル</button>' +
    '</div></div>';

  renderJBResult(aud, send, hold, bN);

  /* --- バインド --- */
  const body = document.getElementById('jb-body');
  body.querySelectorAll('[data-jbs]').forEach(g => g.querySelectorAll('[data-v]').forEach(b =>
    b.onclick = () => { D[g.dataset.jbs] = b.dataset.v; renderJB(); }));
  body.querySelectorAll('[data-jbm]').forEach(g => {
    const key = g.dataset.jbm;
    g.querySelectorAll('[data-v]').forEach(b => b.onclick = () => {
      const arr = D.f[key], v = b.dataset.v, k = arr.indexOf(v);
      if (k >= 0) arr.splice(k, 1); else arr.push(v);
      renderJB();
    });
  });
  const on = (id, fn) => { const e = document.getElementById(id); if (e) e.oninput = fn; };
  on('jb-ltv', e => { D.f.ltvMin = +e.target.value; renderJB(); });
  on('jb-renew', e => { D.f.churnMax = +e.target.value; renderJB(); });
  on('jb-games', e => { D.f.gamesMin = +e.target.value; renderJB(); });
  on('jb-hold', e => { D.holdout = +e.target.value; renderJB(); });
  on('jb-abshare', e => { D.abShare = +e.target.value; renderJB(); });
  on('jb-name', e => { D.name = e.target.value; });
  on('jb-text', e => { D.text = e.target.value; });
  const ck = (id, fn) => { const e = document.getElementById(id); if (e) e.onchange = () => fn(e.checked); };
  ck('jb-optin', v => { D.f.optin = v; renderJB(); });
  ck('jb-app', v => { D.f.app = v; renderJB(); });
  ck('jb-ab', v => { D.ab = v; renderJB(); });
  const btn = (id, fn) => { const e = document.getElementById(id); if (e) e.onclick = fn; };
  btn('jb-cancel', closeJB);
  btn('jb-dup', () => { JB.edit = null; D.locked = false; D.custom = true;
    D.id = 'J-' + (Date.now() % 100000); D.name = D.name + '（複製）'; renderJB(); });
  btn('jb-del', () => {
    const k = JOURNEYS.findIndex(j => j.id === JB.edit);
    if (k >= 0) JOURNEYS.splice(k, 1);
    closeJB(); buildAutomation(); renderAutoConsole();
  });
  btn('jb-save', () => {
    const J = Object.assign({}, D);
    delete J.locked;
    if (!J.locked && !D.locked) {
      J.cond = null;                       // 条件は f から評価する
      J.msg = (f, s) => renderText(J.text, f, s);
    }
    const k = JOURNEYS.findIndex(x => x.id === JB.edit);
    if (k >= 0) {
      /* 既定シナリオを編集した場合は判定式・文面を保持する */
      const old = JOURNEYS[k];
      JOURNEYS[k] = Object.assign({}, old, J,
        D.locked ? { cond: old.cond, msg: old.msg, f: undefined } : {});
    } else JOURNEYS.push(J);
    closeJB(); buildAutomation(); renderAutoConsole();
    toast('ジャーニー「<b>' + J.name + '</b>」を保存しました', 3000);
  });
}

/* --- 実験結果（ホールドアウトとの比較・有意性） --- */
function renderJBResult(aud, send, hold, bN) {
  const D = JB.draft;
  const el2 = document.getElementById('jb-result');
  if (!el2) return;
  const R = simulateExperiment(D, aud);
  const t = propTest(R.cvA, R.nA, R.cvH, R.nH);
  const tb = propTest(R.cvB, R.nB, R.cvH, R.nH);
  const row = (nm, n, cv, tt, col) => '<tr><td>' + nm + '</td><td class="n">' + fmt(n) +
    '</td><td class="n">' + fmt(cv) + '</td><td class="n">' + (n ? (cv / n * 100).toFixed(2) : '—') +
    '%</td><td class="n" style="color:' + col + '">' +
    (tt ? (tt.lift > 0 ? '+' : '') + (tt.lift * 100).toFixed(1) + '%' : '—') + '</td></tr>';
  el2.innerHTML =
    '<div class="sec-t">ホールドアウト比較 — 対照群は<b>一切配信しない</b></div>' +
    '<table class="dt"><tr><th>群</th><th>人数</th><th>CV</th><th>反応率</th><th>ホールドアウト比</th></tr>' +
    row('ホールドアウト', R.nH, R.cvH, null, 'var(--sub)') +
    row('A案', R.nA, R.cvA, t, t.ok ? 'var(--ok)' : 'var(--sub)') +
    (D.ab ? row('B案', R.nB, R.cvB, tb, tb.ok ? 'var(--ok)' : 'var(--sub)') : '') +
    '</table>' +
    '<div class="hint" style="margin-top:9px;border-left-color:' +
      (t.ok ? 'var(--ok)' : 'var(--warn)') + '">' +
    '<b style="color:' + (t.ok ? 'var(--ok)' : 'var(--warn)') + '">' +
    (t.ok ? '✔ 有意差あり' : '△ 有意差なし') + '</b>　A案 vs ホールドアウト: ' +
    'z = ' + t.z.toFixed(2) + ' / p = ' + (t.p < 0.001 ? '<0.001' : t.p.toFixed(3)) + '<br>' +
    (t.ok ? '効果は偶然では説明できない水準です。この設計のまま配信できます。'
      : (R.nH < 200 ? 'ホールドアウトが小さすぎます。対象人数を増やすか、ホールドアウト率を上げてください。'
        : '差が小さいか母数が不足しています。オファーを強めるか、対象をLTV上位に絞ってください。')) +
    '</div>' +
    (D.ab ? '<div class="hint" style="margin-top:7px">B案 vs ホールドアウト: z = ' + tb.z.toFixed(2) +
      ' / p = ' + (tb.p < 0.001 ? '<0.001' : tb.p.toFixed(3)) + '。' +
      (R.cvA / Math.max(1, R.nA) > R.cvB / Math.max(1, R.nB) ? '現時点では <b>A案</b>' : '現時点では <b>B案</b>') +
      ' が優勢です。</div>' : '');
}

/* 個客ごとに群を割り当て、反応を決定的にロールする（同じ設計なら毎回同じ結果） */
function simulateExperiment(D, audCount) {
  const salt = 0x9e3d + (D.id ? D.id.length * 31 : 0);
  let nH = 0, nA = 0, nB = 0, cvH = 0, cvA = 0, cvB = 0;
  const actA = NBA_ACTIONS.find(a => a.id === D.offer) || NBA_ACTIONS[0];
  const actB = NBA_ACTIONS.find(a => a.id === D.offerB) || actA;
  const CA = CHANNELS[D.ch], CB = CHANNELS[D.chB] || CA;
  const base = OFFER_RESP[D.offer] || 0.08, baseB = OFFER_RESP[D.offerB] || base;
  /* ホールドアウトは「一切接触しない」群なので、放っておいても起きる自然発生分だけ。
     接触群はチャネル係数 × NBA最適化の上振れ × 到達率が乗る。 */
  const rH = clamp(base * ORGANIC_RATIO, 0, 0.85);
  const rA = clamp(base * CA.mult * (1 + actA.up) * CA.deliver, 0, 0.9);
  const rB = clamp(baseB * CB.mult * (1 + actB.up) * CB.deliver, 0, 0.9);
  const locked = D.locked && JB.edit;
  const J = locked ? JOURNEYS.find(x => x.id === JB.edit) : null;
  for (let i = 0; i < SEAT.list.length; i++) {
    if (!SNAP.sold[i]) continue;
    const s = SEAT.list[i], f = fanAt(i);
    let ok;
    if (locked && J && J.cond) { try { ok = J.cond(Object.assign({ tier: s.tier }, f), s); } catch (e) { ok = false; } }
    else ok = filterMatch(D.f, f, s);
    if (!ok) continue;
    const u = hrand(i, salt), v = hrand(i, salt + 7);
    if (u < D.holdout) { nH++; if (v < rH) cvH++; }
    else if (D.ab && u < D.holdout + (1 - D.holdout) * D.abShare) { nB++; if (v < rB) cvB++; }
    else { nA++; if (v < rA) cvA++; }
  }
  return { nH, nA, nB, cvH, cvA, cvB };
}
