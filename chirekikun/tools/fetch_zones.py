#!/usr/bin/env python3
"""指定区域の公表台帳を自治体の公式ページから取得し、町丁目単位の照合用データ registry/zones.json を作る。

対象（いまは2自治体）
  東京都  環境局「東京都が指定する要措置区域等一覧」（Excel。要措置区域、形質変更時要届出区域）
  名古屋市 環境局「土壌汚染に係る区域一覧」（PDF。法の区域と条例の区域）

使い方
  pip install openpyxl pdfplumber
  python3 tools/fetch_zones.py            # 公式ページから取得して registry/zones.json を作る
  python3 tools/fetch_zones.py --no-geo   # 町丁目の代表点（国土地理院の住所検索）を付けない
  python3 build.py                        # zones.json があれば index.html に埋め込む

取り扱いの注意
  ・一覧のファイル名は更新のたびに変わるので、毎回、公式ページからリンクを読み取る。
  ・保持するのは、区域の種類・町丁目・指定番号・指定年月日だけ。地番・面積・物質は持たない（照合は町丁目単位）。
  ・両自治体とも、サイトの掲載情報の複製・二次利用には条件がある（東京都環境局サイトポリシー、名古屋市「著作権・リンク等」）。
    このため registry/zones.json と取得したファイルはリポジトリに含めない（.gitignore）。組織内での確認用として、
    利用する側の環境で取得する。報告書や外部に出す形で使う場合は、各自治体の担当課の条件を確認すること。
  ・東京都の一覧は町丁目までで地番がない。八王子市・町田市は含まれない（両市が法を所管）。解除済みの区域は載らない。
  ・名古屋市の一覧は、取り消し線の付いた（変更前の）記載とふりがなを除いて読む。解除区域・除去済み特例区域は除く。
    条例附則によるみなし形質変更時届出管理区域は一覧に載っていない。
"""
import datetime, io, json, pathlib, re, sys, time, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
REG = ROOT / 'registry'
CACHE = REG / 'zones_cache'
UA = {'User-Agent': 'Mozilla/5.0 (compatible; land-history-report-tool)'}
TOKYO_PAGE = 'https://www.kankyo.metro.tokyo.lg.jp/chemical/soil/law/designated_areas/'
NAGOYA_PAGE = 'https://www.city.nagoya.jp/shisei/keikaku/1008387/1008424/1008777/1008783.html'
KAN = '〇一二三四五六七八九'
_last = {}


def get(url, gap=1.0):
    host = urllib.parse.urlsplit(url).netloc
    wait = gap - (time.time() - _last.get(host, 0))   # 同じ相手には間隔を空ける（既定は1秒に1回まで）
    if wait > 0:
        time.sleep(wait)
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        data = r.read()
    _last[host] = time.time()
    return data


def num_kan(n):
    n = int(n)
    if n < 10:
        return KAN[n]
    if n < 20:
        return '十' + (KAN[n % 10] if n % 10 else '')
    if n < 100:
        return KAN[n // 10] + '十' + (KAN[n % 10] if n % 10 else '')
    return str(n)


def z2h(s):
    return ''.join(chr(ord(c) - 65248) if '０' <= c <= '９' else c for c in s)


def clean(s):
    return re.sub(r'_x000D_|[\s　︀-️\U000e0100-\U000e01ef]', '', z2h(str(s or '')))


def norm_no(s):
    s = re.sub(r'[－ー‐⁻―−]', '-', clean(s))
    m = re.search(r'(指|管|法)-?(\d+)', s)
    return ('指' if m.group(1) == '法' else m.group(1)) + '-' + m.group(2) if m else s


def wareki(d):
    y, e = d.year, None
    e = ('令和', y - 2018) if y >= 2019 else ('平成', y - 1988) if y >= 1989 else ('昭和', y - 1925)
    return f'{e[0]}{"元" if e[1] == 1 else e[1]}年{d.month}月{d.day}日'


def first_date(v):
    if isinstance(v, (int, float)):                    # Excelの日付の連番
        return wareki(datetime.date(1899, 12, 30) + datetime.timedelta(days=int(v)))
    if isinstance(v, (datetime.date, datetime.datetime)):
        return wareki(v)
    m = re.search(r'(明治|大正|昭和|平成|令和)(元|\d+)年\d+月\d+日', clean(v))
    return m.group(0) if m else ''


CITY_RE = re.compile(r'^(.+?郡.+?[町村]|.+?市.+?区|.+?市|.+?区|.+?[町村])')


def split_places(text, city_fixed=None):
    """「A区B一丁目及び同区C二丁目地内」→ [(市区町村, 町丁目)]。地番以降は捨てる"""
    t = clean(text)
    t = re.sub(r'（[^）]*）|\([^)]*\)', '', t)
    out, city, base = [], city_fixed or '', ''
    for piece in re.split(r'、|及び|並びに|，|,', t):
        piece = re.sub(r'地内$|の一部$|地先$', '', piece)
        piece = re.sub(r'^同[区市町村]', '', piece)
        if not piece or re.match(r'^[\d\-－の]', piece):          # 地番の続き（「602番3」「2」など）
            continue
        piece = re.sub(r'^名古屋市', '', piece)
        m = re.match(r'^(.+?区)', piece) if city_fixed else CITY_RE.match(piece)
        if m and (city_fixed is None or m.group(1).endswith('区')) and not re.match(r'^[一二三四五六七八九十]+丁目', piece):
            city, piece = (city_fixed + m.group(1) if city_fixed else m.group(1)), piece[m.end():]
        piece = re.sub(r'(\d+)丁目', lambda x: num_kan(x.group(1)) + '丁目', piece)
        town = re.split(r'\d', piece)[0]                           # 地番の前まで
        town = re.sub(r'(字.*)?$', lambda x: x.group(0), town).strip('番のー-')
        if re.match(r'^[一二三四五六七八九十]+丁目$', town) and base:   # 「同区五丁目」→ 直前の町名を補う
            town = base + town
        if not town or not city:
            continue
        base = re.sub(r'[一二三四五六七八九十]+丁目$', '', town)
        if (city, town) not in out:
            out.append((city, town))
    return out


# ───────── 東京都 ─────────
def tokyo():
    import openpyxl
    html = get(TOKYO_PAGE).decode('utf-8', 'replace')
    upd = re.search(r'((?:令和|平成)[0-9０-９元]+年[0-9０-９]+月[0-9０-９]+日)\s*最終更新', re.sub(r'<[^>]+>', '', html))
    rows, files = [], []
    for key, k in (('yousochi', '6'), ('keihen', '11')):
        m = re.search(r'href="([^"]*/documents/d/kankyo/' + key + r'[0-9\-]+[^"]*)"', html)
        if not m:
            raise SystemExit(f'東京都のページに {key} の一覧へのリンクが見つかりません（ページの構成が変わった可能性）')
        url = urllib.parse.urljoin(TOKYO_PAGE, m.group(1))
        data = get(url)
        (CACHE / f'tokyo_{key}.xlsx').write_bytes(data)
        ws = openpyxl.load_workbook(io.BytesIO(data), data_only=True).worksheets[0]
        head = [clean(c.value) for c in ws[3]]
        if '区域が存在する場所' not in head or '指定番号' not in head:
            raise SystemExit(f'東京都 {key} の見出し行が想定と違います: {head}')
        ci = {h: i for i, h in enumerate(head)}
        n = 0
        for r in ws.iter_rows(min_row=4, values_only=True):
            place = r[ci['区域が存在する場所']]
            if not place:
                continue
            sub = clean(r[ci['備考']]) if '備考' in ci and r[ci['備考']] else ''
            sub = '・'.join(sorted(set(re.findall(r'自然由来特例区域|埋立地特例区域|埋立地管理区域', sub)), key=sub.index)) if sub else ''
            for city, town in split_places(place):
                rows.append({'s': 'tokyo', 'k': k, 'sub': sub, 'city': city, 'town': town, 'no': norm_no(r[ci['指定番号']]), 'date': first_date(r[ci['指定年月日']])})
            n += 1
        files.append({'url': url, 'rows': n})
    return {'id': 'tokyo', 'pref': '東京都', 'exclude': ['八王子市', '町田市'], 'name': '東京都環境局「東京都が指定する要措置区域等一覧」', 'url': TOKYO_PAGE,
            'updated': z2h(upd.group(1)) + '最終更新' if upd else '', 'files': files, 'level': '町丁目', 'note': '所在地は町丁目まで（地番の記載なし）。八王子市・町田市は対象外。解除済みの区域は載らない。'}, rows


# ───────── 名古屋市 ─────────
def nagoya():
    import pdfplumber
    html = get(NAGOYA_PAGE).decode('utf-8', 'replace')
    m = re.search(r'href="([^"]*kuiki\d+\.pdf)"[^>]*>([^<]*)', html)
    if not m:
        raise SystemExit('名古屋市のページに区域一覧（PDF）へのリンクが見つかりません（ページの構成が変わった可能性）')
    url = urllib.parse.urljoin(NAGOYA_PAGE, m.group(1))
    upd = re.search(r'（([^（）]*現在)）', m.group(2))
    data = get(url)
    (CACHE / 'nagoya_kuiki.pdf').write_bytes(data)
    rows, n, seen = [], 0, set()
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages[1:]:
            strikes = [r for r in page.rects if r['height'] < 0.4 and r['width'] > 2]     # 取り消し線（表の罫線は0.6）

            def keep(o, strikes=strikes):
                if o.get('object_type') != 'char':
                    return True
                if o['size'] < 4.6:                                                        # ふりがな
                    return False
                mid, h = (o['top'] + o['bottom']) / 2, o['bottom'] - o['top']
                cx = (o['x0'] + o['x1']) / 2
                return not any(s['x0'] - 0.5 <= cx <= s['x1'] + 0.5 and abs((s['top'] + s['bottom']) / 2 - mid) < h * 0.3 for s in strikes)
            for tb in page.filter(keep).extract_tables():
                for r in tb:
                    if len(r) < 11 or clean(r[2]) in ('所在地', ''):
                        continue
                    law, kind, sub, no = clean(r[3]), clean(r[4]), r[5] or '', norm_no(r[8])
                    if kind in ('解除区域', '除去済み特例区域') or not kind:
                        continue
                    if law == '法' and kind == '要措置区域':
                        k = '6'
                    elif law == '法' and kind == '形質変更時要届出区域':
                        k = '11'
                    elif law == '条例':
                        k = 'ord'
                    else:
                        raise SystemExit(f'名古屋市の一覧に想定外の区域の種類: {law} {kind}')
                    subs = [{'一般': '', '自然': '自然由来特例区域', '埋特': '埋立地特例区域', '埋管': '埋立地管理区域'}.get(x, '') for x in re.split(r'\s+', sub.strip())]
                    subtxt = kind if k == 'ord' else '・'.join(x for x in subs if x)
                    if no not in seen:
                        seen.add(no)
                        n += 1
                    for city, town in split_places(r[2], city_fixed='名古屋市'):
                        row = {'s': 'nagoya', 'k': k, 'sub': subtxt, 'city': city, 'town': town, 'no': no, 'date': first_date((r[9] or '').split('\n')[0])}
                        if row not in rows:
                            rows.append(row)
    return {'id': 'nagoya', 'pref': '愛知県', 'cities': ['名古屋市'], 'name': '名古屋市環境局「土壌汚染に係る区域一覧」', 'url': NAGOYA_PAGE,
            'updated': upd.group(1) if upd else '', 'files': [{'url': url, 'rows': n}], 'level': '町丁目',
            'note': '所在地は区域指定時の地番（本データは町丁目までを保持）。解除区域・除去済み特例区域は除く。条例附則によるみなし区域は一覧に載っていない。'}, rows


# ───────── 町丁目の代表点（国土地理院 住所検索） ─────────
def geocode(sources, rows):
    cf = REG / 'zones_cache' / 'geocode.json'
    cache = json.loads(cf.read_text(encoding='utf-8')) if cf.exists() else {}
    pref = {s['id']: s['pref'] for s in sources}
    todo = sorted({pref[r['s']] + r['city'] + r['town'] for r in rows} - set(cache))
    for i, a in enumerate(todo):
        try:
            j = json.loads(get('https://msearch.gsi.go.jp/address-search/AddressSearch?q=' + urllib.parse.quote(a), 0.3))
            hit = next((x for x in j if x['properties']['title'].replace('ケ', 'ヶ').startswith(a.replace('ケ', 'ヶ')[:len(a) - 2])), None)
            cache[a] = [round(hit['geometry']['coordinates'][1], 5), round(hit['geometry']['coordinates'][0], 5)] if hit else None
        except Exception as e:                                      # 取れない町丁目は代表点なし（同じ町丁目の一致だけで照合）
            print('  住所検索に失敗:', a, e, file=sys.stderr)
            cache[a] = None
        if i % 50 == 49:
            print(f'  代表点 {i + 1}/{len(todo)}', file=sys.stderr)
            cf.write_text(json.dumps(cache, ensure_ascii=False), encoding='utf-8')
    cf.write_text(json.dumps(cache, ensure_ascii=False), encoding='utf-8')
    for r in rows:
        ll = cache.get(pref[r['s']] + r['city'] + r['town'])
        if ll:
            r['lat'], r['lng'] = ll


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    sources, rows = [], []
    for fn in (tokyo, nagoya):
        s, rs = fn()
        s['rows'] = len(rs)
        s['ord'] = any(r['k'] == 'ord' for r in rs)
        sources.append(s)
        rows += rs
        print(f"{s['name']}：{s['updated']}　区域 {sum(f['rows'] for f in s['files'])}件 → 町丁目単位 {len(rs)}行")
    if '--no-geo' not in sys.argv:
        geocode(sources, rows)
        print('町丁目の代表点：', sum(1 for r in rows if 'lat' in r), '/', len(rows))
    out = {'checkedOn': datetime.date.today().isoformat(), 'sources': sources, 'rows': rows}
    (REG / 'zones.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('registry/zones.json', (REG / 'zones.json').stat().st_size, 'bytes')


if __name__ == '__main__':
    main()
