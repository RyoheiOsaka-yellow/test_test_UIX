const IMG = '/home/user/test_test_UIX/anglex/docs/spec/img'; const shot = n => page.screenshot({ path: `${IMG}/${n}.png` });
await page.waitForTimeout(800); await shot('v01_signin');
await page.evaluate(() => { document.querySelector('#sm-inPass').value = 'demo'; document.querySelector('#smSignIn').click(); }); await page.waitForTimeout(800); await shot('v02_modeselect');
await page.evaluate(() => app.shell.showView('projects')); await page.waitForTimeout(800); await shot('v03_projects');
await page.evaluate(() => app.shell.showView('chat')); await page.waitForTimeout(600);
await page.evaluate(() => { const i = document.querySelector('#sm-chatInput') || document.querySelector('.sm-chat input, .sm-chat textarea'); if (i) { i.value = '門型架台 125A 2台 溶融亜鉛めっき'; i.dispatchEvent(new Event('input', { bubbles: true })); } const b = document.querySelector('#sm-chatSend') || document.querySelector('.sm-chat .sm-btn.accent, .sm-chat button[type=submit]'); if (b) b.click(); }); await page.waitForTimeout(1500); await shot('v04_chat');
await page.evaluate(() => { app.shell.showView('app'); app.shell.enterApp(4); }); await page.waitForTimeout(2500); await shot('v05_3d');
await page.evaluate(() => app.shell.goStep(5)); await page.waitForTimeout(1200); await shot('v06_quote');
console.log('V2SHOTS DONE');
