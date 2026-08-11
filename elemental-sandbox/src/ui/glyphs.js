/**
 * Slot icons. Inline SVG paths — like everything else here, drawn rather than
 * loaded. Each one is the silhouette of what the ability actually does.
 */
const wrap = (body, color) =>
  `<svg class="slot__glyph" viewBox="0 0 32 32" fill="none" stroke="${color}"
        stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const glyphs = {
  // A lance of ice: a shaft with blades stood up along it.
  frost: (c) =>
    wrap(
      `<path d="M3 26 L29 26" opacity=".35"/>
       <path d="M7 26 L9 18 L11 26"/>
       <path d="M13 26 L16 12 L19 26"/>
       <path d="M21 26 L25 6 L28 26"/>
       <path d="M4 26 L5.5 22 L7 26" opacity=".7"/>`,
      c
    ),

  // A bolt: the classic zig, with a strike front.
  storm: (c) =>
    wrap(
      `<path d="M4 27 L13 15 L9 14 L20 4"/>
       <path d="M20 4 L17 13 L22 12 L14 24" opacity=".8"/>
       <path d="M24 20 L28 18 M25 25 L29 24" opacity=".55"/>`,
      c
    ),

  // A rock on an arc, with the crater it is heading for.
  cinder: (c) =>
    wrap(
      `<path d="M3 25 C 8 6, 20 6, 26 20" opacity=".5" stroke-dasharray="2 2.5"/>
       <circle cx="24" cy="15" r="4"/>
       <path d="M22 13 L25 16 M24 12 L26 14" opacity=".8"/>
       <path d="M17 28 L27 28" opacity=".45"/>`,
      c
    ),

  // A column of light with its shock discs.
  nova: (c) =>
    wrap(
      `<circle cx="6" cy="16" r="3.2"/>
       <path d="M9 13.5 L29 11 M9 18.5 L29 21"/>
       <path d="M15 12.4 L15 19.6 M21 11.6 L21 20.4" opacity=".7"/>
       <path d="M27 10.8 L27 21.2" opacity=".5"/>`,
      c
    ),

  // A ring with a pillar coming up through it.
  snare: (c) =>
    wrap(
      `<ellipse cx="16" cy="22" rx="12" ry="5"/>
       <path d="M16 22 L16 5"/>
       <path d="M12 22 C 12 14, 20 14, 20 22" opacity=".7"/>
       <path d="M5 21 L2 24 M27 21 L30 24" opacity=".55"/>`,
      c
    ),

  // A crown of blades around a spire.
  glacier: (c) =>
    wrap(
      `<ellipse cx="16" cy="25" rx="12" ry="4" opacity=".4"/>
       <path d="M6 25 L8 17 L10 25"/>
       <path d="M11 26 L13.5 14 L16 26" opacity=".85"/>
       <path d="M16 26 L20 3 L24 26"/>
       <path d="M24 25 L26 16 L28 25" opacity=".7"/>`,
      c
    ),
};

export const slotColors = {
  frost: 'var(--frost)',
  storm: 'var(--storm)',
  cinder: 'var(--cinder)',
  nova: 'var(--nova)',
  snare: 'var(--snare)',
  glacier: 'var(--glacier)',
};
