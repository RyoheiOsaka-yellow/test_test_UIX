// スキャン図面（写真・PDF）へのオーバーレイ: 図面上の既存バルーン（赤番号）に判定色のリングを重ね、
// 測定値を赤字で書き込む。図面に番号が無い寸法には AI が付番したバルーン（青）を置く。
const COL = { ok: '#3e6b4a', warn: '#b8862a', ng: '#c0392b', na: '#8a8478' };
const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
// part.scan = { src, w, h, r }、item.bp = [x, y]（バルーン中心）、item.td = 'r'|'l'|'u'|'d'（書き込み位置）
export function renderScan(part, { statuses = null, annotations = null, sel = null, src = null, showExtra = true } = {}) {
  const sc = part.scan; const r = sc.r || 13; const fs = sc.fs || 12.5; let out = '';
  for (const it of part.items) { if (!it.bp) continue; if (it.extra && !showExtra) continue; const st = statuses ? (statuses[it.no] || 'na') : 'na'; const [x, y] = it.bp; const ai = it.extra || sc.aiAll; const cls = `bl ${st}${ai ? ' ai' : ' org'}${it.no === sel ? ' sel' : ''}`;
    if (ai) out += `<g class="${cls}" data-no="${it.no}"><rect x="${x - r * 0.95}" y="${y - r * 0.8}" width="${r * 1.9}" height="${r * 1.6}" rx="${r * 0.35}"/><text x="${x}" y="${y + fs * 0.36}" text-anchor="middle" style="font-size:${fs * 0.86}px">${it.no}</text></g>`;
    else out += `<g class="${cls}" data-no="${it.no}"><circle cx="${x}" cy="${y}" r="${r + 2.5}"/></g>`;
    const lines = annotations?.[it.no]; if (lines && lines.length) { const lh = fs * 1.08; const w = Math.max(...lines.map(l => String(l.text).length)) * fs * 0.56 + 6; const h = lines.length * lh + 3; const td = it.td || 'r'; const g = r + 5; let tx = x + g, ty = y - h / 2; if (td === 'l') tx = x - g - w; if (td === 'u') { tx = x - w / 2; ty = y - g - h; } if (td === 'd') { tx = x - w / 2; ty = y + g; } if (it.to) { tx += it.to[0]; ty += it.to[1]; }
      out += `<g class="tag" data-no="${it.no}"><rect x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="2.5" style="stroke:${COL[st]}"/>${lines.map((l, i) => `<text x="${(tx + 3).toFixed(1)}" y="${(ty + lh * (i + 0.82)).toFixed(1)}" style="fill:${l.col || COL[st]};font-size:${fs}px">${esc(l.text)}</text>`).join('')}</g>`; } }
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${sc.w} ${sc.h}" class="dwg scan"><image href="${src || sc.src}" x="0" y="0" width="${sc.w}" height="${sc.h}"/>${out}</svg>`;
}
export const SCAN_CSS = `
.dwg.scan{background:#fff;max-width:none}.dwg.scan .bl{cursor:pointer}
.dwg.scan .bl.org circle{fill:rgba(255,255,255,0);stroke-width:3.2;stroke:#8a8478}.dwg.scan .bl.org.ok circle{stroke:#3e6b4a;fill:rgba(62,107,74,.14)}.dwg.scan .bl.org.warn circle{stroke:#b8862a;fill:rgba(184,134,42,.2)}.dwg.scan .bl.org.ng circle{stroke:#c0392b;fill:rgba(192,57,43,.22);stroke-width:4.2}
.dwg.scan .bl.ai rect{fill:#eaf1ff;stroke:#2563eb;stroke-width:1.4}.dwg.scan .bl.ai text{fill:#1d4ed8;font-weight:700;font-family:"JetBrains Mono",monospace}.dwg.scan .bl.ai.ok rect{fill:#eaf3ec;stroke:#3e6b4a}.dwg.scan .bl.ai.ok text{fill:#2d5237}.dwg.scan .bl.ai.warn rect{fill:#fbf1dc;stroke:#b8862a}.dwg.scan .bl.ai.warn text{fill:#7a5a16}.dwg.scan .bl.ai.ng rect{fill:#fde3df;stroke:#c0392b;stroke-width:2.4}.dwg.scan .bl.ai.ng text{fill:#c0392b}
.dwg.scan .bl.sel circle,.dwg.scan .bl.sel rect{stroke:#2563eb!important;stroke-width:5!important}
.dwg.scan .tag rect{fill:rgba(255,255,255,.93);stroke-width:.9}.dwg.scan .tag text{font-family:"JetBrains Mono","IBM Plex Sans JP",monospace;font-style:italic;font-weight:700}.dwg.scan .tag{pointer-events:none}
`;
