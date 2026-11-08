/* BFSERV — WebGL ribbon hero
   Flowing vivid ribbons (green / yellow / blue / orange / magenta) over a sand-white field.
   Falls back to a CSS gradient when WebGL is unavailable. */
(() => {
  const canvas = document.querySelector('[data-hero-canvas]');
  if (!canvas) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) { canvas.style.background = 'linear-gradient(120deg,#f8f5ec,#fff3c2 40%,#dff5ea)'; return; }

  const vs = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
  const fs = `
  precision highp float;
  uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform float uIntensity;
  // --- noise
  vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
  vec2 mod289(vec2 x){return x-floor(x*(1./289.))*289.;}
  vec3 permute(vec3 x){return mod289(((x*34.)+1.)*x);}
  float snoise(vec2 v){
    const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
    vec2 i=floor(v+dot(v,C.yy)); vec2 x0=v-i+dot(i,C.xx);
    vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);
    vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1; i=mod289(i);
    vec3 p=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
    vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.); m=m*m; m=m*m;
    vec3 x=2.*fract(p*C.www)-1.; vec3 h=abs(x)-0.5; vec3 ox=floor(x+0.5); vec3 a0=x-ox;
    m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
    vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw; return 130.*dot(m,g);
  }
  float fbm(vec2 p){ float s=0.,a=.5; for(int i=0;i<4;i++){ s+=a*snoise(p); p=p*2.03+vec2(1.7,9.2); a*=.5;} return s; }

  float ribbon(vec2 uv, float base, float width, float phase, float t){
    float x = uv.x;
    float wave = sin(x*1.9 + phase + t*0.35)*0.12 + sin(x*0.7 - phase*0.5 + t*0.22)*0.08;
    float warp = fbm(vec2(x*0.9 + t*0.08, phase*0.3 + t*0.05))*0.16;
    float c = base + wave + warp;
    float d = abs(uv.y - c);
    float w = width * (0.75 + 0.35*sin(x*1.3 + phase + t*0.4));
    float core = 1.0 - smoothstep(0.0, w, d);
    float halo = 1.0 - smoothstep(w, w*2.6, d);
    return core*0.95 + halo*0.25;
  }

  void main(){
    vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
    float t = uTime;
    // mouse parallax
    uv += (uMouse - 0.5) * vec2(0.08, 0.05);
    // rotate so ribbons sweep diagonally (bottom-left -> top-right)
    float ang = -0.42;
    mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
    vec2 p = R * uv;
    p.x *= 0.85;
    p.x += t*0.06;

    vec3 bg = mix(vec3(0.973,0.961,0.925), vec3(0.992,0.988,0.976), smoothstep(-0.6,0.6,uv.y));
    vec3 col = bg;

    vec3 cGreen=vec3(0.0,0.647,0.31), cYellow=vec3(0.96,0.773,0.094), cBlue=vec3(0.141,0.341,0.96),
         cOrange=vec3(1.0,0.42,0.10), cMagenta=vec3(0.91,0.25,0.55), cCyan=vec3(0.098,0.71,0.878);

    float k = uIntensity;
    float r1 = ribbon(p, -0.46, 0.075, 0.0, t)*k;
    float r2 = ribbon(p, -0.30, 0.055, 1.6, t)*k;
    float r3 = ribbon(p, -0.16, 0.085, 3.1, t)*k;
    float r4 = ribbon(p, -0.02, 0.05, 4.4, t)*k;
    float r5 = ribbon(p,  0.12, 0.07, 5.9, t)*k;
    float r6 = ribbon(p,  0.30, 0.045, 7.3, t)*k;

    col = mix(col, cYellow, r1);
    col = mix(col, cOrange, r2*0.95);
    col = mix(col, cMagenta, r3*0.9);
    col = mix(col, cBlue, r4*0.92);
    col = mix(col, cGreen, r5*0.95);
    col = mix(col, cCyan, r6*0.9);

    // soft light/shadow edge for a silky, 3D-ish ribbon look
    float shade = fbm(p*3.0 + t*0.1)*0.08;
    col += shade * (r1+r2+r3+r4+r5+r6) * 0.6;

    // vignette toward the top-left so headline stays readable
    float v = smoothstep(-0.9, 0.5, uv.x + uv.y*0.4);
    col = mix(bg, col, 0.35 + 0.65*v);
    gl_FragColor = vec4(col, 1.0);
  }`;

  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, 'uRes'), uTime = gl.getUniformLocation(prog, 'uTime'),
        uMouse = gl.getUniformLocation(prog, 'uMouse'), uInt = gl.getUniformLocation(prog, 'uIntensity');

  let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  function resize() {
    const r = canvas.getBoundingClientRect();
    w = Math.max(1, Math.floor(r.width * dpr)); h = Math.max(1, Math.floor(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  }
  resize(); window.addEventListener('resize', resize, { passive: true });

  const mouse = { x: .5, y: .5, tx: .5, ty: .5 };
  window.addEventListener('pointermove', e => { mouse.tx = e.clientX / innerWidth; mouse.ty = 1 - e.clientY / innerHeight; }, { passive: true });

  let intensity = 0, running = true, start = performance.now();
  const io = new IntersectionObserver(([e]) => { running = e.isIntersecting; if (running) requestAnimationFrame(frame); }, { threshold: 0 });
  io.observe(canvas);

  function frame(now) {
    if (!running) return;
    const t = (now - start) / 1000;
    intensity += (1 - intensity) * 0.03;
    mouse.x += (mouse.tx - mouse.x) * 0.06; mouse.y += (mouse.ty - mouse.y) * 0.06;
    gl.uniform2f(uRes, w, h); gl.uniform1f(uTime, reduce ? 0 : t); gl.uniform2f(uMouse, mouse.x, mouse.y); gl.uniform1f(uInt, intensity);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduce || intensity < 0.99) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
