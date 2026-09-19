"""Jev Adapter — Jev の判断プリミティブ（Choice / Score / Noul）を共通 Interface に変換する唯一の層。
Jev 固有の通信・リクエスト形はこのファイルの中だけに閉じる（正式 API / SDK が出たら `_transport()` だけを差し替える）。

  provider = 'mock' : Jev の応答形を模した決定論的モック（Interface 検証用。Local Rule と同じ特徴量から作るが confidence を持つ）
  provider = 'http' : JEV_API_URL へ 1 リクエストで複数 Question をまとめて送る（Decision Bundle）。timeout / rate limit / 障害は JevUnavailable

Playground URL を本番 API として直接組み込まない（JEV_API_URL は必ず .env から）。API Key はサーバ側にしか置かない。
1 Urban State に対して congestion / anomaly / lod / visualization / attention を 1 request で問い合わせる。"""
from __future__ import annotations
import json, os, time, hashlib, urllib.request, urllib.error
from typing import Optional
from .types import Decision, AttentionArea, CONGESTION_OPTIONS, LOD_OPTIONS, VIS_OPTIONS, BUDGET_OPTIONS, clamp, num
from .local_rule_engine import LocalRuleEngine


class JevUnavailable(Exception):
    """未接続 / timeout / rate limit / API key 無し / provider 障害。呼び出し側は Local Rule Engine へフォールバックする"""


def _env(name: str, default: str = '') -> str:
    return os.environ.get(name, default)


class JevAdapter:
    def __init__(self, cfg: dict | None = None, local: LocalRuleEngine | None = None):
        c = cfg or {}
        self.enabled = str(c.get('enabled', _env('JEV_ENABLED', 'false'))).lower() in ('1', 'true', 'yes', 'on')
        self.api_key = c.get('apiKey', _env('JEV_API_KEY', ''))
        self.api_url = c.get('apiUrl', _env('JEV_API_URL', ''))
        self.model = c.get('model', _env('JEV_MODEL', 'jev-latest'))
        self.provider = c.get('provider', _env('JEV_PROVIDER', 'mock')).lower()        # mock | http
        self.timeout_ms = int(c.get('timeoutMs', _env('JEV_TIMEOUT_MS', '700')))
        self.local = local or LocalRuleEngine()
        self.last_error: Optional[str] = None; self.last_latency_ms: Optional[float] = None; self.calls = 0; self.errors = 0
        self._rate_until = 0.0

    # ---------- 状態 ----------
    def status(self) -> dict:
        st = 'disabled' if not self.enabled else 'rate-limited' if time.time() < self._rate_until else ('mock' if self.provider == 'mock' else ('missing-key' if not self.api_key else ('missing-url' if not self.api_url else ('error' if self.last_error else 'ready'))))
        return {'enabled': self.enabled, 'provider': self.provider, 'model': self.model, 'timeoutMs': self.timeout_ms, 'status': st, 'lastError': self.last_error, 'lastLatencyMs': self.last_latency_ms, 'calls': self.calls, 'errors': self.errors,
                'hasApiKey': bool(self.api_key), 'hasApiUrl': bool(self.api_url)}

    def available(self) -> bool:
        if not self.enabled: return False
        if time.time() < self._rate_until: return False
        if self.provider == 'mock': return True
        return bool(self.api_key) and bool(self.api_url)

    # ---------- 共通 Interface（Local Rule Engine と同じ戻り値型） ----------
    def evaluate(self, state: dict, questions: list, candidates: list | None) -> dict:
        """questions を 1 リクエストにまとめて Jev に問い合わせ、{question: Decision, 'attention': [AttentionArea]} を返す"""
        if not self.available(): raise JevUnavailable('jev disabled or not configured')
        bundle = self._build_request(state, questions, candidates)
        t0 = time.time()
        try:
            raw = self._mock(bundle, state, candidates) if self.provider == 'mock' else self._transport(bundle)
        except JevUnavailable as e:
            self.errors += 1; self.last_error = str(e); raise
        except Exception as e:                                       # noqa: BLE001 — provider 障害はすべてフォールバック
            self.errors += 1; self.last_error = f'{type(e).__name__}: {e}'; raise JevUnavailable(self.last_error) from e
        self.calls += 1; self.last_latency_ms = round((time.time() - t0) * 1000, 1); self.last_error = None
        return self._parse(raw, questions, candidates)

    # ---------- リクエスト形（Jev Model Contract） ----------
    def _build_request(self, state: dict, questions: list, candidates: list | None) -> dict:
        prims = []
        if 'congestion' in questions: prims.append({'id': 'congestion', 'type': 'choice', 'question': 'Classify the current congestion state of the area.', 'options': CONGESTION_OPTIONS})
        if 'congestionScore' in questions: prims.append({'id': 'congestionScore', 'type': 'score', 'question': 'Congestion level of the area.', 'range': [0, 4]})
        if 'anomaly' in questions: prims.append({'id': 'anomaly', 'type': 'noul', 'question': 'Does the current human-flow state show a meaningful deviation from the normal state?'})
        if 'lod' in questions: prims.append({'id': 'lod', 'type': 'choice', 'question': 'Select the level of detail for the digital twin.', 'options': LOD_OPTIONS})
        if 'pointBudget' in questions: prims.append({'id': 'pointBudget', 'type': 'choice', 'question': 'Select the point budget.', 'options': [str(b) for b in BUDGET_OPTIONS]})
        if 'visualization' in questions: prims.append({'id': 'visualization', 'type': 'choice', 'question': 'Select the primary visualization.', 'options': VIS_OPTIONS})
        if 'attention' in questions and candidates:
            prims.append({'id': 'attention', 'type': 'score', 'question': 'Attention score per mesh candidate.', 'range': [0, 100], 'items': [{'id': c.get('meshId'), 'features': c.get('features', {}), 'hist': c.get('hist', {})} for c in candidates[:50]]})
        safe_state = {k: state.get(k) for k in ('timestamp', 'camera', 'rendering', 'area', 'mobility', 'history', 'analysis') if state.get(k) is not None}   # 集約値のみ（生 GPS / person_hash は無い）
        return {'model': self.model, 'state': safe_state, 'primitives': prims}

    # ---------- HTTP transport（正式 API 仕様が出たらここだけ変更） ----------
    def _transport(self, bundle: dict) -> dict:
        data = json.dumps(bundle).encode()
        req = urllib.request.Request(self.api_url, data=data, method='POST', headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {self.api_key}', 'User-Agent': 'himeji-twin/jev-adapter'})
        try:
            with urllib.request.urlopen(req, timeout=self.timeout_ms / 1000.0) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                self._rate_until = time.time() + 30; raise JevUnavailable('rate limited (429)') from e
            if e.code in (401, 403): raise JevUnavailable(f'auth error ({e.code})') from e
            raise JevUnavailable(f'http {e.code}') from e
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            raise JevUnavailable(f'timeout/network: {e}') from e

    # ---------- mock provider（Interface 検証用。決定論的・Jev 応答形） ----------
    def _mock(self, bundle: dict, state: dict, candidates: list | None) -> dict:
        seed = int(hashlib.sha1(json.dumps(bundle.get('state'), sort_keys=True, default=str).encode()).hexdigest()[:8], 16)
        jitter = ((seed % 1000) / 1000.0 - 0.5) * 0.12                   # ±0.06 の決定論的揺らぎ（状態が同じなら同じ応答）
        time.sleep(min(0.05, self.timeout_ms / 1000.0 * 0.05))
        L = self.local; results = []
        for p in bundle['primitives']:
            pid = p['id']
            if pid == 'congestion':
                d = L.congestion(state); results.append({'id': pid, 'type': 'choice', 'value': d.value, 'confidence': round(clamp(d.confidence + 0.08 + jitter), 3)})
            elif pid == 'congestionScore':
                d = L.congestion_score(state); results.append({'id': pid, 'type': 'score', 'value': d.value, 'confidence': round(clamp(d.confidence + 0.05 + jitter), 3)})
            elif pid == 'anomaly':
                d = L.anomaly(state); results.append({'id': pid, 'type': 'noul', 'probability': round(clamp(float(d.value) * (1.0 + jitter)), 3), 'confidence': round(clamp(d.confidence + 0.1), 3)})
            elif pid == 'lod':
                d = L.lod(state); results.append({'id': pid, 'type': 'choice', 'value': d.value, 'confidence': round(clamp(d.confidence + jitter), 3)})
            elif pid == 'pointBudget':
                d = L.point_budget(state); results.append({'id': pid, 'type': 'choice', 'value': str(d.value), 'confidence': round(clamp(d.confidence + jitter), 3)})
            elif pid == 'visualization':
                d = L.visualization(state); results.append({'id': pid, 'type': 'choice', 'value': d.value, 'secondary': d.meta.get('secondary'), 'confidence': round(clamp(d.confidence + 0.05 + jitter), 3)})
            elif pid == 'attention':
                areas = L.attention(candidates, top=len(candidates or [])); results.append({'id': pid, 'type': 'score', 'items': [{'id': a.mesh_id, 'score': round(clamp(a.score / 100 * (1 + jitter)) * 100, 1), 'confidence': a.confidence} for a in areas]})
        return {'model': self.model, 'results': results, 'usage': {'primitives': len(results)}}

    # ---------- 応答 → 共通型 ----------
    def _parse(self, raw: dict, questions: list, candidates: list | None) -> dict:
        src = 'jev-mock' if self.provider == 'mock' else 'jev'; out = {}
        byid = {r.get('id'): r for r in (raw.get('results') or [])}
        for qid in questions:
            r = byid.get(qid)
            if not r: continue
            if qid == 'anomaly': out[qid] = Decision(qid, 'noul', float(r.get('probability', r.get('value', 0))), float(r.get('confidence', 0.5)), src)
            elif qid == 'congestionScore': out[qid] = Decision(qid, 'score', int(r.get('value', 0)), float(r.get('confidence', 0.5)), src)
            elif qid == 'pointBudget': out[qid] = Decision(qid, 'choice', int(str(r.get('value', '500000')).replace(',', '')), float(r.get('confidence', 0.5)), src)
            elif qid == 'visualization': out[qid] = Decision(qid, 'choice', str(r.get('value')), float(r.get('confidence', 0.5)), src, meta={'secondary': r.get('secondary')})
            elif qid == 'attention':
                scores = {it.get('id'): it for it in (r.get('items') or [])}; areas = []
                for c in candidates or []:
                    it = scores.get(c.get('meshId'))
                    if not it: continue
                    base = self.local.attention([c], top=1)
                    if not base: continue
                    a = base[0]; a.score = float(it.get('score', a.score)); a.confidence = float(it.get('confidence', a.confidence)); a.source = src; areas.append(a)
                areas.sort(key=lambda a: -a.score)
                for i, a in enumerate(areas[:5]): a.rank = i + 1
                out['attention'] = areas[:5]
            else: out[qid] = Decision(qid, 'choice', str(r.get('value')), float(r.get('confidence', 0.5)), src)
        return out
