/* ================================================================
   ▼ 拡張モジュール11: 📱 モバイル/タブレット対応 ＋ 🌐 日英切替（v14）
   タッチ操作（1指=回転/席視点首振り、2指=ピンチズーム＋パン）、
   900px以下でパネルをボトムシート化するレスポンシブ、
   辞書＋MutationObserverによる主要UI（見出し・KPIラベル・チップ・
   ボタン・ヘルプ・ステータス）の日英切替。長文解説は日本語のまま。
================================================================ */
(function(){
'use strict';
/* --- タッチ操作 --- */
const T={pts:new Map(), d0:0, c0:null};
function pinchInfo(){
  const a=[...T.pts.values()];
  if(a.length<2) return null;
  return {d:Math.hypot(a[0].x-a[1].x, a[0].y-a[1].y), cx:(a[0].x+a[1].x)/2, cy:(a[0].y+a[1].y)/2};
}
el.addEventListener('touchstart', e=>{
  for(const t of e.changedTouches) T.pts.set(t.identifier, {x:t.clientX, y:t.clientY});
  const p=pinchInfo(); if(p){ T.d0=p.d; T.c0={x:p.cx, y:p.cy}; ctrl.rotating=false; }
  if(e.touches.length>1) e.preventDefault();
}, {passive:false});
el.addEventListener('touchmove', e=>{
  e.preventDefault();
  if(e.touches.length===1 && T.pts.size===1){
    const t=e.touches[0], prev=T.pts.get(t.identifier); if(!prev) return;
    const dx=t.clientX-prev.x, dy=t.clientY-prev.y;
    T.pts.set(t.identifier, {x:t.clientX, y:t.clientY});
    if(window.__svActive){ if(window.__svTurn) window.__svTurn(dx,dy); return; }
    if(!ctrl.enabled || dragState.active) return;
    ctrl.sph.theta -= dx*0.0055; ctrl.sph.phi -= dy*0.0048; ctrl.apply();
  } else if(e.touches.length>=2){
    for(const t of e.changedTouches) T.pts.set(t.identifier, {x:t.clientX, y:t.clientY});
    const p=pinchInfo(); if(!p || !T.d0) return;
    const k=T.d0/p.d;
    if(window.__svActive){ if(window.__svZoom) window.__svZoom(Math.pow(k,0.6)); T.d0=p.d; return; }
    if(!ctrl.enabled) return;
    ctrl.sph.radius *= k; T.d0=p.d;
    if(T.c0){
      const s=ctrl.sph.radius*0.0013;
      const fwd=new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y=0; fwd.normalize();
      const right=new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0,1,0)).negate();
      ctrl.target.addScaledVector(right, -(p.cx-T.c0.x)*s).addScaledVector(fwd, (p.cy-T.c0.y)*s);
      T.c0={x:p.cx, y:p.cy};
    }
    ctrl.apply();
  }
}, {passive:false});
['touchend','touchcancel'].forEach(ev=> el.addEventListener(ev, e=>{
  for(const t of e.changedTouches) T.pts.delete(t.identifier);
  if(T.pts.size<2){ T.d0=0; T.c0=null; }
}));

/* --- モバイル: パネルのボトムシート開閉ハンドル --- */
const mq=matchMedia('(max-width:900px)');
const handle=document.createElement('button'); handle.id='sheet-handle'; handle.textContent='▲ パネル';
document.body.appendChild(handle);
const panelEl2=document.getElementById('panel');
handle.onclick=()=>{ const c=panelEl2.classList.toggle('sheet-open'); handle.textContent = c ? '▼ 閉じる' : '▲ パネル'; };
function applyMQ(){ document.body.classList.toggle('mobile', mq.matches); if(!mq.matches) panelEl2.classList.remove('sheet-open'); }
mq.addEventListener ? mq.addEventListener('change', applyMQ) : mq.addListener(applyMQ);
applyMQ();

/* --- 日英切替 --- */
const DICT={
 'アリーナ内部 — 座席マーケティング':'Arena — seat marketing','サイト人流 — ブレックスアリーナ広域（東西5.4km）':'Site flows — Brex Arena wide area (5.4 km E-W)','エントランス広場 — 出店シミュレーション':'Entrance plaza — vendor simulation',
 '実測校正 — J-ticket CSV':'Calibration — J-ticket CSV','未校正（合成値）':'uncalibrated (synthetic)','校正済':'calibrated','複製':'Duplicate','削除':'Delete',
 '🎨 内観素材':'🎨 Interior materials','— 座席実色・テクスチャ・LED演出':'— seat colors / textures / LED','🏛 外観調整':'🏛 Facade tuning','— 実写トレース（写真と照合して調整）':'— photo tracing (match against photos)',
 '西面(広場)':'West (plaza)','東面':'East','北面':'North','南面(LRT)':'South (LRT)',
 '東西5.4km・駅→アリーナ':'5.4 km E-W · station → arena','JR宇都宮駅と複合体を同一画面に':'Station and complex in one frame','出店シミュレーション':'Vendor simulation','西面サイン・キャノピーを正面から':'West sign & canopy head-on',
 'アリーナ内部・標準ビュー':'Arena interior · default view','ベンチ側からの低いアングル':'Low angle from bench side','客席全体と看板の関係':'Stands vs. boards overview','照明バトン・センタービジョン':'Lighting battens · center vision',
 '見出し':'Heading','座席':'Seats','モード':'Modes',
 '幹線道路':'Arterial road','補助幹線':'Secondary road','歩行者道・商店街（オリオン通り等）':'Pedestrian st. / shopping (Orion-dori)','歩道・自転車道':'Sidewalk / cycle path','JR・私鉄':'JR / private rail','宇都宮ライトレール（LRT）':'Utsunomiya Light Rail (LRT)','公園・緑地':'Park / green','商業集積':'Retail cluster','教育施設':'Education','宿泊施設（OSM実データ 28軒）':'Lodging (OSM, 28)',
 '試合日宿泊需要（遠征8%×転換45%）':'Game-day lodging demand (away 8% × conv. 45%)','宿泊消費/試合':'Lodging spend / game','街の賑わい上昇（試合日平均）':'City vibrancy uplift (game-day avg.)','年間寄与換算（ホーム30試合）':'Annualized (30 home games)',
 '席種凡例（仮説価格）':'Seat classes (hypothetical prices)','看板別露出レポート — クリックで単体ヒートマップ':'Per-board exposure — click for heatmap','全看板 合成露出':'All boards (composite)',
 'ブロック':'Block','席数':'Seats','販売':'Sales','FC率':'FC %','年間シート':'Season seat','プラチナ会員':'Platinum','ゴールド会員':'Gold','レギュラー会員':'Regular','FC非会員':'Non-member',
 '合成':'synthetic','✓実測':'✓ measured',
 'ブレックスアリーナ宇都宮 デジタルツイン — 宇都宮ブレックス ホームゲーム':'Brex Arena Utsunomiya Digital Twin — Utsunomiya Brex Home Game',
 'L0 サイト俯瞰':'L0 Site','L1 エントランス':'L1 Entrance','L2 アリーナ内部':'L2 Arena',
 '表示':'View','分析':'Analysis','ツール':'Tools','◆ 点群ビュー':'◆ Point cloud','🏗 BIM詳細':'🏗 BIM','🗺 2D席図':'🗺 2D seat map',
 '📷 VPS':'📷 VPS','◎ OD分析':'◎ OD analysis','⇄ クロス分析':'⇄ Cross analysis','🗾 観光導線':'🗾 Tourism routes','👁 視認測定':'👁 Visibility',
 '◎ 視点 ▾':'◎ Views ▾',
 '累計来場者':'Cumulative visitors','現在場内':'Currently inside','移動中エージェント':'Moving agents','フェーズ':'Phase',
 'レイヤー':'Layers','土地利用':'Land use','歩行者・商店街':'Pedestrian / shopping st.','POI':'POI','宿泊':'Lodging','点描（広域）':'Dots (wide)','回遊フロー':'Post-game flows',
 '凡例 — 交通・土地利用':'Legend — Transport / land use','賑わいヒートマップ — 通り単位':'Vibrancy heatmap — by street','OFF':'OFF','通常日':'Normal day','試合日':'Game day','ブレックス寄与':'Brex uplift',
 '観光 × スポーツ — ブレックス寄与（仮説）':'Tourism × Sports — Brex contribution (hypothesis)','操作':'Controls',
 'L1 エントランス広場 — 出店シミュレーション':'L1 Entrance plaza — vendor simulation','出店を追加':'Add vendor','＋ キッチンカー':'+ Food truck','＋ グッズテント':'+ Merch tent','インサイト':'Insight',
 '出店数':'Vendors','現在の総行列':'Total queue now','累計売上推定':'Est. cumulative sales','場内充足率':'Arena fill rate',
 'L2 アリーナ内部 — 座席マーケティング':'L2 Arena — seat marketing','対象試合':'Target game','表示レイヤー':'Display layer',
 'リアル観客ビュー':'Live crowd view','席種・価格マップ':'Seat class / price map','稼働率ヒートマップ':'Occupancy heatmap','スポンサー露出解析':'Sponsor exposure','価格最適化':'Price optimization',
 '時間帯連動で観客を描画':'Crowd drawn by time of day','チケットカテゴリ別の色分け':'Colored by ticket category','試合別の販売率をセクション表示':'Sales rate by section per game','看板別レポート＋単体ヒートマップ':'Per-board report + heatmap','露出×販売率から推奨価格を提案':'Recommended price from exposure × sales',
 '想定チケット収入':'Est. ticket revenue','平均スポンサー露出':'Avg. sponsor exposure','完売間近セクション':'Near-sellout sections','場内売店 総行列':'Concession queue','場内F&B累計売上':'F&B cumulative sales',
 'vs 千葉J（週末）':'vs Chiba J (weekend)','vs A東京（週末）':'vs A Tokyo (weekend)','vs 群馬（平日）':'vs Gunma (weekday)','シーズン平均':'Season average',
 'CSVを読み込んで販売率を上書き':'Load CSV to override sales rates',
 '🏗 BIM 場内ディテール — 部材レイヤー':'🏗 BIM interior detail — element layers','階段':'Stairs','手すり':'Railings','構造柱':'Columns','開口部':'Openings','ボミトリー開口':'Vomitory openings',
 '席種':'Class','販売率':'Sales','FC会員':'Fan club','露出':'Exposure','視認等級':'Grade','FC→3D反映':'FC → 3D',
 '有効視認席（B以上）':'Effective seats (≥B)','実効リーチ（販売率×品質加重）':'Effective reach (sales × quality)','CPM（¥/1,000露出）':'CPM (¥/1,000 imp)','リーチ単価（¥/席・試合）':'Cost per reach (¥/seat·game)',
 '視認等級の閾値 — 文字高視角[分]':'Grade thresholds — letter visual angle [arcmin]','ロゴ・図形（緩）':'Logo (loose)','文字可読（標準）':'Text legible (std)','小文字・URL（厳）':'Small text / URL (strict)',
 'レートカードCSVを読み込んで単価を上書き':'Load rate-card CSV','並び替え':'Sort','コスパ(CPM)':'Efficiency (CPM)','リーチ':'Reach','掲出料':'Rate','等級ヒートマップ':'Grade heatmap','選択看板の正対ビュー':'Face selected board',
 '割安':'Under','割高':'Over','適正':'Fair',
 'コート正面':'Face court','✕ 戻る':'✕ Back','✕ 閉じる':'✕ Close','首振り角（コート正面基準）':'Yaw (from court front)','俯仰角':'Pitch','画角（水平）':'FOV (horizontal)','視野内の看板':'Boards in view',
 '🏛 外観調整 — 実写トレース（写真と照合して調整）':'🏛 Facade tuning — photo tracing','屋根形状':'Roof shape','フラット':'Flat','アーチ':'Vault','切妻':'Gable','稜線 東西':'Ridge E-W','稜線 南北':'Ridge N-S','グレー':'Gray','ホワイト':'White','ダーク':'Dark',
 '屋根ライズ':'Roof rise','カーテンウォール':'Curtain wall','方立ピッチ':'Mullion pitch','帯 高さ':'Band height','帯 下端高さ':'Band base height','立面写真オーバーレイ':'Elevation photo overlay','航空写真オーバーレイ（地面）':'Aerial photo overlay (ground)',
 '不透明度':'Opacity','幅':'Width','高さ':'Height','中心高さ':'Center height','横オフセット':'Lateral offset','回転':'Rotation','中心 X':'Center X','中心 Z':'Center Z',
 '立面写真を読み込む':'Load elevation photo','航空写真を読み込む':'Load aerial photo','設定JSONをコピー':'Copy settings JSON','JSONを貼付けて読込':'Paste JSON to load','初期値':'Defaults',
 '🎨 内観素材 — 座席実色・テクスチャ・LED演出':'🎨 Interior materials — seat colors / textures / LED','座席実色（観客ビュー時）':'Real seat colors (crowd view)','段床/床テクスチャ':'Tier / floor textures','LED動画演出':'LED animation','配色を初期値へ':'Reset palette',
 'フロア仮設席':'Floor seats','1F可動スタンド':'1F rollback','2F東西 前列(1-4列)':'2F E/W front (rows 1-4)','2F東西 後列(5-8列)':'2F E/W rear (rows 5-8)','2F北南':'2F N/S','3F自由席':'3F general',
 '開場前':'Pre-open','入場ピーク':'Entry peak','試合終了・退場':'Final / exit','ハーフタイム':'Halftime','タイムライン ▶ で試合日をシミュレーション開始':'Press ▶ to simulate game day',
 '16:00 開場':'16:00 Open','18:05 TIP OFF':'18:05 TIP OFF','19:00 HT':'19:00 HT','20:30 終了':'20:30 End',
 '操作ガイド — ブレックスアリーナ宇都宮 デジタルツイン':'Guide — Brex Arena Utsunomiya Digital Twin','基本操作':'Basics','ドラッグ':'Drag','右ドラッグ':'Right-drag','ホイール':'Wheel','クリック':'Click',
 '回転':'Rotate','平行移動':'Pan','ズーム':'Zoom','席視点（一人称）':'Seat view (first person)','首振り':'Look around','画角ズーム（望遠）':'FOV zoom (telephoto)','終了':'Exit','ショートカット':'Shortcuts','パネル':'Panel',
 'L0 サイト ／ L1 広場 ／ L2 アリーナ':'L0 Site / L1 Plaza / L2 Arena','タイムライン 再生／停止':'Timeline play / pause','点群ビュー':'Point cloud','BIM詳細':'BIM detail','2D席図':'2D seat map','視認測定':'Visibility','左パネルの折畳':'Toggle left panel','このガイド':'This guide',
 'クリックでセクションを折畳（状態は保持）':'Click to fold a section (state kept)','アリーナ→内部へ ／ 座席→チケットカード ／ 部材→BIM属性':'Arena → inside / seat → ticket card / element → BIM props',
 'タイムライン再生（15:00〜22:00・空と場内演出が連動）':'Timeline (15:00–22:00; sky & production linked)','選択物の回転／複製／削除':'Rotate / duplicate / delete selection',
 '🏀 アリーナをクリックして内部へ':'🏀 Click the arena to enter','パネルを開く ▶':'Open panel ▶','▲ パネル':'▲ Panel','▼ 閉じる':'▼ Close',
 'サイト俯瞰':'Site overview','駅からアリーナへ':'Station → arena','エントランス広場':'Entrance plaza','ファサード（夕景）':'Facade (dusk)','コート全景':'Court overview','コートサイド低視点':'Courtside low angle','2Fスタンド俯瞰':'2F stand overview','屋根トラス見上げ':'Roof truss look-up',
};
const RULES=[
 [/^(\S+?)ブロック (\d+)列(?: (\d+)番)?(.*)$/, (m,a,b,c,rest)=> a+' Block · Row '+b+(c?' · Seat '+c:'')+(rest||'')],
 [/^席視点: (.*)$/, (m,a)=>'Seat view: '+a],
 [/^販売率 (\(合成\)|✓実測)｜(.*)$/, (m,a,b)=>'Sales rate '+(a==='✓実測'?'✓ measured':'(synthetic)')+' | '+(DICT[b]||b)],
 [/^(\d[\d,.]*) ?席$/, (m,a)=>a+' seats'],[/^(\d[\d,.]*) ?人$/, (m,a)=>a+' people'],
 [/^席$/, ()=>'seats'],[/^人$/, ()=>'people'],[/^万$/, ()=>'×10k'],[/^億$/, ()=>'×100M'],[/^泊$/, ()=>'nights'],[/^基$/, ()=>'units'],[/^本$/, ()=>'pcs'],[/^箇所$/, ()=>'places'],[/^m$/, ()=>'m'],
 [/^(.+)（(.+)）$/, (m,a,b)=> (DICT[a]&&DICT[b]) ? DICT[a]+' ('+DICT[b]+')' : m[0]],
];
let lang='ja';
try{ lang=localStorage.getItem('brex_lang')||'ja'; }catch(e){}
const store=new Map();
function tr(s){
  const t=s.trim(); if(!t) return s;
  if(DICT[t]!=null) return s.replace(t, DICT[t]);
  for(const r of RULES){ const m=t.match(r[0]); if(m){ return s.replace(t, r[1].apply(null,m)); } }
  return s;
}
function translateNode(root){
  const w=document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while((n=w.nextNode())){
    const p=n.parentNode; if(!p || p.tagName==='SCRIPT' || p.tagName==='STYLE') continue;
    const rec=store.get(n);
    if(rec && n.data===rec.en) continue;
    const en=tr(n.data);
    if(en!==n.data){ store.set(n,{jp:n.data, en}); n.data=en; }
  }
}
let obs=null;
function setLang(l){
  lang=l; try{ localStorage.setItem('brex_lang', l); }catch(e){}
  document.documentElement.lang = l==='en' ? 'en' : 'ja';
  langBtn.textContent = l==='en' ? '🌐 日本語' : '🌐 EN';
  if(l==='en'){
    translateNode(document.body);
    if(!obs){
      obs=new MutationObserver(recs=>{ recs.forEach(r=>{
        if(r.type==='characterData') translateNode(r.target.parentNode||document.body);
        r.addedNodes.forEach(nd=>{ if(nd.nodeType===1) translateNode(nd); else if(nd.nodeType===3 && nd.parentNode) translateNode(nd.parentNode); });
      }); });
      obs.observe(document.body, {childList:true, subtree:true, characterData:true});
    }
  } else {
    if(obs){ obs.disconnect(); obs=null; }
    store.forEach((rec,n)=>{ if(n.data===rec.en) n.data=rec.jp; });
    store.clear();
  }
}
const langBtn=(function(){
  const d=document.createElement('div'); d.className='crumb'; d.id='lang-toggle'; d.textContent='🌐 EN';
  d.title='日英切替（主要UI。長文解説は日本語のまま）';
  const grp=document.getElementById('tb-tool')||document.getElementById('lvl-crumb'); grp.appendChild(d); return d;
})();
langBtn.onclick=()=> setLang(lang==='en'?'ja':'en');
if(lang==='en') setTimeout(()=>setLang('en'), 0);
window.__setLang=setLang;
})();
