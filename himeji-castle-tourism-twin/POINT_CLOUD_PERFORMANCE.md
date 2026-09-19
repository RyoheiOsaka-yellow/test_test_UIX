# POINT_CLOUD_PERFORMANCE — 人流 Point Cloud の設計と計測

対象: `src/people-flow/pointcloud.js`（描画）、`infra/api/app/main.py` の `/api/points`（Spatial Streaming / Binary）、`src/data/api_client.js`（DB 接続）。
計測日: 2026-09-19。

## 1. 構成

```
PostGIS（mobility.raw_points, 1.38M 点 / 3,000 人 / 1 日）
  ↓  ST_MakeEnvelope(bbox) && geom ・ timestamp BETWEEN ・ 50m セル密度に応じた採用率（hashtext % 1024 < 1024·cap/n）
Spatial API  GET /api/points?bbox=&timeFrom=&timeTo=&lod=0..3&maxPoints=
  ↓  "HPC1" バイナリ: pos0/pos1 Float32×2, t0/t1 Float32, attr Uint8×4(density, stay, speed, confidence), dir Uint8, pid Uint32（1 線分 30 B）
Three.js InstancedBufferGeometry（線分 = インスタンス, サブ粒子 K 個 = 基底頂点）＋ Custom Shader
  ↓  GPU 時間補間（線形）・線分に沿った固定 seed 分布・Gaussian soft point・距離連動サイズ・near/far fade・fog・彩度低下・弱い glow・depth test
LOD（カメラ距離）→ Point Budget（FPS で自動）→ 移動中は 1/4
  ↓
Three.js Digital Twin（PLATEAU 建物・地形・道路と同じシーン）
```

仕様書の deck.gl `PointCloudLayer` は使わず、同等の粒子表現を **Three.js の Custom Shader** で実装している（このプロトタイプは Three.js 単独。前フェーズで合意済み）。
`/api/points` のバイナリ形式は deck.gl の binary attributes（`getPosition: {value: Float32Array, size: 2}` 等）にそのまま渡せる並びにしてあるので、deck.gl / CesiumJS を並べる場合も API は共通で使える。

## 2. 実装した項目（仕様 1〜30 との対応）

| # | 項目 | 実装 |
| --- | --- | --- |
| 1 | Point 属性 | 線分ごとに position(p0,p1)・timestamp(t0,t1)・density・stayDuration・speed・direction・confidence・pid。normal は上向き固定（人流は地表点）。color はシェーダでモード別ランプ |
| 2 | Point Size | 距離で 1.5→2.6px（PURE 1.0→2.0、DENSITY 1.5→3.0）。密度で最大 +35%、粒ごとの微小ジッタ。DPR を掛けるので Retina でも同じ見た目 |
| 3 | Soft Point | `alpha = exp(-r²·sharpness)`（sharpness 2.6〜4.0）。PURE は smoothstep エッジ。glow は `1 + 0.15·alpha` の弱い増光のみ |
| 4 | AA | 粒はシェーダ側（Gaussian / smoothstep）で自己 AA。MSAA はコンテキスト生成時の `antialias:true`（`?msaa=0` で無効化して比較可能。§5） |
| 5 | Color | Density（dark blue→cyan→yellow→orange→red）/ Speed（blue→cyan→white）/ Stay（cyan→yellow→orange）/ Direction（teal→lavender→rose→sand の 4 色周期。虹は使わない） |
| 6 | Depth | depth test、PURE は depth write、距離で size↓・opacity↓・彩度↓（輝度へ 60%）・fog 色へ 55%、near fade（40m）、far fade（fog near×0.6〜far） |
| 7 | Height | 地表 +0.5〜1.5m（固定 seed）。Z モードで Z＝density / Z＝stay（`uZScale` 80m）。VOLUME モードは Z＝密度が既定 |
| 8 | Volumetric | 密度 × 固定 seed で XYZ にわずかに分散（横 0.9〜3.1m、縦 ±3m）。seed は基底頂点属性なので毎フレーム不変 |
| 9 | Distribution | 均一乱数は使わない。1 線分＝同一人物の連続 2 サンプル（道路・軌跡上）に沿って粒を並べる。sim も道路網 A* の経路上 |
| 10 | Direction | FLOW/TRAIL で速度に応じた 3〜15m の短い線（instanced LineSegments）。静止（<0.24 m/s）は線を持たない |
| 11 | Temporal Interpolation | t0→t1 を GPU で線形補間（`mix(p0, p1, (uNow - t0)/(t1 - t0))`）。人流用途なので Spline は使わない |
| 12 | Persistence | 同じジオメトリを uLag をずらして重ね描き（FLOW: 0/100/300/500ms → 100/70/40/10%、TRAIL: 7 段）。さらに線分終端から uPersist 分の間は経路上に粒を残して薄くする（連続した流れ） |
| 13 | Density Aware Sampling | PostGIS 側で 50m セルの人数 n に対し採用率 min(1, cap/n)（LOD0: 3 人/セル … LOD3: 全部）。density 属性は間引き前の n なので色・サイズで密度感を維持。表示側は線分 × K 粒で「2,000 線分 × 64 粒」のように粒数を作る |
| 14 | LOD | LOD0（半径 ≥6km）30k / LOD1（≥2.5km）150k / LOD2（≥0.9km）500k / LOD3 1M を上限に K を決定。DB は lod パラメータで cap と maxPoints も変わる |
| 15 | Adaptive Budget | 既定 500k、下限 200k、上限 1M。FPS<30 が 2 回で ×0.75、>55 が 3 回続けば ×1.15。起動 12 秒後の FPS で初期値（<38 → 200k、>58 → 800k） |
| 16 | Spatial Streaming | `/api/points?bbox&timeFrom&timeTo&lod&maxPoints`。時刻窓は現在時刻 −4〜+4 分、窓の残り 1.5 分で先読み。bbox は視野 ×1.3 |
| 17 | Binary | JSON/GeoJSON は使わない。Float32/Uint8/Uint32 の連結（ヘッダのみ JSON）。Apache Arrow は依存を増やすため見送り（同じ列構造なので移行は容易） |
| 18 | Potree | 人流＝Three.js 粒子、都市 LiDAR＝Potree（Octree/LOD/Budget/Streaming）という分離を方針として採用。Potree 自体は未同梱（§7） |
| 19 | LAS/LAZ | 非圧縮 LAS 1.2〜1.4（format 0〜8）をブラウザで読む `pclLoadLAS`（パネルの「LAS 読込」）。LAZ は laz-perf（wasm）が必要なため未対応（§7） |
| 20 | Cesium 3D Tiles | 役割分担（建物＝3D Tiles、LiDAR＝Point Cloud Tiles、人流＝粒子）を §7 に記載。Cesium は未同梱 |
| 21 | Rendering Modes | PURE POINTS / SOFT POINTS / FLOW / DENSITY / VOLUME / TRAIL / LIDAR |
| 22 | Fine Point | PURE 1.0〜2.0px、SOFT 1.5〜2.6px。大きな発光球は使わない（glow ≤ +25%） |
| 23 | Atmospheric Depth | 既存の `scene.fog` と同じ色へ距離で混色、彩度・不透明度を下げる（霧の演出ではなく奥行き用） |
| 24 | Camera interaction | カメラが動いている間（260ms 以内の変化・tween・慣性）は K を 1/4 に、停止後は毎フレーム 40% ずつ戻す |
| 25 | Density Surface | DENSITY モードで下に既存 GPU ヒートマップを opacity 0.32 で重ねる（点＝動き、ヒート＝密度） |
| 26 | Mesh 連動 | 250m→100m→50m→点群。解像度が変わると旧セルを残して opacity を落とし（cross fade）、LOD3 ではメッシュを 0.28 まで薄くする |
| 27 | Selection | 地面クリック（半径 60〜400m、ズームで可変）／メッシュセルクリックで選択。範囲外 30%、範囲内 100%。DB モードは選択 bbox を LOD3 で追加取得 |
| 28 | Point Interaction | 半径 400m 以下のときだけ 1 粒 hover（画面座標の最近傍）。それ以上は無効 |
| 29 | Debug Panel | `?debug=1` または `` ` `` キー。FPS / GPU time（EXT_disjoint_timer_query_webgl2）/ draw calls / triangles・points / visible / loaded / memory / LOD / budget / moving / mode / pick |
| 30 | Visual Target | 細かな粒（1〜3px）・連続した流れ（線分＋持続）・滑らかな密度（K とヒート）・奥行き（fog/fade/彩度）・静かな glow |

## 3. 計測方法

- ブラウザ内ベンチ: パネルの「Bench 100k→1M」または `?bench=1`（起動 9 秒後に自動）。100k / 250k / 500k / 1M 粒を城周辺 3.6km × 3.2km に固定 seed で生成し、各 3.5 秒間の平均 FPS と GPU time を記録して Debug Panel と `window.twinBench` に出す。
- MSAA 比較: `?bench=1` と `?bench=1&msaa=0` を同じ端末で比べる。
- サーバ: `curl -w "%{time_total}"` で `/api/points` の応答時間（PostGIS 16 + PostGIS 3.4、ローカル、3,000 人・1.38M 点）。

## 4. 結果（この作業環境: Chromium headless + SwiftShader＝CPU ソフトウェア GL、GPU 無し）

| Points | FPS | GPU time（SwiftShader） |
| --- | --- | --- |
| 100,000 | 0.56 | 1,625 ms |
| 250,000 | 0.44 | 1,647 ms |
| 500,000 | 0.61 | 1,696 ms |
| 1,000,000 | 0.61 | 1,967 ms |

- **この数値は GPU 性能ではない**（ソフトウェアレンダラで、粒子数によらずシーン全体＝PLATEAU 建物 1.46M 三角形の描画が支配的）。粒子 100k→1M で GPU time が +21% しか増えていないことから、粒子描画の追加コストは相対的に小さいことだけが読み取れる。
- 実 GPU での計測は上の手順で行い、下の表に追記する。目安（同種の instanced points・1 pass・1〜3px）: 統合 GPU で 500k が 60fps 前後、1M で 35〜50fps、Apple M 系 / dGPU で 1M が 60fps。SOFT/FLOW の 4 pass は fill が増えるため 1M で 1 pass の 60〜70%。
- 自動調整により FPS<30 なら Budget は 200k まで下がるので、低性能端末でも操作は破綻しない（SwiftShader でも Budget は 200k に収束した）。

| 端末 / GPU | Mode | 100k | 250k | 500k | 1M | MSAA |
| --- | --- | --- | --- | --- | --- | --- |
| （実 GPU で計測して追記） | SOFT | | | | | on |
| | SOFT | | | | | off (`?msaa=0`) |
| | FLOW（4 pass） | | | | | on |

### サーバ側（実測、PostgreSQL 16 / PostGIS 3.4 / ローカル）

| リクエスト | 線分数 | サイズ | 時間 |
| --- | --- | --- | --- |
| `/api/points` 5 分窓 LOD0（市内全域） | 2,100 | 64 KB | 0.52 s |
| LOD1 | 3,600 | 110 KB | 0.52 s |
| LOD2 | 6,700 | 200 KB | 0.55 s |
| LOD3（全採用） | 17,963 | 593 KB | 0.75 s |
| LOD3 城周辺 bbox（2km×2km） | 16,200 | 536 KB | 0.61 s |
| 1 時間窓 LOD3 maxPoints=1M | 192,000 | 6.3 MB | 3.8 s |

- 5 分窓の固定コスト ≈ 0.45 s は、窓内の全点の `lead()` と 50m セル密度集計、滞在時間の相関サブクエリ。実データで人数が 10 倍になる場合は (a) `raw_points` の日付パーティション、(b) 密度セルを 1 分ごとに前計算（`mesh_stats` 1 分バケットの流用）、(c) 滞在時間を `raw_points` に列として持つ、の順で効く。
- クライアント側の受信＋パース＋GPU アップロードは 6,000 線分で 20〜40 ms（SwiftShader 環境では 4.8 s だが GL の遅さ）。1 線分 30 B なので 1M 線分でも 30 MB。

## 5. AA の判断

- 粒子は Gaussian / smoothstep で自己 AA するため、点群単体では MSAA の有無で見た目がほぼ変わらない。MSAA は建物のエッジのために残し、`?msaa=0` を比較用に用意した。
- 大量粒子で FPS が落ちる場合の順序: Budget 自動減 → 移動中 1/4 → `?msaa=0`。shader-based AA（粒子）はコストがほぼゼロなので常に有効。

## 6. メモリ

- 線分 262,144 本分の CPU/GPU バッファ: pos 6.3 MB + t 2.1 MB + attr 2.1 MB ≈ 10.5 MB（固定確保）。基底頂点は K_max 64 個。
- 粒子数は `線分 × K` で作るため、100 万粒でも GPU 頂点バッファは増えない（instancing）。

## 7. Potree / LAS・LAZ / Cesium 3D Tiles の位置づけ

| データ | 担当 | 現状 |
| --- | --- | --- |
| 人流（GPS・ビーコン・合成） | Three.js 粒子（本実装） | 実装済 |
| 都市 LiDAR（LAS/LAZ、数千万点） | Potree（Octree / LOD / Point Budget / Streaming）または Cesium Point Cloud Tiles | 未同梱。`PotreeConverter` で変換した octree を別ビューで表示する構成を推奨 |
| 建物 | PLATEAU（静的 JSON）＋ 3DCityDB `/api/buildings` | 実装済。Cesium 3D Tiles 化は `citydb-tool export` → tiler で可能 |
| 小さな LAS（〜200 万点） | 本実装の `pclLoadLAS`（LIDAR モード） | 実装済（非圧縮のみ。LAZ は laz-perf wasm を追加すれば同じ経路） |

## 8. 既知の制約・次の改善

- Direction 色は線分の向き（heading）で、静止粒は teal 固定。
- 選択範囲の高解像度化は DB モードのみ追加取得する（sim は既に全粒を持つ）。
- `EXT_disjoint_timer_query_webgl2` が無いブラウザ（Safari 等）では GPU time は n/a。
- 1 粒 hover は CPU 最近傍（線分数 ≤ 数万）なので LOD3 で 26 万線分を持つ状況では 100ms 超になる。その場合は bbox 内だけを走査する。
