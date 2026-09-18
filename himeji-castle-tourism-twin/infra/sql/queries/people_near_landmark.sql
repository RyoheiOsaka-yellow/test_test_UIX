-- people_near_landmark.sql — 地点（POI or lon/lat）から 100 / 250 / 500 / 1000 m 圏内の人流集計（例: 姫路城 500m 圏内）
-- params: :poi（例 'castle'）:t :window_min（既定 60）:src
-- 出力: 半径ごとの ユニーク人数・観測点数・平均速度・滞在数
WITH c AS (SELECT geom FROM mobility.pois WHERE poi_id = :'poi'),
radii AS (SELECT unnest(ARRAY[100, 250, 500, 1000]) AS r)
SELECT r.r AS radius_m,
       count(DISTINCT p.person_hash) AS people,
       count(p.*) AS points,
       round(avg(p.speed)::numeric, 2) AS avg_speed_mps,
       (SELECT count(*) FROM mobility.stays s WHERE s.source_type = :'src' AND ST_DWithin(s.geom::geography, c.geom::geography, r.r)
          AND s.start_time BETWEEN :'t'::timestamptz - make_interval(mins => :window_min) AND :'t'::timestamptz) AS stays
FROM radii r CROSS JOIN c
LEFT JOIN mobility.raw_points p ON p.source_type = :'src'
  AND p."timestamp" BETWEEN :'t'::timestamptz - make_interval(mins => :window_min) AND :'t'::timestamptz
  AND ST_DWithin(p.geom::geography, c.geom::geography, r.r)
GROUP BY r.r, c.geom ORDER BY r.r;
