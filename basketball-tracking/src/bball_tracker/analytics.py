"""トラッキング結果 (コート座標系) からの指標算出・イベント推定.

すべて推定トラックのみから計算し、シミュレータの真値は使わない。
- 走行距離 / 平均・最大速度 / 速度ゾーン別距離 / スプリント回数 / 加速回数
- ポゼッション (ボール保持) 区間の推定
- パス / ターンオーバーの推定
- シュート (リング接近イベント) の推定
- ヒートマップ用の滞在密度グリッド
"""

from dataclasses import dataclass, field

import numpy as np

from .config import (
    BASKET_LEFT,
    BASKET_RIGHT,
    COURT_LENGTH,
    COURT_WIDTH,
    SPEED_ZONES,
)

MAX_PLAUSIBLE_SPEED = 9.5  # m/s: これを超える瞬間値は観測ノイズとして丸める


def smooth(xy: np.ndarray, win: int = 7) -> np.ndarray:
    """移動平均による軌跡の平滑化 (NaN は前後値で補間してから)."""
    out = xy.copy()
    for c in range(out.shape[1]):
        col = out[:, c]
        nans = np.isnan(col)
        if nans.all():
            continue
        col[nans] = np.interp(np.flatnonzero(nans), np.flatnonzero(~nans), col[~nans])
        kernel = np.ones(win) / win
        pad = win // 2
        padded = np.pad(col, pad, mode="edge")
        out[:, c] = np.convolve(padded, kernel, mode="valid")[: len(col)]
    return out


@dataclass
class PlayerMetrics:
    track_id: str
    team: str
    total_dist: float
    avg_speed: float
    max_speed: float
    zone_dist: list          # 速度ゾーン別距離 [walk, jog, run, sprint]
    sprint_count: int
    accel_count: int         # 2.5 m/s^2 超の加速イベント回数
    touches: int = 0
    passes: int = 0
    shots: int = 0


@dataclass
class AnalysisResult:
    fps: int
    n_frames: int
    players: dict            # track_id -> {"xy": (N,2), "speed": (N,), "team": str}
    ball_xy: np.ndarray
    metrics: list = field(default_factory=list)
    possessions: list = field(default_factory=list)   # 保持区間
    passes: list = field(default_factory=list)
    turnovers: list = field(default_factory=list)
    shots: list = field(default_factory=list)
    team_possession_s: dict = field(default_factory=dict)


class Analyzer:
    def __init__(self, fps: int):
        self.fps = fps
        self.dt = 1.0 / fps

    def run(self, player_tracks: dict, ball_xy: np.ndarray, n_frames: int) -> AnalysisResult:
        players = {}
        for tid, data in player_tracks.items():
            xy = smooth(data["xy"])
            v = np.linalg.norm(np.diff(xy, axis=0), axis=1) * self.fps
            v = np.clip(v, 0, MAX_PLAUSIBLE_SPEED)
            v = np.concatenate([[v[0] if len(v) else 0.0], v])
            players[tid] = {"xy": xy, "speed": v, "team": data["team"]}

        ball_s = smooth(ball_xy, win=5)
        res = AnalysisResult(fps=self.fps, n_frames=n_frames,
                             players=players, ball_xy=ball_s)
        self._physical_metrics(res)
        self._possessions(res)
        self._events(res)
        return res

    # ------------------------------------------------------------ physical
    def _physical_metrics(self, res: AnalysisResult):
        for tid, p in res.players.items():
            step = np.linalg.norm(np.diff(p["xy"], axis=0), axis=1)
            step = np.clip(step, 0, MAX_PLAUSIBLE_SPEED * self.dt)
            v = p["speed"]
            zones = np.digitize(v[1:], SPEED_ZONES)
            zone_dist = [float(step[zones == z].sum()) for z in range(4)]
            sprints = self._sustained_count(v > SPEED_ZONES[2], int(0.8 * self.fps))
            accel = np.diff(v) * self.fps
            accels = self._sustained_count(accel > 2.5, int(0.3 * self.fps))
            res.metrics.append(PlayerMetrics(
                track_id=tid, team=p["team"],
                total_dist=float(step.sum()),
                avg_speed=float(v.mean()),
                max_speed=float(v.max()),
                zone_dist=zone_dist,
                sprint_count=sprints,
                accel_count=accels,
            ))

    @staticmethod
    def _sustained_count(mask: np.ndarray, min_len: int) -> int:
        count, run = 0, 0
        for m in mask:
            run = run + 1 if m else 0
            if run == min_len:
                count += 1
        return count

    # ------------------------------------------------------------ possession
    def _possessions(self, res: AnalysisResult):
        n = res.n_frames
        holder = np.full(n, None, dtype=object)
        prev = None
        for f in range(n):
            b = res.ball_xy[f]
            if np.isnan(b).any():
                holder[f] = prev
                continue

            def dist_to(tid):
                p = res.players[tid]
                if f >= len(p["xy"]) or np.isnan(p["xy"][f]).any():
                    return np.inf
                return float(np.linalg.norm(p["xy"][f] - b))

            best = min(res.players, key=dist_to)
            best_d = dist_to(best)
            # ヒステリシス: 現保持者がボール近傍にいる限り、明確に近い
            # 選手 (0.35m 以上の差) が現れない限り保持を移さない。
            # 密着マークの DF が瞬間的に最近傍になるケースを吸収する。
            if prev is not None and dist_to(prev) < 1.35:
                cur = prev
                if best != prev and best_d < dist_to(prev) - 0.35:
                    cur = best
            elif best_d < 1.0:
                cur = best
            else:
                cur = None
            holder[f] = cur
            prev = cur

        # 短時間の途切れ (パス飛行・オクルージョン) を除いた保持区間へ集約
        min_frames = int(0.32 * self.fps)
        segs, cur, start = [], None, 0
        for f in range(n + 1):
            h = holder[f] if f < n else None
            if h != cur:
                if cur is not None and f - start >= min_frames and \
                        self._ball_moves_with(res, cur, start, f - 1):
                    segs.append({"track_id": cur, "team": res.players[cur]["team"],
                                 "f0": start, "f1": f - 1,
                                 "t0": start * self.dt, "t1": (f - 1) * self.dt})
                cur, start = h, f
        res.possessions = segs

        team_time = {"A": 0.0, "B": 0.0}
        for s in segs:
            team_time[s["team"]] += s["t1"] - s["t0"]
        res.team_possession_s = team_time

        touches = {}
        for s in segs:
            touches[s["track_id"]] = touches.get(s["track_id"], 0) + 1
        for m in res.metrics:
            m.touches = touches.get(m.track_id, 0)

    # ------------------------------------------------------------ events
    def _events(self, res: AnalysisResult):
        segs = res.possessions
        pass_counts, shot_counts = {}, {}

        # シュート推定: 非保持のボールがリング 0.6m 圏に入るイベント
        baskets = {"L": np.array(BASKET_LEFT), "R": np.array(BASKET_RIGHT)}
        held = np.zeros(res.n_frames, dtype=bool)
        for s in segs:
            held[s["f0"]: s["f1"] + 1] = True
        in_rim_prev = False
        for f in range(res.n_frames):
            b = res.ball_xy[f]
            if np.isnan(b).any():
                continue
            near = min(float(np.linalg.norm(b - bk)) for bk in baskets.values())
            in_rim = (near < 0.6 and not held[f]
                      and self._toward_rim(res, f, baskets)
                      and self._rim_discontinuity(res, f))
            if in_rim and not in_rim_prev:
                t = f * self.dt
                shooter = None
                for s in reversed(segs):
                    if s["t1"] <= t:
                        shooter = s
                        break
                if shooter is not None and t - shooter["t1"] < 2.5:
                    rim = "L" if float(np.linalg.norm(b - baskets["L"])) < \
                        float(np.linalg.norm(b - baskets["R"])) else "R"
                    xy = res.players[shooter["track_id"]]["xy"][shooter["f1"]]
                    dist = float(np.linalg.norm(xy - baskets[rim]))
                    res.shots.append({
                        "t": round(t, 2), "player": shooter["track_id"],
                        "team": shooter["team"], "rim": rim,
                        "dist": round(dist, 2),
                        "x": round(float(xy[0]), 2), "y": round(float(xy[1]), 2),
                        "three": dist > 6.6,
                    })
                    shot_counts[shooter["track_id"]] = \
                        shot_counts.get(shooter["track_id"], 0) + 1
            in_rim_prev = in_rim

        # パス / ターンオーバー: 連続する保持区間の主体の変化から推定。
        # 攻守交代のうち、間にシュート (リング到達) を挟むものはリバウンド・
        # スローインによる交代なのでターンオーバーには数えない。
        shot_times = [s["t"] for s in res.shots]
        for a, b in zip(segs, segs[1:]):
            gap_s = b["t0"] - a["t1"]
            if a["track_id"] == b["track_id"] or gap_s > 2.5:
                continue
            ev = {
                "t": round(b["t0"], 2),
                "from": a["track_id"], "to": b["track_id"],
                "flight_s": round(gap_s, 2),
            }
            if a["team"] == b["team"]:
                res.passes.append(ev)
                pass_counts[ev["from"]] = pass_counts.get(ev["from"], 0) + 1
            elif not any(a["t1"] - 1.0 <= st <= b["t0"] + 0.5
                         for st in shot_times):
                res.turnovers.append({**ev, "lost_team": a["team"]})

        for m in res.metrics:
            m.passes = pass_counts.get(m.track_id, 0)
            m.shots = shot_counts.get(m.track_id, 0)

    def _ball_moves_with(self, res: AnalysisResult, tid: str,
                         f0: int, f1: int) -> bool:
        """区間中ボールが選手と連動して動いているか (真の保持の必要条件).

        静止ボールのそばを走り抜けただけの選手を保持者と誤認しない。
        """
        if f1 - f0 < 3:
            return True
        b = res.ball_xy[f0: f1 + 1]
        p = res.players[tid]["xy"][f0: f1 + 1]
        if np.isnan(b).any() or np.isnan(p).any():
            return True
        vb = np.diff(b, axis=0) * self.fps
        vp = np.diff(p, axis=0) * self.fps
        return float(np.linalg.norm(vb - vp, axis=1).mean()) < 2.6

    def _rim_discontinuity(self, res: AnalysisResult, f: int) -> bool:
        """リング到達フレーム前後でボール速度が不連続か.

        シュートはリングで跳ね返る/止まるため速度が急変する。
        リング脇を素通りするパスは速度が連続するので除外できる。
        """
        k = 6
        if f - k < 0 or f + k >= len(res.ball_xy):
            return True
        before = (res.ball_xy[f] - res.ball_xy[f - k]) * self.fps / k
        after = (res.ball_xy[f + k] - res.ball_xy[f]) * self.fps / k
        if np.isnan(before).any() or np.isnan(after).any():
            return True
        sb, sa = np.linalg.norm(before), np.linalg.norm(after)
        if abs(sb - sa) > 3.0:
            return True
        cos = float(np.dot(before, after) / max(sb * sa, 1e-6))
        return cos < 0.5

    def _toward_rim(self, res: AnalysisResult, f: int, baskets: dict) -> bool:
        """直前 ~0.3 秒のボール速度がリング方向を向いているか.

        リング脇を通過するだけのパスをシュートと誤検出しないための判定。
        """
        f0 = max(f - 8, 0)
        if f - f0 < 2:
            return True
        seg = res.ball_xy[f0: f + 1]
        if np.isnan(seg).any():
            return True
        vel = seg[-1] - seg[0]
        speed = float(np.linalg.norm(vel))
        if speed < 1e-3:
            return False
        cos = max(
            float(np.dot(vel, bk - seg[0]) /
                  (speed * max(float(np.linalg.norm(bk - seg[0])), 1e-6)))
            for bk in baskets.values())
        return cos > 0.9

    # ------------------------------------------------------------ heatmap
    @staticmethod
    def heatmap_grid(xy: np.ndarray, bins=(56, 30)) -> np.ndarray:
        ok = ~np.isnan(xy).any(axis=1)
        grid, _, _ = np.histogram2d(
            xy[ok, 0], xy[ok, 1], bins=bins,
            range=[[0, COURT_LENGTH], [0, COURT_WIDTH]],
        )
        return grid.T
