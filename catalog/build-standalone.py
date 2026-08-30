#!/usr/bin/env python3
"""catalog/index.html と works/*.html を 1 枚の HTML にまとめる。

各作品は <script type="text/plain" data-work="..."> に生のまま入れておき、
「RUN LIVE」を押した時点で Blob URL に変換して iframe に読ませる。
こうすると属性エスケープが不要で、開いた瞬間に全作品が走ることもない。
"""
import pathlib

BASE = pathlib.Path(__file__).resolve().parent
OUT = BASE / "catalog-standalone.html"

def main():
    html = (BASE / "index.html").read_text(encoding="utf-8")
    blocks = []
    for f in sorted((BASE / "works").glob("*.html")):
        rel = f"works/{f.name}"
        # text/plain ブロックを閉じてしまわないよう </script だけ退避する。
        body = f.read_text(encoding="utf-8").replace("</script", "<\\/script")
        blocks.append(
            f'<script type="text/plain" data-work="{rel}">\n{body}\n</script>'
        )
        print(f"  embedded {rel} ({f.stat().st_size / 1048576:.1f} MB)")

    payload = "\n<!-- ===== embedded works ===== -->\n" + "\n".join(blocks) + "\n"
    assert "</body>" in html
    html = html.replace("</body>", payload + "</body>", 1)
    OUT.write_text(html, encoding="utf-8")
    print(f"-> {OUT.name}: {OUT.stat().st_size / 1048576:.1f} MB")

if __name__ == "__main__":
    main()
