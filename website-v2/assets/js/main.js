// ヘッダー: スクロールで透過→白へ
(function () {
  var header = document.getElementById('siteHeader');
  if (!header) return;
  var update = function () {
    header.classList.toggle('scrolled', window.scrollY > 40);
  };
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

// スクロール連動のリビール
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
  }, { threshold: 0.15 });
  targets.forEach(function (el) { observer.observe(el); });
})();

// カウントアップ(In Numbers)
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

// 事業領域カルーセル(ボタン+ドラッグスクロール)
(function () {
  var track = document.getElementById('segTrack');
  if (!track) return;
  var prev = document.getElementById('segPrev');
  var next = document.getElementById('segNext');
  var cardWidth = function () {
    var card = track.querySelector('.segment-card');
    return card ? card.getBoundingClientRect().width + 28 : 420;
  };
  if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -cardWidth(), behavior: 'smooth' }); });
  if (next) next.addEventListener('click', function () { track.scrollBy({ left: cardWidth(), behavior: 'smooth' }); });

  // ドラッグでスクロール
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
  // ドラッグ直後のリンク誤クリックを防ぐ
  track.addEventListener('click', function (e) {
    if (moved) { e.preventDefault(); moved = false; }
  }, true);
})();

// About タブ(01/02/03)
(function () {
  var tabs = document.querySelectorAll('.about-tab');
  var panels = document.querySelectorAll('.about-panel');
  if (!tabs.length) return;
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.setAttribute('aria-selected', 'false'); });
      panels.forEach(function (p) { p.classList.remove('active'); });
      tab.setAttribute('aria-selected', 'true');
      var panel = document.getElementById(tab.getAttribute('aria-controls'));
      if (panel) panel.classList.add('active');
    });
  });
})();
