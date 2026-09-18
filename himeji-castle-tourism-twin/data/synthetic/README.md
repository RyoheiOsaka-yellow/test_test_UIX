# data/synthetic — 合成データ（実データではありません）

人流（来訪者の到着・回遊・滞留・帰路）はブラウザ内シミュレーションで生成する **synthetic** データです。
パラメータは `src/data/synthetic.js` に集約しています（公表統計から換算した仮置き値。出典は同ファイルの `SOURCES`）。

| 項目 | 定義場所 | 実データへの差し替え先（想定） |
| --- | --- | --- |
| 来訪者セグメント・シナリオ（日別入城者数・海外比率） | `SCN`, `mixOf` | 入城券販売実績・携帯位置情報の居住地推定 |
| 流入ゲートの利用率 | `GATE_SHARE` | 駅乗降・IC通過・バス乗車実績 |
| 広域動線（路線・高速・航路・空港） | `CORRIDORS`, `ORIGINS` | 携帯位置情報の OD（総務省 GPS-OD と同様） |
| 回遊先の立寄率・滞在時間 | `SPOTS`, `CASTLE_DWELL` | 携帯位置情報の滞在判定、Wi-Fi/カメラ |
| 消費額 | `SPEND` | 決済データ・観光動向調査 |

`data/real/` には実データ由来のシーン（`scene_data.json`: OSM・地理院、`plateau.json`: PLATEAU、`real.json`: 地理院 DEM・兵庫県 DSM）を置いています。
`dwell_mesh` / `trip_trace` / `stay_floor` などの実測テーブルが得られたら、`src/people-flow/sim.js` の集計関数（`meshAccumulate`、`odRecord`、`floorStats`）をテーブル読込に置き換えることで、UI と Visualization はそのまま利用できます。
