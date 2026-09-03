/* ================================================================
   ▼ 拡張モジュール10: 🎨 内観素材（v14）
   ブロック別の座席実色パレット（編集可・ブラウザ保存）、段床/コンコース/床の
   プロシージャルテクスチャ、コートサイドLEDのスイープ演出とリボンのクロール。
   実色は写真で要確認の仮配色。
================================================================ */
(function(){
'use strict';
const LS='brex_mat_params_v14';
const M=Object.assign({real:true, tex:true, led:true,
  pal:{floor:'#1c1f2a', roll:'#2b3140', w2lo:'#2456a8', w2hi:'#c9323a', ns2:'#d8a800', f3:'#3c7a4a'}},
  (function(){ try{ return JSON.parse(localStorage.getItem(LS)||'{}'); }catch(e){ return {}; } })());
function save(){ try{ localStorage.setItem(LS, JSON.stringify(M)); }catch(e){} }
const PAL_LABEL={floor:'フロア仮設席', roll:'1F可動スタンド', w2lo:'2F東西 前列(1-4列)', w2hi:'2F東西 後列(5-8列)', ns2:'2F北南', f3:'3F自由席'};

/* --- 座席実色 --- */
function seatReal(s){
  if(s.sec==='WR'||s.sec==='ER') return M.pal.roll;
  if(s.sec==='W2'||s.sec==='E2') return s.row<4 ? M.pal.w2lo : M.pal.w2hi;
  if(s.sec==='N2'||s.sec==='S2') return M.pal.ns2;
  if(s.sec==='W3'||s.sec==='E3') return M.pal.f3;
  return M.pal.floor;
}
const baseRepaint10=repaintSeats;
repaintSeats=function(){
  baseRepaint10();
  if(M.real && seatMode==='crowd' && SEAT.mesh && !(window.__visActive && window.__visActive())){
    const C=new THREE.Color();
    SEAT.list.forEach((s,i)=>{ C.set(seatReal(s)); SEAT.mesh.setColorAt(i,C); });
    SEAT.mesh.instanceColor.needsUpdate=true;
  }
};

/* --- テクスチャ --- */
function noiseTex(base, amp, w, h, edge){
  const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
  const c=cv.getContext('2d'); c.fillStyle=base; c.fillRect(0,0,w,h);
  const img=c.getImageData(0,0,w,h), d=img.data;
  let s=12345;
  for(let i=0;i<d.length;i+=4){ s=(s*1103515245+12345)&0x7fffffff; const n=((s>>8)%1000)/1000-0.5; d[i]+=n*amp; d[i+1]+=n*amp; d[i+2]+=n*amp; }
  c.putImageData(img,0,0);
  if(edge){ c.fillStyle='rgba(255,255,255,0.10)'; c.fillRect(0,0,w,Math.max(2,h*0.03)); c.fillStyle='rgba(0,0,0,0.35)'; c.fillRect(0,h*0.03,w,Math.max(1,h*0.01)); }
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}
const stepTex=noiseTex('#232838', 26, 256, 256, true);
const concTex=noiseTex('#2a2f3c', 22, 512, 512, false); concTex.repeat.set(0.12,0.12);
const floorTex=(function(){
  const cv=document.createElement('canvas'); cv.width=512; cv.height=512;
  const c=cv.getContext('2d'); c.fillStyle='#171a24'; c.fillRect(0,0,512,512);
  c.strokeStyle='rgba(255,255,255,0.06)'; c.lineWidth=2;
  for(let i=0;i<=512;i+=64){ c.beginPath(); c.moveTo(i,0); c.lineTo(i,512); c.stroke(); c.beginPath(); c.moveTo(0,i); c.lineTo(512,i); c.stroke(); }
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(10,12); return t;
})();
const stepMat=new THREE.MeshStandardMaterial({map:stepTex, roughness:0.92});
const concMat=new THREE.MeshStandardMaterial({map:concTex, roughness:0.9});
const floorMat=new THREE.MeshStandardMaterial({map:floorTex, roughness:0.88});
const swapped=[];   /* {mesh, orig, tex} */
interior.traverse(o=>{
  if(!o.isMesh || o.isInstancedMesh || !o.material || !o.material.color || o.material.map) return;
  const hex=o.material.color.getHex(), gt=o.geometry.type;
  if(hex===0x1a1e2a && gt==='BoxGeometry') swapped.push({mesh:o, orig:o.material, tex:stepMat});
  else if(hex===0x1a1e2a && gt==='ShapeGeometry') swapped.push({mesh:o, orig:o.material, tex:concMat});
  else if(hex===0x20242f && gt==='ShapeGeometry') swapped.push({mesh:o, orig:o.material, tex:concMat});
  else if(hex===0x14161f && gt==='PlaneGeometry') swapped.push({mesh:o, orig:o.material, tex:floorMat});
});
function applyTex(){ swapped.forEach(s=>{ s.mesh.material = M.tex ? s.tex : s.orig; }); }

/* --- LED動画テクスチャ --- */
const leds=[], ribbons=[];
interior.traverse(o=>{
  if(!o.isMesh || !o.userData.name) return;
  if(o.userData.name.indexOf('LED看板: リボン')===0) ribbons.push(o);
  else if(o.userData.name.indexOf('LED看板: ')===0) leds.push({m:o, name:o.userData.name.slice(6)});
});
const ribbonTex = ribbons.length ? ribbons[0].material.map : null;
const RIB=['BREX PARTNERS','SPONSOR E','TOYOTA WOODYOU HOME','SPONSOR F','SPONSOR G','BREX NATION','GYOZA KIRASSE','TOCHIGI BANK'];
let ledT=0, lastLed=0;
function animateLED(now){
  if(!M.led || level!=='arena' || now-lastLed<110) return;
  lastLed=now; ledT+=0.11;
  leds.forEach((l,k)=>{
    const cv=l.m.material.map.image, c=cv.getContext('2d'), w=cv.width, h=cv.height;
    c.fillStyle='#101018'; c.fillRect(0,0,w,h);
    const g=c.createLinearGradient(0,0,w,0), p=(ledT*0.35+k*0.25)%1;
    g.addColorStop(Math.max(0,p-0.18),'rgba(245,196,0,0)'); g.addColorStop(p,'rgba(245,196,0,0.55)'); g.addColorStop(Math.min(1,p+0.18),'rgba(245,196,0,0)');
    c.fillStyle=g; c.fillRect(0,0,w,h);
    c.fillStyle= (Math.floor(ledT*1.2+k)%6===0) ? '#ffffff' : '#f5c400';
    c.font='700 30px Oswald, "Noto Sans JP", sans-serif'; c.textAlign='center'; c.fillText(l.name, w/2, 34);
    l.m.material.map.needsUpdate=true;
  });
  if(ribbonTex){
    const cv=ribbonTex.image, c=cv.getContext('2d'), w=cv.width;
    c.fillStyle='#0a0c14'; c.fillRect(0,0,w,32);
    c.font='700 19px Oswald, "Noto Sans JP", sans-serif'; c.textAlign='center';
    const off=(ledT*60)%(w);
    RIB.forEach((n,i)=>{ c.fillStyle=i%2?'#f5c400':'#7fd8ff'; const x=((i*172-off)%w+w)%w; c.fillText(n, x, 22); if(x<90) c.fillText(n, x+w, 22); });
    ribbonTex.needsUpdate=true;
  }
}
const baseLoop10=loop;
loop=function(now){ baseLoop10(now); animateLED(now); };

/* --- パネル --- */
function panelHTML(){
  const ch=(k,l)=>'<button class="chip '+(M[k]?'active':'')+'" data-mk="'+k+'">'+l+'</button>';
  const pal=Object.keys(M.pal).map(k=>'<label class="pal"><input type="color" data-pk="'+k+'" value="'+M.pal[k]+'"><span>'+PAL_LABEL[k]+'</span></label>').join('');
  return '<div class="sec" id="mat-sec"><div class="sec-t"><b>🎨 内観素材</b> — 座席実色・テクスチャ・LED演出</div>'
   +'<div class="row-btns">'+ch('real','座席実色（観客ビュー時）')+ch('tex','段床/床テクスチャ')+ch('led','LED動画演出')+'</div>'
   +'<div class="pal-grid" style="margin-top:7px">'+pal+'</div>'
   +'<div class="row-btns" style="margin-top:6px"><button class="chip" id="mat-reset">配色を初期値へ</button></div>'
   +'<div class="hint" style="margin-top:6px">座席色は<b>仮配色</b>（写真で確認して色見本から調整・ブラウザに保存）。実色は「リアル観客ビュー」時のみ適用され、分析レイヤーの色分けは維持されます。</div></div>';
}
function bind(){
  const sec=document.getElementById('mat-sec'); if(!sec) return;
  sec.querySelectorAll('[data-mk]').forEach(b=> b.onclick=()=>{ M[b.dataset.mk]=!M[b.dataset.mk]; save(); applyTex(); repaintSeats(); renderPanel(); });
  sec.querySelectorAll('[data-pk]').forEach(i=> i.oninput=()=>{ M.pal[i.dataset.pk]=i.value; save(); repaintSeats(); });
  document.getElementById('mat-reset').onclick=()=>{
    M.pal={floor:'#1c1f2a', roll:'#2b3140', w2lo:'#2456a8', w2hi:'#c9323a', ns2:'#d8a800', f3:'#3c7a4a'}; save(); repaintSeats(); renderPanel();
  };
}
const baseRenderPanel10=renderPanel;
renderPanel=function(){
  baseRenderPanel10();
  if(level==='arena') pb.insertAdjacentHTML('beforeend', panelHTML()), bind();
};
applyTex();
window.__matParams=M;
})();
