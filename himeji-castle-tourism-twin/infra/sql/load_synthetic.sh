#!/usr/bin/env bash
# synthetic raw_points.csv を mobility.raw_points に投入し、軌跡・滞在・OD・メッシュ統計を派生させる
# 使い方: PGHOST=localhost PGPORT=5432 PGUSER=citydb PGPASSWORD=citydb PGDATABASE=citydb bash infra/sql/load_synthetic.sh [csv] [date]
#   docker: docker compose exec citydb bash /queries/../load_synthetic.sh /data/synthetic/mobility/raw_points.csv 2026-10-04
set -euo pipefail
CSV=${1:-"$(dirname "$0")/../../data/synthetic/mobility/raw_points.csv"}
DATE=${2:-2026-10-04}
psql=( psql -v ON_ERROR_STOP=1 )
echo "load $CSV"
"${psql[@]}" -c "DELETE FROM mobility.raw_points WHERE source_type='synthetic';"
"${psql[@]}" -c "\copy mobility.raw_points (source_id, person_hash, \"timestamp\", longitude, latitude, accuracy, speed, heading, source_type) FROM '$CSV' WITH (FORMAT csv, HEADER true)"
"${psql[@]}" -tA -c "SELECT count(*) AS raw_points FROM mobility.synthetic_raw_points;"
echo "derive trajectories / stays / od"
"${psql[@]}" -tA -c "SELECT mobility.build_trajectories('synthetic');"
"${psql[@]}" -tA -c "SELECT mobility.detect_stays('synthetic', 40, 300);"
"${psql[@]}" -tA -c "SELECT mobility.build_od(60, 'synthetic');"
"${psql[@]}" -tA -c "SELECT mobility.build_od(15, 'synthetic');"
echo "mesh stats (50/100/250m × 1/5/15/30/60 min)"
"${psql[@]}" -c "SELECT * FROM mobility.compute_all_mesh_stats('${DATE} 00:00+09', '${DATE} 24:00+09', 'synthetic');"
"${psql[@]}" -c "SELECT mobility.refresh_mesh_stats_views();"
"${psql[@]}" -c "ANALYZE mobility.raw_points; ANALYZE mobility.stays; ANALYZE mobility.trajectories; ANALYZE mobility.mesh_stats;"
echo "done"
