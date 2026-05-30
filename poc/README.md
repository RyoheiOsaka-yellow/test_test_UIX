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

実際の試合動画を読み込んで、ブラウザ内で **サッカー特化 YOLOv8 (ONNX, 4クラス) → onnxruntime-web** を動かしリアルタイム検出するデモ。汎用COCO-SSDが取れなかった `referee` / `goalkeeper` / `player` / `ball` を区別。読み込み失敗時はCOCO-SSDへ自動フォールバック。サーバ不要・Pythonセットアップ不要、Webブラウザだけで完結。

**操作**
1. ダウンロードした `demo-video.html` をブラウザで開く
2. ロード直後に **Mixkit のサンプル試合映像が自動で再生・解析開始**（要ネット接続）
3. 自分の動画で解析したい場合は、画面上のドロップゾーンに動画ファイルをドラッグ＆ドロップ（または「ファイルを選択」「Webカメラを使う」）
4. 選手・ボールに bbox + track ID が自動付与され、2Dマップに投影される

**含まれる処理**
- **物体検出（メイン）**：[uisikdag/yolo-v8-football-players-detection](https://huggingface.co/uisikdag/yolo-v8-football-players-detection) を ONNX (640×640, opset12) にエクスポートし、onnxruntime-web (WASM-SIMD) で実行。4クラス（ball / goalkeeper / player / referee）、mAP@0.5 = 0.785。前処理（640正規化）→ NCHW テンソル → 推論 → クラス毎 NMS まで JS 実装
- **物体検出（フォールバック）**：ONNXモデルがロードできない場合は COCO-SSD (MobileNet v2) に自動切替
- **トラッキング**：IoU greedy matching で永続的な track ID 付与、検出フレーム間は bbox を線形補間して滑らかに表示
- **チーム識別**：bbox 上部のジャージ色を EMA でサンプリング → 最初に最も離れた2点でk-means初期化 → オンラインクラスタリング
- **ホモグラフィ**：4-point DLT。デフォルトは broadcast view を仮定したトラペゾイド。「calibrate」モードでピッチ4隅をクリックすれば任意の視点に対応
- **2Dマップ投影**：bbox 底辺中央（足元）を field 座標に変換し、Pitch Control（最近接選手による支配領域）として可視化
- **誤検出フィルタ**：ball は `hits >= 2 && score >= 0.45` のみ通すことで背景の白い物体を除外
- **イベント検出**：ボール保持者の遷移を状態機械で監視 → **PASS / TURNOVER / PRESS / RECOVERY** を自動抽出
  - 保持者：ボール位置（検出 or 両チーム最近接ペアの中点）からスクリーン距離が最も近い選手
  - PASS：同チーム内で保持者が変わる
  - TURNOVER：相手チームに保持者が変わる
  - PRESS：保持者から3m相当以内に相手選手が侵入したとき
  - ID Switch ノイズ抑制：保持時間 < 0.3s や直近 0.4s 以内のイベントは無視
- **可視化**：保持者に `BALL` バッジ、プレス中の相手にオレンジ点線リング、2Dマップに直近6秒のパス矢印、タイムライン下部にチーム色マーカー
- **メトリクス**：パス数 H/A、プレス数、ターンオーバー数、保持中の選手ID、累積ポゼッション %
- **スムージング（描画品質）**：
  - 検出フレーム間は bbox の速度を推定して外挿（最大0.4秒）→ 速い選手でも枠が遅れない
  - 時間ベースの指数平滑（フレームレート非依存）で追従をなめらかに
  - トラックの出現/消失をフェードイン・フェードアウト（パッと出て消えない）
  - チーム色はヒステリシス付き割り当てでちらつき防止
  - Pitch Control は低解像度オフスクリーン → スムージング拡大で柔らかいグラデーション（毎フレーム1600回の塗りを廃止し、約8回/秒に間引き）
  - canvas のバッキングストアはサイズ変化時のみ再確保（毎フレームの再アロケート/クリアによる jank を解消）
- **俯瞰の移動軌跡（movement）**：検出した各選手をピッチ座標に投影し、移動経路を時系列で蓄積 → 2Dマップにチーム色で描画。古い区間ほど薄く、直近の動きが濃く見える。「どの選手がどう動いたか」を俯瞰で確認できる

**バンドルされているサンプル（すべて実際のセミプロ試合映像）**
- 実試合①：Mixkit 43499 "Goal play"（8秒、5-6人 + ボール）
- 実試合②：Mixkit 43482 "Semi-pro match"（8秒、4人前後）
- 実試合③：Mixkit 43481 "Two teams"（5秒）
- いずれも CORS 対応の royalty-free 配信（[Mixkit License](https://mixkit.co/license/)）

**実映像で精度を出すコツ**
- 固定広角（Veo型）または放送級の中継映像が最適
- 検出が落ちる場合は「calibrate」でピッチ4隅をクリック → 正確なホモグラフィに更新（移動軌跡も正確になる）
- 完全俯瞰（ドローン/タクティカルカメラ）の映像は、サッカー特化モデルでも検出数が落ちる（学習データの多くが放送/グラウンドレベル視点）。ベンチでは地上アングルで 5-17 人検出、俯瞰では 1-2 人。さらに上を目指すなら SoccerNet で追加ファインチューン推奨
- 推論速度：onnxruntime-web の WASM-SIMD で 100-300ms/frame（実機ブラウザ）。WebGPU 実行プロバイダが利用可能なら 30-80ms/frame まで短縮可能

**モデルファイル**
- `models/soccer-yolov8.onnx`（約43MB）。ローカル配置とCDNフォールバック（jsdelivr経由のGitHub raw）の両対応
- 元の `.pt` 重みは [HuggingFace](https://huggingface.co/uisikdag/yolo-v8-football-players-detection) より取得し、`ultralytics` の `model.export(format='onnx')` で変換

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
