"""SAM 2 に色で選んだ点プロンプトを与えて、密集したジャガイモを 1 枚ずつマスクにする（1〜2 フレームの自動注釈）。

使い方:
  python3 scripts/annotate_sam.py sam2_t.pt frame1.png [frame2.png ...]
  → potato-ds/images, potato-ds/labels（YOLO 形式）, potato-ds/<frame>-vis.jpg
ゼロショット検出器が効かない密集物体でも、色（土色）で選んだ点を SAM 2 に渡すと 1 個ずつ切り出せる。
色の範囲（tan_mask）は対象に合わせて変える。
"""
import sys, os, numpy as np, cv2, torch
from ultralytics import SAM
weights = sys.argv[1]; frames = sys.argv[2:]
model = SAM(weights)
os.makedirs('potato-ds/images', exist_ok=True); os.makedirs('potato-ds/labels', exist_ok=True)

def tan_mask(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    m = (h <= 40) & (s >= 12) & (v >= 90)
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    return m.astype(bool)

for f in frames:
    img = cv2.imread(f); H, W = img.shape[:2]
    tan = tan_mask(img)
    # 距離変換の山（塊の中心らしい点）を点プロンプトにする
    dist = cv2.distanceTransform(tan.astype(np.uint8), cv2.DIST_L2, 5)
    pts = []
    step = 12
    for y in range(step // 2, H, step):
        for x in range(step // 2, W, step):
            if tan[y, x] and dist[y, x] >= 3:
                pts.append([x, y])
    print(f, 'prompt points', len(pts))
    boxes = []
    B = 32
    for i in range(0, len(pts), B):
        chunk = pts[i:i + B]
        res = model(f, points=[[p] for p in chunk], labels=[[1] for _ in chunk], verbose=False)[0]
        if res.masks is None: continue
        masks = res.masks.data.cpu().numpy().astype(bool)
        for m in masks:
            area = m.sum() / (H * W)
            if area < 0.0005 or area > 0.02: continue
            ys, xs = np.where(m)
            x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
            bw, bh = x1 - x0 + 1, y1 - y0 + 1
            if bw < 8 or bh < 8: continue
            if m.sum() / (bw * bh) < 0.5: continue
            if max(bw, bh) / min(bw, bh) > 3.0: continue
            if tan[m].mean() < 0.55: continue
            boxes.append((int(x0), int(y0), int(bw), int(bh), float(area)))
    # 重複除去（IoU 0.5）: 小さい枠を優先
    boxes.sort(key=lambda b: b[4])
    final = []
    for b in boxes:
        ok = True
        for c in final:
            ix = max(0, min(b[0] + b[2], c[0] + c[2]) - max(b[0], c[0])); iy = max(0, min(b[1] + b[3], c[1] + c[3]) - max(b[1], c[1]))
            inter = ix * iy; union = b[2] * b[3] + c[2] * c[3] - inter
            if inter / union > 0.5 or inter / (c[2] * c[3]) > 0.8 or inter / (b[2] * b[3]) > 0.8: ok = False; break
        if ok: final.append(b)
    base = os.path.splitext(os.path.basename(f))[0]
    cv2.imwrite(f'potato-ds/images/{base}.jpg', img)
    with open(f'potato-ds/labels/{base}.txt', 'w') as fp:
        for (x0, y0, bw, bh, _) in final:
            fp.write(f"0 {(x0 + bw / 2) / W:.5f} {(y0 + bh / 2) / H:.5f} {bw / W:.5f} {bh / H:.5f}\n")
    vis = img.copy()
    for (x0, y0, bw, bh, _) in final: cv2.rectangle(vis, (x0, y0), (x0 + bw, y0 + bh), (0, 255, 0), 1)
    cv2.imwrite(f'potato-ds/{base}-vis.jpg', vis)
    print(f, 'raw', len(boxes), 'kept', len(final))
