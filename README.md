# JEV 外観検査プロトタイプ

工場ラインを想定したリアルタイム AI 外観検査の Web プロトタイプです。
映像認識層が物体（ボトル / 小包 / 基板）を検出し、**Jev 判断エンジン** が構造化された状態から
「合格 / 再検査 / 不良 / 要確認」を決め、さらにライン全体の判断（正常 / 注視 / 減速 / 停止）を行い、
工場向けの監視ダッシュボードに表示します。

3つの **検査プロファイル** を同梱しています（画面上部のボタンで切替）:

| プロファイル | 映像 | 物体検出 | 検査属性（疑似注入） | 判定トリガー |
| --- | --- | --- | --- | --- |
| ボトルキャップ検査 | ビール瓶の充填ライン | YOLO11（COCO の bottle） | キャップ有無 | 縦ゲート、左→右 |
| 小包ラベル検査 | 小包のローラーコンベア | Grounding DINO（文字指定 "cardboard box"） | 配送ラベル有無 | 縦ゲート、右→左 |
| 基板実装検査 | 電子基板の組立ステーション | Grounding DINO（文字指定 "circuit board"） | 部品実装の有無 | ゾーン滞留（作業ステーション） |
| 充填量検査 | 合成映像（充填ライン） | 合成トラック | **充填率を画素解析で実測**（疑似注入ではない） | 縦ゲート、充填後 |
| 転倒検知 | UR Fall Detection Dataset（研究用途） | YOLO11-Pose + BoT-SORT（骨格 17 点） | **5 特徴量の時系列判定**（疑似注入ではない） | 状態遷移（転倒が続いたら判定） |
| 横断歩道 安全監視 | Wikimedia Commons（CC BY-SA 4.0） | YOLO11m + BoT-SORT（人・自転車・車両） | **場面解析**（ゾーン + 車両接近、疑似注入ではない） | 状態遷移（危険が続いたら判定） |
| 路面損傷スキャン | Mixkit（田舎道のポットホール） | 公開ポットホール分割モデル + ByteTrack | **検出枠の面積から重症度**（疑似注入ではない） | 横ゲート（手前に来た時点で判定） |

フェーズ1は、**学習済みモデル・有料サービス・専用バックエンドなし** で動く完全なプロトタイプです。
アーキテクチャは本番版を想定し、映像認識層と判断層だけがアダプタで差し替え可能になっています。

> **正直な表示について**
> このプロトタイプは「本当に AI がキャップを検出している」ように偽装しません。
> - 物体の位置（枠）: 同梱の実映像に対して検出器 + ByteTrack を **事前に** 実行した追跡結果を再生
> - 検査属性（キャップ / ラベル / 部品の有無）: 専用モデルが無いため、シナリオに従って **疑似的に注入**（画面に「疑似注入」と明記）
> - 追跡結果が無い映像は使わず、合成映像に切り替える（実映像の上に作り物の枠を出さない）
> - 判断エンジン: `TYPESAFE_API_KEY` が無い間はルールベースの模擬（画面に「シミュレーション」と明記）

---

## アーキテクチャ

```
映像  (HTML5 <video> / 合成映像。本番は RTSP)
  ↓
物体検出  (videoDetectionSimulator.ts。本番は YOLO / RT-DETR + ByteTrack)
  ↓
構造化イベント  (eventBus.ts: 進入 → 検査開始 → … → 退出)
  ↓
JEV 判断エンジン  (decisionEngine.ts のアダプタ → キーがあれば jevDecisionEngine.ts)
  ↓
処置 / 警報 / 分類  (合格 · 再検査 · 不良 · 要確認 / ライン: 正常 · 注視 · 減速 · 停止)
  ↓
ダッシュボード  (inspectionStore.ts → React パネル。枠の描画は requestAnimationFrame の Canvas)
```

| 層 | フェーズ1の実装 | 本番での置き換え |
| --- | --- | --- |
| 映像認識 | `services/videoDetectionSimulator.ts` が `public/demo/<プロファイル>/detections.json`（事前追跡）または合成トラックを再生 | ONNX Runtime / TensorRT / OpenVINO 上の検出モデル + ByteTrack が同じ `FrameDetection` を出力 |
| Jev 判断 | `services/decisionEngine.ts`（ルールベース） | `services/jevDecisionEngine.ts`（実装済み。`TYPESAFE_API_KEY` で有効化） |
| ダッシュボード | React + Tailwind + Recharts | そのまま |

### Jev は画像認識モデルでもチャットボットでもない

映像認識層は構造化された状態を作り、判断エンジンには **明示した選択肢の中から選ばせる** だけです。
「どうしたらいい？」とは絶対に聞きません。

```jsonc
// 物体レベル（services/jevDecisionEngine.ts の JevObjectRequest）。task と attribute はプロファイルが決める
{
  "task": "bottle_cap_inspection",
  "level": "object",
  "state": {
    "object_type": "bottle",
    "object_id": "#014",
    "attribute": "cap",
    "object_confidence": 0.98,
    "attribute_confidence": 0.17,
    "alignment_score": 0.21,
    "inspection_zone": true,
    "previous_failures": 0,
    "previous_state": "normal"
  },
  "options": ["PASS", "RECHECK", "REJECT", "HUMAN_REVIEW"]
}
// → { "decision": "REJECT", "confidence": 0.96, "reason": "CAP_MISSING" }
```

```jsonc
// ラインレベル（第2階層の Jev。直近60秒の統計を5秒ごとに評価）
{
  "task": "bottle_cap_inspection",
  "level": "line",
  "state": { "reject_rate": 0.12, "normal_rate": 0.05, "camera_confidence": 0.98,
             "line_speed_bpm": 132, "previous_failures": 1, "window_seconds": 60 },
  "options": ["NORMAL", "WATCH", "SLOW_LINE", "STOP_LINE", "HUMAN_REVIEW"]
}
```

判断には必ず確信度が付きます。0.65 未満は **JEV 判断不確実** として「人による確認待ち」に回り、
担当者が 合格 / 不良 を選びます（`HUMAN_OVERRIDE` として記録）。

---

## 使い方

```bash
npm install
npm run dev        # http://localhost:5173
```

ページを開いて **デモ開始** を押してください。数秒でキャップ無しのボトルが検査ゲートに到達し、
Jev が「不良」を返し、排出（模擬）→ KPI・イベントログ・チャート・異常パネルが更新されます。

その他のコマンド:

```bash
npm run build          # 型チェック + 本番ビルド（dist/）
npm run build:single   # JS/CSS/動画/追跡結果を1つの HTML に埋め込む → dist/jev-visual-inspection.html
npm run typecheck
npm run gen:detections # 合成シナリオから detections.json を再生成（実映像を使わない場合）
npm run track:bottle   # ボトル映像に YOLO11 + ByteTrack を掛けて追跡結果を再生成
npm run track:parcel   # 小包映像に Grounding DINO（文字指定）を掛けて再生成
npm run track:pcb      # 基板映像に Grounding DINO（文字指定）を掛けて再生成
npm run track:fall     # 転倒映像に YOLO11-Pose + BoT-SORT を掛けて骨格を再生成
npm run track:crosswalk # 横断歩道映像に YOLO11m + BoT-SORT（人・自転車・車両）を掛けて再生成
npm run track:road      # 路面映像にポットホール分割モデル + ByteTrack を掛けて再生成
```

キーボード: `Space` で再生 / 一時停止。

---

## シミュレーションモード（モード A・既定）

* 外部サービス不要。オフラインで動作。
* 物体の判断ルール（`services/decisionEngine.ts`）。しきい値は検査属性の信頼度に対して掛かる:

  | 属性の信頼度 | 判断 |
  | --- | --- |
  | 0.75 以上 | 合格 |
  | 0.45 〜 0.75 | 再検査（1回だけ再サンプリングし、合格 / 要確認へ） |
  | 0.20 〜 0.45 | 要確認 |
  | 0.20 未満 | 不良 |

* ライン判断: 直近60秒の不良率（標本が少ない間は基準値 5% へ縮約）→ 正常 / 注視 / 減速 / 停止。
  カメラ信頼度 0.7 未満 → 要確認。
* 判断遅延は 40〜110 ミリ秒を模擬し、KPI「判断遅延」に反映。

### デモ動画と追跡データ

`public/demo/<プロファイル>/` に `video.mp4`、`detections.json`、`CREDIT.txt` を置きます。
同梱の3本はすべて Mixkit の無料素材（Mixkit Stock Video Free License、商用可・クレジット不要）で、
追跡結果は `scripts/track_video.py` で事前計算したものです。

* 動画を差し替える場合: `video.mp4` を置き換え、`npm run track:<プロファイル>` で追跡結果を作り直す。
  * COCO の標準クラスにある物体（ボトル、缶、人など）: `scripts/track_video.py --coco <クラス名>`（YOLO11 + ByteTrack。`pip install ultralytics opencv-python-headless`）
  * それ以外の物体: `scripts/track_video_gdino.py --prompt "<英語の物体名>."`（Grounding DINO + 簡易追跡。`pip install torch transformers pillow opencv-python-headless`。
    CPU では 1 フレーム数秒かかるので `--stride` で間引き、間はアプリが補間する）
  * `scripts/track_video.py --world "<英語の物体名>"` で YOLO-World も使えるが、小包・基板ではほとんど検出できなかった。
* 追跡結果が無い動画は使いません（合成映像に切り替わり、イベントログに理由を出します）。
* 動画が無い場合: **合成映像** をキャンバスに描画して同じパイプラインを最後まで動かします（画面に「合成映像」と表示）。

### 充填量検査（液面の実測）

4つ目のプロファイルは、これまでの「属性の有無を疑似注入する」方式ではなく、
**液面を画素から実測** します（`src/services/fillLevelMeter.ts`）。

1. 検出枠の中を小さく切り出し（40 px 幅）、各行の「液体らしさ」を HSV で採点する（彩度が高く明度がやや低い行ほど液体）。
2. 上下の極端な行を捨て、p10 / p90 のパーセンタイルから閾値を決める（明るさの変化に強い）。
3. 下から走査して液面の行を求める。左右の列で別々に求め、その差から液面の傾きを推定し、
   平均高さを充填率にする（傾いた円筒は左右の平均高さが体積相当）。
4. フレーム間は移動平均で平滑化し、ゲート通過時点の値で Jev が判断する
   （目標 80% ±4pt: 許容内 → 合格、2倍以内 → 再計測、それ以上 → 充填不足 / 過充填、液面を特定できない → 要確認）。

無料素材に液体が透けて見える充填ラインの映像が無かったため、映像はキャンバスに合成しています
（半透明ボトル、充填ノズル、傾いた液面、コントラストの低い液体などを含む）。
計測は描画パラメータを一切見ずに画素だけから行うので、画面には真値との誤差（平均絶対誤差）を表示しています。
`public/demo/fill-level/video.mp4` と追跡結果を置けば、同じ計測コードが実映像に対して走ります。
実映像ではボトルの形に合わせて `neckFraction` / `bottomFraction`（胴の上端・下端）を調整してください。

### 転倒検知（骨格 + 時系列判定）

5つ目のプロファイルは人物が対象で、ゲートではなく **状態遷移** で判定します。

1. `scripts/track_pose.py` が YOLO11-Pose + BoT-SORT で人物の骨格（COCO 17 点）を追跡し、`detections.json` に保存
   （転倒の瞬間に追跡が途切れて別 ID になりやすいので、近い位置・短い時間差のトラックは結合）。
2. `src/services/fallDetector.ts` がフレームごとに 5 つの特徴量を計算:
   体の位置（腰の低下量）、角度（胴の傾き）、形状（枠の縦横比）、動き（腰の速度）、姿勢信頼度。
3. 約 1 秒の窓で状態機械を回し、正常 → 転倒中 → 転倒（床上）を判定。1 フレームでは「素早く座る」と区別できないため、
   急な下降を見た後に横たわった姿勢が続くことを確定条件にしています（同梱映像の「座る」動作は警報になりません）。
4. 床上に一定時間とどまったら Jev に構造化状態（状態・転倒スコア・床上時間・5 特徴量）を渡し、
   異常なし / 経過観察 / 転倒 警報 / 要確認 から選ばせます。警報は起き上がりを確認するまで続きます。

参考にした実装では LSTM で 3 状態を分類していますが、この環境には学習データが無いため、同じ 5 特徴量を使った
規則ベースの判定にしています。LSTM を学習したら `fallDetector.ts` の `update()` を差し替えるだけです
（ONNX Runtime Web でブラウザ内推論も可能）。

同梱映像は UR Fall Detection Dataset（CC BY-NC-SA 4.0、**非商用の学術利用向け**）の RGB を連結したものです。
商用のデモに使う場合は自社の映像に差し替えてください（`public/demo/fall-detection/video.mp4` を置いて
`python scripts/track_pose.py ...` を実行）。

### 横断歩道 安全監視（複数クラス + ゾーン + 場面解析）

6つ目のプロファイルは、複数クラスの物体（歩行者・自転車・車両）と場面全体の関係を扱います。

1. `scripts/track_objects.py` が YOLO11m + BoT-SORT で人・自転車・車・バス・トラックを追跡（COCO の標準クラスなので学習不要）。
2. プロファイルに **ゾーンの多角形**（横断歩道 / 待機ゾーン / 横断歩道付近の車道）を持たせ、映像に重ねて描く。
3. `src/services/crosswalkAnalyzer.ts` が毎フレーム、
   * 歩行者: 足元の位置からゾーン状態（歩道 / 待機中 / 横断歩道付近 / 横断中）
   * 車両: 速度、停止 / 走行、横断歩道への到達予測時間（接近車道ゾーン内で横断歩道へ向かう場合）
   を求め、「横断中の歩行者の近くに、走行中の車両が 1.5 秒以内に到達する（または横断歩道上を走行している）」場面を危険として採点します。
4. 危険が一定時間続いたら Jev に構造化状態（ゾーン、危険スコア、接近車両数、最短到達秒）を渡し、
   安全に横断 / 注意 / 危険 警報 / 要確認 から選ばせます。危険なく横断を終えた歩行者は「安全に横断」として確定します。

ゾーンはカメラごとに一度だけ定義します（`src/profiles/index.ts` の `zones`。正規化座標で、映像左上が (0,0)）。
別の交差点に使う場合は動画を差し替え、`npm run track:crosswalk` を実行し、ゾーンを描き直してください。

### 路面損傷スキャン（専用モデル + 面積による重症度）

7つ目のプロファイルは車載カメラの想定です。

1. Hugging Face 公開のポットホール分割モデル（`keremberke/yolov8s-pothole-segmentation`）+ ByteTrack で損傷を追跡
   （`npm run track:road`。重みは同リポジトリから `best.pt` を取得して `pothole-yolov8s.pt` として置く）。
2. 損傷が手前（画面下の計測ライン）に来た時点の検出枠の面積比を重症度にし、
   軽微（記録のみ）/ 中程度（再計測）/ 大きめ（点検要請）/ 大型（要補修を起票）に分けて Jev に選ばせます。
3. 追跡 ID の数を「検出した損傷」、速度仮定（20 km/h）による走査距離から「損傷密度（件/km）」を出します。
   GPS が無いため距離は模擬値です。実車では GPS ログを時刻で結合してください。

参照した RoadScan-AI は YOLO11n を独自データで学習し ByteTrack で追跡する構成です。ここでは公開モデルで代替しているため
見逃しがあります（水たまり状の損傷は拾いやすく、乾いた浅い損傷は拾いにくい）。自社データで学習したモデルの
重みに差し替えるだけで精度を上げられます。

### 別の映像・別の検査項目に対応する

`src/profiles/index.ts` に検査プロファイルを1件追加します。持つ情報は
物体名・検査属性名・合格 / 不良の表示名・理由コードの表示文・不良時の処置・Jev の task 名・
判定トリガー（ゲート: 軸 / 位置 / 向き、またはゾーン: 矩形 / 滞留秒数）・映像ディレクトリです。
あとは `public/demo/<dir>/video.mp4` を置いて追跡を実行するだけで、画面の語彙、判断、
Jev への送信内容がすべて切り替わります。

`detections.json` の形式（実際の追跡器が出すものと同じ契約）:

```json
{ "time": 0.8, "id": 1, "bbox": [0.12, 0.31, 0.16, 0.48], "class": "object", "confidence": 0.94 }
```

`bbox` は `[x, y, 幅, 高さ]` を 0〜1 に正規化した値なので、動画サイズが変わっても枠は追従します。
同じ `id` の複数キーフレームが1本のトラックになり、間は補間されます。
`class` が `ok` / `ng` の場合はその信頼度を初期値に使い、`object` の場合はシナリオ側で
検査属性の状態を割り当てます。

### デモシナリオ

| シナリオ | 不良率 | 内容 |
| --- | --- | --- |
| 通常生産 | 5% | 基準 |
| 不良率上昇 | 25% | 直近60秒の不良率が 15% を超えると異常警報 |
| センサーノイズ | 6% | 枠と信頼度が揺れ、要確認が増える |
| 位置ずれ（名称はプロファイル依存） | 5% | 再検査が増える |
| カメラ信頼度低下 | 5% | 18〜48秒に露出異常。カメラ状態が「劣化」になりライン判断が「要確認」へ |
| ライン渋滞 | 7% | ボトルが詰まり処理速度が上がる |

---

## 5 段階グレードと判断の根拠

判断（処置）とは別に、Jev はすべての対象を **異常度 0〜1** と **5 段階グレード** で評価します。
色は映像オーバーレイ・判断パネル・グラフ・KPI で共通です。

| グレード | 色 | 異常度 | 既定の処置 |
| --- | --- | --- | --- |
| A 良好 | 緑 `#39ff88` | < 0.15 | 合格 |
| B 許容 | 黄緑 `#b6f24a` | 0.15〜0.30 | 合格（余裕小として記録） |
| C 要注意 | 黄 `#ffd52a` | 0.30〜0.55 | 再検査 → 再検査後も C なら人の確認 |
| D 要対処 | 橙 `#ff8c3a` | 0.55〜0.80 | 人の確認 |
| E 不良 | 赤 `#ff5151` | ≥ 0.80 | 不良（排出 / 通報 / 起票） |

異常度はプロファイルの種類ごとに `src/services/grading.ts` で決めます。

* 属性の有無（キャップ・ラベル・部品）: 属性信頼度 0.875 / 0.75 / 0.45 / 0.20 を帯の境界に写像
* 連続量の計測（充填量）: 目標からのずれを許容幅の倍数で 0.5 / 1.0 / 1.6 / 2.4 に写像
* 場面解析（転倒・横断歩道）: 水準（normal / watch / alert）とスコアの組から写像
* 面積重症度（路面損傷）: 基準面積に対する枠面積比をそのまま使用

### 精度を上げるための仕組み

* **複数フレームの証拠**: 検査中（ゲート手前の帯・ステーション滞留・状態の確認中）は毎フレームの読みを蓄え、
  属性プロファイルは **中央値** で判断します（1 フレームの揺れに左右されない）。再検査の読みも証拠に追加されます。
* **安定度**: p10〜p90 の幅から証拠の安定度 0〜1 を出し、ばらつきが大きい対象は中央値がどこにあっても再検査 / 人の確認へ回します（`EVIDENCE_UNSTABLE`）。
* **確信度の合成**: 確信度 = 処置境界（0.30 / 0.55 / 0.80）からの余裕 × 証拠の安定度 × 物体信頼度。
  境界のごく近くでは 0.65 を下回り、自動処置ではなく人の確認になります（枠が破線になり、処置タグに `?` が付きます）。
* **選択肢ごとのスコア**: 提示した 4 つの選択肢それぞれのスコア（合計 1）を返し、パネルに棒で表示します。
  「合格 62% / 再検査 28%」のように、判断がどれだけ僅差だったかが見えます。
* **根拠の一覧**: 判断に使った値（属性信頼度の中央値・フレーム間のばらつき・位置の整合・証拠フレーム数・直近の不良率など）を
  `evidence` として返し、パネルと CSV（`grade` / `severity` 列）に残します。

Jev 接続モードでは、リクエストに `grading`（尺度・ラベル・しきい値）と `state.evidence`（証拠の要約）を含め、
レスポンスの `grade` / `severity` / `option_scores` を使います。Jev がこれらを返さない場合は同じ証拠からローカル規則で補います。

---

## Jev 接続モード（モード B）

サーバー側の環境変数に `TYPESAFE_API_KEY` があると自動で有効になります（`.env.example` を `.env` にコピー）。
ブラウザには真偽値（`__JEV_KEY_PRESENT__`）しか渡さず、リクエストは `/api/jev/decide` へ送られ、
`vite.config.ts` の開発サーバープラグインが `JEV_API_URL` へキー付きで転送します。
本番では同じ役割の FastAPI / Express のルートに置き換えてください。

* 画面表示が「シミュレーション」から「JEV接続」に変わり、判断には `engine: "jev"` が付きます。
* API エラーやタイムアウト（2.5秒）はその判断だけ模擬エンジンへ退避し、退避回数を表示、JEV 状態が「退避」になります。
* 提示していない選択肢が返ってきた場合は不正応答として扱います。

リクエスト / レスポンスの契約は `src/services/jevDecisionEngine.ts`（`JevObjectRequest` / `JevLineRequest` / `JevResponse`）にあります。
実際のエンドポイント仕様が異なる場合はこのファイルだけ直せば済みます。

---

## イベントエンジン

すべての層は `services/eventBus.ts` を通じて通信します。物体ごとのイベント:

```
OBJECT_ENTERED → OBJECT_TRACKED → INSPECTION_STARTED → CAP_CONFIDENCE
  → (RECHECK → CAP_CONFIDENCE)* → PASS | REJECT | HUMAN_REVIEW
  → INSPECTION_COMPLETED → [EJECT_TRIGGERED] → OBJECT_EXITED
```

加えて `LINE_DECISION`、`ALERT`、`HUMAN_OVERRIDE`、`SYSTEM`。イベントログはミリ秒付きの時刻で表示され、
JSON / CSV で書き出せます（検査記録は下記の保存形式で同梱）。

```json
{
  "timestamp": "2026-09-19T05:53:15.706Z",
  "objectId": "#010",
  "vision": { "object": 0.96, "attribute": 0.88, "alignment": 0.89 },
  "decision": { "result": "PASS", "confidence": 0.85, "reason": "CAP_OK", "engine": "simulation", "grade": "A", "severity": 0.08 },
  "action": "RELEASE",
  "latencyMs": 45
}
```

---

## 構成

```
src/
  components/   VideoInspection, DetectionOverlay, DetectionLabel, InspectionGate, SyntheticFeed,
                InspectorPanel, KpiHeader, SystemStatus, FactoryStatus, DecisionPanel,
                LineDecisionPanel, AnomalyPanel, HumanReviewQueue, EventLog, InspectionChart,
                ControlPanel, ScenarioSelector, Panel
  services/     videoDetectionSimulator, decisionEngine, jevDecisionEngine, decisionActions,
                eventBus, inspectionStore, inspectionController, playbackClock, exportLog
  i18n/         ja.ts（表示ラベル。内部コードは英字のまま）
  profiles/     index.ts（検査プロファイル: ボトルキャップ / 小包ラベル / 基板実装）
  types/        inspection.ts（層をまたぐ契約）
  data/         demoDetections.ts（トラック生成・補間・ゲート / ゾーン判定・JSON 変換）, scenarios.ts
public/demo/    <プロファイル>/video.mp4, detections.json, CREDIT.txt
scripts/        build-single-html.mjs, track_video.py, generate-detections.mts
```

性能: 枠の描画は1本の `requestAnimationFrame` ループでメディア時刻に同期して Canvas に描き、
React の状態は通しません。ダッシュボードのストア（`useSyncExternalStore`）はイベント時だけ更新されます。

---

## 今後の映像認識連携

`VideoDetectionSimulator` を、フレームごとに同じ `FrameDetection[]` と同じライフサイクルイベントを出す
モジュールに置き換えます。

* **カメラ**: RTSP → フレーム取得（GStreamer / FFmpeg）→ フレーム時刻を `PlaybackClock` に。
* **推論**: ONNX Runtime / TensorRT / OpenVINO 上の YOLO、RT-DETR、または専用キャップモデル。
* **追跡**: ByteTrack / SORT / DeepSORT が安定した `trackId` を付与（今は JSON の `id`）。
* **クラス**: `DetectionClass` には LOW_CAP、MISALIGNED_CAP、DAMAGED_CAP、NO_LABEL、LABEL_MISALIGNED、
  DEFORMED_BOTTLE、FOREIGN_OBJECT を予約済み。`ENABLED_CLASSES` で有効化。
* **ブラウザ内推論**: OpenCV.js / ONNX Runtime Web で軽量モデルを `<video>` に直接掛け、同じ契約で流すことも可能。

## 工場設備との連携

* **メッセージング**: イベントバスを MQTT トピックへ発行し、ダッシュボードは購読側に。
* **保存**: `InspectionRecord` を PostgreSQL / TimescaleDB に保存（書き出し JSON がその形式）。
* **設備制御**: 「不良」→ PLC（OPC-UA / Modbus）→ 排出ゲート。**フェーズ1では未実装**。
  プロトタイプは PLC に一切触れず、`EJECT_TRIGGERED` には `simulated` を明示しています。
* **ライン制御**: ライン判断の「減速」「停止」も同じ PLC 経路へ。必ず人の確認を挟む前提。

## フェーズ1で扱わないもの

* 実モデルによる推論、PLC 通信、バックエンドでの永続化。
* Jev API のリクエスト形式は提案契約であり、実エンドポイント仕様との照合が必要。
