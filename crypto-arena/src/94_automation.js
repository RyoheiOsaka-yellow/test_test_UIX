
/* ================================================================
   マーケティング・オートメーション エンジン
   トリガー（来場前 / 接近 / 入場 / 着席 / 場内 / 退場 / 帰宅後）×
   オーディエンス条件 × アクション（チャネル + オファー）を
   ジャーニーとして定義し、タイムライン再生に同期して実際に発火させる。
   発火は座席単位まで降りるので、3Dの該当席が光る。
================================================================ */
const TRIG = {
  PRE_7D:      { n: '7日前',          ph: 'pre',    icon: '📧' },
  PRE_1D:      { n: '前日',           ph: 'pre',    icon: '📧' },
  GEOFENCE:    { n: '500m圏 接近',    ph: 'arrive', icon: '📍' },
  GATE_SCAN:   { n: 'ゲート入場',      ph: 'arrive', icon: '🎫' },
  SEATED:      { n: '着席',           ph: 'arrive', icon: '💺' },
  HALFTIME:    { n: 'ハーフタイム',    ph: 'in',     icon: '⏸' },
  NO_PURCHASE: { n: 'Q3 未購買',      ph: 'in',     icon: '🛒' },
  GAME_END:    { n: '試合終了',        ph: 'exit',   icon: '🏁' },
  EXIT_GATE:   { n: '退場ゲート通過',   ph: 'exit',   icon: '🚪' },
  LEFT_500M:   { n: '500m圏 離脱',    ph: 'exit',   icon: '🚶' },
  NEXT_DAY:    { n: '翌朝',           ph: 'post',   icon: '☀' },
};
const PHASE_NAME = { pre: '来場前', arrive: '来場時', in: '場内', exit: '退場時', post: '帰宅後' };
const PHASE_COL  = { pre: 0x8a5cc4, arrive: 0x00c2ff, in: 0x3ddc84, exit: 0xff8a3d, post: 0xfdb927 };

/* --- ジャーニー定義 --- */
const JOURNEYS = [
  { id: 'PRE-1', on: true, trig: 'PRE_7D', ch: 'EMAIL', offer: 'CONVERT',
    name: '来場前｜単券購入者を部分シーズン券へ',
    cond: f => f.seg === 'SINGLE' && f.gamesLtm >= 3 && f.optin,
    msg: f => '今季すでに' + f.gamesLtm + '試合ご観戦。6試合パックなら1試合あたり ' +
              usd(Math.round(f.paid * 0.78)) + ' になります',
    why: '来場実績のある単券客を、来場前の落ち着いたタイミングでシーズン化に寄せる' },

  { id: 'PRE-2', on: true, trig: 'PRE_1D', ch: 'PUSH', offer: 'FB_OFFER',
    name: '来場前｜前日リマインド + 事前注文',
    cond: f => f.app,
    msg: f => '明日 19:30 TIP-OFF。' + f.gate + 'が最短です。' +
              'アプリで事前注文すると売店の列を通過できます',
    why: '来場体験の設計。事前注文は場内購買を平均 +38% 押し上げる' },

  { id: 'ARV-1', on: true, trig: 'GEOFENCE', ch: 'PUSH', offer: 'TOUR_BUNDLE',
    name: '来場時｜州外・観光客を開場前の回遊へ',
    cond: f => f.localStay && f.app,
    msg: f => 'L.A. LIVE まで徒歩3分。開場前のグルメと GRAMMY Museum が' +
              '観戦チケットで10%オフです',
    why: '遠方客は早着しがち。空き時間を周辺消費に変え、滞在価値を上げる' },

  { id: 'ARV-2', on: true, trig: 'GEOFENCE', ch: 'PUSH', offer: 'UPGRADE',
    name: '来場時｜車来場者に駐車の事前決済',
    cond: f => f.org.mode === 'CAR' && f.app,
    msg: f => '駐車場 Lot W 残りわずか。事前決済で入庫列を回避できます（' +
              fmt(Math.round(f.minutes * 0.12)) + '分短縮の想定）',
    why: '入庫列は最大の不満要因。事前決済で待ちを削り、駐車売上を先に確定させる' },

  { id: 'ARV-3', on: true, trig: 'GATE_SCAN', ch: 'PUSH', offer: 'HOSPITALITY',
    name: '来場時｜高LTV層をPremier Loungeへ',
    cond: f => f.ltv > 45000 && f.app && f.tier !== 'SUITE',
    msg: f => '本日はPremier Loungeを開放しています。' +
              'ご継続 ' + f.tenure + '年のお礼にドリンク1杯をご用意しました',
    why: '高LTV層に「認識されている」体験を渡す。更新率とアップグレードの布石' },

  { id: 'IN-1', on: true, trig: 'SEATED', ch: 'PUSH', offer: 'FB_OFFER',
    name: '場内｜着席直後に最寄り売店クーポン',
    cond: f => f.app && f.fb < 20,
    msg: (f, s) => 'Sec ' + s.sec + ' から徒歩40秒の Bibigo Kitchen。' +
                   '今から20分間だけ20%オフです',
    why: '着席直後は購買意欲が最も高い。席位置から最寄りスタンドを出し分ける' },

  { id: 'IN-2', on: true, trig: 'NO_PURCHASE', ch: 'PUSH', offer: 'MERCH',
    name: '場内｜未購買層にグッズ・クロスセル',
    cond: f => f.app && f.merch === 0,
    msg: f => 'Team Store は 100L コンコース。' +
              (f.gamesLtm <= 2 ? '初回来場の方に限定ピンバッジを進呈します' : '本日限定アイテムが入荷しています'),
    why: '第3クォーターは退屈が生まれる時間帯。物販に流して単価を上げる' },

  { id: 'EXT-1', on: true, trig: 'GAME_END', ch: 'PUSH', offer: 'TOUR_BUNDLE',
    name: '退場時｜州外・観光客を周辺回遊へ',
    cond: f => f.localStay && f.app,
    msg: () => 'L.A. LIVE の提携店は 22:30 まで営業。' +
               '本日の観戦チケット提示で10%オフになります',
    why: '「帰る際のPR」の本命。退場動線をそのまま周辺消費に接続する' },

  { id: 'EXT-2', on: true, trig: 'EXIT_GATE', ch: 'PUSH', offer: 'FB_OFFER',
    name: '退場時｜出庫ピーク回避の動線分散',
    cond: f => f.org.mode === 'CAR' && f.app,
    msg: () => '駐車場の出庫がピークです。あと15分 L.A. LIVE でお過ごしいただくと' +
               '平均12分早く出られます（提携店ドリンク1杯無料）',
    why: '不満の最大要因である出庫渋滞を、消費に変えながら平準化する' },

  { id: 'EXT-3', on: true, trig: 'LEFT_500M', ch: 'PUSH', offer: 'WINBACK',
    name: '退場時｜初回・単券客を次戦へ',
    cond: f => (f.seg === 'SINGLE' || f.seg === 'RESALE') && f.gamesLtm <= 2 && f.app,
    msg: () => '本日はありがとうございました。今夜だけ、次戦のチケットが20%オフです',
    why: '体験直後の熱量が最も高い瞬間に次回接点を作る。初回→2回目の転換が最重要' },

  { id: 'EXT-4', on: true, trig: 'GAME_END', ch: 'SMS', offer: 'RENEW',
    name: '退場時｜離反リスクの高いシーズン券保有者',
    cond: f => (f.seg === 'SEASON' || f.seg === 'PARTIAL') && f.churn > 0.5,
    msg: f => 'ご継続 ' + f.tenure + '年のお客様へ。来季の先行更新特典（Premier Box 1試合ご招待）' +
              'のご案内をお送りしました',
    why: '更新見込が低い層を、良い体験の直後に捕まえる。反応率が平時の1.6倍' },

  { id: 'PST-1', on: true, trig: 'NEXT_DAY', ch: 'EMAIL', offer: 'MERCH',
    name: '帰宅後｜ハイライト + あなたの席からの1枚',
    cond: f => f.optin,
    msg: (f, s) => '昨夜の Sec ' + s.sec + ' からの眺めとハイライトをお届けします',
    why: '体験の記憶を固定し、次回の想起を作る。開封率が最も高い定番' },

  { id: 'PST-2', on: true, trig: 'NEXT_DAY', ch: 'EMAIL', offer: 'UPGRADE',
    name: '帰宅後｜高LTV層に席種アップグレード',
    cond: f => f.ltv > 30000 && f.optin && (f.tier === 'L300' || f.tier === 'L100'),
    msg: (f, s) => 'Sec ' + s.sec + ' から2列前方への差額アップグレード枠が空いています',
    why: '良席の空きを、既に価値を感じている層へ先出しする' },
];

/* 既定シナリオにも対照群を必ず置く。ホールドアウトが無いと
   「配信したから起きた分」を切り出せず、効果の数字が根拠を失う。 */
for (const J of JOURNEYS) {
  if (J.holdout === undefined) J.holdout = 0.10;
  if (J.ab === undefined) J.ab = false;
  if (J.abShare === undefined) J.abShare = 0.5;
  if (J.chB === undefined) J.chB = 'EMAIL';
  if (J.offerB === undefined) J.offerB = J.offer;
}

/* --- 発火時刻モデル（分・当日タイムライン） --- */
function fireTime(trig, f, s, i) {
  const j = (hrand(i, 0x77 + trig.length) - 0.5);
  switch (trig) {
    case 'GEOFENCE':    return f.arrival - 12 + j * 6;
    case 'GATE_SCAN':   return f.arrival;
    case 'SEATED':      return f.arrival + 6 + j * 4;
    case 'HALFTIME':    return 20 * 60 + 15 + hrand(i, 3) * 4;
    case 'NO_PURCHASE': return 20 * 60 + 40 + hrand(i, 5) * 6;
    case 'GAME_END':    return 22 * 60 + hrand(i, 7) * 3;
    /* 退場は上層ほど遅い（ボミトリー〜コンコースの捌け） */
    case 'EXIT_GATE':   return 22 * 60 + 2 + (s.tier === 'L300' ? 6 : s.tier === 'PRM' ? 3 : 0)
                               + hrand(i, 11) * 12;
    case 'LEFT_500M':   return 22 * 60 + 12 + hrand(i, 13) * 26;
    default:            return null;                 // pre / post はバッチ扱い
  }
}

const AUTO = { sched: [], cursor: 0, log: [], byJ: {}, batch: {}, flash: null,
               kpi: {}, built: false, page: false, filter: 'all' };

function buildAutomation() {
  const N = SEAT.list.length;
  AUTO.sched = []; AUTO.cursor = 0; AUTO.log = []; AUTO.byJ = {}; AUTO.batch = {};
  AUTO.flash = new Float32Array(N);
  AUTO.seatCount = new Uint8Array(N);
  for (const J of JOURNEYS) AUTO.byJ[J.id] = { sent: 0, cv: 0, rev: 0, cost: 0, aud: 0, hold: 0 };

  for (let i = 0; i < N; i++) {
    if (!SNAP.sold[i]) continue;
    const s = SEAT.list[i], f = fanAt(i);
    const fx = Object.assign({ tier: s.tier }, f);
    for (const J of JOURNEYS) {
      if (!J.on) continue;
      let ok = false;
      try {
        ok = J.cond ? J.cond(fx, s)
           : (J.f && typeof filterMatch === 'function' ? filterMatch(J.f, f, s) : false);
      } catch (e) { ok = false; }
      if (!ok) continue;
      AUTO.byJ[J.id].aud++;
      AUTO.seatCount[i]++;
      /* ホールドアウト（対照群）は配信しない。効果測定のために母数だけ数える */
      if (J.holdout > 0 && hrand(i, 0x9e3d + J.id.length * 31) < J.holdout) {
        AUTO.byJ[J.id].hold = (AUTO.byJ[J.id].hold || 0) + 1;
        continue;
      }
      const t = fireTime(J.trig, f, s, i);
      if (t == null) { AUTO.batch[J.id] = (AUTO.batch[J.id] || 0) + 1; continue; }
      AUTO.sched.push({ t, i, j: J.id });
    }
  }
  AUTO.sched.sort((a, b) => a.t - b.t);
  AUTO.built = true;
  computeAutoKpi();
}

/* --- 配信結果の見積り（セグメントビルダーと同じアップリフト評価） --- */
function computeAutoKpi() {
  let sent = 0, cv = 0, rev = 0, cost = 0, aud = 0;
  const byPhase = {};
  for (const J of JOURNEYS) {
    const B = AUTO.byJ[J.id]; if (!B) continue;
    const C = CHANNELS[J.ch];
    const act = NBA_ACTIONS.find(a => a.id === J.offer) || NBA_ACTIONS[0];
    const respC = clamp((OFFER_RESP[J.offer] || 0.08) * C.mult, 0, 0.85);
    const respT = clamp(respC * (1 + act.up), 0, 0.9);
    const reach = Math.max(0, B.aud - (B.hold || 0)) * C.deliver;
    /* 増分（施策 − コントロール）だけを成果に計上する */
    B.inc = reach * (respT - respC);
    B.value = OFFER_VALUE[J.offer] ? OFFER_VALUE[J.offer](AGG.kpi.sold
      ? { avgPaid: AGG.kpi.avg, avgLtv: AGG.kpi.ltv / AGG.kpi.sold } : { avgPaid: 400, avgLtv: 20000 })
      : 100;
    B.rev = B.inc * B.value;
    B.cost = B.aud * C.cost + (B.aud ? C.fixed / 6 : 0);   // 固定費は年間施策で按分
    B.reach = Math.round(reach);
    aud += B.aud; sent += B.reach; cv += B.inc; rev += B.rev; cost += B.cost;
    const p = TRIG[J.trig].ph;
    const e = byPhase[p] || (byPhase[p] = { aud: 0, inc: 0, rev: 0 });
    e.aud += B.aud; e.inc += B.inc; e.rev += B.rev;
  }
  AUTO.kpi = { aud, sent, cv, rev, cost, roas: cost > 0 ? rev / cost : 0,
               profit: rev - cost, byPhase,
               active: JOURNEYS.filter(j => j.on).length };
}

/* --- タイムライン同期の実行 --- */
let lastAutoMin = -1;
function autoStep(min) {
  if (!AUTO.built) return;
  if (min < lastAutoMin) {                                  // 巻き戻したらリセット
    AUTO.cursor = 0; AUTO.log.length = 0;
    for (const k in AUTO.byJ) AUTO.byJ[k].sent = 0;
    if (AUTO.flash) AUTO.flash.fill(0);
  }
  lastAutoMin = min;
  /* このステップで発火した分をいったん集め、ログには均等サンプルを載せる。
     時刻を大きく飛ばしたときに、先頭の同一トリガーだけでログが埋まるのを避ける。 */
  const batch = [];
  while (AUTO.cursor < AUTO.sched.length && AUTO.sched[AUTO.cursor].t <= min) {
    const e = AUTO.sched[AUTO.cursor++];
    const J = JOURNEYS.find(x => x.id === e.j);
    if (!J || !J.on) continue;
    AUTO.byJ[J.id].sent++;
    if (AUTO.flash) AUTO.flash[e.i] = 1;
    batch.push([e, J]);
  }
  const LOGN = 30;
  const step = Math.max(1, Math.ceil(batch.length / LOGN));
  for (let k = batch.length - 1; k >= 0; k -= step) {
    const [e, J] = batch[k];
    const s = SEAT.list[e.i], f = fanAt(e.i);
    let msg = '';
    try { msg = typeof J.msg === 'function' ? J.msg(f, s) : String(J.msg); } catch (x) { msg = ''; }
    AUTO.log.unshift({ t: e.t, fid: f.fid, sec: s.sec, row: s.row + 1, num: s.num,
                       j: J, msg, seg: f.seg, i: e.i });
  }
  if (AUTO.log.length > 90) AUTO.log.length = 90;
  return batch.length;
}

/* 発火した席の残光を減衰させる */
FRAME_HOOKS.push(function (dt) {
  if (!AUTO.flash) return;
  const f = AUTO.flash;
  let any = false;
  for (let i = 0; i < f.length; i++) if (f[i] > 0) { f[i] = Math.max(0, f[i] - dt * 0.55); any = true; }
  if (any && level === 'arena' && seatMode === 'journey') repaintSeats();
});
TICK_HOOKS.push(function () {
  autoStep(timeState.min);
  if (AUTO.page) renderAutoConsole();
});
