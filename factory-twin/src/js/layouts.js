// ================= 図面ベースの実配置（第二ペイント工場） =================
// 出典: 260925_アトミクス加須_第二現状レイアウト.pdf / 第二変更レイアウト.pdf を読図（誤差±0.3m程度）。
// 建屋 43.5m×38m（柱スパン 1.5+6.0×7 / 4.9+4.75×6+4.6）。原点=建屋中心、+x=図面右、+z=図面下。
// 設備の高さ・外形は仮定。「変更案」は図面記載どおりで、移設計画として確定したものではない。
const TWIN=JSON.parse(document.getElementById('twinAnalytics').textContent);
const DRAW_DECK_H=2.6;   // 架台デッキ高さ（仮定）
function drawTankQuad(prefix,nums,cx,cz,dia,dx,dz,only,sys){
  // nums: [左上,右上,左下,右下]
  const pos=[[-dx,-dz],[dx,-dz],[-dx,dz],[dx,dz]];
  return nums.map((n,i)=>["TNK",`調合タンク ${prefix}${n}`,[prefix+n],cx+pos[i][0],cz+pos[i][1],dia,dia,2.9,{only,sys}]);
}
const DRAWING_LAYOUTS={
 paint2:{
  source:"図面 260925（第二現状 / 第二変更レイアウト）",
  scenarios:{current:"現状（図面260925）",plan:"変更案（図面260925・未確定）"},
  // [proc, 名称, 設備番号(別名可), x, z, w, d, h, {only, sys, note}]
  items:[
   // --- 北側通路ゾーン ---
   ["MILL","ADミル",["ADミル","AD-1"],-8.4,-17.5,1.5,1.0,1.5,{}],
   ["DSP","ディスパー D-136 (7.5kW)",["D-136"],-5.8,-17.6,1.0,1.7,2.6,{}],
   ["DSP","ディスパー D-137 (7.5kW)",["D-137"],-4.1,-17.6,1.0,1.7,2.6,{}],
   ["FIL","小缶充填機",["小缶充填機"],16.7,-16.8,1.8,1.0,1.5,{only:"current"}],
   // --- 架台 上段（5mスパン）---
   ["PTK","可搬タンク PT-11",["PT-11","PT-19"],-18.9,-4.4,0.95,0.95,1.1,{}],
   ["PTK","可搬タンク PT-12",["PT-12","PT-20"],-17.7,-4.4,0.95,0.95,1.1,{}],
   ["DSP","可搬ディスパー PD-111 (3.7kW)",["PD-111","D-111"],-18.3,-5.6,0.8,0.8,2.4,{}],
   ["PTK","可搬タンク PT-13",["PT-13","PT-21"],-14.5,-5.3,0.95,0.95,1.1,{}],
   ["PTK","可搬タンク PT-14",["PT-14","PT-22"],-12.2,-5.3,0.95,0.95,1.1,{}],
   ["DSP","可搬ディスパー PD-112 (3.7kW)",["PD-112","D-112"],-13.35,-6.1,0.8,0.8,2.4,{}],
   ["MILL","スパイクミル SHG2-4 (15kW)",["SHG2-4"],-15.6,-3.6,1.3,0.9,1.5,{}],
   ["MILL","スパイクミル SHG2-3 (15kW)",["SHG2-3"],-13.3,-3.6,1.3,0.9,1.5,{}],
   ["MILL","スパイクミル SHG2-5 (15kW)",["SHG2-5"],-10.5,-3.5,2.0,2.2,1.6,{}],
   ["MILL","ハンディミル HM (5.5kW)",["HM"],-7.6,-3.7,0.7,1.1,1.3,{}],
   ["DSP","ディスパー D-123 (7.5kW INV)",["D-123"],-6.0,-3.4,1.2,1.9,2.6,{}],
   // --- 架台 下段（6mスパン）---
   ["DSP","ディスパー D-101 (7.5kW)",["D-101"],-18.25,1.5,0.55,0.55,4.2,{noOcc:true}],
   ["DSP","ディスパー D-107 (22kW)",["D-107"],-13.85,1.2,0.6,0.6,4.2,{noOcc:true}],
   ["TNK","調合タンク T-129",["T-129"],-14.45,2.3,1.1,1.1,2.9,{}],
   ["TNK","調合タンク T-130/131",["T-130","T-131"],-13.2,2.3,1.1,1.1,2.9,{}],
   ["DSP","ディスパー D-105 (11kW)",["D-105"],-9.25,1.5,0.55,0.55,4.2,{noOcc:true}],
   ["DSP","ディスパー D-121 (3.7kW)",["D-121"],-3.3,-1.2,0.7,1.2,2.4,{}],
   ["DSP","ディスパー D-122 (3.7kW)",["D-122"],-7.15,3.1,0.7,1.2,2.4,{}],
   ["DSP","ディスパー D-135 (1.5kW)",["D-135"],-2.55,3.3,0.5,0.9,2.0,{}],
   ["DSP","ディスパー D-103 (22kW)",["D-103"],-0.75,1.5,0.6,0.6,4.2,{noOcc:true}],
   ["DSP","ディスパー D-104 (22kW)",["D-104"],4.2,1.5,0.6,0.6,4.2,{noOcc:true}],
   // --- 現状のみ: 東側 D-108 系・PD-113/114・ミル ---
   ["DSP","ディスパー D-108 (37kW)",["D-108"],18.0,2.4,0.65,0.65,4.2,{only:"current",noOcc:true}],
   ["PTK","可搬タンク PT-15",["PT-15","PT-23"],-0.2,-4.6,0.95,0.95,1.1,{only:"current"}],
   ["PTK","可搬タンク PT-16",["PT-16","PT-24"],1.25,-4.6,0.95,0.95,1.1,{only:"current"}],
   ["DSP","可搬ディスパー PD-113 (30kW)",["PD-113","D-113"],0.55,-3.4,0.9,0.9,2.6,{only:"current"}],
   ["PTK","可搬タンク PT-17",["PT-17","PT-25"],4.3,-4.6,0.95,0.95,1.1,{only:"current"}],
   ["PTK","可搬タンク PT-18",["PT-18","PT-26"],5.75,-4.6,0.95,0.95,1.1,{only:"current"}],
   ["DSP","可搬ディスパー PD-114 (30kW)",["PD-114","D-114"],5.0,-3.4,0.9,0.9,2.6,{only:"current"}],
   ["MILL","ミル SHG2-2 (30kW)",["SHG2-2","SM2-2"],1.0,-6.2,0.9,1.3,1.6,{only:"current",note:"図面の文字が不鮮明。SM-2-2/SHG2-2 の読み"}],
   ["MILL","スーパーミル SM2-3 (22kW)",["SM2-3"],5.05,-6.2,0.9,1.3,1.6,{only:"current"}],
   // --- 南側通路ゾーン ---
   ["FIL","デジタル充填機 (D-3)",["D-3","D-1"],-2.4,6.4,0.9,1.3,1.5,{note:"号機の割当は仮定"}],
   ["FIL","デジタル充填機 (D-7)",["D-7","D-2"],-0.9,6.4,0.9,1.3,1.5,{note:"号機の割当は仮定"}],
   ["FIL","デジタル充填機 (D-5)",["D-5"],0.6,6.4,0.9,1.3,1.5,{note:"号機の割当は仮定"}],
   ["FIL","PS-50 充填機 1",["PS-50"],-9.7,6.4,0.9,1.3,1.5,{only:"current"}],
   ["FIL","PS-50 充填機 2",["PS-50B"],-6.9,6.4,0.9,1.3,1.5,{only:"current"}],
   // --- 変更案のみ: ワニス生産エリア（東側）---
   ["DSP","硬化剤ライン ディスパー",["D-201","D-202","T-202","T-47","T-48","T-46"],9.05,1.85,0.6,0.6,4.2,{only:"plan",sys:"ワニス",noOcc:true,note:"ワニス設備番号の割当は仮定"}],
   ["TNK","ハイシルバー 樹脂タンク",["KV-4","KV-5","D-301"],13.05,-0.35,1.75,1.75,2.9,{only:"plan",sys:"ワニス",note:"ワニス設備番号の割当は仮定"}],
   ["DSP","ハイシルバー ディスパー A",["HS-DA"],14.6,-0.6,0.5,0.5,4.2,{only:"plan",sys:"ワニス",noOcc:true}],
   ["DSP","ハイシルバー ディスパー B",["HS-DB"],14.6,0.75,0.5,0.5,4.2,{only:"plan",sys:"ワニス",noOcc:true}],
   ["TNK","ハイシルバー 調合タンク",["HS-MIX"],13.3,2.55,2.35,2.35,2.9,{only:"plan",sys:"ワニス"}],
   ["TNK","ギルソ溶解槽 A",["ギルソ溶解槽A"],17.45,-0.45,1.2,1.2,2.9,{only:"plan",sys:"ワニス"}],
   ["TNK","ギルソ溶解槽 B",["ギルソ溶解槽B"],19.2,-0.45,1.2,1.2,2.9,{only:"plan",sys:"ワニス"}],
   ["TNK","アスファルーフ 調合タンク 1",["ASR-T1"],17.4,2.85,1.3,1.3,2.9,{only:"plan",sys:"ワニス"}],
   ["TNK","アスファルーフ 調合タンク 2",["ASR-T2"],19.1,2.85,1.3,1.3,2.9,{only:"plan",sys:"ワニス"}],
   ["DSP","アスファルーフ 調合ディスパー",["ASR調合槽ディスパ-"],18.25,1.6,0.6,0.6,4.2,{only:"plan",sys:"ワニス",noOcc:true}],
   ["KVT","No.1プライマー タンク",["NO1プライマ-"],18.5,-4.75,2.4,2.4,3.4,{only:"plan",sys:"ワニス"}],
   ["KVT","シンナータンク 1",["シンナ-1"],12.7,-5.7,1.7,1.7,3.2,{only:"plan",sys:"ワニス"}],
   ["KVT","シンナータンク 2",["シンナ-2"],12.7,-3.5,1.7,1.7,3.2,{only:"plan",sys:"ワニス"}],
   ["KVT","充填用サービスタンク 1",["SV-1"],0.25,-5.55,1.75,1.75,3.2,{only:"plan",sys:"ワニス"}],
   ["KVT","充填用サービスタンク 2",["SV-2"],0.25,-3.4,1.75,1.75,3.2,{only:"plan",sys:"ワニス"}],
   ["FIL","ワニス充填ライン 1",["移動式石油缶充填機","SS-2000充填機","ASR充填機","デジタルオ-プン充填機"],4.4,-4.5,2.6,1.0,1.5,{only:"plan",sys:"ワニス",note:"充填ラインスペース内の機器配置は図面未記載（仮置き）"}],
   ["FIL","ワニス充填ライン 2",["AT-1充填機","二連式充填機","300ML充填機"],8.4,-4.5,2.6,1.0,1.5,{only:"plan",sys:"ワニス",note:"充填ラインスペース内の機器配置は図面未記載（仮置き）"}],
   ["EV","簡易リフト",["簡易リフト"],-5.7,6.4,1.4,1.4,3.2,{only:"plan"}],
   // --- 変更案のみ: 調色エリア（南側）---
   ["DSP","調色ディスパー 水性 (3.7kW)",["調色D-1"],-7.3,14.8,0.7,1.2,2.4,{only:"plan",sys:"調色"}],
   ["DSP","調色ディスパー (7.5kW)",["調色D-2"],-3.3,14.8,0.8,1.4,2.6,{only:"plan",sys:"調色"}],
   ["DSP","調色ディスパー 油性 (3.7kW)",["調色D-3"],-1.1,14.8,0.7,1.2,2.4,{only:"plan",sys:"調色"}],
   ["DSP","調色ディスパー (1.5kW) 1",["調色D-4"],-7.05,17.7,0.5,0.9,2.0,{only:"plan",sys:"調色"}],
   ["DSP","調色ディスパー (1.5kW) 2",["調色D-5"],-5.4,17.7,0.5,0.9,2.0,{only:"plan",sys:"調色"}],
   ["DSP","調色ディスパー (1.5kW) 3",["調色D-6"],-3.8,17.7,0.5,0.9,2.0,{only:"plan",sys:"調色"}],
   ["DSP","調色ディスパー (7.5kW) 2",["調色D-7"],-0.85,17.7,0.8,1.4,2.6,{only:"plan",sys:"調色"}],
   ["DSP","調色ディスパー (1.5kW) 4",["調色D-8"],1.2,17.7,0.5,0.9,2.0,{only:"plan",sys:"調色"}],
   ["DSP","調色ディスパー (1.5kW) 5",["調色D-9"],2.85,17.7,0.5,0.9,2.0,{only:"plan",sys:"調色"}],
   ["FIL","調色 充填機 1",["調色F-1"],5.8,16.9,0.9,1.3,1.5,{only:"plan",sys:"調色"}],
   ["FIL","調色 充填機 2",["調色F-2"],7.65,16.9,0.9,1.3,1.5,{only:"plan",sys:"調色"}],
   ...drawTankQuad("T-",[114,113,112,111],-18.25,1.5,1.12,.76,.7),
   ...drawTankQuad("T-",[128,127,126,125],-9.25,1.5,1.12,.7,.68),
   ...drawTankQuad("T-",[124,123,122,121],-0.75,1.5,1.32,.84,.76),
   ...drawTankQuad("T-",[120,119,118,117],4.2,1.5,1.32,.84,.76),
   ...drawTankQuad("T-",[104,103,102,101],18.0,2.4,1.32,.84,.76,"current"),
   ...["硬化剤タンク 1","硬化剤タンク 2","硬化剤タンク 3","硬化剤タンク 4"].map((n,i)=>["TNK",n,["硬化剤T-"+(i+1)],[7.9,9.6,7.9,9.6][i],[0.8,0.8,2.35,2.35][i],1.36,1.36,2.9,{only:"plan",sys:"ワニス"}]),
  ],
  // 室・階段（通行不可の構造物）。[名称, x, z, w, d, h, only]
  rooms:[["事務所",-17.4,16.5,5.9,4.9,2.7],["WC",19.5,15.6,4.0,3.6,2.7],["調色事務所",-11.3,16.5,5.8,4.9,2.7,"plan"],
         ["制御盤設置スペース",18.6,-16.4,5.8,4.7,2.2,"plan"],["衝立",9.8,16.7,0.12,4.6,1.8,"plan"]],
  stairs:[[-21.15,-5.6,1.0,2.4],[-21.15,-3.0,1.0,1.2],[-21.15,1.2,1.0,4.6],[-1.35,-5.5,1.0,2.4],[-1.35,-3.0,1.0,1.0],[20.6,1.4,1.0,4.6],
          [14.95,-4.8,0.9,2.8,"current"],[15.3,-4.8,0.9,2.8,"plan"],[20.6,-3.1,1.0,1.2]],
  // 床面のゾーン表示。[名称, x, z, w, d, 色, only]
  zones:[["架台（2F デッキ）",0.35,-1.35,42.0,11.1,0x7f97a0],["ワニス生産エリア（硬化剤ライン）",8.75,1.05,4.5,6.3,0xd29922,"plan"],
         ["ワニス生産エリア（ハイシルバー）",13.5,1.05,4.5,6.3,0xd29922,"plan"],["ワニス生産エリア（アスファルーフ用）",18.3,1.05,5.6,6.3,0xd29922,"plan"],
         ["充填ラインスペース",6.5,-4.5,9.0,4.6,0xc6a965,"plan"],["調色エリア",-1.0,16.5,14.0,4.9,0xf778ba,"plan"],
         ["投入コンベアー",20.9,-9.7,0.7,7.2,0x3aa0c8,"plan"]],
  deck:{x0:-20.65,x1:21.35,rows:[-6.9,-2.1,4.2],pitch:4.5},
 }
};
const twinSlug=s=>String(s).replace(/[^\w぀-ヿ一-鿿-]+/g,'');
const layoutState={};            // 建屋ID → 表示中のシナリオ
const layoutCtxs={};             // 建屋ID → {current:ctx, plan:ctx}（設備を動かした結果もシナリオごとに保持）
function makeDrawingCtx(b,scen){
  const L=DRAWING_LAYOUTS[b.id];
  const items=L.items.filter(e=>!e[8]?.only||e[8].only===scen).map(([proc,name,tags,x,z,w,d,h,o={}])=>({
    assetId:b.id+"-"+twinSlug(tags[0]), tag:tags[0], tags, sys:o.sys||"2B", evidence:"imported",
    maintenance:0.6, notes:(o.note?o.note+"。":"")+"位置は図面260925の読図。高さ・外形は仮定。", proc, name, x, z, w, d, h, bw:w, bd:d, rot:0,
    color:PROC_COLOR[proc]||0x9da7b3, fixed:false, noOcc:!!o.noOcc, variant:null, num:(tags[0].match(/[A-Z]+-?\d+$/)||[null])[0], kv:o.sys==="ワニス"?"green":"pink" }));
  // 工程フロー = 生産データの実バッチ頻度（回/稼働日）。設備番号で両端が特定できたものだけ経路化する。
  const find=t=>items.find(i=>i.tags.includes(t));
  const agg=new Map(), unassigned=[];
  for(const f of TWIN.flows){
    const mine=f.building===b.id||(scen==="plan"&&f.line==="ワニス");
    if(!mine) continue;
    const a=find(f.source), z=find(f.target);
    if(!a||!z){ unassigned.push(f); continue; }
    if(a===z) continue;
    const k=a.assetId+">"+z.assetId; const e=agg.get(k)||{a,z,n:0,line:f.line}; e.n+=f.per_day; agg.set(k,e);
  }
  const flows=[...agg.values()].map(e=>["#"+e.a.assetId,"#"+e.z.assetId,e.n,e.line]);
  const c=newCtx(b.id,"interior",b.w*INT_SCALE,b.d*INT_SCALE,0.4,0.05,items,flows,b.name);
  c.drawing={layout:L,scen,unassigned,
    obstacles:[...L.rooms.filter(r=>!r[6]||r[6]===scen).map(r=>({name:r[0],x:r[1],z:r[2],w:r[3],d:r[4],h:r[5]})),
               ...L.stairs.filter(s=>!s[4]||s[4]===scen).map(s=>({name:"階段",x:s[0],z:s[1],w:s[2],d:s[3],h:DRAW_DECK_H}))]};
  return c;
}
function flowEnds(c,key){ return key[0]==="#" ? c.items.filter(i=>i.assetId===key.slice(1)) : c.items.filter(i=>i.proc===key); }
for(const id of Object.keys(DRAWING_LAYOUTS)){
  const b=siteCtx.items.find(i=>i.id===id); if(!b) continue;
  layoutState[id]="current"; layoutCtxs[id]={current:makeDrawingCtx(b,"current"),plan:makeDrawingCtx(b,"plan")};
  interiorCtxs.set(id,layoutCtxs[id].current);
}
// 図面ベース建屋の構造物（架台・階段・室・ゾーン）を描く
function twinStructure(b,ic,groups){
  const L=ic.drawing.layout, scen=ic.drawing.scen, {mezzanine,zones,walls}=groups, dk=L.deck, H=DRAW_DECK_H;
  const deckMat=new THREE.MeshStandardMaterial({color:0x8fa3a8,roughness:.6,metalness:.5,transparent:true,opacity:.16,depthWrite:false});
  const deck=new THREE.Mesh(new THREE.BoxGeometry(dk.x1-dk.x0,.08,dk.rows[2]-dk.rows[0]),deckMat);deck.position.set((dk.x0+dk.x1)/2,H,(dk.rows[0]+dk.rows[2])/2);mezzanine.add(deck);
  for(let x=dk.x0;x<=dk.x1+.01;x+=dk.pitch)for(const z of dk.rows){v3Box(mezzanine,.2,H,.2,x,H/2,z,0x5d737b);v3.obstacles.push({x,z,w:.3,d:.3,layer:'mezzanine'});ic.drawing.obstacles.some(o=>o.col&&o.x===x&&o.z===z)||ic.drawing.obstacles.push({name:"架台柱",col:true,x,z,w:.25,d:.25,h:H});}
  for(const z of dk.rows)v3Box(mezzanine,dk.x1-dk.x0,.22,.14,(dk.x0+dk.x1)/2,H-.11,z,0x6f858c);
  for(let x=dk.x0;x<=dk.x1+.01;x+=dk.pitch)v3Box(mezzanine,.12,.2,dk.rows[2]-dk.rows[0],x,H-.1,(dk.rows[0]+dk.rows[2])/2,0x6f858c);
  const rail=(a,c)=>{for(const y of [H+.55,H+1.1])v3Beam(mezzanine,[a[0],y,a[1]],[c[0],y,c[1]],.022,0xdbc251);};
  rail([dk.x0,dk.rows[0]],[dk.x1,dk.rows[0]]);rail([dk.x0,dk.rows[2]],[dk.x1,dk.rows[2]]);rail([dk.x0,dk.rows[0]],[dk.x0,dk.rows[2]]);rail([dk.x1,dk.rows[0]],[dk.x1,dk.rows[2]]);
  for(const s of L.stairs.filter(s=>!s[4]||s[4]===scen)){const [x,z,w,d]=s,n=10;for(let i=0;i<n;i++)v3Box(mezzanine,w,.06,d/n,x,(i+1)*H/n,z-d/2+(i+.5)*d/n,0x8c9da4);v3.obstacles.push({x,z,w,d,layer:'mezzanine'});}
  for(const r of L.rooms.filter(r=>!r[6]||r[6]===scen)){const [name,x,z,w,d,h]=r;const m=v3Box(mezzanine,w,h,d,x,h/2,z,r[6]==="plan"?0xbfa66a:0xa9b6b2);m.material.transparent=true;m.material.opacity=.5;
    const lb=makeLabel(name,.12,r[6]==="plan"?'#ffe0a0':'#d6e2df');lb.position.set(x,h+.5,z);mezzanine.add(lb);v3.obstacles.push({x,z,w,d,layer:'mezzanine'});}
  for(const zn of L.zones.filter(z=>!z[6]||z[6]===scen)){const [name,x,z,w,d,col]=zn;const p=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:zn[6]?.22:.07,depthWrite:false}));p.rotation.x=-Math.PI/2;p.position.set(x,.018,z);zones.add(p);
    const e=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(w,d)),new THREE.LineBasicMaterial({color:col}));e.rotation.x=-Math.PI/2;e.position.set(x,.03,z);zones.add(e);
    v3FloorLabel(zones,name,x,z+d/2+.45,.11,zn[6]?'#ffd98a':'#b8d3ce');}
  // 柱スパンの寸法線（図面の通り芯）
  let gx=-ic.W/2;for(const [i,s] of [1.5,6,6,6,6,6,6,6].entries()){v3FloorLabel(zones,(s*1000).toLocaleString(),gx+s/2,-ic.D/2-.9,.07,'#9fb6bd');gx+=s;v3Box(zones,.04,.01,.8,gx,.02,-ic.D/2-.6,0x9fb6bd);}
}
