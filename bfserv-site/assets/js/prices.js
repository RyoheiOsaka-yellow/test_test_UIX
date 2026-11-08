/* BFSERV — 出張自転車修理 料金データ（出張費・消費税込み）
   Source: bfserv.co.jp/area_prices/shinagawa/ (2026-11 時点)  ※全対応エリア共通料金として掲載 */
window.BF_PRICES = {
  updated: '2026-11',
  areas: [
    { id: 'shinagawa', jp: '品川区', en: 'Shinagawa', main: true },
    { id: 'minato', jp: '港区', en: 'Minato', main: true },
    { id: 'shibuya', jp: '渋谷区', en: 'Shibuya', main: true },
    { id: 'meguro', jp: '目黒区', en: 'Meguro', main: true },
    { id: 'ota', jp: '大田区', en: 'Ota', main: true },
    { id: 'setagaya', jp: '世田谷区', en: 'Setagaya', main: false },
    { id: 'koto', jp: '江東区', en: 'Koto', main: false },
    { id: 'chiyoda', jp: '千代田区', en: 'Chiyoda', main: false },
    { id: 'chuo', jp: '中央区', en: 'Chuo', main: false }
  ],
  groups: [
    {
      id: 'g00', code: '00', title: 'パンク修理', time: '作業時間 20〜30分', cols: ['区分', '内容', '料金'],
      rows: [
        ['00-1 自転車向け', 'タイヤ1本分（虫ゴム交換 前後分含む）', 3000],
        ['00-1 自転車向け', 'タイヤ2本分（虫ゴム交換 前後分含む）', 4900],
        ['00-2 eバイク・ファットバイク', '前輪分', '6,900円〜'],
        ['00-2 eバイク・ファットバイク', '後輪分', '9,900円〜']
      ],
      notes: ['パンク1ヶ所分を含みます。2ヶ所目以降は自転車向け +300円／eバイク・ファットバイク向け +500円。']
    },
    {
      id: 'g01', code: '01', title: 'チューブ交換', time: '作業時間 20〜30分', cols: ['区分', '前輪（英式）', '後輪（英式）'],
      rows: [
        ['01-1 シティサイクル・小径車', 6400, 6900],
        ['01-2 電動アシスト', 6800, 7900]
      ],
      extra: [['01-3 法人様向け パンクレスチューブ交換（前後輪・部品代含む）', '25,900円', 'シティサイクル・小径車・アシスト対応／チューブ2本分 約12,000円を含む']],
      notes: ['米式・仏式バルブは割高になります。']
    },
    {
      id: 'g02', code: '02', title: 'タイヤ・チューブ交換 1（普通自転車）', time: '作業時間 20〜30分', cols: ['区分', '対象サイズ', '前輪（英式）', '後輪（英式）'],
      rows: [
        ['02-1 シティサイクル', '24・26・27インチ × 1-3/8、× 1-1/2', 7400, 7900],
        ['02-2 小径車', '14・16・18・20インチ × 1.75・1.95', 8800, 9900]
      ],
      notes: ['上記以外のサイズはお問い合わせください。', '日本メーカー以外の自転車は別途費用がかかります。', '米式・仏式バルブは割高になります。', '交換部品例：パナレーサー製ロイヤルロード、IRC製シティポップ など']
    },
    {
      id: 'g03', code: '03', title: 'タイヤ・チューブ交換 2（電動アシスト）', time: '作業時間 20〜30分', cols: ['区分', '対象サイズ', '前輪（英式）', '後輪（英式）'],
      rows: [
        ['03-1', '24・26・27インチ × 1-3/8', 8800, 9900],
        ['03-2', '前：24・26・27 × 1-1/2 ／ 後：22・24・26・27 × 1-1/2', 9800, 10900],
        ['03-3', '20インチ × 1.75・1.95', 9800, 10900],
        ['03-4', '20インチ × 1-3/8', 10800, 11900],
        ['03-5', '24インチ × 1.75', 9800, 10900],
        ['03-6【在庫分のみ】', '26インチ × 1.75・2.00', 10800, 11900],
        ['03-7', '前：20インチ × 1-3/4 ・ 22 × 1-1/2', 11800, 12900],
        ['03-8.1', '20インチ × 2.125', 10800, 11900],
        ['03-8.2', '20インチ × 2.00', 11800, 12900]
      ],
      notes: ['上記以外のサイズはお問い合わせください。', '日本メーカー以外の自転車は別途費用がかかります。', '米式・仏式バルブは割高になります。']
    },
    {
      id: 'g04', code: '04', title: 'ブレーキ関連', time: '作業時間 10〜30分', cols: ['区分', '前輪', '後輪', '前後輪'],
      rows: [
        ['04-1 ブレーキワイヤー交換', '5,400円<span class="sub">他作業と同時 2,800円</span>', '5,400円<span class="sub">他作業と同時 2,400円</span>', 7800],
        ['04-2 ブレーキケーブル交換', '5,900円<span class="sub">他作業と同時 2,900円</span>', '5,900円<span class="sub">他作業と同時 2,900円</span>', 8800]
      ],
      extra: [
        ['04-3 ブレーキパッド交換（前輪用・アルミ／ステンレスリム用）', '5,400円', '他作業と同時 2,400円'],
        ['04-3 ブレーキパッド交換（前または後輪・ロード／Vブレーキ用）', '6,400円', '他作業と同時 3,400円'],
        ['04-4 サーボブレーキ交換（後輪）', '7,900円', '他作業と同時 5,900円／後輪チューブ・タイヤ交換と同時 4,900円'],
        ['04-4 ローラーブレーキ交換【冷却フィン付き】（後輪）', '11,900円', '他作業と同時 9,900円／後輪チューブ・タイヤ交換と同時 8,900円'],
        ['04-4 NEXUS リヤハブローラーブレーキ交換（後輪）', '13,900円', '他作業と同時 11,900円／後輪チューブ・タイヤ交換と同時 10,900円']
      ]
    },
    {
      id: 'g05', code: '05', title: '変速関連', time: '作業時間 20〜30分', cols: ['区分', '通常料金', '他作業と同時'],
      rows: [
        ['05-1 フロント変速ケーブル交換', 5900, 2900],
        ['05-1 リヤ外装変速ワイヤー交換', 5900, 2900],
        ['05-2 内装3段用変速ワイヤー交換', 7400, 4400],
        ['05-2 11／8／7／5スピード用ワイヤー交換', 6900, 3900]
      ]
    },
    {
      id: 'g06', code: '06', title: 'チェーン関連', time: '作業時間 10〜20分', cols: ['区分', '作業内容', '通常料金', '他作業と同時'],
      rows: [
        ['06-1 シティサイクル・小径車', 'シングルギヤ用（ギヤ無し・内装3速用）', 7600, 4600],
        ['06-1 シティサイクル・小径車', '変速ギア用（6・7・8速）', 7900, 4900],
        ['06-2 電動アシスト', 'シングルギヤ用（ギヤ無し・内装3速用）', 8600, 5600],
        ['06-2 電動アシスト', '変速ギア用（6・7・8速）', 8900, 5900],
        ['06-3 各種自転車', 'チェーン調整', '6,900円〜', '3,900円〜']
      ],
      notes: ['変速ギア用で9速以上はお問い合わせください。']
    },
    {
      id: 'g07', code: '07', title: 'カギ関連', time: '作業時間 10〜30分', cols: ['区分', '内容', '料金'],
      rows: [
        ['07-1 カギ壊し', '前輪・後輪用カギ壊し／ワイヤー錠切断', '5,900円〜'],
        ['07-1 カギ壊し', 'スチールリンク錠・チェーン錠切断', '9,200円〜'],
        ['07-2 既存鍵壊し＋新規カギ取付', 'シリンダー前輪錠', 6900],
        ['07-2 既存鍵壊し＋新規カギ取付', '後輪用リング錠（カギ式／暗証番号式）', 7500],
        ['07-2 既存鍵壊し＋新規カギ取付', '後輪用Vブレーキ用（カギ式／ボタン式）', 7900],
        ['07-2 既存鍵壊し＋新規カギ取付', '電動アシスト用（パナソニック・ブリヂストン・ヤマハのみ）', '別途お見積り']
      ]
    },
    {
      id: 'g08', code: '08', title: 'その他各種作業', time: '出張費＋税込み', cols: ['作業', '料金'],
      rows: [
        ['自転車メンテナンス', '2,200円〜（種類・台数による）'],
        ['自転車各種チェック', '1,100円〜（種類・台数による）'],
        ['自転車組立て（通販・オークション等で購入した自転車）', '5,500円〜9,900円'],
        ['TSマーク（緑・赤）', '別途お見積り'],
        ['事故自転車修理', '別途お見積り'],
        ['自転車廃棄', '別途ご相談'],
        ['コンポーネント関連の交換・取付け', '別途お見積り'],
        ['スタンド・ホイール・チャイルドシート・カゴ・サドル・ライト・ベル・フェンダー・キャリアの交換・取付け', '別途お見積り'],
        ['上記以外の修理・部品交換', 'お問い合わせください']
      ]
    }
  ]
};

/* 車いす出張修理 料金（出張費・税込み） Source: bfserv.co.jp/area_prices/wheelchair/ */
window.BF_WC_PRICES = {
  updated: '2026-07',
  groups: [
    { id: 'wA', code: 'A', title: 'パンク修理', cols: ['内容', '料金'], rows: [
      ['タイヤ片側 1本', 5900], ['タイヤ両方 2本', 7900], ['パンク2ヶ所目以降（1ヶ所につき）', '+300円'],
      ['スーパーバルブ交換（左右分・英式用）', 600], ['米式変換バルブ交換（左右分・英式→米式）', 900] ] },
    { id: 'wB', code: 'B', title: 'チューブ交換', cols: ['内容', '料金'], rows: [
      ['片側 1本（英式バルブ）', 6800], ['2本／1台分（英式バルブ）', 11800], ['片側 1本（米式バルブ）', 7400], ['2本／1台分（米式バルブ）', 12800], ['ノーパンクチューブ交換 2本分', 22800] ] },
    { id: 'wC', code: 'C', title: 'タイヤ・チューブ交換（1台分）', cols: ['内容', '料金'], rows: [
      ['12〜24インチ × 1-3/8、14・16インチ × 1.75（英式）', 14800], ['同（米式）', 15800],
      ['IRC エクセレーサー 25-501／520／540／559（英式）', 19800], ['同（米式）', 20800],
      ['タイヤ・ノーパンクチューブ交換（対応サイズは上記と同じ）', 26800],
      ['ノーパンクタイヤ交換（メーカー指定サイズ・ハイポリマー／ソリッドタイヤ等）', '別途お見積り'] ] },
    { id: 'wE', code: 'E', title: 'メンテナンス', cols: ['内容', '料金'], rows: [ ['車いすメンテナンス', '2,200円〜8,800円'] ] }
  ]
};

/* renderer */
(() => {
  const yen = v => typeof v === 'number' ? `<span class="yen">${v.toLocaleString()}<small>円</small></span>` : (/^[\d,]+円$/.test(String(v)) ? `<span class="yen">${String(v).replace('円', '')}<small>円</small></span>` : v);
  function render(data, mount) {
    if (!mount) return;
    mount.innerHTML = data.groups.map(g => `
      <section class="price-group" id="${g.id}" data-title="${g.title}">
        <div class="price-group__head"><span class="code">${g.code}</span><h3>${g.title}</h3>${g.time ? `<span class="time">${g.time}</span>` : ''}</div>
        <div class="price-table-wrap"><table class="price-table">
          <thead><tr>${g.cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
          <tbody>${g.rows.map(r => `<tr>${r.map((c, i) => `<td>${i === 0 ? c : yen(c)}</td>`).join('')}</tr>`).join('')}
          ${(g.extra || []).map(r => `<tr><td colspan="${Math.max(1, g.cols.length - 2)}">${r[0]}</td><td>${yen(r[1])}</td><td colspan="${g.cols.length > 3 ? 1 : 1}"><span class="sub">${r[2] || ''}</span></td></tr>`).join('')}
          </tbody></table></div>
        ${g.notes ? `<ul class="price-notes">${g.notes.map(n => `<li>${n}</li>`).join('')}</ul>` : ''}
      </section>`).join('');
  }
  const m1 = document.querySelector('[data-prices="bicycle"]'); if (m1) render(window.BF_PRICES, m1);
  const m2 = document.querySelector('[data-prices="wheelchair"]'); if (m2) render(window.BF_WC_PRICES, m2);
  const nav = document.querySelector('[data-price-nav]');
  if (nav && m1) nav.innerHTML = window.BF_PRICES.groups.map(g => `<a class="chip" href="#${g.id}">${g.code} ${g.title}</a>`).join('');

  /* search */
  const q = document.querySelector('[data-price-search]');
  if (q) {
    const empty = document.querySelector('.price-empty');
    q.addEventListener('input', () => {
      const s = q.value.trim().toLowerCase(); let any = false;
      document.querySelectorAll('.price-group').forEach(g => {
        let hit = 0;
        g.querySelectorAll('tbody tr').forEach(tr => { const ok = !s || tr.textContent.toLowerCase().includes(s) || g.dataset.title.toLowerCase().includes(s); tr.classList.toggle('is-hidden', !ok); if (ok) hit++; });
        g.classList.toggle('is-hidden', hit === 0); if (hit) any = true;
      });
      if (empty) empty.style.display = any ? 'none' : 'block';
    });
  }
})();
