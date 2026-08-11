/**
 * Small deterministic maths helpers. Everything the sandbox randomises goes
 * through here so a cast can be reproduced by re-seeding the generator.
 */

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const remap = (v, a, b, c, d) => lerp(c, d, clamp01(invLerp(a, b, v)));
export const smoothstep = (a, b, v) => {
  const t = clamp01(invLerp(a, b, v));
  return t * t * (3 - 2 * t);
};

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t) => t * t * t;
export const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
export const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Overshoot ease — the "punch out of the floor" curve used by every eruption. */
export const easeOutBack = (t, overshoot = 1.7) => {
  const c = overshoot + 1;
  const p = t - 1;
  return 1 + c * p * p * p + overshoot * p * p;
};

/** Rise fast, hold, fall away. `up` and `down` are fractions of the window. */
export function pulse(t, up = 0.12, down = 0.55) {
  if (t <= 0 || t >= 1) return 0;
  if (t < up) return easeOutCubic(t / up);
  if (t > 1 - down) return 1 - easeInCubic((t - (1 - down)) / down);
  return 1;
}

/** xorshift32 — tiny, fast, repeatable. */
export class Rng {
  constructor(seed = 0x9e3779b9) {
    this.s = seed >>> 0 || 1;
  }

  next() {
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return this.s / 0xffffffff;
  }

  range(a, b) {
    return a + (b - a) * this.next();
  }

  int(a, b) {
    return Math.floor(this.range(a, b + 1));
  }

  /** Symmetric jitter around zero. */
  spread(amount) {
    return (this.next() * 2 - 1) * amount;
  }

  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }

  pick(list) {
    return list[Math.min(list.length - 1, Math.floor(this.next() * list.length))];
  }

  /** Point inside a unit disc, evenly distributed. */
  disc(out = { x: 0, y: 0 }) {
    const r = Math.sqrt(this.next());
    const a = this.next() * TAU;
    out.x = Math.cos(a) * r;
    out.y = Math.sin(a) * r;
    return out;
  }

  /** Direction inside a cone of half-angle `spread` around +Z, in local space. */
  cone(spread, out = { x: 0, y: 0, z: 0 }) {
    const cosMin = Math.cos(spread);
    const z = lerp(cosMin, 1, this.next());
    const s = Math.sqrt(Math.max(0, 1 - z * z));
    const a = this.next() * TAU;
    out.x = Math.cos(a) * s;
    out.y = Math.sin(a) * s;
    out.z = z;
    return out;
  }
}

/** One shared stream so unseeded effects still differ from cast to cast. */
export const rng = new Rng((Math.random() * 0xffffffff) >>> 0);

/** Framerate-independent exponential approach. */
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}
