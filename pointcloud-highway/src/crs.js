// Coordinate reference systems for LAS files: VLR parsing (GeoTIFF keys / WKT), EPSG lookup for the
// systems common in Japan, and Transverse Mercator forward/inverse (Krüger series) so a scan can be
// placed on the globe. No imports.

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const GRS80 = { a: 6378137, f: 1 / 298.257222101 };
const WGS84 = { a: 6378137, f: 1 / 298.257223563 };

// 平面直角座標系 I–XIX 系原点（JGD2011: EPSG 6669–6687, JGD2000: 2443–2461）
const ZONES = [
  [33, 129.5], [33, 131], [36, 132 + 10 / 60], [33, 133.5], [36, 134 + 20 / 60], [36, 136], [36, 137 + 10 / 60], [36, 138.5], [36, 139 + 50 / 60],
  [40, 140 + 50 / 60], [44, 140.25], [44, 142.25], [44, 144.25], [26, 142], [26, 127.5], [26, 124], [26, 131], [20, 136], [26, 154],
];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX'];

/** Describe an EPSG code: { name, tm: { lat0, lon0, k0, fe, fn, ell } } or geographic/other. */
export function describeEpsg(code) {
  if (!code) return null;
  if (code >= 6669 && code <= 6687) { const z = code - 6669; return { epsg: code, name: `JGD2011 / 平面直角座標系 第${ROMAN[z]}系`, tm: { lat0: ZONES[z][0], lon0: ZONES[z][1], k0: 0.9999, fe: 0, fn: 0, ell: GRS80 }, datum: 'JGD2011' }; }
  if (code >= 2443 && code <= 2461) { const z = code - 2443; return { epsg: code, name: `JGD2000 / 平面直角座標系 第${ROMAN[z]}系`, tm: { lat0: ZONES[z][0], lon0: ZONES[z][1], k0: 0.9999, fe: 0, fn: 0, ell: GRS80 }, datum: 'JGD2000' }; }
  if (code >= 6688 && code <= 6691) { const zone = 51 + (code - 6688); return { epsg: code, name: `JGD2011 / UTM zone ${zone}N`, tm: { lat0: 0, lon0: zone * 6 - 183, k0: 0.9996, fe: 500000, fn: 0, ell: GRS80 }, datum: 'JGD2011' }; }
  if (code >= 3097 && code <= 3100) { const zone = 51 + (code - 3097); return { epsg: code, name: `JGD2000 / UTM zone ${zone}N`, tm: { lat0: 0, lon0: zone * 6 - 183, k0: 0.9996, fe: 500000, fn: 0, ell: GRS80 }, datum: 'JGD2000' }; }
  if (code >= 32601 && code <= 32660) { const zone = code - 32600; return { epsg: code, name: `WGS 84 / UTM zone ${zone}N`, tm: { lat0: 0, lon0: zone * 6 - 183, k0: 0.9996, fe: 500000, fn: 0, ell: WGS84 }, datum: 'WGS84' }; }
  if (code >= 32701 && code <= 32760) { const zone = code - 32700; return { epsg: code, name: `WGS 84 / UTM zone ${zone}S`, tm: { lat0: 0, lon0: zone * 6 - 183, k0: 0.9996, fe: 500000, fn: 10000000, ell: WGS84 }, datum: 'WGS84' }; }
  if (code === 3857) return { epsg: code, name: 'WGS 84 / Pseudo-Mercator（Web メルカトル：縮尺が緯度で変わるため寸法計測には不向き）', merc: true, datum: 'WGS84' };
  if (code === 4326 || code === 6668 || code === 4612) return { epsg: code, name: code === 4326 ? 'WGS 84（経緯度）' : `JGD${code === 6668 ? '2011' : '2000'}（経緯度）`, geographic: true };
  return { epsg: code, name: `EPSG:${code}` };
}

/** Parse LAS VLRs for a CRS. Returns { epsg, wkt, source } or null. */
export function readLasCrs(buf, header) {
  const dv = new DataView(buf);
  const nVlr = dv.getUint32(100, true);
  let off = header.headerSize;
  let geoKeys = null, wkt = null;
  for (let i = 0; i < nVlr && off + 54 <= buf.byteLength; i++) {
    const userId = ascii(buf, off + 2, 16), recId = dv.getUint16(off + 18, true), len = dv.getUint16(off + 20, true);
    const data = off + 54;
    if (userId === 'LASF_Projection' && recId === 34735) geoKeys = parseGeoKeys(dv, data, len);
    if (userId === 'LASF_Projection' && recId === 2112) wkt = ascii(buf, data, len).replace(/\0+$/, '');
    off = data + len;
  }
  if (geoKeys && geoKeys.epsg) return { epsg: geoKeys.epsg, wkt, source: 'GeoTIFF キー (VLR 34735)', vertical: geoKeys.vertical };
  if (wkt) { const m = /AUTHORITY\["EPSG",\s*"?(\d+)"?\]\s*\]?\s*$/i.exec(wkt) || /ID\["EPSG",\s*(\d+)\]\s*\]?\s*$/i.exec(wkt); return { epsg: m ? +m[1] : null, wkt, source: 'WKT (VLR 2112)' }; }
  return null;
}
function ascii(buf, off, len) { const u = new Uint8Array(buf, off, Math.min(len, buf.byteLength - off)); let s = ''; for (let i = 0; i < u.length && u[i]; i++) s += String.fromCharCode(u[i]); return s; }
function parseGeoKeys(dv, off, len) {
  if (len < 8) return null;
  const nKeys = dv.getUint16(off + 6, true);
  let epsg = null, vertical = null, model = null;
  for (let k = 0; k < nKeys && off + 8 + k * 8 + 8 <= off + len; k++) {
    const id = dv.getUint16(off + 8 + k * 8, true), loc = dv.getUint16(off + 10 + k * 8, true), val = dv.getUint16(off + 14 + k * 8, true);
    if (loc !== 0) continue;
    if (id === 3072) epsg = val;            // ProjectedCSTypeGeoKey
    if (id === 2048 && !epsg) model = val;  // GeographicTypeGeoKey
    if (id === 4096) vertical = val;        // VerticalCSTypeGeoKey
  }
  return { epsg: epsg || model, vertical };
}

/** Build the GeoKeyDirectory VLR bytes for a projected EPSG code (for the LAS writer). */
export function geoKeyVlr(epsg) {
  const keys = [[1024, 0, 1, 1], [3072, 0, 1, epsg], [3076, 0, 1, 9001]]; // ModelType=Projected, ProjectedCSType, LinearUnits=metre
  const body = new ArrayBuffer(8 + keys.length * 8), dv = new DataView(body);
  dv.setUint16(0, 1, true); dv.setUint16(2, 1, true); dv.setUint16(4, 0, true); dv.setUint16(6, keys.length, true);
  keys.forEach((k, i) => k.forEach((v, j) => dv.setUint16(8 + i * 8 + j * 2, v, true)));
  const vlr = new ArrayBuffer(54 + body.byteLength), u = new Uint8Array(vlr), d2 = new DataView(vlr);
  u.set(new TextEncoder().encode('LASF_Projection'), 2); d2.setUint16(18, 34735, true); d2.setUint16(20, body.byteLength, true);
  u.set(new TextEncoder().encode('GeoTIFF GeoKeyDirectoryTag'), 22);
  u.set(new Uint8Array(body), 54);
  return vlr;
}

// ---------------------------------------------------------------- Transverse Mercator (Krüger series, as in GSI / Karney)
function tmConstants(ell) {
  const { a, f } = ell, n = f / (2 - f);
  const A = (a / (1 + n)) * (1 + n * n / 4 + n ** 4 / 64);
  const alpha = [0, n / 2 - 2 * n * n / 3 + 5 * n ** 3 / 16, 13 * n * n / 48 - 3 * n ** 3 / 5, 61 * n ** 3 / 240];
  const beta = [0, n / 2 - 2 * n * n / 3 + 37 * n ** 3 / 96, n * n / 48 + n ** 3 / 15, 17 * n ** 3 / 480];
  const delta = [0, 2 * n - 2 * n * n / 3 - 2 * n ** 3, 7 * n * n / 3 - 8 * n ** 3 / 5, 56 * n ** 3 / 15];
  return { n, A, alpha, beta, delta };
}
function meridianArc(lat0, ell) {
  const { A, alpha } = tmConstants(ell); const { f } = ell; const n = f / (2 - f);
  const e2 = f * (2 - f);
  const t = Math.sinh(Math.atanh(Math.sin(lat0)) - (2 * Math.sqrt(n) / (1 + n)) * Math.atanh((2 * Math.sqrt(n) / (1 + n)) * Math.sin(lat0)));
  const xi = Math.atan(t / Math.cos(0)); // lon diff 0
  let s = xi; for (let j = 1; j <= 3; j++) s += alpha[j] * Math.sin(2 * j * xi);
  return A * s;
}
/** lat/lon (deg) → { e, n } metres in the given TM definition. */
export function tmForward(lat, lon, tm) {
  const { A, alpha } = tmConstants(tm.ell), f = tm.ell.f, n = f / (2 - f);
  const phi = lat * D2R, lam = (lon - tm.lon0) * D2R;
  const k = (2 * Math.sqrt(n)) / (1 + n);
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - k * Math.atanh(k * Math.sin(phi)));
  const xi = Math.atan2(t, Math.cos(lam)), eta = Math.atanh(Math.sin(lam) / Math.sqrt(1 + t * t));
  let E = eta, N = xi;
  for (let j = 1; j <= 3; j++) { E += alpha[j] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta); N += alpha[j] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta); }
  const S0 = meridianArc(tm.lat0 * D2R, tm.ell);
  return { e: tm.k0 * A * E + tm.fe, n: tm.k0 * (A * N - S0) + tm.fn };
}
/** { e, n } metres → { lat, lon } degrees. */
export function tmInverse(e, n, tm) {
  const { A, beta, delta } = tmConstants(tm.ell), f = tm.ell.f, nn = f / (2 - f);
  const S0 = meridianArc(tm.lat0 * D2R, tm.ell);
  const xi = ((n - tm.fn) / tm.k0 + S0) / A, eta = (e - tm.fe) / (tm.k0 * A);
  let xi2 = xi, eta2 = eta;
  for (let j = 1; j <= 3; j++) { xi2 -= beta[j] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta); eta2 -= beta[j] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta); }
  const chi = Math.asin(Math.sin(xi2) / Math.cosh(eta2));
  let phi = chi; for (let j = 1; j <= 3; j++) phi += delta[j] * Math.sin(2 * j * chi);
  const lam = Math.atan2(Math.sinh(eta2), Math.cos(xi2));
  return { lat: phi * R2D, lon: tm.lon0 + lam * R2D };
}
/** Guess a Japanese plane-rectangular zone from projected coordinates (metres) when the file has no CRS. */
export function guessZone(e, n) {
  // plane rectangular coordinates are within ±~300 km of the zone origin; UTM eastings are 100k–900k
  if (Math.abs(e) < 400000 && Math.abs(n) < 500000) return { hint: '平面直角座標系の可能性（原点からの距離が小さい）。系番号はファイルに記録されていません。' };
  if (e > 100000 && e < 900000 && n > 2000000 && n < 5500000) return { hint: 'UTM 北半球の可能性（例: 東京は zone 54N, EPSG:6691 / 32654）' };
  return null;
}
export function formatDms(deg, latlon) {
  const h = latlon === 'lat' ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W');
  const a = Math.abs(deg), d = Math.floor(a), m = Math.floor((a - d) * 60), s = ((a - d) * 60 - m) * 60;
  return `${d}°${String(m).padStart(2, '0')}′${s.toFixed(2).padStart(5, '0')}″${h}`;
}
