"""カメラ運動補償: 各フレーム → 基準フレームへのホモグラフィ推定.

パン・ズームする放送カメラ映像を、次の2段構えで基準フレーム座標系に揃える:

1. 基準フレームへの SIFT 特徴マッチング (毎フレーム、半解像度)。
   絶対位置合わせなのでドリフトが蓄積しない。
2. マッチング不足時は LK オプティカルフローのフレーム間連結にフォールバック。

選手など動体と、スコアバグ等の固定オーバーレイは特徴点から除外する。
固定カメラの場合はほぼ単位行列が得られ、そのまま動作する。
"""

import cv2
import numpy as np

SIFT_SCALE = 0.5          # SIFT は半解像度で実行 (高速化)
MIN_ANCHOR_INLIERS = 25   # 絶対アンカー採用に必要な RANSAC インライア数


class CameraMotionEstimator:
    """基準フレームアンカー + LK 連結のハイブリッド推定器."""

    def __init__(self, max_corners: int = 400, quality: float = 0.01,
                 min_dist: int = 12):
        self.prev_gray: np.ndarray | None = None
        self.H_ref_from_prev = np.eye(3)
        self.feature_params = dict(maxCorners=max_corners,
                                   qualityLevel=quality, minDistance=min_dist)
        self.sift = cv2.SIFT_create(nfeatures=2500)
        self.matcher = cv2.BFMatcher()
        self.ref_kp = None
        self.ref_desc = None
        self.anchor_frames = 0
        self.chain_frames = 0

    @staticmethod
    def _mask(shape, boxes) -> np.ndarray:
        mask = np.full(shape, 255, dtype=np.uint8)
        for (x1, y1, x2, y2) in boxes:
            cv2.rectangle(mask, (int(x1) - 5, int(y1) - 5),
                          (int(x2) + 5, int(y2) + 5), 0, -1)
        return mask

    def set_reference(self, gray: np.ndarray, boxes=()):
        small = cv2.resize(gray, None, fx=SIFT_SCALE, fy=SIFT_SCALE)
        mask = self._mask(small.shape,
                          [tuple(v * SIFT_SCALE for v in b) for b in boxes])
        self.ref_kp, self.ref_desc = self.sift.detectAndCompute(small, mask)

    def _anchor(self, gray: np.ndarray, boxes) -> np.ndarray | None:
        """基準フレームへの直接マッチング。成功時 H(現在→基準) を返す."""
        if self.ref_desc is None or len(self.ref_desc) < 50:
            return None
        small = cv2.resize(gray, None, fx=SIFT_SCALE, fy=SIFT_SCALE)
        mask = self._mask(small.shape,
                          [tuple(v * SIFT_SCALE for v in b) for b in boxes])
        kp, desc = self.sift.detectAndCompute(small, mask)
        if desc is None or len(desc) < 50:
            return None
        pairs = self.matcher.knnMatch(desc, self.ref_desc, k=2)
        good = [m for m, n_ in pairs if m.distance < 0.75 * n_.distance]
        if len(good) < MIN_ANCHOR_INLIERS:
            return None
        src = np.float32([kp[m.queryIdx].pt for m in good]) / SIFT_SCALE
        dst = np.float32([self.ref_kp[m.trainIdx].pt for m in good]) / SIFT_SCALE
        H, inl = cv2.findHomography(src, dst, cv2.RANSAC, 4.0)
        if H is None or inl is None or inl.sum() < MIN_ANCHOR_INLIERS:
            return None
        return H

    def _chain(self, gray: np.ndarray, boxes) -> np.ndarray:
        """前フレームからの LK 連結。H(現在→基準) を返す."""
        H_prev_from_cur = np.eye(3)
        if self.prev_gray is not None:
            mask = self._mask(gray.shape, boxes)
            p0 = cv2.goodFeaturesToTrack(self.prev_gray, mask=mask,
                                         **self.feature_params)
            if p0 is not None and len(p0) >= 12:
                p1, st, _ = cv2.calcOpticalFlowPyrLK(
                    self.prev_gray, gray, p0, None,
                    winSize=(21, 21), maxLevel=3,
                    criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT,
                              30, 0.01))
                ok = st.ravel() == 1
                if ok.sum() >= 12:
                    H, inl = cv2.findHomography(
                        p1[ok].reshape(-1, 2), p0[ok].reshape(-1, 2),
                        cv2.RANSAC, 3.0)
                    if H is not None and inl is not None and inl.sum() >= 10:
                        H_prev_from_cur = H
        return self.H_ref_from_prev @ H_prev_from_cur

    def step(self, gray: np.ndarray, moving_boxes=()) -> np.ndarray:
        """フレームを与えて H(現在→基準) を返す."""
        if self.ref_desc is None:
            self.set_reference(gray, moving_boxes)
            self.prev_gray = gray
            return np.eye(3)
        H = self._anchor(gray, moving_boxes)
        if H is not None:
            self.anchor_frames += 1
        else:
            H = self._chain(gray, moving_boxes)
            self.chain_frames += 1
        self.H_ref_from_prev = H
        self.prev_gray = gray
        return H.copy()


def compose_court_homography(H_court_from_ref: np.ndarray,
                             H_ref_from_cur: np.ndarray) -> np.ndarray:
    """現フレームのピクセル → コート座標 [m] の合成変換."""
    return H_court_from_ref @ H_ref_from_cur


def apply_h(H: np.ndarray, pts: np.ndarray) -> np.ndarray:
    pts = np.asarray(pts, np.float64).reshape(-1, 1, 2)
    return cv2.perspectiveTransform(pts, H).reshape(-1, 2)
