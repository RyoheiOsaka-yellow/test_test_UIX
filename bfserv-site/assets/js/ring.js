/* BFSERV — 3D ring (cylinder) carousel for client logos
   Usage: <div class="ring-stage" data-ring data-src="../assets/logos/" data-items="p32_001.png,...">
   - auto rotation, pointer drag with inertia, keyboard arrows, prev/next buttons
   - cards are hexagon tiles; back-facing cards dim and shrink for depth */
(() => {
  const stages = document.querySelectorAll('[data-ring]');
  if (!stages.length) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  stages.forEach(stage => {
    const src = stage.dataset.src || '';
    const items = (stage.dataset.items || '').split(',').map(s => s.trim()).filter(Boolean);
    const names = (stage.dataset.names || '').split('|');
    const n = items.length; if (!n) return;

    const ring = document.createElement('div'); ring.className = 'ring';
    const cards = [];
    items.forEach((file, i) => {
      const it = document.createElement('div'); it.className = 'ring__item';
      const card = document.createElement('div'); card.className = 'ring__card';
      const img = document.createElement('img'); img.src = src + file; img.alt = names[i] || ''; img.loading = 'lazy'; img.draggable = false;
      card.appendChild(img); it.appendChild(card); ring.appendChild(it); cards.push(it);
    });
    const shadow = document.createElement('div'); shadow.className = 'ring__shadow';
    stage.appendChild(ring); stage.appendChild(shadow);
    stage.tabIndex = 0; stage.setAttribute('role', 'region'); stage.setAttribute('aria-label', '取引先ロゴ 3Dカルーセル');

    let cardW = 160, radius = 600;
    function measure() {
      const cs = getComputedStyle(stage);
      cardW = parseFloat(cs.getPropertyValue('--card-w')) || 160;
      const gap = 1.12;
      radius = (cardW * gap / 2) / Math.tan(Math.PI / n);
      const maxR = Math.min(stage.clientWidth * 0.95, 1100) / 2 + cardW;
      radius = Math.min(radius, Math.max(maxR, 260));
      layout();
    }
    const step = 360 / n;
    let rot = 0, vel = reduce ? 0 : -0.08, target = null, dragging = false, lastX = 0, lastT = 0, hover = false;

    function layout() {
      const tilt = -4;
      ring.style.transform = `translateZ(${-radius}px) rotateX(${tilt}deg) rotateY(${rot}deg)`;
      cards.forEach((it, i) => {
        const a = i * step;
        // angle of this card relative to the viewer (0 = front)
        let rel = ((a + rot) % 360 + 360) % 360; if (rel > 180) rel -= 360;
        const f = Math.cos(rel * Math.PI / 180); // 1 front, -1 back
        const op = 0.18 + 0.82 * Math.max(0, (f + 0.25) / 1.25);
        const sc = 0.82 + 0.18 * Math.max(0, f);
        it.style.transform = `rotateY(${a}deg) translateZ(${radius}px) scale(${sc})`;
        it.style.opacity = op.toFixed(3);
        it.style.zIndex = Math.round(100 + f * 100);
      });
    }

    function tick() {
      if (!dragging) {
        if (target !== null) {
          const d = target - rot; rot += d * 0.08; if (Math.abs(d) < 0.05) { rot = target; target = null; }
        } else {
          rot += vel;
          const base = reduce ? 0 : (hover ? -0.025 : -0.08);
          vel += (base - vel) * 0.03;
        }
      }
      layout();
      requestAnimationFrame(tick);
    }

    // pointer drag
    stage.addEventListener('pointerdown', e => { dragging = true; stage.classList.add('is-dragging'); lastX = e.clientX; lastT = performance.now(); stage.setPointerCapture(e.pointerId); target = null; });
    stage.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - lastX; const now = performance.now(); const dt = Math.max(1, now - lastT);
      rot += dx * 0.25; vel = (dx * 0.25) / dt * 16; lastX = e.clientX; lastT = now;
    });
    const end = () => { dragging = false; stage.classList.remove('is-dragging'); vel = Math.max(-6, Math.min(6, vel)); };
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end); stage.addEventListener('pointerleave', () => { if (dragging) end(); hover = false; });
    stage.addEventListener('pointerenter', () => { hover = true; });
    stage.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { target = (target ?? rot) + step; } if (e.key === 'ArrowRight') { target = (target ?? rot) - step; } });

    const ctrl = stage.parentElement.querySelector('[data-ring-prev]'), ctrlN = stage.parentElement.querySelector('[data-ring-next]');
    ctrl && ctrl.addEventListener('click', () => { target = (target ?? rot) + step * 2; });
    ctrlN && ctrlN.addEventListener('click', () => { target = (target ?? rot) - step * 2; });

    measure(); window.addEventListener('resize', measure, { passive: true });
    requestAnimationFrame(tick);
  });
})();
