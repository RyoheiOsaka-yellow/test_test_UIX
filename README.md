# Digital Dock v12

船舶デジタルツイン基盤。PostgreSQL を単一の正とするイベントソーシング +
ブランチ/バージョン管理、不変の派生解析結果(Hydrostatics L0)、MCP サーバー、
Three.js による 3D UI で構成されたモノレポです。

## 構成

| パッケージ | 役割 |
|---|---|
| `packages/shared` | ドメイン型、流体静力学 L0 / 復原性 L1 エンジン、パラメトリック船型生成 |
| `apps/api` | Fastify + PostgreSQL。認可状態(8テーブル)、トランザクションサービス、L0/L1 派生結果 |
| `apps/mcp` | MCP サーバー(stdio)。9ツールで船体モデルと復原性を操作 |
| `apps/web` | Vite + React + Three.js。3D 船体ビューア + ドラッグ編集 UI |

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

- `packages/shared` — 解析解(箱型バージ / V 型プリズム / 壁面近似 GZ 式 / 損傷時沈下 / KN 換算恒等式)との厳密照合 68 件
- `apps/api` — PostgreSQL 統合テスト 29 件(下記セマンティクスを検証)
- `apps/mcp` — InMemory トランスポートでの 9 ツール統合テスト 12 件

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

### 復原性 L1(自由トリム釣合と大傾斜復原性)

L0 が「与えられた喫水での性能」を答えるのに対し、L1 は「実際にどこに浮くか、
傾いたときどれだけ戻る力があるか」を解きます。

**姿勢モデル** — 水面は船体座標系の平面で、その法線は地球鉛直方向を船体系で
表したもの:

```
u = (−sinθ, −sinφ·cosθ, cosφ·cosθ)     φ: 横傾斜(右舷下が正) θ: トリム(船首上げが正)
点 p は u·p ≤ c で没水
```

横傾斜 φ を与えたときの釣合は、未知数 (c, θ) に対する 2 つの残差を解くこと:

- `ρV − W = 0` (浮力 = 重量)
- `(B − G)·l = 0` (l は地球水平・船首尾方向 → 自由トリム)

このとき復原てこは `GZ = (B − G)·t`(t は地球水平・左右方向)。
教科書の「LCB = LCG」は、この厳密条件から鉛直方向の項を落とした近似で、
本エンジンは `LCB − LCG = −(KB − KG)·tanθ` を満たします。

**主な精度上の設計判断**

- 断面は区分線形オフセットの多角形を半平面クリップして厳密に積分。船長方向のみ
  シンプソン則で近似
- スラックタンクは小傾斜の自由表面修正(FSC)ではなく、**実液面移動**で扱う。
  箱タンクを四面体分割して平面と厳密に交差させ、任意姿勢での液体重心を求める
  (GM₀ の表示には慣行どおり FSC も併記)
- GZ 最大角は頂点近傍の放物線補間で求め、サンプリング刻みに量子化されない

**IMO 復原性基準**(IS Code 2008 Part A 2.2)を GZ 曲線上で評価し、
各基準の要求値・実績値・符号付きマージンを返します。動揺角 θf は
リクエストで指定でき、未指定時は 40°。甲板端没水角は参考値として別途報告し、
θf の代用にはしません(甲板端没水はそれ自体が滑水現象ではないため)。

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
| stability.run | `stability_run` | L1 自由トリム釣合 + GZ 曲線(全結果) |
| stability.check | `stability_check` | IMO 基準の合否判定(要約) |

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
- **3D ドラッグ編集** — 選択タンクに移動/サイズのギズモを表示。ドラッグは
  数値フィールドと連動し、離した時点でプレビュー取引になる。船体包絡を
  はみ出す編集はサーバが 422 で拒否し、ゴーストと数値は確定形状に戻る
- **L1 タブ** — 釣合を解くと海面は水平のまま船体が実際の横傾斜・トリムで
  傾く(岸壁から見た姿)。GZ 曲線(0–30° 面積基準を網掛け)と 6 基準の
  合否・マージンを表示
- バージョンタイムトラベル(読み取り専用)、ブランチ切替・作成、
  トランザクション履歴と取り消し

## スコープ外(v12 時点)

自律運航 / Digital Ocean / 船級規則 / CFD / マーケットプレイス /
ニューラルレンダリング / Kafka / グラフ DB / Rust / Kubernetes は未実装(意図的)。
