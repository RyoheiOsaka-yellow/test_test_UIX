"""Feature Engine — PostGIS（mobility.mesh_stats / raw_points / stays）から Jev / Local Rule に渡す集約 Feature だけを作る。
生 GPS・person_hash・個人軌跡はここで落ちる（返すのは bbox 内の合計・平均・偏差とメッシュ単位の統計のみ）。
  area:     meshCount / peopleCount / avgDensity / peakDensity（density は 200 人/ha = 1.0 に正規化）
  mobility: avgSpeed / avgStayMinutes / inflow / outflow / movementRatio / stayRatio
  history:  同じ bbox の当日の全バケット平均・標準偏差（historical deviation 用）
  candidates: bbox 内 top N メッシュ（people 順）と各メッシュの当日平均・標準偏差（Attention 候補は PostGIS で絞る）"""
from __future__ import annotations
from datetime import datetime, timedelta
from typing import Callable

DENS_REF = 200.0     # 人/ha → 1.0
POI_NAMES = {}


def _bbox_sql(a): return 'ST_MakeEnvelope(%(minlon)s,%(minlat)s,%(maxlon)s,%(maxlat)s,4326)'
def _bp(a): return {'minlon': a[0], 'minlat': a[1], 'maxlon': a[2], 'maxlat': a[3]}


def urban_features(q: Callable, bbox: list, t: datetime, source: str, res: int = 100, bucket: int = 5, top_n: int = 30) -> dict:
    day0 = t.astimezone().replace(hour=0, minute=0, second=0, microsecond=0) if t.tzinfo else t.replace(hour=0, minute=0, second=0, microsecond=0)
    p = {'res': res, 'b': bucket, 't': t, 'src': source, 'd0': day0, 'd1': day0 + timedelta(days=1), **_bp(bbox)}
    cur = q(f"""SELECT count(*) AS mesh_count, COALESCE(sum(people_count),0) AS people, COALESCE(avg(density),0) AS avg_density, COALESCE(max(density),0) AS peak_density,
                       COALESCE(avg(avg_speed),0) AS avg_speed, COALESCE(avg(avg_stay_sec),0) AS avg_stay_sec, COALESCE(sum(inflow),0) AS inflow, COALESCE(sum(outflow),0) AS outflow,
                       COALESCE(sum(people_count) FILTER (WHERE avg_speed >= 0.3),0)::float / GREATEST(1, sum(people_count)) AS movement_ratio
                FROM mobility.mesh_stats_at(%(res)s, %(b)s, %(t)s, %(src)s, {_bbox_sql(bbox)})""", p)[0]
    hist = q(f"""WITH per AS (SELECT s.time_bucket, sum(s.people_count) AS people, avg(s.density) AS density, avg(s.avg_speed) AS speed, avg(s.avg_stay_sec) AS stay, sum(s.inflow) AS inflow, sum(s.outflow) AS outflow
                             FROM mobility.mesh_stats s JOIN mobility.meshes m USING (mesh_id)
                             WHERE s.bucket_minutes=%(b)s AND s.source_type=%(src)s AND m.mesh_type='square'||%(res)s AND s.time_bucket >= %(d0)s AND s.time_bucket < %(d1)s AND m.geom && {_bbox_sql(bbox)}
                             GROUP BY s.time_bucket)
                 SELECT count(*) AS n, avg(people) AS people_avg, stddev_pop(people) AS people_std, avg(density) AS density_avg, stddev_pop(density) AS density_std,
                        avg(speed) AS speed_avg, stddev_pop(speed) AS speed_std, avg(stay) AS stay_avg, stddev_pop(stay) AS stay_std,
                        avg(inflow) AS inflow_avg, stddev_pop(inflow) AS inflow_std, avg(outflow) AS outflow_avg, stddev_pop(outflow) AS outflow_std FROM per""", p)[0]
    cand = q(f"""WITH now AS (SELECT * FROM mobility.mesh_stats_at(%(res)s, %(b)s, %(t)s, %(src)s, {_bbox_sql(bbox)}) ORDER BY people_count DESC LIMIT %(n)s),
                 h AS (SELECT s.mesh_id, avg(s.people_count) AS people_avg, stddev_pop(s.people_count) AS people_std, avg(s.density) AS density_avg, avg(s.avg_speed) AS speed_avg, avg(s.avg_stay_sec) AS stay_avg,
                              avg(s.inflow) AS inflow_avg, stddev_pop(s.inflow) AS inflow_std, avg(s.outflow) AS outflow_avg, stddev_pop(s.outflow) AS outflow_std
                       FROM mobility.mesh_stats s WHERE s.mesh_id IN (SELECT mesh_id FROM now) AND s.bucket_minutes=%(b)s AND s.source_type=%(src)s AND s.time_bucket >= %(d0)s AND s.time_bucket < %(d1)s GROUP BY s.mesh_id),
                 poi AS (SELECT n.mesh_id, (SELECT p.name FROM mobility.pois p ORDER BY p.geom <-> n.centroid LIMIT 1) AS poi_name, (SELECT ST_Distance(p.geom::geography, n.centroid::geography) FROM mobility.pois p ORDER BY p.geom <-> n.centroid LIMIT 1) AS poi_dist FROM now n)
                 SELECT n.mesh_id, n.people_count, n.density, n.avg_speed, n.avg_stay_sec, n.inflow, n.outflow, ST_X(n.centroid) AS lon, ST_Y(n.centroid) AS lat,
                        h.people_avg, h.people_std, h.density_avg, h.speed_avg, h.stay_avg, h.inflow_avg, h.inflow_std, h.outflow_avg, h.outflow_std, poi.poi_name, poi.poi_dist
                 FROM now n LEFT JOIN h ON h.mesh_id = n.mesh_id LEFT JOIN poi ON poi.mesh_id = n.mesh_id ORDER BY n.people_count DESC""", {**p, 'n': top_n})
    f = lambda v, d=0.0: float(v) if v is not None else d
    state_part = {
        'area': {'meshCount': int(cur['mesh_count']), 'peopleCount': int(cur['people']), 'avgDensity': round(f(cur['avg_density']) / DENS_REF, 4), 'peakDensity': round(min(1.0, f(cur['peak_density']) / DENS_REF), 4)},
        'mobility': {'avgSpeed': round(f(cur['avg_speed']), 3), 'avgStayMinutes': round(f(cur['avg_stay_sec']) / 60.0, 1), 'inflow': int(cur['inflow']), 'outflow': int(cur['outflow']),
                     'movementRatio': round(f(cur['movement_ratio']), 3), 'stayRatio': round(1.0 - f(cur['movement_ratio']), 3)},
        'history': ({'buckets': int(hist['n']), 'peopleAvg': f(hist['people_avg']), 'peopleStd': f(hist['people_std']), 'densityAvg': f(hist['density_avg']) / DENS_REF, 'densityStd': f(hist['density_std']) / DENS_REF,
                     'speedAvg': f(hist['speed_avg']), 'speedStd': f(hist['speed_std']), 'stayAvg': f(hist['stay_avg']) / 60.0, 'stayStd': f(hist['stay_std']) / 60.0,
                     'inflowAvg': f(hist['inflow_avg']), 'inflowStd': f(hist['inflow_std']), 'outflowAvg': f(hist['outflow_avg']), 'outflowStd': f(hist['outflow_std'])} if hist and hist['n'] else {}),
    }
    candidates = []
    for r in cand:
        name = r['poi_name'] if r['poi_name'] and f(r['poi_dist'], 1e9) < 220 else None
        candidates.append({'meshId': r['mesh_id'], 'name': name or r['mesh_id'], 'lon': f(r['lon']), 'lat': f(r['lat']),
                           'features': {'people': int(r['people_count']), 'density': round(min(1.5, f(r['density']) / DENS_REF), 4), 'speed': round(f(r['avg_speed'], 1.0), 3), 'stay': round(f(r['avg_stay_sec']) / 60.0, 1), 'inflow': int(r['inflow'] or 0), 'outflow': int(r['outflow'] or 0)},
                           'hist': {'peopleAvg': f(r['people_avg']), 'peopleStd': f(r['people_std']), 'densityAvg': f(r['density_avg']) / DENS_REF, 'speedAvg': f(r['speed_avg'], 1.0), 'stayAvg': f(r['stay_avg']) / 60.0,
                                    'inflowAvg': f(r['inflow_avg']), 'inflowStd': f(r['inflow_std']), 'outflowAvg': f(r['outflow_avg']), 'outflowStd': f(r['outflow_std'])}})
    return {'state': state_part, 'candidates': candidates}
