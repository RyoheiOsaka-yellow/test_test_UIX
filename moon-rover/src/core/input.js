/* ============================================================
   INPUT — keyboard, mouse, gamepad, touch

   Everything upstream reads named actions, never key codes, so the
   thumbsticks and the gamepad feed the same fields the keyboard does.
   ============================================================ */

const KEY_ACTIONS = {
  KeyW: 'fwd', ArrowUp: 'fwd',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'brake',
  KeyX: 'right_self',
  KeyG: 'radar',
  KeyR: 'arm',
  KeyB: 'beacon',
  KeyT: 'array',
  KeyE: 'interact',
  KeyF: 'lamp',
  KeyC: 'camera',
  KeyP: 'photo',
  KeyH: 'hud',
  Tab: 'codex',
  Escape: 'pause'
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = Object.create(null);      // held
    this.pressed = Object.create(null);   // edge, cleared each frame
    this.mouse = { dx: 0, dy: 0, wheel: 0, left: false, leftEdge: false, x: 0, y: 0 };
    this.stickL = { x: 0, y: 0, active: false };
    this.stickR = { x: 0, y: 0, active: false };
    this.touchButtons = Object.create(null);
    this.hasTouchControls = false;
    this.pointerLocked = false;
    this.enabled = true;
    this._bind();
  }

  _bind() {
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const a = KEY_ACTIONS[e.code];
      // Tab and Space would otherwise walk the DOM or scroll the page.
      if (a === 'codex' || e.code === 'Space') stop(e);
      if (!a || !this.enabled) return;
      this.down[a] = true;
      this.pressed[a] = true;
    });

    window.addEventListener('keyup', (e) => {
      const a = KEY_ACTIONS[e.code];
      if (a) this.down[a] = false;
    });

    window.addEventListener('blur', () => {
      for (const k in this.down) this.down[k] = false;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouse.left = true;
        this.mouse.leftEdge = true;
        if (!this.pointerLocked && this.enabled) this.canvas.requestPointerLock?.();
      }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.left = false; });

    window.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        this.mouse.dx += e.movementX;
        this.mouse.dy += e.movementY;
      }
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.mouse.wheel += Math.sign(e.deltaY);
    }, { passive: false });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });

    window.addEventListener('contextmenu', (e) => {
      if (e.target === this.canvas) e.preventDefault();
    });
  }

  /* The thumbstick widgets call these; the question that matters for
     HUD layout is whether sticks are on screen right now, not whether
     the browser reports a coarse pointer. */
  setStick(which, x, y, active) {
    const s = which === 'left' ? this.stickL : this.stickR;
    s.x = x; s.y = y; s.active = active;
  }

  setTouchButton(action, held) {
    if (held && !this.touchButtons[action]) this.pressed[action] = true;
    this.touchButtons[action] = held;
    if (held) this.down[action] = true; else this.down[action] = false;
  }

  _pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const dead = (v) => (Math.abs(v) < 0.16 ? 0 : (v - Math.sign(v) * 0.16) / 0.84);
      const lx = dead(p.axes[0] || 0), ly = dead(p.axes[1] || 0);
      const rx = dead(p.axes[2] || 0), ry = dead(p.axes[3] || 0);
      if (lx || ly) { this.stickL.x = lx; this.stickL.y = -ly; this.stickL.active = true; }
      if (rx || ry) { this.stickR.x = rx; this.stickR.y = -ry; this.stickR.active = true; }
      const trig = (p.buttons[7]?.value || 0) - (p.buttons[6]?.value || 0);
      if (Math.abs(trig) > 0.05) this.stickL.y = trig;
      const btn = (i) => !!p.buttons[i]?.pressed;
      const map = { 0: 'radar', 1: 'brake', 2: 'arm', 3: 'lamp', 4: 'camera', 5: 'beacon', 9: 'pause', 8: 'codex' };
      for (const i in map) {
        const a = map[i];
        const held = btn(Number(i));
        if (held && !this.down['pad_' + a]) this.pressed[a] = true;
        this.down['pad_' + a] = held;
        if (held) this.down[a] = true;
      }
      break;
    }
  }

  /* Composite axes: keyboard OR stick, whichever is asking. */
  begin() {
    this.stickL.active = false; this.stickR.active = false;
    if (!this.hasTouchControls) { this.stickL.x = this.stickL.y = 0; this.stickR.x = this.stickR.y = 0; }
    this._pollGamepad();

    let ty = (this.down.fwd ? 1 : 0) - (this.down.back ? 1 : 0);
    let tx = (this.down.right ? 1 : 0) - (this.down.left ? 1 : 0);
    if (this.stickL.x || this.stickL.y) { tx = this.stickL.x; ty = this.stickL.y; }
    this.throttle = Math.max(-1, Math.min(1, ty));
    this.steer = Math.max(-1, Math.min(1, tx));
    this.lookX = this.mouse.dx * 0.0026 + this.stickR.x * 0.045;
    this.lookY = this.mouse.dy * 0.0026 - this.stickR.y * 0.045;
    this.zoom = this.mouse.wheel;
  }

  end() {
    this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0;
    this.mouse.leftEdge = false;
    for (const k in this.pressed) this.pressed[k] = false;
  }

  took(action) {
    if (this.pressed[action]) { this.pressed[action] = false; return true; }
    return false;
  }
}
