-- flow_od.sql — Origin → Destination のフロー（ArcLayer 用に始点・終点座標を付与）
-- params: :from :to :bucket_min :src :limit
WITH od AS (
  SELECT origin_id, destination_id, sum(people_count) AS people, avg(avg_duration) AS avg_duration, avg(avg_distance) AS avg_distance
  FROM mobility.od WHERE source_type = :'src' AND bucket_minutes = :bucket_min AND time_bucket BETWEEN :'from'::timestamptz AND :'to'::timestamptz
  GROUP BY origin_id, destination_id
),
node AS (
  SELECT poi_id AS id, name, geom FROM mobility.pois
  UNION ALL SELECT mesh_id, mesh_id, centroid FROM mobility.meshes
)
SELECT od.origin_id, o.name AS origin_name, od.destination_id, d.name AS destination_name, od.people,
       round(od.avg_duration) AS avg_duration_sec, round(od.avg_distance) AS avg_distance_m,
       json_build_array(ST_X(o.geom), ST_Y(o.geom)) AS source_position,
       json_build_array(ST_X(d.geom), ST_Y(d.geom)) AS target_position
FROM od JOIN node o ON o.id = od.origin_id JOIN node d ON d.id = od.destination_id
ORDER BY od.people DESC LIMIT :limit;
