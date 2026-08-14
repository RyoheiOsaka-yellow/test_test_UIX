"""映像フレームからの選手・ボール検出.

ダミー映像に対しては色ベースの検出器を使う。実映像に切り替える場合は
`Detector` の detect() と同じ戻り値 (Detection のリスト) を返すクラス
(例: YOLOv8 + チーム色分類) を実装して差し替えるだけでよい。
"""

from dataclasses import dataclass

import cv2
import numpy as np

from .config import DetectConfig


@dataclass
class Detection:
    cx: float
    cy: float
    area: float
    kind: str  # "A" / "B" / "ball"


class ColorDetector:
    """合成映像用のカラー閾値検出器."""

    def __init__(self, cfg: DetectConfig):
        self.cfg = cfg
        self._kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))

    def detect(self, frame: np.ndarray) -> list[Detection]:
        blurred = cv2.GaussianBlur(frame, (3, 3), 0)
        out: list[Detection] = []
        for kind, (lo, hi) in self.cfg.ranges.items():
            mask = cv2.inRange(blurred, np.array(lo, np.uint8), np.array(hi, np.uint8))
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, self._kernel)
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, self._kernel)
            n, _, stats, centroids = cv2.connectedComponentsWithStats(mask)
            blobs = [
                Detection(float(centroids[i][0]), float(centroids[i][1]),
                          float(stats[i, cv2.CC_STAT_AREA]), kind)
                for i in range(1, n)
                if stats[i, cv2.CC_STAT_AREA] >= self.cfg.min_area[kind]
            ]
            if kind == "ball":
                # ボールは1個: 最大ブロブのみ採用 (見つからないフレームもあり得る)
                blobs = sorted(blobs, key=lambda d: -d.area)[:1]
            out.extend(blobs)
        return out
