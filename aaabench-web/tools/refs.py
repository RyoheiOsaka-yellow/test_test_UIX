#!/usr/bin/env python3
"""Go and look at the real thing.

    python3 tools/refs.py find "harbour crane"           # what exists, with licences
    python3 tools/refs.py grab "fish market" --n 4       # find + download the top N
    python3 tools/refs.py get  <image-url> -o /tmp/aaabench_refs/thing.jpg

Downloads land in /tmp/aaabench_refs/ and the paths are printed. Then READ the file — the point
is not to have the photograph, it is to look at it, next to your own screenshot of the same
subject, and see what yours is missing.

Openverse ANDs every term, so long queries return nothing at all. "miami south beach art deco
dusk" -> 0 results; "art deco hotel" -> hundreds. Keep it to two or three words and search again
rather than describing the whole shot.

Every result carries its licence and creator. Public-domain and CC0 you can use as texture
source material; CC-BY needs the credit kept; NC and ND are reference only. Record what you used
where — an asset with no provenance is an asset you have to remove later.
"""
import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request

API = "https://api.openverse.org/v1/images/"
OUT = os.environ.get("AAABENCH_REFS_DIR", "/tmp/aaabench_refs")
UA = "aaabench-web/1.0 (benchmark harness; reference lookup)"


def _get(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=timeout)


def find(query, n=8, extra=None):
    terms = query.split()
    if len(terms) > 4:
        print(f"note: {len(terms)} terms ANDed together usually returns nothing. Try two or three.\n", file=sys.stderr)
    q = {"q": query, "page_size": max(1, min(n, 20)), "mature": "false"}
    if extra:
        q.update(extra)
    with _get(API + "?" + urllib.parse.urlencode(q)) as r:
        data = json.load(r)
    results = data.get("results", [])
    print(f"{data.get('result_count', 0)} results for {query!r}, showing {len(results)}")
    for i, x in enumerate(results, 1):
        print(f"{i:2}. {x.get('title') or '(untitled)'}")
        print(f"    {x.get('url')}")
        print(f"    licence {x.get('license', '?')} {x.get('license_version', '')} · {x.get('creator') or 'unknown'} · {x.get('provider', '')}")
    if not results:
        print("nothing. Fewer words, or a different word — the API matches all terms, not any.")
    return results


def slug(s, fallback="ref"):
    s = re.sub(r"[^a-zA-Z0-9]+", "-", (s or "").strip().lower()).strip("-")
    return (s or fallback)[:60]


def get(url, out=None, title=None):
    os.makedirs(OUT, exist_ok=True)
    if not out:
        ext = os.path.splitext(urllib.parse.urlparse(url).path)[1] or ".jpg"
        out = os.path.join(OUT, slug(title or os.path.basename(url)) + ext)
    with _get(url, timeout=60) as r, open(out, "wb") as fh:
        fh.write(r.read())
    kb = os.path.getsize(out) / 1024
    print(f"{out}  ({kb:.0f} KB)")
    return out


def grab(query, n=4):
    results = find(query, n)
    print()
    paths = []
    for x in results[:n]:
        try:
            p = get(x["url"], title=f"{slug(query)}-{slug(x.get('title'), 'ref')}")
            paths.append(p)
            print(f"    {x.get('license', '?')} · {x.get('creator') or 'unknown'} · {x.get('foreign_landing_url', '')}")
        except Exception as e:  # a dead link in the index is normal; keep going
            print(f"    skipped ({e})", file=sys.stderr)
    if paths:
        print("\nRead these. Then take your own screenshot of the same subject and read that too.")
        print("The gap between the two is the work — write down what you find, not just that you looked.")
    return paths


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("find")
    f.add_argument("query")
    f.add_argument("--n", type=int, default=8)
    g = sub.add_parser("grab")
    g.add_argument("query")
    g.add_argument("--n", type=int, default=4)
    d = sub.add_parser("get")
    d.add_argument("url")
    d.add_argument("-o", "--output")
    a = ap.parse_args()

    try:
        if a.cmd == "find":
            find(a.query, a.n)
        elif a.cmd == "grab":
            grab(a.query, a.n)
        else:
            get(a.url, a.output)
    except urllib.error.URLError as e:
        sys.exit(f"network: {e}\nIf this host has no outbound access, say so in your notes and work from what you have.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
