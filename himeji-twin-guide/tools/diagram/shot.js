const { chromium } = require('playwright');
(async()=>{ const b=await chromium.launch({channel:'chromium'}); const p=await b.newPage({viewport:{width:1600,height:600},deviceScaleFactor:1.5});
 await p.route('https://fonts.googleapis.com/**', r=>r.abort()); await p.route('https://fonts.gstatic.com/**', r=>r.abort());
 await p.goto('file://'+__dirname+'/navmap.html'); await p.waitForTimeout(800); await p.screenshot({path:__dirname+'/navmap.png',fullPage:true}); await b.close(); })();
