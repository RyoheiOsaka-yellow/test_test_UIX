# 静岡沿岸 水深マップ（プロトタイプ）

静岡県の航空レーザ測深（ALB）0.5 m DEM を [dem2tiles](https://github.com/shiwaku/dem2tiles) で
タイル化した標高タイル（Terrarium）を使う、単体 HTML の地図アプリ。

`index.html` をブラウザで開くだけで動く（ライブラリは CDN、タイルは公開配信元から取得）。

## できること

| 機能 | 説明 |
| --- | --- |
| 段彩 | 水深の色分け。海底 −15〜0 / −30〜0 / 陸海 −15〜+30 / 浅場 −5〜0（0.5 m 刻み）の 4 レンジ |
| 陰影起伏 | 護岸・航路・砂堆の起伏を強調 |
| 等深線・等高線 | z15 以上で 1 m 間隔、5 m ごとに太線（maplibre-contour でクライアント生成） |
| 3D 地形 | 起伏 1〜8 倍。右ドラッグで視点を傾ける |
| 喫水チェック | 指定した喫水（+ 余裕）より浅い海域を赤で示す |
| 断面 | 地図上に線を引くと水深プロファイルを描く。距離・最深・最浅・平均、喫水未満の割合 |
| 水深の読み取り | カーソル位置の水深 / 標高（Terrarium タイルをブラウザで復号） |
| 地点ジャンプ | 御前崎港、相良港、大井川河口、焼津港、用宗港、清水港、天竜川河口、浜名湖 今切口 |
| 背景地図 | 地理院タイル 淡色 / 標準 / 写真 / なし |

表示状態は URL のハッシュに入るので、そのまま共有できる。

## データ

- 標高: 静岡県「[VIRTUAL SHIZUOKA 静岡県 中西部沿岸 点群データ](https://www.geospatial.jp/ckan/dataset/shizuoka-2025-pointcloud-alb)」
  ALB グリッドデータ（CC BY 4.0 / ODbL）。dem2tiles の Terrarium 出力（512 px、z5–17）
- 配信元: `https://shi-works.com/raster-tiles/pref-shizuoka/shizuoka-alb-terrarium/{z}/{x}/{y}.png`
  （dem2tiles 作者が公開している同データ）
- 背景: 国土地理院 地理院タイル

## 自分で作ったタイルで動かす

dem2tiles の出力ディレクトリを `/tiles/shizuoka-alb-terrarium` として配信し、`?tiles=` で差し替える。

```bash
mkdir -p serve/tiles && ln -s /path/to/output/terrarium serve/tiles/shizuoka-alb-terrarium
cp index.html serve/ && cd serve && python3 -m http.server 8765
# http://127.0.0.1:8765/index.html?tiles=/tiles
```

## 既知の制約

- Terrain-RGB / Terrarium は「値なし」を表せないため、データの無い場所は 0 m（FILL）になっている。
  段彩は 0 m を透明にして隠しているが、3D 地形ではデータ縁が壁になる。
- 喫水チェックは静的な DEM の水深で、潮位・波浪・底質は考慮していない。航行判断には使わないこと。
- 等高線のラベルは MapLibre のデモ用フォントサーバーに依存している。
