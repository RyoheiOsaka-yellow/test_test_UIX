"""
Grounding DINO（文字指定の物体検出）で実映像の物体を検出し、簡易追跡して detections.json を生成する。
YOLO-World で当たりが悪い物体（段ボール箱、基板など）向け。CPU でも動くが遅いので、
フレームを間引いて検出し（--stride）、間はアプリ側で線形補間する。

  pip install torch transformers pillow opencv-python-headless
  python scripts/track_video_gdino.py public/demo/parcel-label/video.mp4 public/demo/parcel-label/detections.json \
      --prompt "cardboard box." --box-threshold 0.45 --stride 5
"""
import argparse, json
import cv2, torch
from PIL import Image
from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection


def iou(a, b):
    ax2, ay2, bx2, by2 = a[0] + a[2], a[1] + a[3], b[0] + b[2], b[1] + b[3]
    iw = max(0.0, min(ax2, bx2) - max(a[0], b[0]))
    ih = max(0.0, min(ay2, by2) - max(a[1], b[1]))
    inter = iw * ih
    union = a[2] * a[3] + b[2] * b[3] - inter
    return inter / union if union > 0 else 0.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('video')
    ap.add_argument('out')
    ap.add_argument('--prompt', required=True, help='小文字で、ピリオド区切り。例: "cardboard box."')
    ap.add_argument('--model', default='IDEA-Research/grounding-dino-tiny')
    ap.add_argument('--box-threshold', type=float, default=0.35)
    ap.add_argument('--text-threshold', type=float, default=0.25)
    ap.add_argument('--stride', type=int, default=5, help='何フレームごとに検出するか')
    ap.add_argument('--max-area', type=float, default=0.8, help='これより大きい枠（画面全体など）は捨てる')
    ap.add_argument('--min-seconds', type=float, default=0.5)
    ap.add_argument('--match-iou', type=float, default=0.3)
    ap.add_argument('--max-gap', type=float, default=0.6, help='この秒数以上見失ったトラックは終了')
    a = ap.parse_args()

    proc = AutoProcessor.from_pretrained(a.model)
    model = AutoModelForZeroShotObjectDetection.from_pretrained(a.model).eval()

    cap = cv2.VideoCapture(a.video)
    fps = cap.get(cv2.CAP_PROP_FPS)
    frames = []  # (t, [(bbox, score)])
    i = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if i % a.stride == 0:
            img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            inputs = proc(images=img, text=a.prompt, return_tensors='pt')
            with torch.no_grad():
                out = model(**inputs)
            res = proc.post_process_grounded_object_detection(out, inputs.input_ids, threshold=a.box_threshold, text_threshold=a.text_threshold, target_sizes=[img.size[::-1]])[0]
            W, H = img.size
            dets = []
            for s, b in zip(res['scores'], res['boxes']):
                x0, y0, x1, y1 = (v.item() for v in b)
                bbox = [x0 / W, y0 / H, (x1 - x0) / W, (y1 - y0) / H]
                if bbox[2] * bbox[3] > a.max_area:
                    continue
                dets.append((bbox, s.item()))
            frames.append((i / fps, dets))
            print(f'\r{i / fps:6.2f}s  {len(dets)} det', end='', flush=True)
        i += 1
    cap.release()
    print()

    # 簡易追跡: 直前フレームのトラックと IoU で貪欲に対応付ける
    tracks = []  # each: {'rows': [...], 'last_t': t, 'last_bbox': bbox}
    active = []
    next_id = 1
    for t, dets in frames:
        dets = sorted(dets, key=lambda d: -d[1])
        used = set()
        for tr in list(active):
            best, best_iou = None, a.match_iou
            for k, (bbox, s) in enumerate(dets):
                if k in used:
                    continue
                v = iou(tr['last_bbox'], bbox)
                if v > best_iou:
                    best, best_iou = k, v
            if best is not None:
                bbox, s = dets[best]
                used.add(best)
                tr['rows'].append({'time': round(t, 3), 'id': tr['id'], 'bbox': [round(v, 4) for v in bbox], 'class': 'object', 'confidence': round(s, 3)})
                tr['last_bbox'], tr['last_t'] = bbox, t
            elif t - tr['last_t'] > a.max_gap:
                active.remove(tr)
        for k, (bbox, s) in enumerate(dets):
            if k in used:
                continue
            tr = {'id': next_id, 'rows': [{'time': round(t, 3), 'id': next_id, 'bbox': [round(v, 4) for v in bbox], 'class': 'object', 'confidence': round(s, 3)}], 'last_bbox': bbox, 'last_t': t}
            next_id += 1
            tracks.append(tr)
            active.append(tr)

    keep = [tr['rows'] for tr in tracks if tr['rows'][-1]['time'] - tr['rows'][0]['time'] >= a.min_seconds]
    keep.sort(key=lambda v: v[0]['time'])
    out = []
    for nid, v in enumerate(keep, start=1):
        for r in v:
            out.append({**r, 'id': nid})
    out.sort(key=lambda r: (r['time'], r['id']))
    json.dump(out, open(a.out, 'w'), separators=(',', ':'))
    print(f'wrote {len(out)} keyframes for {len(keep)} tracks ({a.video}, {fps:.2f} fps, stride {a.stride})')
    for v in keep[:15]:
        c0 = (v[0]['bbox'][0] + v[0]['bbox'][2] / 2, v[0]['bbox'][1] + v[0]['bbox'][3] / 2)
        c1 = (v[-1]['bbox'][0] + v[-1]['bbox'][2] / 2, v[-1]['bbox'][1] + v[-1]['bbox'][3] / 2)
        print(f"  t {v[0]['time']:5.2f}->{v[-1]['time']:5.2f}  c ({c0[0]:.2f},{c0[1]:.2f})->({c1[0]:.2f},{c1[1]:.2f})  w {v[0]['bbox'][2]:.2f} h {v[0]['bbox'][3]:.2f}  n {len(v)}  s {v[0]['confidence']:.2f}")


if __name__ == '__main__':
    main()
