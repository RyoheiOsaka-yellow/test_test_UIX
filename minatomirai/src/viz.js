// 分析パネルの「図表」タブ: 地図に重ねる面とは別に、表の形のヒートマップなどで時間と場所の関係を見る。
//   1. 時刻 × 場所 の行列 (駅・発着点 / 建物 / 交差点 / 目的)   2. 月 × 時刻 のカレンダー
//   3. 発着点 × 行き先の用途 の表 (1 日の到着人数)              4. 滞在人数のツリーマップ (面積 = 人数、色 = 用途)
// 数値はすべて人流モデルの推計。
import { GROUPS, dayContext } from './people_model.js';

const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtN = v => Math.round(v).toLocaleString();
const hm = h => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const HS = Array.from({ length: 48 }, (_, i) => i * 0.5 + 0.25);   // 30 分ごと (各区間の中央)

export function initViz(ctx) {
  const { people, calib, buildingMeta, USE, an, setClock, getMonth, setMonth, selectBuilding, flyBuilding } = ctx;
  const S = { rows: 'station', norm: 'row', tree: 'presence' };
  let cache = null;
  const sigOf = () => [people.state.day, people.state.rain, people.state.event, people.state.nonRail, people.state.sigAdj, getMonth()].join('|');
  const C = () => { const sig = sigOf(); if (!cache || cache.sig !== sig || cache.model !== people.model) cache = { sig, model: people.model, m: {} }; return cache.m; };
  const color = (t, lin) => { const x = Math.max(0, Math.min(1, t)); return an.rampCss(lin ? 0.08 + 0.92 * x : Math.sqrt(x)); };   // lin = 山の形を見る図 (線形)、それ以外は小さい値も見えるよう平方根
  const short = (n, k = 9) => n.length > k ? n.slice(0, k - 1) + '…' : n;

  // ---- 1. 時刻 × 場所 ----
  function matrix(kind) {
    const m = C(); if (m[kind]) return m[kind]; const model = people.model, d = people.day(); let rows = [], unit = '人/時';
    if (kind === 'station') {
      const fl = HS.map(h => model.stationFlows(h, d)); rows = fl[0].map((s, i) => ({ n: s.n.replace(/（.*?）/, ''), full: s.n, v: Float32Array.from(fl, f => f[i].toCity + f[i].toStation) })); unit = '人/時（駅と街の間の出入り）';
    } else if (kind === 'bldg') {
      const P = HS.map(h => model.presence(h, d)), mx = model.dests.map((dd, i) => dd.b >= 0 && dd.n ? Math.max(...P.map(p => p[i])) : 0);
      rows = [...mx.keys()].sort((a, b) => mx[b] - mx[a]).slice(0, 12).map(i => ({ n: model.dests[i].n, full: model.dests[i].n, b: model.dests[i].b, v: Float32Array.from(P, p => Math.max(0, p[i])) })); unit = '人（滞在）';
    } else if (kind === 'cross') {
      const ser = an.waitSeries(), pk = ser.hs[ser.total.indexOf(Math.max(...ser.total))], pos = new Map(an.waitStats(pk).map(q => [q.key, q]));
      rows = [...ser.per].map(([key, v]) => ({ key, v, mx: Math.max(...v) })).filter(r => pos.has(r.key)).sort((a, b) => b.mx - a.mx).slice(0, 12).map(r => { const q = pos.get(r.key), nm = an.nameNear(q.x, q.y); return { n: nm || `(${Math.round(q.x)}, ${Math.round(q.y)})`, full: (nm ? nm + ' 付近' : '交差点') + `・青 ${q.G}/${q.C} 秒`, x: q.x, y: q.y, v: r.v }; }); unit = '人（信号・横断の待ち、平均）';
    } else {
      const W = HS.map(h => model.walking(h, d)); rows = GROUPS.map((g, i) => ({ n: g.n, full: g.n, v: Float32Array.from(W, w => w[i]) })).filter(r => Math.max(...r.v) > 0.5); unit = '人（歩行中）';
    }
    return (m[kind] = { rows, unit });
  }
  function matrixHTML() {
    const M = matrix(S.rows), W = 320, LW = 92, PW = 34, cw = (W - LW - PW) / 48, rh = 14, H = M.rows.length * rh, all = Math.max(1e-9, ...M.rows.map(r => Math.max(...r.v))), now = people.state.hour;
    let svg = '';
    M.rows.forEach((r, j) => {
      const mx = Math.max(1e-9, ...r.v), den = S.norm === 'row' ? mx : all, pk = HS[r.v.indexOf(mx)];
      svg += `<text x="${LW - 4}" y="${j * rh + 10}" font-size="8.5" fill="#c6d4e8" text-anchor="end" class="vz-row" data-j="${j}"><title>${esc(r.full)}</title>${esc(short(r.n))}</text>`;
      for (let k = 0; k < 48; k++) svg += `<rect x="${(LW + k * cw).toFixed(1)}" y="${j * rh}" width="${(cw + 0.3).toFixed(1)}" height="${rh - 1}" fill="${r.v[k] <= den * 0.004 ? 'rgba(120,180,255,0.06)' : color(r.v[k] / den, S.norm === 'row')}" data-h="${HS[k]}"><title>${esc(r.full)} ${hm(HS[k] - 0.25)}〜 ${fmtN(r.v[k])}</title></rect>`;
      svg += `<text x="${W - 2}" y="${j * rh + 10}" font-size="8" fill="#8ea2c2" text-anchor="end">${hm(pk - 0.25)}</text>`;
    });
    for (const h of [6, 12, 18]) svg += `<line x1="${LW + h * 2 * cw}" y1="0" x2="${LW + h * 2 * cw}" y2="${H}" stroke="rgba(255,255,255,0.25)" stroke-width="0.6"/><text x="${LW + h * 2 * cw}" y="${H + 9}" font-size="8" fill="#7d93b5" text-anchor="middle">${h}時</text>`;
    svg += `<line x1="${LW + now * 2 * cw}" y1="-2" x2="${LW + now * 2 * cw}" y2="${H + 1}" stroke="#00e5ff" stroke-width="1.2"/><text x="${W - 2}" y="${H + 9}" font-size="8" fill="#7d93b5" text-anchor="end">ピーク</text>`;
    const seg = (id, cur, items) => `<div class="seg-row" id="${id}" style="margin:3px 0">${items.map(([k, n]) => `<button data-k="${k}" class="${k === cur ? 'active' : ''}">${n}</button>`).join('')}</div>`;
    return `<div class="sec-title">時刻 × 場所 の行列（30 分ごと）</div>${seg('vz-rows', S.rows, [['station', '駅・発着点'], ['bldg', '建物'], ['cross', '交差点'], ['purpose', '目的']])}${seg('vz-norm', S.norm, [['row', '行ごとに色づけ（山の時刻を見る）'], ['all', '全体で色づけ（量を比べる）']])}
      <svg viewBox="0 -3 ${W} ${H + 14}" width="100%" style="display:block" id="vz-matrix">${svg}</svg>
      <div class="note" style="margin-top:0">${M.unit}。${S.norm === 'row' ? '各行の最大を濃い色にしています。' : `全体の最大 ${fmtN(all)} を濃い色にしています。`}升目をクリックするとその時刻へ移ります${S.rows === 'bldg' || S.rows === 'cross' ? '。名前をクリックするとその場所へ移動します' : ''}。</div>`;
  }

  // ---- 2. 月 × 時刻 ----
  function calendar() {
    const m = C(); if (m.cal) return m.cal; const model = people.model, key = people.state.day, v = [];
    for (let mo = 1; mo <= 12; mo++) { const d = dayContext(key, mo, calib), row = new Float32Array(24); for (let h = 0; h < 24; h++) { const w = model.walking(h + 0.5, d); let t = 0; for (const x of w) t += x; row[h] = t; } v.push(row); }
    return (m.cal = v);
  }
  function calendarHTML() {
    const v = calendar(), W = 320, LW = 30, cw = (W - LW) / 24, rh = 11, H = 12 * rh, mx = Math.max(1e-9, ...v.map(r => Math.max(...r))), mo = getMonth(), now = Math.floor(people.state.hour); let svg = '', best = [0, 0, 0];
    v.forEach((r, j) => { svg += `<text x="${LW - 4}" y="${j * rh + 8.5}" font-size="8" fill="${j + 1 === mo ? '#00e5ff' : '#c6d4e8'}" text-anchor="end">${j + 1}月</text>`; for (let h = 0; h < 24; h++) { if (r[h] > best[0]) best = [r[h], j + 1, h]; svg += `<rect x="${(LW + h * cw).toFixed(1)}" y="${j * rh}" width="${(cw - 0.6).toFixed(1)}" height="${rh - 1}" fill="${r[h] <= mx * 0.004 ? 'rgba(120,180,255,0.06)' : color(r[h] / mx, true)}" data-mo="${j + 1}" data-h="${h + 0.5}"${j + 1 === mo && h === now ? ' stroke="#00e5ff" stroke-width="1.2"' : ''}><title>${j + 1}月 ${h}時台 歩行中 ${fmtN(r[h])} 人</title></rect>`; } });
    for (const h of [0, 6, 12, 18]) svg += `<text x="${LW + h * cw}" y="${H + 9}" font-size="8" fill="#7d93b5">${h}時</text>`;
    return `<div class="sec-title" style="margin-top:10px">月 × 時刻（${people.state.day === 'holiday' ? '休日' : '平日'}・歩行中の人数）</div><svg viewBox="0 0 ${W} ${H + 12}" width="100%" style="display:block" id="vz-cal">${svg}</svg>
      <div class="note" style="margin-top:0">最大は ${best[1]} 月の ${best[2]} 時台で 約 ${fmtN(best[0])} 人。月ごとの差は、人流オープンデータの月別の実測比によるものです。升目をクリックするとその月と時刻へ移ります。</div>`;
  }

  // ---- 3. 発着点 × 行き先の用途 ----
  function od() {
    const m = C(); if (m.od) return m.od; const model = people.model, d = people.day(), cols = ['off', 'ret', 'hot', 'att', 'pub', 'res', 'park', 'etc'], label = { park: '公園', etc: 'その他' };
    const colOf = dd => dd.n === '公園・緑地' ? 'park' : cols.includes(dd.u) ? dd.u : dd.u === 'tower' ? 'off' : 'etc', ci = model.dests.map(dd => cols.indexOf(colOf(dd)));
    const rows = model.stations.map(st => ({ n: st.n.replace(/（.*?）/, ''), full: st.n, v: new Float32Array(cols.length) }));
    for (const c of model.classes) { if (c.dir !== 'out' || c.station == null || !c.share) continue; let t = 0; for (let h = 0.25; h < 24; h += 0.5) t += c.rate(h, d) * 0.5; if (t <= 0) continue; const r = rows[c.station].v; for (let i = 0; i < ci.length; i++) { const sh = c.share[i]; if (sh) r[ci[i]] += t * sh; } }
    const keep = cols.map((k, j) => j).filter(j => rows.some(r => r.v[j] >= 50));
    return (m.od = { rows, cols: keep.map(j => ({ j, n: label[cols[j]] ?? USE[cols[j]]?.[0] ?? cols[j], c: USE[cols[j]]?.[1] ?? '#b0b7c3' })) });
  }
  function odHTML() {
    const M = od(), mx = Math.max(1e-9, ...M.rows.map(r => Math.max(...r.v))), k = v => v >= 950 ? (v / 1000).toFixed(v >= 9950 ? 0 : 1) : v >= 50 ? (v / 1000).toFixed(1) : '';
    const tot = M.cols.map(c => M.rows.reduce((a, r) => a + r.v[c.j], 0)), all = tot.reduce((a, b) => a + b, 0);
    return `<div class="sec-title" style="margin-top:10px">発着点 × 行き先の用途（1 日の到着・千人）</div>
      <table class="vz-od"><tr><th></th>${M.cols.map(c => `<th><i style="background:${c.c}"></i>${esc(c.n.slice(0, 3))}</th>`).join('')}<th>計</th></tr>
      ${M.rows.map(r => { const s = M.cols.reduce((a, c) => a + r.v[c.j], 0); return `<tr><td title="${esc(r.full)}">${esc(short(r.n, 8))}</td>${M.cols.map(c => { const t = r.v[c.j] / mx; return `<td style="background:${r.v[c.j] < 50 ? 'transparent' : color(t)};color:${t > 0.3 ? '#111' : '#dfe8f5'}" title="${esc(r.full)} → ${esc(c.n)} ${fmtN(r.v[c.j])} 人/日">${k(r.v[c.j])}</td>`; }).join('')}<td>${k(s)}</td></tr>`; }).join('')}
      <tr class="vz-sum"><td>計</td>${tot.map(t => `<td>${k(t)}</td>`).join('')}<td>${k(all)}</td></tr></table>
      <div class="note" style="margin-top:0">行は来る手段と駅、列は行き先の建物の用途（OSM のタグなどからの推定）。色は表全体の最大に対する大きさです。鉄道以外の量は見積もりです。</div>`;
  }

  // ---- 4. ツリーマップ ----
  // 面積の比を保ちながら、なるべく正方形に近い長方形で敷き詰める (squarified treemap)
  function squarify(items, x, y, w, h, out) {
    let rest = items.slice(), total = rest.reduce((a, q) => a + q.v, 0);
    while (rest.length) {
      const horiz = w >= h, side = horiz ? h : w, scale = (w * h) / total; let row = [], sum = 0, best = Infinity;
      for (const q of rest) { const s2 = sum + q.v, a = s2 * scale, len = a / side; let worst = 0; for (const r of [...row, q]) { const rl = r.v * scale / len; worst = Math.max(worst, Math.max(len / rl, rl / len)); } if (worst > best && row.length) break; row.push(q); sum = s2; best = worst; }
      const len = sum * scale / side; let off = 0;
      for (const r of row) { const rl = r.v * scale / len; out.push(horiz ? { ...r, x, y: y + off, w: len, h: rl } : { ...r, x: x + off, y, w: rl, h: len }); off += rl; }
      if (horiz) { x += len; w -= len; } else { y += len; h -= len; } rest = rest.slice(row.length); total -= sum;
    }
    return out;
  }
  function treeHTML() {
    const model = people.model, d = people.day(), pr = model.presence(people.state.hour, d), W = 320, H = 190;
    const all = model.dests.map((dd, i) => ({ i, b: dd.b, n: dd.n ?? '（名称なし）', u: dd.u, v: Math.max(0, pr[i]) })).filter(q => q.b >= 0 && q.v >= 1).sort((a, b) => b.v - a.v), tot = all.reduce((a, q) => a + q.v, 0);
    if (!all.length) return `<div class="sec-title" style="margin-top:10px">滞在人数のツリーマップ</div><div class="note" style="margin-top:0">この時刻は建物に滞在している人がほとんどいません。</div>`;
    // 上位 40 棟は 1 棟ずつ、残りは用途ごとにまとめる
    const top = all.slice(0, 40), grp = new Map(); for (const q of all.slice(40)) { const k = USE[q.u] ? q.u : 'mix'; let e = grp.get(k); if (!e) grp.set(k, e = { i: -1, b: -1, u: k, v: 0, c: 0 }); e.v += q.v; e.c++; }
    const items = [...top, ...[...grp.values()].map(e => ({ ...e, n: `ほかの${USE[e.u][0]} ${e.c} 棟`, group: true }))].sort((a, b) => b.v - a.v);
    const rects = squarify(items, 0, 0, W, H, []);
    return `<div class="sec-title" style="margin-top:10px">滞在人数のツリーマップ（${hm(people.state.hour)}・面積 = 人数、色 = 用途）</div>
      <svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block" id="vz-tree">${rects.map(r => { const c = USE[r.u]?.[1] ?? '#b0b7c3', fs = Math.min(9.5, Math.max(6.5, r.w / 7)), chars = Math.floor((r.w - 4) / (fs * 0.95)), show = r.w > 26 && r.h > 12 && chars >= 2;
        return `<g data-b="${r.b}" class="vz-cell"><rect x="${r.x.toFixed(1)}" y="${r.y.toFixed(1)}" width="${Math.max(0, r.w - 0.8).toFixed(1)}" height="${Math.max(0, r.h - 0.8).toFixed(1)}" fill="${c}" fill-opacity="${r.group ? 0.45 : 0.85}"><title>${esc(r.n)} ${fmtN(r.v)} 人（${(r.v / tot * 100).toFixed(1)}%）</title></rect>${show ? `<text x="${(r.x + 3).toFixed(1)}" y="${(r.y + fs + 2).toFixed(1)}" font-size="${fs.toFixed(1)}" fill="#0b1220" pointer-events="none">${esc(r.n.slice(0, chars))}</text>${r.h > fs * 2 + 6 ? `<text x="${(r.x + 3).toFixed(1)}" y="${(r.y + fs * 2 + 4).toFixed(1)}" font-size="${(fs * 0.9).toFixed(1)}" fill="#0b1220" fill-opacity="0.75" pointer-events="none">${fmtN(r.v)}</text>` : ''}` : ''}</g>`; }).join('')}</svg>
      <div class="legend" style="margin-top:2px">${[...new Set(top.map(q => q.u))].filter(u => USE[u]).map(u => `<span><i style="background:${USE[u][1]}"></i>${USE[u][0]}</span>`).join('')}</div>
      <div class="note" style="margin-top:0">建物に滞在している 約 ${fmtN(tot)} 人の内訳（${all.length} 棟）。上位 3 棟で ${(top.slice(0, 3).reduce((a, q) => a + q.v, 0) / tot * 100).toFixed(0)}%、上位 10 棟で ${(top.slice(0, 10).reduce((a, q) => a + q.v, 0) / tot * 100).toFixed(0)}% を占めます。薄い色の長方形は、上位 40 棟以外を用途ごとにまとめたものです。長方形をクリックするとその建物を選びます。</div>`;
  }

  function render(el) {
    if (!el || !people.model) return;
    el.innerHTML = matrixHTML() + calendarHTML() + odHTML() + treeHTML() + '<div class="note">数値はすべて人流モデルの推計で、実測ではありません。</div>';
    el.querySelectorAll('#vz-rows button').forEach(b => b.addEventListener('click', () => { S.rows = b.dataset.k; render(el); }));
    el.querySelectorAll('#vz-norm button').forEach(b => b.addEventListener('click', () => { S.norm = b.dataset.k; render(el); }));
    el.querySelectorAll('#vz-matrix rect[data-h]').forEach(r => r.addEventListener('click', () => setClock(Number(r.dataset.h))));
    const M = matrix(S.rows);
    el.querySelectorAll('#vz-matrix .vz-row').forEach(t => t.addEventListener('click', () => { const r = M.rows[Number(t.dataset.j)]; if (r?.b >= 0) { selectBuilding(r.b); flyBuilding(r.b); } else if (r?.x != null) ctx.flyPoint(r.x, r.y); }));
    el.querySelectorAll('#vz-cal rect').forEach(r => r.addEventListener('click', () => { setMonth(Number(r.dataset.mo)); setClock(Number(r.dataset.h)); }));
    el.querySelectorAll('#vz-tree .vz-cell').forEach(g => g.addEventListener('click', () => { const b = Number(g.dataset.b); if (b >= 0) { selectBuilding(b); flyBuilding(b); } }));
  }
  return { render, matrix, calendar, od, state: S, set: o => Object.assign(S, o) };
}
