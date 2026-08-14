#!/usr/bin/env python3
"""エンドツーエンド実行:

1. 試合シミュレーション + ダミー映像生成 (raw.mp4 / 真値ログ)
2. 映像のみを入力に 検出 → トラッキング (真値は不使用)
3. ホモグラフィでコート座標 (m) へ変換
4. フィジカル指標・ポゼッション・パス・シュートの推定
5. 真値との突合による精度評価
6. HTML レポート + 注釈付き映像 + CSV/JSON 出力

usage: python run_pipeline.py --duration 60 --seed 42 --out output
"""

import argparse
import csv
import json
import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from bball_tracker.analytics import Analyzer  # noqa: E402
from bball_tracker.calibration import CourtCalibration  # noqa: E402
from bball_tracker.config import (  # noqa: E402
    DetectConfig,
    RenderConfig,
    SimConfig,
    TrackConfig,
)
from bball_tracker.detection import ColorDetector  # noqa: E402
from bball_tracker.evaluate import evaluate_events, evaluate_tracks  # noqa: E402
from bball_tracker.renderer import CourtRenderer  # noqa: E402
from bball_tracker.report import TEAM_COLOR, build_report  # noqa: E402
from bball_tracker.simulation import GameSimulator  # noqa: E402
from bball_tracker.tracking import BallTracker, TeamTracker  # noqa: E402


def _writer(path, fps, size):
    w = cv2.VideoWriter(path, cv2.VideoWriter_fourcc(*"mp4v"), fps, size)
    if not w.isOpened():
        raise RuntimeError(f"VideoWriter を開けません: {path}")
    return w


def generate_video(sim_cfg: SimConfig, render_cfg: RenderConfig, out_path: str):
    print("[1/6] 試合シミュレーション + ダミー映像生成 ...")
    sim = GameSimulator(sim_cfg)
    frames_gt, events_gt = sim.run()
    renderer = CourtRenderer(render_cfg)
    numbers = {pid: p.number for pid, p in sim.players.items()}
    teams = {pid: p.team for pid, p in sim.players.items()}
    writer = _writer(out_path, sim_cfg.fps, (renderer.w, renderer.h))
    for f in frames_gt:
        writer.write(renderer.render(f["players"], f["ball"], numbers, teams))
    writer.release()
    print(f"      {len(frames_gt)} フレーム -> {out_path} / 最終スコア {sim.score}")
    return frames_gt, events_gt, sim.score, renderer


def track_video(video_path: str, fps: int, n_teams: int):
    """映像ファイルのみを入力としたトラッキング (パイプライン本体)."""
    print("[2/6] 検出 + トラッキング (入力は映像のみ) ...")
    det = ColorDetector(DetectConfig())
    tcfg = TrackConfig()
    dt = 1.0 / fps
    trackers = {t: TeamTracker(t, n_teams, dt, tcfg) for t in ("A", "B")}
    ball_tracker = BallTracker(dt, tcfg)

    cap = cv2.VideoCapture(video_path)
    per_frame = []  # 注釈描画・座標変換用の生トラッキング結果 (px)
    f = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        dets = det.detect(frame)
        row = {"players": [], "ball": None}
        for team in ("A", "B"):
            tracks = trackers[team].step([d for d in dets if d.kind == team])
            for tr in tracks:
                if tr.hits >= tcfg.min_hits:
                    row["players"].append(
                        (tr.track_id, team, float(tr.kf.pos[0]),
                         float(tr.kf.pos[1]), tr.detected))
        ball = [d for d in dets if d.kind == "ball"]
        pos, detected = ball_tracker.step(ball[0] if ball else None)
        if pos is not None:
            row["ball"] = (float(pos[0]), float(pos[1]), detected)
        per_frame.append(row)
        f += 1
    cap.release()
    print(f"      {f} フレーム処理完了")
    return per_frame


def to_court_coords(per_frame, calib: CourtCalibration):
    print("[3/6] ホモグラフィによるコート座標変換 ...")
    n = len(per_frame)
    track_ids = {}
    for row in per_frame:
        for tid, team, *_ in row["players"]:
            track_ids[tid] = team
    player_tracks = {
        tid: {"team": team, "xy": np.full((n, 2), np.nan),
              "detected": np.zeros(n, dtype=bool)}
        for tid, team in track_ids.items()
    }
    ball_xy = np.full((n, 2), np.nan)
    ball_detected = np.zeros(n, dtype=bool)
    for f, row in enumerate(per_frame):
        if row["players"]:
            pts = np.array([[x, y] for _, _, x, y, _ in row["players"]])
            court = calib.px_to_court(pts)
            for (tid, team, _, _, det), c in zip(row["players"], court):
                player_tracks[tid]["xy"][f] = c
                player_tracks[tid]["detected"][f] = det
        if row["ball"] is not None:
            bx, by, det = row["ball"]
            ball_xy[f] = calib.px_to_court(np.array([[bx, by]]))[0]
            ball_detected[f] = det
    return player_tracks, ball_xy, ball_detected


def annotate_video(video_path: str, out_path: str, fps: int, per_frame,
                   res, frames_gt, renderer: CourtRenderer):
    print("[6/6] 注釈付き映像の出力 ...")
    holder_by_frame = {}
    for s in res.possessions:
        for f in range(s["f0"], s["f1"] + 1):
            holder_by_frame[f] = s["track_id"]
    colors = {t: tuple(int(TEAM_COLOR[t][i:i + 2], 16) for i in (5, 3, 1))
              for t in ("A", "B")}  # hex -> BGR
    cap = cv2.VideoCapture(video_path)
    writer = _writer(out_path, fps, (renderer.w, renderer.h))
    trails = {}
    f = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        row = per_frame[f]
        for tid, team, x, y, det in row["players"]:
            c = (int(x), int(y))
            trails.setdefault(tid, []).append(c)
            pts = np.array(trails[tid][-30:], dtype=np.int32)
            cv2.polylines(frame, [pts], False, colors[team], 1, cv2.LINE_AA)
            r = 14 if holder_by_frame.get(f) == tid else 12
            cv2.circle(frame, c, r, (255, 255, 255), 2 if det else 1)
            if holder_by_frame.get(f) == tid:
                cv2.circle(frame, c, r + 4, (60, 220, 255), 2)
            cv2.putText(frame, tid, (c[0] - 14, c[1] - 16),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1,
                        cv2.LINE_AA)
        if row["ball"] is not None:
            bx, by, det = row["ball"]
            cv2.drawMarker(frame, (int(bx), int(by)), (255, 255, 255),
                           cv2.MARKER_CROSS, 16, 2)
        gt = frames_gt[f]
        hud = (f"t={f / fps:5.1f}s   A {gt['score']['A']} - "
               f"{gt['score']['B']} B   tracks={len(row['players'])}")
        cv2.rectangle(frame, (6, 6), (330, 32), (30, 30, 30), -1)
        cv2.putText(frame, hud, (12, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.55,
                    (255, 255, 255), 1, cv2.LINE_AA)
        writer.write(frame)
        f += 1
    cap.release()
    writer.release()
    print(f"      -> {out_path}")


def export_data(out_dir, res, player_tracks, ball_xy, ball_detected,
                events_gt, score, evaluation, event_eval, fps):
    with open(os.path.join(out_dir, "tracks.csv"), "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["frame", "t", "track_id", "team", "x_m", "y_m",
                    "speed_mps", "detected"])
        for tid, p in sorted(res.players.items()):
            det = player_tracks[tid]["detected"]
            for f in range(len(p["xy"])):
                if np.isnan(p["xy"][f]).any():
                    continue
                w.writerow([f, round(f / fps, 3), tid, p["team"],
                            round(float(p["xy"][f, 0]), 3),
                            round(float(p["xy"][f, 1]), 3),
                            round(float(p["speed"][f]), 3), int(det[f])])
    with open(os.path.join(out_dir, "ball.csv"), "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["frame", "t", "x_m", "y_m", "detected"])
        for f in range(len(ball_xy)):
            if np.isnan(res.ball_xy[f]).any():
                continue
            w.writerow([f, round(f / fps, 3),
                        round(float(res.ball_xy[f, 0]), 3),
                        round(float(res.ball_xy[f, 1]), 3),
                        int(ball_detected[f])])
    with open(os.path.join(out_dir, "player_stats.csv"), "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["track_id", "team", "total_dist_m", "avg_speed_mps",
                    "max_speed_mps", "walk_m", "jog_m", "run_m", "sprint_m",
                    "sprint_count", "accel_count", "touches", "passes", "shots"])
        for m in res.metrics:
            w.writerow([m.track_id, m.team, round(m.total_dist, 1),
                        round(m.avg_speed, 2), round(m.max_speed, 2),
                        *[round(z, 1) for z in m.zone_dist],
                        m.sprint_count, m.accel_count, m.touches,
                        m.passes, m.shots])
    dump = lambda name, obj: json.dump(
        obj, open(os.path.join(out_dir, name), "w"), ensure_ascii=False, indent=2)
    dump("events_detected.json", {
        "passes": res.passes, "turnovers": res.turnovers, "shots": res.shots,
        "possessions": [{k: (round(v, 2) if isinstance(v, float) else v)
                         for k, v in s.items()} for s in res.possessions],
        "team_possession_s": {k: round(v, 1)
                              for k, v in res.team_possession_s.items()},
    })
    dump("events_ground_truth.json", {"score": score, "events": events_gt})
    dump("evaluation.json", {"tracking": evaluation, "events": event_eval})


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--duration", type=float, default=60.0, help="試合秒数")
    ap.add_argument("--fps", type=int, default=25)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default="output")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    sim_cfg = SimConfig(fps=args.fps, duration_s=args.duration, seed=args.seed)
    render_cfg = RenderConfig()

    raw_path = os.path.join(args.out, "raw.mp4")
    frames_gt, events_gt, score, renderer = generate_video(
        sim_cfg, render_cfg, raw_path)

    per_frame = track_video(raw_path, args.fps, sim_cfg.n_per_team)

    # 実運用ではコート基準点 (4隅等) をユーザー指定 → ここでは既知のレンダラ値
    calib = CourtCalibration(renderer.court_corners_px())
    player_tracks, ball_xy, ball_detected = to_court_coords(per_frame, calib)

    print("[4/6] 指標算出・イベント推定 ...")
    res = Analyzer(args.fps).run(player_tracks, ball_xy, len(per_frame))
    print(f"      推定: パス {len(res.passes)} / TO {len(res.turnovers)} / "
          f"シュート {len(res.shots)} / 保持区間 {len(res.possessions)}")

    print("[5/6] 真値との突合評価 ...")
    evaluation = evaluate_tracks(
        {tid: {"team": d["team"], "xy": res.players[tid]["xy"]}
         for tid, d in player_tracks.items()},
        res.ball_xy, frames_gt, events_gt, args.fps)
    event_eval = {
        "パス": evaluate_events(res.passes, events_gt, "pass"),
        "シュート": evaluate_events(res.shots, events_gt, "shot"),
        "ターンオーバー": evaluate_events(res.turnovers, events_gt, "interception"),
    }
    print(f"      位置RMSE {evaluation['player_position_rmse_m']:.3f}m / "
          f"ID一貫性 {evaluation['id_consistency']:.1%} / "
          f"ボール検出 {evaluation['ball_coverage']:.1%}")

    export_data(args.out, res, player_tracks, ball_xy, ball_detected,
                events_gt, score, evaluation, event_eval, args.fps)
    build_report(res, args.duration, os.path.join(args.out, "report.html"),
                 gt_events=events_gt, evaluation=evaluation,
                 event_eval=event_eval, score=score, source_label="ダミー映像")
    print(f"      -> {args.out}/report.html ほか CSV/JSON")

    annotate_video(raw_path, os.path.join(args.out, "annotated.mp4"),
                   args.fps, per_frame, res, frames_gt, renderer)
    print("完了")


if __name__ == "__main__":
    main()
