// 電源プレーンの計画：各レールの領域（凸包）と、重ならないように電源層へ割り当てる層構成
import { padWorld, compBox, convexHull } from './core.js';

function inside(poly, x, y) {
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; if ((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x) < -1e-9) return false; }
  return true;
}
function overlap(A, B) {
  let n = 0, k = 0;
  for (let y = A.y0; y <= A.y1; y += 2.5) for (let x = A.x0; x <= A.x1; x += 2.5) { if (!inside(A.hull, x, y)) continue; n++; if (inside(B.hull, x, y)) k++; }
  return n ? k / n : 0;
}

export function planePlan(board) {
  const rails = [];
  for (const net of board.nets.values()) {
    if (net.cls !== 'plane' || net.name === 'GND' || net.pins.length < 2) continue;
    const pts = [], seen = new Set();
    for (const p of net.pins) {
      if (p.c.part.pads.length > 60) { if (seen.has(p.c)) continue; seen.add(p.c); const B = compBox(p.c); pts.push({ x: B.x0, y: B.y0 }, { x: B.x1, y: B.y0 }, { x: B.x1, y: B.y1 }, { x: B.x0, y: B.y1 }); }
      else { const q = padWorld(p.c, p.c.part.padMap[p.p]); pts.push({ x: q.x, y: q.y }); }
    }
    let hull = convexHull(pts);
    if (hull.length < 3) { const q = pts[0], r = pts[pts.length - 1]; hull = [{ x: Math.min(q.x, r.x) - 1, y: Math.min(q.y, r.y) - 1 }, { x: Math.max(q.x, r.x) + 1, y: Math.min(q.y, r.y) - 1 }, { x: Math.max(q.x, r.x) + 1, y: Math.max(q.y, r.y) + 1 }, { x: Math.min(q.x, r.x) - 1, y: Math.max(q.y, r.y) + 1 }]; }
    const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length, cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;
    hull = hull.map(p => { const d = Math.hypot(p.x - cx, p.y - cy) || 1; return { x: Math.min(board.w - 0.6, Math.max(0.6, p.x + (p.x - cx) / d * 1.5)), y: Math.min(board.gridH - 0.6, Math.max(0.6, p.y + (p.y - cy) / d * 1.5)) }; });
    if ((hull[1].x - hull[0].x) * (hull[2].y - hull[0].y) - (hull[1].y - hull[0].y) * (hull[2].x - hull[0].x) < 0) hull.reverse();
    const xs = hull.map(p => p.x), ys = hull.map(p => p.y);
    let area = 0; for (let i = 0; i < hull.length; i++) { const a = hull[i], b = hull[(i + 1) % hull.length]; area += a.x * b.y - b.x * a.y; }
    rails.push({ name: net.name, net, hull, area: Math.abs(area) / 2, pins: net.pins.length, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), layer: 0 });
  }
  rails.sort((a, b) => b.pins - a.pins);
  const MAXL = 4, layers = [];
  for (const r of rails) {
    let best = -1, bo = 1e9;
    for (let l = 0; l < MAXL; l++) {
      const o = (layers[l] || []).reduce((m, q) => Math.max(m, overlap(r, q), overlap(q, r)), 0);
      if (o < 0.06) { best = l; break; }
      if (o < bo) { bo = o; best = l; }
    }
    r.layer = best; (layers[best] = layers[best] || []).push(r);
  }
  // 同じ層で重なる場合は、面積の小さいレールを優先して塗る
  for (const list of layers) if (list) list.slice().sort((a, b) => b.area - a.area).forEach((r, i) => { r.priority = i; });
  const power = layers.filter(Boolean).length;
  let copper = 4 + 1 + power; const gnd = copper % 2 ? 2 : 1; copper += gnd - 1;
  // 層の並び：表 / GND / 信号 / 電源… / 信号 / (GND) / 裏
  const stack = ['L1 表層（信号・部品）', 'GND プレーン', '内層信号（横）', ...Array.from({ length: power }, (_, i) => `電源プレーン ${i + 1}：${layers[i].map(r => r.name).join('、')}`), '内層信号（縦）', ...(gnd === 2 ? ['GND プレーン'] : []), `L${copper} 裏層（信号・部品）`];
  return { rails, power, gnd, copper, stack };
}
