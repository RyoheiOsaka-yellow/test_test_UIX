# Orion Serving Floor — 元画像の忠実な HTML 複製

参考画像「ChatGPT Orion 7 · Serving Floor」を、球体格子を含めて HTML 化したもの。

- `index.html` — 単一ファイル。ブラウザで直接開ける。外部依存は Google Fonts（Space Mono / IBM Plex Mono）と cdnjs の Three.js r128 のみ
- `preview.png` — デスクトップ幅のスクリーンショット（修正前の 1 回目レンダ）

## 実装メモ

| 領域 | 実装 |
| --- | --- |
| 盤面 | 幅 1200px 固定の角丸フレーム。狭い画面では CSS transform で縮小表示（横スクロールなし） |
| ヘッダー / ステージバー / クルー 6 枚 | HTML + CSS。ゲージリングは SVG、棒グラフは flex |
| Orion Lattice（球体） | Three.js の TubeGeometry を 59 本（core winding / hoop / shard band / outflow）。ゆっくり回転し、Form 1/4 → 4/4（Wound column → Closed shell → Flattened oval → Open ring）を約 14 秒ごとに変形。ラベル・ストリップも連動 |
| 背景の掃引ストランド | Canvas 2D の大きな楕円弧（ティール / 淡青 / 淡灰） |
| Page table / Speculation / The knee | CSS グリッド、SVG ドーナツ、SVG 折れ線 |
| Stack trace | Canvas 2D の対角ストライプ + バースト + 停滞線 + 残差ライン |
| Recovery ledger / Routing table | HTML バー + Canvas スパークライン |

数値・文言は画像から書き起こし。判読できなかった箇所（例: knee の TARGET 値）は近い値を置いている。
時計は実時間、Tokens out はゆっくり増加。`prefers-reduced-motion` 時は静止画。
