-- congestion.sql — 混雑メッシュ（congestion_index の高い順）と混雑メッシュ数
-- params: :res :bucket_min :t :threshold（0..1、既定 0.5）:src
WITH s AS (SELECT * FROM mobility.mesh_stats_at(:res, :bucket_min, :'t'::timestamptz, :'src'))
SELECT (SELECT count(*) FROM s WHERE congestion_index >= :threshold) AS congested_meshes,
       json_agg(json_build_object('mesh_id', mesh_id, 'people', people_count, 'density', round(density::numeric, 1), 'congestion_index', round(congestion_index::numeric, 2),
                                  'position', json_build_array(ST_X(centroid), ST_Y(centroid))) ORDER BY congestion_index DESC) FILTER (WHERE congestion_index >= :threshold) AS congested
FROM s;
