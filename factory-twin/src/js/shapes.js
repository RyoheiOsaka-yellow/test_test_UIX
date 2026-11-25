// ================= 設備形状（現地写真ベース・実寸メートル） =================
// 写真の特徴: ステンレスの開放タンク＋分割フタ、若草色の機械塗装、支柱式ディスパー（アーム＋モーター＋シャフト）、
// キャスター付きの可搬タンク、計量台つきデジタル充填機。寸法の平面外形は図面、細部と高さは仮定。
const SH_PAINTS=[0xdfe3e8,0x8a8f98,0xc79a1e,0x2f6db3,0x7a3030,0x2c5b3f,0xd9c9a0,0x4a4f58];
const shMat={
  steel:()=>new THREE.MeshStandardMaterial({color:0xcfd4d6,metalness:.82,roughness:.32,side:THREE.DoubleSide}),
  steelDull:()=>new THREE.MeshStandardMaterial({color:0xb4babc,metalness:.6,roughness:.55}),
  green:()=>new THREE.MeshStandardMaterial({color:0x9fc7a4,metalness:.15,roughness:.6}),
  greenDark:()=>new THREE.MeshStandardMaterial({color:0x4d8a6c,metalness:.2,roughness:.55}),
  dark:()=>new THREE.MeshStandardMaterial({color:0x2c3136,metalness:.4,roughness:.6}),
  paint:c=>new THREE.MeshStandardMaterial({color:c,roughness:.25,metalness:.05}),
  red:()=>new THREE.MeshStandardMaterial({color:0xc8372d,roughness:.5}),
  yellow:()=>new THREE.MeshStandardMaterial({color:0xe2c23a,roughness:.6}),
};
function shAdd(g,geo,mat,x=0,y=0,z=0){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);g.add(m);return m;}
function shPaintOf(it){const k=Math.abs(Math.round(it.x*7.3+it.z*13.1))%SH_PAINTS.length;return SH_PAINTS[k];}
function shSplatter(g,r,y0,h,col,seed){   // 塗料の垂れ・飛沫
  const rng=sRand(seed);for(let i=0;i<7;i++){const a=rng()*6.28,len=.12+rng()*h*.45;const d=shAdd(g,new THREE.BoxGeometry(.03+rng()*.05,len,.012),shMat.paint(col),Math.cos(a)*(r+.006),y0+h-len/2-rng()*.1,Math.sin(a)*(r+.006));d.rotation.y=-a+Math.PI/2;}
}
// 開放タンク（架台を貫通。上端がデッキ面の少し上）
function shTank(it){
  const g=new THREE.Group(),r=Math.min(it.w,it.d)/2,H=it.h,legH=.75,coneH=.32,y0=legH+coneH,bodyH=H-y0,col=shPaintOf(it),st=shMat.steel();
  for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;shAdd(g,new THREE.CylinderGeometry(.04,.04,legH+coneH*.6,8),shMat.steelDull(),Math.cos(a)*r*.82,(legH+coneH*.6)/2,Math.sin(a)*r*.82);shAdd(g,new THREE.BoxGeometry(.16,.02,.16),shMat.dark(),Math.cos(a)*r*.82,.01,Math.sin(a)*r*.82);}
  shAdd(g,new THREE.CylinderGeometry(r,.1,coneH,40,1,true),st,0,legH+coneH/2,0);
  shAdd(g,new THREE.CylinderGeometry(r,r,bodyH,40,1,true),st,0,y0+bodyH/2,0);
  for(const f of [.25,.62])shAdd(g,new THREE.TorusGeometry(r+.012,.014,6,40),shMat.steelDull(),0,y0+bodyH*f,0).rotation.x=Math.PI/2;
  shAdd(g,new THREE.TorusGeometry(r,.025,8,40),st,0,H,0).rotation.x=Math.PI/2;
  const liq=shAdd(g,new THREE.CircleGeometry(r*.97,40),shMat.paint(col),0,H-.38-(Math.abs(Math.round(it.x*3))%4)*.12,0);liq.rotation.x=-Math.PI/2;spinDiscs.push(liq);
  // 分割フタ（半分は閉、片側は開けて立て掛け）
  const lid=shAdd(g,new THREE.CircleGeometry(r*1.02,24,0,Math.PI),shMat.steelDull(),0,H+.03,0);lid.rotation.x=-Math.PI/2;lid.material.side=THREE.DoubleSide;
  const lid2=shAdd(g,new THREE.CircleGeometry(r*1.02,16,Math.PI,Math.PI*.5),shMat.steelDull(),0,H+.03,0);lid2.rotation.x=-Math.PI/2+.55;lid2.material.side=THREE.DoubleSide;
  shAdd(g,new THREE.BoxGeometry(.14,.03,.05),shMat.dark(),r*.5,H+.06,-r*.3);
  // 底部排出バルブ
  shAdd(g,new THREE.CylinderGeometry(.045,.045,.3,10),shMat.steelDull(),0,legH-.1,0);
  const pipe=shAdd(g,new THREE.CylinderGeometry(.04,.04,r*.9,10),shMat.steelDull(),r*.45,legH-.22,0);pipe.rotation.z=Math.PI/2;
  shAdd(g,new THREE.BoxGeometry(.18,.03,.04),shMat.red(),r*.9,legH-.14,0);
  shSplatter(g,r,y0,bodyH,col,it.assetId);
  return g;
}
// 支柱式ディスパー（旋回アームで周囲のタンクを攪拌）。target=[dx,dz] シャフトを下ろす相対位置
function shDisper(it,target,deck){
  const g=new THREE.Group(),H=it.h,base=deck?DRAW_DECK_H:0,gr=shMat.green();
  if(deck)shAdd(g,new THREE.CylinderGeometry(.09,.09,base,10),shMat.steelDull(),0,base/2,0);       // デッキ下の支柱
  shAdd(g,new THREE.BoxGeometry(.5,.06,.5),shMat.dark(),0,base+.03,0);
  shAdd(g,new THREE.BoxGeometry(.26,H-base-.2,.26),gr,0,base+(H-base-.2)/2,0);                      // 昇降ポスト
  shAdd(g,new THREE.CylinderGeometry(.06,.06,(H-base)*.55,10),shMat.steel(),0,base+(H-base)*.62,.17); // 油圧シリンダ
  const cb=shAdd(g,new THREE.BoxGeometry(.3,.4,.14),shMat.steelDull(),-.2,base+1.15,0);               // 操作盤
  shAdd(g,new THREE.BoxGeometry(.05,.05,.02),shMat.red(),-.2,base+1.25,.08);shAdd(g,new THREE.BoxGeometry(.05,.05,.02),new THREE.MeshStandardMaterial({color:0x3fae5a}),-.12,base+1.25,.08);
  const [dx,dz]=target,L=Math.max(.35,Math.hypot(dx,dz)),ang=Math.atan2(dx,dz),arm=new THREE.Group();arm.position.y=H-.3;arm.rotation.y=ang;g.add(arm);
  shAdd(arm,new THREE.BoxGeometry(.2,.24,L+.25),gr,0,0,L/2);
  shAdd(arm,new THREE.BoxGeometry(.34,.3,.4),shMat.greenDark(),0,.02,L);                              // ギヤケース
  const motor=shAdd(arm,new THREE.CylinderGeometry(.17,.17,.55,16),shMat.greenDark(),0,.42,L);
  for(let i=0;i<8;i++)shAdd(arm,new THREE.BoxGeometry(.012,.5,.03),shMat.green(),Math.cos(i*.785)*.175,.42,L+Math.sin(i*.785)*.175);   // 冷却フィン
  shAdd(arm,new THREE.CylinderGeometry(.1,.1,.06,12),shMat.dark(),0,.72,L);
  const sl=Math.min(1.7,H-base-.9+(deck?1.0:0)-(deck?0:.35));
  shAdd(arm,new THREE.CylinderGeometry(.028,.028,sl,8),shMat.steel(),0,-.12-sl/2,L);
  const disc=shAdd(arm,new THREE.CylinderGeometry(.15,.15,.025,14),shMat.steel(),0,-.12-sl,L);spinDiscs.push(disc);
  for(let i=0;i<8;i++){const t=shAdd(disc,new THREE.BoxGeometry(.03,.05,.012),shMat.steel(),Math.cos(i*.785)*.15,i%2?.03:-.03,Math.sin(i*.785)*.15);t.rotation.y=-i*.785;}
  return g;
}
// 床置きディスパー＋可搬の缶釜
function shFloorDisper(it){
  const d=it.d,g=shDisper({...it},[0,d*.38],false);
  for(const o of g.children)o.position.z-=d*.3;
  const r=Math.min(it.w*.42,.42),py=.16,ph=Math.min(.8,it.h*.32),col=shPaintOf(it),z=d*.08;
  shAdd(g,new THREE.BoxGeometry(r*2.1,.05,r*2.1),shMat.dark(),0,py-.03,z);
  for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]])shAdd(g,new THREE.CylinderGeometry(.05,.05,.04,8),shMat.dark(),sx*r*.85,.05,z+sz*r*.85).rotation.z=Math.PI/2;
  shAdd(g,new THREE.CylinderGeometry(r,r*.94,ph,28,1,true),shMat.steel(),0,py+ph/2,z);
  shAdd(g,new THREE.CircleGeometry(r*.94,28),shMat.steelDull(),0,py+.005,z).rotation.x=-Math.PI/2;
  const liq=shAdd(g,new THREE.CircleGeometry(r*.96,28),shMat.paint(col),0,py+ph*.72,z);liq.rotation.x=-Math.PI/2;spinDiscs.push(liq);
  shAdd(g,new THREE.TorusGeometry(r,.016,6,28),shMat.steel(),0,py+ph,z).rotation.x=Math.PI/2;
  shSplatter(g,r,py,ph,col,it.assetId+'k');
  return g;
}
// 可搬タンク（キャスター付きステンレス槽）
function shPortTank(it){
  const g=new THREE.Group(),r=Math.min(it.w,it.d)*.46,h=it.h*.82,col=shPaintOf(it);
  shAdd(g,new THREE.BoxGeometry(r*2,.05,r*2),shMat.dark(),0,.13,0);
  for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]){const c=shAdd(g,new THREE.CylinderGeometry(.055,.055,.04,10),shMat.dark(),sx*r*.85,.055,sz*r*.85);c.rotation.z=Math.PI/2;}
  shAdd(g,new THREE.CylinderGeometry(r,r*.95,h,32,1,true),shMat.steel(),0,.16+h/2,0);
  shAdd(g,new THREE.CircleGeometry(r*.95,32),shMat.steelDull(),0,.17,0).rotation.x=-Math.PI/2;
  shAdd(g,new THREE.TorusGeometry(r,.018,6,32),shMat.steel(),0,.16+h,0).rotation.x=Math.PI/2;
  const liq=shAdd(g,new THREE.CircleGeometry(r*.97,32),shMat.paint(col),0,.16+h*.7,0);liq.rotation.x=-Math.PI/2;
  for(const s of [-1,1]){const hd=shAdd(g,new THREE.TorusGeometry(.07,.012,6,12,Math.PI),shMat.steelDull(),s*(r+.01),.16+h*.8,0);hd.rotation.y=Math.PI/2;}
  shSplatter(g,r,.16,h,col,it.assetId);
  return g;
}
// デジタル充填機（計量台＋ノズル＋操作盤＋ローラー）
function shFill(it){
  const g=new THREE.Group(),w=it.w,d=it.d,H=it.h;
  shAdd(g,new THREE.BoxGeometry(w*.8,.12,d*.55),shMat.steelDull(),0,.36,d*.1);                                   // 計量台
  for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]])shAdd(g,new THREE.BoxGeometry(.05,.3,.05),shMat.dark(),sx*w*.36,.15,d*.1+sz*d*.24);
  for(let i=0;i<6;i++)shAdd(g,new THREE.CylinderGeometry(.025,.025,w*.7,8),shMat.steel(),0,.44,d*.1-d*.22+i*d*.088).rotation.z=Math.PI/2;   // ローラー
  shAdd(g,new THREE.BoxGeometry(.12,H,.12),shMat.green(),-w*.3,H/2,-d*.38);                                       // 支柱
  shAdd(g,new THREE.BoxGeometry(w*.55,.14,.16),shMat.green(),-w*.05,H-.12,-d*.38);
  shAdd(g,new THREE.CylinderGeometry(.035,.02,.5,10),shMat.steel(),w*.12,H-.42,-d*.38+.0).position.z=d*.1-.02;   // ノズル
  shAdd(g,new THREE.CylinderGeometry(.03,.03,d*.45,8),shMat.steelDull(),w*.12,H-.15,-d*.14).rotation.x=Math.PI/2;
  const panel=shAdd(g,new THREE.BoxGeometry(.34,.3,.1),shMat.steelDull(),w*.3,1.25,-d*.4);
  const scr=shAdd(g,new THREE.PlaneGeometry(.24,.12),new THREE.MeshStandardMaterial({color:0x1b3a2a,emissive:0x35d07f,emissiveIntensity:.7}),w*.3,1.3,-d*.4+.052);
  shAdd(g,new THREE.BoxGeometry(.05,1.1,.05),shMat.dark(),w*.3,.6,-d*.4);
  shAdd(g,new THREE.BoxGeometry(.24,.35,.24),shMat.steel(),w*.12,.47+.175,d*.1);                                   // 18L缶（充填中）
  for(let i=0;i<2;i++)shAdd(g,new THREE.BoxGeometry(.24,.35,.24),shMat.steel(),-w*.2+i*.27,.47+.175,d*.38);       // 充填待ち
  return g;
}
function twinShape(it,ic){
  let g=null;
  if(it.proc==='TNK') g=shTank(it);
  else if(it.proc==='PTK') g=shPortTank(it);
  else if(it.proc==='DSP'&&it.noOcc){   // 架台上の旋回ディスパー: 最寄りのタンクへアームを向ける
    const near=ic.items.filter(o=>o.proc==='TNK').map(o=>[o,Math.hypot(o.x-it.x,o.z-it.z)]).sort((a,b)=>a[1]-b[1])[0];
    g=shDisper(it,near&&near[1]<2.6?[near[0].x-it.x,near[0].z-it.z]:[.6,.4],true);
  }
  else if(it.proc==='DSP') g=shFloorDisper(it);
  else if(it.proc==='FIL'&&it.w<1.9) g=shFill(it);
  if(!g) return null;
  const root=new THREE.Group();root.add(g);root.userData.v3Base=g;return root;
}
