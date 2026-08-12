// The icons a cell draws, in the 15x15 box mockup.html settled on.
//
// 1px strokes on half-integer coordinates, so the centre of a stroke lands on a pixel
// boundary rather than across one. The jump link's 7.5px offset is the same
// arithmetic.
//
// Two families of names. What is used as a part is named after its shape (fader,
// chevron, arrowHead, line); what draws one kind of tile is named after its role
// (cycle, prob, uTurn, zigzag, entry).

const ICON = 15
const ICON_TOP = 1.5
const ICON_BOTTOM = 13.5

const svgIcon = body =>
  '<svg width="' + ICON + '" height="' + ICON + '" viewBox="0 0 ' + ICON + ' ' + ICON +
  '" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"' +
  ' aria-hidden="true">' + body + '</svg>'

const line = (x1, y1, x2, y2) => '<path d="M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2 + '"/>'

const chevron = (cx, tipY, baseY, hw) =>
  '<path d="M' + (cx - hw) + ' ' + baseY + 'L' + cx + ' ' + tipY +
  'L' + (cx + hw) + ' ' + baseY + '"/>'

const arrowHead = (tipX, baseX, cy, hw) =>
  '<path d="M' + tipX + ' ' + cy + 'L' + baseX + ' ' + (cy - hw) +
  'L' + baseX + ' ' + (cy + hw) + 'Z" fill="currentColor" stroke="none"/>'

// Flow runs right along the top, turns back on itself and exits left. The head is a
// solid triangle, like the markers it sits among on the rail.
function uTurn(y0, y1, xr) {
  const r = (y1 - y0) / 2
  return line(2.5, y0, xr, y0) +
         '<path d="M' + xr + ' ' + y0 + 'A' + r + ' ' + r + ' 0 0 1 ' + xr + ' ' + y1 + '"/>' +
         line(xr, y1, 4.4, y1) +
         arrowHead(2, 5, y1, 2.4)
}

// Z-shaped arrow rounded off at both turns: the sequence leaves this lane.
function zigzag() {
  const y0 = 3.5, y1 = 10.5, x0 = 2.5, x1 = 10.5, x2 = 4.5, x3 = 10.4
  const r = 1.7
  const len = Math.hypot(x2 - x1, y1 - y0)
  const ux = (x2 - x1) / len * r, uy = (y1 - y0) / len * r

  return '<path d="M' + x0 + ' ' + y0 +
         'L' + (x1 - r).toFixed(2) + ' ' + y0 +
         'Q' + x1 + ' ' + y0 + ' ' + (x1 + ux).toFixed(2) + ' ' + (y0 + uy).toFixed(2) +
         'L' + (x2 - ux).toFixed(2) + ' ' + (y1 - uy).toFixed(2) +
         'Q' + x2 + ' ' + y1 + ' ' + (x2 + r).toFixed(2) + ' ' + y1 +
         'L' + x3 + ' ' + y1 + '"/>' +
         arrowHead(x3 + 3, x3, y1, 2.2)
}

// Arrow rising out of a bar: where a jump lands and a lane begins.
function entry() {
  const cy = 7.5, x = 2.5
  return line(x, 3.5, x, 11.5) + line(x, cy, 10.4, cy) + arrowHead(13.4, 10.4, cy, 2.2)
}

function fader(cx, cy) {
  const kw = 6, kh = 3
  const top = cy - kh / 2, bottom = cy + kh / 2
  return line(cx, ICON_TOP, cx, top) +
         line(cx, bottom, cx, ICON_BOTTOM) +
         '<rect x="' + (cx - kw / 2) + '" y="' + top + '" width="' + kw +
         '" height="' + kh + '" rx="1"/>'
}

function upDown(cx) {
  const hw = 2, hh = 2.8
  return line(cx, ICON_TOP, cx, ICON_BOTTOM) +
         chevron(cx, ICON_TOP, ICON_TOP + hh, hw) +
         chevron(cx, ICON_BOTTOM, ICON_BOTTOM - hh, hw)
}

export const Icons = {
  PABS: svgIcon(fader(7.5, 6)),
  PREL: svgIcon(fader(4.5, 6) + upDown(11.5)),
  TERM: svgIcon(uTurn(2.5, 10.5, 9.5)),
  JUMP: svgIcon(zigzag()),
  JDST: svgIcon(entry())
}

// GCYC: one box per lap of the cycle, the firing ones filled.
//
// The boxes wrap at four to a line, because a cell is thirty pixels across whatever
// the period is; past eight it stops counting and draws six and an ellipsis, since
// nobody reads twelve boxes off a cell and the exact laps are the panel's business.
// Six is also what leaves the ellipsis somewhere to stand: a second line of two leaves
// two boxes' worth of ground at the bottom right, so the dots take no width of their
// own and an elided icon is the same block as a full one.
//
// The row is held five pixels clear of the cell on each side, which puts a box at
// three pixels where a row fitted to the cell would have five: the figure is a shape
// to recognise rather than a count to take off the cell, and filled against hollow
// survives the narrowing.
export function cycle(period, pattern) {
  const elided = period > 8
  const shown = elided ? 6 : period

  const perRow = Math.min(shown, 4)
  const w = perRow >= 4 ? 3 : 5
  const gap = 2
  const h = 6

  const rows = Math.ceil(shown / perRow)
  const width = perRow * (w + gap) - gap + 1 + (elided ? w + gap : 0)
  const height = rows * (h + gap) - gap + 1

  let boxes = ''

  for (let i = 0; i < shown; i++) {
    const column = i % perRow
    const row = Math.floor(i / perRow)
    const x = column * (w + gap) + 0.5
    const y = row * (h + gap) + 0.5
    const paint = pattern[i] === '1'
      ? 'fill="currentColor"' : 'fill="none" stroke="currentColor"'

    boxes += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
             '" ' + paint + '/>'
  }

  if (elided) {
    // In the ground the second line leaves at its right, so the dots cost no width.
    const y = (h + gap) + h / 2 + 0.5
    const x = 2 * (w + gap) + 0.5

    for (let i = 0; i < 3; i++)
      boxes += '<rect x="' + (x + i * 2) + '" y="' + y +
               '" width="1" height="1" fill="currentColor"/>'
  }

  return '<svg width="' + width + '" height="' + height + '" viewBox="0 0 ' + width +
         ' ' + height + '" shape-rendering="crispEdges" aria-hidden="true">' + boxes +
         '</svg>'
}

// GPRB: the firing chance as a filled wedge, from a percentage.
export function prob(percent) {
  const c = 5.5, r = 5
  const a = (percent / 100) * Math.PI * 2
  const x = (c + r * Math.sin(a)).toFixed(2)
  const y = (c - r * Math.cos(a)).toFixed(2)
  const large = percent > 50 ? 1 : 0

  const ring = '<circle cx="' + c + '" cy="' + c + '" r="' + r + '"'

  const wedge = percent >= 100
    ? ring + ' fill="currentColor"/>'
    : '<path d="M' + c + ' ' + c + ' L' + c + ' ' + (c - r) +
      ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x + ' ' + y +
      ' Z" fill="currentColor"/>'

  return '<svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">' +
         wedge + ring + ' fill="none" stroke="currentColor"/></svg>'
}

// The pass-through marker, which shows on a rail cell whose step holds nothing.
export const Marker =
  '<svg width="7" height="9" viewBox="0 0 7 9" aria-hidden="true">' +
  '<path d="M0 0 L7 4.5 L0 9 Z" fill="currentColor"/></svg>'

// A rounded path through a run of points, which is what a jump link is drawn with.
export function roundedPath(points, r) {
  const at = q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)

  const toward = (from, to, d) => {
    const dx = to[0] - from[0], dy = to[1] - from[1]
    const len = Math.hypot(dx, dy) || 1
    const t = Math.min(d, len / 2) / len
    return [from[0] + dx * t, from[1] + dy * t]
  }

  let d = 'M' + at(points[0])

  for (let i = 1; i < points.length - 1; i++)
    d += 'L' + at(toward(points[i], points[i - 1], r)) +
         'Q' + at(points[i]) + ' ' + at(toward(points[i], points[i + 1], r))

  return d + 'L' + at(points[points.length - 1])
}
