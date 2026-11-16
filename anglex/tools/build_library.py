#!/usr/bin/env python3
"""総合カタログ（1〜25 章）から拾った寸法表 → 追加の製品データ js/data/catalog_more.js を作る。

入力: tools/data/catalog_inventory.json（カタログの寸法シートを整理したもの。候補ごと・シリーズごとの寸法行）
出力: js/data/catalog_more.js（CATALOG に足す製品。各サイズに、3D ファミリのパラメータ params を持たせる）

注意: 寸法の数値は寸法表から取ったが、寸法図は確認できていない。記号（C・P・H など）の意味と細部の形は推定を含む。
使い方: python3 tools/build_library.py
"""
import json, re, pathlib, collections
ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'tools' / 'data' / 'catalog_inventory.json'
OUT = ROOT / 'js' / 'data' / 'catalog_more.js'
OD = {'10A': 17.3, '13A': 18.0, '15A': 21.7, '20A': 27.2, '25A': 34.0, '32A': 42.7, '40A': 48.6, '50A': 60.5, '65A': 76.3, '80A': 89.1, '100A': 114.3, '125A': 139.8, '150A': 165.2, '200A': 216.3}
FL_T = {'10K': {'15A': 12, '20A': 14, '25A': 14, '32A': 16, '40A': 16, '50A': 16, '65A': 18, '80A': 18, '100A': 18, '125A': 20, '150A': 22}, '5K': {'15A': 9, '20A': 10, '25A': 10, '32A': 12, '40A': 12, '50A': 14, '65A': 14, '80A': 14, '100A': 16, '125A': 16, '150A': 18}}


def num(v, default=None):
    m = re.search(r'-?\d+(?:\.\d+)?', str(v if v is not None else ''))
    return float(m.group(0)) if m else default


def nums(v):
    return [float(x) for x in re.findall(r'\d+(?:\.\d+)?', str(v or ''))]


def tb(v, dt=2.0, db=25.0):
    n = nums(str(v or '').split('(')[0])
    return (n[0], n[1]) if len(n) >= 2 else (dt, db)


def bolt(v, default='M6x20'):
    m = re.search(r'M\s*(\d+)\s*[×xX]\s*(\d+)', str(v or ''))
    return f'M{m.group(1)}x{m.group(2)}' if m else default


def thread(v, default='W3/8'):
    s = str(v or '')
    if 'W1/2' in s or re.search(r'(^|[^\d])1/2', s): return 'W1/2'
    if '5/8' in s: return 'M16'
    if 'W3/8' in s or '3/8' in s: return 'W3/8'
    m = re.search(r'M(\d+)', s)
    return ('M' + m.group(1)) if m else default


def od_of(row, keys=('適合配管径', '適合配管径(SGP)', '適合配管径(VP)', '適合配管径(A)', '(A)', 'A')):
    d = row['dims']; nom = str(row.get('nominal') or '')
    v = None
    for k in keys:
        if k in d and num(d[k]) is not None: v = num(d[k]); break
    m = re.match(r'^(\d+A)\b', nom)
    if m and m.group(1) in OD:
        t = OD[m.group(1)]
        if v is None or abs(v - t) / t > 0.06: return t, (v is not None)   # 表の値が呼び径と合わないときは、呼び径の外径を使う
    return v, False


def I(x):
    return int(x) if isinstance(x, float) and x == int(x) else x


# (候補の順位, シリーズ名に含む語) → (ファミリ, 製品名, 行 → params)
def riser(style, rubber=0):
    def f(r):
        d = r['dims']; t, B = tb(d.get('使用材料(t×B)') or d.get('t×B'), 2.0, 25); o, _ = od_of(r)
        return dict(od=o, t=t, B=B, style=style, C=num(d.get('C'), 44), P=num(d.get('P'), 20), H=num(d.get('H'), o / 2 + 40), bolt=bolt(d.get('締付ボルトナット')), rubber=rubber)
    return f


def floor(rubber=0):
    def f(r):
        d = r['dims']; t, B = tb(d.get('t×B'), 2.3, 25); o, _ = od_of(r)
        return dict(od=o, t=t, B=B, L=num(d.get('L'), o + 110), P=num(d.get('P'), 20), bolt=bolt(d.get('締付ボルトナット'), 'M6x25'), rubber=rubber)
    return f


def saddle(r):
    d = r['dims']; o, _ = od_of(r)
    return dict(od=o, t=num(d.get('t'), 1.2), B=num(d.get('B'), 20), P=num(d.get('P'), o + 30), d=num(d.get('d'), 5))


def uband(r):
    d = r['dims']; t, B = tb(d.get('使用材料(t×B)'), 2.3, 25); o, _ = od_of(r)
    return dict(od=o, t=t, B=B, P=num(d.get('P'), o + 12), L=num(d.get('L'), o + 28), d=thread(d.get('d×L')))


def level(r):
    d = r['dims']; o, _ = od_of(r)
    return dict(od=o, H=num(d.get('H'), 150), L=num(d.get('L'), 158), Pp=num(d.get('P'), 145))


def hband(r):   # 既存の吊バンド（タン付）にゴム厚を足す
    d = r['dims']; t, B = tb(d.get('t×B'), 2.0, 25); o, _ = od_of(r)
    return dict(od=o, t=t, B=B, d=thread(d.get('d')), C=num(d.get('C'), 26), H=num(d.get('H'), 90), bolt=bolt(d.get('締付ボルトナット')), rubber=num(d.get('ゴム厚'), 3))


def tfoot(r):
    d = r['dims']; return dict(L=num(d.get('L'), 80), W=num(d.get('W'), 25), l=num(d.get('ℓ'), 60), Pp=num(d.get('P'), 37))


def hagoita(key):
    def f(r):
        d = r['dims']; t, B = tb(d.get('t×B'), 3.4, 21); return dict(L=num(d.get('L'), 100), d=thread(d.get('d')), t=t, B=B, seatD=num(d.get(key), 37.5))
    return f


def tsuba(r):
    d = r['dims']; t, B = tb(d.get('t×B'), 3.0, 25); return dict(L=num(d.get('L'), 80), t=t, B=B, E=num(d.get('E'), 12))


def halfsaddle(r):
    d = r['dims']; t, B = tb(d.get('t×B'), 1.8, 20); return dict(od=num(d.get('適合配管径')), t=t, B=B, P1=num(d.get('P1'), 38), P2=num(d.get('P2'), 30))


def nominal_od(r):
    m = re.match(r'^(\d+A)', str(r.get('nominal') or '')); return OD.get(m.group(1)) if m else None


def rollerh(r):
    d = r['dims']; ax = str(d.get('d2') or 'M6'); return dict(od=num(d.get('適合配管径')) or nominal_od(r), H=num(d.get('H'), 100), B=num(d.get('B'), 25), T=num(d.get('T'), 2), d=thread(d.get('d')), axle='M8' if 'M8' in ax else 'M6')


def rollers(r):
    d = r['dims']; t1, c1 = tb(d.get('t1×C1'), 2.0, 25); t2, c2 = tb(d.get('t2×C2'), 4.5, 32); b = str(d.get('B') or 'M8')
    ax = 'M6' if 'M6' in b else 'M8' if 'M8' in b else 'M12' if ('M12' in b or '1/2' in b) else 'M10'
    return dict(od=nominal_od(r), L=num(d.get('L'), 165), Pp=num(d.get('P'), 135), H=nums(d.get('H'))[-1] if nums(d.get('H')) else 70, t1=t1, C1=c1, t2=t2, C2=c2, axle=ax)


def angle_hook(kind):
    def f(r):
        d = r['dims']; n = nums(d.get('適合形鋼サイズ')); S = n[1] if len(n) > 1 else (n[0] if n else 50)
        return dict(S=S, L=num(d.get('L'), 76), ft=6 if kind == 'L' else 5)
    return f


def vibh(double):
    def f(r):
        d = r['dims']; return dict(A=num(d.get('A'), 30), Bw=num(d.get('B'), 50), L=num(d.get('L'), 85), D=num(d.get('φD'), 30), Hr=num(d.get('H'), 21), d=thread(d.get('最大ボルト径')), double=double)
    return f


def tanb(r):   # 既存の吊金具（タン金具）
    d = r['dims']; t, B = tb(d.get('t×B'), 2.0, 25); return dict(t=t, B=B, L=num(d.get('L'), 50), H=num(d.get('H'), 60), phi=num(d.get('φ'), 10.5))


def seismic(r):
    d = r['dims']; t, B = tb(d.get('t×B'), 2.0, 25); o, _ = od_of(r)
    return dict(od=o, t=t, B=B, d=thread(d.get('d')), C=num(d.get('C'), 26), H=num(d.get('H'), 97), bolt=bolt(d.get('締付ボルトナット')))


def block(rail):
    def f(r):
        d = r['dims']; return dict(L=num(d.get('長さ') or d.get('長さL'), 400), H=num(d.get('高さ'), 100), top=num(d.get('上部') or d.get('上部幅'), 80), bottom=num(d.get('下部') or d.get('下部幅'), 110), rail=rail, massKg=num(d.get('重さ'), 0))
    return f


def pad(r):
    d = r['dims']; return dict(type='pad', H=num(d.get('H'), 10), W=num(d.get('W'), 100))


def bush(r):
    d = r['dims']; return dict(type='bush', D1=num(d.get('φD1'), 28), D2=num(d.get('φD2'), 14), dd=num(d.get('φd'), 12.7), t1=num(d.get('t1'), 8), t2=num(d.get('t2'), 5))


def rwasher(r):
    d = r['dims']; return dict(type='washer', H=num(d.get('H'), 5), dd=num(d.get('φ1'), 11), D1=num(d.get('φ2'), 25))


def rsaddle(r):
    d = r['dims']; return dict(od=num(d.get('適合配管径(A)')), P=num(d.get('P'), 51), L=num(d.get('L'), 69))


def rband(r):
    d = r['dims']; return dict(od=num(d.get('適合配管径(A)')), B=num(d.get('B'), 25), bolt=bolt(d.get('締付ボルトナット'), 'M6x30'))


def insert(r):
    d = r['dims']; s = str(d.get('ねじ径') or 'W3/8'); return dict(d=s if s in ('W3/8', 'W1/2', 'W5/8', 'M10', 'M12') else 'W3/8', D=num(d.get('頭径D'), 28), dd=num(d.get('胴径d'), 12), L=num(d.get('金具全長L'), 40), A=num(d.get('頭厚A'), 3))


def sleeve(kind):
    def f(r):
        d = r['dims']
        if kind == 'slide':
            if num(d.get('φ')) is None: return None
            return dict(D=num(d.get('φ')), D2=num(d.get("φ'"), num(d.get('φ')) + 3), t=num(d.get('板厚'), 0.6), slide=True, L=300)
        if kind == 'wall':
            if num(d.get('φ(内径)')) is None: return None
            return dict(D=num(d.get('φ(内径)')), t=num(d.get('板厚'), 0.6), slide=False, L=200)
        return dict(D=num(d.get('φD')), t=num(d.get('t'), 0.6), cap=True, dir='floor', L=200)
    return f


def column(r):
    return dict(col=num(r['dims'].get('適合角形鋼管'), 300))


def sprbar(r):
    d = r['dims']; return dict(L=num(d.get('長さ'), 1200), t=num(d.get('板厚'), 0.6), S=16)


def flange(K):
    def f(r):
        d = r['dims']; nom = str(r.get('nominal')); o, _ = od_of(r)
        return dict(od=o, D=num(d.get('外径(B)')), C=num(d.get('ボルト中心円(C)')), n=int(num(d.get('ボルト穴数'), 4)), hd=num(d.get('ボルト穴径(h)'), 15), K=K, t=FL_T[K].get(nom, 16), fb=bolt(d.get('六角ボルト'), 'M12x55'))
    return f


def longnut(r):
    d = r['dims']; nom = str(r.get('nominal')); s = 'W1/2' if '1/2' in nom and '×' in nom else nom
    return dict(type='long', d=s if s in ('W3/8', 'W1/2', 'W5/8') else 'W3/8', af=num(d.get('平径'), 14), L=num(d.get('長さ'), 30))


def sqw(r):
    d = r['dims']; nom = str(r.get('nominal')); m = re.search(r'M\d+', nom)
    return dict(type='sqw', d=m.group(0) if m else 'M10', sq=num(d.get('外角'), 32), t=3.2)


def hopper(r):
    d = r['dims']; nom = str(r.get('nominal')); m = re.match(r'(\d+)Φ×(\d+)A', nom)
    if not m: return None
    return dict(D=float(m.group(1)), od=OD.get(m.group(2) + 'A', 27.2), H=num(d.get('H'), 80), C=num(d.get('C'), 30), E=num(d.get('E'), 25), t=num(d.get('t'), 1.6))


def gas(leg):
    def f(r, ctx):
        d = r['dims']; o, _ = od_of(r); base = ctx.get(str(r.get('nominal')), {}); t, B = tb(d.get('t×B') or base.get('t×B'), 2.0, 15)
        return dict(od=o, t=t, B=B, bolt=bolt(d.get('締付ボルトナット')), L=num(d.get('L'), 150) if leg else 0)
    return f


def tband(r):
    d = r['dims']; t, B = tb(d.get('t×B'), 1.6, 25); o, _ = od_of(r); return dict(od=o, H=num(d.get('H'), 35), t=t, B=B)


MAP = [
    (1, '蝶番', 'riser_band', '立バンド（蝶番式）', riser('hinge')), (1, '組式', 'riser_band', '立バンド（組式）', riser('split')),
    (2, '標準', 'floor_band', '床バンド', floor()), (2, 'ハード', 'floor_band', '床バンド（厚板）', floor()),
    (3, '標準', 'saddle_band', 'サドルバンド（両サドル）', saddle), (3, '厚口', 'saddle_band', 'サドルバンド（厚口）', saddle),
    (4, '', 'u_band', 'Uバンド（両端ねじ）', uband),
    (5, '', 'level_band', 'レベルバンド（床置き・高さ調整）', level),
    (6, '吊バンド', 'hanger_band', '防振ゴム付き吊バンド', hband), (6, '立バンド', 'riser_band', '防振ゴム付き立バンド', riser('hinge', 3)), (6, '床バンド', 'floor_band', '防振ゴム付き床バンド', floor(3)),
    (7, '長穴', 't_foot', 'T足（長穴）', tfoot), (7, '二ツ穴', 't_foot', 'T足（二ツ穴）', tfoot),
    (8, '座付', 'hagoita', '座付羽子板', hagoita('A')), (8, 'ターボ', 'hagoita', 'ターボ羽子板', hagoita('φ')),
    (9, '', 'flange_foot', 'ツバ付足', tsuba), (10, '', 'half_saddle', '片サドル', halfsaddle),
    (11, '', 'roller_hanger', '吊ローラーバンド', rollerh), (13, '', 'roller_stand', '置式ローラー（ガイド付）', rollers),
    (17, 'アングル', 'angle_hook', 'アングル用吊金具', angle_hook('L')), (17, 'チャンネル', 'angle_hook', 'チャンネル用吊金具', angle_hook('C')),
    (18, 'シングル', 'vib_hanger', '防振吊金具（シングル）', vibh(False)), (18, 'ダブル', 'vib_hanger', '防振吊金具（ダブル）', vibh(True)),
    (19, 'ストロング', 'hanger_rod_fitting', 'タンバックル', tanb),
    (20, '', 'seismic_band', '耐震吊バンド（振れ止め付き）', seismic),
    (22, 'アルミレール付(M10)', 'base_block', '基礎ブロック（アルミレール付）', block('alumi')), (22, 'チャンネル', 'base_block', '基礎ブロック（チャンネルレール付）', block('channel')), (22, 'アンカー', 'base_block', '基礎ブロック（アンカー付）', block('anchor')), (22, 'コンクリート製', 'base_block', '基礎ブロック（コンクリート製・アルミレール付）', block('alumi')),
    (23, 'パッド', 'vib_pad', '防振パッド', pad), (23, 'ブッシュ', 'vib_pad', 'ゴムブッシュ', bush), (23, 'ワッシャー', 'vib_pad', 'ゴムワッシャー', rwasher),
    (24, 'サドル', 'resin_saddle', '樹脂サドル', rsaddle), (25, '', 'resin_band', '樹脂バンド（吊・立兼用）', rband),
    (26, '合板', 'insert', 'インサート（合板型枠用）', insert), (26, 'デッキ', 'insert', 'インサート（デッキプレート用）', insert),
    (27, 'スライド', 'sheet_sleeve', '鋼板製スリーブ（梁用スライド式）', sleeve('slide')), (27, '単筒', 'sheet_sleeve', '鋼板製スリーブ（壁用単筒）', sleeve('wall')), (27, 'フタ', 'sheet_sleeve', '鋼板製スリーブ（床用・養生フタ付）', sleeve('cap')),
    (28, 'コラムセッター', 'column_band', 'コラム柱用取付金具', column), (29, '角バー', 'sprinkler_bar', 'スプリンクラー巻出し金具（角バー）', sprbar),
    (30, '5K', 'pipe_flange', 'フランジ 5K', flange('5K')), (30, '10K', 'pipe_flange', 'フランジ 10K', flange('10K')),
    (31, '長ナット', 'long_nut', '長ナット', longnut), (31, '角ワッシャー', 'long_nut', '角ワッシャー', sqw),
    (32, '', 'hopper', 'ホッパー（排水受け）', hopper),
    (33, 'ガスバンド', 'gas_band', 'ガスバンド', gas(False)), (33, '足付', 'gas_band', 'ガスバンド（足付）', gas(True)),
    (34, '', 't_band', 'T型バンド（浮かし配管用）', tband),
]
# 寸法表が足りないので、代表寸法で 1 サイズだけ登録するもの
EXTRA = [
    dict(rank=14, family='urethane_hanger', name='ウレタン断熱支持（吊り型）', chapter=10), dict(rank=15, family='urethane_seat', name='ウレタン断熱支持（置き型）', chapter=10),
    dict(rank=16, family='beam_clamp', name='形鋼用吊金具（ビームクランプ）', chapter=2, skus=[('W3/8', dict(d='W3/8', flange=9), {'適合フランジ厚': '3〜27', '本体の外形': '代表寸法（寸法表に無い）'}), ('W1/2', dict(d='W1/2', flange=9), {'適合フランジ厚': '3〜27', '本体の外形': '代表寸法（寸法表に無い）'})]),
    dict(rank=21, family='brace_clamp', name='吊ボルト振れ止め金具', chapter=16, skus=[('45°', dict(angle='45', W=30, Lc=115), {'幅': 30, '全長': 115}), ('60°', dict(angle='60', W=30, Lc=115), {'幅': 30, '全長': 115}), ('交差（90°）', dict(angle='90', W=30, Lc=115), {'幅': 30, '全長': 115})]),
    dict(rank=None, family='wire_brace', name='ワイヤ式振れ止め・吊りワイヤ', chapter=17, skus=[('φ2 45°', dict(dw=2, angle='45'), {'ワイヤ径': 2, '形': '代表寸法（寸法表を未確認）'}), ('φ2 まっすぐ', dict(dw=2, angle='90'), {'ワイヤ径': 2, '形': '代表寸法（寸法表を未確認）'})]),
]


def main():
    inv = json.loads(SRC.read_text(encoding='utf-8')); chap = {c['no']: c['name'] for c in inv['chapters']}; cands = {c['rank']: c for c in inv['candidates']}
    products = []; fixes = []; seq = collections.Counter()

    def add(c_no, family, name, sub, use, skus, guess=True):
        seq[c_no] += 1
        products.append(dict(pid=f'LIB{c_no:02d}_{seq[c_no]:02d}', name=name, code=None, kind='規格品', category='本体', chapter=c_no, chapterName=chap.get(c_no, ''), sub=sub, maker='日栄インテック', industry='建築設備', page=None,
                             notes=use + ('。形は寸法表と一般的な形からの推定（寸法図は未確認）' if guess else ''), parsed={}, models=[], orderFields=[], finish='EZ', material='SS400', family=family, familyParams={}, shapeGuess=guess, skus=skus))

    for rank, key, family, name, fn in MAP:
        c = cands[rank]; rows = [r for r in c.get('sizes', []) if key in (r.get('series') or '')] if key else c.get('sizes', [])
        ctx = {}
        if rank == 33: ctx = {str(r.get('nominal')): r['dims'] for r in c['sizes'] if 'ガスバンド' == (r.get('series') or '')}
        skus = []; seen = collections.Counter()
        for r in rows:
            try: p = fn(r, ctx) if rank == 33 else fn(r)
            except Exception as e: print('skip', rank, r.get('nominal'), e); continue
            if not p or any(v is None for v in p.values()): continue
            _, fixed = od_of(r) if 'od' in p else (None, False)
            if fixed: fixes.append(f"{name} {r.get('nominal')}: 表の外径 {r['dims'].get('適合配管径')} → 呼び径の外径 {p['od']}")
            label = str(r.get('nominal'))
            d = r['dims']
            if rank == 5: label += f" H{I(num(d.get('H'), 0))}"
            if rank == 34 and d.get('適合サイズ'): label = str(d['適合サイズ'])
            seen[label] += 1
            if seen[label] > 1: label += f'（{seen[label]}）'
            dims = {'サイズ': label}; dims.update({k: (I(v) if isinstance(v, float) else v) for k, v in d.items()})
            skus.append(dict(sku=label, dims=dims, params={k: I(v) for k, v in p.items()}))
        if skus: add(c['chapter'], family, name, key or c['name'], c['use'], skus)
        else: print('no rows', rank, key)

    for e in EXTRA:
        c = cands.get(e['rank']) if e['rank'] else None; use = c['use'] if c else 'ワイヤで吊る、または振れを止める'
        if e['family'] in ('urethane_hanger', 'urethane_seat'):
            skus = []
            for r in c['sizes']:
                d = r['dims']; o, _ = od_of(r); t, B = tb(d.get('使用材料(t×B)'), 2.0, 25)
                for T in (20, 25, 30, 40, 50):
                    k = ('H' if e['family'] == 'urethane_hanger' else 'P') + f'(保温厚T{T})'
                    if num(d.get(k)) is None: continue
                    p = dict(od=o, T=str(T), W=num(d.get('幅(L)'), 50), t=t, B=B, d=thread(d.get('ねじ径(d)')))
                    p['H' if e['family'] == 'urethane_hanger' else 'P'] = num(d.get(k))
                    label = f"{r.get('nominal')} 保温厚{T}"
                    skus.append(dict(sku=label, dims={'サイズ': label, '適合配管径': o, '保温厚': T, k: d.get(k), '幅(L)': d.get('幅(L)'), '使用材料(t×B)': d.get('使用材料(t×B)'), 'ねじ径(d)': d.get('ねじ径(d)')}, params={kk: I(v) for kk, v in p.items()}))
            add(e['chapter'], e['family'], e['name'], c['name'], use, skus)
        else:
            skus = [dict(sku=s, dims={'サイズ': s, **dm}, params=pp) for s, pp, dm in e['skus']]
            add(e['chapter'], e['family'], e['name'], e['name'], use, skus)

    products.sort(key=lambda p: (p['chapter'], p['pid']))
    n_sku = sum(len(p['skus']) for p in products)
    js = ('// AUTO-GENERATED by tools/build_library.py — 手で編集しない\n'
          '// 総合カタログ（1〜25 章）の寸法表から起こした追加の製品。CATALOG（js/data/catalog.js）に足して使う。\n'
          '// 注意: 形は寸法表と一般的な形からの推定を含む（寸法図は未確認）。docs/OPEN_ITEMS.md を参照。\n'
          "import { CATALOG } from './catalog.js';\n"
          f'export const LIBRARY_MORE = {json.dumps(dict(source=inv.get("source"), products=products), ensure_ascii=False, separators=(",", ":"))};\n'
          'let merged = false;\n'
          'export function mergeLibrary() { if (merged) return CATALOG; merged = true; const have = new Set(CATALOG.products.map(p => p.pid)); for (const p of LIBRARY_MORE.products) if (!have.has(p.pid)) CATALOG.products.push(p); const by = new Map(); for (const p of CATALOG.products) { const c = by.get(p.chapter) || { no: p.chapter, name: p.chapterName, count: 0 }; c.count++; by.set(p.chapter, c); } CATALOG.chapters = [...by.values()].sort((a, b) => a.no - b.no); return CATALOG; }\n'
          'mergeLibrary();\n')
    OUT.write_text(js, encoding='utf-8')
    fams = sorted({p['family'] for p in products})
    print(f'wrote {OUT.relative_to(ROOT)}: {len(products)} products / {n_sku} SKU / {len(fams)} families / chapters {sorted({p["chapter"] for p in products})} / {len(js) // 1024} KB')
    for f in fixes: print('  fixed od:', f)


if __name__ == '__main__':
    main()
