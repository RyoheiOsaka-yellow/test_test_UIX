#!/usr/bin/env python3
"""
公式サイトのフロアガイドから店舗一覧を取得し、data/floorguide.csv を生成する。
  MARK IS みなとみらい  : www.mec-markis.jp/mm/floor/floor_*.html   (区画番号つき)
  ランドマークプラザ     : www.yokohama-landmark.jp/shop/floor.html?b_flg=1&f_flg=*
  クイーンズタワーA     : 同サイト b_flg=3
  みなとみらい東急スクエア: www.minatomirai-square.com/floor/* (取得できた場合)
取得結果は source=official。既存 CSV の手入力行 (source が official/osm 以外) は保持する。
"""
import csv, html, os, re, sys, urllib.request

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "..", "data", "floorguide.csv")
UA = {"User-Agent": "Mozilla/5.0 (minatomirai-3d floorguide fetch)"}

def get(url):
    try:
        return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read().decode("utf-8", "ignore")
    except Exception as e:
        print("  fetch failed:", url, e); return ""

def clean(t):
    return html.unescape(re.sub(r"<[^>]+>", "", t)).strip()

# 公式サイトのカテゴリ表記 -> 用途カテゴリ
def category(txt):
    t = txt or ""
    if re.search(r"レストラン|カフェ|食堂|ラーメン|うどん|そば|寿司|焼肉|カレー|料理|バーガー|クレープ|アイス|スイーツ|ベーカリー|パン|ドーナツ|バル|居酒屋|定食|とんかつ|ちゃんぽん|たこ焼き|フードコート|グルメ|ダイニング|ビュッフェ|ピザ|イタリアン|フレンチ|中華|和食|洋食|コーヒー|紅茶|ジュース|フード|惣菜|弁当|鮮魚|精肉|青果|食品|デリ|菓子|チョコ|ケーキ|酒|ワイン|ビール|ティー|タピオカ|丼|鍋|ステーキ|串|餃子|点心|パスタ|サンド|ベーグル|スープ", t): return "飲食"
    if re.search(r"クリニック|歯科|薬局|ドラッグ|調剤|整体|マッサージ|眼科|医院|医療|メディカル|リラク|整骨", t): return "医療"
    if re.search(r"銀行|ATM|郵便|保険|不動産|旅行|写真|クリーニング|美容|理容|ヘア|ネイル|エステ|サロン|ジム|フィットネス|英会話|スクール|教室|証券|携帯|スマホ|修理|リペア|靴修理|合鍵|チケット|サービス|カルチャー|託児|保育|学習塾|占い|クリニック", t): return "サービス"
    if re.search(r"シネマ|映画|ミュージアム|博物館|ホール|劇場|ギャラリー|体験|アミューズメント|エンターテイ|プレイ|公園|展望|イベント|ライブ", t): return "公共"
    if re.search(r"ホテル", t): return "宿泊"
    if re.search(r"オフィス|事務所", t): return "オフィス"
    return "物販"

def floor_norm(f):
    f = f.strip().upper().replace("階", "F")
    m = re.match(r"^(B\d+|\d+F?|GL)", f)
    if not m: return None
    v = m.group(1)
    if v == "GL": return "1F"
    if v.isdigit(): return v + "F"
    return v

def fetch_markis():
    rows = []
    for f, label in [("b4", "B4"), ("b2", "B2"), ("b1", "B1"), ("1", "1F"), ("2", "2F"), ("3", "3F"), ("4", "4F"), ("5", "5F")]:
        s = get(f"https://www.mec-markis.jp/mm/floor/floor_{f}.html")
        items = re.findall(r'<div class="fMGuideNum"><span>(.*?)</span></div>\s*<div class="fMGuideDetail">(.*?)</div>\s*</div>', s, re.S)
        for num, body in items:
            name = re.search(r'class="fMGDName">(.*?)</div>', body, re.S); cate = re.search(r'class="fMGDCate">(.*?)</div>', body, re.S)
            name = clean(name.group(1)) if name else ""; cate = clean(cate.group(1)) if cate else ""
            if not name: continue
            href = re.search(r'href="(/mm/shop/detail/\?act=\d+)"', body)
            rows.append({"building": "MARK IS minatomirai", "floor": label, "zone": clean(num), "name": name, "category": category(cate + " " + name), "share": "1", "source": "official",
                         "url": "https://www.mec-markis.jp" + href.group(1) if href else "", "hours": "", "tel": "", "website": "", "genre": cate})
        print(f"  MARK IS {label}: {len(items)}")
    return rows

def fetch_landmark(b_flg, building, floors):
    rows = []
    for f in floors:
        s = get(f"https://www.yokohama-landmark.jp/shop/floor.html?b_flg={b_flg}&f_flg={f}")
        n = 0
        for m in re.finditer(r'<li class="shopBox[^"]*">(.*?)</li>', s, re.S):
            body = m.group(1); href = re.search(r'href="(/shop/detail\.html\?act=\d+)"', body)
            fl = re.search(r'class="shopFloor">(.*?)</p>', body); name = re.search(r'class="shopName">(.*?)</p>', body); cate = re.search(r'class="shopCategory">(.*?)</p>', body)
            if not (fl and name): continue
            fl = clean(fl.group(1)); name = clean(name.group(1)); cate = clean(cate.group(1)) if cate else ""
            if building.split("／")[0] not in fl: continue
            fm = re.search(r"(B?\d+F)", fl); flabel = fm.group(1) if fm else floor_norm(str(f))
            rows.append({"building": building.split("／")[-1], "floor": flabel, "zone": str(n + 1), "name": name, "category": category(cate + " " + name), "share": "1", "source": "official",
                         "url": "https://www.yokohama-landmark.jp" + href.group(1) if href else "", "hours": "", "tel": "", "website": "", "genre": cate}); n += 1
        print(f"  {building} f{f}: {n}")
    return rows

def fetch_tokyu_square():
    """みなとみらい東急スクエア (クイーンズスクエア横浜内)。エリア①〜④とステーションコアを区画記号に使う。"""
    rows = []
    areas = {"area1": ("①", ["b1f", "1f", "2f", "3f", "4f"]), "area2": ("②", ["b1f", "1f", "2f", "3f", "4f"]), "area3": ("③", ["1f", "2f", "3f", "4f", "5f"]), "area4": ("④", ["1f", "2f", "3f"]), "area5": ("SC", ["b3f", "b2f", "b1f"])}
    for area, (mark, floors) in areas.items():
        for fl in floors:
            page = get(f"https://www.minatomirai-square.com/floor/?area={area}&floor={fl}")
            n = 0
            for box in re.finditer(r'<div class="article-box ([^"]*)">(.*?)<!-- \.article-box -->', page, re.S):
                head = re.search(r'<h3 class="mds-ttl">(.*?)</h3>', box.group(2)); head = clean(head.group(1)) if head else ""
                for m in re.finditer(r'<a href="(/floor/detail/\?cd=\d+)">.*?<div class="shopname">(.*?)</div>\s*<div class="item">(.*?)</div>(.*?)</a>', box.group(2), re.S):
                    nm = clean(m.group(2)); it = clean(m.group(3)); tel = re.search(r'TEL[：:]\s*([\d\-]+)', m.group(4)); href = m.group(1)
                    if not nm: continue
                    cat = "飲食" if re.search(r"レストラン|カフェ|グルメ|フード", head) else "サービス" if "サービス" in head else category(it + " " + nm)
                    n += 1
                    rows.append({"building": "クイーンズスクエア横浜", "floor": fl.upper(), "zone": f"{mark}-{n}", "name": nm, "category": cat, "share": "1", "source": "official",
                                 "url": "https://www.minatomirai-square.com" + href, "hours": "", "tel": tel.group(1) if tel else "", "website": "", "genre": it})
            print(f"  Tokyu Square {area} {fl}: {n}")
    return rows

def enrich_landmark(rows):
    """ランドマークプラザ系の詳細ページから 営業時間・電話番号・公式サイト を取得 (並列)。"""
    import concurrent.futures as cf
    targets = [r for r in rows if r.get("url", "").startswith("https://www.yokohama-landmark.jp")]
    def one(r):
        page = get(r["url"])
        h = re.search(r'shopInfoTime">\s*<h4>営業時間</h4>\s*<p>(.*?)</p>', page, re.S); t = re.search(r'shopInfoPhone">\s*<h4>電話番号</h4>\s*<p>(.*?)</p>', page, re.S); w = re.search(r'shopInfoWebsite">.*?<a href="([^"]+)"', page, re.S)
        r["hours"] = clean(h.group(1)) if h else ""; r["tel"] = clean(t.group(1)) if t else ""; r["website"] = w.group(1) if w else ""
    with cf.ThreadPoolExecutor(6) as ex: list(ex.map(one, targets))
    print("  enriched landmark rows:", len(targets))

def main():
    keep = []
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            keep = [r for r in csv.DictReader(f) if r.get("source", "") not in ("official", "osm", "")]
    rows = []
    print("MARK IS"); rows += fetch_markis()
    print("ランドマークプラザ"); rows += fetch_landmark(1, "ランドマークプラザ", [1, 2, 3, 4, 5, 7])
    print("クイーンズタワーA"); rows += fetch_landmark(3, "クイーンズタワーA／クイーンズスクエア横浜", [1, 2, 3])
    print("みなとみらい東急スクエア"); rows += fetch_tokyu_square()
    enrich_landmark(rows)
    for r in rows:  # 施設共通の営業時間 (個別が無い場合)
        if not r.get("hours"):
            if r["building"].startswith("MARK IS"): r["hours"] = "ショップ 10:00～20:00／レストラン 11:00～23:00（店舗により異なる）"
            elif r["building"].startswith("クイーンズスクエア"): r["hours"] = "ショップ 11:00～20:00／レストラン 11:00～22:00（店舗により異なる）"
        for k in ("url", "hours", "tel", "website", "genre"): r.setdefault(k, "")
    # 重複除去 (建物, 階, 店名)
    seen = set(); uniq = []
    for r in keep + rows:
        k = (r["building"], r["floor"], r["name"])
        if k in seen: continue
        seen.add(k); uniq.append(r)
    with open(OUT, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["building", "floor", "zone", "name", "category", "share", "source", "url", "hours", "tel", "website", "genre"], extrasaction="ignore"); w.writeheader()
        for r in uniq:
            for k in ("url", "hours", "tel", "website", "genre"): r.setdefault(k, "")
        w.writerows(uniq)
    print("wrote", OUT, len(uniq), "rows")

if __name__ == "__main__":
    main()
