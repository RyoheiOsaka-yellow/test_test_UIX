# OBJECT STROBE: turbocharger

A 9.6 s vertical loop (288 frames, 30 fps, 1080×1920) built entirely in code. See `board/OBJECT.md` for the
object study that every script reads from.

## Setup

```bash
python3 -m venv ../.venv
../.venv/bin/pip install bpy numpy opencv-python-headless pillow
```

Blender is used as the `bpy` Python module (5.3.0), so there is no separate Blender install.
Fonts (SIL OFL) live in `fonts/` and are loaded by path.

## Scripts

| Script | What it does | Command |
|---|---|---|
| `scripts/preflight_cube.py` | One 540×960 frame of a dispersive glass cube with the final render settings; prints device and s/frame | `../.venv/bin/python scripts/preflight_cube.py renders/preflight_cube.png` |

## Preflight result

Device: CPU (4 cores, no GPU), Cycles + OpenImageDenoise. Cube at 540×960, 128 spp, threshold 0.03: 44.6 s.
