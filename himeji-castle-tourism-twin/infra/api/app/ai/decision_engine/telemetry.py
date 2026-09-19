"""Telemetry: decision type / latency / confidence / source(jev|local) / state hash / timestamp をリングバッファと JSONL に記録。
個人 GPS・person_hash はここには来ない（Urban State は集約値のみ）。A/B 比較（Jev 判断 vs Local 判断）も同じレコードに持つ。"""
from __future__ import annotations
import json, os, threading, time
from collections import deque


class Telemetry:
    def __init__(self, log_path: str | None = None, keep: int = 500):
        self.buf: deque = deque(maxlen=keep); self.lock = threading.Lock(); self.path = log_path
        self.counters = {'requests': 0, 'jevCalls': 0, 'jevErrors': 0, 'fallbacks': 0, 'cacheHits': 0, 'safetyOverrides': 0, 'latencySumMs': 0.0, 'jevLatencySumMs': 0.0}
        self.last = {'jevStatus': 'disabled', 'jevError': None, 'jevLatencyMs': None, 'at': None}

    def record(self, rec: dict) -> None:
        rec = dict(rec); rec.setdefault('ts', time.time())
        with self.lock:
            self.buf.append(rec)
            if self.path:
                try:
                    with open(self.path, 'a', encoding='utf-8') as f: f.write(json.dumps(rec, ensure_ascii=False, default=str) + '\n')
                except OSError: pass

    def bump(self, key: str, by: float = 1) -> None:
        with self.lock: self.counters[key] = self.counters.get(key, 0) + by

    def recent(self, limit: int = 50) -> list:
        with self.lock: return list(self.buf)[-limit:][::-1]

    def summary(self) -> dict:
        with self.lock:
            c = dict(self.counters); n = max(1, c['requests'] - c['cacheHits']); j = max(1, c['jevCalls'])
            return {**c, 'avgLatencyMs': round(c['latencySumMs'] / n, 1), 'avgJevLatencyMs': round(c['jevLatencySumMs'] / j, 1), 'last': dict(self.last), 'buffered': len(self.buf)}
