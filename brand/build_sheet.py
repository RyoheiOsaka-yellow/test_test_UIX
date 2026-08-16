#!/usr/bin/env python3
"""
Inline every SVG into brand-sheet.template.html and write brand-sheet.html.

The sheet has to stand on its own (it is published as a hosted page, where
external file references are blocked), so the SVG markup is embedded rather
than linked. Each generated SVG already carries unique gradient/filter ids, so
inlining them side by side is safe.

    python3 generate_logos.py && python3 build_sheet.py
"""

import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, "brand-sheet.template.html")
TARGET = os.path.join(HERE, "brand-sheet.html")


def inline(match):
    name = match.group(1)
    path = os.path.join(HERE, name)
    with open(path, encoding="utf-8") as f:
        svg = f.read().strip()
    # the <title> inside each SVG would collide with the page title in a11y
    # trees, so keep it but drop the XML declaration if one ever appears
    return re.sub(r"^<\?xml[^>]*\?>\s*", "", svg)


def main():
    with open(TEMPLATE, encoding="utf-8") as f:
        html = f.read()
    out, missing = "", []

    def sub(m):
        try:
            return inline(m)
        except FileNotFoundError:
            missing.append(m.group(1))
            return ""

    out = re.sub(r"\{\{svg:([^}]+)\}\}", sub, html)
    if missing:
        raise SystemExit("missing SVGs: " + ", ".join(missing))

    with open(TARGET, "w", encoding="utf-8") as f:
        f.write(out)
    print(f"wrote brand-sheet.html  ({len(out) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
