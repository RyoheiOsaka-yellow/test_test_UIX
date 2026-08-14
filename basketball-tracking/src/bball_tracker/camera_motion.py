"""カメラ運動補償: 各フレーム → 基準フレームへのホモグラフィ推定.

パン・ズームする放送カメラ映像でも、背景 (床・ライン・看板) の特徴点を
LK オプティカルフローで追い、フレーム間ホモグラフィを RANSAC で推定して
基準フレームまで連結する。選手など動体は検出 bbox でマスクして除外する。
固定カメラの場合はほぼ単位行列が得られ、そのまま動作する。
"""

import cv2
import numpy as np


class CameraMotionEstimator:
    def __init__(self, max_corners: int = 400, quality: float = 0.01,
                 min_dist: int = 12):
        self.prev_gray: np.ndarray | None = None
        self.H_ref_from_cur = np.eye(3)   # 現フレーム → 基準フレーム
        self.feature_params = dict(maxCorners=max_corners,
                                   qualityLevel=quality, minDistance=min_dist)

    def _mask(self, shape, boxes) -> np.ndarray:
        mask = np.full(shape, 255, dtype=np.uint8)
        for (x1, y1, x2, y2) in boxes:
            cv2.rectangle(mask, (int(x1) - 5, int(y1) - 5),
                          (int(x2) + 5, int(y2) + 5), 0, -1)
        return mask

    def step(self, gray: np.ndarray, moving_boxes=()) -> np.ndarray:
        """フレームを与えて H(現在→基準) を返す。1フレーム目は単位行列."""
        if self.prev_gray is None:
            self.prev_gray = gray
            return self.H_ref_from_cur.copy()

        mask = self._mask(gray.shape, moving_boxes)
        p0 = cv2.goodFeaturesToTrack(self.prev_gray, mask=mask,
                                     **self.feature_params)
        H_prev_from_cur = np.eye(3)
        if p0 is not None and len(p0) >= 12:
            p1, st, _ = cv2.calcOpticalFlowPyrLK(
                self.prev_gray, gray, p0, None,
                winSize=(21, 21), maxLevel=3,
                criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT,
                          30, 0.01))
            ok = st.ravel() == 1
            if ok.sum() >= 12:
                src = p1[ok].reshape(-1, 2)   # 現フレームの点
                dst = p0[ok].reshape(-1, 2)   # 前フレームでの位置
                H, inliers = cv2.findHomography(src, dst, cv2.RANSAC, 3.0)
                if H is not None and inliers is not None and \
                        inliers.sum() >= 10:
                    H_prev_from_cur = H
        self.H_ref_from_cur = self.H_ref_from_cur @ H_prev_from_cur
        self.prev_gray = gray
        return self.H_ref_from_cur.copy()


def compose_court_homography(H_court_from_ref: np.ndarray,
                             H_ref_from_cur: np.ndarray) -> np.ndarray:
    """現フレームのピクセル → コート座標 [m] の合成変換."""
    return H_court_from_ref @ H_ref_from_cur


def apply_h(H: np.ndarray, pts: np.ndarray) -> np.ndarray:
    pts = np.asarray(pts, np.float64).reshape(-1, 1, 2)
    return cv2.perspectiveTransform(pts, H).reshape(-1, 2)
