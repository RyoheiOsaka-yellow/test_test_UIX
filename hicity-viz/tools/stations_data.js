/* 駅構造データ(構内配置は公開情報に基づく想定・仮説を含む模式モデル)
   z: 地表からの高さ[m] (負=地下) / w×l: ホーム幅×長さ[m] / brg: ホーム方位角(度, 北=0)
   kind: platform(ホーム+線路) | concourse(コンコース/改札) | gate(改札のみ)
   future:true → 新空港線(構想・未開業, 赤表示) */
export const LEVEL_COLORS = { '-3': 0x8a7fff, '-2': 0x8a7fff, '-1': 0x6db4ff, '0': 0x00e5ff, '1': 0x35e0a1, '2': 0xffd166, '3': 0xff7fb2 };

export const STATIONS = [
  {
    id: 'kamata', name: '蒲田', lon: 139.7160, lat: 35.5624, major: true,
    desc: 'JR京浜東北線・東急池上線/多摩川線。新空港線(構想)の地下新駅を想定表示',
    levels: [
      { name: 'GL ホーム(JR 2面3線)', z: 0, kind: 'platform', w: 32, l: 220, brg: 10, tracks: 3, platforms: 2, color: 0x00e5ff },
      { name: 'GL 東急ホーム(頭端式)', z: 0, kind: 'platform', w: 30, l: 130, brg: 100, tracks: 4, platforms: 3, color: 0x00e5ff, dx: -55, dy: 30 },
      { name: '2F 橋上コンコース', z: 7, kind: 'concourse', w: 42, l: 90, brg: 100, color: 0x35e0a1 },
      { name: '東急蒲田地下駅(新設・想定) — 新空港線 第1期', z: -18, kind: 'platform', w: 22, l: 160, brg: 100, tracks: 2, platforms: 1, color: 0xff4d5e, future: true, dy: -25 },
    ],
    links: [  // 連絡通路(整備案の白破線): [x1,y1,z1, x2,y2,z2] 駅ローカルm
      [0, -25, -18, 0, 0, 0],      // 地下新駅 → 東急/JRコンコース直下 立坑
      [0, 0, 0, 0, 30, 7],         // 地上 → 2F橋上コンコース
    ],
    buildings: [  // 駅ビル(公開情報に基づく概形)
      { name: 'グランデュオ蒲田 東館', dx: 30, dy: -10, brg: 10, w: 30, l: 170, h: 55, color: 0xf5c9a0 },
      { name: 'グランデュオ蒲田 西館', dx: -30, dy: 10, brg: 10, w: 30, l: 150, h: 55, color: 0xf5c9a0 },
      { name: '東急プラザ蒲田(屋上に幸せの観覧車)', dx: -90, dy: 40, brg: 100, w: 65, l: 60, h: 34, color: 0xf5a9c0, wheel: true },
      { name: 'アロマスクエア(蒲田駅東)', dx: 200, dy: -110, brg: 10, w: 45, l: 45, h: 93, color: 0xa9c8f5 },
    ],
  },
  {
    id: 'keikyu-kamata', name: '京急蒲田', lon: 139.7231, lat: 35.5611, major: true,
    desc: '京急本線・空港線の重層高架(2F/3F 各1面2線+通過線)。直下に新空港線 京急蒲田地下駅(想定)',
    levels: [
      { name: '1F 改札・コンコース', z: 0, kind: 'concourse', w: 40, l: 120, brg: 170, color: 0x00e5ff },
      { name: '2F ホーム(1面2線+通過)', z: 9, kind: 'platform', w: 26, l: 240, brg: 170, tracks: 3, platforms: 1, color: 0x35e0a1 },
      { name: '3F ホーム(1面2線+通過)', z: 16, kind: 'platform', w: 26, l: 240, brg: 170, tracks: 3, platforms: 1, color: 0xffd166 },
      { name: '京急蒲田地下駅(新設・想定) — 新空港線 第1期/第2期境界', z: -24, kind: 'platform', w: 22, l: 160, brg: 115, tracks: 2, platforms: 1, color: 0xff4d5e, future: true },
    ],
    links: [
      [0, 0, -24, 0, 0, 0],        // 地下新駅 → 1F改札 連絡立坑
    ],
    buildings: [
      { name: 'あすとウィズ(京急蒲田駅ビル)', dx: 30, dy: -20, brg: 170, w: 28, l: 90, h: 28, color: 0xf5c9a0 },
    ],
  },
  {
    id: 'omori', name: '大森', lon: 139.7280, lat: 35.5885, major: true,
    desc: 'JR京浜東北線(島式1面2線)。橋上駅舎を想定模式化',
    levels: [
      { name: 'GL ホーム(1面2線)', z: 2, kind: 'platform', w: 14, l: 220, brg: 160, tracks: 2, platforms: 1, color: 0x00e5ff },
      { name: '2F 橋上コンコース', z: 8, kind: 'concourse', w: 36, l: 70, brg: 70, color: 0x35e0a1 },
    ],
  },
  {
    id: 'oimachi', name: '大井町', lon: 139.7340, lat: 35.6075, major: true,
    desc: 'JR京浜東北線・りんかい線(地下)・東急大井町線。三層構造を模式化',
    levels: [
      { name: 'GL ホーム(JR 1面2線)', z: 0, kind: 'platform', w: 14, l: 220, brg: 155, tracks: 2, platforms: 1, color: 0x00e5ff },
      { name: '2F 東急大井町線(2面3線)', z: 9, kind: 'platform', w: 30, l: 140, brg: 65, tracks: 3, platforms: 2, color: 0x35e0a1, dx: -40, dy: -20 },
      { name: 'B1 コンコース', z: -8, kind: 'concourse', w: 40, l: 80, brg: 155, color: 0x6db4ff },
      { name: 'B3 りんかい線(1面2線)', z: -26, kind: 'platform', w: 18, l: 210, brg: 155, tracks: 2, platforms: 1, color: 0x8a7fff },
    ],
  },
  {
    id: 'tenkubashi', name: '天空橋', lon: 139.7539, lat: 35.5494, major: true,
    desc: '京急空港線(地下2面2線)・東京モノレール(地下)。HICity直結',
    levels: [
      { name: 'GL HICity口・出入口', z: 0, kind: 'gate', w: 24, l: 40, brg: 130, color: 0x00e5ff },
      { name: 'B1 連絡コンコース', z: -7, kind: 'concourse', w: 34, l: 70, brg: 130, color: 0x6db4ff },
      { name: 'B1 モノレールホーム', z: -10, kind: 'platform', w: 16, l: 110, brg: 40, tracks: 2, platforms: 1, color: 0x6db4ff, dx: 25, dy: 25 },
      { name: 'B2 京急ホーム(2面2線)', z: -16, kind: 'platform', w: 24, l: 180, brg: 130, tracks: 2, platforms: 2, color: 0x8a7fff },
    ],
  },
  {
    id: 'otorii', name: '大鳥居', lon: 139.7420, lat: 35.5495, major: true,
    desc: '京急空港線(地下)。第2期構想では新空港線との接続部を想定',
    levels: [
      { name: 'B1 コンコース', z: -6, kind: 'concourse', w: 30, l: 60, brg: 115, color: 0x6db4ff },
      { name: 'B2 ホーム(1面2線)', z: -13, kind: 'platform', w: 16, l: 180, brg: 115, tracks: 2, platforms: 1, color: 0x8a7fff },
    ],
  },
  {
    id: 'anamori', name: '穴守稲荷', lon: 139.7470, lat: 35.5518, major: false,
    desc: '京急空港線(地上2面2線)',
    levels: [
      { name: 'GL ホーム(2面2線)', z: 0, kind: 'platform', w: 20, l: 150, brg: 120, tracks: 2, platforms: 2, color: 0x00e5ff },
    ],
  },
  {
    id: 'kojiya', name: '糀谷', lon: 139.7333, lat: 35.5560, major: false,
    desc: '京急空港線(高架2面2線)',
    levels: [
      { name: '2F ホーム(2面2線)', z: 8, kind: 'platform', w: 20, l: 150, brg: 115, tracks: 2, platforms: 2, color: 0x35e0a1 },
    ],
  },
  {
    id: 'hnd-t3', name: '羽田空港第3ターミナル', lon: 139.7687, lat: 35.5444, major: true,
    desc: '京急(地下1面2線)・モノレール(高架2面)。ターミナル直結',
    levels: [
      { name: '3F モノレールホーム', z: 12, kind: 'platform', w: 22, l: 110, brg: 35, tracks: 2, platforms: 2, color: 0xffd166 },
      { name: 'GL ターミナル連絡', z: 0, kind: 'concourse', w: 40, l: 80, brg: 35, color: 0x00e5ff },
      { name: 'B1 京急ホーム(1面2線)', z: -14, kind: 'platform', w: 18, l: 210, brg: 55, tracks: 2, platforms: 1, color: 0x6db4ff },
    ],
  },
  {
    id: 'hnd-t12', name: '羽田空港第1・第2ターミナル', lon: 139.7860, lat: 35.5460, major: true,
    desc: '京急(地下島式1面2線)。モノレールは第1/第2ビル各駅(地下)',
    levels: [
      { name: 'B1 連絡コンコース', z: -8, kind: 'concourse', w: 44, l: 90, brg: 0, color: 0x6db4ff },
      { name: 'B2 京急ホーム(1面2線)', z: -20, kind: 'platform', w: 20, l: 210, brg: 0, tracks: 2, platforms: 1, color: 0x8a7fff },
      { name: 'B1 モノレール第1ビル', z: -10, kind: 'platform', w: 14, l: 100, brg: 10, tracks: 2, platforms: 1, color: 0x6db4ff, dx: -45, dy: 40 },
      { name: 'B1 モノレール第2ビル', z: -10, kind: 'platform', w: 14, l: 100, brg: 15, tracks: 2, platforms: 1, color: 0x6db4ff, dx: 30, dy: -110 },
    ],
  },
];

/* 小駅(模式ミニ構造): [name, lon, lat, z, brg] */
export const MINOR_STATIONS = [
  ['平和島', 139.7349, 35.5789, 8, 170], ['大森町', 139.7327, 35.5723, 8, 170],
  ['梅屋敷', 139.7266, 35.5666, 8, 170], ['雑色', 139.7156, 35.5497, 8, 165],
  ['六郷土手', 139.7089, 35.5391, 8, 160],
  ['矢口渡', 139.7000, 35.5563, 0, 60], ['武蔵新田', 139.6929, 35.5605, 0, 60],
  ['下丸子', 139.6852, 35.5661, 0, 55], ['鵜の木', 139.6785, 35.5723, 0, 45],
  ['蓮沼', 139.7107, 35.5646, 0, 120], ['池上', 139.7042, 35.5717, 0, 130],
  ['千鳥町', 139.6957, 35.5761, 0, 110], ['久が原', 139.6851, 35.5810, 0, 110],
  ['御嶽山', 139.6788, 35.5857, 0, 115], ['雪が谷大塚', 139.6749, 35.5924, 0, 130],
  ['大森海岸', 139.7357, 35.5875, 8, 165], ['立会川', 139.7387, 35.5983, 8, 165],
  ['流通センター', 139.7521, 35.5786, 10, 30], ['昭和島', 139.7470, 35.5723, 10, 30],
  ['整備場', 139.7461, 35.5556, 6, 20], ['新整備場', 139.7772, 35.5407, 0, 60],
  ['西馬込', 139.7059, 35.5867, -12, 150], ['馬込', 139.7118, 35.5964, -12, 150],
];

/* 路線 3Dプロファイル: pts=[lon,lat,z] z=地表比高さ
   style: solid | dashed / future: 構想(赤) */
export const RAIL_LINES = [
  {
    id: 'keikyu-main', name: '京急本線', color: 0xff5a5a, speed: 50,
    pts: [
      [139.7387, 35.5983, 8], [139.7357, 35.5875, 8], [139.7349, 35.5789, 8],
      [139.7327, 35.5723, 8], [139.7266, 35.5666, 8], [139.7231, 35.5611, 12],
      [139.7156, 35.5497, 8], [139.7089, 35.5391, 8],
    ],
  },
  {
    id: 'keikyu-airport', name: '京急空港線', color: 0xff8a8a, speed: 45,
    pts: [
      [139.7231, 35.5611, 12], [139.7333, 35.5560, 8], [139.7420, 35.5495, -13],
      [139.7470, 35.5518, 0], [139.7539, 35.5494, -16], [139.7687, 35.5444, -14],
      [139.7860, 35.5460, -20],
    ],
  },
  {
    id: 'monorail', name: '東京モノレール', color: 0x4da3ff, speed: 45,
    pts: [
      [139.7521, 35.5786, 10], [139.7470, 35.5723, 10], [139.7461, 35.5556, 6],
      [139.7539, 35.5494, -10], [139.7600, 35.5462, -6], [139.7687, 35.5444, 12],
      [139.7772, 35.5407, 0], [139.7830, 35.5440, -10], [139.7877, 35.5498, -12],
    ],
  },
  {
    id: 'jr-keihin', name: 'JR京浜東北線・東海道線', color: 0x7fd8a8, speed: 55,
    pts: [
      [139.7340, 35.6075, 0], [139.7280, 35.5885, 2], [139.7231, 35.5787, 2],
      [139.7160, 35.5624, 0], [139.7080, 35.5480, 4],
    ],
  },
  {
    id: 'rinkai', name: 'りんかい線(地下)', color: 0x9fd8ff,
    pts: [[139.7340, 35.6075, -26], [139.7450, 35.6090, -30]],
  },
  {
    id: 'tokyu-tamagawa', name: '東急多摩川線', color: 0xffb0d0, speed: 35,
    pts: [
      [139.7160, 35.5624, 0], [139.7107, 35.5646, 0], [139.7000, 35.5563, 0],
      [139.6929, 35.5605, 0], [139.6852, 35.5661, 0], [139.6785, 35.5723, 0],
    ],
  },
  {
    id: 'tokyu-ikegami', name: '東急池上線', color: 0xd0a8ff, speed: 35,
    pts: [
      [139.7160, 35.5624, 0], [139.7107, 35.5646, 0], [139.7042, 35.5717, 0],
      [139.6957, 35.5761, 0], [139.6851, 35.5810, 0], [139.6788, 35.5857, 0],
      [139.6749, 35.5924, 0],
    ],
  },
  {
    id: 'asakusa', name: '都営浅草線(地下)', color: 0xffc9a8,
    pts: [[139.7059, 35.5867, -12], [139.7118, 35.5964, -12], [139.7231, 35.5787, -14]],
  },
  /* ---- 新空港線(蒲蒲線) 構想・未開業 — 大田区公表の整備案(縦断面図)に基づく想定 ---- */
  {
    id: 'shinkuko-1', name: '新空港線 第1期 [矢口渡〜京急蒲田・構想]', color: 0xff2d44, future: true, speed: 45,
    tunnel: true, portal: { lon: 139.7022, lat: 35.5578, label: '地下化区間 坑口(想定)' },
    desc: '整備案: 矢口渡駅の先で東急多摩川線から地下化し、多摩川線直下を通って東急蒲田地下駅(新設)→京急蒲田地下駅(新設)へ 約1.7km',
    pts: [
      [139.6960, 35.5585, 0],   // 多摩川線 地上区間(武蔵新田方)
      [139.7000, 35.5563, 0],   // 矢口渡駅(地上)
      [139.7022, 35.5578, -4],  // 坑口・下り勾配
      [139.7060, 35.5610, -12],
      [139.7107, 35.5646, -16], // 蓮沼直下(通過)
      [139.7160, 35.5624, -18], // 東急蒲田地下駅(新設)
      [139.7200, 35.5615, -21],
      [139.7231, 35.5611, -24], // 京急蒲田地下駅(新設)
    ],
  },
  {
    id: 'shinkuko-2', name: '新空港線 第2期 [京急蒲田〜大鳥居・構想]', color: 0xff2d44, future: true, dashed: true, speed: 45,
    tunnel: true,
    desc: '整備案: 京急蒲田地下駅から産業道路・空港線直下を東進、糀谷駅直下(通過)を経て大鳥居駅で京急空港線に接続',
    pts: [
      [139.7231, 35.5611, -24], // 京急蒲田地下駅
      [139.7290, 35.5585, -22],
      [139.7333, 35.5560, -20], // 糀谷駅直下(通過)
      [139.7385, 35.5522, -16],
      [139.7420, 35.5495, -13], // 大鳥居駅 接続
    ],
  },
];
