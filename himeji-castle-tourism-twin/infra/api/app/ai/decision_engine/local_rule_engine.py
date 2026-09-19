"""Local Rule Engine — Jev が使えなくても同じ機能（同じ戻り値型）を提供する決定論的ルール。
  Congestion: density / speed / stay / inflow の重み付きスコア
  Anomaly:    履歴平均に対する z-score の合成
  LOD:        camera height / FPS / point count / memory（hard safety rule もここ）
  Budget:     LOD × FPS × moving
  Visualization: camera height / people / density / movement ratio / stay ratio / FPS / analysis mode
  Attention:  z-score・密度上昇・速度低下・滞在増・流入急増 の合成スコア（候補は PostGIS で top 20〜50 に絞ったもの）"""
from __future__ import annotations
import math
from typing import Optional
from .types import (Decision, AttentionArea, CONGESTION_OPTIONS, LOD_OPTIONS, VIS_OPTIONS, BUDGET_OPTIONS, clamp, num)

# ---- 閾値（config から上書き可） ----
DEFAULTS = {
    'densityRef': 0.65,        # avgDensity（0..1, 200 人/ha=1.0）がこれ以上で「明確な混雑」寄り
    'speedSlow': 0.6,          # m/s 未満を滞留寄り
    'stayLong': 30.0,          # 分
    'fpsLow': 30.0, 'fpsSafety': 25.0, 'fpsHigh': 55.0,
    'memoryMbMax': 1500.0,
    'anomalyWatch': 0.5, 'anomalyWarning': 0.7, 'anomalyHigh': 0.85,
}


def _z(v: float, mean: float, std: float) -> float:
    if std is None or std <= 1e-9: return 0.0 if mean == 0 else clamp((v - mean) / max(abs(mean) * 0.25, 1e-6), -4, 4)
    return clamp((v - mean) / std, -4, 4)


def _pct(v: float, base: float) -> Optional[int]:
    if base is None or abs(base) < 1e-9: return None
    return int(round((v - base) / abs(base) * 100))


def contributions(state: dict) -> dict:
    """Explainability: 入力 Feature の履歴平均からの変化率（実データ計算値。生成文ではない）"""
    mob = state.get('mobility', {}) or {}; area = state.get('area', {}) or {}; hist = state.get('history', {}) or {}
    pairs = [('density', num(area, 'avgDensity'), num(hist, 'densityAvg', None) if hist.get('densityAvg') is not None else None),
             ('speed', num(mob, 'avgSpeed'), hist.get('speedAvg')), ('stay', num(mob, 'avgStayMinutes'), hist.get('stayAvg')),
             ('inflow', num(mob, 'inflow'), hist.get('inflowAvg')), ('outflow', num(mob, 'outflow'), hist.get('outflowAvg')), ('people', num(area, 'peopleCount'), hist.get('peopleAvg'))]
    out = {}
    for k, v, base in pairs:
        b = float(base) if base is not None else None
        out[k] = {'value': round(v, 3), 'baseline': (round(b, 3) if b is not None else None), 'pct': _pct(v, b) if b is not None else None}
    return out


class LocalRuleEngine:
    def __init__(self, cfg: dict | None = None):
        self.cfg = {**DEFAULTS, **(cfg or {})}

    # ---------- Congestion（Choice） ----------
    def congestion(self, state: dict) -> Decision:
        s = self._congestion_raw(state)
        v = 'NORMAL' if s < 0.3 else 'BUSY' if s < 0.55 else 'CONGESTED' if s < 0.8 else 'CRITICAL'
        area = state.get('area', {}) or {}
        conf = 0.6 + 0.3 * clamp(abs(s - 0.55) / 0.45) if num(area, 'meshCount') > 0 or num(area, 'peopleCount') > 0 else 0.35
        if conf < 0.4: v = 'UNKNOWN'
        return Decision('congestion', 'choice', v, round(conf, 3), 'local', meta={'raw': round(s, 3), 'options': CONGESTION_OPTIONS})

    def _congestion_raw(self, state: dict) -> float:
        area = state.get('area', {}) or {}; mob = state.get('mobility', {}) or {}; hist = state.get('history', {}) or {}
        dens = num(area, 'avgDensity'); peak = num(area, 'peakDensity'); spd = num(mob, 'avgSpeed', 1.0); stay = num(mob, 'avgStayMinutes'); inflow = num(mob, 'inflow'); outflow = num(mob, 'outflow')
        d_term = clamp(0.6 * dens / self.cfg['densityRef'] + 0.4 * peak)                    # 密度（平均と最大）
        s_term = clamp(1.0 - spd / 1.3)                                                       # 遅いほど混雑
        st_term = clamp(stay / (self.cfg['stayLong'] * 2))                                    # 滞在が長い
        io_term = clamp((inflow - outflow) / max(1.0, inflow + outflow) * 0.5 + 0.5) if (inflow + outflow) > 0 else 0.5   # 流入超過
        people = num(area, 'peopleCount'); pavg = hist.get('peopleAvg')
        hist_term = clamp(0.5 + 0.5 * math.tanh((people - float(pavg)) / max(1.0, float(pavg)) )) if pavg else 0.5
        return clamp(0.40 * d_term + 0.20 * s_term + 0.15 * st_term + 0.10 * io_term + 0.15 * hist_term)

    # ---------- Congestion Score（Score 0..4） ----------
    def congestion_score(self, state: dict) -> Decision:
        s = self._congestion_raw(state)
        lvl = 0 if s < 0.15 else 1 if s < 0.35 else 2 if s < 0.55 else 3 if s < 0.8 else 4
        return Decision('congestionScore', 'score', lvl, round(0.6 + 0.3 * clamp(1 - abs((s * 5) % 1 - 0.5) * 2), 3), 'local', meta={'raw': round(s, 3), 'levels': ['非常に空いている', '通常', '混雑傾向', '明確な混雑', '極端な混雑']})

    # ---------- Anomaly（Noul 0..1） ----------
    def anomaly(self, state: dict) -> Decision:
        area = state.get('area', {}) or {}; mob = state.get('mobility', {}) or {}; hist = state.get('history', {}) or {}
        if not hist or hist.get('peopleAvg') is None:
            return Decision('anomaly', 'noul', 0.0, 0.3, 'local', meta={'note': 'no history'})
        zs = {
            'people': _z(num(area, 'peopleCount'), num(hist, 'peopleAvg'), num(hist, 'peopleStd', 0)),
            'inflow': _z(num(mob, 'inflow'), num(hist, 'inflowAvg'), num(hist, 'inflowStd', 0)),
            'outflow': _z(num(mob, 'outflow'), num(hist, 'outflowAvg'), num(hist, 'outflowStd', 0)),
            'speed': -_z(num(mob, 'avgSpeed'), num(hist, 'speedAvg'), num(hist, 'speedStd', 0)),
            'stay': _z(num(mob, 'avgStayMinutes'), num(hist, 'stayAvg'), num(hist, 'stayStd', 0)),
            'density': _z(num(area, 'avgDensity'), num(hist, 'densityAvg'), num(hist, 'densityStd', 0)),
        }
        w = {'people': 0.25, 'inflow': 0.15, 'outflow': 0.1, 'speed': 0.15, 'stay': 0.15, 'density': 0.2}
        agg = sum(w[k] * abs(zs[k]) for k in w)                       # 重み付き |z|
        p = clamp(1.0 - math.exp(-agg / 1.6))                          # 0..1 に写像（z≈1.6 で 0.63）
        level = 'normal' if p < self.cfg['anomalyWatch'] else 'watch' if p < self.cfg['anomalyWarning'] else 'warning' if p < self.cfg['anomalyHigh'] else 'high'
        conf = clamp(0.5 + 0.1 * sum(1 for k in zs if abs(zs[k]) > 1.0))
        return Decision('anomaly', 'noul', round(p, 3), round(conf, 3), 'local', meta={'z': {k: round(v, 2) for k, v in zs.items()}, 'level': level})

    # ---------- LOD（Choice LOD0..LOD4） ----------
    def lod(self, state: dict) -> Decision:
        cam = state.get('camera', {}) or {}; ren = state.get('rendering', {}) or {}; area = state.get('area', {}) or {}
        h = num(cam, 'height', 2000); fps = num(ren, 'fps', 60); moving = bool(cam.get('moving')); mem = num(ren, 'memoryMb', 0); lat = num(ren, 'latencyMs', 0)
        i = 0 if h >= 6000 else 1 if h >= 2500 else 2 if h >= 900 else 3 if h >= 300 else 4
        reason = ['camera']
        if fps < self.cfg['fpsLow'] and i > 0: i -= 1; reason.append('fps<30')
        if moving and i >= 3: i -= 1; reason.append('moving')
        if lat > 1500 and i >= 3: i -= 1; reason.append('latency')
        if mem > self.cfg['memoryMbMax'] and i > 0: i -= 1; reason.append('memory')
        if num(area, 'avgDensity') > 0.8 and i == 4 and fps < 45: i = 3; reason.append('dense')
        conf = 0.85 if not moving else 0.7
        return Decision('lod', 'choice', LOD_OPTIONS[i], conf, 'local', meta={'reason': reason, 'options': LOD_OPTIONS})

    # ---------- hard safety（Jev の判断にも必ず適用） ----------
    def safety(self, state: dict, lod_value: str, budget_value: int) -> tuple[str, int, list]:
        ren = state.get('rendering', {}) or {}; fps = num(ren, 'fps', 60); mem = num(ren, 'memoryMb', 0); notes = []
        li = LOD_OPTIONS.index(lod_value) if lod_value in LOD_OPTIONS else 2; bi = BUDGET_OPTIONS.index(budget_value) if budget_value in BUDGET_OPTIONS else 3
        if fps < self.cfg['fpsSafety'] and fps > 0:
            li = max(0, li - 1); bi = max(0, bi - 1); notes.append(f'FPS {fps:.0f} < {self.cfg["fpsSafety"]:.0f}: LOD/Budget を強制的に下げた')
        if mem > self.cfg['memoryMbMax']:
            li = max(0, li - 1); bi = max(0, min(bi, 1)); notes.append(f'memory {mem:.0f}MB > {self.cfg["memoryMbMax"]:.0f}MB')
        return LOD_OPTIONS[li], BUDGET_OPTIONS[bi], notes

    # ---------- Point Budget（Choice） ----------
    def point_budget(self, state: dict, lod_value: str | None = None) -> Decision:
        cam = state.get('camera', {}) or {}; ren = state.get('rendering', {}) or {}
        fps = num(ren, 'fps', 60); moving = bool(cam.get('moving')); lod_value = lod_value or self.lod(state).value
        base = {'LOD0': 200000, 'LOD1': 350000, 'LOD2': 500000, 'LOD3': 750000, 'LOD4': 1000000}[lod_value]
        if fps < 30: base = min(base, 200000)
        elif fps < 45: base = min(base, 500000)
        if moving: base = min(base, 350000)
        if fps > self.cfg['fpsHigh'] and not moving: base = min(1000000, max(base, 500000))
        v = min(BUDGET_OPTIONS, key=lambda b: abs(b - base))
        return Decision('pointBudget', 'choice', v, 0.8 if not moving else 0.65, 'local', meta={'options': BUDGET_OPTIONS})

    # ---------- Visualization Router（Choice: primary + secondary） ----------
    def visualization(self, state: dict) -> Decision:
        cam = state.get('camera', {}) or {}; ren = state.get('rendering', {}) or {}; area = state.get('area', {}) or {}; mob = state.get('mobility', {}) or {}; an = state.get('analysis', {}) or {}
        h = num(cam, 'height', 2000); fps = num(ren, 'fps', 60); people = num(area, 'peopleCount'); dens = num(area, 'avgDensity'); mr = num(mob, 'movementRatio', 0.5); sr = num(mob, 'stayRatio', 0.5); mode = (an.get('mode') or '').lower()
        primary, secondary, why = 'POINTS', None, []
        if h >= 6000: primary, why = 'GRID', ['city scale → 250m grid']
        elif h >= 2500: primary = 'HEATMAP' if dens > 0.35 else 'GRID'; why = ['district scale']
        elif h >= 900:
            if mr > 0.6: primary, secondary, why = 'FLOW', 'CONTOUR' if dens > 0.4 else None, ['block scale, moving majority']
            elif sr > 0.6: primary, secondary, why = 'POINTS', 'HEATMAP', ['block scale, staying majority']
            else: primary, secondary, why = 'POINTS', 'HEATMAP' if dens > 0.3 else None, ['block scale']
        else:
            primary = 'VOLUME' if dens > 0.6 and fps >= 40 else 'POINTS'; secondary = 'HEATMAP' if dens > 0.45 else None; why = ['street scale']
        if mode in ('od', 'flow') and h < 6000: primary, why = 'FLOW', why + ['analysis mode: OD']
        if mode == 'trips' and h < 4000: primary = 'TRIPS'
        if fps < 30 and primary in ('VOLUME', 'TRIPS'): primary = 'POINTS'; secondary = None; why.append('fps<30')
        if fps < 30 and secondary: secondary = None
        conf = 0.75 if h >= 900 else 0.65
        return Decision('visualization', 'choice', primary, conf, 'local', meta={'secondary': secondary, 'reason': why, 'options': VIS_OPTIONS})

    # ---------- Point Cloud AI Control ----------
    def point_cloud(self, state: dict, lod_value: str, budget: int) -> Decision:
        cam = state.get('camera', {}) or {}; ren = state.get('rendering', {}) or {}; fps = num(ren, 'fps', 60); moving = bool(cam.get('moving')); h = num(cam, 'height', 2000)
        trail = 'LOW' if (moving or fps < 35) else 'HIGH' if fps >= 50 else 'MEDIUM'
        soft = 'LOW' if fps < 30 else 'HIGH'
        heat = (lod_value in ('LOD2', 'LOD3', 'LOD4')) and num(state.get('area', {}) or {}, 'avgDensity') > 0.35 and fps >= 35
        pick = (not moving) and h < 400 and fps >= 30
        fine = lod_value == 'LOD4' and not moving and fps >= 45
        v = {'trailQuality': trail, 'softPointQuality': soft, 'heatmapOverlay': bool(heat), 'pickable': bool(pick), 'finePoints': bool(fine), 'pointBudget': budget, 'lod': lod_value}
        return Decision('pointCloud', 'choice', v, 0.8 if not moving else 0.7, 'local')

    # ---------- Attention（Score → attentionScore 0..100） ----------
    def attention(self, candidates: list, top: int = 5) -> list[AttentionArea]:
        out = []
        for c in candidates or []:
            f = c.get('features', c) or {}; hist = c.get('hist', {}) or {}
            people = num(f, 'people'); dens = num(f, 'density'); spd = num(f, 'speed', 1.0); stay = num(f, 'stay'); inflow = num(f, 'inflow'); outflow = num(f, 'outflow')
            zp = _z(people, num(hist, 'peopleAvg', people), num(hist, 'peopleStd', 0)); zi = _z(inflow, num(hist, 'inflowAvg', inflow), num(hist, 'inflowStd', 0)); zo = _z(outflow, num(hist, 'outflowAvg', outflow), num(hist, 'outflowStd', 0))
            sp_avg = num(hist, 'speedAvg', spd); st_avg = num(hist, 'stayAvg', stay); d_avg = num(hist, 'densityAvg', dens)
            dens_pct = _pct(dens, d_avg); spd_pct = _pct(spd, sp_avg); stay_pct = _pct(stay, st_avg); in_pct = _pct(inflow, num(hist, 'inflowAvg', 0)); out_pct = _pct(outflow, num(hist, 'outflowAvg', 0))
            dens_term = clamp(dens); zscore = clamp(max(zp, 0) / 3); speed_drop = clamp((sp_avg - spd) / max(0.3, sp_avg)) if sp_avg > 0 else 0.0; stay_up = clamp((stay - st_avg) / max(5.0, st_avg)) if st_avg > 0 else clamp(stay / 60)
            inflow_up = clamp(max(zi, 0) / 3); flow_imb = clamp(abs(inflow - outflow) / max(1.0, inflow + outflow))
            score = 100 * clamp(0.32 * dens_term + 0.22 * zscore + 0.14 * speed_drop + 0.12 * stay_up + 0.12 * inflow_up + 0.08 * flow_imb)
            kind = 'Congestion'
            if inflow_up > 0.6 and inflow_up >= max(dens_term, stay_up): kind = 'Inflow spike'
            elif zo > 2 and clamp(zo / 3) > dens_term: kind = 'Outflow spike'
            elif stay_up > 0.6 and speed_drop > 0.4: kind = 'Stay build-up'
            elif flow_imb > 0.6 and dens_term < 0.5: kind = 'Flow anomaly'
            reasons = []
            for name, pct, up_is_bad in (('density', dens_pct, True), ('speed', spd_pct, False), ('stay', stay_pct, True), ('inflow', in_pct, True), ('outflow', out_pct, True)):
                if pct is None or abs(pct) < 8: continue
                reasons.append({'feature': name, 'dir': 'up' if pct > 0 else 'down', 'pct': pct})
            reasons.sort(key=lambda r: -abs(r['pct'])); reasons = reasons[:4]
            conf = clamp(0.55 + 0.1 * len(reasons) + (0.1 if hist else 0))
            out.append(AttentionArea(0, str(c.get('meshId') or c.get('mesh_id') or ''), str(c.get('name') or c.get('meshId') or ''), float(c.get('lon') or 0), float(c.get('lat') or 0), round(score, 1), kind, reasons,
                                     {'people': people, 'density': round(dens, 3), 'speed': round(spd, 2), 'stay': round(stay, 1), 'inflow': inflow, 'outflow': outflow, 'z': round(zp, 2)}, round(conf, 2), 'local'))
        out.sort(key=lambda a: -a.score)
        for i, a in enumerate(out[:top]): a.rank = i + 1
        return out[:top]
