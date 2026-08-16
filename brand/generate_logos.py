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

Mark geometry, all relative to the event horizon radius r
---------------------------------------------------------
The disk is seen exactly edge-on. Its near side crosses the face of the hole
and is knocked out of the black; its far side is bent up and over by gravity
and reads as two arcs riding outside the hole. A ringed planet hides its ring
behind itself — a black hole never does, and that is the whole difference.

    event horizon   r      (always filled)
    disk            ±3.60 r
    lensed arc      1.45 r radius, stopping 25 degrees short of the disk plane
    photon ring     1.14 r ("halo" and "core" forms)
"""

import math
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

EXTENT_K = 3.60    # disk half-width, in event-horizon radii
ARC_K = 1.45       # radius of the lensed arcs
ARC_OPEN_DEG = 25  # how far the arcs stop short of the disk plane
RING_K = 1.14      # photon ring, "halo" form only
SLIT_K = 1.03      # the near side of the disk, crossing the face of the hole

FORMS = ("eclipse", "halo", "core")

# default horizon radius: the mark then stands exactly one cap height tall
MARK_R = CAP / (2 * ARC_K)


def mark(cx, cy, r, form="eclipse", ink=INK, paper=PAPER, stroke=None,
         invert=False):
    """
    Edge-on black hole in hairline. `r` is the event horizon radius.

    Saturn's ring disappears behind the planet; a black hole's never does — the
    far side of the disk is bent up and over, so it reads as two arcs riding
    outside the hole, while the near side crosses the face and is knocked out
    of the black. That knockout is what keeps this from reading as a ringed
    planet, so the horizon stays filled in every form.

    form:
      eclipse   arcs + disk. The default.
      halo      arcs + disk + photon ring hugging the horizon.
      core      disk + photon ring, no arcs. The quietest, for small sizes.

    invert: white line on a black ground. The horizon is then the ground
    itself, so the disk runs straight through and the photon ring draws it.
    """
    sw = STROKE * r / MARK_R if stroke is None else stroke
    ext = r * EXTENT_K
    # the horizon is always the dark; on an inverted ground that dark *is* the
    # ground, which is why the knockout form has no slit to cut
    line = paper if invert else ink
    out = []

    if form in ("eclipse", "halo"):
        a = math.radians(ARC_OPEN_DEG)
        ax, ay = ARC_K * r * math.cos(a), ARC_K * r * math.sin(a)
        for s in (-1, 1):
            out.append(f'    <path d="M{cx - ax:g} {cy + s * ay:g}'
                       f'A{ARC_K * r:g} {ARC_K * r:g} 0 0 {0 if s > 0 else 1} '
                       f'{cx + ax:g} {cy + s * ay:g}"/>')

    out.append(f'    <circle cx="{cx:g}" cy="{cy:g}" r="{r:g}" fill="{ink}" '
               f'stroke="none"/>')
    if form in ("halo", "core") or invert:
        out.append(f'    <circle cx="{cx:g}" cy="{cy:g}" r="{r * RING_K:g}"/>')

    out.append(f'    <path d="M{cx - ext:g} {cy:g}H{cx + ext:g}"/>')
    if not invert:
        # the near side of the disk, in front of the hole
        out.append(f'    <path d="M{cx - r * SLIT_K:g} {cy:g}H{cx + r * SLIT_K:g}" '
                   f'stroke="{paper}"/>')

    body = "\n".join(out)
    return (f'  <g fill="none" stroke="{line}" stroke-width="{sw:g}" '
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


def placement(kind, form="eclipse", ink=INK, paper=PAPER, bg=None):
    """
    Candidates, all with the mark set beside the wordmark — never over it.

    a  left, on the centre line          e  above, flush left with the Y
    b  right, on the centre line         f  below, flush right with the W
    c  above, centred                    g  above, centred, mark at 2x
    d  below, centred                    h  left, on the centre line, small
    """
    # default: the mark stands exactly one cap height tall
    r = {"g": 2 * MARK_R, "h": 0.62 * MARK_R}.get(kind, MARK_R)
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


def form_plate(form, invert=False, size=512.0):
    r = size * 0.115
    c = size / 2
    return svg((0, 0, size, size), mark(c, c, r, form, invert=invert),
               f"YELLOW mark ({form})", INK if invert else PAPER,
               "Edge-on black hole mark")


def construction(form="eclipse"):
    """Dimension drawing for the mark, in multiples of the horizon radius r."""
    g, gl = "#7E8BA3", "#C6CEDA"
    r = MARK_R
    ext, arc = r * EXTENT_K, r * ARC_K
    lab = ('font-family="ui-monospace, SFMono-Regular, Menlo, monospace" '
           f'font-size="9" fill="{g}"')

    guides = [
        f'<path d="M{-ext - 34:g} 0H{ext + 34:g}" stroke="{gl}" stroke-dasharray="6 5"/>',
        f'<path d="M0 {-arc - 34:g}V{arc + 34:g}" stroke="{gl}" stroke-dasharray="6 5"/>',
        f'<circle cx="0" cy="0" r="{arc:g}" fill="none" stroke="{gl}" stroke-dasharray="4 4"/>',
        f'<path d="M{-ext:g} -14v28M{ext:g} -14v28" stroke="{g}"/>',
    ]
    labels = [
        (0, -arc - 14, "middle", f"lensed arc  {ARC_K:.2f} r,  open {ARC_OPEN_DEG}\u00b0"),
        (0, arc + 22, "middle", f"disk  \u00b1{EXTENT_K:.2f} r"),
        (arc + 16, r * 0.95, "start", "event horizon  r"),
        (-ext - 30, 4, "end", "stroke = wordmark stroke"),
    ]
    text = "\n".join(f'  <text x="{x:g}" y="{y:g}" text-anchor="{a}" {lab}>{t}</text>'
                     for x, y, a, t in labels)
    body = ('  <g stroke-width="0.7" fill="none">\n    ' + "\n    ".join(guides)
            + "\n  </g>\n" + mark(0, 0, r, form) + "\n" + text)
    vb = (-ext - 160, -arc - 48, 2 * (ext + 160), 2 * (arc + 48))
    return svg(vb, body, "YELLOW mark construction", PAPER,
               "Construction drawing for the edge-on black hole mark")


# --------------------------------------------------------------------------
# Inset: the mark nested inside the O
# --------------------------------------------------------------------------
#
# The O of the wordmark becomes the ring of light, so the mark inside it is
# just the hole and the disk. The disk is the one part allowed to break out of
# the letter — everything else stays within the counter.

O_X, O_W = [(x, w) for ch, x, w in PLACED if ch == "O"][0]
O_CX, O_CY, O_RX, O_RY = O_X + O_W / 2, CAP / 2, O_W / 2, CAP / 2

INSET_R = 26.0            # horizon radius inside the counter
INSET_ARC_K = 1.42        # optional lensed arcs, still inside the counter

# How far the disk runs, measured from the centre of the O. "mid" fills the
# letterspace exactly: it starts where the L ends and stops where the W begins,
# so the disk is bounded by the typography rather than by an arbitrary length.
REACH = {
    "short": O_RX,          # stops at the letter
    "mid": O_RX + TRACK,    # fills the letterspace on both sides
}


def inset_mark(cx, cy, r, half, arcs=False, invert=False):
    """Hole plus edge-on disk, sized to sit inside the O."""
    line = PAPER if invert else INK
    out = []
    if arcs:
        a = math.radians(ARC_OPEN_DEG)
        ax, ay = INSET_ARC_K * r * math.cos(a), INSET_ARC_K * r * math.sin(a)
        for s in (-1, 1):
            out.append(f'    <path d="M{cx - ax:g} {cy + s * ay:g}'
                       f'A{INSET_ARC_K * r:g} {INSET_ARC_K * r:g} 0 0 '
                       f'{0 if s > 0 else 1} {cx + ax:g} {cy + s * ay:g}"/>')

    out.append(f'    <circle cx="{cx:g}" cy="{cy:g}" r="{r:g}" fill="{INK}" '
               f'stroke="none"/>')
    if invert:
        # on a dark ground the horizon is the ground, so its edge has to be drawn
        out.append(f'    <circle cx="{cx:g}" cy="{cy:g}" r="{r:g}"/>')
    out.append(f'    <path d="M{cx - half:g} {cy:g}H{cx + half:g}"/>')
    if not invert:
        out.append(f'    <path d="M{cx - r * 1.05:g} {cy:g}H{cx + r * 1.05:g}" '
                   f'stroke="{PAPER}"/>')

    return (f'  <g fill="none" stroke="{line}" stroke-width="{STROKE:g}" '
            f'stroke-linecap="butt">\n' + "\n".join(out) + "\n  </g>")


def inset(reach="mid", arcs=False, invert=False):
    half = REACH[reach]
    line = PAPER if invert else INK
    body = (wordmark(line) + "\n"
            + inset_mark(O_CX, O_CY, INSET_R, half, arcs, invert))
    x0 = min(0.0, O_CX - half)
    x1 = max(WORD_W, O_CX + half)
    vb = (x0 - PAD, -PAD, (x1 - x0) + 2 * PAD, CAP + 2 * PAD)
    return svg(vb, body, "YELLOW", INK if invert else PAPER,
               "YELLOW with the edge-on black hole set inside the O")


def inset_symbol(reach="mid", arcs=False, invert=False):
    """Just the O with the hole in it — an avatar cut from the logotype."""
    half = REACH[reach]
    line = PAPER if invert else INK
    o = (f'  <g fill="none" stroke="{line}" stroke-width="{STROKE:g}">\n'
         f'    <path d="{LETTERS["O"][1]}" transform="translate({O_X:g} 0)"/>\n'
         f"  </g>")
    body = o + "\n" + inset_mark(O_CX, O_CY, INSET_R, half, arcs, invert)
    w = 2 * (half + PAD)
    vb = (O_CX - w / 2, O_CY - w / 2, w, w)
    return svg(vb, body, "YELLOW symbol", INK if invert else PAPER,
               "The O of YELLOW with the edge-on black hole inside it")


def inset_construction():
    g, gl = "#7E8BA3", "#C6CEDA"
    half = REACH["mid"]
    lab = ('font-family="ui-monospace, SFMono-Regular, Menlo, monospace" '
           f'font-size="9" fill="{g}"')
    guides = [
        f'<path d="M{O_CX - half - 30:g} {O_CY:g}H{O_CX + half + 30:g}" '
        f'stroke="{gl}" stroke-dasharray="6 5"/>',
        f'<path d="M{O_CX:g} -34V134" stroke="{gl}" stroke-dasharray="6 5"/>',
        f'<path d="M{O_CX - O_RX:g} -18v14M{O_CX + O_RX:g} -18v14" stroke="{g}"/>',
        f'<path d="M{O_CX - half:g} 118v14M{O_CX + half:g} 118v14" stroke="{g}"/>',
    ]
    labels = [
        (O_CX, -24, "middle", "O は変更しない"),
        (O_CX, 146, "middle", f"disk \\u00b1{half / CAP:.2f} H  =  O + \\u5b57\\u9593"),
        (O_CX + INSET_R + 10, O_CY - INSET_R - 6, "start",
         f"horizon r = {INSET_R / CAP:.2f} H"),
    ]
    text = "\n".join(f'  <text x="{x:g}" y="{y:g}" text-anchor="{a}" {lab}>{t}</text>'
                     for x, y, a, t in labels)
    o = (f'  <g fill="none" stroke="{INK}" stroke-width="{STROKE:g}">\n'
         f'    <path d="{LETTERS["O"][1]}" transform="translate({O_X:g} 0)"/>\n  </g>')
    body = ('  <g stroke-width="0.7" fill="none">\n    ' + "\n    ".join(guides)
            + "\n  </g>\n" + o + "\n"
            + inset_mark(O_CX, O_CY, INSET_R, half) + "\n" + text)
    vb = (O_CX - half - 90, -62, 2 * (half + 90), 246)
    return svg(vb, body, "YELLOW inset construction", PAPER,
               "Construction drawing for the mark set inside the O")


PLACEMENT_FORMS = ("eclipse", "core")   # the full mark, and the quiet one


def main():
    forms = sys.argv[1:] or PLACEMENT_FORMS
    for f in forms:
        if f not in FORMS:
            sys.exit(f"unknown form {f!r}; pick from {', '.join(FORMS)}")

    for f in FORMS:
        write(f"yellow-mark-{f}.svg", form_plate(f))
    write("yellow-mark-knockout.svg", form_plate("halo", invert=True))

    for f in forms:
        for kind in "abcdefgh":
            write(f"yellow-place-{kind}-{f}.svg", placement(kind, f))

    write("yellow-mark-construction.svg", construction("eclipse"))

    for reach in REACH:
        write(f"yellow-inset-{reach}.svg", inset(reach))
    write("yellow-inset-arcs.svg", inset("mid", arcs=True))
    write("yellow-inset-knockout.svg", inset("mid", invert=True))
    write("yellow-inset-symbol.svg", inset_symbol("mid"))
    write("yellow-inset-construction.svg", inset_construction())


if __name__ == "__main__":
    main()
