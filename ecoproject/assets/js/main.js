// ECO PROJECT — site interactions
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Loader ----
  var loader = document.getElementById('loader');
  function hideLoader() { if (loader) loader.classList.add('is-done'); }
  window.addEventListener('load', function () { setTimeout(hideLoader, 250); });
  setTimeout(hideLoader, 1800); // never keep the loader longer than this

  // ---- Header state / floating buttons ----
  var header = document.getElementById('header');
  var totop = document.getElementById('totop');
  var spCta = document.getElementById('spCta');
  var contact = document.getElementById('contact');
  function onScroll() {
    var y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 40);
    totop.classList.toggle('is-visible', y > 600);
    if (spCta) {
      var nearContact = contact && contact.getBoundingClientRect().top < window.innerHeight * 0.6;
      spCta.classList.toggle('is-visible', y > 420 && !nearContact);
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---- Mobile menu ----
  var menuBtn = document.getElementById('menuBtn');
  var gnav = document.getElementById('gnav');
  function setMenu(open) {
    gnav.classList.toggle('is-open', open);
    menuBtn.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuBtn.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
    document.documentElement.style.overflow = open ? 'hidden' : '';
  }
  menuBtn.addEventListener('click', function () { setMenu(!gnav.classList.contains('is-open')); });
  gnav.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { setMenu(false); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && gnav.classList.contains('is-open')) setMenu(false);
  });

  // ---- Hero slider ----
  var slider = document.getElementById('heroSlider');
  if (slider) {
    var slides = slider.querySelectorAll('.slide');
    var tabs = slider.querySelectorAll('.slider__tab');
    var interval = 6000;
    var current = 0;
    var timer = null;
    var paused = false;

    function show(i) {
      current = (i + slides.length) % slides.length;
      slides.forEach(function (s, n) {
        var on = n === current;
        s.classList.toggle('is-active', on);
        s.setAttribute('aria-hidden', on ? 'false' : 'true');
      });
      tabs.forEach(function (t, n) {
        // re-trigger the progress animation on the active tab
        t.classList.remove('is-active');
        if (n === current) { void t.offsetWidth; t.classList.add('is-active'); }
        t.setAttribute('aria-selected', n === current ? 'true' : 'false');
      });
    }
    function stop() { if (timer) { clearTimeout(timer); timer = null; } }
    function schedule() {
      stop();
      if (reduceMotion || paused) return;
      timer = setTimeout(function () { show(current + 1); schedule(); }, interval);
    }
    function go(i) { show(i); schedule(); }
    function setPaused(p) {
      paused = p;
      slider.classList.toggle('is-paused', p);
      // Pausing restarts the current slide's timer on resume (progress bar restarts with it).
      if (p) { stop(); } else { show(current); schedule(); }
    }

    tabs.forEach(function (t, n) { t.addEventListener('click', function () { go(n); }); });
    slider.querySelector('[data-slide="prev"]').addEventListener('click', function () { go(current - 1); });
    slider.querySelector('[data-slide="next"]').addEventListener('click', function () { go(current + 1); });
    slider.addEventListener('mouseenter', function () { setPaused(true); });
    slider.addEventListener('mouseleave', function () { setPaused(false); });
    slider.addEventListener('focusin', function () { setPaused(true); });
    slider.addEventListener('focusout', function (e) { if (!slider.contains(e.relatedTarget)) setPaused(false); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else if (!paused) { show(current); schedule(); }
    });

    // swipe
    var startX = null;
    slider.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    slider.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(dx) > 40) go(current + (dx < 0 ? 1 : -1));
    }, { passive: true });

    if (reduceMotion) slider.classList.add('is-static');
    show(0);
    schedule();
  }

  // ---- News: show the latest 5, expand the rest on demand ----
  var newsList = document.getElementById('newsList');
  var newsMore = document.getElementById('newsMore');
  if (newsList && newsMore && newsList.querySelector('.news-item--more')) {
    var moreLabel = newsMore.innerHTML;
    newsList.classList.add('is-collapsed');
    newsMore.hidden = false;
    newsMore.addEventListener('click', function () {
      var open = newsList.classList.toggle('is-collapsed') === false;
      newsMore.setAttribute('aria-expanded', open ? 'true' : 'false');
      newsMore.innerHTML = open ? moreLabel.replace(/もっと見る（ほか\d+件）/, '閉じる') : moreLabel;
    });
  }

  // ---- Scroll reveal ----
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  // ---- Contact form ----
  var form = document.getElementById('contactForm');
  if (form) {
    var wrap = form.closest('.form');
    var status = document.getElementById('formStatus');
    var submitBtn = form.querySelector('button[type="submit"]');
    var el = {
      type: document.getElementById('f-type'),
      company: document.getElementById('f-company'),
      name: document.getElementById('f-name'),
      email: document.getElementById('f-email'),
      tel: document.getElementById('f-tel'),
      message: document.getElementById('f-message'),
      agree: document.getElementById('f-agree'),
      trap: document.getElementById('f-wana')
    };
    var messages = {
      name: 'お名前をご入力ください。',
      email: 'メールアドレスを正しくご入力ください。',
      message: 'お問い合わせ内容をご入力ください。',
      agree: '個人情報の取り扱いへの同意が必要です。'
    };

    function setError(key, msg) {
      var input = el[key];
      var field = input.closest('.field, .form__agree');
      var err = field.querySelector('.field__error');
      field.classList.toggle('is-invalid', !!msg);
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (err) err.textContent = msg || '';
    }
    function validate() {
      var ok = true;
      var first = null;
      function check(key, valid) {
        setError(key, valid ? '' : messages[key]);
        if (!valid) { ok = false; first = first || el[key]; }
      }
      check('name', el.name.value.trim() !== '');
      check('email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.email.value.trim()));
      check('message', el.message.value.trim() !== '');
      check('agree', el.agree.checked);
      if (first) first.focus();
      return ok;
    }
    ['name', 'email', 'message', 'agree'].forEach(function (k) {
      el[k].addEventListener(k === 'agree' ? 'change' : 'input', function () { setError(k, ''); });
    });

    function done() {
      wrap.classList.add('is-sent');
      wrap.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    }
    function fail(msg) {
      status.textContent = msg || '送信できませんでした。お手数ですが、時間をおいて再度お試しいただくか、お電話にてお問い合わせください。';
      status.classList.add('is-error');
    }

    // SSGformのフォームURL（form の action 属性）
    var endpoint = (form.getAttribute('action') || '').trim();

    // フォームURL未設定の間は、入力内容を本文に入れてメールソフトを起動する
    function openMailer() {
      var to = form.getAttribute('data-mail-user') + '@' + form.getAttribute('data-mail-domain');
      var lines = [
        '■ お問い合わせ種別： ' + (el.type.value || '（未選択）'),
        '■ 会社名・管理組合名： ' + (el.company.value.trim() || '（未入力）'),
        '■ お名前： ' + el.name.value.trim(),
        '■ メールアドレス： ' + el.email.value.trim(),
        '■ 電話番号： ' + (el.tel.value.trim() || '（未入力）'),
        '',
        '■ お問い合わせ内容',
        el.message.value.trim()
      ];
      window.location.href = 'mailto:' + to +
        '?subject=' + encodeURIComponent('【ホームページ】お問い合わせ') +
        '&body=' + encodeURIComponent(lines.join('\r\n'));
      status.textContent = 'メールソフトが起動します。内容をご確認のうえ、そのまま送信してください。';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.textContent = '';
      status.classList.remove('is-error');
      if (!validate()) return;
      if (el.trap.value !== '') return; // bot

      if (!endpoint) { openMailer(); return; }

      submitBtn.disabled = true;
      status.textContent = '送信中です…';
      // SSGformはこのヘッダーでAjax送信を判定し、成功時に200を返す（CAPTCHA失敗などは204）
      fetch(endpoint, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      })
        .then(function (res) {
          if (res.status === 200) { status.textContent = ''; done(); } else { fail(); }
        })
        .catch(function () { fail(); })
        .then(function () { submitBtn.disabled = false; });
    });

    // JavaScriptが無効な環境：SSGformの「送信後転送先URL」を index.html?sent=1#contact にしておくと完了表示になる
    if (new URLSearchParams(window.location.search).get('sent') === '1') wrap.classList.add('is-sent');
  }
})();
