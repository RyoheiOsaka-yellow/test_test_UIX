# 撮影技法ナレッジ md 形式仕様 (v1)

撮影技法を md で共有いただく際、以下のフロントマター付き形式に沿っていれば
`js/data.js` のプリセットへ機械的に変換できます (変換スクリプトはロードマップ)。
**フロントマターがなくても、本文だけの md も受け入れ可能**です。その場合は
手動でプリセット化します。

## 形式

````md
---
id: my-technique            # 半角英数ハイフンのユニークID
name: 技法名
modes: [video, still]       # video / still / outdoor (複数可)
group: 人物ライティング       # ライブラリ上の分類
tags: [ドラマチック, 逆光]
subject: person             # person / bottle / cosme / food / car / arch
background: dark            # dark / black / white / gradient / bright / sunset / night / sky
camera:
  shotSize: CU              # ECU/CU/BS/WS/KS/FF/LS/ELS
  angle: eye                # eye/high/low/birds/dutch/ots
  move: fix                 # fix/pan/tilt/dollyin/... (data.js CAM_MOVES 参照)
  lens: "85"                # 14/24/35/50/85/100m/135/anam
  aperture: F2.8
  shutter: 1/50
  iso: "800"
  fps: 24fps
  wb: 5600K
equipment:                  # 座標系: 1000x700, 被写体(500,330), カメラ(500,600), 100px=1m
  - type: key               # key/fill/back/rim/top/bg/hmi/practical/reflector/flag/diff/drone/sun/fan/smoke
    x: 350
    y: 480
    height: 220             # cm
    power: 70               # 0-100
    colorTemp: 5600         # K
    modifier: ソフトボックス120cm
options: [droplets, gloss]  # デフォルトでONにする演出オプション (data.js SHOT_OPTIONS 参照)
---

## 概要
(技法の説明。ライブラリカードの説明文になります)

## 仕上がりの見え方
(この技法で撮れる画の言語化。カットの「狙い」欄の初期値になります)

## 実施上の注意
(セッティングのコツ、失敗しやすいポイントなど)
````

## 運用ルール

- 1ファイル = 1技法。ファイル名は `id` と一致させる (`my-technique.md`)
- 座標は俯瞰図基準。**カメラは画面下 (500,600) から上方向を向く**前提で配置する
- 出力 (power) は相対値。実機材のワット数は本文の「実施上の注意」に記載
- 新しい機材タイプ・演出オプションが必要な場合は、本文にその旨を書いてもらえれば
  `data.js` 側に追加します
