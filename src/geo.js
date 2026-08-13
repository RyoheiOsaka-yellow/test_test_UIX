/* ============================================================
   XBUILD SOP Layer — geo.js
   統一ジオメトリ型 GeoSet と属性システム。
   依存なし（DOM / three.js を参照しない純粋 JS）。
   ============================================================ */

'use strict';

/* ---------- 属性型テーブル ---------- */

const TYPES = {
  float: { size: 1, array: Float32Array, zero: 0 },
  int:   { size: 1, array: Int32Array,   zero: 0 },
  vec2:  { size: 2, array: Float32Array, zero: 0 },
  vec3:  { size: 3, array: Float32Array, zero: 0 },
  vec4:  { size: 4, array: Float32Array, zero: 0 },
  quat:  { size: 4, array: Float32Array, zero: 0 },
  mat3:  { size: 9, array: Float32Array, zero: 0 },
  mat4:  { size: 16, array: Float32Array, zero: 0 },
  // string は文字列テーブルへのインデックスを Int32Array で保持する
  string:{ size: 1, array: Int32Array,   zero: 0 },
};

const OWNERS = ['point', 'vertex', 'prim', 'detail'];

/* ============================================================
   Attribute
   - data は TypedArray。string 型のみ strings テーブルを併せ持つ。
   - frozen=true の間は共有バッファ。書き込み時に自動でコピーする（COW）。
   ============================================================ */

class Attribute {
  constructor(name, type, count, opts = {}) {
    const t = TYPES[type];
    if (!t) throw new Error(`unknown attribute type: ${type}`);
    this.name = name;
    this.type = type;
    this.size = t.size;
    this.data = opts.data || new t.array(count * t.size);
    this.strings = type === 'string' ? (opts.strings || ['']) : null;
    this.frozen = false;
  }

  /** 確保済み容量（論理要素数ではない。論理数は AttribSet.count が持つ） */
  get capacity() { return this.data.length / this.size; }

  /** COW: 共有中なら実体を複製してから書き込み可能にする */
  _unshare() {
    if (!this.frozen) return;
    this.data = this.data.slice();
    if (this.strings) this.strings = this.strings.slice();
    this.frozen = false;
  }

  /** 共有クローン。実バッファはコピーしない */
  shareClone() {
    this.frozen = true;
    const a = Object.create(Attribute.prototype);
    a.name = this.name; a.type = this.type; a.size = this.size;
    a.data = this.data; a.strings = this.strings; a.frozen = true;
    return a;
  }

  /** 容量を newCount 以上に確保する（縮小はしない）。倍化により append は償却 O(1) */
  reserve(newCount) {
    if (!this.frozen && this.capacity >= newCount) return;
    const t = TYPES[this.type];
    const cap = Math.max(newCount, this.capacity * 2, 8);
    const next = new t.array(cap * this.size);
    next.set(this.data.subarray(0, Math.min(this.data.length, next.length)));
    // 共有中だった場合、文字列テーブルもここで切り離す
    if (this.frozen && this.strings) this.strings = this.strings.slice();
    this.data = next;
    this.frozen = false;
  }

  /* --- 読み --- */
  get(i) {
    if (this.type === 'string') return this.strings[this.data[i]] ?? '';
    if (this.size === 1) return this.data[i];
    return Array.from(this.data.subarray(i * this.size, (i + 1) * this.size));
  }

  /* --- 書き --- */
  set(i, v) {
    this._unshare();
    if (this.type === 'string') {
      let idx = this.strings.indexOf(v);
      if (idx < 0) { idx = this.strings.length; this.strings.push(String(v)); }
      this.data[i] = idx;
      return;
    }
    if (this.size === 1) { this.data[i] = v; return; }
    this.data.set(v, i * this.size);
  }

  /** 書き込み用の生バッファ（COW 解除済み）を返す。ホットループ用 */
  raw() { this._unshare(); return this.data; }
}

/* ============================================================
   AttribSet : 1 階層ぶんの属性辞書
   ============================================================ */

class AttribSet {
  constructor(owner, count) {
    this.owner = owner;
    this.count = count;
    this.map = new Map();
  }

  add(name, type, count) {
    if (this.map.has(name)) {
      const ex = this.map.get(name);
      if (ex.type !== type)
        throw new Error(`attribute "${name}" on ${this.owner} already exists as ${ex.type}, requested ${type}`);
      return ex;
    }
    let cap = count ?? this.count;
    for (const v of this.map.values()) cap = Math.max(cap, v.capacity);
    const a = new Attribute(name, type, cap);
    this.map.set(name, a);
    return a;
  }

  get(name) { return this.map.get(name) || null; }
  has(name) { return this.map.has(name); }
  remove(name) { return this.map.delete(name); }
  names() { return [...this.map.keys()]; }

  reserve(n) { for (const a of this.map.values()) a.reserve(n); }

  setCount(n) {
    if (n === this.count) return;
    if (n > this.count) for (const a of this.map.values()) a.reserve(n);
    this.count = n;
  }

  shareClone() {
    const s = new AttribSet(this.owner, this.count);
    for (const [k, v] of this.map) s.map.set(k, v.shareClone());
    return s;
  }
}

/* ============================================================
   GeoSet
   トポロジ (CSR):
     primStart : Int32Array(primCount + 1)   各プリミティブの vertex 開始位置
     vertPoint : Int32Array(vertCount)       vertex -> point 参照
   ============================================================ */

class GeoSet {
  constructor() {
    this.point  = new AttribSet('point', 0);
    this.vertex = new AttribSet('vertex', 0);
    this.prim   = new AttribSet('prim', 0);
    this.detail = new AttribSet('detail', 1);

    this.primStart = new Int32Array([0]);
    this.vertPoint = new Int32Array(0);
    this._topoShared = false;

    this.groups = { point: new Map(), vertex: new Map(), prim: new Map() };

    // P は常に存在する
    this.point.add('P', 'vec3', 0);
  }

  get numPoints() { return this.point.count; }
  get numVerts()  { return this.vertex.count; }
  get numPrims()  { return this.prim.count; }

  /* ---------- 生成 ---------- */

  addPoint(x = 0, y = 0, z = 0) {
    const i = this.point.count;
    this.point.setCount(i + 1);
    this.point.get('P').set(i, [x, y, z]);
    return i;
  }

  /** トポロジ配列の COW 解除 */
  _unshareTopo() {
    if (!this._topoShared) return;
    this.primStart = this.primStart.slice();
    this.vertPoint = this.vertPoint.slice();
    this._topoShared = false;
  }

  static _growI32(arr, need) {
    if (arr.length >= need) return arr;
    const next = new Int32Array(Math.max(need, arr.length * 2, 8));
    next.set(arr);
    return next;
  }

  /** 事前に容量を確保する。大量生成時は必ず呼ぶこと */
  reserve(nPoints = 0, nVerts = 0, nPrims = 0) {
    if (nPoints) this.point.reserve(nPoints);
    if (nVerts) { this.vertex.reserve(nVerts); this._unshareTopo(); this.vertPoint = GeoSet._growI32(this.vertPoint, nVerts); }
    if (nPrims) { this.prim.reserve(nPrims); this._unshareTopo(); this.primStart = GeoSet._growI32(this.primStart, nPrims + 1); }
    return this;
  }

  /** ptIndices: point インデックスの配列。戻り値は prim インデックス */
  addPrim(ptIndices, closed = true) {
    const pi = this.prim.count;
    const v0 = this.vertex.count;
    const n = ptIndices.length;

    this._unshareTopo();
    this.vertex.setCount(v0 + n);
    this.vertPoint = GeoSet._growI32(this.vertPoint, v0 + n);
    for (let k = 0; k < n; k++) this.vertPoint[v0 + k] = ptIndices[k];

    this.primStart = GeoSet._growI32(this.primStart, pi + 2);
    this.primStart[pi + 1] = v0 + n;

    this.prim.setCount(pi + 1);
    this.prim.add('closed', 'int').set(pi, closed ? 1 : 0);
    return pi;
  }

  /* ---------- トポロジ照会 ---------- */

  primVerts(pi) {
    const a = this.primStart[pi], b = this.primStart[pi + 1];
    const out = new Array(b - a);
    for (let k = a; k < b; k++) out[k - a] = k;
    return out;
  }

  primPoints(pi) {
    const a = this.primStart[pi], b = this.primStart[pi + 1];
    const out = new Array(b - a);
    for (let k = a; k < b; k++) out[k - a] = this.vertPoint[k];
    return out;
  }

  vertexPrim(vi) {
    // 二分探索
    let lo = 0, hi = this.prim.count - 1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (vi < this.primStart[m]) hi = m - 1;
      else if (vi >= this.primStart[m + 1]) lo = m + 1;
      else return m;
    }
    return -1;
  }

  /* ---------- 属性ショートカット ---------- */

  attrib(owner, name) { return this[owner].get(name); }

  addAttrib(owner, name, type) { return this[owner].add(name, type); }

  getP(i) { return this.point.get('P').get(i); }
  setP(i, v) { this.point.get('P').set(i, v); }

  /* ---------- グループ ---------- */

  addGroup(owner, name) {
    const g = this.groups[owner];
    if (!g.has(name)) g.set(name, new Set());
    return g.get(name);
  }
  group(owner, name) { return this.groups[owner].get(name) || null; }

  /* ---------- 属性の階層間移動 ---------- */

  /**
   * point 属性 -> prim 属性 へ集約。
   * mode: 'mean' | 'min' | 'max' | 'sum' | 'first'
   */
  promotePointToPrim(name, mode = 'mean', outName = name) {
    const src = this.point.get(name);
    if (!src) throw new Error(`no point attribute: ${name}`);
    const dst = this.prim.add(outName, src.type);
    dst._unshare();
    for (let pi = 0; pi < this.prim.count; pi++) {
      const pts = this.primPoints(pi);
      if (!pts.length) continue;
      if (src.size === 1) {
        let acc = src.get(pts[0]);
        for (let k = 1; k < pts.length; k++) {
          const v = src.get(pts[k]);
          if (mode === 'mean' || mode === 'sum') acc += v;
          else if (mode === 'min') acc = Math.min(acc, v);
          else if (mode === 'max') acc = Math.max(acc, v);
        }
        if (mode === 'mean') acc /= pts.length;
        dst.set(pi, acc);
      } else {
        const acc = src.get(pts[0]).slice();
        for (let k = 1; k < pts.length; k++) {
          const v = src.get(pts[k]);
          for (let c = 0; c < src.size; c++) {
            if (mode === 'mean' || mode === 'sum') acc[c] += v[c];
            else if (mode === 'min') acc[c] = Math.min(acc[c], v[c]);
            else if (mode === 'max') acc[c] = Math.max(acc[c], v[c]);
          }
        }
        if (mode === 'mean') for (let c = 0; c < src.size; c++) acc[c] /= pts.length;
        dst.set(pi, acc);
      }
    }
    return dst;
  }

  /** prim 属性 -> point 属性 へ配布（同一 point に複数 prim が来た場合は最後が勝つ） */
  promotePrimToPoint(name, outName = name) {
    const src = this.prim.get(name);
    if (!src) throw new Error(`no prim attribute: ${name}`);
    const dst = this.point.add(outName, src.type);
    if (src.type === 'string') dst.strings = (src.strings || ['']).slice();
    for (let pi = 0; pi < this.prim.count; pi++) {
      const v = src.get(pi);
      for (const p of this.primPoints(pi)) dst.set(p, v);
    }
    return dst;
  }

  /* ---------- 複製 / 結合 ---------- */

  /** COW クローン。実バッファは共有し、書き込み時にのみ複製される */
  clone() {
    const g = Object.create(GeoSet.prototype);
    g.point  = this.point.shareClone();
    g.vertex = this.vertex.shareClone();
    g.prim   = this.prim.shareClone();
    g.detail = this.detail.shareClone();
    g.primStart = this.primStart;
    g.vertPoint = this.vertPoint;
    g._topoShared = true;
    this._topoShared = true;
    g.groups = { point: new Map(), vertex: new Map(), prim: new Map() };
    for (const o of ['point', 'vertex', 'prim'])
      for (const [k, v] of this.groups[o]) g.groups[o].set(k, new Set(v));
    return g;
  }

  /** other を自身へマージ（Merge SOP 相当） */
  merge(other) {
    const pOff = this.point.count;
    const vOff = this.vertex.count;
    const primOff = this.prim.count;

    for (const o of ['point', 'vertex', 'prim']) {
      const srcSet = other[o], dstSet = this[o];
      const base = dstSet.count;
      dstSet.setCount(base + srcSet.count);
      for (const [name, sa] of srcSet.map) {
        const da = dstSet.add(name, sa.type);
        da._unshare();
        for (let i = 0; i < srcSet.count; i++) da.set(base + i, sa.get(i));
      }
    }
    for (const [name, sa] of other.detail.map) {
      if (!this.detail.has(name)) {
        const da = this.detail.add(name, sa.type);
        da.set(0, sa.get(0));
      }
    }

    const vp = new Int32Array(vOff + other.vertex.count);
    vp.set(this.vertPoint.subarray(0, vOff));
    for (let k = 0; k < other.vertex.count; k++) vp[vOff + k] = other.vertPoint[k] + pOff;
    this.vertPoint = vp;

    const ps = new Int32Array(primOff + other.prim.count + 1);
    ps.set(this.primStart.subarray(0, primOff + 1));
    for (let k = 1; k <= other.prim.count; k++) ps[primOff + k] = other.primStart[k] + vOff;
    this.primStart = ps;
    this._topoShared = false;

    for (const o of ['point', 'vertex', 'prim']) {
      const off = o === 'point' ? pOff : o === 'vertex' ? vOff : primOff;
      for (const [name, set] of other.groups[o]) {
        const g = this.addGroup(o, name);
        for (const i of set) g.add(i + off);
      }
    }
    return this;
  }

  /* ---------- 診断（AI フィードバック用） ---------- */

  stats() {
    return {
      points: this.point.count,
      verts: this.vertex.count,
      prims: this.prim.count,
      attribs: {
        point: this.point.names(),
        vertex: this.vertex.names(),
        prim: this.prim.names(),
        detail: this.detail.names(),
      },
      groups: {
        point: [...this.groups.point.keys()],
        vertex: [...this.groups.vertex.keys()],
        prim: [...this.groups.prim.keys()],
      },
      bounds: this.bounds(),
    };
  }

  bounds() {
    const n = this.point.count;
    if (!n) return null;
    const P = this.point.get('P').data;
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < n; i++)
      for (let c = 0; c < 3; c++) {
        const v = P[i * 3 + c];
        if (v < min[c]) min[c] = v;
        if (v > max[c]) max[c] = v;
      }
    return { min, max };
  }
}

/* ---------- 空ジオメトリ（cook 失敗時の戻り値） ---------- */
const EMPTY = new GeoSet();
Object.freeze(EMPTY);

module.exports = { GeoSet, Attribute, AttribSet, TYPES, OWNERS, EMPTY };
