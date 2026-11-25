// ================= 稼働再生：人とフォークリフトの動き（実態ベース） =================
// 敷地: リフト2台（担当2名）。①原料・資材を倉庫→生産棟へ ②製品を生産棟→出荷倉庫（塗料置き場）→トラックバースへ。
//       歩行者は位置トラッキング実測の建屋間移動（多い順）を再現。
// 内部: 作業者は工程人員の人数だけ配置し、工程順（仕込→分散→調合→充填）に設備間を歩く。
//       リフトは 搬入口→原料置場、製品置場→搬出口 を巡回。
const TWIN_GROUP_COLOR={'ワニス':0xcb9f51,'仕込み':0x6d9ca2,'調合':0x8d82b7,'充填':0x72a76c,'2B':0xd08660,'調色':0xc0779e,'物流':0x6888ab,'管理':0x929a8a,'生産管理':0x63988d};
const TWIN_STAFF={paint1:[['仕込み',3],['調合',3],['充填',10]],paint2:[['2B',3]],varnish:[['ワニス',2]],tint:[['調色',3]]};
const TWIN_PLAN_EXTRA=[['ワニス',2],['調色',3]];   // 変更案で第二工場へ移る工程
function twinTint(g,col){ g.traverse(o=>{ if(o.isMesh&&o.material.color.getHex()===0xffd479){ o.material=o.material.clone(); o.material.color.setHex(col); } }); return g; }
function twinCurve(pts,y=0){
  const v=[]; for(const p of pts){ const q=new THREE.Vector3(p.x,y,p.z); if(!v.length||v[v.length-1].distanceToSquared(q)>1e-4) v.push(q); }
  if(v.length<2) v.push(v[0].clone().add(new THREE.Vector3(.05,0,0)));
  // 格子経路の角を残しつつ滑らかに（間引き）
  const thin=v.filter((p,i)=>i===0||i===v.length-1||i%3===0);
  const c=new THREE.CatmullRomCurve3(thin,false,'centripetal',.25); return {curve:c,len:Math.max(.1,c.getLength())};
}
function twinSetLeg(m,i){
  m.li=i; const L=m.legs[i]; m.curve=L.curve; m.len=L.len; m.t=0; m.dir=1; m.state='go'; m.dwellDur=L.dwell??m.baseDwell;
  const cg=m.mesh.userData.cargo; if(cg) cg.visible=!!L.loaded;
  if(m.tag&&L.label!==m.tagText){ m.mesh.remove(m.tag); m.tag.material.map?.dispose(); m.tag=makeLabel(L.label,m.tagScale,L.loaded?'#ffd27a':'#b9c7d1'); m.tag.position.y=m.tagY; m.mesh.add(m.tag); m.tagText=L.label; }
}
function twinNextLeg(m){ twinSetLeg(m,(m.li+1)%m.legs.length); }
function twinAddTour(mesh,legs,o){
  mesh.visible=false; applyShadows(mesh); scene.add(mesh);
  const m={mesh,legs,li:0,t:0,dir:1,state:'go',dwell:0,toggled:false,speed:o.speed,reps:o.reps||1,phase:Math.random()*6,baseDwell:o.dwell||1.5,dwellDur:o.dwell||1.5,
           tag:null,tagText:null,tagScale:o.tagScale||.5,tagY:o.tagY||5};
  if(o.label){ m.tag=makeLabel('',m.tagScale); mesh.add(m.tag); }
  twinSetLeg(m,0); m.t=o.start||0; movers.push(m); return m;
}
// ---- 敷地 ----
function twinDock(b){
  // 建屋の荷捌き点: 構内中央（ヤード）に向いた辺の外側
  const yard={x:15,z:-20}, dx=yard.x-b.x, dz=yard.z-b.z, off=4.5;
  if(Math.abs(dx)/b.w>Math.abs(dz)/b.d) return {x:b.x+Math.sign(dx)*(b.w/2+off), z:b.z+Math.max(-b.d/2+3,Math.min(b.d/2-3,dz*.25))};
  return {x:b.x+Math.max(-b.w/2+3,Math.min(b.w/2-3,dx*.25)), z:b.z+Math.sign(dz||1)*(b.d/2+off)};
}
function twinSiteLeg(a,b,loaded,label,dwell){
  const path=astar(siteCtx,a.x,a.z,b.x,b.z);
  const pts=(path&&path.length>1)?[a,...path.slice(1,-1).map(([x,z])=>({x,z})),b]:[a,b];
  return {...twinCurve(pts,0),loaded,label,dwell};
}
function twinSiteMovers(){
  const B=id=>siteCtx.items.find(i=>i.id===id), D=id=>twinDock(B(id));
  const wh=B('whGen'), berth={x:wh.x-8,z:wh.z-wh.d/2-5};          // 出荷トラックの着車位置（出荷倉庫の正門側）
  const job=(from,to,what)=>[from,to,what];
  // リフト1: 原料・資材（倉庫 → 生産棟）
  const t1=[['whNew','paint1','原料'],['hazA','paint1','溶剤・樹脂'],['hazB','paint2','溶剤・樹脂'],['whNew','paint2','原料'],['hazNew','varnish','原料']];
  // リフト2: 製品（生産棟 → 出荷倉庫＝塗料置き場 → 出荷）
  const t2=[['paint1','whGen','製品'],['whGen','@berth','出荷'],['paint2','whGen','製品'],['paint1','whGen','製品'],['whGen','@berth','出荷'],['tint','whGen','調色品'],['varnish','whGen','製品']];
  const P=id=>id==='@berth'?berth:D(id), N=id=>id==='@berth'?'トラック':B(id).name.replace(/ .*/,'');
  [[t1,'リフト1'],[t2,'リフト2']].forEach(([jobs,name],fi)=>{
    const legs=[]; let pos=P(jobs[jobs.length-1][1]);
    for(const [from,to,what] of jobs){
      legs.push(twinSiteLeg(pos,P(from),false,`${name} 空荷 → ${N(from)}`,2.2));
      legs.push(twinSiteLeg(P(from),P(to),true,`${name} ${what} → ${N(to)}`,2.6)); pos=P(to);
    }
    twinAddTour(makeForklift(true),legs,{speed:9,dwell:2.4,label:true,tagScale:.55,tagY:5.6,start:fi*.3,reps:6});
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
    const a=D(p.a), b=D(p.b), o=(i%3-1)*1.2, leg=twinSiteLeg({x:a.x+o,z:a.z+o},{x:b.x+o,z:b.z+o},false,'',1.5), back={...twinCurve(leg.curve.getPoints(40).reverse().map(v=>({x:v.x,z:v.z})),0),dwell:1.5};
    const w=twinTint(makeWorker(),TWIN_GROUP_COLOR[p.g]||0x9aa); w.scale.setScalar(.62);
    twinAddTour(w,[leg,back],{speed:3.2,dwell:1.5,start:(i*.37)%1,reps:p.perDay/10});
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
  const link=(a,b)=>{ if(a===b) return null; const p=v4Search(g,v4Access(g,a),v4Access(g,b)); return p&&p.length>1?p:[{x:a.x,z:a.z},{x:b.x,z:b.z}]; };
  const tourOf=(routes,rng,n,loadedFn,labelFn,dwell)=>{
    const legs=[]; if(!routes.length) return legs;
    const tot=routes.reduce((a,r)=>a+r.reps,0), pick=(list,t)=>{let x=rng()*t;for(const r of list){x-=r.reps;if(x<=0)return r;}return list[list.length-1];};
    let cur=pick(routes,tot); const first=cur;
    for(let i=0;i<n;i++){
      legs.push({...twinCurve(cur.pts),loaded:loadedFn(cur),label:labelFn(cur),dwell:dwell[0]+rng()*dwell[1]});
      const nexts=routes.filter(r=>r.fromId===cur.toId&&r!==cur);
      let nx=nexts.length&&rng()<.8?pick(nexts,nexts.reduce((a,r)=>a+r.reps,0)):pick(routes,tot);
      if(i===n-1) nx=first;
      if(nx.fromId!==cur.toId){ const p=link(byId[cur.toId],byId[nx.fromId]); if(p) legs.push({...twinCurve(p),loaded:false,label:labelFn(null,byId[nx.fromId]),dwell:.4}); }
      cur=nx;
    }
    return legs;
  };
  // 作業者: 工程人員の人数ぶん
  let staff=(TWIN_STAFF[c.id]||[['',2]]).slice(); if(c.drawing?.scen==='plan') staff=staff.concat(TWIN_PLAN_EXTRA);
  let wi=0;
  for(const [grp,n] of staff){
    const pool=c.drawing? walk.filter(r=>(r.line||'2B')===(grp==='調色'?'調色':grp)) : walk;
    const use=pool.length?pool:(grp==='調色'&&c.drawing? [] : walk);
    for(let k=0;k<n;k++,wi++){
      const rng=sRand(c.id+grp+k);
      let legs=tourOf(use,rng,7,()=>false,()=>'' ,[2.5,4]);
      if(!legs.length&&grp==='調色'&&c.drawing){   // 調色は実績フローが無いので、調色エリア内（ディスパー⇔充填機）を巡回
        const ts=c.items.filter(i=>i.sys==='調色'); if(ts.length>1){ const seq=[...ts].sort(()=>rng()-.5).slice(0,5); seq.push(seq[0]);
          for(let j=1;j<seq.length;j++){ const p=link(seq[j-1],seq[j]); if(p) legs.push({...twinCurve(p),loaded:false,label:'',dwell:3+rng()*4}); } }
      }
      if(!legs.length) continue;
      const w=twinTint(makeWorker(),TWIN_GROUP_COLOR[grp]||0xffd479); w.scale.setScalar(.54);
      twinAddTour(w,legs,{speed:1.3,dwell:3,start:rng()*.9,reps:1});
    }
  }
  // フォークリフト: 搬入口→原料置場、製品置場→搬出口
  if(fork.length){
    const order=[...fork].sort((a,b)=>(a.fk==='IN'||byId[a.fromId]?.proc==='IN'?-1:1)-(b.fk==='IN'||byId[b.fromId]?.proc==='IN'?-1:1));
    const legs=[]; order.forEach((r,i)=>{
      const prev=order[(i+order.length-1)%order.length];
      if(prev.toId!==r.fromId){ const p=link(byId[prev.toId],byId[r.fromId]); if(p) legs.push({...twinCurve(p),loaded:false,label:'リフト 空荷',dwell:1.2}); }
      const toIt=byId[r.toId]; legs.push({...twinCurve(r.pts),loaded:true,label:'リフト '+(toIt.proc==='OUT'?'製品 → 搬出':'→ '+toIt.name.replace(/（.*/,'')),dwell:2.4});
    });
    const f=makeForklift(true); f.scale.setScalar(.42);
    twinAddTour(f,legs,{speed:2.2,dwell:2.2,label:true,tagScale:.5,tagY:5.4,reps:3});
  }
}
function rebuildMovers(){
  movers.forEach(m=>{ scene.remove(m.mesh); m.mesh.traverse(o=>{o.geometry?.dispose();o.material?.dispose?.();}); });
  movers=[];
  try{ if(ctx.kind==='site') twinSiteMovers(); else twinInteriorMovers(); }catch(e){ console.warn('movers',e); }
  if(ctx.kind==='site'){   // 入出荷トラック（正門⇔出荷倉庫・原料倉庫）
    const gate=siteCtx.items.find(i=>i.id==='gate');
    [['whGen','出荷便',t=>[t.x-8,t.z-t.d/2-9]],['whNew','原料便',t=>[t.x+t.w/2+4,t.z]]].forEach(([tid,label,dockOf],ti)=>{
      const tgt=siteCtx.items.find(i=>i.id===tid); if(!gate||!tgt) return;
      const [dx2,dz2]=dockOf(tgt), path=astar(siteCtx,gate.x,gate.z+6,dx2,dz2); if(!path||path.length<2) return;
      const curve=new THREE.CatmullRomCurve3(path.map(([x,z])=>new THREE.Vector3(x,0,z)),false,'centripetal');
      const tk2=makeTruck(label); tk2.visible=false; applyShadows(tk2); scene.add(tk2);
      movers.push({mesh:tk2,curve,len:curve.getLength(),t:0.15+ti*0.4,speed:10,reps:4,dir:1,state:'go',dwell:0,toggled:false,dwellDur:9});
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
