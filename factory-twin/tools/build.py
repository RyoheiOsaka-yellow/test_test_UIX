#!/usr/bin/env python3
"""src/ の部品を1つのHTML(dist/index.html)に結合する。
テンプレート中の  @@INCLUDE 相対パス@@  を再帰的に展開するだけの単純な仕組み。"""
import re, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
PAT = re.compile(r"@@INCLUDE ([\w./-]+)@@")
def expand(text, depth=0):
    if depth > 5: raise RuntimeError("include が深すぎます")
    return PAT.sub(lambda m: expand((SRC / m.group(1)).read_text(encoding="utf-8"), depth + 1), text)
def build(out=None):
    out = pathlib.Path(out) if out else ROOT / "dist" / "index.html"
    html = expand((SRC / "index.template.html").read_text(encoding="utf-8"))
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    return out, len(html.encode("utf-8"))
if __name__ == "__main__":
    o, n = build(sys.argv[1] if len(sys.argv) > 1 else None)
    print(f"built {o} ({n/1e6:.2f} MB)")
    # 自動説明版: 開いた直後に説明の開始画面を出すだけの違い
    html = o.read_text(encoding="utf-8")
    tag = '<script type="module">'
    assert html.count(tag) == 1
    demo = o.with_name("index-demo.html")
    demo.write_text(html.replace(tag, "<script>window.__AUTO_DEMO=true</script>" + tag).replace("<title>", "<title>【自動説明版】", 1), encoding="utf-8")
    print(f"built {demo}")
