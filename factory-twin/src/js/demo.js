// ================= 自動説明（画面を自動で操作しながら、機能と分析結果を順に説明する） =================
// 上部の「▶ 自動説明」で開始。dist/index-demo.html は開いた直後に開始画面を出す。
const demo={on:false,i:0,paused:false,voice:false,timer:null,t0:0,dur:0,raf:0};
const demoEl=document.getElementById('demoCard');
const dn=(v,d=0)=>(+v).toLocaleString('ja-JP',{maximumFractionDigits:d,minimumFractionDigits:d});
function demoPlay(want){ if(playing!==want) document.querySelector('#play button').click(); }
function demoCam(yaw,pitch,dist,x,y,z){ camGoal.yaw=yaw; camGoal.pitch=pitch; camGoal.dist=dist; camGoal.target.set(x,y,z); }
function demoClean(){   // どの場面からでも「3D・敷地または建屋」に戻れるよう、重なる画面を閉じる
  try{ if(v3.walk) v3Overview(); }catch(e){}
  if(simActive) simClose();
  const pd=document.getElementById('pdApp'); if(!pd.hidden){ window.__productivityRestore3D?.(); pd.hidden=true; }
  autoOrbit=false;
}
function demoSite(){ demoClean(); if(ctx.kind!=='site') exitBuilding(); select(null); }
function demoBuilding(id,scen){
  demoClean(); const b=siteCtx.items.find(i=>i.id===id);
  if(!currentBuilding||currentBuilding.id!==id){ if(ctx.kind!=='site') exitBuilding(); enterBuilding(b); }
  if(scen&&layoutCtxs[id]&&layoutState[id]!==scen) setLayoutScenario(id,scen);
  select(null);
}
function demoLook(v){ if(twinLook===v) return; twinLook=v; v3.layers.walls=v==='photo'; if(currentBuilding){ buildInteriorScene(currentBuilding); recomputeActive(); } }
function demoPanel(open,headingText){
  twinState.open=open; twinRender(); if(!open||!headingText){ if(open) twinBody.scrollTop=0; return; }
  const h=[...twinBody.querySelectorAll('h3,h4,h5')].find(x=>x.textContent.includes(headingText));
  if(h){ twinBody.scrollTo({top:Math.max(0,h.offsetTop-70),behavior:'smooth'}); h.classList.add('demo-flash'); setTimeout(()=>h.classList.remove('demo-flash'),4200); }
}
function demoSteps(){
  const A=TWIN, ev=simCore.evaluate(simCfg), ev1=simCore.evaluate({...simCfg,researchReduction:1});
  const P=A.pooled, S=A.staffing, all=P.find(x=>x.depts.length===4), p2=P[0], s2b=S.find(x=>x.dept==='2B');
  const prod=A.monthly.filter(m=>m.metric==='生産トン数'&&m.category==='合計'), ta=prod.reduce((a,m)=>a+m.actual,0);
  // 実測再生で見せる日時: 同時に計測されている人数が最も多い日・時刻
  let bestDay=simState.day, bestTime=9.5*3600, bestN=-1;
  for(const day of [...new Set(simReplay.tracks.map(t=>t.day))]){ const ts=simReplay.tracks.filter(t=>t.day===day&&t.start!==null);
    for(let tm=8*3600;tm<=17*3600;tm+=900){ const n=ts.filter(t=>t.start<=tm&&t.end>=tm+1800).length; if(n>bestN){ bestN=n; bestDay=day; bestTime=tm; } } }
  let moved=null;
  return [
   {t:'はじめに',x:`これは、加須工場の設備移設を検討するためのデジタルツインです。工場全体、建屋の内部、設備1台の順に見ていけます。右側の分析基盤が、いま見ている場所に合わせて切り替わります。これから、主な機能と分析結果を順にご説明します。`,
    a:()=>{ demoSite(); demoPlay(false); demoLook('classic'); twinState.diff=false; demoPanel(false); exCamera('overall'); }},
   {t:'工場の全景',x:`敷地の配置図をもとに、第一ペイント、第二ペイント、ワニス、調色、倉庫、屋外タンクを並べています。視点はドラッグで回し、ホイールで拡大します。建屋をダブルクリックすると、その内部に入れます。`,
    a:()=>{ demoSite(); demoPanel(false); exCamera('overall'); autoOrbit=true; }},
   {t:'人とフォークリフトの動き',x:`稼働再生を押すと、人とリフトが動きます。リフトは2台です。1台は原料や資材を倉庫から生産棟へ、もう1台は製品を生産棟から出荷倉庫、そしてトラックへ運びます。歩いている人は、位置の実測データで建屋間の行き来が多かった組み合わせを再現しています。リフトの行き先と回数は、記録がないため仮定です。`,
    a:()=>{ demoSite(); demoPanel(false); demoPlay(true); demoCam(.3,.85,120,10,2,-45); }},
   {t:'分析基盤：工場全体の実績',x:`右側が分析基盤です。7か月の生産実績は${dn(ta)}トン、製造バッチは${dn(A.counts.batches)}件です。ライン別に、1日あたりのバッチ数、出来高、1人1時間あたりの生産量、収率を並べています。行をクリックすると、その建屋の内部に入ります。`,
    a:()=>{ demoSite(); demoPlay(false); exCamera('overall'); demoPanel(true,'ライン別'); }},
   {t:'分析：2名削減はどの条件なら成り立つか',x:`日ごとの出勤人数と作業時間を突き合わせました。工程ごとに1名ずつ減らすと、忙しい日に人が足りなくなります。たとえば2Bでは${dn(s2b.over_p90_minus1)}パーセントの日で不足します。一方、4つの工程で人を融通できれば、2名減らしても不足する日は${dn(all.short_minus2)}パーセントです。原資は、日ごとの仕事量のばらつきにあります。`,
    a:()=>{ demoSite(); demoPanel(true,'2名削減の原資'); }},
   {t:'分析：移設で移動時間はどう変わるか',x:`位置の実測から、建屋の間を歩く時間を出しました。現状は1日${dn(ev.beforeMinutes)}分です。ワニスと調色を第二工場へ移すと${dn(ev.afterMinutes)}分になり、${ev.gain<0?'増えます':'減ります'}。調色が研究棟へ資材を取りに行く往復が遠くなるためです。資材の置場も一緒に移せば、${dn(ev1.afterMinutes)}分まで下がります。`,
    a:()=>{ demoSite(); demoPanel(true,'建屋間の移動と移設の影響'); setTimeout(()=>{ if(demo.on&&!demo.paused) demoPanel(true,'資材の取りに行き'); },9000); }},
   {t:'分析：月次の実績、人員、調色',x:`月ごとの生産の計画と実績、部門ごとの出勤と残業と応援の出入り、調色の補正回数と作業時間も確認できます。調色は、補正が1回増えるごとに作業時間が25分から30分ほど延びています。`,
    a:()=>{ demoSite(); demoPanel(true,'月次 計画と実績'); setTimeout(()=>{ if(demo.on&&!demo.paused) demoPanel(true,'調色 色補正'); },8000); }},
   {t:'建屋の内部：第一ペイント工場',x:`建屋の内部です。第一ペイント工場は図面をまだいただいていないため、内部は検討用の仮の配置です。歩いている人数は、仕込み3名、調合3名、充填10名の合計16名に合わせています。分析基盤は、このラインの実績に切り替わります。`,
    a:()=>{ demoBuilding('paint1'); demoPanel(true); demoPlay(true); }},
   {t:'第二ペイント工場：3つの配置を切り替える',x:`第二ペイント工場は、分析基盤の「内部の配置」で3つを切り替えられます。初期イメージ、図面どおりの現状、図面どおりの変更案です。いまは初期イメージです。`,
    a:()=>{ demoBuilding('paint2','concept'); demoPlay(true); demoPanel(true,'内部の配置'); }},
   {t:'図面どおりの現状',x:`図面の現状レイアウトです。建屋は43.5メートル掛ける38メートル、設備は図面の位置に置いています。架台の上のタンクとディスパー、ミル、充填機に、設備番号を付けています。原料や製品などの周辺物は、図面に記載がないため仮の配置です。`,
    a:()=>{ demoBuilding('paint2','current'); demoPlay(true); demoPanel(true,'内部の配置'); demoCam(1.25,.85,44,0,2,0); }},
   {t:'設備をクリックすると台帳と実績が出る',x:`設備をクリックすると、設備台帳の仕様と導入年、7か月の使用バッチ数、主な製品、その設備を通る人の動きが出ます。図面、設備台帳、生産データの3つを、設備番号でつないでいます。いまはディスパーD-136を選んでいます。`,
    a:()=>{ demoBuilding('paint2','current'); const it=ctx.items.find(i=>i.tags?.includes('D-136')); if(it){ select(it); demoCam(1.6,.8,18,it.x,1.5,it.z+3); } demoPanel(true); }},
   {t:'変更案との比較',x:`図面の変更案です。ワニスの生産エリアと調色のエリアが第二工場に入ります。緑が追加される設備、橙が図面から消える設備です。2Bで最もよく使われているD-108とそのタンクは、変更案の図面に行き先がありません。移設後の置き場所を決める必要があります。`,
    a:()=>{ demoBuilding('paint2','plan'); twinState.diff=true; twinDrawOverlay(); demoPlay(true); demoCam(1.25,.85,44,0,2,0); demoPanel(true,'図面 現状と変更案の比較'); }},
   {t:'設備を動かすと、すぐに計算し直す',x:`移動モードで設備をドラッグすると、人が歩く距離をその場で計算し直します。いま、デジタル充填機を1台、東へ8メートル動かしました。右の表の変更案の数字が変わります。この説明のあと、元の位置に戻します。`,
    a:()=>{ demoBuilding('paint2','plan'); twinState.diff=false; const it=ctx.items.find(i=>i.tags?.includes('D-3')); if(it&&!moved){ moved={it,x:it.x,z:it.z}; it.x+=8; it.z+=2.5; buildInteriorScene(currentBuilding); recomputeActive(); }
      if(it){ select(null); demoCam(1.3,.8,26,it.x-3,1.5,it.z); } demoPanel(true,'図面 現状と変更案の比較'); },
    z:()=>{ if(moved){ moved.it.x=moved.x; moved.it.z=moved.z; moved=null; if(currentBuilding){ buildInteriorScene(currentBuilding); recomputeActive(); } } }},
   {t:'写真に寄せた表示',x:`見た目は切り替えられます。「写真調の質感」にすると、現地の写真に合わせた、緑の床、明るい照明、ステンレスのタンクと若草色のディスパーになります。`,
    a:()=>{ demoBuilding('paint2','current'); twinState.diff=false; twinDrawOverlay(); demoLook('photo'); demoPlay(true); demoCam(2.2,.68,20,-12,1.6,1); demoPanel(false); },
    z:()=>demoLook('classic')},
   {t:'実測の人の動きを再生する',x:`こちらは、位置の実測データを時刻どおりに再生する画面です。${+bestDay.slice(5,7)}月${+bestDay.slice(8)}日、${bestN}人を同時に計測していた時間帯です。人の形は、その時刻に実際に計測された位置にいます。改善案に切り替えると、移設先をドラッグして移動時間を試算できます。`,
    a:()=>{ demoSite(); demoPlay(false); demoPanel(false); simOpen(); simState.mode='replay'; simState.day=bestDay; simState.building='all'; simState.floor='both'; simState.group='all'; simState.time=bestTime; simState.speed=120; simBuild(); simFit(); simPanel(); simState.running=true; const b=document.getElementById('simPlay'); if(b) b.textContent='停止'; },
    z:()=>{ if(simActive) simClose(); }},
   {t:'実測動線のダッシュボード',x:`実測の集計を一覧で見る画面です。エリアごとの滞在時間、エリア間の移動回数、移設した場合の比較、人員の計画を確認できます。`,
    a:()=>{ demoSite(); demoPanel(false); document.getElementById('pdOpen').click(); },
    z:()=>{ const pd=document.getElementById('pdApp'); if(!pd.hidden){ window.__productivityRestore3D?.(); pd.hidden=true; } }},
   {t:'まだ足りないデータ',x:`より確かな判断のために、次の資料をお願いしたいと考えています。人員の正しい内訳。どなたがどの工程を担当できるか。調色の日ごとの作業記録。調色が研究棟から取る資材の内容と量。D-108とタンクの移設後の行き先。そして、第一ペイント、ワニス、調色の図面です。詳しくはマニュアルの一覧をご覧ください。`,
    a:()=>{ demoSite(); demoPlay(false); exCamera('overall'); autoOrbit=true; demoPanel(false); }},
   {t:'まとめ',x:`現時点の結論は3つです。1つ目、移設だけでは移動時間は減りません。調色の資材置場も一緒に移す必要があります。2つ目、第二工場の中の設備の並べ方は、歩く距離にほとんど影響しません。3つ目、2名削減の原資は、工程をまたいだ人の融通にあります。2Bとワニスは忙しい日が重ならないので、集約には意味があります。ご説明は以上です。`,
    a:()=>{ demoSite(); exCamera('overall'); autoOrbit=true; demoPanel(true,'2名削減の原資'); }},
  ];
}
let demoList=null;
function demoSpeak(text,onEnd){
  if(!demo.voice||!window.speechSynthesis) return false;
  try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); u.lang='ja-JP'; u.rate=1.05;
    const v=speechSynthesis.getVoices().find(v=>v.lang&&v.lang.startsWith('ja')); if(v) u.voice=v; u.onend=onEnd; u.onerror=onEnd; speechSynthesis.speak(u); return true; }catch(e){ return false; }
}
function demoShow(i){
  clearTimeout(demo.timer); cancelAnimationFrame(demo.raf);
  const prev=demoList[demo.i]; if(prev&&prev.z&&demo.i!==i){ try{ prev.z(); }catch(e){ console.warn('demo cleanup',e); } }
  demo.i=i; const s=demoList[i];
  try{ s.a(); }catch(e){ console.warn('demo step',e); }
  demoEl.querySelector('.d-step').textContent=`${i+1} / ${demoList.length}`;
  demoEl.querySelector('.d-ttl').textContent=s.t; demoEl.querySelector('.d-txt').textContent=s.x;
  demo.dur=Math.max(9000,s.x.length*175); demo.t0=performance.now(); demo.left=demo.dur;
  let spoken=false; const next=()=>{ if(!demo.on||demo.paused||demo.i!==i) return; if(i<demoList.length-1) demoShow(i+1); else demoEnd(true); };
  if(!demo.paused){ spoken=demoSpeak(s.x,()=>{ clearTimeout(demo.timer); demo.timer=setTimeout(next,1400); }); demo.timer=setTimeout(next,spoken?demo.dur*2.2:demo.dur); }
  const bar=demoEl.querySelector('.d-bar i'); const tick=()=>{ if(!demo.on) return; if(!demo.paused){ bar.style.width=Math.min(100,(performance.now()-demo.t0)/demo.dur*100)+'%'; } demo.raf=requestAnimationFrame(tick); }; tick();
}
function demoStart(voice){
  demoList=demoSteps(); demo.on=true; demo.paused=false; demo.voice=!!voice&&!!window.speechSynthesis;
  document.body.classList.add('demo-on'); demoEl.hidden=false; document.getElementById('demoIntro').hidden=true;
  demoEl.querySelector('.d-voice').classList.toggle('on',demo.voice); demoEl.querySelector('.d-pause').textContent='一時停止';
  try{ if(typeof stopTour==='function') stopTour(); }catch(e){}
  demoShow(0);
}
function demoEnd(finished){
  clearTimeout(demo.timer); cancelAnimationFrame(demo.raf); try{ speechSynthesis?.cancel(); }catch(e){}
  const cur=demoList&&demoList[demo.i]; if(cur&&cur.z){ try{ cur.z(); }catch(e){} }
  demo.on=false; document.body.classList.remove('demo-on'); demoEl.hidden=true;
  try{ demoSite(); demoPlay(false); demoLook('classic'); twinState.diff=false; twinDrawOverlay(); exCamera('overall'); demoPanel(true); }catch(e){}
  toast(finished?'自動説明が終わりました。ここからは自由に操作できます（もう一度見るときは「▶ 自動説明」）':'自動説明を終了しました');
}
demoEl.querySelector('.d-next').onclick=()=>{ if(demo.i<demoList.length-1) demoShow(demo.i+1); else demoEnd(true); };
demoEl.querySelector('.d-prev').onclick=()=>demoShow(Math.max(0,demo.i-1));
demoEl.querySelector('.d-stop').onclick=()=>demoEnd(false);
demoEl.querySelector('.d-pause').onclick=e=>{
  demo.paused=!demo.paused; e.target.textContent=demo.paused?'再開':'一時停止';
  if(demo.paused){ clearTimeout(demo.timer); try{ speechSynthesis?.cancel(); }catch(er){} } else demoShow(demo.i);
};
demoEl.querySelector('.d-voice').onclick=e=>{ demo.voice=!demo.voice&&!!window.speechSynthesis; e.target.classList.toggle('on',demo.voice); if(!demo.voice){ try{ speechSynthesis.cancel(); }catch(er){} } else if(!demo.paused) demoShow(demo.i); };
document.getElementById('demoBtn').onclick=()=>{ if(demo.on) demoEnd(false); else document.getElementById('demoIntro').hidden=false; };
document.getElementById('demoGoVoice').onclick=()=>demoStart(true);
document.getElementById('demoGo').onclick=()=>demoStart(false);
document.getElementById('demoSkip').onclick=()=>{ document.getElementById('demoIntro').hidden=true; };
if(!window.speechSynthesis) document.getElementById('demoGoVoice').style.display='none';
window.__demo={start:demoStart,end:demoEnd,show:i=>demoShow(i),state:demo,count:()=> (demoList||demoSteps()).length};
if(window.__AUTO_DEMO) document.getElementById('demoIntro').hidden=false;
