# Wheelchair CAD Studio

`../wheelchair-cad/wheelchair_cad.py`（CadQuery / OpenCascade）で生成した **53 品番 / 254 点**の B-rep 車椅子モデルを、
共通スタジオコア（`../studio-core/`）で表示する CAD 版です。操作・UI は VolaTrap 版 / 車椅子プロシージャル版と共通です。

- 体積・重心は CAD カーネル値（`vol` 上書き）。質量 = 体積 × 材質密度。
- 53 工程の順次分解（スポーク・ニップル・ベアリング・ボルト・ナットまで個別品番）。
- 目標値: JIS T 9201 寸法 + 総質量 + 回転円直径 + **締結部品点数**（部品数削減の KPI）。
- パラメータは固定（再生成は Python 側）。ライブパラメータ版は `../wheelchair-studio/`。

STEP アセンブリ: `../wheelchair-cad/out/wheelchair_assembly.step`（CATIA / SolidWorks / FreeCAD で開けます）。
