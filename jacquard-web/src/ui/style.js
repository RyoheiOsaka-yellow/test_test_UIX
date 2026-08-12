// Metrics, taken from mockup.html.
//
// The cell pitch is what everything else is derived from: a cell is 30x32 with a 4px
// gutter, so a column is 34 apart and a row 36. Keeping those numbers in one place is
// what lets the painted layers and the tile elements agree on where a cell is to the
// pixel. The pitch is set by what has to fit inside one rather than by taste: a sharp
// note name is a little over twenty pixels wide, and the icons are drawn in a 15x15
// box.

export const CellWidth = 30
export const CellHeight = 32
export const Gap = 4
export const Padding = 18

export const StrideX = CellWidth + Gap
export const StrideY = CellHeight + Gap

// Jump links run off-axis, right of the column centres and below the row centres, so
// that they read as a separate layer from the rails they cross. The half pixel keeps
// the 1px stroke on a pixel boundary.
export const LinkOffset = 7.5
export const LinkRadius = 6

// Top left corner of a cell in plane coordinates.
export const cellOrigin = p => ({
  x: Padding + p.x * StrideX,
  y: Padding + p.y * StrideY
})

export const cellCenter = p => ({
  x: Padding + p.x * StrideX + CellWidth / 2,
  y: Padding + p.y * StrideY + CellHeight / 2
})

// Which cell a plane coordinate falls in. Points in a gutter belong to the cell above
// and to the left of them, so there is no dead zone.
export const cellAt = (x, y) => ({
  x: Math.floor((x - Padding) / StrideX),
  y: Math.floor((y - Padding) / StrideY)
})

export const planeSize = (columns, rows) => ({
  width: Padding * 2 + columns * StrideX - Gap,
  height: Padding * 2 + rows * StrideY - Gap
})
