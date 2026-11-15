#!/usr/bin/env python3
"""PoC 事前確認票を作る。質問はこのファイルの QUESTIONS を唯一の元とし、印刷用の HTML（→ PDF）と、入力して返せる Excel の両方を出す。
  HTML: docs/spec/questionnaire.html  （PDF 化: node dev/render-docs.mjs questionnaire.html → docs/pdf/ANGLEX_PoC事前確認票.pdf）
  Excel: docs/forms/ANGLEX_PoC事前確認票.xlsx  （openpyxl が必要: pip install openpyxl。無ければ HTML だけ作る）
実行: python3 tools/build_questionnaire.py"""
import html, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
TITLE = 'PoC 事前確認票'
LEAD = 'PoC を円滑に始めるため、分かる範囲でご記入ください。未定の項目は空欄のままで構いません。ご記入の目安は 10 分ほどです。'

# 種類: single = 1 つ選ぶ / multi = いくつでも / text = 記入 / share = 割合（%）を記入
QUESTIONS = [
    ('1', '図面について', '図面の形式によって、PoC の形態（単体で動くオフライン版か、変換機能を持つサーバー版か）が決まります。', [
        ('1-1', '積算に使う図面の形式（おおよその割合）', 'share', ['DXF', 'DWG', 'JWW（Jw_cad）', 'PDF（CAD から出力）', 'PDF・画像（紙のスキャン）', 'その他'], 'DWG・JWW は DXF への変換が必要です'),
        ('1-2', 'PoC にご提供いただける図面の枚数', 'single', ['10 枚未満', '10〜20 枚', '20 枚以上'], ''),
        ('1-3', '正解表（拾い出し表・重量計算・見積書）のご提供', 'single', ['可', '一部可', '不可'], '認識結果と自動で照合します'),
        ('1-4', '図面の取扱い条件', 'single', ['社外提供可（秘密保持契約の範囲）', '貴社内でのみ閲覧可', '一部の塗りつぶしが必要'], ''),
    ]),
    ('2', 'BIM・CAD ソフトについて', 'IFC の受け渡し（検証項目 V11）を行う場合に伺います。行わない場合は 2-3 のみご記入ください。', [
        ('2-1', 'お使いのソフト', 'multi', ['Rebro', 'CADWe\'ll Tfas', 'Revit', 'Tekla Structures', 'Archicad', 'AutoCAD', 'Jw_cad', 'その他'], '版（バージョン）もお書きください'),
        ('2-2', '受け取れる IFC の版', 'single', ['IFC2x3', 'IFC4', '両方', '不明'], 'ANGLEX は IFC4 と IFC2x3 のどちらでも書き出せます'),
        ('2-3', 'IFC の受け渡しを PoC で確認したい', 'single', ['はい', 'いいえ', '未定'], ''),
        ('2-4', 'そのソフトで書き出した IFC のサンプル（支持金具または鉄骨を含むもの 1〜3 件）', 'single', ['提供可', '不可'], '読込の確認に使います'),
    ]),
    ('3', '加工機について', 'NC データの受け渡し（検証項目 V12）を行う場合に伺います。行わない場合は空欄で構いません。', [
        ('3-1', '加工機のメーカー・型式', 'text', [], ''),
        ('3-2', '制御装置・付属ソフトの名称', 'text', [], ''),
        ('3-3', '受け取れるデータ形式', 'multi', ['DSTV NC（.nc1）', 'DXF', 'メーカー独自形式', '手入力のみ', '不明'], '独自形式の場合は名称をお書きください'),
        ('3-4', '照合テストピース（山形鋼 L-50×50×6、長さ 300 mm、穴 4 個）の試し加工', 'single', ['可', '不可', '未定'], '面の向きと原点の基準を 1 本で確かめられます'),
    ]),
    ('4', 'PC・利用環境について', 'オフライン版は約 60 MB の HTML ファイル 1 つで、インストールも外部への通信も不要です。', [
        ('4-1', 'OS', 'single', ['Windows 10', 'Windows 11', 'macOS'], ''),
        ('4-2', 'メモリ', 'single', ['8 GB', '16 GB', '32 GB 以上', '不明'], '16 GB 以上を推奨します'),
        ('4-3', 'ブラウザ', 'single', ['Chrome', 'Edge', 'その他'], ''),
        ('4-4', 'インターネット接続', 'single', ['可', '制限あり', '不可（閉域）'], ''),
        ('4-5', 'ファイルの持ち込み方法', 'multi', ['メール添付', 'ファイル共有サービス', 'USB メモリ', 'その他'], ''),
        ('4-6', 'ソフトの持ち込みに必要な社内手続き', 'single', ['不要', '申請が必要'], '申請が必要な場合は、所要日数の目安をお書きください'),
    ]),
    ('5', 'PoC の進め方について', '', [
        ('5-1', '開始のご希望時期', 'text', [], ''),
        ('5-2', 'ご参加いただける方（人数、部署・役割）', 'text', [], '積算を担当されている方 2〜3 名を想定しています'),
        ('5-3', '現在の積算の所要時間（図面 1 件あたり、受領から見積書まで）', 'text', [], '短縮効果の比較に使います'),
        ('5-4', 'PoC で特に確かめたいこと', 'multi', ['図面からの拾い出しの正確さ', '重量・見積の正確さ', '作業時間の短縮', '3D での確認のしやすさ', 'BIM・CAD との連携', '加工データの出力', 'その他'], ''),
        ('5-5', '合格基準（計画書 4 章）へのご意見・ご要望', 'text', [], ''),
    ]),
]
SIGN = ['会社名', '部署・お役職', 'お名前', 'ご連絡先（電話・メール）', 'ご記入日']
HINT = {'single': '1 つ選択', 'multi': '複数選択可', 'text': 'ご記入ください', 'share': '割合を記入'}


def build_html():
    e = lambda t: html.escape(t, quote=False)
    out = []
    for no, name, why, qs in QUESTIONS:
        rows = []
        for qn, q, kind, opts, note in qs:
            if kind == 'share':
                ans = '<div class="opts">' + ''.join(f'<span class="o">{e(o)} <i class="pc"></i> %</span>' for o in opts) + '</div>'
            elif kind in ('single', 'multi'):
                ans = '<div class="opts">' + ''.join(f'<span class="o"><i class="bx"></i>{e(o)}' + ('（<i class="ln s"></i>）' if o in ('その他', 'メーカー独自形式', '申請が必要') else '') + '</span>' for o in opts) + '</div>'
                if qn == '2-1': ans += '<div class="sub">版: <i class="ln w"></i></div>'
                if qn == '4-6': ans += '<div class="sub">所要日数の目安: <i class="ln s"></i> 日</div>'
            else:
                ans = '<div class="wr"></div>' + ('<div class="wr"></div>' if qn in ('5-2', '5-5') else '')
            rows.append(f'<tr><td class="n">{qn}</td><td class="q">{e(q)}<span class="k">{HINT[kind]}</span>' + (f'<div class="nt">{e(note)}</div>' if note else '') + f'</td><td class="a">{ans}</td></tr>')
        out.append(f'<div class="blk"><div class="sec"><span class="n">{no}</span><h2>{e(name)}</h2></div>' + (f'<p class="why">{e(why)}</p>' if why else '') + f'<table class="qt">{"".join(rows)}</table></div>')
    sign = ''.join(f'<tr><td class="q">{e(x)}</td><td class="a"><div class="wr"></div></td></tr>' for x in SIGN)
    page = f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>ANGLEX {TITLE}</title><link rel="stylesheet" href="doc.css"><style>
.hd{{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid var(--accent);padding-bottom:6pt;margin-bottom:6pt}}.hd .b{{font-size:9pt;letter-spacing:.2em;color:var(--ink3)}}.hd h1{{font-size:20pt;margin-top:2pt}}.hd .r{{font-size:9pt;color:var(--ink2);text-align:right;line-height:1.6}}
.to{{display:inline-block;min-width:70mm;border-bottom:1px solid #777;margin-right:4pt}}
.lead{{font-size:10pt;margin:4pt 0 2pt}}
.sec{{display:flex;align-items:baseline;gap:8pt;margin:6pt 0 1pt;break-after:avoid}}.sec .n{{font-size:17pt;font-weight:800;color:var(--accent);line-height:1}}.sec h2{{border:0;margin:0;padding:0;font-size:13pt}}
.why{{font-size:8.2pt;color:var(--ink3);margin:0 0 2pt}}.blk{{break-inside:avoid}}
.qt{{font-size:9pt;margin:0}}.qt td{{padding:2.2pt 5pt;vertical-align:top;border:1px solid #cfcbbf;line-height:1.45}}.qt .n{{width:9mm;font-weight:700;color:var(--accent2);white-space:nowrap}}.qt .q{{width:74mm;background:#f6f4ee}}.qt .k{{display:inline-block;margin-left:5pt;font-size:7.5pt;color:#fff;background:#8a8778;border-radius:8pt;padding:0 5pt;line-height:12pt;white-space:nowrap}}.qt .nt{{font-size:7.8pt;color:var(--ink3);margin-top:0}}
.opts{{display:flex;flex-wrap:wrap;gap:1pt 12pt}}.o{{white-space:nowrap}}.bx{{display:inline-block;width:9pt;height:9pt;border:1.2px solid #444;border-radius:1.5pt;margin-right:4pt;vertical-align:-1pt;background:#fff}}
.pc{{display:inline-block;width:11mm;border-bottom:1px solid #555;height:10pt;vertical-align:-1pt}}.ln{{display:inline-block;border-bottom:1px solid #555;height:10pt;vertical-align:-1pt}}.ln.s{{width:22mm}}.ln.w{{width:80mm}}
.sub{{margin-top:4pt;font-size:9pt}}.wr{{height:13pt;border-bottom:1px dotted #888}}
.sg .q{{width:44mm}}.ret{{margin-top:7pt;font-size:9.5pt;border:1.5px solid var(--accent);border-radius:5pt;padding:6pt 9pt;background:#fff7f1;break-inside:avoid}}
</style></head><body>
<div class="hd"><div><div class="b">ANGLEX ／ 導入 PoC</div><h1>{TITLE}</h1></div><div class="r"><span class="to">　</span>御中<br>提出元　ワールド化成</div></div>
<p class="lead">{e(LEAD)}</p>
{chr(10).join(out)}
<div class="blk"><div class="sec"><span class="n">6</span><h2>ご記入者</h2></div><table class="qt sg">{sign}</table></div>
<div class="ret"><b>ご返送先</b>　ワールド化成　担当: <i class="ln s"></i>　／　メール: <i class="ln w"></i><br>本票は Excel 版（同じ内容）でもお渡しできます。ご記入いただいた内容は、PoC の準備と実施のためだけに使います。</div>
</body></html>'''
    p = ROOT / 'docs/spec/questionnaire.html'
    p.write_text(page, encoding='utf-8')
    print('wrote', p.relative_to(ROOT))


def build_xlsx():
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
        from openpyxl.worksheet.datavalidation import DataValidation
    except ImportError:
        print('openpyxl が無いため、Excel 版は作りませんでした（pip install openpyxl）')
        return
    wb = Workbook(); ws = wb.active; ws.title = '事前確認票'
    thin = Side(style='thin', color='BFBBAF'); box = Border(left=thin, right=thin, top=thin, bottom=thin)
    wrap = Alignment(wrap_text=True, vertical='top'); acc = 'B4502D'
    fill_q = PatternFill('solid', start_color='F6F4EE'); fill_a = PatternFill('solid', start_color='FFFBE6'); fill_h = PatternFill('solid', start_color='1F1E1A'); fill_s = PatternFill('solid', start_color='F3D6C4')
    for col, w in zip('ABCDE', [7, 44, 46, 46, 40]): ws.column_dimensions[col].width = w
    ws['A1'] = f'ANGLEX 導入 PoC　{TITLE}'; ws['A1'].font = Font(size=16, bold=True, color=acc); ws.merge_cells('A1:E1'); ws.row_dimensions[1].height = 26
    ws['A2'] = '提出元: ワールド化成'; ws.merge_cells('A2:E2')
    ws['A3'] = LEAD + ' 黄色の欄にご記入ください。選択式の欄は、セルを選ぶと右に出る ▼ から選べます。'; ws.merge_cells('A3:E3'); ws['A3'].alignment = wrap; ws.row_dimensions[3].height = 32
    r = 5
    for c, t in zip('ABCDE', ['No', 'ご質問', 'ご回答（選択 / 記入）', '補足のご記入（版・名称・その他の内容など）', '選択肢・ご説明']):
        cell = ws[f'{c}{r}']; cell.value = t; cell.font = Font(bold=True, color='FFFFFF'); cell.fill = fill_h; cell.alignment = Alignment(vertical='center', wrap_text=True); cell.border = box
    ws.freeze_panes = 'A6'; r += 1
    n_fill = 0
    for no, name, why, qs in QUESTIONS:
        ws[f'A{r}'] = f'{no}　{name}' + (f'　— {why}' if why else ''); ws.merge_cells(f'A{r}:E{r}'); ws[f'A{r}'].font = Font(bold=True, color=acc); ws[f'A{r}'].fill = fill_s; ws[f'A{r}'].alignment = wrap; ws.row_dimensions[r].height = 30 if why else 20; r += 1
        for qn, q, kind, opts, note in qs:
            if kind == 'share':
                ws[f'A{r}'] = qn; ws[f'B{r}'] = q + '（下の各行に % をご記入ください）'; ws[f'E{r}'] = note
                for c in 'ABCDE': ws[f'{c}{r}'].border = box; ws[f'{c}{r}'].alignment = wrap
                ws[f'B{r}'].fill = fill_q; r += 1
                first = r
                for o in opts:
                    ws[f'B{r}'] = '　' + o; ws[f'C{r}'].fill = fill_a; ws[f'C{r}'].number_format = '0"%"'; ws[f'E{r}'] = '数字のみ（例: 40）' if o == opts[0] else ''
                    for c in 'ABCDE': ws[f'{c}{r}'].border = box
                    n_fill += 1; r += 1
                ws[f'B{r}'] = '　合計'; ws[f'C{r}'] = f'=SUM(C{first}:C{r - 1})'; ws[f'C{r}'].number_format = '0"%"'; ws[f'E{r}'] = '100% になれば完了です'; ws[f'B{r}'].font = Font(bold=True)
                for c in 'ABCDE': ws[f'{c}{r}'].border = box
                r += 1; continue
            ws[f'A{r}'] = qn; ws[f'B{r}'] = q; ws[f'B{r}'].fill = fill_q; ws[f'C{r}'].fill = fill_a; ws[f'D{r}'].fill = fill_a
            tip = {'single': '選択肢: ' + ' / '.join(opts), 'multi': '複数選択可: ' + ' / '.join(opts) + '（当てはまるものを「ご回答」欄に並べてお書きください）', 'text': 'ご記入ください'}[kind]
            ws[f'E{r}'] = tip + (f'\n{note}' if note else '')
            if kind == 'single':
                dv = DataValidation(type='list', formula1='"' + ','.join(o.replace(',', '、') for o in opts) + '"', allow_blank=True); dv.error = '一覧から選んでください'; dv.prompt = '▼ から選んでください'; ws.add_data_validation(dv); dv.add(f'C{r}')
            for c in 'ABCDE': ws[f'{c}{r}'].border = box; ws[f'{c}{r}'].alignment = wrap
            lines = max(1, len(q) // 20 + 1, len(ws[f'E{r}'].value) // 19 + 1 + ws[f'E{r}'].value.count('\n'))
            ws.row_dimensions[r].height = max(20, 15 * lines); n_fill += 1; r += 1
    ws[f'A{r}'] = '6　ご記入者'; ws.merge_cells(f'A{r}:E{r}'); ws[f'A{r}'].font = Font(bold=True, color=acc); ws[f'A{r}'].fill = fill_s; r += 1
    for x in SIGN:
        ws[f'B{r}'] = x; ws[f'B{r}'].fill = fill_q; ws[f'C{r}'].fill = fill_a; ws.merge_cells(f'C{r}:D{r}')
        for c in 'ABCDE': ws[f'{c}{r}'].border = box
        r += 1
    r += 1
    ws[f'A{r}'] = 'ご返送先: ワールド化成（担当・メールアドレスは、送付時にお知らせします）。ご記入いただいた内容は、PoC の準備と実施のためだけに使います。'; ws.merge_cells(f'A{r}:E{r}'); ws[f'A{r}'].alignment = wrap; ws.row_dimensions[r].height = 30
    ws.page_setup.orientation = 'landscape'; ws.page_setup.paperSize = ws.PAPERSIZE_A4; ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 0; ws.sheet_properties.pageSetUpPr.fitToPage = True; ws.print_title_rows = '5:5'
    out = ROOT / 'docs/forms'; out.mkdir(parents=True, exist_ok=True); p = out / f'ANGLEX_{TITLE.replace(" ", "")}.xlsx'; wb.save(p)
    print('wrote', p.relative_to(ROOT), f'（記入欄 {n_fill} 行）')


if __name__ == '__main__':
    build_html(); build_xlsx()
