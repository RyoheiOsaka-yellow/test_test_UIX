/* ================= ◆ 点群ビュー（LiDAR 風の高密度点群） =================
   実測 DSM（兵庫県 1m → 3m 間引き / 城郭 2m）に、PLATEAU の建物形状（LOD2 屋根面・壁面の三角形、LOD1 の壁・屋根）を面サンプリングして補完する。
   ・面ごとの法線 × 太陽方向で陰影、床割り・窓の反射率パターン（LiDAR 強度風）、8% の欠測、強度ノイズ
   ・姫路城: 城郭 2m DSM（石垣・櫓・樹木・堀）＋ 大天守・小天守の立体モデル表面 ＋ PLATEAU 城郭建物（漆喰＝象牙色、瓦＝灰青）
   ・樹木は樹冠の体積（DSM 高さから下方向に散らす）、道路面は地表反射点、公園・水面は面内グリッド
   ・色: 分類（地表 / 建物壁 / 屋根 / 植生 / 水域 / 城郭）または 標高ランプ。距離減衰つき丸点シェーダ（加算合成）、LiDAR スキャンスイープ演出
   追加点は実測ではなく、建物形状からの補完（画面に明記） */
const PCV = { sweep:true, size:1.0, color:'class', built:false, mats:[], pts:[], n:{facade:0, roof:0, castle:0, veg:0, ground:0, dsm:0}, group:new THREE.Group() };
PCV.group.visible=false; scene.add(PCV.group);
function pcvMat(center, span){
  const u={ uTime:{value:0}, uC:{value:new THREE.Vector2(center[0], center[1])}, uSweep:{value:1}, uSize:{value:1}, uSpan:{value:span} };
  const m=new THREE.ShaderMaterial({ uniforms:u, vertexColors:true, transparent:true, depthWrite:true, depthTest:true, blending:THREE.NormalBlending,
    vertexShader:['varying vec3 vC; varying float vG; varying float vD; uniform float uTime,uSweep,uSize,uSpan; uniform vec2 uC;',
      'void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0);',
      ' float r=mod(uTime*0.11,1.0)*uSpan; float d=distance(position.xz,uC);',
      ' vG=uSweep*exp(-abs(d-r)/(uSpan*0.02)); vD=clamp(-mv.z/9000.0,0.0,1.0);',
      ' gl_PointSize=clamp(uSize*(1.25+1.8*vG)*(420.0/-mv.z)*2.2,1.0,5.0); gl_Position=projectionMatrix*mv; }'].join('\n'),
    fragmentShader:['varying vec3 vC; varying float vG; varying float vD; void main(){ vec2 p=gl_PointCoord-0.5; float q=dot(p,p); if(q>0.25) discard;',
      ' if(q>0.25*(1.0-0.45*vD)) discard; float a=(1.0-0.55*vD)*smoothstep(0.25,0.16,q); gl_FragColor=vec4(vC*(0.92+1.2*vG), a); }'].join('\n') });
  PCV.mats.push(m); return m;
}
function pcvPoints(pos, colA, colB, mat){ const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colA,3)); const p=new THREE.Points(g, mat); p.frustumCulled=false; p.userData.colClass=p.geometry.getAttribute('color'); p.userData.colHeight=new THREE.Float32BufferAttribute(colB,3); PCV.pts.push(p); return p; }
function pcvInPoly(x, y, poly){ let c=false; for(let i=0, j=poly.length-1; i<poly.length; j=i++){ const xi=poly[i][0], yi=poly[i][1], xj=poly[j][0], yj=poly[j][1]; if(((yi>y)!==(yj>y)) && (x<(xj-xi)*(y-yi)/(yj-yi)+xi)) c=!c; } return c; }
/* 標高ランプ（LiDAR の定番: 紺 → 青 → 水色 → 緑 → 黄 → 白） */
const PCV_RAMP=[[0x1b2f6e],[0x2f6fd0],[0x36c9e0],[0x62d77a],[0xf2e14a],[0xffffff]].map(c=>new THREE.Color(c[0]));
function pcvRamp(t, out){ t=Math.max(0, Math.min(0.999, t))*(PCV_RAMP.length-1); const i=Math.floor(t); return out.copy(PCV_RAMP[i]).lerp(PCV_RAMP[i+1], t-i); }
function pcvBuild(){
  if(PCV.built) return; PCV.built=true;
  const t0=performance.now(); const rnd=mulberry32(1993); const tmp=new THREE.Color(), tmp2=new THREE.Color();
  const budget=(window.TWIN_CONFIG&&TWIN_CONFIG.pcView&&TWIN_CONFIG.pcView.budget)||900000;
  const SUN=new THREE.Vector3(-600,900,400).normalize();
  const C={ wallLo:new THREE.Color(0x2c5f8e), wallHi:new THREE.Color(0x9fd9f2), roofLo:new THREE.Color(0x7fb3cf), roofHi:new THREE.Color(0xe4f7ff),
            ivory:new THREE.Color(0xf4eedc), tile:new THREE.Color(0x6f8299), stone:new THREE.Color(0x8d8677), gold:new THREE.Color(0xffd166),
            ground:new THREE.Color(0x2a4463), road:new THREE.Color(0x4a5a74), park:new THREE.Color(0x3a9a6c), forest:new THREE.Color(0x2c7d55), canopy:new THREE.Color(0x41a061),
            water:new THREE.Color(0x1f5fb8), moat:new THREE.Color(0x2a78d6), edu:new THREE.Color(0x3a6d8a), retail:new THREE.Color(0x4a6d9a) };
  const ZMIN=TH(CASTLE.x, CASTLE.z)-8, ZSPAN=120;   // 標高ランプの範囲（城の地盤 〜 +120m）
  /* 出力バッファ（分類色 / 標高色） */
  const out={ pos:[], ca:[], cb:[] };
  const push=(x,y,z, c, k)=>{ out.pos.push(x,y,z); out.ca.push(c.r*k, c.g*k, c.b*k); pcvRamp((y-ZMIN)/ZSPAN, tmp2); out.cb.push(tmp2.r*k, tmp2.g*k, tmp2.b*k); };
  const noise=()=>{ const r=rnd(); return r<0.06 ? 0.45+rnd()*0.2 : 0.86+rnd()*0.28; };   // 6% は低反射（ガラス・濡れ面）
  const full=(f)=>out.pos.length/3 > budget*(f||1);   // 段階ごとの上限（LOD2 20% / LOD1 〜60% / 城郭 〜80% / 植生・水面 〜92% / 道路 〜100%）
  /* --- 三角形の面サンプリング（面積 / d² 個、法線で陰影） --- */
  const A=new THREE.Vector3(), Bv=new THREE.Vector3(), Cv=new THREE.Vector3(), N=new THREE.Vector3(), E1=new THREE.Vector3(), E2=new THREE.Vector3();
  function sampleTri(ax,ay,az,bx,by,bz,cx,cy,cz, d2, cb){
    E1.set(bx-ax,by-ay,bz-az); E2.set(cx-ax,cy-ay,cz-az); N.crossVectors(E1,E2); const area=N.length()*0.5; if(area<0.05) return; N.divideScalar(area*2);
    const shade=0.55+0.45*Math.max(0, N.dot(SUN)) + 0.12*Math.max(0, -N.dot(SUN));
    let n=area/d2; n=Math.floor(n)+(rnd()<n-Math.floor(n)?1:0);
    for(let i=0;i<n;i++){ let u=rnd(), v=rnd(); if(u+v>1){ u=1-u; v=1-v; } if(rnd()<0.08) continue;   // 8% 欠測
      cb(ax+E1.x*u+E2.x*v, ay+E1.y*u+E2.y*v, az+E1.z*u+E2.z*v, N.y, shade); }
  }
  /* ===== 1. PLATEAU LOD2（屋根面・壁面の三角形） ===== */
  const l2done=new Set();
  if(typeof PLATEAU!=='undefined' && PLATEAU.l2 && PL && PL.ext){
    const roof=decI16(PLATEAU.l2.roof), wall=decI16(PLATEAU.l2.wall), B=PLATEAU.l2.b||[];
    const tri=(src, t, isRoof, b, d2)=>{
      const hh=Math.max(3,b.h||8), g=b.g||TH(src[t]/10, -src[t+1]/10);
      sampleTri(src[t]/10, src[t+2]/10, -src[t+1]/10, src[t+3]/10, src[t+5]/10, -src[t+4]/10, src[t+6]/10, src[t+8]/10, -src[t+7]/10, d2, (x,y,z,ny,sh)=>{
        const r=Math.max(0, Math.min(1, (y-g)/hh));
        if(b.c){ if(isRoof) tmp.copy(C.tile).lerp(C.ivory, 0.12); else tmp.copy(C.ivory).lerp(C.stone, r<0.28?0.7:0); }
        else if(isRoof) tmp.copy(C.roofLo).lerp(C.roofHi, r*0.7+0.3);
        else { tmp.copy(C.wallLo).lerp(C.wallHi, r); const fl=Math.floor((y-g)/3.2), bay=Math.floor((x*0.29+z*0.31)); if(((fl*73856093 ^ bay*19349663)>>>0)%100 < 32) sh*=0.62; }   // 窓（低反射）
        push(x, y+0.15, z, tmp, sh*noise()); });
    };
    for(const [r0,nr,w0,nw,ei] of B){ if(full(0.22)) break; const b=PL.ext[ei]; if(!b || b.keep) continue; l2done.add(ei);
      const q=b.p[0], near=(q[0]*q[0]+q[1]*q[1]) < 1500*1500; const d2r=near?3.2:6, d2w=near?4.0:8;
      for(let t=r0*9; t<(r0+nr)*9; t+=9) tri(roof, t, true, b, d2r);
      for(let t=w0*9; t<(w0+nw)*9; t+=9) tri(wall, t, false, b, d2w); }
  }
  PCV.n.roof=out.pos.length/3;
  /* ===== 2. PLATEAU LOD1（壁の面サンプリング＋屋根の面内グリッド）と PLATEAU 外の OSM 建物 ===== */
  const R2=2200*2200;
  const plateau=(typeof PL!=='undefined' && PL.ext && PL.ext.length) ? PL.ext.filter((b,i)=>!b.keep && !l2done.has(i)).map(b=>({p:b.p, h:b.h, g:b.g, k:b.c?'castle':'', src:'plateau'})) : [];
  const osm = plateau.length ? SCENE_DATA.buildings.filter(b=>{ const q=b.p[0]; return (q[0]*q[0]+q[1]*q[1])>=R2; }) : SCENE_DATA.buildings;
  const dist=b=>{ const q=b.p[0]; return q[0]*q[0]+q[1]*q[1]; };
  for(const b of plateau.concat(osm).sort((a,b)=>dist(a)-dist(b))){   // 近い建物から（上限に達したら遠方が抜ける）
    if(full(0.6)) break; const fp=b.p, hh=Math.max(3, b.h||8); const q=fp[0]; const near=(q[0]*q[0]+q[1]*q[1])<R2; const castle=b.k==='castle';
    const step=castle?1.6:near?3.0:9, vstep=castle?1.4:near?2.4:4;
    /* 壁 */
    for(let i=0;i<fp.length;i++){ const a=fp[i], c=fp[(i+1)%fp.length]; const L=Math.hypot(c[0]-a[0], c[1]-a[1]); if(L<0.5) continue; const n=Math.max(1, Math.floor(L/step));
      const nx=(c[1]-a[1])/L, nz=(c[0]-a[0])/L; const sh=0.55+0.45*Math.max(0, nx*SUN.x + nz*SUN.z);   // 壁の法線（外向きは不定なので左右対称に）
      for(let j=0;j<=n;j++){ const k=j/n, x=a[0]+(c[0]-a[0])*k, y=a[1]+(c[1]-a[1])*k; const base=TH(x,-y); const bay=Math.floor(j*step/3.4);
        for(let h=0.6; h<hh; h+=vstep){ if(rnd()<0.08) continue; const r=h/hh; let kk=sh;
          if(castle) tmp.copy(C.ivory).lerp(C.stone, r<0.3?0.7:0); else { tmp.copy(C.wallLo).lerp(C.wallHi, r); const fl=Math.floor(h/3.2); if(((fl*73856093 ^ (bay+i*97)*19349663)>>>0)%100 < 32) kk*=0.62; }
          push(x+(rnd()-0.5)*0.35, base+h+(rnd()-0.5)*0.3, -y+(rnd()-0.5)*0.35, tmp, kk*noise()); }
        if(!near && !castle) break; } }
    /* 屋根（近傍のみ）: 面内グリッド */
    if(near || castle){ let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; for(const p of fp){ if(p[0]<x0)x0=p[0]; if(p[0]>x1)x1=p[0]; if(p[1]<y0)y0=p[1]; if(p[1]>y1)y1=p[1]; }
      const gs=castle?1.8:3.2; if((x1-x0)*(y1-y0) < 40000) for(let x=x0; x<=x1; x+=gs) for(let y=y0; y<=y1; y+=gs){ const jx=x+(rnd()-0.5)*gs*0.7, jy=y+(rnd()-0.5)*gs*0.7; if(!pcvInPoly(jx,jy,fp) || rnd()<0.08) continue;
        if(castle) tmp.copy(C.tile); else tmp.copy(C.roofLo).lerp(C.roofHi, Math.min(1, hh/40)*0.6+0.35);
        push(jx, TH(jx,-jy)+hh+0.2+(rnd()-0.5)*0.25, -jy, tmp, (0.9+0.1*rnd())*noise()); } }
  }
  PCV.n.facade=out.pos.length/3-PCV.n.roof;
  /* ===== 3. 姫路城: 城郭 2m DSM（石垣・櫓・樹冠・堀）＋ 大天守・小天守モデル表面 ===== */
  const c0=out.pos.length/3;
  if(typeof REAL!=='undefined' && REAL && REAL.castle){
    const g=REAL.castle, H=decI16(g.h), ND=decI16(g.nd), CL=decU8(g.c); const nx=g.nx, ny=g.ny, st=g.step; const KX=CASTLE.x, KZ=CASTLE.z; const EX=150, EY=-10, ERX=470, ERY=410;
    const grass=new THREE.Color(0x6a8f3a), gnd=new THREE.Color(0x5b5a52);
    for(let j=0;j<ny && !full(0.8);j++) for(let i=0;i<nx;i++){ const gi=j*nx+i; let h=H[gi]*0.1, nd=ND[gi]*0.1; const cl=CL[gi]; if(h<-900) continue;
      const vx=g.x0+i*st, vy=g.y0+j*st; const e=Math.pow((vx-EX)/ERX,2)+Math.pow((vy-EY)/ERY,2); if(e>1) continue;
      const dk=Math.hypot(vx-KX, vy+KZ); if(dk<40){ h=Math.min(h, TH(KX,KZ)+18); nd=Math.min(nd,18); }
      if(e>0.82){ const t=Math.min(1,(e-0.82)/0.18); h=h*(1-t)+(TH(vx,-vy)+0.4)*t; }
      const hl=H[j*nx+Math.max(0,i-1)]*0.1, hr=H[j*nx+Math.min(nx-1,i+1)]*0.1, hu=H[Math.min(ny-1,j+1)*nx+i]*0.1, hd=H[Math.max(0,j-1)*nx+i]*0.1;
      const slope=Math.max(Math.abs(hr-hl), Math.abs(hu-hd))/(2*st); const sh=0.72+0.28*Math.min(1, Math.max(0, (hr-hl)*0.5+0.5));
      let extra=0;
      if(cl===3) tmp.copy(C.moat);
      else if(cl===1 && nd>9) tmp.copy(C.ivory).lerp(C.tile, 0.35);
      else if(cl===1) tmp.copy(C.stone).lerp(C.ivory, 0.3);
      else if(slope>0.9) tmp.copy(C.stone);
      else if(cl===2 && nd>3){ tmp.copy(C.canopy).lerp(grass, Math.min(1,(nd-3)/12)*0.4); extra=nd>6?2:1; }
      else tmp.copy(gnd).lerp(grass, 0.45);
      const jx=vx+(rnd()-0.5)*1.2, jy=vy+(rnd()-0.5)*1.2;
      push(jx, h+0.3, -jy, tmp, sh*noise());
      for(let k=0;k<extra;k++){ const dz=nd*(0.15+rnd()*0.55); push(jx+(rnd()-0.5)*2.4, h-dz, -jy+(rnd()-0.5)*2.4, tmp2.copy(C.forest).lerp(C.canopy, rnd()*0.5), (0.55+0.35*rnd())*noise()); }   // 樹冠の体積
      if(cl===1 && nd>9 && rnd()<0.35) push(jx, h-nd*rnd()*0.85, -jy, tmp2.copy(C.ivory), 0.7*noise());   // 櫓・門の壁面（DSM には無いので補完）
    }
    /* 大天守・小天守（立体モデルの表面を面サンプリング） */
    if(typeof CASTLE_MESHES!=='undefined'){ const v=new THREE.Vector3(), m4=new THREE.Matrix4();
      for(const m of CASTLE_MESHES){ if(!m.geometry || !(m.material===KEEP_MAT.gold||m.material===KEEP_MAT.roof||m.material===KEEP_MAT.stone||m.material===KEEP_MAT.wall)) continue; m.updateWorldMatrix(true,false); m4.copy(m.matrixWorld); const P=m.geometry.attributes.position, I=m.geometry.index; const nT=I?I.count/3:P.count/3;
        const mat=m.material; const col=(mat===KEEP_MAT.gold)?C.gold:(mat===KEEP_MAT.roof)?C.tile:(mat===KEEP_MAT.stone)?C.stone:C.ivory;
        const q=[0,0,0,0,0,0,0,0,0];
        for(let t=0;t<nT;t++){ for(let k=0;k<3;k++){ const vi=I?I.getX(t*3+k):t*3+k; v.fromBufferAttribute(P,vi).applyMatrix4(m4); q[k*3]=v.x; q[k*3+1]=v.y; q[k*3+2]=v.z; }
          sampleTri(q[0],q[1],q[2],q[3],q[4],q[5],q[6],q[7],q[8], 1.1, (x,y,z,ny,sh)=>{ push(x,y,z, col, sh*(col===C.ivory?1.05:1)*noise()); }); } } }
  }
  PCV.n.castle=out.pos.length/3-c0;
  /* ===== 4. 公園・森・水面・堀・道路: 面内グリッド（森・公園は樹冠の体積） ===== */
  const g0=out.pos.length/3; const luCol={park:C.park, forest:C.forest, water:C.water, moat:C.moat, edu:C.edu, retail:C.retail};
  for(const key of Object.keys(luCol)){ const polys=SCENE_DATA.lu[key]||[]; const gs=(key==='water'||key==='moat')?4.5:6.5;
    for(const poly of polys){ if(full(0.92)) break; let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; for(const p of poly){ if(p[0]<x0)x0=p[0]; if(p[0]>x1)x1=p[0]; if(p[1]<y0)y0=p[1]; if(p[1]>y1)y1=p[1]; }
      if((x1-x0)*(y1-y0) > 4e6) continue;
      for(let x=x0; x<=x1; x+=gs) for(let y=y0; y<=y1; y+=gs){ const jx=x+(rnd()-0.5)*gs*0.7, jy=y+(rnd()-0.5)*gs*0.7; if(!pcvInPoly(jx,jy,poly)) continue; const base=TH(jx,-jy);
        if(key==='forest'||key==='park'){ const top=(key==='forest'?7:3)+rnd()*(key==='forest'?9:5); push(jx, base+top, -jy, tmp.copy(C.canopy).lerp(luCol[key], 0.5), (0.75+0.25*rnd())*noise());
          if(rnd()<0.7) push(jx+(rnd()-0.5)*3, base+top*(0.35+rnd()*0.45), -jy+(rnd()-0.5)*3, luCol[key], (0.5+0.3*rnd())*noise()); }
        else push(jx, base+0.25, -jy, luCol[key], (0.8+0.2*rnd())*noise()); } } }
  PCV.n.veg=out.pos.length/3-g0;
  /* 道路面（PLATEAU roads = OSM 中心線バッファ）: 地表反射点 */
  const r0=out.pos.length/3;
  if(typeof PLATEAU!=='undefined' && PLATEAU.roads && typeof decodePolys==='function'){ const rd=decodePolys(PLATEAU.roads); const gs=5.5; let cnt=0;
    for(const it of rd){ if(cnt>150000 || full()) break; const poly=it.rings[0]; if(!poly || poly.length<3) continue; let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; for(const p of poly){ if(p[0]<x0)x0=p[0]; if(p[0]>x1)x1=p[0]; if(p[1]<y0)y0=p[1]; if(p[1]>y1)y1=p[1]; }
      if((x1-x0)*(y1-y0) > 2.5e5) continue;
      for(let x=x0; x<=x1; x+=gs) for(let y=y0; y<=y1; y+=gs){ const jx=x+(rnd()-0.5)*gs*0.8, jy=y+(rnd()-0.5)*gs*0.8; if(!pcvInPoly(jx,jy,poly) || rnd()<0.15) continue; push(jx, TH(jx,-jy)+0.2, -jy, C.road, (0.7+0.3*rnd())*noise()); cnt++; } } }
  PCV.n.ground=out.pos.length/3-r0;
  const mat=pcvMat([CASTLE.x, CASTLE.z], 3600);
  PCV.group.add(pcvPoints(out.pos, out.ca, out.cb, mat));
  /* 既存の DSM 点群（REAL.pc、3m）とレイヤー補完点も同じスイープ材質へ。分類色は既存のまま、標高色を追加 */
  pcGroup.children.forEach(p=>{ if(p.isPoints && p.geometry.getAttribute('color')){ p.userData.pcvOrig=p.material; p.material=pcvMat([CASTLE.x, CASTLE.z], 3600); const P=p.geometry.getAttribute('position'), n=P.count; PCV.n.dsm+=n;
    const cb=new Float32Array(n*3); for(let i=0;i<n;i++){ pcvRamp((P.getY(i)-ZMIN)/ZSPAN, tmp2); cb[i*3]=tmp2.r*0.95; cb[i*3+1]=tmp2.g*0.95; cb[i*3+2]=tmp2.b*0.95; }
    p.userData.colClass=p.geometry.getAttribute('color'); p.userData.colHeight=new THREE.BufferAttribute(cb,3); PCV.pts.push(p); } });
  PCV.total=out.pos.length/3+PCV.n.dsm; PCV.buildMs=Math.round(performance.now()-t0);
  pcvApplyColor();
  console.log('PCV build', PCV.n, 'total', PCV.total, PCV.buildMs+'ms');
}
function pcvApplyColor(){ PCV.pts.forEach(p=>{ const a=PCV.color==='height'?p.userData.colHeight:p.userData.colClass; if(a && p.geometry.getAttribute('color')!==a){ p.geometry.setAttribute('color', a); a.needsUpdate=true; } }); }
/* 既存 buildPC / setPCMode を拡張 */
const _pcvBaseSetPC = setPCMode;
setPCMode = function(on){
  _pcvBaseSetPC(on);
  if(on){ if(!PCV.built) pcvBuild(); PCV.group.visible=true; wrap.classList.add('pc-grad'); pcvHideSolids(true);
    if(window.twinPcl && twinPcl.mode!=='LIDAR'){ PCV.prevPclMode=twinPcl.mode; twinPcl.mode='LIDAR'; pclApplyMode(); } }
  else { PCV.group.visible=false; pcvHideSolids(false); if(window.twinPcl && PCV.prevPclMode){ twinPcl.mode=PCV.prevPclMode; PCV.prevPclMode=null; pclApplyMode(); } }
  renderPanel();
};
/* 点群ビューでは PLATEAU の面（LOD1/LOD2）・土地利用面・道路面・補完ディテール・城郭レリーフ・天守モデルを隠し、点だけにする */
function pcvHideSolids(on){
  if(typeof PL!=='undefined'){ PL.group.visible=!on; PL.lu.visible=!on && LAYER_STATE.plu; PL.road.visible=!on && LAYER_STATE.proad; }
  if(typeof urbanDetail!=='undefined') urbanDetail.visible=!on && level!=='wide';
  if(typeof castleRelief!=='undefined' && castleRelief){ if(on) PCV.reliefWas=castleRelief.visible; castleRelief.visible = on ? false : (PCV.reliefWas!==undefined ? PCV.reliefWas : castleRelief.visible); }
  if(typeof CASTLE_MESHES!=='undefined') CASTLE_MESHES.forEach(m=>{ if(on){ if(m.userData.pcvVis===undefined) m.userData.pcvVis=m.visible; m.visible=false; } else if(m.userData.pcvVis!==undefined){ m.visible=m.userData.pcvVis; delete m.userData.pcvVis; } });
  if(!on && typeof syncRefinement==='function') syncRefinement();
}
function pcvTick(now){ if(!pcMode) return; if(typeof PL!=='undefined') PL.group.visible=false; if(typeof urbanDetail!=='undefined') urbanDetail.visible=false; if(typeof castleRelief!=='undefined' && castleRelief) castleRelief.visible=false; PCV.mats.forEach(m=>{ m.uniforms.uTime.value=now/1000; m.uniforms.uSweep.value=PCV.sweep?1:0; m.uniforms.uSize.value=PCV.size; }); }
function pcvSec(){
  if(!pcMode) return '';
  const n=PCV.n;
  return `<div class="sec" id="pcv-sec"><div class="sec-t"><b>◆ 点群ビュー</b> — LiDAR 風 高密度点群${PCV.built?`（${fmt(PCV.total)} 点）`:''}</div>
    <div class="row-btns"><button class="chip ${PCV.color==='class'?'active':''}" data-pcvc="class">分類色</button><button class="chip ${PCV.color==='height'?'active':''}" data-pcvc="height">標高</button><button class="chip ${PCV.sweep?'active':''}" id="pcv-sweep">スキャン</button></div>
    <div class="studio-label" style="margin:6px 0 4px">点サイズ <output id="pcv-sz">${PCV.size.toFixed(1)}</output></div><input type="range" id="pcv-size" min="0.5" max="2.5" step="0.1" value="${PCV.size}" style="width:100%">
    ${PCV.built?`<div class="hint" style="margin-top:6px">屋根・壁（LOD2 面サンプリング）${fmt(n.roof)}　壁・屋根（LOD1）${fmt(n.facade)}　城郭（2m DSM＋天守）${fmt(n.castle)}　樹木・水面 ${fmt(n.veg)}　道路 ${fmt(n.ground)}　DSM 3m ${fmt(n.dsm)}　生成 ${PCV.buildMs} ms</div>`:''}
    <div class="hint" style="margin-top:6px">実測: 兵庫県 DSM（3m／城郭 2m）。補完: PLATEAU 建物形状（LOD2 屋根面・壁面、LOD1）を面サンプリングし、法線×太陽で陰影、窓の低反射、8% 欠測。姫路城は石垣・櫓・樹冠の体積を DSM から、大天守は立体モデル表面から生成。スイープは LiDAR 走査の演出（実測ではありません）。人流粒子は LIDAR モードに切替。</div></div>`;
}
function bindPcv(){ const s=document.getElementById('pcv-sweep'); if(s) s.onclick=()=>{ PCV.sweep=!PCV.sweep; renderPanel(); }; document.querySelectorAll('[data-pcvc]').forEach(b=> b.onclick=()=>{ PCV.color=b.dataset.pcvc; pcvApplyColor(); renderPanel(); }); const r=document.getElementById('pcv-size'); if(r) r.oninput=()=>{ PCV.size=+r.value; document.getElementById('pcv-sz').value=PCV.size.toFixed(1); }; }
window.twinPcv = PCV;
