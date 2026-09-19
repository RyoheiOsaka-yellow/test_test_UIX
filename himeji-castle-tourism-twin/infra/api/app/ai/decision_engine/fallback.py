"""Fallback Decision Engine — Jev → Local Rule Engine の順に判断し、confidence 方針・hard safety rule・cache・telemetry を束ねる。
  confidence >= high(0.75)          : Jev の結果を採用
  low(0.55) <= confidence < high     : Jev と Local を比較（一致なら Jev、不一致なら Local を採用し alt に Jev を残す）
  confidence < low(0.55) / 未接続    : Local を採用
  hard safety: FPS < 25 または memory 超過なら LOD / Budget を強制的に下げる（Jev の判断より優先）
Jev が無効・timeout・rate limit・key 無し・障害でも同じ型の Bundle を返す（Digital Twin は常に動く）。"""
from __future__ import annotations
import os, time
from .types import Decision, DecisionBundle, QUESTIONS, BUDGET_OPTIONS
from .local_rule_engine import LocalRuleEngine, contributions
from .jev_adapter import JevAdapter, JevUnavailable
from .cache import DecisionCache, state_hash
from .telemetry import Telemetry


def _f(name: str, default: float) -> float:
    try: return float(os.environ.get(name, default))
    except ValueError: return default


class DecisionEngine:
    """DecisionEngine: evaluateUrbanState() / evaluateMesh() / selectVisualization() / selectLOD() / detectAnomaly() / rankAttentionAreas()"""

    def __init__(self, cfg: dict | None = None):
        c = cfg or {}
        self.local = LocalRuleEngine({'anomalyWatch': _f('JEV_ANOMALY_WATCH', 0.5), 'anomalyWarning': _f('JEV_ANOMALY_WARNING', 0.7), 'anomalyHigh': _f('JEV_ANOMALY_HIGH', 0.85), 'fpsSafety': _f('JEV_FPS_SAFETY', 25), 'memoryMbMax': _f('JEV_MEMORY_MB_MAX', 1500)})
        self.jev = JevAdapter(c.get('jev'), self.local)
        self.cache = DecisionCache(int(_f('JEV_CACHE_TTL_MS', 5000)))
        self.telemetry = Telemetry(os.environ.get('JEV_TELEMETRY_LOG') or None)
        self.th_adopt = _f('JEV_CONFIDENCE_THRESHOLD', 0.65); self.th_high = _f('JEV_CONFIDENCE_HIGH', 0.75); self.th_low = _f('JEV_CONFIDENCE_LOW', 0.55)

    # ---------- 公開 Interface ----------
    def evaluate_urban_state(self, state: dict, questions: list | None = None, candidates: list | None = None, mode: str = 'auto') -> DecisionBundle:
        questions = [q for q in (questions or QUESTIONS) if q in QUESTIONS]
        if 'attention' in questions and not candidates: questions = [q for q in questions if q != 'attention']
        t0 = time.time(); key = state_hash(state, questions, len(candidates or []))
        self.telemetry.bump('requests')
        cached = self.cache.get(key) if mode != 'both' else None
        if cached is not None:
            self.telemetry.bump('cacheHits'); b = DecisionBundle(**cached); b.meta = {**b.meta, 'cacheHit': True, 'latencyMs': round((time.time() - t0) * 1000, 1)}; return b
        local = self._local_all(state, questions, candidates)
        jev, jev_err = None, None
        if self.jev.available():
            try:
                self.telemetry.bump('jevCalls'); jev = self.jev.evaluate(state, questions, candidates); self.telemetry.bump('jevLatencySumMs', self.jev.last_latency_ms or 0)
                self.telemetry.last.update({'jevStatus': 'connected' if self.jev.provider != 'mock' else 'mock', 'jevError': None, 'jevLatencyMs': self.jev.last_latency_ms, 'at': time.time()})
            except JevUnavailable as e:
                jev_err = str(e); self.telemetry.bump('jevErrors'); self.telemetry.bump('fallbacks'); self.telemetry.last.update({'jevStatus': 'fallback', 'jevError': jev_err, 'at': time.time()})
        else:
            self.telemetry.bump('fallbacks'); self.telemetry.last.update({'jevStatus': 'disabled' if not self.jev.enabled else 'fallback', 'jevError': self.jev.last_error, 'at': time.time()})
        merged = self._merge(local, jev)
        merged, safety_notes = self._safety(state, merged)
        attention = merged.pop('attention', []) if 'attention' in merged else []
        decisions = {q: d.to_dict() for q, d in merged.items()}
        src_summary = 'jev' if any(d.source.startswith('jev') for d in merged.values()) else 'local'
        meta = {'source': src_summary, 'jevStatus': self.telemetry.last['jevStatus'], 'jevError': jev_err, 'stateHash': key, 'cacheHit': False, 'latencyMs': round((time.time() - t0) * 1000, 1),
                'safety': safety_notes, 'thresholds': {'adopt': self.th_adopt, 'high': self.th_high, 'low': self.th_low}, 'timestamp': time.time(), 'questions': questions}
        bundle = DecisionBundle(decisions, [a.to_dict() for a in attention], contributions(state), meta)
        self.cache.put(key, bundle.to_dict()); self.telemetry.bump('latencySumMs', meta['latencyMs'])
        self.telemetry.record({'type': 'bundle', 'stateHash': key, 'latencyMs': meta['latencyMs'], 'source': src_summary, 'jevStatus': meta['jevStatus'], 'jevLatencyMs': self.jev.last_latency_ms,
                               'decisions': {q: {'value': d['value'], 'confidence': d['confidence'], 'source': d['source']} for q, d in decisions.items()},
                               'ab': {q: {'jev': (jev[q].value if jev and q in jev else None), 'jevConf': (jev[q].confidence if jev and q in jev else None), 'local': local[q].value, 'localConf': local[q].confidence} for q in local if q != 'attention'},
                               'attentionTop': [{'mesh': a.mesh_id, 'score': a.score, 'kind': a.kind} for a in attention[:3]], 'safety': safety_notes})
        return bundle

    def evaluate_mesh(self, candidate: dict) -> dict:
        a = self.local.attention([candidate], top=1); return a[0].to_dict() if a else {}
    def select_visualization(self, state: dict) -> dict: return self.evaluate_urban_state(state, ['visualization']).decisions['visualization']
    def select_lod(self, state: dict) -> dict: return self.evaluate_urban_state(state, ['lod', 'pointBudget']).decisions['lod']
    def detect_anomaly(self, state: dict) -> dict: return self.evaluate_urban_state(state, ['anomaly']).decisions['anomaly']
    def rank_attention_areas(self, state: dict, candidates: list) -> list: return self.evaluate_urban_state(state, ['attention'], candidates).attention

    def status(self) -> dict:
        return {'jev': self.jev.status(), 'cache': self.cache.stats(), 'telemetry': self.telemetry.summary(), 'thresholds': {'adopt': self.th_adopt, 'high': self.th_high, 'low': self.th_low},
                'anomalyLevels': {'watch': self.local.cfg['anomalyWatch'], 'warning': self.local.cfg['anomalyWarning'], 'high': self.local.cfg['anomalyHigh']}, 'safety': {'fps': self.local.cfg['fpsSafety'], 'memoryMb': self.local.cfg['memoryMbMax']}}

    # ---------- 内部 ----------
    def _local_all(self, state: dict, questions: list, candidates: list | None) -> dict:
        L = self.local; out = {}
        if 'congestion' in questions: out['congestion'] = L.congestion(state)
        if 'congestionScore' in questions: out['congestionScore'] = L.congestion_score(state)
        if 'anomaly' in questions: out['anomaly'] = L.anomaly(state)
        lod = L.lod(state)
        if 'lod' in questions: out['lod'] = lod
        budget = L.point_budget(state, lod.value)
        if 'pointBudget' in questions: out['pointBudget'] = budget
        if 'visualization' in questions: out['visualization'] = L.visualization(state)
        if 'pointCloud' in questions: out['pointCloud'] = L.point_cloud(state, lod.value, budget.value)
        if 'attention' in questions: out['attention'] = L.attention(candidates or [], top=5)
        return out

    def _merge(self, local: dict, jev: dict | None) -> dict:
        if not jev: return dict(local)
        out = {}
        for q, ld in local.items():
            jd = jev.get(q)
            if q == 'attention':
                out[q] = jd if jd else ld; continue
            if jd is None: out[q] = ld; continue
            if jd.confidence >= self.th_high:
                jd.alt = {'value': ld.value, 'confidence': ld.confidence, 'source': 'local'}; out[q] = jd
            elif jd.confidence >= self.th_low:
                agree = (jd.value == ld.value) if q not in ('anomaly',) else abs(float(jd.value) - float(ld.value)) < 0.15
                if agree: jd.confidence = round(min(1.0, jd.confidence + 0.1), 3); jd.alt = {'value': ld.value, 'confidence': ld.confidence, 'source': 'local'}; jd.meta = {**jd.meta, 'agree': True}; out[q] = jd
                else: ld.alt = {'value': jd.value, 'confidence': jd.confidence, 'source': jd.source}; ld.meta = {**ld.meta, 'jevDisagreed': True}; out[q] = ld
            else:
                ld.alt = {'value': jd.value, 'confidence': jd.confidence, 'source': jd.source}; out[q] = ld
        if 'pointCloud' in out and 'lod' in out and 'pointBudget' in out:
            pc = out['pointCloud']; pc.value = {**pc.value, 'lod': out['lod'].value, 'pointBudget': out['pointBudget'].value}
        if 'congestion' in out and out['congestion'].confidence < self.th_adopt and out['congestion'].source.startswith('jev'):
            out['congestion'] = local['congestion']                          # 閾値未満は Local（または UNKNOWN）
        return out

    def _safety(self, state: dict, merged: dict) -> tuple[dict, list]:
        lod = merged.get('lod'); bud = merged.get('pointBudget'); notes = []
        if lod or bud:
            lv, bv, notes = self.local.safety(state, lod.value if lod else 'LOD2', bud.value if bud else 500000)
            if notes:
                self.telemetry.bump('safetyOverrides')
                if lod and lv != lod.value: lod.alt = {'value': lod.value, 'confidence': lod.confidence, 'source': lod.source}; lod.value = lv; lod.source = 'safety'; lod.confidence = 1.0
                if bud and bv != bud.value: bud.alt = {'value': bud.value, 'confidence': bud.confidence, 'source': bud.source}; bud.value = bv; bud.source = 'safety'; bud.confidence = 1.0
                if 'pointCloud' in merged: merged['pointCloud'].value = {**merged['pointCloud'].value, 'lod': lv, 'pointBudget': bv}
        return merged, notes
