// Title: Intense Holographic Transformation of the Six Regular 4-Polytopes
// Description 1: Six exact regular 4-polytopes transform continuously through four-dimensional space.
// Description 2: Angular diffraction separates saturated rainbow light into animated holographic interference bands.
// Description 3: Strong colored reflection, refraction, Fresnel highlights, and premultiplied transparency preserve vivid spectral depth.

p5.disableFriendlyErrors=true;
const DRAW_DIAMETER_RATIO=0.95;
const HOLD_SECONDS=1.0;
const TRANSFORMATION_SECONDS=9.0;
const SLOT_SECONDS=HOLD_SECONDS+TRANSFORMATION_SECONDS;
const MORPH_FACE_VERTEX_COUNT=5;
const FACE_ALPHA_MIN=0.400;
const FACE_ALPHA_MAX=0.800;
const FACE_OVERLAP_REFERENCE=24.0;
const FACE_OVERLAP_EXPONENT=0.65;
const FACE_OPACITY_SCALE=1.10;
const EDGE_OVERLAP_REFERENCE=48.0;
const VERTEX_OVERLAP_REFERENCE=24.0;
const TARGET_FRAME_RATE=30;
const HUE_SPEED=9.0;
const ROTATION_X_SPEED=0.19;
const ROTATION_Y_SPEED=0.23;
const ROTATION_Z_SPEED=0.13;
const ROTATION_XW_SPEED=0.17;
const ROTATION_YW_SPEED=0.13;
const ROTATION_ZW_SPEED=0.11;
const FOUR_D_CAMERA_DISTANCE=3.0;
const pageStyle=document.createElement("style");
pageStyle.textContent="html,body{margin:0;padding:0;overflow:hidden;background:#000}canvas{display:block}";
document.head.appendChild(pageStyle);

const glassVertexShader=`
precision highp float;
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat3 uNormalMatrix;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vMaterial;
void main(){
  vec4 viewPosition=uModelViewMatrix*vec4(aPosition,1.0);
  vViewPosition=viewPosition.xyz;
  vNormal=normalize(uNormalMatrix*aNormal);
  vMaterial=aTexCoord;
  gl_Position=uProjectionMatrix*viewPosition;
}
`;

const glassFragmentShader=`
precision highp float;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vMaterial;
#define TAU 6.28318530718
vec3 hsb2rgb(vec3 c){
  vec3 rgb=clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0);
  rgb=rgb*rgb*(3.0-2.0*rgb);
  return c.z*mix(vec3(1.0),rgb,c.y);
}
vec3 environmentColor(vec3 direction){
  direction=normalize(direction);
  float phase=direction.x*0.16+direction.y*0.23+direction.z*0.08+uTime*0.012;
  vec3 spectrum=0.5+0.5*cos(TAU*(phase+vec3(0.00,0.33,0.67)));
  float horizon=pow(1.0-abs(direction.z),1.7);
  vec3 environment=mix(vec3(0.012,0.018,0.035),spectrum,0.22+0.42*horizon);
  vec3 lightA=normalize(vec3(-0.48,0.62,0.61));
  vec3 lightB=normalize(vec3(0.72,-0.28,0.63));
  float softA=pow(max(dot(direction,lightA),0.0),20.0);
  float softB=pow(max(dot(direction,lightB),0.0),30.0);
  environment+=vec3(0.22,0.16,0.10)*softA+vec3(0.08,0.14,0.22)*softB;
  return environment;
}
void main(){
  vec3 normal=normalize(vNormal);
  vec3 viewDirection=normalize(-vViewPosition);
  if(dot(normal,viewDirection)<0.0)normal=-normal;
  float facing=clamp(dot(normal,viewDirection),0.0,1.0);
  float fresnel=pow(1.0-facing,2.8);
  vec3 incident=-viewDirection;
  vec3 reflectedDirection=reflect(incident,normal);
  vec3 refractedR=refract(incident,normal,1.0/1.48);
  vec3 refractedG=refract(incident,normal,1.0/1.51);
  vec3 refractedB=refract(incident,normal,1.0/1.54);
  vec3 refractionColor=vec3(environmentColor(refractedR).r,environmentColor(refractedG).g,environmentColor(refractedB).b);
  vec3 reflectionColor=environmentColor(reflectedDirection);
  vec3 tint=hsb2rgb(vec3(fract(vMaterial.x),1.00,1.00));
  vec3 halfA=normalize(viewDirection+normalize(vec3(-0.42,0.58,0.70)));
  vec3 halfB=normalize(viewDirection+normalize(vec3(0.65,-0.32,0.69)));
  float specularA=pow(max(dot(normal,halfA),0.0),48.0);
  float specularB=pow(max(dot(normal,halfB),0.0),72.0);
  float diffractionPhase=(1.0-facing)*8.0+dot(reflectedDirection,normalize(vec3(0.57,0.71,0.41)))*3.0+uTime*0.06;
  vec3 diffraction=0.5+0.5*cos(TAU*(diffractionPhase+vec3(0.00,0.333,0.667)));
  diffraction=pow(diffraction,vec3(0.55));
  float hologramBand=pow(0.5+0.5*cos(TAU*((1.0-facing)*22.0+normal.x*2.0-normal.y*1.5+uTime*0.16)),10.0);
  vec3 hologramColor=mix(tint,diffraction,0.78);
  vec3 coloredReflection=reflectionColor*(1.80+5.80*hologramColor);
  vec3 glassColor=mix(refractionColor,hologramColor,0.92);
  glassColor=mix(glassColor,coloredReflection,1.45+3.20*fresnel);
  glassColor+=hologramColor*(0.50*fresnel+0.40*hologramBand);
  glassColor+=diffraction*(0.24*specularA+0.20*specularB);
  glassColor=glassColor/(vec3(1.0)+glassColor*0.30);
  glassColor=pow(max(glassColor,vec3(0.0)),vec3(0.76));
  float alpha=vMaterial.y*(0.90+1.10*fresnel);
  alpha=clamp(alpha,0.0,0.220);
  gl_FragColor=vec4(glassColor*alpha,alpha);
}
`;

let polytopes=[];
let transformations=[];
let shortSide=1;
let glassShader;

function setup(){
  createCanvas(windowWidth,windowHeight,WEBGL);
  pixelDensity(Math.min(window.devicePixelRatio||1,1.5));
  frameRate(TARGET_FRAME_RATE);
  colorMode(HSB,360,100,100,1);
  textureMode(NORMAL);
  glassShader=createShader(glassVertexShader,glassFragmentShader);
  shortSide=Math.min(width,height);
  const cell600=build600Cell();
  const cell120=build120Cell(cell600);
  polytopes=[
    preparePolytope("5-cell",build5Cell(),326,3),
    preparePolytope("8-cell",build8Cell(),190,4),
    preparePolytope("16-cell",build16Cell(),112,3),
    preparePolytope("24-cell",build24Cell(),42,3),
    preparePolytope("120-cell",cell120,8,5),
    preparePolytope("600-cell",cell600,266,3)
  ];
  transformations=polytopes.map((poly,index)=>prepareTransformation(poly,polytopes[(index+1)%polytopes.length]));
}

function draw(){
  blendMode(BLEND);
  background(0);
  ortho(-width/2,width/2,-height/2,height/2,-5000,5000);
  drawingContext.disable(drawingContext.DEPTH_TEST);
  const seconds=millis()*0.001;
  const slot=Math.floor(seconds/SLOT_SECONDS)%transformations.length;
  const local=seconds%SLOT_SECONDS;
  const raw=local<HOLD_SECONDS?0:(local-HOLD_SECONDS)/TRANSFORMATION_SECONDS;
  drawTransformation(transformations[slot],smootherstep(raw),seconds);
}

function drawTransformation(transformation,amount,seconds){
  const from=transformation.from;
  const to=transformation.to;
  const segments=new Array(transformation.edgePairs.length);
  for(let i=0;i<transformation.edgePairs.length;i++){
    const pair=transformation.edgePairs[i];
    const a4=slerp4(pair[0],pair[2],amount);
    const b4=slerp4(pair[1],pair[3],amount);
    segments[i]=[project4Dto3D(a4,seconds),project4Dto3D(b4,seconds)];
  }
  const points=new Array(transformation.vertexPairs.length);
  for(let i=0;i<transformation.vertexPairs.length;i++){
    const pair=transformation.vertexPairs[i];
    points[i]=project4Dto3D(slerp4(pair[0],pair[1],amount),seconds);
  }
  const effectiveEdges=lerp(from.edges.length,to.edges.length,amount);
  const effectiveVertices=lerp(from.vertices.length,to.vertices.length,amount);
  const effectiveFaces=lerp(from.faces.length,to.faces.length,amount);
  const edgeDensity=effectiveEdges/transformation.edgePairs.length;
  const vertexDensity=effectiveVertices/transformation.vertexPairs.length;
  const faceDensity=effectiveFaces/transformation.facePairs.length;
  const faceOverlap=Math.pow(Math.min(1,FACE_OVERLAP_REFERENCE/Math.max(1,effectiveFaces)),FACE_OVERLAP_EXPONENT);
  const edgeOverlap=Math.min(1,Math.sqrt(EDGE_OVERLAP_REFERENCE/Math.max(1,effectiveEdges)));
  const vertexOverlap=Math.min(1,Math.sqrt(VERTEX_OVERLAP_REFERENCE/Math.max(1,effectiveVertices)));
  const complexity=Math.max(0.38,Math.min(1.55,10.0/Math.sqrt(effectiveEdges)));
  const responsive=Math.max(0.75,Math.min(1.35,shortSide/850));
  const coreWidth=complexity*responsive;
  const baseHue=(interpolateHue(from.hue,to.hue,amount)+seconds*HUE_SPEED)%360;
  const glassFaces=new Array(transformation.facePairs.length);
  for(let faceIndex=0;faceIndex<transformation.facePairs.length;faceIndex++){
    const face=transformation.facePairs[faceIndex];
    const polygon=new Array(MORPH_FACE_VERTEX_COUNT);
    const center=[0,0,0];
    for(let i=0;i<MORPH_FACE_VERTEX_COUNT;i++){
      polygon[i]=project4Dto3D(slerp4(face.fromVertices[i],face.toVertices[i],amount),seconds);
      center[0]+=polygon[i][0]/MORPH_FACE_VERTEX_COUNT;
      center[1]+=polygon[i][1]/MORPH_FACE_VERTEX_COUNT;
      center[2]+=polygon[i][2]/MORPH_FACE_VERTEX_COUNT;
    }
    const normal=polygonNormal(polygon);
    glassFaces[faceIndex]={polygon,center,depth:center[2],normal,hue:interpolateHue(face.fromHue,face.toHue,amount),alpha:lerp(face.fromAlpha,face.toAlpha,amount)};
  }
  glassFaces.sort((a,b)=>a.depth-b.depth);
  let projectedRadius=1e-6;
  for(const segment of segments)projectedRadius=Math.max(projectedRadius,Math.hypot(segment[0][0],segment[0][1]),Math.hypot(segment[1][0],segment[1][1]));
  for(const point of points)projectedRadius=Math.max(projectedRadius,Math.hypot(point[0],point[1]));
  for(const face of glassFaces)for(const point of face.polygon)projectedRadius=Math.max(projectedRadius,Math.hypot(point[0],point[1]));
  const modelScale=shortSide*DRAW_DIAMETER_RATIO*0.5/projectedRadius;
  push();
  scale(modelScale);
  blendMode(BLEND);
  noStroke();
  shader(glassShader);
  glassShader.setUniform("uTime",seconds);
  beginShape(TRIANGLES);
  for(const face of glassFaces){
    const faceAlpha=Math.min(0.180,face.alpha*faceDensity*faceOverlap*FACE_OPACITY_SCALE);
    emitShaderPolygonTriangles(face,faceAlpha);
  }
  endShape();
  resetShader();
  blendMode(BLEND);
  const edgeOpacity=edgeDensity*edgeOverlap;
  for(let group=0;group<3;group++){
    const hue=(baseHue+group*54)%360;
    stroke(hue,82,100,0.045*edgeOpacity);
    strokeWeight(coreWidth*5.5);
    drawSegmentGroup(segments,group);
    stroke(hue,72,100,0.32*edgeOpacity);
    strokeWeight(coreWidth);
    drawSegmentGroup(segments,group);
  }
  const nodeWeight=Math.max(1.0,Math.min(5.5,13.0/Math.sqrt(effectiveVertices)))*responsive;
  stroke((baseHue+28)%360,68,100,0.56*vertexDensity*vertexOverlap);
  strokeWeight(nodeWeight);
  beginShape(POINTS);
  for(const point of points)vertex(point[0],point[1],point[2]);
  endShape();
  pop();
}

function drawSegmentGroup(segments,group){
  beginShape(LINES);
  for(let i=group;i<segments.length;i+=3){
    const segment=segments[i];
    vertex(segment[0][0],segment[0][1],segment[0][2]);
    vertex(segment[1][0],segment[1][1],segment[1][2]);
  }
  endShape();
}

function emitShaderPolygonTriangles(face,alpha){
  normal(face.normal[0],face.normal[1],face.normal[2]);
  const materialHue=((face.hue%360)+360)%360/360;
  for(let i=0;i<MORPH_FACE_VERTEX_COUNT;i++){
    const next=(i+1)%MORPH_FACE_VERTEX_COUNT;
    vertex(face.center[0],face.center[1],face.center[2],materialHue,alpha);
    vertex(face.polygon[i][0],face.polygon[i][1],face.polygon[i][2],materialHue,alpha);
    vertex(face.polygon[next][0],face.polygon[next][1],face.polygon[next][2],materialHue,alpha);
  }
}

function polygonNormal(polygon){
  for(let i=1;i<polygon.length-1;i++)for(let j=i+1;j<polygon.length;j++){
    const a=[polygon[i][0]-polygon[0][0],polygon[i][1]-polygon[0][1],polygon[i][2]-polygon[0][2]];
    const b=[polygon[j][0]-polygon[0][0],polygon[j][1]-polygon[0][1],polygon[j][2]-polygon[0][2]];
    const normal=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    const length=Math.hypot(normal[0],normal[1],normal[2]);
    if(length>1e-8)return normal.map(value=>value/length);
  }
  return[0,0,1];
}

function project4Dto3D(vertex,seconds){
  let q=vertex.slice();
  q=rotate4DPlane(q,0,3,seconds*ROTATION_XW_SPEED);
  q=rotate4DPlane(q,1,3,seconds*ROTATION_YW_SPEED+1.2);
  q=rotate4DPlane(q,2,3,seconds*ROTATION_ZW_SPEED+2.4);
  const perspective=FOUR_D_CAMERA_DISTANCE/(FOUR_D_CAMERA_DISTANCE-q[3]);
  const projected=[q[0]*perspective,q[1]*perspective,q[2]*perspective];
  return rotate3D(projected,seconds*ROTATION_X_SPEED,seconds*ROTATION_Y_SPEED,seconds*ROTATION_Z_SPEED);
}

function rotate3D(v,angleX,angleY,angleZ){
  const cx=Math.cos(angleX),sx=Math.sin(angleX),cy=Math.cos(angleY),sy=Math.sin(angleY),cz=Math.cos(angleZ),sz=Math.sin(angleZ);
  const x1=v[0],y1=v[1]*cx-v[2]*sx,z1=v[1]*sx+v[2]*cx;
  const x2=x1*cy+z1*sy,y2=y1,z2=-x1*sy+z1*cy;
  return[x2*cz-y2*sz,x2*sz+y2*cz,z2];
}

function rotate4DPlane(v,a,b,angle){
  const result=v.slice();
  const c=Math.cos(angle),s=Math.sin(angle);
  result[a]=v[a]*c-v[b]*s;
  result[b]=v[a]*s+v[b]*c;
  return result;
}

function preparePolytope(name,data,hue,faceSize){
  const sortedVertices=data.vertices.slice().sort((a,b)=>compareKeys(vertexKey(a),vertexKey(b)));
  const sortedEdges=data.edges.slice().sort((a,b)=>compareKeys(edgeKey(a,data.vertices),edgeKey(b,data.vertices)));
  const faces=findFaces(data.vertices.length,data.edges,faceSize);
  const sortedFaces=faces.map(indices=>({indices,hue:random(360),alpha:random(FACE_ALPHA_MIN,FACE_ALPHA_MAX)})).sort((a,b)=>compareKeys(faceKey(a.indices,data.vertices),faceKey(b.indices,data.vertices)));
  const vertexRecords=sortedVertices.map(vertex=>vertex.slice());
  const edgeRecords=sortedEdges.map(edge=>[data.vertices[edge[0]].slice(),data.vertices[edge[1]].slice()]);
  const faceRecords=sortedFaces.map(face=>({vertices:resamplePolygon(face.indices.map(index=>data.vertices[index]),MORPH_FACE_VERTEX_COUNT),hue:face.hue,alpha:face.alpha}));
  return{name,vertices:data.vertices,edges:data.edges,faces,vertexRecords,edgeRecords,faceRecords,hue};
}

function prepareTransformation(from,to){
  const vertexPairCount=Math.max(from.vertices.length,to.vertices.length);
  const fromVertices=resampleItems(from.vertexRecords,vertexPairCount);
  const toVertices=resampleItems(to.vertexRecords,vertexPairCount);
  const vertexPairs=new Array(vertexPairCount);
  for(let i=0;i<vertexPairCount;i++)vertexPairs[i]=[fromVertices[i],toVertices[i]];
  const edgePairCount=Math.max(from.edges.length,to.edges.length);
  const fromEdges=resampleItems(from.edgeRecords,edgePairCount);
  const toEdges=resampleItems(to.edgeRecords,edgePairCount);
  const edgePairs=new Array(edgePairCount);
  for(let i=0;i<edgePairCount;i++){
    const a=fromEdges[i][0],b=fromEdges[i][1];
    let c=toEdges[i][0],d=toEdges[i][1];
    const direct=distanceSquared4(a,c)+distanceSquared4(b,d);
    const reversed=distanceSquared4(a,d)+distanceSquared4(b,c);
    if(reversed<direct)[c,d]=[d,c];
    edgePairs[i]=[a,b,c,d];
  }
  const facePairCount=Math.max(from.faces.length,to.faces.length);
  const fromFaces=resampleItems(from.faceRecords,facePairCount);
  const toFaces=resampleItems(to.faceRecords,facePairCount);
  const facePairs=new Array(facePairCount);
  for(let i=0;i<facePairCount;i++){
    const a=fromFaces[i],b=toFaces[i];
    facePairs[i]={fromVertices:a.vertices,toVertices:matchPolygonVertices(a.vertices,b.vertices),fromHue:a.hue,toHue:b.hue,fromAlpha:a.alpha,toAlpha:b.alpha};
  }
  return{from,to,vertexPairs,edgePairs,facePairs};
}

function resampleItems(source,count){
  const result=new Array(count);
  for(let i=0;i<count;i++)result[i]=source[Math.floor(i*source.length/count)];
  return result;
}

function resamplePolygon(source,count){
  const result=new Array(count);
  for(let i=0;i<count;i++)result[i]=source[Math.floor(i*source.length/count)].slice();
  return result;
}

function matchPolygonVertices(from,to){
  const count=from.length;
  let best=null,bestCost=Infinity;
  for(let reversed=0;reversed<2;reversed++)for(let shift=0;shift<count;shift++){
    const candidate=new Array(count);
    let cost=0;
    for(let i=0;i<count;i++){
      const index=reversed?(shift-i+count)%count:(shift+i)%count;
      candidate[i]=to[index];
      cost+=distanceSquared4(from[i],candidate[i]);
    }
    if(cost<bestCost){
      bestCost=cost;
      best=candidate;
    }
  }
  return best;
}

function vertexKey(v){
  return[Math.atan2(v[1],v[0]),Math.atan2(v[3],v[2]),Math.hypot(v[0],v[1]),v[2],v[3]];
}

function edgeKey(edge,vertices){
  const a=vertices[edge[0]],b=vertices[edge[1]];
  const middle=a.map((value,index)=>(value+b[index])*0.5);
  let direction=a.map((value,index)=>b[index]-value);
  const first=direction.find(value=>Math.abs(value)>1e-9)||1;
  if(first<0)direction=direction.map(value=>-value);
  return[Math.atan2(middle[1],middle[0]),Math.atan2(middle[3],middle[2]),Math.hypot(middle[0],middle[1]),Math.hypot(middle[2],middle[3]),Math.atan2(direction[1],direction[0]),Math.atan2(direction[3],direction[2])];
}

function faceKey(face,vertices){
  const center=[0,0,0,0];
  for(const index of face)for(let d=0;d<4;d++)center[d]+=vertices[index][d]/face.length;
  return[Math.atan2(center[1],center[0]),Math.atan2(center[3],center[2]),Math.hypot(center[0],center[1]),Math.hypot(center[2],center[3]),face.length];
}

function findFaces(vertexCount,edges,faceSize){
  const adjacency=Array.from({length:vertexCount},()=>new Set());
  for(const edge of edges){
    adjacency[edge[0]].add(edge[1]);
    adjacency[edge[1]].add(edge[0]);
  }
  const faces=[];
  for(let start=0;start<vertexCount;start++){
    const path=[start];
    const used=new Set(path);
    const walk=current=>{
      if(path.length===faceSize){
        if(adjacency[current].has(start)&&path[1]<path[path.length-1])faces.push(path.slice());
        return;
      }
      for(const next of adjacency[current]){
        if(next<=start||used.has(next))continue;
        if(path.length>=2&&path.length+1<faceSize&&adjacency[next].has(start))continue;
        used.add(next);
        path.push(next);
        walk(next);
        path.pop();
        used.delete(next);
      }
    };
    walk(start);
  }
  return faces;
}

function compareKeys(a,b){
  for(let i=0;i<a.length;i++)if(Math.abs(a[i]-b[i])>1e-10)return a[i]-b[i];
  return 0;
}

function slerp4(a,b,t){
  const cosine=Math.max(-1,Math.min(1,dot4(a,b)));
  if(cosine>0.9995)return normalize4(a.map((value,index)=>lerp(value,b[index],t)));
  if(cosine< -0.9995){
    const orthogonal=orthogonal4(a);
    const angle=Math.PI*t;
    return a.map((value,index)=>value*Math.cos(angle)+orthogonal[index]*Math.sin(angle));
  }
  const angle=Math.acos(cosine);
  const sine=Math.sin(angle);
  const wa=Math.sin((1-t)*angle)/sine;
  const wb=Math.sin(t*angle)/sine;
  return a.map((value,index)=>value*wa+b[index]*wb);
}

function orthogonal4(v){
  let axis=0;
  for(let i=1;i<4;i++)if(Math.abs(v[i])<Math.abs(v[axis]))axis=i;
  const basis=[0,0,0,0];
  basis[axis]=1;
  const projection=dot4(basis,v);
  return normalize4(basis.map((value,index)=>value-projection*v[index]));
}

function interpolateHue(a,b,t){
  const difference=((b-a+540)%360)-180;
  return(a+difference*t+360)%360;
}

function dot4(a,b){
  return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3];
}

function normalize4(v){
  const n=Math.hypot(v[0],v[1],v[2],v[3]);
  return v.map(value=>value/n);
}

function build5Cell(){
  const basis=[];
  for(let k=0;k<4;k++){
    const b=new Array(5).fill(0);
    const d=Math.sqrt((k+1)*(k+2));
    for(let i=0;i<=k;i++)b[i]=1/d;
    b[k+1]=-(k+1)/d;
    basis.push(b);
  }
  const scale=Math.sqrt(5/4);
  const vertices=[];
  for(let i=0;i<5;i++)vertices.push(basis.map(b=>b[i]*scale));
  return{vertices,edges:nearestEdges(vertices)};
}

function build8Cell(){
  const vertices=[];
  for(let mask=0;mask<16;mask++)vertices.push([0,1,2,3].map(d=>(mask>>d)&1?0.5:-0.5));
  return{vertices,edges:nearestEdges(vertices)};
}

function build16Cell(){
  const vertices=[];
  for(let axis=0;axis<4;axis++)for(const sign of[-1,1]){
    const v=[0,0,0,0];
    v[axis]=sign;
    vertices.push(v);
  }
  return{vertices,edges:nearestEdges(vertices)};
}

function build24Cell(){
  const vertices=[];
  const s=1/Math.sqrt(2);
  for(let a=0;a<4;a++)for(let b=a+1;b<4;b++)for(const sa of[-s,s])for(const sb of[-s,s]){
    const v=[0,0,0,0];
    v[a]=sa;
    v[b]=sb;
    vertices.push(v);
  }
  return{vertices,edges:nearestEdges(vertices)};
}

function build600Cell(){
  const vertices=[];
  const phi=(1+Math.sqrt(5))/2;
  for(let axis=0;axis<4;axis++)for(const sign of[-1,1]){
    const v=[0,0,0,0];
    v[axis]=sign;
    vertices.push(v);
  }
  for(let mask=0;mask<16;mask++)vertices.push([0,1,2,3].map(d=>(mask>>d)&1?0.5:-0.5));
  for(const permutation of evenPermutations4())for(let mask=0;mask<8;mask++){
    const source=[0,(mask&1)?0.5:-0.5,(mask&2)?phi/2:-phi/2,(mask&4)?1/(2*phi):-1/(2*phi)];
    vertices.push(permutation.map(index=>source[index]));
  }
  return{vertices,edges:nearestEdges(vertices)};
}

function build120Cell(cell600){
  const sourceVertices=cell600.vertices;
  const adjacency=sourceVertices.map(()=>new Set());
  for(const edge of cell600.edges){
    adjacency[edge[0]].add(edge[1]);
    adjacency[edge[1]].add(edge[0]);
  }
  const tetrahedralCells=[];
  for(let a=0;a<sourceVertices.length;a++)for(const b of adjacency[a])if(b>a){
    const common=[...adjacency[a]].filter(c=>c>b&&adjacency[b].has(c));
    for(let i=0;i<common.length;i++)for(let j=i+1;j<common.length;j++)if(adjacency[common[i]].has(common[j]))tetrahedralCells.push([a,b,common[i],common[j]]);
  }
  const vertices=tetrahedralCells.map(cell=>{
    const center=[0,0,0,0];
    for(const index of cell)for(let d=0;d<4;d++)center[d]+=sourceVertices[index][d];
    return normalize4(center);
  });
  return{vertices,edges:nearestEdges(vertices)};
}

function nearestEdges(vertices){
  let minimum=Infinity;
  for(let i=0;i<vertices.length;i++)for(let j=i+1;j<vertices.length;j++){
    const d=distanceSquared4(vertices[i],vertices[j]);
    if(d>1e-10&&d<minimum)minimum=d;
  }
  const tolerance=minimum*1e-5;
  const edges=[];
  for(let i=0;i<vertices.length;i++)for(let j=i+1;j<vertices.length;j++)if(Math.abs(distanceSquared4(vertices[i],vertices[j])-minimum)<tolerance)edges.push([i,j]);
  return edges;
}

function distanceSquared4(a,b){
  let d=0;
  for(let i=0;i<4;i++)d+=(a[i]-b[i])*(a[i]-b[i]);
  return d;
}

function evenPermutations4(){
  const result=[];
  for(let a=0;a<4;a++)for(let b=0;b<4;b++)if(b!==a)for(let c=0;c<4;c++)if(c!==a&&c!==b)for(let d=0;d<4;d++)if(d!==a&&d!==b&&d!==c){
    const p=[a,b,c,d];
    let inversions=0;
    for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)if(p[i]>p[j])inversions++;
    if(inversions%2===0)result.push(p);
  }
  return result;
}

function smootherstep(t){
  t=Math.max(0,Math.min(1,t));
  return t*t*t*(t*(t*6-15)+10);
}

function windowResized(){
  resizeCanvas(windowWidth,windowHeight);
  shortSide=Math.min(width,height);
}
