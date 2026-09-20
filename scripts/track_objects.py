"""
YOLO11 + BoT-SORT で複数クラス（人・自転車・車・バスなど）を追跡し、detections.json を生成する（横断歩道の安全監視用）。

  python scripts/track_objects.py public/demo/crosswalk/video.mp4 public/demo/crosswalk/detections.json --coco person,bicycle,car,motorcycle,bus,truck

出力行: time / id / bbox（正規化）/ class（COCO 名）/ confidence
"""
import argparse, json
import cv2
from ultralytics import YOLO


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('video')
    ap.add_argument('out')
    ap.add_argument('--coco', default='person,bicycle,car,motorcycle,bus,truck')
    ap.add_argument('--model', default='yolo11m.pt')
    ap.add_argument('--conf', type=float, default=0.3)
    ap.add_argument('--imgsz', type=int, default=960)
    ap.add_argument('--min-seconds', type=float, default=0.5)
    ap.add_argument('--stride', type=int, default=2)
    a = ap.parse_args()
    cap = cv2.VideoCapture(a.video)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    cap.release()
    model = YOLO(a.model)
    names = {v: k for k, v in model.names.items()}
    classes = [names[s.strip()] for s in a.coco.split(',')]
    rows = []
    for i, r in enumerate(model.track(source=a.video, tracker='botsort.yaml', classes=classes, conf=a.conf, imgsz=a.imgsz, persist=True, stream=True, verbose=False)):
        if r.boxes is None or r.boxes.id is None:
            continue
        t = i / fps
        for tid, (cx, cy, w, h), c, k in zip(r.boxes.id.int().tolist(), r.boxes.xywhn.tolist(), r.boxes.conf.tolist(), r.boxes.cls.int().tolist()):
            rows.append({'time': round(t, 3), 'id': int(tid), 'bbox': [round(cx - w / 2, 4), round(cy - h / 2, 4), round(w, 4), round(h, 4)], 'class': model.names[k], 'confidence': round(c, 3)})
    by_id = {}
    for d in rows:
        by_id.setdefault(d['id'], []).append(d)
    keep = [v for v in by_id.values() if v[-1]['time'] - v[0]['time'] >= a.min_seconds]
    keep.sort(key=lambda v: v[0]['time'])
    out = []
    for nid, v in enumerate(keep, start=1):
        for j, d in enumerate(v):
            if j % a.stride and j != len(v) - 1:
                continue
            out.append({**d, 'id': nid})
    out.sort(key=lambda d: (d['time'], d['id']))
    json.dump(out, open(a.out, 'w'), separators=(',', ':'))
    from collections import Counter
    print(f'wrote {len(out)} keyframes for {len(keep)} tracks · classes {Counter(v[0]["class"] for v in keep)}')


if __name__ == '__main__':
    main()
