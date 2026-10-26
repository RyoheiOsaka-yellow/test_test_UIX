#!/usr/bin/env python3
"""
ANGLEX catalog builder.
Reads the catalog spreadsheets exported from Google Drive (data/raw/*.csv) and
produces data/catalog.json + js/data/catalog.js (ES module) used by the app.

Sources (Drive folder 1OKj8tDxlgBX570npsTSsj5Et0MjP_UNK):
  master_01_products_ch13-14.csv   products, 13章 アングル・チャンネルブラケット / 14章 特注加工品
  master_03_dimensions_ch01.csv    dimension rows, 1章 吊バンド系 (pid × SKU × 寸法名)
"""
import csv, json, re, os, sys, collections
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'data', 'raw')
OUT_JSON = os.path.join(HERE, '..', 'data', 'catalog.json')
OUT_JS = os.path.join(HERE, '..', 'js', 'data', 'catalog.js')

def finish_of(name, notes):
    s = name + ' ' + notes
    if 'ステンレス' in s or 'SUS' in s: return 'SUS304'
    if 'ドブ' in name or '溶融亜鉛めっき' in s: return 'HDZ'
    if '高耐食' in s: return 'ZAM'
    if '電気亜鉛' in s: return 'EZ'
    return 'EZ'

def material_of(name, notes):
    f = finish_of(name, notes)
    return 'SUS304' if f == 'SUS304' else 'SS400'

def parse_notes(notes):
    d = {}
    for part in [p.strip() for p in notes.split(' / ') if p.strip()]:
        m = re.match(r'^(用途|材質|型番|特長・用途|備考|注文時確認|仕様|適用ボルトサイズ|適用ボルト径|板厚|サイズ|表面処理|入数|適合|適合サイズ)\s*[:：]\s*(.+)$', part)
        if m: d.setdefault(m.group(1), m.group(2))
        else: d.setdefault('other', []).append(part)
    return d

def model_numbers(notes):
    out = []
    for m in re.finditer(r'(?:型番|SKU|パーツ|品番)[^:：]*[:：]\s*([^/]+)', notes):
        chunk = m.group(1)
        for t in re.split(r'[,、]\s*', chunk):
            t = t.strip()
            t = re.sub(r'\(.*?\)$', '', t).strip()
            if 1 < len(t) < 24 and not t.startswith('※'): out.append(t)
    for m in re.finditer(r'(\d+)\s*(?:型番|SKU|品番)\(([^)]*)\)', notes):
        for t in re.split(r'[,、]\s*', m.group(2)):
            t = t.strip()
            if t and t != '...' and len(t) < 24: out.append(t)
    seen = set(); res = []
    for t in out:
        if t not in seen: seen.add(t); res.append(t)
    return res

def order_fields(notes):
    m = re.search(r'注文時確認[:：]\s*(.+?)(?:\s*/|$)', notes)
    if not m: return []
    return [x.strip() for x in re.split(r'[、,]', m.group(1)) if x.strip()]

# ---- family mapping (product → parametric 3D family + default parameters) ----
def family_for(pid, name, sub, notes):
    n = name
    if pid.startswith('CH14'):
        if 'アングルサポート' in n: return ('hanger_support', {'profile':'L', 'size':'L-40x40x5'})
        if 'チャンネルサポート' in n: return ('hanger_support', {'profile':'C', 'size':'C-75x40x5'})
        if '門型架台(チャンネル)' in n: return ('portal_frame', {'profile':'C', 'size':'C-100x50x5', 'base':False})
        if '門型架台(ベース付)' in n: return ('portal_frame', {'profile':'L', 'size':'L-50x50x6', 'base':True})
        if '門型架台' in n: return ('portal_frame', {'profile':'L', 'size':'L-50x50x6', 'base':False})
        if 'L型ブラケット(チャンネル)' in n: return ('bracket_L', {'profile':'C', 'size':'C-75x40x5'})
        if 'L型ブラケット' in n: return ('bracket_L', {'profile':'L', 'size':'L-50x50x6'})
        if '三角ブラケット' in n: return ('bracket_tri', {'size':'L-50x50x6'})
        if '鉄管スリーブ' in n: return ('sleeve', {'kind':'steel'})
        if '塩ビスリーブ' in n: return ('sleeve', {'kind':'pvc'})
        if '吊架台(アングル・天井用)' in n: return ('ceiling_trapeze', {'profile':'L', 'mount':'ceiling'})
        if '吊架台(アングル・梁用)' in n: return ('ceiling_trapeze', {'profile':'L', 'mount':'beam'})
        if '吊架台(チャンネル' in n: return ('ceiling_trapeze', {'profile':'C', 'mount':'beam'})
        if '枠架台' in n: return ('frame_stand', {'profile':'L'})
        if 'ロケット' in n or '荷重' in n: return ('portal_frame', {'profile':'C', 'size':'C-100x50x5', 'base':True, 'heavy':True})
        if 'ダブルアングル' in n: return ('double_member', {'profile':'L'})
        if 'ダブルチャンネル' in n: return ('double_member', {'profile':'C'})
        if 'アングルポール' in n: return ('pole', {'profile':'L'})
        if 'チャンネルポール' in n: return ('pole', {'profile':'C'})
        if '止水' in n: return ('plate_work', {'kind':'waterstop'})
        if 'フランジ' in n: return ('flanged_pipe', {})
        if '鉄板' in n: return ('plate_work', {'kind':'general'})
        if 'サクション' in n: return ('plate_work', {'kind':'suction_cover'})
        if '防球' in n or 'ガード' in n: return ('guard', {})
        if 'エキスパンド' in n: return ('plate_work', {'kind':'expanded'})
        if 'チェッカー' in n: return ('plate_work', {'kind':'checker'})
        if 'ドレンパン' in n: return ('plate_work', {'kind':'drainpan'})
        return ('generic_fab', {})
    if pid.startswith('CH13'):
        if 'フリーアングル' in n: return ('slotted_angle', {'size':40})
        if 'ジョイント金具' in n: return ('joint_fitting', {'size':50 if 'L50' in n else 40})
        if 'ハンディブラケット' in n: return ('bracket_tri', {'size':'L-40x40x3', 'handy':True})
        if '三角ブラケット' in n: return ('bracket_tri', {'size':'L-50x50x4'})
        if 'L型ブラケット' in n: return ('bracket_L', {'profile':'FB', 'size':'FB-6x50'})
        if 'チャンネル君' in n: return ('channel_stand', {})
        if 'ベースチャンネル' in n: return ('channel', {'size':'C-100x50x5'})
        if '門型架台' in n: return ('portal_frame', {'profile':'C', 'size':'C-75x40x5', 'base':False, 'catalog':True})
        if 'シムライナー' in n: return ('shim', {})
        if 'NL-1' in n or 'NT-' in n: return ('angle_parts', {})
        if '並列金具' in n: return ('parallel_hanger', {})
        if 'スペーサー' in n: return ('spacer', {'profile':'C' if 'チャンネル' in n else 'L'})
        if 'ローバル' in n: return ('consumable', {'kind':'zinc_paint'})
        if sub == 'フリーチャンネル' or 'NC-40P' in n or 'ND-' in n or 'NED' in n: return ('lip_channel', {'size':40})
        if sub == 'レースウェイ': return ('lip_channel', {'size':40, 'raceway':True})
        if 'Dナット' in n or 'DS金具' in n: return ('channel_nut', {})
        if 'クリップ' in n: return ('channel_clip', {})
    return ('generic_fab', {})

def ch01_family(pid, dimnames, first):
    s = set(dimnames)
    if '銅管サイズ' in s or '保温材厚' in s: return ('insulated_band', {})
    if 'ゴム厚' in s: return ('hanger_band', {'rubber': True})
    if 'L1' in s and 'L2' in s: return ('stand_band', {})
    if 'S' in s and 'd' not in s: return ('stand_band', {'u': True})
    if '適合吊バンドサイズ' in s: return ('band_accessory', {})
    if 'P' in s and 'P1' in s: return ('perforated_strap', {})
    if '品番' in s and 'a' in s: return ('band_accessory', {'kind':'saddle'})
    if 'D' in s and 'L' in s and 't×B' in s: return ('turnbuckle_tab', {})
    if 'φ×L×W' in s: return ('hanger_rod_fitting', {})
    if 'φ' in s and 'L' in s: return ('hanger_rod_fitting', {})
    if s == {'L'}: return ('hanger_rod', {})
    if s == {'サイズ'}: return ('hanger_rod', {'nut': True})
    if '管径称' in s or '管径称(VP)' in s: return ('hanger_band', {})
    return ('hanger_band', {})

CH01_NAMES = {  # inferred names (the 1章 product sheet is not in the Drive folder)
 'CH01_001':'タン付吊バンド','CH01_002':'立バンド','CH01_003':'吊バンド(SGP)','CH01_004':'吊バンド(ステンレス)','CH01_005':'吊バンド(ドブ)',
 'CH01_006':'Uバンド','CH01_007':'Uバンド(ステンレス)','CH01_008':'吊バンド(軽量)','CH01_009':'吊バンド(大口径)','CH01_010':'吊バンド(薄板)',
 'CH01_011':'吊バンド(薄板・ドブ)','CH01_012':'吊バンド(SUS厚板)','CH01_013':'吊バンド(ライニング管)','CH01_014':'Uバンド(ライニング管)','CH01_015':'吊バンド(ライニング・ドブ)',
 'CH01_016':'吊バンド(VP管用)','CH01_017':'吊バンド(VP管用・薄板)','CH01_018':'吊バンド(VP管用・ドブ)','CH01_019':'吊バンド(耐火二層管)','CH01_020':'立バンド(VP管用)',
 'CH01_021':'吊バンド(銅管用)','CH01_022':'吊バンド(銅管用・SUS)','CH01_023':'吊バンド(SU管用)','CH01_024':'吊バンド(SU管用・SUS)','CH01_025':'吊バンド(細径)',
 'CH01_026':'吊バンド(細径・SUS)','CH01_027':'防振吊バンド(ゴム3t)','CH01_028':'防振吊バンド(ゴム3t・SUS)','CH01_029':'防振吊バンド(ライニング)','CH01_030':'防振吊バンド(ライニング・SUS)',
 'CH01_031':'防振吊バンド(ゴム10t)','CH01_032':'防振吊バンド(ゴム10t・SUS)','CH01_033':'防振吊バンド(ライニング・ゴム10t)','CH01_034':'防振吊バンド(ライニング・ゴム10t・SUS)','CH01_035':'防振吊バンド(大口径)',
 'CH01_036':'吊バンド(保温管用)','CH01_037':'吊バンド(保温管用・SUS)','CH01_038':'吊バンド KCPE(被覆銅管)','CH01_039':'吊バンド(ポリ管用)','CH01_040':'吊バンド(ポリ管用・SUS)',
 'CH01_041':'吊バンド(架橋ポリ)','CH01_042':'吊バンド(架橋ポリ・SUS)','CH01_043':'吊バンド(保温ポリ)','CH01_044':'吊バンド(保温ポリ・SUS)','CH01_045':'吊バンド(小袋入)',
 'CH01_046':'吊バンド(小袋入・ドブ)','CH01_047':'Uバンド(軽量)','CH01_048':'吊バンド(ダクト用)','CH01_049':'吊バンド(VU管用)','CH01_050':'吊バンド(VU管用・薄板)',
 'CH01_051':'吊バンド(VU管用・大口径)','CH01_052':'穴あき帯鋼(パンチバンド)','CH01_053':'穴あき帯鋼(ステンレス)','CH01_054':'吊バンド補助金具','CH01_055':'ペア被覆銅管吊バンド',
 'CH01_056':'ペア被覆銅管吊バンド(SUS)','CH01_057':'ペア被覆銅管吊バンド(ドブ)','CH01_058':'被覆銅管用吊バンド','CH01_059':'サドルバンド(被覆銅管)','CH01_060':'ターンバックル付吊タン',
 'CH01_061':'ターンバックル付吊タン(SUS)','CH01_062':'ターンバックル付吊タン(ドブ)','CH01_063':'吊ボルト','CH01_064':'吊ナット','CH01_065':'吊バンド用タン金具',
 'CH01_066':'吊バンド用タン金具(厚板)','CH01_067':'吊バンド用タン金具(SUS)','CH01_068':'吊バンド用タン金具(穴のみ)','CH01_069':'吊バンド用タン金具(M10)','CH01_070':'吊バンド用タン金具(M10・SUS)',
 'CH01_071':'吊金具(H200)','CH01_072':'吊金具(H200・M10)','CH01_073':'吊金具(H170)','CH01_074':'吊金具(H170・M10)','CH01_075':'吊バンド(SU管・小袋)','CH01_076':'吊バンド(SU管・小袋・厚板)',
}

def main():
    products = []
    with open(os.path.join(RAW, 'master_01_products_ch13-14.csv'), encoding='utf-8') as f:
        for r in csv.DictReader(f):
            notes = r['特記事項'] or ''
            fam, fp = family_for(r['pid'], r['商品名'], r['サブカテゴリ'], notes)
            products.append({
                'pid': r['pid'], 'name': r['商品名'], 'code': r['管理番号'] or None, 'kind': r['データ種別'],
                'category': r['カテゴリ'], 'chapter': int(r['章番号']), 'chapterName': r['章名'], 'sub': r['サブカテゴリ'],
                'maker': r['メーカー'] or None, 'industry': r['適用業種_全般'] or None, 'page': int(r['紙面ページ']) if r['紙面ページ'] else None,
                'notes': notes, 'parsed': parse_notes(notes), 'models': model_numbers(notes), 'orderFields': order_fields(notes),
                'finish': finish_of(r['商品名'], notes), 'material': material_of(r['商品名'], notes),
                'family': fam, 'familyParams': fp, 'skus': [],
            })
    # ch01 dimensions → products (sheet 1章 not available → names inferred)
    by = collections.OrderedDict()
    with open(os.path.join(RAW, 'master_03_dimensions_ch01.csv'), encoding='utf-8') as f:
        for r in csv.DictReader(f):
            by.setdefault(r['pid'], collections.OrderedDict()).setdefault(r['SKU'], collections.OrderedDict())[r['寸法名']] = r['値'] + (' ' + r['単位'] if r['単位'] else '')
    ch01 = []
    for pid, skus in by.items():
        names = set()
        for s, d in skus.items(): names |= set(d.keys())
        first = list(skus.values())[0]
        fam, fp = ch01_family(pid, names, first)
        name = CH01_NAMES.get(pid, '吊バンド系 ' + pid)
        prod = {
            'pid': pid, 'name': name, 'code': None, 'kind': '規格品', 'category': '本体', 'chapter': 1, 'chapterName': '吊バンド',
            'sub': {'hanger_band':'吊バンド','stand_band':'立バンド','insulated_band':'被覆銅管吊バンド','perforated_strap':'穴あき帯鋼',
                    'band_accessory':'吊バンド付属品','turnbuckle_tab':'吊タン','hanger_rod_fitting':'吊金具','hanger_rod':'吊ボルト'}.get(fam, '吊バンド'),
            'maker': '日栄インテック', 'industry': '建築設備', 'page': None, 'notes': '寸法表(1章)より。商品名は寸法パターンから推定。',
            'parsed': {}, 'models': [], 'orderFields': [], 'finish': finish_of(name, ''), 'material': material_of(name, ''),
            'family': fam, 'familyParams': fp, 'nameInferred': True,
            'skus': [{'sku': s, 'dims': d} for s, d in skus.items()],
        }
        ch01.append(prod)
    ch01.sort(key=lambda p: p['pid'])
    allp = ch01 + products
    chapters = collections.OrderedDict()
    for p in allp: chapters.setdefault(p['chapter'], {'no': p['chapter'], 'name': p['chapterName'], 'count': 0})['count'] += 1
    out = {'generatedFrom': ['master_01_products_ch13-14.csv', 'master_03_dimensions_ch01.csv'],
           'driveFolder': 'https://drive.google.com/drive/folders/1OKj8tDxlgBX570npsTSsj5Et0MjP_UNK',
           'chapters': list(chapters.values()), 'products': allp}
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    json.dump(out, open(OUT_JSON, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    os.makedirs(os.path.dirname(OUT_JS), exist_ok=True)
    with open(OUT_JS, 'w', encoding='utf-8') as f:
        f.write('// AUTO-GENERATED by tools/build_catalog.py — do not edit by hand\n')
        f.write('export const CATALOG = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
        f.write('export default CATALOG;\n')
    print('products:', len(allp), 'skus:', sum(len(p['skus']) for p in allp), '→', OUT_JSON)
if __name__ == '__main__': main()
