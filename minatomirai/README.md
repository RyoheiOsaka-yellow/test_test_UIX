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

## 座標系・階層

- 原点: みなとみらい駅（EPSG:6677 で E −18292.7, N −60134.6）。three.js では x=東, y=標高, z=南。
- 対象範囲: 原点から 西 1.3 km／東 1.5 km／南 1.35 km／北 1.2 km（横浜駅東口〜新高島〜みなとみらい〜桜木町〜新港・赤レンガ〜馬車道・北仲）。
- 階層高さ（フロア展開 ×1 のとき）: 2F +12 m, 1F +6.5 m, GL 0, B1 −6, B2 −12, B3 −18, B4 −24, B5 −30 m。

## 出典

- 3D都市モデル（Project PLATEAU）横浜市（2024年度）／国土交通省（CC BY 4.0 相当の PLATEAU 利用規約）
- © OpenStreetMap contributors（ODbL）
- 地理院タイル 標高タイル DEM5A／国土地理院
