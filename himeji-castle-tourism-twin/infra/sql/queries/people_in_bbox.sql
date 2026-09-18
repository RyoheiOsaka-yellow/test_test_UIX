-- people_in_bbox.sql — 指定 BBox 内の「現在人数・流入・流出・平均滞在」
-- params: :minlon :minlat :maxlon :maxlat :t（timestamptz）:window_min（既定 60）:src（既定 'synthetic'）
-- 現在人数 = t の直前 5 分に BBox 内で観測されたユニーク人数
-- 流入/流出 = 直近 window_min 分に BBox の外→内 / 内→外 へ移動した人数、平均滞在 = BBox 内で始まった滞在の平均秒
WITH bbox AS (SELECT ST_MakeEnvelope(:minlon, :minlat, :maxlon, :maxlat, 4326) AS g),
pts AS (
  SELECT p.person_hash, p."timestamp" AS ts, ST_Within(p.geom, b.g) AS inside
  FROM mobility.raw_points p, bbox b
  WHERE p.source_type = :'src' AND p."timestamp" BETWEEN :'t'::timestamptz - make_interval(mins => :window_min) AND :'t'::timestamptz
    AND p.geom && ST_Expand(b.g, 0.01)
),
trans AS (SELECT person_hash, inside, lag(inside) OVER (PARTITION BY person_hash ORDER BY ts) AS prev FROM pts)
SELECT
  (SELECT count(DISTINCT person_hash) FROM pts WHERE inside AND ts >= :'t'::timestamptz - interval '5 min') AS people_now,
  (SELECT count(*) FROM trans WHERE inside AND prev = false) AS inflow,
  (SELECT count(*) FROM trans WHERE NOT inside AND prev = true) AS outflow,
  (SELECT round(avg(s.duration_sec)) FROM mobility.stays s, bbox b
     WHERE s.source_type = :'src' AND ST_Within(s.geom, b.g) AND s.start_time BETWEEN :'t'::timestamptz - make_interval(mins => :window_min) AND :'t'::timestamptz) AS avg_stay_sec;
