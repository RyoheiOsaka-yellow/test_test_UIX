"""Build the self-contained guide HTMLs from the templates.

- {{IMG:name}}  -> data:image/webp;base64,... (from img/name.webp)
- {{WH:name}}   -> width/height attributes (from img/sizes.json)
- {{CALLOUTS}}  -> callout boxes captured from the app (capture/callouts.json)

- {{TIMELINE}}  -> 1-minute whereabouts of the two 調色 IDs on 2026-08-04 (capture/timeline_0804.json)

Outputs:
  ../FLOW_LAB_v6_simulation_6p.html      6-page summary (sim6.template.html)
  ../FLOW_LAB_v6_simulation_detail.html  detailed version (simdetail.template.html)
  argv[1] (optional)                     6-page summary as a page fragment for publishing as an Artifact
"""
import base64
import json
import pathlib
import re
import sys

SRC = pathlib.Path(__file__).resolve().parent

sizes = json.loads((SRC / "img" / "sizes.json").read_text(encoding="utf-8"))
callouts = json.loads((SRC / "capture" / "callouts.json").read_text(encoding="utf-8"))


def timeline():
    """Run-length encode the per-minute whereabouts into [start_min, length, category]."""
    raw = json.loads((SRC / "capture" / "timeline_0804.json").read_text(encoding="utf-8"))
    cat = lambda a: "gap" if a is None else {"研究棟": "lab", "調色工場": "tint"}.get(a, "other")
    rows = []
    for s in sorted(raw, key=lambda r: int(r["uid"])):
        runs = []
        for i, a in enumerate(s["series"]):
            c, m = cat(a), s["start"] + i
            if runs and runs[-1][2] == c:
                runs[-1][1] += 1
            else:
                runs.append([m, 1, c])
        rows.append({"label": f"ID {s['uid']}", "runs": runs})
    start = raw[0]["start"]
    return {"start": start, "end": start + len(raw[0]["series"]), "rows": rows}


TIMELINE = json.dumps(timeline(), ensure_ascii=False, separators=(",", ":"))


def img(m):
    data = (SRC / "img" / f"{m.group(1)}.webp").read_bytes()
    return "data:image/webp;base64," + base64.b64encode(data).decode()


def wh(m):
    s = sizes[m.group(1)]
    return f'width="{s["w"]}" height="{s["h"]}"'




def build(template, out, keys, frag=None):
    tpl = (SRC / template).read_text(encoding="utf-8")
    body = re.sub(r"\{\{IMG:(\w+)\}\}", img, tpl)
    body = re.sub(r"\{\{WH:(\w+)\}\}", wh, body)
    body = body.replace("{{CALLOUTS}}", json.dumps({k: callouts[k] for k in keys}, ensure_ascii=False))
    body = body.replace("{{TIMELINE}}", TIMELINE)
    assert "{{" not in body, "unresolved placeholder"
    page = (
        "<!DOCTYPE html>\n<html lang=\"ja\">\n<head>\n<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
        + body.replace("</style>", "</style>\n</head>\n<body>", 1)
        + "\n</body>\n</html>\n"
    )
    out.write_text(page, encoding="utf-8")
    print(out, f"{out.stat().st_size / 1e6:.2f} MB")
    if frag:
        frag = pathlib.Path(frag)
        frag.write_text(body, encoding="utf-8")
        print(frag, f"{frag.stat().st_size / 1e6:.2f} MB")


# 6-page summary (main) and the detailed version
build("sim6.template.html", SRC.parent / "FLOW_LAB_v6_simulation_6p.html", ("p2",), sys.argv[1] if len(sys.argv) > 1 else None)
build("simdetail.template.html", SRC.parent / "FLOW_LAB_v6_simulation_detail.html", ("s01", "s05"))
