# 姫路城 × 姫路市 観光動態デジタルツイン — 機能説明パッケージ（社内説明用）

対象：`index_-_2026-09-24T013249_969.html`（HIMEJI / 人流 Digital Twin — Precision Mesh）

| ファイル | 内容 |
|---|---|
| `姫路観光デジタルツイン_機能説明資料.docx` | 機能説明資料（Word）。機能ごとに「何が分かるか／開き方（操作導線）／画面の見方／説明のポイント」と画面キャプチャを掲載 |
| `姫路観光デジタルツイン_機能説明資料.pdf` | 上記の PDF 版（閲覧・配布用） |
| `姫路観光デジタルツイン_機能別スクリーンショット.zip` | 機能別フォルダのスクリーンショット集。`INDEX.html`（サムネイル一覧）と `INDEX.csv`（一覧表）付き |

- 画面上の数値はすべてダミーデータ／シナリオ推計です（実測値ではありません）。
- スクリーンショットの赤枠・番号は、操作箇所を示すために撮影時に重ねた注釈です。

## 再生成（HTML が更新された場合）

`tools/` に撮影・資料生成スクリプトを同梱しています（Node.js + Playwright + Python/Pillow）。

1. 対象 HTML を `tools/index.html` として配置し、`python3 tools/prepare_capture.py` で撮影用コピー（`index_cap.html`、表示内容は変更なし）と図版用フォントを作成
2. `tools/run_all.sh A B C D E F G P X X2 X3 X4 X5 X6 X7` でスクリーンショットを撮影（`tools/out/` に保存。X 系は見やすさ改善の撮り直しで、同じファイル名を上書き）。`run_all.sh` の `NODE_PATH` は Playwright のインストール先に合わせて変更
3. `node tools/diagram/shot.js` で画面遷移マップ（`diagram/navmap.png`）を作成
4. `cd tools/docgen && npm install && python3 prep.py && node build.js <出力.docx>` で Word を生成（本文は `docgen/content.js` で編集）
5. `python3 tools/package.py <出力.zip>` で ZIP を生成
