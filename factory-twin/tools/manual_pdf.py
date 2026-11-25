#!/usr/bin/env python3
"""MANUAL.md → MANUAL.pdf（A4）。要: pip install markdown、Node の playwright（Chromium）。
実行: python3 tools/manual_pdf.py"""
import pathlib, subprocess, sys, tempfile, markdown
ROOT = pathlib.Path(__file__).resolve().parent.parent
md = (ROOT / "MANUAL.md").read_text(encoding="utf-8")
body = markdown.markdown(md, extensions=["tables", "sane_lists"])
CSS = """
@page { size: A4; margin: 16mm 14mm 16mm 14mm; }
* { box-sizing: border-box; }
body { font-family: "IPAPGothic","IPA Pゴシック","Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif; font-size: 10.2pt; line-height: 1.7; color: #1c2430; margin: 0; }
h1 { font-size: 20pt; margin: 0 0 4pt; padding-bottom: 8pt; border-bottom: 2.5pt solid #1f5f8b; color: #12344d; }
h2 { font-size: 13.5pt; margin: 20pt 0 6pt; padding: 4pt 8pt; background: #e9f1f7; border-left: 4pt solid #1f5f8b; color: #12344d; break-after: avoid; }
h3 { font-size: 11.5pt; margin: 14pt 0 4pt; color: #1f5f8b; break-after: avoid; }
p { margin: 4pt 0 6pt; } hr { border: none; border-top: 0.6pt solid #c5ced6; margin: 10pt 0; }
ul, ol { margin: 4pt 0 6pt; padding-left: 18pt; } li { margin: 2pt 0; }
table { border-collapse: collapse; width: 100%; margin: 6pt 0 10pt; font-size: 8.8pt; line-height: 1.5; }
th { background: #1f5f8b; color: #fff; font-weight: bold; text-align: left; padding: 4pt 5pt; border: 0.5pt solid #1f5f8b; }
td { padding: 4pt 5pt; border: 0.5pt solid #c5ced6; vertical-align: top; }
tr { break-inside: avoid; } tbody tr:nth-child(even) td { background: #f6f9fb; }
code { font-family: "IPAGothic",monospace; background: #eef2f5; padding: 0 3pt; border-radius: 2pt; font-size: 9pt; }
strong { color: #12344d; }
"""
html = f'<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>加須工場 デジタルツイン ご利用マニュアル</title><style>{CSS}</style></head><body>{body}</body></html>'
out = ROOT / "MANUAL.pdf"
with tempfile.TemporaryDirectory() as d:
    h = pathlib.Path(d) / "manual.html"; h.write_text(html, encoding="utf-8")
    js = pathlib.Path(d) / "pdf.js"
    js.write_text("""const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.goto('file://'+process.argv[2]);await p.pdf({path:process.argv[3],format:'A4',printBackground:true,displayHeaderFooter:true,
headerTemplate:'<span></span>',footerTemplate:'<div style="width:100%;font-size:7pt;color:#667;text-align:center;font-family:IPAPGothic,sans-serif">加須工場 デジタルツイン ご利用マニュアル　<span class="pageNumber"></span> / <span class="totalPages"></span></div>'});
await b.close();})();""", encoding="utf-8")
    subprocess.run(["node", str(js), str(h), str(out)], check=True, cwd=d)
print("wrote", out, out.stat().st_size, "bytes")
