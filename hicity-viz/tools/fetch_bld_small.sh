#!/bin/bash
# 建物を 4緯度帯 × 2経度 = 8チャンクで並行性を上げて取得(既存bldNと重複してもID重複排除される)
SP="$(cd "$(dirname "$0")" && pwd)"
LON_MID=139.735
declare -A Q
Q[bld0a]="way[\"building\"](35.518,139.655,35.546,$LON_MID);out geom qt;"
Q[bld0b]="way[\"building\"](35.518,$LON_MID,35.546,139.815);out geom qt;"
Q[bld1a]="way[\"building\"](35.546,139.655,35.574,$LON_MID);out geom qt;"
Q[bld1b]="way[\"building\"](35.546,$LON_MID,35.574,139.815);out geom qt;"
Q[bld2a]="way[\"building\"](35.574,139.655,35.602,$LON_MID);out geom qt;"
Q[bld2b]="way[\"building\"](35.574,$LON_MID,35.602,139.815);out geom qt;"
Q[bld3a]="way[\"building\"](35.602,139.655,35.630,$LON_MID);out geom qt;"
Q[bld3b]="way[\"building\"](35.602,$LON_MID,35.630,139.815);out geom qt;"
EPS=(https://overpass-api.de/api/interpreter https://overpass.kumi.systems/api/interpreter)
for name in bld0a bld0b bld1a bld1b bld2a bld2b bld3a bld3b; do
  out="$SP/osm/$name.json"
  band="${name:0:4}"   # bld0 etc.
  if [ -s "$SP/osm/$band.json" ]; then echo "$name skipped ($band.json exists)"; continue; fi
  if [ -s "$out" ]; then echo "$name cached"; continue; fi
  ok=0
  for a in $(seq 0 9); do
    ep=${EPS[$((a % 2))]}
    curl -sS -m 280 -G "$ep" --data-urlencode "data=[out:json][timeout:240][maxsize:1073741824];${Q[$name]}" -o "$out.tmp" 2>/dev/null
    if head -c 1 "$out.tmp" 2>/dev/null | grep -q '{'; then
      if python3 -c "import json,sys;json.load(open(sys.argv[1]))" "$out.tmp" 2>/dev/null; then
        mv "$out.tmp" "$out"; echo "$name ok $(stat -c%s "$out")"; ok=1; break
      fi
    fi
    echo "$name attempt $a failed ($ep)"
    rm -f "$out.tmp"; sleep 40
  done
  [ $ok -eq 0 ] && echo "GIVEUP $name"
  sleep 8
done
echo "BLD SMALL DONE"
