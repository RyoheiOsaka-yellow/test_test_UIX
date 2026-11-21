/* ══════════ 判定ロジック ══════════ */
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const KNUM={'〇':0,'零':0,'一':1,'壱':1,'二':2,'弐':2,'三':3,'参':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
function kanjiNum(s){s=String(s).trim();if(/^\d+$/.test(s))return +s;let t=0,cur=0;for(const ch of s){if(ch in KNUM)cur=cur*10+KNUM[ch];else if(ch==='十'||ch==='拾'){t+=(cur||1)*10;cur=0;}else if(ch==='百'){t+=(cur||1)*100;cur=0;}else return NaN;}return t+cur;}
const ERA_BASE={明治:1867,大正:1911,昭和:1925,平成:1988,令和:2018};
function waToYear(s){if(!s)return null;const m=String(s).match(/(明治|大正|昭和|平成|令和)\s*(元|[〇零一壱二弐三参四五六七八九十拾百\d]+)\s*年/);if(m){const n=m[2]==='元'?1:kanjiNum(m[2]);return isNaN(n)?null:ERA_BASE[m[1]]+n;}const w=String(s).match(/(1[89]\d\d|20\d\d)/);return w?+w[1]:null;}
function waDate(s){if(!s)return null;let m=String(s).match(/(明治|大正|昭和|平成|令和)\s*(元|\d+)\s*年\s*(\d+)\s*月(?:\s*(\d+)\s*日)?/);if(m)return new Date(ERA_BASE[m[1]]+(m[2]==='元'?1:+m[2]),+m[3]-1,m[4]?+m[4]:1);m=String(s).match(/(1[89]\d\d|20\d\d)\s*年[^\d]*?(\d{1,2})\s*月/);return m?new Date(+m[1],+m[2]-1,1):null;}
function toWareki(d,withDay){const y=d.getFullYear(),mo=d.getMonth()+1;const e=y>=2019?['令和',y-2018]:y>=1989?['平成',y-1988]:['昭和',y-1925];return `${e[0]}${e[1]===1?'元':e[1]}年${mo}月${withDay?d.getDate()+'日':''}`;}
const PREF_RE=/^(東京都|北海道|京都府|大阪府|[^\s\d]{2,3}県)/;
function prefOf(a){const m=String(a||'').match(PREF_RE);return m?m[1]:'';}
function cityOf(a){const m=String(a||'').replace(PREF_RE,'').match(/^(.+?市.+?区|.+?市|.+?区|.+?郡.+?[町村])/);return m?m[1]:'';}
function townOf(a){return String(a||'').replace(PREF_RE,'').replace(/^(.+?市.+?区|.+?市|.+?区|.+?郡.+?[町村])/,'').replace(/[\d０-９]+番.*$/,'').replace(/[\d０-９－-]+$/,'').trim();}
const fmtArea=n=>n?Number(n).toLocaleString('ja-JP',{maximumFractionDigits:2}):'—';
const resolveSame=maps=>{let p='';return (maps||[]).map(m=>{const u=/^同上$/.test(m.use||'')?p:(m.use||'');p=u;return {...m,useR:u};});};

/* 条例：都道府県条例＋（政令市等に独自条例があれば）市条例 */
function ordFor(pref,city){return ORD.filter(o=>o.pref===pref&&(!o.city||(city&&city.indexOf(o.city)===0))&&!(o.excludeCities||[]).some(x=>city&&city.indexOf(x)===0));}
function ordVerified(o){return (o.rules||[]).some(r=>r.verified&&r.url);}

/* 業種の読み取り：登記名義人・法人目的・地図上の用途・ヒアリングから */
function matchInd(text){const t=String(text||'');return IND.filter(i=>i.re.test(t));}
function detectConcerns(c){
  const out=[];const seen=new Set();
  const add=(ind,use,period,basis,ref)=>{const k=ind.id+'|'+use;if(seen.has(k))return;seen.add(k);out.push({period,use,industry:ind.id,parcels:(c.site.parcels||[]).map(p=>p.chiban),basis,ref,auto:true,resolved:!!ind.soft&&!ind.subs.length?undefined:undefined});};
  (c.corps||[]).forEach(co=>{const t=(co.name||'')+' '+(co.purpose||[]).join(' ');matchInd(t).forEach(i=>add(i,co.name,co.est?co.est+'～':'',`法人登記（${co.name}）の目的`,co.ref));});
  resolveSame(c.maps).forEach(m=>matchInd(m.useR).forEach(i=>add(i,m.useR,m.y+'年頃',`${m.src}（${m.y}年）`,c.mapsRef)));
  (c.land||[]).forEach(l=>l.rows.forEach(r=>{if(/株式会社|有限会社|合名|合資|㈱|㈲/.test(r.holder||''))matchInd(r.holder).forEach(i=>add(i,r.holder,r.date+'～','登記名義人（'+l.chiban+'）',l.ref));}));
  (c.hearing||[]).forEach(h=>matchInd(h.text).filter(i=>!i.soft).forEach(i=>add(i,'ヒアリングでの言及',h.date,'ヒアリング（'+(h.target||'')+'）',h.ref)));
  /* 同じ業種の手がかりは1件にまとめる（名称・根拠は併記） */
  const by={};out.forEach(x=>{const g=by[x.industry];if(!g){by[x.industry]={...x,_uses:[x.use],_basis:[x.basis],_per:[x.period]};return;}
    if(!g._uses.some(u=>u.indexOf(x.use)>=0||x.use.indexOf(u)>=0))g._uses.push(x.use);if(!g._basis.includes(x.basis))g._basis.push(x.basis);g._per.push(x.period);});
  return Object.values(by).map(g=>{const ys=g._per.map(waToYear).filter(Boolean);const longest=g._uses.slice().sort((a,b)=>b.length-a.length)[0];
    const o={...g,use:g._uses.length>1&&g._uses.every(u=>longest.indexOf(u)>=0)?longest:g._uses.join('／'),basis:g._basis.join('、'),period:ys.length?Math.min(...ys)+'年頃～':g._per[0]};delete o._uses;delete o._basis;delete o._per;return o;});
}
function selectSubstances(c){
  const ids=new Set(),extra=new Set();
  (c.concerns||[]).filter(x=>!x.resolved).forEach(x=>{const i=INDBY[x.industry];if(!i)return;i.subs.forEach(s=>ids.add(s));(i.extra||[]).forEach(e=>extra.add(e));});
  return {ids:SUB.filter(s=>ids.has(s.id)).map(s=>s.id),extra:[...extra]};
}
function openConcerns(c){return (c.concerns||[]).filter(x=>!x.resolved);}
function verdictOf(c){
  const open=openConcerns(c);
  if(!open.length){const res=(c.concerns||[]).filter(x=>x.resolved);
    return {level:'低い',headline:'土壌汚染の可能性は低いと判断する。',text:'対象地における製造事業等の利用履歴及び「土壌汚染対策法」に規定する特定有害物質の使用等'+(res.length?`に関する履歴事項は無かったが、過去に${res.map(x=>x.use).join('、')}の利用が確認された。しかしながら、${res.map(x=>x.resolveNote||'有害物質の使用は確認されなかった').join('。また、')}ことから、土壌汚染の可能性は低いものと判断する。`:'は確認されなかった。よって、土壌汚染の可能性は低いものと判断する。')};}
  const parts=open.map(x=>`${x.period?x.period+'に':''}${x.use}としての利用履歴がある事が${x.basis}にて確認が取れた`);
  const inds=[...new Set(open.map(x=>INDBY[x.industry]&&INDBY[x.industry].label).filter(Boolean))];
  return {level:'否定できない',headline:'土壌汚染の可能性は否定できないと判断する。',text:`対象地上にて${parts.join('。また、')}。${inds.length?'「'+inds.join('」「')+'」と位置付け、':''}当時の有害物質の使用状況を示す記録・証言が得られていないことから、対象敷地での土壌汚染の可能性は否定できないと判断する。`};
}

/* 適用条項の判定（何条に当たる調査か） */
function judge(c){
  const rq=c.request||{};const s=c.site||{};const g=c.regs||{};const area=+s.area||0;const ch=rq.formChange?(+rq.changeArea||area):0;
  const hasFac=/あり|有/.test((g.suidaku&&g.suidaku.v)||'')||/あり|有/.test((g.gesui&&g.gesui.v)||'');
  const inZone=[g.art6,g.art11jin,g.art11shizen,g.art11umetate].some(v=>/あり|有/.test(v||''));
  const rows=[];
  const L=(art,title,st,why,key)=>rows.push({src:'法',law:'土壌汚染対策法',art,title,st,why,cite:lawCite(key)});
  L('第3条第1項','有害物質使用特定施設の使用の廃止時の調査',rq.purpose==='closure'?(hasFac?['yes','該当']:['maybe','施設の届出を確認']):hasFac?['maybe','廃止時に該当']:!(g.suidaku&&g.suidaku.v)?['todo','届出を未照会']:['no','非該当'],
    hasFac?'水質汚濁防止法・下水道法の有害物質使用特定施設の届出がある。':`水質汚濁防止法・下水道法に基づく有害物質使用特定施設：${(g.suidaku&&g.suidaku.v)||'未照会'}${g.suidaku&&g.suidaku.src?'（'+g.suidaku.src+'）':''}`,'art3');
  L('第4条第1項','3,000㎡以上（有害物質使用特定施設のある工場等は900㎡以上）の土地の形質の変更の届出',
    !rq.formChange?['no','形質変更の予定なし']:ch>=3000?['yes','届出対象']:(ch>=900&&hasFac)?['yes','届出対象（900㎡）']:['no','面積要件に非該当'],
    rq.formChange?`形質変更面積 ${fmtArea(ch)}㎡（敷地 ${fmtArea(area)}㎡）`:`敷地面積 ${fmtArea(area)}㎡。形質変更を行う場合は面積を入力して再判定`,'art4');
  L('第5条第1項','土壌汚染により健康被害が生ずるおそれがある土地の調査命令',rq.purpose==='order'?['maybe','命令の有無を確認']:['no','命令なし'],'都道府県知事等の命令による調査','art5');
  L('第14条第1項','自主調査の結果による区域指定の申請',rq.purpose==='sale'||rq.purpose==='develop'?['info','任意で申請可']:['info','—'],'法に基づかない調査で基準不適合が判明した場合、所有者等は区域指定を申請できる。本地歴調査はその前段。','art14');
  L('第6条・第11条','要措置区域・形質変更時要届出区域の指定',inZone?['yes','区域内']:!(g.art6||g.art11jin)?['todo','未確認']:['no','指定なし'],g.zoneSrc?`確認先：${g.zoneSrc}${g.radius?'、'+g.radius:''}`:'区域指定の公表資料を確認','art6');
  ordFor(s.pref,s.city).forEach(o=>(o.rules||[]).forEach(r=>{
    let st,why;const rec=(g.ord||[]).find(x=>x.name&&o.name.indexOf(x.name.replace(/（.*$/,''))===0||x.name===o.name);
    if(r.trigger==='area'){const th=+r.threshold||0;const site=r.areaBasis==='site';const hit=rq.formChange&&(site?area:ch)>=th;
      st=!th?['maybe','閾値を確認']:!rq.formChange?['no','形質変更の予定なし']:!hit?['no','面積要件に非該当']:r.cond?['maybe',r.condLabel||'条件に当たれば対象']:['yes','届出・調査の対象'];
      why=`${site?'敷地面積':'形質変更の面積'} ${th?th.toLocaleString()+'㎡以上':''}${r.cond?'（'+r.cond+'）':''}。本件：敷地 ${fmtArea(area)}㎡${rq.formChange?'、形質変更 '+fmtArea(ch)+'㎡':''}`;}
    else if(r.trigger==='facility'){st=rq.purpose==='closure'?['maybe','対象事業場か確認']:openConcerns(c).length?['maybe','事業場の届出履歴を確認']:['no','該当の手がかりなし'];why=r.summary||r.duty||'';}
    else if(r.trigger==='other'){st=['info','参考'];why=r.summary||r.duty||'';}
    else {st=rec?['done','確認済：'+rec.v]:['todo','未確認'];why=rec?`${rec.item||r.heading||''}：${rec.v}`:(r.summary||'条例に基づく台帳・区域の有無を窓口または公表資料で確認する');}
    rows.push({src:'条例',law:o.name,art:r.art,title:r.heading||r.summary||'',st,why,cite:{url:r.url,quote:r.quote,verified:!!(r.verified&&r.url),checkedOn:o.checkedOn}});
  }));
  return rows;
}
function lawCite(key){const a=(LAWS.articles||[]).find(x=>x.key===key);return a?{url:a.url,quote:a.quote,verified:!!a.verified,checkedOn:LAWS.checkedOn}:{url:'',quote:'',verified:false};}
function positionText(c){
  const rq=c.request||{};const J=judge(c);const yes=J.filter(r=>r.st[0]==='yes');
  const base={sale:'本調査は、土地の売買に先立って土壌汚染のおそれを把握するために行う自主的な地歴調査であり、土壌汚染対策法第3条、第4条及び第5条に基づく調査義務によるものではない。',
    develop:'本調査は、土地の形質の変更に先立って土壌汚染のおそれを把握するために行う地歴調査である。',
    closure:'本調査は、工場・事業場の廃止に伴い土壌汚染のおそれを把握するために行う地歴調査である。',
    order:'本調査は、行政からの求めに応じて土壌汚染のおそれを把握するために行う地歴調査である。'}[rq.purpose||'sale'];
  return base+(yes.length?'なお、'+yes.map(r=>`${r.law}${r.art}（${r.title}）`).join('、')+'に該当する。':'');
}

/* 確認が必要な点だけを集める（人が見る項目を最小にする） */
function reviewItems(c){
  const R=[];const add=(sev,area,text,anchor,ref)=>R.push({id:'r'+R.length,sev,area,text,anchor,ref});
  (c.diffs||[]).forEach(d=>add(d.sev,'原本との照合',d.text,null,d.ref));
  (c.land||[]).forEach((l,i)=>{const u=l.rows.filter(r=>r.unclear);if(u.length)add('warn','登記簿',`${l.chiban}：名義人の判読が不明瞭な行が${u.length}件（${u.slice(0,3).map(r=>r.holder).join('、')}${u.length>3?' ほか':''}）。添付A 登記簿謄本で照合。`,'sec-22',l.ref);
    l.rows.filter(r=>r.flag).forEach(r=>add('warn','登記簿',`${l.chiban} ${r.date}：${r.flag}`,'sec-22',l.ref));});
  (c.corps||[]).filter(x=>x.flag).forEach(x=>add('warn','法人',`${x.name}：${x.flag}`,'sec-22',x.ref));
  (c.hearing||[]).filter(h=>h.flag).forEach(h=>add('bad','ヒアリング',h.flag,'sec-24',h.ref));
  const s=c.site||{};const sum=(s.parcels||[]).reduce((a,p)=>a+(+p.chiseki||0),0);
  if((s.parcels||[]).length&&(s.parcels||[]).every(p=>+p.chiseki>0)&&Math.abs(sum-(+s.area||0))>0.01)add('bad','地積',`筆一覧の合計 ${sum.toFixed(2)}㎡ と敷地面積 ${s.area}㎡ が一致しない。`,'sec-11');
  const maps=resolveSame(c.maps);let asc=0,wa=0;maps.forEach((m,i)=>{if(i&&m.y<maps[i-1].y)asc++;const wy=waToYear(m.w);if(wy&&wy!==m.y)wa++;});
  if(asc)add('warn','地図年次',`年次が${asc}箇所で昇順になっていない。`,'sec-23',c.mapsRef);
  if(wa)add('bad','地図年次',`西暦と和暦が${wa}箇所で食い違う。`,'sec-23',c.mapsRef);
  const open=openConcerns(c);
  if(open.length&&!(c.hearing||[]).length)add('warn','ヒアリング','事業場としての利用履歴があるが、ヒアリングの記録がない。','sec-24');
  if(c.verdict&&c.verdict.level==='低い'&&open.length)add('bad','所見',`未解消の懸念（${open.map(x=>x.use).join('、')}）があるのに所見が「低い」。`,'sec-3');
  if(c.verdict&&c.verdict.level==='否定できない'&&!open.length)add('warn','所見','所見は「否定できない」だが、根拠となる利用履歴が登録されていない。','sec-3');
  open.forEach(x=>{const i=INDBY[x.industry];if(i&&!i.subs.length)add('warn','対象物質',`「${x.use}」（${i.label}）は公式資料・社内実績の登録がなく、物質を自動選定していない。担当者が選定する。`,'sec-4');});
  judge(c).filter(r=>r.st[0]==='todo'&&r.src==='条例').forEach(r=>add('warn','条例',`${r.law} ${r.art}：${r.title||'台帳・区域'}の確認結果が未記入。`,'sec-243'));
  judge(c).filter(r=>r.src==='条例'&&!r.cite.verified).slice(0,1).forEach(r=>add('info','条例',`${r.law}に、公式出典での確認が済んでいない条項がある。法令・条例の画面で状態を確認。`,null));
  const g=c.regs||{};[['水質汚濁防止法の特定施設',g.suidaku&&g.suidaku.v],['下水道法の特定施設',g.gesui&&g.gesui.v],['法第6条 要措置区域',g.art6],['法第11条 形質変更時要届出区域',g.art11jin]].filter(x=>!x[1]).forEach(x=>add('warn','公的機関の環境情報',x[0]+'の確認結果が未記入。','sec-243'));
  if(s.gwElev)add('warn','地下水','地下水流向は標高（国土地理院 標高API）からの自動推定。治水地形分類図と周辺の河川・海域の位置で確認する。流速・到達距離の計算は未搭載。','sec-21');
  if(!s.gwText)add('warn','地下水','地下水流向の記載がない。位置を確定すると標高から流向を推定できる。','sec-21');
  if(!(c.land||[]).length)add('warn','登記簿','登記簿謄本が読み込まれていない。','sec-22');
  if(!(c.maps||[]).length)add('warn','地図・空中写真','地形図・住宅地図・空中写真の利用履歴が未登録。','sec-23');
  const done=new Set(c.reviewed||[]);R.forEach(r=>{r.key=r.area+'|'+r.text.slice(0,40);r.done=done.has(r.key);});
  const ord={bad:0,warn:1,info:2};return R.sort((a,b)=>(a.done-b.done)||(ord[a.sev]-ord[b.sev]));
}

/* 出典一覧：本文で使う公式出典に通し番号を振る */
function sourcesOf(c){
  const S=[];const push=(kind,title,detail,url,verified,checkedOn)=>{S.push({n:S.length+1,kind,title,detail,url,verified,checkedOn});return S.length;};
  LAWS.items.forEach(l=>push('法令',l.name,`${l.number}${l.lastAmended?'（最終改正：'+l.lastAmended+'）':''}`,l.url,l.verified,LAWS.checkedOn));
  ordFor(c.site.pref,c.site.city).forEach(o=>push('条例',o.name,`${o.number||''}${(o.lastAmendedShort||o.lastAmended)?'（最終改正：'+(o.lastAmendedShort||o.lastAmended)+'）':''}`,(o.rules.find(r=>r.url)||{}).url||(o.pages&&o.pages[0]&&o.pages[0].url)||'',ordVerified(o),o.checkedOn));
  const g=c.regs||{};
  if(g.suidaku&&g.suidaku.src)push('行政照会','水質汚濁防止法・下水道法の特定施設の届出',`${g.suidaku.src}${g.gesui&&g.gesui.src&&g.gesui.src!=='同上'?'、'+g.gesui.src:''}${g.suidaku.date?'（'+g.suidaku.date+'照会）':''}`,'',true);
  if(g.zoneSrc)push('行政公表','土壌汚染対策法に基づく区域の指定状況',g.zoneSrc,'',true);
  push('公的地図','治水地形分類図・地理院タイル','国土交通省国土地理院 電子国土web',DATASRC[0].url,true);
  const used=[...new Set(openConcerns(c).map(x=>INDBY[x.industry]).filter(i=>i&&i.src.type!=='none'))];
  used.forEach(i=>{const n=push(i.src.type==='moe'?'環境省資料':'社内実績',`業種と特定有害物質：${i.label}`,i.src.cite,i.src.type==='moe'&&i.official?i.official.url:'',i.src.type==='moe',LAWS.checkedOn);S[n-1].own=i.src.type==='eco';
    if(i.src.type==='eco'&&i.official)push('環境省資料',`公式統計：${i.label}`,i.official.text,i.official.url,true,LAWS.checkedOn);});
  return S;
}
