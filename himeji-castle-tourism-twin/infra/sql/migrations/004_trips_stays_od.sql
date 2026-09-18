-- 004_trips_stays_od.sql — 生 GPS 点から 軌跡（trajectories）・滞在（stays）・OD を作る関数
-- 使い方（synthetic 投入後）:
--   SELECT mobility.build_trajectories('synthetic');   -- 30 分以上の間隔で別トリップ
--   SELECT mobility.detect_stays('synthetic');          -- 半径 40m に 5 分以上 → 滞在
--   SELECT mobility.build_od(60, 'synthetic');          -- 滞在→滞在 の遷移を 1 時間バケットで集計
\set ON_ERROR_STOP on
SET client_min_messages TO WARNING;

-- ---------------------------------------------------------------------------
-- 軌跡: person_hash ごとに時系列で結び、gap_min 以上の空白でトリップを分割
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mobility.build_trajectories(src mobility.source_kind DEFAULT 'gps', gap_min integer DEFAULT 30, min_points integer DEFAULT 3)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  DELETE FROM mobility.trajectories WHERE source_type = src;
  WITH pts AS (
    SELECT person_hash, "timestamp" AS ts, geom, source_id,
           CASE WHEN "timestamp" - lag("timestamp") OVER (PARTITION BY person_hash ORDER BY "timestamp") > make_interval(mins => gap_min) THEN 1 ELSE 0 END AS brk
    FROM mobility.raw_points WHERE source_type = src
  ), seg AS (
    SELECT *, sum(brk) OVER (PARTITION BY person_hash ORDER BY ts ROWS UNBOUNDED PRECEDING) AS trip_no FROM pts
  ), agg AS (
    SELECT person_hash, trip_no, min(ts) AS start_time, max(ts) AS end_time, min(source_id) AS source_id,
           ST_MakeLine(geom ORDER BY ts) AS geom,
           ST_MakeLine(ST_MakePointM(ST_X(geom), ST_Y(geom), EXTRACT(EPOCH FROM ts)) ORDER BY ts) AS geom_m,
           count(*) AS np
    FROM seg GROUP BY person_hash, trip_no
  )
  INSERT INTO mobility.trajectories (person_hash, start_time, end_time, geom, geom_m, distance_m, duration_sec, avg_speed, source_type, source_id)
  SELECT person_hash, start_time, end_time, ST_SetSRID(geom, 4326), ST_SetSRID(geom_m, 4326),
         ST_Length(ST_Transform(ST_SetSRID(geom, 4326), 6673)),
         EXTRACT(EPOCH FROM (end_time - start_time))::int,
         CASE WHEN end_time > start_time THEN ST_Length(ST_Transform(ST_SetSRID(geom, 4326), 6673)) / EXTRACT(EPOCH FROM (end_time - start_time)) ELSE 0 END,
         src, source_id
  FROM agg WHERE np >= min_points AND ST_NPoints(geom) >= 2;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- ---------------------------------------------------------------------------
-- 滞在検出: 連続する点が anchor から radius_m 以内に min_sec 以上とどまる区間
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mobility.detect_stays(src mobility.source_kind DEFAULT 'gps', radius_m double precision DEFAULT 40, min_sec integer DEFAULT 300)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  r record; cur_person text := NULL; anchor geometry; a_start timestamptz; a_last timestamptz; n int := 0; src_id text;
  cnt int := 0; sx double precision := 0; sy double precision := 0;
BEGIN
  DELETE FROM mobility.stays WHERE source_type = src;
  FOR r IN SELECT person_hash, "timestamp" AS ts, ST_Transform(geom, 6673) AS gm, source_id FROM mobility.raw_points WHERE source_type = src ORDER BY person_hash, "timestamp" LOOP
    IF cur_person IS DISTINCT FROM r.person_hash THEN
      -- 前の人の未確定滞在を確定
      IF cur_person IS NOT NULL AND a_last - a_start >= make_interval(secs => min_sec) THEN
        INSERT INTO mobility.stays (person_hash, start_time, end_time, geom, source_type, source_id)
        VALUES (cur_person, a_start, a_last, ST_Transform(ST_SetSRID(ST_MakePoint(sx / cnt, sy / cnt), 6673), 4326), src, src_id); n := n + 1;
      END IF;
      cur_person := r.person_hash; anchor := r.gm; a_start := r.ts; a_last := r.ts; cnt := 1; sx := ST_X(r.gm); sy := ST_Y(r.gm); src_id := r.source_id;
      CONTINUE;
    END IF;
    IF ST_DWithin(anchor, r.gm, radius_m) THEN
      a_last := r.ts; cnt := cnt + 1; sx := sx + ST_X(r.gm); sy := sy + ST_Y(r.gm);
    ELSE
      IF a_last - a_start >= make_interval(secs => min_sec) THEN
        INSERT INTO mobility.stays (person_hash, start_time, end_time, geom, source_type, source_id)
        VALUES (cur_person, a_start, a_last, ST_Transform(ST_SetSRID(ST_MakePoint(sx / cnt, sy / cnt), 6673), 4326), src, src_id); n := n + 1;
      END IF;
      anchor := r.gm; a_start := r.ts; a_last := r.ts; cnt := 1; sx := ST_X(r.gm); sy := ST_Y(r.gm);
    END IF;
  END LOOP;
  IF cur_person IS NOT NULL AND a_last - a_start >= make_interval(secs => min_sec) THEN
    INSERT INTO mobility.stays (person_hash, start_time, end_time, geom, source_type, source_id)
    VALUES (cur_person, a_start, a_last, ST_Transform(ST_SetSRID(ST_MakePoint(sx / cnt, sy / cnt), 6673), 4326), src, src_id); n := n + 1;
  END IF;
  -- メッシュ（100m）と最寄り POI（150m 以内）を付与
  UPDATE mobility.stays s SET mesh_id = mobility.mesh_id_for(s.geom, 100) WHERE s.source_type = src;
  UPDATE mobility.stays s SET poi_id = (SELECT p.poi_id FROM mobility.pois p WHERE ST_DWithin(p.geom::geography, s.geom::geography, 150) ORDER BY p.geom <-> s.geom LIMIT 1)
  WHERE s.source_type = src;
  RETURN n;
END $$;

-- ---------------------------------------------------------------------------
-- OD: 同一人物の連続する滞在（poi_id があれば POI、無ければ 100m メッシュ）を遷移として集計
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mobility.build_od(bucket_min integer DEFAULT 60, src mobility.source_kind DEFAULT 'gps')
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  DELETE FROM mobility.od WHERE source_type = src AND bucket_minutes = bucket_min;
  WITH s AS (
    SELECT person_hash, start_time, end_time, geom, COALESCE(poi_id, mesh_id) AS node,
           lead(COALESCE(poi_id, mesh_id)) OVER w AS next_node, lead(start_time) OVER w AS next_start, lead(geom) OVER w AS next_geom
    FROM mobility.stays WHERE source_type = src
    WINDOW w AS (PARTITION BY person_hash ORDER BY start_time)
  )
  INSERT INTO mobility.od (origin_id, destination_id, time_bucket, bucket_minutes, people_count, avg_duration, avg_distance, source_type)
  SELECT node, next_node, mobility.time_bucket(end_time, bucket_min), bucket_min, count(DISTINCT person_hash),
         avg(EXTRACT(EPOCH FROM (next_start - end_time))), avg(ST_Distance(ST_Transform(geom, 6673), ST_Transform(next_geom, 6673))), src
  FROM s WHERE next_node IS NOT NULL AND next_node <> node
  GROUP BY node, next_node, mobility.time_bucket(end_time, bucket_min);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

INSERT INTO mobility.schema_migrations (version) VALUES ('004_trips_stays_od') ON CONFLICT DO NOTHING;
