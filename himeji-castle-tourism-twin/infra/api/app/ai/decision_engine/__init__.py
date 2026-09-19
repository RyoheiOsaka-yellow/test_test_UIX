"""index — Decision Engine の入口。
  PostGIS → Human Flow Aggregation → Feature Extraction（feature_engine）→ Decision Engine（Jev Adapter ｜ Local Rule Engine）→ Digital Twin State
Jev はシステムの必須依存ではない。JEV_ENABLED=false / timeout / rate limit / key 無し / 障害でも DecisionEngine は同じ型で答える。"""
from .types import Decision, DecisionBundle, AttentionArea, QUESTIONS, CONGESTION_OPTIONS, LOD_OPTIONS, VIS_OPTIONS, BUDGET_OPTIONS
from .local_rule_engine import LocalRuleEngine, contributions
from .jev_adapter import JevAdapter, JevUnavailable
from .fallback import DecisionEngine
from .cache import DecisionCache, state_hash
from .telemetry import Telemetry

_engine: DecisionEngine | None = None


def get_engine() -> DecisionEngine:
    global _engine
    if _engine is None: _engine = DecisionEngine()
    return _engine


__all__ = ['Decision', 'DecisionBundle', 'AttentionArea', 'QUESTIONS', 'CONGESTION_OPTIONS', 'LOD_OPTIONS', 'VIS_OPTIONS', 'BUDGET_OPTIONS',
           'LocalRuleEngine', 'contributions', 'JevAdapter', 'JevUnavailable', 'DecisionEngine', 'DecisionCache', 'state_hash', 'Telemetry', 'get_engine']
