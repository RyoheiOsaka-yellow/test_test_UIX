#!/usr/bin/env python3
"""実映像トラッキングパイプライン:

1. YOLO による選手検出 + ユニフォーム色によるチーム分類
2. カメラ運動補償 (パン・ズームを基準フレームへ連結)
3. コート基準点 (キャリブレーション JSON) によるホモグラフィで実座標 [m] 化
4. コート内フィルタ → チーム別トラッキング (カルマン + ハンガリアン)
5. フィジカル指標・ヒートマップ等の分析 → HTML レポート + 注釈付き映像

映像はストリーミングで2パス処理する (フレームは保持しない):
  pass1: 検出 + 胴体色抽出 + カメラ運動推定
  pass2: 注釈付き映像の描画

キャリブレーション JSON の形式:
{
  "ref_frame": 0,                     # 基準フレーム番号 (--start 適用後の相対)
  "points": [
    {"court": [x_m, y_m], "img": [x_px, y_px]},  # 4点以上
    ...
  ]
}

usage:
  python run_real_pipeline.py --video game.mp4 --calib calib.json \
      --start 60 --duration 60 --out output_real
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
from bball_tracker.camera_motion import (  # noqa: E402
    CameraMotionEstimator,
    apply_h,
)
from bball_tracker.config import (  # noqa: E402
    COURT_LENGTH,
    COURT_WIDTH,
    TrackConfig,
)
from bball_tracker.detection import Detection  # noqa: E402
from bball_tracker.real_detection import (  # noqa: E402
    TeamColorClassifier,
    YoloPersonDetector,
    torso_color,
)
from bball_tracker.report import TEAM_COLOR, build_report  # noqa: E402
from bball_tracker.tracking import TeamTracker  # noqa: E402

COURT_MARGIN = 1.0  # コート外周のこの幅 [m] までは競技者とみなす

# コート寸法プリセット: (長さ, 幅, キー長, キー幅, 3P半径, リング-エンドライン距離, FT円半径)
RULESETS = {
    "fiba": (28.0, 15.0, 5.8, 4.9, 6.75, 1.575, 1.8),
    "nfhs": (25.60, 15.24, 5.79, 3.66, 6.02, 1.60, 1.83),  # 米国高校 84x50ft
}


def load_calibration(path: str):
    d = json.load(open(path))
    img_pts = np.array([p["img"] for p in d["points"]], np.float32)
    court_pts = np.array([p["court"] for p in d["points"]], np.float32)
    H, _ = cv2.findHomography(img_pts, court_pts, 0)
    dims = RULESETS[d.get("ruleset", "fiba")]
    masks = [tuple(m) for m in d.get("static_masks", [])]
    return d.get("ref_frame", 0), H, dims, masks


def iter_frames(video, start_s, duration_s):
    cap = cv2.VideoCapture(video)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(start_s * fps))
    n_max = int(duration_s * fps) if duration_s else 10 ** 9
    i = 0
    while i < n_max:
        ok, f = cap.read()
        if not ok:
            break
        yield i, f
        i += 1
    cap.release()


def video_fps(video):
    cap = cv2.VideoCapture(video)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    cap.release()
    return fps


def in_court(pt, dims, margin=COURT_MARGIN):
    return (-margin <= pt[0] <= dims[0] + margin
            and -margin <= pt[1] <= dims[1] + margin)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--video", required=True)
    ap.add_argument("--calib", required=True)
    ap.add_argument("--start", type=float, default=0.0, help="開始秒")
    ap.add_argument("--duration", type=float, default=60.0)
    ap.add_argument("--out", default="output_real")
    ap.add_argument("--weights", default="yolov8m.pt")
    ap.add_argument("--imgsz", type=int, default=1280)
    ap.add_argument("--static-camera", action="store_true",
                    help="固定カメラ (運動補償をスキップ)")
    ap.add_argument("--max-tracks", type=int, default=7,
                    help="チーム毎の同時トラック上限 (見切れ再入場のフラグメント含む)")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    fps = video_fps(args.video)
    ref_frame, H_court_from_ref, dims, static_masks = load_calibration(args.calib)
    detector = YoloPersonDetector(args.weights, args.imgsz)
    est = None if args.static_camera else CameraMotionEstimator()

    print("[1/5] 検出 + カメラ運動推定 (pass1) ...")
    detections = []      # frame -> [PersonDet] (胴体色を .color に付与)
    H_first_from = []    # frame -> H(現在→先頭)
    for i, frame in iter_frames(args.video, args.start, args.duration):
        dets = detector.detect(frame)
        for d in dets:
            d.color = torso_color(frame, d)
        detections.append(dets)
        if est is not None:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            # 動体 (選手) と静止オーバーレイ (スコアバグ等) を特徴点から除外
            boxes = [(d.x1, d.y1, d.x2, d.y2) for d in dets] + list(static_masks)
            H_first_from.append(est.step(gray, boxes))
        else:
            H_first_from.append(np.eye(3))
        if (i + 1) % 100 == 0:
            print(f"      {i + 1} フレーム処理")
    n = len(detections)
    duration_s = n / fps
    print(f"      合計 {n} フレーム @ {fps:.1f}fps")
    if est is not None:
        print(f"      カメラ補償: 絶対アンカー {est.anchor_frames} / "
              f"LK連結フォールバック {est.chain_frames} フレーム")

    # 基準フレーム系への変換に揃える
    H_ref_from_first = np.linalg.inv(H_first_from[min(ref_frame, n - 1)])
    H_ref_from = [H_ref_from_first @ h for h in H_first_from]

    print("[2/5] チーム色学習 ...")
    classifier = TeamColorClassifier()
    samples = []
    for i in range(0, n, max(1, n // 60)):
        H = H_court_from_ref @ H_ref_from[i]
        for d in detections[i]:
            if d.color is not None and in_court(apply_h(H, [d.foot])[0], dims):
                samples.append(d.color)
    classifier.fit(samples)
    print(f"      {len(samples)} サンプル / 中心(Lab) "
          f"{classifier.centers.round(0).tolist()}")

    print("[3/5] トラッキング ...")
    tcfg = TrackConfig(gate_px=2.2, max_misses=int(2.0 * fps),
                       process_noise=1.5, measure_noise=0.35)
    trackers = {t: TeamTracker(t, args.max_tracks, 1.0 / fps, tcfg)
                for t in ("A", "B")}
    per_frame = []
    for i in range(n):
        H = H_court_from_ref @ H_ref_from[i]
        court_dets = {"A": [], "B": []}
        for d in detections[i]:
            court = apply_h(H, [d.foot])[0]
            if not in_court(court, dims):
                continue
            d.team = classifier.predict(d.color)
            if d.team in court_dets:
                court_dets[d.team].append(
                    Detection(float(court[0]), float(court[1]),
                              (d.x2 - d.x1) * (d.y2 - d.y1), d.team))
        row = {"players": [], "H": H}
        for team in ("A", "B"):
            for tr in trackers[team].step(court_dets[team]):
                if tr.hits >= tcfg.min_hits:
                    row["players"].append(
                        (tr.track_id, team, float(tr.kf.pos[0]),
                         float(tr.kf.pos[1]), tr.detected))
        per_frame.append(row)

    track_ids = {}
    for row in per_frame:
        for tid, team, *_ in row["players"]:
            track_ids[tid] = team
    player_tracks = {
        tid: {"team": team, "xy": np.full((n, 2), np.nan),
              "detected": np.zeros(n, dtype=bool)}
        for tid, team in track_ids.items()
    }
    for f, row in enumerate(per_frame):
        for tid, team, x, y, det in row["players"]:
            player_tracks[tid]["xy"][f] = (x, y)
            player_tracks[tid]["detected"][f] = det

    # 短命トラック (誤検出・一瞬の誤分類由来) を除去
    min_len = int(1.5 * fps)
    player_tracks = {
        tid: d for tid, d in player_tracks.items()
        if (~np.isnan(d["xy"][:, 0])).sum() >= min_len
    }
    valid = set(player_tracks)
    for row in per_frame:
        row["players"] = [p for p in row["players"] if p[0] in valid]
    print(f"      有効トラック {len(player_tracks)} 本")

    print("[4/5] 分析・レポート ...")
    res = Analyzer(int(round(fps))).run(player_tracks, None, n)
    export_csv(args.out, res, player_tracks, n, fps)
    build_report(
        res, duration_s, os.path.join(args.out, "report.html"),
        source_label="実映像", extra_notes=[
            "トラックIDはカメラ見切れ・オクルージョンで分断されることがあります"
            "(同一選手が複数トラックに分かれる場合あり)。",
            "ボールの安定検出には専用学習モデルが必要なため本プロトタイプでは"
            "未実装(パス・シュート推定は省略)。",
        ])

    print("[5/5] 注釈付き映像 (pass2) ...")
    annotate(args, per_frame, fps, dims, os.path.join(args.out, "annotated.mp4"))
    print("完了")


def export_csv(out_dir, res, player_tracks, n, fps):
    with open(os.path.join(out_dir, "tracks.csv"), "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["frame", "t", "track_id", "team", "x_m", "y_m",
                    "speed_mps", "detected"])
        for tid, p in sorted(res.players.items()):
            det = player_tracks[tid]["detected"]
            for f in range(n):
                if np.isnan(p["xy"][f]).any():
                    continue
                w.writerow([f, round(f / fps, 3), tid, p["team"],
                            round(float(p["xy"][f, 0]), 3),
                            round(float(p["xy"][f, 1]), 3),
                            round(float(p["speed"][f]), 3), int(det[f])])
    with open(os.path.join(out_dir, "player_stats.csv"), "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["track_id", "team", "total_dist_m", "avg_speed_mps",
                    "max_speed_mps", "walk_m", "jog_m", "run_m", "sprint_m",
                    "sprint_count", "accel_count"])
        for m in res.metrics:
            w.writerow([m.track_id, m.team, round(m.total_dist, 1),
                        round(m.avg_speed, 2), round(m.max_speed, 2),
                        *[round(z, 1) for z in m.zone_dist],
                        m.sprint_count, m.accel_count])


def annotate(args, per_frame, fps, dims, out_path):
    colors = {t: tuple(int(TEAM_COLOR[t][i:i + 2], 16) for i in (5, 3, 1))
              for t in ("A", "B")}
    court_lines = _court_wireframe(dims)
    writer = None
    for i, frame in iter_frames(args.video, args.start, args.duration):
        if i >= len(per_frame):
            break
        if writer is None:
            h, w = frame.shape[:2]
            writer = cv2.VideoWriter(out_path, cv2.VideoWriter_fourcc(*"mp4v"),
                                     fps, (w, h))
        row = per_frame[i]
        H_img_from_court = np.linalg.inv(row["H"])
        for poly in court_lines:
            p = apply_h(H_img_from_court, poly).astype(np.int32)
            cv2.polylines(frame, [p], False, (80, 220, 80), 1, cv2.LINE_AA)
        for tid, team, x, y, det in row["players"]:
            px = apply_h(H_img_from_court, [(x, y)])[0]
            c = (int(px[0]), int(px[1]))
            cv2.ellipse(frame, c, (16, 6), 0, 0, 360, colors[team], 2)
            cv2.putText(frame, tid, (c[0] - 14, c[1] - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1,
                        cv2.LINE_AA)
        hud = f"t={i / fps:5.1f}s  tracks={len(row['players'])}"
        cv2.rectangle(frame, (6, 6), (250, 32), (30, 30, 30), -1)
        cv2.putText(frame, hud, (12, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.55,
                    (255, 255, 255), 1, cv2.LINE_AA)
        writer.write(frame)
    if writer is not None:
        writer.release()


def _court_wireframe(dims):
    L, W, key_len, key_w, r3, rim_x, ft_r = dims
    y1, y2 = (W - key_w) / 2, (W + key_w) / 2
    th = np.linspace(0, 2 * np.pi, 48)
    right_arc = np.linspace(np.pi / 2, 3 * np.pi / 2, 48)
    left_arc = np.linspace(-np.pi / 2, np.pi / 2, 48)
    return [
        np.array([[0, 0], [L, 0], [L, W], [0, W], [0, 0]], float),
        np.array([[L / 2, 0], [L / 2, W]], float),
        np.c_[L / 2 + ft_r * np.cos(th), W / 2 + ft_r * np.sin(th)],
        np.array([[L, y1], [L - key_len, y1], [L - key_len, y2], [L, y2]], float),
        np.array([[0, y1], [key_len, y1], [key_len, y2], [0, y2]], float),
        np.c_[L - key_len + ft_r * np.cos(th), W / 2 + ft_r * np.sin(th)],
        np.c_[key_len + ft_r * np.cos(th), W / 2 + ft_r * np.sin(th)],
        np.c_[L - rim_x + r3 * np.cos(right_arc), W / 2 + r3 * np.sin(right_arc)],
        np.c_[rim_x + r3 * np.cos(left_arc), W / 2 + r3 * np.sin(left_arc)],
    ]


if __name__ == "__main__":
    main()
