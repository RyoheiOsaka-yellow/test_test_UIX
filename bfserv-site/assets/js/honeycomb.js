/* BFSERV — honeycomb layout
   <div class="honeycomb" style="--hex-w:150px;--hex-gap:8px"> children are laid out as pointy-top hexagons,
   odd rows shifted by half a tile. Hidden children (display:none) are skipped. */
(() => {
  const combs = document.querySelectorAll('.honeycomb');
  if (!combs.length) return;
  function layout(c) {
    const cs = getComputedStyle(c);
    const W = parseFloat(cs.getPropertyValue('--hex-w')) || 150;
    const gap = parseFloat(cs.getPropertyValue('--hex-gap')) || 8;
    const H = W * 1.1547;
    const cw = c.clientWidth;
    const items = [...c.children].filter(el => getComputedStyle(el).display !== 'none');
    const cols = Math.max(1, Math.floor((cw + gap) / (W + gap)));
    const rowW = cols * (W + gap) - gap;
    const left = Math.max(0, (cw - rowW) / 2);
    let i = 0, r = 0, maxY = 0;
    while (i < items.length) {
      const odd = r % 2 === 1;
      const n = odd ? Math.max(1, cols - 1) : cols;
      const off = odd ? (W + gap) / 2 : 0;
      for (let k = 0; k < n && i < items.length; k++, i++) {
        const el = items[i];
        const x = left + off + k * (W + gap), y = r * (H * 0.75 + gap * 0.87);
        el.style.transform = `translate(${x}px, ${y}px)`;
        el.style.setProperty('--i', i);
        maxY = Math.max(maxY, y + H);
      }
      r++;
    }
    c.style.height = maxY + 'px';
    c.classList.add('is-laid');
  }
  const ro = new ResizeObserver(entries => entries.forEach(e => layout(e.target)));
  combs.forEach(c => { layout(c); ro.observe(c); });
  window.BF_HONEYCOMB = () => combs.forEach(layout);
})();
