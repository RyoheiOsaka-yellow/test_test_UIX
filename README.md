# Digital Dock v12

船舶デジタルツイン基盤。PostgreSQL を単一の正とするイベントソーシング +
ブランチ/バージョン管理、不変の派生解析結果(Hydrostatics L0)、MCP サーバー、
Three.js による 3D UI で構成されたモノレポです。

## 構成

| パッケージ | 役割 |
|---|---|
| `packages/shared` | ドメイン型、流体静力学 L0 エンジン(オフセットテーブル + シンプソン積分)、パラメトリック船型生成 |
| `apps/api` | Fastify + PostgreSQL。認可状態(8テーブル)、トランザクションサービス、hydro 派生結果 |
| `apps/mcp` | MCP サーバー(stdio)。7ツールで船体モデルを操作 |
| `apps/web` | Vite + React + Three.js。3D 船体ビューア + 編集 UI |

## セットアップ

前提: Node.js 22+, PostgreSQL 16+

```bash
# DB(初回のみ)
sudo -u postgres psql -c "CREATE USER dock WITH PASSWORD 'dock' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE digitaldock OWNER dock;"
sudo -u postgres psql -c "CREATE DATABASE digitaldock_test OWNER dock;"  # テスト用

npm install
npm run build

npm run migrate   # スキーマ適用
npm run seed      # デモ船 MV Aurora を投入

npm run dev:api   # http://localhost:8787
npm run dev:web   # http://localhost:5173
```

環境変数: `DATABASE_URL`(既定 `postgres://dock:dock@127.0.0.1:5432/digitaldock`)、
API ポート `PORT`、Web 側 `VITE_API_URL`、MCP 側 `DOCK_API_URL`。

## テスト

```bash
npm test                 # shared + api
npm test -w apps/mcp     # MCP 統合テスト(要 digitaldock_test)
```

- `packages/shared` — 解析解(箱型バージ / V 型プリズム)との厳密照合 16 件
- `apps/api` — PostgreSQL 統合テスト 16 件(下記セマンティクスを検証)
- `apps/mcp` — InMemory トランスポートでの 7 ツール統合テスト 9 件

## アーキテクチャ

### 状態モデル(Step 1)

PostgreSQL の 8 テーブルが唯一の正:
`projects / vessels / branches / transactions / events / entities / relations / derived_results`

- `events` は追記専用。DB トリガーで UPDATE/DELETE を拒否
- `entities` / `relations` はブランチ HEAD の投影(イベント再生で任意バージョンを復元可能)
- `derived_results` も不変(トリガーで保護)

### トランザクションサービス(Step 2)

- **preview** — 投影のインメモリコピーに操作を適用し、効果と検証結果を返す。
  ブランチ投影は一切変更しない
- **commit** — ブランチ行の行ロック下で `baseVersion == headVersion` を検査(不一致は 409)。
  イベントを追記 → 投影を更新 → ブランチバージョンを**ちょうど 1 回**インクリメント。
  全体が単一 SQL トランザクション
- **revert** — 履歴は書き換えず、イベントに記録された before スナップショットから
  補償トランザクションを生成して新バージョンとしてコミット
- **branch.create** — フォークは「インポート」トランザクションとしてコミットされるため、
  新ブランチも完全にイベントソースドで独立

セマンティック ID(`hull:main`, `tank:WB2.P` など)はバージョン・ブランチをまたいで安定。

### Hydrostatics L0(Step 3)

オフセットテーブルを数値積分(区分線形の断面は厳密、船長方向はシンプソン則)し、
排水量・KB・BM・GM(自由表面修正込み)・TPC・MCT1cm・形状係数を算出。
結果は `(branch, version, kind, input_hash)` で一意な不変行として永続化され、
同一入力の再実行は保存済み行を返す(冪等)。

### MCP サーバー(Step 4)

ツール名は MCP の命名制約により `.` を `_` に置換:

| 論理名 | ツール名 | 動作 |
|---|---|---|
| vessel.get | `vessel_get` | 船体 + ブランチ一覧 |
| vessel.object.get | `vessel_object_get` | セマンティック ID で 1 エンティティ取得(バージョン指定可) |
| vessel.object.search | `vessel_object_search` | kind / 全文でエンティティ検索 |
| tank.resize | `tank_resize` | タンク変更の**プレビュー**(`commit: true` 指定時のみ確定) |
| hydro.run | `hydro_run` | L0 実行(不変・キャッシュ付き) |
| branch.create | `branch_create` | ブランチフォーク |
| transaction.revert | `transaction_revert` | 補償トランザクションで取り消し |

Claude Code への登録例:

```json
{
  "mcpServers": {
    "digital-dock": {
      "command": "node",
      "args": ["apps/mcp/dist/server.js"],
      "env": { "DOCK_API_URL": "http://localhost:8787" }
    }
  }
}
```

### 3D UI(Step 5)

- オフセットテーブルから船殻をロフト(ステーション断面線・シアライン付き)
- タンクは流体種別で色分け(バラスト青 / 燃料アンバー / 清水ティール)、
  充填率を液面ボックスで表現、CSS2D ラベル
- 喫水スライダー: 水面が追従し、L0 を同一エンジンでクライアント側即時計算
  (「実行して保存」で API 経由の不変 derived result として永続化)
- タンク編集はプレビュー(破線ゴースト表示)→ コミットの 2 段階。
  409 競合はバナー表示
- バージョンタイムトラベル(読み取り専用)、ブランチ切替・作成、
  トランザクション履歴と取り消し

## スコープ外(v12 時点)

自律運航 / Digital Ocean / 船級規則 / CFD / マーケットプレイス /
ニューラルレンダリング / Kafka / グラフ DB / Rust / Kubernetes は未実装(意図的)。
