# JEV Visual Inspection Prototype

Real-time AI visual inspection prototype for a bottling line: bottles travel on a
conveyor, a computer-vision layer detects **CAPPED / UNCAPPED**, and a
**Jev decision engine** decides what to do with each bottle (and with the line)
from structured state. Everything is shown on an industrial operations dashboard.

Phase 1 is a complete, runnable prototype that works **without a trained model,
without a video file and without any paid service** (Simulation Mode). The
architecture is the production one; only the CV and decision adapters are stubs.

> **Honesty note.** In Simulation Mode nothing is "really" detecting caps. The
> detections come from a deterministic timeline replayed against the playback
> clock. The UI labels this clearly (`SIMULATION`, `SYNTHETIC FEED`) and the
> engine field on every decision says `simulation`.

---

## Architecture

```
VIDEO  (HTML5 <video> or synthetic feed; RTSP in production)
  ↓
DETECTION  (videoDetectionSimulator.ts; YOLO / RT-DETR + ByteTrack in production)
  ↓
STRUCTURED EVENTS  (eventBus.ts: OBJECT_ENTERED → INSPECTION_STARTED → … → OBJECT_EXITED)
  ↓
JEV DECISION ENGINE  (decisionEngine.ts adapter → jevDecisionEngine.ts when a key is present)
  ↓
ACTION / ALERT / CLASSIFICATION  (PASS · RECHECK · REJECT · HUMAN_REVIEW; line: NORMAL · WATCH · SLOW_LINE · STOP_LINE)
  ↓
DASHBOARD  (inspectionStore.ts → React panels; canvas overlay via requestAnimationFrame)
```

Three layers, three swappable boundaries:

| Layer | Phase 1 implementation | Production replacement |
| --- | --- | --- |
| Computer Vision | `services/videoDetectionSimulator.ts` replays `data/demoDetections.ts` tracks | ONNX Runtime / TensorRT / OpenVINO model + ByteTrack emitting the same `FrameDetection` |
| Jev Decision | `services/decisionEngine.ts` (rule-based) | `services/jevDecisionEngine.ts` (already wired; enabled by `TYPESAFE_API_KEY`) |
| Operations Dashboard | React + Tailwind + Recharts | unchanged |

### Jev is a decision engine, not an image model and not a chatbot

The CV layer produces a structured state. The decision engine is asked to choose
among explicit options. It is never asked "what should the factory do?".

```jsonc
// Object level (services/jevDecisionEngine.ts → JevObjectRequest)
{
  "task": "bottle_cap_inspection",
  "level": "object",
  "state": {
    "object_type": "bottle",
    "object_id": "#014",
    "bottle_confidence": 0.98,
    "cap_confidence": 0.17,
    "cap_position_score": 0.21,
    "inspection_zone": true,
    "previous_failures": 0,
    "previous_state": "normal"
  },
  "options": ["PASS", "RECHECK", "REJECT", "HUMAN_REVIEW"]
}
// → { "decision": "REJECT", "confidence": 0.96, "reason": "CAP_MISSING" }
```

```jsonc
// Line level (second-level Jev, evaluated every 5 s over a 60 s window)
{
  "task": "bottle_cap_inspection",
  "level": "line",
  "state": {
    "reject_rate": 0.12, "normal_rate": 0.05, "camera_confidence": 0.98,
    "line_speed_bpm": 132, "previous_failures": 1, "window_seconds": 60
  },
  "options": ["NORMAL", "WATCH", "SLOW_LINE", "STOP_LINE", "HUMAN_REVIEW"]
}
```

Every decision carries a confidence. Below `0.65` the engine is treated as
**JEV UNCERTAIN** and the object is routed to the Human Review Queue, where an
operator picks PASS or REJECT (logged as `HUMAN_OVERRIDE`).

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Open the page, press **RUN DEMO**. Within ~5 seconds an UNCAPPED bottle reaches
the inspection gate, Jev returns REJECT, the eject is simulated, and the KPIs,
event log, charts and anomaly panel update.

Other scripts:

```bash
npm run build            # type-check + production bundle in dist/
npm run typecheck
npm run gen:detections   # regenerate public/demo/detections.json from the Normal scenario
```

Keyboard: `Space` toggles play/pause.

---

## Simulation Mode (MODE A, default)

* No external services. Works offline.
* Detections are generated deterministically per scenario in
  `src/data/demoDetections.ts` (seeded PRNG), replayed against the playback
  clock, with smooth tracking jitter so boxes look tracked rather than static.
* Object decisions follow these rules (`services/decisionEngine.ts`):

  | cap confidence | decision |
  | --- | --- |
  | ≥ 0.75 | PASS |
  | 0.45 – 0.75 | RECHECK (re-sampled once, then PASS / HUMAN_REVIEW) |
  | 0.20 – 0.45 | HUMAN_REVIEW |
  | < 0.20 | REJECT |

* Line decisions: reject rate over the trailing 60 s (shrunk towards the nominal
  5 % while the sample is small) → NORMAL / WATCH / SLOW_LINE / STOP_LINE;
  camera confidence < 0.7 → HUMAN_REVIEW.
* Simulated decision latency (40–110 ms) feeds the DECISION LATENCY KPI.

### Demo video

Place a clip at `public/demo/bottling-line.mp4` (fallback: `public/demo/sample.mp4`).
The `<video>` element then becomes the clock and detections are drawn over it.
If neither exists, a **SYNTHETIC FEED** is rendered on a canvas from the same
track data, so the whole pipeline still runs end-to-end. The feed is labelled as
synthetic on screen.

### Mock detection data

`public/demo/detections.json` is the keyframe format a real tracker would emit
(and what `npm run gen:detections` produces from the Normal scenario):

```json
{ "time": 0.8, "id": 1, "bbox": [0.12, 0.31, 0.16, 0.48], "class": "capped", "confidence": 0.94 }
```

`bbox` is `[x, y, width, height]` normalized to 0–1, so overlays follow any
video size. Multiple keyframes with the same `id` form a track and are
interpolated; a single keyframe is extrapolated along the conveyor.
`timelineToTracks()` in `src/data/demoDetections.ts` loads this format.

### Scenarios

| Scenario | Uncapped | Notes |
| --- | --- | --- |
| Normal Production | 5 % | baseline |
| High Reject Rate | 25 % | ANOMALY ALERT raises once the 60 s reject rate exceeds 15 % |
| Sensor Noise | 6 % | jittery boxes, many HUMAN_REVIEW escalations |
| Cap Misalignment | 5 % | many RECHECK rounds |
| Camera Confidence Drop | 5 % | exposure fault 18–48 s; CAMERA → DEGRADED, line → HUMAN_REVIEW |
| Line Congestion | 7 % | bunched bottles, higher throughput |

---

## Real Jev Mode (MODE B)

Enabled automatically when `TYPESAFE_API_KEY` exists in the **server**
environment (copy `.env.example` to `.env`). The browser bundle only receives a
boolean (`__JEV_KEY_PRESENT__`); requests go to `/api/jev/decide` and the Vite dev
server plugin in `vite.config.ts` forwards them to `JEV_API_URL` with the bearer
key attached. For production, replace that plugin with an equivalent FastAPI or
Express route.

* UI shows **JEV LIVE** instead of **SIMULATION**; every decision is tagged
  `engine: "jev"`.
* Any API error or timeout (2.5 s) falls back to the simulation engine for that
  decision, increments the fallback counter and sets JEV status to FALLBACK.
* A response whose `decision` is not one of the offered options is rejected.

The request/response contract is defined in `src/services/jevDecisionEngine.ts`
(`JevObjectRequest`, `JevLineRequest`, `JevResponse`). Adjust the mapping there if
the real endpoint shape differs; nothing else needs to change.

---

## Event engine

All layers communicate through `services/eventBus.ts`. Events per object:

```
OBJECT_ENTERED → OBJECT_TRACKED → INSPECTION_STARTED → CAP_CONFIDENCE
  → (RECHECK → CAP_CONFIDENCE)* → PASS | REJECT | HUMAN_REVIEW
  → INSPECTION_COMPLETED → [EJECT_TRIGGERED] → OBJECT_EXITED
```

Plus `LINE_DECISION`, `ALERT`, `HUMAN_OVERRIDE`, `SYSTEM`. The Event Log shows
wall-clock timestamps with milliseconds and can be exported as JSON or CSV
(inspection records are exported too, in the persisted-record shape below).

```json
{
  "timestamp": "2026-09-19T05:53:15.706Z",
  "objectId": "#010",
  "vision": { "bottle": 0.96, "cap": 0.88, "alignment": 0.89 },
  "decision": { "result": "PASS", "confidence": 0.85, "reason": "CAP_OK", "engine": "simulation" },
  "action": "RELEASE",
  "latencyMs": 45
}
```

---

## Project layout

```
src/
  components/   VideoInspection, DetectionOverlay, DetectionLabel, InspectionGate, SyntheticFeed,
                InspectorPanel, KpiHeader, SystemStatus, FactoryStatus, DecisionPanel,
                LineDecisionPanel, AnomalyPanel, HumanReviewQueue, EventLog, InspectionChart,
                ControlPanel, ScenarioSelector, Panel
  services/     videoDetectionSimulator, decisionEngine, jevDecisionEngine, decisionActions,
                eventBus, inspectionStore, inspectionController, playbackClock, exportLog
  types/        inspection.ts (all cross-layer contracts)
  data/         demoDetections.ts (track generator + JSON codec), scenarios.ts
public/demo/    detections.json (+ optional bottling-line.mp4 / sample.mp4)
scripts/        generate-detections.mts
```

Performance: the overlay is drawn on a canvas inside one `requestAnimationFrame`
loop synced to media time; bounding boxes never pass through React state. The
dashboard store (`useSyncExternalStore`) updates only on events.

---

## Future CV integration

Replace `VideoDetectionSimulator` with a module that emits the same
`FrameDetection[]` per frame and the same lifecycle events:

* **Camera**: RTSP → frame grabber (GStreamer / FFmpeg) → frame timestamp becomes the `PlaybackClock`.
* **Inference**: ONNX Runtime / TensorRT / OpenVINO running YOLO, RT-DETR or a custom cap model.
* **Tracking**: ByteTrack / SORT / DeepSORT assigning the stable `trackId` (today `id` in the JSON).
* **Classes**: `DetectionClass` already reserves LOW_CAP, MISALIGNED_CAP, DAMAGED_CAP, NO_LABEL,
  LABEL_MISALIGNED, DEFORMED_BOTTLE, FOREIGN_OBJECT; enable them in `ENABLED_CLASSES`.
* **Browser-side option**: OpenCV.js / ONNX Runtime Web can run a light model directly on the
  `<video>` element and feed the same interface.

## Factory integration

* **Messaging**: publish the event bus to MQTT topics; the dashboard subscribes instead of running the simulator.
* **Storage**: persist `InspectionRecord` to PostgreSQL / TimescaleDB (the export JSON is that schema).
* **Machine control**: `REJECT` → PLC (OPC-UA / Modbus) → reject gate. **Not implemented in Phase 1**:
  the prototype never addresses a PLC; `EJECT_TRIGGERED` events are explicitly marked `simulated`.
* **Line control**: `SLOW_LINE` / `STOP_LINE` from the line-level Jev decision map to the same PLC
  path, always behind a human-confirmable step.

## Non-goals in Phase 1

* No real model inference, no PLC communication, no backend persistence.
* The Jev API request shape is a proposed contract, to be confirmed against the actual endpoint.
