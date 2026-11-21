/* ══════════ デモ ══════════
   ①「入力例を入れる」：新規作成の画面に、対象地・要望・資料をまとめて入れる
   ②「デモを再生する」：ログインからレポート出力の手前までを、入力なしで自動で進める
   デモ用の資料は、川崎市川崎区貝塚一丁目の既往報告書を資料の種類ごとに分けたもの。
   AIの読み取り結果に当たる部分は記録済みのデータを使い、結合〜判定〜所見〜描画は本番と同じ処理を通す。 */
const DEMO_INPUT={addr:'神奈川県川崎市川崎区貝塚一丁目',chiban:'3番9',area:'121.86',purpose:'sale',changeArea:'',
  note:'建物を解体して更地にした土地。昭和30年代からオートバイ店だったと聞いている。購入者への説明資料として使いたい。',
  period:'令和6年12月23日～令和7年1月31日',lat:35.525227,lng:139.702011};
function demoFiles(){
  const s=SAMPLES.find(x=>x.id==='s-kawasaki');const photo=x=>/空中写真/.test(x.src);
  const F=(name,mb,part)=>({name,size:mb*1048576,demo:true,part});
  return [
   F('登記簿謄本_貝塚一丁目3番9（土地・建物・閉鎖）.pdf',6.8,{kind:'登記簿謄本',site:{parcels:clone(s.site.parcels)},land:s.land.map(l=>({chiban:l.chiban,chimoku:l.chimoku,p:2,rows:clone(l.rows)})),lineage:clone(s.lineage),buildings:s.buildings.map(b=>({kaoku:b.kaoku,kind:b.kind,structure:b.structure,rows:clone(b.rows),p:9}))}),
   F('法人登記_株式会社中島モーターサイクル（閉鎖）.pdf',0.4,{kind:'法人登記簿',corps:s.corps.map(c=>({name:c.name,addr:c.addr,est:c.est,purpose:clone(c.purpose),closed:c.closed,p:1}))}),
   F('公図_貝塚一丁目.pdf',0.3,{kind:'公図'}),
   F('住宅地図・地形図_1881-2024.pdf',9.2,{kind:'地形図・住宅地図',maps:s.maps.filter(x=>!photo(x)).map((x,i)=>({...x,p:i+1}))}),
   F('空中写真_1946-2019.pdf',7.5,{kind:'空中写真',maps:s.maps.filter(photo).map((x,i)=>({...x,p:i+1}))}),
   F('聴取記録_中嶋様_20250124.pdf',0.2,{kind:'ヒアリング記録',hearing:s.hearing.map(h=>({date:h.date,by:h.by,target:h.target,text:h.text,p:1}))}),
   F('現地踏査写真_20241223.pdf',5.1,{kind:'現地踏査写真',siteVisit:{date:s.siteVisit.date,by:s.siteVisit.by,text:s.siteVisit.text,p:1}}),
   F('行政回答_川崎市環境局_20241226.pdf',0.2,{kind:'行政回答',regs:{suidaku:clone(s.regs.suidaku),gesui:clone(s.regs.gesui),zoneSrc:s.regs.zoneSrc,art6:s.regs.art6,art11jin:s.regs.art11jin,art11shizen:s.regs.art11shizen,art11umetate:s.regs.art11umetate,haiki:s.regs.haiki,ord:clone(s.regs.ord),natural:s.regs.natural,p:1}}),
   F('調査メモ_地形・地質・地下水.pdf',0.1,{kind:'その他',site:{geoText:s.site.geoText,gwText:s.site.gwText,gwDir:s.site.gwDir,landform:s.site.landform}}),
  ];
}

const DEMO={on:false,abort:false,done:false};
function demoSleep(ms){return new Promise((res,rej)=>setTimeout(()=>DEMO.abort?rej(new Error('demo-stop')):res(),ms));}
async function demoUntil(fn,ms){const t0=Date.now();while(!fn()){if(Date.now()-t0>ms)return false;await demoSleep(150);}return true;}
function demoSpot(el,scroll){document.querySelectorAll('.demo-spot').forEach(e=>e.classList.remove('demo-spot'));if(el){el.classList.add('demo-spot');if(scroll!==false)el.scrollIntoView({behavior:'smooth',block:'center'});}}
function demoSay(step,total,text){$('demobar').hidden=false;document.body.classList.add('demo-on');$('demo-step').textContent=`${step} / ${total}`;$('demo-cap').textContent=text;}
async function demoType(el,text,ms){el.focus();el.value='';for(let i=1;i<=text.length;i++){el.value=text.slice(0,i);el.dispatchEvent(new Event('input',{bubbles:true}));await demoSleep(ms||34);}el.value=text;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
function demoEnd(msg){DEMO.on=false;demoSpot(null);if(msg){$('demo-step').textContent='完了';$('demo-cap').textContent=msg;$('demo-stop').textContent='閉じる';DEMO.done=true;}else{$('demobar').hidden=true;document.body.classList.remove('demo-on');}}
async function runDemo(){
  if(DEMO.on)return;DEMO.on=true;DEMO.abort=false;DEMO.done=false;$('demo-stop').textContent='停止';
  const N=9;const D=DEMO_INPUT;
  try{
    /* 1 ログイン */
    if(!ST.user){if(ST.route!=='login')go('login');
      demoSay(1,N,'ログイン画面です。メールアドレスとパスワードで入ります。');
      await demoSleep(1400);demoSpot($('l-mail'),false);await demoType($('l-mail'),'demo@chirekikun.example',55);demoSpot($('l-pass'),false);await demoType($('l-pass'),'demo-pass',90);await demoSleep(500);
      demoSpot($('lf').querySelector('button[type=submit]'),false);await demoSleep(1100);$('lf').requestSubmit();
      await demoUntil(()=>ST.route==='cases',5000);}
    else go('cases');
    /* 2 案件一覧 */
    demoSay(2,N,'案件の一覧です。自治体ごとの条例、所見、人の確認が要る件数が並びます。新しい調査を始めます。');
    await demoSleep(2200);demoSpot($('b-new'));await demoSleep(1100);$('b-new').click();await demoSleep(500);
    /* 3 対象地 */
    demoSay(3,N,'① 対象地を入れます。住所を入れた時点で、その地域で照合する条例が自動で選ばれます。');
    demoSpot($('n-addr'));await demoType($('n-addr'),D.addr,55);await demoSleep(500);demoSpot($('n-juris'),false);await demoSleep(1800);
    await demoType($('n-chiban'),D.chiban,90);await demoType($('n-area'),D.area,70);
    demoSay(3,N,'位置を確認します。地図のピンを動かすと、番地の位置まで合わせられます。');
    demoSpot($('n-geo'),false);await demoSleep(700);$('n-geo').click();
    if(!await demoUntil(()=>!$('n-mapwrap').hidden,4000)&&ST.newApi)ST.newApi.showMap(D.lat,D.lng);
    demoSpot($('n-map'));await demoSleep(2600);
    /* 4 目的と条件 */
    demoSay(4,N,'② 目的を選び、要望や気になる点は自由に書きます。');
    const pc=document.querySelector('.pcard input[value="'+D.purpose+'"]');demoSpot(pc.closest('.pcard'));pc.click();await demoSleep(900);
    demoSpot($('n-note'));await demoType($('n-note'),D.note,22);await demoType($('n-period'),D.period,22);await demoSleep(500);
    /* 5 資料 */
    demoSay(5,N,'③ 手元の資料をまとめて入れます。登記簿・地図・聴取記録などの種類は自動で判別します。');
    demoSpot($('n-drop'));await demoSleep(1000);
    for(const f of demoFiles()){ST.newApi.addFiles([f]);await demoSleep(380);}
    demoSpot($('n-files'));await demoSleep(1600);
    /* 6 作成 */
    demoSay(6,N,'あとは「レポートを作成する」を押すだけです。');
    demoSpot($('n-run'));await demoSleep(1300);demoSpot(null);$('n-run').click();
    demoSay(6,N,'資料を1点ずつ読み取り、地番ごとの履歴、法令・条例の照合、所見の下書きまでを組み立てます。（デモでは、読み取り結果に記録済みのデータを使っています）');
    if(!await demoUntil(()=>ST.route==='case',60000))throw new Error('レポートの作成が終わりませんでした');
    /* 7 レポート */
    const sec=async(id,text,ms)=>{demoSay(7,N,text);const el=document.getElementById(id);if(el){el.scrollIntoView({behavior:'smooth',block:'start'});demoSpot(el,false);}await demoSleep(ms||3600);};
    demoSay(7,N,'レポートができました。表紙・目次から、既往の報告書と同じ体裁・章立てです。本文はその場で直せます。');await demoSleep(3200);
    await sec('sec-11','1.1 調査件名、特定施設・指定区域の有無、筆の一覧です。ページ下の番号と脚注も原本の形です。',4000);
    await sec('sec-22','2.2 登記簿から、地番ごとの履歴表と地番の変遷図を作ります。小さな札が、根拠の資料とページです。',4600);
    await sec('sec-23','2.3 地形図・住宅地図・空中写真の利用履歴を年次順に並べます。',3200);
    await sec('sec-3','3 所見です。オートバイ・自動車の修理の履歴から「否定できない」と判定しました。',3800);
    await sec('sec-4','4 対象物質の選定と指定基準の表、続く5・6章まで出します。',3800);
    await sec('sec-app1','付録 何条に当たる調査かを、土壌汚染対策法と川崎市条例で判定しています。原本にない部分は付録に分けました。',4200);
    /* 8 確認・判断・出典 */
    const tab=async(t,text,ms)=>{demoSay(8,N,text);const b=document.querySelector('.tabs2 button[data-t="'+t+'"]');b.click();demoSpot(document.querySelector('.ws-side'),false);await demoSleep(ms||3400);};
    await tab('review','人が見るのは右の「確認」だけです。判読が怪しい箇所、資料どうしの食い違い、未記入だけが出ます。',4200);
    await tab('judge','「判断」で懸念の扱い・対象物質・筆ごとの区分を切り替えると、所見と4〜6章を組み直します。',4000);
    await tab('src','「出典」には、公式サイトで確認した法令・条例だけを、URLと確認日つきで並べます。',3800);
    await tab('review','',300);
    /* 9 出力 */
    window.scrollTo({top:0,behavior:'smooth'});demoSpot(document.querySelector('.wa'),false);
    demoSay(9,N,'「PDFで出力」「Wordで保存」で、提出用の形にできます。');await demoSleep(3200);
    demoEnd('デモは以上です。このレポートはそのまま触れます。もう一度見るときは、案件一覧の「デモを再生する」から。');
  }catch(e){if(e.message==='demo-stop')demoEnd();else{demoEnd('デモを中断しました：'+e.message);}}
}
