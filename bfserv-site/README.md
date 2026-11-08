# BFSERV corporate site

バイシクルフィールドサービス株式会社（bfserv.co.jp）リニューアルサイト。静的HTML／CSS／Vanilla JS、ビルド依存なし。

- 設計資料: [`../docs/DESIGN_SPEC.md`](../docs/DESIGN_SPEC.md)
- ページ本文: `_src/pages/**` ／ 共通パーツ: `_src/partials/`
- 再生成: `python3 build.py`（標準ライブラリのみ）
- ローカル確認: `python3 -m http.server 8080` → http://localhost:8080/

公開時は `_src/` と `build.py` を除く本ディレクトリをドキュメントルートに配置してください。
