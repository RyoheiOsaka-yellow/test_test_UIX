-- 001_mobility_schema.sql — 人流専用スキーマ mobility（3DCityDB の citydb スキーマと同一 DB 内で分離）
-- 適用: psql -v ON_ERROR_STOP=1 -f 001_mobility_schema.sql
-- 座標系: すべて EPSG:4326（仕様）。m 単位の計算は mobility.to_metric()（EPSG:6673 JGD2011 平面直角V系）で行う。
\set ON_ERROR_STOP on
SET client_min_messages TO WARNING;

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS mobility;

CREATE TABLE IF NOT EXISTS mobility.schema_migrations (
  version     text PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- ソース種別: 実データ（gps / beacon / sensor / wifi / camera）と synthetic を必ず区別する
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE mobility.source_kind AS ENUM ('gps', 'beacon', 'sensor', 'wifi', 'camera', 'ticket', 'synthetic');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- raw_points: GPS 等の生データ
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mobility.raw_points (
  id            bigserial PRIMARY KEY,
  source_id     text        NOT NULL,                 -- 例: 'synthetic-v1', 'carrier-A-2026-10'
  person_hash   text        NOT NULL,                 -- 端末/個人の匿名ハッシュ（生 ID は保持しない）
  "timestamp"   timestamptz NOT NULL,
  longitude     double precision NOT NULL,
  latitude      double precision NOT NULL,
  geom          geometry(Point, 4326) NOT NULL,
  accuracy      real,                                 -- m
  speed         real,                                 -- m/s
  heading       real,                                 -- deg
  source_type   mobility.source_kind NOT NULL DEFAULT 'gps',
  CONSTRAINT raw_points_lon_chk CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT raw_points_lat_chk CHECK (latitude BETWEEN -90 AND 90)
);
CREATE INDEX IF NOT EXISTS raw_points_geom_gist ON mobility.raw_points USING GIST (geom);
CREATE INDEX IF NOT EXISTS raw_points_ts_idx    ON mobility.raw_points ("timestamp");
CREATE INDEX IF NOT EXISTS raw_points_person_idx ON mobility.raw_points (person_hash, "timestamp");
CREATE INDEX IF NOT EXISTS raw_points_source_idx ON mobility.raw_points (source_type, source_id);

-- ---------------------------------------------------------------------------
-- trajectories: 移動軌跡（1 人 × 1 トリップ）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mobility.trajectories (
  id            bigserial PRIMARY KEY,
  person_hash   text        NOT NULL,
  start_time    timestamptz NOT NULL,
  end_time      timestamptz NOT NULL,
  geom          geometry(LineString, 4326) NOT NULL,
  geom_m        geometry(LineStringM, 4326),          -- M = epoch 秒（TripsLayer の timestamps 用）
  distance_m    real,
  duration_sec  integer,
  avg_speed     real,                                 -- m/s
  source_type   mobility.source_kind NOT NULL DEFAULT 'gps',
  source_id     text,
  CONSTRAINT trajectories_time_chk CHECK (end_time >= start_time)
);
CREATE INDEX IF NOT EXISTS trajectories_geom_gist ON mobility.trajectories USING GIST (geom);
CREATE INDEX IF NOT EXISTS trajectories_time_idx  ON mobility.trajectories (start_time, end_time);
CREATE INDEX IF NOT EXISTS trajectories_person_idx ON mobility.trajectories (person_hash);

-- ---------------------------------------------------------------------------
-- stays: 滞在ポイント
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mobility.stays (
  id            bigserial PRIMARY KEY,
  person_hash   text        NOT NULL,
  start_time    timestamptz NOT NULL,
  end_time      timestamptz NOT NULL,
  duration_sec  integer     GENERATED ALWAYS AS (GREATEST(0, EXTRACT(EPOCH FROM (end_time - start_time))::integer)) STORED,
  geom          geometry(Point, 4326) NOT NULL,
  mesh_id       text,                                 -- 100m 正方メッシュ ID（mobility.meshes.mesh_id）
  poi_id        text,                                 -- 例: 'castle', 'jr_himeji', 'kokoen'
  source_type   mobility.source_kind NOT NULL DEFAULT 'gps',
  source_id     text
);
CREATE INDEX IF NOT EXISTS stays_geom_gist   ON mobility.stays USING GIST (geom);
CREATE INDEX IF NOT EXISTS stays_time_idx    ON mobility.stays (start_time, end_time);
CREATE INDEX IF NOT EXISTS stays_person_idx  ON mobility.stays (person_hash);
CREATE INDEX IF NOT EXISTS stays_mesh_idx    ON mobility.stays (mesh_id);

-- ---------------------------------------------------------------------------
-- meshes: 集計メッシュ（square50 / square100 / square250 / h3 / jis）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mobility.meshes (
  mesh_id     text PRIMARY KEY,                       -- 例: 'sq100:12:-7', 'h3:8a2f...', 'jis:52342505'
  mesh_type   text NOT NULL,                          -- square50 | square100 | square250 | h3 | jis
  resolution  integer NOT NULL,                       -- m（h3 は概算の外接半径 m）
  geom        geometry(Polygon, 4326) NOT NULL,
  centroid    geometry(Point, 4326) NOT NULL,
  area_m2     double precision NOT NULL
);
CREATE INDEX IF NOT EXISTS meshes_geom_gist ON mobility.meshes USING GIST (geom);
CREATE INDEX IF NOT EXISTS meshes_type_idx  ON mobility.meshes (mesh_type);

-- ---------------------------------------------------------------------------
-- mesh_stats: 時間別メッシュ統計（bucket_minutes ごとに別行）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mobility.mesh_stats (
  mesh_id           text NOT NULL REFERENCES mobility.meshes(mesh_id) ON DELETE CASCADE,
  time_bucket       timestamptz NOT NULL,             -- バケット開始時刻
  bucket_minutes    smallint NOT NULL DEFAULT 5,      -- 1 / 5 / 15 / 30 / 60
  people_count      integer NOT NULL DEFAULT 0,       -- バケット内にセルで観測されたユニーク人数
  inflow            integer NOT NULL DEFAULT 0,
  outflow           integer NOT NULL DEFAULT 0,
  avg_stay_sec      real,
  avg_speed         real,                             -- m/s
  density           real,                             -- 人 / ha
  congestion_index  real,                             -- 0..1（density を基準密度で正規化）
  source_type       mobility.source_kind NOT NULL DEFAULT 'gps',
  PRIMARY KEY (mesh_id, time_bucket, bucket_minutes, source_type)
);
CREATE INDEX IF NOT EXISTS mesh_stats_time_idx ON mobility.mesh_stats (time_bucket, bucket_minutes);

-- ---------------------------------------------------------------------------
-- od: Origin / Destination
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mobility.od (
  origin_id       text NOT NULL,                      -- mesh_id または poi_id
  destination_id  text NOT NULL,
  time_bucket     timestamptz NOT NULL,
  bucket_minutes  smallint NOT NULL DEFAULT 60,
  people_count    integer NOT NULL DEFAULT 0,
  avg_duration    real,                               -- sec
  avg_distance    real,                               -- m
  source_type     mobility.source_kind NOT NULL DEFAULT 'gps',
  PRIMARY KEY (origin_id, destination_id, time_bucket, bucket_minutes, source_type)
);
CREATE INDEX IF NOT EXISTS od_time_idx ON mobility.od (time_bucket);

-- ---------------------------------------------------------------------------
-- pois: ランドマーク（人流集計の基準点）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mobility.pois (
  poi_id   text PRIMARY KEY,
  name     text NOT NULL,
  category text,
  geom     geometry(Point, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS pois_geom_gist ON mobility.pois USING GIST (geom);
INSERT INTO mobility.pois (poi_id, name, category, geom) VALUES
  ('castle',      '姫路城 大天守',      'landmark', ST_SetSRID(ST_MakePoint(134.69386, 34.83950), 4326)),
  ('otemon',      '大手門',            'gate',     ST_SetSRID(ST_MakePoint(134.69310, 34.83607), 4326)),
  ('jr_himeji',   'JR姫路駅',          'station',  ST_SetSRID(ST_MakePoint(134.69080, 34.82641), 4326)),
  ('sanyo_himeji','山陽姫路駅',        'station',  ST_SetSRID(ST_MakePoint(134.68938, 34.82885), 4326)),
  ('kokoen',      '好古園',            'spot',     ST_SetSRID(ST_MakePoint(134.68887, 34.83700), 4326)),
  ('miyuki',      'みゆき通り商店街',  'commercial', ST_SetSRID(ST_MakePoint(134.69232, 34.83115), 4326)),
  ('art_museum',  '姫路市立美術館',    'spot',     ST_SetSRID(ST_MakePoint(134.69760, 34.83920), 4326))
ON CONFLICT (poi_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- synthetic を明示するビュー（source_type = 'synthetic' に限定）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW mobility.synthetic_raw_points   AS SELECT * FROM mobility.raw_points   WHERE source_type = 'synthetic';
CREATE OR REPLACE VIEW mobility.synthetic_trajectories AS SELECT * FROM mobility.trajectories WHERE source_type = 'synthetic';
CREATE OR REPLACE VIEW mobility.synthetic_stays        AS SELECT * FROM mobility.stays        WHERE source_type = 'synthetic';
COMMENT ON VIEW mobility.synthetic_raw_points IS 'SYNTHETIC: 合成データのみ。実人流ではない';

-- ---------------------------------------------------------------------------
-- 便利関数: m 単位への変換（EPSG:6673 JGD2011 / 平面直角座標 V 系 = 兵庫県）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mobility.to_metric(g geometry) RETURNS geometry
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT ST_Transform(g, 6673) $$;

CREATE OR REPLACE FUNCTION mobility.from_metric(g geometry) RETURNS geometry
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT ST_Transform(ST_SetSRID(g, 6673), 4326) $$;

-- 時間バケット（1 / 5 / 15 / 30 / 60 分）
CREATE OR REPLACE FUNCTION mobility.time_bucket(ts timestamptz, minutes integer) RETURNS timestamptz
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT to_timestamp(floor(EXTRACT(EPOCH FROM ts) / (minutes * 60)) * (minutes * 60))
$$;

-- raw_points の geom を lon/lat から自動生成（geom 未指定の INSERT 用）
CREATE OR REPLACE FUNCTION mobility.raw_points_fill_geom() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.geom IS NULL THEN NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS raw_points_fill_geom ON mobility.raw_points;
CREATE TRIGGER raw_points_fill_geom BEFORE INSERT ON mobility.raw_points
  FOR EACH ROW EXECUTE FUNCTION mobility.raw_points_fill_geom();

INSERT INTO mobility.schema_migrations (version) VALUES ('001_mobility_schema') ON CONFLICT DO NOTHING;
