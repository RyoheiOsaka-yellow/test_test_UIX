const { chromium } = require('playwright');
const { execFile } = require('child_process');
const fs = require('fs'), path = require('path');
const TILE_DIR = path.join(__dirname, 'tiles');
function curl(url, out){ return new Promise((res)=>execFile('curl',['-sS','--fail','--retry','2','-o',out,url],{timeout:60000},(e)=>res(!e))); }
async function launch(opts={}){
  const browser = await chromium.launch({channel:'chromium', args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const context = await browser.newContext({viewport:{width:opts.w||1600,height:opts.h||1000}, deviceScaleFactor:opts.dpr||1, acceptDownloads:true});
  context.setDefaultTimeout(300000);
  await context.addInitScript(()=>{ const raf=window.requestAnimationFrame.bind(window); let paused=false; const q=[];
    window.__rafPause=(p)=>{ paused=p; if(!p){ const cbs=q.splice(0); cbs.forEach(cb=>raf(cb)); } };
    window.requestAnimationFrame=(cb)=>{ if(paused){ q.push(cb); return 0; } return raf(cb); };
    window.__render=(n)=>new Promise(res=>{ window.__rafPause(false); let k=0; const tick=()=>{ if(++k>=n){ window.__rafPause(true); res(); } else raf(tick); }; raf(tick); });
  });
  const page = await context.newPage();
  page.__logs=[];
  page.on('console', m=>{ if(m.type()==='error'&&!/ERR_CONNECTION_REFUSED|localhost:8000/.test(m.text())) page.__logs.push(m.text()); });
  page.on('pageerror', e=>page.__logs.push('PAGEERR '+e.message));
  await page.route('https://cyberjapandata.gsi.go.jp/**', async route=>{
    const url = route.request().url();
    const f = path.join(TILE_DIR, url.replace(/^https:\/\/cyberjapandata\.gsi\.go\.jp\/xyz\/seamlessphoto\//,'').replace(/\//g,'_'));
    if(!fs.existsSync(f) || fs.statSync(f).size===0){ const ok = await curl(url, f); if(!ok){ return route.fulfill({status:404, body:''}); } }
    await route.fulfill({status:200, path:f, headers:{'Content-Type':'image/jpeg','Access-Control-Allow-Origin':'*'}});
  });
  // Block local DB API quickly (not available)
  await page.route('http://localhost:8000/**', r=>r.abort());
  await page.goto('file://'+path.join(__dirname,'index_cap.html'), {waitUntil:'load', timeout:120000});
  await page.waitForTimeout(opts.settle||9000);
  await page.evaluate(()=>window.__rafPause(true));
  return {browser, context, page};
}
module.exports = { launch };
