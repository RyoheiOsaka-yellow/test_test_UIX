# ANGLEX — Fabrication Intelligence（BIM 型 加工品 3D・見積プラットフォーム）

2D図面・CAD/BIMデータから配管サポート（架台・ブラケット・吊り金具・バンド）を **Revit 流のファミリ → タイプ → インスタンス** で 3D 化し、
穴・長穴・溶接ビード・ボルト・Uボルト・アンカーまで作り込んだ製作レベル（LOD400）のモデルから、重量・集計表・見積・加工指示書を **単一ソース** で生成します。
見積は **A社（見積作成）→ B社（利益上乗せ）→ C社（加工工場）** の多社ワークフローでフィールド単位の権限管理・改訂凍結・監査ログつきで受け渡せます。

## 起動

```bash
# 1) 静的に開く（ローカル保存モード: localStorage）
cd anglex && python3 -m http.server 8080     # → http://localhost:8080/

# 2) サーバモード（多社アカウント・受け渡しリンク・DWG/JWW 変換中継）
node server/server.js --port 8080            # → http://localhost:8080/  データ: server/data/db.json
#    初期アカウント: a@example.com / b@example.com / c@example.com（パスワード anglex）
#    DWG/JWW/RVT 変換: ANGLEX_CONVERTER_URL=https://<ODA File Converter 等の HTTP ラッパ>/convert node server/server.js
```

依存パッケージなし（Three.js r180 / PDF.js / web-ifc / SheetJS は CDN から読込）。Node 18+。

## 構成

| 層 | ファイル | 内容 |
|---|---|---|
| データ | `data/catalog.json`, `js/data/catalog.js` | Google Drive の製品マスタ（13〜14章 75製品・1章 寸法表 4,698行 = 76製品 700 SKU）を `tools/build_catalog.py` で取り込み。各製品に 3D ファミリと既定パラメータを紐付け |
| データ | `js/data/sections.js` | JIS 形鋼・鋼管・ボルト・座金・Uボルト・めっき付着量テーブル |
| 幾何 | `js/geo/profiles.js` | L / [ / リップ溝 / □ / H / FB / PL / SGP / VP を「板構成」で生成（丸穴・長穴は実貫通穴）。根元R、断面性能 |
| 幾何 | `js/geo/fasteners.js` | 六角ボルト・ナット・座金・ばね座金（JIS寸法、ねじ山法線マップ）、Uボルト、アンカー、吊ボルト |
| 幾何 | `js/geo/welds.js` | 隅肉・全周・突合せ・プラグ溶接ビード（凸断面＋波紋）、JIS Z 3021 記号文字 |
| 幾何 | `js/geo/materials.js` | 溶融亜鉛めっきスパングル、SUSヘアライン、電気亜鉛、黒皮、サビ止め等のプロシージャル材質 |
| BIM | `js/bim/families.js` | 34 ファミリ（門型架台・L型/三角ブラケット・吊サポート・吊架台・枠架台・ポール・ダブル材・スリーブ・両フランジ管・板金・吊バンド・立バンド・フリーアングル/チャンネル・小物金具…）。`parts(p)` が幾何と数量の単一ソース |
| BIM | `js/bim/model.js`, `params.js` | タイプ/インスタンス、レベル・通り芯、接合、Undo/Redo、式評価（`=H-2*t`, `if()`, `round()`） |
| BIM | `js/bim/weight.js`, `cost.js` | JIS 単位質量 → 穴控除 → めっき付着（表面積×g/m²）→ 溶着金属 → ボルト類。材料費・切断・穴・溶接・曲げ・組立・めっき・管理費 |
| BIM | `js/bim/joints.js` | 接触検出 → 溶接ビード／ボルト（両部材に穴を注入）、日本語指示文パーサ |
| 読込 | `js/import/*` | DXF（実パース・INSERT展開・SVG化・部材認識）、PDF（PDF.js 文字抽出）、IFC（web-ifc）、glTF/OBJ/STL/FBX、DWG/JWW/SFC/RVT（サーバ変換中継） |
| UI | `js/ui/*`, `js/main.js`, `index.html` | プロジェクトブラウザ / プロパティパレット / リボン / カタログ / ファミリエディタ / 集計表 / 見積 / 読込ウィザード / 図面ビュー / 書出し |
| ワークフロー | `js/core/workflow.js`, `store.js`, `server/server.js` | A→B→C の役割・権限・改訂・監査・受け渡しトークン。ローカル／REST 両対応 |

## Revit 的な考え方の対応表

| Revit | ANGLEX |
|---|---|
| ファミリ / タイプ / インスタンス | `FAMILIES` 定義 / `model.types` / `model.instances`（T／I パラメータ、式） |
| プロジェクトブラウザ・プロパティ | 左ペイン・右ペイン |
| レベル・通り芯 | `model.levels` / `model.grids`（3D に破線表示） |
| 集計表（Schedule） | 部材・ボルト類・溶接・穴・仕上げ面積・インスタンス一覧（CSV/XLSX） |
| LOD | 200 / 300 / 400 切替（根元R・ねじ山・ビード波紋） |
| 表示スタイル | リアル / 陰影+エッジ / 隠線 / ワイヤ / 半透明、断面ボックス、分解 |
| 干渉チェック | 板単位 AABB、接合済み接触は除外 |
| IFC | 読込（web-ifc）、書出し（IFC 風 JSON: IfcMember / IfcPlate / IfcMechanicalFastener / IfcFastener） |

## 3状態モデル（リスク行列 Case B）
読込・推論した部材は **確定／推論／要判断** を保持します。境界は `js/bim/risk.js` のリスク行列で決まります:
`risk = (1 − 信頼度) × 加工種別コスト（穴2・ピッチ3・溶接4・アンカー4…）× 管径係数（〜50A:1.0 / 〜100A:1.25 / 〜200A:1.6 / 大口径:2.0）`、
risk ≤ 0.6 で確定、≤ 1.8 で推論、それ以上は要判断。読込ウィザードに risk 値と主因を表示します。

## 溶接記号（JIS Z 3021）と現場／工場
溶接 parts は `site`（現場）フラグと記号文字（▷隅肉 / ○全周 / ▶現場 / V突合せ）を持ち、3D ラベル・図面ビュー・溶接集計（工場/現場別）・原価（現場は単価×1.8）に反映されます。指示文「MF-1 と MF-2 を 現場 隅肉溶接 6」、接合ダイアログの「施工」、門型架台の「ベース取付=現場溶接」で指定できます。

## 帳票の書出し（CSV / XLSX / PDF）
- 見積: 見積書 PDF（日本語フォント埋込・直接ダウンロード）、XLSX（数式入り: 採用原価・提示単価・販売単価・小計・税）、CSV、加工指示書 PDF（部材ごとの3Dスナップ・穴・溶接・ボルト）
- 重量: 重量計算書 PDF / XLSX（単位質量×長さ、穴控除、めっき付着、合計の数式）/ CSV、集計表 XLSX
- モデル: プロジェクト JSON、glTF/GLB、DXF 加工図（板展開＋穴）、IFC 風 JSON、**SimReady パッケージ**（USDA + GLB + PBR テクスチャ PNG + metadata.json（BOM・質量・重心・bbox・意味クラス）+ サムネイルの ZIP）

## 3D 品質（SimReady 指向）
PBR（アルベド / 法線 / 粗さ / AO）マテリアル、HDRI 環境光（Poly Haven CC0）、GTAO 接触陰影 + SMAA、面取り付き六角ボルト・ナット（30° 円錐面取り）、LOD400 の実螺旋ねじ山、板エッジ・穴の面取り、根元R、溶接ビードの波紋。CDN が使えない環境ではプロシージャル材質と RoomEnvironment にフォールバックします。

## Netlify 運用
リポジトリ直下の `netlify.toml` が `anglex/` を公開します（サーバ不要）。DWG/JWW の自動変換はサーバモード専用のため、Netlify 運用では DXF / IFC / PDF / glTF を直接読み込んでください。

## テスト
```bash
node dev/shot.mjs /dev/fam-test.html?f=portal_frame out.png   # ファミリ単体の描画
node dev/app-shot.mjs out.png dev/flows/estimate.js             # UI フロー
```
