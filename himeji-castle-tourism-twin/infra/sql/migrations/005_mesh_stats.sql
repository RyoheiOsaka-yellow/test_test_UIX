-- 005_mesh_stats.sql — 時間別メッシュ統計（集計関数 + Materialized View 5分 / 15分 / 1時間）
-- people_count: バケット内にセルで観測されたユニーク人数、inflow/outflow: セル境界の出入り、density: 人/ha、congestion_index: 0..1
\set ON_ERROR_STOP on
SET client_min_messages TO WARNING;

-- 混雑指数の基準密度（人/ha）。姫路城前広場のピーク（約 0.5 人/m² = 5,000 人/ha）を 1.0 とすると細かすぎるため、
-- 「快適に歩ける上限」に近い 200 人/ha（0.02 人/m²）で 1.0 とする
CREATE OR REPLACE FUNCTION mobility.congestion_ref_density() RETURNS real LANGUAGE sql IMMUTABLE AS $$ SELECT 200.0::real $$;

-- 任意の解像度・バケット・期間で mesh_stats を（再）計算してテーブルに upsert
CREATE OR REPLACE FUNCTION mobility.compute_mesh_stats(res integer, bucket_min integer, t_from timestamptz, t_to timestamptz, src mobility.source_kind DEFAULT 'gps')
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  WITH pts AS (
    SELECT person_hash, mobility.time_bucket("timestamp", bucket_min) AS tb, mobility.mesh_id_for(geom, res) AS mesh_id, speed, "timestamp" AS ts
    FROM mobility.raw_points
    WHERE source_type = src AND "timestamp" >= t_from AND "timestamp" < t_to
  ), moves AS (   -- セル遷移（前の点と違うセルへ移った点）
    SELECT person_hash, mesh_id, tb, lag(mesh_id) OVER (PARTITION BY person_hash ORDER BY ts) AS prev_mesh FROM pts
  ), ins AS (
    SELECT mesh_id, tb, count(*) AS inflow FROM moves WHERE prev_mesh IS NOT NULL AND prev_mesh <> mesh_id GROUP BY mesh_id, tb
  ), outs AS (
    SELECT prev_mesh AS mesh_id, tb, count(*) AS outflow FROM moves WHERE prev_mesh IS NOT NULL AND prev_mesh <> mesh_id GROUP BY prev_mesh, tb
  ), base AS (
    SELECT mesh_id, tb, count(DISTINCT person_hash) AS people, avg(speed) AS avg_speed FROM pts GROUP BY mesh_id, tb
  ), stay AS (
    SELECT mobility.mesh_id_for(geom, res) AS mesh_id, mobility.time_bucket(start_time, bucket_min) AS tb, avg(duration_sec) AS avg_stay
    FROM mobility.stays WHERE source_type = src AND start_time >= t_from AND start_time < t_to GROUP BY 1, 2
  )
  INSERT INTO mobility.mesh_stats (mesh_id, time_bucket, bucket_minutes, people_count, inflow, outflow, avg_stay_sec, avg_speed, density, congestion_index, source_type)
  SELECT b.mesh_id, b.tb, bucket_min, b.people,
         COALESCE(i.inflow, 0), COALESCE(o.outflow, 0),
         st.avg_stay, b.avg_speed,
         b.people / (m.area_m2 / 10000.0),
         LEAST(1.0, (b.people / (m.area_m2 / 10000.0)) / mobility.congestion_ref_density()),
         src
  FROM base b JOIN mobility.meshes m ON m.mesh_id = b.mesh_id
  LEFT JOIN ins i ON i.mesh_id = b.mesh_id AND i.tb = b.tb
  LEFT JOIN outs o ON o.mesh_id = b.mesh_id AND o.tb = b.tb
  LEFT JOIN stay st ON st.mesh_id = b.mesh_id AND st.tb = b.tb
  ON CONFLICT (mesh_id, time_bucket, bucket_minutes, source_type) DO UPDATE SET
    people_count = EXCLUDED.people_count, inflow = EXCLUDED.inflow, outflow = EXCLUDED.outflow, avg_stay_sec = EXCLUDED.avg_stay_sec,
    avg_speed = EXCLUDED.avg_speed, density = EXCLUDED.density, congestion_index = EXCLUDED.congestion_index;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- 全解像度（50/100/250）× 全バケット（1/5/15/30/60）を一括計算
CREATE OR REPLACE FUNCTION mobility.compute_all_mesh_stats(t_from timestamptz, t_to timestamptz, src mobility.source_kind DEFAULT 'gps')
RETURNS TABLE (res integer, bucket_min integer, rows_written integer) LANGUAGE plpgsql AS $$
DECLARE r int; b int;
BEGIN
  FOREACH r IN ARRAY ARRAY[50, 100, 250] LOOP
    FOREACH b IN ARRAY ARRAY[1, 5, 15, 30, 60] LOOP
      res := r; bucket_min := b; rows_written := mobility.compute_mesh_stats(r, b, t_from, t_to, src); RETURN NEXT;
    END LOOP;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Materialized View（100m メッシュの 5分 / 15分 / 1時間。API と GridLayer が主に読む）
-- ---------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mobility.mesh_stats_5min AS
  SELECT s.mesh_id, s.time_bucket, s.people_count, s.inflow, s.outflow, s.avg_stay_sec, s.avg_speed, s.density, s.congestion_index, s.source_type, m.centroid, m.geom
  FROM mobility.mesh_stats s JOIN mobility.meshes m USING (mesh_id) WHERE s.bucket_minutes = 5 AND m.mesh_type = 'square100'
WITH NO DATA;
CREATE UNIQUE INDEX IF NOT EXISTS mesh_stats_5min_uq ON mobility.mesh_stats_5min (mesh_id, time_bucket, source_type);
CREATE INDEX IF NOT EXISTS mesh_stats_5min_time ON mobility.mesh_stats_5min (time_bucket);
CREATE INDEX IF NOT EXISTS mesh_stats_5min_gist ON mobility.mesh_stats_5min USING GIST (geom);

CREATE MATERIALIZED VIEW IF NOT EXISTS mobility.mesh_stats_15min AS
  SELECT s.mesh_id, s.time_bucket, s.people_count, s.inflow, s.outflow, s.avg_stay_sec, s.avg_speed, s.density, s.congestion_index, s.source_type, m.centroid, m.geom
  FROM mobility.mesh_stats s JOIN mobility.meshes m USING (mesh_id) WHERE s.bucket_minutes = 15 AND m.mesh_type = 'square100'
WITH NO DATA;
CREATE UNIQUE INDEX IF NOT EXISTS mesh_stats_15min_uq ON mobility.mesh_stats_15min (mesh_id, time_bucket, source_type);
CREATE INDEX IF NOT EXISTS mesh_stats_15min_time ON mobility.mesh_stats_15min (time_bucket);

CREATE MATERIALIZED VIEW IF NOT EXISTS mobility.mesh_stats_hourly AS
  SELECT s.mesh_id, s.time_bucket, s.people_count, s.inflow, s.outflow, s.avg_stay_sec, s.avg_speed, s.density, s.congestion_index, s.source_type, m.centroid, m.geom
  FROM mobility.mesh_stats s JOIN mobility.meshes m USING (mesh_id) WHERE s.bucket_minutes = 60 AND m.mesh_type = 'square100'
WITH NO DATA;
CREATE UNIQUE INDEX IF NOT EXISTS mesh_stats_hourly_uq ON mobility.mesh_stats_hourly (mesh_id, time_bucket, source_type);
CREATE INDEX IF NOT EXISTS mesh_stats_hourly_time ON mobility.mesh_stats_hourly (time_bucket);

CREATE OR REPLACE FUNCTION mobility.refresh_mesh_stats_views() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- 初回（WITH NO DATA）は CONCURRENTLY 不可なので通常 REFRESH、以後は CONCURRENTLY
  IF (SELECT ispopulated FROM pg_matviews WHERE schemaname = 'mobility' AND matviewname = 'mesh_stats_5min') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mobility.mesh_stats_5min;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mobility.mesh_stats_15min;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mobility.mesh_stats_hourly;
  ELSE
    REFRESH MATERIALIZED VIEW mobility.mesh_stats_5min;
    REFRESH MATERIALIZED VIEW mobility.mesh_stats_15min;
    REFRESH MATERIALIZED VIEW mobility.mesh_stats_hourly;
  END IF;
END $$;

-- 指定時刻・解像度・バケットのメッシュ統計（無ければ都度集計）。API の /api/mesh が使う
CREATE OR REPLACE FUNCTION mobility.mesh_stats_at(res integer, bucket_min integer, t timestamptz, src mobility.source_kind DEFAULT 'gps', bbox geometry DEFAULT NULL)
RETURNS TABLE (mesh_id text, time_bucket timestamptz, people_count integer, inflow integer, outflow integer, avg_stay_sec real, avg_speed real, density real, congestion_index real, centroid geometry, geom geometry)
LANGUAGE plpgsql STABLE AS $$
DECLARE tb timestamptz := mobility.time_bucket(t, bucket_min);
BEGIN
  RETURN QUERY
  SELECT s.mesh_id, s.time_bucket, s.people_count, s.inflow, s.outflow, s.avg_stay_sec, s.avg_speed, s.density, s.congestion_index, m.centroid, m.geom
  FROM mobility.mesh_stats s JOIN mobility.meshes m USING (mesh_id)
  WHERE s.bucket_minutes = bucket_min AND s.time_bucket = tb AND s.source_type = src AND m.mesh_type = 'square' || res
    AND (bbox IS NULL OR m.geom && bbox);
END $$;

INSERT INTO mobility.schema_migrations (version) VALUES ('005_mesh_stats') ON CONFLICT DO NOTHING;
