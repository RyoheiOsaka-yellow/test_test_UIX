"""分析結果の HTML レポート生成 (グラフは PNG を base64 埋め込み)."""

import base64
import io

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import matplotlib_fontja  # noqa: F401,E402  日本語フォント登録
import numpy as np  # noqa: E402
from matplotlib.colors import LinearSegmentedColormap  # noqa: E402
from scipy.ndimage import gaussian_filter  # noqa: E402

from .analytics import AnalysisResult, Analyzer  # noqa: E402
from .config import (  # noqa: E402
    BASKET_LEFT,
    BASKET_RIGHT,
    COURT_LENGTH,
    COURT_WIDTH,
    SPEED_ZONE_LABELS,
    THREE_POINT_R,
)

# 検証済みパレット (light): チーム色は青/赤ペア、逐次配色は青ランプ
SURFACE = "#fcfcfb"
PAGE = "#f9f9f7"
INK = "#0b0b0b"
INK2 = "#52514e"
MUTED = "#898781"
GRID = "#e1e0d9"
BASELINE = "#c3c2b7"
TEAM_COLOR = {"A": "#e34948", "B": "#2a78d6"}
TEAM_NAME = {"A": "チームA (赤)", "B": "チームB (青)"}
ZONE_COLORS = ["#86b6ef", "#3987e5", "#256abf", "#0d366b"]  # 序数: 遅い→速い
SEQ_CMAP = LinearSegmentedColormap.from_list(
    "seq_blue", [SURFACE, "#cde2fb", "#86b6ef", "#3987e5", "#256abf", "#0d366b"])

plt.rcParams.update({
    "figure.facecolor": SURFACE, "axes.facecolor": SURFACE,
    "text.color": INK, "axes.edgecolor": BASELINE,
    "axes.labelcolor": INK2, "xtick.color": MUTED, "ytick.color": MUTED,
    "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.8,
    "axes.spines.top": False, "axes.spines.right": False,
    "font.size": 10,
})


def _b64(fig) -> str:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=130, bbox_inches="tight",
                facecolor=fig.get_facecolor())
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode()


def _draw_court(ax, line_color=BASELINE, lw=1.2):
    ax.add_patch(plt.Rectangle((0, 0), COURT_LENGTH, COURT_WIDTH,
                               fill=False, color=line_color, lw=lw))
    ax.plot([COURT_LENGTH / 2] * 2, [0, COURT_WIDTH], color=line_color, lw=lw)
    ax.add_patch(plt.Circle((COURT_LENGTH / 2, COURT_WIDTH / 2), 1.8,
                            fill=False, color=line_color, lw=lw))
    for bx, by in (BASKET_LEFT, BASKET_RIGHT):
        ax.add_patch(plt.Circle((bx, by), 0.45, fill=False, color=line_color, lw=lw))
        theta = np.linspace(-np.pi / 2, np.pi / 2, 60)
        sign = 1 if bx < COURT_LENGTH / 2 else -1
        ax.plot(bx + sign * THREE_POINT_R * np.cos(theta),
                by + THREE_POINT_R * np.sin(theta), color=line_color, lw=lw)
    ax.set_xlim(-0.5, COURT_LENGTH + 0.5)
    ax.set_ylim(COURT_WIDTH + 0.5, -0.5)
    ax.set_aspect("equal")
    ax.axis("off")


def _sorted_metrics(res: AnalysisResult):
    return sorted(res.metrics, key=lambda m: (m.team, -m.total_dist))


def chart_distance_zones(res: AnalysisResult) -> str:
    ms = _sorted_metrics(res)
    labels = [m.track_id for m in ms]
    fig, ax = plt.subplots(figsize=(8, 4.4))
    left = np.zeros(len(ms))
    for z in range(4):
        vals = np.array([m.zone_dist[z] for m in ms])
        ax.barh(labels, vals, left=left, height=0.62, color=ZONE_COLORS[z],
                label=SPEED_ZONE_LABELS[z], edgecolor=SURFACE, linewidth=1.5)
        left += vals
    for i, m in enumerate(ms):
        ax.text(left[i] + 8, i, f"{m.total_dist:.0f} m", va="center",
                fontsize=9, color=INK2)
        ax.plot([-14], [i], "o", color=TEAM_COLOR[m.team], markersize=8,
                clip_on=False)
    ax.invert_yaxis()
    ax.set_xlim(0, left.max() * 1.16)
    ax.set_xlabel("走行距離 [m]")
    ax.set_title("選手別 走行距離(速度ゾーン内訳)", color=INK, fontsize=12)
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.14), ncols=4,
              fontsize=8, frameon=False)
    ax.grid(axis="y", visible=False)
    return _b64(fig)


def chart_speed_profile(res: AnalysisResult) -> str:
    ms = _sorted_metrics(res)
    labels = [m.track_id for m in ms]
    x = np.arange(len(ms))
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(9, 3.4))
    for ax, key, title, unit in (
        (ax1, "max_speed", "最高速度", "m/s"),
        (ax2, "sprint_count", "スプリント回数 (>5.5m/s 0.8秒以上)", "回"),
    ):
        vals = [getattr(m, key) for m in ms]
        colors = [TEAM_COLOR[m.team] for m in ms]
        ax.bar(x, vals, width=0.62, color=colors, edgecolor=SURFACE, linewidth=1.5)
        ax.set_xticks(x, labels, rotation=45, ha="right", fontsize=8)
        ax.set_title(title, color=INK, fontsize=11)
        ax.set_ylabel(unit)
        ax.grid(axis="x", visible=False)
        if key == "sprint_count":
            ax.yaxis.set_major_locator(
                matplotlib.ticker.MaxNLocator(integer=True))
    fig.tight_layout()
    return _b64(fig)


def chart_heatmaps(res: AnalysisResult) -> str:
    tids = sorted(res.players.keys())
    rows = (len(tids) + 4) // 5
    fig, axes = plt.subplots(rows, 5, figsize=(13, 1.9 * rows + 0.6))
    axes = np.atleast_2d(axes)
    for ax in axes.flat:
        ax.axis("off")
    for ax, tid in zip(axes.flat, tids):
        grid = Analyzer.heatmap_grid(res.players[tid]["xy"])
        grid = gaussian_filter(grid, sigma=1.6)
        ax.imshow(grid, extent=[0, COURT_LENGTH, COURT_WIDTH, 0],
                  cmap=SEQ_CMAP, aspect="equal")
        _draw_court(ax, line_color=MUTED, lw=0.7)
        ax.set_title(tid, fontsize=9, color=TEAM_COLOR[res.players[tid]["team"]])
    fig.suptitle("選手別ポジショニング・ヒートマップ(滞在密度: 薄→濃)",
                 color=INK, fontsize=12, y=1.0)
    fig.tight_layout()
    return _b64(fig)


def chart_pass_network(res: AnalysisResult) -> str:
    fig, axes = plt.subplots(1, 2, figsize=(12, 3.6))
    for ax, team in zip(axes, ("A", "B")):
        _draw_court(ax)
        tids = [t for t, p in res.players.items() if p["team"] == team]
        avg = {t: np.nanmean(res.players[t]["xy"], axis=0) for t in tids}
        counts = {}
        for ev in res.passes:
            if ev["from"] in tids and ev["to"] in tids:
                key = (ev["from"], ev["to"])
                counts[key] = counts.get(key, 0) + 1
        for (a, b), c in counts.items():
            pa, pb = avg[a], avg[b]
            ax.annotate("", xy=pb, xytext=pa, arrowprops=dict(
                arrowstyle="-|>", color=TEAM_COLOR[team],
                lw=0.8 + 0.9 * c, alpha=0.65,
                shrinkA=12, shrinkB=12))
        touches = {m.track_id: m.touches for m in res.metrics}
        for t in tids:
            size = 90 + 28 * touches.get(t, 0)
            ax.scatter(*avg[t], s=size, color=TEAM_COLOR[team], zorder=5,
                       edgecolor=SURFACE, linewidth=1.5)
            ax.text(avg[t][0], avg[t][1], t.split("-")[1], ha="center",
                    va="center", fontsize=8, color="white", zorder=6)
        ax.set_title(f"{TEAM_NAME[team]} パスネットワーク(ノード=平均位置・大きさ=タッチ数)",
                     fontsize=10, color=INK)
    fig.tight_layout()
    return _b64(fig)


def chart_possession_timeline(res: AnalysisResult) -> str:
    fig, ax = plt.subplots(figsize=(11, 2.2))
    for s in res.possessions:
        ax.barh(0, s["t1"] - s["t0"], left=s["t0"], height=0.5,
                color=TEAM_COLOR[s["team"]], edgecolor=SURFACE, linewidth=0.5)
    for shot in res.shots:
        ax.plot(shot["t"], 0.45, marker="v", color=TEAM_COLOR[shot["team"]],
                markersize=7, markeredgecolor=SURFACE)
    ax.set_ylim(-0.6, 0.9)
    ax.set_yticks([])
    ax.set_xlabel("時間 [s]")
    ax.set_title("ボール保持の推移(▼ = シュート推定)", color=INK, fontsize=11)
    handles = [plt.Rectangle((0, 0), 1, 1, color=TEAM_COLOR[t]) for t in ("A", "B")]
    ax.legend(handles, [TEAM_NAME["A"], TEAM_NAME["B"]], loc="upper right",
              fontsize=8, frameon=False, ncols=2)
    ax.grid(axis="y", visible=False)
    return _b64(fig)


def chart_shot_chart(res: AnalysisResult, gt_shots: list) -> str:
    fig, axes = plt.subplots(1, 2, figsize=(12, 3.6))
    ax = axes[0]
    _draw_court(ax)
    for s in res.shots:
        ax.scatter(s["x"], s["y"], s=70, color=TEAM_COLOR[s["team"]],
                   edgecolor=SURFACE, linewidth=1.2, zorder=5)
    ax.set_title("シュートチャート(トラッキングからの推定)", fontsize=10, color=INK)
    ax = axes[1]
    _draw_court(ax)
    for s in gt_shots:
        team = s["player"][0]
        if s["made"]:
            ax.scatter(s["x"], s["y"], s=70, color=TEAM_COLOR[team],
                       edgecolor=SURFACE, linewidth=1.2, zorder=5)
        else:
            ax.scatter(s["x"], s["y"], s=60, marker="x", color=MUTED,
                       linewidth=1.8, zorder=5)
    ax.set_title("シュートチャート(真値: ●=成功 ×=失敗)", fontsize=10, color=INK)
    fig.tight_layout()
    return _b64(fig)


# ---------------------------------------------------------------- HTML
def _table(headers, rows) -> str:
    th = "".join(f"<th>{h}</th>" for h in headers)
    trs = "".join(
        "<tr>" + "".join(f"<td>{c}</td>" for c in row) + "</tr>" for row in rows)
    return f"<table><thead><tr>{th}</tr></thead><tbody>{trs}</tbody></table>"


def _fmt_pct(v):
    return "-" if v is None else f"{v * 100:.1f}%"


def build_report(res: AnalysisResult, gt_events: list, evaluation: dict,
                 event_eval: dict, duration_s: float, score: dict,
                 out_path: str):
    charts = {
        "dist": chart_distance_zones(res),
        "speed": chart_speed_profile(res),
        "heat": chart_heatmaps(res),
        "net": chart_pass_network(res),
        "timeline": chart_possession_timeline(res),
        "shots": chart_shot_chart(res, [e for e in gt_events if e["type"] == "shot"]),
    }

    pos = res.team_possession_s
    pos_total = max(pos["A"] + pos["B"], 1e-6)
    ms = _sorted_metrics(res)
    stat_rows = [
        [m.track_id, TEAM_NAME[m.team].split(" ")[0], f"{m.total_dist:.0f}",
         f"{m.avg_speed:.2f}", f"{m.max_speed:.2f}", m.sprint_count,
         m.accel_count, m.touches, m.passes, m.shots]
        for m in ms
    ]
    ev = evaluation
    eval_rows = [
        ["選手位置 RMSE", f"{ev['player_position_rmse_m']:.3f} m"],
        ["選手検出カバレッジ", _fmt_pct(ev["player_coverage"])],
        ["ID 一貫性", _fmt_pct(ev["id_consistency"])],
        ["ボール検出カバレッジ", _fmt_pct(ev["ball_coverage"])],
        ["ボール位置 RMSE", f"{ev['ball_position_rmse_m']:.3f} m"],
    ]
    ee_rows = [
        [name,
         d["gt_count"], d["detected_count"], d["true_positive"],
         _fmt_pct(d["precision"]), _fmt_pct(d["recall"])]
        for name, d in event_eval.items()
    ]
    gt_pass = sum(1 for e in gt_events if e["type"] == "pass")

    insights = []
    pa = pos["A"] / pos_total * 100
    insights.append(
        f"ボール保持率は チームA {pa:.0f}% / チームB {100 - pa:.0f}%。")
    top = max(res.metrics, key=lambda m: m.total_dist)
    insights.append(
        f"最長走行距離は {top.track_id}({top.total_dist:.0f}m、"
        f"スプリント {top.sprint_count} 回)。")
    if res.shots:
        avg_d = np.mean([s["dist"] for s in res.shots])
        threes = sum(1 for s in res.shots if s["three"])
        insights.append(
            f"推定シュート {len(res.shots)} 本(うち3P圏 {threes} 本、"
            f"平均距離 {avg_d:.1f}m)。")
    insights.append(
        f"推定パス {len(res.passes)} 本(真値 {gt_pass} 本)、"
        f"ターンオーバー推定 {len(res.turnovers)} 回。")

    html = f"""<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>試合トラッキングレポート</title>
<style>
  body {{ margin:0; background:{PAGE}; color:{INK};
         font-family: system-ui, -apple-system, "Segoe UI", "Hiragino Sans",
         "Noto Sans JP", sans-serif; }}
  main {{ max-width: 1080px; margin: 0 auto; padding: 24px 20px 60px; }}
  h1 {{ font-size: 24px; margin: 8px 0 2px; }}
  h2 {{ font-size: 17px; margin: 34px 0 10px; color:{INK}; }}
  .sub {{ color:{INK2}; font-size: 13px; }}
  .score {{ display:flex; gap:18px; align-items:baseline; margin:14px 0;
            font-variant-numeric: tabular-nums; }}
  .score b {{ font-size: 34px; }}
  .badge {{ display:inline-block; width:10px; height:10px; border-radius:50%;
            margin-right:6px; }}
  .card {{ background:{SURFACE}; border:1px solid rgba(11,11,11,0.10);
           border-radius:10px; padding:16px 18px; margin:12px 0; }}
  img {{ max-width:100%; height:auto; }}
  table {{ border-collapse: collapse; width:100%; font-size:13px;
           font-variant-numeric: tabular-nums; }}
  th, td {{ text-align:left; padding:6px 10px; border-bottom:1px solid {GRID}; }}
  th {{ color:{INK2}; font-weight:600; }}
  ul {{ line-height:1.9; }}
  .note {{ color:{MUTED}; font-size:12px; }}
</style></head><body><main>
<h1>🏀 試合トラッキングレポート</h1>
<div class="sub">ダミー映像 {duration_s:.0f} 秒 / {res.fps}fps ・
検出→トラッキング→コート座標変換→分析の全自動パイプライン出力</div>
<div class="score">
  <span><span class="badge" style="background:{TEAM_COLOR['A']}"></span>
  チームA <b>{score['A']}</b></span> <span>-</span>
  <span><b>{score['B']}</b> チームB
  <span class="badge" style="background:{TEAM_COLOR['B']}"></span></span>
</div>

<div class="card"><h2 style="margin-top:0">戦術サマリー(自動生成)</h2>
<ul>{"".join(f"<li>{s}</li>" for s in insights)}</ul></div>

<h2>フィジカル指標</h2>
<div class="card"><img src="data:image/png;base64,{charts['dist']}" alt="走行距離"></div>
<div class="card"><img src="data:image/png;base64,{charts['speed']}" alt="速度指標"></div>
<div class="card">{_table(
    ["トラック", "チーム", "距離[m]", "平均速度", "最高速度", "スプリント",
     "加速", "タッチ", "パス", "シュート"], stat_rows)}
<div class="note">トラックIDは映像から自動生成された識別子(実運用では背番号OCR等で実名に紐付け)。</div></div>

<h2>ポジショニング</h2>
<div class="card"><img src="data:image/png;base64,{charts['heat']}" alt="ヒートマップ"></div>

<h2>ボール運び</h2>
<div class="card"><img src="data:image/png;base64,{charts['timeline']}" alt="保持タイムライン"></div>
<div class="card"><img src="data:image/png;base64,{charts['net']}" alt="パスネットワーク"></div>

<h2>シュート</h2>
<div class="card"><img src="data:image/png;base64,{charts['shots']}" alt="シュートチャート"></div>

<h2>トラッキング精度(真値との突合)</h2>
<div class="card">{_table(["指標", "値"], eval_rows)}</div>
<div class="card">{_table(
    ["イベント", "真値数", "検出数", "一致", "適合率", "再現率"], ee_rows)}
<div class="note">イベントは ±1.5 秒以内の時刻一致でマッチング。</div></div>

<div class="note">このレポートはプロトタイプの自動生成物です。実映像への適用時は
検出器を YOLO 系に、キャリブレーションをコート基準点指定に差し替えます。</div>
</main></body></html>"""
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)
