#!/usr/bin/env python3
"""Merge the report and the interactive playground into one self-contained HTML file.

The two pages were authored separately (``report.html`` and
``interactive/index.html``) and share class names (``.wrap``, ``.card``,
``.legend``, ``h2``, …) with different meanings, so their stylesheets are
scoped under ``.report`` / ``.pg`` wrappers instead of being concatenated.
Images are inlined as data URIs so the result works offline from a download.

    python build_standalone.py [-o game-prototype.html]
"""
from __future__ import annotations

import argparse
import base64
import mimetypes
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# Selectors that belong to the merged document rather than to one section.
GLOBAL_SELECTORS = {"*", "html", "body", "html, body"}


def read_parts(path: Path) -> dict:
    """Split an authored page into title, stylesheet, script and body markup."""
    text = path.read_text(encoding="utf-8")
    title = re.search(r"<title>(.*?)</title>", text, re.S)
    style = "\n".join(re.findall(r"<style>(.*?)</style>", text, re.S))
    script = "\n".join(re.findall(r"<script>(.*?)</script>", text, re.S))
    body = re.sub(r"<title>.*?</title>", "", text, flags=re.S)
    body = re.sub(r"<link[^>]*>", "", body)
    body = re.sub(r"<style>.*?</style>", "", body, flags=re.S)
    body = re.sub(r"<script>.*?</script>", "", body, flags=re.S)
    body = re.sub(r"<header>.*?</header>", "", body, flags=re.S)  # a shared page header replaces both
    return {"title": title.group(1) if title else path.stem, "style": style,
            "script": script, "body": body.strip()}


def _block(css: str, brace: int) -> tuple[str, int]:
    """Return the contents of the block whose opening brace is at ``brace``."""
    depth = 0
    for i in range(brace, len(css)):
        if css[i] == "{":
            depth += 1
        elif css[i] == "}":
            depth -= 1
            if depth == 0:
                return css[brace + 1:i], i + 1
    raise ValueError("unbalanced braces in stylesheet")


def scope_css(css: str, scope: str) -> str:
    """Prefix every selector with ``scope``; drop rules that are document-wide.

    ``:root`` token blocks, ``*`` and ``body`` rules are dropped because the
    merged document defines them once. ``@media`` blocks are rewritten
    recursively so their inner selectors get the same treatment.
    """
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    out, pos = [], 0
    while True:
        brace = css.find("{", pos)
        if brace == -1:
            break
        selector = css[pos:brace].strip()
        content, pos = _block(css, brace)
        if selector.startswith(("@media", "@supports")):
            inner = scope_css(content, scope)
            if inner.strip():
                out.append(f"{selector} {{\n{inner}\n}}")
            continue
        if selector.startswith("@"):
            out.append(f"{selector} {{{content}}}")
            continue
        parts = [p.strip() for p in selector.split(",") if p.strip()]
        if any(p.startswith(":root") or p in GLOBAL_SELECTORS for p in parts):
            continue
        out.append(", ".join(f"{scope} {p}" for p in parts) + f" {{{content}}}")
    return "\n".join(out)


def escape_attr(text: str) -> str:
    """Escape a whole document so it can live in an iframe ``srcdoc`` attribute."""
    return text.replace("&", "&amp;").replace('"', "&quot;")


def inline_images(body: str, base: Path) -> str:
    """Replace every local ``src="…"`` with a data URI."""
    def repl(m: re.Match) -> str:
        src = m.group(1)
        if src.startswith(("data:", "http:", "https:")):
            return m.group(0)
        path = base / src
        mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        data = base64.b64encode(path.read_bytes()).decode("ascii")
        return f'src="data:{mime};base64,{data}"'
    return re.sub(r'src="([^"]+)"', repl, body)


PAGE_CSS = """
  :root {
    --bg: #F3F5F8; --surface: #FFFFFF; --ink: #17212B; --muted: #5B6875; --line: #D6DCE3;
    --accent: #0E7C86; --accent-soft: #DDF1F2;
    --stale: #DF7A2C; --stale-soft: #FBE9DA; --fresh: #2E9A68; --fresh-soft: #DDF3E7;
    --danger: #C43E3E; --map-bg: #1B2430; --map-wall: #3A4657; --map-grid: #243040; --map-text: #C8D2DE;
    --code-bg: #EEF1F4;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #0F151C; --surface: #161E27; --ink: #E8EDF2; --muted: #9AA7B4; --line: #26313D;
      --accent: #4FC3CE; --accent-soft: #123A3F; --stale: #F0904A; --stale-soft: #3E2716;
      --fresh: #5FCF95; --fresh-soft: #163826; --danger: #E06A6A;
      --map-bg: #0B1017; --map-wall: #2B3543; --map-grid: #16202B; --map-text: #B8C4D0; --code-bg: #1C2632;
    }
  }
  :root[data-theme="dark"] {
    --bg: #0F151C; --surface: #161E27; --ink: #E8EDF2; --muted: #9AA7B4; --line: #26313D;
    --accent: #4FC3CE; --accent-soft: #123A3F; --stale: #F0904A; --stale-soft: #3E2716;
    --fresh: #5FCF95; --fresh-soft: #163826; --danger: #E06A6A;
    --map-bg: #0B1017; --map-wall: #2B3543; --map-grid: #16202B; --map-text: #B8C4D0; --code-bg: #1C2632;
  }
  * { box-sizing: border-box; }
  html { color-scheme: light dark; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font-family: "IBM Plex Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", system-ui, sans-serif;
    font-size: 16px; line-height: 1.7; padding-inline: 18px; padding-block: 0 72px;
    -webkit-font-smoothing: antialiased;
  }
  img { max-width: 100%; }
  [hidden] { display: none !important; }

  .page { max-width: 1180px; margin: 0 auto; }
  .page > header { padding-block: 44px 20px; }
  .page .eyebrow { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); font-weight: 600; margin-bottom: 12px; }
  .page h1 {
    font-family: "Zen Kaku Gothic New", "IBM Plex Sans JP", sans-serif;
    font-size: clamp(28px, 4.2vw, 40px); font-weight: 900; line-height: 1.2; margin: 0; text-wrap: balance;
  }
  .page .lede { font-size: 17px; color: var(--muted); margin: 16px 0 0; max-width: 760px; }
  .page .links { display: flex; flex-wrap: wrap; gap: 8px 20px; margin-top: 16px; font-size: 14px; }
  .page a { color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 3px; }

  .tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--line); margin-bottom: 4px; }
  .tabs button {
    border: 0; background: none; color: var(--muted); font: inherit; font-weight: 700;
    font-family: "Zen Kaku Gothic New", "IBM Plex Sans JP", sans-serif;
    padding: 12px 18px; cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -1px;
  }
  .tabs button[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--accent); }
  .tabs button:focus-visible { outline: 2px solid var(--accent); outline-offset: -4px; }

  .tabpanel { max-width: 1180px; margin: 0 auto; }
  .tabpanel > .intro { color: var(--muted); max-width: 760px; margin: 22px 0 18px; }
  .frame { width: 100%; border: 0; display: block; min-height: 760px; background: var(--bg); }
  .filenote {
    max-width: 1180px; margin: 56px auto 0; padding-top: 18px; border-top: 1px solid var(--line);
    font-size: 13px; color: var(--muted);
  }
  @media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
"""

PAGE_JS = """
(() => {
  "use strict";
  const tabs = [...document.querySelectorAll(".tabs button")];
  let select = function (name, focus) {
    for (const t of tabs) {
      const on = t.dataset.target === name;
      t.setAttribute("aria-selected", String(on));
      document.getElementById(t.dataset.target).hidden = !on;
      if (on && focus) t.focus();
    }
    try { localStorage.setItem("game-kit-tab", name); } catch (e) {}
  };
  document.addEventListener("click", ev => {
    const a = ev.target.closest('a[href="#playground"], a[href="#playground3d"]');
    if (!a) return;
    ev.preventDefault();
    const target = a.getAttribute("href") === "#playground3d" ? "pg3" : "pg";
    select(target, true);
    document.getElementById(target).scrollIntoView({ behavior: "smooth", block: "start" });
  });
  const frame = document.getElementById("frame3d");
  function fitFrame() {
    try { frame.style.height = frame.contentDocument.documentElement.scrollHeight + 40 + "px"; } catch (e) {}
  }
  frame.addEventListener("load", fitFrame);
  window.addEventListener("resize", () => { if (!document.getElementById("pg3").hidden) fitFrame(); });
  const origSelect = select;
  select = function (name, focus) {
    origSelect(name, focus);
    if (name === "pg3" && !frame.getAttribute("srcdoc")) frame.setAttribute("srcdoc", frame.dataset.doc);
    if (name === "pg3") setTimeout(fitFrame, 80);
  };
  tabs.forEach(t => t.addEventListener("click", () => select(t.dataset.target)));
  let start = "pg3";
  if (location.hash === "#report") start = "report";
  else if (location.hash === "#playground") start = "pg";
  else {
    try { const s = localStorage.getItem("game-kit-tab"); if (["report", "pg", "pg3"].includes(s)) start = s; } catch (e) {}
  }
  select(start);
})();
"""


def build(out_path: Path) -> Path:
    report = read_parts(ROOT / "report.html")
    play = read_parts(ROOT / "interactive" / "index.html")
    # The 3D demo shares element ids with the 2D one (play, log, sN, …), so it is
    # isolated in an iframe instead of being merged into the document.
    play3d = (ROOT / "webgl" / "index.html").read_text(encoding="utf-8")

    report_body = inline_images(report["body"], ROOT)
    report_body = report_body.replace("https://claude.ai/artifact/5Tg65CZjb86jJCk3VYiuVc", "#playground")
    report_body = report_body.replace("https://claude.ai/artifact/PhkZmrfSVKf4SNk4uqLQKZ", "#playground3d")

    # Pause the simulation while the playground tab is hidden.
    old = '  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; frameCounter++;'
    new = ('  const panel = document.getElementById("pg");\n'
           '  if (panel && panel.hidden) { lastT = now; requestAnimationFrame(loop); return; }\n'
           + old)
    assert old in play["script"], "playground main loop not found"
    play_script = play["script"].replace(old, new, 1)

    html = f"""<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>GaME Prototype Kit</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@500;700;900&family=IBM+Plex+Sans+JP:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
{PAGE_CSS}
/* ---- scoped from interactive/index.html ---- */
{scope_css(play["style"], ".pg")}
/* ---- scoped from report.html ---- */
{scope_css(report["style"], ".report")}
</style>
</head>
<body>
<div class="page">
  <header>
    <div class="eyebrow">プロトタイプ一式 · 2026-09-21</div>
    <h1>GaME プロトタイプ</h1>
    <p class="lede">CVPR 2026 の <em>GaME: Gaussian Mapping for Evolving Scenes</em> のコア（動的シーン適応とキーフレーム管理）を、CUDA・SAM・実データなしで動かせる形に移植した。WebGL の 3D 版と、仕組みが見やすい 2 次元版で<b>体感</b>し、CPU 版の実験を<b>報告</b>として読む。この 1 ファイルに全部入っている。</p>
    <div class="links">
      <a href="https://github.com/RyoheiOsaka-yellow/test_test_UIX/tree/claude/awesome-dijkstra-pi7ryl/game-proto">コード（game-proto/）</a>
      <a href="https://github.com/VladimirYugay/GaME">本家リポジトリ</a>
      <a href="https://arxiv.org/abs/2506.06909">arXiv 2506.06909</a>
      <a href="https://vladimiryugay.github.io/game/">プロジェクトページ</a>
    </div>
  </header>
  <nav class="tabs" role="tablist" aria-label="表示の切り替え">
    <button role="tab" id="tab-pg3" data-target="pg3" aria-controls="pg3" aria-selected="true">3D で体感する</button>
    <button role="tab" id="tab-pg" data-target="pg" aria-controls="pg" aria-selected="false">2D で体感する</button>
    <button role="tab" id="tab-report" data-target="report" aria-controls="report" aria-selected="false">報告を読む</button>
  </nav>
</div>

<section class="tabpanel" id="pg3" role="tabpanel" aria-labelledby="tab-pg3">
  <iframe class="frame" id="frame3d" title="GaME 3D Playground" data-doc="{escape_attr(play3d)}"></iframe>
</section>

<section class="tabpanel pg" id="pg" role="tabpanel" aria-labelledby="tab-pg" hidden>
  <p class="intro">ロボットの地図は正確でも、間違っていることがある。ロボットを動かし、見ていない間に椅子を動かして、<b>静的マップ</b>と <b>GaME</b>（古い記憶を忘れられる地図）の違いを見る。</p>
{play["body"]}
</section>

<section class="tabpanel report" id="report" role="tabpanel" aria-labelledby="tab-report" hidden>
{report_body}
</section>

<p class="filenote">この HTML は単体で完結している（画像はすべて埋め込み済み）。書体だけはネットワークがあれば Google Fonts から読み込み、なければ端末の書体にフォールバックする。ソースと再現手順はリポジトリの <code>game-proto/</code> にある。</p>

<script>
{play_script}
</script>
<script>
{PAGE_JS}
</script>
</body>
</html>
"""
    out_path.write_text(html, encoding="utf-8")
    return out_path


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("-o", "--output", default=str(ROOT / "game-prototype.html"))
    args = ap.parse_args()
    path = build(Path(args.output))
    print(f"wrote {path} ({path.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
