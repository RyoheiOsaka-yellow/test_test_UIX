# みなとみらい 立体地図 3D

新宿駅「構内図 3D」（屋内地図オープンデータ版）の みなとみらい版。
みなとみらいには国交省の屋内地図オープンデータが存在しないため、**PLATEAU の実測 3D 都市モデル**を骨格に、
OSM の多層歩行者ネットワークと、公開情報に基づく駅構内の近似モデルを組み合わせている。

完成物: `dist/index.html`（単一ファイル、約 5.6 MB。データは gzip + base64 で埋め込み。モダンブラウザで開くだけで動く）

## 画面でできること

| 機能 | 内容 |
| --- | --- |
| 建物 | PLATEAU 横浜市 2024 の建築物モデル。LOD3 がある建物（横浜税関・市役所など）は LOD3、それ以外は LOD2（屋根形状つき実形状）。約 7,600 棟。ホバーで名称・高さ |
| デッキ・橋梁 | PLATEAU 橋梁モデル。みなとみらいのペデストリアンデッキ 3 本は LOD3（手すり・階段まで） |
| 道路面 | PLATEAU 交通（道路）モデル LOD1 の面データ |
| 地形・水面 | 地理院 DEM5A（10 m 格子）＋ OSM 海岸線・水域ポリゴン |
| 鉄道 | OSM 鉄道線形。みなとみらい線（地下）、根岸線（高架）、東海道線・横須賀線・京急・相鉄・ブルーライン・高島線（貨物）を路線色で |
| 歩行者ネットワーク | OSM の歩道・階段・エスカレーター・エレベーター・デッキ・地下通路を 階層（2F/1F/GL/B1〜B5）付きグラフ化（約 9,400 ノード / 10,400 リンク） |
| 駅構内（近似） | みなとみらい駅（島式 B4 ホーム／B3・B2 改札／地上までの吹抜け）、新高島駅（相対式 B5 ホーム／B2 改札）、馬車道駅（島式 B3／B2 改札）、桜木町駅（JR 高架ホーム・ブルーライン B2）、高島町駅、横浜駅（地平ホーム形状のみ）。**公開情報からの近似モデルであり実測データではない** |
| フロア展開 | 階層の高さを 0〜3 倍に伸縮（図面モードでは 0） |
| 人流シミュレーション | 歩行者ネットワーク上を粒子が流れる（朝/昼/夕/夜） |
| 経路検索 | ネットワーク上の 2 点間を Dijkstra 探索。段差回避（階段・エスカレーターを回避し EV・スロープ優先） |
| 図面モード | 真上からの正射投影 |
| 表示スタイル | 白図面（既定）／線画（暗背景）／夜景（窓明かり）。線の太さスライダー |
| 表現モード | 線画（隠線処理＋2段階の輪郭線＋ハッチング）／点描（単色・高さ色・大小点）／ボクセル |
| 分解・組立 | 放射・高さ順・格子・組立の 4 種。スライダー／アニメーション／「街を作り直す」 |
| 断面カット | 水平クリッピング＋ステンシルによる切り口キャップ |
| 建物選択・階分解 | 建物をクリック → 階高 3.6m でフロアにスライスし、スライダーで階ごとに分解。右パネルに高さ・推定階数・テナント一覧 |
| テナント・店舗 | OSM の名前つき店舗・施設 POI（約 1,800 件、うち階層つき約 320 件）を建物に割り当て。階分解時はフロアに名札表示 |
| 書き出し | PNG 保存／WebM 録画（分解・組立アニメの記録用） |

## ディレクトリ

```
minatomirai/
  src/index.html      画面テンプレート（CSS / パネル）
  src/main.js         three.js アプリ本体
  tools/fetch_plateau.py   PLATEAU 3D Tiles / MVT の必要タイルだけ取得
  tools/decode_b3dm.js     b3dm (CESIUM_RTC + Draco) をデコードして JSON 化
  tools/fetch_osm.py       OSM map API から生データ取得
  tools/build_data.py      上記＋地理院 DEM を統合し data/minatomirai.pack を生成
  tools/build.mjs          esbuild でバンドルし dist/index.html を生成
  tools/screenshot.mjs     ヘッドレス Chromium で描画確認・スクリーンショット
  data/minatomirai.pack    生成済みデータパック（gzip バイナリコンテナ）
  dist/index.html          完成物
```

## 再生成手順

```bash
cd minatomirai
npm install
pip install pyproj shapely numpy pillow mapbox-vector-tile
npm install --no-save draco3d            # decode_b3dm.js 用

export MM_WORK=/tmp/mm                   # 中間ファイル置き場（数百 MB）
python3 tools/fetch_plateau.py
node tools/decode_b3dm.js $MM_WORK/nishi_lod3 $MM_WORK/naka_lod3 --out $MM_WORK/dec_lod3.json
node tools/decode_b3dm.js $MM_WORK/brid_lod2 --out $MM_WORK/dec_brid2.json
node tools/decode_b3dm.js $MM_WORK/brid_lod3 --out $MM_WORK/dec_brid3.json
python3 tools/fetch_osm.py
python3 tools/build_data.py              # -> data/minatomirai.pack
npm run build                            # -> dist/index.html
```

`build_data.py` は `dec_*.json` から範囲内の地物を選び、重心ごとの索引 (`idx_*.json`) を作りながら
座標を平面直角座標 IX 系（EPSG:6677、原点＝みなとみらい駅）へ変換し、頂点を 10 cm 単位で量子化・溶接して格納する。
標高は、建物最下点の楕円体高と DEM 標高の差の中央値からジオイド高を推定して揃えている。

## フロアガイド CSV（公式サイト取得＋手入力）

`tools/fetch_floorguide.py` が公式フロアガイド（MARK IS みなとみらい／ランドマークプラザ／クイーンズタワーA／
みなとみらい東急スクエア）から店舗一覧を取得して `data/floorguide.csv` を生成する（約 400 区画、source=official）。
MARK IS はフロアマップの区画番号を zone に持つので、番号順に区画が並ぶ。
区画の割り付けは「通路＋両側（交互配置）」「グリッド」「帯」から選択でき、区画クリックで詳細
（用途・階・区画番号・出典）を表示、左パネルの用途フィルタで飲食だけ等に絞り込める。
取得スクリプトの仕様はサイト構造に依存するため、サイト改修時は正規表現の調整が必要。

### 公式フロアマップの下敷き表示

`tools/make_underlays.py` が MARK IS・ランドマークプラザの公式フロアガイド PDF から階ごとのフロアマップを切り出し、
`data/underlays/*.jpg` と `data/underlays.json`（配置パラメータ）を生成する。ビルド時に画像を埋め込み、建物選択時に
各階の床面へ貼る。図面範囲（白背景中の描画部分）を自動検出して建物主軸に合わせ、アンカー地物（横浜美術館・
ランドマークタワー）の方向で 0°/180° を自動判定する。ずれは右パネル「下敷きの位置合わせ」の回転・拡縮・平行移動・
不透明度スライダーで直し、「underlays.json 保存」で書き出した JSON を `data/underlays.json` に置けば既定値になる。
断面カットと併用すると、該当階の平面図として確認できる。

### 名札の間引き・店舗詳細

名札は「自動間引き（画面上で重なるものを隠す。カーソルの階を優先）」「カーソルの階のみ」「すべて」「なし」を選べる。
区画クリックの詳細には、公式サイトの店舗ページ URL、営業時間（ランドマークプラザは店舗ごと、他は施設共通）、
電話番号、店舗公式サイトを表示する（`fetch_floorguide.py` が詳細ページから取得）。

### 手入力

`data/floorguide.csv` に「建物名, 階, 区画記号, テナント名, 用途, 幅比, 出典」を書くと、建物選択時に各階を
主軸方向の帯で区画分けして描画し、用途色（飲食／物販／サービス／オフィス／医療／公共／宿泊）で塗る。
画面右パネルの「この建物の CSV 雛形」で階数ぶんの空行入り CSV を書き出し、編集後に「CSV 読み込み」で即時反映できる
（ビルド不要）。`tools/make_floorguide_seed.py` は OSM の階層つき店舗 POI から雛形を生成する。

```
building,floor,zone,name,category,share,source
MARK IS minatomirai,4F,A,KAMAKURA,飲食,1,osm
MARK IS minatomirai,4F,B,HONOLULU COFFEE,飲食,1,osm
```

クイーンズスクエア横浜・ランドマークプラザ・MARK IS など、PLATEAU で複数部位に分かれる大型施設は
`MERGE_NAMES`（build_data.py）で 1 棟に統合している。

## テナント・区画データについて

- 区画（テナント境界ポリゴン）やフロア構成は PLATEAU にも OSM にも含まれないため、本ツールでは
  「建物の高さ ÷ 階高 3.6m」で階を推定し、OSM の `level` タグを持つ店舗 POI をその階に置いている。
- 大規模商業施設（MARK IS、ワールドポーターズ、コレットマーレ等）は OSM の登録が多く、フロア別に表示できる。
  オフィスビルは登録が少ない。区画まで正確に出すには、施設側のフロアガイド等を別途入力する必要がある。

## 座標系・階層

- 原点: みなとみらい駅（EPSG:6677 で E −18292.7, N −60134.6）。three.js では x=東, y=標高, z=南。
- 対象範囲: 原点から 西 1.3 km／東 1.5 km／南 1.35 km／北 1.2 km（横浜駅東口〜新高島〜みなとみらい〜桜木町〜新港・赤レンガ〜馬車道・北仲）。
- 階層高さ（フロア展開 ×1 のとき）: 2F +12 m, 1F +6.5 m, GL 0, B1 −6, B2 −12, B3 −18, B4 −24, B5 −30 m。

## 出典

- 3D都市モデル（Project PLATEAU）横浜市（2024年度）／国土交通省（CC BY 4.0 相当の PLATEAU 利用規約）
- © OpenStreetMap contributors（ODbL）
- 地理院タイル 標高タイル DEM5A／国土地理院
