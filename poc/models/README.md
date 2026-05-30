# Detection models

## soccer-yolov8.onnx

サッカー特化 YOLOv8 物体検出モデル。

- **元モデル**: [uisikdag/yolo-v8-football-players-detection](https://huggingface.co/uisikdag/yolo-v8-football-players-detection)
- **クラス**: `ball`, `goalkeeper`, `player`, `referee`
- **入力**: 1×3×640×640 (float32, 0-1正規化, NCHW, RGB)
- **出力**: 1×8×8400 (4 box [cx,cy,w,h in 640-space] + 4 class scores)
- **mAP@0.5**: 0.785
- **ファイルサイズ**: 約43MB
- **ライセンス**: 元リポジトリ未指定（MITライクの研究利用想定。商用利用前にライセンス確認推奨）

### 再生成方法
```python
from ultralytics import YOLO
m = YOLO('best.pt')  # downloaded from HF
m.export(format='onnx', imgsz=640, opset=12, simplify=False, dynamic=False)
```
