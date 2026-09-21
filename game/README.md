# GaME 紹介動画（60秒）

[GaME: Gaussian Mapping for Evolving Scenes](https://vladimiryugay.github.io/game/)（CVPR 2026）を紹介する
Hyperframes コンポジション。1920×1080 / 30fps / 60s、GSAP タイムライン 6 シーン構成。

| 時間 | シーン | 内容 |
| --- | --- | --- |
| 0–8s | Hook | 「地図は正確でも、間違っていることがある。」 |
| 8–20s | Problem | 視野外で椅子が動き、地図に古い記憶（STALE）が残るアニメーション |
| 20–28s | Solution | GaME / Gaussian Mapping for Evolving Scenes |
| 28–44s | How it works | Dynamic Scene Adaptation と Keyframe Management を Gaussian マップ上で可視化 |
| 44–53s | Results | PSNR +29.7%、L1 深度誤差 3× 改善 |
| 53–60s | Takeaway | 「自分の記憶が古いと気づける地図がいる。」+ リンク |

## 構成

- `index.html` — メインコンポジション。Gaussian スプラットは seeded LCG で決定的に生成（`Math.random` 不使用）
- `vendor/gsap.min.js` — GSAP 3.14.2 を同梱（レンダリング時のネットワーク依存をなくすため）
- `renders/game-60s.mp4` — レンダリング済み動画

## コマンド

```bash
npm run check    # lint + validate + inspect
npm run render   # renders/game.mp4 に出力
```

Chrome が自動検出されない環境では `HYPERFRAMES_BROWSER_PATH=/path/to/chrome` を指定する。
