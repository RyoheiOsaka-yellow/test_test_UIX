// ================= 稼働再生：人とフォークリフトの動き（実態ベース） =================
// 敷地: リフト2台（担当2名）。①原料・資材を倉庫→生産棟へ ②製品を生産棟→出荷倉庫（塗料置き場）→トラックバースへ。
//       歩行者は位置トラッキング実測の建屋間移動（多い順）を再現。
// 内部: 作業者は工程人員の人数だけ配置し、工程順（仕込→分散→調合→充填）に設備間を歩く。
//       リフトは 搬入口→原料置場、製品置場→搬出口 を巡回。
const TWIN_GROUP_COLOR={'ワニス':0xcb9f51,'仕込み':0x6d9ca2,'調合':0x8d82b7,'充填':0x72a76c,'2B':0xd08660,'調色':0xc0779e,'物流':0x6888ab,'管理':0x929a8a,'生産管理':0x63988d};
const TWIN_STAFF={paint1:[['仕込み',3],['調合',3],['充填',10]],paint2:[['2B',3]],varnish:[['ワニス',2]],tint:[['調色',3]]};
const TWIN_PLAN_EXTRA=[['ワニス',2],['調色',3]];   // 変更案で第二工場へ移る工程
function twinTint(g,col){ g.traverse(o=>{ if(o.isMesh&&o.material.color.getHex()===0xffd479){ o.material=o.material.clone(); o.material.color.setHex(col); } }); return g; }
// ---- 経路の整形: 見通せる区間は直線に（ジグザグ除去）、角は円弧でつなぐ ----
function twinLOS(g,a,b){
  const d=Math.hypot(b.x-a.x,b.z-a.z), n=Math.max(1,Math.ceil(d/(g.cell*.45)));
  for(let i=0;i<=n;i++){ const x=a.x+(b.x-a.x)*i/n, z=a.z+(b.z-a.z)*i/n, c=Math.floor((x+g.W/2)/g.cell), r=Math.floor((z+g.D/2)/g.cell);
    if(c<0||r<0||c>=g.cols||r>=g.rows||g.occ[r*g.cols+c]) return false; }
  return true;
}
function twinPath(pts,g,radius){
  let P=[]; for(const p of pts){ if(!P.length||Math.hypot(P[P.length-1].x-p.x,P[P.length-1].z-p.z)>.02) P.push({x:p.x,z:p.z}); }
  if(P.length<2) P.push({x:P[0].x+.05,z:P[0].z});
  if(g&&P.length>2){ const S=[P[0]]; let i=0; while(i<P.length-1){ let j=P.length-1; while(j>i+1&&!twinLOS(g,P[i],P[j])) j--; S.push(P[j]); i=j; } P=S; }
  const V=P.map(p=>new THREE.Vector3(p.x,0,p.z)), cp=new THREE.CurvePath(); let prev=V[0];
  for(let i=1;i<V.length-1;i++){
    const din=V[i].clone().sub(V[i-1]), dout=V[i+1].clone().sub(V[i]), li=din.length(), lo=dout.length(); if(li<1e-3||lo<1e-3) continue;
    const r=Math.min(radius,li*.45,lo*.45), a=V[i].clone().addScaledVector(din.normalize(),-r), b2=V[i].clone().addScaledVector(dout.normalize(),r);
    if(a.distanceTo(prev)>1e-3) cp.add(new THREE.LineCurve3(prev,a));
    cp.add(new THREE.QuadraticBezierCurve3(a,V[i].clone(),b2)); prev=b2;
  }
  if(V[V.length-1].distanceTo(prev)>1e-3||!cp.curves.length) cp.add(new THREE.LineCurve3(prev,V[V.length-1]));
  return {curve:cp,len:Math.max(.05,cp.getLength()),end:P[P.length-1]};
}
const twinAng=(a,b)=>{ let d=(b-a)%(Math.PI*2); if(d>Math.PI) d-=Math.PI*2; if(d<-Math.PI) d+=Math.PI*2; return d; };
function twinSetLeg(m,i){
  m.li=i; const L=m.legs[i]; m.curve=L.curve; m.len=L.len; m.s=0; m.v=0; m.t=0; m.dir=1; m.state='go'; m.dwell=0; m.toggled=false; m.dwellDur=L.dwell??m.baseDwell;
  const cg=m.mesh.userData.cargo; if(cg) cg.visible=!!L.loaded;
  if(m.tag&&L.label!==m.tagText){ m.mesh.remove(m.tag); m.tag.material.map?.dispose(); m.tag=makeLabel(L.label,m.tagScale,L.loaded?'#ffd27a':'#b9c7d1'); m.tag.position.y=m.tagY; m.mesh.add(m.tag); m.tagText=L.label; }
}
function twinNextLeg(m){ twinSetLeg(m,(m.li+1)%m.legs.length); }
function twinAddTour(mesh,legs,o){
  mesh.visible=false; applyShadows(mesh); scene.add(mesh);
  const m={mesh,legs,li:0,s:0,v:0,t:0,dir:1,state:'go',dwell:0,toggled:false,speed:o.speed,reps:o.reps||1,phase:Math.random()*6,baseDwell:o.dwell||1.5,dwellDur:o.dwell||1.5,
           acc:o.acc||1,turn:o.turn||4,pivot:!!o.pivot,yaw:null,tag:null,tagText:null,tagScale:o.tagScale||.5,tagY:o.tagY||5};
  if(o.label){ m.tag=makeLabel('',m.tagScale); mesh.add(m.tag); }
  twinSetLeg(m,0); m.s=(o.start||0)*m.len; movers.push(m); return m;
}
// 1コマ進める: 加減速・旋回速度の上限・その場旋回（リフト）・作業中は設備の方を向く
function twinTourStep(m,dt){
  const L=m.legs[m.li], lift=m.mesh.userData.lift, cargo=m.mesh.userData.cargo, whs=m.mesh.userData.wheels;
  const u=Math.min(.9995,Math.max(.0005,m.s/m.len)), p=m.curve.getPointAt(u), tan=m.curve.getTangentAt(u);
  let want=Math.atan2(tan.x,tan.z); if(m.yaw===null) m.yaw=want;
  if(m.state==='dwell'){
    m.dwell+=dt; m.v=0; const ph=Math.min(1,m.dwell/m.dwellDur);
    if(lift) lift.position.y=-0.24*(ph<.5?ph*2:(1-ph)*2);
    if(cargo&&ph>=.5&&!m.toggled){ cargo.visible=!!m.legs[(m.li+1)%m.legs.length].loaded; m.toggled=true; }
    if(L.face&&!whs){ want=Math.atan2(L.face.x-p.x,L.face.z-p.z); m.yaw+=Math.max(-m.turn*dt,Math.min(m.turn*dt,twinAng(m.yaw,want))); }
    if(m.dwell>=m.dwellDur){ if(lift) lift.position.y=0; twinNextLeg(m); }
  } else {
    const diff=twinAng(m.yaw,want), step=m.turn*dt; m.yaw+=Math.max(-step,Math.min(step,diff));
    const rem=m.len-m.s, stop=m.dwellDur>.3;                       // 止まる区間だけ減速する
    let vmax=m.speed*Math.min(1,(m.s+m.acc*.2)/m.acc,stop?(rem+m.acc*.12)/m.acc:1);
    vmax*=Math.max(.25,1-Math.abs(diff)*.9);                        // 曲がるときは減速
    if(m.pivot&&Math.abs(diff)>.7) vmax=0;                          // リフトは大きく向きが違えばその場で旋回してから発進
    m.v+=Math.max(-m.speed*3*dt,Math.min(m.speed*1.5*dt,vmax-m.v)); if(m.v<0) m.v=0;
    m.s+=m.v*dt; if(m.s>=m.len){ m.s=m.len; m.state='dwell'; m.dwell=0; }
  }
  m.t=m.s/m.len; m.phase+=dt*(4+m.v*4.5);
  const moving=m.v>.05, bob=whs?0:(moving?.05*Math.abs(Math.sin(m.phase)):0);
  m.mesh.position.set(p.x,bob,p.z); m.mesh.rotation.set(0,m.yaw,whs?0:(moving?.035*Math.sin(m.phase):0));
  if(whs){ const ang=(m.v*dt)/.5; for(const w of whs) w.rotateY(-ang); }
  const bc=m.mesh.userData.beacon; if(bc) bc.material.emissiveIntensity=.25+1.1*Math.max(0,Math.sin(performance.now()*.008));
  const c=clampC(ctx,wToC(ctx,p.x)), r=clampR(ctx,wToR(ctx,p.z)), k=c+','+r; ctx.cong.set(k,(ctx.cong.get(k)||0)+dt*m.reps*.2);
}
// ---- 敷地 ----
function twinDock(b){
  // 建屋の荷捌き点: 構内中央（ヤード）に向いた辺の外側
  const yard={x:15,z:-20}, dx=yard.x-b.x, dz=yard.z-b.z, off=4.5;
  if(Math.abs(dx)/b.w>Math.abs(dz)/b.d) return {x:b.x+Math.sign(dx)*(b.w/2+off), z:b.z+Math.max(-b.d/2+3,Math.min(b.d/2-3,dz*.25))};
  return {x:b.x+Math.max(-b.w/2+3,Math.min(b.w/2-3,dx*.25)), z:b.z+Math.sign(dz||1)*(b.d/2+off)};
}
const twinSiteGrid=()=>({W:siteCtx.W,D:siteCtx.D,cell:siteCtx.cell,cols:siteCtx.cols,rows:siteCtx.rows,occ:siteCtx.occ});
function twinSiteLeg(a,b,loaded,label,dwell,radius=4){
  const path=astar(siteCtx,a.x,a.z,b.x,b.z);
  const pts=(path&&path.length>1)?[a,...path.slice(1,-1).map(([x,z])=>({x,z})),b]:[a,b];
  return {...twinPath(pts,twinSiteGrid(),radius),loaded,label,dwell};
}
function twinSiteMovers(){
  const B=id=>siteCtx.items.find(i=>i.id===id), D=id=>twinDock(B(id));
  const wh=B('whGen'), berth={x:wh.x-8,z:wh.z-wh.d/2-5};          // 出荷トラックの着車位置（出荷倉庫の正門側）
  // リフト1: 原料・資材（倉庫 → 生産棟）
  const t1=[['whNew','paint1','原料'],['hazA','paint1','溶剤・樹脂'],['hazB','paint2','溶剤・樹脂'],['whNew','paint2','原料'],['hazNew','varnish','原料']];
  // リフト2: 製品（生産棟 → 出荷倉庫＝塗料置き場 → 出荷）
  const t2=[['paint1','whGen','製品'],['whGen','@berth','出荷'],['paint2','whGen','製品'],['paint1','whGen','製品'],['whGen','@berth','出荷'],['tint','whGen','調色品'],['varnish','whGen','製品']];
  const P=id=>id==='@berth'?berth:D(id), N=id=>id==='@berth'?'トラック':B(id).name.replace(/ .*/,'');
  [[t1,'リフト1'],[t2,'リフト2']].forEach(([jobs,name],fi)=>{
    const legs=[]; let pos=P(jobs[jobs.length-1][1]);
    for(const [from,to,what] of jobs){
      if(Math.hypot(pos.x-P(from).x,pos.z-P(from).z)>1) legs.push(twinSiteLeg(pos,P(from),false,`${name} 空荷 → ${N(from)}`,2.6));
      legs.push(twinSiteLeg(P(from),P(to),true,`${name} ${what} → ${N(to)}`,3.0)); pos=P(to);
    }
    twinAddTour(makeForklift(true),legs,{speed:7,acc:9,turn:1.5,pivot:true,dwell:2.6,label:true,tagScale:.55,tagY:5.6,start:fi*.3,reps:6});
  });
  // 歩行者: 位置トラッキング実測の建屋間移動（回/ID日 × 人員）の多い組合せ
  const PD=window.__factoryProductivity?.data; if(!PD) return;
  const A=Object.fromEntries(PD.areas.map(a=>[a.id,a])), staff={...Object.fromEntries(PD.staff.map(s=>[s.group,s.current])),'物流':2,'生産管理':1,'管理':1};
  const days={}, od=new Map();
  for(const r of PD.daily){ if(!r.eligible) continue; days[r.group]=(days[r.group]||0)+1;
    for(const o of r.od){ const a=A[o.from]?.building,b=A[o.to]?.building; if(!a||!b||a===b||!B(a)||!B(b)) continue;
      const k=[r.group,...[a,b].sort()].join('|'); od.set(k,(od.get(k)||0)+o.count); } }
  const pairs=[...od.entries()].map(([k,n])=>{const [g,a,b]=k.split('|');return {g,a,b,perDay:n/days[g]*(staff[g]||1)};}).sort((x,y)=>y.perDay-x.perDay).slice(0,12);
  pairs.forEach((p,i)=>{
    const a=D(p.a), b=D(p.b), o=(i%3-1)*1.4, A2={x:a.x+o,z:a.z+o}, B2={x:b.x+o,z:b.z+o};
    const w=twinTint(makeWorker(),TWIN_GROUP_COLOR[p.g]||0x9aa); w.scale.setScalar(.62);
    twinAddTour(w,[twinSiteLeg(A2,B2,false,'',2.5,2),twinSiteLeg(B2,A2,false,'',2.5,2)],{speed:2.6,acc:1.5,turn:5,dwell:2.5,start:(i*.37)%1,reps:p.perDay/10});
  });
}
// ---- 建屋内部 ----
function twinInteriorMovers(){
  const c=ctx, g=c.nav; if(!g) return;
  const LOGI=new Set(['IN','OUT','CAN','NST','DRM','BAG','FRC','IBC','RCK']);
  const byId=Object.fromEntries(c.items.map(i=>[i.assetId,i]));
  const ok=c.routes.filter(r=>!r.blocked&&r.pts.length>1&&byId[r.fromId]&&byId[r.toId]);
  const isFork=r=>c.drawing? r.line==='リフト' : (['IN','OUT'].includes(r.fk)||['IN','OUT'].includes(r.tk)||(LOGI.has(r.fk)&&LOGI.has(r.tk)));
  const walk=ok.filter(r=>!isFork(r)), fork=ok.filter(isFork);
  const cellOf=(gr,p)=>Math.max(0,Math.min(gr.rows-1,Math.floor((p.z+gr.D/2)/gr.cell)))*gr.cols+Math.max(0,Math.min(gr.cols-1,Math.floor((p.x+gr.W/2)/gr.cell)));
  // 停止点の列 → 連続した経路（前の終点から次の設備の手前まで）。区間の継ぎ目で位置が飛ばない。
  const legsOf=(stops,gr,radius)=>{
    const legs=[]; if(stops.length<2) return legs;
    const a0=v4Access(gr,stops[stops.length-1].item)[0]; if(a0==null) return legs;
    let pos={x:-gr.W/2+(a0%gr.cols+.5)*gr.cell,z:-gr.D/2+(Math.floor(a0/gr.cols)+.5)*gr.cell};
    for(const st of stops){
      const path=v4Search(gr,[cellOf(gr,pos)],v4Access(gr,st.item)); if(!path||path.length<2) continue;
      path[0]=pos; const leg={...twinPath(path,gr,radius),loaded:st.loaded,label:st.label,dwell:st.dwell,face:st.item}; legs.push(leg); pos=leg.end;
    }
    return legs;
  };
  const chain=(routes,rng,n)=>{   // 工程順にたどる設備の列
    const tot=routes.reduce((a,r)=>a+r.reps,0), pick=(list,t)=>{let x=rng()*t;for(const r of list){x-=r.reps;if(x<=0)return r;}return list[list.length-1];};
    let cur=pick(routes,tot); const seq=[byId[cur.fromId],byId[cur.toId]];
    for(let i=1;i<n;i++){ const nexts=routes.filter(r=>r.fromId===cur.toId&&r!==cur);
      const nx=nexts.length&&rng()<.8?pick(nexts,nexts.reduce((a,r)=>a+r.reps,0)):pick(routes,tot);
      if(nx.fromId!==cur.toId) seq.push(byId[nx.fromId]); seq.push(byId[nx.toId]); cur=nx; }
    return seq.filter((it,i)=>i===0||it!==seq[i-1]);
  };
  // 作業者: 工程人員の人数ぶん
  let staff=(TWIN_STAFF[c.id]||[['',2]]).slice(); if(c.drawing?.scen==='plan') staff=staff.concat(TWIN_PLAN_EXTRA);
  for(const [grp,n] of staff){
    const pool=c.drawing? walk.filter(r=>(r.line||'2B')===grp) : walk;
    for(let k=0;k<n;k++){
      const rng=sRand(c.id+grp+k); let seq=[];
      if(pool.length) seq=chain(pool,rng,6);
      else if(grp==='調色'&&c.drawing){ const ts=c.items.filter(i=>i.sys==='調色'); seq=[...ts].sort(()=>rng()-.5).slice(0,5); }   // 実績フローが無いのでエリア内を巡回
      else if(walk.length) seq=chain(walk,rng,6);
      const legs=legsOf(seq.map(it=>({item:it,loaded:false,label:'',dwell:2.5+rng()*4})),g,.45);
      if(legs.length<2) continue;
      const w=twinTint(makeWorker(),TWIN_GROUP_COLOR[grp]||0xffd479); w.scale.setScalar(.54);
      twinAddTour(w,legs,{speed:1.25,acc:.5,turn:5.5,dwell:3,start:rng()*.9,reps:1});
    }
  }
  // フォークリフト: 搬入口→原料置場、製品置場→搬出口（リフト幅で通れる通路だけを使う）
  if(fork.length){
    const rec=v4Ensure(c); let gF=v4NavGrid(c,Math.max(1.0,rec.vehicle.width),.15);
    const ins=fork.filter(r=>byId[r.fromId].proc==='IN'), outs=fork.filter(r=>byId[r.toId].proc==='OUT'), rest=fork.filter(r=>!ins.includes(r)&&!outs.includes(r));
    const order=[]; for(let i=0;i<Math.max(ins.length,outs.length,rest.length);i++){ if(ins[i]) order.push(ins[i]); if(rest[i]) order.push(rest[i]); if(outs[i]) order.push(outs[i]); }
    const nm=it=>it.name.replace(/[（(].*/,'');
    const stops=order.slice(0,8).flatMap(r=>{const a=byId[r.fromId],z=byId[r.toId];return [{item:a,loaded:false,label:'リフト 空荷 → '+nm(a),dwell:2.4},{item:z,loaded:true,label:'リフト '+(z.proc==='OUT'?'製品 → 搬出口':a.proc==='IN'?'原料 → '+nm(z):nm(a)+' → '+nm(z)),dwell:2.8}];});
    let legs=legsOf(stops,gF,1.1); if(legs.length<stops.length*.7) legs=legsOf(stops,g,.9);   // 幅が足りず届かない所は人用の通路で代替
    if(legs.length>1){ const f=makeForklift(true); f.scale.setScalar(.42);
      twinAddTour(f,legs,{speed:2.0,acc:1.6,turn:1.7,pivot:true,dwell:2.6,label:true,tagScale:.5,tagY:5.4,reps:3}); }
  }
}
function rebuildMovers(){
  movers.forEach(m=>{ scene.remove(m.mesh); m.mesh.traverse(o=>{o.geometry?.dispose();o.material?.dispose?.();}); });
  movers=[];
  try{ if(ctx.kind==='site') twinSiteMovers(); else twinInteriorMovers(); }catch(e){ console.warn('movers',e); }
  if(ctx.kind==='site'){   // 入出荷トラック（正門⇔出荷倉庫・原料倉庫）
    const gate=siteCtx.items.find(i=>i.id==='gate');
    [['whGen','出荷便',t=>({x:t.x-8,z:t.z-t.d/2-9})],['whNew','原料便',t=>({x:t.x+t.w/2+4,z:t.z})]].forEach(([tid,label,dockOf],ti)=>{
      const tgt=siteCtx.items.find(i=>i.id===tid); if(!gate||!tgt) return;
      const g0={x:gate.x,z:gate.z+6}, d0=dockOf(tgt), tk2=makeTruck(label);
      twinAddTour(tk2,[twinSiteLeg(g0,d0,false,'',9,7),twinSiteLeg(d0,g0,false,'',5,7)],{speed:8,acc:12,turn:1.1,pivot:false,dwell:9,start:.15+ti*.4,reps:4});
    });
  }
}
// ---- 内部の見え方: 手前の壁を自動で隠す（カットアウェイ）・ラベルは近距離のみ ----
function twinViewTick(){
  if(ctx.kind!=='interior') return;
  const W=ctx.W, D=ctx.D, cam=camera.position, walls=v3.groups.walls;
  if(walls&&v3.layers.walls&&!v3.walk) for(const o of walls.children){
    const p=o.position, side=Math.abs(p.x)>=W/2-.4, end=Math.abs(p.z)>=D/2-.4;
    o.visible=!((side&&Math.sign(p.x)*cam.x>W/2-10)||(end&&!side&&Math.sign(p.z)*cam.z>D/2-10));   // 視点側（外側または壁際10m以内）の壁を隠す
  } else if(walls&&v3.walk) for(const o of walls.children) o.visible=true;
  // 視点が屋根トラスの高さに近いときは、トラス・母屋・照明を隠して視界を確保
  const fr=v3.groups.frame, H=currentBuilding?.h||10; if(fr){ const high=!v3.walk&&cam.y>H-4; for(const o of fr.children) if(o.position.y>H-1.2) o.visible=!high; }
  if(precisionState.labels&&twinLook==='photo'){ const lim=v3.walk?9:Math.max(16,Math.min(30,camState.dist*.75)); for(const it of ctx.items){ const l=it.mesh?.children.find(ch=>ch.userData.precisionLabel); if(l) l.visible=(it===selected)||cam.distanceTo(it.mesh.position)<lim; } }
}
