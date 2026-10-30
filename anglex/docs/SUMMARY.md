# ANGLEX 成果物・参照一覧（2026-10-28 時点）

リポジトリ: `RyoheiOsaka-yellow/test_test_UIX` ブランチ `claude/ecstatic-cori-6y9cfp`（作業ディレクトリ `anglex/`、Netlify publish = `anglex`）

## 1. 配布用 HTML（単一ファイル・ブラウザで直接開ける）

| ファイル | 内容 | 備考 |
|---|---|---|
| `anglex/dist/ANGLEX_v1.html` | **v1 UI**（リボン＋プロジェクトブラウザ＋プロパティの BIM ワークスペース型） | 最新の全機能。`dist/ANGLEX.html` と同一 |
| `anglex/dist/ANGLEX_v2.html` | **v2 UI**（サインイン → モード選択 → 案件管理 / チャット見積 / 5 ステップ 3D 詳細。最初に共有いただいたデモの見た目） | 同じエンジンを内包。右上「⇄ UI v1」で相互切替 |
| `anglex/dist/ANGLEX.html` | v1 と同一（Netlify では `/dist/ANGLEX.html`） | |

3D ライブラリ（Three.js）・PDF ライブラリ・HDRI/テクスチャは CDN 読込のため、ネット接続が必要です。フォント（JIS サブセット TrueType）は埋込済み。

## 2. ソース HTML / MD

| ファイル | 役割 |
|---|---|
| `anglex/index.html` | v1 UI のシェル（リボン / ブラウザ / 3D / プロパティ / ステータスバー） |
| `anglex/v2.html` + `anglex/css/app_v2.css` | v2 UI のシェル（入口・ステッパー・ディテールカード） |
| `anglex/css/app.css` | v1 のスタイル（共通コンポーネント含む） |
| `anglex/README.md` | 機能・構成・Revit 対応表・リスク行列・溶接記号・帳票・3D 品質・v1/v2・ショールーム・コンテキストバー等の説明 |
| `anglex/docs/SUMMARY.md` | 本書 |
| `anglex/fonts/README.md` | 埋込フォント（Noto Sans JP → JIS X 0208 サブセット TrueType）の作り方 |
| `anglex/dev/geo-test.html` / `geo-close.html` / `fam-test.html` | 形鋼・締結・溶接・ファミリの描画テストページ |
| `anglex/dev/app-shot.mjs` / `shot.mjs` / `dev/flows/*.js` | Playwright（swiftshader）での自動テスト・スクショ用ハーネスと 30 本超のフロー |
| `netlify.toml`（リポジトリ直下） | 静的公開設定 |
| `promo/index.html` / `promo/CLAUDE.md` / `promo/AGENTS.md` | 別件（ANGLEX とは無関係の既存ファイル） |

## 3. JavaScript モジュール（`anglex/js/`）

| 層 | ファイル | 内容 |
|---|---|---|
| データ | `data/catalog.js`, `data/sections.js` | 日栄インテック カタログ 151 製品 / 700 SKU（Drive 2 シートから生成）、JIS 形鋼・管・ボルト寸法表 |
| 幾何 | `geo/profiles.js`, `geo/fasteners.js`, `geo/welds.js`, `geo/materials.js` | 形鋼の板構成＋実穴、面取り六角ボルト／螺旋ねじ、隅肉・突合せビード、PBR 材質（スパングル亜鉛、ヘアライン SUS、汚れムラ、Poly Haven テクスチャ、HDRI） |
| BIM | `bim/families.js`, `bim/model.js`, `bim/params.js`, `bim/build.js`, `bim/weight.js`, `bim/cost.js`, `bim/joints.js`, `bim/risk.js`, `bim/review.js` | 34 ファミリ（parts(p) が単一ソース）、タイプ/インスタンス/レベル/Undo、式パラメータ、JIS 質量・めっき付着、原価、接合・日本語指示、Case B リスク行列、確認事項・ズレ検出 |
| 取込 | `import/dxf.js`, `import/pdf.js`, `import/ifc.js`, `import/mesh.js`, `import/recognize.js`, `import/convert.js` | DXF 実パース、PDF.js、web-ifc、glTF/OBJ/STL/FBX、部材認識、DWG/JWW 変換（サーバ） |
| ビューワ | `viewer/scene.js` | Three.js（r180）: GTAO/SMAA、HDRI、表示スタイル（リアル／陰影＋エッジ／隠線／ワイヤ／半透明／CAD 図面色）、断面ボックス、分解（部材／部品）、焦点移動、手のひら、ピッキング、CSS2D ラベル、スクショ |
| UI | `ui/*.js` | 共通部品、プロパティ、ブラウザ、カタログ、ショールーム、集計表、見積（A→B→C 受け渡し・ゲート）、読込ウィザード、ファミリ編集、書出し（glTF/DXF/IFC-JSON/SimReady USD・USDZ）、帳票（CSV/XLSX/PDF）、確認事項・ズレ補正・作業保存、分解図、コンテキストバー、v2 シェル |
| 本体 | `main.js` | App: モデル⇄ビューワ同期、選択（部材→部品）、ギズモ（軸ロック・自動密着）、スナップショット、分解（個別部材化）、CAD 凡例、UI 切替 |
| サーバ | `server/server.js` | 依存なし Node: 認証・プロジェクト・見積 REST（ローカル保存と同じロジック） |
| ツール | `tools/build_catalog.py`, `tools/build_single.py`, `tools/otf2ttf_subset.py` | カタログ生成、単一 HTML ビルド（`python3 tools/build_single.py [html] [css] [out]`）、フォント変換 |

## 4. 参照した URL

### ユーザー提供（要件・デザインの根拠）
- Google Drive カタログ: https://drive.google.com/drive/folders/1OKj8tDxlgBX570npsTSsj5Et0MjP_UNK
  - 製品層: https://drive.google.com/drive/folders/1jySkcVRLq62mt38jFPI6ADznIfEJ49-x （読めるのは「14章のみOK：master_01_products_全27章統合_part4_ch13-14」）
  - 明細層: https://drive.google.com/drive/folders/1v33sdDtR5H1gIPKxyTKU2alscBBiycJ4 （読めるのは「master_03_dimensions_ch01」）
- BIM ビジョン資料（質感の目標）: https://docs.google.com/presentation/d/1iHAUqwibJcGXtv5mPDVO1DRiBOY7kZKG/edit
- 3D 品質の目標: https://huggingface.co/datasets/nvidia/simready-assets （SimReady パッケージ出力の仕様に反映）
- 冒頭に共有された 3 ファイル（アップロード）: 工場内部 Three.js デモ HTML（品質基準）、ANGLEX デモ HTML（v2 の見た目の元）、ANGLEX プロジェクト総括 MD（要件・用語）
- 総括 MD に記載の公開デモ: https://anglex-world-kasei.netlify.app/ ・ https://anglex-syousai.netlify.app/ ・ https://xad-yellow.netlify.app（演出の参考）

### 実装で読み込んでいる外部リソース（CDN / CC0）
- Three.js r180: https://cdn.jsdelivr.net/npm/three@0.180.0/ （build/three.module.js, examples/jsm/）
- web-ifc 0.0.66: https://cdn.jsdelivr.net/npm/web-ifc@0.0.66/
- PDF.js 4.6.82: https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/
- pdf-lib 1.17.1: https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/ ・ fontkit: https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/
- HarfBuzz WASM（フォントサブセット）: https://cdn.jsdelivr.net/npm/harfbuzzjs@0.4.6/hb-subset.wasm
- SheetJS 0.18.5: https://cdn.jsdelivr.net/npm/xlsx@0.18.5/
- Poly Haven（CC0）: HDRI https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr ・ テクスチャ API https://api.polyhaven.com/files/ （metal_plate, metal_plate_02, rusty_metal_04, concrete_floor_02）
- フォント: Google Fonts IBM Plex Sans JP / JetBrains Mono、Noto Sans JP（埋込サブセットの元、フォールバック https://cdn.jsdelivr.net/npm/@expo-google-fonts/noto-sans-jp/）

### 規格（コード内で計算根拠として参照）
JIS G 3192（形鋼の寸法・質量）、JIS G 3452（配管用炭素鋼鋼管）、JIS H 8641（溶融亜鉛めっき付着量）、JIS Z 3021（溶接記号）、JIS B 1180（六角ボルト）

## 5. 3D 部分を別エンジン（Astra）で作る場合の引き継ぎ仕様

ANGLEX は「ファミリ → parts リスト」が単一ソースで、3D・質量・集計・見積・帳票はすべて同じ parts から派生します。3D だけを差し替える場合、**parts リストを入力に受けて描画する層**（現在の `js/bim/build.js` + `js/geo/*` + `js/viewer/scene.js`）を置き換えれば、他は無改修で動きます。

### 5.1 入力契約（parts の JSON）
`app.instanceParts(inst)` が返す配列。各要素は次のいずれか。座標は mm、インスタンス座標系（配置 `pl` で部品を置き、さらにインスタンスの `pos`/`rot`（Euler XYZ）でワールドへ）。

```jsonc
{ "kind": "member" | "plate" | "pipe",          // 形鋼・板・管
  "name": "柱（左）", "spec": "L-50x50x6",       // 仕様文字列（parseSpec で解釈: L-/[-/C-/LC-/FB-/PL-/SGP-nnA/STK/VP/□/H/RB）
  "length": 541,
  "holes": [{ "face": "A", "z": 50, "s": 25, "d": 15, "slot": { "len": 25, "dir": "z" }, "kind": "anchor" }],  // 面: A/B/web/ft/fb/face/…、z=長さ方向、s=幅方向
  "finish": "HDZ" | "EZ" | "BLACK" | "PAINT" | "SUS304" | "ZAM" | "PIPE", "material": "SS400",
  "pl": { "pos": [x, y, z], "basis": [[xx,xy,xz],[yx,yy,yz],[zx,zy,zz]] },   // 右手系。部品の長さ方向 = basis[2]
  "group": "本体", "role": "column", "cadRole": "brace", "site": false, "ref": false }
{ "kind": "bolt"|"nut"|"washer"|"anchor"|"rod",  "M": "M12", "L": 40, "pl": {...}, "site": true }
{ "kind": "ubolt", "od": 60.5, "nominal": "50A", "M": "W3/8", "plateT": 6, "pl": {...} }
{ "kind": "weld", "weldType": "fillet"|"butt", "size": 6, "length": 50, "from": [..], "to": [..], "n1": [..], "n2": [..], "site": false, "symbol": "○▷6", "group": "柱頭溶接" }
{ "kind": "custom", "custom": "band"|"uband"|"ring"|"box"|"cylinder"|"elbow"|"can", "mass": 0.3, "finish": "EZ", ... }
```

参照（配管など、質量に含めない）は `ref: true`。LOD は 200（概略）/300（設計）/400（製作: 面取り・ねじ山・ビード波紋）。

### 5.2 3D 層に求められる機能（現状の実装が満たしているもの）
1. 形鋼を「板の集合」として生成し、穴・長穴を実際に貫通させる（`profiles.js: decompose / buildMember`）
2. 締結（六角ボルト・ナット・座金・Uボルト・アンカー・吊ボルト）と溶接ビード（`fasteners.js`, `welds.js`）
3. 仕上げ別 PBR 材質（`materials.js`）と表示スタイル（リアル／陰影＋エッジ／隠線／ワイヤ／半透明／**CAD 図面色**＝役割別フラットカラー。役割は `cadRole(pt)`）
4. ピッキング: 部材（インスタンス group）→ 部品（`userData.part`）の 2 段階。選択・ハイライト・コンテキストバー
5. 分解: インスタンス単位／部品単位（`setExplode(k, group)`）、バルーン番号（CSS2D ラベル）、部品の単独表示
6. 視点: 焦点移動アニメーション（`focusOn`）、手のひらパン、断面ボックス、レベル線・符号・溶接記号・確認旗の 2D オーバーレイ
7. スクリーンショット（部材単体・分解図＋バルーン座標の投影）→ PDF 帳票へ
8. 書出し: glTF/GLB、USD（USDA/USDZ、PhysicsMassAPI・コリジョン）— **別エンジンへはこの GLB/USD を渡す経路が最短**

### 5.3 置き換えの進め方（提案）
- A. **描画のみ差し替え**: parts → メッシュ生成を Astra 側で実装し、`Viewer` と同じ API（`add/clear/select/label/fit/focusOn/setExplode/setDisplayStyle/screenshot/pick`）を提供する。`main.js` は Viewer の API 越しにしか触らないので差し替え可能。
- B. **GLB/USD 連携**: ANGLEX で生成した SimReady パッケージ（USD + GLB + テクスチャ + metadata.json のBOM/質量/重心）を Astra に読み込ませ、ANGLEX は編集・積算・帳票に専念する。
- どちらでも、穴・溶接・確認旗などの「意味付け」は parts JSON（`metadata.json` にも同梱）から取れます。

Astra が具体的にどの製品／ライブラリを指すか（URL）を教えていただければ、上記 A/B のどちらが適切か、必要な変換（座標系・単位・材質）まで落とし込みます。

## 6. 開発の流れ（コミット要約・新しい順）
- 営業所の仕分け（拠点マスタ・ユーザー所属・案件/見積の branch・一覧フィルタ・サーバー絞込）、学習単価マスタ（C社回答の蓄積・適用・見直し候補）、組立確認（工具スペース・保温厚・組立順・組立図 PDF）、ラスター図面のベクタ化（ノイズ除去・円は生の連結成分から先に判定）と認識の学習ループ。合成スキャンでの実測: きれいな画像は直線・矩形・穴 100%、スキャン相当は直線・矩形 100%・穴 70〜90%、劣化 150 dpi は 88 / 83 / 60%、OCR 仕様注記はきれいな画像で 5/5（回答書・仕様書に転記）。限定 OCR（Tesseract.js 同梱、部材仕様・穴・長さのみ）、スキャン画像の上での修正と学習、実スキャン検証キット（dev/raster-real.mjs）。業務フローに次の一手バナー・受け渡しタイムライン・催促文。期限通知の自動化（バッジ・一覧、サーバー版はメール自動送信）、日本語 OCR（限定語彙）、デスキュー、検証キットの PDF 入力と報告書 PDF 出力、穴・アンカー注記の部材紐づけ、B/C ビューの「残り n 行」モード、穴位置の 3D 反映（図面の円 → 実位置）、C社の前回回答流用、検証結果 CSV の取込
- 受け渡しの通知文・回答期限、確定前チェック、案件横断ダッシュボード、オフライン版ビルド（ライブラリ同梱・外部通信遮断テスト）、仕様書／提案書／ハードウェア回答書（docs/pdf）
- B社・C社の役割専用ビュー（一括入力・やること表示・詳細は折りたたみ）、まとめて確認ウィザード（カード送り・3D 自動フォーカス・キー操作）、見積の比較ビュー（Rev 間差分・会社間金額・変更理由）
- 配管上のホットスポット（◎ 呼び径 / ⇣ 支持金具）、等ピッチ配置、業務フロー パネル（6 段階・重量内訳・共有リンク・受け渡し・確定）、サムネイル再生成の GitHub Actions
- 取付プレビュー（半透明ゴースト＋変更ラベル）、Shift+クリックの複数選択と選択バー（整列・まとめて配管へ取付・複製・削除・一括移動）、ショールーム「まとめて選択」、サムネイルの事前生成同梱（dev/gen-thumbs.mjs → js/data/thumbs_pre.js）
- サムネイルの永続キャッシュ（IndexedDB）、配管へ取付の両方向化（口径・U ボルト穴ピッチ同時合わせ）、操作性（カーソル中心ズーム・カメラのイージング・選択アウトライン・ホバー吹き出し・Esc 段階クローズ・矢印移動・? ヘルプ・出現アニメーション）
d8bc662 ショールーム除外 / 578248a 二重 import 修正 / a6f7f39 カタログ ショールーム / e598455 PDF 穴座標丸め / cad628b コンテキストバー・自動密着・汚れムラ・役割色既定・PDF 引出線・切替引継ぎ / a5a7454 CAD 役割上書き・分解図 PDF・Space パン・UI 切替 / 1313b36 v1 分解図・中央へ・CAD 図面色 / d086e3f v1/v2 並置 / d4e27e4 v2 UI 再構成＋分解 / 655c82d 受け渡しゲート・穴位置旗・部材長密着 / 0904d67 確認アラート・指示・ズレ補正・作業保存 / a44c5e9 HarfBuzz サブセット PDF / e22084c JIS サブセットフォント・USDZ / 5744fff USD LOD / fe7183b 単一 HTML / 0d68891 帳票・SimReady 品質・USD・リスク行列・溶接記号 / 6aff96a 認識修正・README / 0d9c1ea 初版（3D カーネル・カタログ・ファミリ・質量/原価・接合・取込・多社見積・サーバ）
