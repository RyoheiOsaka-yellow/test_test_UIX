/* BFSERV — "paint mixing" fluid simulation (WebGL1/2, compact Navier–Stokes)
   <canvas data-fluid data-colors="#f5c518,#2457f5,..." data-bg="#f8f5ec" data-strength="1" data-auto="1">
   - pigment stored premultiplied (rgb*a, a) so colours blend like gouache instead of glowing
   - fake impasto lighting from the pigment gradient
   - pointer strokes stir the paint; automatic brush keeps it moving when idle
   - falls back to the ribbon shader (hero.js) when float render targets are unavailable */
(() => {
  const canvases = document.querySelectorAll('canvas[data-fluid]');
  if (!canvases.length) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hex = h => { const n = parseInt(h.replace('#', ''), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

  function initFluid(canvas) {
    const params = { alpha: false, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
    let gl = canvas.getContext('webgl2', params); const isGL2 = !!gl;
    if (!gl) gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);
    if (!gl) return false;

    let halfFloat, linear = false, internal, format, type;
    if (isGL2) {
      if (!gl.getExtension('EXT_color_buffer_float')) return false;
      linear = !!gl.getExtension('OES_texture_float_linear');
      internal = gl.RGBA16F; format = gl.RGBA; type = gl.HALF_FLOAT;
    } else {
      halfFloat = gl.getExtension('OES_texture_half_float'); if (!halfFloat) return false;
      linear = !!gl.getExtension('OES_texture_half_float_linear');
      internal = gl.RGBA; format = gl.RGBA; type = halfFloat.HALF_FLOAT_OES;
    }
    // verify render-to-texture works with this format
    (function check() {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, 4, 4, 0, format, type, null);
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.deleteFramebuffer(fb); gl.deleteTexture(t);
      if (!ok) throw new Error('fluid: fbo unsupported');
    })();

    const baseVS = `precision highp float; attribute vec2 aPos; varying vec2 vUv, vL, vR, vT, vB; uniform vec2 texelSize;
      void main(){ vUv = aPos*0.5+0.5; vL = vUv - vec2(texelSize.x,0.); vR = vUv + vec2(texelSize.x,0.); vT = vUv + vec2(0.,texelSize.y); vB = vUv - vec2(0.,texelSize.y); gl_Position = vec4(aPos,0.,1.); }`;
    const bilerp = linear ? '' : `
      vec4 bil(sampler2D s, vec2 uv, vec2 ts){ vec2 st = uv/ts - 0.5; vec2 i = floor(st); vec2 f = fract(st);
        vec4 a = texture2D(s,(i+vec2(0.5,0.5))*ts); vec4 b = texture2D(s,(i+vec2(1.5,0.5))*ts); vec4 c = texture2D(s,(i+vec2(0.5,1.5))*ts); vec4 d = texture2D(s,(i+vec2(1.5,1.5))*ts);
        return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }`;
    const FS = {
      splat: `precision highp float; varying vec2 vUv; uniform sampler2D uTarget; uniform float aspect; uniform vec3 color; uniform float alpha; uniform vec2 point; uniform float radius;
        void main(){ vec2 p = vUv - point; p.x *= aspect; float g = exp(-dot(p,p)/radius); vec4 base = texture2D(uTarget, vUv);
          gl_FragColor = base + vec4(color*g*alpha, g*alpha); }`,
      splatV: `precision highp float; varying vec2 vUv; uniform sampler2D uTarget; uniform float aspect; uniform vec3 color; uniform vec2 point; uniform float radius;
        void main(){ vec2 p = vUv - point; p.x *= aspect; vec3 s = exp(-dot(p,p)/radius) * color; vec3 base = texture2D(uTarget, vUv).xyz; gl_FragColor = vec4(base + s, 1.); }`,
      advect: `precision highp float; varying vec2 vUv; uniform sampler2D uVelocity, uSource; uniform vec2 texelSize, dyeTexelSize; uniform float dt, dissipation; ${bilerp}
        void main(){ ${linear ? 'vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize; vec4 r = texture2D(uSource, coord);' : 'vec2 coord = vUv - dt * bil(uVelocity, vUv, texelSize).xy * texelSize; vec4 r = bil(uSource, coord, dyeTexelSize);'}
          gl_FragColor = r / (1. + dissipation*dt); }`,
      divergence: `precision mediump float; varying vec2 vUv, vL, vR, vT, vB; uniform sampler2D uVelocity;
        void main(){ float L = texture2D(uVelocity, vL).x, R = texture2D(uVelocity, vR).x, T = texture2D(uVelocity, vT).y, B = texture2D(uVelocity, vB).y; vec2 C = texture2D(uVelocity, vUv).xy;
          if (vL.x < 0.) L = -C.x; if (vR.x > 1.) R = -C.x; if (vT.y > 1.) T = -C.y; if (vB.y < 0.) B = -C.y; gl_FragColor = vec4(0.5*(R-L+T-B),0.,0.,1.); }`,
      curl: `precision mediump float; varying vec2 vUv, vL, vR, vT, vB; uniform sampler2D uVelocity;
        void main(){ float L = texture2D(uVelocity, vL).y, R = texture2D(uVelocity, vR).y, T = texture2D(uVelocity, vT).x, B = texture2D(uVelocity, vB).x; gl_FragColor = vec4(0.5*(R-L-T+B),0.,0.,1.); }`,
      vorticity: `precision highp float; varying vec2 vUv, vL, vR, vT, vB; uniform sampler2D uVelocity, uCurl; uniform float curl, dt;
        void main(){ float L = texture2D(uCurl, vL).x, R = texture2D(uCurl, vR).x, T = texture2D(uCurl, vT).x, B = texture2D(uCurl, vB).x, C = texture2D(uCurl, vUv).x;
          vec2 f = 0.5*vec2(abs(T)-abs(B), abs(R)-abs(L)); f /= length(f)+1e-4; f *= curl*C; f.y *= -1.;
          vec2 v = texture2D(uVelocity, vUv).xy + f*dt; v = clamp(v, -1000., 1000.); gl_FragColor = vec4(v,0.,1.); }`,
      pressure: `precision mediump float; varying vec2 vUv, vL, vR, vT, vB; uniform sampler2D uPressure, uDivergence;
        void main(){ float L = texture2D(uPressure, vL).x, R = texture2D(uPressure, vR).x, T = texture2D(uPressure, vT).x, B = texture2D(uPressure, vB).x; float d = texture2D(uDivergence, vUv).x;
          gl_FragColor = vec4((L+R+B+T-d)*0.25,0.,0.,1.); }`,
      gradient: `precision mediump float; varying vec2 vUv, vL, vR, vT, vB; uniform sampler2D uPressure, uVelocity;
        void main(){ float L = texture2D(uPressure, vL).x, R = texture2D(uPressure, vR).x, T = texture2D(uPressure, vT).x, B = texture2D(uPressure, vB).x; vec2 v = texture2D(uVelocity, vUv).xy; v -= vec2(R-L, T-B); gl_FragColor = vec4(v,0.,1.); }`,
      clear: `precision mediump float; varying vec2 vUv; uniform sampler2D uTexture; uniform float value; void main(){ gl_FragColor = value * texture2D(uTexture, vUv); }`,
      display: `precision highp float; varying vec2 vUv, vL, vR, vT, vB; uniform sampler2D uDye; uniform vec3 uBg; uniform float uStrength; uniform vec2 uRes; uniform float uTime;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        void main(){
          vec4 d = texture2D(uDye, vUv); float a = clamp(d.a, 0., 1.);
          vec3 pig = d.rgb / max(d.a, 1e-4);
          // gouache: boost saturation a little, deepen where thick
          float lum = dot(pig, vec3(.299,.587,.114)); pig = mix(vec3(lum), pig, 1.18);
          float cover = smoothstep(0.0, 1.1, a) * uStrength;
          vec3 col = mix(uBg, pig, cover);
          // impasto relief from thickness gradient
          float aL = texture2D(uDye, vL).a, aR = texture2D(uDye, vR).a, aT = texture2D(uDye, vT).a, aB = texture2D(uDye, vB).a;
          vec2 g = vec2(aR-aL, aT-aB);
          float light = 1.0 + (g.x*0.9 + g.y*1.3) * 0.9 * cover;
          col *= clamp(light, 0.9, 1.1);
          col -= 0.05 * cover * smoothstep(0.8, 1.6, d.a);
          // paper grain
          col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.014;
          gl_FragColor = vec4(col, 1.);
        }`
    };

    function compile(t, src) { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { throw new Error(gl.getShaderInfoLog(s)); } return s; }
    const vsh = compile(gl.VERTEX_SHADER, baseVS);
    function program(fsSrc) {
      const p = gl.createProgram(); gl.attachShader(p, vsh); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSrc)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
      return { p, u, use() { gl.useProgram(p); } };
    }
    const P = {}; for (const k in FS) P[k] = program(FS[k]);

    const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.BLEND);

    function fbo(w, h) {
      const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t);
      const f = linear ? gl.LINEAR : gl.NEAREST;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      return { t, fb, w, h, tx: 1 / w, ty: 1 / h, attach(id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, t); return id; } };
    }
    function dfbo(w, h) { let a = fbo(w, h), b = fbo(w, h); return { get read() { return a; }, get write() { return b; }, swap() { const t = a; a = b; b = t; }, w, h, tx: 1 / w, ty: 1 / h }; }
    function blit(target) {
      if (target) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb); gl.viewport(0, 0, target.w, target.h); }
      else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // --- config
    const palette = (canvas.dataset.colors || '#f5c518,#2457f5,#00a54f,#ff6b1a,#e8408c,#19b5e0').split(',').map(s => hex(s.trim()));
    const bg = hex(canvas.dataset.bg || '#f8f5ec');
    const strength = parseFloat(canvas.dataset.strength || '1');
    const auto = canvas.dataset.auto !== '0';
    const cfg = { simRes: 128, dyeRes: 640, dyeDiss: 0.28, velDiss: 0.3, pressure: 0.85, iters: 14, curl: 10, radius: 0.0035, force: 3200 };

    let velocity, dye, divergence, curl, pressure, w = 0, h = 0, aspect = 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    function resize() {
      const r = canvas.getBoundingClientRect();
      const cw = Math.max(2, Math.floor(r.width * dpr)), ch = Math.max(2, Math.floor(r.height * dpr));
      if (cw === w && ch === h) return;
      w = cw; h = ch; canvas.width = w; canvas.height = h; aspect = w / h;
      const simH = cfg.simRes, simW = Math.round(simH * aspect);
      const dyeH = Math.min(cfg.dyeRes, h), dyeW = Math.round(dyeH * aspect);
      velocity = dfbo(simW, simH); dye = dfbo(dyeW, dyeH); divergence = fbo(simW, simH); curl = fbo(simW, simH); pressure = dfbo(simW, simH);
    }
    resize(); window.addEventListener('resize', resize, { passive: true });

    function splat(x, y, dx, dy, color, size = 1, amount = 1) {
      P.splatV.use(); gl.uniform1i(P.splatV.u.uTarget, velocity.read.attach(0)); gl.uniform1f(P.splatV.u.aspect, aspect);
      gl.uniform2f(P.splatV.u.point, x, y); gl.uniform3f(P.splatV.u.color, dx, dy, 0); gl.uniform1f(P.splatV.u.radius, cfg.radius * size);
      gl.uniform2f(P.splatV.u.texelSize, velocity.tx, velocity.ty); blit(velocity.write); velocity.swap();
      P.splat.use(); gl.uniform1i(P.splat.u.uTarget, dye.read.attach(0)); gl.uniform1f(P.splat.u.aspect, aspect);
      gl.uniform2f(P.splat.u.point, x, y); gl.uniform3f(P.splat.u.color, color[0], color[1], color[2]); gl.uniform1f(P.splat.u.alpha, amount); gl.uniform1f(P.splat.u.radius, cfg.radius * size * 1.6);
      gl.uniform2f(P.splat.u.texelSize, dye.tx, dye.ty); blit(dye.write); dye.swap();
    }

    function step(dt) {
      P.curl.use(); gl.uniform2f(P.curl.u.texelSize, velocity.tx, velocity.ty); gl.uniform1i(P.curl.u.uVelocity, velocity.read.attach(0)); blit(curl);
      P.vorticity.use(); gl.uniform2f(P.vorticity.u.texelSize, velocity.tx, velocity.ty); gl.uniform1i(P.vorticity.u.uVelocity, velocity.read.attach(0)); gl.uniform1i(P.vorticity.u.uCurl, curl.attach(1)); gl.uniform1f(P.vorticity.u.curl, cfg.curl); gl.uniform1f(P.vorticity.u.dt, dt); blit(velocity.write); velocity.swap();
      P.divergence.use(); gl.uniform2f(P.divergence.u.texelSize, velocity.tx, velocity.ty); gl.uniform1i(P.divergence.u.uVelocity, velocity.read.attach(0)); blit(divergence);
      P.clear.use(); gl.uniform1i(P.clear.u.uTexture, pressure.read.attach(0)); gl.uniform1f(P.clear.u.value, cfg.pressure); blit(pressure.write); pressure.swap();
      P.pressure.use(); gl.uniform2f(P.pressure.u.texelSize, velocity.tx, velocity.ty); gl.uniform1i(P.pressure.u.uDivergence, divergence.attach(0));
      for (let i = 0; i < cfg.iters; i++) { gl.uniform1i(P.pressure.u.uPressure, pressure.read.attach(1)); blit(pressure.write); pressure.swap(); }
      P.gradient.use(); gl.uniform2f(P.gradient.u.texelSize, velocity.tx, velocity.ty); gl.uniform1i(P.gradient.u.uPressure, pressure.read.attach(0)); gl.uniform1i(P.gradient.u.uVelocity, velocity.read.attach(1)); blit(velocity.write); velocity.swap();
      P.advect.use(); gl.uniform2f(P.advect.u.texelSize, velocity.tx, velocity.ty); if (!linear) gl.uniform2f(P.advect.u.dyeTexelSize, velocity.tx, velocity.ty);
      gl.uniform1i(P.advect.u.uVelocity, velocity.read.attach(0)); gl.uniform1i(P.advect.u.uSource, velocity.read.attach(0)); gl.uniform1f(P.advect.u.dt, dt); gl.uniform1f(P.advect.u.dissipation, cfg.velDiss); blit(velocity.write); velocity.swap();
      if (!linear) gl.uniform2f(P.advect.u.dyeTexelSize, dye.tx, dye.ty);
      gl.uniform1i(P.advect.u.uVelocity, velocity.read.attach(0)); gl.uniform1i(P.advect.u.uSource, dye.read.attach(1)); gl.uniform1f(P.advect.u.dissipation, cfg.dyeDiss); blit(dye.write); dye.swap();
    }
    function render(t) {
      P.display.use(); gl.uniform2f(P.display.u.texelSize, dye.tx, dye.ty); gl.uniform1i(P.display.u.uDye, dye.read.attach(0));
      gl.uniform3f(P.display.u.uBg, bg[0], bg[1], bg[2]); gl.uniform1f(P.display.u.uStrength, strength); gl.uniform2f(P.display.u.uRes, w, h); gl.uniform1f(P.display.u.uTime, t % 100); blit(null);
    }

    // --- interaction
    let ci = 0; const nextColor = () => palette[(ci++) % palette.length];
    const pointer = { x: 0, y: 0, px: 0, py: 0, down: false, moved: false, color: nextColor(), t: 0 };
    const toUv = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height]; };
    window.addEventListener('pointermove', e => {
      const [x, y] = toUv(e); if (x < -0.1 || x > 1.1 || y < -0.1 || y > 1.1) return;
      pointer.px = pointer.x; pointer.py = pointer.y; pointer.x = x; pointer.y = y; pointer.moved = true;
      if (performance.now() - pointer.t > 900) { pointer.color = nextColor(); pointer.t = performance.now(); }
    }, { passive: true });

    // initial paint: a few big soft blobs so the canvas never starts empty
    const seeds = [[0.18, 0.62], [0.42, 0.3], [0.68, 0.7], [0.86, 0.35], [0.55, 0.52], [0.3, 0.85]];
    seeds.forEach(([x, y], i) => splat(x, y, (Math.random() - .5) * 400, (Math.random() - .5) * 400, palette[i % palette.length], 16, 0.7));

    // auto brush: a slow lissajous path that keeps stirring
    let bt = Math.random() * 10, last = performance.now(), running = true, idle = 0;
    const io = new IntersectionObserver(([e]) => { running = e.isIntersecting; if (running) { last = performance.now(); requestAnimationFrame(frame); } }); io.observe(canvas);

    function frame(now) {
      if (!running) return;
      const dt = Math.min(0.033, (now - last) / 1000) || 0.016; last = now;
      if (!reduce) {
        if (auto) {
          bt += dt * 0.35;
          const x = 0.5 + 0.42 * Math.sin(bt * 0.9) * Math.cos(bt * 0.37), y = 0.5 + 0.36 * Math.sin(bt * 0.63 + 1.2);
          const vx = Math.cos(bt * 0.9) * 0.9 - Math.sin(bt * 0.37) * 0.5, vy = Math.cos(bt * 0.63 + 1.2) * 0.63;
          idle += dt;
          if (idle > 0.08) { idle = 0; splat(x, y, vx * 900, vy * 900, palette[Math.floor(bt / 2.4) % palette.length], 5, 0.12); }
          if (Math.random() < dt * 0.3) splat(0.15 + Math.random() * 0.8, Math.random(), (Math.random() - .5) * 2200, (Math.random() - .5) * 2200, nextColor(), 10, 0.6);
        }
        if (pointer.moved) {
          pointer.moved = false; const dx = (pointer.x - pointer.px) * cfg.force, dy = (pointer.y - pointer.py) * cfg.force;
          if (Math.abs(dx) + Math.abs(dy) > 0.5) splat(pointer.x, pointer.y, dx, dy, pointer.color, 3, 0.35);
        }
        step(dt);
      }
      render(now / 1000);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    canvas.dataset.fluidReady = '1';
    return true;
  }

  canvases.forEach(c => {
    let ok = false;
    try { ok = initFluid(c); } catch (e) { console.warn('fluid fallback:', e.message); }
    if (!ok && window.BF_RIBBONS) window.BF_RIBBONS(c);
  });
})();
