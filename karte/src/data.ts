// デモ用のモックデータ。すべて架空の物件・人物で、固定シードから決定的に生成する。

export const TODAY = '2026-11-12';

export type Severity = 'urgent' | 'watch' | 'ok';
export type Part = '外壁' | '屋根' | '防水' | '構造' | '設備';
export const PARTS: Part[] = ['外壁', '屋根', '防水', '構造', '設備'];
export const STATUSES = ['未対応', '見積中', '提案済', '承認済', '工事中', '完了'] as const;
export type FindingStatus = (typeof STATUSES)[number];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export interface Finding {
  id: string;
  propertyId: string;
  part: Part;
  location: string;
  severity: Severity;
  title: string;
  description: string;
  foundDate: string;
  /** 推奨修繕時期(この月まで) */
  dueBy: string | null;
  estCost: number;
  status: FindingStatus;
  statusDate: string;
  pin: { x: number; y: number };
  photos: number;
  memo: string;
}

export interface Inspection {
  id: string;
  propertyId: string;
  date: string;
  score: number;
  summary: string;
  nextInYears: number;
  inspector: string;
}

export interface Repair {
  id: string;
  propertyId: string;
  date: string;
  part: Part;
  place: string;
  work: string;
  cost: number;
  contractor: string;
}

export type ActivityType = '点検' | '指摘登録' | '見積' | '提案' | 'オーナー連絡' | '承認' | '工事' | '報告書';

export interface Activity {
  id: string;
  propertyId: string;
  date: string;
  type: ActivityType;
  actor: string;
  channel?: 'メール' | 'LINE' | '電話' | '訪問' | 'マイページ';
  text: string;
  /** オーナー向け表示にも出す記録か */
  ownerVisible: boolean;
}

export interface Property {
  id: string;
  name: string;
  pref: string;
  city: string;
  address: string;
  branch: string;
  owner: string;
  ownerKana: string;
  staff: string;
  builtYear: number;
  age: number;
  structure: '木造' | '軽量鉄骨造' | 'RC造';
  floors: number;
  units: number;
  scores: Record<Part, number>;
  overall: number;
  site: { buildings: Rect[]; parking: Rect };
  lastInspection: string;
  nextInspection: string;
  notify: { mail: boolean; line: boolean; push: boolean };
}

// ---------- helpers ----------

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261112);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) => min + rand() * (max - min);
const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const pad = (n: number, len = 2) => String(n).padStart(len, '0');

export function addMonths(iso: string, months: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}
export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

// ---------- masters ----------

const AREAS = [
  { pref: '東京都', city: '練馬区', towns: ['豊玉北', '石神井町', '大泉学園町'], branch: '東京西支店' },
  { pref: '東京都', city: '世田谷区', towns: ['桜丘', '上用賀', '千歳台'], branch: '東京西支店' },
  { pref: '東京都', city: '足立区', towns: ['梅島', '竹の塚', '西新井'], branch: '東京東支店' },
  { pref: '神奈川県', city: '横浜市港北区', towns: ['日吉本町', '綱島東', '大倉山'], branch: '横浜支店' },
  { pref: '神奈川県', city: '川崎市中原区', towns: ['上小田中', '下新城', '今井南町'], branch: '横浜支店' },
  { pref: '埼玉県', city: 'さいたま市浦和区', towns: ['常盤', '領家', '木崎'], branch: '埼玉支店' },
  { pref: '埼玉県', city: '川口市', towns: ['芝新町', '戸塚東', '東川口'], branch: '埼玉支店' },
  { pref: '千葉県', city: '船橋市', towns: ['前原西', '習志野台', '夏見'], branch: '千葉支店' },
  { pref: '千葉県', city: '柏市', towns: ['豊四季', '松葉町', '明原'], branch: '千葉支店' },
  { pref: '愛知県', city: '名古屋市千種区', towns: ['春岡', '茶屋が坂', '星が丘元町'], branch: '名古屋支店' },
  { pref: '大阪府', city: '吹田市', towns: ['千里山西', '江坂町', '山田東'], branch: '大阪支店' },
  { pref: '大阪府', city: '堺市北区', towns: ['中百舌鳥町', '新金岡町', '長曽根町'], branch: '大阪支店' },
  { pref: '福岡県', city: '福岡市東区', towns: ['香椎駅前', '千早', '箱崎'], branch: '福岡支店' },
];
const NAME_HEAD = ['サンライズ', 'グリーン', 'メゾン', 'コーポ', 'エクセル', 'パーク', 'ルミエール', 'フォレスト', 'シャルム', 'プレミール'];
const NAME_TAIL = ['ハイツ', 'コート', 'レジデンス', 'ヴィラ', 'テラス', '', 'ガーデン'];
const SURNAMES: [string, string][] = [
  ['佐藤', 'サトウ'], ['鈴木', 'スズキ'], ['高橋', 'タカハシ'], ['田中', 'タナカ'], ['伊藤', 'イトウ'],
  ['渡辺', 'ワタナベ'], ['中村', 'ナカムラ'], ['小林', 'コバヤシ'], ['加藤', 'カトウ'], ['吉田', 'ヨシダ'],
  ['山本', 'ヤマモト'], ['松本', 'マツモト'], ['井上', 'イノウエ'], ['木村', 'キムラ'], ['清水', 'シミズ'],
  ['森', 'モリ'], ['池田', 'イケダ'], ['橋本', 'ハシモト'], ['石川', 'イシカワ'], ['前田', 'マエダ'],
];
const GIVEN: [string, string][] = [
  ['和夫', 'カズオ'], ['洋子', 'ヨウコ'], ['正一', 'ショウイチ'], ['恵美', 'エミ'], ['健二', 'ケンジ'],
  ['幸子', 'サチコ'], ['隆', 'タカシ'], ['由美', 'ユミ'], ['茂', 'シゲル'], ['直子', 'ナオコ'],
];
export const STAFF = ['青木 涼', '西村 沙織', '大野 健太', '藤井 美咲', '岡田 俊介', '原 奈々'];
const INSPECTORS = ['点検員 三浦', '点検員 坂本', '点検員 遠藤', '点検員 菊地'];
const CONTRACTORS = ['東和リフォーム', '城南防水工業', 'みなと塗装', '関東設備サービス', '明光建装'];

interface Template {
  titles: string[];
  locations: string[];
  cost: [number, number];
  work: string[];
}
const TEMPLATES: Record<Part, Template> = {
  外壁: {
    titles: ['外壁のひび割れ・塗膜の劣化', 'シーリングの破断・硬化', '外壁タイルの浮き', 'チョーキング(白亜化)の進行'],
    locations: ['北側', '南側', '東側', '西側'],
    cost: [60, 320],
    work: ['塗装工事', 'シーリング打替え', 'ひび割れ補修・部分塗装'],
  },
  屋根: {
    titles: ['屋根材の退色・塗膜劣化', '棟板金の浮き', '雨樋の破損・詰まり', '屋根材のひび割れ'],
    locations: ['屋根全面', '南面', '北面', '軒先'],
    cost: [40, 250],
    work: ['屋根塗装', '棟板金交換', '雨樋交換'],
  },
  防水: {
    titles: ['屋上防水シートの膨れ', 'バルコニー防水層の摩耗', '排水ドレン周りの劣化', '笠木ジョイントの浸水跡'],
    locations: ['屋上', '2Fバルコニー', '共用廊下', '庇'],
    cost: [50, 200],
    work: ['防水シートの張替え', 'ウレタン防水塗り替え', 'ドレン改修'],
  },
  構造: {
    titles: ['基礎の微細なひび割れ', '鉄骨階段の発錆', '手すり支柱根元の腐食', '土間コンクリートの沈下'],
    locations: ['基礎 北面', '外階段', '共用廊下', 'エントランス'],
    cost: [20, 150],
    work: ['鉄部塗装', '基礎ひび割れ補修', '手すり交換'],
  },
  設備: {
    titles: ['給水ポンプの異音・経年劣化', '排水管の勾配不良・詰まり', '給湯器の耐用年数超過', '共用灯・分電盤の劣化'],
    locations: ['ポンプ室', '駐車場側', '各住戸', '共用部'],
    cost: [15, 180],
    work: ['給水ポンプ交換', '排水管高圧洗浄・部分更新', '給湯器交換'],
  },
};

const DESC: Record<Severity, string> = {
  urgent: '劣化が進行しており、放置すると漏水や落下など二次被害につながるおそれがあります。早期の補修を推奨します。',
  watch: '現時点で機能上の支障はありませんが、劣化の兆候があります。次回点検までの経過観察と、計画的な補修を推奨します。',
  ok: '点検の結果、異常は認められませんでした。',
};

// ---------- generation ----------

export const properties: Property[] = [];
export const findings: Finding[] = [];
export const inspections: Inspection[] = [];
export const repairs: Repair[] = [];
export const activities: Activity[] = [];

let fSeq = 1;
let iSeq = 1;
let rSeq = 1;
let aSeq = 1;
const fid = () => `F-${pad(fSeq++, 4)}`;
const iid = () => `I-${pad(iSeq++, 4)}`;
const rid = () => `R-${pad(rSeq++, 4)}`;
const aid = () => `A-${pad(aSeq++, 5)}`;

function makeSite(two: boolean): Property['site'] {
  return two
    ? {
        buildings: [
          { x: 70, y: 46, w: 250, h: 62, label: 'A棟' },
          { x: 70, y: 150, w: 170, h: 62, label: 'B棟' },
        ],
        parking: { x: 256, y: 150, w: 84, h: 92, label: '駐車場' },
      }
    : {
        buildings: [{ x: 70, y: 60, w: 250, h: 84, label: '本棟' }],
        parking: { x: 70, y: 168, w: 250, h: 70, label: '駐車場' },
      };
}

function pinFor(site: Property['site'], location: string): { x: number; y: number } {
  const b = pick(site.buildings);
  const t = between(0.15, 0.85);
  if (location.includes('北')) return { x: b.x + b.w * t, y: b.y + 4 };
  if (location.includes('南')) return { x: b.x + b.w * t, y: b.y + b.h - 4 };
  if (location.includes('東')) return { x: b.x + b.w - 4, y: b.y + b.h * t };
  if (location.includes('西')) return { x: b.x + 4, y: b.y + b.h * t };
  if (location.includes('駐車場')) return { x: site.parking.x + 6, y: site.parking.y + site.parking.h * t };
  return { x: b.x + b.w * t, y: b.y + b.h * between(0.3, 0.7) };
}

function overallOf(scores: Record<Part, number>): number {
  return round1(PARTS.reduce((s, p) => s + scores[p], 0) / PARTS.length);
}

function pushLifecycle(p: Property, f: Finding) {
  const idx = STATUSES.indexOf(f.status);
  let d = f.foundDate;
  activities.push({
    id: aid(), propertyId: p.id, date: d, type: '指摘登録', actor: p.staff,
    text: `${f.part}|${f.location}「${f.title}」を登録(${f.id})`, ownerVisible: false,
  });
  if (idx >= 1) {
    d = addDays(d, 12);
    activities.push({
      id: aid(), propertyId: p.id, date: d, type: '見積', actor: p.staff,
      text: `${f.id} の見積を協力会社へ依頼(概算 ${Math.round(f.estCost / 10000)}万円)`, ownerVisible: false,
    });
  }
  if (idx >= 2) {
    d = addDays(d, 16);
    activities.push({
      id: aid(), propertyId: p.id, date: d, type: '提案', actor: p.staff, channel: '訪問',
      text: `${f.part}|${f.location}の修繕をオーナー様へご提案`, ownerVisible: true,
    });
  }
  if (idx >= 3) {
    d = addDays(d, 20);
    activities.push({
      id: aid(), propertyId: p.id, date: d, type: '承認', actor: `${p.owner} 様`, channel: 'マイページ',
      text: `${f.part}|${f.location}の修繕をご承認`, ownerVisible: true,
    });
  }
  if (idx >= 4) {
    d = addDays(d, 25);
    activities.push({
      id: aid(), propertyId: p.id, date: d, type: '工事', actor: pick(CONTRACTORS),
      text: `${f.part}|${f.location}の修繕工事に着手`, ownerVisible: true,
    });
  }
  f.statusDate = d > TODAY ? TODAY : d;
}

function addInspection(p: Property, date: string, score: number, summary: string, nextInYears: number) {
  inspections.push({ id: iid(), propertyId: p.id, date, score, summary, nextInYears, inspector: pick(INSPECTORS) });
  activities.push({
    id: aid(), propertyId: p.id, date, type: '点検', actor: '点検チーム',
    text: `定期点検を実施(総合評価 ${score.toFixed(1)})`, ownerVisible: true,
  });
  activities.push({
    id: aid(), propertyId: p.id, date: addDays(date, 7), type: '報告書', actor: p.staff, channel: 'メール',
    text: '点検報告書(PDF)をオーナー様へ送付', ownerVisible: true,
  });
}

function addRepair(p: Property, date: string, part: Part, place: string, work: string, cost: number) {
  repairs.push({ id: rid(), propertyId: p.id, date, part, place, work, cost, contractor: pick(CONTRACTORS) });
  activities.push({
    id: aid(), propertyId: p.id, date, type: '工事', actor: p.staff,
    text: `${place} ${work} 完了(${cost.toLocaleString()}円)`, ownerVisible: true,
  });
}

// --- 代表物件(スライドの画面イメージに対応) ---
(function hero() {
  const p: Property = {
    id: 'P-0001',
    name: 'サンライズコート石神井',
    pref: '東京都',
    city: '練馬区',
    address: '東京都練馬区石神井町4-12-8',
    branch: '東京西支店',
    owner: '山田 太郎',
    ownerKana: 'ヤマダ タロウ',
    staff: STAFF[0],
    builtYear: 2007,
    age: 19,
    structure: 'RC造',
    floors: 3,
    units: 24,
    scores: { 外壁: 6.0, 屋根: 7.5, 防水: 6.5, 構造: 8.5, 設備: 7.5 },
    overall: 7.2,
    site: makeSite(true),
    lastInspection: '2025-05-20',
    nextInspection: '2027-05-20',
    notify: { mail: true, line: true, push: false },
  };
  properties.push(p);

  addInspection(p, '2021-05-15', 8.4, '軽微なひび割れ', 2);
  addRepair(p, '2022-07-10', '外壁', 'シーリング(南・東面)', 'シーリング打替え', 680000);
  addInspection(p, '2023-05-18', 7.8, '屋根の退色、シーリング劣化', 2);
  addRepair(p, '2023-09-15', '外壁', '外壁(南・東面)', '塗装工事', 2180000);
  addRepair(p, '2024-08-30', '防水', '屋上防水', '防水シートの張替え', 1250000);
  addInspection(p, '2025-05-20', 7.2, '外壁の劣化、防水の劣化', 2);

  const hf: Omit<Finding, 'id' | 'propertyId' | 'statusDate' | 'description'>[] = [
    {
      part: '外壁', location: '北側', severity: 'urgent', title: '外壁のひび割れ・塗膜の劣化',
      foundDate: '2025-05-20', dueBy: '2027-05', estCost: 2100000, status: '提案済',
      pin: { x: 152, y: 50 }, photos: 5, memo: '2023年の塗装は南・東面のみ。北面は未施工のため優先度高。',
    },
    {
      part: '外壁', location: '西側 階段室', severity: 'urgent', title: 'シーリングの破断・硬化',
      foundDate: '2025-05-20', dueBy: '2027-05', estCost: 480000, status: '見積中',
      pin: { x: 76, y: 82 }, photos: 3, memo: '外壁北側と同時施工で足場費を圧縮できる見込み。',
    },
    {
      part: '防水', location: '2Fバルコニー', severity: 'urgent', title: 'バルコニー防水層の摩耗',
      foundDate: '2025-05-20', dueBy: '2027-11', estCost: 980000, status: '未対応',
      pin: { x: 150, y: 206 }, photos: 4, memo: '屋上は2024年に張替え済み。バルコニーは別工事。',
    },
    {
      part: '設備', location: '駐車場側', severity: 'watch', title: '排水管の勾配不良・詰まり',
      foundDate: '2025-05-20', dueBy: '2029-05', estCost: 420000, status: '未対応',
      pin: { x: 262, y: 196 }, photos: 2, memo: '次回点検で再確認。',
    },
    {
      part: '屋根', location: '屋根全面', severity: 'ok', title: '屋根・屋上の状態確認',
      foundDate: '2025-05-20', dueBy: null, estCost: 0, status: '完了',
      pin: { x: 262, y: 74 }, photos: 2, memo: '',
    },
  ];
  for (const h of hf) {
    const f: Finding = { ...h, id: fid(), propertyId: p.id, statusDate: h.foundDate, description: '' };
    f.description =
      f.part === '外壁' && f.location === '北側'
        ? '外壁のひび割れ(幅0.5mm超)と塗装の劣化が見られます。雨水の浸入により躯体の劣化が進むおそれがあるため、早期の補修を推奨します。'
        : DESC[f.severity];
    findings.push(f);
    if (f.severity !== 'ok') pushLifecycle(p, f);
  }
  activities.push({
    id: aid(), propertyId: p.id, date: '2026-10-28', type: 'オーナー連絡', actor: p.staff, channel: 'LINE',
    text: '外壁北側の見積内容について質問あり。足場共用による減額案を11月中に回答予定。', ownerVisible: true,
  });
})();

// --- その他の物件 ---
for (let n = 2; n <= 48; n++) {
  const area = pick(AREAS);
  const town = pick(area.towns);
  const [sn, sk] = pick(SURNAMES);
  const [gn, gk] = pick(GIVEN);
  const age = Math.round(between(4, 38));
  const structure = pick(['木造', '木造', '軽量鉄骨造', '軽量鉄骨造', 'RC造'] as const);
  const floors = structure === 'RC造' ? Math.round(between(3, 5)) : Math.round(between(2, 3));
  const units = floors * Math.round(between(3, 8));
  const tail = pick(NAME_TAIL);
  const p: Property = {
    id: `P-${pad(n, 4)}`,
    name: `${pick(NAME_HEAD)}${tail}${town.slice(0, 3)}`,
    pref: area.pref,
    city: area.city,
    address: `${area.pref}${area.city}${town}${Math.ceil(between(0, 5))}-${Math.ceil(between(0, 30))}-${Math.ceil(between(0, 20))}`,
    branch: area.branch,
    owner: `${sn} ${gn}`,
    ownerKana: `${sk} ${gk}`,
    staff: pick(STAFF),
    builtYear: 2026 - age,
    age,
    structure,
    floors,
    units,
    scores: { 外壁: 0, 屋根: 0, 防水: 0, 構造: 0, 設備: 0 },
    overall: 0,
    site: makeSite(rand() < 0.4),
    lastInspection: '',
    nextInspection: '',
    notify: { mail: true, line: rand() < 0.55, push: rand() < 0.3 },
  };

  // 過去の修繕(築年数が進むほど多い)
  const repaired = new Set<Part>();
  const repairCount = age < 10 ? 0 : Math.min(4, Math.floor(between(0, age / 8 + 1)));
  for (let k = 0; k < repairCount; k++) {
    const part = pick(PARTS);
    const t = TEMPLATES[part];
    const yearsAgo = between(0.5, Math.min(9, age - 6));
    const date = addDays(TODAY, -Math.round(yearsAgo * 365));
    addRepair(p, date, part, `${part}(${pick(t.locations)})`, pick(t.work), Math.round(between(t.cost[0], t.cost[1])) * 10000);
    if (yearsAgo < 5) repaired.add(part);
  }

  for (const part of PARTS) {
    const wear = part === '構造' ? 0.055 : part === '設備' ? 0.085 : 0.1;
    let s = 9.6 - age * wear + between(-0.9, 0.9);
    if (repaired.has(part)) s += 1.6;
    p.scores[part] = round1(clamp(s, 3.8, 9.8));
  }
  p.overall = overallOf(p.scores);

  // 点検履歴(2年ごと。評価が低い物件は次回を早める)
  const monthsSince = Math.round(between(2, 20));
  p.lastInspection = addDays(addMonths(TODAY, -monthsSince), Math.round(between(-10, 10)));
  const interval = p.overall < 6.5 ? 1 : 2;
  p.nextInspection = addMonths(p.lastInspection, interval * 12);
  const histCount = Math.min(4, Math.max(1, Math.floor(age / 4)));
  const weak = [...PARTS].sort((a, b) => p.scores[a] - p.scores[b]);
  for (let k = histCount - 1; k >= 0; k--) {
    const date = addMonths(p.lastInspection, -24 * k);
    const score = round1(clamp(p.overall + k * between(0.3, 0.6), 0, 9.8));
    const summary =
      score >= 8.6 ? '特記事項なし' : k === 0 ? `${weak[0]}の劣化、${weak[1]}の劣化` : `${pick(weak.slice(0, 3))}の軽微な劣化`;
    addInspection(p, date, score, summary, k === 0 ? interval : 2);
  }

  // 指摘事項
  for (const part of PARTS) {
    const s = p.scores[part];
    if (s >= 7.4) continue;
    const severity: Severity = s < 6.1 ? 'urgent' : 'watch';
    const t = TEMPLATES[part];
    const count = severity === 'urgent' && rand() < 0.35 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const location = pick(t.locations);
      const status: FindingStatus =
        severity === 'urgent'
          ? pick(['未対応', '未対応', '見積中', '提案済', '提案済', '承認済', '工事中'] as const)
          : pick(['未対応', '未対応', '未対応', '見積中', '提案済'] as const);
      const f: Finding = {
        id: fid(),
        propertyId: p.id,
        part,
        location,
        severity,
        title: pick(t.titles),
        description: DESC[severity],
        foundDate: p.lastInspection,
        dueBy: addMonths(p.lastInspection, severity === 'urgent' ? Math.round(between(8, 20)) : Math.round(between(30, 54))).slice(0, 7),
        estCost: Math.round(between(t.cost[0], t.cost[1]) * (0.6 + units / 30)) * 10000,
        status,
        statusDate: p.lastInspection,
        pin: pinFor(p.site, location),
        photos: Math.round(between(2, 8)),
        memo: '',
      };
      findings.push(f);
      pushLifecycle(p, f);
    }
  }
  properties.push(p);
}

activities.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
inspections.sort((a, b) => (a.date < b.date ? 1 : -1));
repairs.sort((a, b) => (a.date < b.date ? 1 : -1));

// ---------- queries ----------

export const propertyById = new Map(properties.map((p) => [p.id, p]));

export const SEVERITY_LABEL: Record<Severity, string> = {
  urgent: '要対応(早急)',
  watch: '要対応(経過観察)',
  ok: '問題なし',
};

export function ratingLabel(score: number): string {
  if (score >= 8) return '優良';
  if (score >= 7) return '良好';
  if (score >= 6) return '注意';
  return '要改善';
}

export function findingsOf(id: string) {
  return findings.filter((f) => f.propertyId === id);
}
export function inspectionsOf(id: string) {
  return inspections.filter((i) => i.propertyId === id);
}
export function repairsOf(id: string) {
  return repairs.filter((r) => r.propertyId === id);
}
export function activitiesOf(id: string) {
  return activities.filter((a) => a.propertyId === id);
}

/** 同じ構造・築年数±5年の物件の部位別平均(比較対象が3棟未満なら全物件平均) */
export function peerAverage(p: Property): { scores: Record<Part, number>; count: number; label: string } {
  let peers = properties.filter((q) => q.id !== p.id && q.structure === p.structure && Math.abs(q.age - p.age) <= 5);
  let label = `${p.structure}・築${Math.max(0, p.age - 5)}〜${p.age + 5}年`;
  if (peers.length < 3) {
    peers = properties.filter((q) => q.id !== p.id && Math.abs(q.age - p.age) <= 5);
    label = `築${Math.max(0, p.age - 5)}〜${p.age + 5}年`;
  }
  const scores = {} as Record<Part, number>;
  for (const part of PARTS) scores[part] = round1(peers.reduce((s, q) => s + q.scores[part], 0) / peers.length);
  return { scores, count: peers.length, label };
}

export function fmtDate(iso: string): string {
  return iso.replaceAll('-', '/');
}
export function fmtYm(ym: string | null): string {
  if (!ym) return '—';
  const [y, m] = ym.split('-');
  return `${y}年${Number(m)}月`;
}
export function fmtYen(n: number): string {
  return `${n.toLocaleString()}円`;
}
export function fmtMan(n: number): string {
  return `${Math.round(n / 10000).toLocaleString()}万円`;
}

/** 検索用の正規化(全角半角・大文字小文字・空白の揺れを吸収) */
export function norm(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}
export function matches(q: string, ...fields: string[]): boolean {
  const terms = q.normalize('NFKC').toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const hay = norm(fields.join(' '));
  return terms.every((t) => hay.includes(t));
}
