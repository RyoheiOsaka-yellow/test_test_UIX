import { glyphs, slotColors } from './glyphs.js';

/**
 * The slot bar. Six slots, each showing its key, its glyph, and a shutter that
 * wipes down as its own cooldown runs — cooldowns are per ability, so the bar
 * is six independent timers rather than one global lockout.
 */
export class HUD {
  constructor(manager, settings) {
    this.manager = manager;
    this.settings = settings;

    this.root = document.getElementById('hud');
    this.bar = document.getElementById('hud-slots');
    this.help = document.getElementById('help');
    this.flash = document.getElementById('flash');

    this.slots = new Map();

    for (const key of manager.order) {
      const s = settings.abilities[key];
      const el = document.createElement('div');
      el.className = 'slot';
      el.style.setProperty('--accent', slotColors[key]);
      el.innerHTML = `
        <span class="slot__key">${s.key}</span>
        ${glyphs[key](slotColors[key])}
        <span class="slot__name">${s.label}</span>
        <span class="slot__cd"></span>
      `;
      el.addEventListener('click', () => manager.arm(key));
      this.bar.appendChild(el);
      this.slots.set(key, { el, cd: el.querySelector('.slot__cd') });
    }

    this.root.hidden = false;
    this.help.hidden = false;

    this._flashTimer = 0;
    this._flashPeak = 0;
  }

  /** Fire the screen flash. `color` is a CSS colour string. */
  punch(amount, color = '#ffffff') {
    if (amount <= 0) return;
    this._flashPeak = Math.min(0.85, this._flashPeak + amount);
    this._flashTimer = 0.34;
    this.flash.style.background =
      `radial-gradient(ellipse at 50% 55%, ${color} 0%, transparent 72%)`;
  }

  toggleHelp() {
    this.help.hidden = !this.help.hidden;
  }

  update(dt) {
    const m = this.manager;
    for (const key of m.order) {
      const slot = this.slots.get(key);
      const s = this.settings.abilities[key];
      const remaining = m.cooldowns[key] ?? 0;
      const t = s.cooldown > 0 ? remaining / s.cooldown : 0;
      slot.cd.style.transform = `scaleY(${t})`;
      slot.el.classList.toggle('slot--armed', m.armedKey === key);
      slot.el.style.borderColor =
        m.armedKey === key ? slotColors[key] : 'var(--edge)';
    }

    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      const t = Math.max(this._flashTimer, 0) / 0.34;
      this.flash.style.opacity = String(this._flashPeak * t * t);
      if (this._flashTimer <= 0) this._flashPeak = 0;
    } else if (this.flash.style.opacity !== '0') {
      this.flash.style.opacity = '0';
    }
  }
}
