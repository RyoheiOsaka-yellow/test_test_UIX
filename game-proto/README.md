# game-proto — GaME を CPU で動かすプロトタイプ

[GaME: Gaussian Mapping for Evolving Scenes](https://github.com/VladimirYugay/GaME)（CVPR 2026）の
コアである **動的シーン適応（Dynamic Scene Adaptation）** と **キーフレーム管理（Keyframe Management）** を、
CUDA・SAM・実データセットなしで実行・検証できるように移植したものです。

本家は CUDA ラスタライザ（diff-gaussian-rasterization / FlashSplat）、faiss-gpu、SAM マスク付き RGB-D
データ（Flat / Aria）を前提にしており、GPU のない環境ではそのまま動きません。
このプロトタイプは次の 3 つを差し替えて同じアルゴリズムを回します。

| 本家 | プロトタイプ |
| --- | --- |
| FlashSplat CUDA ラスタライザ | `gameproto/splat.py` — PyTorch CPU の微分可能 3DGS レンダラ（色・深度・alpha・可視性・投影座標、`used_mask` 対応） |
| Flat / Aria データセット + SAM マスク | `gameproto/scene.py` — 合成 RGB-D ルーム（床・壁・箱）をレイキャストで生成。インスタンスマスクが SAM マスクの代わり |
| `src/entities/game.py` | `gameproto/game.py` — 同じ制御フローと閾値で移植（追加検出 → 共可視フレームへのオクルージョン伝播、削除検出 → 矛盾 Gaussian の刈り込み、オクルージョンマスク付き最適化、`ignored_frames`） |

## セットアップ

```bash
pip install numpy scipy pillow imageio pytest
pip install torch --index-url https://download.pytorch.org/whl/cpu
```

## 実行

```bash
python demo.py            # 約 20 分（CPU 4 コア）。--frames / --iters で短縮可
python -m pytest -q tests # 単体 + 統合テスト（約 2 分）
```

`demo.py` のシナリオ:

1. **run 1** — 椅子が左（A）にある部屋をカメラが左から右へスイープ
2. **変化** — カメラが見ていない間に椅子を右（B）へ移動
3. **run 2** — 同じ軌道でもう一度スイープ

同じパイプラインを 2 系統で走らせて比較します。

- `static` — 変更検出を切った増分 Gaussian マッピング（古いキーフレームを正しい制約として使い続ける）
- `game` — GaME 移植版

出力（`output/`）: `metrics.json`, `log.txt`, `comparison.png`（GT / static / game）, `depth_error.png`,
`occlusion_masks.png`（GaME が「古い」と判定した run-1 キーフレームの領域）, `sweep.gif`。

## 本家との差分（意図的な簡略化）

- 色損失は L1 のみ（DSSIM 項なし）。SH は 0 次（RGB 直値）。
- 最終の refinement（densify / opacity reset）は未移植。増分マッピングのループのみ。
- 本家のスケール依存定数（`reproject_points` の 1.0 m スラック、追加検出の 2.0 m ギャップ、5×5 モルフォロジー）は
  部屋が 5 m 四方なので設定値で縮小している（`demo.py` 参照）。
- 姿勢は既知（本家も現状は identity tracking）。

## 結果（`python demo.py`、80×60、各 run 7 フレーム、CPU 4 コア）

run 2（椅子を A→B に移動した後の部屋）に対する評価:

| system | PSNR | 深度 L1 | Gaussian 数 | 旧位置 A に残った Gaussian | 新位置 B の Gaussian | 所要時間 |
| --- | --- | --- | --- | --- | --- | --- |
| static（変更検出なし） | 28.91 dB | 0.0274 m | 6648 | 249（幽霊） | 220 | 1164 s |
| game（GaME 移植） | 34.24 dB | 0.0113 m | 6155 | 2 | 121 | 546 s |

run 1 直後は両者とも 32.68 dB / 0.0116 m で完全に一致する（同じパイプラインで、差は変更検出の有無だけ）。
`output/tiled/` は `--tiles 3` で床・壁マスクを SAM 風に分割した実験で、数値は同一だが
オクルージョンマスクが「椅子が今ある床タイル」だけに局在する（`output/occlusion_masks.png` と比較）。

## 観察と本家に対する示唆

- **マスク粒度が挙動を決める。** 本家の「マスク面積の 1% 以上が矛盾なら、そのマスク全体を最適化から外す」
  （`removal_coverage_threshold`）は、SAM の細かいセグメントを前提にしている。床が 1 枚のマスクだと床全体が
  除外される（`output/occlusion_masks.png`）。`--tiles 3` で解消。
- **古いキーフレームはかなり積極的に捨てられる。** 椅子が移動した後、run-1 の全キーフレームが `ignored_frames`
  に入った（椅子マスクが 100% オクルージョン、または新しい椅子の再投影 `cover_score > 0.2`）。
  数値上は問題ないが、「情報を最大限保持する」観点では、フレーム単位ではなくマスク単位で除外する余地がある。
- **削除検出の誤検知はごく少ない。** run 2 の最終フレームで 4 個の Gaussian が誤って削除され、run-2 の
  キーフレームにも小さなオクルージョンマスクが付いた（境界画素の深度不一致）。5×5 モルフォロジーが効く解像度なら
  抑えられるはず。
