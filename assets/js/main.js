// ============================================================
// BFSERV リニューアルサイト 共通スクリプト
// ============================================================
(function () {
  "use strict";

  var header = document.getElementById("siteHeader");
  var hasHero = !!document.querySelector(".hero");

  // ヘッダー: ヒーローのあるページのみ透明⇄白を切り替え
  function onScrollHeader() {
    if (!hasHero) return;
    header.classList.toggle("is-solid", window.scrollY > 40);
  }
  window.addEventListener("scroll", onScrollHeader, { passive: true });
  onScrollHeader();

  // ハンバーガーメニュー
  var toggle = document.getElementById("navToggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.querySelectorAll(".global-nav a").forEach(function (a) {
      a.addEventListener("click", function () {
        document.body.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // スクロールフェードイン
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("is-view");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll(".fx").forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll(".fx").forEach(function (el) { el.classList.add("is-view"); });
  }

  // トップへ戻る
  var toTop = document.getElementById("toTop");
  if (toTop) {
    window.addEventListener(
      "scroll",
      function () {
        toTop.classList.toggle("is-show", window.scrollY > 600);
      },
      { passive: true }
    );
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // 料金カテゴリタブ: クリックでスクロール + スクロール位置に応じてアクティブ表示
  var tabs = document.getElementById("priceTabs");
  if (tabs) {
    var buttons = tabs.querySelectorAll("button");
    var sections = [];
    buttons.forEach(function (btn) {
      var sec = document.getElementById(btn.dataset.target);
      if (sec) sections.push({ btn: btn, sec: sec });
      btn.addEventListener("click", function () {
        if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    function spy() {
      var offset = window.scrollY + window.innerHeight * 0.32;
      var current = sections[0];
      sections.forEach(function (s) {
        if (s.sec.offsetTop <= offset) current = s;
      });
      sections.forEach(function (s) {
        s.btn.classList.toggle("is-active", s === current);
      });
      // アクティブタブを見える位置へ
      if (current && current.btn.scrollIntoView) {
        var r = current.btn.getBoundingClientRect();
        var pr = tabs.getBoundingClientRect();
        if (r.left < pr.left || r.right > pr.right) {
          current.btn.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
        }
      }
    }
    window.addEventListener("scroll", spy, { passive: true });
    spy();
  }
})();
