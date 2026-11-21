#!/usr/bin/env python3
"""Build data/traffic.json from published traffic counts.

Sources (downloaded when not cached in --src):
  * 東京都建設局「令和3年度 全国道路・街路交通情勢調査 一般交通量調査結果」(道路交通センサス, 区部・平日)
      総括表 CSV            https://www.kensetsu.metro.tokyo.lg.jp/documents/d/kensetsu/000028575
      時間別内訳表 CSV      https://www.kensetsu.metro.tokyo.lg.jp/documents/d/kensetsu/000028577
      観測地点別調査票 CSV  https://www.kensetsu.metro.tokyo.lg.jp/documents/d/kensetsu/000064980  (方向別・車線数・推移)
      休日 時間別内訳表 CSV https://www.kensetsu.metro.tokyo.lg.jp/documents/d/kensetsu/000028580  (首都高は対象外)
  * 国土交通省「『首都圏』における高速道路の主な区間の交通量増減」代表断面交通量 速報値 (2020〜2023年の13日分)
      https://www.mlit.go.jp/road/content/00NNNNNNN.pdf   (values transcribed in MLIT below)

Usage: python3 tools/build_traffic.py [--src DIR]
"""
import csv, io, json, os, re, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[sys.argv.index('--src') + 1] if '--src' in sys.argv else os.path.join(HERE, '.traffic_src')
BASE = 'https://www.kensetsu.metro.tokyo.lg.jp/documents/d/kensetsu/'
FILES = {'summary': '000028575', 'hourly': '000028577', 'sheets': '000064980', 'holidayHourly': '000028580'}


def load(key):
    os.makedirs(SRC, exist_ok=True)
    path = os.path.join(SRC, FILES[key] + '.bin')
    if not os.path.exists(path):
        print('downloading', BASE + FILES[key])
        with urllib.request.urlopen(BASE + FILES[key]) as r, open(path, 'wb') as f:
            f.write(r.read())
    text = open(path, 'rb').read().decode('cp932', errors='replace')
    return list(csv.reader(io.StringIO(text)))


def num(s):
    s = s.replace(',', '').replace('－', '').strip()
    try:
        return float(s) if '.' in s else int(s)
    except ValueError:
        return None


def is_station(r):
    return len(r) > 20 and re.match(r'^\d+', r[0].strip()) and r[1].strip()


# ---------------------------------------------------------------- summary table (12 h / 24 h)
stations = {}
rows = load('summary')
for i, r in enumerate(rows):
    if not is_station(r):
        continue
    nxt = rows[i + 1] if i + 1 < len(rows) else []
    has24 = len(nxt) > 13 and not nxt[0].strip() and not nxt[1].strip() and num(nxt[13]) is not None
    sid = r[3].strip()
    v12 = num(r[13])
    ratio = num(r[17])
    st = {
        'routeNo': r[0].strip(), 'route': r[1].strip(), 'section': r[2].strip(), 'id': sid,
        'v12': v12, 'v24': num(nxt[13]) if has24 else (round(v12 * ratio) if v12 and ratio else None),
        'v24est': not has24,                      # True: 24 h = 12 h × 昼夜率 (not observed)
        'car12': num(r[7]), 'smallTruck12': num(r[8]), 'bus12': num(r[9]), 'truck12': num(r[10]),
        'hv': num(r[14]),                         # 昼間12時間大型車混入率 (%)
        'peakVol': num(r[15]), 'peakPct': num(r[16]), 'nightRatio': ratio, 'congestion': num(r[18]),
        'h27': num(r[20]), 'growth': num(r[21]),  # 平成27年度 24h/12h 交通量, 伸び率 (R3/H27)
        'vUp': num(r[22]), 'vDown': num(r[23]),   # 朝夕旅行速度 上り / 下り (km/h)
        'date': r[24].strip(), 'weather': r[25].strip(), 'agency': r[26].strip(),
    }
    stations[sid] = st

# ---------------------------------------------------------------- hourly table (large / small per hour)
rows = load('hourly')
HOURS = list(range(7, 19)) + [None] + list(range(19, 24)) + list(range(0, 7))  # column order from col 4
for i, r in enumerate(rows):
    if not (len(r) > 30 and re.match(r'^\d+', r[0].strip()) and r[1].strip()):
        continue
    sid = r[3].strip()
    if sid not in stations:
        continue
    large_row, small_row = rows[i - 1], r
    large, small = [0] * 24, [0] * 24
    ok = True
    for k, h in enumerate(HOURS):
        if h is None:
            continue
        a, b = num(large_row[4 + k]), num(small_row[4 + k])
        if a is None or b is None:
            ok = False
            break
        large[h], small[h] = a, b
    if ok:
        stations[sid]['hourly'] = {'large': large, 'small': small}  # index = clock hour (0 = 0:00–1:00)
        tot = sum(large) + sum(small)
        if abs(tot - (stations[sid]['v24'] or 0)) > 5:
            print('  note: hourly sum differs from 24h total at', sid, tot, stations[sid]['v24'])

# ---------------------------------------------------------------- per-station sheets: direction, lanes, history
rows = load('sheets')
cur = None
YEARS = None
for i, r in enumerate(rows):
    c = [x.strip() for x in r]
    if len(c) > 5 and c[1].startswith('■ 観') and '地' in c[1] and c[4]:
        cur = stations.get(c[4])
        section = None
        continue
    if cur is None:
        continue
    if len(c) > 4 and c[1] == '年度':
        YEARS = [x for x in c[3:12]]
    elif len(c) > 4 and c[1] == '交通量' and YEARS:
        cur['history12'] = {y: num(v) for y, v in zip(YEARS, c[3:12]) if num(v) is not None}  # 台/12h
    for k, x in enumerate(c):
        if x.startswith('車線数') and k + 1 < len(c) and num(c[k + 1]) is not None:
            cur['lanes'] = num(c[k + 1])
    if len(c) > 18 and c[3] in ('大型車', '小型車'):
        if c[2] in ('上 り', '下 り', '合 計'):
            section = {'上 り': 'up', '下 り': 'down', '合 計': 'total'}[c[2]]
        if section in ('up', 'down'):
            d = cur.setdefault('dir', {}).setdefault(section, {})
            key = 'large' if c[3] == '大型車' else 'small'
            vals = [num(x) for x in c[4:16]]
            if all(v is not None for v in vals):
                d[key + '12h'] = vals              # hours 7..18
                d[key + '12'] = num(c[16])
                d[key + '24'] = num(c[18])           # None where only 12 h were observed
for st in stations.values():
    d = st.get('dir')
    if not d or not all(k in d.get(x, {}) for x in ('up', 'down') for k in ('large12h', 'small12h')):
        st.pop('dir', None)
        continue
    for x in ('up', 'down'):
        d[x]['v12'] = d[x]['large12'] + d[x]['small12']
        d[x]['v24'] = (d[x]['large24'] + d[x]['small24']) if d[x].get('large24') is not None and d[x].get('small24') is not None else None

# ---------------------------------------------------------------- holiday (Sunday) vs weekday hourly ratio
# The census has no holiday count on the Shuto Expressway. The stations counted on both day types
# (東名・中央道・外環・関越・京葉道路・第三京浜) give the ratio of holiday to weekday hourly volume by class.
wk_rows = load('hourly')
hol_rows = load('holidayHourly')
def hourly_table(rows):
    out = {}
    for i, r in enumerate(rows):
        if not (len(r) > 30 and re.match(r'^\d+', r[0].strip()) and r[1].strip()):
            continue
        large, small = [0] * 24, [0] * 24
        ok = True
        for k, h in enumerate(HOURS):
            if h is None:
                continue
            a, b = num(rows[i - 1][4 + k]), num(r[4 + k])
            if a is None or b is None:
                ok = False
                break
            large[h], small[h] = a, b
        if ok:
            out[r[3].strip()] = {'large': large, 'small': small, 'name': r[1].strip() + ' ' + r[2].strip()}
    return out
wk, hol = hourly_table(wk_rows), hourly_table(hol_rows)
pairs = [k for k in hol if k in wk]
ratio_s = [sum(hol[k]['small'][h] for k in pairs) / max(1, sum(wk[k]['small'][h] for k in pairs)) for h in range(24)]
ratio_l = [sum(hol[k]['large'][h] for k in pairs) / max(1, sum(wk[k]['large'][h] for k in pairs)) for h in range(24)]

# ---------------------------------------------------------------- MLIT representative sections (台/日, 全車, 速報値)
# transcribed from the PDFs; columns: date, weekday, PDF id, then value / comparison-year value per section
MLIT_SECTIONS = {'5890': ('6号向島線', '箱崎JCT～江戸橋JCT'), '5450': ('3号渋谷線', '高樹町～谷町JCT'), '6150': ('中央環状線', '富ヶ谷～初台南'), '6030': ('7号小松川線', '京葉道～一之江'), 'all': ('首都高', '代表22断面平均')}
MLIT = [
    # date,        dow,  pdf,         5890 (v, ref),      5450,             6150,             6030,             首都高 集計
    ('2020-09-08', '火', '001362714', (128600, 133500), (71900, 79800), (90100, 97200), (54200, 53200), (83700, 91400)),
    ('2020-11-02', '月', '001371029', (123800, 125900), (71400, 69600), (84400, 91600), (53800, 48000), (83200, 88200)),
    ('2021-10-15', '金', '001428326', (132000, 137600), (79700, 79800), (91300, 96400), (61100, 50700), (90800, 91700)),
    ('2022-03-04', '金', '001477289', (129200, 143200), (73400, 81200), (88600, 97700), (58100, 51000), (86600, 91800)),
    ('2022-05-28', '土', '001484194', (148900, 149700), (75600, 77900), (83800, 96200), (61700, 51100), (84300, 89500)),
    ('2022-07-23', '土', '001492852', (139600, 138300), (73600, 75600), (92600, 93600), (55800, 47100), (85300, 89200)),
    ('2022-08-20', '土', '001498821', (138300, 143200), (76500, 79100), (88700, 99100), (60500, 50900), (87100, 93700)),
    ('2022-12-28', '水', '001581998', (139400, 143300), (79300, 79500), (91700, 92100), (59600, 55800), (88100, 86100)),
    ('2023-01-01', '日', '001583888', (108600, 119800), (62300, 66700), (70400, 73500), (46900, 46500), (67400, 72700)),
    ('2023-04-11', '火', '001602530', (130800, 131600), (74300, 79400), (89400, 92300), (57900, 48200), (84800, 86600)),
    ('2023-04-25', '火', '001609445', (130500, 132300), (75500, 79900), (92000, 96700), (59100, 50100), (86500, 91000)),
    ('2023-04-28', '金', '001609448', (137800, 135800), (79500, 73900), (96000, 94600), (64300, 52100), (91600, 91900)),
]
mlit_series = {}
for row in MLIT:
    for sid, pair in zip(['5890', '5450', '6150', '6030', 'all'], row[3:]):
        mlit_series.setdefault(sid, []).append({'date': row[0], 'dow': row[1], 'pdf': row[2], 'v': pair[0], 'ref': pair[1]})
# Saturday / ordinary-weekday ratio (2022–23): Saturdays 5/28, 7/23, 8/20 vs weekdays 3/4, 4/11, 4/25
def sat_ratio(sid):
    ser = {x['date']: x['v'] for x in mlit_series[sid]}
    sat = [ser[d] for d in ('2022-05-28', '2022-07-23', '2022-08-20')]
    wkd = [ser[d] for d in ('2022-03-04', '2023-04-11', '2023-04-25')]
    return round((sum(sat) / 3) / (sum(wkd) / 3), 3)
day_type = {
    'holiday': {
        'label': '休日（推定）',
        'volumeRatio': {'6': sat_ratio('5890'), '3': sat_ratio('5450'), '7': sat_ratio('6030'), 'C2': sat_ratio('6150'), 'exp': sat_ratio('all'), 'surface': 1.0},
        'hourRatioSmall': [round(x, 4) for x in ratio_s], 'hourRatioLarge': [round(x, 4) for x in ratio_l],
        'pairedStations': [hol[k]['name'] for k in pairs],
        'basis': '日交通量: 国土交通省 代表断面の土曜 (2022/5/28, 7/23, 8/20) ÷ 平日 (2022/3/4, 2023/4/11, 4/25)。時間変動・車種: 道路交通センサス休日調査（日曜、首都高は対象外）で平日・休日とも観測された地点の時間別比を適用。一般道の日交通量は休日データがなく平日値のまま。',
    },
}

# default hourly shape for surface roads without a 24 h count: mean of the surface stations that have one
surf = [s for s in stations.values() if 'hourly' in s and '高速' not in s['route'] and '自動車道' not in s['route']]
shape_s = [0.0] * 24
shape_l = [0.0] * 24
for s in surf:
    t = sum(s['hourly']['large']) + sum(s['hourly']['small'])
    for h in range(24):
        shape_s[h] += s['hourly']['small'][h] / t / len(surf)
        shape_l[h] += s['hourly']['large'][h] / t / len(surf)

# ---------------------------------------------------------------- site definitions
# Section ends are approximate positions (±100 m) of the junctions / ramps that bound each census section.
EDO, HAKO_W, HAKO_J = [35.6843, 139.7775], [35.6818, 139.7859], [35.6822, 139.7889]
RYOGOKU = [35.6884, 139.7898]
OHASHI_J = [35.6528, 139.6899]
sites = {
    'hakozaki': {
        'sections': [
            {'station': '5890', 'rk': '6', 'kind': 'exp', 'refs': ['6', '9'], 'from': EDO, 'to': HAKO_W, 'up': EDO},
            {'station': '5900', 'rk': '6', 'kind': 'exp', 'refs': ['6', '9'], 'from': HAKO_W, 'to': HAKO_J, 'up': EDO},
            {'station': '5910', 'rk': '6', 'kind': 'exp', 'refs': ['6'], 'from': HAKO_J, 'to': [35.6848, 139.7897], 'up': EDO, 'approx': '箱崎JCT〜両国JCT間を等分'},
            {'station': '5920', 'rk': '6', 'kind': 'exp', 'refs': ['6'], 'from': [35.6848, 139.7897], 'to': [35.6866, 139.7899], 'up': EDO, 'approx': '箱崎JCT〜両国JCT間を等分'},
            {'station': '5930', 'rk': '6', 'kind': 'exp', 'refs': ['6'], 'from': [35.6866, 139.7899], 'to': RYOGOKU, 'up': EDO, 'approx': '箱崎JCT〜両国JCT間を等分'},
            {'station': '5940', 'rk': '6', 'kind': 'exp', 'refs': ['6'], 'from': RYOGOKU, 'to': [35.6925, 139.7915], 'up': EDO},
            {'station': '6000', 'rk': '7', 'kind': 'exp', 'refs': ['7'], 'from': RYOGOKU, 'to': [35.6906, 139.7892], 'up': RYOGOKU},
            {'station': '6050', 'rk': 'exp', 'kind': 'exp', 'refs': ['9'], 'from': HAKO_J, 'to': [35.6775, 139.7962], 'up': HAKO_J},
            {'station': '6060', 'rk': 'exp', 'kind': 'exp', 'refs': ['9'], 'from': [35.6775, 139.7962], 'to': [35.6728, 139.8013], 'up': HAKO_J},
            {'station': '40760', 'kind': 'surface', 'refs': ['50'], 'label': '新大橋通り'},
            {'station': '40360', 'kind': 'surface', 'refs': ['10'], 'label': '永代通り'},
            {'station': '62510', 'kind': 'surface', 'refs': ['474'], 'label': '清洲橋通り'},
            {'station': '62530', 'kind': 'surface', 'refs': ['475'], 'label': '水天宮通り'},
        ],
        # connecting roads have no count of their own: estimates from the balance of the adjacent sections
        'ramps': [
            {'match': '箱崎ロータリー', 'v24': 32257, 'basis': '箱崎出入口の前後区間差 130,808 − 98,551（下限）'},
            {'match': '9号|深川', 'v24': 45531, 'basis': '9号深川線 箱崎JCT〜福住 の区間交通量'},
            {'match': '', 'v24': 22766, 'basis': 'JCT 収支からの転向交通量の平均 (27,592 + 17,940) / 2'},
        ],
        'turning': {'name': '箱崎JCT', 'legs': {'6号 江戸橋側': 98551, '6号 両国側': 88899, '9号 福住側': 45531}},
    },
    'ohashi': {
        'sections': [
            {'station': '5460', 'rk': '3', 'kind': 'exp', 'refs': ['3'], 'from': [35.6583, 139.7071], 'to': [35.6560, 139.6960], 'up': [35.6583, 139.7071]},
            {'station': '5470', 'rk': '3', 'kind': 'exp', 'refs': ['3'], 'from': [35.6560, 139.6960], 'to': OHASHI_J, 'up': [35.6583, 139.7071]},
            {'station': '5480', 'rk': '3', 'kind': 'exp', 'refs': ['3'], 'from': OHASHI_J, 'to': [35.6480, 139.6812], 'up': [35.6583, 139.7071]},
            {'station': '5490', 'rk': '3', 'kind': 'exp', 'refs': ['3'], 'from': [35.6480, 139.6812], 'to': [35.6443, 139.6729], 'up': [35.6583, 139.7071]},
            {'station': '22030', 'kind': 'surface', 'refs': ['246'], 'from': [35.6575, 139.6985], 'to': [35.6525, 139.6895], 'label': '玉川通り（国道246号）'},
            {'station': '22040', 'kind': 'surface', 'refs': ['246'], 'from': [35.6525, 139.6895], 'to': [35.6455, 139.6760], 'label': '玉川通り（国道246号）'},
            {'station': '42070', 'kind': 'surface', 'refs': ['317'], 'names': '山手通り', 'from': [35.6585, 139.6870], 'to': [35.6522, 139.6885], 'label': '山手通り（環状六号線）'},
            {'station': '42200', 'kind': 'surface', 'refs': ['317'], 'names': '山手通り', 'from': [35.6522, 139.6885], 'to': [35.6460, 139.6935], 'label': '山手通り（環状六号線）'},
            {'station': '61200', 'kind': 'surface', 'refs': ['423'], 'from': [35.6567, 139.6935], 'to': [35.6555, 139.6860], 'label': '淡島通り'},
            {'station': '61210', 'kind': 'surface', 'refs': ['423'], 'from': [35.6555, 139.6860], 'to': [35.6540, 139.6790], 'label': '淡島通り'},
        ],
        'ramps': [
            {'match': '渋谷', 'v24': 4700, 'basis': '渋谷出入口の前後区間差 67,142 − 62,442（下限）'},
            {'match': '池尻', 'v24': 8876, 'basis': '池尻出入口の前後区間差 107,990 − 99,114（下限）'},
            {'match': '', 'v24': 36672, 'basis': '大橋JCT の前後区間差 99,114 − 62,442（中央環状線との連絡、下限）'},
        ],
        'underground': [  # 山手トンネル: counted, but underground and therefore not part of the point-cloud model
            {'station': '6130'}, {'station': '6140'},
        ],
    },
}

keep_routes = ['高速都心環状線', '高速６号向島線', '高速９号深川線', '高速７号小松川線', '高速３号渋谷線', '高速中央環状線', '高速１号上野線']
used = {s['station'] for site in sites.values() for s in site['sections'] + site.get('underground', [])}
out_st = {k: v for k, v in stations.items() if v['route'] in keep_routes or k in used}
missing = used - set(out_st)
if missing:
    sys.exit('stations not found: %s' % missing)

out = {
    'meta': {
        'sources': [
            {'id': 'census-r3', 'publisher': '東京都建設局', 'title': '令和3年度 全国道路・街路交通情勢調査（道路交通センサス）一般交通量調査結果 区部・平日 総括表／24時間自動車類交通量時間別内訳表',
             'date': '2021年9〜11月観測（首都高は10月中の平日）', 'url': 'https://www.kensetsu.metro.tokyo.lg.jp/road/information/3sensasu'},
            {'id': 'mlit-2023', 'publisher': '国土交通省', 'title': '「首都圏」における高速道路の主な区間の交通量増減（対2019年比）代表断面交通量 速報値（トラカン等による計測）',
             'date': '2020年9月〜2023年4月の13日分', 'url': 'https://www.mlit.go.jp/road/content/001609448.pdf'},
        ],
        'notes': [
            '交通量は自動車類台数。首都高と 24 時間観測の一般道は方向別（上り・下り）の観測値を使う。方向別の夜間 12 時間は、合計の時間別台数を方向別の夜間計で按分。',
            '休日は首都高の観測がないため推定値（dayType.holiday.basis を参照）。',
            '24時間観測のない一般道地点は「12時間交通量 × 昼夜率」で 24 時間値を推定し、時間変動は 24 時間観測のある一般道地点の平均形状を用いる。',
            '連結路（ランプ・JCT）には観測値がない。前後区間の差から求めた推定値（下限）を表示している。',
            '区間境界の位置は概略（±100 m 程度）。',
        ],
    },
    'stations': out_st,
    'surfaceShape': {'small': [round(x, 5) for x in shape_s], 'large': [round(x, 5) for x in shape_l], 'n': len(surf)},
    # transcribed from the MLIT table (台/日, 全車): 2023-04-28 (Fri) vs 2019-04-26 (Fri)
    'mlit2023': [
        {'route': '6号向島線', 'section': '箱崎JCT～江戸橋JCT', 'v2023': 137800, 'v2019': 135800, 'station': '5890'},
        {'route': '3号渋谷線', 'section': '高樹町～谷町JCT', 'v2023': 79500, 'v2019': 73900, 'station': '5450'},
        {'route': '中央環状線', 'section': '富ヶ谷～初台南', 'v2023': 96000, 'v2019': 94600, 'station': '6150'},
        {'route': '中央環状線', 'section': '大井JCT～五反田', 'v2023': 56600, 'v2019': 57400, 'station': '6120'},
        {'route': '7号小松川線', 'section': '京葉道～一之江', 'v2023': 64300, 'v2019': 52100, 'station': '6030'},
    ],
    'mlitSeries': mlit_series, 'mlitSections': MLIT_SECTIONS,
    'dayType': day_type,
    'sites': sites,
}
path = os.path.join(HERE, '..', 'data', 'traffic.json')
json.dump(out, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('wrote', os.path.normpath(path), os.path.getsize(path) // 1024, 'KB;', len(out_st), 'stations,', sum(1 for s in out_st.values() if 'hourly' in s), 'with hourly data; surface shape from', len(surf), 'stations')
for sid in sorted(used):
    s = out_st[sid]
    print(' ', sid, s['route'], s['section'], '24h', s['v24'], '(推定)' if s['v24est'] else '', '上り/下り', (s['dir']['up']['v24'] or s['dir']['up']['v12'], s['dir']['down']['v24'] or s['dir']['down']['v12']) if 'dir' in s else '-', 'lanes', s.get('lanes'), 'hist', list(s.get('history12', {}).values())[-3:])
print('holiday volume ratios', day_type['holiday']['volumeRatio'])
print('holiday/weekday hourly ratio small', [round(x, 2) for x in ratio_s])
print('holiday/weekday hourly ratio large', [round(x, 2) for x in ratio_l])
print('paired stations', len(pairs))
