// ヘッダー: スクロールで下線を表示
(function () {
  var header = document.getElementById('siteHeader');
  if (!header) return;
  var update = function () { header.classList.toggle('scrolled', window.scrollY > 10); };
  update();
  window.addEventListener('scroll', update, { passive: true });
})();

// ハンバーガーメニュー
(function () {
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('globalNav');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
  });
  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
})();

// Scroll to explore
(function () {
  var btn = document.getElementById('scrollExplore');
  if (!btn) return;
  btn.addEventListener('click', function () {
    var target = document.getElementById('bfserv-news');
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
})();

// ヒーロー背景の再生/一時停止
(function () {
  var btn = document.getElementById('heroPlayer');
  var hero = document.getElementById('hero');
  if (!btn || !hero) return;
  btn.addEventListener('click', function () {
    var paused = hero.classList.toggle('paused');
    btn.textContent = paused ? '▶' : '❚❚';
    btn.setAttribute('aria-pressed', paused ? 'true' : 'false');
    btn.setAttribute('aria-label', paused ? '背景アニメーションを再生' : '背景アニメーションを一時停止');
  });
})();

// スクロール連動リビール
(function () {
  var targets = document.querySelectorAll('.reveal');
  if (!targets.length) return;
  if (!('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('visible'); });
    return;
  }
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  targets.forEach(function (el) { observer.observe(el); });
})();

// Business Segment: 01-04 の切替(クリック/ホバーで画像と説明を切替)
(function () {
  var list = document.getElementById('segmentList');
  var visual = document.getElementById('segmentVisual');
  if (!list) return;
  var items = list.querySelectorAll('.segment-item');
  var imgs = visual ? visual.querySelectorAll('img') : [];
  var activate = function (item) {
    if (item.classList.contains('active')) return;
    items.forEach(function (it) {
      it.classList.remove('active');
      var b = it.querySelector('button');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
    item.classList.add('active');
    var btn = item.querySelector('button');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    var idx = parseInt(item.getAttribute('data-img'), 10) || 0;
    imgs.forEach(function (img, i) { img.classList.toggle('active', i === idx); });
  };
  items.forEach(function (item) {
    var btn = item.querySelector('button');
    if (btn) btn.addEventListener('click', function () { activate(item); });
    item.addEventListener('mouseenter', function () {
      if (window.matchMedia('(hover: hover)').matches) activate(item);
    });
  });
})();

// About Us: スクロール連動ページネーション(01 / 03)
(function () {
  var panels = document.querySelectorAll('.about-panel');
  var cur = document.getElementById('aboutCur');
  var dotsWrap = document.getElementById('aboutDots');
  if (!panels.length || !cur || !('IntersectionObserver' in window)) return;
  var dots = dotsWrap ? dotsWrap.querySelectorAll('i') : [];
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        var idx = parseInt(entry.target.getAttribute('data-idx'), 10) || 1;
        cur.textContent = (idx < 10 ? '0' : '') + idx;
        dots.forEach(function (d, i) { d.classList.toggle('on', i === idx - 1); });
      }
    });
  }, { rootMargin: '-40% 0px -50% 0px' });
  panels.forEach(function (p) { observer.observe(p); });
})();

// カウントアップ
(function () {
  var counters = document.querySelectorAll('.count');
  if (!counters.length) return;
  var animate = function (el) {
    var target = parseInt(el.getAttribute('data-count'), 10) || 0;
    var duration = 1600;
    var start = null;
    var plain = el.hasAttribute('data-plain');
    var format = function (n) { return plain ? String(n) : n.toLocaleString('ja-JP'); };
    var step = function (ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = format(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if (!('IntersectionObserver' in window)) {
    counters.forEach(function (el) { el.textContent = el.getAttribute('data-count'); });
    return;
  }
  var seen = new WeakSet();
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting && !seen.has(entry.target)) {
        seen.add(entry.target);
        animate(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });
  counters.forEach(function (el) { observer.observe(el); });
})();

// Our Business: ドラッグスクロール
(function () {
  var track = document.getElementById('obTrack');
  if (!track) return;
  var isDown = false, startX = 0, startScroll = 0, moved = false;
  track.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse') return;
    isDown = true; moved = false;
    startX = e.clientX; startScroll = track.scrollLeft;
    track.classList.add('dragging');
  });
  window.addEventListener('pointermove', function (e) {
    if (!isDown) return;
    var dx = e.clientX - startX;
    if (Math.abs(dx) > 5) moved = true;
    track.scrollLeft = startScroll - dx;
  });
  window.addEventListener('pointerup', function () {
    isDown = false;
    track.classList.remove('dragging');
  });
  track.addEventListener('click', function (e) {
    if (moved) { e.preventDefault(); moved = false; }
  }, true);
})();
