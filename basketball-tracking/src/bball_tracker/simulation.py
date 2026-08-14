"""試合シミュレータ (ダミー映像のソース).

5対5 のポゼッション・パス・シュート・リバウンドを含む簡易ゲームエンジン。
毎フレームの全選手・ボールの真値座標と、発生イベントの正解ログを保持する。
トラッキングパイプラインはこの真値を一切参照せず、レンダリング後の映像のみを入力とする。
"""

from dataclasses import dataclass, field

import numpy as np

from .config import (
    BASKET_LEFT,
    BASKET_RIGHT,
    COURT_LENGTH,
    COURT_WIDTH,
    SimConfig,
)

HELD, PASS, SHOT, LOOSE = "HELD", "PASS", "SHOT", "LOOSE"


@dataclass
class Player:
    pid: str
    team: str
    number: int
    pos: np.ndarray
    vel: np.ndarray
    target: np.ndarray
    speed_factor: float = 1.0     # 個人差 (最大速度の係数)
    target_timer: float = 0.0     # 目標地点を引き直すまでの残り秒


@dataclass
class Ball:
    pos: np.ndarray
    vel: np.ndarray
    state: str = HELD
    holder: str | None = None
    receiver: str | None = None
    shot_from: float = 0.0        # シュート時のリング距離
    shooter: str | None = None
    inbound_for: str | None = None  # 得点後スローインを拾えるチーム


class GameSimulator:
    def __init__(self, cfg: SimConfig):
        self.cfg = cfg
        self.rng = np.random.default_rng(cfg.seed)
        self.dt = 1.0 / cfg.fps
        self.t = 0.0
        self.attack_basket = {"A": np.array(BASKET_RIGHT), "B": np.array(BASKET_LEFT)}
        self.defend_basket = {"A": np.array(BASKET_LEFT), "B": np.array(BASKET_RIGHT)}
        self.score = {"A": 0, "B": 0}
        self.events: list[dict] = []
        self.frames: list[dict] = []      # 毎フレームの真値スナップショット
        self.possession = "A"
        self.possession_since = 0.0
        self._init_players()
        first = self.players["A1"]
        self.ball = Ball(pos=first.pos.copy(), vel=np.zeros(2), state=HELD, holder="A1")

    # ---------------------------------------------------------------- setup
    def _init_players(self):
        self.players: dict[str, Player] = {}
        for team, x_side in (("A", -1), ("B", 1)):
            for i in range(self.cfg.n_per_team):
                pid = f"{team}{i + 1}"
                pos = np.array([
                    COURT_LENGTH / 2 + x_side * self.rng.uniform(1.5, 9.0),
                    self.rng.uniform(2.0, COURT_WIDTH - 2.0),
                ])
                self.players[pid] = Player(
                    pid=pid, team=team, number=i + 1,
                    pos=pos, vel=np.zeros(2), target=pos.copy(),
                    speed_factor=self.rng.uniform(0.78, 1.0),
                )
        # マンツーマンの割当て: Bi が Ai をマーク (逆も同様)
        self.mark = {}
        for i in range(self.cfg.n_per_team):
            self.mark[f"A{i + 1}"] = f"B{i + 1}"
            self.mark[f"B{i + 1}"] = f"A{i + 1}"

    # ---------------------------------------------------------------- events
    def _log(self, etype: str, **kw):
        self.events.append({"type": etype, "t": round(self.t, 3), **kw})

    def _switch_possession(self, team: str):
        if team != self.possession:
            self._log("possession_change", from_team=self.possession, to_team=team)
            self.possession = team
            self.possession_since = self.t

    # ---------------------------------------------------------------- ball logic
    def _teammates(self, pid: str):
        p = self.players[pid]
        return [q for q in self.players.values() if q.team == p.team and q.pid != pid]

    def _opponents(self, team: str):
        return [q for q in self.players.values() if q.team != team]

    def _nearest_def_dist(self, pos: np.ndarray, team: str) -> float:
        return min(np.linalg.norm(q.pos - pos) for q in self._opponents(team))

    def _start_pass(self, holder: Player):
        mates = self._teammates(holder.pid)
        # オープンな味方 (最寄り DF が遠い) を選びやすくする
        weights = np.array([self._nearest_def_dist(m.pos, holder.team) ** 2 for m in mates])
        weights = weights / weights.sum()
        receiver = mates[self.rng.choice(len(mates), p=weights)]
        self.ball.state = PASS
        self.ball.holder = None
        self.ball.receiver = receiver.pid
        self._pass_from = holder.pid

    def _start_shot(self, holder: Player):
        basket = self.attack_basket[holder.team]
        dist = float(np.linalg.norm(basket - holder.pos))
        self.ball.state = SHOT
        self.ball.holder = None
        self.ball.shooter = holder.pid
        self.ball.shot_from = dist

    def _step_held(self):
        holder = self.players[self.ball.holder]
        basket = self.attack_basket[holder.team]
        dist = float(np.linalg.norm(basket - holder.pos))
        # ボールは保持者の少し前 (攻撃方向) に置く
        direction = (basket - holder.pos) / max(dist, 1e-6)
        self.ball.pos = holder.pos + direction * 0.35
        self.ball.vel = holder.vel.copy()

        elapsed = self.t - self.possession_since
        shot_p = 0.02 if dist > 7.5 else 0.22 + max(0.0, 5.0 - dist) * 0.12
        if elapsed > self.cfg.shot_clock:
            shot_p = 8.0  # ショットクロック: 強制シュート
        r = self.rng.random()
        if r < shot_p * self.dt:
            self._start_shot(holder)
        elif r < (shot_p + self.cfg.pass_prob_per_s) * self.dt:
            self._start_pass(holder)

    def _step_pass(self):
        receiver = self.players[self.ball.receiver]
        to_recv = receiver.pos - self.ball.pos
        d = float(np.linalg.norm(to_recv))
        self.ball.vel = to_recv / max(d, 1e-6) * self.cfg.pass_speed
        self.ball.pos = self.ball.pos + self.ball.vel * self.dt
        # 近傍の DF によるインターセプト判定
        for q in self._opponents(receiver.team):
            if np.linalg.norm(q.pos - self.ball.pos) < 0.75 and \
                    self.rng.random() < self.cfg.intercept_prob_per_frame:
                self._log("interception", by=q.pid, from_player=self._pass_from,
                          lost_team=receiver.team)
                self.ball.state = HELD
                self.ball.holder = q.pid
                self.ball.receiver = None
                self._switch_possession(q.team)
                return
        if d < 0.5:
            self._log("pass", from_player=self._pass_from, to_player=receiver.pid,
                      dist=round(float(np.linalg.norm(
                          receiver.pos - self.players[self._pass_from].pos)), 2))
            self.ball.state = HELD
            self.ball.holder = receiver.pid
            self.ball.receiver = None

    def _step_shot(self):
        shooter = self.players[self.ball.shooter]
        basket = self.attack_basket[shooter.team]
        to_basket = basket - self.ball.pos
        d = float(np.linalg.norm(to_basket))
        self.ball.vel = to_basket / max(d, 1e-6) * self.cfg.shot_speed
        self.ball.pos = self.ball.pos + self.ball.vel * self.dt
        if d < 0.3:
            made_p = float(np.clip(0.62 - 0.045 * self.ball.shot_from, 0.05, 0.9))
            made = bool(self.rng.random() < made_p)
            points = 3 if self.ball.shot_from > 6.6 else 2
            self._log("shot", player=shooter.pid, dist=round(self.ball.shot_from, 2),
                      made=made, points=points if made else 0,
                      x=round(float(shooter.pos[0]), 2), y=round(float(shooter.pos[1]), 2))
            if made:
                self.score[shooter.team] += points
                other = "B" if shooter.team == "A" else "A"
                # 得点後: エンドラインからのスローイン (相手ボール)
                bx = 0.3 if basket[0] < COURT_LENGTH / 2 else COURT_LENGTH - 0.3
                self.ball.pos = np.array([bx, self.rng.uniform(4.0, 11.0)])
                self.ball.vel = np.zeros(2)
                self.ball.state = LOOSE
                self.ball.inbound_for = other
                self._switch_possession(other)
            else:
                # リバウンド: リング付近から不規則に跳ねる
                ang = self.rng.uniform(0, 2 * np.pi)
                speed = self.rng.uniform(2.5, 6.0)
                self.ball.pos = basket + np.array([np.cos(ang), np.sin(ang)]) * 0.4
                self.ball.vel = np.array([np.cos(ang), np.sin(ang)]) * speed
                self.ball.state = LOOSE
            self.ball.shooter = None

    def _step_loose(self):
        self.ball.vel = self.ball.vel * max(0.0, 1.0 - 2.2 * self.dt)
        self.ball.pos = self.ball.pos + self.ball.vel * self.dt
        for axis, limit in ((0, COURT_LENGTH), (1, COURT_WIDTH)):
            if self.ball.pos[axis] < 0.2:
                self.ball.pos[axis] = 0.2
                self.ball.vel[axis] *= -0.6
            elif self.ball.pos[axis] > limit - 0.2:
                self.ball.pos[axis] = limit - 0.2
                self.ball.vel[axis] *= -0.6
        candidates = [
            p for p in self.players.values()
            if self.ball.inbound_for is None or p.team == self.ball.inbound_for
        ]
        near = min(candidates, key=lambda p: np.linalg.norm(p.pos - self.ball.pos))
        if np.linalg.norm(near.pos - self.ball.pos) < 0.6:
            etype = "inbound_catch" if self.ball.inbound_for else "rebound"
            self._log(etype, player=near.pid)
            self.ball.state = HELD
            self.ball.holder = near.pid
            self.ball.inbound_for = None
            self._switch_possession(near.team)

    # ---------------------------------------------------------------- players
    def _update_targets(self):
        holder_pid = self.ball.holder
        for p in self.players.values():
            p.target_timer -= self.dt
            attacking = p.team == self.possession
            basket = self.attack_basket[p.team]
            if attacking:
                if p.pid == holder_pid:
                    if p.target_timer <= 0:
                        # ドライブ: リング方向 + 横方向の揺さぶり
                        lateral = self.rng.uniform(-3.0, 3.0)
                        p.target = basket + np.array([0.0, lateral])
                        p.target_timer = self.rng.uniform(1.2, 2.5)
                elif self.ball.state == LOOSE and self.ball.inbound_for == p.team:
                    p.target = self.ball.pos.copy()
                else:
                    if p.target_timer <= 0:
                        # オフボール: 攻撃側ハーフに散らばるスポットへ
                        span = 11.0
                        sign = 1.0 if basket[0] > COURT_LENGTH / 2 else -1.0
                        x = basket[0] - sign * self.rng.uniform(1.0, span)
                        y = self.rng.uniform(1.0, COURT_WIDTH - 1.0)
                        p.target = np.array([x, y])
                        p.target_timer = self.rng.uniform(2.5, 5.0)
            else:
                if self.ball.state == LOOSE and self.ball.inbound_for is None:
                    p.target = self.ball.pos.copy()
                else:
                    # マンツーマンDF: マーク相手と自ゴールの間に位置取る
                    mark = self.players[self.mark[p.pid]]
                    goal = self.defend_basket[p.team]
                    to_goal = goal - mark.pos
                    n = np.linalg.norm(to_goal)
                    p.target = mark.pos + to_goal / max(n, 1e-6) * 1.4

    def _move_players(self):
        cfg = self.cfg
        for p in self.players.values():
            to_t = p.target - p.pos
            d = float(np.linalg.norm(to_t))
            desired_speed = min(cfg.max_speed * p.speed_factor, d * 2.2)
            desired = to_t / max(d, 1e-6) * desired_speed
            dv = desired - p.vel
            dv_norm = float(np.linalg.norm(dv))
            max_dv = cfg.max_accel * self.dt
            if dv_norm > max_dv:
                dv = dv / dv_norm * max_dv
            p.vel = p.vel + dv
            p.pos = p.pos + p.vel * self.dt
            p.pos[0] = float(np.clip(p.pos[0], 0.3, COURT_LENGTH - 0.3))
            p.pos[1] = float(np.clip(p.pos[1], 0.3, COURT_WIDTH - 0.3))
        # 重なり回避: 近すぎる選手同士を押し離す
        plist = list(self.players.values())
        for i in range(len(plist)):
            for j in range(i + 1, len(plist)):
                diff = plist[i].pos - plist[j].pos
                d = float(np.linalg.norm(diff))
                if d < 0.7 and d > 1e-6:
                    push = diff / d * (0.7 - d) * 0.5
                    plist[i].pos = plist[i].pos + push
                    plist[j].pos = plist[j].pos - push

    # ---------------------------------------------------------------- main loop
    def step(self):
        if self.ball.state == HELD:
            self._step_held()
        if self.ball.state == PASS:
            self._step_pass()
        elif self.ball.state == SHOT:
            self._step_shot()
        elif self.ball.state == LOOSE:
            self._step_loose()
        self._update_targets()
        self._move_players()
        if self.ball.state == HELD:
            # 保持者移動後にボール位置を追従させる
            holder = self.players[self.ball.holder]
            basket = self.attack_basket[holder.team]
            direction = basket - holder.pos
            direction = direction / max(float(np.linalg.norm(direction)), 1e-6)
            self.ball.pos = holder.pos + direction * 0.35

        self.frames.append({
            "t": round(self.t, 4),
            "players": {pid: p.pos.copy() for pid, p in self.players.items()},
            "ball": self.ball.pos.copy(),
            "ball_state": self.ball.state,
            "holder": self.ball.holder,
            "possession": self.possession,
            "score": dict(self.score),
        })
        self.t += self.dt

    def run(self):
        n = int(self.cfg.duration_s * self.cfg.fps)
        for _ in range(n):
            self.step()
        return self.frames, self.events
