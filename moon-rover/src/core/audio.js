/* ============================================================
   AUDIO — synthesised at runtime, no files

   Nothing carries sound out there, so everything you hear is what the
   chassis carries: structure-borne, and dull. The only bright things
   in the mix are electrical — the radio, the GPR chirp, the alarms.

   The motor is one band-limited pulse train, a commutating hub, fed
   through a bank of FIXED resonators standing in for the frame. That
   split is what makes it read as a machine rather than a siren: the
   excitation pitch rides the wheel speed while the body formants stay
   exactly where they are, and load opens the upper ones.
   ============================================================ */

const FORMANTS = [172, 418, 905];

export class Audio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.settings = { master: 0.75, motor: 0.9, radio: 0.8 };
    this._grainT = 0;
    this._nextGrain = 0;
  }

  /* Browsers will not start an AudioContext without a gesture, and
     trying anyway leaves a suspended context that never recovers. */
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();

    this.master = ctx.createGain();
    this.master.gain.value = this.settings.master;
    this.master.connect(ctx.destination);

    // A gentle limiter so a rollover plus an alarm plus the drill does
    // not clip the bus.
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.ratio.value = 6;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.18;
    this.comp.connect(this.master);

    this.motorBus = ctx.createGain();
    this.motorBus.gain.value = 0;
    this.motorBus.connect(this.comp);

    this.radioBus = ctx.createGain();
    this.radioBus.gain.value = this.settings.radio;
    this.radioBus.connect(this.comp);

    this._buildNoise();
    this._buildMotor();
    this.ready = true;
  }

  _buildNoise() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      // Slightly pink: white noise reads as hiss, and regolith is not hiss.
      last = (last * 0.86 + w * 0.14);
      d[i] = last * 3.2;
    }
    this.noiseBuf = buf;
  }

  _buildMotor() {
    const ctx = this.ctx;

    /* A commutating hub is a pulse train, not a sine. Build one band
       limited by construction: a periodic wave with a fixed number of
       harmonics, so it never aliases however fast the wheel turns. */
    const N = 24;
    const real = new Float32Array(N + 1);
    const imag = new Float32Array(N + 1);
    for (let k = 1; k <= N; k++) {
      // Duty-cycle pulse, rolled off so the top end is not a buzzsaw.
      imag[k] = (Math.sin(k * Math.PI * 0.28) / (k * Math.PI)) * Math.exp(-k * 0.055);
    }
    const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });

    this.osc = ctx.createOscillator();
    this.osc.setPeriodicWave(wave);
    this.osc.frequency.value = 40;

    this.oscGain = ctx.createGain();
    this.oscGain.gain.value = 0.5;
    this.osc.connect(this.oscGain);

    // The chassis: three fixed resonators. They do not move with the
    // wheel, which is the whole point.
    this.bands = FORMANTS.map((f, i) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = 6 + i * 3.5;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.9 : 0.25;
      this.oscGain.connect(bp);
      bp.connect(g);
      g.connect(this.motorBus);
      return { bp, g };
    });

    // A dull low shelf under it all: the frame itself.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 240;
    this.oscGain.connect(lp);
    const lg = ctx.createGain();
    lg.gain.value = 0.55;
    lp.connect(lg);
    lg.connect(this.motorBus);

    this.osc.start();
  }

  _grain(when, pitch, gain, pan) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = pitch;
    const off = Math.random() * (this.noiseBuf.duration - 0.06);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 400 + Math.random() * 2600;
    bp.Q.value = 1.2 + Math.random() * 2.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.030 + Math.random() * 0.030);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) p.pan.value = pan;
    src.connect(bp); bp.connect(g);
    if (p) { g.connect(p); p.connect(this.comp); } else g.connect(this.comp);
    src.start(when, off, 0.09);
    src.stop(when + 0.10);
  }

  /* Gravel is not a filtered hiss. It is thousands of separate impacts,
     so a quiet bed carries the body and individual grains are scattered
     on top at a rate set by wheel speed and slip. */
  _regolith(dt, speed, slip) {
    const ctx = this.ctx;
    const rate = Math.min(160, speed * 26 + slip * 90);
    if (rate < 1) { this._nextGrain = ctx.currentTime; return; }
    const now = ctx.currentTime;
    if (this._nextGrain < now) this._nextGrain = now + 0.01;
    const horizon = now + 0.12;
    let guard = 0;
    while (this._nextGrain < horizon && guard++ < 24) {
      const pitch = 0.55 + Math.random() * 1.3 + slip * 0.25;
      const gain = (0.020 + Math.random() * 0.045) * Math.min(1, 0.35 + speed * 0.2);
      this._grain(this._nextGrain, pitch, gain, Math.random() * 1.6 - 0.8);
      this._nextGrain += (1 / rate) * (0.5 + Math.random());
    }
    void dt;
  }

  update(dt, state) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const spin = state.wheelSpin;                  // rad/s, mean magnitude
    const load = state.motorLoad;
    const moving = spin > 0.05 || load > 0.02;

    // Excitation pitch rides the hub: poles × revolutions per second.
    const hz = Math.max(18, Math.min(420, 9.5 * spin + 22));
    this.osc.frequency.setTargetAtTime(hz, t, 0.05);
    const level = moving ? Math.min(1, 0.10 + spin * 0.055 + load * 0.55) : 0;
    this.motorBus.gain.setTargetAtTime(level * 0.34 * this.settings.motor, t, 0.08);
    // Load opens the upper formants, which is what makes climbing sound
    // like climbing.
    this.bands[1].g.gain.setTargetAtTime(0.20 + load * 0.55, t, 0.10);
    this.bands[2].g.gain.setTargetAtTime(0.08 + load * 0.42, t, 0.10);

    this._regolith(dt, state.speed, state.slip);
  }

  /* ---------- one-shots ---------- */

  chirp() {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(2400, t);
    o.frequency.exponentialRampToValueAtTime(360, t + 0.34);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.19, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.40);
    o.connect(g); g.connect(this.radioBus);
    o.start(t); o.stop(t + 0.42);
  }

  drill(on) {
    if (!this.ready) return;
    const ctx = this.ctx;
    if (on && !this._drillNode) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 620; bp.Q.value = 2.4;
      const o = ctx.createOscillator();
      o.type = 'square'; o.frequency.value = 74;
      const og = ctx.createGain(); og.gain.value = 0.045;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.11, ctx.currentTime + 0.25);
      src.connect(bp); bp.connect(g);
      o.connect(og); og.connect(g);
      g.connect(this.comp);
      src.start(); o.start();
      this._drillNode = { src, o, g };
    } else if (!on && this._drillNode) {
      const { src, o, g } = this._drillNode;
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      src.stop(t + 0.26); o.stop(t + 0.26);
      this._drillNode = null;
    }
  }

  beep(freq = 880, dur = 0.09, gain = 0.10, type = 'square') {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.radioBus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  /* A message coming in over the link: squelch, then a couple of tones. */
  radio(good = true) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass'; hp.frequency.value = 1800; hp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(hp); hp.connect(g); g.connect(this.radioBus);
    src.start(t, Math.random(), 0.12); src.stop(t + 0.12);
    this.beep(good ? 660 : 300, 0.07, 0.06, 'sine');
    setTimeout(() => this.beep(good ? 990 : 240, 0.10, 0.05, 'sine'), 90);
  }

  thud(strength = 1) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.min(0.4, 0.10 * strength), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.30);
    o.connect(g); g.connect(this.comp);
    o.start(t); o.stop(t + 0.32);
  }

  setSetting(k, v) {
    this.settings[k] = v;
    if (!this.ready) return;
    if (k === 'master') this.master.gain.value = v;
    if (k === 'radio') this.radioBus.gain.value = v;
  }
}
