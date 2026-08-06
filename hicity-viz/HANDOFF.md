# 引き継ぎドキュメント — 羽田イノベーションシティ 3Dダッシュボード

ローカルのClaude Codeでこのプロジェクトを引き継ぐためのドキュメントです。
リポジトリ: `RyoheiOsaka-yellow/test_test_UIX` / ブランチ: `claude/haneda-innovation-city-viz-qzst0y` / ディレクトリ: `hicity-viz/`

## 1. プロジェクトの目的

HICity(羽田イノベーションシティ)を中心としたインタラクティブ3Dダッシュボード(単一HTML)。

- HICityのIFC図面(5棟)をフロア別に3D表示、K-field人流データ(2020/9/18–22)のヒートマップとリプレイ
- 2020→2026の人流変化・経済波及効果の**推計**表示(前提明記)
- 周辺駅(蒲田・京急蒲田・大森・大井町・天空橋・空港各駅など)を渋谷駅構内図3D風の**階層構造モデル**で表現、クリック/ボタンでズーム
- **新空港線(蒲蒲線)を赤の構想線**で表示(大田区公表の整備案・縦断面図に準拠した想定線形。第1期: 矢口渡〜東急蒲田地下駅〜京急蒲田地下駅、第2期: 〜大鳥居接続。トンネル断面・坑口・連絡通路付き)
- 駅・路線・HICity以外の大田区全域+羽田空港は**点群/ラインの都市ツイン表現**(ブレックスアリーナ宇都宮ツイン風): 建物点群(高さ色分け)・道路網・鉄道実線形・水域・滑走路・区境界・GSI航空写真

## 2. ファイル構成

```
hicity-viz/
├── index.html        # 3Dダッシュボード本体(データ・three.js同梱の単一ファイル, 生成物)
├── report.html       # 2D統計レポート(チャート版, 生成物)
├── HANDOFF.md        # このファイル
├── README.md
└── tools/            # 全ソース・生成スクリプト
    ├── app3d.js          # メインアプリ(three.js, ESM)
    ├── stations_data.js  # 駅構造・路線プロファイル・新空港線の定義データ
    ├── stations_build.js # 駅構造/路線/新空港線のジオメトリビルダー
    ├── area_build.js     # 大田区OSMレイヤー(建物点群/道路/水域/空港/GSIタイル)
    ├── template3d.html   # ページシェル(__DATA__/__AREA__/__APP__を注入)
    ├── extract_ifc.py    # IFC→フロアプラン抽出(要 ifcopenshell, shapely)
    ├── aggregate3d.py    # K-field CSV→ヒート/軌跡JSON(要 fit.json)
    ├── fetch_osm.py      # Overpass取得(境界/鉄道/駅/空港/水域/道路)
    ├── fetch_rest.sh     # 残りクエリの粘り強いリトライ版(道路・建物4分割)
    ├── fetch_bld_small.sh# 建物8分割(4緯度帯×2経度)の並行取得版
    ├── process_osm.py    # OSM生JSON→area.json圧縮(ID重複排除つき)
    └── aggregate.py      # (旧)2Dレポート用の集計
```

## 3. データソース

**Google Driveフォルダ** https://drive.google.com/drive/folders/1VditeiCJvyFuN6RptX3KDpmxrN3Rg151
`https://drive.usercontent.google.com/download?id=<ID>&export=download&confirm=t` で直接DL可能。

| ファイル | ID | 用途 |
|---|---|---|
| K-field_202009180000_… .csv | 1lJzGsC-X8SUl_70GK8IbNpv3-GAAZmSX | 人流(9/18) リプレイ・ヒート |
| K-field_202009190000_… .csv | 1kUdTvbMXGlJJdiHQdKKmHq2DXJjWXMwP | 人流(9/19) |
| K-field_202009200000_… .csv | 1zgq98NjxxJPkFsAqURoEytzurYL0ml8T | 人流(9/20) |
| K-field_202009210000_… .csv | 1ADWGnTDufcKrq0ckxMXSuZLTG3WLMl7F | 人流(9/21) |
| K-field_202009220000_… .csv | 1iYOi-e0rwqhO3C0s_O5i66OAoEmidDPY | 人流(9/22) |
| HIC_Building_1.ifc (棟A) | 1bgsl2F-o_lJG_0JEf0j8lRb7MUYeFE8k | 図面 |
| HIC_Building_2.ifc (棟B) | 1TumSKYmiIoDP1hmilsk6TJWpmN6h7RjS | 図面 |
| HIC_Building_3_rev2.ifc (棟C) | 1CQ-Qqsr5hZtcFzqsubhTzb-2vxR7UwxQ | 図面 |
| HIC_Building_4.ifc (棟5→D扱い) | 1A42ypPDUJk1wjO4Xcz9_fUKNQgG2RN-Z | 図面 |
| HIC_Building_5.ifc (棟E) | 1lGiKQ6ZYbBruZbKIWT8_JdHBHlokdVMB | 図面 |
| 電力使用量_20210225更新.csv | 1Dl9CrS82hdF7g0Cn2Gx-LRIo0sMv3Pgp | report.htmlの電力チャート |
| 施設共用部平面図.pdf | 1LKn1-OkFIbQuRFTPhBp60-YPFqeAL4jv | 参考(未使用) |

- K-field CSV: **Shift_JIS**。列 = `user_id,user_name,assigned_company,tag_id,tag_name,map_layer_id,map_layer_name,x(経度),y(緯度),created_at`(1秒間隔)。map_layer_name = `ゾーン文字_フロア`(例 `K_3F`)。タグ分類は `aggregate3d.py` の `group_of()` 参照(スタッフ/ビジター/各種ロボット/カート・車椅子)
- **周辺地図: OpenStreetMap Overpass API**(帰属表示必須: © OpenStreetMap contributors, ODbL)。bbox = `(35.518, 139.655, 35.630, 139.815)` = 大田区全域+羽田空港
- **GSI 航空写真タイル** `https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg`(実行時読込・オンライン時のみ)

## 4. 座標系(重要)

すべての3D座標は「HICityローカル平面(メートル)」。IFCの5棟は共通のサイト座標系を持つため、これを基準とした。

```
WGS84(lon,lat) → ENU近似: x=(lon-139.7555)*mlon, y=(lat-35.5482)*mlat
  mlon = cos(35.5482°)*111320 ≈ 90,590 m/deg, mlat = 110,967 m/deg
→ 回転+並進: local = R(+38°)·(x,y) + (65.0, -5.0)
three.js: worldX=localX, worldZ=-localY, worldY=高さ[m]
```

パラメータは `fit.json`(theta=38, dx=65, dy=-5)としてHTMLに埋め込み済み(`window.__HIC.fit`)。
このフィットはK-field測位点の78%がIFC建物内に入る自動フィット結果。**再計算不要**(再現するならscratchpadの手順: 建物ポリゴンへの内包率最大化のグリッドサーチ)。

## 5. ビルドパイプライン

```bash
cd hicity-viz/tools
pip install ifcopenshell shapely
npm i three@0.170.0 esbuild

# 1) IFC → plans.json (フロア別 slab/wall/glass/stair リング)
#    data/b1.ifc..b5.ifc を置いて:
python3 extract_ifc.py

# 2) K-field → heat3d.json(フロア別2mメッシュ) + traj.json(9/18軌跡, 1m移動or60秒毎に間引き)
#    data/kf_0918.csv 等 + fit.json を置いて:
python3 aggregate3d.py

# 3) OSM取得 → osm/*.json (Overpassは混雑時504が多い。curl -G が通る。POSTは不可な環境あり)
python3 fetch_osm.py          # 境界/鉄道/駅/空港/水域/道路(主要+南北分割)
# 建物はOverpass混雑時、Geofabrik経由が確実:
#   curl -o kanto.osm.pbf https://download.geofabrik.de/asia/japan/kanto-latest.osm.pbf  (~480MB)
#   osmium extract -b 139.655,35.518,139.815,35.630 kanto.osm.pbf -o ota.osm.pbf
#   osmium tags-filter ota.osm.pbf w/building -o ota_bld.osm.pbf
#   pyosmium(pip install osmium)で geometry付きJSONへ変換 → osm/bld_geofabrik.json
#   (Overpass形式: {"elements":[{"type":"way","id":..,"tags":{height系のみ},"geometry":[{lon,lat},..]},..]})

# 4) OSM → area.json (ローカル座標へ変換・量子化・建物は近傍=全形状/遠方=OBB)
python3 process_osm.py

# 5) バンドル+注入 → index.html
npx esbuild app3d.js --bundle --minify --format=iife --outfile=app3d.bundle.js
python3 - <<'EOF'
import json
data='{"plans":%s,"heat":%s,"traj":%s,"fit":%s}'%(
  open('plans.json').read(), open('heat3d.json').read(),
  open('traj.json').read(), open('fit.json').read())
t=open('template3d.html').read()
out=t.replace('__DATA__',data).replace('window.__HIC=','window.__AREA='+open('area.json').read()+';window.__HIC=')
i=out.index('__APP__'); out=out[:i]+open('app3d.bundle.js').read()+out[i+7:]
open('../index.html','w').write(out)
EOF
```

※ 中間生成物(plans.json, heat3d.json, traj.json, area.json, osm/生データ)はリポジトリ未収録。`index.html` にはすべて埋め込み済みなので、**データを変えない限り再生成は不要**。

## 6. 実装済み機能(UI)

- フロア(IFC図面)表示切替+フロア展開スライダー / 図面ライン / フロア塗り / 図面モード
- 滞留ヒートマップ(5日間・フロア別2mメッシュ、ホバーで延べ滞在時間)
- 人流リプレイ(2020/9/18実測、時刻スライダー、×60/×240/×900、カテゴリ別稼働数)
- 2026シナリオ(低位×2.2/中位×3.2/高位×4.6、ビジター粒子複製+滞在42.4→55/64/76分+経済波及59/89/128億円/年) — **推計、前提はreport.html・コミットログ参照**
- 周辺エリア: 建物点群(高さ色分け: 紺→水→緑→黄)/道路3階級/鉄道実線形/水域/滑走路・誘導路・エプロン/大田区境界/GSI航空写真
- 駅構造: 主要9駅の階層モデル(レール2条・ホーム縁警戒線・階段/エスカ/EV・改札列・レベルラベル)+小駅24駅。**クリックまたは「移動」ボタンでフライト**
- 新空港線(赤): 第1期実線+第2期破線、トンネル断面(オレンジ)、坑口(黄)、地下新駅2駅(赤)、連絡通路(白破線)・立坑
- 路線3Dプロファイル(京急の高架→地下の縦断変化、モノレール、JR、東急、りんかい、浅草線)

## 7. 残タスク

1. ~~建物点群データの取得~~ → **完了**(Geofabrik関東抽出で33.8万棟、近傍1.5kmフル形状5,915棟+広域OBB 149,725棟、間引き: 3.5km超は面積80m²未満かつ高さ12m未満を省略。表示点数約164万点)
2. ~~リプレイの複数日対応~~ → **完了**(9/18〜9/22の5日切替)
3. 駅データの精度向上(現状は「公開情報に基づく想定・仮説」の模式モデル。国交省 歩行空間ネットワークデータや駅構内図で精緻化可能)
4. PLATEAU 3D都市モデル(大田区)による建物精緻化、経路検索モード(渋谷参考HTMLにあった機能)、建物点群のLOD/チャンク化(現状10MB・低スペック端末では重い可能性)

## 8. 注意事項(そのまま維持すること)

- 新空港線は**構想・未開業**。赤+破線+「構想」表記を維持
- 駅構内配置・2026年推計・経済波及は**想定/試算**である旨の注記を維持
- OSM帰属表示(© OpenStreetMap contributors)とGSI出典表記を維持
- K-fieldはタグ装着者のみの計測(施設全体の来訪者数ではない)

## 9. 成果物の場所

- Artifact(オンライン閲覧): https://claude.ai/code/artifact/3eb19676-6b5b-42ac-aa20-264a4f848208
- ブランチ最新: `claude/haneda-innovation-city-viz-qzst0y`(index.html=3D, report.html=2D)
