#!/usr/bin/env node
// Build a compact site dataset (roads with estimated heights, buildings, water, parks, rail)
// from an OpenStreetMap XML extract.
//
//   node tools/build_data.mjs <site> [path/to/map.xml]
//
// Without an XML path the extract is downloaded from the OSM map API for the site's bbox
// (https://api.openstreetmap.org/api/0.6/map?bbox=...). Output: data/<site>.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sites = JSON.parse(fs.readFileSync(path.join(here, 'sites.json'), 'utf8'));
const [siteKey, xmlArg] = process.argv.slice(2);
const site = sites[siteKey];
if (!site) {
  console.error(`unknown site "${siteKey}". known: ${Object.keys(sites).join(', ')}`);
  process.exit(1);
}

let xml;
if (xmlArg) {
  xml = fs.readFileSync(xmlArg, 'utf8');
} else {
  const url = `https://api.openstreetmap.org/api/0.6/map?bbox=${site.bbox.join(',')}`;
  console.log('downloading', url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSM API ${res.status}`);
  xml = await res.text();
}

// ---------- minimal OSM XML parser (nodes + ways only) ----------
const nodes = new Map();
for (const m of xml.matchAll(/<node id="(\d+)"[^>]*?lat="([-\d.]+)" lon="([-\d.]+)"/g)) {
  nodes.set(m[1], [parseFloat(m[2]), parseFloat(m[3])]);
}
const ways = [];
for (const m of xml.matchAll(/<way id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g)) {
  const refs = [...m[2].matchAll(/<nd ref="(\d+)"/g)].map((r) => r[1]);
  const tags = {};
  for (const t of m[2].matchAll(/<tag k="([^"]+)" v="([^"]*)"/g)) tags[t[1]] = unescape(t[2]);
  ways.push({ id: m[1], refs, tags });
}
function unescape(s) {
  return s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
console.log(`parsed ${nodes.size} nodes, ${ways.length} ways`);

// ---------- projection: local metres, x east, z south (three.js y-up, right handed) ----------
const [lat0, lon0] = site.center;
const R = 6378137;
const kx = (Math.PI / 180) * R * Math.cos((lat0 * Math.PI) / 180);
const kz = (Math.PI / 180) * R;
const proj = ([lat, lon]) => [(lon - lon0) * kx, -(lat - lat0) * kz];
const [cw, ch] = site.cropM;
const inside = ([x, z]) => Math.abs(x) <= cw / 2 && Math.abs(z) <= ch / 2;
const r1 = (v) => Math.round(v * 10) / 10;

// ---------- roads ----------
const ROAD = {
  motorway: { w: null, kind: 'expressway', weight: 12 },
  motorway_link: { w: 6.5, kind: 'ramp', weight: 1 },
  trunk: { w: null, kind: 'arterial', weight: 40 },
  trunk_link: { w: 6, kind: 'arterial', weight: 40 },
  primary: { w: null, kind: 'arterial', weight: 40 },
  primary_link: { w: 6, kind: 'arterial', weight: 40 },
  secondary: { w: null, kind: 'arterial', weight: 40 },
  secondary_link: { w: 6, kind: 'arterial', weight: 40 },
  tertiary: { w: null, kind: 'street', weight: 60 },
  residential: { w: 6, kind: 'street', weight: 60 },
  unclassified: { w: 6, kind: 'street', weight: 60 },
};
const LH = site.layerHeight;

// Subdivide long segments (virtual nodes) so that the height solver can form ramps between
// pinned junctions, e.g. a river bridge whose only OSM nodes are its two abutments.
let virt = 0;
function subdivide(refs, maxLen) {
  const out = [refs[0]];
  for (let i = 1; i < refs.length; i++) {
    const a = nodes.get(refs[i - 1]), b = nodes.get(refs[i]);
    if (a && b) {
      const [ax, az] = proj(a), [bx, bz] = proj(b);
      const n = Math.ceil(Math.hypot(bx - ax, bz - az) / maxLen);
      for (let k = 1; k < n; k++) {
        const id = `v${virt++}`;
        nodes.set(id, [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
        out.push(id);
      }
    }
    out.push(refs[i]);
  }
  return out;
}

const roadWays = [];
for (const w of ways) {
  const spec = ROAD[w.tags.highway];
  if (!spec) continue;
  if (w.tags.tunnel === 'yes' || w.tags.tunnel === 'building_passage') continue;
  w.refs = subdivide(w.refs, 18);
  const pts = w.refs.map((r) => nodes.get(r)).filter(Boolean).map(proj);
  if (pts.length < 2 || !pts.some(inside)) continue;
  const layer = parseInt(w.tags.layer || '0', 10) || 0;
  const bridge = w.tags.bridge === 'yes' || w.tags.bridge === 'viaduct';
  const lanes = parseInt(w.tags.lanes || '0', 10) || 0;
  const hw = w.tags.highway;
  let width = spec.w;
  if (width == null) {
    const n = lanes || (hw === 'motorway' ? 2 : hw === 'primary' || hw === 'trunk' ? 4 : 2);
    width = n * 3.4 + (hw === 'motorway' ? 2.0 : 1.0);
  } else if (lanes > 1) width = lanes * 3.4 + 1.5;
  const target = layer > 0 ? layer * LH : bridge ? LH : 0;
  roadWays.push({
    id: w.id,
    hw,
    kind: spec.kind,
    elevated: layer > 0 || bridge,
    layer,
    target,
    weight: spec.weight,
    width,
    lanes: lanes || (hw.endsWith('_link') ? 1 : 2),
    oneway: w.tags.oneway === 'yes' || hw === 'motorway' || hw === 'motorway_link',
    name: w.tags.name || '',
    ref: w.tags.ref || '',
    refs: w.refs,
    pts,
  });
}

// ---------- height solver ----------
// Each node starts at the mean target height of its incident ways. Ground roads are pinned
// at 0. Then an iterative projection enforces a maximum grade along every edge; heavier
// (mainline) nodes move less than lighter (ramp) nodes, so ramps absorb the transitions.
const nodeH = new Map();
const nodeW = new Map();
const nodeGround = new Set();
const acc = new Map();
for (const w of roadWays) {
  for (const r of w.refs) {
    const a = acc.get(r) || { s: 0, n: 0 };
    a.s += w.target;
    a.n++;
    acc.set(r, a);
    nodeW.set(r, Math.max(nodeW.get(r) || 0, w.weight));
    if (!w.elevated) nodeGround.add(r);
  }
}
for (const [r, a] of acc) nodeH.set(r, nodeGround.has(r) ? 0 : a.s / a.n);

const edges = [];
for (const w of roadWays) {
  for (let i = 1; i < w.refs.length; i++) {
    const a = w.refs[i - 1], b = w.refs[i];
    const pa = nodes.get(a), pb = nodes.get(b);
    if (!pa || !pb) continue;
    const [ax, az] = proj(pa), [bx, bz] = proj(pb);
    edges.push([a, b, Math.hypot(bx - ax, bz - az)]);
  }
}
const MAX_GRADE = 0.055;
for (let it = 0; it < 400; it++) {
  for (const [a, b, L] of edges) {
    const ha = nodeH.get(a), hb = nodeH.get(b);
    const maxD = MAX_GRADE * Math.max(L, 1);
    const d = hb - ha;
    if (Math.abs(d) <= maxD) continue;
    const excess = (Math.abs(d) - maxD) * Math.sign(d);
    const wa = nodeGround.has(a) ? 1e6 : nodeW.get(a);
    const wb = nodeGround.has(b) ? 1e6 : nodeW.get(b);
    nodeH.set(a, ha + (excess * wb) / (wa + wb));
    nodeH.set(b, hb - (excess * wa) / (wa + wb));
  }
  // light Laplacian smoothing along ways to remove kinks
  if (it % 10 === 9) {
    for (const w of roadWays) {
      if (!w.elevated) continue;
      for (let i = 1; i < w.refs.length - 1; i++) {
        const r = w.refs[i];
        if (nodeGround.has(r)) continue;
        const m = (nodeH.get(w.refs[i - 1]) + nodeH.get(w.refs[i + 1])) / 2;
        nodeH.set(r, nodeH.get(r) * 0.6 + m * 0.4);
      }
    }
  }
}
for (const [r, h] of nodeH) nodeH.set(r, Math.max(0, h));

const roads = roadWays.map((w) => ({
  id: w.id,
  hw: w.hw,
  kind: w.kind,
  elevated: w.elevated,
  layer: w.layer,
  width: r1(w.width),
  lanes: w.lanes,
  oneway: w.oneway,
  name: w.name,
  ref: w.ref,
  pts: w.refs.map((r, i) => [r1(w.pts[i][0]), r1(nodeH.get(r)), r1(w.pts[i][1])]),
}));

// ---------- buildings ----------
let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const buildings = [];
for (const w of ways) {
  if (!('building' in w.tags) || w.tags.building === 'no') continue;
  const pts = w.refs.map((r) => nodes.get(r)).filter(Boolean).map(proj);
  if (pts.length < 4 || !pts.some(inside)) continue;
  let h = parseFloat(w.tags.height) || 0;
  const levels = parseInt(w.tags['building:levels'] || '0', 10) || 0;
  if (!h && levels) h = levels * 3.3 + 1.5;
  if (!h) {
    // area based guess: larger footprints in central Tokyo tend to be taller
    let area = 0;
    for (let i = 0; i < pts.length - 1; i++) area += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
    area = Math.abs(area) / 2;
    h = area < 120 ? 7 + rnd() * 6 : area < 600 ? 12 + rnd() * 14 : area < 2500 ? 20 + rnd() * 30 : 30 + rnd() * 50;
    if (/hotel|office|commercial/.test(w.tags.building || '')) h *= 1.4;
  }
  buildings.push({
    id: w.id,
    h: r1(h),
    levels: levels || Math.max(1, Math.round(h / 3.4)),
    name: w.tags.name || '',
    use: w.tags.building === 'yes' ? '' : w.tags.building,
    pts: pts.slice(0, -1).map(([x, z]) => [r1(x), r1(z)]),
  });
}

// ---------- water / parks / rail ----------
const polys = (pred) =>
  ways
    .filter((w) => pred(w.tags) && w.refs[0] === w.refs[w.refs.length - 1])
    .map((w) => w.refs.map((r) => nodes.get(r)).filter(Boolean).map(proj))
    .filter((pts) => pts.length >= 4 && pts.some(inside))
    .map((pts) => pts.slice(0, -1).map(([x, z]) => [r1(x), r1(z)]));
const lines = (pred) =>
  ways
    .filter((w) => pred(w.tags))
    .map((w) => w.refs.map((r) => nodes.get(r)).filter(Boolean).map(proj))
    .filter((pts) => pts.length >= 2 && pts.some(inside))
    .map((pts) => pts.map(([x, z]) => [r1(x), r1(z)]));

const water = polys((t) => t.natural === 'water' || t.waterway === 'riverbank' || t.water);
const riverLines = lines((t) => t.waterway === 'river' || t.waterway === 'canal');
const parks = polys((t) => t.leisure === 'park' || t.leisure === 'garden' || t.landuse === 'grass');
const rail = lines((t) => t.railway === 'rail' && t.tunnel !== 'yes');

const out = {
  site: { key: siteKey, name: site.name, nameJa: site.nameJa, center: site.center, cropM: site.cropM, layerHeight: LH, drive: site.drive },
  roads,
  buildings,
  water,
  riverLines,
  parks,
  rail,
};
const outPath = path.join(here, '..', 'data', `${siteKey}.json`);
fs.writeFileSync(outPath, JSON.stringify(out));
const elev = roads.filter((r) => r.elevated);
const maxH = Math.max(...roads.flatMap((r) => r.pts.map((p) => p[1])));
console.log(`wrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`);
console.log(`roads ${roads.length} (elevated ${elev.length}, max height ${maxH.toFixed(1)} m), buildings ${buildings.length}, water ${water.length}, parks ${parks.length}, rail ${rail.length}`);
