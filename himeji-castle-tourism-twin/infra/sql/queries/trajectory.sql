-- trajectory.sql — 軌跡を GeoJSON LineString（＋ timestamps 配列）で返す（deck.gl TripsLayer 用）
-- params: :person_hash（'' なら期間内の集約）:from :to :src :limit
SELECT json_build_object(
  'type', 'FeatureCollection',
  'features', COALESCE(json_agg(json_build_object(
    'type', 'Feature',
    'geometry', ST_AsGeoJSON(t.geom)::json,
    'properties', json_build_object(
      'id', t.id, 'person_hash', t.person_hash, 'start_time', t.start_time, 'end_time', t.end_time,
      'distance_m', t.distance_m, 'duration_sec', t.duration_sec, 'avg_speed', t.avg_speed, 'source_type', t.source_type,
      'timestamps', (SELECT json_agg(round(ST_M(g.geom)::numeric) ORDER BY g.path) FROM ST_DumpPoints(t.geom_m) AS g)   -- epoch 秒（TripsLayer の timestamps）
    ))), '[]'::json)
) AS geojson
FROM (
  SELECT * FROM mobility.trajectories
  WHERE source_type = :'src' AND (:'person_hash' = '' OR person_hash = :'person_hash')
    AND start_time <= :'to'::timestamptz AND end_time >= :'from'::timestamptz
  ORDER BY start_time LIMIT :limit
) t;
