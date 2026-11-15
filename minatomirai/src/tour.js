// ガイドツアー: 「朝の通勤」「昼の滞在」「K アリーナ終演」などの場面を順に見せる。
// 場面ごとに 視点・時刻・テーマ・人流と分析の表示 を切り替え、画面下に説明文を出す。終了すると開始前の表示に戻す。
import * as THREE from 'three';
import { EVENTS } from './people_model.js';

const fmt = n => (n >= 1000 ? Math.round(n / 100) * 100 : Math.round(n)).toLocaleString('ja-JP');   // 推計値なので 1,000 以上は 100 単位に丸める
const hm = h => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

export function initTour(ctx) {
  const { getViewState, applyViewState, flyTo, people, buildingMeta, terrainSampler } = ctx;
  const el = document.getElementById('tour'), $ = id => document.getElementById(id);
  let idx = -1, saved = null, auto = false, timer = null, autoT0 = 0;
  const bld = q => buildingMeta.findIndex(m => m && m.n && (q instanceof RegExp ? q.test(m.n) : m.n.includes(q)));
  const center = i => { const m = buildingMeta[i]; return [m.c[0] / 10, m.c[1] / 10]; };
  const station = id => { const s = people.model?.stations.find(q => q.id === id); return s ? [s.x, s.y] : [0, 0]; };
  // 視点: 注視点 (x, y) から 方位 az (度, 0 = 北から見る・時計回り)、仰角 el、距離 dist の位置にカメラを置く
  const view = ([x, y], dist, az = 200, elv = 38, lift = 0) => {
    const a = az * Math.PI / 180, e = elv * Math.PI / 180, gy = Math.max(0, terrainSampler(x, y)) + lift;
    return [new THREE.Vector3(x + Math.sin(a) * Math.cos(e) * dist, gy + Math.sin(e) * dist, -(y + Math.cos(a) * Math.cos(e) * dist)), new THREE.Vector3(x, gy, -y)];
  };
  const railOut = h => { const d = people.day(); return people.model.stationFlows(h, d).filter(s => !s.nonRail).reduce((a, s) => a + s.toCity, 0); };
  const railIn = h => { const d = people.day(); return people.model.stationFlows(h, d).filter(s => !s.nonRail).reduce((a, s) => a + s.toStation, 0); };
  const PP = { on: true, day: 'weekday', rain: false, event: null, ribbon: 'volume', signals: true, agents: true, vol: true, look: 'dots', nonRail: true, accel: 8, meshes: false, playing: false };
  const AN = { layer: 'none', bmetric: 'none', tab: 'heat', floorHeat: false, diff: 'none', split: false, style: 'flat', flows: false, multi: false, range: null };
  const markis = bld('MARK IS'), lmp = bld('ランドマークプラザ'), karena = bld(EVENTS.karena.match);

  const SCENES = [
    { title: '街の全体像', h: 15, th: 'paper', cam: () => view([80, -80], 1900, 205, 44),
      text: () => `みなとみらい 21 と横浜駅東口、桜木町、馬車道までの約 2.8 km 四方です。帯の太さは歩行者の通行量、点は歩いている人を表します。平日 15 時の推計で、いま約 ${fmt(people.count * people.state.per)} 人が歩いています。` },
    { title: '朝の通勤', h: 8.25, th: 'paper', pp: { look: 'trails', accel: 14 }, cam: () => view(station('mm'), 1000, 300, 38),
      text: () => `平日 ${hm(8.25)}。駅から街へ向かう人は毎時 約 ${fmt(railOut(8.25))} 人で、1 日のピークです。桜木町駅と みなとみらい駅からオフィス街へ、線の向きが流れの方向を示します。` },
    { title: '混雑と信号待ち', h: 8.5, th: 'paper', pp: { ribbon: 'los', signals: true }, cam: () => view(station('mm'), 820, 200, 62),
      text: () => `帯の色を混雑度に切り替えました。通行量を歩道の有効幅員で割った値を、歩行者サービス水準 A〜F で色分けしています。地上の歩道はほとんどが水準 A（薄い青）で、暖色の区間ほど混んでいます。この時刻の最大は流動係数 ${Math.round(people.stat.maxF)} 人/m/分です。横断歩道では信号待ちが発生し、いま約 ${fmt(people.waiting * people.state.per)} 人が待っています。` },
    { title: '昼の滞在', h: 12.5, th: 'paper', pp: { agents: false }, an: { layer: 'stay', style: 'bars' }, cam: () => view([120, -120], 1800, 190, 40),
      text: () => `平日 ${hm(12.5)}。建物に滞在している人数を、100 m 四方の柱の高さで表しています。オフィスが集まるクイーン軸沿いと横浜駅東口が高くなります。` },
    { title: '等値線で見る歩行者密度', h: 12.5, th: 'paper', an: { layer: 'ped', style: 'contour' }, pp: { agents: false, vol: false }, cam: () => view([60, -200], 1500, 180, 52),
      text: () => `同じ時刻の歩行者密度を等値線で描きました。数字は 1 ha あたりの歩行者数です。駅の出口から外側へ、密度が段階的に下がっていく様子が読み取れます。` },
    markis >= 0 && { title: '建物の中の動き', h: 13, th: 'paper', sel: markis, gap: 9, ind: { on: true, flow: true }, an: { tab: 'bldg', floorHeat: true }, cam: () => view(center(markis), 430, 215, 30, 60),
      text: () => `MARK IS みなとみらいを階ごとに分解しました。公式フロアマップから読み取ったエレベーターとエスカレーターの位置を使い、入口から各店舗までの動線の密度を床に色で示しています。` },
    lmp >= 0 && { title: 'どこから来て、次にどこへ行くか', h: 14, th: 'paper', sel: lmp, gap: 0, an: { tab: 'bldg', flows: true }, pp: { vol: false }, cam: () => view(center(lmp), 1500, 150, 33),
      text: () => `ランドマークプラザの商圏です。弧の太さは 1 日の来訪者数で、駅ごとの割合を添えています。紫と桃色の弧は、ここを出た人が次に向かう先です。` },
    karena >= 0 && { title: 'K アリーナ横浜の終演', h: 21.25, th: 'night', pp: { event: 'karena', ribbon: 'diff', look: 'trails', accel: 14 }, cam: () => view(center(karena), 1250, 25, 36),
      text: () => `2 万人規模の公演が 21 時に終わった直後です。帯は通常の日との差で、赤いほど通行量が増えています。駅へ向かう人は毎時 約 ${fmt(railIn(21.25))} 人。横浜駅と新高島駅へ向かう経路に集中します。` },
    { title: '雨の日', h: 12.5, th: 'paper', pp: { rain: true, ribbon: 'diff' }, cam: () => view([80, -260], 1400, 200, 44),
      text: () => `雨の日は屋根の無い区間を避けると仮定しています。帯は晴れの日との差で、青は減った区間、赤は増えた区間です。地下通路や屋根付きのデッキへ流れが寄ります。` },
    { title: '浸水のリスク', h: 15, th: 'paper', pp: { on: false }, an: { bmetric: 'hightide' }, cam: () => view([-150, 150], 1700, 170, 54),
      text: () => `建物の色は、PLATEAU の建物属性にある高潮の想定浸水深です。海沿いの低い街区で深くなります。人の分布と重ねると、避難の検討に使えます。` },
  ].filter(Boolean);

  function render() {
    const s = SCENES[idx];
    el.innerHTML = `<div class="tour-head"><span class="tour-step">${idx + 1} / ${SCENES.length}</span><b>${s.title}</b><button id="tour-x" title="終了">×</button></div>
      <div class="tour-text">${s.text()}</div>
      <div class="tour-dots">${SCENES.map((q, i) => `<i data-i="${i}" class="${i === idx ? 'cur' : ''}" title="${q.title}"></i>`).join('')}</div>
      <div class="tour-btns"><button id="tour-prev" ${idx === 0 ? 'disabled' : ''}>← 前へ</button><button id="tour-auto" class="${auto ? 'active' : ''}">${auto ? '■ 自動再生を止める' : '▶ 自動再生'}</button><button id="tour-next">${idx === SCENES.length - 1 ? '終了' : '次へ →'}</button></div>
      <div class="tour-bar"><i id="tour-prog"></i></div>`;
    $('tour-x').onclick = stop; $('tour-prev').onclick = () => go(idx - 1); $('tour-next').onclick = () => idx === SCENES.length - 1 ? stop() : go(idx + 1);
    $('tour-auto').onclick = () => { auto = !auto; schedule(); render(); };
    el.querySelectorAll('.tour-dots i').forEach(d => { d.onclick = () => go(+d.dataset.i); });
  }
  const DUR = 13000;
  function schedule() { clearTimeout(timer); timer = null; autoT0 = performance.now(); if (auto) timer = setTimeout(() => { if (idx < SCENES.length - 1) go(idx + 1); else { auto = false; render(); } }, DUR); }
  function go(i, instant = false) {
    if (i < 0 || i >= SCENES.length) return; idx = i; const s = SCENES[i];
    applyViewState({ th: s.th, h: s.h, pp: { ...PP, ...(s.pp || {}) }, an: { ...AN, ...(s.an || {}) }, ind: s.ind ?? { on: saved?.ind?.on ?? true, flow: false }, sel: s.sel ?? null, gap: s.gap });
    people.update(0); const [pos, target] = s.cam(); flyTo(pos, target, instant);
    render(); schedule(); setTimeout(() => { if (idx === i && el.querySelector('.tour-text')) el.querySelector('.tour-text').innerHTML = s.text(); }, 1800);   // 人数は場面が落ち着いてから入れ直す
  }
  function start(i = 0, instant = false) { if (idx < 0) saved = getViewState(); el.style.display = 'block'; document.body.classList.add('touring'); go(i, instant); }
  function stop() {
    if (idx < 0) return; clearTimeout(timer); timer = null; auto = false; idx = -1; el.style.display = 'none'; el.innerHTML = ''; document.body.classList.remove('touring');
    if (saved) { const st = saved; saved = null; applyViewState({ ...st, pp: { ...st.pp, playing: false } }); }
  }
  window.addEventListener('keydown', e => { if (idx < 0 || e.target.matches?.('input, select, textarea')) return; if (e.key === 'ArrowRight') go(Math.min(SCENES.length - 1, idx + 1)); else if (e.key === 'ArrowLeft') go(idx - 1); else if (e.key === 'Escape') stop(); });
  const update = () => { if (idx >= 0 && auto) { const p = $('tour-prog'); if (p) p.style.width = `${Math.min(100, (performance.now() - autoT0) / DUR * 100)}%`; } };
  return { start, stop, go, update, get active() { return idx >= 0; }, get index() { return idx; }, scenes: SCENES.map(s => s.title), setAuto: v => { auto = !!v; schedule(); if (idx >= 0) render(); } };
}
