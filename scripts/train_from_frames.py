"""SAM 2 で自動注釈した数フレームだけで YOLO11n を学習する（参照記事と同じ「1 フレームから学習」の再現）。

使い方:
  python3 scripts/train_from_frames.py [epochs] [data.yaml]
  → runs/detect/potato-train/run/weights/best.pt を scripts/track_objects.py の --model に渡す
注意: 画像が 1〜2 枚だと 1 エポック = 1 バッチで勾配更新が足りない。
      同じ画像とラベルを 20〜30 回複製したデータセット（拡張は毎回変わる）で 60 エポック回すと CPU でも数分で収束する。
"""
import sys
from ultralytics import YOLO
epochs = int(sys.argv[1]) if len(sys.argv) > 1 else 60
m = YOLO('yolo11n.pt')
m.train(data=sys.argv[2] if len(sys.argv) > 2 else 'potato-ds/data.yaml', epochs=epochs, imgsz=640, batch=8, device='cpu', workers=0,
        project='potato-train', name='run', exist_ok=True, plots=False, verbose=False,
        mosaic=1.0, degrees=10, flipud=0.5, fliplr=0.5, scale=0.5, translate=0.2, hsv_h=0.01, hsv_s=0.4, hsv_v=0.3,
        close_mosaic=10, patience=100, warmup_epochs=2, lr0=0.01)
print('DONE', m.trainer.best if hasattr(m, 'trainer') else '')
