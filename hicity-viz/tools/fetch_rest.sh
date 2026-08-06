#!/bin/bash
SP="$(cd "$(dirname "$0")" && pwd)"
declare -A Q
Q[roads_minor1]='way["highway"~"^(unclassified|residential)$"](35.574,139.655,35.630,139.815);out geom qt;'
Q[bld0]='way["building"](35.518,139.655,35.546,139.815);out geom qt;'
Q[bld1]='way["building"](35.546,139.655,35.574,139.815);out geom qt;'
Q[bld2]='way["building"](35.574,139.655,35.602,139.815);out geom qt;'
Q[bld3]='way["building"](35.602,139.655,35.630,139.815);out geom qt;'
EPS=(https://overpass-api.de/api/interpreter https://overpass.kumi.systems/api/interpreter)
for name in roads_minor1 bld0 bld1 bld2 bld3; do
  out="$SP/osm/$name.json"
  if [ -s "$out" ]; then echo "$name cached"; continue; fi
  ok=0
  for a in $(seq 0 11); do
    ep=${EPS[$((a % 2))]}
    curl -sS -m 280 -G "$ep" --data-urlencode "data=[out:json][timeout:240][maxsize:1073741824];${Q[$name]}" -o "$out.tmp" 2>/dev/null
    if head -c 1 "$out.tmp" 2>/dev/null | grep -q '{'; then
      if python3 -c "import json,sys;json.load(open(sys.argv[1]))" "$out.tmp" 2>/dev/null; then
        mv "$out.tmp" "$out"; echo "$name ok $(stat -c%s "$out")"; ok=1; break
      fi
    fi
    echo "$name attempt $a failed ($ep)"
    rm -f "$out.tmp"; sleep 45
  done
  [ $ok -eq 0 ] && echo "GIVEUP $name"
  sleep 10
done
echo "REST DONE"
