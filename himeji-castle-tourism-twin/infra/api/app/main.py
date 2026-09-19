"""Human Flow API — ブラウザと PostgreSQL/PostGIS（citydb + mobility）の間の唯一の境界
   - 応答は GeoJSON FeatureCollection を基本。メッシュは MVT（/api/tiles/mesh/{z}/{x}/{y}.mvt）も提供
   - 読み取り専用ロール（citydb_reader）で接続。書き込み API は持たない
   - 大量点はサンプリング（sample）と上限（API_MAX_POINTS）で抑える
   起動: DATABASE_URL=postgresql://citydb_reader:citydb_reader@localhost:5432/citydb uvicorn app.main:app --port 8000
"""
import json, os, math, struct
import numpy as np
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from psycopg_pool import ConnectionPool
from psycopg.rows import dict_row

DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://citydb_reader:citydb_reader@localhost:5432/citydb')
MAX_POINTS = int(os.environ.get('API_MAX_POINTS', '20000'))
DEFAULT_SRC = os.environ.get('API_DEFAULT_SOURCE', 'synthetic')
DEFAULT_BBOX = [134.648, 34.800, 134.735, 34.872]
JST = timezone(timedelta(hours=9))

pool = ConnectionPool(DATABASE_URL, min_size=1, max_size=8, kwargs={'row_factory': dict_row, 'options': '-c default_transaction_read_only=on -c statement_timeout=30000'})
app = FastAPI(title='Himeji Human Flow API', version='0.1.0', description='人流（mobility）と 3DCityDB（citydb）の読み取り API。GeoJSON / MVT')
origins = os.environ.get('API_CORS_ORIGINS', '*')
app.add_middleware(CORSMiddleware, allow_origins=['*'] if origins == '*' else origins.split(','), allow_methods=['GET'], allow_headers=['*'])

def q(sql: str, params: dict | None = None):
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params or {})
            return cur.fetchall()

def parse_t(t: Optional[str]) -> datetime:
    if not t: return datetime(2026, 10, 4, 12, 0, tzinfo=JST)
    try:
        d = datetime.fromisoformat(t.replace('Z', '+00:00'))
        return d if d.tzinfo else d.replace(tzinfo=JST)
    except ValueError:
        raise HTTPException(400, f'invalid time: {t}')

def parse_bbox(bbox: Optional[str]):
    if not bbox: return None
    try:
        a = [float(v) for v in bbox.split(',')]; assert len(a) == 4; return a
    except Exception:
        raise HTTPException(400, 'bbox must be minlon,minlat,maxlon,maxlat')

def fc(features): return {'type': 'FeatureCollection', 'features': features}
def feat(geom, props): return {'type': 'Feature', 'geometry': geom, 'properties': props}
def bbox_sql(a): return 'ST_MakeEnvelope(%(minlon)s,%(minlat)s,%(maxlon)s,%(maxlat)s,4326)'
def bbox_params(a): return {'minlon': a[0], 'minlat': a[1], 'maxlon': a[2], 'maxlat': a[3]} if a else {}

# ----------------------------------------------------------------------------
@app.get('/api/health')
def health():
    r = q("SELECT version() AS pg, postgis_full_version() AS postgis, (SELECT srid FROM citydb.database_srs) AS citydb_srid, "
          "(SELECT string_agg(version, ',' ORDER BY version) FROM mobility.schema_migrations) AS migrations, "
          "(SELECT count(*) FROM mobility.synthetic_raw_points) AS synthetic_points, (SELECT count(*) FROM citydb.feature WHERE termination_date IS NULL) AS citydb_features, "
          "(SELECT count(*) FROM citydb.feature f JOIN citydb.objectclass oc ON oc.id=f.objectclass_id AND oc.classname='Building' WHERE f.termination_date IS NULL) AS citydb_buildings, "
          "(SELECT json_object_agg(source_type, json_build_array(t0, t1, n)) FROM (SELECT source_type, min(\"timestamp\") AS t0, max(\"timestamp\") AS t1, count(*) AS n FROM mobility.raw_points GROUP BY source_type) x) AS sources")[0]
    try: r['citydb_version'] = q('SELECT citydb_pkg.citydb_version() AS v')[0]['v']
    except Exception: r['citydb_version'] = None
    return r

# ----------------------------------------------------------------------------
@app.get('/api/people/current')
def people_current(t: Optional[str] = None, bbox: Optional[str] = None, window: int = Query(5, ge=1, le=120), limit: int = Query(5000, ge=1, le=MAX_POINTS), sample: float = Query(1.0, gt=0, le=1), source: str = DEFAULT_SRC):
    """時刻 t の直前 window 分の GPS 点（各人の最新点）。ScatterplotLayer 用。sample で間引き"""
    tt = parse_t(t); a = parse_bbox(bbox)
    sql = f"""
      SELECT DISTINCT ON (person_hash) person_hash, "timestamp" AS ts, ST_X(geom) AS lon, ST_Y(geom) AS lat, speed, heading, accuracy, source_type
      FROM mobility.raw_points WHERE source_type = %(src)s AND "timestamp" BETWEEN %(t0)s AND %(t)s
        {"AND geom && " + bbox_sql(a) if a else ""} {"AND hashtext(person_hash) %% 1000 < %(smp)s" if sample < 1 else ""}
      ORDER BY person_hash, "timestamp" DESC LIMIT %(lim)s"""
    rows = q(sql, {'src': source, 't0': tt - timedelta(minutes=window), 't': tt, 'lim': limit, 'smp': int(sample * 1000), **bbox_params(a)})
    return fc([feat({'type': 'Point', 'coordinates': [r['lon'], r['lat']]}, {'person_hash': r['person_hash'], 'timestamp': r['ts'].isoformat(), 'speed': r['speed'], 'heading': r['heading'], 'accuracy': r['accuracy'], 'source_type': r['source_type']}) for r in rows])

@app.get('/api/people/bbox')
def people_bbox(bbox: str, t: Optional[str] = None, window: int = Query(60, ge=5, le=1440), source: str = DEFAULT_SRC):
    """BBox 内の 現在人数・流入・流出・平均滞在（queries/people_in_bbox.sql と同じ定義）"""
    tt = parse_t(t); a = parse_bbox(bbox)
    sql = """
      WITH bbox AS (SELECT ST_MakeEnvelope(%(minlon)s,%(minlat)s,%(maxlon)s,%(maxlat)s,4326) AS g),
      pts AS (SELECT p.person_hash, p."timestamp" AS ts, ST_Within(p.geom, b.g) AS inside FROM mobility.raw_points p, bbox b
              WHERE p.source_type = %(src)s AND p."timestamp" BETWEEN %(t0)s AND %(t)s AND p.geom && ST_Expand(b.g, 0.01)),
      trans AS (SELECT person_hash, inside, lag(inside) OVER (PARTITION BY person_hash ORDER BY ts) AS prev FROM pts)
      , seen AS (SELECT person_hash, min(ts) AS first_in, max(ts) AS last_in FROM pts WHERE inside GROUP BY person_hash)
      SELECT (SELECT count(DISTINCT person_hash) FROM pts WHERE inside AND ts >= %(t5)s) AS people_now,
             -- 流入 = 境界を外→内に越えた回数 ＋ 窓内で初めて観測された人（bbox が市全体のとき「到着」）
             (SELECT count(*) FROM trans WHERE inside AND prev = false)
             + (SELECT count(*) FROM seen s WHERE NOT EXISTS (SELECT 1 FROM mobility.raw_points r, bbox b WHERE r.person_hash = s.person_hash AND r.source_type = %(src)s
                                                              AND r."timestamp" >= %(t0)s - interval '1 day' AND r."timestamp" < %(t0)s AND ST_Within(r.geom, b.g))) AS inflow,
             -- 流出 = 内→外に越えた回数 ＋ 窓内で最後に観測され以後現れない人（「出発」）
             (SELECT count(*) FROM trans WHERE NOT inside AND prev = true)
             + (SELECT count(*) FROM seen s WHERE s.last_in < %(t5)s AND NOT EXISTS (SELECT 1 FROM mobility.raw_points r, bbox b WHERE r.person_hash = s.person_hash AND r.source_type = %(src)s
                                                              AND r."timestamp" > %(t)s AND r."timestamp" < %(t)s + interval '1 day' AND ST_Within(r.geom, b.g))) AS outflow,
             (SELECT round(avg(s.duration_sec)) FROM mobility.stays s, bbox b WHERE s.source_type = %(src)s AND ST_Within(s.geom, b.g) AND s.start_time BETWEEN %(t0)s AND %(t)s) AS avg_stay_sec"""
    r = q(sql, {'src': source, 't0': tt - timedelta(minutes=window), 't5': tt - timedelta(minutes=5), 't': tt, **bbox_params(a)})[0]
    return {'bbox': a, 't': tt.isoformat(), 'window_min': window, **r}

@app.get('/api/people/near')
def people_near(poi: Optional[str] = None, lon: Optional[float] = None, lat: Optional[float] = None, t: Optional[str] = None, window: int = Query(60, ge=5, le=1440), radii: str = '100,250,500,1000', source: str = DEFAULT_SRC):
    """地点（POI id か lon/lat）から半径 100/250/500/1000m 圏内の人流"""
    tt = parse_t(t)
    if poi: center = "(SELECT geom FROM mobility.pois WHERE poi_id = %(poi)s)"
    elif lon is not None and lat is not None: center = "ST_SetSRID(ST_MakePoint(%(lon)s,%(lat)s),4326)"
    else: raise HTTPException(400, 'poi or lon/lat required')
    rs = [int(x) for x in radii.split(',')]
    sql = f"""
      WITH c AS (SELECT {center} AS geom), radii AS (SELECT unnest(%(rs)s::int[]) AS r)
      SELECT r.r AS radius_m, count(DISTINCT p.person_hash) AS people, count(p.*) AS points, round(avg(p.speed)::numeric,2) AS avg_speed_mps
      FROM radii r CROSS JOIN c LEFT JOIN mobility.raw_points p ON p.source_type = %(src)s AND p."timestamp" BETWEEN %(t0)s AND %(t)s
        AND ST_DWithin(p.geom::geography, c.geom::geography, r.r)
      GROUP BY r.r ORDER BY r.r"""
    return {'poi': poi, 't': tt.isoformat(), 'window_min': window, 'rings': q(sql, {'poi': poi, 'lon': lon, 'lat': lat, 'rs': rs, 'src': source, 't0': tt - timedelta(minutes=window), 't': tt})}

# ----------------------------------------------------------------------------
@app.get('/api/people/series')
def people_series(t: Optional[str] = None, bucket: int = Query(60, ge=5, le=120), source: str = DEFAULT_SRC):
    """t の属する日の 時間帯別 ユニーク人数（KPI: ピーク・前時間帯比 用）。raw_points の timestamp 索引で 1 日分だけ走査"""
    tt = parse_t(t); day0 = tt.astimezone(JST).replace(hour=0, minute=0, second=0, microsecond=0)   # 日境界は JST
    rows = q("""SELECT mobility.time_bucket("timestamp", %(b)s) AS tb, count(DISTINCT person_hash) AS people, avg(speed) AS avg_speed
                FROM mobility.raw_points WHERE source_type = %(src)s AND "timestamp" >= %(d0)s AND "timestamp" < %(d1)s GROUP BY 1 ORDER BY 1""",
             {'b': bucket, 'src': source, 'd0': day0, 'd1': day0 + timedelta(days=1)})
    return {'t': tt.isoformat(), 'bucket': bucket, 'series': [{'t': r['tb'].isoformat(), 'people': r['people'], 'avg_speed': r['avg_speed']} for r in rows]}

# ----------------------------------------------------------------------------
# Point Cloud 用バイナリ（STEP: Spatial Streaming / Binary Format）
#   /api/points?bbox=&timeFrom=&timeTo=&lod=0..3&maxPoints=&source=
#   応答: "HPC1" + uint32 headerLen + JSON header + 配列（little endian）
#     pos0 Float32×2 (lon,lat)  pos1 Float32×2  t0 Float32 (秒, header.tbase 起点)  t1 Float32
#     attr Uint8×4 (density, stay, speed, confidence)  dir Uint8 (heading/360*255)  pid Uint32 (person index)
#   1 レコード＝同一人物の連続 2 サンプル（線分）。クライアントは [t0,t1] で位置を補間し、線分に沿って粒子を分布させる。
#   密度に応じたサンプリング: 50m セル内の人数 n に対して 採用率 = min(1, cap(lod)/n)（低密度は全採用、高密度は間引き）。
#   間引いても density 属性でセルの実人数を持たせるので、表示側で密度感を維持できる。
POINTS_CAP = {0: 3, 1: 8, 2: 24, 3: 100000}          # lod ごとの 50m セル当たり採用人数
POINTS_MAX = {0: 30000, 1: 150000, 2: 500000, 3: 1000000}
def parse_iso(v: Optional[str], default: datetime) -> datetime:
    return parse_t(v) if v else default

@app.get('/api/points')
def points_binary(bbox: Optional[str] = None, timeFrom: Optional[str] = None, timeTo: Optional[str] = None, t: Optional[str] = None,
                  lod: int = Query(1, ge=0, le=3), maxPoints: Optional[int] = None, source: str = DEFAULT_SRC, format: str = 'bin'):
    tt = parse_t(t); t0 = parse_iso(timeFrom, tt - timedelta(minutes=1)); t1 = parse_iso(timeTo, tt + timedelta(minutes=4))
    if t1 <= t0: raise HTTPException(400, 'timeTo must be after timeFrom')
    if (t1 - t0) > timedelta(hours=25): raise HTTPException(400, 'time range too large (max 25h)')
    a = parse_bbox(bbox) or DEFAULT_BBOX
    maxp = min(POINTS_MAX[3], maxPoints or POINTS_MAX[lod])
    sql = f"""
      WITH w AS (SELECT %(t0)s::timestamptz AS t0, %(t1)s::timestamptz AS t1, {bbox_sql(a)} AS bb),
      pts AS (
        SELECT p.person_hash, p."timestamp" AS ts, p.geom, p.speed, p.heading, p.accuracy,
               lead(p."timestamp") OVER w2 AS ts2, lead(p.geom) OVER w2 AS geom2
        FROM mobility.raw_points p, w
        WHERE p.source_type = %(src)s AND p."timestamp" >= w.t0 - interval '5 min' AND p."timestamp" <= w.t1 + interval '5 min'
          AND p.geom && ST_Expand(w.bb, 0.002)
        WINDOW w2 AS (PARTITION BY p.person_hash ORDER BY p."timestamp")),
      seg AS (SELECT pts.*, mobility.mesh_id_for(geom, 50) AS cid FROM pts, w WHERE ts2 IS NOT NULL AND ts2 - ts <= interval '5 min' AND ts2 >= w.t0 AND ts <= w.t1 AND ST_Intersects(geom, w.bb)),
      cell AS (SELECT cid, count(DISTINCT person_hash) AS n FROM seg GROUP BY 1),
      sel AS (SELECT s.*, c.n AS dens, (hashtext(s.person_hash) & 1023) AS h
              FROM seg s JOIN cell c ON c.cid = s.cid
              WHERE (hashtext(s.person_hash) & 1023) < LEAST(1024, (1024.0 * %(cap)s / GREATEST(c.n, 1))::int))
      SELECT ST_X(geom) AS x0, ST_Y(geom) AS y0, ST_X(geom2) AS x1, ST_Y(geom2) AS y1,
             EXTRACT(EPOCH FROM ts) AS e0, EXTRACT(EPOCH FROM ts2) AS e1, dens, COALESCE(speed, 0) AS speed, COALESCE(heading, 0) AS heading, COALESCE(accuracy, 10) AS accuracy,
             dense_rank() OVER (ORDER BY person_hash) AS pid,
             COALESCE((SELECT EXTRACT(EPOCH FROM (s.ts - st.start_time)) FROM mobility.stays st WHERE st.person_hash = s.person_hash AND st.source_type = %(src)s
                       AND st.start_time <= s.ts AND st.end_time >= s.ts ORDER BY st.start_time DESC LIMIT 1), 0) AS stay_sec,
             (SELECT count(*) FROM seg) AS total_segments
      FROM sel s ORDER BY h, person_hash, ts LIMIT %(max)s"""
    rows = q(sql, {'t0': t0, 't1': t1, 'src': source, 'cap': POINTS_CAP[lod], 'max': maxp, **bbox_params(a)})
    n = len(rows); tbase = t0.timestamp()
    if format == 'json':
        return {'count': n, 'lod': lod, 'tbase': tbase, 'segments': [{'p0': [r['x0'], r['y0']], 'p1': [r['x1'], r['y1']], 't0': r['e0'] - tbase, 't1': r['e1'] - tbase, 'density': r['dens'], 'speed': r['speed'], 'stay_sec': r['stay_sec'], 'heading': r['heading'], 'pid': r['pid']} for r in rows]}
    pos0 = np.empty((n, 2), np.float32); pos1 = np.empty((n, 2), np.float32); ts0 = np.empty(n, np.float32); ts1 = np.empty(n, np.float32)
    attr = np.empty((n, 4), np.uint8); dirn = np.empty(n, np.uint8); pid = np.empty(n, np.uint32)
    if n:
        arr = np.array([(r['x0'], r['y0'], r['x1'], r['y1'], r['e0'], r['e1'], r['dens'], r['speed'], r['heading'], r['accuracy'], r['pid'], r['stay_sec']) for r in rows], np.float64)
        pos0[:] = arr[:, 0:2]; pos1[:] = arr[:, 2:4]; ts0[:] = arr[:, 4] - tbase; ts1[:] = arr[:, 5] - tbase
        attr[:, 0] = np.clip(arr[:, 6] / 40.0 * 255, 0, 255)            # density: 50m セル内 40 人で飽和
        attr[:, 1] = np.clip(arr[:, 11] / 3600.0 * 255, 0, 255)         # stay: 60 分で飽和
        attr[:, 2] = np.clip(arr[:, 7] / 3.0 * 255, 0, 255)             # speed: 3 m/s で飽和
        attr[:, 3] = np.clip((1.0 - arr[:, 9] / 30.0) * 255, 0, 255)    # confidence: accuracy 0m→255, 30m→0
        dirn[:] = np.clip(np.mod(arr[:, 8], 360.0) / 360.0 * 255, 0, 255); pid[:] = arr[:, 10]
    header = json.dumps({'count': n, 'lod': lod, 'tbase': tbase, 'timeFrom': t0.isoformat(), 'timeTo': t1.isoformat(), 'bbox': a, 'source': source,
                         'total_segments': int(rows[0]['total_segments']) if n else 0, 'cap_per_cell': POINTS_CAP[lod],
                         'fields': [['pos0', 'float32', 2], ['pos1', 'float32', 2], ['t0', 'float32', 1], ['t1', 'float32', 1], ['attr', 'uint8', 4], ['dir', 'uint8', 1], ['pid', 'uint32', 1]],
                         'scales': {'density': '255=40 persons/50m cell', 'stay': '255=3600s', 'speed': '255=3 m/s', 'confidence': '255=accuracy 0m'}}).encode()
    body = b'HPC1' + struct.pack('<I', len(header)) + header + pos0.tobytes() + pos1.tobytes() + ts0.tobytes() + ts1.tobytes() + attr.tobytes() + dirn.tobytes() + pid.tobytes()
    return Response(content=body, media_type='application/octet-stream', headers={'X-Point-Count': str(n), 'Cache-Control': 'no-store'})

@app.get('/api/mesh')
def mesh(res: int = Query(100), t: Optional[str] = None, bucket: int = Query(5), bbox: Optional[str] = None, format: str = 'geojson', source: str = DEFAULT_SRC, min_people: int = 1):
    """指定時刻のメッシュ別統計。GridLayer / HexagonLayer / ColumnLayer 用に position・weight・elevation を properties に持つ"""
    if res not in (50, 100, 250): raise HTTPException(400, 'res must be 50, 100 or 250')
    if bucket not in (1, 5, 15, 30, 60): raise HTTPException(400, 'bucket must be 1,5,15,30,60')
    tt = parse_t(t); a = parse_bbox(bbox)
    sql = f"""SELECT mesh_id, time_bucket, people_count, inflow, outflow, avg_stay_sec, avg_speed, density, congestion_index,
                     ST_X(centroid) AS cx, ST_Y(centroid) AS cy, ST_AsGeoJSON(geom)::json AS g
              FROM mobility.mesh_stats_at(%(res)s, %(bucket)s, %(t)s, %(src)s, {bbox_sql(a) if a else 'NULL'})
              WHERE people_count >= %(minp)s ORDER BY people_count DESC"""
    rows = q(sql, {'res': res, 'bucket': bucket, 't': tt, 'src': source, 'minp': min_people, **bbox_params(a)})
    props = lambda r: {'mesh_id': r['mesh_id'], 'time_bucket': r['time_bucket'].isoformat(), 'people_count': r['people_count'], 'weight': r['people_count'], 'elevation': r['people_count'],
                       'inflow': r['inflow'], 'outflow': r['outflow'], 'avg_stay_sec': r['avg_stay_sec'], 'avg_speed': r['avg_speed'], 'density': r['density'], 'congestion_index': r['congestion_index'],
                       'position': [r['cx'], r['cy']]}
    if format == 'json': return {'res': res, 'bucket': bucket, 't': tt.isoformat(), 'cells': [props(r) for r in rows]}
    return fc([feat(r['g'], props(r)) for r in rows])

@app.get('/api/mesh/{mesh_id}')
def mesh_detail(mesh_id: str, t: Optional[str] = None, bucket: int = Query(15), source: str = DEFAULT_SRC):
    """1 メッシュの詳細: 当日の時系列、ピーク、主要 Origin/Destination（OD）"""
    tt = parse_t(t); day0 = tt.astimezone(JST).replace(hour=0, minute=0, second=0, microsecond=0)   # 日境界は JST
    m = q("SELECT mesh_id, mesh_type, resolution, area_m2, ST_AsGeoJSON(geom)::json AS g, ST_X(centroid) AS cx, ST_Y(centroid) AS cy FROM mobility.meshes WHERE mesh_id = %(id)s", {'id': mesh_id})
    if not m: raise HTTPException(404, 'mesh not found')
    ts = q("SELECT time_bucket, people_count, inflow, outflow, avg_stay_sec, avg_speed, density, congestion_index FROM mobility.mesh_stats WHERE mesh_id=%(id)s AND bucket_minutes=%(b)s AND source_type=%(src)s AND time_bucket >= %(d0)s AND time_bucket < %(d1)s ORDER BY time_bucket",
           {'id': mesh_id, 'b': bucket, 'src': source, 'd0': day0, 'd1': day0 + timedelta(days=1)})
    now = [r for r in ts if r['time_bucket'] <= tt]; cur = now[-1] if now else None
    peak = max(ts, key=lambda r: r['people_count']) if ts else None
    od_o = q("SELECT origin_id AS id, sum(people_count) AS n FROM mobility.od WHERE destination_id=%(id)s AND source_type=%(src)s GROUP BY 1 ORDER BY 2 DESC LIMIT 3", {'id': mesh_id, 'src': source})
    od_d = q("SELECT destination_id AS id, sum(people_count) AS n FROM mobility.od WHERE origin_id=%(id)s AND source_type=%(src)s GROUP BY 1 ORDER BY 2 DESC LIMIT 3", {'id': mesh_id, 'src': source})
    return {'mesh': {**m[0], 'geometry': m[0].pop('g')}, 't': tt.isoformat(), 'current': cur, 'peak': peak,
            'timeseries': [{**r, 'time_bucket': r['time_bucket'].isoformat()} for r in ts], 'top_origins': od_o, 'top_destinations': od_d}

# ----------------------------------------------------------------------------
@app.get('/api/flow')
@app.get('/api/od')
def flow(t: Optional[str] = None, window: int = Query(180, ge=15, le=1440), bucket: int = Query(60), limit: int = Query(60, le=500), source: str = DEFAULT_SRC):
    """OD フロー（ArcLayer 用に source_position / target_position を付与）"""
    tt = parse_t(t)
    sql = """
      WITH od AS (SELECT origin_id, destination_id, sum(people_count) AS people, avg(avg_duration) AS avg_duration, avg(avg_distance) AS avg_distance
                  FROM mobility.od WHERE source_type=%(src)s AND bucket_minutes=%(b)s AND time_bucket BETWEEN %(t0)s AND %(t)s GROUP BY 1,2),
      node AS (SELECT poi_id AS id, name, geom FROM mobility.pois UNION ALL SELECT mesh_id, mesh_id, centroid FROM mobility.meshes)
      SELECT od.origin_id, o.name AS origin_name, od.destination_id, d.name AS destination_name, od.people, round(od.avg_duration) AS avg_duration_sec, round(od.avg_distance) AS avg_distance_m,
             ST_X(o.geom) AS ox, ST_Y(o.geom) AS oy, ST_X(d.geom) AS dx, ST_Y(d.geom) AS dy
      FROM od JOIN node o ON o.id=od.origin_id JOIN node d ON d.id=od.destination_id ORDER BY od.people DESC LIMIT %(lim)s"""
    rows = q(sql, {'src': source, 'b': bucket, 't0': tt - timedelta(minutes=window), 't': tt, 'lim': limit})
    return {'t': tt.isoformat(), 'window_min': window, 'flows': [{'origin_id': r['origin_id'], 'origin_name': r['origin_name'], 'destination_id': r['destination_id'], 'destination_name': r['destination_name'],
             'people': int(r['people']), 'avg_duration_sec': r['avg_duration_sec'], 'avg_distance_m': r['avg_distance_m'], 'source_position': [r['ox'], r['oy']], 'target_position': [r['dx'], r['dy']]} for r in rows]}

@app.get('/api/trajectory')
def trajectory(person_hash: Optional[str] = None, t: Optional[str] = None, window: int = Query(120, ge=5, le=1440), limit: int = Query(300, le=2000), source: str = DEFAULT_SRC):
    """GeoJSON LineString ＋ timestamps（epoch 秒）。TripsLayer 相当"""
    tt = parse_t(t)
    sql = """SELECT id, person_hash, start_time, end_time, distance_m, duration_sec, avg_speed, ST_AsGeoJSON(geom)::json AS g,
                    (SELECT array_agg(round(ST_M(gp.geom)::numeric)::bigint ORDER BY gp.path) FROM ST_DumpPoints(geom_m) AS gp) AS ts
             FROM mobility.trajectories WHERE source_type=%(src)s AND (%(ph)s::text IS NULL OR person_hash=%(ph)s::text) AND start_time <= %(t)s AND end_time >= %(t0)s
             ORDER BY start_time LIMIT %(lim)s"""
    rows = q(sql, {'src': source, 'ph': person_hash, 't': tt, 't0': tt - timedelta(minutes=window), 'lim': limit})
    return fc([feat(r['g'], {'id': r['id'], 'person_hash': r['person_hash'], 'start_time': r['start_time'].isoformat(), 'end_time': r['end_time'].isoformat(), 'distance_m': r['distance_m'], 'duration_sec': r['duration_sec'], 'avg_speed': r['avg_speed'], 'timestamps': r['ts']}) for r in rows])

@app.get('/api/stays')
def stays(t: Optional[str] = None, window: int = Query(120, ge=5, le=1440), bbox: Optional[str] = None, limit: int = Query(5000, le=MAX_POINTS), source: str = DEFAULT_SRC):
    """滞在点（duration_sec 付き）。HeatmapLayer の weight に使う"""
    tt = parse_t(t); a = parse_bbox(bbox)
    sql = f"""SELECT id, person_hash, start_time, end_time, duration_sec, mesh_id, poi_id, ST_X(geom) AS lon, ST_Y(geom) AS lat FROM mobility.stays
              WHERE source_type=%(src)s AND start_time <= %(t)s AND end_time >= %(t0)s {"AND geom && " + bbox_sql(a) if a else ""} ORDER BY start_time LIMIT %(lim)s"""
    rows = q(sql, {'src': source, 't': tt, 't0': tt - timedelta(minutes=window), 'lim': limit, **bbox_params(a)})
    return fc([feat({'type': 'Point', 'coordinates': [r['lon'], r['lat']]}, {'id': r['id'], 'person_hash': r['person_hash'], 'start_time': r['start_time'].isoformat(), 'end_time': r['end_time'].isoformat(), 'duration_sec': r['duration_sec'], 'weight': r['duration_sec'], 'mesh_id': r['mesh_id'], 'poi_id': r['poi_id']}) for r in rows])

# ----------------------------------------------------------------------------
# citydb の座標軸: PLATEAU の EPSG:6697 は gml:pos が「緯度 経度」順。citydb-tool に --transform=swap-xy を付けて取り込むと x=経度 になる。
# 付け忘れても動くよう、起動時に envelope を見て軸順を自動判定する（x が 20..50 なら緯度先行 → FlipCoordinates）
_AXIS = {'checked': False, 'flip': False}
def citydb_flip() -> bool:
    if not _AXIS['checked']:
        try:
            r = q("SELECT ST_XMin(envelope) AS x, ST_YMin(envelope) AS y FROM citydb.feature WHERE envelope IS NOT NULL AND termination_date IS NULL LIMIT 1")
            _AXIS['flip'] = bool(r) and 20 < r[0]['x'] < 50 and 120 < r[0]['y'] < 155
        except Exception:
            _AXIS['flip'] = False
        _AXIS['checked'] = True
    return _AXIS['flip']
def g4326(expr: str) -> str:
    """citydb ジオメトリ（SRID 6697）→ 4326 の 2D/3D GeoJSON 用式"""
    return f"ST_Transform({'ST_FlipCoordinates(' + expr + ')' if citydb_flip() else expr}, 4326)"
def bbox6697(a) -> str:
    e = f"ST_Transform({bbox_sql(a)}, (SELECT srid FROM citydb.database_srs))"
    return f"ST_FlipCoordinates({e})" if citydb_flip() else e

@app.get('/api/buildings')
def buildings(bbox: Optional[str] = None, lod: int = Query(1, ge=1, le=2), limit: int = Query(5000, le=50000)):
    """3DCityDB v5（citydb スキーマ）の建物。
       lod=1: フットプリント（lod1Solid の底面）＋高さ（bldg:height の value、無ければ Solid の Z 幅）→ GeoJSON Polygon。
       lod=2: 境界面（RoofSurface / WallSurface / GroundSurface の lod2MultiSurface）を面ごとに MultiPolygon Z で返す。
       座標は 4326（経度, 緯度[, 高さ]）。Three.js 側で押し出し / 面の三角形化を行う"""
    a = parse_bbox(bbox)
    where = f"AND f.envelope && {bbox6697(a)}" if a else ""
    if lod == 1:
        sql = f"""WITH b AS (
                    SELECT f.id, f.objectid, f.envelope,
                           (SELECT c.val_double FROM citydb.property h JOIN citydb.property c ON c.parent_id = h.id AND c.name = 'value'
                             WHERE h.feature_id = f.id AND h.name = 'height' LIMIT 1) AS h_attr,
                           (SELECT g.geometry FROM citydb.property p JOIN citydb.geometry_data g ON g.id = p.val_geometry_id
                             WHERE p.feature_id = f.id AND p.name = 'lod1Solid' LIMIT 1) AS solid,
                           (SELECT p.val_int FROM citydb.property p WHERE p.feature_id = f.id AND p.name = 'storeysAboveGround' LIMIT 1) AS storeys,
                           (SELECT p.val_string FROM citydb.property p WHERE p.feature_id = f.id AND p.name = 'usage' LIMIT 1) AS usage
                    FROM citydb.feature f JOIN citydb.objectclass oc ON oc.id = f.objectclass_id AND oc.classname = 'Building'
                    WHERE f.termination_date IS NULL AND f.envelope IS NOT NULL {where} LIMIT %(lim)s)
                  SELECT id, objectid, h_attr, storeys, usage, ST_ZMin(envelope) AS z0, ST_ZMax(envelope) - ST_ZMin(envelope) AS h_geom,
                         ST_AsGeoJSON({g4326("ST_Force2D(COALESCE((SELECT d.geom FROM ST_Dump(solid) d ORDER BY ST_ZMax(d.geom) LIMIT 1), ST_Envelope(envelope)))")})::json AS g
                  FROM b"""
        rows = q(sql, {'lim': limit, **bbox_params(a)})
        return fc([feat(r['g'], {'id': r['id'], 'objectid': r['objectid'], 'height': r['h_attr'] if r['h_attr'] is not None else r['h_geom'],
                                 'ground_z': r['z0'], 'storeys': r['storeys'] if r['storeys'] != 9999 else None, 'usage': r['usage'], 'lod': 1}) for r in rows])
    sql = f"""SELECT f.id, f.objectid, ST_ZMin(f.envelope) AS z0,
                     json_agg(json_build_object('k', soc.classname, 'g', ST_AsGeoJSON({g4326("g.geometry")}, 9)::json)) AS faces
              FROM citydb.feature f JOIN citydb.objectclass oc ON oc.id = f.objectclass_id AND oc.classname = 'Building'
              JOIN citydb.property b ON b.feature_id = f.id AND b.name = 'boundary' AND b.val_feature_id IS NOT NULL
              JOIN citydb.feature s ON s.id = b.val_feature_id JOIN citydb.objectclass soc ON soc.id = s.objectclass_id
              JOIN citydb.property m ON m.feature_id = s.id AND m.name = 'lod2MultiSurface' JOIN citydb.geometry_data g ON g.id = m.val_geometry_id
              WHERE f.termination_date IS NULL {where}
              GROUP BY f.id, f.objectid, f.envelope LIMIT %(lim)s"""
    rows = q(sql, {'lim': limit, **bbox_params(a)})
    return {'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'geometry': None, 'properties': {'id': r['id'], 'objectid': r['objectid'], 'ground_z': r['z0'], 'lod': 2, 'faces': r['faces']}} for r in rows]}

@app.get('/api/tiles/mesh/{z}/{x}/{y}.mvt')
def mesh_tile(z: int, x: int, y: int, res: int = 100, t: Optional[str] = None, bucket: int = 5, source: str = DEFAULT_SRC):
    """メッシュ統計の Mapbox Vector Tile（大量セル向け）。ST_AsMVT / ST_AsMVTGeom"""
    tt = parse_t(t)
    sql = """WITH b AS (SELECT ST_TileEnvelope(%(z)s,%(x)s,%(y)s) AS g),
             s AS (SELECT * FROM mobility.mesh_stats_at(%(res)s, %(bucket)s, %(t)s, %(src)s, ST_Transform((SELECT g FROM b), 4326)))
             SELECT ST_AsMVT(q, 'mesh', 4096, 'geom') AS mvt FROM (
               SELECT s.mesh_id, s.people_count, s.inflow, s.outflow, s.avg_stay_sec, s.density, s.congestion_index,
                      ST_AsMVTGeom(ST_Transform(s.geom, 3857), (SELECT g FROM b), 4096, 64, true) AS geom FROM s) q"""
    r = q(sql, {'z': z, 'x': x, 'y': y, 'res': res, 'bucket': bucket, 't': tt, 'src': source})
    return Response(content=bytes(r[0]['mvt']) if r and r[0]['mvt'] else b'', media_type='application/vnd.mapbox-vector-tile')

# 同一オリジンで Digital Twin（index.html）を配信（任意）。
# Docker では compose が ../../index.html を /app/static に読み取り専用でマウント。ローカルは API_STATIC_DIR=../.. などで指定
STATIC_DIR = os.environ.get('API_STATIC_DIR', '/app/static')
if os.path.isdir(STATIC_DIR):
    app.mount('/', StaticFiles(directory=STATIC_DIR, html=True, follow_symlink=True), name='static')
