// DXF（ASCII）実パーサ: LINE / LWPOLYLINE / POLYLINE / CIRCLE / ARC / TEXT / MTEXT / INSERT / DIMENSION / HATCH(境界) / SPLINE(制御点近似)、レイヤ、ブロック
export function parseDXF(text) {
  const lines = text.split(/\r\n|\r|\n/); const pairs = []; for (let i = 0; i + 1 < lines.length; i += 2) pairs.push([parseInt(lines[i].trim(), 10), lines[i + 1]]);
  const dxf = { layers: {}, blocks: {}, entities: [], header: {}, units: 'mm', bbox: null };
  let i = 0; const n = pairs.length;
  const readEntity = () => { const [code, val] = pairs[i]; const e = { type: val.trim(), raw: [] }; i++; while (i < n && pairs[i][0] !== 0) { e.raw.push(pairs[i]); i++; } return e; };
  // セクション走査
  while (i < n) {
    const [c, v] = pairs[i];
    if (c === 0 && v.trim() === 'SECTION') { const name = pairs[i + 1][1].trim(); i += 2;
      if (name === 'HEADER') { while (i < n && !(pairs[i][0] === 0 && pairs[i][1].trim() === 'ENDSEC')) { if (pairs[i][0] === 9) { const k = pairs[i][1].trim(); const vals = []; i++; while (i < n && pairs[i][0] !== 9 && pairs[i][0] !== 0) { vals.push(pairs[i][1]); i++; } dxf.header[k] = vals.length === 1 ? vals[0].trim() : vals.map(s => s.trim()); } else i++; } if (dxf.header.$INSUNITS == '1') dxf.units = 'in'; if (dxf.header.$INSUNITS == '5') dxf.units = 'cm'; if (dxf.header.$INSUNITS == '6') dxf.units = 'm'; }
      else if (name === 'TABLES') { while (i < n && !(pairs[i][0] === 0 && pairs[i][1].trim() === 'ENDSEC')) { if (pairs[i][0] === 0 && pairs[i][1].trim() === 'LAYER') { const e = readEntity(); const L = ent(e); if (L[2]) dxf.layers[L[2]] = { name: L[2], color: +L[62] || 7, frozen: ((+L[70]) & 1) === 1 }; } else i++; } }
      else if (name === 'BLOCKS') { let cur = null; while (i < n && !(pairs[i][0] === 0 && pairs[i][1].trim() === 'ENDSEC')) { if (pairs[i][0] === 0) { const e = readEntity(); if (e.type === 'BLOCK') { const B = ent(e); cur = { name: B[2], base: [+B[10] || 0, +B[20] || 0], entities: [] }; dxf.blocks[cur.name] = cur; } else if (e.type === 'ENDBLK') cur = null; else if (cur) { const g = toGeom(e); if (g) cur.entities.push(g); } } else i++; } }
      else if (name === 'ENTITIES') { while (i < n && !(pairs[i][0] === 0 && pairs[i][1].trim() === 'ENDSEC')) { if (pairs[i][0] === 0) { const e = readEntity(); const g = toGeom(e); if (g) dxf.entities.push(g); } else i++; } }
      else { while (i < n && !(pairs[i][0] === 0 && pairs[i][1].trim() === 'ENDSEC')) i++; }
    } else i++;
  }
  // INSERT 展開（1階層）
  const expanded = []; for (const e of dxf.entities) { if (e.type === 'INSERT') { const b = dxf.blocks[e.block]; if (!b) continue; const sx = e.scale[0], sy = e.scale[1], a = e.rotation * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a); const tf = ([x, y]) => { const px = (x - b.base[0]) * sx, py = (y - b.base[1]) * sy; return [e.pos[0] + px * cs - py * sn, e.pos[1] + px * sn + py * cs]; }; for (const be of b.entities) expanded.push(transformEntity(be, tf, a, e.layer)); } else expanded.push(e); }
  dxf.entities = expanded; dxf.bbox = bboxOf(dxf.entities); return dxf;
}
function ent(e) { const o = {}; for (const [c, v] of e.raw) { if (o[c] === undefined) o[c] = v.trim(); else if (Array.isArray(o[c])) o[c].push(v.trim()); else o[c] = [o[c], v.trim()]; } return o; }
function toGeom(e) {
  const o = ent(e); const layer = o[8] || '0'; const t = e.type;
  const base = { type: t, layer, color: o[62] ? +o[62] : null, lineType: o[6] || null };
  if (t === 'LINE') return { ...base, a: [+o[10], +o[20]], b: [+o[11], +o[21]] };
  if (t === 'CIRCLE') return { ...base, c: [+o[10], +o[20]], r: +o[40] };
  if (t === 'ARC') return { ...base, c: [+o[10], +o[20]], r: +o[40], a0: +o[50], a1: +o[51] };
  if (t === 'LWPOLYLINE') { const xs = [].concat(o[10] || []), ys = [].concat(o[20] || []), bulges = []; let bi = 0; for (const [c, v] of e.raw) { if (c === 10) bulges.push(0); if (c === 42) bulges[bulges.length - 1] = +v; } const pts = xs.map((x, k) => [+x, +ys[k]]); return { ...base, pts, bulges, closed: ((+o[70]) & 1) === 1 }; }
  if (t === 'POLYLINE') return { ...base, pts: [], closed: ((+o[70]) & 1) === 1, pending: true }; // VERTEX は後続 0 エンティティ…簡略: 無視（LWPOLYLINE が主流）
  if (t === 'VERTEX' || t === 'SEQEND') return null;
  if (t === 'TEXT' || t === 'ATTRIB') return { ...base, type: 'TEXT', pos: [+o[10], +o[20]], h: +o[40] || 2.5, text: decodeText(o[1] || ''), rot: +o[50] || 0 };
  if (t === 'MTEXT') { const s = [].concat(o[3] || []).join('') + (o[1] || ''); return { ...base, type: 'TEXT', pos: [+o[10], +o[20]], h: +o[40] || 2.5, text: decodeText(s), rot: 0 }; }
  if (t === 'INSERT') return { ...base, block: o[2], pos: [+o[10], +o[20]], scale: [+o[41] || 1, +o[42] || 1], rotation: +o[50] || 0 };
  if (t === 'DIMENSION') return { ...base, pos: [+o[11] || +o[10], +o[21] || +o[20]], text: decodeText(o[1] || ''), measure: o[42] ? +o[42] : null, p1: [+o[13], +o[23]], p2: [+o[14], +o[24]] };
  if (t === 'SPLINE') { const xs = [].concat(o[10] || []), ys = [].concat(o[20] || []); return { ...base, type: 'LWPOLYLINE', pts: xs.map((x, k) => [+x, +ys[k]]), bulges: [], closed: false, spline: true }; }
  if (t === 'HATCH') { const xs = [].concat(o[10] || []), ys = [].concat(o[20] || []); if (xs.length > 2) return { ...base, type: 'LWPOLYLINE', pts: xs.map((x, k) => [+x, +ys[k]]).slice(1), bulges: [], closed: true, hatch: true, pattern: o[2] }; return null; }
  if (t === 'SOLID' || t === '3DFACE') return { ...base, type: 'LWPOLYLINE', pts: [[+o[10], +o[20]], [+o[11], +o[21]], [+o[13] ?? +o[12], +o[23] ?? +o[22]], [+o[12], +o[22]]], bulges: [], closed: true };
  return null;
}
function decodeText(s) { return s.replace(/\\P/g, '\n').replace(/\\[A-Za-z][^;]*;/g, '').replace(/[{}]/g, '').replace(/%%c/gi, 'φ').replace(/%%d/gi, '°').replace(/%%p/gi, '±').replace(/\\U\+([0-9A-Fa-f]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16))); }
function transformEntity(e, tf, ang, layerOverride) { const o = { ...e }; if (e.layer === '0' && layerOverride) o.layer = layerOverride; if (e.a) { o.a = tf(e.a); o.b = tf(e.b); } if (e.c) o.c = tf(e.c); if (e.pts) o.pts = e.pts.map(tf); if (e.pos) o.pos = tf(e.pos); if (e.a0 != null) { o.a0 = e.a0 + ang * 180 / Math.PI; o.a1 = e.a1 + ang * 180 / Math.PI; } return o; }
export function bboxOf(ents) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const add = ([x, y]) => { if (!isFinite(x) || !isFinite(y)) return; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }; for (const e of ents) { if (e.a) { add(e.a); add(e.b); } if (e.c) { add([e.c[0] - e.r, e.c[1] - e.r]); add([e.c[0] + e.r, e.c[1] + e.r]); } if (e.pts) e.pts.forEach(add); if (e.pos) add(e.pos); } return isFinite(x0) ? { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 } : { x0: 0, y0: 0, x1: 1000, y1: 1000, w: 1000, h: 1000 }; }
// ポリライン（bulge 付）→ 折れ線点列
export function polyPoints(e, seg = 8) { const out = []; const n = e.pts.length; for (let k = 0; k < n; k++) { const p = e.pts[k], q = e.pts[(k + 1) % n]; out.push(p); const b = e.bulges?.[k] || 0; if (b && (k < n - 1 || e.closed)) { const th = 4 * Math.atan(b); const d = Math.hypot(q[0] - p[0], q[1] - p[1]); const r = d / (2 * Math.sin(th / 2)); const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; const h = Math.sqrt(Math.max(0, r * r - d * d / 4)) * Math.sign(b) * (Math.abs(th) > Math.PI ? -1 : 1); const nx = -(q[1] - p[1]) / d, ny = (q[0] - p[0]) / d; const cx = mx + nx * h, cy = my + ny * h; const a0 = Math.atan2(p[1] - cy, p[0] - cx); for (let s = 1; s < seg; s++) { const a = a0 + th * s / seg; out.push([cx + Math.cos(a) * Math.abs(r), cy + Math.sin(a) * Math.abs(r)]); } } } return out; }
// SVG 化（レイヤ色、テキスト）
export function dxfToSVG(dxf, { width = 1200, height = 800, layersOn = null, flipY = true } = {}) {
  const bb = dxf.bbox; const pad = Math.max(bb.w, bb.h) * 0.04; const vb = `${bb.x0 - pad} ${-(bb.y1 + pad)} ${bb.w + 2 * pad} ${bb.h + 2 * pad}`;
  const col = e => { const idx = e.color || dxf.layers[e.layer]?.color || 7; return ACI[idx] || '#222'; }; const Y = y => -y;
  const sw = Math.max(bb.w, bb.h) / 900; let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${width}" height="${height}" font-family="IBM Plex Sans JP, sans-serif">`;
  s += `<rect x="${bb.x0 - pad}" y="${-(bb.y1 + pad)}" width="${bb.w + 2 * pad}" height="${bb.h + 2 * pad}" fill="#fbfaf6"/>`;
  for (const e of dxf.entities) { if (layersOn && !layersOn.has(e.layer)) continue; const c = col(e); const dash = e.lineType && /DASH|HIDDEN|CENTER/i.test(e.lineType) ? ` stroke-dasharray="${sw * 6} ${sw * 3}"` : '';
    if (e.type === 'LINE') s += `<line x1="${e.a[0]}" y1="${Y(e.a[1])}" x2="${e.b[0]}" y2="${Y(e.b[1])}" stroke="${c}" stroke-width="${sw}"${dash} data-layer="${esc(e.layer)}"/>`;
    else if (e.type === 'CIRCLE') s += `<circle cx="${e.c[0]}" cy="${Y(e.c[1])}" r="${e.r}" fill="none" stroke="${c}" stroke-width="${sw}" data-layer="${esc(e.layer)}"/>`;
    else if (e.type === 'ARC') { const a0 = e.a0 * Math.PI / 180, a1 = e.a1 * Math.PI / 180; let sweep = a1 - a0; while (sweep < 0) sweep += Math.PI * 2; const large = sweep > Math.PI ? 1 : 0; s += `<path d="M ${e.c[0] + Math.cos(a0) * e.r} ${Y(e.c[1] + Math.sin(a0) * e.r)} A ${e.r} ${e.r} 0 ${large} 0 ${e.c[0] + Math.cos(a1) * e.r} ${Y(e.c[1] + Math.sin(a1) * e.r)}" fill="none" stroke="${c}" stroke-width="${sw}"/>`; }
    else if (e.type === 'LWPOLYLINE') { const pts = polyPoints(e); s += `<path d="M ${pts.map(p => `${p[0]} ${Y(p[1])}`).join(' L ')}${e.closed ? ' Z' : ''}" fill="${e.hatch ? c + '22' : 'none'}" stroke="${c}" stroke-width="${sw}"${dash} data-layer="${esc(e.layer)}"/>`; }
    else if (e.type === 'TEXT') s += `<text x="${e.pos[0]}" y="${Y(e.pos[1])}" font-size="${e.h * 1.3}" fill="${c}" transform="rotate(${-e.rot} ${e.pos[0]} ${Y(e.pos[1])})" data-layer="${esc(e.layer)}">${esc(e.text)}</text>`;
    else if (e.type === 'DIMENSION') s += `<text x="${e.pos[0]}" y="${Y(e.pos[1])}" font-size="${sw * 9}" fill="#2e5c8a" text-anchor="middle">${esc(e.text || (e.measure != null ? Math.round(e.measure) : ''))}</text>`; }
  return s + '</svg>';
}
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const ACI = { 1: '#d32f2f', 2: '#c9a800', 3: '#2e7d32', 4: '#0097a7', 5: '#1565c0', 6: '#ad1457', 7: '#1f2937', 8: '#6b7280', 9: '#9ca3af', 30: '#e65100', 250: '#444', 251: '#666', 252: '#888', 253: '#aaa', 254: '#ccc' };
