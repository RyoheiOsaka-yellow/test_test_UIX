// 部材認識: 図面テキスト（鋼材仕様・穴・ピッチ・Uボルト・仕上げ）と幾何（閉じた矩形・長手方向）から部材候補を抽出し、確信度を付ける
import { parseSpec } from '../geo/profiles.js';
import { assessMember, DEFAULT_RISK } from '../bim/risk.js';
import { pipeOD } from '../data/sections.js';
export const SPEC_RE = /(?:L|Ｌ)[-‐－]?\s*(\d{2,3})\s*[x×X＊*]\s*(\d{2,3})\s*[x×X＊*]\s*(\d(?:\.\d)?)|(?:\[|C|Ｃ|\[-)[-‐－]?\s*(\d{2,3})\s*[x×X＊*]\s*(\d{2,3})\s*[x×X＊*]\s*(\d(?:\.\d)?)(?:\s*[x×X＊*]\s*(\d{1,2}(?:\.\d)?))?|(?:FB|ＦＢ|平鋼)[-‐－]?\s*(\d(?:\.\d)?)\s*[x×X＊*]\s*(\d{2,3})|(?:PL|ＰＬ)[-‐－]?\s*(\d{1,2}(?:\.\d)?)(?:\s*[x×X＊*]\s*(\d{2,4})\s*[x×X＊*]\s*(\d{2,4}))?|(?:SGP|STPG|白ガス管|黒ガス管)?\s*(\d{2,3})\s*A\b|(?:□|口|STKR)[-‐－]?\s*(\d{2,3})\s*[x×X＊*]\s*(\d{2,3})\s*[x×X＊*]\s*(\d(?:\.\d)?)|(?:H|Ｈ)[-‐－]?\s*(\d{3})\s*[x×X＊*]\s*(\d{2,3})\s*[x×X＊*]\s*(\d{1,2})\s*[x×X＊*]\s*(\d{1,2})/g;
export function specsInText(text) {
  const out = []; const t = String(text).replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  let m; SPEC_RE.lastIndex = 0; while ((m = SPEC_RE.exec(t))) { let spec = null; if (m[1]) spec = `L-${m[1]}x${m[2]}x${m[3]}`; else if (m[4]) spec = `[-${m[4]}x${m[5]}x${m[6]}${m[7] ? 'x' + m[7] : ''}`; else if (m[8]) spec = `FB-${m[8]}x${m[9]}`; else if (m[10]) spec = `PL-${m[10]}${m[11] ? 'x' + m[11] + 'x' + m[12] : ''}`; else if (m[13]) { const pre = t.slice(Math.max(0, m.index - 10), m.index); if (/U|ボルト|バンド|φ/.test(pre) && !/SGP|STPG|ガス管|配管|鋼管/.test(m[0])) continue; spec = `SGP-${m[13]}A`; } else if (m[14]) spec = `□-${m[14]}x${m[15]}x${m[16]}`; else if (m[17]) spec = `H-${m[17]}x${m[18]}x${m[19]}x${m[20]}`; if (spec && parseSpec(spec)) out.push({ spec, raw: m[0], index: m.index }); }
  return out;
}
export function featuresInText(text) {
  const t = String(text); const f = {};
  const hole = t.match(/(?:φ|Φ|ф|⌀)\s*(\d{1,2}(?:\.\d)?)/); if (hole) f.holeD = +hole[1]; const holeN = t.match(/(\d+)\s*[-ー]\s*(?:φ|Φ)\s*(\d{1,2})/); if (holeN) { f.holeCount = +holeN[1]; f.holeD = +holeN[2]; }
  const slot = t.match(/(?:長穴|ナガアナ|SLOT)\s*(\d{1,2})\s*[x×]\s*(\d{2,3})/i); if (slot) f.slot = { w: +slot[1], len: +slot[2] };
  const pitch = t.match(/(?:P|ピッチ|@)\s*[=＝]?\s*(\d{2,4})/); if (pitch) f.pitch = +pitch[1];
  const ub = t.match(/U\s*[-ー]?\s*(?:ボルト|BOLT)?\s*(\d{2,3})\s*A?/i); if (/U\s*[-ー]?\s*(ボルト|BOLT|B)/i.test(t)) f.ubolt = ub ? ub[1] + 'A' : true;
  const pa = t.match(/(\d{2,3})\s*A\b/); if (pa) f.pipeOD = pipeOD(pa[1], 'SGP') || +pa[1];
  if (/溶融亜鉛|ドブ|HDZ/.test(t)) f.finish = 'HDZ'; else if (/電気亜鉛|ユニクロ|EZ/.test(t)) f.finish = 'EZ'; else if (/SUS\s*304|ステンレス/.test(t)) f.finish = 'SUS304'; else if (/サビ止め|錆止め|プライマー/.test(t)) f.finish = 'PAINT';
  const weld = t.match(/(?:▷|△|隅肉|すみ肉|溶接)\s*(\d{1,2})/); if (weld) f.weld = +weld[1]; if (/全周/.test(t)) f.allAround = true;
  const anc = t.match(/(?:アンカー|ANCHOR|AB)\s*[-ー]?\s*(M\d{1,2})/i); if (anc) f.anchor = anc[1].toUpperCase();
  const len = t.match(/(?:L|長さ|Ｌ)\s*[=＝]\s*(\d{3,5})/); if (len) f.length = +len[1]; const h = t.match(/(?:H|高さ|Ｈ)\s*[=＝]\s*(\d{3,5})/); if (h) f.height = +h[1]; const w = t.match(/(?:W|幅|Ｗ)\s*[=＝]\s*(\d{3,5})/); if (w) f.width = +w[1];
  return f;
}
// DXF エンティティ群から部材候補を抽出
export function recognizeDXF(dxf) {
  const texts = dxf.entities.filter(e => e.type === 'TEXT' && e.text); const polys = dxf.entities.filter(e => e.type === 'LWPOLYLINE' && e.pts.length >= 4); const lines = dxf.entities.filter(e => e.type === 'LINE'); const circles = dxf.entities.filter(e => e.type === 'CIRCLE');
  const members = []; const notes = []; let seq = 1;
  for (const t of texts) { const specs = specsInText(t.text); const feat = featuresInText(t.text); if (!specs.length) { if (Object.keys(feat).length) notes.push({ text: t.text, pos: t.pos, layer: t.layer, feat, ocr: !!t.ocr }); continue; }
    for (const sp of specs) { // 最寄りの矩形ポリライン or 平行線ペアから長さを推定
      let best = null, bd = Infinity; for (const p of polys) { const bb = bboxPts(p.pts); const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2; let d = Math.hypot(cx - t.pos[0], cy - t.pos[1]); if (feat.length && Math.abs(Math.max(bb.w, bb.h) - feat.length) <= Math.max(10, feat.length * 0.03)) d *= 0.35; // 注記の長さと外形が一致する矩形を優先
        if (d < bd && d < Math.max(bb.w, bb.h) * 1.5 + 200) { bd = d; best = { bb, p }; } }
      const length = feat.length || (best ? Math.round(Math.max(best.bb.w, best.bb.h)) : null); const holes = circles.filter(c => best && c.c[0] >= best.bb.x0 - 1 && c.c[0] <= best.bb.x1 + 1 && c.c[1] >= best.bb.y0 - 1 && c.c[1] <= best.bb.y1 + 1);
      const ocrPen = t.ocr ? (t.ocrConf >= 80 ? 0.1 : 0.2) : 0; const userBonus = t.user ? 0.3 : 0; const conf = 0.55 + (best ? 0.25 : 0) + (feat.length ? 0.15 : 0) + (holes.length ? 0.05 : 0) - ocrPen + userBonus;
      members.push({ id: 'D' + seq++, spec: sp.spec, length, lengthSource: feat.length ? (t.user ? '手入力' : t.ocr ? '寸法注記(OCR)' : '寸法注記') : best ? '図形外形' : null, ocr: t.ocr ? (t.ocrConf || 0) : null, user: !!t.user, holes: holes.map(c => ({ d: Math.round(c.r * 2 * 10) / 10, x: Math.round((c.c[0] - (best ? best.bb.x0 : 0)) * 10) / 10, y: Math.round((c.c[1] - (best ? best.bb.y0 : 0)) * 10) / 10 })), feat, text: t.text, pos: t.pos, layer: t.layer, bbox: best?.bb || null, confidence: Math.min(0.98, conf), status: conf >= 0.8 ? 'confirmed' : conf >= 0.6 ? 'inferred' : 'review' }); } }
  // 仕様テキストが無い矩形: 形状のみから推定（要判断）
  for (const p of polys) { const bb = bboxPts(p.pts); const ar = Math.max(bb.w, bb.h) / Math.max(1, Math.min(bb.w, bb.h)); const L0 = Math.max(bb.w, bb.h), cx0 = (bb.x0 + bb.x1) / 2, cy0 = (bb.y0 + bb.y1) / 2; const explained = members.some(m => (m.bbox && m.bbox.x0 === bb.x0 && m.bbox.y0 === bb.y0) || (m.length && Math.abs(L0 - m.length) <= Math.max(10, m.length * 0.03) && Math.hypot(((m.bbox ? (m.bbox.x0 + m.bbox.x1) / 2 : m.pos[0]) - cx0), ((m.bbox ? (m.bbox.y0 + m.bbox.y1) / 2 : m.pos[1]) - cy0)) < 600));
    if (ar > 6 && Math.min(bb.w, bb.h) >= 20 && Math.min(bb.w, bb.h) <= 150 && !explained) { const w = Math.round(Math.min(bb.w, bb.h)); members.push({ id: 'D' + seq++, spec: `L-${w}x${w}x${w <= 40 ? 3 : w <= 65 ? 5 : 6}`, length: Math.round(Math.max(bb.w, bb.h)), lengthSource: '図形外形', holes: [], feat: {}, text: '（仕様注記なし・形状から推定）', pos: [bb.x0, bb.y0], layer: p.layer, bbox: bb, confidence: 0.4, status: 'review' }); } }
  // 近傍注記の特徴（穴・Uボルト・仕上げ）を部材へ紐付け
  const distTo = (m, pt) => { if (!m.bbox) return Math.hypot(pt[0] - m.pos[0], pt[1] - m.pos[1]); const dx = Math.max(m.bbox.x0 - pt[0], 0, pt[0] - m.bbox.x1), dy = Math.max(m.bbox.y0 - pt[1], 0, pt[1] - m.bbox.y1); return Math.hypot(dx, dy); };
  // 注記は最寄りの部材 1 つに紐付ける（外形からの距離 < 400mm。穴注記は穴数・径として 3D の穴になり、アンカー・仕上げ・溶接は確認事項に）
  for (const nt of notes) { let best = null, bd = 400; for (const m of members) { const d = distTo(m, nt.pos); if (d < bd) { bd = d; best = m; } } if (best) { best.feat = { ...nt.feat, ...best.feat }; best.linkedNotes = (best.linkedNotes || []).concat(nt.text); if (nt.ocr) best.noteOcr = true; } }
  applyRisk(members);
  return { members, notes, stats: { texts: texts.length, polylines: polys.length, lines: lines.length, circles: circles.length, layers: Object.keys(dxf.layers).length } };
}
function bboxPts(pts) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; }
// テキスト群（PDF/IFC 属性）から部材候補
export function recognizeTextItems(items) { // items: [{text, x, y, page}]
  const members = []; let seq = 1; const notes = [];
  for (const it of items) { const specs = specsInText(it.text); const feat = featuresInText(it.text); if (!specs.length) { if (Object.keys(feat).length) notes.push({ ...it, feat }); continue; } for (const sp of specs) members.push({ id: 'P' + seq++, spec: sp.spec, length: feat.length || null, lengthSource: feat.length ? '寸法注記' : null, holes: [], feat, text: it.text, pos: [it.x, it.y], page: it.page, confidence: feat.length ? 0.75 : 0.5, status: feat.length ? 'inferred' : 'review' }); }
  for (const m of members) for (const nt of notes) { if (nt.page === m.page && Math.hypot(nt.x - m.pos[0], nt.y - m.pos[1]) < 160) { m.feat = { ...nt.feat, ...m.feat }; m.linkedNotes = (m.linkedNotes || []).concat(nt.text); } }
  applyRisk(members);
  return { members, notes };
}
export function applyRisk(members, risk = (globalThis.__anglexRisk || DEFAULT_RISK)) { for (const m of members) { const a = assessMember(m, risk); m.status = a.status; m.risk = a.risk; m.riskReasons = a.reasons; m.riskWorst = a.worst; m.pipeFactor = a.pipeFactor; } return members; }
// 認識部材 → ファミリ・パラメータ提案（Revit のタイプ作成に相当）
export function proposeType(m) {
  const p = parseSpec(m.spec); const finish = m.feat.finish || 'HDZ';
  if (!p) return null;
  if (p.kind === 'PL') return { familyId: 'plate', name: `PL-${p.t} 加工板`, params: { t: p.t, W: p.w || m.feat.width || 150, H: p.h || m.length || 150, holeD: m.feat.holeD || 15, cols: 2, rows: Math.max(1, Math.round((m.feat.holeCount || 2) / 2)), finish } };
  if (m.feat.ubolt && (p.kind === 'L' || p.kind === 'C')) return { familyId: 'hanger_support', name: `${p.label} サポート`, params: { profile: p.kind, spec: m.spec, L: m.length || 600, pipes: typeof m.feat.ubolt === 'string' ? m.feat.ubolt : '50A', finish } };
  const holesDSL = m.holes.length ? m.holes.map(h => `${p.kind === 'C' ? 'web' : p.kind === 'PL' || p.kind === 'FB' ? 'face' : 'A'}:z${Math.round(Math.max(h.x, h.y))} s${Math.round(Math.min(h.x, h.y) || (p.A || 25) / 2)} d${h.d}`).join('; ') : (m.feat.holeD ? Array.from({ length: m.feat.holeCount || 2 }, (_, i) => `${p.kind === 'C' ? 'web' : 'A'}:z${50 + i * (m.feat.pitch || 100)} s${(p.A || p.H || 50) / 2} d${m.feat.holeD}${m.feat.slot ? ' slot' + m.feat.slot.len + 'z' : ''}`).join('; ') : '');
  return { familyId: 'member', name: p.label, params: { spec: m.spec, L: m.length || 1000, holes: holesDSL, finish, axis: 'x' } };
}
