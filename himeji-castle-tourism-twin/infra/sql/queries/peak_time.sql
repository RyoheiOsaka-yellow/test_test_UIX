-- peak_time.sql — 全体および POI 別のピーク時刻（人数最大のバケット）
-- params: :from :to :bucket_min :src
WITH whole AS (
  SELECT time_bucket, sum(people_count) AS people FROM mobility.mesh_stats
  WHERE source_type = :'src' AND bucket_minutes = :bucket_min AND time_bucket BETWEEN :'from'::timestamptz AND :'to'::timestamptz
    AND mesh_id LIKE 'sq100:%'
  GROUP BY time_bucket
),
poi AS (
  SELECT p.name, mobility.time_bucket(r."timestamp", :bucket_min) AS tb, count(DISTINCT r.person_hash) AS people
  FROM mobility.pois p JOIN mobility.raw_points r ON r.source_type = :'src' AND ST_DWithin(r.geom::geography, p.geom::geography, 150)
    AND r."timestamp" BETWEEN :'from'::timestamptz AND :'to'::timestamptz
  GROUP BY p.name, tb
)
-- 1 行目が全体ピーク、以降が POI 別ピーク（1 文にまとめる: CTE は文をまたげない）
(SELECT 'ALL' AS place, time_bucket AS peak_time, people FROM whole ORDER BY people DESC LIMIT 1)
UNION ALL
(SELECT DISTINCT ON (name) name AS place, tb AS peak_time, people FROM poi ORDER BY name, people DESC);
