# ARCHITECTURE_DB — 3DCityDB v5 + PostGIS を人流 Digital Twin の基盤に加える設計（STEP 18）

作成日: 2026-09-18 ／ 対象: `himeji-castle-tourism-twin`（姫路城・姫路市周辺 人流 Digital Twin プロトタイプ）

## 1. 既存プロジェクト構成の確認

| 項目 | 現状 |
| --- | --- |
| フロントエンド | 単一ファイル `index.html`（13MB）。`src/` の断片を `tools/assemble.py` が結合。ビルド不要・オフライン動作 |
| 3D エンジン | **Three.js r128**（同梱）。CesiumJS / deck.gl は使っていない（仕様書の想定と異なる点。後述 §7） |
| 都市モデル | PLATEAU 姫路市 2023 CityGML → `tools/prep_plateau.py` で LOD2（中心1.7km）/ LOD1（4.1万棟）/ 土地利用 / 橋梁を int16 量子化し `data/real/plateau.json`（5MB）に静的同梱。OSM 道路・鉄道・POI、地理院 DEM、兵庫県 DSM も同様に静的 JSON |
| 人流 | ブラウザ内シミュレーション（`src/people-flow/sim.js`、パラメータは `src/data/synthetic.js`）。1ドット＝8人、道路網 A* で移動。**すべて synthetic** |
| 可視化 | 粒子 / 熱（GPU）/ グリッド / ヘックス / 柱 / 流線 / 動く軌跡 / 等高線、Analytics KPI、メッシュ・建物クリック |
| 通信 | 現在 fetch は使っていない（CSV 読込ボタンのみ）。地理院タイルは `<img>` で取得 |
| MCP | PLATEAU MCP（HTTP）、Cesium MCP（CesiumJS 専用のため未使用）、QGIS MCP（要 QGIS） |

## 2. 現在のデータ構造（フロント内部）

| 種別 | 形 | 座標系 |
| --- | --- | --- |
| 建物（PLATEAU） | `l1`: フットプリント int16（0.2m）＋ 高さ・用途・階数・ID、`l2`: 屋根/壁三角形 int16（0.1m） | シーン局所座標（x=東, y=北, m。中心 34.8380N, 134.6915E） |
| 道路・鉄道・POI | OSM 由来の折れ線・点 | 同上 |
| 人流（agents） | `{seg, gk(ゲート), plan, state, cur{x,z}, sp, tStop, ...}` の配列 | 同上 |
| 集計 | `MESH.cells[{code, v, seg[3], stay, in{}, out{}, peak}]`、`OD Map`、`TRAJ`（線分＋時刻） | 同上 |
| 時刻 | `timeState.min`（00:00 = -360、06:00 = 0、24:00 = 1080 分） | 相対分 |

DB 側は EPSG:4326（人流）と EPSG:6697（PLATEAU/3DCityDB）を使うため、局所座標との変換は次の1本に集約する。

```
lon = 134.6915 + x / (111320·cos 34.838°)   lat = 34.8380 + y / 110574   （y = -z）
```

フロントは既に `toLL / toXZ`（`src/people-flow/flow3d.js`）を持つので、API 応答（GeoJSON, 4326）→ 局所座標の変換はこれを再利用する。

## 3. Docker 導入による影響

- フロントは静的ファイルのままなので **Docker は任意**。DB・API を起動しない場合は従来どおり synthetic シミュレーションで動く（フォールバック設計）。
- 追加するのは `infra/` 配下のみ。既存 `src/` への変更は「API クライアント（`src/data/api_client.js`）」と「DB 接続トグル」の追加に限定する。
- ブラウザ → PostgreSQL 直結は禁止（STEP 10）。API（FastAPI, :8000）だけがブラウザに露出する。DB ポート 5432 はローカル開発でのみ公開。
- この開発環境（クラウドサンドボックス）では Docker デーモンが使えないため、compose の**起動は未検証**。代わりにローカル PostgreSQL 16 + PostGIS 3.4 + SFCGAL に同じ SQL（3DCityDB v5 `create-db.sql`、mobility migrations、queries）を適用して検証した（§8）。

## 4. Migration 設計

- 3DCityDB 本体は公式イメージ `3dcitydb/3dcitydb-pg:16-3.5-5.1` の初期化スクリプト（`/docker-entrypoint-initdb.d/3dcitydb-initdb.sh`）が `citydb` スキーマを作る。**別途 PostgreSQL は立てない**（STEP 1）。
- 人流は同じ DB の `mobility` スキーマ。`infra/sql/migrations/NNN_*.sql` を番号順に適用（`infra/sql/init/zz-mobility.sh` を `/docker-entrypoint-initdb.d/` に mount し初回起動で自動適用。再適用は同スクリプトの手動実行）。
- 版管理は `mobility.schema_migrations(version, applied_at)` に記録。ロールバックは `9xx_down_*.sql`。
- SRID: `mobility.*` は 4326（仕様）。集計は `ST_Transform(geom, 6673)`（JGD2011 平面直角 V 系、m 単位）で行う関数を用意し、距離・面積・メッシュ生成を m で扱う。
- Materialized View: `mobility.mesh_stats_5min / _15min / _hourly`（`REFRESH MATERIALIZED VIEW CONCURRENTLY` 可能な一意索引付き）。1分・30分は関数 `mobility.mesh_stats_at(res, bucket_minutes, t)` で都度集計。
- synthetic: `mobility.raw_points.source_type='synthetic'`, `source_id='synthetic-v1'` を必須にし、`mobility.synthetic_*` ビュー（source_type='synthetic' に限定）を提供。生成物は `data/synthetic/mobility/*.csv`。実データ投入時は `source_type='gps' | 'beacon' | 'sensor'` を使う。

## 5. API 境界設計（FastAPI, `infra/api`）

| Endpoint | 入力 | 出力 | 主なテーブル |
| --- | --- | --- | --- |
| `GET /api/health` | — | DB/PostGIS/3DCityDB の版 | — |
| `GET /api/people/current` | `t`(ISO), `bbox`, `limit`, `sample` | GeoJSON Points（サンプル GPS 点） | raw_points |
| `GET /api/people/bbox` | `bbox`, `t`, `window`(分) | 現在人数・流入・流出・平均滞在 | raw_points, stays |
| `GET /api/people/near` | `lon,lat`, `t`, `radii=100,250,500,1000` | 半径別の人数 | raw_points |
| `GET /api/mesh` | `res`(50/100/250/h3), `t`, `bucket`(1/5/15/30/60), `bbox`, `format`(geojson/json/mvt) | GeoJSON Polygons ＋ `people_count, inflow, outflow, avg_stay_sec, avg_speed, density, congestion_index`（GridLayer/HexagonLayer/ColumnLayer にそのまま渡せる `position`＋`weight` も付与） | meshes, mesh_stats* |
| `GET /api/mesh/{id}` | `t` | 1メッシュの時系列＋ピーク＋主要 OD | mesh_stats*, od |
| `GET /api/flow` | `t`, `window`, `bbox` | OD ペアの集計（`from/to` の座標付き） | od, stays |
| `GET /api/trajectory` | `person_hash` or `t,window,limit` | GeoJSON LineString（`timestamps` 配列付き → TripsLayer 相当） | trajectories |
| `GET /api/stays` | `t`, `window`, `bbox` | GeoJSON Points（`duration_sec` 付き → Heatmap） | stays |
| `GET /api/od` | `t`, `bucket` | OD 行列 | od |
| `GET /api/buildings` | `bbox`, `lod`(1/2), `limit` | GeoJSON（3DCityDB `citydb.feature`＋`geometry_data`、高さ属性） | citydb |
| `GET /api/tiles/mesh/{z}/{x}/{y}.mvt` | `res`, `t` | MVT（大量データ向け） | meshes, mesh_stats* |

- 応答は GeoJSON FeatureCollection を基本、メッシュは MVT も提供（STEP 11）。
- LOD 連動（STEP 16）はフロント側で視点半径から `res` を決める: 遠 250m → 中 100m → 近 50m → 超近（半径 < 400m）は `/api/people/current?sample=…` の点。
- CORS は開発用に `*`。本番は同一オリジン配信（API が `index.html` を配信）を想定。

## 6. MCP と役割分担

| MCP | 役割 | 接続 |
| --- | --- | --- |
| 3DCityDB MCP（TUM, `3dcitydb-mcp-server`） | `citydb` スキーマの読み取り専用 SQL（`default_transaction_read_only=on`）。「姫路城周辺500mの建物」「LOD2 抽出」「高さ別集計」 | `claude mcp add 3dcitydb -- 3dcitydb-mcp`（`.env` の `CITYDB_*`） |
| PLATEAU MCP | CityGML の所在・属性・仕様の参照 | 既存（HTTP） |
| QGIS MCP | GIS 前処理（ローカル QGIS がある環境） | 既存（要 QGIS） |
| PostGIS（psql / API） | mobility スキーマの集計 | API 経由 |

## 7. 仕様との差分と方針

- **CesiumJS / deck.gl を使っていない**: 既存は Three.js 単独（前フェーズで合意）。仕様の「deck.gl Layer への切替」は、対応する Three.js レイヤー（点・ヒート・グリッド/ヘックス/柱・動く軌跡・アーク）を **同じ API 応答**で駆動する形で満たす。API の応答形は deck.gl の各 Layer が要求する形（`position`, `weight`, `path`, `timestamps`, `sourcePosition/targetPosition`）を含めるので、将来 deck.gl/Cesium を並べる場合もそのまま使える。
- **citydb buildings → Cesium**: 3DCityDB からの建物は `GET /api/buildings`（GeoJSON＋高さ）で提供し、Three.js の押し出し建物として表示する。Cesium 3D Tiles 化は `citydb-tool export` → tiler の追加作業（本フェーズ外）。
- **3DCityDB MCP fullstack**: TUM の fullstack 構成のうち Gradio エージェント（LLM API キーが必要）は含めず、MCP サーバ本体（`3dcitydb-mcp-sse`）をコンテナ化して同梱する。Claude Code からは stdio 版（`3dcitydb-mcp`）を推奨。

## 8. 検証環境と検証結果（この作業環境）

- Docker デーモン: 利用不可 → compose の起動は未検証（ファイルは公式イメージの環境変数仕様に合わせて作成）。
- 代替検証: ローカル PostgreSQL 16.13 + PostGIS 3.4.2 + SFCGAL 1.5.1 に、公式リポジトリ（3dcitydb/3dcitydb, v5）の `create-db.sql` を SRID 6697 で適用 → `citydb` スキーマ作成を確認。mobility migrations・queries・API・synthetic 投入も同 DB で実行。
- `3dcitydb-mcp-server 0.3.2` を venv に導入し `3dcitydb-doctor` を実行（結果は `infra/README_DB.md`）。`mcp` は 1.x を固定（2.x では起動しない）。
- `citydb-tool 1.4.0`（Java 21）で PLATEAU `52342505_bldg_6697_op.gml` を `--transform=swap-xy` 付きで取込（Building 1,277 棟, 4 秒）。3DCityDB v5 の属性木（`property.parent_id`, `height` → `value`）と境界面（`boundary` → `lod2MultiSurface`）を `/api/buildings` が辿ることを確認。
- ブラウザ検証（Playwright/Chromium）: DB モードで点・グリッド（LOD 250→100→50→点）・ヒート・流線・軌跡・メッシュ詳細・3DCityDB 建物 LOD1/LOD2 を表示、JS エラー 0。

## 9. 実装順（STEP 19）

Phase A Docker → B mobility schema → C synthetic 投入 → D 空間クエリ → E API → F 既存 HTML 接続 → G Mesh → H Trips → I 3D buildings → J 性能最適化。各 Phase の成果物は `infra/README_DB.md` の表に対応付ける。

| Phase | 状態 | 成果物 |
| --- | --- | --- |
| A Docker | 作成済（compose 起動は未検証: デーモン無し） | `infra/docker/*` |
| B mobility schema | 適用・検証済 | `infra/sql/migrations/001–005` |
| C synthetic | 生成・投入済（69,615 点） | `infra/synthetic/`, `data/synthetic/mobility/` |
| D 空間クエリ | 9 本すべて実行確認 | `infra/sql/queries/` |
| E API | 全エンドポイント確認 | `infra/api/` |
| F 接続 / G Mesh / H Trips / I Buildings | ブラウザで確認 | `src/data/api_client.js` ＋ 既存モジュールへの最小フック |
| J 性能 | 索引・MV・bbox/時刻フィルタ・LOD、doctor/MCP 登録 | `005_mesh_stats.sql`, `README_DB.md` |
