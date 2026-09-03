/* ================================================================
   ▼ 拡張モジュール18: 🗾 観光導線の高品質化（v16）
   仮の直線ルートを鉄道網（railJR）／道路網（roadGraph）にスナップ。
   交通モード別の線表現（鉄道＝複線＋枕木、バス／車＝実線＋矢羽）、
   走行する車両、経由地マーカー、モデル区間の距離・所要時間の算出。
   旧レイヤーは非表示にし、同じトグル（🗾 観光導線）に追従する。
================================================================ */
(function(){
'use strict';
const tourBtn=document.getElementById('tour-toggle');
const on=()=> !!tourBtn && tourBtn.classList.contains('active') && level!=='arena';
/* 旧観光導線グループ（ポールの userData.name で特定）を非表示 */
let oldGroup=null;
scene.traverse(o=>{ if(o.userData && typeof o.userData.name==='string' && o.userData.name.indexOf('日光・鬼怒川方面（')===0){ let p=o.parent; while(p && p.parent!==scene) p=p.parent; oldGroup=p; } });
if(oldGroup) oldGroup.visible=false;
const G=new THREE.Group(); G.visible=false; scene.add(G);

/* --- 汎用ポリライングラフ（鉄道用） --- */
function graphOf(polys, q){
  const nodes=new Map(); const key=(x,z)=>Math.round(x/q)+'_'+Math.round(z/q);
  const node=(x,z)=>{ const k=key(x,z); if(!nodes.has(k)) nodes.set(k,{x,z,adj:new Set()}); return k; };
  polys.forEach(p=>{ for(let i=0;i<p.length-1;i++){ const a=node(p[i][0],-p[i][1]), b=node(p[i+1][0],-p[i+1][1]); nodes.get(a).adj.add(b); nodes.get(b).adj.add(a); } });
  /* 端点同士が近接（<60m）していれば連結（駅構内・分岐の途切れ対策） */
  const ends=[]; nodes.forEach((n,k)=>{ if(n.adj.size<=1) ends.push([k,n]); });
  for(let i=0;i<ends.length;i++) for(let j=i+1;j<ends.length;j++){ const a=ends[i][1], b=ends[j][1]; if((a.x-b.x)**2+(a.z-b.z)**2<3600){ a.adj.add(ends[j][0]); b.adj.add(ends[i][0]); } }
  function nearest(x,z){ let b=null, bd=1e18; nodes.forEach((n,k)=>{ const d=(n.x-x)**2+(n.z-z)**2; if(d<bd){bd=d;b=k;} }); return b; }
  function path(x0,z0,x1,z1){
    const s=nearest(x0,z0), g=nearest(x1,z1); if(!s||!g) return null; const gp=nodes.get(g);
    const open=[[0,s]], came=new Map(), cost=new Map([[s,0]]); let found=false, guard=0;
    while(open.length && guard++<40000){ open.sort((a,b)=>a[0]-b[0]); const cur=open.shift()[1]; if(cur===g){found=true;break;} const cn=nodes.get(cur);
      cn.adj.forEach(nb=>{ const nn=nodes.get(nb); const nc=cost.get(cur)+Math.hypot(nn.x-cn.x,nn.z-cn.z); if(nc<(cost.get(nb)??1e18)){ cost.set(nb,nc); came.set(nb,cur); open.push([nc+Math.hypot(nn.x-gp.x,nn.z-gp.z),nb]); } }); }
    if(!found) return null; const out=[]; let cur=g; while(cur){ const n=nodes.get(cur); out.push([n.x,n.z]); cur=came.get(cur); } out.reverse(); return out;
  }
  return {path};
}
const railG=graphOf(SCENE_DATA.railJR, 25);
const roadG=graphOf(SCENE_DATA.roads.filter(r=>r.c<=3).map(r=>r.p), 20);   /* 幹線〜商店街のみ（断片化した歩道を除外） */
/* 目的地が圏外/非連結なら、目的地を起点側へ段階的に戻して到達可能点を探す */
function pathFB(fn, from, to){
  for(let k=0;k<7;k++){ const f=k*0.13, tx=to[0]+(from[0]-to[0])*f, tz=to[1]+(from[1]-to[1])*f; let p=null; try{ p=fn(from[0],from[1],tx,tz); }catch(e){} if(p && p.length>=3) return p; }
  return null;
}
const SX=stn.p[0], SZ=-stn.p[1];
const SPEED={rail:62, bus:28, car:38, lrt:25};   /* km/h（表定） */
const TOURS=[
 {name:'日光・鬼怒川方面', real:'約45分', mode:'rail', via:'JR日光線', col:0xff5a3d, from:[SX,SZ], to:[-3150,-680], spots:['日光東照宮','中禅寺湖','鬼怒川温泉']},
 {name:'那須・塩原方面',   real:'約35分〜', mode:'rail', via:'東北本線・新幹線', col:0xb56ce8, from:[SX,SZ], to:[-920,-2250], spots:['那須高原','塩原温泉','りんどう湖']},
 {name:'大谷・ろまんちっく村', real:'約30分', mode:'bus', via:'関東バス', col:0x35d0c0, from:[SX,SZ], to:[-2850,-1480], spots:['大谷資料館','平和観音','ろまんちっく村']},
 {name:'益子・真岡方面',   real:'約40分', mode:'car', via:'LRT＋バス／車', col:0xc9924a, from:[SCENE_DATA.lrt?SCENE_DATA.lrt.p[0]:1702, SCENE_DATA.lrt?-SCENE_DATA.lrt.p[1]:470], to:[3050,640], spots:['益子焼の里','真岡鐵道SL']},
 {name:'あしかが・佐野方面', real:'約60分', mode:'rail', via:'JR両毛線', col:0x8fd0ff, from:[SX,SZ], to:[-1650,2200], spots:['あしかがフラワーパーク','佐野プレミアムアウトレット']},
];
const chevrons=[], vehicles=[];
const UP=new THREE.Vector3(0,1,0), FX=new THREE.Vector3(1,0,0);
function len(p){ let L=0; for(let i=1;i<p.length;i++) L+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]); return L; }
function at(p,d){ let acc=0; for(let i=1;i<p.length;i++){ const L=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]); if(acc+L>=d){ const k=(d-acc)/(L||1); return [p[i-1][0]+(p[i][0]-p[i-1][0])*k, p[i-1][1]+(p[i][1]-p[i-1][1])*k, p[i][0]-p[i-1][0], p[i][1]-p[i-1][1]]; } acc+=L; } const q=p[p.length-1]; return [q[0],q[1],1,0]; }
function offsetLine(p, off, y, col, op){
  const v=p.map((q,i)=>{ const a=p[Math.max(0,i-1)], b=p[Math.min(p.length-1,i+1)]; const dx=b[0]-a[0], dz=b[1]-a[1], L=Math.hypot(dx,dz)||1; return new THREE.Vector3(q[0]-dz/L*off, y, q[1]+dx/L*off); });
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(v), new THREE.LineBasicMaterial({color:col, transparent:true, opacity:op}));
}
TOURS.forEach(t=>{
  let p = t.mode==='rail' ? pathFB(railG.path, t.from, t.to) : (pathFB(roadG.path, t.from, t.to) || pathFB(roadGraph.path, t.from, t.to));
  if(!p || p.length<2) p=[t.from, t.to];
  /* データ圏外への残区間（破線相当: 薄い直線） */
  const e=p[p.length-1], rem=Math.hypot(t.to[0]-e[0], t.to[1]-e[1]);
  t.path=p; t.L=len(p); t.rem=rem; t.snapped=(p.length>2);
  const total=t.L+rem, mins=total/1000/SPEED[t.mode]*60;
  t.dist=total; t.mins=mins;
  if(t.mode==='rail'){
    G.add(offsetLine(p,-3.2,1.9,t.col,0.95), offsetLine(p,3.2,1.9,t.col,0.95));
    const ties=[]; for(let d=0; d<t.L; d+=45){ const s=at(p,d); const L=Math.hypot(s[2],s[3])||1; const nx=-s[3]/L, nz=s[2]/L; ties.push(new THREE.Vector3(s[0]+nx*4.5,2.0,s[1]+nz*4.5), new THREE.Vector3(s[0]-nx*4.5,2.0,s[1]-nz*4.5)); }
    G.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ties), new THREE.LineBasicMaterial({color:t.col, transparent:true, opacity:0.55})));
    const tr=new THREE.Group(); for(let i=0;i<3;i++){ const b=new THREE.Mesh(new THREE.BoxGeometry(20,3.6,2.8), new THREE.MeshStandardMaterial({color:0xf0f3fa, emissive:t.col, emissiveIntensity:0.35, roughness:0.4})); b.position.set(-20.8+i*20.8, 2.6, 0); tr.add(b); }
    G.add(tr); vehicles.push({t, m:tr, d:Math.random()*t.L, v:70});
  } else {
    G.add(offsetLine(p,-1.6,1.9,t.col,0.95), offsetLine(p,1.6,1.9,t.col,0.95), offsetLine(p,0,0.6,t.col,0.35));
    const cgeo=new THREE.ConeGeometry(6,18,5), cmat=new THREE.MeshBasicMaterial({color:t.col, transparent:true, opacity:0.9});
    const n=Math.max(3, Math.round(t.L/380)); for(let i=0;i<n;i++){ const m=new THREE.Mesh(cgeo,cmat); G.add(m); chevrons.push({t,m,u:i/n}); }
    const bus=new THREE.Mesh(new THREE.BoxGeometry(12,3.2,2.6), new THREE.MeshStandardMaterial({color:t.mode==='bus'?0x2e8f5c:0xe8ecf4, emissive:t.col, emissiveIntensity:0.3, roughness:0.4})); bus.position.y=2.4;
    const bg=new THREE.Group(); bg.add(bus); G.add(bg); vehicles.push({t, m:bg, d:Math.random()*t.L, v:t.mode==='bus'?40:55});
  }
  if(rem>200){ G.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(e[0],1.9,e[1]), new THREE.Vector3(t.to[0],1.9,t.to[1])]), new THREE.LineBasicMaterial({color:t.col, transparent:true, opacity:0.28}))); }
  /* 経由地マーカー（概略位置: 経路の1/3・2/3・終端） */
  t.spots.forEach((sp,i)=>{
    const f=[0.36,0.7,1.0][Math.min(i,2)], s=at(p, Math.min(t.L, f*t.L));
    const pin=new THREE.Mesh(new THREE.CylinderGeometry(3,3,14,8), new THREE.MeshStandardMaterial({color:t.col, emissive:t.col, emissiveIntensity:0.4})); pin.position.set(s[0],9,s[1]); G.add(pin);
    const lb=makeLabel(sp, 7, '#e8eaf2'); lb.position.set(s[0], 30, s[1]); G.add(lb);
  });
  /* 終端: 方面名・算出時間 */
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(6,6,34,6), new THREE.MeshStandardMaterial({color:t.col, emissive:t.col, emissiveIntensity:0.35})); pole.position.set(t.to[0],17,t.to[1]); G.add(pole);
  const lb=makeLabel(t.name+'  '+t.real, 13, '#'+t.col.toString(16).padStart(6,'0')); lb.position.set(t.to[0],74,t.to[1]); G.add(lb);
  const lb2=makeLabel(t.via+' ・ モデル区間 '+(total/1000).toFixed(1)+'km（'+(t.snapped?'路線スナップ':'直線')+'）', 8.5, '#c8cede'); lb2.position.set(t.to[0],56,t.to[1]); G.add(lb2);
});
const hub=new THREE.Mesh(new THREE.CylinderGeometry(16,16,3,24), new THREE.MeshBasicMaterial({color:0xf5c400, transparent:true, opacity:0.55})); hub.position.set(SX,1.2,SZ); G.add(hub);

let last=performance.now();
const baseLoop18=loop;
loop=function(now){
  baseLoop18(now);
  const dt=Math.min(0.1,(now-last)/1000); last=now;
  if(oldGroup) oldGroup.visible=false;   /* 基底のトグルが再表示しても旧レイヤーは隠す */
  G.visible=on(); if(!G.visible) return;
  chevrons.forEach(c=>{ c.u+=dt*46/c.t.L; if(c.u>=1) c.u-=1; const s=at(c.t.path, c.u*c.t.L); c.m.position.set(s[0],6,s[1]); c.m.quaternion.setFromUnitVectors(UP, new THREE.Vector3(s[2],0,s[3]).normalize()); });
  vehicles.forEach(v=>{ v.d+=v.v*dt; if(v.d>v.t.L) v.d=0; const s=at(v.t.path, v.d); v.m.position.set(s[0],0,s[1]); v.m.quaternion.setFromUnitVectors(FX, new THREE.Vector3(s[2],0,s[3]).normalize()); });
};
const baseRenderPanel18=renderPanel;
renderPanel=function(){
  baseRenderPanel18();
  const sec=document.getElementById('tour-sec'); if(!sec) return;
  sec.insertAdjacentHTML('beforeend', '<div class="sec-t" style="margin-top:8px">路線スナップ結果（モデル区間）</div><div class="tf-tbl"><table><tr><th>方面</th><th>モード</th><th>区間</th><th>区間時間</th><th>実所要</th></tr>'
    +TOURS.map(t=>'<tr><td>'+t.name+'</td><td>'+({rail:'鉄道',bus:'バス',car:'車'})[t.mode]+'</td><td>'+(t.dist/1000).toFixed(1)+'km</td><td>'+Math.round(t.mins)+'分</td><td>'+t.real+'</td></tr>').join('')+'</table></div>'
    +'<div class="hint" style="margin-top:6px">鉄道はrailJR、バス/車は道路網に最短経路でスナップ（データ圏外は薄い直線）。区間時間＝モデル区間距離÷表定速度（鉄道62/バス28/車38 km/h）、実所要＝公表値の目安。経由地マーカーは経路上の概略位置。</div>');
};
window.__tourFine={TOURS, group:G};
})();
