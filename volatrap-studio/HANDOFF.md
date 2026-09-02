# VolaTrap Assembly Studio — 開発引き継ぎ仕様書

デスクトップ版 Claude Code で開発を継続するためのドキュメントです。
このフォルダを開いて `index.html` をブラウザで表示すれば、そのまま動きます。

```
volatrap-studio/
├── index.html   # 本体（単一ファイル・約 1,000 行・依存は Three.js r128 のみ）
├── README.md    # 機能一覧と操作方法
└── HANDOFF.md   # このファイル
```

---

## 1. 目的とコンセプト

| 項目 | 内容 |
|---|---|
| 対象製品 | VolaTrap（呼気 VOC サンプリングデバイス）: マウスピース・ローレット付きカップリング・吸着カートリッジ・LED リング付き円形ボディ・電源ボタン・ベース |
| 目標体験 | CATIA / 3DEXPERIENCE / Kisters 3DViewStation のように **分解 (Explode)・断面 (Section)・カラーコード・パラメトリック編集・BOM・計測** を 1 画面で行う |
| 方針 | 画像レイヤーではなく **実寸 (mm) のプリミティブから Three.js でパラメトリック生成**。質量・重心はメッシュ体積 × 材質密度で実計算 |
| 単位 | 長さ mm / 質量 g / 体積 cm³ / 密度 g/cm³。Y 軸が上、Z 軸が正面（フェイス側） |

---

## 2. 画面レイアウト

```
┌──────────────── appbar（製品名・パンくず・検索・リビジョン）────────────────┐
├──────── ribbon: 表示 | 分解 | 解析 | 設計（タブ切替でグループが入れ替わる）──────┤
├───────────┬────────────────────────────────────────┬─────────────────────┤
│ 左ドック    │ 3D ビューポート（座標トライアド / HUD / 凡例）    │ 右ドック            │
│ 構造ツリー  │                                          │ プロパティ           │
│ 保存ビュー  ├────────────────────────────────────────┤ パラメータ + 目標判定  │
│ 選択セット  │ 下ドック: 部品表 (BOM) | 計測 | 出力ログ          │                     │
├───────────┴────────────────────────────────────────┴─────────────────────┤
└──────── status（選択数 / 三角形数 / 総質量 / 操作ヒント / fps）──────────────┘
```

- ドックは `hidden` 属性で消える（リボン「表示ペイン」チェックボックス連動）。
- 900px 以下では縦積みになる（デスクトップ前提の UI）。

---

## 3. コード構造（`index.html` 内 `<script>`）

| セクション | 主要シンボル | 役割 |
|---|---|---|
| design data | `MATERIALS`, `GROUPS`, `PART_DEFS`, `PARAM_DEFS`, `TARGETS`, `DEFAULT_PARAMS` | 材質表・サブAssy・部品定義・パラメータ・目標値 |
| state | `state`, `parts` (Map) | UI 状態と部品ランタイム（材質・色・質量・重心・グループ） |
| renderer / scene | `renderer`, `scene`, `camera`, `orbit`, `goTo()`, `VIEWS` | Three.js 初期化、自前オービット、ビュー遷移トゥイーン |
| geometry helpers | `volumeCentroid(geom)`, `makeLogoTexture()` | 符号付き四面体法による体積・重心、ロゴ用 CanvasTexture |
| build model | `buildModel()`, `updateMass()` | 全部品を再生成し質量特性を計算（パラメータ変更時に丸ごと再構築） |
| explode / materials / clip | `applyExplode()`, `applyMaterials()`, `applyClip()`, `displayColor()` | 分解位置、レンダーモード・カラーコード・選択ハイライト、クリッピング平面 |
| selection | `select(ids, add)`, `onSelectionChange()` | 選択の単一入口。変更後に各パネルを再描画 |
| panels | `renderTree()`, `renderProps()`, `renderParam()`, `renderBom()`, `renderMeasure()`, `renderViews()`, `renderSets()` | 各ペインは state から毎回 innerHTML を生成（仮想 DOM なし） |
| picking | `pick()`, `updateHover()` | Raycaster。断面 ON 時は切断側のヒットを無視 |
| loop | `loop()` | rAF。トゥイーン・ターンテーブル・分解アニメ・fps |
| init | 末尾 | モデル生成 → プリセットビュー 4 種のサムネイル撮影 → 初期ビュー |

### 部品定義の書式（`PART_DEFS` の 1 要素）

```js
{ id:'P-102', seq:2, tool:'手作業 (ローレット回し)',   // seq: 分解手順の順番, tool: 工具
  name:'カップリングリング', en:'Knurled Coupling', group:'A1',
  mat:'ABS', mb:'make', color:'#eef0f3', qty:1, shell:true,   // shell: 透過モードで半透明になる外装
  build: c => ({
    pos: c.along(38 + c.p.ringW/2),     // 組立位置（ワールド座標）
    quat: c.qN,                          // 任意: ノズル軸向きの回転
    explode: c.d.clone().multiplyScalar(48), // 分解 100% 時の移動ベクトル (mm)
    meshes: [{ g: new THREE.LatheGeometry(pts, 64) }, { g: box, pos:[x,y,z], rot:[rx,ry,rz] }]
  }) }
```

`build` に渡る `ctx`:
`p`(params) / `R`(ボディ半径) / `D`(奥行) / `cy`(ボディ中心高さ) / `d`(ノズル軸単位ベクトル) / `n`(その法線) / `P0`(ノズル基点) / `qN`(Y→d の回転) / `along(s)`(ノズル軸上の点)。

**部品を足す手順**: `PART_DEFS` に 1 要素追加するだけ。ツリー・BOM・計測・カラーコード・選択セットは自動反映。
中空部品は `LatheGeometry` の閉じたプロファイル（始点 = 終点）で作ると体積計算が正しく出る。

---

## 4. 主要機能の実装メモ

| 機能 | 実装 | 注意点 |
|---|---|---|
| 分解 | `group.position = base + explodeVec × partT(rt,t) × scale`。`partT` は順次モードで工程番号 (`state.seq`) ごとに時間窓をずらす | `radial` モードはボディ中心からの放射 + 元ベクトル 35%。`stepTarget(k)` が工程 k 完了時の分解率を返す |
| トレース線 / ゴースト | `trails` (LineDashedMaterial) を `applyExplode()` で更新、`ghostGroup` は組立位置の半透明コピー | 非表示部品は除外 |
| 部品ラベル | `updateLabels()` が毎フレーム重心を `project()` して DOM を配置 | 選択 / ホバーは常時、全表示は `state.labels` |
| 干渉チェック | `runClash()`: 組立状態の AABB 重なり (>50 mm³) を列挙、意図的な入れ子ペアは `nested` で除外 | 本格的なメッシュ干渉ではない |
| レイアウト | `setDock / setRibbon / setPresent`、`localStorage['vt-studio-layout']` | ドック切替後 `refit()` で全体表示 |
| 断面 | `renderer.localClippingEnabled`, 全マテリアルに `clippingPlanes=[plane]` | キャップ面は未実装（内部が見える簡易断面）。`flip` で切断側反転 |
| レンダーモード | solid / wire(`wireframe`) / ghost(`shell` 部品を opacity 0.16) / illust(`MeshLambert` 白 + `EdgesGeometry`) | 輪郭線チェックで solid でもエッジ表示 |
| カラーコード | `displayColor()` が 5 モードを返す。LED は material モード時のみ発光 | 凡例は `renderLegend()` |
| 質量特性 | 各メッシュの符号付き体積・重心 → `matrixWorld` で変換 → 密度 × 数量 | 開いたメッシュ（デカール）は体積 0 扱い |
| パラメトリック | スライダー `input` → 60ms デバウンス → `buildModel()` 丸ごと再生成 | 部品状態（色・材質など）は `parts` Map に残るので保持される |
| 質量最適化 | ベース厚 → 奥行 → 半径 の順に貪欲に縮小し目標質量まで反復（最大 40 回） | デモ用の簡易アルゴリズム |
| 保存ビュー | カメラ球座標 + 分解率 + レンダーモード + 断面 + サムネイル(JPEG dataURL) | `preserveDrawingBuffer` 不要（render 直後に drawImage） |
| 透視 / 平行 | fov 35° ↔ 6° 切替、距離を tan 比で補正して見かけを維持 | 真の OrthographicCamera ではない |

---

## 5. デザイントークン

| トークン | Light | Dark | 用途 |
|---|---|---|---|
| `--accent` | `#1f5fa8` | `#6aa9ff` | アプリバー、押下状態、リンク |
| `--sel` / `--sel-soft` | `#2f7de1` / `#e4efff` | `#5aa0ff` / `#1f3350` | 選択ハイライト（3D は emissive 0x2f7de1） |
| `--make` / `--buy` | `#35a04f` / `#3b7dd8` | 同 | Make/Buy バッジと 3D カラーコード |
| `--vp1` → `--vp2` | `#eaeef5` → `#b4c0d1` | `#3a4353` → `#13161c` | ビューポート放射グラデーション |
| 書体 | IBM Plex Sans / IBM Plex Mono / Noto Sans JP（Google Fonts） | | 数値は Mono + `tabular-nums` |

ライト / ダークは `prefers-color-scheme` と `:root[data-theme]` の両方に対応済み。

---

## 6. 既知の制約・未実装

- **形状はプリミティブ近似**。ボディ背面の丸み、ベースの傾斜クレードル、ノズル根元フィレットは未再現。
- 内部ユニット（ポンプ・基板・電池・フローセンサ）の配置は **推定**。実機構成が分かれば `PART_DEFS` を差し替える。
- 断面のキャップ（切断面の塗りつぶし）なし。
- 干渉チェックは AABB 近似。寸法注記（3D 寸法線）、Undo/Redo、部品編集値の永続化なし（レイアウトのみ保存）。
- 書き出しはクリップボード経由（JSON / TSV）。ファイル保存は未実装。

---

## 7. ロードマップ案（優先度順）

1. **glTF 読み込み対応** — 実 CAD からの `.glb` を `GLTFLoader` で読み、ノード名 → `PART_DEFS` にマッピング。ツリー・BOM・分解ロジックはそのまま流用可能。
2. **断面キャップ** — ステンシルバッファ法（back-face をステンシルに書き、平面メッシュで塗る）。
3. **干渉チェック** — 部品ペアの `Box3.intersectsBox` → 解析タブに一覧、該当部品を赤ハイライト。
4. **寸法注記** — `CSS2DRenderer` でラベルを 3D に追従。計測タブの 2 部品間距離をビューポートに線で表示。
5. **状態保存** — `state` と `parts` の編集値を localStorage / JSON ファイルへ。
6. **形状忠実度向上** — ボディを `LatheGeometry` の曲線プロファイル化、ベースを押し出し形状に。

---

## 8. ローカル開発のヒント

- そのままダブルクリックで開ける（`file://` で動作）。Three.js と Google Fonts のみ CDN。
- オフライン検証時は `three.min.js` を同階層に置き、`<script src>` を相対パスに変更。
- ヘッドレス確認例（Playwright）: `chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader']})` で WebGL が動く。
- 変更後の確認ポイント: 出力タブに「モデル生成完了」が出ること、ステータスバーの総質量が変化すること。

## 9. Claude Code への指示テンプレート

```
volatrap-studio/HANDOFF.md を読んでから作業してください。
index.html は単一ファイル構成を維持し、部品追加は PART_DEFS への追加で行ってください。
変更後は index.html をブラウザで開いて出力タブにエラーが無いことを確認してください。
```
