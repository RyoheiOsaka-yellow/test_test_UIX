// Buried memories.
//
// Each one is a small line drawing, hand-plotted as normalised polylines and
// then drawn into the air stroke by stroke, as if remembered rather than seen.

import * as THREE from 'three';

const circle = (cx, cy, r, n = 40, from = 0, to = Math.PI * 2) => {
  const p = [];
  for (let i = 0; i <= n; i++) {
    const a = from + (to - from) * (i / n);
    p.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return p;
};

// Drawings live in a [-1, 1] square. Order of strokes is the order they are
// remembered in.
export const MEMORY_ART = [
  { // a tennis ball, mid-bounce
    name: 'ball',
    strokes: [
      circle(-0.1, -0.05, 0.42),
      [0.16, 0.30, 0.05, -0.05, 0.16, -0.40],
      [-0.36, 0.30, -0.25, -0.05, -0.36, -0.40],
      [-0.52, -0.62, -0.10, -0.62, 0.3, -0.62],
      [0.36, -0.55, 0.55, -0.20, 0.72, -0.52],
      [0.74, -0.48, 0.86, -0.30, 0.95, -0.55],
    ],
  },
  { // the leash on its hook by the door
    name: 'leash',
    strokes: [
      [-0.75, -0.9, -0.75, 0.75, 0.15, 0.75, 0.15, -0.9],
      [-0.06, -0.06, 0.02, -0.02],
      [0.45, 0.62, 0.62, 0.62],
      [0.62, 0.62, 0.62, 0.44],
      [0.62, 0.44, 0.50, 0.32, 0.72, 0.14, 0.50, -0.06, 0.70, -0.26, 0.56, -0.42],
      circle(0.50, -0.55, 0.14, 24),
    ],
  },
  { // the car window, and the road going by
    name: 'car',
    strokes: [
      [-0.9, -0.25, -0.62, 0.25, 0.24, 0.34, 0.62, -0.16, 0.92, -0.2, 0.92, -0.42, -0.9, -0.42, -0.9, -0.25],
      circle(-0.5, -0.5, 0.18, 22),
      circle(0.46, -0.5, 0.18, 22),
      [-0.55, 0.2, -0.1, 0.28, -0.1, -0.2],
      [0.02, 0.28, 0.5, -0.12, 0.02, -0.2, 0.02, 0.28],
      [-1.0, -0.78, -0.55, -0.78],
      [-0.28, -0.78, 0.18, -0.78],
      [0.45, -0.78, 0.92, -0.78],
    ],
  },
  { // the bench you both waited on
    name: 'bench',
    strokes: [
      [-0.8, -0.1, 0.55, -0.1],
      [-0.8, -0.24, 0.55, -0.24],
      [-0.72, 0.42, 0.62, 0.42],
      [-0.72, 0.26, 0.62, 0.26],
      [-0.76, -0.1, -0.72, 0.5],
      [0.5, -0.1, 0.58, 0.5],
      [-0.7, -0.1, -0.7, -0.62],
      [0.44, -0.1, 0.44, -0.62],
      [0.72, -0.62, 0.72, 0.1],
      [0.72, 0.1, 0.5, 0.42, 0.72, 0.55, 0.95, 0.42, 0.72, 0.1],
      [-1.0, -0.62, 0.98, -0.62],
    ],
  },
  { // the porch light left on
    name: 'house',
    strokes: [
      [-0.72, -0.62, -0.72, 0.16, 0.0, 0.72, 0.72, 0.16, 0.72, -0.62, -0.72, -0.62],
      [-0.24, -0.62, -0.24, 0.06, 0.16, 0.06, 0.16, -0.62],
      circle(0.06, -0.28, 0.035, 10),
      [0.38, 0.1, 0.38, -0.14, 0.58, -0.14, 0.58, 0.1, 0.38, 0.1],
      [0.48, 0.1, 0.48, -0.14],
      [0.38, -0.02, 0.58, -0.02],
      [-0.5, 0.34, -0.5, 0.2],
      [-0.62, 0.2, -0.38, 0.2, -0.5, -0.02, -0.62, 0.2],
      [-1.0, -0.62, 1.0, -0.62],
    ],
  },
];

const VERT = /* glsl */ `
attribute float aOrder;
attribute vec3 aColor;
varying float vOrder;
varying vec3 vColor;
void main() {
  vOrder = aOrder;
  vColor = aColor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform float uProgress;
uniform float uAlpha;
uniform float uDissolve;
varying float vOrder;
varying vec3 vColor;
void main() {
  float edge = uProgress - vOrder;
  if (edge < 0.0) discard;
  float lead = exp(-edge * 22.0);
  float body = 1.0 - uDissolve * smoothstep(0.0, 1.0, 1.0 - vOrder + uDissolve);
  float a = uAlpha * (0.55 + lead * 1.6) * max(0.0, body);
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor * (0.7 + lead * 2.2) * a, a);
}
`;

export class MemoryVision {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uProgress: { value: 0 },
        uAlpha: { value: 1 },
        uDissolve: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    this.t = 0;
    this.active = false;
    this.origin = new THREE.Vector3();
    this.DRAW = 2.8;
    this.HOLD = 4.6;
    this.GONE = 2.0;
  }

  show(index, worldPos, scale = 1.7) {
    const art = MEMORY_ART[index % MEMORY_ART.length];
    const pos = [];
    const order = [];
    const col = [];
    const c = new THREE.Color();

    // total length so the drawing paces itself evenly
    let total = 0;
    for (const s of art.strokes) {
      for (let i = 2; i < s.length; i += 2) total += Math.hypot(s[i] - s[i - 2], s[i + 1] - s[i - 1]);
      total += 0.12; // a small pause between strokes
    }

    let acc = 0;
    art.strokes.forEach((s, si) => {
      const hue = 0.09 + (si / art.strokes.length) * 0.06;
      c.setHSL(hue, 0.55, 0.72);
      for (let i = 2; i < s.length; i += 2) {
        const ax = s[i - 2], ay = s[i - 1], bx = s[i], by = s[i + 1];
        const seg = Math.hypot(bx - ax, by - ay);
        const o0 = acc / total;
        acc += seg;
        const o1 = acc / total;
        pos.push(ax * scale, ay * scale, 0, bx * scale, by * scale, 0);
        order.push(o0, o1);
        col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
      acc += 0.12;
    });

    this.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aOrder', new THREE.Float32BufferAttribute(order, 1));
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3));
    this.mesh = new THREE.LineSegments(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.origin.copy(worldPos);
    this.mesh.position.copy(worldPos);
    this.scene.add(this.mesh);

    this.t = 0;
    this.active = true;
    this.index = index;
  }

  dispose() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
  }

  update(dt, camera) {
    if (!this.active || !this.mesh) return;
    this.t += dt;
    const u = this.material.uniforms;
    u.uProgress.value = Math.min(1.0, this.t / this.DRAW);

    const tHold = this.t - this.DRAW;
    if (tHold > this.HOLD) {
      const d = (tHold - this.HOLD) / this.GONE;
      u.uDissolve.value = Math.min(1, d);
      u.uAlpha.value = Math.max(0, 1 - d);
      if (d >= 1) { this.active = false; this.dispose(); return; }
    } else {
      u.uDissolve.value = 0;
      u.uAlpha.value = 1;
    }

    // float up gently and always face the camera
    this.mesh.position.copy(this.origin);
    this.mesh.position.y += Math.min(this.t, 6) * 0.10 + Math.sin(this.t * 0.9) * 0.06;
    this.mesh.quaternion.copy(camera.quaternion);
  }
}
