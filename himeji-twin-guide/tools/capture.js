const {launch}=require('./harness'); const {mk}=require('./lib');
const GROUPS={};
/* ---------- A: 画面構成と基本操作 ---------- */
GROUPS.A=async(H,page)=>{
  const S='00_basic';
  await H.hideToast(); await H.settle(1500);
  await H.hl([
    {sel:'#lvl-crumb .crumb',union:true,n:'①',note:'① 階層（L0/L1/L2）と各機能の切替',at:[905,66],w:300},
    {sel:'#panel',n:'②',note:'② 分析パネル\nKPI・施策比較・セグメント・シナリオ等',at:[312,600],w:230},
    {sel:'#precision-legend',n:'③',note:'③ 凡例（人流の色・高さの意味）',at:[582,134],w:230},
    {sel:'#studio',n:'④',note:'④ 地図の表示設定\n人流の表現・解像度・背景',at:[1110,134],w:220},
    {sel:'#nav-dock',n:'⑤',note:'⑤ 視点操作（移動/回転・真上/俯瞰/真横・ズーム）',pos:'above',w:380},
    {sel:'#timeline',n:'⑥',pad:2,note:'⑥ タイムライン\n時刻・再生・速度・シナリオ',at:[312,850],w:205},
    {sel:'#workspace-dock',n:'⑦',note:'⑦ パネルの表示/非表示',at:[978,958],w:200},
  ]);
  await H.shot(S,'00-01','screen_layout_annotated','画面構成（注釈付き）','起動直後の画面。①ヘッダーで階層と機能を切り替え、②左の分析パネルで数値を確認、④右の表示設定で人流の見せ方を変え、⑥タイムラインで時刻を動かす、という基本構成。');
  await H.shot(S,'00-02','screen_layout_clean','起動直後の画面（L1 市内回遊・10:30）','初期状態はL1（市内回遊・滞留）、10:30（到着ピーク）、週末（10月）シナリオ、10mグリッドメッシュで表示される。');
  // header crop
  await H.shot(S,'00-03','header_menu','ヘッダーメニュー','L0/L1/L2の階層切替と、OD分析・観光導線・分析ボード・提案骨子・DB構成・施策比較・3エリア分析・階層ビューの各機能ボタン。',{sel:'#hdr'});
  // workspace: all fold
  await H.click('#all-panels'); await H.settle(2500);
  await H.hl([{sel:'#all-panels',n:'1',note:'「すべて畳む」で地図だけを表示\n（もう一度押すと「パネルを戻す」）',pos:'above',w:300}]);
  await H.shot(S,'00-04','all_panels_folded','すべて畳む（地図に集中）','画面下の「すべて畳む」で全パネルを隠し、地図だけを大きく見せる（プレゼン・説明時に有効）。F キーでも切替可能。');
  await H.click('#all-panels'); await H.settle(1500);
  // nav help
  await H.click('#nav-help'); await H.settle(800);
  await H.hl([{sel:'#nav-help',n:'1',pad:3},{sel:'#nav-help-text',n:'2',note:'マウス・タッチ操作の早見表',pos:'above'}]);
  await H.shot(S,'00-05','nav_help','操作方法（？ボタン）','操作ドックの「？」で操作方法を表示。左ドラッグ＝移動、右ドラッグ/Shift＋ドラッグ＝回転、ホイール＝ズーム、ダブルクリック＝接近。');
  await H.click('#nav-help');
  // view presets
  const views=[['top','真上','2D（真上）','地図を真上から見下ろす2D表示。ショートカット「1」。'],['bird','俯瞰','俯瞰','斜め上から見る標準的な3D俯瞰。ショートカット「2」。'],['side','真横','真横','地表近くまで傾けた横からの視点。建物と人流の高さ関係が分かる。ショートカット「3」。']];
  let k=6;
  for(const [v,label,t,d] of views){ await H.click(`[data-nav-view="${v}"]`); await H.settle(2600);
    await H.hl([{sel:`[data-nav-view="${v}"]`,n:'1',note:`「${label}」をクリック`,pos:'above'}]);
    await H.shot(S,`00-0${k}`,`view_${v}`,`視点プリセット：${t}`,d,{how:`操作ドック「${label}」`}); k++; }
  // eye level
  await H.x("flyTo(new THREE.Vector3(CASTLE.x-60,TH(CASTLE.x-60,CASTLE.z+700),CASTLE.z+700),260,1.5,-0.05,600)"); await H.settle(3000);
  await H.shot(S,'00-09','view_eye_level','視点：目線（人の高さ）','大手前通りから姫路城を人の目線で見た例。点群で補完した市街地と城郭を歩行者視点で確認できる。');
  // tilt slider + back to home
  await H.click('[data-nav-view="home"]'); await H.settle(3000);
  await H.hl([{sel:'.nav-tilt',n:'1',note:'傾きスライダー：真上〜真横を連続調整',pos:'above',w:300},{sel:'[data-nav-view="home"]',n:'2',badge:'right'},{sel:'[data-nav-view="back"]',n:'3',badge:'right'},{sel:'#nav-reset-north',n:'4',badge:'right'}]);
  await H.shot(S,'00-10','nav_dock_controls','操作ドックの各ボタン','①傾きスライダー、②⌂ 全体に戻る（H）、③↶ 前の視点へ戻る、④北を上に。移動/回転モードはM/Rキーでも切替。',{sel:'#nav-dock', keepHl:true});
  await H.clearHl();
  // panel folding toggles in dock
  await H.click('[data-panel="analysis"]'); await H.click('[data-panel="display"]'); await H.settle(2500);
  await H.hl([{sel:'[data-panel="analysis"]',n:'1'},{sel:'[data-panel="display"]',n:'2',note:'分析・表示パネルを個別に畳む',pos:'above',w:240}]);
  await H.shot(S,'00-11','fold_side_panels','左右パネルを畳んだ状態','画面下のドックで「分析」「表示」「時間」「凡例」「上部」「操作」を個別に表示/非表示できる。');
  await H.click('[data-panel="analysis"]'); await H.click('[data-panel="display"]');
};
/* ---------- B: L0 広域流入 ---------- */
GROUPS.B=async(H,page)=>{
  const S='01_L0';
  await H.hideToast();
  await H.click('.crumb[data-lvl="wide"]'); await H.settle(4500);
  await H.hl([{sel:'.crumb[data-lvl="wide"]',n:'1',note:'「L0 広域流入」をクリック',pos:'below'}]);
  await H.shot(S,'01-01','L0_overview','L0 広域流入の全体像（10:30）','全国・近畿各地から姫路へ向かう流入を、路線・高速道路・航路・空港アクセスごとの帯（コリドー）と出発地のポールで表示。帯幅＝区間人数、ポールの高さ＝出発地別人数、色＝セグメント。',{how:'ヘッダー「L0 広域流入」'});
  await H.shot(S,'01-02','L0_overview_clean','L0 広域流入（注釈なし）','新幹線（東西）・JR新快速・山陽電鉄・播但線・姫新線・山陽道・中国道・国道2号・航路・空港アクセスの各方面から姫路駅・IC・港へ流入する様子。');
  await H.pieces(S,'01-03','L0_panel','L0 分析パネル','選択範囲の流入人数KPI、集計時間（直近15分/60分/本日累計/1日全体）、24時間の流入グラフ、方面別・出発地別の流入人数、到着ゲート別の人数を表示。','#panel-body','#panel',{max:5});
  // day window
  await H.click('[data-l0-window="day"]'); await H.settle(3500);
  await H.hl([{sel:'[data-l0-window="day"]',n:'1',note:'集計時間「1日全体」',pos:'right'}]);
  await H.shot(S,'01-10','L0_window_day','集計時間：1日全体','集計時間を「1日全体」に切り替えると、その日の全流入量で帯・ポールが再スケールされる。',{how:'分析パネル「1日全体」'});
  // corridor focus
  await H.ev(()=>{document.getElementById('panel-body').scrollTop=document.getElementById('l0-corridors').offsetTop-80;}); await H.wait(300);
  await H.click('[data-l0-corr="shin_e"]'); await H.settle(4000);
  await H.ev(()=>{document.getElementById('panel-body').scrollTop=document.getElementById('l0-corridors').offsetTop-80;}); await H.wait(300);
  await H.hl([{sel:'[data-l0-corr="shin_e"]',n:'1',note:'方面を選択するとその経路にフォーカス',pos:'right',w:240}]);
  await H.shot(S,'01-11','L0_focus_shinkansen_east','方面フォーカス：山陽新幹線（東）','方面別リストで「山陽新幹線（東）」を選ぶと、東京・名古屋・京都・新大阪・新神戸・西明石を経由する流入経路に視点が移動し、その方面だけが強調される。',{how:'分析パネル「方面別 流入人数」'});
  await H.click('[data-l0-corr="jr_e"]'); await H.settle(4000);
  await H.shot(S,'01-12','L0_focus_jr_east','方面フォーカス：JR新快速（東）','大阪・三ノ宮・明石・加古川方面からの新快速ルート。インバウンドの大阪宿泊拠点からの日帰り客もこのルートで流入する想定。');
  await H.click('#l0-reset'); await H.settle(3500);
  // inbound segment
  await H.ev(()=>{document.getElementById('panel-body').scrollTop=0;});
  await H.click('#seg-chips [data-s="in"]'); await H.settle(3500);
  await H.ev(()=>{const e=document.getElementById('seg-chips');document.getElementById('panel-body').scrollTop=e.offsetTop-120;}); await H.wait(300);
  await H.hl([{sel:'#seg-chips [data-s="in"]',n:'1',note:'セグメント「インバウンド」',pos:'right'}]);
  await H.shot(S,'01-13','L0_segment_inbound','セグメント絞り込み：インバウンド','来訪者セグメントを「インバウンド」に絞ると、大阪・京都の宿泊拠点、東京からのゴールデンルート、関空直行バスなど外国人客の流入経路だけが残る。',{how:'分析パネル「来訪者セグメント」'});
  await H.click('#seg-chips [data-s="dom"]'); await H.settle(3500);
  await H.shot(S,'01-14','L0_segment_domestic','セグメント絞り込み：国内（県外）','国内（県外）客に絞った表示。首都圏・東海・九州からの新幹線流入と、京阪神・岡山方面からの車流入が中心。');
  await H.click('#seg-chips [data-s="all"]'); await H.settle(2000);
  // hover origin pole
  const p=await H.project("new THREE.Vector3(ORIGIN_BY_ID.tokyo.x, 600, ORIGIN_BY_ID.tokyo.z)");
  await page.mouse.move(p.x-3,p.y); await page.mouse.move(p.x,p.y); await H.wait(900);
  await H.shot(S,'01-15','L0_hover_origin','出発地ポールのツールチップ','出発地のポールにマウスを重ねると、出発地名と経由ルート・所要時間の説明が表示される。');
};
/* ---------- C: L1 市内回遊 ---------- */
GROUPS.C=async(H,page)=>{
  const S='02_L1';
  await H.hideToast();
  await H.setTime('12:00'); await H.settle(3000);
  await H.hl([{sel:'.crumb[data-lvl="city"]',n:'1',note:'「L1 市内回遊・滞留」',pos:'below'}]);
  await H.shot(S,'02-01','L1_overview_1200','L1 市内回遊・滞留（12:00）','姫路駅〜大手前通り〜姫路城を中心に、10mメッシュで滞在人数を表示。高い柱＝人が多いセル、色＝人口密度（人/ha）。',{how:'ヘッダー「L1 市内回遊・滞留」'});
  await H.click('[data-quality-view="axis"]'); await H.settle(3500);
  await H.hl([{sel:'[data-quality-view="axis"]',n:'1',note:'「駅〜城」で軸全体を表示',pos:'left'}]);
  await H.shot(S,'02-02','L1_station_castle_axis','駅〜城の軸を俯瞰','表示設定の「駅〜城」ボタンで、姫路駅から大手前通り・姫路城までの主要動線全体を俯瞰。駅前・通り・城周辺の3か所に滞留が分かれる様子が分かる。',{how:'表示設定「駅〜城」'});
  await H.click('[data-quality-view="station"]'); await H.settle(3500);
  await H.shot(S,'02-03','L1_station_area','姫路駅周辺にズーム','「姫路駅」ボタンで駅前へ移動。駅北口・バスターミナル周辺の滞留セルを詳しく確認できる。');
  await H.click('[data-quality-view="axis"]'); await H.settle(3000);
  await H.pieces(S,'02-04','L1_panel','L1 分析パネル','上から「共通人流モデル・施策比較」「L1 KPI（城内滞留・回遊先滞留・平均滞在時間・回遊率・市内宿泊・市内消費）」「Analytics」「AI STATE / AI ATTENTION」「セグメント」「シナリオ」「回遊先 立寄り」「帰路」「凡例」などが並ぶ。','#panel-body','#panel',{max:6});
  // scenario sakura
  await H.ev(()=>{const e=document.getElementById('scn-chips');document.getElementById('panel-body').scrollTop=e.offsetTop-160;}); await H.wait(300);
  await H.click('#scn-chips [data-scn="sakura"]'); await H.wait(600); await H.setTime('12:00'); await H.settle(3500);
  await H.ev(()=>{const e=document.getElementById('scn-chips');document.getElementById('panel-body').scrollTop=e.offsetTop-160;}); await H.wait(300);
  await H.hl([{sel:'#scn-chips [data-scn="sakura"]',n:'1',note:'シナリオ「桜（4月上旬の週末）」',pos:'right',w:230}]);
  await H.shot(S,'02-10','L1_scenario_sakura','シナリオ切替：桜（4月上旬の週末）','シナリオを切り替えると入城者数/日（平日4,300〜桜・GW15,000人）とセグメント構成が変わり、地図・KPI・グラフがすべて再計算される。桜の週末は駅〜城の滞留が大幅に増える。',{how:'分析パネル「シナリオ」'});
  await H.click('#scn-chips [data-scn="wke"]'); await H.wait(600); await H.setTime('12:00'); await H.settle(2500);
  // segment inbound
  await H.ev(()=>{const e=document.getElementById('seg-chips');document.getElementById('panel-body').scrollTop=e.offsetTop-160;}); await H.wait(300);
  await H.click('#seg-chips [data-s="in"]'); await H.settle(3500);
  await H.ev(()=>{const e=document.getElementById('seg-chips');document.getElementById('panel-body').scrollTop=e.offsetTop-160;}); await H.wait(300);
  await H.hl([{sel:'#seg-chips [data-s="in"]',n:'1',note:'「インバウンド」に絞り込み',pos:'right'}]);
  await H.shot(S,'02-11','L1_segment_inbound','セグメント絞り込み：インバウンド','インバウンドに絞ると、姫路城・好古園・駅〜大手前通りに集中し、商店街などへの広がりが弱いこと（＝回遊の伸びしろ）が分かる。');
  await H.click('#seg-chips [data-s="all"]'); await H.settle(2000);
  await H.ev(()=>{document.getElementById('panel-body').scrollTop=0;});
  // castle hover
  await H.click('[data-quality-view="castle"]'); await H.wait(300); await H.x("setLevel('city',false); flyTo(new THREE.Vector3(CASTLE.x, TH(CASTLE.x,CASTLE.z), CASTLE.z), 1900, 0.9, -0.4, 600)"); await H.settle(3000);
  const c=await H.project("new THREE.Vector3(CASTLE.x, TH(CASTLE.x,CASTLE.z)+45, CASTLE.z)");
  await page.mouse.move(c.x-4,c.y); await page.mouse.move(c.x,c.y); await H.wait(1200);
  await H.shot(S,'02-12','L1_hover_castle','姫路城ホバー → クリックで城内へ','姫路城にマウスを重ねると現在の城内滞留人数と「クリックで城内（L2）へ」が表示される。画面下部にも「姫路城をクリックして城内へ」のヒントが出る。');
  await page.mouse.move(5,500);
  // POI hover
  const poi=await H.x("(()=>{const r=[];NAMED.forEach(o=>{if(o.userData&&o.userData.poi&&o.visible&&o.parent&&o.parent.visible){const w=new THREE.Vector3();o.getWorldPosition(w);const p=w.clone().project(camera);const R=renderer.domElement.getBoundingClientRect();const x=R.left+(p.x+1)/2*R.width,y=R.top+(1-p.y)/2*R.height;if(p.z<1&&x>340&&x<1300&&y>150&&y<700)r.push({n:o.userData.name,x,y});}});return r;})()");
  console.log('POIs',poi.slice(0,10).map(p=>p.n).join(','));
  const target=poi.find(p=>/好古園/.test(p.n))||poi[0];
  if(target){ await page.mouse.move(target.x-3,target.y); await page.mouse.move(target.x,target.y); await H.wait(1200);
    await H.shot(S,'02-13','L1_hover_poi','POIホバー（観光施設の解説）',`POI（${target.n}など）にマウスを重ねると、施設の種類・解説・平均滞在時間が表示される。`); }
  await page.mouse.move(5,500);
  // building card: find a pickable building
  const bp=await H.x("(()=>{for(let y=250;y<700;y+=23)for(let x=420;x<1250;x+=29){const hb=pickBuilding({clientX:x,clientY:y});if(hb)return {x,y};}return null;})()");
  if(bp){ await page.mouse.click(bp.x,bp.y); await H.wait(1500);
    const vis=await H.ev(()=>getComputedStyle(document.getElementById('bcard')).display!=='none');
    if(!vis){ // mesh click may have intercepted; try other
      console.log('bcard not visible; retry'); }
    await H.hl([{rect:[bp.x-10,bp.y-10,20,20],round:12,n:'1',note:'建物をクリック',pos:'left'},{sel:'#bcard',n:'2',badge:'right'}]);
    await H.shot(S,'02-14','L1_building_card','建物情報カード（PLATEAU属性）','建物をクリックすると、国土交通省PLATEAUの属性（建物ID・用途・計測高さ・階数・建築面積・地盤高・LOD・250mメッシュコード）を表示。人流データとは建物ID×メッシュで結合する想定。');
    await H.x('hideBuildingCard()'); }
  // mesh cell detail
  await H.ev(()=>{document.querySelectorAll('#studio details').forEach(d=>d.open=true);});
  await H.click('#insight-top'); await H.settle(3500);
  await H.hl([{sel:'#insight-top',n:'1',note:'「最多地点を詳しく」',pos:'left'},{sel:'#insight-detail',n:'2',badge:'right'}]);
  await H.shot(S,'02-15','L1_mesh_cell_detail','メッシュセルの詳細（固定した地点）','グリッド・柱などのセルをクリック（または「最多地点を詳しく」）すると、その地点の人数・内訳（移動/滞在/待機）・セグメント構成・時間推移などを右側に表示し、地点を固定して比較できる。',{how:'表示設定「最多地点を詳しく」またはセルをクリック'});
  await H.shot(S,'02-16','L1_mesh_cell_detail_crop','固定した地点の詳細パネル（拡大）','固定した地点の詳細パネル。','',{sel:'#insight-detail'});
  await H.click('#insight-detail-close');
  await H.ev(()=>{document.querySelectorAll('#studio details').forEach(d=>d.open=false);});
  // street heat (legacy)
  await H.x("heatMode='all'; HEAT.lastT=-99; applyLayers(); repaintHeat(); renderPanel();"); await H.click('[data-quality-view="axis"]'); await H.settle(3500);
  await H.shot(S,'02-17','L1_street_heat','補助レイヤー：通りの滞留ヒート','通り単位の滞留ヒートマップ（補助レイヤー）。駅・大手前通り・姫路城の「一本道」構造と、時間帯による発熱位置の移動が分かる。表示設定の「選択中の表現・補助レイヤーの詳細」から切替。');
  await H.x("heatMode='off'; HEAT.lastT=-99; applyLayers(); repaintHeat(); renderPanel();");
};
/* ---------- C2: L2 姫路城 ---------- */
GROUPS.D=async(H,page)=>{
  const S='03_L2';
  await H.hideToast(); await H.setTime('12:00');
  await H.click('.crumb[data-lvl="castle"]'); await H.settle(4500);
  await H.hl([{sel:'.crumb[data-lvl="castle"]',n:'1',note:'「L2 姫路城」をクリック\n（L1で姫路城をクリックしても可）',pos:'below',w:280}]);
  await H.shot(S,'03-01','L2_overview_1200','L2 姫路城（12:00）','城内を大手門・三の丸広場・入城口（菱の門）・西の丸・大天守・備前丸の6ゾーンに分け、ゾーン別の滞留・混雑を色（緑＝快適/黄＝やや混雑/赤＝混雑）で表示。',{how:'ヘッダー「L2 姫路城」／L1で姫路城をクリック'});
  await H.pieces(S,'03-02','L2_panel','L2 分析パネル','城内滞留・入城待機・本日入城/大天守上限・平均待ち時間・入城料収入のKPI、ゾーン別の滞留・混雑、入城料（二段階料金）、インサイトを表示。','#panel-body','#panel',{max:5});
  // zone hover
  const z=await H.project("(()=>{const Z=ZONES.find(z=>z.n==='大天守');return new THREE.Vector3(Z.node.x,TH(Z.node.x,Z.node.z)+2,Z.node.z);})()");
  await page.mouse.move(z.x-3,z.y); await page.mouse.move(z.x,z.y); await H.wait(1200);
  await H.shot(S,'03-08','L2_hover_zone','ゾーンのツールチップ（大天守）','ゾーンにマウスを重ねると、ゾーンの役割と現在の人数・待ち時間を表示。大天守は入場制限による律速点。');
  await page.mouse.move(5,500);
  // sakura congestion
  await H.ev(()=>{const e=document.getElementById('scn-chips');document.getElementById('panel-body').scrollTop=e.offsetTop-160;}); await H.wait(200);
  await H.click('#scn-chips [data-scn="sakura"]'); await H.wait(600); await H.setTime('12:00'); await H.settle(3500);
  await H.ev(()=>{document.getElementById('panel-body').scrollTop=0;}); await H.wait(300);
  await H.shot(S,'03-09','L2_sakura_congestion','桜シナリオの城内混雑（12:00）','桜（4月上旬の週末・入城15,000人/日）では、入城口と大天守で待機・混雑が発生。KPIの入城待機人数・平均待ち時間が大きく増える。');
  await H.click('#scn-chips [data-scn="wke"]'); await H.wait(600); await H.setTime('12:00'); await H.settle(2000);
  // floors
  await H.click('#floor-toggle'); await H.settle(4000);
  await H.x("flyTo(new THREE.Vector3(CASTLE.x, TH(CASTLE.x,CASTLE.z)+60, CASTLE.z), 520, 1.12, -0.5, 700)"); await H.settle(3500);
  await H.hl([{sel:'#floor-toggle',n:'1',note:'「≡ 階層」をクリック',pos:'below'}]);
  await H.shot(S,'03-10','L2_floor_view_tenshu','階層ビュー（大天守の階ごとの滞留）','「≡ 階層」で、大天守・駅・商業施設の階ごとの滞留を積層スラブで表示。緯度経度だけでは分からない高さ方向（階）の混雑を可視化する。',{how:'ヘッダー「≡ 階層」'});
  await H.ev(()=>{const f=document.getElementById('floor-rows'); if(f){ const sec=f.closest('.sec'); sec.scrollIntoView({block:'start'}); }}); await H.wait(400);
  const fr=await H.ev(()=>!!document.getElementById('floor-rows'));
  if(fr){ await H.shot(S,'03-11','L2_floor_rows','階層ビューの階別人数','施設ごとの階別人数と容量比（快適/やや混雑/混雑）。','',{sel:'#floor-rows'}); }
  await H.x("setLevel('city',false); (()=>{const at=FLOOR_DEFS[1]?FLOOR_DEFS[1].at():STN; flyTo(new THREE.Vector3(at.x, TH(at.x,at.z)+30, at.z), 700, 1.1, -0.4, 700);})()"); await H.settle(4000);
  await H.shot(S,'03-12','L1_floor_view_station','階層ビュー（駅・商業施設）','駅（改札階・ホーム階）や商業施設でも階ごとの滞留を表示。実データは気圧センサ付き位置情報・BLE/Wi-Fi・階別カメラで取得する想定。');
};
module.exports=GROUPS;
if(require.main===module){
  (async()=>{
    const names=process.argv.slice(2); const G=require('./capture2_groups_loader')(GROUPS);
    for(const name of names){
      const t0=Date.now(); const {browser,page}=await launch({dpr:1.5});
      const H=require('./lib').mk(page,name);
      try{ await G[name](H,page); }catch(e){ console.error('ERR in',name,e); }
      H.save(); console.log(`group ${name} done ${(Date.now()-t0)/1000}s; errors:`, page.__logs.slice(0,5));
      await browser.close();
    }
  })();
}
