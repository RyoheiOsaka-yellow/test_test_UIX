#!/usr/bin/env python3
"""トラッキング・コックピット (プロトタイプ画面) の生成.

パイプライン出力 (tracks.csv / player_stats.csv) と注釈付き映像から、
「実際の試合のトラッキング画面 + レポート確認」を1枚の自己完結 HTML
(外部リソースなし・オフライン動作) として生成する。

- 映像プレイヤーと俯瞰コートビューが再生時刻で同期
- 選手クリックで軌跡・ヒートマップをハイライト
- タブでライブスタッツ / 選手スタッツ / ヒートマップ / サマリーを切替

usage:
  python build_cockpit.py --data-dir output_real --video small_annotated.mp4 \
      --ruleset nfhs --label "Hazen vs Lake Region" --out cockpit.html
"""

import argparse
import base64
import csv
import json
import os
from collections import defaultdict

import numpy as np
from scipy.ndimage import gaussian_filter

RULESETS = {
    "fiba": (28.0, 15.0, 5.8, 4.9, 6.75, 1.575, 1.8),
    "nfhs": (25.60, 15.24, 5.79, 3.66, 6.02, 1.60, 1.83),
}


def load_tracks(path):
    rows = list(csv.DictReader(open(path)))
    n = max(int(r["frame"]) for r in rows) + 1
    teams, per_track = {}, defaultdict(lambda: [None] * n)
    speeds = defaultdict(lambda: [0.0] * n)
    for r in rows:
        f = int(r["frame"])
        tid = r["track_id"]
        teams[tid] = r["team"]
        per_track[tid][f] = [round(float(r["x_m"]), 2), round(float(r["y_m"]), 2)]
        speeds[tid][f] = round(float(r["speed_mps"]), 1)
    return n, teams, dict(per_track), dict(speeds)


def heat_grid(track, dims, bins=(52, 31)):
    pts = np.array([p for p in track if p is not None], dtype=float)
    if len(pts) == 0:
        return [[0] * bins[0]] * bins[1]
    g, _, _ = np.histogram2d(pts[:, 0], pts[:, 1], bins=bins,
                             range=[[0, dims[0]], [0, dims[1]]])
    g = gaussian_filter(g.T, sigma=1.5)
    g = (g / g.max() * 99).astype(int) if g.max() > 0 else g.astype(int)
    return g.tolist()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--data-dir", required=True)
    ap.add_argument("--video", required=True, help="コックピットに埋め込む mp4 (H.264 推奨)")
    ap.add_argument("--fps", type=float, default=25.0)
    ap.add_argument("--ruleset", default="nfhs", choices=list(RULESETS))
    ap.add_argument("--label", default="トラッキング セッション")
    ap.add_argument("--team-a", default="ホーム")
    ap.add_argument("--team-b", default="ゲスト")
    ap.add_argument("--min-track-s", type=float, default=0.0,
                    help="この秒数未満しか観測されなかったトラックを表示から除外")
    ap.add_argument("--out", default="cockpit.html")
    args = ap.parse_args()

    dims = RULESETS[args.ruleset]
    n, teams, tracks, speeds = load_tracks(
        os.path.join(args.data_dir, "tracks.csv"))
    # 短すぎる断片トラックは UI ノイズになるので除外
    fps = args.fps
    keep = {tid for tid, tr in tracks.items()
            if sum(p is not None for p in tr) >= args.min_track_s * fps}
    tracks = {t: v for t, v in tracks.items() if t in keep}
    speeds = {t: v for t, v in speeds.items() if t in keep}
    teams = {t: v for t, v in teams.items() if t in keep}
    stats = [r for r in csv.DictReader(
        open(os.path.join(args.data_dir, "player_stats.csv")))
        if r["track_id"] in keep]
    heats = {tid: heat_grid(tr, dims) for tid, tr in tracks.items()}
    video_b64 = base64.b64encode(open(args.video, "rb").read()).decode()
    print(f"tracks={len(tracks)} frames={n} video={len(video_b64)//1024}KB")

    data = {
        "fps": args.fps, "n": n, "dims": dims[:2],
        "court": {"L": dims[0], "W": dims[1], "keyLen": dims[2],
                  "keyW": dims[3], "r3": dims[4], "rimX": dims[5],
                  "ftR": dims[6]},
        "teams": teams, "tracks": tracks, "speeds": speeds,
        "heats": heats, "stats": stats,
        "label": args.label,
        "teamNames": {"A": args.team_a, "B": args.team_b},
    }
    html = TEMPLATE.replace("__DATA__", json.dumps(data, ensure_ascii=False)) \
                   .replace("__VIDEO__", video_b64)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"-> {args.out} ({os.path.getsize(args.out) // 1024 // 1024}MB)")


TEMPLATE = r"""<title>CourtScope</title>
<style>
  :root {
    --page: #0d0d0d; --surface: #1a1a19; --raised: #222221;
    --ink: #ffffff; --ink2: #c3c2b7; --muted: #898781;
    --line: #2c2c2a; --hair: rgba(255,255,255,0.10);
    --teamA: #d55181; --teamB: #3987e5; --floor: #383835;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--page); color: var(--ink);
         font-family: system-ui, -apple-system, "Segoe UI", "Hiragino Sans",
         "Noto Sans JP", sans-serif; }
  header { display: flex; align-items: baseline; gap: 14px; padding: 14px 22px;
           border-bottom: 1px solid var(--line); flex-wrap: wrap; }
  .mark { font-weight: 800; letter-spacing: 0.18em; font-size: 15px; }
  .mark span { color: var(--muted); font-weight: 600; }
  .game { color: var(--ink2); font-size: 13px; }
  .clock { margin-left: auto; font-variant-numeric: tabular-nums;
           color: var(--ink2); font-size: 13px; }
  .badge { display: inline-block; width: 9px; height: 9px; border-radius: 50%;
           margin-right: 5px; vertical-align: 1px; }
  main { padding: 16px 22px 40px; max-width: 1500px; margin: 0 auto; }
  .stage { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
           gap: 14px; }
  @media (max-width: 980px) { .stage { grid-template-columns: 1fr; } }
  .panel { background: var(--surface); border: 1px solid var(--hair);
           border-radius: 10px; overflow: hidden; }
  .panel h2 { margin: 0; padding: 10px 14px 8px; font-size: 11px;
              letter-spacing: 0.14em; color: var(--muted); font-weight: 700; }
  video { display: block; width: 100%; height: auto; background: #000; }
  #court { display: block; width: 100%; height: auto; }
  .legend { display: flex; gap: 16px; padding: 8px 14px 12px; font-size: 12px;
            color: var(--ink2); flex-wrap: wrap; }
  .tabs { display: flex; gap: 4px; margin: 18px 0 0; border-bottom: 1px solid var(--line); }
  .tabs button { appearance: none; background: none; border: none; color: var(--muted);
           font: inherit; font-size: 13px; padding: 9px 14px; cursor: pointer;
           border-bottom: 2px solid transparent; }
  .tabs button:hover { color: var(--ink2); }
  .tabs button.on { color: var(--ink); border-bottom-color: var(--ink); }
  .tabs button:focus-visible { outline: 2px solid var(--ink2); outline-offset: -2px; }
  .tabpanel { padding: 16px 2px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px;
          font-variant-numeric: tabular-nums; }
  th, td { text-align: right; padding: 7px 10px; border-bottom: 1px solid var(--line); }
  th:first-child, td:first-child { text-align: left; }
  th { color: var(--muted); font-weight: 600; font-size: 12px; }
  tbody tr { cursor: pointer; }
  tbody tr:hover { background: var(--raised); }
  tbody tr.sel { background: var(--raised); box-shadow: inset 2px 0 0 var(--ink); }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
           gap: 10px; }
  .card { background: var(--surface); border: 1px solid var(--hair);
          border-radius: 8px; padding: 10px; cursor: pointer; }
  .card.sel { outline: 2px solid var(--ink2); }
  .card canvas { width: 100%; height: auto; display: block; border-radius: 4px; }
  .card .t { font-size: 12px; margin-bottom: 6px; color: var(--ink2); }
  .live { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
          gap: 10px; }
  .stat { background: var(--surface); border: 1px solid var(--hair); border-radius: 8px;
          padding: 10px 12px; }
  .stat .who { font-size: 12px; color: var(--ink2); margin-bottom: 4px; }
  .stat .v { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .stat .u { font-size: 12px; color: var(--muted); font-weight: 400; }
  .bar { height: 5px; background: var(--line); border-radius: 3px; margin-top: 7px;
         overflow: hidden; }
  .bar i { display: block; height: 100%; border-radius: 3px; }
  .note { color: var(--muted); font-size: 12px; line-height: 1.8; }
  ul.summary { line-height: 2.0; font-size: 14px; color: var(--ink2); margin: 6px 0; }
  #chart { width: 100%; }
</style>

<header>
  <div class="mark">COURT<span>SCOPE</span></div>
  <div class="game" id="gameLabel"></div>
  <div class="clock"><span id="tNow">0.0</span>s / <span id="tEnd">–</span>s</div>
</header>
<main>
  <div class="stage">
    <div class="panel">
      <h2>トラッキング映像</h2>
      <video id="video" controls muted playsinline
             src="data:video/mp4;base64,__VIDEO__"></video>
    </div>
    <div class="panel">
      <h2>俯瞰コートビュー(映像と同期)</h2>
      <canvas id="court"></canvas>
      <div class="legend" id="legend"></div>
    </div>
  </div>

  <div class="tabs" role="tablist">
    <button class="on" data-tab="live">ライブスタッツ</button>
    <button data-tab="stats">選手スタッツ</button>
    <button data-tab="heat">ヒートマップ</button>
    <button data-tab="sum">サマリー</button>
  </div>
  <div class="tabpanel" id="tp-live">
    <p class="note" id="liveEmpty">映像を再生すると、その時点でコート内にいる選手の速度がここに表示されます。</p>
    <div class="live" id="liveGrid"></div>
  </div>
  <div class="tabpanel" id="tp-stats" hidden>
    <div id="chart"></div>
    <div style="max-height:420px;overflow-y:auto"><table id="statTable"></table></div>
    <p class="note">行をクリックするとコートビューでハイライトされます。トラックIDは
    映像から自動生成された識別子(見切れ・重なりで同一選手が複数トラックに分かれる場合があります)。</p>
  </div>
  <div class="tabpanel" id="tp-heat" hidden><div class="cards" id="heatCards"></div></div>
  <div class="tabpanel" id="tp-sum" hidden>
    <ul class="summary" id="summary"></ul>
    <p class="note">このプロトタイプは選手の位置・速度・走行データを実映像から自動抽出しています。
    ボール検出(パス・シュート推定)は専用モデルの学習が次のステップです。</p>
  </div>
</main>

<script>
const D = __DATA__;
const TEAM = { A: getComputedStyle(document.documentElement).getPropertyValue('--teamA').trim(),
               B: getComputedStyle(document.documentElement).getPropertyValue('--teamB').trim() };
const SEQ = ['#0d366b','#184f95','#1c5cab','#256abf','#2a78d6','#3987e5','#6da7ec','#9ec5f4'];
const ids = Object.keys(D.tracks).sort();
const obsCount = Object.fromEntries(ids.map(t =>
  [t, D.tracks[t].reduce((a, p) => a + (p ? 1 : 0), 0)]));
let selected = null;

document.getElementById('gameLabel').textContent = D.label;
document.getElementById('tEnd').textContent = (D.n / D.fps).toFixed(1);
document.getElementById('legend').innerHTML =
  `<span><span class="badge" style="background:${TEAM.A}"></span>${D.teamNames.A}</span>` +
  `<span><span class="badge" style="background:${TEAM.B}"></span>${D.teamNames.B}</span>` +
  `<span style="color:var(--muted)">クリックで選手を選択</span>`;

// ---------------- コートビュー ----------------
const C = D.court, PPM = 34, PAD = 26;
const cw = C.L * PPM + PAD * 2, ch = C.W * PPM + PAD * 2;
const court = document.getElementById('court');
court.width = cw * 2; court.height = ch * 2;  // retina
const ctx = court.getContext('2d');
ctx.scale(2, 2);
const X = m => PAD + m * PPM, Y = m => PAD + m * PPM;

function drawCourt() {
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = '#161615';
  ctx.fillRect(0, 0, cw, ch);
  ctx.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--floor').trim();
  ctx.lineWidth = 1.2;
  const y1 = (C.W - C.keyW) / 2, y2 = (C.W + C.keyW) / 2;
  ctx.strokeRect(X(0), Y(0), C.L * PPM, C.W * PPM);
  line(C.L/2, 0, C.L/2, C.W);
  circle(C.L/2, C.W/2, C.ftR);
  for (const [bx, s] of [[0, 1], [C.L, -1]]) {
    ctx.strokeRect(Math.min(X(bx), X(bx + s*C.keyLen)), Y(y1),
                   C.keyLen * PPM, C.keyW * PPM);
    circle(bx + s*C.keyLen, C.W/2, C.ftR);
    arc(bx + s*C.rimX, C.W/2, C.r3, s > 0 ? -Math.PI/2 : Math.PI/2,
        s > 0 ? Math.PI/2 : 3*Math.PI/2);
    circle(bx + s*C.rimX, C.W/2, 0.35);
  }
}
function line(a,b,c,d){ctx.beginPath();ctx.moveTo(X(a),Y(b));ctx.lineTo(X(c),Y(d));ctx.stroke();}
function circle(x,y,r){ctx.beginPath();ctx.arc(X(x),Y(y),r*PPM,0,Math.PI*2);ctx.stroke();}
function arc(x,y,r,a0,a1){ctx.beginPath();ctx.arc(X(x),Y(y),r*PPM,a0,a1);ctx.stroke();}

function heatUnder(tid) {
  const g = D.heats[tid]; if (!g) return;
  const rows = g.length, cols = g[0].length;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const v = g[r][c]; if (v < 6) continue;
    ctx.fillStyle = SEQ[Math.min(7, Math.floor(v / 13))] +
        Math.round(30 + v * 1.2).toString(16).padStart(2, '0');
    ctx.fillRect(X(c / cols * C.L), Y(r / rows * C.W),
                 C.L * PPM / cols + 0.5, C.W * PPM / rows + 0.5);
  }
}

function frameAt(t) { return Math.max(0, Math.min(D.n - 1, Math.round(t * D.fps))); }

function drawFrame(f) {
  drawCourt();
  if (selected) heatUnder(selected);
  for (const tid of ids) {
    const tr = D.tracks[tid], p = tr[f];
    const col = TEAM[D.teams[tid]];
    // 軌跡 (直近2秒)
    ctx.beginPath();
    let started = false;
    for (let k = Math.max(0, f - 2 * D.fps); k <= f; k++) {
      const q = tr[k]; if (!q) { started = false; continue; }
      if (!started) { ctx.moveTo(X(q[0]), Y(q[1])); started = true; }
      else ctx.lineTo(X(q[0]), Y(q[1]));
    }
    ctx.strokeStyle = col + (tid === selected ? 'cc' : '55');
    ctx.lineWidth = tid === selected ? 2 : 1;
    ctx.stroke();
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(X(p[0]), Y(p[1]), tid === selected ? 7 : 5.5, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
    if (tid === selected) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 8.5px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(tid.split('-')[1], X(p[0]), Y(p[1]) + 3);
  }
}

court.addEventListener('click', ev => {
  const r = court.getBoundingClientRect();
  const mx = (ev.clientX - r.left) / r.width * cw;
  const my = (ev.clientY - r.top) / r.height * ch;
  const f = frameAt(video.currentTime);
  let best = null, bd = 14;
  for (const tid of ids) {
    const p = D.tracks[tid][f]; if (!p) continue;
    const d = Math.hypot(X(p[0]) - mx, Y(p[1]) - my);
    if (d < bd) { best = tid; bd = d; }
  }
  select(best === selected ? null : best);
});

// ---------------- 同期ループ ----------------
const video = document.getElementById('video');
function tick() {
  const f = frameAt(video.currentTime);
  document.getElementById('tNow').textContent = video.currentTime.toFixed(1);
  drawFrame(f);
  updateLive(f);
  requestAnimationFrame(tick);
}

// ---------------- ライブスタッツ ----------------
const liveGrid = document.getElementById('liveGrid');
const liveEls = {};
for (const tid of ids) {
  const el = document.createElement('div');
  el.className = 'stat';
  el.innerHTML = `<div class="who"><span class="badge" style="background:${TEAM[D.teams[tid]]}"></span>${tid}</div>
    <div class="v"><span class="sp">0.0</span> <span class="u">m/s</span></div>
    <div class="bar"><i style="background:${TEAM[D.teams[tid]]};width:0%"></i></div>`;
  el.addEventListener('click', () => select(tid === selected ? null : tid));
  liveGrid.appendChild(el);
  liveEls[tid] = el;
}
let lastLive = -1;
function updateLive(f) {
  if (f === lastLive) return; lastLive = f;
  let visible = 0;
  for (const tid of ids) {
    const present = !!D.tracks[tid][f];
    liveEls[tid].style.display = present ? '' : 'none';
    if (!present) continue;
    visible++;
    const v = D.speeds[tid][f] || 0;
    liveEls[tid].querySelector('.sp').textContent = v.toFixed(1);
    liveEls[tid].querySelector('.bar i').style.width = Math.min(100, v / 8 * 100) + '%';
  }
  document.getElementById('liveEmpty').style.display = visible ? 'none' : '';
}

// ---------------- 選手スタッツ ----------------
const ZONES = ['walk_m', 'jog_m', 'run_m', 'sprint_m'];
const ZLBL = ['ウォーク', 'ジョグ', 'ラン', 'スプリント'];
const ZCOL = ['#6da7ec', '#3987e5', '#1c5cab', '#0d366b'];
function buildStats() {
  const all = [...D.stats].sort((a, b) =>
      a.team === b.team ? b.total_dist_m - a.total_dist_m : (a.team < b.team ? -1 : 1));
  // チャートは走行距離上位のみ (トラック断片が多い実映像で読めるように)
  const rows = [...all].sort((a, b) => b.total_dist_m - a.total_dist_m)
      .slice(0, 14).sort((a, b) =>
      a.team === b.team ? b.total_dist_m - a.total_dist_m : (a.team < b.team ? -1 : 1));
  const maxD = Math.max(...rows.map(r => +r.total_dist_m));
  // 距離チャート (SVG 積み上げ横棒)
  const bh = 22, gap = 8, w = 860, lw = 64, vw = w - lw - 70;
  let svg = `<svg viewBox="0 0 ${w} ${rows.length * (bh + gap) + 40}" width="100%" role="img" aria-label="走行距離">`;
  rows.forEach((r, i) => {
    const y = i * (bh + gap);
    svg += `<circle cx="10" cy="${y + bh/2}" r="4.5" fill="${TEAM[r.team]}"/>`;
    svg += `<text x="22" y="${y + bh/2 + 4}" fill="var(--ink2)" font-size="12">${r.track_id}</text>`;
    let x = lw;
    ZONES.forEach((z, zi) => {
      const wpx = (+r[z]) / maxD * vw;
      svg += `<rect x="${x}" y="${y}" width="${Math.max(0, wpx - 1.5)}" height="${bh}" rx="2" fill="${ZCOL[zi]}"/>`;
      x += wpx;
    });
    svg += `<text x="${x + 8}" y="${y + bh/2 + 4}" fill="var(--muted)" font-size="12" font-variant-numeric="tabular-nums">${Math.round(r.total_dist_m)} m</text>`;
  });
  const ly = rows.length * (bh + gap) + 16;
  let lx = lw;
  ZLBL.forEach((t, zi) => {
    svg += `<rect x="${lx}" y="${ly - 9}" width="10" height="10" rx="2" fill="${ZCOL[zi]}"/>`;
    svg += `<text x="${lx + 15}" y="${ly}" fill="var(--muted)" font-size="11">${t}</text>`;
    lx += 15 + t.length * 11 + 30;
  });
  svg += '</svg>';
  document.getElementById('chart').innerHTML = svg;

  const tb = document.getElementById('statTable');
  tb.innerHTML = `<thead><tr><th>トラック</th><th>距離[m]</th><th>平均速度</th>
    <th>最高速度</th><th>スプリント</th><th>加速</th></tr></thead><tbody>` +
    all.map(r => `<tr data-tid="${r.track_id}">
      <td><span class="badge" style="background:${TEAM[r.team]}"></span>${r.track_id}</td>
      <td>${Math.round(r.total_dist_m)}</td><td>${(+r.avg_speed_mps).toFixed(2)}</td>
      <td>${(+r.max_speed_mps).toFixed(2)}</td><td>${r.sprint_count}</td>
      <td>${r.accel_count}</td></tr>`).join('') + '</tbody>';
  tb.querySelectorAll('tbody tr').forEach(tr =>
    tr.addEventListener('click', () =>
      select(tr.dataset.tid === selected ? null : tr.dataset.tid)));
}

// ---------------- ヒートマップ ----------------
function buildHeat() {
  const wrap = document.getElementById('heatCards');
  // 観測時間の長い順に上位16トラックのみ表示
  const top = [...ids].sort((a, b) => obsCount[b] - obsCount[a]).slice(0, 16)
      .sort();
  for (const tid of top) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.tid = tid;
    card.innerHTML = `<div class="t"><span class="badge" style="background:${TEAM[D.teams[tid]]}"></span>${tid}</div>`;
    const cv = document.createElement('canvas');
    const g = D.heats[tid], rows = g.length, cols = g[0].length;
    cv.width = cols * 4; cv.height = rows * 4;
    const c2 = cv.getContext('2d');
    c2.fillStyle = '#161615'; c2.fillRect(0, 0, cv.width, cv.height);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const v = g[r][c]; if (v < 4) continue;
      c2.fillStyle = SEQ[Math.min(7, Math.floor(v / 13))];
      c2.globalAlpha = 0.25 + v / 130;
      c2.fillRect(c * 4, r * 4, 4, 4);
    }
    c2.globalAlpha = 1;
    card.appendChild(cv);
    card.addEventListener('click', () => select(tid === selected ? null : tid));
    wrap.appendChild(card);
  }
}

// ---------------- サマリー ----------------
function buildSummary() {
  const rows = D.stats;
  const top = rows.reduce((a, b) => +a.total_dist_m > +b.total_dist_m ? a : b);
  const fast = rows.reduce((a, b) => +a.max_speed_mps > +b.max_speed_mps ? a : b);
  const spr = rows.reduce((a, b) => +a.sprint_count > +b.sprint_count ? a : b);
  const per = (D.n / D.fps / 60).toFixed(1);
  const items = [
    `解析区間は ${per} 分、有効トラック ${ids.length} 本。`,
    `最長走行距離は ${top.track_id}(${Math.round(top.total_dist_m)}m)。`,
    `最高速度は ${fast.track_id}(${(+fast.max_speed_mps).toFixed(1)} m/s)。`,
    `スプリント最多は ${spr.track_id}(${spr.sprint_count} 回)。`,
  ];
  document.getElementById('summary').innerHTML =
      items.map(s => `<li>${s}</li>`).join('');
}

// ---------------- タブ・選択 ----------------
document.querySelectorAll('.tabs button').forEach(b =>
  b.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    for (const id of ['live', 'stats', 'heat', 'sum'])
      document.getElementById('tp-' + id).hidden = id !== b.dataset.tab;
  }));

function select(tid) {
  selected = tid;
  document.querySelectorAll('#statTable tbody tr').forEach(tr =>
    tr.classList.toggle('sel', tr.dataset.tid === tid));
  document.querySelectorAll('.card').forEach(c =>
    c.classList.toggle('sel', c.dataset.tid === tid));
}

buildStats(); buildHeat(); buildSummary();
drawFrame(0); updateLive(0);
requestAnimationFrame(tick);
</script>
"""

if __name__ == "__main__":
    main()
