/* ══════════ レポート描画（エコ・テック様 地歴調査報告書の章立て） ══════════ */
const CIRC='①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
function docOf(c,id){return (c.docs||[]).find(d=>d.id===id);}
/* 根拠チップ：どの資料の何ページか */
function ev(c,ref,ids){
  const parts=[];const clsLabel=d=>(d.cls==='私的資料'?'添付(私的)':d.cls==='公的資料'?'添付(公的)':'添付(一般)')+String(d.id).replace(/^[PKX]/,'');
  if(ref&&ref.p){const d=ref.doc&&ref.doc!=='R'?docOf(c,ref.doc):null;
    parts.push(`<span class="ev${d?' att':''}" data-p="${ref.p}" data-doc="${d?esc(d.id):''}" title="${esc(d?(d.name||d.kind):(c.source?c.source.file:''))}">${d?clsLabel(d)+' '+esc(d.kind):(c.source?'原本':'資料')} p.${ref.p}</span>`);}
  /* 添付資料：原本PDFの中のページ範囲が分かっていれば原本を、別ファイルで共有された資料はその資料を開く */
  (ids||[]).forEach(id=>{const d=docOf(c,id);if(d)parts.push(`<span class="ev att" data-p="${String(d.pages||'').split('–')[0]||1}" data-doc="${d.pages?'':esc(d.id)}" title="${esc(d.name||'')}">${clsLabel(d)} ${esc(d.kind)}${d.pages?' p.'+d.pages:''}</span>`);});
  return parts.length?`<span class="evs" contenteditable="false">${parts.join('')}</span>`:'';
}
const evK=(c,ref,re)=>ev(c,ref,(c.docs||[]).filter(d=>d.cls!=='本文'&&re.test(d.kind)&&!(ref&&ref.doc===d.id)).map(d=>d.id));
const E=(path,html,tag)=>`<${tag||'span'} data-path="${path}" contenteditable="true" spellcheck="false">${html}</${tag||'span'}>`;
const P=(path,text)=>`<p data-path="${path}" contenteditable="true" spellcheck="false">${esc(text||'').replace(/\n/g,'<br>')}</p>`;

/* 地理院タイルを3×3枚並べ、対象地を中央に置いた図。印刷・PDFでもそのまま出る */
const DIRV={'北':[0,-1],'北東':[1,-1],'東':[1,0],'南東':[1,1],'南':[0,1],'南西':[-1,1],'西':[-1,0],'北西':[-1,-1]};
function tileFig(lat,lng,layer,ext,z,opt){
  if(!lat||!lng)return '';opt=opt||{};
  const n=Math.pow(2,z),x=(lng+180)/360*n,rad=lat*Math.PI/180,y=(1-Math.asinh(Math.tan(rad))/Math.PI)/2*n;
  const tx=Math.floor(x),ty=Math.floor(y),mx=512+(x-tx)*256,my=256+(y-ty)*256,W=600,H=380;
  let imgs='';for(let j=-1;j<=1;j++)for(let i=-2;i<=2;i++)imgs+=`<img alt="" src="https://cyberjapandata.gsi.go.jp/xyz/${layer}/${z}/${tx+i}/${ty+j}.${ext}" style="position:absolute;left:${(i+2)*256}px;top:${(j+1)*256}px;width:256px;height:256px;max-width:none">`;
  const d=DIRV[opt.dir];const k=d?1/Math.hypot(d[0],d[1]):0;const ax=d?d[0]*k:0,ay=d?d[1]*k:0;
  const arrow=d?`<line x1="${W/2+ax*26}" y1="${H/2+ay*26}" x2="${W/2+ax*104}" y2="${H/2+ay*104}" stroke="#1f6fd6" stroke-width="7"/><polygon points="${W/2+ax*128},${H/2+ay*128} ${W/2+ax*100-ay*13},${H/2+ay*100+ax*13} ${W/2+ax*100+ay*13},${H/2+ay*100-ax*13}" fill="#1f6fd6"/><rect x="${W/2+ax*150-42}" y="${H/2+ay*150-11}" width="84" height="22" fill="#fff" stroke="#1f6fd6"/><text x="${W/2+ax*150}" y="${H/2+ay*150+4.5}" text-anchor="middle" font-size="12" font-weight="700" fill="#1f6fd6">地下水流向</text>`:'';
  return `<div class="tfig" contenteditable="false"><div class="tview" style="width:${W}px;height:${H}px"><div style="position:absolute;left:${W/2-mx}px;top:${H/2-my}px;width:1280px;height:768px">${imgs}</div>
   <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="position:absolute;left:0;top:0">${arrow}<circle cx="${W/2}" cy="${H/2}" r="${opt.r||15}" fill="none" stroke="#e02020" stroke-width="3"/><rect x="${W/2-118}" y="${H/2-52}" width="86" height="22" fill="#fff" stroke="#e02020"/><text x="${W/2-75}" y="${H/2-36.5}" text-anchor="middle" font-size="12" font-weight="700" fill="#e02020">調査対象地</text><line x1="${W/2-40}" y1="${H/2-30}" x2="${W/2-11}" y2="${H/2-10}" stroke="#e02020" stroke-width="1.5"/></svg></div></div>`;
}
function tocOf(c){
  const neg=c.verdict&&c.verdict.level==='否定できない';
  const t=[['sec-1','１．調査概要',0],['sec-11','1.1 調査件名',1],['sec-12','1.2 調査目的',1],['sec-13','1.3 敷地面積',1],['sec-14','1.4 関連法規',1],['sec-15','1.5 調査期間',1],['sec-16','1.6 調査機関',1],['sec-17','1.7 調査場所',1],
   ['sec-2','２．履歴調査',0],['sec-21','2.1 地形・地質及び地下水概要',1],['sec-22','2.2 登記簿謄本による履歴調査',1],['sec-23','2.3 地形図・住宅地図・空中写真による履歴調査',1],['sec-24','2.4 ヒアリング調査及び現地踏査',1],['sec-243','2.4.3 公的機関の環境情報',2],
   ['sec-3','３．結果まとめ',0]];
  if(neg)t.push(['sec-4','４．試料採取等対象物質の選定',0],['sec-5','５．汚染のおそれの由来に応じた区分',0],['sec-6','６．土壌汚染のおそれの区分の分類',0]);
  t.push(['sec-att','添付資料',0],['sec-src','出典一覧',0]);return t;
}

function landTable(c){
  return (c.land||[]).map((l,li)=>{const n=l.rows.length;
    return `<table class="reg"><thead><tr><th>現状地番</th><th>地目</th><th>地積</th><th>登記年月日</th><th>原因</th><th>登記名義人等の変更等</th></tr></thead><tbody>`+
    l.rows.map((r,ri)=>`<tr${r.unclear?' class="unc"':''}>${ri===0?`<td rowspan="${n}" class="cb">${esc(l.chiban).replace(/ /,'<br>').replace(/ → /,'<br>→ ')}${l.note?'<br><small>※'+esc(l.note)+'</small>':''}</td><td rowspan="${n}" class="c">${esc(l.chimoku||'')}</td>`:''}
      <td class="r">${E(`land.${li}.rows.${ri}.chiseki`,esc(r.chiseki||''))}</td><td class="nw">${E(`land.${li}.rows.${ri}.date`,esc(r.date))}</td><td>${E(`land.${li}.rows.${ri}.cause`,esc(r.cause))}</td>
      <td>${r.unclear?'※':''}${E(`land.${li}.rows.${ri}.holder`,esc(r.holder))}${r.unclear?'（不明瞭）':''}</td></tr>`).join('')+`</tbody></table>`;}).join('');
}
function lineageSvg(c){
  const ev=c.lineage||[];if(!ev.length)return '';
  const target=new Set((c.site.parcels||[]).map(p=>p.chiban));
  const rowH=30,bw=62,gap=8,padL=6;let y=8;const rows=ev.map(e=>{const h=Math.max(e.from.length,Math.ceil(e.to.length/4))*rowH;const r={e,y,h};y+=h+10;return r;});
  const W=720,H=y+4;const midX=250;
  const box=(x,yy,t)=>`<rect x="${x}" y="${yy}" width="${bw}" height="20" rx="2" fill="${target.has(t)?'#ffe94d':'#fff'}" stroke="#333" stroke-width="1"/><text x="${x+bw/2}" y="${yy+14}" text-anchor="middle" font-size="10" fill="#111">${esc(t)}</text>`;
  let s=`<svg viewBox="0 0 ${W} ${H}" class="lineage" role="img" aria-label="地番の変遷">`;
  rows.forEach(({e,y,h})=>{
    e.from.forEach((f,i)=>{s+=box(padL+ (i%3)*(bw+gap),y+Math.floor(i/3)*rowH,f);});
    const cy=y+10;s+=`<line x1="${padL+Math.min(e.from.length,3)*(bw+gap)}" y1="${cy}" x2="${midX+150}" y2="${cy}" stroke="#333" stroke-width="1"/><polygon points="${midX+150},${cy-4} ${midX+158},${cy} ${midX+150},${cy+4}" fill="#333"/>`;
    s+=`<rect x="${midX-18}" y="${cy-9}" width="150" height="18" fill="${e.type==='分筆'?'#c8eccf':e.type==='合筆'?'#cfe0f5':'#f3c9ee'}"/><text x="${midX+57}" y="${cy+4}" text-anchor="middle" font-size="10" fill="#111">${esc(e.date)} ${esc(e.type)}</text>`;
    e.to.forEach((t,i)=>{s+=box(midX+166+(i%4)*(bw+gap),y+Math.floor(i/4)*rowH,t);});
  });
  return s+'</svg><p class="cap">黄色＝調査対象地の筆。登記簿謄本の分筆・合筆・換地の記録から作図。</p>';
}
function bldTable(c){
  if(!(c.buildings||[]).length)return '';
  return `<h4>【建物】</h4><table class="reg"><thead><tr><th>家屋番号</th><th>種類</th><th>構造</th><th>登記年月日</th><th>原因</th><th>登記名義人等の変更等</th></tr></thead><tbody>`+
   c.buildings.map((b,bi)=>b.rows.map((r,ri)=>`<tr>${ri===0?`<td rowspan="${b.rows.length}" class="cb">${esc(b.kaoku)}${b.note?'<br><small>※'+esc(b.note)+'</small>':''}</td><td rowspan="${b.rows.length}" class="c">${esc(b.kind)}</td><td rowspan="${b.rows.length}">${esc(b.structure)}</td>`:''}<td class="nw">${E(`buildings.${bi}.rows.${ri}.date`,esc(r.date))}</td><td class="cz">${E(`buildings.${bi}.rows.${ri}.cause`,esc(r.cause))}</td><td>${E(`buildings.${bi}.rows.${ri}.holder`,esc(r.holder))}</td></tr>`).join('')).join('')+`</tbody></table>`;
}
function corpBlock(c){
  const cs=c.corps||[];if(!cs.length)return '';
  return `<h4>【法人】</h4><p>対象地と関連する法人が${cs.length}社発見された。以下、その法人について登記簿謄本からの調査結果を示す。</p>`+
   cs.map((x,i)=>`<div class="corp"><p class="ch">${CIRC[i]||i+1} ${esc(x.name)}${x.got?' 法人登記簿（一部抜粋）':'（法人登記の謄本を取得できず）'} ${ev(c,x.ref)}</p>`+
    (x.purpose?`<table class="kv"><tr><th>商号</th><td>${esc(x.name)}</td></tr>${x.addr?`<tr><th>本店</th><td>${esc(x.addr)}</td></tr>`:''}${x.est?`<tr><th>会社成立の年月日</th><td>${esc(x.est)}</td></tr>`:''}<tr><th>目的</th><td>${x.purpose.map((p,j)=>`${j+1}．${esc(p)}`).join('<br>')}</td></tr>${x.closed?`<tr><th>解散等</th><td>${esc(x.closed)}</td></tr>`:''}</table>`:'')+
    P(`corps.${i}.comment`,x.comment)+`</div>`).join('');
}
function stdTable(c){
  const sel=new Set(c.substances||[]);let prev=0;
  return `<table class="std"><thead><tr><th>分類</th><th>調査対象<br>物質</th><th>特定有害物質の種類</th><th>土壌溶出量基準<br>(mg/L)</th><th>土壌含有量基準<br>(mg/kg)</th><th>地下水基準<br>(mg/L)</th><th>第二溶出量基準<br>(mg/L)</th></tr></thead><tbody>`+
   SUB.map(s=>{const first=s.k!==prev;prev=s.k;const n=SUB.filter(x=>x.k===s.k).length;return `<tr class="${sel.has(s.id)?'sel':''}">${first?`<td rowspan="${n}" class="vk">${KIND[s.k]}</td>`:''}<td class="c">${sel.has(s.id)?'○':''}</td><td>${s.name}</td><td class="c">${s.sol}</td><td class="c">${s.con||''}</td><td class="c">${s.gw}</td><td class="c">${s.sol2}</td></tr>`;}).join('')+
   `</tbody></table><p class="cap">※「検出されないこと」とは、定められた測定方法により測定した場合において、その結果が当該方法の定量下限値を下回ることをいう。</p>`;
}
function subNames(c,k){return (c.substances||[]).map(id=>SUBBY[id]).filter(s=>s&&s.k===k).map(s=>s.name);}

function renderReport(c){
  const s=c.site,g=c.regs||{},v=c.verdict||verdictOf(c),neg=v.level==='否定できない';
  const ords=ordFor(s.pref,s.city);const S=sourcesOf(c);const J=judge(c);
  const fn=t=>{const x=S.find(q=>q.title===t);return x?`<sup class="fn" contenteditable="false">[${x.n}]</sup>`:'';};
  const addr=`${s.pref}${s.city}${s.town}`;const chibans=(s.parcels||[]).map(p=>p.chiban).join('、');
  const maps=c.maps||[];const h=c.hearing||[];
  const lawsHtml=LAWS.items.map(l=>`<div class="law">・${esc(l.name)}${fn(l.name)}<br><span>（${esc(l.number)}）${l.lastAmended?'（改正：'+esc(l.lastAmended)+'）':''}</span></div>`).join('')+
    ords.filter(o=>o.rules&&o.rules.length).map(o=>`<div class="law">・${esc(o.name)}${fn(o.name)}<br><span>${(o.numberShort||o.number)?'（'+esc(o.numberShort||o.number)+'）':''}${(o.lastAmendedShort||o.lastAmended)?'（改正：'+esc(o.lastAmendedShort||o.lastAmended)+'）':''}</span></div>`).join('');
  const stLabel={yes:'該当',maybe:'要確認',no:'非該当',info:'参考',done:'確認済',todo:'未確認'};
  let html=`
  <section class="cover" id="sec-cover"><div class="ct">${esc(c.title)}　地歴調査</div><div class="ct2">報告書</div><div class="cd">${E('reportDate',esc(c.reportDate||toWareki(new Date())))}</div><div class="co">${esc(c.org.name)}</div></section>
  <section class="toc"><h2 class="tc">目　次</h2>${tocOf(c).map(t=>`<a href="#${t[0]}" class="l${t[2]}" data-go="${t[0]}"><span>${t[1]}</span></a>`).join('')}
   <table class="att"><thead><tr><th>一般公表資料</th><th>公的資料</th><th>私的資料</th></tr></thead><tbody>${Array.from({length:Math.max(4,...['一般公表資料','公的資料','私的資料'].map(k=>(c.docs||[]).filter(d=>d.cls===k).length))},(_,i)=>i).map(i=>{const gen=(c.docs||[]).filter(d=>d.cls==='一般公表資料')[i],pub=(c.docs||[]).filter(d=>d.cls==='公的資料')[i],pri=(c.docs||[]).filter(d=>d.cls==='私的資料')[i];return `<tr><td>${gen?'ABCDEFGHIJ'[i]+'）'+esc(gen.kind):'―'}</td><td>${pub?'ABCDEFGHIJ'[i]+'）'+esc(pub.kind):'―'}</td><td>${pri?'ABCDEFGHIJ'[i]+'）'+esc(pri.kind):'―'}</td></tr>`;}).join('')}</tbody></table></section>

  <h2 id="sec-1">１．調査概要</h2>
  <h3 id="sec-11">1.1 調査件名 ${ev(c,c.source&&c.source.overviewP?{p:c.source.overviewP}:null)}</h3><p>${esc(c.title)}　地歴調査</p>
  <table class="kv">${s.jusho?`<tr><th>住居表示</th><td colspan="2">${E('site.jusho',esc(s.jusho))}</td></tr>`:''}<tr><th>地番表示</th><td colspan="2">${E('site.chibanLabel',esc(s.chibanLabel))}</td></tr>
   <tr><th rowspan="2">特定施設の有無</th><td>水質汚濁防止法に基づく有害物質使用の特定施設</td><td class="c">${esc((g.suidaku&&g.suidaku.v)||'未確認')}</td></tr><tr><td>下水道法に基づく有害物質使用の特定施設</td><td class="c">${esc((g.gesui&&g.gesui.v)||'未確認')}</td></tr>
   <tr><th rowspan="${4+(g.ord||[]).length}">指定区域の有無</th><td>調査対象地・周辺地等の土壌汚染対策法に基づく「人為等由来」の指定区域</td><td class="c">${esc(g.art11jin||'未確認')}</td></tr>
   <tr><td>調査対象地・周辺地等の土壌汚染対策法に基づく「自然由来」の指定区域</td><td class="c">${esc(g.art11shizen||'未確認')}</td></tr><tr><td>調査対象地・周辺地等の土壌汚染対策法に基づく「水面埋立て土砂由来」の指定区域</td><td class="c">${esc(g.art11umetate||'未確認')}</td></tr>
   <tr><td>調査対象地の廃棄物の処理及び清掃に関する法律の指定区域</td><td class="c">${esc(g.haiki||'未確認')}</td></tr>${(g.ord||[]).map(o=>`<tr><td>${esc(o.name)}に基づく${esc(o.item.replace(/^条例に基づく/,''))}</td><td class="c">${esc(o.v)}</td></tr>`).join('')}</table>
  <table class="reg"><caption>＜調査対象地の筆及び一覧表＞</caption><thead><tr><th></th><th>所在</th><th>地番</th><th>地目</th><th>地積</th><th>所有者</th></tr></thead><tbody>${(s.parcels||[]).map((p,i)=>`<tr><td class="c">${i+1}</td><td>${E(`site.parcels.${i}.shozai`,esc(p.shozai))}</td><td>${E(`site.parcels.${i}.chiban`,esc(p.chiban))}</td><td class="c">${esc(p.chimoku)}</td><td class="r">${fmtArea(p.chiseki)} ㎡</td><td>${E(`site.parcels.${i}.owner`,esc(p.owner))}</td></tr>`).join('')}<tr><td colspan="4" class="r">合計</td><td class="r">${fmtArea(s.area)} ㎡</td><td></td></tr></tbody></table>
  <h3 id="sec-12">1.2 調査目的</h3><p>本調査は、${esc(addr)}${chibans&&(s.parcels||[]).length===1?' '+esc(chibans):''}地内（以下「調査対象地」と称す）における土壌汚染のおそれの可能性について判断することを目的とした。</p>
  <div class="pos" contenteditable="false"><b>調査の位置づけ（適用条項の判定）</b><p>${esc(positionText(c))}</p>
   <table class="jt"><thead><tr><th>根拠</th><th>条項</th><th>内容</th><th>判定</th><th>判定の理由</th></tr></thead><tbody>${J.map(r=>`<tr class="j-${r.st[0]}"><td class="c">${r.src}</td><td>${esc(r.law.replace(/（.*?）/g,''))} ${esc(r.art)}${r.cite&&r.cite.verified?'':'<span class="unv">出典未確認</span>'}</td><td>${esc(r.title)}</td><td class="c"><b>${esc(r.st[1])}</b></td><td>${esc(r.why)}</td></tr>`).join('')}</tbody></table>${ords.filter(o=>(o.extraSubstances||[]).length).map(o=>`<p>※ ${esc(o.name.replace(/（.*?）/g,''))}は、法の特定有害物質26物質に加えて「${esc(o.extraSubstances.map(x=>x.replace(/（.*$/,'')).join('、'))}」を対象とする。</p>`).join('')}${ords.filter(o=>o.appliesNote&&o.rules.length).slice(0,1).map(o=>`<p class="cap">窓口：${esc((o.desk||'').slice(0,90))}</p>`).join('')}</div>
  <h3 id="sec-13">1.3 敷地面積</h3><p>${fmtArea(s.area)} ㎡（${E('site.areaNote',esc(s.areaNote||'公簿面積による推定'))}）</p>
  <h3 id="sec-14">1.4 関連法規 ${ev(c,c.source&&c.source.lawsP?{p:c.source.lawsP}:null)}</h3>${lawsHtml}
  <h3 id="sec-15">1.5 調査期間</h3><p>${E('period',esc(c.period||'（調査期間）'))}</p>
  <h3 id="sec-16">1.6 調査機関</h3><p>${esc(c.org.name)}（指定調査機関指定番号【 ${esc(c.org.no)} 】）<br>所 在 地：${esc(c.org.addr)}<br>電話番号：${esc(c.org.tel)}</p>
  <h3 id="sec-17">1.7 調査場所</h3><p>${esc(s.pref)}${esc(s.city)}${esc(s.town)} ${esc(chibans)}（地番表示）</p>
  ${s.lat?tileFig(s.lat,s.lng,'std','png',18)+`<p class="cap fc">図 1.7-1 調査対象地位置図${s.pinned?'':'（町丁目の概略位置。番地への位置合わせは未確定）'}　出典：地理院地図(電子国土web)${fn('治水地形分類図・地理院タイル')}</p>`:''}
  <div class="fig" contenteditable="false"><div class="figbox">図 1.7-2 調査対象地地番図<br><small>添付資料(一般B)「公図」から作成して差し込み。</small></div></div>

  <h2 id="sec-2">２．履歴調査</h2>
  <h3 id="sec-21">2.1 地形・地質及び地下水概要 ${ev(c,s.ref)}</h3>
  <h4>2.1.1 地形・地質概要</h4>${P('site.geoText',s.geoText||'（地形・地質の概要を記入。位置を確定すると治水地形分類図の区分を参照できます）')}
  <h4>2.1.2 地下水概要</h4>${P('site.gwText',s.gwText||'（地下水流向の推定を記入）')}
  ${s.lat?tileFig(s.lat,s.lng,'lcmfc2','png',16,{dir:s.gwDir,r:11}):''}
  <p class="cap fc">図 2.1 地形地質概要及び推定地下水流向${s.gwDir?'（推定流向：'+esc(s.gwDir)+'向き）':''}　国土交通省国土地理院 電子国土web（治水地形分類図）より引用し、編集・加工のうえ掲載。${fn('治水地形分類図・地理院タイル')}</p>

  <h3 id="sec-22">2.2 登記簿謄本による履歴調査 ${evK(c,(c.land&&c.land[0]&&c.land[0].ref)||null,/登記|公図/)}</h3>
  <p>対象地について、現状の登記簿謄本から旧土地台帳までの遡及調査を行った調査結果の要約を「登記簿謄本による対象地の履歴」に示す。</p>
  <h4>【土地】登記簿謄本による調査対象地の地歴</h4>${landTable(c)||'<p class="todo">登記簿謄本を共有すると、地番ごとの履歴表をここに作成します。</p>'}
  ${(c.lineage||[]).length?'<h4>〈参考〉地番の変遷</h4>'+lineageSvg(c):''}
  ${bldTable(c)}${corpBlock(c)}

  <h3 id="sec-23">2.3 地形図・住宅地図・空中写真による履歴調査 ${evK(c,c.mapsRef,/地図|地形図|空中写真/)}</h3>
  <p>地形図・住宅地図・空中写真によって、${maps.length?esc(maps[0].w):'―'}まで遡及した調査の結果を「地形図・住宅地図・空中写真による調査対象地の利用履歴」に示す。</p>
  ${maps.length?`<table class="reg mapt"><caption>地形図・住宅地図・空中写真による対象地の利用履歴</caption><thead><tr><th>地図年次</th><th>対象地用途</th><th>周辺地の土地利用</th><th>根拠資料</th></tr></thead><tbody>${maps.map((m,i)=>`<tr><td class="nw yr">${m.y}年（${esc(m.w)}）</td><td class="c">${E(`maps.${i}.use`,esc(m.use))}</td><td class="c">${E(`maps.${i}.around`,esc(m.around))}</td><td class="c">${esc(m.src)}</td></tr>`).join('')}</tbody></table>`:'<p class="todo">住宅地図・地形図・空中写真を共有すると、年次ごとの利用履歴表をここに作成します。</p>'}
  ${(c.mapNotes||[]).map((n,i)=>`<div class="num"><span>${i+1}）</span>${P('mapNotes.'+i,n)}</div>`).join('')}

  <h3 id="sec-24">2.4 ヒアリング調査及び現地踏査 ${evK(c,(h[0]&&h[0].ref)||null,/踏査|聴取|ヒアリング/)}</h3>
  <h4>2.4.1 ヒアリング調査</h4><p>【土地の主な利用履歴確認】</p>
  ${h.length?h.map((x,i)=>`<div class="hear"><p>実施日：${esc(x.date)}<br>実施者：${esc(x.by)}${x.target?'<br>聴取先：'+esc(x.target):''}</p>${P(`hearing.${i}.text`,x.text)}</div>`).join(''):'<p class="todo">ヒアリングの記録（メモ・聴取調査票）を共有すると、ここに整理します。</p>'}
  <h4>2.4.2 現地踏査</h4><p>【踏査による土地使用状況確認】</p>
  ${c.siteVisit?`<p>実施日：${esc(c.siteVisit.date)}<br>実施者：${esc(c.siteVisit.by)}</p>${P('siteVisit.text',c.siteVisit.text)}`:'<p class="todo">現地踏査の記録を共有すると、ここに整理します。</p>'}
  <h4 id="sec-243">2.4.3 公的機関の環境情報 ${ev(c,g.ref)}</h4>
  <p>（1）調査対象地上の法・条例に基づく特定施設の有無</p>
  <p>${g.suidaku&&g.suidaku.date?esc(g.suidaku.date)+'に':''}${esc((g.suidaku&&g.suidaku.src)||'（照会先）')}${g.gesui&&g.gesui.src&&g.gesui.src!=='同上'?'及び'+esc(g.gesui.src):''}へ特定有害物質の使用等（製造・使用・処理）に関する公的届出資料の有無を確認した。その回答は以下のとおりである。${fn('水質汚濁防止法・下水道法の特定施設の届出')}</p>
  <table class="yn"><tr><td>１）水質汚濁防止法に基づく特定施設のうち特定有害物質を使用している施設</td><td>：${esc((g.suidaku&&g.suidaku.v)||'未確認')}</td></tr><tr><td>２）下水道法に基づく特定施設のうち特定有害物質を使用している施設</td><td>：${esc((g.gesui&&g.gesui.v)||'未確認')}</td></tr></table>
  <p>（2）土壌・地下水汚染情報</p>
  <p>調査対象地及び周辺${g.radius?'（調査対象地から'+esc(g.radius)+'）':''}における土壌汚染対策法第6条及び第11条${(g.ord||[]).length?'、並びに'+g.ord.map(o=>esc(o.name)).join('、'):''}に基づく指定区域の有無について、${esc(g.zoneSrc||'（確認先）')}で確認した。${fn('土壌汚染対策法に基づく区域の指定状況')}</p>
  <table class="yn"><tr><td>１）土壌汚染対策法第6条に基づく要措置区域</td><td>：${esc(g.art6||'未確認')}</td></tr><tr><td>２）土壌汚染対策法第11条に基づく形質変更時要届出区域（人為等由来）</td><td>：${esc(g.art11jin||'未確認')}</td></tr><tr><td>３）土壌汚染対策法第11条に基づく形質変更時要届出区域（自然由来）</td><td>：${esc(g.art11shizen||'未確認')}</td></tr><tr><td>４）土壌汚染対策法第11条に基づく形質変更時要届出区域（水面埋立て土砂由来）</td><td>：${esc(g.art11umetate||'未確認')}</td></tr>${(g.ord||[]).map((o,i)=>`<tr><td>${'５６７８'[i]}）${esc(o.name)}${/条例に基づく/.test(o.item)?'':'に基づく'}${esc(o.item.replace(/^条例に基づく/,'に基づく'))}</td><td>：${esc(o.v)}</td></tr>`).join('')}</table>
  <p>（3）自然由来または公有水面等に関しての情報</p>${P('regs.natural',g.natural||'（自然由来・公有水面埋立に関する情報を記入）')}

  <h2 id="sec-3">３．結果まとめ ${ev(c,v.ref)}</h2><p>各種資料による利用履歴の調査結果は以下のとおりである。</p>
  <div class="shoken"><div class="sh">所　見</div><div class="shh">${E('verdict.headline',esc(v.headline))}</div><div class="sht" data-path="verdict.text" contenteditable="true" spellcheck="false">${esc(v.text)}</div></div>`;
  if(neg){
    const k1=subNames(c,1),k2=subNames(c,2),k3=subNames(c,3);const cl=c.classification||{};
    const lst=a=>a&&a.length?esc(a.join('、')):'該当なし';
    const sec63=(n,k,names)=>names.length?`<h4>6.3.${n} ${KIND[k]}</h4><p>${esc(names.join('　'))}</p><p>【現況地表面】</p><div class="cls"><p>(1) 土壌汚染が存在するおそれがないと認められる土地<br>　⇒ ${lst(cl.none)}</p><p>(2) 土壌汚染が存在するおそれが少ないと認められる土地<br>　⇒ ${lst(cl.low)}</p><p>(3) 土壌汚染が存在するおそれが比較的多いと認められる土地<br>　⇒ ${lst(cl.high)}</p></div><p class="cap">図 6.3.${n} 土壌汚染のおそれの区分（${KIND[k]}）現況地表面。区画図は出力時に公図から作成。</p>`:'';
    let n=0;
    html+=`
  <h2 id="sec-4">４．試料採取等対象物質の選定</h2>
  <p>履歴調査の結果、対象地では、特定有害物質の使用及び保管の可能性が否定できなかったため、下記の特定有害物質を試料採取等対象物質とした。</p>
  ${k1.length?`<p>○第一種特定有害物質　${esc(k1.join('　'))}</p>`:''}${k2.length?`<p>○第二種特定有害物質　${esc(k2.join('　'))}</p>`:''}${k3.length?`<p>○第三種特定有害物質　${esc(k3.join('　'))}</p>`:''}
  ${(c.extraSubstances||[]).length?`<p>○${esc(c.extraSubstances.join('、'))}（補足事項）<br>※「${esc(c.extraSubstances.join('、'))}」は、土壌汚染対策法には規定されていないが規定している都道府県がある事から、調査対象物質に反映している。</p>`:''}
  ${!(k1.length+k2.length+k3.length)?'<p class="todo">物質が選定されていません。右の「判断」で懸念の業種を確認するか、物質を選んでください。</p>':''}
  <div class="why" contenteditable="false"><b>選定の根拠</b>${openConcerns(c).map(x=>{const i=INDBY[x.industry];return i?`<p>${esc(x.use)} → ${esc(i.label)}：${esc(i.why)}<br><small>出典：${esc(i.src.type==='none'?'未登録（担当者の選定）':i.src.cite)}</small>${i.official?`<br><small>公式統計：${esc(i.official.text)}</small>`:''}</p>`:'';}).join('')}</div>
  <p>法に定められる特定有害物質及び区域の指定に係る基準（以下「指定基準」という。）を表4に示す。${fn('土壌汚染対策法施行規則')}</p><p class="tcap">表4 指定基準</p>${stdTable(c)}
  <h2 id="sec-5">５．汚染のおそれの由来に応じた区分</h2>
  <h3>5.1 基本的な考え方</h3><p>情報の入手・把握において収集した情報により、特定有害物質の種類ごとに、以下の汚染のおそれの由来に応じた区分ごとに定められた方法により、後の試料採取等を行う区画選定を行うものとし、次の三つの区分に分類するものとした。</p>
  <p>①調査対象地における試料採取等対象物質がシアン化合物を除く第二種特定有害物質であり、かつ、汚染状態が自然に由来するおそれがあると認められる場合（自然由来盛土等に使用した土壌があると認められる場合を含む。）</p>
  <p>②調査対象地が公有水面埋立法（大正10年法律第57号）による公有水面埋立て又は干拓事業により造成された土地であり、汚染状態が当該造成時の水面埋立てに用いられた土砂に由来するおそれがあると認められる場合</p>
  <p>③調査対象地の汚染が自然又は水面埋立てに用いられた土砂以外（以下、「人為等」という。）に由来するおそれがあると認められる場合</p>
  <p>「汚染のおそれの由来」とは上記の①は自然由来、②は水面埋立て土砂由来、③は人為等由来を示す。</p>
  <h3>5.2 汚染のおそれの由来の判断</h3><p>調査対象地では、自然由来及び水面埋立て土砂由来に該当する情報が無く、人為等由来に該当する情報が確認された。</p>
  <div class="cls"><p>①自然由来　⇒ 該当無し</p><p>②水面埋立て土砂由来　⇒ 該当無し</p><p>③人為等由来${k1.length?`<br>　⇒ 第一種特定有害物質（全${k1.length}物質）　${esc(k1.join('　'))}`:''}${k2.length?`<br>　⇒ 第二種特定有害物質（全${k2.length}物質）　${esc(k2.join('　'))}`:''}${k3.length?`<br>　⇒ 第三種特定有害物質（全${k3.length}物質）　${esc(k3.join('　'))}`:''}</p></div>
  <h2 id="sec-6">６．土壌汚染のおそれの区分の分類</h2>
  <h3>6.1 基本的な考え方</h3><p>情報の入手・把握において収集した情報により、調査対象地を土壌汚染のおそれがあると認められる特定有害物質の種類ごとに次の三つの区分に分類した。</p>
  <div class="cls"><p>(1) 土壌汚染が存在するおそれがないと認められる土地</p><p>(2) 土壌汚染が存在するおそれが少ないと認められる土地</p><p>(3) 土壌汚染が存在するおそれが比較的多いと認められる土地</p></div>
  <h3>6.2 汚染のおそれが生じた場所の位置</h3>${P('clsBasis',c.clsBasis||'調査対象地における汚染のおそれが生じた場所の位置は、過去に盛土による土地地盤高の改変の記録が存在しないこと、関連する情報及び資料等が存在しないことから、現状の地表面地盤面からと判断した。')}
  <h3>6.3 土壌汚染のおそれの区分の分類</h3>${[[1,k1],[2,k2],[3,k3]].filter(x=>x[1].length).map(x=>sec63(++n,x[0],x[1])).join('')}`;
  }
  html+=`
  <h2 id="sec-att">添付資料</h2>
  <table class="reg" contenteditable="false"><thead><tr><th>区分</th><th>資料</th><th>ページ</th></tr></thead><tbody>${(c.docs||[]).filter(d=>d.cls!=='本文').map(d=>`<tr><td>${esc(d.cls)}</td><td>${d.id.replace(/^[PKX]/,'')}）${esc(d.kind)}${d.name?'　'+esc(d.name):''}</td><td class="c">${d.pages?'p.'+esc(d.pages):'—'}</td></tr>`).join('')||'<tr><td colspan="3" class="c">添付資料は未登録</td></tr>'}</tbody></table>
  <h2 id="sec-src">出典一覧</h2>
  <div class="srcs" contenteditable="false">${S.map(x=>`<div class="src"><span class="n">[${x.n}]</span><div><b>${esc(x.title)}</b><span class="k">${esc(x.kind)}</span>${x.verified?(x.url?'<span class="ok">公式出典で確認</span>':''):x.own?'<span class="ng">社内の既往報告書</span>':'<span class="ng">出典未確認</span>'}<br>${esc(x.detail||'')}${x.url?`<br><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.url)}</a>`:''}${x.checkedOn&&x.url?`<span class="d">（${esc(x.checkedOn)} 確認）</span>`:''}</div></div>`).join('')}</div>`;
  return html;
}
