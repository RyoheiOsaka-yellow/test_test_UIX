# 工場内シミュレーション 途中経過報告（提案元：ワールド化成）

ワールド化成の工場内シミュレーション（FLOW LAB 6.0 内部3D）について、仕組み・操作方法・検証結果・次のステップをまとめた資料。HTMLは画像を埋め込んだ単一ファイルなので、そのままブラウザーで開けます（フォントのみGoogle Fontsから取得、未接続時は標準フォント）。

| ファイル | 内容 |
| --- | --- |
| `FLOW_LAB_v6_simulation_6p.html` / `.pdf` | 6ページ版（A4横。PDFは6ページ） |
| `FLOW_LAB_v6_simulation_detail.html` / `.pdf` | 詳細版（仕組み・条件一覧・計算モデル・感度分析・次のステップ。PDFはA4縦） |

## 構成

| パス | 内容 |
| --- | --- |
| `src/sim6.template.html` | 6ページ版の本文・スタイル・スクリプト。画像は `{{IMG:名前}}` で参照 |
| `src/simdetail.template.html` | 詳細版のテンプレート |
| `src/build.py` | 画像（WebP）・コールアウト座標・居場所タイムラインを埋め込んでHTMLを出力 |
| `src/img/` | スクリーンショット（WebP）と寸法 `sizes.json` |
| `src/capture/` | 画面取得・試算に使ったPlaywrightスクリプト、切り出しスクリプト、コールアウト座標、8/4の居場所データ |

## 再ビルド

```sh
python3 src/build.py                 # HTML 2種
SP=/path/to/work NODE_PATH=$(npm root -g) node src/capture/render.js pdf   # PDF 2種（Chromiumで印刷）
```

PDFはChromiumの印刷（`page.pdf`、`preferCSSPageSize`）で出力し、PyMuPDFで画像を再圧縮しています。Chromiumは印刷時のメディアクエリを約842px幅で評価するため、6ページ版は `@media print` で横長レイアウトを明示しています。

## スクリーンショットを撮り直す場合

`src/capture/` のスクリプトは、元の `FLOW_LAB_Factory_v6_Internal_Simulation.html` を作業フォルダーに `app.html` として置き、環境変数 `SP` にそのフォルダーを指定して実行します（Playwright・Chromium・Pillowが必要）。

```sh
SP=/path/to/work NODE_PATH=$(npm root -g) node src/capture/capture.js   # 通常画面・パネル・分析一覧
SP=/path/to/work NODE_PATH=$(npm root -g) node src/capture/capture3.js  # 3Dの拡大ショット
SP=/path/to/work NODE_PATH=$(npm root -g) node src/capture/capture4.js  # 再生のコマ送り・移設前後・居場所データ
SP=/path/to/work NODE_PATH=$(npm root -g) node src/capture/capture5.js  # 10:04のコマ
SP=/path/to/work NODE_PATH=$(npm root -g) node src/capture/sens.js      # 感度分析の試算
python3 src/capture/process.py  /path/to/work   # 詳細版の切り出し
python3 src/capture/process2.py /path/to/work   # 手順ごとの切り抜き
python3 src/capture/process3.py /path/to/work   # シミュレーション画面の切り出し
```
