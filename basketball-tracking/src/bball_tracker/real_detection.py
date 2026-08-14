"""実映像向けの選手検出 (YOLO) とチーム分類 (ユニフォーム色クラスタリング).

COCO 学習済み YOLO で person を検出し、胴体部の色を k-means で
2チーム + その他 (審判・ベンチ等) に分類する。
ボールは COCO モデルでは実映像から安定検出できないためオプション扱い
(専用にファインチューンしたモデルを差し込める構造)。
"""

from dataclasses import dataclass

import cv2
import numpy as np


@dataclass
class PersonDet:
    x1: float
    y1: float
    x2: float
    y2: float
    conf: float
    team: str | None = None   # "A" / "B" / None(その他)
    color: np.ndarray | None = None  # 胴体代表色 (Lab)

    @property
    def foot(self) -> tuple[float, float]:
        """接地点 (bbox 下辺中央) — ホモグラフィで床平面に写す基準点."""
        return ((self.x1 + self.x2) / 2.0, self.y2)


class YoloPersonDetector:
    def __init__(self, weights: str = "yolov8m.pt", imgsz: int = 1280,
                 conf: float = 0.35):
        from ultralytics import YOLO
        self.model = YOLO(weights)
        self.imgsz = imgsz
        self.conf = conf

    def detect(self, frame: np.ndarray) -> list[PersonDet]:
        r = self.model.predict(frame, imgsz=self.imgsz, conf=self.conf,
                               classes=[0], verbose=False)[0]
        out = []
        for box in r.boxes:
            x1, y1, x2, y2 = map(float, box.xyxy[0])
            out.append(PersonDet(x1, y1, x2, y2, float(box.conf[0])))
        return out


def torso_color(frame: np.ndarray, det: PersonDet) -> np.ndarray | None:
    """胴体 (bbox 上半分中央) の代表色を Lab 空間で返す."""
    h = det.y2 - det.y1
    w = det.x2 - det.x1
    y1 = int(det.y1 + 0.18 * h)
    y2 = int(det.y1 + 0.52 * h)
    x1 = int(det.x1 + 0.22 * w)
    x2 = int(det.x2 - 0.22 * w)
    if y2 - y1 < 4 or x2 - x1 < 3:
        return None
    crop = frame[max(y1, 0): y2, max(x1, 0): x2]
    if crop.size == 0:
        return None
    lab = cv2.cvtColor(crop, cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)
    return np.median(lab, axis=0)


class TeamColorClassifier:
    """ユニフォーム色の教師なし2チーム分類.

    コート内検出の胴体色を k-means (k=5) にかけ、「彩度が高く
    メンバー数も多い」2クラスタをチームとみなす。ユニフォームは
    彩度が高く、審判の黒・白 / 観客の混色は彩度が低いことを利用する。
    どのチーム中心からも遠い色は「その他」として除外する。
    """

    def __init__(self, max_team_dist: float = 45.0, min_chroma: float = 12.0,
                 k: int = 5):
        self.centers: np.ndarray | None = None   # (2,3) チーム色中心 (Lab)
        self.max_team_dist = max_team_dist
        self.min_chroma = min_chroma
        self.k = k

    @staticmethod
    def _chroma(center: np.ndarray) -> float:
        # OpenCV Lab: a,b は 128 が無彩色
        return float(np.hypot(center[1] - 128.0, center[2] - 128.0))

    @staticmethod
    def _hue(center: np.ndarray) -> float:
        return float(np.degrees(np.arctan2(center[2] - 128.0,
                                           center[1] - 128.0)))

    def fit(self, colors: list[np.ndarray]):
        data = np.array(colors, dtype=np.float32)
        crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 50, 0.5)
        k = min(self.k, len(data))
        _, labels, centers = cv2.kmeans(data, k, None, crit, 10,
                                        cv2.KMEANS_PP_CENTERS)
        counts = np.bincount(labels.ravel(), minlength=k)
        # スコア = クラスタ人数 × 彩度 (低彩度クラスタは審判・観客とみなす)
        scores = [
            counts[i] * self._chroma(centers[i])
            if self._chroma(centers[i]) >= self.min_chroma else -1.0
            for i in range(k)
        ]
        order = list(np.argsort(scores)[::-1])
        first = order[0]
        # 2チーム目は1チーム目と色相が十分離れたクラスタから選ぶ。
        # 同系色 (同じユニフォームの明部/暗部) を2チームに割らないため。
        second = None
        for i in order[1:]:
            if scores[i] <= 0:
                continue
            dh = abs(self._hue(centers[i]) - self._hue(centers[first]))
            dh = min(dh, 360 - dh)
            if dh >= 45.0:
                second = i
                break
        if second is None:
            second = order[1] if scores[order[1]] > 0 else \
                int(np.argsort(-counts)[1])
        best = centers[[first, second]]
        # 明るい方を A、暗い方を B に固定 (ホーム=明色ユニフォーム想定)
        if best[0][0] < best[1][0]:
            best = best[::-1]
        self.centers = best

    def predict(self, color: np.ndarray | None) -> str | None:
        if color is None or self.centers is None:
            return None
        d = np.linalg.norm(self.centers - color, axis=1)
        i = int(np.argmin(d))
        if d[i] > self.max_team_dist:
            return None
        return "AB"[i]
