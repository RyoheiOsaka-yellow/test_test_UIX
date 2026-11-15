#!/usr/bin/env python3
"""
バスの現行ダイヤ (GTFS / GTFS-JP) から、対象範囲のバス停に停まる便数を 平日・土曜・日祝 と 時間帯別 に数えて data/bus_gtfs.json に書く。
tools/mode_split.py がこれを読み、その事業者の系統は 国土数値情報 N07 (2011 年度) の本数ではなく現行の便数に置き換える。
時間帯別の便数は、バスで来る人の時間帯分布の重みに使う (src/people_model.js)。

使い方:
  python3 tools/fetch_gtfs_bus.py path/to/feed1.zip [feed2.zip ...]        # 手元の GTFS を使う
  ODPT_KEY=<アクセストークン> python3 tools/fetch_gtfs_bus.py              # 横浜市営バスを公共交通オープンデータセンターから取得
横浜市営バスの GTFS-JP は公共交通オープンデータセンター (https://ckan.odpt.org/dataset/yokohama_municipal_bus) で公開されているが、
開発者サイトでの利用者登録で発行されるアクセストークンが必要 (公共交通オープンデータ基本ライセンス)。
"""
import csv, io, json, os, sys, urllib.request, zipfile, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_data as B
from fit_underlays import DATA

ODPT = "https://api.odpt.org/api/v4/files/odpt/YokohamaMunicipal/Bus.zip?date={date}&acl:consumerKey={key}"
# GTFS の事業者名 → 国土数値情報 N07 の事業者名 (置き換える系統の判定に使う)
N07_NAME = {"横浜市交通局": "横浜市", "横浜市": "横浜市", "京浜急行バス": "京浜急行バス", "相鉄バス": "相鉄バス", "神奈川中央交通": "神奈川中央交通"}

def rows(z, name):
    try: f = z.open(name)
    except KeyError: return []
    return list(csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig")))

def hour_of(t):
    try: return int(t.split(":")[0]) % 24
    except (ValueError, AttributeError, IndexError): return None

def read_feed(path):
    z = zipfile.ZipFile(path)
    stops = {r["stop_id"] for r in rows(z, "stops.txt") if r.get("stop_lat") and B.inbox(*B.to_local(float(r["stop_lon"]), float(r["stop_lat"])))}
    # 運行日の区分: calendar.txt の曜日。平日 = 水曜に走る便、土曜 = 土曜、日祝 = 日曜 (calendar_dates.txt の個別の加除は見ない)
    cal = {r["service_id"]: r for r in rows(z, "calendar.txt")}
    kind = lambda sid: [k for k, d in (("weekday", "wednesday"), ("saturday", "saturday"), ("holiday", "sunday")) if cal.get(sid, {}).get(d) == "1"]
    trips = {r["trip_id"]: (r["route_id"], kind(r["service_id"])) for r in rows(z, "trips.txt")}
    first = {}   # trip_id -> 範囲内で最初に停まる時刻
    for r in csv.DictReader(io.TextIOWrapper(z.open("stop_times.txt"), encoding="utf-8-sig")):
        if r["stop_id"] not in stops: continue
        t = r.get("arrival_time") or r.get("departure_time"); seq = int(r.get("stop_sequence") or 0)
        if r["trip_id"] not in first or seq < first[r["trip_id"]][0]: first[r["trip_id"]] = (seq, t)
    out = {k: {"trips": 0, "hourly": [0] * 24} for k in ("weekday", "saturday", "holiday")}; routes = set()
    for tid, (seq, t) in first.items():
        if tid not in trips: continue
        rid, kinds = trips[tid]; h = hour_of(t); routes.add(rid)
        for k in kinds:
            out[k]["trips"] += 1
            if h is not None: out[k]["hourly"][h] += 1
    ag = rows(z, "agency.txt"); fi = rows(z, "feed_info.txt")
    info = {"agency": ag[0]["agency_name"] if ag else os.path.basename(path), "file": os.path.basename(path), "stopsInBox": len(stops), "routes": len(routes),
            "from": fi[0].get("feed_start_date") if fi else None, "to": fi[0].get("feed_end_date") if fi else None}
    return info, out

def main():
    paths = sys.argv[1:]
    if not paths:
        key = os.environ.get("ODPT_KEY")
        if not key: sys.exit("GTFS の zip を引数で渡すか、ODPT_KEY (公共交通オープンデータセンターのアクセストークン) を設定してください")
        work = os.path.join(os.environ.get("MM_WORK", "/tmp/mm"), "gtfs"); os.makedirs(work, exist_ok=True); p = os.path.join(work, "yokohama_municipal_bus.zip")
        urllib.request.urlretrieve(ODPT.format(date=os.environ.get("GTFS_DATE", "20261101"), key=key), p); paths = [p]
    total = {k: {"trips": 0, "hourly": [0] * 24} for k in ("weekday", "saturday", "holiday")}; feeds = []
    for p in paths:
        info, out = read_feed(p); feeds.append(info)
        for k in total:
            total[k]["trips"] += out[k]["trips"]; total[k]["hourly"] = [a + b for a, b in zip(total[k]["hourly"], out[k]["hourly"])]
        print(info, {k: out[k]["trips"] for k in out})
    ops = sorted({v for f in feeds for n, v in N07_NAME.items() if n in f["agency"]})
    dummy = any("ダミー" in f["agency"] for f in feeds)   # tools/make_dummy_gtfs.py が作った仮の時刻表
    json.dump({"feeds": feeds, "dummy": dummy, "n07Operators": ops, **total}, open(os.path.join(DATA, "bus_gtfs.json"), "w"), ensure_ascii=False, indent=1)
    print("bus_gtfs.json", {k: total[k]["trips"] for k in total}, "N07 で置き換える事業者:", ops)

if __name__ == "__main__":
    main()
