// Parametric structural model derived from the site dataset. It is the single source of truth
// for both the LiDAR synthesis (worker) and the BIM overlay (main thread), so element ids match.
import { resample, framePath, pathLength, samplePath, hashStr, polygonArea, polygonCentroid } from './geom.js';

export const DECK_T = 0.3;      // 床版厚
export const GIRDER_D = 2.2;    // 桁高
export const RAIL_H = 1.1;      // 壁高欄高さ
export const RAIL_T = 0.35;     // 壁高欄厚
export const CAP_H = 1.8;       // 橋脚横梁高さ
export const CAP_L = 2.4;       // 横梁奥行（橋軸方向）
export const FOOT_D = 2.0;      // フーチング厚

export const CATEGORY = {
  deck: { ifc: 'IfcSlab', revit: '床', color: 0x4fb3ff, seq: 4 },
  girder: { ifc: 'IfcBeam', revit: '構造フレーム', color: 0xffa94d, seq: 3 },
  railing: { ifc: 'IfcRailing', revit: '手すり', color: 0x7ee787, seq: 5 },
  column: { ifc: 'IfcColumn', revit: '構造柱', color: 0xc792ea, seq: 1 },
  cap: { ifc: 'IfcBeam', revit: '構造フレーム（横梁）', color: 0xffd166, seq: 2 },
  footing: { ifc: 'IfcFooting', revit: '構造基礎', color: 0x8d99ae, seq: 0 },
  gantry: { ifc: 'IfcMember', revit: '一般モデル（門型標識柱）', color: 0xf2f2f2, seq: 6 },
  pole: { ifc: 'IfcMember', revit: '一般モデル（照明柱）', color: 0xdddddd, seq: 6 },
  building: { ifc: 'IfcBuilding', revit: 'マス（概念形状）', color: 0x5fd3d3, seq: 7 },
};

export function routeName(road) {
  if (road.name) return road.name;
  if (road.ref) return `首都高速 ${road.ref}号`;
  return road.hw === 'motorway_link' ? '首都高速 連結路' : '一般道';
}

export function levelName(y, layerHeight) {
  if (y < 1.5) return 'GL ±0';
  const l = Math.max(1, Math.round(y / layerHeight));
  return `Deck L${l} +${y.toFixed(1)}`;
}

/** Build all elements. Returns { elements, decks, piers, ... } */
export function buildStructure(data) {
  const elements = [];
  const LH = data.site.layerHeight;
  const add = (e) => { e.id = elements.length; elements.push(e); return e; };
  const pierHash = new Map();
  const nearPier = (x, z, r) => {
    const cx = Math.floor(x / 20), cz = Math.floor(z / 20);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const list = pierHash.get(`${cx + i},${cz + j}`);
      if (!list) continue;
      for (const p of list) if (Math.hypot(p.x - x, p.z - z) < r) return true;
    }
    return false;
  };
  const regPier = (p) => {
    const k = `${Math.floor(p.x / 20)},${Math.floor(p.z / 20)}`;
    if (!pierHash.has(k)) pierHash.set(k, []);
    pierHash.get(k).push(p);
  };

  let pierNo = 0, gantryNo = 0, poleNo = 0;
  const phaseOf = (seedStr) => {
    const h = hashStr(seedStr) % 100;
    return h < 70 ? '既設（1980 供用）' : h < 90 ? '既設（1995 増設）' : '更新（2024 補修）';
  };

  for (const road of data.roads) {
    const pts = resample(road.pts, 2.0);
    const path = framePath(pts);
    const L = pathLength(path);
    if (L < 4) continue;
    const route = routeName(road);
    const isExpress = road.kind === 'expressway' || road.kind === 'ramp';
    if (!road.elevated) continue; // at-grade roads are sampled as pavement only

    const yMean = path.reduce((s, p) => s + p.y, 0) / path.length;
    const level = levelName(yMean, LH);
    const phase = phaseOf(road.id);
    const seqBase = hashStr(road.id) % 1000; // construction order along network

    // as-built deviation injection (施工誤差・経年変形の疑似再現)
    const settle = hashStr('settle' + road.id) % 23 === 5 ? -0.042 : 0;

    const w = road.width;
    const girderWTop = Math.max(3, w - 1.0), girderWBot = Math.max(2.5, w - 3.2);
    const deck = add({
      type: 'deck', tag: `D-${road.id.slice(-4)}`, path, width: w, thick: DECK_T, route, level, phase,
      family: 'RC床版', typeName: `t=${(DECK_T * 1000) | 0} W=${(w * 1000) | 0}`,
      material: 'コンクリート 30N/mm²', road, length: L, seq: seqBase,
      asBuilt: { dx: 0, dy: settle, dz: 0 },
    });
    add({
      type: 'girder', tag: `G-${road.id.slice(-4)}`, path, wTop: girderWTop, wBot: girderWBot, depth: GIRDER_D,
      route, level, phase, family: isExpress ? '鋼製箱桁' : 'PC箱桁',
      typeName: `W${(girderWTop * 1000) | 0}×D${(GIRDER_D * 1000) | 0}`,
      material: isExpress ? 'SM490Y 鋼材' : 'PC コンクリート 50N/mm²', road, length: L, seq: seqBase, parent: deck.id,
      asBuilt: { dx: 0, dy: settle, dz: 0 },
    });
    for (const side of [-1, 1]) {
      const bow = hashStr('bow' + road.id + side) % 11 === 2 ? 0.032 * side : 0;
      add({
        type: 'railing', tag: `R-${road.id.slice(-4)}${side < 0 ? 'L' : 'R'}`, path, side, offset: side * (w / 2 - RAIL_T / 2),
        h: RAIL_H, t: RAIL_T, route, level, phase, family: '壁高欄', typeName: `H${(RAIL_H * 1000) | 0} 剛性防護柵`,
        material: 'コンクリート 30N/mm²', road, length: L, seq: seqBase, parent: deck.id,
        asBuilt: { dx: bow, dy: settle, dz: 0 },
      });
    }

    // piers
    const spacing = road.kind === 'expressway' ? 44 : road.kind === 'ramp' ? 34 : 40;
    for (let s = 12; s < L - 6; s += spacing) {
      const p = samplePath(path, s);
      if (p.y < 3.6) continue;
      if (nearPier(p.x, p.z, 11)) continue;
      regPier(p);
      pierNo++;
      const tag = `P-${String(pierNo).padStart(3, '0')}`;
      const capBottom = p.y - DECK_T - GIRDER_D - CAP_H;
      const round = road.kind !== 'expressway';
      const colW = round ? 2.5 : 2.6, colL = round ? 2.5 : 3.6;
      const lean = hashStr('lean' + tag) % 17 === 3 ? 0.068 : 0; // 橋脚の傾き（施工誤差）
      const pierPhase = phaseOf(tag);
      const col = add({
        type: 'column', tag, x: p.x, z: p.z, tx: p.tx, tz: p.tz, yBot: 0, yTop: capBottom, round, colW, colL,
        route, level: 'GL ±0', phase: pierPhase, family: round ? 'RC円柱橋脚' : 'RC小判形橋脚',
        typeName: round ? `φ${(colW * 1000) | 0}` : `${(colW * 1000) | 0}×${(colL * 1000) | 0}`,
        material: 'コンクリート 40N/mm²', road, seq: seqBase + s / 1000, parent: deck.id,
        asBuilt: { dx: lean * p.nx, dy: 0, dz: lean * p.nz },
      });
      add({
        type: 'cap', tag: `${tag}-C`, x: p.x, z: p.z, tx: p.tx, tz: p.tz, yBot: capBottom, h: CAP_H, w: w + 1.4, l: CAP_L,
        route, level, phase: pierPhase, family: 'RC横梁', typeName: `W${((w + 1.4) * 1000) | 0}×H${(CAP_H * 1000) | 0}`,
        material: 'コンクリート 40N/mm²', road, seq: seqBase + s / 1000, parent: col.id,
        asBuilt: { dx: lean * p.nx, dy: 0, dz: lean * p.nz },
      });
      add({
        type: 'footing', tag: `${tag}-F`, x: p.x, z: p.z, tx: p.tx, tz: p.tz, yBot: -FOOT_D, h: FOOT_D, w: colW + 3, l: colL + 3,
        route, level: 'GL -2.0', phase: pierPhase, family: 'RCフーチング', typeName: `${((colW + 3) * 1000) | 0}×${((colL + 3) * 1000) | 0}×${(FOOT_D * 1000) | 0}`,
        material: 'コンクリート 30N/mm²', road, seq: seqBase + s / 1000, parent: col.id, asBuilt: { dx: 0, dy: 0, dz: 0 },
      });
    }

    if (!isExpress) continue;
    // lighting poles along the left edge every 40 m, sign gantries on mainlines every ~220 m
    for (let s = 20; s < L - 10; s += 40) {
      const p = samplePath(path, s);
      poleNo++;
      add({
        type: 'pole', tag: `LP-${String(poleNo).padStart(3, '0')}`, x: p.x + p.nx * (w / 2 - 0.4), z: p.z + p.nz * (w / 2 - 0.4),
        y: p.y, h: 10, tx: p.tx, tz: p.tz, nx: p.nx, nz: p.nz, route, level, phase, family: '照明柱', typeName: 'H10000 テーパーポール',
        material: '溶融亜鉛めっき鋼', road, seq: seqBase + 1, parent: deck.id, asBuilt: { dx: 0, dy: 0, dz: 0 },
      });
    }
    if (road.kind === 'expressway') {
      for (let s = 110; s < L - 20; s += 220) {
        const p = samplePath(path, s);
        gantryNo++;
        add({
          type: 'gantry', tag: `SG-${String(gantryNo).padStart(2, '0')}`, x: p.x, z: p.z, y: p.y, w: w + 1.2, h: 5.6,
          tx: p.tx, tz: p.tz, nx: p.nx, nz: p.nz, route, level, phase, family: '門型標識柱', typeName: `W${((w + 1.2) * 1000) | 0}×H5600`,
          material: '溶融亜鉛めっき鋼', road, seq: seqBase + 1, parent: deck.id, asBuilt: { dx: 0, dy: 0, dz: 0 },
        });
      }
    }
  }

  for (const b of data.buildings) {
    const area = polygonArea(b.pts);
    const c = polygonCentroid(b.pts);
    add({
      type: 'building', tag: `B-${b.id.slice(-5)}`, footprint: b.pts, h: b.h, levels: b.levels, cx: c[0], cz: c[1], area,
      route: '', level: 'GL ±0', phase: '既存建物', family: 'マス', typeName: b.use ? `建物（${b.use}）` : '建物',
      material: '—', name: b.name, seq: -1, asBuilt: { dx: 0, dy: 0, dz: 0 },
    });
  }
  // 4D construction sequence: category order (footing → column → cap → girder → deck → railing →
  // furniture), progressing through the network within each category. Buildings are context (-1).
  for (const e of elements) if (e.type !== 'building') e.seq = CATEGORY[e.type].seq * 1000 + (((e.seq % 1000) + 1000) % 1000);
  return { elements };
}

/** Rough axis-aligned bounds for an element (used for selection stats / camera focus). */
export function elementBounds(e) {
  const bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  const grow = (x, y, z) => {
    if (x < bb[0]) bb[0] = x; if (y < bb[1]) bb[1] = y; if (z < bb[2]) bb[2] = z;
    if (x > bb[3]) bb[3] = x; if (y > bb[4]) bb[4] = y; if (z > bb[5]) bb[5] = z;
  };
  switch (e.type) {
    case 'deck': case 'girder': case 'railing': {
      const hw = e.type === 'deck' ? e.width / 2 : e.type === 'girder' ? e.wTop / 2 : e.t;
      const off = e.type === 'railing' ? e.offset : 0;
      const yLo = e.type === 'deck' ? -e.thick : e.type === 'girder' ? -DECK_T - e.depth : 0;
      const yHi = e.type === 'railing' ? e.h : 0;
      for (const p of e.path) {
        grow(p.x + p.nx * (off - hw), p.y + yLo, p.z + p.nz * (off - hw));
        grow(p.x + p.nx * (off + hw), p.y + yHi, p.z + p.nz * (off + hw));
      }
      break;
    }
    case 'column': grow(e.x - e.colL, e.yBot, e.z - e.colL); grow(e.x + e.colL, e.yTop, e.z + e.colL); break;
    case 'cap': grow(e.x - e.w / 2, e.yBot, e.z - e.w / 2); grow(e.x + e.w / 2, e.yBot + e.h, e.z + e.w / 2); break;
    case 'footing': grow(e.x - e.w / 2, e.yBot, e.z - e.w / 2); grow(e.x + e.w / 2, e.yBot + e.h, e.z + e.w / 2); break;
    case 'pole': grow(e.x - 1, e.y, e.z - 1); grow(e.x + 1, e.y + e.h, e.z + 1); break;
    case 'gantry': grow(e.x - e.w / 2, e.y, e.z - e.w / 2); grow(e.x + e.w / 2, e.y + e.h, e.z + e.w / 2); break;
    case 'building': for (const [x, z] of e.footprint) { grow(x, 0, z); grow(x, e.h, z); } break;
  }
  return bb;
}

/** Revit-style property sheet for an element. */
export function elementProperties(e, extra = {}) {
  const cat = CATEGORY[e.type];
  const dims = [];
  let volume = 0;
  switch (e.type) {
    case 'deck': dims.push(['延長', `${e.length.toFixed(1)} m`], ['幅員', `${e.width.toFixed(2)} m`], ['厚さ', `${(e.thick * 1000) | 0} mm`]); volume = e.length * e.width * e.thick; break;
    case 'girder': dims.push(['延長', `${e.length.toFixed(1)} m`], ['上フランジ幅', `${e.wTop.toFixed(2)} m`], ['下フランジ幅', `${e.wBot.toFixed(2)} m`], ['桁高', `${(e.depth * 1000) | 0} mm`]); volume = e.length * ((e.wTop + e.wBot) / 2) * e.depth; break;
    case 'railing': dims.push(['延長', `${e.length.toFixed(1)} m`], ['高さ', `${(e.h * 1000) | 0} mm`], ['厚さ', `${(e.t * 1000) | 0} mm`]); volume = e.length * e.h * e.t; break;
    case 'column': dims.push(['柱高', `${(e.yTop - e.yBot).toFixed(2)} m`], ['断面', e.typeName]); volume = (e.round ? Math.PI * (e.colW / 2) ** 2 : e.colW * e.colL) * (e.yTop - e.yBot); break;
    case 'cap': dims.push(['幅', `${e.w.toFixed(2)} m`], ['奥行', `${e.l.toFixed(2)} m`], ['高さ', `${(e.h * 1000) | 0} mm`]); volume = e.w * e.l * e.h; break;
    case 'footing': dims.push(['平面', `${e.w.toFixed(1)} × ${e.l.toFixed(1)} m`], ['厚さ', `${(e.h * 1000) | 0} mm`]); volume = e.w * e.l * e.h; break;
    case 'pole': dims.push(['高さ', `${e.h} m`]); break;
    case 'gantry': dims.push(['スパン', `${e.w.toFixed(2)} m`], ['高さ', `${e.h} m`]); break;
    case 'building': dims.push(['建物高さ', `${e.h.toFixed(1)} m`], ['階数', `${e.levels} F`], ['建築面積', `${e.area.toFixed(0)} m²`]); volume = e.area * e.h; break;
  }
  const dev = extra.meanDev ?? 0;
  const absDev = Math.abs(dev);
  const rating = absDev < 10 ? 'A（健全）' : absDev < 25 ? 'B（経過観察）' : absDev < 45 ? 'C（要調査）' : 'D（要対策）';
  return [
    ['識別情報', [
      ['要素 ID', String(100000 + e.id)],
      ['マーク', e.tag],
      ['カテゴリ', cat.revit],
      ['IFC クラス', cat.ifc],
      ['ファミリ', e.family],
      ['タイプ', e.typeName],
      ...(e.name ? [['名称', e.name]] : []),
    ]],
    ['拘束', [
      ['レベル', e.level],
      ['路線', e.route || '—'],
      ['フェーズ', e.phase],
    ]],
    ['寸法', [...dims, ...(volume ? [['体積', `${volume.toFixed(1)} m³`]] : [])]],
    ['材料と仕上げ', [['構造材料', e.material]]],
    ['点群照合 (Scan-to-BIM)', [
      ['点数', extra.count != null ? extra.count.toLocaleString() : '—'],
      ['平均偏差', extra.meanDev != null ? `${dev >= 0 ? '+' : ''}${dev.toFixed(1)} mm` : '—'],
      ['最大偏差', extra.maxDev != null ? `${extra.maxDev.toFixed(0)} mm` : '—'],
      ['被覆率', extra.coverage != null ? `${extra.coverage.toFixed(0)} %` : '—'],
      ['健全度', extra.meanDev != null ? rating : '—'],
    ]],
  ];
}
