/* ══════════ レポート描画 ══════════
   エコ・テック様の地歴調査報告書（Drive「エコテック地歴調査報告書」）の紙面に合わせる。
   ・A4のページ単位（.sheet）。右下にページ番号、ページ下に脚注
   ・本文は原本の章立てと言い回しのまま。原本にない要素（適用条項の判定、選定の根拠、出典一覧）は付録に置く
   ・原本・添付資料のページを開く札（.ev）は画面でだけ見せ、印刷・Wordには出さない */
const CIRC='①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
function docOf(c,id){return (c.docs||[]).find(d=>d.id===id);}
const attLabel=d=>`添付資料(${d.cls==='私的資料'?'私的':d.cls==='公的資料'?'公的':'一般'})${String(d.id).replace(/^[PKX]/,'')}「${d.kind}」`;
const attShort=d=>(d.cls==='私的資料'?'添付(私的)':d.cls==='公的資料'?'添付(公的)':'添付(一般)')+String(d.id).replace(/^[PKX]/,'');
/* 根拠の札：どの資料の何ページか（画面のみ） */
function ev(c,ref){
  if(!(ref&&ref.p))return '';const d=ref.doc&&ref.doc!=='R'?docOf(c,ref.doc):null;
  return `<span class="evs" contenteditable="false"><span class="ev${d?' att':''}" data-p="${ref.p}" data-doc="${d?esc(d.id):''}" title="${esc(d?(d.name||d.kind):(c.source?c.source.file:''))}">${d?attShort(d)+' '+esc(d.kind):(c.source?'原本':'資料')} p.${ref.p}</span></span>`;
}
/* 添付資料への脚注（原本の書き方）。ページが分かる資料には、開くための札を付ける */
function attNote(c,re){
  const ds=(c.docs||[]).filter(d=>d.cls!=='本文'&&re.test(d.kind));if(!ds.length)return '';
  return ds.map(d=>esc(attLabel(d))+`<span class="ev att" contenteditable="false" data-p="${String(d.pages||'').split('–')[0]||1}" data-doc="${d.pages?'':esc(d.id)}" title="${esc(d.name||'')}">${d.pages?'p.'+esc(d.pages):'開く'}</span>`).join('、')+'を参照。';
}
const E=(path,html,tag)=>`<${tag||'span'} data-path="${path}" contenteditable="true" spellcheck="false">${html}</${tag||'span'}>`;
/* 未取得の注記（赤枠）。印刷にも出す。fig を付けると図の枠の大きさで出す */
function miss(g,mode){return g?`<div class="miss${mode?' '+mode:''}" contenteditable="false" data-gap="${g.k}"><b>未取得</b><p class="mt">${esc(g.label)}</p><p>取得先：${esc(g.how)}</p><p>共有すると：${esc(g.fill)}</p></div>`:'';}
const ngv=v=>v?esc(v):'<span class="ngv">未確認</span>';
/* 未記入の欄：赤字の仮の文言を出す。そのまま離れても、仮の文言は保存しない（data-ph） */
const EP=(path,val,ph)=>val||!ph?E(path,esc(val||'')):`<span class="ngv"><span data-path="${path}" data-ph="${esc(ph)}" contenteditable="true" spellcheck="false">${esc(ph)}</span></span>`;
const PP=(path,val,ph,cls)=>val?P(path,val,cls):`<p class="${cls||''} ngp" data-path="${path}" data-ph="${esc(ph)}" contenteditable="true" spellcheck="false">${esc(ph)}</p>`;
const P=(path,text,cls)=>`<p${cls?' class="'+cls+'"':''} data-path="${path}" contenteditable="true" spellcheck="false">${esc(text||'').replace(/\n/g,'<br>')}</p>`;

/* 地理院タイルを並べ、対象地を中央に置いた図。印刷・PDFでもそのまま出る */
const DIRV={'北':[0,-1],'北東':[1,-1],'東':[1,0],'南東':[1,1],'南':[0,1],'南西':[-1,1],'西':[-1,0],'北西':[-1,-1]};
function tileFig(lat,lng,layer,ext,z,opt){
  if(!lat||!lng)return '';opt=opt||{};
  const n=Math.pow(2,z),x=(lng+180)/360*n,rad=lat*Math.PI/180,y=(1-Math.asinh(Math.tan(rad))/Math.PI)/2*n;
  const tx=Math.floor(x),ty=Math.floor(y),nx=opt.nx==null?2:opt.nx,ny=opt.ny==null?1:opt.ny,mx=nx*256+(x-tx)*256,my=ny*256+(y-ty)*256,W=opt.w||520,H=opt.h||330;
  let imgs='';for(let j=-ny;j<=ny;j++)for(let i=-nx;i<=nx;i++)imgs+=`<img alt="" onerror="${i||j?"this.style.visibility='hidden'":"this.closest('.tfig').classList.add('none')"}" src="https://cyberjapandata.gsi.go.jp/xyz/${layer}/${z}/${tx+i}/${ty+j}.${ext}" style="position:absolute;left:${(i+nx)*256}px;top:${(j+ny)*256}px;width:256px;height:256px;max-width:none">`;
  const d=DIRV[opt.dir];const k=d?1/Math.hypot(d[0],d[1]):0;const ax=d?d[0]*k:0,ay=d?d[1]*k:0;
  const arrow=d?`<line x1="${W/2+ax*24}" y1="${H/2+ay*24}" x2="${W/2+ax*92}" y2="${H/2+ay*92}" stroke="#1f6fd6" stroke-width="7"/><polygon points="${W/2+ax*114},${H/2+ay*114} ${W/2+ax*88-ay*12},${H/2+ay*88+ax*12} ${W/2+ax*88+ay*12},${H/2+ay*88-ax*12}" fill="#1f6fd6"/><rect x="${W/2+ax*134-40}" y="${H/2+ay*134-10}" width="80" height="20" fill="#fff" stroke="#1f6fd6" stroke-width="1.5"/><text x="${W/2+ax*134}" y="${H/2+ay*134+4}" text-anchor="middle" font-size="11" font-weight="700" fill="#1f6fd6">地下水流向</text>`:'';
  return `<div class="tfig" contenteditable="false"><div class="tview" style="width:${W}px;height:${H}px"><div style="position:absolute;left:${W/2-mx}px;top:${H/2-my}px;width:${(2*nx+1)*256}px;height:${(2*ny+1)*256}px">${imgs}</div>
   <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="position:absolute;left:0;top:0">${arrow}<circle cx="${W/2}" cy="${H/2}" r="${opt.r||14}" fill="none" stroke="#e60012" stroke-width="2.5"/>${opt.mini?'':`<rect x="${W/2-150}" y="${H/2-74}" width="104" height="26" fill="#fff" stroke="#e60012" stroke-width="2"/><text x="${W/2-98}" y="${H/2-55.5}" text-anchor="middle" font-size="14" font-weight="700" fill="#e60012">調査対象地</text><line x1="${W/2-58}" y1="${H/2-48}" x2="${W/2-12}" y2="${H/2-10}" stroke="#e60012" stroke-width="1.3"/><polygon points="${W/2-10},${H/2-9} ${W/2-19},${H/2-12} ${W/2-14},${H/2-18}" fill="#e60012"/>`}</svg></div></div>`;
}

/* 目次（原本の並び）。[id, 表記, 階層] */
function tocOf(c){
  const neg=c.verdict&&c.verdict.level==='否定できない';
  const t=[['sec-1','１．調査概要',0],['sec-11','1.1　調査件名',1],['sec-12','1.2　調査目的',1],['sec-13','1.3　敷地面積',1],['sec-14','1.4　関連法規',1],['sec-15','1.5　調査期間',1],['sec-16','1.6　調査機関',1],['sec-17','1.7　調査場所',1],['sec-171','1.7.1　調査対象地位置図',2],['sec-172','1.7.2　調査対象地地番図',2],
   ['sec-2','２．履歴調査',0],['sec-21','2.1　地形・地質及び地下水概要',1],['sec-211','2.1.1　地形・地質概要',2],['sec-212','2.1.2　地下水概要',2],['sec-22','2.2　登記簿謄本による履歴調査',1],['sec-23','2.3　地形図・住宅地図・空中写真による履歴調査',1],['sec-24','2.4　ヒアリング調査及び現地踏査',1],['sec-241','2.4.1　ヒアリング調査',2],['sec-242','2.4.2　現地踏査',2],['sec-243','2.4.3　公的機関の環境情報',2],
   ['sec-3','３．結果まとめ',0]];
  if(neg)t.push(['sec-4','４．試料採取等対象物質の選定',0],['sec-5','５．汚染のおそれの由来に応じた区分',0],['sec-51','5.1　基本的な考え方',1],['sec-52','5.2　汚染のおそれの由来の判断',1],['sec-6','６．土壌汚染のおそれの区分の分類',0],['sec-61','6.1　基本的な考え方',1],['sec-62','6.2　汚染のおそれが生じた場所の位置',1],['sec-63','6.3　土壌汚染のおそれの区分の分類',1]);
  t.push(['sec-app1','付録１　適用条項の判定',0]);if(neg)t.push(['sec-app2','付録２　対象物質の選定根拠',0]);t.push(['sec-src',`付録${neg?'３':'２'}　出典一覧`,0]);
  return t;
}

/* 2.2【土地】：地積は値が変わる行まで結合、「◯番→◯番に分筆」の行は原因と名義人を結合（原本の表組み） */
function landTable(c){
  return (c.land||[]).map((l,li)=>{
    const rows=l.rows,n=rows.length;const span=(st,i)=>{const k=st.indexOf(i);return k<0?0:(k+1<st.length?st[k+1]:n)-i;};
    const cs=[],ms=[];rows.forEach((r,i)=>{if(i===0||r.chiseki)cs.push(i);if(i===0||r.chimoku)ms.push(i);});
    const parts=String(l.chiban).split(' → ');let bs=[0],labels=[parts[0]];
    if(parts.length>1){const k=rows.findIndex((r,i)=>i>0&&cs.includes(i)&&/分筆|合筆|換地|区画整理/.test(r.cause||''));
      if(k>0){bs=[0,k];labels=[parts[0],/[\s　]/.test(parts[1])?parts[1]:parts[0].replace(/[^\s　]+$/,'')+parts[1]];}else labels=[parts.join(' → ')];}
    const lab=t=>esc(t).replace(/[\s　]+(?=[^\s　]+$)/,'<br>');
    return `<table class="reg land"><thead><tr><th>現状地番</th><th>地目</th><th>地積</th><th>登記年月日</th><th>原因</th><th>登記名義人等の変更等</th></tr></thead><tbody>`+
    rows.map((r,i)=>{const b=bs.indexOf(i);const merged=!r.holder&&/→|分筆|合筆/.test(r.cause||'');
      return `<tr>${b>=0?`<td rowspan="${span(bs,i)}" class="cb">${lab(labels[b])}${l.note&&b===bs.length-1?'<br>※'+esc(l.note):''}</td>`:''}${ms.includes(i)?`<td rowspan="${span(ms,i)}" class="c">${esc(r.chimoku||l.chimoku||'')}</td>`:''}${cs.includes(i)?`<td rowspan="${span(cs,i)}" class="c nw">${E(`land.${li}.rows.${i}.chiseki`,esc(r.chiseki||(i===0?'－':'')))}</td>`:''}
      <td class="nw">${E(`land.${li}.rows.${i}.date`,esc(r.date))}</td>${merged?`<td colspan="2">${E(`land.${li}.rows.${i}.cause`,esc(r.cause))}</td>`:`<td class="c cz">${E(`land.${li}.rows.${i}.cause`,esc(r.cause))}</td><td>${r.unclear?'※':''}${E(`land.${li}.rows.${i}.holder`,esc(r.holder))}${r.unclear?'（不明瞭）':''}</td>`}</tr>`;}).join('')+`</tbody></table>`;}).join('');
}
function lineageSvg(c){
  const evs=c.lineage||[];if(!evs.length)return '';
  const target=new Set((c.site.parcels||[]).map(p=>p.chiban));
  const rowH=28,bw=60,gap=8,padL=4;let y=8;const rows=evs.map(e=>{const h=Math.max(Math.ceil(e.from.length/3),Math.ceil(e.to.length/4))*rowH;const r={e,y,h};y+=h+8;return r;});
  const W=640,H=y+2;const midX=222;
  const box=(x,yy,t)=>`<rect x="${x}" y="${yy}" width="${bw}" height="19" fill="${target.has(t)?'#ffff00':'#fff'}" stroke="#000" stroke-width="1"/><text x="${x+bw/2}" y="${yy+13.5}" text-anchor="middle" font-size="10" fill="#000">${esc(t)}</text>`;
  let s=`<svg viewBox="0 0 ${W} ${H}" class="lineage" role="img" aria-label="地番の変遷">`;
  rows.forEach(({e,y})=>{
    e.from.forEach((f,i)=>{s+=box(padL+(i%3)*(bw+gap),y+Math.floor(i/3)*rowH,f);});
    const cy=y+9.5;s+=`<line x1="${padL+Math.min(e.from.length,3)*(bw+gap)-gap}" y1="${cy}" x2="${midX+142}" y2="${cy}" stroke="#000" stroke-width="1"/><polygon points="${midX+142},${cy-4} ${midX+150},${cy} ${midX+142},${cy+4}" fill="#000"/>`;
    s+=`<rect x="${midX-10}" y="${cy-9}" width="140" height="18" fill="${e.type==='分筆'?'#c6efce':e.type==='合筆'?'#cfe0f5':'#f4c7f0'}"/><text x="${midX+60}" y="${cy+3.5}" text-anchor="middle" font-size="9.5" fill="#000">${esc(e.date)} ${esc(e.type)}</text>`;
    e.to.forEach((t,i)=>{s+=box(midX+156+(i%4)*(bw+gap),y+Math.floor(i/4)*rowH,t);});
  });
  return s+'</svg>';
}
function bldTable(c){
  return `<table class="reg bld"><thead><tr><th>家屋番号</th><th>種類</th><th>構造</th><th>登記年月日</th><th>原因</th><th>登記名義人等の変更等</th></tr></thead><tbody>`+
   c.buildings.map((b,bi)=>b.rows.map((r,ri)=>`<tr>${ri===0?`<td rowspan="${b.rows.length}" class="cb">${esc(b.kaoku).replace(/[\s　]+(?=[^\s　]+$)/,'<br>')}${b.note?'<br>※'+esc(b.note):''}</td><td rowspan="${b.rows.length}" class="c">${esc(b.kind).replace(/・/g,'<br>')}</td><td rowspan="${b.rows.length}">${esc(b.structure)}</td>`:''}<td class="nw">${E(`buildings.${bi}.rows.${ri}.date`,esc(r.date))}</td><td class="c cz">${E(`buildings.${bi}.rows.${ri}.cause`,esc(r.cause))}</td><td>${E(`buildings.${bi}.rows.${ri}.holder`,esc(r.holder))}</td></tr>`).join('')).join('')+`</tbody></table>`;
}
function corpBlock(c){
  return (c.corps||[]).map((x,i)=>`<div class="corp"><p class="ch">${CIRC[i]||i+1}　${esc(x.name)}${x.got&&x.purpose?'　法人登記簿（一部抜粋）':''} ${ev(c,x.ref)}</p>`+
    (x.purpose?`<table class="touki"><tr><th>商　号</th><td>${esc(x.name)}</td></tr>${x.addr?`<tr><th>本　店</th><td>${esc(x.addr)}</td></tr>`:''}${x.est?`<tr><th>会社成立の年月日</th><td>${esc(x.est)}</td></tr>`:''}<tr><th>目　的</th><td>${x.purpose.map((p,j)=>`${j+1}．${esc(p)}`).join('<br>')}</td></tr>${x.closed?`<tr><th>解散等</th><td>${esc(x.closed)}</td></tr>`:''}</table>`:'')+
    P(`corps.${i}.comment`,x.comment)+`</div>`).join('');
}
function stdTable(c){
  const sel=new Set(c.substances||[]);let prev=0;
  return `<table class="std"><thead><tr><th>分類</th><th>特定有害物質の種類</th><th>調査対象<br>物質</th><th>土壌溶出量基準<br>(mg/L)</th><th>土壌含有量基準<br>(mg/kg)</th><th>地下水基準<br>(mg/L)</th><th>第二溶出量基準<br>(mg/L)</th></tr></thead><tbody>`+
   SUB.map(s=>{const first=s.k!==prev;prev=s.k;const n=SUB.filter(x=>x.k===s.k).length;return `<tr${first?' class="g"':''}>${first?`<td rowspan="${n}" class="vk">${KIND[s.k]}</td>`:''}<td class="nm">${s.name}</td><td class="c mk">${sel.has(s.id)?'○':''}</td><td class="c">${s.sol}</td><td class="c${s.con?'':' diag'}">${s.con||''}</td><td class="c">${s.gw}</td><td class="c">${s.sol2}</td></tr>`;}).join('')+
   `</tbody></table><p class="tnote">※「検出されないこと」とは、定められた測定方法により測定した場合において、その結果が当該方法の定量下限値を下回ることをいう。</p>`;
}
function subNames(c,k){return (c.substances||[]).map(id=>SUBBY[id]).filter(s=>s&&s.k===k).map(s=>s.name.replace(/及びその化合物|化合物/,''));}
const fmtA2=n=>{const v=Number(n);return v?v.toLocaleString('ja-JP',Number.isInteger(v)?{}:{minimumFractionDigits:2,maximumFractionDigits:2}):'—';};
const uList=a=>a.map(x=>`<u>${esc(x)}</u>`).join('　');

function renderReport(c){
  const s=c.site,g=c.regs||{},v=c.verdict||verdictOf(c),neg=v.level==='否定できない';
  const ords=ordFor(s.pref,s.city);const S=sourcesOf(c);const J=judge(c);
  const addr=`${s.pref}${s.city}${s.town}`;const chibans=(s.parcels||[]).map(p=>p.chiban).join('、');
  const maps=c.maps||[];const h=c.hearing||[];
  const gaps=gapsOf(c);const G={};gaps.forEach(x=>{G[x.k]=x;});
  /* ── ページの組み立て ── */
  const sheets=[];let cur=null,fnN=0,pageN=0;const pageOf={};
  const sheet=(cls,numbered)=>{cur={cls:cls||'',body:'',notes:[],page:numbered===false?null:++pageN};sheets.push(cur);};
  const add=hh=>{cur.body+=hh;};
  const mark=id=>{if(cur.page&&pageOf[id]==null)pageOf[id]=cur.page;};
  const H=(tag,id,text,extra)=>{mark(id);return `<${tag} id="${id}">${text}${extra||''}</${tag}>`;};
  const note=t=>{if(!t)return '';fnN++;cur.notes.push([fnN,t]);return `<sup class="fnr" contenteditable="false">${fnN}</sup>`;};

  /* 1 調査概要：1.1〜1.3 */
  sheet();
  add(H('h2','sec-1','１．調査概要'));
  add(H('h3','sec-11','1.1　調査件名',' '+ev(c,c.source&&c.source.overviewP?{p:c.source.overviewP}:null)));
  add(`<p class="in2">${esc(c.title)}　地歴調査</p>`);
  const zr=[['調査対象地・周辺地等の土壌汚染対策法に基づく「人為等由来」の指定区域',g.art11jin],['調査対象地・周辺地等の土壌汚染対策法に基づく「自然由来」の指定区域',g.art11shizen],['調査対象地・周辺地等の土壌汚染対策法に基づく「水面埋立て土砂由来」の指定区域',g.art11umetate],['調査対象地の廃棄物の処理及び清掃に関する法律の指定区域',g.haiki]].concat((g.ord||[]).map(o=>[`${o.name}に基づく${o.item.replace(/^条例に基づく/,'')}`,o.v]));
  add(`<table class="t11">${s.jusho?`<tr class="g"><th>住 居 表 示</th><td colspan="2">${E('site.jusho',esc(s.jusho))}</td></tr>`:''}<tr class="g"><th>地 番 表 示</th><td colspan="2">${E('site.chibanLabel',esc(s.chibanLabel))}</td></tr>
   <tr class="g"><th rowspan="2">特定施設の有無</th><td>水質汚濁防止法に基づく有害物質使用の特定施設</td><td class="v">${ngv(g.suidaku&&g.suidaku.v)}</td></tr><tr><td>下水道法に基づく有害物質使用の特定施設</td><td class="v">${ngv(g.gesui&&g.gesui.v)}</td></tr>
   ${zr.map((r,i)=>`<tr${i===0?' class="g"':''}>${i===0?`<th rowspan="${zr.length}">指定区域の有無</th>`:''}<td>${esc(r[0])}</td><td class="v">${ngv(r[1])}</td></tr>`).join('')}</table>`);
  add(`<table class="tpar"><tr><th colspan="6" class="band">＜調査対象地の筆及び一覧表＞</th></tr><tr class="hd"><td colspan="2">所　在</td><td>地番</td><td>地目</td><td>地積</td><td>所有者</td></tr>${(s.parcels||[]).map((p,i)=>`<tr><td class="no">${i+1}</td><td>${E(`site.parcels.${i}.shozai`,esc(p.shozai))}</td><td>${E(`site.parcels.${i}.chiban`,esc(p.chiban))}</td><td>${p.chimoku?esc(p.chimoku):G.land?'<span class="ngv">未取得</span>':''}</td><td>${+p.chiseki?fmtA2(p.chiseki)+' ㎡':''}</td><td>${EP(`site.parcels.${i}.owner`,p.owner,G.land?'未取得':'')}</td></tr>`).join('')}<tr><td colspan="4">合計</td><td>${fmtA2(s.area)} ㎡</td><td class="diag"></td></tr></table>`);
  add(H('h3','sec-12','1.2　調査目的'));
  add(`<p class="in2 ti">本調査は、${esc(addr)}${chibans&&(s.parcels||[]).length===1?' '+esc(chibans):''}地内（以下「調査対象地」と称す）における土壌汚染のおそれの可能性について判断することを目的とした。</p>`);
  add(H('h3','sec-13','1.3　敷地面積'));
  add(`<p class="in2">${fmtA2(s.area)} ㎡（${E('site.areaNote',esc(s.areaNote||'公簿面積による推定'))}）</p>`);

  /* 1.4〜1.7 */
  sheet();
  add(H('h3','sec-14','1.4　関連法規',' '+ev(c,c.source&&c.source.lawsP?{p:c.source.lawsP}:null)));
  add(LAWS.items.map((l,i)=>`<p class="law">・${esc(l.name)}<br>（${esc(l.number)}）${l.lastAmended?'（改正：'+esc(l.lastAmended)+'）':''}${i===0?'以下、「法」という。':''}</p>`).join('')+
    ords.filter(o=>o.rules&&o.rules.length).map(o=>`<p class="law">・${esc(o.name.replace(/（通称.*?）/,''))}<br>${(o.numberShort||o.number)?'（'+esc(o.numberShort||o.number)+'）':''}${(o.lastAmendedShort||o.lastAmended)?'（改正：'+esc(o.lastAmendedShort||o.lastAmended)+'）':''}</p>`).join(''));
  add(H('h3','sec-15','1.5　調査期間'));add(`<p class="in2">${EP('period',c.period,'調査期間を記入')}</p>`);
  add(H('h3','sec-16','1.6　調査機関'));add(`<p class="in2">${esc(c.org.name)}（指定調査機関指定番号【 ${esc(c.org.no)} 】）<br>所　在　地：${esc(c.org.addr)}<br>電 話 番 号：${esc(c.org.tel)}</p>`);
  add(H('h3','sec-17','1.7　調査場所'));add(`<p class="in2">${esc(s.pref)}${esc(s.city)}${esc(s.town)} ${esc(chibans)}${chibans?'（地番表示）':''}</p>`);

  /* 図 1.7-1・1.7-2 */
  sheet('figs');
  add(s.lat?tileFig(s.lat,s.lng,'std','png',18):`<div class="figbox" contenteditable="false">位置を確定すると、地理院地図から位置図を作成します。</div>`);
  mark('sec-171');add(`<p class="fc" id="sec-171">図 1.7-1　調査対象地位置図${note('出典：地理院地図(電子国土web)')}</p>${s.lat&&!s.pinned?'<p class="todo" contenteditable="false">町丁目の代表点を表示しています。新規作成の地図でピンを動かすと、番地の位置に合わせられます。</p>':''}`);
  add(G.kozu?miss(G.kozu,'fig'):`<div class="figbox" contenteditable="false">公図から作成した地番図を差し込み</div>`);
  mark('sec-172');add(`<p class="fc" id="sec-172">図 1.7-2　調査対象地地番図${note(G.kozu?'':attNote(c,/公図/)||'添付資料(一般B)「公図」を参照。')}</p>`);

  /* 2.1 */
  sheet();
  add(H('h2','sec-2','２．履歴調査'));
  add(H('h3','sec-21','2.1　地形・地質及び地下水概要',' '+ev(c,s.ref)));
  add(H('h4','sec-211','2.1.1　地形・地質概要'));add(miss(G.geo)+PP('site.geoText',s.geoText,'（地形・地質の概要を記入）','in2 ti'));
  add(H('h4','sec-212','2.1.2　地下水概要'));add(PP('site.gwText',s.gwText,'（地下水流向の推定を記入）','in2 ti'));
  add(`<p class="fc">図 2.1　地形地質概要及び推定地下水流向${note('国土交通省国土地理院 電子国土web（治水地形分類図）より引用し、編集・加工のうえ掲載している。')}</p>`);
  add(s.lat?tileFig(s.lat,s.lng,'lcmfc2','png',16,{dir:s.gwDir,r:10}):`<div class="figbox" contenteditable="false">位置を確定すると、治水地形分類図に推定地下水流向を重ねて作成します。</div>`);

  /* 2.2 土地 */
  sheet();
  add(H('h3','sec-22','2.2　登記簿謄本による履歴調査',note(G.land?'':attNote(c,/登記|公図/)||'添付資料(一般)A「登記簿謄本」、添付資料(一般)B「公図」を参照。')+' '+ev(c,(c.land&&c.land[0]&&c.land[0].ref)||null)));
  add(`<p class="in2 ti">対象地について、現状の登記簿謄本から旧土地台帳までの遡及調査を行った調査結果の要約を「登記簿謄本による対象地の履歴」に示す。</p><p class="tt">登記簿謄本による調査対象地の地歴</p><p class="lb">【土地】</p>`);
  add((c.land||[]).length?landTable(c):miss(G.land));
  if((c.lineage||[]).length)add(`<p class="lb">〈参考〉</p>${lineageSvg(c)}`);
  if((c.buildings||[]).length){sheet();add(`<p class="lb">【建物】</p>${bldTable(c)}`);}
  if((c.corps||[]).length){sheet();add(`<p class="lb">【法人】</p><p class="in1">対象地と関連する法人が${c.corps.length}社発見された。以下、その法人について登記簿謄本からの調査結果を示す。</p>${corpBlock(c)}`);}

  /* 2.3 */
  sheet();
  add(H('h3','sec-23','2.3　地形図・住宅地図・空中写真による履歴調査',note(G.maps?'':attNote(c,/地図|地形図|空中写真/)||'添付資料(一般)C「地形図・住宅地図」、添付資料(一般)D「空中写真」を参照。')+' '+ev(c,c.mapsRef)));
  if(maps.length)add(`<p class="in1 ti">地形図・住宅地図・空中写真によって、${esc(maps[0].w)}まで遡及した調査の結果を「地形図・住宅地図・空中写真による調査対象地の利用履歴」に示す。</p>`);
  add(maps.length?`<p class="tt b">地形図・住宅地図・空中写真による対象地の利用履歴</p><table class="mapt"><thead><tr><th>地図年次</th><th>対象地用途</th><th>周辺地の土地利用</th><th>根拠資料</th></tr></thead><tbody>${maps.map((m,i)=>`<tr><td class="yr">${m.y} 年　(${esc(m.w)})</td><td>${E(`maps.${i}.use`,esc(m.use))}</td><td>${E(`maps.${i}.around`,esc(m.around))}</td><td>${esc(m.src)}</td></tr>`).join('')}</tbody></table>`:miss(G.maps)+(s.lat?`<p class="tt b">国土地理院の空中写真（年代別）：取得済み・判読前</p><table class="mapt"><thead><tr><th>撮影年代</th><th>対象地用途</th><th>周辺地の土地利用</th><th>根拠資料</th></tr></thead><tbody>${GSI_PHOTOS.map(p=>`<tr><td class="yr">${p[2]}</td><td><span class="ngv">判読前</span></td><td><span class="ngv">判読前</span></td><td>国土地理院 空中写真${p[3]?'（'+p[3]+'）':''}</td></tr>`).join('')}</tbody></table><p class="in1 sm">写真は次ページの図2.3に掲載。用途の判読は、住宅地図・地形図とあわせて担当者が行う。</p>`:''));
  add((c.mapNotes||[]).map((n,i)=>`<div class="num"><span>${'１２３４５６７８９'[i]||i+1}）</span>${P('mapNotes.'+i,n)}</div>`).join(''));

  if(!maps.length&&s.lat){sheet('figs');mark('sec-23f');
    add(`<p class="fc" id="sec-23f" style="margin-bottom:8px">図 2.3　年代別の空中写真（調査対象地とその周辺）${note('出典：国土地理院 地理院タイル（年代別の写真）。撮影年月日は、国土地理院「地図・空中写真閲覧サービス」で特定する。')}</p><div class="phg" contenteditable="false">${GSI_PHOTOS.map(p=>`<figure class="ph">${tileFig(s.lat,s.lng,p[0],p[1],17,{w:250,h:168,nx:1,ny:1,r:10,mini:true})}<span class="nop">この年代の写真は整備されていない</span><figcaption>${p[2]}${p[3]?'（'+p[3]+'）':''}</figcaption></figure>`).join('')}</div>`);}
  /* 2.4.1・2.4.2 */
  sheet();
  add(H('h3','sec-24','2.4　ヒアリング調査及び現地踏査',' '+ev(c,(h[0]&&h[0].ref)||null)));
  add(H('h4','sec-241','2.4.1　ヒアリング調査'));add('<p class="lb in2">【土地の主な利用履歴確認】</p>');
  add(h.length?h.map((x,i)=>{const same=i>0&&h[i-1].date===x.date&&h[i-1].by===x.by;return `${same?'':`<p class="in3">実施日：${esc(x.date)}<br>実施者：${esc(x.by)}</p>`}${x.target?`<p class="hb">・${esc(x.target)}</p>`:''}${P(`hearing.${i}.text`,x.text,'in1 ti')}`;}).join(''):miss(G.hearing));
  add(H('h4','sec-242','2.4.2　現地踏査',note(attNote(c,/踏査/))));add('<p class="lb in2">【踏査による土地使用状況確認】</p>');
  add(c.siteVisit?`<p class="in3">実施日：${esc(c.siteVisit.date)}<br>実施者：${esc(c.siteVisit.by)}</p>${P('siteVisit.text',c.siteVisit.text,'in1 ti')}`:miss(G.visit));

  /* 2.4.3・3 */
  sheet();
  add(H('h4','sec-243','2.4.3　公的機関の環境情報',' '+ev(c,g.ref)));
  add(`<p class="in1">（1）調査対象地上の法・条例に基づく特定施設の有無</p>${G.fac?miss(G.fac):`<p class="in3 ti">${g.suidaku&&g.suidaku.date?esc(g.suidaku.date)+'に':''}${esc((g.suidaku&&g.suidaku.src)||'（照会先）')}${g.gesui&&g.gesui.src&&g.gesui.src!=='同上'?'及び'+esc(g.gesui.src):''}へ特定有害物質の使用等（製造・使用・処理）に関する公的届出資料の有無を確認した。その回答は以下のとおりである。</p>`}`);
  add(`<table class="yn"><tr><td>１）</td><td>水質汚濁防止法に基づく特定施設のうち特定有害物質を使用している施設</td><td>：${ngv(g.suidaku&&g.suidaku.v)}</td></tr><tr><td>２）</td><td>下水道法に基づく特定施設のうち特定有害物質を使用している施設</td><td>：${ngv(g.gesui&&g.gesui.v)}</td></tr></table>`);
  add(`<p class="in1">（2）土壌・地下水汚染情報</p>${G.zone?miss(G.zone):`<p class="in3 ti">調査対象地及び周辺${g.radius?'（調査対象地から'+esc(g.radius)+'）':''}における土壌汚染対策法第6条及び第11条${(g.ord||[]).length?'、並びに'+g.ord.map(o=>esc(o.name)).join('、'):''}に基づく指定区域の有無について、${esc(g.zoneSrc||'（確認先）')}で確認した。</p>`}`);
  add(`<table class="yn">${[['土壌汚染対策法第6条に基づく要措置区域',g.art6],['土壌汚染対策法第11条に基づく形質変更時要届出区域（人為等由来）',g.art11jin],['土壌汚染対策法第11条に基づく形質変更時要届出区域（自然由来）',g.art11shizen],['土壌汚染対策法第11条に基づく形質変更時要届出区域（水面埋立て土砂由来）',g.art11umetate]].concat((g.ord||[]).map(o=>[`${o.name}${/条例に基づく/.test(o.item)?'':'に基づく'}${o.item.replace(/^条例に基づく/,'に基づく')}`,o.v])).map((r,i)=>`<tr><td>${'１２３４５６７８'[i]}）</td><td>${esc(r[0])}</td><td>：${ngv(r[1])}</td></tr>`).join('')}</table>`);
  add(`<p class="in1">（3）自然由来または公有水面等に関しての情報</p>${miss(G.natural)}${PP('regs.natural',g.natural,'（自然由来・公有水面埋立に関する情報を記入）','in3 ti')}`);
  add(H('h2','sec-3','３．結果まとめ',' '+ev(c,v.ref)));
  add(`<p class="in1">各種資料による利用履歴の調査結果は以下のとおりである。</p><div class="shoken${v.level==='保留'?' pend':''}"><div class="sh">所　見</div><div class="shh">${E('verdict.headline',esc(v.headline))}</div><div class="sht" data-path="verdict.text" contenteditable="true" spellcheck="false">${esc(v.text).replace(/(土壌汚染の(?:可能性|おそれ)[^。、]*と判断(?:する|した|される)。)\s*$/,'<u>$1</u>')}</div></div>`);

  if(neg){
    const k1=subNames(c,1),k2=subNames(c,2),k3=subNames(c,3);const cl=c.classification||{};const lst=a=>a&&a.length?esc(a.join('、')):'該当なし';
    /* 4 */
    sheet();
    add(H('h2','sec-4','４．試料採取等対象物質の選定'));
    add(`<p class="in1 ti">履歴調査の結果、対象地では、特定有害物質の使用及び保管の可能性が否定できなかったため、下記の特定有害物質を試料採取等対象物質とした。</p>`);
    add(`${k1.length?`<p class="in2 sp">○第一種特定有害物質　${uList(k1)}</p>`:''}${k2.length?`<p class="in2 sp">○第二種特定有害物質　${uList(k2)}</p>`:''}${k3.length?`<p class="in2 sp">○第三種特定有害物質　${uList(k3)}</p>`:''}`);
    if((c.extraSubstances||[]).length)add(`<p class="in2 sp">○${esc(c.extraSubstances.join('、'))}　（補足事項）<br>※「${esc(c.extraSubstances.join('、'))}」は、土壌汚染対策法には規定されていないが規定している都道府県がある事から、調査対象物質に反映している。</p>`);
    if(!(k1.length+k2.length+k3.length))add('<p class="todo" contenteditable="false">物質が選定されていません。右の「判断」で懸念の業種を確認するか、物質を選んでください。</p>');
    add(`<p class="in1 ti">法に定められる特定有害物質及び区域の指定に係る基準（以下「指定基準」という。）を表4に示す。</p><p class="tcap">表4　指定基準</p>${stdTable(c)}`);
    /* 5 */
    sheet();
    add(H('h2','sec-5','５．汚染のおそれの由来に応じた区分'));add(H('h3','sec-51','5.1　基本的な考え方'));
    add(`<p class="in2 ti">情報の入手・把握において収集した情報により、特定有害物質の種類ごとに、以下の汚染のおそれの由来に応じた区分ごとに定められた方法により、後の試料採取等を行う区画選定を行うものとし、次の三つの区分に分類するものとした。</p>
     <p class="hang">①調査対象地における試料採取等対象物質がシアン化合物を除く第二種特定有害物質であり、かつ、汚染状態が自然に由来するおそれがあると認められる場合（自然由来盛土等に使用した土壌があると認められる場合を含む。）</p>
     <p class="hang">②調査対象地が公有水面埋立法（大正10年法律第57号）による公有水面埋立て又は干拓事業により造成された土地であり、汚染状態が当該造成時の水面埋立てに用いられた土砂に由来するおそれがあると認められる場合</p>
     <p class="hang">③調査対象地の汚染が自然又は水面埋立てに用いられた土砂以外（以下、「人為等」という。）に由来するおそれがあると認められる場合</p>
     <p class="hang">「汚染のおそれの由来」とは上記の①は自然由来、②は水面埋立て土砂由来、③は人為等由来を示す。</p>`);
    add(H('h3','sec-52','5.2　汚染のおそれの由来の判断'));
    add(`<p class="in2 ti">調査対象地では、自然由来及び水面埋立て土砂由来に該当する情報が無く、人為等由来に該当する情報が確認された。</p>
     <p class="in2 sp">①自然由来<br>　⇒該当無し</p><p class="in2 sp">②水面埋立て土砂由来<br>　⇒該当無し</p>
     <p class="in2 sp">③人為等由来${k1.length?`<br>　⇒第一種特定有害物質　（全${k1.length}物質）<br>　　${uList(k1)}`:''}${k2.length?`<br>　⇒第二種特定有害物質　（全${k2.length}物質）<br>　　${uList(k2)}`:''}${k3.length?`<br>　⇒第三種特定有害物質　（全${k3.length}物質）<br>　　${uList(k3)}`:''}</p>`);
    /* 6.1・6.2 */
    sheet();
    add(H('h2','sec-6','６．土壌汚染のおそれの区分の分類'));add(H('h3','sec-61','6.1　基本的な考え方'));
    add(`<p class="in2 ti">情報の入手・把握において収集した情報により、調査対象地を土壌汚染のおそれがあると認められる特定有害物質の種類ごとに次の三つの区分に分類した。</p>
     <p class="in2 sp">(1) 土壌汚染が存在するおそれがないと認められる土地</p><p class="in2 sp">(2) 土壌汚染が存在するおそれが少ないと認められる土地</p><p class="in2 sp">(3) 土壌汚染が存在するおそれが比較的多いと認められる土地</p>`);
    add(H('h3','sec-62','6.2　汚染のおそれが生じた場所の位置'));
    add(P('clsBasis',c.clsBasis||'調査対象地における汚染のおそれが生じた場所の位置は、過去に盛土による土地地盤高の改変の記録が存在しないこと、関連する情報及び資料等が存在しないことから、現状の地表面地盤面からと判断した。','in2 ti'));
    /* 6.3 */
    let n=0;
    [[1,k1],[2,k2],[3,k3]].filter(x=>x[1].length).forEach(x=>{n++;sheet();
      if(n===1)add(H('h3','sec-63','6.3　土壌汚染のおそれの区分の分類'));
      add(`<h4>6.3.${n}　${KIND[x[0]]}</h4><p class="in3">${uList(x[1])}</p><p class="lb">【現況地表面】</p>
       <p class="in1 sp">(1)土壌汚染が存在するおそれがないと認められる土地<br>　⇒${lst(cl.none)}</p><p class="in1 sp">(2)土壌汚染が存在するおそれが少ないと認められる土地<br>　⇒${lst(cl.low)}</p><p class="in1 sp">(3)土壌汚染が存在するおそれが比較的多いと認められる土地<br>　⇒${lst(cl.high)}</p>
       ${G.kozu?miss(G.kozu,'fig tall'):'<div class="figbox tall" contenteditable="false">公図に区分を着色した図を差し込み<br>（緑：汚染の恐れが少ない土地／赤：汚染の恐れが多い土地）</div>'}<p class="fc l">図 6.3.${n}　土壌汚染のおそれの区分（${KIND[x[0]]}）現況地表面</p>`);});
  }

  /* 付録（原本にない、本システムの判定と出典） */
  sheet('app');
  add(H('h2','sec-app1','付録１　適用条項の判定'));
  add(`<div class="pos" contenteditable="false"><p class="in1 ti">${esc(positionText(c))}</p>
   <table class="reg jt"><thead><tr><th>根拠</th><th>条項</th><th>内容</th><th>判定</th><th>判定の理由</th></tr></thead><tbody>${J.map(r=>`<tr><td class="c">${r.src}</td><td>${esc(r.law.replace(/（.*?）/g,''))} ${esc(r.art)}${r.cite&&r.cite.verified?'':'<span class="unv">出典未確認</span>'}</td><td>${esc(r.title)}</td><td class="c nw${r.st[0]==='yes'||r.st[0]==='maybe'||r.st[0]==='todo'?' b':''}">${esc(r.st[1])}</td><td>${esc(r.why)}</td></tr>`).join('')}</tbody></table>
   ${ords.filter(o=>(o.extraSubstances||[]).length).map(o=>`<p class="in1">※ ${esc(o.name.replace(/（.*?）/g,''))}は、法の特定有害物質26物質に加えて「${esc(o.extraSubstances.map(x=>x.replace(/（.*$/,'')).join('、'))}」を対象とする。</p>`).join('')}${ords.filter(o=>o.desk&&o.rules.length).slice(0,1).map(o=>`<p class="in1 sm">窓口：${esc((o.desk||'').slice(0,110))}</p>`).join('')}</div>`);
  if(neg){add(H('h2','sec-app2','付録２　対象物質の選定根拠'));
    add(`<div class="why" contenteditable="false">${openConcerns(c).map(x=>{const i=INDBY[x.industry];return i?`<p class="in1">・${esc(x.use)}（${esc(i.label)}）<br>${esc(i.why)}<br><span class="sm">根拠：${esc(i.src.type==='none'?'未登録（担当者の選定）':i.src.cite)}</span>${i.official?`<br><span class="sm">公式統計：${esc(i.official.text)}</span>`:''}</p>`:'';}).join('')||'<p class="in1">懸念として扱う利用履歴は登録されていません。</p>'}</div>`);}
  sheet('app');
  add(H('h2','sec-src',`付録${neg?'３':'２'}　出典一覧`));
  add(`<div class="srcs" contenteditable="false">${S.map(x=>`<div class="src"><span class="n">${x.n}</span><div>${esc(x.title)}<span class="k">（${esc(x.kind)}）</span>${x.verified?(x.url?'<span class="ok">公式出典で確認</span>':''):x.own?'<span class="ng">社内の既往報告書</span>':'<span class="ng">出典未確認</span>'}<br>${esc(x.detail||'')}${x.url?`<br><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.url)}</a>`:''}${x.checkedOn&&x.url?`　${esc(x.checkedOn)} 確認`:''}</div></div>`).join('')}</div>`);

  /* 添付資料 */
  sheet('attp',false);
  const grp=k=>(c.docs||[]).filter(d=>d.cls===k);
  add(`<h2 class="atth" id="sec-att">添　付　資　料</h2><table class="attl">${['一般公表資料','公的資料','私的資料'].map(k=>`<tr class="hd"><th>${k}</th></tr>${grp(k).length?grp(k).map((d,i)=>`<tr><td>${'ABCDEFGHIJ'[i]}）${esc(d.kind)}${d.pages?`<span class="ev att" contenteditable="false" data-p="${String(d.pages).split('–')[0]}" data-doc="">p.${esc(d.pages)}</span>`:''}</td></tr>`).join(''):'<tr><td>―</td></tr>'}`).join('')}</table>`);

  /* ── 表紙・目次を前に付けて出力 ── */
  const toc=tocOf(c).map(t=>`<a href="#${t[0]}" class="l${t[2]}" data-go="${t[0]}"><span>${t[1]}</span><i></i><b>${pageOf[t[0]]||''}</b></a>`).join('');
  const rowsN=Math.max(4,...['一般公表資料','公的資料','私的資料'].map(k=>grp(k).length));
  const cell=(k,i)=>{const d=grp(k)[i];return d?'ABCDEFGHIJ'[i]+'）'+esc(d.kind):'―';};
  const front=`<section class="sheet cover" id="sec-cover">${gaps.length?`<div class="draft" contenteditable="false">下書き　未取得の項目 ${gaps.length}件（本文の赤枠）</div>`:''}<div class="sbody"><div class="ct">${esc(c.title)}　地歴調査</div><div class="ct2">報告書</div><div class="cd">${E('reportDate',esc(c.reportDate||toWareki(new Date())))}</div><div class="co">${esc(c.org.name)}</div></div></section>
   <section class="sheet tocp"><div class="sbody"><h2 class="tc">目　　　次</h2><div class="toc">${toc}</div><p class="lb atl">【添付資料】</p><table class="att"><thead><tr><th>一般公表資料</th><th>公的資料</th><th>私的資料</th></tr></thead><tbody>${Array.from({length:rowsN},(_,i)=>`<tr><td>${cell('一般公表資料',i)}</td><td class="c">${cell('公的資料',i)}</td><td>${cell('私的資料',i)}</td></tr>`).join('')}</tbody></table></div></section>`;
  return front+sheets.map(sh=>`<section class="sheet ${sh.cls}"><div class="sbody">${sh.body}</div>${sh.notes.length?`<div class="fnotes">${sh.notes.map(nn=>`<div data-n="${nn[0]}"><sup>${nn[0]}</sup><span>${nn[1]}</span></div>`).join('')}</div>`:''}${sh.page?`<div class="pno">${sh.page}</div>`:''}</section>`).join('');
}
