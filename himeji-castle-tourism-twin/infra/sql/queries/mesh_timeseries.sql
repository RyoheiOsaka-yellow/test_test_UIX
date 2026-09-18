-- mesh_timeseries.sql — 1 メッシュの時系列（時間帯別）と、ピーク時刻
-- params: :mesh_id :bucket_min :from :to :src
SELECT time_bucket, people_count, inflow, outflow, avg_stay_sec, avg_speed, density, congestion_index,
       rank() OVER (ORDER BY people_count DESC) = 1 AS is_peak
FROM mobility.mesh_stats
WHERE mesh_id = :'mesh_id' AND bucket_minutes = :bucket_min AND source_type = :'src'
  AND time_bucket BETWEEN :'from'::timestamptz AND :'to'::timestamptz
ORDER BY time_bucket;
