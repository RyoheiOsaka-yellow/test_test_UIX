"""ピクセル座標 → コート実座標 (m) のホモグラフィ変換.

実映像ではコートの既知点 (4隅やライン交点) を手動または自動で対応付けて
求める。ダミー映像ではレンダラのコート4隅ピクセルを対応点として使う。
"""

import cv2
import numpy as np

from .config import COURT_LENGTH, COURT_WIDTH


class CourtCalibration:
    def __init__(self, corners_px: np.ndarray):
        court_pts = np.array([
            [0, 0], [COURT_LENGTH, 0], [COURT_LENGTH, COURT_WIDTH], [0, COURT_WIDTH],
        ], dtype=np.float32)
        self.H, _ = cv2.findHomography(corners_px.astype(np.float32), court_pts)

    def px_to_court(self, pts_px: np.ndarray) -> np.ndarray:
        """(N,2) ピクセル座標 → (N,2) コート座標 [m]."""
        pts = np.asarray(pts_px, dtype=np.float64).reshape(-1, 1, 2)
        out = cv2.perspectiveTransform(pts, self.H)
        return out.reshape(-1, 2)
