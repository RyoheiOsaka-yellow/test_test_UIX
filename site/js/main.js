// ECO PROJECT — site interactions

(function () {
  'use strict';

  // ---- Loader ----
  window.addEventListener('load', function () {
    var loader = document.getElementById('loader');
    setTimeout(function () { loader.classList.add('is-done'); }, 500);
  });
  // Fallback: never keep the loader longer than 2.5s
  setTimeout(function () {
    document.getElementById('loader').classList.add('is-done');
  }, 2500);

  // ---- Header state ----
  var header = document.getElementById('header');
  var totop = document.getElementById('totop');
  function onScroll() {
    var y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 40);
    totop.classList.toggle('is-visible', y > 600);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---- Mobile menu ----
  var menuBtn = document.getElementById('menuBtn');
  var gnav = document.getElementById('gnav');
  menuBtn.addEventListener('click', function () {
    var open = gnav.classList.toggle('is-open');
    menuBtn.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuBtn.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
  });
  gnav.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      gnav.classList.remove('is-open');
      menuBtn.classList.remove('is-open');
      menuBtn.setAttribute('aria-expanded', 'false');
    });
  });

  // ---- Scroll reveal ----
  var revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.reveal').forEach(function (el) {
    revealObserver.observe(el);
  });

  // ---- Count-up numbers ----
  function animateCount(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    var duration = 1600;
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString();
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var countObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        countObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('.count').forEach(function (el) {
    countObserver.observe(el);
  });
})();
