// ================= 分析基盤パネル（3Dビューアと連動） =================
// データ: src/data/analytics.json（pipeline/build_analytics.py が生成）。
// 敷地全景 → 工場全体KPI / 建屋内部 → ラインKPI・レイアウト比較 / 設備選択 → 台帳＋稼働実績。
const twinState={open:true,diff:false,compare:null};
const twinEl=document.getElementById('twinPanel'), twinBody=document.getElementById('twinBody');
const twinOverlay=new THREE.Group(); scene.add(twinOverlay);
const te=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tn=(v,d=0)=>v==null||!Number.isFinite(+v)?'—':(+v).toLocaleString('ja-JP',{maximumFractionDigits:d,minimumFractionDigits:d});
const TWIN_LINE={paint1:'1B',paint2:'2B',varnish:'ワニス'};
const TWIN_BLD={'1B':'paint1','2B':'paint2','ワニス':'varnish'};
const twinTable=(head,rows,cls='')=>`<table class="tw-t ${cls}"><thead><tr>${head.map((h,i)=>`<th${i?' class="n"':''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')||'<tr><td colspan="9" class="tw-mute">該当データなし</td></tr>'}</tbody></table>`;
const twinRow=(cells,attr='')=>`<tr ${attr}>${cells.map((c,i)=>`<td${i?' class="n"':''}>${c}</td>`).join('')}</tr>`;
const twinKpi=(label,value,note='')=>`<div class="tw-kpi"><small>${label}</small><b>${value}</b><span>${note}</span></div>`;

// ---- レイアウト（現状／変更案）の切替と比較 ----
function setLayoutScenario(id,scen){
  if(!layoutCtxs[id]||layoutState[id]===scen) return;
  layoutState[id]=scen; const c=layoutCtxs[id][scen]; interiorCtxs.set(id,c);
  if(currentBuilding&&currentBuilding.id===id){ select(null); ctx=c; buildInteriorScene(currentBuilding); buildSnapGrid(); recomputeActive(); }
  else computeData(c);
  toast(DRAWING_LAYOUTS[id].scenarios[scen]+' を表示');
}
function twinCompare(id){
  const out={};
  for(const scen of ['current','plan']){
    const c=layoutCtxs[id][scen]; v4Compute(c);
    const by={}, keyed={};
    for(const r of c.routes){ const k=r.line||'—'; if(!r.blocked) keyed[k+'|'+r.fromId+'>'+r.toId]=r.len*r.reps*2; const e=by[k]||(by[k]={dist:0,reps:0,blocked:0,routes:0}); e.routes++; if(r.blocked) e.blocked+=r.reps; else { e.dist+=r.len*r.reps*2; e.reps+=r.reps; } }
    const un={}; for(const f of c.drawing.unassigned){ (un[f.line]=un[f.line]||{n:0,list:[]}).n+=f.per_day; un[f.line].list.push(f); }
    out[scen]={by,un,keyed,items:c.items.length};
  }
  // 両案で経路化できた共通フローだけの合計（行き先不明の工程を除いた公平な比較）
  out.common={};
  for(const [k,v] of Object.entries(out.current.keyed)){ if(!(k in out.plan.keyed)) continue; const ln=k.split('|')[0]; const e=out.common[ln]||(out.common[ln]={current:0,plan:0,n:0}); e.current+=v; e.plan+=out.plan.keyed[k]; e.n++; }
  return out;
}
function twinDrawOverlay(){
  clearGroup(twinOverlay);
  if(!twinState.diff||ctx.kind!=='interior'||!ctx.drawing) return;
  const id=ctx.id, mine=ctx, other=layoutCtxs[id][ctx.drawing.scen==='current'?'plan':'current'];
  const has=(c,a)=>c.items.some(i=>i.assetId===a);
  const mark=(it,col,label)=>{
    const g=new THREE.BoxGeometry(it.w+.3,.06,it.d+.3), m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.42,depthWrite:false}));
    m.position.set(it.x,.05,it.z); twinOverlay.add(m);
    const e=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(it.w+.3,it.h,it.d+.3)),new THREE.LineBasicMaterial({color:col}));
    e.position.set(it.x,it.h/2,it.z); twinOverlay.add(e);
    if(label){ const l=makeLabel(label,.11,'#'+col.toString(16).padStart(6,'0')); l.position.set(it.x,it.h+1.2,it.z); twinOverlay.add(l); }
  };
  const otherName=ctx.drawing.scen==='current'?'変更案で追加':'変更案で撤去';
  for(const it of other.items) if(!has(mine,it.assetId)) mark(it, ctx.drawing.scen==='current'?0x4fd18b:0xff8f6b, null);
  for(const it of mine.items) if(!has(other,it.assetId)) mark(it, ctx.drawing.scen==='current'?0xff8f6b:0x4fd18b, null);
  const lg=makeLabel(ctx.drawing.scen==='current'?'橙=変更案で図面から消える設備 / 緑=変更案で追加される設備（輪郭のみ）':'緑=変更案で追加された設備 / 橙=現状にあり変更案で消える設備（輪郭のみ）',.2,'#ffe2b0');
  lg.position.set(0,6.5,-ctx.D/2-1); twinOverlay.add(lg);
}


// ---- グラフ部品（配色は検証済みの2系列: 青=実績/現状、橙=比較対象。文字は本文色のみ） ----
const TW_C1='#338ced', TW_C2='#e76624';
const twinLegend=items=>`<div class="tw-legend">${items.map(([c,t,kind])=>`<span><i class="${kind||''}" style="background:${c}"></i>${te(t)}</span>`).join('')}</div>`;
function twinCols(data,{unit='',h=120,refName='計画',name='実績'}={}){
  // 縦棒（実績）＋横線マーカー（計画）。data:[{label,value,ref}]
  const W=372,padL=30,padB=18,padT=8,max=Math.max(...data.map(d=>Math.max(d.value||0,d.ref||0)))*1.08||1,bw=(W-padL-6)/data.length,y=v=>padT+(h-padT-padB)*(1-v/max);
  const ticks=[0,.5,1].map(f=>Math.round(max/1.08*f));
  return twinLegend([[TW_C1,name],['var(--sub)',refName,'line']])+`<svg class="tw-chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="${te(name)}と${te(refName)}">
  ${ticks.map(t=>`<line x1="${padL}" x2="${W}" y1="${y(t)}" y2="${y(t)}" class="tw-grid"/><text x="${padL-4}" y="${y(t)+3}" text-anchor="end" class="tw-ax">${tn(t)}</text>`).join('')}
  ${data.map((d,i)=>{const x=padL+i*bw+bw*.2,w=bw*.6,yy=y(d.value||0),r=Math.min(4,w/2,(h-padB-yy));
    return `<g data-tip="${te(d.label)}｜${te(name)} ${tn(d.value)}${unit}${d.ref!=null?' / '+te(refName)+' '+tn(d.ref)+unit+'（'+tn(d.value/d.ref*100,0)+'%）':''}"><rect x="${padL+i*bw}" y="${padT}" width="${bw}" height="${h-padT-padB}" fill="transparent"/>
    <path d="M${x},${h-padB}V${yy+r}q0,${-r} ${r},${-r}h${w-2*r}q${r},0 ${r},${r}V${h-padB}z" fill="${TW_C1}"/>
    ${d.ref!=null?`<line x1="${x-3}" x2="${x+w+3}" y1="${y(d.ref)}" y2="${y(d.ref)}" stroke="var(--txt)" stroke-width="2"/>`:''}
    <text x="${x+w/2}" y="${h-5}" text-anchor="middle" class="tw-ax">${te(d.label)}</text></g>`;}).join('')}</svg>`;
}
function twinHBars(rows,{unit='',aName='現状',bName=null,dec=0}={}){
  // 横棒。rows:[{label,a,b}]。bName があれば2系列。
  const W=372,padL=92,rowH=bName?30:20,H=rows.length*rowH+4,max=Math.max(...rows.flatMap(r=>[r.a||0,r.b||0]))||1,sc=v=>(W-padL-46)*v/max;
  const bar=(x,y,w,hh,c)=>{const r=Math.min(4,hh/2,w);return `<path d="M${x},${y}h${Math.max(0,w-r)}q${r},0 ${r},${r}v${hh-2*r}q0,${r} ${-r},${r}h${-Math.max(0,w-r)}z" fill="${c}"/>`;};
  return (bName?twinLegend([[TW_C1,aName],[TW_C2,bName]]):'')+`<svg class="tw-chart" viewBox="0 0 ${W} ${H}" role="img">
  ${rows.map((r,i)=>{const y=i*rowH+3,hh=bName?10:12;
    return `<g data-tip="${te(r.label)}｜${te(aName)} ${tn(r.a,dec)}${unit}${bName?' / '+te(bName)+' '+tn(r.b,dec)+unit:''}"><rect x="0" y="${y-3}" width="${W}" height="${rowH}" fill="transparent"/>
    <text x="${padL-6}" y="${y+(bName?14:10)}" text-anchor="end" class="tw-lb">${te(r.label)}</text>
    ${bar(padL,y,sc(r.a||0),hh,TW_C1)}<text x="${padL+sc(r.a||0)+4}" y="${y+hh-1}" class="tw-ax">${tn(r.a,dec)}</text>
    ${bName?bar(padL,y+hh+2,sc(r.b||0),hh,TW_C2)+`<text x="${padL+sc(r.b||0)+4}" y="${y+2*hh+1}" class="tw-ax">${tn(r.b,dec)}</text>`:''}</g>`;}).join('')}</svg>`;
}
// ---- 建屋間の移動（位置トラッキング実測 × 工程人員）と、ワニス・調色を第二工場へ移した場合 ----
function twinInterBuilding(){
  const r=simCore.evaluate(simCfg), A=simCore.A, nm=id=>({paint1:'第一',paint2:'第二',varnish:'ワニス',tint:'調色',lab:'研究棟',office:'事務所',whGen:'一般倉庫',whNew:'新一般倉庫',hazNew:'新危険物',hazA:'危険物A',hazB:'危険物B',parking:'駐車場',waste:'廃材'}[id]||id);
  const pairs=new Map();
  for(const e of r.edges){ const a=A[e.from].building,b=A[e.to].building; if(a===b) continue; const k=[a,b].sort().join('|')+'|'+e.group; const p=pairs.get(k)||{a:[a,b].sort()[0],b:[a,b].sort()[1],group:e.group,n:0,before:0,after:0}; p.n+=e.beforeCount; p.before+=e.beforeMinutes; p.after+=e.afterMinutes; pairs.set(k,p); }
  const top=[...pairs.values()].sort((x,y)=>Math.abs(y.after-y.before)-Math.abs(x.after-x.before)).slice(0,8);
  const need=(r.current-r.goal)*simCfg.hours*60;
  return `<h4>建屋間の移動と移設の影響（実測 × 人員${r.current}名）</h4>
  <div class="tw-kpis">${twinKpi('移動時間 現状',tn(r.beforeMinutes)+' 分/日','6工程の合計')}${twinKpi('ワニス・調色を第二へ',tn(r.afterMinutes)+' 分/日',(r.gain>=0?'−':'＋')+tn(Math.abs(r.gain))+' 分/日')}${twinKpi(`${r.current-r.goal}名削減に必要`,tn(need)+' 分/日','= '+(r.current-r.goal)+'名×'+simCfg.hours+'h')}</div>
  ${twinHBars(r.rows.map(x=>({label:x.group,a:x.beforeMinutes,b:x.afterMinutes})),{unit:'分/日',aName:'現状',bName:'移設後'})}
  <div class="tw-warn"><b>移設だけでは移動時間は${r.gain>=0?'減りますが':'減らず、むしろ増えます'}</b>（${r.gain>=0?'−':'＋'}${tn(Math.abs(r.gain))}分/日）。主因は下表の上位の組合せです。${r.current-r.goal}名削減（${tn(need)}分/日）の原資は、移動時間ではなく、応援の解消・工程の兼務・段取りの共通化で作る必要があります。</div>
  <h4>調色⇄研究棟（資材の取りに行き）を減らせた場合</h4>
  ${twinTable(['資材の置き方','移設後 分/日','現状との差','人員換算'],[[0,'今のまま研究棟へ取りに行く'],[.5,'往復を半分に（まとめ取り）'],[1,'資材を移設先に置く（往復なし）']].map(([k,l])=>{const x=simCore.evaluate({...simCfg,researchReduction:k});return twinRow([l,tn(x.afterMinutes),`<span class="${x.gain>=0?'tw-good':'tw-bad'}">${x.gain>=0?'−':'＋'}${tn(Math.abs(x.gain))}</span>`,(x.gain>=0?'−':'＋')+tn(Math.abs(x.gain)/(simCfg.hours*60),2)+'名'])}))}
  <p class="tw-note">調色と研究棟の往復は資材を取りに行くため（確認済み）。移設と同時に資材の置場を調色の近くへ移せば、移動時間は現状より減ります。それでも2名分（${tn(need)}分/日）には届きません。</p>
  <h4>影響の大きい建屋の組合せ</h4>
  ${twinTable(['建屋の組合せ','工程','回/日','現状 分/日','移設後 分/日'],top.map(p=>twinRow([te(nm(p.a)+' ⇄ '+nm(p.b)),te(p.group),tn(p.n),tn(p.before),`<span class="${p.after<=p.before?'tw-good':'tw-bad'}">${tn(p.after)}</span>`])))}
  <p class="tw-note">回数は位置トラッキング（2026/7〜8、工程ごと4〜7 ID日）の建屋間移動を人員数に換算。距離は建屋代表点間の直線×迂回係数${simCfg.detour}、歩行${simCfg.speed}m/分。移設先の代表点は実測再生画面でドラッグして変更できます。</p>`;
}
// ---- 各ビューの中身 ----
function twinSiteView(){
  const A=TWIN, prod=A.monthly.filter(m=>m.metric==='生産トン数'&&m.category==='合計');
  const ship=Object.fromEntries(A.monthly.filter(m=>m.metric==='出荷トン数'&&m.category==='合計').map(m=>[m.month,m]));
  const stock=Object.fromEntries(A.monthly.filter(m=>m.metric==='在庫トン数'&&m.category==='合計').map(m=>[m.month,m]));
  const tp=prod.reduce((a,m)=>a+m.plan,0), ta=prod.reduce((a,m)=>a+m.actual,0);
  const lt=A.line_total, labor=lt.reduce((a,l)=>a+l.labor_hours,0), out=lt.reduce((a,l)=>a+l.output_t,0);
  return `<div class="tw-eyebrow">工場全体 / ${A.period.production[0]}〜${A.period.production[1]}</div><h3>加須工場 生産実績</h3>
  <div class="tw-kpis">${twinKpi('生産トン数（7か月）',tn(ta)+' t','計画比 '+tn(ta/tp*100,1)+'%')}${twinKpi('製造バッチ',tn(A.counts.batches)+' 件','1B・2B・ワニス')}${twinKpi('出来高 / 人時',tn(out*1000/labor,0)+' kg','3ライン合計')}</div>
  <p class="tw-note">前提（共有コメント）: 生産人員24名 = ワニス2・仕込み3・調合3・充填10・2B 3・調色3。ワニスと調色を第二工場へ移し2名削減する計画。フォークリフト担当2名は別枠。</p>
  <h4>ライン別（行をクリックで建屋内部へ）</h4>
  ${twinTable(['ライン','バッチ/日','出来高 t','kg/人時','記録直接工数/就業','収率%'],lt.map(l=>twinRow([`<b>${te(l.line)}</b>`,tn(l.batches_per_day,1),tn(l.output_t),tn(l.kg_per_labor_hour),tn(l.direct_min_day/(l.avg_headcount*480)*100,0)+'%',tn(l.yield_pct,1)],`class="tw-click" data-tw-enter="${TWIN_BLD[l.line]}"`)))}
  <p class="tw-note">「記録直接工数/就業」= 生産データの工程別合計分 ÷（平均人数×8h）。残りは記録外（段取り・搬送・待ち・洗浄など）で、動線改善の余地を測る母数になります。</p>
  ${twinInterBuilding()}
  <h4>月次 計画と実績（トン）</h4>
  ${twinCols(prod.map(m=>({label:m.month.slice(5).replace(/^0/,'')+'月',value:m.actual,ref:m.plan})),{unit:'t',name:'生産実績',refName:'計画'})}
  ${twinTable(['月','生産 計画','生産 実績','達成率','出荷 実績','在庫 実績'],prod.map(m=>twinRow([m.month.slice(2),tn(m.plan),tn(m.actual),`<span class="${m.actual>=m.plan?'tw-good':'tw-bad'}">${tn(m.actual/m.plan*100,0)}%</span>`,tn(ship[m.month]?.actual),tn(stock[m.month]?.actual)])))}
  <h4>部門別の人員（日報）</h4>
  ${twinTable(['部門','在籍','平均出勤','残業 h','応援受 人日','応援出 人日'],A.dept_labor.map(d=>twinRow([te(d.dept),tn(d.roster),tn(d.avg_headcount,1),tn(d.overtime_hours),tn(d.support_in_days),tn(d.support_out_days)])))}
  <p class="tw-note">応援の出入りが常態化しています（例: ワニスは在籍2名に対し応援出 ${tn(A.dept_labor.find(d=>d.dept==='ワニス')?.support_out_days)} 人日）。移設で工程を集約すると、この応援移動が建屋内移動に変わる点が評価対象です。</p>
  <h4>調色 色補正（${A.color.period[0]}〜${A.color.period[1].slice(5)}・${A.color.days}日）</h4>
  <div class="tw-kpis">${twinKpi('調色件数',tn(A.color.jobs_per_day,1)+' 件/日','')}${twinKpi('平均補正回数',tn(A.color.avg_corrections,2)+' 回','')}${twinKpi('平均調色時間',tn(A.color.avg_tint_min,0)+' 分','経過時間')}</div>
  ${twinTable(['補正回数','件数','平均調色時間 分'],Object.keys(A.color.corr_hist).map(k=>twinRow([k+' 回',tn(A.color.corr_hist[k]),tn(A.color.tint_min_by_corr[k],0)])))}
  <p class="tw-note">補正1回ごとに調色時間が約25〜30分延びています。調色を第二工場へ寄せる場合、測色・補正の往復距離が効きます。</p>`;
}
function twinLayoutBlock(id){
  const L=DRAWING_LAYOUTS[id], cur=layoutState[id], cmp=twinState.compare=twinCompare(id);
  const mins=d=>d/SPEED.interior*60;
  const lines=[...new Set([...Object.keys(cmp.current.by),...Object.keys(cmp.plan.by)])];
  const rows=lines.map(k=>{const a=cmp.current.by[k],b=cmp.plan.by[k];
    const d=a&&b?b.dist-a.dist:null;
    return twinRow([te(k)+'（経路化できた分）',a?tn(a.dist):'建屋外',b?tn(b.dist):'—',d==null?'—':`<span class="${d<=0?'tw-good':'tw-bad'}">${d>0?'+':''}${tn(d)}</span>`,a?tn(mins(a.dist),1):'—',b?tn(mins(b.dist),1):'—']);});
  for(const [k,e] of Object.entries(cmp.common)){const d=e.plan-e.current;rows.push(twinRow([te(k)+' 共通'+e.n+'経路',tn(e.current),tn(e.plan),`<span class="${d<=0?'tw-good':'tw-bad'}">${d>0?'+':''}${tn(d)}</span>`,tn(mins(e.current),1),tn(mins(e.plan),1)]));}
  const un=s=>Object.entries(cmp[s].un).map(([k,v])=>`${te(k)} ${tn(v.n,2)}回/日`).join('、')||'なし';
  const lost=(cmp.plan.un['2B']?.list||[]).filter(f=>!(cmp.current.un['2B']?.list||[]).includes(f)).sort((a,b)=>b.batches-a.batches).slice(0,6);
  return `<h4>レイアウト比較（${te(L.source)}）</h4>
  <div class="tw-seg">${Object.entries(L.scenarios).map(([k,v])=>`<button class="btn ${cur===k?'on':''}" data-tw-scen="${k}">${te(v)}</button>`).join('')}</div>
  <label class="tw-check"><input type="checkbox" id="twDiff" ${twinState.diff?'checked':''}> 差分を3Dに重ねる（追加=緑 / 撤去=橙）</label>
  ${twinTable(['対象ライン','現状 m/日','変更案 m/日','差','現状 分/日','変更案 分/日'],rows)}
  <p class="tw-note">距離 = 設備間の歩行経路長 × 実バッチ頻度（生産データ ${TWIN.period.production[0]}〜${TWIN.period.production[1]}）× 往復。設備を動かすと即時に再計算します。「共通」行は両案で両端の設備が図面にある経路だけの比較です。ワニスの現状はワニス工場内のため、この建屋では比較対象外です。</p>
  <div class="tw-warn"><b>経路化できないフロー</b><br>現状: ${un('current')}<br>変更案: ${un('plan')}
  ${lost.length?`<br><b>変更案で行き先が図面から読めない主な工程</b><ul>${lost.map(f=>`<li>${te(f.source)} → ${te(f.target)}：${f.batches}バッチ（${tn(f.per_day,2)}回/日）</li>`).join('')}</ul>`:''}</div>`;
}
function twinBuildingView(b){
  const line=TWIN_LINE[b.id], A=TWIN;
  if(b.id==='tint') return `<div class="tw-eyebrow">建屋内部</div><h3>${te(b.name)}</h3>
    <div class="tw-kpis">${twinKpi('調色件数',tn(A.color.jobs_per_day,1)+' 件/日','')}${twinKpi('平均補正',tn(A.color.avg_corrections,2)+' 回','')}${twinKpi('充填',tn(A.color.fill_min_day)+' 分/日','経過時間の合計')}</div>
    <p class="tw-note">調色工場は図面未入手のため、内部は仮配置です。設備単位の連動は図面のある第二ペイント工場から対応しています。</p>`;
  if(!line) return `<div class="tw-eyebrow">建屋内部</div><h3>${te(b.name)}</h3><p class="tw-note">この建屋に紐づく生産データはまだありません（倉庫・研究棟など）。内部は仮配置です。</p>`;
  const T=A.line_total.find(l=>l.line===line), M=A.line_month.filter(l=>l.line===line);
  const used=A.equipment_usage.filter(u=>u.line===line).slice(0,14);
  const linked=!!ctx.drawing;
  return `<div class="tw-eyebrow">建屋内部 / ライン ${te(line)}</div><h3>${te(b.name)}</h3>
  <div class="tw-kpis">${twinKpi('バッチ',tn(T.batches_per_day,1)+' 件/日',tn(T.batches)+' 件')}${twinKpi('出来高/人時',tn(T.kg_per_labor_hour)+' kg','平均 '+tn(T.avg_headcount,1)+' 名')}${twinKpi('直接工数',tn(T.direct_min_day)+' 分/日','仕込'+tn(T.prep_min_day)+'・調合'+tn(T.mix_min_day)+'・充填'+tn(T.fill_min_day))}</div>
  ${linked?twinLayoutBlock(b.id):'<p class="tw-note">この建屋は図面未入手のため内部は仮配置です。KPIはライン単位で表示し、設備単位の連動は行いません。</p>'}
  <h4>月次推移（出来高 t）</h4>
  ${twinCols(M.map(m=>({label:m.month.slice(5).replace(/^0/,'')+'月',value:m.output_t,ref:null})),{unit:'t',name:'出来高',refName:'—'}).replace(/<span><i class="line".*?<\/span>/,'')}
  ${twinTable(['月','バッチ','出来高 t','kg/人時','充填 実績/標準','残業 h'],M.map(m=>twinRow([m.month.slice(2),tn(m.batches),tn(m.output_t),tn(m.kg_per_labor_hour),m.fill_actual_vs_std==null?'—':tn(m.fill_actual_vs_std,0)+'%',tn(m.overtime_hours)])))}
  <h4>稼働の多い設備（${linked?'表の行クリックで3D上の設備へ':'設備番号'}）</h4>
  ${twinHBars(used.slice(0,8).map(u=>({label:u.tag+(u.kind==='fill'?'（充填）':''),a:u.batches})),{unit:'バッチ',aName:'使用バッチ'})}
  ${twinTable(['設備番号','役割','バッチ','出来高 t','台帳'],used.map(u=>twinRow([`<b>${te(u.tag)}</b>`,te(Object.keys(u.roles).join('・')),tn(u.batches),tn(u.output_t),u.in_ledger?'あり':'<span class="tw-mute">未照合</span>'],linked?`class="tw-click" data-tw-tag="${te(u.tag)}" data-tw-kind="${u.kind}"`:'')))}`;
}
function twinEquipmentView(it){
  const A=TWIN, line=it.sys||TWIN_LINE[ctx.id];
  const tags=it.tags||[];
  const usage=A.equipment_usage.filter(u=>tags.includes(u.tag)&&(u.kind==='fill')===(it.proc==='FIL')&&(u.line===line||it.proc==='FIL'));
  const ledger=A.ledger.filter(e=>tags.includes(e.tag)&&(e.category==='充填機')===(it.proc==='FIL')&&(it.proc==='FIL'||e.building===(TWIN_BLD[line]||ctx.id)));
  const routes=ctx.routes.filter(r=>r.fromId===it.assetId||r.toId===it.assetId);
  const b=usage.reduce((a,u)=>a+u.batches,0), t=usage.reduce((a,u)=>a+u.output_t,0), mn=usage.reduce((a,u)=>a+u.minutes,0);
  if(!tags.length) return `<div class="tw-eyebrow">設備</div><h3>${te(it.name)}</h3><p class="tw-note">この設備は仮配置（図面未入手の建屋）で、設備番号が未設定です。台帳・生産データとの連動は図面入手後に対応します。</p><button class="btn" id="twBack">建屋の分析へ戻る</button>`;
  return `<div class="tw-eyebrow">設備 / ${te(line)} / 設備番号 ${te(tags.join('・'))}</div><h3>${te(it.name)}</h3>
  <div class="tw-kpis">${twinKpi('使用バッチ',tn(b)+' 件',A.period.production.join('〜'))}${twinKpi('通過量',tn(t,1)+' t','')}${twinKpi('工程時間',tn(mn/60,0)+' h','記録分の合計')}</div>
  ${usage.length?`<p class="tw-note">役割: ${te(usage.flatMap(u=>Object.entries(u.roles).map(([k,v])=>k+' '+v+'件')).join('、'))}<br>主な製品: ${te([...new Set(usage.flatMap(u=>u.top_products))].slice(0,4).join(' / '))}</p>`:'<p class="tw-note">生産データ上の使用記録はありません（期間内に未使用、または記録が設備番号で残っていない設備）。</p>'}
  <h4>設備台帳</h4>
  ${ledger.length?ledger.map(e=>`<div class="tw-card"><b>${te(e.name)}</b> <span class="tw-mute">${te(e.category)}${e.purchase_year?' / '+e.purchase_year+'年導入':''}</span><br>${e.model?'型式 '+te(e.model)+'　':''}${e.maker?te(e.maker):''}<div class="tw-mute">${te(e.specs)}</div></div>`).join(''):'<p class="tw-note">台帳に該当する設備番号がありません（未照合）。</p>'}
  <h4>この設備を通る動線（現在の配置）</h4>
  ${twinTable(['相手','方向','回/日','経路 m'],routes.sort((a,b)=>b.reps-a.reps).map(r=>twinRow([te(r.fromId===it.assetId?r.toName:r.fromName),r.fromId===it.assetId?'→ 出':'← 入',tn(r.reps,2),r.blocked?'<span class="tw-bad">到達不可</span>':tn(r.len,1)])))}
  <p class="tw-note">${te(it.notes||'')}</p><button class="btn" id="twBack">建屋の分析へ戻る</button>`;
}
function twinRender(){
  if(!twinEl) return;
  twinEl.classList.toggle('closed',!twinState.open); document.body.classList.toggle('twin-open',twinState.open);
  if(!twinState.open) return;
  const keep=twinBody.scrollTop, key=(ctx.kind)+'|'+(currentBuilding?.id||'')+'|'+(selected?.assetId||'');
  twinBody.innerHTML = (ctx.kind==='site' ? twinSiteView() : (selected&&ctx.kind==='interior' ? twinEquipmentView(selected) : twinBuildingView(currentBuilding)))
    + `<div class="tw-foot"><button class="btn" id="twSim">実測再生（位置トラッキング）</button><button class="btn" id="twDash">実測動線ダッシュボード</button></div>
       <p class="tw-note">${TWIN.notes.map(te).join('<br>')}</p>`;
  twinBody.scrollTop = twinBody.dataset.key===key ? keep : 0; twinBody.dataset.key=key;
  twinBody.querySelectorAll('[data-tw-enter]').forEach(r=>r.onclick=()=>{const b=siteCtx.items.find(i=>i.id===r.dataset.twEnter); if(b) enterBuilding(b);});
  twinBody.querySelectorAll('[data-tw-scen]').forEach(b=>b.onclick=()=>setLayoutScenario(currentBuilding.id,b.dataset.twScen));
  twinBody.querySelectorAll('[data-tw-tag]').forEach(r=>r.onclick=()=>{const it=ctx.items.find(i=>i.tags?.includes(r.dataset.twTag)&&(r.dataset.twKind==='fill')===(i.proc==='FIL')); if(it){ select(it); camGoal.target.set(it.x,1.2,it.z); camGoal.dist=Math.min(camGoal.dist,16); } else toast(r.dataset.twTag+' はこのレイアウト図面に記載がありません');});
  const d=document.getElementById('twDiff'); if(d) d.onchange=()=>{twinState.diff=d.checked; twinDrawOverlay();};
  const bk=document.getElementById('twBack'); if(bk) bk.onclick=()=>select(null);
  document.getElementById('twSim').onclick=()=>simOpen();
  document.getElementById('twDash').onclick=()=>document.getElementById('pdOpen').click();
}
function twinSync(){ if(!window.__twinReady) return; twinDrawOverlay(); twinRender(); }
document.getElementById('twinBtn').onclick=()=>{twinState.open=!twinState.open; twinRender();};
document.getElementById('twinClose').onclick=()=>{twinState.open=false; twinRender();};

// ---- FLOW LAB 6.0 の「直接工数」を生産データの実績で初期化（分/人日） ----
{
  const direct={}; for(const g of simCore.groups){ const v=TWIN.direct_min_day[g], n=simCfg.current[g]; direct[g]=(v&&n)?Math.min(960,Math.round(v/n)):null; }
  simCore.defaults.direct={...direct}; simCfg.direct={...direct};
  try{ simResult=simCore.evaluate(simCfg); }catch(e){ console.warn('direct labour init',e); }
}
const twinTip=document.createElement('div'); twinTip.id='twinTip'; document.body.appendChild(twinTip);
twinBody.addEventListener('mousemove',e=>{const g=e.target.closest('[data-tip]'); if(!g){twinTip.style.display='none';return;} twinTip.textContent=g.dataset.tip; twinTip.style.display='block'; twinTip.style.left=Math.min(innerWidth-270,e.clientX+12)+'px'; twinTip.style.top=(e.clientY+14)+'px';});
twinBody.addEventListener('mouseleave',()=>twinTip.style.display='none');
window.__twin={data:TWIN,state:twinState,setScenario:setLayoutScenario,compare:twinCompare,layouts:layoutCtxs,render:twinRender};
window.__twinReady=true; twinSync();
