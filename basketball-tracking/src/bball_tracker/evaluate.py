"""トラッキング精度の評価 (シミュレータ真値との突合).

パイプライン本体は真値を使わないが、プロトタイプとして
「どの程度正確に追えているか」を定量化する。
- 選手位置 RMSE / 検出率
- ID 一貫性 (トラックが同一選手を追い続けた割合)
- ボール位置 RMSE / 検出率
- パス・シュートイベントの適合率 / 再現率
"""

import numpy as np
from scipy.optimize import linear_sum_assignment


def evaluate_tracks(player_tracks: dict, ball_xy: np.ndarray,
                    gt_frames: list, gt_events: list, fps: int) -> dict:
    n = len(gt_frames)
    team_of = lambda pid: pid[0]

    # フレームごとに 推定トラック↔真値選手 をチーム内ハンガリアン対応付け
    assign_hist = {tid: {} for tid in player_tracks}
    errs = []
    det_frames = 0
    for f in range(n):
        gt = gt_frames[f]["players"]
        for team in ("A", "B"):
            tids = [t for t, d in player_tracks.items()
                    if d["team"] == team and f < len(d["xy"])
                    and not np.isnan(d["xy"][f]).any()]
            pids = [p for p in gt if team_of(p) == team]
            if not tids:
                continue
            cost = np.array([[np.linalg.norm(player_tracks[t]["xy"][f] - gt[p])
                              for p in pids] for t in tids])
            rows, cols = linear_sum_assignment(cost)
            for i, j in zip(rows, cols):
                if cost[i, j] < 2.0:
                    errs.append(cost[i, j])
                    pid = pids[j]
                    assign_hist[tids[i]][pid] = assign_hist[tids[i]].get(pid, 0) + 1
                    det_frames += 1

    # ID 一貫性: 各トラックの支配的な真値選手が占める割合
    purities = []
    id_map = {}
    for tid, hist in assign_hist.items():
        if not hist:
            continue
        pid, cnt = max(hist.items(), key=lambda kv: kv[1])
        purities.append(cnt / sum(hist.values()))
        id_map[tid] = pid

    ball_errs, ball_det = [], 0
    for f in range(n):
        if f < len(ball_xy) and not np.isnan(ball_xy[f]).any():
            ball_det += 1
            ball_errs.append(float(np.linalg.norm(ball_xy[f] - gt_frames[f]["ball"])))

    return {
        "player_position_rmse_m": float(np.sqrt(np.mean(np.square(errs)))) if errs else None,
        "player_coverage": det_frames / (n * 10),
        "id_consistency": float(np.mean(purities)) if purities else None,
        "track_to_player": id_map,
        "ball_coverage": ball_det / n,
        "ball_position_rmse_m": float(np.sqrt(np.mean(np.square(ball_errs)))) if ball_errs else None,
    }


def evaluate_events(detected: list, gt_events: list, etype: str,
                    tol_s: float = 1.5) -> dict:
    gt = [e for e in gt_events if e["type"] == etype]
    used = set()
    tp = 0
    for d in detected:
        for i, g in enumerate(gt):
            if i not in used and abs(d["t"] - g["t"]) <= tol_s:
                used.add(i)
                tp += 1
                break
    precision = tp / len(detected) if detected else None
    recall = tp / len(gt) if gt else None
    return {"gt_count": len(gt), "detected_count": len(detected),
            "true_positive": tp, "precision": precision, "recall": recall}
