# README_DB — 3DCityDB v5 + PostgreSQL/PostGIS データ基盤（ローカル・OSS のみ）

姫路 人流 Digital Twin プロトタイプ（`index.html`）に、**将来の実 GPS / PLATEAU / センサー / ビーコン データを受ける土台**として
PostgreSQL + PostGIS + 3DCityDB v5 を追加したものです。フロントは従来どおり単一 HTML のまま動き、
「データソース」を **DB / API** に切り替えると同じ画面が DB の値を表示します。設計は `../ARCHITECTURE_DB.md`。

```
ブラウザ index.html ──(HTTP /api/*, GeoJSON/JSON/MVT)──► infra/api  FastAPI :8000 ──(read-only role)──► PostgreSQL 16
                                                                                                        ├ citydb   … 3DCityDB v5.1（PLATEAU CityGML）
Claude Code ──(stdio MCP: 3dcitydb-mcp, read-only)────────────────────────────────────────────────────► ├ mobility … 人流（raw_points / trajectories / stays / meshes / mesh_stats / od）
citydb-tool ──(import citygml)──────────────────────────────────────────────────────────────────────────┘
```

- ブラウザは **PostgreSQL に直接つながない**（STEP 10）。API だけが外に出る。
- 人流の値は **API が返す `source`（現在は `synthetic`＝合成データ）** をそのまま表示し、画面・API・DB の3か所で synthetic と明示する（STEP 13）。
- 有料サービス・クラウドは使わない。Docker Compose（ローカル）または手元の PostgreSQL で動く。

## ディレクトリ

| パス | 内容 | Phase |
| --- | --- | --- |
| `docker/docker-compose.yml`, `docker/.env.example` | citydb（公式 `3dcitydb/3dcitydb-pg`）/ mcp / api / tool（citydb-tool, profile `import`） | A |
| `docker/3dcitydb-mcp/Dockerfile` | TUM 3DCityDB MCP Server（SSE 版） | A |
| `sql/init/zz-mobility.sh` | 初回起動で `sql/migrations/*.sql` を番号順に適用（`mobility.schema_migrations` で冪等） | B |
| `sql/migrations/001…005` | mobility スキーマ・ロール・メッシュ生成・軌跡/滞在/OD 関数・メッシュ統計と Materialized View | B, G, J |
| `synthetic/generate_synthetic.py`, `../data/synthetic/mobility/raw_points.csv` | 合成 GPS 点列（OSM 道路網を歩く 300 人・1 日・60 秒間隔） | C |
| `sql/load_synthetic.sh` | CSV 投入 → 軌跡・滞在・OD・メッシュ統計を派生 | C |
| `sql/queries/*.sql` | 空間クエリ 9 本（psql 変数で時刻・範囲を指定） | D |
| `api/app/main.py`, `api/Dockerfile`, `api/requirements.txt` | Human Flow API（FastAPI + psycopg3、GeoJSON / MVT） | E |
| `../src/data/api_client.js` | フロントの API クライアント（データソース切替・LOD・各レイヤー接続・3DCityDB 建物） | F–I |

## Phase A — 起動（Docker Compose）

前提: Docker Desktop / Docker Engine + Compose v2。

```bash
cd infra/docker
cp .env.example .env            # パスワードは必ず変更
docker compose up -d citydb api # まず DB と API（mcp は任意、tool は import 時だけ）
docker compose ps               # citydb が healthy になるまで待つ（初回は 3DCityDB 作成で 1〜2 分）
curl -s localhost:8000/api/health | jq .
```

初回起動で公式イメージの `3dcitydb-initdb.sh` が `citydb` スキーマ（SRID 6697, `urn:ogc:def:crs:EPSG::6697`）を作り、
続けて `zz-mobility.sh` が `mobility` スキーマを作ります。別途 PostgreSQL は立てません（STEP 1）。
再適用（既存ボリュームに新しい migration だけ当てる）:

```bash
docker compose exec citydb bash /docker-entrypoint-initdb.d/zz-mobility.sh
```

ポート: PostgreSQL 5432（ローカル開発のみ公開）、API 8000、MCP(SSE) 8080。本番相当ではブラウザから見えるのは 8000 だけにします。

### Docker が使えない環境（この作業環境での検証方法）

手元の PostgreSQL 16 + PostGIS でも同じ SQL がそのまま動きます。

```bash
# 3DCityDB v5.1.4 のリリース zip から citydb スキーマ（SRID 6697）
psql -d citydb -v srid=6697 -v srs_name=urn:ogc:def:crs:EPSG::6697 -v changelog=no -f 3dcitydb-5.1.4/postgresql/sql-scripts/create-db.sql
# mobility スキーマ
for f in infra/sql/migrations/00*.sql; do psql -d citydb -v DBNAME=citydb -f $f; done
```

## Phase B — mobility スキーマ

すべて `mobility.*`、ジオメトリは EPSG:4326、距離・面積は `mobility.to_metric()`（EPSG:6673＝JGD2011 平面直角 V 系, m）で計算。

| テーブル | 主な列 | 索引 |
| --- | --- | --- |
| `raw_points` | id, source_id, person_hash, timestamp, longitude, latitude, geom(Point), accuracy, speed, heading, source_type | GiST(geom), (timestamp), (person_hash, timestamp), (source_type, timestamp) |
| `trajectories` | id, person_hash, start_time, end_time, geom(LineString), geom_m(LineStringM: M=epoch 秒), distance_m, duration_sec, avg_speed | GiST(geom), (person_hash), (start_time, end_time) |
| `stays` | id, person_hash, start_time, end_time, duration_sec(生成列), geom(Point), mesh_id, poi_id | GiST(geom), (start_time), (person_hash), (mesh_id) |
| `meshes` | mesh_id, mesh_type(square50/100/250, jis), resolution, geom(Polygon), centroid, area_m2 | GiST(geom), (mesh_type) |
| `mesh_stats` | mesh_id, time_bucket, bucket_minutes(1/5/15/30/60), people_count, inflow, outflow, avg_stay_sec, avg_speed, density(人/ha), congestion_index(0–1) | PK(mesh_id, time_bucket, bucket_minutes, source_type), (time_bucket, bucket_minutes) |
| `od` | origin_id, destination_id, time_bucket, bucket_minutes, people_count, avg_duration, avg_distance | (time_bucket), (origin_id), (destination_id) |
| `pois` | poi_id, name, geom | — |

- `source_type` は enum（gps / beacon / sensor / wifi / camera / ticket / synthetic）。`mobility.synthetic_raw_points` 等のビューは synthetic だけを見る。
- ロール（002）: `citydb_reader`（SELECT のみ、`default_transaction_read_only=on`、`statement_timeout=30s`。API と MCP が使う）、`mobility_writer`（ETL 用）。
- メッシュ（003）: 正方 50/100/250m は EPSG:6673 の格子（`mesh_id_for(geom,res)` → `sq100:<i>:<j>`）、地域メッシュ 4〜6 次（`jis:<code>`）。H3 は拡張 `h3` があれば `generate_h3_meshes()` が使える。
- 派生（004）: `build_trajectories(src, gap_min, min_points)`、`detect_stays(src, radius_m, min_sec)`、`build_od(bucket_min, src)`。
- 集計（005）: `compute_mesh_stats(res, bucket_min, t_from, t_to, src)`、`compute_all_mesh_stats()`（50/100/250 × 1/5/15/30/60）、Materialized View `mesh_stats_5min / _15min / _hourly`（100m、一意索引付きで `CONCURRENTLY` 更新）、`mesh_stats_at(res, bucket, t, src, bbox)`。

## Phase C — synthetic データ（実測ではありません）

```bash
python3 infra/synthetic/generate_synthetic.py --persons 300 --step 60 --date 2026-10-04 --seed 7   # → data/synthetic/mobility/raw_points.csv
PGHOST=localhost PGPORT=5432 PGUSER=citydb PGPASSWORD=citydb PGDATABASE=citydb bash infra/sql/load_synthetic.sh
# docker: docker compose exec citydb bash -c "PGUSER=citydb PGPASSWORD=citydb PGDATABASE=citydb bash /queries/../load_synthetic.sh /data/synthetic/mobility/raw_points.csv"
```

- `source_type='synthetic'`, `source_id='synthetic-v1'` が必須。生成物は `data/synthetic/`（実データは `data/real/`）。
- 大量データの検証用（Point Cloud, 3,000 人・30 秒間隔 ≈ 138 万点、CSV 150MB なのでリポジトリには入れない）: `python3 infra/synthetic/generate_synthetic.py --persons 3000 --step 30 --seed 11 --out /tmp/synth_large && bash infra/sql/load_synthetic.sh /tmp/synth_large/raw_points.csv`（派生処理 約 3 分）。
- 実 GPS を入れるときは同じ CSV 列（source_id, person_hash, timestamp, longitude, latitude, accuracy, speed, heading, source_type）で `source_type='gps'` にし、`load_synthetic.sh` の派生関数を `'gps'` で呼ぶだけ。

投入結果（この環境）: raw_points 69,615 / trajectories 295 / stays 2,889 / od 619 / meshes 38,846（sq50 25,921・sq100 6,561・sq250 1,089・jis 5,275）/ mesh_stats 144,670 / MV 5min 10,945・15min 5,929・hourly 2,423。

## Phase D — 空間クエリ（`sql/queries/`）

| ファイル | 内容 | 変数 |
| --- | --- | --- |
| `people_in_bbox.sql` | 範囲内の現在人数・流入・流出・平均滞在 | `:minlon :minlat :maxlon :maxlat :t :src` |
| `people_near_landmark.sql` | 姫路城など POI 半径 100/250/500/1000m の人数 | `:poi :t :src` |
| `mesh_population.sql` | 指定時刻のメッシュ別人数（Materialized View 優先） | `:res :bucket_min :t :src` |
| `mesh_timeseries.sql` | 1 メッシュの当日時系列 | `:mesh_id :bucket_min :from :to :src` |
| `stay_duration.sql` | POI / メッシュ別の滞在時間分布 | `:from :to :src` |
| `flow_od.sql` | OD 上位ペア（座標付き） | `:from :to :bucket_min :src` |
| `trajectory.sql` | 軌跡 GeoJSON（timestamps 付き） | `:person_hash :from :to :src :limit` |
| `congestion.sql` | 混雑指数上位メッシュ | `:t :res :bucket_min :src` |
| `peak_time.sql` | 全体・POI 別ピーク時刻 | `:from :to :bucket_min :src` |

```bash
psql -v t="2026-10-04 12:00+09" -v src=synthetic -v poi=castle -f infra/sql/queries/people_near_landmark.sql
```

PostGIS 関数の確認（STEP 5）: ST_Distance, ST_DWithin, ST_Within, ST_Intersects, ST_Buffer, ST_Transform, ST_MakeLine, ST_MakePoint, ST_AsGeoJSON, ST_AsMVT, ST_ClusterDBSCAN, ST_SetSRID, ST_X/Y, ST_Length, ST_Area, ST_Centroid, ST_MakeEnvelope, ST_Expand — すべて利用可を確認済み。

## Phase E — Human Flow API（FastAPI）

```bash
cd infra/api && pip install -r requirements.txt
DATABASE_URL=postgresql://citydb_reader:citydb_reader@localhost:5432/citydb API_STATIC_DIR=../.. uvicorn app.main:app --port 8000
# → http://localhost:8000/ で index.html（同一オリジン）、http://localhost:8000/docs で OpenAPI
```

| Endpoint | 主なパラメータ | 応答 | 元テーブル |
| --- | --- | --- | --- |
| `GET /api/health` | — | PostgreSQL / PostGIS / 3DCityDB 版、migrations、source 別の期間と点数、建物数 | — |
| `GET /api/people/current` | `t, bbox, window, limit, sample, source` | GeoJSON Point（各人の最新点、speed/heading） | raw_points |
| `GET /api/people/bbox` | `bbox, t, window` | people_now / inflow / outflow / avg_stay_sec | raw_points, stays |
| `GET /api/people/near` | `poi` or `lon,lat`, `t, radii` | 半径別の人数・速度 | raw_points, pois |
| `GET /api/people/series` | `t, bucket` | 当日の時間帯別ユニーク人数（KPI のピーク・前時間帯比） | raw_points |
| `GET /api/mesh` | `res(50/100/250), t, bucket(1/5/15/30/60), bbox, format(geojson/json), min_people` | セル別 people_count / inflow / outflow / avg_stay_sec / avg_speed / density / congestion_index（`position`, `weight`, `elevation` 付き） | mesh_stats, meshes |
| `GET /api/mesh/{id}` | `t, bucket` | 当日時系列・ピーク・主要 OD | mesh_stats, od |
| `GET /api/od` (= `/api/flow`) | `t, window, bucket, limit` | OD 上位（source/target 座標付き） | od, pois, meshes |
| `GET /api/trajectory` | `person_hash` or `t, window, limit` | GeoJSON LineString ＋ `timestamps`（epoch 秒） | trajectories |
| `GET /api/stays` | `t, window, bbox, limit` | GeoJSON Point ＋ `duration_sec`（= weight） | stays |
| `GET /api/buildings` | `bbox, lod(1/2), limit` | lod=1: フットプリント（lod1Solid 底面）＋ `height`（bldg:height の value）/ lod=2: 屋根・壁・地面の面（MultiPolygon Z） | citydb.feature / property / geometry_data |
| `POST /api/ai/evaluate`, `GET /api/ai/status`, `GET /api/ai/attention`, `GET /api/ai/decisions` | `state, questions, bbox, t, source, mode` | Jev AI Decision Layer（`../AI_DECISION_LAYER.md`）。bbox/t を渡すと PostGIS から集約 Feature（area / mobility / history / 上位 30 メッシュ）を作る | mesh_stats, stays |
| `GET /api/points` | `bbox, timeFrom, timeTo, lod(0-3), maxPoints, source, format(bin/json)` | **バイナリ**（HPC1: pos0/pos1 Float32×2, t0/t1 Float32, attr Uint8×4 density/stay/speed/confidence, dir Uint8, pid Uint32）。50m セル密度に応じたサンプリング。Point Cloud 用 | raw_points, stays |
| `GET /api/tiles/mesh/{z}/{x}/{y}.mvt` | `res, t, bucket` | Mapbox Vector Tile（大量セル向け） | mesh_stats, meshes |

- 応答は GeoJSON / JSON。座標は 4326（経度, 緯度[, 高さ]）。時刻 `t` は ISO 8601（タイムゾーン無しは JST）。
- PostgreSQL への接続は `citydb_reader`（読み取り専用）。`API_MAX_POINTS`（既定 20,000）以上の生点は返さない。

## Phase F〜I — 既存 HTML との接続（`src/data/api_client.js`）

画面左パネル「データソース」で **ブラウザ内シミュレーション（synthetic）／ DB / API** を切り替えます（設定 `CONFIG.api.base`、`autoConnect`）。
API が `index.html` を配信していれば同一オリジン、`file://` で開いた場合は `http://localhost:8000` に接続します（CORS は `.env` の `API_CORS_ORIGINS`）。

| 画面のレイヤー | DB モードのデータ | 備考 |
| --- | --- | --- |
| 点（point） | `/api/people/current`（直近 5 分の各人の最新点） | 橙＝静止（<0.3 m/s）、水色＝移動。ズームで sample 0.2 / 0.5 / 1 |
| グリッド / 3D カラム / 等高線 | `/api/mesh`（正方 50/100/250m の mesh_stats） | 高さ＝人数、色＝人数（その時刻の最大を上限）。ホバー＝密度・混雑指数、クリック＝`/api/mesh/{id}` の当日時系列 |
| 地域メッシュ / ヘックス | `/api/people/current` を既存セルへ客側集計 | mesh_stats に無い形状は点から集計（人数＝ユニーク person） |
| ヒートマップ（heat） | `/api/stays`（直近 1 時間、重み＝滞在時間） | GPU スプラットは既存のまま |
| 流線（flow） | `/api/od`（直近 3 時間・上位 48 ペア） | POI 名（大手門・大天守…）またはメッシュ ID |
| 動く軌跡 / 累積（trips） | `/api/trajectory`（timestamps）＋ `/api/stays`（滞留点） | 動く軌跡＝時間窓、累積＝当日 2,000 本まで |
| Analytics KPI | `/api/people/bbox`（市内 bbox）＋ `/api/people/series` | 実人数。「1ドット＝8人」の換算はしない |
| 3DCityDB 建物 | `/api/buildings` lod=1（全域、押し出し）→ カメラ距離 <1.2km で lod=2（屋根・壁面） | 既存 PLATEAU 建物の上に水色で重ねる（DB 由来と分かるように） |

LOD（STEP 16）: カメラ距離 ≥4.5km → 250m、≥1.8km → 100m、≥0.7km → 50m、それ未満 → サンプル点。「ズーム連動 LOD」を外すとパネルで選んだ解像度に固定。
取得は 400ms 間引き・時刻は最大 5 分刻みに丸め・同じキーは再取得しない・視野が狭いときは bbox を付ける（STEP 15）。

## STEP 7 — 3DCityDB に PLATEAU CityGML を取り込む

PLATEAU 姫路市 2023（CityGML 2.0 / 仕様 4.1 / EPSG:6697）を `data/real/citygml/bldg/` に置き（例: `52342505_bldg_6697_op.gml`＝姫路城周辺 3 次メッシュ。
配布元: G空間情報センター「3D都市モデル（Project PLATEAU）姫路市」`28201_himeji-shi_city_2023_citygml_2_op/udx/bldg/`）、

```bash
docker compose --profile import run --rm tool import citygml --transform=swap-xy /data/bldg/52342505_bldg_6697_op.gml
# ローカル: citydb-tool-1.4.0/citydb import citygml -H localhost -d citydb -u citydb -p citydb --transform=swap-xy <file.gml>
```

- **`--transform=swap-xy` を必ず付ける**: PLATEAU の `gml:pos` は「緯度 経度 高さ」順で、そのままだと x=緯度 で入る。API は `feature.envelope` を見て軸順を自動判定するので付け忘れても表示はできるが、QGIS 等の他ツールのために揃えておく。
- 取込結果（この環境, 52342505 1 タイル）: Building 1,277 / WallSurface 5,004 / RoofSurface 2,456 / GroundSurface 509（LOD2 は 509 棟）、所要 4 秒。
- 3DCityDB v5 では属性は `citydb.property` の木（例: `height` → 子 `value`）に入る。`/api/buildings` はそれを辿って `height`, `storeysAboveGround`, `usage` を返す。

## STEP 8/9 — 3DCityDB MCP（Claude が読み取り専用 SQL）

```bash
pip install "3dcitydb-mcp-server==0.3.2" "mcp>=1.2,<2"     # 0.3.2 は mcp 1.x の API（2.x では起動しない）
cd infra/docker && cp .env.example .env                       # CITYDB_HOST/PORT/NAME/USER/PASSWORD/SCHEMA を .env から読む
3dcitydb-doctor                                               # 接続・PostGIS/SFCGAL・citydb スキーマ・CRS を診断
claude mcp add 3dcitydb -e CITYDB_HOST=localhost -e CITYDB_PORT=5432 -e CITYDB_NAME=citydb -e CITYDB_USER=citydb_reader -e CITYDB_PASSWORD=citydb_reader -e CITYDB_SCHEMA=citydb -- 3dcitydb-mcp
claude mcp list                                               # 3dcitydb: … ✓ Connected
```

- ユーザーは `citydb_reader`（SELECT のみ）。MCP 側でも `run_query` は SELECT / WITH 以外を拒否する（`INSERT` → "Only SELECT and WITH (CTE) queries are allowed." を確認済み）。
- ツール: `get_db_context_snapshot`（CRS・範囲・クラス別件数）、`scan_objectclasses`、`resolve_properties`、`get_examples`、`run_query` など 15 個。
- 例: 「姫路城から 500m 以内の建物を高さ順に」→ `citydb.feature` × `property(height/value)` × `ST_DWithin(envelope, ST_Transform(ST_SetSRID(ST_MakePoint(134.6915,34.838),4326),6697), 500)`。
- SSE 版（`docker compose up -d mcp`, :8080）はブラウザや他ホストから使う場合用。Claude Code には stdio 版を推奨。
- `3dcitydb-doctor` の結果（この環境）: Installation ✓ / PostgreSQL 16.13 ✓ / PostGIS 3.4 ✓ / SFCGAL 1.5.1 ✓（`cg_*` 関数は PostGIS 3.5 の名前なので 3.4 では警告。公式イメージは 3.5）/ 3DCityDB v5 schema ✓ / CRS EPSG:6697 ✓。

## Phase J — 性能（STEP 15）

- 索引: raw_points（GiST + timestamp + person/timestamp + source/timestamp）、mesh_stats（PK + time_bucket）、trajectories/stays（GiST + 時刻）。
- Materialized View: `mesh_stats_5min / 15min / hourly`（100m）。`SELECT mobility.refresh_mesh_stats_views();` で更新（初回以降は CONCURRENTLY）。
- API は常に時刻窓（`t`, `window`/`bucket`）で絞り、視野が狭いときは bbox を付ける。生点は `limit`（≤20,000）と `sample` で間引く。数十万点をそのまま返す経路は無い。
- 実測（この環境, synthetic 69,615 点）: `/api/mesh` 100m 5 分 6〜17ms、`/api/people/current` 20〜36ms、`/api/people/bbox` 30〜200ms、`/api/od` 23ms、`/api/trajectory` 当日 295 本 0.4s（2.5MB）、`/api/stays` 当日 2,889 点 0.09s、`/api/buildings` lod=1 1,277 棟 0.12s、lod=2 509 棟 0.58s（2.6MB）、MVT 1 タイル 1〜2KB。
- `compute_all_mesh_stats` 1 日分（15 組）約 10 秒。実データで点数が 100 倍になる場合は `raw_points` を日付パーティションにし、mesh_stats の再計算を日次バッチ（cron）にする。

## 実データを入れるとき（将来）

1. `raw_points` に `source_type='gps'|'beacon'|'sensor'…` で投入（person_hash は不可逆ハッシュ、accuracy を必ず入れる）。
2. `SELECT mobility.build_trajectories('gps'); SELECT mobility.detect_stays('gps'); SELECT mobility.build_od(60,'gps'); SELECT * FROM mobility.compute_all_mesh_stats(day0, day1, 'gps'); SELECT mobility.refresh_mesh_stats_views();`
3. `.env` の `API_DEFAULT_SOURCE=gps`、または画面の「データソース」で `gps` を選ぶ（API の `/api/health` が source ごとの期間・点数を返す）。
4. 3DCityDB には PLATEAU の他タイルや更新版を `citydb import` で追加（同じ objectid は `--import-mode=delete` で置換）。

## 検証ログ（この作業環境: Docker デーモン無し）

- PostgreSQL 16.13 + PostGIS 3.4.2 + SFCGAL 1.5.1（ローカル）に 3DCityDB v5.1.4 `create-db.sql`（SRID 6697）と mobility migrations 001〜005 を適用。
- synthetic 生成・投入、9 本のクエリ、API 全エンドポイント、`citydb-tool 1.4.0` での CityGML 取込、`3dcitydb-doctor`、`claude mcp add` → Connected、MCP `run_query` の読み取り／書き込み拒否を確認。
- ブラウザ（Playwright/Chromium）で DB モードの点・グリッド 100m→50m→点の LOD・ヒート・流線・軌跡・メッシュ詳細カード・3DCityDB 建物 LOD1/LOD2 を確認、JS エラー 0。
- `docker compose up` 自体は未実行（デーモン無し）。compose は公式イメージの環境変数仕様（`SRID`, `SRS_NAME`, `CHANGELOG`, `POSTGIS_SFCGAL`）に合わせて作成。

## トラブルシュート

| 症状 | 対処 |
| --- | --- |
| 画面が「API に接続できません」 | `curl localhost:8000/api/health`。`file://` で開いている場合は API の CORS（既定 `*`）と URL 欄を確認 |
| `/api/buildings` が空 | CityGML 未取込。`docker compose --profile import run --rm tool import citygml --transform=swap-xy …` |
| 建物が姫路から遠くに出る | swap-xy 無しで取り込んだ古い版。API は自動判定するが、`citydb delete -m delete` → 再取込を推奨 |
| `3dcitydb-mcp` が `AttributeError: 'Server' object has no attribute 'list_tools'` | `pip install "mcp>=1.2,<2"` |
| mesh_stats が空 | `compute_all_mesh_stats(day0, day1, src)` と `refresh_mesh_stats_views()` を実行（`load_synthetic.sh` 参照） |
