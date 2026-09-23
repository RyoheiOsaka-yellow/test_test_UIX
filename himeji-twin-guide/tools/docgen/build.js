const fs=require('fs'), path=require('path');
const D=require('docx');
const {Document,Packer,Paragraph,TextRun,ImageRun,Table,TableRow,TableCell,WidthType,BorderStyle,ShadingType,AlignmentType,HeadingLevel,PageBreak,Header,Footer,PageNumber,LevelFormat,VerticalAlign,TableLayoutType}=D;
const C=require('./content');
const man=JSON.parse(fs.readFileSync(path.join(__dirname,'manifest_all.json'),'utf8'));
const FONT='Yu Gothic';
const TEAL='0D6F64', INK='1D2A33', SUB='5B6B76', PINK='C2386B';
const PAGE_W=11906, PAGE_H=16838, MARGIN=1020, CW=PAGE_W-2*MARGIN; // content width DXA
const PX_PER_DXA=96/1440; const CWPX=Math.floor(CW*PX_PER_DXA); // ~657px
const FULLW=580; // 全画面キャプチャの表示幅（1ページに2枚収まる幅）
const run=(t,o={})=>new TextRun({text:t,font:FONT,...o});
const P=(children,o={})=>new Paragraph({children:Array.isArray(children)?children:[children],spacing:{after:80,line:320},...o});
const txt=(t,o={},po={})=>P([run(t,o)],po);
const H1=(t)=>new Paragraph({heading:HeadingLevel.HEADING_1,pageBreakBefore:true,children:[run(t)],spacing:{before:0,after:200},border:{bottom:{style:BorderStyle.SINGLE,size:12,color:TEAL,space:6}}});
const H2=(t)=>new Paragraph({heading:HeadingLevel.HEADING_2,children:[run(t)],spacing:{before:260,after:100},keepNext:true});
let listInst=0;
const bullets=(arr)=>arr.map(t=>new Paragraph({numbering:{reference:'bul',level:0},children:richRuns(t),spacing:{after:60,line:310}}));
const steps=(arr)=>{listInst++; const inst=listInst; return arr.map(t=>new Paragraph({numbering:{reference:'num',level:0,instance:inst},children:richRuns(t),spacing:{after:60,line:310}}));};
// 「」内を強調しない単純なテキスト。先頭の①〜⑦などは太字
function richRuns(t){ const m=t.match(/^([①-⑳][^：:]*[：:])(.*)$/)||t.match(/^([^：]{1,24}：)(.*)$/); if(m) return [run(m[1],{bold:true}),run(m[2])]; return [run(t)]; }
const noBorder={style:BorderStyle.NONE,size:0,color:'FFFFFF'};
const noBorders={top:noBorder,bottom:noBorder,left:noBorder,right:noBorder,insideHorizontal:noBorder,insideVertical:noBorder};
const cellBorder={style:BorderStyle.SINGLE,size:4,color:'C9D3DA'};
const cellBorders={top:cellBorder,bottom:cellBorder,left:cellBorder,right:cellBorder};
function callout(title, items, fill, color){
  const kids=[new Paragraph({children:[run(title,{bold:true,color})],spacing:{after:60}}), ...items.map(t=>new Paragraph({numbering:{reference:'bul',level:0},children:richRuns(t),spacing:{after:40,line:300}}))];
  return new Table({width:{size:CW,type:WidthType.DXA},columnWidths:[CW],rows:[new TableRow({children:[new TableCell({width:{size:CW,type:WidthType.DXA},shading:{fill,type:ShadingType.CLEAR,color:'auto'},margins:{top:140,bottom:120,left:200,right:200},borders:{top:{style:BorderStyle.SINGLE,size:4,color:fill},bottom:{style:BorderStyle.SINGLE,size:4,color:fill},right:{style:BorderStyle.SINGLE,size:4,color:fill},left:{style:BorderStyle.SINGLE,size:24,color}},children:kids})]})]});
}
function dataTable(head, rows, widths){
  const tot=widths.reduce((a,b)=>a+b,0); const ws=widths.map(w=>Math.round(w/tot*CW)); ws[ws.length-1]=CW-ws.slice(0,-1).reduce((a,b)=>a+b,0);
  const mk=(cells,hdr)=>new TableRow({tableHeader:hdr,cantSplit:true,children:cells.map((c,i)=>new TableCell({width:{size:ws[i],type:WidthType.DXA},borders:cellBorders,shading:hdr?{fill:'E6F2F0',type:ShadingType.CLEAR,color:'auto'}:undefined,margins:{top:60,bottom:60,left:100,right:100},verticalAlign:VerticalAlign.CENTER,children:[new Paragraph({children:[run(String(c),{bold:hdr,size:18,color:hdr?TEAL:INK})],spacing:{after:0,line:280}})]}))});
  return new Table({width:{size:CW,type:WidthType.DXA},columnWidths:ws,rows:[mk(head,true),...rows.map(r=>mk(r,false))]});
}
const spacer=(a=120)=>new Paragraph({children:[],spacing:{after:a}});
// ---- figures ----
let figNo={};
function figCaption(m, num, compact){
  const out=[new Paragraph({keepLines:true,keepNext:true,children:[run(`図${num}　`,{bold:true,color:TEAL,size:compact?17:19}),run(m.title,{bold:true,size:compact?17:19})],spacing:{before:60,after:compact?20:30,line:280}})];
  if(m.desc && !compact) out.push(new Paragraph({keepNext:true,keepLines:true,children:[run(m.desc,{size:18,color:INK})],spacing:{after:30,line:290}}));
  const meta=[]; if(m.how) meta.push('操作：'+m.how); meta.push('ファイル：'+m.file);
  out.push(new Paragraph({children:[run(meta.join('　｜　'),{size:15,color:SUB})],spacing:{after:compact?60:220,line:260}}));
  if(m.desc && compact) out.splice(1,0,new Paragraph({children:[run(m.desc,{size:16,color:INK})],spacing:{after:20,line:260}}));
  return out;
}
function img(m, wpx){ const h=Math.round(wpx*m.h/m.w); return new ImageRun({type:m.dtype,data:fs.readFileSync(m.doc),transformation:{width:wpx,height:h},altText:{title:m.title,description:m.desc||m.title,name:path.basename(m.doc)}}); }
function nextNum(ch){ figNo[ch]=(figNo[ch]||0)+1; return `${ch}-${figNo[ch]}`; }
function figures(list, ch){
  const out=[]; let i=0;
  while(i<list.length){
    const m=list[i]; const asp=m.w/m.h; const cssW=m.w/1.5;
    if(m.kind==='full' || asp>=1.25){
      const w=m.kind==='full'?FULLW:Math.min(CWPX, Math.round(cssW*1.15));
      out.push(new Paragraph({alignment:AlignmentType.CENTER,keepNext:true,children:[img(m,w)],spacing:{before:80,after:40}}));
      out.push(...figCaption(m,nextNum(ch),false)); i++; continue;
    }
    // group tall crops
    const k=asp<0.5?3:2; const group=[m]; let j=i+1;
    while(j<list.length && group.length<k && list[j].kind!=='full' && list[j].w/list[j].h<1.25) group.push(list[j++]);
    const colW=Math.floor(CW/k); const ws=Array(k).fill(colW); ws[k-1]=CW-colW*(k-1);
    const cells=group.map((g,gi)=>{ const maxW=Math.floor(ws[gi]*PX_PER_DXA)-14; let w=Math.min(maxW, Math.round(g.w/1.5*1.1)); let h=w*g.h/g.w; if(h>560){ w=Math.round(560*g.w/g.h); }
      return new TableCell({width:{size:ws[gi],type:WidthType.DXA},borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder},margins:{left:60,right:60},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[img(g,w)],spacing:{before:60,after:40}}),...figCaption(g,nextNum(ch),true)]}); });
    while(cells.length<k) cells.push(new TableCell({width:{size:ws[cells.length],type:WidthType.DXA},borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder},children:[new Paragraph({children:[]})]}));
    out.push(new Table({width:{size:CW,type:WidthType.DXA},columnWidths:ws,borders:noBorders,rows:[new TableRow({cantSplit:true,children:cells})]}));
    out.push(spacer(160)); i=j;
  }
  return out;
}
// ---- build ----
const body=[];
// cover
const hero=man.find(m=>m.id==='00-02');
body.push(new Paragraph({spacing:{before:1400,after:0},children:[run('社内説明用資料',{size:22,color:TEAL,bold:true})]}));
body.push(new Paragraph({spacing:{before:160,after:120},children:[run(C.meta.title,{size:44,bold:true,color:INK})]}));
body.push(new Paragraph({spacing:{after:360},children:[run(C.meta.subtitle,{size:30,color:INK})]}));
if(hero) body.push(new Paragraph({alignment:AlignmentType.CENTER,children:[img(hero,CWPX)],spacing:{after:300}}));
body.push(txt(C.meta.target,{size:19,color:SUB}));
body.push(txt(C.meta.date,{size:19,color:SUB},{spacing:{after:300}}));
body.push(callout('ご注意',[C.meta.notice],'FDF5E8','945A05'));
// TOC (manual)
body.push(new Paragraph({pageBreakBefore:true,children:[run('目次',{size:32,bold:true,color:INK})],spacing:{after:240},border:{bottom:{style:BorderStyle.SINGLE,size:12,color:TEAL,space:6}}}));
const toc=[['1','はじめに（目的・概要・データの前提・機能一覧・操作導線マップ・デモの流れ）']];
Object.values(C.sections).forEach(s=>toc.push([s.ch,s.title]));
toc.push(['付録','A. キーボード・マウス操作一覧　B. 用語集　C. よくある質問　D. スクリーンショット一覧']);
toc.forEach(([n,t])=>body.push(new Paragraph({children:[run(n==='付録'?'付録　':`${n}.　`,{bold:true,color:TEAL}),run(t)],spacing:{after:110,line:320},indent:{left:0}})));
body.push(spacer(200));
body.push(callout('ZIP（スクリーンショット集）との対応',['各図のキャプション末尾の「ファイル：」がZIP内のパスです（例：01_L0/01-01_L0_overview.jpg）。','ZIP内の INDEX.html をブラウザで開くと、全画像をサムネイルと説明つきで一覧できます。','赤枠・番号は操作箇所（どこをクリックするか）を示すために撮影時に重ねた注釈です。'],'EEF4FD','1F5BB0'));
// Chapter 1
const I=C.intro;
body.push(H1('1. はじめに'));
body.push(H2('1.1 本資料の目的')); I.purpose.forEach(t=>body.push(txt(t)));
body.push(H2('1.2 ツールの概要')); I.overview.forEach(t=>body.push(txt(t)));
body.push(H2('1.3 データの前提（説明時に必ず伝えること）')); body.push(callout('数値の扱い',I.data,'FDF5E8','945A05'));
body.push(H2('1.4 動作環境')); body.push(...bullets(I.env));
body.push(H2('1.5 機能一覧')); body.push(dataTable(['区分','機能','開き方','何が分かるか','章'],I.functions,[9,20,24,40,6]));
body.push(H2('1.6 画面遷移・操作導線マップ'));
body.push(txt('どのボタンから、どの画面・機能へ進むかを1枚にまとめた図です。①階層（L0→L1→L2 のドリルダウン）、②地図に重ねる分析レイヤー、③ダイアログ・分析ワークスペースの3系統で整理しています。'));
const nav={title:'画面遷移・操作導線マップ',desc:'',file:'00_basic/00-00_navigation_map.png',doc:path.join(__dirname,'..','diagram','navmap.png'),dtype:'png',w:2400,h:1272,kind:'full'};
body.push(new Paragraph({alignment:AlignmentType.CENTER,keepNext:true,children:[img(nav,CWPX)],spacing:{before:80,after:40}}));
body.push(...figCaption(nav,nextNum('1'),false));
body.push(H2('1.7 おすすめのデモの流れ（約10分）'));
body.push(dataTable(['#','画面','見せ方・話すこと'],I.demo.map((d,i)=>[String(i+1),d[0],d[1]]),[5,22,73]));
// Chapters
for(const [sec,s] of Object.entries(C.sections)){
  body.push(H1(`${s.ch}. ${s.title}`));
  if(s.lead) body.push(txt(s.lead));
  if(s.open){ body.push(H2('開き方（操作導線）')); body.push(...steps(s.open)); }
  if(s.view){ body.push(H2(sec==='09_proposal'||sec==='10_db'?'表示される内容':'画面の見方')); body.push(...bullets(s.view)); }
  if(s.modes){ body.push(H2('人流の表現（8種類）')); body.push(dataTable(['表現','内容','向いている用途'],s.modes,[18,46,36])); }
  if(s.tabs){ body.push(H2('タブ構成')); body.push(dataTable(['タブ','内容'],s.tabs,[20,80])); }
  if(s.tours){ body.push(H2('6方面のルート')); body.push(dataTable(['方面','交通手段','所要','見どころ'],s.tours,[30,30,10,30])); }
  if(s.panel){ body.push(H2('分析パネルの内容')); body.push(...bullets(s.panel)); }
  if(s.ops){ body.push(H2('基本操作')); body.push(...bullets(s.ops)); }
  if(s.keys){ body.push(H2('キーボードショートカット')); body.push(dataTable(['キー','動作'],s.keys,[22,78])); }
  if(s.tips){ body.push(spacer(80)); body.push(callout('説明のポイント',s.tips,'E9F7F5',TEAL)); }
  if(s.cautions){ body.push(spacer(80)); body.push(callout('注意点',s.cautions,'FDF5E8','945A05')); }
  const list=man.filter(m=>m.sec===sec);
  if(list.length){ body.push(H2(`画面キャプチャ（${list.length}点）`)); body.push(...figures(list,s.ch)); }
}
// Appendix
body.push(H1('付録'));
body.push(H2('A. キーボード・マウス操作一覧'));
body.push(dataTable(['操作','動作'],[['左ドラッグ','地図を掴んで移動（回転モード時は回転）'],['右ドラッグ／Shift＋ドラッグ','回転・傾き'],['ホイール','カーソル位置へズーム'],['Shift＋ホイール','傾き'],['ダブルクリック','その地点へ接近'],['タッチ 1本指／2本指','移動／移動・拡大縮小・ひねり回転'],...C.sections['00_basic'].keys],[30,70]));
body.push(H2('B. 用語集')); body.push(dataTable(['用語','説明'],C.glossary,[22,78]));
body.push(H2('C. よくある質問（社内向け）')); body.push(dataTable(['質問','回答'],C.faq,[32,68]));
body.push(H2('D. スクリーンショット一覧（ZIP収録）'));
body.push(txt(`ZIPには以下の${man.length+1}点を機能別フォルダで収録しています（全画面は2400×1500px のJPEG、パネル拡大は PNG）。`,{size:19}));
body.push(dataTable(['No.','ファイル','内容'],[['00-00','00_basic/00-00_navigation_map.png','画面遷移・操作導線マップ'],...man.map(m=>[m.id,m.file,m.title])],[8,47,45]));
const doc=new Document({
  creator:'XBUILD', title:C.meta.title+' '+C.meta.subtitle, description:'機能説明資料（社内説明用）',
  styles:{default:{document:{run:{font:{ascii:FONT,eastAsia:FONT,hAnsi:FONT,cs:FONT},size:20,color:INK}}},
    paragraphStyles:[
      {id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',quickFormat:true,run:{size:32,bold:true,color:INK,font:{ascii:FONT,eastAsia:FONT,hAnsi:FONT}},paragraph:{spacing:{before:0,after:200},outlineLevel:0}},
      {id:'Heading2',name:'Heading 2',basedOn:'Normal',next:'Normal',quickFormat:true,run:{size:24,bold:true,color:TEAL,font:{ascii:FONT,eastAsia:FONT,hAnsi:FONT}},paragraph:{spacing:{before:260,after:100},outlineLevel:1}},
    ]},
  numbering:{config:[
    {reference:'bul',levels:[{level:0,format:LevelFormat.BULLET,text:'●',alignment:AlignmentType.LEFT,style:{run:{color:TEAL,size:14},paragraph:{indent:{left:420,hanging:280}}}}]},
    {reference:'num',levels:[{level:0,format:LevelFormat.DECIMAL,text:'%1.',alignment:AlignmentType.LEFT,style:{run:{color:TEAL,bold:true},paragraph:{indent:{left:420,hanging:320}}}}]},
  ]},
  sections:[{
    properties:{page:{size:{width:PAGE_W,height:PAGE_H},margin:{top:1080,bottom:1000,left:MARGIN,right:MARGIN,header:560,footer:500}},titlePage:true},
    headers:{default:new Header({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[run(C.meta.title+'　機能説明資料（社内説明用）',{size:15,color:SUB})],border:{bottom:{style:BorderStyle.SINGLE,size:4,color:'C9D3DA',space:4}}})]}),first:new Header({children:[new Paragraph({children:[]})]})},
    footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({children:['— ',PageNumber.CURRENT,' —'],font:FONT,size:16,color:SUB})]})]}),first:new Footer({children:[new Paragraph({children:[]})]})},
    children:body }]
});
const outp=process.argv[2]||path.join(__dirname,'out.docx');
Packer.toBuffer(doc).then(b=>{fs.writeFileSync(outp,b);console.log('wrote',outp,(b.length/1e6).toFixed(1)+'MB');});
