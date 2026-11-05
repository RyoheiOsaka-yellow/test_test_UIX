<script>
/* =====================================================================
   UI
   ===================================================================== */
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const MAX_SEL=6;
const state={step:1,sel:[],fac:null,q:'',fRole:'',fInd:'',idea:'',form:'auto',lot:100,prio:[],autoPick:true,result:null,concept:0,view:'3d',lib:[],cfg:{mode:'local',key:'',model:'claude-opus-5-5'},running:false};
const store={get(k,d){try{const v=localStorage.getItem('afx:'+k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem('afx:'+k,JSON.stringify(v))}catch(e){}}};
state.lib=store.get('lib',[]);state.cfg={...state.cfg,...store.get('cfg',{})};
let toastT;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2200)}
const rolePill=r=>`<span class="role-pill" style="background:${ROLE_COLOR[r]}">${r}</span>`;

/* ---------- ナビゲーション ---------- */
function go(step){
  state.step=step;
  $$('.pane').forEach(p=>p.hidden=true);
  const id=step==='lib'?'#paneLib':'#pane'+step;$(id).hidden=false;
  $$('.wf-step').forEach(el=>{const n=+el.dataset.step;el.classList.toggle('active',n===step);el.classList.toggle('done',typeof step==='number'&&n<step);if(n>=3) el.classList.toggle('locked',!state.result);});
  $('#basket').hidden=(step===4||step==='lib');$('#basket').dataset.step=step;
  $('#stageMain').scrollTop=0;
}
$$('.wf-step').forEach(el=>el.addEventListener('click',()=>{if(el.classList.contains('locked')){toast('先にアイデアを入力して AI 合成を実行してください');return}go(+el.dataset.step)}));
$('#brand').addEventListener('click',()=>go(1));
$('#btnNext1').addEventListener('click',()=>go(2));
$('#btnLibrary').addEventListener('click',()=>{renderLib();go('lib')});

/* ---------- Step 1 ---------- */
function renderFacs(){
  $('#facStrip').innerHTML=FACTORIES.map(f=>`<div class="fac ${state.fac===f.id?'sel':''}" data-id="${f.id}"><div class="fn">${f.name}</div><div class="fr">${f.region} · ${TECH.filter(t=>t.fac===f.id).length} 技術</div><div class="ft">${f.type}</div></div>`).join('');
  $$('.fac').forEach(el=>el.addEventListener('click',()=>{state.fac=state.fac===el.dataset.id?null:el.dataset.id;renderFacs();renderTechs()}));
}
function renderTechs(){
  const q=state.q.trim();
  const list=TECH.filter(t=>(!state.fac||t.fac===state.fac)&&(!state.fRole||t.role===state.fRole)&&(!state.fInd||t.ind[state.fInd])&&(!q||[t.name,t.desc,...t.tags,...t.mat,FAC[t.fac].name].some(s=>s.includes(q))));
  $('#techCount').textContent=`${list.length} / ${TECH.length} 技術を表示${state.fac?' · '+FAC[state.fac].name:''}`;
  $('#techGrid').innerHTML=list.map(t=>{const sel=state.sel.includes(t.id);return `<div class="tech ${sel?'sel':''}" data-id="${t.id}" tabindex="0" role="button" aria-pressed="${sel}">
    <div class="th">${rolePill(t.role)}<div><div class="tn">${t.name}</div><div class="tf">${FAC[t.fac].name} · ${FAC[t.fac].region}</div></div></div>
    <div class="td">${t.desc}</div>
    <div class="tt">${t.tags.map(x=>`<span class="tag">${x}</span>`).join('')}</div>
    <div class="tm"><span>${t.smin}–${t.smax}mm</span><span>${t.prec}</span><span>lot ${fmtNum(t.lmin)}–${fmtNum(t.lmax)}</span><span>TRL ${t.trl}</span></div>
    <div class="tadd" aria-hidden="true">${sel?'✓':'+'}</div></div>`}).join('')||`<div class="muted" style="padding:20px">該当する技術がありません。</div>`;
  $$('.tech').forEach(el=>{const h=()=>toggleTech(el.dataset.id);el.addEventListener('click',h);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();h()}})});
}
function toggleTech(id){
  const i=state.sel.indexOf(id);
  if(i>=0) state.sel.splice(i,1); else { if(state.sel.length>=MAX_SEL){toast(`選択できるのは ${MAX_SEL} 件までです`);return} state.sel.push(id); }
  renderTechs();renderBasket();
}
function renderBasket(){
  $('#basketCap').textContent=`${state.sel.length} / ${MAX_SEL}`;
  $('#basketBody').innerHTML=state.sel.length?state.sel.map(id=>{const t=T[id];return `<div class="bitem"><div class="rolebar" style="background:${ROLE_COLOR[t.role]}"></div><div style="min-width:0"><div class="bt">${t.name}</div><div class="bm">${t.role} · ${FAC[t.fac].name}</div></div><button class="bx" data-id="${id}" title="外す" aria-label="外す">×</button></div>`}).join(''):`<div class="basket-empty">技術をクリックして追加<br><span class="small">空のままでも、AI が仮説から選びます</span></div>`;
  $$('.bx').forEach(b=>b.addEventListener('click',()=>toggleTech(b.dataset.id)));
  const roles=new Set(state.sel.map(id=>T[id].role));
  $('#coverage').innerHTML=ROLES.map(r=>`<span class="cov ${roles.has(r)?'on':''}" title="${ROLE_DESC[r]}"><span class="sw" style="${roles.has(r)?'background:'+ROLE_COLOR[r]:''}"></span>${r}</span>`).join('');
  $('#projMeta').textContent=`選択 ${state.sel.length} 技術 / ${new Set(state.sel.map(id=>T[id].fac)).size} 工場`;
}
$('#q').addEventListener('input',e=>{state.q=e.target.value;renderTechs()});
$('#fRole').innerHTML+=ROLES.map(r=>`<option>${r}</option>`).join('');$('#fRole').addEventListener('change',e=>{state.fRole=e.target.value;renderTechs()});
$('#fInd').innerHTML+=INDUSTRIES.map(r=>`<option>${r}</option>`).join('');$('#fInd').addEventListener('change',e=>{state.fInd=e.target.value;renderTechs()});
$('#fClear').addEventListener('click',()=>{state.q='';state.fRole='';state.fInd='';state.fac=null;$('#q').value='';$('#fRole').value='';$('#fInd').value='';renderFacs();renderTechs()});

/* ---------- Step 2 ---------- */
function renderScen(){
  $('#scenList').innerHTML=SCENARIOS.map((s,i)=>`<button data-i="${i}"><div class="st">${s.tag}</div><div class="sn">${s.name}</div><div class="sm">${s.meta} · ${s.techs.length} 技術をセット</div></button>`).join('');
  $$('#scenList button').forEach(b=>b.addEventListener('click',()=>{const s=SCENARIOS[+b.dataset.i];state.sel=[...s.techs];state.idea=s.idea;state.form=s.form;state.lot=+s.lot;state.prio=[...s.prio];$('#idea').value=s.idea;syncOpts();renderTechs();renderBasket();$('#projName').textContent=s.name;toast('シナリオを読み込みました')}));
}
function syncOpts(){
  $$('#segForm button').forEach(b=>b.classList.toggle('on',b.dataset.v===state.form));
  $$('#segLot button').forEach(b=>b.classList.toggle('on',+b.dataset.v===state.lot));
  $('#prioChips').innerHTML=PRIORITIES.map(p=>`<span class="chip btn-like ${state.prio.includes(p)?'sel':''}" data-p="${p}" role="button" tabindex="0">${p}</span>`).join('');
  $$('#prioChips .chip').forEach(c=>c.addEventListener('click',()=>{const p=c.dataset.p;const i=state.prio.indexOf(p);if(i>=0)state.prio.splice(i,1);else if(state.prio.length<3)state.prio.push(p);else toast('重視点は 3 つまで');syncOpts()}));
  $('#autoPick').checked=state.autoPick;
  $('#synthHint').textContent=state.sel.length?`${state.sel.length} 技術を核に合成します`:'技術が未選択のため、仮説から AI が選びます';
}
$$('#segForm button').forEach(b=>b.addEventListener('click',()=>{state.form=b.dataset.v;syncOpts()}));
$$('#segLot button').forEach(b=>b.addEventListener('click',()=>{state.lot=+b.dataset.v;syncOpts()}));
$('#autoPick').addEventListener('change',e=>state.autoPick=e.target.checked);
$('#idea').addEventListener('input',e=>{state.idea=e.target.value;if(!$('#projName').dataset.manual){const p=parseIdea(state.idea);$('#projName').textContent=p.noun?`${p.noun}の企画`:(state.idea.slice(0,14)||'新規セッション')}});
$('#btnSynth').addEventListener('click',runSynthesis);

/* ---------- Step 3 ---------- */
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let logT0=0;
function logLine(text,cls){const t=((performance.now()-logT0)/1000).toFixed(2);const el=document.createElement('div');el.className='ln';el.innerHTML=`<span class="ts">${t}s</span><span class="${cls||''}">${text}</span>`;const th=$('#think');const cur=th.querySelector('.cursor');if(cur)cur.remove();th.appendChild(el);th.appendChild(Object.assign(document.createElement('span'),{className:'cursor'}));th.scrollTop=th.scrollHeight}
async function runSynthesis(){
  if(state.running) return;
  if(!state.sel.length&&!state.idea.trim()){toast('技術を選ぶか、アイデアを入力してください');return}
  if(!state.sel.length&&!state.autoPick){state.autoPick=true;$('#autoPick').checked=true}
  state.running=true;state.result=null;
  $$('.wf-step').forEach(el=>{if(+el.dataset.step>=3)el.classList.remove('locked')});
  go(3);$('#results').hidden=true;$('#think').innerHTML='';$('#prog').style.width='0%';logT0=performance.now();
  const opts={form:state.form,lot:state.lot,prio:[...state.prio],autoPick:state.autoPick};
  const steps=[[`技術ベースを走査 … ${TECH.length} 技術 / ${FACTORIES.length} 工場`,'',6],[`選択技術 ${state.sel.length} 件の役割を分類 → ${uniq(state.sel.map(id=>T[id].role)).join('・')||'（なし）'}`,'',14],[`アイデア文を解析 … 産業語 ${Object.keys(parseIdea(state.idea).inds).join('・')||'なし'} / 特性語 ${[...parseIdea(state.idea).feats].join('・')||'なし'}`,'',24]];
  for(const [t,c,p] of steps){logLine(t,c);$('#prog').style.width=p+'%';await sleep(260)}
  let res;
  try{
    if(opts.autoPick){const add=autoPick(state.sel,parseIdea(state.idea),opts);logLine(add.length?`役割の穴を補完 → ${add.map(id=>T[id].name).join('、')}`:'役割カバレッジは十分。補完なし','hi');await sleep(260)}
    $('#prog').style.width='36%';
    logLine(`相乗効果ルール ${SYNERGY.length} 件を照合 …`);await sleep(220);
    const pre=analyze(state.sel,state.idea,opts);
    logLine(`→ ${pre.synergies.length} 件が成立${pre.synergies.length?'： '+pre.synergies.map(s=>s.name).join(' / '):''}`,pre.synergies.length?'ok':'wn');$('#prog').style.width='52%';await sleep(260);
    logLine(`スケール・材料・ロットの整合性を検査 → 警告 ${pre.compat.warnings.filter(w=>w.lv==='warn').length} 件`,pre.compat.warnings.some(w=>w.lv==='warn')?'wn':'ok');$('#prog').style.width='62%';await sleep(220);
    logLine(`産業適合度を算出 → 上位: ${pre.industries.slice(0,3).map(x=>`${x.name} ${x.score}`).join(' / ')}`);$('#prog').style.width='72%';await sleep(220);
    if(state.cfg.mode==='live'&&state.cfg.key){
      $('#prog').style.width='78%';
      try{ res=await analyzeLive(state.sel,state.idea,opts,state.cfg,logLine); }
      catch(e){ logLine('Claude API エラー: '+e.message+' → ローカル推論にフォールバック','wn'); res=pre; }
    } else { res=pre; logLine('ローカル推論でコンセプトを生成 …','hi');await sleep(300); }
    $('#prog').style.width='90%';
    logLine(`3 案を生成 → ${res.concepts.map(c=>c.formLabel).join(' / ')}`,'ok');await sleep(200);
    logLine('概念図面・工程フロー・検証プランを作成 … 完了','ok');$('#prog').style.width='100%';
  }catch(e){ logLine('エラー: '+e.message,'wn'); state.running=false; return; }
  state.result=res;state.concept=0;state.running=false;
  renderResults(res);renderDesign();
  $('#results').hidden=false;$('#results').classList.add('fade-in');
}
function renderResults(res){
  $('#resTitle').textContent=res.title;
  $('#synthTitle').textContent=`AI 合成 — ${res.title}`;
  $('#synthSub').textContent=`${res.tagline}${res.mode==='live'?' · Claude API（'+state.cfg.model+'）による生成':' · ローカル推論（ルールベース）'}`;
  $('#resSummary').innerHTML=res.summary.map(p=>`<p>${p}</p>`).join('');
  $('#resSyn').innerHTML=res.synergies.length?res.synergies.map(s=>`<div class="syn"><div class="sn">${s.name}</div><div class="se">${s.effect}</div><div class="sx">${s.techs.map(id=>`<span class="chip"><span class="role-dot" style="background:${ROLE_COLOR[T[id].role]}"></span>${T[id].name}</span>`).join('')}${s.industries.map(i=>`<span class="tag">${i}</span>`).join('')}</div></div>`).join(''):`<div class="callout warn">相乗効果ルールへの一致はありません。役割の異なる技術（例：表面＋機能、接合＋計測）を足すと、名前の付く価値が生まれやすくなります。</div>`;
  const cov=res.coverage;
  $('#resCov').innerHTML=`<div class="coverage" style="margin-bottom:10px">${ROLES.map(r=>`<span class="cov ${cov.roles.includes(r)?'on':''}"><span class="sw" style="${cov.roles.includes(r)?'background:'+ROLE_COLOR[r]:''}"></span>${r}</span>`).join('')}</div>
   ${res.added.length?`<div class="callout ok" style="margin-bottom:10px">AI が補完した技術：${res.added.map(id=>`<b>${T[id].name}</b>（${FAC[T[id].fac].name}）`).join('、')}</div>`:''}
   ${cov.recommended.length?`<div class="grid" style="gap:8px">${cov.recommended.map(r=>`<div class="card" style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px"><div>${rolePill(T[r.id].role)}</div><div style="min-width:0;flex:1"><div style="font-weight:600;font-size:12.5px">${T[r.id].name} <span class="muted small">· ${FAC[T[r.id].fac].name}</span></div><div class="small" style="color:var(--ink-soft)">${r.reason}</div></div><button class="btn sm" data-add="${r.id}">追加して再合成</button></div>`).join('')}</div>`:`<div class="small muted">追加を推奨する技術はありません。</div>`}`;
  $$('[data-add]').forEach(b=>b.addEventListener('click',()=>{if(state.sel.length>=MAX_SEL){state.sel.shift()}if(!state.sel.includes(b.dataset.add))state.sel.push(b.dataset.add);renderTechs();renderBasket();runSynthesis()}));
  $('#graph').innerHTML=graphSVG(res.ids,res.synergies);
  $('#resInd').innerHTML=res.industries.map(x=>`<div class="ind-row"><div class="in">${x.name}</div><div class="bar"><i style="width:${x.score}%"></i></div><div class="sc">${x.score}</div><div class="ir">${x.reasons.slice(0,3).join(' · ')}</div></div>`).join('');
  const all=[...res.compat.warnings,...res.compat.notes];
  $('#resCompat').innerHTML=all.length?all.map(w=>`<div class="callout ${w.lv}">${w.text}</div>`).join(''):`<div class="callout ok">整合性の問題は見つかりませんでした。</div>`;
}
$('#btnToDesign').addEventListener('click',()=>go(4));
$('#btnRerun').addEventListener('click',()=>go(2));

/* ---------- Step 4 ---------- */
function renderDesign(){
  const res=state.result;if(!res)return;
  $('#ctabs').innerHTML=res.concepts.map((c,i)=>`<button class="ctab ${i===state.concept?'on':''}" data-i="${i}"><div class="cf">案 ${'ABC'[i]} · ${c.formLabel}</div><div class="cn">${c.name}</div><div class="cm">${c.industries.join(' / ')} · ${c.sizeText}</div></button>`).join('');
  $$('.ctab').forEach(b=>b.addEventListener('click',()=>{state.concept=+b.dataset.i;renderDesign()}));
  const c=res.concepts[state.concept];
  $('#bp').innerHTML=blueprintSVG(c,res);
  render3D(c,res);
  $('#cName').textContent=c.name;
  $('#cDesc').innerHTML=c.desc;
  $('#cSpec').innerHTML=[['コード',`<span class="mono">${c.code}</span>`],['規模',c.formLabel],['外形（目安）',c.sizeText],['想定数量',c.lotText],['単価レンジ（概算）',c.costBand],['主材料',c.materials.join(' / ')||'—'],['提供先',c.industries.join(' / ')],['中核の相乗効果',c.coreSynergy||'—']].map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('');
  $('#radar').innerHTML=radarSVG(c.radar);
  $('#cTech').innerHTML=`<thead><tr><th>役割</th><th>技術</th><th>工場</th><th>この案での働き</th></tr></thead><tbody>${c.techs.map(id=>{const t=T[id];return `<tr data-tid="${id}"><td>${rolePill(t.role)}</td><td style="font-weight:600">${t.name}</td><td class="small">${FAC[t.fac].name}</td><td class="small">${roleInConcept(t,c,res)}</td></tr>`}).join('')}</tbody>`;
  $$('#cTech tr[data-tid]').forEach(tr=>{tr.addEventListener('mouseenter',()=>has3D()&&FX3D.hoverTech(tr.dataset.tid));tr.addEventListener('mouseleave',()=>has3D()&&FX3D.hoverTech(null));tr.addEventListener('click',()=>{if(!has3D())return;FX3D.focusTech(tr.dataset.tid);const v=$('#v3d');const r=v.getBoundingClientRect();if(r.top<0||r.bottom>innerHeight)v.scrollIntoView({behavior:'smooth',block:'center'})})});
  $('#cRisk').innerHTML=c.risks.map(r=>`<li>${r}</li>`).join('');
  $('#cNext').innerHTML=c.next.map(r=>`<li>${r}</li>`).join('');
  const f=res.process;
  $('#flow').innerHTML=f.steps.map(s=>`<div class="fstep"><div class="fb" style="border-top-color:${ROLE_COLOR[s.role]}"><div class="fr">${String(s.n).padStart(2,'0')} · ${s.role}</div><div class="fn">${s.name}</div><div class="ff">${s.facName}<br><span class="mono">${s.region}</span></div><div class="fd">${s.days} 日</div></div></div>`).join('');
  $('#flowTotal').textContent=`想定リードタイム 約 ${f.total} 日（工程間の受け渡しを含む）`;
  const h=res.hypothesis;
  $('#hypo').innerHTML=`<div style="font-size:13.5px;line-height:1.7;font-weight:500">${h.statement}</div><table class="t" style="margin-top:10px"><tbody>${h.tests.map(t=>`<tr><td style="white-space:nowrap;color:var(--brass);font-weight:600">${t.k}</td><td>${t.v}</td></tr>`).join('')}</tbody></table>`;
}
function roleInConcept(t,c,res){
  const s=res.synergies.find(s=>s.techs.includes(t.id));
  const base={材料:'製品の素材と基本特性を決める',成形:'主要形状を一度に作る',加工:'精度が必要な部位を仕上げる',接合:'異なる部品・材料をつなぐ',表面:'機能・意匠・耐久を表面で与える',機能:'電気・制御・センシングを担う',計測:'品質を測り、個体ごとに記録する',組立:'部品を製品に組み上げる'}[t.role];
  return s?`${base}。「${s.name}」の片側を担う`:base;
}
$('#btnSave').addEventListener('click',()=>{const r=state.result;if(!r)return;const item={id:Date.now().toString(36),name:r.title,ts:Date.now(),ids:r.ids,sel:[...state.sel],idea:state.idea,opts:r.opts,mode:r.mode,forms:r.concepts.map(c=>c.formLabel),inds:r.industries.slice(0,3).map(x=>x.name),result:r};state.lib.unshift(item);state.lib=state.lib.slice(0,30);store.set('lib',state.lib);$('#libCount').textContent=state.lib.length;toast('ライブラリに保存しました')});
$('#btnCopy').addEventListener('click',async()=>{const r=state.result;if(!r)return;const out={title:r.title,tagline:r.tagline,mode:r.mode,idea:r.idea,technologies:r.ids.map(id=>({id,name:T[id].name,factory:FAC[T[id].fac].name,role:T[id].role})),synergies:r.synergies,industries:r.industries,concepts:r.concepts.map(c=>({form:c.form,name:c.name,code:c.code,size:c.sizeText,lot:c.lotText,cost:c.costBand,industries:c.industries,radar:c.radar,risks:c.risks,next:c.next})),process:r.process,hypothesis:r.hypothesis};const txt=JSON.stringify(out,null,2);try{await navigator.clipboard.writeText(txt);toast('JSON をコピーしました')}catch(e){openModal(`<h3>提案 JSON</h3><div class="pre">${esc(txt)}</div><div class="actions"><button class="btn" data-close>閉じる</button></div>`)}});
$('#btnNew').addEventListener('click',()=>{state.sel=[];state.idea='';state.result=null;state.prio=[];state.form='auto';state.lot=100;$('#idea').value='';$('#projName').textContent='新規セッション';renderTechs();renderBasket();syncOpts();$$('.wf-step').forEach(el=>{if(+el.dataset.step>=3)el.classList.add('locked')});go(1)});


/* ---------- 3D ビューア連携 ---------- */
const has3D=()=>!!(window.FX3D&&FX3D.ready&&state.view==='3d');
function render3D(c,res){
  const ok3d=window.FX3D&&FX3D.available();
  if(!ok3d){ if(state.view==='3d'){state.view='2d';$('#v3d').innerHTML='<div class="v3d-fallback">この環境では WebGL が使えないため、概念図面を表示しています。</div>'} setView(state.view,true); return; }
  setView(state.view,true);
  if(!FX3D.show($('#v3d'),c,res)){state.view='2d';setView('2d',true);toast('3D 表示に失敗したため図面に切り替えました');return}
  renderPartMap();
  if(syncSize(c)) renderDesign();
}
/* 3D モデルの実寸を正として、仕様・図面・説明の外形を揃える */
function syncSize(c){
  const m=FX3D.measured(); if(!m) return false;
  const o=c.size; if(Math.abs(m.W-o.W)<=Math.max(1,o.W*0.02)&&Math.abs(m.D-o.D)<=Math.max(1,o.D*0.02)&&Math.abs(m.H-o.H)<=Math.max(1,o.H*0.02)) return false;
  if(!c.size0) c.size0={...o};
  const big=c.form==='大型', f=v=>big?(v/1000).toFixed(1):v;
  if(typeof c.desc==='string') c.desc=c.desc.split(`${f(o.W)}×${f(o.D)}×${f(o.H)}`).join(`${f(m.W)}×${f(m.D)}×${f(m.H)}`);
  c.size={...m}; c.sizeText=big?`約 ${f(m.W)} × ${f(m.D)} × ${f(m.H)} m`:`約 ${m.W} × ${m.D} × ${m.H} mm`;
  return true;
}
function renderPartMap(){
  const ps=FX3D.parts();
  $('#pmap').innerHTML=ps.map(p=>`<button class="pchip" data-tid="${p.techs[0]}" title="${p.techs.map(id=>T[id].name).join(' / ')}"><i style="background:${ROLE_COLOR[T[p.techs[0]].role]}"></i><b>${p.name}</b>${p.techs.map(id=>T[id].name.replace(/（.*?）/g,'')).join('・')}</button>`).join('');
  $$('#pmap .pchip').forEach(b=>{b.addEventListener('click',()=>FX3D.focusTech(b.dataset.tid));b.addEventListener('mouseenter',()=>FX3D.hoverTech(b.dataset.tid));b.addEventListener('mouseleave',()=>FX3D.hoverTech(null))});
}
function markTech(ids,cls){$$('#cTech tr[data-tid]').forEach(tr=>tr.classList.toggle(cls,ids.includes(tr.dataset.tid)));$$('#pmap .pchip').forEach(b=>b.classList.toggle(cls,ids.includes(b.dataset.tid)))}
function setView(v,silent){
  state.view=v;
  $$('#segView button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
  $('#v3d').hidden=v!=='3d';$('#bp').hidden=v!=='2d';$('#vtools').hidden=v!=='3d';$('#vfoot').hidden=v!=='3d';
  if(!silent&&v==='3d'&&state.result){render3D(state.result.concepts[state.concept],state.result)}
}
$$('#segView button').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.v==='3d'&&!(window.FX3D&&FX3D.available())){toast('この環境では 3D 表示を使えません');return}setView(b.dataset.v)}));
$('#vExplode').addEventListener('input',e=>window.FX3D&&FX3D.setExplode(e.target.value/100));
const pressToggle=(id,fn)=>$(id).addEventListener('click',e=>{const b=e.currentTarget;const on=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',on);fn(on)});
pressToggle('#vRole',on=>FX3D.setRoleMode(on));
pressToggle('#vSection',on=>FX3D.setSection(on));
pressToggle('#vLabels',on=>FX3D.setLabels(on));
$('#vReset').addEventListener('click',()=>FX3D.reset());
const exp=(fn,label)=>async()=>{try{await fn();toast(`${label} を書き出しました`)}catch(e){toast(`${label} の書き出しに失敗しました`)}};
$('#vGLB').addEventListener('click',exp(()=>FX3D.exportGLB(),'GLB'));
$('#vSTL').addEventListener('click',exp(()=>FX3D.exportSTL(),'STL'));
$('#vPNG').addEventListener('click',exp(()=>FX3D.exportPNG(),'PNG'));
if(window.FX3D){FX3D.onFocus=ids=>markTech(ids,'on');FX3D.onHover=ids=>markTech(ids,'hv')}

/* ---------- ライブラリ ---------- */
function renderLib(){
  $('#libCount').textContent=state.lib.length;
  $('#libGrid').innerHTML=state.lib.length?state.lib.map(it=>`<div class="lib-item" data-id="${it.id}"><div class="ln">${it.name}</div><div class="lm">${new Date(it.ts).toLocaleString('ja-JP')} · ${it.ids.length} 技術 · ${it.mode==='live'?'Claude API':'ローカル'}</div><div class="lt">${it.inds.map(i=>`<span class="tag">${i}</span>`).join('')}</div><div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${it.idea||'（アイデア未記入）'}</div><div style="display:flex;gap:6px;margin-top:4px"><button class="btn sm" data-open="${it.id}">開く</button><button class="btn sm ghost" data-del="${it.id}">削除</button></div></div>`).join(''):`<div class="muted">保存された提案はまだありません。デザイン画面の「ライブラリに保存」から追加できます。</div>`;
  $$('[data-open]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const it=state.lib.find(x=>x.id===b.dataset.open);state.sel=[...it.sel];state.idea=it.idea;$('#idea').value=it.idea;state.form=it.opts.form;state.lot=it.opts.lot;state.prio=[...it.opts.prio];state.result=it.result;state.concept=0;$('#projName').textContent=it.name;renderTechs();renderBasket();syncOpts();$$('.wf-step').forEach(el=>el.classList.remove('locked'));$('#think').innerHTML=`<div class="ln"><span class="ts">—</span><span class="ok">ライブラリから復元しました</span></div>`;$('#prog').style.width='100%';renderResults(it.result);renderDesign();$('#results').hidden=false;go(4)}));
  $$('[data-del]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();state.lib=state.lib.filter(x=>x.id!==b.dataset.del);store.set('lib',state.lib);renderLib()}));
}

/* ---------- 設定モーダル ---------- */
function openModal(html){$('#modalRoot').innerHTML=`<div class="modal-bg" id="modalBg"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;$$('[data-close]').forEach(b=>b.addEventListener('click',closeModal));$('#modalBg').addEventListener('click',e=>{if(e.target.id==='modalBg')closeModal()})}
function closeModal(){$('#modalRoot').innerHTML=''}
function openSettings(){
  openModal(`<h3>AI 推論モード</h3><div class="small muted">デモは既定でブラウザ内のルールベース推論で動きます。Claude API キーを設定すると、相乗効果・コンセプト・仮説の文章を Claude が生成します（補完・工程・図面はローカル）。</div>
   <div class="field"><label>モード</label><select id="cfgMode"><option value="local" ${state.cfg.mode==='local'?'selected':''}>ローカル推論（オフライン・即時）</option><option value="live" ${state.cfg.mode==='live'?'selected':''}>Claude API（要 API キー）</option></select></div>
   <div class="field"><label>Anthropic API キー（このブラウザにのみ保存）</label><input id="cfgKey" type="password" value="${esc(state.cfg.key||'')}" placeholder="sk-ant-…" autocomplete="off"></div>
   <div class="field"><label>モデル</label><select id="cfgModel">${['claude-opus-5-5','claude-sonnet-5-5','claude-haiku-5-5'].map(m=>`<option ${state.cfg.model===m?'selected':''}>${m}</option>`).join('')}</select></div>
   <div class="callout warn" style="margin-top:12px">ブラウザから直接 API を呼ぶため、API キーは閲覧者の端末に保存されます。本番ではサーバ経由にしてください。拒否応答や通信失敗時はローカル推論に自動フォールバックします。</div>
   <div class="actions"><button class="btn" data-close>キャンセル</button><button class="btn primary" id="cfgSave">保存</button></div>`);
  $('#cfgSave').addEventListener('click',()=>{state.cfg={mode:$('#cfgMode').value,key:$('#cfgKey').value.trim(),model:$('#cfgModel').value};if(state.cfg.mode==='live'&&!state.cfg.key){toast('API キーを入力してください');return}store.set('cfg',state.cfg);renderMode();closeModal();toast('設定を保存しました')});
}
function renderMode(){const b=$('#modeBadge');const live=state.cfg.mode==='live'&&state.cfg.key;b.textContent=live?`AI: Claude API · ${state.cfg.model}`:'AI: ローカル推論';b.classList.toggle('live',!!live)}
$('#btnSettings').addEventListener('click',openSettings);$('#modeBadge').addEventListener('click',openSettings);

/* ---------- 起動 ---------- */
renderFacs();renderTechs();renderBasket();renderScen();syncOpts();renderMode();$('#libCount').textContent=state.lib.length;
(function hashRoute(){const h=location.hash.replace('#','');if(h==='library'){renderLib();go('lib')}})();
</script>
</body>
</html>
