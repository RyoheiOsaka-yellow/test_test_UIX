"""Build the self-contained guide HTML from guide.template.html.

- {{IMG:name}}  -> data:image/webp;base64,... (from img/name.webp)
- {{WH:name}}   -> width/height attributes (from img/sizes.json)
- {{CALLOUTS}}  -> callout boxes captured from the app (capture/callouts.json)

Outputs:
  ../FLOW_LAB_v6_guide.html   standalone page (doctype/head added)
  argv[1] (optional)          page fragment for publishing as an Artifact
"""
import base64
import json
import pathlib
import re
import sys

SRC = pathlib.Path(__file__).resolve().parent
OUT = SRC.parent / "FLOW_LAB_v6_guide.html"

tpl = (SRC / "guide.template.html").read_text(encoding="utf-8")
sizes = json.loads((SRC / "img" / "sizes.json").read_text(encoding="utf-8"))
callouts = json.loads((SRC / "capture" / "callouts.json").read_text(encoding="utf-8"))
callouts = {k: callouts[k] for k in ("s01", "s05")}


def img(m):
    data = (SRC / "img" / f"{m.group(1)}.webp").read_bytes()
    return "data:image/webp;base64," + base64.b64encode(data).decode()


def wh(m):
    s = sizes[m.group(1)]
    return f'width="{s["w"]}" height="{s["h"]}"'


body = re.sub(r"\{\{IMG:(\w+)\}\}", img, tpl)
body = re.sub(r"\{\{WH:(\w+)\}\}", wh, body)
body = body.replace("{{CALLOUTS}}", json.dumps(callouts, ensure_ascii=False))
assert "{{" not in body, "unresolved placeholder"

page = (
    "<!DOCTYPE html>\n<html lang=\"ja\">\n<head>\n<meta charset=\"utf-8\">\n"
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
    + body.replace("</style>", "</style>\n</head>\n<body>", 1)
    + "\n</body>\n</html>\n"
)
OUT.write_text(page, encoding="utf-8")
print(OUT, f"{OUT.stat().st_size / 1e6:.2f} MB")
if len(sys.argv) > 1:
    frag = pathlib.Path(sys.argv[1])
    frag.write_text(body, encoding="utf-8")
    print(frag, f"{frag.stat().st_size / 1e6:.2f} MB")
