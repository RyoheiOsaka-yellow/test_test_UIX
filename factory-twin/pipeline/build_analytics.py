#!/usr/bin/env python3
"""ATOMIX 加須工場 分析基盤パイプライン

data/raw/ の元Excel → data/processed/*.csv（正規化・匿名化済み）
                    → src/data/analytics.json（3Dビューア連動用の集計）

氏名は一切出力しない。担当者は「作業者01」形式の連番IDに置換し、日報の備考欄（氏名を含む）は捨てる。
実行: python3 pipeline/build_analytics.py   （要 openpyxl, xlrd）
"""
import csv, json, re, sys, unicodedata, collections, pathlib, datetime, statistics
import openpyxl, xlrd

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW, OUT, SRC = ROOT / "data/raw", ROOT / "data/processed", ROOT / "src/data"

def norm(v):
    """全角/半角・長音・空白の揺れを吸収した文字列（設備番号の結合キー用）"""
    if v is None or v == "": return ""
    s = unicodedata.normalize("NFKC", str(v)).strip()
    return re.sub(r"\s+", " ", s)
def tag(v):
    s = norm(v).upper().replace("ー", "-").replace("‐", "-").replace("−", "-").replace(" ", "")
    return s
def num(v):
    if v is None or v == "": return None
    if isinstance(v, (int, float)): return float(v)
    m = re.findall(r"-?\d+(?:\.\d+)?", norm(v))
    return sum(float(x) for x in m) if m and re.fullmatch(r"[\d.+\s]+", norm(v)) else None
def r1(v, d=1): return None if v is None else round(v, d)
def year_of(month): return 2025 if month >= 9 else 2026   # 資料期間: 2025/9〜2026/3

# ---------- 匿名化 ----------
_people = {}
def person(v):
    s = norm(v).replace("齋", "斎")
    if not s: return ""
    if s not in _people: _people[s] = f"作業者{len(_people)+1:02d}"
    return _people[s]

# ---------- 1. 製造バッチ（生産データ.xlsx） ----------
CAN_TYPES = [("ﾄﾞﾗﾑ品", "ドラム200L"), ("石油缶", "石油缶18L"), ("7L半缶", "半缶7L"), ("5.4Ｌ～1L角缶", "角缶1-5.4L"),
             ("3Ｌ～4L丸缶", "丸缶3-4L"), ("1.6Ｌ～1.8L丸缶", "丸缶1.6-1.8L"), ("0.7丸缶", "丸缶0.7L"), ("300ＭＬ以下", "300mL以下")]
LINE = {"１B": "1B", "２B": "2B", "ﾜﾆｽ": "ワニス"}

def load_batches():
    wb = openpyxl.load_workbook(RAW / "production.xlsx", read_only=True, data_only=True)
    batches, fills = [], []
    for ws in wb.worksheets:
        rows = list(ws.iter_rows(values_only=True))
        top, cols = "", {}
        for i, (a, b) in enumerate(zip(rows[0], rows[1])):
            if a: top = str(a).split()[0].replace("\n", "")
            key = top + "/" + (str(b).replace("\n", "").replace(" ", "").replace("　", "") if b else "")
            cols.setdefault(key, []).append(i)
        def g(r, key, k=0):
            ix = cols.get(key)
            return r[ix[k]] if ix and len(ix) > k and ix[k] < len(r) else None
        line = LINE[ws.title]
        for n, r in enumerate(rows[2:]):
            if not r or len(r) < 8 or not r[7]: continue
            mo, dy = num(g(r, "生産日/月")), num(g(r, "生産日/日"))
            date = ""
            if mo and dy:
                try: date = datetime.date(year_of(int(mo)), int(mo), int(dy)).isoformat()
                except ValueError: date = ""
            bid = f"{line}-{n+1:04d}"
            b = dict(batch_id=bid, line=line, date=date, month=date[:7],
                     dept=norm(g(r, "部門名/品群1")), base=norm(g(r, "水性/油性/")),
                     product=norm(g(r, "製品/製品名")), color=norm(g(r, "製品/色名")),
                     prep_disper=tag(g(r, "仕込み製造ﾗｲﾝ/ﾃﾞｨｽﾊﾟｰ")), prep_tank=tag(g(r, "仕込み製造ﾗｲﾝ/仕込ﾀﾝｸ")),
                     mill=tag(g(r, "分散ﾃﾞｰﾀ/分散機")), mix_disper=tag(g(r, "調合ﾗｲﾝ/ﾃﾞｨｽﾊﾟｰ")), mix_tank=tag(g(r, "調合ﾗｲﾝ/調合ﾀﾝｸ")),
                     premix_min=num(g(r, "ﾐﾙﾍﾞｰｽ状態/pm時間")), mill_min=num(g(r, "分散ﾃﾞｰﾀ/分散時間")),
                     output_kg=num(g(r, "製造量/出来高kg")), charge_kg=num(g(r, "製造量/総仕込量kg")),
                     loss_pct=None, yield_pct=None,
                     color_checks=num(g(r, "調合工程/測色回数")),
                     prep_min=num(g(r, "合計/仕込工程")), mix_min=num(g(r, "合計/調合工程")),
                     fill_min=num(g(r, "合計/充填工程")), total_min=num(g(r, "総計/")),
                     wash_min=(num(g(r, "仕込工程/洗浄")) or 0) + (num(g(r, "充填工程/洗浄")) or 0) or None,
                     staff_prep=person(g(r, "担当者/仕込")), staff_mix=person(g(r, "担当者/調合")),
                     staff_fill=person(g(r, "担当者/充填", 0)), staff_fill2=person(g(r, "担当者/充填", 1)))
            lp, yp = num(g(r, "製造量/ﾛｽ％")), num(g(r, "収率/％"))
            if lp is not None and abs(lp) < 1: b["loss_pct"] = round(lp * 100, 2)
            if yp is not None and 0 < yp < 1.2: b["yield_pct"] = round(yp * 100, 2)
            cans = std = act = 0; machines = []
            for raw_name, label in CAN_TYPES:
                c = num(g(r, raw_name + "/缶数")); m = tag(g(r, raw_name + "/充填機種"))
                s, a = num(g(r, raw_name + "/標準時間")), num(g(r, raw_name + "/実際時間"))
                if not c and not m: continue
                fills.append(dict(batch_id=bid, line=line, date=date, can_type=label, machine=m, cans=c,
                                  std_min=r1(s), actual_min=r1(a), indirect_min=num(g(r, raw_name + "/間接時間"))))
                cans += c or 0
                if s and a: std += s; act += a
                if m: machines.append(m)
            b.update(cans=cans or None, fill_std_min=r1(std) or None, fill_actual_min=r1(act) or None,
                     fill_machine="/".join(dict.fromkeys(machines)))
            batches.append(b)
    return batches, fills

# ---------- 2. 日報（人数・作業時間） ----------
NIPPO = {"nippo_1B_mix.xls": "1B仕込み・調合", "nippo_1B_fill.xlsx": "1B充填", "nippo_2B.xls": "2B",
         "nippo_varnish.xlsx": "ワニス", "nippo_choshoku.xlsx": "調色"}
def sheet_rows(path):
    if path.suffix.lower() == ".xls":
        wb = xlrd.open_workbook(path)
        for sh in wb.sheets(): yield sh.name, [sh.row_values(i) for i in range(sh.nrows)]
    else:
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        for ws in wb.worksheets: yield ws.title, [list(r) for r in ws.iter_rows(values_only=True)]
def load_labor():
    out = []
    for fn, dept in NIPPO.items():
        for name, rows in sheet_rows(RAW / fn):
            m = re.search(r"(\d+)月", norm(name))
            if not m or "原紙" in name: continue
            month = int(m.group(1)); year = year_of(month)
            hdr_i = next((i for i, r in enumerate(rows) if any(norm(c) == "日付" for c in r)), None)
            if hdr_i is None: continue
            hdr = [norm(c) for c in rows[hdr_i]]
            col = lambda *names: next((hdr.index(n) for n in names if n in hdr), None)
            ci = dict(day=col("日付"), head=col("人数"), hours=col("作業時間"), ot=col("残業時間"),
                      early=col("早退時間", "早退"), other=col("他時間"), out=col("応援出"), inn=col("応援受"), off=col("休み"))
            roster = next((num(r[i + 1]) for r in rows[:hdr_i] for i, c in enumerate(r[:-1]) if norm(c) == "在籍数"), None)
            for r in rows[hdr_i + 1:]:
                v = lambda k: num(r[ci[k]]) if ci[k] is not None and ci[k] < len(r) else None
                d, h = v("day"), v("head")
                if not d or not h or d > 31: continue
                try: date = datetime.date(year, month, int(d)).isoformat()
                except ValueError: continue
                out.append(dict(dept=dept, date=date, month=date[:7], roster=roster, headcount=h, work_hours=v("hours"),
                                overtime_hours=v("ot"), early_leave_hours=v("early"), other_hours=v("other"),
                                support_out=v("out"), support_in=v("inn"), absent=v("off")))
    return out

# ---------- 3. 月次トン数・売上 ----------
def load_monthly():
    wb = openpyxl.load_workbook(RAW / "tonnage_sales.xlsx", read_only=True, data_only=True)
    unit = {"生産トン数": "t", "出荷トン数": "t", "在庫トン数": "t", "売上高": "千円"}
    out = []
    for ws in wb.worksheets:
        rows = [list(r) for r in ws.iter_rows(values_only=True)]
        mi = next(i for i, r in enumerate(rows) if any("月" in norm(c) and len(norm(c)) <= 3 for c in r))
        months = {}
        for j, c in enumerate(rows[mi]):
            m = re.fullmatch(r"(\d+)月", norm(c))
            if m: months[j] = int(m.group(1))
        for r in rows[mi + 2:]:
            first = min(months)   # 区分名は最初の月の列より左にある文字セル
            cat = next((norm(c) for c in r[:first] if isinstance(c, str) and norm(c)), "")
            if not cat or cat.startswith("※"): continue
            for j, mo in months.items():
                p, a = num(r[j]), num(r[j + 1]) if j + 1 < len(r) else None
                if p is None and a is None: continue
                out.append(dict(metric=ws.title, unit=unit.get(ws.title, ""), category=cat.replace("ﾚｲｽﾞ", "レイズ"),
                                month=f"{year_of(mo)}-{mo:02d}", plan=r1(p, 1), actual=r1(a, 1)))
    return out

# ---------- 4. 設備台帳 ----------
LOC = {"第１ペイント工場": "paint1", "第1ペイント工場": "paint1", "第1ペイント": "paint1", "第２ペイント工場": "paint2",
       "第2ペイント工場": "paint2", "第2ペイント": "paint2", "ワニス工場": "varnish", "調色工場": "tint",
       "屋外タンク関係": "tank", "屋外設備": "outdoor", "その他": "other"}
def load_equipment():
    wb = xlrd.open_workbook(RAW / "equipment_ledger.xls")
    out = []
    for sn, cat in [("タンク・撹拌機", "タンク・撹拌機"), ("分散機", "分散機"), ("充填機", "充填機"), ("ポンプ", "ポンプ"), ("その他", "その他")]:
        sh = wb.sheet_by_name(sn); sec = ""; hdr = []
        for i in range(sh.nrows):
            r = sh.row_values(i)
            if norm(r[0]) == "入力番号": hdr = [norm(c).replace(" ", "") for c in r]; continue
            if r[0] == "" and r[1] == "" and isinstance(r[2], str) and r[2].strip() and (len(r) < 4 or r[3] == ""):
                sec = norm(r[2]); continue
            if not isinstance(r[0], float) or not norm(r[2]) or not hdr: continue
            H = lambda name: (r[hdr.index(name)] if name in hdr and hdr.index(name) < len(r) else "")
            yi = hdr.index("購入年月") if "購入年月" in hdr else None
            specs = []
            pi = hdr.index("購入価格") if "購入価格" in hdr else 16
            for j in range(pi + 1, len(r)):
                v = norm(r[j])
                if not v or v in ("0", "0.0"): continue
                if isinstance(r[j], float) and r[j] == int(r[j]): v = str(int(r[j]))
                label = hdr[j] if j < len(hdr) and hdr[j] and not re.fullmatch(r"[\d.]+", hdr[j]) else ""
                specs.append(f"{label}:{v}" if label else v)
            t = tag(H("設備番号")); t = re.sub(r"\.0$", "", t)
            yr = num(r[yi]) if yi is not None else None
            price = num(H("購入価格"))
            out.append(dict(category=cat, building=LOC.get(sec.replace(" ", ""), "other"), location=norm(H("設置場所")),
                            name=re.sub(r"\s+", "", norm(H("名称"))), tag=t, model=norm(H("型式")), maker=norm(H("作製社名")),
                            purchase_year=int(yr) if yr and 1900 < yr < 2100 else None,
                            purchase_price=int(price) if price and price > 1000 else None,
                            specs=" / ".join(specs)[:400]))
    return out

# ---------- 5. 調色 色補正回数 ----------
def span_min(s):
    """'9.42-10.22' や '13.45-14.05/9.53-10.03' を分に換算。読めない区間は無視。"""
    total, ok = 0, False
    for part in re.split(r"[/／]", norm(s)):
        m = re.fullmatch(r"\s*(\d{1,2})[.:](\d{1,2})\s*-\s*(\d{1,2})[.:](\d{1,2})\s*", part)
        if not m: continue
        h1, m1, h2, m2 = m.groups()
        f = lambda mm: int(mm) * (10 if len(mm) == 1 else 1)
        d = int(h2) * 60 + f(m2) - int(h1) * 60 - f(m1)
        if 0 < d < 600: total += d; ok = True
    return total if ok else None
def load_color():
    wb = openpyxl.load_workbook(RAW / "color_correction.xlsx", read_only=True, data_only=True)
    out = []
    for ws in wb.worksheets:
        m = re.search(r"(\d+)月\s*(\d+)日", norm(ws.title))
        if not m: continue
        date = datetime.date(2026, int(m.group(1)), int(m.group(2))).isoformat()
        c0 = None
        for r in ws.iter_rows(values_only=True):
            r = list(r) + [None] * 10
            if c0 is None:
                c0 = next((i for i, c in enumerate(r) if norm(c) == "製品名"), None)   # 見出し行で列位置を決める
                continue
            p = r[c0:c0 + 7]
            if not p[0]: continue
            out.append(dict(date=date, product=norm(p[0]), color=norm(p[1]), fill_size=norm(p[2]), cans=num(p[3]),
                            tint_min=span_min(p[4]), corrections=num(p[5]), fill_min=span_min(p[6])))
    return out

# ---------- 出力 ----------
def write_csv(name, rows):
    if not rows: return
    keys = list(rows[0].keys())
    with open(OUT / name, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=keys); w.writeheader()
        for r in rows: w.writerow({k: ("" if r.get(k) is None else r.get(k)) for k in keys})
def S(rows, k): return sum(r[k] for r in rows if r.get(k) is not None)
def mean(v): v = [x for x in v if x is not None]; return round(statistics.mean(v), 2) if v else None

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    batches, fills = load_batches(); labor = load_labor(); monthly = load_monthly()
    equip = load_equipment(); color = load_color()
    write_csv("batches.csv", batches); write_csv("batch_fills.csv", fills); write_csv("labor_daily.csv", labor)
    write_csv("monthly_plan_actual.csv", monthly); write_csv("equipment.csv", equip); write_csv("color_correction.csv", color)

    months = sorted({b["month"] for b in batches if b["month"]})
    lines = ["1B", "2B", "ワニス"]
    labor_map = {"1B": ["1B仕込み・調合", "1B充填"], "2B": ["2B"], "ワニス": ["ワニス"]}
    # --- ライン×月 KPI ---
    line_month = []
    for ln in lines:
        for mo in months:
            bs = [b for b in batches if b["line"] == ln and b["month"] == mo]
            ls = [l for l in labor if l["dept"] in labor_map[ln] and l["month"] == mo]
            hours = S(ls, "work_hours") + S(ls, "overtime_hours")
            kg = S(bs, "output_kg"); direct = S(bs, "total_min") / 60
            line_month.append(dict(line=ln, month=mo, batches=len(bs), output_t=r1(kg / 1000, 1), labor_hours=r1(hours, 0),
                                   direct_hours=r1(direct, 0), kg_per_labor_hour=r1(kg / hours, 1) if hours else None,
                                   direct_ratio=r1(direct / hours * 100, 1) if hours else None,
                                   yield_pct=mean([b["yield_pct"] for b in bs]),
                                   fill_actual_vs_std=r1(S(bs, "fill_actual_min") / S(bs, "fill_std_min") * 100, 1) if S(bs, "fill_std_min") else None,
                                   overtime_hours=r1(S(ls, "overtime_hours"), 1), support_in=r1(S(ls, "support_in"), 1),
                                   support_out=r1(S(ls, "support_out"), 1), work_days=len({l["date"] for l in ls})))
    # --- ライン合計 ---
    line_total = []
    for ln in lines:
        bs = [b for b in batches if b["line"] == ln]; ls = [l for l in labor if l["dept"] in labor_map[ln]]
        days = len({l["date"] for l in ls}) or 1
        hours = S(ls, "work_hours") + S(ls, "overtime_hours")
        line_total.append(dict(line=ln, batches=len(bs), work_days=days, batches_per_day=r1(len(bs) / days, 2),
                               output_t=r1(S(bs, "output_kg") / 1000, 1), labor_hours=r1(hours, 0),
                               kg_per_labor_hour=r1(S(bs, "output_kg") / hours, 1) if hours else None,
                               prep_min_day=r1(S(bs, "prep_min") / days, 0), mix_min_day=r1(S(bs, "mix_min") / days, 0),
                               fill_min_day=r1(S(bs, "fill_min") / days, 0), direct_min_day=r1(S(bs, "total_min") / days, 0),
                               avg_headcount=r1(S(ls, "headcount") / days, 2), yield_pct=mean([b["yield_pct"] for b in bs]),
                               avg_batch_kg=r1(S(bs, "output_kg") / max(1, len([b for b in bs if b["output_kg"]])), 0),
                               avg_batch_min=mean([b["total_min"] for b in bs])))
    # --- 設備別の稼働実績（設備番号キー） ---
    eq = collections.defaultdict(lambda: dict(batches=0, kg=0.0, minutes=0.0, roles=collections.Counter(), lines=collections.Counter(), products=collections.Counter()))
    role_min = {"prep_disper": "prep_min", "prep_tank": "prep_min", "mill": "mill_min", "mix_disper": "mix_min", "mix_tank": "mix_min"}
    ROLE_JP = {"prep_disper": "仕込ディスパー", "prep_tank": "仕込タンク", "mill": "分散機", "mix_disper": "調合ディスパー", "mix_tank": "調合タンク", "fill": "充填機"}
    def touch(t, b, role, minutes):
        if not t or t in ("ディスパ-", "手詰め"): return
        for one in re.split(r"[,、/]", t):
            if not one: continue
            if re.fullmatch(r"\d+", one): one = t.split("-")[0] + "-" + one   # 'SPM-1,2' → SPM-1 / SPM-2
            e = eq[(b["line"], one, "fill" if role == "fill" else "proc")]; e["batches"] += 1; e["kg"] += b["output_kg"] or 0; e["minutes"] += minutes or 0
            e["roles"][ROLE_JP[role]] += 1; e["lines"][b["line"]] += 1; e["products"][b["product"]] += 1
    for b in batches:
        for role, mk in role_min.items(): touch(b[role], b, role, b[mk])
    for f in fills:
        b = next((x for x in batches if x["batch_id"] == f["batch_id"]), None)
        if b: touch(f["machine"], b, "fill", f["actual_min"])
    ledger = collections.defaultdict(list)
    for e in equip:
        if e["tag"] and e["tag"] != "-":
            ledger[(e["building"], e["tag"], e["category"] == "充填機")].append(e)
            if e["category"] == "充填機": ledger[("any", e["tag"], True)].append(e)
    LB = {"1B": "paint1", "2B": "paint2", "ワニス": "varnish"}
    usage = []
    for (ln, t, kind), e in sorted(eq.items(), key=lambda kv: -kv[1]["batches"]):
        led = ledger.get((LB[ln], t, kind == "fill"), []) or (ledger.get(("any", t, True), []) if kind == "fill" else [])
        usage.append(dict(line=ln, building=LB[ln], tag=t, kind=kind, batches=e["batches"], output_t=r1(e["kg"] / 1000, 1),
                          minutes=r1(e["minutes"], 0), roles=dict(e["roles"]), top_products=[p for p, _ in e["products"].most_common(3)],
                          ledger_name=led[0]["name"] if led else None, in_ledger=bool(led)))
    write_csv("equipment_usage.csv", [{**u, "roles": json.dumps(u["roles"], ensure_ascii=False), "top_products": " / ".join(u["top_products"])} for u in usage])
    # --- 設備間フロー（バッチ1件 = 仕込→分散→調合→充填 を1回たどる） ---
    flows = collections.Counter()
    for b in batches:
        chain = [b["prep_disper"] or b["prep_tank"], b["mill"], b["mix_disper"] or b["mix_tank"], b["mix_tank"] if b["mix_disper"] else "", (b["fill_machine"] or "").split("/")[0]]
        # 可搬容器（缶釜・ペール缶・ビーカー・ドラム）は場所を持たないので経由点から除く
        chain = [c for c in chain if c and c != "ディスパ-" and not re.search(r"缶釜|ペ-ル缶|ビ-カ-|^ドラム$|^手詰め$", c)]
        chain = [c for i, c in enumerate(chain) if i == 0 or c != chain[i - 1]]
        for a, z in zip(chain, chain[1:]): flows[(b["line"], a, z)] += 1
    days_by_line = {t["line"]: t["work_days"] for t in line_total}
    flow_rows = [dict(line=ln, building=LB[ln], source=a, target=z, batches=n, per_day=round(n / days_by_line[ln], 3))
                 for (ln, a, z), n in flows.most_common()]
    write_csv("equipment_flows.csv", flow_rows)
    # --- 調色 ---
    cdays = sorted({c["date"] for c in color})
    cc = [c for c in color if c["corrections"] is not None]
    color_sum = dict(days=len(cdays), period=[cdays[0], cdays[-1]] if cdays else None, jobs=len(color),
                     jobs_per_day=r1(len(color) / max(1, len(cdays)), 1),
                     tint_min_day=r1(S(color, "tint_min") / max(1, len(cdays)), 0), fill_min_day=r1(S(color, "fill_min") / max(1, len(cdays)), 0),
                     avg_corrections=mean([c["corrections"] for c in cc]), avg_tint_min=mean([c["tint_min"] for c in color]),
                     corr_hist={str(int(k)): v for k, v in sorted(collections.Counter(c["corrections"] for c in cc).items())},
                     tint_min_by_corr={str(int(k)): mean([c["tint_min"] for c in cc if c["corrections"] == k]) for k in sorted({c["corrections"] for c in cc})})
    # --- FLOW LAB 6.0 の「直接工数」（分/日）: 工程グループ別 ---
    T = {t["line"]: t for t in line_total}
    direct = {"仕込み": T["1B"]["prep_min_day"], "調合": T["1B"]["mix_min_day"], "充填": T["1B"]["fill_min_day"],
              "2B": T["2B"]["direct_min_day"], "ワニス": T["ワニス"]["direct_min_day"],
              "調色": None}   # 色補正記録は経過時間（並行作業・待ちを含む）のため工数として使わない
    dept_labor = []
    for d in NIPPO.values():
        ls = [l for l in labor if l["dept"] == d]; n = len(ls) or 1
        dept_labor.append(dict(dept=d, days=len(ls), roster=ls[-1]["roster"] if ls else None, avg_headcount=r1(S(ls, "headcount") / n, 2),
                               overtime_hours=r1(S(ls, "overtime_hours"), 1), support_in_days=r1(S(ls, "support_in"), 1),
                               support_out_days=r1(S(ls, "support_out"), 1), absent_days=r1(S(ls, "absent"), 1)))
    analytics = dict(
        version=1, generated=datetime.date.today().isoformat(),
        period=dict(production=[months[0], months[-1]], color=color_sum["period"]),
        notes=["生産・日報は2025/9〜2026/3、位置トラッキングは2026/7〜8、色補正は2026/10。期間が重ならないため日単位の突合は不可。",
               "担当者は匿名ID化。日報の備考欄（氏名）は取り込んでいない。",
               "直接工数は生産データの工程別合計分（入力率97〜100%）。細目（洗浄・調色など）は入力率が低く参考値。",
               "調色工場の色補正記録は開始〜終了の経過時間で、並行作業と待ちを含む。工数には換算していない（調色の直接工数は未入力のまま）。"],
        counts=dict(batches=len(batches), fills=len(fills), labor_days=len(labor), equipment=len(equip), color_jobs=len(color), monthly=len(monthly), people=len(_people)),
        line_total=line_total, line_month=line_month, dept_labor=dept_labor, monthly=monthly,
        equipment_usage=usage, flows=flow_rows, color=color_sum, direct_min_day=direct,
        ledger=[{k: e[k] for k in ("category", "building", "name", "tag", "model", "maker", "purchase_year", "specs")} for e in equip],
    )
    SRC.mkdir(parents=True, exist_ok=True)
    (SRC / "analytics.json").write_text(json.dumps(analytics, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("batches", len(batches), "fills", len(fills), "labor", len(labor), "monthly", len(monthly), "equipment", len(equip), "color", len(color), "people", len(_people))
    for t in line_total: print(t)
    print("direct_min_day", direct); print("color", color_sum)
    print("usage top", [(u["line"], u["tag"], u["batches"], u["in_ledger"]) for u in usage[:14]])
    print("unmatched-in-ledger", sum(1 for u in usage if not u["in_ledger"]), "/", len(usage))
    print("flows 2B top", [(f["source"], f["target"], f["batches"]) for f in flow_rows if f["line"] == "2B"][:14])
    print("analytics.json", (SRC / "analytics.json").stat().st_size)

if __name__ == "__main__":
    main()
