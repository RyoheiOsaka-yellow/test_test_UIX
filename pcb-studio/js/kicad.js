// KiCad (.kicad_pcb) の書き出しと読み込み
import { Board, padWorld, snap, NET_WIDTH } from './core.js';

const CU = ['F.Cu', 'In1.Cu', 'In2.Cu', 'B.Cu'];
const f = v => { const s = (Math.round(v * 1000) / 1000).toFixed(3).replace(/\.?0+$/, ''); return s === '-0' ? '0' : s; };
const q = s => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';

export function exportKicad(b) {
  const nets = [...b.nets.values()], num = new Map(nets.map((n, i) => [n.name, i + 1]));
  const o = [];
  o.push('(kicad_pcb (version 20211014) (generator gpu_kiban_studio)', '  (general (thickness 1.6))', '  (paper "A3")',
    '  (layers', '    (0 "F.Cu" signal)', '    (1 "In1.Cu" signal)', '    (2 "In2.Cu" signal)', '    (31 "B.Cu" signal)',
    '    (36 "B.SilkS" user "B.Silkscreen")', '    (37 "F.SilkS" user "F.Silkscreen")', '    (38 "B.Mask" user)', '    (39 "F.Mask" user)',
    '    (44 "Edge.Cuts" user)', '    (48 "B.Fab" user)', '    (49 "F.Fab" user)', '  )', '  (setup (pad_to_mask_clearance 0))', '  (net 0 "")');
  for (const n of nets) o.push(`  (net ${num.get(n.name)} ${q(n.name)})`);
  for (const c of b.comps) {
    const B = c.side === 'B', lay = B ? 'B' : 'F', ang = (360 - c.rot) % 360, p = c.part;
    o.push(`  (footprint ${q('gks:' + p.pn.replace(/[^\w.+-]+/g, '_'))} (layer "${lay}.Cu")`, `    (at ${f(c.x)} ${f(c.y)}${ang ? ' ' + ang : ''})`,
      `    (descr ${q(`${p.mfr} ${p.name} / ${p.pkg}`)})`, `    (attr ${p.th ? 'through_hole' : 'smd'})`,
      `    (fp_text reference ${q(c.ref)} (at 0 ${f(-p.h / 2 - 1)}${ang ? ' ' + ang : ''}) (layer "${lay}.SilkS") (effects (font (size 0.8 0.8) (thickness 0.12))${B ? ' (justify mirror)' : ''}))`,
      `    (fp_text value ${q(p.pn)} (at 0 ${f(p.h / 2 + 1)}${ang ? ' ' + ang : ''}) (layer "${lay}.Fab") (effects (font (size 0.8 0.8) (thickness 0.12))${B ? ' (justify mirror)' : ''}))`);
    const hw = p.w / 2, hh = p.h / 2;
    for (const [x0, y0, x1, y1] of [[-hw, -hh, hw, -hh], [hw, -hh, hw, hh], [hw, hh, -hw, hh], [-hw, hh, -hw, -hh]])
      o.push(`    (fp_line (start ${f(x0)} ${f(y0)}) (end ${f(x1)} ${f(y1)}) (layer "${lay}.Fab") (width 0.1))`);
    for (const pad of p.pads) {
      const nm = c.padNet[pad.n], net = nm ? ` (net ${num.get(nm)} ${q(nm)})` : '';
      const at = `(at ${f(B ? -pad.x : pad.x)} ${f(pad.y)}${ang ? ' ' + ang : ''})`;
      if (pad.th) o.push(`    (pad ${q(pad.n)} thru_hole circle ${at} (size ${f(pad.w)} ${f(pad.h)}) (drill ${f(Math.max(0.3, pad.w * 0.55))}) (layers "*.Cu" "*.Mask")${net})`);
      else o.push(`    (pad ${q(pad.n)} smd ${pad.round ? 'circle' : 'rect'} ${at} (size ${f(pad.w)} ${f(pad.h)}) (layers "${lay}.Cu" "${lay}.Mask")${net})`);
    }
    o.push('  )');
  }
  // 外形
  const pts = [[0, 0], [b.w, 0], [b.w, b.h]];
  if (b.tab) { const t = b.tab; pts.push([t.x1, b.h], [t.x1, b.h + t.h], [t.x0 + 13, b.h + t.h], [t.x0 + 13, b.h + 1], [t.x0 + 11, b.h + 1], [t.x0 + 11, b.h + t.h], [t.x0, b.h + t.h], [t.x0, b.h]); }
  pts.push([0, b.h]);
  pts.forEach((p, i) => { const n = pts[(i + 1) % pts.length]; o.push(`  (gr_line (start ${f(p[0])} ${f(p[1])}) (end ${f(n[0])} ${f(n[1])}) (layer "Edge.Cuts") (width 0.1))`); });
  // 配線とビア
  for (const n of nets) {
    if (!n.route) continue;
    const w = n.cls === 'power' ? 0.4 : n.cls === 'diff' ? 0.2 : NET_WIDTH.signal, id = num.get(n.name);
    for (const s of n.route.segs) for (let i = 0; i + 3 < s.pts.length; i += 2)
      o.push(`  (segment (start ${f(s.pts[i])} ${f(s.pts[i + 1])}) (end ${f(s.pts[i + 2])} ${f(s.pts[i + 3])}) (width ${w}) (layer "${CU[s.l]}") (net ${id}))`);
    for (const v of n.route.vias) o.push(`  (via (at ${f(v.x)} ${f(v.y)}) (size 0.6) (drill 0.3) (layers "F.Cu" "B.Cu") (net ${id}))`);
  }
  o.push(')');
  return o.join('\n') + '\n';
}

// ── S 式パーサ ──
function parse(text) {
  const stack = [[]]; let i = 0; const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (ch === '(') { const a = []; stack[stack.length - 1].push(a); stack.push(a); i++; }
    else if (ch === ')') { if (stack.length > 1) stack.pop(); i++; }
    else if (ch === '"') {
      let s = ''; i++;
      while (i < n && text[i] !== '"') { if (text[i] === '\\' && i + 1 < n) i++; s += text[i++]; }
      i++; stack[stack.length - 1].push({ s });
    } else if (ch <= ' ') i++;
    else { let j = i; while (j < n && text[j] > ' ' && text[j] !== '(' && text[j] !== ')') j++; stack[stack.length - 1].push(text.slice(i, j)); i = j; }
  }
  return stack[0][0];
}
const str = v => (v && typeof v === 'object' && !Array.isArray(v) ? v.s : v);
const kids = (node, head) => node.filter(x => Array.isArray(x) && x[0] === head);
const kid = (node, head) => node.find(x => Array.isArray(x) && x[0] === head);

const POWER = /^(\/?)(GND|AGND|DGND|PGND|GNDA|GNDD|VSS\w*|VCC\w*|VDD\w*|VBUS|VBAT|VIN|VOUT|[+-]?\d+(\.\d+)?V\d*\w*|\+\w+)$/i;
const GROUPS = { U: ['IC', '#f2a65a'], C: ['コンデンサ', '#5ec8f2'], R: ['抵抗', '#a3d977'], L: ['インダクタ', '#f26d6d'], J: ['コネクタ', '#8aa4ff'], P: ['コネクタ', '#8aa4ff'], D: ['ダイオード', '#d98cf0'], Q: ['トランジスタ', '#f0d264'], Y: ['発振子', '#7fe0c3'] };

// 読み込み：部品・パッド・ネット・外形を取り込む。配線はこのツールのグリッドで引き直す。
export function importKicad(text, register) {
  const root = parse(text);
  if (!root || root[0] !== 'kicad_pcb') throw new Error('kicad_pcb 形式ではありません');
  const netName = new Map();
  for (const n of kids(root, 'net')) netName.set(String(n[1]), str(n[2]) || '');
  const fps = [...kids(root, 'footprint'), ...kids(root, 'module')];
  if (!fps.length) throw new Error('フットプリントが見つかりません');
  // 外形の範囲
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const ext = (x, y) => { if (isFinite(x) && isFinite(y)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } };
  for (const g of root) {
    if (!Array.isArray(g) || !/^gr_/.test(g[0])) continue;
    const lay = kid(g, 'layer'); if (!lay || str(lay[1]) !== 'Edge.Cuts') continue;
    for (const k of ['start', 'end', 'mid']) { const p = kid(g, k); if (p) ext(+p[1], +p[2]); }
    const c = kid(g, 'center'), e = kid(g, 'end');
    if (g[0] === 'gr_circle' && c && e) { const r = Math.hypot(e[1] - c[1], e[2] - c[2]); ext(+c[1] - r, +c[2] - r); ext(+c[1] + r, +c[2] + r); }
    const pts = kid(g, 'pts'); if (pts) for (const p of kids(pts, 'xy')) ext(+p[1], +p[2]);
  }
  const items = [];
  for (const fp of fps) {
    const at = kid(fp, 'at') || ['at', 0, 0], ax = +at[1], ay = +at[2], th = (+at[3] || 0) * Math.PI / 180;
    const side = str((kid(fp, 'layer') || [])[1]) === 'B.Cu' ? 'B' : 'T';
    let ref = '', val = '';
    for (const t of kids(fp, 'fp_text')) { if (t[1] === 'reference') ref = str(t[2]); else if (t[1] === 'value') val = str(t[2]); }
    for (const t of kids(fp, 'property')) { if (str(t[1]) === 'Reference') ref = str(t[2]); else if (str(t[1]) === 'Value') val = str(t[2]); }
    const pads = [], names = new Map();
    for (const pd of kids(fp, 'pad')) {
      const type = pd[2]; if (type === 'np_thru_hole') continue;
      const pa = kid(pd, 'at') || ['at', 0, 0], sz = kid(pd, 'size') || ['size', 1, 1];
      const lx = +pa[1], ly = +pa[2], ang = +pa[3] || 0;
      const wx = ax + lx * Math.cos(th) + ly * Math.sin(th), wy = ay - lx * Math.sin(th) + ly * Math.cos(th);
      let w = +sz[1], h = +sz[2];
      const quarter = Math.round(ang / 90);
      if (Math.abs(ang - quarter * 90) > 1) w = h = Math.max(w, h); else if (quarter % 2) [w, h] = [h, w];
      let nm = str(pd[1]) || 'P'; const k = (names.get(nm) || 0) + 1; names.set(nm, k); if (k > 1) nm += '#' + k;
      const nn = kid(pd, 'net'); let net = '';
      if (nn) net = nn.length >= 3 ? str(nn[2]) : (netName.get(String(nn[1])) ?? str(nn[1]));
      pads.push({ n: nm, wx, wy, w, h, th: type === 'thru_hole', round: /circle|oval/.test(pd[3] || ''), net });
    }
    if (!pads.length) continue;
    items.push({ name: str(fp[1]) || 'FP', ref: ref || '?', val, side, pads });
  }
  if (!items.length) throw new Error('パッドを持つフットプリントがありません');
  if (x1 < x0) for (const it of items) for (const p of it.pads) { ext(p.wx - 4, p.wy - 4); ext(p.wx + 4, p.wy + 4); }
  const ox = Math.floor(x0), oy = Math.floor(y0);
  const b = new Board(Math.ceil(x1 - ox), Math.ceil(y1 - oy));
  b.meta = { kind: 'kicad' };
  const count = new Map();
  for (const it of items) for (const p of it.pads) if (p.net) count.set(p.net, (count.get(p.net) || 0) + 1);
  let seq = 0;
  for (const it of items) {
    let px0 = 1e9, py0 = 1e9, px1 = -1e9, py1 = -1e9;
    for (const p of it.pads) { px0 = Math.min(px0, p.wx - p.w / 2); px1 = Math.max(px1, p.wx + p.w / 2); py0 = Math.min(py0, p.wy - p.h / 2); py1 = Math.max(py1, p.wy + p.h / 2); }
    const cx = snap((px0 + px1) / 2), cy = snap((py0 + py1) / 2), sgn = it.side === 'B' ? -1 : 1;
    const short = it.name.split(':').pop();
    const part = {
      id: `kicad/${seq++}/${short}`, cat: 'kicad', family: 'kicad:' + short, ref: (it.ref.match(/^[A-Za-z]+/) || ['U'])[0],
      name: it.val || short, mfr: 'KiCad', pn: it.val || short, pkg: short, spec: `${it.pads.length} パッド`, seen: 'インポート', ok: false,
      w: Math.max(0.6, px1 - px0 + 0.4), h: Math.max(0.6, py1 - py0 + 0.4),
      th: it.pads.some(p => p.th), pads: it.pads.map(p => ({ n: p.n, x: sgn * (p.wx - cx), y: p.wy - cy, w: p.w, h: p.h, th: p.th, round: p.round })),
    };
    part.padMap = Object.fromEntries(part.pads.map(p => [p.n, p]));
    register(part);
    const pre = part.ref[0].toUpperCase(), g = GROUPS[pre] || ['その他', '#9aa3ad'];
    b.ensureGroup('k_' + g[0], g[0], 'misc', g[1]);
    const c = b.add(part, cx - ox, cy - oy, { ref: it.ref, side: it.side, group: 'k_' + g[0], fixed: /^(J|P)/.test(pre) });
    for (const p of it.pads) if (p.net) b.connect(c, p.n, p.net, POWER.test(p.net) || count.get(p.net) >= 12 ? 'plane' : 'signal');
  }
  return b;
}

// 独自部品（KiCad 取り込み分）を JSON 保存に含めるための変換
export const packPart = p => ({ ...p, padMap: undefined });
export const unpackPart = p => ({ ...p, padMap: Object.fromEntries(p.pads.map(x => [x.n, x])) });
