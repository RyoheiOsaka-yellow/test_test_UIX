/* ================================================================
   ▼ 拡張モジュール14: 🎫 公式席図モード（v15）
   公式座席図（ブロック1〜16・1F/2F）を2D席図のモードとして再現。
   ブロック矩形は写真から正規化座標で転記。ツインの区画（WF/EF/…）との
   対応は「仮対応」— クリックで対応席を3Dハイライトし、席数・販売率を表示。
   公式図は「左＝北・右＝南」と仮定（写真から方位は読めないため要確認）。
================================================================ */
(function(){
'use strict';
/* 正規化座標 [x0,y0,x1,y1]（公式図: コートは横長） */
const COL={blue:'#2f5fb3', cyan:'#3fb8c8', green:'#6cb33f', orange:'#f0862a', yellow:'#f2c22e', pink:'#e97fb0', red:'#e04a4a', grey:'#9a9aa6', purple:'#b58ad0'};
const BLOCKS=[
 {id:'13',  r:[0.13,0.02,0.86,0.06], c:'blue',  f:'2F'}, {id:'13', r:[0.13,0.94,0.86,0.98], c:'blue', f:'2F'},
 {id:'11D', r:[0.13,0.09,0.35,0.18], c:'blue',  f:'2F'}, {id:'10', r:[0.40,0.09,0.60,0.18], c:'blue', f:'2F'}, {id:'11A', r:[0.65,0.09,0.86,0.18], c:'blue', f:'2F'},
 {id:'11C', r:[0.13,0.82,0.35,0.91], c:'blue',  f:'2F'}, {id:'10', r:[0.40,0.82,0.60,0.91], c:'blue', f:'2F'}, {id:'11B', r:[0.65,0.82,0.86,0.91], c:'blue', f:'2F'},
 {id:'16D', r:[0.03,0.09,0.10,0.14], c:'green', f:'2F'}, {id:'16C', r:[0.03,0.86,0.10,0.91], c:'green', f:'2F'},
 {id:'12D', r:[0.03,0.20,0.10,0.44], c:'cyan',  f:'2F'}, {id:'12C', r:[0.03,0.56,0.10,0.80], c:'cyan', f:'2F'},
 {id:'12A', r:[0.90,0.20,0.97,0.44], c:'cyan',  f:'2F'}, {id:'12B', r:[0.90,0.56,0.97,0.80], c:'cyan', f:'2F'},
 {id:'8D',  r:[0.16,0.21,0.32,0.27], c:'orange',f:'1F'}, {id:'7', r:[0.35,0.21,0.44,0.27], c:'yellow', f:'1F'}, {id:'6', r:[0.46,0.21,0.53,0.27], c:'pink', f:'1F'}, {id:'7', r:[0.55,0.21,0.64,0.27], c:'yellow', f:'1F'}, {id:'8A', r:[0.67,0.21,0.83,0.27], c:'orange', f:'1F'},
 {id:'8C',  r:[0.16,0.73,0.32,0.79], c:'orange',f:'1F'}, {id:'7', r:[0.35,0.73,0.44,0.79], c:'yellow', f:'1F'}, {id:'6', r:[0.46,0.73,0.53,0.79], c:'pink', f:'1F'}, {id:'7', r:[0.55,0.73,0.64,0.79], c:'yellow', f:'1F'}, {id:'8B', r:[0.67,0.73,0.83,0.79], c:'orange', f:'1F'},
 {id:'3',   r:[0.22,0.29,0.36,0.32], c:'grey',  f:'1F', sub:'AWAYベンチ'}, {id:'1', r:[0.40,0.29,0.60,0.32], c:'grey', f:'1F', sub:'記録 / TO'}, {id:'3', r:[0.64,0.29,0.78,0.32], c:'grey', f:'1F', sub:'BREXベンチ'},
 {id:'9D',  r:[0.13,0.34,0.19,0.49], c:'green', f:'1F'}, {id:'9C', r:[0.13,0.51,0.19,0.66], c:'green', f:'1F'},
 {id:'9A',  r:[0.81,0.34,0.87,0.49], c:'green', f:'1F'}, {id:'9B', r:[0.81,0.51,0.87,0.66], c:'green', f:'1F'},
 {id:'2',   r:[0.21,0.34,0.24,0.47], c:'red',   f:'1F'}, {id:'2', r:[0.76,0.34,0.79,0.47], c:'red', f:'1F'},
 {id:'5',   r:[0.21,0.52,0.24,0.66], c:'purple',f:'1F', sub:'メディア'}, {id:'14', r:[0.76,0.52,0.79,0.62], c:'purple', f:'1F'}, {id:'15', r:[0.83,0.85,0.87,0.89], c:'purple', f:'2F'},
 {id:'4',   r:[0.24,0.68,0.76,0.71], c:'red',   f:'1F'},
];
/* ツイン区画との仮対応（公式の左右 = ツインの北(z<0)/南(z>0)、上下 = 西(x<0)/東(x>0) と仮定） */
const MAP={
 '2':  s=> (s.sec==='NF'||s.sec==='SF'),
 '4':  s=> s.sec==='WF',
 '3':  s=> s.sec==='EF' && s.cat==='BS',
 '1':  s=> s.sec==='EF' && s.cat==='FB',
 '5':  s=> s.sec==='SF' && s.x<-3,
 '14': s=> s.sec==='NF' && s.x>3,
 '6':  s=> (s.sec==='WR'||s.sec==='ER') && Math.abs(s.z)<3.5,
 '7':  s=> (s.sec==='WR'||s.sec==='ER') && Math.abs(s.z)>=3.5 && Math.abs(s.z)<12,
 '8A': s=> s.sec==='ER' && s.z<=-12, '8B': s=> s.sec==='ER' && s.z>=12, '8C': s=> s.sec==='WR' && s.z>=12, '8D': s=> s.sec==='WR' && s.z<=-12,
 '9A': s=> s.sec==='NF' && s.x>0, '9D': s=> s.sec==='NF' && s.x<=0, '9B': s=> s.sec==='SF' && s.x>0, '9C': s=> s.sec==='SF' && s.x<=0,
 '10': s=> (s.sec==='W2'||s.sec==='E2') && s.row<4 && Math.abs(s.z)<10,
 '11A': s=> s.sec==='E2' && s.row<4 && s.z<=-10, '11B': s=> s.sec==='E2' && s.row<4 && s.z>=10, '11C': s=> s.sec==='W2' && s.row<4 && s.z>=10, '11D': s=> s.sec==='W2' && s.row<4 && s.z<=-10,
 '13': s=> (s.sec==='W2'||s.sec==='E2') && s.row>=4,
 '12A': s=> s.sec==='N2' && s.x>0, '12D': s=> s.sec==='N2' && s.x<=0, '12B': s=> s.sec==='S2' && s.x>0, '12C': s=> s.sec==='S2' && s.x<=0,
 '16C': s=> s.sec==='W3' && s.z>0, '16D': s=> s.sec==='W3' && s.z<=0, '15': s=> s.sec==='E3',
};
const ORDER=Object.keys(MAP);
function blockOf(i){ const s=SEAT.list[i]; for(const k of ORDER){ if(MAP[k](s)) return k; } return null; }
const N=SEAT.list.length;
let sel=null, hover=null;
const MG=14;   /* canvas余白 */
function rect(b, W, H){ const r=b.r; return [MG+r[0]*(W-2*MG), MG+r[1]*(H-2*MG), (r[2]-r[0])*(W-2*MG), (r[3]-r[1])*(H-2*MG)]; }

window.__m2official=function(c, W, H){
  /* コート */
  const cx=MG+0.27*(W-2*MG), cy=MG+0.34*(H-2*MG), cw=0.46*(W-2*MG), chh=0.32*(H-2*MG);
  c.fillStyle='#e8d9a8'; c.fillRect(cx,cy,cw,chh);
  c.fillStyle='#f2c22e'; c.fillRect(cx,cy+chh*0.28,cw*0.19,chh*0.44); c.fillRect(cx+cw*0.81,cy+chh*0.28,cw*0.19,chh*0.44);
  c.strokeStyle='#5a4a20'; c.lineWidth=1; c.strokeRect(cx,cy,cw,chh); c.beginPath(); c.arc(cx+cw/2,cy+chh/2,chh*0.16,0,6.2832); c.stroke();
  c.fillStyle='#5a4a20'; c.font='700 9px Oswald, sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('UTSUNOMIYA BREX', cx+cw/2, cy+chh/2);
  /* ブロック */
  c.font='700 10px Oswald, "Noto Sans JP", sans-serif';
  BLOCKS.forEach(b=>{
    const [x,y,w,h]=rect(b,W,H);
    const on = sel===b.id, hv = hover===b.id;
    c.fillStyle=COL[b.c]; c.globalAlpha = (sel && !on) ? 0.35 : 1; c.fillRect(x,y,w,h); c.globalAlpha=1;
    c.strokeStyle = on ? '#ffffff' : (hv ? '#f5c400' : 'rgba(255,255,255,0.35)'); c.lineWidth = on||hv ? 2 : 1; c.strokeRect(x+0.5,y+0.5,w-1,h-1);
    c.fillStyle = (b.c==='yellow'||b.c==='grey') ? '#10131c' : '#ffffff';
    const label = b.sub ? b.id+' '+b.sub : b.id;
    if(w>18 && h>9) c.fillText(label, x+w/2, y+h/2);
  });
  c.fillStyle='#8b93a8'; c.font='700 11px Oswald, sans-serif'; c.textAlign='right'; c.fillText('2F', W-MG, MG+8); c.fillText('1F', W-MG, MG+0.31*(H-2*MG));
};
function hit(mx,my, W, H){ for(const b of BLOCKS){ const [x,y,w,h]=rect(b,W,H); if(mx>=x&&mx<=x+w&&my>=y&&my<=y+h) return b; } return null; }
const CVW=368, CVH=400;
window.__m2officialHover=function(mx,my,e){
  const b=hit(mx,my,CVW,CVH); const id=b?b.id:null;
  if(id!==hover){ hover=id; if(window.__m2redraw) window.__m2redraw(); }
  if(b){ tip.style.display='block'; tip.style.left=(e.clientX+14)+'px'; tip.style.top=(e.clientY-36)+'px';
    const st=stats(b.id); tip.innerHTML='<span class="t-nm">公式ブロック '+b.id+(b.sub?' '+b.sub:'')+'</span><br>'+b.f+'　対応席 '+st.n+'席（仮対応）'+(st.n?'　販売率 '+Math.round(st.occ*100)+'%':''); }
  else tip.style.display='none';
};
function stats(id){ const f=MAP[id]; let n=0, o=0; if(f) SEAT.list.forEach(s=>{ if(f(s)){ n++; o+=s.occ; } }); return {n, occ:n?o/n:0}; }
window.__m2officialClick=function(mx,my){
  const b=hit(mx,my,CVW,CVH);
  sel = (b && sel!==b.id) ? b.id : null;
  repaintSeats();
  if(sel && window.__m2setDetail){
    const st=stats(sel), secs={};
    SEAT.list.forEach(s=>{ if(MAP[sel] && MAP[sel](s)) secs[s.sec]=(secs[s.sec]||0)+1; });
    window.__m2setDetail('<b style="color:var(--brex)">公式ブロック '+sel+'</b>（'+(BLOCKS.find(x=>x.id===sel)||{}).f+'）　対応席 '+st.n+'席　販売率 '+Math.round(st.occ*100)+'%'
      +'<br>ツイン区画（仮対応）: '+Object.entries(secs).map(([k,v])=>k+' '+v).join('・')
      +'<div class="hint" style="margin-top:6px">3D座席を白くハイライト中。公式図の左右＝北南は仮定（写真から方位が読めないため要確認）。</div>');
  } else if(window.__m2setDetail) window.__m2setDetail('<span style="color:var(--sub)">公式ブロックをクリックすると対応する3D座席をハイライトします（仮対応）。</span>');
};
window.__m2officialLegend=function(){
  const li=(c,t)=>'<div class="li"><div class="sw" style="background:'+c+'"></div>'+t+'</div>';
  return li(COL.blue,'2F 10/11/13')+li(COL.cyan,'2F 12A-D')+li(COL.green,'9 / 16')+li(COL.orange,'8A-D')+li(COL.yellow,'7')+li(COL.pink,'6')+li(COL.red,'2 / 4 コートサイド')+li(COL.grey,'1 記録 / 3 ベンチ')+li(COL.purple,'5 / 14 / 15')
   +'<span style="margin-left:auto">公式座席図（写真転記）</span>';
};
/* 3Dハイライト（他モジュールの色付けの後に上書き） */
const baseRepaint14=repaintSeats;
repaintSeats=function(){
  baseRepaint14();
  if(sel && level==='arena' && SEAT.mesh){
    const f=MAP[sel], C=new THREE.Color(), on=new THREE.Color(0xffffff), off=new THREE.Color(0x1d2130);
    SEAT.list.forEach((s,i)=>{ SEAT.mesh.setColorAt(i, f(s)?on:off); });
    SEAT.mesh.instanceColor.needsUpdate=true;
  }
};
/* チケットカードに公式ブロックを付記 */
let oDown=null;
el.addEventListener('pointerdown', e=>{ oDown=[e.clientX,e.clientY]; });
el.addEventListener('pointerup', e=>{
  if(!oDown) return; const mv=Math.hypot(e.clientX-oDown[0], e.clientY-oDown[1]); oDown=null;
  if(mv>5 || level!=='arena' || pcMode || !SEAT.mesh || window.__svActive) return;
  const hits=pick(e, [SEAT.mesh], false); if(!hits.length || hits[0].instanceId==null) return;
  const tkc=document.getElementById('ticket-card');
  if(tkc && tkc.style.display==='block' && !document.getElementById('tk-official')){
    const b=blockOf(hits[0].instanceId);
    tkc.insertAdjacentHTML('beforeend','<div id="tk-official" style="font-size:10px;color:var(--sub);margin-top:6px">公式ブロック（仮対応）: <b style="color:var(--txt)">'+(b||'対応なし')+'</b></div>');
  }
});
window.__officialBlockOf=blockOf;
window.__officialClear=()=>{ sel=null; repaintSeats(); };
})();
