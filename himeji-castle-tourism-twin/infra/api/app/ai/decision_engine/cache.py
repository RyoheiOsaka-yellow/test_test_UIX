"""Decision Cache: 量子化した Urban State のハッシュをキーに TTL 付きで保持（同じ状態で Jev を繰り返し呼ばない）。"""
from __future__ import annotations
import hashlib, json, time
from typing import Any, Optional


def _quant(v, step):
    try:
        return round(float(v) / step) * step
    except (TypeError, ValueError):
        return v


def state_hash(state: dict, questions: list, n_candidates: int = 0) -> str:
    """判断に効く軸だけを粗く量子化してハッシュ化（カメラ高さ 15%、FPS 5 刻み、人数 5%、密度 0.05 …）"""
    cam = state.get('camera', {}) or {}; ren = state.get('rendering', {}) or {}; area = state.get('area', {}) or {}; mob = state.get('mobility', {}) or {}; an = state.get('analysis', {}) or {}
    h = float(cam.get('height') or 0)
    key = {
        'q': sorted(questions), 'n': n_candidates,
        'h': round(h / max(1.0, h * 0.15)) if h else 0, 'mv': bool(cam.get('moving')),
        'fps': _quant(ren.get('fps', 0), 5), 'vp': _quant(ren.get('visiblePoints', 0), 50000),
        'pc': _quant(area.get('peopleCount', 0), max(1, float(area.get('peopleCount') or 0) * 0.05)), 'ad': _quant(area.get('avgDensity', 0), 0.05), 'pd': _quant(area.get('peakDensity', 0), 0.05),
        'sp': _quant(mob.get('avgSpeed', 0), 0.1), 'st': _quant(mob.get('avgStayMinutes', 0), 5), 'in': _quant(mob.get('inflow', 0), 50), 'out': _quant(mob.get('outflow', 0), 50),
        'mode': an.get('mode'), 'user': bool(an.get('userOverride')), 't': (state.get('timestamp') or '')[:16], 'bbox': state.get('bbox'), 'src': state.get('source'),
    }
    return hashlib.sha1(json.dumps(key, sort_keys=True, default=str).encode()).hexdigest()[:16]


class DecisionCache:
    def __init__(self, ttl_ms: int = 5000, max_items: int = 512):
        self.ttl = ttl_ms / 1000.0; self.max = max_items; self.items: dict[str, tuple[float, Any]] = {}; self.hits = 0; self.misses = 0

    def get(self, key: str) -> Optional[Any]:
        it = self.items.get(key)
        if it and time.time() - it[0] < self.ttl:
            self.hits += 1; return it[1]
        if it: self.items.pop(key, None)
        self.misses += 1; return None

    def put(self, key: str, value: Any) -> None:
        if len(self.items) >= self.max:
            oldest = min(self.items.items(), key=lambda kv: kv[1][0])[0]; self.items.pop(oldest, None)
        self.items[key] = (time.time(), value)

    def stats(self) -> dict: return {'items': len(self.items), 'hits': self.hits, 'misses': self.misses, 'ttlMs': int(self.ttl * 1000)}
