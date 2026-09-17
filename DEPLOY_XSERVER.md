# COMPASS HOUSE サイト — Xserver 公開手順

## 1. ファイル配置
- `compasshouse/` フォルダの中身をすべて、対象ドメインの `public_html/` 直下にアップロードする
  （`index.html` / `app.js` / `style.css` / `.htaccess` / `contact.php` / `sitemap.xml` / `robots.txt` / `images/` / `docs/`）
- `.htaccess` は隠しファイルのため、FTPクライアントで「隠しファイルを表示」にしてアップロード漏れがないか確認する

## 2. サーバーパネルでの設定
1. **PHP バージョン**: PHP 8.x を選択（`contact.php` は PHP 8 で動作確認済み）
2. **SSL**: 無料独自SSL を設定（`.htaccess` が https へ自動リダイレクトする）
3. **メールアカウント**: `info@compasshouse.jp` を Xserver 上に作成しておく
   - `contact.php` はこのアドレスを送信元(From)兼受信先にしている（変更する場合は `contact.php` 冒頭の定数を編集）
   - 送信先を追加したい場合は `CONTACT_TO` をカンマ区切りで指定
4. **DNS**: 現在ドメインは Kagoya（cp.kagoya.net）管理。A レコード（または NS）を Xserver に切り替える
   - 切替前に Xserver 側でメールアカウントを作成し、MX も Xserver に向ける（フォーム通知メールを受け取るため）

## 3. 公開後の確認
- `https://compasshouse.jp/tour` など各ページに直接アクセスできる（`.htaccess` の振り分け）
- `https://compasshouse.jp/#/tour` のような旧URLでも `/tour` に自動で置き換わる
- お問い合わせフォームからテスト送信し、`info@compasshouse.jp` への通知と送信者への自動返信が届く
- Google Search Console にプロパティを登録し、`https://compasshouse.jp/sitemap.xml` を送信

## 4. 運用メモ
- 画像は WebP 形式（`images/`）。追加する場合は 1600px 幅程度の WebP を推奨
- `app.js` の `TOURS_GREEN` / `TOURS_WINTER` / `GEAR` / `EVENTS` / `OFFICES` を編集すると各一覧が更新される
- `index.html` を更新した場合はブラウザキャッシュが残らないよう `.htaccess` で HTML/CSS/JS は常に再検証する設定にしてある
