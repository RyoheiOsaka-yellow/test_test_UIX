
/* ================= PLATEAU 姫路市 3D都市モデル（実データ）: 建物 LOD2/LOD1・土地利用・道路面・橋梁 =================
   出典: 国土交通省 PLATEAU 姫路市 2023年度 CityGML（仕様4.1）。prep_plateau.py で軽量化（LOD2＝中心1.7km の屋根面・壁面、LOD1＝計測高さ付きフットプリント）
   LOD 設計: 近距離（視点半径 < 2,800m）＝LOD2 屋根形状 ／ 中距離＝LOD1 押し出し ／ 遠距離＝フラット近似・点描 */
const PLATEAU = SCENE_DATA.plateau || null;
const PL = { ext:[], meshes:[], lod2:null, socle:null, l2AsL1:null, near:null, group:new THREE.Group(), lu:new THREE.Group(), road:new THREE.Group() };
const USAGE_NAME = {'401':'業務施設','402':'商業施設','403':'宿泊施設','404':'商業系複合施設','411':'住宅','412':'共同住宅','413':'店舗等併用住宅','414':'店舗等併用共同住宅','415':'作業所併用住宅','421':'官公庁施設','422':'文教厚生施設','431':'運輸倉庫施設','441':'工場','451':'農林漁業用施設','452':'供給処理施設','453':'防衛施設','454':'その他','461':'不明'};
const LUSE_NAME = {'211':'住宅用地','212':'商業用地','213':'工業用地','214':'公益施設用地','217':'公共空地（公園・緑地・広場）','204':'水面','201':'田','202':'畑','203':'山林','216':'交通施設用地','222':'平面駐車場','223':'その他の都市的土地利用'};
const LUSE_COL = {'211':0x1a2130,'212':0x2a2238,'213':0x2a2620,'214':0x1c2a30,'217':0x1a2e24,'204':0x16283f,'201':0x1e2a1a,'202':0x22291b,'203':0x14241b,'216':0x262a34,'222':0x22252c,'223':0x24262c};
const ROAD_COL = [0x1f2534, 0x262d3c, 0x2c3446, 0x3a3348, 0x2f3a42];   // 細街路 / 主要道 / 幹線 / 歩行者・商店街 / 歩道・小径
function decU16(b64){ const bin=atob(b64); const n=bin.length>>1; const a=new Uint16Array(n); for(let i=0;i<n;i++) a[i] = bin.charCodeAt(2*i) | (bin.charCodeAt(2*i+1)<<8); return a; }
function decodePolys(P, unit=5){
  if(!P || !P.n) return [];
  const v=decI16(P.v), rn=decU16(P.rn), pr=decU16(P.pr), c=decU8(P.c); const out=[]; let vi=0, ri=0;
  for(let k=0;k<pr.length;k++){
    const rings=[];
    for(let r=0;r<pr[k];r++){ const m=rn[ri++]; const ring=new Array(m); for(let j=0;j<m;j++){ ring[j]=[v[vi*2]/unit, v[vi*2+1]/unit]; vi++; } rings.push(ring); }
    out.push({rings, c:c[k]});
  }
  return out;
}
function shapeWithHoles(rings){
  const s = polyShape(rings[0]);
  for(let i=1;i<rings.length;i++){ const h=new THREE.Path(); h.moveTo(rings[i][0][0], rings[i][0][1]); for(let j=1;j<rings[i].length;j++) h.lineTo(rings[i][j][0], rings[i][j][1]); s.holes.push(h); }
  return s;
}
function mergedFlatH(items, mat, y){
  const arrs=[]; let total=0;
  items.forEach(it=>{ try{ const g0=new THREE.ShapeGeometry(shapeWithHoles(it.rings)); const g=g0.index?g0.toNonIndexed():g0; if(TERRAIN_ON){ const ar=g.attributes.position.array; for(let k=0;k<ar.length;k+=3) ar[k+2]=TH(ar[k], -ar[k+1]); } arrs.push(g.attributes.position.array); total+=g.attributes.position.array.length; }catch(e){} });
  const pos=new Float32Array(total); let o=0; arrs.forEach(a=>{ pos.set(a,o); o+=a.length; });
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const m=new THREE.Mesh(geo, mat); m.rotation.x=-Math.PI/2; m.position.y=y; return m;
}
/* 押し出し統合メッシュ（建物インデックス属性付き → クリックで建物情報） */
function mergedExtrudeB(list, mat, depthFn){
  const arrs=[], bids=[]; let total=0;
  list.forEach(b=>{
    try{
      let cx=0, cy=0; b.p.forEach(q=>{cx+=q[0]; cy+=q[1];}); cx/=b.p.length; cy/=b.p.length; const hh=TH(cx,-cy);
      const depth = depthFn ? depthFn(b, hh) : b.h; if(depth<=0.05) return;
      const g0=new THREE.ExtrudeGeometry(polyShape(b.p), {depth, bevelEnabled:false}); const g=g0.index?g0.toNonIndexed():g0;
      const ar=g.attributes.position.array; for(let k=2;k<ar.length;k+=3) ar[k]+=hh;
      arrs.push(ar); total+=ar.length; bids.push([b.i, ar.length/3]);
    }catch(e){}
  });
  const pos=new Float32Array(total), bid=new Float32Array(total/3); let o=0, bo=0;
  arrs.forEach((a,k)=>{ pos.set(a,o); o+=a.length; bid.fill(bids[k][0], bo, bo+bids[k][1]); bo+=bids[k][1]; });
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos,3)); geo.setAttribute('bid', new THREE.BufferAttribute(bid,1)); geo.computeVertexNormals();
  const m=new THREE.Mesh(geo, mat); m.rotation.x=-Math.PI/2; m.userData.plateau=true; return m;
}
(function buildPlateau(){
  if(!PLATEAU) return;
  scene.add(PL.group); scene.add(PL.lu); scene.add(PL.road);
  /* ---- LOD1 建物（計測高さ・用途） ---- */
  const L=PLATEAU.l1, v=decI16(L.v), n=decU8(L.n), h=decU16(L.h), g=decI16(L.g), u=decU8(L.u), s=decU8(L.s), l2=decU8(L.l2), c=decU8(L.c);
  const names=new Map(L.names||[]); const US=PLATEAU.meta.usages||[];
  let o=0;
  for(let i=0;i<n.length;i++){ const k=n[i]; const p=new Array(k); for(let j=0;j<k;j++){ p[j]=[v[(o+j)*2]/5, v[(o+j)*2+1]/5]; } o+=k;
    PL.ext.push({i, p, h:h[i]/10, g:g[i]/10, u:u[i]?US[u[i]-1]:'', s:s[i], l2:!!l2[i], c:c[i], n:names.get(i)||'', id:L.ids.substr(i*8,8)}); }
  /* 天守群（大天守・小天守・渡櫓）は白漆喰の立体モデル（buildKeep）を使うため、PLATEAU 側は除外して重複を避ける */
  const CK=PLATEAU.meta.castle||[214.9,165.2];
  PL.ext.forEach(b=>{ let cx=0, cy=0; b.p.forEach(q=>{cx+=q[0]; cy+=q[1];}); cx/=b.p.length; cy/=b.p.length; b.keep = Math.hypot(cx-CK[0], cy-CK[1]) < 62 && b.h > 12; });
  const plain=PL.ext.filter(b=>!b.l2 && !b.c && !b.keep), castle=PL.ext.filter(b=>b.c && !b.l2 && !b.keep), l2b=PL.ext.filter(b=>b.l2 && !b.keep);
  for(let i=0;i<plain.length;i+=1600){ const m=mergedExtrudeB(plain.slice(i,i+1600), MAT.bldg); LG.bldg.add(m); PL.meshes.push(m); }
  if(castle.length){ const m=mergedExtrudeB(castle, MAT.castle); m.userData.castle=true; m.userData.name='姫路城（城郭内の建造物・PLATEAU）'; LG.bldg.add(m); PL.meshes.push(m); CASTLE_MESHES.push(m); }
  /* LOD2 建物の LOD1 版（遠景用）と、近景で LOD2 の足元の隙間を埋める台座 */
  if(l2b.length){
    PL.l2AsL1 = mergedExtrudeB(l2b, MAT.bldg); LG.bldg.add(PL.l2AsL1); PL.meshes.push(PL.l2AsL1);
    PL.socle = mergedExtrudeB(l2b, MAT.bldg, (b, hh)=> Math.max(0.35, b.g - hh + 0.35)); LG.bldg.add(PL.socle); PL.meshes.push(PL.socle);
  }
  /* ---- LOD2 建物（屋根面・壁面の三角形。頂点色で屋根/壁/城郭を描き分け） ---- */
  const L2=PLATEAU.l2, roof=decI16(L2.roof), wall=decI16(L2.wall), B=L2.b||[];
  const nR=roof.length/3, nW=wall.length/3, N=nR+nW;
  if(N){
    const pos=new Float32Array(N*3), col=new Float32Array(N*3), bid=new Float32Array(N);
    const cw=new THREE.Color(), cr=new THREE.Color();
    const fill=(src, off, isRoof, tri0, ntri, b)=>{
      const castleB = b && b.c; const jit = 0.94 + ((b ? (b.i*2654435761>>>0)%1000 : 500)/1000)*0.12;
      cw.setHex(castleB ? 0xece7dc : 0x5c6a82).multiplyScalar(jit); cr.setHex(castleB ? 0x3b4150 : 0x8592a8).multiplyScalar(jit);
      const cc = isRoof ? cr : cw;
      for(let t=tri0*9; t<(tri0+ntri)*9; t+=3){ const k=off+t/3; pos[k*3]=src[t]/10; pos[k*3+1]=src[t+2]/10; pos[k*3+2]=-src[t+1]/10; col[k*3]=cc.r; col[k*3+1]=cc.g; col[k*3+2]=cc.b; bid[k]=b?b.i:-1; }
    };
    let coveredR=0, coveredW=0;
    B.forEach(([r0,nr,w0,nw,ei])=>{ const b=PL.ext[ei]; if(b.keep) return; fill(roof, 0, true, r0, nr, b); fill(wall, nR, false, w0, nw, b); coveredR+=nr; coveredW+=nw; });
    const geo=new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos,3)); geo.setAttribute('color', new THREE.BufferAttribute(col,3)); geo.setAttribute('bid', new THREE.BufferAttribute(bid,1)); geo.computeVertexNormals();
    PL.matL2 = new THREE.MeshStandardMaterial({vertexColors:true, flatShading:true, roughness:0.85, metalness:0.05});
    PL.lod2 = new THREE.Mesh(geo, PL.matL2); PL.lod2.userData.plateau=true; PL.group.add(PL.lod2); PL.meshes.push(PL.lod2);
  }
  /* ---- 橋梁（桜門橋など） ---- */
  const br=decI16(PLATEAU.brid||''); if(br.length){ const pos=new Float32Array(br.length); for(let t=0;t<br.length;t+=3){ pos[t]=br[t]/10; pos[t+1]=br[t+2]/10; pos[t+2]=-br[t+1]/10; } const geo=new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos,3)); geo.computeVertexNormals(); PL.group.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({color:0x7a7568, flatShading:true, roughness:0.9}))); }
  /* ---- 土地利用（都市計画基礎調査・用途別に統合済み） ---- */
  const LC=PLATEAU.meta.luse_cls||[]; const luItems=decodePolys(PLATEAU.luse);
  const byC={}; luItems.forEach(it=>{ (byC[it.c]=byC[it.c]||[]).push(it); });
  Object.keys(byC).forEach(ci=>{ const code=LC[ci]; const m=mergedFlatH(byC[ci], new THREE.MeshBasicMaterial({color:LUSE_COL[code]||0x22262e, transparent:true, opacity:0.85, depthWrite:false}), 0.12+ci*0.002); m.userData={luse:code}; PL.lu.add(m); });
  /* ---- 道路面（OSM 中心線のバッファ。PLATEAU tran は未提供） ---- */
  const rd=decodePolys(PLATEAU.roads); const byR={}; rd.forEach(it=>{ (byR[it.c]=byR[it.c]||[]).push(it); });
  Object.keys(byR).forEach(ci=>{ const m=mergedFlatH(byR[ci], new THREE.MeshBasicMaterial({color:ROAD_COL[ci]||0x262c3a, transparent:true, opacity:0.95, depthWrite:false}), 0.24+ci*0.01); PL.road.add(m); });
  console.log('PLATEAU', PLATEAU.meta);
})();
function updatePlateauLOD(){
  if(!PLATEAU) return;
  const near = ctrl.sph.radius < 2800;
  if(near===PL.near) return; PL.near=near;
  if(PL.lod2) PL.lod2.visible = near; if(PL.socle) PL.socle.visible = near; if(PL.l2AsL1) PL.l2AsL1.visible = !near;
}
function plateauInfo(b){
  const ll = {lat: CLAT + (b.p.reduce((a,q)=>a+q[1],0)/b.p.length)/110574, lon: CLON + (b.p.reduce((a,q)=>a+q[0],0)/b.p.length)/(111320*Math.cos(CLAT*Math.PI/180))};
  let area=0; for(let i=0;i<b.p.length;i++){ const a=b.p[i], c=b.p[(i+1)%b.p.length]; area += a[0]*c[1]-c[0]*a[1]; } area=Math.abs(area)/2;
  return {id:'bldg_…'+b.id, name:b.n, usage:USAGE_NAME[b.u]||'—', storeys:b.s||null, h:b.h, ground:b.g, area, lod:b.l2?'LOD2（屋根形状あり）':'LOD1', lat:ll.lat, lon:ll.lon, castle:!!b.c};
}
/* クリック → 建物情報（レイキャスト対象は PLATEAU 統合メッシュ） */
function pickBuilding(e){
  if(!PLATEAU) return null;
  const hits = pick(e, PL.meshes.filter(m=>m.visible), false);
  if(!hits.length) return null;
  const hit=hits[0], geo=hit.object.geometry, bidA=geo.getAttribute('bid'); if(!bidA || !hit.face) return null;
  const bi = bidA.getX(hit.face.a); if(bi<0) return null;
  return {b:PL.ext[bi], point:hit.point};
}
