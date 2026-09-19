/* ================= Jev AI Decision Layer — フロント側クライアント / Digital Twin State Manager =================
   Frontend → Backend API（/api/ai/*）→ Jev Adapter → Jev。ブラウザは Jev を直接呼ばず、API Key も持たない。
   ・Urban State（集約値のみ: camera / rendering / area / mobility / history / analysis）を作り、イベント駆動で /api/ai/evaluate に送る
     （毎フレーム呼ばない。都市全体 2.5〜10 秒、Attention 8 秒以上、Visualization はカメラ停止時、LOD は大きな状態変化時）
   ・優先順位 USER > AI > DEFAULT。ユーザーが表現・Budget を手で選んだら AI は上書きしない（「AI に任せる」で戻す）
   ・Point Budget は progressive refinement（2 秒ごとに 1 段。移動中は即時に下げる）
   ・API が落ちていても（OFFLINE）既存のローカル挙動（pointcloud.js の LOD / Budget）で動き続ける */
const AI = {
  enabled:true, status:'OFFLINE', bundle:null, attention:[], lastEval:0, lastAttention:0, inflight:false, err:'', log:[], reqCount:0, cacheHits:0, fallbacks:0,
  follow:'suggest',                                   // off | suggest | auto
  user:{viz:false, budget:false}, dev:false,
  budgetSteps:[100000,200000,350000,500000,750000,1000000], budgetTarget:null, lastBudgetStep:0,
  trig:{cam:null, lod:null, t:-1e9, sel:null, dens:0, fpsBand:'', dbWin:'', first:true}, minIntervalMs:2500, maxIntervalMs:10000, attentionIntervalMs:8000,
  hist:[], binHist:new Map(), lastFollowAt:0, banner:null, applied:{viz:null, budget:null, lod:null, pc:null}, lastUserInput:0, statusFetched:0, serverStatus:null
};
const AI_VIS_TO_MODE = { POINTS:'point', HEATMAP:'heat', GRID:'grid', HEXAGON:'hex', FLOW:'flow', TRIPS:'trips', CONTOUR:'contour', VOLUME:'point' };
const AI_LOD_TARGET = { LOD0:30000, LOD1:150000, LOD2:500000, LOD3:1000000, LOD4:1000000 };
function aiBase(){ return (typeof dbBase==='function') ? dbBase() : 'http://localhost:8000'; }
function aiMeanStd(arr){ const n=arr.length; if(!n) return [null,null]; const m=arr.reduce((a,b)=>a+b,0)/n; const v=arr.reduce((a,b)=>a+(b-m)*(b-m),0)/n; return [m, Math.sqrt(v)]; }
/* ---------- Urban State（個人情報・person_hash・生 GPS は含めない） ---------- */
function aiBins(){
  const G=100, bins=new Map();
  for(const a of agents){ if(!segByFilter(a.seg)) continue; const i=Math.floor(a.cur.x/G), j=Math.floor(a.cur.z/G); const k=i*4096+j; let b=bins.get(k); if(!b){ b={i,j,n:0,spd:0,nm:0,stay:0,ns:0}; bins.set(k,b); }
    b.n+=AG_SCALE; if(a.state==='move'){ b.spd+=a.sp/60; b.nm++; } if(a.tStop!=null){ b.stay+=timeState.min-a.tStop; b.ns++; } }
  return bins;
}
function aiSimFeatures(){
  const bins=aiBins(); let peak=0, sum=0, n=0; bins.forEach(b=>{ sum+=b.n; n++; if(b.n>peak) peak=b.n; });
  const people=agents.length*AG_SCALE; const avgD = n ? (sum/n)/200 : 0; const peakD=Math.min(1, peak/200);
  const h60=(typeof anaAt==='function')?anaAt(60):null, cur=ANA.hist[ANA.hist.length-1];
  const inflow=(cur&&h60)?(cur.arr-h60.arr)*AG_SCALE:0, outflow=(cur&&h60)?(cur.dep-h60.dep)*AG_SCALE:0;
  let staySum=0, stayN=0; for(const a of agents){ if(a.tStop!=null){ staySum+=timeState.min-a.tStop; stayN++; } }
  const area={meshCount:n, peopleCount:people, avgDensity:+avgD.toFixed(4), peakDensity:+peakD.toFixed(4)};
  const mobility={avgSpeed:+(ANA.speed||0).toFixed(3), avgStayMinutes:+(stayN?staySum/stayN:0).toFixed(1), inflow, outflow, movementRatio:+(agents.length?STATS.moving/agents.length:0).toFixed(3), stayRatio:+(agents.length?1-STATS.moving/agents.length:0).toFixed(3)};
  /* 履歴（このセッションで観測した値の平均・標準偏差） */
  AI.hist.push({people, dens:avgD, spd:mobility.avgSpeed, stay:mobility.avgStayMinutes, inflow, outflow}); if(AI.hist.length>120) AI.hist.shift();
  const H={}; if(AI.hist.length>=6){ const g=k=>aiMeanStd(AI.hist.map(h=>h[k])); const [pa,ps]=g('people'), [da,ds]=g('dens'), [sa,ss]=g('spd'), [ta,ts]=g('stay'), [ia,is]=g('inflow'), [oa,os]=g('outflow');
    Object.assign(H,{buckets:AI.hist.length, peopleAvg:pa, peopleStd:ps, densityAvg:da, densityStd:ds, speedAvg:sa, speedStd:ss, stayAvg:ta, stayStd:ts, inflowAvg:ia, inflowStd:is, outflowAvg:oa, outflowStd:os}); }
  /* Attention 候補: 人数上位 30 セル（履歴は per-bin の移動平均） */
  const cands=[...bins.values()].sort((a,b)=>b.n-a.n).slice(0,30).map(b=>{ const cx=(b.i+0.5)*100, cz=(b.j+0.5)*100; const ll=toLL(cx,cz); const key=b.i+','+b.j; let bh=AI.binHist.get(key); if(!bh){ bh=[]; AI.binHist.set(key,bh); } bh.push(b.n); if(bh.length>60) bh.shift(); const [pa,ps]=aiMeanStd(bh);
    return {meshId:'sim100:'+b.i+':'+b.j, name:(typeof nearPOI==='function' && nearPOI(cx,cz,160))||('G100-'+b.i+':'+b.j), lon:ll.lon, lat:ll.lat, features:{people:b.n, density:Math.min(1.5,b.n/200), speed:b.nm?b.spd/b.nm:0, stay:b.ns?b.stay/b.ns:0, inflow:0, outflow:0}, hist:{peopleAvg:pa, peopleStd:ps, densityAvg:pa/200, speedAvg:b.nm?b.spd/b.nm:0, stayAvg:b.ns?b.stay/b.ns:0}}; });
  return {area, mobility, history:H, candidates:cands};
}
function aiBuildState(){
  const P=window.twinPcl, db=(window.twinDb && twinDb.on && twinDb.health);
  const st={ timestamp:new Date().toISOString(), simTime:(typeof clockStr==='function')?clockStr(timeState.min):null,
    camera:{height:+ctrl.sph.radius.toFixed(0), moving:!!(P&&P.moving), pitch:+ctrl.sph.phi.toFixed(2)},
    rendering:{fps:+((typeof PERF!=='undefined'?PERF.fps:60).toFixed(1)), gpuMs:P&&P.gpu.ms?+P.gpu.ms.toFixed(1):null, visiblePoints:P?P.stats.visible:0, loadedPoints:P?P.count:0, memoryMb:performance.memory?+(performance.memory.usedJSHeapSize/1048576).toFixed(0):null, latencyMs:(db && twinDb.stat.points)?twinDb.stat.points.ms:null},
    analysis:{mode:(typeof FLOWVIS!=='undefined')?FLOWVIS.mode:'point', pcMode:P?P.mode:null, userOverride:AI.user.viz, level} };
  let cands=null;
  if(db){ st.source=twinDb.source; st.bbox=dbViewBBox(1.6); st.t=dbIso(timeState.min); }
  else { const f=aiSimFeatures(); st.area=f.area; st.mobility=f.mobility; if(Object.keys(f.history).length) st.history=f.history; cands=f.candidates; st.source='sim'; }
  return {state:st, candidates:cands, bbox:st.bbox, t:st.t, source:st.source};
}
/* ---------- State Change Trigger（この条件のときだけ再評価。それ以外は cache / 前回の判断） ---------- */
function aiFpsBand(f){ return f<25?'critical':f<30?'low':f>55?'high':'mid'; }
function aiShouldEval(now){
  const T=AI.trig; const dt=now-AI.lastEval; if(dt<AI.minIntervalMs) return false;
  const P=window.twinPcl; const cam={x:ctrl.target.x, z:ctrl.target.z, r:ctrl.sph.radius}; const reasons=[];
  if(T.first){ reasons.push('first'); }
  if(T.cam && !(P&&P.moving)){ const d=Math.hypot(cam.x-T.cam.x, cam.z-T.cam.z); if(d>T.cam.r*0.35) reasons.push('camera moved'); const rr=cam.r/T.cam.r; if(rr>1.35||rr<0.74) reasons.push('zoom'); }
  if(P && T.lod!==null && P.lod!==T.lod) reasons.push('lod crossed');
  if(Math.abs(timeState.min-T.t)>=5) reasons.push('time');
  const selKey=P&&P.sel?`${P.sel.x.toFixed(0)},${P.sel.z.toFixed(0)}`:''; if(selKey!==T.sel) reasons.push('selection');
  const fb=aiFpsBand(typeof PERF!=='undefined'?PERF.fps:60); if(T.fpsBand && fb!==T.fpsBand) reasons.push('fps band');
  const dw=P&&P.dbWin?`${P.dbWin.t0}|${P.dbWin.bb}|${P.dbWin.lod}`:''; if(dw!==T.dbWin) reasons.push('new data');
  if(dt>AI.maxIntervalMs && timeState.playing) reasons.push('periodic');
  if(!reasons.length) return false;
  if(P&&P.moving && !reasons.includes('fps band')) return false;   // カメラ移動中は評価しない（停止後に）
  T.cam=cam; T.lod=P?P.lod:null; T.t=timeState.min; T.sel=selKey; T.fpsBand=fb; T.dbWin=dw; T.first=false; AI.lastReasons=reasons; return true;
}
/* ---------- 評価（1 リクエストで複数 Question をまとめる） ---------- */
async function aiEvaluate(now){
  if(AI.inflight) return; AI.inflight=true; AI.lastEval=now;
  const req=aiBuildState(); const qs=['congestion','congestionScore','anomaly','lod','pointBudget','visualization','pointCloud']; const withAtt = now-AI.lastAttention>=AI.attentionIntervalMs; if(withAtt) qs.push('attention');
  const body={state:req.state, questions:qs, candidates:req.candidates||undefined, bbox:req.bbox, t:req.t, source:req.source, mode:AI.dev?'both':'auto'};
  const t0=performance.now();
  try{
    const ctrlr=new AbortController(); const timer=setTimeout(()=>ctrlr.abort(), 2500);
    const r=await fetch(aiBase()+'/api/ai/evaluate', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body), signal:ctrlr.signal}); clearTimeout(timer);
    if(!r.ok) throw new Error(r.status+' '+r.statusText);
    const b=await r.json(); b.clientLatencyMs=Math.round(performance.now()-t0); AI.bundle=b; AI.err=''; AI.reqCount++; if(b.meta.cacheHit) AI.cacheHits++; if(b.meta.source==='local') AI.fallbacks++;
    AI.status = b.meta.jevStatus==='mock' ? 'MOCK' : b.meta.jevStatus==='connected' ? 'CONNECTED' : b.meta.jevStatus==='disabled' ? 'DISABLED' : 'FALLBACK';
    if(withAtt){ AI.attention=b.attention||[]; AI.lastAttention=now; }
    AI.log.push({t:Date.now(), hash:b.meta.stateHash, latency:b.clientLatencyMs, server:b.meta.latencyMs, source:b.meta.source, cache:!!b.meta.cacheHit, reasons:AI.lastReasons, decisions:Object.fromEntries(Object.entries(b.decisions).map(([q,d])=>[q,{v:d.value,c:d.confidence,s:d.source,alt:d.alt}]))}); if(AI.log.length>50) AI.log.shift();
    aiApply(b, now);
  }catch(e){ AI.err=e.name==='AbortError'?'timeout':e.message; AI.status='OFFLINE'; AI.budgetTarget=null; if(window.twinPcl){ twinPcl.aiTarget=null; twinPcl.budget.auto=true; } }
  finally{ AI.inflight=false; renderPanel(); }
}
/* ---------- Digital Twin State Manager: 判断を表示状態へ（USER > AI > DEFAULT） ---------- */
function aiApply(b, now){
  const P=window.twinPcl; const d=b.decisions||{};
  /* LOD / Point Budget（progressive refinement は aiTick で） */
  if(d.pointBudget && !AI.user.budget){ AI.budgetTarget=+d.pointBudget.value; AI.applied.budget=d.pointBudget.value; }
  if(d.lod && P){ P.aiTarget=AI_LOD_TARGET[d.lod.value]||null; AI.applied.lod=d.lod.value; }
  /* Point Cloud AI Control */
  if(d.pointCloud && P){ const v=d.pointCloud.value||{}; P.trailQ=v.trailQuality||'HIGH'; P.softQ=v.softPointQuality||'HIGH'; P.pickAllowed=(v.pickable!==false); P.heatAI=!!v.heatmapOverlay; AI.applied.pc=v; if(typeof pclApplyMode==='function') pclApplyMode(); }
  /* Visualization Router（USER 優先。カメラ停止時のみ。Primary + Secondary） */
  if(d.visualization && !AI.user.viz && !(P&&P.moving) && level!=='wide'){
    const prim=d.visualization.value, sec=d.visualization.meta&&d.visualization.meta.secondary; const key=prim+'+'+(sec||'');
    if(AI.applied.viz!==key && d.visualization.confidence>=0.6){
      const mode=AI_VIS_TO_MODE[prim]||'point'; if(typeof FLOWVIS!=='undefined' && FLOWVIS.mode!==mode){ setFlowMode(mode); }
      if(P){ if(prim==='VOLUME' && P.mode!=='VOLUME') setPclMode('VOLUME'); else if(prim==='POINTS' && (P.mode==='VOLUME'||P.mode==='DENSITY')) setPclMode('SOFT'); }
      if(typeof setHeatV==='function' && typeof HEATV!=='undefined'){ if(sec==='HEATMAP' && mode!=='heat'){ if(!HEATV.on) setHeatV(true); if(HEATV.uni) HEATV.uni.uOpacity.value=0.32; AI.heatAuto=true; } else if(AI.heatAuto && mode!=='heat'){ setHeatV(false); AI.heatAuto=false; } }
      AI.applied.viz=key; if(typeof toast==='function') toast(`AI: 表現を ${prim}${sec?' + '+sec:''} に切替（${d.visualization.source}, 確信度 ${(d.visualization.confidence*100).toFixed(0)}%）。手動で選ぶとユーザー選択が優先されます`, 3600);
    }
  }
  /* Attention → AI FOLLOW */
  const top=AI.attention[0];
  if(top && top.score>=AI.followScore() && AI.follow!=='off'){
    if(AI.follow==='auto' && now-AI.lastFollowAt>20000 && now-AI.lastUserInput>5000 && !(P&&P.moving)){ aiFocus(top); AI.lastFollowAt=now; }
    else if(AI.follow==='suggest' && (!AI.banner || AI.banner.mesh!==top.mesh_id)){ AI.banner={mesh:top.mesh_id, name:top.name, score:top.score, at:now}; aiBanner(true); }
  } else if(AI.banner && (!top || top.score<AI.followScore())){ AI.banner=null; aiBanner(false); }
}
AI.followScore=()=> 85;
function aiFocus(a){ const p=toXZ(a.lat, a.lon); flyTo(new THREE.Vector3(p.x, TH(p.x,p.z), p.z), Math.min(ctrl.sph.radius, 700), 1.0, ctrl.sph.theta, 1400); if(typeof pclSelect==='function' && window.twinPcl && twinPcl.on) pclSelect(p.x, p.z, 120); if(typeof toast==='function') toast(`AI ATTENTION: ${a.name}（${a.kind}, ${a.score.toFixed(0)}）へフォーカス`, 2800); }
function aiBanner(on){
  let el=document.getElementById('ai-banner'); if(!el){ el=document.createElement('div'); el.id='ai-banner'; document.body.appendChild(el); el.onclick=()=>{ const a=AI.attention.find(x=>x.mesh_id===(AI.banner&&AI.banner.mesh)); if(a) aiFocus(a); AI.banner=null; aiBanner(false); }; }
  el.style.display = on ? 'block' : 'none'; if(on && AI.banner) el.innerHTML=`<b>High-priority flow detected</b> — ${AI.banner.name}（score ${AI.banner.score.toFixed(0)}）<span>クリックでフォーカス</span>`;
}
/* ---------- 毎フレーム（軽量）: progressive budget、トリガー判定 ---------- */
function aiTick(now){
  if(!AI.enabled) return; const P=window.twinPcl;
  if(P && AI.budgetTarget && !AI.user.budget && AI.status!=='OFFLINE'){
    P.budget.auto=false; const steps=AI.budgetSteps; const cur=P.budget.cur; const ci=steps.reduce((bi,s,i)=>Math.abs(s-cur)<Math.abs(steps[bi]-cur)?i:bi,0); const ti=steps.indexOf(AI.budgetTarget);
    if(ti>=0 && ti!==ci){ const down = ti<ci; if(down || now-AI.lastBudgetStep>2000){ P.budget.cur = steps[ci+(down?-1:1)]; AI.lastBudgetStep=now; } }
    if(P.moving && P.budget.cur>350000){ P.budget.cur=350000; }   // 移動中は即時に下げる
  }
  if(now-AI.statusFetched>30000){ AI.statusFetched=now; fetch(aiBase()+'/api/ai/status',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(j=>{ if(j){ AI.serverStatus=j; if(AI.status==='OFFLINE') AI.status=j.label==='DISABLED'?'DISABLED':'FALLBACK'; } }).catch(()=>{}); }
  if(aiShouldEval(now)) aiEvaluate(now);
}
/* ---------- パネル: AI STATE（コンパクト）/ AI ATTENTION / Developer ---------- */
function aiSec(){
  const b=AI.bundle, d=b?b.decisions:{}; const g=q=>d[q]||null; const cls={CONNECTED:'ok',MOCK:'ok',FALLBACK:'warn',DISABLED:'sub',OFFLINE:'warn'}[AI.status]||'sub';
  const an=g('anomaly'); const lvl=an&&an.meta&&an.meta.level?an.meta.level:(an?(an.value<0.5?'normal':an.value<0.7?'watch':an.value<0.85?'warning':'high'):'—');
  const vis=g('visualization'); const visTxt=vis?`${vis.value}${vis.meta&&vis.meta.secondary?' + '+vis.meta.secondary:''}`:'—';
  const conf=b?Math.min(...Object.values(d).map(x=>x.confidence)).toFixed(2):'—';
  const contrib=b&&b.contributions?Object.entries(b.contributions).filter(([k,v])=>v.pct!=null).map(([k,v])=>`<span class="ai-c">${k} <b style="color:${v.pct>0?'#ff9b90':'#8fe3c9'}">${v.pct>0?'+':''}${v.pct}%</b></span>`).join(''):'';
  const src=q=>{ const x=g(q); return x?`<small class="ai-src ${x.source.startsWith('jev')?'jev':x.source}">${x.source}</small>`:''; };
  return `<div class="sec ai-sec"><div class="sec-t"><b>AI STATE</b> — Jev Decision Layer <span class="ai-st ${cls}">${AI.status}</span>${AI.inflight?' <span class="ai-spin">…</span>':''}</div>
    <div class="ai-grid">
      <span>Congestion</span><b>${g('congestion')?g('congestion').value:'—'} ${src('congestion')}</b>
      <span>Score</span><b>${g('congestionScore')?'L'+g('congestionScore').value:'—'} ${src('congestionScore')}</b>
      <span>Anomaly</span><b>${an?an.value.toFixed(2)+' <small>'+lvl+'</small>':'—'} ${src('anomaly')}</b>
      <span>LOD</span><b>${g('lod')?g('lod').value:'—'} ${src('lod')}</b>
      <span>Point Budget</span><b>${g('pointBudget')?fmt(g('pointBudget').value):'—'} ${src('pointBudget')}</b>
      <span>Visualization</span><b>${visTxt} ${src('visualization')}</b>
      <span>Confidence</span><b>${conf}</b>
    </div>
    ${contrib?`<div class="ai-contrib">${contrib}</div>`:''}
    <div class="row-btns" style="margin-top:6px"><span class="hint" style="align-self:center">AI FOLLOW</span>${['off','suggest','auto'].map(f=>`<button class="chip ${AI.follow===f?'active':''}" data-ai-follow="${f}">${f==='off'?'OFF':f==='suggest'?'ON（提案）':'AUTO（自動移動）'}</button>`).join('')}${AI.user.viz||AI.user.budget?`<button class="chip active" data-ai-release="1">AI に任せる</button>`:''}<button class="chip ${AI.dev?'active':''}" data-ai-dev="1">Dev</button></div>
    <div class="hint" style="margin-top:4px">${AI.status==='OFFLINE'?`API 未接続（${AI.err||'…'}）。ローカル LOD/Budget で動作中`:AI.status==='DISABLED'?'JEV_ENABLED=false: Local Rule Engine が判断（同じ型）':AI.status==='MOCK'?'Jev mock provider（Interface 検証用の決定論的応答）':AI.status==='FALLBACK'?'Jev 未接続/timeout → Local Rule Engine':'Jev 接続中'}${AI.user.viz?'・表現はユーザー選択を優先中':''}${b&&b.meta.safety&&b.meta.safety.length?'・<span style="color:#ffd166">safety: '+b.meta.safety.join(' / ')+'</span>':''}</div>
    ${AI.dev?aiDevHTML():''}</div>`;
}
function aiAttentionSec(){
  const rows=AI.attention.slice(0,5);
  const ind=r=>({density:'Density',speed:'Speed',stay:'Stay',inflow:'Inflow',outflow:'Outflow'}[r.feature]||r.feature)+' '+(r.dir==='up'?'↑':'↓');
  return `<div class="sec"><div class="sec-t"><b>AI ATTENTION</b> — 注目エリア Top 5${rows.length?` <small style="color:var(--sub)">${rows[0].source}</small>`:''}</div>
    ${rows.length?rows.map(a=>`<div class="zone-row ai-att" data-ai-mesh="${a.mesh_id}" title="クリックでフォーカス"><div class="zn"><b style="color:var(--brex);font-family:var(--mono)">${String(a.rank).padStart(2,'0')}</b> ${a.name}<small>${a.kind}・${a.reasons.map(ind).join('・')||'—'}</small></div><div class="zv">${a.score.toFixed(0)}</div></div>`).join(''):'<div class="hint">評価待ち（DB モードは PostGIS の上位 30 メッシュ、シミュレーションは 100m ビン上位 30 を候補に評価）</div>'}
    <div class="hint" style="margin-top:4px">score＝密度・履歴偏差（z）・速度低下・滞在増・流入急増の合成（Jev Score または Local）。理由は実データの変化率（生成文ではありません）</div></div>`;
}
function aiDevHTML(){
  const s=AI.serverStatus; const t=s&&s.telemetry?s.telemetry:{}; const j=s&&s.jev?s.jev:{};
  const ab=AI.log.slice(-8).reverse().map(l=>`<tr><td>${new Date(l.t).toLocaleTimeString()}</td><td>${l.latency}ms</td><td>${l.source}${l.cache?'*':''}</td>${['congestion','lod','visualization','pointBudget'].map(q=>{ const d=l.decisions[q]; if(!d) return '<td>—</td>'; const alt=d.alt?` / ${d.alt.source}:${typeof d.alt.value==='number'&&d.alt.value>1000?fmt(d.alt.value):d.alt.value}`:''; return `<td>${d.s.startsWith('jev')?'jev':d.s}:${typeof d.v==='number'&&d.v>1000?fmt(d.v):d.v}${alt}</td>`; }).join('')}</tr>`).join('');
  return `<div class="ai-dev"><div class="sec-t">Developer — Jev latency ${j.lastLatencyMs!=null?j.lastLatencyMs+'ms':'—'} · requests ${t.requests||0} · jev calls ${t.jevCalls||0} · cache hits ${t.cacheHits||0} · fallbacks ${t.fallbacks||0} · client ${AI.reqCount} req / ${AI.cacheHits} cache · source ${AI.bundle?AI.bundle.meta.source:'—'} · hash ${AI.bundle?AI.bundle.meta.stateHash:'—'}</div>
    <div class="tbl-wrap"><table class="db ai-ab"><thead><tr><th>time</th><th>lat</th><th>src</th><th>congestion</th><th>lod</th><th>viz</th><th>budget</th></tr></thead><tbody>${ab||'<tr><td colspan="7">—</td></tr>'}</tbody></table></div>
    <div class="hint">A/B: 採用した判断 / もう一方（Jev ↔ Local）。Dev ON では mode=both で cache を使わず両方を評価。<button class="chip" data-ai-export="1">telemetry JSON</button></div></div>`;
}
function bindAi(){
  document.querySelectorAll('[data-ai-follow]').forEach(b=> b.onclick=()=>{ AI.follow=b.dataset.aiFollow; if(AI.follow!=='suggest'){ AI.banner=null; aiBanner(false); } renderPanel(); });
  document.querySelectorAll('[data-ai-release]').forEach(b=> b.onclick=()=>{ AI.user={viz:false, budget:false}; AI.applied.viz=null; renderPanel(); toast('表現・Budget の判断を AI に戻しました', 2200); });
  document.querySelectorAll('[data-ai-dev]').forEach(b=> b.onclick=()=>{ AI.dev=!AI.dev; renderPanel(); });
  document.querySelectorAll('[data-ai-mesh]').forEach(r=> r.onclick=()=>{ const a=AI.attention.find(x=>x.mesh_id===r.dataset.aiMesh); if(a) aiFocus(a); });
  document.querySelectorAll('[data-ai-export]').forEach(b=> b.onclick=()=>{ const blob=new Blob([JSON.stringify({client:AI.log, server:AI.serverStatus}, null, 1)], {type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='jev_telemetry.json'; a.click(); });
}
addEventListener('pointerdown', ()=>{ AI.lastUserInput=performance.now(); });
window.twinAi = AI; AI.evaluate = aiEvaluate; AI.build = aiBuildState; AI.focus = aiFocus;
