"""Decision Engine の型（Jev Adapter と Local Rule Engine が同じ戻り値型を使う）。
Jev の判断プリミティブ: Choice（選択肢から 1 つ）/ Score（順序尺度 0..N）/ Noul（0.0〜1.0 の確率）。
個人情報・person_hash・生 GPS はこの型に含めない（集約値と統計量のみ）。"""
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Any, Literal, Optional

DecisionKind = Literal['choice', 'score', 'noul']
Source = Literal['jev', 'jev-mock', 'local', 'safety', 'cache']

CONGESTION_OPTIONS = ['NORMAL', 'BUSY', 'CONGESTED', 'CRITICAL', 'UNKNOWN']
LOD_OPTIONS = ['LOD0', 'LOD1', 'LOD2', 'LOD3', 'LOD4']           # 250m / 100m / 50m / points / ultra-fine
VIS_OPTIONS = ['POINTS', 'HEATMAP', 'GRID', 'HEXAGON', 'FLOW', 'TRIPS', 'CONTOUR', 'VOLUME']
BUDGET_OPTIONS = [100000, 200000, 350000, 500000, 750000, 1000000]
QUESTIONS = ['congestion', 'congestionScore', 'anomaly', 'lod', 'pointBudget', 'visualization', 'pointCloud', 'attention']


@dataclass
class Decision:
    question: str
    kind: DecisionKind
    value: Any                      # Choice: str / Score: int / Noul: float
    confidence: float               # 0..1
    source: str                     # 'jev' | 'jev-mock' | 'local' | 'safety' | 'cache'
    alt: Optional[dict] = None      # A/B 比較用（もう一方のエンジンの判断）
    meta: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        d = asdict(self)
        if d.get('alt') is None: d.pop('alt')
        if not d.get('meta'): d.pop('meta')
        return d


@dataclass
class AttentionArea:
    rank: int
    mesh_id: str
    name: str
    lon: float
    lat: float
    score: float                    # attentionScore 0..100
    kind: str                       # 'Congestion' | 'Inflow spike' | 'Outflow spike' | 'Flow anomaly' | 'Stay build-up'
    reasons: list                   # [{'feature': 'density', 'dir': 'up', 'pct': 32}, ...]（実データ計算値）
    features: dict                  # people/density/speed/stay/inflow/outflow と偏差
    confidence: float
    source: str

    def to_dict(self) -> dict: return asdict(self)


@dataclass
class DecisionBundle:
    decisions: dict                 # question -> Decision.to_dict()
    attention: list                 # AttentionArea.to_dict() の Top 5
    contributions: dict             # explainability: feature -> {'pct': +32, 'value': ..., 'baseline': ...}
    meta: dict                      # source summary / latency / cacheHit / stateHash / jevStatus / timestamp

    def to_dict(self) -> dict:
        return {'decisions': self.decisions, 'attention': self.attention, 'contributions': self.contributions, 'meta': self.meta}


def clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return lo if v < lo else hi if v > hi else v


def num(d: dict, key: str, default: float = 0.0) -> float:
    try:
        v = d.get(key, default) if isinstance(d, dict) else default
        return float(v) if v is not None else default
    except (TypeError, ValueError):
        return default
