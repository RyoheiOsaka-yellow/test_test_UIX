
/* ================================================================
   席区画レイアウト — Crypto.com Arena 公式 SEATING MAP (BASKETBALL) 準拠
   100 Level : 101-119 (19区画)
   Premier   : 205-210 / 214-219 (12区画) + Premier Box PR1-PR18 (18区画)
   300 Level : 301-334 (34区画)
   周長比 f∈[0,1) は t=0(コート長軸 +x 方向) から反時計回り。
   101 / 301 / PR5 をサイドライン中央 (f=0.75) に置き、公式席図と同じ並び順で一周する。
================================================================ */
function layoutRing(seq, startF) {
  /* seq: [[name, widthFraction], ...] を startF を先頭要素の中心として並べる */
  const out = [];
  let f = startF - seq[0][1] / 2;
  for (const [name, w] of seq) { out.push({ sec: name, f0: f, f1: f + w }); f += w; }
  return out;
}
const SIDE_W = 0.056, CORNER_W = 0.056, END_W = 0.0550, W_END = 0.044;

/* --- 100 Level: 101(南中央) から反時計回りに 119,118,117...102 --- */
const SECTION_100 = layoutRing([
  ['101', SIDE_W], ['119', SIDE_W], ['118', SIDE_W],
  ['117', END_W], ['116', END_W], ['115', END_W], ['114', END_W],
  ['113', SIDE_W], ['112', SIDE_W], ['111', SIDE_W], ['110', SIDE_W], ['109', SIDE_W],
  ['108', W_END], ['107', W_END], ['106', W_END], ['105', W_END], ['104', W_END],
  ['103', SIDE_W], ['102', SIDE_W],
], 0.75);

/* --- Premier Level: サイドラインに Premier Box、両エンドに指定席 --- */
const SUITE_F = 0.28 / 9, PRMSEC_F = 0.22 / 6;
const SECTION_PRM = layoutRing([
  ['PR5', SUITE_F], ['PR4', SUITE_F], ['PR3', SUITE_F], ['PR2', SUITE_F], ['PR1', SUITE_F],
  ['219', PRMSEC_F], ['218', PRMSEC_F], ['217', PRMSEC_F],
  ['216', PRMSEC_F], ['215', PRMSEC_F], ['214', PRMSEC_F],
  ['PR18', SUITE_F], ['PR17', SUITE_F], ['PR16', SUITE_F], ['PR15', SUITE_F], ['PR14', SUITE_F],
  ['PR13', SUITE_F], ['PR12', SUITE_F], ['PR11', SUITE_F], ['PR10', SUITE_F],
  ['210', PRMSEC_F], ['209', PRMSEC_F], ['208', PRMSEC_F],
  ['207', PRMSEC_F], ['206', PRMSEC_F], ['205', PRMSEC_F],
  ['PR9', SUITE_F], ['PR8', SUITE_F], ['PR7', SUITE_F], ['PR6', SUITE_F],
], 0.75);
const SUITE_LAYOUT = SECTION_PRM.filter(s => s.sec[0] === 'P');
const SECTION_PRM_SEATS = SECTION_PRM.filter(s => s.sec[0] !== 'P');

/* --- 300 Level: 301(南中央) から反時計回りに 334,333...302 --- */
const SECTION_300 = layoutRing(
  ['301'].concat(Array.from({ length: 33 }, (_, i) => String(334 - i)))
    .map(n => [n, 1 / 34]), 0.75);

/* ---- 席種カテゴリ（価格は 2024-25 Lakers レギュラーシーズンの実勢レンジを想定した合成値） ---- */
const CAT = {
  CS:  { name: 'コートサイド',        price: 2800, color: 0xff3d6e },
  FLR: { name: 'フロア',              price: 1150, color: 0xff8a3d },
  L1C: { name: '100L センター',       price: 780,  color: 0xfdb927 },
  L1S: { name: '100L サイドライン',   price: 520,  color: 0xffd977 },
  L1K: { name: '100L コーナー',       price: 340,  color: 0x8a5cc4 },
  L1E: { name: '100L エンドライン',   price: 265,  color: 0xb98ee0 },
  SUI: { name: 'Premier Box',         price: 850,  color: 0x00e0a4 },
  PRM: { name: 'Premier 指定',        price: 410,  color: 0x3ddc84 },
  L3S: { name: '300L サイドライン',   price: 145,  color: 0x4da3ff },
  L3E: { name: '300L エンドライン',   price: 78,   color: 0x6f88b0 },
};
/* 区画中心の平面位置から席種を判定（サイド/コーナー/エンドを幾何的に決める） */
function catFor(tierKey, cx, cz, a, b) {
  const ux = Math.abs(cx) / a, uz = Math.abs(cz) / b;
  const endish = ux > uz;                       // 長軸側(=エンドライン背後)か
  const center = 1 - ux;                        // サイドラインの中央度
  if (tierKey === 'L100') return endish ? 'L1E' : (center > 0.72 ? 'L1C' : (center > 0.34 ? 'L1S' : 'L1K'));
  if (tierKey === 'L300') return endish ? 'L3E' : 'L3S';
  return 'PRM';
}
