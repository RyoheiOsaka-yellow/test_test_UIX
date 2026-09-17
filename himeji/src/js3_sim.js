
/* ================================================================
   シミュレーション (エージェントベース · 合成データ)
================================================================ */
SP.castle.open=180; SP.castle.last=600; SP.castle.close=660; /* 09:00 / 16:00 / 17:00 */
const CASTLE_RATE=24; /* 入城処理能力 人/分 (菱の門〜大天守 入場制限を含む) */
const FAR_NODES=new Set(['n_road1','n_road2','n_road3','shosha_l','shosha','hiro1','hiromine','tegara1','tegara','h_road','hotel_e']);
const HIST={ inCity:new Float32Array(T_END+1), inCastle:new Float32Array(T_END+1), arrIn:new Float32Array(T_END+1), arrDom:new Float32Array(T_END+1), depIn:new Float32Array(T_END+1), depDom:new Float32Array(T_END+1), wait:new Float32Array(T_END+1),
  byMode:MODES.map(()=>new Float32Array(T_END+1)), bySpot:SPOTS.map(()=>new Float32Array(T_END+1)), park:GATES.map(()=>new Float32Array(T_END+1)), spend:new Float32Array(T_END+1), hotel:new Float32Array(T_END+1), stayIn:new Float32Array(T_END+1), dayIn:new Float32Array(T_END+1) };
const SPEND={fee:0, food:0, shop:0, stay:0, trans:0};
const RET_CNT=new Float32Array(RET.length); const OD=new Float32Array(SEG.length*RET.length); const SEG_ARR=new Float32Array(SEG.length); const MODE_ARR=new Float32Array(MODES.length);
const TRANS=new Float32Array(SPOTS.length*SPOTS.length); /* 地点間遷移 */
const SEQ={}; /* 周遊パターン */
const AG=[];
const ARR_DAY=[0,0.005,0.03,0.10,0.15,0.15,0.13,0.12,0.11,0.08,0.05,0.03,0.02,0.01,0.005,0.005,0,0];  /* 06..23時 日帰り */
const ARR_STAY=[0,0.005,0.02,0.07,0.11,0.12,0.11,0.11,0.10,0.09,0.08,0.07,0.06,0.03,0.02,0.01,0.005,0]; /* 宿泊 */
function wpick(arr){ let r=Math.random(), s=0; arr.forEach(v=>s+=v); r*=s; for(let i=0;i<arr.length;i++){ if(r<arr[i]) return i; r-=arr[i]; } return arr.length-1; }
function sampleArrival(stay){ const W=stay?ARR_STAY:ARR_DAY; const h=wpick(W); return clamp(h*60+Math.random()*60,0,T_END-60); }
const hex=(n)=>Array.from({length:n},()=>'0123456789ABCDEF'[Math.floor(Math.random()*16)]).join('');
function pickGate(modeIdx){ if(modeIdx===0) return 0; if(modeIdx===1) return 1; if(modeIdx===3) return 6; if(modeIdx===4) return 7; const r=Math.random(); return r<0.4?2:(r<0.75?3:(r<0.9?5:4)); }
function pickRet(a){ const s=a.seg; if(a.stay) return 6;
  if(s.grp==='in'){ const r=Math.random(); return r<0.52?0:(r<0.76?1:(r<0.86?3:(r<0.94?4:2))); }
  switch(s.id){ case 'hyo': return Math.random()<0.85?2:0; case 'osa': return 0; case 'kyo': return Math.random()<0.8?1:0; case 'oky': case 'hir': return 3; case 'kin': return 5; case 'shi': return Math.random()<0.7?2:3;
    case 'tky': case 'ngy': case 'kyu': case 'hok': { const r=Math.random(); return r<0.45?0:(r<0.6?1:(r<0.75?3:4)); } default: { const r=Math.random(); return r<0.4?0:(r<0.6?4:3); } } }
function makePlan(a){
  const g=GATES[a.gate]; const plan=[]; const t=a.tArr; const push=(id,dw)=>{ const s=SP[id]; plan.push({s, dw:Math.max(5, dw!==undefined?dw:(s.dwell[0]+gaussR()*s.dwell[1]))}); };
  const rail=g.kind==='rail', car=g.kind==='park', bus=g.id==='bus';
  const castleOK = t<SP.castle.last-30 && Math.random()<(bus?0.97:0.82);
  const far = (car||bus) && Math.random()<0.10 && castleOK;  /* 書写山へも(車・バス) */
  if(rail && Math.random()<0.30) push('station', 12+Math.random()*15);
  if(rail){ push('otemae'); if(Math.random()<0.25) push('eagle'); }
  if(castleOK){ push('sannomaru'); push('castle'); const r=Math.random(); if(r<0.45) push('kokoen'); if(Math.random()<0.10) push('zoo'); if(Math.random()<0.08) push('hist'); if(Math.random()<0.10) push('art'); if(Math.random()<0.05) push('lit'); }
  else { push('sannomaru', 25); if(Math.random()<0.5) push('kokoen'); if(Math.random()<0.3) push('art'); }
  if(far) push('shosha'); else if(car && Math.random()<0.05) push('hiromine');
  if(!bus){ if(Math.random()<(rail?0.6:0.3)) push('miyuki'); if(rail && Math.random()<0.55) push('station', 25+Math.random()*25); }
  if(a.stay){ /* 夕食 → ホテル */ if(Math.random()<0.7) push(Math.random()<0.6?'miyuki':'station', 50+Math.random()*30); plan.push({hotel:HOTELS[a.hotel], dw:9999}); }
  if(!rail && a.seg.grp==='dom' && Math.random()<0.08) push('tegara');
  a.plan=plan; a.pi=-1;
}
function buildPath(a, toNode){ const from=a.node; a.path=GRAPH.path(from,toNode); a.pk=0; a.segK=0; a.node=toNode; }
function nodeOfSpot(s){ return NODE[SPOT_NODE[s.id]].i; }
function spotPoint(s){ const ang=Math.random()*6.283, rr=Math.sqrt(Math.random())*s.r*0.85; return [s.x+Math.cos(ang)*rr, s.z+Math.sin(ang)*rr]; }
for(let i=0;i<N_AG;i++){
  const si=wpick(SEG.map(s=>s.share)); const seg=SEG[si]; const stay=Math.random()<seg.stay; const mi=wpick(seg.mode); const gate=pickGate(mi);
  const a={i, id:'V-'+hex(6), seg, si, grp:seg.grp, stay, mi, gate, tArr:sampleArrival(stay), st:0, x:0,z:0, spd:1.25+Math.random()*0.4, hotel:stay?wpick(HOTELS.map(h=>h.rooms)):-1, ret:-1, zones:[], spend:{fee:0,food:0,shop:0,stay:0,trans:0}, party:1+Math.floor(Math.random()*3), age:['20代','30代','40代','50代','60代以上'][wpick([0.2,0.28,0.22,0.16,0.14])], jx:Math.random()*6.28};
  a.u=Math.random(); a.ret=pickRet(a); makePlan(a); AG.push(a);
}
AG.sort((a,b)=>a.tArr-b.tArr); AG.forEach((a,i)=>a.i=i);
let activeN=DAYS[curDay].n; const isActive=(a)=>a.u<activeN/N_AG; const castleQ=[]; let inCity=0, inCastle=0, castleWait=0;
function leaveSpot(a){ if(a.cur){ const s=a.cur; s.cnt--; s.dwellSum+=timeState.min-a.tIn; s.dwellN++; a.zones.push([a.tIn, timeState.min, s.name]); a.cur=null; } if(a.curHotel){ a.curHotel.cnt--; a.curHotel=null; } }
function nextLeg(a, t){
  a.pi++; leaveSpot(a);
  if(a.pi>=a.plan.length){ /* 帰路 */ a.st=8; a.tgt=null; const g=GATES[a.gate]; buildPath(a, NODE[GATE_NODE[g.id]].i); a.dest={gate:g}; return; }
  const leg=a.plan[a.pi];
  if(leg.hotel){ a.dest={hotel:leg.hotel}; buildPath(a, NODE[HOTEL_NODE[leg.hotel.i]].i); a.st=1; return; }
  const s=leg.s;
  if(s.id==='castle' && (t>s.last-5)){ /* 最終入城を過ぎた → 城はスキップ */ a.skipCastle=true; nextLeg(a,t); return; }
  a.dest={spot:s, dw:leg.dw}; buildPath(a, nodeOfSpot(s)); a.st=1;
}
function arriveAtSpot(a, t){
  const s=a.dest.spot; if(a.prevSpot){ TRANS[a.prevSpot.i*SPOTS.length+s.i]++; } a.prevSpot=s; a.seqIds=(a.seqIds||[]); a.seqIds.push(s.id);
  if(s.id==='castle'){ if(t<s.open){ a.dest.dw+= (s.open-t); } if(castleWaitNow()>0.5 || castleQ.length>0 || true){ a.st=4; castleQ.push(a); a.qi=castleQ.length-1; return; } }
  enterSpot(a, s, t);
}
function enterSpot(a, s, t){
  a.st=2; a.cur=s; a.tIn=t; s.cnt++; s.cum++; s.bySeg[a.si]++; if(s.cnt>s.peak){ s.peak=s.cnt; s.peakT=t; } const p=spotPoint(s); a.tx=p[0]; a.tz=p[1]; a.dwellEnd=t+a.dest.dw;
  /* 消費 */ let fee=s.fee; if(s.id==='castle') fee=2500; if(s.id==='kokoen') fee=(a.seqIds.includes('castle')?100:310); a.spend.fee+=fee; SPEND.fee+=fee*PER_AGENT; s.sales+=fee*PER_AGENT;
  if(s.kind==='street'||s.kind==='station'){ const inb=a.grp==='in'; const food=(s.id==='otemae'||s.id==='eagle')?0:(inb?3000:2200)*(0.6+Math.random()*0.8); const shop=(inb?1800:1500)*(0.4+Math.random()*1.2); a.spend.food+=food; a.spend.shop+=shop; SPEND.food+=food*PER_AGENT; SPEND.shop+=shop*PER_AGENT; s.sales+=(food+shop)*PER_AGENT; }
  if(s.id==='castle'){ const shop=(a.grp==='in'?1200:900)*Math.random()*1.5; a.spend.shop+=shop; SPEND.shop+=shop*PER_AGENT; s.sales+=shop*PER_AGENT; }
}
function castleWaitNow(){ return castleQ.length*PER_AGENT/CASTLE_RATE; }
function queuePos(idx){ const h=NODE.hishi; const row=Math.floor(idx/16), col=idx%16; const c=(row%2?15-col:col)-7.5; return [h.x+c*1.4, h.z+18+row*1.6]; }
function updateCastleQueue(t, dtMin){ const s=SP.castle; if(t<s.open){ castleWait=castleWaitNow(); return; } let n=(CASTLE_RATE/PER_AGENT)*dtMin + (castleQ.acc||0); castleQ.acc=n-Math.floor(n); n=Math.floor(n);
  while(n-->0 && castleQ.length){ const a=castleQ.shift(); enterSpot(a, s, t); } castleQ.forEach((a,i)=>{ a.qi=i; }); castleWait=castleWaitNow(); if(t>s.close+30){ while(castleQ.length){ const a=castleQ.shift(); a.dest.dw=20; enterSpot(a,s,t); } } }
function arrive(a, t){
  const g=GATES[a.gate]; a.st=1; a.node=NODE[GATE_NODE[g.id]].i; const n=GRAPH.pos[a.node]; a.x=n.x+(Math.random()-0.5)*20; a.z=n.z+(Math.random()-0.5)*20; g.cumIn++; if(g.kind==='park'){ g.occ++; if(g.occ>g.peak) g.peak=g.occ; } if(g.kind==='bus') g.occ++;
  inCity++; SEG_ARR[a.si]++; MODE_ARR[a.mi]++; if(a.grp==='in') HIST.arrIn[Math.floor(t)]++; else HIST.arrDom[Math.floor(t)]++; a.seqIds=[]; a.tArrived=t; a.spend.trans=(a.grp==='in'?1800:(a.mi===0?3200:1400)); SPEND.trans+=a.spend.trans*PER_AGENT;
  if(a.stay){ const h=HOTELS[a.hotel]; h.booked++; }
  nextLeg(a, t);
}
function depart(a, t){ a.st=9; inCity--; const g=GATES[a.gate]; g.cumOut++; if(g.kind==='park'||g.kind==='bus') g.occ--; RET_CNT[a.ret]++; OD[a.si*RET.length+a.ret]++; if(a.grp==='in') HIST.depIn[Math.floor(t)]++; else HIST.depDom[Math.floor(t)]++; const key=(a.seqIds||[]).filter(id=>id!=='otemae').join('→'); if(key) SEQ[key]=(SEQ[key]||0)+1; }
function moveAlong(a, dtMin){
  const path=a.path; if(!path || a.pk>=path.length-1){ return true; }
  const A=GRAPH.pos[path[a.pk]], B=GRAPH.pos[path[a.pk+1]]; const L=Math.hypot(B.x-A.x,B.z-A.z); const fast=FAR_NODES.has(A.id)||FAR_NODES.has(B.id); const v=(fast?9:a.spd)*60*dtMin*(fast?1:densFactor(a.x,a.z));
  a.segK+=v/Math.max(1,L); while(a.segK>=1){ a.pk++; if(a.pk>=path.length-1){ a.x=B.x; a.z=B.z; return true; } a.segK-=1; const A2=GRAPH.pos[path[a.pk]], B2=GRAPH.pos[path[a.pk+1]]; const L2=Math.hypot(B2.x-A2.x,B2.z-A2.z); a.segK*=L/Math.max(1,L2); }
  const A3=GRAPH.pos[path[a.pk]], B3=GRAPH.pos[path[a.pk+1]]; a.x=lerp(A3.x,B3.x,a.segK)+Math.sin(a.jx)*3; a.z=lerp(A3.z,B3.z,a.segK)+Math.cos(a.jx)*3; return false;
}
let nextArr=0;
function stepSim(dtMin){
  const t0=timeState.min, t=Math.min(T_END, t0+dtMin); timeState.min=t;
  while(nextArr<N_AG && AG[nextArr].tArr<=t){ const a=AG[nextArr]; if(isActive(a)) arrive(a, t); else a.st=9; nextArr++; }
  for(let i=0;i<nextArr;i++){ const a=AG[i]; if(a.st===0||a.st===9) continue;
    if(a.st===1||a.st===8){ const done=moveAlong(a, dtMin); if(done){ if(a.st===8){ depart(a,t); } else if(a.dest.hotel){ a.st=3; a.curHotel=a.dest.hotel; a.curHotel.cnt++; a.tIn=t; a.x=a.dest.hotel.x+(Math.random()-0.5)*20; a.z=a.dest.hotel.z+(Math.random()-0.5)*20; a.spend.stay=(a.grp==='in'?12000:10000); SPEND.stay+=a.spend.stay*PER_AGENT; a.zones.push([t,T_END,a.dest.hotel.name]); } else arriveAtSpot(a,t); } }
    else if(a.st===2){ /* 滞留: 目標点へ寄る */ const dx=a.tx-a.x, dz=a.tz-a.z; const d=Math.hypot(dx,dz); if(d>1.5){ const v=Math.min(d, a.spd*60*dtMin*0.6); a.x+=dx/d*v; a.z+=dz/d*v; } else if(Math.random()<0.01*dtMin*10){ const p=spotPoint(a.cur); a.tx=p[0]; a.tz=p[1]; }
      if(t>=a.dwellEnd){ nextLeg(a,t); } }
    else if(a.st===4){ const p=queuePos(a.qi); const dx=p[0]-a.x, dz=p[1]-a.z; const d=Math.hypot(dx,dz); if(d>0.5){ const v=Math.min(d, a.spd*60*dtMin); a.x+=dx/d*v; a.z+=dz/d*v; } }
  }
  updateCastleQueue(t, dtMin);
  if(Math.floor(t)!==Math.floor(t0)) recordMinute(Math.floor(t));
}
function recordMinute(m){ if(m>T_END) return; inCastle=SP.castle.cnt+castleQ.length; HIST.inCity[m]=inCity; HIST.inCastle[m]=inCastle; HIST.wait[m]=castleWait; SPOTS.forEach((s,i)=>HIST.bySpot[i][m]=s.cnt); GATES.forEach((g,i)=>HIST.park[i][m]=g.occ); HIST.spend[m]=SPEND.fee+SPEND.food+SPEND.shop+SPEND.stay+SPEND.trans; let hc=0; HOTELS.forEach(h=>hc+=h.cnt); HIST.hotel[m]=hc;
  let si=0, di=0; for(let i=0;i<nextArr;i++){ const a=AG[i]; if(a.st===0||a.st===9) continue; if(a.stay) si++; else di++; } HIST.stayIn[m]=si; HIST.dayIn[m]=di;
  if(m%5===0) updateSensors(m); accumHeat(); if(hlAgent && hlAgent.st!==0 && hlAgent.st!==9){ hlAgent.hist=hlAgent.hist||[]; hlAgent.hist.push(hlAgent.x,hAt(hlAgent.x,hlAgent.z)+2,hlAgent.z); }
  if(m%3===0) checkAlerts(m);
}
function updateSensors(m){ SENSORS.forEach(s=>{ let n=0; if(s.virt){ n=inCity; } else { const r2=s.r*s.r; for(let i=0;i<nextArr;i++){ const a=AG[i]; if(a.st===0||a.st===9) continue; const dx=a.x-s.x, dz=a.z-s.z; if(dx*dx+dz*dz<r2) n++; } } s.detMin=n*PER_AGENT; s.det+=n*PER_AGENT*5; }); }
function resetSim(){ timeState.min=0; nextArr=0; inCity=0; inCastle=0; castleWait=0; castleQ.length=0; castleQ.acc=0;
  AG.forEach(a=>{ a.st=0; a.pi=-1; a.cur=null; a.curHotel=null; a.zones=[]; a.seqIds=[]; a.prevSpot=null; a.hist=null; a.skipCastle=false; a.spend={fee:0,food:0,shop:0,stay:0,trans:0}; a.x=0; a.z=0; });
  SPOTS.forEach(s=>{ s.cnt=0; s.cum=0; s.dwellSum=0; s.dwellN=0; s.peak=0; s.peakT=0; s.bySeg.fill(0); s.sales=0; }); GATES.forEach(g=>{ g.cumIn=0; g.cumOut=0; g.occ=0; g.peak=0; }); HOTELS.forEach(h=>{ h.cnt=0; h.booked=0; }); SENSORS.forEach(s=>{ s.det=0; s.detMin=0; });
  Object.keys(HIST).forEach(k=>{ const v=HIST[k]; if(Array.isArray(v)) v.forEach(x=>x.fill(0)); else v.fill(0); }); Object.keys(SPEND).forEach(k=>SPEND[k]=0); RET_CNT.fill(0); OD.fill(0); SEG_ARR.fill(0); MODE_ARR.fill(0); TRANS.fill(0); for(const k in SEQ) delete SEQ[k]; heatCum.fill(0); ALERTS.length=0; $('alerts').innerHTML=''; alertKeys.clear(); }
function seekTo(target){ if(target<timeState.min) resetSim(); let guard=0; while(timeState.min<target-0.01 && guard++<200000){ stepSim(0.5); } }
function setDay(d){ curDay=d; activeN=DAYS[d].n; document.querySelectorAll('#day-sel .crumb').forEach(c=>c.classList.toggle('active',+c.dataset.day===d)); const t=timeState.min; resetSim(); seekTo(t); repaintHeat(); syncClock(); updatePanel(true); toast(DAYS[d].label); }
document.querySelectorAll('#day-sel .crumb').forEach(c=>c.onclick=()=>setDay(+c.dataset.day));

/* ---------- 密度グリッド / ヒートマップ ---------- */
const HG={cell:25, x0:-1600, z0:-900, nx:128, nz:128}; const heatNow=new Float32Array(HG.nx*HG.nz), heatCum=new Float32Array(HG.nx*HG.nz), densGrid=new Float32Array(HG.nx*HG.nz);
function accumHeat(){ densGrid.fill(0); for(let i=0;i<nextArr;i++){ const a=AG[i]; if(a.st===0||a.st===9) continue; const cx=Math.floor((a.x-HG.x0)/HG.cell), cz=Math.floor((a.z-HG.z0)/HG.cell); if(cx<0||cz<0||cx>=HG.nx||cz>=HG.nz) continue; heatCum[cz*HG.nx+cx]+=1; densGrid[cz*HG.nx+cx]+=1; } }
function densFactor(x,z){ const cx=Math.floor((x-HG.x0)/HG.cell), cz=Math.floor((z-HG.z0)/HG.cell); if(cx<0||cz<0||cx>=HG.nx||cz>=HG.nz) return 1; const d=densGrid[cz*HG.nx+cx]; return d<25?1:Math.max(0.45, 1-(d-25)/120); }
const heatCv=cvs(HG.nx,HG.nz), heatCtx=heatCv.getContext('2d'); const heatTex=new THREE.CanvasTexture(heatCv); heatTex.magFilter=THREE.LinearFilter; heatTex.minFilter=THREE.LinearFilter;
const heatGeo=new THREE.PlaneGeometry(HG.nx*HG.cell, HG.nz*HG.cell, 64, 64);
(function(){ const p=heatGeo.attributes.position; const cx=HG.x0+HG.nx*HG.cell/2, cz=HG.z0+HG.nz*HG.cell/2; for(let i=0;i<p.count;i++){ p.setZ(i, hAt(p.getX(i)+cx, -p.getY(i)+cz)+2.5); } })();
const heatPlane=new THREE.Mesh(heatGeo, new THREE.MeshBasicMaterial({map:heatTex, transparent:true, opacity:0.8, depthWrite:false}));
heatPlane.rotation.x=-Math.PI/2; heatPlane.position.set(HG.x0+HG.nx*HG.cell/2, 0, HG.z0+HG.nz*HG.cell/2); heatPlane.renderOrder=3; world.add(heatPlane);
let heatMode='now';
function heatColor(v){ const st=[[0,37,99,235],[0.3,34,197,94],[0.6,245,158,11],[0.82,239,68,68],[1,185,28,28]]; let i=0; while(i<st.length-2 && st[i+1][0]<=v) i++; const a=st[i], b=st[i+1]; const k=clamp((v-a[0])/(b[0]-a[0]),0,1); return [a[1]+(b[1]-a[1])*k, a[2]+(b[2]-a[2])*k, a[3]+(b[3]-a[3])*k]; }
function repaintHeat(){ if(!heatPlane.visible) return; heatNow.fill(0); for(let i=0;i<nextArr;i++){ const a=AG[i]; if(a.st===0||a.st===9) continue; const cx=Math.floor((a.x-HG.x0)/HG.cell), cz=Math.floor((a.z-HG.z0)/HG.cell); if(cx<0||cz<0||cx>=HG.nx||cz>=HG.nz) continue; heatNow[cz*HG.nx+cx]+=1; }
  const src=heatMode==='now'?heatNow:heatCum; const img=heatCtx.createImageData(HG.nx,HG.nz); const d=img.data; const vals=[]; const bl=new Float32Array(HG.nx*HG.nz);
  for(let z=0;z<HG.nz;z++) for(let x=0;x<HG.nx;x++){ let s=0,w=0; for(let dz=-1;dz<=1;dz++) for(let dx=-1;dx<=1;dx++){ const xx=x+dx, zz=z+dz; if(xx<0||zz<0||xx>=HG.nx||zz>=HG.nz) continue; const k=(dx||dz)?0.35:1; s+=src[zz*HG.nx+xx]*k; w+=k; } const v=s/w; bl[z*HG.nx+x]=v; if(v>0.05) vals.push(v); }
  vals.sort((a,b)=>a-b); const n=vals.length; const rank=(v)=>{ let lo=0,hi=n-1; while(lo<hi){ const m=(lo+hi)>>1; if(vals[m]<v) lo=m+1; else hi=m; } return n>1?lo/(n-1):0; };
  for(let k=0;k<HG.nx*HG.nz;k++){ const v=bl[k]; const o=k*4; if(v<=0.05){ d[o+3]=0; continue; } let r=rank(v); r=Math.pow(r,1.6); const c=heatColor(r); d[o]=c[0]; d[o+1]=c[1]; d[o+2]=c[2]; d[o+3]=90+r*150; }
  heatCtx.putImageData(img,0,0); heatTex.needsUpdate=true; }

/* ---------- エージェント描画 ---------- */
const agGeo=new THREE.CylinderGeometry(1.0,1.3,4.6,7); agGeo.translate(0,2.3,0);
const agMesh=new THREE.InstancedMesh(agGeo, new THREE.MeshStandardMaterial({roughness:0.8}), N_AG); agMesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(N_AG*3),3); agMesh.count=0; agMesh.frustumCulled=false; world.add(agMesh);
const headGeo=new THREE.SphereGeometry(0.9,6,5); headGeo.translate(0,5.4,0);
const headMesh=new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({color:0xf1d3b3, roughness:0.9}), N_AG); headMesh.count=0; headMesh.frustumCulled=false; world.add(headMesh);
let colorMode='grp'; const _M=new THREE.Matrix4(), _C=new THREE.Color(), _P=new THREE.Vector3(), _Q=new THREE.Quaternion(), _S=new THREE.Vector3();
const SEG_C=SEG.map(s=>new THREE.Color(s.col)); const RET_C=RET.map(r=>new THREE.Color(r.col)); const MODE_C=MODE_COL.map(c=>new THREE.Color(c));
const C_IN=new THREE.Color(0x2ec4c6), C_DOM=new THREE.Color(0x1a5ed9), C_STAY=new THREE.Color(0xf59e0b), C_DAY=new THREE.Color(0x8a93a3), C_WALK=new THREE.Color(0xffffff), C_DWELL=new THREE.Color(0x17a05e), C_Q=new THREE.Color(0xe11d74), C_LEAVE=new THREE.Color(0xf59e0b), C_HOTEL=new THREE.Color(0xc026d3), C_HL=new THREE.Color(0xffffff);
function agentColor(a){ switch(colorMode){ case 'seg': return SEG_C[a.si]; case 'grp': return a.grp==='in'?C_IN:C_DOM; case 'trip': return a.stay?C_STAY:C_DAY; case 'state': return a.st===1?C_WALK:(a.st===2?C_DWELL:(a.st===4?C_Q:(a.st===3?C_HOTEL:C_LEAVE))); case 'ret': return RET_C[a.ret]; case 'mode': return MODE_C[a.mi]; } return C_DOM; }
let hlAgent=null;
function renderAgents(now){ let n=0; const sc=clamp(ctrl.sph.radius/700,0.9,5); _S.set(sc,sc,sc); _Q.identity(); for(let i=0;i<nextArr;i++){ const a=AG[i]; if(a.st===0||a.st===9) continue; _P.set(a.x, hAt(a.x,a.z), a.z); _M.compose(_P,_Q,_S); agMesh.setMatrixAt(n,_M); headMesh.setMatrixAt(n,_M); agMesh.setColorAt(n, a===hlAgent?C_HL:agentColor(a)); n++; }
  agMesh.count=headMesh.count=n; agMesh.instanceMatrix.needsUpdate=true; headMesh.instanceMatrix.needsUpdate=true; if(agMesh.instanceColor) agMesh.instanceColor.needsUpdate=true; }
/* 選択者の軌跡 */
const selTrail=(function(){ const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(T_END*3+3),3)); g.setDrawRange(0,0); const l=new THREE.Line(g, new THREE.LineBasicMaterial({color:0xe11d74, linewidth:2})); l.frustumCulled=false; l.visible=false; world.add(l); const mk=new THREE.Mesh(new THREE.RingGeometry(6,8,24), new THREE.MeshBasicMaterial({color:0xe11d74, side:THREE.DoubleSide, depthWrite:false})); mk.rotation.x=-Math.PI/2; mk.visible=false; world.add(mk); return {l,mk}; })();
function renderTrail(){ if(!hlAgent){ selTrail.l.visible=false; selTrail.mk.visible=false; return; } const h=hlAgent.hist||[]; const arr=selTrail.l.geometry.attributes.position.array; const n=Math.min(h.length/3, T_END); for(let i=0;i<n*3;i++) arr[i]=h[i]; selTrail.l.geometry.setDrawRange(0,n); selTrail.l.geometry.attributes.position.needsUpdate=true; selTrail.l.visible=n>1; selTrail.mk.visible=hlAgent.st!==0&&hlAgent.st!==9; selTrail.mk.position.set(hlAgent.x, hAt(hlAgent.x,hlAgent.z)+1.5, hlAgent.z); const sc=clamp(ctrl.sph.radius/700,0.9,5); selTrail.mk.scale.set(sc,sc,1); }

/* ---------- OD 弧線 (広域) ---------- */
const arcGroup=new THREE.Group(); world.add(arcGroup); arcGroup.visible=false; let arcsOn=false; let arcMode='in'; /* in / out / both */
const ARCS=[];
function arcPts(a, b, n=40){ const pts=[]; const d=Math.hypot(b[0]-a[0],b[1]-a[1]); const h=Math.min(9000, 200+d*0.28); for(let i=0;i<=n;i++){ const k=i/n; pts.push(new THREE.Vector3(lerp(a[0],b[0],k), 40+Math.sin(k*Math.PI)*h, lerp(a[1],b[1],k))); } return pts; }
function makeArc(from, to, color, key, dir){ const pts=arcPts(from,to); const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({color, transparent:true, opacity:0.55})); const pg=new THREE.BufferGeometry(); const np=14; pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(np*3),3)); const P=new THREE.Points(pg, new THREE.PointsMaterial({color, size:8*Math.min(devicePixelRatio,2), sizeAttenuation:false, transparent:true, opacity:0.95, depthWrite:false})); P.frustumCulled=false; line.frustumCulled=false; arcGroup.add(line); arcGroup.add(P); const arc={line,P,pts,np,key,dir,vol:0,ph:Math.random()}; ARCS.push(arc); return arc; }
const GATE_PT=(id)=>{ const g=GATES.find(g=>g.id===id); return [g.x,g.z]; };
const IC_E=LL(34.8690,134.7270), IC_W=LL(34.8670,134.6330);
SEG.forEach(s=>{ const node=s.grp==='in'?(s.via==='tokyo'?REG.tokyo:REG.kix):REG[s.node]; if(!node) return; const carShare=s.mode[2]; const to=carShare>0.4?(node.x<0?IC_W:IC_E):GATE_PT('shink'); s.arcIn=makeArc([node.x,node.z], to, s.col, 'in:'+s.id, 'in'); });
ABROAD.forEach(a=>{ const via=a.seg.via==='tokyo'?REG.tokyo:REG.kix; a.arc=makeArc([a.x,a.z],[via.x,via.z], a.seg.col, 'ab:'+a.id, 'in'); });
RET.forEach(r=>{ const nid=RET_NODE[r.id]; if(!nid) return; const n=REG[nid]; r.arcOut=makeArc(GATE_PT('shink'), [n.x,n.z], r.col, 'out:'+r.id, 'out'); });
function arcVolumes(){ SEG.forEach(s=>{ if(s.arcIn) s.arcIn.vol=SEG_ARR[s.i]*PER_AGENT; }); ABROAD.forEach(a=>{ a.arc.vol=SEG_ARR[a.seg.i]*PER_AGENT; }); RET.forEach(r=>{ if(r.arcOut) r.arcOut.vol=RET_CNT[RET.indexOf(r)]*PER_AGENT; }); }
function setArcs(on){ arcsOn=on; arcGroup.visible=on; $('tg-arc').classList.toggle('active',on); }
function renderArcs(now){ if(!arcGroup.visible) return; ARCS.forEach(a=>{ const show=(arcMode==='both')||(a.dir===arcMode); const v=a.vol; a.line.visible=show && v>0; a.P.visible=show && v>0; if(!show||v<=0) return; const k=clamp(v/1200,0.15,1); a.line.material.opacity=0.25+0.5*k; a.P.material.size=(5+9*k)*Math.min(devicePixelRatio,2); const arr=a.P.geometry.attributes.position.array; const speed=a.dir==='in'?1:-1; for(let i=0;i<a.np;i++){ let t=((now*0.00004*speed)+a.ph+i/a.np)%1; if(t<0) t+=1; const idx=t*(a.pts.length-1); const j=Math.floor(idx), f=idx-j; const p=a.pts[Math.min(j,a.pts.length-1)], q=a.pts[Math.min(j+1,a.pts.length-1)]; arr[i*3]=lerp(p.x,q.x,f); arr[i*3+1]=lerp(p.y,q.y,f); arr[i*3+2]=lerp(p.z,q.z,f); } a.P.geometry.attributes.position.needsUpdate=true; }); }

/* ---------- 乗り物 ---------- */
const vehGroup=new THREE.Group(); world.add(vehGroup); let vehOn=true;
const VEH=[];
function mkVeh(route, s0, len, w, h, color, kind, speed){ const g=new THREE.Group(); const cars=kind==='train'?Math.max(1,Math.round(len/25)):1; const cl=len/cars; for(let i=0;i<cars;i++){ const m=new THREE.Mesh(new THREE.BoxGeometry(w, h, cl*0.92), new THREE.MeshStandardMaterial({color, roughness:0.5, metalness:0.2})); m.position.set(0,h/2,-len/2+cl*(i+0.5)); g.add(m); if(kind==='train'){ const stripe=new THREE.Mesh(new THREE.BoxGeometry(w+0.2,0.6,cl*0.92), new THREE.MeshStandardMaterial({color:0x1a5ed9})); stripe.position.set(0,h*0.55,-len/2+cl*(i+0.5)); g.add(stripe); } } vehGroup.add(g); VEH.push({g,route,s:s0,len,speed,kind,dir:speed>0?1:-1}); }
mkVeh(ROUTES.shinkansen, 200, 400, 3.4, 4.0, 0xf5f7fa, 'train', 70); mkVeh(ROUTES.shinkansen, 6000, 400, 3.4, 4.0, 0xf5f7fa, 'train', -70);
mkVeh(ROUTES.jr, 1500, 240, 3.0, 3.8, 0x9fc3e0, 'train', 28); mkVeh(ROUTES.jr, 7000, 160, 3.0, 3.8, 0x9fc3e0, 'train', -28);
mkVeh(ROUTES.bantan, 400, 60, 3.0, 3.8, 0xd94848, 'train', 18); mkVeh(ROUTES.kishin, 2000, 40, 3.0, 3.8, 0x7c3aed, 'train', -16);
mkVeh(ROUTES.loop, 0, 11, 2.5, 3.2, 0xe11d74, 'bus', 8); mkVeh(ROUTES.loop, ROUTES.loop.len/2, 11, 2.5, 3.2, 0xe11d74, 'bus', 8);
for(let i=0;i<28;i++){ mkVeh(ROUTES.sanyo, Math.random()*ROUTES.sanyo.len, 5, 2.2, 1.8, [0xffffff,0x334155,0xdc2626,0x0ea5e9][i%4], 'car', (i%2?1:-1)*(22+Math.random()*8)); }
for(let i=0;i<24;i++){ mkVeh(ROUTES.bypass, Math.random()*ROUTES.bypass.len, 5, 2.2, 1.8, [0xffffff,0x64748b,0xf59e0b][i%3], 'car', (i%2?1:-1)*(18+Math.random()*6)); }
for(let i=0;i<10;i++){ mkVeh(ROUTES.r2, Math.random()*ROUTES.r2.len, 5, 2.2, 1.8, 0xffffff, 'car', (i%2?1:-1)*(9+Math.random()*4)); }
for(let i=0;i<6;i++){ mkVeh(ROUTES.north_rd, Math.random()*ROUTES.north_rd.len, 5, 2.2, 1.8, 0xffffff, 'car', (i%2?1:-1)*(9+Math.random()*4)); }
function renderVehicles(dt){ if(!vehGroup.visible) return; const k=Math.max(1,timeState.playing?timeState.speed/6:1)*0.8; VEH.forEach(v=>{ v.s+=v.speed*dt*k*4; const r=v.route; if(v.kind!=='bus' && (v.s>r.len+v.len || v.s<-v.len)){ v.s=v.speed>0?-v.len:r.len+v.len; } const p=routeAt(r, v.s); const y=hAt(p[0],p[1])+r.elev+0.6; v.g.position.set(p[0],y,p[1]); v.g.rotation.y=p[2]; }); }
