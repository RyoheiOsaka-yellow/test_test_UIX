// 電源経路の概算：電流、経路長、有効幅、電圧降下、損失。
// 前提：電源プレーンは 2oz 銅箔 1 層（シート抵抗 0.25mΩ/□、温度上昇込み）、電流は供給元から負荷へ一様に広がる。
import { padWorld, compBox } from './core.js';

const RS = 0.25e-3;                       // Ω/□
const VRAIL = { VCORE: 1.0, VMEM: 1.35, '+12V': 12, '+12V_IN': 12, '+1V8': 1.8 };

export function electrical(board) {
  const fam = f => board.comps.filter(c => c.part.family === f);
  const gpu = fam('gpu')[0], nMem = fam('vram').length;
  if (!gpu) return [];
  const pMem = nMem * 2.7, pIn = (gpu.part.val + pMem) / 0.9;
  const amps = { VCORE: gpu.part.val / VRAIL.VCORE, VMEM: pMem / VRAIL.VMEM, '+12V': pIn / 12, '+12V_IN': pIn / 12 };
  const out = [];
  for (const name of ['+12V_IN', '+12V', 'VCORE', 'VMEM']) {
    const net = board.nets.get(name); if (!net || net.cls !== 'plane') continue;
    const src = [], load = [], seen = new Set();
    for (const p of net.pins) {
      const c = p.c; if (seen.has(c)) continue; seen.add(c);
      if (c.part.pads.length === 2) { // 2 端子部品：相手側が GND ならデカップリング、別の電源ならこのレールへの供給元
        const other = Object.values(c.padNet).find(n => n !== name);
        if (other && other !== 'GND') src.push(c);
      } else if (/^pwrconn/.test(c.part.family)) src.push(c);
      else load.push(c);
    }
    // 供給元がこのレールを「受ける」側なら（例: シャントの入力側）、負荷として扱う
    if (name === '+12V_IN') { load.length = 0; for (const c of src.splice(0)) (/^pwrconn/.test(c.part.family) ? src : load).push(c); }
    if (!src.length || !load.length) continue;
    const boxes = load.map(c => compBox(c));
    const dist = c => Math.min(...boxes.map(B => Math.hypot(Math.max(B.x0 - c.x, 0, c.x - B.x1), Math.max(B.y0 - c.y, 0, c.y - B.y1))));
    // 負荷ごとの重み（このレールのピン数）で重心を取る
    let lx = 0, ly = 0, lw = 0;
    for (const c of load) { const w = Object.values(c.padNet).filter(n => n === name).length; lx += c.x * w; ly += c.y * w; lw += w; }
    lx /= lw; ly /= lw;
    // 供給元が負荷の両側にあるときは、左右を別々の経路として並列に扱う
    const left = src.filter(c => c.x < lx), right = src.filter(c => c.x >= lx);
    const sides = Math.min(left.length, right.length) >= src.length * 0.2 ? [left, right] : [src];
    const I = amps[name];
    let mV = 0, loss = 0, Lsum = 0, Wsum = 0;
    for (const grp of sides) {
      const sx = grp.reduce((s, c) => s + c.x, 0) / grp.length, sy = grp.reduce((s, c) => s + c.y, 0) / grp.length;
      const L = Math.max(1, grp.reduce((s, c) => s + dist(c), 0) / grp.length);
      const d = Math.hypot(lx - sx, ly - sy) || 1, nx = -(ly - sy) / d, ny = (lx - sx) / d;
      const span = arr => { const t = arr.map(c => c.x * nx + c.y * ny); return Math.max(...t) - Math.min(...t); };
      const loadSpan = Math.max(...boxes.map(B => Math.abs(nx) * (B.x1 - B.x0) + Math.abs(ny) * (B.y1 - B.y0)), span(load));
      const W = Math.max(4, Math.min(span(grp) + 8, loadSpan + 2 * L));
      const Ic = I * grp.length / src.length, R = RS * L / W;
      mV = Math.max(mV, Ic * R * 1000); loss += Ic * Ic * R; Lsum += L * grp.length / src.length; Wsum += W;
    }
    out.push({ name, I, L: Lsum, W: Wsum, mV, pct: mV / 1000 / VRAIL[name] * 100, loss, dens: I / Wsum, nSrc: src.length, sides: sides.length });
  }
  return out;
}
