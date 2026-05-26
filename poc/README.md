# Soccer Analysis PoC

サッカー試合自動解析プロダクトの技術検証。

## マイルストーン

- **M1（現在）**：選手・ボール検出 + マルチオブジェクトトラッキング
- M2：ピッチホモグラフィ → 2D タクティカルマップ
- M3：差別化指標（Pitch Control、プレス強度など）

## スタンドアロンHTMLデモ

どちらも単一ファイル。ダウンロードしてダブルクリックでブラウザが開き、即動く。

### `demo.html` — シミュレーション版

ダミーの試合シミュレーションを使い、以下を一画面で見せる：

- **Broadcast Feed** パネル：擬似的なテレビ中継ビュー + YOLO/ByteTrack 風の bbox と track ID オーバーレイ
- **Tactical Map (2D)** パネル：ピッチ座標化後の俯瞰図 + 切り替え可能なオーバーレイ
  - Pitch Control（Voronoi 風の支配領域）
  - パスネットワーク
  - プレス（最近接ディフェンダーと保持者の関係）
  - ヒートマップ
- **Live Metrics**：ポゼッション、PPDA、ブロックハイト、チーム幅・縦長
- **Detected Events**：パス成功、プレス、ターンオーバー等のイベントログ
- **タイムライン**：再生/一時停止、進捗バー、イベントマーカー

実データではなく、戦術シミュレーションで動くダミーデータ。CV パイプラインが完成したときに「このクオリティの可視化を出力する」目標として参照する。

### `demo-video.html` — 実写映像版

実際の試合動画を読み込んで、ブラウザ内で **TensorFlow.js + COCO-SSD (MobileNet v2)** を動かしリアルタイム検出するデモ。サーバ不要・Pythonセットアップ不要、Webブラウザだけで完結。

**操作**
1. ダウンロードした `demo-video.html` をブラウザで開く
2. ロード直後に **Mixkit のサンプル試合映像が自動で再生・解析開始**（要ネット接続）
3. 自分の動画で解析したい場合は、画面上のドロップゾーンに動画ファイルをドラッグ＆ドロップ（または「ファイルを選択」「Webカメラを使う」）
4. 選手・ボールに bbox + track ID が自動付与され、2Dマップに投影される

**含まれる処理**
- **物体検出**：COCO-SSD (MobileNet v2) で `person` / `sports ball` を毎フレーム検出（精度優先、`lite_mobilenet_v2` にフォールバック可）
- **トラッキング**：IoU greedy matching で永続的な track ID 付与、検出フレーム間は bbox を線形補間して滑らかに表示
- **チーム識別**：bbox 上部のジャージ色を EMA でサンプリング → 最初に最も離れた2点でk-means初期化 → オンラインクラスタリング
- **ホモグラフィ**：4-point DLT。デフォルトは broadcast view を仮定したトラペゾイド。「calibrate」モードでピッチ4隅をクリックすれば任意の視点に対応
- **2Dマップ投影**：bbox 底辺中央（足元）を field 座標に変換し、Pitch Control（最近接選手による支配領域）として可視化
- **誤検出フィルタ**：ball は `hits >= 2 && score >= 0.45` のみ通すことで背景の白い物体を除外

**バンドルされているサンプル**
- サンプル①：Mixkit 43499 "Goal play"（8秒、5-6人 + ボール）
- サンプル②：Mixkit 43482 "Semi-pro match"（8秒、4人前後）
- どちらも CORS 対応の royalty-free 配信（[Mixkit License](https://mixkit.co/license/)）

**実映像で精度を出すコツ**
- 固定広角（Veo型）または放送級の中継映像が最適
- 検出が落ちる場合は「calibrate」でピッチ4隅をクリック → 正確なホモグラフィに更新
- COCO-SSD は完全俯瞰のドローン映像では選手をほとんど検出できない（モデルが標準視点で学習されているため）。本格運用ではサッカー特化の追加学習が必要
- 推論速度は GPU 搭載のChrome/Edgeで 30-100ms/frame 程度。CPU only ではかなり遅くなる

## M1: detect_track.py

YOLO で選手とボールを検出し、ByteTrack で永続的な track ID を付与する最小パイプライン。

### セットアップ

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

GPU を使う場合は事前に CUDA 対応版 PyTorch を入れておく。

### 実行

```bash
python detect_track.py \
  --source path/to/match.mp4 \
  --output annotated.mp4 \
  --data tracks.json
```

主なオプション：

| flag | 用途 |
|---|---|
| `--model` | Ultralytics モデル（既定 `yolov8x.pt`、軽量化したい場合 `yolov8n.pt`） |
| `--conf` | 検出信頼度の閾値（既定 0.3） |
| `--device` | `cuda` / `cpu` / `mps` |
| `--stride` | N フレームごとに処理（負荷削減用） |

### 出力

- `annotated.mp4` — bbox と track ID を描画した検証用映像
- `tracks.json` — フレームごとの検出結果（bbox、track_id、class、confidence）

### 検証推奨

- **固定広角カメラ（Veo 型）の映像**で最初に検証する。放送映像は画面外選手の問題があり M2 のピッチ座標変換と合わせて扱う。
- 30 秒〜1 分のクリップで動作確認 → ID switch の頻度、ボール検出の取りこぼしを確認する。

### 既知の限界

- COCO の汎用クラスを使用しているため、ジャージ番号やチーム識別はまだない。サッカー特化データセット（SoccerNet 等）でのファインチューンが次の改善ポイント。
- ByteTrack は遮蔽に弱いため、密集シーンでは ID switch が発生する。
