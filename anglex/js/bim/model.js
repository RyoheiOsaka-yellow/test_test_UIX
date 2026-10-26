// BIM モデル: ファミリ → タイプ → インスタンス（Revit 流）。レベル・通り芯・接合・ビュー・集計を保持。Undo/Redo・シリアライズ対応
import { FAMILIES, familyById } from './families.js';
import { resolveParams } from './params.js';

let seq = 0; export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}`;
export class Emitter { constructor() { this.h = {}; } on(e, f) { (this.h[e] ||= []).push(f); return () => this.off(e, f); } off(e, f) { this.h[e] = (this.h[e] || []).filter(x => x !== f); } emit(e, ...a) { for (const f of this.h[e] || []) f(...a); for (const f of this.h['*'] || []) f(e, ...a); } }

export class Model extends Emitter {
  constructor(data) {
    super();
    this.name = 'プロジェクト'; this.units = 'mm';
    this.levels = [{ id: 'L0', name: 'FL（床）', elev: 0 }, { id: 'L1', name: 'サポート天端', elev: 1500 }, { id: 'L2', name: '天井スラブ下', elev: 2800 }];
    this.grids = [{ id: 'X1', axis: 'x', pos: 0, name: 'X1' }, { id: 'Y1', axis: 'z', pos: 0, name: 'Y1' }];
    this.types = []; this.instances = []; this.joints = []; this.refs = []; this.views = []; this.meta = { createdAt: new Date().toISOString() };
    this.undoStack = []; this.redoStack = []; this._silent = false;
    if (data) this.load(data);
  }
  // ---- タイプ ----
  addType(familyId, name, params = {}) { const fam = familyById(familyId); if (!fam) throw new Error('family ' + familyId); const t = { id: uid('T'), familyId, name: name || `${fam.name} ${this.types.filter(x => x.familyId === familyId).length + 1}`, params: { ...params } }; this.types.push(t); this._changed('type:add', t); return t; }
  getType(id) { return this.types.find(t => t.id === id); }
  updateType(id, params) { const t = this.getType(id); if (!t) return; this._snapshot(); Object.assign(t.params, params); this._changed('type:update', t); }
  renameType(id, name) { const t = this.getType(id); if (t) { t.name = name; this._changed('type:update', t); } }
  duplicateType(id) { const t = this.getType(id); if (!t) return; const n = { ...t, id: uid('T'), name: t.name + ' (コピー)', params: { ...t.params } }; this.types.push(n); this._changed('type:add', n); return n; }
  // ---- インスタンス ----
  addInstance(typeId, { pos = [0, 0, 0], rot = [0, 0, 0], params = {}, mark, level = 'L0', name } = {}) {
    const t = this.getType(typeId); if (!t) throw new Error('type ' + typeId); const fam = familyById(t.familyId); this._snapshot();
    const inst = { id: uid('I'), typeId, pos: [...pos], rot: [...rot], params: { ...params }, mark: mark || this.nextMark(fam.markPrefix || 'M'), level, name: name || null, tags: [], status: 'confirmed', visible: true };
    this.instances.push(inst); this._changed('instance:add', inst); return inst;
  }
  getInstance(id) { return this.instances.find(i => i.id === id); }
  updateInstance(id, patch) { const i = this.getInstance(id); if (!i) return; this._snapshot(); if (patch.params) { i.params = { ...i.params, ...patch.params }; delete patch.params; } Object.assign(i, patch); this._changed('instance:update', i); }
  removeInstance(id) { const i = this.getInstance(id); if (!i) return; this._snapshot(); this.instances = this.instances.filter(x => x.id !== id); this.joints = this.joints.filter(j => j.a !== id && j.b !== id); this._changed('instance:remove', i); }
  duplicateInstance(id, offset = [0, 0, 300]) { const i = this.getInstance(id); if (!i) return; return this.addInstance(i.typeId, { pos: i.pos.map((v, k) => v + offset[k]), rot: i.rot, params: i.params, level: i.level }); }
  nextMark(prefix) { let n = 1; const used = new Set(this.instances.map(i => i.mark)); while (used.has(`${prefix}-${n}`)) n++; return `${prefix}-${n}`; }
  // 解決済みパラメータ（タイプ値 + インスタンス上書き + 式）
  resolved(inst) { const t = this.getType(inst.typeId); const fam = familyById(t.familyId); return resolveParams(fam.params, { ...t.params, ...inst.params }); }
  familyOf(inst) { return familyById(this.getType(inst.typeId).familyId); }
  // ---- 接合 ----
  addJoint(j) { this._snapshot(); const jj = { id: uid('J'), status: 'confirmed', ...j }; this.joints.push(jj); this._changed('joint:add', jj); return jj; }
  updateJoint(id, patch) { const j = this.joints.find(x => x.id === id); if (!j) return; this._snapshot(); Object.assign(j, patch); this._changed('joint:update', j); }
  removeJoint(id) { this._snapshot(); this.joints = this.joints.filter(j => j.id !== id); this._changed('joint:remove', id); }
  // ---- レベル・通り芯 ----
  addLevel(name, elev) { const l = { id: uid('L'), name, elev }; this.levels.push(l); this.levels.sort((a, b) => a.elev - b.elev); this._changed('level:add', l); return l; }
  addGrid(axis, pos, name) { const g = { id: uid('G'), axis, pos, name: name || (axis === 'x' ? 'X' : 'Y') + (this.grids.filter(x => x.axis === axis).length + 1) }; this.grids.push(g); this._changed('grid:add', g); return g; }
  // 参照モデル（IFC/glTF 等の読込ジオメトリ）
  addRef(ref) { const r = { id: uid('R'), visible: true, ...ref }; this.refs.push(r); this._changed('ref:add', r); return r; }
  // ---- Undo ----
  _snapshot() { if (this._silent) return; this.undoStack.push(this.serialize()); if (this.undoStack.length > 60) this.undoStack.shift(); this.redoStack = []; }
  undo() { if (!this.undoStack.length) return false; this.redoStack.push(this.serialize()); this._silent = true; this.load(this.undoStack.pop()); this._silent = false; this.emit('reload'); return true; }
  redo() { if (!this.redoStack.length) return false; this.undoStack.push(this.serialize()); this._silent = true; this.load(this.redoStack.pop()); this._silent = false; this.emit('reload'); return true; }
  _changed(e, o) { this.emit(e, o); this.emit('change', e, o); }
  // ---- 永続化 ----
  serialize() { return JSON.parse(JSON.stringify({ name: this.name, levels: this.levels, grids: this.grids, types: this.types, instances: this.instances, joints: this.joints, refs: this.refs.map(r => ({ ...r, object: undefined })), meta: this.meta })); }
  load(d) { this.name = d.name || this.name; this.levels = d.levels || this.levels; this.grids = d.grids || this.grids; this.types = d.types || []; this.instances = d.instances || []; this.joints = d.joints || []; this.refs = d.refs || []; this.meta = d.meta || this.meta; }
  // ---- 集計用: 全インスタンスの部品展開 ----
  explodeParts(buildFn) { const rows = []; for (const inst of this.instances) { const fam = this.familyOf(inst); const p = this.resolved(inst); const parts = fam.parts(p, { inst, model: this }); for (const pt of parts) rows.push({ ...pt, instId: inst.id, mark: inst.mark, typeName: this.getType(inst.typeId).name, family: fam.name }); } return rows; }
}
