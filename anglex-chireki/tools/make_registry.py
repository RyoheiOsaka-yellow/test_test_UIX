#!/usr/bin/env python3
"""registry/research/*.json（公式出典の調査結果・原本）から、アプリが読む registry/{laws,ordinances,industry}.json を作る。
調査をやり直したら research/ を差し替えてこのスクリプト → build.py の順に実行する。"""
import json, pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent
R = root / 'registry' / 'research'
OUT = root / 'registry'
truthy = lambda v: v is True or str(v).lower() == 'true'
KAN = {'〇': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9}


def k2a(s):
    """第七十二条の二 → 第72条の2"""
    def conv(m):
        t, cur, tot = m.group(0), 0, 0
        for ch in t:
            if ch in KAN: cur = KAN[ch]
            elif ch == '十': tot += (cur or 1) * 10; cur = 0
            elif ch == '百': tot += (cur or 1) * 100; cur = 0
        return str(tot + cur)
    return re.sub(r'[〇一二三四五六七八九十百]+', conv, s or '')


def short_amend(s):
    return re.split(r'[（／]', s or '')[0].strip()


# ───────── 国の法令 ─────────
n = json.loads((R / 'national.json').read_text(encoding='utf-8'))
ids = {'dotaihou': 'act', 'dotaihou-rei': 'order', 'dotaihou-kisoku': 'rule'}
items = []
for l in n['laws']:
    items.append({'id': ids.get(l['id'], l['id']), 'name': l['name'], 'number': l['number'], 'lastAmended': short_amend(l.get('lastAmended')),
                  'lastAmendedFull': l.get('lastAmended'), 'url': l.get('url'), 'quote': l.get('quote'), 'note': l.get('note'), 'verified': truthy(l.get('verified'))})
for x in n['notices']:
    if not truthy(x.get('verified')): continue
    nm = x['name']
    if 'チェックリスト' in nm: continue
    num = x.get('number') or ''
    if '1903015' in num: number, amended = '平成31年3月1日環水大土発第1903015号', '令和4年3月24日'
    elif '2208311' in num: number, amended = '令和4年8月31日環水大水発第2208311号', ''
    else: nm, number, amended = '土壌汚染対策法に基づく調査及び措置に関するガイドライン（改訂第3.1版）', '令和4年8月31日 環境省', ''
    items.append({'id': 'notice', 'name': nm, 'number': number, 'lastAmended': amended, 'url': x.get('url'), 'quote': x.get('quote'), 'note': x.get('note'), 'verified': True})
keymap = {('土壌汚染対策法', '第3条第1項'): 'art3', ('土壌汚染対策法', '第4条第1項'): 'art4', ('土壌汚染対策法', '第5条第1項'): 'art5',
          ('土壌汚染対策法', '第14条第1項'): 'art14', ('土壌汚染対策法', '第6条第1項'): 'art6'}
arts = [{'key': keymap.get((a['law'], a['art'])), 'law': a['law'], 'art': a['art'], 'summary': a.get('summary'), 'threshold': a.get('threshold'),
         'quote': a.get('quote'), 'url': a.get('url'), 'verified': truthy(a.get('verified'))} for a in n['articles']]
ind_src = n['industrySubstances']['sources']
laws = {'checkedOn': n['checkedOn'], 'items': items, 'articles': arts,
        'standards': n['standards'], 'dioxin': n['dioxin'],
        'notes': ['エコ・テック様の既往報告書は、土壌汚染対策法の改正を「令和4年6月17日法律第68号」、施行令を「平成30年政令第283号」または「令和6年4月1日政令304号」、施行規則を「令和4年環境省令第26号」または「令和6年環境省令第17号」と引用しています。'
                  'e-Gov法令検索の改正履歴（' + n['checkedOn'] + ' 確認）では、現行の最終改正は 法＝令和8年5月22日法律第22号、施行令＝令和5年10月18日政令第304号、施行規則＝令和8年6月30日環境省令第19号 です。新しく作るレポートの「1.4 関連法規」には現行の番号を入れます。',
                  '地歴調査通知の文書番号は原本どおり「環水大水発第2208311号」です。ガイドラインは改訂第3.1版（令和4年8月）が現行です。']}
(OUT / 'laws.json').write_text(json.dumps(laws, ensure_ascii=False, indent=1), encoding='utf-8')

# ───────── 条例 ─────────
# 県条例の適用が除外される市（公式記載に基づく。research の appliesNote を参照）
EXCLUDE = {}
OVERRIDE = {}
exec((root / 'tools' / 'registry_overrides.py').read_text(encoding='utf-8')) if (root / 'tools' / 'registry_overrides.py').exists() else None
ords = []
for fn in ['tokyo_osaka.json', 'kanto.json', 'national_ordinances.json']:
    p = R / fn
    if not p.exists(): continue
    d = json.loads(p.read_text(encoding='utf-8'))
    for o in d['ordinances']:
        has = o.get('hasSoilProvision', True) is not False and bool(o.get('rules'))
        rules = []
        for r in (o.get('rules') or []) if has else []:
            basis = r.get('thresholdBasis') or ''
            rule = {'art': k2a(r.get('art')), 'heading': r.get('heading'), 'trigger': r.get('trigger') or 'other', 'threshold': r.get('threshold'),
                    'thresholdBasis': basis, 'areaBasis': 'site' if re.search(r'敷地面積(?!ではない)', basis) and '形質変更の部分' not in basis else 'change',
                    'summary': r.get('summary'), 'duty': r.get('duty'), 'quote': r.get('quote'), 'url': r.get('url'), 'verified': truthy(r.get('verified'))}
            rule.update(OVERRIDE.get((o['pref'], o.get('city'), rule['art']), {}))
            rules.append(rule)
        key = (o['pref'], o.get('city'))
        name = o.get('name') or ''
        ent = {'pref': o['pref'], 'city': o.get('city'), 'name': name if has else f"{o['pref']}{o.get('city') or ''}：独自の調査義務を定める条例なし",
               'origName': name, 'number': o.get('number'), 'lastAmended': o.get('lastAmended'), 'lastAmendedShort': short_amend(o.get('lastAmended')), 'desk': o.get('desk'), 'rules': rules,
               'extraSubstances': o.get('extraSubstances') or [], 'zones': o.get('zones') or [], 'pages': [pg for pg in (o.get('pages') or []) if pg.get('url')],
               'appliesNote': o.get('appliesNote'), 'basis': o.get('verificationBasis'), 'excludeCities': EXCLUDE.get(key, []), 'checkedOn': d['checkedOn'],
               'noneVerified': (not has) and truthy(o.get('verified'))}
        ent.update(OVERRIDE.get((o['pref'], o.get('city')), {}))
        ords.append(ent)
order = ['東京都', '神奈川県', '埼玉県', '千葉県', '大阪府', '愛知県', '三重県', '滋賀県', '京都府', '兵庫県', '広島県', '岡山県', '新潟県', '福岡県', '宮城県', '北海道', '静岡県', '岐阜県', '熊本県']
ords.sort(key=lambda o: (order.index(o['pref']) if o['pref'] in order else 99, o['city'] or ''))
(OUT / 'ordinances.json').write_text(json.dumps(ords, ensure_ascii=False, indent=1), encoding='utf-8')

# ───────── 業種 × 物質（環境省 調査結果の表） ─────────
NAME2ID = {'クロロエチレン': 'VC', '四塩化炭素': 'CCl4', '1,2-ジクロロエタン': '12DCA', '1,1-ジクロロエチレン': '11DCE', '1,2-ジクロロエチレン': '12DCE', '1,3-ジクロロプロペン': '13DCP',
           'ジクロロメタン': 'DCM', 'テトラクロロエチレン': 'PCE', '1,1,1-トリクロロエタン': '111TCA', '1,1,2-トリクロロエタン': '112TCA', 'トリクロロエチレン': 'TCE', 'ベンゼン': 'BZ',
           'カドミウム及びその化合物': 'Cd', '六価クロム化合物': 'Cr6', 'シアン化合物': 'CN', '水銀及びその化合物': 'Hg', 'セレン及びその化合物': 'Se', '鉛及びその化合物': 'Pb',
           '砒素及びその化合物': 'As', 'ふっ素及びその化合物': 'F', 'ほう素及びその化合物': 'B', 'シマジン': 'SIM', 'チオベンカルブ': 'TBC', 'チウラム': 'THI',
           'ポリ塩化ビフェニル（PCB）': 'PCB', '有機りん化合物': 'OP'}
ORDER = list(NAME2ID.values())
rows = n['industrySubstances']['rows']


def pick(industry, label_part, year='令和6年度', table='表3-3'):
    for r in rows:
        if r['industry'] == industry and label_part in (r.get('matchedLabel') or '') and r.get('year') == year and (r.get('table') or '').startswith(table) and r.get('counts'):
            return r
    return None


def official(r):
    c = r['counts']; short = lambda k: k.replace('及びその化合物', '').replace('化合物', '').replace('（PCB）', '')
    kind = '使用等されていた特定有害物質' if '3-3' in r['table'] else '基準不適合物質'
    return {'text': f"環境省「{r['year']} 土壌汚染対策法の施行状況及び土壌汚染調査・対策事例等に関する調査結果」{r['table'].split(' ')[0]}（{r['matchedLabel']}、{r['unitCount']}件、{kind}・複数回答）："
                    + '、'.join(f"{short(k)}{v}" for k, v in c.items()) + f"。{r.get('page', '')}", 'url': r.get('source'), 'n': r['unitCount'], 'counts': c}


def subs_over(r, ratio=0.1, minc=2):
    nn = r['unitCount'] or 1
    return [i for i in ORDER if any(NAME2ID.get(k) == i and (v / nn >= ratio if nn >= 20 else v >= minc) for k, v in r['counts'].items())]


ind = []
# 公式統計だけを根拠に選定する業種（社内実績が無いもの）
for iid, industry, label, year, table, why in [
    ('plating', '金属製品製造業（めっき）', '電気めつき', '令和6年度', '表3-3', '電気めっき施設で使用等されていた特定有害物質のうち、回答施設の1割以上で挙がった物質。'),
    ('cleaning', '洗濯業', '洗たく業', '令和6年度', '表3-3', '洗たく業の洗浄施設で使用等されていた特定有害物質のうち、回答施設の1割以上で挙がった物質（テトラクロロエチレンとその分解生成物）。'),
    ('chem', '化学工業', '16 化学工業', '令和6年度', '表3-13', '化学工業（中分類16）の要措置区域等で基準不適合となった物質のうち、指定件数の1割以上で挙がった物質。製品により大きく異なるため、法人登記の目的で絞り込む。'),
    ('print', '印刷業', '15 印刷', '令和6年度', '表3-13', '印刷・同関連業（中分類15）の要措置区域等で基準不適合となった物質のうち、2件以上で挙がった物質。件数が少ないため参考扱い。'),
    ('gas', '燃料小売業（ガソリンスタンド）', '60 その他の小売業', '令和6年度', '表3-13', 'ガソリンスタンド単独の統計はなく、その他の小売業（中分類60）の値。燃料由来のベンゼンと鉛を選定し、砒素・ふっ素は自然由来の可能性があるため担当者が判断する。'),
]:
    r = pick(industry, label, year, table)
    if not r: continue
    subs = ['BZ', 'Pb'] if iid == 'gas' else subs_over(r)
    ind.append({'id': iid, 'subs': subs, 'why': why, 'src': {'type': 'moe', 'cite': f"環境省「{year} 土壌汚染対策法の施行状況及び土壌汚染調査・対策事例等に関する調査結果」{r['table'].split(' ')[0]}（{r['matchedLabel']}）"}, 'official': official(r)})
# 社内実績に公式統計を併記する業種
for iid, industry, label, year, table in [('hospital', '医療業（病院）', '病院', '令和6年度', '表3-3'), ('elec', '電気機械器具製造業', '29 電気機械器具製造業', '令和6年度', '表3-13'),
                                          ('leather', 'なめし革・同製品・毛皮製造業', '皮革製造業', '令和2年度', '表3-3'), ('autorepair', '自動車整備業', '89 自動車整備業', '令和6年度', '表3-13'),
                                          ('pharma', '医薬品製造業', '医薬品製造業（小計', '令和6年度', '表3-3')]:
    r = pick(industry, label, year, table)
    if r: ind.append({'id': iid, 'official': official(r)})
ind.append({'id': 'pharma', 'src': {'type': 'moe', 'cite': '環境省「令和2年度 土壌汚染対策法の施行状況及び土壌汚染調査・対策事例等に関する調査結果」表3-3（医薬品製造業の各特定施設：シアン・セレン・鉛）。旭区赤川一丁目 報告書 2.6 の引用と一致'}})
ind.append({'id': 'paper', 'src': {'type': 'eco', 'cite': '旭区赤川一丁目 地歴調査報告書（令和5年11月）2.6 での記載。環境省 令和2年度・令和6年度調査の表3-3にパルプ・紙の行はなく、該当する公式の表は未特定'}})
(OUT / 'industry.json').write_text(json.dumps(ind, ensure_ascii=False, indent=1), encoding='utf-8')
print('laws', len(items), 'articles', len(arts), '| ordinances', len(ords), 'rules', sum(len(o['rules']) for o in ords), 'verified', sum(1 for o in ords for r in o['rules'] if r['verified'] and r['url']), '| industry', len(ind))
for i in ind: print(' ', i['id'], i.get('subs'))
