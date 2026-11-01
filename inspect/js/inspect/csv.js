// 三次元測定機（CMM）CSV の生成（デモ用サンプル）と取込・図面項目への自動対応付け
// 書式（Mitutoyo MCOSMOS / Zeiss CALYPSO のエクスポートに近い一般形）:
//   Part,Serial,Feature,Char,Nominal,UpperTol,LowerTol,Actual,Unit
const CHAR_OF = { len: 'DIST', dia: 'DIA', gdt: null, angle: 'ANGLE' };
const GDT_CHAR = { pos: 'POS', perp: 'PERP', flat: 'FLAT', para: 'PARA', runout: 'RUNOUT', coax: 'COAX' };
export function charOf(it) { if (it.cmm) return it.cmm.split('/')[1]; return it.kind === 'gdt' ? GDT_CHAR[it.gdt] : CHAR_OF[it.kind] || 'DIST'; }
// デモ用: 部品データの「真値」から CMM が出力したであろう CSV を作る（CMM で測れる項目のみ）
export function sampleCSV(part) {
  const rows = [['Part', 'Serial', 'Feature', 'Char', 'Nominal', 'UpperTol', 'LowerTol', 'Actual', 'Unit']];
  for (const pc of part.pieces) for (const it of part.items) { if (!it.cmm) continue; const v = (pc.truth || pc.m)[it.no]; if (v == null || typeof v !== 'number') continue; const [feat, ch] = it.cmm.split('/'); rows.push([part.drawingNo, pc.sn, feat, ch, (+it.nominal).toFixed(3), it.tol ? it.tol[0].toFixed(3) : '', it.tol ? it.tol[1].toFixed(3) : '', v.toFixed(3), it.unit === '°' ? 'deg' : 'mm']); }
  return '# CMM export — ' + part.drawingNo + ' ' + part.name + ' (sample)\n' + rows.map(r => r.join(',')).join('\n') + '\n';
}
export function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#')); if (!lines.length) return [];
  const head = lines[0].split(',').map(s => s.trim().toLowerCase()); const idx = k => head.findIndex(h => h.startsWith(k));
  const iF = idx('feat'), iC = idx('char'), iN = idx('nom'), iA = idx('act'), iS = idx('serial'), iU = idx('up'), iL = idx('low');
  return lines.slice(1).map(l => { const c = l.split(',').map(s => s.trim()); return { serial: c[iS] || '', feature: c[iF] || '', char: (c[iC] || '').toUpperCase(), nominal: parseFloat(c[iN]), up: iU >= 0 ? parseFloat(c[iU]) : NaN, lo: iL >= 0 ? parseFloat(c[iL]) : NaN, actual: parseFloat(c[iA]) }; }).filter(r => !Number.isNaN(r.actual));
}
// CSV の行 → 図面の検査項目へ対応付け。確信度: 特徴名 + 特性 + 呼び寸法が一致 99% / 特性 + 呼び寸法 85% / 呼び寸法のみ 60%
export function mapRows(part, rows) {
  const out = []; const used = new Map();
  for (const r of rows) { let best = null, conf = 0, why = '';
    for (const it of part.items) { if (typeof it.nominal !== 'number') continue; const nomOk = Math.abs(it.nominal - r.nominal) < 0.0015; if (!nomOk) continue; const ch = charOf(it); const chOk = ch === r.char; const [feat] = (it.cmm || '/').split('/'); const featOk = feat && feat === r.feature; let c = 0; if (featOk && chOk) { c = 0.99; } else if (chOk) { c = 0.85; } else if (featOk) { c = 0.7; } else c = 0.6; if (it.tol && !Number.isNaN(r.up) && Math.abs(it.tol[0] - r.up) < 1e-6) c = Math.min(0.995, c + 0.005); if (c > conf) { conf = c; best = it; why = featOk && chOk ? '特徴名・特性・呼び寸法が一致' : chOk ? '特性・呼び寸法が一致（特徴名は不一致）' : '呼び寸法のみ一致'; } }
    const piece = part.pieces.find(p => p.sn === r.serial) || null; out.push({ row: r, item: best, piece, conf, why });
    if (best && piece) used.set(best.no + ':' + piece.no, true); }
  const unmapped = part.items.filter(it => it.cmm && !part.pieces.every(p => used.has(it.no + ':' + p.no)));
  return { mapped: out, unmapped };
}
