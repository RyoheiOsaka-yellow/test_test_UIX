# Harvest Floor — prototype

「AIエージェントが Web からデータを収集する」様子を、サービングフロア型ダッシュボード
（青写真調・等幅・大文字ラベル）でプロトタイプしたもの。単一 HTML、依存ライブラリなし。

- `index.html` — ブラウザで直接開ける完結ファイル（フォントのみ Google Fonts）
- `preview.png` — デスクトップ幅での全体スクリーンショット

## 構成（元ネタ → 画面）

| 元ネタ | 画面上の要素 |
| --- | --- |
| You tell the agent → it writes the code → collects → gives you the result | 上部の 6 ステージバー（ASK / PLAN / WRITE CODE / FETCH / PARSE / REPORT） |
| 例のプロンプト 2 本 | 「Ticket A / B」ボタン。クリックでシナリオ全体が切り替わる |
| Agent-Reach（X / YouTube / Reddit / GitHub のバンドル） | 青。クルーカード、ストランド、トレースの色 |
| Patchright Enhanced（ブラウザ経由・リクエスト傍受） | ティール。「Request Listener」パネルが傍受した XHR/JSON を表示 |
| Scrapling（汎用ページ抽出） | オレンジ。 |
| 収集の流れ | 中央の「Source Web」キャンバス：左のソースから中央のコアを通り、右端（The Edge）を越えたものが行になる |
| レート制限 | 「The Knee」折れ線：429 が出始める毎分リクエスト数 |
| 捨てた行 | 「Yield Ledger」：重複 / ブロック / 再取得 / 期限切れ |

数値はすべて例示（`example figures`）。ライト / ダーク両テーマ対応、スマホ幅でも横スクロールなし。
`prefers-reduced-motion` 時はアニメーションを止めて静止画で表示。
