/* ══════════ 画面 ══════════ */
const $=id=>document.getElementById(id);
const store={get(k){try{const v=localStorage.getItem('anglex.'+k);return v==null?null:JSON.parse(v);}catch(e){return null;}},set(k,v){try{localStorage.setItem('anglex.'+k,JSON.stringify(v));}catch(e){}},del(k){try{localStorage.removeItem('anglex.'+k);}catch(e){}}};
let tt;function toast(m){const t=$('toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),3800);}
const today=()=>new Date().toISOString().slice(0,10);
const clone=o=>JSON.parse(JSON.stringify(o));
function normalize(c){c.srcSubstances=c.srcSubstances||[];c.reviewed=c.reviewed||[];c.diffs=c.diffs||[];c.docs=c.docs||[];c.regs=c.regs||{};c.regs.ord=c.regs.ord||[];['land','lineage','buildings','corps','maps','mapNotes','hearing','concerns','substances','extraSubstances'].forEach(k=>c[k]=c[k]||[]);c.classification=c.classification||{none:[],low:[],high:[]};c.request=c.request||{purpose:'sale'};if(c.sample){if(c.verdictEdited==null)c.verdictEdited=true;if(c.substancesManual==null)c.substancesManual=c.substances.length>0;}return c;}
const ST={user:store.get('user'),cases:[],route:'login',caseId:null,tab:'review',files:[],pdf:{}};
function loadCases(){const saved=store.get('cases');let cs=saved&&saved.length?saved:clone(SAMPLES);
  if(store.get('samplesVer')!==SAMPLES_VERSION){cs=clone(SAMPLES).concat(cs.filter(c=>!c.sample));store.set('samplesVer',SAMPLES_VERSION);store.set('cases',cs);}
  ST.cases=cs.map(normalize);}
function saveCases(){store.set('cases',ST.cases);}
const curCase=()=>ST.cases.find(c=>c.id===ST.caseId);
const DEFAULT_ORG={name:'株式会社エコ・テック',no:'2016-3-1006',addr:'東京都品川区南大井6-16-20 品川水神ビル7階',tel:'03-5781-5433'};

function go(route,id){ST.route=route;if(id!==undefined)ST.caseId=id;render();window.scrollTo(0,0);}
function render(){
  if(!ST.user&&ST.route!=='login')ST.route='login';
  document.body.dataset.route=ST.route;
  $('top').hidden=ST.route==='login';
  document.querySelectorAll('#top .nav button').forEach(b=>b.classList.toggle('on',b.dataset.r===ST.route||(b.dataset.r==='cases'&&(ST.route==='case'||ST.route==='new'))));
  if(ST.user)$('who').textContent=ST.user.name;
  const v=$('view');
  ({login:viewLogin,cases:viewCases,new:viewNew,case:viewCase,laws:viewLaws,settings:viewSettings})[ST.route](v);
}

/* ── ログイン ── */
function viewLogin(v){
  v.innerHTML=`<div class="login"><div class="login-brand"><div class="lb-in">
    <div class="brand big"><b>ANGLEX<i>.</i></b><span>地歴調査</span></div>
    <h1>資料を渡すだけで、<br>報告書の下書きまで。</h1>
    <ul><li><b>登記簿・地図・聴取記録を共有</b>すると、地番ごとの履歴表と所見まで組み上げます。</li><li>本文のすべての記載に、<b>根拠の資料名とページ番号</b>が付きます。</li><li>法令・条例は<b>公式の出典だけ</b>を使い、地域ごとの条例も照合します。</li></ul>
    <div class="lb-foot">指定調査機関向け　地歴調査レポート作成</div></div></div>
   <div class="login-form"><form id="lf" novalidate>
    <h2>ログイン</h2><p class="sub">登録済みのメールアドレスとパスワードを入力してください。</p>
    <div class="f"><label for="l-mail">メールアドレス</label><input id="l-mail" type="email" autocomplete="username" placeholder="name@example.co.jp" value="${esc(store.get('lastMail')||'')}"></div>
    <div class="f"><label for="l-pass">パスワード</label><input id="l-pass" type="password" autocomplete="current-password"></div>
    <div class="err" id="l-err" role="alert"></div>
    <button class="btn pri full lg" type="submit">ログイン</button>
    <button class="btn full" type="button" id="l-demo">デモ用アカウントで入る</button>
    <p class="note">試作版のため、認証サーバーにはまだ接続していません。入力した内容はこの端末のブラウザにだけ保存されます。</p>
   </form></div></div>`;
  const login=(mail)=>{ST.user={mail,name:mail.split('@')[0]};store.set('user',ST.user);store.set('lastMail',mail);loadCases();aiDetect().then(()=>go('cases'));};
  $('lf').onsubmit=e=>{e.preventDefault();const m=$('l-mail').value.trim(),p=$('l-pass').value;
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)){$('l-err').textContent='メールアドレスの形式を確認してください。';$('l-mail').focus();return;}
    if(!p){$('l-err').textContent='パスワードを入力してください。';$('l-pass').focus();return;}login(m);};
  $('l-demo').onclick=()=>login('demo@eco-tec.example');
}

/* ── 案件一覧 ── */
function viewCases(v){
  const rows=ST.cases.map(c=>{const R=reviewItems(c).filter(r=>!r.done&&r.sev!=='info');const ords=ordFor(c.site.pref,c.site.city).filter(o=>o.rules&&o.rules.length);const lv=c.verdict?c.verdict.level:'—';
    return `<button class="crow" data-id="${c.id}" type="button"><span class="ct"><b>${esc(c.title)}</b><small>${fmtArea(c.site.area)}㎡・${(c.site.parcels||[]).length}筆${c.sample?'・<i>サンプル（既往報告書から再構成）</i>':''}</small></span>
     <span class="cj"><em>${esc(c.site.pref||'—')}${c.site.city?' '+esc(c.site.city.replace(/^(.+?市).+区$/,'$1')):''}</em>${ords.map(o=>`<small>${esc(o.name.replace(/（.*?）/g,''))}</small>`).join('')||'<small class="mute">条例の登録なし</small>'}</span>
     <span><span class="lvl ${lv==='低い'?'low':lv==='否定できない'?'high':'none'}">${esc(lv)}</span></span>
     <span class="cn ${R.length?'':'zero'}">${R.length?`確認 <b>${R.length}</b> 件`:'確認済み'}</span><span class="cd num">${esc(c.updated||'')}</span></button>`;}).join('');
  v.innerHTML=`<div class="wrap"><div class="pagehead"><div><h1>案件</h1><p>資料を共有した案件ごとに、報告書の下書きと確認が必要な点をまとめています。</p></div><button class="btn pri lg" id="b-new" type="button">新しい調査を始める</button></div>
   <div class="clist"><div class="chead"><span>案件</span><span>自治体・照合する条例</span><span>所見</span><span>確認が必要な点</span><span>更新</span></div>${rows||'<div class="empty">案件はまだありません。「新しい調査を始める」から作成します。</div>'}</div>
   <p class="note">サンプルの4件は、共有いただいた既往報告書PDFを読み取り、同じ章立てで再構成したものです。原本との違い（誤記・転記ミスの疑い）は各案件の「確認」に出ます。</p></div>`;
  $('b-new').onclick=()=>{ST.files=[];ST.draft=null;go('new');};
  v.querySelectorAll('.crow').forEach(b=>b.onclick=()=>{ST.tab='review';go('case',b.dataset.id);});
}

/* ── 新しい調査 ── */
function kindByName(n){if(/報告書/.test(n))return ['既往報告書','本文'];if(/閉鎖|謄本|登記/.test(n))return ['登記簿謄本','一般公表資料'];if(/公図/.test(n))return ['公図','一般公表資料'];if(/住宅地図|地形図|地図/.test(n))return ['地形図・住宅地図','一般公表資料'];if(/空中|航空/.test(n))return ['空中写真','一般公表資料'];if(/踏査/.test(n))return ['現地踏査写真','私的資料'];if(/ヒアリング|聴取/.test(n))return ['聴取調査票','私的資料'];return ['その他の資料','一般公表資料'];}
function viewNew(v){
  const d=ST.draft||(ST.draft={addr:'',chiban:'',area:'',purpose:'sale',changeArea:'',note:'',period:'',lat:null,lng:null,geoTitle:''});
  v.innerHTML=`<div class="wrap narrow"><div class="pagehead"><div><h1>新しい調査を始める</h1><p>対象地と目的を入れ、手元の資料を共有してください。種類の判別と読み取り、条例の照合までを自動で行います。</p></div><button class="btn" id="n-back" type="button">案件に戻る</button></div>
  <div class="step"><div class="sn">1</div><div class="sb"><h2>対象地</h2>
    <div class="addr"><div class="f"><label for="n-addr">所在（町丁目まで）</label><input id="n-addr" placeholder="例：東京都葛飾区金町六丁目" value="${esc(d.addr)}"></div><button class="btn" id="n-geo" type="button">位置を確認</button></div>
    <div class="grid2"><div class="f"><label for="n-chiban">地番（複数は「、」区切り・後から追加可）</label><input id="n-chiban" placeholder="例：1702番1、1702番2" value="${esc(d.chiban)}"></div><div class="f"><label for="n-area">敷地面積（㎡・不明なら空欄）</label><input id="n-area" type="number" min="0" step="0.01" value="${esc(d.area)}"></div></div>
    <div id="n-juris" class="juris"></div>
    <div id="n-mapwrap" hidden><div id="n-map"></div><p class="note">ピンをドラッグすると番地の位置まで合わせられます。地図：国土地理院 地理院タイル。<span id="n-ll" class="num"></span></p></div></div></div>
  <div class="step"><div class="sn">2</div><div class="sb"><h2>目的と条件</h2>
    <div class="pcards" role="radiogroup" aria-label="調査の目的">${PURPOSES.map(p=>`<label class="pcard${d.purpose===p.id?' on':''}"><input type="radio" name="purpose" value="${p.id}" ${d.purpose===p.id?'checked':''}><b>${p.label}</b><small>${p.hint}</small></label>`).join('')}</div>
    <div class="grid2" id="n-chg" ${d.purpose==='develop'?'':'hidden'}><div class="f"><label for="n-change">形質変更を行う面積（㎡）</label><input id="n-change" type="number" min="0" value="${esc(d.changeArea)}"></div><div class="f"></div></div>
    <div class="f"><label for="n-note">要望・気になる点（自由に記入）</label><textarea id="n-note" rows="3" placeholder="例：昭和30年代に工場があったと聞いている。購入者への説明資料として使いたい。">${esc(d.note)}</textarea></div>
    <div class="f half"><label for="n-period">調査期間（任意）</label><input id="n-period" placeholder="例：令和8年11月21日～令和8年12月5日" value="${esc(d.period)}"></div></div></div>
  <div class="step"><div class="sn">3</div><div class="sb"><h2>資料を共有</h2>
    <label class="drop" id="n-drop"><b>PDF・画像をここにドロップ</b>、またはクリックして選択<br><small>登記簿謄本・閉鎖謄本・公図・住宅地図・地形図・空中写真・聴取記録・過去の報告書など。種類は自動で判別します。まとめて入れて構いません。</small><input type="file" id="n-file" multiple accept="application/pdf,image/*"></label>
    <div class="files" id="n-files"></div>
    <div class="aistate" id="n-ai"></div></div></div>
  <div class="cta"><button class="btn pri lg" id="n-run" type="button">レポートを作成する</button><span class="note" id="n-msg">資料がまだ無くても、章立てと法令・条例の判定までを作成できます。</span></div></div>`;
  const sync=()=>{d.addr=$('n-addr').value.trim();d.chiban=$('n-chiban').value.trim();d.area=$('n-area').value;d.note=$('n-note').value;d.period=$('n-period').value;d.changeArea=$('n-change').value;};
  const juris=()=>{sync();const pref=prefOf(d.addr),city=cityOf(d.addr);const os=ordFor(pref,city);
    $('n-juris').innerHTML=!pref?'':`<span class="jl">照合する法令・条例</span><span class="chip2">土壌汚染対策法</span>${os.filter(o=>o.rules&&o.rules.length).map(o=>`<span class="chip2 ord">${esc(o.name.replace(/（.*?）/g,''))}${ordVerified(o)?'':'<i>出典確認中</i>'}</span>`).join('')||`<span class="chip2 mute">${esc(pref)}${city?esc(city):''}：独自の調査義務を定める条例の登録なし</span>`}`;};
  $('n-addr').oninput=juris;juris();
  $('n-back').onclick=()=>go('cases');
  v.querySelectorAll('input[name=purpose]').forEach(r=>r.onchange=()=>{d.purpose=r.value;v.querySelectorAll('.pcard').forEach(l=>l.classList.toggle('on',l.querySelector('input').checked));$('n-chg').hidden=d.purpose!=='develop';});
  let map,marker;
  const showMap=(lat,lng)=>{d.lat=lat;d.lng=lng;$('n-mapwrap').hidden=false;$('n-ll').textContent=` ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    if(typeof L==='undefined'){$('n-map').innerHTML='<div class="mapna">地図を読み込めませんでした（ネットワーク）。位置は座標で保持しています。</div>';return;}
    if(!map){map=L.map('n-map',{maxZoom:19}).setView([lat,lng],18);
      const tile=(t,ext,mx)=>L.tileLayer(`https://cyberjapandata.gsi.go.jp/xyz/${t}/{z}/{x}/{y}.${ext}`,{maxNativeZoom:mx,maxZoom:19,attribution:'<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>'});
      const std=tile('std','png',18).addTo(map),ph=tile('seamlessphoto','jpg',18);L.control.layers({'標準地図':std,'空中写真（最新）':ph},{}, {collapsed:false}).addTo(map);
      marker=L.marker([lat,lng],{draggable:true}).addTo(map);marker.on('dragend',()=>{const p=marker.getLatLng();d.lat=p.lat;d.lng=p.lng;d.pinned=true;$('n-ll').textContent=` ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;});
    }else{map.setView([lat,lng],18);marker.setLatLng([lat,lng]);}
    setTimeout(()=>map.invalidateSize(),60);};
  $('n-geo').onclick=async()=>{sync();if(!d.addr){toast('所在を入力してください');return;}$('n-geo').disabled=true;
    try{const r=await fetch('https://msearch.gsi.go.jp/address-search/AddressSearch?q='+encodeURIComponent(d.addr));const j=await r.json();if(!j.length){toast('該当する地名が見つかりません。町丁目までで入力してください');return;}
      const g=j[0];d.geoTitle=g.properties.title;showMap(g.geometry.coordinates[1],g.geometry.coordinates[0]);toast(`${g.properties.title} の代表点です。ピンを動かして番地に合わせてください`);}
    catch(e){toast('住所検索に接続できません。位置は後から設定できます');}finally{$('n-geo').disabled=false;}};
  if(d.lat)showMap(d.lat,d.lng);
  const drawFiles=()=>{$('n-files').innerHTML=ST.files.map((f,i)=>{const k=kindByName(f.name);return `<div class="file"><span class="fk">${k[0]}</span><span class="fn">${esc(f.name)}</span><span class="fs num">${(f.size/1048576).toFixed(1)}MB</span><button type="button" class="x" data-i="${i}" aria-label="削除">×</button></div>`;}).join('');
    $('n-files').querySelectorAll('.x').forEach(b=>b.onclick=()=>{ST.files.splice(+b.dataset.i,1);drawFiles();});
    $('n-ai').innerHTML=ST.files.length?(AI.mode==='none'?`<b>AI読み取りが未接続です。</b>このまま作成すると、資料は添付資料として登録し、本文は章立てと法令判定のみになります。<button class="btn mini" type="button" id="n-set">接続を設定</button> <button class="btn mini" type="button" id="n-ex">読み取り済みの例を見る</button>`:`AI読み取り：接続済み（${AI.mode==='proxy'?'サーバー経由':'登録済みAPIキー'}）。${ST.files.length}点を順に読み取ります。`):'';
    if($('n-set'))$('n-set').onclick=()=>go('settings');if($('n-ex'))$('n-ex').onclick=()=>{ST.tab='review';go('case','s-kanamachi');};};
  const addFiles=fl=>{[...fl].forEach(f=>ST.files.push(f));drawFiles();};
  const dz=$('n-drop');dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('over');});dz.addEventListener('dragleave',()=>dz.classList.remove('over'));dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('over');addFiles(e.dataTransfer.files);});
  $('n-file').onchange=e=>{addFiles(e.target.files);e.target.value='';};drawFiles();
  $('n-run').onclick=()=>{sync();if(!d.addr&&!ST.files.length){$('n-msg').textContent='所在を入力するか、資料を1点以上共有してください。';$('n-msg').classList.add('bad');$('n-addr').focus();return;}runCreate(d);};
}
function blankCase(d){
  const pref=prefOf(d.addr),city=cityOf(d.addr),town=townOf(d.addr);
  const parcels=(d.chiban||'').split(/[、,，]/).map(s=>s.trim()).filter(Boolean).map(ch=>({shozai:city+town,chiban:ch,chimoku:'',chiseki:0,owner:''}));if(parcels.length===1&&+d.area)parcels[0].chiseki=+d.area;
  return normalize({id:'c'+Date.now(),sample:false,status:'review',updated:today(),title:d.addr?d.addr+'地内':'（件名未設定）',reportDate:toWareki(new Date()),period:d.period||'',org:store.get('org')||DEFAULT_ORG,
    request:{purpose:d.purpose,note:d.note,formChange:d.purpose==='develop',changeArea:+d.changeArea||0},
    site:{pref,city,town,jusho:'',chibanLabel:parcels.length?`${d.addr} ${parcels[0].chiban}${parcels.length>1?' 他':''}`:'',area:+d.area||0,areaNote:'公簿面積による推定',lat:d.lat,lng:d.lng,pinned:!!d.pinned,parcels,geoText:'',gwText:'',gwDir:'',mapSrc:'地理院地図(電子国土web)'},
    regs:{ord:[],natural:''},verdict:null});
}
async function runCreate(d){
  const c=blankCase(d);const files=ST.files.slice();const useAI=AI.mode!=='none'&&files.length>0;
  const steps=[['docs','資料の種類を判別',files.length?`${files.length}点`:'資料なし'],['read','資料を読み取り',useAI?`0 / ${files.length}`:files.length?'未接続のため添付として登録':'—'],['land','地番ごとの履歴を整理',''],['law','法令・条例を照合',''],['gw','地下水流向を推定',''],['draft','所見の下書き','']];
  $('view').innerHTML=`<div class="wrap narrow"><div class="proc"><h1>レポートを作成しています</h1><p class="sub">${esc(c.title)}</p><div class="psteps">${steps.map(s=>`<div class="ps" id="ps-${s[0]}"><i></i><b>${s[1]}</b><span>${s[2]}</span></div>`).join('')}</div><div class="err" id="p-err"></div></div></div>`;
  const mark=(id,state,txt)=>{const e=$('ps-'+id);if(!e)return;e.className='ps '+state;if(txt!=null)e.querySelector('span').textContent=txt;};
  const tick=ms=>new Promise(r=>setTimeout(r,ms));
  try{
    mark('docs','run');const letters={一般公表資料:'ABCDEFGH',公的資料:'ABCD',私的資料:'ABCD'};const cnt={一般公表資料:0,公的資料:0,私的資料:0};
    const ids=files.map(f=>{const k=kindByName(f.name);if(k[1]==='本文'){c.docs.push({id:'R',kind:k[0],name:f.name,cls:'本文',pages:''});return 'R';}const id=(k[1]==='私的資料'?'P':k[1]==='公的資料'?'K':'')+letters[k[1]][cnt[k[1]]++];c.docs.push({id,kind:k[0],name:f.name,cls:k[1],pages:''});return id;});
    await tick(250);mark('docs','ok');
    mark('read','run');
    if(useAI){for(let i=0;i<files.length;i++){mark('read','run',`${i+1} / ${files.length}　${files[i].name}`);
        try{const part=await aiExtractFile(files[i]);const doc=c.docs.find(x=>x.id===ids[i]);if(doc&&part.kind)doc.kind=part.kind.replace(/（.*$/,'');if(part.kind==='既往報告書'){c.source={file:files[i].name,pages:null,bodyOffset:0,overviewP:(part.site&&+part.site.p)||null,lawsP:(part.meta&&+part.meta.lawsP)||null};}mergePart(c,part,ids[i]);}
        catch(e){c.diffs.push({sev:'bad',text:`「${files[i].name}」を読み取れませんでした：${e.message}`});}}
      mark('read','ok',`${files.length}点`);}
    else{await tick(200);mark('read',files.length?'skip':'ok');}
    files.forEach((f,i)=>{ST.pdf[c.id+':'+ids[i]]=f;});if(c.source){const i=ids.indexOf('R');if(i>=0)ST.pdf[c.id]=files[i];}
    mark('land','run');await tick(200);mark('land','ok',c.land.length?`${c.land.length}筆・${c.land.reduce((a,l)=>a+l.rows.length,0)}行`:'登記簿の共有待ち');
    mark('law','run');finalizeCase(c);await tick(200);const os=ordFor(c.site.pref,c.site.city).filter(o=>o.rules&&o.rules.length);mark('law','ok',`土壌汚染対策法${os.length?'＋'+os.map(o=>o.name.replace(/（.*?）/g,'')).join('、'):''}`);
    mark('gw','run');
    if(c.site.lat&&!c.site.gwText){try{const g=await estimateGW(c.site.lat,c.site.lng);if(g){c.site.gwDir=g.dir||'';c.site.gwElev=g;
        c.site.gwText=g.dir?`調査対象地の標高は約${g.elev.toFixed(1)}mであり、周囲${g.r}mの標高と比較すると${g.dir}方向が約${g.drop.toFixed(1)}m低い。このことから調査対象地における地下水の流向は、概ね${g.dir}向きの流向が推定される。ただし、調査対象地における局所的な地下水の流れについては、調査対象地及び隣接地の地下構造物等にも影響されることに注意が必要となる。`
          :`調査対象地の標高は約${g.elev.toFixed(1)}mであり、周囲${g.r}mの標高差は${Math.max(0,g.drop).toFixed(1)}mとほぼ平坦である。地形からは流向を特定できないため、周辺の河川・海域の位置関係から判断する必要がある。`;mark('gw','ok',g.dir?`${g.dir}向き（標高差 ${g.drop.toFixed(1)}m）`:'平坦のため特定できず');}else mark('gw','skip','標高を取得できず');}catch(e){mark('gw','skip','標高APIに接続できず');}}
    else mark('gw',c.site.gwText?'ok':'skip',c.site.gwText?'資料の記載を採用':'位置が未設定');
    mark('draft','run');await tick(250);mark('draft','ok',c.verdict?`所見：${c.verdict.level}`:'');
    ST.cases.unshift(c);saveCases();ST.files=[];ST.draft=null;await tick(350);ST.tab='review';go('case',c.id);toast('レポートを作成しました。右の「確認」に、人の目が必要な点だけを出しています');
  }catch(e){$('p-err').innerHTML=`作成に失敗しました：${esc(e.message)}　<button class="btn mini" type="button" onclick="go('new')">入力に戻る</button>`;}
}

/* ── 案件（レポート） ── */
function setPath(o,path,val){const ks=path.split('.');let cur=o;for(let i=0;i<ks.length-1;i++){const k=/^\d+$/.test(ks[i])?+ks[i]:ks[i];if(cur[k]==null)cur[k]={};cur=cur[k];}const last=/^\d+$/.test(ks[ks.length-1])?+ks[ks.length-1]:ks[ks.length-1];cur[last]=val;}
function viewCase(v){
  const c=curCase();if(!c){go('cases');return;}
  if(!c.verdict)c.verdict=verdictOf(c);
  const lv=c.verdict.level;
  v.innerHTML=`<div class="ws-head"><div class="wh-in"><button class="btn mini" id="c-back" type="button">案件一覧</button><div class="wt"><h1>${esc(c.title)}</h1><span class="lvl ${lv==='低い'?'low':'high'}">${esc(lv)}</span>${c.sample?'<span class="tag">サンプル</span>':''}</div>
    <div class="wa"><button class="btn" id="c-word" type="button">Wordで保存</button><button class="btn pri" id="c-pdf" type="button">PDFで出力</button></div></div></div>
   <div class="ws"><nav class="ws-toc" id="c-toc" aria-label="目次"></nav><div class="ws-paper"><article class="paper" id="paper"></article></div>
    <aside class="ws-side"><div class="tabs2" role="tablist">${[['review','確認'],['judge','判断'],['src','出典'],['docs','資料']].map(t=>`<button type="button" role="tab" data-t="${t[0]}" class="${ST.tab===t[0]?'on':''}">${t[1]}<i id="tb-${t[0]}"></i></button>`).join('')}</div><div class="side-body" id="side"></div></aside></div>`;
  $('c-back').onclick=()=>go('cases');
  $('c-pdf').onclick=()=>{$('printarea').innerHTML=$('paper').innerHTML;$('printarea').querySelectorAll('[contenteditable]').forEach(e=>e.removeAttribute('contenteditable'));
    const imgs=[...$('printarea').querySelectorAll('img')].filter(i=>!i.complete);const b=$('c-pdf');
    if(!imgs.length){window.print();return;}
    b.disabled=true;b.textContent='図を読み込み中…';
    Promise.race([Promise.all(imgs.map(i=>new Promise(r=>{i.onload=i.onerror=r;}))),new Promise(r=>setTimeout(r,6000))]).then(()=>{b.disabled=false;b.textContent='PDFで出力';window.print();});};
  $('c-word').onclick=()=>exportWord(c);
  v.querySelectorAll('.tabs2 button').forEach(b=>b.onclick=()=>{ST.tab=b.dataset.t;v.querySelectorAll('.tabs2 button').forEach(x=>x.classList.toggle('on',x===b));drawSide();});
  drawPaper();drawSide();
}
function drawPaper(){
  const c=curCase();const p=$('paper');p.innerHTML=renderReport(c);
  $('c-toc').innerHTML=`<div class="tl">目次</div>`+tocOf(c).map(t=>`<a href="#${t[0]}" data-go="${t[0]}" class="l${t[2]}">${t[1]}</a>`).join('');
  document.querySelectorAll('[data-go]').forEach(a=>a.onclick=e=>{e.preventDefault();const el=document.getElementById(a.dataset.go);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});});
  p.querySelectorAll('[data-path]').forEach(el=>el.addEventListener('blur',()=>{const val=el.innerText.replace(/ /g,' ').trim();setPath(c,el.dataset.path,val);if(el.dataset.path.indexOf('verdict.')===0)c.verdictEdited=true;c.updated=today();saveCases();drawSide(true);}));
  p.querySelectorAll('.ev').forEach(el=>el.onclick=()=>openPage(c,+el.dataset.p||1,el.dataset.doc));
}
function drawSide(keep){
  const c=curCase();const R=reviewItems(c);const open=R.filter(r=>!r.done&&r.sev!=='info');
  $('tb-review').textContent=open.length||'';
  const side=$('side');
  if(ST.tab==='review'){
    side.innerHTML=`<div class="sv-head"><b>${open.length?`人の確認が必要な点：${open.length}件`:'確認が必要な点はありません'}</b><p>読み取りに自信がない箇所、資料どうしの食い違い、未記入の項目だけを出しています。ほかの記載は根拠ページ付きで本文に入っています。</p></div>`+
     R.map(r=>`<div class="rv ${r.sev}${r.done?' done':''}"><div class="rh"><span class="pill ${r.sev==='bad'?'bad':r.sev==='warn'?'warn':'info'}">${r.sev==='bad'?'要修正':r.sev==='warn'?'要確認':'参考'}</span><em>${esc(r.area)}</em>${r.ref&&r.ref.p?`<button type="button" class="pg" data-p="${r.ref.p}" data-doc="${r.ref.doc&&r.ref.doc!=='R'?esc(r.ref.doc):''}">p.${r.ref.p}</button>`:''}</div><p>${esc(r.text)}</p>
       <div class="ra">${r.anchor?`<button type="button" class="lnk" data-a="${r.anchor}">該当箇所へ</button>`:''}<button type="button" class="lnk" data-k="${esc(r.key)}">${r.done?'未確認に戻す':'確認済みにする'}</button></div></div>`).join('');
    side.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{const el=document.getElementById(b.dataset.a);if(el){el.scrollIntoView({behavior:'smooth',block:'start'});el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),1600);}});
    side.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{const k=b.dataset.k;const i=c.reviewed.indexOf(k);if(i>=0)c.reviewed.splice(i,1);else c.reviewed.push(k);saveCases();drawSide();});
    side.querySelectorAll('.pg').forEach(b=>b.onclick=()=>openPage(c,+b.dataset.p,b.dataset.doc));
  }else if(ST.tab==='judge'){
    const rq=c.request;const all=(c.site.parcels||[]).map(p=>p.chiban);const cl=c.classification;const sel=new Set(c.substances);
    side.innerHTML=`<div class="jg"><h3>調査の目的</h3><select id="j-purpose">${PURPOSES.map(p=>`<option value="${p.id}" ${rq.purpose===p.id?'selected':''}>${p.label}</option>`).join('')}</select>
      <label class="ck"><input type="checkbox" id="j-chg" ${rq.formChange?'checked':''}> 土地の形質変更を行う</label><div class="f" ${rq.formChange?'':'hidden'} id="j-chgw"><label for="j-area">形質変更の面積（㎡）</label><input id="j-area" type="number" value="${rq.changeArea||''}"></div></div>
     <div class="jg"><h3>適用条項</h3>${judge(c).map(r=>`<div class="jr j-${r.st[0]}"><span><b>${esc(r.law.replace(/（.*?）/g,'').replace('土壌汚染対策法','法'))} ${esc(r.art)}</b><small>${esc(r.title)}</small></span><span class="pill ${{yes:'bad',maybe:'warn',no:'ok',info:'info',done:'ok',todo:'warn'}[r.st[0]]}">${esc(r.st[1])}</span></div>`).join('')}</div>
     <div class="jg"><h3>懸念となる利用履歴</h3>${c.concerns.length?c.concerns.map((x,i)=>`<div class="cc ${x.resolved?'res':''}"><b>${esc(x.use)}</b><small>${esc(x.period||'')}　${esc(INDBY[x.industry]?INDBY[x.industry].label:'')}<br>根拠：${esc(x.basis||'')}</small>
        ${x.pending?'<small class="pend">確認待ち：規模・設備を確かめて、扱うかどうかを決めてください。</small>':''}<label class="ck"><input type="checkbox" data-ci="${i}" ${x.resolved?'':'checked'}> 汚染のおそれとして扱う</label>${x.resolved?`<input class="rn" data-cn="${i}" placeholder="扱わない理由（所見に入ります）" value="${esc(x.resolveNote||'')}">`:''}</div>`).join(''):'<p class="mute">事業場としての利用履歴は見つかっていません。</p>'}
      <div class="cadd"><select id="j-ind" aria-label="業種">${IND.map(i=>`<option value="${i.id}">${esc(i.label)}</option>`).join('')}</select><input id="j-use" class="rn" placeholder="利用の内容（例：○○鍍金工業所、昭和40年頃）"><button class="btn mini" type="button" id="j-add">懸念を追加</button></div></div>
     <div class="jg"><h3>所見</h3><p class="vd"><span class="lvl ${c.verdict.level==='低い'?'low':'high'}">${esc(c.verdict.level)}</span> 懸念の扱いを変えると所見・4～6章を組み直します。</p><button class="btn mini" type="button" id="j-redo">所見の文章を判定から書き直す</button></div>
     ${c.verdict.level==='否定できない'?`<div class="jg"><h3>試料採取等対象物質</h3>${[1,2,3].map(k=>`<div class="sk"><small>${KIND[k]}</small>${SUB.filter(s=>s.k===k).map(s=>`<button type="button" class="sb2 ${sel.has(s.id)?'on':''}" data-s="${s.id}">${s.name.replace(/及びその化合物|化合物/,'')}</button>`).join('')}</div>`).join('')}</div>
     <div class="jg"><h3>おそれの区分（筆ごと）</h3>${(all.length?all:['敷地全域']).map(p=>{const cur=cl.high.includes(p)?'high':cl.none.includes(p)?'none':'low';return `<div class="cp"><span>${esc(p)}</span><select data-p="${esc(p)}"><option value="none" ${cur==='none'?'selected':''}>おそれがない</option><option value="low" ${cur==='low'?'selected':''}>おそれが少ない</option><option value="high" ${cur==='high'?'selected':''}>比較的多い</option></select></div>`;}).join('')}</div>`:''}
     <div class="jg"><h3>条例に基づく確認結果</h3>${ordFor(c.site.pref,c.site.city).filter(o=>o.rules&&o.rules.some(r=>r.trigger==='ledger'||r.trigger==='zone')).map(o=>{const rec=c.regs.ord.find(x=>x.name===o.name||o.name.indexOf(x.name)===0);const r=o.rules.find(r=>r.trigger==='ledger'||r.trigger==='zone');return `<div class="cp"><span>${esc(o.name.replace(/（.*?）/g,''))}<small>${esc(r.heading||r.art)}</small></span><select data-o="${esc(o.name)}" data-item="${esc(r.heading||'台帳・区域')}"><option value="">未確認</option><option ${rec&&rec.v==='なし'?'selected':''}>なし</option><option ${rec&&rec.v==='あり'?'selected':''}>あり</option></select></div>`;}).join('')||'<p class="mute">この地域に、台帳・区域の確認を要する条例の登録はありません。</p>'}</div>`;
    const redo=(full,force)=>{
      if(full){const v=verdictOf(c);const changed=!c.verdict||c.verdict.level!==v.level;
        /* 所見の文章：手で直してあれば、判定（低い／否定できない）が変わらない限り残す */
        if(force||changed||!c.verdictEdited){if(c.verdictEdited&&changed&&!force)toast(`判定が「${v.level}」に変わったため、所見の文章を書き直しました。直した文章は入れ直してください`);c.verdict=v;c.verdictEdited=false;}
        if(force||!c.substancesManual){const s=selectSubstances(c);c.substances=s.ids;c.extraSubstances=s.extra;c.substancesManual=false;}
        const cl=c.classification;if(c.verdict.level==='否定できない'&&!(cl.none.length+cl.low.length+cl.high.length)){cl.low=(c.site.parcels||[]).map(p=>p.chiban);if(!cl.low.length)cl.low=['敷地全域'];}}
      c.updated=today();saveCases();const y=window.scrollY;drawPaper();drawSide();window.scrollTo(0,y);
      const lv=c.verdict.level;const h=document.querySelector('.ws-head .lvl');if(h){h.textContent=lv;h.className='lvl '+(lv==='低い'?'low':'high');}};
    $('j-purpose').onchange=e=>{rq.purpose=e.target.value;redo();};$('j-chg').onchange=e=>{rq.formChange=e.target.checked;redo();};if($('j-area'))$('j-area').onchange=e=>{rq.changeArea=+e.target.value||0;redo();};
    side.querySelectorAll('[data-ci]').forEach(b=>b.onchange=()=>{const x=c.concerns[+b.dataset.ci];x.resolved=!b.checked;x.pending=false;redo(true);});
    side.querySelectorAll('[data-cn]').forEach(b=>b.onchange=()=>{const x=c.concerns[+b.dataset.cn];x.resolveNote=b.value;x.pending=false;redo(true);});
    $('j-redo').onclick=()=>{redo(true,true);toast('所見と対象物質を判定から組み直しました');};
    $('j-add').onclick=()=>{const use=$('j-use').value.trim();if(!use){$('j-use').focus();toast('利用の内容を入力してください');return;}
      c.concerns.push({period:'',use,industry:$('j-ind').value,parcels:(c.site.parcels||[]).map(p=>p.chiban),basis:'担当者の判断',manual:true});
      if(c.substancesManual){const i=INDBY[$('j-ind').value];c.substances=SUB.filter(s=>c.substances.includes(s.id)||i.subs.includes(s.id)).map(s=>s.id);}redo(true);};
    side.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{const id=b.dataset.s;const i=c.substances.indexOf(id);if(i>=0)c.substances.splice(i,1);else c.substances.push(id);c.substances=SUB.filter(s=>c.substances.includes(s.id)).map(s=>s.id);c.substancesManual=true;redo();});
    side.querySelectorAll('select[data-p]').forEach(sl=>sl.onchange=()=>{const p=sl.dataset.p;['none','low','high'].forEach(k=>{cl[k]=cl[k].filter(x=>x!==p);});cl[sl.value].push(p);redo();});
    side.querySelectorAll('select[data-o]').forEach(sl=>sl.onchange=()=>{const n=sl.dataset.o;c.regs.ord=c.regs.ord.filter(x=>!(x.name===n||n.indexOf(x.name)===0));if(sl.value)c.regs.ord.push({name:n.replace(/（.*?）/g,''),item:sl.dataset.item,v:sl.value});redo();});
  }else if(ST.tab==='src'){
    const S=sourcesOf(c);const J=judge(c).filter(r=>r.src==='条例');
    side.innerHTML=`<div class="sv-head"><b>このレポートで使っている出典</b><p>法令・条例は公式サイト（e-Gov法令検索、環境省、自治体の例規集・公式ページ）で確認したものだけを「公式出典で確認」と表示します。</p></div>`+
     S.map(x=>`<div class="so"><span class="n">[${x.n}]</span><div><b>${esc(x.title)}</b><small>${esc(x.kind)}　${esc(x.detail||'')}</small>${x.url?`<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.url.replace(/^https?:\/\//,'').slice(0,60))}</a>`:''}<span class="pill ${x.verified?'ok':x.own?'gray':'warn'}">${x.verified?(x.url?'公式出典で確認':'照会記録'):x.own?'社内の既往報告書':'出典未確認'}</span></div></div>`).join('')+
     (J.length?`<div class="sv-head"><b>条例の該当条文</b></div>`+J.map(r=>`<div class="so"><span class="n">条</span><div><b>${esc(r.law.replace(/（.*?）/g,''))} ${esc(r.art)}</b><small>${esc(r.title)}</small>${r.cite.quote?`<q>${esc(r.cite.quote)}</q>`:''}${r.cite.url?`<a href="${esc(r.cite.url)}" target="_blank" rel="noopener">${esc(r.cite.url.replace(/^https?:\/\//,'').slice(0,60))}</a>`:''}<span class="pill ${r.cite.verified?'ok':'warn'}">${r.cite.verified?'公式出典で確認':'出典未確認'}</span></div></div>`).join(''):'');
  }else{
    side.innerHTML=`<div class="sv-head"><b>資料</b><p>${c.source?`原本：${esc(c.source.file)}${c.source.pages?'（'+c.source.pages+'頁）':''}`:'共有された資料の一覧です。'}　本文の「p.」を押すと、該当ページを開きます。</p></div>`+
     (c.docs||[]).map(d=>`<div class="dc"><span class="fk">${esc(d.cls==='本文'?'本文':d.cls.replace('資料','')+d.id.replace('P','').replace('K',''))}</span><span><b>${esc(d.kind)}</b><small>${esc(d.name||'')}${d.pages?'　p.'+esc(d.pages):''}</small></span></div>`).join('')+
     `<label class="drop sm" id="d-drop">${c.source&&!ST.pdf[c.id]?'<b>原本PDFを入れる</b>と、根拠ページをその場で表示できます':'<b>資料を追加</b>（PDF・画像）'}<input type="file" id="d-file" accept="application/pdf,image/*" multiple></label><div class="note" id="d-msg">${ST.pdf[c.id]?'原本PDFを読み込み済み':''}</div>
     <button class="btn mini" type="button" id="d-json">この案件をJSONで保存</button> <button class="btn mini" type="button" id="d-del">この案件を削除</button>`;
    const add=async fl=>{const fs=[...fl];if(c.source&&!ST.pdf[c.id]&&fs[0]&&/pdf$/i.test(fs[0].name)){ST.pdf[c.id]=fs.shift();ST.pdfDoc=null;$('d-msg').textContent='原本PDFを読み込みました。本文の「p.」を押すとページを表示します';toast('原本PDFを読み込みました');if(!fs.length)return;}
      if(AI.mode==='none'){fs.forEach(f=>{const k=kindByName(f.name);const id='X'+(c.docs.length+1);c.docs.push({id,kind:k[0],name:f.name,cls:k[1],pages:''});ST.pdf[c.id+':'+id]=f;});saveCases();drawSide();toast('資料を添付として登録しました（AI読み取りは未接続）');return;}
      for(const f of fs){$('d-msg').textContent=`読み取り中：${f.name}`;try{const id='X'+(c.docs.length+1);const part=await aiExtractFile(f);c.docs.push({id,kind:(part.kind||kindByName(f.name)[0]).replace(/（.*$/,''),name:f.name,cls:kindByName(f.name)[1],pages:''});ST.pdf[c.id+':'+id]=f;mergePart(c,part,id);}catch(e){toast(`${f.name} を読み取れませんでした：${e.message}`);}}
      finalizeCase(c,true);c.updated=today();saveCases();drawPaper();drawSide();toast('資料を読み取り、レポートに追記しました。懸念の扱い・所見・物質・区分はそのままです');};
    const dz=$('d-drop');dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('over');});dz.addEventListener('dragleave',()=>dz.classList.remove('over'));dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('over');add(e.dataTransfer.files);});
    $('d-file').onchange=e=>add(e.target.files);
    $('d-json').onclick=()=>download(`chireki-${c.title}.json`,JSON.stringify(c,null,1),'application/json');
    $('d-del').onclick=()=>{const b=$('d-del');if(b.dataset.arm){ST.cases=ST.cases.filter(x=>x.id!==c.id);saveCases();go('cases');toast('案件を削除しました');}else{b.dataset.arm='1';b.textContent='もう一度押すと削除します';b.classList.add('danger');}};
  }
}
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:type+';charset=utf-8'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}
function exportWord(c){
  const body=$('paper').cloneNode(true);body.querySelectorAll('[contenteditable]').forEach(e=>e.removeAttribute('contenteditable'));body.querySelectorAll('.evs,.unv,.tfig').forEach(e=>e.remove());
  const css='body{font-family:"MS Mincho","Yu Mincho",serif;font-size:10.5pt;line-height:1.7}h2{font-size:13pt;margin-top:18pt}h3{font-size:11pt}h4{font-size:10.5pt}table{border-collapse:collapse;width:100%}th,td{border:1px solid #555;padding:3pt 5pt;font-size:9.5pt;vertical-align:top}th{background:#ddd}.cover{text-align:center;page-break-after:always;padding-top:120pt}.ct{font-size:18pt}.ct2{font-size:16pt;margin-top:60pt}.cd{margin-top:80pt}.co{margin-top:40pt;font-size:13pt}.toc a{display:block;color:#000;text-decoration:none}.shoken{border:1.5pt solid #333}.sh{background:#ccc;text-align:center}.shh{text-align:center;font-weight:bold;padding:6pt}.sht{padding:6pt}svg{display:none}';
  download(`${c.title}_地歴調査報告書.doc`,`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>${css}</style></head><body>${body.innerHTML}</body></html>`,'application/msword');
  toast('Word形式で保存しました（体裁はWordで調整できます）');
}
/* 根拠ページの表示（pdf.js） */
async function openPage(c,p,doc){
  const d=doc?(c.docs||[]).find(x=>x.id===doc):null;const key=d?c.id+':'+doc:c.id;const f=ST.pdf[key];
  const name=d?(d.name||d.kind):(c.source?c.source.file:'資料');
  if(!f){toast(`${name} の p.${p}。「資料」タブでこのPDFを入れると、ここでページを表示します`);return;}
  if(!/pdf$/i.test(f.name)){toast(`${name} は画像のため、ページ表示の対象外です`);return;}
  if(typeof pdfjsLib==='undefined'){toast('PDF表示の部品を読み込めませんでした（ネットワーク）');return;}
  try{pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    if(!ST.pdfDoc||ST.pdfFor!==key){ST.pdfDoc=await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise;ST.pdfFor=key;}
    const show=async n=>{n=Math.max(1,Math.min(ST.pdfDoc.numPages,n));ST.pdfPage=n;const page=await ST.pdfDoc.getPage(n);const cv=$('pv-canvas');const w=Math.min(820,window.innerWidth-48);const v0=page.getViewport({scale:1});const vp=page.getViewport({scale:w/v0.width*2});cv.width=vp.width;cv.height=vp.height;cv.style.width=w+'px';await page.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;$('pv-n').textContent=`${name}　p.${n} / ${ST.pdfDoc.numPages}`;};
    $('pv').hidden=false;$('pv-prev').onclick=()=>show(ST.pdfPage-1);$('pv-next').onclick=()=>show(ST.pdfPage+1);$('pv-close').onclick=()=>{$('pv').hidden=true;};await show(p);
  }catch(e){toast('PDFを開けません：'+e.message);}
}

/* ── 法令・条例 ── */
function viewLaws(v){
  const prefs=[...new Set(ORD.map(o=>o.pref))];const nRule=ORD.reduce((a,o)=>a+(o.rules||[]).length,0),nOk=ORD.reduce((a,o)=>a+(o.rules||[]).filter(r=>r.verified&&r.url).length,0);
  const trig={area:'面積要件',facility:'施設の廃止等',ledger:'台帳',zone:'区域',other:'その他'};
  v.innerHTML=`<div class="wrap"><div class="pagehead"><div><h1>法令・条例</h1><p>レポートが参照する法令と、地域ごとの条例の登録内容です。公式サイトで条文を確認できたものだけを「公式出典で確認」と表示し、確認できていない条項は判定に使っても本文にその旨を明記します。</p></div>
    <div class="lawsum"><span><b>${ORD.length}</b>自治体</span><span><b>${nOk}</b> / ${nRule} 条項を公式出典で確認</span><span>確認日 <b>${esc(LAWS.checkedOn||'—')}</b></span></div></div>
   <div class="sec"><h2>国の法令・通知</h2><div class="tblwrap"><table class="gt"><thead><tr><th>名称</th><th>番号</th><th>最終改正</th><th>出典</th><th>状態</th></tr></thead><tbody>${LAWS.items.map(l=>`<tr><td class="wrapc"><b>${esc(l.name)}</b>${l.note?`<details><summary>補足</summary><small>${esc(l.note)}</small></details>`:''}</td><td>${esc(l.number)}</td><td class="wrapc">${esc(l.lastAmendedFull||l.lastAmended||'—')}</td><td>${l.url?`<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(new URL(l.url).hostname)}</a>`:'—'}</td><td>${l.verified?'<span class="pill ok">公式出典で確認</span>':'<span class="pill warn">出典未確認</span>'}</td></tr>`).join('')}</tbody></table></div>
    ${(LAWS.articles||[]).length?`<h3>調査の契機となる条文</h3><div class="arts">${LAWS.articles.map(a=>`<div class="art"><b>${esc(a.law||'土壌汚染対策法')} ${esc(a.art)}</b><p>${esc(a.summary||'')}</p>${a.quote?`<q>${esc(a.quote)}</q>`:''}${a.url?`<a href="${esc(a.url)}" target="_blank" rel="noopener">条文を開く</a>`:''}</div>`).join('')}</div>`:''}
    ${(LAWS.notes||[]).length?`<div class="note">${LAWS.notes.map(esc).join('<br>')}</div>`:''}</div>
   <div class="sec"><div class="sec-h"><h2>地域の条例</h2><select id="lw-pref" aria-label="都道府県で絞り込み"><option value="">すべての都道府県</option>${prefs.map(p=>`<option>${esc(p)}</option>`).join('')}</select></div><div id="lw-list"></div></div></div>`;
  const draw=()=>{const p=$('lw-pref').value;$('lw-list').innerHTML=ORD.filter(o=>!p||o.pref===p).map(o=>`<div class="ordc"><div class="oh"><span class="oj">${esc(o.pref)}${o.city?' '+esc(o.city):''}</span><b>${esc(o.name)}</b>${o.rules&&o.rules.length?(ordVerified(o)?'<span class="pill ok">公式出典で確認</span>':'<span class="pill warn">出典未確認</span>'):'<span class="pill gray">独自の調査義務の規定なし</span>'}</div>
     <div class="om">${o.instrument&&o.instrument!=='条例'?'<b>'+esc(o.instrument)+'</b>　':''}${o.number?esc(o.number):''}${o.lastAmended?'　最終改正：'+esc(o.lastAmended):''}${o.desk?'　窓口：'+esc(o.desk):''}</div>
     ${o.rules&&o.rules.length?`<div class="tblwrap"><table class="gt"><thead><tr><th>条</th><th>契機</th><th>内容・義務</th><th>条文（原文）</th><th>出典</th></tr></thead><tbody>${o.rules.map(r=>`<tr><td class="nw"><b>${esc(r.art)}</b></td><td class="nw">${trig[r.trigger]||'—'}${r.threshold?`<br><small>${Number(r.threshold).toLocaleString()}㎡${r.thresholdBasis?'（'+esc(r.thresholdBasis)+'）':''}</small>`:''}</td><td class="wrapc">${esc(r.heading||'')}${r.summary?`<small>${esc(r.summary)}</small>`:''}${r.duty?`<small>義務：${esc(r.duty)}</small>`:''}</td><td class="wrapc q">${r.quote?esc(r.quote):'—'}</td><td>${r.url?`<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc((()=>{try{return new URL(r.url).hostname;}catch(e){return '出典';}})())}</a>`:'—'}<br>${r.verified&&r.url?'<span class="pill ok">確認</span>':'<span class="pill warn">未確認</span>'}</td></tr>`).join('')}</tbody></table></div>`:''}
     ${(o.notes||[]).length?`<div class="om">${o.notes.map(n=>esc(n.text)).join('／')}</div>`:''}${(o.extraSubstances||[]).length?`<div class="om">法の26物質に加える物質：${o.extraSubstances.map(esc).join('、')}</div>`:''}${o.appliesNote?`<div class="om">${esc(o.appliesNote)}</div>`:''}
     ${(o.pages||[]).length?`<div class="opg">${o.pages.map(pg=>`<a href="${esc(pg.url)}" target="_blank" rel="noopener">${esc(pg.title||pg.what||'公式ページ')}</a>`).join('')}</div>`:''}</div>`).join('')||'<div class="empty">登録がありません。</div>';};
  $('lw-pref').onchange=draw;draw();
}

/* ── 設定 ── */
function viewSettings(v){
  const o=store.get('org')||DEFAULT_ORG;
  v.innerHTML=`<div class="wrap narrow"><div class="pagehead"><div><h1>設定</h1><p>新しく作る報告書に入る調査機関の情報と、資料の読み取りの接続を設定します。</p></div></div>
   <div class="sec"><h2>調査機関</h2><div class="grid2"><div class="f"><label for="s-name">名称</label><input id="s-name" value="${esc(o.name)}"></div><div class="f"><label for="s-no">指定調査機関指定番号</label><input id="s-no" value="${esc(o.no)}"></div><div class="f"><label for="s-addr">所在地</label><input id="s-addr" value="${esc(o.addr)}"></div><div class="f"><label for="s-tel">電話番号</label><input id="s-tel" value="${esc(o.tel)}"></div></div><button class="btn pri" id="s-save" type="button">保存する</button></div>
   <div class="sec"><h2>資料の読み取り（AI）</h2><p class="st" id="s-ai"></p>
    <div class="grid2"><div class="f"><label for="s-key">Claude APIキー（試用向け。この端末のブラウザにだけ保存します）</label><input id="s-key" type="password" autocomplete="off" placeholder="sk-ant-…" value="${esc(store.get('apiKey')||'')}"></div><div class="f"><label for="s-model">モデル</label><select id="s-model"><option>claude-opus-5-5</option><option>claude-sonnet-5-5</option></select></div></div>
    <button class="btn" id="s-keysave" type="button">接続を保存する</button><p class="note">本番運用では、APIキーをサーバー側（同梱の netlify/functions/claude.mjs）に置く構成にします。その場合この欄は不要で、利用者の操作は増えません。</p></div>
   <div class="sec"><h2>データ</h2><p class="note" style="margin-top:0">案件はこの端末のブラウザに保存しています。</p><button class="btn" id="s-reset" type="button">サンプル案件を初期状態に戻す</button> <button class="btn" id="s-out" type="button">ログアウト</button></div></div>`;
  const st=()=>{$('s-ai').innerHTML=AI.mode==='proxy'?'<span class="pill ok">接続済み</span> サーバー経由（APIキーはサーバー側）':AI.mode==='key'?'<span class="pill ok">接続済み</span> 登録済みAPIキーで読み取ります':'<span class="pill warn">未接続</span> 資料の読み取りは行わず、章立て・法令判定・サンプルの表示のみ動きます。';};st();
  $('s-model').value=store.get('model')||'claude-opus-5-5';
  $('s-save').onclick=()=>{store.set('org',{name:$('s-name').value,no:$('s-no').value,addr:$('s-addr').value,tel:$('s-tel').value});toast('調査機関の情報を保存しました');};
  $('s-keysave').onclick=async()=>{const k=$('s-key').value.trim();if(k)store.set('apiKey',k);else store.del('apiKey');store.set('model',$('s-model').value);await aiDetect();st();toast(AI.mode==='none'?'接続を解除しました':'接続を保存しました');};
  $('s-reset').onclick=()=>{const mine=ST.cases.filter(c=>!c.sample);ST.cases=clone(SAMPLES).map(normalize).concat(mine);saveCases();toast('サンプル案件を初期状態に戻しました');};
  $('s-out').onclick=()=>{store.del('user');ST.user=null;go('login');};
}

/* ── 起動 ── */
document.querySelectorAll('#top .nav button').forEach(b=>b.onclick=()=>go(b.dataset.r));
$('logo').onclick=()=>go('cases');
if(ST.user){loadCases();ST.route='cases';aiDetect().then(()=>{if(ST.route==='new')render();});}
render();
