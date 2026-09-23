# FLOW LAB 6.0 途中経過ガイド

FLOW LAB 6.0（工場動線プロトタイプ v6）の途中経過・操作方法・分かったことをまとめた資料。画像は埋め込み済みの単一HTMLなので、そのままブラウザーで開けます（フォントのみGoogle Fontsから取得、未接続時は標準フォント）。

- `FLOW_LAB_v6_guide.html` — **6ページ版**（A4横。印刷・PDF保存すると1ページ1枚）
- `FLOW_LAB_v6_guide_detail.html` — 詳しい版（計算ロジック・データ品質・v7引継ぎまで含む）

## 構成

| パス | 内容 |
| --- | --- |
| `FLOW_LAB_v6_guide.html` / `FLOW_LAB_v6_guide_detail.html` | 完成版（ビルド結果） |
| `src/guide.template.html` | 6ページ版の本文・スタイル・スクリプト。画像は `{{IMG:名前}}` で参照 |
| `src/guide_detail.template.html` | 詳しい版のテンプレート |
| `src/build.py` | 画像（WebP）とコールアウト座標を埋め込んで両方の完成版を出力 |
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
python3 src/capture/process.py /path/to/work                            # WebP化・切り出し（詳しい版）
python3 src/capture/process2.py /path/to/work                           # 手順ごとの切り抜き（6ページ版）
```
