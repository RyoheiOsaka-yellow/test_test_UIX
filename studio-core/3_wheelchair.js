/* ───────── design data: アクティブ車椅子 (リジッドフレーム) ───────── */
const MATERIALS={
  'アルミ 7005':{d:2.78,cls:'metal'},'アルミ 6061':{d:2.70,cls:'metal'},'チタン Ti-6Al-4V':{d:4.43,cls:'metal'},'SUS304':{d:7.93,cls:'metal'},
  'CFRP':{d:1.55,cls:'composite'},'ナイロン 66':{d:1.14,cls:'plastic'},'ABS':{d:1.05,cls:'plastic'},'ポリウレタン (ソリッド)':{d:1.20,cls:'elastomer'},
  'タイヤ (空気入り 相当)':{d:0.45,cls:'elastomer'},'ゴム (グリップ)':{d:1.10,cls:'elastomer'},'ポリエステル布':{d:0.60,cls:'textile'},'ウレタンフォーム':{d:0.06,cls:'foam'}
};
const GROUPS=[
  {id:'A1',name:'駆動輪 Assy',color:'#3aa0d8'},
  {id:'A2',name:'フレーム Assy',color:'#e39b2c'},
  {id:'A3',name:'シート Assy',color:'#8b5cd6'},
  {id:'A4',name:'走行安全部品',color:'#3fae6a'}
];
const DEFAULT_PARAMS={seatWidth:400,seatDepth:420,seatHeightF:480,seatHeightR:440,wheelInch:24,camber:3,backH:380,casterInch:5,axleOffset:0};
const PARAM_DEFS=[
  {k:'seatWidth',label:'座幅',unit:'mm',min:340,max:480,step:10},
  {k:'seatDepth',label:'座奥行',unit:'mm',min:360,max:480,step:10},
  {k:'seatHeightF',label:'前座高',unit:'mm',min:430,max:530,step:5},
  {k:'seatHeightR',label:'後座高',unit:'mm',min:380,max:500,step:5},
  {k:'wheelInch',label:'駆動輪径',unit:'inch',min:20,max:26,step:1},
  {k:'camber',label:'キャンバー角',unit:'°',min:0,max:12,step:0.5},
  {k:'backH',label:'バックレスト高',unit:'mm',min:280,max:460,step:10},
  {k:'casterInch',label:'キャスター径',unit:'inch',min:3,max:6,step:1},
  {k:'axleOffset',label:'アクスル前後位置',unit:'mm',min:-60,max:60,step:5}
];
const TARGETS=[
  {k:'mass',label:'総質量',unit:'g',op:'≤',target:12000},
  {k:'width',label:'全幅 (JIS T 9201)',unit:'mm',op:'≤',target:700},
  {k:'length',label:'全長 (JIS T 9201)',unit:'mm',op:'≤',target:1200},
  {k:'height',label:'全高 (JIS T 9201)',unit:'mm',op:'≤',target:1200},
  {k:'turn',label:'回転円直径',unit:'mm',op:'≤',target:1500},
  {k:'dump',label:'シートダンプ (前後差)',unit:'mm',op:'≤',target:80}
];
const RO=16,RI=14.2; // frame tube φ32 t1.8
const S=[1,-1];
function frameMeshes(c){
  const m=[];const {zr,xf,xr,shf,shr,ax,Rw,cx,cz,cr,sw}=c;
  for(const s of S){
    const railF=V3(xf,shf,s*zr),railR=V3(xr,shr,s*zr),cTop=V3(cx,200,s*cz),cBot=V3(cx,cr+55,s*cz),hang=V3(xf+150,135,s*(sw/2-45)),rearB=V3(ax,Rw+25,s*(zr+10));
    m.push(tube(railF,railR,RO,RI),tube(railF,cTop,RO,RI),tube(cTop,cBot,19,RO),tube(railF,hang,RO,RI),tube(railR,rearB,RO,RI),joint(railF,RO),joint(railR,RO),joint(cTop,RO),joint(hang,RO),joint(rearB,RO));
  }
  m.push(tube(V3(ax,Rw+25,-(zr+10)),V3(ax,Rw+25,zr+10),RO,RI)); // camber tube
  const yAt=x=>shr+(shf-shr)*(x-xr)/(xf-xr);
  for(const x of [xr+50,xf-70])m.push(tube(V3(x,yAt(x)-2,-zr),V3(x,yAt(x)-2,zr),13,11)); // cross bars
  m.push(tube(V3(xf+160,120,-(sw/2-45)),V3(xf+160,120,sw/2-45),13,11)); // footrest cross bar
  return m;
}
const PART_DEFS=[
  {id:'P-301',seq:1,tool:'手作業 (面ファスナー)',name:'シートクッション',en:'Seat Cushion (contoured foam)',group:'A3',mat:'ウレタンフォーム',mb:'buy',color:'#26282c',qty:1,
    build:c=>({pos:c.seatMid.clone().add(V3(0,34,0)),quat:rotZ(c.slope),explode:V3(0,300,0),meshes:[{g:box(c.p.seatDepth-30,50,c.sw-10)},{g:box(c.p.seatDepth-60,14,c.sw-40),pos:[0,32,0]}]})},
  {id:'P-103',seq:2,tool:'QR ボタン押下',name:'クイックリリースアクスル',en:'Quick-release Axle 1/2"',group:'A1',mat:'チタン Ti-6Al-4V',mb:'buy',color:'#c7cdd6',qty:2,qtyInGeom:true,
    build:c=>({pos:V3(c.ax,c.Rw,0),explode:V3(0,0,0),meshes:S.flatMap(s=>[{g:cyl(5.5,5.5,150,16),quat:rotX(Math.PI/2),pos:[0,0,s*(c.zw-12)],ex:[0,0,s*760]},{g:sphere(7.5,16),pos:[0,0,s*(c.zw+63)],ex:[0,0,s*760]}])})},
  {id:'P-101',seq:3,tool:'手作業',name:'駆動輪 リム/スポーク/ハブ',en:`Drive Wheel (rim, 24 spokes, hub)`,group:'A1',mat:'アルミ 6061',mb:'buy',color:'#1f2226',qty:2,qtyInGeom:true,
    build:c=>{const m=[];const Rr=c.Rw-24;for(const s of S){const qc=rotX(-s*c.cam);const z=s*c.zw;const ex=[0,0,s*380];
      m.push({g:new THREE.TorusGeometry(Rr,6,10,96),quat:qc,pos:[0,0,z],ex});
      m.push({g:lathe([V2(22,-30),V2(30,-30),V2(30,30),V2(22,30),V2(22,-30)],32),quat:qc.clone().multiply(rotX(Math.PI/2)),pos:[0,0,z],ex});
      const cm=(30+Rr)/2,L=Rr-32;for(let i=0;i<24;i++){const a=i/24*Math.PI*2;const off=V3(Math.cos(a)*cm,Math.sin(a)*cm,(i%2?7:-7)).applyQuaternion(qc);m.push({g:cyl(1.2,1.2,L,6),quat:qc.clone().multiply(rotZ(a-Math.PI/2)),pos:[off.x,off.y,z+off.z],ex});}}
      return {pos:V3(c.ax,c.Rw,0),explode:V3(0,0,0),meshes:m};}},
  {id:'P-104',seq:4,tool:'タイヤレバー',name:'タイヤ 24×1',en:'Tire 24×1" (pneumatic)',group:'A1',mat:'タイヤ (空気入り 相当)',mb:'buy',color:'#34373d',qty:2,qtyInGeom:true,
    build:c=>({pos:V3(c.ax,c.Rw,0),explode:V3(0,0,0),meshes:S.map(s=>({g:new THREE.TorusGeometry(c.Rw-14,14,18,128),quat:rotX(-s*c.cam),pos:[0,0,s*c.zw],ex:[0,0,s*520]}))})},
  {id:'P-102',seq:5,tool:'六角レンチ 4 mm',name:'ハンドリム',en:'Handrim (anodized)',group:'A1',mat:'アルミ 6061',mb:'buy',color:'#2e3238',qty:2,qtyInGeom:true,
    build:c=>({pos:V3(c.ax,c.Rw,0),explode:V3(0,0,0),meshes:S.map(s=>{const r=c.Rw-52;return {g:new THREE.TorusGeometry(r,8,14,96),quat:rotX(-s*c.cam),pos:[0,0,s*(c.zw+36)],ex:[0,0,s*640],vol:2*Math.PI*r*Math.PI*(64-42)};})})},
  {id:'P-402',seq:6,tool:'六角レンチ 5 mm',name:'転倒防止バー',en:'Anti-tip Bar',group:'A4',mat:'アルミ 6061',mb:'make',color:'#3a3e45',qty:2,qtyInGeom:true,
    build:c=>({pos:V3(0,0,0),explode:V3(0,0,0),meshes:S.flatMap(s=>{const z=s*(c.zr+10);const a=V3(c.ax-8,c.Rw-30,z),b=V3(c.ax-185,70,z);return [Object.assign(tube(a,b,10,8.4),{ex:[-320,0,s*40]}),{g:cyl(24,24,18,28),quat:rotX(Math.PI/2),pos:[c.ax-200,24,z],ex:[-320,0,s*40]}];})})},
  {id:'P-401',seq:7,tool:'六角レンチ 5 mm',name:'ホイールロック',en:'Wheel Lock (push-to-lock)',group:'A4',mat:'アルミ 6061',mb:'buy',color:'#2b2e34',qty:2,qtyInGeom:true,
    build:c=>({pos:V3(0,0,0),explode:V3(0,0,0),meshes:S.flatMap(s=>{const z=s*(c.zr+40);const mnt=V3(c.ax+175,c.Rw+55,z);return [{g:box(40,26,28),pos:mnt.toArray(),ex:[130,120,s*60]},Object.assign(tube(mnt,V3(c.ax+235,c.Rw+180,z),5),{ex:[130,120,s*60]}),{g:cyl(9,9,30,16),quat:yTo(V3(60,125,0)),pos:[c.ax+240,c.Rw+190,z],ex:[130,120,s*60]}];})})},
  {id:'P-207',seq:8,tool:'手作業 (QR レバー)',name:'プッシュハンドル',en:'Push Handle (removable)',group:'A2',mat:'アルミ 6061',mb:'make',color:'#33363c',qty:2,qtyInGeom:true,
    build:c=>({pos:V3(0,0,0),explode:V3(0,0,0),meshes:S.flatMap(s=>{const z=s*c.zr;const top=V3(c.xr-40,c.shr+c.p.backH,z);return [Object.assign(tube(top,V3(c.xr-135,c.shr+c.p.backH+8,z),14,12),{ex:[-420,220,0]}),{g:cyl(16,16,90,20),quat:yTo(V3(-1,0.08,0)),pos:[c.xr-112,c.shr+c.p.backH+6,z],ex:[-420,220,0]}];})})},
  {id:'P-302',seq:9,tool:'手作業 (面ファスナー)',name:'バックレスト張地',en:'Backrest Upholstery (tension adjustable)',group:'A3',mat:'ポリエステル布',mb:'buy',color:'#2b2e33',qty:1,
    build:c=>({pos:V3(c.xr-28,c.shr+c.p.backH*0.52,0),quat:rotZ(0.1),explode:V3(-170,120,0),meshes:[{g:box(4,c.p.backH-90,c.sw+16)},{g:box(3,c.p.backH-130,c.sw-30),pos:[3.5,0,0]}]})},
  {id:'P-203',seq:10,tool:'手作業 (折りたたみヒンジ)',name:'バックレストフレーム',en:'Folding Backrest Frame',group:'A2',mat:'アルミ 7005',mb:'make',color:'#2a2d33',qty:1,
    build:c=>{const m=[];const bh=c.p.backH;for(const s of S){const z=s*c.zr;const b0=V3(c.xr-12,c.shr,z),b1=V3(c.xr-40,c.shr+bh,z);m.push(tube(b0,b1,14,12.2),joint(b1,14),{g:cyl(18,18,28,24),quat:rotX(Math.PI/2),pos:[c.xr-12,c.shr+8,z]});}
      m.push(tube(V3(c.xr-40,c.shr+bh,-c.zr),V3(c.xr-40,c.shr+bh,c.zr),12,10.2));return {pos:V3(0,0,0),explode:V3(-270,170,0),meshes:m};}},
  {id:'P-208',seq:11,tool:'六角レンチ 4 mm',name:'サイドガード',en:'Side Guard (clothing guard)',group:'A2',mat:'CFRP',mb:'buy',color:'#1c1e22',qty:2,qtyInGeom:true,
    build:c=>({pos:V3(0,0,0),explode:V3(0,0,0),meshes:S.map(s=>({g:box(250,175,3),pos:[c.ax+40,c.shr+65,s*(c.zr+32)],ex:[0,230,s*70]}))})},
  {id:'P-303',seq:12,tool:'六角レンチ 3 mm',name:'シートスリング',en:'Seat Sling (tension adjustable)',group:'A3',mat:'ポリエステル布',mb:'buy',color:'#232529',qty:1,
    build:c=>({pos:c.seatMid.clone().add(V3(0,4,0)),quat:rotZ(c.slope),explode:V3(0,180,0),meshes:[{g:box(c.p.seatDepth-40,3,c.sw+24)}]})},
  {id:'P-206',seq:13,tool:'六角レンチ 5 mm',name:'フットプレート',en:'Footplate (one-piece, angle adjustable)',group:'A2',mat:'アルミ 6061',mb:'make',color:'#2f3237',qty:1,
    build:c=>({pos:V3(c.xf+178,102,0),quat:rotZ(-0.17),explode:V3(230,-40,0),meshes:[{g:box(150,4,c.sw-70)},{g:box(150,10,4),pos:[0,7,(c.sw-70)/2-2]},{g:box(150,10,4),pos:[0,7,-(c.sw-70)/2+2]}]})},
  {id:'P-205',seq:14,tool:'六角レンチ 5 mm',name:'キャスター 5"',en:'Caster 5" (PU solid)',group:'A2',mat:'ポリウレタン (ソリッド)',mb:'buy',color:'#1a1c20',qty:2,qtyInGeom:true,
    build:c=>({pos:V3(0,0,0),explode:V3(0,0,0),meshes:S.flatMap(s=>{const z=s*c.cz;return [{g:cyl(c.cr,c.cr,22,40),quat:rotX(Math.PI/2),pos:[c.cx+24,c.cr,z],ex:[200,-110,s*150]},{g:cyl(11,11,28,20),quat:rotX(Math.PI/2),pos:[c.cx+24,c.cr,z],ex:[200,-110,s*150]}];})})},
  {id:'P-204',seq:15,tool:'スパナ 13 mm',name:'キャスターフォーク',en:'Caster Fork (aluminium)',group:'A2',mat:'アルミ 6061',mb:'buy',color:'#2b2e34',qty:2,qtyInGeom:true,
    build:c=>({pos:V3(0,0,0),explode:V3(0,0,0),meshes:S.flatMap(s=>{const z=s*c.cz;const ex=[150,-30,s*90];return [{g:cyl(8,8,80,14),pos:[c.cx,c.cr+92,z],ex},{g:box(36,12,50),pos:[c.cx+6,c.cr+44,z],ex},{g:box(12,c.cr+30,6),pos:[c.cx+14,c.cr+18,z+17],quat:rotZ(0.32),ex},{g:box(12,c.cr+30,6),pos:[c.cx+14,c.cr+18,z-17],quat:rotZ(0.32),ex}];})})},
  {id:'P-202',seq:16,tool:'六角レンチ 6 mm',name:'アクスルプレート',en:'Axle Plate (camber adjust)',group:'A2',mat:'アルミ 7005',mb:'make',color:'#33363c',qty:2,qtyInGeom:true,
    build:c=>({pos:V3(0,0,0),explode:V3(0,0,0),meshes:S.flatMap(s=>{const z=s*(c.zr+24);return [{g:box(64,112,8),pos:[c.ax,c.Rw+8,z],ex:[0,-160,s*90]},{g:cyl(12,12,44,20),quat:rotX(Math.PI/2),pos:[c.ax,c.Rw,z+s*10],ex:[0,-160,s*90]}];})})},
  {id:'P-201',seq:17,tool:'—',name:'メインフレーム (リジッド)',en:'Rigid Main Frame φ32 t1.8',group:'A2',mat:'アルミ 7005',mb:'make',color:'#25282d',qty:1,shell:true,
    build:c=>({pos:V3(0,0,0),explode:V3(0,0,0),meshes:frameMeshes(c)})}
];
const N_STEPS=PART_DEFS.length;
const PRODUCT={
  mark:'WC',name:'Wheelchair Assembly Studio',tag:'· アクティブ車椅子 3D 分解 / 設計ダッシュボード',crumbA:'Wheelchair_Product.1',crumbB:'ActiveChair Assy.1',rev:'WC-2026-A · rev 01',assy:'ActiveChair Assy',assyInst:'ActiveChair Assy.1',
  hasLed:false,groundY:0,logo:false,ambient:0.55,keyLight:1.25,
  makeCtx(p){const sw=p.seatWidth,sd=p.seatDepth,shf=p.seatHeightF,shr=p.seatHeightR;const Rw=p.wheelInch*25.4/2,cr=p.casterInch*25.4/2;
    const zr=sw/2+12,xf=sd/2,xr=-sd/2,ax=-sd/2+45+p.axleOffset,zw=sw/2+76,cx=xf+70,cz=sw/2-32,cam=THREE.MathUtils.degToRad(p.camber);
    return {p,sw,sd,shf,shr,Rw,cr,zr,xf,xr,ax,zw,cx,cz,cam,seatMid:V3(0,(shf+shr)/2,0),slope:Math.atan2(shf-shr,sd),center:V3(0,(shf+shr)/2,0)};},
  results(ctx,box,groupMass,total){const s=box.getSize(V3());const front=box.max.x-ctx.ax;return {mass:total,width:s.z,length:s.x,height:s.y,turn:2*Math.hypot(front,s.z/2),dump:ctx.shf-ctx.shr};},
  optimizeStep(p){if(p.backH>300){p.backH-=10;return true;}if(p.seatDepth>380){p.seatDepth-=10;return true;}if(p.casterInch>4){p.casterInch-=1;return true;}return false;},
  nested:['P-101|P-103','P-101|P-104','P-101|P-102','P-103|P-104','P-102|P-104','P-101|P-202','P-103|P-202','P-201|P-202','P-201|P-203','P-201|P-204','P-201|P-206','P-201|P-303','P-201|P-301','P-201|P-402','P-201|P-401','P-203|P-207','P-203|P-302','P-204|P-205','P-301|P-303','P-201|P-208','P-202|P-208','P-201|P-302','P-203|P-303','P-203|P-301','P-101|P-208','P-104|P-208','P-402|P-202','P-101|P-402','P-104|P-402','P-101|P-401','P-104|P-401','P-102|P-401','P-303|P-302','P-301|P-302'],
  sets:[
    {name:'駆動系 (Drive)',color:'#3aa0d8',pred:d=>d.group==='A1'},
    {name:'フレーム構造材',color:'#e39b2c',pred:d=>['P-201','P-202','P-203','P-207'].includes(d.id)},
    {name:'シート / 張地',color:'#8b5cd6',pred:d=>d.group==='A3'},
    {name:'走行安全部品',color:'#3fae6a',pred:d=>d.group==='A4'},
    {name:'購入品 (Buy)',color:'#3b7dd8',pred:(d,st)=>st.mb==='buy'},
    {name:'自製品 (Make)',color:'#3fae5c',pred:(d,st)=>st.mb==='make'},
    {name:'工具不要で外せる部品',color:'#6b6f7a',pred:(d,st)=>/手作業|QR/.test(st.tool)}
  ],
  hints:'ヒント: ▶ で分解再生（クッション → QR アクスル → 駆動輪 …）。JIS T 9201 の寸法目標は「パラメータ」タブで確認できます。'
};
