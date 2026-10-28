# ANGLEX 3D ブリーフ（Astra GPT など外部の生成系に渡す用）

目的: 配管支持金具（架台・ブラケット・吊り金具・バンド）の 3D 部品を、**製造図面の読み替えに耐える品質**で生成・表示する。ANGLEX 本体は「parts リスト」（下記）を単一ソースとして持ち、3D・質量・集計・見積・帳票を派生させる。3D 層だけを外部で作る場合は、この parts リストを入力として受け取り、同じ API を提供すればよい。

## 1. 入力: parts リスト（1 インスタンス分）
`docs/sample_parts_MF-1.json` が実データ（門型架台 NM型 L-50×50×6 W500、36 部品）。単位は mm、インスタンス座標系。部品ごとの配置 `pl` は右手系の基底 `basis = [x, y, z]`（部品の長さ方向 = z）と原点 `pos`。インスタンス全体はさらに `pos`（mm）と `rot`（Euler XYZ, rad）でワールドへ置く。

| kind | 必須フィールド | 生成すべき形状 |
|---|---|---|
| `member` / `plate` / `pipe` | `spec`（`L-50x50x6`, `[-75x40x5x7`, `C-100x50x5x7.5`, `LC-40x40x1.6`, `FB-6x50`, `PL-9x150x150`, `SGP-50A`, `VP-50`, `□-50x50x2.3`, `H-100x100x6x8`, `RB-12`）, `length`, `holes[]`, `finish`, `material`, `pl` | 形鋼を「板の集合」として押し出し、穴・長穴（`face`, `z` 長さ方向, `s` 幅方向, `d`, `slot{len,dir}`）を貫通で開ける。LOD400 では板エッジの面取り（t×0.12 程度）、根元 R |
| `bolt` `nut` `washer` `anchor` `rod` | `M`（`M12` / `W3/8`）, `L`, `pl`, `site` | JIS B 1180 六角（30° 円錐面取り）、ねじ山（LOD400 は螺旋）、座金、全ねじ（吊ボルト）、アンカー（埋込側は不可視） |
| `ubolt` | `od`, `nominal`, `M`, `plateT`, `pl` | 管径 `od` に沿う U 字＋両脚ねじ＋ナット・座金 |
| `weld` | `weldType`（fillet/butt）, `size`, `from`, `to`, `n1`, `n2`, `site`, `symbol` | 隅肉は凸三角ビード（LOD400 で波紋）、突合せは山形。`site=true` は現場溶接（表示色を変える） |
| `custom` | `custom`（band/uband/ring/box/cylinder/elbow/can）, 寸法, `mass` | 帯鋼の曲げ品（吊バンド・立バンド）、リング、箱、円筒、エルボ |
| `ref: true` | 上記のうち配管など参照物 | 半透明・ピッキング対象外・質量に含めない |

`role`（column/beam/base/gusset/brace/support/pipe/ubolt/anchor/bolt/rod/weld/band/plate/steel）と `cadRole`（ユーザー上書き）は CAD 図面色の役割。`group` は部品グループ名、`site` は現場施工。

## 2. 出力 / 表示に求める品質
- 材質: 溶融亜鉛めっき（スパングル模様、metalness 0.7 / roughness 0.5、クリアコート薄）、電気亜鉛（滑らか・高反射）、黒皮（ミルスケール、粗さ高）、SUS304（ヘアライン・異方性）、塗装（クリアコート薄）、ボルト（黒染め／ユニクロ）。ワールド座標ベースの汚れ・粗さムラ（3D ノイズ）を薄く重ねる
- 溶接: ビードは本体と別メッシュ。トゥ（端）に熱影響の焼け色（茶→青）のグラデーション
- 照明: HDRI（スタジオ／倉庫）、ACES トーンマッピング、GTAO 接触陰影、MSAA 4x + SMAA、PCF ソフトシャドウ（4096）
- 表示スタイル: リアル／陰影＋エッジ（EdgesGeometry 22°）／隠線／ワイヤ／半透明／CAD 図面色（暗背景 #141410、役割別フラットカラー: 柱 #3b5bdb 梁 #2fa84f ベース #14b8a6 ガセット #a855f7 方杖 #eab308 支持金物 #f97316 配管 #22d3ee アンカー #ef4444 溶接 #fb923c）
- 操作: 部材→部品の 2 段階ピッキング、焦点移動（距離維持）、手のひらパン、軸ロック移動（5mm）、分解（部材／部品、溶接は非表示）、バルーン番号、断面ボックス
- 出力: glTF/GLB、USD/USDZ（PhysicsMassAPI、convexHull コリジョン、metadata.json に BOM・質量・重心）、スクリーンショット（720×480、バルーン座標の投影）

## 3. 提供してほしい API（ANGLEX 本体が呼ぶ）
```
add(group) / remove(group) / clear()
select(group|null)  setHover(group|null)  pick(event) → { object, instance, point }
fit(obj, pad)  focusOn(obj, {animate})  setView('3d'|'iso'|'plan'|'front'|'side')
setDisplayStyle(style)  setTheme('light'|'dark')  setQuality(bool)  setGrid(bool)  setShadows(bool)
setExplode(k, targetGroup|null)  setSectionBox(box|null)  setPanMode(bool)
label(text, worldPos, cls) / clearOverlays() / dimension(a, b)
screenshot(w, h) → dataURL   invalidate()
```
`group.userData.instId`、各部品 `child.userData.part`（parts 要素への参照）を保つこと。

## 4. 検証データ
- `docs/sample_parts_MF-1.json`: 門型架台 1 体（柱 2・梁・ベース 2・Uボルト 3・アンカー 4・溶接 24・配管参照 3）
- 期待値: 製品質量 12.69 kg（鋼材 10.54 / めっき 0.25 / ボルト 1.77 / 溶接 0.13）、穴 10 / 長穴 0、溶接長 800 mm
