// 永続化: サーバ（/api）があれば REST、なければ localStorage。インターフェースは同じ（async）。
import * as WF from './workflow.js';
const LS = 'anglex.v1';
function readLS() { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } }
function writeLS(d) { try { localStorage.setItem(LS, JSON.stringify(d)); } catch (e) { console.warn('localStorage 保存失敗', e); } }

export const DEMO_USERS = [
  { id: 'u_a1', name: '山田（A社 設計）', org: 'A', company: 'A社（設計・見積）', email: 'a@example.com' },
  { id: 'u_b1', name: '鈴木（B社 営業）', org: 'B', company: 'B社（商社・販売）', email: 'b@example.com' },
  { id: 'u_c1', name: '佐藤（C社 工場）', org: 'C', company: 'C社（加工工場）', email: 'c@example.com' },
];
export class LocalStore {
  constructor() { this.mode = 'local'; const d = readLS(); this.d = { projects: d.projects || {}, estimates: d.estimates || {}, users: d.users || DEMO_USERS, session: d.session || null, rates: d.rates || null }; }
  save() { writeLS(this.d); }
  async health() { return { ok: true, mode: 'local' }; }
  async login(email, password) { const u = this.d.users.find(x => x.email === email) || this.d.users[0]; this.d.session = { user: u, token: 'local' }; this.save(); return this.d.session; }
  async logout() { this.d.session = null; this.save(); }
  session() { return this.d.session; }
  async listProjects() { return Object.values(this.d.projects).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')); }
  async saveProject(p) { p.updatedAt = new Date().toISOString(); this.d.projects[p.id] = p; this.save(); return p; }
  async getProject(id) { return this.d.projects[id] || null; }
  async deleteProject(id) { delete this.d.projects[id]; this.save(); }
  async listEstimates(projectId) { return Object.values(this.d.estimates).filter(e => !projectId || e.projectId === projectId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
  async getEstimate(id) { return this.d.estimates[id] || null; }
  async saveEstimate(e) { this.d.estimates[e.id] = e; this.save(); return e; }
  async editEstimate(id, edit) { const e = this.d.estimates[id]; WF.applyEdit(e, edit); this.save(); return e; }
  async handoffEstimate(id, h) { const e = this.d.estimates[id]; const r = WF.handoff(e, h); this.save(); return r; }
  async finalizeEstimate(id, who) { const e = this.d.estimates[id]; WF.finalize(e, who); this.save(); return e; }
  async rejectEstimate(id, who) { const e = this.d.estimates[id]; WF.reject(e, who); this.save(); return e; }
  async byToken(token) { return Object.values(this.d.estimates).find(e => Object.values(e.tokens).includes(token)) || null; }
  async exportAll() { return JSON.parse(JSON.stringify(this.d)); }
  async importAll(d) { this.d = { ...this.d, ...d }; this.save(); }
}
export class RestStore {
  constructor(base = '') { this.base = base; this.mode = 'server'; this.token = localStorage.getItem('anglex.token') || null; this._session = null; }
  async req(method, path, body) { const r = await fetch(this.base + path, { method, headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: 'Bearer ' + this.token } : {}) }, body: body ? JSON.stringify(body) : undefined }); if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || r.statusText); } return r.json(); }
  async health() { return this.req('GET', '/api/health'); }
  async login(email, password) { const s = await this.req('POST', '/api/login', { email, password }); this.token = s.token; localStorage.setItem('anglex.token', s.token); this._session = s; return s; }
  async logout() { this.token = null; localStorage.removeItem('anglex.token'); this._session = null; }
  session() { return this._session; }
  async me() { try { this._session = await this.req('GET', '/api/me'); return this._session; } catch { return null; } }
  async listProjects() { return this.req('GET', '/api/projects'); }
  async saveProject(p) { return this.req('PUT', '/api/projects/' + p.id, p); }
  async getProject(id) { return this.req('GET', '/api/projects/' + id); }
  async deleteProject(id) { return this.req('DELETE', '/api/projects/' + id); }
  async listEstimates(projectId) { return this.req('GET', '/api/estimates' + (projectId ? '?project=' + projectId : '')); }
  async getEstimate(id) { return this.req('GET', '/api/estimates/' + id); }
  async saveEstimate(e) { return this.req('PUT', '/api/estimates/' + e.id, e); }
  async editEstimate(id, edit) { return this.req('POST', `/api/estimates/${id}/edit`, edit); }
  async handoffEstimate(id, h) { return this.req('POST', `/api/estimates/${id}/handoff`, h); }
  async finalizeEstimate(id, who) { return this.req('POST', `/api/estimates/${id}/finalize`, who); }
  async rejectEstimate(id, who) { return this.req('POST', `/api/estimates/${id}/reject`, who); }
  async byToken(token) { return this.req('GET', '/api/handoff/' + token); }
  async exportAll() { return this.req('GET', '/api/export'); }
  async importAll(d) { return this.req('POST', '/api/import', d); }
}
export async function createStore() { try { const r = await fetch('/api/health', { cache: 'no-store' }); if (r.ok) { const j = await r.json(); if (j.ok && j.mode === 'server') { const s = new RestStore(''); await s.me(); return s; } } } catch { } return new LocalStore(); }
