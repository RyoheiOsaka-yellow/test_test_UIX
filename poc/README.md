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

実際の試合動画を読み込んで、ブラウザ内で **TensorFlow.js + COCO-SSD** を動かしリアルタイム検出するデモ。サーバ不要・Pythonセットアップ不要、Webブラウザだけで完結。

**操作**
1. ダウンロードした `demo-video.html` をブラウザで開く
2. 試合動画ファイルをドラッグ＆ドロップ（または「ファイルを選択」「Webカメラを使う」）
3. 初回のみ約5MBの検出モデルをCDNから自動取得（要ネット接続、以降ローカル動作）
4. 選手・ボールに bbox + track ID が自動付与される

**含まれる処理**
- COCO-SSD で `person` / `sports ball` を毎フレーム検出
- IoU ベースの greedy トラッキングで track ID を維持
- ジャージ色クラスタリングでチーム自動分類（赤系/青系）
- 4隅クリックによる **手動キャリブレーション** → ホモグラフィ算出 → 2Dマップ投影
- デフォルトは標準的な放送カメラ位置を仮定したトラペゾイドで投影
- Pitch Control（ボロノイ風支配領域）、ボール位置、検出統計

**実映像でうまく動かす際のコツ**
- 固定広角カメラ（Veo型）の映像が最も精度高い
- 「calibrate」トグル → 左奥・右奥・右手前・左手前の順でピッチ4隅をクリックすると 2Dマップが正確になる
- 検出が重い場合は動画の解像度を下げる（720p推奨）

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
