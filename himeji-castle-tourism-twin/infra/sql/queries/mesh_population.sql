-- mesh_population.sql — 指定時刻のメッシュ別人数（GridLayer / HexagonLayer / ColumnLayer にそのまま渡せる構造）
-- params: :res（50/100/250）:bucket_min（1/5/15/30/60）:t :src
-- 出力: mesh_id, position [lon,lat], weight（=people_count）, elevation（人数）, 各指標, polygon（GeoJSON）
SELECT s.mesh_id,
       json_build_array(ST_X(s.centroid), ST_Y(s.centroid)) AS position,
       s.people_count AS weight, s.people_count AS elevation,
       s.inflow, s.outflow, s.avg_stay_sec, s.avg_speed, s.density, s.congestion_index,
       ST_AsGeoJSON(s.geom)::json AS polygon
FROM mobility.mesh_stats_at(:res, :bucket_min, :'t'::timestamptz, :'src') s
ORDER BY s.people_count DESC;
