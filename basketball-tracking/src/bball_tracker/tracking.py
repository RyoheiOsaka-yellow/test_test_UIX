"""多対象トラッキング (SORT 系).

等速カルマンフィルタで各対象の位置・速度を推定し、フレーム間の対応付けは
ハンガリアン法 (scipy.optimize.linear_sum_assignment) で行う。
選手はコートから消えない前提のため、未観測でも長めにトラックを保持して
オクルージョン (同色選手の重なりでブロブが結合するケース) を乗り切る。
"""

from dataclasses import dataclass, field

import numpy as np
from scipy.optimize import linear_sum_assignment

from .config import TrackConfig
from .detection import Detection


class KalmanCV:
    """状態 [x, y, vx, vy] の等速モデル."""

    def __init__(self, x: float, y: float, dt: float, q: float, r: float):
        self.x = np.array([x, y, 0.0, 0.0])
        self.F = np.eye(4)
        self.F[0, 2] = self.F[1, 3] = dt
        self.H = np.zeros((2, 4))
        self.H[0, 0] = self.H[1, 1] = 1.0
        self.P = np.diag([10.0, 10.0, 100.0, 100.0])
        self.Q = np.diag([q, q, q * 4, q * 4]) * dt
        self.R = np.eye(2) * r

    def predict(self):
        self.x = self.F @ self.x
        self.P = self.F @ self.P @ self.F.T + self.Q

    def update(self, z: np.ndarray):
        y = z - self.H @ self.x
        S = self.H @ self.P @ self.H.T + self.R
        K = self.P @ self.H.T @ np.linalg.inv(S)
        self.x = self.x + K @ y
        self.P = (np.eye(4) - K @ self.H) @ self.P

    @property
    def pos(self) -> np.ndarray:
        return self.x[:2]


@dataclass
class Track:
    track_id: str
    kf: KalmanCV
    hits: int = 1
    misses: int = 0
    detected: bool = True
    history: list = field(default_factory=list)


class TeamTracker:
    """1チーム分 (最大 n_max 人) のトラッカー."""

    def __init__(self, team: str, n_max: int, dt: float, cfg: TrackConfig):
        self.team = team
        self.n_max = n_max
        self.dt = dt
        self.cfg = cfg
        self.tracks: list[Track] = []
        self._next_id = 1

    def _new_track(self, det: Detection) -> Track:
        tr = Track(
            track_id=f"{self.team}-{self._next_id}",
            kf=KalmanCV(det.cx, det.cy, self.dt,
                        self.cfg.process_noise, self.cfg.measure_noise),
        )
        self._next_id += 1
        self.tracks.append(tr)
        return tr

    def step(self, detections: list[Detection]) -> list[Track]:
        for tr in self.tracks:
            tr.kf.predict()
            tr.detected = False

        if detections and self.tracks:
            cost = np.zeros((len(self.tracks), len(detections)))
            for i, tr in enumerate(self.tracks):
                for j, det in enumerate(detections):
                    cost[i, j] = np.linalg.norm(tr.kf.pos - np.array([det.cx, det.cy]))
            rows, cols = linear_sum_assignment(cost)
            used = set()
            for i, j in zip(rows, cols):
                if cost[i, j] <= self.cfg.gate_px:
                    self.tracks[i].kf.update(np.array([detections[j].cx, detections[j].cy]))
                    self.tracks[i].hits += 1
                    self.tracks[i].misses = 0
                    self.tracks[i].detected = True
                    used.add(j)
            unmatched = [d for j, d in enumerate(detections) if j not in used]
        else:
            unmatched = list(detections)

        for det in unmatched:
            if len(self.tracks) < self.n_max:
                self._new_track(det)

        for tr in self.tracks:
            if not tr.detected:
                tr.misses += 1
                # 未検出中は速度を減衰させ、等速予測の暴走 (画面外へ飛ぶ) を防ぐ
                tr.kf.x[2:] *= 0.88
        # コート内競技なので原則保持するが、誤生成トラックは寿命で破棄
        self.tracks = [t for t in self.tracks
                       if t.misses <= self.cfg.max_misses or t.hits >= self.cfg.min_hits]
        return self.tracks


class BallTracker:
    """単一対象 (ボール) のカルマントラッカー."""

    def __init__(self, dt: float, cfg: TrackConfig):
        self.dt = dt
        self.cfg = cfg
        self.kf: KalmanCV | None = None
        self.misses = 0

    def step(self, det: Detection | None):
        if det is not None:
            z = np.array([det.cx, det.cy])
            if self.kf is None:
                self.kf = KalmanCV(det.cx, det.cy, self.dt,
                                   self.cfg.process_noise * 3, self.cfg.measure_noise)
            else:
                self.kf.predict()
                # ボールは高機動: ゲートを広めに取り、外れは再初期化
                if np.linalg.norm(self.kf.pos - z) > self.cfg.gate_px * 3:
                    self.kf = KalmanCV(det.cx, det.cy, self.dt,
                                       self.cfg.process_noise * 3, self.cfg.measure_noise)
                else:
                    self.kf.update(z)
            self.misses = 0
            return self.kf.pos, True
        if self.kf is not None:
            self.kf.predict()
            self.misses += 1
            if self.misses < 20:
                return self.kf.pos, False
        return None, False
