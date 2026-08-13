# CLAUDE.md — XBUILD データフロー層

## このリポジトリの位置づけ

XBUILD のジオメトリ データフロー層。`SPEC.md` が唯一の真実。
仕様と実装が食い違った場合、**まず SPEC.md を更新してから**実装を直すこと。

## 絶対制約

1. **`src/geo.js` と `src/cook.js` は DOM / three.js / 外部パッケージを一切 import しない。**
   純粋 JS を維持する。この性質があるから `node --test` だけで検証が回る。破ったら価値の大半が消える。
2. **納品形態は単一 HTML ファイル。** three.js r128 をインライン、ビルド不要、`file://` で開ける。
   開発中はモジュール分割してよいが、`build.js` で1ファイルへ結合できる状態を常に保つ。
3. **three.js は r128 固定。** r15x 以降の API（`WebGLRenderer.outputColorSpace` 等）を使わない。
4. **`THREE.ColorManagement.enabled = false`** を明示すること（手調整パレット前提）。

## 作業ルール

- **テストが緑になるまで次のタスクに進まない。** 赤のままコミットしない。
- **新しいノード型を追加するときは、定義とテストを同じコミットで書く。**
- **新しい属性型を追加するときは、対応する COW テストを必ず書く。**
  `resize` が共有バッファを切り離し損ねる漏れが実際に発生している（SPEC.md §6.1）。
- 反復処理では `AttribSet.count`（論理要素数）を使う。`Attribute.capacity` は容量であって要素数ではない。
- ノードの `cook` は入力を破壊しない。書き換えるなら必ず `ctx.in(i)`（COW クローン）を経由する。
- **キャッシュを古くしてよいのは invalidate 経由のみ**（invalidate は下流へ伝播する）。
  ノード単位のキャッシュキー比較だけで鮮度を判断する実装は、プル評価では上流に
  遡らず古い結果を返す（SPEC.md §18.3）。新しい評価文脈を足すときは
  `Graph._syncContext` で push 型 invalidate に変換すること。

## 検証

```bash
node --check src/*.js
node --test test/*.test.js
```

P6（ビューア結合）以降のみ、追加で:

```bash
# 結合後の HTML から script ブロックを抽出して構文チェック（HTML に直接かけない）
# Playwright + SwiftShader でヘッドレス描画確認
#   --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader
# PIL + numpy でピクセル検証
```

## 命名と改名

他社製品の固有名称を製品・UI・公開ドキュメントに持ち込まない。

**ノード型やパラメータを改名するときは、必ず同じコミットで後方互換を足す。**

- 型名: `def.aliases: ['旧名']`
- パラメータ名: `def.migrateParams(params)`
- 旧名で保存したグラフが `deserialize` → `cook` → `serialize` を通るテストを書く

実例は `src/nodes.js` の `snippet`（旧 `wrangle`）と `test/p3.test.js`。

## パッチ規律

文字列置換でコードを書き換える場合は、置換前に必ず出現回数を検査する。

```python
assert h.count(old) == 1
```

## ビルド

```bash
node build.js                      # src/*.js + three.js r128 -> dist/xbuild_dataflow.html
node --check dist/_bundle_check.js # HTML に直接 --check をかけないこと
```

`src/*.js` は CommonJS のまま書く。`import` / `export` を使うとローダが壊れる。

## エラーと警告の使い分け

- **例外 / ノードエラー**: 内部 API の誤用、必須パラメータの欠落、未対応の操作
- **警告 (`ctx.warn`)**: ユーザー入力の不備で、既定の解釈を当てれば処理を続けられるもの

スニペットに打ち間違いがあっただけで下流の全レイヤが消えるのは避ける。

## 実データを扱うときの規律

これらは実データ結合（SPEC.md §17）で実際に踏んだ地雷から来ている。

- **外部メッシュはトポロジ演算の前に必ず頂点溶接する。** Draco 出力は三角形ごとに頂点が複製されている。
- **地理データの原点は独立ソースで検算する。** 変換式が正しくても原点が違えば全部が静かに間違う。
  抽出結果の内容（高さ分布・用途構成）が現実と合うかを必ず確認すること。
- **CityGML の属性はフィーチャ単位であって建物単位ではない。** 1つの構造物が複数フィーチャに分割され、
  同じ measuredHeight を共有している場合がある。
- **配置を勘で決めない。** 干渉数などの判断材料を計算して出力し、警告する。
- **時間依存ノードの cook は時刻の純関数にする。** 前フレームの状態に依存させてはならない
  （任意時刻で呼ばれ、結果がキャッシュされるため）。決定論的な経路 + 弧長で表現する。
- **外部データの型を信用しない。** batchTable は配列でなく dict で来ることがあり、
  建築年に `1.0` のような異常値が混入する。

## 現在地

P1 / P2 / P3 / P4 / P6 / 実データ結合 完了。テスト 87件すべて緑。

`dist/xbuild_dataflow.html` は東静岡アリーナ予定地の実データ（PLATEAU LOD1 1,088棟 +
OSM 道路網 + 人流900体 + 計画アリーナ）で動作する。遅延プル評価・動的な時間依存・
エラー伝播・属性操作・干渉チェックがブラウザ実機で確認済み（SPEC.md §15, §16, §17）。

P4（サブネット + パラメータ昇格 + XDA）はエンジンと形式が確定（SPEC.md §18）。
`'@parent.name'` 参照は cook 時に解決され、変化は push 型 invalidate に変換される
（プル評価とノード単位キャッシュキーは両立しない — §18.3 の罠を読むこと）。

次の候補は P5（For-Each ブロック）、P6.5（ピッキング + 差分更新 + LOD + サブネット編集 UI）、
人流モデルの精緻化（SPEC.md §17.8）。マイルストーン全体は SPEC.md §13 を参照。

## データの再生成

`src/site_data.js` は自動生成物。手で編集しないこと。
再生成の手順は SPEC.md §17.2 を参照（PLATEAU datacatalog API -> b3dm -> Draco -> ENU -> bake）。
