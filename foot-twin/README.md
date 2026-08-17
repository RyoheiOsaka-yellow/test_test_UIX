# FOOT TWIN — Phase 0 コンセプトデモ

株式会社ファーストワン（オーダーメイドインソール「BestPosition」）向け。
約6万人分の足部3D計測データを店頭・設計・資産化のいずれにも使える
正規化3Dビューア基盤に載せる提案の、合成データによる実装デモ。

**成果物は `dist/foot_twin_v0.html` の1ファイルのみ。**
`file://` で開けば動く。外部ファイル参照・CDN 参照はゼロ。

## 文書

| ファイル | 内容 |
|---|---|
| `SPEC.md` | 唯一の正。仕様の変更はまず本書を改訂する |
| `CLAUDE.md` | 作業手順・検証儀式・既知の落とし穴 |
| `ref/insole_bestposition.md` | 実物インソールの観察メモ（L9 の形状要件の根拠） |
| `ref/proposal_firstone.html` | 元の提案書 |

## ビルドと検証

```bash
python3 build.py     # src/ → dist/foot_twin_v0.html
python3 verify.py    # ヘッドレス描画 + ピクセル検証 + 受け入れ基準の数値検証
```

`verify.py` は Playwright と numpy / Pillow を使う。
スクリーンショットは `shots/`（コミット対象外）に出る。
`tests.js` は `verify.py` がページ内で実行する受け入れ基準の検証コード。

## Phase 0 でやっていないこと

- 実スキャナからの取り込み（`rasterizeToGrid()` は Phase 1）
- インソール形状の製造用CAD出力。`L9_insole` は**接客説明用の可視化のみ**
- 機械学習による予測。タイムラインの 2026 年より先は
  **パラメトリックな外挿**であり、画面上でもそう明示している
