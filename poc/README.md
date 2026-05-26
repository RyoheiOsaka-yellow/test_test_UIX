# Soccer Analysis PoC

サッカー試合自動解析プロダクトの技術検証。

## マイルストーン

- **M1（現在）**：選手・ボール検出 + マルチオブジェクトトラッキング
- M2：ピッチホモグラフィ → 2D タクティカルマップ
- M3：差別化指標（Pitch Control、プレス強度など）

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
