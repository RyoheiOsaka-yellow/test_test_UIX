// 部品ライブラリ。実在のグラフィックスカードで使われる部品を調査して収録。
// ok:true = 型番・定格を出典で確認 / ok:false = 未確認（記憶ベースや代替カタログ品）
// フットプリントは 0.5mm グリッド用に簡略化した概念モデル（実ピン配置とは異なる）。

const P = (n, x, y, w, h, o) => ({ n, x, y, w, h, ...o });

function fp2(dx, pw, ph) { return [P('1', -dx, 0, pw, ph), P('2', dx, 0, pw, ph)]; }
function fpBGA(w, h) {
  const cols = Math.floor(w - 2), rows = Math.floor(h - 2), pads = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    pads.push(P(`${r}_${c}`, c - (cols - 1) / 2, r - (rows - 1) / 2, 0.4, 0.4, { round: true, ring: Math.min(r, c, rows - 1 - r, cols - 1 - c) }));
  }
  return pads;
}
function fpQFN(per, names) {
  const o = Math.floor(per / 2), half = o * 0.5 + 1, pads = [];   // 角のパッド同士が 0.5mm 空く
  let k = 0;
  const nm = () => names[k] || 'NC' + (k + 1);
  for (let i = 0; i < per; i++, k++) pads.push(P(nm(), -half, (i - o) * 0.5, 0.7, 0.3));
  for (let i = 0; i < per; i++, k++) pads.push(P(nm(), (i - o) * 0.5, half, 0.3, 0.7));
  for (let i = 0; i < per; i++, k++) pads.push(P(nm(), half, (o - i) * 0.5, 0.7, 0.3));
  for (let i = 0; i < per; i++, k++) pads.push(P(nm(), (o - i) * 0.5, -half, 0.3, 0.7));
  return pads;
}
function fpSO(per, names, span) {
  const pads = [];
  for (let i = 0; i < per; i++) pads.push(P(names[i], -span / 2, (i - (per - 1) / 2) * 1.0, 1.0, 0.5));
  for (let i = 0; i < per; i++) pads.push(P(names[per + i], span / 2, ((per - 1) / 2 - i) * 1.0, 1.0, 0.5));
  return pads;
}
function fpDrMOS(w, h) {
  const t = h >= 6 ? 2 : 1.5;
  return [
    P('PWM', -2, -t, 0.5, 0.4), P('VCC', -2, -t + 1, 0.5, 0.4), P('AGND', -2, t - 1, 0.5, 0.4), P('TMON', -2, t, 0.5, 0.4),
    P('VIN', 0.5, -t, 3, 1), P('GND', 0.5, 0, 3, 1), P('SW', 0.5, t, 3, 1),
  ];
}
function fpRow(n, pitch, names, pw, ph, o) { return names.slice(0, n).map((nm, i) => P(nm, (i - (n - 1) / 2) * pitch, 0, pw, ph, o)); }
function fpGrid(cols, rows, pitch, names, pw, ph, o) {
  const pads = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const nm = names[r * cols + c]; if (!nm) continue;
    pads.push(P(nm, (c - (cols - 1) / 2) * pitch, (r - (rows - 1) / 2) * pitch, pw, ph, o));
  }
  return pads;
}
const seq = (n, f) => Array.from({ length: n }, (_, i) => f(i + 1));

const CTL_NAMES = [...seq(24, i => 'PWM' + i), 'SDA', 'SCL', 'VSEN', 'VRTN', 'EN', 'PG', 'VCC', 'GND', 'IMON', 'TSEN'];
const CTL8_NAMES = [...seq(8, i => 'PWM' + i), 'SDA', 'SCL', 'VSEN', 'VRTN', 'EN', 'PG', 'VCC', 'GND'];
const MCU_NAMES = ['SDA', 'SCL', 'VCC', 'GND', ...seq(3, i => 'FAN_PWM' + i), ...seq(3, i => 'FAN_TACH' + i), 'RGB', 'S1', 'S2', 'S3', 'S4', 'ALERT'];

const TH = { th: true, round: true };
const pcieNames = () => seq(82, i => 'A' + i);

export const CATS = [
  ['gpu', 'GPU パッケージ'], ['vram', 'グラフィックスメモリ'], ['ctl', 'PWM コントローラ'],
  ['drmos', 'パワーステージ (DrMOS)'], ['ind', 'インダクタ'], ['cap', 'コンデンサ'],
  ['pin', '電源入力'], ['io', '映像出力・エッジ'], ['misc', '制御・補助 IC'],
];

const RAW = [
  // ── GPU ──
  { id: 'gb202', cat: 'gpu', family: 'gpu', ref: 'U', name: 'NVIDIA GB202', mfr: 'NVIDIA', pn: 'GB202 (RTX 5090)', pkg: 'FCBGA 63×56mm', w: 63, h: 56, spec: 'ダイ 761.6mm² / 575W', val: 575, seen: 'RTX 5090', ok: true, note: 'パッケージ寸法は報道間で 63×56 と 63×65 の食い違いあり。ボール数は非公開。' },
  { id: 'ad102', cat: 'gpu', family: 'gpu', ref: 'U', name: 'NVIDIA AD102', mfr: 'NVIDIA', pn: 'AD102 (RTX 4090)', pkg: 'FCBGA 51×51mm', w: 51, h: 51, spec: 'ダイ 609mm² / 450W', val: 450, seen: 'RTX 4090', ok: false, note: 'パッケージ寸法はリーク由来。' },
  { id: 'ad103', cat: 'gpu', family: 'gpu', ref: 'U', name: 'NVIDIA AD103', mfr: 'NVIDIA', pn: 'AD103 (RTX 4080)', pkg: 'FCBGA 約40×40mm', w: 40, h: 40, spec: 'ダイ 379mm² / 320W', val: 320, seen: 'RTX 4080', ok: false },
  { id: 'navi31', cat: 'gpu', family: 'gpu', ref: 'U', name: 'AMD Navi 31', mfr: 'AMD', pn: 'Navi 31 (RX 7900 XTX)', pkg: 'FCBGA 55×47.5mm', w: 55, h: 47, spec: 'GCD+MCD×6 / 355W', val: 355, seen: 'RX 7900 XTX', ok: true },
  { id: 'navi32', cat: 'gpu', family: 'gpu', ref: 'U', name: 'AMD Navi 32', mfr: 'AMD', pn: 'Navi 32 (RX 7800 XT)', pkg: 'FCBGA 40×40mm', w: 40, h: 40, spec: '263W', val: 263, seen: 'RX 7800 XT', ok: true },
  { id: 'navi44', cat: 'gpu', family: 'gpu', ref: 'U', name: 'AMD Navi 44', mfr: 'AMD', pn: 'Navi 44 (RX 9060 XT)', pkg: 'FCBGA 29×29mm', w: 29, h: 29, spec: '約160W（推定）', val: 160, seen: 'RX 9060 XT', ok: false },

  // ── メモリ（全規格 14×12mm FBGA）──
  { id: 'k4vaf32', cat: 'vram', family: 'vram', name: 'GDDR7 16Gb 32Gbps', mfr: 'Samsung', pn: 'K4VAF325ZC-SC32', pkg: '266-ball FBGA 14×12', spec: '2GB / 32Gbps', val: 2, seen: 'RTX 5080', ok: true },
  { id: 'k4vaf28', cat: 'vram', family: 'vram', name: 'GDDR7 16Gb 28Gbps', mfr: 'Samsung', pn: 'K4VAF325ZC-SC28', pkg: '266-ball FBGA 14×12', spec: '2GB / 28Gbps', val: 2, seen: 'RTX 5070 Ti', ok: true },
  { id: 'mt68a', cat: 'vram', family: 'vram', name: 'GDDR7 16Gb 32Gbps', mfr: 'Micron', pn: 'MT68A512M32DF-32:A', pkg: '266-ball FBGA 14×12', spec: '2GB / 32Gbps', val: 2, seen: '搭載例は未確認', ok: true },
  { id: 'mt61k21', cat: 'vram', family: 'vram', name: 'GDDR6X 16Gb 21Gbps', mfr: 'Micron', pn: 'MT61K512M32KPA-21:U', pkg: '180-ball FBGA 14×12', spec: '2GB / 21Gbps', val: 2, seen: 'RTX 4090', ok: true },
  { id: 'h56g42', cat: 'vram', family: 'vram', name: 'GDDR6 16Gb 20Gbps', mfr: 'SK hynix', pn: 'H56G42AS8DX-014', pkg: '180-ball FBGA 14×12', spec: '2GB / 20Gbps', val: 2, seen: 'RX 7900 XT, RX 9070', ok: true },
  { id: 'k4zaf', cat: 'vram', family: 'vram', name: 'GDDR6 16Gb 20Gbps', mfr: 'Samsung', pn: 'K4ZAF325BC-SC20', pkg: '180-ball FBGA 14×12', spec: '2GB / 20Gbps', val: 2, seen: 'Arc B580', ok: true },

  // ── PWM コントローラ ──
  { id: 'mp29816', cat: 'ctl', family: 'ctl', name: '16相デュアルループ', mfr: 'MPS', pn: 'MP29816', pkg: 'TQFN-56 7×7', spec: '最大16相', val: 16, seen: 'RTX 5080 / 5090 各社', ok: true },
  { id: 'mp2891', cat: 'ctl', family: 'ctl', name: '16+8相デュアルレール', mfr: 'MPS', pn: 'MP2891', pkg: 'QFN-56 7×7', spec: '最大16+8相', val: 24, seen: 'RTX 4090 FE / Strix', ok: true },
  { id: 'xdpe132', cat: 'ctl', family: 'ctl', name: '16相デジタル', mfr: 'Infineon', pn: 'XDPE132G5C', pkg: 'QFN-48', spec: '最大16相', val: 16, seen: 'RTX 30 世代', ok: false },
  { id: 'mp2868a', cat: 'ctl', family: 'ctl8', name: '8相コントローラ', mfr: 'MPS', pn: 'MP2868A', pkg: 'QFN-52 6×6', spec: '最大8相', val: 8, seen: 'RX 9070 XT', ok: true },
  { id: 'up9512r', cat: 'ctl', family: 'ctl8', name: '8相コントローラ', mfr: 'uPI', pn: 'uP9512R', pkg: 'QFN (5×5 推定)', spec: '最大8相', val: 8, seen: 'RTX 4090 Vulcan / 5090 TUF メモリ', ok: true },
  { id: 'up9529q', cat: 'ctl', family: 'ctl8', name: '小規模レール用', mfr: 'uPI', pn: 'uP9529Q', pkg: 'QFN', spec: '2〜3相', val: 3, seen: 'RTX 4080 / 5080 メモリ', ok: true },

  // ── DrMOS ──
  { id: 'mp86957', cat: 'drmos', family: 'drmos', name: '70A パワーステージ', mfr: 'MPS', pn: 'MP86957', pkg: 'LGA-41 5×6', w: 5, h: 6, spec: '70A 連続', val: 70, seen: 'RTX 4090 Suprim X', ok: true },
  { id: 'mp87997', cat: 'drmos', family: 'drmos', name: '70A パワーステージ', mfr: 'MPS', pn: 'MP87997', pkg: 'LGA 5×6（推定）', w: 5, h: 6, spec: '70A', val: 70, seen: 'RX 7900 XTX', ok: true },
  { id: 'mp87993', cat: 'drmos', family: 'drmos', name: '50A パワーステージ', mfr: 'MPS', pn: 'MP87993', pkg: 'LGA 5×6（推定）', w: 5, h: 6, spec: '50A', val: 50, seen: 'RTX 5080 / 5090 / RX 9070 XT', ok: true },
  { id: 'fdmf3170', cat: 'drmos', family: 'drmos', name: '70A スマートパワーステージ', mfr: 'onsemi', pn: 'FDMF3170', pkg: 'PQFN 5×6', w: 5, h: 6, spec: '70A', val: 70, seen: 'RTX 4090 Strix OC', ok: true },
  { id: 'tda21490', cat: 'drmos', family: 'drmos', name: '90A OptiMOS パワーステージ', mfr: 'Infineon', pn: 'TDA21490', pkg: 'PQFN 5×6', w: 5, h: 6, spec: '90A ピーク / 70A DC', val: 70, seen: '搭載例は未確認', ok: true },
  { id: 'sic654a', cat: 'drmos', family: 'drmos', name: '50A DrMOS', mfr: 'Vishay', pn: 'SiC654A', pkg: 'MLP 5×5', w: 5, h: 5, spec: '50A', val: 50, seen: 'RTX 5090 TUF / 5080 Astral', ok: true },
  { id: 'aoz5311', cat: 'drmos', family: 'drmos', name: '55A DrMOS', mfr: 'Alpha & Omega', pn: 'AOZ5311NQI-03', pkg: 'QFN-31L 5×5', w: 5, h: 5, spec: '55A', val: 55, seen: 'RTX 4090 Vulcan', ok: true },
  { id: 'ncp302150', cat: 'drmos', family: 'drmos', name: '50A DrMOS', mfr: 'onsemi', pn: 'NCP302150', pkg: 'PQFN-31 5×5', w: 5, h: 5, spec: '50A 平均', val: 50, seen: 'RTX 4070 Ti', ok: true },

  // ── インダクタ ──
  { id: 'l_r15', cat: 'ind', family: 'ind', ref: 'L', name: 'モールドチョーク R15', mfr: '各社カスタム', pn: '"R15" 刻印品', pkg: '10×10mm 級', w: 10, h: 10, spec: '150nH', seen: 'RX 7900 XTX ほか', ok: false, note: '実装品はカスタム品で型番非公開。値のみ確認。' },
  { id: 'l_r22', cat: 'ind', family: 'ind', ref: 'L', name: 'モールドチョーク R22', mfr: '各社カスタム', pn: '"R22" 刻印品', pkg: '10×10mm 級', w: 10, h: 10, spec: '220nH', seen: 'NVIDIA FE 系', ok: false },
  { id: 'ihlp5050', cat: 'ind', family: 'ind', ref: 'L', name: 'IHLP-5050 150nH', mfr: 'Vishay', pn: 'IHLP5050FDER-R15M01', pkg: '12.9×13.2mm', w: 13, h: 13, spec: '150nH / 55A', seen: 'カタログ代替品', ok: true },
  { id: 'tpi9664', cat: 'ind', family: 'ind', ref: 'L', name: 'TPI 150nH', mfr: 'KEMET', pn: 'TPI9664A0L150R', pkg: '9.6×6.4mm', w: 10, h: 7, spec: '150nH / 66A', seen: 'カタログ代替品', ok: true },
  { id: 'amsla7050', cat: 'ind', family: 'ind', ref: 'L', name: 'AMSLA 150nH', mfr: 'Abracon', pn: 'AMSLA-7050-150NM-T', pkg: '7×7mm', w: 7, h: 7, spec: '150nH / 45A', seen: 'カタログ代替品', ok: true },
  { id: 'l_in', cat: 'ind', family: 'indin', ref: 'L', name: '入力フィルタチョーク', mfr: '各社カスタム', pn: '190nH 入力用', pkg: '10×10mm 級', w: 10, h: 10, spec: '190nH', seen: 'RX 7900 XTX', ok: true },

  // ── コンデンサ ──
  { id: 'c_tpe470', cat: 'cap', family: 'bulk', ref: 'C', name: 'POSCAP 470µF 2.5V', mfr: 'Panasonic', pn: '2R5TPE470M9', pkg: 'D ケース 7.3×4.3', w: 7.5, h: 4.5, spec: '470µF / 2.5V', seen: 'Vcore 出力', ok: false },
  { id: 'c_t520', cat: 'cap', family: 'bulk', ref: 'C', name: 'タンタルポリマー 330µF', mfr: 'KEMET', pn: 'T520 シリーズ', pkg: '7.3×4.3', w: 7.5, h: 4.5, spec: '330µF / 2.5V', seen: 'RTX 5090 FE は全タンタル', ok: false },
  { id: 'c_gx470', cat: 'cap', family: 'bulk', ref: 'C', name: 'SP-Cap 470µF 2V', mfr: 'Panasonic', pn: 'EEFGX0D471R', pkg: '7.3×4.3', w: 7.5, h: 4.5, spec: '470µF / 2V', seen: 'Vcore 出力', ok: false },
  { id: 'c_can270', cat: 'cap', family: 'bulkin', ref: 'C', name: '導電性高分子 270µF 16V', mfr: 'Nichicon', pn: 'FPCAP 16V 270µF', pkg: 'φ6.3 缶', w: 6.5, h: 6.5, spec: '270µF / 16V', seen: '12V 入力バルク', ok: false },
  { id: 'c_0402', cat: 'cap', family: 'mlcc', ref: 'C', name: 'MLCC 0402 1µF', mfr: '汎用', pn: '0402 X6S 1µF', pkg: '0402 (1.0×0.5)', w: 1.5, h: 0.6, spec: '1µF / 4V', seen: 'GPU 裏・メモリ', ok: false },
  { id: 'c_0603', cat: 'cap', family: 'mlcc', ref: 'C', name: 'MLCC 0603 10µF', mfr: '汎用', pn: '0603 X5R 10µF', pkg: '0603 (1.6×0.8)', w: 2.2, h: 0.9, spec: '10µF / 6.3V', seen: 'GPU 裏・メモリ', ok: false },
  { id: 'c_0805', cat: 'cap', family: 'mlcc', ref: 'C', name: 'MLCC 0805 22µF', mfr: '汎用', pn: '0805 X5R 22µF', pkg: '0805 (2.0×1.25)', w: 2.6, h: 1.3, spec: '22µF / 6.3V', seen: 'Vcore 出力バンク', ok: false },
  { id: 'c_0805hv', cat: 'cap', family: 'mlcc', ref: 'C', name: 'MLCC 0805 10µF 25V', mfr: '汎用', pn: '0805 X7R 10µF 25V', pkg: '0805 (2.0×1.25)', w: 2.6, h: 1.3, spec: '10µF / 25V', seen: 'DrMOS 12V 入力', ok: false },

  // ── 電源入力 ──
  { id: 'j_12v2x6', cat: 'pin', family: 'pwrconn', ref: 'J', name: '12V-2x6 ヘッダ', mfr: 'Molex', pn: 'Micro-Fit+ 2191161161', pkg: '16極 (12+4) 3.0mm ピッチ', w: 19, h: 10, spec: '600W / 9.5A×6', val: 600, seen: 'RTX 50 / 40 系', ok: true },
  { id: 'j_12vhpwr', cat: 'pin', family: 'pwrconn', ref: 'J', name: '12VHPWR ヘッダ', mfr: 'Amphenol', pn: '10160920-1240100LF', pkg: '16極 (12+4) 3.0mm ピッチ', w: 19, h: 10, spec: '600W / 9.5A×6', val: 600, seen: 'RTX 40 系', ok: true },
  { id: 'j_8pin', cat: 'pin', family: 'pwrconn8', ref: 'J', name: 'PCIe 8ピン (6+2)', mfr: 'Molex', pn: 'Mini-Fit Jr. 2×4', pkg: '4.2mm ピッチ', w: 18, h: 13, spec: '150W', val: 150, seen: 'Radeon / Arc', ok: false },
  { id: 'r_shunt', cat: 'pin', family: 'shunt', ref: 'R', name: 'シャント抵抗 2512', mfr: 'Vishay', pn: 'WSL2512 系 2mΩ', pkg: '2512 (6.4×3.2)', w: 6.5, h: 3.5, spec: '2mΩ', seen: '12V 各レール', ok: false },
  { id: 'f_2410', cat: 'pin', family: 'fuse', ref: 'F', name: '入力ヒューズ 20A', mfr: 'Littelfuse', pn: '0456 系', pkg: '2410', w: 6.5, h: 3, spec: '20A', seen: '一部カスタム基板', ok: false },
  { id: 'us5650q', cat: 'pin', family: 'mon', name: '12V レールモニタ', mfr: 'uPI', pn: 'uS5650Q', pkg: 'QFN', spec: '4 レール監視', seen: 'RTX 4090 FE', ok: true },
  { id: 'ncp45491', cat: 'pin', family: 'mon', name: '12V レールモニタ', mfr: 'onsemi', pn: 'NCP45491', pkg: 'QFN', spec: '4 レール監視', seen: 'RTX 4070 Super', ok: true },
  { id: 'ina3221', cat: 'pin', family: 'mon', name: '3ch 電流モニタ', mfr: 'TI', pn: 'INA3221', pkg: 'VQFN-16 4×4', spec: '3ch / 26V / I²C', seen: '旧世代で確認', ok: false },

  // ── 映像出力・エッジ ──
  { id: 'j_dp', cat: 'io', family: 'dp', ref: 'J', name: 'DisplayPort レセプタクル', mfr: '汎用', pn: 'DP 2.1 フルサイズ', pkg: '20 ピン', w: 18, h: 9, spec: '20 ピン', seen: '標準 3 基', ok: false },
  { id: 'j_hdmi', cat: 'io', family: 'hdmi', ref: 'J', name: 'HDMI 2.1 Type A', mfr: '汎用', pn: 'HDMI 2.1 Type A', pkg: '19 ピン', w: 15, h: 11, spec: '19 ピン', seen: '標準 1 基', ok: false },
  { id: 'ps8419', cat: 'io', family: 'retimer', name: 'HDMI 2.1 リタイマ', mfr: 'Parade', pn: 'PS8419', pkg: 'QFN', spec: 'FRL リタイマ', seen: 'AMD 系（未確認）', ok: false },
  { id: 'pcie_x16', cat: 'io', family: 'pcie', ref: 'J', name: 'PCIe x16 カードエッジ', mfr: '規格', pn: 'PCIe CEM x16', pkg: '82 接点/面 1.0mm ピッチ', w: 85, h: 6, spec: '164 接点 / 板厚 1.57mm', seen: '全カード', ok: true },

  // ── 制御・補助 ──
  { id: 'w25q80', cat: 'misc', family: 'flash', name: 'BIOS SPI フラッシュ', mfr: 'Winbond', pn: 'W25Q80EW', pkg: 'SOIC-8', spec: '8Mbit / 1.8V', seen: '（未確認）', ok: false },
  { id: 'gd25q80', cat: 'misc', family: 'flash', name: 'BIOS SPI フラッシュ', mfr: 'GigaDevice', pn: 'GD25Q80', pkg: 'SOIC-8', spec: '8Mbit', seen: 'AMD 系（未確認）', ok: false },
  { id: 'it8915', cat: 'misc', family: 'mcu', name: 'ファン/RGB コントローラ', mfr: 'ITE', pn: 'IT8915FN', pkg: 'QFN', spec: 'ファン・RGB 制御', seen: 'ASUS（未確認）', ok: false },
  { id: 'nuc126', cat: 'misc', family: 'mcu', name: 'RGB/ファン MCU', mfr: 'Nuvoton', pn: 'NUC126', pkg: 'QFN-48', spec: 'Cortex-M0', seen: 'MSI（未確認）', ok: false },
  { id: 'rt6258', cat: 'misc', family: 'buck', name: '単相降圧 (1.8V/PEX)', mfr: 'Richtek', pn: 'RT6258 級', pkg: 'QFN 3×3', spec: '補助レール', seen: '（未確認）', ok: false },
  { id: 'up1666q', cat: 'misc', family: 'buck', name: '単相降圧', mfr: 'uPI', pn: 'uP1666Q', pkg: 'QFN 3×3', spec: '補助レール', seen: '（未確認）', ok: false },
  { id: 'l_aux', cat: 'misc', family: 'indaux', ref: 'L', name: '補助レール用インダクタ', mfr: '汎用', pn: '4×4 1µH', pkg: '4×4mm', w: 4, h: 4, spec: '1µH', seen: '補助レール', ok: false },
  { id: 'x_27m', cat: 'misc', family: 'xtal', ref: 'Y', name: '水晶振動子 27MHz', mfr: '汎用', pn: '27.000MHz 3225', pkg: '3.2×2.5 4 パッド', w: 3.5, h: 3, spec: '27MHz', seen: '（未確認）', ok: false },
  { id: 'j_fan', cat: 'misc', family: 'fan', ref: 'J', name: 'ファンヘッダ 4 ピン', mfr: '汎用', pn: '4P 2.0mm', pkg: '2.0mm ピッチ', w: 9, h: 4, spec: 'PWM ファン', seen: '全カード', ok: false },
  { id: 'hole_m3', cat: 'misc', family: 'hole', ref: 'H', name: '取り付け穴 M3', mfr: '機構', pn: 'M3 取り付け穴', pkg: 'φ3.2 穴', w: 6, h: 6, spec: 'φ3.2', seen: '全カード', ok: false },
  { id: 'r_0402', cat: 'misc', family: 'res', ref: 'R', name: '抵抗 0402', mfr: '汎用', pn: '0402 1%', pkg: '0402', w: 1.5, h: 0.6, spec: '汎用', seen: '全カード', ok: false },
];

// 部品の高さ (mm)：[値, 出典で確認できたか]。未確認のものはパッケージ種別からの一般的な値。
const HEIGHTS = {
  // メモリ：180/266 ボール FBGA（Samsung GDDR6 データシート、Micron 製品資料）
  k4vaf32: [1.1, false], k4vaf28: [1.1, false], mt68a: [1.1, true], mt61k21: [1.2, true], h56g42: [1.2, false], k4zaf: [1.2, true],
  // パワーステージ：TDA21490 / SiC654A / NCP302150 はパッケージ図面で確認
  mp86957: [1.0, false], mp87997: [1.0, false], mp87993: [1.0, false], fdmf3170: [0.8, false], tda21490: [1.0, true], sic654a: [0.8, true], aoz5311: [0.8, false], ncp302150: [0.8, true],
  mp29816: [0.8, false], mp2891: [1.0, false], xdpe132: [0.9, false], mp2868a: [1.0, false], up9512r: [0.8, false], up9529q: [0.8, false],
  // インダクタ：IHLP5050FD 6.5 / TPI9664 10.0 / AMSLA-7050 5.0 は確認。カスタム品は未確認
  l_r15: [4.5, false], l_r22: [4.5, false], ihlp5050: [6.5, true], tpi9664: [10.0, true], amsla7050: [5.0, true], l_in: [4.5, false], l_aux: [2.0, false],
  // コンデンサ：POSCAP 2.0 / T520 D 3.1 / SP-Cap 1.9 / φ6.3 缶 9.0 は確認（いずれも最大値）
  c_tpe470: [2.0, true], c_t520: [3.1, true], c_gx470: [1.9, true], c_can270: [9.0, true], c_0402: [0.55, false], c_0603: [0.9, false], c_0805: [1.25, false], c_0805hv: [1.25, false],
  // コネクタ：樹脂部の高さのみ確認できたものは未確認扱い
  j_12v2x6: [8.9, false], j_12vhpwr: [8.9, false], j_8pin: [12.8, false], j_dp: [6.65, false], j_hdmi: [6.2, false], j_fan: [6.0, false],
  r_shunt: [0.89, true], f_2410: [3.05, true], ina3221: [0.95, true], us5650q: [0.8, false], ncp45491: [1.0, false],
  ps8419: [0.8, false], w25q80: [1.75, false], gd25q80: [1.75, false], it8915: [0.9, false], nuc126: [0.9, false], rt6258: [0.8, false], up1666q: [0.8, false],
  x_27m: [0.8, false], r_0402: [0.35, false],
};
function build(p) {
  const H = HEIGHTS[p.id]; if (H) { p.ht = H[0]; p.htOk = H[1]; }
  p.ht0 = p.ht; p.htOk0 = !!p.htOk;   // 手入力で上書きしたときに戻せるよう、既定値を控えておく
  const f = p.family;
  if (f === 'gpu') p.pads = fpBGA(p.w, p.h);
  else if (f === 'vram') { p.w = 12; p.h = 14; p.pads = fpBGA(12, 14); }
  else if (f === 'ctl') { p.w = 9.5; p.h = 9.5; p.pads = fpQFN(15, CTL_NAMES); }
  else if (f === 'ctl8') { p.w = 7.5; p.h = 7.5; p.pads = fpQFN(11, CTL8_NAMES); }
  else if (f === 'drmos') p.pads = fpDrMOS(p.w, p.h);
  else if (f === 'ind' || f === 'indin') { const d = Math.floor((p.w / 2 - 1) * 2) / 2; p.pads = fp2(d, 1.5, Math.max(2, p.h - 3)); }
  else if (f === 'indaux') p.pads = fp2(1.5, 0.8, 2.5);
  else if (f === 'bulk') p.pads = fp2(3, 1.2, 2.5);
  else if (f === 'bulkin') p.pads = fp2(2.5, 1.2, 1.5);
  else if (f === 'mlcc' || f === 'res') { const d = p.w > 2 ? 1 : 0.5; p.pads = fp2(d, p.w > 2 ? 0.6 : 0.3, Math.min(1.1, p.h - 0.1)); }
  else if (f === 'shunt' || f === 'fuse') p.pads = fp2(2.5, 1, 2.5);
  else if (f === 'pwrconn') {
    p.th = true;
    p.pads = [...fpGrid(6, 2, 3, [...seq(6, i => 'V' + i), ...seq(6, i => 'G' + i)], 1.2, 1.2, TH).map(q => ({ ...q, y: q.y + 1 })),
      ...fpRow(4, 2, ['S1', 'S2', 'S3', 'S4'], 0.7, 0.7, TH).map(q => ({ ...q, y: -3.5 }))];
  } else if (f === 'pwrconn8') {
    p.th = true;
    p.pads = fpGrid(4, 2, 4, ['V1', 'V2', 'V3', 'S1', 'G1', 'G2', 'G3', 'G4'], 1.6, 1.6, TH);
  } else if (f === 'mon') { p.w = 4.5; p.h = 4.5; p.pads = fpQFN(5, ['IN1P', 'IN1N', 'IN2P', 'IN2N', 'IN3P', 'IN3N', 'SDA', 'SCL', 'VCC', 'GND', 'ALERT']); }
  else if (f === 'dp' || f === 'hdmi') p.pads = fpGrid(10, 2, 1, seq(f === 'dp' ? 20 : 19, i => 'P' + i), 0.5, 1.2).map(q => ({ ...q, y: q.y * 2 + 2 }));
  else if (f === 'retimer') { p.w = 5.5; p.h = 5.5; p.pads = fpQFN(7, [...seq(4, i => 'IN' + i), ...seq(4, i => 'OUT' + i), 'SDA', 'SCL', 'VCC', 'GND']); }
  else if (f === 'pcie') p.pads = fpRow(82, 1, pcieNames(), 0.6, 4).filter((_, i) => i < 8 || i > 10);   // キー溝の位置には端子がない
  else if (f === 'flash') { p.w = 5; p.h = 5; p.pads = fpSO(4, ['CS', 'MISO', 'WP', 'GND', 'MOSI', 'CLK', 'HOLD', 'VCC'], 5); }
  else if (f === 'mcu') { p.w = 6.5; p.h = 6.5; p.pads = fpQFN(9, MCU_NAMES); }
  else if (f === 'buck') { p.w = 4; p.h = 4; p.pads = fpQFN(3, ['VIN', 'EN', 'PG', 'SW', 'SW2', 'GND', 'FB', 'VCC']); }
  else if (f === 'xtal') p.pads = fpGrid(2, 2, 2, ['X1', 'GND', 'GND2', 'X2'], 0.9, 0.8);
  else if (f === 'hole') { p.th = true; p.pads = [P('H', 0, 0, 3.2, 3.2, TH)]; }
  else if (f === 'fan') { p.th = true; p.pads = fpRow(4, 2, ['GND', 'V12', 'TACH', 'PWM'], 1, 1, TH); }
  p.ref = p.ref || 'U';
  p.padMap = Object.fromEntries(p.pads.map(q => [q.n, q]));
  return p;
}

export const PARTS = RAW.map(build);
export const PART = Object.fromEntries(PARTS.map(p => [p.id, p]));
export const alternatives = part => PARTS.filter(p => p.family === part.family);
