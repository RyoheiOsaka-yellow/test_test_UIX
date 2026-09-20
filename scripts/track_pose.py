"""
YOLO11-Pose + BoT-SORT で人物の骨格（COCO 17 点）を追跡し、detections.json を生成する（転倒検知用）。

  pip install ultralytics opencv-python-headless
  python scripts/track_pose.py public/demo/fall-detection/video.mp4 public/demo/fall-detection/detections.json

出力行: time / id / bbox[x,y,w,h]（正規化）/ class "person" / confidence / keypoints[51]（x,y,conf ×17、正規化）
転倒の瞬間に追跡が途切れて別 ID になりやすいので、近い位置・短い時間差で始まるトラックは同一 ID に結合する。
"""
import argparse, json
import cv2
from ultralytics import YOLO


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('video')
    ap.add_argument('out')
    ap.add_argument('--model', default='yolo11n-pose.pt')
    ap.add_argument('--conf', type=float, default=0.25)
    ap.add_argument('--imgsz', type=int, default=640)
    ap.add_argument('--merge-gap', type=float, default=0.8, help='この秒数以内に近くで始まるトラックを結合')
    ap.add_argument('--merge-dist', type=float, default=0.3, help='結合する中心距離（正規化）')
    a = ap.parse_args()

    cap = cv2.VideoCapture(a.video)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    cap.release()
    model = YOLO(a.model)
    rows = []
    for i, r in enumerate(model.track(source=a.video, tracker='botsort.yaml', conf=a.conf, imgsz=a.imgsz, persist=True, stream=True, verbose=False)):
        if r.boxes is None or r.boxes.id is None or r.keypoints is None:
            continue
        t = i / fps
        for tid, (cx, cy, w, h), c, kp, kc in zip(r.boxes.id.int().tolist(), r.boxes.xywhn.tolist(), r.boxes.conf.tolist(), r.keypoints.xyn.tolist(), r.keypoints.conf.tolist()):
            flat = []
            for (x, y), q in zip(kp, kc):
                flat += [round(x, 4), round(y, 4), round(q, 3)]
            rows.append({'time': round(t, 3), 'id': int(tid), 'bbox': [round(cx - w / 2, 4), round(cy - h / 2, 4), round(w, 4), round(h, 4)], 'class': 'person', 'confidence': round(c, 3), 'keypoints': flat})

    # ID の結合
    by_id = {}
    for d in rows:
        by_id.setdefault(d['id'], []).append(d)
    tracks = sorted(by_id.values(), key=lambda v: v[0]['time'])
    merged = []
    for v in tracks:
        placed = False
        for m in merged:
            last = m[-1]
            gap = v[0]['time'] - last['time']
            if 0 <= gap <= a.merge_gap:
                c0 = (last['bbox'][0] + last['bbox'][2] / 2, last['bbox'][1] + last['bbox'][3] / 2)
                c1 = (v[0]['bbox'][0] + v[0]['bbox'][2] / 2, v[0]['bbox'][1] + v[0]['bbox'][3] / 2)
                if ((c0[0] - c1[0]) ** 2 + (c0[1] - c1[1]) ** 2) ** 0.5 <= a.merge_dist:
                    m.extend(v)
                    placed = True
                    break
        if not placed:
            merged.append(list(v))
    out = []
    for nid, v in enumerate(merged, start=1):
        for d in v:
            out.append({**d, 'id': nid})
    out.sort(key=lambda d: (d['time'], d['id']))
    json.dump(out, open(a.out, 'w'), separators=(',', ':'))
    print(f'wrote {len(out)} keyframes for {len(merged)} tracks (raw ids {len(by_id)}) · {a.video} @ {fps:.1f} fps')


if __name__ == '__main__':
    main()
