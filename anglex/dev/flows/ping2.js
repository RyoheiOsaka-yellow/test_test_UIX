await page.evaluate(() => { window.__long = []; new PerformanceObserver(l => { for (const e of l.getEntries()) window.__long.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] }); });
await page.waitForTimeout(4000);
console.log('longtasks in 4s:', await page.evaluate(() => JSON.stringify(window.__long)));
console.log('frame time:', await page.evaluate(() => new Promise(r => { let n = 0, t0 = performance.now(); const f = () => { if (++n < 20) requestAnimationFrame(f); else r(Math.round((performance.now() - t0) / 20)); }; requestAnimationFrame(f); })));
await page.evaluate(() => document.querySelector('.wf-step[data-step="4"]').click()); console.log('js click done; panel on:', await page.$eval('#pane4', e => !e.hidden));
const box = await page.$eval('.wf-step[data-step="3"]', e => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
const t = Date.now(); await page.mouse.click(box[0], box[1]).then(() => console.log('mouse click ok', Date.now() - t)).catch(e => console.log('mouse click fail', e.message.slice(0, 50)));
console.log('elementFromPoint:', await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName + '.' + e.className : null; }, box));
