const fs=require('fs'), path=require('path');
const OUT=path.join(__dirname,'out');
const SECTIONS={
  '00_basic':'画面構成と基本操作','01_L0':'L0 広域流入','02_L1':'L1 市内回遊・滞留','03_L2':'L2 姫路城',
  '04_display':'人流の表現モード・地図の表示設定','05_OD':'OD分析','06_tour':'観光導線','07_timeline':'タイムライン（時間帯の推移）',
  '08_board':'分析ボード','09_proposal':'提案骨子','10_db':'DB構成','11_policy':'施策比較ワークスペース','12_area':'3エリア分析','13_compare':'共通人流モデル・左右3D比較'};
function mk(page, group){
  const manifest=[];
  const H={manifest,
    async ev(fn,arg){ return page.evaluate(fn,arg); },
    async x(code){ return page.evaluate(c=>window.__ev(c), code); },
    async wait(ms){ await page.waitForTimeout(ms); },
    async frames(n=2){ await page.evaluate(n=>window.__render(n), n); },
    async settle(ms=2500){ await page.waitForTimeout(ms); await H.frames(2); },
    async click(sel){ const ok=await page.evaluate(s=>{const e=document.querySelector(s); if(!e) return false; e.click(); return true;}, sel); if(!ok) console.warn('[click miss]',sel); return ok; },
    async setTime(hhmm){ const [h,m]=hhmm.split(':').map(Number); const min=h*60+m-360; await page.evaluate(v=>{const s=document.getElementById('tl-slider'); s.value=String(v); s.oninput();}, min); },
    async hideToast(){ await page.evaluate(()=>{const t=document.getElementById('toast'); if(t){t.classList.remove('on'); t.style.opacity='0';}}); },
    async showToast(){ await page.evaluate(()=>{const t=document.getElementById('toast'); if(t){t.style.opacity='';}}); },
    async hl(items){ await page.evaluate(items=>{
      let o=document.getElementById('__hl'); if(!o){o=document.createElement('div');o.id='__hl';o.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2147483647';document.body.appendChild(o);} o.innerHTML='';
      for(const it of items){ let r;
        if(it.rect){ r={left:it.rect[0],top:it.rect[1],width:it.rect[2],height:it.rect[3]}; }
        else if(it.union){ const es=[...document.querySelectorAll(it.sel)].filter(e=>e.offsetParent!==null); if(!es.length) continue; const bs=es.map(e=>e.getBoundingClientRect()); const L=Math.min(...bs.map(b=>b.left)),T=Math.min(...bs.map(b=>b.top)),R=Math.max(...bs.map(b=>b.right)),B=Math.max(...bs.map(b=>b.bottom)); r={left:L,top:T,width:R-L,height:B-T}; }
        else { const e=document.querySelector(it.sel); if(!e){console.warn('hl miss '+it.sel);continue;} const b=e.getBoundingClientRect(); r={left:b.left,top:b.top,width:b.width,height:b.height}; }
        const p=it.pad??4; const box=document.createElement('div');
        box.style.cssText=`position:absolute;left:${r.left-p}px;top:${r.top-p}px;width:${r.width+2*p}px;height:${r.height+2*p}px;border:3px solid #ff3d71;border-radius:${it.round??8}px;box-shadow:0 0 0 2px rgba(0,0,0,.55),0 0 18px rgba(255,61,113,.55);`;
        o.appendChild(box);
        if(it.n!=null){ const b=document.createElement('div'); b.textContent=it.n; const bx=(it.badge==='right')?r.left+r.width+p-12:r.left-p-12, by=r.top-p-12;
          b.style.cssText=`position:absolute;left:${Math.max(2,bx)}px;top:${Math.max(2,by)}px;min-width:26px;height:26px;padding:0 6px;border-radius:13px;background:#ff3d71;color:#fff;font:700 15px/26px 'Noto Sans JP',sans-serif;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.6)`; o.appendChild(b); }
        if(it.note){ const t=document.createElement('div'); t.textContent=it.note; const pos=it.pos||'below';
          t.style.cssText=`position:absolute;max-width:${it.w||260}px;background:#ff3d71;color:#fff;font:700 13px/1.45 'Noto Sans JP',sans-serif;padding:5px 9px;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.6);white-space:pre-wrap`;
          o.appendChild(t); const tw=t.offsetWidth, th=t.offsetHeight; let x,y;
          if(it.at){x=it.at[0];y=it.at[1];} else if(pos==='below'){x=r.left-p;y=r.top+r.height+p+6;} else if(pos==='above'){x=r.left-p;y=r.top-p-th-8;} else if(pos==='right'){x=r.left+r.width+p+8;y=r.top-p;} else {x=r.left-p-tw-8;y=r.top-p;}
          x=Math.max(4,Math.min(innerWidth-tw-4,x)); y=Math.max(4,Math.min(innerHeight-th-4,y)); t.style.left=x+'px'; t.style.top=y+'px'; }
      } }, items); },
    async clearHl(){ await page.evaluate(()=>{const o=document.getElementById('__hl'); if(o) o.innerHTML='';}); },
    async shot(sec, id, slug, title, desc, opt={}, opt2){
      if(typeof opt==='string'){ opt=opt2||{}; }
      const dir=path.join(OUT,sec); fs.mkdirSync(dir,{recursive:true});
      const isCrop=!!(opt.sel||opt.png); const file=`${id}_${slug}.${isCrop?'png':'jpg'}`; const fp=path.join(dir,file);
      if(opt.sel){ await page.locator(opt.sel).first().screenshot({path:fp}); }
      else if(opt.png){ await page.screenshot({path:fp, clip:opt.clip, type:'png'}); }
      else { await page.screenshot({path:fp, clip:opt.clip, type:'jpeg', quality:92}); }
      manifest.push({sec, secName:SECTIONS[sec], id, file:`${sec}/${file}`, title, desc, kind:isCrop?'crop':'full', how:opt.how||''});
      console.log(`[${group}] ${sec}/${file}`);
      if(!opt.keepHl) await H.clearHl();
    },
    async pieces(sec, idBase, slug, title, desc, scrollSel, shotSel, opt={}){
      // scroll a container and capture element screenshots in pieces
      const info=await page.evaluate(s=>{const e=document.querySelector(s); if(!e) return null; e.scrollTop=0; return {sh:e.scrollHeight, ch:e.clientHeight};}, scrollSel);
      if(!info){ console.warn('pieces miss',scrollSel); return; }
      const step=Math.floor(info.ch*0.88); const n=Math.min(opt.max||6, Math.max(1, Math.ceil((info.sh-info.ch)/step)+1));
      for(let i=0;i<n;i++){
        await page.evaluate(([s,y])=>{document.querySelector(s).scrollTop=y;}, [scrollSel, i*step]); await page.waitForTimeout(350);
        const [a,b]=idBase.split('-'); const id=`${a}-${String(+b+i).padStart(2,'0')}`;
        await H.shot(sec, id, `${slug}_${i+1}`, `${title}（${i+1}/${n}）`, i===0?desc:'', {sel:shotSel, how:opt.how});
      }
      await page.evaluate(s=>{document.querySelector(s).scrollTop=0;}, scrollSel);
      return n;
    },
    async project(expr){ return page.evaluate(c=>window.__ev(c), `(()=>{const v=(${expr}); const p=v.clone().project(camera); const r=renderer.domElement.getBoundingClientRect(); return {x:r.left+(p.x+1)/2*r.width, y:r.top+(1-p.y)/2*r.height, vis:p.z<1};})()`); },
    save(){ fs.writeFileSync(path.join(__dirname,`manifest_${group}.json`), JSON.stringify(manifest,null,1)); }
  };
  return H;
}
module.exports={mk,SECTIONS,OUT};
