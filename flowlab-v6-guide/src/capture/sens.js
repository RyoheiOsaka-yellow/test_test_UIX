const { openApp, SP } = require('./common.js');
(async () => {
  const { browser, page } = await openApp({ width: 1200, height: 800, dsf: 1 });
  const out = await page.evaluate(() => {
    const core = window.__factorySim.core, d = structuredClone(core.defaults);
    const ev = patch => { const c = Object.assign(structuredClone(d), patch); core.validate(c); const r = core.evaluate(c); return { before: +r.beforeMinutes.toFixed(1), after: +r.afterMinutes.toFixed(1), gain: +r.gain.toFixed(1), fte: +r.fte.toFixed(3), km: [+(r.beforeDistance/1000).toFixed(2), +(r.afterDistance/1000).toFixed(2)], rows: r.rows.map(x => [x.group, +x.gain.toFixed(1)]) }; };
    const res = { defaults: d };
    res.base = ev({});
    res.off = ev({ moveV: false, moveT: false });
    res.onlyV = ev({ moveT: false });
    res.onlyT = ev({ moveV: false });
    res.r100 = ev({ researchReduction: 1 });
    res.r50 = ev({ researchReduction: 0.5 });
    // break-even reduction
    let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; const g = core.evaluate(Object.assign(structuredClone(d), { researchReduction: m })).gain; if (g < 0) lo = m; else hi = m; } res.breakEven = +hi.toFixed(3);
    // best placement grid search for tint & varnish within bounds
    let best = null; for (let tx = 169.3; tx <= 214.5; tx += 2.26) for (let ty = 11.6; ty <= 75.4; ty += 3.19) { const g = core.evaluate(Object.assign(structuredClone(d), { tx, ty })).gain; if (!best || g > best.g) best = { tx: +tx.toFixed(1), ty: +ty.toFixed(1), g: +g.toFixed(1) }; }
    res.bestT = best;
    let bestV = null; for (let vx = 169.3; vx <= 214.5; vx += 2.26) for (let vy = 11.6; vy <= 75.4; vy += 3.19) { const g = core.evaluate(Object.assign(structuredClone(d), { vx, vy })).gain; if (!bestV || g > bestV.g) bestV = { vx: +vx.toFixed(1), vy: +vy.toFixed(1), g: +g.toFixed(1) }; }
    res.bestV = bestV;
    res.bestBoth = ev({ tx: best.tx, ty: best.ty, vx: bestV.vx, vy: bestV.vy });
    res.bestBothR100 = ev({ tx: best.tx, ty: best.ty, vx: bestV.vx, vy: bestV.vy, researchReduction: 1 });
    res.speedDetour = { detour12: ev({ detour: 1.2 }).gain, detour15: ev({ detour: 1.5 }).gain, speed50: ev({ speed: 50 }).gain, speed70: ev({ speed: 70 }).gain };
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();
