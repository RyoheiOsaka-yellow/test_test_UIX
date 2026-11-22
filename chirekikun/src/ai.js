/* ══════════ 資料の読み取り（Claude API） ══════════
   接続は2通り：①同一オリジンの /api/claude（Netlify Functions。APIキーはサーバー側の環境変数）
               ②設定画面で登録したAPIキーでブラウザから直接（試用向け）
   どの資料も「案件データの部分（読み取れた項目だけ）」として同じ形で返させ、後で結合する。 */
const AI={mode:'none',model:'claude-opus-5-5'};
async function aiDetect(){
  if(/^https?:$/.test(location.protocol))try{const r=await fetch('/api/claude',{method:'GET'});if(r.ok){const j=await r.json().catch(()=>null);if(j&&j.ok){AI.mode='proxy';return AI.mode;}}}catch(e){}
  AI.mode=(store.get('apiKey')||'')?'key':'none';return AI.mode;
}
async function aiCall(content,maxTokens,opt){
  const body={model:store.get('model')||AI.model,max_tokens:maxTokens||16000,fallbacks:'default',messages:[{role:'user',content}]};
  if(opt&&opt.effort)body.output_config={effort:opt.effort};
  let r;
  if(AI.mode==='proxy')r=await fetch('/api/claude',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  else if(AI.mode==='key')r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':store.get('apiKey'),'anthropic-version':'2023-06-01','anthropic-beta':'server-side-fallback-2026-07-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify(body)});
  else throw new Error('AI読み取りが未接続です（設定で接続してください）');
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error((j.error&&j.error.message)||('通信エラー '+r.status));
  if(j.stop_reason==='refusal')throw new Error('モデルが応答を拒否しました');
  if(j.stop_reason==='max_tokens')throw new Error('出力が長すぎて途中で切れました。資料を分けて共有してください');
  return {text:(j.content||[]).map(c=>c.text||'').join(''),usage:j.usage||{}};
}
const EXTRACT_PROMPT=`あなたは土壌汚染対策法に基づく地歴調査の資料整理担当です。添付の資料1点を読み、読み取れた事実だけを次のJSONで返してください（説明文・コードフェンス不要）。

絶対ルール
- 資料に書かれていないことは書かない。推測で埋めない。読めない文字は「□」、判読に自信がない名義人は "unclear": true。
- 和暦・固有名詞・数値は原文のまま。全角数字は半角に。
- 各項目に、その記載があるページ番号（このPDFの何ページ目か。1始まり）を "p" で付ける。
- 既往報告書の場合、site.p に「1.1 調査件名」のページ、meta.lawsP に「1.4 関連法規」のページを入れる。
- kind は次から選ぶ：既往報告書／登記簿謄本（土地）／登記簿謄本（建物）／閉鎖登記簿／法人登記簿／公図／住宅地図／地形図／空中写真／ヒアリング記録／現地踏査写真／行政回答／その他

{"kind":"…","summary":"この資料が何か、1文",
 "site":{"pref":"都道府県","city":"市区町村（政令市は区まで）","town":"町丁目","jusho":"住居表示","chibanLabel":"地番表示","area":0.0,"areaNote":"面積の注記","parcels":[{"shozai":"所在","chiban":"地番","chimoku":"地目","chiseki":0.0,"owner":"所有者"}],"geoText":"地形・地質概要の本文","gwText":"地下水概要の本文","gwDir":"推定流向（南 など）","landform":"地形分類","p":0},
 "meta":{"title":"表紙の件名","reportDate":"表紙の年月","period":"調査期間","org":"調査機関名","orgNo":"指定調査機関番号","lawsP":0},
 "regs":{"suidaku":{"v":"なし/あり","src":"照会先","date":"照会日"},"gesui":{"v":"なし/あり","src":"照会先"},"zoneSrc":"区域指定の確認先と更新日","radius":"確認範囲","art6":"なし/あり","art11jin":"なし/あり","art11shizen":"なし/あり","art11umetate":"なし/あり","haiki":"なし/あり","ord":[{"name":"条例名","item":"確認した台帳・区域の名称","v":"なし/あり"}],"natural":"自然由来・公有水面に関する本文","p":0},
 "land":[{"chiban":"現状地番（所在を含めて）","chimoku":"地目","note":"閉鎖謄本・分筆前など","p":0,"rows":[{"date":"登記年月日","cause":"原因（売買・相続・◯番→◯番に分筆 など）","holder":"登記名義人等","chiseki":"地積（変更があった行のみ）","unclear":false}]}],
 "lineage":[{"date":"年月日","type":"分筆/合筆/換地処分/土地区画整理","from":["元の地番"],"to":["後の地番"]}],
 "buildings":[{"kaoku":"家屋番号","kind":"種類","structure":"構造","p":0,"rows":[{"date":"","cause":"","holder":""}]}],
 "corps":[{"name":"商号","addr":"本店","est":"会社成立の年月日","purpose":["目的1","目的2"],"closed":"解散・清算結了など","p":0}],
 "maps":[{"y":1960,"w":"昭和35年","use":"対象地用途（表記どおり。同上は同上）","around":"周辺地の土地利用","src":"根拠資料（住宅地図① など）","p":0}],
 "mapNotes":["地図・空中写真の所見の本文"],
 "hearing":[{"date":"実施日","by":"実施者","target":"聴取先","text":"聴取内容の本文","p":0}],
 "siteVisit":{"date":"実施日","by":"実施者","text":"踏査の本文","p":0},
 "verdict":{"level":"低い/否定できない","headline":"所見の見出し文","text":"所見の本文","p":0},
 "substances":["試料採取等対象物質の名称"],
 "uncertain":[{"where":"項目","text":"読み取った文字列","reason":"かすれ・旧字体など","p":0}]}
該当しない項目はキーごと省略してかまいません。`;
function fileToB64(file){return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result).split(',')[1]);fr.onerror=rej;fr.readAsDataURL(file);});}
async function aiExtractFile(file){
  const data=await fileToB64(file);const isPdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name);
  const block=isPdf?{type:'document',source:{type:'base64',media_type:'application/pdf',data}}:{type:'image',source:{type:'base64',media_type:file.type||'image/jpeg',data}};
  const {text,usage}=await aiCall([block,{type:'text',text:EXTRACT_PROMPT}],16000);
  const m=text.match(/\{[\s\S]*\}/);if(!m)throw new Error('読み取り結果を解釈できませんでした');
  const j=JSON.parse(m[0]);j._file=file.name;j._usage=usage;return j;
}
/* 物質名 → ID */
function subIdOf(name){const n=String(name).replace(/\s|及びその化合物|化合物/g,'');const alias={'カドニウム':'Cd','カドミウム':'Cd','六価クロム':'Cr6','シアン':'CN','水銀':'Hg','セレン':'Se','鉛':'Pb','砒素':'As','ヒ素':'As','ふっ素':'F','フッ素':'F','ほう素':'B','ホウ素':'B','ポリ塩化ビフェニル':'PCB','PCB':'PCB','有機りん':'OP','有機リン':'OP'};
  if(alias[n])return alias[n];const s=SUB.find(x=>x.name.replace(/\s|及びその化合物|化合物/g,'').replace(/[,，]/g,'-')===n.replace(/[,，]/g,'-'));return s?s.id:null;}
function pushDiff(c,d){if(!c.diffs.some(x=>x.text===d.text))c.diffs.push(d);}
/* 読み取り結果（部分）を案件に結合。空欄だけを埋め、表は追記する */
function mergePart(c,part,docId){
  const ref=p=>p?{doc:docId,p}:{doc:docId};
  const fill=(o,src,keys)=>keys.forEach(k=>{if(src&&src[k]!=null&&src[k]!==''&&(o[k]==null||o[k]===''||o[k]===0))o[k]=src[k];});
  if(part.site){fill(c.site,part.site,['pref','city','town','jusho','chibanLabel','area','areaNote','geoText','gwText','gwDir','landform']);
    (part.site.parcels||[]).forEach(p=>{if(!c.site.parcels.some(q=>q.chiban===p.chiban))c.site.parcels.push(p);});}
  if(part.meta){if(part.meta.title&&!c.titleLocked)c.title=part.meta.title.replace(/\s*地歴調査.*$/,'');fill(c,part.meta,['reportDate','period']);}
  if(part.regs){const g=c.regs;if(part.regs.art6||part.regs.art11jin){(g.zoneAuto&&g.zoneAuto.filled||[]).forEach(f=>{delete g[f];});if(g.zoneAuto){delete g.zoneSrc;delete g.radius;}delete g.zoneAuto;}['suidaku','gesui'].forEach(k=>{if(part.regs[k]&&!g[k])g[k]=part.regs[k];});fill(g,part.regs,['zoneSrc','radius','art6','art11jin','art11shizen','art11umetate','haiki','natural']);(part.regs.ord||[]).forEach(o=>{if(!g.ord.some(x=>x.name===o.name))g.ord.push(o);});if(part.regs.p)g.ref=ref(part.regs.p);}
  (part.land||[]).forEach(l=>{c.land.push({chiban:l.chiban,chimoku:l.chimoku,note:l.note,ref:ref(l.p),rows:l.rows||[]});});
  (part.lineage||[]).forEach(e=>{if(!c.lineage.some(x=>x.date===e.date&&x.type===e.type))c.lineage.push(e);});
  (part.buildings||[]).forEach(b=>c.buildings.push({...b,ref:ref(b.p)}));
  (part.corps||[]).forEach(x=>{if(!c.corps.some(y=>y.name===x.name))c.corps.push({...x,got:true,assess:'unknown',comment:'',ref:ref(x.p)});});
  (part.maps||[]).forEach(m=>{m.y=+m.y||waToYear(m.w)||0;if(!c.maps.some(x=>x.y===m.y&&x.src===m.src))c.maps.push(m);});if(part.maps&&part.maps.length&&part.maps[0].p)c.mapsRef=ref(part.maps[0].p);
  (part.mapNotes||[]).forEach(n=>c.mapNotes.push(n));
  (part.hearing||[]).forEach(h=>c.hearing.push({...h,ref:ref(h.p)}));
  if(part.siteVisit&&!c.siteVisit)c.siteVisit={...part.siteVisit,ref:ref(part.siteVisit.p)};
  if(part.verdict&&part.verdict.level){c.srcVerdict={...part.verdict,ref:ref(part.verdict.p)};}
  (part.substances||[]).forEach(n=>{const id=subIdOf(n);if(id&&!c.srcSubstances.includes(id))c.srcSubstances.push(id);});
  (part.uncertain||[]).forEach(u=>pushDiff(c,{sev:'warn',text:`読み取りに注意：${u.where}「${u.text}」（${u.reason}）`,ref:ref(u.p)}));
}
/* 結合後の仕上げ：年次順、懸念の抽出、所見・物質・区分。
   keep=true は既存の案件に資料を足したとき。人が決めた懸念の扱い・所見の文章・物質・区分は残し、新しく見つかった分だけ足す。 */
function finalizeCase(c,keep){
  if(!c.sample&&!c.source)applyZoneCheck(c);
  c.maps.sort((a,b)=>a.y-b.y);
  c.site.area=c.site.area||c.site.parcels.reduce((a,p)=>a+(+p.chiseki||0),0);
  if(!c.site.chibanLabel&&c.site.parcels.length)c.site.chibanLabel=`${c.site.pref}${c.site.city}${c.site.town} ${c.site.parcels[0].chiban}${c.site.parcels.length>1?' 他':''}`;
  /* 規模や設備を見ないと判断できない業種（個人の診療所、社名に「工業」等）は「確認待ち」。所見には効かせず、確認に出す */
  const found=detectConcerns(c).map(x=>{const i=INDBY[x.industry];return i&&i.soft?{...x,resolved:true,soft:true,pending:true}:x;});
  let fresh=found;
  if(keep){const have=new Set(c.concerns.map(x=>x.industry));fresh=found.filter(x=>!have.has(x.industry));fresh.forEach(x=>c.concerns.push(x));}
  else c.concerns=found;
  (c.corps||[]).forEach(co=>{if(!co.comment){const hit=matchInd((co.name||'')+' '+(co.purpose||[]).join(' ')).filter(i=>!i.soft);
    co.assess=hit.length?'concern':'low';co.comment=hit.length?`当法人は会社の目的に「${hit[0].label}」に関わる文言があることから、その過程において土壌汚染のおそれのある有害物質を使用していた可能性が否定できず、当時の有害物質の使用状況について、ヒアリング調査を実施する。`:'当法人は会社の目的から考えるに特定有害物質使用の可能性は低く、土壌汚染の可能性は低いと考えられる。';}});
  const v=verdictOf(c);const prev=c.verdict;
  if(!keep||!prev||prev.level!==v.level){
    if(keep&&prev&&prev.level!=='保留')pushDiff(c,{sev:'bad',text:`資料の追加で、所見が「${prev.level}」から「${v.level}」に変わった。追加で見つかった利用履歴（${fresh.map(x=>x.use).join('、')||'—'}）を「判断」で確認する。`});
    c.verdict=v;c.verdictEdited=false;}
  if(c.srcVerdict&&c.srcVerdict.level&&c.srcVerdict.level!==c.verdict.level)pushDiff(c,{sev:'bad',text:`共有された報告書の所見は「${c.srcVerdict.level}」、本システムの判定は「${c.verdict.level}」。根拠を見比べて確定してください。`,ref:c.srcVerdict.ref});
  if(!keep){const sel=selectSubstances(c);c.substances=sel.ids;c.extraSubstances=sel.extra;c.substancesManual=false;}
  else{const add=new Set(),ex=new Set(c.extraSubstances);fresh.filter(x=>!x.resolved).forEach(x=>{const i=INDBY[x.industry];if(i){i.subs.forEach(s=>add.add(s));(i.extra||[]).forEach(e=>ex.add(e));}});
    c.substances=SUB.filter(s=>c.substances.includes(s.id)||add.has(s.id)).map(s=>s.id);c.extraSubstances=[...ex];}
  if(c.srcSubstances.length){const a=new Set(c.substances),b=new Set(c.srcSubstances);const only=[...b].filter(x=>!a.has(x)).map(x=>SUBBY[x].name),miss=[...a].filter(x=>!b.has(x)).map(x=>SUBBY[x].name);
    if(only.length||miss.length)pushDiff(c,{sev:'warn',text:`対象物質が共有資料と異なる。${only.length?'資料のみ：'+only.join('、')+'。':''}${miss.length?'本システムのみ：'+miss.join('、')+'。':''}`});}
  const all=c.site.parcels.length?c.site.parcels.map(p=>p.chiban):['敷地全域'];
  if(!keep){c.classification=c.verdict.level==='否定できない'?{none:[],low:all.slice(),high:[]}:{none:[],low:[],high:[]};}
  else{const cl=c.classification;const known=new Set([...cl.none,...cl.low,...cl.high]);
    if(c.verdict.level==='否定できない')all.filter(p=>!known.has(p)&&!(p==='敷地全域'&&known.size)).forEach(p=>cl.low.push(p));}
  if(!c.mapNotes.length&&c.maps.length){const m=resolveSame(c.maps);const uses=[...new Set(m.map(x=>x.useR))];
    c.mapNotes=[`空中写真及び地図による調査の結果、調査対象地の土地利用は${uses.join('、')}と移り変わり、現在に至る。`,`調査対象地の土地利用履歴は、${uses.join('・')}であり、${openConcerns(c).length?'土壌汚染のおそれがある有害物質を取扱っていた可能性が否定できない。':'土壌汚染のおそれがある有害物質を取扱う可能性が考えられる土地利用は確認されなかった。'}`];}
  return c;
}
/* 標高から地下水流向を推定（国土地理院 標高API）。周囲8方向・半径rの標高差が最大の下り方向を採る */
async function estimateGW(lat,lng){
  const r=200,dirs=[['北',1,0],['北東',1,1],['東',0,1],['南東',-1,1],['南',-1,0],['南西',-1,-1],['西',0,-1],['北西',1,-1]];
  const el=async(la,lo)=>{const j=await (await fetch(`https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=${lo}&lat=${la}&outtype=JSON`)).json();return typeof j.elevation==='number'?j.elevation:NaN;};
  const pts=dirs.map(([n,dy,dx])=>{const k=Math.hypot(dy,dx);return {n,la:lat+(dy/k)*r/111000,lo:lng+(dx/k)*r/(111000*Math.cos(lat*Math.PI/180))};});
  const [e0,...es]=await Promise.all([el(lat,lng),...pts.map(p=>el(p.la,p.lo))]);const out=pts.map((p,i)=>({n:p.n,e:es[i]}));
  const ok=out.filter(o=>!isNaN(o.e));if(isNaN(e0)||ok.length<4)return null;
  const low=ok.reduce((a,b)=>b.e<a.e?b:a);const drop=e0-low.e;
  /* 200mで1m未満の標高差は平坦とみなし、流向を決めない（低地・埋立地では地形だけで決められない） */
  return {elev:e0,dir:drop>=1.0?low.n:null,drop,r,samples:out};
}

/* ══════════ 空中写真の下読み（AI判読案） ══════════
   国土地理院の年代別の空中写真を、対象地を中心に1枚の画像にまとめてClaudeに渡し、用途の読み取り案を受け取る。
   結果は「判読案」として表に出し、担当者が採用するまで利用履歴・所見には使わない。 */
async function photoImage(lat,lng,layer,ext,z){
  const n=Math.pow(2,z),x=(lng+180)/360*n,y=(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n,tx=Math.floor(x),ty=Math.floor(y);
  const W=512,H=512,cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');g.fillStyle='#ddd';g.fillRect(0,0,W,H);
  const ox=W/2-(256+(x-tx)*256),oy=H/2-(256+(y-ty)*256);
  const load=(i,j)=>new Promise(res=>{const im=new Image();im.crossOrigin='anonymous';im.onload=()=>res({i,j,im});im.onerror=()=>res({i,j,im:null});im.src=`https://cyberjapandata.gsi.go.jp/xyz/${layer}/${z}/${tx+i}/${ty+j}.${ext}`;});
  const jobs=[];for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)jobs.push(load(i,j));
  const tiles=await Promise.all(jobs);if(!tiles.find(t=>t.i===0&&t.j===0).im)return null;
  tiles.forEach(t=>{if(t.im)g.drawImage(t.im,ox+(t.i+1)*256,oy+(t.j+1)*256);});
  g.strokeStyle='#e60012';g.lineWidth=3;g.beginPath();g.arc(W/2,H/2,20,0,Math.PI*2);g.stroke();
  return cv.toDataURL('image/jpeg',0.88).split(',')[1];
}
const PHOTO_PROMPT=`あなたは土壌汚染対策法に基づく地歴調査の担当者の下読み役です。国土地理院の年代別の空中写真を、古い順に渡しました。各写真の中心の赤い丸が調査対象地の代表点です（敷地の境界は示していません。丸の中とそのすぐ外側を対象地として読んでください）。写真1枚は一辺およそ500mです。
写真ごとに、写真から見て取れることだけを書いてください。
- site：対象地の土地利用（例：田、畑、空地、住宅、低層の建物、大きな屋根の建物（工場・倉庫の可能性）、駐車場、資材置場）。25字以内。
- around：周辺の土地利用。35字以内。
- conf：判読の確からしさ。「高」「中」「低」のいずれか。
- note：そう読んだ根拠と、写真では分からない点。60字以内。
業種や事業者名は写真からは分からないので書かないでください。工場・給油所などに見える形状は「〜の可能性」と書いてください。解像度や影で読めないときは site を「判読不能」としてください。
最後に summary として、年代を通した土地利用の移り変わりを120字以内でまとめてください。
次のJSONだけを返してください（説明文・コードフェンス不要）。n は写真の番号です。
{"photos":[{"n":1,"site":"","around":"","conf":"","note":""}],"summary":""}`;
async function aiReadPhotos(c,onStep){
  const s=c.site||{};if(!s.lat)throw new Error('対象地の位置が未設定です');
  const got=[];
  for(const p of GSI_PHOTOS){if(onStep)onStep(`写真を取得中　${p[2]}`);const b=await photoImage(s.lat,s.lng,p[0],p[1],17);if(b)got.push({p,b});}
  if(!got.length)throw new Error('この地点の空中写真を取得できませんでした');
  const content=[];got.forEach((g,i)=>{content.push({type:'text',text:`写真${i+1}：撮影年代 ${g.p[2]}${g.p[3]?'（'+g.p[3]+'）':''}`});content.push({type:'image',source:{type:'base64',media_type:'image/jpeg',data:g.b}});});
  content.push({type:'text',text:PHOTO_PROMPT});
  if(onStep)onStep(`${got.length}年代の写真を判読中`);
  const {text,usage}=await aiCall(content,8000,{effort:'high'});
  const m=text.match(/\{[\s\S]*\}/);if(!m)throw new Error('判読結果を解釈できませんでした');
  const j=JSON.parse(m[0]);const cut=(v,n)=>String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n);
  const rows=got.map((g,i)=>{const r=(j.photos||[]).find(x=>+x.n===i+1)||(j.photos||[])[i]||{};return {layer:g.p[0],era:g.p[2],site:cut(r.site,40)||'判読不能',around:cut(r.around,60),conf:/^(高|中|低)$/.test(r.conf)?r.conf:'低',note:cut(r.note,120)};});
  c.photoRead={at:new Date().toISOString().slice(0,10),rows,summary:cut(j.summary,240),usage,adopted:false};
  return c.photoRead;
}
/* 判読案を利用履歴表に採用する（担当者の操作）。以後は通常の年次表として編集できる */
function adoptPhotoRead(c){
  const pr=c.photoRead;if(!pr||!pr.rows.length)return 0;const year=new Date().getFullYear();let n=0;
  pr.rows.filter(r=>r.site&&r.site!=='判読不能').forEach(r=>{const p=GSI_PHOTOS.find(x=>x[0]===r.layer);if(!p)return;const y=p[4]||year;const src=`空中写真（国土地理院 ${p[2]}${p[3]?'・'+p[3]:''}）`;
    if(c.maps.some(m=>m.src===src))return;c.maps.push({y,w:p[4]?p[5]:toWareki(new Date()).replace(/年.*$/,'年'),use:r.site,around:r.around,src,ai:true});n++;});
  c.maps.sort((a,b)=>a.y-b.y);pr.adopted=true;return n;
}
