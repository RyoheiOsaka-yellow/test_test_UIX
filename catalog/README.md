# 触れて、わかる。— WORKS CATALOG

8つのインタラクティブ作品を1枚のカタログにまとめたものです。

```
catalog/
├── index.html          カタログ本体（これをブラウザで開く）
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
- W—02（TESSERA）の AIR モードはカメラ権限を使います。file:// では許可されない場合があるため、
  「別タブ」で開くか、ローカルサーバー経由でご利用ください。

ローカルサーバーで開く場合:

```sh
cd catalog && python3 -m http.server 8000
# → http://localhost:8000/
```
