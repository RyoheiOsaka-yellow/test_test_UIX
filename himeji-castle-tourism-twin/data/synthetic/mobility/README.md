# SYNTHETIC mobility data

`raw_points.csv` は `infra/synthetic/generate_synthetic.py` が合成した GPS 点列です（実人流ではありません）。
- persons: 300, points: 69615, date: 2026-10-04, step: 60s, seed: 7
- source_type = synthetic, source_id = synthetic-v1（DB 側の `mobility.synthetic_*` ビューで分離）
- 参考にした都市構造: OSM 道路網（歩行）、JR姫路駅・山陽姫路駅・バスターミナル・IC、大手門〜城内順路、好古園・みゆき通り・美術館・大手前通り
- 投入: `bash infra/sql/load_synthetic.sh`（\copy → build_trajectories / detect_stays / build_od / compute_all_mesh_stats / refresh）
