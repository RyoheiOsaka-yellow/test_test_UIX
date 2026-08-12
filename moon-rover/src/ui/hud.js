/* ============================================================
   HUD — instruments, minimap, codex, systems

   Every canvas in here is redrawn from the same state object the game
   loop already has. Nothing in this file reads the simulation directly
   and nothing in the simulation knows this file exists.
   ============================================================ */

import { CODEX, SAMPLES } from '../game/lore.js';
import { clamp, wrapPi, DEG } from '../core/math.js';
import { RADAR_RANGE } from '../game/gameplay.js';

const $ = (id) => document.getElementById(id);

const OPTIONS = {
  quality: { label: 'QUALITY', values: ['low', 'medium', 'high', 'ultra'], show: (v) => v.toUpperCase() },
  bloom: { label: 'BLOOM', values: [0, 0.6, 1, 1.6], show: (v) => ['OFF', 'LOW', 'NORMAL', 'HIGH'][[0, 0.6, 1, 1.6].indexOf(v)] },
  grain: { label: 'SENSOR NOISE', values: [0, 0.5, 1], show: (v) => ['OFF', 'LOW', 'NORMAL'][[0, 0.5, 1].indexOf(v)] },
  hudScale: { label: 'HUD SIZE', values: [0.8, 0.9, 1, 1.15, 1.3], show: (v) => `${Math.round(v * 100)}%` },
  hudShow: { label: 'INSTRUMENTS', values: [true, false], show: (v) => (v ? 'SHOWN' : 'HIDDEN') },
  units: { label: 'UNITS', values: ['metric', 'imperial'], show: (v) => v.toUpperCase() },
  autoCentre: { label: 'AUTO-CENTRE', values: [true, false], show: (v) => (v ? 'ON' : 'OFF') },
  fov: { label: 'FIELD OF VIEW', values: [50, 58, 66, 74], show: (v) => `${v}°` },
  invertY: { label: 'INVERT LOOK', values: [false, true], show: (v) => (v ? 'ON' : 'OFF') },
  master: { label: 'MASTER', values: [0, 0.25, 0.5, 0.75, 1], show: (v) => `${Math.round(v * 100)}%` },
  motor: { label: 'STRUCTURE-BORNE', values: [0, 0.35, 0.7, 0.9, 1.2], show: (v) => `${Math.round(v * 83)}%` },
  radio: { label: 'RADIO', values: [0, 0.4, 0.8, 1.1], show: (v) => `${Math.round(v * 90)}%` }
};

const CONTROLS = [
  ['W S', 'Throttle / reverse'], ['A D', 'Steer, and pivot when stopped'],
  ['Space', 'Brake'], ['X', 'Right the chassis'],
  ['G', 'Ground-penetrating radar'], ['R', 'Deploy / stow the arm'],
  ['LMB', 'Drill at the aim point'], ['B', 'Deploy relay beacon'],
  ['T', 'Solar array'], ['E', 'Interact (hold)'], ['F', 'Headlights'],
  ['C', 'Cycle camera'], ['P', 'Photo mode'], ['Tab', 'Field codex'],
  ['Esc', 'Pause / systems'], ['H', 'Toggle HUD'],
  ['Mouse', 'Look · wheel zooms']
];

export class Hud {
  constructor(settings, callbacks) {
    this.s = settings;
    this.cb = callbacks;
    this.el = {
      hud: $('hud'), objTitle: $('objTitle'), objDetail: $('objDetail'), objFill: $('objFill'),
      misClock: $('misClock'), misSol: $('misSol'), misOdo: $('misOdo'),
      scopeRead: $('scopeRead'), bayGrid: $('bayGrid'), chips: $('chips'),
      gPower: $('gPower'), tPower: $('tPower'), gHull: $('gHull'), tHull: $('tHull'),
      gTherm: $('gTherm'), tTherm: $('tTherm'),
      toasts: $('toasts'), banner: $('banner'), bannerTag: $('bannerTag'), bannerText: $('bannerText'),
      reticle: $('reticle'), prompt: $('prompt'), promptText: $('promptText'),
      codex: $('codex'), codexList: $('codexList'), codexRead: $('codexRead'),
      systems: $('systems'), sysNote: $('sysNote'), sysControls: $('sysControls'),
      touch: $('touch')
    };
    this.canvas = {
      compass: $('cCompass'), scope: $('cScope'), speed: $('cSpeed'),
      wheels: $('cWheels'), map: $('cMap')
    };
    this.ctx2d = {};
    for (const k in this.canvas) this.ctx2d[k] = this.canvas[k].getContext('2d');

    this.codexOpen = false;
    this.systemsOpen = false;
    this.visible = true;
    this.codexSel = CODEX[0].id;
    this._toasts = [];
    this._bannerT = 0;
    this._mapDirty = true;
    this._trail = [];

    this._buildBay();
    this._buildControlSheet();
    this._bindOptions();
    this.applyScale();
    window.addEventListener('resize', () => { this._resizeCanvases(); this.applyScale(); });
    this._resizeCanvases();
  }

  /* ---------- layout ---------- */

  applyScale() {
    this.el.hud.style.setProperty('--hud-k', String(this.s.hudScale));
  }

  _resizeCanvases() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const k in this.canvas) {
      const c = this.canvas[k];
      const r = c.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      c._dpr = dpr;
    }
    this._mapDirty = true;
  }

  show(on) {
    this.visible = on;
    this.el.hud.classList.toggle('hidden', !on || !this.s.hudShow);
  }

  /* ---------- touch ---------- */

  mountTouch(input) {
    const coarse = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    if (!coarse) return false;
    this.el.touch.classList.remove('hidden');
    // The HUD moves above the sticks, keyed on this class rather than a
    // media query: what matters is whether there are thumbsticks on the
    // screen right now, and those two can disagree.
    this.el.hud.classList.add('sticks-on');
    input.hasTouchControls = true;

    const bind = (el, which) => {
      const knob = el.querySelector('i');
      let id = null, cx = 0, cy = 0, R = 1;
      const set = (x, y) => {
        let dx = (x - cx) / R, dy = (y - cy) / R;
        const m = Math.hypot(dx, dy);
        if (m > 1) { dx /= m; dy /= m; }
        knob.style.transform = `translate(${dx * R * 0.62}px, ${dy * R * 0.62}px)`;
        input.setStick(which, dx, -dy, true);
      };
      el.addEventListener('pointerdown', (e) => {
        const r = el.getBoundingClientRect();
        cx = r.left + r.width / 2; cy = r.top + r.height / 2; R = r.width / 2;
        id = e.pointerId; el.setPointerCapture(id);
        set(e.clientX, e.clientY); e.preventDefault();
      });
      el.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e.clientX, e.clientY); });
      const up = (e) => {
        if (e.pointerId !== id) return;
        id = null;
        knob.style.transform = '';
        input.setStick(which, 0, 0, false);
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    };
    bind($('stickL'), 'left');
    bind($('stickR'), 'right');

    const groups = [
      [$('tbtnsL'), [['GPR', 'radar'], ['ARM', 'arm'], ['DRILL', 'drill'], ['E', 'interact'], ['BRAKE', 'brake']]],
      [$('tbtnsR'), [['CAM', 'camera'], ['LAMP', 'lamp'], ['BEACON', 'beacon'], ['CODEX', 'codex'], ['HUD', 'hud']]]
    ];
    for (const [host, list] of groups) {
      for (const [label, action] of list) {
        const b = document.createElement('div');
        b.className = 'tbtn';
        b.textContent = label;
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault(); b.classList.add('active');
          if (action === 'drill') this.cb.drill(true);
          else input.setTouchButton(action, true);
        });
        const up = () => {
          b.classList.remove('active');
          if (action === 'drill') this.cb.drill(false);
          else input.setTouchButton(action, false);
        };
        b.addEventListener('pointerup', up);
        b.addEventListener('pointercancel', up);
        b.addEventListener('pointerleave', up);
        host.appendChild(b);
      }
    }
    return true;
  }

  /* ---------- static panels ---------- */

  _buildBay() {
    this.el.bayGrid.innerHTML = '';
    this.bayCells = SAMPLES.map((s) => {
      const d = document.createElement('div');
      d.className = 'bay-cell';
      d.textContent = s.tag;
      d.title = `${s.name} — ${s.hint}`;
      this.el.bayGrid.appendChild(d);
      return d;
    });
  }

  _buildControlSheet() {
    this.el.sysControls.innerHTML = CONTROLS
      .map(([k, v]) => `<div><kbd>${k}</kbd><span>${v}</span></div>`).join('');
  }

  _bindOptions() {
    document.querySelectorAll('.opt').forEach((el) => {
      const key = el.dataset.opt;
      el.addEventListener('click', () => {
        if (key === 'resume') { this.toggleSystems(false); return; }
        if (key === 'save') { this.cb.save(); this.el.sysNote.textContent = 'Progress written to local storage.'; return; }
        if (key === 'restart') { this.cb.restart(); return; }
        if (key === 'pixels') return;
        const o = OPTIONS[key];
        if (!o) return;
        const i = o.values.indexOf(this.s[key]);
        this.s[key] = o.values[(i + 1) % o.values.length];
        this.cb.settingChanged(key, this.s[key]);
        this.refreshOptions();
      });
    });
    document.querySelectorAll('[data-close]').forEach((b) => {
      b.addEventListener('click', () => {
        const t = b.dataset.close;
        if (t === 'codex') this.toggleCodex(false); else this.toggleSystems(false);
      });
    });
    this.refreshOptions();
  }

  refreshOptions() {
    document.querySelectorAll('.opt').forEach((el) => {
      const key = el.dataset.opt;
      const b = el.querySelector('b');
      if (key === 'pixels') { b.textContent = this.cb.pixelInfo(); return; }
      const o = OPTIONS[key];
      if (o) b.textContent = o.show(this.s[key]);
    });
    this.applyScale();
    this.el.hud.classList.toggle('hidden', !this.visible || !this.s.hudShow);
  }

  /* ---------- overlays ---------- */

  toggleCodex(on = !this.codexOpen) {
    this.codexOpen = on;
    this.el.codex.classList.toggle('hidden', !on);
    if (on) { this.systemsOpen = false; this.el.systems.classList.add('hidden'); this.renderCodex(); }
    this.cb.overlayChanged(this.codexOpen || this.systemsOpen);
  }

  toggleSystems(on = !this.systemsOpen) {
    this.systemsOpen = on;
    this.el.systems.classList.toggle('hidden', !on);
    if (on) {
      this.codexOpen = false;
      this.el.codex.classList.add('hidden');
      this.refreshOptions();
      this.el.sysNote.textContent = '';
    }
    this.cb.overlayChanged(this.codexOpen || this.systemsOpen);
  }

  get anyOverlay() { return this.codexOpen || this.systemsOpen; }

  renderCodex(unlocked = this._unlocked || new Set(), fresh = this._fresh || new Set()) {
    this._unlocked = unlocked; this._fresh = fresh;
    this.el.codexList.innerHTML = '';
    for (const e of CODEX) {
      const has = unlocked.has(e.id);
      const d = document.createElement('div');
      d.className = `codex-item${has ? '' : ' locked'}${e.id === this.codexSel ? ' active' : ''}`;
      d.innerHTML = `<div class="tag">${has ? e.tag : 'SEALED'}${fresh.has(e.id) ? ' ·' : ''}</div>
        <div class="ttl">${has ? e.title : '—'}</div>`;
      if (has) {
        d.addEventListener('click', () => {
          this.codexSel = e.id;
          fresh.delete(e.id);
          this.renderCodex(unlocked, fresh);
        });
      }
      this.el.codexList.appendChild(d);
    }
    const sel = CODEX.find((c) => c.id === this.codexSel);
    if (!sel || !unlocked.has(this.codexSel)) {
      const first = CODEX.find((c) => unlocked.has(c.id));
      if (first) { this.codexSel = first.id; return this.renderCodex(unlocked, fresh); }
      this.el.codexRead.innerHTML = '<div class="codex-empty">NOTHING ON FILE.</div>';
      return;
    }
    this.el.codexRead.innerHTML =
      `<h3>${sel.title}</h3><div class="meta">${sel.meta}</div>` +
      sel.body.map((p) => `<p>${p}</p>`).join('');
  }

  /* ---------- transient ---------- */

  toast(text, tone = '') {
    const d = document.createElement('div');
    d.className = `toast ${tone}`;
    d.textContent = text;
    this.el.toasts.appendChild(d);
    this._toasts.push({ el: d, t: 3.6 });
    while (this._toasts.length > 4) {
      const old = this._toasts.shift();
      old.el.remove();
    }
  }

  banner(text, tag = 'DISCOVERY') {
    this.el.bannerTag.textContent = tag;
    this.el.bannerText.textContent = text;
    this.el.banner.classList.remove('hidden');
    // Restart the animation, which otherwise only plays the first time.
    this.el.banner.style.animation = 'none';
    void this.el.banner.offsetWidth;
    this.el.banner.style.animation = '';
    this._bannerT = 4.2;
  }

  /* ---------- per-frame ---------- */

  update(dt, st) {
    for (let i = this._toasts.length - 1; i >= 0; i--) {
      const t = this._toasts[i];
      t.t -= dt;
      if (t.t <= 0) { t.el.remove(); this._toasts.splice(i, 1); }
      else if (t.t < 0.6) t.el.style.opacity = String(t.t / 0.6);
    }
    if (this._bannerT > 0) {
      this._bannerT -= dt;
      if (this._bannerT <= 0) this.el.banner.classList.add('hidden');
    }
    if (!this.visible || !this.s.hudShow) return;

    /* objective */
    const m = st.mission;
    this.el.objTitle.textContent = m ? m.title : 'TRAVERSE COMPLETE';
    this.el.objDetail.textContent = m ? m.detail : 'The link is up. Everything is on its way home.';
    this.el.objFill.style.width = `${(st.missionProgress * 100).toFixed(0)}%`;

    /* clock */
    const T = st.missionTime;
    const hh = String(Math.floor(T / 3600)).padStart(2, '0');
    const mm = String(Math.floor(T / 60) % 60).padStart(2, '0');
    const ss = String(Math.floor(T) % 60).padStart(2, '0');
    this.el.misClock.textContent = `${hh}:${mm}:${ss}`;
    this.el.misSol.textContent = `SOL ${st.sol}`;
    this.el.misOdo.textContent = this.s.units === 'imperial'
      ? `${(st.odometer * 0.000621371).toFixed(2)} mi`
      : `${(st.odometer / 1000).toFixed(2)} km`;

    /* gauges */
    const setBar = (bar, txt, frac, label, warn) => {
      bar.style.width = `${clamp(frac, 0, 1) * 100}%`;
      bar.style.background = frac < warn ? 'var(--red)' : (frac < warn * 2 ? 'var(--amber)' : 'var(--cyan)');
      txt.textContent = label;
    };
    setBar(this.el.gPower, this.el.tPower, st.power, `${Math.round(st.power * 100)}%`, 0.15);
    setBar(this.el.gHull, this.el.tHull, st.integrity, `${Math.round(st.integrity * 100)}%`, 0.25);
    const tf = clamp((st.thermal + 60) / 110, 0, 1);
    this.el.gTherm.style.width = `${tf * 100}%`;
    this.el.gTherm.style.background = st.thermal > 42 ? 'var(--red)' : 'var(--cyan)';
    this.el.tTherm.textContent = `${st.thermal > 0 ? '+' : '−'}${Math.abs(Math.round(st.thermal))}°C`;

    this._chips(st);
    this._bay(st);

    this.el.scopeRead.textContent = st.lastReturn;

    /* prompt and reticle */
    const it = st.interact;
    if (it && it.available) {
      this.el.prompt.classList.remove('hidden');
      this.el.promptText.textContent = it.hold > 0.02
        ? `${it.available.label}  ${'▮'.repeat(Math.round(it.hold * 8)).padEnd(8, '▯')}`
        : it.available.label;
    } else this.el.prompt.classList.add('hidden');
    this.el.reticle.classList.toggle('hidden', !st.armOut);

    this._drawCompass(st);
    this._drawScope(st);
    this._drawSpeed(st);
    this._drawWheels(st);
    this._drawMap(st);
  }

  _chips(st) {
    const chips = [
      ['GPR', st.radarActive, st.power < 0.06],
      ['ARM', st.armOut, false],
      ['ARRAY', st.arrayOut, false],
      ['LAMPS', st.lamps, false],
      [`LINK ${st.relaysOnline}/3`, st.relaysOnline >= 3, st.relaysOnline === 0],
      [st.camMode, true, false]
    ];
    const html = chips.map(([t, on, bad]) =>
      `<div class="chip${bad ? ' bad' : on ? ' on' : ''}">${t}</div>`).join('');
    if (html !== this._chipHtml) { this.el.chips.innerHTML = html; this._chipHtml = html; }
  }

  _bay(st) {
    SAMPLES.forEach((s, i) => {
      const has = st.sampleSet.has(s.id);
      this.bayCells[i].classList.toggle('full', has);
    });
  }

  /* ---------- canvases ---------- */

  _prep(key) {
    const c = this.canvas[key], g = this.ctx2d[key];
    if (!c.width || !c.height) return null;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    const dpr = c._dpr || 1;
    g.scale(dpr, dpr);
    return { g, w: c.width / dpr, h: c.height / dpr };
  }

  _drawCompass(st) {
    const p = this._prep('compass'); if (!p) return;
    const { g, w, h } = p;
    g.font = '9px ui-monospace, monospace';
    g.textAlign = 'center';
    const span = 150 * DEG;
    const heading = st.heading;
    for (let d = -180; d < 180; d += 5) {
      const a = wrapPi(d * DEG - heading);
      if (Math.abs(a) > span / 2) continue;
      const x = w / 2 + (a / (span / 2)) * (w / 2 - 6);
      const major = d % 45 === 0;
      g.strokeStyle = major ? 'rgba(207,214,221,0.85)' : 'rgba(140,168,190,0.35)';
      g.beginPath();
      g.moveTo(x, h - 6);
      g.lineTo(x, h - (major ? 15 : 10));
      g.stroke();
      if (major) {
        const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', '-180': 'S', '-135': 'SW', '-90': 'W', '-45': 'NW' };
        g.fillStyle = 'rgba(207,214,221,0.9)';
        g.fillText(names[d] ?? String(d), x, h - 18);
      }
    }
    // Bearings to things worth steering at.
    for (const b of st.bearings || []) {
      const a = wrapPi(b.bearing - heading);
      if (Math.abs(a) > span / 2) continue;
      const x = w / 2 + (a / (span / 2)) * (w / 2 - 6);
      g.fillStyle = b.color;
      g.beginPath();
      g.moveTo(x, 2); g.lineTo(x - 4, 9); g.lineTo(x + 4, 9);
      g.closePath(); g.fill();
    }
    g.strokeStyle = '#6fe3f5';
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
    g.lineWidth = 1;
  }

  _drawScope(st) {
    const p = this._prep('scope'); if (!p) return;
    const { g, w, h } = p;
    g.fillStyle = 'rgba(6,12,16,0.6)';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(111,227,245,0.14)';
    for (let i = 1; i < 5; i++) {
      const y = (i / 5) * h;
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    }
    // Depth axis 0..8 m, range axis 0..RADAR_RANGE.
    const trace = st.trace, kind = st.traceKind;
    for (let i = 0; i < trace.length; i++) {
      if (!kind[i]) continue;
      const x = (i / trace.length) * w;
      const y = clamp(trace[i] / 8, 0, 1) * h;
      g.fillStyle = kind[i] === 2 ? '#6fe3f5' : (kind[i] === 3 ? '#7ee0a4' : 'rgba(207,214,221,0.6)');
      const bw = Math.max(1.5, w / trace.length);
      if (kind[i] === 2) {
        // The lattice reads as a repeating structure, not a point.
        g.fillRect(x, y - 1, bw, 2);
        g.globalAlpha = 0.35;
        g.fillRect(x, y + 4, bw, 1);
        g.globalAlpha = 1;
      } else {
        g.fillRect(x, y - 1, bw, 2);
      }
    }
    if (st.radarActive) {
      const x = (st.radarR / RADAR_RANGE) * w;
      g.strokeStyle = 'rgba(111,227,245,0.9)';
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
    }
    g.fillStyle = 'rgba(140,168,190,0.55)';
    g.font = '8px ui-monospace, monospace';
    g.textAlign = 'left';
    g.fillText('0', 2, h - 3);
    g.fillText(`${RADAR_RANGE} m`, w - 26, h - 3);
    g.save(); g.translate(4, 12); g.fillText('8 m', 0, 0); g.restore();
  }

  _drawSpeed(st) {
    const p = this._prep('speed'); if (!p) return;
    const { g, w, h } = p;
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 5;
    const maxV = 6;
    const a0 = Math.PI * 0.78, a1 = Math.PI * 2.22;
    g.strokeStyle = 'rgba(140,168,190,0.25)';
    g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, R, a0, a1); g.stroke();
    for (let v = 0; v <= maxV; v++) {
      const a = a0 + (v / maxV) * (a1 - a0);
      const r0 = R - (v % 2 === 0 ? 8 : 4);
      g.strokeStyle = 'rgba(207,214,221,0.7)';
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      g.stroke();
    }
    const frac = clamp(st.speed / maxV, 0, 1);
    g.strokeStyle = '#6fe3f5';
    g.lineWidth = 3;
    g.beginPath(); g.arc(cx, cy, R, a0, a0 + frac * (a1 - a0)); g.stroke();
    const a = a0 + frac * (a1 - a0);
    g.strokeStyle = '#eef4f8'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (R - 10), cy + Math.sin(a) * (R - 10)); g.stroke();
    g.fillStyle = '#eef4f8';
    g.textAlign = 'center';
    g.font = `600 ${Math.round(R * 0.42)}px ui-monospace, monospace`;
    const disp = this.s.units === 'imperial' ? st.speed * 2.23694 : st.speed;
    g.fillText(disp.toFixed(1), cx, cy + R * 0.10);
    g.font = '8px ui-monospace, monospace';
    g.fillStyle = 'rgba(140,168,190,0.8)';
    g.fillText(this.s.units === 'imperial' ? 'MPH' : 'M/S', cx, cy + R * 0.42);
    g.lineWidth = 1;
  }

  _drawWheels(st) {
    const p = this._prep('wheels'); if (!p) return;
    const { g, w, h } = p;
    const cols = 2, rows = 3;
    const cw = w / cols, ch = h / rows;
    st.wheels.forEach((wh, i) => {
      const c = i % 2, r = (i / 2) | 0;
      const x = c * cw + 4, y = r * ch + 3;
      const bw = cw - 12, bh = ch - 8;
      g.strokeStyle = wh.contact ? 'rgba(111,227,245,0.45)' : 'rgba(255,106,94,0.5)';
      g.strokeRect(x, y, bw, bh);
      // Load fills from the bottom; slip paints the bar amber then red.
      const load = clamp(wh.load / 700, 0, 1);
      const slip = clamp(wh.slip / 2.5, 0, 1);
      g.fillStyle = slip > 0.6 ? 'rgba(255,106,94,0.75)'
        : slip > 0.25 ? 'rgba(245,182,74,0.75)' : 'rgba(111,227,245,0.55)';
      g.fillRect(x + 1, y + bh - 1 - (bh - 2) * load, bw - 2, (bh - 2) * load);
      // Sinkage tick.
      const sy = y + bh - 1 - (bh - 2) * clamp(wh.sink / 0.10, 0, 1);
      g.strokeStyle = 'rgba(238,244,248,0.85)';
      g.beginPath(); g.moveTo(x + 1, sy); g.lineTo(x + bw - 1, sy); g.stroke();
    });
  }

  _drawMap(st) {
    const p = this._prep('map'); if (!p) return;
    const { g, w, h } = p;
    const R = 4000 / 2;            // 1:4000 across the panel
    const cx = w / 2, cy = h / 2;
    const scale = (w / 2) / 260;   // metres to pixels; the fine field is ±256

    g.fillStyle = 'rgba(6,10,14,0.55)';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(140,168,190,0.20)';
    g.strokeRect(0.5, 0.5, w - 1, h - 1);
    g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, h); g.moveTo(0, cy); g.lineTo(w, cy); g.stroke();

    const rx = st.pos[0], rz = st.pos[2];
    const to = (x, z) => [cx + (x - rx) * scale, cy + (z - rz) * scale];

    // Trail: where you have actually been.
    if (!this._trail.length || Math.hypot(rx - this._trail[this._trail.length - 1][0],
      rz - this._trail[this._trail.length - 1][1]) > 4) {
      this._trail.push([rx, rz]);
      if (this._trail.length > 900) this._trail.shift();
    }
    g.strokeStyle = 'rgba(111,227,245,0.35)';
    g.beginPath();
    this._trail.forEach((t, i) => {
      const [x, y] = to(t[0], t[1]);
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    });
    g.stroke();

    const mark = (x, z, color, label, filled) => {
      const [px, py] = to(x, z);
      if (px < -8 || py < -8 || px > w + 8 || py > h + 8) {
        // Clamp off-screen markers to the edge so you still know which way.
        const dx = px - cx, dy = py - cy;
        const m = Math.max(Math.abs(dx) / (w / 2 - 6), Math.abs(dy) / (h / 2 - 6));
        const ex = cx + dx / m, ey = cy + dy / m;
        g.fillStyle = color; g.globalAlpha = 0.55;
        g.beginPath(); g.arc(ex, ey, 2, 0, 7); g.fill();
        g.globalAlpha = 1;
        return;
      }
      g.strokeStyle = color; g.fillStyle = color;
      g.beginPath(); g.arc(px, py, 3.2, 0, 7);
      if (filled) g.fill(); else g.stroke();
      if (label) {
        g.font = '7px ui-monospace, monospace';
        g.textAlign = 'left';
        g.fillText(label, px + 5, py + 2.5);
      }
    };

    mark(st.layout.sled[0], st.layout.sled[1], 'rgba(245,182,74,0.9)', 'SLED', false);
    mark(st.layout.station[0], st.layout.station[1], 'rgba(238,244,248,0.9)', 'B-9', false);
    st.layout.relays.forEach(([x, z], i) => {
      mark(x, z, st.relaysOnline > i ? 'rgba(126,224,164,0.95)' : 'rgba(140,168,190,0.7)', `R${i + 1}`, st.relaysOnline > i);
    });
    for (const b of st.beacons) mark(b.x, b.z, 'rgba(111,227,245,0.8)', '', true);

    // The rover, pointing where it is pointing.
    g.save();
    g.translate(cx, cy);
    g.rotate(-st.heading);
    g.fillStyle = '#eef4f8';
    g.beginPath(); g.moveTo(0, -5); g.lineTo(3.4, 4); g.lineTo(0, 2); g.lineTo(-3.4, 4);
    g.closePath(); g.fill();
    g.restore();
    void R;
  }
}
