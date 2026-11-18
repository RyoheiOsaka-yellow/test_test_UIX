# XANTALOS Space（試作）

工場の 3D モデルにログインして、アバターで歩き、チェックインし、チャットするための多人数版です。
クライアントは `../space.html`（`bash ../build.sh` で生成）、サーバーはこのフォルダです。

## できること

- **ログイン**：社員は Google アカウント（会社ドメイン）。他工場の方は、社員が発行した招待リンクから自分の Google アカウントでログインします。
- **アバター**：4 種類の体型と服の色を選べます。WASD かクリックで歩き、名札に在席状況と所属が出ます。
- **在席とチェックイン**：在席・集中・会議中・休憩・外出の状態と、チェックイン／アウト。社員は日別の出勤記録を CSV で取り出せます。
- **チャット**：Slack と同じ感覚のチャンネル、ダイレクトメッセージ、検索。
  - 場所のチャンネル：機械加工・組立ベイ・ソフト開発・設計・カフェ。その場所に入ると「いまここ」と表示されます。
  - 近くの人：半径 10 m・同じ階の人にだけ届き、頭上に吹き出しが出ます。履歴は残しません。
  - 設備スレッド：社員が設備をクリックすると、その設備専用のスレッドが開きます。
  - 工場間連携：社外の方が入れるのは「工場間連携」と、招待時に作られる「連携：〇〇工場」チャンネル、自分宛ての DM だけです。
- **Slack 連携（任意）**：指定したチャンネルを Slack と相互に転送します。

## 手元で試す

```bash
cd ota-factory && bash build.sh
```

```bash
cd ota-factory/space-server && npm install && npm start
```

`http://localhost:8080` を開きます。Google を設定していない間は「試作用ログイン」で表示名だけで入れます。
社外の方の動きを試すには、社員でログインして「社外の方を招待」でリンクを作り、別のブラウザで開きます。

```bash
cd ota-factory/space-server && npm test
```

## 設定（環境変数）

| 変数 | 内容 |
|---|---|
| `GOOGLE_CLIENT_ID` | Google Cloud で作る OAuth クライアント ID（種類はウェブアプリ）。設定すると試作用ログインは無効になります |
| `EMPLOYEE_DOMAINS` | 社員として扱うメールドメイン。カンマ区切り |
| `ADMIN_EMAILS` | ドメイン外でも社員として扱うメールアドレス。カンマ区切り |
| `PUBLIC_URL` | 招待リンクに使う公開 URL |
| `DATA_DIR` | データベースの保存先。既定は `space-server/data` |
| `DEV_LOGIN` | `1` で試作用ログインを強制的に有効化。本番では設定しないでください |
| `SLACK_BOT_TOKEN` / `SLACK_SIGNING_SECRET` / `SLACK_CHANNEL_MAP` | Slack 連携。マップは `all:C0123,partners:C0456` の形式 |

## Google ログインの準備

1. Google Cloud コンソールで「OAuth 同意画面」を作ります。社外の方も使うので、ユーザーの種類は「外部」にします。
2. 「認証情報」で OAuth クライアント ID（ウェブアプリ）を作り、「承認済みの JavaScript 生成元」に公開 URL を登録します。
3. クライアント ID を `GOOGLE_CLIENT_ID` に、会社のドメインを `EMPLOYEE_DOMAINS` に設定します。

## Slack 連携の準備

1. Slack アプリを作り、Bot のスコープに `chat:write`、`chat:write.customize`、`users:read`、`channels:history` を付けます。
2. Event Subscriptions を有効にし、Request URL を `https://<公開URL>/slack/events`、購読イベントを `message.channels` にします。
3. Bot を転送したい Slack チャンネルに招待し、`SLACK_CHANNEL_MAP` で Space のチャンネルと対応付けます。

## Google Cloud へのデプロイ

いまの保存先は 1 ファイルの SQLite なので、ディスクが残る **Compute Engine の小さな VM** に置くのが一番簡単です。

```bash
cd ota-factory && docker build -f space-server/Dockerfile -t xantalos-space .
```

```bash
docker run -d -p 8080:8080 -v /srv/xantalos:/data -e GOOGLE_CLIENT_ID=... -e EMPLOYEE_DOMAINS=... -e PUBLIC_URL=https://space.example.com xantalos-space
```

HTTPS は前段のロードバランサか Caddy などで終端します。WebSocket（`/ws`）を通す設定にしてください。
Cloud Run で動かす場合は、保存先を Cloud SQL か Firestore に替える必要があります。差し替えは `db.js` の中だけで済む作りにしています。

## 試作の制限

- 壁や設備との当たり判定はありません。床の範囲内なら通り抜けます。
- サーバーは 1 台構成です。数百人規模の同時接続や複数台構成は、次の段階で対応します。
- 社外の方にも工場モデルそのもの（設備や KPI のデータを含む HTML）が配信されます。社外向けには、KPI や原価を抜いた版を配る必要があります。
- Slack 置き換えに必要なスマホアプリ、プッシュ通知、ファイル共有、スレッド返信、リアクションはまだありません。
