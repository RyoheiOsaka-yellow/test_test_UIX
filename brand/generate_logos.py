#!/usr/bin/env python3
"""
YELLOW — edge-on black hole mark, drawn in the same hairline as the wordmark.

Everything here is black line only. The mark never overlaps the wordmark; it is
placed beside it, and this script emits the placement candidates so the balance
can be judged side by side.

THE WORDMARK IS A STAND-IN
--------------------------
The supplied YELLOW logo is an image, not vector artwork, so the letters below
are re-struck on the same skeleton (cap height 100, stroke 3.4 = 1:29, tracking
0.72 H) purely so the placements can be judged at the right proportions. The
official letterforms are not modified by anything in this file — drop the real
artwork in and the mark geometry is unchanged.

Mark geometry, all relative to the ring radius r
------------------------------------------------
The disk is seen exactly edge-on: its plane runs flat through the middle of the
hole, and the far side is gravitationally lensed into arcs above and below.

    ring          r
    horizon       0.66 r   (filled variants only)
    disk          ±2.60 r  wide, ±0.26 r open (a hair off perfectly edge-on,
                           so the disk reads as a disk and not as a rule)
    lensed arc    ±1.18 r  tall, ±1.42 r wide
"""

import os
import sys

OUT = os.path.dirname(os.path.abspath(__file__))

INK = "#000000"
PAPER = "#FFFFFF"

# --------------------------------------------------------------------------
# Wordmark (stand-in — see module docstring)
# --------------------------------------------------------------------------

CAP = 100.0
STROKE = 3.4
TRACK = 72.0

LETTERS = {
    "Y": (84.0, "M0 0L42 55L84 0M42 55V100"),
    "E": (66.0, "M0 0V100M0 0H66M0 50H57M0 100H66"),
    "L": (62.0, "M0 0V100H62"),
    "O": (84.0, "M0 50A42 50 0 1 0 84 50A42 50 0 1 0 0 50"),
    "W": (158.0, "M0 0L40 100L86 0M72 0L118 100L158 0"),
}

WORD = "YELLOW"


def layout(word=WORD, track=TRACK):
    out, x = [], 0.0
    for i, ch in enumerate(word):
        w = LETTERS[ch][0]
        out.append((ch, x, w))
        x += w + (track if i < len(word) - 1 else 0)
    return out, x


PLACED, WORD_W = layout()


def wordmark(ink=INK, x=0.0, y=0.0, stroke=STROKE):
    paths = "\n".join(
        f'    <path d="{LETTERS[ch][1]}" transform="translate({x + lx:g} {y:g})"/>'
        for ch, lx, _w in PLACED
    )
    return (f'  <g fill="none" stroke="{ink}" stroke-width="{stroke:g}" '
            f'stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="6">\n'
            f"{paths}\n  </g>")


# --------------------------------------------------------------------------
# Mark
# --------------------------------------------------------------------------

HORIZON_K = 0.80   # filled event horizon, inside the photon ring
EXTENT_K = 2.90    # disk half-width
OPEN_K = 0.22      # how far the disk ellipse opens; 0 would be a bare rule
ARC_K = 1.34       # lensed arc apex
ARC_SPAN_K = 1.72  # lensed arc width

FORMS = ("ring", "solid", "lens", "lens-solid")


def mark(cx, cy, r, form="solid", ink=INK, paper=PAPER, stroke=None):
    """
    Edge-on black hole in hairline. The disk is always a flat ellipse whose
    near half crosses in front of the hole.

    form:
      ring        photon ring + disk, hollow
      solid       photon ring + disk, event horizon filled
      lens        hollow, with the far side of the disk lensed above and below
      lens-solid  filled, with the lensed arcs
    """
    sw = STROKE * r / 42.0 if stroke is None else stroke
    ext, ry = r * EXTENT_K, r * OPEN_K
    span, apex = r * ARC_SPAN_K, r * ARC_K
    k = apex / 0.75
    solid = form.endswith("solid")
    lensed = form.startswith("lens")

    out = []
    if lensed:
        out.append(f'    <path d="M{cx - span:g} {cy:g}'
                   f'C{cx - 0.62 * span:g} {cy - k:g} {cx + 0.62 * span:g} {cy - k:g} '
                   f'{cx + span:g} {cy:g}'
                   f'M{cx - span:g} {cy:g}'
                   f'C{cx - 0.62 * span:g} {cy + k:g} {cx + 0.62 * span:g} {cy + k:g} '
                   f'{cx + span:g} {cy:g}"/>')

    # back half of the disk, then the hole, then the near half in front of it
    out.append(f'    <path d="M{cx - ext:g} {cy:g}'
               f'A{ext:g} {ry:g} 0 0 1 {cx + ext:g} {cy:g}"/>')
    out.append(f'    <circle cx="{cx:g}" cy="{cy:g}" r="{r:g}" '
               f'fill="{paper}"/>')
    if solid:
        out.append(f'    <circle cx="{cx:g}" cy="{cy:g}" r="{r * HORIZON_K:g}" '
                   f'fill="{ink}" stroke="none"/>')
    out.append(f'    <path d="M{cx - ext:g} {cy:g}'
               f'A{ext:g} {ry:g} 0 0 0 {cx + ext:g} {cy:g}"/>')

    body = "\n".join(out)
    return (f'  <g fill="none" stroke="{ink}" stroke-width="{sw:g}" '
            f'stroke-linecap="butt">\n{body}\n  </g>')


def mark_box(r):
    """(width, height) of the mark's ink, in mark units."""
    return 2 * r * EXTENT_K, 2 * r * ARC_K


# --------------------------------------------------------------------------
# SVG plumbing
# --------------------------------------------------------------------------

def svg(vb, body, title, bg=None, desc=""):
    d = f"\n  <desc>{desc}</desc>" if desc else ""
    rect = (f'  <rect x="{vb[0]:g}" y="{vb[1]:g}" width="{vb[2]:g}" '
            f'height="{vb[3]:g}" fill="{bg}"/>\n' if bg else "")
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="'
            f'{vb[0]:g} {vb[1]:g} {vb[2]:g} {vb[3]:g}" role="img" '
            f'aria-label="{title}">\n  <title>{title}</title>{d}\n'
            f"{rect}{body}\n</svg>\n")


def write(name, content):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        f.write(content)
    print("wrote", name)


PAD = TRACK          # clear space = one letterspace, baked into every export


# --------------------------------------------------------------------------
# Placement candidates
# --------------------------------------------------------------------------

def _bounds(items):
    xs = [v for x0, y0, x1, y1 in items for v in (x0, x1)]
    ys = [v for x0, y0, x1, y1 in items for v in (y0, y1)]
    return min(xs), min(ys), max(xs), max(ys)


def placement(kind, form="solid", ink=INK, paper=PAPER, bg=None):
    """
    Candidates, all with the mark set beside the wordmark — never over it.

    a  left, on the centre line          e  above, flush left with the Y
    b  right, on the centre line         f  below, flush right with the W
    c  above, centred                    g  above, centred, mark at 2x
    d  below, centred                    h  left, on the centre line, small
    """
    r = {"g": 84.0, "h": 30.0}.get(kind, 42.0)
    mw, mh = mark_box(r)
    gap = TRACK
    wordbox = (0.0, 0.0, WORD_W, CAP)

    if kind in ("a", "h"):
        cx, cy = -gap - mw / 2, CAP / 2
    elif kind == "b":
        cx, cy = WORD_W + gap + mw / 2, CAP / 2
    elif kind in ("c", "g"):
        cx, cy = WORD_W / 2, -gap - mh / 2
    elif kind == "d":
        cx, cy = WORD_W / 2, CAP + gap + mh / 2
    elif kind == "e":
        cx, cy = mw / 2, -gap - mh / 2
    elif kind == "f":
        cx, cy = WORD_W - mw / 2, CAP + gap + mh / 2
    else:
        raise ValueError(kind)

    markbox = (cx - mw / 2, cy - mh / 2, cx + mw / 2, cy + mh / 2)
    x0, y0, x1, y1 = _bounds([wordbox, markbox])
    vb = (x0 - PAD, y0 - PAD, (x1 - x0) + 2 * PAD, (y1 - y0) + 2 * PAD)

    # the mark's line is the wordmark's line — it never thickens with the mark
    body = wordmark(ink) + "\n" + mark(cx, cy, r, form, ink, paper, stroke=STROKE)
    return svg(vb, body, f"YELLOW placement {kind}", bg,
               "YELLOW wordmark with the edge-on black hole mark placed beside it")


def form_plate(form, ink=INK, paper=PAPER, bg=None, size=512.0):
    r = size * 0.155
    c = size / 2
    return svg((0, 0, size, size), mark(c, c, r, form, ink, paper),
               f"YELLOW mark ({form})", bg, "Edge-on black hole mark")


def construction(form="solid"):
    """Dimension drawing for the mark, in multiples of the ring radius r."""
    g, gl = "#7E8BA3", "#C6CEDA"
    r = 42.0
    cx, cy = 0.0, 0.0
    ext, apex = r * EXTENT_K, r * ARC_K
    lab = ('font-family="ui-monospace, SFMono-Regular, Menlo, monospace" '
           f'font-size="9" fill="{g}"')

    guides = [
        f'<path d="M{-ext - 30:g} {cy:g}H{ext + 30:g}" stroke="{gl}" stroke-dasharray="6 5"/>',
        f'<path d="M{cx:g} {-apex - 34:g}V{apex + 34:g}" stroke="{gl}" stroke-dasharray="6 5"/>',
        f'<circle cx="0" cy="0" r="{r:g}" fill="none" stroke="{g}" stroke-dasharray="4 4"/>',
        f'<path d="M{-ext:g} {-14:g}v28M{ext:g} {-14:g}v28" stroke="{g}"/>',
        f'<path d="M{-ext - 26:g} {-apex:g}h{2 * ext + 52:g}M{-ext - 26:g} {apex:g}'
        f'h{2 * ext + 52:g}" stroke="{gl}" stroke-dasharray="4 4"/>',
    ]
    labels = [
        (0, -apex - 12, "middle", f"lensed arc  ±{ARC_K:.2f} r"),
        (0, apex + 20, "middle", f"disk  ±{EXTENT_K:.2f} r wide  ·  ±{OPEN_K:.2f} r open"),
        (r + 8, -r - 6, "start", "photon ring  r"),
        (-ext - 26, 4, "end", "stroke = wordmark stroke"),
    ]
    text = "\n".join(f'  <text x="{x:g}" y="{y:g}" text-anchor="{a}" {lab}>{t}</text>'
                     for x, y, a, t in labels)
    body = ('  <g stroke-width="0.7" fill="none">\n    ' + "\n    ".join(guides)
            + "\n  </g>\n" + mark(cx, cy, r, form) + "\n" + text)
    vb = (-ext - 150, -apex - 46, 2 * (ext + 150), 2 * (apex + 46))
    return svg(vb, body, "YELLOW mark construction", PAPER,
               "Construction drawing for the edge-on black hole mark")


PLACEMENT_FORMS = ("ring", "solid")   # weight-matched, and the heavier black hole


def main():
    forms = sys.argv[1:] or PLACEMENT_FORMS
    for f in forms:
        if f not in FORMS:
            sys.exit(f"unknown form {f!r}; pick from {', '.join(FORMS)}")

    for f in FORMS:
        write(f"yellow-mark-{f}.svg", form_plate(f))
    write("yellow-mark-knockout.svg",
          form_plate("solid", ink=PAPER, paper=INK, bg=INK))

    for f in forms:
        for kind in "abcdefgh":
            write(f"yellow-place-{kind}-{f}.svg", placement(kind, f))

    write("yellow-mark-construction.svg", construction("ring"))


if __name__ == "__main__":
    main()
