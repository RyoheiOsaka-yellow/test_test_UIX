import * as THREE from 'three';
import { noiseGLSL } from '../shaders/lib/noise.glsl.js';
import { commonGLSL } from '../shaders/lib/common.glsl.js';
import { frame } from '../core/FrameUniforms.js';
import { damp } from '../utils/math.js';

/**
 * The two targeting shapes.
 *
 * `AimIndicator` is the line cast: a League-style arrow laid on the floor that
 * swings with the mouse. `ZoneIndicator` is the far cast: a circle with a
 * deliberately thick boundary, because the only question a ground-targeted AoE
 * has to answer before you commit is how much space it is going to take.
 *
 * Both are single quads. The arrow head, the shaft, the chevrons, the rim and
 * the tick marks are all distance fields — there is no geometry to update when
 * the range changes, only a scale.
 */

const arrowFragment = /* glsl */ `
${noiseGLSL}
${commonGLSL}

uniform float uTime;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uLength;       /* world length, to keep the head square */
uniform float uWidth;
uniform float uEdge;
uniform float uFill;
uniform float uGlow;
uniform float uArrowLength;
uniform float uArrowWidth;
uniform float uChevrons;
uniform float uChevronSpeed;
uniform float uChevronSharp;
uniform float uPulseSpeed;
uniform float uPulseDepth;
uniform float uMinRangeT;

varying vec2 vUv;

void main() {
  /* Work in metres so the head does not stretch with the range. */
  float along = vUv.x * uLength;
  float across = (vUv.y - 0.5) * uWidth;

  float halfW = uWidth * 0.5;   /* 'half' is a reserved word in GLSL */
  float headStart = uLength - uArrowLength;

  /* --- shaft: a box that stops where the head begins ------------------- */
  float shaft = es_sdBox(vec2(along - headStart * 0.5, across), vec2(headStart * 0.5, halfW));

  /* --- head: an isoceles triangle sitting on the end of the shaft ------ */
  vec2 hp = vec2(across, along - headStart);
  float head = es_sdTriangleIso(vec2(hp.x, uArrowLength - hp.y),
                                vec2(uArrowWidth * 0.5, uArrowLength));

  float d = min(shaft, head);

  /* --- outline + interior --------------------------------------------- */
  float aa = fwidth(d) * 1.2 + 1e-4;
  float outline = 1.0 - smoothstep(uEdge - aa, uEdge + aa, abs(d));
  float interior = 1.0 - smoothstep(-aa, aa, d);

  /* --- chevrons running toward the target ------------------------------ */
  float lane = along / max(uLength, 1e-3);
  float chev = fract(lane * uChevrons - uTime * uChevronSpeed);
  /* Bend the band into a > by offsetting it with |across|. */
  float bend = abs(across) / max(halfW, 1e-3) * 0.12;
  float band = pow(1.0 - abs(fract(chev + bend) - 0.35) * 2.0, uChevronSharp);
  band = clamp(band, 0.0, 1.0) * interior;

  /* --- edge glow spilling outward, and only outward -------------------- */
  float glow = d > 0.0 ? exp(-d * 9.0) * uGlow : 0.0;

  float pulse = 1.0 + uPulseDepth * sin(uTime * uPulseSpeed);

  /* --- minimum-range gate ---------------------------------------------- */
  float dead = 1.0 - smoothstep(uMinRangeT - 0.01, uMinRangeT + 0.01, lane);

  vec3 col = uColor * (outline * 1.1 + interior * uFill + band * 0.5 + glow * 0.8);
  col += vec3(1.0) * outline * 0.18;

  float a = (outline * 0.85 + interior * uFill + band * 0.4 + glow * 0.5) * uOpacity * pulse;
  a *= mix(1.0, 0.22, dead);
  col *= mix(1.0, 0.5, dead);

  /* Fray the very tip of the tail so it does not start with a hard line. */
  a *= smoothstep(0.0, 0.05, lane);

  if (a < 0.004) discard;
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
}
`;

const zoneFragment = /* glsl */ `
${noiseGLSL}
${commonGLSL}

uniform float uTime;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uRadius;
uniform float uRimWidth;
uniform float uRimGlow;
uniform float uFill;
uniform float uInnerRing;
uniform float uTicks;
uniform float uTickLength;
uniform float uSpinSpeed;
uniform float uPulseSpeed;
uniform float uPulseDepth;

varying vec2 vUv;

void main() {
  vec2 p = (vUv * 2.0 - 1.0) * uRadius;
  float r = length(p);
  float ang = atan(p.y, p.x);

  float aa = fwidth(r) * 1.5 + 1e-4;

  /* --- the boundary: thick on purpose ---------------------------------- */
  float rim = 1.0 - smoothstep(uRimWidth * 0.5 - aa, uRimWidth * 0.5 + aa, abs(r - uRadius));

  /* --- inner reference ring -------------------------------------------- */
  float inner = 1.0 - smoothstep(0.02, 0.045, abs(r - uRadius * uInnerRing));

  /* --- tick marks around the rim, slowly turning ----------------------- */
  float spin = uTime * uSpinSpeed;
  float tick = pow(abs(cos((ang + spin) * uTicks * 0.5)), 40.0);
  float tickBand = 1.0 - smoothstep(uTickLength * 0.5, uTickLength * 0.5 + 0.02,
                                    abs(r - (uRadius - uTickLength * 0.6)));
  float ticks = tick * tickBand;

  /* --- interior --------------------------------------------------------- */
  float inside = 1.0 - smoothstep(uRadius - aa, uRadius + aa, r);
  float wash = es_fbm2(p * 0.9 + vec2(0.0, uTime * 0.25), 3, 2.1, 0.5);
  float fill = inside * uFill * (0.55 + 0.9 * wash);

  /* --- glow outside the boundary ---------------------------------------- */
  float glow = exp(-abs(r - uRadius) * 5.0) * uRimGlow;

  float pulse = 1.0 + uPulseDepth * sin(uTime * uPulseSpeed);

  vec3 col = uColor * (rim * 1.2 + inner * 0.5 + ticks * 0.8 + fill + glow * 0.7);
  col += vec3(1.0) * rim * 0.2;

  float a = (rim * 0.85 + inner * 0.4 + ticks * 0.5 + fill + glow * 0.45) * uOpacity * pulse;
  if (a < 0.004) discard;
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
}
`;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export class AimIndicator {
  constructor(scene, settings) {
    this.settings = settings;

    // Unit quad running from z = 0 (caster) to z = 1 (target).
    const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    geometry.rotateX(-Math.PI / 2);
    geometry.rotateY(-Math.PI / 2);
    geometry.translate(0, 0, 0.5);

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: arrowFragment,
      uniforms: {
        uTime: frame.uTime,
        uColor: { value: new THREE.Color(settings.aim.color) },
        uOpacity: { value: 0 },
        uLength: { value: 10 },
        uWidth: { value: 1.4 },
        uEdge: { value: 0.06 },
        uFill: { value: 0.14 },
        uGlow: { value: 0.5 },
        uArrowLength: { value: 2 },
        uArrowWidth: { value: 1.8 },
        uChevrons: { value: 4 },
        uChevronSpeed: { value: 1.3 },
        uChevronSharp: { value: 2.6 },
        uPulseSpeed: { value: 2.4 },
        uPulseDepth: { value: 0.18 },
        uMinRangeT: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: true,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.renderOrder = 20;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);

    this.opacity = 0;
  }

  /**
   * @param {THREE.Vector3} origin   caster foot position
   * @param {THREE.Vector3} dir      normalised aim direction
   * @param {number} length          reach in metres
   * @param {boolean} valid          false when the cursor is inside minRange
   */
  set(origin, dir, length, ability, valid) {
    const a = this.settings.aim;
    const u = this.material.uniforms;

    this.mesh.position.set(origin.x, a.height, origin.z);
    this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    this.mesh.scale.set(a.width, 1, length);

    u.uLength.value = length;
    u.uWidth.value = a.width;
    u.uEdge.value = a.edgeWidth;
    u.uFill.value = a.fill;
    u.uGlow.value = a.glow;
    u.uArrowLength.value = a.arrowLength;
    u.uArrowWidth.value = a.arrowWidth;
    u.uChevrons.value = a.chevrons;
    u.uChevronSpeed.value = a.chevronSpeed;
    u.uChevronSharp.value = a.chevronSharpness;
    u.uPulseSpeed.value = a.pulseSpeed;
    u.uPulseDepth.value = a.pulseDepth;
    u.uMinRangeT.value = ability ? Math.min(0.99, ability.minRange / Math.max(length, 1e-3)) : 0;
    u.uColor.value.set(valid ? a.color : a.invalidColor);
  }

  show(on) {
    this.target = on ? 1 : 0;
  }

  update(dt) {
    const a = this.settings.aim;
    this.opacity = damp(this.opacity, this.target ?? 0, 1 / Math.max(a.fadeIn, 0.01), dt);
    this.material.uniforms.uOpacity.value = this.opacity;
    this.mesh.visible = this.opacity > 0.01;
  }
}

export class ZoneIndicator {
  constructor(scene, settings) {
    this.settings = settings;

    const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    geometry.rotateX(-Math.PI / 2);

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: zoneFragment,
      uniforms: {
        uTime: frame.uTime,
        uColor: { value: new THREE.Color(settings.aim.color) },
        uOpacity: { value: 0 },
        uRadius: { value: 3 },
        uRimWidth: { value: 0.3 },
        uRimGlow: { value: 0.9 },
        uFill: { value: 0.09 },
        uInnerRing: { value: 0.62 },
        uTicks: { value: 48 },
        uTickLength: { value: 0.22 },
        uSpinSpeed: { value: 0.35 },
        uPulseSpeed: { value: 2.4 },
        uPulseDepth: { value: 0.18 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: true,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.renderOrder = 20;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);

    this.opacity = 0;
  }

  set(point, radius, valid) {
    const a = this.settings.aim;
    const z = a.zone;
    const u = this.material.uniforms;

    // A little padding so the outer glow has somewhere to live.
    const pad = radius * 1.28;
    this.mesh.position.set(point.x, a.height, point.z);
    this.mesh.scale.set(pad * 2, 1, pad * 2);

    u.uRadius.value = radius / pad; // radius in the quad's own units
    u.uRimWidth.value = (z.rimWidth / pad) * 1.0;
    u.uRimGlow.value = z.rimGlow;
    u.uFill.value = z.fill;
    u.uInnerRing.value = z.innerRing;
    u.uTicks.value = z.ticks;
    u.uTickLength.value = z.tickLength / pad;
    u.uSpinSpeed.value = z.spinSpeed;
    u.uPulseSpeed.value = a.pulseSpeed;
    u.uPulseDepth.value = a.pulseDepth;
    u.uColor.value.set(valid ? a.color : a.invalidColor);
  }

  show(on) {
    this.target = on ? 1 : 0;
  }

  update(dt) {
    const a = this.settings.aim;
    this.opacity = damp(this.opacity, this.target ?? 0, 1 / Math.max(a.fadeIn, 0.01), dt);
    this.material.uniforms.uOpacity.value = this.opacity;
    this.mesh.visible = this.opacity > 0.01;
  }
}
