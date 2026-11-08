/* BFSERV — shared behaviours */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- header ---------- */
  const header = $('.header');
  let lastY = window.scrollY;
  function onScroll() {
    const y = window.scrollY;
    header && header.classList.toggle('is-scrolled', y > 24);
    if (header && !document.body.classList.contains('menu-open')) {
      header.classList.toggle('is-hidden', y > lastY && y > 400 && Math.abs(y - lastY) > 4);
    }
    lastY = y;
    const tt = $('.totop'); tt && tt.classList.toggle('is-shown', y > 800);
  }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* mega menu */
  $$('.nav__item--has-mega').forEach(item => {
    const link = $('.nav__link', item);
    let t;
    item.addEventListener('mouseenter', () => { clearTimeout(t); $$('.nav__item--has-mega').forEach(i => i !== item && i.classList.remove('is-open')); item.classList.add('is-open'); });
    item.addEventListener('mouseleave', () => { t = setTimeout(() => item.classList.remove('is-open'), 160); });
    link.addEventListener('click', e => { if (link.getAttribute('href') === '#') { e.preventDefault(); item.classList.toggle('is-open'); } });
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { $$('.nav__item.is-open').forEach(i => i.classList.remove('is-open')); document.body.classList.remove('menu-open'); } });

  /* drawer */
  const burger = $('.burger');
  burger && burger.addEventListener('click', () => {
    const open = document.body.classList.toggle('menu-open');
    burger.setAttribute('aria-expanded', open);
    document.documentElement.style.overflow = open ? 'hidden' : '';
  });
  $$('.drawer a').forEach(a => a.addEventListener('click', () => { document.body.classList.remove('menu-open'); document.documentElement.style.overflow = ''; }));

  /* ---------- reveal on scroll ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  $$('.reveal, .reveal-stagger').forEach(el => io.observe(el));

  /* ---------- counters ---------- */
  const cio = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return; cio.unobserve(e.target);
      const el = e.target, end = parseFloat(el.dataset.count), dur = 1600, t0 = performance.now();
      const fmt = v => el.dataset.decimals ? v.toFixed(el.dataset.decimals) : Math.round(v).toLocaleString();
      if (reduce) { el.textContent = fmt(end); return; }
      (function step(now) { const p = Math.min(1, (now - t0) / dur); const ease = 1 - Math.pow(1 - p, 4); el.textContent = fmt(end * ease); if (p < 1) requestAnimationFrame(step); })(t0);
    });
  }, { threshold: .5 });
  $$('[data-count]').forEach(el => cio.observe(el));

  /* ---------- marquee duplicate ---------- */
  $$('.marquee').forEach(m => { m.innerHTML += m.innerHTML; });

  /* ---------- accordion ---------- */
  $$('.acc').forEach(acc => {
    const btn = $('.acc__btn', acc);
    btn.addEventListener('click', () => { const open = acc.classList.toggle('is-open'); btn.setAttribute('aria-expanded', open); });
  });

  /* ---------- tabs ---------- */
  $$('[data-tabs]').forEach(group => {
    const tabs = $$('.tab', group); const panels = $$('.tab-panel', group.parentElement);
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => { x.classList.remove('is-active'); x.setAttribute('aria-selected', 'false'); }); t.classList.add('is-active'); t.setAttribute('aria-selected', 'true');
      panels.forEach(p => p.classList.toggle('is-active', p.id === t.dataset.tab));
    }));
  });

  /* ---------- lightbox ---------- */
  const lb = $('.lightbox');
  if (lb) {
    const img = $('img', lb);
    $$('.gallery figure, .honeycomb--gallery figure').forEach(f => f.addEventListener('click', () => { img.src = $('img', f).src; img.alt = $('img', f).alt; lb.classList.add('is-open'); }));
    lb.addEventListener('click', () => lb.classList.remove('is-open'));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') lb.classList.remove('is-open'); });
  }

  /* ---------- logo wall filter ---------- */
  const wall = $('[data-logo-wall]');
  if (wall) {
    $$('[data-filter]').forEach(ch => ch.addEventListener('click', () => {
      $$('[data-filter]').forEach(c => c.classList.remove('is-active')); ch.classList.add('is-active');
      const f = ch.dataset.filter;
      $$('figure', wall).forEach(fig => { fig.style.display = (f === 'all' || fig.dataset.cat === f) ? '' : 'none'; });
      wall.classList.remove('is-collapsed'); window.BF_HONEYCOMB && window.BF_HONEYCOMB();
    }));
    const more = $('[data-logo-more]');
    more && more.addEventListener('click', () => { wall.classList.remove('is-collapsed'); more.remove(); window.BF_HONEYCOMB && window.BF_HONEYCOMB(); });
  }

  /* ---------- cursor glow ---------- */
  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    const g = document.createElement('div'); g.className = 'glow'; document.body.appendChild(g);
    let gx = 0, gy = 0, tx = 0, ty = 0;
    window.addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; document.body.classList.add('has-glow'); }, { passive: true });
    (function loop() { gx += (tx - gx) * .12; gy += (ty - gy) * .12; g.style.transform = `translate(${gx - 260}px, ${gy - 260}px)`; requestAnimationFrame(loop); })();
  }

  /* ---------- parallax media ---------- */
  const px = $$('.split__media--parallax img, [data-parallax]');
  if (px.length && !reduce) {
    const update = () => {
      px.forEach(el => {
        const r = el.parentElement.getBoundingClientRect(); const vh = innerHeight;
        if (r.bottom < 0 || r.top > vh) return;
        const p = (r.top + r.height / 2 - vh / 2) / vh; // -1 .. 1
        el.style.transform = `translateY(${(-p * 10).toFixed(2)}%)`;
      });
    };
    window.addEventListener('scroll', update, { passive: true }); update();
  }

  /* ---------- page curtain transition ---------- */
  const curtain = document.createElement('div'); curtain.className = 'curtain is-in'; document.body.appendChild(curtain);
  if (!reduce) {
    $$('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('tel:') || href.startsWith('mailto:') || a.target === '_blank' || /^https?:/.test(href)) return;
      a.addEventListener('click', e => {
        if (e.metaKey || e.ctrlKey) return;
        e.preventDefault(); curtain.classList.remove('is-in'); curtain.classList.add('is-out');
        setTimeout(() => { location.href = href; }, 520);
      });
    });
  }
  window.addEventListener('pageshow', e => { if (e.persisted) { curtain.classList.remove('is-out'); curtain.classList.add('is-in'); } });

  /* ---------- contact form (client-side validation; no backend yet) ---------- */
  const form = $('[data-contact-form]');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault(); let ok = true;
      $$('[required]', form).forEach(f => {
        const err = f.closest('label').querySelector('.error'); const bad = !f.value.trim() || (f.type === 'email' && !/^\S+@\S+\.\S+$/.test(f.value));
        f.classList.toggle('is-invalid', bad); if (err) err.textContent = bad ? (f.type === 'email' ? 'メールアドレスの形式を確認してください' : '必須項目です') : '';
        if (bad) ok = false;
      });
      if (!ok) { $('.is-invalid', form).focus(); return; }
      // Hand-off: build a mailto so the form works without a server. Replace with Formspree / API endpoint in production.
      const d = new FormData(form); const lines = [...d.entries()].map(([k, v]) => `${k}: ${v}`).join('\n');
      const subject = encodeURIComponent(`【WEBお問い合わせ】${d.get('種別') || ''} / ${d.get('お名前') || ''}`);
      form.style.display = 'none'; const s = $('.form-success'); s.classList.add('is-shown');
      $('[data-mail-link]', s).href = `mailto:info@bfserv.co.jp?subject=${subject}&body=${encodeURIComponent(lines)}`;
    });
  }

  /* ---------- fluid canvas on sub-page heroes (fluid.js picks it up) ---------- */
  $$('.page-hero:not([data-no-fluid])').forEach(hero => {
    const c = document.createElement('canvas'); c.className = 'page-hero__fluid'; c.setAttribute('data-fluid', '');
    const bg = getComputedStyle(hero).backgroundColor.match(/\d+/g);
    if (bg) c.dataset.bg = '#' + bg.slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('');
    c.dataset.strength = '0.8'; c.setAttribute('aria-hidden', 'true');
    hero.prepend(c);
  });

  /* ---------- floating hex field ---------- */
  $$('.hero, .page-hero, .cta, [data-hexfield]').forEach(sec => {
    const f = document.createElement('div'); f.className = 'hexfield'; f.setAttribute('aria-hidden', 'true');
    const n = sec.classList.contains('hero') ? 9 : 6;
    for (let i = 0; i < n; i++) {
      const h = document.createElement('i');
      const size = 40 + Math.random() * 120;
      h.style.width = size + 'px'; h.style.left = (Math.random() * 100) + '%'; h.style.top = (Math.random() * 100) + '%';
      h.style.setProperty('--dur', (10 + Math.random() * 14) + 's'); h.style.setProperty('--dx', (Math.random() * 80 - 40) + 'px'); h.style.setProperty('--dy', (Math.random() * -90) + 'px'); h.style.setProperty('--rot', (Math.random() * 90 - 45) + 'deg');
      h.style.animationDelay = (-Math.random() * 12) + 's'; h.dataset.depth = (0.2 + Math.random() * 0.8).toFixed(2);
      if (Math.random() < 0.3) h.classList.add('fill');
      f.appendChild(h);
    }
    sec.prepend(f);
  });
  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    let mx = 0, my = 0;
    window.addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
    (function par() { $$('.hexfield i').forEach(h => { const d = +h.dataset.depth; h.style.marginLeft = (mx * 40 * d) + 'px'; h.style.marginTop = (my * 30 * d) + 'px'; }); requestAnimationFrame(par); })();
  }

  /* ---------- year ---------- */
  $$('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
})();
