// Real traffic counts → roads. Assigns each census section (data/traffic.json) to the OSM ways it covers
// and derives per-way hourly volume, heavy-vehicle share and speed. Pure functions, no three.js.
import { resample, framePath, pathLength } from './geom.js';

const VF = { expressway: 60, ramp: 40, arterial: 40 }; // free-flow speed (km/h) when the census speed is lower

/**
 * Hourly volumes (index = clock hour) of a station for one direction ('up' | 'down') or both (null).
 * Daytime hours of a direction are observed; its night hours are the station's total hourly counts
 * split by that direction's share of the night total. Holidays are an estimate (see dayType.holiday.basis).
 */
export function stationHourly(st, dir, tdata, dayType = 'weekday', rk = 'exp') {
  const shape = tdata.surfaceShape;
  const tot = st.hourly || { small: shape.small.map((f) => f * st.v24), large: shape.large.map((f) => f * st.v24) };
  let small = tot.small.slice(), large = tot.large.slice();
  const d = dir && st.dir && st.dir[dir];
  if (d) {
    const nightTot = st.v24 - st.v12;
    const share = d.v24 != null && nightTot > 0 ? (d.v24 - d.v12) / nightTot : d.v12 / st.v12;
    for (let h = 0; h < 24; h++) {
      if (h >= 7 && h < 19) { small[h] = d.small12h[h - 7]; large[h] = d.large12h[h - 7]; }
      else { small[h] *= share; large[h] *= share; }
    }
  } else if (dir) { small = small.map((v) => v / 2); large = large.map((v) => v / 2); }
  if (dayType === 'holiday') {
    const H = tdata.dayType.holiday, before = small.reduce((a, v) => a + v, 0) + large.reduce((a, v) => a + v, 0);
    small = small.map((v, h) => v * H.hourRatioSmall[h]); large = large.map((v, h) => v * H.hourRatioLarge[h]);
    const after = small.reduce((a, v) => a + v, 0) + large.reduce((a, v) => a + v, 0);
    const k = (before * (H.volumeRatio[rk] ?? H.volumeRatio.exp)) / Math.max(1, after);
    small = small.map((v) => v * k); large = large.map((v) => v * k);
  }
  return { small, large };
}
const sum = (a) => a.reduce((x, v) => x + v, 0);

export function buildFlowModel(data, tdata, siteKey, dayType = 'weekday') {
  const site = tdata.sites[siteKey];
  if (!site) return null;
  const [lat0, lon0] = data.site.center;
  const kx = (Math.PI / 180) * 6378137 * Math.cos((lat0 * Math.PI) / 180), kz = (Math.PI / 180) * 6378137;
  const proj = ([lat, lon]) => [(lon - lon0) * kx, -(lat - lat0) * kz];
  const distSeg = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2)); return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t); };
  const sections = site.sections.map((s, i) => ({ ...s, index: i, st: tdata.stations[s.station], a: s.from && proj(s.from), b: s.to && proj(s.to), upPt: s.up && proj(s.up), laneLen: 0, ways: [] }));
  const expSections = sections.filter((s) => s.kind === 'exp');
  for (const sc of sections) {
    sc.rk = sc.rk || (sc.kind === 'exp' ? 'exp' : 'surface');
    const t = stationHourly(sc.st, null, tdata, dayType, sc.rk), u = stationHourly(sc.st, 'up', tdata, dayType, sc.rk), d = stationHourly(sc.st, 'down', tdata, dayType, sc.rk);
    sc.day = { small: t.small, large: t.large, v24: Math.round(sum(t.small) + sum(t.large)), qUp: u.small.map((v, i) => v + u.large[i]), qDown: d.small.map((v, i) => v + d.large[i]), est: !!sc.st.v24est || dayType === 'holiday', hasDir: !!sc.st.dir };
    sc.day.up24 = Math.round(sum(sc.day.qUp)); sc.day.down24 = Math.round(sum(sc.day.qDown));
  }

  // Roads are cut into ~100 m chunks so that a long OSM way spanning several census sections is
  // assigned section by section. `flows` (chunks) drive the visualisation, `tracks` (whole ways) the simulation.
  const flows = [], tracks = [];
  const CHUNK = 100;
  data.roads.forEach((road, ri) => {
    if (road.kind === 'street') return;
    const full = framePath(resample(road.pts, 4)), Lr = pathLength(full);
    if (Lr < 4) return;
    const isExp = road.kind === 'expressway' || road.kind === 'ramp';
    const label = `${road.name || ''} ${road.ref || ''}`;
    const oneway = !!(road.oneway || (road.elevated && isExp));
    const lanes = Math.max(1, road.lanes || 1);
    const nCh = Math.max(1, Math.round(Lr / CHUNK)), per = Math.ceil((full.length - 1) / nCh);
    const chunks = [];
    for (let c = 0; c < nCh; c++) {
      const i0 = c * per, i1 = Math.min(full.length - 1, (c + 1) * per);
      if (i1 - i0 < 1) continue;
      const s0 = full[i0].s, path = full.slice(i0, i1 + 1).map((q) => ({ ...q, s: q.s - s0 }));
      const mid = path[path.length >> 1], m2 = [mid.x, mid.z], L = path[path.length - 1].s;
      let best = null, bd = Infinity;
      for (const sc of sections) {
        if ((sc.kind === 'exp') !== isExp) continue;
        if (!road.ref || !sc.refs.includes(road.ref)) continue;
        if (sc.names && !new RegExp(sc.names).test(road.name || '')) continue;
        const d = sc.a ? distSeg(m2, sc.a, sc.b) : 0;
        if (d < bd) { bd = d; best = sc; }
      }
      let f;
      if (best && bd < 260) f = { sec: best, st: best.st, measured: true };
      else if (isExp) {
        // connecting road without a count: estimate from the balance of the adjacent sections
        const rule = site.ramps.find((r) => r.match === '' || new RegExp(r.match).test(label));
        let near = null, nd = Infinity;
        for (const sc of expSections) { const d = distSeg(m2, sc.a, sc.b); if (d < nd) { nd = d; near = sc; } }
        if (!rule || !near) continue;
        f = { sec: near, st: near.st, measured: false, ramp: rule };
      } else continue;
      Object.assign(f, { ri, road, path, L, oneway, lanes, mid: m2 });
      // direction: 上り = towards the route origin
      const a = path[0], b = path[path.length - 1];
      f.up = oneway && f.sec.upPt ? (b.x - a.x) * (f.sec.upPt[0] - mid.x) + (b.z - a.z) * (f.sec.upPt[1] - mid.z) > 0 : null;
      if (f.measured) f.sec.ways.push(f);
      chunks.push(f); flows.push(f);
    }
    if (chunks.length) tracks.push({ ri, road, path: full, L: Lr, oneway, lanes, chunks });
  });
  // share of the section volume carried by each chunk: half per direction, divided between parallel
  // carriageways of the same direction (e.g. the 6号 and 9号 lanes side by side) in proportion to their lanes
  for (const sc of sections) {
    if (sc.kind !== 'exp') { for (const f of sc.ways) { f.share = 1; f.dirKey = f.oneway ? 'half' : null; } continue; } // one-way surface ways: direction unknown → half
    const ab = [sc.b[0] - sc.a[0], sc.b[1] - sc.a[1]], L2 = ab[0] * ab[0] + ab[1] * ab[1];
    for (const dir of [true, false, null]) {
      const ws = sc.ways.filter((f) => f.up === dir);
      if (!ws.length) continue;
      let t0 = 1, t1 = 0, laneLen = 0;
      for (const f of ws) { const t = Math.max(0, Math.min(1, ((f.mid[0] - sc.a[0]) * ab[0] + (f.mid[1] - sc.a[1]) * ab[1]) / L2)); t0 = Math.min(t0, t); t1 = Math.max(t1, t); laneLen += f.lanes * f.L; }
      const covered = Math.max(CHUNK, (t1 - t0) * Math.sqrt(L2) + CHUNK); // centreline length actually covered by the model
      const lanesAcross = Math.max(1, laneLen / covered);               // lanes of this direction across the section
      for (const f of ws) { f.share = Math.min(1, f.lanes / lanesAcross); f.dirKey = dir === null ? 'half' : dir ? 'up' : 'down'; }
    }
  }
  let vmax = 0, qmax = 0;
  for (const f of flows) {
    const st = f.st, rk = f.sec.rk;
    let h, k;
    if (f.measured) { // direction-specific counts where the direction is known
      h = stationHourly(st, f.dirKey === 'half' ? null : f.dirKey, tdata, dayType, rk);
      k = f.share * (f.dirKey === 'half' ? 0.5 : 1);
    } else {          // connecting road: balance-based daily estimate with the neighbouring section's hourly shape
      h = stationHourly(st, null, tdata, dayType, rk);
      k = (f.ramp.v24 / 2) * (dayType === 'holiday' ? (tdata.dayType.holiday.volumeRatio[rk] ?? 1) : 1) / Math.max(1, sum(h.small) + sum(h.large));
    }
    f.q = h.small.map((v, i) => (v + h.large[i]) * k);            // veh/h on this chunk, per clock hour
    f.v24 = sum(f.q);
    f.v24est = f.measured ? !!st.v24est || dayType === 'holiday' : true;
    f.hvh = h.small.map((v, i) => h.large[i] / Math.max(1, v + h.large[i])); // heavy-vehicle share per hour
    f.qmax = Math.max(...f.q);
    const obs = f.up == null ? (st.vUp && st.vDown ? (st.vUp + st.vDown) / 2 : st.vUp || st.vDown) : f.up ? st.vUp : st.vDown;
    f.vPeak = obs || 30;                                           // 朝夕旅行速度 from the census (km/h)
    f.vFree = Math.max(VF[f.road.kind] || 40, f.vPeak);
    if (f.v24 > vmax) vmax = f.v24;
    if (f.qmax > qmax) qmax = f.qmax;
  }
  // whole-way aggregates for the simulation (length-weighted means of the chunks)
  for (const t of tracks) {
    const Ls = t.chunks.reduce((a, f) => a + f.L, 0);
    t.q = Array.from({ length: 24 }, (_, h) => t.chunks.reduce((a, f) => a + f.q[h] * f.L, 0) / Ls);
    t.qmax = Math.max(...t.q);
    t.vPeak = t.chunks.reduce((a, f) => a + f.vPeak * f.L, 0) / Ls;
    t.vFree = Math.max(...t.chunks.map((f) => f.vFree));
    t.hv = t.chunks.reduce((a, f) => a + f.st.hv * f.L, 0) / Ls;
    t.v24 = t.chunks.reduce((a, f) => a + f.v24 * f.L, 0) / Ls;
  }
  return { flows, tracks, sections, vmax, qmax, site, tdata, siteKey, dayType };
}

/** Linear interpolation of an hourly array at fractional clock hour (bin centres at h + 0.5). */
export function atHour(arr, hour) {
  const x = ((hour - 0.5) % 24 + 24) % 24, i = Math.floor(x), t = x - i;
  return arr[i] * (1 - t) + arr[(i + 1) % 24] * t;
}
/** Speed (km/h): free flow off-peak, falling to the observed peak-hour travel speed at the hourly maximum. */
export function speedAt(f, hour) {
  const r = Math.min(1, atHour(f.q, hour) / f.qmax);
  return f.vFree - (f.vFree - f.vPeak) * Math.pow(r, 3);
}

// ---------------------------------------------------------------- colour ramps (sRGB 0..1)
const ramp = (stops) => (t) => { t = Math.max(0, Math.min(1, t)); const f = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)), u = f - i; return stops[i].map((v, k) => v + (stops[i + 1][k] - v) * u); };
export const RAMPS = {
  volume: ramp([[0.16, 0.36, 0.95], [0.1, 0.8, 0.95], [0.45, 0.95, 0.55], [1.0, 0.86, 0.2], [1.0, 0.32, 0.15]]),
  congestion: ramp([[0.2, 0.85, 0.5], [0.75, 0.9, 0.3], [1.0, 0.8, 0.2], [1.0, 0.45, 0.15], [0.95, 0.15, 0.2]]),
  speed: ramp([[0.95, 0.15, 0.2], [1.0, 0.5, 0.15], [1.0, 0.85, 0.25], [0.55, 0.9, 0.4], [0.2, 0.8, 0.95]]),
  heavy: ramp([[0.35, 0.3, 0.75], [0.6, 0.35, 0.85], [0.9, 0.45, 0.6], [1.0, 0.65, 0.3], [1.0, 0.85, 0.3]]),
  diverge: ramp([[0.15, 0.4, 1.0], [0.35, 0.65, 1.0], [0.62, 0.66, 0.72], [1.0, 0.6, 0.35], [0.95, 0.25, 0.2]]),
};
export const METRICS = {
  v24: { label: '日交通量', unit: '台/日', ramp: 'volume', value: (f) => f.v24, norm: (v, m) => v / m.vmax, ticks: (m) => ['0', Math.round(m.vmax).toLocaleString()] },
  qh: { label: '時間交通量', unit: '台/時', ramp: 'volume', value: (f, h) => atHour(f.q, h), norm: (v, m) => v / m.qmax, ticks: (m) => ['0', Math.round(m.qmax).toLocaleString()] },
  congestion: { label: '混雑度', unit: '', ramp: 'congestion', value: (f) => f.st.congestion, norm: (v) => (v - 0.4) / 0.9, ticks: () => ['0.4', '1.3'], measuredOnly: true },
  speed: { label: '走行速度', unit: 'km/h', ramp: 'speed', value: (f, h) => speedAt(f, h), norm: (v) => (v - 10) / 60, ticks: () => ['10', '70 km/h'] },
  growth: { label: '平成27年度比', unit: '%', ramp: 'diverge', value: (f) => (f.st.growth ? (f.st.growth - 1) * 100 : 0), norm: (v) => (v + 15) / 30, ticks: () => ['−15 %', '+15 %'], measuredOnly: true },
  heavy: { label: '大型車混入率', unit: '%', ramp: 'heavy', value: (f, h) => atHour(f.hvh, h) * 100, norm: (v) => v / 40, ticks: () => ['0', '40 %'] },
};
export function rampCss(name) { const r = RAMPS[name]; const s = []; for (let i = 0; i <= 8; i++) { const c = r(i / 8); s.push(`rgb(${c.map((v) => (v * 255) | 0).join(',')}) ${i * 12.5}%`); } return `linear-gradient(90deg, ${s.join(',')})`; }
