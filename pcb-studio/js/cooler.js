// 冷却機構（段差つきベースプレート＋フィン＋ファン、裏面のバックプレート）と部品の干渉・熱の概算
// ・ベースプレート下面より背の高い部品は、切り欠きがなければ干渉する
// ・下面の高さは「全体」「メモリの上」「VRM の上」「インダクタの上」で別々に決められる（段差つき）
// ・メモリ・DrMOS・インダクタは、下面との隙間をサーマルパッドで埋められるか（3mm 以下）を見る
// ・裏面はバックプレートとの干渉と、PCIe CEM 規格の裏面高さ制限との比較
import { compBox, boxOverlap } from './core.js';
import { heightOf } from './view3d.js';

export const BASE_T = 3, PLATE_T = 1.5;
// 2 スロット 34.80 / 3 スロット 55.12 / 裏面 2.67 / 間隔 20.32 は CEM 4.0 の本文・図で確認。1 スロット 14.47 は図面のみで未確認
export const CEM = { primary: [14.47, 34.80, 55.12], secondary: 2.67, pitch: 20.32 };
export const slotsFor = h => { const i = CEM.primary.findIndex(v => h <= v); return i >= 0 ? i + 1 : 3 + Math.ceil((h - CEM.primary[2]) / CEM.pitch); };
const isInd = f => f === 'ind' || f === 'indin';

function zonesOf(b) {
  const top = b.comps.filter(c => c.side === 'T');
  const mem = top.filter(c => c.part.family === 'vram').map(c => compBox(c, 2.5)), ind = top.filter(c => isInd(c.part.family)).map(c => compBox(c, 0.8)), vrm = [];
  for (const g of b.groups) {
    const cs = top.filter(c => c.group === g.id && !c.part.th);
    if (!cs.some(c => c.part.family === 'drmos')) continue;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const c of cs) { const B = compBox(c, 1.5); x0 = Math.min(x0, B.x0); y0 = Math.min(y0, B.y0); x1 = Math.max(x1, B.x1); y1 = Math.max(y1, B.y1); }
    vrm.push({ x0, y0, x1, y1 });
  }
  const inAny = (L, x, y) => L.some(q => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1);
  return (x, y) => (inAny(ind, x, y) ? 'ind' : inAny(mem, x, y) ? 'mem' : inAny(vrm, x, y) ? 'vrm' : 'base');
}
const topOf = (b, test) => Math.max(0, ...b.comps.filter(c => test(c.part.family) && c.side === 'T').map(c => heightOf(c.part)));
// 段差のおすすめ：メモリ・DrMOS・インダクタの上に薄いサーマルパッドが入る高さ
export function recommend(b) {
  const gpu = b.comps.find(c => c.part.family === 'gpu');
  return { base: gpu ? +(heightOf(gpu.part) + 0.8).toFixed(1) : 3.2, mem: +(topOf(b, f => f === 'vram') + 1).toFixed(1), vrm: +(topOf(b, f => f === 'drmos') + 1.5).toFixed(1), ind: +(topOf(b, isInd) + 0.8).toFixed(1) };
}

export function coolerCheck(b, cfg) {
  const gpu = b.comps.find(c => c.part.family === 'gpu'); if (!gpu) return null;
  let x0 = 1;
  for (const c of b.comps) if (c.fixed && c !== gpu) { const B = compBox(c); if (B.x0 < 8 && B.y1 - B.y0 > 6) x0 = Math.max(x0, B.x1 + 1); }
  const rect = { x0, y0: 1, x1: b.w - 1, y1: b.h - 1 };
  const gpuTop = heightOf(gpu.part) + 0.8, base = Math.max(cfg.base, gpuTop);
  const und = { base, mem: cfg.step ? cfg.mem : base, vrm: cfg.step ? cfg.vrm : base, ind: cfg.step ? cfg.ind : base }, zoneOf = zonesOf(b);
  const hits = [], cuts = [], pads = [], unknown = new Set();
  for (const c of b.comps) {
    if ((c.side !== 'T' && !c.part.th) || c === gpu || c.part.family === 'hole' || c.part.family === 'pcie') continue;
    const B = compBox(c); if (!boxOverlap(B, rect)) continue;
    const h = heightOf(c.part), f = c.part.family, z = und[zoneOf(c.x, c.y)];
    if (!c.part.htOk && !c.part.htUser) unknown.add(c.part);
    if (h > z - 0.3) {
      if (c.part.th || cfg.cut) cuts.push({ ...compBox(c, 0.7), c, access: !!c.part.th });   // コネクタは常に開口が必要
      else hits.push({ c, h, z });
    } else if (f === 'vram' || f === 'drmos' || isInd(f)) pads.push({ c, f: isInd(f) ? 'ind' : f, gap: z - h, ok: z - h <= 3 });
  }
  const area = (rect.x1 - rect.x0) * (rect.y1 - rect.y0);
  const cutPct = cuts.reduce((s, q) => s + (Math.min(q.x1, rect.x1) - Math.max(q.x0, rect.x0)) * (Math.min(q.y1, rect.y1) - Math.max(q.y0, rect.y0)), 0) / area * 100;
  const top = Math.max(und.base, und.mem, und.vrm, und.ind) + BASE_T, front = top + cfg.fin + 15;
  // 裏面
  const bot = b.comps.filter(c => c.side === 'B' && !c.part.th), maxB = Math.max(0, ...bot.map(c => heightOf(c.part)));
  const hitsB = cfg.backOn ? bot.filter(c => heightOf(c.part) > cfg.back - 0.2).map(c => ({ c, h: heightOf(c.part) })) : [];
  const rear = cfg.backOn ? cfg.back + PLATE_T : maxB;
  const sum = f => { const L = pads.filter(p => p.f === f); return L.length ? { n: L.length, min: Math.min(...L.map(p => p.gap)), max: Math.max(...L.map(p => p.gap)), bad: L.filter(p => !p.ok).length } : null; };
  const info = {
    rect, und, top, gpuTop, gpu, zoneOf, hits, cuts, pads, cutPct, unknown: unknown.size, fin: cfg.fin, fans: cfg.fans,
    front, rear, maxB, hitsB, backOn: cfg.backOn, back: cfg.back, thickness: front + 1.6 + rear,
    slots: slotsFor(front), vram: sum('vram'), drmos: sum('drmos'), ind: sum('ind'),
  };
  info.heat = thermal(b, info, cfg);
  return info;
}

// 熱の概算。前提（cfg で変更可）：ケース内気温、VRM の効率（損失の 7 割が DrMOS、3 割がインダクタ）、
// メモリ 1 枚の発熱、サーマルパッドの熱伝導率、ヒートパイプの本数、ファンの位置と風量（熱伝達は風量の 0.8 乗に比例）。
// ベースプレートを長手方向に約 10mm ごとの区画に分け、各区画が「フィンから空気へ逃がす熱」と
// 「隣の区画へ伝える熱（アルミ板＋ヒートパイプ）」を持つ 1 次元の熱回路として解く。
// ファンの真下の区画はよく冷え、ファンから外れた区画は冷えにくい。
// VRM は発熱が密集するほど局所的に熱くなるとみなし、発熱密度 1 W/cm² あたり 12℃ を上乗せする。
export const LIMIT = { gpu: 90, vram: 95, drmos: 110, ind: 110 };
export function fanCenters(b, info, cfg) {
  const r = info.rect, L = r.x1 - r.x0, n = cfg.fans, rad = Math.min((r.y1 - r.y0) / 2 - 2, L / n / 2 - 3);
  const even = Array.from({ length: n }, (_, i) => r.x0 + L * (i + 0.5) / n);
  const dm = b.comps.filter(c => c.part.family === 'drmos' && c.side === 'T');
  const aim = cfg.fanPos === 'gpu' ? info.gpu.x : cfg.fanPos === 'vrm' && dm.length ? dm.reduce((q, c) => q + c.x, 0) / dm.length : null;
  // 寄せる設定のときは、全体を目標へ 40% 近づける（基板からはみ出さない範囲で）
  const xs = aim == null ? even : even.map(x => Math.max(r.x0 + rad, Math.min(r.x1 - rad, x + (aim - (r.x0 + r.x1) / 2) * 0.4)));
  return { xs, rad };
}
export function thermal(b, info, cfg) {
  const AMB = cfg.amb ?? 35, K_PAD = cfg.kPad ?? 6, EFF = cfg.eff ?? 0.9, MEM_W = cfg.memW ?? 2.7, PIPES = cfg.pipes ?? 6, gpu = info.gpu, top = b.comps.filter(c => c.side === 'T');
  const fam = f => top.filter(c => (f === 'ind' ? isInd(c.part.family) : c.part.family === f));
  const P = new Map(), pGpu = gpu.part.val || 0, loss = pGpu * (1 / EFF - 1), dm = fam('drmos'), ind = fam('ind'), mem = fam('vram');
  P.set(gpu, pGpu);
  for (const c of mem) P.set(c, MEM_W);
  for (const c of dm) P.set(c, loss * 0.7 / dm.length);
  for (const c of ind) P.set(c, loss * 0.3 / ind.length);
  const Q = [...P.values()].reduce((a, v) => a + v, 0);
  const r = info.rect, nFin = Math.floor((r.x1 - r.x0) / 2), depth = (r.y1 - r.y0) / 1000, A = 2 * nFin * (cfg.fin / 1000) * depth;
  // 区画ごとの熱回路
  const N = Math.max(4, Math.ceil((r.x1 - r.x0) / 10)), dx = (r.x1 - r.x0) / N, col = x => Math.max(0, Math.min(N - 1, Math.floor((x - r.x0) / dx)));
  const fan = fanCenters(b, info, cfg), gap = new Map(info.pads.map(p => [p.c, p.gap]));
  const gAir = new Float64Array(N), qIn = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const xc = r.x0 + (i + 0.5) * dx, cover = Math.max(0, ...fan.xs.map(fx => Math.max(0, Math.min(1, 1 - Math.max(0, Math.abs(xc - fx) - fan.rad) / fan.rad))));
    gAir[i] = 40 * Math.pow(cfg.rpm ?? 1, 0.8) * (0.55 + 0.75 * cover) * (A / N) * 0.7;
  }
  const gLat = (200 * 0.005 * depth + PIPES * 10000 * 2.8e-5) / (dx / 1000);
  const gB = compBox(gpu), g0 = col(gB.x0 + (gB.x1 - gB.x0) * 0.25), g1 = col(gB.x1 - (gB.x1 - gB.x0) * 0.25);
  for (let i = g0; i <= g1; i++) qIn[i] += pGpu / (g1 - g0 + 1);
  let open = 0;
  const contact = c => { const g = gap.get(c); return g != null && g <= 3; };
  for (const c of [...mem, ...dm, ...ind]) if (contact(c)) qIn[col(c.x)] += P.get(c); else open++;
  // 三重対角の連立方程式を解く
  const a = new Float64Array(N), d = new Float64Array(N), c2 = new Float64Array(N), rhs = new Float64Array(N), Tc = new Float64Array(N);
  for (let i = 0; i < N; i++) { const l = i > 0 ? gLat : 0, rr = i < N - 1 ? gLat : 0; a[i] = -l; c2[i] = -rr; d[i] = gAir[i] + l + rr; rhs[i] = qIn[i] + gAir[i] * AMB; }
  for (let i = 1; i < N; i++) { const m = a[i] / d[i - 1]; d[i] -= m * c2[i - 1]; rhs[i] -= m * rhs[i - 1]; }
  Tc[N - 1] = rhs[N - 1] / d[N - 1]; for (let i = N - 2; i >= 0; i--) Tc[i] = (rhs[i] - c2[i] * Tc[i + 1]) / d[i];
  const tAvg = Tc.reduce((q, v) => q + v, 0) / N; let tGpu = 0; for (let i = g0; i <= g1; i++) tGpu = Math.max(tGpu, Tc[i]);
  // VRM の発熱密度：GPU の左右でかたまりを分け、それぞれを囲む面積の合計で割る
  let dens = 0;
  if (dm.length) {
    let area = 0;
    for (const side of [c => c.x < gpu.x, c => c.x >= gpu.x]) {
      const cl = [...dm, ...ind].filter(side); if (!cl.length) continue;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const c of cl) { const B = compBox(c); x0 = Math.min(x0, B.x0); y0 = Math.min(y0, B.y0); x1 = Math.max(x1, B.x1); y1 = Math.max(y1, B.y1); }
      area += (x1 - x0) * (y1 - y0) / 100;
    }
    dens = loss / Math.max(1, area);
  }
  const local = dens * 12, vrmSet = new Set([...dm, ...ind]), T = new Map();
  const Rgpu = 0.05 + 5e-5 / (8 * (gB.x1 - gB.x0) * 0.46 * (gB.y1 - gB.y0) * 0.46 * 1e-6) + Math.max(0, info.und.base - info.gpuTop) / 1000 / (390 * (gB.x1 - gB.x0) * 0.5 * (gB.y1 - gB.y0) * 0.5 * 1e-6);
  T.set(gpu, tGpu + pGpu * Rgpu);
  for (const c of [...mem, ...dm, ...ind]) {
    const g = gap.get(c), B = compBox(c), ar = (B.x1 - B.x0) * (B.y1 - B.y0) * 1e-6;
    // パッドで接触していれば t/(kA)。届かない・切り欠き内なら、風が当たる表面からの放熱のみ
    const R = contact(c) ? Math.max(0.1, g) / 1000 / (K_PAD * ar) : 1 / (25 * ar * 8);
    T.set(c, (contact(c) ? Tc[col(c.x)] : AMB + 15) + P.get(c) * R + (vrmSet.has(c) ? local : 0));
  }
  const mx = L => (L.length ? Math.max(...L.map(c => T.get(c))) : null);
  return { dens, local, kPad: K_PAD, eff: EFF, memW: MEM_W, pipes: PIPES, Q, loss, Rsink: (tAvg - AMB) / Q, tBase: tGpu, tAvg, tMin: Math.min(...Tc), prof: [...Tc], x0: r.x0, dx, fan, A, T, gpu: T.get(gpu), vram: mx(mem), drmos: mx(dm), ind: mx(ind), open, amb: AMB };
}
