/* ───────── design data ───────── */
const MATERIALS={
  'ABS':{d:1.05,cls:'plastic'},'PC':{d:1.20,cls:'plastic'},'PP':{d:0.91,cls:'plastic'},'PET':{d:1.38,cls:'plastic'},'PTFE':{d:2.20,cls:'plastic'},
  'シリコーン':{d:1.15,cls:'elastomer'},'NBR':{d:1.20,cls:'elastomer'},'FR-4':{d:1.85,cls:'electronic'},
  'アルミ A5052':{d:2.68,cls:'metal'},'SUS304':{d:7.93,cls:'metal'},'ホウケイ酸ガラス':{d:2.23,cls:'glass'},
  'Tenax TA':{d:0.25,cls:'sorbent'},'Li-ion セル':{d:2.55,cls:'electronic'}
};
const GROUPS=[
  {id:'A1',name:'サンプリングヘッド Assy',color:'#3aa0d8'},
  {id:'A2',name:'ハウジング Assy',color:'#e39b2c'},
  {id:'A3',name:'内部ユニット Assy',color:'#8b5cd6'},
  {id:'A4',name:'ベース Assy',color:'#3fae6a'}
];
const DEFAULT_PARAMS={nozzleAngle:40,mouthLen:60,bodyR:60,bodyDepth:70,ringW:40,ledHue:68,ledPower:1.1,baseH:12};
const PARAM_DEFS=[
  {k:'nozzleAngle',label:'ノズル角度',unit:'°',min:15,max:65,step:1},
  {k:'mouthLen',label:'マウスピース長',unit:'mm',min:40,max:95,step:1},
  {k:'bodyR',label:'ボディ半径',unit:'mm',min:48,max:72,step:0.5},
  {k:'bodyDepth',label:'ボディ奥行',unit:'mm',min:50,max:90,step:1},
  {k:'ringW',label:'カップリング幅',unit:'mm',min:28,max:56,step:1},
  {k:'baseH',label:'ベース厚',unit:'mm',min:8,max:20,step:0.5},
  {k:'ledHue',label:'LED 色相',unit:'°',min:0,max:360,step:1}
];
const TARGETS=[
  {k:'mass',label:'総質量',unit:'g',op:'≤',target:600},
  {k:'length',label:'全長 (X)',unit:'mm',op:'≤',target:250},
  {k:'height',label:'全高 (Y)',unit:'mm',op:'≤',target:200},
  {k:'headMass',label:'ヘッド Assy 質量',unit:'g',op:'≤',target:150}
];

/* part definitions — seq: 分解手順の順番, tool: 工具 */
const PART_DEFS=[
  {id:'P-101',seq:1,tool:'手作業',name:'マウスピース',en:'Mouthpiece',group:'A1',mat:'PP',mb:'buy',color:'#f4f5f7',qty:1,shell:true,
    build:c=>{const L=c.p.mouthLen;const pts=[V2(10,-L/2),V2(16,-L/2),V2(16.5,-L/2+6),V2(12,L/2-9),...arc(12,L/2-5,2.5,-90,0,3),V2(14.5,L/2-1.5),...arc(13,L/2-1.5,1.5,0,90,3),V2(10,L/2),V2(10,-L/2)];
      return {pos:c.along(78+L/2),quat:c.qN,explode:c.d.clone().multiplyScalar(100),meshes:[{g:lathe(pts,56)}]};}},
  {id:'P-102',seq:2,tool:'手作業 (ローレット回し)',name:'カップリングリング',en:'Knurled Coupling',group:'A1',mat:'ABS',mb:'make',color:'#eef0f3',qty:1,shell:true,
    build:c=>{const W=c.p.ringW;const pts=[V2(21,-W/2),V2(25,-W/2),...arc(25,-W/2+1.5,1.5,-90,0,2),V2(26.5,W/2-1.5),...arc(25,W/2-1.5,1.5,0,90,2),V2(21,W/2),V2(21,-W/2)];const m=[{g:lathe(pts,72)}];
      for(let i=0;i<24;i++){const a=i/24*Math.PI*2;m.push({g:box(3.2,W-9,3),pos:[Math.cos(a)*26.8,0,Math.sin(a)*26.8],rot:[0,-a,0]});}
      return {pos:c.along(38+W/2),quat:c.qN,explode:c.d.clone().multiplyScalar(52),meshes:m};}},
  {id:'P-107',seq:3,tool:'手作業',name:'カートリッジ端キャップ',en:'Cartridge End Cap',group:'A1',mat:'PP',mb:'buy',color:'#dfe3e8',qty:2,qtyInGeom:true,
    build:c=>({pos:c.along(58),quat:c.qN,explode:c.d.clone().multiplyScalar(72).add(c.n.clone().multiplyScalar(30)),
      meshes:[{g:cyl(12.5,12.5,6,40),pos:[0,-36,0]},{g:cyl(12.5,12.5,6,40),pos:[0,36,0]},{g:cyl(4,4,8,20),pos:[0,42,0]},{g:cyl(4,4,8,20),pos:[0,-42,0]}]})},
  {id:'P-103',seq:4,tool:'手作業',name:'トラップカートリッジ',en:'Adsorbent Cartridge (glass tube)',group:'A1',mat:'ホウケイ酸ガラス',mb:'buy',color:'#bfe0ee',qty:1,opacity:0.5,
    build:c=>({pos:c.along(58),quat:c.qN,explode:c.d.clone().multiplyScalar(72).add(c.n.clone().multiplyScalar(30)),
      meshes:[{g:lathe([V2(9.5,-36),V2(11,-36),V2(11,36),V2(9.5,36),V2(9.5,-36)],48)}]})},
  {id:'P-104',seq:5,tool:'ピンセット',name:'吸着剤ベッド',en:'Sorbent Bed (Tenax TA 200 mg)',group:'A1',mat:'Tenax TA',mb:'buy',color:'#d9b56b',qty:1,
    build:c=>({pos:c.along(58),quat:c.qN,explode:c.d.clone().multiplyScalar(72).add(c.n.clone().multiplyScalar(64)),
      meshes:[{g:cyl(8.5,8.5,42,32)},{g:cyl(9,9,1.5,32),pos:[0,21.5,0]},{g:cyl(9,9,1.5,32),pos:[0,-21.5,0]}]})},
  {id:'P-105',seq:6,tool:'Oリングピック',name:'Oリング',en:'O-ring (P-40)',group:'A1',mat:'シリコーン',mb:'buy',color:'#2e3138',qty:2,qtyInGeom:true,
    build:c=>({pos:c.along(42),quat:c.qN,explode:c.d.clone().multiplyScalar(38).add(c.n.clone().multiplyScalar(-36)),
      meshes:[{g:new THREE.TorusGeometry(19.5,2.2,14,56),rot:[Math.PI/2,0,0]},{g:new THREE.TorusGeometry(19.5,2.2,14,56),rot:[Math.PI/2,0,0],pos:[0,-10,0]}]})},
  {id:'P-108',seq:7,tool:'ピンセット',name:'インレットフィルタ',en:'Inlet Filter Disc (PTFE 5 µm)',group:'A1',mat:'PTFE',mb:'buy',color:'#f3f4f6',qty:1,
    build:c=>({pos:c.along(12),quat:c.qN,explode:c.d.clone().multiplyScalar(30).add(c.n.clone().multiplyScalar(-62)),meshes:[{g:cyl(10,10,2,40)}]})},
  {id:'P-106',seq:8,tool:'手作業',name:'ネックボス',en:'Neck Boss',group:'A1',mat:'ABS',mb:'make',color:'#eef0f3',qty:1,shell:true,
    build:c=>{const tube=[V2(17,-24),V2(21,-24),V2(21,24),V2(17,24),V2(17,-24)];const fl=[V2(21,15),V2(24.5,15),...arc(24.5,21,2,0,90,3),V2(21,23),V2(21,15)];
      return {pos:c.along(24),quat:c.qN,explode:c.d.clone().multiplyScalar(16),meshes:[{g:lathe(tube,56)},{g:lathe(fl,56)}]};}},
  {id:'P-205',seq:9,tool:'手作業',name:'ロゴデカール',en:'Logo Decal',group:'A2',mat:'PET',mb:'buy',color:'#ffffff',qty:1,decal:true,
    build:c=>({pos:V3(0,c.cy,c.D/2+3.06),explode:V3(0,0,124),meshes:[{g:new THREE.CircleGeometry(c.R-15,72)}]})},
  {id:'P-203',seq:10,tool:'手作業 (両面テープ)',name:'フェイスパネル',en:'Face Panel',group:'A2',mat:'PC',mb:'make',color:'#fafbfc',qty:1,
    build:c=>({pos:V3(0,c.cy,c.D/2+2),explode:V3(0,0,104),meshes:[{g:lathe([V2(0,-1),V2(c.R-13.5,-1),V2(c.R-12,0.3),V2(c.R-13,1),V2(0,1),V2(0,-1)],72),rot:[Math.PI/2,0,0]}]})},
  {id:'P-204',seq:11,tool:'手作業',name:'LED リング',en:'LED Ring (diffuser)',group:'A2',mat:'PC',mb:'buy',color:'#e8ef9a',qty:1,led:true,
    build:c=>({pos:V3(0,c.cy,c.D/2+1.2),explode:V3(0,0,86),meshes:[{g:new THREE.TorusGeometry(c.R-6.5,3.2,16,112)}]})},
  {id:'P-207',seq:12,tool:'ピンセット',name:'フェイスガスケット',en:'Face Gasket',group:'A2',mat:'シリコーン',mb:'buy',color:'#7a7f8a',qty:1,
    build:c=>({pos:V3(0,c.cy,c.D/2+0.2),explode:V3(0,0,70),meshes:[{g:new THREE.TorusGeometry(c.R-12.5,1.2,10,96)}]})},
  {id:'P-208',seq:13,tool:'+ドライバー #0',name:'LED 基板',en:'LED Driver PCB (annular)',group:'A2',mat:'FR-4',mb:'make',color:'#2a7a4a',qty:1,
    build:c=>{const R=c.R;const m=[{g:lathe([V2(R-11,-0.6),V2(R-2,-0.6),V2(R-2,0.6),V2(R-11,0.6),V2(R-11,-0.6)],72),rot:[Math.PI/2,0,0]}];
      for(let i=0;i<24;i++){const a=i/24*Math.PI*2;m.push({g:box(2.6,2.6,1.2),pos:[Math.cos(a)*(R-6.5),Math.sin(a)*(R-6.5),1.2]});}
      return {pos:V3(0,c.cy,c.D/2-2.6),explode:V3(0,0,56),meshes:m};}},
  {id:'P-201',seq:14,tool:'手作業 (スナップ)',name:'フロントシェル',en:'Front Shell',group:'A2',mat:'ABS',mb:'make',color:'#f2f3f5',qty:1,shell:true,
    build:c=>{const h=c.D/2,R=c.R;const pts=[V2(0,h),V2(R-9,h),...arc(R-9,h-9,9,90,0,7),V2(R,0),V2(R-3,0),V2(R-3,h-3),V2(0,h-3)];
      return {pos:V3(0,c.cy,0),explode:V3(0,0,40),meshes:[{g:lathe(pts,96),rot:[Math.PI/2,0,0]}]};}},
  {id:'P-206',seq:15,tool:'手作業',name:'電源ボタン',en:'Power Button',group:'A2',mat:'シリコーン',mb:'buy',color:'#36b24a',qty:1,
    build:c=>({pos:V3(c.R+0.5,c.cy,c.D/2-16),explode:V3(54,0,0),meshes:[{g:cyl(6,6,7,32),rot:[0,0,Math.PI/2]},{g:cyl(4.5,4.5,2,32),rot:[0,0,Math.PI/2],pos:[4,0,0]}]})},
  {id:'P-209',seq:16,tool:'+ドライバー #1',name:'背面ネジ M2.5×8',en:'Rear Screw M2.5×8',group:'A2',mat:'SUS304',mb:'buy',color:'#b9c1cc',qty:4,qtyInGeom:true,
    build:c=>{const m=[];const r=c.R-16;for(let i=0;i<4;i++){const a=Math.PI/4+i*Math.PI/2,x=Math.cos(a)*r,y=Math.sin(a)*r;
      m.push({g:cyl(1.25,1.25,8,12),pos:[x,y,3],rot:[Math.PI/2,0,0]},{g:cyl(2.4,2.4,2,20),pos:[x,y,-1.2],rot:[Math.PI/2,0,0]},{g:box(3,0.6,0.8),pos:[x,y,-2.2],rot:[0,0,a]});}
      return {pos:V3(0,c.cy,-c.D/2),explode:V3(0,0,-112),meshes:m};}},
  {id:'P-210',seq:17,tool:'手作業',name:'ベントグリル',en:'Vent Grille',group:'A2',mat:'ABS',mb:'make',color:'#2b2f36',qty:1,
    build:c=>{const m=[];for(let i=0;i<6;i++)m.push({g:box(18,1.8,1.4),pos:[24,-10+i*4,0]});m.push({g:box(22,26,0.6),pos:[24,0,0.5]});
      return {pos:V3(0,c.cy,-c.D/2-0.4),explode:V3(0,0,-96),meshes:m};}},
  {id:'P-202',seq:18,tool:'手作業',name:'リアカバー',en:'Rear Cover',group:'A2',mat:'ABS',mb:'make',color:'#eceef1',qty:1,shell:true,
    build:c=>{const h=c.D/2,R=c.R;const pts=[V2(0,-h),V2(R-14,-h),...arc(R-14,-h+14,14,-90,0,8),V2(R,0),V2(R-3,0),V2(R-3,-h+3),V2(0,-h+3)];
      return {pos:V3(0,c.cy,0),explode:V3(0,0,-80),meshes:[{g:lathe(pts,96),rot:[Math.PI/2,0,0]}]};}},
  {id:'P-305',seq:19,tool:'手作業',name:'ポンプチューブ',en:'Pump Tubing φ4',group:'A3',mat:'シリコーン',mb:'buy',color:'#e6e9ee',qty:1,opacity:0.85,
    build:c=>{const a=c.along(-30),curve=new THREE.CatmullRomCurve3([V3(-22,c.cy+18,-4),V3(-14,c.cy+34,-2),V3(a.x-6,a.y+2,a.z),a]);
      return {pos:V3(0,0,0),explode:V3(-24,46,0),meshes:[{g:new THREE.TubeGeometry(curve,28,2,12,false),vol:Math.PI*4*curve.getLength()}]};}},
  {id:'P-304',seq:20,tool:'手作業',name:'フローセンサ',en:'Flow Sensor',group:'A3',mat:'PC',mb:'buy',color:'#5a606b',qty:1,
    build:c=>({pos:c.along(-22),quat:c.qN,explode:c.n.clone().multiplyScalar(46),meshes:[{g:box(16,10,8)},{g:cyl(1.5,1.5,6,10),pos:[0,7,0]}]})},
  {id:'P-301',seq:21,tool:'+ドライバー #1',name:'マイクロポンプ',en:'Micro Diaphragm Pump',group:'A3',mat:'アルミ A5052',mb:'buy',color:'#8f98a4',qty:1,
    build:c=>({pos:V3(-22,c.cy-2,-4),explode:V3(-50,22,0),meshes:[{g:box(30,28,24)},{g:cyl(4,4,14,20),pos:[0,21,0]},{g:cyl(9,9,4,32),pos:[0,0,13],rot:[Math.PI/2,0,0]}]})},
  {id:'P-302',seq:22,tool:'+ドライバー #1',name:'メイン基板',en:'Main PCB',group:'A3',mat:'FR-4',mb:'make',color:'#1f6b3d',qty:1,
    build:c=>({pos:V3(0,c.cy+4,-16),explode:V3(0,0,-44),meshes:[{g:box(Math.min(80,c.R*1.3),Math.min(56,c.R*0.9),1.6)},{g:box(14,14,3),pos:[10,-8,2.3]},{g:box(8,6,2.5),pos:[-16,10,2]},{g:box(6,3,1.5),pos:[22,14,1.6]},{g:box(6,3,1.5),pos:[22,8,1.6]}]})},
  {id:'P-303',seq:23,tool:'手作業',name:'バッテリーパック',en:'Li-ion Cell 18650',group:'A3',mat:'Li-ion セル',mb:'buy',color:'#3d4c8f',qty:1,
    build:c=>({pos:V3(4,c.cy-(c.R-22),6),explode:V3(0,-46,0),meshes:[{g:cyl(9,9,65,36),rot:[0,0,Math.PI/2]},{g:cyl(4,4,1.5,20),rot:[0,0,Math.PI/2],pos:[33,0,0]}]})},
  {id:'P-403',seq:24,tool:'手作業',name:'USB-C ポート',en:'USB-C Charging Port',group:'A4',mat:'SUS304',mb:'buy',color:'#5b6470',qty:1,
    build:c=>({pos:V3(30,6,-(c.D+18)/2-1),explode:V3(0,-20,-70),meshes:[{g:box(9,3.2,7)}]})},
  {id:'P-404',seq:25,tool:'手作業',name:'充電インジケータレンズ',en:'Charge Indicator Lens',group:'A4',mat:'PC',mb:'buy',color:'#cfe6ff',qty:1,opacity:0.8,
    build:c=>({pos:V3(c.R+2,6,(c.D+18)/2+0.4),explode:V3(0,-22,44),meshes:[{g:cyl(2.2,2.2,1.6,20),rot:[Math.PI/2,0,0]}]})},
  {id:'P-401',seq:26,tool:'手作業',name:'ベーススタンド',en:'Base Stand (tilt cradle)',group:'A4',mat:'ABS',mb:'make',color:'#e9ebef',qty:1,shell:true,
    build:c=>{const W=c.R*2+24,H=c.p.baseH,Z=c.D+18;const sh=new THREE.Shape();sh.moveTo(-W/2,-H);sh.lineTo(W/2,-H);sh.lineTo(W/2,-H+9);sh.quadraticCurveTo(W/2,-H+13,W/2-8,-H+13);sh.lineTo(-W/2+38,-H+13);sh.lineTo(-W/2+16,-H+31);sh.quadraticCurveTo(-W/2+12,-H+34,-W/2+6,-H+34);sh.lineTo(-W/2,-H+34);sh.closePath();
      const g=new THREE.ExtrudeGeometry(sh,{depth:Z,bevelEnabled:false});g.translate(0,0,-Z/2);
      const saddle=lathe([V2(0,0),V2(c.R*0.55,0),V2(c.R*0.55,6),V2(0,6),V2(0,0)],48);
      return {pos:V3(0,0,0),explode:V3(0,-66,0),meshes:[{g},{g:saddle,pos:[0,-H+13,0]}]};}},
  {id:'P-402',seq:27,tool:'手作業',name:'ラバーフット',en:'Rubber Foot',group:'A4',mat:'NBR',mb:'buy',color:'#2a2b2f',qty:4,qtyInGeom:true,
    build:c=>{const w=c.R+2,z=c.D/2+3;return {pos:V3(0,-c.p.baseH-1.5,0),explode:V3(0,-94,0),meshes:[[w,z],[-w,z],[w,-z],[-w,-z]].map(o=>({g:cyl(5,5,3,24),pos:[o[0],0,o[1]]}))};}}
];
const N_STEPS=PART_DEFS.length;
const PRODUCT={
  mark:'VT',name:'VolaTrap Assembly Studio',tag:'· 3D 分解 / 設計ダッシュボード',crumbA:'VolaTrap_Product.1',crumbB:'VolaTrap Assy.1',rev:'VT-2026-A · rev 05',assy:'VolaTrap Assy',assyInst:'VolaTrap Assy.1',
  hasLed:true,groundY:-16,logo:true,
  makeCtx(p){const R=p.bodyR,D=p.bodyDepth,cy=R-6,a=THREE.MathUtils.degToRad(p.nozzleAngle);const d=V3(Math.cos(a),Math.sin(a),0),n=V3(-Math.sin(a),Math.cos(a),0);const P0=V3(0,cy,0).add(d.clone().multiplyScalar(R-10));return {p,R,D,cy,d,n,P0,qN:yTo(d),along:s=>P0.clone().add(d.clone().multiplyScalar(s)),center:V3(0,cy,0)};},
  results(ctx,box,groupMass,total){const s=box.getSize(V3());return {mass:total,length:s.x,height:s.y,headMass:groupMass.A1};},
  optimizeStep(p){if(p.baseH>8){p.baseH=Math.max(8,p.baseH-0.5);return true;}if(p.bodyDepth>50){p.bodyDepth-=1;return true;}if(p.bodyR>48){p.bodyR-=0.5;return true;}return false;},
  nested:['P-103|P-104','P-103|P-107','P-102|P-103','P-102|P-105','P-106|P-103','P-106|P-105','P-106|P-108','P-106|P-107','P-201|P-204','P-201|P-207','P-201|P-208','P-201|P-203','P-203|P-205','P-204|P-207','P-204|P-208','P-201|P-206','P-202|P-209','P-202|P-210','P-401|P-402','P-401|P-403','P-401|P-404','P-201|P-106','P-101|P-103','P-101|P-107','P-102|P-107','P-101|P-102','P-204|P-203','P-207|P-208','P-203|P-207','P-201|P-202','P-105|P-103','P-105|P-107','P-104|P-107','P-201|P-303','P-201|P-302','P-201|P-301','P-202|P-302','P-202|P-301','P-202|P-303','P-401|P-303','P-201|P-305','P-202|P-305','P-305|P-301','P-305|P-304','P-201|P-304','P-106|P-304','P-201|P-401','P-202|P-401','P-208|P-206'],
  sets:[
    {name:'外装部品 (Shell)',color:'#d8dde5',pred:d=>d.shell},
    {name:'内部ユニット',color:'#8b5cd6',pred:d=>d.group==='A3'},
    {name:'購入品 (Buy)',color:'#3b7dd8',pred:(d,st)=>st.mb==='buy'},
    {name:'自製品 (Make)',color:'#3fae5c',pred:(d,st)=>st.mb==='make'},
    {name:'締結部品・シール',color:'#6b6f7a',pred:d=>['P-209','P-105','P-207'].includes(d.id)},
    {name:'気流経路 (Flow Path)',color:'#3aa0d8',pred:d=>['P-101','P-107','P-103','P-104','P-108','P-106','P-304','P-305','P-301'].includes(d.id)},
    {name:'電気系統',color:'#c4913a',pred:d=>['P-302','P-303','P-208','P-204','P-206','P-403','P-404','P-304'].includes(d.id)}
  ],
  hints:'ヒント: 下部の分解バー ▶ で順次分解を再生。← → で工程送り、P でプレゼンモード。'
};
