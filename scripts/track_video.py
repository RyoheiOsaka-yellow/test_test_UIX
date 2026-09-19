"""
実映像に対して物体検出＋追跡を事前計算し、detections.json を生成する。

  pip install ultralytics opencv-python-headless

  # COCO の標準クラス（例: bottle）
  python scripts/track_video.py public/demo/bottle-cap/video.mp4 public/demo/bottle-cap/detections.json --coco bottle
  # 文字で指定（YOLO-World、学習不要）
  python scripts/track_video.py public/demo/parcel-label/video.mp4 public/demo/parcel-label/detections.json --world "cardboard box,parcel"

出力は検知タイムライン形式（time / id / bbox[x,y,w,h] 正規化 / class / confidence）。
class は "object"（物体のみ検出。検査属性の有無は学習済みモデルが無いため
アプリ側のシナリオで疑似注入する）。
"""
import argparse, json, os
import cv2
from ultralytics import YOLO

COCO_NAMES = None

TRACKER_YAML = """tracker_type: bytetrack
track_high_thresh: 0.25
track_low_thresh: 0.05
new_track_thresh: 0.3
track_buffer: 45
match_thresh: 0.85
fuse_score: true
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('video')
    ap.add_argument('out')
    ap.add_argument('--coco', help='COCO クラス名（カンマ区切り。例: bottle）')
    ap.add_argument('--world', help='YOLO-World の文字プロンプト（カンマ区切り。例: "cardboard box,parcel"）')
    ap.add_argument('--model', help='重みファイル。省略時は --coco なら yolo11m.pt、--world なら yolov8m-worldv2.pt')
    ap.add_argument('--conf', type=float, default=0.1)
    ap.add_argument('--imgsz', type=int, default=1280)
    ap.add_argument('--min-seconds', type=float, default=0.5, help='これより短いトラックは捨てる')
    ap.add_argument('--stride', type=int, default=1, help='キーフレームの間引き（2 なら 2 フレームに 1 つ）')
    a = ap.parse_args()
    if not a.coco and not a.world:
        ap.error('--coco か --world のどちらかを指定してください')

    with open('_bytetrack_tmp.yaml', 'w') as f:
        f.write(TRACKER_YAML)
    cap = cv2.VideoCapture(a.video)
    fps = cap.get(cv2.CAP_PROP_FPS)
    cap.release()

    if a.world:
        model = YOLO(a.model or 'yolov8m-worldv2.pt')
        model.set_classes([s.strip() for s in a.world.split(',')])
        classes = None
    else:
        model = YOLO(a.model or 'yolo11m.pt')
        names = {v: k for k, v in model.names.items()}
        classes = [names[s.strip()] for s in a.coco.split(',')]

    rows = []
    for i, r in enumerate(model.track(source=a.video, tracker='_bytetrack_tmp.yaml', classes=classes, conf=a.conf, iou=0.5, imgsz=a.imgsz, persist=True, stream=True, verbose=False)):
        if r.boxes is None or r.boxes.id is None:
            continue
        t = i / fps
        for tid, (cx, cy, w, h), c in zip(r.boxes.id.int().tolist(), r.boxes.xywhn.tolist(), r.boxes.conf.tolist()):
            rows.append({'time': round(t, 3), 'id': int(tid), 'bbox': [round(cx - w / 2, 4), round(cy - h / 2, 4), round(w, 4), round(h, 4)], 'class': 'object', 'confidence': round(c, 3)})
    os.remove('_bytetrack_tmp.yaml')

    by_id = {}
    for d in rows:
        by_id.setdefault(d['id'], []).append(d)
    keep = [v for v in by_id.values() if v[-1]['time'] - v[0]['time'] >= a.min_seconds]
    keep.sort(key=lambda v: v[0]['time'])
    out = []
    for new_id, v in enumerate(keep, start=1):
        for j, d in enumerate(v):
            if j % a.stride and j != len(v) - 1:
                continue
            out.append({**d, 'id': new_id})
    out.sort(key=lambda d: (d['time'], d['id']))
    json.dump(out, open(a.out, 'w'), separators=(',', ':'))
    print(f'wrote {len(out)} keyframes for {len(keep)} tracks ({a.video}, {fps:.2f} fps)')


if __name__ == '__main__':
    main()
