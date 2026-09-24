# 加須工場 3Dモデル 途中経過報告（提案元：ワールド化成）

ワールド化成の加須工場3Dモデル（FLOW LAB 3D：敷地・建屋・工場内部の設備・配管）を主役に、実測データによる動線分析（FLOW LAB 6.0：分析一覧・実測再生・移設シミュレーション）を付けた資料。HTMLは画像を埋め込んだ単一ファイルなので、そのままブラウザーで開けます（フォントのみGoogle Fontsから取得、未接続時は標準フォント）。

| ファイル | 内容 |
| --- | --- |
| `FLOW_LAB_3D_model_6p.html` / `.pdf` | 6ページ版（A4横。1〜4ページ＝3Dモデル、5〜6ページ＝動線分析と次の一手） |
| `FLOW_LAB_3D_model_detail.html` / `.pdf` | 詳細版（第1部 3Dモデル／第2部 動線分析／第3部 これから。PDFはA4縦） |

## データご提供のお願い（生産量推計用）

`data-request/生産量推計_データご提供のお願い.xlsx` — クライアントに記入いただくシート（⓪ご提供済みデータ、①ロット実績〜⑦位置ログID）。`data-request/make_request_sheet.py` で再生成できます（③の設備は3Dモデルの想定、⑦のIDは位置ログから入れています）。

## 構成

| パス | 内容 |
| --- | --- |
| `src/model6.template.html` | 6ページ版の本文・スタイル・スクリプト。画像は `{{IMG:名前}}` で参照 |
| `src/modeldetail.template.html` | 詳細版のテンプレート |
| `src/build.py` | 画像（WebP）・コールアウト座標・居場所タイムラインを埋め込んでHTMLを出力 |
| `src/img/` | スクリーンショット（WebP）と寸法 `sizes.json` |
| `src/capture/` | 画面取得・試算に使ったPlaywrightスクリプト、切り出しスクリプト、コールアウト座標、8/4の居場所データ |

## 再ビルド

```sh
python3 src/build.py                 # HTML 2種
SP=/path/to/work NODE_PATH=$(npm root -g) node src/capture/render.js pdf   # PDF 2種（Chromiumで印刷）
```

PDFはChromiumの印刷（`page.pdf`、`preferCSSPageSize`）で出力し、PyMuPDFで画像を再圧縮しています。Chromiumは印刷時のメディアクエリを約842px幅で評価するため、6ページ版は `@media print` で横長レイアウトを明示しています。PDFはPyMuPDFで画像を再圧縮しています。

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
python3 src/capture/process3.py /path/to/work   # 動線分析画面の切り出し
SP=/path/to/work NODE_PATH=$(npm root -g) node src/capture/leg_final_site.js  # 3Dモデル：敷地・外観・BIM・稼働再生
SP=/path/to/work NODE_PATH=$(npm root -g) node src/capture/leg_final_int.js   # 3Dモデル：建屋内部・設備・MEP
python3 src/capture/process4.py /path/to/work   # 3Dモデル画面の切り出し
```
