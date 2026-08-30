# 触れて、わかる。— WORKS CATALOG

8つのインタラクティブ作品を1枚のカタログにまとめたものです。

## 3つの形

| ファイル | 用途 |
|---|---|
| `catalog-visual.html` | **画像カタログ（6.1MB）。** XBUILD事例集デザイン。作品ごとに大1・中3・小6のスクリーンショット＋案件背景・できること・活用シーン・仕様表。ライトボックス拡大つき。 |
| `catalog-standalone.html` | **1ファイル完結版（28.6MB）。** 8作品を内蔵しているので、これ1枚を配ればそのまま動く。 |
| `index.html` + `works/` | 分割版。作品を差し替え・追記したいときはこちら。編集後 `python3 build-standalone.py` で1ファイル版を再生成。 |

内蔵版は各作品を `<script type="text/plain">` に生のまま持ち、「RUN LIVE」を押した時点で
Blob URL に変換して iframe に渡します。開いた瞬間に28MB分が走ることはありません。

```
catalog/
├── catalog-standalone.html   1ファイル完結版（配布用）
├── build-standalone.py       上を生成するスクリプト
├── index.html          カタログ本体（分割版・これをブラウザで開く）
└── works/              各作品のオリジナルHTML（無改変）
    ├── 01-tonbo-ink.html          tonbo ink — WebGPU 流体インク
    ├── 02-tessera.html            TESSERA — quadtree field
    ├── 03-fish-boids.html         fish — mathcat / Boids
    ├── 04-phenomena.html          PHENOMENA — 22宇宙 332現象
    ├── 05-sf-drafter.html         SF建築 手描きドラフター
    ├── 06-flowlab-3d.html         FLOW·LAB 3D — 加須工場 + BIM/MEP
    ├── 07-green-expo-2027.html    GREEN×EXPO 2027 展示企画 実績資料
    └── 08-haneda-dashboard.html   羽田イノベーションシティ 3Dダッシュボード
```

## ストーリー

**01 表現 → 02 学び → 03 建築 → 04 体験 → 05 行政デザイン**

先端技術でアート・表現・インタラクティブデザインをつくり（01）、
そこで得た「場の計算」にモデルと検証を足して学びに変え（02）、
生成と評価のループを設計へ落とし（03）、
身体で分かる展示体験にひらき（04）、
最後に街と制度の意思決定の道具にする（05）。

## 使い方

`catalog/index.html` をブラウザで開くだけです（サーバー不要）。

- 各作品のデモは **「RUN LIVE」を押したときだけ** iframe で読み込まれます。
  W—06（4MB）／W—07（11MB）／W—08（13.6MB）は重いため、必要なときだけ開いてください。
- 「停止」でアンロードしてメモリを解放できます。
- W—01（tonbo ink）は **WebGPU 対応ブラウザ**（最新の Chrome / Edge / Safari）が必要です。
- W—02（TESSERA）の AIR モード（カメラ入力）はブラウザが「安全なコンテキスト」を要求するため、
  `file://` から開いた場合は動作しません。下記のローカルサーバー経由か https で開いてください。
  それ以外の機能はすべて `file://` で動作します。

ローカルサーバーで開く場合:

```sh
cd catalog && python3 -m http.server 8000
# → http://localhost:8000/
```
