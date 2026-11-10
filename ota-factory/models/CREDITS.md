# 3D モデルのクレジット（models/）

元ファイルを Web 向けに最適化しています（ポリゴン削減・テクスチャ縮小・meshopt 圧縮、一部は不要な地面メッシュやアニメーションを削除）。

| ファイル | 元モデル | 作者 | ライセンス | 出典 |
|---|---|---|---|---|
| mill.glb | Cutter Machine | Francesco Coldesina | CC BY 4.0 | https://sketchfab.com/models/ea44a8bafd6e4beb87e3258e5e308007 |
| turn.glb | CNC Machine | canhoto.appu | CC BY 4.0 | https://sketchfab.com/models/c4adbed644704e378779b610127e2e97 |
| punch.glb | EMZ 3612 MII | vexhibition | CC BY 4.0 | https://sketchfab.com/models/08c38d43b01f4840887ff8495062b715 |
| lathe.glb | Lathe Machine | Centurion University | CC BY 4.0 | https://sketchfab.com/models/ff59679ac00248868e8236f39848eb55 |
| irb.glb | IRB 2400 Industrial Robot (UPDATED) | RJGonzalez23 | CC BY 4.0 | https://sketchfab.com/models/7d43d485dbc342cb9359cb68a9dfa93a |
| worker_m.glb / worker_f.glb / casual_m.glb / casual_f.glb | Ultimate Animated Character Pack | Quaternius | CC0 1.0 | https://quaternius.com/ |

Sketchfab のモデルは Objaverse 1.0（allenai/objaverse）収録分から取得しました。
punch.glb と irb.glb は実在製品を模したモデルで、構想上の代表機として置いています（機種選定を意味しません）。

実行時にネットワークから読み込むモデル（フォークリフト、パレット、工具類など）は NVIDIA SimReady（CC BY 4.0）で、
https://huggingface.co/datasets/codepawl/simready-glb から取得しています。
