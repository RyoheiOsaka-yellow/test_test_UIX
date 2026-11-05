<script>
/* =====================================================================
   ENGINE — ローカル推論（ルールベースの合成器）
   ===================================================================== */
const hash = s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0)};
const rnd = (seed,i)=>{const x=Math.sin(seed*0.0001+i*12.9898)*43758.5453;return x-Math.floor(x)};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const uniq=a=>[...new Set(a)];
const fmtNum=n=>n>=10000?`${Math.round(n/1000)}k`:String(n);
const CODENAMES=['KESTREL','ORIGAMI','LANTERN','BASALT','MERIDIAN','TALLOW','CALDERA','HALYARD','QUARTZ','PELICAN','SEXTANT','TIDEWATER','GARNET','FERRULE','COMPASS','VESPER','MARLIN','LATTICE','OBSIDIAN','ANVIL'];
const FORMS=['部品','装置','大型','ノベルティ'];
const SYN_SHORT={S01:'微細構造',S02:'マイクロ流体',S03:'柔軟センサ',S04:'スマート構造',S05:'電池レスセンサ',S06:'軽量アーム',S07:'一体化構造',S08:'高温絶縁',S09:'低侵襲デバイス',S10:'ソフトインターフェース',S11:'衛生接触',S12:'ブランド',S13:'軽量筐体',S14:'検査セル',S15:'ソフトハンド',S16:'自動化機械',S17:'自律搬送',S18:'摺動',S19:'防曇窓',S20:'マイクロ光学',S21:'マイクロポンプ',S22:'触覚',S23:'配線一体',S24:'電波筐体',S25:'個体管理',S26:'膜構造',S27:'保護グリップ',S28:'気密アセンブリ',S29:'最適化構造',S30:'耐薬流体',S31:'防振計測',S32:'ろ過',S33:'一気通貫',S34:'カスタム記念',S35:'一貫供給',S36:'意匠金属',S37:'視覚判断',S38:'ウェアラブル計測'};
const DEVICE_NOUN=/ハンド|ポンプ|装置|ステーション|システム|ライン|搬送機|収穫機|散布機|検査装置|顕微鏡|ドローン|ランプ|照明|スピーカー|センサ|アーム|グリッパ|フィルタ|冷却ユニット|ステージ/;
function conceptName(form,noun,adj,seed,idx,membrane){
  const pick=arr=>arr[Math.floor(rnd(seed,idx+11)*arr.length)];
  const dev=DEVICE_NOUN.test(noun)&&!(form==='大型'&&membrane),st=(form==='大型'&&membrane)||/屋根|テント|シェルター|ゲート|橋|フレーム|棚|ラック|膜構造|スマート構造|一体化構造|最適化構造|筐体/.test(noun);let core;
  if(form==='部品') core=noun+pick(dev?['ユニット','モジュール','コア']:['ユニット','モジュール','カートリッジ']);
  else if(form==='装置') core=dev?'卓上'+noun:st?'可搬'+noun+'キット':noun+pick(['ステーション','ワークセル','装置']);
  else if(form==='大型') core=noun+pick(st?(membrane?['シェルター','膜構造ステーション','大型構造']:['大型構造','システム','プラットフォーム']):['自動化ライン','大型システム','プラットフォーム']);
  else core=dev?noun+'モチーフ '+pick(['キーピース','オブジェ','メダル']):noun+pick(['ピース','オブジェ','キーピース']);
  const a=adj&&!noun.includes(adj.replace('設計',''))&&!(form==='大型'&&/超小型|卓上/.test(adj))?adj+' ':'';
  return (a+core).trim();
}
const FORM_LABEL={部品:'部品・モジュール',装置:'装置・機器',大型:'大型機械・構造',ノベルティ:'ノベルティ・小物'};
const FORM_BAND={部品:[5,300],装置:[300,1500],大型:[1500,10000],ノベルティ:[20,150]};
const FORM_AFF={
 部品:{医療:1.2,半導体:1.2,自動車:1.2,航空宇宙:1.2,ロボティクス:1,食品:.8,農業:.8,建設:.6,エネルギー:1,家電:1.1,分析機器:1.2,物流:.7,スポーツ:.9,ノベルティ:.6},
 装置:{医療:1.1,半導体:1,自動車:.8,航空宇宙:.7,ロボティクス:1.3,食品:1.2,農業:1,建設:.8,エネルギー:.9,家電:1.1,分析機器:1.3,物流:1,スポーツ:.7,ノベルティ:.4},
 大型:{医療:.4,半導体:.6,自動車:.8,航空宇宙:.7,ロボティクス:1,食品:.9,農業:1.4,建設:1.5,エネルギー:1.3,家電:.3,分析機器:.4,物流:1.4,スポーツ:.4,ノベルティ:.1},
 ノベルティ:{医療:.3,半導体:.1,自動車:.4,航空宇宙:.2,ロボティクス:.3,食品:.9,農業:.3,建設:.3,エネルギー:.2,家電:.9,分析機器:.2,物流:.4,スポーツ:1.1,ノベルティ:1.8},
};
const LOT_LABEL={1:'試作 1〜10 台',100:'小ロット 〜500',5000:'量産 〜1 万',100000:'大量 10 万〜'};

function parseIdea(text){
  const t=(text||'').trim();
  const inds={},feats=new Set();let form=null,noun=null;
  for(const [ind,kws] of Object.entries(KW_IND)) for(const k of kws) if(t.includes(k)) inds[ind]=(inds[ind]||0)+1;
  for(const [f,kws] of Object.entries(KW_FEAT)) for(const k of kws) if(t.includes(k)) feats.add(f);
  const fs={};for(const [f,kws] of Object.entries(KW_FORM)) for(const k of kws) if(t.includes(k)) fs[f]=(fs[f]||0)+1;
  if(Object.keys(fs).length) form=Object.entries(fs).sort((a,b)=>b[1]-a[1])[0][0];
  for(const n of KW_NOUN) if(t.includes(n)){noun=n;break}
  return {text:t,inds,feats,form,noun};
}

/* 技術の自動補完：役割の穴を、アイデアとの親和性が高い技術で埋める */
function autoPick(selIds, parsed, opts){
  const have=new Set(selIds);const roles=new Set(selIds.map(id=>T[id].role));
  const score=t=>{
    let s=0;for(const [ind,w] of Object.entries(t.ind)) s+=w*(parsed.inds[ind]||0)*1.5;
    for(const f of parsed.feats){ if(t.tags.some(tag=>tag.includes(f)||f.includes(tag))) s+=3; }
    const fm={部品:[5,300],装置:[100,1500],大型:[500,10000],ノベルティ:[10,200]}[opts.form==='auto'?(parsed.form||'部品'):opts.form];
    if(t.smax<fm[0]||t.smin>fm[1]) s-=4;
    if(opts.lot<t.lmin) s-=3; if(opts.lot>t.lmax) s-=2;
    for(const p of opts.prio){ if(p==='コスト'&&t.tags.includes('低コスト')) s+=2; if(p==='量産'&&t.tags.includes('量産')) s+=2; if(p==='精度'&&(t.tags.includes('高精度')||t.tags.includes('微細'))) s+=2; if(p==='軽量'&&t.tags.includes('軽量')) s+=2; if(p==='衛生'&&(t.tags.includes('衛生')||t.tags.includes('抗菌'))) s+=2; if(p==='意匠'&&t.tags.includes('意匠')) s+=2; if(p==='耐久'&&(t.tags.includes('耐摩耗')||t.tags.includes('耐候'))) s+=2; if(p==='速さ'&&t.lead<=7) s+=1; }
    s+=t.trl*0.15;
    // 既選択技術との相乗
    for(const r of SYNERGY) for(const [a,b] of r.pairs){ const tagsSel=new Set(selIds.flatMap(id=>T[id].tags)); if((t.tags.includes(a)&&tagsSel.has(b))||(t.tags.includes(b)&&tagsSel.has(a))) s+=2.5; }
    return s;
  };
  const picks=[];
  const want=[];
  const shaping=['成形','加工','材料'].some(r=>roles.has(r));
  if(!shaping) want.push(['成形','加工','材料']);
  if(!roles.has('接合')&&!roles.has('表面')) want.push(['表面','接合']);
  if((parsed.feats.has('センサ')||parsed.feats.has('無線')||parsed.feats.has('電池レス'))&&!roles.has('機能')) want.push(['機能']);
  if(!roles.has('計測')&&!roles.has('組立')&&(opts.lot>=5000||opts.form==='装置'||opts.form==='大型')) want.push(['計測','組立']);
  const target=Math.min(6,Math.max(selIds.length+1,4));
  const cand=TECH.filter(t=>!have.has(t.id)).map(t=>({t,s:score(t)})).sort((a,b)=>b.s-a.s);
  for(const group of want){ const c=cand.find(x=>group.includes(x.t.role)&&!picks.includes(x.t.id)); if(c&&have.size+picks.length<6) picks.push(c.t.id); }
  for(const c of cand){ if(have.size+picks.length>=target) break; if(picks.includes(c.t.id)) continue; if([...have,...picks].filter(id=>T[id].role===c.t.role).length>=2) continue; if(c.s<2) break; picks.push(c.t.id); }
  return picks;
}

function findSynergies(techs){
  const out=[];
  for(const r of SYNERGY){
    for(const [a,b] of r.pairs){
      const A=techs.filter(t=>t.tags.includes(a)), B=techs.filter(t=>t.tags.includes(b));
      if(!A.length||!B.length) continue;
      let pair=null;for(const x of A) for(const y of B) if(x.id!==y.id){pair=[x,y];break}
      if(!pair&&A.length&&B.length) continue;
      if(pair){ out.push({...r,techs:[pair[0].id,pair[1].id],via:[a,b]}); break; }
    }
  }
  return out;
}

function analyze(selIds, ideaText, opts){
  const parsed=parseIdea(ideaText);
  const added=opts.autoPick?autoPick(selIds,parsed,opts):[];
  const ids=[...selIds,...added].slice(0,8);
  const techs=ids.map(id=>T[id]);
  const seed=hash(ids.join('|')+ideaText);
  const roles=uniq(techs.map(t=>t.role));
  const missing=ROLES.filter(r=>!roles.includes(r));
  const facs=uniq(techs.map(t=>t.fac));
  const syn=findSynergies(techs);

  // 産業スコア
  const sc={};for(const i of INDUSTRIES) sc[i]=0;
  const why={};const add=(i,v,w)=>{sc[i]+=v;(why[i]=why[i]||[]).push(w)};
  for(const t of techs) for(const [i,w] of Object.entries(t.ind)) add(i,w,`${t.name}`);
  for(const s of syn) for(const i of s.ind) add(i,2.5,`相乗:${s.name}`);
  for(const [i,w] of Object.entries(parsed.inds)) add(i,4*w,'アイデア文の記述');
  const mx=Math.max(1,...Object.values(sc));
  const industries=INDUSTRIES.map(i=>({name:i,raw:sc[i],score:Math.round(sc[i]/mx*100),reasons:uniq(why[i]||[])})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);

  // 整合性
  const shaping=techs.filter(t=>['成形','加工','材料','接合','表面'].includes(t.role));
  const warnings=[],notes=[];
  let smin=0,smax=1e9;for(const t of shaping){smin=Math.max(smin,t.smin);smax=Math.min(smax,t.smax)}
  const scaleOk=shaping.length<2||smin<=smax;
  if(!scaleOk){ const small=shaping.reduce((a,b)=>a.smax<b.smax?a:b), big=shaping.reduce((a,b)=>a.smin>b.smin?a:b); warnings.push({lv:'warn',text:`スケールが重なりません：${small.name}（〜${small.smax}mm）と ${big.name}（${big.smin}mm〜）。小さな機能部品を大きな構造に組み込む「階層アセンブリ」として設計する必要があります。`}); }
  else if(shaping.length>=2) notes.push({lv:'ok',text:`共通スケール ${smin}〜${smax} mm の範囲で、選択した成形・加工・表面技術が同じ部品に適用できます。`});
  const mats=shaping.filter(t=>!t.mat.includes('*')).map(t=>t.mat);
  if(mats.length>=2){ const common=mats.reduce((a,b)=>a.filter(m=>b.some(x=>x.includes(m)||m.includes(x)))); if(common.length) notes.push({lv:'ok',text:`共通材料：${common.join(' / ')}。材料をまたがず一体で作れます。`}); else { const hasJoin=roles.includes('接合')||techs.some(t=>t.tags.includes('異材一体')||t.tags.includes('インサート')); warnings.push({lv:hasJoin?'ok':'warn',text:hasJoin?`材料が異なります（${uniq(mats.flat()).slice(0,5).join('・')}）が、異材接合／一体成形の技術が含まれるため橋渡しできます。`:`材料系が異なります（${uniq(mats.flat()).slice(0,5).join('・')}）。異材を結ぶ接合技術（レーザー異材溶接、インサート成形、加硫接着など）の追加を推奨します。`}); } }
  const lotWarn=techs.filter(t=>opts.lot<t.lmin||opts.lot>t.lmax);
  for(const t of lotWarn) warnings.push({lv:'warn',text:opts.lot<t.lmin?`${t.name} は ${fmtNum(t.lmin)} 個以上で経済的です。${LOT_LABEL[opts.lot]} では初期費（金型・段取り）が単価を支配します。`:`${t.name} の実績上限は ${fmtNum(t.lmax)} 個規模です。${LOT_LABEL[opts.lot]} では複数ラインか代替工法の検討が必要です。`});
  const lowTrl=techs.filter(t=>t.trl<=6);
  for(const t of lowTrl) notes.push({lv:'warn',text:`${t.name} は成熟度 TRL ${t.trl}。量産前に実証フェーズを置く前提で計画します。`});

  // 推奨追加（まだ無い役割から、親和性の高い技術）
  const rec=[];
  const tagsSel=new Set(techs.flatMap(t=>t.tags));
  const cands=TECH.filter(t=>!ids.includes(t.id)&&missing.includes(t.role)).map(t=>{let s=0;for(const [i,w] of Object.entries(t.ind)) s+=w*((industries.find(x=>x.name===i)||{}).score||0)/100;for(const r of SYNERGY) for(const [a,b] of r.pairs){if((t.tags.includes(a)&&tagsSel.has(b))||(t.tags.includes(b)&&tagsSel.has(a))) s+=2}return {t,s}}).sort((a,b)=>b.s-a.s);
  const usedRoles=new Set();
  for(const c of cands){ if(usedRoles.has(c.t.role)) continue; if(rec.length>=3) break; usedRoles.add(c.t.role); const r=SYNERGY.find(r=>r.pairs.some(([a,b])=>(c.t.tags.includes(a)&&tagsSel.has(b))||(c.t.tags.includes(b)&&tagsSel.has(a)))); rec.push({id:c.t.id,reason:r?`「${r.name}」が成立し、${r.ind.slice(0,2).join('・')||'複数領域'}への展開が開く`:`${ROLE_DESC[c.t.role]}役割を補い、${(Object.keys(c.t.ind)[0]||'')}向けの完成度が上がる`}); }

  // 規模の決定
  let primary=opts.form!=='auto'?opts.form:(parsed.form||(syn.find(s=>s.form)||{}).form||(shaping.length&&smax>=1500?'大型':'部品'));
  const order=[primary,...FORMS.filter(f=>f!==primary)];
  // 3 案：primary と、産業スコア×規模親和性が高い 2 つ
  const formScore=f=>industries.slice(0,6).reduce((a,x)=>a+x.score*(FORM_AFF[f][x.name]||.5),0)+(syn.filter(s=>s.form===f).length*40);
  const others=order.slice(1).sort((a,b)=>formScore(b)-formScore(a)).slice(0,2);
  const concepts=[primary,...others].map((f,i)=>buildConcept(f,i,{techs,ids,syn,industries,parsed,opts,seed,warnings,facs,roles,lowTrl,lotWarn,scaleOk,missing}));

  const process=processFlow(ids);
  const title=concepts[0].name;
  const summary=buildSummary({techs,syn,industries,concepts,parsed,facs,roles,missing,opts,scaleOk});
  const hypothesis=buildHypothesis({parsed,syn,industries,concepts,techs,opts,process});
  return {mode:'local',ids,added,techs:ids,title,tagline:concepts[0].tagline,summary,synergies:syn.map(s=>({id:s.id,name:s.name,effect:s.eff,techs:s.techs,industries:s.ind,via:s.via})),industries:industries.slice(0,7),coverage:{roles,missing,recommended:rec},compat:{warnings,notes,scale:scaleOk?[smin,smax]:null},concepts,process,hypothesis,parsed:{inds:parsed.inds,feats:[...parsed.feats],form:parsed.form,noun:parsed.noun},idea:ideaText,opts,ts:Date.now()};
}

function buildConcept(form,idx,ctx){
  const {techs,ids,syn,industries,parsed,opts,seed,facs,roles,lowTrl,lotWarn,scaleOk,missing}=ctx;
  const aff=FORM_AFF[form];
  const inds=industries.map(x=>({...x,s:x.score*(aff[x.name]||.5)})).sort((a,b)=>b.s-a.s).slice(0,3).map(x=>x.name);
  const synF=[...syn].sort((a,b)=>(b.form===form)-(a.form===form));
  const core=synF[0];
  const feats=[...parsed.feats];
  const adj=feats.includes('軽量')?'軽量':feats.includes('防水')?'全天候':feats.includes('小型')?'超小型':feats.includes('衛生')?'衛生設計':feats.includes('電池レス')?'電池レス':feats.includes('高精度')?'高精度':feats.includes('柔軟')?'ソフト':'';
  let noun=parsed.noun||(core?SYN_SHORT[core.id]:'')||{部品:'機能',装置:'ワーク',大型:'自動化',ノベルティ:'メモリアル'}[form];
  const membrane=techs.some(t=>['耐候','縫製','溶着'].some(x=>t.tags.includes(x)));
  let name=conceptName(form,noun,adj,seed,idx,membrane);
  if(form==='ノベルティ'&&techs.some(t=>t.tags.includes('絞り'))) name=name.replace(/(モチーフ )?(キーピース|オブジェ|メダル|ピース)$/,'カップ');
  const code=CODENAMES[(hash(name)+idx)%CODENAMES.length];
  const band=FORM_BAND[form];
  const sz=(k)=>Math.round((band[0]+(band[1]-band[0])*rnd(seed,idx*7+k)*0.8+ (band[1]-band[0])*0.1)/(band[1]>1000?50:band[1]>200?5:1))*(band[1]>1000?50:band[1]>200?5:1);
  const W=sz(1),D=Math.round(W*(0.5+rnd(seed,idx*7+2)*0.5)),H=Math.round(W*(0.25+rnd(seed,idx*7+3)*0.6));
  const lot=opts.lot;
  const costBand=costOf(form,lot,techs);
  const trlAvg=techs.reduce((a,t)=>a+t.trl,0)/techs.length;
  const maturity=clamp(Math.round(trlAvg/9*100-(form==='大型'&&!roles.includes('組立')?12:0)-(lowTrl.length*4)),20,98);
  const manuf=clamp(Math.round(92-7*(facs.length-1)-(scaleOk?0:16)-8*lotWarn.length+(syn.some(s=>s.id==='S33'||s.id==='S35')?8:0)-(form==='大型'?6:0)),20,98);
  const market=clamp(Math.round((industries.find(x=>x.name===inds[0])||{score:40}).score*(aff[inds[0]]||.7)*0.95+8),15,98);
  const unique=clamp(Math.round(30+14*syn.length+(roles.length>=4?10:0)+(form==='ノベルティ'?-8:0)+(parsed.feats.size*2)),20,98);
  const cost=clamp(Math.round(costScore(form,lot,techs,lotWarn)),15,98);
  const radar={技術成熟度:maturity,製造性:manuf,市場性:market,独自性:unique,コスト効率:cost};
  const desc=buildDesc(form,{name,core,syn:synF,techs,inds,feats,W,D,H,lot,parsed});
  const risks=[];
  if(!scaleOk) risks.push('小さな機能部品と大きな構造の間に中間アセンブリが必要。インターフェース（固定・配線・シール）の設計工数を見込む。');
  for(const t of lowTrl) risks.push(`${t.name}（TRL ${t.trl}）は量産実績が薄い。実証 → 限定生産 → 量産の 3 段階で立ち上げる。`);
  for(const t of lotWarn.slice(0,2)) risks.push(opts.lot<t.lmin?`${t.name} は本数量だと初期費の回収が難しい。試作段階は代替工法（AM・切削）で置き換える。`:`${t.name} は本数量に対して能力が不足。複数拠点化か工法変更を前提に計画。`);
  if(inds.includes('医療')) risks.push('医療領域は薬機法・ISO 13485 の適合が必須。クラス分類で開発期間が 1〜3 年変わる。');
  if(inds.includes('食品')) risks.push('食品接触材料の規格（食品衛生法・FDA）と洗浄性（CIP）の検証が必要。');
  if(form==='大型') risks.push('据付・安全規格（機械安全 ISO 12100）・輸送寸法の制約が設計を支配する。');
  if(form==='ノベルティ') risks.push('単価と個別刻印の工数が利益を左右する。デザインの作り込みと工程の自動化を同時に進める。');
  if(facs.length>=4) risks.push(`${facs.length} 工場をまたぐため、公差・材料ロット・納期の整合を取る「技術コーディネータ」役が必要。`);
  if(!risks.length) risks.push('技術的な大きな障壁は見当たらない。市場側の検証（顧客が本当に欲しいか）を最優先に。');
  const next=[];
  const lead=Math.max(...techs.map(t=>t.lead));
  if(core) next.push(`PoC：「${core.name}」を ${T[core.techs[0]].name} × ${T[core.techs[1]].name} で試作（目安 ${lead + 7} 日）。`);
  if(facs.length>=2) next.push(`${FAC[facs[0]].name} と ${FAC[facs[1]].name} の工程すり合わせ（材料・公差・受け渡し図面）。`);
  next.push(`${inds.slice(0,2).join('・')} の見込み顧客 3 社に、本コンセプト図でヒアリング。`);
  if(syn.length) next.push(`「${syn[0].name}」周辺の先行特許・競合製品を調査。`);
  if(missing.length&&missing.includes('計測')) next.push('検査基準（何を・どの精度で測るか）を先に決め、計測技術を追加。');
  return {form,formLabel:FORM_LABEL[form],name,code,tagline:`${inds[0]||'新領域'}向け ${FORM_LABEL[form]}`,desc,size:{W,D,H},sizeText:form==='大型'?`約 ${(W/1000).toFixed(1)} × ${(D/1000).toFixed(1)} × ${(H/1000).toFixed(1)} m`:`約 ${W} × ${D} × ${H} mm`,lot,lotText:LOT_LABEL[lot],costBand,techs:ids,industries:inds,radar,risks,next,coreSynergy:core?core.name:null,materials:uniq(techs.filter(t=>!t.mat.includes('*')).flatMap(t=>t.mat)).slice(0,4)};
}
function costOf(form,lot,techs){
  const base={部品:1,装置:40,大型:1500,ノベルティ:0.8}[form];
  const f=techs.reduce((a,t)=>a*(t.tags.includes('量産')||t.tags.includes('低コスト')?0.85:t.tags.includes('金属AM')||t.tags.includes('MEMS')||t.tags.includes('微細')?1.3:1),1);
  const l=lot>=100000?0.35:lot>=5000?0.55:lot>=100?1:2.2;
  const v=base*f*l*800;
  const fmt=x=>x>=1e6?`${(x/1e6).toFixed(1)} 百万円`:x>=1e4?`${Math.round(x/1e4)} 万円`:`${Math.round(x/100)*100} 円`;
  return `${fmt(v*0.7)} 〜 ${fmt(v*1.4)} / 個`;
}
function costScore(form,lot,techs,lotWarn){
  let s=58;
  if(lot>=100000) s+=14; else if(lot>=5000) s+=8; else if(lot<=1) s-=6;
  s-=12*lotWarn.length;
  for(const t of techs){ if(t.tags.includes('量産')||t.tags.includes('低コスト')) s+=4; if(t.tags.includes('金属AM')||t.tags.includes('MEMS')) s-=6; if(t.tags.includes('試作')&&lot>=5000) s-=4; }
  if(form==='大型') s-=4;
  return s;
}
function buildDesc(form,c){
  const {core,syn,techs,inds,feats,W,D,H,lot,parsed}=c;
  const byRole={};for(const t of techs)(byRole[t.role]=byRole[t.role]||[]).push(t);
  const roleLine=Object.entries(byRole).map(([r,ts])=>`${r}は${ts.map(t=>t.name.replace(/（.*?）/g,'')).join('・')}`).join('、');
  const featLine=feats.length?`「${feats.slice(0,3).join('」「')}」を満たすことを設計の軸に置き、`:'';
  const coreLine=core?`「${core.name}」を中核の価値とし、${core.eff}`:'選択技術を役割ごとに積み上げ、工場単独では出せない完成度を狙う。';
  const sub=syn[1]?`副次的に「${syn[1].name}」も成立し、${syn[1].ind.slice(0,2).join('・')||'周辺領域'}への横展開も見込める。`:'';
  const formLine={部品:`完成機器に組み込まれる機能モジュールとして供給する。外形は約 ${W}×${D}×${H} mm。`,装置:`単体で使える装置・機器として供給する。卓上〜床置きの約 ${W}×${D}×${H} mm。`,大型:`現場に据え付ける大型機械・構造として供給する。外形は約 ${(W/1000).toFixed(1)}×${(D/1000).toFixed(1)}×${(H/1000).toFixed(1)} m。`,ノベルティ:`手に取って技術が伝わる小物として供給する。約 ${W}×${D}×${H} mm、一つずつ異なる刻印にも対応。`}[form];
  return `<p>${coreLine}</p><p>${featLine}${roleLine}が担う。${formLine}</p><p>主な提供先は ${inds.join('・')}。${sub}</p>`;
}
function processFlow(ids){
  const order=ROLES;const techs=ids.map(id=>T[id]).sort((a,b)=>order.indexOf(a.role)-order.indexOf(b.role));
  let total=0;const byRole={};
  for(const t of techs){byRole[t.role]=Math.max(byRole[t.role]||0,t.lead)}
  total=Object.values(byRole).reduce((a,b)=>a+b,0)+Object.keys(byRole).length*2;
  return {steps:techs.map((t,i)=>({n:i+1,id:t.id,name:t.name,role:t.role,fac:t.fac,facName:FAC[t.fac].name,region:FAC[t.fac].region,days:t.lead})),total};
}
function buildSummary(c){
  const {techs,syn,industries,concepts,parsed,facs,roles,missing,opts,scaleOk}=c;
  const p1=`${facs.length} 工場・${techs.length} 技術（${roles.join('／')}）を一つの製品として組み合わせました。${syn.length?`相乗効果ルールに ${syn.length} 件が一致し、第 1 案の中核は「${concepts[0].coreSynergy}」です。`:'明確な相乗効果ルールへの一致はありませんが、役割の積み上げとして成立します。'}${scaleOk?'':'スケールの不一致があるため、階層アセンブリとして設計します。'}`;
  const top=industries.slice(0,3).map(x=>`${x.name}（${x.score}）`).join('、');
  const p2=`提供可能な領域は ${top} が有力です。${Object.keys(parsed.inds).length?`アイデア文に含まれる ${Object.keys(parsed.inds).join('・')} の文脈を重み付けしました。`:'アイデア文に産業の明示がないため、技術の実績分布から推定しています。'}${missing.length?`未カバーの役割は ${missing.join('・')} で、必要に応じて推奨技術を追加できます。`:'8 つの役割をすべてカバーしています。'}`;
  const p3=`規模の異なる 3 案 — ${concepts.map(x=>`${x.formLabel}「${x.name}」`).join('、')} — を生成しました。${LOT_LABEL[opts.lot]} の前提で、第 1 案の実現性は 成熟度 ${concepts[0].radar.技術成熟度}・製造性 ${concepts[0].radar.製造性}・市場性 ${concepts[0].radar.市場性} と評価しています。`;
  return [p1,p2,p3];
}
function buildHypothesis(c){
  const {parsed,syn,industries,concepts,techs,opts,process}=c;
  const idea=parsed.text?`「${parsed.text.slice(0,48)}${parsed.text.length>48?'…':''}」`:'この組み合わせ';
  const st=`${idea}は、${syn.slice(0,2).map(s=>`「${s.name}」`).join('と')||'選択技術の組み合わせ'}によって実現でき、${industries.slice(0,2).map(x=>x.name).join('・')}の顧客に対して既存製品より高い価値を持つ。`;
  const lead=process.total;
  const tests=[
   {k:'技術検証',v:`${concepts[0].name} の機能試作を ${lead} 日以内に 1 台作り、${syn[0]?`「${syn[0].name}」の効果（${syn[0].via.join('×')}）`:'主要機能'}を定量評価する。`},
   {k:'顧客検証',v:`${industries.slice(0,2).map(x=>x.name).join('・')}の見込み顧客 3 社に図面と試作を見せ、「今の解決策と比べて何が変わるか」を聞く。2 社以上が導入条件を語れば次へ。`},
   {k:'経済性検証',v:`${LOT_LABEL[opts.lot]} での目標単価を ${concepts[0].costBand} に置き、工場ごとの見積合算で ±20% 以内に収まるかを確認する。`},
  ];
  return {statement:st,tests};
}

/* ===================== 可視化（SVG） ===================== */
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function graphSVG(ids,syn){
  const W=560,H=360,cx=W/2,cy=H/2,R=Math.min(W,H)/2-70;
  const pos={};ids.forEach((id,i)=>{const a=-Math.PI/2+i*2*Math.PI/ids.length;pos[id]=[cx+R*Math.cos(a),cy+R*Math.sin(a)]});
  let s=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="var(--font)">`;
  s+=`<rect width="${W}" height="${H}" fill="var(--card)"/>`;
  for(const e of syn){const [a,b]=e.techs;if(!pos[a]||!pos[b])continue;const [x1,y1]=pos[a],[x2,y2]=pos[b];const mx=(x1+x2)/2,my=(y1+y2)/2;s+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--accent)" stroke-width="2" opacity=".75"/>`;s+=`<rect x="${mx-62}" y="${my-9}" width="124" height="18" rx="4" fill="var(--paper)" stroke="var(--accent-soft)"/><text x="${mx}" y="${my+4}" text-anchor="middle" font-size="9.5" fill="var(--accent)">${esc(e.name.length>14?e.name.slice(0,13)+'…':e.name)}</text>`}
  if(!syn.length){for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const [x1,y1]=pos[ids[i]],[x2,y2]=pos[ids[j]];s+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--line-soft)" stroke-dasharray="3 4"/>`}}
  for(const id of ids){const t=T[id];const [x,y]=pos[id];const col=ROLE_COLOR[t.role];s+=`<circle cx="${x}" cy="${y}" r="17" fill="${col}" stroke="var(--card)" stroke-width="3"/><text x="${x}" y="${y+4}" text-anchor="middle" font-size="9.5" font-weight="600" fill="#fff">${t.role}</text>`;const above=y<cy;const nm=t.name.replace(/（.*?）/g,'');s+=`<text x="${x}" y="${y+(above?-26:34)}" text-anchor="middle" font-size="10.5" font-weight="600" fill="var(--ink)">${esc(nm.length>14?nm.slice(0,13)+'…':nm)}</text><text x="${x}" y="${y+(above?-14:46)}" text-anchor="middle" font-size="9" fill="var(--ink-mute)" font-family="var(--mono)">${esc(FAC[t.fac].name)}</text>`}
  s+=`<text x="12" y="${H-10}" font-size="9.5" fill="var(--ink-faint)" font-family="var(--mono)">NODES ${ids.length} · SYNERGY LINKS ${syn.length}</text></svg>`;
  return s;
}
function radarSVG(scores){
  const keys=Object.keys(scores),n=keys.length,cx=150,cy=150,R=100;
  const pt=(i,r)=>{const a=-Math.PI/2+i*2*Math.PI/n;return [cx+r*Math.cos(a),cy+r*Math.sin(a)]};
  let s=`<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" font-family="var(--font)">`;
  for(const f of [.25,.5,.75,1]){s+=`<polygon points="${keys.map((_,i)=>pt(i,R*f).join(',')).join(' ')}" fill="none" stroke="var(--line-soft)"/>`}
  keys.forEach((_,i)=>{const [x,y]=pt(i,R);s+=`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--line-faint)"/>`});
  s+=`<polygon points="${keys.map((k,i)=>pt(i,R*scores[k]/100).join(',')).join(' ')}" fill="var(--accent)" fill-opacity=".18" stroke="var(--accent)" stroke-width="2"/>`;
  keys.forEach((k,i)=>{const [x,y]=pt(i,R*scores[k]/100);s+=`<circle cx="${x}" cy="${y}" r="3.5" fill="var(--accent)"/>`;const [lx,ly]=pt(i,R+26);s+=`<text x="${lx}" y="${ly}" text-anchor="middle" font-size="11" fill="var(--ink)" font-weight="500">${k}</text><text x="${lx}" y="${ly+13}" text-anchor="middle" font-size="10" fill="var(--ink-mute)" font-family="var(--mono)">${scores[k]}</text>`});
  return s+'</svg>';
}

/* 概念図面：規模ごとのパラメトリック図 + 技術の引出線 + 表題欄 */
function blueprintSVG(c,res){
  const W=760,H=520,seed=hash(c.name);
  const ink='var(--ink)',mute='var(--ink-mute)',line='var(--line)',acc='var(--accent)',brass='var(--brass)';
  let s=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="var(--font)">
  <defs><pattern id="g" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="var(--line-faint)" stroke-width=".6"/></pattern>
  <marker id="ar" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="${ink}"/></marker></defs>
  <rect width="${W}" height="${H}" fill="var(--card)"/><rect x="14" y="14" width="${W-28}" height="${H-28}" fill="url(#g)" stroke="${ink}" stroke-width="1.2"/>`;
  // 表題欄
  const tb={x:W-14-300,y:H-14-86,w:300,h:86};
  s+=`<rect x="${tb.x}" y="${tb.y}" width="${tb.w}" height="${tb.h}" fill="var(--card)" stroke="${ink}"/>`;
  const rows=[['品名',c.name],['図番',`AFX-${String(seed%9000+1000)}-${c.code}`],['尺度 / 外形',`${c.form==='大型'?'1:50':c.form==='装置'?'1:5':'1:1'} · ${c.sizeText}`],['材料',c.materials.join(' / ')||'—'],['工場',uniq(c.techs.map(id=>FAC[T[id].fac].name)).length+' 拠点 · '+LOT_LABEL[c.lot]]];
  rows.forEach((r,i)=>{const y=tb.y+i*(tb.h/rows.length);s+=`<line x1="${tb.x}" y1="${y}" x2="${tb.x+tb.w}" y2="${y}" stroke="${line}"/><text x="${tb.x+6}" y="${y+12}" font-size="8.5" fill="${mute}" font-family="var(--mono)">${r[0]}</text><text x="${tb.x+62}" y="${y+12}" font-size="9.5" fill="${ink}" font-weight="500">${esc(String(r[1]).length>38?String(r[1]).slice(0,37)+'…':r[1])}</text>`});
  s+=`<text x="26" y="34" font-size="9" fill="${brass}" font-family="var(--mono)" letter-spacing="2">CONCEPT DRAWING · ${esc(c.code)}</text><text x="26" y="52" font-size="14" font-weight="600" fill="${ink}">${esc(c.name)}</text><text x="26" y="66" font-size="9.5" fill="${mute}">${esc(c.formLabel)} · ${esc(c.industries.join(' / '))}</text>`;
  // 本体ビュー（中央）
  const cx=W/2+10,cy=H/2+10;let anchors=[];
  const dim=(x1,y1,x2,y2,label,off)=>{const h=Math.abs(y2-y1)<1;const ox=h?0:off,oy=h?off:0;return `<line x1="${x1+ox}" y1="${y1+oy}" x2="${x2+ox}" y2="${y2+oy}" stroke="${ink}" stroke-width=".8" marker-end="url(#ar)" marker-start="url(#ar)"/><line x1="${x1}" y1="${y1}" x2="${x1+ox}" y2="${y1+oy}" stroke="${line}" stroke-width=".6"/><line x1="${x2}" y1="${y2}" x2="${x2+ox}" y2="${y2+oy}" stroke="${line}" stroke-width=".6"/><text x="${(x1+x2)/2+ox+(h?0:-6)}" y="${(y1+y2)/2+oy+(h?-4:0)}" font-size="9" fill="${ink}" font-family="var(--mono)" text-anchor="${h?'middle':'end'}" ${h?'':`transform="rotate(-90 ${(x1+x2)/2+ox-6} ${(y1+y2)/2})"`}>${label}</text>`};
  const szW=c.form==='大型'?`${(c.size.W/1000).toFixed(1)} m`:`${c.size.W}`,szH=c.form==='大型'?`${(c.size.H/1000).toFixed(1)} m`:`${c.size.H}`;
  if(c.form==='部品'){
    const w=280,h=150,x=cx-w/2,y=cy-h/2-20;const holes=3+Math.floor(rnd(seed,1)*3);
    s+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="var(--paper-warm)" stroke="${ink}" stroke-width="1.4"/>`;
    for(let i=0;i<holes;i++){const hx=x+30+i*((w-60)/(holes-1));s+=`<circle cx="${hx}" cy="${y+22}" r="7" fill="var(--card)" stroke="${ink}"/><line x1="${hx-10}" y1="${y+22}" x2="${hx+10}" y2="${y+22}" stroke="${line}" stroke-width=".6"/><line x1="${hx}" y1="${y+12}" x2="${hx}" y2="${y+32}" stroke="${line}" stroke-width=".6"/>`}
    s+=`<rect x="${x+30}" y="${y+50}" width="${w-60}" height="${h-80}" rx="6" fill="var(--card)" stroke="${ink}" stroke-dasharray="4 3"/>`;
    for(let i=0;i<5;i++){const lx=x+50+i*((w-100)/4);s+=`<line x1="${lx}" y1="${y+60}" x2="${lx}" y2="${y+h-40}" stroke="${acc}" stroke-width="1.2" opacity=".8"/>`}
    s+=`<circle cx="${x+w-36}" cy="${y+h-28}" r="12" fill="var(--card)" stroke="${ink}"/><circle cx="${x+w-36}" cy="${y+h-28}" r="5" fill="none" stroke="${acc}"/>`;
    // 側面図
    const sy=y+h+40;s+=`<rect x="${x}" y="${sy}" width="${w}" height="26" fill="var(--paper-warm)" stroke="${ink}" stroke-width="1.2"/><rect x="${x+30}" y="${sy-8}" width="${w-60}" height="8" fill="var(--card)" stroke="${ink}"/>`;
    s+=dim(x,y-18,x+w,y-18,szW,-8)+dim(x+w+18,y,x+w+18,y+h,szH,8);
    anchors=[[x+30,y+22],[x+w/2,y+h/2],[x+w-36,y+h-28],[x+w/2,sy+13],[x+8,y+h-10],[x+w/2,y+h-28]];
  }else if(c.form==='装置'){
    const w=260,h=230,x=cx-w/2,y=cy-h/2-10;
    s+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="var(--paper-warm)" stroke="${ink}" stroke-width="1.4"/>`;
    s+=`<rect x="${x+16}" y="${y+16}" width="${w-32}" height="70" rx="4" fill="var(--panel)" stroke="${ink}"/><text x="${x+w/2}" y="${y+56}" text-anchor="middle" font-size="11" fill="#B8A67A" font-family="var(--mono)">${esc(c.code)} · READY</text>`;
    s+=`<rect x="${x+16}" y="${y+100}" width="${w-32}" height="${h-130}" rx="4" fill="var(--card)" stroke="${ink}" stroke-dasharray="4 3"/>`;
    for(let i=0;i<3;i++){const mx=x+28+i*((w-56)/3);s+=`<rect x="${mx}" y="${y+112}" width="${(w-56)/3-12}" height="${h-154}" rx="3" fill="var(--paper)" stroke="${acc}" stroke-width="1.1"/>`}
    for(let i=0;i<4;i++) s+=`<circle cx="${x+30+i*20}" cy="${y+h-14}" r="4" fill="${i===0?acc:'var(--card)'}" stroke="${ink}"/>`;
    s+=`<rect x="${x-16}" y="${y+h}" width="${w+32}" height="8" fill="var(--paper-dark)" stroke="${ink}"/>`;
    s+=dim(x,y-18,x+w,y-18,szW,-8)+dim(x+w+18,y,x+w+18,y+h,szH,8);
    anchors=[[x+w/2,y+50],[x+40,y+150],[x+w/2,y+150],[x+w-40,y+150],[x+30,y+h-14],[x+w/2,y+h+4]];
  }else if(c.form==='大型'){
    const w=420,h=200,x=cx-w/2,y=cy-h/2;const gy=y+h;
    s+=`<line x1="${x-40}" y1="${gy}" x2="${x+w+40}" y2="${gy}" stroke="${ink}" stroke-width="1.6"/>`;
    for(let i=0;i<14;i++) s+=`<line x1="${x-40+i*36}" y1="${gy}" x2="${x-52+i*36}" y2="${gy+10}" stroke="${line}"/>`;
    s+=`<rect x="${x}" y="${y+30}" width="26" height="${h-30}" fill="var(--paper-warm)" stroke="${ink}" stroke-width="1.3"/><rect x="${x+w-26}" y="${y+30}" width="26" height="${h-30}" fill="var(--paper-warm)" stroke="${ink}" stroke-width="1.3"/>`;
    s+=`<rect x="${x-10}" y="${y}" width="${w+20}" height="34" fill="var(--paper-warm)" stroke="${ink}" stroke-width="1.3"/>`;
    for(let i=0;i<12;i++){const tx=x+i*(w/12);s+=`<line x1="${tx}" y1="${y+2}" x2="${tx+w/12}" y2="${y+32}" stroke="${line}" stroke-width=".8"/>`}
    s+=`<rect x="${x+w*0.3}" y="${y+34}" width="70" height="40" fill="var(--card)" stroke="${acc}" stroke-width="1.2"/><line x1="${x+w*0.3+35}" y1="${y+74}" x2="${x+w*0.3+35}" y2="${y+130}" stroke="${acc}" stroke-width="1.4"/><rect x="${x+w*0.3+10}" y="${y+130}" width="50" height="22" rx="3" fill="var(--paper)" stroke="${acc}"/>`;
    s+=`<path d="M${x+40} ${gy-30} Q${x+w/2} ${gy-70} ${x+w-40} ${gy-30}" fill="none" stroke="${ink}" stroke-dasharray="5 4"/>`;
    s+=`<rect x="${x+w-120}" y="${gy-60}" width="60" height="60" fill="var(--paper)" stroke="${ink}"/><circle cx="${x+w-105}" cy="${gy-8}" r="8" fill="var(--card)" stroke="${ink}"/><circle cx="${x+w-75}" cy="${gy-8}" r="8" fill="var(--card)" stroke="${ink}"/>`;
    s+=dim(x-10,y-18,x+w+10,y-18,szW,-8)+dim(x+w+36,y,x+w+36,gy,szH,8);
    anchors=[[x+w/2,y+17],[x+13,y+h/2],[x+w*0.3+35,y+54],[x+w*0.3+35,y+141],[x+w-90,gy-30],[x+w/2,gy-50]];
  }else{
    const w=170,h=240,x=cx-w/2,y=cy-h/2-10;
    s+=`<path d="M${x+20} ${y} H${x+w-20} a20 20 0 0 1 20 20 V${y+h-20} a20 20 0 0 1 -20 20 H${x+20} a20 20 0 0 1 -20 -20 V${y+20} a20 20 0 0 1 20 -20z" fill="var(--paper-warm)" stroke="${ink}" stroke-width="1.4"/>`;
    s+=`<circle cx="${x+w/2}" cy="${y+26}" r="9" fill="var(--card)" stroke="${ink}"/><circle cx="${x+w/2}" cy="${y+26}" r="4" fill="none" stroke="${line}"/>`;
    s+=`<rect x="${x+22}" y="${y+56}" width="${w-44}" height="${h-110}" rx="6" fill="var(--card)" stroke="${acc}" stroke-dasharray="3 3"/>`;
    const init=c.code.slice(0,2);s+=`<text x="${x+w/2}" y="${y+h/2+12}" text-anchor="middle" font-size="46" font-weight="600" fill="${acc}" opacity=".85">${init}</text>`;
    for(let i=0;i<6;i++) s+=`<line x1="${x+30}" y1="${y+h-44+i*5}" x2="${x+w-30}" y2="${y+h-44+i*5}" stroke="${line}" stroke-width=".7"/>`;
    s+=`<text x="${x+w/2}" y="${y+h-8}" text-anchor="middle" font-size="7" fill="${mute}" font-family="var(--mono)">No. ${String(seed%500+1).padStart(3,'0')} / 500</text>`;
    const sx=x+w+70;s+=`<rect x="${sx}" y="${y}" width="22" height="${h}" rx="6" fill="var(--paper-warm)" stroke="${ink}" stroke-width="1.2"/><rect x="${sx+6}" y="${y+56}" width="10" height="${h-110}" fill="var(--card)" stroke="${acc}" stroke-width=".8"/>`;
    s+=dim(x,y-18,x+w,y-18,szW,-8)+dim(sx+40,y,sx+40,y+h,szH,8);
    anchors=[[x+w/2,y+26],[x+w/2,y+h/2],[x+w/2,y+h-30],[sx+11,y+h/2],[x+10,y+h/2],[x+w-10,y+60]];
  }
  // 引出線（左右の列に配置）
  const techs=c.techs.slice(0,6).map(id=>T[id]);
  const leftX=26,rightX=W-26,colTop=100,gap=62;
  techs.forEach((t,i)=>{const [ax,ay]=anchors[i%anchors.length];const left=i%2===0;const lx=left?leftX+156:rightX-156;const ly=colTop+Math.floor(i/2)*gap+(left?0:26);const tx=left?leftX:rightX;const anchor=left?'start':'end';
    s+=`<path d="M${ax} ${ay} L${lx} ${ly}" stroke="${ink}" stroke-width=".8" fill="none"/><circle cx="${ax}" cy="${ay}" r="3" fill="${ROLE_COLOR[t.role]}" stroke="var(--card)"/>`;
    s+=`<line x1="${lx}" y1="${ly}" x2="${tx}" y2="${ly}" stroke="${ink}" stroke-width=".8"/>`;
    s+=`<rect x="${left?tx:tx-9}" y="${ly-25}" width="9" height="9" fill="${ROLE_COLOR[t.role]}"/><text x="${left?tx+13:tx-13}" y="${ly-17}" text-anchor="${anchor}" font-size="8.5" fill="${mute}" font-family="var(--mono)">${t.role} · ${esc(FAC[t.fac].name)}</text>`;
    const nm=t.name.replace(/（.*?）/g,'');s+=`<text x="${tx}" y="${ly-4}" text-anchor="${anchor}" font-size="10.5" font-weight="600" fill="${ink}">${esc(nm.length>16?nm.slice(0,15)+'…':nm)}</text>`;
  });
  if(c.coreSynergy) s+=`<text x="26" y="${H-24}" font-size="9.5" fill="${acc}" font-family="var(--mono)">CORE SYNERGY · ${esc(c.coreSynergy)}</text>`;
  s+=`<text x="26" y="${H-40}" font-size="8.5" fill="${mute}" font-family="var(--mono)">概念図（パラメトリック自動生成）· 寸法は規模の目安 · ${new Date(res.ts||Date.now()).toLocaleDateString('ja-JP')}</text>`;
  return s+'</svg>';
}

/* ===================== Claude API（ライブ推論） ===================== */
const LIVE_SCHEMA={type:'object',additionalProperties:false,required:['title','tagline','summary','synergies','industries','concepts','recommended','hypothesis'],properties:{
 title:{type:'string'},tagline:{type:'string'},summary:{type:'array',items:{type:'string'}},
 synergies:{type:'array',items:{type:'object',additionalProperties:false,required:['name','effect','tech_ids','industries'],properties:{name:{type:'string'},effect:{type:'string'},tech_ids:{type:'array',items:{type:'string'}},industries:{type:'array',items:{type:'string'}}}}},
 industries:{type:'array',items:{type:'object',additionalProperties:false,required:['name','score','reasons'],properties:{name:{type:'string'},score:{type:'integer'},reasons:{type:'array',items:{type:'string'}}}}},
 concepts:{type:'array',items:{type:'object',additionalProperties:false,required:['form','name','desc','size_mm','industries','radar','risks','next'],properties:{form:{type:'string',enum:FORMS},name:{type:'string'},desc:{type:'string'},size_mm:{type:'array',items:{type:'integer'}},industries:{type:'array',items:{type:'string'}},radar:{type:'object',additionalProperties:false,required:['技術成熟度','製造性','市場性','独自性','コスト効率'],properties:{技術成熟度:{type:'integer'},製造性:{type:'integer'},市場性:{type:'integer'},独自性:{type:'integer'},コスト効率:{type:'integer'}}},risks:{type:'array',items:{type:'string'}},next:{type:'array',items:{type:'string'}}}}},
 recommended:{type:'array',items:{type:'object',additionalProperties:false,required:['tech_id','reason'],properties:{tech_id:{type:'string'},reason:{type:'string'}}}},
 hypothesis:{type:'object',additionalProperties:false,required:['statement','tests'],properties:{statement:{type:'string'},tests:{type:'array',items:{type:'object',additionalProperties:false,required:['k','v'],properties:{k:{type:'string'},v:{type:'string'}}}}}},
}};
async function analyzeLive(selIds, ideaText, opts, cfg, log){
  const local=analyze(selIds,ideaText,opts); // 補完・工程・整合性はローカルで計算し、創造的な部分を Claude に委ねる
  const db=TECH.map(t=>`${t.id}|${FAC[t.fac].name}|${t.role}|${t.name}|${t.tags.join(',')}|${t.smin}-${t.smax}mm|lot ${t.lmin}-${t.lmax}|TRL${t.trl}`).join('\n');
  const sys=`あなたは製造業の技術コーディネータ兼プロダクトデザイナーです。複数の工場が持つ技術を組み合わせ、新しい製品・技術コンセプトを提案します。与えられた技術ベースの ID だけを使い、技術的に実現可能で、具体的で、売り先が明確な提案を日本語で返してください。score は 0〜100、radar の各値も 0〜100 の整数。concepts は規模の異なる 3 案（form は 部品/装置/大型/ノベルティ から 3 種類）。summary は 3 段落の配列。`;
  const user=`# 技術ベース（id|工場|役割|技術名|タグ|スケール|ロット|TRL）\n${db}\n\n# 選択された技術\n${local.ids.join(', ')}\n\n# アイデア・仮説\n${ideaText||'（未記入）'}\n\n# 条件\n規模: ${opts.form} / 数量: ${LOT_LABEL[opts.lot]} / 重視: ${opts.prio.join('・')||'指定なし'}\n\n# ローカル解析のヒント\n役割カバレッジ: ${local.coverage.roles.join('・')} / 未カバー: ${local.coverage.missing.join('・')||'なし'}\n整合性: ${local.compat.warnings.map(w=>w.text).join(' ')||'問題なし'}\n\n選択技術を核に、相乗効果・提供可能な領域（産業）・3 案のコンセプト・推奨追加技術・仮説と検証プランを返してください。`;
  log('Claude API へ送信 … model='+cfg.model,'hi');
  const body={model:cfg.model||'claude-opus-5-5',max_tokens:16000,system:sys,messages:[{role:'user',content:user}],output_config:{effort:'medium',format:{type:'json_schema',schema:LIVE_SCHEMA}},fallbacks:'default'};
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':cfg.key,'anthropic-version':'2026-10-21','anthropic-beta':'server-side-fallback-2026-07-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify(body)});
  if(!r.ok){const e=await r.text();throw new Error(`HTTP ${r.status}: ${e.slice(0,200)}`)}
  const msg=await r.json();
  if(msg.stop_reason==='refusal') throw new Error('モデルが応答を拒否しました（stop_reason: refusal）。表現を変えて再実行してください。');
  if(msg.stop_reason==='max_tokens') throw new Error('出力が長すぎて途中で切れました。技術数を減らして再実行してください。');
  const text=(msg.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
  const j=JSON.parse(text);
  log(`応答を受信: ${msg.usage?.input_tokens||'?'} in / ${msg.usage?.output_tokens||'?'} out tokens`,'ok');
  // ローカル結果にマージ
  const ids=local.ids;
  const concepts=j.concepts.slice(0,3).map((c,i)=>{const base=local.concepts.find(x=>x.form===c.form)||local.concepts[i]||local.concepts[0];const [W,D,H]=(c.size_mm&&c.size_mm.length>=3)?c.size_mm:[base.size.W,base.size.D,base.size.H];return {...base,form:c.form,formLabel:FORM_LABEL[c.form],name:c.name,code:CODENAMES[hash(c.name)%CODENAMES.length],tagline:`${c.industries[0]||''}向け ${FORM_LABEL[c.form]}`,desc:`<p>${esc(c.desc).replace(/\n+/g,'</p><p>')}</p>`,size:{W,D,H},sizeText:c.form==='大型'?`約 ${(W/1000).toFixed(1)} × ${(D/1000).toFixed(1)} × ${(H/1000).toFixed(1)} m`:`約 ${W} × ${D} × ${H} mm`,industries:c.industries.slice(0,3),radar:c.radar,risks:c.risks,next:c.next,coreSynergy:(j.synergies[0]||{}).name||null,costBand:costOf(c.form,opts.lot,ids.map(id=>T[id]))}});
  const synergies=j.synergies.map(s=>({id:'L',name:s.name,effect:s.effect,techs:s.tech_ids.filter(id=>T[id]).slice(0,2),industries:s.industries,via:[]})).filter(s=>s.techs.length===2);
  const industries=j.industries.filter(x=>INDUSTRIES.includes(x.name)).map(x=>({name:x.name,score:clamp(x.score,0,100),reasons:x.reasons})).sort((a,b)=>b.score-a.score).slice(0,7);
  return {...local,mode:'live',title:j.title,tagline:j.tagline,summary:j.summary,synergies,industries:industries.length?industries:local.industries,concepts:concepts.length?concepts:local.concepts,coverage:{...local.coverage,recommended:j.recommended.filter(r=>T[r.tech_id]&&!ids.includes(r.tech_id)).slice(0,3).map(r=>({id:r.tech_id,reason:r.reason}))},hypothesis:j.hypothesis,usage:msg.usage};
}
</script>
