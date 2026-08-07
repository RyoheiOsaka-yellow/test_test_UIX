#!/usr/bin/env python3
"""shell_3d.html に b1_pack.json を注入して自己完結の 3D シミュレータを生成する。"""
import pathlib

root = pathlib.Path(__file__).parent
pack = (root / "b1_pack.json").read_text()
shell = (root / "shell_3d.html").read_text()
assert "__B1_PACK__" in shell, "プレースホルダ __B1_PACK__ が見つからない"
out = root / "新宿駅B1人流3D.html"
out.write_text(shell.replace("__B1_PACK__", pack))
print(f"wrote {out} ({out.stat().st_size/1024:.0f} KB)")
