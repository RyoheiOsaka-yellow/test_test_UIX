# FLOW LAB 6.0 途中経過ガイド

`FLOW_LAB_v6_guide.html` — FLOW LAB 6.0（工場動線プロトタイプ v6）の途中経過・操作マニュアル・把握できることをまとめた資料。画像は埋め込み済みの単一HTMLなので、そのままブラウザーで開けます（フォントのみGoogle Fontsから取得、未接続時は標準フォント）。

## 構成

| パス | 内容 |
| --- | --- |
| `FLOW_LAB_v6_guide.html` | 完成版（ビルド結果） |
| `src/guide.template.html` | 本文・スタイル・スクリプト。画像は `{{IMG:名前}}` で参照 |
| `src/build.py` | 画像（WebP）とコールアウト座標を埋め込んで完成版を出力 |
| `src/img/` | スクリーンショット（WebP）と寸法 `sizes.json` |
| `src/capture/` | スクリーンショット取得・試算に使ったPlaywrightスクリプトとコールアウト座標 |

## 再ビルド

```sh
python3 src/build.py
```

## スクリーンショットを撮り直す場合

`src/capture/` のスクリプトは、元の `FLOW_LAB_Factory_v6_Internal_Simulation.html` を作業フォルダーに `app.html` として置き、環境変数 `SP` にそのフォルダーを指定して実行します（Playwright・Chromium・Pillowが必要）。

```sh
SP=/path/to/work NODE_PATH=$(npm root -g) node src/capture/capture.js   # 通常画面・パネル・分析一覧
SP=/path/to/work NODE_PATH=$(npm root -g) node src/capture/capture3.js  # 3Dの拡大ショット
SP=/path/to/work NODE_PATH=$(npm root -g) node src/capture/sens.js      # 5.3節の試算
python3 src/capture/process.py /path/to/work                            # WebP化・切り出し
```
