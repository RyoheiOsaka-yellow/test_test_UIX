/* ================================================================
   ▼ 拡張モジュール12: 📷 写真準拠 外観（v15）
   参照写真: 正面(昼2枚・夜1枚)・エントランス近景・別館＋広場。
   読み取り: フラット屋根／白系コンクリート躯体／西面はエントランスホールの
   2層ガラスカーテンウォール（方立≈1.6m・横桟）で上部に黒地×黄「BREX ARENA
   UTSUNOMIYA」バナー／小型フラットキャノピー／レンガ舗装の広場と段／
   南西にレンガ造の別館（宇都宮市体育館）と外階段／試合日は膨らませ式の
   ウェルカムアーチ・マスコット・旗ポール・黒テント。
   ※ 東・北面と屋上は写真未取得のため既存形状を維持。
================================================================ */
(function(){
'use strict';
const api=window.__extApi; if(!api) return;
const G=new THREE.Group(); api.group.add(G);      /* 可視制御は外観グループに従う */
const oMinX=api.outerMinX, CZ=MAIN_C.z;

/* --- 躯体の色: 白系コンクリート（写真2/4/9） --- */
mainMat.color.setHex(0xd9d6ce); mainMat.roughness=0.72; mainMat.metalness=0.04;
arenaShellMat.color.setHex(0xd2cfc7); arenaShellMat.roughness=0.75; arenaShellMat.metalness=0.04;
api.roofMat.color.setHex(0xe6e4de); api.roofMat.roughness=0.6; api.roofMat.metalness=0.1;

/* --- 旧装飾（推定形状）を退避: 大型キャノピー・平板サイン・黄色ゲート --- */
const d=api.dress||{};
[d.canopy,d.canUnder,d.sW,d.barW,d.sS,d.barS].concat(d.canCols||[]).forEach(m=>{ if(m) m.visible=false; });
if(typeof gateMesh!=='undefined') gateMesh.visible=false;
if(typeof gateLabel!=='undefined') gateLabel.visible=false;
plazaGroup.traverse(o=>{ if(o.isMesh && o.material && o.material.color && o.material.color.getHex()===0x4a4036) o.visible=false; });

/* --- 西面: 2層ガラスカーテンウォール＋BREXバナー（写真2/4/8） --- */
const FW=46, FH=6.4, PX=44;    /* 幅46m×高6.4m, 44px/m */
function facadeTex(){
  const cv=document.createElement('canvas'); cv.width=FW*PX; cv.height=Math.round(FH*PX);
  const c=cv.getContext('2d'), W=cv.width, H=cv.height, m=(y)=>H-y*PX;   /* m(y): 地上高→canvas y */
  /* ガラス */
  const g=c.createLinearGradient(0,0,0,H); g.addColorStop(0,'#2a3d5c'); g.addColorStop(0.5,'#1c2a42'); g.addColorStop(1,'#243654');
  c.fillStyle=g; c.fillRect(0,0,W,H);
  for(let i=0;i<40;i++){ c.fillStyle='rgba(255,255,255,'+(0.02+0.03*Math.abs(Math.sin(i*1.3))).toFixed(3)+')'; c.fillRect(i*W/40,0,W/80,H); }
  /* 上部バナー帯（地上 2.6〜6.2m）: 黒地・黄色バースト */
  const bTop=m(6.2), bBot=m(2.6);
  c.fillStyle='#0d0d10'; c.fillRect(0,bTop,W,bBot-bTop);
  c.fillStyle='#f5c400';
  [[0.02,0.16],[0.20,0.24],[0.74,0.80],[0.86,0.99]].forEach(r=>{
    c.beginPath(); c.moveTo(W*r[0],bBot); c.lineTo(W*r[1],bTop); c.lineTo(W*(r[1]+0.03),bTop); c.lineTo(W*(r[0]+0.05),bBot); c.closePath(); c.fill();
  });
  c.fillStyle='rgba(245,196,0,0.18)'; c.fillRect(0,bTop,W*0.18,bBot-bTop); c.fillRect(W*0.78,bTop,W*0.22,bBot-bTop);
  c.textAlign='left'; c.textBaseline='alphabetic';
  c.fillStyle='#ffffff'; c.font='700 '+Math.round(0.28*PX)+'px Oswald, "Noto Sans JP", sans-serif';
  c.fillText('HOME OF UTSUNOMIYA BREX', W*0.30, bTop+0.55*PX);
  c.fillStyle='#f5c400'; c.font='italic 800 '+Math.round(1.55*PX)+'px Oswald, "Noto Sans JP", sans-serif';
  c.fillText('BREX', W*0.30, bTop+2.1*PX);
  c.fillText('ARENA', W*0.30, bTop+3.45*PX);
  c.fillStyle='#ffffff'; c.font='italic 700 '+Math.round(0.62*PX)+'px Oswald, sans-serif';
  c.fillText('UTSUNOMIYA', W*0.52, bTop+3.4*PX);
  /* 右側ロゴ */
  const lx=W*0.66, ly=bTop+(bBot-bTop)/2, lr=1.35*PX;
  c.strokeStyle='#f5c400'; c.lineWidth=0.14*PX; c.beginPath(); c.arc(lx,ly,lr,0,6.2832); c.stroke();
  c.fillStyle='#f5c400'; c.beginPath(); c.arc(lx,ly,lr*0.72,0,6.2832); c.fill();
  c.fillStyle='#0d0d10'; c.textAlign='center'; c.font='800 '+Math.round(0.6*PX)+'px Oswald, sans-serif';
  c.fillText('BREX', lx, ly+0.22*PX); c.font='700 '+Math.round(0.26*PX)+'px Oswald, sans-serif'; c.fillText('UTSUNOMIYA', lx, ly-0.45*PX);
  /* 下段: HELLO, NEW CITY. とポスター面 */
  c.textAlign='left'; c.fillStyle='rgba(255,255,255,0.92)'; c.font='700 '+Math.round(0.55*PX)+'px Oswald, sans-serif';
  c.fillText('HELLO,', W*0.045, m(1.6)); c.fillText('NEW CITY.', W*0.045, m(0.9));
  [[0.20,'#f5c400'],[0.235,'#ffffff'],[0.27,'#7fd8ff']].forEach(p=>{ c.fillStyle=p[1]; c.fillRect(W*p[0], m(2.3), W*0.03, 1.5*PX); });
  /* エントランス扉（中央6m） */
  c.fillStyle='#0e141f'; c.fillRect(W*0.435, m(2.5), W*0.13, 2.5*PX);
  c.strokeStyle='#8a929f'; c.lineWidth=2; for(let i=0;i<=4;i++){ const x=W*0.435+i*W*0.13/4; c.beginPath(); c.moveTo(x,m(2.5)); c.lineTo(x,H); c.stroke(); }
  /* 方立（1.6m）と横桟（2.6m/4.4m）: 黒フレーム */
  c.fillStyle='#161616';
  for(let x=0;x<=FW;x+=1.6) c.fillRect(Math.round(x*PX)-3,0,6,H);
  [2.6,4.4].forEach(y=>c.fillRect(0,m(y)-3,W,6));
  c.fillRect(0,0,W,5); c.fillRect(0,H-5,W,5);
  return new THREE.CanvasTexture(cv);
}
const ft=facadeTex();
const facadeMat=new THREE.MeshStandardMaterial({map:ft, emissive:0xffffff, emissiveMap:ft, emissiveIntensity:0.05, roughness:0.35, metalness:0.3});
const facade=new THREE.Mesh(new THREE.PlaneGeometry(FW, FH), facadeMat);
facade.position.set(oMinX-0.25, FH/2, CZ); facade.rotation.y=-Math.PI/2; G.add(facade);
/* 白い上部躯体の庇（ガラス上のフラットな出）とキャノピー */
const eave=new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, FW+2), new THREE.MeshStandardMaterial({color:0xe6e4de, roughness:0.7}));
eave.position.set(oMinX-0.6, FH+0.3, CZ); G.add(eave);
const canopy=new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.32, 13), new THREE.MeshStandardMaterial({color:0x1c1e24, roughness:0.5, metalness:0.4}));
canopy.position.set(oMinX-2.0, 3.0, CZ); G.add(canopy);
const canLight=new THREE.Mesh(new THREE.PlaneGeometry(3.2, 12.4), new THREE.MeshStandardMaterial({color:0xfff2d0, emissive:0xfff0c0, emissiveIntensity:0.3, roughness:0.9}));
canLight.rotation.x=Math.PI/2; canLight.position.set(oMinX-2.0, 2.82, CZ); G.add(canLight);

/* --- レンガ舗装（写真7/8/9） --- */
function brickTex(w,h,bw,bh,base,mortar){
  const cv=document.createElement('canvas'); cv.width=w; cv.height=h; const c=cv.getContext('2d');
  c.fillStyle=mortar; c.fillRect(0,0,w,h);
  let s=7;
  for(let y=0;y<h;y+=bh){ const off=((y/bh)%2)*bw/2;
    for(let x=-bw;x<w+bw;x+=bw){ s=(s*1103515245+12345)&0x7fffffff; const v=((s>>8)%40)-20;
      c.fillStyle='rgb('+(base[0]+v)+','+(base[1]+v*0.6|0)+','+(base[2]+v*0.4|0)+')'; c.fillRect(x+off+1,y+1,bw-2,bh-2); } }
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}
const paveT=brickTex(256,256,32,16,[158,84,52],'#b9a898'); paveT.repeat.set(PLAZA.w/2, PLAZA.d/2);
plazaFloor.material=new THREE.MeshStandardMaterial({map:paveT, roughness:0.95});
/* 広場西端の段（写真7: 広場は前面道路より高い） */
const stepMat=new THREE.MeshStandardMaterial({color:0x9c8d80, roughness:0.9});
for(let k=0;k<3;k++){
  const s=new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.15, PLAZA.d), stepMat);
  s.position.set(PLAZA.x-PLAZA.w/2-0.45-k*0.9, 0.45-0.075-k*0.15, PLAZA.z); G.add(s);
}

/* --- 別館: レンガ造 宇都宮市体育館（写真2/4/9・南西） --- */
const wallT=brickTex(256,128,32,12,[139,75,46],'#a8968a'); wallT.repeat.set(6,3);
const annexMat=new THREE.MeshStandardMaterial({map:wallT, roughness:0.9});
const AX=oMinX+7, AZ=CZ+38, AW=18, AD=22, AH=8.6;
const annex=new THREE.Mesh(new THREE.BoxGeometry(AW, AH, AD), annexMat); annex.position.set(AX, AH/2, AZ); G.add(annex);
const aRoof=new THREE.Mesh(new THREE.BoxGeometry(AW+0.8, 0.5, AD+0.8), new THREE.MeshStandardMaterial({color:0x2a2c33, roughness:0.7})); aRoof.position.set(AX, AH+0.25, AZ); G.add(aRoof);
const winMat=new THREE.MeshStandardMaterial({color:0x1a2438, roughness:0.3, metalness:0.5});
[2.2,5.4].forEach(y=>{ const w=new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.5, AD-4), winMat); w.position.set(AX-AW/2-0.1, y, AZ); G.add(w); });
const aSign=makeLabel('宇都宮市体育館', 3.2, '#ffffff'); aSign.position.set(AX-AW/2-1.2, AH-1.2, AZ); G.add(aSign);
/* 外階段（レンガ・広場からテラスへ） */
for(let k=0;k<12;k++){
  const s=new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3*(k+1), 3.6), annexMat);
  s.position.set(AX-AW/2-8.5+k*0.42, 0.45+0.3*(k+1)/2, AZ+AD/2+2.2); G.add(s);
}
const terrace=new THREE.Mesh(new THREE.BoxGeometry(AW+2, 0.4, 4), annexMat); terrace.position.set(AX, 0.45+3.6, AZ+AD/2+2.2); G.add(terrace);
const parapet=new THREE.Mesh(new THREE.BoxGeometry(AW+2, 1.0, 0.3), annexMat); parapet.position.set(AX, 0.45+4.5, AZ+AD/2+4.05); G.add(parapet);

/* --- ゲームデー装飾（写真7・夜） --- */
const navy=new THREE.MeshStandardMaterial({color:0x1c2856, roughness:0.85});
const arch=new THREE.Mesh(new THREE.TorusGeometry(7.5, 0.75, 12, 40, Math.PI), navy);
arch.rotation.y=Math.PI/2; arch.position.set(PLAZA.x-14, 0.45, CZ); G.add(arch);
const archLb=makeLabel('WELCOME TO BREX HOME GAME', 4.2, '#ffffff'); archLb.position.set(PLAZA.x-14, 9.6, CZ); G.add(archLb);
/* マスコット（ブレッキー）: 簡略造形 */
(function(){
  const g=new THREE.Group(); const orange=new THREE.MeshStandardMaterial({color:0xf0892a, roughness:0.7});
  const body=new THREE.Mesh(new THREE.SphereGeometry(1.6,14,10), orange); body.position.y=1.7; body.scale.set(1,1.15,1);
  const head=new THREE.Mesh(new THREE.SphereGeometry(1.15,14,10), orange); head.position.y=3.9;
  const jersey=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.55,1.3,14), new THREE.MeshStandardMaterial({color:0xf5c400, roughness:0.7})); jersey.position.y=1.9;
  const eyeM=new THREE.MeshStandardMaterial({color:0x111111});
  [-0.4,0.4].forEach(x=>{ const e=new THREE.Mesh(new THREE.SphereGeometry(0.14,8,6), eyeM); e.position.set(x,4.1,-1.0); g.add(e);
    const ear=new THREE.Mesh(new THREE.SphereGeometry(0.42,10,8), orange); ear.position.set(x*2.2,4.8,0); g.add(ear); });
  g.add(body, head, jersey);
  g.position.set(PLAZA.x-6, 0.45, CZ-9); G.add(g);
  const lb=makeLabel('ブレッキー', 2.6, '#f5c400'); lb.position.set(PLAZA.x-6, 6.4, CZ-9); G.add(lb);
})();
/* 旗ポール×3 */
const poleM=new THREE.MeshStandardMaterial({color:0xd8dbe0, roughness:0.5, metalness:0.6});
[-20,-14,-8].forEach(z=>{
  const p=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.16,14,8), poleM); p.position.set(PLAZA.x-30, 7.45, CZ+z); G.add(p);
  const f=new THREE.Mesh(new THREE.PlaneGeometry(2.6,1.6), new THREE.MeshStandardMaterial({color:0xf5c400, roughness:0.8, side:THREE.DoubleSide}));
  f.position.set(PLAZA.x-30+1.35, 13.4, CZ+z); G.add(f);
});
/* 黒テント×2 */
const tentM=new THREE.MeshStandardMaterial({color:0x141418, roughness:0.9});
[[PLAZA.x+8, CZ+16],[PLAZA.x+8, CZ+23]].forEach(p=>{
  const t=new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.6, 4), tentM); t.rotation.y=Math.PI/4; t.position.set(p[0], 0.45+2.6+0.8, p[1]); G.add(t);
  [[-1.9,-1.9],[1.9,-1.9],[-1.9,1.9],[1.9,1.9]].forEach(q=>{ const l=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,2.6,6), poleM); l.position.set(p[0]+q[0], 0.45+1.3, p[1]+q[1]); G.add(l); });
});

/* --- 夜間: ガラスの内部照明・キャノピー --- */
const baseLoop12=loop;
loop=function(now){
  baseLoop12(now);
  const n=window.__nightK||0;
  facadeMat.emissiveIntensity=0.05+0.75*n;
  canLight.material.emissiveIntensity=0.3+0.9*n;
};
window.__photoExt=G;
})();
