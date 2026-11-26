"""外壁写真 仕分けデスク: 台帳xlsxからデモ用HTMLを生成する。
usage: python3 build.py <建物写真確認台帳.xlsx> <template.html> <out.html>
顧客データ(建物名・写真)は台帳から実行時に読み込み、このファイルには含めない。
"""
import sys, zipfile, re, json, base64, collections
import openpyxl, unicodedata
nk = lambda v: unicodedata.normalize('NFKC', str(v)).strip()

LEDGER, TEMPLATE, OUT = sys.argv[1:4]
C, W, N = 'close', 'wide', 'na'   # 接写 / 全景 / 対象外

def P(kind, label='', *dets):
    return {'kind': kind, 'label': label,
            'dets': [dict(c=d[0], box=d[1], conf=d[2], face=d[3], t=d[4]) for d in dets]}

# 台帳No. -> 仕分け結果(プロトタイプ用に事前作成した判定)
A = {
 659: ('auto', [['ok', 'コメント「シーリング割れ」と写真の検知「目地劣化」が一致']],
   [P(C, '', ('joint', [.5, 0, .1, 1], .93, None, 'シーリング材のひび割れ')), P(N, '通路'), P(N, '植栽・通路')]),
 1406: ('auto', [['ok', 'コメント「色褪せ」「クラック」の両方を写真で検知']],
   [P(C, '', ('fade', [.08, .05, .86, .82], .88, None, '木目調サイディングの色褪せ')),
    P(C, '', ('crack', [.3, .55, .36, .3], .86, 'E', 'サイディングのクラック')), P(C, '')]),
 1189: ('auto', [['ok', 'コメント「ひび割れ」と接写写真の検知が一致']],
   [P(N, '軒天'), P(C, '', ('crack', [.36, .05, .2, .5], .90, None, 'ヘアクラック')), P(N, '外構')]),
 1393: ('auto', [['ok', 'コメント「一部変色」と写真の検知「退色・変色」が一致']],
   [P(W, ''), P(C, '', ('fade', [.2, .1, .56, .76], .83, None, 'パネル面の変色')), P(N, '側溝')]),
 1602: ('auto', [['ok', 'コメント「色褪せ」「目地ひび割れ」の両方を写真で検知']],
   [P(C, '', ('joint', [.37, 0, .1, 1], .91, None, '目地シーリングのひび割れ')),
    P(C, '', ('fade', [.05, .1, .9, .8], .77, None, '外壁面の色褪せ')), P(N, 'ゴミ置場')]),
 1191: ('auto', [['ok', 'コメント「目地切れ」「ハット浮き」の両方を写真で検知']],
   [P(C, '', ('jointcut', [.32, .05, .1, .9], .94, None, '目地の破断')),
    P(C, '', ('lift', [.45, .15, .1, .8], .83, None, 'ハットジョイナーの浮き')), P(N, '通路')]),
 1454: ('auto', [['ok', 'コメント「妻面一部目地切れ」と写真の検知が一致']],
   [P(W, ''), P(C, '', ('jointcut', [.47, 0, .08, 1], .89, 'gable', '縦目地の破断')), P(N, 'ゴミ置場')]),
 1425: ('auto', [['ok', 'コメント「南目地剥離」「南西欠け」の両方を写真で検知']],
   [P(W, ''), P(C, '', ('jointcut', [.3, 0, .22, .9], .80, 'S', '出隅目地の剥離'),
                       ('crack', [.48, .4, .12, .16], .82, 'SW', 'サイディング角の欠け')),
    P(C, '', ('jointcut', [.5, 0, .1, 1], .90, 'S', '目地の隙間'))]),
 429: ('auto', [['ok', 'コメント「西、南側外壁退色」と写真の検知が一致']],
   [P(W, ''), P(C, '', ('fade', [.2, .1, .5, .6], .80, 'W', '外壁面の退色')),
    P(W, '', ('fade', [.1, .25, .6, .5], .76, 'S', '外壁面の退色'))]),
 442: ('human', [['warn', 'コメントは「目地劣化」のみ。写真からは「ヒビ・割れ」も検知（コメントに記載なし）'],
                 ['info', '▲のままで良いか、人の判断が必要']],
   [P(C, '', ('crack', [.3, .08, .3, .88], .81, None, '基礎まわりのひび割れ・補修跡')),
    P(C, '', ('jointcut', [.24, 0, .1, 1], .90, None, '目地の破断・バックアップ材の露出')), P(N, 'ゴミ置場')]),
 1183: ('human', [['warn', '検知の確信度が基準（75%）未満。乱張り調の柄と割れの見分けがつきにくい']],
   [P(C, '', ('joint', [.36, 0, .12, 1], .62, None, '縦目地の劣化の可能性')),
    P(C, '', ('crack', [.3, .42, .4, .2], .58, None, 'サイディング下端の割れの可能性')), P(N, 'エントランス')]),
 752: ('human', [['warn', 'コメント「外壁クラック」に対応する箇所を写真から特定できない']],
   [P(C, '', ('crack', [.25, .1, .2, .8], .41, None, 'クラックの可能性（つる植物と重なり判別困難）')), P(W, ''), P(N, '共用廊下')]),
 924: ('human', [['warn', 'コメントにない異常（天井仕上げの剥がれ）を検知。別項目で報告済みか確認が必要']],
   [P(W, '', ('fade', [.1, .5, .8, .42], .79, None, '1階外壁の退色')), P(N, 'エントランス'),
    P(C, '', ('ext', [.3, .2, .45, .35], .84, None, '天井仕上げの剥がれ（外壁5分類の対象外）'))]),
 1370: ('human', [['warn', 'コメント「サイディング膨れ」を写真で確認できない。凹凸は正対・斜光での撮影か現地確認が必要']],
   [P(N, 'ポーチ'), P(W, '', ('lift', [.45, .3, .3, .5], .47, None, '膨れの可能性（斜めからの撮影で判別困難）')), P(N, '掲示板')]),
 1244: ('human', [['warn', '接写がなく、中距離の写真では確信度が基準未満']],
   [P(W, ''), P(W, '', ('jointcut', [.4, .3, .08, .6], .55, None, '目地切れの可能性')), P(W, '')]),
 971: ('human', [['ng', '×判定（要修繕）は人が最終確定するルール'], ['warn', '破損箇所の確信度が基準未満']],
   [P(C, '', ('crack', [.5, .45, .16, .26], .68, 'unit102', '入隅付近の外壁破損の可能性')), P(C, ''),
    P(W, '', ('stain', [.25, .4, .3, .4], .86, None, '藻・汚れ（集計除外対象）'))]),
 691: ('human', [['ng', '×判定（要修繕）は人が最終確定するルール'], ['ok', 'コメント「目地破損」と写真の検知は高確信度で一致']],
   [P(W, ''), P(C, '', ('jointcut', [.5, .25, .1, .5], .95, None, 'シーリングの破断・バックアップ材の露出')), P(N, 'プランター')]),
 1728: ('human', [['ng', '×判定（要修繕）は人が最終確定するルール'], ['ok', 'コメント「目地が剥離」と写真の検知は高確信度で一致']],
   [P(W, ''), P(C, '', ('jointcut', [.52, 0, .1, 1], .93, None, '目地シーリングの剥離')), P(N, '外灯・駐車場')]),
 819: ('human', [['warn', 'コメント「目地切れ」に対応する箇所を写真で検知できない。検知は白華のみ']],
   [P(C, '', ('stain', [.45, .5, .32, .3], .88, None, '白華（エフロ）')),
    P(W, '', ('stain', [.05, .2, .9, .3], .70, None, '雨だれ汚れ')), P(C, '')]),
 478: ('human', [['warn', '色褪せは天候・露出に左右される。全景写真のみでは確信度が基準未満']],
   [P(W, ''), P(W, '', ('fade', [.05, .4, .9, .25], .52, 'S', '色褪せの可能性'))]),
 111: ('other', [['info', 'モール（付帯部）の不具合。外壁5分類の対象外として別集計']],
   [P(C, '', ('ext', [.25, .3, .55, .1], .80, 'N', '窓上モールの浮き')), P(W, ''), P(N, '駐車場')]),
 268: ('other', [['info', '幕板（付帯部）の不具合。外壁5分類の対象外として別集計']],
   [P(C, '', ('ext', [.2, .33, .62, .13], .90, None, '幕板の外れ')), P(N, 'アンテナ'), P(N, '砂利・桝')]),
 1740: ('other', [['info', '水切り（付帯部）の不具合。外壁5分類の対象外として別集計'], ['warn', '該当箇所は写真に写っていない']],
   [P(W, ''), P(W, ''), P(N, '植栽')]),
 53: ('other', [['info', '白華（エフロ）は外壁5分類の対象外'], ['warn', '全景のみで該当箇所は特定できない']],
   [P(W, ''), P(W, ''), P(N, '駐輪場')]),
 978: ('other', [['info', 'クモの巣は集計除外対象（汚れ・コケ・雑草・虫や鳥類・エアコン等）']],
   [P(W, ''), P(N, '駐車場'), P(W, '')]),
 1619: ('other', [['info', 'コメント「張替作業中」＋写真で足場を検知。修繕対応中として別管理']],
   [P(W, '', ('ext', [.05, .05, .9, .8], .96, None, '足場・養生シート')), P(N, '外構')]),
 1615: ('ret', [['ng', 'BKコメントが未入力（「0」）'], ['info', 'AI所見：コケ・藻のみ（集計除外対象）。5分類の不具合は検知なし']],
   [P(W, '', ('stain', [.3, .45, .4, .35], .90, None, 'コケ・藻')),
    P(W, '', ('stain', [.05, .55, .72, .22], .88, None, 'コケ・藻')), P(N, '外構')]),
 1216: ('ret', [['ng', 'BKコメントが未入力（「0」）'], ['info', 'AI所見：5分類の不具合は検知なし']],
   [P(W, ''), P(W, ''), P(N, '玄関ドア')]),
 1243: ('ret', [['ng', '不具合箇所の接写がなく全景のみ。コメント「目地切れ」を確認できる写真がない']],
   [P(W, ''), P(W, ''), P(W, '')]),
 1529: ('ret', [['ng', '構造区分が #N/A（建物マスタと不整合）'], ['info', 'コメントは分類不能。写真からは「ヒビ・割れ」を検知']],
   [P(C, '', ('crack', [.05, .52, .62, .08], .86, None, '横方向のひび割れ')), P(W, ''),
    P(C, '', ('joint', [.55, 0, .08, 1], .60, None, '目地劣化の可能性'))]),
}
ORDER = ['auto', 'human', 'other', 'ret']

wb = openpyxl.load_workbook(LEDGER, read_only=True, data_only=True)
rows = list(wb['写真確認一覧'].iter_rows(values_only=True))[1:]
z = zipfile.ZipFile(LEDGER)

def rels_of(path):
    out = {}
    for t in re.findall(r'<Relationship [^>]+>', z.read(path).decode()):
        out[re.search(r'Id="([^"]+)"', t).group(1)] = re.search(r'Target="([^"]+)"', t).group(1)
    return out
rels = rels_of('xl/drawings/_rels/drawing2.xml.rels')
imgs = collections.defaultdict(dict)
for c, r, rid in re.findall(r'<xdr:from><xdr:col>(\d+)</xdr:col>.*?<xdr:row>(\d+)</xdr:row>.*?r:embed="(rId\d+)"',
                            z.read('xl/drawings/drawing2.xml').decode(), flags=re.S):
    imgs[int(r)][int(c)] = 'xl/' + rels[rid].replace('../', '')

def uri(path):
    mime = 'image/png' if path.endswith('.png') else 'image/jpeg'
    return f'data:{mime};base64,' + base64.b64encode(z.read(path)).decode()

blds = []
for no, (bucket, why, photos) in A.items():
    r = rows[no - 1]
    assert r[0] == no
    ph = []
    for i, col in enumerate((14, 15, 16)):
        if col in imgs[no] and i < len(photos):
            p = dict(photos[i]); p['slot'] = i; p['src'] = uri(imgs[no][col]); ph.append(p)
    blds.append(dict(no=no, area=r[1], office=r[2], cd=r[4], struct=nk(r[5]), name=nk(r[6]),
                     built=r[7].strftime('%Y/%m'), age=r[8], flagFade=bool(r[10]),
                     now=r[11], prev=r[12], comment=str(r[13]), bucket=bucket, why=why, photos=ph))
blds.sort(key=lambda b: (ORDER.index(b['bucket']), b['no']))

# 台帳全体(全行)のルールベース集計
RX = dict(fade='色褪|色あせ|変色|退色|褪色|チョーキング', crack='クラック|ひび|ヒビ|割れ|亀裂|欠け|欠損|破損',
          lift='浮き|反り|膨れ|ふくれ|波打', joint='目地.*(劣化|痩|硬化)|シーリング|コーキング|シール',
          jointcut='目地切れ|目地割れ|切れ|剥離|隙間|破断', ext='水切|モール|幕板|破風|笠木|雨樋|軒',
          excl='汚れ|コケ|苔|藻|クモ|蜘蛛|雑草|エフロ|白華|水垢')
five = ('fade', 'crack', 'lift', 'joint', 'jointcut')
st = collections.Counter()
for r in rows:
    c = str(r[13])
    hit = {k for k, rx in RX.items() if re.search(rx, c)}
    for k in hit: st['kw_' + k] += 1
    if c.strip() in ('0', '', 'None'): st['noComment'] += 1
    elif not hit: st['unclassified'] += 1
    if hit and not (hit & set(five)): st['outOfFive'] += 1
    if r[5] == '#N/A': st['structNA'] += 1
    if r[11] == '×': st['batsu'] += 1
    if r[12] in ('○', '◎'): st['worsened'] += 1
    if r[12] in ('○', '◎') and r[11] == '×': st['worsened2'] += 1
    if 16 not in imgs[r[0]]: st['twoPhotos'] += 1
st['rows'] = len(rows); st['photos'] = sum(len(v) for v in imgs.values())

st = dict(st); st['funnel'] = [int(v) for v in list(wb['Sheet1'].iter_rows(values_only=True))[5][:4]]
data = dict(stats=st, b=blds)
html = open(TEMPLATE, encoding='utf-8').read().replace('/*__DATA__*/null', json.dumps(data, ensure_ascii=False))
open(OUT, 'w', encoding='utf-8').write(html)
print(len(blds), 'buildings', sum(len(b['photos']) for b in blds), 'photos', len(html) // 1024, 'KB')

