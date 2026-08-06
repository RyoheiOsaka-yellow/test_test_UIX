# AnyFit — AI Virtual Try-On Prototype

[anywear.decart.ai](https://anywear.decart.ai) を参考にした学習用の再現プロトタイプです。
商品・ブランド・価格はすべてダミーです。

## できること

- **カメラ試着(リアルタイム追従)** — MediaPipe Pose Landmarker(ブラウザ内AI)で肩の位置・幅・傾きを毎フレーム検出し、服が体の動きに追従します。映像は端末外に送信されません。
- **写真試着** — 自分の写真をアップロードすると、写真内の人物を検出して服をフィットさせます。
- **モデル写真試着** — カメラなしでも試せるフォールバックモード。
- 服はルックブックからドラッグ&ドロップ(またはタップ/タッチドラッグ)で着せ替え。

## 起動方法

静的サイトなのでHTTPサーバーで配信するだけです:

```bash
cd virtual-tryon
python3 -m http.server 8000
# → http://localhost:8000 を開く
```

- カメラは **https または localhost** でのみ有効(ブラウザの仕様)。
- `vendor/` にMediaPipeのWASM・モデルを同梱済み(オフライン動作可)。読み込みに失敗した場合はCDNへ自動フォールバックします。
- GitHub Pagesにそのままデプロイ可能です。

## 構成

| ファイル | 内容 |
|---|---|
| `index.html` | サイト本体(UI・服のSVG生成・ポーズ追従エンジンすべて込み) |
| `vendor/vision_bundle.mjs` | MediaPipe Tasks Vision (Apache-2.0) |
| `vendor/wasm/` | 推論用WASMランタイム |
| `vendor/pose_landmarker_lite.task` | ポーズ推定モデル (Apache-2.0) |


## 実写アセットについて

- 服・モデルの写真は **Unsplash**([Unsplash License](https://unsplash.com/license) — 商用・非商用とも無償利用可)の実写素材です。
  - 服: photo-1591047139829(ボンバー), photo-1618354691373(黒Tee), photo-1596755094514(シャンブレー), photo-1576566588028(プリントTee), photo-1434389677669(ポンチョ)
  - モデル: photo-1567532939604(女性), photo-1521572163474(男性)
- 試着用カットアウトは `process.js`(リポジトリ外のビルドスクリプト)で生成:
  クロップ → 縁からのフラッドフィル背景除去(背景色はロバスト平面フィットでモデル化)→ ハンガー等の手動マスク → モルフォロジカル・クロージング → アルファぼかし → WebP出力。
- モデル写真は表示時にポーズ推定AIで解析し、肩の位置・幅・傾きから服をフィットさせています(事前の座標ハードコードなし)。

## 仕組み

1. `getUserMedia` でカメラ映像を表示(セルフィーミラー反転)
2. Pose Landmarker が33関節を検出 → 左右の肩(landmark 11/12)を使用
3. 肩幅→服のスケール、肩線の角度→服の回転、肩中点→アンカー位置を毎フレーム計算
4. 指数スムージングをかけてCSS transformで服レイヤーを追従させる
