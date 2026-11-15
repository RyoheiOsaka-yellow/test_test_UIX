#!/usr/bin/env python3
"""
横浜市営バスの GTFS が手に入るまでの「ダミーの時刻表」を作る ($MM_WORK/gtfs/dummy_yokohama_municipal.zip)。
  系統と 1 日の便数: 国土数値情報 バスルート N07 (2011 年度) の横浜市営の系統をそのまま使う (平日・土曜・日祝)
  停留所          : OSM のバス停のうち、その系統の経路から 40 m 以内のもの
  時刻            : 都市部の路線バスによくある時間帯の山 (朝夕に多い) を仮定して、便を 1 時間ごとに割り振る
1 日の便数は N07 と同じなので、置き換わるのは「時間帯別の便数」だけ。事業者名に「ダミー」と入れてあり、
tools/fetch_gtfs_bus.py と tools/mode_split.py はそれを見て結果にダミーの印を付ける。
本物の GTFS を取得したら fetch_gtfs_bus.py を実行し直せば上書きされる。

  python3 tools/make_dummy_gtfs.py && python3 tools/fetch_gtfs_bus.py $MM_WORK/gtfs/dummy_yokohama_municipal.zip && python3 tools/mode_split.py
"""
import math, os, sys, zipfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_data as B
import mode_split as M
from fit_underlays import load_pack
from pyproj import Transformer

# 時間帯の山 (仮定): その時間帯に走る便の割合の重み
WK = {5: 1, 6: 4, 7: 8.5, 8: 8.5, 9: 6, 10: 5, 11: 5, 12: 5, 13: 5, 14: 5, 15: 5.5, 16: 6.5, 17: 8, 18: 8, 19: 6.5, 20: 5, 21: 4, 22: 2.5, 23: 1}
HO = {6: 2, 7: 4, 8: 6, 9: 7, 10: 7.5, 11: 7.5, 12: 7.5, 13: 7.5, 14: 7.5, 15: 7.5, 16: 7.5, 17: 7, 18: 6.5, 19: 5.5, 20: 4.5, 21: 3.5, 22: 2, 23: 1}

def allot(n, w):
    """n 便を重み w で 1 時間ごとに割り振る (端数は大きい順に配る)"""
    tot = sum(w.values()); raw = {h: n * v / tot for h, v in w.items()}; out = {h: int(math.floor(x)) for h, x in raw.items()}
    for h in sorted(raw, key=lambda h: raw[h] - out[h], reverse=True)[:n - sum(out.values())]: out[h] += 1
    return out

def main():
    lines, _, path = M.n07_lines(); header, _ = load_pack(); T = Transformer.from_crs("EPSG:6677", "EPSG:4326", always_xy=True)
    stops = [(i, x / 10, y / 10) for i, (x, y) in enumerate(header["busStops"])]
    z_path = os.path.join(os.environ.get("MM_WORK", "/tmp/mm"), "gtfs"); os.makedirs(z_path, exist_ok=True); z_path = os.path.join(z_path, "dummy_yokohama_municipal.zip")
    st = "stop_id,stop_name,stop_lat,stop_lon\n"
    for i, x, y in stops:
        lon, lat = T.transform(x + B.GN[0], y + B.GN[1]); st += f"S{i},ダミー停留所{i},{lat:.6f},{lon:.6f}\n"
    routes = "route_id,agency_id,route_short_name,route_type\n"; trips = "route_id,service_id,trip_id\n"; times = "trip_id,arrival_time,departure_time,stop_id,stop_sequence\n"; n = 0; nr = 0
    for (kind, op, name), f in sorted(lines.items()):
        if "横浜市" not in op: continue
        pts = path[(kind, op, name)]; near = [i for i, x, y in stops if any(math.hypot(x - px, y - py) < 40 for px, py in pts)][:6]
        if not near: near = [min(stops, key=lambda s: min(math.hypot(s[1] - px, s[2] - py) for px, py in pts))[0]]
        nr += 1; rid = f"R{nr}"; routes += f"{rid},1,{name},3\n"
        for sid, cnt, w in (("WD", f[0], WK), ("SA", f[1], HO), ("HO", f[2], HO)):
            for h, c in sorted(allot(int(round(cnt)), w).items()):
                for j in range(c):
                    n += 1; tid = f"T{n}"; trips += f"{rid},{sid},{tid}\n"; m0 = int(60 * (j + 0.5) / c)
                    for q, s in enumerate(near):
                        mm = m0 + q * 2; t = f"{h + mm // 60:02d}:{mm % 60:02d}:00"; times += f"{tid},{t},{t},S{s},{q + 1}\n"
    z = zipfile.ZipFile(z_path, "w", zipfile.ZIP_DEFLATED)
    z.writestr("agency.txt", "agency_id,agency_name,agency_url,agency_timezone\n1,横浜市交通局（ダミー）,https://example.invalid/,Asia/Tokyo\n")
    z.writestr("feed_info.txt", "feed_publisher_name,feed_publisher_url,feed_lang,feed_start_date,feed_end_date\nダミー (tools/make_dummy_gtfs.py),https://example.invalid/,ja,20110401,20120331\n")
    z.writestr("calendar.txt", "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nWD,1,1,1,1,1,0,0,20110401,20120331\nSA,0,0,0,0,0,1,0,20110401,20120331\nHO,0,0,0,0,0,0,1,20110401,20120331\n")
    z.writestr("stops.txt", st); z.writestr("routes.txt", routes); z.writestr("trips.txt", trips); z.writestr("stop_times.txt", times); z.close()
    print(z_path, "routes", nr, "trips", n)

if __name__ == "__main__":
    main()
