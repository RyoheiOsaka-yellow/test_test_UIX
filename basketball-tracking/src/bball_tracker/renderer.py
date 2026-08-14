"""コート俯瞰のダミー映像レンダラ."""

import cv2
import numpy as np

from .config import (
    BASKET_LEFT,
    BASKET_RIGHT,
    COURT_LENGTH,
    COURT_WIDTH,
    THREE_POINT_R,
    RenderConfig,
)


class CourtRenderer:
    def __init__(self, rc: RenderConfig):
        self.rc = rc
        self.w, self.h = rc.frame_size
        self.base = self._draw_court()

    def to_px(self, x: float, y: float) -> tuple[int, int]:
        return (int(round(self.rc.margin + x * self.rc.ppm)),
                int(round(self.rc.margin + y * self.rc.ppm)))

    def court_corners_px(self) -> np.ndarray:
        """コート4隅のピクセル座標 (キャリブレーション用の既知対応点)."""
        return np.array([
            self.to_px(0, 0),
            self.to_px(COURT_LENGTH, 0),
            self.to_px(COURT_LENGTH, COURT_WIDTH),
            self.to_px(0, COURT_WIDTH),
        ], dtype=np.float32)

    def _draw_court(self) -> np.ndarray:
        rc = self.rc
        img = np.full((self.h, self.w, 3), rc.floor_bgr, dtype=np.uint8)
        line, thick = rc.line_bgr, 2
        tl, br = self.to_px(0, 0), self.to_px(COURT_LENGTH, COURT_WIDTH)
        cv2.rectangle(img, tl, br, line, thick)
        cv2.line(img, self.to_px(COURT_LENGTH / 2, 0),
                 self.to_px(COURT_LENGTH / 2, COURT_WIDTH), line, thick)
        cv2.circle(img, self.to_px(*_c(COURT_LENGTH / 2, COURT_WIDTH / 2)),
                   int(1.8 * rc.ppm), line, thick)
        r3 = int(THREE_POINT_R * rc.ppm)
        for basket, start in ((BASKET_LEFT, -90), (BASKET_RIGHT, 90)):
            bpx = self.to_px(*basket)
            cv2.ellipse(img, bpx, (r3, r3), 0, start, start + 180, line, thick)
            cv2.circle(img, bpx, int(0.45 * rc.ppm), (60, 60, 120), 3)  # リング
        # ペイントエリア (5.8m x 4.9m)
        for x0, x1 in ((0, 5.8), (COURT_LENGTH - 5.8, COURT_LENGTH)):
            cv2.rectangle(img, self.to_px(x0, COURT_WIDTH / 2 - 2.45),
                          self.to_px(x1, COURT_WIDTH / 2 + 2.45), line, thick)
        return img

    def render(self, players: dict[str, np.ndarray], ball: np.ndarray,
               numbers: dict[str, int], teams: dict[str, str]) -> np.ndarray:
        rc = self.rc
        frame = self.base.copy()
        for pid, pos in players.items():
            c = self.to_px(pos[0], pos[1])
            cv2.circle(frame, c, rc.player_radius_px, rc.team_bgr[teams[pid]], -1)
            cv2.circle(frame, c, rc.player_radius_px, (30, 30, 30), 1)
            cv2.putText(frame, str(numbers[pid]), (c[0] - 5, c[1] + 4),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.38, (255, 255, 255), 1, cv2.LINE_AA)
        b = self.to_px(ball[0], ball[1])
        cv2.circle(frame, b, rc.ball_radius_px, rc.ball_bgr, -1)
        cv2.circle(frame, b, rc.ball_radius_px, (20, 20, 20), 1)
        if rc.noise_sigma > 0:
            noise = np.random.default_rng().normal(0, rc.noise_sigma, frame.shape)
            frame = np.clip(frame.astype(np.float32) + noise, 0, 255).astype(np.uint8)
        return frame


def _c(x, y):
    return x, y
