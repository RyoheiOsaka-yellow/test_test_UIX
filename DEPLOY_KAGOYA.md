# COMPASS HOUSE サイト — KAGOYA 共用サーバー 公開手順

現行サイト（compasshouse.jp）と同じ KAGOYA のサーバー（cp.kagoya.net）に上書き公開する前提の手順です。

## 1. 事前準備（コントロールパネル cp.kagoya.net）
1. **PHP バージョン**: PHP 8.x を有効にする（`contact.php` は PHP 8 で動作確認済み）
2. **メールアドレス**: `info@compasshouse.jp` がサーバー上に存在することを確認（無ければ作成）
   - `contact.php` はこのアドレスを送信元(From)兼受信先にしている（変更は `contact.php` 冒頭の定数）
3. **SSL**: 独自ドメインに SSL が設定済みであることを確認（`.htaccess` が https へ自動リダイレクトする）
4. **バックアップ**: 現行サイトの公開ディレクトリを丸ごとダウンロードして保管する

## 2. ファイル配置
- `compasshouse/` フォルダの中身を、compasshouse.jp の公開ディレクトリ直下にアップロードする
  （`index.html` / `app.js` / `style.css` / `.htaccess` / `contact.php` / `sitemap.xml` / `robots.txt` / `images/` / `docs/`）
- `.htaccess` は隠しファイル。FTP クライアントで「隠しファイルを表示」にして上書きされたことを確認する
  （現行サイトに `.htaccess` がある場合は事前に内容を退避しておく）
- **現行サイトの以下は削除しない**（新サイトの初回利用ガイドからリンクしている既存の申込フォーム）
  - `rental-form/`  `rental-form_e-bike/`  `rental-form_mtb/`
  - `assets/`  `bower_components/`（上記フォームページが参照している CSS 等）
- それ以外の旧ファイル（旧 `index.html`、`summer/`、`winter/`、`policy/` 等）は削除して問題ない
  （`.htaccess` で旧URL → 新URL の 301 リダイレクトを設定済み）

## 3. 公開後の確認
- `https://compasshouse.jp/tour` など各ページに直接アクセスできる
- 旧URL `https://compasshouse.jp/summer/` → `/season`（グリーン）、`/winter/` → `/season`（ウィンター）、`/policy/` → `/policy` に転送される
- `https://compasshouse.jp/#/tour` のような旧ハッシュURLでも `/tour` に自動で置き換わる
- 初回利用ガイドの「E-BIKE / ペダルバイク / スキー・スノーボード」リンク先（既存フォーム）が開く
- お問い合わせフォームからテスト送信し、`info@compasshouse.jp` への通知と送信者への自動返信が届く
- Google Search Console で `https://compasshouse.jp/sitemap.xml` を送信（旧 sitemap は上書きされる）

## 4. 運用メモ
- 画像は WebP 形式（`images/`）。追加する場合は 1600px 幅程度の WebP を推奨
- `app.js` の `TOURS_GREEN` / `TOURS_WINTER` / `GEAR` / `EVENTS` / `OFFICES` を編集すると各一覧が更新される
- ウィンター料金表 PDF は `docs/winter_2024.pdf`（現行サイトから取り込み済み）。差し替え時は同名で上書き
