# AI_DECISION_LAYER — Jev AI Decision Layer（リアルタイム判断レイヤー）

姫路 人流 Digital Twin に「都市・人流状態を高速に評価し、表示・LOD・注目地点・異常状態を判断する」層を追加した。
Jev は **必須依存ではない**。`JEV_ENABLED=false`・未接続・timeout・rate limit・API key 無し・provider 障害のいずれでも、Local Rule Engine が同じ型で判断し Digital Twin は完全動作する。

```
PostGIS（mobility.mesh_stats / stays）
  ↓  Human Flow Aggregation（bbox × 時刻 × 5 分バケット、当日の全バケット平均・標準偏差）
Feature Engine  infra/api/app/ai/feature_engine.py   … 生 GPS / person_hash はここで落ちる（集約値・統計量・匿名メッシュのみ）
  ↓
Decision Engine infra/api/app/ai/decision_engine/     … index / types / jev_adapter / local_rule_engine / fallback / cache / telemetry
  ├ Jev Adapter（Choice / Score / Noul。1 request に複数 Question をまとめる。provider = mock | http）
  └ Local Rule Engine（同じ戻り値型）
  ↓  confidence 方針・hard safety rule（FPS<25 / memory）・decision cache（state hash, TTL 5 秒）・telemetry
Backend API  POST /api/ai/evaluate  GET /api/ai/status  GET /api/ai/attention  GET /api/ai/decisions
  ↓
Digital Twin State Manager  src/ai/ai_client.js   … USER > AI > DEFAULT、progressive refinement、イベント駆動
  ↓
Three.js Digital Twin（点群 / メッシュ / ヒート / 流線 …）
```

- ブラウザは Jev を直接呼ばない（Frontend → Backend API → Jev Adapter → Jev）。API Key はサーバ側 `.env` のみ。
- このプロトタイプの Backend は FastAPI（Python）なので、仕様の `src/ai/decision-engine/*.ts` は **同名構成の Python パッケージ**（`infra/api/app/ai/decision_engine/`）として実装した。Jev 固有コードは `jev_adapter.py` の中だけにある。フロント（`src/ai/ai_client.js`）は Jev を知らず、Backend API の判断結果（`source` 付き）だけを扱う。

## 1. 環境変数（`infra/docker/.env.example`）

| 変数 | 既定 | 意味 |
| --- | --- | --- |
| `JEV_ENABLED` | `false` | false なら Local Rule Engine のみ（完全動作） |
| `JEV_API_KEY` | 空 | サーバ側のみ。フロントへは出ない |
| `JEV_API_URL` | 空 | 正式 API のエンドポイント。Playground URL を本番として入れない |
| `JEV_PROVIDER` | `mock` | `mock`（Interface 検証用の決定論的モック）/ `http` |
| `JEV_MODEL` | `jev-latest` | |
| `JEV_TIMEOUT_MS` | `700` | 超過は fallback |
| `JEV_CONFIDENCE_THRESHOLD` | `0.65` | これ未満の Choice は UNKNOWN / Local |
| `JEV_CONFIDENCE_HIGH` / `JEV_CONFIDENCE_LOW` | `0.75` / `0.55` | ≥high: Jev 採用、low〜high: Jev と Local を比較、<low: Local 優先 |
| `JEV_CACHE_TTL_MS` | `5000` | decision cache |
| `JEV_ANOMALY_WATCH` / `WARNING` / `HIGH` | `0.5` / `0.7` / `0.85` | Noul 確率の段階 |
| `JEV_FPS_SAFETY` / `JEV_MEMORY_MB_MAX` | `25` / `1500` | hard safety rule |
| `JEV_TELEMETRY_LOG` | 空 | JSONL の出力先（個人 GPS は記録しない） |

## 2. Urban State（Jev へ渡す入力）

```json
{"timestamp":"2026-10-04T12:00:00+09:00",
 "camera":{"height":840,"moving":false},
 "rendering":{"fps":54,"visiblePoints":420000,"loadedPoints":680000,"memoryMb":230,"latencyMs":76},
 "area":{"meshCount":171,"peopleCount":3826,"avgDensity":0.11,"peakDensity":1.0},
 "mobility":{"avgSpeed":1.04,"avgStayMinutes":13.9,"inflow":3801,"outflow":3799,"movementRatio":0.51,"stayRatio":0.49},
 "history":{"buckets":152,"peopleAvg":2100,"peopleStd":610,"densityAvg":0.06,"speedAvg":1.1,"stayAvg":12,"inflowAvg":2080,"inflowStd":700,"outflowAvg":2080,"outflowStd":700},
 "analysis":{"mode":"point","userOverride":false}}
```

- DB モード: フロントは `bbox` と `t` だけを送り、Feature Engine が PostGIS（`mesh_stats_at` と当日の `mesh_stats`）から area / mobility / history と Attention 候補（people 上位 30 メッシュ＋各メッシュの当日平均・標準偏差）を作る。
- シミュレーションモード: フロントが 100m ビンで集約した値と候補（上位 30）を送る（エージェント個々の位置は送らない）。
- 個人情報の混入防止: `/api/ai/evaluate` は state のキーに person / hash / raw / device / trajectory を含むものを捨てる。

## 3. Question と Jev primitive

| Question | primitive | 値 | Local Rule |
| --- | --- | --- | --- |
| `congestion` | Choice | NORMAL / BUSY / CONGESTED / CRITICAL / UNKNOWN | 密度 0.40・速度 0.20・滞在 0.15・流入超過 0.10・履歴偏差 0.15 の重み付きスコア。confidence < 閾値は UNKNOWN |
| `congestionScore` | Score | 0〜4（非常に空いている〜極端な混雑）→ `congestionIndex` | 同スコアの段階化。人数そのものではない |
| `anomaly` | Noul | 0.0〜1.0（normal / watch / warning / high、閾値は config） | people / inflow / outflow / speed / stay / density の z-score の重み付き合成 `1 − exp(−Σ/1.6)` |
| `lod` | Choice | LOD0（250m）/ LOD1（100m）/ LOD2（50m）/ LOD3（点）/ LOD4（超高精細） | camera height → FPS<30 / moving / latency / memory で 1 段下げ。hard safety: FPS<25 は Jev 判断より優先 |
| `pointBudget` | Choice | 100k / 200k / 350k / 500k / 750k / 1M | LOD × FPS × moving |
| `visualization` | Choice | POINTS / HEATMAP / GRID / HEXAGON / FLOW / TRIPS / CONTOUR / VOLUME（＋ secondary） | 高さ・密度・movementRatio・stayRatio・FPS・analysis mode |
| `pointCloud` | Choice（複合） | trailQuality / softPointQuality / heatmapOverlay / pickable / finePoints | FPS・moving・height |
| `attention` | Score | 候補メッシュごとの attentionScore 0〜100 → Top 5 | 密度 0.32・z 0.22・速度低下 0.14・滞在増 0.12・流入急増 0.12・流出入不均衡 0.08 |

1 回の `/api/ai/evaluate` で上記をまとめて問い合わせる（Decision Bundle）。Jev には文章生成を要求しない。理由（Reason indicators）は `Density +32% / Speed −24%` のように **実データの変化率** から作る。

## 4. 判断の採用ルール

```
Jev confidence ≥ 0.75            → Jev 採用（alt に Local）
0.55 ≤ confidence < 0.75         → Jev と Local を比較。一致なら Jev（confidence +0.1）、不一致なら Local（alt に Jev）
confidence < 0.55 / 未接続 / 障害 → Local
hard safety（FPS < 25、memory 超過） → LOD / Budget を 1 段下げ、source = 'safety'
```

すべての判断に `source`（`jev` / `jev-mock` / `local` / `safety`）と `confidence` が付く。Dev モードでは A/B（Jev 判断 vs Local 判断）を表示・保存（`/api/ai/decisions`、telemetry JSON）できる。

## 5. フロント（`src/ai/ai_client.js`）

- **イベント駆動**: 初回・カメラ大移動（視野の 35%）・ズーム閾値（×1.35）・LOD 変化・時刻 5 分・選択範囲・FPS 帯（<25 / <30 / >55）・新しい人流データ読込・再生中 10 秒ごと。最小間隔 2.5 秒、Attention は 8 秒以上、カメラ移動中は評価しない。同じ状態は state hash で cache（サーバ 5 秒）。
- **優先順位 USER > AI > DEFAULT**: 表現チップや Point Cloud モード・Budget スライダーを手で触ると `userOverride` が立ち、AI は上書きしない。「AI に任せる」で戻す。
- **Adaptive LOD / Budget**: AI の LOD は点群の粒数上限として効き、Budget は 2 秒ごとに 1 段ずつ目標へ（progressive refinement）。カメラ移動中は即時 350k 以下へ。
- **Point Cloud AI Control**: trailQuality（LOW=持続なし・尾なし / MEDIUM / HIGH）、softPointQuality、heatmapOverlay、pickable を pointcloud.js のモード適用に反映。
- **Visualization Router**: カメラ停止時のみ、確信度 ≥ 0.6 で Primary（＋ Secondary=HEATMAP の下地）を切替。トーストで source と確信度を表示。
- **AI ATTENTION**: Top 5（順位・場所・種別・score・Reason indicators）。クリックでフォーカス（ユーザー操作が既定）。
- **AI FOLLOW**: OFF / ON（提案: 「High-priority flow detected」バナー、クリックで移動）/ AUTO（score ≥ 85、20 秒間隔、直近 5 秒に操作が無いときだけ `flyTo`）。
- **AI STATE**: Jev 状態（CONNECTED / MOCK / FALLBACK / DISABLED / OFFLINE）、Congestion、Score、Anomaly、LOD、Point Budget、Visualization、Confidence、寄与（density +10% …）。Dev で latency / requests / cache hits / fallbacks / A/B 表。
- **API が落ちている（OFFLINE）**: pointcloud.js のローカル LOD / Adaptive Budget に戻る。

## 6. 検証（この環境）

- Local Rule のみ（`JEV_ENABLED=false`）、mock provider、http provider の接続失敗（`JEV_API_URL` に到達不能 → 5 ms で fallback）の 3 通りで同じ Bundle 型を確認。
- `/api/ai/evaluate`（PostGIS Feature 付き）: 約 100 ms（warm）。Feature Engine 3 クエリ 112 ms。
- ブラウザ: シミュレーション／DB 両モードで AI STATE・AI ATTENTION・寄与の表示、ユーザー選択の優先、AUTO follow によるカメラ移動と選択、hard safety（SwiftShader で FPS≈1 → LOD0 / 100k, source=safety）を確認。約 70 秒の操作で AI リクエスト 17 回（イベント駆動）。

## 7. Jev 正式 API へ切り替えるとき

`jev_adapter.py` の `_build_request()` と `_transport()`（と応答パース `_parse()`）だけを Jev の正式仕様に合わせる。共通 Interface（`Decision` / `AttentionArea` / `DecisionBundle`）と Local Rule Engine、フロントは変更不要。`.env` に `JEV_ENABLED=true JEV_PROVIDER=http JEV_API_URL=… JEV_API_KEY=…` を設定する。

## 8. 制約・今後

- 履歴偏差は「当日の他バケット」との比較（データが 1 日分のため）。複数日が入れば「同曜日・同時刻の平均」に置き換える（`feature_engine.urban_features` の hist クエリのみ変更）。
- Secondary は HEATMAP のみ実装（CONTOUR はメッシュ表示と結合が必要）。
- Attention の「Inflow spike」は inflow の z-score が主。ゲート単位の流入は `transit_gate` 相当のテーブルが入ってから。
