// 図面（SVG）生成: 部品パラメータから投影図・断面図・寸法・公差・幾何公差・表題欄を描き、検査項目 No のバルーンと
// 「図面への書き込み」（測定値を赤字で寸法の横に記入 ＝ 現在の手作業の再現）を重ねる
const STATUS_COL = { ok: '#3e6b4a', warn: '#b8862a', ng: '#c0392b', na: '#9a948a' };
const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const GDT_SYM = { pos: '⌖', perp: '⟂', flat: '⏥', para: '∥', runout: '↗', coax: '◎', cyl: '⌭' };

export class Sheet {
  constructor({ w = 420, h = 297, px = 3 } = {}) { this.w = w; this.h = h; this.px = px; this.els = []; this.dims = {}; this.defs = []; this.balloons = []; }
  // ビュー座標系: 原点 (ox, oy)[mm, 用紙]、縮尺 s。部品座標 (u, v) → 用紙 (ox + u s, oy − v s)
  view(ox, oy, s = 1) { return { ox, oy, s, X: u => ox + u * s, Y: v => oy - v * s }; }
  add(svg) { this.els.push(svg); }
  line(x1, y1, x2, y2, cls = 'ln') { this.add(`<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" class="${cls}"/>`); }
  path(d, cls = 'ln') { this.add(`<path d="${d}" class="${cls}"/>`); }
  circle(cx, cy, r, cls = 'ln') { this.add(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" class="${cls}"/>`); }
  text(x, y, t, cls = 'tx', extra = '') { this.add(`<text x="${f(x)}" y="${f(y)}" class="${cls}" ${extra}>${esc(t)}</text>`); }
  center(cx, cy, r) { const e = r + 2; this.line(cx - e, cy, cx + e, cy, 'cl'); this.line(cx, cy - e, cx, cy + e, 'cl'); }
  // ---- 寸法 ----
  arrow(x, y, ang) { const a = ang, l = 2.6, w = 0.8; const p1 = [x + l * Math.cos(a) - w * Math.sin(a), y + l * Math.sin(a) + w * Math.cos(a)], p2 = [x + l * Math.cos(a) + w * Math.sin(a), y + l * Math.sin(a) - w * Math.cos(a)]; this.add(`<path d="M${f(x)},${f(y)} L${f(p1[0])},${f(p1[1])} L${f(p2[0])},${f(p2[1])} Z" class="ar"/>`); }
  reg(no, x, y, { w = 10, side = 'above' } = {}) { if (no == null) return; this.dims[no] = { x, y, w, side }; }
  // 水平寸法: 点 (x1,y) と (x2,y) の間、寸法線の y = yd
  dimH(x1, x2, y, yd, label, no, { ext = true } = {}) { const dir = yd < y ? -1 : 1; if (ext) { this.line(x1, y + dir * 1, x1, yd + dir * 2, 'ext'); this.line(x2, y + dir * 1, x2, yd + dir * 2, 'ext'); } const lo = Math.min(x1, x2), hi = Math.max(x1, x2); const inside = hi - lo > 12; if (inside) { this.line(lo, yd, hi, yd, 'dim'); this.arrow(lo, yd, 0); this.arrow(hi, yd, Math.PI); } else { this.line(lo - 8, yd, hi + 8, yd, 'dim'); this.arrow(lo, yd, Math.PI); this.arrow(hi, yd, 0); } const cx = (lo + hi) / 2; this.text(cx, yd - 1.2, label, 'dt', 'text-anchor="middle"'); this.reg(no, cx, yd - 1.2, { w: label.length * 2.2 }); }
  dimV(y1, y2, x, xd, label, no, { ext = true } = {}) { const dir = xd < x ? -1 : 1; if (ext) { this.line(x + dir * 1, y1, xd + dir * 2, y1, 'ext'); this.line(x + dir * 1, y2, xd + dir * 2, y2, 'ext'); } const lo = Math.min(y1, y2), hi = Math.max(y1, y2); const inside = hi - lo > 12; if (inside) { this.line(xd, lo, xd, hi, 'dim'); this.arrow(xd, lo, Math.PI / 2); this.arrow(xd, hi, -Math.PI / 2); } else { this.line(xd, lo - 8, xd, hi + 8, 'dim'); this.arrow(xd, lo, -Math.PI / 2); this.arrow(xd, hi, Math.PI / 2); } const cy = (lo + hi) / 2; this.text(xd - 1.2, cy, label, 'dt', `text-anchor="middle" transform="rotate(-90 ${f(xd - 1.2)} ${f(cy)})"`); this.reg(no, xd - 1.2, cy, { w: 10, side: 'left' }); }
  // 直径寸法（円内の斜め寸法線）
  dimDia(cx, cy, r, ang, label, no, { outside = false } = {}) { const c = Math.cos(ang), s = Math.sin(ang); const x1 = cx - r * c, y1 = cy - r * s, x2 = cx + r * c, y2 = cy + r * s; if (!outside) { this.line(x1, y1, x2, y2, 'dim'); this.arrow(x1, y1, ang); this.arrow(x2, y2, ang + Math.PI); const tx = x2 + 6 * c, ty = y2 + 6 * s; this.line(x2, y2, tx, ty, 'dim'); this.line(tx, ty, tx + 8 * Math.sign(c || 1), ty, 'dim'); this.text(tx + (c >= 0 ? 1 : -1), ty - 1, label, 'dt', c >= 0 ? '' : 'text-anchor="end"'); this.reg(no, tx + (c >= 0 ? 4 : -4), ty - 1); } else { const tx = x2 + 10 * c, ty = y2 + 10 * s; this.line(x2, y2, tx, ty, 'dim'); this.arrow(x2, y2, ang); this.line(tx, ty, tx + 8 * Math.sign(c || 1), ty, 'dim'); this.text(tx + (c >= 0 ? 1 : -1), ty - 1, label, 'dt', c >= 0 ? '' : 'text-anchor="end"'); this.reg(no, tx + (c >= 0 ? 4 : -4), ty - 1); } }
  // 引出線（leader）: 点 (x,y) から (tx,ty) へ、水平棚 + ラベル（複数行可）。注記は配列で行ごとに no を付けられる
  leader(x, y, tx, ty, lines, { dot = false, frame = null } = {}) { this.line(x, y, tx, ty, 'dim'); if (dot) this.circle(x, y, 0.5, 'dot'); else this.arrow(x, y, Math.atan2(ty - y, tx - x)); const dir = tx >= x ? 1 : -1; const maxw = Math.max(...lines.map(l => (l.text || l).length)) * 2.1 + 2; this.line(tx, ty, tx + dir * maxw, ty, 'dim'); lines.forEach((l, i) => { const t = l.text || l, no = l.no; const yy = ty - 1 + i * 4.2; this.text(tx + dir * 1, yy, t, 'dt', dir < 0 ? 'text-anchor="end"' : ''); if (no != null) this.reg(no, tx + dir * (maxw / 2), yy, { w: maxw }); if (i > 0 && lines.length > 1) { } }); if (frame) this.gdtFrame(tx + (dir < 0 ? -maxw : 0), ty + 1.5, frame); }
  // 幾何公差枠: [{ sym, val, datum }] を縦に積む
  gdtFrame(x, y, frames) { let yy = y; for (const fr of frames) { const cells = [GDT_SYM[fr.sym] || fr.sym, fr.val, ...(fr.datum ? fr.datum.split('|') : [])]; let xx = x; const hgt = 5.2; for (const [i, c] of cells.entries()) { const w = i === 0 ? 5.2 : i === 1 ? Math.max(8, String(c).length * 2.1 + 2) : 5; this.add(`<rect x="${f(xx)}" y="${f(yy)}" width="${f(w)}" height="${hgt}" class="fr"/>`); this.text(xx + w / 2, yy + 3.8, c, 'dt', 'text-anchor="middle"'); if (i === 1 && fr.no != null) this.reg(fr.no, xx + w / 2, yy + 3.8, { w, side: 'frame' }); xx += w; } yy += hgt + 0.8; } }
  datum(x, y, label, ang = 0) { const c = Math.cos(ang), s = Math.sin(ang); const bx = x + 5 * c, by = y + 5 * s; this.add(`<path d="M${f(x)},${f(y)} L${f(x + 2 * c - 1.4 * s)},${f(y + 2 * s + 1.4 * c)} L${f(x + 2 * c + 1.4 * s)},${f(y + 2 * s - 1.4 * c)} Z" class="fr dk"/>`); this.line(x + 2 * c, y + 2 * s, bx, by, 'dim'); const cx = bx + 2.5 * c, cy = by + 2.5 * s; this.add(`<rect x="${f(cx - 2.5)}" y="${f(cy - 2.5)}" width="5" height="5" class="fr"/>`); this.text(cx, cy + 1.3, label, 'dt', 'text-anchor="middle"'); }
  roughness(x, y, val, no) { this.add(`<path d="M${f(x)},${f(y)} l1.6,-4 l1.2,4 l3,-6" class="dim"/>`); this.text(x + 4.2, y - 3.5, val, 'dt'); this.reg(no, x + 4.2 + val.length, y - 3.5); }
  hatch(id, polys, view) { const d = polys.map(poly => 'M' + poly.map(([u, v]) => `${f(view.X(u))},${f(view.Y(v))}`).join(' L') + ' Z').join(' '); this.defs.push(`<clipPath id="${id}"><path d="${d}"/></clipPath>`); const xs = polys.flat().map(p => view.X(p[0])), ys = polys.flat().map(p => view.Y(p[1])); const x0 = Math.min(...xs) - 5, x1 = Math.max(...xs) + 5, y0 = Math.min(...ys) - 5, y1 = Math.max(...ys) + 5; let h = ''; for (let k = x0 - (y1 - y0); k < x1; k += 2.2) h += `M${f(k)},${f(y1)} L${f(k + (y1 - y0))},${f(y0)} `; this.add(`<path d="${h}" class="ht" clip-path="url(#${id})"/>`); this.path(d, 'ln'); }
  // ---- 出力 ----
  balloon(no, status = 'na') { const d = this.dims[no]; if (!d) return; let bx = d.x - d.w / 2 - 3.2, by = d.y - 1.2; if (d.side === 'left') { bx = d.x - 3.5; by = d.y - d.w / 2 - 4; } if (d.side === 'frame') { bx = d.x; by = d.y - 6.2; } this.balloons.push(`<g class="bl ${status}" data-no="${no}"><circle cx="${f(bx)}" cy="${f(by)}" r="2.9"/><text x="${f(bx)}" y="${f(by + 1.1)}" text-anchor="middle">${no}</text></g>`); }
  annotate(no, lines, status) { const d = this.dims[no]; if (!d) return; const x = d.side === 'left' ? d.x - 6 : d.x + d.w / 2 + 1.5, y0 = d.side === 'left' ? d.y + 4 : d.y + 3.6; const col = STATUS_COL[status] || STATUS_COL.na; lines.forEach((t, i) => this.add(`<text x="${f(x)}" y="${f(y0 + i * 3.4)}" class="an" style="fill:${t.col || col}" data-no="${no}">${esc(t.text || t)}</text>`)); }
  svg({ title = '', titleBlock = null, cls = '' } = {}) { const W = this.w * this.px, H = this.h * this.px; return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}" width="${W}" height="${H}" class="dwg ${cls}"><defs>${this.defs.join('')}</defs><rect x="0" y="0" width="${this.w}" height="${this.h}" class="paper"/><rect x="10" y="10" width="${this.w - 20}" height="${this.h - 20}" class="frame"/>${this.els.join('')}${titleBlock || ''}${this.balloons.join('')}</svg>`; }
}
const f = n => (Math.round(n * 100) / 100).toString();
function titleBlock(sh, part, { annotated = false, piece = null } = {}) { const x = sh.w - 10 - 150, y = sh.h - 10 - 40; const r = (yy, k, v, w1 = 28) => { sh.text(x + 2, yy, k, 'tk'); sh.text(x + w1, yy, v, 'tv'); }; let s = `<g class="tb"><rect x="${x}" y="${y}" width="150" height="40" class="fr"/><line x1="${x}" y1="${y + 12}" x2="${x + 150}" y2="${y + 12}" class="fr"/><line x1="${x + 75}" y1="${y + 12}" x2="${x + 75}" y2="${y + 40}" class="fr"/>`; s += `<text x="${x + 4}" y="${y + 8}" class="tt">${esc(part.name)}</text><text x="${x + 148}" y="${y + 8}" class="tv" text-anchor="end">図番 ${esc(part.drawingNo)}  Rev.${esc(part.rev)}</text>`; const rows = [['材質', part.material], ['表面処理', part.finish], ['尺度', '1:1'], ['一般公差', 'JIS B 0405 m']]; const rows2 = [['顧客', part.customer], ['製作', part.vendor], ['数量', `${part.qty}（${part.lot}）`], [annotated ? '検査' : '', annotated ? `${piece ? '個体 ' + piece.sn : '全個体'} ・ ${new Date().toLocaleDateString('ja-JP')}` : '']]; rows.forEach(([k, v], i) => { s += `<text x="${x + 3}" y="${y + 18 + i * 6}" class="tk">${esc(k)}</text><text x="${x + 24}" y="${y + 18 + i * 6}" class="tv">${esc(v)}</text>`; }); rows2.forEach(([k, v], i) => { s += `<text x="${x + 78}" y="${y + 18 + i * 6}" class="tk">${esc(k)}</text><text x="${x + 96}" y="${y + 18 + i * 6}" class="tv">${esc(v)}</text>`; }); s += `<text x="12" y="${sh.h - 12}" class="tk">ANGLEX INSPECT — デモ図面（架空データ）</text></g>`; return s; }
const tolStr = it => { if (!it.tol) return ''; const [u, l] = it.tol; if (it.tolLabel) return it.tolLabel; if (Math.abs(u) === Math.abs(l)) return `±${trim(u)}`; return `${u >= 0 ? '+' : ''}${trim(u)}/${l >= 0 ? '+' : ''}${trim(l)}`; };
const trim = v => { let s = Math.abs(v).toFixed(3).replace(/0+$/, '').replace(/\.$/, ''); if (s === '') s = '0'; return (v < 0 ? '-' : '') + s; };
const dimLabel = (it, pre = '') => `${pre}${typeof it.nominal === 'number' ? trim(it.nominal) : it.nominal}${it.tol ? ' ' + tolStr(it) : ''}`;

// ====================================================================== ハウジング
function drawHousing(sh, part) {
  const P = part.params, I = Object.fromEntries(part.items.map(it => [it.no, it])); const L2 = P.L / 2, W2 = P.Wd / 2;
  // ---- 平面図（左上）----
  const T = sh.view(130, 125, 1); const X = T.X, Y = T.Y;
  // 外形（R 付き矩形）
  const R = P.cornerR; sh.path(`M${f(X(-L2 + R))},${f(Y(-W2))} H${f(X(L2 - R))} A${R},${R} 0 0 0 ${f(X(L2))},${f(Y(-W2 + R))} V${f(Y(W2 - R))} A${R},${R} 0 0 0 ${f(X(L2 - R))},${f(Y(W2))} H${f(X(-L2 + R))} A${R},${R} 0 0 0 ${f(X(-L2))},${f(Y(W2 - R))} V${f(Y(-W2 + R))} A${R},${R} 0 0 0 ${f(X(-L2 + R))},${f(Y(-W2))} Z`, 'ln');
  sh.circle(X(0), Y(0), P.bossD / 2); sh.circle(X(0), Y(0), P.bossD / 2 - P.c, 'th'); sh.circle(X(0), Y(0), P.seatD / 2); sh.circle(X(0), Y(0), P.seatD / 2 + P.seatC, 'th'); sh.circle(X(0), Y(0), P.throughD / 2); sh.center(X(0), Y(0), P.bossD / 2);
  const mounts = [[P.pitchX / 2, P.pitchY / 2], [-P.pitchX / 2, P.pitchY / 2], [-P.pitchX / 2, -P.pitchY / 2], [P.pitchX / 2, -P.pitchY / 2]]; for (const [x, p] of mounts) { sh.circle(X(x), Y(p), P.mountD / 2); sh.circle(X(x), Y(p), P.cboreD / 2); sh.center(X(x), Y(p), P.cboreD / 2); }
  for (const x of [P.dowelPitch / 2, -P.dowelPitch / 2]) { sh.circle(X(x), Y(0), P.dowelD / 2); sh.center(X(x), Y(0), P.dowelD / 2); }
  sh.circle(X(0), Y(0), P.tapPCD / 2, 'cl'); for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; const x = P.tapPCD / 2 * Math.cos(a), p = P.tapPCD / 2 * Math.sin(a); sh.circle(X(x), Y(p), P.tapDrill / 2); sh.add(`<path d="M${f(X(x) + 2)},${f(Y(p))} A2,2 0 1 1 ${f(X(x))},${f(Y(p) - 2)}" class="th"/>`); }
  // 寸法（平面図）
  sh.dimH(X(-L2), X(L2), Y(-W2), Y(-W2) + 22, dimLabel(I[1]), 1); sh.dimV(Y(-W2), Y(W2), X(L2), X(L2) + 30, dimLabel(I[2]), 2);
  sh.dimH(X(-P.pitchX / 2), X(P.pitchX / 2), Y(W2), Y(W2) - 12, dimLabel(I[15]), 15); sh.dimV(Y(-P.pitchY / 2), Y(P.pitchY / 2), X(L2), X(L2) + 18, dimLabel(I[16]), 16);
  sh.dimH(X(-P.dowelPitch / 2), X(P.dowelPitch / 2), Y(0), Y(-W2) + 12, dimLabel(I[18]), 18, { ext: true });
  sh.dimDia(X(0), Y(0), P.bossD / 2, -Math.PI / 5, dimLabel(I[5], 'φ'), 5);
  sh.leader(X(mounts[1][0] - P.cboreD / 2 * 0.7), Y(mounts[1][1] + P.cboreD / 2 * 0.7), X(mounts[1][0]) - 22, Y(mounts[1][1]) - 22, [{ text: `4-${dimLabel(I[12], 'φ')} 通し`, no: 12 }, { text: `ザグリ ${dimLabel(I[13], 'φ')}`, no: 13 }, { text: `深さ ${dimLabel(I[14])}`, no: 14 }]);
  sh.leader(X(-P.dowelPitch / 2 - P.dowelD / 2 * 0.7), Y(P.dowelD / 2 * 0.7), X(-P.dowelPitch / 2) - 24, Y(0) - 24, [{ text: `2-${dimLabel(I[17], 'φ')}`, no: 17 }, { text: '（ノックピン穴）' }], { frame: [{ sym: 'pos', val: `φ${trim(I[27].tol[0])}`, datum: 'A|B', no: 27 }] });
  sh.datum(X(-P.dowelPitch / 2), Y(-P.dowelD / 2), 'C', Math.PI / 2);
  { const a = Math.PI / 4; const x = P.tapPCD / 2 * Math.cos(a), p = P.tapPCD / 2 * Math.sin(a); sh.leader(X(x) + 1.5, Y(p) - 1.5, X(x) + 24, Y(p) - 18, [{ text: `4-${I[19].nominal} 深さ ${P.tapDepth}`, no: 19 }, { text: `PCD ${P.tapPCD} 等配` }]); }
  sh.leader(X(L2 - R * 0.3), Y(-W2 + R * 0.3), X(L2) + 10, Y(-W2) - 2, [{ text: `4-R${trim(I[20].nominal)} ${tolStr(I[20])}`, no: 20 }]);
  sh.text(X(0), Y(W2) - 30, 'A', 'sec', 'text-anchor="middle"'); sh.text(X(0), Y(-W2) + 34, 'A', 'sec', 'text-anchor="middle"'); sh.line(X(-L2) - 8, Y(0), X(-L2) - 2, Y(0), 'sl'); sh.line(X(L2) + 2, Y(0), X(L2) + 8, Y(0), 'sl'); sh.arrow(X(-L2) - 8, Y(0) - 0.01, Math.PI / 2); sh.arrow(X(L2) + 8, Y(0) - 0.01, Math.PI / 2); sh.text(X(-L2) - 12, Y(0) + 1.5, 'A', 'sec', 'text-anchor="middle"'); sh.text(X(L2) + 12, Y(0) + 1.5, 'A', 'sec', 'text-anchor="middle"');
  // ---- 断面 A-A（右）----
  const S = sh.view(300, 220, 1); const sX = S.X, sY = S.Y; const rb = P.bossD / 2, rs = P.seatD / 2, rt = P.throughD / 2, rg = P.grooveD / 2, rd = P.dowelD / 2, dx = P.dowelPitch / 2; const ySeat = P.H - P.seatDepth, yG0 = P.grooveY, yG1 = P.grooveY + P.grooveW;
  const right = [[rt, 0], [dx - rd, 0], [dx - rd, P.T], [rb, P.T], [rb, P.H - P.c], [rb - P.c, P.H], [rs + P.seatC, P.H], [rs, P.H - P.seatC], [rs, yG1], [rg, yG1], [rg, yG0], [rs, yG0], [rs, ySeat], [rt, ySeat]]; const rightOuter = [[dx + rd, 0], [L2 - P.c, 0], [L2, P.c], [L2, P.T - P.c], [L2 - P.c, P.T], [dx + rd, P.T]];
  const mirror = poly => poly.map(([u, v]) => [-u, v]); sh.hatch('hA', [right, rightOuter, mirror(right), mirror(rightOuter)], S);
  sh.line(sX(-L2 - 8), sY(0), sX(L2 + 8), sY(0), 'ext'); sh.line(sX(0), sY(-6), sX(0), sY(P.H + 8), 'cl');
  sh.text(sX(0), sY(P.H) - 14, '断面 A-A', 'sec', 'text-anchor="middle"');
  sh.dimV(sY(0), sY(P.H), sX(rb), sX(rb) + 30, dimLabel(I[4]), 4); sh.dimV(sY(0), sY(P.T), sX(L2), sX(L2) + 12, dimLabel(I[3]), 3);
  sh.dimV(sY(ySeat), sY(P.H), sX(-rs), sX(-rb) - 14, dimLabel(I[7]), 7); sh.dimV(sY(0), sY(yG0), sX(-L2), sX(-L2) - 12, dimLabel(I[11]), 11);
  sh.dimH(sX(-rs), sX(rs), sY(P.H), sY(P.H) - 10, dimLabel(I[6], 'φ'), 6); sh.gdtFrame(sX(rs) + 8, sY(P.H) - 20, [{ sym: 'pos', val: `φ${trim(I[22].tol[0])}`, datum: 'A|C', no: 22 }, { sym: 'perp', val: trim(I[23].tol[0]), datum: 'A', no: 23 }]); sh.line(sX(rs) + 8, sY(P.H) - 17, sX(rs) + 2, sY(P.H) - 10, 'dim'); sh.datum(sX(rs) - 6, sY(P.H) - 10 + 0.5, 'B', Math.PI / 2);
  sh.dimH(sX(-rt), sX(rt), sY(0), sY(0) + 10, dimLabel(I[8], 'φ'), 8);
  sh.leader(sX(rg), sY((yG0 + yG1) / 2), sX(rb) + 14, sY(yG1) + 6, [{ text: `溝 ${dimLabel(I[9], 'φ')}`, no: 9 }, { text: `幅 ${dimLabel(I[10])}`, no: 10 }]);
  sh.leader(sX(-rs - P.seatC / 2), sY(P.H - P.seatC / 2), sX(-rb) - 10, sY(P.H) - 6, [{ text: `C${trim(I[21].nominal)}`, no: 21 }]);
  sh.roughness(sX(-rs) - 1, sY(ySeat + 4), `Ra${trim(I[26].tol[0])}`, 26);
  sh.datum(sX(L2 - 12), sY(0) + 0.5, 'A', Math.PI / 2); sh.gdtFrame(sX(L2 - 30), sY(0) + 12, [{ sym: 'flat', val: trim(I[24].tol[0]), no: 24 }]); sh.line(sX(L2 - 22), sY(0) + 12, sX(L2 - 22), sY(0) + 0.5, 'dim');
  sh.gdtFrame(sX(-rb) - 2, sY(P.H) - 28, [{ sym: 'para', val: trim(I[25].tol[0]), datum: 'A', no: 25 }]); sh.line(sX(-rb) + 6, sY(P.H) - 22.8, sX(-rb) + 6, sY(P.H) - 0.5, 'dim'); sh.arrow(sX(-rb) + 6, sY(P.H) - 0.5, -Math.PI / 2);
  sh.text(20, 20, '注記: 1. 指示なき面取り C0.5　2. 指示なき公差 JIS B 0405-m　3. 全周バリなきこと　4. 材料証明書添付', 'note');
}
// ====================================================================== シャフト
function drawShaft(sh, part) {
  const P = part.params, I = Object.fromEntries(part.items.map(it => [it.no, it])); const V = sh.view(60, 120, 1.6); const X = V.X, Y = V.Y;
  const rT = P.thread.d / 2, rR = P.relief.d / 2, r1 = P.j1.d / 2, rM = P.mid.d / 2, rE = P.end.d / 2, rG = P.groove.d / 2; const a0 = P.thread.len, a1 = a0 + P.relief.len, aS1 = P.j1.a1, aS2 = P.mid.a1, aS3 = P.j2.a1, aG0 = P.groove.a, aG1 = aG0 + P.groove.w;
  const prof = [[0, 0], [0, rT - P.thread.c], [P.thread.c, rT], [a0, rT], [a0, rR], [a1, rR], [a1, r1 - P.c], [a1 + P.c, r1], [aG0, r1], [aG0, rG], [aG1, rG], [aG1, r1], [aS1, r1], [aS1, rM - P.c], [aS1 + P.c, rM], [aS2 - P.c, rM], [aS2, rM - P.c], [aS2, r1], [aS3 - P.c, r1], [aS3, r1 - P.c], [aS3, rE], [P.L - P.end.c, rE], [P.L, rE - P.end.c], [P.L, 0]];
  const d = 'M' + prof.map(([a, r]) => `${f(X(a))},${f(Y(r))}`).join(' L') + ' L' + prof.slice().reverse().map(([a, r]) => `${f(X(a))},${f(Y(-r))}`).join(' L') + ' Z'; sh.path(d, 'ln');
  sh.line(X(-6), Y(0), X(P.L + 6), Y(0), 'cl'); // 中心線
  // 段の線（径が変わる位置の縦線）・ねじ（谷径の細線）・面取り線
  for (const a of [a0, a1, aS1, aS2, aS3]) sh.line(X(a), Y(-r1), X(a), Y(r1), 'th'); const rTm = rT - 0.613 * P.thread.pitch; sh.line(X(P.thread.c), Y(rTm), X(a0), Y(rTm), 'th'); sh.line(X(P.thread.c), Y(-rTm), X(a0), Y(-rTm), 'th');
  for (const [a, r] of [[P.thread.c, rT], [a1 + P.c, r1], [aS1 + P.c, rM], [aS2 - P.c, rM], [aS3 - P.c, r1], [P.L - P.end.c, rE]]) sh.line(X(a), Y(-r), X(a), Y(r), 'th');
  // キー溝（上面から見える: スタジアム）
  const k = P.keyway; const rk = k.w / 2; sh.path(`M${f(X(k.a0 + rk))},${f(Y(rk))} H${f(X(k.a1 - rk))} A${f(rk * V.s)},${f(rk * V.s)} 0 0 1 ${f(X(k.a1 - rk))},${f(Y(-rk))} H${f(X(k.a0 + rk))} A${f(rk * V.s)},${f(rk * V.s)} 0 0 1 ${f(X(k.a0 + rk))},${f(Y(rk))} Z`, 'ln');
  // センター穴（隠れ線）
  sh.line(X(P.L - P.center.depth), Y(P.center.d / 2), X(P.L - 2.6), Y(P.center.d / 2), 'hd'); sh.line(X(P.L - P.center.depth), Y(-P.center.d / 2), X(P.L - 2.6), Y(-P.center.d / 2), 'hd'); sh.line(X(P.L - 2.6), Y(P.center.d / 2), X(P.L), Y(P.center.D / 2), 'hd'); sh.line(X(P.L - 2.6), Y(-P.center.d / 2), X(P.L), Y(-P.center.D / 2), 'hd'); sh.line(X(P.L - P.center.depth), Y(-P.center.d / 2), X(P.L - P.center.depth), Y(P.center.d / 2), 'hd');
  // 寸法
  sh.dimH(X(0), X(P.L), Y(-rM), Y(-rM) + 40, dimLabel(I[1]), 1); sh.dimH(X(0), X(aS1), Y(-rM), Y(-rM) + 30, dimLabel(I[8]), 8); sh.dimH(X(a1), X(aS1), Y(-r1), Y(-rM) + 20, dimLabel(I[9]), 9); sh.dimH(X(0), X(a0), Y(-rT), Y(-rM) + 10, `${trim(P.thread.len)}`, null);
  sh.dimH(X(k.a0), X(k.a1), Y(rk), Y(rM) - 10, dimLabel(I[12]), 12); sh.dimH(X(aG0), X(aG1), Y(r1), Y(rM) - 22, dimLabel(I[14]), 14, { ext: true });
  sh.dimV(Y(-r1), Y(r1), X((a1 + aG0) / 2), X((a1 + aG0) / 2) + 0.01, '', null, { ext: false });
  sh.dimV(Y(-r1), Y(r1), X(a1 + 8), X(a1 + 8), dimLabel(I[2], 'φ'), 2, { ext: false }); sh.dimV(Y(-rM), Y(rM), X(aS1 + 2), X(aS1 + 2), dimLabel(I[4], 'φ'), 4, { ext: false }); sh.dimV(Y(-r1), Y(r1), X(aS2 + 8), X(aS2 + 8), dimLabel(I[3], 'φ'), 3, { ext: false }); sh.dimV(Y(-rE), Y(rE), X(aS3 + 10), X(aS3 + 10), dimLabel(I[5], 'φ'), 5, { ext: false });
  sh.leader(X(a0 / 2), Y(rT), X(a0 / 2) - 10, Y(rT) - 14, [{ text: `${I[6].nominal}-6g`, no: 6 }]); sh.leader(X(a0 + 1.5), Y(-rR), X(a0 + 6), Y(-rR) + 16, [{ text: `逃げ ${dimLabel(I[7], 'φ')} 幅 ${P.relief.len}`, no: 7 }]);
  sh.leader(X(aG0 + 0.6), Y(-rG), X(aG0 + 14), Y(-r1) + 12, [{ text: `溝 ${dimLabel(I[13], 'φ')}`, no: 13 }]);
  sh.leader(X(P.L - P.end.c / 2), Y(rE - P.end.c / 2), X(P.L) + 8, Y(rE) - 10, [{ text: `C${trim(I[17].nominal)}`, no: 17 }]); sh.leader(X(P.L - 1), Y(0), X(P.L) + 14, Y(-rE) + 10, [{ text: `センター穴 ${I[19].nominal}`, no: 19 }, { text: 'JIS B 1011' }]);
  sh.roughness(X((a1 + aG0) / 2), Y(r1) - 2, `Ra${trim(I[18].tol[0])}`, 18); sh.datum(X((a1 + aG0) / 2) - 10, Y(-r1) - 0.5, 'A', -Math.PI / 2); sh.datum(X((aS2 + aS3) / 2) + 6, Y(-r1) - 0.5, 'B', -Math.PI / 2);
  sh.gdtFrame(X(aS1 + 10), Y(rM) - 36, [{ sym: 'runout', val: trim(I[15].tol[0]), datum: 'A-B', no: 15 }]); sh.line(X(aS1 + 14), Y(rM) - 30.8, X(aS1 + 14), Y(rM) - 0.5, 'dim'); sh.arrow(X(aS1 + 14), Y(rM) - 0.5, -Math.PI / 2);
  sh.gdtFrame(X(aS2 + 12), Y(-r1) + 14, [{ sym: 'coax', val: `φ${trim(I[16].tol[0])}`, datum: 'A', no: 16 }]); sh.line(X(aS2 + 16), Y(-r1) + 14, X(aS2 + 16), Y(-r1) + 0.5, 'dim'); sh.arrow(X(aS2 + 16), Y(-r1) + 0.5, Math.PI / 2);
  // 断面 B-B（キー溝）
  const B = sh.view(330, 225, 2.2); const bX = B.X, bY = B.Y; const kd = rM - k.t1; const half = rk; const ang = Math.asin(half / rM);
  sh.path(`M${f(bX(-half))},${f(bY(rM * Math.cos(ang)))} A${f(rM * B.s)},${f(rM * B.s)} 0 1 0 ${f(bX(half))},${f(bY(rM * Math.cos(ang)))} V${f(bY(kd))} H${f(bX(-half))} Z`, 'ln'); sh.center(bX(0), bY(0), rM * B.s);
  sh.hatch('hB', [[[-half, rM * Math.cos(ang)], ...Array.from({ length: 48 }, (_, i) => { const t = Math.PI / 2 + ang + (2 * Math.PI - 2 * ang) * i / 47; return [rM * Math.cos(t + Math.PI / 2 - Math.PI / 2 - ang + ang) * 0 + rM * Math.sin(-(t)) * 0 + rM * Math.cos(t), rM * Math.sin(t)]; }), [half, rM * Math.cos(ang)], [half, kd], [-half, kd]]], B);
  sh.text(bX(0), bY(rM) - 10, '断面 B-B', 'sec', 'text-anchor="middle"');
  sh.dimH(bX(-half), bX(half), bY(rM), bY(rM) - 4, dimLabel(I[10]), 10); sh.dimV(bY(kd), bY(rM), bX(half), bX(half) + 12, dimLabel(I[11]), 11); sh.dimV(bY(-rM), bY(kd), bX(-rM), bX(-rM) - 10, `${trim(rM + kd)}`, null);
  sh.text(X(k.a0 + 15), Y(rM) - 2, 'B', 'sec', 'text-anchor="middle"'); sh.line(X(k.a0 + 15), Y(rM) - 2, X(k.a0 + 15), Y(rM) - 8, 'sl'); sh.text(X(k.a0 + 15), Y(-rM) + 6, 'B', 'sec', 'text-anchor="middle"'); sh.line(X(k.a0 + 15), Y(-rM) + 2, X(k.a0 + 15), Y(-rM) + 8, 'sl');
  sh.text(20, 20, '注記: 1. 指示なき面取り C0.5　2. 熱処理 調質 HRC 22-28　3. 指示なき公差 JIS B 0405-m　4. 軸受部は研磨仕上げ', 'note');
}
// ====================================================================== ブラケット
function drawBracket(sh, part) {
  const P = part.params, I = Object.fromEntries(part.items.map(it => [it.no, it])); const Ro = P.Ri + P.t;
  // 正面図（左上）: X 右・Y 上
  const Fv = sh.view(60, 110, 1.5); const X = Fv.X, Y = Fv.Y;
  sh.path(`M${f(X(P.L))},${f(Y(0))} H${f(X(Ro))} A${f(Ro * Fv.s)},${f(Ro * Fv.s)} 0 0 1 ${f(X(0))},${f(Y(Ro))} V${f(Y(P.Hh))} H${f(X(P.t))} V${f(Y(Ro))} A${f(P.Ri * Fv.s)},${f(P.Ri * Fv.s)} 0 0 0 ${f(X(Ro))},${f(Y(P.t))} H${f(X(P.L))} Z`, 'ln');
  for (const [x] of P.baseHoles) { sh.line(X(x - P.baseHoleD / 2), Y(0), X(x - P.baseHoleD / 2), Y(P.t), 'hd'); sh.line(X(x + P.baseHoleD / 2), Y(0), X(x + P.baseHoleD / 2), Y(P.t), 'hd'); }
  for (const [y] of P.legHoles) { sh.line(X(0), Y(y - P.legHoleD / 2), X(P.t), Y(y - P.legHoleD / 2), 'hd'); sh.line(X(0), Y(y + P.legHoleD / 2), X(P.t), Y(y + P.legHoleD / 2), 'hd'); } sh.line(X(0), Y(P.legSlot.y - P.legSlot.w / 2), X(P.t), Y(P.legSlot.y - P.legSlot.w / 2), 'hd'); sh.line(X(0), Y(P.legSlot.y + P.legSlot.w / 2), X(P.t), Y(P.legSlot.y + P.legSlot.w / 2), 'hd');
  sh.dimH(X(0), X(P.L), Y(0), Y(0) + 14, dimLabel(I[1]), 1); sh.dimV(Y(0), Y(P.Hh), X(0), X(0) - 14, dimLabel(I[3]), 3); sh.dimV(Y(0), Y(P.t), X(P.L), X(P.L) + 10, dimLabel(I[4]), 4);
  sh.leader(X(Ro - P.Ri * 0.7), Y(Ro - P.Ri * 0.7), X(Ro) + 12, Y(Ro) + 10, [{ text: `内 R${trim(I[6].nominal)} ${tolStr(I[6])}`, no: 6 }]);
  { const ax = X(P.t) + 2, ay = Y(P.Hh - 12); sh.add(`<path d="M${f(X(P.t) + 14)},${f(Y(P.t))} A14,14 0 0 0 ${f(X(P.t))},${f(Y(P.t) - 14)}" class="dim"/>`); sh.text(X(P.t) + 10, Y(P.t) - 10, `${trim(I[5].nominal)}° ${tolStr(I[5])}`, 'dt'); sh.reg(5, X(P.t) + 16, Y(P.t) - 10, { w: 14 }); }
  sh.datum(X(P.L - 10), Y(0) + 0.5, 'A', Math.PI / 2); sh.gdtFrame(X(P.L - 28), Y(0) + 24, [{ sym: 'flat', val: trim(I[14].tol[0]), no: 14 }]); sh.line(X(P.L - 20), Y(0) + 24, X(P.L - 20), Y(0) + 0.5, 'dim'); sh.datum(X(0) - 0.5, Y(P.Hh - 8), 'B', Math.PI);
  sh.text(X(P.L / 2), Y(P.Hh) - 6, '正面図', 'sec', 'text-anchor="middle"');
  // 平面図（下）: X 右・Z 下（p = −Z 上）
  const Tv = sh.view(60, 215, 1.5); const tX = Tv.X, tY = Tv.Y; sh.path(`M${f(tX(0))},${f(tY(-P.Wd / 2))} H${f(tX(P.L))} V${f(tY(P.Wd / 2))} H${f(tX(0))} Z`, 'ln'); sh.line(tX(P.t), tY(-P.Wd / 2), tX(P.t), tY(P.Wd / 2), 'ln'); sh.line(tX(Ro), tY(-P.Wd / 2), tX(Ro), tY(P.Wd / 2), 'th');
  for (const [x, z] of P.baseHoles) { sh.circle(tX(x), tY(-z), P.baseHoleD / 2 * Tv.s); sh.center(tX(x), tY(-z), P.baseHoleD / 2 * Tv.s); }
  sh.dimV(tY(-P.Wd / 2), tY(P.Wd / 2), tX(P.L), tX(P.L) + 12, dimLabel(I[2]), 2); sh.dimV(tY(-P.baseHoles[0][1]), tY(-P.baseHoles[1][1]), tX(P.baseHoles[0][0]), tX(P.baseHoles[0][0]) + 20, dimLabel(I[8]), 8); sh.dimH(tX(0), tX(P.baseHoles[0][0]), tY(P.Wd / 2), tY(P.Wd / 2) + 12, dimLabel(I[9]), 9);
  sh.leader(tX(P.baseHoles[0][0] + 2), tY(-P.baseHoles[0][1] - 2), tX(P.baseHoles[0][0]) + 12, tY(-P.Wd / 2) - 8, [{ text: `2-${dimLabel(I[7], 'φ')}`, no: 7 }]);
  sh.text(tX(P.L / 2), tY(-P.Wd / 2) - 6, '平面図', 'sec', 'text-anchor="middle"');
  // 側面図（右）: 立板を外面から見る（Z 右・Y 上）
  const Sv = sh.view(250, 110, 1.5); const sX = Sv.X, sY = Sv.Y; sh.path(`M${f(sX(-P.Wd / 2))},${f(sY(0))} H${f(sX(P.Wd / 2))} V${f(sY(P.Hh))} H${f(sX(-P.Wd / 2))} Z`, 'ln'); sh.line(sX(-P.Wd / 2), sY(P.t), sX(P.Wd / 2), sY(P.t), 'ln'); sh.line(sX(-P.Wd / 2), sY(Ro), sX(P.Wd / 2), sY(Ro), 'th');
  const sl = P.legSlot; sh.path(`M${f(sX(sl.z - (sl.len - sl.w) / 2))},${f(sY(sl.y + sl.w / 2))} H${f(sX(sl.z + (sl.len - sl.w) / 2))} A${f(sl.w / 2 * Sv.s)},${f(sl.w / 2 * Sv.s)} 0 0 1 ${f(sX(sl.z + (sl.len - sl.w) / 2))},${f(sY(sl.y - sl.w / 2))} H${f(sX(sl.z - (sl.len - sl.w) / 2))} A${f(sl.w / 2 * Sv.s)},${f(sl.w / 2 * Sv.s)} 0 0 1 ${f(sX(sl.z - (sl.len - sl.w) / 2))},${f(sY(sl.y + sl.w / 2))} Z`, 'ln'); sh.center(sX(sl.z), sY(sl.y), sl.len / 2 * Sv.s);
  for (const [y, z] of P.legHoles) { sh.circle(sX(z), sY(y), P.legHoleD / 2 * Sv.s); sh.center(sX(z), sY(y), P.legHoleD / 2 * Sv.s); }
  sh.dimH(sX(P.legHoles[1][1]), sX(P.legHoles[0][1]), sY(P.Hh), sY(P.Hh) - 10, dimLabel(I[12]), 12); sh.dimV(sY(0), sY(sl.y), sX(P.Wd / 2), sX(P.Wd / 2) + 12, dimLabel(I[13]), 13); sh.dimV(sY(0), sY(P.legHoles[0][0]), sX(P.Wd / 2), sX(P.Wd / 2) + 24, `${trim(P.legHoles[0][0])}`, null);
  sh.leader(sX(sl.z + sl.len / 2 - 1), sY(sl.y - 1), sX(P.Wd / 2) + 10, sY(sl.y) + 16, [{ text: `長穴 ${dimLabel(I[10])} × ${sl.len}`, no: 10 }]); sh.leader(sX(P.legHoles[1][1] - 1.2), sY(P.legHoles[1][0] + 1.2), sX(-P.Wd / 2) - 8, sY(P.Hh) - 14, [{ text: `2-${dimLabel(I[11], 'φ')}`, no: 11 }]);
  sh.text(sX(0), sY(P.Hh) - 6, '側面図（立板外面）', 'sec', 'text-anchor="middle"');
  sh.text(20, 20, `注記: 1. ${I[15].label}: 三価クロメート、ムラ・剥がれなきこと　2. ${I[16].label}: 全周バリなきこと（指触）　3. 指示なき公差 JIS B 0408 B 級`, 'note'); sh.reg(15, 60, 20, { w: 20 }); sh.reg(16, 150, 20, { w: 20 });
}
const DRAWERS = { housing: drawHousing, shaft: drawShaft, bracket: drawBracket };

// ---- 公開 API ----
// opts: { balloons: {no: status}, annotations: {no: [{text, col}]}, piece }
export function renderDrawing(part, { statuses = null, annotations = null, piece = null, annotated = false } = {}) {
  const sh = new Sheet(); DRAWERS[part.model](sh, part);
  if (statuses) for (const it of part.items) sh.balloon(it.no, statuses[it.no] || 'na');
  if (annotations) for (const [no, lines] of Object.entries(annotations)) sh.annotate(+no, lines, statuses?.[no] || 'na');
  return sh.svg({ titleBlock: titleBlock(sh, part, { annotated, piece }), cls: annotated ? 'annotated' : '' });
}
export const DRAWING_CSS = `
.dwg{background:#fff;font-family:"IBM Plex Sans JP","Noto Sans JP",sans-serif}.dwg .paper{fill:#fff}.dwg .frame{fill:none;stroke:#1a1a17;stroke-width:.5}
.dwg .ln{fill:none;stroke:#1a1a17;stroke-width:.5;stroke-linejoin:round}.dwg .th{fill:none;stroke:#1a1a17;stroke-width:.2}.dwg .hd{fill:none;stroke:#1a1a17;stroke-width:.25;stroke-dasharray:1.6 .8}.dwg .cl{fill:none;stroke:#1a1a17;stroke-width:.18;stroke-dasharray:4 .8 .8 .8}
.dwg .ext{fill:none;stroke:#1a1a17;stroke-width:.18}.dwg .dim{fill:none;stroke:#1a1a17;stroke-width:.2}.dwg .ar{fill:#1a1a17;stroke:none}.dwg .dot{fill:#1a1a17}.dwg .sl{stroke:#1a1a17;stroke-width:.6}
.dwg .dt{font-size:3.2px;fill:#1a1a17;font-family:"JetBrains Mono","IBM Plex Sans JP",monospace}.dwg .sec{font-size:4px;font-weight:700;fill:#1a1a17}.dwg .note{font-size:3px;fill:#1a1a17}.dwg .fr{fill:#fff;stroke:#1a1a17;stroke-width:.25}.dwg .fr.dk{fill:#1a1a17}.dwg .ht{fill:none;stroke:#1a1a17;stroke-width:.15}
.dwg .tb .tt{font-size:4.2px;font-weight:700;fill:#1a1a17}.dwg .tk{font-size:2.6px;fill:#6f6f68}.dwg .tv{font-size:2.8px;fill:#1a1a17}
.dwg .bl circle{fill:#fff;stroke:#1a1a17;stroke-width:.3}.dwg .bl text{font-size:3px;font-weight:700;fill:#1a1a17;font-family:"JetBrains Mono",monospace}.dwg .bl.ok circle{stroke:#3e6b4a;fill:#eaf3ec}.dwg .bl.warn circle{stroke:#b8862a;fill:#fbf1dc}.dwg .bl.ng circle{stroke:#c0392b;stroke-width:.6;fill:#fde3df}.dwg .bl.na circle{stroke:#9a948a}.dwg .bl{cursor:pointer}.dwg .bl.sel circle{stroke-width:.9;stroke:#2563eb}
.dwg .an{font-size:3.1px;font-style:italic;font-weight:600;font-family:"IBM Plex Sans JP",sans-serif;pointer-events:none}
`;
