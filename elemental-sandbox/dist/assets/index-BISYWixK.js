(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))i(s);new MutationObserver(s=>{for(const r of s)if(r.type==="childList")for(const a of r.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&i(a)}).observe(document,{childList:!0,subtree:!0});function t(s){const r={};return s.integrity&&(r.integrity=s.integrity),s.referrerPolicy&&(r.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?r.credentials="include":s.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function i(s){if(s.ep)return;s.ep=!0;const r=t(s);fetch(s.href,r)}})();const Ga="185",Dc=0,To=1,Lc=2,jn=1,Ic=2,Jn=3,_i=0,Ot=1,Ft=2,mi=0,Hi=1,Qt=2,Ao=3,Co=4,Uc=5,Qi=100,Fc=101,Nc=102,Oc=103,Bc=104,zc=200,kc=201,Vc=202,Gc=203,Xr=204,$r=205,Hc=206,Wc=207,Xc=208,$c=209,qc=210,Yc=211,Kc=212,Zc=213,Jc=214,qr=0,Yr=1,Kr=2,Dn=3,Zr=4,Jr=5,Qr=6,jr=7,zl=0,Qc=1,jc=2,gi=0,Ha=1,Wa=2,Xa=3,Zs=4,$a=5,qa=6,Ya=7,kl=300,nn=301,Ln=302,ar=303,or=304,Js=306,ea=1e3,Ti=1001,ta=1002,Pt=1003,eu=1004,ds=1005,Nt=1006,lr=1007,en=1008,Zt=1009,Vl=1010,Gl=1011,ns=1012,Ka=1013,xi=1014,ai=1015,Jt=1016,Za=1017,Ja=1018,ss=1020,Hl=35902,Wl=35899,Xl=1021,$l=1022,oi=1023,Ri=1026,tn=1027,Qa=1028,ja=1029,sn=1030,eo=1031,to=1033,zs=33776,ks=33777,Vs=33778,Gs=33779,ia=35840,na=35841,sa=35842,ra=35843,aa=36196,oa=37492,la=37496,ca=37488,ua=37489,Xs=37490,ha=37491,da=37808,fa=37809,pa=37810,ma=37811,ga=37812,va=37813,_a=37814,xa=37815,Sa=37816,Ma=37817,ya=37818,ba=37819,Ea=37820,wa=37821,Ta=36492,Aa=36494,Ca=36495,Ra=36283,Pa=36284,$s=36285,Da=36286,tu=3200,La=0,iu=1,Vi="",Yt="srgb",qs="srgb-linear",Ys="linear",Ze="srgb",un=7680,Ro=519,nu=512,su=513,ru=514,io=515,au=516,ou=517,no=518,lu=519,Po=35044,es=35048,Do="300 es",pi=2e3,rs=2001;function cu(n){for(let e=n.length-1;e>=0;--e)if(n[e]>=65535)return!0;return!1}function Ks(n){return document.createElementNS("http://www.w3.org/1999/xhtml",n)}function uu(){const n=Ks("canvas");return n.style.display="block",n}const Lo={};function Io(...n){const e="THREE."+n.shift();console.log(e,...n)}function ql(n){const e=n[0];if(typeof e=="string"&&e.startsWith("TSL:")){const t=n[1];t&&t.isStackTrace?n[0]+=" "+t.getLocation():n[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return n}function Ie(...n){n=ql(n);const e="THREE."+n.shift();{const t=n[0];t&&t.isStackTrace?console.warn(t.getError(e)):console.warn(e,...n)}}function Xe(...n){n=ql(n);const e="THREE."+n.shift();{const t=n[0];t&&t.isStackTrace?console.error(t.getError(e)):console.error(e,...n)}}function Rn(...n){const e=n.join(" ");e in Lo||(Lo[e]=!0,Ie(...n))}function hu(n,e,t){return new Promise(function(i,s){function r(){switch(n.clientWaitSync(e,n.SYNC_FLUSH_COMMANDS_BIT,0)){case n.WAIT_FAILED:s();break;case n.TIMEOUT_EXPIRED:setTimeout(r,t);break;default:i()}}setTimeout(r,t)})}const du={[qr]:Yr,[Kr]:Qr,[Zr]:jr,[Dn]:Jr,[Yr]:qr,[Qr]:Kr,[jr]:Zr,[Jr]:Dn};class rn{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});const i=this._listeners;i[e]===void 0&&(i[e]=[]),i[e].indexOf(t)===-1&&i[e].push(t)}hasEventListener(e,t){const i=this._listeners;return i===void 0?!1:i[e]!==void 0&&i[e].indexOf(t)!==-1}removeEventListener(e,t){const i=this._listeners;if(i===void 0)return;const s=i[e];if(s!==void 0){const r=s.indexOf(t);r!==-1&&s.splice(r,1)}}dispatchEvent(e){const t=this._listeners;if(t===void 0)return;const i=t[e.type];if(i!==void 0){e.target=this;const s=i.slice(0);for(let r=0,a=s.length;r<a;r++)s[r].call(this,e);e.target=null}}}const Lt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],cr=Math.PI/180,Ia=180/Math.PI;function ls(){const n=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(Lt[n&255]+Lt[n>>8&255]+Lt[n>>16&255]+Lt[n>>24&255]+"-"+Lt[e&255]+Lt[e>>8&255]+"-"+Lt[e>>16&15|64]+Lt[e>>24&255]+"-"+Lt[t&63|128]+Lt[t>>8&255]+"-"+Lt[t>>16&255]+Lt[t>>24&255]+Lt[i&255]+Lt[i>>8&255]+Lt[i>>16&255]+Lt[i>>24&255]).toLowerCase()}function Ge(n,e,t){return Math.max(e,Math.min(t,n))}function fu(n,e){return(n%e+e)%e}function ur(n,e,t){return(1-t)*n+t*e}function kn(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return n/4294967295;case Uint16Array:return n/65535;case Uint8Array:return n/255;case Int32Array:return Math.max(n/2147483647,-1);case Int16Array:return Math.max(n/32767,-1);case Int8Array:return Math.max(n/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function Gt(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return Math.round(n*4294967295);case Uint16Array:return Math.round(n*65535);case Uint8Array:return Math.round(n*255);case Int32Array:return Math.round(n*2147483647);case Int16Array:return Math.round(n*32767);case Int8Array:return Math.round(n*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}class Re{static{Re.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){const t=this.x,i=this.y,s=e.elements;return this.x=s[0]*t+s[3]*i+s[6],this.y=s[1]*t+s[4]*i+s[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Ge(this.x,e.x,t.x),this.y=Ge(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=Ge(this.x,e,t),this.y=Ge(this.y,e,t),this}clampLength(e,t){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Ge(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const i=this.dot(e)/t;return Math.acos(Ge(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,i=this.y-e.y;return t*t+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){const i=Math.cos(t),s=Math.sin(t),r=this.x-e.x,a=this.y-e.y;return this.x=r*i-a*s+e.x,this.y=r*s+a*i+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class an{constructor(e=0,t=0,i=0,s=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=i,this._w=s}static slerpFlat(e,t,i,s,r,a,o){let l=i[s+0],c=i[s+1],d=i[s+2],f=i[s+3],u=r[a+0],m=r[a+1],g=r[a+2],S=r[a+3];if(f!==S||l!==u||c!==m||d!==g){let p=l*u+c*m+d*g+f*S;p<0&&(u=-u,m=-m,g=-g,S=-S,p=-p);let h=1-o;if(p<.9995){const x=Math.acos(p),E=Math.sin(x);h=Math.sin(h*x)/E,o=Math.sin(o*x)/E,l=l*h+u*o,c=c*h+m*o,d=d*h+g*o,f=f*h+S*o}else{l=l*h+u*o,c=c*h+m*o,d=d*h+g*o,f=f*h+S*o;const x=1/Math.sqrt(l*l+c*c+d*d+f*f);l*=x,c*=x,d*=x,f*=x}}e[t]=l,e[t+1]=c,e[t+2]=d,e[t+3]=f}static multiplyQuaternionsFlat(e,t,i,s,r,a){const o=i[s],l=i[s+1],c=i[s+2],d=i[s+3],f=r[a],u=r[a+1],m=r[a+2],g=r[a+3];return e[t]=o*g+d*f+l*m-c*u,e[t+1]=l*g+d*u+c*f-o*m,e[t+2]=c*g+d*m+o*u-l*f,e[t+3]=d*g-o*f-l*u-c*m,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,i,s){return this._x=e,this._y=t,this._z=i,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){const i=e._x,s=e._y,r=e._z,a=e._order,o=Math.cos,l=Math.sin,c=o(i/2),d=o(s/2),f=o(r/2),u=l(i/2),m=l(s/2),g=l(r/2);switch(a){case"XYZ":this._x=u*d*f+c*m*g,this._y=c*m*f-u*d*g,this._z=c*d*g+u*m*f,this._w=c*d*f-u*m*g;break;case"YXZ":this._x=u*d*f+c*m*g,this._y=c*m*f-u*d*g,this._z=c*d*g-u*m*f,this._w=c*d*f+u*m*g;break;case"ZXY":this._x=u*d*f-c*m*g,this._y=c*m*f+u*d*g,this._z=c*d*g+u*m*f,this._w=c*d*f-u*m*g;break;case"ZYX":this._x=u*d*f-c*m*g,this._y=c*m*f+u*d*g,this._z=c*d*g-u*m*f,this._w=c*d*f+u*m*g;break;case"YZX":this._x=u*d*f+c*m*g,this._y=c*m*f+u*d*g,this._z=c*d*g-u*m*f,this._w=c*d*f-u*m*g;break;case"XZY":this._x=u*d*f-c*m*g,this._y=c*m*f-u*d*g,this._z=c*d*g+u*m*f,this._w=c*d*f+u*m*g;break;default:Ie("Quaternion: .setFromEuler() encountered an unknown order: "+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){const i=t/2,s=Math.sin(i);return this._x=e.x*s,this._y=e.y*s,this._z=e.z*s,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(e){const t=e.elements,i=t[0],s=t[4],r=t[8],a=t[1],o=t[5],l=t[9],c=t[2],d=t[6],f=t[10],u=i+o+f;if(u>0){const m=.5/Math.sqrt(u+1);this._w=.25/m,this._x=(d-l)*m,this._y=(r-c)*m,this._z=(a-s)*m}else if(i>o&&i>f){const m=2*Math.sqrt(1+i-o-f);this._w=(d-l)/m,this._x=.25*m,this._y=(s+a)/m,this._z=(r+c)/m}else if(o>f){const m=2*Math.sqrt(1+o-i-f);this._w=(r-c)/m,this._x=(s+a)/m,this._y=.25*m,this._z=(l+d)/m}else{const m=2*Math.sqrt(1+f-i-o);this._w=(a-s)/m,this._x=(r+c)/m,this._y=(l+d)/m,this._z=.25*m}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let i=e.dot(t)+1;return i<1e-8?(i=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=i):(this._x=0,this._y=-e.z,this._z=e.y,this._w=i)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=i),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(Ge(this.dot(e),-1,1)))}rotateTowards(e,t){const i=this.angleTo(e);if(i===0)return this;const s=Math.min(1,t/i);return this.slerp(e,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){const i=e._x,s=e._y,r=e._z,a=e._w,o=t._x,l=t._y,c=t._z,d=t._w;return this._x=i*d+a*o+s*c-r*l,this._y=s*d+a*l+r*o-i*c,this._z=r*d+a*c+i*l-s*o,this._w=a*d-i*o-s*l-r*c,this._onChangeCallback(),this}slerp(e,t){let i=e._x,s=e._y,r=e._z,a=e._w,o=this.dot(e);o<0&&(i=-i,s=-s,r=-r,a=-a,o=-o);let l=1-t;if(o<.9995){const c=Math.acos(o),d=Math.sin(c);l=Math.sin(l*c)/d,t=Math.sin(t*c)/d,this._x=this._x*l+i*t,this._y=this._y*l+s*t,this._z=this._z*l+r*t,this._w=this._w*l+a*t,this._onChangeCallback()}else this._x=this._x*l+i*t,this._y=this._y*l+s*t,this._z=this._z*l+r*t,this._w=this._w*l+a*t,this.normalize();return this}slerpQuaternions(e,t,i){return this.copy(e).slerp(t,i)}random(){const e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),i=Math.random(),s=Math.sqrt(1-i),r=Math.sqrt(i);return this.set(s*Math.sin(e),s*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class C{static{C.prototype.isVector3=!0}constructor(e=0,t=0,i=0){this.x=e,this.y=t,this.z=i}set(e,t,i){return i===void 0&&(i=this.z),this.x=e,this.y=t,this.z=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Uo.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Uo.setFromAxisAngle(e,t))}applyMatrix3(e){const t=this.x,i=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[3]*i+r[6]*s,this.y=r[1]*t+r[4]*i+r[7]*s,this.z=r[2]*t+r[5]*i+r[8]*s,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){const t=this.x,i=this.y,s=this.z,r=e.elements,a=1/(r[3]*t+r[7]*i+r[11]*s+r[15]);return this.x=(r[0]*t+r[4]*i+r[8]*s+r[12])*a,this.y=(r[1]*t+r[5]*i+r[9]*s+r[13])*a,this.z=(r[2]*t+r[6]*i+r[10]*s+r[14])*a,this}applyQuaternion(e){const t=this.x,i=this.y,s=this.z,r=e.x,a=e.y,o=e.z,l=e.w,c=2*(a*s-o*i),d=2*(o*t-r*s),f=2*(r*i-a*t);return this.x=t+l*c+a*f-o*d,this.y=i+l*d+o*c-r*f,this.z=s+l*f+r*d-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){const t=this.x,i=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[4]*i+r[8]*s,this.y=r[1]*t+r[5]*i+r[9]*s,this.z=r[2]*t+r[6]*i+r[10]*s,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Ge(this.x,e.x,t.x),this.y=Ge(this.y,e.y,t.y),this.z=Ge(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=Ge(this.x,e,t),this.y=Ge(this.y,e,t),this.z=Ge(this.z,e,t),this}clampLength(e,t){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Ge(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){const i=e.x,s=e.y,r=e.z,a=t.x,o=t.y,l=t.z;return this.x=s*l-r*o,this.y=r*a-i*l,this.z=i*o-s*a,this}projectOnVector(e){const t=e.lengthSq();if(t===0)return this.set(0,0,0);const i=e.dot(this)/t;return this.copy(e).multiplyScalar(i)}projectOnPlane(e){return hr.copy(this).projectOnVector(e),this.sub(hr)}reflect(e){return this.sub(hr.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const i=this.dot(e)/t;return Math.acos(Ge(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,i=this.y-e.y,s=this.z-e.z;return t*t+i*i+s*s}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,i){const s=Math.sin(t)*e;return this.x=s*Math.sin(i),this.y=Math.cos(t)*e,this.z=s*Math.cos(i),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,i){return this.x=e*Math.sin(t),this.y=i,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){const t=this.setFromMatrixColumn(e,0).length(),i=this.setFromMatrixColumn(e,1).length(),s=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=i,this.z=s,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const e=Math.random()*Math.PI*2,t=Math.random()*2-1,i=Math.sqrt(1-t*t);return this.x=i*Math.cos(e),this.y=t,this.z=i*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const hr=new C,Uo=new an;class Ue{static{Ue.prototype.isMatrix3=!0}constructor(e,t,i,s,r,a,o,l,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,i,s,r,a,o,l,c)}set(e,t,i,s,r,a,o,l,c){const d=this.elements;return d[0]=e,d[1]=s,d[2]=o,d[3]=t,d[4]=r,d[5]=l,d[6]=i,d[7]=a,d[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){const t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],this}extractBasis(e,t,i){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(e){const t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const i=e.elements,s=t.elements,r=this.elements,a=i[0],o=i[3],l=i[6],c=i[1],d=i[4],f=i[7],u=i[2],m=i[5],g=i[8],S=s[0],p=s[3],h=s[6],x=s[1],E=s[4],M=s[7],b=s[2],T=s[5],R=s[8];return r[0]=a*S+o*x+l*b,r[3]=a*p+o*E+l*T,r[6]=a*h+o*M+l*R,r[1]=c*S+d*x+f*b,r[4]=c*p+d*E+f*T,r[7]=c*h+d*M+f*R,r[2]=u*S+m*x+g*b,r[5]=u*p+m*E+g*T,r[8]=u*h+m*M+g*R,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){const e=this.elements,t=e[0],i=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],d=e[8];return t*a*d-t*o*c-i*r*d+i*o*l+s*r*c-s*a*l}invert(){const e=this.elements,t=e[0],i=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],d=e[8],f=d*a-o*c,u=o*l-d*r,m=c*r-a*l,g=t*f+i*u+s*m;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);const S=1/g;return e[0]=f*S,e[1]=(s*c-d*i)*S,e[2]=(o*i-s*a)*S,e[3]=u*S,e[4]=(d*t-s*l)*S,e[5]=(s*r-o*t)*S,e[6]=m*S,e[7]=(i*l-c*t)*S,e[8]=(a*t-i*r)*S,this}transpose(){let e;const t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){const t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,i,s,r,a,o){const l=Math.cos(r),c=Math.sin(r);return this.set(i*l,i*c,-i*(l*a+c*o)+a+e,-s*c,s*l,-s*(-c*a+l*o)+o+t,0,0,1),this}scale(e,t){return Rn("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(dr.makeScale(e,t)),this}rotate(e){return Rn("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(dr.makeRotation(-e)),this}translate(e,t){return Rn("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(dr.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){const t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,i,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){const t=this.elements,i=e.elements;for(let s=0;s<9;s++)if(t[s]!==i[s])return!1;return!0}fromArray(e,t=0){for(let i=0;i<9;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){const i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e}clone(){return new this.constructor().fromArray(this.elements)}}const dr=new Ue,Fo=new Ue().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),No=new Ue().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function pu(){const n={enabled:!0,workingColorSpace:qs,spaces:{},convert:function(s,r,a){return this.enabled===!1||r===a||!r||!a||(this.spaces[r].transfer===Ze&&(s.r=Ci(s.r),s.g=Ci(s.g),s.b=Ci(s.b)),this.spaces[r].primaries!==this.spaces[a].primaries&&(s.applyMatrix3(this.spaces[r].toXYZ),s.applyMatrix3(this.spaces[a].fromXYZ)),this.spaces[a].transfer===Ze&&(s.r=Pn(s.r),s.g=Pn(s.g),s.b=Pn(s.b))),s},workingToColorSpace:function(s,r){return this.convert(s,this.workingColorSpace,r)},colorSpaceToWorking:function(s,r){return this.convert(s,r,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===Vi?Ys:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,r=this.workingColorSpace){return s.fromArray(this.spaces[r].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,r,a){return s.copy(this.spaces[r].toXYZ).multiply(this.spaces[a].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(s,r){return Rn("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),n.workingToColorSpace(s,r)},toWorkingColorSpace:function(s,r){return Rn("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),n.colorSpaceToWorking(s,r)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],i=[.3127,.329];return n.define({[qs]:{primaries:e,whitePoint:i,transfer:Ys,toXYZ:Fo,fromXYZ:No,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:Yt},outputColorSpaceConfig:{drawingBufferColorSpace:Yt}},[Yt]:{primaries:e,whitePoint:i,transfer:Ze,toXYZ:Fo,fromXYZ:No,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:Yt}}}),n}const Ve=pu();function Ci(n){return n<.04045?n*.0773993808:Math.pow(n*.9478672986+.0521327014,2.4)}function Pn(n){return n<.0031308?n*12.92:1.055*Math.pow(n,.41666)-.055}let hn;class mu{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let i;if(e instanceof HTMLCanvasElement)i=e;else{hn===void 0&&(hn=Ks("canvas")),hn.width=e.width,hn.height=e.height;const s=hn.getContext("2d");e instanceof ImageData?s.putImageData(e,0,0):s.drawImage(e,0,0,e.width,e.height),i=hn}return i.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){const t=Ks("canvas");t.width=e.width,t.height=e.height;const i=t.getContext("2d");i.drawImage(e,0,0,e.width,e.height);const s=i.getImageData(0,0,e.width,e.height),r=s.data;for(let a=0;a<r.length;a++)r[a]=Ci(r[a]/255)*255;return i.putImageData(s,0,0),t}else if(e.data){const t=e.data.slice(0);for(let i=0;i<t.length;i++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[i]=Math.floor(Ci(t[i]/255)*255):t[i]=Ci(t[i]);return{data:t,width:e.width,height:e.height}}else return Ie("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}let gu=0;class so{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:gu++}),this.uuid=ls(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){const t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<"u"&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];const i={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let a=0,o=s.length;a<o;a++)s[a].isDataTexture?r.push(fr(s[a].image)):r.push(fr(s[a]))}else r=fr(s);i.url=r}return t||(e.images[this.uuid]=i),i}}function fr(n){return typeof HTMLImageElement<"u"&&n instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&n instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&n instanceof ImageBitmap?mu.getDataURL(n):n.data?{data:Array.from(n.data),width:n.width,height:n.height,type:n.data.constructor.name}:(Ie("Texture: Unable to serialize Texture."),{})}let vu=0;const pr=new C;class kt extends rn{constructor(e=kt.DEFAULT_IMAGE,t=kt.DEFAULT_MAPPING,i=Ti,s=Ti,r=Nt,a=en,o=oi,l=Zt,c=kt.DEFAULT_ANISOTROPY,d=Vi){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:vu++}),this.uuid=ls(),this.name="",this.source=new so(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=i,this.wrapT=s,this.magFilter=r,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new Re(0,0),this.repeat=new Re(1,1),this.center=new Re(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Ue,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=d,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(pr).x}get height(){return this.source.getSize(pr).y}get depth(){return this.source.getSize(pr).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(const t in e){const i=e[t];if(i===void 0){Ie(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}const s=this[t];if(s===void 0){Ie(`Texture.setValues(): property '${t}' does not exist.`);continue}s&&i&&s.isVector2&&i.isVector2||s&&i&&s.isVector3&&i.isVector3||s&&i&&s.isMatrix3&&i.isMatrix3?s.copy(i):this[t]=i}}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];const i={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),t||(e.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==kl)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case ea:e.x=e.x-Math.floor(e.x);break;case Ti:e.x=e.x<0?0:1;break;case ta:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case ea:e.y=e.y-Math.floor(e.y);break;case Ti:e.y=e.y<0?0:1;break;case ta:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}}kt.DEFAULT_IMAGE=null;kt.DEFAULT_MAPPING=kl;kt.DEFAULT_ANISOTROPY=1;class ot{static{ot.prototype.isVector4=!0}constructor(e=0,t=0,i=0,s=1){this.x=e,this.y=t,this.z=i,this.w=s}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,i,s){return this.x=e,this.y=t,this.z=i,this.w=s,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){const t=this.x,i=this.y,s=this.z,r=this.w,a=e.elements;return this.x=a[0]*t+a[4]*i+a[8]*s+a[12]*r,this.y=a[1]*t+a[5]*i+a[9]*s+a[13]*r,this.z=a[2]*t+a[6]*i+a[10]*s+a[14]*r,this.w=a[3]*t+a[7]*i+a[11]*s+a[15]*r,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);const t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,i,s,r;const l=e.elements,c=l[0],d=l[4],f=l[8],u=l[1],m=l[5],g=l[9],S=l[2],p=l[6],h=l[10];if(Math.abs(d-u)<.01&&Math.abs(f-S)<.01&&Math.abs(g-p)<.01){if(Math.abs(d+u)<.1&&Math.abs(f+S)<.1&&Math.abs(g+p)<.1&&Math.abs(c+m+h-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;const E=(c+1)/2,M=(m+1)/2,b=(h+1)/2,T=(d+u)/4,R=(f+S)/4,_=(g+p)/4;return E>M&&E>b?E<.01?(i=0,s=.707106781,r=.707106781):(i=Math.sqrt(E),s=T/i,r=R/i):M>b?M<.01?(i=.707106781,s=0,r=.707106781):(s=Math.sqrt(M),i=T/s,r=_/s):b<.01?(i=.707106781,s=.707106781,r=0):(r=Math.sqrt(b),i=R/r,s=_/r),this.set(i,s,r,t),this}let x=Math.sqrt((p-g)*(p-g)+(f-S)*(f-S)+(u-d)*(u-d));return Math.abs(x)<.001&&(x=1),this.x=(p-g)/x,this.y=(f-S)/x,this.z=(u-d)/x,this.w=Math.acos((c+m+h-1)/2),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Ge(this.x,e.x,t.x),this.y=Ge(this.y,e.y,t.y),this.z=Ge(this.z,e.z,t.z),this.w=Ge(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=Ge(this.x,e,t),this.y=Ge(this.y,e,t),this.z=Ge(this.z,e,t),this.w=Ge(this.w,e,t),this}clampLength(e,t){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Ge(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this.w=e.w+(t.w-e.w)*i,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class _u extends rn{constructor(e=1,t=1,i={}){super(),i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Nt,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},i),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=i.depth,this.scissor=new ot(0,0,e,t),this.scissorTest=!1,this.viewport=new ot(0,0,e,t),this.textures=[];const s={width:e,height:t,depth:i.depth},r=new kt(s),a=i.count;for(let o=0;o<a;o++)this.textures[o]=r.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(i),this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=i.depthTexture,this.samples=i.samples,this.multiview=i.multiview,this.useArrayDepthTexture=i.useArrayDepthTexture}_setTextureOptions(e={}){const t={minFilter:Nt,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let i=0;i<this.textures.length;i++)this.textures[i].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,i=1){if(this.width!==e||this.height!==t||this.depth!==i){this.width=e,this.height=t,this.depth=i;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=e,this.textures[s].image.height=t,this.textures[s].image.depth=i,this.textures[s].isData3DTexture!==!0&&(this.textures[s].isArrayTexture=this.textures[s].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,i=e.textures.length;t<i;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;const s=Object.assign({},e.textures[t].image);this.textures[t].source=new so(s)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}}class Wt extends _u{constructor(e=1,t=1,i={}){super(e,t,i),this.isWebGLRenderTarget=!0}}class Yl extends kt{constructor(e=null,t=1,i=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:i,depth:s},this.magFilter=Pt,this.minFilter=Pt,this.wrapR=Ti,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class xu extends kt{constructor(e=null,t=1,i=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:i,depth:s},this.magFilter=Pt,this.minFilter=Pt,this.wrapR=Ti,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class Je{static{Je.prototype.isMatrix4=!0}constructor(e,t,i,s,r,a,o,l,c,d,f,u,m,g,S,p){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,i,s,r,a,o,l,c,d,f,u,m,g,S,p)}set(e,t,i,s,r,a,o,l,c,d,f,u,m,g,S,p){const h=this.elements;return h[0]=e,h[4]=t,h[8]=i,h[12]=s,h[1]=r,h[5]=a,h[9]=o,h[13]=l,h[2]=c,h[6]=d,h[10]=f,h[14]=u,h[3]=m,h[7]=g,h[11]=S,h[15]=p,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Je().fromArray(this.elements)}copy(e){const t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],t[9]=i[9],t[10]=i[10],t[11]=i[11],t[12]=i[12],t[13]=i[13],t[14]=i[14],t[15]=i[15],this}copyPosition(e){const t=this.elements,i=e.elements;return t[12]=i[12],t[13]=i[13],t[14]=i[14],this}setFromMatrix3(e){const t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,i){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),i.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this)}makeBasis(e,t,i){return this.set(e.x,t.x,i.x,0,e.y,t.y,i.y,0,e.z,t.z,i.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();const t=this.elements,i=e.elements,s=1/dn.setFromMatrixColumn(e,0).length(),r=1/dn.setFromMatrixColumn(e,1).length(),a=1/dn.setFromMatrixColumn(e,2).length();return t[0]=i[0]*s,t[1]=i[1]*s,t[2]=i[2]*s,t[3]=0,t[4]=i[4]*r,t[5]=i[5]*r,t[6]=i[6]*r,t[7]=0,t[8]=i[8]*a,t[9]=i[9]*a,t[10]=i[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){const t=this.elements,i=e.x,s=e.y,r=e.z,a=Math.cos(i),o=Math.sin(i),l=Math.cos(s),c=Math.sin(s),d=Math.cos(r),f=Math.sin(r);if(e.order==="XYZ"){const u=a*d,m=a*f,g=o*d,S=o*f;t[0]=l*d,t[4]=-l*f,t[8]=c,t[1]=m+g*c,t[5]=u-S*c,t[9]=-o*l,t[2]=S-u*c,t[6]=g+m*c,t[10]=a*l}else if(e.order==="YXZ"){const u=l*d,m=l*f,g=c*d,S=c*f;t[0]=u+S*o,t[4]=g*o-m,t[8]=a*c,t[1]=a*f,t[5]=a*d,t[9]=-o,t[2]=m*o-g,t[6]=S+u*o,t[10]=a*l}else if(e.order==="ZXY"){const u=l*d,m=l*f,g=c*d,S=c*f;t[0]=u-S*o,t[4]=-a*f,t[8]=g+m*o,t[1]=m+g*o,t[5]=a*d,t[9]=S-u*o,t[2]=-a*c,t[6]=o,t[10]=a*l}else if(e.order==="ZYX"){const u=a*d,m=a*f,g=o*d,S=o*f;t[0]=l*d,t[4]=g*c-m,t[8]=u*c+S,t[1]=l*f,t[5]=S*c+u,t[9]=m*c-g,t[2]=-c,t[6]=o*l,t[10]=a*l}else if(e.order==="YZX"){const u=a*l,m=a*c,g=o*l,S=o*c;t[0]=l*d,t[4]=S-u*f,t[8]=g*f+m,t[1]=f,t[5]=a*d,t[9]=-o*d,t[2]=-c*d,t[6]=m*f+g,t[10]=u-S*f}else if(e.order==="XZY"){const u=a*l,m=a*c,g=o*l,S=o*c;t[0]=l*d,t[4]=-f,t[8]=c*d,t[1]=u*f+S,t[5]=a*d,t[9]=m*f-g,t[2]=g*f-m,t[6]=o*d,t[10]=S*f+u}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Su,e,Mu)}lookAt(e,t,i){const s=this.elements;return $t.subVectors(e,t),$t.lengthSq()===0&&($t.z=1),$t.normalize(),Fi.crossVectors(i,$t),Fi.lengthSq()===0&&(Math.abs(i.z)===1?$t.x+=1e-4:$t.z+=1e-4,$t.normalize(),Fi.crossVectors(i,$t)),Fi.normalize(),fs.crossVectors($t,Fi),s[0]=Fi.x,s[4]=fs.x,s[8]=$t.x,s[1]=Fi.y,s[5]=fs.y,s[9]=$t.y,s[2]=Fi.z,s[6]=fs.z,s[10]=$t.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const i=e.elements,s=t.elements,r=this.elements,a=i[0],o=i[4],l=i[8],c=i[12],d=i[1],f=i[5],u=i[9],m=i[13],g=i[2],S=i[6],p=i[10],h=i[14],x=i[3],E=i[7],M=i[11],b=i[15],T=s[0],R=s[4],_=s[8],w=s[12],P=s[1],D=s[5],F=s[9],W=s[13],Z=s[2],O=s[6],$=s[10],k=s[14],J=s[3],ee=s[7],ae=s[11],ie=s[15];return r[0]=a*T+o*P+l*Z+c*J,r[4]=a*R+o*D+l*O+c*ee,r[8]=a*_+o*F+l*$+c*ae,r[12]=a*w+o*W+l*k+c*ie,r[1]=d*T+f*P+u*Z+m*J,r[5]=d*R+f*D+u*O+m*ee,r[9]=d*_+f*F+u*$+m*ae,r[13]=d*w+f*W+u*k+m*ie,r[2]=g*T+S*P+p*Z+h*J,r[6]=g*R+S*D+p*O+h*ee,r[10]=g*_+S*F+p*$+h*ae,r[14]=g*w+S*W+p*k+h*ie,r[3]=x*T+E*P+M*Z+b*J,r[7]=x*R+E*D+M*O+b*ee,r[11]=x*_+E*F+M*$+b*ae,r[15]=x*w+E*W+M*k+b*ie,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){const e=this.elements,t=e[0],i=e[4],s=e[8],r=e[12],a=e[1],o=e[5],l=e[9],c=e[13],d=e[2],f=e[6],u=e[10],m=e[14],g=e[3],S=e[7],p=e[11],h=e[15],x=l*m-c*u,E=o*m-c*f,M=o*u-l*f,b=a*m-c*d,T=a*u-l*d,R=a*f-o*d;return t*(S*x-p*E+h*M)-i*(g*x-p*b+h*T)+s*(g*E-S*b+h*R)-r*(g*M-S*T+p*R)}determinantAffine(){const e=this.elements,t=e[0],i=e[4],s=e[8],r=e[1],a=e[5],o=e[9],l=e[2],c=e[6],d=e[10];return t*(a*d-o*c)-i*(r*d-o*l)+s*(r*c-a*l)}transpose(){const e=this.elements;let t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,i){const s=this.elements;return e.isVector3?(s[12]=e.x,s[13]=e.y,s[14]=e.z):(s[12]=e,s[13]=t,s[14]=i),this}invert(){const e=this.elements,t=e[0],i=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],d=e[8],f=e[9],u=e[10],m=e[11],g=e[12],S=e[13],p=e[14],h=e[15],x=t*o-i*a,E=t*l-s*a,M=t*c-r*a,b=i*l-s*o,T=i*c-r*o,R=s*c-r*l,_=d*S-f*g,w=d*p-u*g,P=d*h-m*g,D=f*p-u*S,F=f*h-m*S,W=u*h-m*p,Z=x*W-E*F+M*D+b*P-T*w+R*_;if(Z===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const O=1/Z;return e[0]=(o*W-l*F+c*D)*O,e[1]=(s*F-i*W-r*D)*O,e[2]=(S*R-p*T+h*b)*O,e[3]=(u*T-f*R-m*b)*O,e[4]=(l*P-a*W-c*w)*O,e[5]=(t*W-s*P+r*w)*O,e[6]=(p*M-g*R-h*E)*O,e[7]=(d*R-u*M+m*E)*O,e[8]=(a*F-o*P+c*_)*O,e[9]=(i*P-t*F-r*_)*O,e[10]=(g*T-S*M+h*x)*O,e[11]=(f*M-d*T-m*x)*O,e[12]=(o*w-a*D-l*_)*O,e[13]=(t*D-i*w+s*_)*O,e[14]=(S*E-g*b-p*x)*O,e[15]=(d*b-f*E+u*x)*O,this}scale(e){const t=this.elements,i=e.x,s=e.y,r=e.z;return t[0]*=i,t[4]*=s,t[8]*=r,t[1]*=i,t[5]*=s,t[9]*=r,t[2]*=i,t[6]*=s,t[10]*=r,t[3]*=i,t[7]*=s,t[11]*=r,this}getMaxScaleOnAxis(){const e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],i=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],s=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,i,s))}makeTranslation(e,t,i){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,i,0,0,0,1),this}makeRotationX(e){const t=Math.cos(e),i=Math.sin(e);return this.set(1,0,0,0,0,t,-i,0,0,i,t,0,0,0,0,1),this}makeRotationY(e){const t=Math.cos(e),i=Math.sin(e);return this.set(t,0,i,0,0,1,0,0,-i,0,t,0,0,0,0,1),this}makeRotationZ(e){const t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,0,i,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){const i=Math.cos(t),s=Math.sin(t),r=1-i,a=e.x,o=e.y,l=e.z,c=r*a,d=r*o;return this.set(c*a+i,c*o-s*l,c*l+s*o,0,c*o+s*l,d*o+i,d*l-s*a,0,c*l-s*o,d*l+s*a,r*l*l+i,0,0,0,0,1),this}makeScale(e,t,i){return this.set(e,0,0,0,0,t,0,0,0,0,i,0,0,0,0,1),this}makeShear(e,t,i,s,r,a){return this.set(1,i,r,0,e,1,a,0,t,s,1,0,0,0,0,1),this}compose(e,t,i){const s=this.elements,r=t._x,a=t._y,o=t._z,l=t._w,c=r+r,d=a+a,f=o+o,u=r*c,m=r*d,g=r*f,S=a*d,p=a*f,h=o*f,x=l*c,E=l*d,M=l*f,b=i.x,T=i.y,R=i.z;return s[0]=(1-(S+h))*b,s[1]=(m+M)*b,s[2]=(g-E)*b,s[3]=0,s[4]=(m-M)*T,s[5]=(1-(u+h))*T,s[6]=(p+x)*T,s[7]=0,s[8]=(g+E)*R,s[9]=(p-x)*R,s[10]=(1-(u+S))*R,s[11]=0,s[12]=e.x,s[13]=e.y,s[14]=e.z,s[15]=1,this}decompose(e,t,i){const s=this.elements;e.x=s[12],e.y=s[13],e.z=s[14];const r=this.determinantAffine();if(r===0)return i.set(1,1,1),t.identity(),this;let a=dn.set(s[0],s[1],s[2]).length();const o=dn.set(s[4],s[5],s[6]).length(),l=dn.set(s[8],s[9],s[10]).length();r<0&&(a=-a),ii.copy(this);const c=1/a,d=1/o,f=1/l;return ii.elements[0]*=c,ii.elements[1]*=c,ii.elements[2]*=c,ii.elements[4]*=d,ii.elements[5]*=d,ii.elements[6]*=d,ii.elements[8]*=f,ii.elements[9]*=f,ii.elements[10]*=f,t.setFromRotationMatrix(ii),i.x=a,i.y=o,i.z=l,this}makePerspective(e,t,i,s,r,a,o=pi,l=!1){const c=this.elements,d=2*r/(t-e),f=2*r/(i-s),u=(t+e)/(t-e),m=(i+s)/(i-s);let g,S;if(l)g=r/(a-r),S=a*r/(a-r);else if(o===pi)g=-(a+r)/(a-r),S=-2*a*r/(a-r);else if(o===rs)g=-a/(a-r),S=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=d,c[4]=0,c[8]=u,c[12]=0,c[1]=0,c[5]=f,c[9]=m,c[13]=0,c[2]=0,c[6]=0,c[10]=g,c[14]=S,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,i,s,r,a,o=pi,l=!1){const c=this.elements,d=2/(t-e),f=2/(i-s),u=-(t+e)/(t-e),m=-(i+s)/(i-s);let g,S;if(l)g=1/(a-r),S=a/(a-r);else if(o===pi)g=-2/(a-r),S=-(a+r)/(a-r);else if(o===rs)g=-1/(a-r),S=-r/(a-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=d,c[4]=0,c[8]=0,c[12]=u,c[1]=0,c[5]=f,c[9]=0,c[13]=m,c[2]=0,c[6]=0,c[10]=g,c[14]=S,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){const t=this.elements,i=e.elements;for(let s=0;s<16;s++)if(t[s]!==i[s])return!1;return!0}fromArray(e,t=0){for(let i=0;i<16;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){const i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e[t+9]=i[9],e[t+10]=i[10],e[t+11]=i[11],e[t+12]=i[12],e[t+13]=i[13],e[t+14]=i[14],e[t+15]=i[15],e}}const dn=new C,ii=new Je,Su=new C(0,0,0),Mu=new C(1,1,1),Fi=new C,fs=new C,$t=new C,Oo=new Je,Bo=new an;class Pi{constructor(e=0,t=0,i=0,s=Pi.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=i,this._order=s}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,i,s=this._order){return this._x=e,this._y=t,this._z=i,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,i=!0){const s=e.elements,r=s[0],a=s[4],o=s[8],l=s[1],c=s[5],d=s[9],f=s[2],u=s[6],m=s[10];switch(t){case"XYZ":this._y=Math.asin(Ge(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-d,m),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(u,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Ge(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(o,m),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-f,r),this._z=0);break;case"ZXY":this._x=Math.asin(Ge(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(-f,m),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-Ge(f,-1,1)),Math.abs(f)<.9999999?(this._x=Math.atan2(u,m),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(Ge(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-d,c),this._y=Math.atan2(-f,r)):(this._x=0,this._y=Math.atan2(o,m));break;case"XZY":this._z=Math.asin(-Ge(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(u,c),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-d,m),this._y=0);break;default:Ie("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,i===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,i){return Oo.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Oo,t,i)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return Bo.setFromEuler(this),this.setFromQuaternion(Bo,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}Pi.DEFAULT_ORDER="XYZ";class ro{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}let yu=0;const zo=new C,fn=new an,Si=new Je,ps=new C,Vn=new C,bu=new C,Eu=new an,ko=new C(1,0,0),Vo=new C(0,1,0),Go=new C(0,0,1),Ho={type:"added"},wu={type:"removed"},pn={type:"childadded",child:null},mr={type:"childremoved",child:null};class yt extends rn{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:yu++}),this.uuid=ls(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=yt.DEFAULT_UP.clone();const e=new C,t=new Pi,i=new an,s=new C(1,1,1);function r(){i.setFromEuler(t,!1)}function a(){t.setFromQuaternion(i,void 0,!1)}t._onChange(r),i._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new Je},normalMatrix:{value:new Ue}}),this.matrix=new Je,this.matrixWorld=new Je,this.matrixAutoUpdate=yt.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=yt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new ro,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return fn.setFromAxisAngle(e,t),this.quaternion.multiply(fn),this}rotateOnWorldAxis(e,t){return fn.setFromAxisAngle(e,t),this.quaternion.premultiply(fn),this}rotateX(e){return this.rotateOnAxis(ko,e)}rotateY(e){return this.rotateOnAxis(Vo,e)}rotateZ(e){return this.rotateOnAxis(Go,e)}translateOnAxis(e,t){return zo.copy(e).applyQuaternion(this.quaternion),this.position.add(zo.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(ko,e)}translateY(e){return this.translateOnAxis(Vo,e)}translateZ(e){return this.translateOnAxis(Go,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(Si.copy(this.matrixWorld).invert())}lookAt(e,t,i){e.isVector3?ps.copy(e):ps.set(e,t,i);const s=this.parent;this.updateWorldMatrix(!0,!1),Vn.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Si.lookAt(Vn,ps,this.up):Si.lookAt(ps,Vn,this.up),this.quaternion.setFromRotationMatrix(Si),s&&(Si.extractRotation(s.matrixWorld),fn.setFromRotationMatrix(Si),this.quaternion.premultiply(fn.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(Xe("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Ho),pn.child=e,this.dispatchEvent(pn),pn.child=null):Xe("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}const t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(wu),mr.child=e,this.dispatchEvent(mr),mr.child=null),this}removeFromParent(){const e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),Si.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),Si.multiply(e.parent.matrixWorld)),e.applyMatrix4(Si),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Ho),pn.child=e,this.dispatchEvent(pn),pn.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let i=0,s=this.children.length;i<s;i++){const a=this.children[i].getObjectByProperty(e,t);if(a!==void 0)return a}}getObjectsByProperty(e,t,i=[]){this[e]===t&&i.push(this);const s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].getObjectsByProperty(e,t,i);return i}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Vn,e,bu),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Vn,Eu,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);const t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);const t=this.children;for(let i=0,s=t.length;i<s;i++)t[i].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);const t=this.children;for(let i=0,s=t.length;i<s;i++)t[i].traverseVisible(e)}traverseAncestors(e){const t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);const e=this.pivot;if(e!==null){const t=e.x,i=e.y,s=e.z,r=this.matrix.elements;r[12]+=t-r[0]*t-r[4]*i-r[8]*s,r[13]+=i-r[1]*t-r[5]*i-r[9]*s,r[14]+=s-r[2]*t-r[6]*i-r[10]*s}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);const t=this.children;for(let i=0,s=t.length;i<s;i++)t[i].updateMatrixWorld(e)}updateWorldMatrix(e,t,i=!1){const s=this.parent;if(e===!0&&s!==null&&s.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||i)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,i=!0),t===!0){const r=this.children;for(let a=0,o=r.length;a<o;a++)r[a].updateWorldMatrix(!1,!0,i)}}toJSON(e){const t=e===void 0||typeof e=="string",i={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});const s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),this.static!==!1&&(s.static=this.static),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.pivot!==null&&(s.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(s.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(s.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(o=>({...o})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(e),s.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function r(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(e.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const l=o.shapes;if(Array.isArray(l))for(let c=0,d=l.length;c<d;c++){const f=l[c];r(e.shapes,f)}else r(e.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(e.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(r(e.materials,this.material[l]));s.material=o}else s.material=r(e.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){const l=this.animations[o];s.animations.push(r(e.animations,l))}}if(t){const o=a(e.geometries),l=a(e.materials),c=a(e.textures),d=a(e.images),f=a(e.shapes),u=a(e.skeletons),m=a(e.animations),g=a(e.nodes);o.length>0&&(i.geometries=o),l.length>0&&(i.materials=l),c.length>0&&(i.textures=c),d.length>0&&(i.images=d),f.length>0&&(i.shapes=f),u.length>0&&(i.skeletons=u),m.length>0&&(i.animations=m),g.length>0&&(i.nodes=g)}return i.object=s,i;function a(o){const l=[];for(const c in o){const d=o[c];delete d.metadata,l.push(d)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let i=0;i<e.children.length;i++){const s=e.children[i];this.add(s.clone())}return this}}yt.DEFAULT_UP=new C(0,1,0);yt.DEFAULT_MATRIX_AUTO_UPDATE=!0;yt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;class Cn extends yt{constructor(){super(),this.isGroup=!0,this.type="Group"}}const Tu={type:"move"};class gr{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Cn,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Cn,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new C,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new C),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Cn,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new C,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new C,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){const t=this._hand;if(t)for(const i of e.hand.values())this._getHandJoint(t,i)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,i){let s=null,r=null,a=null;const o=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){a=!0;for(const S of e.hand.values()){const p=t.getJointPose(S,i),h=this._getHandJoint(c,S);p!==null&&(h.matrix.fromArray(p.transform.matrix),h.matrix.decompose(h.position,h.rotation,h.scale),h.matrixWorldNeedsUpdate=!0,h.jointRadius=p.radius),h.visible=p!==null}const d=c.joints["index-finger-tip"],f=c.joints["thumb-tip"],u=d.position.distanceTo(f.position),m=.02,g=.005;c.inputState.pinching&&u>m+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&u<=m-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(r=t.getPose(e.gripSpace,i),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:e,target:this})));o!==null&&(s=t.getPose(e.targetRaySpace,i),s===null&&r!==null&&(s=r),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(Tu)))}return o!==null&&(o.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){const i=new Cn;i.matrixAutoUpdate=!1,i.visible=!1,e.joints[t.jointName]=i,e.add(i)}return e.joints[t.jointName]}}const Kl={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Ni={h:0,s:0,l:0},ms={h:0,s:0,l:0};function vr(n,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?n+(e-n)*6*t:t<1/2?e:t<2/3?n+(e-n)*6*(2/3-t):n}class te{constructor(e,t,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,i)}set(e,t,i){if(t===void 0&&i===void 0){const s=e;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(e,t,i);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Yt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,Ve.colorSpaceToWorking(this,t),this}setRGB(e,t,i,s=Ve.workingColorSpace){return this.r=e,this.g=t,this.b=i,Ve.colorSpaceToWorking(this,s),this}setHSL(e,t,i,s=Ve.workingColorSpace){if(e=fu(e,1),t=Ge(t,0,1),i=Ge(i,0,1),t===0)this.r=this.g=this.b=i;else{const r=i<=.5?i*(1+t):i+t-i*t,a=2*i-r;this.r=vr(a,r,e+1/3),this.g=vr(a,r,e),this.b=vr(a,r,e-1/3)}return Ve.colorSpaceToWorking(this,s),this}setStyle(e,t=Yt){function i(r){r!==void 0&&parseFloat(r)<1&&Ie("Color: Alpha component of "+e+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(e)){let r;const a=s[1],o=s[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:Ie("Color: Unknown color model "+e)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(e)){const r=s[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);if(a===6)return this.setHex(parseInt(r,16),t);Ie("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Yt){const i=Kl[e.toLowerCase()];return i!==void 0?this.setHex(i,t):Ie("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Ci(e.r),this.g=Ci(e.g),this.b=Ci(e.b),this}copyLinearToSRGB(e){return this.r=Pn(e.r),this.g=Pn(e.g),this.b=Pn(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Yt){return Ve.workingToColorSpace(It.copy(this),e),Math.round(Ge(It.r*255,0,255))*65536+Math.round(Ge(It.g*255,0,255))*256+Math.round(Ge(It.b*255,0,255))}getHexString(e=Yt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Ve.workingColorSpace){Ve.workingToColorSpace(It.copy(this),t);const i=It.r,s=It.g,r=It.b,a=Math.max(i,s,r),o=Math.min(i,s,r);let l,c;const d=(o+a)/2;if(o===a)l=0,c=0;else{const f=a-o;switch(c=d<=.5?f/(a+o):f/(2-a-o),a){case i:l=(s-r)/f+(s<r?6:0);break;case s:l=(r-i)/f+2;break;case r:l=(i-s)/f+4;break}l/=6}return e.h=l,e.s=c,e.l=d,e}getRGB(e,t=Ve.workingColorSpace){return Ve.workingToColorSpace(It.copy(this),t),e.r=It.r,e.g=It.g,e.b=It.b,e}getStyle(e=Yt){Ve.workingToColorSpace(It.copy(this),e);const t=It.r,i=It.g,s=It.b;return e!==Yt?`color(${e} ${t.toFixed(3)} ${i.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(i*255)},${Math.round(s*255)})`}offsetHSL(e,t,i){return this.getHSL(Ni),this.setHSL(Ni.h+e,Ni.s+t,Ni.l+i)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,i){return this.r=e.r+(t.r-e.r)*i,this.g=e.g+(t.g-e.g)*i,this.b=e.b+(t.b-e.b)*i,this}lerpHSL(e,t){this.getHSL(Ni),e.getHSL(ms);const i=ur(Ni.h,ms.h,t),s=ur(Ni.s,ms.s,t),r=ur(Ni.l,ms.l,t);return this.setHSL(i,s,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){const t=this.r,i=this.g,s=this.b,r=e.elements;return this.r=r[0]*t+r[3]*i+r[6]*s,this.g=r[1]*t+r[4]*i+r[7]*s,this.b=r[2]*t+r[5]*i+r[8]*s,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const It=new te;te.NAMES=Kl;class ao{constructor(e,t=1,i=1e3){this.isFog=!0,this.name="",this.color=new te(e),this.near=t,this.far=i}clone(){return new ao(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}}class Zl extends yt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Pi,this.environmentIntensity=1,this.environmentRotation=new Pi,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){const t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}}const ni=new C,Mi=new C,_r=new C,yi=new C,mn=new C,gn=new C,Wo=new C,xr=new C,Sr=new C,Mr=new C,yr=new ot,br=new ot,Er=new ot;class ri{constructor(e=new C,t=new C,i=new C){this.a=e,this.b=t,this.c=i}static getNormal(e,t,i,s){s.subVectors(i,t),ni.subVectors(e,t),s.cross(ni);const r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(e,t,i,s,r){ni.subVectors(s,t),Mi.subVectors(i,t),_r.subVectors(e,t);const a=ni.dot(ni),o=ni.dot(Mi),l=ni.dot(_r),c=Mi.dot(Mi),d=Mi.dot(_r),f=a*c-o*o;if(f===0)return r.set(0,0,0),null;const u=1/f,m=(c*l-o*d)*u,g=(a*d-o*l)*u;return r.set(1-m-g,g,m)}static containsPoint(e,t,i,s){return this.getBarycoord(e,t,i,s,yi)===null?!1:yi.x>=0&&yi.y>=0&&yi.x+yi.y<=1}static getInterpolation(e,t,i,s,r,a,o,l){return this.getBarycoord(e,t,i,s,yi)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,yi.x),l.addScaledVector(a,yi.y),l.addScaledVector(o,yi.z),l)}static getInterpolatedAttribute(e,t,i,s,r,a){return yr.setScalar(0),br.setScalar(0),Er.setScalar(0),yr.fromBufferAttribute(e,t),br.fromBufferAttribute(e,i),Er.fromBufferAttribute(e,s),a.setScalar(0),a.addScaledVector(yr,r.x),a.addScaledVector(br,r.y),a.addScaledVector(Er,r.z),a}static isFrontFacing(e,t,i,s){return ni.subVectors(i,t),Mi.subVectors(e,t),ni.cross(Mi).dot(s)<0}set(e,t,i){return this.a.copy(e),this.b.copy(t),this.c.copy(i),this}setFromPointsAndIndices(e,t,i,s){return this.a.copy(e[t]),this.b.copy(e[i]),this.c.copy(e[s]),this}setFromAttributeAndIndices(e,t,i,s){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,i),this.c.fromBufferAttribute(e,s),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return ni.subVectors(this.c,this.b),Mi.subVectors(this.a,this.b),ni.cross(Mi).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return ri.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return ri.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,i,s,r){return ri.getInterpolation(e,this.a,this.b,this.c,t,i,s,r)}containsPoint(e){return ri.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return ri.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){const i=this.a,s=this.b,r=this.c;let a,o;mn.subVectors(s,i),gn.subVectors(r,i),xr.subVectors(e,i);const l=mn.dot(xr),c=gn.dot(xr);if(l<=0&&c<=0)return t.copy(i);Sr.subVectors(e,s);const d=mn.dot(Sr),f=gn.dot(Sr);if(d>=0&&f<=d)return t.copy(s);const u=l*f-d*c;if(u<=0&&l>=0&&d<=0)return a=l/(l-d),t.copy(i).addScaledVector(mn,a);Mr.subVectors(e,r);const m=mn.dot(Mr),g=gn.dot(Mr);if(g>=0&&m<=g)return t.copy(r);const S=m*c-l*g;if(S<=0&&c>=0&&g<=0)return o=c/(c-g),t.copy(i).addScaledVector(gn,o);const p=d*g-m*f;if(p<=0&&f-d>=0&&m-g>=0)return Wo.subVectors(r,s),o=(f-d)/(f-d+(m-g)),t.copy(s).addScaledVector(Wo,o);const h=1/(p+S+u);return a=S*h,o=u*h,t.copy(i).addScaledVector(mn,a).addScaledVector(gn,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}class on{constructor(e=new C(1/0,1/0,1/0),t=new C(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t+=3)this.expandByPoint(si.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,i=e.count;t<i;t++)this.expandByPoint(si.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const i=si.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(i),this.max.copy(e).add(i),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);const i=e.geometry;if(i!==void 0){const r=i.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)e.isMesh===!0?e.getVertexPosition(a,si):si.fromBufferAttribute(r,a),si.applyMatrix4(e.matrixWorld),this.expandByPoint(si);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),gs.copy(e.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),gs.copy(i.boundingBox)),gs.applyMatrix4(e.matrixWorld),this.union(gs)}const s=e.children;for(let r=0,a=s.length;r<a;r++)this.expandByObject(s[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,si),si.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,i;return e.normal.x>0?(t=e.normal.x*this.min.x,i=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,i=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,i+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,i+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,i+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,i+=e.normal.z*this.min.z),t<=-e.constant&&i>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Gn),vs.subVectors(this.max,Gn),vn.subVectors(e.a,Gn),_n.subVectors(e.b,Gn),xn.subVectors(e.c,Gn),Oi.subVectors(_n,vn),Bi.subVectors(xn,_n),Yi.subVectors(vn,xn);let t=[0,-Oi.z,Oi.y,0,-Bi.z,Bi.y,0,-Yi.z,Yi.y,Oi.z,0,-Oi.x,Bi.z,0,-Bi.x,Yi.z,0,-Yi.x,-Oi.y,Oi.x,0,-Bi.y,Bi.x,0,-Yi.y,Yi.x,0];return!wr(t,vn,_n,xn,vs)||(t=[1,0,0,0,1,0,0,0,1],!wr(t,vn,_n,xn,vs))?!1:(_s.crossVectors(Oi,Bi),t=[_s.x,_s.y,_s.z],wr(t,vn,_n,xn,vs))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,si).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(si).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(bi[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),bi[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),bi[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),bi[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),bi[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),bi[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),bi[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),bi[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(bi),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}}const bi=[new C,new C,new C,new C,new C,new C,new C,new C],si=new C,gs=new on,vn=new C,_n=new C,xn=new C,Oi=new C,Bi=new C,Yi=new C,Gn=new C,vs=new C,_s=new C,Ki=new C;function wr(n,e,t,i,s){for(let r=0,a=n.length-3;r<=a;r+=3){Ki.fromArray(n,r);const o=s.x*Math.abs(Ki.x)+s.y*Math.abs(Ki.y)+s.z*Math.abs(Ki.z),l=e.dot(Ki),c=t.dot(Ki),d=i.dot(Ki);if(Math.max(-Math.max(l,c,d),Math.min(l,c,d))>o)return!1}return!0}const _t=new C,xs=new Re;let Au=0;class xt extends rn{constructor(e,t,i=!1){if(super(),Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Au++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=i,this.usage=Po,this.updateRanges=[],this.gpuType=ai,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,i){e*=this.itemSize,i*=t.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[e+s]=t.array[i+s];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,i=this.count;t<i;t++)xs.fromBufferAttribute(this,t),xs.applyMatrix3(e),this.setXY(t,xs.x,xs.y);else if(this.itemSize===3)for(let t=0,i=this.count;t<i;t++)_t.fromBufferAttribute(this,t),_t.applyMatrix3(e),this.setXYZ(t,_t.x,_t.y,_t.z);return this}applyMatrix4(e){for(let t=0,i=this.count;t<i;t++)_t.fromBufferAttribute(this,t),_t.applyMatrix4(e),this.setXYZ(t,_t.x,_t.y,_t.z);return this}applyNormalMatrix(e){for(let t=0,i=this.count;t<i;t++)_t.fromBufferAttribute(this,t),_t.applyNormalMatrix(e),this.setXYZ(t,_t.x,_t.y,_t.z);return this}transformDirection(e){for(let t=0,i=this.count;t<i;t++)_t.fromBufferAttribute(this,t),_t.transformDirection(e),this.setXYZ(t,_t.x,_t.y,_t.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let i=this.array[e*this.itemSize+t];return this.normalized&&(i=kn(i,this.array)),i}setComponent(e,t,i){return this.normalized&&(i=Gt(i,this.array)),this.array[e*this.itemSize+t]=i,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=kn(t,this.array)),t}setX(e,t){return this.normalized&&(t=Gt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=kn(t,this.array)),t}setY(e,t){return this.normalized&&(t=Gt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=kn(t,this.array)),t}setZ(e,t){return this.normalized&&(t=Gt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=kn(t,this.array)),t}setW(e,t){return this.normalized&&(t=Gt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,i){return e*=this.itemSize,this.normalized&&(t=Gt(t,this.array),i=Gt(i,this.array)),this.array[e+0]=t,this.array[e+1]=i,this}setXYZ(e,t,i,s){return e*=this.itemSize,this.normalized&&(t=Gt(t,this.array),i=Gt(i,this.array),s=Gt(s,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=s,this}setXYZW(e,t,i,s,r){return e*=this.itemSize,this.normalized&&(t=Gt(t,this.array),i=Gt(i,this.array),s=Gt(s,this.array),r=Gt(r,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=s,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==Po&&(e.usage=this.usage),e}dispose(){this.dispatchEvent({type:"dispose"})}}class Jl extends xt{constructor(e,t,i){super(new Uint16Array(e),t,i)}}class Ql extends xt{constructor(e,t,i){super(new Uint32Array(e),t,i)}}class mt extends xt{constructor(e,t,i){super(new Float32Array(e),t,i)}}const Cu=new on,Hn=new C,Tr=new C;class ti{constructor(e=new C,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){const i=this.center;t!==void 0?i.copy(t):Cu.setFromPoints(e).getCenter(i);let s=0;for(let r=0,a=e.length;r<a;r++)s=Math.max(s,i.distanceToSquared(e[r]));return this.radius=Math.sqrt(s),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){const t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){const i=this.center.distanceToSquared(e);return t.copy(e),i>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Hn.subVectors(e,this.center);const t=Hn.lengthSq();if(t>this.radius*this.radius){const i=Math.sqrt(t),s=(i-this.radius)*.5;this.center.addScaledVector(Hn,s/i),this.radius+=s}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(Tr.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Hn.copy(e.center).add(Tr)),this.expandByPoint(Hn.copy(e.center).sub(Tr))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}}let Ru=0;const ei=new Je,Ar=new yt,Sn=new C,qt=new on,Wn=new on,Ct=new C;class Tt extends rn{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Ru++}),this.uuid=ls(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(cu(e)?Ql:Jl)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,i=0){this.groups.push({start:e,count:t,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){const t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);const i=this.attributes.normal;if(i!==void 0){const r=new Ue().getNormalMatrix(e);i.applyNormalMatrix(r),i.needsUpdate=!0}const s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(e),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return ei.makeRotationFromQuaternion(e),this.applyMatrix4(ei),this}rotateX(e){return ei.makeRotationX(e),this.applyMatrix4(ei),this}rotateY(e){return ei.makeRotationY(e),this.applyMatrix4(ei),this}rotateZ(e){return ei.makeRotationZ(e),this.applyMatrix4(ei),this}translate(e,t,i){return ei.makeTranslation(e,t,i),this.applyMatrix4(ei),this}scale(e,t,i){return ei.makeScale(e,t,i),this.applyMatrix4(ei),this}lookAt(e){return Ar.lookAt(e),Ar.updateMatrix(),this.applyMatrix4(Ar.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Sn).negate(),this.translate(Sn.x,Sn.y,Sn.z),this}setFromPoints(e){const t=this.getAttribute("position");if(t===void 0){const i=[];for(let s=0,r=e.length;s<r;s++){const a=e[s];i.push(a.x,a.y,a.z||0)}this.setAttribute("position",new mt(i,3))}else{const i=Math.min(e.length,t.count);for(let s=0;s<i;s++){const r=e[s];t.setXYZ(s,r.x,r.y,r.z||0)}e.length>t.count&&Ie("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new on);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Xe("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new C(-1/0,-1/0,-1/0),new C(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let i=0,s=t.length;i<s;i++){const r=t[i];qt.setFromBufferAttribute(r),this.morphTargetsRelative?(Ct.addVectors(this.boundingBox.min,qt.min),this.boundingBox.expandByPoint(Ct),Ct.addVectors(this.boundingBox.max,qt.max),this.boundingBox.expandByPoint(Ct)):(this.boundingBox.expandByPoint(qt.min),this.boundingBox.expandByPoint(qt.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Xe('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new ti);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Xe("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new C,1/0);return}if(e){const i=this.boundingSphere.center;if(qt.setFromBufferAttribute(e),t)for(let r=0,a=t.length;r<a;r++){const o=t[r];Wn.setFromBufferAttribute(o),this.morphTargetsRelative?(Ct.addVectors(qt.min,Wn.min),qt.expandByPoint(Ct),Ct.addVectors(qt.max,Wn.max),qt.expandByPoint(Ct)):(qt.expandByPoint(Wn.min),qt.expandByPoint(Wn.max))}qt.getCenter(i);let s=0;for(let r=0,a=e.count;r<a;r++)Ct.fromBufferAttribute(e,r),s=Math.max(s,i.distanceToSquared(Ct));if(t)for(let r=0,a=t.length;r<a;r++){const o=t[r],l=this.morphTargetsRelative;for(let c=0,d=o.count;c<d;c++)Ct.fromBufferAttribute(o,c),l&&(Sn.fromBufferAttribute(e,c),Ct.add(Sn)),s=Math.max(s,i.distanceToSquared(Ct))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&Xe('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){Xe("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const i=t.position,s=t.normal,r=t.uv;let a=this.getAttribute("tangent");(a===void 0||a.count!==i.count)&&(a=new xt(new Float32Array(4*i.count),4),this.setAttribute("tangent",a));const o=[],l=[];for(let _=0;_<i.count;_++)o[_]=new C,l[_]=new C;const c=new C,d=new C,f=new C,u=new Re,m=new Re,g=new Re,S=new C,p=new C;function h(_,w,P){c.fromBufferAttribute(i,_),d.fromBufferAttribute(i,w),f.fromBufferAttribute(i,P),u.fromBufferAttribute(r,_),m.fromBufferAttribute(r,w),g.fromBufferAttribute(r,P),d.sub(c),f.sub(c),m.sub(u),g.sub(u);const D=1/(m.x*g.y-g.x*m.y);isFinite(D)&&(S.copy(d).multiplyScalar(g.y).addScaledVector(f,-m.y).multiplyScalar(D),p.copy(f).multiplyScalar(m.x).addScaledVector(d,-g.x).multiplyScalar(D),o[_].add(S),o[w].add(S),o[P].add(S),l[_].add(p),l[w].add(p),l[P].add(p))}let x=this.groups;x.length===0&&(x=[{start:0,count:e.count}]);for(let _=0,w=x.length;_<w;++_){const P=x[_],D=P.start,F=P.count;for(let W=D,Z=D+F;W<Z;W+=3)h(e.getX(W+0),e.getX(W+1),e.getX(W+2))}const E=new C,M=new C,b=new C,T=new C;function R(_){b.fromBufferAttribute(s,_),T.copy(b);const w=o[_];E.copy(w),E.sub(b.multiplyScalar(b.dot(w))).normalize(),M.crossVectors(T,w);const D=M.dot(l[_])<0?-1:1;a.setXYZW(_,E.x,E.y,E.z,D)}for(let _=0,w=x.length;_<w;++_){const P=x[_],D=P.start,F=P.count;for(let W=D,Z=D+F;W<Z;W+=3)R(e.getX(W+0)),R(e.getX(W+1)),R(e.getX(W+2))}this._transformed=!0}computeVertexNormals(){const e=this.index,t=this.getAttribute("position");if(t!==void 0){let i=this.getAttribute("normal");if(i===void 0||i.count!==t.count)i=new xt(new Float32Array(t.count*3),3),this.setAttribute("normal",i);else for(let u=0,m=i.count;u<m;u++)i.setXYZ(u,0,0,0);const s=new C,r=new C,a=new C,o=new C,l=new C,c=new C,d=new C,f=new C;if(e)for(let u=0,m=e.count;u<m;u+=3){const g=e.getX(u+0),S=e.getX(u+1),p=e.getX(u+2);s.fromBufferAttribute(t,g),r.fromBufferAttribute(t,S),a.fromBufferAttribute(t,p),d.subVectors(a,r),f.subVectors(s,r),d.cross(f),o.fromBufferAttribute(i,g),l.fromBufferAttribute(i,S),c.fromBufferAttribute(i,p),o.add(d),l.add(d),c.add(d),i.setXYZ(g,o.x,o.y,o.z),i.setXYZ(S,l.x,l.y,l.z),i.setXYZ(p,c.x,c.y,c.z)}else for(let u=0,m=t.count;u<m;u+=3)s.fromBufferAttribute(t,u+0),r.fromBufferAttribute(t,u+1),a.fromBufferAttribute(t,u+2),d.subVectors(a,r),f.subVectors(s,r),d.cross(f),i.setXYZ(u+0,d.x,d.y,d.z),i.setXYZ(u+1,d.x,d.y,d.z),i.setXYZ(u+2,d.x,d.y,d.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){const e=this.attributes.normal;for(let t=0,i=e.count;t<i;t++)Ct.fromBufferAttribute(e,t),Ct.normalize(),e.setXYZ(t,Ct.x,Ct.y,Ct.z)}toNonIndexed(){function e(o,l){const c=o.array,d=o.itemSize,f=o.normalized,u=new c.constructor(l.length*d);let m=0,g=0;for(let S=0,p=l.length;S<p;S++){o.isInterleavedBufferAttribute?m=l[S]*o.data.stride+o.offset:m=l[S]*d;for(let h=0;h<d;h++)u[g++]=c[m++]}return new xt(u,d,f)}if(this.index===null)return Ie("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const t=new Tt,i=this.index.array,s=this.attributes;for(const o in s){const l=s[o],c=e(l,i);t.setAttribute(o,c)}const r=this.morphAttributes;for(const o in r){const l=[],c=r[o];for(let d=0,f=c.length;d<f;d++){const u=c[d],m=e(u,i);l.push(m)}t.morphAttributes[o]=l}t.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,l=a.length;o<l;o++){const c=a[o];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){const e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};const t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});const i=this.attributes;for(const l in i){const c=i[l];e.data.attributes[l]=c.toJSON(e.data)}const s={};let r=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],d=[];for(let f=0,u=c.length;f<u;f++){const m=c[f];d.push(m.toJSON(e.data))}d.length>0&&(s[l]=d,r=!0)}r&&(e.data.morphAttributes=s,e.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const t={};this.name=e.name;const i=e.index;i!==null&&this.setIndex(i.clone());const s=e.attributes;for(const c in s){const d=s[c];this.setAttribute(c,d.clone(t))}const r=e.morphAttributes;for(const c in r){const d=[],f=r[c];for(let u=0,m=f.length;u<m;u++)d.push(f[u].clone(t));this.morphAttributes[c]=d}this.morphTargetsRelative=e.morphTargetsRelative;const a=e.groups;for(let c=0,d=a.length;c<d;c++){const f=a[c];this.addGroup(f.start,f.count,f.materialIndex)}const o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());const l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}}let Pu=0;class Nn extends rn{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Pu++}),this.uuid=ls(),this.name="",this.type="Material",this.blending=Hi,this.side=_i,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Xr,this.blendDst=$r,this.blendEquation=Qi,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new te(0,0,0),this.blendAlpha=0,this.depthFunc=Dn,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Ro,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=un,this.stencilZFail=un,this.stencilZPass=un,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(const t in e){const i=e[t];if(i===void 0){Ie(`Material: parameter '${t}' has value of undefined.`);continue}const s=this[t];if(s===void 0){Ie(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(i):s&&s.isVector2&&i&&i.isVector2||s&&s.isEuler&&i&&i.isEuler||s&&s.isVector3&&i&&i.isVector3?s.copy(i):this[t]=i}}toJSON(e){const t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});const i={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(i.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(i.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(e).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(e).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(e).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(e).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(e).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.shadowSide!==null&&(i.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),this.blending!==Hi&&(i.blending=this.blending),this.side!==_i&&(i.side=this.side),this.vertexColors===!0&&(i.vertexColors=!0),this.opacity<1&&(i.opacity=this.opacity),this.transparent===!0&&(i.transparent=!0),this.blendSrc!==Xr&&(i.blendSrc=this.blendSrc),this.blendDst!==$r&&(i.blendDst=this.blendDst),this.blendEquation!==Qi&&(i.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(i.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(i.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(i.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(i.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(i.blendAlpha=this.blendAlpha),this.depthFunc!==Dn&&(i.depthFunc=this.depthFunc),this.depthTest===!1&&(i.depthTest=this.depthTest),this.depthWrite===!1&&(i.depthWrite=this.depthWrite),this.colorWrite===!1&&(i.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(i.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==Ro&&(i.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(i.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(i.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==un&&(i.stencilFail=this.stencilFail),this.stencilZFail!==un&&(i.stencilZFail=this.stencilZFail),this.stencilZPass!==un&&(i.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(i.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(i.rotation=this.rotation),this.polygonOffset===!0&&(i.polygonOffset=!0),this.polygonOffsetFactor!==0&&(i.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(i.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(i.linewidth=this.linewidth),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.dithering===!0&&(i.dithering=!0),this.alphaTest>0&&(i.alphaTest=this.alphaTest),this.alphaHash===!0&&(i.alphaHash=!0),this.alphaToCoverage===!0&&(i.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(i.premultipliedAlpha=!0),this.forceSinglePass===!0&&(i.forceSinglePass=!0),this.allowOverride===!1&&(i.allowOverride=!1),this.wireframe===!0&&(i.wireframe=!0),this.wireframeLinewidth>1&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(i.flatShading=!0),this.visible===!1&&(i.visible=!1),this.toneMapped===!1&&(i.toneMapped=!1),this.fog===!1&&(i.fog=!1),Object.keys(this.userData).length>0&&(i.userData=this.userData);function s(r){const a=[];for(const o in r){const l=r[o];delete l.metadata,a.push(l)}return a}if(t){const r=s(e.textures),a=s(e.images);r.length>0&&(i.textures=r),a.length>0&&(i.images=a)}return i}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new te().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?this.vertexColors=e.vertexColors>0:this.vertexColors=e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let i=e.normalScale;Array.isArray(i)===!1&&(i=[i,i]),this.normalScale=new Re().fromArray(i)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new Re().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;const t=e.clippingPlanes;let i=null;if(t!==null){const s=t.length;i=new Array(s);for(let r=0;r!==s;++r)i[r]=t[r].clone()}return this.clippingPlanes=i,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}}const Ei=new C,Cr=new C,Ss=new C,zi=new C,Rr=new C,Ms=new C,Pr=new C;class oo{constructor(e=new C,t=new C(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Ei)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);const i=t.dot(this.direction);return i<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){const t=Ei.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Ei.copy(this.origin).addScaledVector(this.direction,t),Ei.distanceToSquared(e))}distanceSqToSegment(e,t,i,s){Cr.copy(e).add(t).multiplyScalar(.5),Ss.copy(t).sub(e).normalize(),zi.copy(this.origin).sub(Cr);const r=e.distanceTo(t)*.5,a=-this.direction.dot(Ss),o=zi.dot(this.direction),l=-zi.dot(Ss),c=zi.lengthSq(),d=Math.abs(1-a*a);let f,u,m,g;if(d>0)if(f=a*l-o,u=a*o-l,g=r*d,f>=0)if(u>=-g)if(u<=g){const S=1/d;f*=S,u*=S,m=f*(f+a*u+2*o)+u*(a*f+u+2*l)+c}else u=r,f=Math.max(0,-(a*u+o)),m=-f*f+u*(u+2*l)+c;else u=-r,f=Math.max(0,-(a*u+o)),m=-f*f+u*(u+2*l)+c;else u<=-g?(f=Math.max(0,-(-a*r+o)),u=f>0?-r:Math.min(Math.max(-r,-l),r),m=-f*f+u*(u+2*l)+c):u<=g?(f=0,u=Math.min(Math.max(-r,-l),r),m=u*(u+2*l)+c):(f=Math.max(0,-(a*r+o)),u=f>0?r:Math.min(Math.max(-r,-l),r),m=-f*f+u*(u+2*l)+c);else u=a>0?-r:r,f=Math.max(0,-(a*u+o)),m=-f*f+u*(u+2*l)+c;return i&&i.copy(this.origin).addScaledVector(this.direction,f),s&&s.copy(Cr).addScaledVector(Ss,u),m}intersectSphere(e,t){Ei.subVectors(e.center,this.origin);const i=Ei.dot(this.direction),s=Ei.dot(Ei)-i*i,r=e.radius*e.radius;if(s>r)return null;const a=Math.sqrt(r-s),o=i-a,l=i+a;return l<0?null:o<0?this.at(l,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){const t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;const i=-(this.origin.dot(e.normal)+e.constant)/t;return i>=0?i:null}intersectPlane(e,t){const i=this.distanceToPlane(e);return i===null?null:this.at(i,t)}intersectsPlane(e){const t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let i,s,r,a,o,l;const c=1/this.direction.x,d=1/this.direction.y,f=1/this.direction.z,u=this.origin;return c>=0?(i=(e.min.x-u.x)*c,s=(e.max.x-u.x)*c):(i=(e.max.x-u.x)*c,s=(e.min.x-u.x)*c),d>=0?(r=(e.min.y-u.y)*d,a=(e.max.y-u.y)*d):(r=(e.max.y-u.y)*d,a=(e.min.y-u.y)*d),i>a||r>s||((r>i||isNaN(i))&&(i=r),(a<s||isNaN(s))&&(s=a),f>=0?(o=(e.min.z-u.z)*f,l=(e.max.z-u.z)*f):(o=(e.max.z-u.z)*f,l=(e.min.z-u.z)*f),i>l||o>s)||((o>i||i!==i)&&(i=o),(l<s||s!==s)&&(s=l),s<0)?null:this.at(i>=0?i:s,t)}intersectsBox(e){return this.intersectBox(e,Ei)!==null}intersectTriangle(e,t,i,s,r){Rr.subVectors(t,e),Ms.subVectors(i,e),Pr.crossVectors(Rr,Ms);let a=this.direction.dot(Pr),o;if(a>0){if(s)return null;o=1}else if(a<0)o=-1,a=-a;else return null;zi.subVectors(this.origin,e);const l=o*this.direction.dot(Ms.crossVectors(zi,Ms));if(l<0)return null;const c=o*this.direction.dot(Rr.cross(zi));if(c<0||l+c>a)return null;const d=-o*zi.dot(Pr);return d<0?null:this.at(d/a,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class Qs extends Nn{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new te(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Pi,this.combine=zl,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}const Xo=new Je,Zi=new oo,ys=new ti,$o=new C,bs=new C,Es=new C,ws=new C,Dr=new C,Ts=new C,qo=new C,As=new C;class He extends yt{constructor(e=new Tt,t=new Qs){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){const t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){const s=t[i[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){const o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(e,t){const i=this.geometry,s=i.attributes.position,r=i.morphAttributes.position,a=i.morphTargetsRelative;t.fromBufferAttribute(s,e);const o=this.morphTargetInfluences;if(r&&o){Ts.set(0,0,0);for(let l=0,c=r.length;l<c;l++){const d=o[l],f=r[l];d!==0&&(Dr.fromBufferAttribute(f,e),a?Ts.addScaledVector(Dr,d):Ts.addScaledVector(Dr.sub(t),d))}t.add(Ts)}return t}raycast(e,t){const i=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),ys.copy(i.boundingSphere),ys.applyMatrix4(r),Zi.copy(e.ray).recast(e.near),!(ys.containsPoint(Zi.origin)===!1&&(Zi.intersectSphere(ys,$o)===null||Zi.origin.distanceToSquared($o)>(e.far-e.near)**2))&&(Xo.copy(r).invert(),Zi.copy(e.ray).applyMatrix4(Xo),!(i.boundingBox!==null&&Zi.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(e,t,Zi)))}_computeIntersections(e,t,i){let s;const r=this.geometry,a=this.material,o=r.index,l=r.attributes.position,c=r.attributes.uv,d=r.attributes.uv1,f=r.attributes.normal,u=r.groups,m=r.drawRange;if(o!==null)if(Array.isArray(a))for(let g=0,S=u.length;g<S;g++){const p=u[g],h=a[p.materialIndex],x=Math.max(p.start,m.start),E=Math.min(o.count,Math.min(p.start+p.count,m.start+m.count));for(let M=x,b=E;M<b;M+=3){const T=o.getX(M),R=o.getX(M+1),_=o.getX(M+2);s=Cs(this,h,e,i,c,d,f,T,R,_),s&&(s.faceIndex=Math.floor(M/3),s.face.materialIndex=p.materialIndex,t.push(s))}}else{const g=Math.max(0,m.start),S=Math.min(o.count,m.start+m.count);for(let p=g,h=S;p<h;p+=3){const x=o.getX(p),E=o.getX(p+1),M=o.getX(p+2);s=Cs(this,a,e,i,c,d,f,x,E,M),s&&(s.faceIndex=Math.floor(p/3),t.push(s))}}else if(l!==void 0)if(Array.isArray(a))for(let g=0,S=u.length;g<S;g++){const p=u[g],h=a[p.materialIndex],x=Math.max(p.start,m.start),E=Math.min(l.count,Math.min(p.start+p.count,m.start+m.count));for(let M=x,b=E;M<b;M+=3){const T=M,R=M+1,_=M+2;s=Cs(this,h,e,i,c,d,f,T,R,_),s&&(s.faceIndex=Math.floor(M/3),s.face.materialIndex=p.materialIndex,t.push(s))}}else{const g=Math.max(0,m.start),S=Math.min(l.count,m.start+m.count);for(let p=g,h=S;p<h;p+=3){const x=p,E=p+1,M=p+2;s=Cs(this,a,e,i,c,d,f,x,E,M),s&&(s.faceIndex=Math.floor(p/3),t.push(s))}}}}function Du(n,e,t,i,s,r,a,o){let l;if(e.side===Ot?l=i.intersectTriangle(a,r,s,!0,o):l=i.intersectTriangle(s,r,a,e.side===_i,o),l===null)return null;As.copy(o),As.applyMatrix4(n.matrixWorld);const c=t.ray.origin.distanceTo(As);return c<t.near||c>t.far?null:{distance:c,point:As.clone(),object:n}}function Cs(n,e,t,i,s,r,a,o,l,c){n.getVertexPosition(o,bs),n.getVertexPosition(l,Es),n.getVertexPosition(c,ws);const d=Du(n,e,t,i,bs,Es,ws,qo);if(d){const f=new C;ri.getBarycoord(qo,bs,Es,ws,f),s&&(d.uv=ri.getInterpolatedAttribute(s,o,l,c,f,new Re)),r&&(d.uv1=ri.getInterpolatedAttribute(r,o,l,c,f,new Re)),a&&(d.normal=ri.getInterpolatedAttribute(a,o,l,c,f,new C),d.normal.dot(i.direction)>0&&d.normal.multiplyScalar(-1));const u={a:o,b:l,c,normal:new C,materialIndex:0};ri.getNormal(bs,Es,ws,u.normal),d.face=u,d.barycoord=f}return d}class jl extends kt{constructor(e=null,t=1,i=1,s,r,a,o,l,c=Pt,d=Pt,f,u){super(null,a,o,l,c,d,s,r,f,u),this.isDataTexture=!0,this.image={data:e,width:t,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class Ai extends xt{constructor(e,t,i,s=1){super(e,t,i),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=s}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){const e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}}const Mn=new Je,Yo=new Je,Rs=[],Ko=new on,Lu=new Je,Xn=new He,$n=new ti;class Iu extends He{constructor(e,t,i){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new Ai(new Float32Array(i*16),16),this.instanceColor=null,this.morphTexture=null,this.count=i,this.boundingBox=null,this.boundingSphere=null;for(let s=0;s<i;s++)this.setMatrixAt(s,Lu)}computeBoundingBox(){const e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new on),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let i=0;i<t;i++)this.getMatrixAt(i,Mn),Ko.copy(e.boundingBox).applyMatrix4(Mn),this.boundingBox.union(Ko)}computeBoundingSphere(){const e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new ti),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let i=0;i<t;i++)this.getMatrixAt(i,Mn),$n.copy(e.boundingSphere).applyMatrix4(Mn),this.boundingSphere.union($n)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){return this.instanceColor===null?t.setRGB(1,1,1):t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){return t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){const i=t.morphTargetInfluences,s=this.morphTexture.source.data.data,r=i.length+1,a=e*r+1;for(let o=0;o<i.length;o++)i[o]=s[a+o]}raycast(e,t){const i=this.matrixWorld,s=this.count;if(Xn.geometry=this.geometry,Xn.material=this.material,Xn.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),$n.copy(this.boundingSphere),$n.applyMatrix4(i),e.ray.intersectsSphere($n)!==!1))for(let r=0;r<s;r++){this.getMatrixAt(r,Mn),Yo.multiplyMatrices(i,Mn),Xn.matrixWorld=Yo,Xn.raycast(e,Rs);for(let a=0,o=Rs.length;a<o;a++){const l=Rs[a];l.instanceId=r,l.object=this,t.push(l)}Rs.length=0}}setColorAt(e,t){return this.instanceColor===null&&(this.instanceColor=new Ai(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3),this}setMatrixAt(e,t){return t.toArray(this.instanceMatrix.array,e*16),this}setMorphAt(e,t){const i=t.morphTargetInfluences,s=i.length+1;this.morphTexture===null&&(this.morphTexture=new jl(new Float32Array(s*this.count),s,this.count,Qa,ai));const r=this.morphTexture.source.data.data;let a=0;for(let c=0;c<i.length;c++)a+=i[c];const o=this.geometry.morphTargetsRelative?1:1-a,l=s*e;return r[l]=o,r.set(i,l+1),this}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}}const Lr=new C,Uu=new C,Fu=new Ue;class wi{constructor(e=new C(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,i,s){return this.normal.set(e,t,i),this.constant=s,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,i){const s=Lr.subVectors(i,t).cross(Uu.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(s,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){const e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,i=!0){const s=e.delta(Lr),r=this.normal.dot(s);if(r===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;const a=-(e.start.dot(this.normal)+this.constant)/r;return i===!0&&(a<0||a>1)?null:t.copy(e.start).addScaledVector(s,a)}intersectsLine(e){const t=this.distanceToPoint(e.start),i=this.distanceToPoint(e.end);return t<0&&i>0||i<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){const i=t||Fu.getNormalMatrix(e),s=this.coplanarPoint(Lr).applyMatrix4(e),r=this.normal.applyMatrix3(i).normalize();return this.constant=-s.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}}const Ji=new ti,Nu=new Re(.5,.5),Ps=new C;class lo{constructor(e=new wi,t=new wi,i=new wi,s=new wi,r=new wi,a=new wi){this.planes=[e,t,i,s,r,a]}set(e,t,i,s,r,a){const o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(i),o[3].copy(s),o[4].copy(r),o[5].copy(a),this}copy(e){const t=this.planes;for(let i=0;i<6;i++)t[i].copy(e.planes[i]);return this}setFromProjectionMatrix(e,t=pi,i=!1){const s=this.planes,r=e.elements,a=r[0],o=r[1],l=r[2],c=r[3],d=r[4],f=r[5],u=r[6],m=r[7],g=r[8],S=r[9],p=r[10],h=r[11],x=r[12],E=r[13],M=r[14],b=r[15];if(s[0].setComponents(c-a,m-d,h-g,b-x).normalize(),s[1].setComponents(c+a,m+d,h+g,b+x).normalize(),s[2].setComponents(c+o,m+f,h+S,b+E).normalize(),s[3].setComponents(c-o,m-f,h-S,b-E).normalize(),i)s[4].setComponents(l,u,p,M).normalize(),s[5].setComponents(c-l,m-u,h-p,b-M).normalize();else if(s[4].setComponents(c-l,m-u,h-p,b-M).normalize(),t===pi)s[5].setComponents(c+l,m+u,h+p,b+M).normalize();else if(t===rs)s[5].setComponents(l,u,p,M).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),Ji.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{const t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),Ji.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Ji)}intersectsSprite(e){Ji.center.set(0,0,0);const t=Nu.distanceTo(e.center);return Ji.radius=.7071067811865476+t,Ji.applyMatrix4(e.matrixWorld),this.intersectsSphere(Ji)}intersectsSphere(e){const t=this.planes,i=e.center,s=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(i)<s)return!1;return!0}intersectsBox(e){const t=this.planes;for(let i=0;i<6;i++){const s=t[i];if(Ps.x=s.normal.x>0?e.max.x:e.min.x,Ps.y=s.normal.y>0?e.max.y:e.min.y,Ps.z=s.normal.z>0?e.max.z:e.min.z,s.distanceToPoint(Ps)<0)return!1}return!0}containsPoint(e){const t=this.planes;for(let i=0;i<6;i++)if(t[i].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class Ou extends Nn{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new te(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}const Zo=new Je,Ua=new oo,Ds=new ti,Ls=new C;class Bu extends yt{constructor(e=new Tt,t=new Ou){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}raycast(e,t){const i=this.geometry,s=this.matrixWorld,r=e.params.Points.threshold,a=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),Ds.copy(i.boundingSphere),Ds.applyMatrix4(s),Ds.radius+=r,e.ray.intersectsSphere(Ds)===!1)return;Zo.copy(s).invert(),Ua.copy(e.ray).applyMatrix4(Zo);const o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=i.index,f=i.attributes.position;if(c!==null){const u=Math.max(0,a.start),m=Math.min(c.count,a.start+a.count);for(let g=u,S=m;g<S;g++){const p=c.getX(g);Ls.fromBufferAttribute(f,p),Jo(Ls,p,l,s,e,t,this)}}else{const u=Math.max(0,a.start),m=Math.min(f.count,a.start+a.count);for(let g=u,S=m;g<S;g++)Ls.fromBufferAttribute(f,g),Jo(Ls,g,l,s,e,t,this)}}updateMorphTargets(){const t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){const s=t[i[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){const o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}}function Jo(n,e,t,i,s,r,a){const o=Ua.distanceSqToPoint(n);if(o<t){const l=new C;Ua.closestPointToPoint(n,l),l.applyMatrix4(i);const c=s.ray.origin.distanceTo(l);if(c<s.near||c>s.far)return;r.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:e,face:null,faceIndex:null,barycoord:null,object:a})}}class ec extends kt{constructor(e=[],t=nn,i,s,r,a,o,l,c,d){super(e,t,i,s,r,a,o,l,c,d),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class In extends kt{constructor(e,t,i=xi,s,r,a,o=Pt,l=Pt,c,d=Ri,f=1){if(d!==Ri&&d!==tn)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");const u={width:e,height:t,depth:f};super(u,s,r,a,o,l,d,i,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new so(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){const t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}}class zu extends In{constructor(e,t=xi,i=nn,s,r,a=Pt,o=Pt,l,c=Ri){const d={width:e,height:e,depth:1},f=[d,d,d,d,d,d];super(e,e,t,i,s,r,a,o,l,c),this.image=f,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}}class tc extends kt{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}}class Xi extends Tt{constructor(e=1,t=1,i=1,s=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:i,widthSegments:s,heightSegments:r,depthSegments:a};const o=this;s=Math.floor(s),r=Math.floor(r),a=Math.floor(a);const l=[],c=[],d=[],f=[];let u=0,m=0;g("z","y","x",-1,-1,i,t,e,a,r,0),g("z","y","x",1,-1,i,t,-e,a,r,1),g("x","z","y",1,1,e,i,t,s,a,2),g("x","z","y",1,-1,e,i,-t,s,a,3),g("x","y","z",1,-1,e,t,i,s,r,4),g("x","y","z",-1,-1,e,t,-i,s,r,5),this.setIndex(l),this.setAttribute("position",new mt(c,3)),this.setAttribute("normal",new mt(d,3)),this.setAttribute("uv",new mt(f,2));function g(S,p,h,x,E,M,b,T,R,_,w){const P=M/R,D=b/_,F=M/2,W=b/2,Z=T/2,O=R+1,$=_+1;let k=0,J=0;const ee=new C;for(let ae=0;ae<$;ae++){const ie=ae*D-W;for(let ve=0;ve<O;ve++){const Ae=ve*P-F;ee[S]=Ae*x,ee[p]=ie*E,ee[h]=Z,c.push(ee.x,ee.y,ee.z),ee[S]=0,ee[p]=0,ee[h]=T>0?1:-1,d.push(ee.x,ee.y,ee.z),f.push(ve/R),f.push(1-ae/_),k+=1}}for(let ae=0;ae<_;ae++)for(let ie=0;ie<R;ie++){const ve=u+ie+O*ae,Ae=u+ie+O*(ae+1),Qe=u+(ie+1)+O*(ae+1),We=u+(ie+1)+O*ae;l.push(ve,Ae,We),l.push(Ae,Qe,We),J+=6}o.addGroup(m,J,w),m+=J,u+=k}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Xi(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}class co extends Tt{constructor(e=1,t=1,i=4,s=8,r=1){super(),this.type="CapsuleGeometry",this.parameters={radius:e,height:t,capSegments:i,radialSegments:s,heightSegments:r},t=Math.max(0,t),i=Math.max(1,Math.floor(i)),s=Math.max(3,Math.floor(s)),r=Math.max(1,Math.floor(r));const a=[],o=[],l=[],c=[],d=t/2,f=Math.PI/2*e,u=t,m=2*f+u,g=i*2+r,S=s+1,p=new C,h=new C;for(let x=0;x<=g;x++){let E=0,M=0,b=0,T=0;if(x<=i){const w=x/i,P=w*Math.PI/2;M=-d-e*Math.cos(P),b=e*Math.sin(P),T=-e*Math.cos(P),E=w*f}else if(x<=i+r){const w=(x-i)/r;M=-d+w*t,b=e,T=0,E=f+w*u}else{const w=(x-i-r)/i,P=w*Math.PI/2;M=d+e*Math.sin(P),b=e*Math.cos(P),T=e*Math.sin(P),E=f+u+w*f}const R=Math.max(0,Math.min(1,E/m));let _=0;x===0?_=.5/s:x===g&&(_=-.5/s);for(let w=0;w<=s;w++){const P=w/s,D=P*Math.PI*2,F=Math.sin(D),W=Math.cos(D);h.x=-b*W,h.y=M,h.z=b*F,o.push(h.x,h.y,h.z),p.set(-b*W,T,b*F),p.normalize(),l.push(p.x,p.y,p.z),c.push(P+_,R)}if(x>0){const w=(x-1)*S;for(let P=0;P<s;P++){const D=w+P,F=w+P+1,W=x*S+P,Z=x*S+P+1;a.push(D,F,W),a.push(F,Z,W)}}}this.setIndex(a),this.setAttribute("position",new mt(o,3)),this.setAttribute("normal",new mt(l,3)),this.setAttribute("uv",new mt(c,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new co(e.radius,e.height,e.capSegments,e.radialSegments,e.heightSegments)}}class uo extends Tt{constructor(e=[],t=[],i=1,s=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:e,indices:t,radius:i,detail:s};const r=[],a=[];o(s),c(i),d(),this.setAttribute("position",new mt(r,3)),this.setAttribute("normal",new mt(r.slice(),3)),this.setAttribute("uv",new mt(a,2)),s===0?this.computeVertexNormals():this.normalizeNormals();function o(x){const E=new C,M=new C,b=new C;for(let T=0;T<t.length;T+=3)m(t[T+0],E),m(t[T+1],M),m(t[T+2],b),l(E,M,b,x)}function l(x,E,M,b){const T=b+1,R=[];for(let _=0;_<=T;_++){R[_]=[];const w=x.clone().lerp(M,_/T),P=E.clone().lerp(M,_/T),D=T-_;for(let F=0;F<=D;F++)F===0&&_===T?R[_][F]=w:R[_][F]=w.clone().lerp(P,F/D)}for(let _=0;_<T;_++)for(let w=0;w<2*(T-_)-1;w++){const P=Math.floor(w/2);w%2===0?(u(R[_][P+1]),u(R[_+1][P]),u(R[_][P])):(u(R[_][P+1]),u(R[_+1][P+1]),u(R[_+1][P]))}}function c(x){const E=new C;for(let M=0;M<r.length;M+=3)E.x=r[M+0],E.y=r[M+1],E.z=r[M+2],E.normalize().multiplyScalar(x),r[M+0]=E.x,r[M+1]=E.y,r[M+2]=E.z}function d(){const x=new C;for(let E=0;E<r.length;E+=3){x.x=r[E+0],x.y=r[E+1],x.z=r[E+2];const M=p(x)/2/Math.PI+.5,b=h(x)/Math.PI+.5;a.push(M,1-b)}g(),f()}function f(){for(let x=0;x<a.length;x+=6){const E=a[x+0],M=a[x+2],b=a[x+4],T=Math.max(E,M,b),R=Math.min(E,M,b);T>.9&&R<.1&&(E<.2&&(a[x+0]+=1),M<.2&&(a[x+2]+=1),b<.2&&(a[x+4]+=1))}}function u(x){r.push(x.x,x.y,x.z)}function m(x,E){const M=x*3;E.x=e[M+0],E.y=e[M+1],E.z=e[M+2]}function g(){const x=new C,E=new C,M=new C,b=new C,T=new Re,R=new Re,_=new Re;for(let w=0,P=0;w<r.length;w+=9,P+=6){x.set(r[w+0],r[w+1],r[w+2]),E.set(r[w+3],r[w+4],r[w+5]),M.set(r[w+6],r[w+7],r[w+8]),T.set(a[P+0],a[P+1]),R.set(a[P+2],a[P+3]),_.set(a[P+4],a[P+5]),b.copy(x).add(E).add(M).divideScalar(3);const D=p(b);S(T,P+0,x,D),S(R,P+2,E,D),S(_,P+4,M,D)}}function S(x,E,M,b){b<0&&x.x===1&&(a[E]=x.x-1),M.x===0&&M.z===0&&(a[E]=b/2/Math.PI+.5)}function p(x){return Math.atan2(x.z,-x.x)}function h(x){return Math.atan2(-x.y,Math.sqrt(x.x*x.x+x.z*x.z))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new uo(e.vertices,e.indices,e.radius,e.detail)}}class $i extends uo{constructor(e=1,t=0){const i=(1+Math.sqrt(5))/2,s=[-1,i,0,1,i,0,-1,-i,0,1,-i,0,0,-1,i,0,1,i,0,-1,-i,0,1,-i,i,0,-1,i,0,1,-i,0,-1,-i,0,1],r=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];super(s,r,e,t),this.type="IcosahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new $i(e.radius,e.detail)}}class Di extends Tt{constructor(e=1,t=1,i=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:i,heightSegments:s};const r=e/2,a=t/2,o=Math.floor(i),l=Math.floor(s),c=o+1,d=l+1,f=e/o,u=t/l,m=[],g=[],S=[],p=[];for(let h=0;h<d;h++){const x=h*u-a;for(let E=0;E<c;E++){const M=E*f-r;g.push(M,-x,0),S.push(0,0,1),p.push(E/o),p.push(1-h/l)}}for(let h=0;h<l;h++)for(let x=0;x<o;x++){const E=x+c*h,M=x+c*(h+1),b=x+1+c*(h+1),T=x+1+c*h;m.push(E,M,T),m.push(M,b,T)}this.setIndex(m),this.setAttribute("position",new mt(g,3)),this.setAttribute("normal",new mt(S,3)),this.setAttribute("uv",new mt(p,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Di(e.width,e.height,e.widthSegments,e.heightSegments)}}class ho extends Tt{constructor(e=1,t=32,i=16,s=0,r=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:i,phiStart:s,phiLength:r,thetaStart:a,thetaLength:o},t=Math.max(3,Math.floor(t)),i=Math.max(2,Math.floor(i));const l=Math.min(a+o,Math.PI);let c=0;const d=[],f=new C,u=new C,m=[],g=[],S=[],p=[];for(let h=0;h<=i;h++){const x=[],E=h/i,M=a+E*o,b=e*Math.cos(M),T=Math.sqrt(e*e-b*b);let R=0;h===0&&a===0?R=.5/t:h===i&&l===Math.PI&&(R=-.5/t);for(let _=0;_<=t;_++){const w=_/t,P=s+w*r;f.x=-T*Math.cos(P),f.y=b,f.z=T*Math.sin(P),g.push(f.x,f.y,f.z),u.copy(f).normalize(),S.push(u.x,u.y,u.z),p.push(w+R,1-E),x.push(c++)}d.push(x)}for(let h=0;h<i;h++)for(let x=0;x<t;x++){const E=d[h][x+1],M=d[h][x],b=d[h+1][x],T=d[h+1][x+1];(h!==0||a>0)&&m.push(E,M,T),(h!==i-1||l<Math.PI)&&m.push(M,b,T)}this.setIndex(m),this.setAttribute("position",new mt(g,3)),this.setAttribute("normal",new mt(S,3)),this.setAttribute("uv",new mt(p,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new ho(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}}function Un(n){const e={};for(const t in n){e[t]={};for(const i in n[t]){const s=n[t][i];if(Qo(s))s.isRenderTargetTexture?(Ie("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][i]=null):e[t][i]=s.clone();else if(Array.isArray(s))if(Qo(s[0])){const r=[];for(let a=0,o=s.length;a<o;a++)r[a]=s[a].clone();e[t][i]=r}else e[t][i]=s.slice();else e[t][i]=s}}return e}function Bt(n){const e={};for(let t=0;t<n.length;t++){const i=Un(n[t]);for(const s in i)e[s]=i[s]}return e}function Qo(n){return n&&(n.isColor||n.isMatrix3||n.isMatrix4||n.isVector2||n.isVector3||n.isVector4||n.isTexture||n.isQuaternion)}function ku(n){const e=[];for(let t=0;t<n.length;t++)e.push(n[t].clone());return e}function ic(n){const e=n.getRenderTarget();return e===null?n.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:Ve.workingColorSpace}const as={clone:Un,merge:Bt};var Vu=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Gu=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class st extends Nn{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Vu,this.fragmentShader=Gu,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Un(e.uniforms),this.uniformsGroups=ku(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){const t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(const s in this.uniforms){const a=this.uniforms[s].value;a&&a.isTexture?t.uniforms[s]={type:"t",value:a.toJSON(e).uuid}:a&&a.isColor?t.uniforms[s]={type:"c",value:a.getHex()}:a&&a.isVector2?t.uniforms[s]={type:"v2",value:a.toArray()}:a&&a.isVector3?t.uniforms[s]={type:"v3",value:a.toArray()}:a&&a.isVector4?t.uniforms[s]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?t.uniforms[s]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?t.uniforms[s]={type:"m4",value:a.toArray()}:t.uniforms[s]={value:a}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;const i={};for(const s in this.extensions)this.extensions[s]===!0&&(i[s]=!0);return Object.keys(i).length>0&&(t.extensions=i),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(const i in e.uniforms){const s=e.uniforms[i];switch(this.uniforms[i]={},s.type){case"t":this.uniforms[i].value=t[s.value]||null;break;case"c":this.uniforms[i].value=new te().setHex(s.value);break;case"v2":this.uniforms[i].value=new Re().fromArray(s.value);break;case"v3":this.uniforms[i].value=new C().fromArray(s.value);break;case"v4":this.uniforms[i].value=new ot().fromArray(s.value);break;case"m3":this.uniforms[i].value=new Ue().fromArray(s.value);break;case"m4":this.uniforms[i].value=new Je().fromArray(s.value);break;default:this.uniforms[i].value=s.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(const i in e.extensions)this.extensions[i]=e.extensions[i];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}}class nc extends st{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}}class cs extends Nn{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new te(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new te(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=La,this.normalScale=new Re(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Pi,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class Hu extends cs{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new Re(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return Ge(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new te(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new te(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new te(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}}class Wu extends Nn{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=tu,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class Xu extends Nn{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}class js extends yt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new te(e),this.intensity=t}dispose(){this.dispatchEvent({type:"dispose"})}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){const t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}}class $u extends js{constructor(e,t,i){super(e,i),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(yt.DEFAULT_UP),this.updateMatrix(),this.groundColor=new te(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}toJSON(e){const t=super.toJSON(e);return t.object.groundColor=this.groundColor.getHex(),t}}const Ir=new Je,jo=new C,el=new C;class sc{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new Re(512,512),this.mapType=Zt,this.map=null,this.mapPass=null,this.matrix=new Je,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new lo,this._frameExtents=new Re(1,1),this._viewportCount=1,this._viewports=[new ot(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){const t=this.camera,i=this.matrix;jo.setFromMatrixPosition(e.matrixWorld),t.position.copy(jo),el.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(el),t.updateMatrixWorld(),Ir.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Ir,t.coordinateSystem,t.reversedDepth),t.coordinateSystem===rs||t.reversedDepth?i.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):i.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),i.multiply(Ir)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){const e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}}const Is=new C,Us=new an,hi=new C;class rc extends yt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Je,this.projectionMatrix=new Je,this.projectionMatrixInverse=new Je,this.coordinateSystem=pi,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(Is,Us,hi),hi.x===1&&hi.y===1&&hi.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Is,Us,hi.set(1,1,1)).invert()}updateWorldMatrix(e,t,i=!1){super.updateWorldMatrix(e,t,i),this.matrixWorld.decompose(Is,Us,hi),hi.x===1&&hi.y===1&&hi.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Is,Us,hi.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}}const ki=new C,tl=new Re,il=new Re;class Kt extends rc{constructor(e=50,t=1,i=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=i,this.far=s,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){const t=.5*this.getFilmHeight()/e;this.fov=Ia*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){const e=Math.tan(cr*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Ia*2*Math.atan(Math.tan(cr*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,i){ki.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(ki.x,ki.y).multiplyScalar(-e/ki.z),ki.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(ki.x,ki.y).multiplyScalar(-e/ki.z)}getViewSize(e,t){return this.getViewBounds(e,tl,il),t.subVectors(il,tl)}setViewOffset(e,t,i,s,r,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=this.near;let t=e*Math.tan(cr*.5*this.fov)/this.zoom,i=2*t,s=this.aspect*i,r=-.5*s;const a=this.view;if(this.view!==null&&this.view.enabled){const l=a.fullWidth,c=a.fullHeight;r+=a.offsetX*s/l,t-=a.offsetY*i/c,s*=a.width/l,i*=a.height/c}const o=this.filmOffset;o!==0&&(r+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,t,t-i,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}class qu extends sc{constructor(){super(new Kt(90,1,.5,500)),this.isPointLightShadow=!0}}class Yu extends js{constructor(e,t,i=0,s=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=i,this.decay=s,this.shadow=new qu}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}toJSON(e){const t=super.toJSON(e);return t.object.distance=this.distance,t.object.decay=this.decay,t.object.shadow=this.shadow.toJSON(),t}}class er extends rc{constructor(e=-1,t=1,i=1,s=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=i,this.bottom=s,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,i,s,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,s=(this.top+this.bottom)/2;let r=i-e,a=i+e,o=s+t,l=s-t;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,d=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,a=r+c*this.view.width,o-=d*this.view.offsetY,l=o-d*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}}class Ku extends sc{constructor(){super(new er(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class nl extends js{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(yt.DEFAULT_UP),this.updateMatrix(),this.target=new yt,this.shadow=new Ku}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){const t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}}class Zu extends js{constructor(e,t){super(e,t),this.isAmbientLight=!0,this.type="AmbientLight"}}class fo extends Tt{constructor(){super(),this.isInstancedBufferGeometry=!0,this.type="InstancedBufferGeometry",this.instanceCount=1/0}copy(e){return super.copy(e),this.instanceCount=e.instanceCount,this}toJSON(){const e=super.toJSON();return e.instanceCount=this.instanceCount,e.isInstancedBufferGeometry=!0,e}}const yn=-90,bn=1;class Ju extends yt{constructor(e,t,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;const s=new Kt(yn,bn,e,t);s.layers=this.layers,this.add(s);const r=new Kt(yn,bn,e,t);r.layers=this.layers,this.add(r);const a=new Kt(yn,bn,e,t);a.layers=this.layers,this.add(a);const o=new Kt(yn,bn,e,t);o.layers=this.layers,this.add(o);const l=new Kt(yn,bn,e,t);l.layers=this.layers,this.add(l);const c=new Kt(yn,bn,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const e=this.coordinateSystem,t=this.children.concat(),[i,s,r,a,o,l]=t;for(const c of t)this.remove(c);if(e===pi)i.up.set(0,1,0),i.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===rs)i.up.set(0,-1,0),i.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(const c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();const{renderTarget:i,activeMipmapLevel:s}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());const[r,a,o,l,c,d]=this.children,f=e.getRenderTarget(),u=e.getActiveCubeFace(),m=e.getActiveMipmapLevel(),g=e.xr.enabled;e.xr.enabled=!1;const S=i.texture.generateMipmaps;i.texture.generateMipmaps=!1;let p=!1;e.isWebGLRenderer===!0?p=e.state.buffers.depth.getReversed():p=e.reversedDepthBuffer,e.setRenderTarget(i,0,s),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,r),e.setRenderTarget(i,1,s),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(i,2,s),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(i,3,s),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(i,4,s),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),i.texture.generateMipmaps=S,e.setRenderTarget(i,5,s),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,d),e.setRenderTarget(f,u,m),e.xr.enabled=g,i.texture.needsPMREMUpdate=!0}}class Qu extends Kt{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}}class ju{constructor(){this._previousTime=0,this._currentTime=0,this._startTime=performance.now(),this._delta=0,this._elapsed=0,this._timescale=1,this._document=null,this._pageVisibilityHandler=null}connect(e){this._document=e,e.hidden!==void 0&&(this._pageVisibilityHandler=eh.bind(this),e.addEventListener("visibilitychange",this._pageVisibilityHandler,!1))}disconnect(){this._pageVisibilityHandler!==null&&(this._document.removeEventListener("visibilitychange",this._pageVisibilityHandler),this._pageVisibilityHandler=null),this._document=null}getDelta(){return this._delta/1e3}getElapsed(){return this._elapsed/1e3}getTimescale(){return this._timescale}setTimescale(e){return this._timescale=e,this}reset(){return this._currentTime=performance.now()-this._startTime,this}dispose(){this.disconnect()}update(e){return this._pageVisibilityHandler!==null&&this._document.hidden===!0?this._delta=0:(this._previousTime=this._currentTime,this._currentTime=(e!==void 0?e:performance.now())-this._startTime,this._delta=(this._currentTime-this._previousTime)*this._timescale,this._elapsed+=this._delta),this}}function eh(){this._document.hidden===!1&&this.reset()}const sl=new Je;class th{constructor(e,t,i=0,s=1/0){this.ray=new oo(e,t),this.near=i,this.far=s,this.camera=null,this.layers=new ro,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,t.projectionMatrix.elements[14]).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):Xe("Raycaster: Unsupported camera type: "+t.type)}setFromXRController(e){return sl.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(sl),this}intersectObject(e,t=!0,i=[]){return Fa(e,this,i,t),i.sort(rl),i}intersectObjects(e,t=!0,i=[]){for(let s=0,r=e.length;s<r;s++)Fa(e[s],this,i,t);return i.sort(rl),i}}function rl(n,e){return n.distance-e.distance}function Fa(n,e,t,i){let s=!0;if(n.layers.test(e.layers)&&n.raycast(e,t)===!1&&(s=!1),s===!0&&i===!0){const r=n.children;for(let a=0,o=r.length;a<o;a++)Fa(r[a],e,t,!0)}}class ac{static{ac.prototype.isMatrix2=!0}constructor(e,t,i,s){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,i,s)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let i=0;i<4;i++)this.elements[i]=e[i+t];return this}set(e,t,i,s){const r=this.elements;return r[0]=e,r[2]=t,r[1]=i,r[3]=s,this}}function al(n,e,t,i){const s=ih(i);switch(t){case Xl:return n*e;case Qa:return n*e/s.components*s.byteLength;case ja:return n*e/s.components*s.byteLength;case sn:return n*e*2/s.components*s.byteLength;case eo:return n*e*2/s.components*s.byteLength;case $l:return n*e*3/s.components*s.byteLength;case oi:return n*e*4/s.components*s.byteLength;case to:return n*e*4/s.components*s.byteLength;case zs:case ks:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case Vs:case Gs:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case na:case ra:return Math.max(n,16)*Math.max(e,8)/4;case ia:case sa:return Math.max(n,8)*Math.max(e,8)/2;case aa:case oa:case ca:case ua:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case la:case Xs:case ha:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case da:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case fa:return Math.floor((n+4)/5)*Math.floor((e+3)/4)*16;case pa:return Math.floor((n+4)/5)*Math.floor((e+4)/5)*16;case ma:return Math.floor((n+5)/6)*Math.floor((e+4)/5)*16;case ga:return Math.floor((n+5)/6)*Math.floor((e+5)/6)*16;case va:return Math.floor((n+7)/8)*Math.floor((e+4)/5)*16;case _a:return Math.floor((n+7)/8)*Math.floor((e+5)/6)*16;case xa:return Math.floor((n+7)/8)*Math.floor((e+7)/8)*16;case Sa:return Math.floor((n+9)/10)*Math.floor((e+4)/5)*16;case Ma:return Math.floor((n+9)/10)*Math.floor((e+5)/6)*16;case ya:return Math.floor((n+9)/10)*Math.floor((e+7)/8)*16;case ba:return Math.floor((n+9)/10)*Math.floor((e+9)/10)*16;case Ea:return Math.floor((n+11)/12)*Math.floor((e+9)/10)*16;case wa:return Math.floor((n+11)/12)*Math.floor((e+11)/12)*16;case Ta:case Aa:case Ca:return Math.ceil(n/4)*Math.ceil(e/4)*16;case Ra:case Pa:return Math.ceil(n/4)*Math.ceil(e/4)*8;case $s:case Da:return Math.ceil(n/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function ih(n){switch(n){case Zt:case Vl:return{byteLength:1,components:1};case ns:case Gl:case Jt:return{byteLength:2,components:1};case Za:case Ja:return{byteLength:2,components:4};case xi:case Ka:case ai:return{byteLength:4,components:1};case Hl:case Wl:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${n}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Ga}}));typeof window<"u"&&(window.__THREE__?Ie("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Ga);function oc(){let n=null,e=!1,t=null,i=null;function s(r,a){t(r,a),i=n.requestAnimationFrame(s)}return{start:function(){e!==!0&&t!==null&&n!==null&&(i=n.requestAnimationFrame(s),e=!0)},stop:function(){n!==null&&n.cancelAnimationFrame(i),e=!1},setAnimationLoop:function(r){t=r},setContext:function(r){n=r}}}function nh(n){const e=new WeakMap;function t(o,l){const c=o.array,d=o.usage,f=c.byteLength,u=n.createBuffer();n.bindBuffer(l,u),n.bufferData(l,c,d),o.onUploadCallback();let m;if(c instanceof Float32Array)m=n.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)m=n.HALF_FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?m=n.HALF_FLOAT:m=n.UNSIGNED_SHORT;else if(c instanceof Int16Array)m=n.SHORT;else if(c instanceof Uint32Array)m=n.UNSIGNED_INT;else if(c instanceof Int32Array)m=n.INT;else if(c instanceof Int8Array)m=n.BYTE;else if(c instanceof Uint8Array)m=n.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)m=n.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:u,type:m,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:f}}function i(o,l,c){const d=l.array,f=l.updateRanges;if(n.bindBuffer(c,o),f.length===0)n.bufferSubData(c,0,d);else{f.sort((m,g)=>m.start-g.start);let u=0;for(let m=1;m<f.length;m++){const g=f[u],S=f[m];S.start<=g.start+g.count+1?g.count=Math.max(g.count,S.start+S.count-g.start):(++u,f[u]=S)}f.length=u+1;for(let m=0,g=f.length;m<g;m++){const S=f[m];n.bufferSubData(c,S.start*d.BYTES_PER_ELEMENT,d,S.start,S.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(o){return o.isInterleavedBufferAttribute&&(o=o.data),e.get(o)}function r(o){o.isInterleavedBufferAttribute&&(o=o.data);const l=e.get(o);l&&(n.deleteBuffer(l.buffer),e.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){const d=e.get(o);(!d||d.version<o.version)&&e.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}const c=e.get(o);if(c===void 0)e.set(o,t(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(c.buffer,o,l),c.version=o.version}}return{get:s,remove:r,update:a}}var sh=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,rh=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,ah=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,oh=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,lh=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,ch=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,uh=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,hh=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,dh=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,fh=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,ph=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,mh=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,gh=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,vh=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,_h=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,xh=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Sh=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Mh=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,yh=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,bh=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Eh=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,wh=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Th=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,Ah=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Ch=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Rh=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,Ph=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Dh=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Lh=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Ih=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Uh="gl_FragColor = linearToOutputTexel( gl_FragColor );",Fh=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Nh=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,Oh=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,Bh=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,zh=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,kh=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,Vh=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Gh=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Hh=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Wh=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Xh=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,$h=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,qh=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Yh=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Kh=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,Zh=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,Jh=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Qh=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,jh=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,ed=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,td=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,id=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
		vec3 iridescenceFresnelDielectric;
		vec3 iridescenceFresnelMetallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
vec3 BRDF_GGX_Multiscatter( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 dfgV = texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg;
	vec2 dfgL = texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg;
	vec3 FssEss_V = material.specularColorBlended * dfgV.x + material.specularF90 * dfgV.y;
	vec3 FssEss_L = material.specularColorBlended * dfgL.x + material.specularF90 * dfgL.y;
	float Ess_V = dfgV.x + dfgV.y;
	float Ess_L = dfgL.x + dfgL.y;
	float Ems_V = 1.0 - Ess_V;
	float Ems_L = 1.0 - Ess_L;
	vec3 Favg = material.specularColorBlended + ( 1.0 - material.specularColorBlended ) * 0.047619;
	vec3 Fms = FssEss_V * FssEss_L * Favg / ( 1.0 - Ems_V * Ems_L * Favg + EPSILON );
	float compensationFactor = Ems_V * Ems_L;
	vec3 multiScatter = Fms * compensationFactor;
	return singleScatter + multiScatter;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnelDielectric, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceFresnelMetallic, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,nd=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,sd=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,rd=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,ad=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,od=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,ld=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,cd=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,ud=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,hd=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,dd=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,fd=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,pd=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,md=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,gd=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,vd=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,_d=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,xd=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Sd=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,Md=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,yd=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,bd=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Ed=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,wd=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Td=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,Ad=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Cd=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Rd=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Pd=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Dd=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Ld=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Id=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,Ud=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Fd=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Nd=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Od=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Bd=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,zd=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,kd=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,Vd=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Gd=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,Hd=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,Wd=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Xd=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,$d=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,qd=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,Yd=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Kd=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Zd=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Jd=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,Qd=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,jd=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,ef=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,tf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,nf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,sf=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const rf=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,af=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,of=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,lf=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,cf=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,uf=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,hf=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,df=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,ff=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,pf=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,mf=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,gf=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,vf=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,_f=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,xf=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,Sf=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Mf=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,yf=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,bf=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Ef=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,wf=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,Tf=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Af=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Cf=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Rf=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Pf=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Df=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Lf=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,If=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,Uf=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Ff=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Nf=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Of=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Bf=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Be={alphahash_fragment:sh,alphahash_pars_fragment:rh,alphamap_fragment:ah,alphamap_pars_fragment:oh,alphatest_fragment:lh,alphatest_pars_fragment:ch,aomap_fragment:uh,aomap_pars_fragment:hh,batching_pars_vertex:dh,batching_vertex:fh,begin_vertex:ph,beginnormal_vertex:mh,bsdfs:gh,iridescence_fragment:vh,bumpmap_pars_fragment:_h,clipping_planes_fragment:xh,clipping_planes_pars_fragment:Sh,clipping_planes_pars_vertex:Mh,clipping_planes_vertex:yh,color_fragment:bh,color_pars_fragment:Eh,color_pars_vertex:wh,color_vertex:Th,common:Ah,cube_uv_reflection_fragment:Ch,defaultnormal_vertex:Rh,displacementmap_pars_vertex:Ph,displacementmap_vertex:Dh,emissivemap_fragment:Lh,emissivemap_pars_fragment:Ih,colorspace_fragment:Uh,colorspace_pars_fragment:Fh,envmap_fragment:Nh,envmap_common_pars_fragment:Oh,envmap_pars_fragment:Bh,envmap_pars_vertex:zh,envmap_physical_pars_fragment:Zh,envmap_vertex:kh,fog_vertex:Vh,fog_pars_vertex:Gh,fog_fragment:Hh,fog_pars_fragment:Wh,gradientmap_pars_fragment:Xh,lightmap_pars_fragment:$h,lights_lambert_fragment:qh,lights_lambert_pars_fragment:Yh,lights_pars_begin:Kh,lights_toon_fragment:Jh,lights_toon_pars_fragment:Qh,lights_phong_fragment:jh,lights_phong_pars_fragment:ed,lights_physical_fragment:td,lights_physical_pars_fragment:id,lights_fragment_begin:nd,lights_fragment_maps:sd,lights_fragment_end:rd,lightprobes_pars_fragment:ad,logdepthbuf_fragment:od,logdepthbuf_pars_fragment:ld,logdepthbuf_pars_vertex:cd,logdepthbuf_vertex:ud,map_fragment:hd,map_pars_fragment:dd,map_particle_fragment:fd,map_particle_pars_fragment:pd,metalnessmap_fragment:md,metalnessmap_pars_fragment:gd,morphinstance_vertex:vd,morphcolor_vertex:_d,morphnormal_vertex:xd,morphtarget_pars_vertex:Sd,morphtarget_vertex:Md,normal_fragment_begin:yd,normal_fragment_maps:bd,normal_pars_fragment:Ed,normal_pars_vertex:wd,normal_vertex:Td,normalmap_pars_fragment:Ad,clearcoat_normal_fragment_begin:Cd,clearcoat_normal_fragment_maps:Rd,clearcoat_pars_fragment:Pd,iridescence_pars_fragment:Dd,opaque_fragment:Ld,packing:Id,premultiplied_alpha_fragment:Ud,project_vertex:Fd,dithering_fragment:Nd,dithering_pars_fragment:Od,roughnessmap_fragment:Bd,roughnessmap_pars_fragment:zd,shadowmap_pars_fragment:kd,shadowmap_pars_vertex:Vd,shadowmap_vertex:Gd,shadowmask_pars_fragment:Hd,skinbase_vertex:Wd,skinning_pars_vertex:Xd,skinning_vertex:$d,skinnormal_vertex:qd,specularmap_fragment:Yd,specularmap_pars_fragment:Kd,tonemapping_fragment:Zd,tonemapping_pars_fragment:Jd,transmission_fragment:Qd,transmission_pars_fragment:jd,uv_pars_fragment:ef,uv_pars_vertex:tf,uv_vertex:nf,worldpos_vertex:sf,background_vert:rf,background_frag:af,backgroundCube_vert:of,backgroundCube_frag:lf,cube_vert:cf,cube_frag:uf,depth_vert:hf,depth_frag:df,distance_vert:ff,distance_frag:pf,equirect_vert:mf,equirect_frag:gf,linedashed_vert:vf,linedashed_frag:_f,meshbasic_vert:xf,meshbasic_frag:Sf,meshlambert_vert:Mf,meshlambert_frag:yf,meshmatcap_vert:bf,meshmatcap_frag:Ef,meshnormal_vert:wf,meshnormal_frag:Tf,meshphong_vert:Af,meshphong_frag:Cf,meshphysical_vert:Rf,meshphysical_frag:Pf,meshtoon_vert:Df,meshtoon_frag:Lf,points_vert:If,points_frag:Uf,shadow_vert:Ff,shadow_frag:Nf,sprite_vert:Of,sprite_frag:Bf},de={common:{diffuse:{value:new te(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Ue},alphaMap:{value:null},alphaMapTransform:{value:new Ue},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Ue}},envmap:{envMap:{value:null},envMapRotation:{value:new Ue},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Ue}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Ue}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Ue},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Ue},normalScale:{value:new Re(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Ue},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Ue}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Ue}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Ue}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new te(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new C},probesMax:{value:new C},probesResolution:{value:new C}},points:{diffuse:{value:new te(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Ue},alphaTest:{value:0},uvTransform:{value:new Ue}},sprite:{diffuse:{value:new te(16777215)},opacity:{value:1},center:{value:new Re(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Ue},alphaMap:{value:null},alphaMapTransform:{value:new Ue},alphaTest:{value:0}}},fi={basic:{uniforms:Bt([de.common,de.specularmap,de.envmap,de.aomap,de.lightmap,de.fog]),vertexShader:Be.meshbasic_vert,fragmentShader:Be.meshbasic_frag},lambert:{uniforms:Bt([de.common,de.specularmap,de.envmap,de.aomap,de.lightmap,de.emissivemap,de.bumpmap,de.normalmap,de.displacementmap,de.fog,de.lights,{emissive:{value:new te(0)},envMapIntensity:{value:1}}]),vertexShader:Be.meshlambert_vert,fragmentShader:Be.meshlambert_frag},phong:{uniforms:Bt([de.common,de.specularmap,de.envmap,de.aomap,de.lightmap,de.emissivemap,de.bumpmap,de.normalmap,de.displacementmap,de.fog,de.lights,{emissive:{value:new te(0)},specular:{value:new te(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Be.meshphong_vert,fragmentShader:Be.meshphong_frag},standard:{uniforms:Bt([de.common,de.envmap,de.aomap,de.lightmap,de.emissivemap,de.bumpmap,de.normalmap,de.displacementmap,de.roughnessmap,de.metalnessmap,de.fog,de.lights,{emissive:{value:new te(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Be.meshphysical_vert,fragmentShader:Be.meshphysical_frag},toon:{uniforms:Bt([de.common,de.aomap,de.lightmap,de.emissivemap,de.bumpmap,de.normalmap,de.displacementmap,de.gradientmap,de.fog,de.lights,{emissive:{value:new te(0)}}]),vertexShader:Be.meshtoon_vert,fragmentShader:Be.meshtoon_frag},matcap:{uniforms:Bt([de.common,de.bumpmap,de.normalmap,de.displacementmap,de.fog,{matcap:{value:null}}]),vertexShader:Be.meshmatcap_vert,fragmentShader:Be.meshmatcap_frag},points:{uniforms:Bt([de.points,de.fog]),vertexShader:Be.points_vert,fragmentShader:Be.points_frag},dashed:{uniforms:Bt([de.common,de.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Be.linedashed_vert,fragmentShader:Be.linedashed_frag},depth:{uniforms:Bt([de.common,de.displacementmap]),vertexShader:Be.depth_vert,fragmentShader:Be.depth_frag},normal:{uniforms:Bt([de.common,de.bumpmap,de.normalmap,de.displacementmap,{opacity:{value:1}}]),vertexShader:Be.meshnormal_vert,fragmentShader:Be.meshnormal_frag},sprite:{uniforms:Bt([de.sprite,de.fog]),vertexShader:Be.sprite_vert,fragmentShader:Be.sprite_frag},background:{uniforms:{uvTransform:{value:new Ue},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Be.background_vert,fragmentShader:Be.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Ue}},vertexShader:Be.backgroundCube_vert,fragmentShader:Be.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Be.cube_vert,fragmentShader:Be.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Be.equirect_vert,fragmentShader:Be.equirect_frag},distance:{uniforms:Bt([de.common,de.displacementmap,{referencePosition:{value:new C},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Be.distance_vert,fragmentShader:Be.distance_frag},shadow:{uniforms:Bt([de.lights,de.fog,{color:{value:new te(0)},opacity:{value:1}}]),vertexShader:Be.shadow_vert,fragmentShader:Be.shadow_frag}};fi.physical={uniforms:Bt([fi.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Ue},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Ue},clearcoatNormalScale:{value:new Re(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Ue},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Ue},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Ue},sheen:{value:0},sheenColor:{value:new te(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Ue},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Ue},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Ue},transmissionSamplerSize:{value:new Re},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Ue},attenuationDistance:{value:0},attenuationColor:{value:new te(0)},specularColor:{value:new te(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Ue},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Ue},anisotropyVector:{value:new Re},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Ue}}]),vertexShader:Be.meshphysical_vert,fragmentShader:Be.meshphysical_frag};const Fs={r:0,b:0,g:0},zf=new Je,lc=new Ue;lc.set(-1,0,0,0,1,0,0,0,1);function kf(n,e,t,i,s,r){const a=new te(0);let o=s===!0?0:1,l,c,d=null,f=0,u=null;function m(x){let E=x.isScene===!0?x.background:null;if(E&&E.isTexture){const M=x.backgroundBlurriness>0;E=e.get(E,M)}return E}function g(x){let E=!1;const M=m(x);M===null?p(a,o):M&&M.isColor&&(p(M,1),E=!0);const b=n.xr.getEnvironmentBlendMode();b==="additive"?t.buffers.color.setClear(0,0,0,1,r):b==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,r),(n.autoClear||E)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),n.clear(n.autoClearColor,n.autoClearDepth,n.autoClearStencil))}function S(x,E){const M=m(E);M&&(M.isCubeTexture||M.mapping===Js)?(c===void 0&&(c=new He(new Xi(1,1,1),new st({name:"BackgroundCubeMaterial",uniforms:Un(fi.backgroundCube.uniforms),vertexShader:fi.backgroundCube.vertexShader,fragmentShader:fi.backgroundCube.fragmentShader,side:Ot,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(b,T,R){this.matrixWorld.copyPosition(R.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(c)),c.material.uniforms.envMap.value=M,c.material.uniforms.backgroundBlurriness.value=E.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=E.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(zf.makeRotationFromEuler(E.backgroundRotation)).transpose(),M.isCubeTexture&&M.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(lc),c.material.toneMapped=Ve.getTransfer(M.colorSpace)!==Ze,(d!==M||f!==M.version||u!==n.toneMapping)&&(c.material.needsUpdate=!0,d=M,f=M.version,u=n.toneMapping),c.layers.enableAll(),x.unshift(c,c.geometry,c.material,0,0,null)):M&&M.isTexture&&(l===void 0&&(l=new He(new Di(2,2),new st({name:"BackgroundMaterial",uniforms:Un(fi.background.uniforms),vertexShader:fi.background.vertexShader,fragmentShader:fi.background.fragmentShader,side:_i,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(l)),l.material.uniforms.t2D.value=M,l.material.uniforms.backgroundIntensity.value=E.backgroundIntensity,l.material.toneMapped=Ve.getTransfer(M.colorSpace)!==Ze,M.matrixAutoUpdate===!0&&M.updateMatrix(),l.material.uniforms.uvTransform.value.copy(M.matrix),(d!==M||f!==M.version||u!==n.toneMapping)&&(l.material.needsUpdate=!0,d=M,f=M.version,u=n.toneMapping),l.layers.enableAll(),x.unshift(l,l.geometry,l.material,0,0,null))}function p(x,E){x.getRGB(Fs,ic(n)),t.buffers.color.setClear(Fs.r,Fs.g,Fs.b,E,r)}function h(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return a},setClearColor:function(x,E=1){a.set(x),o=E,p(a,o)},getClearAlpha:function(){return o},setClearAlpha:function(x){o=x,p(a,o)},render:g,addToRenderList:S,dispose:h}}function Vf(n,e){const t=n.getParameter(n.MAX_VERTEX_ATTRIBS),i={},s=u(null);let r=s,a=!1;function o(D,F,W,Z,O){let $=!1;const k=f(D,Z,W,F);r!==k&&(r=k,c(r.object)),$=m(D,Z,W,O),$&&g(D,Z,W,O),O!==null&&e.update(O,n.ELEMENT_ARRAY_BUFFER),($||a)&&(a=!1,M(D,F,W,Z),O!==null&&n.bindBuffer(n.ELEMENT_ARRAY_BUFFER,e.get(O).buffer))}function l(){return n.createVertexArray()}function c(D){return n.bindVertexArray(D)}function d(D){return n.deleteVertexArray(D)}function f(D,F,W,Z){const O=Z.wireframe===!0;let $=i[F.id];$===void 0&&($={},i[F.id]=$);const k=D.isInstancedMesh===!0?D.id:0;let J=$[k];J===void 0&&(J={},$[k]=J);let ee=J[W.id];ee===void 0&&(ee={},J[W.id]=ee);let ae=ee[O];return ae===void 0&&(ae=u(l()),ee[O]=ae),ae}function u(D){const F=[],W=[],Z=[];for(let O=0;O<t;O++)F[O]=0,W[O]=0,Z[O]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:F,enabledAttributes:W,attributeDivisors:Z,object:D,attributes:{},index:null}}function m(D,F,W,Z){const O=r.attributes,$=F.attributes;let k=0;const J=W.getAttributes();for(const ee in J)if(J[ee].location>=0){const ie=O[ee];let ve=$[ee];if(ve===void 0&&(ee==="instanceMatrix"&&D.instanceMatrix&&(ve=D.instanceMatrix),ee==="instanceColor"&&D.instanceColor&&(ve=D.instanceColor)),ie===void 0||ie.attribute!==ve||ve&&ie.data!==ve.data)return!0;k++}return r.attributesNum!==k||r.index!==Z}function g(D,F,W,Z){const O={},$=F.attributes;let k=0;const J=W.getAttributes();for(const ee in J)if(J[ee].location>=0){let ie=$[ee];ie===void 0&&(ee==="instanceMatrix"&&D.instanceMatrix&&(ie=D.instanceMatrix),ee==="instanceColor"&&D.instanceColor&&(ie=D.instanceColor));const ve={};ve.attribute=ie,ie&&ie.data&&(ve.data=ie.data),O[ee]=ve,k++}r.attributes=O,r.attributesNum=k,r.index=Z}function S(){const D=r.newAttributes;for(let F=0,W=D.length;F<W;F++)D[F]=0}function p(D){h(D,0)}function h(D,F){const W=r.newAttributes,Z=r.enabledAttributes,O=r.attributeDivisors;W[D]=1,Z[D]===0&&(n.enableVertexAttribArray(D),Z[D]=1),O[D]!==F&&(n.vertexAttribDivisor(D,F),O[D]=F)}function x(){const D=r.newAttributes,F=r.enabledAttributes;for(let W=0,Z=F.length;W<Z;W++)F[W]!==D[W]&&(n.disableVertexAttribArray(W),F[W]=0)}function E(D,F,W,Z,O,$,k){k===!0?n.vertexAttribIPointer(D,F,W,O,$):n.vertexAttribPointer(D,F,W,Z,O,$)}function M(D,F,W,Z){S();const O=Z.attributes,$=W.getAttributes(),k=F.defaultAttributeValues;for(const J in $){const ee=$[J];if(ee.location>=0){let ae=O[J];if(ae===void 0&&(J==="instanceMatrix"&&D.instanceMatrix&&(ae=D.instanceMatrix),J==="instanceColor"&&D.instanceColor&&(ae=D.instanceColor)),ae!==void 0){const ie=ae.normalized,ve=ae.itemSize,Ae=e.get(ae);if(Ae===void 0)continue;const Qe=Ae.buffer,We=Ae.type,q=Ae.bytesPerElement,se=We===n.INT||We===n.UNSIGNED_INT||ae.gpuType===Ka;if(ae.isInterleavedBufferAttribute){const j=ae.data,Pe=j.stride,Fe=ae.offset;if(j.isInstancedInterleavedBuffer){for(let De=0;De<ee.locationSize;De++)h(ee.location+De,j.meshPerAttribute);D.isInstancedMesh!==!0&&Z._maxInstanceCount===void 0&&(Z._maxInstanceCount=j.meshPerAttribute*j.count)}else for(let De=0;De<ee.locationSize;De++)p(ee.location+De);n.bindBuffer(n.ARRAY_BUFFER,Qe);for(let De=0;De<ee.locationSize;De++)E(ee.location+De,ve/ee.locationSize,We,ie,Pe*q,(Fe+ve/ee.locationSize*De)*q,se)}else{if(ae.isInstancedBufferAttribute){for(let j=0;j<ee.locationSize;j++)h(ee.location+j,ae.meshPerAttribute);D.isInstancedMesh!==!0&&Z._maxInstanceCount===void 0&&(Z._maxInstanceCount=ae.meshPerAttribute*ae.count)}else for(let j=0;j<ee.locationSize;j++)p(ee.location+j);n.bindBuffer(n.ARRAY_BUFFER,Qe);for(let j=0;j<ee.locationSize;j++)E(ee.location+j,ve/ee.locationSize,We,ie,ve*q,ve/ee.locationSize*j*q,se)}}else if(k!==void 0){const ie=k[J];if(ie!==void 0)switch(ie.length){case 2:n.vertexAttrib2fv(ee.location,ie);break;case 3:n.vertexAttrib3fv(ee.location,ie);break;case 4:n.vertexAttrib4fv(ee.location,ie);break;default:n.vertexAttrib1fv(ee.location,ie)}}}}x()}function b(){w();for(const D in i){const F=i[D];for(const W in F){const Z=F[W];for(const O in Z){const $=Z[O];for(const k in $)d($[k].object),delete $[k];delete Z[O]}}delete i[D]}}function T(D){if(i[D.id]===void 0)return;const F=i[D.id];for(const W in F){const Z=F[W];for(const O in Z){const $=Z[O];for(const k in $)d($[k].object),delete $[k];delete Z[O]}}delete i[D.id]}function R(D){for(const F in i){const W=i[F];for(const Z in W){const O=W[Z];if(O[D.id]===void 0)continue;const $=O[D.id];for(const k in $)d($[k].object),delete $[k];delete O[D.id]}}}function _(D){for(const F in i){const W=i[F],Z=D.isInstancedMesh===!0?D.id:0,O=W[Z];if(O!==void 0){for(const $ in O){const k=O[$];for(const J in k)d(k[J].object),delete k[J];delete O[$]}delete W[Z],Object.keys(W).length===0&&delete i[F]}}}function w(){P(),a=!0,r!==s&&(r=s,c(r.object))}function P(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:o,reset:w,resetDefaultState:P,dispose:b,releaseStatesOfGeometry:T,releaseStatesOfObject:_,releaseStatesOfProgram:R,initAttributes:S,enableAttribute:p,disableUnusedAttributes:x}}function Gf(n,e,t){let i;function s(l){i=l}function r(l,c){n.drawArrays(i,l,c),t.update(c,i,1)}function a(l,c,d){d!==0&&(n.drawArraysInstanced(i,l,c,d),t.update(c,i,d))}function o(l,c,d){if(d===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,l,0,c,0,d);let u=0;for(let m=0;m<d;m++)u+=c[m];t.update(u,i,1)}this.setMode=s,this.render=r,this.renderInstances=a,this.renderMultiDraw=o}function Hf(n,e,t,i){let s;function r(){if(s!==void 0)return s;if(e.has("EXT_texture_filter_anisotropic")===!0){const R=e.get("EXT_texture_filter_anisotropic");s=n.getParameter(R.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function a(R){return!(R!==oi&&i.convert(R)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(R){const _=R===Jt&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(R!==Zt&&i.convert(R)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_TYPE)&&R!==ai&&!_)}function l(R){if(R==="highp"){if(n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.HIGH_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.HIGH_FLOAT).precision>0)return"highp";R="mediump"}return R==="mediump"&&n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.MEDIUM_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp";const d=l(c);d!==c&&(Ie("WebGLRenderer:",c,"not supported, using",d,"instead."),c=d);const f=t.logarithmicDepthBuffer===!0,u=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control");t.reversedDepthBuffer===!0&&u===!1&&Ie("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");const m=n.getParameter(n.MAX_TEXTURE_IMAGE_UNITS),g=n.getParameter(n.MAX_VERTEX_TEXTURE_IMAGE_UNITS),S=n.getParameter(n.MAX_TEXTURE_SIZE),p=n.getParameter(n.MAX_CUBE_MAP_TEXTURE_SIZE),h=n.getParameter(n.MAX_VERTEX_ATTRIBS),x=n.getParameter(n.MAX_VERTEX_UNIFORM_VECTORS),E=n.getParameter(n.MAX_VARYING_VECTORS),M=n.getParameter(n.MAX_FRAGMENT_UNIFORM_VECTORS),b=n.getParameter(n.MAX_SAMPLES),T=n.getParameter(n.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:f,reversedDepthBuffer:u,maxTextures:m,maxVertexTextures:g,maxTextureSize:S,maxCubemapSize:p,maxAttributes:h,maxVertexUniforms:x,maxVaryings:E,maxFragmentUniforms:M,maxSamples:b,samples:T}}function Wf(n){const e=this;let t=null,i=0,s=!1,r=!1;const a=new wi,o=new Ue,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(f,u){const m=f.length!==0||u||i!==0||s;return s=u,i=f.length,m},this.beginShadows=function(){r=!0,d(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(f,u){t=d(f,u,0)},this.setState=function(f,u,m){const g=f.clippingPlanes,S=f.clipIntersection,p=f.clipShadows,h=n.get(f);if(!s||g===null||g.length===0||r&&!p)r?d(null):c();else{const x=r?0:i,E=x*4;let M=h.clippingState||null;l.value=M,M=d(g,u,E,m);for(let b=0;b!==E;++b)M[b]=t[b];h.clippingState=M,this.numIntersection=S?this.numPlanes:0,this.numPlanes+=x}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=i>0),e.numPlanes=i,e.numIntersection=0}function d(f,u,m,g){const S=f!==null?f.length:0;let p=null;if(S!==0){if(p=l.value,g!==!0||p===null){const h=m+S*4,x=u.matrixWorldInverse;o.getNormalMatrix(x),(p===null||p.length<h)&&(p=new Float32Array(h));for(let E=0,M=m;E!==S;++E,M+=4)a.copy(f[E]).applyMatrix4(x,o),a.normal.toArray(p,M),p[M+3]=a.constant}l.value=p,l.needsUpdate=!0}return e.numPlanes=S,e.numIntersection=0,p}}const Gi=4,ol=[.125,.215,.35,.446,.526,.582],ji=20,Xf=256,qn=new er,ll=new te;let Ur=null,Fr=0,Nr=0,Or=!1;const $f=new C;class Na{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,i=.1,s=100,r={}){const{size:a=256,position:o=$f}=r;Ur=this._renderer.getRenderTarget(),Fr=this._renderer.getActiveCubeFace(),Nr=this._renderer.getActiveMipmapLevel(),Or=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);const l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(e,i,s,l,o),t>0&&this._blur(l,0,0,t),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=hl(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=ul(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(Ur,Fr,Nr),this._renderer.xr.enabled=Or,e.scissorTest=!1,En(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===nn||e.mapping===Ln?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Ur=this._renderer.getRenderTarget(),Fr=this._renderer.getActiveCubeFace(),Nr=this._renderer.getActiveMipmapLevel(),Or=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const i=t||this._allocateTargets();return this._textureToCubeUV(e,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){const e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,i={magFilter:Nt,minFilter:Nt,generateMipmaps:!1,type:Jt,format:oi,colorSpace:qs,depthBuffer:!1},s=cl(e,t,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=cl(e,t,i);const{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=qf(r)),this._blurMaterial=Kf(r,e,t),this._ggxMaterial=Yf(r,e,t)}return s}_compileMaterial(e){const t=new He(new Tt,e);this._renderer.compile(t,qn)}_sceneToCubeUV(e,t,i,s,r){const l=new Kt(90,1,t,i),c=[1,-1,1,1,1,1],d=[1,1,1,-1,-1,-1],f=this._renderer,u=f.autoClear,m=f.toneMapping;f.getClearColor(ll),f.toneMapping=gi,f.autoClear=!1,f.state.buffers.depth.getReversed()&&(f.setRenderTarget(s),f.clearDepth(),f.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new He(new Xi,new Qs({name:"PMREM.Background",side:Ot,depthWrite:!1,depthTest:!1})));const S=this._backgroundBox,p=S.material;let h=!1;const x=e.background;x?x.isColor&&(p.color.copy(x),e.background=null,h=!0):(p.color.copy(ll),h=!0);for(let E=0;E<6;E++){const M=E%3;M===0?(l.up.set(0,c[E],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x+d[E],r.y,r.z)):M===1?(l.up.set(0,0,c[E]),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y+d[E],r.z)):(l.up.set(0,c[E],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y,r.z+d[E]));const b=this._cubeSize;En(s,M*b,E>2?b:0,b,b),f.setRenderTarget(s),h&&f.render(S,l),f.render(e,l)}f.toneMapping=m,f.autoClear=u,e.background=x}_textureToCubeUV(e,t){const i=this._renderer,s=e.mapping===nn||e.mapping===Ln;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=hl()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=ul());const r=s?this._cubemapMaterial:this._equirectMaterial,a=this._lodMeshes[0];a.material=r;const o=r.uniforms;o.envMap.value=e;const l=this._cubeSize;En(t,0,0,3*l,2*l),i.setRenderTarget(t),i.render(a,qn)}_applyPMREM(e){const t=this._renderer,i=t.autoClear;t.autoClear=!1;const s=this._lodMeshes.length;for(let r=1;r<s;r++)this._applyGGXFilter(e,r-1,r);t.autoClear=i}_applyGGXFilter(e,t,i){const s=this._renderer,r=this._pingPongRenderTarget,a=this._ggxMaterial,o=this._lodMeshes[i];o.material=a;const l=a.uniforms,c=i/(this._lodMeshes.length-1),d=t/(this._lodMeshes.length-1),f=Math.sqrt(c*c-d*d),u=0+c*1.25,m=f*u,{_lodMax:g}=this,S=this._sizeLods[i],p=3*S*(i>g-Gi?i-g+Gi:0),h=4*(this._cubeSize-S);l.envMap.value=e.texture,l.roughness.value=m,l.mipInt.value=g-t,En(r,p,h,3*S,2*S),s.setRenderTarget(r),s.render(o,qn),l.envMap.value=r.texture,l.roughness.value=0,l.mipInt.value=g-i,En(e,p,h,3*S,2*S),s.setRenderTarget(e),s.render(o,qn)}_blur(e,t,i,s,r){const a=this._pingPongRenderTarget;this._halfBlur(e,a,t,i,s,"latitudinal",r),this._halfBlur(a,e,i,i,s,"longitudinal",r)}_halfBlur(e,t,i,s,r,a,o){const l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&Xe("blur direction must be either latitudinal or longitudinal!");const d=3,f=this._lodMeshes[s];f.material=c;const u=c.uniforms,m=this._sizeLods[i]-1,g=isFinite(r)?Math.PI/(2*m):2*Math.PI/(2*ji-1),S=r/g,p=isFinite(r)?1+Math.floor(d*S):ji;p>ji&&Ie(`sigmaRadians, ${r}, is too large and will clip, as it requested ${p} samples when the maximum is set to ${ji}`);const h=[];let x=0;for(let R=0;R<ji;++R){const _=R/S,w=Math.exp(-_*_/2);h.push(w),R===0?x+=w:R<p&&(x+=2*w)}for(let R=0;R<h.length;R++)h[R]=h[R]/x;u.envMap.value=e.texture,u.samples.value=p,u.weights.value=h,u.latitudinal.value=a==="latitudinal",o&&(u.poleAxis.value=o);const{_lodMax:E}=this;u.dTheta.value=g,u.mipInt.value=E-i;const M=this._sizeLods[s],b=3*M*(s>E-Gi?s-E+Gi:0),T=4*(this._cubeSize-M);En(t,b,T,3*M,2*M),l.setRenderTarget(t),l.render(f,qn)}}function qf(n){const e=[],t=[],i=[];let s=n;const r=n-Gi+1+ol.length;for(let a=0;a<r;a++){const o=Math.pow(2,s);e.push(o);let l=1/o;a>n-Gi?l=ol[a-n+Gi-1]:a===0&&(l=0),t.push(l);const c=1/(o-2),d=-c,f=1+c,u=[d,d,f,d,f,f,d,d,f,f,d,f],m=6,g=6,S=3,p=2,h=1,x=new Float32Array(S*g*m),E=new Float32Array(p*g*m),M=new Float32Array(h*g*m);for(let T=0;T<m;T++){const R=T%3*2/3-1,_=T>2?0:-1,w=[R,_,0,R+2/3,_,0,R+2/3,_+1,0,R,_,0,R+2/3,_+1,0,R,_+1,0];x.set(w,S*g*T),E.set(u,p*g*T);const P=[T,T,T,T,T,T];M.set(P,h*g*T)}const b=new Tt;b.setAttribute("position",new xt(x,S)),b.setAttribute("uv",new xt(E,p)),b.setAttribute("faceIndex",new xt(M,h)),i.push(new He(b,null)),s>Gi&&s--}return{lodMeshes:i,sizeLods:e,sigmas:t}}function cl(n,e,t){const i=new Wt(n,e,t);return i.texture.mapping=Js,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function En(n,e,t,i,s){n.viewport.set(e,t,i,s),n.scissor.set(e,t,i,s)}function Yf(n,e,t){return new st({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:Xf,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${n}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:tr(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:mi,depthTest:!1,depthWrite:!1})}function Kf(n,e,t){const i=new Float32Array(ji),s=new C(0,1,0);return new st({name:"SphericalGaussianBlur",defines:{n:ji,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${n}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:i},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:tr(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:mi,depthTest:!1,depthWrite:!1})}function ul(){return new st({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:tr(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:mi,depthTest:!1,depthWrite:!1})}function hl(){return new st({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:tr(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:mi,depthTest:!1,depthWrite:!1})}function tr(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}class cc extends Wt{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;const i={width:e,height:e,depth:1},s=[i,i,i,i,i,i];this.texture=new ec(s),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const i={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},s=new Xi(5,5,5),r=new st({name:"CubemapFromEquirect",uniforms:Un(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:Ot,blending:mi});r.uniforms.tEquirect.value=t;const a=new He(s,r),o=t.minFilter;return t.minFilter===en&&(t.minFilter=Nt),new Ju(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,i=!0,s=!0){const r=e.getRenderTarget();for(let a=0;a<6;a++)e.setRenderTarget(this,a),e.clear(t,i,s);e.setRenderTarget(r)}}function Zf(n){let e=new WeakMap,t=new WeakMap,i=null;function s(u,m=!1){return u==null?null:m?a(u):r(u)}function r(u){if(u&&u.isTexture){const m=u.mapping;if(m===ar||m===or)if(e.has(u)){const g=e.get(u).texture;return o(g,u.mapping)}else{const g=u.image;if(g&&g.height>0){const S=new cc(g.height);return S.fromEquirectangularTexture(n,u),e.set(u,S),u.addEventListener("dispose",c),o(S.texture,u.mapping)}else return null}}return u}function a(u){if(u&&u.isTexture){const m=u.mapping,g=m===ar||m===or,S=m===nn||m===Ln;if(g||S){let p=t.get(u);const h=p!==void 0?p.texture.pmremVersion:0;if(u.isRenderTargetTexture&&u.pmremVersion!==h)return i===null&&(i=new Na(n)),p=g?i.fromEquirectangular(u,p):i.fromCubemap(u,p),p.texture.pmremVersion=u.pmremVersion,t.set(u,p),p.texture;if(p!==void 0)return p.texture;{const x=u.image;return g&&x&&x.height>0||S&&x&&l(x)?(i===null&&(i=new Na(n)),p=g?i.fromEquirectangular(u):i.fromCubemap(u),p.texture.pmremVersion=u.pmremVersion,t.set(u,p),u.addEventListener("dispose",d),p.texture):null}}}return u}function o(u,m){return m===ar?u.mapping=nn:m===or&&(u.mapping=Ln),u}function l(u){let m=0;const g=6;for(let S=0;S<g;S++)u[S]!==void 0&&m++;return m===g}function c(u){const m=u.target;m.removeEventListener("dispose",c);const g=e.get(m);g!==void 0&&(e.delete(m),g.dispose())}function d(u){const m=u.target;m.removeEventListener("dispose",d);const g=t.get(m);g!==void 0&&(t.delete(m),g.dispose())}function f(){e=new WeakMap,t=new WeakMap,i!==null&&(i.dispose(),i=null)}return{get:s,dispose:f}}function Jf(n){const e={};function t(i){if(e[i]!==void 0)return e[i];const s=n.getExtension(i);return e[i]=s,s}return{has:function(i){return t(i)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(i){const s=t(i);return s===null&&Rn("WebGLRenderer: "+i+" extension not supported."),s}}}function Qf(n,e,t,i){const s={},r=new WeakMap;function a(f){const u=f.target;u.index!==null&&e.remove(u.index);for(const g in u.attributes)e.remove(u.attributes[g]);u.removeEventListener("dispose",a),delete s[u.id];const m=r.get(u);m&&(e.remove(m),r.delete(u)),i.releaseStatesOfGeometry(u),u.isInstancedBufferGeometry===!0&&delete u._maxInstanceCount,t.memory.geometries--}function o(f,u){return s[u.id]===!0||(u.addEventListener("dispose",a),s[u.id]=!0,t.memory.geometries++),u}function l(f){const u=f.attributes;for(const m in u)e.update(u[m],n.ARRAY_BUFFER)}function c(f){const u=[],m=f.index,g=f.attributes.position;let S=0;if(g===void 0)return;if(m!==null){const x=m.array;S=m.version;for(let E=0,M=x.length;E<M;E+=3){const b=x[E+0],T=x[E+1],R=x[E+2];u.push(b,T,T,R,R,b)}}else{const x=g.array;S=g.version;for(let E=0,M=x.length/3-1;E<M;E+=3){const b=E+0,T=E+1,R=E+2;u.push(b,T,T,R,R,b)}}const p=new(g.count>=65535?Ql:Jl)(u,1);p.version=S;const h=r.get(f);h&&e.remove(h),r.set(f,p)}function d(f){const u=r.get(f);if(u){const m=f.index;m!==null&&u.version<m.version&&c(f)}else c(f);return r.get(f)}return{get:o,update:l,getWireframeAttribute:d}}function jf(n,e,t){let i;function s(f){i=f}let r,a;function o(f){r=f.type,a=f.bytesPerElement}function l(f,u){n.drawElements(i,u,r,f*a),t.update(u,i,1)}function c(f,u,m){m!==0&&(n.drawElementsInstanced(i,u,r,f*a,m),t.update(u,i,m))}function d(f,u,m){if(m===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,u,0,r,f,0,m);let S=0;for(let p=0;p<m;p++)S+=u[p];t.update(S,i,1)}this.setMode=s,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=d}function ep(n){const e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function i(r,a,o){switch(t.calls++,a){case n.TRIANGLES:t.triangles+=o*(r/3);break;case n.LINES:t.lines+=o*(r/2);break;case n.LINE_STRIP:t.lines+=o*(r-1);break;case n.LINE_LOOP:t.lines+=o*r;break;case n.POINTS:t.points+=o*r;break;default:Xe("WebGLInfo: Unknown draw mode:",a);break}}function s(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:s,update:i}}function tp(n,e,t){const i=new WeakMap,s=new ot;function r(a,o,l){const c=a.morphTargetInfluences,d=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,f=d!==void 0?d.length:0;let u=i.get(o);if(u===void 0||u.count!==f){let P=function(){_.dispose(),i.delete(o),o.removeEventListener("dispose",P)};var m=P;u!==void 0&&u.texture.dispose();const g=o.morphAttributes.position!==void 0,S=o.morphAttributes.normal!==void 0,p=o.morphAttributes.color!==void 0,h=o.morphAttributes.position||[],x=o.morphAttributes.normal||[],E=o.morphAttributes.color||[];let M=0;g===!0&&(M=1),S===!0&&(M=2),p===!0&&(M=3);let b=o.attributes.position.count*M,T=1;b>e.maxTextureSize&&(T=Math.ceil(b/e.maxTextureSize),b=e.maxTextureSize);const R=new Float32Array(b*T*4*f),_=new Yl(R,b,T,f);_.type=ai,_.needsUpdate=!0;const w=M*4;for(let D=0;D<f;D++){const F=h[D],W=x[D],Z=E[D],O=b*T*4*D;for(let $=0;$<F.count;$++){const k=$*w;g===!0&&(s.fromBufferAttribute(F,$),R[O+k+0]=s.x,R[O+k+1]=s.y,R[O+k+2]=s.z,R[O+k+3]=0),S===!0&&(s.fromBufferAttribute(W,$),R[O+k+4]=s.x,R[O+k+5]=s.y,R[O+k+6]=s.z,R[O+k+7]=0),p===!0&&(s.fromBufferAttribute(Z,$),R[O+k+8]=s.x,R[O+k+9]=s.y,R[O+k+10]=s.z,R[O+k+11]=Z.itemSize===4?s.w:1)}}u={count:f,texture:_,size:new Re(b,T)},i.set(o,u),o.addEventListener("dispose",P)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(n,"morphTexture",a.morphTexture,t);else{let g=0;for(let p=0;p<c.length;p++)g+=c[p];const S=o.morphTargetsRelative?1:1-g;l.getUniforms().setValue(n,"morphTargetBaseInfluence",S),l.getUniforms().setValue(n,"morphTargetInfluences",c)}l.getUniforms().setValue(n,"morphTargetsTexture",u.texture,t),l.getUniforms().setValue(n,"morphTargetsTextureSize",u.size)}return{update:r}}function ip(n,e,t,i,s){let r=new WeakMap;function a(c){const d=s.render.frame,f=c.geometry,u=e.get(c,f);if(r.get(u)!==d&&(e.update(u),r.set(u,d)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),r.get(c)!==d&&(t.update(c.instanceMatrix,n.ARRAY_BUFFER),c.instanceColor!==null&&t.update(c.instanceColor,n.ARRAY_BUFFER),r.set(c,d))),c.isSkinnedMesh){const m=c.skeleton;r.get(m)!==d&&(m.update(),r.set(m,d))}return u}function o(){r=new WeakMap}function l(c){const d=c.target;d.removeEventListener("dispose",l),i.releaseStatesOfObject(d),t.remove(d.instanceMatrix),d.instanceColor!==null&&t.remove(d.instanceColor)}return{update:a,dispose:o}}const np={[Ha]:"LINEAR_TONE_MAPPING",[Wa]:"REINHARD_TONE_MAPPING",[Xa]:"CINEON_TONE_MAPPING",[Zs]:"ACES_FILMIC_TONE_MAPPING",[qa]:"AGX_TONE_MAPPING",[Ya]:"NEUTRAL_TONE_MAPPING",[$a]:"CUSTOM_TONE_MAPPING"};function sp(n,e,t,i,s,r){const a=new Wt(e,t,{type:n,depthBuffer:s,stencilBuffer:r,samples:i?4:0,depthTexture:s?new In(e,t):void 0}),o=new Wt(e,t,{type:Jt,depthBuffer:!1,stencilBuffer:!1}),l=new Tt;l.setAttribute("position",new mt([-1,3,0,-1,-1,0,3,-1,0],3)),l.setAttribute("uv",new mt([0,2,0,0,2,0],2));const c=new nc({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),d=new He(l,c),f=new er(-1,1,1,-1,0,1);let u=null,m=null,g=!1,S,p=null,h=[],x=!1;this.setSize=function(E,M){a.setSize(E,M),o.setSize(E,M);for(let b=0;b<h.length;b++){const T=h[b];T.setSize&&T.setSize(E,M)}},this.setEffects=function(E){h=E,x=h.length>0&&h[0].isRenderPass===!0;const M=a.width,b=a.height;for(let T=0;T<h.length;T++){const R=h[T];R.setSize&&R.setSize(M,b)}},this.begin=function(E,M){if(g||E.toneMapping===gi&&h.length===0)return!1;if(p=M,M!==null){const b=M.width,T=M.height;(a.width!==b||a.height!==T)&&this.setSize(b,T)}return x===!1&&E.setRenderTarget(a),S=E.toneMapping,E.toneMapping=gi,!0},this.hasRenderPass=function(){return x},this.end=function(E,M){E.toneMapping=S,g=!0;let b=a,T=o;for(let R=0;R<h.length;R++){const _=h[R];if(_.enabled!==!1&&(_.render(E,T,b,M),_.needsSwap!==!1)){const w=b;b=T,T=w}}if(u!==E.outputColorSpace||m!==E.toneMapping){u=E.outputColorSpace,m=E.toneMapping,c.defines={},Ve.getTransfer(u)===Ze&&(c.defines.SRGB_TRANSFER="");const R=np[m];R&&(c.defines[R]=""),c.needsUpdate=!0}c.uniforms.tDiffuse.value=b.texture,E.setRenderTarget(p),E.render(d,f),p=null,g=!1},this.isCompositing=function(){return g},this.dispose=function(){a.depthTexture&&a.depthTexture.dispose(),a.dispose(),o.dispose(),l.dispose(),c.dispose()}}const uc=new kt,Oa=new In(1,1),hc=new Yl,dc=new xu,fc=new ec,dl=[],fl=[],pl=new Float32Array(16),ml=new Float32Array(9),gl=new Float32Array(4);function On(n,e,t){const i=n[0];if(i<=0||i>0)return n;const s=e*t;let r=dl[s];if(r===void 0&&(r=new Float32Array(s),dl[s]=r),e!==0){i.toArray(r,0);for(let a=1,o=0;a!==e;++a)o+=t,n[a].toArray(r,o)}return r}function bt(n,e){if(n.length!==e.length)return!1;for(let t=0,i=n.length;t<i;t++)if(n[t]!==e[t])return!1;return!0}function Et(n,e){for(let t=0,i=e.length;t<i;t++)n[t]=e[t]}function ir(n,e){let t=fl[e];t===void 0&&(t=new Int32Array(e),fl[e]=t);for(let i=0;i!==e;++i)t[i]=n.allocateTextureUnit();return t}function rp(n,e){const t=this.cache;t[0]!==e&&(n.uniform1f(this.addr,e),t[0]=e)}function ap(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(bt(t,e))return;n.uniform2fv(this.addr,e),Et(t,e)}}function op(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(n.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(bt(t,e))return;n.uniform3fv(this.addr,e),Et(t,e)}}function lp(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(bt(t,e))return;n.uniform4fv(this.addr,e),Et(t,e)}}function cp(n,e){const t=this.cache,i=e.elements;if(i===void 0){if(bt(t,e))return;n.uniformMatrix2fv(this.addr,!1,e),Et(t,e)}else{if(bt(t,i))return;gl.set(i),n.uniformMatrix2fv(this.addr,!1,gl),Et(t,i)}}function up(n,e){const t=this.cache,i=e.elements;if(i===void 0){if(bt(t,e))return;n.uniformMatrix3fv(this.addr,!1,e),Et(t,e)}else{if(bt(t,i))return;ml.set(i),n.uniformMatrix3fv(this.addr,!1,ml),Et(t,i)}}function hp(n,e){const t=this.cache,i=e.elements;if(i===void 0){if(bt(t,e))return;n.uniformMatrix4fv(this.addr,!1,e),Et(t,e)}else{if(bt(t,i))return;pl.set(i),n.uniformMatrix4fv(this.addr,!1,pl),Et(t,i)}}function dp(n,e){const t=this.cache;t[0]!==e&&(n.uniform1i(this.addr,e),t[0]=e)}function fp(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(bt(t,e))return;n.uniform2iv(this.addr,e),Et(t,e)}}function pp(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(bt(t,e))return;n.uniform3iv(this.addr,e),Et(t,e)}}function mp(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(bt(t,e))return;n.uniform4iv(this.addr,e),Et(t,e)}}function gp(n,e){const t=this.cache;t[0]!==e&&(n.uniform1ui(this.addr,e),t[0]=e)}function vp(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(bt(t,e))return;n.uniform2uiv(this.addr,e),Et(t,e)}}function _p(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(bt(t,e))return;n.uniform3uiv(this.addr,e),Et(t,e)}}function xp(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(bt(t,e))return;n.uniform4uiv(this.addr,e),Et(t,e)}}function Sp(n,e,t){const i=this.cache,s=t.allocateTextureUnit();i[0]!==s&&(n.uniform1i(this.addr,s),i[0]=s);let r;this.type===n.SAMPLER_2D_SHADOW?(Oa.compareFunction=t.isReversedDepthBuffer()?no:io,r=Oa):r=uc,t.setTexture2D(e||r,s)}function Mp(n,e,t){const i=this.cache,s=t.allocateTextureUnit();i[0]!==s&&(n.uniform1i(this.addr,s),i[0]=s),t.setTexture3D(e||dc,s)}function yp(n,e,t){const i=this.cache,s=t.allocateTextureUnit();i[0]!==s&&(n.uniform1i(this.addr,s),i[0]=s),t.setTextureCube(e||fc,s)}function bp(n,e,t){const i=this.cache,s=t.allocateTextureUnit();i[0]!==s&&(n.uniform1i(this.addr,s),i[0]=s),t.setTexture2DArray(e||hc,s)}function Ep(n){switch(n){case 5126:return rp;case 35664:return ap;case 35665:return op;case 35666:return lp;case 35674:return cp;case 35675:return up;case 35676:return hp;case 5124:case 35670:return dp;case 35667:case 35671:return fp;case 35668:case 35672:return pp;case 35669:case 35673:return mp;case 5125:return gp;case 36294:return vp;case 36295:return _p;case 36296:return xp;case 35678:case 36198:case 36298:case 36306:case 35682:return Sp;case 35679:case 36299:case 36307:return Mp;case 35680:case 36300:case 36308:case 36293:return yp;case 36289:case 36303:case 36311:case 36292:return bp}}function wp(n,e){n.uniform1fv(this.addr,e)}function Tp(n,e){const t=On(e,this.size,2);n.uniform2fv(this.addr,t)}function Ap(n,e){const t=On(e,this.size,3);n.uniform3fv(this.addr,t)}function Cp(n,e){const t=On(e,this.size,4);n.uniform4fv(this.addr,t)}function Rp(n,e){const t=On(e,this.size,4);n.uniformMatrix2fv(this.addr,!1,t)}function Pp(n,e){const t=On(e,this.size,9);n.uniformMatrix3fv(this.addr,!1,t)}function Dp(n,e){const t=On(e,this.size,16);n.uniformMatrix4fv(this.addr,!1,t)}function Lp(n,e){n.uniform1iv(this.addr,e)}function Ip(n,e){n.uniform2iv(this.addr,e)}function Up(n,e){n.uniform3iv(this.addr,e)}function Fp(n,e){n.uniform4iv(this.addr,e)}function Np(n,e){n.uniform1uiv(this.addr,e)}function Op(n,e){n.uniform2uiv(this.addr,e)}function Bp(n,e){n.uniform3uiv(this.addr,e)}function zp(n,e){n.uniform4uiv(this.addr,e)}function kp(n,e,t){const i=this.cache,s=e.length,r=ir(t,s);bt(i,r)||(n.uniform1iv(this.addr,r),Et(i,r));let a;this.type===n.SAMPLER_2D_SHADOW?a=Oa:a=uc;for(let o=0;o!==s;++o)t.setTexture2D(e[o]||a,r[o])}function Vp(n,e,t){const i=this.cache,s=e.length,r=ir(t,s);bt(i,r)||(n.uniform1iv(this.addr,r),Et(i,r));for(let a=0;a!==s;++a)t.setTexture3D(e[a]||dc,r[a])}function Gp(n,e,t){const i=this.cache,s=e.length,r=ir(t,s);bt(i,r)||(n.uniform1iv(this.addr,r),Et(i,r));for(let a=0;a!==s;++a)t.setTextureCube(e[a]||fc,r[a])}function Hp(n,e,t){const i=this.cache,s=e.length,r=ir(t,s);bt(i,r)||(n.uniform1iv(this.addr,r),Et(i,r));for(let a=0;a!==s;++a)t.setTexture2DArray(e[a]||hc,r[a])}function Wp(n){switch(n){case 5126:return wp;case 35664:return Tp;case 35665:return Ap;case 35666:return Cp;case 35674:return Rp;case 35675:return Pp;case 35676:return Dp;case 5124:case 35670:return Lp;case 35667:case 35671:return Ip;case 35668:case 35672:return Up;case 35669:case 35673:return Fp;case 5125:return Np;case 36294:return Op;case 36295:return Bp;case 36296:return zp;case 35678:case 36198:case 36298:case 36306:case 35682:return kp;case 35679:case 36299:case 36307:return Vp;case 35680:case 36300:case 36308:case 36293:return Gp;case 36289:case 36303:case 36311:case 36292:return Hp}}class Xp{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.setValue=Ep(t.type)}}class $p{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Wp(t.type)}}class qp{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,i){const s=this.seq;for(let r=0,a=s.length;r!==a;++r){const o=s[r];o.setValue(e,t[o.id],i)}}}const Br=/(\w+)(\])?(\[|\.)?/g;function vl(n,e){n.seq.push(e),n.map[e.id]=e}function Yp(n,e,t){const i=n.name,s=i.length;for(Br.lastIndex=0;;){const r=Br.exec(i),a=Br.lastIndex;let o=r[1];const l=r[2]==="]",c=r[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===s){vl(t,c===void 0?new Xp(o,n,e):new $p(o,n,e));break}else{let f=t.map[o];f===void 0&&(f=new qp(o),vl(t,f)),t=f}}}class Hs{constructor(e,t){this.seq=[],this.map={};const i=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let a=0;a<i;++a){const o=e.getActiveUniform(t,a),l=e.getUniformLocation(t,o.name);Yp(o,l,this)}const s=[],r=[];for(const a of this.seq)a.type===e.SAMPLER_2D_SHADOW||a.type===e.SAMPLER_CUBE_SHADOW||a.type===e.SAMPLER_2D_ARRAY_SHADOW?s.push(a):r.push(a);s.length>0&&(this.seq=s.concat(r))}setValue(e,t,i,s){const r=this.map[t];r!==void 0&&r.setValue(e,i,s)}setOptional(e,t,i){const s=t[i];s!==void 0&&this.setValue(e,i,s)}static upload(e,t,i,s){for(let r=0,a=t.length;r!==a;++r){const o=t[r],l=i[o.id];l.needsUpdate!==!1&&o.setValue(e,l.value,s)}}static seqWithValue(e,t){const i=[];for(let s=0,r=e.length;s!==r;++s){const a=e[s];a.id in t&&i.push(a)}return i}}function _l(n,e,t){const i=n.createShader(e);return n.shaderSource(i,t),n.compileShader(i),i}const Kp=37297;let Zp=0;function Jp(n,e){const t=n.split(`
`),i=[],s=Math.max(e-6,0),r=Math.min(e+6,t.length);for(let a=s;a<r;a++){const o=a+1;i.push(`${o===e?">":" "} ${o}: ${t[a]}`)}return i.join(`
`)}const xl=new Ue;function Qp(n){Ve._getMatrix(xl,Ve.workingColorSpace,n);const e=`mat3( ${xl.elements.map(t=>t.toFixed(4))} )`;switch(Ve.getTransfer(n)){case Ys:return[e,"LinearTransferOETF"];case Ze:return[e,"sRGBTransferOETF"];default:return Ie("WebGLProgram: Unsupported color space: ",n),[e,"LinearTransferOETF"]}}function Sl(n,e,t){const i=n.getShaderParameter(e,n.COMPILE_STATUS),r=(n.getShaderInfoLog(e)||"").trim();if(i&&r==="")return"";const a=/ERROR: 0:(\d+)/.exec(r);if(a){const o=parseInt(a[1]);return t.toUpperCase()+`

`+r+`

`+Jp(n.getShaderSource(e),o)}else return r}function jp(n,e){const t=Qp(e);return[`vec4 ${n}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}const em={[Ha]:"Linear",[Wa]:"Reinhard",[Xa]:"Cineon",[Zs]:"ACESFilmic",[qa]:"AgX",[Ya]:"Neutral",[$a]:"Custom"};function tm(n,e){const t=em[e];return t===void 0?(Ie("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+n+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+n+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}const Ns=new C;function im(){Ve.getLuminanceCoefficients(Ns);const n=Ns.x.toFixed(4),e=Ns.y.toFixed(4),t=Ns.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${n}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function nm(n){return[n.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",n.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(Qn).join(`
`)}function sm(n){const e=[];for(const t in n){const i=n[t];i!==!1&&e.push("#define "+t+" "+i)}return e.join(`
`)}function rm(n,e){const t={},i=n.getProgramParameter(e,n.ACTIVE_ATTRIBUTES);for(let s=0;s<i;s++){const r=n.getActiveAttrib(e,s),a=r.name;let o=1;r.type===n.FLOAT_MAT2&&(o=2),r.type===n.FLOAT_MAT3&&(o=3),r.type===n.FLOAT_MAT4&&(o=4),t[a]={type:r.type,location:n.getAttribLocation(e,a),locationSize:o}}return t}function Qn(n){return n!==""}function Ml(n,e){const t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return n.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function yl(n,e){return n.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}const am=/^[ \t]*#include +<([\w\d./]+)>/gm;function Ba(n){return n.replace(am,lm)}const om=new Map;function lm(n,e){let t=Be[e];if(t===void 0){const i=om.get(e);if(i!==void 0)t=Be[i],Ie('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,i);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+e+">")}return Ba(t)}const cm=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function bl(n){return n.replace(cm,um)}function um(n,e,t,i){let s="";for(let r=parseInt(e);r<parseInt(t);r++)s+=i.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function El(n){let e=`precision ${n.precision} float;
	precision ${n.precision} int;
	precision ${n.precision} sampler2D;
	precision ${n.precision} samplerCube;
	precision ${n.precision} sampler3D;
	precision ${n.precision} sampler2DArray;
	precision ${n.precision} sampler2DShadow;
	precision ${n.precision} samplerCubeShadow;
	precision ${n.precision} sampler2DArrayShadow;
	precision ${n.precision} isampler2D;
	precision ${n.precision} isampler3D;
	precision ${n.precision} isamplerCube;
	precision ${n.precision} isampler2DArray;
	precision ${n.precision} usampler2D;
	precision ${n.precision} usampler3D;
	precision ${n.precision} usamplerCube;
	precision ${n.precision} usampler2DArray;
	`;return n.precision==="highp"?e+=`
#define HIGH_PRECISION`:n.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:n.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}const hm={[jn]:"SHADOWMAP_TYPE_PCF",[Jn]:"SHADOWMAP_TYPE_VSM"};function dm(n){return hm[n.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}const fm={[nn]:"ENVMAP_TYPE_CUBE",[Ln]:"ENVMAP_TYPE_CUBE",[Js]:"ENVMAP_TYPE_CUBE_UV"};function pm(n){return n.envMap===!1?"ENVMAP_TYPE_CUBE":fm[n.envMapMode]||"ENVMAP_TYPE_CUBE"}const mm={[Ln]:"ENVMAP_MODE_REFRACTION"};function gm(n){return n.envMap===!1?"ENVMAP_MODE_REFLECTION":mm[n.envMapMode]||"ENVMAP_MODE_REFLECTION"}const vm={[zl]:"ENVMAP_BLENDING_MULTIPLY",[Qc]:"ENVMAP_BLENDING_MIX",[jc]:"ENVMAP_BLENDING_ADD"};function _m(n){return n.envMap===!1?"ENVMAP_BLENDING_NONE":vm[n.combine]||"ENVMAP_BLENDING_NONE"}function xm(n){const e=n.envMapCubeUVHeight;if(e===null)return null;const t=Math.log2(e)-2,i=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:i,maxMip:t}}function Sm(n,e,t,i){const s=n.getContext(),r=t.defines;let a=t.vertexShader,o=t.fragmentShader;const l=dm(t),c=pm(t),d=gm(t),f=_m(t),u=xm(t),m=nm(t),g=sm(r),S=s.createProgram();let p,h,x=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(p=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(Qn).join(`
`),p.length>0&&(p+=`
`),h=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(Qn).join(`
`),h.length>0&&(h+=`
`)):(p=[El(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+d:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(Qn).join(`
`),h=[El(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+d:"",t.envMap?"#define "+f:"",u?"#define CUBEUV_TEXEL_WIDTH "+u.texelWidth:"",u?"#define CUBEUV_TEXEL_HEIGHT "+u.texelHeight:"",u?"#define CUBEUV_MAX_MIP "+u.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==gi?"#define TONE_MAPPING":"",t.toneMapping!==gi?Be.tonemapping_pars_fragment:"",t.toneMapping!==gi?tm("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Be.colorspace_pars_fragment,jp("linearToOutputTexel",t.outputColorSpace),im(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(Qn).join(`
`)),a=Ba(a),a=Ml(a,t),a=yl(a,t),o=Ba(o),o=Ml(o,t),o=yl(o,t),a=bl(a),o=bl(o),t.isRawShaderMaterial!==!0&&(x=`#version 300 es
`,p=[m,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+p,h=["#define varying in",t.glslVersion===Do?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===Do?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+h);const E=x+p+a,M=x+h+o,b=_l(s,s.VERTEX_SHADER,E),T=_l(s,s.FRAGMENT_SHADER,M);s.attachShader(S,b),s.attachShader(S,T),t.index0AttributeName!==void 0?s.bindAttribLocation(S,0,t.index0AttributeName):t.hasPositionAttribute===!0&&s.bindAttribLocation(S,0,"position"),s.linkProgram(S);function R(D){if(n.debug.checkShaderErrors){const F=s.getProgramInfoLog(S)||"",W=s.getShaderInfoLog(b)||"",Z=s.getShaderInfoLog(T)||"",O=F.trim(),$=W.trim(),k=Z.trim();let J=!0,ee=!0;if(s.getProgramParameter(S,s.LINK_STATUS)===!1)if(J=!1,typeof n.debug.onShaderError=="function")n.debug.onShaderError(s,S,b,T);else{const ae=Sl(s,b,"vertex"),ie=Sl(s,T,"fragment");Xe("WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(S,s.VALIDATE_STATUS)+`

Material Name: `+D.name+`
Material Type: `+D.type+`

Program Info Log: `+O+`
`+ae+`
`+ie)}else O!==""?Ie("WebGLProgram: Program Info Log:",O):($===""||k==="")&&(ee=!1);ee&&(D.diagnostics={runnable:J,programLog:O,vertexShader:{log:$,prefix:p},fragmentShader:{log:k,prefix:h}})}s.deleteShader(b),s.deleteShader(T),_=new Hs(s,S),w=rm(s,S)}let _;this.getUniforms=function(){return _===void 0&&R(this),_};let w;this.getAttributes=function(){return w===void 0&&R(this),w};let P=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return P===!1&&(P=s.getProgramParameter(S,Kp)),P},this.destroy=function(){i.releaseStatesOfProgram(this),s.deleteProgram(S),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=Zp++,this.cacheKey=e,this.usedTimes=1,this.program=S,this.vertexShader=b,this.fragmentShader=T,this}let Mm=0;class ym{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,i){const s=this._getShaderCacheForMaterial(e);return s.has(t)===!1&&(s.add(t),t.usedTimes++),s.has(i)===!1&&(s.add(i),i.usedTimes++),this}remove(e){const t=this.materialCache.get(e);for(const i of t)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){const t=this.materialCache;let i=t.get(e);return i===void 0&&(i=new Set,t.set(e,i)),i}_getShaderStage(e){const t=this.shaderCache;let i=t.get(e);return i===void 0&&(i=new bm(e),t.set(e,i)),i}}class bm{constructor(e){this.id=Mm++,this.code=e,this.usedTimes=0}}function Em(n){return n===sn||n===Xs||n===$s}function wm(n,e,t,i,s,r){const a=new ro,o=new ym,l=new Set,c=[],d=new Map,f=i.logarithmicDepthBuffer;let u=i.precision;const m={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(_){return l.add(_),_===0?"uv":`uv${_}`}function S(_,w,P,D,F,W){const Z=D.fog,O=F.geometry,$=_.isMeshStandardMaterial||_.isMeshLambertMaterial||_.isMeshPhongMaterial?D.environment:null,k=_.isMeshStandardMaterial||_.isMeshLambertMaterial&&!_.envMap||_.isMeshPhongMaterial&&!_.envMap,J=e.get(_.envMap||$,k),ee=J&&J.mapping===Js?J.image.height:null,ae=m[_.type];_.precision!==null&&(u=i.getMaxPrecision(_.precision),u!==_.precision&&Ie("WebGLProgram.getParameters:",_.precision,"not supported, using",u,"instead."));const ie=O.morphAttributes.position||O.morphAttributes.normal||O.morphAttributes.color,ve=ie!==void 0?ie.length:0;let Ae=0;O.morphAttributes.position!==void 0&&(Ae=1),O.morphAttributes.normal!==void 0&&(Ae=2),O.morphAttributes.color!==void 0&&(Ae=3);let Qe,We,q,se;if(ae){const xe=fi[ae];Qe=xe.vertexShader,We=xe.fragmentShader}else{Qe=_.vertexShader,We=_.fragmentShader;const xe=o.getVertexShaderStage(_),ct=o.getFragmentShaderStage(_);o.update(_,xe,ct),q=xe.id,se=ct.id}const j=n.getRenderTarget(),Pe=n.state.buffers.depth.getReversed(),Fe=F.isInstancedMesh===!0,De=F.isBatchedMesh===!0,ht=!!_.map,ke=!!_.matcap,tt=!!J,Ke=!!_.aoMap,$e=!!_.lightMap,gt=!!_.bumpMap&&_.wireframe===!1,Mt=!!_.normalMap,At=!!_.displacementMap,Rt=!!_.emissiveMap,lt=!!_.metalnessMap,vt=!!_.roughnessMap,I=_.anisotropy>0,Vt=_.clearcoat>0,je=_.dispersion>0,A=_.iridescence>0,v=_.sheen>0,N=_.transmission>0,V=I&&!!_.anisotropyMap,H=Vt&&!!_.clearcoatMap,ne=Vt&&!!_.clearcoatNormalMap,oe=Vt&&!!_.clearcoatRoughnessMap,X=A&&!!_.iridescenceMap,K=A&&!!_.iridescenceThicknessMap,le=v&&!!_.sheenColorMap,be=v&&!!_.sheenRoughnessMap,he=!!_.specularMap,ce=!!_.specularColorMap,Ce=!!_.specularIntensityMap,Le=N&&!!_.transmissionMap,Ne=N&&!!_.thicknessMap,L=!!_.gradientMap,re=!!_.alphaMap,Y=_.alphaTest>0,ue=!!_.alphaHash,me=!!_.extensions;let Q=gi;_.toneMapped&&(j===null||j.isXRRenderTarget===!0)&&(Q=n.toneMapping);const Me={shaderID:ae,shaderType:_.type,shaderName:_.name,vertexShader:Qe,fragmentShader:We,defines:_.defines,customVertexShaderID:q,customFragmentShaderID:se,isRawShaderMaterial:_.isRawShaderMaterial===!0,glslVersion:_.glslVersion,precision:u,batching:De,batchingColor:De&&F._colorsTexture!==null,instancing:Fe,instancingColor:Fe&&F.instanceColor!==null,instancingMorph:Fe&&F.morphTexture!==null,outputColorSpace:j===null?n.outputColorSpace:j.isXRRenderTarget===!0?j.texture.colorSpace:Ve.workingColorSpace,alphaToCoverage:!!_.alphaToCoverage,map:ht,matcap:ke,envMap:tt,envMapMode:tt&&J.mapping,envMapCubeUVHeight:ee,aoMap:Ke,lightMap:$e,bumpMap:gt,normalMap:Mt,displacementMap:At,emissiveMap:Rt,normalMapObjectSpace:Mt&&_.normalMapType===iu,normalMapTangentSpace:Mt&&_.normalMapType===La,packedNormalMap:Mt&&_.normalMapType===La&&Em(_.normalMap.format),metalnessMap:lt,roughnessMap:vt,anisotropy:I,anisotropyMap:V,clearcoat:Vt,clearcoatMap:H,clearcoatNormalMap:ne,clearcoatRoughnessMap:oe,dispersion:je,iridescence:A,iridescenceMap:X,iridescenceThicknessMap:K,sheen:v,sheenColorMap:le,sheenRoughnessMap:be,specularMap:he,specularColorMap:ce,specularIntensityMap:Ce,transmission:N,transmissionMap:Le,thicknessMap:Ne,gradientMap:L,opaque:_.transparent===!1&&_.blending===Hi&&_.alphaToCoverage===!1,alphaMap:re,alphaTest:Y,alphaHash:ue,combine:_.combine,mapUv:ht&&g(_.map.channel),aoMapUv:Ke&&g(_.aoMap.channel),lightMapUv:$e&&g(_.lightMap.channel),bumpMapUv:gt&&g(_.bumpMap.channel),normalMapUv:Mt&&g(_.normalMap.channel),displacementMapUv:At&&g(_.displacementMap.channel),emissiveMapUv:Rt&&g(_.emissiveMap.channel),metalnessMapUv:lt&&g(_.metalnessMap.channel),roughnessMapUv:vt&&g(_.roughnessMap.channel),anisotropyMapUv:V&&g(_.anisotropyMap.channel),clearcoatMapUv:H&&g(_.clearcoatMap.channel),clearcoatNormalMapUv:ne&&g(_.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:oe&&g(_.clearcoatRoughnessMap.channel),iridescenceMapUv:X&&g(_.iridescenceMap.channel),iridescenceThicknessMapUv:K&&g(_.iridescenceThicknessMap.channel),sheenColorMapUv:le&&g(_.sheenColorMap.channel),sheenRoughnessMapUv:be&&g(_.sheenRoughnessMap.channel),specularMapUv:he&&g(_.specularMap.channel),specularColorMapUv:ce&&g(_.specularColorMap.channel),specularIntensityMapUv:Ce&&g(_.specularIntensityMap.channel),transmissionMapUv:Le&&g(_.transmissionMap.channel),thicknessMapUv:Ne&&g(_.thicknessMap.channel),alphaMapUv:re&&g(_.alphaMap.channel),vertexTangents:!!O.attributes.tangent&&(Mt||I),vertexNormals:!!O.attributes.normal,vertexColors:_.vertexColors,vertexAlphas:_.vertexColors===!0&&!!O.attributes.color&&O.attributes.color.itemSize===4,pointsUvs:F.isPoints===!0&&!!O.attributes.uv&&(ht||re),fog:!!Z,useFog:_.fog===!0,fogExp2:!!Z&&Z.isFogExp2,flatShading:_.wireframe===!1&&(_.flatShading===!0||O.attributes.normal===void 0&&Mt===!1&&(_.isMeshLambertMaterial||_.isMeshPhongMaterial||_.isMeshStandardMaterial||_.isMeshPhysicalMaterial)),sizeAttenuation:_.sizeAttenuation===!0,logarithmicDepthBuffer:f,reversedDepthBuffer:Pe,skinning:F.isSkinnedMesh===!0,hasPositionAttribute:O.attributes.position!==void 0,morphTargets:O.morphAttributes.position!==void 0,morphNormals:O.morphAttributes.normal!==void 0,morphColors:O.morphAttributes.color!==void 0,morphTargetsCount:ve,morphTextureStride:Ae,numDirLights:w.directional.length,numPointLights:w.point.length,numSpotLights:w.spot.length,numSpotLightMaps:w.spotLightMap.length,numRectAreaLights:w.rectArea.length,numHemiLights:w.hemi.length,numDirLightShadows:w.directionalShadowMap.length,numPointLightShadows:w.pointShadowMap.length,numSpotLightShadows:w.spotShadowMap.length,numSpotLightShadowsWithMaps:w.numSpotLightShadowsWithMaps,numLightProbes:w.numLightProbes,numLightProbeGrids:W.length,numClippingPlanes:r.numPlanes,numClipIntersection:r.numIntersection,dithering:_.dithering,shadowMapEnabled:n.shadowMap.enabled&&P.length>0,shadowMapType:n.shadowMap.type,toneMapping:Q,decodeVideoTexture:ht&&_.map.isVideoTexture===!0&&Ve.getTransfer(_.map.colorSpace)===Ze,decodeVideoTextureEmissive:Rt&&_.emissiveMap.isVideoTexture===!0&&Ve.getTransfer(_.emissiveMap.colorSpace)===Ze,premultipliedAlpha:_.premultipliedAlpha,doubleSided:_.side===Ft,flipSided:_.side===Ot,useDepthPacking:_.depthPacking>=0,depthPacking:_.depthPacking||0,index0AttributeName:_.index0AttributeName,extensionClipCullDistance:me&&_.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(me&&_.extensions.multiDraw===!0||De)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:_.customProgramCacheKey()};return Me.vertexUv1s=l.has(1),Me.vertexUv2s=l.has(2),Me.vertexUv3s=l.has(3),l.clear(),Me}function p(_){const w=[];if(_.shaderID?w.push(_.shaderID):(w.push(_.customVertexShaderID),w.push(_.customFragmentShaderID)),_.defines!==void 0)for(const P in _.defines)w.push(P),w.push(_.defines[P]);return _.isRawShaderMaterial===!1&&(h(w,_),x(w,_),w.push(n.outputColorSpace)),w.push(_.customProgramCacheKey),w.join()}function h(_,w){_.push(w.precision),_.push(w.outputColorSpace),_.push(w.envMapMode),_.push(w.envMapCubeUVHeight),_.push(w.mapUv),_.push(w.alphaMapUv),_.push(w.lightMapUv),_.push(w.aoMapUv),_.push(w.bumpMapUv),_.push(w.normalMapUv),_.push(w.displacementMapUv),_.push(w.emissiveMapUv),_.push(w.metalnessMapUv),_.push(w.roughnessMapUv),_.push(w.anisotropyMapUv),_.push(w.clearcoatMapUv),_.push(w.clearcoatNormalMapUv),_.push(w.clearcoatRoughnessMapUv),_.push(w.iridescenceMapUv),_.push(w.iridescenceThicknessMapUv),_.push(w.sheenColorMapUv),_.push(w.sheenRoughnessMapUv),_.push(w.specularMapUv),_.push(w.specularColorMapUv),_.push(w.specularIntensityMapUv),_.push(w.transmissionMapUv),_.push(w.thicknessMapUv),_.push(w.combine),_.push(w.fogExp2),_.push(w.sizeAttenuation),_.push(w.morphTargetsCount),_.push(w.morphAttributeCount),_.push(w.numDirLights),_.push(w.numPointLights),_.push(w.numSpotLights),_.push(w.numSpotLightMaps),_.push(w.numHemiLights),_.push(w.numRectAreaLights),_.push(w.numDirLightShadows),_.push(w.numPointLightShadows),_.push(w.numSpotLightShadows),_.push(w.numSpotLightShadowsWithMaps),_.push(w.numLightProbes),_.push(w.shadowMapType),_.push(w.toneMapping),_.push(w.numClippingPlanes),_.push(w.numClipIntersection),_.push(w.depthPacking)}function x(_,w){a.disableAll(),w.instancing&&a.enable(0),w.instancingColor&&a.enable(1),w.instancingMorph&&a.enable(2),w.matcap&&a.enable(3),w.envMap&&a.enable(4),w.normalMapObjectSpace&&a.enable(5),w.normalMapTangentSpace&&a.enable(6),w.clearcoat&&a.enable(7),w.iridescence&&a.enable(8),w.alphaTest&&a.enable(9),w.vertexColors&&a.enable(10),w.vertexAlphas&&a.enable(11),w.vertexUv1s&&a.enable(12),w.vertexUv2s&&a.enable(13),w.vertexUv3s&&a.enable(14),w.vertexTangents&&a.enable(15),w.anisotropy&&a.enable(16),w.alphaHash&&a.enable(17),w.batching&&a.enable(18),w.dispersion&&a.enable(19),w.batchingColor&&a.enable(20),w.gradientMap&&a.enable(21),w.packedNormalMap&&a.enable(22),w.vertexNormals&&a.enable(23),_.push(a.mask),a.disableAll(),w.fog&&a.enable(0),w.useFog&&a.enable(1),w.flatShading&&a.enable(2),w.logarithmicDepthBuffer&&a.enable(3),w.reversedDepthBuffer&&a.enable(4),w.skinning&&a.enable(5),w.morphTargets&&a.enable(6),w.morphNormals&&a.enable(7),w.morphColors&&a.enable(8),w.premultipliedAlpha&&a.enable(9),w.shadowMapEnabled&&a.enable(10),w.doubleSided&&a.enable(11),w.flipSided&&a.enable(12),w.useDepthPacking&&a.enable(13),w.dithering&&a.enable(14),w.transmission&&a.enable(15),w.sheen&&a.enable(16),w.opaque&&a.enable(17),w.pointsUvs&&a.enable(18),w.decodeVideoTexture&&a.enable(19),w.decodeVideoTextureEmissive&&a.enable(20),w.alphaToCoverage&&a.enable(21),w.numLightProbeGrids>0&&a.enable(22),w.hasPositionAttribute&&a.enable(23),_.push(a.mask)}function E(_){const w=m[_.type];let P;if(w){const D=fi[w];P=as.clone(D.uniforms)}else P=_.uniforms;return P}function M(_,w){let P=d.get(w);return P!==void 0?++P.usedTimes:(P=new Sm(n,w,_,s),c.push(P),d.set(w,P)),P}function b(_){if(--_.usedTimes===0){const w=c.indexOf(_);c[w]=c[c.length-1],c.pop(),d.delete(_.cacheKey),_.destroy()}}function T(_){o.remove(_)}function R(){o.dispose()}return{getParameters:S,getProgramCacheKey:p,getUniforms:E,acquireProgram:M,releaseProgram:b,releaseShaderCache:T,programs:c,dispose:R}}function Tm(){let n=new WeakMap;function e(a){return n.has(a)}function t(a){let o=n.get(a);return o===void 0&&(o={},n.set(a,o)),o}function i(a){n.delete(a)}function s(a,o,l){n.get(a)[o]=l}function r(){n=new WeakMap}return{has:e,get:t,remove:i,update:s,dispose:r}}function Am(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.material.id!==e.material.id?n.material.id-e.material.id:n.materialVariant!==e.materialVariant?n.materialVariant-e.materialVariant:n.z!==e.z?n.z-e.z:n.id-e.id}function wl(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.z!==e.z?e.z-n.z:n.id-e.id}function Tl(){const n=[];let e=0;const t=[],i=[],s=[];function r(){e=0,t.length=0,i.length=0,s.length=0}function a(u){let m=0;return u.isInstancedMesh&&(m+=2),u.isSkinnedMesh&&(m+=1),m}function o(u,m,g,S,p,h){let x=n[e];return x===void 0?(x={id:u.id,object:u,geometry:m,material:g,materialVariant:a(u),groupOrder:S,renderOrder:u.renderOrder,z:p,group:h},n[e]=x):(x.id=u.id,x.object=u,x.geometry=m,x.material=g,x.materialVariant=a(u),x.groupOrder=S,x.renderOrder=u.renderOrder,x.z=p,x.group=h),e++,x}function l(u,m,g,S,p,h){const x=o(u,m,g,S,p,h);g.transmission>0?i.push(x):g.transparent===!0?s.push(x):t.push(x)}function c(u,m,g,S,p,h){const x=o(u,m,g,S,p,h);g.transmission>0?i.unshift(x):g.transparent===!0?s.unshift(x):t.unshift(x)}function d(u,m,g){t.length>1&&t.sort(u||Am),i.length>1&&i.sort(m||wl),s.length>1&&s.sort(m||wl),g&&(t.reverse(),i.reverse(),s.reverse())}function f(){for(let u=e,m=n.length;u<m;u++){const g=n[u];if(g.id===null)break;g.id=null,g.object=null,g.geometry=null,g.material=null,g.group=null}}return{opaque:t,transmissive:i,transparent:s,init:r,push:l,unshift:c,finish:f,sort:d}}function Cm(){let n=new WeakMap;function e(i,s){const r=n.get(i);let a;return r===void 0?(a=new Tl,n.set(i,[a])):s>=r.length?(a=new Tl,r.push(a)):a=r[s],a}function t(){n=new WeakMap}return{get:e,dispose:t}}function Rm(){const n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new C,color:new te};break;case"SpotLight":t={position:new C,direction:new C,color:new te,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new C,color:new te,distance:0,decay:0};break;case"HemisphereLight":t={direction:new C,skyColor:new te,groundColor:new te};break;case"RectAreaLight":t={color:new te,position:new C,halfWidth:new C,halfHeight:new C};break}return n[e.id]=t,t}}}function Pm(){const n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Re};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Re};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Re,shadowCameraNear:1,shadowCameraFar:1e3};break}return n[e.id]=t,t}}}let Dm=0;function Lm(n,e){return(e.castShadow?2:0)-(n.castShadow?2:0)+(e.map?1:0)-(n.map?1:0)}function Im(n){const e=new Rm,t=Pm(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)i.probe.push(new C);const s=new C,r=new Je,a=new Je;function o(c){let d=0,f=0,u=0;for(let w=0;w<9;w++)i.probe[w].set(0,0,0);let m=0,g=0,S=0,p=0,h=0,x=0,E=0,M=0,b=0,T=0,R=0;c.sort(Lm);for(let w=0,P=c.length;w<P;w++){const D=c[w],F=D.color,W=D.intensity,Z=D.distance;let O=null;if(D.shadow&&D.shadow.map&&(D.shadow.map.texture.format===sn?O=D.shadow.map.texture:O=D.shadow.map.depthTexture||D.shadow.map.texture),D.isAmbientLight)d+=F.r*W,f+=F.g*W,u+=F.b*W;else if(D.isLightProbe){for(let $=0;$<9;$++)i.probe[$].addScaledVector(D.sh.coefficients[$],W);R++}else if(D.isDirectionalLight){const $=e.get(D);if($.color.copy(D.color).multiplyScalar(D.intensity),D.castShadow){const k=D.shadow,J=t.get(D);J.shadowIntensity=k.intensity,J.shadowBias=k.bias,J.shadowNormalBias=k.normalBias,J.shadowRadius=k.radius,J.shadowMapSize=k.mapSize,i.directionalShadow[m]=J,i.directionalShadowMap[m]=O,i.directionalShadowMatrix[m]=D.shadow.matrix,x++}i.directional[m]=$,m++}else if(D.isSpotLight){const $=e.get(D);$.position.setFromMatrixPosition(D.matrixWorld),$.color.copy(F).multiplyScalar(W),$.distance=Z,$.coneCos=Math.cos(D.angle),$.penumbraCos=Math.cos(D.angle*(1-D.penumbra)),$.decay=D.decay,i.spot[S]=$;const k=D.shadow;if(D.map&&(i.spotLightMap[b]=D.map,b++,k.updateMatrices(D),D.castShadow&&T++),i.spotLightMatrix[S]=k.matrix,D.castShadow){const J=t.get(D);J.shadowIntensity=k.intensity,J.shadowBias=k.bias,J.shadowNormalBias=k.normalBias,J.shadowRadius=k.radius,J.shadowMapSize=k.mapSize,i.spotShadow[S]=J,i.spotShadowMap[S]=O,M++}S++}else if(D.isRectAreaLight){const $=e.get(D);$.color.copy(F).multiplyScalar(W),$.halfWidth.set(D.width*.5,0,0),$.halfHeight.set(0,D.height*.5,0),i.rectArea[p]=$,p++}else if(D.isPointLight){const $=e.get(D);if($.color.copy(D.color).multiplyScalar(D.intensity),$.distance=D.distance,$.decay=D.decay,D.castShadow){const k=D.shadow,J=t.get(D);J.shadowIntensity=k.intensity,J.shadowBias=k.bias,J.shadowNormalBias=k.normalBias,J.shadowRadius=k.radius,J.shadowMapSize=k.mapSize,J.shadowCameraNear=k.camera.near,J.shadowCameraFar=k.camera.far,i.pointShadow[g]=J,i.pointShadowMap[g]=O,i.pointShadowMatrix[g]=D.shadow.matrix,E++}i.point[g]=$,g++}else if(D.isHemisphereLight){const $=e.get(D);$.skyColor.copy(D.color).multiplyScalar(W),$.groundColor.copy(D.groundColor).multiplyScalar(W),i.hemi[h]=$,h++}}p>0&&(n.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=de.LTC_FLOAT_1,i.rectAreaLTC2=de.LTC_FLOAT_2):(i.rectAreaLTC1=de.LTC_HALF_1,i.rectAreaLTC2=de.LTC_HALF_2)),i.ambient[0]=d,i.ambient[1]=f,i.ambient[2]=u;const _=i.hash;(_.directionalLength!==m||_.pointLength!==g||_.spotLength!==S||_.rectAreaLength!==p||_.hemiLength!==h||_.numDirectionalShadows!==x||_.numPointShadows!==E||_.numSpotShadows!==M||_.numSpotMaps!==b||_.numLightProbes!==R)&&(i.directional.length=m,i.spot.length=S,i.rectArea.length=p,i.point.length=g,i.hemi.length=h,i.directionalShadow.length=x,i.directionalShadowMap.length=x,i.pointShadow.length=E,i.pointShadowMap.length=E,i.spotShadow.length=M,i.spotShadowMap.length=M,i.directionalShadowMatrix.length=x,i.pointShadowMatrix.length=E,i.spotLightMatrix.length=M+b-T,i.spotLightMap.length=b,i.numSpotLightShadowsWithMaps=T,i.numLightProbes=R,_.directionalLength=m,_.pointLength=g,_.spotLength=S,_.rectAreaLength=p,_.hemiLength=h,_.numDirectionalShadows=x,_.numPointShadows=E,_.numSpotShadows=M,_.numSpotMaps=b,_.numLightProbes=R,i.version=Dm++)}function l(c,d){let f=0,u=0,m=0,g=0,S=0;const p=d.matrixWorldInverse;for(let h=0,x=c.length;h<x;h++){const E=c[h];if(E.isDirectionalLight){const M=i.directional[f];M.direction.setFromMatrixPosition(E.matrixWorld),s.setFromMatrixPosition(E.target.matrixWorld),M.direction.sub(s),M.direction.transformDirection(p),f++}else if(E.isSpotLight){const M=i.spot[m];M.position.setFromMatrixPosition(E.matrixWorld),M.position.applyMatrix4(p),M.direction.setFromMatrixPosition(E.matrixWorld),s.setFromMatrixPosition(E.target.matrixWorld),M.direction.sub(s),M.direction.transformDirection(p),m++}else if(E.isRectAreaLight){const M=i.rectArea[g];M.position.setFromMatrixPosition(E.matrixWorld),M.position.applyMatrix4(p),a.identity(),r.copy(E.matrixWorld),r.premultiply(p),a.extractRotation(r),M.halfWidth.set(E.width*.5,0,0),M.halfHeight.set(0,E.height*.5,0),M.halfWidth.applyMatrix4(a),M.halfHeight.applyMatrix4(a),g++}else if(E.isPointLight){const M=i.point[u];M.position.setFromMatrixPosition(E.matrixWorld),M.position.applyMatrix4(p),u++}else if(E.isHemisphereLight){const M=i.hemi[S];M.direction.setFromMatrixPosition(E.matrixWorld),M.direction.transformDirection(p),S++}}}return{setup:o,setupView:l,state:i}}function Al(n){const e=new Im(n),t=[],i=[],s=[];function r(u){f.camera=u,t.length=0,i.length=0,s.length=0}function a(u){t.push(u)}function o(u){i.push(u)}function l(u){s.push(u)}function c(){e.setup(t)}function d(u){e.setupView(t,u)}const f={lightsArray:t,shadowsArray:i,lightProbeGridArray:s,camera:null,lights:e,transmissionRenderTarget:{},textureUnits:0};return{init:r,state:f,setupLights:c,setupLightsView:d,pushLight:a,pushShadow:o,pushLightProbeGrid:l}}function Um(n){let e=new WeakMap;function t(s,r=0){const a=e.get(s);let o;return a===void 0?(o=new Al(n),e.set(s,[o])):r>=a.length?(o=new Al(n),a.push(o)):o=a[r],o}function i(){e=new WeakMap}return{get:t,dispose:i}}const Fm=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Nm=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,Om=[new C(1,0,0),new C(-1,0,0),new C(0,1,0),new C(0,-1,0),new C(0,0,1),new C(0,0,-1)],Bm=[new C(0,-1,0),new C(0,-1,0),new C(0,0,1),new C(0,0,-1),new C(0,-1,0),new C(0,-1,0)],Cl=new Je,Yn=new C,zr=new C;function zm(n,e,t){let i=new lo;const s=new Re,r=new Re,a=new ot,o=new Wu,l=new Xu,c={},d=t.maxTextureSize,f={[_i]:Ot,[Ot]:_i,[Ft]:Ft},u=new st({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Re},radius:{value:4}},vertexShader:Fm,fragmentShader:Nm}),m=u.clone();m.defines.HORIZONTAL_PASS=1;const g=new Tt;g.setAttribute("position",new xt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const S=new He(g,u),p=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=jn;let h=this.type;this.render=function(T,R,_){if(p.enabled===!1||p.autoUpdate===!1&&p.needsUpdate===!1||T.length===0)return;this.type===Ic&&(Ie("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."),this.type=jn);const w=n.getRenderTarget(),P=n.getActiveCubeFace(),D=n.getActiveMipmapLevel(),F=n.state;F.setBlending(mi),F.buffers.depth.getReversed()===!0?F.buffers.color.setClear(0,0,0,0):F.buffers.color.setClear(1,1,1,1),F.buffers.depth.setTest(!0),F.setScissorTest(!1);const W=h!==this.type;W&&R.traverse(function(Z){Z.material&&(Array.isArray(Z.material)?Z.material.forEach(O=>O.needsUpdate=!0):Z.material.needsUpdate=!0)});for(let Z=0,O=T.length;Z<O;Z++){const $=T[Z],k=$.shadow;if(k===void 0){Ie("WebGLShadowMap:",$,"has no shadow.");continue}if(k.autoUpdate===!1&&k.needsUpdate===!1)continue;s.copy(k.mapSize);const J=k.getFrameExtents();s.multiply(J),r.copy(k.mapSize),(s.x>d||s.y>d)&&(s.x>d&&(r.x=Math.floor(d/J.x),s.x=r.x*J.x,k.mapSize.x=r.x),s.y>d&&(r.y=Math.floor(d/J.y),s.y=r.y*J.y,k.mapSize.y=r.y));const ee=n.state.buffers.depth.getReversed();if(k.camera._reversedDepth=ee,k.map===null||W===!0){if(k.map!==null&&(k.map.depthTexture!==null&&(k.map.depthTexture.dispose(),k.map.depthTexture=null),k.map.dispose()),this.type===Jn){if($.isPointLight){Ie("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}k.map=new Wt(s.x,s.y,{format:sn,type:Jt,minFilter:Nt,magFilter:Nt,generateMipmaps:!1}),k.map.texture.name=$.name+".shadowMap",k.map.depthTexture=new In(s.x,s.y,ai),k.map.depthTexture.name=$.name+".shadowMapDepth",k.map.depthTexture.format=Ri,k.map.depthTexture.compareFunction=null,k.map.depthTexture.minFilter=Pt,k.map.depthTexture.magFilter=Pt}else $.isPointLight?(k.map=new cc(s.x),k.map.depthTexture=new zu(s.x,xi)):(k.map=new Wt(s.x,s.y),k.map.depthTexture=new In(s.x,s.y,xi)),k.map.depthTexture.name=$.name+".shadowMap",k.map.depthTexture.format=Ri,this.type===jn?(k.map.depthTexture.compareFunction=ee?no:io,k.map.depthTexture.minFilter=Nt,k.map.depthTexture.magFilter=Nt):(k.map.depthTexture.compareFunction=null,k.map.depthTexture.minFilter=Pt,k.map.depthTexture.magFilter=Pt);k.camera.updateProjectionMatrix()}const ae=k.map.isWebGLCubeRenderTarget?6:1;for(let ie=0;ie<ae;ie++){if(k.map.isWebGLCubeRenderTarget)n.setRenderTarget(k.map,ie),n.clear();else{ie===0&&(n.setRenderTarget(k.map),n.clear());const ve=k.getViewport(ie);a.set(r.x*ve.x,r.y*ve.y,r.x*ve.z,r.y*ve.w),F.viewport(a)}if($.isPointLight){const ve=k.camera,Ae=k.matrix,Qe=$.distance||ve.far;Qe!==ve.far&&(ve.far=Qe,ve.updateProjectionMatrix()),Yn.setFromMatrixPosition($.matrixWorld),ve.position.copy(Yn),zr.copy(ve.position),zr.add(Om[ie]),ve.up.copy(Bm[ie]),ve.lookAt(zr),ve.updateMatrixWorld(),Ae.makeTranslation(-Yn.x,-Yn.y,-Yn.z),Cl.multiplyMatrices(ve.projectionMatrix,ve.matrixWorldInverse),k._frustum.setFromProjectionMatrix(Cl,ve.coordinateSystem,ve.reversedDepth)}else k.updateMatrices($);i=k.getFrustum(),M(R,_,k.camera,$,this.type)}k.isPointLightShadow!==!0&&this.type===Jn&&x(k,_),k.needsUpdate=!1}h=this.type,p.needsUpdate=!1,n.setRenderTarget(w,P,D)};function x(T,R){const _=e.update(S);u.defines.VSM_SAMPLES!==T.blurSamples&&(u.defines.VSM_SAMPLES=T.blurSamples,m.defines.VSM_SAMPLES=T.blurSamples,u.needsUpdate=!0,m.needsUpdate=!0),T.mapPass===null&&(T.mapPass=new Wt(s.x,s.y,{format:sn,type:Jt})),u.uniforms.shadow_pass.value=T.map.depthTexture,u.uniforms.resolution.value=T.mapSize,u.uniforms.radius.value=T.radius,n.setRenderTarget(T.mapPass),n.clear(),n.renderBufferDirect(R,null,_,u,S,null),m.uniforms.shadow_pass.value=T.mapPass.texture,m.uniforms.resolution.value=T.mapSize,m.uniforms.radius.value=T.radius,n.setRenderTarget(T.map),n.clear(),n.renderBufferDirect(R,null,_,m,S,null)}function E(T,R,_,w){let P=null;const D=_.isPointLight===!0?T.customDistanceMaterial:T.customDepthMaterial;if(D!==void 0)P=D;else if(P=_.isPointLight===!0?l:o,n.localClippingEnabled&&R.clipShadows===!0&&Array.isArray(R.clippingPlanes)&&R.clippingPlanes.length!==0||R.displacementMap&&R.displacementScale!==0||R.alphaMap&&R.alphaTest>0||R.map&&R.alphaTest>0||R.alphaToCoverage===!0){const F=P.uuid,W=R.uuid;let Z=c[F];Z===void 0&&(Z={},c[F]=Z);let O=Z[W];O===void 0&&(O=P.clone(),Z[W]=O,R.addEventListener("dispose",b)),P=O}if(P.visible=R.visible,P.wireframe=R.wireframe,w===Jn?P.side=R.shadowSide!==null?R.shadowSide:R.side:P.side=R.shadowSide!==null?R.shadowSide:f[R.side],P.alphaMap=R.alphaMap,P.alphaTest=R.alphaToCoverage===!0?.5:R.alphaTest,P.map=R.map,P.clipShadows=R.clipShadows,P.clippingPlanes=R.clippingPlanes,P.clipIntersection=R.clipIntersection,P.displacementMap=R.displacementMap,P.displacementScale=R.displacementScale,P.displacementBias=R.displacementBias,P.wireframeLinewidth=R.wireframeLinewidth,P.linewidth=R.linewidth,_.isPointLight===!0&&P.isMeshDistanceMaterial===!0){const F=n.properties.get(P);F.light=_}return P}function M(T,R,_,w,P){if(T.visible===!1)return;if(T.layers.test(R.layers)&&(T.isMesh||T.isLine||T.isPoints)&&(T.castShadow||T.receiveShadow&&P===Jn)&&(!T.frustumCulled||i.intersectsObject(T))){T.modelViewMatrix.multiplyMatrices(_.matrixWorldInverse,T.matrixWorld);const W=e.update(T),Z=T.material;if(Array.isArray(Z)){const O=W.groups;for(let $=0,k=O.length;$<k;$++){const J=O[$],ee=Z[J.materialIndex];if(ee&&ee.visible){const ae=E(T,ee,w,P);T.onBeforeShadow(n,T,R,_,W,ae,J),n.renderBufferDirect(_,null,W,ae,T,J),T.onAfterShadow(n,T,R,_,W,ae,J)}}}else if(Z.visible){const O=E(T,Z,w,P);T.onBeforeShadow(n,T,R,_,W,O,null),n.renderBufferDirect(_,null,W,O,T,null),T.onAfterShadow(n,T,R,_,W,O,null)}}const F=T.children;for(let W=0,Z=F.length;W<Z;W++)M(F[W],R,_,w,P)}function b(T){T.target.removeEventListener("dispose",b);for(const _ in c){const w=c[_],P=T.target.uuid;P in w&&(w[P].dispose(),delete w[P])}}}function km(n,e){function t(){let L=!1;const re=new ot;let Y=null;const ue=new ot(0,0,0,0);return{setMask:function(me){Y!==me&&!L&&(n.colorMask(me,me,me,me),Y=me)},setLocked:function(me){L=me},setClear:function(me,Q,Me,xe,ct){ct===!0&&(me*=xe,Q*=xe,Me*=xe),re.set(me,Q,Me,xe),ue.equals(re)===!1&&(n.clearColor(me,Q,Me,xe),ue.copy(re))},reset:function(){L=!1,Y=null,ue.set(-1,0,0,0)}}}function i(){let L=!1,re=!1,Y=null,ue=null,me=null;return{setReversed:function(Q){if(re!==Q){const Me=e.get("EXT_clip_control");Q?Me.clipControlEXT(Me.LOWER_LEFT_EXT,Me.ZERO_TO_ONE_EXT):Me.clipControlEXT(Me.LOWER_LEFT_EXT,Me.NEGATIVE_ONE_TO_ONE_EXT),re=Q;const xe=me;me=null,this.setClear(xe)}},getReversed:function(){return re},setTest:function(Q){Q?j(n.DEPTH_TEST):Pe(n.DEPTH_TEST)},setMask:function(Q){Y!==Q&&!L&&(n.depthMask(Q),Y=Q)},setFunc:function(Q){if(re&&(Q=du[Q]),ue!==Q){switch(Q){case qr:n.depthFunc(n.NEVER);break;case Yr:n.depthFunc(n.ALWAYS);break;case Kr:n.depthFunc(n.LESS);break;case Dn:n.depthFunc(n.LEQUAL);break;case Zr:n.depthFunc(n.EQUAL);break;case Jr:n.depthFunc(n.GEQUAL);break;case Qr:n.depthFunc(n.GREATER);break;case jr:n.depthFunc(n.NOTEQUAL);break;default:n.depthFunc(n.LEQUAL)}ue=Q}},setLocked:function(Q){L=Q},setClear:function(Q){me!==Q&&(me=Q,re&&(Q=1-Q),n.clearDepth(Q))},reset:function(){L=!1,Y=null,ue=null,me=null,re=!1}}}function s(){let L=!1,re=null,Y=null,ue=null,me=null,Q=null,Me=null,xe=null,ct=null;return{setTest:function(rt){L||(rt?j(n.STENCIL_TEST):Pe(n.STENCIL_TEST))},setMask:function(rt){re!==rt&&!L&&(n.stencilMask(rt),re=rt)},setFunc:function(rt,li,ci){(Y!==rt||ue!==li||me!==ci)&&(n.stencilFunc(rt,li,ci),Y=rt,ue=li,me=ci)},setOp:function(rt,li,ci){(Q!==rt||Me!==li||xe!==ci)&&(n.stencilOp(rt,li,ci),Q=rt,Me=li,xe=ci)},setLocked:function(rt){L=rt},setClear:function(rt){ct!==rt&&(n.clearStencil(rt),ct=rt)},reset:function(){L=!1,re=null,Y=null,ue=null,me=null,Q=null,Me=null,xe=null,ct=null}}}const r=new t,a=new i,o=new s,l=new WeakMap,c=new WeakMap;let d={},f={},u={},m=new WeakMap,g=[],S=null,p=!1,h=null,x=null,E=null,M=null,b=null,T=null,R=null,_=new te(0,0,0),w=0,P=!1,D=null,F=null,W=null,Z=null,O=null;const $=n.getParameter(n.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let k=!1,J=0;const ee=n.getParameter(n.VERSION);ee.indexOf("WebGL")!==-1?(J=parseFloat(/^WebGL (\d)/.exec(ee)[1]),k=J>=1):ee.indexOf("OpenGL ES")!==-1&&(J=parseFloat(/^OpenGL ES (\d)/.exec(ee)[1]),k=J>=2);let ae=null,ie={};const ve=n.getParameter(n.SCISSOR_BOX),Ae=n.getParameter(n.VIEWPORT),Qe=new ot().fromArray(ve),We=new ot().fromArray(Ae);function q(L,re,Y,ue){const me=new Uint8Array(4),Q=n.createTexture();n.bindTexture(L,Q),n.texParameteri(L,n.TEXTURE_MIN_FILTER,n.NEAREST),n.texParameteri(L,n.TEXTURE_MAG_FILTER,n.NEAREST);for(let Me=0;Me<Y;Me++)L===n.TEXTURE_3D||L===n.TEXTURE_2D_ARRAY?n.texImage3D(re,0,n.RGBA,1,1,ue,0,n.RGBA,n.UNSIGNED_BYTE,me):n.texImage2D(re+Me,0,n.RGBA,1,1,0,n.RGBA,n.UNSIGNED_BYTE,me);return Q}const se={};se[n.TEXTURE_2D]=q(n.TEXTURE_2D,n.TEXTURE_2D,1),se[n.TEXTURE_CUBE_MAP]=q(n.TEXTURE_CUBE_MAP,n.TEXTURE_CUBE_MAP_POSITIVE_X,6),se[n.TEXTURE_2D_ARRAY]=q(n.TEXTURE_2D_ARRAY,n.TEXTURE_2D_ARRAY,1,1),se[n.TEXTURE_3D]=q(n.TEXTURE_3D,n.TEXTURE_3D,1,1),r.setClear(0,0,0,1),a.setClear(1),o.setClear(0),j(n.DEPTH_TEST),a.setFunc(Dn),gt(!1),Mt(To),j(n.CULL_FACE),Ke(mi);function j(L){d[L]!==!0&&(n.enable(L),d[L]=!0)}function Pe(L){d[L]!==!1&&(n.disable(L),d[L]=!1)}function Fe(L,re){return u[L]!==re?(n.bindFramebuffer(L,re),u[L]=re,L===n.DRAW_FRAMEBUFFER&&(u[n.FRAMEBUFFER]=re),L===n.FRAMEBUFFER&&(u[n.DRAW_FRAMEBUFFER]=re),!0):!1}function De(L,re){let Y=g,ue=!1;if(L){Y=m.get(re),Y===void 0&&(Y=[],m.set(re,Y));const me=L.textures;if(Y.length!==me.length||Y[0]!==n.COLOR_ATTACHMENT0){for(let Q=0,Me=me.length;Q<Me;Q++)Y[Q]=n.COLOR_ATTACHMENT0+Q;Y.length=me.length,ue=!0}}else Y[0]!==n.BACK&&(Y[0]=n.BACK,ue=!0);ue&&n.drawBuffers(Y)}function ht(L){return S!==L?(n.useProgram(L),S=L,!0):!1}const ke={[Qi]:n.FUNC_ADD,[Fc]:n.FUNC_SUBTRACT,[Nc]:n.FUNC_REVERSE_SUBTRACT};ke[Oc]=n.MIN,ke[Bc]=n.MAX;const tt={[zc]:n.ZERO,[kc]:n.ONE,[Vc]:n.SRC_COLOR,[Xr]:n.SRC_ALPHA,[qc]:n.SRC_ALPHA_SATURATE,[Xc]:n.DST_COLOR,[Hc]:n.DST_ALPHA,[Gc]:n.ONE_MINUS_SRC_COLOR,[$r]:n.ONE_MINUS_SRC_ALPHA,[$c]:n.ONE_MINUS_DST_COLOR,[Wc]:n.ONE_MINUS_DST_ALPHA,[Yc]:n.CONSTANT_COLOR,[Kc]:n.ONE_MINUS_CONSTANT_COLOR,[Zc]:n.CONSTANT_ALPHA,[Jc]:n.ONE_MINUS_CONSTANT_ALPHA};function Ke(L,re,Y,ue,me,Q,Me,xe,ct,rt){if(L===mi){p===!0&&(Pe(n.BLEND),p=!1);return}if(p===!1&&(j(n.BLEND),p=!0),L!==Uc){if(L!==h||rt!==P){if((x!==Qi||b!==Qi)&&(n.blendEquation(n.FUNC_ADD),x=Qi,b=Qi),rt)switch(L){case Hi:n.blendFuncSeparate(n.ONE,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case Qt:n.blendFunc(n.ONE,n.ONE);break;case Ao:n.blendFuncSeparate(n.ZERO,n.ONE_MINUS_SRC_COLOR,n.ZERO,n.ONE);break;case Co:n.blendFuncSeparate(n.DST_COLOR,n.ONE_MINUS_SRC_ALPHA,n.ZERO,n.ONE);break;default:Xe("WebGLState: Invalid blending: ",L);break}else switch(L){case Hi:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case Qt:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE,n.ONE,n.ONE);break;case Ao:Xe("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Co:Xe("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Xe("WebGLState: Invalid blending: ",L);break}E=null,M=null,T=null,R=null,_.set(0,0,0),w=0,h=L,P=rt}return}me=me||re,Q=Q||Y,Me=Me||ue,(re!==x||me!==b)&&(n.blendEquationSeparate(ke[re],ke[me]),x=re,b=me),(Y!==E||ue!==M||Q!==T||Me!==R)&&(n.blendFuncSeparate(tt[Y],tt[ue],tt[Q],tt[Me]),E=Y,M=ue,T=Q,R=Me),(xe.equals(_)===!1||ct!==w)&&(n.blendColor(xe.r,xe.g,xe.b,ct),_.copy(xe),w=ct),h=L,P=!1}function $e(L,re){L.side===Ft?Pe(n.CULL_FACE):j(n.CULL_FACE);let Y=L.side===Ot;re&&(Y=!Y),gt(Y),L.blending===Hi&&L.transparent===!1?Ke(mi):Ke(L.blending,L.blendEquation,L.blendSrc,L.blendDst,L.blendEquationAlpha,L.blendSrcAlpha,L.blendDstAlpha,L.blendColor,L.blendAlpha,L.premultipliedAlpha),a.setFunc(L.depthFunc),a.setTest(L.depthTest),a.setMask(L.depthWrite),r.setMask(L.colorWrite);const ue=L.stencilWrite;o.setTest(ue),ue&&(o.setMask(L.stencilWriteMask),o.setFunc(L.stencilFunc,L.stencilRef,L.stencilFuncMask),o.setOp(L.stencilFail,L.stencilZFail,L.stencilZPass)),Rt(L.polygonOffset,L.polygonOffsetFactor,L.polygonOffsetUnits),L.alphaToCoverage===!0?j(n.SAMPLE_ALPHA_TO_COVERAGE):Pe(n.SAMPLE_ALPHA_TO_COVERAGE)}function gt(L){D!==L&&(L?n.frontFace(n.CW):n.frontFace(n.CCW),D=L)}function Mt(L){L!==Dc?(j(n.CULL_FACE),L!==F&&(L===To?n.cullFace(n.BACK):L===Lc?n.cullFace(n.FRONT):n.cullFace(n.FRONT_AND_BACK))):Pe(n.CULL_FACE),F=L}function At(L){L!==W&&(k&&n.lineWidth(L),W=L)}function Rt(L,re,Y){L?(j(n.POLYGON_OFFSET_FILL),(Z!==re||O!==Y)&&(Z=re,O=Y,a.getReversed()&&(re=-re),n.polygonOffset(re,Y))):Pe(n.POLYGON_OFFSET_FILL)}function lt(L){L?j(n.SCISSOR_TEST):Pe(n.SCISSOR_TEST)}function vt(L){L===void 0&&(L=n.TEXTURE0+$-1),ae!==L&&(n.activeTexture(L),ae=L)}function I(L,re,Y){Y===void 0&&(ae===null?Y=n.TEXTURE0+$-1:Y=ae);let ue=ie[Y];ue===void 0&&(ue={type:void 0,texture:void 0},ie[Y]=ue),(ue.type!==L||ue.texture!==re)&&(ae!==Y&&(n.activeTexture(Y),ae=Y),n.bindTexture(L,re||se[L]),ue.type=L,ue.texture=re)}function Vt(){const L=ie[ae];L!==void 0&&L.type!==void 0&&(n.bindTexture(L.type,null),L.type=void 0,L.texture=void 0)}function je(){try{n.compressedTexImage2D(...arguments)}catch(L){Xe("WebGLState:",L)}}function A(){try{n.compressedTexImage3D(...arguments)}catch(L){Xe("WebGLState:",L)}}function v(){try{n.texSubImage2D(...arguments)}catch(L){Xe("WebGLState:",L)}}function N(){try{n.texSubImage3D(...arguments)}catch(L){Xe("WebGLState:",L)}}function V(){try{n.compressedTexSubImage2D(...arguments)}catch(L){Xe("WebGLState:",L)}}function H(){try{n.compressedTexSubImage3D(...arguments)}catch(L){Xe("WebGLState:",L)}}function ne(){try{n.texStorage2D(...arguments)}catch(L){Xe("WebGLState:",L)}}function oe(){try{n.texStorage3D(...arguments)}catch(L){Xe("WebGLState:",L)}}function X(){try{n.texImage2D(...arguments)}catch(L){Xe("WebGLState:",L)}}function K(){try{n.texImage3D(...arguments)}catch(L){Xe("WebGLState:",L)}}function le(L){return f[L]!==void 0?f[L]:n.getParameter(L)}function be(L,re){f[L]!==re&&(n.pixelStorei(L,re),f[L]=re)}function he(L){Qe.equals(L)===!1&&(n.scissor(L.x,L.y,L.z,L.w),Qe.copy(L))}function ce(L){We.equals(L)===!1&&(n.viewport(L.x,L.y,L.z,L.w),We.copy(L))}function Ce(L,re){let Y=c.get(re);Y===void 0&&(Y=new WeakMap,c.set(re,Y));let ue=Y.get(L);ue===void 0&&(ue=n.getUniformBlockIndex(re,L.name),Y.set(L,ue))}function Le(L,re){const ue=c.get(re).get(L);l.get(re)!==ue&&(n.uniformBlockBinding(re,ue,L.__bindingPointIndex),l.set(re,ue))}function Ne(){n.disable(n.BLEND),n.disable(n.CULL_FACE),n.disable(n.DEPTH_TEST),n.disable(n.POLYGON_OFFSET_FILL),n.disable(n.SCISSOR_TEST),n.disable(n.STENCIL_TEST),n.disable(n.SAMPLE_ALPHA_TO_COVERAGE),n.blendEquation(n.FUNC_ADD),n.blendFunc(n.ONE,n.ZERO),n.blendFuncSeparate(n.ONE,n.ZERO,n.ONE,n.ZERO),n.blendColor(0,0,0,0),n.colorMask(!0,!0,!0,!0),n.clearColor(0,0,0,0),n.depthMask(!0),n.depthFunc(n.LESS),a.setReversed(!1),n.clearDepth(1),n.stencilMask(4294967295),n.stencilFunc(n.ALWAYS,0,4294967295),n.stencilOp(n.KEEP,n.KEEP,n.KEEP),n.clearStencil(0),n.cullFace(n.BACK),n.frontFace(n.CCW),n.polygonOffset(0,0),n.activeTexture(n.TEXTURE0),n.bindFramebuffer(n.FRAMEBUFFER,null),n.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),n.bindFramebuffer(n.READ_FRAMEBUFFER,null),n.useProgram(null),n.lineWidth(1),n.scissor(0,0,n.canvas.width,n.canvas.height),n.viewport(0,0,n.canvas.width,n.canvas.height),n.pixelStorei(n.PACK_ALIGNMENT,4),n.pixelStorei(n.UNPACK_ALIGNMENT,4),n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,!1),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,n.BROWSER_DEFAULT_WEBGL),n.pixelStorei(n.PACK_ROW_LENGTH,0),n.pixelStorei(n.PACK_SKIP_PIXELS,0),n.pixelStorei(n.PACK_SKIP_ROWS,0),n.pixelStorei(n.UNPACK_ROW_LENGTH,0),n.pixelStorei(n.UNPACK_IMAGE_HEIGHT,0),n.pixelStorei(n.UNPACK_SKIP_PIXELS,0),n.pixelStorei(n.UNPACK_SKIP_ROWS,0),n.pixelStorei(n.UNPACK_SKIP_IMAGES,0),d={},f={},ae=null,ie={},u={},m=new WeakMap,g=[],S=null,p=!1,h=null,x=null,E=null,M=null,b=null,T=null,R=null,_=new te(0,0,0),w=0,P=!1,D=null,F=null,W=null,Z=null,O=null,Qe.set(0,0,n.canvas.width,n.canvas.height),We.set(0,0,n.canvas.width,n.canvas.height),r.reset(),a.reset(),o.reset()}return{buffers:{color:r,depth:a,stencil:o},enable:j,disable:Pe,bindFramebuffer:Fe,drawBuffers:De,useProgram:ht,setBlending:Ke,setMaterial:$e,setFlipSided:gt,setCullFace:Mt,setLineWidth:At,setPolygonOffset:Rt,setScissorTest:lt,activeTexture:vt,bindTexture:I,unbindTexture:Vt,compressedTexImage2D:je,compressedTexImage3D:A,texImage2D:X,texImage3D:K,pixelStorei:be,getParameter:le,updateUBOMapping:Ce,uniformBlockBinding:Le,texStorage2D:ne,texStorage3D:oe,texSubImage2D:v,texSubImage3D:N,compressedTexSubImage2D:V,compressedTexSubImage3D:H,scissor:he,viewport:ce,reset:Ne}}function Vm(n,e,t,i,s,r,a){const o=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new Re,d=new WeakMap,f=new Set;let u;const m=new WeakMap;let g=!1;try{g=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function S(A,v){return g?new OffscreenCanvas(A,v):Ks("canvas")}function p(A,v,N){let V=1;const H=je(A);if((H.width>N||H.height>N)&&(V=N/Math.max(H.width,H.height)),V<1)if(typeof HTMLImageElement<"u"&&A instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&A instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&A instanceof ImageBitmap||typeof VideoFrame<"u"&&A instanceof VideoFrame){const ne=Math.floor(V*H.width),oe=Math.floor(V*H.height);u===void 0&&(u=S(ne,oe));const X=v?S(ne,oe):u;return X.width=ne,X.height=oe,X.getContext("2d").drawImage(A,0,0,ne,oe),Ie("WebGLRenderer: Texture has been resized from ("+H.width+"x"+H.height+") to ("+ne+"x"+oe+")."),X}else return"data"in A&&Ie("WebGLRenderer: Image in DataTexture is too big ("+H.width+"x"+H.height+")."),A;return A}function h(A){return A.generateMipmaps}function x(A){n.generateMipmap(A)}function E(A){return A.isWebGLCubeRenderTarget?n.TEXTURE_CUBE_MAP:A.isWebGL3DRenderTarget?n.TEXTURE_3D:A.isWebGLArrayRenderTarget||A.isCompressedArrayTexture?n.TEXTURE_2D_ARRAY:n.TEXTURE_2D}function M(A,v,N,V,H,ne=!1){if(A!==null){if(n[A]!==void 0)return n[A];Ie("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+A+"'")}let oe;V&&(oe=e.get("EXT_texture_norm16"),oe||Ie("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let X=v;if(v===n.RED&&(N===n.FLOAT&&(X=n.R32F),N===n.HALF_FLOAT&&(X=n.R16F),N===n.UNSIGNED_BYTE&&(X=n.R8),N===n.UNSIGNED_SHORT&&oe&&(X=oe.R16_EXT),N===n.SHORT&&oe&&(X=oe.R16_SNORM_EXT)),v===n.RED_INTEGER&&(N===n.UNSIGNED_BYTE&&(X=n.R8UI),N===n.UNSIGNED_SHORT&&(X=n.R16UI),N===n.UNSIGNED_INT&&(X=n.R32UI),N===n.BYTE&&(X=n.R8I),N===n.SHORT&&(X=n.R16I),N===n.INT&&(X=n.R32I)),v===n.RG&&(N===n.FLOAT&&(X=n.RG32F),N===n.HALF_FLOAT&&(X=n.RG16F),N===n.UNSIGNED_BYTE&&(X=n.RG8),N===n.UNSIGNED_SHORT&&oe&&(X=oe.RG16_EXT),N===n.SHORT&&oe&&(X=oe.RG16_SNORM_EXT)),v===n.RG_INTEGER&&(N===n.UNSIGNED_BYTE&&(X=n.RG8UI),N===n.UNSIGNED_SHORT&&(X=n.RG16UI),N===n.UNSIGNED_INT&&(X=n.RG32UI),N===n.BYTE&&(X=n.RG8I),N===n.SHORT&&(X=n.RG16I),N===n.INT&&(X=n.RG32I)),v===n.RGB_INTEGER&&(N===n.UNSIGNED_BYTE&&(X=n.RGB8UI),N===n.UNSIGNED_SHORT&&(X=n.RGB16UI),N===n.UNSIGNED_INT&&(X=n.RGB32UI),N===n.BYTE&&(X=n.RGB8I),N===n.SHORT&&(X=n.RGB16I),N===n.INT&&(X=n.RGB32I)),v===n.RGBA_INTEGER&&(N===n.UNSIGNED_BYTE&&(X=n.RGBA8UI),N===n.UNSIGNED_SHORT&&(X=n.RGBA16UI),N===n.UNSIGNED_INT&&(X=n.RGBA32UI),N===n.BYTE&&(X=n.RGBA8I),N===n.SHORT&&(X=n.RGBA16I),N===n.INT&&(X=n.RGBA32I)),v===n.RGB&&(N===n.UNSIGNED_SHORT&&oe&&(X=oe.RGB16_EXT),N===n.SHORT&&oe&&(X=oe.RGB16_SNORM_EXT),N===n.UNSIGNED_INT_5_9_9_9_REV&&(X=n.RGB9_E5),N===n.UNSIGNED_INT_10F_11F_11F_REV&&(X=n.R11F_G11F_B10F)),v===n.RGBA){const K=ne?Ys:Ve.getTransfer(H);N===n.FLOAT&&(X=n.RGBA32F),N===n.HALF_FLOAT&&(X=n.RGBA16F),N===n.UNSIGNED_BYTE&&(X=K===Ze?n.SRGB8_ALPHA8:n.RGBA8),N===n.UNSIGNED_SHORT&&oe&&(X=oe.RGBA16_EXT),N===n.SHORT&&oe&&(X=oe.RGBA16_SNORM_EXT),N===n.UNSIGNED_SHORT_4_4_4_4&&(X=n.RGBA4),N===n.UNSIGNED_SHORT_5_5_5_1&&(X=n.RGB5_A1)}return(X===n.R16F||X===n.R32F||X===n.RG16F||X===n.RG32F||X===n.RGBA16F||X===n.RGBA32F)&&e.get("EXT_color_buffer_float"),X}function b(A,v){let N;return A?v===null||v===xi||v===ss?N=n.DEPTH24_STENCIL8:v===ai?N=n.DEPTH32F_STENCIL8:v===ns&&(N=n.DEPTH24_STENCIL8,Ie("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):v===null||v===xi||v===ss?N=n.DEPTH_COMPONENT24:v===ai?N=n.DEPTH_COMPONENT32F:v===ns&&(N=n.DEPTH_COMPONENT16),N}function T(A,v){return h(A)===!0||A.isFramebufferTexture&&A.minFilter!==Pt&&A.minFilter!==Nt?Math.log2(Math.max(v.width,v.height))+1:A.mipmaps!==void 0&&A.mipmaps.length>0?A.mipmaps.length:A.isCompressedTexture&&Array.isArray(A.image)?v.mipmaps.length:1}function R(A){const v=A.target;v.removeEventListener("dispose",R),w(v),v.isVideoTexture&&d.delete(v),v.isHTMLTexture&&f.delete(v)}function _(A){const v=A.target;v.removeEventListener("dispose",_),D(v)}function w(A){const v=i.get(A);if(v.__webglInit===void 0)return;const N=A.source,V=m.get(N);if(V){const H=V[v.__cacheKey];H.usedTimes--,H.usedTimes===0&&P(A),Object.keys(V).length===0&&m.delete(N)}i.remove(A)}function P(A){const v=i.get(A);n.deleteTexture(v.__webglTexture);const N=A.source,V=m.get(N);delete V[v.__cacheKey],a.memory.textures--}function D(A){const v=i.get(A);if(A.depthTexture&&(A.depthTexture.dispose(),i.remove(A.depthTexture)),A.isWebGLCubeRenderTarget)for(let V=0;V<6;V++){if(Array.isArray(v.__webglFramebuffer[V]))for(let H=0;H<v.__webglFramebuffer[V].length;H++)n.deleteFramebuffer(v.__webglFramebuffer[V][H]);else n.deleteFramebuffer(v.__webglFramebuffer[V]);v.__webglDepthbuffer&&n.deleteRenderbuffer(v.__webglDepthbuffer[V])}else{if(Array.isArray(v.__webglFramebuffer))for(let V=0;V<v.__webglFramebuffer.length;V++)n.deleteFramebuffer(v.__webglFramebuffer[V]);else n.deleteFramebuffer(v.__webglFramebuffer);if(v.__webglDepthbuffer&&n.deleteRenderbuffer(v.__webglDepthbuffer),v.__webglMultisampledFramebuffer&&n.deleteFramebuffer(v.__webglMultisampledFramebuffer),v.__webglColorRenderbuffer)for(let V=0;V<v.__webglColorRenderbuffer.length;V++)v.__webglColorRenderbuffer[V]&&n.deleteRenderbuffer(v.__webglColorRenderbuffer[V]);v.__webglDepthRenderbuffer&&n.deleteRenderbuffer(v.__webglDepthRenderbuffer)}const N=A.textures;for(let V=0,H=N.length;V<H;V++){const ne=i.get(N[V]);ne.__webglTexture&&(n.deleteTexture(ne.__webglTexture),a.memory.textures--),i.remove(N[V])}i.remove(A)}let F=0;function W(){F=0}function Z(){return F}function O(A){F=A}function $(){const A=F;return A>=s.maxTextures&&Ie("WebGLTextures: Trying to use "+A+" texture units while this GPU supports only "+s.maxTextures),F+=1,A}function k(A){const v=[];return v.push(A.wrapS),v.push(A.wrapT),v.push(A.wrapR||0),v.push(A.magFilter),v.push(A.minFilter),v.push(A.anisotropy),v.push(A.internalFormat),v.push(A.format),v.push(A.type),v.push(A.generateMipmaps),v.push(A.premultiplyAlpha),v.push(A.flipY),v.push(A.unpackAlignment),v.push(A.colorSpace),v.join()}function J(A,v){const N=i.get(A);if(A.isVideoTexture&&I(A),A.isRenderTargetTexture===!1&&A.isExternalTexture!==!0&&A.version>0&&N.__version!==A.version){const V=A.image;if(V===null)Ie("WebGLRenderer: Texture marked for update but no image data found.");else if(V.complete===!1)Ie("WebGLRenderer: Texture marked for update but image is incomplete");else{Pe(N,A,v);return}}else A.isExternalTexture&&(N.__webglTexture=A.sourceTexture?A.sourceTexture:null);t.bindTexture(n.TEXTURE_2D,N.__webglTexture,n.TEXTURE0+v)}function ee(A,v){const N=i.get(A);if(A.isRenderTargetTexture===!1&&A.version>0&&N.__version!==A.version){Pe(N,A,v);return}else A.isExternalTexture&&(N.__webglTexture=A.sourceTexture?A.sourceTexture:null);t.bindTexture(n.TEXTURE_2D_ARRAY,N.__webglTexture,n.TEXTURE0+v)}function ae(A,v){const N=i.get(A);if(A.isRenderTargetTexture===!1&&A.version>0&&N.__version!==A.version){Pe(N,A,v);return}t.bindTexture(n.TEXTURE_3D,N.__webglTexture,n.TEXTURE0+v)}function ie(A,v){const N=i.get(A);if(A.isCubeDepthTexture!==!0&&A.version>0&&N.__version!==A.version){Fe(N,A,v);return}t.bindTexture(n.TEXTURE_CUBE_MAP,N.__webglTexture,n.TEXTURE0+v)}const ve={[ea]:n.REPEAT,[Ti]:n.CLAMP_TO_EDGE,[ta]:n.MIRRORED_REPEAT},Ae={[Pt]:n.NEAREST,[eu]:n.NEAREST_MIPMAP_NEAREST,[ds]:n.NEAREST_MIPMAP_LINEAR,[Nt]:n.LINEAR,[lr]:n.LINEAR_MIPMAP_NEAREST,[en]:n.LINEAR_MIPMAP_LINEAR},Qe={[nu]:n.NEVER,[lu]:n.ALWAYS,[su]:n.LESS,[io]:n.LEQUAL,[ru]:n.EQUAL,[no]:n.GEQUAL,[au]:n.GREATER,[ou]:n.NOTEQUAL};function We(A,v){if(v.type===ai&&e.has("OES_texture_float_linear")===!1&&(v.magFilter===Nt||v.magFilter===lr||v.magFilter===ds||v.magFilter===en||v.minFilter===Nt||v.minFilter===lr||v.minFilter===ds||v.minFilter===en)&&Ie("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),n.texParameteri(A,n.TEXTURE_WRAP_S,ve[v.wrapS]),n.texParameteri(A,n.TEXTURE_WRAP_T,ve[v.wrapT]),(A===n.TEXTURE_3D||A===n.TEXTURE_2D_ARRAY)&&n.texParameteri(A,n.TEXTURE_WRAP_R,ve[v.wrapR]),n.texParameteri(A,n.TEXTURE_MAG_FILTER,Ae[v.magFilter]),n.texParameteri(A,n.TEXTURE_MIN_FILTER,Ae[v.minFilter]),v.compareFunction&&(n.texParameteri(A,n.TEXTURE_COMPARE_MODE,n.COMPARE_REF_TO_TEXTURE),n.texParameteri(A,n.TEXTURE_COMPARE_FUNC,Qe[v.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(v.magFilter===Pt||v.minFilter!==ds&&v.minFilter!==en||v.type===ai&&e.has("OES_texture_float_linear")===!1)return;if(v.anisotropy>1||i.get(v).__currentAnisotropy){const N=e.get("EXT_texture_filter_anisotropic");n.texParameterf(A,N.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(v.anisotropy,s.getMaxAnisotropy())),i.get(v).__currentAnisotropy=v.anisotropy}}}function q(A,v){let N=!1;A.__webglInit===void 0&&(A.__webglInit=!0,v.addEventListener("dispose",R));const V=v.source;let H=m.get(V);H===void 0&&(H={},m.set(V,H));const ne=k(v);if(ne!==A.__cacheKey){H[ne]===void 0&&(H[ne]={texture:n.createTexture(),usedTimes:0},a.memory.textures++,N=!0),H[ne].usedTimes++;const oe=H[A.__cacheKey];oe!==void 0&&(H[A.__cacheKey].usedTimes--,oe.usedTimes===0&&P(v)),A.__cacheKey=ne,A.__webglTexture=H[ne].texture}return N}function se(A,v,N){return Math.floor(Math.floor(A/N)/v)}function j(A,v,N,V){const ne=A.updateRanges;if(ne.length===0)t.texSubImage2D(n.TEXTURE_2D,0,0,0,v.width,v.height,N,V,v.data);else{ne.sort((be,he)=>be.start-he.start);let oe=0;for(let be=1;be<ne.length;be++){const he=ne[oe],ce=ne[be],Ce=he.start+he.count,Le=se(ce.start,v.width,4),Ne=se(he.start,v.width,4);ce.start<=Ce+1&&Le===Ne&&se(ce.start+ce.count-1,v.width,4)===Le?he.count=Math.max(he.count,ce.start+ce.count-he.start):(++oe,ne[oe]=ce)}ne.length=oe+1;const X=t.getParameter(n.UNPACK_ROW_LENGTH),K=t.getParameter(n.UNPACK_SKIP_PIXELS),le=t.getParameter(n.UNPACK_SKIP_ROWS);t.pixelStorei(n.UNPACK_ROW_LENGTH,v.width);for(let be=0,he=ne.length;be<he;be++){const ce=ne[be],Ce=Math.floor(ce.start/4),Le=Math.ceil(ce.count/4),Ne=Ce%v.width,L=Math.floor(Ce/v.width),re=Le,Y=1;t.pixelStorei(n.UNPACK_SKIP_PIXELS,Ne),t.pixelStorei(n.UNPACK_SKIP_ROWS,L),t.texSubImage2D(n.TEXTURE_2D,0,Ne,L,re,Y,N,V,v.data)}A.clearUpdateRanges(),t.pixelStorei(n.UNPACK_ROW_LENGTH,X),t.pixelStorei(n.UNPACK_SKIP_PIXELS,K),t.pixelStorei(n.UNPACK_SKIP_ROWS,le)}}function Pe(A,v,N){let V=n.TEXTURE_2D;(v.isDataArrayTexture||v.isCompressedArrayTexture)&&(V=n.TEXTURE_2D_ARRAY),v.isData3DTexture&&(V=n.TEXTURE_3D);const H=q(A,v),ne=v.source;t.bindTexture(V,A.__webglTexture,n.TEXTURE0+N);const oe=i.get(ne);if(ne.version!==oe.__version||H===!0){if(t.activeTexture(n.TEXTURE0+N),(typeof ImageBitmap<"u"&&v.image instanceof ImageBitmap)===!1){const Y=Ve.getPrimaries(Ve.workingColorSpace),ue=v.colorSpace===Vi?null:Ve.getPrimaries(v.colorSpace),me=v.colorSpace===Vi||Y===ue?n.NONE:n.BROWSER_DEFAULT_WEBGL;t.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,v.flipY),t.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,v.premultiplyAlpha),t.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,me)}t.pixelStorei(n.UNPACK_ALIGNMENT,v.unpackAlignment);let K=p(v.image,!1,s.maxTextureSize);K=Vt(v,K);const le=r.convert(v.format,v.colorSpace),be=r.convert(v.type);let he=M(v.internalFormat,le,be,v.normalized,v.colorSpace,v.isVideoTexture);We(V,v);let ce;const Ce=v.mipmaps,Le=v.isVideoTexture!==!0,Ne=oe.__version===void 0||H===!0,L=ne.dataReady,re=T(v,K);if(v.isDepthTexture)he=b(v.format===tn,v.type),Ne&&(Le?t.texStorage2D(n.TEXTURE_2D,1,he,K.width,K.height):t.texImage2D(n.TEXTURE_2D,0,he,K.width,K.height,0,le,be,null));else if(v.isDataTexture)if(Ce.length>0){Le&&Ne&&t.texStorage2D(n.TEXTURE_2D,re,he,Ce[0].width,Ce[0].height);for(let Y=0,ue=Ce.length;Y<ue;Y++)ce=Ce[Y],Le?L&&t.texSubImage2D(n.TEXTURE_2D,Y,0,0,ce.width,ce.height,le,be,ce.data):t.texImage2D(n.TEXTURE_2D,Y,he,ce.width,ce.height,0,le,be,ce.data);v.generateMipmaps=!1}else Le?(Ne&&t.texStorage2D(n.TEXTURE_2D,re,he,K.width,K.height),L&&j(v,K,le,be)):t.texImage2D(n.TEXTURE_2D,0,he,K.width,K.height,0,le,be,K.data);else if(v.isCompressedTexture)if(v.isCompressedArrayTexture){Le&&Ne&&t.texStorage3D(n.TEXTURE_2D_ARRAY,re,he,Ce[0].width,Ce[0].height,K.depth);for(let Y=0,ue=Ce.length;Y<ue;Y++)if(ce=Ce[Y],v.format!==oi)if(le!==null)if(Le){if(L)if(v.layerUpdates.size>0){const me=al(ce.width,ce.height,v.format,v.type);for(const Q of v.layerUpdates){const Me=ce.data.subarray(Q*me/ce.data.BYTES_PER_ELEMENT,(Q+1)*me/ce.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,Y,0,0,Q,ce.width,ce.height,1,le,Me)}v.clearLayerUpdates()}else t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,Y,0,0,0,ce.width,ce.height,K.depth,le,ce.data)}else t.compressedTexImage3D(n.TEXTURE_2D_ARRAY,Y,he,ce.width,ce.height,K.depth,0,ce.data,0,0);else Ie("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Le?L&&t.texSubImage3D(n.TEXTURE_2D_ARRAY,Y,0,0,0,ce.width,ce.height,K.depth,le,be,ce.data):t.texImage3D(n.TEXTURE_2D_ARRAY,Y,he,ce.width,ce.height,K.depth,0,le,be,ce.data)}else{Le&&Ne&&t.texStorage2D(n.TEXTURE_2D,re,he,Ce[0].width,Ce[0].height);for(let Y=0,ue=Ce.length;Y<ue;Y++)ce=Ce[Y],v.format!==oi?le!==null?Le?L&&t.compressedTexSubImage2D(n.TEXTURE_2D,Y,0,0,ce.width,ce.height,le,ce.data):t.compressedTexImage2D(n.TEXTURE_2D,Y,he,ce.width,ce.height,0,ce.data):Ie("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Le?L&&t.texSubImage2D(n.TEXTURE_2D,Y,0,0,ce.width,ce.height,le,be,ce.data):t.texImage2D(n.TEXTURE_2D,Y,he,ce.width,ce.height,0,le,be,ce.data)}else if(v.isDataArrayTexture)if(Le){if(Ne&&t.texStorage3D(n.TEXTURE_2D_ARRAY,re,he,K.width,K.height,K.depth),L)if(v.layerUpdates.size>0){const Y=al(K.width,K.height,v.format,v.type);for(const ue of v.layerUpdates){const me=K.data.subarray(ue*Y/K.data.BYTES_PER_ELEMENT,(ue+1)*Y/K.data.BYTES_PER_ELEMENT);t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,ue,K.width,K.height,1,le,be,me)}v.clearLayerUpdates()}else t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,0,K.width,K.height,K.depth,le,be,K.data)}else t.texImage3D(n.TEXTURE_2D_ARRAY,0,he,K.width,K.height,K.depth,0,le,be,K.data);else if(v.isData3DTexture)Le?(Ne&&t.texStorage3D(n.TEXTURE_3D,re,he,K.width,K.height,K.depth),L&&t.texSubImage3D(n.TEXTURE_3D,0,0,0,0,K.width,K.height,K.depth,le,be,K.data)):t.texImage3D(n.TEXTURE_3D,0,he,K.width,K.height,K.depth,0,le,be,K.data);else if(v.isFramebufferTexture){if(Ne)if(Le)t.texStorage2D(n.TEXTURE_2D,re,he,K.width,K.height);else{let Y=K.width,ue=K.height;for(let me=0;me<re;me++)t.texImage2D(n.TEXTURE_2D,me,he,Y,ue,0,le,be,null),Y>>=1,ue>>=1}}else if(v.isHTMLTexture){if("texElementImage2D"in n){const Y=n.canvas;if(Y.hasAttribute("layoutsubtree")||Y.setAttribute("layoutsubtree","true"),K.parentNode!==Y){Y.appendChild(K),f.add(v),Y.onpaint=ue=>{const me=ue.changedElements;for(const Q of f)me.includes(Q.image)&&(Q.needsUpdate=!0)},Y.requestPaint();return}if(n.texElementImage2D.length===3)n.texElementImage2D(n.TEXTURE_2D,n.RGBA8,K);else{const me=n.RGBA,Q=n.RGBA,Me=n.UNSIGNED_BYTE;n.texElementImage2D(n.TEXTURE_2D,0,me,Q,Me,K)}n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MIN_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_S,n.CLAMP_TO_EDGE),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_T,n.CLAMP_TO_EDGE)}}else if(Ce.length>0){if(Le&&Ne){const Y=je(Ce[0]);t.texStorage2D(n.TEXTURE_2D,re,he,Y.width,Y.height)}for(let Y=0,ue=Ce.length;Y<ue;Y++)ce=Ce[Y],Le?L&&t.texSubImage2D(n.TEXTURE_2D,Y,0,0,le,be,ce):t.texImage2D(n.TEXTURE_2D,Y,he,le,be,ce);v.generateMipmaps=!1}else if(Le){if(Ne){const Y=je(K);t.texStorage2D(n.TEXTURE_2D,re,he,Y.width,Y.height)}L&&t.texSubImage2D(n.TEXTURE_2D,0,0,0,le,be,K)}else t.texImage2D(n.TEXTURE_2D,0,he,le,be,K);h(v)&&x(V),oe.__version=ne.version,v.onUpdate&&v.onUpdate(v)}A.__version=v.version}function Fe(A,v,N){if(v.image.length!==6)return;const V=q(A,v),H=v.source;t.bindTexture(n.TEXTURE_CUBE_MAP,A.__webglTexture,n.TEXTURE0+N);const ne=i.get(H);if(H.version!==ne.__version||V===!0){t.activeTexture(n.TEXTURE0+N);const oe=Ve.getPrimaries(Ve.workingColorSpace),X=v.colorSpace===Vi?null:Ve.getPrimaries(v.colorSpace),K=v.colorSpace===Vi||oe===X?n.NONE:n.BROWSER_DEFAULT_WEBGL;t.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,v.flipY),t.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,v.premultiplyAlpha),t.pixelStorei(n.UNPACK_ALIGNMENT,v.unpackAlignment),t.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,K);const le=v.isCompressedTexture||v.image[0].isCompressedTexture,be=v.image[0]&&v.image[0].isDataTexture,he=[];for(let Q=0;Q<6;Q++)!le&&!be?he[Q]=p(v.image[Q],!0,s.maxCubemapSize):he[Q]=be?v.image[Q].image:v.image[Q],he[Q]=Vt(v,he[Q]);const ce=he[0],Ce=r.convert(v.format,v.colorSpace),Le=r.convert(v.type),Ne=M(v.internalFormat,Ce,Le,v.normalized,v.colorSpace),L=v.isVideoTexture!==!0,re=ne.__version===void 0||V===!0,Y=H.dataReady;let ue=T(v,ce);We(n.TEXTURE_CUBE_MAP,v);let me;if(le){L&&re&&t.texStorage2D(n.TEXTURE_CUBE_MAP,ue,Ne,ce.width,ce.height);for(let Q=0;Q<6;Q++){me=he[Q].mipmaps;for(let Me=0;Me<me.length;Me++){const xe=me[Me];v.format!==oi?Ce!==null?L?Y&&t.compressedTexSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+Q,Me,0,0,xe.width,xe.height,Ce,xe.data):t.compressedTexImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+Q,Me,Ne,xe.width,xe.height,0,xe.data):Ie("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):L?Y&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+Q,Me,0,0,xe.width,xe.height,Ce,Le,xe.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+Q,Me,Ne,xe.width,xe.height,0,Ce,Le,xe.data)}}}else{if(me=v.mipmaps,L&&re){me.length>0&&ue++;const Q=je(he[0]);t.texStorage2D(n.TEXTURE_CUBE_MAP,ue,Ne,Q.width,Q.height)}for(let Q=0;Q<6;Q++)if(be){L?Y&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+Q,0,0,0,he[Q].width,he[Q].height,Ce,Le,he[Q].data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+Q,0,Ne,he[Q].width,he[Q].height,0,Ce,Le,he[Q].data);for(let Me=0;Me<me.length;Me++){const ct=me[Me].image[Q].image;L?Y&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+Q,Me+1,0,0,ct.width,ct.height,Ce,Le,ct.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+Q,Me+1,Ne,ct.width,ct.height,0,Ce,Le,ct.data)}}else{L?Y&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+Q,0,0,0,Ce,Le,he[Q]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+Q,0,Ne,Ce,Le,he[Q]);for(let Me=0;Me<me.length;Me++){const xe=me[Me];L?Y&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+Q,Me+1,0,0,Ce,Le,xe.image[Q]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+Q,Me+1,Ne,Ce,Le,xe.image[Q])}}}h(v)&&x(n.TEXTURE_CUBE_MAP),ne.__version=H.version,v.onUpdate&&v.onUpdate(v)}A.__version=v.version}function De(A,v,N,V,H,ne){const oe=r.convert(N.format,N.colorSpace),X=r.convert(N.type),K=M(N.internalFormat,oe,X,N.normalized,N.colorSpace),le=i.get(v),be=i.get(N);if(be.__renderTarget=v,!le.__hasExternalTextures){const he=Math.max(1,v.width>>ne),ce=Math.max(1,v.height>>ne);H===n.TEXTURE_3D||H===n.TEXTURE_2D_ARRAY?t.texImage3D(H,ne,K,he,ce,v.depth,0,oe,X,null):t.texImage2D(H,ne,K,he,ce,0,oe,X,null)}t.bindFramebuffer(n.FRAMEBUFFER,A),vt(v)?o.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,V,H,be.__webglTexture,0,lt(v)):(H===n.TEXTURE_2D||H>=n.TEXTURE_CUBE_MAP_POSITIVE_X&&H<=n.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&n.framebufferTexture2D(n.FRAMEBUFFER,V,H,be.__webglTexture,ne),t.bindFramebuffer(n.FRAMEBUFFER,null)}function ht(A,v,N){if(n.bindRenderbuffer(n.RENDERBUFFER,A),v.depthBuffer){const V=v.depthTexture,H=V&&V.isDepthTexture?V.type:null,ne=b(v.stencilBuffer,H),oe=v.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;vt(v)?o.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,lt(v),ne,v.width,v.height):N?n.renderbufferStorageMultisample(n.RENDERBUFFER,lt(v),ne,v.width,v.height):n.renderbufferStorage(n.RENDERBUFFER,ne,v.width,v.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,oe,n.RENDERBUFFER,A)}else{const V=v.textures;for(let H=0;H<V.length;H++){const ne=V[H],oe=r.convert(ne.format,ne.colorSpace),X=r.convert(ne.type),K=M(ne.internalFormat,oe,X,ne.normalized,ne.colorSpace);vt(v)?o.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,lt(v),K,v.width,v.height):N?n.renderbufferStorageMultisample(n.RENDERBUFFER,lt(v),K,v.width,v.height):n.renderbufferStorage(n.RENDERBUFFER,K,v.width,v.height)}}n.bindRenderbuffer(n.RENDERBUFFER,null)}function ke(A,v,N){const V=v.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(n.FRAMEBUFFER,A),!(v.depthTexture&&v.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");const H=i.get(v.depthTexture);if(H.__renderTarget=v,(!H.__webglTexture||v.depthTexture.image.width!==v.width||v.depthTexture.image.height!==v.height)&&(v.depthTexture.image.width=v.width,v.depthTexture.image.height=v.height,v.depthTexture.needsUpdate=!0),V){if(H.__webglInit===void 0&&(H.__webglInit=!0,v.depthTexture.addEventListener("dispose",R)),H.__webglTexture===void 0){H.__webglTexture=n.createTexture(),t.bindTexture(n.TEXTURE_CUBE_MAP,H.__webglTexture),We(n.TEXTURE_CUBE_MAP,v.depthTexture);const le=r.convert(v.depthTexture.format),be=r.convert(v.depthTexture.type);let he;v.depthTexture.format===Ri?he=n.DEPTH_COMPONENT24:v.depthTexture.format===tn&&(he=n.DEPTH24_STENCIL8);for(let ce=0;ce<6;ce++)n.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ce,0,he,v.width,v.height,0,le,be,null)}}else J(v.depthTexture,0);const ne=H.__webglTexture,oe=lt(v),X=V?n.TEXTURE_CUBE_MAP_POSITIVE_X+N:n.TEXTURE_2D,K=v.depthTexture.format===tn?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;if(v.depthTexture.format===Ri)vt(v)?o.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,K,X,ne,0,oe):n.framebufferTexture2D(n.FRAMEBUFFER,K,X,ne,0);else if(v.depthTexture.format===tn)vt(v)?o.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,K,X,ne,0,oe):n.framebufferTexture2D(n.FRAMEBUFFER,K,X,ne,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function tt(A){const v=i.get(A),N=A.isWebGLCubeRenderTarget===!0;if(v.__boundDepthTexture!==A.depthTexture){const V=A.depthTexture;if(v.__depthDisposeCallback&&v.__depthDisposeCallback(),V){const H=()=>{delete v.__boundDepthTexture,delete v.__depthDisposeCallback,V.removeEventListener("dispose",H)};V.addEventListener("dispose",H),v.__depthDisposeCallback=H}v.__boundDepthTexture=V}if(A.depthTexture&&!v.__autoAllocateDepthBuffer)if(N)for(let V=0;V<6;V++)ke(v.__webglFramebuffer[V],A,V);else{const V=A.texture.mipmaps;V&&V.length>0?ke(v.__webglFramebuffer[0],A,0):ke(v.__webglFramebuffer,A,0)}else if(N){v.__webglDepthbuffer=[];for(let V=0;V<6;V++)if(t.bindFramebuffer(n.FRAMEBUFFER,v.__webglFramebuffer[V]),v.__webglDepthbuffer[V]===void 0)v.__webglDepthbuffer[V]=n.createRenderbuffer(),ht(v.__webglDepthbuffer[V],A,!1);else{const H=A.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,ne=v.__webglDepthbuffer[V];n.bindRenderbuffer(n.RENDERBUFFER,ne),n.framebufferRenderbuffer(n.FRAMEBUFFER,H,n.RENDERBUFFER,ne)}}else{const V=A.texture.mipmaps;if(V&&V.length>0?t.bindFramebuffer(n.FRAMEBUFFER,v.__webglFramebuffer[0]):t.bindFramebuffer(n.FRAMEBUFFER,v.__webglFramebuffer),v.__webglDepthbuffer===void 0)v.__webglDepthbuffer=n.createRenderbuffer(),ht(v.__webglDepthbuffer,A,!1);else{const H=A.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,ne=v.__webglDepthbuffer;n.bindRenderbuffer(n.RENDERBUFFER,ne),n.framebufferRenderbuffer(n.FRAMEBUFFER,H,n.RENDERBUFFER,ne)}}t.bindFramebuffer(n.FRAMEBUFFER,null)}function Ke(A,v,N){const V=i.get(A);v!==void 0&&De(V.__webglFramebuffer,A,A.texture,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,0),N!==void 0&&tt(A)}function $e(A){const v=A.texture,N=i.get(A),V=i.get(v);A.addEventListener("dispose",_);const H=A.textures,ne=A.isWebGLCubeRenderTarget===!0,oe=H.length>1;if(oe||(V.__webglTexture===void 0&&(V.__webglTexture=n.createTexture()),V.__version=v.version,a.memory.textures++),ne){N.__webglFramebuffer=[];for(let X=0;X<6;X++)if(v.mipmaps&&v.mipmaps.length>0){N.__webglFramebuffer[X]=[];for(let K=0;K<v.mipmaps.length;K++)N.__webglFramebuffer[X][K]=n.createFramebuffer()}else N.__webglFramebuffer[X]=n.createFramebuffer()}else{if(v.mipmaps&&v.mipmaps.length>0){N.__webglFramebuffer=[];for(let X=0;X<v.mipmaps.length;X++)N.__webglFramebuffer[X]=n.createFramebuffer()}else N.__webglFramebuffer=n.createFramebuffer();if(oe)for(let X=0,K=H.length;X<K;X++){const le=i.get(H[X]);le.__webglTexture===void 0&&(le.__webglTexture=n.createTexture(),a.memory.textures++)}if(A.samples>0&&vt(A)===!1){N.__webglMultisampledFramebuffer=n.createFramebuffer(),N.__webglColorRenderbuffer=[],t.bindFramebuffer(n.FRAMEBUFFER,N.__webglMultisampledFramebuffer);for(let X=0;X<H.length;X++){const K=H[X];N.__webglColorRenderbuffer[X]=n.createRenderbuffer(),n.bindRenderbuffer(n.RENDERBUFFER,N.__webglColorRenderbuffer[X]);const le=r.convert(K.format,K.colorSpace),be=r.convert(K.type),he=M(K.internalFormat,le,be,K.normalized,K.colorSpace,A.isXRRenderTarget===!0),ce=lt(A);n.renderbufferStorageMultisample(n.RENDERBUFFER,ce,he,A.width,A.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+X,n.RENDERBUFFER,N.__webglColorRenderbuffer[X])}n.bindRenderbuffer(n.RENDERBUFFER,null),A.depthBuffer&&(N.__webglDepthRenderbuffer=n.createRenderbuffer(),ht(N.__webglDepthRenderbuffer,A,!0)),t.bindFramebuffer(n.FRAMEBUFFER,null)}}if(ne){t.bindTexture(n.TEXTURE_CUBE_MAP,V.__webglTexture),We(n.TEXTURE_CUBE_MAP,v);for(let X=0;X<6;X++)if(v.mipmaps&&v.mipmaps.length>0)for(let K=0;K<v.mipmaps.length;K++)De(N.__webglFramebuffer[X][K],A,v,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+X,K);else De(N.__webglFramebuffer[X],A,v,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+X,0);h(v)&&x(n.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(oe){for(let X=0,K=H.length;X<K;X++){const le=H[X],be=i.get(le);let he=n.TEXTURE_2D;(A.isWebGL3DRenderTarget||A.isWebGLArrayRenderTarget)&&(he=A.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(he,be.__webglTexture),We(he,le),De(N.__webglFramebuffer,A,le,n.COLOR_ATTACHMENT0+X,he,0),h(le)&&x(he)}t.unbindTexture()}else{let X=n.TEXTURE_2D;if((A.isWebGL3DRenderTarget||A.isWebGLArrayRenderTarget)&&(X=A.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(X,V.__webglTexture),We(X,v),v.mipmaps&&v.mipmaps.length>0)for(let K=0;K<v.mipmaps.length;K++)De(N.__webglFramebuffer[K],A,v,n.COLOR_ATTACHMENT0,X,K);else De(N.__webglFramebuffer,A,v,n.COLOR_ATTACHMENT0,X,0);h(v)&&x(X),t.unbindTexture()}A.depthBuffer&&tt(A)}function gt(A){const v=A.textures;for(let N=0,V=v.length;N<V;N++){const H=v[N];if(h(H)){const ne=E(A),oe=i.get(H).__webglTexture;t.bindTexture(ne,oe),x(ne),t.unbindTexture()}}}const Mt=[],At=[];function Rt(A){if(A.samples>0){if(vt(A)===!1){const v=A.textures,N=A.width,V=A.height;let H=n.COLOR_BUFFER_BIT;const ne=A.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,oe=i.get(A),X=v.length>1;if(X)for(let le=0;le<v.length;le++)t.bindFramebuffer(n.FRAMEBUFFER,oe.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+le,n.RENDERBUFFER,null),t.bindFramebuffer(n.FRAMEBUFFER,oe.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+le,n.TEXTURE_2D,null,0);t.bindFramebuffer(n.READ_FRAMEBUFFER,oe.__webglMultisampledFramebuffer);const K=A.texture.mipmaps;K&&K.length>0?t.bindFramebuffer(n.DRAW_FRAMEBUFFER,oe.__webglFramebuffer[0]):t.bindFramebuffer(n.DRAW_FRAMEBUFFER,oe.__webglFramebuffer);for(let le=0;le<v.length;le++){if(A.resolveDepthBuffer&&(A.depthBuffer&&(H|=n.DEPTH_BUFFER_BIT),A.stencilBuffer&&A.resolveStencilBuffer&&(H|=n.STENCIL_BUFFER_BIT)),X){n.framebufferRenderbuffer(n.READ_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.RENDERBUFFER,oe.__webglColorRenderbuffer[le]);const be=i.get(v[le]).__webglTexture;n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,be,0)}n.blitFramebuffer(0,0,N,V,0,0,N,V,H,n.NEAREST),l===!0&&(Mt.length=0,At.length=0,Mt.push(n.COLOR_ATTACHMENT0+le),A.depthBuffer&&A.resolveDepthBuffer===!1&&(Mt.push(ne),At.push(ne),n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,At)),n.invalidateFramebuffer(n.READ_FRAMEBUFFER,Mt))}if(t.bindFramebuffer(n.READ_FRAMEBUFFER,null),t.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),X)for(let le=0;le<v.length;le++){t.bindFramebuffer(n.FRAMEBUFFER,oe.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+le,n.RENDERBUFFER,oe.__webglColorRenderbuffer[le]);const be=i.get(v[le]).__webglTexture;t.bindFramebuffer(n.FRAMEBUFFER,oe.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+le,n.TEXTURE_2D,be,0)}t.bindFramebuffer(n.DRAW_FRAMEBUFFER,oe.__webglMultisampledFramebuffer)}else if(A.depthBuffer&&A.resolveDepthBuffer===!1&&l){const v=A.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,[v])}}}function lt(A){return Math.min(s.maxSamples,A.samples)}function vt(A){const v=i.get(A);return A.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&v.__useRenderToTexture!==!1}function I(A){const v=a.render.frame;d.get(A)!==v&&(d.set(A,v),A.update())}function Vt(A,v){const N=A.colorSpace,V=A.format,H=A.type;return A.isCompressedTexture===!0||A.isVideoTexture===!0||N!==qs&&N!==Vi&&(Ve.getTransfer(N)===Ze?(V!==oi||H!==Zt)&&Ie("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Xe("WebGLTextures: Unsupported texture color space:",N)),v}function je(A){return typeof HTMLImageElement<"u"&&A instanceof HTMLImageElement?(c.width=A.naturalWidth||A.width,c.height=A.naturalHeight||A.height):typeof VideoFrame<"u"&&A instanceof VideoFrame?(c.width=A.displayWidth,c.height=A.displayHeight):(c.width=A.width,c.height=A.height),c}this.allocateTextureUnit=$,this.resetTextureUnits=W,this.getTextureUnits=Z,this.setTextureUnits=O,this.setTexture2D=J,this.setTexture2DArray=ee,this.setTexture3D=ae,this.setTextureCube=ie,this.rebindTextures=Ke,this.setupRenderTarget=$e,this.updateRenderTargetMipmap=gt,this.updateMultisampleRenderTarget=Rt,this.setupDepthRenderbuffer=tt,this.setupFrameBufferTexture=De,this.useMultisampledRTT=vt,this.isReversedDepthBuffer=function(){return t.buffers.depth.getReversed()}}function Gm(n,e){function t(i,s=Vi){let r;const a=Ve.getTransfer(s);if(i===Zt)return n.UNSIGNED_BYTE;if(i===Za)return n.UNSIGNED_SHORT_4_4_4_4;if(i===Ja)return n.UNSIGNED_SHORT_5_5_5_1;if(i===Hl)return n.UNSIGNED_INT_5_9_9_9_REV;if(i===Wl)return n.UNSIGNED_INT_10F_11F_11F_REV;if(i===Vl)return n.BYTE;if(i===Gl)return n.SHORT;if(i===ns)return n.UNSIGNED_SHORT;if(i===Ka)return n.INT;if(i===xi)return n.UNSIGNED_INT;if(i===ai)return n.FLOAT;if(i===Jt)return n.HALF_FLOAT;if(i===Xl)return n.ALPHA;if(i===$l)return n.RGB;if(i===oi)return n.RGBA;if(i===Ri)return n.DEPTH_COMPONENT;if(i===tn)return n.DEPTH_STENCIL;if(i===Qa)return n.RED;if(i===ja)return n.RED_INTEGER;if(i===sn)return n.RG;if(i===eo)return n.RG_INTEGER;if(i===to)return n.RGBA_INTEGER;if(i===zs||i===ks||i===Vs||i===Gs)if(a===Ze)if(r=e.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(i===zs)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===ks)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===Vs)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===Gs)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=e.get("WEBGL_compressed_texture_s3tc"),r!==null){if(i===zs)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===ks)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===Vs)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===Gs)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===ia||i===na||i===sa||i===ra)if(r=e.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(i===ia)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===na)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===sa)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===ra)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===aa||i===oa||i===la||i===ca||i===ua||i===Xs||i===ha)if(r=e.get("WEBGL_compressed_texture_etc"),r!==null){if(i===aa||i===oa)return a===Ze?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(i===la)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC;if(i===ca)return r.COMPRESSED_R11_EAC;if(i===ua)return r.COMPRESSED_SIGNED_R11_EAC;if(i===Xs)return r.COMPRESSED_RG11_EAC;if(i===ha)return r.COMPRESSED_SIGNED_RG11_EAC}else return null;if(i===da||i===fa||i===pa||i===ma||i===ga||i===va||i===_a||i===xa||i===Sa||i===Ma||i===ya||i===ba||i===Ea||i===wa)if(r=e.get("WEBGL_compressed_texture_astc"),r!==null){if(i===da)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===fa)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===pa)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===ma)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===ga)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===va)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===_a)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===xa)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===Sa)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===Ma)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===ya)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===ba)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===Ea)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===wa)return a===Ze?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===Ta||i===Aa||i===Ca)if(r=e.get("EXT_texture_compression_bptc"),r!==null){if(i===Ta)return a===Ze?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===Aa)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===Ca)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===Ra||i===Pa||i===$s||i===Da)if(r=e.get("EXT_texture_compression_rgtc"),r!==null){if(i===Ra)return r.COMPRESSED_RED_RGTC1_EXT;if(i===Pa)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===$s)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===Da)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===ss?n.UNSIGNED_INT_24_8:n[i]!==void 0?n[i]:null}return{convert:t}}const Hm=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Wm=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class Xm{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){const i=new tc(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=i}}getMesh(e){if(this.texture!==null&&this.mesh===null){const t=e.cameras[0].viewport,i=new st({vertexShader:Hm,fragmentShader:Wm,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new He(new Di(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class $m extends rn{constructor(e,t){super();const i=this;let s=null,r=1,a=null,o="local-floor",l=1,c=null,d=null,f=null,u=null,m=null,g=null;const S=typeof XRWebGLBinding<"u",p=new Xm,h={},x=t.getContextAttributes();let E=null,M=null;const b=[],T=[],R=new Re;let _=null;const w=new Kt;w.viewport=new ot;const P=new Kt;P.viewport=new ot;const D=[w,P],F=new Qu;let W=null,Z=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(q){let se=b[q];return se===void 0&&(se=new gr,b[q]=se),se.getTargetRaySpace()},this.getControllerGrip=function(q){let se=b[q];return se===void 0&&(se=new gr,b[q]=se),se.getGripSpace()},this.getHand=function(q){let se=b[q];return se===void 0&&(se=new gr,b[q]=se),se.getHandSpace()};function O(q){const se=T.indexOf(q.inputSource);if(se===-1)return;const j=b[se];j!==void 0&&(j.update(q.inputSource,q.frame,c||a),j.dispatchEvent({type:q.type,data:q.inputSource}))}function $(){s.removeEventListener("select",O),s.removeEventListener("selectstart",O),s.removeEventListener("selectend",O),s.removeEventListener("squeeze",O),s.removeEventListener("squeezestart",O),s.removeEventListener("squeezeend",O),s.removeEventListener("end",$),s.removeEventListener("inputsourceschange",k);for(let q=0;q<b.length;q++){const se=T[q];se!==null&&(T[q]=null,b[q].disconnect(se))}W=null,Z=null,p.reset();for(const q in h)delete h[q];e.setRenderTarget(E),m=null,u=null,f=null,s=null,M=null,We.stop(),i.isPresenting=!1,e.setPixelRatio(_),e.setSize(R.width,R.height,!1),i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(q){r=q,i.isPresenting===!0&&Ie("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(q){o=q,i.isPresenting===!0&&Ie("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(q){c=q},this.getBaseLayer=function(){return u!==null?u:m},this.getBinding=function(){return f===null&&S&&(f=new XRWebGLBinding(s,t)),f},this.getFrame=function(){return g},this.getSession=function(){return s},this.setSession=async function(q){if(s=q,s!==null){if(E=e.getRenderTarget(),s.addEventListener("select",O),s.addEventListener("selectstart",O),s.addEventListener("selectend",O),s.addEventListener("squeeze",O),s.addEventListener("squeezestart",O),s.addEventListener("squeezeend",O),s.addEventListener("end",$),s.addEventListener("inputsourceschange",k),x.xrCompatible!==!0&&await t.makeXRCompatible(),_=e.getPixelRatio(),e.getSize(R),S&&"createProjectionLayer"in XRWebGLBinding.prototype){let j=null,Pe=null,Fe=null;x.depth&&(Fe=x.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,j=x.stencil?tn:Ri,Pe=x.stencil?ss:xi);const De={colorFormat:t.RGBA8,depthFormat:Fe,scaleFactor:r};f=this.getBinding(),u=f.createProjectionLayer(De),s.updateRenderState({layers:[u]}),e.setPixelRatio(1),e.setSize(u.textureWidth,u.textureHeight,!1),M=new Wt(u.textureWidth,u.textureHeight,{format:oi,type:Zt,depthTexture:new In(u.textureWidth,u.textureHeight,Pe,void 0,void 0,void 0,void 0,void 0,void 0,j),stencilBuffer:x.stencil,colorSpace:e.outputColorSpace,samples:x.antialias?4:0,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1})}else{const j={antialias:x.antialias,alpha:!0,depth:x.depth,stencil:x.stencil,framebufferScaleFactor:r};m=new XRWebGLLayer(s,t,j),s.updateRenderState({baseLayer:m}),e.setPixelRatio(1),e.setSize(m.framebufferWidth,m.framebufferHeight,!1),M=new Wt(m.framebufferWidth,m.framebufferHeight,{format:oi,type:Zt,colorSpace:e.outputColorSpace,stencilBuffer:x.stencil,resolveDepthBuffer:m.ignoreDepthValues===!1,resolveStencilBuffer:m.ignoreDepthValues===!1})}M.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await s.requestReferenceSpace(o),We.setContext(s),We.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return p.getDepthTexture()};function k(q){for(let se=0;se<q.removed.length;se++){const j=q.removed[se],Pe=T.indexOf(j);Pe>=0&&(T[Pe]=null,b[Pe].disconnect(j))}for(let se=0;se<q.added.length;se++){const j=q.added[se];let Pe=T.indexOf(j);if(Pe===-1){for(let De=0;De<b.length;De++)if(De>=T.length){T.push(j),Pe=De;break}else if(T[De]===null){T[De]=j,Pe=De;break}if(Pe===-1)break}const Fe=b[Pe];Fe&&Fe.connect(j)}}const J=new C,ee=new C;function ae(q,se,j){J.setFromMatrixPosition(se.matrixWorld),ee.setFromMatrixPosition(j.matrixWorld);const Pe=J.distanceTo(ee),Fe=se.projectionMatrix.elements,De=j.projectionMatrix.elements,ht=Fe[14]/(Fe[10]-1),ke=Fe[14]/(Fe[10]+1),tt=(Fe[9]+1)/Fe[5],Ke=(Fe[9]-1)/Fe[5],$e=(Fe[8]-1)/Fe[0],gt=(De[8]+1)/De[0],Mt=ht*$e,At=ht*gt,Rt=Pe/(-$e+gt),lt=Rt*-$e;if(se.matrixWorld.decompose(q.position,q.quaternion,q.scale),q.translateX(lt),q.translateZ(Rt),q.matrixWorld.compose(q.position,q.quaternion,q.scale),q.matrixWorldInverse.copy(q.matrixWorld).invert(),Fe[10]===-1)q.projectionMatrix.copy(se.projectionMatrix),q.projectionMatrixInverse.copy(se.projectionMatrixInverse);else{const vt=ht+Rt,I=ke+Rt,Vt=Mt-lt,je=At+(Pe-lt),A=tt*ke/I*vt,v=Ke*ke/I*vt;q.projectionMatrix.makePerspective(Vt,je,A,v,vt,I),q.projectionMatrixInverse.copy(q.projectionMatrix).invert()}}function ie(q,se){se===null?q.matrixWorld.copy(q.matrix):q.matrixWorld.multiplyMatrices(se.matrixWorld,q.matrix),q.matrixWorldInverse.copy(q.matrixWorld).invert()}this.updateCamera=function(q){if(s===null)return;let se=q.near,j=q.far;p.texture!==null&&(p.depthNear>0&&(se=p.depthNear),p.depthFar>0&&(j=p.depthFar)),F.near=P.near=w.near=se,F.far=P.far=w.far=j,(W!==F.near||Z!==F.far)&&(s.updateRenderState({depthNear:F.near,depthFar:F.far}),W=F.near,Z=F.far),F.layers.mask=q.layers.mask|6,w.layers.mask=F.layers.mask&-5,P.layers.mask=F.layers.mask&-3;const Pe=q.parent,Fe=F.cameras;ie(F,Pe);for(let De=0;De<Fe.length;De++)ie(Fe[De],Pe);Fe.length===2?ae(F,w,P):F.projectionMatrix.copy(w.projectionMatrix),ve(q,F,Pe)};function ve(q,se,j){j===null?q.matrix.copy(se.matrixWorld):(q.matrix.copy(j.matrixWorld),q.matrix.invert(),q.matrix.multiply(se.matrixWorld)),q.matrix.decompose(q.position,q.quaternion,q.scale),q.updateMatrixWorld(!0),q.projectionMatrix.copy(se.projectionMatrix),q.projectionMatrixInverse.copy(se.projectionMatrixInverse),q.isPerspectiveCamera&&(q.fov=Ia*2*Math.atan(1/q.projectionMatrix.elements[5]),q.zoom=1)}this.getCamera=function(){return F},this.getFoveation=function(){if(!(u===null&&m===null))return l},this.setFoveation=function(q){l=q,u!==null&&(u.fixedFoveation=q),m!==null&&m.fixedFoveation!==void 0&&(m.fixedFoveation=q)},this.hasDepthSensing=function(){return p.texture!==null},this.getDepthSensingMesh=function(){return p.getMesh(F)},this.getCameraTexture=function(q){return h[q]};let Ae=null;function Qe(q,se){if(d=se.getViewerPose(c||a),g=se,d!==null){const j=d.views;m!==null&&(e.setRenderTargetFramebuffer(M,m.framebuffer),e.setRenderTarget(M));let Pe=!1;j.length!==F.cameras.length&&(F.cameras.length=0,Pe=!0);for(let ke=0;ke<j.length;ke++){const tt=j[ke];let Ke=null;if(m!==null)Ke=m.getViewport(tt);else{const gt=f.getViewSubImage(u,tt);Ke=gt.viewport,ke===0&&(e.setRenderTargetTextures(M,gt.colorTexture,gt.depthStencilTexture),e.setRenderTarget(M))}let $e=D[ke];$e===void 0&&($e=new Kt,$e.layers.enable(ke),$e.viewport=new ot,D[ke]=$e),$e.matrix.fromArray(tt.transform.matrix),$e.matrix.decompose($e.position,$e.quaternion,$e.scale),$e.projectionMatrix.fromArray(tt.projectionMatrix),$e.projectionMatrixInverse.copy($e.projectionMatrix).invert(),$e.viewport.set(Ke.x,Ke.y,Ke.width,Ke.height),ke===0&&(F.matrix.copy($e.matrix),F.matrix.decompose(F.position,F.quaternion,F.scale)),Pe===!0&&F.cameras.push($e)}const Fe=s.enabledFeatures;if(Fe&&Fe.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&S){f=i.getBinding();const ke=f.getDepthInformation(j[0]);ke&&ke.isValid&&ke.texture&&p.init(ke,s.renderState)}if(Fe&&Fe.includes("camera-access")&&S){e.state.unbindTexture(),f=i.getBinding();for(let ke=0;ke<j.length;ke++){const tt=j[ke].camera;if(tt){let Ke=h[tt];Ke||(Ke=new tc,h[tt]=Ke);const $e=f.getCameraImage(tt);Ke.sourceTexture=$e}}}}for(let j=0;j<b.length;j++){const Pe=T[j],Fe=b[j];Pe!==null&&Fe!==void 0&&Fe.update(Pe,se,c||a)}Ae&&Ae(q,se),se.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:se}),g=null}const We=new oc;We.setAnimationLoop(Qe),this.setAnimationLoop=function(q){Ae=q},this.dispose=function(){}}}const qm=new Je,pc=new Ue;pc.set(-1,0,0,0,1,0,0,0,1);function Ym(n,e){function t(p,h){p.matrixAutoUpdate===!0&&p.updateMatrix(),h.value.copy(p.matrix)}function i(p,h){h.color.getRGB(p.fogColor.value,ic(n)),h.isFog?(p.fogNear.value=h.near,p.fogFar.value=h.far):h.isFogExp2&&(p.fogDensity.value=h.density)}function s(p,h,x,E,M){h.isNodeMaterial?h.uniformsNeedUpdate=!1:h.isMeshBasicMaterial?r(p,h):h.isMeshLambertMaterial?(r(p,h),h.envMap&&(p.envMapIntensity.value=h.envMapIntensity)):h.isMeshToonMaterial?(r(p,h),f(p,h)):h.isMeshPhongMaterial?(r(p,h),d(p,h),h.envMap&&(p.envMapIntensity.value=h.envMapIntensity)):h.isMeshStandardMaterial?(r(p,h),u(p,h),h.isMeshPhysicalMaterial&&m(p,h,M)):h.isMeshMatcapMaterial?(r(p,h),g(p,h)):h.isMeshDepthMaterial?r(p,h):h.isMeshDistanceMaterial?(r(p,h),S(p,h)):h.isMeshNormalMaterial?r(p,h):h.isLineBasicMaterial?(a(p,h),h.isLineDashedMaterial&&o(p,h)):h.isPointsMaterial?l(p,h,x,E):h.isSpriteMaterial?c(p,h):h.isShadowMaterial?(p.color.value.copy(h.color),p.opacity.value=h.opacity):h.isShaderMaterial&&(h.uniformsNeedUpdate=!1)}function r(p,h){p.opacity.value=h.opacity,h.color&&p.diffuse.value.copy(h.color),h.emissive&&p.emissive.value.copy(h.emissive).multiplyScalar(h.emissiveIntensity),h.map&&(p.map.value=h.map,t(h.map,p.mapTransform)),h.alphaMap&&(p.alphaMap.value=h.alphaMap,t(h.alphaMap,p.alphaMapTransform)),h.bumpMap&&(p.bumpMap.value=h.bumpMap,t(h.bumpMap,p.bumpMapTransform),p.bumpScale.value=h.bumpScale,h.side===Ot&&(p.bumpScale.value*=-1)),h.normalMap&&(p.normalMap.value=h.normalMap,t(h.normalMap,p.normalMapTransform),p.normalScale.value.copy(h.normalScale),h.side===Ot&&p.normalScale.value.negate()),h.displacementMap&&(p.displacementMap.value=h.displacementMap,t(h.displacementMap,p.displacementMapTransform),p.displacementScale.value=h.displacementScale,p.displacementBias.value=h.displacementBias),h.emissiveMap&&(p.emissiveMap.value=h.emissiveMap,t(h.emissiveMap,p.emissiveMapTransform)),h.specularMap&&(p.specularMap.value=h.specularMap,t(h.specularMap,p.specularMapTransform)),h.alphaTest>0&&(p.alphaTest.value=h.alphaTest);const x=e.get(h),E=x.envMap,M=x.envMapRotation;E&&(p.envMap.value=E,p.envMapRotation.value.setFromMatrix4(qm.makeRotationFromEuler(M)).transpose(),E.isCubeTexture&&E.isRenderTargetTexture===!1&&p.envMapRotation.value.premultiply(pc),p.reflectivity.value=h.reflectivity,p.ior.value=h.ior,p.refractionRatio.value=h.refractionRatio),h.lightMap&&(p.lightMap.value=h.lightMap,p.lightMapIntensity.value=h.lightMapIntensity,t(h.lightMap,p.lightMapTransform)),h.aoMap&&(p.aoMap.value=h.aoMap,p.aoMapIntensity.value=h.aoMapIntensity,t(h.aoMap,p.aoMapTransform))}function a(p,h){p.diffuse.value.copy(h.color),p.opacity.value=h.opacity,h.map&&(p.map.value=h.map,t(h.map,p.mapTransform))}function o(p,h){p.dashSize.value=h.dashSize,p.totalSize.value=h.dashSize+h.gapSize,p.scale.value=h.scale}function l(p,h,x,E){p.diffuse.value.copy(h.color),p.opacity.value=h.opacity,p.size.value=h.size*x,p.scale.value=E*.5,h.map&&(p.map.value=h.map,t(h.map,p.uvTransform)),h.alphaMap&&(p.alphaMap.value=h.alphaMap,t(h.alphaMap,p.alphaMapTransform)),h.alphaTest>0&&(p.alphaTest.value=h.alphaTest)}function c(p,h){p.diffuse.value.copy(h.color),p.opacity.value=h.opacity,p.rotation.value=h.rotation,h.map&&(p.map.value=h.map,t(h.map,p.mapTransform)),h.alphaMap&&(p.alphaMap.value=h.alphaMap,t(h.alphaMap,p.alphaMapTransform)),h.alphaTest>0&&(p.alphaTest.value=h.alphaTest)}function d(p,h){p.specular.value.copy(h.specular),p.shininess.value=Math.max(h.shininess,1e-4)}function f(p,h){h.gradientMap&&(p.gradientMap.value=h.gradientMap)}function u(p,h){p.metalness.value=h.metalness,h.metalnessMap&&(p.metalnessMap.value=h.metalnessMap,t(h.metalnessMap,p.metalnessMapTransform)),p.roughness.value=h.roughness,h.roughnessMap&&(p.roughnessMap.value=h.roughnessMap,t(h.roughnessMap,p.roughnessMapTransform)),h.envMap&&(p.envMapIntensity.value=h.envMapIntensity)}function m(p,h,x){p.ior.value=h.ior,h.sheen>0&&(p.sheenColor.value.copy(h.sheenColor).multiplyScalar(h.sheen),p.sheenRoughness.value=h.sheenRoughness,h.sheenColorMap&&(p.sheenColorMap.value=h.sheenColorMap,t(h.sheenColorMap,p.sheenColorMapTransform)),h.sheenRoughnessMap&&(p.sheenRoughnessMap.value=h.sheenRoughnessMap,t(h.sheenRoughnessMap,p.sheenRoughnessMapTransform))),h.clearcoat>0&&(p.clearcoat.value=h.clearcoat,p.clearcoatRoughness.value=h.clearcoatRoughness,h.clearcoatMap&&(p.clearcoatMap.value=h.clearcoatMap,t(h.clearcoatMap,p.clearcoatMapTransform)),h.clearcoatRoughnessMap&&(p.clearcoatRoughnessMap.value=h.clearcoatRoughnessMap,t(h.clearcoatRoughnessMap,p.clearcoatRoughnessMapTransform)),h.clearcoatNormalMap&&(p.clearcoatNormalMap.value=h.clearcoatNormalMap,t(h.clearcoatNormalMap,p.clearcoatNormalMapTransform),p.clearcoatNormalScale.value.copy(h.clearcoatNormalScale),h.side===Ot&&p.clearcoatNormalScale.value.negate())),h.dispersion>0&&(p.dispersion.value=h.dispersion),h.iridescence>0&&(p.iridescence.value=h.iridescence,p.iridescenceIOR.value=h.iridescenceIOR,p.iridescenceThicknessMinimum.value=h.iridescenceThicknessRange[0],p.iridescenceThicknessMaximum.value=h.iridescenceThicknessRange[1],h.iridescenceMap&&(p.iridescenceMap.value=h.iridescenceMap,t(h.iridescenceMap,p.iridescenceMapTransform)),h.iridescenceThicknessMap&&(p.iridescenceThicknessMap.value=h.iridescenceThicknessMap,t(h.iridescenceThicknessMap,p.iridescenceThicknessMapTransform))),h.transmission>0&&(p.transmission.value=h.transmission,p.transmissionSamplerMap.value=x.texture,p.transmissionSamplerSize.value.set(x.width,x.height),h.transmissionMap&&(p.transmissionMap.value=h.transmissionMap,t(h.transmissionMap,p.transmissionMapTransform)),p.thickness.value=h.thickness,h.thicknessMap&&(p.thicknessMap.value=h.thicknessMap,t(h.thicknessMap,p.thicknessMapTransform)),p.attenuationDistance.value=h.attenuationDistance,p.attenuationColor.value.copy(h.attenuationColor)),h.anisotropy>0&&(p.anisotropyVector.value.set(h.anisotropy*Math.cos(h.anisotropyRotation),h.anisotropy*Math.sin(h.anisotropyRotation)),h.anisotropyMap&&(p.anisotropyMap.value=h.anisotropyMap,t(h.anisotropyMap,p.anisotropyMapTransform))),p.specularIntensity.value=h.specularIntensity,p.specularColor.value.copy(h.specularColor),h.specularColorMap&&(p.specularColorMap.value=h.specularColorMap,t(h.specularColorMap,p.specularColorMapTransform)),h.specularIntensityMap&&(p.specularIntensityMap.value=h.specularIntensityMap,t(h.specularIntensityMap,p.specularIntensityMapTransform))}function g(p,h){h.matcap&&(p.matcap.value=h.matcap)}function S(p,h){const x=e.get(h).light;p.referencePosition.value.setFromMatrixPosition(x.matrixWorld),p.nearDistance.value=x.shadow.camera.near,p.farDistance.value=x.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:s}}function Km(n,e,t,i){let s={},r={},a=[];const o=n.getParameter(n.MAX_UNIFORM_BUFFER_BINDINGS);function l(M,b){const T=b.program;i.uniformBlockBinding(M,T)}function c(M,b){let T=s[M.id];T===void 0&&(p(M),T=d(M),s[M.id]=T,M.addEventListener("dispose",x));const R=b.program;i.updateUBOMapping(M,R);const _=e.render.frame;r[M.id]!==_&&(u(M),r[M.id]=_)}function d(M){const b=f();M.__bindingPointIndex=b;const T=n.createBuffer(),R=M.__size,_=M.usage;return n.bindBuffer(n.UNIFORM_BUFFER,T),n.bufferData(n.UNIFORM_BUFFER,R,_),n.bindBuffer(n.UNIFORM_BUFFER,null),n.bindBufferBase(n.UNIFORM_BUFFER,b,T),T}function f(){for(let M=0;M<o;M++)if(a.indexOf(M)===-1)return a.push(M),M;return Xe("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function u(M){const b=s[M.id],T=M.uniforms,R=M.__cache;n.bindBuffer(n.UNIFORM_BUFFER,b);for(let _=0,w=T.length;_<w;_++){const P=T[_];if(Array.isArray(P))for(let D=0,F=P.length;D<F;D++)m(P[D],_,D,R);else m(P,_,0,R)}n.bindBuffer(n.UNIFORM_BUFFER,null)}function m(M,b,T,R){if(S(M,b,T,R)===!0){const _=M.__offset,w=M.value;if(Array.isArray(w)){let P=0;for(let D=0;D<w.length;D++){const F=w[D],W=h(F);g(F,M.__data,P),typeof F!="number"&&typeof F!="boolean"&&!F.isMatrix3&&!ArrayBuffer.isView(F)&&(P+=W.storage/Float32Array.BYTES_PER_ELEMENT)}}else g(w,M.__data,0);n.bufferSubData(n.UNIFORM_BUFFER,_,M.__data)}}function g(M,b,T){typeof M=="number"||typeof M=="boolean"?b[0]=M:M.isMatrix3?(b[0]=M.elements[0],b[1]=M.elements[1],b[2]=M.elements[2],b[3]=0,b[4]=M.elements[3],b[5]=M.elements[4],b[6]=M.elements[5],b[7]=0,b[8]=M.elements[6],b[9]=M.elements[7],b[10]=M.elements[8],b[11]=0):ArrayBuffer.isView(M)?b.set(new M.constructor(M.buffer,M.byteOffset,b.length)):M.toArray(b,T)}function S(M,b,T,R){const _=M.value,w=b+"_"+T;if(R[w]===void 0)return typeof _=="number"||typeof _=="boolean"?R[w]=_:ArrayBuffer.isView(_)?R[w]=_.slice():R[w]=_.clone(),!0;{const P=R[w];if(typeof _=="number"||typeof _=="boolean"){if(P!==_)return R[w]=_,!0}else{if(ArrayBuffer.isView(_))return!0;if(P.equals(_)===!1)return P.copy(_),!0}}return!1}function p(M){const b=M.uniforms;let T=0;const R=16;for(let w=0,P=b.length;w<P;w++){const D=Array.isArray(b[w])?b[w]:[b[w]];for(let F=0,W=D.length;F<W;F++){const Z=D[F],O=Array.isArray(Z.value)?Z.value:[Z.value];for(let $=0,k=O.length;$<k;$++){const J=O[$],ee=h(J),ae=T%R,ie=ae%ee.boundary,ve=ae+ie;T+=ie,ve!==0&&R-ve<ee.storage&&(T+=R-ve),Z.__data=new Float32Array(ee.storage/Float32Array.BYTES_PER_ELEMENT),Z.__offset=T,T+=ee.storage}}}const _=T%R;return _>0&&(T+=R-_),M.__size=T,M.__cache={},this}function h(M){const b={boundary:0,storage:0};return typeof M=="number"||typeof M=="boolean"?(b.boundary=4,b.storage=4):M.isVector2?(b.boundary=8,b.storage=8):M.isVector3||M.isColor?(b.boundary=16,b.storage=12):M.isVector4?(b.boundary=16,b.storage=16):M.isMatrix3?(b.boundary=48,b.storage=48):M.isMatrix4?(b.boundary=64,b.storage=64):M.isTexture?Ie("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(M)?(b.boundary=16,b.storage=M.byteLength):Ie("WebGLRenderer: Unsupported uniform value type.",M),b}function x(M){const b=M.target;b.removeEventListener("dispose",x);const T=a.indexOf(b.__bindingPointIndex);a.splice(T,1),n.deleteBuffer(s[b.id]),delete s[b.id],delete r[b.id]}function E(){for(const M in s)n.deleteBuffer(s[M]);a=[],s={},r={}}return{bind:l,update:c,dispose:E}}const Zm=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]);let di=null;function Jm(){return di===null&&(di=new jl(Zm,16,16,sn,Jt),di.name="DFG_LUT",di.minFilter=Nt,di.magFilter=Nt,di.wrapS=Ti,di.wrapT=Ti,di.generateMipmaps=!1,di.needsUpdate=!0),di}class Qm{constructor(e={}){const{canvas:t=uu(),context:i=null,depth:s=!0,stencil:r=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:d="default",failIfMajorPerformanceCaveat:f=!1,reversedDepthBuffer:u=!1,outputBufferType:m=Zt}=e;this.isWebGLRenderer=!0;let g;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");g=i.getContextAttributes().alpha}else g=a;const S=m,p=new Set([to,eo,ja]),h=new Set([Zt,xi,ns,ss,Za,Ja]),x=new Uint32Array(4),E=new Int32Array(4),M=new C;let b=null,T=null;const R=[],_=[];let w=null;this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=gi,this.toneMappingExposure=1,this.transmissionResolutionScale=1;const P=this;let D=!1,F=null,W=null,Z=null,O=null;this._outputColorSpace=Yt;let $=0,k=0,J=null,ee=-1,ae=null;const ie=new ot,ve=new ot;let Ae=null;const Qe=new te(0);let We=0,q=t.width,se=t.height,j=1,Pe=null,Fe=null;const De=new ot(0,0,q,se),ht=new ot(0,0,q,se);let ke=!1;const tt=new lo;let Ke=!1,$e=!1;const gt=new Je,Mt=new C,At=new ot,Rt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let lt=!1;function vt(){return J===null?j:1}let I=i;function Vt(y,U){return t.getContext(y,U)}try{const y={alpha:!0,depth:s,stencil:r,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:d,failIfMajorPerformanceCaveat:f};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${Ga}`),t.addEventListener("webglcontextlost",ct,!1),t.addEventListener("webglcontextrestored",rt,!1),t.addEventListener("webglcontextcreationerror",li,!1),I===null){const U="webgl2";if(I=Vt(U,y),I===null)throw Vt(U)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}}catch(y){throw Xe("WebGLRenderer: "+y.message),y}let je,A,v,N,V,H,ne,oe,X,K,le,be,he,ce,Ce,Le,Ne,L,re,Y,ue,me,Q;function Me(){je=new Jf(I),je.init(),ue=new Gm(I,je),A=new Hf(I,je,e,ue),v=new km(I,je),A.reversedDepthBuffer&&u&&v.buffers.depth.setReversed(!0),W=I.createFramebuffer(),Z=I.createFramebuffer(),O=I.createFramebuffer(),N=new ep(I),V=new Tm,H=new Vm(I,je,v,V,A,ue,N),ne=new Zf(P),oe=new nh(I),me=new Vf(I,oe),X=new Qf(I,oe,N,me),K=new ip(I,X,oe,me,N),L=new tp(I,A,H),Ce=new Wf(V),le=new wm(P,ne,je,A,me,Ce),be=new Ym(P,V),he=new Cm,ce=new Um(je),Ne=new kf(P,ne,v,K,g,l),Le=new zm(P,K,A),Q=new Km(I,N,A,v),re=new Gf(I,je,N),Y=new jf(I,je,N),N.programs=le.programs,P.capabilities=A,P.extensions=je,P.properties=V,P.renderLists=he,P.shadowMap=Le,P.state=v,P.info=N}Me(),S!==Zt&&(w=new sp(S,t.width,t.height,o,s,r));const xe=new $m(P,I);this.xr=xe,this.getContext=function(){return I},this.getContextAttributes=function(){return I.getContextAttributes()},this.forceContextLoss=function(){const y=je.get("WEBGL_lose_context");y&&y.loseContext()},this.forceContextRestore=function(){const y=je.get("WEBGL_lose_context");y&&y.restoreContext()},this.getPixelRatio=function(){return j},this.setPixelRatio=function(y){y!==void 0&&(j=y,this.setSize(q,se,!1))},this.getSize=function(y){return y.set(q,se)},this.setSize=function(y,U,G=!0){if(xe.isPresenting){Ie("WebGLRenderer: Can't change size while VR device is presenting.");return}q=y,se=U,t.width=Math.floor(y*j),t.height=Math.floor(U*j),G===!0&&(t.style.width=y+"px",t.style.height=U+"px"),w!==null&&w.setSize(t.width,t.height),this.setViewport(0,0,y,U)},this.getDrawingBufferSize=function(y){return y.set(q*j,se*j).floor()},this.setDrawingBufferSize=function(y,U,G){q=y,se=U,j=G,t.width=Math.floor(y*G),t.height=Math.floor(U*G),this.setViewport(0,0,y,U)},this.setEffects=function(y){if(S===Zt){Xe("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(y){for(let U=0;U<y.length;U++)if(y[U].isOutputPass===!0){Ie("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}w.setEffects(y||[])},this.getCurrentViewport=function(y){return y.copy(ie)},this.getViewport=function(y){return y.copy(De)},this.setViewport=function(y,U,G,B){y.isVector4?De.set(y.x,y.y,y.z,y.w):De.set(y,U,G,B),v.viewport(ie.copy(De).multiplyScalar(j).round())},this.getScissor=function(y){return y.copy(ht)},this.setScissor=function(y,U,G,B){y.isVector4?ht.set(y.x,y.y,y.z,y.w):ht.set(y,U,G,B),v.scissor(ve.copy(ht).multiplyScalar(j).round())},this.getScissorTest=function(){return ke},this.setScissorTest=function(y){v.setScissorTest(ke=y)},this.setOpaqueSort=function(y){Pe=y},this.setTransparentSort=function(y){Fe=y},this.getClearColor=function(y){return y.copy(Ne.getClearColor())},this.setClearColor=function(){Ne.setClearColor(...arguments)},this.getClearAlpha=function(){return Ne.getClearAlpha()},this.setClearAlpha=function(){Ne.setClearAlpha(...arguments)},this.clear=function(y=!0,U=!0,G=!0){let B=0;if(y){let z=!1;if(J!==null){const pe=J.texture.format;z=p.has(pe)}if(z){const pe=J.texture.type,_e=h.has(pe),fe=Ne.getClearColor(),Se=Ne.getClearAlpha(),Ee=fe.r,Oe=fe.g,ze=fe.b;_e?(x[0]=Ee,x[1]=Oe,x[2]=ze,x[3]=Se,I.clearBufferuiv(I.COLOR,0,x)):(E[0]=Ee,E[1]=Oe,E[2]=ze,E[3]=Se,I.clearBufferiv(I.COLOR,0,E))}else B|=I.COLOR_BUFFER_BIT}U&&(B|=I.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),G&&(B|=I.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),B!==0&&I.clear(B)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(y){y.setRenderer(this),F=y},this.dispose=function(){t.removeEventListener("webglcontextlost",ct,!1),t.removeEventListener("webglcontextrestored",rt,!1),t.removeEventListener("webglcontextcreationerror",li,!1),Ne.dispose(),he.dispose(),ce.dispose(),V.dispose(),ne.dispose(),K.dispose(),me.dispose(),Q.dispose(),le.dispose(),xe.dispose(),xe.removeEventListener("sessionstart",_o),xe.removeEventListener("sessionend",xo),qi.stop()};function ct(y){y.preventDefault(),Io("WebGLRenderer: Context Lost."),D=!0}function rt(){Io("WebGLRenderer: Context Restored."),D=!1;const y=N.autoReset,U=Le.enabled,G=Le.autoUpdate,B=Le.needsUpdate,z=Le.type;Me(),N.autoReset=y,Le.enabled=U,Le.autoUpdate=G,Le.needsUpdate=B,Le.type=z}function li(y){Xe("WebGLRenderer: A WebGL context could not be created. Reason: ",y.statusMessage)}function ci(y){const U=y.target;U.removeEventListener("dispose",ci),Ec(U)}function Ec(y){wc(y),V.remove(y)}function wc(y){const U=V.get(y).programs;U!==void 0&&(U.forEach(function(G){le.releaseProgram(G)}),y.isShaderMaterial&&le.releaseShaderCache(y))}this.renderBufferDirect=function(y,U,G,B,z,pe){U===null&&(U=Rt);const _e=z.isMesh&&z.matrixWorld.determinantAffine()<0,fe=Cc(y,U,G,B,z);v.setMaterial(B,_e);let Se=G.index,Ee=1;if(B.wireframe===!0){if(Se=X.getWireframeAttribute(G),Se===void 0)return;Ee=2}const Oe=G.drawRange,ze=G.attributes.position;let we=Oe.start*Ee,et=(Oe.start+Oe.count)*Ee;pe!==null&&(we=Math.max(we,pe.start*Ee),et=Math.min(et,(pe.start+pe.count)*Ee)),Se!==null?(we=Math.max(we,0),et=Math.min(et,Se.count)):ze!=null&&(we=Math.max(we,0),et=Math.min(et,ze.count));const dt=et-we;if(dt<0||dt===1/0)return;me.setup(z,B,fe,G,Se);let ut,it=re;if(Se!==null&&(ut=oe.get(Se),it=Y,it.setIndex(ut)),z.isMesh)B.wireframe===!0?(v.setLineWidth(B.wireframeLinewidth*vt()),it.setMode(I.LINES)):it.setMode(I.TRIANGLES);else if(z.isLine){let Dt=B.linewidth;Dt===void 0&&(Dt=1),v.setLineWidth(Dt*vt()),z.isLineSegments?it.setMode(I.LINES):z.isLineLoop?it.setMode(I.LINE_LOOP):it.setMode(I.LINE_STRIP)}else z.isPoints?it.setMode(I.POINTS):z.isSprite&&it.setMode(I.TRIANGLES);if(z.isBatchedMesh)if(je.get("WEBGL_multi_draw"))it.renderMultiDraw(z._multiDrawStarts,z._multiDrawCounts,z._multiDrawCount);else{const Dt=z._multiDrawStarts,ge=z._multiDrawCounts,Xt=z._multiDrawCount,qe=Se?oe.get(Se).bytesPerElement:1,jt=V.get(B).currentProgram.getUniforms();for(let ui=0;ui<Xt;ui++)jt.setValue(I,"_gl_DrawID",ui),it.render(Dt[ui]/qe,ge[ui])}else if(z.isInstancedMesh)it.renderInstances(we,dt,z.count);else if(G.isInstancedBufferGeometry){const Dt=G._maxInstanceCount!==void 0?G._maxInstanceCount:1/0,ge=Math.min(G.instanceCount,Dt);it.renderInstances(we,dt,ge)}else it.render(we,dt)};function vo(y,U,G){y.transparent===!0&&y.side===Ft&&y.forceSinglePass===!1?(y.side=Ot,y.needsUpdate=!0,hs(y,U,G),y.side=_i,y.needsUpdate=!0,hs(y,U,G),y.side=Ft):hs(y,U,G)}this.compile=function(y,U,G=null){G===null&&(G=y),T=ce.get(G),T.init(U),_.push(T),G.traverseVisible(function(z){z.isLight&&z.layers.test(U.layers)&&(T.pushLight(z),z.castShadow&&T.pushShadow(z))}),y!==G&&y.traverseVisible(function(z){z.isLight&&z.layers.test(U.layers)&&(T.pushLight(z),z.castShadow&&T.pushShadow(z))}),T.setupLights();const B=new Set;return y.traverse(function(z){if(!(z.isMesh||z.isPoints||z.isLine||z.isSprite))return;const pe=z.material;if(pe)if(Array.isArray(pe))for(let _e=0;_e<pe.length;_e++){const fe=pe[_e];vo(fe,G,z),B.add(fe)}else vo(pe,G,z),B.add(pe)}),T=_.pop(),B},this.compileAsync=function(y,U,G=null){const B=this.compile(y,U,G);return new Promise(z=>{function pe(){if(B.forEach(function(_e){V.get(_e).currentProgram.isReady()&&B.delete(_e)}),B.size===0){z(y);return}setTimeout(pe,10)}je.get("KHR_parallel_shader_compile")!==null?pe():setTimeout(pe,10)})};let sr=null;function Tc(y){sr&&sr(y)}function _o(){qi.stop()}function xo(){qi.start()}const qi=new oc;qi.setAnimationLoop(Tc),typeof self<"u"&&qi.setContext(self),this.setAnimationLoop=function(y){sr=y,xe.setAnimationLoop(y),y===null?qi.stop():qi.start()},xe.addEventListener("sessionstart",_o),xe.addEventListener("sessionend",xo),this.render=function(y,U){if(U!==void 0&&U.isCamera!==!0){Xe("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(D===!0)return;F!==null&&F.renderStart(y,U);const G=xe.enabled===!0&&xe.isPresenting===!0,B=w!==null&&(J===null||G)&&w.begin(P,J);if(y.matrixWorldAutoUpdate===!0&&y.updateMatrixWorld(),U.parent===null&&U.matrixWorldAutoUpdate===!0&&U.updateMatrixWorld(),xe.enabled===!0&&xe.isPresenting===!0&&(w===null||w.isCompositing()===!1)&&(xe.cameraAutoUpdate===!0&&xe.updateCamera(U),U=xe.getCamera()),y.isScene===!0&&y.onBeforeRender(P,y,U,J),T=ce.get(y,_.length),T.init(U),T.state.textureUnits=H.getTextureUnits(),_.push(T),gt.multiplyMatrices(U.projectionMatrix,U.matrixWorldInverse),tt.setFromProjectionMatrix(gt,pi,U.reversedDepth),$e=this.localClippingEnabled,Ke=Ce.init(this.clippingPlanes,$e),b=he.get(y,R.length),b.init(),R.push(b),xe.enabled===!0&&xe.isPresenting===!0){const _e=P.xr.getDepthSensingMesh();_e!==null&&rr(_e,U,-1/0,P.sortObjects)}rr(y,U,0,P.sortObjects),b.finish(),P.sortObjects===!0&&b.sort(Pe,Fe,U.reversedDepth),lt=xe.enabled===!1||xe.isPresenting===!1||xe.hasDepthSensing()===!1,lt&&Ne.addToRenderList(b,y),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),Ke===!0&&Ce.beginShadows();const z=T.state.shadowsArray;if(Le.render(z,y,U),Ke===!0&&Ce.endShadows(),(B&&w.hasRenderPass())===!1){const _e=b.opaque,fe=b.transmissive;if(T.setupLights(),U.isArrayCamera){const Se=U.cameras;if(fe.length>0)for(let Ee=0,Oe=Se.length;Ee<Oe;Ee++){const ze=Se[Ee];Mo(_e,fe,y,ze)}lt&&Ne.render(y);for(let Ee=0,Oe=Se.length;Ee<Oe;Ee++){const ze=Se[Ee];So(b,y,ze,ze.viewport)}}else fe.length>0&&Mo(_e,fe,y,U),lt&&Ne.render(y),So(b,y,U)}J!==null&&k===0&&(H.updateMultisampleRenderTarget(J),H.updateRenderTargetMipmap(J)),B&&w.end(P),y.isScene===!0&&y.onAfterRender(P,y,U),me.resetDefaultState(),ee=-1,ae=null,_.pop(),_.length>0?(T=_[_.length-1],H.setTextureUnits(T.state.textureUnits),Ke===!0&&Ce.setGlobalState(P.clippingPlanes,T.state.camera)):T=null,R.pop(),R.length>0?b=R[R.length-1]:b=null,F!==null&&F.renderEnd()};function rr(y,U,G,B){if(y.visible===!1)return;if(y.layers.test(U.layers)){if(y.isGroup)G=y.renderOrder;else if(y.isLOD)y.autoUpdate===!0&&y.update(U);else if(y.isLightProbeGrid)T.pushLightProbeGrid(y);else if(y.isLight)T.pushLight(y),y.castShadow&&T.pushShadow(y);else if(y.isSprite){if(!y.frustumCulled||tt.intersectsSprite(y)){B&&At.setFromMatrixPosition(y.matrixWorld).applyMatrix4(gt);const _e=K.update(y),fe=y.material;fe.visible&&b.push(y,_e,fe,G,At.z,null)}}else if((y.isMesh||y.isLine||y.isPoints)&&(!y.frustumCulled||tt.intersectsObject(y))){const _e=K.update(y),fe=y.material;if(B&&(y.boundingSphere!==void 0?(y.boundingSphere===null&&y.computeBoundingSphere(),At.copy(y.boundingSphere.center)):(_e.boundingSphere===null&&_e.computeBoundingSphere(),At.copy(_e.boundingSphere.center)),At.applyMatrix4(y.matrixWorld).applyMatrix4(gt)),Array.isArray(fe)){const Se=_e.groups;for(let Ee=0,Oe=Se.length;Ee<Oe;Ee++){const ze=Se[Ee],we=fe[ze.materialIndex];we&&we.visible&&b.push(y,_e,we,G,At.z,ze)}}else fe.visible&&b.push(y,_e,fe,G,At.z,null)}}const pe=y.children;for(let _e=0,fe=pe.length;_e<fe;_e++)rr(pe[_e],U,G,B)}function So(y,U,G,B){const{opaque:z,transmissive:pe,transparent:_e}=y;T.setupLightsView(G),Ke===!0&&Ce.setGlobalState(P.clippingPlanes,G),B&&v.viewport(ie.copy(B)),z.length>0&&us(z,U,G),pe.length>0&&us(pe,U,G),_e.length>0&&us(_e,U,G),v.buffers.depth.setTest(!0),v.buffers.depth.setMask(!0),v.buffers.color.setMask(!0),v.setPolygonOffset(!1)}function Mo(y,U,G,B){if((G.isScene===!0?G.overrideMaterial:null)!==null)return;if(T.state.transmissionRenderTarget[B.id]===void 0){const we=je.has("EXT_color_buffer_half_float")||je.has("EXT_color_buffer_float");T.state.transmissionRenderTarget[B.id]=new Wt(1,1,{generateMipmaps:!0,type:we?Jt:Zt,minFilter:en,samples:Math.max(4,A.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Ve.workingColorSpace})}const pe=T.state.transmissionRenderTarget[B.id],_e=B.viewport||ie;pe.setSize(_e.z*P.transmissionResolutionScale,_e.w*P.transmissionResolutionScale);const fe=P.getRenderTarget(),Se=P.getActiveCubeFace(),Ee=P.getActiveMipmapLevel();P.setRenderTarget(pe),P.getClearColor(Qe),We=P.getClearAlpha(),We<1&&P.setClearColor(16777215,.5),P.clear(),lt&&Ne.render(G);const Oe=P.toneMapping;P.toneMapping=gi;const ze=B.viewport;if(B.viewport!==void 0&&(B.viewport=void 0),T.setupLightsView(B),Ke===!0&&Ce.setGlobalState(P.clippingPlanes,B),us(y,G,B),H.updateMultisampleRenderTarget(pe),H.updateRenderTargetMipmap(pe),je.has("WEBGL_multisampled_render_to_texture")===!1){let we=!1;for(let et=0,dt=U.length;et<dt;et++){const ut=U[et],{object:it,geometry:Dt,material:ge,group:Xt}=ut;if(ge.side===Ft&&it.layers.test(B.layers)){const qe=ge.side;ge.side=Ot,ge.needsUpdate=!0,yo(it,G,B,Dt,ge,Xt),ge.side=qe,ge.needsUpdate=!0,we=!0}}we===!0&&(H.updateMultisampleRenderTarget(pe),H.updateRenderTargetMipmap(pe))}P.setRenderTarget(fe,Se,Ee),P.setClearColor(Qe,We),ze!==void 0&&(B.viewport=ze),P.toneMapping=Oe}function us(y,U,G){const B=U.isScene===!0?U.overrideMaterial:null;for(let z=0,pe=y.length;z<pe;z++){const _e=y[z],{object:fe,geometry:Se,group:Ee}=_e;let Oe=_e.material;Oe.allowOverride===!0&&B!==null&&(Oe=B),fe.layers.test(G.layers)&&yo(fe,U,G,Se,Oe,Ee)}}function yo(y,U,G,B,z,pe){y.onBeforeRender(P,U,G,B,z,pe),y.modelViewMatrix.multiplyMatrices(G.matrixWorldInverse,y.matrixWorld),y.normalMatrix.getNormalMatrix(y.modelViewMatrix),z.onBeforeRender(P,U,G,B,y,pe),z.transparent===!0&&z.side===Ft&&z.forceSinglePass===!1?(z.side=Ot,z.needsUpdate=!0,P.renderBufferDirect(G,U,B,z,y,pe),z.side=_i,z.needsUpdate=!0,P.renderBufferDirect(G,U,B,z,y,pe),z.side=Ft):P.renderBufferDirect(G,U,B,z,y,pe),y.onAfterRender(P,U,G,B,z,pe)}function hs(y,U,G){U.isScene!==!0&&(U=Rt);const B=V.get(y),z=T.state.lights,pe=T.state.shadowsArray,_e=z.state.version,fe=le.getParameters(y,z.state,pe,U,G,T.state.lightProbeGridArray),Se=le.getProgramCacheKey(fe);let Ee=B.programs;B.environment=y.isMeshStandardMaterial||y.isMeshLambertMaterial||y.isMeshPhongMaterial?U.environment:null,B.fog=U.fog;const Oe=y.isMeshStandardMaterial||y.isMeshLambertMaterial&&!y.envMap||y.isMeshPhongMaterial&&!y.envMap;B.envMap=ne.get(y.envMap||B.environment,Oe),B.envMapRotation=B.environment!==null&&y.envMap===null?U.environmentRotation:y.envMapRotation,Ee===void 0&&(y.addEventListener("dispose",ci),Ee=new Map,B.programs=Ee);let ze=Ee.get(Se);if(ze!==void 0){if(B.currentProgram===ze&&B.lightsStateVersion===_e)return Eo(y,fe),ze}else fe.uniforms=le.getUniforms(y),F!==null&&y.isNodeMaterial&&F.build(y,G,fe),y.onBeforeCompile(fe,P),ze=le.acquireProgram(fe,Se),Ee.set(Se,ze),B.uniforms=fe.uniforms;const we=B.uniforms;return(!y.isShaderMaterial&&!y.isRawShaderMaterial||y.clipping===!0)&&(we.clippingPlanes=Ce.uniform),Eo(y,fe),B.needsLights=Pc(y),B.lightsStateVersion=_e,B.needsLights&&(we.ambientLightColor.value=z.state.ambient,we.lightProbe.value=z.state.probe,we.directionalLights.value=z.state.directional,we.directionalLightShadows.value=z.state.directionalShadow,we.spotLights.value=z.state.spot,we.spotLightShadows.value=z.state.spotShadow,we.rectAreaLights.value=z.state.rectArea,we.ltc_1.value=z.state.rectAreaLTC1,we.ltc_2.value=z.state.rectAreaLTC2,we.pointLights.value=z.state.point,we.pointLightShadows.value=z.state.pointShadow,we.hemisphereLights.value=z.state.hemi,we.directionalShadowMatrix.value=z.state.directionalShadowMatrix,we.spotLightMatrix.value=z.state.spotLightMatrix,we.spotLightMap.value=z.state.spotLightMap,we.pointShadowMatrix.value=z.state.pointShadowMatrix),B.lightProbeGrid=T.state.lightProbeGridArray.length>0,B.currentProgram=ze,B.uniformsList=null,ze}function bo(y){if(y.uniformsList===null){const U=y.currentProgram.getUniforms();y.uniformsList=Hs.seqWithValue(U.seq,y.uniforms)}return y.uniformsList}function Eo(y,U){const G=V.get(y);G.outputColorSpace=U.outputColorSpace,G.batching=U.batching,G.batchingColor=U.batchingColor,G.instancing=U.instancing,G.instancingColor=U.instancingColor,G.instancingMorph=U.instancingMorph,G.skinning=U.skinning,G.morphTargets=U.morphTargets,G.morphNormals=U.morphNormals,G.morphColors=U.morphColors,G.morphTargetsCount=U.morphTargetsCount,G.numClippingPlanes=U.numClippingPlanes,G.numIntersection=U.numClipIntersection,G.vertexAlphas=U.vertexAlphas,G.vertexTangents=U.vertexTangents,G.toneMapping=U.toneMapping}function Ac(y,U){if(y.length===0)return null;if(y.length===1)return y[0].texture!==null?y[0]:null;M.setFromMatrixPosition(U.matrixWorld);for(let G=0,B=y.length;G<B;G++){const z=y[G];if(z.texture!==null&&z.boundingBox.containsPoint(M))return z}return null}function Cc(y,U,G,B,z){U.isScene!==!0&&(U=Rt),H.resetTextureUnits();const pe=U.fog,_e=B.isMeshStandardMaterial||B.isMeshLambertMaterial||B.isMeshPhongMaterial?U.environment:null,fe=J===null?P.outputColorSpace:J.isXRRenderTarget===!0?J.texture.colorSpace:Ve.workingColorSpace,Se=B.isMeshStandardMaterial||B.isMeshLambertMaterial&&!B.envMap||B.isMeshPhongMaterial&&!B.envMap,Ee=ne.get(B.envMap||_e,Se),Oe=B.vertexColors===!0&&!!G.attributes.color&&G.attributes.color.itemSize===4,ze=!!G.attributes.tangent&&(!!B.normalMap||B.anisotropy>0),we=!!G.morphAttributes.position,et=!!G.morphAttributes.normal,dt=!!G.morphAttributes.color;let ut=gi;B.toneMapped&&(J===null||J.isXRRenderTarget===!0)&&(ut=P.toneMapping);const it=G.morphAttributes.position||G.morphAttributes.normal||G.morphAttributes.color,Dt=it!==void 0?it.length:0,ge=V.get(B),Xt=T.state.lights;if(Ke===!0&&($e===!0||y!==ae)){const at=y===ae&&B.id===ee;Ce.setState(B,y,at)}let qe=!1;B.version===ge.__version?(ge.needsLights&&ge.lightsStateVersion!==Xt.state.version||ge.outputColorSpace!==fe||z.isBatchedMesh&&ge.batching===!1||!z.isBatchedMesh&&ge.batching===!0||z.isBatchedMesh&&ge.batchingColor===!0&&z.colorTexture===null||z.isBatchedMesh&&ge.batchingColor===!1&&z.colorTexture!==null||z.isInstancedMesh&&ge.instancing===!1||!z.isInstancedMesh&&ge.instancing===!0||z.isSkinnedMesh&&ge.skinning===!1||!z.isSkinnedMesh&&ge.skinning===!0||z.isInstancedMesh&&ge.instancingColor===!0&&z.instanceColor===null||z.isInstancedMesh&&ge.instancingColor===!1&&z.instanceColor!==null||z.isInstancedMesh&&ge.instancingMorph===!0&&z.morphTexture===null||z.isInstancedMesh&&ge.instancingMorph===!1&&z.morphTexture!==null||ge.envMap!==Ee||B.fog===!0&&ge.fog!==pe||ge.numClippingPlanes!==void 0&&(ge.numClippingPlanes!==Ce.numPlanes||ge.numIntersection!==Ce.numIntersection)||ge.vertexAlphas!==Oe||ge.vertexTangents!==ze||ge.morphTargets!==we||ge.morphNormals!==et||ge.morphColors!==dt||ge.toneMapping!==ut||ge.morphTargetsCount!==Dt||!!ge.lightProbeGrid!=T.state.lightProbeGridArray.length>0)&&(qe=!0):(qe=!0,ge.__version=B.version);let jt=ge.currentProgram;qe===!0&&(jt=hs(B,U,z),F&&B.isNodeMaterial&&F.onUpdateProgram(B,jt,ge));let ui=!1,Li=!1,ln=!1;const nt=jt.getUniforms(),ft=ge.uniforms;if(v.useProgram(jt.program)&&(ui=!0,Li=!0,ln=!0),B.id!==ee&&(ee=B.id,Li=!0),ge.needsLights){const at=Ac(T.state.lightProbeGridArray,z);ge.lightProbeGrid!==at&&(ge.lightProbeGrid=at,Li=!0)}if(ui||ae!==y){v.buffers.depth.getReversed()&&y.reversedDepth!==!0&&(y._reversedDepth=!0,y.updateProjectionMatrix()),nt.setValue(I,"projectionMatrix",y.projectionMatrix),nt.setValue(I,"viewMatrix",y.matrixWorldInverse);const Ui=nt.map.cameraPosition;Ui!==void 0&&Ui.setValue(I,Mt.setFromMatrixPosition(y.matrixWorld)),A.logarithmicDepthBuffer&&nt.setValue(I,"logDepthBufFC",2/(Math.log(y.far+1)/Math.LN2)),(B.isMeshPhongMaterial||B.isMeshToonMaterial||B.isMeshLambertMaterial||B.isMeshBasicMaterial||B.isMeshStandardMaterial||B.isShaderMaterial)&&nt.setValue(I,"isOrthographic",y.isOrthographicCamera===!0),ae!==y&&(ae=y,Li=!0,ln=!0)}if(ge.needsLights&&(Xt.state.directionalShadowMap.length>0&&nt.setValue(I,"directionalShadowMap",Xt.state.directionalShadowMap,H),Xt.state.spotShadowMap.length>0&&nt.setValue(I,"spotShadowMap",Xt.state.spotShadowMap,H),Xt.state.pointShadowMap.length>0&&nt.setValue(I,"pointShadowMap",Xt.state.pointShadowMap,H)),z.isSkinnedMesh){nt.setOptional(I,z,"bindMatrix"),nt.setOptional(I,z,"bindMatrixInverse");const at=z.skeleton;at&&(at.boneTexture===null&&at.computeBoneTexture(),nt.setValue(I,"boneTexture",at.boneTexture,H))}z.isBatchedMesh&&(nt.setOptional(I,z,"batchingTexture"),nt.setValue(I,"batchingTexture",z._matricesTexture,H),nt.setOptional(I,z,"batchingIdTexture"),nt.setValue(I,"batchingIdTexture",z._indirectTexture,H),nt.setOptional(I,z,"batchingColorTexture"),z._colorsTexture!==null&&nt.setValue(I,"batchingColorTexture",z._colorsTexture,H));const Ii=G.morphAttributes;if((Ii.position!==void 0||Ii.normal!==void 0||Ii.color!==void 0)&&L.update(z,G,jt),(Li||ge.receiveShadow!==z.receiveShadow)&&(ge.receiveShadow=z.receiveShadow,nt.setValue(I,"receiveShadow",z.receiveShadow)),(B.isMeshStandardMaterial||B.isMeshLambertMaterial||B.isMeshPhongMaterial)&&B.envMap===null&&U.environment!==null&&(ft.envMapIntensity.value=U.environmentIntensity),ft.dfgLUT!==void 0&&(ft.dfgLUT.value=Jm()),Li){if(nt.setValue(I,"toneMappingExposure",P.toneMappingExposure),ge.needsLights&&Rc(ft,ln),pe&&B.fog===!0&&be.refreshFogUniforms(ft,pe),be.refreshMaterialUniforms(ft,B,j,se,T.state.transmissionRenderTarget[y.id]),ge.needsLights&&ge.lightProbeGrid){const at=ge.lightProbeGrid;ft.probesSH.value=at.texture,ft.probesMin.value.copy(at.boundingBox.min),ft.probesMax.value.copy(at.boundingBox.max),ft.probesResolution.value.copy(at.resolution)}Hs.upload(I,bo(ge),ft,H)}if(B.isShaderMaterial&&B.uniformsNeedUpdate===!0&&(Hs.upload(I,bo(ge),ft,H),B.uniformsNeedUpdate=!1),B.isSpriteMaterial&&nt.setValue(I,"center",z.center),nt.setValue(I,"modelViewMatrix",z.modelViewMatrix),nt.setValue(I,"normalMatrix",z.normalMatrix),nt.setValue(I,"modelMatrix",z.matrixWorld),B.uniformsGroups!==void 0){const at=B.uniformsGroups;for(let Ui=0,cn=at.length;Ui<cn;Ui++){const wo=at[Ui];Q.update(wo,jt),Q.bind(wo,jt)}}return jt}function Rc(y,U){y.ambientLightColor.needsUpdate=U,y.lightProbe.needsUpdate=U,y.directionalLights.needsUpdate=U,y.directionalLightShadows.needsUpdate=U,y.pointLights.needsUpdate=U,y.pointLightShadows.needsUpdate=U,y.spotLights.needsUpdate=U,y.spotLightShadows.needsUpdate=U,y.rectAreaLights.needsUpdate=U,y.hemisphereLights.needsUpdate=U}function Pc(y){return y.isMeshLambertMaterial||y.isMeshToonMaterial||y.isMeshPhongMaterial||y.isMeshStandardMaterial||y.isShadowMaterial||y.isShaderMaterial&&y.lights===!0}this.getActiveCubeFace=function(){return $},this.getActiveMipmapLevel=function(){return k},this.getRenderTarget=function(){return J},this.setRenderTargetTextures=function(y,U,G){const B=V.get(y);B.__autoAllocateDepthBuffer=y.resolveDepthBuffer===!1,B.__autoAllocateDepthBuffer===!1&&(B.__useRenderToTexture=!1),V.get(y.texture).__webglTexture=U,V.get(y.depthTexture).__webglTexture=B.__autoAllocateDepthBuffer?void 0:G,B.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(y,U){const G=V.get(y);G.__webglFramebuffer=U,G.__useDefaultFramebuffer=U===void 0},this.setRenderTarget=function(y,U=0,G=0){J=y,$=U,k=G;let B=null,z=!1,pe=!1;if(y){const fe=V.get(y);if(fe.__useDefaultFramebuffer!==void 0){v.bindFramebuffer(I.FRAMEBUFFER,fe.__webglFramebuffer),ie.copy(y.viewport),ve.copy(y.scissor),Ae=y.scissorTest,v.viewport(ie),v.scissor(ve),v.setScissorTest(Ae),ee=-1;return}else if(fe.__webglFramebuffer===void 0)H.setupRenderTarget(y);else if(fe.__hasExternalTextures)H.rebindTextures(y,V.get(y.texture).__webglTexture,V.get(y.depthTexture).__webglTexture);else if(y.depthBuffer){const Oe=y.depthTexture;if(fe.__boundDepthTexture!==Oe){if(Oe!==null&&V.has(Oe)&&(y.width!==Oe.image.width||y.height!==Oe.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");H.setupDepthRenderbuffer(y)}}const Se=y.texture;(Se.isData3DTexture||Se.isDataArrayTexture||Se.isCompressedArrayTexture)&&(pe=!0);const Ee=V.get(y).__webglFramebuffer;y.isWebGLCubeRenderTarget?(Array.isArray(Ee[U])?B=Ee[U][G]:B=Ee[U],z=!0):y.samples>0&&H.useMultisampledRTT(y)===!1?B=V.get(y).__webglMultisampledFramebuffer:Array.isArray(Ee)?B=Ee[G]:B=Ee,ie.copy(y.viewport),ve.copy(y.scissor),Ae=y.scissorTest}else ie.copy(De).multiplyScalar(j).floor(),ve.copy(ht).multiplyScalar(j).floor(),Ae=ke;if(G!==0&&(B=W),v.bindFramebuffer(I.FRAMEBUFFER,B)&&v.drawBuffers(y,B),v.viewport(ie),v.scissor(ve),v.setScissorTest(Ae),z){const fe=V.get(y.texture);I.framebufferTexture2D(I.FRAMEBUFFER,I.COLOR_ATTACHMENT0,I.TEXTURE_CUBE_MAP_POSITIVE_X+U,fe.__webglTexture,G)}else if(pe){const fe=U;for(let Se=0;Se<y.textures.length;Se++){const Ee=V.get(y.textures[Se]);I.framebufferTextureLayer(I.FRAMEBUFFER,I.COLOR_ATTACHMENT0+Se,Ee.__webglTexture,G,fe)}}else if(y!==null&&G!==0){const fe=V.get(y.texture);I.framebufferTexture2D(I.FRAMEBUFFER,I.COLOR_ATTACHMENT0,I.TEXTURE_2D,fe.__webglTexture,G)}ee=-1},this.readRenderTargetPixels=function(y,U,G,B,z,pe,_e,fe=0){if(!(y&&y.isWebGLRenderTarget)){Xe("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Se=V.get(y).__webglFramebuffer;if(y.isWebGLCubeRenderTarget&&_e!==void 0&&(Se=Se[_e]),Se){v.bindFramebuffer(I.FRAMEBUFFER,Se);try{const Ee=y.textures[fe],Oe=Ee.format,ze=Ee.type;if(y.textures.length>1&&I.readBuffer(I.COLOR_ATTACHMENT0+fe),!A.textureFormatReadable(Oe)){Xe("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!A.textureTypeReadable(ze)){Xe("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}U>=0&&U<=y.width-B&&G>=0&&G<=y.height-z&&I.readPixels(U,G,B,z,ue.convert(Oe),ue.convert(ze),pe)}finally{const Ee=J!==null?V.get(J).__webglFramebuffer:null;v.bindFramebuffer(I.FRAMEBUFFER,Ee)}}},this.readRenderTargetPixelsAsync=async function(y,U,G,B,z,pe,_e,fe=0){if(!(y&&y.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Se=V.get(y).__webglFramebuffer;if(y.isWebGLCubeRenderTarget&&_e!==void 0&&(Se=Se[_e]),Se)if(U>=0&&U<=y.width-B&&G>=0&&G<=y.height-z){v.bindFramebuffer(I.FRAMEBUFFER,Se);const Ee=y.textures[fe],Oe=Ee.format,ze=Ee.type;if(y.textures.length>1&&I.readBuffer(I.COLOR_ATTACHMENT0+fe),!A.textureFormatReadable(Oe))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!A.textureTypeReadable(ze))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");const we=I.createBuffer();I.bindBuffer(I.PIXEL_PACK_BUFFER,we),I.bufferData(I.PIXEL_PACK_BUFFER,pe.byteLength,I.STREAM_READ),I.readPixels(U,G,B,z,ue.convert(Oe),ue.convert(ze),0);const et=J!==null?V.get(J).__webglFramebuffer:null;v.bindFramebuffer(I.FRAMEBUFFER,et);const dt=I.fenceSync(I.SYNC_GPU_COMMANDS_COMPLETE,0);return I.flush(),await hu(I,dt,4),I.bindBuffer(I.PIXEL_PACK_BUFFER,we),I.getBufferSubData(I.PIXEL_PACK_BUFFER,0,pe),I.deleteBuffer(we),I.deleteSync(dt),pe}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(y,U=null,G=0){const B=Math.pow(2,-G),z=Math.floor(y.image.width*B),pe=Math.floor(y.image.height*B),_e=U!==null?U.x:0,fe=U!==null?U.y:0;H.setTexture2D(y,0),I.copyTexSubImage2D(I.TEXTURE_2D,G,0,0,_e,fe,z,pe),v.unbindTexture()},this.copyTextureToTexture=function(y,U,G=null,B=null,z=0,pe=0){let _e,fe,Se,Ee,Oe,ze,we,et,dt;const ut=y.isCompressedTexture?y.mipmaps[pe]:y.image;if(G!==null)_e=G.max.x-G.min.x,fe=G.max.y-G.min.y,Se=G.isBox3?G.max.z-G.min.z:1,Ee=G.min.x,Oe=G.min.y,ze=G.isBox3?G.min.z:0;else{const ft=Math.pow(2,-z);_e=Math.floor(ut.width*ft),fe=Math.floor(ut.height*ft),y.isDataArrayTexture?Se=ut.depth:y.isData3DTexture?Se=Math.floor(ut.depth*ft):Se=1,Ee=0,Oe=0,ze=0}B!==null?(we=B.x,et=B.y,dt=B.z):(we=0,et=0,dt=0);const it=ue.convert(U.format),Dt=ue.convert(U.type);let ge;U.isData3DTexture?(H.setTexture3D(U,0),ge=I.TEXTURE_3D):U.isDataArrayTexture||U.isCompressedArrayTexture?(H.setTexture2DArray(U,0),ge=I.TEXTURE_2D_ARRAY):(H.setTexture2D(U,0),ge=I.TEXTURE_2D),v.activeTexture(I.TEXTURE0),v.pixelStorei(I.UNPACK_FLIP_Y_WEBGL,U.flipY),v.pixelStorei(I.UNPACK_PREMULTIPLY_ALPHA_WEBGL,U.premultiplyAlpha),v.pixelStorei(I.UNPACK_ALIGNMENT,U.unpackAlignment);const Xt=v.getParameter(I.UNPACK_ROW_LENGTH),qe=v.getParameter(I.UNPACK_IMAGE_HEIGHT),jt=v.getParameter(I.UNPACK_SKIP_PIXELS),ui=v.getParameter(I.UNPACK_SKIP_ROWS),Li=v.getParameter(I.UNPACK_SKIP_IMAGES);v.pixelStorei(I.UNPACK_ROW_LENGTH,ut.width),v.pixelStorei(I.UNPACK_IMAGE_HEIGHT,ut.height),v.pixelStorei(I.UNPACK_SKIP_PIXELS,Ee),v.pixelStorei(I.UNPACK_SKIP_ROWS,Oe),v.pixelStorei(I.UNPACK_SKIP_IMAGES,ze);const ln=y.isDataArrayTexture||y.isData3DTexture,nt=U.isDataArrayTexture||U.isData3DTexture;if(y.isDepthTexture){const ft=V.get(y),Ii=V.get(U),at=V.get(ft.__renderTarget),Ui=V.get(Ii.__renderTarget);v.bindFramebuffer(I.READ_FRAMEBUFFER,at.__webglFramebuffer),v.bindFramebuffer(I.DRAW_FRAMEBUFFER,Ui.__webglFramebuffer);for(let cn=0;cn<Se;cn++)ln&&(I.framebufferTextureLayer(I.READ_FRAMEBUFFER,I.COLOR_ATTACHMENT0,V.get(y).__webglTexture,z,ze+cn),I.framebufferTextureLayer(I.DRAW_FRAMEBUFFER,I.COLOR_ATTACHMENT0,V.get(U).__webglTexture,pe,dt+cn)),I.blitFramebuffer(Ee,Oe,_e,fe,we,et,_e,fe,I.DEPTH_BUFFER_BIT,I.NEAREST);v.bindFramebuffer(I.READ_FRAMEBUFFER,null),v.bindFramebuffer(I.DRAW_FRAMEBUFFER,null)}else if(z!==0||y.isRenderTargetTexture||V.has(y)){const ft=V.get(y),Ii=V.get(U);v.bindFramebuffer(I.READ_FRAMEBUFFER,Z),v.bindFramebuffer(I.DRAW_FRAMEBUFFER,O);for(let at=0;at<Se;at++)ln?I.framebufferTextureLayer(I.READ_FRAMEBUFFER,I.COLOR_ATTACHMENT0,ft.__webglTexture,z,ze+at):I.framebufferTexture2D(I.READ_FRAMEBUFFER,I.COLOR_ATTACHMENT0,I.TEXTURE_2D,ft.__webglTexture,z),nt?I.framebufferTextureLayer(I.DRAW_FRAMEBUFFER,I.COLOR_ATTACHMENT0,Ii.__webglTexture,pe,dt+at):I.framebufferTexture2D(I.DRAW_FRAMEBUFFER,I.COLOR_ATTACHMENT0,I.TEXTURE_2D,Ii.__webglTexture,pe),z!==0?I.blitFramebuffer(Ee,Oe,_e,fe,we,et,_e,fe,I.COLOR_BUFFER_BIT,I.NEAREST):nt?I.copyTexSubImage3D(ge,pe,we,et,dt+at,Ee,Oe,_e,fe):I.copyTexSubImage2D(ge,pe,we,et,Ee,Oe,_e,fe);v.bindFramebuffer(I.READ_FRAMEBUFFER,null),v.bindFramebuffer(I.DRAW_FRAMEBUFFER,null)}else nt?y.isDataTexture||y.isData3DTexture?I.texSubImage3D(ge,pe,we,et,dt,_e,fe,Se,it,Dt,ut.data):U.isCompressedArrayTexture?I.compressedTexSubImage3D(ge,pe,we,et,dt,_e,fe,Se,it,ut.data):I.texSubImage3D(ge,pe,we,et,dt,_e,fe,Se,it,Dt,ut):y.isDataTexture?I.texSubImage2D(I.TEXTURE_2D,pe,we,et,_e,fe,it,Dt,ut.data):y.isCompressedTexture?I.compressedTexSubImage2D(I.TEXTURE_2D,pe,we,et,ut.width,ut.height,it,ut.data):I.texSubImage2D(I.TEXTURE_2D,pe,we,et,_e,fe,it,Dt,ut);v.pixelStorei(I.UNPACK_ROW_LENGTH,Xt),v.pixelStorei(I.UNPACK_IMAGE_HEIGHT,qe),v.pixelStorei(I.UNPACK_SKIP_PIXELS,jt),v.pixelStorei(I.UNPACK_SKIP_ROWS,ui),v.pixelStorei(I.UNPACK_SKIP_IMAGES,Li),pe===0&&U.generateMipmaps&&I.generateMipmap(ge),v.unbindTexture()},this.initRenderTarget=function(y){V.get(y).__webglFramebuffer===void 0&&H.setupRenderTarget(y)},this.initTexture=function(y){y.isCubeTexture?H.setTextureCube(y,0):y.isData3DTexture?H.setTexture3D(y,0):y.isDataArrayTexture||y.isCompressedArrayTexture?H.setTexture2DArray(y,0):H.setTexture2D(y,0),v.unbindTexture()},this.resetState=function(){$=0,k=0,J=null,v.reset(),me.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return pi}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;const t=this.getContext();t.drawingBufferColorSpace=Ve._getDrawingBufferColorSpace(e),t.unpackColorSpace=Ve._getUnpackColorSpace()}}const Ut={renderer:{exposure:1.05,shadows:!0,maxPixelRatio:2,antialias:!0},post:{enabled:!0,bloomStrength:.44,bloomRadius:.62,bloomThreshold:.82,grade:!0,contrast:1.06,saturation:1.12,lift:-.006,vignette:.42,chromatic:.0016,grain:.028,distortionAmount:0},camera:{fov:46,distance:20.5,height:7.4,azimuth:.62,polar:1.02,minPolar:.22,maxPolar:1.46,minDistance:6,maxDistance:42,damping:7.5,target:{x:0,y:1.6,z:0},orbitSpeed:.0042,zoomSpeed:.0016},world:{fogColor:"#070a11",fogNear:26,fogFar:78,ambient:"#1a2740",ambientIntensity:.55,keyColor:"#9fc4ff",keyIntensity:1.35,keyAngle:2.35,keyHeight:14,rimColor:"#4b7ac0",rimIntensity:1.1,fillColor:"#2a3b5c",fillIntensity:.42},ground:{size:120,baseColor:"#0d131d",crackColor:"#060a10",grainColor:"#1b2739",tileScale:.42,grainScale:6.2,roughness:.86,metalness:.02,gridStrength:.18,gridScale:2,gridColor:"#1d3350",falloff:.6,reflect:.24},dust:{enabled:!0,count:900,radius:26,height:9,size:.035,color:"#7fa8d8",opacity:.36,drift:.12,swirl:.09},caster:{height:1.82,color:"#101724",accent:"#5fd8ff",accentPower:2.2,breathe:.035,breatheSpeed:1.1,castLunge:.34,castWindup:.22,castRecover:.42,handHeight:1.28,handForward:.55},aim:{color:"#6fd6ff",invalidColor:"#ff5a52",width:1.35,edgeWidth:.06,fill:.14,glow:.55,arrowLength:2.1,arrowWidth:1.9,chevrons:4,chevronSpeed:1.35,chevronSharpness:2.6,pulseSpeed:2.4,pulseDepth:.18,fadeIn:.09,height:.028,zone:{rimWidth:.34,rimGlow:.9,fill:.09,innerRing:.62,ticks:48,tickLength:.22,spinSpeed:.35}},particles:{budget:6e4,softness:.55,globalScale:1,globalOpacity:1},abilities:{frost:{label:"Frost Lance",key:"Q",aimMode:"line",range:12.5,minRange:2.2,cooldown:.85,castTime:.16,duration:3.6,front:{speed:26,width:1.5,thickness:.4,glow:1.5,color:"#cdf4ff"},crystals:{count:96,spread:.62,spreadGrowth:1.75,sizeNear:.34,sizeFar:1.32,sizeJitter:.42,heightScale:2.35,tilt:.42,riseTime:.19,overshoot:2.1,holdTime:1.5,sinkTime:.9,clusterCount:22,clusterRadius:1.9,clusterScale:1.35,segments:6},ice:{colorDeep:"#0d4f74",colorMid:"#57c8ee",colorEdge:"#e7fbff",rimPower:2.4,rimStrength:1.55,interiorScale:3.4,interiorStrength:.55,opacity:.9,refraction:.16,sparkle:.4,sparkleScale:13,emissive:.62},decal:{radius:1.9,radiusFar:3.1,color:"#9fe8ff",opacity:.72,growTime:.3,fade:1.9,rimeScale:3.4,rimeSharp:1.9,crackStrength:.62},fx:{mistCount:4,mistSize:1.1,chipCount:5,chipSpeed:6.4,glitterCount:4,impactMist:60,impactChips:70,impactGlitter:110,shake:.32,flash:.1,lightIntensity:26,lightColor:"#8ddcff",lightDecay:.5}},storm:{label:"Storm Lance",key:"E",aimMode:"line",range:13.5,minRange:2,cooldown:.7,castTime:.1,duration:1.55,front:{speed:62,headSize:.95,headGlow:2.6},bolt:{filaments:7,segments:96,width:.17,widthJitter:.55,chaos:.52,chaosScale:1.5,chaosDetail:3.4,chaosSpeed:14,sag:.22,spiral:.42,taper:.55,restrikeRate:15,restrikeDepth:.68,holdTime:.34,blowout:.28,colorCore:"#ffffff",colorMid:"#a9c8ff",colorEdge:"#7b4dff",intensity:1.45},shell:{radius:2.05,thickness:.28,color:"#b6d4ff",opacity:.3,life:.5,rings:3,noise:.42},decal:{radius:2.6,burnColor:"#c9d8ff",scorchColor:"#08090d",opacity:.5,branchScale:5.4,branchSharp:24,flicker:8,burnFade:.9,scorchFade:5.5,trailWidth:.85},fx:{sparkRate:240,sparkSpeed:9.5,sparkLife:.55,sparkSize:.11,impactSparks:220,smokeCount:26,shake:.55,flash:.3,lightIntensity:60,lightColor:"#b9caff",lightFlicker:24}},cinder:{label:"Cinder Fall",key:"R",aimMode:"line",range:13,minRange:3.5,cooldown:1.3,castTime:.24,duration:6.5,flight:{speed:13.5,arc:4.6,spin:3.2,radius:.52,detail:3,craterCount:9,craterDepth:.3,fractureCount:5,fractureDepth:.16},rock:{colorCold:"#1b1310",colorHot:"#ff6a1e",colorCore:"#ffe6a3",seamScale:3.1,seamWidth:.2,seamGrowth:2.4,emissive:2.6,roughness:.92,rimHeat:.75},wake:{length:3.4,radius:.95,steps:24,density:1.35,noiseScale:1.9,noiseSpeed:2.4,rise:1.15,colorInner:"#fff0c0",colorMid:"#ff7a1c",colorOuter:"#5a1602",absorption:1.45},impact:{blastRadius:4.6,blastSpeed:12,blastThickness:.65,chunkCount:34,chunkSpeed:9.5,chunkSpin:9,chunkSize:.34,chunkBounce:.34,craterRadius:3.4,crackReach:5.2,crackWidth:.055,crackScale:1.35,crackColor:"#ff7420",crackCoreColor:"#ffe7b4",scorchColor:"#0a0705",glowFade:4.6,scorchFade:6.5},fx:{trailEmbers:150,trailSmoke:42,impactEmbers:320,impactSmoke:90,emberSpeed:7.5,emberLife:1.9,smokeLife:3.1,smokeSize:2.6,shake:.95,flash:.45,lightIntensity:90,lightColor:"#ff8a34",lightFade:2.4}},nova:{label:"Nova Beam",key:"F",aimMode:"line",range:15,minRange:2.5,cooldown:2.2,castTime:.62,duration:4.4,windup:{time:.62,radius:.42,moteCount:220,moteRadius:3.2,moteSize:.09,coreColor:"#fff8e0",haloColor:"#8fe9ff",pulse:9},beam:{growTime:.14,holdTime:1.35,collapseTime:.55,radiusCore:.16,radiusSheath:.38,radiusOuter:.7,segments:128,radial:24,swell:.38,swellFreq:3.4,flowSpeed:5.2,noiseScale:2.2,colorCore:"#ffffff",colorSheath:"#6fe6ff",colorOuter:"#2b6cff",intensity:.85,sheathOpacity:.3,outerOpacity:.1},ribbons:{count:4,turns:3.2,radius:.72,width:.11,speed:2.4,color:"#ffd98a",intensity:1.5,taper:.4},discs:{count:7,radius:1.15,thickness:.11,speed:11,color:"#dff6ff",intensity:1.3},decal:{width:1.5,color:"#9ee9ff",coreColor:"#fffbe8",opacity:.45,fade:2.6,scorchFade:4.4,noiseScale:2.8},fx:{sprayRate:260,spraySpeed:8,sprayLife:.85,impactSpray:260,shake:.6,flash:.55,lightIntensity:120,lightColor:"#bff0ff"}},snare:{label:"Voltaic Snare",key:"V",aimMode:"zone",range:11,minRange:0,radius:3.6,cooldown:1.6,castTime:.18,duration:4.8,leash:{speed:30,width:.13,chaos:.34,chaosSpeed:12,segments:72,color:"#c69bff",intensity:1.4},snap:{overshoot:1.28,snapTime:.26,settleTime:.34,rimWidth:.2,rimIntensity:2.6},column:{radius:.85,height:5.4,flare:1.55,segments:40,radial:22,noiseScale:2.6,flowSpeed:3.4,colorCore:"#f0e2ff",colorMid:"#a45cff",colorEdge:"#3d17a8",intensity:1.6,opacity:.5},tendrils:{count:9,segments:48,width:.09,wander:.55,crawlTime:.42,restrike:6.5,color:"#c9a2ff",intensity:1.4},arcs:{count:5,width:.08,speed:2.2,lift:.55,color:"#e2ccff",intensity:1.6},disc:{color:"#a05cff",rimColor:"#e8d6ff",opacity:.45,noiseScale:3.2,churn:1.4,fade:1.1},fx:{sparkRate:190,sparkSpeed:5.5,haulRate:130,haulSpeed:6.5,shake:.4,flash:.22,lightIntensity:55,lightColor:"#b779ff"}},glacier:{label:"Glacier Crown",key:"C",aimMode:"zone",range:10.5,minRange:0,radius:4.2,cooldown:2.6,castTime:.3,duration:6.2,crown:{shards:16,rings:2,innerScale:.55,height:4.6,heightJitter:.42,thickness:.62,lean:.34,twist:.28,riseTime:.42,riseStagger:.24,overshoot:1.55,holdTime:2.6,sinkTime:1.3,segments:7},spire:{enabled:!0,height:6.8,radius:1.05,riseTime:.55,overshoot:1.25,twist:.55},ice:{colorDeep:"#0a3f68",colorMid:"#4fbfe8",colorEdge:"#eafcff",rimPower:2.6,rimStrength:1.7,interiorScale:2.4,interiorStrength:.62,opacity:.92,refraction:.18,sparkle:.45,sparkleScale:11,emissive:.58},shock:{speed:9,width:.85,color:"#cdf2ff",intensity:1.6},decal:{color:"#a8ecff",opacity:.8,growTime:.45,fade:3.2,rimeScale:2.6,rimeSharp:2.2,shatterRings:3},fx:{mistCount:90,chipCount:120,glitterCount:160,mistSize:1.4,chipSpeed:8.5,shake:.72,flash:.26,lightIntensity:48,lightColor:"#9fe4ff"}}}};function jm(n=Ut){return structuredClone(n)}const e0=jm(Ut);function za(n,e){for(const t of Object.keys(e)){const i=e[t];i&&typeof i=="object"&&!Array.isArray(i)?((!n[t]||typeof n[t]!="object")&&(n[t]={}),za(n[t],i)):n[t]=i}return n}const mc=["frost","storm","cinder","nova","snare","glacier"];function t0(n,e){const t=new Qm({canvas:n,antialias:e.renderer.antialias,powerPreference:"high-performance",stencil:!1,alpha:!1});return t.setPixelRatio(Math.min(window.devicePixelRatio,e.renderer.maxPixelRatio)),t.setSize(window.innerWidth,window.innerHeight),t.outputColorSpace=Yt,t.toneMapping=Zs,t.toneMappingExposure=e.renderer.exposure,t.shadowMap.enabled=e.renderer.shadows,t.shadowMap.type=jn,t.setClearColor(329483,1),t.autoClear=!0,t}const Ht=Math.PI*2,Rl=(n,e,t)=>n<e?e:n>t?t:n,pt=n=>n<0?0:n>1?1:n,zt=(n,e,t)=>n+(e-n)*t,i0=(n,e,t)=>e===n?0:(t-n)/(e-n),n0=(n,e,t)=>{const i=pt(i0(n,e,t));return i*i*(3-2*i)},gc=n=>1-Math.pow(1-n,3),vc=(n,e=1.7)=>{const t=e+1,i=n-1;return 1+t*i*i*i+e*i*i};class nr{constructor(e=2654435769){this.s=e>>>0||1}next(){let e=this.s;return e^=e<<13,e^=e>>>17,e^=e<<5,this.s=e>>>0,this.s/4294967295}range(e,t){return e+(t-e)*this.next()}int(e,t){return Math.floor(this.range(e,t+1))}spread(e){return(this.next()*2-1)*e}sign(){return this.next()<.5?-1:1}pick(e){return e[Math.min(e.length-1,Math.floor(this.next()*e.length))]}disc(e={x:0,y:0}){const t=Math.sqrt(this.next()),i=this.next()*Ht;return e.x=Math.cos(i)*t,e.y=Math.sin(i)*t,e}cone(e,t={x:0,y:0,z:0}){const i=Math.cos(e),s=zt(i,1,this.next()),r=Math.sqrt(Math.max(0,1-s*s)),a=this.next()*Ht;return t.x=Math.cos(a)*r,t.y=Math.sin(a)*r,t.z=s,t}}const ye=new nr(Math.random()*4294967295>>>0);function Wi(n,e,t,i){return zt(n,e,1-Math.exp(-t*i))}class s0{constructor(e){this.settings=e;const t=e.camera;this.camera=new Kt(t.fov,1,.1,400),this.target=new C(t.target.x,t.target.y,t.target.z),this.azimuth=t.azimuth,this.polar=t.polar,this.distance=t.distance,this._azimuth=this.azimuth,this._polar=this.polar,this._distance=this.distance,this.trauma=0,this.traumaDecay=1.5,this._shake=new C,this._offset=new C,this._seed=Math.random()*1e3}orbit(e,t){const i=this.settings.camera;this.azimuth-=e*i.orbitSpeed,this.polar=Rl(this.polar-t*i.orbitSpeed,i.minPolar,i.maxPolar),this.azimuth>Ht&&(this.azimuth-=Ht),this.azimuth<-Ht&&(this.azimuth+=Ht)}zoom(e){const t=this.settings.camera;this.distance=Rl(this.distance+e*t.zoomSpeed*this.distance,t.minDistance,t.maxDistance)}shake(e){this.trauma=Math.min(1,this.trauma+e)}resize(e,t){this.camera.aspect=e/t,this.camera.updateProjectionMatrix()}update(e,t){const i=this.settings.camera;this.camera.fov=i.fov,this._azimuth=Wi(this._azimuth,this.azimuth,i.damping,e),this._polar=Wi(this._polar,this.polar,i.damping,e),this._distance=Wi(this._distance,this.distance,i.damping,e);const s=Math.sin(this._polar);this._offset.set(s*Math.sin(this._azimuth),Math.cos(this._polar),s*Math.cos(this._azimuth)).multiplyScalar(this._distance),this.target.set(i.target.x,i.target.y,i.target.z),this.camera.position.copy(this.target).add(this._offset),this.trauma=Math.max(0,this.trauma-this.traumaDecay*e);const r=this.trauma*this.trauma;if(r>1e-4){const a=(t+this._seed)*34;this._shake.set(Math.sin(a*1.13)*Math.sin(a*.37),Math.sin(a*1.71+1.4)*Math.sin(a*.53),Math.sin(a*.97+2.6)*Math.sin(a*.41)).multiplyScalar(r*.42),this.camera.position.add(this._shake)}this.camera.lookAt(this.target),r>1e-4&&this.camera.rotateZ(Math.sin((t+this._seed)*26)*r*.035),this.camera.updateProjectionMatrix()}}class r0{constructor(){this.wall=0,this.sim=0,this.delta=0,this.simDelta=0,this.frame=0,this.scale=1,this.paused=!1,this._last=performance.now()/1e3,this._fpsAccum=0,this._fpsFrames=0,this.fps=60}tick(){const e=performance.now()/1e3;return this.delta=Math.min(e-this._last,1/10),this._last=e,this.wall+=this.delta,this.simDelta=this.paused?0:this.delta*this.scale,this.sim+=this.simDelta,this.frame++,this._fpsAccum+=this.delta,this._fpsFrames++,this._fpsAccum>=.5&&(this.fps=this._fpsFrames/this._fpsAccum,this._fpsAccum=0,this._fpsFrames=0),this.simDelta}togglePause(){return this.paused=!this.paused,this.paused}}const Ye={uTime:{value:0},uSimTime:{value:0},uDelta:{value:0},uResolution:{value:new Re(1,1)},uCameraPos:{value:new C},uParticleScale:{value:1},uParticleOpacity:{value:1},uSoftness:{value:.55}};function a0(n,e,t,i){Ye.uTime.value=n.wall,Ye.uSimTime.value=n.sim,Ye.uDelta.value=n.simDelta,Ye.uResolution.value.set(t.width,t.height),e.getWorldPosition(Ye.uCameraPos.value),Ye.uParticleScale.value=i.particles.globalScale,Ye.uParticleOpacity.value=i.particles.globalOpacity,Ye.uSoftness.value=i.particles.softness}const St=`
#ifndef ES_NOISE_INCLUDED
#define ES_NOISE_INCLUDED

float es_hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float es_hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float es_hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

vec2 es_hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

vec3 es_hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

/* ------------------------------------------------------------- value ---- */

float es_noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = es_hash12(i);
  float b = es_hash12(i + vec2(1.0, 0.0));
  float c = es_hash12(i + vec2(0.0, 1.0));
  float d = es_hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float es_noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = es_hash13(i + vec3(0.0, 0.0, 0.0));
  float n100 = es_hash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = es_hash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = es_hash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = es_hash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = es_hash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = es_hash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = es_hash13(i + vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
    u.z
  );
}

/* --------------------------------------------------------- simplex-ish ---- */

/* Gradient noise on a simplex lattice — smoother than value noise where the
   surface is lit, which matters for the ice and the meteor. */
float es_snoise(vec3 p) {
  const float K1 = 0.333333333;
  const float K2 = 0.166666667;
  vec3 i = floor(p + (p.x + p.y + p.z) * K1);
  vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
  vec3 e = step(vec3(0.0), d0 - d0.yzx);
  vec3 i1 = e * (1.0 - e.zxy);
  vec3 i2 = 1.0 - e.zxy * (1.0 - e);
  vec3 d1 = d0 - (i1 - K2);
  vec3 d2 = d0 - (i2 - 2.0 * K2);
  vec3 d3 = d0 - (1.0 - 3.0 * K2);
  vec4 h = max(0.6 - vec4(dot(d0, d0), dot(d1, d1), dot(d2, d2), dot(d3, d3)), 0.0);
  vec4 n = h * h * h * h * vec4(
    dot(d0, es_hash33(i) - 0.5),
    dot(d1, es_hash33(i + i1) - 0.5),
    dot(d2, es_hash33(i + i2) - 0.5),
    dot(d3, es_hash33(i + 1.0) - 0.5)
  );
  return dot(vec4(31.316), n);
}

/* ---------------------------------------------------------------- fbm ---- */

float es_fbm2(vec2 p, int octaves, float lacunarity, float gain) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    sum += amp * es_noise2(p);
    norm += amp;
    p *= lacunarity;
    amp *= gain;
  }
  return sum / max(norm, 1e-4);
}

float es_fbm3(vec3 p, int octaves, float lacunarity, float gain) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    sum += amp * es_noise3(p);
    norm += amp;
    p *= lacunarity;
    amp *= gain;
  }
  return sum / max(norm, 1e-4);
}

/* Ridged fbm — the shape that reads as fracture, crack and flame tongue. */
float es_ridged(vec3 p, int octaves, float lacunarity, float gain) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    float n = 1.0 - abs(es_snoise(p) * 2.0);
    sum += amp * n * n;
    norm += amp;
    p *= lacunarity;
    amp *= gain;
  }
  return sum / max(norm, 1e-4);
}

/* -------------------------------------------------------------- worley ---- */

/* Returns (nearest, second nearest). The gap between them is the crack. */
vec2 es_worley2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = es_hash22(i + g);
      float d = length(g + o - f);
      if (d < d1) {
        d2 = d1;
        d1 = d;
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  return vec2(d1, d2);
}

float es_worley3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float d1 = 8.0;
  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 o = es_hash33(i + g);
        d1 = min(d1, length(g + o - f));
      }
    }
  }
  return d1;
}

/* ---------------------------------------------------------------- curl ---- */

/* Cheap curl of a value-noise field. Used to push particles around without
   ever writing a position back to the CPU. */
vec3 es_curl(vec3 p, float eps) {
  float n1 = es_noise3(p + vec3(0.0, eps, 0.0));
  float n2 = es_noise3(p - vec3(0.0, eps, 0.0));
  float n3 = es_noise3(p + vec3(0.0, 0.0, eps));
  float n4 = es_noise3(p - vec3(0.0, 0.0, eps));
  float n5 = es_noise3(p + vec3(eps, 0.0, 0.0));
  float n6 = es_noise3(p - vec3(eps, 0.0, 0.0));
  float x = (n3 - n4) - (n1 - n2);
  float y = (n5 - n6) - (n3 - n4);
  float z = (n1 - n2) - (n5 - n6);
  return normalize(vec3(x, y, z) + 1e-6) * (0.5 / eps);
}

#endif
`;class o0{constructor(e,t,i){this.scene=e,this.settings=i;const s=i.world;e.fog=new ao(new te(s.fogColor),s.fogNear,s.fogFar),e.background=new te(s.fogColor),this.ambient=new Zu(new te(s.ambient),s.ambientIntensity),e.add(this.ambient),this.key=new nl(new te(s.keyColor),s.keyIntensity),this.key.castShadow=i.renderer.shadows,this.key.shadow.mapSize.set(2048,2048),this.key.shadow.camera.near=1,this.key.shadow.camera.far=60,this.key.shadow.camera.left=-22,this.key.shadow.camera.right=22,this.key.shadow.camera.top=22,this.key.shadow.camera.bottom=-22,this.key.shadow.bias=-.0012,this.key.shadow.normalBias=.035,e.add(this.key),e.add(this.key.target),this.rim=new nl(new te(s.rimColor),s.rimIntensity),e.add(this.rim),this.fill=new $u(new te(s.fillColor),329483,s.fillIntensity),e.add(this.fill),this.envTexture=this._buildProbe(t),e.environment=this.envTexture,e.environmentIntensity=.55,this.sync()}_buildProbe(e){const t=new Zl,i=new He(new ho(50,48,32),new st({side:Ot,depthWrite:!1,uniforms:{uSky:{value:new te("#2d4f7a")},uHorizon:{value:new te("#0d1622")},uGround:{value:new te("#05070b")},uSunDir:{value:new C(.5,.55,-.65).normalize()},uSunColor:{value:new te("#ffe6c4")}},vertexShader:`
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,fragmentShader:`
          ${St}
          uniform vec3 uSky;
          uniform vec3 uHorizon;
          uniform vec3 uGround;
          uniform vec3 uSunDir;
          uniform vec3 uSunColor;
          varying vec3 vDir;

          void main() {
            vec3 d = normalize(vDir);
            float h = d.y;
            vec3 col = h > 0.0
              ? mix(uHorizon, uSky, pow(clamp(h, 0.0, 1.0), 0.55))
              : mix(uHorizon, uGround, pow(clamp(-h, 0.0, 1.0), 0.35));

            /* A soft key so metal and ice get a highlight to catch. */
            float sun = pow(max(dot(d, normalize(uSunDir)), 0.0), 220.0);
            float bloom = pow(max(dot(d, normalize(uSunDir)), 0.0), 6.0);
            col += uSunColor * (sun * 9.0 + bloom * 0.35);

            /* Break the gradient up so reflections are not perfectly clean. */
            col *= 0.92 + 0.16 * es_fbm3(d * 4.0, 3, 2.1, 0.5);

            gl_FragColor = vec4(col, 1.0);
          }
        `}));t.add(i);const s=new Na(e);s.compileEquirectangularShader();const r=s.fromScene(t,.04);return s.dispose(),i.geometry.dispose(),i.material.dispose(),r.texture}sync(){const e=this.settings.world;this.scene.fog.color.set(e.fogColor),this.scene.fog.near=e.fogNear,this.scene.fog.far=e.fogFar,this.scene.background.set(e.fogColor),this.ambient.color.set(e.ambient),this.ambient.intensity=e.ambientIntensity,this.key.color.set(e.keyColor),this.key.intensity=e.keyIntensity,this.key.position.set(Math.sin(e.keyAngle)*16,e.keyHeight,Math.cos(e.keyAngle)*16),this.key.target.position.set(0,0,0),this.rim.color.set(e.rimColor),this.rim.intensity=e.rimIntensity,this.rim.position.set(-Math.sin(e.keyAngle)*14,5.5,-Math.cos(e.keyAngle)*14),this.fill.color.set(e.fillColor),this.fill.intensity=e.fillIntensity}}const wt=`
#ifndef ES_COMMON_INCLUDED
#define ES_COMMON_INCLUDED

#define ES_TAU 6.28318530718
#define ES_PI  3.14159265359

/* ----------------------------------------------------------- rotation ---- */

mat2 es_rot2(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

mat3 es_rotAxis(vec3 axis, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  float t = 1.0 - c;
  vec3 a = normalize(axis);
  return mat3(
    t * a.x * a.x + c,       t * a.x * a.y - s * a.z, t * a.x * a.z + s * a.y,
    t * a.x * a.y + s * a.z, t * a.y * a.y + c,       t * a.y * a.z - s * a.x,
    t * a.x * a.z - s * a.y, t * a.y * a.z + s * a.x, t * a.z * a.z + c
  );
}

/* Build an orthonormal basis whose +Z is dir. Used everywhere a cast has to
   be laid out along its own direction without a CPU-side matrix. */
mat3 es_basis(vec3 dir) {
  vec3 f = normalize(dir);
  vec3 up = abs(f.y) > 0.97 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
  vec3 r = normalize(cross(up, f));
  vec3 u = cross(f, r);
  return mat3(r, u, f);
}

/* --------------------------------------------------------------- sdf ---- */

float es_sdCircle(vec2 p, float r) {
  return length(p) - r;
}

float es_sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float es_sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

float es_sdTriangleIso(vec2 p, vec2 q) {
  p.x = abs(p.x);
  vec2 a = p - q * clamp(dot(p, q) / dot(q, q), 0.0, 1.0);
  vec2 b = p - q * vec2(clamp(p.x / q.x, 0.0, 1.0), 1.0);
  float s = -sign(q.y);
  vec2 d = min(vec2(dot(a, a), s * (p.x * q.y - p.y * q.x)),
               vec2(dot(b, b), s * (p.y - q.y)));
  return -sqrt(d.x) * sign(d.y);
}

float es_opRound(float d, float r) {
  return d - r;
}

/* ------------------------------------------------------------ easings ---- */

float es_ease(float t) {
  return t * t * (3.0 - 2.0 * t);
}

float es_easeOutCubic(float t) {
  float p = 1.0 - t;
  return 1.0 - p * p * p;
}

float es_easeInCubic(float t) {
  return t * t * t;
}

float es_easeOutQuint(float t) {
  float p = 1.0 - t;
  return 1.0 - p * p * p * p * p;
}

float es_easeOutBack(float t, float overshoot) {
  float c = overshoot + 1.0;
  float p = t - 1.0;
  return 1.0 + c * p * p * p + overshoot * p * p;
}

/* Rise over up, hold, fall over down — the envelope for every burst. */
float es_pulse(float t, float up, float down) {
  if (t <= 0.0 || t >= 1.0) return 0.0;
  float rise = es_easeOutCubic(clamp(t / max(up, 1e-4), 0.0, 1.0));
  float fall = 1.0 - es_easeInCubic(clamp((t - (1.0 - down)) / max(down, 1e-4), 0.0, 1.0));
  return min(rise, fall);
}

/* Band-limited stripe. Positive inside the band, 0 outside, soft soft-edges. */
float es_band(float x, float centre, float halfWidth, float soft) {
  return smoothstep(halfWidth + soft, halfWidth - soft, abs(x - centre));
}

/* -------------------------------------------------------------- colour ---- */

/* Three-stop ramp: core -> mid -> edge. Cheaper and more art-directable than a
   LUT, and it stays a live slider. */
vec3 es_ramp3(vec3 a, vec3 b, vec3 c, float t) {
  t = clamp(t, 0.0, 1.0);
  return t < 0.5 ? mix(a, b, t * 2.0) : mix(b, c, (t - 0.5) * 2.0);
}

vec3 es_blackbody(float t) {
  /* Cheap approximation of a heated body from dull red to blue-white. */
  t = clamp(t, 0.0, 1.0);
  vec3 c = vec3(0.0);
  c.r = smoothstep(0.0, 0.35, t);
  c.g = smoothstep(0.25, 0.85, t);
  c.b = smoothstep(0.62, 1.0, t);
  return c * (0.35 + 1.35 * t);
}

float es_luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

/* Fresnel term with a controllable falloff. */
float es_fresnel(vec3 normal, vec3 viewDir, float power) {
  return pow(1.0 - clamp(dot(normalize(normal), normalize(viewDir)), 0.0, 1.0), power);
}

/* ------------------------------------------------------------- shapes ---- */

/* Soft radial sprite with a controllable core. */
float es_sprite(vec2 uv, float core, float soft) {
  float r = length(uv);
  return smoothstep(1.0, core, r) * soft;
}

/* Distance to the boundary of an annulus. */
float es_ring(float r, float radius, float width) {
  return abs(r - radius) - width * 0.5;
}

#endif
`;class l0{constructor(e,t){this.settings=t;const i=t.ground,s=new Di(i.size,i.size,1,1);s.rotateX(-Math.PI/2),this.uniforms={uBaseColor:{value:new te(i.baseColor)},uCrackColor:{value:new te(i.crackColor)},uGrainColor:{value:new te(i.grainColor)},uGridColor:{value:new te(i.gridColor)},uTileScale:{value:i.tileScale},uGrainScale:{value:i.grainScale},uGridStrength:{value:i.gridStrength},uGridScale:{value:i.gridScale},uFalloff:{value:i.falloff},uSize:{value:i.size}},this.material=new cs({color:16777215,roughness:i.roughness,metalness:i.metalness,envMapIntensity:i.reflect,dithering:!0}),this.material.onBeforeCompile=r=>{Object.assign(r.uniforms,this.uniforms),r.vertexShader=r.vertexShader.replace("#include <common>",`#include <common>
           varying vec3 vGroundPos;`).replace("#include <begin_vertex>",`#include <begin_vertex>
           vGroundPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`),r.fragmentShader=r.fragmentShader.replace("#include <common>",`#include <common>
           ${St}
           ${wt}
           varying vec3 vGroundPos;
           uniform vec3 uBaseColor;
           uniform vec3 uCrackColor;
           uniform vec3 uGrainColor;
           uniform vec3 uGridColor;
           uniform float uTileScale;
           uniform float uGrainScale;
           uniform float uGridStrength;
           uniform float uGridScale;
           uniform float uFalloff;
           uniform float uSize;

           /* Height of the stone at p — shared by the albedo and the normal so
              the lit relief and the painted relief agree. */
           float groundHeight(vec2 p) {
             vec2 w = es_worley2(p * uTileScale);
             float seam = smoothstep(0.0, 0.09, w.y - w.x);
             float grain = es_fbm2(p * uGrainScale, 4, 2.1, 0.5);
             return seam * 0.72 + grain * 0.28;
           }`).replace("#include <map_fragment>",`#include <map_fragment>
           {
             vec2 p = vGroundPos.xz;
             vec2 w = es_worley2(p * uTileScale);
             float seam = smoothstep(0.0, 0.075, w.y - w.x);
             float grain = es_fbm2(p * uGrainScale, 4, 2.1, 0.5);
             float coarse = es_fbm2(p * uGrainScale * 0.17, 3, 2.0, 0.55);

             vec3 albedo = mix(uCrackColor, uBaseColor, seam);
             albedo = mix(albedo, uGrainColor, grain * 0.38 * seam);
             albedo *= 0.72 + 0.56 * coarse;

             /* Survey grid — a lattice, not a texture. */
             vec2 gridUv = abs(fract(p / uGridScale) - 0.5);
             float line = 1.0 - smoothstep(0.0, 0.02, min(gridUv.x, gridUv.y));
             albedo = mix(albedo, uGridColor, line * uGridStrength);

             /* Chew the far edge of the plane into the fog. */
             float r = length(p) / (uSize * 0.5);
             albedo *= 1.0 - smoothstep(uFalloff, 1.0, r);

             diffuseColor.rgb *= albedo;
           }`).replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
           {
             vec2 p = vGroundPos.xz;
             vec2 w = es_worley2(p * uTileScale);
             float seam = smoothstep(0.0, 0.075, w.y - w.x);
             float grain = es_fbm2(p * uGrainScale * 2.3, 3, 2.0, 0.5);
             /* Polished slab faces, rough grout. */
             roughnessFactor *= mix(1.12, 0.74, seam) * (0.86 + 0.28 * grain);
             roughnessFactor = clamp(roughnessFactor, 0.06, 1.0);
           }`).replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
           {
             vec2 p = vGroundPos.xz;
             float e = 0.035;
             float h = groundHeight(p);
             float hx = groundHeight(p + vec2(e, 0.0));
             float hz = groundHeight(p + vec2(0.0, e));
             vec3 bump = normalize(vec3((h - hx) / e, 1.0, (h - hz) / e));
             normal = normalize(mix(normal, bump, 0.55));
           }`),this._shader=r},this.mesh=new He(s,this.material),this.mesh.receiveShadow=!0,this.mesh.name="ground",e.add(this.mesh),this.plane=new wi(new C(0,1,0),0)}sync(){const e=this.settings.ground;this.uniforms.uBaseColor.value.set(e.baseColor),this.uniforms.uCrackColor.value.set(e.crackColor),this.uniforms.uGrainColor.value.set(e.grainColor),this.uniforms.uGridColor.value.set(e.gridColor),this.uniforms.uTileScale.value=e.tileScale,this.uniforms.uGrainScale.value=e.grainScale,this.uniforms.uGridStrength.value=e.gridStrength,this.uniforms.uGridScale.value=e.gridScale,this.uniforms.uFalloff.value=e.falloff,this.material.roughness=e.roughness,this.material.metalness=e.metalness,this.material.envMapIntensity=e.reflect}}class c0{constructor(e,t){this.settings=t;const i=t.dust,s=i.count,r=new Float32Array(s*3),a=new Float32Array(s),o=new Float32Array(s);for(let c=0;c<s;c++){const d=Math.sqrt(Math.random())*i.radius,f=Math.random()*Math.PI*2;r[c*3+0]=Math.cos(f)*d,r[c*3+1]=Math.pow(Math.random(),1.6)*i.height+.15,r[c*3+2]=Math.sin(f)*d,a[c]=Math.random()*100,o[c]=.45+Math.random()*.9}const l=new Tt;l.setAttribute("position",new xt(r,3)),l.setAttribute("aPhase",new xt(a,1)),l.setAttribute("aScale",new xt(o,1)),l.boundingSphere=new ti(new C,i.radius*1.5),this.material=new st({transparent:!0,depthWrite:!1,blending:Qt,uniforms:{uTime:Ye.uTime,uColor:{value:new te(i.color)},uOpacity:{value:i.opacity},uSize:{value:i.size},uDrift:{value:i.drift},uSwirl:{value:i.swirl},uPixelRatio:{value:Math.min(window.devicePixelRatio,2)}},vertexShader:`
        ${St}
        uniform float uTime;
        uniform float uSize;
        uniform float uDrift;
        uniform float uSwirl;
        uniform float uPixelRatio;
        attribute float aPhase;
        attribute float aScale;
        varying float vFade;

        void main() {
          vec3 p = position;
          float t = uTime * uDrift + aPhase;

          /* Slow vertical bob plus a lazy horizontal orbit. */
          p.y += sin(t * 0.9) * 0.55;
          float orbit = uSwirl * uTime + aPhase;
          p.xz += vec2(cos(orbit), sin(orbit)) * 0.42;
          p += (es_hash33(vec3(aPhase)) - 0.5) * 0.6 * sin(t * 0.43);

          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * aScale * uPixelRatio * 320.0 / max(-mv.z, 0.1);

          /* Twinkle, and drop out near the floor so nothing sits in the seam. */
          vFade = (0.45 + 0.55 * sin(t * 2.1 + aPhase)) * smoothstep(0.0, 1.2, p.y);
        }
      `,fragmentShader:`
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vFade;

        void main() {
          vec2 uv = gl_PointCoord * 2.0 - 1.0;
          float a = smoothstep(1.0, 0.0, length(uv));
          a *= a;
          gl_FragColor = vec4(uColor, a * uOpacity * vFade);
          if (gl_FragColor.a < 0.004) discard;
        }
      `}),this.points=new Bu(l,this.material),this.points.frustumCulled=!1,this.points.renderOrder=2,e.add(this.points)}sync(){const e=this.settings.dust;this.points.visible=e.enabled,this.material.uniforms.uColor.value.set(e.color),this.material.uniforms.uOpacity.value=e.opacity,this.material.uniforms.uSize.value=e.size,this.material.uniforms.uDrift.value=e.drift,this.material.uniforms.uSwirl.value=e.swirl}}class u0{constructor(e,t){this.settings=t,this.root=new Cn,this.root.name="caster",e.add(this.root),this.facing=0,this._facing=0,this.castT=-1,this.castStrength=1,this.material=this._buildMaterial(),this._buildSkeleton(),this._handWorld=new C,this._tmp=new C}_buildMaterial(){const e=this.settings.caster,t=new cs({color:new te(e.color),roughness:.52,metalness:.62,envMapIntensity:.9});return this.casterUniforms={uAccent:{value:new te(e.accent)},uAccentPower:{value:e.accentPower},uCharge:{value:0},uTime:Ye.uTime},t.onBeforeCompile=i=>{Object.assign(i.uniforms,this.casterUniforms),i.vertexShader=i.vertexShader.replace("#include <common>",`#include <common>
 varying vec3 vLocalPos;`).replace("#include <begin_vertex>",`#include <begin_vertex>
 vLocalPos = position;`),i.fragmentShader=i.fragmentShader.replace("#include <common>",`#include <common>
           ${St}
           ${wt}
           varying vec3 vLocalPos;
           uniform vec3 uAccent;
           uniform float uAccentPower;
           uniform float uCharge;
           uniform float uTime;`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
           {
             /* Seams that run around the shell, brightening as a cast charges. */
             float band = es_fbm3(vLocalPos * 5.5, 3, 2.1, 0.5);
             float seam = smoothstep(0.52, 0.58, band) * (1.0 - smoothstep(0.66, 0.74, band));
             float rim = es_fresnel(normal, normalize(vViewPosition), uAccentPower);
             float pulseAmt = 0.55 + 0.45 * sin(uTime * 2.2 + vLocalPos.y * 3.0);
             totalEmissiveRadiance +=
               uAccent * (seam * (0.35 + 2.6 * uCharge) * pulseAmt + rim * (0.28 + 1.6 * uCharge));
           }`)},t}_limb(e,t){const i=new co(e,Math.max(t-e*2,.01),4,10);i.translate(0,-t*.5,0);const s=new He(i,this.material);return s.castShadow=!0,s}_buildSkeleton(){const t=this.settings.caster.height/1.82,i=(d,f=0,u=0,m=0)=>{const g=new Cn;return g.position.set(m,f,u),d.add(g),g};this.body=i(this.root),this.hips=i(this.body,.94*t);const s=this._limb(.17*t,.26*t);s.position.y=.1*t,this.hips.add(s),this.chest=i(this.hips,.1*t);const r=this._limb(.2*t,.56*t);r.position.y=.52*t,r.scale.set(1.05,1,.78),this.chest.add(r),this.neck=i(this.chest,.54*t),this.head=i(this.neck,.06*t);const a=new He(new $i(.135*t,1),this.material);a.position.y=.09*t,a.scale.set(.92,1.12,1),a.castShadow=!0,this.head.add(a);const o=new He(new Xi(.17*t,.022*t,.02*t),new Qs({color:new te(this.settings.caster.accent)}));o.position.set(0,.09*t,.125*t),this.visorMaterial=o.material,this.head.add(o);const l=d=>{const f=i(this.chest,.48*t,0,.22*t*d),u=this._limb(.072*t,.3*t);f.add(u);const m=i(f,-.3*t),g=this._limb(.058*t,.28*t);m.add(g);const S=i(m,-.28*t),p=new He(new $i(.07*t,0),this.material);return p.castShadow=!0,S.add(p),{shoulder:f,elbow:m,wrist:S,hand:p}};this.armL=l(1),this.armR=l(-1);const c=d=>{const f=i(this.hips,0,0,.11*t*d),u=this._limb(.095*t,.46*t);f.add(u);const m=i(f,-.46*t),g=this._limb(.075*t,.44*t);m.add(g);const S=i(m,-.44*t),p=new He(new Xi(.11*t,.06*t,.24*t),this.material);return p.position.set(0,-.03*t,.05*t),p.castShadow=!0,S.add(p),{hip:f,knee:m,ankle:S}};this.legL=c(1),this.legR=c(-1),this.castAnchor=new yt,this.armR.wrist.add(this.castAnchor)}face(e){this.facing=Math.atan2(e.x,e.z)}playCast(e=1){this.castT=0,this.castStrength=e}getHandPosition(e=new C){return this.armR.hand.getWorldPosition(e),e}update(e,t,i=0){const s=this.settings.caster;let r=this.facing-this._facing;for(;r>Math.PI;)r-=Math.PI*2;for(;r<-Math.PI;)r+=Math.PI*2;this._facing=Wi(this._facing,this._facing+r,9,e),this.root.rotation.y=this._facing;const a=t*s.breatheSpeed,o=Math.sin(a)*s.breathe,l=Math.sin(a*.47)*.03;this.chest.rotation.set(o*.5,l*.5,0),this.chest.scale.setScalar(1+o*.4),this.hips.position.y=.94*(s.height/1.82)+o*.05,this.hips.rotation.z=l*.4,this.neck.rotation.set(-o*.4,-l,0);const c=Math.sin(a*.9)*.06,d=(m,g,S,p,h)=>{m.shoulder.rotation.set(S,0,p*g),m.elbow.rotation.set(h,0,0)};d(this.armL,1,c*.4,-.16+c*.2,-.36-c*.3),d(this.armR,-1,c*.4,-.16-c*.2,-.36-c*.3);const f=.06;if(this.legL.hip.rotation.set(-f,0,-.06),this.legR.hip.rotation.set(f,0,.06),this.legL.knee.rotation.x=.14,this.legR.knee.rotation.x=.1,this.castT>=0){const m=s.castWindup+s.castRecover;this.castT+=e;const g=this.castT;let S=0,p=0;g<s.castWindup?S=gc(pt(g/s.castWindup)):(S=1-pt((g-s.castWindup)/.09),p=pt((g-s.castWindup)/s.castRecover));const h=p>0?Math.max(0,vc(p,1.4)*(1-p*p)):0,x=this.castStrength,E=(-S*.26+h*.34)*x;this.chest.rotation.x+=E,this.hips.rotation.x=E*.35,this.body.position.z=h*s.castLunge*x,this.neck.rotation.x-=E*.4;const M=(S*1.15-h*1.95)*x;this.armR.shoulder.rotation.x+=M,this.armR.shoulder.rotation.z+=(S*.5-h*.2)*x*-1,this.armR.elbow.rotation.x+=(-S*1.5+h*1.3)*x,this.armL.shoulder.rotation.x+=(S*.5-h*.6)*x,this.armL.shoulder.rotation.z+=S*.4*x,this.armL.elbow.rotation.x+=(-S*1+h*.5)*x,this.legR.hip.rotation.x+=(S*.28-h*.5)*x,this.legL.hip.rotation.x+=(-S*.22+h*.42)*x,this.legL.knee.rotation.x+=h*.35*x,g>m&&(this.castT=-1)}const u=Math.max(i,this.castT>=0?n0(0,.2,this.castT)*.6:0);this.casterUniforms.uCharge.value=Wi(this.casterUniforms.uCharge.value,u,12,e),this.casterUniforms.uAccent.value.set(s.accent),this.casterUniforms.uAccentPower.value=s.accentPower,this.visorMaterial.color.set(s.accent),this.material.color.set(s.color)}getCastOrigin(e,t=new C){const i=this.settings.caster;return this.getHandPosition(t),e&&(this._tmp.copy(e).setY(0).normalize().multiplyScalar(i.handForward*.4),t.add(this._tmp)),t.y=zt(t.y,i.handHeight,.35),t}}const h0={round:0,spark:1,smoke:2,chip:3},d0=`
${St}
${wt}

uniform float uSimTime;
uniform float uGlobalScale;
uniform float uGlobalOpacity;
uniform float uTurbScale;
uniform float uTurbSpeed;
uniform float uGroundY;
uniform float uFadeIn;
uniform float uFadeOut;
uniform float uStretch;

attribute vec3 aOrigin;
attribute vec3 aVelocity;
attribute vec3 aSeed;
attribute vec3 aColorA;
attribute vec3 aColorB;
attribute float aBirth;
attribute float aLife;
attribute vec2 aSize;
attribute float aGravity;
attribute float aDrag;
attribute float aTurb;
attribute float aSpin;

varying vec3 vColor;
varying float vAlpha;
varying vec2 vUv;
varying float vSeed;
varying float vAge;

void main() {
  float age = uSimTime - aBirth;
  float t = age / max(aLife, 1e-4);

  /* Retired or not yet born: collapse the quad and let the rasteriser bin it. */
  if (t < 0.0 || t > 1.0) {
    vAlpha = 0.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  vec3 g = vec3(0.0, aGravity, 0.0);
  float k = aDrag;

  vec3 disp;
  vec3 vel;
  if (k > 1e-3) {
    float e = exp(-k * age);
    disp = (aVelocity + g / k) * (1.0 - e) / k - g * age / k;
    vel = (aVelocity + g / k) * e - g / k;
  } else {
    disp = aVelocity * age + 0.5 * g * age * age;
    vel = aVelocity + g * age;
  }

  vec3 pos = aOrigin + disp;

  /* Turbulence ramps in with age so nothing is shaken apart at the muzzle. */
  if (aTurb > 1e-4) {
    vec3 q = pos * uTurbScale + aSeed * 13.0 + vec3(0.0, uSimTime * uTurbSpeed, 0.0);
    pos += es_curl(q, 0.35) * aTurb * age;
  }

  /* Floor contact: settle rather than sink. */
  if (pos.y < uGroundY) {
    pos.y = uGroundY + (uGroundY - pos.y) * 0.12;
    pos.y = min(pos.y, uGroundY + 0.35);
  }

  float size = mix(aSize.x, aSize.y, es_ease(t)) * uGlobalScale;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vec2 corner = position.xy * size;

#ifdef ES_STRETCH
  /* Sparks lie along their own velocity, in view space. */
  vec3 vView = (modelViewMatrix * vec4(vel, 0.0)).xyz;
  float speed = length(vView);
  vec2 dir = speed > 1e-4 ? normalize(vView.xy + vec2(1e-5)) : vec2(0.0, 1.0);
  vec2 perp = vec2(-dir.y, dir.x);
  float stretch = 1.0 + uStretch * min(speed, 24.0);
  mv.xy += dir * (position.y * size * stretch) + perp * (position.x * size);
#else
  float ang = aSpin * age + aSeed.x * ES_TAU;
  mv.xy += es_rot2(ang) * corner;
#endif

  gl_Position = projectionMatrix * mv;

  float fadeIn = smoothstep(0.0, max(uFadeIn, 1e-4), t);
  float fadeOut = 1.0 - smoothstep(1.0 - max(uFadeOut, 1e-4), 1.0, t);
  vAlpha = fadeIn * fadeOut * uGlobalOpacity;

  vColor = mix(aColorA, aColorB, es_easeOutCubic(t));
  vUv = position.xy * 2.0;
  vSeed = aSeed.y;
  vAge = t;
}
`,f0=`
${St}
${wt}

uniform float uSoftness;
uniform float uIntensity;

varying vec3 vColor;
varying float vAlpha;
varying vec2 vUv;
varying float vSeed;
varying float vAge;

void main() {
  if (vAlpha <= 0.001) discard;

  float r = length(vUv);
  float a = 0.0;
  vec3 col = vColor;

#if ES_SHAPE == 0
  /* Round glow with a controllable core. */
  a = smoothstep(1.0, uSoftness * 0.9, r);
  a *= a;
  col += vColor * pow(max(1.0 - r, 0.0), 6.0) * 1.6;

#elif ES_SHAPE == 1
  /* Spark: a hot filament with a soft halo. */
  float core = smoothstep(0.55, 0.0, r);
  float halo = smoothstep(1.0, 0.25, r) * 0.4;
  a = core + halo;
  col += vec3(1.0) * core * core * 0.85;

#elif ES_SHAPE == 2
  /* Smoke / mist: erode a disc with fbm that drifts as the puff ages. */
  vec2 q = vUv * 1.15 + vec2(vSeed * 37.0, vSeed * 19.0);
  float n = es_fbm2(q * 1.6 + vec2(0.0, -vAge * 1.1), 4, 2.2, 0.55);
  float mask = smoothstep(1.0, 0.05, r);
  a = smoothstep(0.34, 0.86, mask * (0.55 + 0.9 * n));
  a *= mix(1.0, 0.55, vAge);
  /* Fake self-shadowing: the leading edge is brighter than the body. */
  col *= 0.72 + 0.7 * n;

#else
  /* Chip: a hard shard with a bevel, shaded by a fake normal. */
  float ang = floor(atan(vUv.y, vUv.x) / ES_TAU * 5.0 + vSeed * 5.0) / 5.0 * ES_TAU;
  float poly = r * (0.82 + 0.18 * cos(atan(vUv.y, vUv.x) * 5.0 + vSeed * 20.0));
  a = 1.0 - smoothstep(0.72, 0.8, poly);
  vec3 n = normalize(vec3(vUv * 0.9, sqrt(max(1.0 - r * r, 0.0))));
  float lit = 0.35 + 0.65 * max(dot(n, normalize(vec3(0.4, 0.75, 0.5))), 0.0);
  col *= lit;
  col += vec3(1.0) * pow(max(dot(n, normalize(vec3(0.4, 0.75, 0.5))), 0.0), 24.0) * 0.6;
#endif

  a *= vAlpha;
  if (a < 0.004) discard;

  gl_FragColor = vec4(col * uIntensity, a);
}
`;class Kn{constructor({capacity:e=4096,shape:t="round",additive:i=!0,stretch:s=!1,intensity:r=1,turbScale:a=.35,turbSpeed:o=.6,groundY:l=.02,fadeIn:c=.08,fadeOut:d=.42,stretchAmount:f=.055,depthWrite:u=!1,renderOrder:m=10}={}){this.capacity=e,this.cursor=0,this.live=0,this._dirtyMin=1/0,this._dirtyMax=-1/0;const g=new Di(1,1),S=new fo;S.index=g.index,S.setAttribute("position",g.attributes.position),g.dispose();const p=h=>new Ai(new Float32Array(e*h),h).setUsage(es);this.a={aOrigin:p(3),aVelocity:p(3),aSeed:p(3),aColorA:p(3),aColorB:p(3),aBirth:p(1),aLife:p(1),aSize:p(2),aGravity:p(1),aDrag:p(1),aTurb:p(1),aSpin:p(1)};for(const[h,x]of Object.entries(this.a))S.setAttribute(h,x);this.a.aBirth.array.fill(-1e6),this.a.aLife.array.fill(1e-4),S.instanceCount=e,S.boundingSphere=new ti(new C(0,4,0),400),this.material=new st({vertexShader:d0,fragmentShader:f0,defines:{ES_SHAPE:h0[t]??0,...s?{ES_STRETCH:""}:{}},uniforms:{uSimTime:Ye.uSimTime,uGlobalScale:Ye.uParticleScale,uGlobalOpacity:Ye.uParticleOpacity,uSoftness:Ye.uSoftness,uTurbScale:{value:a},uTurbSpeed:{value:o},uGroundY:{value:l},uFadeIn:{value:c},uFadeOut:{value:d},uStretch:{value:f},uIntensity:{value:r}},transparent:!0,depthWrite:u,depthTest:!0,blending:i?Qt:Hi,side:Ft,toneMapped:!0}),this.mesh=new He(S,this.material),this.mesh.frustumCulled=!1,this.mesh.renderOrder=m,this.geometry=S}emit(e,t){if(e=Math.max(0,Math.min(e|0,this.capacity)),e===0)return;const{position:i,positionRadius:s=0,positionBox:r=null,direction:a=p0,spread:o=Math.PI,speed:l=[1,2],bias:c=null,life:d=[.5,1],size:f=[.1,.2],sizeEnd:u=1,colorA:m=Pl,colorB:g=Pl,tint:S=0,gravity:p=0,drag:h=0,turbulence:x=0,spin:E=0,birth:M=0,radialSpeed:b=0,centre:T=null}=t,R=v0.copy(a).normalize(),_=Math.abs(R.y)>.97?g0:m0,w=_0.copy(_).cross(R).normalize(),P=x0.copy(R).cross(w);for(let D=0;D<e;D++){const F=this.cursor;this.cursor=(this.cursor+1)%this.capacity,this._dirtyMin=Math.min(this._dirtyMin,F),this._dirtyMax=Math.max(this._dirtyMax,F);let W=i.x,Z=i.y,O=i.z;if(r)W+=ye.spread(r.x),Z+=ye.spread(r.y),O+=ye.spread(r.z);else if(s>0){const q=Math.cbrt(ye.next())*s,se=ye.next()*Ht,j=Math.acos(ye.next()*2-1),Pe=Math.sin(j);W+=q*Pe*Math.cos(se),Z+=q*Math.cos(j),O+=q*Pe*Math.sin(se)}const $=ye.cone(o,S0),k=l[0]+(l[1]-l[0])*ye.next();let J=(w.x*$.x+P.x*$.y+R.x*$.z)*k,ee=(w.y*$.x+P.y*$.y+R.y*$.z)*k,ae=(w.z*$.x+P.z*$.y+R.z*$.z)*k;if(b!==0&&T){const q=W-T.x,se=Z-T.y,j=O-T.z,Pe=Math.hypot(q,se,j)||1;J+=q/Pe*b,ee+=se/Pe*b,ae+=j/Pe*b}c&&(J+=c.x,ee+=c.y,ae+=c.z);const ie=F*3,ve=F*2,Ae=this.a;Ae.aOrigin.array[ie]=W,Ae.aOrigin.array[ie+1]=Z,Ae.aOrigin.array[ie+2]=O,Ae.aVelocity.array[ie]=J,Ae.aVelocity.array[ie+1]=ee,Ae.aVelocity.array[ie+2]=ae,Ae.aSeed.array[ie]=ye.next(),Ae.aSeed.array[ie+1]=ye.next(),Ae.aSeed.array[ie+2]=ye.next();const Qe=S>0?1+ye.spread(S):1;Ae.aColorA.array[ie]=m.r*Qe,Ae.aColorA.array[ie+1]=m.g*Qe,Ae.aColorA.array[ie+2]=m.b*Qe,Ae.aColorB.array[ie]=g.r*Qe,Ae.aColorB.array[ie+1]=g.g*Qe,Ae.aColorB.array[ie+2]=g.b*Qe;const We=f[0]+(f[1]-f[0])*ye.next();Ae.aSize.array[ve]=We,Ae.aSize.array[ve+1]=We*u,Ae.aBirth.array[F]=M,Ae.aLife.array[F]=d[0]+(d[1]-d[0])*ye.next(),Ae.aGravity.array[F]=p,Ae.aDrag.array[F]=h,Ae.aTurb.array[F]=x,Ae.aSpin.array[F]=E===0?0:ye.spread(E)}this.live=Math.min(this.capacity,this.live+e)}flush(){if(this._dirtyMax<this._dirtyMin)return;const e=this._dirtyMin,t=this._dirtyMax-this._dirtyMin+1;for(const i of Object.values(this.a))i.addUpdateRange(e*i.itemSize,t*i.itemSize),i.needsUpdate=!0;this._dirtyMin=1/0,this._dirtyMax=-1/0}clear(){this.a.aBirth.array.fill(-1e6),this.a.aLife.array.fill(1e-4),this.a.aBirth.needsUpdate=!0,this.a.aLife.needsUpdate=!0,this.cursor=0,this.live=0,this._dirtyMin=1/0,this._dirtyMax=-1/0}dispose(){this.geometry.dispose(),this.material.dispose()}}const p0=new C(0,1,0),Pl=new te(1,1,1),m0=new C(0,1,0),g0=new C(0,0,1),v0=new C,_0=new C,x0=new C,S0={x:0,y:0,z:0};class M0{constructor(e,t){this.settings=t,this.scene=e;const i=t.particles.budget,s=r=>Math.max(512,Math.round(i*r));this.systems={spark:new Kn({capacity:s(.24),shape:"spark",additive:!0,stretch:!0,intensity:1,fadeIn:.02,fadeOut:.6,renderOrder:12}),glow:new Kn({capacity:s(.24),shape:"round",additive:!0,intensity:.8,fadeIn:.06,fadeOut:.5,renderOrder:11}),fire:new Kn({capacity:s(.16),shape:"smoke",additive:!0,intensity:.9,turbScale:.5,turbSpeed:1.1,fadeIn:.1,fadeOut:.62,renderOrder:10}),smoke:new Kn({capacity:s(.2),shape:"smoke",additive:!1,intensity:.42,turbScale:.28,turbSpeed:.42,fadeIn:.16,fadeOut:.55,renderOrder:9}),chip:new Kn({capacity:s(.1),shape:"chip",additive:!1,intensity:.8,fadeIn:.02,fadeOut:.28,depthWrite:!0,renderOrder:8})};for(const r of Object.values(this.systems))e.add(r.mesh);this._rates=new Map}emit(e,t,i){this.systems[e]?.emit(t,i)}emitRate(e,t,i,s,r){if(s<=0||i<=0)return;const a=(this._rates.get(e)??0)+i*s,o=Math.floor(a);this._rates.set(e,a-o),o>0&&this.systems[t]?.emit(o,r)}dropRate(e){this._rates.delete(e)}flush(){for(const e of Object.values(this.systems))e.flush()}clear(){for(const e of Object.values(this.systems))e.clear();this._rates.clear()}dispose(){for(const e of Object.values(this.systems))this.scene.remove(e.mesh),e.dispose()}}const Dl=new Map;function Te(n){let e=Dl.get(n);return e||(e=new te(n),Dl.set(n,e)),e}function y0(n,e,t){let i=n*374761393+e*668265263+t*2147483647;return i=(i^i>>>13)*1274126177,((i^i>>>16)>>>0)/4294967295}function b0(n,e,t){const i=Math.floor(n),s=Math.floor(e),r=Math.floor(t),a=n-i,o=e-s,l=t-r,c=a*a*(3-2*a),d=o*o*(3-2*o),f=l*l*(3-2*l),u=(m,g,S)=>y0(i+m,s+g,r+S);return zt(zt(zt(u(0,0,0),u(1,0,0),c),zt(u(0,1,0),u(1,1,0),c),d),zt(zt(u(0,0,1),u(1,0,1),c),zt(u(0,1,1),u(1,1,1),c),d),f)}function E0(n,e,t,i=4){let s=0,r=.5,a=0;for(let o=0;o<i;o++)s+=r*b0(n,e,t),a+=r,n*=2.03,e*=2.01,t*=1.98,r*=.5;return s/a}function ka({sides:n=6,rings:e=5,radius:t=.22,taper:i=2.2,jitter:s=.3,bend:r=.14,seed:a=1}={}){const o=new nr(a>>>0||1),l=[],c=[];for(let h=0;h<n;h++)c.push(1+o.spread(s));const d=o.spread(r),f=o.spread(r),u=h=>t*Math.pow(1-h,i*.42)*(1-h*.08),m=h=>[d*h*h,f*h*h],g=(h,x)=>{const E=h/e,M=u(E)*c[x%n],b=x/n*Ht,[T,R]=m(E);return[Math.cos(b)*M+T,E,Math.sin(b)*M+R]},S=[d,1,f];for(let h=0;h<e;h++)for(let x=0;x<n;x++){const E=g(h,x),M=g(h,x+1),b=g(h+1,x),T=g(h+1,x+1);h===e-1?l.push(...E,...M,...S):(l.push(...E,...M,...T),l.push(...E,...T,...b))}for(let h=0;h<n;h++){const x=g(0,h),E=g(0,h+1);l.push(0,0,0,...E,...x)}const p=new Tt;return p.setAttribute("position",new mt(l,3)),p.computeVertexNormals(),p.computeBoundingSphere(),p}function Ll({seed:n=7,sides:e=5,rings:t=6}={}){const i=ka({sides:e,rings:t,radius:.38,taper:1.5,jitter:.34,bend:.22,seed:n});return i.scale(1,1,.42),i}function w0({radius:n=.5,detail:e=3,craters:t=8,craterDepth:i=.28,fractures:s=4,fractureDepth:r=.16,seed:a=3}={}){const o=new nr(a>>>0||1),l=new $i(n,e),c=l.attributes.position,d=[];for(let m=0;m<t;m++){const g=o.next()*Ht,S=Math.acos(o.next()*2-1);d.push({dir:new C(Math.sin(S)*Math.cos(g),Math.cos(S),Math.sin(S)*Math.sin(g)),size:o.range(.22,.6),depth:o.range(.4,1)*i})}const f=[];for(let m=0;m<s;m++){const g=o.next()*Ht,S=Math.acos(o.next()*2-1);f.push({n:new C(Math.sin(S)*Math.cos(g),Math.cos(S),Math.sin(S)*Math.sin(g)),d:o.range(.55,.88)})}const u=new C;for(let m=0;m<c.count;m++){u.fromBufferAttribute(c,m);const g=u.clone().normalize();let S=n*(.82+.36*E0(g.x*2.1+11,g.y*2.1+5,g.z*2.1+2,4));for(const p of d){const h=g.dot(p.dir),x=pt((h-(1-p.size))/p.size),E=x*x*(3-2*x);S-=n*p.depth*E*(1-.55*E)}for(const p of f){const h=g.dot(p.n);if(h>0){const x=n*p.d/Math.max(h,.001);x<S&&(S=zt(S,x,1-r*.5))}}u.copy(g).multiplyScalar(S),c.setXYZ(m,u.x,u.y,u.z)}return l.deleteAttribute("uv"),l.computeVertexNormals(),l.computeBoundingSphere(),l}function T0(n=5){const e=new nr(n>>>0||1),t=new $i(.5,0),i=t.attributes.position,s=new C;for(let r=0;r<i.count;r++)s.fromBufferAttribute(i,r),s.multiplyScalar(e.range(.55,1.35)),s.x*=1.2,s.z*=.8,i.setXYZ(r,s.x,s.y,s.z);return t.computeVertexNormals(),t}function A0(n=64){const e=n+1,t=new Float32Array(e*2*3),i=new Float32Array(e*2),s=new Float32Array(e*2),r=[];for(let o=0;o<e;o++){const l=o/n;i[o*2+0]=l,i[o*2+1]=l,s[o*2+0]=-1,s[o*2+1]=1}for(let o=0;o<n;o++){const l=o*2;r.push(l,l+1,l+2,l+1,l+3,l+2)}const a=new Tt;return a.setAttribute("position",new xt(t,3)),a.setAttribute("aT",new xt(i,1)),a.setAttribute("aSide",new xt(s,1)),a.setIndex(r),a.boundingSphere=new ti(new C,1e3),a}function ts(n=64,e=6){const t=A0(n),i=new fo;i.index=t.index,i.setAttribute("position",t.attributes.position),i.setAttribute("aT",t.attributes.aT),i.setAttribute("aSide",t.attributes.aSide);const s=new Float32Array(e);for(let r=0;r<e;r++)s[r]=r;return i.setAttribute("aIndex",new Ai(s,1)),i.instanceCount=e,i.boundingSphere=new ti(new C,1e3),i}function _c(n=96,e=20){const t=n+1,i=e+1,s=new Float32Array(t*i*3),r=new Float32Array(t*i),a=new Float32Array(t*i),o=[];for(let c=0;c<t;c++)for(let d=0;d<i;d++){const f=c*i+d;r[f]=c/n,a[f]=d/e*Ht}for(let c=0;c<n;c++)for(let d=0;d<e;d++){const f=c*i+d,u=f+i;o.push(f,u,f+1,u,u+1,f+1)}const l=new Tt;return l.setAttribute("position",new xt(s,3)),l.setAttribute("aT",new xt(r,1)),l.setAttribute("aAngle",new xt(a,1)),l.setIndex(o),l.boundingSphere=new ti(new C,1e3),l}function C0(){const n=new Di(1,1,1,1);return n.rotateX(-Math.PI/2),n}function R0(){return new Xi(1,1,1)}const po={frost:0,scorch:1,electric:2,molten:3,beam:4,snare:5,shock:6},P0=new Set(["frost","electric","molten","beam","snare","shock"]);function D0(n){return new st({defines:{ES_DECAL:po[n]},uniforms:{uTime:Ye.uTime,uSimTime:Ye.uSimTime,uAge:{value:0},uProgress:{value:1},uOpacity:{value:1},uColor:{value:new te("#ffffff")},uColor2:{value:new te("#000000")},uSeed:{value:0},uScale:{value:3},uSharp:{value:2},uWidth:{value:.06},uChurn:{value:1},uFlicker:{value:6},uAspect:{value:1}},transparent:!0,depthWrite:!1,depthTest:!0,blending:P0.has(n)?Qt:Hi,side:Ft,polygonOffset:!0,polygonOffsetFactor:-4,polygonOffsetUnits:-4,toneMapped:!0,vertexShader:`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      ${St}
      ${wt}

      uniform float uTime;
      uniform float uAge;
      uniform float uProgress;
      uniform float uOpacity;
      uniform vec3 uColor;
      uniform vec3 uColor2;
      uniform float uSeed;
      uniform float uScale;
      uniform float uSharp;
      uniform float uWidth;
      uniform float uChurn;
      uniform float uFlicker;
      uniform float uAspect;

      varying vec2 vUv;

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        vec3 col = vec3(0.0);
        float a = 0.0;

      #if ES_DECAL == 0
        /* ---------------------------------------------------------- rime --- */
        float n = es_fbm2(p * uScale + uSeed * 31.0, 4, 2.2, 0.55);
        float edge = uProgress * 1.05;
        /* The frost front is the circle, roughened by noise. */
        float front = r + (n - 0.5) * 0.55;
        float mask = smoothstep(edge, edge - 0.34, front);

        /* Needles growing inward from the front. */
        vec2 w = es_worley2(p * uScale * 5.5 + uSeed * 7.0);
        float veins = smoothstep(0.09, 0.0, w.y - w.x);
        float feather = pow(clamp(1.0 - abs(front - edge) * 3.2, 0.0, 1.0), 2.0);

        col = uColor * (0.16 + 0.5 * veins + 0.9 * feather);
        col += uColor2 * veins * 0.28;
        a = mask * (0.16 + 0.4 * n + 0.35 * veins) * uOpacity;

      #elif ES_DECAL == 1
        /* -------------------------------------------------------- scorch --- */
        float n = es_fbm2(p * uScale + uSeed * 13.0, 4, 2.1, 0.55);
        float mask = smoothstep(1.0, 0.15, r + (n - 0.5) * 0.7);
        col = uColor * (0.4 + 0.6 * n);
        a = mask * uOpacity * (0.55 + 0.5 * n);

      #elif ES_DECAL == 2
        /* ------------------------------------------------------ electric --- */
        /* Ridged noise stacked and sharpened until only the filaments survive. */
        float b = es_ridged(vec3(p * uScale, uSeed * 5.0), 5, 2.3, 0.55);
        float lines = pow(clamp(b, 0.0, 1.0), uSharp);
        float radial = smoothstep(1.0, 0.05, r);

        /* Branches crawl outward as the burn spreads. */
        float reach = smoothstep(uProgress + 0.12, uProgress - 0.25, r);
        float flick = 0.55 + 0.85 * es_noise2(vec2(uSeed * 9.0, uTime * uFlicker));

        col = mix(uColor2, uColor, clamp(lines * 2.4, 0.0, 1.0));
        col += vec3(1.0) * pow(lines, 2.0) * 1.6;
        a = lines * radial * reach * flick * uOpacity;

      #elif ES_DECAL == 3
        /* --------------------------------------------------------- molten --- */
        vec2 w = es_worley2(p * uScale + uSeed * 23.0);
        float gap = w.y - w.x;
        float crack = smoothstep(uWidth * 2.6, uWidth * 0.2, gap);
        float core = smoothstep(uWidth * 1.1, 0.0, gap);

        /* The network only reaches as far as the blast did. */
        float reach = smoothstep(uProgress + 0.1, uProgress - 0.45, r);

        /* Convection inside the crack. */
        float churn = es_fbm2(p * uScale * 0.8 + vec2(0.0, -uTime * uChurn * 0.35), 3, 2.1, 0.5);
        float heat = (0.45 + 0.9 * churn);

        col = uColor * crack * heat;
        col += uColor2 * core * heat * 1.9;
        a = clamp(crack * reach * heat, 0.0, 1.0) * uOpacity;

      #elif ES_DECAL == 4
        /* ----------------------------------------------------------- beam --- */
        float along = vUv.x;
        float across = (vUv.y * 2.0 - 1.0);
        float mask = smoothstep(uProgress, uProgress - 0.05, along);
        float n = es_fbm2(vec2(along * uScale * 3.0, across * uScale) + uSeed * 17.0, 4, 2.1, 0.55);

        float bar = smoothstep(1.0, 0.05, abs(across) + (n - 0.5) * 0.55);
        float core = pow(clamp(1.0 - abs(across) * 2.2, 0.0, 1.0), 3.0);

        col = uColor * bar * (0.3 + 0.7 * n);
        col += uColor2 * core * 1.1;
        /* Ends never quite reach the geometry edge. */
        mask *= smoothstep(0.0, 0.04, along) * smoothstep(1.0, 0.94, along);
        a = (bar * 0.5 + core * 0.7) * mask * uOpacity;

      #elif ES_DECAL == 5
        /* ---------------------------------------------------------- snare --- */
        float churn = es_fbm2(p * uScale + vec2(uTime * uChurn * 0.25, uSeed * 11.0), 4, 2.2, 0.55);
        float body = smoothstep(1.0, 0.55, r) * (0.12 + 0.5 * churn);

        /* The boundary is the promise the targeting circle made. */
        float rim = smoothstep(uWidth, 0.0, abs(r - uProgress));
        float inner = smoothstep(uWidth * 0.6, 0.0, abs(r - uProgress * 0.62));

        /* Arcs chasing each other around the rim. */
        float ang = atan(p.y, p.x);
        float chase = pow(0.5 + 0.5 * sin(ang * 6.0 - uTime * 3.4 + uSeed * 6.0), 6.0);

        col = uColor * body;
        col += uColor2 * (rim * (1.2 + 1.8 * chase) + inner * 0.55);
        a = clamp(body * 0.45 + rim * 1.0 + inner * 0.35, 0.0, 1.0) * uOpacity;

      #else
        /* ---------------------------------------------------------- shock --- */
        float n = es_fbm2(p * uScale + uSeed * 3.0, 3, 2.2, 0.5);
        float ring = smoothstep(uWidth, 0.0, abs(r - uProgress) + (n - 0.5) * 0.12);
        col = uColor * (0.6 + 0.9 * n);
        col += uColor2 * pow(ring, 3.0);
        a = ring * uOpacity;
      #endif

        /* Circular decals never square off at the quad edge. */
      #if ES_DECAL != 4
        a *= smoothstep(1.0, 0.9, r);
      #endif

        if (a < 0.004) discard;
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
      }
    `})}class L0{constructor(e,t){this.type=e,this.material=D0(e),this.mesh=new He(t,this.material),this.mesh.visible=!1,this.mesh.renderOrder=3+po[e],this.mesh.frustumCulled=!1,this.uniforms=this.material.uniforms,this.age=0,this.life=1,this.fadeIn=.05,this.peak=1,this.active=!1}}class I0{constructor(e,t){this.scene=e,this.settings=t,this.geometry=C0(),this.pools=new Map}_acquire(e){let t=this.pools.get(e);t||(t=[],this.pools.set(e,t));let i=t.find(s=>!s.active);return i||(i=new L0(e,this.geometry),this.scene.add(i.mesh),t.push(i)),i}spawn(e,t){const i=this._acquire(e),s=i.uniforms;return i.mesh.position.set(t.position.x,t.y??.02+po[e]*.004,t.position.z),i.mesh.rotation.y=t.rotation??0,i.mesh.scale.set(t.width??t.size??1,1,t.length??t.size??1),i.mesh.visible=!0,s.uColor.value.set(t.color??"#ffffff"),s.uColor2.value.set(t.color2??t.color??"#ffffff"),s.uSeed.value=t.seed??Math.random()*100,s.uScale.value=t.scale??3,s.uSharp.value=t.sharp??2,s.uWidth.value=t.width2??.06,s.uChurn.value=t.churn??1,s.uFlicker.value=t.flicker??6,s.uProgress.value=t.progress??1,s.uOpacity.value=0,s.uAge.value=0,i.age=0,i.life=t.life??2,i.fadeIn=t.fadeIn??.06,i.peak=t.opacity??1,i.hold=t.hold??0,i.active=!0,i}update(e){for(const t of this.pools.values())for(const i of t){if(!i.active)continue;i.age+=e;const s=i.age/i.life;if(s>=1){i.active=!1,i.mesh.visible=!1;continue}const r=pt(i.age/Math.max(i.fadeIn,.001)),a=pt((i.age-i.hold)/Math.max(i.life-i.hold,.001)),o=1-a*a;i.uniforms.uOpacity.value=i.peak*r*o,i.uniforms.uAge.value=s}}clear(){for(const e of this.pools.values())for(const t of e)t.active=!1,t.mesh.visible=!1}}class U0{constructor(e,t=6){this.lights=[];for(let i=0;i<t;i++){const s=new Yu(16777215,0,40,2);s.visible=!1,e.add(s),this.lights.push({light:s,life:0,age:0,peak:0,decay:1,flicker:0,seed:Math.random()*100})}}spawn(e,t){let i=this.lights.find(s=>s.age>=s.life);return i||(i=this.lights.reduce((s,r)=>{const a=s.peak*(1-s.age/s.life),o=r.peak*(1-r.age/r.life);return a<=o?s:r})),i.light.position.copy(e),i.light.color.set(t.color??"#ffffff"),i.light.distance=t.distance??26,i.light.decay=2,i.light.visible=!0,i.peak=t.intensity??30,i.life=t.life??.6,i.decay=t.decay??1,i.flicker=t.flicker??0,i.age=0,i}update(e,t){for(const i of this.lights){if(i.age>=i.life){i.light.visible&&(i.light.visible=!1,i.light.intensity=0);continue}i.age+=e;const s=Math.min(i.age/i.life,1);let r=i.peak*Math.pow(1-s,Math.max(i.decay,.05)*2);i.flicker>0&&(r*=.55+.75*Math.abs(Math.sin((t+i.seed)*i.flicker))),i.light.intensity=r}}clear(){for(const e of this.lights)e.age=e.life,e.light.intensity=0,e.light.visible=!1}}class F0{constructor(e,t=8){this.geometry=new $i(1,4),this.pool=[],this.scene=e,this.count=t}_material(){return new st({uniforms:{uTime:Ye.uTime,uCameraPos:Ye.uCameraPos,uColor:{value:new te("#ffffff")},uColor2:{value:new te("#88bbff")},uProgress:{value:0},uOpacity:{value:1},uThickness:{value:.3},uNoise:{value:.45},uRings:{value:3},uSeed:{value:0},uIntensity:{value:1.6}},transparent:!0,depthWrite:!1,depthTest:!0,blending:Qt,side:_i,toneMapped:!0,vertexShader:`
        ${St}
        uniform float uProgress;
        uniform float uNoise;
        uniform float uSeed;
        varying vec3 vNormalW;
        varying vec3 vWorld;
        varying vec3 vLocal;

        void main() {
          vec3 p = normalize(position);
          /* The shell buckles as it expands — never a clean sphere. */
          float n = es_fbm3(p * 2.4 + uSeed, 4, 2.1, 0.55);
          float wobble = 1.0 + uNoise * (n - 0.5) * (0.4 + uProgress);
          vec3 pos = p * wobble;

          vLocal = p;
          vec4 world = modelMatrix * vec4(pos, 1.0);
          vWorld = world.xyz;
          vNormalW = normalize(mat3(modelMatrix) * p);
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,fragmentShader:`
        ${St}
        ${wt}
        uniform float uTime;
        uniform vec3 uCameraPos;
        uniform vec3 uColor;
        uniform vec3 uColor2;
        uniform float uProgress;
        uniform float uOpacity;
        uniform float uThickness;
        uniform float uRings;
        uniform float uIntensity;
        uniform float uSeed;
        varying vec3 vNormalW;
        varying vec3 vWorld;
        varying vec3 vLocal;

        void main() {
          vec3 viewDir = normalize(uCameraPos - vWorld);
          float facing = abs(dot(normalize(vNormalW), viewDir));

          /* Thin membrane: only the silhouette is dense. */
          float shell = pow(1.0 - facing, 1.0 / max(uThickness, 0.02));

          /* Break it into filaments so it reads as ionised air, not glass. */
          float n = es_fbm3(vLocal * 4.5 + uSeed + vec3(0.0, uTime * 0.8, 0.0), 4, 2.2, 0.55);
          float rings = pow(abs(sin(vLocal.y * uRings * ES_PI + uSeed)), 6.0);

          float body = shell * (0.35 + 1.1 * n) + rings * shell * 0.8;

          vec3 col = mix(uColor2, uColor, clamp(shell * 1.4, 0.0, 1.0));
          col += vec3(1.0) * pow(shell, 3.0) * 0.7;

          float a = body * uOpacity;
          if (a < 0.004) discard;
          gl_FragColor = vec4(col * uIntensity, clamp(a, 0.0, 1.0));
        }
      `})}spawn(e,t){let i=this.pool.find(r=>r.age>=r.life);if(!i&&this.pool.length<this.count){const r=this._material(),a=new He(this.geometry,r);a.frustumCulled=!1,a.renderOrder=14,this.scene.add(a),i={mesh:a,material:r,age:0,life:0},this.pool.push(i)}i||(i=this.pool[0]),i.mesh.position.copy(e),i.mesh.visible=!0,i.age=0,i.life=t.life??.5,i.from=t.from??.2,i.to=t.to??2,i.peak=t.opacity??1,i.ease=t.ease??.4;const s=i.material.uniforms;return s.uColor.value.set(t.color??"#ffffff"),s.uColor2.value.set(t.color2??t.color??"#88bbff"),s.uThickness.value=t.thickness??.3,s.uNoise.value=t.noise??.45,s.uRings.value=t.rings??3,s.uIntensity.value=t.intensity??1.6,s.uSeed.value=Math.random()*40,i}update(e){for(const t of this.pool){if(t.age>=t.life){t.mesh.visible&&(t.mesh.visible=!1);continue}t.age+=e;const i=pt(t.age/t.life),s=1-Math.pow(1-i,1/Math.max(t.ease,.05)),r=t.from+(t.to-t.from)*s;t.mesh.scale.setScalar(r),t.material.uniforms.uProgress.value=i,t.material.uniforms.uOpacity.value=t.peak*Math.pow(1-i,1.6)}}clear(){for(const e of this.pool)e.age=e.life,e.mesh.visible=!1}}class xc{constructor(){this._handlers=new Map}on(e,t){return this._handlers.has(e)||this._handlers.set(e,new Set),this._handlers.get(e).add(t),()=>this.off(e,t)}off(e,t){this._handlers.get(e)?.delete(t)}emit(e,t){const i=this._handlers.get(e);if(i)for(const s of i)s(t)}}class N0 extends xc{constructor(e){super(),this.canvas=e,this.pointer={x:0,y:0},this.dragging=!1,this._dragMoved=0,this._last={x:0,y:0},this._down=new Set,e.addEventListener("contextmenu",t=>t.preventDefault()),window.addEventListener("keydown",t=>{if(t.repeat)return;const i=t.target;i&&(i.tagName==="INPUT"||i.tagName==="TEXTAREA"||i.isContentEditable)||(this._down.add(t.code),t.code==="Escape"&&this.emit("cancel"),this.emit("key",t.code))}),window.addEventListener("keyup",t=>this._down.delete(t.code)),e.addEventListener("pointerdown",t=>{e.setPointerCapture(t.pointerId),this._last.x=t.clientX,this._last.y=t.clientY,t.button===2&&(this.dragging=!0,this._dragMoved=0)}),window.addEventListener("pointermove",t=>{const i=t.clientX-this._last.x,s=t.clientY-this._last.y;this._last.x=t.clientX,this._last.y=t.clientY,this.pointer.x=t.clientX/window.innerWidth*2-1,this.pointer.y=-(t.clientY/window.innerHeight)*2+1,this.emit("pointer",this.pointer),this.dragging&&(this._dragMoved+=Math.abs(i)+Math.abs(s),this.emit("orbit",{dx:i,dy:s}))}),window.addEventListener("pointerup",t=>{t.button===2?(this._dragMoved<6&&this.emit("cancel"),this.dragging=!1):t.button===0&&this.emit("cast")}),e.addEventListener("wheel",t=>{t.preventDefault(),this.emit("zoom",t.deltaY)},{passive:!1}),window.addEventListener("blur",()=>{this.dragging=!1,this._down.clear()})}isDown(e){return this._down.has(e)}}const O0=`
${St}
${wt}

uniform float uTime;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uLength;       /* world length, to keep the head square */
uniform float uWidth;
uniform float uEdge;
uniform float uFill;
uniform float uGlow;
uniform float uArrowLength;
uniform float uArrowWidth;
uniform float uChevrons;
uniform float uChevronSpeed;
uniform float uChevronSharp;
uniform float uPulseSpeed;
uniform float uPulseDepth;
uniform float uMinRangeT;

varying vec2 vUv;

void main() {
  /* Work in metres so the head does not stretch with the range. */
  float along = vUv.x * uLength;
  float across = (vUv.y - 0.5) * uWidth;

  float halfW = uWidth * 0.5;   /* 'half' is a reserved word in GLSL */
  float headStart = uLength - uArrowLength;

  /* --- shaft: a box that stops where the head begins ------------------- */
  float shaft = es_sdBox(vec2(along - headStart * 0.5, across), vec2(headStart * 0.5, halfW));

  /* --- head: an isoceles triangle sitting on the end of the shaft ------ */
  vec2 hp = vec2(across, along - headStart);
  float head = es_sdTriangleIso(vec2(hp.x, uArrowLength - hp.y),
                                vec2(uArrowWidth * 0.5, uArrowLength));

  float d = min(shaft, head);

  /* --- outline + interior --------------------------------------------- */
  float aa = fwidth(d) * 1.2 + 1e-4;
  float outline = 1.0 - smoothstep(uEdge - aa, uEdge + aa, abs(d));
  float interior = 1.0 - smoothstep(-aa, aa, d);

  /* --- chevrons running toward the target ------------------------------ */
  float lane = along / max(uLength, 1e-3);
  float chev = fract(lane * uChevrons - uTime * uChevronSpeed);
  /* Bend the band into a > by offsetting it with |across|. */
  float bend = abs(across) / max(halfW, 1e-3) * 0.12;
  float band = pow(1.0 - abs(fract(chev + bend) - 0.35) * 2.0, uChevronSharp);
  band = clamp(band, 0.0, 1.0) * interior;

  /* --- edge glow spilling outward, and only outward -------------------- */
  float glow = d > 0.0 ? exp(-d * 9.0) * uGlow : 0.0;

  float pulse = 1.0 + uPulseDepth * sin(uTime * uPulseSpeed);

  /* --- minimum-range gate ---------------------------------------------- */
  float dead = 1.0 - smoothstep(uMinRangeT - 0.01, uMinRangeT + 0.01, lane);

  vec3 col = uColor * (outline * 1.1 + interior * uFill + band * 0.5 + glow * 0.8);
  col += vec3(1.0) * outline * 0.18;

  float a = (outline * 0.85 + interior * uFill + band * 0.4 + glow * 0.5) * uOpacity * pulse;
  a *= mix(1.0, 0.22, dead);
  col *= mix(1.0, 0.5, dead);

  /* Fray the very tip of the tail so it does not start with a hard line. */
  a *= smoothstep(0.0, 0.05, lane);

  if (a < 0.004) discard;
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
}
`,B0=`
${St}
${wt}

uniform float uTime;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uRadius;
uniform float uRimWidth;
uniform float uRimGlow;
uniform float uFill;
uniform float uInnerRing;
uniform float uTicks;
uniform float uTickLength;
uniform float uSpinSpeed;
uniform float uPulseSpeed;
uniform float uPulseDepth;

varying vec2 vUv;

void main() {
  vec2 p = (vUv * 2.0 - 1.0) * uRadius;
  float r = length(p);
  float ang = atan(p.y, p.x);

  float aa = fwidth(r) * 1.5 + 1e-4;

  /* --- the boundary: thick on purpose ---------------------------------- */
  float rim = 1.0 - smoothstep(uRimWidth * 0.5 - aa, uRimWidth * 0.5 + aa, abs(r - uRadius));

  /* --- inner reference ring -------------------------------------------- */
  float inner = 1.0 - smoothstep(0.02, 0.045, abs(r - uRadius * uInnerRing));

  /* --- tick marks around the rim, slowly turning ----------------------- */
  float spin = uTime * uSpinSpeed;
  float tick = pow(abs(cos((ang + spin) * uTicks * 0.5)), 40.0);
  float tickBand = 1.0 - smoothstep(uTickLength * 0.5, uTickLength * 0.5 + 0.02,
                                    abs(r - (uRadius - uTickLength * 0.6)));
  float ticks = tick * tickBand;

  /* --- interior --------------------------------------------------------- */
  float inside = 1.0 - smoothstep(uRadius - aa, uRadius + aa, r);
  float wash = es_fbm2(p * 0.9 + vec2(0.0, uTime * 0.25), 3, 2.1, 0.5);
  float fill = inside * uFill * (0.55 + 0.9 * wash);

  /* --- glow outside the boundary ---------------------------------------- */
  float glow = exp(-abs(r - uRadius) * 5.0) * uRimGlow;

  float pulse = 1.0 + uPulseDepth * sin(uTime * uPulseSpeed);

  vec3 col = uColor * (rim * 1.2 + inner * 0.5 + ticks * 0.8 + fill + glow * 0.7);
  col += vec3(1.0) * rim * 0.2;

  float a = (rim * 0.85 + inner * 0.4 + ticks * 0.5 + fill + glow * 0.45) * uOpacity * pulse;
  if (a < 0.004) discard;
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
}
`,Sc=`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;class z0{constructor(e,t){this.settings=t;const i=new Di(1,1,1,1);i.rotateX(-Math.PI/2),i.rotateY(-Math.PI/2),i.translate(0,0,.5),this.material=new st({vertexShader:Sc,fragmentShader:O0,uniforms:{uTime:Ye.uTime,uColor:{value:new te(t.aim.color)},uOpacity:{value:0},uLength:{value:10},uWidth:{value:1.4},uEdge:{value:.06},uFill:{value:.14},uGlow:{value:.5},uArrowLength:{value:2},uArrowWidth:{value:1.8},uChevrons:{value:4},uChevronSpeed:{value:1.3},uChevronSharp:{value:2.6},uPulseSpeed:{value:2.4},uPulseDepth:{value:.18},uMinRangeT:{value:0}},transparent:!0,depthWrite:!1,blending:Qt,side:Ft,toneMapped:!0}),this.mesh=new He(i,this.material),this.mesh.renderOrder=20,this.mesh.frustumCulled=!1,this.mesh.visible=!1,e.add(this.mesh),this.opacity=0}set(e,t,i,s,r){const a=this.settings.aim,o=this.material.uniforms;this.mesh.position.set(e.x,a.height,e.z),this.mesh.rotation.y=Math.atan2(t.x,t.z),this.mesh.scale.set(a.width,1,i),o.uLength.value=i,o.uWidth.value=a.width,o.uEdge.value=a.edgeWidth,o.uFill.value=a.fill,o.uGlow.value=a.glow,o.uArrowLength.value=a.arrowLength,o.uArrowWidth.value=a.arrowWidth,o.uChevrons.value=a.chevrons,o.uChevronSpeed.value=a.chevronSpeed,o.uChevronSharp.value=a.chevronSharpness,o.uPulseSpeed.value=a.pulseSpeed,o.uPulseDepth.value=a.pulseDepth,o.uMinRangeT.value=s?Math.min(.99,s.minRange/Math.max(i,.001)):0,o.uColor.value.set(r?a.color:a.invalidColor)}show(e){this.target=e?1:0}update(e){const t=this.settings.aim;this.opacity=Wi(this.opacity,this.target??0,1/Math.max(t.fadeIn,.01),e),this.material.uniforms.uOpacity.value=this.opacity,this.mesh.visible=this.opacity>.01}}class k0{constructor(e,t){this.settings=t;const i=new Di(1,1,1,1);i.rotateX(-Math.PI/2),this.material=new st({vertexShader:Sc,fragmentShader:B0,uniforms:{uTime:Ye.uTime,uColor:{value:new te(t.aim.color)},uOpacity:{value:0},uRadius:{value:3},uRimWidth:{value:.3},uRimGlow:{value:.9},uFill:{value:.09},uInnerRing:{value:.62},uTicks:{value:48},uTickLength:{value:.22},uSpinSpeed:{value:.35},uPulseSpeed:{value:2.4},uPulseDepth:{value:.18}},transparent:!0,depthWrite:!1,blending:Qt,side:Ft,toneMapped:!0}),this.mesh=new He(i,this.material),this.mesh.renderOrder=20,this.mesh.frustumCulled=!1,this.mesh.visible=!1,e.add(this.mesh),this.opacity=0}set(e,t,i){const s=this.settings.aim,r=s.zone,a=this.material.uniforms,o=t*1.28;this.mesh.position.set(e.x,s.height,e.z),this.mesh.scale.set(o*2,1,o*2),a.uRadius.value=t/o,a.uRimWidth.value=r.rimWidth/o*1,a.uRimGlow.value=r.rimGlow,a.uFill.value=r.fill,a.uInnerRing.value=r.innerRing,a.uTicks.value=r.ticks,a.uTickLength.value=r.tickLength/o,a.uSpinSpeed.value=r.spinSpeed,a.uPulseSpeed.value=s.pulseSpeed,a.uPulseDepth.value=s.pulseDepth,a.uColor.value.set(i?s.color:s.invalidColor)}show(e){this.target=e?1:0}update(e){const t=this.settings.aim;this.opacity=Wi(this.opacity,this.target??0,1/Math.max(t.fadeIn,.01),e),this.material.uniforms.uOpacity.value=this.opacity,this.mesh.visible=this.opacity>.01}}class V0{constructor(e,t,i){this.camera=t,this.settings=i,this.line=new z0(e,i),this.zone=new k0(e,i),this.raycaster=new th,this.plane=new wi(new C(0,1,0),0),this.origin=new C,this.cursor=new C(0,0,10),this.direction=new C(0,0,1),this.point=new C(0,0,10),this.distance=10,this.valid=!0,this.ability=null,this._pointer=new Re,this._hit=new C}setPointer(e){this._pointer.set(e.x,e.y)}resolveCursor(){return this.raycaster.setFromCamera(this._pointer,this.camera),this.raycaster.ray.intersectPlane(this.plane,this._hit)?(this.cursor.copy(this._hit),!0):!1}update(e,t,i){this.ability=t,this.origin.copy(i),this.resolveCursor();const s=!!t,r=s&&t.aimMode==="zone";if(this.line.show(s&&!r),this.zone.show(s&&r),s)if(r){this.point.copy(this.cursor).setY(0);const a=this.point.clone().sub(i).setY(0),o=a.length();o>t.range&&(a.multiplyScalar(t.range/o),this.point.copy(i).add(a)),this.distance=Math.min(o,t.range),this.direction.copy(a).setY(0),this.direction.lengthSq()<1e-6&&this.direction.set(0,0,1),this.direction.normalize(),this.valid=this.distance>=t.minRange,this.zone.set(this.point,t.radius??3,this.valid)}else{this.direction.copy(this.cursor).sub(i).setY(0);const a=this.direction.length();a<1e-4?this.direction.set(0,0,1):this.direction.divideScalar(a),this.distance=t.range,this.point.copy(i).addScaledVector(this.direction,t.range).setY(0),this.valid=a>=t.minRange,this.line.set(i,this.direction,t.range,t,this.valid)}this.line.update(e),this.zone.update(e)}}class Bn{constructor(e,t){this.ctx=e,this.key=t,this.instances=[],this.maxInstances=3,this._nextId=0}get s(){return this.ctx.settings.abilities[this.key]}get scene(){return this.ctx.scene}get particles(){return this.ctx.particles}get decals(){return this.ctx.decals}get lights(){return this.ctx.lights}get bursts(){return this.ctx.bursts}get time(){return this.ctx.time}createInstance(){return{}}begin(){}step(){}end(){}sync(){}cast(e){let t=this.instances.find(i=>!i.active);return t||(this.instances.length>=this.maxInstances?(t=this.instances.reduce((i,s)=>i.age>s.age?i:s),this.end(t)):(t=this.createInstance(),t.active=!1,t.age=0,this.instances.push(t))),t.id=this._nextId++,t.active=!0,t.age=0,t.birth=this.time.sim,t.origin=(t.origin??new C).copy(e.origin),t.direction=(t.direction??new C).copy(e.direction).normalize(),t.point=(t.point??new C).copy(e.point),t.distance=e.distance,t.seed=Math.random()*100,this.begin(t,e),t}update(e){const t=this.s.duration;for(const i of this.instances)i.active&&(i.age+=e,i.t=pt(i.age/t),this.step(i,e),i.age>=t&&(i.active=!1,this.end(i)))}clear(){for(const e of this.instances)e.active&&(e.active=!1,this.end(e))}frontDistance(e,t){return Math.min(e.distance,t*e.age)}frontPoint(e,t,i=new C){return i.copy(e.origin).addScaledVector(e.direction,this.frontDistance(e,t))}}function G0(n){const e={uSimTime:Ye.uSimTime,uColorDeep:{value:new te(n.colorDeep)},uColorMid:{value:new te(n.colorMid)},uColorEdge:{value:new te(n.colorEdge)},uRimPower:{value:n.rimPower},uRimStrength:{value:n.rimStrength},uInteriorScale:{value:n.interiorScale},uInteriorStrength:{value:n.interiorStrength},uSparkle:{value:n.sparkle},uSparkleScale:{value:n.sparkleScale},uEmissive:{value:n.emissive},uRiseTime:{value:.2},uOvershoot:{value:2},uHoldTime:{value:1.5},uSinkTime:{value:.9}},t=new Hu({color:16777215,roughness:.14,metalness:0,transmission:n.refraction,thickness:.6,ior:1.31,transparent:!0,opacity:n.opacity,envMapIntensity:1.5,clearcoat:.6,clearcoatRoughness:.18,side:Ft,depthWrite:!0});return t.onBeforeCompile=i=>{Object.assign(i.uniforms,e),i.vertexShader=i.vertexShader.replace("#include <common>",`#include <common>
         ${wt}
         uniform float uSimTime;
         uniform float uRiseTime;
         uniform float uOvershoot;
         uniform float uHoldTime;
         uniform float uSinkTime;
         attribute float aBirth;
         attribute float aDelay;
         attribute float aSeed;
         attribute float aHeight;
         varying float vSeed;
         varying float vHeightT;
         varying vec3 vLocal;
         varying float vLife;`).replace("#include <begin_vertex>",`#include <begin_vertex>
         {
           float age = uSimTime - aBirth - aDelay;
           float rise = 0.0;

           if (age > 0.0) {
             if (age < uRiseTime) {
               /* Punch out of the floor and overshoot past the resting size. */
               rise = es_easeOutBack(age / uRiseTime, uOvershoot);
             } else if (age < uRiseTime + uHoldTime) {
               rise = 1.0;
             } else {
               float s = (age - uRiseTime - uHoldTime) / max(uSinkTime, 1e-3);
               rise = 1.0 - es_easeInCubic(clamp(s, 0.0, 1.0));
             }
           }
           rise = max(rise, 0.0);
           vLife = rise;

           /* Tear upward out of the ground: the body scales along its own axis
              and the whole crystal is pushed under the floor until it is out. */
           transformed.y *= rise * aHeight;
           transformed.xz *= mix(0.55, 1.0, clamp(rise, 0.0, 1.0));
           transformed.y -= (1.0 - clamp(rise, 0.0, 1.0)) * 0.35;

           /* A little shiver while it is still coming up. */
           float shiver = (1.0 - smoothstep(0.0, uRiseTime * 1.6, age)) * 0.035;
           transformed.xz += vec2(
             sin(uSimTime * 44.0 + aSeed * 30.0),
             cos(uSimTime * 39.0 + aSeed * 21.0)
           ) * shiver;

           vSeed = aSeed;
           vHeightT = clamp(position.y, 0.0, 1.0);
           vLocal = transformed;
         }`),i.fragmentShader=i.fragmentShader.replace("#include <common>",`#include <common>
         ${St}
         ${wt}
         uniform float uSimTime;
         uniform vec3 uColorDeep;
         uniform vec3 uColorMid;
         uniform vec3 uColorEdge;
         uniform float uRimPower;
         uniform float uRimStrength;
         uniform float uInteriorScale;
         uniform float uInteriorStrength;
         uniform float uSparkle;
         uniform float uSparkleScale;
         uniform float uEmissive;
         varying float vSeed;
         varying float vHeightT;
         varying vec3 vLocal;
         varying float vLife;`).replace("#include <color_fragment>",`#include <color_fragment>
         {
           /* <color_fragment> runs before <normal_fragment_begin>, so the only
              normal available here is the interpolated vertex one. */
           vec3 viewDir = normalize(vViewPosition);
           float facing = clamp(dot(normalize(vNormal), viewDir), 0.0, 1.0);

           /* Deep where you look through a lot of ice, bright at a grazing
              angle — the cheapest honest stand-in for absorption. */
           float depth = 1.0 - facing;
           vec3 body = es_ramp3(uColorDeep, uColorMid, uColorEdge, depth * 0.9 + vHeightT * 0.22);

           /* Internal fractures. Sampled in local space so they travel with the
              crystal instead of swimming when the camera moves. */
           float frac = es_worley3(vLocal * uInteriorScale + vSeed * 17.0);
           float veins = smoothstep(0.34, 0.0, frac);
           body = mix(body, uColorEdge, veins * uInteriorStrength);

           float cloud = es_fbm3(vLocal * uInteriorScale * 0.6 + vSeed * 5.0, 3, 2.2, 0.5);
           body *= 0.78 + 0.5 * cloud;

           diffuseColor.rgb *= body;
           diffuseColor.a *= smoothstep(0.0, 0.25, vLife);
         }`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
         {
           vec3 viewDir = normalize(vViewPosition);
           float rim = es_fresnel(normal, viewDir, uRimPower);
           totalEmissiveRadiance += uColorEdge * rim * uRimStrength * uEmissive;

           /* Sparkle: a high-frequency field gated on the view vector, so only a
              handful of facets fire at any one camera position. */
           float glint = es_hash13(floor(vLocal * uSparkleScale) + vSeed * 31.0);
           float gate = pow(max(dot(normalize(normal), viewDir), 0.0), 3.0);
           float twinkle = step(0.988, glint) * gate;
           totalEmissiveRadiance += vec3(1.0) * twinkle * uSparkle * 3.0;

           /* Faint glow up out of the base, so the field reads at distance. */
           totalEmissiveRadiance += uColorMid * (1.0 - vHeightT) * 0.22 * uEmissive;
         }`)},t.userData.uniforms=e,t.customProgramCacheKey=()=>"es-ice",t}function H0(n,e,t){const i=n.userData.uniforms;i.uColorDeep.value.set(e.colorDeep),i.uColorMid.value.set(e.colorMid),i.uColorEdge.value.set(e.colorEdge),i.uRimPower.value=e.rimPower,i.uRimStrength.value=e.rimStrength,i.uInteriorScale.value=e.interiorScale,i.uInteriorStrength.value=e.interiorStrength,i.uSparkle.value=e.sparkle,i.uSparkleScale.value=e.sparkleScale,i.uEmissive.value=e.emissive,n.opacity=e.opacity,n.transmission=e.refraction,t&&(i.uRiseTime.value=t.riseTime,i.uOvershoot.value=t.overshoot,i.uHoldTime.value=t.holdTime,i.uSinkTime.value=t.sinkTime)}class Mc{constructor(e,{capacity:t=320,variant:i="crystal",params:s,timing:r,seed:a=1}){this.capacity=t,this.cursor=0;const o=i==="shard"?Ll({seed:a}):ka({seed:a,sides:6,rings:5});this.variants=[];for(let l=0;l<4;l++)this.variants.push(i==="shard"?Ll({seed:a+l*17,sides:5+l%2}):ka({seed:a+l*29,sides:5+l%3,taper:1.8+l*.32,jitter:.24+l*.06,bend:.1+l*.05}));o.dispose(),this.material=G0(s),this.timing=r,this.meshes=this.variants.map(l=>{const c=l,d=new Iu(c,this.material,t);d.instanceMatrix.setUsage(es),d.frustumCulled=!1,d.castShadow=!1,d.receiveShadow=!1,d.count=t;const f=new Ai(new Float32Array(t),1),u=new Ai(new Float32Array(t),1),m=new Ai(new Float32Array(t),1),g=new Ai(new Float32Array(t),1);f.setUsage(es),u.setUsage(es),f.array.fill(-1e6),g.array.fill(1),c.setAttribute("aBirth",f),c.setAttribute("aDelay",u),c.setAttribute("aSeed",m),c.setAttribute("aHeight",g);const S=new Je().makeScale(1e-4,1e-4,1e-4);for(let p=0;p<t;p++)d.setMatrixAt(p,S);return d.instanceMatrix.needsUpdate=!0,e.add(d),{mesh:d,geometry:c,aBirth:f,aDelay:u,aSeed:m,aHeight:g,cursor:0}}),this._m=new Je,this._q=new an,this._e=new Pi,this._p=new C,this._s=new C}plant(e,t){const i=this.meshes[this.cursor%this.meshes.length];this.cursor++;const s=i.cursor%this.capacity;i.cursor++;const r=t.scale??1,a=t.tilt??0,o=t.tiltDir??Math.random()*Math.PI*2;this._e.set(Math.cos(o)*a,t.yaw??0,Math.sin(o)*a,"YXZ"),this._q.setFromEuler(this._e),this._p.copy(e),this._s.set(r,r,r),this._m.compose(this._p,this._q,this._s),i.mesh.setMatrixAt(s,this._m),i.mesh.instanceMatrix.needsUpdate=!0,i.aBirth.array[s]=t.birth??0,i.aDelay.array[s]=t.delay??0,i.aSeed.array[s]=Math.random(),i.aHeight.array[s]=t.height??1,i.aBirth.needsUpdate=!0,i.aDelay.needsUpdate=!0,i.aSeed.needsUpdate=!0,i.aHeight.needsUpdate=!0}sync(e,t){H0(this.material,e,t??this.timing)}clear(){for(const e of this.meshes)e.aBirth.array.fill(-1e6),e.aBirth.needsUpdate=!0,e.cursor=0;this.cursor=0}}class W0 extends Bn{constructor(e){super(e,"frost"),this.maxInstances=4,this.field=new Mc(this.scene,{capacity:420,variant:"crystal",params:this.s.ice,timing:this.s.crystals,seed:11}),this._p=new C,this._q=new C,this._side=new C}createInstance(){return{planted:0,decalDist:0,impacted:!1}}begin(e){const t=this.s;e.planted=0,e.decalDist=0,e.impacted=!1,this.particles.emit("glow",26,{position:e.origin,positionRadius:.3,direction:e.direction,spread:1.2,speed:[1.5,4],life:[.25,.5],size:[.05,.13],sizeEnd:.1,colorA:Te(t.ice.colorEdge),colorB:Te(t.ice.colorMid),gravity:-1.5,drag:3.5,birth:this.time.sim}),this.lights.spawn(e.origin,{color:t.fx.lightColor,intensity:t.fx.lightIntensity*.5,life:.35,distance:12})}_plant(e,t,i){const r=this.s.crystals,a=t/Math.max(e.distance,.001),o=r.spread*(1+r.spreadGrowth*a),l=ye.spread(o);this._side.set(e.direction.z,0,-e.direction.x),this._p.copy(e.origin).addScaledVector(e.direction,t+ye.spread(.35)).addScaledVector(this._side,l),this._p.y=0;const c=zt(r.sizeNear,r.sizeFar,a)*(1+ye.spread(r.sizeJitter));this.field.plant(this._p,{scale:c,height:r.heightScale*(1+ye.spread(.3)),yaw:ye.next()*Math.PI*2,tilt:r.tilt*(.4+ye.next()),tiltDir:Math.atan2(l,.35)+ye.spread(.8),birth:i,delay:ye.range(0,.05)})}_impact(e){const t=this.s,i=t.crystals,s=t.fx,r=this._q.copy(e.origin).addScaledVector(e.direction,e.distance);r.y=0;for(let o=0;o<i.clusterCount;o++){const l=ye.next()*Math.PI*2,c=Math.sqrt(ye.next())*i.clusterRadius;this._p.set(r.x+Math.cos(l)*c,0,r.z+Math.sin(l)*c),this.field.plant(this._p,{scale:i.sizeFar*i.clusterScale*(1+ye.spread(.4)),height:i.heightScale*(1+ye.spread(.35)),yaw:ye.next()*Math.PI*2,tilt:i.tilt*1.5*ye.next(),tiltDir:l,birth:this.time.sim,delay:ye.range(0,.12)})}this.decals.spawn("frost",{position:r,size:t.decal.radiusFar*2.4,color:t.decal.color,color2:t.ice.colorMid,opacity:t.decal.opacity,scale:t.decal.rimeScale,progress:1,life:t.decal.fade*1.6,fadeIn:t.decal.growTime,hold:t.decal.fade*.4,seed:e.seed});const a=this.time.sim;this.particles.emit("smoke",s.impactMist,{position:r,positionRadius:1.2,direction:wn,spread:1.5,speed:[1.2,4.5],life:[.9,1.9],size:[s.mistSize*.6,s.mistSize*1.4],sizeEnd:1.8,colorA:Te(t.decal.color),colorB:Te(t.ice.colorDeep),gravity:.5,drag:1.6,turbulence:.55,spin:.7,tint:.12,birth:a}),this.particles.emit("chip",s.impactChips,{position:r,positionRadius:.6,direction:wn,spread:1.15,speed:[3,s.chipSpeed*1.6],life:[.8,1.6],size:[.06,.2],sizeEnd:.8,colorA:Te(t.ice.colorEdge),colorB:Te(t.ice.colorMid),gravity:-16,drag:.35,spin:9,tint:.15,birth:a}),this.particles.emit("glow",s.impactGlitter,{position:r,positionRadius:1,direction:wn,spread:1.4,speed:[2,8],life:[.5,1.1],size:[.04,.13],sizeEnd:.1,colorA:Te(t.ice.colorEdge),colorB:Te(t.decal.color),gravity:-3,drag:1.1,turbulence:.4,birth:a}),this.bursts.spawn(r.clone().setY(.4),{color:t.decal.color,color2:t.ice.colorDeep,life:.42,from:.4,to:3,opacity:.24,thickness:.16,noise:.6,rings:4,intensity:1.3}),this.lights.spawn(r.clone().setY(1.2),{color:t.fx.lightColor,intensity:t.fx.lightIntensity,life:.7,decay:t.fx.lightDecay,distance:22}),this.ctx.shake(s.shake),this.ctx.flash(s.flash,t.decal.color)}step(e,t){const i=this.s,s=Math.min(e.distance,i.front.speed*e.age),r=s/Math.max(e.distance,.001),a=this.time.sim,o=i.crystals.count,l=Math.floor(r*o);let c=0;for(;e.planted<l&&c++<40;){const f=(e.planted+.5)/o*e.distance;this._plant(e,f,a),e.planted++}const d=2.2;for(;e.decalDist<s-d*.5&&e.decalDist<e.distance;){e.decalDist+=d;const f=e.decalDist/Math.max(e.distance,.001);this._p.copy(e.origin).addScaledVector(e.direction,e.decalDist).setY(0),this.decals.spawn("frost",{position:this._p,size:zt(i.decal.radius,i.decal.radiusFar,f)*2,color:i.decal.color,color2:i.ice.colorMid,opacity:i.decal.opacity*.85,scale:i.decal.rimeScale,life:i.decal.fade,fadeIn:i.decal.growTime,hold:i.decal.fade*.35,seed:ye.next()*100})}if(s<e.distance){this._p.copy(e.origin).addScaledVector(e.direction,s).setY(.15);const f=i.fx;this.particles.emitRate(`frost-${e.id}-mist`,"smoke",f.mistCount*30,t,{position:this._p,positionRadius:.55,direction:wn,spread:1.4,speed:[.8,2.6],life:[.7,1.4],size:[f.mistSize*.5,f.mistSize],sizeEnd:2.1,colorA:Te(i.decal.color),colorB:Te(i.ice.colorDeep),gravity:.4,drag:1.8,turbulence:.5,spin:.6,tint:.1,birth:a}),this.particles.emitRate(`frost-${e.id}-chip`,"chip",f.chipCount*30,t,{position:this._p,positionRadius:.4,direction:wn,spread:.9,speed:[2,f.chipSpeed],life:[.5,1.1],size:[.05,.15],sizeEnd:.7,colorA:Te(i.ice.colorEdge),colorB:Te(i.ice.colorMid),gravity:-15,drag:.3,spin:8,birth:a}),this.particles.emitRate(`frost-${e.id}-glit`,"glow",f.glitterCount*30,t,{position:this._p,positionRadius:.7,direction:wn,spread:1.3,speed:[1.5,5],life:[.35,.8],size:[.03,.1],sizeEnd:.1,colorA:Te(i.ice.colorEdge),colorB:Te(i.decal.color),gravity:-2.5,drag:1.4,birth:a})}!e.impacted&&s>=e.distance-.001&&(e.impacted=!0,this._impact(e))}end(e){this.particles.dropRate(`frost-${e.id}-mist`),this.particles.dropRate(`frost-${e.id}-chip`),this.particles.dropRate(`frost-${e.id}-glit`)}sync(){this.field.sync(this.s.ice,this.s.crystals)}clear(){super.clear(),this.field.clear()}}const wn=new C(0,1,0),X0={bolt:0,helix:1,crawl:2,rim:3};function is({path:n="bolt",blending:e=Qt,depthWrite:t=!1,extra:i={}}={}){const s={uTime:Ye.uTime,uSimTime:Ye.uSimTime,uCameraPos:Ye.uCameraPos,uStart:{value:new C},uEnd:{value:new C(0,0,1)},uCentre:{value:new C},uAxis:{value:new C(0,0,1)},uHead:{value:1},uTail:{value:0},uWidth:{value:.12},uWidthJitter:{value:.5},uTaper:{value:.5},uCount:{value:6},uChaos:{value:.5},uChaosScale:{value:1.5},uChaosDetail:{value:3.4},uChaosSpeed:{value:14},uSag:{value:.2},uSpiral:{value:.4},uSpiralRadius:{value:.25},uRadius:{value:1},uTurns:{value:3},uLift:{value:.4},uArc:{value:1.2},uPhase:{value:0},uWander:{value:.5},uColorCore:{value:new te("#ffffff")},uColorMid:{value:new te("#a9c8ff")},uColorEdge:{value:new te("#7b4dff")},uIntensity:{value:2.5},uOpacity:{value:1},uFlicker:{value:.6},uFlickerRate:{value:15},uSeed:{value:0},...i},r=new st({uniforms:s,defines:{ES_PATH:X0[n]??0},transparent:!0,depthWrite:t,depthTest:!0,blending:e,side:Ft,toneMapped:!0,vertexShader:`
      ${St}
      ${wt}

      uniform float uTime;
      uniform vec3 uCameraPos;
      uniform vec3 uStart;
      uniform vec3 uEnd;
      uniform vec3 uCentre;
      uniform vec3 uAxis;
      uniform float uHead;
      uniform float uTail;
      uniform float uWidth;
      uniform float uWidthJitter;
      uniform float uTaper;
      uniform float uCount;
      uniform float uChaos;
      uniform float uChaosScale;
      uniform float uChaosDetail;
      uniform float uChaosSpeed;
      uniform float uSag;
      uniform float uSpiral;
      uniform float uSpiralRadius;
      uniform float uRadius;
      uniform float uTurns;
      uniform float uLift;
      uniform float uArc;
      uniform float uPhase;
      uniform float uWander;
      uniform float uSeed;

      attribute float aT;
      attribute float aSide;
      attribute float aIndex;

      varying float vT;
      varying float vCross;
      varying float vFilament;
      varying float vAlive;

      /* Where filament fi is at parameter t. Every path lives in here. */
      vec3 pathPoint(float t, float fi) {
        float phase = fi * 7.31 + uSeed * 13.7;
        float ring = (fi + 1.0) / max(uCount, 1.0);

      #if ES_PATH == 0
        /* ---- bolt ---- */
        vec3 base = mix(uStart, uEnd, t);
        float len = max(distance(uStart, uEnd), 0.001);
        mat3 B = es_basis(uEnd - uStart);

        /* Pinned at both ends, loosest in the middle. */
        float env = sin(t * ES_PI);
        float amp = uChaos * env;

        float n1 = es_snoise(vec3(t * len * uChaosScale, phase, uTime * uChaosSpeed * 0.1));
        float n2 = es_snoise(vec3(t * len * uChaosScale * uChaosDetail + 31.0,
                                  phase + 5.0, uTime * uChaosSpeed * 0.17));
        float n3 = es_snoise(vec3(t * len * uChaosScale * 0.4 - 11.0,
                                  phase + 19.0, uTime * uChaosSpeed * 0.06));
        vec2 lateral = vec2(n1 + n3 * 0.6, n2 + n3 * 0.4) * amp;

        /* Filaments wound around the trunk so the bundle has volume. */
        float a = t * uSpiral * ES_TAU + phase;
        lateral += vec2(cos(a), sin(a)) * ring * uSpiralRadius * env;

        base += B * vec3(lateral, 0.0);
        base.y -= uSag * env;
        return base;

      #elif ES_PATH == 1
        /* ---- helix ---- */
        vec3 base = mix(uStart, uEnd, t);
        mat3 B = es_basis(uEnd - uStart);
        float a = t * uTurns * ES_TAU + phase + uPhase;
        float r = uRadius * (0.65 + 0.35 * sin(t * ES_PI));
        r *= 1.0 - uTaper * t;
        vec2 lateral = vec2(cos(a), sin(a)) * r;
        lateral += vec2(
          es_snoise(vec3(t * 6.0, phase, uTime * 1.4)),
          es_snoise(vec3(t * 6.0 + 9.0, phase, uTime * 1.4))
        ) * uChaos * 0.12;
        return base + B * vec3(lateral, 0.0);

      #elif ES_PATH == 2
        /* ---- crawl ---- : a tendril feeling its way out across the floor. */
        float a0 = (fi / max(uCount, 1.0)) * ES_TAU + uPhase;
        float wander = uWander * (
          es_snoise(vec3(t * 3.2, phase, uTime * 0.9)) * 0.7 +
          es_snoise(vec3(t * 9.0, phase + 4.0, uTime * 2.1)) * 0.3
        );
        float a = a0 + wander * (0.3 + t);
        float r = uRadius * t;
        vec3 p = uCentre + vec3(cos(a) * r, 0.0, sin(a) * r);
        /* Skips off the floor rather than sliding along it. */
        p.y += uLift * abs(sin(t * 9.0 + phase)) * (1.0 - t) + 0.03;
        return p;

      #else
        /* ---- rim ---- */
        float a = uPhase + phase + t * uArc;
        float r = uRadius * (1.0 + 0.05 * es_snoise(vec3(t * 5.0, phase, uTime * 2.0)));
        vec3 p = uCentre + vec3(cos(a) * r, 0.0, sin(a) * r);
        p.y += uLift * (0.35 + 0.65 * sin(t * ES_PI)) *
               (0.6 + 0.4 * es_snoise(vec3(t * 7.0, phase, uTime * 3.0)));
        return p;
      #endif
      }

      void main() {
        float fi = aIndex;
        float t = aT;

        /* The strike front and its tail. Outside the window the strip is
           collapsed to zero width instead of being drawn transparent. */
        float alive = step(uTail, t) * step(t, uHead);
        vAlive = alive;

        vec3 p0 = pathPoint(t, fi);
        vec3 p1 = pathPoint(min(t + 0.012, 1.0), fi);
        vec3 tangent = normalize(p1 - p0 + vec3(1e-5));
        vec3 toCam = normalize(uCameraPos - p0);
        vec3 side = normalize(cross(tangent, toCam) + vec3(1e-6));

        /* Taper toward both ends, plus a per-filament thickness scatter. */
        float taperT = pow(sin(clamp(t, 0.0, 1.0) * ES_PI), uTaper);
        float jitter = 1.0 + uWidthJitter * (es_hash11(fi * 3.17 + uSeed) - 0.5);
        float w = uWidth * mix(1.0, taperT, uTaper > 0.0 ? 1.0 : 0.0) * jitter * alive;

        vec3 world = p0 + side * (aSide * w);

        vT = t;
        vCross = aSide;
        vFilament = fi;

        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }
    `,fragmentShader:`
      ${St}
      ${wt}

      uniform float uTime;
      uniform vec3 uColorCore;
      uniform vec3 uColorMid;
      uniform vec3 uColorEdge;
      uniform float uIntensity;
      uniform float uOpacity;
      uniform float uFlicker;
      uniform float uFlickerRate;
      uniform float uHead;
      uniform float uSeed;

      varying float vT;
      varying float vCross;
      varying float vFilament;
      varying float vAlive;

      void main() {
        if (vAlive < 0.5) discard;

        /* Across the strip: a hot core inside a soft sheath. */
        float d = abs(vCross);
        float core = pow(1.0 - d, 6.0);
        float sheath = pow(1.0 - d, 1.6);

        vec3 col = es_ramp3(uColorCore, uColorMid, uColorEdge, d);
        col += uColorCore * core * 1.8;

        /* Gutter and re-strike: a fast flicker that walks along the strip so the
           whole filament never dies at once. */
        float f = es_noise2(vec2(vT * 9.0 + vFilament * 3.7, uTime * uFlickerRate));
        float flick = mix(1.0, 0.25 + 1.5 * f, uFlicker);

        /* Brightest right at the strike front. */
        float head = smoothstep(0.16, 0.0, uHead - vT);

        /* Flicker modulates opacity, not opacity *and* colour — doing both
           squares it, and seven overlapping filaments then clip to white. */
        float a = sheath * flick * uOpacity;
        a *= 0.65 + 0.6 * head;
        if (a < 0.006) discard;

        gl_FragColor = vec4(col * uIntensity * (0.8 + 0.45 * head), a);
      }
    `});return r.userData.uniforms=s,r}const kr=12;class $0 extends Bn{constructor(e){super(e,"storm"),this.maxInstances=3,this._p=new C,this._q=new C}createInstance(){const e=ts(this.s.bolt.segments,kr),t=is({path:"bolt"}),i=new He(e,t);return i.frustumCulled=!1,i.renderOrder=16,i.visible=!1,this.scene.add(i),{mesh:i,material:t,geometry:e,u:t.userData.uniforms,decalDist:0,impacted:!1}}begin(e){const t=this.s,i=t.bolt;e.decalDist=0,e.impacted=!1,e.mesh.visible=!0,this._q.copy(e.origin).addScaledVector(e.direction,e.distance).setY(.06);const s=e.u;s.uStart.value.copy(e.origin),s.uEnd.value.copy(this._q),s.uSeed.value=e.seed,s.uCount.value=i.filaments,e.geometry.instanceCount=Math.min(kr,Math.max(1,Math.round(i.filaments)));const r=this._p.copy(e.origin).addScaledVector(e.direction,e.distance*.5);r.y=0,this.decals.spawn("scorch",{position:r,size:Math.max(e.distance*1.1,2),color:t.decal.scorchColor,opacity:.55,scale:1.6,life:t.decal.scorchFade,fadeIn:.08,hold:t.decal.scorchFade*.4,seed:e.seed}),this.lights.spawn(e.origin,{color:t.fx.lightColor,intensity:t.fx.lightIntensity*.5,life:.25,distance:14,flicker:t.fx.lightFlicker}),this.ctx.flash(t.fx.flash*.4,t.bolt.colorMid)}_impact(e){const t=this.s,i=this.time.sim,s=this._q.copy(e.origin).addScaledVector(e.direction,e.distance);s.y=0,this.bursts.spawn(s.clone().setY(t.shell.radius*.55),{color:t.shell.color,color2:t.bolt.colorEdge,life:t.shell.life,from:.3,to:t.shell.radius,opacity:t.shell.opacity,thickness:t.shell.thickness,noise:t.shell.noise,rings:t.shell.rings,intensity:1.3}),this.particles.emit("spark",t.fx.impactSparks,{position:s,positionRadius:.35,direction:Vr,spread:1.5,speed:[4,t.fx.sparkSpeed*2.2],life:[.25,t.fx.sparkLife*1.6],size:[t.fx.sparkSize*.7,t.fx.sparkSize*1.8],sizeEnd:.2,colorA:Te(t.bolt.colorCore),colorB:Te(t.bolt.colorEdge),gravity:-14,drag:1.2,turbulence:.5,tint:.2,birth:i}),this.particles.emit("smoke",t.fx.smokeCount,{position:s,positionRadius:.7,direction:Vr,spread:1.4,speed:[.8,2.6],life:[1.1,2.2],size:[1,2.2],sizeEnd:2.2,colorA:Te("#2a3346"),colorB:Te("#0a0d14"),gravity:.55,drag:1.5,turbulence:.4,spin:.5,birth:i}),this.decals.spawn("electric",{position:s,size:t.decal.radius*2.4,color:t.decal.burnColor,color2:t.bolt.colorEdge,opacity:t.decal.opacity,scale:t.decal.branchScale,sharp:t.decal.branchSharp,flicker:t.decal.flicker,progress:1,life:t.decal.burnFade,fadeIn:.04,seed:e.seed+3}),this.decals.spawn("scorch",{position:s,size:t.decal.radius*1.8,color:t.decal.scorchColor,opacity:.85,scale:2.4,life:t.decal.scorchFade,fadeIn:.06,hold:t.decal.scorchFade*.5,seed:e.seed+9}),this.lights.spawn(s.clone().setY(1.4),{color:t.fx.lightColor,intensity:t.fx.lightIntensity,life:.5,distance:26,flicker:t.fx.lightFlicker,decay:.8}),this.ctx.shake(t.fx.shake),this.ctx.flash(t.fx.flash,t.bolt.colorMid)}step(e,t){const i=this.s,s=i.bolt,r=e.u,a=this.time.sim,o=e.distance/Math.max(s.chaosSpeed*0+i.front.speed,.001),l=pt(e.age/Math.max(o,1e-4)),c=o+s.holdTime;let d=0,f=1;if(e.age>c){const g=pt((e.age-c)/Math.max(s.blowout,.001));d=g,f=1-g*g}r.uHead.value=l,r.uTail.value=d,r.uOpacity.value=f,r.uWidth.value=s.width,r.uWidthJitter.value=s.widthJitter,r.uTaper.value=s.taper,r.uChaos.value=s.chaos,r.uChaosScale.value=s.chaosScale,r.uChaosDetail.value=s.chaosDetail,r.uChaosSpeed.value=s.chaosSpeed,r.uSag.value=s.sag,r.uSpiral.value=s.spiral,r.uSpiralRadius.value=s.width*2.4,r.uCount.value=s.filaments,r.uIntensity.value=s.intensity,r.uFlicker.value=s.restrikeDepth,r.uFlickerRate.value=s.restrikeRate,r.uColorCore.value.set(s.colorCore),r.uColorMid.value.set(s.colorMid),r.uColorEdge.value.set(s.colorEdge),e.geometry.instanceCount=Math.min(kr,Math.max(1,Math.round(s.filaments))),e.mesh.visible=f>.01;const u=l*e.distance,m=2.6;for(;e.decalDist<u-m*.5&&e.decalDist<e.distance;)e.decalDist+=m,this._p.copy(e.origin).addScaledVector(e.direction,e.decalDist).setY(0),this.decals.spawn("electric",{position:this._p,size:i.decal.trailWidth*3.2,color:i.decal.burnColor,color2:i.bolt.colorEdge,opacity:i.decal.opacity*.7,scale:i.decal.branchScale*1.4,sharp:i.decal.branchSharp,flicker:i.decal.flicker,progress:1,life:i.decal.burnFade*.8,fadeIn:.03,seed:ye.next()*100});if(f>.05){const g=ye.next();this._p.copy(e.origin).addScaledVector(e.direction,g*u).setY(.05+(e.origin.y-.05)*(1-g)),this.particles.emitRate(`storm-${e.id}-spark`,"spark",i.fx.sparkRate,t,{position:this._p,positionRadius:s.chaos*.55,direction:Vr,spread:2.2,speed:[1.5,i.fx.sparkSpeed],life:[.15,i.fx.sparkLife],size:[i.fx.sparkSize*.6,i.fx.sparkSize*1.4],sizeEnd:.25,colorA:Te(s.colorCore),colorB:Te(s.colorEdge),gravity:-11,drag:1.4,turbulence:.6,tint:.18,birth:a})}!e.impacted&&l>=1&&(e.impacted=!0,this._impact(e))}end(e){e.mesh.visible=!1,this.particles.dropRate(`storm-${e.id}-spark`)}}const Vr=new C(0,1,0);function q0(n){const e={uTime:Ye.uTime,uHeat:{value:0},uColorCold:{value:new te(n.colorCold)},uColorHot:{value:new te(n.colorHot)},uColorCore:{value:new te(n.colorCore)},uSeamScale:{value:n.seamScale},uSeamWidth:{value:n.seamWidth},uSeamGrowth:{value:n.seamGrowth},uEmissive:{value:n.emissive},uRimHeat:{value:n.rimHeat}},t=new cs({color:16777215,roughness:n.roughness,metalness:.08,envMapIntensity:.5});return t.onBeforeCompile=i=>{Object.assign(i.uniforms,e),i.vertexShader=i.vertexShader.replace("#include <common>",`#include <common>
 varying vec3 vLocal;`).replace("#include <begin_vertex>",`#include <begin_vertex>
 vLocal = position;`),i.fragmentShader=i.fragmentShader.replace("#include <common>",`#include <common>
         ${St}
         ${wt}
         varying vec3 vLocal;
         uniform float uTime;
         uniform float uHeat;
         uniform vec3 uColorCold;
         uniform vec3 uColorHot;
         uniform vec3 uColorCore;
         uniform float uSeamScale;
         uniform float uSeamWidth;
         uniform float uSeamGrowth;
         uniform float uEmissive;
         uniform float uRimHeat;

         /* 0 outside a seam, 1 in the middle of one. */
         float seamField(vec3 p, float width) {
           float cell = es_worley3(p * uSeamScale);
           return 1.0 - smoothstep(0.0, max(width, 1e-3), cell);
         }`).replace("#include <color_fragment>",`#include <color_fragment>
         {
           float grain = es_fbm3(vLocal * 9.0, 4, 2.1, 0.5);
           vec3 rock = uColorCold * (0.55 + 0.9 * grain);

           /* Seams open up as the rock heats. */
           float width = uSeamWidth * (0.35 + uSeamGrowth * uHeat);
           float seam = seamField(vLocal, width);

           /* Only the deepest part of a seam gets to the white core. */
           float depth = smoothstep(0.25, 1.0, seam);
           vec3 lava = mix(uColorHot, uColorCore, depth * (0.35 + 0.65 * uHeat));

           diffuseColor.rgb *= mix(rock, lava * 0.35, seam);
         }`).replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
         {
           float seam = seamField(vLocal, uSeamWidth * (0.35 + uSeamGrowth * uHeat));
           roughnessFactor *= mix(1.0, 0.55, seam);
         }`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
         {
           float width = uSeamWidth * (0.35 + uSeamGrowth * uHeat);
           float seam = seamField(vLocal, width);
           float depth = smoothstep(0.2, 1.0, seam);

           /* Flow inside the seam so the glow is not a static decal. */
           float churn = es_fbm3(vLocal * 5.0 + vec3(0.0, uTime * 0.9, 0.0), 3, 2.2, 0.5);
           float heat = clamp(uHeat * (0.45 + 0.85 * churn), 0.0, 1.4);

           vec3 glow = mix(uColorHot, uColorCore, depth * heat);
           totalEmissiveRadiance += glow * seam * uEmissive * (0.25 + 1.5 * uHeat);

           /* The leading face glows on its own once it is really moving. */
           float rim = es_fresnel(normal, normalize(vViewPosition), 2.2);
           totalEmissiveRadiance += uColorHot * rim * uRimHeat * uHeat;

           /* Whole-body warmth so even the cold rock reads as hot at distance. */
           totalEmissiveRadiance += uColorHot * 0.06 * uHeat;
         }`)},t.userData.uniforms=e,t.customProgramCacheKey=()=>"es-meteor",t}function Y0(n,e){const t=n.userData.uniforms;t.uColorCold.value.set(e.colorCold),t.uColorHot.value.set(e.colorHot),t.uColorCore.value.set(e.colorCore),t.uSeamScale.value=e.seamScale,t.uSeamWidth.value=e.seamWidth,t.uSeamGrowth.value=e.seamGrowth,t.uEmissive.value=e.emissive,t.uRimHeat.value=e.rimHeat,n.roughness=e.roughness}function K0(n){const e={uTime:Ye.uTime,uSimTime:Ye.uSimTime,uCamObj:{value:new C},uSteps:{value:n.steps},uDensity:{value:n.density},uNoiseScale:{value:n.noiseScale},uNoiseSpeed:{value:n.noiseSpeed},uRise:{value:n.rise},uAbsorption:{value:n.absorption},uColorInner:{value:new te(n.colorInner)},uColorMid:{value:new te(n.colorMid)},uColorOuter:{value:new te(n.colorOuter)},uIntensity:{value:1},uFade:{value:1},uSeed:{value:0}},t=new st({uniforms:e,transparent:!0,depthWrite:!1,depthTest:!0,blending:Qt,side:Ot,toneMapped:!0,vertexShader:`
      varying vec3 vObj;
      void main() {
        vObj = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      ${St}
      ${wt}

      uniform float uTime;
      uniform vec3 uCamObj;
      uniform float uSteps;
      uniform float uDensity;
      uniform float uNoiseScale;
      uniform float uNoiseSpeed;
      uniform float uRise;
      uniform float uAbsorption;
      uniform vec3 uColorInner;
      uniform vec3 uColorMid;
      uniform vec3 uColorOuter;
      uniform float uIntensity;
      uniform float uFade;
      uniform float uSeed;

      varying vec3 vObj;

      /* Slab intersection against the unit box the mesh is scaled from. */
      bool boxHit(vec3 ro, vec3 rd, out float t0, out float t1) {
        vec3 inv = 1.0 / (rd + vec3(1e-6));
        vec3 a = (vec3(-0.5) - ro) * inv;
        vec3 b = (vec3(0.5) - ro) * inv;
        vec3 lo = min(a, b);
        vec3 hi = max(a, b);
        t0 = max(max(lo.x, lo.y), lo.z);
        t1 = min(min(hi.x, hi.y), hi.z);
        return t1 > max(t0, 0.0);
      }

      /* Density at an object-space point. +Z is the direction of travel, so the
         rock sits at z = +0.5 and the plume trails toward z = -0.5. */
      float medium(vec3 p, out float temp) {
        float along = clamp(p.z + 0.5, 0.0, 1.0);   /* 0 tail .. 1 head */

        /* Hot gas rises as it falls behind. */
        vec3 q = p;
        q.y -= uRise * pow(1.0 - along, 2.0) * 0.5;

        /* Cone: tight at the rock, opening out down the wake. */
        float radius = mix(0.52, 0.1, along);
        float r = length(q.xy) / max(radius, 1e-3);
        float shell = 1.0 - smoothstep(0.35, 1.0, r);
        shell *= smoothstep(0.0, 0.14, along);       /* nothing past the tail */

        vec3 n = q * vec3(uNoiseScale * 2.2, uNoiseScale * 2.2, uNoiseScale)
               + vec3(0.0, -uTime * uNoiseSpeed, uTime * uNoiseSpeed * 0.6)
               + uSeed;
        float f = es_fbm3(n, 4, 2.15, 0.55);
        float ridge = es_ridged(n * 0.8, 3, 2.1, 0.5);
        f = mix(f, ridge, 0.35);

        /* Erode the cone with the field so the plume has tongues, not a taper. */
        float d = shell * smoothstep(0.34, 0.78, f * (0.55 + 0.8 * shell));

        temp = clamp(along * (0.55 + 0.75 * f), 0.0, 1.0);
        return d;
      }

      void main() {
        vec3 ro = uCamObj;
        vec3 rd = normalize(vObj - uCamObj);

        float t0, t1;
        if (!boxHit(ro, rd, t0, t1)) discard;
        t0 = max(t0, 0.0);

        int steps = int(clamp(uSteps, 4.0, 64.0));
        float dt = (t1 - t0) / float(steps);

        /* Dither the entry point so the slices do not band. */
        float jitter = es_hash12(gl_FragCoord.xy + uTime * 60.0);
        float t = t0 + dt * jitter;

        vec3 acc = vec3(0.0);
        float trans = 1.0;

        for (int i = 0; i < 64; i++) {
          if (i >= steps || trans < 0.02) break;
          vec3 p = ro + rd * t;
          float temp;
          float d = medium(p, temp) * uDensity * dt * 8.0;
          if (d > 0.001) {
            vec3 c = es_ramp3(uColorOuter, uColorMid, uColorInner, temp);
            c *= 0.35 + 2.2 * pow(temp, 1.6);
            acc += c * d * trans;
            trans *= exp(-d * uAbsorption);
          }
          t += dt;
        }

        float a = (1.0 - trans) * uFade;
        if (a < 0.004) discard;
        gl_FragColor = vec4(acc * uIntensity * uFade, a);
      }
    `});return t.userData.uniforms=e,t}function Z0(n,e){const t=n.userData.uniforms;t.uSteps.value=e.steps,t.uDensity.value=e.density,t.uNoiseScale.value=e.noiseScale,t.uNoiseSpeed.value=e.noiseSpeed,t.uRise.value=e.rise,t.uAbsorption.value=e.absorption,t.uColorInner.value.set(e.colorInner),t.uColorMid.value.set(e.colorMid),t.uColorOuter.value.set(e.colorOuter)}class J0{constructor(e,{capacity:t=160,colorCold:i="#1b1310",colorHot:s="#ff6a1e"}={}){this.capacity=t,this.cursor=0;const r=new fo,a=T0(4);r.setAttribute("position",a.attributes.position),r.setAttribute("normal",a.attributes.normal),a.dispose();const o=l=>new Ai(new Float32Array(t*l),l).setUsage(es);this.a={aOrigin:o(3),aVelocity:o(3),aSpin:o(3),aBirth:o(1),aLife:o(1),aScale:o(1),aSeed:o(1)};for(const[l,c]of Object.entries(this.a))r.setAttribute(l,c);this.a.aBirth.array.fill(-1e6),this.a.aLife.array.fill(1e-4),r.instanceCount=t,r.boundingSphere=new ti(new C,200),this.uniforms={uSimTime:Ye.uSimTime,uGravity:{value:26},uBounce:{value:.34},uColorCold:{value:new te(i)},uColorHot:{value:new te(s)},uCool:{value:1.6},uEmissive:{value:2.2}},this.material=new cs({color:16777215,roughness:.9,metalness:.05}),this.material.onBeforeCompile=l=>{Object.assign(l.uniforms,this.uniforms),l.vertexShader=l.vertexShader.replace("#include <common>",`#include <common>
           ${wt}
           uniform float uSimTime;
           uniform float uGravity;
           uniform float uBounce;
           attribute vec3 aOrigin;
           attribute vec3 aVelocity;
           attribute vec3 aSpin;
           attribute float aBirth;
           attribute float aLife;
           attribute float aScale;
           attribute float aSeed;
           varying float vHeat;
           varying float vSeed;
           varying vec3 vLocal;`).replace("#include <beginnormal_vertex>",`#include <beginnormal_vertex>
           float dAge = uSimTime - aBirth;
           float dT = dAge / max(aLife, 1e-4);
           mat3 dSpin = es_rotAxis(normalize(aSpin + vec3(1e-4)), length(aSpin) * dAge);
           objectNormal = dSpin * objectNormal;`).replace("#include <begin_vertex>",`#include <begin_vertex>
           {
             if (dT < 0.0 || dT > 1.0) {
               transformed = vec3(0.0, -9999.0, 0.0);
             } else {
               float g = uGravity;
               float r = aScale * 0.5;

               /* Solve for the moment it reaches the floor. */
               float y0 = aOrigin.y - r;
               float disc = max(aVelocity.y * aVelocity.y + 2.0 * g * y0, 0.0);
               float tLand = (aVelocity.y + sqrt(disc)) / g;
               float tt = min(dAge, tLand);

               vec3 p = aOrigin + aVelocity * tt - vec3(0.0, 0.5 * g * tt * tt, 0.0);

               if (dAge > tLand) {
                 /* Landed: keep sliding, bleeding speed. */
                 float sd = dAge - tLand;
                 vec3 vh = vec3(aVelocity.x, 0.0, aVelocity.z) * uBounce;
                 p += vh * (1.0 - exp(-4.0 * sd)) / 4.0;
                 p.y = r;
               }

               /* Crumble away at the end of life instead of blinking out. */
               float shrink = 1.0 - smoothstep(0.78, 1.0, dT);
               transformed = dSpin * (transformed * aScale * shrink) + p;
             }
             vHeat = 1.0 - dT;
             vSeed = aSeed;
             vLocal = position;
           }`),l.fragmentShader=l.fragmentShader.replace("#include <common>",`#include <common>
           ${St}
           ${wt}
           uniform vec3 uColorCold;
           uniform vec3 uColorHot;
           uniform float uCool;
           uniform float uEmissive;
           varying float vHeat;
           varying float vSeed;
           varying vec3 vLocal;`).replace("#include <color_fragment>",`#include <color_fragment>
           {
             float grain = es_fbm3(vLocal * 7.0 + vSeed * 11.0, 3, 2.1, 0.5);
             diffuseColor.rgb *= uColorCold * (0.5 + 1.0 * grain);
           }`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
           {
             float cell = es_worley3(vLocal * 5.0 + vSeed * 9.0);
             float seam = 1.0 - smoothstep(0.0, 0.3, cell);
             float heat = pow(clamp(vHeat, 0.0, 1.0), uCool);
             totalEmissiveRadiance += uColorHot * seam * heat * uEmissive;
           }`)},this.material.customProgramCacheKey=()=>"es-debris",this.mesh=new He(r,this.material),this.mesh.frustumCulled=!1,this.mesh.castShadow=!1,this.mesh.receiveShadow=!1,e.add(this.mesh)}burst(e,t){const i=Math.min(t.count|0,this.capacity);for(let s=0;s<i;s++){const r=this.cursor;this.cursor=(this.cursor+1)%this.capacity;const a=ye.next()*Math.PI*2,o=(t.pitch??.9)*ye.next(),l=t.speed[0]+(t.speed[1]-t.speed[0])*ye.next(),c=Math.cos(o)*l,d=r*3;this.a.aOrigin.array[d]=e.x+ye.spread(.35),this.a.aOrigin.array[d+1]=e.y+.25+ye.next()*.5,this.a.aOrigin.array[d+2]=e.z+ye.spread(.35),this.a.aVelocity.array[d]=Math.cos(a)*c,this.a.aVelocity.array[d+1]=Math.sin(o)*l,this.a.aVelocity.array[d+2]=Math.sin(a)*c;const f=t.spin??8;this.a.aSpin.array[d]=ye.spread(f),this.a.aSpin.array[d+1]=ye.spread(f),this.a.aSpin.array[d+2]=ye.spread(f),this.a.aBirth.array[r]=t.birth??0,this.a.aLife.array[r]=(t.life??4)*(.7+ye.next()*.6),this.a.aScale.array[r]=(t.size??.3)*(.5+ye.next()),this.a.aSeed.array[r]=ye.next()}for(const s of Object.values(this.a))s.needsUpdate=!0}sync({colorCold:e,colorHot:t,gravity:i,bounce:s}={}){e&&this.uniforms.uColorCold.value.set(e),t&&this.uniforms.uColorHot.value.set(t),i!==void 0&&(this.uniforms.uGravity.value=i),s!==void 0&&(this.uniforms.uBounce.value=s)}clear(){this.a.aBirth.array.fill(-1e6),this.a.aBirth.needsUpdate=!0,this.cursor=0}}class Q0 extends Bn{constructor(e){super(e,"cinder"),this.maxInstances=3,this.debris=new J0(this.scene,{capacity:180,colorCold:this.s.rock.colorCold,colorHot:this.s.rock.colorHot}),this._p=new C,this._q=new C,this._vel=new C,this._prev=new C,this._camObj=new C}createInstance(){const e=this.s.flight,t=new He(w0({radius:e.radius,detail:e.detail,craters:e.craterCount,craterDepth:e.craterDepth,fractures:e.fractureCount,fractureDepth:e.fractureDepth,seed:3+Math.floor(Math.random()*90)}),q0(this.s.rock));t.castShadow=!0,t.frustumCulled=!1,t.visible=!1,this.scene.add(t);const i=new He(R0(),K0(this.s.wake));return i.frustumCulled=!1,i.renderOrder=13,i.visible=!1,this.scene.add(i),{rock:t,wake:i,impacted:!1,crackDecal:null,flightTime:1,spin:new C}}begin(e){const t=this.s;e.impacted=!1,e.rock.visible=!0,e.wake.visible=!0,e.flightTime=Math.max(e.distance/Math.max(t.flight.speed,.5),.15),e.spin.set(ye.spread(t.flight.spin),ye.spread(t.flight.spin),ye.spread(t.flight.spin)),e.wake.material.userData.uniforms.uSeed.value=e.seed,this.lights.spawn(e.origin,{color:t.fx.lightColor,intensity:t.fx.lightIntensity*.35,life:.3,distance:12}),this.particles.emit("spark",40,{position:e.origin,positionRadius:.25,direction:e.direction,spread:1.1,speed:[2,7],life:[.3,.7],size:[.07,.16],sizeEnd:.2,colorA:Te(t.rock.colorCore),colorB:Te(t.rock.colorHot),gravity:-6,drag:1.5,birth:this.time.sim})}_position(e,t,i){return i.copy(e.origin).lerp(e.point,t),i.y=e.origin.y*(1-t)+j0(t)*this.s.flight.arc*(e.distance/14),i}_detonate(e){const t=this.s,i=t.impact,s=this.time.sim,r=this._q.copy(e.point).setY(0);e.rock.visible=!1,e.wake.visible=!1,this.bursts.spawn(r.clone().setY(.6),{color:t.rock.colorCore,color2:t.rock.colorHot,life:.55,from:.5,to:i.blastRadius,opacity:.5,thickness:i.blastThickness,noise:.55,rings:3,intensity:1.6}),this.decals.spawn("scorch",{position:r,size:i.craterRadius*2.2,color:i.scorchColor,opacity:.92,scale:2.2,life:i.scorchFade,fadeIn:.05,hold:i.scorchFade*.55,seed:e.seed}),e.crackDecal=this.decals.spawn("molten",{position:r,size:i.crackReach*2.2,color:i.crackColor,color2:i.crackCoreColor,opacity:1,scale:i.crackScale*3.2,width2:i.crackWidth,churn:1.4,progress:0,life:i.glowFade,fadeIn:.08,hold:i.glowFade*.35,seed:e.seed+5}),this.debris.burst(r,{count:i.chunkCount,speed:[i.chunkSpeed*.4,i.chunkSpeed],pitch:1,spin:i.chunkSpin,size:i.chunkSize,life:4.5,birth:s}),this.particles.emit("fire",t.fx.impactEmbers*.5,{position:r,positionRadius:1.1,direction:Zn,spread:1.35,speed:[2,9],life:[.5,1.3],size:[.9,2.4],sizeEnd:2,colorA:Te(t.rock.colorCore),colorB:Te(t.wake.colorOuter),gravity:2.2,drag:2.4,turbulence:.7,spin:1.2,tint:.15,birth:s}),this.particles.emit("spark",t.fx.impactEmbers,{position:r,positionRadius:.6,direction:Zn,spread:1.45,speed:[3,t.fx.emberSpeed*2.4],life:[.6,t.fx.emberLife*1.5],size:[.05,.16],sizeEnd:.25,colorA:Te(t.rock.colorCore),colorB:Te(t.rock.colorHot),gravity:-13,drag:.9,turbulence:.8,tint:.22,birth:s}),this.particles.emit("smoke",t.fx.impactSmoke,{position:r,positionRadius:1.6,direction:Zn,spread:1.5,speed:[1.2,4.5],life:[1.8,t.fx.smokeLife*1.6],size:[t.fx.smokeSize*.6,t.fx.smokeSize*1.5],sizeEnd:2.6,colorA:Te("#3a3028"),colorB:Te("#0b0908"),gravity:.9,drag:1.3,turbulence:.55,spin:.6,tint:.12,birth:s}),this.lights.spawn(r.clone().setY(1.6),{color:t.fx.lightColor,intensity:t.fx.lightIntensity,life:t.fx.lightFade,decay:.7,distance:34}),this.ctx.shake(t.fx.shake),this.ctx.flash(t.fx.flash,t.rock.colorHot)}step(e,t){const i=this.s,s=this.time.sim;if(e.impacted){if(e.crackDecal){const r=e.age-e.flightTime,a=pt(r*i.impact.blastSpeed*.32);e.crackDecal.uniforms.uProgress.value=a,e.crackDecal.uniforms.uChurn.value=1.4,this._q.copy(e.point).setY(.1),this.particles.emitRate(`cinder-${e.id}-burn`,"fire",26,t,{position:this._q,positionRadius:i.impact.craterRadius*.7,direction:Zn,spread:.5,speed:[.5,2.2],life:[.7,1.6],size:[.5,1.3],sizeEnd:2.2,colorA:Te(i.rock.colorHot),colorB:Te(i.wake.colorOuter),gravity:2.6,drag:2.2,turbulence:.6,tint:.18,birth:s})}}else{const r=pt(e.age/e.flightTime);this._prev.copy(e.rock.position),this._position(e,r,this._p),e.rock.position.copy(this._p);const a=Math.pow(r,.7),o=e.rock.material.userData.uniforms;o.uHeat.value=a,e.rock.rotation.x+=e.spin.x*t,e.rock.rotation.y+=e.spin.y*t,e.rock.rotation.z+=e.spin.z*t,e.rock.scale.setScalar(1),this._vel.copy(this._p).sub(this._prev),this._vel.lengthSq()<1e-8&&this._vel.copy(e.direction),this._vel.normalize();const l=i.wake,c=l.length*(.45+.75*a);e.wake.position.copy(this._p).addScaledVector(this._vel,-c*.5+i.flight.radius),e.wake.quaternion.setFromUnitVectors(eg,this._vel),e.wake.scale.set(l.radius*2,l.radius*2,c),e.wake.updateMatrixWorld();const d=e.wake.material.userData.uniforms;e.wake.worldToLocal(this._camObj.copy(this.ctx.camera.position)),d.uCamObj.value.copy(this._camObj),d.uIntensity.value=.6+1.1*a,d.uFade.value=1,this.particles.emitRate(`cinder-${e.id}-ember`,"spark",i.fx.trailEmbers,t,{position:this._p,positionRadius:i.flight.radius*1.2,direction:this._vel.clone().negate(),spread:.9,speed:[1,i.fx.emberSpeed],life:[.35,i.fx.emberLife],size:[.05,.14],sizeEnd:.2,colorA:Te(i.rock.colorCore),colorB:Te(i.rock.colorHot),gravity:-4.5,drag:1.6,turbulence:.8,tint:.2,birth:s}),this.particles.emitRate(`cinder-${e.id}-smoke`,"smoke",i.fx.trailSmoke,t,{position:this._p,positionRadius:i.flight.radius,direction:Zn,spread:1.5,speed:[.4,1.6],life:[1,i.fx.smokeLife],size:[i.fx.smokeSize*.35,i.fx.smokeSize*.8],sizeEnd:2.4,colorA:Te("#4a3a2e"),colorB:Te("#0c0a08"),gravity:.75,drag:1.4,turbulence:.5,spin:.5,birth:s}),r>=1&&(e.impacted=!0,this.particles.dropRate(`cinder-${e.id}-ember`),this.particles.dropRate(`cinder-${e.id}-smoke`),this._detonate(e))}}end(e){e.rock.visible=!1,e.wake.visible=!1,e.crackDecal=null,this.particles.dropRate(`cinder-${e.id}-ember`),this.particles.dropRate(`cinder-${e.id}-smoke`),this.particles.dropRate(`cinder-${e.id}-burn`)}sync(){for(const e of this.instances)Y0(e.rock.material,this.s.rock),Z0(e.wake.material,this.s.wake);this.debris.sync({colorCold:this.s.rock.colorCold,colorHot:this.s.rock.colorHot,bounce:this.s.impact.chunkBounce})}clear(){super.clear(),this.debris.clear()}}function j0(n){return Math.sin(Math.PI*Math.min(Math.max(n,0),1))*1}const Zn=new C(0,1,0),eg=new C(0,0,1);function yc({profile:n="beam",intensity:e=2.6,opacity:t=1,blending:i=Qt,depthWrite:s=!1}={}){const r={uTime:Ye.uTime,uSimTime:Ye.uSimTime,uCameraPos:Ye.uCameraPos,uStart:{value:new C},uEnd:{value:new C(0,1,0)},uRadius:{value:.4},uHead:{value:1},uTailFade:{value:.06},uSwell:{value:.35},uSwellFreq:{value:3.4},uFlare:{value:1.4},uNoiseScale:{value:2.2},uFlowSpeed:{value:5},uWobble:{value:.06},uDiscCount:{value:6},uDiscSpeed:{value:10},uDiscThickness:{value:.05},uDiscSwell:{value:.35},uDiscColor:{value:new te("#dff6ff")},uDiscIntensity:{value:1.8},uColorCore:{value:new te("#ffffff")},uColorMid:{value:new te("#6fe6ff")},uColorEdge:{value:new te("#2b6cff")},uIntensity:{value:e},uOpacity:{value:t},uFresnel:{value:1.8},uSeed:{value:0}};return new st({uniforms:r,defines:{ES_PROFILE:n==="column"?1:0},transparent:!0,depthWrite:s,depthTest:!0,blending:i,side:Ft,toneMapped:!0,vertexShader:`
      ${St}
      ${wt}

      uniform float uTime;
      uniform vec3 uCameraPos;
      uniform vec3 uStart;
      uniform vec3 uEnd;
      uniform float uRadius;
      uniform float uHead;
      uniform float uSwell;
      uniform float uSwellFreq;
      uniform float uFlare;
      uniform float uFlowSpeed;
      uniform float uWobble;
      uniform float uDiscCount;
      uniform float uDiscSpeed;
      uniform float uDiscThickness;
      uniform float uDiscSwell;
      uniform float uSeed;

      attribute float aT;
      attribute float aAngle;

      varying float vT;
      varying float vAngle;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      varying float vDisc;
      varying float vAlive;

      /* Sum of the shock-disc bands at parameter t. */
      float discBands(float t) {
        float sum = 0.0;
        for (int i = 0; i < 12; i++) {
          if (float(i) >= uDiscCount) break;
          float phase = fract(uTime * uDiscSpeed * 0.1 + float(i) / max(uDiscCount, 1.0));
          sum += smoothstep(uDiscThickness, 0.0, abs(t - phase));
        }
        return sum;
      }

      void main() {
        float t = aT;
        vAlive = step(t, uHead);

        vec3 axis = uEnd - uStart;
        float len = max(length(axis), 1e-4);
        mat3 B = es_basis(axis);
        vec3 base = mix(uStart, uEnd, t);

      #if ES_PROFILE == 1
        /* Column: fat at the floor, drawn out and thinning as it climbs. */
        float shape = pow(1.0 - t, 0.55) * mix(1.0, uFlare, pow(1.0 - t, 2.5));
        shape *= 0.35 + 0.75 * smoothstep(0.0, 0.12, t);
      #else
        /* Beam: a spindle, pinched at the muzzle and again at the far end. */
        float shape = pow(sin(clamp(t, 0.0, 1.0) * ES_PI), 0.22);
        shape = mix(shape, 1.0, 0.55);
        shape *= smoothstep(0.0, 0.035, t);
      #endif

        float swell = 1.0 + uSwell * sin(t * uSwellFreq * ES_TAU - uTime * uFlowSpeed);
        float disc = discBands(t);
        float r = uRadius * shape * swell * (1.0 + disc * uDiscSwell);

        /* Never a perfect cylinder — the surface breathes along its length. */
        r *= 1.0 + uWobble * es_snoise(vec3(t * 7.0, aAngle, uTime * 2.0 + uSeed));

        vec2 ring = vec2(cos(aAngle), sin(aAngle));
        vec3 offset = B * vec3(ring * r, 0.0);
        vec3 world = base + offset;

        vT = t;
        vAngle = aAngle;
        vWorld = world;
        vNormalW = normalize(offset + vec3(1e-5));
        vDisc = disc;

        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }
    `,fragmentShader:`
      ${St}
      ${wt}

      uniform float uTime;
      uniform vec3 uCameraPos;
      uniform vec3 uColorCore;
      uniform vec3 uColorMid;
      uniform vec3 uColorEdge;
      uniform vec3 uDiscColor;
      uniform float uDiscIntensity;
      uniform float uIntensity;
      uniform float uOpacity;
      uniform float uFresnel;
      uniform float uNoiseScale;
      uniform float uFlowSpeed;
      uniform float uHead;
      uniform float uTailFade;
      uniform float uSeed;

      varying float vT;
      varying float vAngle;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      varying float vDisc;
      varying float vAlive;

      void main() {
        if (vAlive < 0.5) discard;

        vec3 viewDir = normalize(uCameraPos - vWorld);

        /* Rim-lit shell: a tube seen edge-on should be brighter at its silhouette
           because you are looking through more of it. */
        float facing = abs(dot(normalize(vNormalW), viewDir));
        float rim = pow(1.0 - facing, uFresnel);

        /* Plasma flowing down the tube. Sampled in a cylindrical frame so it
           travels along the axis instead of swimming through world space. */
        vec3 q = vec3(cos(vAngle), sin(vAngle), 0.0) * uNoiseScale
               + vec3(0.0, 0.0, vT * uNoiseScale * 6.0 - uTime * uFlowSpeed);
        float flow = es_fbm3(q + uSeed, 4, 2.1, 0.55);
        float ridge = es_ridged(q * 0.7 + 4.0, 3, 2.2, 0.5);

        vec3 col = es_ramp3(uColorCore, uColorMid, uColorEdge, clamp(rim * 1.35, 0.0, 1.0));
        col = mix(col, uColorCore, pow(1.0 - rim, 3.0) * 0.35);
        col *= 0.45 + 0.8 * flow;
        col += uColorMid * ridge * 0.35;

        /* Shock discs. */
        col += uDiscColor * vDisc * uDiscIntensity;

        /* Mostly silhouette: the tube is drawn double-sided and three times
           over, so a fat interior term stacks up to solid white. */
        float a = (0.06 + 0.5 * rim) * uOpacity;
        a *= 0.55 + 0.7 * flow;
        a += vDisc * 0.22;

        /* Soft ends so the tube dissolves rather than being cut off. */
        a *= smoothstep(0.0, uTailFade, vT);
        a *= smoothstep(uHead, uHead - 0.1, vT);

        if (a < 0.005) discard;
        gl_FragColor = vec4(col * uIntensity, clamp(a, 0.0, 1.0));
      }
    `})}const Il=8;class tg extends Bn{constructor(e){super(e,"nova"),this.maxInstances=2,this._p=new C,this._q=new C,this._end=new C}_orbMaterial(){return new st({uniforms:{uTime:Ye.uTime,uCameraPos:Ye.uCameraPos,uCore:{value:new te(this.s.windup.coreColor)},uHalo:{value:new te(this.s.windup.haloColor)},uCharge:{value:0},uPulse:{value:9}},transparent:!0,depthWrite:!1,blending:Qt,side:_i,toneMapped:!0,vertexShader:`
        varying vec3 vN;
        varying vec3 vW;
        void main() {
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,fragmentShader:`
        ${St}
        ${wt}
        uniform float uTime;
        uniform vec3 uCameraPos;
        uniform vec3 uCore;
        uniform vec3 uHalo;
        uniform float uCharge;
        uniform float uPulse;
        varying vec3 vN;
        varying vec3 vW;

        void main() {
          vec3 v = normalize(uCameraPos - vW);
          float facing = abs(dot(normalize(vN), v));
          float rim = pow(1.0 - facing, 1.6);
          float churn = es_fbm3(normalize(vN) * 4.0 + vec3(0.0, uTime * 2.2, 0.0), 4, 2.1, 0.55);
          float beat = 0.75 + 0.35 * sin(uTime * uPulse);

          vec3 col = mix(uCore, uHalo, rim);
          col *= (0.5 + 1.4 * churn) * beat;
          col += uCore * pow(facing, 3.0) * 2.2;

          float a = (0.35 + 0.9 * rim + 0.5 * churn) * uCharge;
          if (a < 0.005) discard;
          gl_FragColor = vec4(col * (1.0 + 2.0 * uCharge), clamp(a, 0.0, 1.0));
        }
      `})}createInstance(){const e=this.s.beam,t=_c(e.segments,e.radial),i=(f,u)=>{const m=yc({profile:"beam",intensity:u,opacity:f}),g=new He(t,m);return g.frustumCulled=!1,g.renderOrder=15,g.visible=!1,this.scene.add(g),{mesh:g,u:m.uniforms}},s=i(1,e.intensity),r=i(e.sheathOpacity,e.intensity*.8),a=i(e.outerOpacity,e.intensity*.55),o=ts(96,Il),l=is({path:"helix"}),c=new He(o,l);c.frustumCulled=!1,c.renderOrder=17,c.visible=!1,this.scene.add(c);const d=new He(new $i(1,4),this._orbMaterial());return d.frustumCulled=!1,d.renderOrder=18,d.visible=!1,this.scene.add(d),{geometry:t,core:s,sheath:r,outer:a,ribbons:c,ribbonU:l.userData.uniforms,orb:d,orbU:d.material.uniforms,burn:null,fired:!1}}begin(e){e.fired=!1,e.burn=null,e.orb.visible=!0,e.core.mesh.visible=!1,e.sheath.mesh.visible=!1,e.outer.mesh.visible=!1,e.ribbons.visible=!1,this._end.copy(e.origin).addScaledVector(e.direction,e.distance),this._end.y=Math.max(.35,e.origin.y*.42),e.end=(e.end??new C).copy(this._end),this.lights.spawn(e.origin,{color:this.s.fx.lightColor,intensity:this.s.fx.lightIntensity*.2,life:this.s.windup.time,decay:.2,distance:14})}_fire(e){const t=this.s,i=this.time.sim;e.core.mesh.visible=!0,e.sheath.mesh.visible=!0,e.outer.mesh.visible=!0,e.ribbons.visible=!0;const s=this._q.copy(e.origin).addScaledVector(e.direction,e.distance*.5);s.y=0;const r=e.direction;e.burn=this.decals.spawn("beam",{position:s,rotation:Math.atan2(-r.z,r.x),width:e.distance,length:t.decal.width*2,color:t.decal.color,color2:t.decal.coreColor,opacity:t.decal.opacity,scale:t.decal.noiseScale,progress:0,life:t.decal.fade+t.beam.holdTime,fadeIn:.05,hold:(t.decal.fade+t.beam.holdTime)*.45,seed:e.seed}),this.bursts.spawn(e.origin.clone(),{color:t.beam.colorCore,color2:t.beam.colorSheath,life:.4,from:.3,to:2.6,opacity:.45,thickness:.2,noise:.4,rings:2,intensity:1.6}),this.particles.emit("glow",t.fx.impactSpray,{position:e.end,positionRadius:.5,direction:e.direction.clone().negate(),spread:1.1,speed:[4,t.fx.spraySpeed*2],life:[.35,t.fx.sprayLife*1.5],size:[.06,.2],sizeEnd:.3,colorA:Te(t.beam.colorCore),colorB:Te(t.beam.colorOuter),gravity:-5,drag:1.4,turbulence:.5,tint:.15,birth:i}),this.lights.spawn(e.end.clone().setY(1.2),{color:t.fx.lightColor,intensity:t.fx.lightIntensity,life:t.beam.holdTime+.6,decay:.35,distance:30}),this.ctx.shake(t.fx.shake),this.ctx.flash(t.fx.flash,t.beam.colorSheath)}step(e,t){const i=this.s,s=i.windup,r=i.beam,a=this.time.sim,o=this._p.copy(e.origin);if(e.age<s.time){const p=pt(e.age/s.time);e.orb.visible=!0,e.orb.position.copy(o),e.orb.scale.setScalar(s.radius*(.35+.9*gc(p))),e.orbU.uCharge.value=p,e.orbU.uCore.value.set(s.coreColor),e.orbU.uHalo.value.set(s.haloColor),e.orbU.uPulse.value=s.pulse;const h=4;this.particles.emitRate(`nova-${e.id}-mote`,"glow",s.moteCount*1.6,t,{position:o,positionRadius:s.moteRadius,direction:Ul,spread:0,speed:[0,0],centre:o,radialSpeed:-s.moteRadius*h*.85,life:[.5,.9],size:[s.moteSize*.5,s.moteSize*1.4],sizeEnd:.15,colorA:Te(s.haloColor),colorB:Te(s.coreColor),drag:h,gravity:0,tint:.12,birth:a});return}e.fired||(e.fired=!0,this.particles.dropRate(`nova-${e.id}-mote`),this._fire(e));const l=e.age-s.time;let c=pt(l/Math.max(r.growTime,.001)),d=1,f=1;const u=r.growTime+r.holdTime;if(l>u){const p=pt((l-u)/Math.max(r.collapseTime,.001));d=Math.pow(1-p,2.2)*.92+.02,f=1-p*p}e.orb.visible=l<.25,e.orb.visible&&(e.orb.position.copy(o),e.orb.scale.setScalar(s.radius*(1-l/.25)*1.3),e.orbU.uCharge.value=1-l/.25);const m=(p,h,x,E,M)=>{const b=p.u;b.uStart.value.copy(e.origin),b.uEnd.value.copy(e.end),b.uRadius.value=h*d,b.uHead.value=c,b.uSwell.value=r.swell*(M?.6:1),b.uSwellFreq.value=r.swellFreq,b.uNoiseScale.value=r.noiseScale,b.uFlowSpeed.value=r.flowSpeed,b.uOpacity.value=x*f,b.uIntensity.value=E,b.uColorCore.value.set(r.colorCore),b.uColorMid.value.set(r.colorSheath),b.uColorEdge.value.set(r.colorOuter),b.uDiscCount.value=M?0:i.discs.count,b.uDiscSpeed.value=i.discs.speed,b.uDiscThickness.value=i.discs.thickness*.1,b.uDiscSwell.value=M?0:(i.discs.radius-1)*.35,b.uDiscColor.value.set(i.discs.color),b.uDiscIntensity.value=i.discs.intensity,b.uSeed.value=e.seed,p.mesh.visible=f>.02};m(e.core,r.radiusCore,1,r.intensity*1.15,!0),m(e.sheath,r.radiusSheath,r.sheathOpacity,r.intensity,!1),m(e.outer,r.radiusOuter,r.outerOpacity,r.intensity*.6,!1);const g=i.ribbons,S=e.ribbonU;if(S.uStart.value.copy(e.origin),S.uEnd.value.copy(e.end),S.uHead.value=c,S.uTail.value=0,S.uRadius.value=g.radius*d,S.uTurns.value=g.turns,S.uWidth.value=g.width*d,S.uWidthJitter.value=.3,S.uTaper.value=g.taper,S.uCount.value=g.count,S.uPhase.value=this.time.sim*g.speed,S.uChaos.value=.6,S.uOpacity.value=f,S.uIntensity.value=g.intensity,S.uFlicker.value=.25,S.uFlickerRate.value=6,S.uColorCore.value.set("#fffdf2"),S.uColorMid.value.set(g.color),S.uColorEdge.value.set(g.color),S.uSeed.value=e.seed,e.ribbons.geometry.instanceCount=Math.min(Il,Math.max(1,Math.round(g.count))),e.ribbons.visible=f>.02,e.burn&&(e.burn.uniforms.uProgress.value=c),f>.15){this.particles.emitRate(`nova-${e.id}-spray`,"glow",i.fx.sprayRate,t,{position:e.end,positionRadius:.4,direction:e.direction.clone().negate().setY(.65).normalize(),spread:.85,speed:[2,i.fx.spraySpeed],life:[.3,i.fx.sprayLife],size:[.05,.15],sizeEnd:.3,colorA:Te(r.colorCore),colorB:Te(r.colorOuter),gravity:-4.5,drag:1.5,turbulence:.6,tint:.14,birth:a});const p=ye.next();this._q.copy(e.origin).lerp(e.end,p),this.particles.emitRate(`nova-${e.id}-drip`,"glow",60,t,{position:this._q,positionRadius:r.radiusOuter*1.2,direction:Ul,spread:1.6,speed:[.5,2.5],life:[.3,.7],size:[.03,.09],sizeEnd:.2,colorA:Te(r.colorSheath),colorB:Te(r.colorOuter),gravity:-2,drag:2.2,birth:a})}}end(e){e.orb.visible=!1,e.core.mesh.visible=!1,e.sheath.mesh.visible=!1,e.outer.mesh.visible=!1,e.ribbons.visible=!1,e.burn=null,this.particles.dropRate(`nova-${e.id}-mote`),this.particles.dropRate(`nova-${e.id}-spray`),this.particles.dropRate(`nova-${e.id}-drip`)}}const Ul=new C(0,1,0),Fl=14,Nl=8;class ig extends Bn{constructor(e){super(e,"snare"),this.maxInstances=2,this._p=new C,this._q=new C}createInstance(){const e=this.s,t=ts(e.leash.segments,3),i=is({path:"bolt"}),s=new He(t,i);s.frustumCulled=!1,s.renderOrder=16,s.visible=!1,this.scene.add(s);const r=_c(e.column.segments,e.column.radial),a=yc({profile:"column",intensity:e.column.intensity}),o=new He(r,a);o.frustumCulled=!1,o.renderOrder=15,o.visible=!1,this.scene.add(o);const l=ts(e.tendrils.segments,Fl),c=is({path:"crawl"}),d=new He(l,c);d.frustumCulled=!1,d.renderOrder=16,d.visible=!1,this.scene.add(d);const f=ts(48,Nl),u=is({path:"rim"}),m=new He(f,u);return m.frustumCulled=!1,m.renderOrder=16,m.visible=!1,this.scene.add(m),{leash:s,leashU:i.userData.uniforms,column:o,columnU:a.uniforms,tendrils:d,tendrilU:c.userData.uniforms,arcs:m,arcU:u.userData.uniforms,disc:null,landed:!1}}begin(e){const t=this.s;e.landed=!1,e.disc=null,e.leash.visible=!0,e.column.visible=!1,e.tendrils.visible=!1,e.arcs.visible=!1,e.travel=Math.max(e.distance/Math.max(t.leash.speed,1),.05);const i=e.leashU;i.uStart.value.copy(e.origin),i.uEnd.value.copy(e.point).setY(.08),i.uSeed.value=e.seed,i.uCount.value=3,this.lights.spawn(e.origin,{color:t.fx.lightColor,intensity:t.fx.lightIntensity*.4,life:.3,distance:12,flicker:18})}_land(e){const t=this.s,i=this.time.sim,s=this._q.copy(e.point).setY(0),r=t.radius;e.column.visible=!0,e.tendrils.visible=!0,e.arcs.visible=!0,e.disc=this.decals.spawn("snare",{position:s,size:r*2.6,color:t.disc.color,color2:t.disc.rimColor,opacity:t.disc.opacity,scale:t.disc.noiseScale,churn:t.disc.churn,width2:t.snap.rimWidth/(r*1.3),progress:0,life:t.duration-e.travel,fadeIn:.06,hold:(t.duration-e.travel)*.6,seed:e.seed}),this.bursts.spawn(s.clone().setY(.5),{color:t.disc.rimColor,color2:t.column.colorMid,life:.45,from:.4,to:r*1.25,opacity:.35,thickness:.18,noise:.5,rings:3,intensity:1.4}),this.particles.emit("spark",180,{position:s,positionRadius:r*.6,direction:Gr,spread:1.5,speed:[3,t.fx.sparkSpeed*2],life:[.3,.8],size:[.06,.16],sizeEnd:.25,colorA:Te(t.disc.rimColor),colorB:Te(t.column.colorMid),gravity:-9,drag:1.3,turbulence:.6,tint:.18,birth:i}),this.lights.spawn(s.clone().setY(1.6),{color:t.fx.lightColor,intensity:t.fx.lightIntensity,life:t.duration-e.travel,decay:.3,distance:26,flicker:9}),this.ctx.shake(t.fx.shake),this.ctx.flash(t.fx.flash,t.column.colorMid)}step(e,t){const i=this.s,s=this.time.sim,r=this._q.copy(e.point).setY(0),a=pt(e.age/e.travel),o=e.leashU;if(o.uStart.value.copy(e.origin),o.uEnd.value.copy(r).setY(.1),o.uHead.value=a,o.uTail.value=e.landed?pt((e.age-e.travel)/.22):0,o.uWidth.value=i.leash.width,o.uChaos.value=i.leash.chaos,o.uChaosSpeed.value=i.leash.chaosSpeed,o.uChaosScale.value=1.4,o.uTaper.value=.5,o.uSag.value=.35,o.uSpiral.value=.6,o.uSpiralRadius.value=i.leash.width*2.2,o.uIntensity.value=i.leash.intensity,o.uColorCore.value.set("#ffffff"),o.uColorMid.value.set(i.leash.color),o.uColorEdge.value.set(i.column.colorEdge),e.leash.visible=o.uTail.value<1,!e.landed&&a>=1&&(e.landed=!0,this._land(e)),!e.landed)return;const l=e.age-e.travel;let c=i.radius;if(l<i.snap.snapTime)c*=1+(i.snap.overshoot-1)*Math.sin(l/i.snap.snapTime*Math.PI);else if(l<i.snap.snapTime+i.snap.settleTime){const b=(l-i.snap.snapTime)/i.snap.settleTime;c*=1+(i.snap.overshoot-1)*.18*(1-vc(b,1.1))}const d=i.duration-e.travel-.85;let f=1,u=0;l>d&&(u=pt((l-d)/.85),f=1-u*u);const m=Math.pow(1-u,1.8)*.94+.02;e.disc&&(e.disc.uniforms.uProgress.value=c/(i.radius*1.3)*1,e.disc.uniforms.uWidth.value=i.snap.rimWidth/(i.radius*1.3),e.disc.uniforms.uChurn.value=i.disc.churn,e.disc.uniforms.uColor.value.set(i.disc.color),e.disc.uniforms.uColor2.value.set(i.disc.rimColor));const g=i.column,S=e.columnU,p=pt(l/.22);S.uStart.value.copy(r).setY(.02),S.uEnd.value.set(r.x,g.height*p*m+.05,r.z),S.uRadius.value=g.radius*m,S.uHead.value=1,S.uFlare.value=g.flare,S.uNoiseScale.value=g.noiseScale,S.uFlowSpeed.value=g.flowSpeed,S.uSwell.value=.18,S.uSwellFreq.value=2.4,S.uOpacity.value=g.opacity*f,S.uIntensity.value=g.intensity,S.uColorCore.value.set(g.colorCore),S.uColorMid.value.set(g.colorMid),S.uColorEdge.value.set(g.colorEdge),S.uDiscCount.value=4,S.uDiscSpeed.value=-6,S.uDiscThickness.value=.02,S.uDiscSwell.value=.22,S.uDiscColor.value.set(g.colorCore),S.uDiscIntensity.value=1.2,S.uSeed.value=e.seed,e.column.visible=f>.02;const h=i.tendrils,x=e.tendrilU;x.uCentre.value.copy(r),x.uRadius.value=c,x.uHead.value=pt(l/Math.max(h.crawlTime,.001)),x.uTail.value=0,x.uWidth.value=h.width*m,x.uWander.value=h.wander,x.uLift.value=.16,x.uCount.value=h.count,x.uTaper.value=.35,x.uPhase.value=e.seed,x.uOpacity.value=f,x.uIntensity.value=h.intensity,x.uFlicker.value=.5,x.uFlickerRate.value=h.restrike,x.uColorCore.value.set("#ffffff"),x.uColorMid.value.set(h.color),x.uColorEdge.value.set(g.colorEdge),x.uSeed.value=e.seed,e.tendrils.geometry.instanceCount=Math.min(Fl,Math.max(1,Math.round(h.count))),e.tendrils.visible=f>.02;const E=i.arcs,M=e.arcU;if(M.uCentre.value.copy(r),M.uRadius.value=c,M.uHead.value=1,M.uTail.value=0,M.uWidth.value=E.width*m,M.uLift.value=E.lift,M.uArc.value=1.5,M.uPhase.value=this.time.sim*E.speed+e.seed,M.uCount.value=E.count,M.uTaper.value=.6,M.uOpacity.value=f,M.uIntensity.value=E.intensity,M.uFlicker.value=.45,M.uFlickerRate.value=12,M.uColorCore.value.set("#ffffff"),M.uColorMid.value.set(E.color),M.uColorEdge.value.set(g.colorMid),M.uSeed.value=e.seed,e.arcs.geometry.instanceCount=Math.min(Nl,Math.max(1,Math.round(E.count))),e.arcs.visible=f>.02,f>.1){const b=ye.next()*Math.PI*2;this._p.set(r.x+Math.cos(b)*c,.05,r.z+Math.sin(b)*c),this.particles.emitRate(`snare-${e.id}-rim`,"spark",i.fx.sparkRate,t,{position:this._p,positionRadius:.18,direction:Gr,spread:1.9,speed:[1,i.fx.sparkSpeed],life:[.2,.55],size:[.05,.12],sizeEnd:.25,colorA:Te(i.disc.rimColor),colorB:Te(g.colorMid),gravity:-8,drag:1.6,turbulence:.5,tint:.16,birth:s}),this.particles.emitRate(`snare-${e.id}-haul`,"glow",i.fx.haulRate,t,{position:r,positionRadius:c*.9,direction:Gr,spread:.35,speed:[i.fx.haulSpeed*.4,i.fx.haulSpeed],life:[.5,1.1],size:[.05,.14],sizeEnd:.4,colorA:Te(g.colorCore),colorB:Te(g.colorEdge),gravity:3.5,drag:1.1,turbulence:.45,tint:.14,birth:s})}}end(e){e.leash.visible=!1,e.column.visible=!1,e.tendrils.visible=!1,e.arcs.visible=!1,e.disc=null,this.particles.dropRate(`snare-${e.id}-rim`),this.particles.dropRate(`snare-${e.id}-haul`)}}const Gr=new C(0,1,0);class ng extends Bn{constructor(e){super(e,"glacier"),this.maxInstances=2,this.field=new Mc(this.scene,{capacity:160,variant:"shard",params:this.s.ice,timing:this.s.crown,seed:71}),this._p=new C,this._q=new C}createInstance(){return{shockDecal:null,shocked:!1}}begin(e){const t=this.s,i=t.crown,s=this.time.sim,r=this._q.copy(e.point).setY(0),a=t.radius;for(let l=0;l<i.rings;l++){const c=i.rings>1?l/(i.rings-1):0,d=a*zt(1,i.innerScale,c),f=Math.max(3,Math.round(i.shards*zt(1,.62,c))),u=c*i.riseStagger;for(let m=0;m<f;m++){const g=m/f*Ht+i.twist*c+ye.spread(.08),S=d*(1+ye.spread(.06));this._p.set(r.x+Math.cos(g)*S,0,r.z+Math.sin(g)*S),this.field.plant(this._p,{scale:i.thickness*(1+ye.spread(.28)),height:i.height/i.thickness*(1+ye.spread(i.heightJitter)),yaw:-g+Math.PI/2,tilt:i.lean*(c<.5?1:-.7)*(.7+ye.next()*.6),tiltDir:g,birth:s,delay:u+ye.range(0,.12)})}}i.rings>0&&t.spire.enabled&&this.field.plant(r,{scale:t.spire.radius,height:t.spire.height/t.spire.radius,yaw:ye.next()*Ht,tilt:.05,tiltDir:ye.next()*Ht,birth:s,delay:i.riseStagger*1.4}),this.decals.spawn("frost",{position:r,size:a*2.5,color:t.decal.color,color2:t.ice.colorMid,opacity:t.decal.opacity,scale:t.decal.rimeScale,progress:1,life:t.decal.fade,fadeIn:t.decal.growTime,hold:t.decal.fade*.5,seed:e.seed}),e.shockDecal=this.decals.spawn("shock",{position:r,size:a*3.4,color:t.shock.color,color2:"#ffffff",opacity:t.shock.intensity*.6,scale:3,width2:t.shock.width/(a*1.7),progress:0,life:.85,fadeIn:.05,seed:e.seed+2}),e.shocked=!0;const o=t.fx;this.particles.emit("smoke",o.mistCount,{position:r,positionRadius:a*.9,direction:Os,spread:1.5,speed:[1,4],life:[1.1,2.4],size:[o.mistSize*.5,o.mistSize*1.2],sizeEnd:1.7,colorA:Te(t.decal.color),colorB:Te(t.ice.colorDeep),gravity:.45,drag:1.5,turbulence:.5,spin:.6,tint:.12,birth:s}),this.particles.emit("chip",o.chipCount,{position:r,positionRadius:a*.85,direction:Os,spread:1,speed:[3,o.chipSpeed],life:[.9,1.7],size:[.07,.24],sizeEnd:.75,colorA:Te(t.ice.colorEdge),colorB:Te(t.ice.colorMid),gravity:-16,drag:.32,spin:9,tint:.14,birth:s}),this.particles.emit("glow",o.glitterCount,{position:r,positionRadius:a,direction:Os,spread:1.4,speed:[1.5,7],life:[.5,1.3],size:[.04,.13],sizeEnd:.12,colorA:Te(t.ice.colorEdge),colorB:Te(t.decal.color),gravity:-3,drag:1.2,turbulence:.45,birth:s}),this.bursts.spawn(r.clone().setY(.6),{color:t.decal.color,color2:t.ice.colorDeep,life:.5,from:.5,to:a*1.15,opacity:.22,thickness:.16,noise:.55,rings:4,intensity:1.4}),this.lights.spawn(r.clone().setY(2.2),{color:o.lightColor,intensity:o.lightIntensity,life:1.2,decay:.55,distance:28}),this.ctx.shake(o.shake),this.ctx.flash(o.flash,t.decal.color)}step(e,t){const i=this.s;if(e.shockDecal){const r=Math.min(1,e.age*i.shock.speed/(i.radius*1.7));e.shockDecal.uniforms.uProgress.value=r,r>=1&&(e.shockDecal=null)}e.age<i.crown.riseTime+i.crown.holdTime?(this._p.copy(e.point).setY(.2),this.particles.emitRate(`glacier-${e.id}-vapour`,"smoke",34,t,{position:this._p,positionRadius:i.radius,direction:Os,spread:1.2,speed:[.2,1.1],life:[1.2,2.4],size:[.7,1.6],sizeEnd:2.2,colorA:Te(i.decal.color),colorB:Te(i.ice.colorDeep),gravity:.28,drag:1.7,turbulence:.4,spin:.4,tint:.1,birth:this.time.sim})):this.particles.dropRate(`glacier-${e.id}-vapour`)}end(e){e.shockDecal=null,this.particles.dropRate(`glacier-${e.id}-vapour`)}sync(){this.field.sync(this.s.ice,this.s.crown)}clear(){super.clear(),this.field.clear()}}const Os=new C(0,1,0);class sg extends xc{constructor(e){super(),this.ctx=e,this.settings=e.settings,this.abilities={frost:new W0(e),storm:new $0(e),cinder:new Q0(e),nova:new tg(e),snare:new ig(e),glacier:new ng(e)},this.order=mc,this.armedKey=null,this.cooldowns=Object.fromEntries(this.order.map(t=>[t,0])),this._origin=new C,this._shot={origin:new C,direction:new C,point:new C,distance:0}}get armed(){return this.armedKey?this.settings.abilities[this.armedKey]:null}keyFor(e){const t={KeyQ:"frost",KeyE:"storm",KeyR:"cinder",KeyF:"nova",KeyV:"snare",KeyC:"glacier"};if(t[e])return t[e];const i=/^Digit([1-6])$/.exec(e);return i?this.order[Number(i[1])-1]:null}arm(e){!e||!this.abilities[e]||(this.armedKey=this.armedKey===e?null:e,this.emit("armed",this.armedKey))}cancel(){this.armedKey&&(this.armedKey=null,this.emit("armed",null))}ready(e){return(this.cooldowns[e]??0)<=0}tryCast(e){const t=this.armedKey;if(!t||!this.ready(t)||!e.valid)return!1;const i=this.abilities[t],s=this.settings.abilities[t],r=this.ctx.caster;return r.face(e.direction),r.playCast(1),r.root.rotation.y=r.facing,r.root.updateMatrixWorld(!0),r.getCastOrigin(e.direction,this._shot.origin),this._shot.direction.copy(e.direction),this._shot.point.copy(e.point),this._shot.distance=s.aimMode==="zone"?Math.max(e.distance,.001):s.range,s.aimMode!=="zone"&&(this._shot.point.copy(this._shot.origin).addScaledVector(this._shot.direction,s.range).setY(0),this._shot.distance=s.range),i.cast(this._shot),this.cooldowns[t]=s.cooldown,this.emit("cast",t),this.armedKey=null,this.emit("armed",null),!0}update(e,t){for(const i of this.order)this.cooldowns[i]>0&&(this.cooldowns[i]=Math.max(0,this.cooldowns[i]-t)),this.abilities[i].update(e)}sync(){for(const e of this.order)this.abilities[e].sync()}clear(){for(const e of this.order)this.abilities[e].clear()}}const Ws={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`};class zn{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}const rg=new er(-1,1,1,-1,0,1);class ag extends Tt{constructor(){super(),this.setAttribute("position",new mt([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new mt([0,2,0,0,2,0],2))}}const og=new ag;class mo{constructor(e){this._mesh=new He(og,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,rg)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}}class bc extends zn{constructor(e,t="tDiffuse"){super(),this.textureID=t,this.uniforms=null,this.material=null,e instanceof st?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=as.clone(e.uniforms),this.material=new st({name:e.name!==void 0?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this._fsQuad=new mo(this.material)}render(e,t,i){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=i.texture),this._fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}}class Ol extends zn{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,i){const s=e.getContext(),r=e.state;r.buffers.color.setMask(!1),r.buffers.depth.setMask(!1),r.buffers.color.setLocked(!0),r.buffers.depth.setLocked(!0);let a,o;this.inverse?(a=0,o=1):(a=1,o=0),r.buffers.stencil.setTest(!0),r.buffers.stencil.setOp(s.REPLACE,s.REPLACE,s.REPLACE),r.buffers.stencil.setFunc(s.ALWAYS,a,4294967295),r.buffers.stencil.setClear(o),r.buffers.stencil.setLocked(!0),e.setRenderTarget(i),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),r.buffers.color.setLocked(!1),r.buffers.depth.setLocked(!1),r.buffers.color.setMask(!0),r.buffers.depth.setMask(!0),r.buffers.stencil.setLocked(!1),r.buffers.stencil.setFunc(s.EQUAL,1,4294967295),r.buffers.stencil.setOp(s.KEEP,s.KEEP,s.KEEP),r.buffers.stencil.setLocked(!0)}}class lg extends zn{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}}class cg{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){const i=e.getSize(new Re);this._width=i.width,this._height=i.height,t=new Wt(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:Jt}),t.texture.name="EffectComposer.rt1"}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new bc(Ws),this.copyPass.material.blending=mi,this.timer=new ju}swapBuffers(){const e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){const t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){this.timer.update(),e===void 0&&(e=this.timer.getDelta());const t=this.renderer.getRenderTarget();let i=!1;for(let s=0,r=this.passes.length;s<r;s++){const a=this.passes[s];if(a.enabled!==!1){if(a.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(s),a.render(this.renderer,this.writeBuffer,this.readBuffer,e,i),a.needsSwap){if(i){const o=this.renderer.getContext(),l=this.renderer.state.buffers.stencil;l.setFunc(o.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),l.setFunc(o.EQUAL,1,4294967295)}this.swapBuffers()}Ol!==void 0&&(a instanceof Ol?i=!0:a instanceof lg&&(i=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){const t=this.renderer.getSize(new Re);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;const i=this._width*this._pixelRatio,s=this._height*this._pixelRatio;this.renderTarget1.setSize(i,s),this.renderTarget2.setSize(i,s);for(let r=0;r<this.passes.length;r++)this.passes[r].setSize(i,s)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}class ug extends zn{constructor(e,t,i=null,s=null,r=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=i,this.clearColor=s,this.clearAlpha=r,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new te}render(e,t,i){const s=e.autoClear;e.autoClear=!1;let r,a;this.overrideMaterial!==null&&(a=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(r=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:i),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(r),this.overrideMaterial!==null&&(this.scene.overrideMaterial=a),e.autoClear=s}}const hg={uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new te(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`};class Fn extends zn{constructor(e,t=1,i,s){super(),this.strength=t,this.radius=i,this.threshold=s,this.resolution=e!==void 0?new Re(e.x,e.y):new Re(256,256),this.clearColor=new te(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let r=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);this.renderTargetBright=new Wt(r,a,{type:Jt}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let d=0;d<this.nMips;d++){const f=new Wt(r,a,{type:Jt});f.texture.name="UnrealBloomPass.h"+d,f.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(f);const u=new Wt(r,a,{type:Jt});u.texture.name="UnrealBloomPass.v"+d,u.texture.generateMipmaps=!1,this.renderTargetsVertical.push(u),r=Math.round(r/2),a=Math.round(a/2)}const o=hg;this.highPassUniforms=as.clone(o.uniforms),this.highPassUniforms.luminosityThreshold.value=s,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new st({uniforms:this.highPassUniforms,vertexShader:o.vertexShader,fragmentShader:o.fragmentShader}),this.separableBlurMaterials=[];const l=[6,10,14,18,22];r=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);for(let d=0;d<this.nMips;d++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(l[d])),this.separableBlurMaterials[d].uniforms.invSize.value=new Re(1/r,1/a),r=Math.round(r/2),a=Math.round(a/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=.1;const c=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=c,this.bloomTintColors=[new C(1,1,1),new C(1,1,1),new C(1,1,1),new C(1,1,1),new C(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=as.clone(Ws.uniforms),this.blendMaterial=new st({uniforms:this.copyUniforms,vertexShader:Ws.vertexShader,fragmentShader:Ws.fragmentShader,premultipliedAlpha:!0,blending:Qt,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new te,this._oldClearAlpha=1,this._basic=new Qs,this._fsQuad=new mo(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,t){let i=Math.round(e/2),s=Math.round(t/2);this.renderTargetBright.setSize(i,s);for(let r=0;r<this.nMips;r++)this.renderTargetsHorizontal[r].setSize(i,s),this.renderTargetsVertical[r].setSize(i,s),this.separableBlurMaterials[r].uniforms.invSize.value=new Re(1/i,1/s),i=Math.round(i/2),s=Math.round(s/2)}render(e,t,i,s,r){e.getClearColor(this._oldClearColor),this._oldClearAlpha=e.getClearAlpha();const a=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0),r&&e.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=i.texture,e.setRenderTarget(null),e.clear(),this._fsQuad.render(e)),this.highPassUniforms.tDiffuse.value=i.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this._fsQuad.render(e);let o=this.renderTargetBright;for(let l=0;l<this.nMips;l++)this._fsQuad.material=this.separableBlurMaterials[l],this.separableBlurMaterials[l].uniforms.colorTexture.value=o.texture,this.separableBlurMaterials[l].uniforms.direction.value=Fn.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[l]),e.clear(),this._fsQuad.render(e),this.separableBlurMaterials[l].uniforms.colorTexture.value=this.renderTargetsHorizontal[l].texture,this.separableBlurMaterials[l].uniforms.direction.value=Fn.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[l]),e.clear(),this._fsQuad.render(e),o=this.renderTargetsVertical[l];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this._fsQuad.render(e),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,r&&e.state.buffers.stencil.setTest(!0),this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(i),this._fsQuad.render(e)),e.setClearColor(this._oldClearColor,this._oldClearAlpha),e.autoClear=a}_getSeparableBlurMaterial(e){const t=[],i=e/3;for(let s=0;s<e;s++)t.push(.39894*Math.exp(-.5*s*s/(i*i))/i);return new st({defines:{KERNEL_RADIUS:e},uniforms:{colorTexture:{value:null},invSize:{value:new Re(.5,.5)},direction:{value:new Re(.5,.5)},gaussianCoefficients:{value:t}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				#include <common>

				varying vec2 vUv;

				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {

					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;

					for ( int i = 1; i < KERNEL_RADIUS; i ++ ) {

						float x = float( i );
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += ( sample1 + sample2 ) * w;

					}

					gl_FragColor = vec4( diffuseSum, 1.0 );

				}`})}_getCompositeMaterial(e){return new st({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				varying vec2 vUv;

				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor( const in float factor ) {

					float mirrorFactor = 1.2 - factor;
					return mix( factor, mirrorFactor, bloomRadius );

				}

				void main() {

					// 3.0 for backwards compatibility with previous alpha-based intensity
					vec3 bloom = 3.0 * bloomStrength * (
						lerpBloomFactor( bloomFactors[ 0 ] ) * bloomTintColors[ 0 ] * texture2D( blurTexture1, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 1 ] ) * bloomTintColors[ 1 ] * texture2D( blurTexture2, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 2 ] ) * bloomTintColors[ 2 ] * texture2D( blurTexture3, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 3 ] ) * bloomTintColors[ 3 ] * texture2D( blurTexture4, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 4 ] ) * bloomTintColors[ 4 ] * texture2D( blurTexture5, vUv ).rgb
					);

					float bloomAlpha = max( bloom.r, max( bloom.g, bloom.b ) );
					gl_FragColor = vec4( bloom, bloomAlpha );

				}`})}}Fn.BlurDirectionX=new Re(1,0);Fn.BlurDirectionY=new Re(0,1);const Bs={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`};class dg extends zn{constructor(){super(),this.isOutputPass=!0,this.uniforms=as.clone(Bs.uniforms),this.material=new nc({name:Bs.name,uniforms:this.uniforms,vertexShader:Bs.vertexShader,fragmentShader:Bs.fragmentShader}),this._fsQuad=new mo(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,i){this.uniforms.tDiffuse.value=i.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},Ve.getTransfer(this._outputColorSpace)===Ze&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===Ha?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===Wa?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===Xa?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===Zs?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===qa?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===Ya?this.material.defines.NEUTRAL_TONE_MAPPING="":this._toneMapping===$a&&(this.material.defines.CUSTOM_TONE_MAPPING=""),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}}const fg={name:"GradeShader",uniforms:{tDiffuse:{value:null},uTime:{value:0},uContrast:{value:1.06},uSaturation:{value:1.12},uLift:{value:-.006},uVignette:{value:.42},uChromatic:{value:.0016},uGrain:{value:.028},uDistortion:{value:0},uResolution:{value:new Re(1,1)}},vertexShader:`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uContrast;
    uniform float uSaturation;
    uniform float uLift;
    uniform float uVignette;
    uniform float uChromatic;
    uniform float uGrain;
    uniform float uDistortion;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      vec2 uv = vUv;
      vec2 centred = uv - 0.5;
      float r2 = dot(centred, centred);

      /* Barrel distortion — driven up by a heavy cast, zero at rest. */
      if (uDistortion != 0.0) {
        uv = 0.5 + centred * (1.0 + uDistortion * r2);
      }

      /* Lateral chromatic aberration, scaled by distance from the centre. */
      vec2 dir = centred * uChromatic * (0.4 + r2 * 2.0);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir).b;

      /* Contrast around 0.5, then saturation around luma. */
      col = (col - 0.5) * uContrast + 0.5 + uLift;
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(luma), col, uSaturation);

      /* Vignette. */
      col *= 1.0 - uVignette * smoothstep(0.18, 0.85, r2 * 1.9);

      /* Grain, animated so it never reads as a texture. */
      float g = hash12(gl_FragCoord.xy + fract(uTime) * 941.0) - 0.5;
      col += g * uGrain;

      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `};class pg{constructor(e,t,i,s){this.renderer=e,this.scene=t,this.camera=i,this.settings=s;const r=e.getSize(new Re);this.composer=new cg(e),this.composer.setPixelRatio(e.getPixelRatio()),this.composer.setSize(r.x,r.y),this.renderPass=new ug(t,i),this.composer.addPass(this.renderPass),this.bloom=new Fn(new Re(r.x,r.y),s.post.bloomStrength,s.post.bloomRadius,s.post.bloomThreshold),this.composer.addPass(this.bloom),this.grade=new bc(fg),this.composer.addPass(this.grade),this.output=new dg,this.composer.addPass(this.output),this.distortion=0}punch(e){this.distortion=Math.min(.35,this.distortion+e)}resize(e,t){this.composer.setPixelRatio(this.renderer.getPixelRatio()),this.composer.setSize(e,t),this.bloom.setSize(e,t),this.grade.uniforms.uResolution.value.set(e,t)}render(e,t){const i=this.settings.post;this.bloom.strength=i.bloomStrength,this.bloom.radius=i.bloomRadius,this.bloom.threshold=i.bloomThreshold,this.distortion=Wi(this.distortion,0,4.5,e);const s=this.grade.uniforms;s.uTime.value=t,s.uContrast.value=i.grade?i.contrast:1,s.uSaturation.value=i.grade?i.saturation:1,s.uLift.value=i.grade?i.lift:0,s.uVignette.value=i.grade?i.vignette:0,s.uChromatic.value=i.grade?i.chromatic:0,s.uGrain.value=i.grade?i.grain:0,s.uDistortion.value=i.distortionAmount+this.distortion,i.enabled?this.composer.render(e):this.renderer.render(this.scene,this.camera)}}const Tn=(n,e)=>`<svg class="slot__glyph" viewBox="0 0 32 32" fill="none" stroke="${e}"
        stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">${n}</svg>`,mg={frost:n=>Tn(`<path d="M3 26 L29 26" opacity=".35"/>
       <path d="M7 26 L9 18 L11 26"/>
       <path d="M13 26 L16 12 L19 26"/>
       <path d="M21 26 L25 6 L28 26"/>
       <path d="M4 26 L5.5 22 L7 26" opacity=".7"/>`,n),storm:n=>Tn(`<path d="M4 27 L13 15 L9 14 L20 4"/>
       <path d="M20 4 L17 13 L22 12 L14 24" opacity=".8"/>
       <path d="M24 20 L28 18 M25 25 L29 24" opacity=".55"/>`,n),cinder:n=>Tn(`<path d="M3 25 C 8 6, 20 6, 26 20" opacity=".5" stroke-dasharray="2 2.5"/>
       <circle cx="24" cy="15" r="4"/>
       <path d="M22 13 L25 16 M24 12 L26 14" opacity=".8"/>
       <path d="M17 28 L27 28" opacity=".45"/>`,n),nova:n=>Tn(`<circle cx="6" cy="16" r="3.2"/>
       <path d="M9 13.5 L29 11 M9 18.5 L29 21"/>
       <path d="M15 12.4 L15 19.6 M21 11.6 L21 20.4" opacity=".7"/>
       <path d="M27 10.8 L27 21.2" opacity=".5"/>`,n),snare:n=>Tn(`<ellipse cx="16" cy="22" rx="12" ry="5"/>
       <path d="M16 22 L16 5"/>
       <path d="M12 22 C 12 14, 20 14, 20 22" opacity=".7"/>
       <path d="M5 21 L2 24 M27 21 L30 24" opacity=".55"/>`,n),glacier:n=>Tn(`<ellipse cx="16" cy="25" rx="12" ry="4" opacity=".4"/>
       <path d="M6 25 L8 17 L10 25"/>
       <path d="M11 26 L13.5 14 L16 26" opacity=".85"/>
       <path d="M16 26 L20 3 L24 26"/>
       <path d="M24 25 L26 16 L28 25" opacity=".7"/>`,n)},Hr={frost:"var(--frost)",storm:"var(--storm)",cinder:"var(--cinder)",nova:"var(--nova)",snare:"var(--snare)",glacier:"var(--glacier)"};class gg{constructor(e,t){this.manager=e,this.settings=t,this.root=document.getElementById("hud"),this.bar=document.getElementById("hud-slots"),this.help=document.getElementById("help"),this.flash=document.getElementById("flash"),this.slots=new Map;for(const i of e.order){const s=t.abilities[i],r=document.createElement("div");r.className="slot",r.style.setProperty("--accent",Hr[i]),r.innerHTML=`
        <span class="slot__key">${s.key}</span>
        ${mg[i](Hr[i])}
        <span class="slot__name">${s.label}</span>
        <span class="slot__cd"></span>
      `,r.addEventListener("click",()=>e.arm(i)),this.bar.appendChild(r),this.slots.set(i,{el:r,cd:r.querySelector(".slot__cd")})}this.root.hidden=!1,this.help.hidden=!1,this._flashTimer=0,this._flashPeak=0}punch(e,t="#ffffff"){e<=0||(this._flashPeak=Math.min(.85,this._flashPeak+e),this._flashTimer=.34,this.flash.style.background=`radial-gradient(ellipse at 50% 55%, ${t} 0%, transparent 72%)`)}toggleHelp(){this.help.hidden=!this.help.hidden}update(e){const t=this.manager;for(const i of t.order){const s=this.slots.get(i),r=this.settings.abilities[i],a=t.cooldowns[i]??0,o=r.cooldown>0?a/r.cooldown:0;s.cd.style.transform=`scaleY(${o})`,s.el.classList.toggle("slot--armed",t.armedKey===i),s.el.style.borderColor=t.armedKey===i?Hr[i]:"var(--edge)"}if(this._flashTimer>0){this._flashTimer-=e;const i=Math.max(this._flashTimer,0)/.34;this.flash.style.opacity=String(this._flashPeak*i*i),this._flashTimer<=0&&(this._flashPeak=0)}else this.flash.style.opacity!=="0"&&(this.flash.style.opacity="0")}}class vi{constructor(e,t,i,s,r="div"){this.parent=e,this.object=t,this.property=i,this._disabled=!1,this._hidden=!1,this.initialValue=this.getValue(),this.domElement=document.createElement(r),this.domElement.classList.add("lil-controller"),this.domElement.classList.add(s),this.$name=document.createElement("div"),this.$name.classList.add("lil-name"),vi.nextNameID=vi.nextNameID||0,this.$name.id=`lil-gui-name-${++vi.nextNameID}`,this.$widget=document.createElement("div"),this.$widget.classList.add("lil-widget"),this.$disable=this.$widget,this.domElement.appendChild(this.$name),this.domElement.appendChild(this.$widget),this.domElement.addEventListener("keydown",a=>a.stopPropagation()),this.domElement.addEventListener("keyup",a=>a.stopPropagation()),this.parent.children.push(this),this.parent.controllers.push(this),this.parent.$children.appendChild(this.domElement),this._listenCallback=this._listenCallback.bind(this),this.name(i)}name(e){return this._name=e,this.$name.textContent=e,this}onChange(e){return this._onChange=e,this}_callOnChange(){this.parent._callOnChange(this),this._onChange!==void 0&&this._onChange.call(this,this.getValue()),this._changed=!0}onFinishChange(e){return this._onFinishChange=e,this}_callOnFinishChange(){this._changed&&(this.parent._callOnFinishChange(this),this._onFinishChange!==void 0&&this._onFinishChange.call(this,this.getValue())),this._changed=!1}reset(){return this.setValue(this.initialValue),this._callOnFinishChange(),this}enable(e=!0){return this.disable(!e)}disable(e=!0){return e===this._disabled?this:(this._disabled=e,this.domElement.classList.toggle("lil-disabled",e),this.$disable.toggleAttribute("disabled",e),this)}show(e=!0){return this._hidden=!e,this.domElement.style.display=this._hidden?"none":"",this}hide(){return this.show(!1)}options(e){const t=this.parent.add(this.object,this.property,e);return t.name(this._name),this.destroy(),t}min(e){return this}max(e){return this}step(e){return this}decimals(e){return this}listen(e=!0){return this._listening=e,this._listenCallbackID!==void 0&&(cancelAnimationFrame(this._listenCallbackID),this._listenCallbackID=void 0),this._listening&&this._listenCallback(),this}_listenCallback(){this._listenCallbackID=requestAnimationFrame(this._listenCallback);const e=this.save();e!==this._listenPrevValue&&this.updateDisplay(),this._listenPrevValue=e}getValue(){return this.object[this.property]}setValue(e){return this.getValue()!==e&&(this.object[this.property]=e,this._callOnChange(),this.updateDisplay()),this}updateDisplay(){return this}load(e){return this.setValue(e),this._callOnFinishChange(),this}save(){return this.getValue()}destroy(){this.listen(!1),this.parent.children.splice(this.parent.children.indexOf(this),1),this.parent.controllers.splice(this.parent.controllers.indexOf(this),1),this.parent.$children.removeChild(this.domElement)}}class vg extends vi{constructor(e,t,i){super(e,t,i,"lil-boolean","label"),this.$input=document.createElement("input"),this.$input.setAttribute("type","checkbox"),this.$input.setAttribute("aria-labelledby",this.$name.id),this.$widget.appendChild(this.$input),this.$input.addEventListener("change",()=>{this.setValue(this.$input.checked),this._callOnFinishChange()}),this.$disable=this.$input,this.updateDisplay()}updateDisplay(){return this.$input.checked=this.getValue(),this}}function Va(n){let e,t;return(e=n.match(/(#|0x)?([a-f0-9]{6})/i))?t=e[2]:(e=n.match(/rgb\(\s*(\d*)\s*,\s*(\d*)\s*,\s*(\d*)\s*\)/))?t=parseInt(e[1]).toString(16).padStart(2,0)+parseInt(e[2]).toString(16).padStart(2,0)+parseInt(e[3]).toString(16).padStart(2,0):(e=n.match(/^#?([a-f0-9])([a-f0-9])([a-f0-9])$/i))&&(t=e[1]+e[1]+e[2]+e[2]+e[3]+e[3]),t?"#"+t:!1}const _g={isPrimitive:!0,match:n=>typeof n=="string",fromHexString:Va,toHexString:Va},os={isPrimitive:!0,match:n=>typeof n=="number",fromHexString:n=>parseInt(n.substring(1),16),toHexString:n=>"#"+n.toString(16).padStart(6,0)},xg={isPrimitive:!1,match:n=>Array.isArray(n)||ArrayBuffer.isView(n),fromHexString(n,e,t=1){const i=os.fromHexString(n);e[0]=(i>>16&255)/255*t,e[1]=(i>>8&255)/255*t,e[2]=(i&255)/255*t},toHexString([n,e,t],i=1){i=255/i;const s=n*i<<16^e*i<<8^t*i<<0;return os.toHexString(s)}},Sg={isPrimitive:!1,match:n=>Object(n)===n,fromHexString(n,e,t=1){const i=os.fromHexString(n);e.r=(i>>16&255)/255*t,e.g=(i>>8&255)/255*t,e.b=(i&255)/255*t},toHexString({r:n,g:e,b:t},i=1){i=255/i;const s=n*i<<16^e*i<<8^t*i<<0;return os.toHexString(s)}},Mg=[_g,os,xg,Sg];function yg(n){return Mg.find(e=>e.match(n))}class bg extends vi{constructor(e,t,i,s){super(e,t,i,"lil-color"),this.$input=document.createElement("input"),this.$input.setAttribute("type","color"),this.$input.setAttribute("tabindex",-1),this.$input.setAttribute("aria-labelledby",this.$name.id),this.$text=document.createElement("input"),this.$text.setAttribute("type","text"),this.$text.setAttribute("spellcheck","false"),this.$text.setAttribute("aria-labelledby",this.$name.id),this.$display=document.createElement("div"),this.$display.classList.add("lil-display"),this.$display.appendChild(this.$input),this.$widget.appendChild(this.$display),this.$widget.appendChild(this.$text),this._format=yg(this.initialValue),this._rgbScale=s,this._initialValueHexString=this.save(),this._textFocused=!1,this.$input.addEventListener("input",()=>{this._setValueFromHexString(this.$input.value)}),this.$input.addEventListener("blur",()=>{this._callOnFinishChange()}),this.$text.addEventListener("input",()=>{const r=Va(this.$text.value);r&&this._setValueFromHexString(r)}),this.$text.addEventListener("focus",()=>{this._textFocused=!0,this.$text.select()}),this.$text.addEventListener("blur",()=>{this._textFocused=!1,this.updateDisplay(),this._callOnFinishChange()}),this.$disable=this.$text,this.updateDisplay()}reset(){return this._setValueFromHexString(this._initialValueHexString),this}_setValueFromHexString(e){if(this._format.isPrimitive){const t=this._format.fromHexString(e);this.setValue(t)}else this._format.fromHexString(e,this.getValue(),this._rgbScale),this._callOnChange(),this.updateDisplay()}save(){return this._format.toHexString(this.getValue(),this._rgbScale)}load(e){return this._setValueFromHexString(e),this._callOnFinishChange(),this}updateDisplay(){return this.$input.value=this._format.toHexString(this.getValue(),this._rgbScale),this._textFocused||(this.$text.value=this.$input.value.substring(1)),this.$display.style.backgroundColor=this.$input.value,this}}class Wr extends vi{constructor(e,t,i){super(e,t,i,"lil-function"),this.$button=document.createElement("button"),this.$button.appendChild(this.$name),this.$widget.appendChild(this.$button),this.$button.addEventListener("click",s=>{s.preventDefault(),this.getValue().call(this.object),this._callOnChange()}),this.$button.addEventListener("touchstart",()=>{},{passive:!0}),this.$disable=this.$button}}class Eg extends vi{constructor(e,t,i,s,r,a){super(e,t,i,"lil-number"),this._initInput(),this.min(s),this.max(r);const o=a!==void 0;this.step(o?a:this._getImplicitStep(),o),this.updateDisplay()}decimals(e){return this._decimals=e,this.updateDisplay(),this}min(e){return this._min=e,this._onUpdateMinMax(),this}max(e){return this._max=e,this._onUpdateMinMax(),this}step(e,t=!0){return this._step=e,this._stepExplicit=t,this}updateDisplay(){const e=this.getValue();if(this._hasSlider){let t=(e-this._min)/(this._max-this._min);t=Math.max(0,Math.min(t,1)),this.$fill.style.width=t*100+"%"}return this._inputFocused||(this.$input.value=this._decimals===void 0?e:e.toFixed(this._decimals)),this}_initInput(){this.$input=document.createElement("input"),this.$input.setAttribute("type","text"),this.$input.setAttribute("aria-labelledby",this.$name.id),window.matchMedia("(pointer: coarse)").matches&&(this.$input.setAttribute("type","number"),this.$input.setAttribute("step","any")),this.$widget.appendChild(this.$input),this.$disable=this.$input;const t=()=>{let x=parseFloat(this.$input.value);isNaN(x)||(this._stepExplicit&&(x=this._snap(x)),this.setValue(this._clamp(x)))},i=x=>{const E=parseFloat(this.$input.value);isNaN(E)||(this._snapClampSetValue(E+x),this.$input.value=this.getValue())},s=x=>{x.key==="Enter"&&this.$input.blur(),x.code==="ArrowUp"&&(x.preventDefault(),i(this._step*this._arrowKeyMultiplier(x))),x.code==="ArrowDown"&&(x.preventDefault(),i(this._step*this._arrowKeyMultiplier(x)*-1))},r=x=>{this._inputFocused&&(x.preventDefault(),i(this._step*this._normalizeMouseWheel(x)))};let a=!1,o,l,c,d,f;const u=5,m=x=>{o=x.clientX,l=c=x.clientY,a=!0,d=this.getValue(),f=0,window.addEventListener("mousemove",g),window.addEventListener("mouseup",S)},g=x=>{if(a){const E=x.clientX-o,M=x.clientY-l;Math.abs(M)>u?(x.preventDefault(),this.$input.blur(),a=!1,this._setDraggingStyle(!0,"vertical")):Math.abs(E)>u&&S()}if(!a){const E=x.clientY-c;f-=E*this._step*this._arrowKeyMultiplier(x),d+f>this._max?f=this._max-d:d+f<this._min&&(f=this._min-d),this._snapClampSetValue(d+f)}c=x.clientY},S=()=>{this._setDraggingStyle(!1,"vertical"),this._callOnFinishChange(),window.removeEventListener("mousemove",g),window.removeEventListener("mouseup",S)},p=()=>{this._inputFocused=!0},h=()=>{this._inputFocused=!1,this.updateDisplay(),this._callOnFinishChange()};this.$input.addEventListener("input",t),this.$input.addEventListener("keydown",s),this.$input.addEventListener("wheel",r,{passive:!1}),this.$input.addEventListener("mousedown",m),this.$input.addEventListener("focus",p),this.$input.addEventListener("blur",h)}_initSlider(){this._hasSlider=!0,this.$slider=document.createElement("div"),this.$slider.classList.add("lil-slider"),this.$fill=document.createElement("div"),this.$fill.classList.add("lil-fill"),this.$slider.appendChild(this.$fill),this.$widget.insertBefore(this.$slider,this.$input),this.domElement.classList.add("lil-has-slider");const e=(h,x,E,M,b)=>(h-x)/(E-x)*(b-M)+M,t=h=>{const x=this.$slider.getBoundingClientRect();let E=e(h,x.left,x.right,this._min,this._max);this._snapClampSetValue(E)},i=h=>{this._setDraggingStyle(!0),t(h.clientX),window.addEventListener("mousemove",s),window.addEventListener("mouseup",r)},s=h=>{t(h.clientX)},r=()=>{this._callOnFinishChange(),this._setDraggingStyle(!1),window.removeEventListener("mousemove",s),window.removeEventListener("mouseup",r)};let a=!1,o,l;const c=h=>{h.preventDefault(),this._setDraggingStyle(!0),t(h.touches[0].clientX),a=!1},d=h=>{h.touches.length>1||(this._hasScrollBar?(o=h.touches[0].clientX,l=h.touches[0].clientY,a=!0):c(h),window.addEventListener("touchmove",f,{passive:!1}),window.addEventListener("touchend",u))},f=h=>{if(a){const x=h.touches[0].clientX-o,E=h.touches[0].clientY-l;Math.abs(x)>Math.abs(E)?c(h):(window.removeEventListener("touchmove",f),window.removeEventListener("touchend",u))}else h.preventDefault(),t(h.touches[0].clientX)},u=()=>{this._callOnFinishChange(),this._setDraggingStyle(!1),window.removeEventListener("touchmove",f),window.removeEventListener("touchend",u)},m=this._callOnFinishChange.bind(this),g=400;let S;const p=h=>{if(Math.abs(h.deltaX)<Math.abs(h.deltaY)&&this._hasScrollBar)return;h.preventDefault();const E=this._normalizeMouseWheel(h)*this._step;this._snapClampSetValue(this.getValue()+E),this.$input.value=this.getValue(),clearTimeout(S),S=setTimeout(m,g)};this.$slider.addEventListener("mousedown",i),this.$slider.addEventListener("touchstart",d,{passive:!1}),this.$slider.addEventListener("wheel",p,{passive:!1})}_setDraggingStyle(e,t="horizontal"){this.$slider&&this.$slider.classList.toggle("lil-active",e),document.body.classList.toggle("lil-dragging",e),document.body.classList.toggle(`lil-${t}`,e)}_getImplicitStep(){return this._hasMin&&this._hasMax?(this._max-this._min)/1e3:.1}_onUpdateMinMax(){!this._hasSlider&&this._hasMin&&this._hasMax&&(this._stepExplicit||this.step(this._getImplicitStep(),!1),this._initSlider(),this.updateDisplay())}_normalizeMouseWheel(e){let{deltaX:t,deltaY:i}=e;return Math.floor(e.deltaY)!==e.deltaY&&e.wheelDelta&&(t=0,i=-e.wheelDelta/120,i*=this._stepExplicit?1:10),t+-i}_arrowKeyMultiplier(e){let t=this._stepExplicit?1:10;return e.shiftKey?t*=10:e.altKey&&(t/=10),t}_snap(e){let t=0;return this._hasMin?t=this._min:this._hasMax&&(t=this._max),e-=t,e=Math.round(e/this._step)*this._step,e+=t,e=parseFloat(e.toPrecision(15)),e}_clamp(e){return e<this._min&&(e=this._min),e>this._max&&(e=this._max),e}_snapClampSetValue(e){this.setValue(this._clamp(this._snap(e)))}get _hasScrollBar(){const e=this.parent.root.$children;return e.scrollHeight>e.clientHeight}get _hasMin(){return this._min!==void 0}get _hasMax(){return this._max!==void 0}}class wg extends vi{constructor(e,t,i,s){super(e,t,i,"lil-option"),this.$select=document.createElement("select"),this.$select.setAttribute("aria-labelledby",this.$name.id),this.$display=document.createElement("div"),this.$display.classList.add("lil-display"),this.$select.addEventListener("change",()=>{this.setValue(this._values[this.$select.selectedIndex]),this._callOnFinishChange()}),this.$select.addEventListener("focus",()=>{this.$display.classList.add("lil-focus")}),this.$select.addEventListener("blur",()=>{this.$display.classList.remove("lil-focus")}),this.$widget.appendChild(this.$select),this.$widget.appendChild(this.$display),this.$disable=this.$select,this.options(s)}options(e){return this._values=Array.isArray(e)?e:Object.values(e),this._names=Array.isArray(e)?e:Object.keys(e),this.$select.replaceChildren(),this._names.forEach(t=>{const i=document.createElement("option");i.textContent=t,this.$select.appendChild(i)}),this.updateDisplay(),this}updateDisplay(){const e=this.getValue(),t=this._values.indexOf(e);return this.$select.selectedIndex=t,this.$display.textContent=t===-1?e:this._names[t],this}}class Tg extends vi{constructor(e,t,i){super(e,t,i,"lil-string"),this.$input=document.createElement("input"),this.$input.setAttribute("type","text"),this.$input.setAttribute("spellcheck","false"),this.$input.setAttribute("aria-labelledby",this.$name.id),this.$input.addEventListener("input",()=>{this.setValue(this.$input.value)}),this.$input.addEventListener("keydown",s=>{s.code==="Enter"&&this.$input.blur()}),this.$input.addEventListener("blur",()=>{this._callOnFinishChange()}),this.$widget.appendChild(this.$input),this.$disable=this.$input,this.updateDisplay()}updateDisplay(){return this.$input.value=this.getValue(),this}}var Ag=`.lil-gui {
  font-family: var(--font-family);
  font-size: var(--font-size);
  line-height: 1;
  font-weight: normal;
  font-style: normal;
  text-align: left;
  color: var(--text-color);
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
  --background-color: #1f1f1f;
  --text-color: #ebebeb;
  --title-background-color: #111111;
  --title-text-color: #ebebeb;
  --widget-color: #424242;
  --hover-color: #4f4f4f;
  --focus-color: #595959;
  --number-color: #2cc9ff;
  --string-color: #a2db3c;
  --font-size: 11px;
  --input-font-size: 11px;
  --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
  --font-family-mono: Menlo, Monaco, Consolas, "Droid Sans Mono", monospace;
  --padding: 4px;
  --spacing: 4px;
  --widget-height: 20px;
  --title-height: calc(var(--widget-height) + var(--spacing) * 1.25);
  --name-width: 45%;
  --slider-knob-width: 2px;
  --slider-input-width: 27%;
  --color-input-width: 27%;
  --slider-input-min-width: 45px;
  --color-input-min-width: 45px;
  --folder-indent: 7px;
  --widget-padding: 0 0 0 3px;
  --widget-border-radius: 2px;
  --checkbox-size: calc(0.75 * var(--widget-height));
  --scrollbar-width: 5px;
}
.lil-gui, .lil-gui * {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
.lil-gui.lil-root {
  width: var(--width, 245px);
  display: flex;
  flex-direction: column;
  background: var(--background-color);
}
.lil-gui.lil-root > .lil-title {
  background: var(--title-background-color);
  color: var(--title-text-color);
}
.lil-gui.lil-root > .lil-children {
  overflow-x: hidden;
  overflow-y: auto;
}
.lil-gui.lil-root > .lil-children::-webkit-scrollbar {
  width: var(--scrollbar-width);
  height: var(--scrollbar-width);
  background: var(--background-color);
}
.lil-gui.lil-root > .lil-children::-webkit-scrollbar-thumb {
  border-radius: var(--scrollbar-width);
  background: var(--focus-color);
}
@media (pointer: coarse) {
  .lil-gui.lil-allow-touch-styles, .lil-gui.lil-allow-touch-styles .lil-gui {
    --widget-height: 28px;
    --padding: 6px;
    --spacing: 6px;
    --font-size: 13px;
    --input-font-size: 16px;
    --folder-indent: 10px;
    --scrollbar-width: 7px;
    --slider-input-min-width: 50px;
    --color-input-min-width: 65px;
  }
}
.lil-gui.lil-force-touch-styles, .lil-gui.lil-force-touch-styles .lil-gui {
  --widget-height: 28px;
  --padding: 6px;
  --spacing: 6px;
  --font-size: 13px;
  --input-font-size: 16px;
  --folder-indent: 10px;
  --scrollbar-width: 7px;
  --slider-input-min-width: 50px;
  --color-input-min-width: 65px;
}
.lil-gui.lil-auto-place, .lil-gui.autoPlace {
  max-height: 100%;
  position: fixed;
  top: 0;
  right: 15px;
  z-index: 1001;
}

.lil-controller {
  display: flex;
  align-items: center;
  padding: 0 var(--padding);
  margin: var(--spacing) 0;
}
.lil-controller.lil-disabled {
  opacity: 0.5;
}
.lil-controller.lil-disabled, .lil-controller.lil-disabled * {
  pointer-events: none !important;
}
.lil-controller > .lil-name {
  min-width: var(--name-width);
  flex-shrink: 0;
  white-space: pre;
  padding-right: var(--spacing);
  line-height: var(--widget-height);
}
.lil-controller .lil-widget {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  min-height: var(--widget-height);
}
.lil-controller.lil-string input {
  color: var(--string-color);
}
.lil-controller.lil-boolean {
  cursor: pointer;
}
.lil-controller.lil-color .lil-display {
  width: 100%;
  height: var(--widget-height);
  border-radius: var(--widget-border-radius);
  position: relative;
}
@media (hover: hover) {
  .lil-controller.lil-color .lil-display:hover:before {
    content: " ";
    display: block;
    position: absolute;
    border-radius: var(--widget-border-radius);
    border: 1px solid #fff9;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
  }
}
.lil-controller.lil-color input[type=color] {
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}
.lil-controller.lil-color input[type=text] {
  margin-left: var(--spacing);
  font-family: var(--font-family-mono);
  min-width: var(--color-input-min-width);
  width: var(--color-input-width);
  flex-shrink: 0;
}
.lil-controller.lil-option select {
  opacity: 0;
  position: absolute;
  width: 100%;
  max-width: 100%;
}
.lil-controller.lil-option .lil-display {
  position: relative;
  pointer-events: none;
  border-radius: var(--widget-border-radius);
  height: var(--widget-height);
  line-height: var(--widget-height);
  max-width: 100%;
  overflow: hidden;
  word-break: break-all;
  padding-left: 0.55em;
  padding-right: 1.75em;
  background: var(--widget-color);
}
@media (hover: hover) {
  .lil-controller.lil-option .lil-display.lil-focus {
    background: var(--focus-color);
  }
}
.lil-controller.lil-option .lil-display.lil-active {
  background: var(--focus-color);
}
.lil-controller.lil-option .lil-display:after {
  font-family: "lil-gui";
  content: "↕";
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  padding-right: 0.375em;
}
.lil-controller.lil-option .lil-widget,
.lil-controller.lil-option select {
  cursor: pointer;
}
@media (hover: hover) {
  .lil-controller.lil-option .lil-widget:hover .lil-display {
    background: var(--hover-color);
  }
}
.lil-controller.lil-number input {
  color: var(--number-color);
}
.lil-controller.lil-number.lil-has-slider input {
  margin-left: var(--spacing);
  width: var(--slider-input-width);
  min-width: var(--slider-input-min-width);
  flex-shrink: 0;
}
.lil-controller.lil-number .lil-slider {
  width: 100%;
  height: var(--widget-height);
  background: var(--widget-color);
  border-radius: var(--widget-border-radius);
  padding-right: var(--slider-knob-width);
  overflow: hidden;
  cursor: ew-resize;
  touch-action: pan-y;
}
@media (hover: hover) {
  .lil-controller.lil-number .lil-slider:hover {
    background: var(--hover-color);
  }
}
.lil-controller.lil-number .lil-slider.lil-active {
  background: var(--focus-color);
}
.lil-controller.lil-number .lil-slider.lil-active .lil-fill {
  opacity: 0.95;
}
.lil-controller.lil-number .lil-fill {
  height: 100%;
  border-right: var(--slider-knob-width) solid var(--number-color);
  box-sizing: content-box;
}

.lil-dragging .lil-gui {
  --hover-color: var(--widget-color);
}
.lil-dragging * {
  cursor: ew-resize !important;
}
.lil-dragging.lil-vertical * {
  cursor: ns-resize !important;
}

.lil-gui .lil-title {
  height: var(--title-height);
  font-weight: 600;
  padding: 0 var(--padding);
  width: 100%;
  text-align: left;
  background: none;
  text-decoration-skip: objects;
}
.lil-gui .lil-title:before {
  font-family: "lil-gui";
  content: "▾";
  padding-right: 2px;
  display: inline-block;
}
.lil-gui .lil-title:active {
  background: var(--title-background-color);
  opacity: 0.75;
}
@media (hover: hover) {
  body:not(.lil-dragging) .lil-gui .lil-title:hover {
    background: var(--title-background-color);
    opacity: 0.85;
  }
  .lil-gui .lil-title:focus {
    text-decoration: underline var(--focus-color);
  }
}
.lil-gui.lil-root > .lil-title:focus {
  text-decoration: none !important;
}
.lil-gui.lil-closed > .lil-title:before {
  content: "▸";
}
.lil-gui.lil-closed > .lil-children {
  transform: translateY(-7px);
  opacity: 0;
}
.lil-gui.lil-closed:not(.lil-transition) > .lil-children {
  display: none;
}
.lil-gui.lil-transition > .lil-children {
  transition-duration: 300ms;
  transition-property: height, opacity, transform;
  transition-timing-function: cubic-bezier(0.2, 0.6, 0.35, 1);
  overflow: hidden;
  pointer-events: none;
}
.lil-gui .lil-children:empty:before {
  content: "Empty";
  padding: 0 var(--padding);
  margin: var(--spacing) 0;
  display: block;
  height: var(--widget-height);
  font-style: italic;
  line-height: var(--widget-height);
  opacity: 0.5;
}
.lil-gui.lil-root > .lil-children > .lil-gui > .lil-title {
  border: 0 solid var(--widget-color);
  border-width: 1px 0;
  transition: border-color 300ms;
}
.lil-gui.lil-root > .lil-children > .lil-gui.lil-closed > .lil-title {
  border-bottom-color: transparent;
}
.lil-gui + .lil-controller {
  border-top: 1px solid var(--widget-color);
  margin-top: 0;
  padding-top: var(--spacing);
}
.lil-gui .lil-gui .lil-gui > .lil-title {
  border: none;
}
.lil-gui .lil-gui .lil-gui > .lil-children {
  border: none;
  margin-left: var(--folder-indent);
  border-left: 2px solid var(--widget-color);
}
.lil-gui .lil-gui .lil-controller {
  border: none;
}

.lil-gui label, .lil-gui input, .lil-gui button {
  -webkit-tap-highlight-color: transparent;
}
.lil-gui input {
  border: 0;
  outline: none;
  font-family: var(--font-family);
  font-size: var(--input-font-size);
  border-radius: var(--widget-border-radius);
  height: var(--widget-height);
  background: var(--widget-color);
  color: var(--text-color);
  width: 100%;
}
@media (hover: hover) {
  .lil-gui input:hover {
    background: var(--hover-color);
  }
  .lil-gui input:active {
    background: var(--focus-color);
  }
}
.lil-gui input:disabled {
  opacity: 1;
}
.lil-gui input[type=text],
.lil-gui input[type=number] {
  padding: var(--widget-padding);
  -moz-appearance: textfield;
}
.lil-gui input[type=text]:focus,
.lil-gui input[type=number]:focus {
  background: var(--focus-color);
}
.lil-gui input[type=checkbox] {
  appearance: none;
  width: var(--checkbox-size);
  height: var(--checkbox-size);
  border-radius: var(--widget-border-radius);
  text-align: center;
  cursor: pointer;
}
.lil-gui input[type=checkbox]:checked:before {
  font-family: "lil-gui";
  content: "✓";
  font-size: var(--checkbox-size);
  line-height: var(--checkbox-size);
}
@media (hover: hover) {
  .lil-gui input[type=checkbox]:focus {
    box-shadow: inset 0 0 0 1px var(--focus-color);
  }
}
.lil-gui button {
  outline: none;
  cursor: pointer;
  font-family: var(--font-family);
  font-size: var(--font-size);
  color: var(--text-color);
  width: 100%;
  border: none;
}
.lil-gui .lil-controller button {
  height: var(--widget-height);
  text-transform: none;
  background: var(--widget-color);
  border-radius: var(--widget-border-radius);
}
@media (hover: hover) {
  .lil-gui .lil-controller button:hover {
    background: var(--hover-color);
  }
  .lil-gui .lil-controller button:focus {
    box-shadow: inset 0 0 0 1px var(--focus-color);
  }
}
.lil-gui .lil-controller button:active {
  background: var(--focus-color);
}

@font-face {
  font-family: "lil-gui";
  src: url("data:application/font-woff2;charset=utf-8;base64,d09GMgABAAAAAALkAAsAAAAABtQAAAKVAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHFQGYACDMgqBBIEbATYCJAMUCwwABCAFhAoHgQQbHAbIDiUFEYVARAAAYQTVWNmz9MxhEgodq49wYRUFKE8GWNiUBxI2LBRaVnc51U83Gmhs0Q7JXWMiz5eteLwrKwuxHO8VFxUX9UpZBs6pa5ABRwHA+t3UxUnH20EvVknRerzQgX6xC/GH6ZUvTcAjAv122dF28OTqCXrPuyaDER30YBA1xnkVutDDo4oCi71Ca7rrV9xS8dZHbPHefsuwIyCpmT7j+MnjAH5X3984UZoFFuJ0yiZ4XEJFxjagEBeqs+e1iyK8Xf/nOuwF+vVK0ur765+vf7txotUi0m3N0m/84RGSrBCNrh8Ee5GjODjF4gnWP+dJrH/Lk9k4oT6d+gr6g/wssA2j64JJGP6cmx554vUZnpZfn6ZfX2bMwPPrlANsB86/DiHjhl0OP+c87+gaJo/gY084s3HoYL/ZkWHTRfBXvvoHnnkHvngKun4KBE/ede7tvq3/vQOxDXB1/fdNz6XbPdcr0Vhpojj9dG+owuSKFsslCi1tgEjirjXdwMiov2EioadxmqTHUCIwo8NgQaeIasAi0fTYSPTbSmwbMOFduyh9wvBrESGY0MtgRjtgQR8Q1bRPohn2UoCRZf9wyYANMXFeJTysqAe0I4mrherOekFdKMrYvJjLvOIUM9SuwYB5DVZUwwVjJJOaUnZCmcEkIZZrKqNvRGRMvmFZsmhP4VMKCSXBhSqUBxgMS7h0cZvEd71AWkEhGWaeMFcNnpqyJkyXgYL7PQ1MoSq0wDAkRtJIijkZSmqYTiSImfLiSWXIZwhRh3Rug2X0kk1Dgj+Iu43u5p98ghopcpSo0Uyc8SnjlYX59WUeaMoDqmVD2TOWD9a4pCRAzf2ECgwGcrHjPOWY9bNxq/OL3I/QjwEAAAA=") format("woff2");
}`;function Cg(n){const e=document.createElement("style");e.innerHTML=n;const t=document.querySelector("head link[rel=stylesheet], head style");t?document.head.insertBefore(e,t):document.head.appendChild(e)}let Bl=!1;class go{constructor({parent:e,autoPlace:t=e===void 0,container:i,width:s,title:r="Controls",closeFolders:a=!1,injectStyles:o=!0,touchStyles:l=!0}={}){if(this.parent=e,this.root=e?e.root:this,this.children=[],this.controllers=[],this.folders=[],this._closed=!1,this._hidden=!1,this.domElement=document.createElement("div"),this.domElement.classList.add("lil-gui"),this.$title=document.createElement("button"),this.$title.classList.add("lil-title"),this.$title.setAttribute("aria-expanded",!0),this.$title.addEventListener("click",()=>this.openAnimated(this._closed)),this.$title.addEventListener("touchstart",()=>{},{passive:!0}),this.$children=document.createElement("div"),this.$children.classList.add("lil-children"),this.domElement.appendChild(this.$title),this.domElement.appendChild(this.$children),this.title(r),this.parent){this.parent.children.push(this),this.parent.folders.push(this),this.parent.$children.appendChild(this.domElement);return}this.domElement.classList.add("lil-root"),l&&this.domElement.classList.add("lil-allow-touch-styles"),!Bl&&o&&(Cg(Ag),Bl=!0),i?i.appendChild(this.domElement):t&&(this.domElement.classList.add("lil-auto-place","autoPlace"),document.body.appendChild(this.domElement)),s&&this.domElement.style.setProperty("--width",s+"px"),this._closeFolders=a}add(e,t,i,s,r){if(Object(i)===i)return new wg(this,e,t,i);const a=e[t];switch(typeof a){case"number":return new Eg(this,e,t,i,s,r);case"boolean":return new vg(this,e,t);case"string":return new Tg(this,e,t);case"function":return new Wr(this,e,t)}console.error(`gui.add failed
	property:`,t,`
	object:`,e,`
	value:`,a)}addColor(e,t,i=1){return new bg(this,e,t,i)}addFolder(e){const t=new go({parent:this,title:e});return this.root._closeFolders&&t.close(),t}load(e,t=!0){return e.controllers&&this.controllers.forEach(i=>{i instanceof Wr||i._name in e.controllers&&i.load(e.controllers[i._name])}),t&&e.folders&&this.folders.forEach(i=>{i._title in e.folders&&i.load(e.folders[i._title])}),this}save(e=!0){const t={controllers:{},folders:{}};return this.controllers.forEach(i=>{if(!(i instanceof Wr)){if(i._name in t.controllers)throw new Error(`Cannot save GUI with duplicate property "${i._name}"`);t.controllers[i._name]=i.save()}}),e&&this.folders.forEach(i=>{if(i._title in t.folders)throw new Error(`Cannot save GUI with duplicate folder "${i._title}"`);t.folders[i._title]=i.save()}),t}open(e=!0){return this._setClosed(!e),this.$title.setAttribute("aria-expanded",!this._closed),this.domElement.classList.toggle("lil-closed",this._closed),this}close(){return this.open(!1)}_setClosed(e){this._closed!==e&&(this._closed=e,this._callOnOpenClose(this))}show(e=!0){return this._hidden=!e,this.domElement.style.display=this._hidden?"none":"",this}hide(){return this.show(!1)}openAnimated(e=!0){return this._setClosed(!e),this.$title.setAttribute("aria-expanded",!this._closed),requestAnimationFrame(()=>{const t=this.$children.clientHeight;this.$children.style.height=t+"px",this.domElement.classList.add("lil-transition");const i=r=>{r.target===this.$children&&(this.$children.style.height="",this.domElement.classList.remove("lil-transition"),this.$children.removeEventListener("transitionend",i))};this.$children.addEventListener("transitionend",i);const s=e?this.$children.scrollHeight:0;this.domElement.classList.toggle("lil-closed",!e),requestAnimationFrame(()=>{this.$children.style.height=s+"px"})}),this}title(e){return this._title=e,this.$title.textContent=e,this}reset(e=!0){return(e?this.controllersRecursive():this.controllers).forEach(i=>i.reset()),this}onChange(e){return this._onChange=e,this}_callOnChange(e){this.parent&&this.parent._callOnChange(e),this._onChange!==void 0&&this._onChange.call(this,{object:e.object,property:e.property,value:e.getValue(),controller:e})}onFinishChange(e){return this._onFinishChange=e,this}_callOnFinishChange(e){this.parent&&this.parent._callOnFinishChange(e),this._onFinishChange!==void 0&&this._onFinishChange.call(this,{object:e.object,property:e.property,value:e.getValue(),controller:e})}onOpenClose(e){return this._onOpenClose=e,this}_callOnOpenClose(e){this.parent&&this.parent._callOnOpenClose(e),this._onOpenClose!==void 0&&this._onOpenClose.call(this,e)}destroy(){this.parent&&(this.parent.children.splice(this.parent.children.indexOf(this),1),this.parent.folders.splice(this.parent.folders.indexOf(this),1)),this.domElement.parentElement&&this.domElement.parentElement.removeChild(this.domElement),Array.from(this.children).forEach(e=>e.destroy())}controllersRecursive(){let e=Array.from(this.controllers);return this.folders.forEach(t=>{e=e.concat(t.controllersRecursive())}),e}foldersRecursive(){let e=Array.from(this.folders);return this.folders.forEach(t=>{e=e.concat(t.foldersRecursive())}),e}}const Rg={exposure:[.2,3,.01],maxPixelRatio:[.5,3,.5],bloomStrength:[0,3,.01],bloomRadius:[0,2,.01],bloomThreshold:[0,1,.005],contrast:[.5,2,.005],saturation:[0,2.5,.005],lift:[-.2,.2,.001],vignette:[0,1.5,.005],chromatic:[0,.02,1e-4],grain:[0,.2,.001],distortionAmount:[-.3,.3,.001],fov:[20,100,.5],distance:[4,60,.1],azimuth:[-Math.PI,Math.PI,.01],polar:[.05,1.55,.005],damping:[.5,30,.1],fogNear:[0,120,.5],fogFar:[1,240,.5],size:[20,400,1],opacity:[0,1,.005],roughness:[0,1,.005],metalness:[0,1,.005],refraction:[0,1,.005],sparkle:[0,2,.005],emissive:[0,6,.01],range:[2,40,.1],minRange:[0,20,.1],radius:[.2,14,.05],cooldown:[0,8,.01],castTime:[0,2,.01],duration:[.2,14,.05],shake:[0,3,.01],flash:[0,1,.005],globalOpacity:[0,2,.01],globalScale:[.1,4,.01],softness:[0,1,.005],budget:[4e3,2e5,1e3]},Pg=new Set(["count","shards","rings","segments","radial","filaments","octaves","steps","chevrons","ticks","clusterCount","chunkCount","moteCount","craterCount","fractureCount","detail","shatterRings","budget"]),Dg=new Set(["segments","radial","detail","budget"]);function Lg(n,e){const t=Rg[n];if(t)return t;const i=Math.abs(e);if(i===0)return[0,1,.001];const s=Math.pow(10,Math.ceil(Math.log10(i)))*(i>Math.pow(10,Math.floor(Math.log10(i)))*3?1:.5),r=Math.max(s,i*2.5),a=e<0?-r:0,o=Pg.has(n)?1:Math.max((r-a)/1e3,1e-4);return[a,r,o]}const Ig=n=>typeof n=="string"&&/^#[0-9a-f]{3,8}$/i.test(n),Ug={frost:"Q — Frost Lance",storm:"E — Storm Lance",cinder:"R — Cinder Fall",nova:"F — Nova Beam",snare:"V — Voltaic Snare",glacier:"C — Glacier Crown"};class Fg{constructor(e,t={}){this.settings=e,this.actions=t,this.count=0,this.gui=new go({title:"VFX editor",width:322}),this.gui.domElement.style.setProperty("--width","322px");const i=this.gui.addFolder("Stage").close();this._bindGroup(i.addFolder("Renderer").close(),e.renderer),this._bindGroup(i.addFolder("Post").close(),e.post),this._bindGroup(i.addFolder("Camera").close(),e.camera),this._bindGroup(i.addFolder("Lighting").close(),e.world),this._bindGroup(i.addFolder("Ground").close(),e.ground),this._bindGroup(i.addFolder("Dust").close(),e.dust),this._bindGroup(i.addFolder("Caster").close(),e.caster);const s=this.gui.addFolder("Targeting").close();this._bindGroup(s,e.aim);const r=this.gui.addFolder("Particles").close();this._bindGroup(r,e.particles);for(const o of mc){const l=this.gui.addFolder(Ug[o]??o).close();this._bindGroup(l,e.abilities[o])}const a=this.gui.addFolder("Session");a.add({clear:()=>t.clear?.()},"clear").name("clear live effects  (X)"),a.add({pause:()=>t.pause?.()},"pause").name("pause / resume  (P)"),a.add({save:()=>this.savePreset()},"save").name("save preset to this browser"),a.add({load:()=>this.loadPreset()},"load").name("load saved preset"),a.add({reset:()=>this.reset()},"reset").name("reset everything"),this.gui.title(`VFX editor — ${this.count} parameters`),this.visible=!0}_bindGroup(e,t,i=0){for(const s of Object.keys(t)){const r=t[s];if(r&&typeof r=="object"&&!Array.isArray(r)){const a=e.addFolder(An(s)).close();this._bindGroup(a,r,i+1);continue}if(Ig(r)){e.addColor(t,s).name(An(s)),this.count++;continue}if(typeof r=="boolean"){e.add(t,s).name(An(s)),this.count++;continue}if(typeof r=="number"){const[a,o,l]=Lg(s,r),c=e.add(t,s,a,o,l).name(An(s));Dg.has(s)&&c.name(`${An(s)} ⟳`),this.count++;continue}typeof r=="string"&&i===0&&e.add(t,s).disable().name(An(s))}}savePreset(){try{localStorage.setItem("elemental-sandbox:preset",JSON.stringify(this.settings)),this.actions.notify?.("preset saved")}catch(e){console.warn("[editor] could not save preset",e)}}loadPreset(){try{const e=localStorage.getItem("elemental-sandbox:preset");if(!e)return;za(this.settings,JSON.parse(e)),this.refresh(),this.actions.notify?.("preset loaded")}catch(e){console.warn("[editor] could not load preset",e)}}reset(){za(this.settings,e0),this.refresh()}refresh(){this.gui.controllersRecursive().forEach(e=>e.updateDisplay())}toggle(){this.visible=!this.visible,this.gui.domElement.style.display=this.visible?"":"none"}}function An(n){return n.replace(/([A-Z])/g," $1").replace(/^./,e=>e.toUpperCase()).trim()}class Ng{constructor(e){this.canvas=e,this.settings=Ut,this.time=new r0,this.renderer=t0(e,Ut),this.scene=new Zl,this.rig=new s0(Ut),this.camera=this.rig.camera,this.environment=new o0(this.scene,this.renderer,Ut),this.ground=new l0(this.scene,Ut),this.dust=new c0(this.scene,Ut),this.caster=new u0(this.scene,Ut),this.particles=new M0(this.scene,Ut),this.decals=new I0(this.scene,Ut),this.lights=new U0(this.scene,7),this.bursts=new F0(this.scene,10),this.post=new pg(this.renderer,this.scene,this.camera,Ut),this.context={scene:this.scene,settings:Ut,time:this.time,camera:this.camera,caster:this.caster,particles:this.particles,decals:this.decals,lights:this.lights,bursts:this.bursts,shake:t=>{this.rig.shake(t),this.post.punch(t*.09)},flash:(t,i)=>this.hud?.punch(t,i)},this.abilities=new sg(this.context),this.aim=new V0(this.scene,this.camera,Ut),this.input=new N0(e),this.hud=new gg(this.abilities,Ut),this.editor=new Fg(Ut,{clear:()=>this.clear(),pause:()=>this.time.togglePause()}),this._origin=new C,this._wireInput(),this.resize(),window.addEventListener("resize",()=>this.resize()),this._frames=0,this._raf=0}_wireInput(){const e=this.input;e.on("pointer",t=>this.aim.setPointer(t)),e.on("orbit",({dx:t,dy:i})=>this.rig.orbit(t,i)),e.on("zoom",t=>this.rig.zoom(t)),e.on("cancel",()=>this.abilities.cancel()),e.on("cast",()=>{this.input.dragging||this.abilities.tryCast(this.aim)}),e.on("key",t=>{const i=this.abilities.keyFor(t);if(i){this.abilities.arm(i);return}switch(t){case"KeyG":this.editor.toggle();break;case"KeyP":this.time.togglePause();break;case"KeyX":this.clear();break;case"KeyH":this.hud.toggleHelp();break}})}resize(){const e=window.innerWidth,t=window.innerHeight;this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,this.settings.renderer.maxPixelRatio)),this.renderer.setSize(e,t),this.rig.resize(e,t),this.post.resize(e,t)}clear(){this.abilities.clear(),this.particles.clear(),this.decals.clear(),this.bursts.clear(),this.lights.clear()}start(){const e=()=>{this._raf=requestAnimationFrame(e),this.frame()};e()}frame(){const e=this.time;e.tick();const t=e.simDelta,i=e.delta;this.renderer.toneMappingExposure=this.settings.renderer.exposure,this.environment.sync(),this.ground.sync(),this.dust.sync(),this.abilities.sync(),a0(e,this.camera,this.renderer.getSize(Og),this.settings),this.abilities.armed&&this.caster.face(this.aim.direction);const s=this.abilities.armedKey?.35:0;this.caster.update(i,e.wall,s),this._origin.copy(this.caster.root.position),this.aim.update(i,this.abilities.armed,this._origin),this.abilities.update(t,i),this.decals.update(t),this.bursts.update(t),this.lights.update(t,e.wall),this.particles.flush(),this.rig.update(i,e.wall),this.hud.update(i),this.post.render(i,e.wall),this._frames<3&&(this._frames++,this._frames===3&&document.getElementById("boot")?.classList.add("boot--done"))}}const Og=new Re,Bg=document.getElementById("stage");try{const n=new Ng(Bg);n.start(),window.sandbox=n}catch(n){console.error(n);const e=document.getElementById("boot");e&&(e.classList.remove("boot--done"),e.innerHTML=`<div class="boot__label">WebGL failed to start</div><div class="boot__label" style="opacity:.6;max-width:32ch;text-align:center;line-height:1.8">
        ${String(n?.message??n)}
      </div>`)}
