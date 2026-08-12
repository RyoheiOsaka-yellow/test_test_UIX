/* ============================================================
   GL — a thin WebGL2 layer

   There is no scene graph and no material system here on purpose.
   Each renderer owns its own program and its own draw call, and this
   file only removes the boilerplate: compiling, uniform reflection,
   vertex array setup, textures, and the framebuffer sizing rule.
   ============================================================ */

export function createContext(canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,          // resolved by the pixel budget, not MSAA on the default FB
    depth: true,
    stencil: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
    desynchronized: false
  });
  if (!gl) throw new Error('WebGL2 is required and this browser did not give us a context.');

  const ext = {
    colorFloat: gl.getExtension('EXT_color_buffer_float'),
    floatLinear: gl.getExtension('OES_texture_float_linear'),
    aniso: gl.getExtension('EXT_texture_filter_anisotropic')
  };
  gl.__ext = ext;
  gl.__maxAniso = ext.aniso ? gl.getParameter(ext.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1;
  return gl;
}

/* ---------- programs ---------- */

function compile(gl, type, src, label) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) || '';
    // Line numbers in the driver log are worthless without the source.
    const listing = src.split('\n').map((l, i) => `${String(i + 1).padStart(4)}| ${l}`).join('\n');
    gl.deleteShader(sh);
    throw new Error(`${label} shader failed to compile:\n${log}\n${listing}`);
  }
  return sh;
}

/* Returns a program object with a `u` map of uniform setters resolved
   once at link time, so draw code never calls getUniformLocation. */
export function createProgram(gl, vsSrc, fsSrc, label = 'program') {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc, `${label} vertex`);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc, `${label} fragment`);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`${label} failed to link:\n${log}`);
  }

  const u = Object.create(null);
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(prog, i);
    // Array uniforms report as "name[0]"; store them under the bare name.
    const name = info.name.replace(/\[0\]$/, '');
    u[name] = gl.getUniformLocation(prog, info.name);
  }

  const a = Object.create(null);
  const na = gl.getProgramParameter(prog, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < na; i++) {
    const info = gl.getActiveAttrib(prog, i);
    a[info.name] = gl.getAttribLocation(prog, info.name);
  }

  return { prog, u, a, label, use() { gl.useProgram(prog); return this; } };
}

/* ---------- buffers and vertex arrays ---------- */

export function buffer(gl, data, target = gl.ARRAY_BUFFER, usage = gl.STATIC_DRAW) {
  const b = gl.createBuffer();
  gl.bindBuffer(target, b);
  gl.bufferData(target, data, usage);
  gl.bindBuffer(target, null);
  return b;
}

/* attribs: [{ buffer, loc, size, type?, stride?, offset?, divisor?, integer? }] */
export function vao(gl, attribs, indexBuffer = null) {
  const v = gl.createVertexArray();
  gl.bindVertexArray(v);
  for (const at of attribs) {
    if (at.loc < 0) continue;         // attribute optimised out of the shader
    gl.bindBuffer(gl.ARRAY_BUFFER, at.buffer);
    gl.enableVertexAttribArray(at.loc);
    const type = at.type ?? gl.FLOAT;
    if (at.integer) {
      gl.vertexAttribIPointer(at.loc, at.size, type, at.stride || 0, at.offset || 0);
    } else {
      gl.vertexAttribPointer(at.loc, at.size, type, at.normalized || false, at.stride || 0, at.offset || 0);
    }
    if (at.divisor) gl.vertexAttribDivisor(at.loc, at.divisor);
  }
  if (indexBuffer) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  return v;
}

/* ---------- textures ---------- */

export function texture2D(gl, opts) {
  const {
    width, height, internalFormat, format, type, data = null,
    min = gl.LINEAR, mag = gl.LINEAR,
    wrapS = gl.CLAMP_TO_EDGE, wrapT = gl.CLAMP_TO_EDGE,
    levels = 1, aniso = 0
  } = opts;
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texStorage2D(gl.TEXTURE_2D, levels, internalFormat, width, height);
  if (data) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, format, type, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mag);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
  if (aniso && gl.__ext.aniso) {
    gl.texParameterf(gl.TEXTURE_2D, gl.__ext.aniso.TEXTURE_MAX_ANISOTROPY_EXT,
      Math.min(aniso, gl.__maxAniso));
  }
  gl.bindTexture(gl.TEXTURE_2D, null);
  return t;
}

export function rgbaTexture(gl, width, height, pixels, { mips = true, wrap } = {}) {
  const w = wrap ?? gl.REPEAT;
  const levels = mips ? 1 + Math.floor(Math.log2(Math.max(width, height))) : 1;
  const t = texture2D(gl, {
    width, height,
    internalFormat: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE,
    data: pixels, levels,
    min: mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR,
    wrapS: w, wrapT: w, aniso: 8
  });
  if (mips) {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
  return t;
}

export function bindTextures(gl, list) {
  for (let i = 0; i < list.length; i++) {
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(list[i].target || gl.TEXTURE_2D, list[i].tex);
    if (list[i].loc) gl.uniform1i(list[i].loc, i);
  }
}

/* ---------- render targets ---------- */

export function createTarget(gl, width, height, { float = true, depth = true } = {}) {
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  const color = texture2D(gl, {
    width, height,
    internalFormat: float ? gl.RGBA16F : gl.RGBA8,
    format: gl.RGBA, type: float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
    min: gl.LINEAR, mag: gl.LINEAR
  });
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
  let depthBuf = null;
  if (depth) {
    depthBuf = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuf);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, width, height);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuf);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return {
    fbo, color, depth: depthBuf, width, height,
    dispose() {
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(color);
      if (depthBuf) gl.deleteRenderbuffer(depthBuf);
    }
  };
}

/* A single triangle covering the viewport. Cheaper than a quad and it
   avoids the diagonal seam in the rasteriser's derivative estimates. */
export function fullscreenVAO(gl) {
  const v = gl.createVertexArray();
  return v;   // drawn with drawArrays(TRIANGLES, 0, 3) and gl_VertexID
}

export const FULLSCREEN_VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/* ---------- the pixel budget ----------

   Capping by devicePixelRatio is the obvious thing and it is wrong.
   A 1710-point-wide window at dpr 2 is 7.3 megapixels, and this
   fragment shader ray-marches. Cap the total pixel count instead:
   the framebuffer still lands above native CSS resolution on a Retina
   panel, at a third of the cost. */
export function pixelScale(cssW, cssH, budgetPixels, maxDpr) {
  let px = Math.min(window.devicePixelRatio || 1, maxDpr);
  const over = (cssW * cssH * px * px) / budgetPixels;
  if (over > 1) px /= Math.sqrt(over);
  return px;
}
