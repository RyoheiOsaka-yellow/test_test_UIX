// Live audio analysis.
//
// The reference demos replay a pre-baked binary of per-frame analysis alongside
// an mp3. This runs the same analysis in the browser instead, so the shapes react
// to whatever the page is given — the built-in generated track, a dropped file,
// or the microphone.
//
// Per frame it produces:
//   ampL / ampR / ampMono  — RMS amplitude per channel, 0–1
//   fft                    — 128-bin mel-scale spectrum per channel, 0–1
//   history                — a 256-frame ring buffer (~4 s at 60 fps) of amplitude
//   spectrogram            — a 128 × 256 ring buffer of past spectra

export const HIST = 256;   // history frames, ~4 s at 60 fps
export const BINS = 128;   // mel bands
export const FPS  = 60;    // rate the history ring buffer advances at

// Longest stall the history will unroll in one update. Without a cap, a tab that
// was backgrounded for a minute would try to push thousands of rows at once.
const MAX_CATCHUP = 8;

const MEL_LO_HZ = 30;
const MEL_HI_HZ = 16000;

// Amplitude is mapped from dBFS rather than raw RMS. A linear RMS reading is
// dominated by whether the source happens to be a loud master or a quiet
// recording; a dB window puts typical programme material in the middle of the
// range whatever its absolute level, and silence still lands on zero.
const AMP_FLOOR_DB = 42;

// Samples used for the RMS reading — about 12 ms at 44.1 kHz.
const AMP_WINDOW = 512;

// Spectral window, calibrated so a mixed track lands in roughly the same range
// the reference demos' offline analysis produces: sub-bass bands around 0.6–0.8,
// mids around 0.3, and the top octave still reading rather than sitting at zero.
const FFT_MIN_DB = -90;
const FFT_MAX_DB = -35;

const hzToMel = (hz) => 2595 * Math.log10(1 + hz / 700);
const melToHz = (mel) => 700 * (10 ** (mel / 2595) - 1);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.source = null;       // currently connected source node
    this.mediaEl = null;      // <audio> element, when playing a file
    this.demo = null;         // generated-track scheduler, when active
    this.sourceKind = 'none';
    this.isPlaying = false;
    this.gain = 1.0;

    // Per-frame analysis results
    this.ampL = 0;
    this.ampR = 0;
    this.ampMono = 0;
    this.fftL = new Float32Array(BINS);
    this.fftR = new Float32Array(BINS);
    this.fftMono = new Float32Array(BINS);

    // Ring buffers. `head` is the row that will be written next.
    this.histL = new Float32Array(HIST);
    this.histR = new Float32Array(HIST);
    this.histMono = new Float32Array(HIST);
    this.spec = new Float32Array(BINS * HIST);
    this.head = 0;
  }

  // ── Graph setup ────────────────────────────────────────────────────────────

  _ensureContext() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    this.analyserL = this.ctx.createAnalyser();
    this.analyserR = this.ctx.createAnalyser();
    for (const a of [this.analyserL, this.analyserR]) {
      a.fftSize = 2048;
      a.smoothingTimeConstant = 0.7;
      a.minDecibels = -85;
      a.maxDecibels = -5;
    }
    this.splitter = this.ctx.createChannelSplitter(2);
    this.splitter.connect(this.analyserL, 0);
    this.splitter.connect(this.analyserR, 1);

    this.freqBuf = new Float32Array(this.analyserL.frequencyBinCount);
    this.timeBuf = new Float32Array(this.analyserL.fftSize);
    this._buildMelMap();
  }

  // Precompute which linear FFT bins fall into each mel band. Mel spacing packs
  // resolution into the low end, matching how the ear reads a spectrum.
  _buildMelMap() {
    const n = this.analyserL.frequencyBinCount;
    const nyquist = this.ctx.sampleRate / 2;
    const melLo = hzToMel(MEL_LO_HZ);
    const melHi = hzToMel(Math.min(MEL_HI_HZ, nyquist));
    this.melStart = new Int32Array(BINS);
    this.melEnd = new Int32Array(BINS);
    for (let i = 0; i < BINS; i++) {
      const f0 = melToHz(melLo + (melHi - melLo) * (i / BINS));
      const f1 = melToHz(melLo + (melHi - melLo) * ((i + 1) / BINS));
      const b0 = Math.min(n - 1, Math.max(0, Math.floor(f0 / nyquist * n)));
      const b1 = Math.min(n, Math.max(b0 + 1, Math.ceil(f1 / nyquist * n)));
      this.melStart[i] = b0;
      this.melEnd[i] = b1;
    }
  }

  _disconnectSource() {
    if (this.demo) { this.demo.stop(); this.demo = null; }
    if (this.mediaEl) { this.mediaEl.pause(); this.mediaEl = null; }
    if (this.source) { try { this.source.disconnect(); } catch { /* already gone */ } }
    this.source = null;
    this.isPlaying = false;
  }

  // Everything except the microphone is also routed to the speakers; mic input
  // is analysis-only, since monitoring it would feed back.
  _connect(node, { audible }) {
    node.connect(this.splitter);
    if (audible) node.connect(this.ctx.destination);
    this.source = node;
  }

  async useFile(file) {
    this._ensureContext();
    this._disconnectSource();
    const el = new Audio(URL.createObjectURL(file));
    el.loop = true;
    el.crossOrigin = 'anonymous';
    this.mediaEl = el;
    this._connect(this.ctx.createMediaElementSource(el), { audible: true });
    this.sourceKind = 'file';
    await this.play();
  }

  async useMic() {
    this._ensureContext();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this._disconnectSource();
    this._connect(this.ctx.createMediaStreamSource(stream), { audible: false });
    this.sourceKind = 'mic';
    this.micStream = stream;
    await this.ctx.resume();
    this.isPlaying = true;
  }

  async useDemo() {
    this._ensureContext();
    this._disconnectSource();
    const out = this.ctx.createGain();
    out.gain.value = 0.8;
    this._connect(out, { audible: true });
    this.demo = new DemoTrack(this.ctx, out);
    this.sourceKind = 'demo';
    await this.play();
  }

  async play() {
    if (!this.ctx) return;
    await this.ctx.resume();
    if (this.mediaEl) await this.mediaEl.play();
    if (this.demo) this.demo.start();
    this.isPlaying = true;
  }

  pause() {
    if (this.mediaEl) this.mediaEl.pause();
    if (this.demo) this.demo.stop();
    if (this.sourceKind === 'mic' && this.ctx) this.ctx.suspend();
    this.isPlaying = false;
  }

  async toggle() {
    if (this.isPlaying) this.pause(); else await this.play();
    return this.isPlaying;
  }

  // ── Per-frame analysis ─────────────────────────────────────────────────────

  _channelAmp(analyser) {
    analyser.getFloatTimeDomainData(this.timeBuf);
    // Only the newest samples are measured. Averaging the analyser's full 2048-
    // sample window (~46 ms) smears attacks into the sustain behind them, which
    // is exactly the detail these deformations are meant to be tight on.
    const n = this.timeBuf.length;
    const from = n - AMP_WINDOW;
    let sum = 0;
    for (let i = from; i < n; i++) sum += this.timeBuf[i] * this.timeBuf[i];
    const rms = Math.sqrt(sum / AMP_WINDOW);
    if (rms < 1e-5) return 0;
    const db = 20 * Math.log10(rms);
    return Math.max(0, Math.min(1, ((db + AMP_FLOOR_DB) / AMP_FLOOR_DB) * this.gain));
  }

  // Reduce the linear spectrum to mel bands. Each band takes the peak of its
  // range so narrow transients survive the downsampling, then dB is mapped onto
  // 0–1 across the window above.
  _channelFFT(analyser, out) {
    analyser.getFloatFrequencyData(this.freqBuf);
    const span = FFT_MAX_DB - FFT_MIN_DB;
    for (let i = 0; i < BINS; i++) {
      let peak = -Infinity;
      for (let b = this.melStart[i]; b < this.melEnd[i]; b++) {
        if (this.freqBuf[b] > peak) peak = this.freqBuf[b];
      }
      out[i] = Math.max(0, Math.min(1, (peak - FFT_MIN_DB) / span));
    }
  }

  _pushHistory() {
    this.histL[this.head] = this.ampL;
    this.histR[this.head] = this.ampR;
    this.histMono[this.head] = this.ampMono;
    const base = this.head * BINS;
    for (let i = 0; i < BINS; i++) this.spec[base + i] = this.fftMono[i];
    this.head = (this.head + 1) % HIST;
  }

  // `now` is a performance.now() timestamp. The ring buffer advances on a fixed
  // 60 Hz clock rather than once per rendered frame, so the window stays ~4
  // seconds of *audio* whatever the render rate — otherwise a machine drawing at
  // 20 fps would spread 13 seconds across the same geometry.
  update(now = performance.now()) {
    if (!this.ctx) return;
    this.pushed = 0;

    this.ampL = this._channelAmp(this.analyserL);
    this.ampR = this._channelAmp(this.analyserR);
    this.ampMono = (this.ampL + this.ampR) * 0.5;

    this._channelFFT(this.analyserL, this.fftL);
    this._channelFFT(this.analyserR, this.fftR);
    for (let i = 0; i < BINS; i++) {
      this.fftMono[i] = (this.fftL[i] + this.fftR[i]) * 0.5;
    }

    const step = 1000 / FPS;
    if (this._nextPush === undefined) this._nextPush = now;
    let steps = Math.floor((now - this._nextPush) / step) + 1;
    if (steps > MAX_CATCHUP) {
      // Long stall: skip ahead rather than replaying stale readings.
      steps = MAX_CATCHUP;
      this._nextPush = now;
    }
    this._nextPush += steps * step;
    for (let i = 0; i < steps; i++) this._pushHistory();
    this.pushed = steps;
  }

  // Amplitude `age` frames ago, 0 being the frame just written
  histAt(buf, age) {
    return buf[(this.head - 1 - age + HIST * 2) % HIST];
  }
}

// ── Built-in generated track ─────────────────────────────────────────────────
// A short four-bar loop — kick, hat, bass and a drifting pad — so the page has
// something to react to before the user supplies audio of their own. It is
// deliberately wide-band: the kick drives the low mel bands, the hat the top,
// and the pad fills the middle, which exercises every frequency mode.

class DemoTrack {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.out = out;
    this.running = false;
    this.step = 0;
    this.nextTime = 0;
    this.bpm = 124;
    this.timer = null;
    this.pad = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.nextTime = this.ctx.currentTime + 0.08;
    this._startPad();
    this.timer = setInterval(() => this._schedule(), 25);
  }

  stop() {
    this.running = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.pad) {
      for (const n of this.pad.nodes) { try { n.stop(); } catch { /* already stopped */ } }
      this.pad = null;
    }
  }

  // Two sustained layers that never stop: a filtered saw drone for the mid bands
  // and a quiet high-passed noise bed for the top. Drum hits alone leave most of
  // the spectrum empty between transients, which makes the frequency and
  // spectrogram modes read as blank — these keep every band alive.
  _startPad() {
    const t = this.ctx.currentTime;
    const nodes = [];

    // Drone: four detuned saws through a slowly sweeping resonant lowpass
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 6;

    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 780;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start(t);
    nodes.push(lfo);

    const padGain = this.ctx.createGain();
    padGain.gain.value = 0.12;
    filter.connect(padGain).connect(this.out);

    for (const hz of [110, 164.81, 220, 277.18]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz;
      o.detune.value = (Math.random() - 0.5) * 14;
      o.connect(filter);
      o.start(t);
      nodes.push(o);
    }

    // Sub: a quiet low sine so the bottom mel bands carry continuous energy the
    // way a real mix does. Without it those bands only see the kick's transient
    // and the spectral modes read as flat at the bottom.
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.value = 46;
    subGain.gain.value = 0.30;
    sub.connect(subGain).connect(this.out);
    sub.start(t);
    nodes.push(sub);

    // Air: a looping noise buffer through a bandpass that drifts across the top
    // two octaves, so the highest mel bands always have something to show.
    const len = Math.ceil(this.ctx.sampleRate * 2);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;

    const air = this.ctx.createBiquadFilter();
    air.type = 'bandpass';
    air.frequency.value = 5000;
    air.Q.value = 0.7;

    const airLfo = this.ctx.createOscillator();
    const airLfoGain = this.ctx.createGain();
    airLfo.frequency.value = 0.11;
    airLfoGain.gain.value = 3200;
    airLfo.connect(airLfoGain).connect(air.frequency);
    airLfo.start(t);
    nodes.push(airLfo);

    const airGain = this.ctx.createGain();
    airGain.gain.value = 0.075;
    noise.connect(air).connect(airGain).connect(this.out);
    noise.start(t);
    nodes.push(noise);

    this.pad = { nodes };
  }

  // Look ahead ~120 ms and queue any steps that fall inside the window. The
  // interval timer is too coarse to trigger notes directly, so it only ever
  // schedules them against the audio clock.
  _schedule() {
    if (!this.running) return;
    const stepDur = 60 / this.bpm / 4;   // sixteenth notes
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this._playStep(this.step % 16, this.nextTime);
      this.step++;
      this.nextTime += stepDur;
    }
  }

  _playStep(s, t) {
    if (s % 4 === 0) this._kick(t);
    if (s % 4 === 2) this._hat(t, 0.05);
    if (s % 2 === 1) this._hat(t, 0.018);
    if (s === 6 || s === 14) this._snare(t);
    // Offbeat bass, skipping the downbeat so the kick reads cleanly
    if (s % 4 === 2 || s === 7) this._bass(t, [55, 61.74, 73.42, 82.41][(s >> 2) & 3]);
  }

  _env(node, t, peak, attack, decay) {
    const g = node.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  _kick(t) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.13);
    this._env(g, t, 1.0, 0.004, 0.30);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.4);
  }

  _bass(t, hz) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.value = hz;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(260, t + 0.18);
    this._env(g, t, 0.55, 0.006, 0.20);
    o.connect(f).connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.3);
  }

  _noiseBurst(t, peak, decay, hp) {
    const len = Math.ceil(this.ctx.sampleRate * (decay + 0.05));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = this.ctx.createGain();
    this._env(g, t, peak, 0.002, decay);
    src.connect(f).connect(g).connect(this.out);
    src.start(t);
    src.stop(t + decay + 0.05);
  }

  _hat(t, peak) { this._noiseBurst(t, peak * 1.6, 0.045, 7000); }
  _snare(t)     { this._noiseBurst(t, 0.50, 0.16, 1600); }
}
