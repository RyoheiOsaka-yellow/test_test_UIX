"""Build the data-request workbook (生産量推計のためのデータご提供のお願い).

Sheets: はじめに / ⓪ご提供済みデータ / ①ロット実績 / ②勤務実績 / ③設備能力 /
        ④調色・研究棟 / ⑤計画・受注・出荷 / ⑥不良・手直し / ⑦位置ログID
Pre-filled rows: equipment assumed in the 3D model (③) and the anonymous IDs in the
position logs with their process and measured days (⑦). Everything else is left blank.
"""
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter
import datetime as dt
import sys

OUT = sys.argv[1] if len(sys.argv) > 1 else "生産量推計_データご提供のお願い.xlsx"
FONT = "游ゴシック"  # Japanese text needs a Japanese face; Yu Gothic ships with Windows and macOS
GREEN, INK, MUTED = "255A46", "1C2B25", "6F8077"
F_IN = PatternFill("solid", fgColor="FFF2CC")      # input cells
F_EX = PatternFill("solid", fgColor="EDEDED")      # example row
F_CALC = PatternFill("solid", fgColor="E2EFDA")    # formulas
F_PRE = PatternFill("solid", fgColor="DDEBF7")     # pre-filled by us, please check
F_HEAD = PatternFill("solid", fgColor=GREEN)
thin = Side(style="thin", color="C9D4C6")
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)

def font(size=10, bold=False, color=INK, italic=False):
    return Font(name=FONT, size=size, bold=bold, color=color, italic=italic)

PROCESSES = ["ワニス", "仕込み", "調合", "充填", "2B（第二・中ロット仕込み）", "調色", "物流", "その他"]
UNITS = ["kg", "L", "缶", "本", "ケース", "円", "その他"]

wb = Workbook()

def add_list(ws, rng, options):
    dv = DataValidation(type="list", formula1='"' + ",".join(options) + '"', allow_blank=True)
    dv.error, dv.errorTitle = "一覧から選ぶか、空欄にしてください。", "入力値"
    ws.add_data_validation(dv); dv.add(rng)

def sheet(title, heading, purpose, columns, rows=100, example=None, calc=None, lists=None, prefill=None, formats=None):
    """columns: list of (header, width, note). calc: {col_index: formula_template with {r}}."""
    ws = wb.create_sheet(title)
    n = len(columns)
    ws["A1"] = heading; ws["A1"].font = font(14, True)
    ws["A2"] = purpose; ws["A2"].font = font(10, color=MUTED)
    ws["A3"] = "黄色＝記入欄（分かる範囲で・空欄可）　灰色＝記入例　緑＝自動計算　青＝こちらで仮に入れた値（違っていれば上書きしてください）"
    ws["A3"].font = font(9, color=MUTED)
    for c, (h, w, note) in enumerate(columns, 1):
        cell = ws.cell(row=4, column=c, value=h)
        cell.font = font(10, True, "FFFFFF"); cell.fill = F_HEAD; cell.border = BOX
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        ws.column_dimensions[get_column_letter(c)].width = w
        if note:
            from openpyxl.comments import Comment
            cell.comment = Comment(note, "ワールド化成")
    ws.row_dimensions[4].height = 34
    first = 5
    if example:
        for c, v in enumerate(example, 1):
            cell = ws.cell(row=5, column=c, value=v)
            cell.fill, cell.border, cell.font = F_EX, BOX, font(10, color=MUTED, italic=True)
        first = 6
    last = first + rows - 1
    pre = prefill or []
    for r in range(first, last + 1):
        vals = pre[r - first] if r - first < len(pre) else None
        for c in range(1, n + 1):
            cell = ws.cell(row=r, column=c)
            cell.border, cell.font = BOX, font(10)
            if calc and c in calc:
                cell.value = calc[c].format(r=r); cell.fill = F_CALC
            else:
                cell.fill = F_IN
                if vals and c - 1 < len(vals) and vals[c - 1] not in (None, ""):
                    cell.value = vals[c - 1]; cell.fill = F_PRE
    if example and calc:
        for c, f in calc.items():
            ws.cell(row=5, column=c, value=f.format(r=5)).fill = F_EX
    for c, fmt in (formats or {}).items():
        for r in range(5, last + 1):
            ws.cell(row=r, column=c).number_format = fmt
    for c, opts in (lists or {}).items():
        col = get_column_letter(c); add_list(ws, f"{col}{first}:{col}{last}", opts)
    ws.freeze_panes = ws.cell(row=5, column=2)
    ws.sheet_view.zoomScale = 100
    ws.page_setup.orientation = "landscape"; ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_title_rows = "4:4"
    return ws, first, last

# ---------------- ⓪ ご提供済みデータ ----------------
ws0, f0, l0 = sheet(
    "⓪ご提供済みデータ", "⓪ すでにご提供いただいたデータの確認",
    "以前いただいた生産量・販売数・出荷数・金額が、どの期間・単位・細かさかを確認させてください。これで、推計にそのまま使えるかが分かります。",
    [("データ", 18, None), ("ご提供済み", 11, "はい／いいえ／一部"), ("期間", 22, "例：2025年4月〜2026年8月"),
     ("集計の細かさ", 14, "年／月／週／日／ロット"), ("数量の単位", 12, "kg／L／缶／本／円 など"),
     ("品目別の内訳", 12, "あり／なし"), ("工程別の内訳", 12, "あり／なし"),
     ("7/24〜8/31を含む", 14, "位置を計測した期間を含むか"), ("ファイル名・備考", 36, None)],
    rows=8,
    prefill=[["生産量"], ["販売数（受注数）"], ["出荷数"], ["売上金額"], ["在庫（製品）"], ["原材料の使用量"]],
    lists={2: ["はい", "いいえ", "一部"], 4: ["年", "月", "週", "日", "ロット", "その他"], 6: ["あり", "なし"], 7: ["あり", "なし"], 8: ["含む", "含まない", "一部"]})

# ---------------- ① ロット実績 ----------------
sheet("①ロット実績", "① ロット（製造）実績",
      "いつ・何を・どれだけ・どの設備で作ったか。工程ごとの能力と生産性の基準になります。製造日報・バッチ記録をそのまま添付いただく形でも構いません。",
      [("日付", 12, None), ("シフト", 9, None), ("工程", 16, None), ("ロットNo", 14, "製造指図No・バッチNoなど"),
       ("品目名", 22, None), ("品目区分", 14, "例：塗料／ワニス／調色品 など、社内の分類"), ("数量", 10, None), ("単位", 8, None),
       ("開始時刻", 10, "その工程の作業を始めた時刻"), ("終了時刻", 10, "その工程の作業を終えた時刻"), ("所要時間（分）", 12, "自動計算（日をまたぐ場合も可）"),
       ("使用設備", 18, "例：調合槽 T-203、SS-2000充填ライン 1"), ("作業人数", 9, None), ("備考", 30, "やり直し・色替え・待ちなど")],
      rows=300,
      example=[dt.date(2026, 8, 4), "日勤", "調色", "（例）L-0804-01", "（例）外装用塗料 A色", "塗料", 1200, "kg", dt.time(8, 30), dt.time(11, 45), None, "（例）調色槽 No.2", 2, "（例）色合わせ2回"],
      calc={11: '=IF(OR(I{r}="",J{r}=""),"",ROUND(MOD(J{r}-I{r},1)*1440,0))'},
      lists={2: ["日勤", "夜勤", "その他"], 3: PROCESSES, 8: UNITS},
      formats={1: "yyyy/mm/dd", 9: "h:mm", 10: "h:mm", 7: "#,##0.##", 11: "0"})

# ---------------- ② 勤務実績 ----------------
sheet("②勤務実績", "② 勤務実績（工程別・日別）",
      "何人が何時間働いたか。生産量 ÷ 投入人時で生産性を出すのに使います。勤怠データの出力でも構いません。",
      [("日付", 12, None), ("工程", 16, None), ("出勤人数", 10, None), ("所定時間（時間/人）", 12, "例：8"),
       ("残業（合計時間）", 12, "その工程の残業時間の合計"), ("応援で入った（人時）", 12, "他工程から来た人の時間"),
       ("応援で出た（人時）", 12, "他工程へ行った人の時間"), ("投入人時（自動）", 12, "人数×所定＋残業＋応援入−応援出"),
       ("うちフォークリフト運転（人時）", 14, "分かれば"), ("備考", 30, None)],
      rows=200,
      example=[dt.date(2026, 8, 4), "調色", 3, 8, 1.5, 0, 2, None, 0.5, "（例）1名が午後に充填へ応援"],
      calc={8: '=IF(C{r}="","",C{r}*N(D{r})+N(E{r})+N(F{r})-N(G{r}))'},
      lists={2: PROCESSES},
      formats={1: "yyyy/mm/dd", 8: "0.0"})

# ---------------- ③ 設備能力 ----------------
p1 = "第一ペイント工場"
equip = [[p1, "分散", "ATOM'X分散ミル M-1"], [p1, "分散", "ATOM'X分散ミル M-2"], [p1, "分散", "ATOM'X分散ミル M-3"],
         [p1, "分散", "ディスパー槽 T-41"], [p1, "分散", "ディスパー槽 T-43"], [p1, "分散", "ディスパー槽 T-47"], [p1, "分散", "ディスパー槽 T-48"],
         [p1, "調合", "調合槽 T-203"], [p1, "調合", "調合槽 T-208"], [p1, "調合", "調合槽 T-220"],
         [p1, "貯槽", "KVタンク KV-2"], [p1, "貯槽", "KVタンク KV-4"], [p1, "貯槽", "KVタンク KV-6"], [p1, "貯槽", "KVタンク KV-8"],
         [p1, "充填", "SS-2000充填ライン 1"], [p1, "充填", "SS-2000充填ライン 2"], [p1, "充填", "KOYO缶充填機"],
         ["ワニス工場", "ワニス"], ["調色工場", "調色"], ["第二ペイント工場", "2B（第二・中ロット仕込み）"]]
sheet("③設備能力", "③ 設備の能力",
      "設備1台が1回（1バッチ）でどれだけ・何分で処理できるか。工程ごとの能力と、どこが詰まるか（律速工程）を出すのに使います。青い行は3Dモデルで想定している設備（推定）です。違っていれば直し、足りなければ追加してください。",
      [("建屋", 16, None), ("工程", 16, None), ("設備名", 24, None), ("容量", 9, None), ("容量の単位", 9, "L／kg など"),
       ("標準バッチ量", 11, None), ("バッチ量の単位", 9, None), ("1バッチの標準時間（分）", 12, "投入〜払い出しまで"),
       ("1バッチの必要人数", 10, None), ("段取り・洗浄（分/回）", 12, "色替え・品替え1回あたり"), ("色替え・洗浄の頻度", 14, "例：1日2回、ロットごと"),
       ("能力（充填機など）", 12, "例：20"), ("能力の単位", 10, "例：缶/分"), ("1日の稼働時間（時間）", 11, None), ("備考", 28, "実際の設備名・台数の違いなど")],
      rows=60,
      example=["（例）第一ペイント工場", "調合", "（例）調合槽 T-203", 2000, "L", 1500, "kg", 180, 1, 40, "（例）1日1〜2回", None, None, 8, None],
      prefill=equip,
      lists={2: PROCESSES})

# ---------------- ④ 調色・研究棟 ----------------
ws4, f4, l4 = sheet("④調色・研究棟", "④ 調色と研究棟の行き来",
      "計測では、調色担当2人が研究棟と調色工場を3日で246回行き来していました。1ロットに何回の色合わせ・判定が必要かが分かると、移設の効果を生産量に換算できます。",
      [("日付", 12, None), ("ロットNo", 14, None), ("品目名", 22, None), ("色合わせの回数", 11, "調色のやり直しを含む"),
       ("研究棟での判定の回数", 11, None), ("判定1回の時間（分）", 11, "移動を除く"), ("研究棟へ行く主な理由", 16, None),
       ("調色工場で判定できない理由", 30, "機器・光源・承認者など"), ("備考", 26, None)],
      rows=100,
      example=[dt.date(2026, 8, 4), "（例）L-0804-01", "（例）外装用塗料 A色", 3, 2, 10, "色の判定", "（例）測色機が研究棟にしかない", None],
      lists={7: ["色の判定", "品質検査", "サンプルの持参", "承認", "記録・入力", "その他"]},
      formats={1: "yyyy/mm/dd"})
# short questions below the table
q0 = l4 + 3
ws4.cell(row=q0, column=1, value="あわせて教えてください（文章で結構です）").font = font(11, True)
qs = ["研究棟へ行く一番の目的は何ですか？（色の判定・検査・承認など）",
      "その作業は調色工場（または移設先の第二工場）でもできますか？ できない場合、何があればできますか？",
      "1ロットあたり、研究棟との往復は平均何回ですか？ 品目による違いはありますか？",
      "研究棟側の担当者が調色工場へ来る運用は可能ですか？"]
for i, q in enumerate(qs):
    r = q0 + 1 + i
    ws4.cell(row=r, column=1, value=f"Q{i + 1}").font = font(10, True)
    ws4.cell(row=r, column=2, value=q).font = font(10)
    ws4.merge_cells(start_row=r, start_column=2, end_row=r, end_column=4)
    a = ws4.cell(row=r, column=5); a.fill = F_IN; a.border = BOX
    ws4.merge_cells(start_row=r, start_column=5, end_row=r, end_column=9)
    ws4.row_dimensions[r].height = 30
    ws4.cell(row=r, column=2).alignment = Alignment(wrap_text=True, vertical="top")

# ---------------- ⑤ 計画・受注・出荷 ----------------
sheet("⑤計画・受注・出荷", "⑤ 生産計画・受注・出荷",
      "品目区分ごとの計画量・受注量・出荷量・金額。22名で計画量を作れるかの見通しに使います。月ごとで構いません。すでにご提供済みの場合は⓪に記入するだけで結構です。",
      [("年月", 10, "例：2026-08"), ("品目区分", 16, None), ("生産計画量", 12, None), ("生産実績量", 12, None), ("受注量", 12, None),
       ("出荷量", 12, None), ("数量の単位", 10, None), ("売上金額（円）", 14, None), ("月末の製品在庫", 12, "生産と出荷の差を見るため"), ("備考", 26, None)],
      rows=60,
      example=["2026-08", "（例）塗料", 42000, 40500, 41000, 39800, "kg", 38000000, 5200, None],
      lists={7: UNITS},
      formats={3: "#,##0", 4: "#,##0", 5: "#,##0", 6: "#,##0", 8: "#,##0", 9: "#,##0"})

# ---------------- ⑥ 不良・手直し ----------------
sheet("⑥不良・手直し", "⑥ 不良・手直し",
      "良品として出荷できた量を出すのに使います。件数が少なければ、月ごとの合計でも構いません。",
      [("日付", 12, None), ("工程", 16, None), ("ロットNo", 14, None), ("品目名", 22, None), ("数量", 10, None), ("単位", 8, None),
       ("内容", 14, None), ("手直しにかかった時間（分）", 13, None), ("備考", 30, None)],
      rows=100,
      example=[dt.date(2026, 8, 4), "調色", "（例）L-0804-01", "（例）外装用塗料 A色", 50, "kg", "色違い", 45, "（例）再調色で出荷"],
      lists={2: PROCESSES, 6: UNITS, 7: ["色違い", "粘度", "異物", "容器・ラベル", "数量違い", "その他"]},
      formats={1: "yyyy/mm/dd"})

# ---------------- ⑦ 位置ログID ----------------
ids = [["1", "ワニス", "7/24, 7/27, 7/28"], ["2", "ワニス", "7/24, 7/27, 7/28, 7/29"],
       ["3", "仕込み", "7/29, 7/30"], ["4", "仕込み", "7/29, 7/30"],
       ["5", "調合", "8/18, 8/19, 8/20"], ["6", "調合", "7/31, 8/18, 8/19, 8/20"],
       ["7", "充填", "8/27, 8/28, 8/31"], ["8", "充填", "8/27, 8/28, 8/31"],
       ["9", "2B（第二・中ロット仕込み）", "8/24, 8/25, 8/26"], ["10", "2B（第二・中ロット仕込み）", "8/24, 8/25, 8/26"],
       ["11", "調色", "8/3, 8/4, 8/5"], ["12", "調色", "8/3, 8/4, 8/5"],
       ["13", "物流", "8/6, 8/7"], ["14", "物流", "8/6, 8/7, 8/17"], ["18", "物流", "8/17"],
       ["15", "生産管理", "8/21"], ["16", "生産管理", "8/21"], ["NSD", "管理", "7/30"]]
sheet("⑦位置ログID", "⑦ 位置ログのIDと担当の対応",
      "位置ログの匿名IDごとに、担当工程と主な作業を教えてください（氏名は不要です）。人の動きとロット・設備を結び付け、設備の前にいた時間を作業時間として使えるようにします。青い欄は位置ログの記録から入れた値です。",
      [("位置ログのID", 11, None), ("記録上の工程", 20, "位置ログに記録されていた所属"), ("計測日", 22, "位置ログに記録がある日"),
       ("実際の担当工程", 18, "記録と違えば記入"), ("主な担当設備・作業", 28, "例：調合槽 T-203〜220、原料の投入"),
       ("計測日の勤務", 12, None), ("フォークリフトの運転", 12, None), ("備考", 30, "応援・休憩の多い日など")],
      rows=30, prefill=ids,
      lists={4: PROCESSES, 6: ["通常", "応援あり", "短時間", "その他"], 7: ["しない", "ときどき", "よくする"]})

# ---------------- はじめに ----------------
ws = wb["Sheet"]; ws.title = "はじめに"; wb.move_sheet(ws, offset=-(len(wb.sheetnames) - 1))
ws.column_dimensions["A"].width = 6
for col, w in zip("BCDEFG", (22, 46, 9, 40, 14, 12)):
    ws.column_dimensions[col].width = w
ws["B2"] = "生産量の推計に向けた データご提供のお願い"; ws["B2"].font = font(16, True)
ws["B3"] = "加須工場 3Dモデル・動線分析　｜　提案元：ワールド化成　｜　2026-09-24"; ws["B3"].font = font(10, color=MUTED)
lines = [
    ("目的", "3Dモデルと位置データの動線分析に、生産の実績と設備の能力を加え、工程ごとの能力と工場全体の生産量を推計するためです。移設や人員の変更で、生産量がどう変わるかを数字で比べられるようにします。"),
    ("お願い", "分かる範囲でご記入ください。空欄のままで構いません。分からない項目は「不明」と書いていただけると助かります。"),
    ("既存資料でも可", "製造日報・勤怠データ・設備台帳などをお持ちの場合は、そのファイルを添付いただければ、該当シートへの記入は不要です（下の表の「記入状況」を「添付」にしてください）。"),
    ("対象期間", "最優先：2026年7月24日〜8月31日（位置データを計測した期間）。可能であれば直近3か月分。"),
    ("色の意味", "黄色＝記入欄　灰色＝記入例　緑＝自動計算　青＝こちらで仮に入れた値（違っていれば上書き）"),
]
r = 5
for k, v in lines:
    lab = ws.cell(row=r, column=2, value=k); lab.font = font(10, True); lab.alignment = Alignment(vertical="top")
    c = ws.cell(row=r, column=3, value=v); c.font = font(10); c.alignment = Alignment(wrap_text=True, vertical="top")
    ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=7)
    ws.row_dimensions[r].height = 34 if len(v) > 60 else 20
    r += 1
r += 1
ws.cell(row=r, column=2, value="シート一覧と記入状況").font = font(12, True); r += 1
hdr = ["シート", "内容", "優先度", "何に使うか", "記入状況", "記入件数"]
for i, h in enumerate(hdr):
    c = ws.cell(row=r, column=2 + i, value=h); c.font = font(10, True, "FFFFFF"); c.fill = F_HEAD; c.border = BOX
    c.alignment = Alignment(horizontal="center", vertical="center")
r += 1
rows = [
    ("⓪ご提供済みデータ", "以前いただいた生産量・販売数・出荷数・金額の期間と単位", "◎", "今あるデータで推計できる範囲の判断", "B5:B12"),
    ("①ロット実績", "いつ・何を・どれだけ・どの設備で作ったか", "◎", "工程ごとの能力と生産性の基準", "D6:D305"),
    ("②勤務実績", "工程別・日別の出勤人数と時間", "◎", "生産量 ÷ 投入人時（生産性）", "A6:A205"),
    ("③設備能力", "容量・バッチ量・標準時間・段取り時間", "◎", "工程の能力と律速工程", "D6:D65"),
    ("④調色・研究棟", "色合わせ・判定の回数と理由", "○", "移設の効果を生産量に換算", "B6:B105"),
    ("⑤計画・受注・出荷", "品目区分ごとの月別の計画・受注・出荷・金額", "○", "22名で計画量を作れるかの見通し", "A6:A65"),
    ("⑥不良・手直し", "不良・手直しの量と時間", "△", "良品として出せる量", "A6:A105"),
    ("⑦位置ログID", "匿名IDごとの担当工程・作業（氏名不要）", "○", "人の動きとロット・設備を結び付ける", "E5:E34"),
]
first_row = r
for name, what, pri, use, rng in rows:
    vals = [name, what, pri, use, None, f"=COUNTA('{name}'!{rng})"]
    for i, v in enumerate(vals):
        c = ws.cell(row=r, column=2 + i, value=v); c.border = BOX; c.font = font(10, bold=(i == 0))
        c.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center" if i in (2, 4, 5) else "left")
    ws.cell(row=r, column=6).fill = F_IN
    ws.cell(row=r, column=7).fill = F_CALC
    ws.row_dimensions[r].height = 30
    r += 1
add_list(ws, f"F{first_row}:F{r - 1}", ["未着手", "一部記入", "記入済み", "添付", "該当なし"])
ws.cell(row=r, column=2, value="優先度　◎＝推計に必須　○＝あると精度が上がる　△＝分かれば").font = font(9, color=MUTED); r += 1
ws.cell(row=r, column=2, value="記入件数は、各シートの主な列（ご提供済み・ロットNo・日付・容量・年月など）に入力された行数です。こちらで入れた青い値は数えません。").font = font(9, color=MUTED); r += 2
ws.cell(row=r, column=2, value="ご記入者・連絡先").font = font(10, True)
for i, lab in enumerate(["会社・部署", "お名前", "連絡先", "記入日"]):
    ws.cell(row=r + 1 + i, column=2, value=lab).font = font(10)
    c = ws.cell(row=r + 1 + i, column=3); c.fill = F_IN; c.border = BOX
r += 6
ws.cell(row=r, column=2, value="ご不明な点は、ワールド化成の担当者までお問い合わせください。").font = font(9, color=MUTED)
ws.sheet_view.showGridLines = False
ws.page_setup.orientation = "portrait"; ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 0
ws.sheet_properties.pageSetUpPr.fitToPage = True
wb.active = 0
wb.save(OUT)
print("saved", OUT)
