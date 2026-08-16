# YELLOW — edge-on black hole mark

TON 618 の降着円盤を真横（エッジオン）に回したシンボル。YELLOW のロゴタイプと
同じ線幅の黒い線だけで引いてあり、文字には重ねず横に置いて使う。

## ロゴタイプについて

このディレクトリの `YELLOW` の文字は**仮組み**。支給されたロゴが画像だったため、
比較検討用に同じ骨格（キャップハイト 100 / 線幅 3.4 = 1:29 / 字間 0.72 H）で
引き直したもの。元のベクターデータを `generate_logos.py` の `LETTERS` と差し替えれば
確定版になる。マーク側の作図は影響を受けない。

## 生成

```bash
python3 generate_logos.py            # SVG を書き出す（ring / solid の配置案）
python3 generate_logos.py lens       # 別の形で配置案を出す
python3 export_png.py                # png/ に PNG を書き出す
python3 build_sheet.py               # 検討シート brand-sheet.html を組む
```

SVG が原本。比率・形を変えるときは `generate_logos.py` を編集して再生成する。

## ファイル

| ファイル | 内容 |
| --- | --- |
| `yellow-mark-{ring,solid,lens,lens-solid}.svg` | マーク単体・形の4案 |
| `yellow-mark-knockout.svg` | 黒地用（白線） |
| `yellow-place-{a..h}-{ring,solid}.svg` | 配置案 A–H |
| `yellow-mark-construction.svg` | 作図・寸法図 |
| `brand-sheet.html` | 検討シート（SVG をインライン化した単体ページ） |
| `png/` | 書き出し済み PNG |

## 作図

穴の半径 `r` とキャップハイト `H` の比で全寸法を持つ。

| 要素 | 値 |
| --- | --- |
| 線幅 | 0.034 H（ロゴタイプと同一。拡大しても太らせない） |
| 穴（光子球） | r = 0.42 H（O の字幅と同じ直径） |
| 事象の地平面 | 0.80 r（solid のみ） |
| 円盤 | ±2.90 r / 開き 0.22 r |
| レンズ弧 | ±1.34 r（lens のみ） |
| 字とマークの間隔 | 0.72 H（＝字間） |

書き出した SVG には字間ひとつ分の余白が含まれる。ファイルの外形をそのまま詰めれば
クリアスペースを満たす。
