
/* ================================================================
   1to1 データレイヤー
   19,079席 = 19,079 の顧客接点。1席1レコードで個客属性・取引・行動・
   媒体露出・CRM接触を保持する。
   ★ 現在は決定的PRNGによる合成データ。docs/DATA_SPEC.md の
     tickets.csv / fans.csv を読み込むと同じ器のまま実データに置換される。
================================================================ */

/* ---- 興行マスタ（フロア形状・需要ベースが変わる） ---- */
const GAMES = {
  gsw:     { name: 'vs Golden State Warriors', date: '2025-11-14 (Fri)', fmt: 'NBA', base: 0.99, tv: 1, away: 'GSW' },
  bos:     { name: 'vs Boston Celtics',        date: '2025-12-25 (Thu)', fmt: 'NBA', base: 1.00, tv: 1, away: 'BOS' },
  por:     { name: 'vs Portland Trail Blazers', date: '2026-01-07 (Wed)', fmt: 'NBA', base: 0.84, tv: 0, away: 'POR' },
  kings:   { name: 'LA Kings vs Vegas',        date: '2025-12-06 (Sat)', fmt: 'NHL', base: 0.92, tv: 0, away: 'VGK' },
  sparks:  { name: 'LA Sparks vs Las Vegas',   date: '2026-06-12 (Fri)', fmt: 'WNBA', base: 0.61, tv: 0, away: 'LVA' },
  concert: { name: 'Arena Concert (Sold Out)', date: '2026-02-21 (Sat)', fmt: 'CONCERT', base: 0.995, tv: 0, away: '' },
};
let curGame = 'gsw';

/* ---- セグメント / 商圏 ---- */
const SEGMENTS = {
  SEASON:  { name: 'シーズンシート', color: 0xfdb927 },
  PARTIAL: { name: '部分シーズン券', color: 0xff8a3d },
  SINGLE:  { name: '単券（公式EC）', color: 0x4da3ff },
  RESALE:  { name: '二次流通',       color: 0x8a5cc4 },
  GROUP:   { name: '団体',           color: 0x3ddc84 },
  TOURIST: { name: '州外・観光',     color: 0xff5fa2 },
  COMP:    { name: '招待/協賛枠',    color: 0x8590a8 },
};
const REGIONS = [
  { n: 'DTLA / Central LA', s: 0.14, km: 4,    col: 0x00c2ff },
  { n: 'Westside',          s: 0.16, km: 16,   col: 0x4da3ff },
  { n: 'San Fernando Valley', s: 0.15, km: 27, col: 0x3ddc84 },
  { n: 'South Bay',         s: 0.11, km: 23,   col: 0x00e0a4 },
  { n: 'Orange County',     s: 0.12, km: 50,   col: 0xfdb927 },
  { n: 'Inland Empire',     s: 0.10, km: 88,   col: 0xff8a3d },
  { n: 'Out of State',      s: 0.16, km: 900,  col: 0xff5fa2 },
  { n: 'International',     s: 0.06, km: 9000, col: 0x8a5cc4 },
];
const AGE_BANDS = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const NBA_ACTIONS = [
  { id: 'UPGRADE',  t: '席種アップグレード提案', d: seg => '同ブロック前方列への差額アップグレード枠を優先案内', up: 0.18 },
  { id: 'RENEW',    t: 'シーズン券 早期更新オファー', d: () => '更新特典（Premier Box 1試合招待）を付けて更新率を確保', up: 0.24 },
  { id: 'WINBACK',  t: '離反前 ウィンバック', d: () => '直近90日未来場。次戦 20% OFF + 交通クーポンで復帰導線', up: 0.31 },
  { id: 'FB_OFFER', t: '場内F&Bクーポン', d: () => 'ハーフタイム前に近接スタンドの限定クーポンをアプリPush', up: 0.12 },
  { id: 'MERCH',    t: 'グッズ クロスセル', d: () => '観戦カテゴリ×嗜好からTeam Storeのレコメンド配信', up: 0.09 },
  { id: 'CONVERT',  t: '単券→部分シーズン券 転換', d: () => '年3試合以上の来場実績。6試合パックを提示', up: 0.27 },
  { id: 'HOSPITALITY', t: 'ホスピタリティ提案', d: () => '法人属性。Premier Box 年間契約の商談化', up: 0.35 },
  { id: 'TOUR_BUNDLE', t: '観光バンドル', d: () => '州外来訪。周辺ホテル＋L.A. LIVE 回遊クーポンを同梱', up: 0.16 },
];

/* ---- 区画別の販売率係数（実測 tickets.csv 投入時は CALIB が優先） ---- */
const CALIB = {};
function parseTicketsCSV(text) {
  /* game,section,sold,capacity  もしくは  game,section,rate(%) */
  let n = 0;
  for (const line of text.split(/\r?\n/)) {
    const c = line.split(',').map(s => s.trim());
    if (c.length < 3 || !c[0] || c[0].toLowerCase() === 'game') continue;
    const g = c[0], sec = c[1].toUpperCase();
    let rate = (c.length >= 4 && +c[3] > 0) ? (+c[2]) / (+c[3]) : (+c[2] > 1 ? +c[2] / 100 : +c[2]);
    if (!isFinite(rate)) continue;
    (CALIB[g] = CALIB[g] || {})[sec] = clamp(rate, 0, 1);
    n++;
  }
  return n;
}

/* ---- 商圏別の交通手段分担率（LA の実勢を反映） ----
   DTLAは徒歩とMetroが効くが、郊外は圧倒的に車。州外・海外客は市内に宿泊しているため
   ライドシェアと徒歩が主体になる。この表がODの骨格を決める。 */
const REGION_MODE = {
  'DTLA / Central LA':   { CAR: .35, METRO: .28, WALK: .25, RIDESHARE: .12 },
  'Westside':            { CAR: .62, METRO: .14, RIDESHARE: .24 },
  'San Fernando Valley': { CAR: .78, METRO: .16, RIDESHARE: .06 },
  'South Bay':           { CAR: .70, METRO: .24, RIDESHARE: .06 },
  'Orange County':       { CAR: .88, METRO: .05, RIDESHARE: .07 },
  'Inland Empire':       { CAR: .92, METRO: .04, RIDESHARE: .04 },
  'Out of State':        { RIDESHARE: .48, WALK: .34, CAR: .12, METRO: .06 },
  'International':       { RIDESHARE: .44, WALK: .40, METRO: .10, CAR: .06 },
};
/* 手段が決まったあと、その商圏に紐づく出発地を優先して選ぶ */
const ORIGIN_BY_MODE = (function () {
  const m = {};
  ORIGINS.forEach((o, i) => (m[o.mode] = m[o.mode] || []).push(i));
  return m;
})();
function pickOrigin(regionName, r1, r2) {
  const mix = REGION_MODE[regionName] || { CAR: 1 };
  const mode = pick(Object.entries(mix), r1);
  const pool = ORIGIN_BY_MODE[mode] || ORIGIN_BY_MODE.CAR || [0];
  const pref = pool.filter(i => (ORIGINS[i].regions || []).indexOf(regionName) >= 0);
  const use = pref.length ? pref : pool;
  return use[Math.floor(r2 * use.length) % use.length];
}
/* ドアツードア平均速度 (km/h)。近距離ほど遅く、長距離はフリーウェイ/急行区間で速くなる */
function doorSpeed(mode, km) {
  if (mode === 'WALK') return 4.8;
  if (mode === 'METRO') return km < 8 ? 18 : 26 + Math.min(km, 40) * 0.25;
  if (mode === 'CAR') return 22 + Math.min(km, 90) * 0.30;
  if (mode === 'RIDESHARE') return 20 + Math.min(km, 60) * 0.28;
  return 30;
}
/* 端末での待ち時間（分）: 乗換待ち / 配車待ち / 駐車と徒歩 */
const MODE_WAIT = { METRO: 7, RIDESHARE: 6, CAR: 9, WALK: 0, RAIL: 10 };

/* ================= 個客レコード生成（決定的） ================= */
const secSeed = {};
function sectionFactor(sec, g) {
  const k = sec + '|' + g;
  if (k in secSeed) return secSeed[k];
  const r = hrand(sec.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 31 + g.length * 7, 991);
  secSeed[k] = 0.90 + r * 0.14;
  return secSeed[k];
}
function seatOcc(s, g) {
  const G = GAMES[g];
  const cb = CALIB[g];
  if (cb && cb[s.sec] != null) return clamp(cb[s.sec] - s.row * 0.004, 0.02, 1);
  let f = sectionFactor(s.sec, g);
  if (s.tier === 'L300') f -= 0.13;
  else if (s.tier === 'PRM' || s.tier === 'SUITE') f += 0.03;
  else if (s.tier === 'FLOOR') f += 0.05;
  if (G.fmt === 'CONCERT' && s.tier === 'L300') f += 0.10;   // コンサートは上層まで埋まる
  if (G.fmt === 'WNBA') f -= (s.tier === 'L300' ? 0.22 : 0.05);
  const rowPen = s.tier === 'L300' ? s.row * 0.012 : s.row * 0.004;
  return clamp(G.base * f - rowPen, 0.02, 1);
}

/* 1席 × 1興行 → 個客レコード */
function fanFor(i, g) {
  const s = SEAT.list[i];
  const gi = Object.keys(GAMES).indexOf(g) + 1;
  const h = hash32(i * 13 + gi * 700001, 0x9e37);
  const r = k => hrand(i * 17 + gi * 131 + k * 7919, 0x85eb + k);

  /* --- セグメント: 席種で構成比が変わる --- */
  const prem = (s.tier === 'FLOOR' || s.tier === 'SUITE' || s.tier === 'PRM');
  const up = (s.tier === 'L300');
  let mix;
  if (prem) mix = [['SEASON', .46], ['PARTIAL', .13], ['SINGLE', .11], ['RESALE', .10],
                   ['GROUP', .04], ['TOURIST', .07], ['COMP', .09]];
  else if (up) mix = [['SEASON', .12], ['PARTIAL', .11], ['SINGLE', .29], ['RESALE', .17],
                      ['GROUP', .12], ['TOURIST', .17], ['COMP', .02]];
  else mix = [['SEASON', .27], ['PARTIAL', .13], ['SINGLE', .24], ['RESALE', .15],
              ['GROUP', .07], ['TOURIST', .11], ['COMP', .03]];
  const seg = pick(mix, r(1));

  /* シーズン券保有者は席が固定 = 興行をまたいで同一 fan_id */
  const stable = (seg === 'SEASON' || seg === 'PARTIAL');
  const idSeed = stable ? hash32(i, 0x5bf0) : h;
  const fid = 'f_' + idSeed.toString(16).padStart(8, '0');

  /* --- 商圏 --- */
  let rmix = REGIONS.map(x => [x, x.s]);
  if (seg === 'TOURIST') rmix = [[REGIONS[6], .72], [REGIONS[7], .28]];
  else if (seg === 'SEASON') rmix = REGIONS.slice(0, 6).map((x, k) => [x, x.s * (k < 4 ? 1.5 : 1)]);
  const reg = pick(rmix, r(2));

  const age = AGE_BANDS[Math.floor(r(3) * 6)];
  const tenure = seg === 'SEASON' ? 1 + Math.floor(r(4) * 18)
    : seg === 'PARTIAL' ? 1 + Math.floor(r(4) * 7) : Math.floor(r(4) * 4);
  const gamesLtm = seg === 'SEASON' ? 30 + Math.floor(r(5) * 12)
    : seg === 'PARTIAL' ? 8 + Math.floor(r(5) * 10)
    : seg === 'TOURIST' ? 1 : 1 + Math.floor(r(5) * 5);
  const face = CAT[s.cat].price;
  const disc = seg === 'GROUP' ? 0.72 : seg === 'COMP' ? 0 : seg === 'SEASON' ? 0.82
    : seg === 'PARTIAL' ? 0.88 : seg === 'RESALE' ? 1.15 + r(6) * 0.75 : 0.95 + r(6) * 0.3;
  const paid = Math.round(face * disc);
  const ltv = Math.round(paid * gamesLtm * (1 + tenure * 0.42) * (0.7 + r(7) * 0.7));
  const fb = Math.round((s.tier === 'SUITE' ? 90 : prem ? 62 : up ? 24 : 38) * (0.4 + r(8) * 1.5));
  const merch = Math.round((prem ? 55 : 22) * (r(9) < 0.42 ? (0.5 + r(10) * 2.4) : 0));
  const rfmR = clamp(Math.round(5 - (seg === 'TOURIST' ? 3.4 : 0) - r(11) * 2.2 + (seg === 'SEASON' ? 1.4 : 0)), 1, 5);
  const rfmF = clamp(Math.round(1 + gamesLtm / 9), 1, 5);
  const rfmM = clamp(Math.round(1 + ltv / 4200), 1, 5);
  /* 離反リスク（= 1 - 更新見込）
     セグメント別の基準離反率をロイヤルティ（頻度・継続年数・席の体験）で減衰させ、
     右に裾を引くノイズを乗せる。実データでは renewed_last_season を教師ラベルに置換する。 */
  const loyal = clamp(rfmF / 5 * 0.45 + Math.min(tenure, 12) / 12 * 0.35 + s.exp * 0.20, 0, 1);
  const CHURN_BASE = { SEASON: 0.22, PARTIAL: 0.34, SINGLE: 0.58, RESALE: 0.66,
                       GROUP: 0.60, TOURIST: 0.90, COMP: 0.72 };
  const churn = clamp(CHURN_BASE[seg] * (1 - 0.34 * loyal)
    + Math.pow(r(12), 2.4) * 0.52 - 0.06, 0.02, 0.97);
  const arrival = 17 * 60 + Math.round(30 + r(13) * 145 - (prem ? 25 : 0));
  const gate = GATES.length ? GATES[Math.floor(r(14) * GATES.length)].name : 'Gate A';

  /* --- Next Best Action --- */
  let nba;
  if ((seg === 'SEASON' || seg === 'PARTIAL') && churn > 0.42) nba = NBA_ACTIONS[1];
  else if (rfmR <= 2 && seg !== 'TOURIST') nba = NBA_ACTIONS[2];
  else if (seg === 'TOURIST') nba = NBA_ACTIONS[7];
  else if (s.tier === 'SUITE' || (prem && ltv > 30000)) nba = NBA_ACTIONS[6];
  else if ((seg === 'SINGLE' || seg === 'RESALE') && gamesLtm >= 3) nba = NBA_ACTIONS[5];
  else if (s.exp > 0.55 && s.row > 6) nba = NBA_ACTIONS[0];
  else nba = NBA_ACTIONS[r(15) < 0.5 ? 3 : 4];

  /* --- OD: 商圏に整合する出発地を割り当て、ドアツードア所要時間を出す --- */
  const oi = pickOrigin(reg.n, r(18), r(20));
  const org = ORIGINS[oi];
  /* 当日移動距離 ≠ 居住地距離。州外・海外客は市内に宿泊しているので、
     ゲームデイの移動は「宿泊拠点 → アリーナ」の市内距離になる。 */
  const localStay = (reg.n === 'Out of State' || reg.n === 'International');
  const tripKm = org.mode === 'WALK' ? org.route.total / 1000
    : localStay ? 2.5 + r(19) * 12
    : reg.km;
  const minutes = Math.round(
    tripKm / doorSpeed(org.mode, tripKm) * 60
    + (org.mode === 'WALK' ? 0 : org.route.total / 80)     // 端末アクセス徒歩 80m/分
    + MODE_WAIT[org.mode]);

  return { fid, seg, reg, age, tenure, gamesLtm, face, paid, ltv, fb, merch,
           rfmR, rfmF, rfmM, churn, arrival, gate, nba, oi, org, minutes, tripKm, localStay,
           optin: r(16) < (seg === 'SEASON' ? 0.93 : 0.61),
           app: r(17) < (seg === 'SEASON' ? 0.88 : 0.44) };
}

/* ---- 現在興行の全席スナップショット ---- */
const SNAP = { occ: null, fans: null, kpi: null };
function buildSnapshot() {
  const N = SEAT.list.length;
  SNAP.occ = new Float32Array(N);
  SNAP.sold = new Uint8Array(N);
  const g = curGame;
  for (let i = 0; i < N; i++) {
    const s = SEAT.list[i];
    const o = seatOcc(s, g);
    SNAP.occ[i] = o;
    SNAP.sold[i] = (hrand(i, 0x1234 + Object.keys(GAMES).indexOf(g)) < o) ? 1 : 0;
  }
  SNAP.fans = new Array(N).fill(null);       // 遅延生成（クリック時に確定）
  computeKPIs();
}
function fanAt(i) {
  if (!SNAP.fans[i]) SNAP.fans[i] = fanFor(i, curGame);
  return SNAP.fans[i];
}
