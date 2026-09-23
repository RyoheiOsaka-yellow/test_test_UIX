const G={};
const MID="(()=>{const st=toXZ(34.8273,134.6907);return {x:(st.x+CASTLE.x)/2,z:(st.z+CASTLE.z)/2};})()";
async function axisCam(H,r=2300,phi=0.8,th=-0.35,dur=700){ await H.x(`(()=>{const m=${MID};flyTo(new THREE.Vector3(m.x,TH(m.x,m.z),m.z),${r},${phi},${th},${dur});})()`); await H.settle(dur+2500); }
async function secShot(H,page,S,id,slug,title,desc,text,how){
  const r=await page.evaluate(t=>{const secs=[...document.querySelectorAll('#panel-body .sec')];const s=secs.find(e=>(e.querySelector('.sec-t')?.textContent||'').includes(t));if(!s)return null;s.scrollIntoView({block:'start'});const a=s.getBoundingClientRect(),p=document.getElementById('panel').getBoundingClientRect();const top=Math.max(a.top,p.top),bot=Math.min(a.bottom,p.bottom);return {x:p.left+2,y:top-4,width:p.width-4,height:bot-top+8};},text);
  if(!r){console.warn('sec miss',text);return;} await H.wait(300);
  await H.shot(S,id,slug,title,desc,{clip:r,png:true,how});
}
/* ---------- E: 人流の表現モード ---------- */
G.E=async(H,page)=>{
  const S='04_display';
  await H.hideToast(); await H.setTime('12:00'); await axisCam(H);
  const modes=[
    ['grid','グリッド','グリッド（正方形メッシュ）','5〜250mの正方形セルに滞在人数を集計。セルの高さ＝人数（低密度も見やすい非線形表示）、色＝人口密度（人/ha）。上位3地点には人数ラベルを表示。'],
    ['hex','ヘックス','ヘックス（六角形メッシュ）','六角形セルで集計。方向による偏りが少なく、滞留の広がりを滑らかに把握できる。'],
    ['column','柱','柱','セルの中心に柱を立てて人数を表現。どこに何人いるかを一目で比較しやすい。'],
    ['heat','ヒート','ヒートマップ','来訪者の推計位置を半径内で平滑化した相対密度。ぼかし半径・強調度を調整でき、混雑の「面」をつかむのに向く。'],
    ['point','点群','点群（粒子）','来訪者を粒子で表示（1点＝最大8人）。細い尾が進行方向を示し、駅→大手前通り→姫路城の人の流れ（導線）がそのまま見える。'],
    ['contour','等高線','等高線','一定密度以上の混雑エリアの輪郭を等高線で表示。混雑範囲の広がり・縮小を比較しやすい。'],
    ['trips','軌跡','軌跡（移動軌跡ライン）','来訪者ごとの移動軌跡を線で表示。時間窓分だけ頭が明るく尾が消える「動く軌跡」で、道路上の導線を再現する。'],
    ['flow','OD動線','OD動線（Origin → Destination）','ゲート→姫路城→回遊先→帰路の移動（レグ）をアークで集計。太さ・色＝人数、帯の流れ＝方向。'],
  ];
  let i=1;
  for(const [m,label,t,d] of modes){
    if(m==='trips'||m==='flow') await H.setTime('15:00');
    await H.click(`#studio [data-quick-mode="${m}"]`); await H.settle(m==='heat'||m==='contour'?4500:3500);
    await H.hl([{sel:`#studio [data-quick-mode="${m}"]`,n:'1',note:`人流の表現「${label}」`,pos:'left',w:200}]);
    await H.shot(S,`04-${String(i).padStart(2,'0')}`,`mode_${m}`,`人流の表現：${t}`,d,{how:`地図の表示設定 → 人流の表現「${label}」`}); i++;
  }
  // trips: cumulative + space-time
  await H.x("setFlowMode('trips'); setTripsAnim(false); renderPanel();"); await H.settle(4000);
  await H.shot(S,'04-09','trips_cumulative','軌跡：累積（1日分）','「累積」に切り替えると、その時刻までの全来訪者の移動軌跡が重なり、よく使われる道（主要導線）が太く浮かび上がる。点＝城・回遊先・宿泊での滞留地点。',{how:'表示設定 → 詳細「軌跡ライン」→ 累積'});
  await H.x("TRAJ.mode='time'; trajRelayout(); renderPanel();"); await axisCam(H,2600,1.2,-0.35);
  await H.shot(S,'04-10','trips_space_time','軌跡：時空間キューブ','「時空間」モードでは高さ＝時刻（上に行くほど遅い時間）。いつ・どこを通り・どこで滞留したかを1枚の3D図で表す。',{how:'表示設定 → 詳細「軌跡ライン」→ 時空間'});
  await H.x("TRAJ.mode='ground'; trajRelayout(); setTripsAnim(true);"); await H.setTime('12:00');
  // resolution
  await H.click('#studio [data-quick-mode="grid"]'); await H.settle(1500);
  for(const [res,cam,t,d,id] of [[5,[900,0.85],'5m','最小5mセル。大手門〜三の丸など、通り・広場単位の細かな滞留まで表示（集計単位の細分化であり、元データの精度が上がるわけではない）。','04-11'],[50,[2300,0.8],'50m','50mセル。街区単位で滞留の分布を把握。','04-12'],[250,[4200,0.8],'250m','250mセル（地域メッシュ相当）。市内全体の滞留傾向を粗く把握。','04-13']]){
    await H.click(`#studio [data-quick-res="${res}"]`); await H.wait(800);
    if(res===5) await H.x(`flyTo(new THREE.Vector3(CASTLE.x-40,TH(CASTLE.x-40,CASTLE.z+300),CASTLE.z+300),${cam[0]},${cam[1]},-0.35,700)`); else await axisCam(H,cam[0],cam[1]);
    await H.settle(3500);
    await H.hl([{sel:`#studio [data-quick-res="${res}"]`,n:'1',note:`メッシュの細かさ「${t}」`,pos:'left',w:200}]);
    await H.shot(S,id,`mesh_res_${res}m`,`メッシュの細かさ：${t}`,d,{how:`表示設定 → メッシュの細かさ「${t}」`});
  }
  await H.click('#studio [data-quick-res="10"]'); await axisCam(H);
  // color by segment
  await H.x("MESH.color='seg'; meshRebuildShape(); MESH.dirty=true; paintMesh(); renderPanel(); precisionRefresh();"); await H.settle(3500);
  await H.hl([{sel:'#precision-legend',n:'1',note:'色＝主セグメント（海外/国内/近隣）',pos:'right',w:240}]);
  await H.shot(S,'04-14','mesh_color_segment','色分け：来訪者属性（主セグメント）','セルの色を人口密度から「来訪者属性」に切り替えると、各セルで最も多いセグメント（青＝インバウンド、緑＝国内、ピンク＝県内・近隣）で色分けされる。',{how:'表示設定 → 詳細「高精細メッシュ」→ 来訪者属性'});
  await H.x("MESH.color='density'; MESH.style='2d'; meshRebuildShape(); MESH.dirty=true; paintMesh(); renderPanel(); precisionRefresh();"); await H.settle(3500);
  await H.shot(S,'04-15','mesh_flat_2d','メッシュの平面表示','「平面」にすると高さを付けず色だけで密度を表示。2D（真上）視点と組み合わせると地図資料として使いやすい。',{how:'表示設定 → 詳細「高精細メッシュ」→ 平面'});
  await H.x("MESH.style='3d'; meshRebuildShape(); MESH.dirty=true; paintMesh(); renderPanel(); precisionRefresh();");
  // city styles
  for(const [st,label,t,d,id] of [['solid','立体','市街地の表現：立体','建物をソリッドな立体で表示。人流の柱・メッシュとの位置関係が分かりやすい。','04-16'],['cloud','点群','市街地の表現：点群','市街地・姫路城を点群（デジタルレイヤー）で表示。背景を控えめにして人流を際立たせる。','04-17']]){
    await H.click(`[data-city-style="${st}"]`); await H.settle(4500);
    await H.hl([{sel:`[data-city-style="${st}"]`,n:'1',note:`市街地の表現「${label}」`,pos:'left',w:200}]);
    await H.shot(S,id,`city_style_${st}`,t,d,{how:`表示設定 → 市街地・姫路城の表現「${label}」`});
  }
  await H.click('[data-city-style="hybrid"]'); await H.click('[data-surface-tint="cool"]'); await H.settle(4500);
  await H.ev(()=>document.querySelector('[data-surface-tint="cool"]').scrollIntoView({block:'center'})); await H.wait(300);
  await H.hl([{sel:'[data-surface-tint="cool"]',n:'1',note:'点群の仕上げ「解析色」',pos:'left',w:200}]);
  await H.shot(S,'04-18','surface_tint_analysis','点群の仕上げ：解析色','点群の色を自然色から解析色に変更。背景をモノトーン寄りにして人流の色を読み取りやすくする。',{how:'表示設定 → 点群の仕上げ「解析色」'});
  await H.click('[data-surface-tint="natural"]');
  await H.ev(()=>{document.getElementById('studio').scrollTop=0;});
  await H.pieces(S,'04-19','studio_panel','地図の表示設定パネル','右側の「地図の表示設定」。人流の表現（8種）、メッシュの細かさ（5〜250m）、高さ倍率・不透明度・セル間隔、色スケール固定、集中地点へ移動、CSV保存、市街地の表現、表示の確認・視点、比較条件の保存/復元などをまとめて操作する。','#studio','#studio',{max:4});
};
/* ---------- F: OD分析・観光導線・時間推移 ---------- */
G.F=async(H,page)=>{
  await H.hideToast(); await H.setTime('10:30');
  let S='05_OD';
  await H.click('#od-toggle'); await H.showToast(); await H.x("flyTo(new THREE.Vector3(STN.x,TH(STN.x,STN.z),STN.z-600),5200,0.78,-0.35,700)"); await H.settle(3500);
  await H.hl([{sel:'#od-toggle',n:'1',note:'「◎ OD分析」をクリック',pos:'below'}]);
  await H.shot(S,'05-01','OD_1030','OD分析：到着ピーク（10:30）','ガウスKDE（滞留密度の山）とODアークを重ねて表示。10:30は駅・ICに到着の山ができ、姫路城へ向かうアークが太い。',{how:'ヘッダー「◎ OD分析」'});
  await H.hideToast();
  for(const [tm,id,t,d] of [['13:00','05-02','OD分析：城内滞留ピーク（13:00）','昼は質量（人の山）が姫路城に移動し、城内滞留がピークになる。'],['15:30','05-03','OD分析：市内回遊（15:30）','午後は商店街・好古園など周辺へ分散。回遊先へのアークが現れる。'],['17:30','05-04','OD分析：帰路（17:30）','夕方は駅・ICへ戻るアークが太くなり、帰路ピークを迎える。'],['21:00','05-05','OD分析：夜間（21:00）','夜間は宿泊施設の集積地だけに山が残る（市内宿泊者の分布）。']]){
    await H.setTime(tm); await H.settle(4000); await H.shot(S,id,`OD_${tm.replace(':','')}`,t,d); }
  await H.setTime('13:00'); await H.settle(1000);
  await secShot(H,page,S,'05-06','OD_panel_section','OD分析の解説（分析パネル）','分析パネル内のOD分析セクション。山の高さ＝人数×正規カーネルの重ね合わせ、弧＝OD流（太さ＝シェア）という見方の説明。','OD分析');
  await H.click('#od-toggle'); await H.settle(1000);
  S='06_tour';
  await H.setTime('10:30');
  await H.click('#tour-toggle'); await H.showToast(); await H.x("flyTo(new THREE.Vector3(STN.x,TH(STN.x,STN.z),STN.z-1500),15500,0.62,-0.2,700)"); await H.settle(4000);
  await H.hl([{sel:'#tour-toggle',n:'1',note:'「観光導線」をクリック',pos:'below'}]);
  await H.shot(S,'06-01','tour_overview','観光導線：姫路駅ハブから6方面','姫路駅をハブに、書写山圓教寺・太陽公園/広峯神社・手柄山・姫路港（家島/小豆島）・松原八幡神社・姫路セントラルパークの6方面への送客導線を矢羽付きのルートで表示。',{how:'ヘッダー「観光導線」'});
  await H.hideToast();
  await secShot(H,page,S,'06-02','tour_panel','観光導線の一覧（分析パネル）','各方面の交通手段・所要時間・見どころ。行をクリックすると、その方面へ視点が移動する。','観光導線');
  for(const [n,id,slug,t] of [[0,'06-03','tour_shosha','書写山圓教寺（神姫バス＋ロープウェイ 約35分）'],[2,'06-04','tour_tegarayama','手柄山中央公園・水族館（山陽電鉄 約15分）'],[3,'06-05','tour_port','姫路港 → 家島諸島・小豆島（バス＋高速船 約60分）']]){
    await page.evaluate(n=>{const b=document.querySelector(`[data-tr="${n}"]`); b.scrollIntoView({block:'center'}); b.click();}, n); await H.settle(4200);
    await page.evaluate(n=>{document.querySelector(`[data-tr="${n}"]`).scrollIntoView({block:'center'});}, n); await H.wait(300);
    await H.hl([{sel:`[data-tr="${n}"]`,n:'1',note:'方面をクリックで視点移動',pos:'right',w:210}]);
    await H.shot(S,id,slug,`観光導線：${t}`,'方面をクリックすると、駅からその目的地までのルート全体が見える位置へ視点が移動する。城だけで帰る来訪者を周辺へ送客する導線候補として使う。',{how:'分析パネル「観光導線」の方面をクリック'});
  }
  await H.click('#tour-toggle'); await H.settle(800);
  S='07_timeline';
  await H.click('#studio [data-quick-mode="heat"]'); await axisCam(H,2600,0.78,-0.35);
  const series=[['06:00','早朝・到着開始','早朝。宿泊者のみで市内は静穏。'],['09:00','到着ピーク','新幹線・新快速の到着で駅周辺に滞留が発生。'],['11:00','到着〜入城','駅から大手前通りを北上し、城へ向かう流れが最も太くなる。'],['13:00','城内滞留ピーク','城内・三の丸広場に人が集中。'],['15:00','市内回遊','好古園・商店街など城周辺へ分散。'],['17:00','帰路ピーク','駅へ向かって人が戻り、駅前の滞留が再び増える。'],['21:00','夜間','宿泊施設周辺と一部の飲食エリアのみに滞留が残る。']];
  let k=1;
  for(const [tm,ph,d] of series){ await H.setTime(tm); await H.settle(4200);
    await H.hl([{sel:'#tl-clock',n:'',pad:2},{sel:'#tl-slider',pad:6,round:14}]);
    await H.shot(S,`07-${String(k).padStart(2,'0')}`,`heat_${tm.replace(':','')}`,`時間帯の推移 ${tm}（${ph}）`,d+'（ヒートマップ表示・週末10月シナリオ）',{how:'タイムラインのスライダー／時刻選択'}); k++; }
  await H.click('#studio [data-quick-mode="point"]'); await H.setTime('11:00'); await axisCam(H,1500,0.8,-0.35);
  await H.shot(S,'07-08','point_flow_1100','粒子で見る人の流れ（11:00）','点群（粒子）表示で到着〜入城の時間帯を拡大。駅から大手前通りを北上する人の列（導線）が粒子の流れとして見える。');
  await H.hl([{sel:'#tl-play',n:'1',note:'再生/停止（Space）',pos:'above'},{sel:'#tl-speed',n:'2',note:'再生速度 ×0.5〜×4',pos:'above',w:170},{sel:'#tl-hour',n:'3',note:'時刻を選択',pos:'above'},{sel:'#tl-slider',n:'4',pad:6},{sel:'#tl-marks',n:'5',note:'目盛クリックで時刻ジャンプ',pos:'below',w:220},{sel:'#tl-scn',n:'6',note:'現在のシナリオ',pos:'above'},{sel:'#tl-phase',n:'7',badge:'right'}]);
  await H.shot(S,'07-09','timeline_controls','タイムラインの操作部','①再生/停止、②再生速度（×1＝3分/秒）、③時刻選択、④スライダー（00:00〜24:00）、⑤目盛クリックでジャンプ、⑥シナリオ表示、⑦時間帯フェーズ（早朝・到着ピーク・城内滞留ピーク・回遊・帰路・夜間）。',{sel:'#timeline'});
};
G.F2=async(H,page)=>{
  await H.hideToast(); let S='05_OD';
  await H.click('#od-toggle'); await H.x("flyTo(new THREE.Vector3(STN.x,TH(STN.x,STN.z),STN.z-600),5200,0.78,-0.35,500)");
  await H.setTime('13:00'); await H.settle(1000);
  await secShot(H,page,S,'05-06','OD_panel_section','OD分析の解説（分析パネル）','分析パネル内のOD分析セクション。山の高さ＝人数×正規カーネルの重ね合わせ、弧＝OD流（太さ＝シェア）という見方の説明。','OD分析');
  await H.click('#od-toggle'); await H.settle(1000);
  S='06_tour';
  await H.setTime('10:30');
  await H.click('#tour-toggle'); await H.showToast(); await H.x("flyTo(new THREE.Vector3(STN.x,TH(STN.x,STN.z),STN.z-1500),15500,0.62,-0.2,700)"); await H.settle(4000);
  await H.hl([{sel:'#tour-toggle',n:'1',note:'「観光導線」をクリック',pos:'below'}]);
  await H.shot(S,'06-01','tour_overview','観光導線：姫路駅ハブから6方面','姫路駅をハブに、書写山圓教寺・太陽公園/広峯神社・手柄山・姫路港（家島/小豆島）・松原八幡神社・姫路セントラルパークの6方面への送客導線を矢羽付きのルートで表示。',{how:'ヘッダー「観光導線」'});
  await H.hideToast();
  await secShot(H,page,S,'06-02','tour_panel','観光導線の一覧（分析パネル）','各方面の交通手段・所要時間・見どころ。行をクリックすると、その方面へ視点が移動する。','観光導線');
  for(const [n,id,slug,t] of [[0,'06-03','tour_shosha','書写山圓教寺（神姫バス＋ロープウェイ 約35分）'],[2,'06-04','tour_tegarayama','手柄山中央公園・水族館（山陽電鉄 約15分）'],[3,'06-05','tour_port','姫路港 → 家島諸島・小豆島（バス＋高速船 約60分）']]){
    await page.evaluate(n=>{const b=document.querySelector(`[data-tr="${n}"]`); b.scrollIntoView({block:'center'}); b.click();}, n); await H.settle(4200);
    await page.evaluate(n=>{document.querySelector(`[data-tr="${n}"]`).scrollIntoView({block:'center'});}, n); await H.wait(300);
    await H.hl([{sel:`[data-tr="${n}"]`,n:'1',note:'方面をクリックで視点移動',pos:'right',w:210}]);
    await H.shot(S,id,slug,`観光導線：${t}`,'方面をクリックすると、駅からその目的地までのルート全体が見える位置へ視点が移動する。城だけで帰る来訪者を周辺へ送客する導線候補として使う。',{how:'分析パネル「観光導線」の方面をクリック'});
  }
  await H.click('#tour-toggle'); await H.settle(800);
  S='07_timeline';
  await H.click('#studio [data-quick-mode="heat"]'); await axisCam(H,2600,0.78,-0.35);
  const series=[['06:00','早朝・到着開始','早朝。宿泊者のみで市内は静穏。'],['09:00','到着ピーク','新幹線・新快速の到着で駅周辺に滞留が発生。'],['11:00','到着〜入城','駅から大手前通りを北上し、城へ向かう流れが最も太くなる。'],['13:00','城内滞留ピーク','城内・三の丸広場に人が集中。'],['15:00','市内回遊','好古園・商店街など城周辺へ分散。'],['17:00','帰路ピーク','駅へ向かって人が戻り、駅前の滞留が再び増える。'],['21:00','夜間','宿泊施設周辺と一部の飲食エリアのみに滞留が残る。']];
  let k=1;
  for(const [tm,ph,d] of series){ await H.setTime(tm); await H.settle(4200);
    await H.hl([{sel:'#tl-clock',n:'',pad:2},{sel:'#tl-slider',pad:6,round:14}]);
    await H.shot(S,`07-${String(k).padStart(2,'0')}`,`heat_${tm.replace(':','')}`,`時間帯の推移 ${tm}（${ph}）`,d+'（ヒートマップ表示・週末10月シナリオ）',{how:'タイムラインのスライダー／時刻選択'}); k++; }
  await H.click('#studio [data-quick-mode="point"]'); await H.setTime('11:00'); await axisCam(H,1500,0.8,-0.35);
  await H.shot(S,'07-08','point_flow_1100','粒子で見る人の流れ（11:00）','点群（粒子）表示で到着〜入城の時間帯を拡大。駅から大手前通りを北上する人の列（導線）が粒子の流れとして見える。');
  await H.hl([{sel:'#tl-play',n:'1',note:'再生/停止（Space）',pos:'above'},{sel:'#tl-speed',n:'2',note:'再生速度 ×0.5〜×4',pos:'above',w:170},{sel:'#tl-hour',n:'3',note:'時刻を選択',pos:'above'},{sel:'#tl-slider',n:'4',pad:6},{sel:'#tl-marks',n:'5',note:'目盛クリックで時刻ジャンプ',pos:'below',w:220},{sel:'#tl-scn',n:'6',note:'現在のシナリオ',pos:'above'},{sel:'#tl-phase',n:'7',badge:'right'}]);
  await H.shot(S,'07-09','timeline_controls','タイムラインの操作部','①再生/停止、②再生速度（×1＝3分/秒）、③時刻選択、④スライダー（00:00〜24:00）、⑤目盛クリックでジャンプ、⑥シナリオ表示、⑦時間帯フェーズ（早朝・到着ピーク・城内滞留ピーク・回遊・帰路・夜間）。',{sel:'#timeline'});
};
/* ---------- G: 分析ボード・提案骨子・DB構成 ---------- */
G.G=async(H,page)=>{
  await H.hideToast(); await H.setTime('12:00');
  let S='08_board';
  await H.click('#board-toggle'); await H.settle(2500);
  await H.hl([{sel:'#board-toggle',n:'1',note:'「分析ボード」をクリック',pos:'below'}]);
  await H.shot(S,'08-01','board_open','分析ボードを開いた画面','ヘッダー「分析ボード」で、来訪者構成・滞留・帰路・消費・季節のチャートを地図の右側に重ねて表示。6つのタブで切り替える。',{how:'ヘッダー「分析ボード」'});
  const tabs=[['who','誰が・どこから','セグメント構成、インバウンドの国・地域、国内の居住地、交通手段、姫路の「前」に訪れた都道府県。'],['where','どこに滞留','市内観光施設の入込客数、回遊先の立寄率、スポット別滞在時間、時間帯別の滞留分布。'],['back','どこへ帰った','出発地→滞留→帰路のサンキー図、宿泊形態、姫路の「後」に訪れる都道府県。'],['spend','消費・料金改定','1人あたり市内消費の内訳、年間市内消費の試算、入城料改定（2026年3月〜）の収入試算。'],['when','季節・時間帯','月別入城者数×外国人比率、1日の流れ（到着・滞在・出発）、年間ボリュームKPI。'],['src','出典・前提','公表統計の出典リンクと、数値の扱い（公表実績値／換算値／仮置き）の注記案。']];
  let n=2;
  for(const [t,label,d] of tabs){ await H.click(`[data-bt="${t}"]`); await H.wait(1200);
    const c=await H.pieces(S,`08-${String(n).padStart(2,'0')}`,`board_${t}`,`分析ボード「${label}」`,d,'#board','#board',{max:4,how:`分析ボード → タブ「${label}」`}); n+=c; }
  await H.click('#bd-close'); await H.wait(500);
  S='09_proposal';
  await H.click('#prop-toggle'); await H.settle(2500);
  await H.hl([{sel:'#prop-toggle',n:'1',note:'「提案骨子」をクリック',pos:'below'}]);
  await H.shot(S,'09-01','proposal_open','提案骨子を開いた画面','ヘッダー「提案骨子」で、現状と課題・提案内容・実測化ロードマップ・施策とKPI・体制と留意点・出典をまとめた提案書の骨子を表示。',{how:'ヘッダー「提案骨子」'});
  await H.pieces(S,'09-02','proposal','提案骨子','①現状と課題 ②提案（来訪者DBと3層ダッシュボード）③実測化ロードマップ（Phase 0〜3）④施策への接続とKPI ⑤体制・留意点 ⑥出典。','#board','#board',{max:6,how:'ヘッダー「提案骨子」'});
  await H.click('#bd-close'); await H.wait(500);
  S='10_db';
  await H.click('#db-toggle'); await H.settle(2500);
  await H.hl([{sel:'#db-toggle',n:'1',note:'「DB構成」をクリック',pos:'below'}]);
  await H.shot(S,'10-01','db_open','DB構成を開いた画面','ヘッダー「DB構成」で、来訪者DBのパイプライン・データソース候補・論理スキーマ・各画面が読むテーブルを表示。',{how:'ヘッダー「DB構成」'});
  await H.pieces(S,'10-02','db','来訪者DB構成','パイプライン（収集→統合→分析→可視化）、データソース候補（位置情報・入城券・決済・宿泊・交通・Wi-Fi/カメラ・SNS）、テーブル構成、画面とテーブルの対応。','#board','#board',{max:4,how:'ヘッダー「DB構成」'});
  await H.click('#bd-close');
};
/* ---------- P: 施策比較・3エリア・左右比較 ---------- */
G.P=async(H,page)=>{
  await H.hideToast(); await H.setTime('12:00');
  let S='11_policy';
  await H.click('#plan-open'); await H.settle(4000);
  await H.hl([{sel:'#plan-open',n:'1',note:'「施策比較」をクリック',pos:'below'},{sel:'#plan-panel',n:'2',badge:'right'}]);
  await H.shot(S,'11-01','policy_workspace_open','施策比較ワークスペース','ヘッダー「施策比較」で、入城処理能力の増強・到着時間の分散・商店街立寄りの追加などの施策案を、同じ来訪者・同じ条件で比較する。地図上には分析エリア（駅前・大手前通り・大手門周辺）の枠が表示される。',{how:'ヘッダー「施策比較」'});
  let n=await H.pieces(S,'11-02','policy_compare','施策比較「案を比較」タブ','対象エリアの選択、案の編集（到着時間分散・入城処理能力・立寄り追加）、案の登録、比較結果（待機ピーク・待ち時間・エリア人数など）の表。','#plan-panel','#plan-panel',{max:5,how:'施策比較 → 案を比較'});
  let id=2+n;
  // sensitivity
  await H.click('#sens-compute'); await H.settle(4000);
  await page.evaluate(()=>{document.getElementById('sens-panel').scrollIntoView({block:'start'});}); await H.wait(400);
  await H.hl([{sel:'#sens-compute',n:'1',note:'「感度分析を計算」',pos:'right',w:180}]);
  await H.shot(S,`11-${String(id++).padStart(2,'0')}`,'sensitivity_run','感度分析（条件への強さ・混雑時間帯）','登録済みの案を、来訪者数3条件（80/100/120%など）・到着の集中度・処理能力の実現率を変えて検証し、どの条件でも効く案かを確認する。',{sel:'#plan-panel',how:'施策比較 → 感度分析を計算'});
  const r=await page.evaluate(()=>{const e=document.getElementById('sens-results');e.scrollIntoView({block:'start'});return e.offsetHeight;}); await H.wait(400);
  await H.shot(S,`11-${String(id++).padStart(2,'0')}`,'sensitivity_results','感度分析の結果','案ごとの待機ピーク・混雑時間帯の幅と、時間帯別のタイムライン。「待機ピークを地図で確認」から地図上のレビューへ移動できる。','',{sel:'#plan-panel'});
  // goal
  await H.click('[data-goal-tab="goal"]'); await H.wait(800);
  await H.click('#goal-run');
  for(let t=0;t<60;t++){ const busy=await H.x('GOAL.busy'); if(!busy&&t>1) break; await H.wait(1000); }
  await H.settle(1500);
  n=await H.pieces(S,`11-${String(id).padStart(2,'0')}`,'goal_search','施策比較「目標から探す」タブ','待機ピーク上限・混雑時間の上限などの目標を入力すると、目標を満たす「入城処理能力×到着分散」の組合せを自動探索し、人員・費用の目安とともに一覧化する。','#plan-panel','#plan-panel',{max:5,how:'施策比較 → 目標から探す → 目標から探索'}); id+=n;
  // ops
  await H.click('[data-goal-tab="ops"]'); await H.wait(800);
  await H.click('#ops-compute');
  for(let t=0;t<60;t++){ const busy=await H.x('OPS.busy'); if(!busy&&t>1) break; await H.wait(1000); }
  await H.settle(1500);
  n=await H.pieces(S,`11-${String(id).padStart(2,'0')}`,'ops_timed','施策比較「時間帯と影響」タブ','入城能力の増強を「終日」と「時間限定」で比較し、入城待機の改善がその後の城内滞在・駅前・回遊先の人数にどう波及するかをグラフで確認する。','#plan-panel','#plan-panel',{max:5,how:'施策比較 → 時間帯と影響 → 3案を比較'}); id+=n;
  // review on map via ops peak
  const has=await H.ev(()=>!!document.querySelector('[data-ops-map]'));
  await H.click('[data-goal-tab="compare"]'); await H.wait(500);
  await H.click('#sens-compute'); await H.settle(2500);
  const hasSensLink=await page.evaluate(()=>{const b=[...document.querySelectorAll('#sens-timeline button')].find(b=>b.textContent.includes('待機ピークを地図で確認')); if(b){b.click();return true;} return false;});
  if(!hasSensLink){ await H.click('[data-plan-apply="1"]'); }
  await H.settle(4500);
  await H.hl([{sel:'#review-bar',n:'1',badge:'right'}]);
  await H.shot(S,`11-${String(id++).padStart(2,'0')}`,'review_policy','地図で施策を確認（施策）','感度分析の「待機ピークを地図で確認」から、施策適用後の人流を地図上で確認するレビューモードに入る。上部バーで「現状／施策／差分」を切替。',{how:'感度分析結果 →「待機ピークを地図で確認」'});
  await H.click('[data-review-mode="base"]'); await H.settle(4000);
  await H.shot(S,`11-${String(id++).padStart(2,'0')}`,'review_base','地図で施策を確認（現状）','同じ時刻・同じ視点で「現状」を表示。施策と見比べることで、どこの混雑が減るかを確認できる。');
  await H.click('[data-review-mode="diff"]'); await H.settle(4500);
  await H.hl([{sel:'[data-review-mode="diff"]',n:'1',note:'「差分」',pos:'below'}]);
  await H.shot(S,`11-${String(id++).padStart(2,'0')}`,'review_diff','地図で施策を確認（差分）','「差分」では施策後−現状の増減をセルごとに色分け表示。混雑が減る場所・増える場所（波及先）が一目で分かる。',{how:'レビューバー「差分」'});
  await H.click('#review-end'); await H.settle(2500);
  // apply policy + left/right compare
  await H.click('#plan-open'); await H.settle(3000);
  await page.evaluate(()=>{const b=document.querySelector('[data-plan-compare="2"]')||document.querySelector('[data-plan-compare]'); b&&b.click();}); await H.settle(5000);
  await H.hl([{sel:'#j-compare-bar',n:'1',badge:'right'}]);
  S='13_compare';
  await H.shot(S,'13-01','compare_split_policy','左右3D比較（現状 ｜ 施策後）','施策比較の「現状と左右比較」または分析パネルの「左右3D比較」で、画面を左右に分割し、左＝現状・右＝施策後を同じ視点・同じ時刻で並べて表示。上部バーで比較の表現（点・ヒート・柱・グリッド・ヘックス）を切替。',{how:'施策比較「現状と左右比較」／分析パネル「左右3D比較」'});
  await page.evaluate(()=>{const s=document.getElementById('quality-compare-mode'); s.value='column'; s.dispatchEvent(new Event('change'));}); await H.settle(5000);
  await H.hl([{sel:'#quality-compare-mode',n:'1',note:'比較の表示を「柱」に',pos:'below'}]);
  await H.shot(S,'13-02','compare_split_column','左右3D比較（柱で比較）','比較の表示を「柱」に変えた例。色基準を左右共通にしているため、柱の高さ・色をそのまま比較できる。');
  await H.click('#j-compare-close'); await H.settle(2500);
  await H.ev(()=>{document.getElementById('panel-body').scrollTop=0;});
  await H.hl([{sel:'[data-j-variant="policy"]',n:'1',note:'「施策後」を表示中',pos:'right'},{sel:'#j-ledger',n:'2',badge:'right'}]);
  await H.shot(S,'13-03','journey_policy_variant','共通人流モデル：施策後の表示','分析パネル上部の「共通人流モデル」。現状／施策後を切り替え、L0流入＝市内＋退出の人数収支と、現状・施策後・差の表（市内人数・入城待機・平均待ち時間・立寄り人数）を確認できる。',{how:'分析パネル「現状／施策後」'});
  await H.ev(()=>{const d=document.getElementById('j-parameters'); if(d) d.open=true;}); await H.wait(500);
  await H.shot(S,'13-04','journey_panel_crop','共通人流モデル（パネル拡大）','施策パラメータ（到着時刻の分散・入城処理能力・商店街立寄り追加）を入力し「施策を計算して表示」で反映。出発地の絞り込みは L0〜L2 すべての階層に連動する。','',{sel:'#panel'});
  await H.click('[data-j-variant="base"]'); await H.wait(800);
  // areas
  S='12_area';
  await H.click('#area-open'); await H.settle(4500);
  await H.hl([{sel:'#area-open',n:'1',note:'「3エリア分析」をクリック',pos:'below'},{sel:'#area-panel',n:'2',badge:'right'}]);
  await H.shot(S,'12-01','area_open','3エリア分析','ヘッダー「3エリア分析」で、姫路駅前・大手前通り・大手門周辺の3エリアを地図上に枠表示し、エリアごとの在域人数・流入/流出・訪問人数・平均在域時間を現状と施策後で比較する。',{how:'ヘッダー「3エリア分析」'});
  await H.ev(()=>{document.querySelectorAll('#area-panel details').forEach(d=>d.open=true);});
  n=await H.pieces(S,'12-02','area_panel','3エリア分析パネル','エリア切替タブ、集計期間（地図の再生時刻とは独立）、指標表、時間推移グラフ、エリア間の移動方向・人数、対象範囲（幅）の設定、条件保存/復元、集計JSON出力。','#area-panel','#area-panel',{max:5,how:'3エリア分析パネル'});
  await H.ev(()=>{document.querySelectorAll('#area-panel details').forEach(d=>d.open=false);document.getElementById('area-panel').scrollTop=0;});
  await page.evaluate(()=>{const b=document.querySelector('[data-area-focus="0"]'); b&&b.click();}); await H.settle(4500);
  await H.hl([{sel:'[data-area-focus="0"]',n:'1',note:'エリアを選ぶと地図が移動',pos:'below',w:220}]);
  await H.shot(S,`12-${String(2+n).padStart(2,'0')}`,'area_focus_station','エリアを選択（姫路駅前）','エリアのタブを選ぶと、そのエリアの枠へ地図が移動し、指標とグラフが切り替わる。「ピーク」ボタンでピーク時刻へジャンプできる。');
  await H.click('#area-close');
};
module.exports=G;
/* ---------- X: 撮り直し（見やすさ改善） ---------- */
G.X=async(H,page)=>{
  await H.hideToast();
  // L0 day window
  await H.click('.crumb[data-lvl="wide"]'); await H.settle(4000);
  await H.click('[data-l0-window="day"]'); await H.settle(3000);
  await page.evaluate(()=>document.querySelector('[data-l0-window="day"]').scrollIntoView({block:'center'})); await H.wait(300);
  await H.hl([{sel:'[data-l0-window="day"]',n:'1',note:'集計時間「1日全体」',pos:'right'}]);
  await H.shot('01_L0','01-10','L0_window_day','集計時間：1日全体','集計時間を「1日全体」に切り替えると、その日の全流入量で帯・ポールが再スケールされる。直近15分/60分・本日累計にすると、タイムラインの時刻までの流入に絞られる。',{how:'分析パネル「集計時間」→「1日全体」'});
  await H.click('[data-l0-window="total"]'); await H.click('.crumb[data-lvl="city"]'); await H.settle(3000);
  const S='04_display';
  const cam=async(dx,dz,r,phi,th=-0.35)=>{ await H.x(`(()=>{const st=toXZ(34.8273,134.6907);const m={x:(st.x+CASTLE.x)/2+${dx},z:(st.z+CASTLE.z)/2+${dz}};flyTo(new THREE.Vector3(m.x,TH(m.x,m.z),m.z),${r},${phi},${th},600);})()`); await H.settle(3200); };
  // contour
  await H.setTime('12:00'); await H.click('#studio [data-quick-mode="contour"]'); await cam(0,-350,1500,0.62); await H.frames(3);
  await H.hl([{sel:'#studio [data-quick-mode="contour"]',n:'1',note:'人流の表現「等高線」',pos:'left',w:200}]);
  await H.shot(S,'04-06','mode_contour','人流の表現：等高線','一定密度以上の混雑エリアの輪郭を等高線で表示（背景のメッシュは薄い平面表示）。混雑範囲の広がり・縮小を比較しやすい。',{how:'地図の表示設定 → 人流の表現「等高線」'});
  // trips animated
  await H.setTime('15:00'); await H.click('#studio [data-quick-mode="trips"]'); await cam(0,0,1700,0.7); await H.frames(3);
  await H.hl([{sel:'#studio [data-quick-mode="trips"]',n:'1',note:'人流の表現「軌跡」',pos:'left',w:200}]);
  await H.shot(S,'04-07','mode_trips','人流の表現：軌跡（動く軌跡）','来訪者ごとの移動軌跡を道路網上の線で表示。「動く軌跡」では現在時刻から一定の時間窓だけを、頭が明るく尾が消える形で表示し、駅〜大手前通り〜城周辺の導線を再現する。',{how:'地図の表示設定 → 人流の表現「軌跡」'});
  await H.x("setTripsAnim(false); renderPanel();"); await cam(0,-150,1500,0.6); await H.frames(3);
  await H.shot(S,'04-09','trips_cumulative','軌跡：累積（1日分）','「累積」に切り替えると、その時刻までの全来訪者の移動軌跡が重なり、よく使われる道（主要導線）が浮かび上がる。点＝城・回遊先・宿泊での滞留地点。',{how:'表示設定 → 詳細「軌跡ライン」→ 累積'});
  await H.x("setTripsAnim(true); renderPanel();");
  // seg color & flat
  await H.setTime('12:00'); await H.click('#studio [data-quick-mode="grid"]'); await H.click('#studio [data-quick-res="25"]'); await H.wait(600);
  await H.x("MESH.color='seg'; meshRebuildShape(); MESH.dirty=true; paintMesh(); renderPanel(); precisionRefresh();"); await cam(0,-200,1700,0.72); await H.frames(3);
  await H.hl([{sel:'#precision-legend',n:'1',note:'色＝主セグメント（海外/国内/近隣）',pos:'right',w:240}]);
  await H.shot(S,'04-14','mesh_color_segment','色分け：来訪者属性（主セグメント）','セルの色を人口密度から「来訪者属性」に切り替えると、各セルで最も多いセグメント（青＝インバウンド、緑＝国内、ピンク＝県内・近隣）で色分けされる（25mメッシュの例）。',{how:'表示設定 → 詳細「高精細メッシュ」→ 来訪者属性'});
  await H.x("MESH.color='density'; MESH.style='2d'; meshRebuildShape(); MESH.dirty=true; paintMesh(); renderPanel(); precisionRefresh();"); await cam(0,-100,2600,0.02,0); await H.frames(3);
  await H.shot(S,'04-15','mesh_flat_2d','メッシュの平面表示（真上から）','「平面」にすると高さを付けず色だけで密度を表示。真上（2D）視点と組み合わせると、地図資料としてそのまま使える（25mメッシュの例）。',{how:'表示設定 → 詳細「高精細メッシュ」→ 平面／操作ドック「真上」'});
  await H.x("MESH.style='3d'; meshRebuildShape(); MESH.dirty=true; paintMesh(); renderPanel(); precisionRefresh();"); await H.click('#studio [data-quick-res="10"]'); await cam(0,0,2300,0.8);
  for(const [st,label,t,d,id] of [['solid','立体','市街地の表現：立体','建物をソリッドな立体で表示。人流の柱・メッシュとの位置関係が分かりやすい。','04-16'],['cloud','点群','市街地の表現：点群','市街地・姫路城を点群（デジタルレイヤー）で表示。背景を控えめにして人流を際立たせる。','04-17']]){
    await H.click(`[data-city-style="${st}"]`); await H.settle(4000);
    await page.evaluate(s=>document.querySelector(`[data-city-style="${s}"]`).scrollIntoView({block:'center'}), st); await H.wait(300);
    await H.hl([{sel:`[data-city-style="${st}"]`,n:'1',note:`市街地の表現「${label}」`,pos:'left',w:200}]);
    await H.shot(S,id,`city_style_${st}`,t,d,{how:`表示設定 → 市街地・姫路城の表現「${label}」`});
  }
  await H.click('[data-city-style="hybrid"]');
  // L1 axis view with visible button
  await H.setTime('12:00'); await H.click('#studio [data-quick-mode="grid"]'); await H.click('[data-quality-view="axis"]'); await H.settle(3500);
  await page.evaluate(()=>document.querySelector('[data-quality-view="axis"]').scrollIntoView({block:'center'})); await H.wait(300);
  await H.hl([{sel:'[data-quality-view="axis"]',n:'1',note:'「駅〜城」で軸全体を表示',pos:'left',w:200}]);
  await H.shot('02_L1','02-02','L1_station_castle_axis','駅〜城の軸を俯瞰','表示設定の「駅〜城」ボタンで、姫路駅から大手前通り・姫路城までの主要動線全体を俯瞰。駅前・通り・城周辺に滞留が分かれる様子が分かる。',{how:'表示設定「表示の確認・視点」→「駅〜城」'});
};
/* ---------- X2: L1/L2 の撮り直し（ツールチップ・カード・拡大） ---------- */
G.X2=async(H,page)=>{
  await H.hideToast(); await H.setTime('12:00');
  let S='02_L1';
  await H.click('#studio [data-quick-mode="point"]'); await H.settle(1500);
  await H.x("setLevel('city',false); flyTo(new THREE.Vector3(CASTLE.x, TH(CASTLE.x,CASTLE.z), CASTLE.z+150), 1700, 0.85, -0.4, 600)"); await H.settle(3200);
  const c=await H.project("new THREE.Vector3(CASTLE.x, TH(CASTLE.x,CASTLE.z)+40, CASTLE.z)");
  await page.mouse.move(c.x-4,c.y); await page.mouse.move(c.x,c.y); await H.wait(1200);
  const tipOk=await H.ev(()=>{const t=document.getElementById('tip');return t.style.display==='block'?t.textContent:'';}); console.log('castle tip:',tipOk.slice(0,60));
  await H.hl([{sel:'#enter-hint',n:'2',badge:'right'}]);
  await H.shot(S,'02-12','L1_hover_castle','姫路城ホバー → クリックで城内へ','姫路城にマウスを重ねると、世界遺産の説明・現在の城内滞留人数と「クリックで城内（L2）へ」が表示される。画面下部にも「姫路城をクリックして城内へ」のヒント（②）が出る。',{how:'L1で姫路城にマウスを重ねる → クリック'});
  await page.mouse.move(5,500);
  const poi=await H.x("(()=>{const r=[];NAMED.forEach(o=>{if(o.userData&&o.userData.poi&&o.visible&&o.parent&&o.parent.visible){const w=new THREE.Vector3();o.getWorldPosition(w);const p=w.clone().project(camera);const R=renderer.domElement.getBoundingClientRect();const x=R.left+(p.x+1)/2*R.width,y=R.top+(1-p.y)/2*R.height;if(p.z<1&&x>620&&x<1300&&y>300&&y<700)r.push({n:o.userData.name,x,y});}});return r;})()");
  const target=poi.find(p=>/好古園/.test(p.n))||poi.find(p=>!/姫路城/.test(p.n))||poi[0];
  if(target){ for(const dy of [0,-4,4,-8]){ await page.mouse.move(target.x-3,target.y+dy); await page.mouse.move(target.x,target.y+dy); await H.wait(900); const ok=await H.ev(()=>document.getElementById('tip').style.display==='block'); if(ok) break; }
    await H.shot(S,'02-13','L1_hover_poi','POIホバー（観光施設の解説）',`POI（${target.n}など）にマウスを重ねると、施設の種類・解説・平均滞在時間が表示される。`,{how:'L1でPOIピンにマウスを重ねる'}); }
  await page.mouse.move(5,500);
  // building card
  const bp=await H.x("(()=>{for(let y=320;y<700;y+=19)for(let x=640;x<1280;x+=23){const e=document.elementFromPoint(x,y);if(!e||e.tagName!=='CANVAS')continue;const hb=pickBuilding({clientX:x,clientY:y});if(hb&&!(hb.b&&plateauInfo(hb.b).castle))return {x,y};}return null;})()");
  console.log('building at',bp);
  if(bp){ await page.mouse.click(bp.x,bp.y); await H.wait(1500);
    const vis=await H.ev(()=>getComputedStyle(document.getElementById('bcard')).display!=='none'); console.log('bcard visible',vis);
    await H.hl([{rect:[bp.x-9,bp.y-9,18,18],round:12,n:'1',note:'建物をクリック',pos:'left'},{sel:'#bcard',n:'2',badge:'right'}]);
    await H.shot(S,'02-14','L1_building_card','建物情報カード（PLATEAU属性）','建物をクリックすると、国土交通省PLATEAUの属性（建物ID・用途・計測高さ・階数・建築面積・地盤高・LOD・250mメッシュコード）を表示。人流データとは建物ID×メッシュで結合する想定。',{how:'L1で建物をクリック'});
    await H.shot(S,'02-15b','L1_building_card_crop','建物情報カード（拡大）','',{sel:'#bcard'});
    await H.x('hideBuildingCard()'); }
  // mesh detail crop
  await H.click('#studio [data-quick-mode="grid"]'); await H.settle(2000);
  await H.click('#insight-top'); await H.settle(3000);
  await H.shot(S,'02-16','L1_mesh_cell_detail_crop','固定した地点の詳細パネル（拡大）','地点の人数（移動・滞在・待機）、施策前後の比較、時間推移グラフなどを表示。「畳む」「閉じる」で操作。',{sel:'#insight-detail'});
  await H.click('#insight-detail-close');
  // street heat
  await H.click('#studio [data-quick-mode="point"]'); await H.x("heatMode='all'; HEAT.lastT=-99; applyLayers(); repaintHeat(); renderPanel();");
  await H.x("(()=>{const st=toXZ(34.8273,134.6907);const m={x:(st.x+CASTLE.x)/2,z:(st.z+CASTLE.z)/2};flyTo(new THREE.Vector3(m.x,TH(m.x,m.z),m.z),1900,0.6,-0.35,600);})()"); await H.settle(3500);
  await H.shot(S,'02-17','L1_street_heat','補助レイヤー：通りの滞留ヒート','通り単位の滞留ヒートマップ（補助レイヤー）。駅・大手前通り・姫路城の「一本道」構造と、時間帯による発熱位置の移動が分かる。表示設定の「選択中の表現・補助レイヤーの詳細」から切替。',{how:'表示設定 → 選択中の表現・補助レイヤーの詳細 → 通りの滞留ヒート'});
  await H.x("heatMode='off'; HEAT.lastT=-99; applyLayers(); repaintHeat(); renderPanel();");
  await H.click('#studio [data-quick-mode="grid"]');
  // L2 floor rows crop
  S='03_L2';
  await H.click('.crumb[data-lvl="castle"]'); await H.settle(3000); await H.click('#floor-toggle'); await H.settle(2500);
  const fr=await page.evaluate(()=>{const f=document.getElementById('floor-rows'); if(!f) return false; f.scrollIntoView({block:'start'}); return true;}); await H.wait(400);
  if(fr) await H.shot(S,'03-11','L2_floor_rows','階層ビューの階別人数','施設ごとの階別人数と容量比（快適／やや混雑／混雑）。',{sel:'#floor-rows'});
  await H.click('#floor-toggle');
};
G.X3=async(H,page)=>{
  await H.hideToast(); await H.setTime('12:00');
  await H.click('[data-j-variant="policy"]'); await H.settle(2500);
  await H.ev(()=>{document.getElementById('panel-body').scrollTop=0; const d=document.getElementById('j-parameters'); if(d) d.open=true;}); await H.wait(600);
  await H.pieces('13_compare','13-04','journey_panel','共通人流モデル（パネル拡大）','施策パラメータ（到着時刻の分散・入城処理能力・商店街立寄り追加）を入力し「施策を計算して表示」で反映。出発地の絞り込みは L0〜L2 すべての階層に連動する。','#panel-body','#panel',{max:2});
  await H.click('[data-j-variant="base"]');
};
G.X4=async(H,page)=>{
  await H.hideToast(); await H.setTime('12:00');
  // 13-03 policy variant with panel visible
  await H.click('[data-j-variant="policy"]'); await H.settle(3000);
  await H.ev(()=>{document.getElementById('panel-body').scrollTop=0;}); await H.wait(300);
  await H.hl([{sel:'[data-j-variant="policy"]',n:'1',note:'「施策後」を表示',pos:'right'},{sel:'#j-ledger',n:'2',badge:'right'}]);
  await H.shot('13_compare','13-03','journey_policy_variant','共通人流モデル：施策後の表示','分析パネル上部の「共通人流モデル」。現状／施策後を切り替え、L0流入＝市内＋退出の人数収支と、現状・施策後・差の表（市内人数・入城待機・平均待ち時間・立寄り人数）を確認できる。',{how:'分析パネル「現状／施策後」'});
  await H.click('[data-j-variant="base"]'); await H.settle(1500);
  // review with a policy row
  const S='11_policy';
  await H.click('#plan-open'); await H.settle(3000);
  await H.click('#sens-compute'); await H.settle(3000);
  const picked=await page.evaluate(()=>{const ds=[...document.querySelectorAll('#sens-timeline details')]; for(let i=ds.length-1;i>=1;i--){const b=[...ds[i].querySelectorAll('button')].find(b=>b.textContent.includes('待機ピークを地図で確認')); if(b){ ds[i].open=true; b.click(); return i+':'+(ds[i].querySelector('summary')?.textContent||''); }} return null;});
  console.log('review row',picked); await H.settle(4500);
  await H.hl([{sel:'#review-bar',n:'1',badge:'right'}]);
  await H.shot(S,'11-18','review_policy','地図で施策を確認（施策）','感度分析の「待機ピークを地図で確認」から、施策適用後の人流を地図上で確認するレビューモードに入る。上部バーで「現状／施策／差分」を切替。',{how:'感度分析結果 →「待機ピークを地図で確認」'});
  await H.click('[data-review-mode="base"]'); await H.settle(4000);
  await H.shot(S,'11-19','review_base','地図で施策を確認（現状）','同じ時刻・同じ視点で「現状」を表示。施策と見比べることで、どこの混雑が減るかを確認できる。',{how:'レビューバー「現状」'});
  await H.click('[data-review-mode="diff"]'); await H.settle(4500); await H.frames(2);
  await H.hl([{sel:'[data-review-mode="diff"]',n:'1',note:'「差分」',pos:'below'}]);
  await H.shot(S,'11-20','review_diff','地図で施策を確認（差分）','「差分」では施策後−現状の増減をセルごとに表示（青＝減少／橙＝増加、高さ＝差の絶対値）。混雑が減る場所と、人が流れ込む場所（波及先）が一目で分かる。',{how:'レビューバー「差分」'});
  await H.click('#review-end'); await H.settle(1500);
};
G.X5=async(H,page)=>{
  await H.hideToast(); await H.setTime('12:00');
  await H.click('.crumb[data-lvl="castle"]'); await H.settle(3000); await H.click('#floor-toggle'); await H.settle(2500);
  const r=await page.evaluate(()=>{document.querySelectorAll('#studio details').forEach(d=>d.open=true); const f=document.getElementById('floor-rows'); if(!f) return null; const sec=f.closest('.sec')||f; sec.scrollIntoView({block:'start'}); const a=sec.getBoundingClientRect(), p=document.getElementById('studio').getBoundingClientRect(); const top=Math.max(a.top,p.top), bot=Math.min(a.bottom,p.bottom); return {x:p.left+2,y:top-4,width:p.width-4,height:bot-top+8};});
  console.log('floor rect',r); await H.wait(400);
  if(r&&r.height>40) await H.shot('03_L2','03-11','L2_floor_rows','階層ビューの階別人数（表示設定パネル内）','施設ごとの階別人数と容量比（快適／やや混雑／混雑）。「≡ 階層」をONにすると、右の表示設定の「選択中の表現・補助レイヤーの詳細」に表示される。',{clip:r,png:true,how:'ヘッダー「≡ 階層」→ 表示設定の詳細'});
};
G.X6=async(H,page)=>{
  await H.hideToast(); await H.setTime('11:00'); await H.settle(1500);
  await H.hl([{sel:'#tl-play',n:'1',badge:'right'},{sel:'#tl-speed',n:'2'},{sel:'#tl-hour',n:'3'},{sel:'#tl-slider',n:'4',pad:6},{sel:'#tl-marks',n:'5',pad:3},{sel:'#tl-scn',n:'6'},{sel:'#tl-phase',n:'7'},{sel:'#tl-clock',n:'8'}]);
  const r=await page.evaluate(()=>{const b=document.getElementById('timeline').getBoundingClientRect(); return {x:b.left-24,y:b.top-24,width:b.width+48,height:b.height+40};});
  await H.shot('07_timeline','07-09','timeline_controls','タイムラインの操作部','①再生/停止（Space）、②再生速度（×0.5〜×4、×1＝3分/秒）、③時刻選択、④スライダー（00:00〜24:00）、⑤目盛クリックで時刻ジャンプ、⑥シナリオ表示、⑦時間帯フェーズ（早朝・到着ピーク・城内滞留ピーク・回遊・帰路・夜間）、⑧現在時刻。',{clip:r,png:true,how:'画面下のタイムライン'});
};
G.X7=async(H,page)=>{
  await H.hideToast(); await H.setTime('12:00');
  await H.click('[data-city-style="solid"]'); await H.settle(1500);
  await H.click('#studio [data-quick-mode="contour"]'); await H.settle(1500);
  await H.x("(()=>{const st=toXZ(34.8273,134.6907);const m={x:(st.x+CASTLE.x)/2,z:(st.z+CASTLE.z)/2-250};flyTo(new THREE.Vector3(m.x,TH(m.x,m.z),m.z),1900,0.35,-0.2,600);})()"); await H.settle(3000); await H.frames(4);
  const n=await H.x("CONT.lines?CONT.lines.geometry.attributes.position.count:0"); console.log('contour verts',n);
  await page.evaluate(()=>document.querySelector('#studio [data-quick-mode="contour"]').scrollIntoView({block:'center'}));
  await H.hl([{sel:'#studio [data-quick-mode="contour"]',n:'1',note:'人流の表現「等高線」',pos:'left',w:200}]);
  await H.shot('04_display','04-06','mode_contour','人流の表現：等高線','一定密度以上の混雑エリアの輪郭を等高線で表示（背景のメッシュは薄い平面表示）。混雑範囲の広がり・縮小を比較しやすい。見やすさのため市街地の表現を「立体」にした例。',{how:'地図の表示設定 → 人流の表現「等高線」'});
};
