# 🪟 Screen Window — 頭部追跡 × 3D Gaussian Splat 立体視デモ

ノートPCの画面を「窓」に変えるWebデモです。HMD（ヘッドマウントディスプレイ）は不要、Webブラウザ単体で動作します。

PlayCanvas創業者 [Will Eastcott氏](https://x.com/willeastcott) が公開したデモ

> Turned my laptop screen into a window. 🪟
> The webcam tracks my head position via MediaPipe, and the @PlayCanvas Engine renders a 3D Gaussian splat with an off-axis projection - so her gun barrel seems to pop out from the screen. 🔫

を参考に、同じ構成（Webカメラ + MediaPipe + PlayCanvas Engine + off-axis projection）で実装しています。

## 仕組み

1. **頭部追跡** — Webカメラの映像を [MediaPipe FaceLandmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) で解析し、左右の虹彩中心（ランドマーク468 / 473）を取得します。
   - 両目の中間点 → 顔の上下左右位置
   - 両目の見かけの間隔 → 画面からの距離（間隔に反比例）
   - One Euro Filter で平滑化（静止時は滑らか、素早い動きは低遅延）
2. **off-axis projection（軸外し投影）** — 画面の四隅と目の位置から非対称の視錐台を構成します（Kooima の Generalized Perspective Projection の、画面に正対した特殊形）。PlayCanvas の `camera.calculateProjection` コールバックで投影行列を毎フレーム差し替えています。
3. **3D Gaussian Splat** — [PlayCanvas Engine](https://github.com/playcanvas/engine) の gsplat コンポーネントで `.ply` / `.compressed.ply` / `.sog` を描画。モデルの前面が画面平面 (z=0) より手前に来るよう配置することで、「画面から飛び出す」見え方になります。

頭を動かすと、目の位置に合わせて視錐台が変形し、画面の縁が本物の窓枠のように振る舞います。

## 使い方

静的ファイルのみで動くので、任意のHTTPサーバーで配信するだけです（Webカメラ利用のため `https://` か `http://localhost` が必要）。

```bash
cd head-tracking-splat
npx serve .          # または python3 -m http.server 8000
# → http://localhost:3000 を開く
```

1. **「📷 トラッキング開始」** を押してWebカメラを許可
2. 画面の正面・約50cmの位置に顔を置き、**C キー**（またはキャリブレーションボタン）で基準位置を設定（初回検出時は自動設定）
3. 頭を左右・上下・前後に動かすと視点が変わります

Webカメラが使えない環境では **マウスモード**（マウス移動で視点、ホイールで距離）で試せます。

### 調整項目

| 項目 | 説明 |
|---|---|
| 画面の横幅（実寸） | 使用しているディスプレイの物理的な横幅。実寸に合わせると動きのスケールが正確になります |
| 視差の強さ | 頭の動きに対する視点移動の誇張率。1.0が実寸相当 |
| 飛び出し量 | モデル前面を画面平面からどれだけ手前に出すか |
| モデルの大きさ / 回転 / 上下位置 | 表示中のSplatの配置調整 |
| 奥行きグリッド | 画面の奥に伸びるトンネル状のガイド線（立体感の手がかり） |

### Splatの差し替え

- `.ply` / `.compressed.ply` / `.sog` ファイルをページに**ドラッグ＆ドロップ**
- URLパラメータで指定: `index.html?splat=https://example.com/scene.compressed.ply`（CORS許可が必要）

デフォルトでは PlayCanvas Engine のサンプルアセット `biker.compressed.ply` を読み込みます。高品質なSplatは [Dymensium](https://www.dymensium.com/en) や [SuperSplat](https://superspl.at/) などで入手・作成できます。

## 技術スタック

- [PlayCanvas Engine 2.x](https://github.com/playcanvas/engine)（CDN・ビルド不要）
- [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe)（FaceLandmarker, WASM）
- 依存インストール不要の単一 `index.html`

## クレジット

- 原案デモ: [Will Eastcott (@willeastcott)](https://x.com/willeastcott) — PlayCanvas創業者
- エンジン: [PlayCanvas](https://github.com/playcanvas)
- 元デモのSplat提供: [Dymensium (@dymensium)](https://www.dymensium.com/en)
- サンプルSplat: PlayCanvas Engine examples (`biker.compressed.ply`)
