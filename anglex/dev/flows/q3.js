const S = '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad'; const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
log('MSAA', await page.evaluate(() => ({ samples: app.viewer.composer.renderTarget1?.samples, webgl2: app.viewer.renderer.capabilities.isWebGL2 })));
log('WELD VC', await page.evaluate(() => { let n = 0, vc = 0; app.viewer.modelRoot.traverse(o => { if (o.isMesh && o.userData.part?.kind === 'weld' || (o.isMesh && o.parent?.userData.part?.kind === 'weld')) { n++; if (o.geometry.attributes.color) vc++; } }); return { n, vc }; }));
await page.evaluate(() => { const s = document.querySelector('#selStyle'); s.value = 'realistic'; s.dispatchEvent(new Event('change', { bubbles: true })); const i = app.model.instances.find(x => x.mark === 'MF-1'); app.select(i.id); app.viewer.fit(app.groups.get(i.id), 1.05); const c = app.viewer.controls.target; app.viewer.camera.position.set(c.x + 420, c.y + 300, c.z + 520); app.viewer.controls.update(); app.viewer.invalidate(4); }); await page.waitForTimeout(6000);
await page.screenshot({ path: S + '/s25_realistic2.png' });
await page.evaluate(() => { const e = document.querySelector('#selEnv'); e.value = 'warehouse'; e.dispatchEvent(new Event('change', { bubbles: true })); }); await page.waitForTimeout(8000);
log('ENV', await page.evaluate(() => ({ env: app.viewer.envName, hdri: !!app.viewer.hdri, bg: app.viewer.scene.background?.isTexture ? 'hdri' : app.viewer.scene.background?.getHexString?.() })));
log('GL ERR', await page.evaluate(() => app.viewer.renderer.getContext().getError()));
await page.screenshot({ path: S + '/s26_warehouse.png' });
