#!/usr/bin/env python3
"""Build data/traffic.json from published traffic counts.

Sources (downloaded when not cached in --src):
  * 東京都建設局「令和3年度 全国道路・街路交通情勢調査 一般交通量調査結果」(道路交通センサス, 区部・平日)
      総括表 CSV            https://www.kensetsu.metro.tokyo.lg.jp/documents/d/kensetsu/000028575
      時間別内訳表 CSV      https://www.kensetsu.metro.tokyo.lg.jp/documents/d/kensetsu/000028577
  * 国土交通省「『首都圏』における高速道路の主な区間の交通量増減（対2019年比）」2023年4月28日(金) 速報値
      https://www.mlit.go.jp/road/content/001609448.pdf   (values transcribed below)

Usage: python3 tools/build_traffic.py [--src DIR]
"""
import csv, io, json, os, re, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[sys.argv.index('--src') + 1] if '--src' in sys.argv else os.path.join(HERE, '.traffic_src')
BASE = 'https://www.kensetsu.metro.tokyo.lg.jp/documents/d/kensetsu/'
FILES = {'summary': '000028575', 'hourly': '000028577'}


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
            {'station': '5890', 'kind': 'exp', 'refs': ['6', '9'], 'from': EDO, 'to': HAKO_W, 'up': EDO},
            {'station': '5900', 'kind': 'exp', 'refs': ['6', '9'], 'from': HAKO_W, 'to': HAKO_J, 'up': EDO},
            {'station': '5910', 'kind': 'exp', 'refs': ['6'], 'from': HAKO_J, 'to': [35.6848, 139.7897], 'up': EDO, 'approx': '箱崎JCT〜両国JCT間を等分'},
            {'station': '5920', 'kind': 'exp', 'refs': ['6'], 'from': [35.6848, 139.7897], 'to': [35.6866, 139.7899], 'up': EDO, 'approx': '箱崎JCT〜両国JCT間を等分'},
            {'station': '5930', 'kind': 'exp', 'refs': ['6'], 'from': [35.6866, 139.7899], 'to': RYOGOKU, 'up': EDO, 'approx': '箱崎JCT〜両国JCT間を等分'},
            {'station': '5940', 'kind': 'exp', 'refs': ['6'], 'from': RYOGOKU, 'to': [35.6925, 139.7915], 'up': EDO},
            {'station': '6000', 'kind': 'exp', 'refs': ['7'], 'from': RYOGOKU, 'to': [35.6906, 139.7892], 'up': RYOGOKU},
            {'station': '6050', 'kind': 'exp', 'refs': ['9'], 'from': HAKO_J, 'to': [35.6775, 139.7962], 'up': HAKO_J},
            {'station': '6060', 'kind': 'exp', 'refs': ['9'], 'from': [35.6775, 139.7962], 'to': [35.6728, 139.8013], 'up': HAKO_J},
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
            {'station': '5460', 'kind': 'exp', 'refs': ['3'], 'from': [35.6583, 139.7071], 'to': [35.6560, 139.6960], 'up': [35.6583, 139.7071]},
            {'station': '5470', 'kind': 'exp', 'refs': ['3'], 'from': [35.6560, 139.6960], 'to': OHASHI_J, 'up': [35.6583, 139.7071]},
            {'station': '5480', 'kind': 'exp', 'refs': ['3'], 'from': OHASHI_J, 'to': [35.6480, 139.6812], 'up': [35.6583, 139.7071]},
            {'station': '5490', 'kind': 'exp', 'refs': ['3'], 'from': [35.6480, 139.6812], 'to': [35.6443, 139.6729], 'up': [35.6583, 139.7071]},
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
             'date': '2023年4月28日(金)', 'url': 'https://www.mlit.go.jp/road/content/001609448.pdf'},
        ],
        'notes': [
            '交通量は上下合計の自動車類台数。方向別の値は公表されていないため、各方向は 1/2 と仮定している。',
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
    'sites': sites,
}
path = os.path.join(HERE, '..', 'data', 'traffic.json')
json.dump(out, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('wrote', os.path.normpath(path), os.path.getsize(path) // 1024, 'KB;', len(out_st), 'stations,', sum(1 for s in out_st.values() if 'hourly' in s), 'with hourly data; surface shape from', len(surf), 'stations')
for sid in sorted(used):
    s = out_st[sid]
    print(' ', sid, s['route'], s['section'], '24h', s['v24'], '(推定)' if s['v24est'] else '', 'HV', s['hv'], '混雑度', s['congestion'], 'v', s['vUp'], s['vDown'], 'hourly' if 'hourly' in s else '-')
