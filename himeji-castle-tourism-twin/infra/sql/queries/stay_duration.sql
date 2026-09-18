-- stay_duration.sql — 滞在時間の集計（POI 別・メッシュ別、分布）
-- params: :from :to :src
SELECT COALESCE(p.name, s.mesh_id) AS place, s.poi_id, s.mesh_id,
       count(*) AS stays, count(DISTINCT s.person_hash) AS people,
       round(avg(s.duration_sec) / 60.0, 1) AS avg_min,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY s.duration_sec) / 60.0)::numeric, 1) AS median_min,
       round(max(s.duration_sec) / 60.0, 1) AS max_min
FROM mobility.stays s LEFT JOIN mobility.pois p ON p.poi_id = s.poi_id
WHERE s.source_type = :'src' AND s.start_time BETWEEN :'from'::timestamptz AND :'to'::timestamptz
GROUP BY 1, 2, 3 ORDER BY people DESC LIMIT 50;
