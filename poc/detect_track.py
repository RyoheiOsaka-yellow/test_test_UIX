"""M1: Player and ball detection with multi-object tracking.

Runs YOLO detection (COCO person + sports ball) frame by frame and
assigns persistent IDs via ByteTrack. Writes an annotated video and
a JSON of per-frame detections for downstream analysis.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import supervision as sv
from ultralytics import YOLO

COCO_PERSON = 0
COCO_SPORTS_BALL = 32


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="Input video path")
    parser.add_argument("--output", default="annotated.mp4", help="Annotated video output path")
    parser.add_argument("--data", default="tracks.json", help="Per-frame detection JSON output")
    parser.add_argument("--model", default="yolov8x.pt", help="Ultralytics model name or path")
    parser.add_argument("--conf", type=float, default=0.3, help="Detection confidence threshold")
    parser.add_argument("--device", default=None, help="cuda, cpu, or mps (default: auto)")
    parser.add_argument("--stride", type=int, default=1, help="Process every Nth frame")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    source = Path(args.source)
    if not source.exists():
        raise FileNotFoundError(source)

    model = YOLO(args.model)
    tracker = sv.ByteTrack()
    box_annotator = sv.BoxAnnotator()
    label_annotator = sv.LabelAnnotator()

    cap = cv2.VideoCapture(str(source))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    writer = cv2.VideoWriter(
        args.output, cv2.VideoWriter_fourcc(*"mp4v"), fps / max(args.stride, 1), (width, height)
    )

    frames: list[dict] = []
    frame_idx = 0
    processed = 0

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        if frame_idx % args.stride != 0:
            frame_idx += 1
            continue

        result = model(
            frame,
            conf=args.conf,
            classes=[COCO_PERSON, COCO_SPORTS_BALL],
            device=args.device,
            verbose=False,
        )[0]
        detections = sv.Detections.from_ultralytics(result)
        detections = tracker.update_with_detections(detections)

        labels = [
            f"#{int(tid)} {model.names[int(cid)]}"
            for tid, cid in zip(detections.tracker_id, detections.class_id)
        ]
        annotated = box_annotator.annotate(frame.copy(), detections)
        annotated = label_annotator.annotate(annotated, detections, labels)
        writer.write(annotated)

        records = []
        for xyxy, tid, cid, conf in zip(
            detections.xyxy,
            detections.tracker_id,
            detections.class_id,
            detections.confidence,
        ):
            x1, y1, x2, y2 = (float(v) for v in xyxy)
            records.append(
                {
                    "track_id": int(tid),
                    "class": model.names[int(cid)],
                    "bbox": [x1, y1, x2, y2],
                    "confidence": float(conf),
                }
            )
        frames.append(
            {"frame": frame_idx, "timestamp": frame_idx / fps, "detections": records}
        )

        frame_idx += 1
        processed += 1
        if processed % 50 == 0:
            print(f"processed {processed} frames (source idx {frame_idx})")

    cap.release()
    writer.release()

    with open(args.data, "w") as f:
        json.dump(
            {
                "source": str(source),
                "fps": fps,
                "width": width,
                "height": height,
                "stride": args.stride,
                "frames": frames,
            },
            f,
        )

    print(f"done: {processed} frames -> {args.output}, {args.data}")


if __name__ == "__main__":
    main()
