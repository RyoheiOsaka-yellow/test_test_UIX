// "xMOTION" を Inter Black のアウトライン（SVG パス）にする。字間 -0.06em・カーニングあり（元の CSS と同じ組み）
// usage: node demos/tools/outline-mark.js <font> <text> <out.svg>
// 必要なもの: npm i opentype.js（フォントは Inter Black。Linux なら /usr/share/fonts/opentype/inter/Inter-Black.otf）
const fs = require('fs');
const opentype = require('opentype.js');
const [FONT, TEXT, OUT] = process.argv.slice(2);
const font = opentype.loadSync(FONT);
const SIZE = 1000, TRACK = -0.06 * SIZE, scale = SIZE / font.unitsPerEm;
const r = v => Math.round(v * 10) / 10;
let x = 0, d = '', minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, prev = null;
for (const ch of TEXT) {
  const g = font.charToGlyph(ch);
  if (prev) x += font.getKerningValue(prev, g) * scale;
  const p = g.getPath(x, 0, SIZE), bb = p.getBoundingBox();
  for (const c of p.commands) {
    if (c.type === 'M') d += `M${r(c.x)} ${r(c.y)}`;
    else if (c.type === 'L') d += `L${r(c.x)} ${r(c.y)}`;
    else if (c.type === 'Q') d += `Q${r(c.x1)} ${r(c.y1)} ${r(c.x)} ${r(c.y)}`;
    else if (c.type === 'C') d += `C${r(c.x1)} ${r(c.y1)} ${r(c.x2)} ${r(c.y2)} ${r(c.x)} ${r(c.y)}`;
    else if (c.type === 'Z') d += 'Z';
  }
  minX = Math.min(minX, bb.x1); maxX = Math.max(maxX, bb.x2); minY = Math.min(minY, bb.y1); maxY = Math.max(maxY, bb.y2);
  // 小文字 x の直後だけ字間を少し開ける（-0.06em のままだと x の右足が次の大文字に触れる）
  x += g.advanceWidth * scale + TRACK + (ch === 'x' ? 0.035 * SIZE : 0); prev = g;
}
const W = maxX - minX, H = maxY - minY;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r(minX)} ${r(minY)} ${r(W)} ${r(H)}"><path d="${d}"/></svg>`;
fs.writeFileSync(OUT, svg);
console.log(JSON.stringify({ w: r(W), h: r(H), ratio: +(W / H).toFixed(4), bytes: svg.length }));
