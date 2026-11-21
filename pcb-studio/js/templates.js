// グラフィックスカード基板のパラメトリック生成（リファレンス配置＋ネットリスト）
import { Board, padWorld, snap } from './core.js';
import { PART } from './library.js';

export const PRESETS = {
  flagship: { label: 'フラッグシップ（RTX 5090 級）', gpu: 'gb202', vram: 'k4vaf28', nVram: 16, vcore: 24, vmem: 7, ctl: 'mp29816', memctl: 'up9512r', drmos: 'sic654a', ind: 'l_r15', bulk: 'c_t520', conn: 'j_12v2x6', nConn: 1 },
  highend: { label: 'ハイエンド（RTX 4090 級）', gpu: 'ad102', vram: 'mt61k21', nVram: 12, vcore: 20, vmem: 3, ctl: 'mp2891', memctl: 'up9529q', drmos: 'mp86957', ind: 'l_r22', bulk: 'c_tpe470', conn: 'j_12vhpwr', nConn: 1 },
  radeon: { label: 'Radeon ハイエンド（RX 7900 XTX 級）', gpu: 'navi31', vram: 'h56g42', nVram: 12, vcore: 16, vmem: 3, ctl: 'mp2891', memctl: 'mp2868a', drmos: 'mp87997', ind: 'l_r15', bulk: 'c_gx470', conn: 'j_8pin', nConn: 2 },
  mid: { label: 'ミドルレンジ（RX 7800 XT 級）', gpu: 'navi32', vram: 'k4zaf', nVram: 8, vcore: 10, vmem: 2, ctl: 'mp29816', memctl: 'up9529q', drmos: 'mp87993', ind: 'tpi9664', bulk: 'c_gx470', conn: 'j_8pin', nConn: 2 },
  entry: { label: 'エントリー（RX 9060 XT 級）', gpu: 'navi44', vram: 'k4zaf', nVram: 4, vcore: 6, vmem: 2, ctl: 'mp29816', memctl: 'up9529q', drmos: 'ncp302150', ind: 'amsla7050', bulk: 'c_gx470', conn: 'j_8pin', nConn: 1 },
};

const GROUPS = [
  ['grp_gpu', 'GPU コア', 'core', '#f2a65a'],
  ['grp_mem', 'メモリ', 'core', '#5ec8f2'],
  ['grp_vcore', 'Vcore VRM', 'power', '#f26d6d'],
  ['grp_vmem', 'Vmem VRM', 'power', '#d98cf0'],
  ['grp_pin', '12V 入力', 'power', '#f0d264'],
  ['grp_aux', '補助レール', 'power', '#a3d977'],
  ['grp_ctrl', '制御・監視', 'analog', '#7fe0c3'],
  ['grp_disp', '映像出力', 'interface', '#8aa4ff'],
  ['grp_pcie', 'PCIe エッジ', 'fixed', '#c9ced6'],
  ['grp_misc', 'その他', 'misc', '#9aa3ad'],
];
export function addGroups(b) { for (const g of GROUPS) b.ensureGroup(...g); }

export function emptyBoard(w = 180, h = 100) {
  const b = new Board(w, h); addGroups(b); b.meta = { kind: 'empty' }; return b;
}

export function generateGPU(prm) {
  const gpuP = PART[prm.gpu], vramP = PART[prm.vram], indP = PART[prm.ind], dmP = PART[prm.drmos];
  const gw = gpuP.w, gh = gpuP.h;
  const H = 112;
  const gy = snap(Math.max(gh / 2 + 22, 50)), gx = snap(64 + gw / 2);
  const x0 = gx + gw / 2 + 20;                       // 右メモリ列の外側
  const pitchY = Math.max(indP.h, 6) + 1.5;
  const rows = Math.max(1, Math.floor((H - 26) / pitchY));
  const cols = Math.ceil(prm.vcore / rows);
  const colW = indP.w + 20;
  const stripW = 30 + 20 * (prm.nConn - 1);
  const W = snap(Math.max(x0 + 8 + cols * colW + stripW, 190));
  const b = new Board(W, H);
  addGroups(b);
  b.meta = { kind: 'gpu', prm: { ...prm } };

  const put = (id, x, y, group, o = {}) => b.add(PART[id], x, y, { group, ...o });
  // 大電流・多ピンのレールは内層プレーン、小電流のバイアス系（+5V, +3V3, +PEX）は配線で引く
  const PLANES = new Set(['GND', 'VCORE', 'VMEM', '+12V', '+12V_IN', '+1V8']);
  const pl = (c, pad, net) => b.connect(c, pad, net, PLANES.has(net) ? 'plane' : 'power');
  const two = (c, n1, n2) => { pl(c, '1', n1); pl(c, '2', n2); };
  const wp = (c, name) => padWorld(c, c.part.padMap[name]);

  // ── GPU ──
  const gpu = put(prm.gpu, gx, gy, 'grp_gpu', { fixed: true });
  const used = new Set();
  const sidePads = { top: [], bottom: [], left: [], right: [] };
  for (const p of gpuP.pads) {
    if (p.ring > 2) continue;
    const ax = p.x / (gw / 2), ay = p.y / (gh / 2);
    const side = Math.abs(ay) > Math.abs(ax) ? (ay < 0 ? 'top' : 'bottom') : (ax < 0 ? 'left' : 'right');
    sidePads[side].push(p);
  }
  // GPU の指定辺から、相手ピンの並び順に合わせてボールを割り当てる（交差を減らす）
  function attach(side, dests, cls) {
    const horiz = side === 'top' || side === 'bottom';
    const al = q => horiz ? q.x : q.y;
    const c = dests.reduce((s, d) => s + al(d.pos), 0) / dests.length;
    const free = sidePads[side].filter(p => !used.has(p.n))
      .map(p => [p, p.ring * 2.5 + Math.abs((horiz ? gx + p.x : gy + p.y) - c)]).sort((a, b2) => a[1] - b2[1])
      .slice(0, dests.length).map(a => a[0]).sort((a, b2) => (horiz ? a.x - b2.x : a.y - b2.y));
    dests.sort((a, b2) => al(a.pos) - al(b2.pos));
    dests.forEach((d, i) => {
      const p = free[i]; if (!p) return;
      used.add(p.n);
      b.connect(gpu, p.n, d.net, cls); b.connect(d.c, d.pad, d.net, cls);
    });
  }

  // ── メモリ ──
  const capH = Math.floor(gw / 12.5), capV = Math.floor(gh / 12.5);
  const plan = [['top', capH], ['right', capV], ['left', capV], ['bottom', capH]];
  let left = prm.nVram, k = 0;
  const vrams = [];
  for (const [side, cap] of plan) {
    const n = Math.min(cap, left); left -= n;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 13;
      const horiz = side === 'top' || side === 'bottom';
      const sgn = side === 'top' || side === 'left' ? -1 : 1;
      const x = horiz ? gx + off : gx + sgn * (gw / 2 + 10), y = horiz ? gy + sgn * (gh / 2 + 10) : gy + off;
      const m = put(prm.vram, x, y, 'grp_mem', { rot: horiz ? 0 : 90, near: gpu.id, nearR: Math.max(gw, gh) / 2 + 12 });
      vrams.push(m);
      const all = vramP.pads.map(p => ({ p, pos: padWorld(m, p) }));
      const dist = q => horiz ? Math.abs(q.pos.y - gy) : Math.abs(q.pos.x - gx);
      const dmin = Math.min(...all.map(dist));
      const row = all.filter(q => dist(q) < dmin + 0.1).sort((a, c2) => horiz ? a.pos.x - c2.pos.x : a.pos.y - c2.pos.y).slice(1, 9);
      const names = ['DQ0', 'DQ1', 'DQ2', 'DQ3', 'CA0', 'CA1', 'CK', 'WCK'];
      const sig = new Set(row.map(q => q.p.n));
      attach(side, row.map((q, j) => ({ c: m, pad: q.p.n, pos: q.pos, net: `MEM${k}_${names[j]}` })), 'signal');
      for (const p of vramP.pads) if (!sig.has(p.n)) { const [r, c] = p.n.split('_'); pl(m, p.n, (+r + +c) % 2 ? 'VMEM' : 'GND'); }
      // デカップリング：外側に 0603×2、裏面に 0402×4
      for (let j = 0; j < 2; j++) {
        const d = (j - 0.5) * 4;
        const cx = horiz ? x + d : x + sgn * 8.5, cy = horiz ? y + sgn * 8.5 : y + d;
        two(put('c_0603', cx, cy, 'grp_mem', { rot: horiz ? 0 : 90, near: m.id, nearR: 9 }), 'VMEM', 'GND');
      }
      for (let j = 0; j < 4; j++) two(put('c_0402', x + (j % 2 - 0.5) * 4, y + (Math.floor(j / 2) - 0.5) * 4, 'grp_mem', { side: 'B', near: m.id, nearR: 5 }), 'VMEM', 'GND');
      k++;
    }
  }

  // ── 映像出力（左端ブラケット側）──
  const disp = ['j_dp', 'j_dp', 'j_dp', 'j_hdmi'];
  disp.forEach((id, i) => {
    const c = put(id, 6, 13 + i * 21.5, 'grp_disp', { rot: 270, fixed: true });
    const nm = id === 'j_dp' ? `DP${i}` : 'HDMI';
    const sig = ['ML0', 'ML1', 'ML2', 'ML3', 'AUX', 'HPD'];
    const pads = c.part.pads.filter((_, j) => j % 3 === 0).slice(0, 6);
    attach('left', pads.map((p, j) => ({ c, pad: p.n, pos: padWorld(c, p), net: `${nm}_${sig[j]}` })), 'diff');
    for (const p of c.part.pads) if (!c.padNet[p.n]) pl(c, p.n, 'GND');
  });

  // ── PCIe カードエッジ ──
  const xe = snap(Math.max(gx - 4, 62));
  b.tab = { x0: xe - 43.5, x1: xe + 43.5, h: 7 };
  const pe = put('pcie_x16', xe, H + 3.5, 'grp_pcie', { fixed: true });
  const lanes = [];
  for (let i = 0; i < 16; i++) {
    const j = 15 + Math.floor(i * 4.2);   // キー溝より先に割り当てる
    for (const [o, t] of [[0, 'TX'], [2, 'RX']]) { const p = pe.part.padMap['A' + (j + o)]; lanes.push({ c: pe, pad: p.n, pos: padWorld(pe, p), net: `PEX_${t}${i}` }); }
  }
  for (let i = 0; i < 32; i += 8) attach('bottom', lanes.slice(i, i + 8), 'diff');
  attach('bottom', [[4, 'PERST#'], [5, 'REFCLK']].map(([j, net]) => ({ c: pe, pad: pe.part.pads[j].n, pos: padWorld(pe, pe.part.pads[j]), net })), 'signal');
  pe.part.pads.forEach((p, j) => { if (!pe.padNet[p.n]) pl(pe, p.n, j < 2 ? '+12V' : j === 3 ? '+3V3' : 'GND'); });

  // ── Vcore VRM（GPU 右側）──
  const ctl = put(prm.ctl, snap(x0 + 8 + cols * colW / 2), H - 8, 'grp_ctrl');
  const nBulk = Math.min(Math.ceil(prm.vcore / 2), 11);
  for (let i = 0; i < nBulk; i++) {
    two(put(prm.bulk, x0 + 3, 10 + i * (H - 30) / Math.max(1, nBulk - 1), 'grp_vcore', { rot: 90, near: gpu.id, nearR: Math.max(gw, gh) / 2 + 30 }), 'VCORE', 'GND');
  }
  for (let i = 0; i < prm.vcore; i++) {
    const col = Math.floor(i / rows), r = i % rows;
    const xi = snap(x0 + 8 + col * colW + indP.w / 2), y = snap(10 + r * pitchY + pitchY / 2 - 3);
    const L = put(prm.ind, xi, y, 'grp_vcore', { near: gpu.id, nearR: Math.max(gw, gh) / 2 + 40 });
    const D = put(prm.drmos, xi + indP.w / 2 + 5.5, y, 'grp_vcore', { rot: 90 });
    b.connect(D, 'SW', `SW${i + 1}`, 'power'); b.connect(L, '1', `SW${i + 1}`, 'power'); pl(L, '2', 'VCORE');
    b.connect(D, 'PWM', `PWM${i + 1}`, 'signal');
    if (ctl.part.padMap['PWM' + (i + 1)]) b.connect(ctl, 'PWM' + (i + 1), `PWM${i + 1}`, 'signal');
    pl(D, 'VIN', '+12V'); pl(D, 'GND', 'GND'); pl(D, 'AGND', 'GND'); pl(D, 'VCC', '+5V');
    for (let j = 0; j < 2; j++) two(put('c_0805hv', D.x + 6.5, y + (j - 0.5) * 2.5, 'grp_vcore', { near: D.id, nearR: 6 }), '+12V', 'GND');
    for (let j = 0; j < 2; j++) two(put('c_0805', xi, y + (j - 0.5) * 3, 'grp_vcore', { side: 'B', near: L.id, nearR: 5 }), 'VCORE', 'GND');
  }
  pl(ctl, 'VCC', '+3V3'); pl(ctl, 'GND', 'GND');
  attach('right', ['VSEN', 'VRTN'].map(n => ({ c: ctl, pad: n, pos: wp(ctl, n), net: 'VCORE_' + n })), 'signal');
  for (let j = 0; j < 2; j++) two(put('c_0402', ctl.x - 7 , ctl.y + (j - 0.5) * 2, 'grp_ctrl', { near: ctl.id, nearR: 7 }), '+3V3', 'GND');

  // ── Vmem VRM（GPU 左側）──
  const mctl = put(prm.memctl, 24, Math.min(H - 30, 14 + prm.vmem * 9 + 3), 'grp_ctrl');
  for (let i = 0; i < prm.vmem; i++) {
    const y = 12 + i * 9;
    const D = put(prm.drmos, 23, y, 'grp_vmem', { rot: 270 });
    const L = put('amsla7050', 32.5, y, 'grp_vmem', { near: gpu.id, nearR: Math.max(gw, gh) / 2 + 45 });
    b.connect(D, 'SW', `MSW${i + 1}`, 'power'); b.connect(L, '1', `MSW${i + 1}`, 'power'); pl(L, '2', 'VMEM');
    b.connect(D, 'PWM', `MPWM${i + 1}`, 'signal');
    if (mctl.part.padMap['PWM' + (i + 1)]) b.connect(mctl, 'PWM' + (i + 1), `MPWM${i + 1}`, 'signal');
    pl(D, 'VIN', '+12V'); pl(D, 'GND', 'GND'); pl(D, 'AGND', 'GND'); pl(D, 'VCC', '+5V');
    two(put('c_0805hv', 16.5, y, 'grp_vmem', { near: D.id, nearR: 7 }), '+12V', 'GND');
    two(put('c_0805', 39, y, 'grp_vmem', { rot: 90, near: L.id, nearR: 8 }), 'VMEM', 'GND');
  }
  pl(mctl, 'VCC', '+3V3'); pl(mctl, 'GND', 'GND');

  // ── 12V 入力（右端）──
  const sx = W - stripW;
  const conns = [];
  for (let i = 0; i < prm.nConn; i++) {
    const c = put(prm.conn, W - 13 - i * 20, 8.5, 'grp_pin', { fixed: true });
    conns.push(c);
    for (const p of c.part.pads) if (p.n[0] === 'V') pl(c, p.n, '+12V_IN'); else if (p.n[0] === 'G') pl(c, p.n, 'GND');
  }
  for (let i = 0; i < 3; i++) two(put('r_shunt', sx + 6 + i * 9, 22, 'grp_pin', { rot: 90, near: conns[0].id, nearR: 22 }), '+12V_IN', '+12V');
  for (let i = 0; i < 2; i++) two(put('l_in', sx + 8 + i * 13, 34, 'grp_pin', { near: conns[0].id, nearR: 30 }), '+12V_IN', '+12V');
  for (let i = 0; i < 3; i++) two(put('c_can270', sx + 6 + i * 9, 46, 'grp_pin', { near: conns[0].id, nearR: 42 }), '+12V', 'GND');
  const mon = put('us5650q', sx + 8, 56, 'grp_ctrl');
  const mcu = put('it8915', sx + 19, 57, 'grp_ctrl');
  pl(mon, 'VCC', '+3V3'); pl(mon, 'GND', 'GND'); pl(mcu, 'VCC', '+3V3'); pl(mcu, 'GND', 'GND');
  b.connect(mon, 'ALERT', 'PWR_ALERT', 'signal'); b.connect(mcu, 'ALERT', 'PWR_ALERT', 'signal');
  for (const s of ['S1', 'S2', 'S3', 'S4']) if (conns[0].part.padMap[s]) { b.connect(conns[0], s, 'SENSE_' + s, 'signal'); b.connect(mcu, s, 'SENSE_' + s, 'signal'); }
  for (let i = 0; i < 3; i++) {
    const f = put('j_fan', W - 5, 70 + i * 12, 'grp_ctrl', { rot: 90, fixed: true });
    pl(f, 'GND', 'GND'); pl(f, 'V12', '+12V');
    b.connect(f, 'PWM', `FAN${i + 1}_PWM`, 'signal'); b.connect(mcu, `FAN_PWM${i + 1}`, `FAN${i + 1}_PWM`, 'signal');
    b.connect(f, 'TACH', `FAN${i + 1}_TACH`, 'signal'); b.connect(mcu, `FAN_TACH${i + 1}`, `FAN${i + 1}_TACH`, 'signal');
  }
  // I²C バス（GPU・各コントローラ・監視 IC・MCU）
  attach('bottom', ['SDA', 'SCL'].map(n => ({ c: ctl, pad: n, pos: wp(ctl, n), net: 'I2C_' + n })), 'signal');
  for (const c of [mctl, mon, mcu]) for (const n of ['SDA', 'SCL']) b.connect(c, n, 'I2C_' + n, 'signal');

  // ── 補助レール・BIOS・水晶 ──
  [['+1V8', H - 24], ['+PEX', H - 11]].forEach(([rail, y], i) => {
    const u = put(i ? 'up1666q' : 'rt6258', 19, y, 'grp_aux');
    const L = put('l_aux', 26, y, 'grp_aux');
    pl(u, 'VIN', '+12V'); pl(u, 'GND', 'GND'); pl(u, 'VCC', '+5V');
    b.connect(u, 'SW', `AUX${i + 1}_SW`, 'power'); b.connect(L, '1', `AUX${i + 1}_SW`, 'power'); pl(L, '2', rail);
    two(put('c_0805', 31.5, y, 'grp_aux', { rot: 90, near: L.id, nearR: 6 }), rail, 'GND');
    two(put('c_0805hv', 14, y, 'grp_aux', { rot: 90, near: u.id, nearR: 6 }), '+12V', 'GND');
  });
  const fl = put('w25q80', 40, H - 9, 'grp_gpu');
  pl(fl, 'VCC', '+1V8'); pl(fl, 'GND', 'GND');
  attach('bottom', ['CS', 'CLK', 'MOSI', 'MISO'].map(n => ({ c: fl, pad: n, pos: wp(fl, n), net: 'SPI_' + n })), 'signal');
  const xt = put('x_27m', gx - gw / 2 - 4, gy - gh / 2 - 4, 'grp_gpu', { near: gpu.id, nearR: Math.max(gw, gh) / 2 + 6 });
  pl(xt, 'GND', 'GND'); pl(xt, 'GND2', 'GND');
  attach('top', ['X1', 'X2'].map(n => ({ c: xt, pad: n, pos: wp(xt, n), net: 'XTAL_' + n })), 'signal');

  // ── GPU の電源ボールと裏面デカップリング ──
  for (const p of gpuP.pads) {
    if (gpu.padNet[p.n]) continue;
    const [r, c] = p.n.split('_').map(Number);
    pl(gpu, p.n, p.ring <= 2 ? 'GND' : p.ring === 3 ? ((r + c) % 2 ? '+1V8' : 'GND') : ((r + c) % 2 ? 'VCORE' : 'GND'));
  }
  const bw = gw - 14, bh = gh - 14, nxc = Math.floor(bw / 3.5), nyc = Math.floor(bh / 3);
  for (let j = 0; j < nyc; j++) for (let i = 0; i < nxc; i++) {
    const big = i % 4 === 3;
    two(put(big ? 'c_0603' : 'c_0402', gx + (i - (nxc - 1) / 2) * 3.5, gy + (j - (nyc - 1) / 2) * 3, 'grp_gpu', { side: 'B', near: gpu.id, nearR: Math.min(bw, bh) / 2 }), 'VCORE', 'GND');
  }
  return b;
}
