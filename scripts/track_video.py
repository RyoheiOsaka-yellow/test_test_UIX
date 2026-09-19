"""
実映像に対してボトル検出＋追跡を事前計算し、/public/demo/detections.json を生成する。

  pip install ultralytics opencv-python-headless
  python scripts/track_video.py public/demo/bottling-line.mp4 public/demo/detections.json --model yolo11s.pt

出力は検知タイムライン形式（time / id / bbox[x,y,w,h] 正規化 / class / confidence）。
class は "bottle"（ボトルのみ検出。キャップ有無は学習済みモデルが無いため
アプリ側のシナリオで疑似注入する）。
"""
import argparse, json
import cv2
from ultralytics import YOLO

BOTTLE_CLASS = 39  # COCO: bottle

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
    ap.add_argument('video'); ap.add_argument('out')
    ap.add_argument('--model', default='yolo11s.pt')
    ap.add_argument('--conf', type=float, default=0.08)
    ap.add_argument('--imgsz', type=int, default=1280)
    ap.add_argument('--min-seconds', type=float, default=0.5, help='これより短いトラックは捨てる')
    a = ap.parse_args()

    with open('_bytetrack_tmp.yaml', 'w') as f:
        f.write(TRACKER_YAML)
    cap = cv2.VideoCapture(a.video); fps = cap.get(cv2.CAP_PROP_FPS); cap.release()
    model = YOLO(a.model)
    rows = []
    for i, r in enumerate(model.track(source=a.video, tracker='_bytetrack_tmp.yaml', classes=[BOTTLE_CLASS], conf=a.conf, iou=0.5, imgsz=a.imgsz, persist=True, stream=True, verbose=False)):
        if r.boxes is None or r.boxes.id is None:
            continue
        t = i / fps
        for tid, (cx, cy, w, h), c in zip(r.boxes.id.int().tolist(), r.boxes.xywhn.tolist(), r.boxes.conf.tolist()):
            rows.append({'time': round(t, 3), 'id': int(tid), 'bbox': [round(cx - w / 2, 4), round(cy - h / 2, 4), round(w, 4), round(h, 4)], 'class': 'bottle', 'confidence': round(c, 3)})

    # 短いトラックを除去し、id を 1 から振り直す
    by_id = {}
    for d in rows:
        by_id.setdefault(d['id'], []).append(d)
    keep = [v for v in by_id.values() if v[-1]['time'] - v[0]['time'] >= a.min_seconds]
    keep.sort(key=lambda v: v[0]['time'])
    out = []
    for new_id, v in enumerate(keep, start=1):
        for d in v:
            out.append({**d, 'id': new_id})
    out.sort(key=lambda d: (d['time'], d['id']))
    json.dump(out, open(a.out, 'w'), separators=(',', ':'))
    print(f'wrote {len(out)} keyframes for {len(keep)} tracks ({a.video}, {fps:.2f} fps)')

if __name__ == '__main__':
    main()
