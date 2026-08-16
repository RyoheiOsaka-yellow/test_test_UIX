#!/usr/bin/env python3
"""
Rasterise the brand SVGs to PNG with headless Chromium.

Chromium fits an SVG to the window while preserving aspect ratio, so the window
is sized from each file's viewBox to avoid letterboxing. Run after
generate_logos.py:

    python3 export_png.py
"""

import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PNG = os.path.join(HERE, "png")

CANDIDATES = [
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
]

def jobs():
    """Every generated SVG, widest-first so the sheet order is stable."""
    out = []
    for name in sorted(os.listdir(HERE)):
        if not name.endswith(".svg"):
            continue
        width = 1024 if name.startswith("yellow-mark-") else 2000
        out.append((name, width))
    return out


def chrome():
    for c in CANDIDATES:
        if os.path.exists(c):
            return c
    found = shutil.which("chromium") or shutil.which("google-chrome")
    if not found:
        sys.exit("no chromium binary found; set one in CANDIDATES")
    return found


def viewbox(path):
    with open(path, encoding="utf-8") as f:
        head = f.read(2048)
    m = re.search(r'viewBox="([-\d.eE ]+)"', head)
    _x, _y, w, h = (float(v) for v in m.group(1).split())
    return w, h


def main():
    os.makedirs(PNG, exist_ok=True)
    binary = chrome()
    for name, width in jobs():
        src = os.path.join(HERE, name)
        w, h = viewbox(src)
        height = max(1, round(width * h / w))
        out = os.path.join(PNG, name.replace(".svg", ".png"))
        cmd = [
            binary, "--headless", "--disable-gpu", "--no-sandbox",
            "--hide-scrollbars", "--force-device-scale-factor=1",
            "--default-background-color=ffffffff",
            f"--screenshot={out}", f"--window-size={width},{height}",
            f"file://{src}",
        ]
        subprocess.run(cmd, check=True, stderr=subprocess.DEVNULL)
        print(f"{os.path.basename(out)}  {width}x{height}")


if __name__ == "__main__":
    main()
