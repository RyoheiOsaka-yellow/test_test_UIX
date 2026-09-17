
/* ================================================================
   UI: パネル · チャート · 詳細カード · タイムライン
================================================================ */
let mode='flow'; const pb=$('panel-body');
const CSSV=(n)=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const THEME={txt:'#9fb0d0', grid:'rgba(255,255,255,.1)', bg:'#0b1f4b', now:'#2ec4c6', lbl:'#ffffff'};
const kpi=(v,l,cls='')=>`<div class="kpi ${cls}"><div class="v">${v}</div><div class="l">${l}</div></div>`;
const pct=(a,b)=>b>0?Math.round(a/b*100)+'%':'–';
function drawChart(cv, series, opt={}){
  if(!cv) return; const dpr=devicePixelRatio; const W=cv.width=(cv.clientWidth||300)*dpr, H=cv.height=(cv.clientHeight||66)*dpr; const g=cv.getContext('2d'); g.clearRect(0,0,W,H);
  const t1=Math.max(1,Math.floor(timeState.min)); const tmax=T_END; let max=opt.max||0;
  if(!max){ for(let i=0;i<=t1;i++){ let v=0; series.forEach(s=>{ v=opt.stacked?v+s.data[i]:Math.max(v,s.data[i]); }); if(v>max) max=v; } max=max*1.12||1; }
  const X=(t)=>t/tmax*W, Y=(v)=>H-4*dpr-(v/max)*(H-14*dpr);
  g.strokeStyle=THEME.grid; g.lineWidth=1; for(let h=180;h<tmax;h+=180){ g.beginPath(); g.moveTo(X(h),0); g.lineTo(X(h),H); g.stroke(); }
  const base=new Float32Array(T_END+1);
  series.forEach(s=>{ g.beginPath(); g.moveTo(X(0),Y(base[0])); for(let i=0;i<=t1;i++){ g.lineTo(X(i),Y((opt.stacked?base[i]:0)+s.data[i])); } if(opt.area||opt.stacked){ for(let i=t1;i>=0;i--) g.lineTo(X(i),Y(opt.stacked?base[i]:0)); g.closePath(); g.fillStyle=s.color+'66'; g.fill(); } g.strokeStyle=s.color; g.lineWidth=1.4*dpr; g.stroke(); if(opt.stacked) for(let i=0;i<=t1;i++) base[i]+=s.data[i]; });
  g.strokeStyle=THEME.now; g.lineWidth=1.2*dpr; g.beginPath(); g.moveTo(X(timeState.min),0); g.lineTo(X(timeState.min),H); g.stroke();
  g.fillStyle=THEME.txt; g.font=`700 ${9*dpr}px 'Noto Sans JP'`; g.textAlign='left'; g.fillText(opt.label||'',4*dpr,10*dpr); g.textAlign='right'; g.fillText(opt.fmt?opt.fmt(max/1.12):fmt(max/1.12),W-4*dpr,10*dpr);
  g.textAlign='left'; g.fillStyle='rgba(159,176,208,.7)'; g.font=`${7.5*dpr}px 'Noto Sans JP'`; [180,360,540,720,900].forEach(h=>g.fillText(clockStr(h),X(h)+2*dpr,H-3*dpr));
}
function drawBars(cv, items, opt={}){
  if(!cv) return; const dpr=devicePixelRatio; const W=cv.width=(cv.clientWidth||300)*dpr, H=cv.height=(cv.clientHeight||98)*dpr; const g=cv.getContext('2d'); g.clearRect(0,0,W,H);
  const max=opt.max||Math.max(...items.map(i=>i.v))*1.15||1; const n=items.length; const gap=4*dpr, bw=(W-gap*(n+1))/n; const top=14*dpr, bot=16*dpr;
  items.forEach((it,i)=>{ const h=(it.v/max)*(H-top-bot); const x=gap+i*(bw+gap); g.fillStyle=it.color||'#2ec4c6'; g.fillRect(x,H-bot-h,bw,h); g.fillStyle=THEME.lbl; g.font=`800 ${8*dpr}px 'Noto Sans JP'`; g.textAlign='center'; g.fillText(it.vl||fmt(it.v),x+bw/2,H-bot-h-3*dpr); g.fillStyle=THEME.txt; g.font=`${7.5*dpr}px 'Noto Sans JP'`; g.fillText(it.l,x+bw/2,H-4*dpr); });
}
function bar(name, v, max, color, d, hl){ const w=clamp(v/Math.max(1,max)*100,0,100); return `<div class="bar-row ${hl?'hl':''}" data-bar="${name}"><span class="nm" title="${name}">${name}</span><div class="bar"><i style="width:${w}%;background:${color}"></i></div><span class="d">${d}</span></div>`; }
function drawOD(cv){ if(!cv) return; const dpr=devicePixelRatio; const W=cv.width=(cv.clientWidth||300)*dpr, H=cv.height=(cv.clientHeight||150)*dpr; const g=cv.getContext('2d'); g.fillStyle=THEME.bg; g.fillRect(0,0,W,H);
  const rows=SEG.filter(s=>SEG_ARR[s.i]>0).sort((a,b)=>SEG_ARR[b.i]-SEG_ARR[a.i]).slice(0,10); const L=78*dpr, T=14*dpr; const cw=(W-L)/RET.length, rh=(H-T)/Math.max(1,rows.length); let max=1; rows.forEach(s=>RET.forEach((r,j)=>max=Math.max(max,OD[s.i*RET.length+j])));
  g.font=`${7*dpr}px 'Noto Sans JP'`; g.fillStyle=THEME.txt; g.textAlign='center'; RET.forEach((r,j)=>g.fillText(r.name.replace(/\(.*\)|方面|へ/g,'').slice(0,5), L+cw*(j+0.5), 9*dpr));
  rows.forEach((s,i)=>{ g.textAlign='right'; g.fillStyle=THEME.txt; g.fillText(s.name.replace(/\(.*\)/,'').slice(0,8), L-3*dpr, T+rh*(i+0.65)); RET.forEach((r,j)=>{ const v=OD[s.i*RET.length+j]; const k=v/max; g.fillStyle=`rgba(46,196,198,${0.08+k*0.9})`; g.fillRect(L+cw*j+1, T+rh*i+1, cw-2, rh-2); if(v>0&&rh>9*dpr){ g.fillStyle=k>0.5?'#0b1f4b':'#fff'; g.textAlign='center'; g.font=`700 ${7*dpr}px 'Noto Sans JP'`; g.fillText(fmt(v*PER_AGENT), L+cw*(j+0.5), T+rh*(i+0.68)); g.font=`${7*dpr}px 'Noto Sans JP'`; } }); }); }
function drawTrans(cv){ if(!cv) return; const dpr=devicePixelRatio; const W=cv.width=(cv.clientWidth||300)*dpr, H=cv.height=(cv.clientHeight||150)*dpr; const g=cv.getContext('2d'); g.fillStyle=THEME.bg; g.fillRect(0,0,W,H);
  const ids=['sannomaru','castle','kokoen','zoo','art','hist','miyuki','station','shosha']; const sp=ids.map(id=>SP[id]); const L=54*dpr, T=14*dpr; const cw=(W-L)/sp.length, rh=(H-T)/sp.length; let max=1; sp.forEach(a=>sp.forEach(b=>max=Math.max(max,TRANS[a.i*SPOTS.length+b.i])));
  g.font=`${6.5*dpr}px 'Noto Sans JP'`; g.fillStyle=THEME.txt; g.textAlign='center'; sp.forEach((s,j)=>g.fillText(s.name.replace(/\(.*\)|周辺|商店街|・大手門/g,'').slice(0,4), L+cw*(j+0.5), 9*dpr));
  sp.forEach((a,i)=>{ g.textAlign='right'; g.fillStyle=THEME.txt; g.fillText(a.name.replace(/\(.*\)|周辺|商店街|・大手門/g,'').slice(0,5), L-3*dpr, T+rh*(i+0.65)); sp.forEach((b,j)=>{ const v=TRANS[a.i*SPOTS.length+b.i]; const k=v/max; g.fillStyle=i===j?'rgba(255,255,255,.04)':`rgba(245,158,11,${0.06+k*0.9})`; g.fillRect(L+cw*j+1,T+rh*i+1,cw-2,rh-2); }); }); g.fillStyle='rgba(159,176,208,.8)'; g.textAlign='left'; g.fillText('行: 前地点 → 列: 次地点', 2*dpr, H-3*dpr); }

/* ---------- 集計ヘルパ ---------- */
function totals(){ let arrived=0, inb=0, stay=0, gone=0, castleCum=SP.castle.cum; for(let i=0;i<nextArr;i++){ const a=AG[i]; if(a.st===0) continue; if(!isActive(a)) continue; arrived++; if(a.grp==='in') inb++; if(a.stay) stay++; if(a.st===9) gone++; } return {arrived, inb, stay, gone, castleCum}; }
function spendTotal(){ return SPEND.fee+SPEND.food+SPEND.shop+SPEND.stay+SPEND.trans; }
const sec=(t,body,id='',fold=false)=>`<div class="sec ${fold?'fold':''}" ${id?`id="${id}"`:''}><div class="sec-t" onclick="this.parentElement.classList.toggle('fold')">${t}</div>${body}</div>`;
const chips=(items,cur,attr)=>`<div class="row-btns">${items.map(it=>`<button class="chip sm ${it[0]===cur?'active':''}" data-${attr}="${it[0]}">${it[1]}</button>`).join('')}</div>`;
const NOTE_SYN='<div class="note">※ 数値は公表統計に合わせて校正した合成シミュレーション値。DB接続後に実測値へ置換。</div>';

/* ---------- パネル (モード別) ---------- */
function renderPanel(){
  const t=timeState.min, T=totals(); let h='';
  if(mode==='flow'){
    h+=sec('👥 人流 <b>· 現在の滞在</b>', `<div class="kpi-grid">${kpi(fmt(inCity*PER_AGENT),'市内滞在中(観光目的)','c-blue')}${kpi(fmt((SP.castle.cnt+castleQ.length)*PER_AGENT),'城内(待ち列含む)','c-warn')}${kpi(fmt(T.arrived*PER_AGENT),'本日の来訪(累計)')}${kpi(Math.round(castleWait)+'<small>分</small>','大天守 待ち時間(推定)',castleWait>30?'c-warn':'c-ok')}</div>
      <canvas class="mini-chart tall" id="ch-flow"></canvas><div class="legend" style="flex-direction:row;gap:12px;margin-top:4px"><span class="li"><i class="sw" style="background:#1a5ed9"></i>市内滞在</span><span class="li"><i class="sw" style="background:#e11d74"></i>城内</span><span class="li"><i class="sw" style="background:#2ec4c6"></i>うちインバウンド</span></div>`);
    h+=sec('🎨 人の色分け', chips([['grp','国内 / インバウンド'],['seg','来訪元(国・地域)'],['trip','日帰り / 宿泊'],['state','行動状態'],['mode','入域手段'],['ret','帰路先']],colorMode,'col')+`<div id="col-legend" style="margin-top:6px"></div>`);
    h+=sec('📍 地点別 滞留人数 <b>· 今</b>', SPOTS.filter(s=>s.id!=='otemae').sort((a,b)=>b.cnt-a.cnt).slice(0,9).map(s=>bar(s.name.replace(/\(.*\)/,''), s.cnt, Math.max(...SPOTS.map(x=>x.cnt),1), KIND_COL[s.kind], fmt(s.cnt*PER_AGENT)+'人')).join('')+`<div class="hint" style="margin-top:6px">ヒートマップ: ${chips([['now','現在'],['cum','累計(滞留の履歴)']],heatMode,'heat')}<div class="grad-bar" style="margin-top:6px"></div><div class="grad-lbl"><span>少</span><span>密度ランク</span><span>多</span></div></div>`);
    const peakS=SPOTS.filter(s=>s.id!=='otemae').sort((a,b)=>b.cnt-a.cnt)[0];
    h+=`<div class="insight"><b>インサイト</b> · ${clockStr(t)} 時点で最も人が集まっているのは <b>${peakS.name}</b>(${fmt(peakS.cnt*PER_AGENT)}人)。${castleWait>20?`大天守の待ち時間が <b>${Math.round(castleWait)}分</b>。整理券の発行タイミングと好古園・商店街への誘導で分散が可能。`:'城内の待ちは小さく、商店街・駅前への回遊余地があります。'}</div>`+NOTE_SYN;
  }
  else if(mode==='origin'){
    const inN=T.inb, domN=T.arrived-T.inb; const top=SEG.slice().sort((a,b)=>SEG_ARR[b.i]-SEG_ARR[a.i]);
    h+=sec('🌏 来訪元 <b>· 誰が・どこから</b>', `<div class="kpi-grid">${kpi(pct(inN,T.arrived),'インバウンド比率(本日)','c-bim')}${kpi(fmt(inN*PER_AGENT),'インバウンド来訪者')}${kpi(fmt(domN*PER_AGENT),'国内来訪者','c-blue')}${kpi(top[0]?top[0].name.replace(/\(.*\)/,''):'–','最多の来訪元')}</div>
      <canvas class="mini-chart" id="ch-org"></canvas><div class="legend" style="flex-direction:row;gap:12px;margin-top:4px"><span class="li"><i class="sw" style="background:#1a5ed9"></i>国内 到着/分</span><span class="li"><i class="sw" style="background:#2ec4c6"></i>インバウンド 到着/分</span></div>`);
    h+=sec('🌐 国・地域別 <span class="pill in">インバウンド</span>', SEG_IN.slice().sort((a,b)=>SEG_ARR[b.i]-SEG_ARR[a.i]).map(s=>bar(s.flag+' '+s.name.replace(/\(.*\)/,''), SEG_ARR[s.i], Math.max(1,SEG_ARR[top[0].i]), s.col, fmt(SEG_ARR[s.i]*PER_AGENT)+'人 · '+pct(SEG_ARR[s.i],inN))).join(''));
    h+=sec('🗾 居住地別 <span class="pill dom">国内</span>', SEG_DOM.slice().sort((a,b)=>SEG_ARR[b.i]-SEG_ARR[a.i]).map(s=>bar(s.flag+' '+s.name.replace(/\(.*\)/,''), SEG_ARR[s.i], Math.max(1,SEG_ARR[top[0].i]), s.col, fmt(SEG_ARR[s.i]*PER_AGENT)+'人 · '+pct(SEG_ARR[s.i],domN))).join(''));
    h+=sec('🛬 経由地', `<div class="hint">海外からは <b>関西国際空港</b> または <b>成田・羽田→新幹線</b> 経由で、多くが <b>大阪・京都を拠点に日帰り</b>で来訪。国内遠方(関東・東海・九州)は新幹線が主。<div class="row-btns" style="margin-top:6px"><button class="chip sm" data-act="region">広域ビューで弧線を見る</button><button class="chip sm ${arcsOn?'active':''}" data-act="arcs">OD弧 ${arcsOn?'ON':'OFF'}</button></div></div>`);
    h+=`<div class="insight"><b>校正元</b> · 姫路市観光動向調査(令和6年度)の姫路城地点: 外国人は台湾13.6% / 米国12.8% / 豪州11.7% / 中国11.1% / 仏約9.5%、日本人は近畿34.4% / 関東22.8% / 東海15.2%。FY2025 外国人比率 34.9%(547,426人 / 1,567,674人)。</div>`;
  }
  else if(mode==='access'){
    h+=sec('🚉 入域手段 <b>· 本日</b>', `<div class="kpi-grid">${MODES.map((m,i)=>kpi(fmt(MODE_ARR[i]*PER_AGENT),m,i===0?'c-blue':(i===2?'c-num':''))).join('')}${kpi(pct(MODE_ARR[0]+MODE_ARR[1],T.arrived),'鉄道シェア','c-ok')}</div><canvas class="mini-chart" id="ch-mode"></canvas>`);
    h+=sec('🅿 駐車場・バス乗降場 <b>· 稼働</b>', GATES.filter(g=>g.kind!=='rail').map(g=>{ const k=g.occ/g.cap; return `<div class="gcard" data-gate="${g.id}"><div class="hd">${g.name}<span class="tg" style="background:${k>0.95?'#fca5a5':(k>0.7?'#fde68a':'#bbf7d0')}">${g.kind==='bus'?'台':'台'} ${fmt(g.occ)} / ${fmt(g.cap)}</span></div><div class="kv"><div>入庫累計<b>${fmt(g.cumIn)}</b></div><div>出庫累計<b>${fmt(g.cumOut)}</b></div><div>ピーク<b>${fmt(g.peak)}</b></div></div><div class="stack"><i style="width:${clamp(k*100,0,100)}%;background:${k>0.95?'#d92d20':(k>0.7?'#f59e0b':'#17a05e')}"></i></div></div>`; }).join(''));
    h+=sec('🚄 姫路駅', `<div class="stat-row"><span>新幹線口 到着(累計)</span><b>${fmt(GATES[0].cumIn*PER_AGENT)}<small>人</small></b></div><div class="stat-row"><span>在来線・山陽電車 到着(累計)</span><b>${fmt(GATES[1].cumIn*PER_AGENT)}<small>人</small></b></div><div class="stat-row"><span>駅からの出発(累計)</span><b>${fmt((GATES[0].cumOut+GATES[1].cumOut)*PER_AGENT)}<small>人</small></b></div><div class="stat-row"><span>ループバス・高速バス</span><b>${fmt(GATES[7].cumIn*PER_AGENT)}<small>人</small></b></div>`);
    h+=`<div class="insight"><b>校正元</b> · 動向調査(姫路城地点): 日本人は JR在来線40.6% / 新幹線32.0% / 自家用車31.6%(複数回答)、外国人は JR在来線71.9% / 新幹線56.0%。姫路城周辺駐車場は城の北(約530台)・大手門(約555台)ほか。ループバス乗車 FY2024 70,072人。</div>`+NOTE_SYN;
  }
  else if(mode==='dwell'){
    const rows=SPOTS.filter(s=>s.id!=='otemae').sort((a,b)=>b.cum-a.cum);
    h+=sec('⏱ 滞留 <b>· どこに・どれだけ</b>', `<div class="kpi-grid">${kpi(fmt(SP.castle.cum*PER_AGENT),'入城者(累計)','c-warn')}${kpi((SP.castle.dwellN?Math.round(SP.castle.dwellSum/SP.castle.dwellN):0)+'<small>分</small>','城内 平均滞留')}${kpi(fmt(SP.miyuki.cum*PER_AGENT),'商店街 立寄り(累計)','c-num')}${kpi(pct(SP.kokoen.cum,SP.castle.cum),'入城者の好古園 併訪率','c-ok')}</div>
      <div class="tbl"><table><thead><tr><th>地点</th><th>今</th><th>累計</th><th>平均滞留</th><th>ピーク</th></tr></thead><tbody>${rows.map(s=>`<tr data-spot="${s.id}"><td><i class="sw" style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${KIND_COL[s.kind]};margin-right:5px"></i>${s.name.replace(/\(.*\)/,'')}</td><td>${fmt(s.cnt*PER_AGENT)}</td><td>${fmt(s.cum*PER_AGENT)}</td><td>${s.dwellN?Math.round(s.dwellSum/s.dwellN)+'分':'–'}</td><td>${s.peak?clockStr(s.peakT):'–'}</td></tr>`).join('')}</tbody></table></div>`);
    h+=sec('🔥 ヒートマップ', chips([['now','現在の密度'],['cum','累計(足あと)']],heatMode,'heat')+`<div class="grad-bar" style="margin-top:6px"></div><div class="grad-lbl"><span>少</span><span>25 m メッシュ · ランク</span><span>多</span></div>`);
    h+=sec('🔁 地点間の遷移 <b>· どこからどこへ</b>', `<canvas class="od-cv" id="ch-trans"></canvas>`);
    const seqs=Object.entries(SEQ).sort((a,b)=>b[1]-a[1]).slice(0,6); const nm=(id)=>SP[id]?SP[id].name.replace(/\(.*\)|周辺|商店街|・大手門/g,''):id;
    h+=sec('🧭 周遊パターン <b>· 上位</b>', seqs.length?seqs.map(([k,v])=>`<div class="stat-row"><span style="color:var(--navy);font-size:10px">${k.split('→').map(nm).join(' → ')}</span><b>${fmt(v*PER_AGENT)}<small>人</small></b></div>`).join(''):'<div class="note">帰路に着いた来訪者が出ると集計されます</div>');
    h+=`<div class="insight"><b>インサイト</b> · 城→好古園→商店街 の回遊が作れると市内消費が伸びる。滞在時間の実測は市の調査項目になく(総務省実証では「30分層」と「3時間層」の二極)、DBで<b>滞在時間の分布</b>を継続計測することが提案の核。</div>`+NOTE_SYN;
  }
  else if(mode==='stay'){
    const stayN=T.stay, dayN=T.arrived-T.stay; let hc=0, rooms=0, booked=0; HOTELS.forEach(x=>{ hc+=x.cnt; rooms+=x.rooms; booked+=x.booked; });
    h+=sec('🏨 宿泊・日帰り <b>· どこへ帰る</b>', `<div class="kpi-grid">${kpi(pct(dayN,T.arrived),'日帰り(市外へ帰還)','c-num')}${kpi(pct(stayN,T.arrived),'姫路市内 宿泊','c-vip')}${kpi(fmt(stayN*PER_AGENT),'宿泊者数(本日)')}${kpi(pct(booked*PER_AGENT/2.1,rooms),'客室稼働(推定 2.1人/室)','c-ok')}</div><canvas class="mini-chart" id="ch-stay"></canvas><div class="legend" style="flex-direction:row;gap:12px;margin-top:4px"><span class="li"><i class="sw" style="background:#8a93a3"></i>日帰り 滞在中</span><span class="li"><i class="sw" style="background:#f59e0b"></i>宿泊者 滞在中</span><span class="li"><i class="sw" style="background:#c026d3"></i>ホテル内</span></div>`);
    h+=sec('🧭 帰路先 <b>· 出発済み</b>', RET.map((r,i)=>bar(r.name, RET_CNT[i], Math.max(1,...RET_CNT), r.col, fmt(RET_CNT[i]*PER_AGENT)+'人 · '+pct(RET_CNT[i],T.gone))).join('')+`<div class="row-btns" style="margin-top:6px"><button class="chip sm ${arcMode==='in'?'active':''}" data-arc="in">来訪の弧</button><button class="chip sm ${arcMode==='out'?'active':''}" data-arc="out">帰路の弧</button><button class="chip sm ${arcMode==='both'?'active':''}" data-arc="both">両方</button><button class="chip sm" data-act="region">広域ビュー</button></div>`);
    h+=sec('🔀 来訪元 × 帰路先 <b>· ODマトリクス</b>', `<canvas class="od-cv" id="ch-od"></canvas>`);
    h+=sec('🛏 市内宿泊施設', HOTELS.map(x=>bar(x.name.replace(/ホテル/g,'').slice(0,12), x.cnt, Math.max(1,...HOTELS.map(y=>y.cnt),1), '#c026d3', fmt(x.cnt*PER_AGENT)+'人 / '+x.rooms+'室')).join(''), '', true);
    h+=`<div class="insight"><b>通過型の構造</b> · 動向調査では外国人の市内宿泊は <b>13.9%</b>(市外宿泊 86.1%)、日本人(姫路城地点)は日帰り37.1% / 宿泊62.9%のうち市内宿泊48.5%。帰路は<b>大阪</b>(外国人53.9%・日本人44.6%)が最多。夜間コンテンツ(ライトアップ・夜間開城)と二次交通で宿泊転換を狙う余地。</div>`+NOTE_SYN;
  }
  else if(mode==='spend'){
    const tot=spendTotal(); const per=T.arrived?tot/(T.arrived*PER_AGENT):0; const cats=[['fee','入城・入園料','#e11d74'],['food','飲食','#f59e0b'],['shop','土産・買物','#17a05e'],['stay','宿泊','#c026d3'],['trans','市内交通ほか','#1a5ed9']];
    h+=sec('💴 観光消費 <b>· 市内(本日)</b>', `<div class="kpi-grid">${kpi(man(tot),'市内消費額(累計)','c-num')}${kpi(yen(per),'1人あたり')}${kpi(man(SPEND.fee),'縦覧料等 収入','c-warn')}${kpi(man(SPEND.stay),'宿泊消費','c-vip')}</div><canvas class="mini-chart" id="ch-spend"></canvas>`);
    h+=sec('🧾 カテゴリ別', cats.map(c=>bar(c[1], SPEND[c[0]], Math.max(1,...cats.map(x=>SPEND[x[0]])), c[2], man(SPEND[c[0]]))).join('')+`<div class="stack" style="height:12px;margin-top:8px">${cats.map(c=>`<i style="width:${tot?SPEND[c[0]]/tot*100:0}%;background:${c[2]}"></i>`).join('')}</div>`);
    h+=sec('🏬 地点別 売上(推定)', SPOTS.filter(s=>s.sales>0).sort((a,b)=>b.sales-a.sales).slice(0,7).map(s=>bar(s.name.replace(/\(.*\)/,''), s.sales, Math.max(1,...SPOTS.map(x=>x.sales)), KIND_COL[s.kind], man(s.sales))).join(''));
    h+=`<div class="insight"><b>校正元</b> · 動向調査(姫路城地点 1人あたり市内消費): 日本人 宿泊費4,600円 / 飲食4,644円 / 土産3,269円 / 入場料1,134円、外国人 飲食5,968円 / 土産2,799円。2026年3月から市民以外の縦覧料 <b>2,500円</b>(3〜5月の縦覧料収入 8.3億円 · 前年比2.1倍)。</div>`+NOTE_SYN;
  }
  else if(mode==='db'){
    h+=sec('🗄 姫路市 観光DB <b>· データ構成イメージ</b>', `
      <div class="db-layer"><div class="dl-t"><i style="background:#1a5ed9"></i>① 基盤 (国土交通省)</div><div class="db-items"><span class="db-item mlit">地理院タイル 淡色地図</span><span class="db-item mlit">全国最新写真</span><span class="db-item mlit">標高タイル DEM10B</span><span class="db-item mlit">国土数値情報(観光資源・道路・鉄道・バス停)</span><span class="db-item mlit">PLATEAU 姫路市 3D都市モデル(2023年度整備済)</span><span class="db-item mlit">全国都市交通特性調査</span></div></div><div class="db-arrow">▼</div>
      <div class="db-layer"><div class="dl-t"><i style="background:#17a05e"></i>② 統計・公的データ</div><div class="db-items"><span class="db-item gov">姫路城 日別入城者数(国内/外国人)</span><span class="db-item gov">姫路市 観光動向調査(居住地・国籍・宿泊・消費)</span><span class="db-item gov">兵庫県 観光客動態調査</span><span class="db-item gov">観光庁 宿泊旅行統計 / 訪日消費動向</span><span class="db-item gov">JNTO 訪日外客統計</span><span class="db-item gov">DMO 宿泊施設動向調査(31施設 4,619室)</span></div></div><div class="db-arrow">▼</div>
      <div class="db-layer"><div class="dl-t"><i style="background:#f59e0b"></i>③ 人流・行動データ (民間・センサー)</div><div class="db-items"><span class="db-item priv">携帯位置情報(キャリア / GPSアプリ 500 mメッシュ・OD)</span><span class="db-item priv">Wi-Fi パケットセンサー(商店街・大手前通り)</span><span class="db-item priv">3Dカメラ人数計測(駅・大手門)</span><span class="db-item priv">デジタルチケット(国別購入・入城時刻)</span><span class="db-item priv">駐車場 入出庫 / バス予約</span><span class="db-item priv">クレカ・QR決済(訪日外国人 消費)</span><span class="db-item priv">ロープウェイ・ループバス乗車</span></div></div><div class="db-arrow">▼</div>
      <div class="db-layer"><div class="dl-t"><i style="background:#7c3aed"></i>④ 統合DB → アウトプット</div><div class="db-items"><span class="db-item own">来訪者ODテーブル(誰が・どこから・どこへ)</span><span class="db-item own">滞留テーブル(地点 × 時間 × 属性)</span><span class="db-item own">消費・宿泊テーブル</span><span class="db-item own">このダッシュボード</span><span class="db-item own">月次レポート / 提案書 図版</span><span class="db-item own">API(DMO・事業者向け)</span></div></div>`);
    const a=AG.slice(0,nextArr).filter(x=>x.st!==0 && x.zones.length).slice(-4);
    h+=sec('🧬 来訪者ODレコード <b>· スキーマ例</b>', `<div class="schema"><b>visitor_od</b>(
  <i>visitor_id</i>      text   -- 匿名ID(ハッシュ)
  origin_region   text   -- 来訪元(国/都道府県)
  origin_type     text   -- inbound / domestic
  gateway         text   -- 入域: 新幹線/在来線/車/バス
  gateway_node    text   -- 姫路駅/駐車場/IC
  t_in, t_out     time   -- 入域・出域時刻
  trip_type       text   -- day / stay
  hotel_id        text   -- 宿泊施設(市内)
  return_dest     text   -- 帰路先
  spend_jpy       int    -- 市内消費(推定)
)
<b>visitor_stay</b>(visitor_id, <i>spot_id</i>, t_enter, t_leave, dwell_min)
<b>spot_hourly</b>(spot_id, hour, count, share_inbound, avg_dwell)</div>
      <div class="tbl" style="margin-top:6px"><table><thead><tr><th>visitor_id</th><th>origin</th><th>gateway</th><th>t_in</th><th>spots</th><th>ret</th></tr></thead><tbody>${a.map(x=>`<tr data-agent="${x.i}"><td>${x.id}</td><td>${x.seg.name.replace(/\(.*\)/,'').slice(0,6)}</td><td>${MODES[x.mi].slice(0,3)}</td><td>${clockStr(x.tArrived||x.tArr)}</td><td>${x.zones.length}</td><td>${RET[x.ret].name.slice(0,4)}</td></tr>`).join('')}</tbody></table></div>
      <div class="row-btns" style="margin-top:6px"><button class="chip sm" data-act="csv-od">⬇ ODレコード CSV</button><button class="chip sm" data-act="csv-spot">⬇ 地点×時間 CSV</button></div>`);
    h+=sec('📶 計測点 <b>· '+SENSORS.length+' 箇所</b>', `<div class="row-btns" style="margin-bottom:6px"><button class="chip sm ${rxGroup.visible?'active':''}" data-act="rx">3Dで計測点を表示</button></div>`+SENSORS.map(s=>`<div class="wb" data-sensor="${s.id}"><span class="id">${s.id}</span><span class="st">${s.name} · ${s.type}</span><b style="font-family:var(--mono);font-size:10px">${fmt(s.detMin)}/5分</b></div>`).join(''), '', false);
    h+=`<div class="insight"><b>先行事例</b> · 総務省の実証(2024)では姫路市街地でGPS由来の非集計ODデータを用い来街頻度・滞在時間・回遊を分析。姫路DMOは日別入城者・宿泊施設調査・デジタルチケットの国別購入データを公開・活用中。<b>これらを1つのDBに束ね、常時更新の可視化にする</b>のが本提案の位置づけ。</div>`;
  }
  else if(mode==='numbers'){
    h+=sec('📊 姫路城 入城者数 <b>· 年度推移</b>', `<canvas class="mini-chart tall" id="ch-fy"></canvas><div class="stat-row"><span>FY2025 総入城者</span><b>1,567,674<small>人</small></b></div><div class="stat-row"><span>うち外国人 (比率)</span><b>547,426<small>人 · 34.9%</small></b></div><div class="stat-row"><span>FY2015 (グランドオープン · 過去最多)</span><b>2,867,051<small>人</small></b></div><div class="stat-row"><span>FY2019 外国人比率</span><b>25.5%</b></div><div class="note">出典: 姫路市 報道発表 / 神戸新聞 / 令和6年度 姫路市入込客数・観光動向調査報告書</div>`);
    h+=sec('📅 FY2025 月別入城者 <b>· 千人</b>', `<canvas class="mini-chart tall" id="ch-month"></canvas><div class="note">ピークは4月(200千 · 夜桜含む)、11月(179千)、10月(164千)。閑散は1月(87千)。7月は外国人比率45.9%で最高。</div>`);
    h+=sec('🌏 外国人 国・地域別 <b>· 姫路城地点</b>', [['台湾',13.6,'#2ec4c6'],['米国',12.8,'#16a085'],['豪州',11.7,'#48c9b0'],['中国',11.1,'#22a3a5'],['フランス',9.5,'#1abc9c'],['カナダ',4.2,'#16a085'],['英国',3.9,'#1abc9c'],['スペイン',3.0,'#1abc9c'],['イタリア',2.2,'#1abc9c'],['シンガポール',2.0,'#0e7490'],['韓国',1.5,'#5ee0e2']].map(r=>bar(r[0],r[1],13.6,r[2],r[1]+'%')).join('')+'<div class="note">出典: 令和6年度 姫路市観光動向調査(対面 n=359)。デジタルチケット国別(2026年3〜4月): 米3,339 / 独1,598 / 英1,244 / 仏1,185 / 豪996。</div>');
    h+=sec('🗾 日本人 居住地 <b>· 姫路城地点</b>', [['近畿',34.4,'#1a5ed9'],['関東',22.8,'#6f4fd6'],['東海',15.2,'#8b6ee0'],['九州・沖縄',9.0,'#f59e0b'],['中国',8.7,'#b45309'],['北海道・東北',5.1,'#a78bfa'],['四国',4.3,'#ea580c']].map(r=>bar(r[0],r[1],34.4,r[2],r[1]+'%')).join('')+'<div class="note">近畿の内訳: 大阪41.1% / 兵庫41.0%(市外34.5%) / 滋賀5.4% / 京都5.4% / 奈良4.1%。前後の訪問地: 大阪(後44.6%)・岡山(後20.3%)。</div>');
    h+=sec('🏨 宿泊・通過型', `<div class="stat-row"><span>外国人 市内宿泊 / 市外宿泊</span><b>13.9%<small>/ 86.1%</small></b></div><div class="stat-row"><span>日本人(城) 日帰り / 宿泊</span><b>37.1%<small>/ 62.9%(市内48.5%)</small></b></div><div class="stat-row"><span>中播磨 日帰り率(県動態調査 R6)</span><b>83.4%</b></div><div class="stat-row"><span>市内宿泊施設 (DMO調査)</span><b>31<small>施設 · 4,619室</small></b></div><div class="stat-row"><span>延べ宿泊者 FY2024</span><b>1,280,702<small>人 · 外国人 +30.3%</small></b></div><div class="stat-row"><span>戦略プランKPI 客室稼働率</span><b>70%<small>/月 以上</small></b></div>`);
    h+=sec('💴 消費・料金', `<div class="stat-row"><span>日本人(城) 市内消費 宿泊/飲食/土産/入場</span><b style="font-size:10.5px">4,600 / 4,644 / 3,269 / 1,134円</b></div><div class="stat-row"><span>外国人(城) 飲食/土産/入場</span><b style="font-size:10.5px">5,968 / 2,799 / 1,167円</b></div><div class="stat-row"><span>中播磨 観光消費額 (R6)</span><b>1,542<small>億円</small></b></div><div class="stat-row"><span>縦覧料 2026.3.1〜 市民以外 / 市民</span><b>2,500<small>/ 1,000円</small></b></div><div class="stat-row"><span>改定後 3〜5月 入城者 / 収入</span><b>−17.4%<small>/ 8.3億円(2.1倍)</small></b></div><div class="stat-row"><span>保存活用計画 10年事業費</span><b>約280<small>億円(縦覧料 213億円想定)</small></b></div>`);
    h+=sec('🏛 周辺施設 FY2024 <b>· 千人</b>', [['好古園',580,'#17a05e'],['姫路セントラルパーク',525,'#65a30d'],['動物園',379,'#65a30d'],['アクリエひめじ',456,'#1a5ed9'],['水族館',264,'#1a5ed9'],['書寫山圓教寺',186,'#b45309'],['美術館',87,'#7c3aed'],['文学館',76,'#7c3aed'],['太陽公園',67,'#65a30d'],['県立歴史博物館',57,'#7c3aed']].map(r=>bar(r[0],r[1],580,r[2],r[1]+'千人')).join('')+'<div class="note">姫路市 総入込客数 FY2024 923.2万人(観光施設487.9万 / まつり242.2万 / スポーツ・自然193.1万)。城周辺ゾーンが55.6%。ループバス 70,072人、姫ちゃり 75,130回。</div>','',true);
    h+=`<div class="hint" style="margin-top:6px"><b>出典</b> · 姫路市「令和6年度 姫路市入込客数・観光動向調査」 · 姫路市 報道発表(2026-04-24 FY2025入城者数) · 兵庫県 観光客動態調査(令和6年度) · 観光庁 二重価格研究会 姫路市資料 · 神戸新聞・日経 報道 · 姫路観光コンベンションビューロー(DMO) 宿泊施設動向調査 · 国土地理院 地理院タイル</div>`;
  }
  else if(mode==='lab'){ h+=renderLab(); }
  const st=pb.scrollTop; pb.innerHTML=h; pb.scrollTop=st; bindPanel(); drawPanelCharts();
}
function drawPanelCharts(){
  const T=totals();
  if(mode==='flow'){ drawChart($('ch-flow'),[{data:HIST.inCity,color:'#1a5ed9'},{data:HIST.inCastle,color:'#e11d74'}],{label:'滞在人数(エージェント) · 06:00→24:00'}); renderColLegend(); }
  if(mode==='origin'){ const sm=(arr)=>{ const o=new Float32Array(T_END+1); for(let i=0;i<=T_END;i++){ let s=0; for(let k=-7;k<=7;k++){ const j=i+k; if(j>=0&&j<=T_END) s+=arr[j]; } o[i]=s/15*PER_AGENT; } return o; }; drawChart($('ch-org'),[{data:sm(HIST.arrDom),color:'#1a5ed9'},{data:sm(HIST.arrIn),color:'#2ec4c6'}],{label:'到着 人/分 (15分移動平均)',stacked:true}); }
  if(mode==='access'){ drawBars($('ch-mode'), MODES.map((m,i)=>({l:m,v:MODE_ARR[i]*PER_AGENT,color:MODE_COL[i]}))); }
  if(mode==='dwell'){ drawTrans($('ch-trans')); }
  if(mode==='stay'){ drawChart($('ch-stay'),[{data:HIST.dayIn,color:'#8a93a3'},{data:HIST.stayIn,color:'#f59e0b'},{data:HIST.hotel,color:'#c026d3'}],{label:'滞在中(エージェント)'}); drawOD($('ch-od')); }
  if(mode==='spend'){ drawChart($('ch-spend'),[{data:HIST.spend,color:'#f59e0b'}],{label:'市内消費 累計',area:true,fmt:man}); }
  if(mode==='numbers'){ drawBars($('ch-fy'),[{l:'FY2015',v:2867,vl:'2,867千'},{l:'FY2019',v:1548,vl:'1,548千'},{l:'FY2023',v:1480,vl:'1,480千'},{l:'FY2024',v:1532,vl:'1,532千'},{l:'FY2025',v:1568,vl:'1,568千',color:'#2ec4c6'}].map(x=>({...x,color:x.color||'#9dbaf0'})));
    const M=[[4,200,84],[5,157,63],[6,103,35],[7,92,42],[8,129,40],[9,114,40],[10,164,61],[11,179,50],[12,92,30],[1,87,28],[2,107,31],[3,146,43]]; drawBars($('ch-month'), M.map(m=>({l:m[0]+'月',v:m[1],vl:String(m[1]),color:m[2]/m[1]>0.4?'#2ec4c6':'#9dbaf0'}))); }
  if(mode==='lab') drawLabCharts();
}
function renderColLegend(){ const L=$('col-legend'); if(!L) return; let items=[];
  if(colorMode==='seg') items=SEG.map(s=>[s.col,s.flag+' '+s.name.replace(/\(.*\)/,'')]); else if(colorMode==='grp') items=[['#1a5ed9','国内'],['#2ec4c6','インバウンド']]; else if(colorMode==='trip') items=[['#8a93a3','日帰り(市外へ帰還)'],['#f59e0b','姫路市内に宿泊']]; else if(colorMode==='state') items=[['#ffffff','移動中'],['#17a05e','滞留中'],['#e11d74','大天守 待ち列'],['#c026d3','ホテル内'],['#f59e0b','帰路へ']]; else if(colorMode==='mode') items=MODES.map((m,i)=>[MODE_COL[i],m]); else if(colorMode==='ret') items=RET.map(r=>[r.col,r.name]);
  L.innerHTML=`<div class="legend" style="display:grid;grid-template-columns:1fr 1fr;gap:3px 8px">${items.map(i=>`<span class="li"><i class="sw" style="background:${i[0]};border:1px solid #d5dbe6"></i>${i[1]}</span>`).join('')}</div>`; }
function bindPanel(){
  pb.querySelectorAll('[data-col]').forEach(b=>b.onclick=()=>{ colorMode=b.dataset.col; renderPanel(); });
  pb.querySelectorAll('[data-heat]').forEach(b=>b.onclick=()=>{ heatMode=b.dataset.heat; repaintHeat(); renderPanel(); });
  pb.querySelectorAll('[data-arc]').forEach(b=>b.onclick=()=>{ arcMode=b.dataset.arc; if(!arcsOn) setArcs(true); renderPanel(); });
  pb.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{ const a=b.dataset.act; if(a==='region') setView('region'); if(a==='arcs'){ setArcs(!arcsOn); renderPanel(); } if(a==='rx'){ rxGroup.visible=!rxGroup.visible; renderPanel(); } if(a==='csv-od') exportOD(); if(a==='csv-spot') exportSpot(); });
  pb.querySelectorAll('[data-spot]').forEach(r=>r.onclick=()=>{ const s=SP[r.dataset.spot]; showDetail({kind:'spot',ref:s}); flyTo([s.x,hAt(s.x,s.z),s.z], Math.max(300,s.r*5), 1.0, ctrl.sph.theta, 1200); });
  pb.querySelectorAll('[data-gate]').forEach(r=>r.onclick=()=>{ const g=GATES.find(x=>x.id===r.dataset.gate); showDetail({kind:'gate',ref:g}); flyTo([g.x,hAt(g.x,g.z),g.z], 320, 1.0, ctrl.sph.theta, 1200); });
  pb.querySelectorAll('[data-sensor]').forEach(r=>r.onclick=()=>{ const s=SENSORS.find(x=>x.id===r.dataset.sensor); rxGroup.visible=true; showDetail({kind:'sensor',ref:s}); flyTo([s.x,hAt(s.x,s.z),s.z], s.virt?3000:260, 1.0, ctrl.sph.theta, 1200); });
  pb.querySelectorAll('[data-agent]').forEach(r=>r.onclick=()=>{ selectAgent(AG[+r.dataset.agent]); });
  pb.querySelectorAll('[data-bar]').forEach(r=>r.onclick=()=>{ const nm=r.dataset.bar; const s=SPOTS.find(x=>x.name.replace(/\(.*\)/,'')===nm); if(s){ showDetail({kind:'spot',ref:s}); flyTo([s.x,hAt(s.x,s.z),s.z], Math.max(300,s.r*5), 1.0, ctrl.sph.theta, 1200); } });
  bindLab();
}
let lastPanelRender=0;
function updatePanel(force){ if(force || performance.now()-lastPanelRender>700){ lastPanelRender=performance.now(); renderPanel(); } }

/* ---------- シナリオ・ラボ ---------- */
const LAB={night:0, bus:0, price:2500, inbound:0, rooms:0};
function labCalc(L){ const V=DAYS[curDay].n*PER_AGENT*(1+L.inbound/100*0.35); const priceK=clamp(1-0.55*((L.price-2500)/2500),0.4,1.6); const C=V*0.80*priceK; const stayBase=0.20; const stayRate=clamp(stayBase+L.night/100*0.6+L.bus/100*0.15,0,0.6); const rooms=4619+L.rooms; const S=Math.min(V*stayRate, rooms*2.1*0.92); const periph=0.45+L.bus/100*0.5; const spend=C*L.price+V*(2800+1900*(1+L.bus/100*0.4)+2000)+S*11000+V*periph*400; const peakIn=C*0.25; const rate=30*60; const wait=Math.max(0,(peakIn-rate)/30); const rev=1567674*priceK*L.price*(0.72); return {V,C,S,stayRate,spend,wait,rev,periph}; }
function renderLab(){ const B=labCalc({night:0,bus:0,price:2500,inbound:0,rooms:0}), X=labCalc(LAB); const d=(a,b,f=fmt,inv=false)=>{ const k=b-a; const up=k>0; const good=inv?!up:up; return `<span class="diff ${good?'dn':'up'}">${k===0?'±0':(up?'+':'−')+f(Math.abs(k))}</span>`; };
  const row=(k,l,min,max,step,fmtV)=>`<div class="lab-row"><span class="nm">${l}</span><input type="range" data-lab="${k}" min="${min}" max="${max}" step="${step}" value="${LAB[k]}"><b>${fmtV(LAB[k])}</b></div>`;
  let h=sec('🧪 シナリオ・ラボ <b>· 施策の効果試算</b>', `<div class="hint">スライダーで施策を変えると、本日の想定来訪(${DAYS[curDay].label.split('·')[1]})に対する効果を簡易モデルで試算します。</div>
    ${row('night','夜間開城・ライトアップ(宿泊転換)',0,25,1,v=>'+'+v+'pt')}${row('bus','二次交通・周遊バス増便',0,100,5,v=>'+'+v+'%')}${row('price','縦覧料(市民以外)',1000,3500,100,v=>yen(v))}${row('inbound','インバウンド誘客(大阪・関空発)',0,50,5,v=>'+'+v+'%')}${row('rooms','客室供給(新規ホテル)',0,800,50,v=>'+'+v+'室')}
    <div class="row-btns" style="margin-top:8px"><button class="lab-btn sec" data-labreset="1" style="width:auto;padding:7px 14px">リセット</button></div>`);
  h+=sec('📈 試算結果 <b>· ベース比</b>', `<div class="kpi-grid">${kpi(fmt(X.C)+' '+d(B.C,X.C),'入城者/日')}${kpi(fmt(X.S)+' '+d(B.S,X.S),'市内宿泊者/日','c-vip')}${kpi(man(X.spend)+' '+d(B.spend,X.spend,man),'市内消費/日','c-num')}${kpi(Math.round(X.wait)+'分 '+d(B.wait,X.wait,v=>Math.round(v)+'分',true),'大天守 最大待ち',X.wait>45?'c-warn':'c-ok')}${kpi(Math.round(X.stayRate*100)+'% '+d(Math.round(B.stayRate*100),Math.round(X.stayRate*100),v=>v+'pt'),'宿泊率')}${kpi((X.rev/1e8).toFixed(1)+'億円 '+d(B.rev,X.rev,v=>(v/1e8).toFixed(1)+'億'),'年間 縦覧料収入(概算)','c-warn')}</div><canvas class="mini-chart tall" id="ch-lab"></canvas>`);
  h+=`<div class="insight"><b>示唆</b> · 姫路の課題は「入城者は多いが泊まらない・回遊しない」通過型。縦覧料改定(2,500円)で入城者は約2割減でも収入は倍増しており、次の一手は<b>滞在時間と宿泊率</b>を伸ばす施策。DBがあれば、この試算を<b>実測値で検証・更新</b>できます。</div><div class="note">※ 簡易モデル(弾力性・転換率は仮定値)。提案書では前提を明記のうえ使用。</div>`;
  return h; }
function drawLabCharts(){ const B=labCalc({night:0,bus:0,price:2500,inbound:0,rooms:0}), X=labCalc(LAB); drawBars($('ch-lab'),[{l:'入城者(ベース)',v:B.C,color:'#9dbaf0'},{l:'入城者(施策)',v:X.C,color:'#1a5ed9'},{l:'宿泊(ベース)',v:B.S,color:'#e9b8ff'},{l:'宿泊(施策)',v:X.S,color:'#c026d3'},{l:'消費万円(ベース)',v:B.spend/1e4,color:'#fde68a',vl:fmt(B.spend/1e4)},{l:'消費万円(施策)',v:X.spend/1e4,color:'#f59e0b',vl:fmt(X.spend/1e4)}]); }
function bindLab(){ pb.querySelectorAll('[data-lab]').forEach(i=>i.oninput=()=>{ LAB[i.dataset.lab]=+i.value; renderPanel(); }); pb.querySelectorAll('[data-labreset]').forEach(b=>b.onclick=()=>{ Object.assign(LAB,{night:0,bus:0,price:2500,inbound:0,rooms:0}); renderPanel(); }); }

/* ---------- 詳細カード ---------- */
const detail=$('detail'), detailBody=$('detail-body'); let curDetail=null;
$('detail-x').onclick=()=>{ detail.style.display='none'; curDetail=null; if(hlAgent){ hlAgent=null; } };
const PHOTO_IMG={}; function photoImg(k){ if(!PHOTO_IMG[k]){ const im=new Image(); im.src=IMG[k]; PHOTO_IMG[k]=im; } return PHOTO_IMG[k]; }
function aerial(x,z,span=260){ const inCore=Math.abs(x-CORE.cx)<CORE.w/2-span/2 && Math.abs(z-CORE.cz)<CORE.h/2-span/2; const im=photoImg(inCore?'photo17':'photo15'); if(!im.complete||!im.naturalWidth) return ''; const sw=inCore?CORE.w:MOS.size, sh=inCore?CORE.h:MOS.size, cx=inCore?CORE.cx:MOS.cx, cz=inCore?CORE.cz:MOS.cz; const sc=im.naturalWidth/sw; const px=(x-(cx-sw/2))*sc, py=(z-(cz-sh/2))*sc; const w=span*sc, hh=span*0.66*sc; const c=cvs(300,198); const g=c.getContext('2d'); g.drawImage(im, px-w/2, py-hh/2, w, hh, 0,0,300,198); g.strokeStyle='#e11d74'; g.lineWidth=2; g.beginPath(); g.arc(150,99,14,0,6.283); g.stroke(); return `<img src="${c.toDataURL('image/jpeg',0.8)}" alt=""><div class="cap">航空写真: 国土地理院 全国最新写真(シームレス) · 表示範囲 約${span} m</div>`; }
const dkv=(k,v)=>`<div class="dkv"><span>${k}</span><b>${v}</b></div>`;
function showDetail(info){ curDetail=info; detail.style.display='block'; updateDetail(); }
function updateDetail(){ if(!curDetail) return; const r=curDetail.ref; let h='';
  if(curDetail.kind==='spot'){ const top=SEG.map(s=>[s,r.bySeg[s.i]]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,5); const inb=SEG_IN.reduce((a,s)=>a+r.bySeg[s.i],0);
    h=`<div class="nm">${r.name}<span class="tag" style="background:${KIND_COL[r.kind]};color:#fff">${KIND_JP[r.kind]}</span></div><div class="meta">${r.desc||''}</div>${aerial(r.x,r.z,r.r*3+120)}
      ${dkv('現在の滞留',fmt(r.cnt*PER_AGENT)+' 人')}${dkv('本日累計',fmt(r.cum*PER_AGENT)+' 人')}${dkv('平均滞留時間',(r.dwellN?Math.round(r.dwellSum/r.dwellN):0)+' 分')}${dkv('ピーク',r.peak?clockStr(r.peakT)+' · '+fmt(r.peak*PER_AGENT)+'人':'–')}${dkv('インバウンド比率',pct(inb,r.cum))}${r.sales?dkv('売上(推定)',man(r.sales)):''}
      <div class="sec-t" style="margin-top:8px">来訪元 上位</div>${top.map(x=>bar(x[0].flag+' '+x[0].name.replace(/\(.*\)/,''), x[1], top[0][1], x[0].col, fmt(x[1]*PER_AGENT)+'人')).join('')||'<div class="note">まだ来訪がありません</div>'}`; }
  else if(curDetail.kind==='gate'){ h=`<div class="nm">${r.name}</div><div class="meta">${r.kind==='rail'?'鉄道による入域点。新幹線・在来線・山陽電車':(r.kind==='park'?'自家用車の入域点(駐車場)':'観光バス・路線バスの乗降場')}</div>${aerial(r.x,r.z,220)}${dkv('到着(累計)',fmt(r.cumIn*PER_AGENT)+' 人')}${dkv('出発(累計)',fmt(r.cumOut*PER_AGENT)+' 人')}${r.kind!=='rail'?dkv('現在の台数(推定)',fmt(r.occ)+' / '+fmt(r.cap)+' 台'):''}${r.kind!=='rail'?dkv('ピーク台数',fmt(r.peak)):''}${dkv('主な手段',MODES[r.mode])}`; }
  else if(curDetail.kind==='hotel'){ h=`<div class="nm">${r.name}<span class="tag" style="background:#c026d3;color:#fff">宿泊</span></div><div class="meta">市内宿泊施設(客室数は概数)。宿泊者は夕食後にチェックインし、翌日は城または周辺へ。</div>${aerial(r.x,r.z,220)}${dkv('客室数(概数)',r.rooms+' 室')}${dkv('本日の予約(推定)',fmt(r.booked*PER_AGENT)+' 人')}${dkv('現在の館内',fmt(r.cnt*PER_AGENT)+' 人')}${dkv('稼働率(推定)',pct(r.booked*PER_AGENT/2.1,r.rooms))}`; }
  else if(curDetail.kind==='sensor'){ h=`<div class="nm">${r.id} · ${r.name}</div><div class="meta">${r.type}${r.virt?' · 市域全体の滞在人口を500 mメッシュで把握(携帯位置情報)':' · 半径 '+r.r+' m 圏の通過・滞留を計測'}</div>${r.virt?'':aerial(r.x,r.z,200)}${dkv('直近5分の検知',fmt(r.detMin)+' 人')}${dkv('本日累計',fmt(r.det)+' 人·5分')}${dkv('更新頻度',r.virt?'日次(前日分)':'1分')}${dkv('個人情報',r.virt?'匿名化・集計済':'ハッシュ化MAC / 非画像')}<div class="schema" style="margin-top:8px"><b>sensor_count</b>(sensor_id, ts, in, out, dwell_avg)</div>`; }
  else if(curDetail.kind==='region'){ const segs=SEG.filter(s=>(s.grp==='dom'&&s.node===r.id)||(s.grp==='in'&&((s.via==='tokyo'&&r.id==='tokyo')||(s.via!=='tokyo'&&r.id==='kix')))); const arr=segs.reduce((a,s)=>a+SEG_ARR[s.i],0); const ri=RET.findIndex(x=>RET_NODE[x.id]===r.id);
    h=`<div class="nm">${r.name}</div><div class="meta">${r.sub} · 姫路まで約${r.km} km</div>${dkv('ここを発地とする来訪(本日)',fmt(arr*PER_AGENT)+' 人')}${ri>=0?dkv('ここへ帰る来訪者(出発済)',fmt(RET_CNT[ri]*PER_AGENT)+' 人'):''}<div class="sec-t" style="margin-top:8px">発地の内訳</div>${segs.map(s=>bar(s.flag+' '+s.name.replace(/\(.*\)/,''),SEG_ARR[s.i],Math.max(1,...segs.map(x=>SEG_ARR[x.i])),s.col,fmt(SEG_ARR[s.i]*PER_AGENT)+'人')).join('')}`; }
  else if(curDetail.kind==='abroad'){ const s=r.seg; h=`<div class="nm">${r.name}</div><div class="meta">経由: ${s.via==='tokyo'?'成田・羽田 → 新幹線':'関西国際空港 → 大阪・京都拠点'} · 市内宿泊率(想定) ${Math.round(s.stay*100)}%</div>${dkv('本日の来訪',fmt(SEG_ARR[s.i]*PER_AGENT)+' 人')}${dkv('入域手段(主)',MODES[s.mode.indexOf(Math.max(...s.mode))])}<div class="sec-t" style="margin-top:8px">帰路先</div>${RET.map((x,j)=>[x,OD[s.i*RET.length+j]]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).map(x=>bar(x[0].name,x[1],Math.max(1,...RET.map((y,j)=>OD[s.i*RET.length+j])),x[0].col,fmt(x[1]*PER_AGENT)+'人')).join('')||'<div class="note">まだ出発していません</div>'}`; }
  else if(curDetail.kind==='agent'){ h=agentCard(r); }
  detailBody.innerHTML=h; detailBody.querySelectorAll('[data-follow]').forEach(b=>b.onclick=()=>{ followAgent=!followAgent; updateDetail(); }); }
let followAgent=false;
function agentCard(a){ const stS={0:'到着前',1:'移動中',2:'滞留中',3:'ホテル滞在',4:'大天守 待ち列',8:'帰路へ',9:'出域済'}[a.st]; const sp=a.spend; const tot=sp.fee+sp.food+sp.shop+sp.stay+sp.trans;
  return `<div class="nm">${a.id}<span class="pill ${a.grp==='in'?'in':'dom'}">${a.grp==='in'?'インバウンド':'国内'}</span><span class="pill ${a.stay?'stay':'day'}">${a.stay?'市内宿泊':'日帰り'}</span></div><div class="meta">来訪者カード(匿名ID) · ${a.party}人グループ · ${a.age} · 状態: <b>${stS}</b></div>
    ${dkv('来訪元',a.seg.flag+' '+a.seg.name)}${dkv('入域手段',MODES[a.mi]+' → '+GATES[a.gate].name)}${dkv('到着',clockStr(a.tArrived||a.tArr))}${a.stay?dkv('宿泊',HOTELS[a.hotel].name):dkv('帰路先',RET[a.ret].name)}${dkv('市内消費(推定・1人)',yen(tot)+(tot?` <span style="font-weight:500;color:var(--sub)">(入場${yen(sp.fee)} 飲食${yen(sp.food)} 買物${yen(sp.shop)}${sp.stay?' 宿泊'+yen(sp.stay):''})</span>`:''))}
    <div class="sec-t" style="margin-top:8px">周遊ログ(visitor_stay)</div><div class="log">${a.zones.length?a.zones.map(z=>`${clockStr(z[0])}–${z[1]>=T_END?'翌日':clockStr(z[1])}  <b>${z[2]}</b>  ${z[1]>=T_END?'':Math.round(z[1]-z[0])+'分'}`).join('\n'):'(まだ滞留記録なし)'}${a.cur?`\n${clockStr(a.tIn)}–  <b>${a.cur.name}</b>  滞留中`:''}</div>
    <div class="sec-t" style="margin-top:8px">予定ルート</div><div class="note">${a.plan.map((l,i)=>`<span style="${i<=a.pi?'color:var(--blue);font-weight:700':''}">${l.hotel?l.hotel.name:l.s.name.replace(/\(.*\)/,'')}</span>`).join(' → ')} → ${GATES[a.gate].name.replace(/\(.*\)/,'')}</div>
    <div class="row-btns" style="margin-top:8px"><button class="chip sm ${followAgent?'active':''}" data-follow="1">📍 追従カメラ ${followAgent?'ON':'OFF'}</button></div>`; }
function selectAgent(a){ hlAgent=a; if(!a.hist) a.hist=[]; showDetail({kind:'agent',ref:a}); toast(`${a.id} を選択 · ${a.seg.name} · ${a.stay?'市内宿泊':'日帰り'}`); }

/* ---------- ピッキング / ホバー ---------- */
const ray=new THREE.Raycaster(), mouse=new THREE.Vector2(); const tip=$('tip'); let lastHover=0, downAt=null;
function visChain(o){ while(o){ if(!o.visible) return false; o=o.parent; } return true; }
function pick(e){ mouse.x=(e.clientX/innerWidth)*2-1; mouse.y=-(e.clientY/innerHeight)*2+1; ray.setFromCamera(mouse,camera); const hits=ray.intersectObjects(pickables,false).filter(h=>visChain(h.object)); return hits.length?hits[0].object.userData.info:null; }
function pickAgent(e){ mouse.x=(e.clientX/innerWidth)*2-1; mouse.y=-(e.clientY/innerHeight)*2+1; ray.setFromCamera(mouse,camera); const hits=ray.intersectObject(agMesh,false); if(!hits.length) return null; const id=hits[0].instanceId; let n=0; for(let i=0;i<nextArr;i++){ const a=AG[i]; if(a.st===0||a.st===9) continue; if(n===id) return a; n++; } return null; }
el.addEventListener('pointermove', e=>{ if(performance.now()-lastHover<70 || ctrl.rotating || ctrl.panning) return; lastHover=performance.now(); const info=pick(e); if(!info){ tip.style.display='none'; el.style.cursor='default'; return; } el.style.cursor='pointer'; const r=info.ref; let s='';
  if(info.kind==='spot') s=`<b>${r.name}</b><div class="s">${fmt(r.cnt*PER_AGENT)}人 滞留中 · 累計 ${fmt(r.cum*PER_AGENT)}人${r.id==='castle'&&castleWait>1?` · 待ち ${Math.round(castleWait)}分`:''}</div>`;
  else if(info.kind==='gate') s=`<b>${r.name}</b><div class="s">到着 ${fmt(r.cumIn*PER_AGENT)}人${r.kind!=='rail'?` · ${fmt(r.occ)}/${fmt(r.cap)}台`:''}</div>`;
  else if(info.kind==='hotel') s=`<b>${r.name}</b><div class="s">${r.rooms}室 · 館内 ${fmt(r.cnt*PER_AGENT)}人</div>`;
  else if(info.kind==='sensor') s=`<b>${r.id} ${r.name}</b><div class="s">${r.type} · ${fmt(r.detMin)}人/5分</div>`;
  else if(info.kind==='region'||info.kind==='abroad') s=`<b>${r.name}</b><div class="s">${r.sub||'海外発地'} · クリックで内訳</div>`;
  tip.innerHTML=s; tip.style.display='block'; tip.style.left=(e.clientX+14)+'px'; tip.style.top=(e.clientY+14)+'px'; });
el.addEventListener('pointerdown', e=>{ downAt=[e.clientX,e.clientY]; });
el.addEventListener('pointerup', e=>{ if(!downAt || Math.hypot(e.clientX-downAt[0],e.clientY-downAt[1])>5) return; const info=pick(e); if(info){ showDetail(info); return; } const a=pickAgent(e); if(a) selectAgent(a); });

/* ---------- タイムライン ---------- */
const clockEl=$('tl-clock'), phaseEl=$('tl-phase'), slider=$('tl-slider'), playBtn=$('tl-play');
function syncClock(){ const t=timeState.min; clockEl.innerHTML=clockStr(t)+`<small>${DAYS[curDay].sub}</small>`; phaseEl.textContent=phaseAt(t); slider.value=Math.floor(t); $('tl-now').style.left=(t/T_END*100)+'%'; }
playBtn.onclick=()=>{ timeState.playing=!timeState.playing; playBtn.textContent=timeState.playing?'❚❚ 一時停止':'▶ 再生'; };
$('tl-reset').onclick=()=>{ resetSim(); seekTo(150); repaintHeat(); syncClock(); updatePanel(true); };
slider.oninput=()=>{ const v=+slider.value; seekTo(v); repaintHeat(); syncClock(); updatePanel(true); updateDetail(); };
document.querySelectorAll('#tl-speed .chip').forEach(c=>c.onclick=()=>{ timeState.speed=+c.dataset.sp; document.querySelectorAll('#tl-speed .chip').forEach(x=>x.classList.toggle('active',x===c)); });
/* 開城時間帯バー */
(function(){ const box=$('tl-sets'); const add=(a,b,col,top,label)=>{ const d=document.createElement('div'); d.className='tl-set'; d.style.cssText=`left:${a/T_END*100}%;width:${(b-a)/T_END*100}%;top:${top}px;background:${col}`; d.title=label; box.appendChild(d); };
  add(180,660,'#e11d74',6,'姫路城 開城 09:00–17:00 (最終入城 16:00)'); add(180,600,'#17a05e',16,'好古園 09:00–17:00'); add(150,780,'#f59e0b',26,'商店街・飲食 8:30〜19:00'); add(720,1080,'#c026d3',34,'ホテル チェックイン〜');
  $('tl-setlbl').innerHTML=`<span><i style="background:#e11d74"></i>姫路城 09:00–17:00</span><span><i style="background:#17a05e"></i>好古園</span><span><i style="background:#f59e0b"></i>商店街・飲食</span><span><i style="background:#c026d3"></i>宿泊</span>`; })();

/* ---------- モード / トグル / キー ---------- */
function setMode(m){ mode=m; document.querySelectorAll('#toolbar [data-m]').forEach(c=>c.classList.toggle('active',c.dataset.m===m));
  rxGroup.visible=(m==='db'); if(m==='origin'||m==='stay'){ if(!arcsOn) setArcs(true); arcMode=m==='stay'?'out':'in'; } if(m==='origin') colorMode='seg'; if(m==='stay') colorMode='trip'; if(m==='access') colorMode='mode'; if(m==='flow'&&(colorMode==='mode'||colorMode==='ret')) colorMode='grp';
  renderPanel(); }
document.querySelectorAll('#toolbar [data-m]').forEach(c=>c.onclick=()=>setMode(c.dataset.m));
$('tg-heat').onclick=()=>{ heatPlane.visible=!heatPlane.visible; $('tg-heat').classList.toggle('active',heatPlane.visible); if(heatPlane.visible) repaintHeat(); };
$('tg-label').onclick=()=>{ labels.visible=!labels.visible; $('tg-label').classList.toggle('active',labels.visible); };
$('tg-arc').onclick=()=>setArcs(!arcsOn);
$('tg-bld').onclick=()=>{ bld.visible=!bld.visible; $('tg-bld').classList.toggle('active',bld.visible); };
$('tg-veh').onclick=()=>{ vehGroup.visible=!vehGroup.visible; $('tg-veh').classList.toggle('active',vehGroup.visible); };
$('tg-terr').onclick=()=>setTerrEx(terrEx===1);
$('panel-toggle').onclick=()=>{ $('panel').classList.add('collapsed'); $('panel-tab').style.display='block'; };
$('panel-tab').onclick=()=>{ $('panel').classList.remove('collapsed'); $('panel-tab').style.display='none'; };
$('help-btn').onclick=()=>{ $('help').style.display='block'; }; $('help-x').onclick=()=>{ $('help').style.display='none'; }; $('help').onclick=e=>{ if(e.target.id==='help') $('help').style.display='none'; };
const MODE_KEYS=['flow','origin','access','dwell','stay','spend','db','numbers','lab'];
addEventListener('keydown', e=>{ if(e.target.tagName==='INPUT') return; const k=e.key.toLowerCase();
  if(e.code==='Space'){ e.preventDefault(); playBtn.click(); } else if(k>='1'&&k<='9'){ setMode(MODE_KEYS[+k-1]); } else if(k==='t'){ startTour(); } else if(k==='s'){ saveShot(); } else if(k==='h'){ $('tg-heat').click(); } else if(k==='a'){ setArcs(!arcsOn); } else if(k==='m'){ setMap(mapMode==='pale'?'photo':(mapMode==='photo'?'none':'pale')); } else if(k==='escape'){ $('help').style.display='none'; if(tourIdx>=0) stopTour(); } });

/* ---------- ミニマップ ---------- */
const mm=$('mm-cv'), mg=mm.getContext('2d'); let mmBase=null;
function drawMinimapBase(){ const im=photoImg(mapMode==='photo'?'photo15':'pale15'); const c=cvs(220,220); const g=c.getContext('2d'); if(im.complete&&im.naturalWidth){ g.drawImage(im,0,0,220,220); if(mapMode==='none'){ g.fillStyle='rgba(227,232,238,.9)'; g.fillRect(0,0,220,220); } } else { g.fillStyle='#15306b'; g.fillRect(0,0,220,220); im.onload=()=>drawMinimapBase(); } mmBase=c; }
const mmX=(x)=>(x-(MOS.cx-HALF))/MOS.size*220, mmZ=(z)=>(z-(MOS.cz-HALF))/MOS.size*220;
function renderMinimap(){ if(!mmBase) drawMinimapBase(); mg.drawImage(mmBase,0,0); mg.fillStyle='rgba(11,31,75,.25)'; mg.fillRect(0,0,220,220);
  for(let i=0;i<nextArr;i+=2){ const a=AG[i]; if(a.st===0||a.st===9) continue; mg.fillStyle=a.grp==='in'?'#2ec4c6':'#4d94f0'; mg.fillRect(mmX(a.x),mmZ(a.z),1.6,1.6); }
  mg.fillStyle='#e11d74'; mg.beginPath(); mg.arc(mmX(0),mmZ(0),3.5,0,6.283); mg.fill(); mg.fillStyle='#fff'; mg.font='700 9px Noto Sans JP'; mg.fillText('姫路城',mmX(0)+5,mmZ(0)+3); mg.fillText('姫路駅',mmX(GATES[0].x)+5,mmZ(GATES[0].z)+3);
  const tx=mmX(ctrl.target.x), tz=mmZ(ctrl.target.z); mg.strokeStyle='#fff'; mg.lineWidth=1.5; mg.beginPath(); mg.arc(clamp(tx,4,216),clamp(tz,4,216),Math.max(6,Math.min(100,ctrl.sph.radius/MOS.size*220*0.6)),0,6.283); mg.stroke(); }
mm.onclick=e=>{ const r=mm.getBoundingClientRect(); const x=(e.clientX-r.left)/220*MOS.size+(MOS.cx-HALF), z=(e.clientY-r.top)/220*MOS.size+(MOS.cz-HALF); flyTo([x,hAt(x,z),z], Math.min(ctrl.sph.radius,1200), ctrl.sph.phi, ctrl.sph.theta, 1200); };

/* ---------- ティッカー / アラート ---------- */
let tickI=0, lastTick=0;
function renderTicker(now){ if(now-lastTick<4000) return; lastTick=now; const msgs=[`城内 <b>${fmt((SP.castle.cnt+castleQ.length)*PER_AGENT)}</b>人<i>·</i>大天守 待ち <b>${Math.round(castleWait)}</b>分`,`好古園 <b>${fmt(SP.kokoen.cnt*PER_AGENT)}</b>人<i>·</i>商店街 <b>${fmt(SP.miyuki.cnt*PER_AGENT)}</b>人<i>·</i>駅前 <b>${fmt(SP.station.cnt*PER_AGENT)}</b>人`,`城の北P <b>${pct(GATES[2].occ,GATES[2].cap)}</b><i>·</i>大手門P <b>${pct(GATES[3].occ,GATES[3].cap)}</b><i>·</i>バス <b>${GATES[6].occ}/${GATES[6].cap}</b>台`,`本日の来訪 <b>${fmt(totals().arrived*PER_AGENT)}</b>人<i>·</i>インバウンド <b>${pct(totals().inb,totals().arrived)}</b><i>·</i>市内消費 <b>${man(spendTotal())}</b>`]; $('ticker-body').innerHTML=msgs[(tickI++)%msgs.length]; }
const ALERTS=[]; const alertKeys=new Set();
function addAlert(key, sev, msg, t){ if(alertKeys.has(key)) return; alertKeys.add(key); const d=document.createElement('div'); d.className='alert '+sev; d.innerHTML=`<b>${clockStr(t)}</b>${msg}`; d.onclick=()=>d.remove(); $('alerts').appendChild(d); setTimeout(()=>d.remove(), 14000); ALERTS.push([t,sev,msg]); }
function checkAlerts(m){ if(castleWait>45) addAlert('wait'+Math.floor(m/120),'warn',`大天守の待ち時間が ${Math.round(castleWait)}分。整理券・好古園への誘導を検討`,m); GATES.forEach(g=>{ if(g.kind==='park'&&g.occ/g.cap>0.95) addAlert('full'+g.id+Math.floor(m/180),'','🅿 '+g.name+' が満車。周辺Pへ案内',m); }); if(m>=660&&m<663) addAlert('close','info','閉門 17:00 · 帰路の集中(駅・駐車場)が始まります',m); if(m>=720&&m<723) addAlert('rush','info','大阪・京都方面へ帰還ラッシュ · 新幹線口・在来線口が混雑',m); if(SP.miyuki.cnt*PER_AGENT>1200) addAlert('miyuki'+Math.floor(m/180),'','みゆき通り商店街が混雑(1,200人超) · 飲食待ちに注意',m); }

/* ---------- ガイドツアー ---------- */
const TOUR=[
  {t:150, mode:'flow', view:'all', title:'姫路城・姫路市 観光人流デジタルツイン', txt:'国土地理院(国交省)の地図・航空写真・標高タイル上に、姫路市域9 km四方を実寸で再現。来訪者を1体=4人のエージェントで表し、「誰が・どこから来て・どこに滞留し・どこへ帰ったか」を1日の流れで可視化します。', dur:13},
  {t:300, mode:'origin', view:'region', title:'誰が・どこから来たか', txt:'広域ビュー。関西空港・大阪・京都・岡山・東京から姫路駅へ流れ込む弧線の太さが来訪量。海外発地は関空・成田経由で接続。国別・都道府県別の構成は市の観光動向調査(令和6年度)に校正しています。', dur:14},
  {t:420, mode:'access', view:'station', title:'どうやって入ってきたか', txt:'姫路駅 新幹線口・在来線口、城周辺の駐車場、観光バス乗降場。駐車場の入出庫・満車、ループバスの乗車をゲート単位で捉え、二次交通の計画に使えるデータにします。', dur:13},
  {t:480, mode:'flow', view:'castle', title:'午後のピーク · 大天守の待ち列', txt:'菱の門前に待ち列が伸び、25 mメッシュのヒートマップが赤くなります。待ち時間はゲート処理能力から算出。整理券のタイミングや好古園・商店街への誘導判断に。', dur:14},
  {t:540, mode:'dwell', view:'otemae', title:'どこに・どれだけ滞留したか', txt:'地点別の滞留人数・平均滞留時間・ピーク時刻、地点間の遷移マトリクスと周遊パターン。城→好古園→商店街の回遊をどれだけ作れているかが、市内消費の鍵です。', dur:14},
  {t:720, mode:'stay', view:'region', title:'どこへ帰ったか · 通過型の構造', txt:'閉門後、大阪・京都へ帰る弧線が太くなります。外国人の市内宿泊は13.9%、多くが大阪拠点の日帰り。来訪元×帰路先のODマトリクスで宿泊転換の余地を見ます。', dur:14},
  {t:800, mode:'spend', view:'otemae', title:'いくら使ったか', txt:'縦覧料(2,500円)・飲食・土産・宿泊・交通のカテゴリ別に市内消費を推定。地点別の売上イメージも。実測はデジタルチケット・決済データで置換します。', dur:12},
  {t:800, mode:'db', view:'top', title:'データベースの構成', txt:'①国交省の地図・標高・PLATEAU、②公表統計、③携帯位置情報・センサー・チケット・決済、④統合DBとアウトプット。計測点(緑)を3Dに配置し、ODレコードのスキーマとCSV出力を示します。', dur:14},
  {t:900, mode:'lab', view:'all', title:'シナリオ · 施策の効果を試算', txt:'夜間開城・二次交通・縦覧料・インバウンド誘客・客室供給をスライダーで動かし、入城者・宿泊者・消費・待ち時間の変化を試算。DB構築後は実測値でこの試算を検証・更新できます。', dur:14},
];
let tourIdx=-1, tourTimer=null, tourPaused=false, tourT0=0;
function tourShow(i){ tourIdx=i; const s=TOUR[i]; $('tour-n').textContent=`${i+1} / ${TOUR.length}`; $('tour-t').textContent=s.title; $('tour-txt').textContent=s.txt; $('tour-prog').style.width='0%';
  setMode(s.mode); if(Math.abs(timeState.min-s.t)>2){ seekTo(s.t); } repaintHeat(); arcVolumes(); updatePanel(true); setView(s.view); timeState.playing=true; playBtn.textContent='❚❚ 一時停止'; tourT0=performance.now(); tourPaused=false;
  clearInterval(tourTimer); tourTimer=setInterval(()=>{ if(tourPaused) return; const k=(performance.now()-tourT0)/(s.dur*1000); $('tour-prog').style.width=Math.min(100,k*100)+'%'; if(k>=1){ if(tourIdx<TOUR.length-1) tourShow(tourIdx+1); else stopTour(); } },200); }
function startTour(){ $('tour').style.display='block'; $('panel').classList.add('collapsed'); $('panel-tab').style.display='block'; tourShow(0); }
function stopTour(){ clearInterval(tourTimer); $('tour').style.display='none'; tourIdx=-1; timeState.playing=false; playBtn.textContent='▶ 再生'; $('panel').classList.remove('collapsed'); $('panel-tab').style.display='none'; toast('ツアーを終了しました'); }
$('tour-btn').onclick=startTour; $('tour-stop').onclick=stopTour; $('tour-next').onclick=()=>{ if(tourIdx<TOUR.length-1) tourShow(tourIdx+1); else stopTour(); }; $('tour-prev').onclick=()=>{ if(tourIdx>0) tourShow(tourIdx-1); };
$('tour-pause').onclick=()=>{ tourPaused=!tourPaused; $('tour-pause').textContent=tourPaused?'▶ 再開':'❚❚ 一時停止'; timeState.playing=!tourPaused; playBtn.textContent=timeState.playing?'❚❚ 一時停止':'▶ 再生'; if(!tourPaused) tourT0=performance.now()-(parseFloat($('tour-prog').style.width)/100)*TOUR[tourIdx].dur*1000; };

/* ---------- 出力 ---------- */
function dl(name,text){ const b=new Blob(['﻿'+text],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=name; a.click(); }
function exportOD(){ const rows=['visitor_id,origin_region,origin_type,gateway,gateway_node,t_in,t_out,trip_type,hotel,return_dest,n_spots,spots,spend_jpy']; for(let i=0;i<nextArr;i++){ const a=AG[i]; if(a.st===0||!isActive(a)) continue; const sp=a.spend; rows.push([a.id,a.seg.name,a.grp==='in'?'inbound':'domestic',MODES[a.mi],GATES[a.gate].name,clockStr(a.tArrived||a.tArr),a.st===9?'':'',a.stay?'stay':'day',a.stay?HOTELS[a.hotel].name:'',RET[a.ret].name,a.zones.length,'"'+a.zones.map(z=>z[2]).join('→')+'"',Math.round(sp.fee+sp.food+sp.shop+sp.stay+sp.trans)].join(',')); } dl(`himeji_visitor_od_${DAYS[curDay].name}_${clockStr(timeState.min).replace(':','')}.csv`, rows.join('\n')); toast(`ODレコード ${rows.length-1}件 を CSV 出力`); }
function exportSpot(){ const m=Math.floor(timeState.min); const head=['min','clock','in_city','in_castle','castle_wait_min',...SPOTS.map(s=>s.name),...GATES.filter(g=>g.kind!=='rail').map(g=>g.name+'_occ')]; const rows=[head.join(',')]; for(let t=0;t<=m;t+=5){ rows.push([t,clockStr(t),HIST.inCity[t]*PER_AGENT,HIST.inCastle[t]*PER_AGENT,Math.round(HIST.wait[t]),...SPOTS.map((s,i)=>HIST.bySpot[i][t]*PER_AGENT),...GATES.filter(g=>g.kind!=='rail').map(g=>HIST.park[g.i][t])].join(',')); } dl(`himeji_spot_timeseries_${DAYS[curDay].name}.csv`, rows.join('\n')); toast('地点×時間 CSV を出力'); }
function saveShot(){ renderer.render(scene,camera); const url=renderer.domElement.toDataURL('image/png'); const a=document.createElement('a'); a.href=url; a.download=`himeji_twin_${DAYS[curDay].name}_${clockStr(timeState.min).replace(':','')}_${mode}.png`; a.click(); toast('3Dビューを PNG 保存しました'); }
$('shot-btn').onclick=saveShot;

/* ---------- メインループ ---------- */
let lastT=performance.now(), lastHeat=0, lastUI=0, frames=0, fpsT=performance.now();
$('sb-scale').textContent=PER_AGENT; $('sb-rx').textContent=SENSORS.length;
function loop(now){ requestAnimationFrame(loop); const dt=Math.min(0.1,(now-lastT)/1000); lastT=now; updateTween(now);
  if(timeState.playing){ const dtMin=dt*timeState.speed; const sub=Math.max(1,Math.ceil(dtMin/0.5)); for(let i=0;i<sub;i++) stepSim(dtMin/sub); if(timeState.min>=T_END){ timeState.playing=false; playBtn.textContent='▶ 再生'; toast('24:00 — 1日のシミュレーションが終了しました'); } syncClock(); }
  renderAgents(now); renderTrail(); renderRx(now); renderArcs(now); renderVehicles(dt); scaleLabels();
  if(followAgent && hlAgent && hlAgent.st!==0 && hlAgent.st!==9){ ctrl.target.set(hlAgent.x,hAt(hlAgent.x,hlAgent.z),hlAgent.z); ctrl.sph.radius=Math.min(ctrl.sph.radius,220); ctrl.apply(); }
  if(now-lastHeat>450){ lastHeat=now; if(timeState.playing){ repaintHeat(); arcVolumes(); } }
  if(now-lastUI>700){ lastUI=now; if(timeState.playing){ updatePanel(); updateDetail(); } renderMinimap(); renderTicker(now); $('sb-ag').textContent=fmt(agMesh.count); $('sb-in').textContent=fmt(inCity*PER_AGENT); $('sb-castle').textContent=fmt((SP.castle.cnt+castleQ.length)*PER_AGENT); }
  frames++; if(now-fpsT>1000){ $('sb-fps').textContent=frames; frames=0; fpsT=now; }
  renderer.render(scene,camera); }

/* ---------- 起動 ---------- */
renderPanel(); syncClock();
setTimeout(()=>{ seekTo(270); repaintHeat(); arcVolumes(); syncClock(); updatePanel(true); drawMinimapBase(); $('splash').classList.add('out'); loop(performance.now()); toast('▶ 再生で1日の人流を再現(×6: 実時間1秒 = 6分)。施設や人をクリックすると詳細カードが開きます。', 4000); }, 400);
</script>
</body>
</html>
