// The gallery: every species playing live from its own code. A click opens one with its names and story,
// backdrops, recolors, a mirror, and a sprite sheet to download.

import { species, categories } from "../src/species/index.js";
import { createFrame, clearFrame, createCreature, composite, backdrop, BACKDROPS, PAL } from "../src/core/index.js";

const REPO = "https://github.com/RyoheiOsaka-yellow/test_test_UIX/blob/main/pixelsea";
const ALL = Object.entries(species).map(([id, mod]) => ({ id, cat: id.split("/")[0], mod, meta: { fps: 30, bg: "deep", loop: true, duration: 1, tags: [], options: {}, ...mod.meta } }));
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s) => document.querySelector(s);
function el(tag, props = {}, kids = []) {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of [].concat(kids)) e.append(k);
  return e;
}

// ---- a live species on a canvas, at art-pixel size; CSS scales it up
class Player {
  constructor(canvas, sp, pad = 1.15) {
    Object.assign(this, { canvas, sp, ctx: canvas.getContext("2d"), opts: {}, flip: false, speed: 1, playing: !reduced, acc: 0 });
    this.bg = sp.meta.bg;
    this.layout(pad);
  }
  layout(pad) {
    const [w, h] = this.sp.meta.size, [ox, oy] = this.sp.meta.origin, aspect = 4 / 3;
    this.W = Math.ceil(Math.max(w * pad, h * pad * aspect));
    this.H = Math.ceil(this.W / aspect);
    this.x = Math.floor((this.W - w) / 2) + ox;
    this.y = Math.floor((this.H - h) / 2) + oy;
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.frame = createFrame(this.W, this.H);
    this.img = this.ctx.createImageData(this.W, this.H);
    this.setBg(this.bg);
    this.restart();
  }
  setBg(kind) {
    this.bg = kind;
    const floor = this.y - this.sp.meta.origin[1] + (this.sp.meta.floor ?? this.sp.meta.size[1] * 0.35);
    this.bgBuf = kind === "none" ? null : backdrop(kind, this.W, this.H, floor);
    this.dirty = true;
  }
  restart() {
    this.inst = createCreature(this.sp.mod, { x: this.x, y: this.y, flip: this.flip, ...this.opts });
    this.dirty = true;
  }
  tick(dt) {
    const step = 1 / this.sp.meta.fps;
    if (this.playing) this.acc = Math.min(this.acc + dt * this.speed, 0.25);
    let moved = false;
    while (this.acc >= step) {
      this.acc -= step;
      this.inst.update(step);
      moved = true;
    }
    if (moved || this.dirty) this.render();
  }
  render() {
    const f = clearFrame(this.frame);
    this.inst.draw(f);
    composite(f, this.img.data, this.bgBuf);
    this.ctx.putImageData(this.img, 0, 0);
    this.dirty = false;
  }
}

// ---- tiles
const tiles = [], sections = [];
function build() {
  $("#count").textContent = ALL.length;
  const main = $("#grid");
  for (const c of categories) {
    const list = ALL.filter((s) => s.cat === c.id);
    if (!list.length) continue;
    const grid = el("div", { className: "grid" });
    const sec = el("section", { id: c.id }, [el("div", { className: "section-head" }, [el("h2", { textContent: `${c.ja} ${c.name}.` }), el("p", { textContent: c.blurb })]), grid]);
    sections.push({ c, sec, list });
    for (const sp of list) {
      const cv = el("canvas", { ariaLabel: sp.meta.ja });
      const tile = el("button", { className: "tile", type: "button" }, [cv, el("div", { className: "cap" }, [
        el("div", { className: "ja", textContent: sp.meta.ja }), el("div", { className: "en", textContent: sp.meta.name }), el("div", { className: "sci", textContent: sp.meta.sci }),
      ])]);
      tile.addEventListener("click", () => open(sp));
      grid.append(tile);
      const t = { sp, tile, cv, player: null, visible: false, text: `${sp.id} ${sp.meta.name} ${sp.meta.ja} ${sp.meta.sci} ${sp.meta.region} ${sp.meta.tags.join(" ")}`.toLowerCase() };
      tiles.push(t);
    }
    main.append(sec);
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const t = tiles.find((t) => t.tile === e.target);
      if (!t) continue;
      t.visible = e.isIntersecting;
      if (t.visible && !t.player) t.player = new Player(t.cv, t.sp);
    }
  }, { rootMargin: "200px" });
  for (const t of tiles) io.observe(t.tile);
}

// ---- chips and search
let cat = "all", q = "";
function filter() {
  let shown = 0;
  for (const s of sections) {
    let n = 0;
    for (const t of tiles.filter((t) => t.sp.cat === s.c.id)) {
      const ok = (cat === "all" || t.sp.cat === cat) && (!q || t.text.includes(q));
      t.tile.hidden = !ok;
      if (ok) n++;
    }
    s.sec.hidden = n === 0;
    shown += n;
  }
  $("#none").hidden = shown > 0;
}
function chips() {
  const box = $("#chips");
  const mk = (id, label) => {
    const b = el("button", { className: "chip", type: "button", textContent: label });
    b.setAttribute("aria-pressed", id === cat);
    b.addEventListener("click", () => { cat = id; [...box.children].forEach((c) => c.setAttribute("aria-pressed", c === b)); filter(); });
    return b;
  };
  box.append(mk("all", `すべて ${ALL.length}`));
  for (const c of categories) box.append(mk(c.id, `${c.ja} ${c.name} ${ALL.filter((s) => s.cat === c.id).length}`));
  $("#q").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); filter(); });
}

// ---- the detail sheet
let big = null, cur = null;
const PALS = { default: null, ...PAL };
function open(sp) {
  cur = sp;
  const m = sp.meta, d = $("#detail");
  $("#d-name").textContent = `${m.ja} · ${m.name}`;
  $("#d-sci").textContent = m.sci;
  $("#d-id").textContent = sp.id;
  $("#d-jadesc").textContent = m.jadesc ?? "";
  $("#d-desc").textContent = m.desc ?? "";
  const facts = $("#d-facts");
  facts.replaceChildren();
  for (const [k, v] of [["生息域 region", m.region], ["大きさ size", m.length], ["canvas", `${m.size[0]}×${m.size[1]} px · origin ${m.origin.join(",")}`], ["loop", `${m.duration} s · ${m.fps} fps`], ["tags", m.tags.join(", ")]])
    facts.append(el("dt", { textContent: k }), el("dd", { textContent: Array.isArray(v) ? v.join("×") : v }));
  big = new Player($("#big"), sp, 1.25);
  $("#d-play").textContent = big.playing ? "pause" : "play";
  const bgs = $("#d-bg");
  bgs.replaceChildren(...BACKDROPS.map((k) => {
    const b = el("button", { className: "btn", type: "button", textContent: k });
    b.setAttribute("aria-pressed", k === big.bg);
    b.addEventListener("click", () => { big.setBg(k); [...bgs.children].forEach((c) => c.setAttribute("aria-pressed", c === b)); });
    return b;
  }));
  const spd = $("#d-speed");
  spd.replaceChildren(...[0.25, 0.5, 1, 2].map((k) => {
    const b = el("button", { className: "btn", type: "button", textContent: `${k}×` });
    b.setAttribute("aria-pressed", k === 1);
    b.addEventListener("click", () => { big.speed = k; [...spd.children].forEach((c) => c.setAttribute("aria-pressed", c === b)); });
    return b;
  }));
  const pal = $("#d-pal");
  pal.replaceChildren(...Object.keys(PALS).map((k) => el("option", { value: k, textContent: k })));
  pal.value = "default";
  $("#d-flip").setAttribute("aria-pressed", "false");
  $("#d-scene").setAttribute("aria-pressed", "true");
  $("#d-sheet").className = "sheetout";
  $("#d-sheet").replaceChildren();
  $("#d-src").href = `${REPO}/src/species/${sp.id}.js`;
  code();
  d.showModal();
}
function code() {
  const o = big.opts, m = cur.meta, name = cur.id.split("/")[1].replace(/-(\w)/g, (_, c) => c.toUpperCase());
  const extra = Object.keys(o).length ? `, ${JSON.stringify(o).slice(1, -1)}` : "";
  $("#d-code").textContent = `import { createFrame, createCreature, composite } from "pixelsea";
import * as ${name} from "pixelsea/species/${cur.id}.js";

const frame = createFrame(${m.size[0]}, ${m.size[1]});           // your game's pixel resolution
const it = createCreature(${name}, { x: ${m.origin[0]}, y: ${m.origin[1]}${extra} });
// each frame:
it.update(dt); it.draw(frame); composite(frame, imageData.data);
// or: node tools/render.mjs ${cur.id} --sheet   (PNG + JSON sprite sheet)`;
}
function sheet() {
  const m = cur.meta, [w, h] = m.size, [ox, oy] = m.origin, n = Math.round(m.duration * m.fps);
  const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
  const cv = el("canvas", { width: cols * w, height: rows * h }), ctx = cv.getContext("2d"), f = createFrame(w, h), img = ctx.createImageData(w, h);
  const inst = createCreature(cur.mod, { x: ox, y: oy, flip: big.flip, ...big.opts, scene: false }), frames = {};
  for (let i = 0; i < n; i++) {
    inst.t = i / m.fps;
    clearFrame(f);
    inst.draw(f);
    composite(f, img.data, null);
    const x = (i % cols) * w, y = Math.floor(i / cols) * h;
    ctx.putImageData(img, x, y);
    frames[`${cur.id} ${i}`] = { frame: { x, y, w, h }, duration: Math.round(1000 / m.fps) };
  }
  const json = { frames, meta: { app: "pixelsea", image: `${cur.id.split("/")[1]}.png`, size: { w: cv.width, h: cv.height }, pixelsea: { id: cur.id, ja: m.ja, name: m.name, sci: m.sci, fps: m.fps, loop: true, columns: cols, pivot: { x: ox, y: oy } } } };
  const out = $("#d-sheet");
  out.className = "sheetout on";
  const png = cv.toDataURL("image/png"), name = cur.id.split("/")[1];
  out.replaceChildren(
    el("img", { src: png, alt: `${m.name} sprite sheet`, style: `width:${Math.min(cv.width * 2, 600)}px` }),
    el("div", {}, [
      el("p", { textContent: `${n} frames · ${w}×${h} px · ${cols} columns` }),
      el("a", { className: "btn", href: png, download: `${name}.png`, textContent: `download ${name}.png` }), " ",
      el("a", { className: "btn", href: "data:application/json," + encodeURIComponent(JSON.stringify(json, null, 2)), download: `${name}.json`, textContent: `download ${name}.json` }),
    ]),
  );
}
$("#d-close").addEventListener("click", () => $("#detail").close());
$("#detail").addEventListener("close", () => { big = null; });
$("#d-play").addEventListener("click", (e) => { big.playing = !big.playing; e.target.textContent = big.playing ? "pause" : "play"; });
$("#d-seed").addEventListener("click", () => { big.opts.seed = 1 + Math.floor(Math.random() * 999); big.restart(); code(); });
$("#d-pal").addEventListener("change", (e) => { const k = e.target.value; if (k === "default") delete big.opts.palette; else big.opts.palette = PALS[k]; big.restart(); code(); });
$("#d-flip").addEventListener("click", (e) => { big.flip = !big.flip; e.target.setAttribute("aria-pressed", big.flip); big.restart(); });
$("#d-make").addEventListener("click", sheet);
$("#d-scene").addEventListener("click", (e) => { const on = big.opts.scene === false; if (on) delete big.opts.scene; else big.opts.scene = false; e.target.setAttribute("aria-pressed", on); big.restart(); code(); });
$("#d-copy").addEventListener("click", () => navigator.clipboard?.writeText($("#d-code").textContent));

// ---- the loop
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  for (const t of tiles) if (t.visible && t.player && !t.tile.hidden) t.player.tick(dt);
  if (big) big.tick(dt);
  requestAnimationFrame(loop);
}
build();
chips();
filter();
requestAnimationFrame(loop);
