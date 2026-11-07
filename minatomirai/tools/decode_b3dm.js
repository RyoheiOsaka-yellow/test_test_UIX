// Decode PLATEAU b3dm (CESIUM_RTC + KHR_draco_mesh_compression) into plain JSON geometry.
// usage: node decode_b3dm.js <in_dir_or_file>... --out <out.json>
// Output: [{file, rtc:[x,y,z], batch:{gml_id:[], name:[], height:[], ...}, pos:[...ecef-relative xyz], idx:[...], bid:[...per-vertex batch id]}]
const fs = require('fs');
const path = require('path');
const draco3d = require('draco3d');

function parseB3dm(buf) {
  const magic = buf.toString('utf8', 0, 4);
  if (magic !== 'b3dm') throw new Error('not b3dm: ' + magic);
  const ftj = buf.readUInt32LE(12), ftb = buf.readUInt32LE(16), btj = buf.readUInt32LE(20), btb = buf.readUInt32LE(24);
  let o = 28;
  const ft = JSON.parse(buf.toString('utf8', o, o + ftj)); o += ftj + ftb;
  const bt = btj ? JSON.parse(buf.toString('utf8', o, o + btj)) : {};
  const btBin = buf.subarray(o + btj, o + btj + btb); o += btj + btb;
  const n = ft.BATCH_LENGTH || 0;
  const CT = { BYTE: [1, 'readInt8'], UNSIGNED_BYTE: [1, 'readUInt8'], SHORT: [2, 'readInt16LE'], UNSIGNED_SHORT: [2, 'readUInt16LE'], INT: [4, 'readInt32LE'], UNSIGNED_INT: [4, 'readUInt32LE'], FLOAT: [4, 'readFloatLE'], DOUBLE: [8, 'readDoubleLE'] };
  for (const k of Object.keys(bt)) {
    const v = bt[k];
    if (v && !Array.isArray(v) && typeof v === 'object' && v.byteOffset !== undefined) {
      const [sz, fn] = CT[v.componentType] || CT.FLOAT;
      const nc = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[v.type] || 1;
      const arr = [];
      for (let i = 0; i < n; i++) {
        if (nc === 1) arr.push(btBin[fn](v.byteOffset + i * sz));
        else { const t = []; for (let c = 0; c < nc; c++) t.push(btBin[fn](v.byteOffset + (i * nc + c) * sz)); arr.push(t); }
      }
      bt[k] = arr;
    }
  }
  const glb = buf.subarray(o);
  const jsonLen = glb.readUInt32LE(12);
  const gltf = JSON.parse(glb.toString('utf8', 20, 20 + jsonLen));
  let p = 20 + jsonLen;
  let bin = null;
  while (p < glb.length) {
    const len = glb.readUInt32LE(p), type = glb.readUInt32LE(p + 4);
    if (type === 0x004E4942) { bin = glb.subarray(p + 8, p + 8 + len); break; }
    p += 8 + len;
  }
  return { ft, bt, gltf, bin };
}

function decodeDraco(decoderModule, bytes, attrMap) {
  const decoder = new decoderModule.Decoder();
  const dbuf = new decoderModule.DecoderBuffer();
  dbuf.Init(bytes, bytes.length);
  const geomType = decoder.GetEncodedGeometryType(dbuf);
  if (geomType !== decoderModule.TRIANGULAR_MESH) throw new Error('not a mesh');
  const mesh = new decoderModule.Mesh();
  const st = decoder.DecodeBufferToMesh(dbuf, mesh);
  if (!st.ok()) throw new Error('draco decode failed: ' + st.error_msg());
  const nF = mesh.num_faces(), nV = mesh.num_points();
  const idx = new Uint32Array(nF * 3);
  const ia = new decoderModule.DracoInt32Array();
  for (let i = 0; i < nF; i++) { decoder.GetFaceFromMesh(mesh, i, ia); idx[i * 3] = ia.GetValue(0); idx[i * 3 + 1] = ia.GetValue(1); idx[i * 3 + 2] = ia.GetValue(2); }
  decoderModule.destroy(ia);
  const out = { idx, nV };
  for (const [name, uid] of Object.entries(attrMap)) {
    const attr = decoder.GetAttributeByUniqueId(mesh, uid);
    const nc = attr.num_components();
    const arr = new decoderModule.DracoFloat32Array();
    decoder.GetAttributeFloatForAllPoints(mesh, attr, arr);
    const f = new Float32Array(nV * nc);
    for (let i = 0; i < nV * nc; i++) f[i] = arr.GetValue(i);
    decoderModule.destroy(arr);
    out[name] = { data: f, nc };
  }
  decoderModule.destroy(mesh); decoderModule.destroy(dbuf); decoderModule.destroy(decoder);
  return out;
}

function mat4Mul(a, b) { // column-major 4x4
  const r = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) for (let k = 0; k < 4; k++) r[c * 4 + rr] += a[k * 4 + rr] * b[c * 4 + k];
  return r;
}
function nodeMatrix(n) {
  if (n.matrix) return n.matrix;
  const t = n.translation || [0, 0, 0], q = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1];
  const [x, y, z, w] = q;
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [
    (1 - 2 * (yy + zz)) * s[0], 2 * (xy + wz) * s[0], 2 * (xz - wy) * s[0], 0,
    2 * (xy - wz) * s[1], (1 - 2 * (xx + zz)) * s[1], 2 * (yz + wx) * s[1], 0,
    2 * (xz + wy) * s[2], 2 * (yz - wx) * s[2], (1 - 2 * (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1];
}
function applyMat(m, x, y, z) {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
}

async function main() {
  const args = process.argv.slice(2);
  const oi = args.indexOf('--out');
  const outFile = oi >= 0 ? args[oi + 1] : 'decoded.json';
  const inputs = args.filter((a, i) => i !== oi && i !== oi + 1);
  const files = [];
  for (const inp of inputs) {
    const st = fs.statSync(inp);
    if (st.isDirectory()) for (const f of fs.readdirSync(inp)) if (f.endsWith('.b3dm')) files.push(path.join(inp, f));
    else files.push(inp);
  }
  const decoderModule = await draco3d.createDecoderModule({});
  const result = [];
  let totTri = 0, totV = 0;
  for (const f of files) {
    const buf = fs.readFileSync(f);
    let parsed;
    try { parsed = parseB3dm(buf); } catch (e) { console.error(f, e.message); continue; }
    const { ft, bt, gltf, bin } = parsed;
    const rtc = (gltf.extensions && gltf.extensions.CESIUM_RTC && gltf.extensions.CESIUM_RTC.center) || [0, 0, 0];
    // walk nodes with transforms
    const nodeMats = new Map();
    const scene = gltf.scenes ? gltf.scenes[gltf.scene || 0] : { nodes: gltf.nodes.map((_, i) => i) };
    const walk = (ni, parent) => {
      const n = gltf.nodes[ni];
      const m = mat4Mul(parent, nodeMatrix(n));
      if (n.mesh !== undefined) nodeMats.set(ni, m);
      (n.children || []).forEach(c => walk(c, m));
    };
    const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    (scene.nodes || []).forEach(ni => walk(ni, I));
    const pos = [], idx = [], bid = [];
    let base = 0;
    for (const [ni, m] of nodeMats) {
      const mesh = gltf.meshes[gltf.nodes[ni].mesh];
      for (const prim of mesh.primitives) {
        const ext = prim.extensions && prim.extensions.KHR_draco_mesh_compression;
        if (!ext) { console.error(f, 'non-draco primitive skipped'); continue; }
        const bv = gltf.bufferViews[ext.bufferView];
        const bytes = new Uint8Array(bin.buffer, bin.byteOffset + (bv.byteOffset || 0), bv.byteLength);
        const dec = decodeDraco(decoderModule, bytes, { POSITION: ext.attributes.POSITION, ...(ext.attributes._BATCHID !== undefined ? { _BATCHID: ext.attributes._BATCHID } : {}) });
        const P = dec.POSITION.data;
        for (let i = 0; i < dec.nV; i++) {
          const v = applyMat(m, P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
          pos.push(Math.round(v[0] * 1000) / 1000, Math.round(v[1] * 1000) / 1000, Math.round(v[2] * 1000) / 1000);
          bid.push(dec._BATCHID ? dec._BATCHID.data[i] | 0 : 0);
        }
        for (let i = 0; i < dec.idx.length; i++) idx.push(dec.idx[i] + base);
        base += dec.nV;
        totTri += dec.idx.length / 3; totV += dec.nV;
      }
    }
    const batch = {};
    for (const k of ['gml_id', 'gml:name', 'bldg:measuredHeight', 'bldg:usage', 'bldg:class', 'bldg:storeysAboveGround', 'bldg:storeysBelowGround', 'brid:class', 'brid:function', 'feature_type', 'uro:BuildingIDAttribute_uro:buildingID', 'uro:lodType']) {
      if (bt[k] !== undefined) batch[k] = bt[k];
    }
    // attributes blob (JSON strings) may hold usage/storeys: extract compactly
    if (bt.attributes) {
      batch.usage = []; batch.storeys = []; batch.storeysBelow = [];
      for (const s of bt.attributes) {
        let a = {}; try { a = typeof s === 'string' ? JSON.parse(s) : s; } catch (e) { }
        batch.usage.push(a['bldg:usage'] ?? null);
        batch.storeys.push(a['bldg:storeysAboveGround'] ?? null);
        batch.storeysBelow.push(a['bldg:storeysBelowGround'] ?? null);
      }
    }
    result.push({ file: f, batchLength: ft.BATCH_LENGTH, rtc, batch, pos, idx, bid });
  }
  fs.writeFileSync(outFile, JSON.stringify(result));
  console.log(`decoded ${result.length} files, ${totV} verts, ${totTri} tris -> ${outFile} (${(fs.statSync(outFile).size / 1e6).toFixed(1)} MB)`);
}
main().catch(e => { console.error(e); process.exit(1); });
