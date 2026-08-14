"""コート寸法・シミュレーション・描画・検出の設定値."""

from dataclasses import dataclass, field

# FIBA 規格コート (メートル)。原点はコート左上、x: 長辺方向 (0-28), y: 短辺方向 (0-15)
COURT_LENGTH = 28.0
COURT_WIDTH = 15.0
BASKET_LEFT = (1.575, 7.5)
BASKET_RIGHT = (COURT_LENGTH - 1.575, 7.5)
THREE_POINT_R = 6.75
CENTER = (COURT_LENGTH / 2.0, COURT_WIDTH / 2.0)

# 速度ゾーン境界 (m/s): ウォーク / ジョグ / ラン / スプリント
SPEED_ZONES = [2.0, 4.0, 5.5]
SPEED_ZONE_LABELS = ["ウォーク (<2m/s)", "ジョグ (2-4m/s)", "ラン (4-5.5m/s)", "スプリント (>5.5m/s)"]


@dataclass
class SimConfig:
    fps: int = 25
    duration_s: float = 60.0
    seed: int = 42
    n_per_team: int = 5
    max_speed: float = 7.5        # 選手の最大速度 m/s
    max_accel: float = 5.5        # 最大加速度 m/s^2
    pass_speed: float = 11.0      # パスのボール速度 m/s
    shot_speed: float = 9.0       # シュートのボール速度 m/s
    shot_clock: float = 20.0      # この秒数を超えたら強制シュート
    pass_prob_per_s: float = 0.55
    intercept_prob_per_frame: float = 0.06  # 飛行中パスの近傍DFによるカット確率


@dataclass
class RenderConfig:
    ppm: float = 36.0             # pixels per meter
    margin: int = 40              # コート外周の余白 px
    noise_sigma: float = 5.0      # フレームに乗せるガウスノイズ (検出を現実的にする)
    floor_bgr: tuple = (150, 190, 220)
    line_bgr: tuple = (255, 255, 255)
    team_bgr: dict = field(default_factory=lambda: {"A": (40, 40, 210), "B": (200, 90, 30)})
    ball_bgr: tuple = (0, 150, 255)
    player_radius_px: int = 11
    ball_radius_px: int = 6

    @property
    def frame_size(self):
        w = int(COURT_LENGTH * self.ppm + 2 * self.margin)
        h = int(COURT_WIDTH * self.ppm + 2 * self.margin)
        return w, h


@dataclass
class DetectConfig:
    # BGR の inRange 閾値 (合成映像の色 ± ノイズ耐性マージン)
    ranges: dict = field(default_factory=lambda: {
        "A": ((0, 0, 165), (95, 95, 255)),
        "B": ((155, 45, 0), (255, 145, 95)),
        "ball": ((0, 105, 210), (65, 195, 255)),
    })
    min_area: dict = field(default_factory=lambda: {"A": 120, "B": 120, "ball": 22})


@dataclass
class TrackConfig:
    gate_px: float = 55.0         # 対応付けの最大距離 (ゲーティング)
    max_misses: int = 75          # 観測が無くてもトラックを保持するフレーム数
    min_hits: int = 3             # 確定トラックとみなす最小観測数
    process_noise: float = 8.0
    measure_noise: float = 2.5
