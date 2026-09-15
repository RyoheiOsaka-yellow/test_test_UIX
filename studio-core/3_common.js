<script>
(function(){
'use strict';
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const V3=(x,y,z)=>new THREE.Vector3(x,y,z), V2=(x,y)=>new THREE.Vector2(x,y);
const fmt=(n,d=1)=>Number(n).toLocaleString('ja-JP',{minimumFractionDigits:d,maximumFractionDigits:d});
const clamp=THREE.MathUtils.clamp, smooth=k=>k*k*(3-2*k);
const CLASS_COLORS={plastic:'#d8dde5',elastomer:'#6b6f7a',electronic:'#c4913a',metal:'#8fa3b8',glass:'#9fd3e8',sorbent:'#d9b56b',composite:'#4a4f57',textile:'#7b6f8f',foam:'#e3c987'};
const CLASS_JP={plastic:'樹脂',elastomer:'エラストマー',electronic:'電子部品',metal:'金属',glass:'ガラス',sorbent:'吸着剤',composite:'複合材',textile:'布地',foam:'フォーム'};
// geometry helpers
const arc=(cx,cy,r,a0,a1,n=6)=>{const o=[];for(let i=0;i<=n;i++){const a=THREE.MathUtils.degToRad(a0+(a1-a0)*i/n);o.push(V2(cx+Math.cos(a)*r,cy+Math.sin(a)*r));}return o;};
const lathe=(pts,seg=64)=>new THREE.LatheGeometry(pts,seg);
const cyl=(rt,rb,h,s=48)=>new THREE.CylinderGeometry(rt,rb,h,s);
const box=(x,y,z)=>new THREE.BoxGeometry(x,y,z);
const sphere=(r,s=20)=>new THREE.SphereGeometry(r,s,s);
const rotX=a=>new THREE.Quaternion().setFromAxisAngle(V3(1,0,0),a), rotY=a=>new THREE.Quaternion().setFromAxisAngle(V3(0,1,0),a), rotZ=a=>new THREE.Quaternion().setFromAxisAngle(V3(0,0,1),a);
const yTo=dir=>new THREE.Quaternion().setFromUnitVectors(V3(0,1,0),dir.clone().normalize());
// hollow tube between two points (ro outer, ri inner radius); ri=0 → solid
function tube(a,b,ro,ri=0,seg=28){const d=b.clone().sub(a),L=d.length();const g=ri>0?lathe([V2(ri,-L/2),V2(ro,-L/2),V2(ro,L/2),V2(ri,L/2),V2(ri,-L/2)],seg):cyl(ro,ro,L,seg);return {g,pos:a.clone().add(b).multiplyScalar(0.5).toArray(),quat:yTo(d)};}
const joint=(p,r)=>({g:sphere(r,16),pos:p.toArray()});


