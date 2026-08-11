import { EventEmitter } from '../utils/EventEmitter.js';

/**
 * Raw browser events, normalised. Emits:
 *   key(code)        a key going down, once per press
 *   cast             left button released over the stage
 *   cancel           Esc or a right click that was not a drag
 *   orbit({dx,dy})   right-button drag
 *   zoom(delta)
 *   pointer({x,y})   normalised device coordinates
 */
export class InputManager extends EventEmitter {
  constructor(canvas) {
    super();
    this.canvas = canvas;
    this.pointer = { x: 0, y: 0 };
    this.dragging = false;
    this._dragMoved = 0;
    this._last = { x: 0, y: 0 };
    this._down = new Set();

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      // Never steal keys from the editor's number fields.
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      this._down.add(e.code);
      if (e.code === 'Escape') this.emit('cancel');
      this.emit('key', e.code);
    });

    window.addEventListener('keyup', (e) => this._down.delete(e.code));

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      this._last.x = e.clientX;
      this._last.y = e.clientY;
      if (e.button === 2) {
        this.dragging = true;
        this._dragMoved = 0;
      }
    });

    window.addEventListener('pointermove', (e) => {
      const dx = e.clientX - this._last.x;
      const dy = e.clientY - this._last.y;
      this._last.x = e.clientX;
      this._last.y = e.clientY;

      this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.emit('pointer', this.pointer);

      if (this.dragging) {
        this._dragMoved += Math.abs(dx) + Math.abs(dy);
        this.emit('orbit', { dx, dy });
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (e.button === 2) {
        // A right click that did not really move the camera means "cancel".
        if (this._dragMoved < 6) this.emit('cancel');
        this.dragging = false;
      } else if (e.button === 0) {
        this.emit('cast');
      }
    });

    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.emit('zoom', e.deltaY);
      },
      { passive: false }
    );

    window.addEventListener('blur', () => {
      this.dragging = false;
      this._down.clear();
    });
  }

  isDown(code) {
    return this._down.has(code);
  }
}
