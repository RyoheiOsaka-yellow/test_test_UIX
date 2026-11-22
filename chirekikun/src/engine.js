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
  const add=(ind,use,period,basis,ref)=>{const k=ind.id+'|'+use;if(seen.has(k))return;seen.add(k);out.push({period,use,industry:ind.id,parcels:(c.site.parcels||[]).map(p=>p.chiban),basis,ref,auto:true});};
  (c.corps||[]).forEach(co=>{const t=(co.name||'')+' '+(co.purpose||[]).join(' ');matchInd(t).forEach(i=>add(i,co.name,co.est?co.est+'～':'',`法人登記（${co.name}）の目的`,co.ref));});
  resolveSame(c.maps).forEach(m=>matchInd(m.useR).forEach(i=>add(i,m.useR,m.y+'年頃',`${m.src}（${m.y}年）`,c.mapsRef)));
  (c.land||[]).forEach(l=>l.rows.forEach(r=>{if(/株式会社|有限会社|合名|合資|㈱|㈲/.test(r.holder||''))matchInd(r.holder).forEach(i=>add(i,r.holder,r.date+'～','登記名義人（'+l.chiban+'）',l.ref));}));
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
/* ══ 指定区域の公表台帳（自治体が公表している一覧の写し）との照合 ══
   ZONES は tools/fetch_zones.py が公式ページから取得して作る（registry/zones.json）。
   行：s=出典ID、k=区域の種類（6=要措置区域、11=形質変更時要届出区域、ord=条例の区域）、sub=細分、city・town・lot=所在地、no=指定番号、date=指定年月日、lat・lng=町丁目の代表点 */
let ZONES={checkedOn:'',sources:[],rows:[]};
const KAN1='〇一二三四五六七八九';
const numKan=n=>n<10?KAN1[n]:n<20?'十'+(n%10?KAN1[n%10]:''):n<100?KAN1[Math.floor(n/10)]+'十'+(n%10?KAN1[n%10]:''):String(n);
const normTown=t=>String(t||'').replace(/[\s　]/g,'').replace(/[０-９]/g,d=>String.fromCharCode(d.charCodeAt(0)-65248)).replace(/(\d+)丁目/g,(m,n)=>numKan(+n)+'丁目').replace(/[ケｹ]/g,'ヶ').replace(/大字|字/g,'');
const zoneSource=s=>(ZONES.sources||[]).find(x=>x.pref===s.pref&&(!x.cities||x.cities.some(c=>(s.city||'').indexOf(c)===0))&&!(x.exclude||[]).some(c=>(s.city||'').indexOf(c)===0))||null;
/* 対象地と同じ町丁目、または町丁目の代表点どうしで1.5km以内の指定区域を拾う（1.0km圏の判定に、町丁目の広がり0.5kmの余裕を見る） */
function zoneCheck(c){
  const s=c.site||{};const src=zoneSource(s);if(!src)return null;const tn=normTown(s.town);
  const km=(a,b,c2,d)=>{const p=Math.PI/180;return Math.hypot((d-b)*p*Math.cos((a+c2)/2*p),(c2-a)*p)*6371;};
  const hits=[];ZONES.rows.forEach(r=>{if(r.s!==src.id)return;const same=r.city===s.city&&normTown(r.town)===tn;const d=s.lat&&r.lat?km(s.lat,s.lng,r.lat,r.lng):null;if(same||(d!=null&&d<=1.5))hits.push({...r,same,d});});
  hits.sort((a,b)=>(b.same-a.same)||((a.d||0)-(b.d||0)));
  return {src,checkedOn:ZONES.checkedOn,geo:!!s.lat,hits};
}
/* 未記入の欄だけを台帳との照合結果で埋める。人や行政回答が入れた値は変えない */
function applyZoneCheck(c){
  const g=c.regs||(c.regs={ord:[]});if(g.zoneAuto&&g.zoneAuto.checkedOn===ZONES.checkedOn)return g.zoneAuto;
  const empty=['art6','art11jin','art11shizen','art11umetate'].filter(f=>!g[f]);if(!empty.length)return null;
  const z=zoneCheck(c);if(!z)return null;
  const pick=f=>z.hits.filter(h=>f==='art6'?h.k==='6':f==='art11jin'?h.k==='11'&&!/自然|埋立/.test(h.sub||''):f==='art11shizen'?h.k==='11'&&/自然/.test(h.sub||''):h.k==='11'&&/埋立/.test(h.sub||''));
  const cnt=hs=>{const a=hs.filter(h=>h.same).length,b=hs.length-a;return [a?`同じ町丁目に${a}件`:'',b?`周辺に${b}件`:''].filter(Boolean).join('、');};
  empty.forEach(f=>{const hs=pick(f);g[f]=hs.length?`要確認（${cnt(hs)}）`:'なし';});
  if(!g.zoneSrc)g.zoneSrc=`${z.src.name}（${z.src.updated||z.checkedOn+'取得'}）`;if(!g.radius&&z.geo)g.radius='半径1.0km圏内';
  const oz=ordFor(c.site.pref,c.site.city).find(o=>(o.rules||[]).some(r=>r.trigger==='zone'));
  if(z.src.ord&&oz&&!(g.ord||[]).some(x=>x.name===oz.name||oz.name.indexOf(x.name)===0)&&!z.hits.some(h=>h.k==='ord')){const r=oz.rules.find(r=>r.trigger==='zone');(g.ord=g.ord||[]).push({name:oz.name.replace(/（.*?）/g,''),item:r.heading||'台帳・区域',v:'なし',auto:true});}
  g.zoneAuto={checkedOn:z.checkedOn,src:z.src.id,name:z.src.name,url:z.src.url,updated:z.src.updated||'',geo:z.geo,filled:empty,
    hits:z.hits.map(h=>({k:h.k,sub:h.sub||'',city:h.city,town:h.town,lot:h.lot||'',no:h.no||'',date:h.date||'',same:h.same,d:h.d==null?null:Math.round(h.d*10)/10}))};
  return g.zoneAuto;
}
/* 年代別の空中写真（国土地理院 地理院タイル）。位置が分かれば、資料の共有なしで取得できる */
const GSI_PHOTOS=[['ort_USA10','png','1945年～1950年','米軍撮影',1945,'昭和20年～25年'],['ort_old10','png','1961年～1969年','',1961,'昭和36年～44年'],['gazo1','jpg','1974年～1978年','',1974,'昭和49年～53年'],['gazo2','jpg','1979年～1983年','',1979,'昭和54年～58年'],['gazo3','jpg','1984年～1986年','',1984,'昭和59年～61年'],['gazo4','jpg','1987年～1990年','',1987,'昭和62年～平成2年'],['ort','jpg','2007年以降','オルソ画像',2007,'平成19年以降'],['seamlessphoto','jpg','最新','全国最新写真',0,'最新']];
/* 未取得の項目：何が無いか、どこで取得できるか、共有すると報告書のどこが埋まるか。本文では赤枠で示す */
function gapsOf(c){
  const s=c.site||{},g=c.regs||{},out=[];const has=re=>(c.docs||[]).some(d=>re.test(d.kind||''));
  const desk=((ordFor(s.pref,s.city)||[]).filter(o=>o.desk).sort((a,b)=>(b.city?1:0)-(a.city?1:0))[0]||{}).desk||'';
  const dk=desk?'窓口：'+desk.split('。')[0]:'窓口：所管の都道府県・政令市の環境部局';
  const add=(k,sec,label,how,fill)=>out.push({k,sec,label,how,fill});
  if(!(c.land||[]).length)add('land','sec-22','登記簿謄本（土地・建物・閉鎖登記簿、旧土地台帳）','法務局の窓口、または登記情報提供サービス（一般財団法人 民事法務協会）','2.2 の地番ごとの履歴表、地番の変遷、建物・法人の抽出、1.1 の地目・所有者');
  if(!has(/公図/)&&!c.source)add('kozu','sec-172','公図','法務局の窓口、または登記情報提供サービス（一般財団法人 民事法務協会）','図1.7-2 調査対象地地番図、6.3 の区分図');
  if(!s.geoText)add('geo','sec-211','地形・地質の記述','下の治水地形分類図（国土地理院）と、表層地質図（産業技術総合研究所 地質図Navi 等）を読んで記入','2.1.1 地形・地質概要');
  if(!(c.maps||[]).some(m=>!isPhoto(m)))add('maps','sec-23','住宅地図・旧版地形図','住宅地図は国立国会図書館・都道府県立図書館の所蔵または発行元、旧版地形図は国土地理院の謄本交付','2.3 の年次ごとの利用履歴表（対象地用途・周辺地の土地利用）と、利用履歴からの懸念の抽出');
  if(!(c.hearing||[]).length)add('hearing','sec-241','ヒアリングの記録','土地所有者・管理者・近隣住民への聴取（聴取調査票）','2.4.1 の聴取内容、懸念のある利用履歴の確定・解消');
  if(!c.siteVisit)add('visit','sec-242','現地踏査の記録','現地で土地の使用状況、漏洩の痕跡・変色・臭気を確認し、写真を記録','2.4.2 の踏査結果、添付資料（現地踏査写真）');
  if(!(g.suidaku&&g.suidaku.v)||!(g.gesui&&g.gesui.v))add('fac','sec-243','特定施設の届出の有無（水質汚濁防止法・下水道法）','所管行政への照会（'+dk+'）。下水道法は下水道管理者','1.1 の特定施設の有無、2.4.3（1）、適用条項の判定（法第3条）');
  if(!g.art6||!g.art11jin)add('zone','sec-243','指定区域の有無（法第6条・第11条、条例）','都道府県・政令市が公表する指定区域の台帳（'+dk+'）','1.1 の指定区域の有無、2.4.3（2）');
  if(!g.natural)add('natural','sec-243','自然由来・公有水面埋立に関する情報','指定区域の台帳（自然由来特例区域・埋立地特例区域）と、公有水面埋立の免許・竣功の記録','2.4.3（3）、5章の由来の区分');
  return out;
}
/* 履歴を判断できる資料が1点も無いときは、所見を出さずに保留にする */
const isPhoto=m=>/空中写真/.test((m&&m.src)||'');
const hasHistory=c=>!!((c.land||[]).length||(c.maps||[]).some(m=>!isPhoto(m))||(c.corps||[]).length);
const lvlCls=lv=>lv==='低い'?'low':lv==='否定できない'?'high':'none';
function verdictOf(c){
  const open=openConcerns(c);
  if(!open.length&&!hasHistory(c))return {level:'保留',headline:'資料の取得後に判定する。',text:'登記簿謄本と住宅地図・地形図がいずれも未取得のため（空中写真の判読だけでは判定しない）、土壌汚染の可能性は判定していない。資料を共有すると、利用履歴に基づいて所見を組み立てる。'};
  if(!open.length){const res=(c.concerns||[]).filter(x=>x.resolved&&(!x.pending||x.resolveNote));
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
  L('第6条・第11条','要措置区域・形質変更時要届出区域の指定',inZone?['yes','区域内']:!(g.art6||g.art11jin)?['todo','未確認']:[g.art6,g.art11jin,g.art11shizen,g.art11umetate].some(v=>/要確認/.test(v||''))?['maybe','周辺に指定区域・要確認']:['no','指定なし'],g.zoneSrc?`確認先：${g.zoneSrc}${g.radius?'、'+g.radius:''}`:'区域指定の公表資料を確認','art6');
  ordFor(s.pref,s.city).forEach(o=>(o.rules||[]).filter(r=>r.judge!==false).forEach(r=>{
    let st,why;const rec=(g.ord||[]).find(x=>x.name&&o.name.indexOf(x.name.replace(/（.*$/,''))===0||x.name===o.name);
    if(r.trigger==='area'){const th=+r.threshold||0,th2=+r.threshold2||0;const site=r.areaBasis==='site';const val=site?area:ch;
      /* 施設のある（あった）敷地か：届出あり＝yes／過去の事業利用の手がかりあり・未照会＝unknown／届出なしで手がかりもなし＝no */
      const facSite=hasFac?'yes':(openConcerns(c).length||!(g.suidaku&&g.suidaku.v))?'unknown':'no';
      const t2=th2>1?th2.toLocaleString()+'㎡以上':'面積の下限なし';
      if(!th)st=['maybe','閾値を確認'];
      else if(!rq.formChange)st=['no','形質変更の予定なし'];
      else if(r.minChange&&ch<r.minChange)st=['no',`改変${r.minChange}㎡未満は対象外`];
      else if(r.upper&&val>=r.upper)st=['no','法第4条の届出による'];
      else if(val>=th)st=r.cond?['maybe',r.condLabel||'条件に当たれば対象']:['yes','届出・調査の対象'];
      else if(th2&&val>=th2)st=facSite==='yes'?['yes',`届出・調査の対象（${t2}）`]:facSite==='unknown'?['maybe','施設のある敷地なら対象']:['no','面積要件に非該当'];
      else st=['no','面積要件に非該当'];
      why=`${site?'敷地面積':'形質変更の面積'} ${th?th.toLocaleString()+'㎡以上':''}${r.cond?'（'+r.cond+'）':''}${th2?'。'+r.cond2+'は'+t2:''}${r.upperNote?'。'+r.upperNote:''}${r.minNote?'。'+r.minNote:''}。本件：敷地 ${fmtArea(area)}㎡${rq.formChange?'、形質変更 '+fmtArea(ch)+'㎡':''}`;}
    else if(r.trigger==='facility'){st=rq.purpose==='closure'?['maybe','対象事業場か確認']:openConcerns(c).length?['maybe','事業場の届出履歴を確認']:['no','該当の手がかりなし'];why=r.summary||r.duty||'';}
    else if(r.trigger==='other'){st=['info','参考'];why=r.summary||r.duty||'';}
    else {st=rec?['done','確認済：'+rec.v]:['todo','未確認'];why=rec?`${rec.item||r.heading||''}：${rec.v}`:(r.summary||'条例に基づく台帳・区域の有無を窓口または公表資料で確認する');}
    const zn=(o.zones||[]).map(z=>z.name).filter(n=>n.length<16);const title=(r.trigger==='ledger'||r.trigger==='zone')?(zn.length?`条例に基づく区域（${zn.slice(0,3).join('・')}）・台帳の確認`:'条例に基づく台帳・公表の確認'):(r.heading||r.summary||'');
    rows.push({src:'条例',law:o.name,art:r.art,title,st,why,cite:{url:r.url,quote:r.quote,verified:!!(r.verified&&r.url),checkedOn:o.checkedOn}});
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
  const lawYes=yes.some(r=>r.src==='法');const head=(rq.purpose||'sale')==='sale'&&lawYes?'本調査は、土地の売買に先立って土壌汚染のおそれを把握するために行う地歴調査である。':base;
  return head+(yes.length?'なお、本件は'+yes.map(r=>`${r.law.replace(/（.*?）/g,'')}${r.art}（${r.title}）`).join('、')+'に該当する。':'');
}

/* 確認が必要な点だけを集める（人が見る項目を最小にする） */
function reviewItems(c){
  const R=[];const add=(sev,area,text,anchor,ref)=>R.push({id:'r'+R.length,sev,area,text,anchor,ref});
  (c.diffs||[]).forEach(d=>add(d.sev,'原本との照合',d.text,null,d.ref));
  (c.land||[]).forEach((l,i)=>{const u=l.rows.filter(r=>r.unclear);if(u.length)add('warn','登記簿',`${l.chiban}：名義人の判読が不明瞭な行が${u.length}件（${u.slice(0,3).map(r=>r.holder).join('、')}${u.length>3?' ほか':''}）。添付A 登記簿謄本で照合。`,'sec-22',l.ref);
    l.rows.filter(r=>r.flag).forEach(r=>add('warn','登記簿',`${l.chiban} ${r.date}：${r.flag}`,'sec-22',l.ref));});
  (c.corps||[]).filter(x=>x.flag).forEach(x=>add('warn','法人',`${x.name}：${x.flag}`,'sec-22',x.ref));
  (c.hearing||[]).filter(h=>h.flag).forEach(h=>add('bad','ヒアリング',h.flag,'sec-24',h.ref));
  const za=c.regs&&c.regs.zoneAuto;if(za)add('warn','指定区域',za.hits.length?`公表台帳の写し（${za.checkedOn}取得）との自動照合で、指定区域が${[za.hits.filter(h=>h.same).length?'同じ町丁目に'+za.hits.filter(h=>h.same).length+'件':'',za.hits.filter(h=>!h.same).length?'周辺に'+za.hits.filter(h=>!h.same).length+'件':''].filter(Boolean).join('、')}ある。対象地が区域に含まれるか、1.0km圏内かを台帳の図面で確認し、2.4.3 の「要確認」を書き換える。`:`指定区域「なし」は、公表台帳の写し（${za.checkedOn}取得）との自動照合による。提出前に、${za.name}の公表ページで最新の指定状況を確認する。`,'sec-243');
  const s=c.site||{};const sum=(s.parcels||[]).reduce((a,p)=>a+(+p.chiseki||0),0);
  if((s.parcels||[]).length&&(s.parcels||[]).every(p=>+p.chiseki>0)&&Math.abs(sum-(+s.area||0))>0.01)add('bad','地積',`筆一覧の合計 ${sum.toFixed(2)}㎡ と敷地面積 ${s.area}㎡ が一致しない。`,'sec-11');
  const maps=resolveSame(c.maps);let asc=0,wa=0;maps.forEach((m,i)=>{if(i&&m.y<maps[i-1].y)asc++;const wy=waToYear(m.w);if(wy&&wy!==m.y)wa++;});
  if(asc)add('warn','地図年次',`年次が${asc}箇所で昇順になっていない。`,'sec-23',c.mapsRef);
  if(wa)add('bad','地図年次',`西暦と和暦が${wa}箇所で食い違う。`,'sec-23',c.mapsRef);
  const open=openConcerns(c);
  (c.concerns||[]).filter(x=>x.pending).forEach(x=>{const i=INDBY[x.industry]||{};add('warn','利用履歴',`「${x.use}」（${i.label||''}）：${i.why||''}「判断」で、汚染のおそれとして扱うかを決める。`,'sec-23',x.ref);});
  const hInd=[...new Set((c.hearing||[]).flatMap(h=>matchInd(h.text).filter(i=>!i.soft&&!(c.concerns||[]).some(x=>x.industry===i.id)).map(i=>i.label)))];
  judge(c).filter(r=>r.st[0]==='maybe').forEach(r=>add('warn','適用条項',`${r.law.replace(/（.*?）/g,'')} ${r.art}（${r.title}）：${r.st[1]}。`,'sec-app1'));
  if(hInd.length&&!(c.concerns||[]).length)add('info','ヒアリング',`聴取内容に「${hInd.join('」「')}」に関わる語がある。利用の有無を読み、該当するなら「判断」で懸念を追加する。`,'sec-24');
  if(open.length&&!(c.hearing||[]).length)add('warn','ヒアリング','事業場としての利用履歴があるが、ヒアリングの記録がない。','sec-24');
  if(c.verdict&&c.verdict.level==='低い'&&open.length)add('bad','所見',`未解消の懸念（${open.map(x=>x.use).join('、')}）があるのに所見が「低い」。`,'sec-3');
  if(c.verdict&&c.verdict.level==='否定できない'&&!open.length)add('warn','所見','所見は「否定できない」だが、根拠となる利用履歴が登録されていない。','sec-3');
  open.forEach(x=>{const i=INDBY[x.industry];if(i&&!i.subs.length)add('warn','対象物質',`「${x.use}」（${i.label}）は公式資料・社内実績の登録がなく、物質を自動選定していない。担当者が選定する。`,'sec-4');});
  judge(c).filter(r=>r.st[0]==='todo'&&r.src==='条例').forEach(r=>add('warn','条例',`${r.law.replace(/（.*?）/g,'')} ${r.art}：${/確認$/.test(r.title||'')?r.title+'の結果':(r.title||'台帳・区域')+'の確認結果'}が未記入。「判断」で結果を入れると本文 2.4.3 に入る。`,'sec-243'));
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
  ordFor(c.site.pref,c.site.city).forEach(o=>push('条例',o.name,`${o.numberShort||o.number||''}${(o.lastAmendedShort||o.lastAmended)?'（最終改正：'+(o.lastAmendedShort||o.lastAmended)+'）':''}`,(o.rules.find(r=>r.url)||{}).url||(o.pages&&o.pages[0]&&o.pages[0].url)||'',ordVerified(o),o.checkedOn));
  const g=c.regs||{};
  if(g.suidaku&&g.suidaku.src)push('行政照会','水質汚濁防止法・下水道法の特定施設の届出',`${g.suidaku.src}${g.gesui&&g.gesui.src&&g.gesui.src!=='同上'?'、'+g.gesui.src:''}${g.suidaku.date?'（'+g.suidaku.date+'照会）':''}`,'',true);
  if(g.zoneSrc)push('行政公表','土壌汚染対策法に基づく区域の指定状況',g.zoneAuto?`${g.zoneSrc}。公表台帳の写しとの自動照合`:g.zoneSrc,g.zoneAuto?g.zoneAuto.url:'',true,g.zoneAuto?g.zoneAuto.checkedOn:undefined);
  push('公的地図','治水地形分類図・地理院タイル','国土交通省国土地理院 電子国土web',DATASRC[0].url,true);
  const used=[...new Set(openConcerns(c).map(x=>INDBY[x.industry]).filter(i=>i&&i.src.type!=='none'))];
  used.forEach(i=>{const n=push(i.src.type==='moe'?'環境省資料':'社内実績',`業種と特定有害物質：${i.label}`,i.src.cite,i.src.type==='moe'&&i.official?i.official.url:'',i.src.type==='moe',LAWS.checkedOn);S[n-1].own=i.src.type==='eco';
    if(i.src.type==='eco'&&i.official)push('環境省資料',`公式統計：${i.label}`,i.official.text,i.official.url,true,LAWS.checkedOn);});
  return S;
}
