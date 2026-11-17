/* BFSERV — soft pastel "bubble" background (replaces the ink fluid on hero areas)
   <canvas data-blobs data-colors="#00a54f,#19b5e0,..." data-bg="#f4efe4" data-mix=".42">
   - 7 round blobs drift on slow, looping paths and merge softly (metaball field)
   - colours are pastelised (mixed toward white by data-mix) for a light, friendly feel
   - one blob gently follows the pointer; edges stay soft, no texture or relief
   - starts only when visible, pauses off-screen, static frame for prefers-reduced-motion */
(() => {
  const canvases = document.querySelectorAll('canvas[data-blobs]');
  if (!canvases.length) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hex = h => { const n = parseInt(String(h).trim().replace('#', ''), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  const N = 7;

  const VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }';
  const FS = `
  precision highp float;
  uniform vec2 uRes; uniform float uTime; uniform vec3 uBg; uniform vec3 uCol[${N}]; uniform vec3 uBlob[${N}]; uniform float uFade;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y;
    vec2 q = vec2(uv.x * asp, uv.y);
    float field = 0.; vec3 acc = vec3(0.); float wsum = 0.;
    for (int i = 0; i < ${N}; i++) {
      vec2 c = vec2(uBlob[i].x * asp, uBlob[i].y); float r = uBlob[i].z;
      vec2 d = q - c; float dd = dot(d, d) + 1e-4;
      float f = (r * r) / dd;              // metaball influence
      field += f;
      float w = pow(f, 3.);                 // dominant blob wins the colour; smooth blend where they touch
      acc += uCol[i] * w; wsum += w;
    }
    vec3 col = acc / max(wsum, 1e-4);
    // one clean, slightly soft round edge (no halo ring)
    float px = 1.5 / uRes.y;
    float a = smoothstep(1.0 - 0.06 - px * 40., 1.0 + 0.06, field) * 0.9 * uFade;
    // soft inner light toward the top-left of each bubble, like a balloon
    float hl = smoothstep(1.0, 2.6, field) * 0.07;
    vec3 outc = mix(uBg, col + hl, a);
    outc += (hash(gl_FragCoord.xy) - .5) / 255.;            // dither only, avoids banding
    gl_FragColor = vec4(outc, 1.);
  }`;

  function init(canvas) {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false });
    if (!gl) return false;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = n => gl.getUniformLocation(pr, n);
    const uRes = U('uRes'), uTime = U('uTime'), uBg = U('uBg'), uCol = U('uCol'), uBlob = U('uBlob'), uFade = U('uFade');

    const mixAmt = parseFloat(canvas.dataset.mix || '0.42');
    const base = (canvas.dataset.colors || '#00a54f,#19b5e0,#e8408c,#ff8a4c,#7b6cf6,#2457f5,#7fd8a8').split(',').map(hex);
    const cols = []; for (let i = 0; i < N; i++) { const c = base[i % base.length]; cols.push(...c.map(v => v + (1 - v) * mixAmt)); }
    const bg = hex(canvas.dataset.bg || '#f4efe4');
    gl.uniform3fv(uCol, new Float32Array(cols)); gl.uniform3f(uBg, bg[0], bg[1], bg[2]);

    // each blob: centre, radius, speed and phase for a slow looping path
    const seed = [...Array(N)].map((_, i) => ({
      cx: 0.12 + (i / (N - 1)) * 0.82, cy: 0.25 + ((i * 37) % 10) / 18,
      ax: 0.06 + (i % 3) * 0.035, ay: 0.08 + ((i + 1) % 3) * 0.03,
      sx: 0.11 + i * 0.017, sy: 0.09 + i * 0.013, ph: i * 1.7,
      r: 0.085 + ((i * 53) % 7) / 100
    }));
    const pointer = { x: 0.72, y: 0.5, tx: 0.72, ty: 0.5, active: 0 };
    window.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height;
      if (x < -0.05 || x > 1.05 || y < -0.05 || y > 1.05) { pointer.active = 0; return; }
      pointer.tx = x; pointer.ty = y; pointer.active = 1;
    }, { passive: true });

    let w = 0, h = 0; const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    function resize() { const r = canvas.getBoundingClientRect(); const cw = Math.max(2, Math.floor(r.width * dpr)), ch = Math.max(2, Math.floor(r.height * dpr)); if (cw !== w || ch !== h) { w = cw; h = ch; canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); } }
    resize(); window.addEventListener('resize', resize, { passive: true });

    const blob = new Float32Array(N * 3); let fade = 0, start = performance.now(), running = true;
    const io = new IntersectionObserver(([e]) => { const was = running; running = e.isIntersecting; if (running && !was) requestAnimationFrame(frame); }); io.observe(canvas);
    function frame(now) {
      if (!running) return;
      const t = reduce ? 4 : (now - start) / 1000;
      fade += (1 - fade) * 0.04;
      pointer.x += (pointer.tx - pointer.x) * 0.045; pointer.y += (pointer.ty - pointer.y) * 0.045;
      seed.forEach((s, i) => {
        let x = s.cx + Math.sin(t * s.sx + s.ph) * s.ax + Math.sin(t * s.sx * 0.53 + s.ph * 2.1) * s.ax * 0.5;
        let y = s.cy + Math.cos(t * s.sy + s.ph) * s.ay + Math.sin(t * s.sy * 0.71 + s.ph) * s.ay * 0.4;
        let r = s.r * (1 + Math.sin(t * 0.6 + s.ph) * 0.06);          // gentle "breathing"
        if (i === 0) { const k = pointer.active ? 0.85 : 0; x = x + (pointer.x - x) * k; y = y + (pointer.y - y) * k; r *= 0.85; }
        blob[i * 3] = x; blob[i * 3 + 1] = y; blob[i * 3 + 2] = r;
      });
      gl.uniform2f(uRes, w, h); gl.uniform1f(uTime, t); gl.uniform1f(uFade, fade); gl.uniform3fv(uBlob, blob);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduce || fade < 0.99) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    canvas.dataset.blobsReady = '1';
    return true;
  }

  const boot = c => { if (c.dataset.blobsBooted) return; c.dataset.blobsBooted = '1'; let ok = false; try { ok = init(c); } catch (e) { console.warn('blobs:', e.message); } if (!ok) c.style.background = 'radial-gradient(circle at 70% 40%, #cdeedd, transparent 40%), radial-gradient(circle at 85% 70%, #ffd6e6, transparent 35%)'; };
  const lazy = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && e.boundingClientRect.width > 0) { boot(e.target); lazy.unobserve(e.target); } }));
  canvases.forEach(c => lazy.observe(c));
})();
