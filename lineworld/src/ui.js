// DOM overlay: subtitles, prompts, the dig meter, the title card.

import { STRINGS } from './story.js';

const $ = (s) => document.querySelector(s);

const CONTROLS = [
  ['W A S D', 'ctl_move'],
  ['SHIFT', 'ctl_run'],
  ['SPACE', 'ctl_jump'],
  ['Q', 'ctl_sniff'],
  ['E', 'ctl_dig'],
  ['F', 'ctl_bark'],
  ['MOUSE', 'ctl_cam'],
];

export class UI {
  constructor() {
    this.lang = (navigator.language || 'en').startsWith('ja') ? 'ja' : 'en';
    this.el = {
      objective: $('#objective'),
      dots: $('#dots'),
      subtitle: $('#subtitle'),
      prompt: $('#prompt'),
      meter: $('#meter'),
      meterFill: $('#meter i'),
      title: $('#title'),
      fade: $('#fade'),
      lang: $('#lang'),
      start: $('#start'),
      controls: $('#controls'),
      credit: $('#credit'),
      tagline: $('[data-i18n="tagline"]'),
      touch: $('#touch'),
    };
    this._subtitle = null;
    this._prompt = null;
    this._objective = null;
    this._subtimer = 0;

    this.el.lang.addEventListener('click', () => {
      this.setLang(this.lang === 'ja' ? 'en' : 'ja');
    });

    this._grain();
    this.setLang(this.lang);
  }

  t(key) {
    if (!key) return '';
    const s = typeof key === 'string' ? STRINGS[key] : key;
    if (!s) return String(key);
    return s[this.lang] || s.en;
  }

  setLang(lang) {
    this.lang = lang;
    this.el.lang.textContent = lang === 'ja' ? 'ENGLISH' : '日本語';
    this.el.tagline.innerHTML = this.t('tagline');
    this.el.credit.innerHTML = this.t('credit');
    this.el.controls.innerHTML = CONTROLS
      .map(([k, key]) => `<b>${k}</b><span>${this.t(key)}</span>`)
      .join('');
    if (this._subtitle) this.el.subtitle.innerHTML = this.t(this._subtitle);
    if (this._objective) this.el.objective.textContent = this.t(this._objective);
    if (this._prompt) this.el.prompt.innerHTML = this._chips(this.t(this._prompt));
  }

  _chips(text) {
    return text.replace(/\[([^\]]+)\]/g, '<span class="key">$1</span>');
  }

  /** Generated noise tile -- the grain is code too. */
  _grain() {
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d');
    const img = g.createImageData(96, 96);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 26;
    }
    g.putImageData(img, 0, 0);
    $('#grain').style.backgroundImage = `url(${c.toDataURL()})`;
  }

  say(key, seconds = 5) {
    this._subtitle = key;
    this.el.subtitle.innerHTML = this.t(key);
    this.el.subtitle.classList.add('on');
    this._subtimer = seconds;
  }

  clearSay() {
    this.el.subtitle.classList.remove('on');
    this._subtitle = null;
    this._subtimer = 0;
  }

  prompt(key) {
    if (key === this._prompt) return;
    this._prompt = key;
    if (!key) { this.el.prompt.classList.remove('on'); return; }
    this.el.prompt.innerHTML = this._chips(this.t(key));
    this.el.prompt.classList.add('on');
  }

  objective(key) {
    this._objective = key;
    if (!key) { this.el.objective.classList.remove('on'); return; }
    this.el.objective.textContent = this.t(key);
    this.el.objective.classList.add('on');
  }

  meter(value) {
    if (value == null) { this.el.meter.classList.remove('on'); return; }
    this.el.meter.classList.add('on');
    this.el.meterFill.style.width = `${Math.round(value * 100)}%`;
  }

  buildDots(n) {
    this.el.dots.innerHTML = Array.from({ length: n }, () => '<div class="d"></div>').join('');
  }

  setDot(i) {
    const d = this.el.dots.children[i];
    if (d) d.classList.add('on');
  }

  fade(opacity, ms = 1600) {
    this.el.fade.style.transition = `opacity ${ms}ms ease`;
    this.el.fade.style.opacity = String(opacity);
  }

  hideTitle() {
    this.el.title.classList.add('gone');
    setTimeout(() => { this.el.title.style.display = 'none'; }, 1500);
  }

  showTouch() { this.el.touch.classList.add('on'); }

  update(dt) {
    if (this._subtimer > 0) {
      this._subtimer -= dt;
      if (this._subtimer <= 0) this.clearSay();
    }
  }
}
