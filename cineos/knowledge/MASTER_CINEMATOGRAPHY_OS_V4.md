# Virtual Cinematography Studio — Master Reference / Knowledge Base v1.0

> **目的**  
> 動画・CM・映画・MV・SNS縦型動画・スチール撮影・商品撮影・人物撮影・屋外撮影・空撮・特殊撮影・VFX / Virtual Productionまでを、  
> **「何を撮りたいか → どの画を作るか → どの機材をどう置くか → 何を設定するか → どんなカットを撮るか → AI動画生成ツールへどう指示するか」**  
> という一連の意思決定として扱うための、Claude Code向け基礎知識ベース。
>
> **想定プロダクト**  
> ブラウザ上の仮想撮影スタジオ。ユーザーが商品・人物・ロケーション・時間帯・感情・参考画像を入力すると、カメラ、レンズ、照明、グリップ、ドローン、特殊機材、背景、VFX、液体・煙・風などを仮想空間に配置し、完成イメージ・照明図・カメラ図・ショットリスト・絵コンテ・PDF・Seedance等向け生成指示書を出力する。

---

## 0. このMDの位置づけ

本資料は「世界中のすべての型番を固定リスト化する」ものではない。機材は毎年更新され、地域限定モデルやレンタルハウス独自改造品もあるため、完全列挙は保守不能になる。

その代わりに、以下を網羅する。

1. 撮影機材の**全カテゴリ体系**
2. 各カテゴリの**原理**
3. **どういう画になるか**
4. **何を選ぶべきか**
5. **どう配置するか**
6. **数値パラメータ**
7. **代表的な実機**
8. 商品・人物・食品・飲料・ファッション等の**撮影レシピ**
9. カメラワーク・照明・特殊効果・空撮の**ショット文法**
10. AIが自動選定するための**データモデル**
11. Seedance / Veo / Runway / Kling等へ変換するための**Prompt Compiler仕様**
12. PDF・照明図・絵コンテ生成に必要な**出力スキーマ**

したがって本MDを「ontology / rules / recipes」の親ファイルとし、製品SKUは別JSON/DBで随時追加する設計を推奨する。

---

# PART 1 — 撮影を構成するパラメータ

## 1.1 画を決める基本変数

映像・写真は、概ね次の変数の組み合わせで決まる。

```yaml
visual_intent:
  subject:
  category:
  message:
  emotion:
  visual_keywords: []
  realism_level:
  reference_style:

scene:
  location_type:
  dimensions_m:
  time_of_day:
  weather:
  ambient_light:
  background:
  practical_lights: []

camera:
  sensor_format:
  resolution:
  codec:
  dynamic_range:
  frame_rate:
  shutter_angle:
  iso:
  white_balance:
  nd:
  stabilization:
  camera_height:
  camera_distance:
  yaw:
  pitch:
  roll:

lens:
  focal_length_mm:
  aperture:
  focus_distance_m:
  t_stop:
  squeeze:
  macro_ratio:
  filtration:

lighting:
  key:
  fill:
  rim:
  background:
  top:
  eye_light:
  practical:
  negative_fill:
  flags:
  diffusion:
  haze:

motion:
  subject_motion:
  camera_motion:
  speed:
  acceleration:
  easing:
  parallax:
  motion_blur:

effects:
  wind:
  rain:
  mist:
  haze:
  smoke:
  condensation:
  droplets:
  splash:
  particles:
  projection:
  led_volume:
```

AIは「機材名」を直接決める前に、まずこの**能力値**を決定すべき。

---

# PART 2 — CAMERA SYSTEMS

## 2.1 センサーサイズ

### 2.1.1 Large Format / Full Frame
おおよそ36×24mm前後。

**特徴**
- 同じ画角なら長めの焦点距離を使用できる
- 被写界深度を浅くしやすい
- 広角でも立体感を作りやすい
- 高級CM、人物、美容、自動車、映画向き

**向く画**
- 高級感
- 俳優の顔
- ガラスや金属のプロダクト
- 夕景・夜景
- 背景を大きくぼかしたCM

### 2.1.2 Super 35
映画撮影の標準的フォーマット。

**特徴**
- 被写界深度とフォーカス運用のバランス
- シネレンズ選択肢が非常に多い
- ドリー、ジンバル、ハンドヘルド等との相性が良い

### 2.1.3 Super 16
- 深めの被写界深度
- 小型レンズ
- 粒状感・ドキュメンタリー感
- クロップによる望遠効果

### 2.1.4 Medium Format Still
44×33mm前後など。

**用途**
- 化粧品
- 宝飾
- ファッション
- 美術複製
- 大型広告
- 高解像度商品撮影

代表例: Hasselblad X2D II 100Cは43.8×32.9mm BSI CMOS、100MP。

---

## 2.2 Cinema Camera — 代表クラス

### ARRI ALEXA 35 / ALEXA 35 Xtreme
- Super 35
- 4.6K
- 公称17 stops
- EI 160–6400
- ARRIRAW / ARRICORE / ProRes
- Xtreme世代ではモードにより数百fps
- 特徴: ハイライトロールオフ、肌、映画的階調

**仮想スタジオ推奨タグ**
```yaml
tags: [cinematic, skin_tone, highlight_rolloff, premium_commercial, narrative]
```

### Sony VENICE / VENICE 2 class
用途:
- 大型映画
- VFX
- HDR
- バーチャルプロダクション
- リモートヘッド
- 車載

### RED V-RAPTOR class
用途:
- 高解像度
- ハイスピード
- VFX
- アクション
- ドローン / ジンバル

### Blackmagic URSA Cine 12K LF
- 約36×24mm large format
- 12,288×8,040 Open Gate
- 16 stops
- PL / EF交換系
- 内蔵IR ND
- 解像度とクロップ条件により120fps超、B4 cropでは240fpsクラス
- 8TB media構成等

### Canon EOS C400
- 6K Full Frame BSI stacked CMOS
- triple base ISO 800 / 3200 / 12800
- 16 stops公称
- 6K RAW 60p
- 4K 120p
- 2K 180p
- RF mount
- 強力なAF

**適性**
- 少人数CM
- ドキュメンタリー
- ジンバル
- 商品説明
- 俳優追従
- SNS広告

---

## 2.3 Mirrorless / Hybrid

分類例:
- Sony α1 / α9 / FX3 / FX2 / FX30
- Canon EOS R5 C / R5 II
- Nikon Z9 / Z8
- Panasonic S1H / S1R II / GH系
- Fujifilm GFX / X-H系

**仮想スタジオでの役割**
「Cinema camera」と別物にせず、
```yaml
camera_weight
sensor_size
rolling_shutter
raw_support
max_fps
IBIS
AF
heat_limit
rig_size
```
で推薦する。

---

## 2.4 High Speed Cameras

### Freefly Ember S5K
- Super 35
- 5K 約600fpsクラス
- 4K 約800fpsクラス
- 小型約800g級
- continuous high-speed capture
- commercial/productに向く

### Vision Research Phantom
代表: TMX 7510
- 1280×800で76,000fps
- reduced resolutionで数十万fps
- FAST option条件では100万fps超級

**用途**
- 水滴衝突
- ガラス破砕
- 弾性変形
- 粉体
- 爆発・燃焼の科学撮影
- スポーツインパクト
- 液体冠
- 空気・流体現象

### ハイスピード撮影の露出原則
フレームレートを上げると1フレームあたりの露光時間が短くなる。

24fps / 180°:
- 約1/48 sec

120fps / 180°:
- 約1/240 sec

1000fps / 180°:
- 約1/2000 sec

したがって
- 大光量
- 高効率LED
- HMI
- flicker-free対応
- 光源周波数確認
が必要。

---

## 2.5 Global Shutter vs Rolling Shutter

### Global
全画素を同時露光。

向く:
- 激しいパン
- 車
- プロペラ
- VFX tracking
- 高速物体
- motion control

### Rolling
走査順に露光。

リスク:
- skew
- jello
- propeller bending
- LED banding

仮想スタジオでは被写体速度とパン速度から`rolling_shutter_risk`を算出する。

---

# PART 3 — LENS SYSTEMS

## 3.1 焦点距離による画の変化

### 8–14mm
- 超広角
- 誇張
- POV
- 狭所
- FPV
- スケート / アクション

### 14–20mm
- dynamic wide
- 建築
- 店舗
- 車内
- 大人数

### 21–28mm
- 現代CMの広角人物
- 近距離ドリー
- 空間＋人物

### 32–40mm
- 自然
- 主観に近い
- ファッション
- lifestyle

### 50mm
- neutral
- 商品
- 人物
- narrative

### 65–85mm
- beauty
- interview
- portrait
- compressed background

### 100–135mm
- beauty close-up
- product detail
- food
- fashion detail

### 180–600mm+
- sport
- wildlife
- compressed city
- distant detail

---

## 3.2 Prime Lens
特徴:
- 高速
- 明るい
- 軽い
- 一貫したルック
- focus pullしやすい

代表系統:
- ARRI Signature Prime
- ARRI Master Prime
- Cooke S4 / S8
- ZEISS Supreme Prime
- Leitz Prime
- Canon CN-E
- Sony CineAlta
- Tokina Vista
- Sigma Cine
- Angénieux Optimo Prime
- Atlas Orion / Mercury anamorphic

---

## 3.3 Zoom Lens

用途:
- live
- sports
- documentary
- rapid reframing
- crash zoom
- dolly zoom

タイプ:
- cinema zoom
- broadcast box lens
- ENG zoom
- servo zoom
- lightweight zoom

---

## 3.4 Anamorphic

パラメータ:
```yaml
squeeze: 1.33 | 1.5 | 1.8 | 2.0
flare:
bokeh_shape:
close_focus:
breathing:
edge_distortion:
```

表現:
- 横長楕円ボケ
- 水平フレア
- edge falloff
- cinematic distortion

適用:
- 映画
- MV
- luxury
- night city
- cars

---

## 3.5 Macro

倍率:
- 0.5×
- 1:1
- 2:1
- 5:1
- microscope class

用途:
- 化粧品の液体
- 時計
- 宝石
- 食品断面
- 気泡
- 繊維
- 肌
- 水滴

注意:
- 被写界深度が極端に薄い
- diffraction
- focus stacking
- vibration
- lens-to-subject distance
- small flags/reflectionsが巨大に映る

---

## 3.6 Probe Lens

代表例:
- Laowa 24mm Probe系

用途:
- 食品の中を通過
- ボトル間
- 植物
- ミニチュア
- テーブル面すれすれ
- 商品内部のような視点

特徴:
- 細長い鏡筒
- wide macro
- extreme close perspective

---

## 3.7 Tilt-Shift
用途:
- 建築
- 商品
- miniature effect
- focus plane manipulation

Scheimpflugによるフォーカス面操作をUI上で可視化する。

---

## 3.8 Periscope / Snorricam / Specialty Optics

登録すべき特殊系:
- periscope
- borescope
- snorkel lens
- relay lens
- split diopter
- diopter
- swing/tilt
- fisheye
- catadioptric mirror lens
- UV lens
- IR lens
- thermal optics
- endoscope
- microscope adapter

---

## 3.9 Filters

### ND
光量のみを落とす。

- ND0.3 = 1 stop
- ND0.6 = 2 stops
- ND0.9 = 3 stops
- ND1.2 = 4 stops
- etc.

### Variable ND
偏光素子利用。
注意:
- cross pattern
- color shift
- ultra-wide issues

### CPL
反射除去。

特に:
- ガラス
- 車
- 水
- 葉
- glossy product

ただし金属鏡面反射には効きにくい。

### Diffusion
- Black Pro-Mist
- Glimmerglass
- Black Satin
- Hollywood Black Magic
- Pearlescent
- Fog
- Low Contrast

属性:
```yaml
halation_strength:
contrast_reduction:
skin_softening:
highlight_bloom:
black_retention:
```

### Split Diopter
画面の一部だけ近距離にピント。
映画的な「手前と奥の同時フォーカス」。

### Star / Streak / Prism
MV、コスメ、夜景。

---

# PART 4 — EXPOSURE / IMAGE SCIENCE

## 4.1 Exposure Triangle
- aperture
- shutter
- ISO

ただし映画ではNDを加えた4変数。

```text
Exposure = scene luminance
         + aperture
         + shutter
         + ISO/EI
         - ND
```

---

## 4.2 Shutter Angle

24fps:
- 180° ≈ 1/48
- 90° ≈ 1/96
- 45° ≈ 1/192
- 360° ≈ 1/24

### 短いシャッター
- crisp
- aggressive
- staccato
- sports/action

### 長いシャッター
- smear
- dreamy
- nightlife
- dance
- abstraction

---

## 4.3 Frame Rate Intent

| fps | 主用途 |
|---|---|
| 23.976/24 | cinematic |
| 25 | PAL地域 |
| 29.97/30 | web / broadcast |
| 50/60 | smooth/live/sports |
| 100/120 | CM slow motion |
| 200–500 | splash / hair / cloth |
| 500–2,000 | droplets / impact |
| 2,000–20,000 | scientific slow motion |
| 20,000+ | ballistic / fracture / shock event |

---

# PART 5 — LIGHTING FUNDAMENTALS

## 5.1 光源の重要属性

```yaml
fixture:
  type:
  max_output:
  cct_min:
  cct_max:
  cri:
  tlci:
  ssi_tungsten:
  ssi_daylight:
  rgb:
  rgbww:
  pixel_control:
  beam_angle:
  lens_options:
  flicker_free_fps:
  dimming:
  weather_rating:
  power_w:
  power_source:
  weight_kg:
  control:
    - dmx
    - crmx
    - artnet
    - sacn
    - app
```

---

## 5.2 Hard Light

特徴:
- 鋭い影
- texture
- sun-like
- specular highlight
- dramatic

代表:
- open face
- Fresnel focused
- reflector
- PAR
- spotlight

---

## 5.3 Soft Light

作り方:
- large diffusion
- bounce
- softbox
- book light
- lantern
- overhead frame

原則:
**被写体から見た光源の見かけサイズが大きいほど柔らかい。**

---

## 5.4 Fresnel
レンズによりspot/flood。

用途:
- classic cinema
- hair light
- backlight
- simulated sun
- hard key

---

## 5.5 HMI
Daylight系の高出力。

用途:
- 窓外
- 太陽再現
- 屋外fill
- large diffusion越し

注意:
- ballast
- flicker
- UV
- heat
- high voltage
- warm-up

---

## 5.6 Tungsten
約3200K。

特徴:
- full spectrum
- skin
- warm
- dimで色温度変化
- 高熱

---

## 5.7 LED COB

代表系:
- Aputure Electro Storm
- Nanlux Evoke
- Nanlite Forza
- ARRI Orbiter
- Godox KNOWLED
- amaran

Electro Storm XT26級:
- 2600W max output class
- 2700–6500K
- IP65
- CRMX / DMX等
- 超大型窓光、太陽再現、high-speed用途

---

## 5.8 LED Panel
- SkyPanel
- Creamsource
- Kino Flo
- Litepanels
- Gemini
- Nanlux / Aputure panel class

用途:
- soft key
- fill
- green/blue screen
- interview
- car interior
- virtual production

---

## 5.9 Pixel / Image-Based Lighting

### MIMIK class
映像信号そのものを高品質な光として出す。

用途:
- LED volume foreground lighting
- moving reflections
- interactive light
- vehicle plate
- virtual production

仮想スタジオでは
```yaml
interactive_light_source:
  content_source: video
  sync: genlock
  latency_ms:
  color_pipeline:
```
を持つ。

---

## 5.10 Tube Lights
代表:
- Astera Titan / Helios
- Nanlite PavoTube
- Kino Flo Freestyle tube class

用途:
- practical
- cyberpunk
- car
- hidden light
- moving actors
- reflection streak

---

## 5.11 Flexible Mats
- LiteMat
- Aladdin
- Amaran F series
- carpet lights

用途:
- ceiling
- car
- tiny set
- wrap light

---

## 5.12 Projection / Ellipsoidal
- Source Four
- Spotlight Mount
- Dedolight projector

用途:
- gobos
- window pattern
- logo
- hard-edged shape
- product pin spot

---

# PART 6 — STROBE / STILL PHOTOGRAPHY

## 6.1 Studio Flash

代表:
- Profoto Pro-D3
- Profoto Pro packs
- Broncolor Scoro
- Godox P / QT series
- Elinchrom ELC

Profoto Pro-D3 class:
- 750 / 1250 Ws
- 非常に短いflash durationモード
- high-volume product/fashion向け

---

## 6.2 Flash Duration
動きを止める本質はシャッター速度だけではなく、**発光時間**。

用途:
- liquid splash
- powder
- hair
- jumping fashion
- product impact

---

## 6.3 Leaf Shutter
中判・一部レンズ。
高いflash sync speedが可能。

屋外で:
- 背景を暗く
- 絞りを開く
- flashを強く
という表現に便利。

---

# PART 7 — LIGHT MODIFIERS

## 7.1 Diffusion
種類:
- full grid cloth
- half grid
- quarter grid
- silk
- magic cloth
- muslin
- bleached muslin
- unbleached muslin
- opal
- Hampshire frost
- 216
- 250
- tracing diffusion

属性:
```yaml
transmission_loss_stops:
softness:
spread:
color_shift:
texture:
```

---

## 7.2 Bounce
- ultra bounce
- bead board
- foamcore
- poly
- muslin
- silver
- gold
- mirror

### White
soft neutral

### Silver
harder / more efficient / specular

### Gold
warm

### Unbleached muslin
warm organic skin

---

## 7.3 Negative Fill
黒布・solid・floppy等で環境光を吸収。

用途:
- 顔の立体感
- 商品輪郭
- cinematic contrast
- 黒い商品のエッジ

---

## 7.4 Flags / Cutters
- 18×24
- 24×36
- 4×4
- floppy
- cutter
- teaser
- topper
- sider

用途:
- spill除去
- reflection shape
- lens flare control

---

## 7.5 Scrims
光質を大きく変えず強さを落とす。

---

## 7.6 Grids
softboxやframeの光を狭める。

---

## 7.7 Cucoloris / Gobo
影模様。

- window
- foliage
- blinds
- abstract
- breakup

---

# PART 8 — CLASSIC LIGHTING PATTERNS

## 8.1 Three-Point
- key
- fill
- back

## 8.2 Rembrandt
頬に三角形の光。

## 8.3 Loop
鼻影が短く横。

## 8.4 Butterfly / Paramount
正面上から。
beauty。

## 8.5 Split
顔を左右に分割。

## 8.6 Book Light
light → bounce → diffusion。

非常に柔らかく自然な人物光。

## 8.7 Cove Light
複数ライトを大きな面として形成。

## 8.8 Overhead Soft Box
食品、テーブル、ファッション、商品。

## 8.9 Edge Lighting
透明・黒・金属商品。

---

# PART 9 — PRODUCT LIGHTING

## 9.1 Glossy Product
例:
- 化粧品ボトル
- スマホ
- 家電
- 車
- 金属

重要:
**光そのものより「何を映り込ませるか」を設計する。**

必要:
- large white cards
- black cards
- strip lights
- gradients
- polarizer
- controlled background

---

## 9.2 Black Product

黒は「明るくする」のではなく輪郭を作る。

配置例:
```text
        strip rim
           \
black card  PRODUCT  white strip
             |
          camera
```

---

## 9.3 Transparent Bottle

推奨:
- rear diffusion
- backlight
- side black cards
- optional top highlight
- controlled condensation

結果:
- 液体色が透過
- ボトル輪郭が締まる
- ラベルはfront soft lightで別管理

---

## 9.4 Water Droplets / Condensation

### 水滴を付ける目的
- cold
- fresh
- tactile
- summer
- refreshment

### サイズ
- micro mist → 冷気 / 霜感
- 1–3mm → 飲料CM
- 4–8mm → hero droplet
- running droplets → intense cold / melt

### 実務
水だけでは流れやすい。
撮影ではグリセリン等を混ぜて保持することがある。

**プロダクトUI**
```yaml
condensation:
  enabled: true
  density: 0.65
  droplet_size_mm: [0.5, 3]
  running_droplets: 2
  coverage: front_side
```

---

## 9.5 Beer
- golden backlight
- foam control
- condensation
- dark edge cards
- bubbles
- top highlight
- slow pour 120–500fps

---

## 9.6 Whisky / Highball
- amber liquid edge
- ice specular
- carbonation
- hard backlight
- cool ambient + warm liquid
- macro condensation
- swirling ice

---

## 9.7 Wine
赤:
- back/side transmission
- elegant warm practical
- controlled stem reflections

白:
- cool/neutral translucence
- fine condensation optional

---

## 9.8 Cosmetics

### Serum
- translucent
- viscosity
- pipette macro
- backlit fluid
- caustics

### Lipstick
- precise specular
- edge highlight
- macro texture
- rotating pedestal

### Powder
- very high speed
- hard side/back
- black background
- particle control

---

## 9.9 Jewelry
- macro
- small hard accents
- large controlled gradients
- black/white cards
- focus stacking still
- turntable
- polarizing strategy where applicable

---

## 9.10 Smartphone
- moving light sweep
- edge light
- black void
- screen replacement
- motion control
- macro ports
- reflection boards

---

# PART 10 — FOOD

## 10.1 Burger
- back/side key for texture
- front fill
- steam
- glycerin/oil sheen carefully
- macro
- shallow DOF

## 10.2 Fried Chicken
- hard-ish side key
- warm color
- texture highlight
- crumb particle macro
- pull-apart slow motion

## 10.3 Ice Cream
- cold management
- fake hero options
- controlled melt
- top soft
- rim
- macro scoop

## 10.4 Steam
backlightが必須に近い。

煙・蒸気は背景より明暗差を作る。

---

# PART 11 — BEAUTY / PORTRAIT

## 11.1 Beauty Lighting
標準:
- large frontal soft source
- beauty dish
- butterfly
- below-camera fill
- eye light
- edge/hair optional

### Glass Skin
- broad specular
- controlled moisturizer
- side angle
- polarizerを使いすぎると艶が消える

---

## 11.2 Hair
髪はback/rimで分離。
動きを見せる場合:
- fan
- side/back light
- 50–120fps

---

## 11.3 Eyewear
課題:
- lens reflection
- frame shadow

対策:
- light elevation
- large soft sources
- polarizer
- reflection card design
- slight head/lens angle

---

# PART 12 — FASHION

## 12.1 Studio Fashion
- seamless
- cyc
- large top/side
- hard frontal flash
- ring flash
- mixed flash + continuous

## 12.2 Editorial Hard Flash
- on-axis
- crisp shadow
- paparazzi
- 28–50mm

## 12.3 Cloth Motion
- fan
- 50/60/120fps
- cross light
- backlight for translucent fabric

---

# PART 13 — CAMERA SUPPORT

## 13.1 Tripod
- fluid head
- geared head
- ball head
- still head

### Fluid Head
pan/tilt drag。

### Geared Head
precise cinema composition。

---

## 13.2 Hi-Hat / Low-Hat
床すれすれ。

---

## 13.3 Slider
- manual
- motorized
- curved
- vertical

用途:
- product parallax
- tabletop
- interview push

---

## 13.4 Dolly
- doorway
- Fisher
- Chapman
- track dolly

moves:
- push in
- pull out
- lateral
- arc
- compound

---

## 13.5 Jib / Crane
高さ変化＋水平移動。

---

## 13.6 Telescopic Crane
Technocrane / Hydrascope class。

用途:
- 高所→人物
- 建物外
- concert
- car
- large reveal
- continuous one-take

Hydrascope系には防水運用を想定したモデル群があり、雨・水辺・dusty条件にも対応する設計がある。

---

## 13.7 Stabilized Remote Head

ARRI 360 EVO / SRH class。

用途:
- crane
- car
- motorcycle
- cable cam
- fast dynamic movement

360 EVO classではroll軸を含む連続回転表現が可能。

---

## 13.8 Steadicam / Body Stabilizer
- mechanical sled
- vest
- arm

表現:
- human floating
- organic
- stairs
- walk-and-talk

---

## 13.9 Hybrid Stabilizer
ARRI TRINITY系:
mechanical + electronic stabilization。

表現:
- low → high continuous
- roll
- dynamic orbit

---

## 13.10 Handheld
特徴:
- body energy
- documentary
- tension
- intimacy

パラメータ:
```yaml
handheld:
  amplitude:
  frequency:
  operator_mass_feel:
  stabilization_percent:
```

---

## 13.11 Shoulder
handheldより慣性がある。

---

## 13.12 Easyrig
重量支持。
完全なstabilizerではない。

---

# PART 14 — MOTION CONTROL / ROBOTIC CAMERA

## 14.1 Motion Control Robot
代表系:
- MRMC Bolt
- Bolt X
- KUKA based cine robots
- SISU
- Milo

用途:
- product
- repeatable moves
- VFX passes
- splash
- macro
- impossible acceleration

---

## 14.2 Repeatable Passes
同一軌道を複数回。

例:
1. beauty pass
2. reflection pass
3. screen pass
4. particle pass
5. clean plate
6. matte pass

postで合成。

---

## 14.3 Robotic Dolly / AGITO
remote controlled trackless / tracked configurations。

用途:
- sports
- live
- studio
- fast low angle
- repeated move

MagTraxのように床下・床面の磁気テープを追従する構成も存在。

---

# PART 15 — VEHICLE CAMERA SYSTEMS

## 15.1 Process Trailer
車をトレーラーに載せる。
俳優は運転演技に集中。

## 15.2 Russian Arm / U-Crane style
追走車＋crane＋stabilized head。

## 15.3 Suction Mount
小型カメラ。

## 15.4 Speed Rail Rig
車体へのrigging。

## 15.5 Hostess Tray
窓外。

## 15.6 Hood Mount
正面。

## 15.7 Tow Rig
背景を実走させる。

## 15.8 LED Car Process
LED volumeで車内に動く環境反射を生成。

---

# PART 16 — DRONES

## 16.1 Cinema Drone
### DJI Inspire 3
- Zenmuse X9-8K Air
- Full Frame
- ProRes RAW 8K/75fps class
- CinemaDNG 8K/25fps class
- 4K/120fps
- RTK
- repeatable routes / 3D dolly系機能

用途:
- cinematic establishing
- building reveal
- vehicle follow
- landscape
- repeated VFX plate

---

## 16.2 Heavy Lift Drone
### Freefly Alta X class
- 最大payload約15kg級
- cinema camera + lens + gimbal
- industrial rigging

用途:
- ALEXA/RED級
- large lens
- custom sensor
- LiDAR

---

## 16.3 FPV Drone
例:
- custom cinewhoop
- DJI Avata class

表現:
- doorway dive
- chase
- interior-to-exterior
- proximity flight
- one-take

Avata 2 class:
- 155° FOV
- 4K 100fps class
- compact protected propeller form

---

## 16.4 Tiny Whoop / Cinewhoop
狭い室内。

## 16.5 Long-Range FPV
山、車、ski。

## 16.6 Cable Cam
ドローン禁止環境や一定軌道。

---

## 16.7 Drone Shot Vocabulary

### Establishing Rise
低空→上昇。

### Reveal Over
障害物越し。

### Orbit
被写体中心。

### Chase
後方追従。

### Lead
前方から後退。

### Top Down
90°。

### Parallax Slide
横移動。

### Dive
高所から急降下。

### FPV Gap
狭い隙間を通過。

### Crane-to-Drone Illusion
地上craneのように開始→空へ。

---

## 16.8 Drone Safety Metadata

```yaml
drone_operation:
  country:
  airspace_class:
  max_altitude:
  night:
  visual_line_of_sight:
  people_overflight:
  pilot_license:
  spotter:
  permissions:
  wind_limit:
  precipitation:
  gps:
  rtk:
  emergency_landing_zone:
```

法規は国・地域・時期で変わるため、製品側では**撮影設計と飛行許可判定を分離**し、法規DBを最新化する。

---

# PART 17 — UNDERWATER

機材:
- underwater housing
- splash housing
- dome port
- flat port
- underwater monitor
- buoyancy arms
- underwater lights

### Dome
広角、水面split shot。

### Flat
macro、画角変化あり。

課題:
- red absorption
- backscatter
- buoyancy
- condensation
- pressure
- focus

---

# PART 18 — AERIAL / CABLE / SPECIAL RIGS

- helicopter gyro mount
- Shotover
- Cineflex
- cablecam
- Spidercam
- towercam
- railcam
- polecam
- wire rig
- overhead track
- suction vehicle rig
- helmet cam
- body cam
- chest cam

---

# PART 19 — 360 / VR / STEREO

## 19.1 360 Camera
- Insta360 professional class
- Kandao
- custom arrays

## 19.2 Stereoscopic VR
Canon RF 5.2mm Dual Fisheye class:
- dual lens
- 190° field
- stereo capture

用途:
- VR180
- immersive concert
- tourism
- spatial media

## 19.3 Volumetric Capture
- multi-camera array
- calibrated sync
- green / neutral volume
- depth
- NeRF / Gaussian Splatting ingestion

---

# PART 20 — SPECIAL IMAGING

登録カテゴリ:

- thermal
- infrared
- ultraviolet
- multispectral
- hyperspectral
- night vision
- intensified camera
- schlieren
- shadowgraph
- high-speed scientific
- microscope
- macro rail
- x-ray (regulated)
- polarized microscopy
- structured light
- LiDAR
- depth camera
- event camera

---

# PART 21 — ATMOSPHERIC EFFECTS

## 21.1 Haze
光線を見せる。
薄く均一。

## 21.2 Fog
濃い。

## 21.3 Smoke
局所的。

## 21.4 Dry Ice
低く流れる。

## 21.5 Steam
食品。

## 21.6 Rain
- rain tower
- rain bar
- garden rain
- backlight essential

## 21.7 Snow
- paper
- foam
- biodegradable material
- VFX

## 21.8 Dust / Powder
backlight + high speed。

---

# PART 22 — WIND

機材:
- household fan
- floor fan
- wind machine
- Ritter fan
- air mover
- compressed air
- leaf blower class

用途:
- hair
- dress
- curtains
- leaves
- smoke shaping

UI:
```yaml
wind:
  speed_mps:
  direction_deg:
  gustiness:
  turbulence:
  target:
```

---

# PART 23 — LIQUID EFFECTS

- spray bottle
- atomizer
- rain rig
- syringe
- drop controller
- pump
- solenoid valve
- aquarium pump
- air jet
- splash tank
- rotating liquid rig

### Water Crown
macro + high speed + backlight。

### Controlled Drop
電子drop controller。

### Pour
液体粘度と容器口で形状を管理。

---

# PART 24 — ROTATION / PRODUCT MOTION

- turntable
- motorized lazy susan
- motion-control rotary
- hanging rotation
- magnetic levitation
- air bearing
- wire removal

shot:
- 360 hero
- half orbit
- light sweep while static camera
- camera orbit + counter rotation

---

# PART 25 — BACKGROUNDS

## 25.1 Seamless Paper
## 25.2 Cyclorama
## 25.3 Black Velvet
## 25.4 Acrylic
## 25.5 Mirror
## 25.6 Brushed Metal
## 25.7 Textured Plaster
## 25.8 Water Tray
## 25.9 LED Wall
## 25.10 Projection
## 25.11 Green Screen
## 25.12 Blue Screen

---

# PART 26 — CHROMA KEY

重要:
- evenness
- subject separation
- spill
- shutter
- hair detail
- compression
- tracking markers

UIはgreen screen illuminance uniformityをheatmapで表示。

---

# PART 27 — VIRTUAL PRODUCTION

構成:
- LED volume
- render engine
- Unreal Engine
- camera tracking
- lens encoding
- genlock
- timecode
- LED processor
- color pipeline
- foreground light
- ceiling LED
- practical
- tracking markers

## 27.1 In-Camera VFX
カメラ位置に応じて背景パース更新。

## 27.2 Frustum
カメラが見る領域のみ高精細render。

## 27.3 Lens Metadata
- focal length
- focus
- iris
- distortion
- nodal offset

---

# PART 28 — VFX CAPTURE

撮影すべき素材:
- hero plate
- clean plate
- gray ball
- chrome ball
- Macbeth chart
- lens grid
- distortion chart
- HDRI
- reference stills
- lidar
- photogrammetry
- witness cameras

---

# PART 29 — CAMERA MOVEMENT GRAMMAR

## Pan
水平回転。

## Tilt
垂直回転。

## Pedestal
カメラ全体を上下。

## Truck
横移動。

## Dolly
前後。

## Arc
円弧。

## Orbit
被写体を中心に。

## Push-in
心理的集中。

## Pull-out
孤独・reveal。

## Whip Pan
transition / energy。

## Crash Zoom
retro / comedic / shock。

## Dolly Zoom
背景の遠近を変化。

## Dutch Roll
roll角。

## 360 Roll
music / action。

## Boom
crane vertical。

## Fly-through
空間通過。

## Macro Glide
商品面に沿う。

## Parallax
前景と背景速度差。

---

# PART 30 — CAMERA HEIGHT GRAMMAR

- floor: power / speed / product monumentality
- knee: dynamic fashion
- waist: natural
- chest: documentary
- eye: neutral
- above eye: vulnerability
- overhead: graphic
- top-down: layout / food / table
- worm's-eye: heroic
- bird's-eye: pattern

---

# PART 31 — COMPOSITION

- rule of thirds
- center symmetry
- golden ratio
- leading lines
- frame within frame
- negative space
- headroom
- look room
- foreground layering
- depth staging
- compression
- silhouette
- profile
- extreme close-up
- insert
- detail
- master
- two-shot
- over shoulder
- POV
- macro abstract

---

# PART 32 — SHOT SIZE

| code | shot |
|---|---|
| EWS | extreme wide |
| WS | wide |
| FS | full |
| MS | medium |
| MCU | medium close |
| CU | close |
| ECU | extreme close |
| INSERT | detail |

---

# PART 33 — COMMERCIAL EDITING GRAMMAR

15秒CM例:
```text
0.0–1.5 hook
1.5–4.0 context
4.0–7.0 feature
7.0–10.0 sensory payoff
10.0–12.5 hero
12.5–15.0 brand/end card
```

10秒:
```text
0–1 hook
1–3 product reveal
3–6 benefit
6–8 sensory hero
8–10 end card
```

5秒:
```text
0–0.7 immediate hook
0.7–2.5 sensory action
2.5–4.0 hero
4.0–5.0 logo/product
```

---

# PART 34 — SHOT RECIPE: HIGHBALL CM

```yaml
duration: 10
aspect: 9:16
camera:
  sensor: full_frame
  fps:
    main: 24
    sensory: 120
lens:
  wide: 35
  hero: 85
  macro: 100_macro
lighting:
  key: large_soft_side
  bottle_backlight: hard_daylight
  negative_fill: both_sides
effects:
  condensation: medium
  ice: clear_large
  carbonation: strong
shots:
  - time: 0-1
    type: ECU
    action: ice drops into glass
    fps: 120
  - time: 1-2.5
    type: macro
    action: whisky pour
  - time: 2.5-4
    type: macro
    action: soda hits ice, bubbles explode
  - time: 4-6
    type: CU
    camera_move: 15cm lateral slider
  - time: 6-8
    type: talent sip
  - time: 8-10
    type: product hero
```

Prompt phrase:
> camera skims past the condensation-covered glass at table height, 100mm macro, hard cool backlight catching carbonation, black negative fill cards defining the glass edges, 120fps slow motion, controlled specular highlights, shallow depth of field.

---

# PART 35 — SHOT RECIPE: LIPSTICK

1. macro lipstick texture
2. motorized rotation
3. light sweep
4. talent lip application
5. ECU glossy lip
6. product + color swatch
7. packshot

Lighting:
- large frontal beauty source
- thin strip edge
- small hard reflection accent
- glossy black/acrylic platform

---

# PART 36 — SHOT RECIPE: SKINCARE

Need:
- glass skin
- serum macro
- pipette
- water caustic
- translucent bottle

Avoid:
- excessive diffusion that destroys texture
- uncontrolled forehead clipping

---

# PART 37 — SHOT RECIPE: SNEAKER

Possible visual modes:

### Studio Technical
- hard top
- edge strip
- turntable
- macro materials

### Street Energy
- 16–24mm
- low camera
- handheld / FPV
- speed ramp

### Floating Product
- wire rig
- robot move
- compositing

---

# PART 38 — SHOT RECIPE: CAR

Exterior:
- polarizer
- large reflection sources
- magic hour
- tracking vehicle
- drone
- stabilized remote head

Studio:
- giant overhead softbox
- long strip reflections
- turntable
- blackout

Detail:
- 85–135mm
- macro
- controlled moving highlights

---

# PART 39 — SHOT RECIPE: WATCH

- macro 100mm+
- focus rail
- small hard pin sources
- large diffusion reflection
- black flags
- turntable
- 24/48/60fps
- cross-polarization experiment
- focus stacking for still

---

# PART 40 — SHOT RECIPE: FOOD CHICKEN

- 50/85 macro-ish
- warm hard side key through diffusion
- dark negative fill
- controlled oil sheen
- steam backlight
- crumb fall 120fps
- break-open pull
- hero plate

---

# PART 41 — SHOT RECIPE: FASHION DRESS IN WIND

- 35mm moving full body
- 85mm fabric detail
- fan 45° rear
- 60/120fps inserts
- back/side sunlight
- orbit / half-circle
- spin action
- close smile
- hem flutter macro

---

# PART 42 — SOUND-AWARE SHOOTING

撮影指示書には音も含める。

- cloth flutter
- ice clink
- carbonation fizz
- cap click
- spray
- footsteps
- shutter
- servo
- drone noise (usually remove)
- ambient room tone

Seedance等への指示:
`sync the ice impact with a crisp high-frequency clink and the cut`.

---

# PART 43 — GRIP EQUIPMENT TAXONOMY

## Stands
- C-stand
- baby stand
- combo stand
- junior stand
- low-boy
- wind-up
- crank stand
- roller stand
- menace arm
- boom

## Rigging
- cardellini
- mafer
- super clamp
- cheeseboro
- speed rail
- magic arm
- articulating arm
- grip head
- gobo arm
- suction cup
- wall spreader
- autopole
- truss
- pipe grid

## Safety
- sandbag
- shotbag
- safety cable
- ratchet strap
- ballast
- guy wire

---

# PART 44 — ELECTRICAL

- household circuits
- distro
- three phase
- generator
- battery block
- V-mount
- Gold mount
- B-mount
- USB-C PD
- inverter

System must calculate:
```text
current_A ≈ power_W / voltage_V
```

そして余裕率・同時負荷・突入電流・地域電圧を考慮。

高出力照明は専門電源担当者を前提とする。

---

# PART 45 — COLOR TEMPERATURE

Approx:
- candle: 1800K
- tungsten: 2800–3200K
- warm LED: 2700K
- neutral: 4000K
- daylight: 5600K
- overcast: 6500K+
- blue hour: strongly blue ambient

Camera WBとlight CCTの差が色味を作る。

例:
WB 4300K + 5600K key → 少しcool
WB 5600K + 3200K practical → warm practical

---

# PART 46 — LIGHT METRICS

### CRI
一般的演色。

### TLCI
camera向け。

### SSI
スペクトル類似度。

### TM-30
fidelity / gamut。

**プロダクト推薦ではCRI単独ではなく、SSI / TLCI / spectral dataがあれば優先。**

---

# PART 47 — FLICKER

原因:
- PWM
- mains frequency
- discharge lamp
- LED driver
- dimming
- electronic signage

リスク:
- high speed
- short shutter
- rolling shutter

DB:
```yaml
flicker:
  tested_fps: []
  pwm_frequency_hz:
  safe_shutter_ranges: []
```

---

# PART 48 — STUDIO SPACE MODEL

```yaml
studio:
  width_m:
  depth_m:
  height_m:
  grid_height_m:
  cyc:
    width_m:
    curve_radius_m:
  power:
    voltage:
    circuits:
    max_kw:
  access:
    door_width_m:
    loading:
  soundproof:
  blackout:
  rigging_points:
  floor_load:
```

これにより「大型craneが置けない」「12×12 diffusionが張れない」を判定。

---

# PART 49 — OUTDOOR MODEL

```yaml
outdoor:
  coordinates:
  sun_azimuth:
  sun_altitude:
  sunrise:
  sunset:
  wind:
  weather:
  shadow_direction:
  terrain:
  power_access:
  vehicle_access:
  public_control:
  drone_airspace:
```

---

# PART 50 — SUN AS A LIGHT

太陽は非常に遠い小さな光源 → hard。

曇り:
空全体がsoft source。

Golden hour:
- low angle
- warm
- long shadows

Backlit人物:
- sun as rim
- bounce/LED fill
- expose for highlights

---

# PART 51 — NIGHT EXTERIOR

レイヤー:
1. moon motivation
2. street practical
3. signage
4. wet down
5. haze
6. eye light
7. edge separation

wet down:
路面reflectionを増やす。

---

# PART 52 — PRACTICAL LIGHTS

- lamp
- neon
- LED strip
- monitor
- phone
- candle
- headlight
- streetlight
- vending machine
- shop sign

Motivated lightingとして使う。

---

# PART 53 — IMAGE-TO-LIGHT REASONING

ユーザーがreference imageを入れた場合:

AI推定項目:
```yaml
estimated:
  key_direction_deg:
  key_elevation_deg:
  softness:
  fill_ratio:
  rim_presence:
  background_level:
  practical_sources:
  lens_focal_class:
  camera_height:
  dof:
  shutter_feel:
  camera_motion:
  filtration:
  atmosphere:
```

その後、機材へmapping。

---

# PART 54 — EQUIPMENT SELECTION LOGIC

例:

```python
if shot.requires_high_speed and fps > 500:
    camera.capability.high_speed >= fps
    light.flicker_free_at >= fps
    require_high_output = True

if subject.material == "glass":
    recommend("backlight")
    recommend("large_diffusion")
    recommend("negative_fill")
    recommend("polarizer_test")

if subject.category == "beauty":
    recommend_focal_range(65, 135)
    recommend("large_soft_frontal")
    recommend("eye_light")

if camera_move == "repeatable_macro":
    recommend("motion_control_robot")

if location == "interior_narrow" and move == "fly_through":
    recommend("cinewhoop")
```

---

# PART 55 — MATERIAL SHADER / REAL-WORLD LIGHTING MODEL

商品属性:

```yaml
material:
  roughness: 0-1
  metallic: 0-1
  transmission: 0-1
  ior:
  subsurface:
  clearcoat:
  anisotropy:
  color:
```

撮影への変換:

### roughness low
鏡面 → 大きなreflection sourceを設計。

### roughness high
diffuse → hard lightでtextureを出せる。

### metallic high
周囲の映り込みが主体。

### transmission high
backlight重要。

---

# PART 56 — AUTOMATIC “SHOULD I ADD DROPLETS?” ENGINE

```text
IF category in [beer, soft_drink, water, highball, sports_drink]
AND message in [cold, fresh, summer, refreshing]
THEN condensation_score += 0.8

IF category in [wine_red, premium_spirit]
AND message in [heritage, luxury, warm]
THEN condensation_score -= 0.7

IF environment == "winter_outdoor"
THEN condensation may contradict scene continuity.
```

出力:
- yes/no
- density
- droplet size
- reason
- related lighting changes

---

# PART 57 — AUTOMATIC SHOT GENERATOR

Input:
```yaml
product: canned_highball
duration: 10
platform: vertical_social
message: refreshing
talent: male_30s
location: outdoor_terrace
season: early_summer
```

Engine:
1. derive visual attributes
2. choose hero shot
3. choose sensory inserts
4. choose human payoff
5. fit timing
6. choose camera grammar
7. choose equipment
8. choose lighting
9. choose SFX
10. generate output

---

# PART 58 — SHOT OBJECT SCHEMA

```json
{
  "id": "S03",
  "time": {"start": 2.3, "end": 3.8},
  "intent": "show extreme cold refreshment",
  "subject": "highball glass",
  "shot_size": "ECU",
  "camera": {
    "height_cm": 8,
    "distance_cm": 35,
    "yaw_deg": -15,
    "pitch_deg": 2,
    "roll_deg": 0,
    "sensor": "full_frame",
    "fps": 120,
    "shutter_angle": 180,
    "iso": 800,
    "wb_k": 5200
  },
  "lens": {
    "type": "macro",
    "focal_mm": 100,
    "t_stop": 4
  },
  "motion": {
    "type": "slider",
    "distance_cm": 18,
    "direction": "left_to_right",
    "easing": "ease_in_out"
  },
  "lighting": [
    {
      "role": "backlight",
      "fixture_class": "high_output_led",
      "position": {"azimuth_deg": 150, "elevation_deg": 20},
      "modifier": "fresnel_30deg"
    }
  ],
  "effects": {
    "condensation": 0.8,
    "carbonation": 0.9
  }
}
```

---

# PART 59 — LIGHT OBJECT SCHEMA

```json
{
  "id": "L_KEY",
  "role": "key",
  "fixture_class": "cob_led_1200w",
  "brand_model": null,
  "position_m": [2.2, 1.4, 2.6],
  "target_m": [0, 0, 1.3],
  "cct_k": 5600,
  "intensity_percent": 62,
  "beam_deg": 45,
  "modifier": {
    "type": "diffusion_frame",
    "size_ft": "8x8",
    "fabric": "half_grid"
  }
}
```

---

# PART 60 — CAMERA PLACEMENT UI

必須表示:
- top view
- side view
- camera frustum
- focal length
- subject distance
- focus plane
- DOF near/far
- light cone
- shadow direction
- sun path
- drone path
- dolly track
- robot arm envelope

---

# PART 61 — LIGHTING DIAGRAM OUTPUT

PDFには最低限:

```text
PROJECT
SCENE
SHOT ID
TOP VIEW
SIDE VIEW

C1 camera
S subject
K key
F fill
R rim
B background
N negative fill
D diffusion
FL flag
```

例:
```text
               R
               \
        DDDD    S      NNN
 K ---> DDDD   [P]     NNN
                |
                |
               C1
```

---

# PART 62 — STORYBOARD OUTPUT

各コマ:
1. frame image
2. timecode
3. shot size
4. lens
5. camera coordinates
6. movement arrow
7. fps
8. shutter
9. lighting summary
10. action
11. VO
12. SFX
13. transition
14. generation prompt

---

# PART 63 — SEEDANCE PROMPT COMPILER

生成順を固定する。

```text
[FORMAT]
[REFERENCE CONSISTENCY]
[SUBJECT]
[ENVIRONMENT]
[LIGHTING]
[CAMERA BODY FEEL]
[LENS]
[CAMERA POSITION]
[CAMERA MOVEMENT]
[SUBJECT ACTION]
[PHYSICS / MATERIAL]
[FRAME RATE / SHUTTER FEEL]
[DEPTH OF FIELD]
[COLOR]
[EDIT]
[SFX / VO]
[NEGATIVE CONSTRAINTS]
```

---

## 63.1 Seedance用詳細例

```text
Create a 10-second vertical 9:16 premium highball commercial.

Maintain the same male talent, wardrobe, glass design and terrace location across all shots.

Scene: a quiet early-summer outdoor terrace in Japan during late afternoon, soft green foliage in the background, gentle breeze.

Lighting: the talent is shaped with a large soft daylight key from camera-left at approximately 45 degrees and 20 degrees above eye level. Use subtle negative fill on camera-right. The highball glass receives a narrow hard backlight from behind-right so that the ice edges, carbonation and condensation sparkle. Keep the label readable with a separate low-intensity frontal soft source.

Shot 1, 0.0–1.2s: extreme close-up, 100mm macro look, 120fps slow motion. A clear cube of ice falls into the glass. Camera is only 7cm above table level. Very shallow depth of field. Crisp specular highlights.

Shot 2, 1.2–2.8s: 85mm macro close-up. Whisky pours over the ice; camera makes a controlled 15cm lateral slider move left-to-right.

Shot 3, 2.8–4.5s: 100mm macro. Soda hits the ice and fine bubbles explode upward. Condensation droplets remain sharp and physically realistic.

Shot 4, 4.5–6.8s: 35mm medium shot. The man lifts the glass, foliage moving gently in the breeze. Slow subtle dolly-in.

Shot 5, 6.8–8.4s: 85mm close-up. He takes one refreshing sip and gives a restrained satisfied expression.

Shot 6, 8.4–10.0s: product hero on table. Camera performs a 20-degree arc move while the backlight creates a clean edge around the glass. End with the glass centered and negative space above for typography.

Avoid floating objects, warped glass geometry, duplicate fingers, inconsistent liquid level, random camera shake, excessive lens flare or unrealistically large droplets.
```

---

# PART 64 — PROMPT VOCABULARY: CAMERA

使える表現:

- locked-off tripod
- slow controlled dolly-in
- 20cm lateral slider
- handheld with subtle shoulder inertia
- Steadicam walk-and-talk
- low-angle gimbal tracking
- stabilized remote head
- telescopic crane descend
- 180-degree orbit
- macro tabletop glide
- FPV dive
- drone top-down
- parallax truck
- rack focus
- whip pan transition
- snap zoom
- dolly zoom
- 360 roll

曖昧な:
`cinematic camera movement`
だけで済ませない。

---

# PART 65 — PROMPT VOCABULARY: LIGHT

曖昧:
`beautiful lighting`

詳細:
`a 2-meter-wide diffused source 45 degrees camera-left, slightly above eye line, with a black negative fill card on camera-right and a narrow hard rim from behind`.

---

# PART 66 — PROMPT VOCABULARY: MATERIAL

Glass:
- controlled vertical strip reflections
- clean black edge definition
- refracted highlights
- realistic caustics

Metal:
- long gradient reflection
- sharp specular edge
- brushed anisotropic texture

Skin:
- hydrated specular highlights
- visible natural pores
- no plastic smoothing

Fabric:
- fine weave
- backlit translucence
- wind-driven folds

---

# PART 67 — NEGATIVE PROMPT / QA

チェック:
- hands
- labels
- logo
- object geometry
- reflection continuity
- liquid level
- ice count
- shadow direction
- sun direction
- wardrobe
- focal character
- camera side / 180° rule
- screen text
- product cap
- earrings/accessories
- background extras

---

# PART 68 — CONTINUITY ENGINE

```yaml
continuity:
  talent_id:
  wardrobe_id:
  hair_state:
  prop_ids:
  liquid_level:
  ice_state:
  condensation_state:
  time_of_day:
  sun_direction:
  screen_content:
  product_orientation:
```

---

# PART 69 — 180 DEGREE RULE

会話・複数人物でaxisを定義。

UIでline of actionを赤線表示。
camera候補が反対側へ行く場合警告。

---

# PART 70 — VFX ENGINE CONNECTION

仮想スタジオから後段へ渡す:

```yaml
vfx:
  clean_plate: true
  tracking_markers:
  lens_grid:
  hdr:
  chrome_ball:
  gray_ball:
  lidar:
  camera_tracking:
  object_tracking:
  roto_complexity:
  screen_replacement:
  wire_removal:
  cg_product:
```

---

# PART 71 — GENERATIVE VFX

生成AI利用:
- background extension
- weather
- crowd
- set extension
- particles
- cleanup
- previz

ただし実写との整合:
- camera intrinsics
- perspective
- light direction
- shadow
- depth
- motion blur
を維持。

---

# PART 72 — PREVIS / TECHVIS

### Previs
完成イメージを先に見る。

### Techvis
「物理的にどう撮るか」。

Techvis出力:
- camera coordinate
- crane reach
- lens
- height
- track length
- lighting positions
- set dimensions

このプロダクトは**Previs + Techvis + Prompt Engineering**を統合するものと考える。

---

# PART 73 — PRODUCT ARCHITECTURE

```text
USER INPUT
   ↓
Intent Parser
   ↓
Visual Director
   ↓
Shot Designer
   ↓
Camera/Lens Solver
   ↓
Lighting Solver
   ↓
Grip/Motion Solver
   ↓
SFX/Atmosphere Solver
   ↓
Feasibility/Safety
   ↓
3D Virtual Studio
   ↓
Render / Image Preview
   ↓
Prompt Compiler
   ↓
PDF / Storyboard / JSON / Seedance
```

---

# PART 74 — KNOWLEDGE GRAPH

Nodes:
- Subject
- Material
- Emotion
- Shot
- Camera
- Lens
- Filter
- Light
- Modifier
- Grip
- Motion
- VFX
- Weather
- Drone
- Set
- Sound

Edges:
```text
Subject --benefits_from--> LightingTechnique
Material --requires_control_of--> Reflection
Shot --requires--> LensCapability
Motion --requires--> GripEquipment
FPS --requires--> FlickerFreeLight
Drone --limited_by--> Payload
Studio --limits--> Crane
```

---

# PART 75 — EQUIPMENT DB SCHEMA

```yaml
equipment:
  id:
  manufacturer:
  model:
  category:
  subcategory:
  release_status:
  rental_availability:
  purchase_region:
  price_class:
  physical:
    width_mm:
    height_mm:
    depth_mm:
    weight_kg:
  power:
  environment:
  capabilities:
  compatible_with:
  ideal_use_cases:
  avoid_when:
  safety:
  source_urls:
  last_verified:
```

---

# PART 76 — CAMERA DB EXTENSION

```yaml
camera_capabilities:
  sensor_width_mm:
  sensor_height_mm:
  dynamic_range_stops:
  base_iso: []
  max_resolution:
  open_gate:
  global_shutter:
  rolling_shutter_ms:
  max_fps_by_resolution:
  codecs: []
  raw: []
  lens_mounts: []
  internal_nd:
  genlock:
  timecode:
  sync:
  weight:
```

---

# PART 77 — LENS DB EXTENSION

```yaml
lens:
  focal_min:
  focal_max:
  prime:
  t_stop:
  close_focus_m:
  max_magnification:
  image_circle_mm:
  mount:
  front_diameter_mm:
  weight_kg:
  breathing_score:
  distortion_score:
  flare_character:
  bokeh_character:
  vintage_score:
  sharpness_score:
  anamorphic_squeeze:
```

---

# PART 78 — LIGHT DB EXTENSION

```yaml
light:
  source_type:
  output_lux_by_distance:
  beam_angle:
  cct_range:
  green_magenta:
  rgb:
  spectral:
  pixel:
  cri:
  tlci:
  ssi:
  dimming_min:
  max_power_w:
  weather:
  flicker:
  controls:
  modifiers:
```

---

# PART 79 — DRONE DB EXTENSION

```yaml
drone:
  empty_weight:
  mtow:
  max_payload:
  flight_time:
  wind_resistance:
  max_speed:
  camera_integrated:
  gimbal:
  fpv:
  rtk:
  waypoint_repeatability:
  obstacle_detection:
  transmission:
  legal_class:
```

---

# PART 80 — TECHNIQUE DB SCHEMA

```yaml
technique:
  id: bottle_backlight
  objective:
  compatible_subjects:
  required_capabilities:
  equipment_classes:
  placement_rules:
  camera_rules:
  exposure_rules:
  common_failures:
  troubleshooting:
  example_prompts:
```

---

# PART 81 — RECOMMENDATION SCORING

例:

```text
score =
  intent_match * 0.25 +
  image_match * 0.20 +
  capability * 0.20 +
  spatial_feasibility * 0.10 +
  budget_fit * 0.10 +
  workflow_fit * 0.05 +
  availability * 0.05 +
  safety * 0.05
```

---

# PART 82 — BUDGET TIERS

### Tier A — Creator
mirrorless + compact LED + small gimbal

### Tier B — Commercial Lite
cinema camera + cinema zoom/prime + COB lighting + dolly

### Tier C — Commercial
ARRI/RED/Sony class + grip crew + large sources + specialty lens

### Tier D — Premium
motion control + telescopic crane + high-speed + drone + VFX

### Tier E — Feature / Virtual Production
LED volume + tracking + full cinema package + advanced VFX

同じ画を異なるtierで近似する代替提案を出す。

---

# PART 83 — CREW ROLES

- Director
- DP / Cinematographer
- Camera Operator
- 1st AC
- 2nd AC
- DIT
- Gaffer
- Best Boy Electric
- Electric
- Key Grip
- Best Boy Grip
- Dolly Grip
- Drone Pilot
- Gimbal Operator
- Motion Control Operator
- VFX Supervisor
- Virtual Production Supervisor
- Data Wrangler
- Photographer
- Digital Tech
- Retoucher
- Food Stylist
- Product Stylist
- Prop Stylist

UIで機材だけでなく必要crewも推奨する。

---

# PART 84 — ON-SET DATA

- checksum copy
- 3-2-1 backup
- camera report
- lens metadata
- LUT
- CDL
- timecode
- sound sync
- slate
- proxy

---

# PART 85 — COLOR PIPELINE

- log
- raw
- IDT
- ACES
- scene-referred
- display transform
- LUT
- CDL
- HDR
- SDR trim

Prompt-only AIでも「low contrast log-like source → filmic grade」等を表現属性化。

---

# PART 86 — MONITORING

- waveform
- false color
- zebra
- histogram
- vectorscope
- focus peaking
- exposure index
- LUT monitoring

---

# PART 87 — FOCUS

## Manual Pull
marks:
A/B/C。

## AF
face/eye/subject tracking。

## Rack Focus
視線誘導。

## Deep Focus
複数面。

## Hyperfocal
documentary / landscape。

---

# PART 88 — DEPTH OF FIELD ENGINE

入力:
- sensor
- focal
- aperture
- focus distance
- CoC

出力:
- near limit
- far limit
- total DOF
- hyperfocal

UIで被写界深度を3D帯として表示。

---

# PART 89 — FIELD OF VIEW ENGINE

sensor widthとfocal lengthからhorizontal FOV。

```text
FOV = 2 * atan(sensor_dimension / (2*focal_length))
```

---

# PART 90 — MOTION BLUR ENGINE

frame rate + shutter angle → exposure duration。

UIでghost previewを出す。

---

# PART 91 — SUN ENGINE

日時・緯度経度から:
- azimuth
- elevation
- golden hour
- blue hour
- shadow vector

Outdoor previzに必須。

---

# PART 92 — LIGHT FALL-OFF

Inverse-square approximation:
```text
E ∝ 1 / d²
```

ただし大型面光源・近距離では単純点光源モデルから外れる。

---

# PART 93 — CONTRAST RATIO

key/fillのstop差。

- 1:1 flat
- 2:1 subtle
- 4:1 cinematic
- 8:1 dramatic
- 16:1 high contrast

表示はlux比とstop差の両方。

---

# PART 94 — PRODUCT REFLECTION SIMULATOR

UIで白/黒カードを動かすと、
- highlight width
- edge darkness
- gradient
が変化するpreview。

これはプロダクトの中核機能になり得る。

---

# PART 95 — AUTOMATIC LIGHTING FROM PRODUCT MATERIAL

### Glass
back / edge / transmission.

### Chrome
environment reflection design.

### Matte Plastic
soft + harder texture accent.

### Fabric
raking light.

### Translucent
backlight.

### Pearl / iridescent
moving source / angle variation.

### Holographic
narrow hard source + movement.

---

# PART 96 — “CUT IMAGE” GENERATOR

各shotを静止画生成する際、生成用descriptionも出力。

```yaml
frame_prompt:
composition:
lens:
camera_angle:
lighting:
materials:
action_moment:
background:
text_safe_area:
continuity:
```

---

# PART 97 — PDF EXPORT SPEC

ページ:
1. Cover
2. Creative intent
3. Visual references
4. Overall lighting
5. Studio top view
6. Studio side view
7. Equipment list
8. Shot list
9. Storyboards
10. Detailed shot cards
11. Drone map
12. VFX notes
13. Safety
14. Prompt appendix
15. JSON appendix

---

# PART 98 — SVG / DIAGRAM EXPORT

SVGで:
- camera icon
- subject
- light cone
- light label
- diffusion
- negative fill
- track
- drone path

を生成すればPDF/PNG両対応しやすい。

---

# PART 99 — CLAUDE CODE DIRECTORY PROPOSAL

```text
/knowledge
  /camera
    camera-taxonomy.md
    cameras.json
  /lens
    lens-taxonomy.md
    lenses.json
  /lighting
    lighting-techniques.md
    fixtures.json
    modifiers.json
  /grip
    grip.md
  /drone
    drones.json
    aerial-techniques.md
  /effects
    atmosphere.md
    liquids.md
    wind.md
  /subjects
    beverages.md
    cosmetics.md
    fashion.md
    food.md
    automotive.md
  /shots
    camera-movement.md
    shot-recipes.json
  /vfx
    virtual-production.md
  /prompts
    seedance.md
    prompt-compiler.md
  /schemas
    shot.schema.json
    equipment.schema.json
    scene.schema.json
```

---

# PART 100 — MVP

MVPでは全機材を3Dモデル化しない。

### Phase 1
- 30 camera classes
- 50 lens classes
- 50 light classes
- 30 modifier classes
- 20 grip/motion classes
- 15 drone classes
- 100 techniques
- 50 subject recipes

### Phase 2
- real SKU
- 3D footprints
- photometric data
- lens simulation
- sun/weather
- PDF

### Phase 3
- image analysis
- reference reconstruction
- generative storyboard
- VFX prep
- rental inventory integration

### Phase 4
- physics / ray-tracing
- interactive lighting
- virtual production
- on-set control/DMX export

---

# PART 101 — PRIORITY SPECIAL EQUIPMENT TO INCLUDE

特殊なものを落とさないためのチェックリスト:

### Camera
- ultra-high-speed Phantom
- Ember
- thermal
- IR
- UV
- stereo VR
- 360
- volumetric array
- microscope
- underwater

### Lens
- probe
- periscope
- anamorphic
- fisheye
- tilt-shift
- macro 2×+
- split diopter
- relay
- vintage rehoused

### Movement
- Bolt robot
- Milo
- telescopic crane
- stabilized head
- Trinity
- Steadicam
- AGITO
- cablecam
- Spidercam
- process trailer
- pursuit vehicle
- FPV
- heavy-lift drone

### Lighting
- 2.5kW+ LED
- HMI
- tungsten
- xenon
- balloon light
- crane-mounted lighting
- image-based LED
- pixel tube
- projector
- laser
- moving head
- strobes
- high-speed flicker-free

### Effects
- rain tower
- snow machine
- haze
- fog
- dry ice
- wind machine
- drop controller
- splash rig
- air cannon
- turntable
- motion-control liquid

---

# PART 102 — TROUBLESHOOTING KNOWLEDGE

### Glass edges disappear
- add black card
- change background brightness
- narrow edge source

### Bottle label too dark
- separate label fill
- reduce polarizer
- rotate product

### Face flat
- reduce fill
- add negative fill
- move key sideways

### Skin too shiny
- larger source
- powder
- adjust angle
- CPL cautiously

### Food steam invisible
- darker background
- stronger backlight

### High speed flickers
- use verified flicker-free source
- change dim level
- change frame/shutter
- test mains interactions

### Drone image feels flat
- lower altitude
- stronger foreground
- side light
- orbit/parallax
- longer lens where platform allows

### AI video camera movement feels random
- specify start/end coordinates
- movement distance
- duration
- easing
- keep only one main camera move per short shot

---

# PART 103 — “DIRECTOR MODE” QUESTIONS

ユーザー入力UI:

1. 何を撮るか
2. 何を伝えるか
3. 視聴者
4. 媒体
5. 秒数
6. 画角
7. 人物有無
8. location
9. time/weather
10. reference
11. budget
12. realism
13. generation vs real shoot

ここから詳細は自動推論。

---

# PART 104 — OUTPUT MODES

### Real Shoot
実機型番、crew、power、safetyまで。

### AI Video
物理撮影指示を自然言語へ。

### Hybrid
実写plate + AI/VFX。

### Still
flash、focus stacking、tetheringを追加。

### Virtual Production
LED / tracking / render pipelineを追加。

---

# PART 105 — STILL-SPECIFIC MODULE

- tethered capture
- Capture One
- focus stacking
- exposure bracketing
- multi-shot
- polarization
- flash duration
- leaf shutter sync
- color target
- product turntable
- pixel shift
- medium format

---

# PART 106 — COMPARISON: VIDEO VS STILL LIGHTING

Still:
- flash power
- motion freeze
- single perfect frame
- focus stack可

Video:
- continuous light
- flicker
- heat
- motion continuity
- high frame rate exposure

Product UIは`capture_mode`で機材推薦を分岐。

---

# PART 107 — AUTOMATIC ALTERNATIVES

例:
「Bolt robot unavailable」

代替:
1. motorized slider + pan head
2. gimbal + programmed move
3. CG camera
4. Seedance simulation

どの品質差が出るかも提示。

---

# PART 108 — SOURCE / VERIFICATION POLICY

機材情報は以下優先:
1. manufacturer official
2. manual
3. datasheet
4. rental house technical page
5. reputable cinematography publication
6. community reports

DBには必ず:
```yaml
source_url:
verified_date:
confidence:
```

---

# PART 109 — CURRENT REPRESENTATIVE OFFICIAL REFERENCES

2026-08時点の設計参考として確認した一次情報例。

- ARRI ALEXA 35 / Xtreme  
  https://www.arri.com/en/camera-systems/cameras/alexa-35
- ARRI Orbiter  
  https://www.arri.com/en/lighting/led-spotlights/orbiter/tech-specs
- ARRI TRINITY 2 / ARTEMIS 2  
  https://www.arri.com/en/camera-systems/camera-stabilizer-systems/trinity-2-and-artemis-2
- ARRI 360 EVO  
  https://www.arri.com/en/camera-systems/camera-stabilizer-systems/360-evo
- Blackmagic URSA Cine 12K LF  
  https://www.blackmagicdesign.com/jp/products/blackmagicursacine/techspecs
- Canon EOS C400  
  https://www.usa.canon.com/support/p/eos-c400
- DJI Inspire 3  
  https://www.dji.com/inspire-3/specs
- DJI Avata 2  
  https://www.dji.com/avata-2/specs
- Freefly Alta X  
  https://freeflysystems.com/alta-x/specs
- Freefly Ember S5K  
  https://freeflysystems.com/ember-s5k
- Vision Research Phantom TMX 7510  
  https://www.phantomhighspeed.com/products/cameras/tmx/7510
- Aputure Electro Storm XT26  
  https://aputure.com/EN-US/products/electro-storm-xt26
- Kino Flo MIMIK 120  
  https://kinoflo.com/mimik-120/
- Hasselblad X2D II 100C  
  https://www.hasselblad.com/x-system/x2d-ii-100c
- Canon RF 5.2mm F2.8 L Dual Fisheye  
  https://www.usa.canon.com/support/p/rf5-2mm-f2-8-l-dual-fisheye
- Motion Impossible AGITO  
  https://motion-impossible.com/
- Chapman/Leonard Hydrascope  
  https://www.chapman-leonard.com/products/cranes/
- Profoto Pro-D3  
  https://www.profoto.com/us/en/still-photography/experience/profoto-pro-D3/

---

# PART 110 — NEXT DATASETS TO BUILD

本MDから分離して作るべきデータセット:

```text
01_cameras_master.json
02_lenses_master.json
03_lights_master.json
04_modifiers_master.json
05_grip_master.json
06_motion_control_master.json
07_drones_master.json
08_special_imaging_master.json
09_effects_master.json
10_material_rules.json
11_subject_recipes.json
12_shot_grammar.json
13_prompt_phrases.json
14_failure_modes.json
15_safety_rules.json
```

---

# PART 111 — 最重要設計思想

このプロダクトの価値は「ARRIを選べる3Dスタジオ」ではない。

本質は、

```text
ユーザーの曖昧なイメージ
↓
撮影監督レベルの視覚意図
↓
物理的な撮影設計
↓
カメラ・レンズ・照明・Grip・VFXの配置
↓
撮れる画の予測
↓
AI動画生成モデルが理解できる詳細指示
```

へ翻訳する**Cinematography Reasoning Engine**である。

特に生成AI動画では、
- 35mmなのか100mm macroなのか
- camera heightが何cmなのか
- key lightが左右どちらなのか
- hardなのかsoftなのか
- backlightが何を拾うのか
- dollyが何cm動くのか
- fps / motion blurがどう見えるのか
- glass / skin / metalの反射がどうなるか

まで明示すると、単なる「cinematic」「beautiful commercial」より再現性の高いディレクションが可能になる。

---

# APPENDIX A — EQUIPMENT CATEGORY MASTER LIST

## Cameras
Cinema / Broadcast / ENG / Mirrorless / DSLR / Medium Format / Large Format Digital / High Speed / Global Shutter / Action / POV / FPV / 360 / VR180 / Stereo / Underwater / Thermal / IR / UV / Multispectral / Hyperspectral / Scientific / Machine Vision / Microscope / Endoscope / Body / Crash / Remote / Volumetric.

## Lenses
Prime / Zoom / Servo / Broadcast Box / Macro / Probe / Periscope / Snorkel / Relay / Tilt Shift / Fisheye / Rectilinear Ultra-Wide / Telephoto / Supertele / Anamorphic / Vintage / Rehoused / Soft / Petzval / Mirror / Split Diopter / Diopter / Close-up / Stereo / VR.

## Lighting
Tungsten / HMI / LED COB / Fresnel / Open Face / PAR / Panel / RGBWW / Tube / Flex Mat / Balloon / Space Light / Softbox / Lantern / Projector / Ellipsoidal / Practical / Pixel / Image-based / LED Volume / Strobe / Pack & Head / Speedlight / Ring / Beauty Dish / Laser / Moving Head / Xenon / UV / IR.

## Modifier
Diffusion / Bounce / Reflector / Flag / Cutter / Solid / Net / Scrim / Grid / Eggcrate / Snoot / Barn Door / Fresnel Lens / Spotlight / Gobo / Cookie / Mirror / Beadboard / Poly / Muslin / Velvet / Polarizing Film.

## Grip
C-Stand / Combo / Baby / Junior / Crank / Roller / Boom / Menace Arm / Clamp / Cardellini / Mafer / Super Clamp / Speed Rail / Truss / Wall Spreader / Suction / Rigging / Sandbag / Safety Cable.

## Camera Movement
Tripod / Fluid / Geared / Slider / Dolly / Track / Jib / Crane / Telescopic Crane / Remote Head / Steadicam / Trinity / Gimbal / Handheld / Shoulder / Easyrig / Motion Robot / Robotic Dolly / Cablecam / Spidercam / Vehicle Arm / Suction Rig / Drone / FPV / Helicopter.

## Effects
Haze / Fog / Smoke / Steam / Dry Ice / Rain / Snow / Wind / Dust / Powder / Splash / Droplets / Bubbles / Fire / Sparks / Confetti / Leaves / Fabric / Projection / Caustics / Water tank / Rotating rig.

---

# APPENDIX B — SHOT TAG MASTER

```text
premium
beauty
clean
clinical
organic
luxury
retro
documentary
handheld
energetic
fresh
cold
warm
nostalgic
dreamy
surreal
technical
macro
sensory
tactile
glossy
matte
high_contrast
low_contrast
soft_daylight
hard_sun
neon
golden_hour
blue_hour
night
wet
hazy
high_speed
fpv
drone
motion_control
one_take
```

---

# APPENDIX C — SAFETY

この知識ベースはprevisualizationおよび撮影設計用。

実撮影では以下は資格・専門crew・現地法規・施設許可を優先する。

- high voltage / large power distro
- cranes
- heavy rigging
- overhead loads
- vehicle rigs
- drones
- pyrotechnics
- lasers
- water + electricity
- underwater
- high-pressure systems
- public roads
- working at height
- weapons/ballistics
- aircraft
- minors
- animals

AIは「可能な画」と「誰でも安全に実行できる作業」を混同してはならない。

---

# APPENDIX D — VERSIONING

```yaml
document:
  version: 1.0
  date: 2026-08-09
  purpose: master cinematography ontology and product architecture
  recommended_update_cycle: quarterly
```

今後は機材SKUをこの親ontologyへ紐づけることで、数千・数万件へ拡張可能。

# V2 Ultra-Detailed Extension

## 112. Virtual Studio Coordinate System

仮想スタジオではすべての配置を曖昧な「斜め45度」ではなく、XYZ座標＋回転で保持する。

```yaml
world:
  +X: subject_right
  -X: subject_left
  +Y: behind_subject
  -Y: camera_side
  +Z: up
subject_origin_m: [0,0,0]
```

人物の場合は足元中心を原点とし、目線高を1.55〜1.80m程度の実測値として別保持する。卓上商品は天板をZ=0とし、商品中心を原点にする。

### Camera transform
```yaml
camera:
  position_m: [0,-3.2,1.55]
  target_m: [0,0,1.52]
  rotation_deg: {yaw: 0, pitch: -0.5, roll: 0}
```

### Light transform
```yaml
light:
  position_m: [-1.6,-1.2,2.4]
  target_m: [0,0,1.45]
  source_size_m: [1.8,1.8]
```

## 113. Angular Lighting Notation

被写体からカメラ方向を0°、真後ろを180°、被写体右を+90°、左を-90°とする。

- soft portrait key: azimuth -30〜-60° / elevation 15〜35°
- beauty frontal: -20〜+20° / elevation 15〜30°
- side light: ±90°
- rim: 120〜160°
- full backlight: 180°

この角度表記はSeedance等の自然言語へ変換するときにも利用する。

## 114. Apparent Source Size

光の柔らかさはライトの商品名より「被写体から見た光源の見かけサイズ」で考える。

```text
apparent_size_ratio ≈ source_width / source_to_subject_distance
```

目安:
- >1.0 very soft
- 0.5–1.0 soft
- 0.2–0.5 medium
- <0.2 hard-ish

同じ90cm softboxでも0.6mなら非常に柔らかく、4m離せば相対的に硬くなる。

## 115. Human Lighting Presets

### Soft Commercial Portrait
```yaml
camera:
  lens_mm: 85
  position_m: [0,-3.0,1.60]
key:
  position_m: [-1.4,-1.4,2.25]
  source_size_m: [1.5,1.5]
negative_fill:
  position_m: [0.75,-0.25,1.45]
  size_m: [1.2,2.0]
eye_light:
  position_m: [0,-1.0,1.72]
  level_vs_key_stops: -2.5
```

狙いは頬にゆるいグラデーション、反対側の輪郭保持、自然なキャッチライト。

### High-End Beauty
```yaml
camera:
  lens_mm: 100
  distance_m: 1.8-2.3
  t_stop: 2.8-4.0
key:
  source_size_m: [2.0,2.0]
  azimuth_deg: -10
  elevation_deg: 25
  distance_m: 0.7-1.0
bottom_fill:
  source_size_m: [1.2,0.6]
  level_vs_key_stops: -1.5
negative_fill:
  camera_right_distance_m: 0.5-0.8
```

チェック: forehead clipping, nose specular, lip highlight, catchlight symmetry, pore preservation。

### Masculine / Grooming
```yaml
key:
  source_size_m: [0.3,0.3]
  azimuth_deg: -60
  elevation_deg: 30
fill_stops: -3
background_stops: -1.5
```

## 116. Lighting Ratios

1 stop = 2倍、2 stops = 4倍、3 stops = 8倍、4 stops = 16倍。

```yaml
ratio_example:
  key_lux: 800
  fill_lux: 200
  delta_stops: -2
```

## 117. Exposure Engine

```text
exposure_time = shutter_angle / 360 / fps
```

- 24fps / 180° = 1/48s
- 120fps / 180° = 1/240s
- 240fps / 180° = 1/480s
- 1000fps / 180° = 1/2000s

24→120fpsでは約2.32 stops、24→240fpsでは約3.32 stops、24→1000fpsでは約5.38 stopsの露光時間差が生じる。

## 118. High-Speed Lighting Rules

### 120–240fps
高出力LEDで比較的扱いやすい。商品・髪・布・液体のCM slow motion。

### 500–1000fps
1.2kW〜2.6kW級LEDや効率の高いreflector、光源の近接配置が重要。flicker-freeモード確認。

### 2,000fps+
科学・特殊撮影領域。より大光量、短いworking distance、熱管理、専用fixtureが必要。

### 10,000fps+
Phantom等のultra-high-speed領域。通常CM照明の延長ではなく専用テスト設計として扱う。

## 119. High-Output Fixture Reference

Aputure Electro Storm XT26の公式仕様例:
- output power 2600W
- input max 3500W
- 2700–6500K
- CRI 96.5+
- TLCI 97+
- IP65
- CRMX / DMX / Art-Net / sACN

5600K / 3mの公式photometric例:
- bare: 11,320 lux
- 50° reflector: 33,600 lux
- 35° reflector: 65,200 lux
- 20° reflector: 193,100 lux

機材DBでは単に`2600W LED`ではなく、距離・optic・CCTごとのluxを持つ。

```yaml
photometric:
  distance_m: 3
  cct_k: 5600
  optic: reflector_35
  center_lux: 65200
```

## 120. Photometric Database

各fixtureに保存する項目:
```yaml
photometrics:
  lux_by_distance: []
  beam_angle_deg:
  field_angle_deg:
  cct_variation:
  dimming_curve:
  flicker_verified_fps: []
  ies_or_ldt_file:
```

3D画面には中心lux、beam edge、field edge、falloff heatmapを表示する。

## 121. Modifier Database

### Diffusion
- Full Grid Cloth
- Half Grid
- Quarter Grid
- Magic Cloth
- Silk
- 216
- 250
- Opal
- Hampshire Frost
- Muslin

属性:
```yaml
transmission_loss_stops:
spread_deg:
softness_score:
color_shift:
texture_visibility:
```

### Bounce
- Ultrabounce White
- Silver
- Gold
- Bleached Muslin
- Unbleached Muslin
- Beadboard
- Polyboard
- Foamcore

### Negative fill
- Duvetyne
- Black floppy
- Black foamcore
- Black velvet

### Beam control
- Barn doors
- Eggcrate
- Grid
- Snoot
- Cutter
- Flag
- Net
- Scrim
- Gobo

重要: grid/eggcrateはsoft sourceのspillを制限するが、光源そのものをhardにするわけではない。

## 122. Book Light Geometry

```text
Fixture → Bounce → Diffusion → Talent
```

初期値:
- fixture→bounce 0.5–1.5m
- bounce→diffusion 0.3–1.0m
- diffusion→talent 0.5–1.5m

メリット: broad, wrap, smooth。欠点: 光量ロス、広いスペースが必要。

## 123. Negative Fill Distance

人物:
- 0.3–0.8m: strong
- 0.8–1.5m: moderate
- 2m+: ambient条件によって弱い

商品では数cm〜数十cmの黒カードが重要。

## 124. Product Reflection Principle

鏡面商品は「照明されている」のではなく「周囲の面を映している」。したがって仮想スタジオはlampだけでなく、white card / black card / diffusion / ceiling / camera body自体のreflectionを計算する。

## 125. Cylindrical Bottle Reflection

円柱ボトルには縦長のstrip reflectionが有効。

```yaml
left_strip:
  width_mm: 120
  height_mm: 700
  product_distance_mm: 250
right_strip:
  width_mm: 70
  height_mm: 700
  product_distance_mm: 220
```

ラベル中央には白reflectionを被せすぎない。

## 126. Transparent Product — Bright Field / Dark Field

### Bright-field
背景を明るくし、黒カードでglass edgeを暗くする。catalog / scientific / clean。

### Dark-field
背景を暗くし、後方diffusionやstripでglass edgeを光らせる。premium / beverage / perfume。

### Hybrid
rear transmission + frontal label fill。

## 127. Chrome / Mirror Product

必要:
- white tent / diffusion environment
- black gradient cards
- camera hiding strategy
- lens hole / long lens
- multi-pass composite

金属が「灰色」ならライト不足ではなく、灰色の環境を映している可能性が高い。

## 128. Polarization

### Camera CPL
glass, water, painted surface等の反射制御。

### Cross-polarization
光源にpolarizing film、カメラにCPLを直交させる。
用途: artwork, material science, dermatology-style documentation, texture extraction。

注意: 金属、LCD、複屈折素材、色シフト、光量ロス。

## 129. Beverage Condensation Model

```yaml
condensation:
  density: 0.0-1.0
  droplet_min_mm:
  droplet_max_mm:
  hero_droplet_count:
  run_marks:
  label_clear_zone: true
```

プリセット:
- Fresh Mist: 0.1–0.7mm多数
- Premium Cold: 0.5–2.5mm中密度
- Hero Droplets: 3–8mm少数
- Melted Cold: run marksあり

## 130. Condensation Decision Rules

```text
IF beverage AND message=fresh/cold/summer
  condensation_score += 0.8
IF premium_spirit AND warm_heritage
  condensation_score -= 0.6
IF freezing/winter context
  check continuity
```

## 131. Ice Direction

属性:
```yaml
ice:
  material: real | directional_clear | acrylic_prop
  count:
  size_mm:
  clarity:
  trapped_air:
  crack_level:
  melt_level:
```

AI動画ではice countをcontinuity lockする。

## 132. Carbonation

泡の可視性を高める:
- rear/side light
- darker adjacent background
- macro/tele
- correct focus plane
- fresh pour

AI指示例: `fine continuous micro-bubbles remain physically consistent and rise vertically under buoyancy`。

## 133. Beer

撮影要素:
- golden transmission
- foam/head
- condensation
- bubbles
- clear ice is normally not beer unless product style says so
- side/back hard sparkle
- label fill

Foam continuity:
```yaml
foam_height_mm:
bubble_size:
lacing:
overflow:
```

## 134. Highball / Whisky

Lighting stack:
1. hard rear-right for ice/carbonation
2. broad rear diffusion for liquid transparency
3. black cards for glass silhouette
4. subtle frontal label light
5. warm practical background optional

Recommended shot package:
- ice impact 120–500fps
- whisky pour macro
- soda carbonation
- glass exterior condensation
- talent sip
- product hero arc

## 135. Wine

Red wine: transmission edge is important because front-only light can make wine nearly black.

White wine: clean translucence, restrained condensation.

Premium background: warm practicals, neutral product white source。

## 136. Perfume

Separate materials:
- clear/frosted glass body
- liquid
- chrome/plastic cap
- embossed logo

Use broad gradients for glass, thin strips for metal, caustics/haze only when concept fits。

## 137. Serum

Macro recipe:
- 100–150mm macro
- controlled pipette
- dark-field or translucent backlight
- viscous droplet
- 120–1000fps depending event

Avoid random giant water splash when product benefit is delicate/premium。

## 138. Lipstick

Bullet:
- broad strip for wax body
- smaller hard accent for texture
- edge highlight
- tube chrome controlled separately
- turntable 5–15°/s

Beauty application:
- 85–135mm
- frontal broad soft source
- visible lip texture
- no plastic skin smoothing

## 139. Powder / Particle

Particle visibility:
- back/side light
- dark background
- short shutter for crisp
- high fps

Actual powder safety depends on material; combustible/inhalation risks require specialist handling。

## 140. Skin Finish Model

```yaml
skin_finish:
  matte: 0.2
  natural: 0.5
  hydrated: 0.75
  glass_skin: 0.9
```

Hydrated look = broad grazing specular + visible natural pores, not uniform plastic gloss。

## 141. Catchlight Design

Catchlight shape is source shape。
- round dish
- square softbox
- window rectangle
- ring
- strip

UI previews both eyes. Typical pleasant positions around 10–11 o'clock or 1–2 o'clock, but creative exceptions allowed。

## 142. Eyewear

Problems:
- reflection on lens
- frame shadow
- visible light source

Solutions:
- source higher
- slight head/glasses tilt
- source lateral shift
- larger off-axis source
- CPL test

Ray-traced UI should warn when reflection ray returns to camera。

## 143. Hair

Hair separation requires back/rim against similar-tone background。

Motion:
- gentle: 1–3m/s wind
- fashion: 2–5m/s
- dramatic: 5–9m/s

Fan should often be diagonal rear/side instead of direct front to avoid face distortion。

## 144. Fabric by Material

- Cotton: soft side + texture
- Denim: harder raking
- Silk/Satin: large gradient reflection
- Knit: macro side
- Sheer: backlight
- Sequins: small moving hard sources
- Leather: broad gradient + narrow edge

## 145. Food Texture

Raking side light shows microtexture better than frontal soft light。

Crispy cues:
- micro-shadow
- golden edges
- crumbs
- break-open
- crisp SFX

Juicy cues:
- specular sheen
- internal color
- steam
- pull-apart

## 146. Steam

Steam visibility improves with:
- back/side-back light 120–180°
- dark background
- longer lens
- sufficient density

Front-lit steam often disappears。

## 147. Jewelry

Large cards define metal shape, tiny hard sources create gemstone sparkle。

Camera movement of only a few degrees can change sparkle dramatically。

## 148. Watch

Still hero:
- macro
- focus stacking
- black/white reflection cards
- multiple passes
- dial and case separated if needed

`watch_hand_pose` must be configurable rather than hardcoded, though 10:10-style arrangements are common for readability。

## 149. Smartphone / Electronics

Screen risks:
- PWM/banding
- refresh mismatch
- moiré
- polarizer darkening
- reflection

Options:
- practical screen capture
- tracked screen replacement
- CG screen

## 150. Automotive

A car is a very large reflective object. Studio approach:
- giant overhead diffusion
- long side strips
- black void
- floor reflection
- controlled moving highlight

Hero angles:
- front 3/4 low
- rear 3/4
- profile
- wheel ECU
- headlight ECU
- interior POV
- top-down

## 151. Vehicle Tracking

If camera vehicle and hero vehicle move at nearly same velocity, hero remains relatively stable while background moves.

Shutter:
- 180° natural
- 270–360° more smear
- 90° crisp action

AI constraint: physically consistent wheel rotation and no warped spokes。

## 152. Camera Support Taxonomy — Detailed

### Tripod
- fluid head
- geared head
- still ball head
- high-hat / low-hat

### Linear
- manual slider
- motorized slider
- straight dolly track
- curved dolly track

### Vertical / Arc
- jib
- crane
- telescopic crane

### Body
- handheld
- shoulder
- Steadicam
- hybrid stabilizer
- gimbal
- Easyrig support

### Robotic
- motion control robot
- robotic dolly
- remote head

### Specialty
- cablecam
- railcam
- vehicle pursuit arm
- drone
- FPV

## 153. Steadicam vs Gimbal

Steadicam:
- floating inertia
- organic human movement
- long takes
- stairs

Gimbal:
- electronically stabilized
- compact
- cleaner paths
- easier low/high modes

Prompt distinction matters。

## 154. Handheld Motion Model

```yaml
handheld:
  translation_amplitude_cm: 0.5
  rotation_amplitude_deg: 0.4
  low_frequency_hz: 0.6
  high_frequency_hz: 3.0
  camera_mass_kg: 7.0
```

Heavy cinema rig should not shake like a phone。

## 155. Slider / Macro Motion

Macro product often only needs 5–20cm travel. Long focal amplifies parallax。

Example:
```yaml
move:
  type: slider
  distance_cm: 18
  duration_s: 1.5
  easing: ease_in_out
```

## 156. Arc Move

Product hero baseline:
- radius 0.6–1.2m
- arc 15–35°
- duration 2–4s

Turntable can counter-rotate for complex specular motion。

## 157. Focus Pull Timeline

```yaml
focus:
  - {t: 0.0, distance_m: 0.42}
  - {t: 1.2, distance_m: 2.4}
  easing: smooth
```

Natural-language output: `rack focus from droplets 42cm from lens to the talent's eyes at 2.4m`。

## 158. Motion Control

Motion control is important for:
- exact repeatability
- VFX multipass
- macro
- high speed
- product transformations

Pass model:
1. clean body
2. reflection
3. label
4. screen
5. particles
6. silhouette
7. clean plate

## 159. Remote Head

Fields:
```yaml
remote_head:
  payload_kg:
  pan_range:
  tilt_range:
  roll_range:
  max_speed_deg_s:
  continuous_pan:
  continuous_roll:
```

ARRI 360 EVO class should be tagged for stabilized remote operation and continuous roll-style creative movement where applicable。

## 160. Crane Decision

Use telescopic crane when:
- vertical + horizontal travel must happen continuously
- substantial reach
- heavy cinema payload
- precise repeated move

Alternatives:
- jib
- gimbal boom
- drone
- AI simulation

3D collision, arm envelope and floor loading are required for real-shoot mode。

## 161. Drone Classes

- Integrated cinema drone
- Heavy-lift drone
- X8 heavy-lift
- 5-inch FPV
- 7-inch FPV
- Cinewhoop
- Micro FPV
- RTK mapping drone
- specialized stabilized aerial platform

## 162. DJI Inspire 3 Class

Capability tags:
```yaml
camera: full_frame_8k_class
raw: true
high_frame_rate: true
rtk: true
repeatable_route: high
```

Good for cinematic establishing, repeatable VFX plates, city/landscape, vehicle follow。

## 163. Freefly Alta X Class

Official reference values:
- max payload about 15.06kg
- max gross takeoff about 34.86kg
- typical empty about 10.86kg
- operating -20 to +50C
- tested IP43-equivalent

Payload calculator must total body+lens+gimbal+wireless+focus+mount+cables, then keep margin。

## 164. FPV Grammar

Visual trajectories:
- dive
- chase
- reveal
- proximity skim
- gap pass
- orbit
- interior-to-exterior

AI prompt should describe camera path visually rather than teach unsafe piloting maneuvers。

Example: `camera descends quickly along the facade, levels smoothly 1.5m above the ground, then passes through the already-open doorway without cutting`。

## 165. Drone Path Schema

```yaml
aerial_path:
  control_points:
    - [0,-30,2]
    - [0,-15,5]
    - [5,0,12]
  look_at: [0,0,2]
  speed_profile: ease_out
  gimbal_pitch_deg: [-10,-20,-35]
```

## 166. Underwater

Need:
- housing
- correct port
- buoyancy
- monitor/control
- underwater lights
- anti-condensation

Flat port narrows FOV via refraction; dome ports are preferred for wide-angle and split-level imaging。

## 167. Specialty Imaging

Separate modules:
- thermal
- near-IR
- UV reflected / fluorescence
- multispectral
- hyperspectral
- microscope
- endoscope
- schlieren
- shadowgraph
- event camera
- depth camera
- LiDAR

Do not treat these as normal RGB camera “filters”。

## 168. High-Speed Cameras

Freefly Ember S5K official reference:
- S35
- 5K around 600fps
- 4K around 800fps
- selected modes beyond 1000fps
- global shutter
- around 0.8kg class

Phantom TMX 7510 class:
- tens of thousands fps at useful resolutions
- much higher at reduced resolution
- scientific/impact/ultra-fast event capture

Recommendation engine distinguishes `commercial_high_speed` and `scientific_ultra_high_speed`。

## 169. Lens Taxonomy — Expanded

### Spherical
- ultra-wide rectilinear
- wide
- normal
- portrait
- tele
- supertele

### Macro
- 0.5x
- 1:1
- 2:1+
- supermacro

### Specialty
- probe
- periscope
- relay
- endoscope
- fisheye
- tilt-shift
- mirror/catadioptric
- split diopter
- prism/kaleidoscope accessories

### Anamorphic
Fields:
```yaml
squeeze:
oval_bokeh:
flare_strength:
close_focus:
distortion:
edge_softness:
mumps:
```

## 170. Perspective Rule

Perspective is primarily determined by camera position, not focal length alone. A telephoto lens appears to “compress perspective” mainly because the camera is moved farther away to maintain framing。

This should be explicitly taught in education mode。

## 171. Facial Distortion

Wide close-up:
- nose exaggerated
- ears recede
- energetic / comic / intimate

Beauty:
- farther camera
- 85–135mm full-frame class commonly useful

## 172. Lens Breathing

Store breathing as measurable/subjective property. Rack focus can change FOV with some lenses; modern cine lenses may minimize this。

## 173. Diffusion Filter Model

```yaml
diffusion_filter:
  halation:
  contrast_reduction:
  black_lift:
  skin_softening:
  sharpness_loss:
```

Brands/strengths become products mapped to this capability vector。

## 174. Lens Flare

Types:
- veiling flare
- internal ghost
- anamorphic streak
- aperture ghost
- sensor reflection

Prompt compiler should select exact character instead of generic “cinematic lens flare”。

## 175. Bokeh

Fields:
- circular/oval
- cat-eye
- onion-ring
- swirl
- edge brightening
- smoothness

## 176. Camera Movement Grammar — Numeric

Normalize movement to physical units:
```yaml
translation_speed_m_s:
rotation_speed_deg_s:
distance_m:
duration_s:
easing:
```

`slow dolly` alone is insufficient。

## 177. Easing

- linear
- ease_in
- ease_out
- ease_in_out
- overshoot
- spring
- organic_handheld

Prompt example: `begins almost imperceptibly, accelerates gently, and settles before the cut`。

## 178. Dolly Zoom

Maintain subject screen size while focal length and camera distance change. Implement with screen-space subject-height constraint solver。

## 179. Pan Judder

24fps + fast pan + contrasty vertical edges can judder. Engine should warn based on focal length, angular movement, fps and shutter, then suggest slower pan, wider shutter or higher capture/playback choices。

## 180. Shutter Style Presets

- 360° dreamy smear
- 180° natural
- 90° crisp
- 45° staccato/action

172.8° can be useful around 24fps in 50Hz environments because exposure is ~1/50s, but actual flicker behavior must be tested with fixtures/screens。

## 181. Japan Mains Frequency

Japan contains 50Hz and 60Hz regions. Location metadata should retain mains frequency for legacy/practical light and display flicker checks。

## 182. LED Flicker Database

```yaml
flicker:
  pwm_frequency_hz:
  dimming_modes:
  tested_capture_fps: []
  safe_shutter_ranges: []
  source_confidence:
```

Unknown practical LEDs must be marked TEST REQUIRED。

## 183. Product Macro DOF

At high magnification DOF can fall to millimeter/sub-millimeter scale. Options:
- stop down
- focus stack still
- align focus plane
- smaller sensor
- selective-focus aesthetic

UI shows diffraction tradeoff when stopping down too far。

## 184. Focus Stacking

```yaml
focus_stack:
  near_mm:
  far_mm:
  step_mm:
  frame_count:
```

Macro rail can automate。

## 185. Tilt-Shift

Use:
- architecture
- tabletop plane focus
- product still
- miniature aesthetic

Visualize Scheimpflug focus plane in 3D。

## 186. Probe Lens

Use:
- table surface skim
- between ingredients
- product interior-like view
- miniatures

Needs more light, careful collision path, and typically precise support/motion-control。

## 187. Fisheye

Use deliberately in:
- skate
- music
- POV
- retro
- tiny spaces

Do not substitute for ordinary ultra-wide。

## 188. Snorricam

Camera fixed relative to actor's body/head. Actor remains locked while environment moves. Use for anxiety, intoxication, stylized comedy, MV。

## 189. First-Person POV

POV continuity fields:
```yaml
hands:
  sleeve:
  jewelry:
  dominant_hand:
  held_object:
  skin_reference:
```

AI video must preserve hand count and wardrobe through cuts。

## 190. Mirror Shots

Real shoot options:
- camera angle avoidance
- lens through opening
- split plate
- VFX removal

AI QA must compare subject reflection for geometry and timing consistency。

## 191. Atmospherics

### Haze
Normalized density:
- 0.03 subtle depth
- 0.08 slight beam visibility
- 0.15 obvious volumetric
- 0.3 stylized
- 0.6 heavy

This is an artistic normalized scale, not physical concentration。

### Rain
Back/side-back lighting + dark background. Short shutter = droplets, longer shutter = streaks。

### Wet-down
Track wetness continuity; street reflections change as pavement dries。

### Fog/Smoke
Need lens flare and black-level management。

## 192. Wind Engine

```yaml
wind:
  speed_m_s:
  direction_deg:
  gust_period_s:
  turbulence:
  affected_objects: []
```

Targets can include hair, dress, curtains, foliage, smoke, mist, powder。

## 193. Set Surfaces

Every set surface gets PBR-style attributes:
```yaml
material:
  albedo:
  roughness:
  metallic:
  transmission:
  emission:
```

White floor may become major fill; black ceiling may absorb top spill. Solver must include environment, not only fixtures。

## 194. Background Separation

Subject-background distance:
- 0.5m: spill/shadow high
- 1.5–3m: easier independent control
- 4m+: stronger bokeh/independent background lighting

## 195. Cyc / Seamless

Store actual cyc radius; a low/wide lens can reveal curvature/horizon incorrectly if geometry is fake。

## 196. Chroma Key

Fields:
```yaml
greenscreen:
  mean_lux:
  min_lux:
  max_lux:
  deviation_percent:
  subject_distance_m:
  spill_score:
```

Fine hair requires careful edge, adequate codec/chroma sampling, controlled spill, reasonable shutter blur。

## 197. Virtual Production

Core components:
- LED wall
- ceiling/off-camera lighting panels
- real-time engine
- camera tracking
- genlock
- timecode
- lens metadata
- color pipeline
- LED processor

Reflective objects and car interiors particularly benefit because moving environment becomes physically reflected light。

## 198. Camera Tracking Data

```yaml
tracking:
  position_xyz:
  quaternion:
  focal_mm:
  focus_distance_m:
  iris_t:
  distortion_profile:
  timestamp:
  latency_ms:
```

## 199. VFX Capture Set

Per VFX-heavy shot consider:
- clean plate
- gray ball
- chrome ball
- color chart
- lens grid
- HDRI
- photogrammetry/LiDAR
- witness cameras
- tracking markers

## 200. Photogrammetry

Capture:
- high overlap
- consistent exposure
- enough sharp detail
- scale marker
- cross-polarized sets for materials where useful

## 201. LiDAR

Use for:
- techvis
- location geometry
- camera collision
- VFX tracking reference

## 202. NeRF / Gaussian Splatting

Useful for fast volumetric reconstruction of locations. Challenges include moving people, transparency and highly specular surfaces。

## 203. HDRI

Bracketed spherical capture for VFX lighting. Add chrome/gray ball references where pipeline requires。

## 204. Color Pipeline

Fields:
```yaml
color:
  capture_gamma:
  capture_gamut:
  working_space:
  display_transform:
  viewing_lut:
  delivery: SDR | HDR
```

ACES-style scene-referred pipeline can be supported without forcing all users to understand ACES terminology。

## 205. Film Look Parameters

Don't store only `film look=true`.

```yaml
film_emulation:
  contrast_curve:
  highlight_rolloff:
  halation:
  grain_size:
  grain_amount:
  chroma_noise:
  saturation_response:
```

## 206. Highlight Rolloff

Essential for skin, glass, metal and practical bulbs. Prompt phrase: `soft highlight roll-off retaining texture in bright skin and glass reflections`。

## 207. Commercial Shot Roles

Every shot has a communication role:
- HOOK
- ESTABLISH
- FEATURE
- MECHANISM
- TEXTURE
- SENSORY
- HUMAN_REACTION
- PROOF
- HERO
- PACKSHOT
- CTA

Generator should not output a random series of beauty shots without role balance。

## 208. Visual Proof Mapping

Examples:
- crispy → side/raking macro + break + crumbs + crisp SFX
- cold → condensation + ice + backlight + bubbles + slower tactile motion
- lightweight → fabric/object motion + easy handling
- softness → macro fiber + broad light + slow folds
- gloss → broad controlled reflection

Claims must remain within approved/valid product claims; visual tool should not invent medical efficacy。

## 209. Editing Grammar

10-second example:
- 0–1 hook
- 1–3 context/product reveal
- 3–6 sensory/mechanism
- 6–8 human payoff
- 8–10 hero/brand

But shot-role solver can depart based on concept。

## 210. Speed Ramp

```yaml
speed_ramp:
  - {t: 0.0, playback: 1.0}
  - {t: 0.4, playback: 0.25}
  - {t: 1.2, playback: 1.0}
```

Prompt: `ramp into four-times slow motion exactly as the ice impacts, then return smoothly to real time`。

## 211. Match Cut / Wipe / Whip

Track transition metadata:
- movement direction
- shape
- color
- frame occlusion
- blur

Shot A whip right should usually connect to a rightward motion start in Shot B if continuity is intended。

## 212. Vertical 9:16 Rules

Prefer:
- depth movement
- vertical rises
- center-weighted product composition
- foreground layers
- top/bottom text-safe zones

Long lateral moves can exit frame too quickly。

## 213. Multi-Aspect Protection

Use open-gate style capture where possible and show simultaneous overlays:
- 16:9
- 9:16
- 4:5
- 1:1

## 214. Attention Map

Estimate visual attention from:
- face
- contrast
- sharpness
- saturation
- motion
- position

Ensure product dominates during hero/packshot。

## 215. Brand Color

Store official brand colors and flag lighting/grade that causes excessive packaging shift. Exact logo/text often better handled as real/CG overlay in hybrid workflows than left entirely to generative video。

## 216. Digital Product Twin

```yaml
product_twin:
  geometry:
  dimensions_mm:
  materials:
  label_art:
  logo_vectors:
  articulation:
```

This enables exact packshot/CG while AI generates world/background/talent。

## 217. Real vs AI vs Hybrid Score

```yaml
execution:
  real_score:
  ai_score:
  hybrid_score:
  recommended:
  reason:
```

Example: exact branded reflective bottle + impossible camera move may be best as CG product + AI/real background hybrid。

## 218. Generative Risk Factors

Higher risk:
- hands touching branded objects
- exact text
- mirror
- liquid
- multiple people
- fast object rotation
- long continuous take
- highly reflective product

System can automatically split into shorter shots or recommend hybrid compositing。

## 219. Continuity State Machine

Beverage example:
```text
SEALED → OPENED → POURED → SIPPED → HERO
```

Track:
- liquid level
- ice count
- foam
- condensation
- label angle
- cap state

Use duplicate props if shooting order conflicts with state。

## 220. Talent Continuity

```yaml
continuity:
  wardrobe:
  hair_state:
  makeup:
  jewelry:
  hand_props:
  wetness:
  facial_expression:
```

## 221. Camera QA

Automatic checks:
- wrong focal class
- camera teleports
- movement direction reversal
- excessive simultaneous camera motions
- horizon drift
- 180° rule conflict
- 30° edit rule conflict

## 222. Product QA

- logo/text warp
- product geometry
- label orientation
- liquid level
- ice count
- cap position
- reflection continuity
- water droplets
- shadow direction

## 223. Lighting QA

- product edge lost
- black product on black background
- white product on white background
- face too flat
- eye sockets dark
- background spill
- haze veiling
- lens flare collision
- flicker risk

## 224. Common Failure: Glass Edge Lost

Fix order:
1. add/move black cards
2. increase rear diffusion brightness
3. adjust camera/product angle
4. change background tone
5. narrow strip reflection

## 225. Common Failure: Metal Looks Gray

Change surrounding reflection environment. Adding frontal light alone often worsens the result。

## 226. Common Failure: Skin Looks Plastic

Possible causes:
- AI over-smoothing
- frontal uniform light
- aggressive retouch
- clipped highlights

Fix:
- preserve pores/microtexture
- broad directional source
- real specular breakup
- lower beauty smoothing

## 227. Common Failure: AI Camera Teleports

Prompt must state:
- start position
- end position
- distance
- duration
- one dominant movement

## 228. Common Failure: AI Liquid Continuity

Add constraints:
`liquid remains exactly two-thirds full`, `three clear ice cubes remain unchanged`, `droplets move only down under gravity`。

## 229. Lighting Plot Export

Per fixture:
- ID
- model/capability
- XYZ
- target
- height
- optic
- modifier
- CCT
- intensity
- lux at subject
- power
- DMX universe/address
- safety note

## 230. DMX / Lighting Cue Timeline

```yaml
cue:
  time_s: 2.5
  fixture: L3
  intensity_percent: 80
  cct_k: 5600
  rgb: null
  fade_ms: 500
```

Useful for moving reflections, MV, VP and time-based product highlights。

## 231. Power Engine

Baseline:
```text
amps ≈ watts / volts
```

Real planning must account for continuous load limits, power factor, inrush, distro and local electrical code. High-power fixtures require qualified crew。

## 232. Rigging Engine

Store:
```yaml
rig:
  fixture_weight_kg:
  modifier_weight_kg:
  rig_weight_kg:
  dynamic_load:
  rated_points:
  secondary_safety:
```

Real overhead rigging remains qualified-rigger territory。

## 233. Studio Collision

3D engine includes:
- stand legs
- sandbags
- cables
- dolly track
- crane envelope
- operator path
- talent path

A visually plausible 2D lighting diagram can be physically impossible without this layer。

## 234. Crew View Layers

Director: storyboard + intent
DP: framing/lens/exposure
Gaffer: lighting/photometrics
Grip: support/rigging/collision
VFX: tracking/reference
Producer: gear/crew/schedule/cost

## 235. Production Scheduling

Optimize around:
- sun windows
- product resets
- talent
- macro rig
- high-speed rig
- camera/lens changes
- lighting turnovers
- VFX passes
- drone windows

## 236. Reset Time

Special shots require reset metadata:
- splash
- food
- foam
- smoke
- wet product
- hair
- powder

## 237. Shoot Order and Product State

Keep pristine packshot product separate from consumable/action units. Food/liquid often needs duplicates。

## 238. Camera Data / Media

Per camera mode store:
- codec
- bitrate/data rate
- resolution
- fps
- media type
- record duration
- thermal limitations if any

Estimator:
```text
storage = data_rate × capture_duration
```

## 239. Battery Estimator

```text
runtime_h ≈ battery_Wh × derating / load_W
```

Cold, age, peaks and accessory load reduce practical runtime。

## 240. Lens Compatibility

Check:
- mount
- image circle
- flange/interface
- weight
- front diameter
- focus motor
- metadata

Do not recommend an S35 lens on a large-format sensor without crop/vignetting note。

## 241. Gimbal Payload

Total includes:
- body
- lens
- matte box/filter
- focus motor
- transmitter
- cage/cables

Center of gravity matters, not only mass。

## 242. Focus Difficulty Score

Difficulty rises with:
- shallow DOF
- subject speed
- camera speed
- occlusion
- low light
- macro magnification

Recommend 1st AC, AF, deeper stop, wider lens or rehearsed marks depending job。

## 243. Location Model

```yaml
location:
  dimensions:
  photos_360:
  lidar:
  windows:
  practicals:
  wall_materials:
  power:
  load_in:
  parking:
  public_control:
  ambient_noise:
  sun_access:
  drone_constraints:
```

## 244. Outdoor Sun Engine

Calculate:
- sunrise/sunset
- azimuth
- elevation
- golden hour
- twilight
- shadow vector

Approx shadow length:
```text
shadow_length = object_height / tan(sun_elevation)
```

## 245. Outdoor Light Scenarios

### Backlit Golden Hour
sun behind talent; bounce/LED front; warm edge。

### Open Shade
soft sky; add negative fill for shape。

### Overcast
sky dome acts as huge soft source; low contrast, can add directional negative fill/hard accent。

### Forest
green environmental contamination; neutral/magenta correction or white bounce may help skin。

### Beach/Snow
high environmental reflectance; ND, highlight control, negative fill。

## 246. Night Exterior

Layer stack:
1. moon motivation
2. practical street/shop lights
3. signage
4. wet ground
5. subtle atmosphere
6. subject edge/eye light

Avoid default “everything blue” moonlight。

## 247. Car Interior Process

Possible modes:
- real driving
- process trailer
- tow rig
- LED background
- virtual production
- green/blue screen

LED/VP is particularly good for moving reflections on windshield, dashboard and skin。

## 248. Screen / LED Wall Sync

Need:
- genlock
- refresh rate
- shutter/phase considerations
- camera tracking
- processor latency

## 249. Sound-Aware Cinematography

Track noisy systems:
- camera fans
- drone
- robot
- fogger
- ballast
- high-output lighting fans

Dialogue scenes may require quieter settings or MOS strategy。

## 250. SFX Cue Objects

```yaml
sfx:
  - time: 0.43
    event: ice_impact
    character: crisp_glass_clink
  - time: 1.8
    event: carbonation
    character: fine_fizz
```

## 251. Still Photography Module

Add:
- tethering
- leaf shutter
- flash duration
- focus stacking
- bracketed exposure
- multi-pass reflection
- polarization
- camera stand
- medium format
- pixel shift where supported

## 252. Flash Duration

For freezing motion, t.1 duration is often more meaningful than t.5. Store both where available。

## 253. Still Splash

Dark ambient + very short flash pulse can freeze water. Camera shutter only needs synchronization; motion freeze mainly comes from flash duration。

## 254. Architecture Still

Tools:
- tilt-shift
- geared head
- tripod
- HDR bracket
- blue hour scheduling
- interior/window balance
- perspective correction

## 255. Artwork Reproduction

Use:
- two equal lights around 45°
- cross polarization where appropriate
- color chart
- flat camera plane
- high uniformity

## 256. Multi-Camera / Interview

Standard interview:
- A 85mm MCU
- B 50mm wider 3/4
- key 45° soft
- negative fill opposite
- practical background
- consistent eyeline

Direct-to-camera requires lens near eye height and good catchlight。

## 257. 180° Rule Engine

Store line of action as vector. Camera crossing generates warning but can be overridden intentionally or crossed during a visible move/neutral shot。

## 258. 30° Rule

Consecutive camera angles too similar may feel like jump cut. Suggest >30° change or meaningful shot-size/focal change where editing convention applies。

## 259. One-Take Planner

Need:
- actor blocking
- focus timeline
- lighting zones
- hidden crew
- reset
- camera collision
- reflections
- sound

Lights can change by DMX cues as camera moves through zones。

## 260. Reflection Visibility Map

Ray-traced warnings for:
- camera in mirror
- boom mic
- light stands
- crane
- crew
- drone shadow
- window reflection

## 261. Camera Shadow Map

Outdoor/low-angle product shots can reveal camera/rig shadow. Sun engine + object geometry predicts this。

## 262. Light Motivation

Visible practicals should usually have plausible relationship to light direction/color unless intentionally stylized。

Example: frame-left warm lamp but warm key from frame-right is flagged as weak motivation, not forbidden。

## 263. Color Contrast

Possible intentional palettes:
- warm/cool
- teal/orange
- sodium/cyan
- red/blue
- magenta/green

Do not default every cinematic shot to teal-orange。

## 264. White Balance as Creative Variable

Camera WB changes relative color of sources. Store actual CCT and chosen WB separately; do not bake everything into “warm/cool”。

## 265. Spectral Quality

CRI alone is insufficient. Store TLCI, SSI, TM-30 or spectral data where available. Two 5600K fixtures can render materials differently。

## 266. Product Color Accuracy

Brand-critical product should prefer neutral/high-quality spectral light and controlled color management. Highly saturated RGB lighting may distort packaging colors。

## 267. Prompt Compiler — Structure

```text
FORMAT
SUBJECT LOCK
ENVIRONMENT
CAMERA SENSOR/FORMAT
LENS
CAMERA XYZ/HEIGHT/DISTANCE
MOVEMENT PATH + DISTANCE + DURATION
FOCUS
LIGHTING GEOMETRY
MATERIAL PHYSICS
FPS / SHUTTER FEEL
CONTINUITY
SFX / VO
NEGATIVE CONSTRAINTS
```

## 268. Numeric-to-Language Example

Input:
```yaml
camera_position_m: [0,-0.40,0.08]
lens_mm: 100
move_x_m: 0.18
duration_s: 1.5
```

Output:
`The camera sits only 8 cm above the tabletop and about 40 cm from the glass with a 100 mm macro perspective. It slides precisely 18 cm from left to right over 1.5 seconds and settles before the cut.`

## 269. Lighting Compiler Example

Input:
```yaml
key_azimuth: -45
key_elevation: 25
source_size: large
negative_fill: right
```

Output:
`A large diffused key is positioned camera-left at roughly 45 degrees and 25 degrees above the subject, while a close black negative-fill card on camera-right deepens the opposite cheek and defines the jaw.`

## 270. Material Compiler Example

Glass + cold:
`Use dark-field product lighting: a broad rear diffusion transmits through the drink, thin white vertical reflections define the glass, black cards tighten both edges, and medium-density condensation creates a physically plausible cold surface.`

## 271. Ultra-Detailed Highball Shot Object

```yaml
shot_id: S03
purpose: carbonation_and_cold_proof
duration_s: 1.6
capture_fps: 120
playback_fps: 24
subject:
  glass_height_mm: 145
  fill_percent: 68
  ice_count: 3
  condensation_density: 0.72
camera:
  position_mm: [0,-410,72]
  sensor: full_frame
  lens: 100mm_macro
  t_stop: 4
  shutter_angle: 180
  EI: 800
  WB_K: 5200
motion:
  support: motorized_slider
  start_mm: [-90,-410,72]
  end_mm: [90,-410,72]
  easing: ease_in_out
lighting:
  rear_hard:
    position_mm: [280,180,240]
    cct_k: 5600
    beam_deg: 25
  rear_diffusion:
    size_mm: [500,700]
  left_negative:
    distance_product_mm: 120
  right_negative:
    distance_product_mm: 100
  label_fill:
    level_vs_key_stops: -2
continuity:
  liquid_level_locked: true
  ice_count_locked: true
  label_angle_locked: true
negative_constraints:
  - no random camera rotation
  - no duplicate ice
  - no warped glass
  - droplets obey gravity
```

## 272. Ultra-Detailed Beauty Shot

```yaml
camera:
  sensor: full_frame
  lens_mm: 100
  t_stop: 2.8
  distance_m: 1.9
  eye_height_m: 1.63
key:
  source_size_m: [2.0,2.0]
  talent_distance_m: 0.75
  azimuth_deg: -15
  elevation_deg: 25
bottom_fill:
  level_vs_key_stops: -1.7
negative_fill:
  side: camera_right
  talent_distance_m: 0.55
hair_edge:
  azimuth_deg: 140
  elevation_deg: 35
  level_vs_key_stops: -0.7
look:
  hydrated_skin: true
  preserve_pores: true
  broad_cheek_highlight: true
  forehead_clipping: false
```

## 273. Ultra-Detailed Fried Chicken Shot

```yaml
camera:
  lens_mm: 85
  fps: 60
  t_stop: 4
key:
  azimuth_deg: -70
  elevation_deg: 20
  softness: medium_hard
fill_stops: -2.5
steam_backlight:
  azimuth_deg: 145
  beam: narrow
insert:
  lens: 100mm_macro
  fps: 120
  action: coating_break_with_crumbs
```

## 274. Equipment Database Schema — V2

```yaml
equipment:
  id:
  manufacturer:
  family:
  model:
  variant:
  status: current | discontinued | legacy | announced | prototype
  category:
  subcategory:
  capability_archetype:
  physical:
    dimensions_mm:
    weight_kg:
    mount_point:
    sweep_envelope:
  electrical:
    input_voltage:
    max_power_w:
    connector:
  environment:
    operating_temp_c:
    ip_rating:
  capabilities: {}
  compatibility: []
  ideal_use_cases: []
  avoid_when: []
  rental_commonness:
  source_urls: []
  last_verified:
  confidence:
```

## 275. Camera Schema — V2

```yaml
camera:
  sensor_width_mm:
  sensor_height_mm:
  sensor_type:
  readout_mode:
  global_shutter:
  rolling_shutter_ms:
  dynamic_range_stops:
  base_iso_or_EI: []
  max_resolution:
  open_gate:
  fps_by_mode: []
  codecs: []
  raw_formats: []
  media: []
  lens_mounts: []
  internal_nd:
  genlock:
  timecode:
  gyro_metadata:
  weight_kg:
```

## 276. Lens Schema — V2

```yaml
lens:
  mount:
  image_circle_mm:
  focal_min_mm:
  focal_max_mm:
  prime:
  max_t_stop:
  close_focus_m:
  max_magnification:
  front_diameter_mm:
  weight_kg:
  breathing_percent:
  distortion_profile:
  flare_character:
  bokeh_character:
  anamorphic_squeeze:
  metadata_protocol:
```

## 277. Light Schema — V2

```yaml
light:
  engine_type:
  cct_min:
  cct_max:
  duv_adjust:
  rgb:
  rgbww:
  rgbacl:
  pixel_zones:
  power_w:
  photometrics: []
  optics: []
  modifiers: []
  cri:
  tlci:
  ssi:
  tm30:
  flicker: {}
  controls: []
  ip_rating:
```

## 278. Drone Schema — V2

```yaml
drone:
  configuration:
  empty_weight_kg:
  mtow_kg:
  max_payload_kg:
  nominal_flight_time_min:
  wind_limit:
  max_speed:
  integrated_camera:
  gimbal:
  rtk:
  waypoint_repeatability:
  obstacle_sensing:
  transmission:
  regulatory_class_tags: []
```

## 279. Technique Schema — V2

```yaml
technique:
  id:
  name:
  objective:
  principle_type: physical | common_practice | creative_heuristic
  compatible_subjects: []
  compatible_materials: []
  required_capabilities: []
  placement_rules: []
  exposure_rules: []
  failure_modes: []
  alternatives: []
  safety_level:
  real_ai_hybrid:
  prompt_phrases: []
```

## 280. Rule Priority

1. safety
2. physical feasibility
3. continuity
4. subject/material physics
5. communication objective
6. creative intent
7. brand preference
8. equipment preference

Expert users can lock parameters; solver must show conflicts instead of silently changing them。

## 281. Example Conflict Solver

User locks:
- 1000fps
- T8
- small 100W battery LED

System warns likely insufficient light and proposes:
- stronger high-output fixture
- open aperture
- reduce fps
- higher EI/noise tradeoff
- AI simulation

## 282. Explainability

Every recommendation returns `because`:
```yaml
because:
  - transparent_glass_requires_edge_or_transmission_control
  - cold_message_supports_condensation
  - 120fps_at_180deg_has_2.32_stop_less_exposure_time_than_24fps
```

## 283. Education Mode

Clicking a light should explain:
- what it does
- why it is there
- what changes if moved closer/farther
- what happens if larger/smaller
- alternatives

Clicking a lens should show perspective/framing/DOF comparison。

## 284. What-If Comparisons

Interactive comparisons:
- 35mm vs 85mm same framing
- T1.4 vs T4
- hard vs soft source
- fill 0/-1/-2/-3 stops
- negative fill on/off
- CPL rotation
- 24/60/120/500fps
- shutter 360/180/90/45°

## 285. Source / Provenance Model

Every fact:
```yaml
source_type: official_spec | manual | rental_house | publication | community
source_url:
verified_date:
confidence:
fact_type: spec | physical_principle | common_practice | creative_heuristic | subjective_style
```

Do not mix a manufacturer's measured lux value with a subjective “beautiful skin” score as if they are equivalent facts。

## 286. Product Lifecycle

Status:
- current
- discontinued
- legacy_rental
- announced
- prototype

Cinema production often uses discontinued/vintage gear, so old products remain searchable。

## 287. Capability-First Recommendation

Output order:
1. required capability
2. representative current products
3. legacy/rental alternatives
4. lower-cost approximation
5. AI/hybrid alternative

Example:
`2kW-class flicker-free daylight-capable source` → exact models second。

## 288. Actual SKU Database Strategy

Do not hardcode thousands of SKUs into the ontology Markdown. Use separate structured datasets:

```text
/data/cameras_master.json
/data/lenses_master.json
/data/lights_master.json
/data/modifiers_master.json
/data/grip_master.json
/data/motion_control_master.json
/data/drones_master.json
/data/special_imaging_master.json
/data/effects_master.json
```

The Markdown remains the expert rulebook; SKU datasets remain updateable inventories。

## 289. Retrieval Query

RAG input:
```text
subject + material + claim + mood + location + capture_mode + movement + budget
```

Example:
`glass highball + transparent + refreshing + early summer terrace + AI video + macro slow motion`。

## 290. Recipe Composition

Recipes are composable:
```text
transparent_bottle
+ cold_refreshing
+ early_summer_outdoor
+ male_lifestyle
+ premium_social_10s
```

This creates a complete commercial plan without creating one giant hardcoded highball recipe。

## 291. Creative Intent Vector

```yaml
intent:
  premium: 0.9
  fresh: 0.8
  organic: 0.4
  youthful: 0.3
  experimental: 0.1
```

Maps to movement, lens, light, edit and grade probabilities。

## 292. Style Rules

Premium tends toward precise slower motion, controlled reflections, lower clutter, deliberate contrast.
Fresh tends toward backlight, droplets, motion, clean greens/blues, high-speed sensory shots.
Organic tends toward motivated daylight, warm-neutral materials, subtle imperfection.
Technical tends toward hard edges, geometry, macro detail, robot/motion-control.
Retro may use vintage optics, hard flash, period aspect/camera grammar, not grain alone。

These are heuristics, always user-overridable。

## 293. Output Modes

### AI Video Mode
No real-world rigging detail unless useful; emphasize physical cinematography language and continuity。

### Real Shoot Mode
Exact gear, power, dimensions, crew, rigging, reset, data, safety。

### Hybrid Mode
Specify what is real plate, CG product, generated environment, composited logo/text。

### Still Mode
Add flash, stacking, tether, leaf shutter, polarization, multi-pass。

### VP Mode
Add LED wall/tracking/genlock/lens data/render engine。

## 294. PDF Technical Package

Potential 100+ page production pack:
1. cover
2. creative intent
3. references
4. scene overview
5. top view
6. side view
7. 3D view
8. camera package
9. lens package
10. lighting package
11. grip/movement
12. shot cards
13. storyboard
14. exposure/fps notes
15. continuity
16. VFX
17. drone
18. safety
19. gear manifest
20. schedule
21. Seedance prompts
22. JSON appendix

## 295. Role-Specific PDFs

- Director Deck
- DP Camera Book
- Gaffer Lighting Plot
- Grip/Movement Plan
- Drone Plan
- VFX Reference Pack
- AI Prompt Book

## 296. SVG Diagram Specification

Top/side diagrams should export SVG for scalable PDF/PNG rendering. Objects include camera frustum, light cones, diffusion planes, flags, cards, dolly track, crane envelope, drone spline, talent marks and measurements。

## 297. Future AR On-Set

LiDAR/room scan aligns virtual coordinates with real studio. Tablet/phone can show `place L3 here, 2.15m high, aimed at face mark` overlays。

## 298. Core Product Architecture — V2

```text
User brief/reference
        ↓
Intent + Claim Parser
        ↓
Subject / Material Analyzer
        ↓
Shot Role Planner
        ↓
Camera Solver
        ↓
Lens / DOF Solver
        ↓
Lighting / Reflection Solver
        ↓
Grip / Movement Solver
        ↓
Atmosphere / Effects Solver
        ↓
Continuity State Machine
        ↓
Real / AI / Hybrid Feasibility
        ↓
3D Virtual Studio
        ↓
Storyboard / Previs
        ↓
Technical PDF / SVG
        ↓
Seedance / Veo / Runway / Kling adapters
```

## 299. The Core Moat

本プロダクトの本質は「機材の3Dカタログ」ではない。

```text
曖昧なクリエイティブ意図
⇅
撮影監督の視覚判断
⇅
物理的なカメラ・レンズ・光・反射・動き
⇅
実現可能なスタジオ配置
⇅
生成AIが理解しやすい具体的な撮影言語
```

を双方向変換する **Cinematography Reasoning Engine / Virtual DP System** である。

## 300. V2 Official Reference URLs

- ARRI ALEXA 35: https://www.arri.com/en/camera-systems/cameras/alexa-35
- ARRI SkyPanel: https://www.arri.com/en/lighting/led-panels
- ARRI Orbiter: https://www.arri.com/en/lighting/led-spotlights/orbiter
- ARRI TRINITY / Stabilizer Systems: https://www.arri.com/en/camera-systems/camera-stabilizer-systems
- Aputure Electro Storm XT26: https://aputure.com/EN-US/products/electro-storm-xt26
- Aputure XT26 Photometrics: https://help.aputure.com/en/esxt26/photometrics-specifications
- Freefly Ember S5K: https://freeflysystems.com/ember-s5k
- Freefly Alta X: https://freeflysystems.com/alta-x/specs
- Vision Research Phantom: https://www.phantomhighspeed.com/
- DJI Inspire 3: https://www.dji.com/inspire-3
- Motion Impossible AGITO: https://motion-impossible.com/
- Chapman Leonard: https://www.chapman-leonard.com/

# ============================================================================
# V3 — FILM / DRAMA / PRACTICAL SPECIAL EFFECTS EXPANSION
# 映画・ドラマ・CM・MV・ドキュメンタリー・ライブ・スチール・VFX・特効まで含む総合撮影OS
# ============================================================================

## 864. 対象領域の再定義

本Knowledge Baseの対象は広告・商品撮影だけではない。映画、配信/TVドラマ、短編、CM、MV、ドキュメンタリー、ENG、ライブ、スポーツ、ファッション、Beauty、Food、Automotive、Architecture、Still、Tabletop、Macro、High-Speed、Aerial、Underwater、VFX、Virtual Production、Motion Capture、Volumetric、Special Effects、Stunt、Miniature、Stop Motion、Scientific Imagingを含む。

撮影技法は `Direction / Cinematography / Lighting / Grip / Practical SFX / Stunts / Art / Props / Costume / Hair & Makeup / Sound / VFX / VP / DIT / Color / Aerial / Underwater / Motion Control / Still` の連携として扱う。

---

# 865. SPECIAL EFFECTS / 特効 MASTER TAXONOMY

映画・ドラマの「特効」は爆発だけではなく、カメラ前に物理現象を作るPractical/Physical Effects全般を指す。

```text
ATMOSPHERIC
├─ haze / fog / low fog / smoke / steam / dust / mist
WEATHER
├─ rain / storm rain / snow / sleet / wind / gust / blowing leaves / wet-down
WATER
├─ splash / spray / wave / dump / water cannon / rain bar / controlled leak
FIRE & HEAT
├─ practical flame / fireplace / flame line / torch / ember / heat distortion
PYRO & IMPACT — SPECIALIST ONLY
├─ cinematic explosion / fireball / debris burst / impact / bullet-hit representation
MECHANICAL
├─ breakaway glass / wall / furniture / moving wall / tilting set / rotating room / shaker set
FLYING & RIGGING
├─ wire flying / performer lift / object flight / controlled pull / FX winch
VEHICLE FX
├─ process trailer / picture vehicle rigs / shake / rain / practical atmosphere
MATERIAL FX
├─ frost / ice / condensation / mud / slime / foam / bubbles / blood / powder / breakage
```

---

# 866. SFX SAFETY MODEL

```yaml
safety_class:
  A: routine_controlled_effect
  B: trained_sfx_grip_pilot_or_rigger_required
  C: licensed_or_specialist_only
```

Class Cは火炎、Pyro、爆発表現、major vehicle stunt、performer flying、危険な高圧/高荷重effect等を含む。Knowledge Baseは「どう撮るか」を詳細化するが、爆発物・発火物の製作、charge量、detonator、自作危険装置の手順は持たない。実運用はSFX Supervisor、licensed pyrotechnician、Stunt Coordinator、Rigger、現地法令・permit・risk assessmentを正とする。

---

# 867. RAIN EFFECT / 雨

雨は水そのものではなく `drop × background contrast × backlight × shutter × lens × wind` で画になる。

```yaml
rain:
  intensity: 0.0-1.0
  drop_character: fine | medium | cinematic_large
  density:
  fall_angle_deg:
  wind_drift:
  foreground_density:
  background_density:
  ground_splash:
  roof_runoff:
  wardrobe_wetness:
  hair_wetness:
  lens_droplets:
  street_wetness:
```

### 見せ方
- back / side-back lightでdropを拾う
- dark backgroundでコントラストを作る
- long lensで雨層を圧縮すると密度が高く見える
- 24fps/180°は自然、短いshutterは粒を鋭く、48–120fpsはimpactを見せる
- heavy rainは前景/中景/背景の3層を作る

### Rig categories
`rain bar / rain wand / rain tower / overhead rain grid / sprinkler array / vehicle rain rig / window rain / recirculating stage rain`

### Continuity
actor wetness、hair clumping、garment darkening、puddle、prop wetnessをstate化。dry→wetの不可逆性から撮影順も提案する。

---

# 868. WIND EFFECT / 風

風は見えないため、hair / wardrobe / foliage / smoke / dust / rain angle / debrisで可視化する。

```yaml
wind:
  source_class:
  speed_visual:
  direction_deg:
  turbulence:
  gust_pattern:
  preroll_s:
  ramp_s:
  hold_s:
  decay_s:
```

用途別初期プリセット:
- Beauty hair: rear-side 30–60°、穏やかな変動
- Fashion dress: side/rear-side、裾の開きと身体方向を同期
- Storm: irregular gust + rain drift + safe lightweight debris
- Smoke shaping: localized narrow airflow

業務用wind machineはDMX/variable speed対応製品も存在し、映画・広告のcue制御に組み込める。

---

# 869. STORM DESIGN

Stormは単一effectではなくstack。

```yaml
storm:
  rain: heavy
  wind: gusting
  haze: moderate
  ground: wet
  debris: lightweight_controlled
  lightning_light_cues: true
  practical_noise: high
```

Sound収録との競合、衣装wetness、dialogue ADR/MOSの可能性までshot planに出す。

---

# 870. SNOW

`gentle / wet / blizzard / foreground flakes / accumulation / blowing snow` を分離。Backlightとdark backgroundでflakeを見せ、long lensで密度を上げる。専用snow machineをequipment classとして扱う。

```yaml
snow:
  flake_size_visual:
  density:
  fall_speed:
  wind_vector:
  accumulation:
  foreground_bokeh_flakes:
```

---

# 871. HAZE / FOG / LOW FOG / STEAM / SMOKE

- Haze: beamとdepthを見せる均一微粒子
- Fog: visible cloud
- Low fog: ground-hugging
- Steam: motivated/local, food/industrial
- Smoke: narrative plume

HVAC、door、fan、take durationでdensityが変化するためcontinuityを追う。

---

# 872. FIRELIGHT WITHOUT VISIBLE FIRE

Off-camera fireはlighting cueで再現可能。warm source + irregular intensity + slight chromatic change +低いmotivation。規則的なelectronic pulseにならないようランダム性を持たせる。

---

# 873. PRACTICAL FIRE — SPECIALIST ONLY

Visible flameは専門SFX。撮影側は flame exposure / skin exposure / heat shimmer / reflections / smoke / high-speed / multi-camera / VFX element captureを計画する。火炎の近傍にカメラや人物を置く判断はSFX/Stuntのrisk assessmentを優先。

---

# 874. HEAT DISTORTION

火炎が画外でもheat shimmerが長玉で顕著になる。意図的利用はdesert/fire/industrial、不要なcloseupではsourceとのline-of-sightを見直す。

---

# 875. EXPLOSION CINEMATOGRAPHY — SPECIALIST ONLY

Explosion shotは `initial flash / fireball / debris / dust / smoke / interactive light / environment reaction / aftermath` のレイヤーとして設計する。実物/CG/Hybridの比率をSFX/VFXが決める。

### Camera plan
- protected wide master
- long-lens detail
- approved remote/crash camera
- 48–120fps hero detail
- ultra-high-speed only when timescale requires
- clean plate / before-after / HDRI / lens grid / witness

24fpsは暴力的real-time、48–120fpsはhero action。火炎peakはambientより大幅に明るい可能性がありhighlight protectionが重要。

**Aesthetic camera distance ≠ safety distance**。UIは安全距離を自動生成せず、専門部署が設定したprotected zoneだけをimportする。

---

# 876. EXPLOSION + VFX HYBRID

```text
practical interaction / dust
+ controlled approved element
+ digital fire/debris extension
+ set destruction
+ interactive lighting
+ post camera reaction
+ sound
```

撮影時にclean plate、HDR reference、before/after geometry、environment textureを収録。

---

# 877. BULLET-HIT / IMPACT REPRESENTATION — SPECIALIST

Production approachは `professional practical / non-pyrotechnic practical / prosthetic-wardrobe / VFX / hybrid` の能力として保持。Knowledge Baseはtiming、camera、fps、wardrobe state、blood visibility、reset、duplicates、VFX platesを扱い、Pyro device構造は扱わない。

---

# 878. BLOOD EFFECT CINEMATOGRAPHY

Dark wardrobeではside/back separationが必要。High fpsはdropletを強調し、genreによって過剰に見えるためstyle parameter化。

```yaml
blood_fx:
  direction:
  amount_visual:
  wardrobe_state:
  practical_or_vfx:
  reset_cost:
```

---

# 879. BREAKAWAY GLASS / WALL / FURNITURE

Industry-approved breakaway scenic/propを専門部署が運用。普通の建築用glassで代用しない。撮影はbacklight、high-speed、multi-cam、clean plate、after-state、reset/duplicatesを計画。

---

# 880. DUST / DEBRIS

Particleはback/side lightで可視化。SFX/Artがcamera-safe lightweight materialを選定。Virtual Studioでは `particle_size_visual / density / launch_direction_visual / drag / airflow` を持つが、危険な発射装置の自作仕様は持たない。

---

# 881. SET SHAKE / TILTING / ROTATING SET

Earthquake、ship、dream、zero-gravity等。`mechanical shaker / tilting platform / rotating room / moving scenic / camera reaction` を別nodeとして扱う。Engineering/Stunt/SFXがspecialist。

Virtual Sceneは `set_rotation` と `world_gravity` を別パラメータにし、人物/propsの見え方をprevisする。

---

# 882. WIRE / FLYING / FX WINCH

Trajectory、performer pose、camera frustum、wire visibility、clean plate、lighting reflectionをTechvis。Rigging構造とperformer attachmentは認定stunt/flying/rigger側で設計。

---

# 883. LARGE WATER / WAVE / FLOOD

Water dump、wave、tank、large splash、vehicle splash。Cameraはsplash housing、高fps、backlight、multi-camera。Electrical/structural/drainageはspecialist planning。

---

# 884. MINIATURE DESTRUCTION

映画技法としてfirst-class扱い。Scale illusionは `camera height / lens / DOF / particle scale / motion speed / smoke behavior / lighting scale` の組合せ。Miniature + practical SFX + VFX extensionのHybridもrecipe化。

---

# 885. PRACTICAL + DIGITAL PHILOSOPHY

Practicalはinteractive light / real physics / actor interactionに強く、Digitalはscale / cleanup / repeatabilityに強い。最適解はHybridであることが多い。

---

# 886. DRAMA CINEMATOGRAPHY MODULE

CMの「一枚の完璧さ」と異なり、ドラマはblocking、eyeline、coverage、actor freedom、continuity、sound、relight speedを重視。Master→MS→CUで破綻しにくい360° playable lightingを設計する。

### Day Interior
windowをmotivationに hard sun + soft sky。

### Night Interior
practical pools + negative space + edge separation。

### Period Drama
candle/fire/gaslight等のhistorical motivationを現代fixtureでhidden reproduction。

### Horror
negative space / hard shaft / atmosphere / practical movement / selective reveal。

### Action
multi-camera / high-speed / remote / vehicle / drone / SFX / stunt / VFXを一つのevent matrixへ。

### Comedy
wider master、locked framing、timing優先。必ずしもshallow DOFにしない。

### Romance
soft motivation、foreground、longer lens、subtle camera move、rain/snowをstory-drivenに。

### Crime/Thriller
low-key、mixed practical color、wet street、haze、handheld/precise movementをtoneで選択。

### Sci-Fi/Fantasy
interactive LED、projection、wire、mechanical props、atmosphere、VP、VFX。

---

# 887. ACTION EVENT MATRIX

```yaml
action_event:
  event_type:
  performer_motion:
  vehicle_motion:
  sfx_layers: []
  debris:
  atmosphere:
  camera_count:
  fps_by_camera:
  remote_required:
  reset_cost:
  vfx_refs:
  stunt_required:
  specialist_effects_required:
```

---

# 888. SFX EQUIPMENT DATABASE FIELDS

```yaml
sfx_equipment:
  effect_category:
  mechanism_class:
  professional_only:
  cue_control:
  DMX:
  output_character:
  coverage:
  environmental_constraints:
  camera_considerations:
  audio_noise:
  reset:
  consumables:
  safety_class:
  source_url:
  verified_date:
```

---

# 889. EFFECT RECIPE SCHEMA

```yaml
effect_recipe:
  id:
  visual_goal:
  production_context:
  practical_components: []
  digital_components: []
  camera: {}
  lighting: {}
  sound: {}
  continuity: {}
  reset: {}
  vfx_capture: {}
  departments: []
  safety_class:
  prompt_translation:
```

---

# 890. EFFECT PHYSICS CONTINUITY

Generative videoでも以下を検査する。
- rain directionとwindが一致
- smoke driftが連続
- fireが周辺へinteractive lightを出す
- waterがsurfaceを濡らす
- explosion後にaftermathが残る
- broken objectは次shotでもbroken
- wardrobe wet/blood/dirt stateが継続
- snow accumulationが時間と整合

---

# 891. EFFECT STATE MACHINE

```text
SET_INTACT
→ PRE_EVENT
→ INITIAL_CUE
→ PRIMARY_EVENT
→ PARTICLE / WATER / FIRE DEVELOPMENT
→ SMOKE / AFTER-EFFECT
→ AFTERMATH
```

Shotごとにstateを生成AIへ明示する。

---

# 892. SFX + SOUND

Fan、rain pump、mechanical rig、foggerはnoise source。Dialogue sceneではwild lines、ADR、MOS effect pass、clean dialogue passをplanning optionとして出す。

---

# 893. SFX + LIGHTING

Rain→backlight、Smoke→beam visibility、Fire→practical source、Snow→backlight、Water→reflection、Wet-down→street specular。EffectsとCinematographyは独立ではない。

---

# 894. SFX + ART / COSTUME / MAKEUP

Set damage、wetness、soot、debris、torn clothing、blood、frost、mudをcontinuity stateとして一元管理。

---

# 895. SFX + VFX

```yaml
augmentation:
  mode: none | cleanup | extension | replacement | full_digital
  clean_plate:
  hdr_reference:
  tracking_reference:
  witness_camera:
```

---

# 896. SFX PREVIS / TECHVIS

表示:
- rain volume
- wind vector
- smoke/fog volume
- particle cone visualization
- water extent
- mechanical set movement
- camera frustum
- imported specialist-approved protected zones
- timeline cue markers

---

# 897. RESET COST / ONE-OFF EVENTS

```yaml
reset:
  time_class: instant | short | medium | long
  destructive: false
  duplicate_set_piece: false
  wardrobe_reset: false
```

Destructive/high-reset eventではmulti-camera recommendationを強くする。

---

# 898. MULTICAM FOR PRACTICAL EVENT

可能な場合、wide master、compressed detail、high-speed、approved remoteを同時収録しone-off effectを最大化。具体的なcamera protected positionはspecialist safety planからimport。

---

# 899. LIGHTING EFFECTS AS SFX NODES

Lightning、fire flicker、passing vehicle、train window chase、police/emergency color、TV、explosion interactive flashをtimed light cueとして管理。

---

# 900. FINAL SCOPE

本プロダクトは以下を一つのOSに統合する。

```text
CAMERA / LENS / FILTER / FOCUS / EXPOSURE
LIGHTING / ELECTRIC / GRIP / CAMERA MOVEMENT
AERIAL / UNDERWATER / HIGH-SPEED / STILL
FILM & DRAMA COVERAGE / PRODUCT / FASHION / FOOD
PRACTICAL SPECIAL EFFECTS / STUNT INTERFACE
VFX / VIRTUAL PRODUCTION / MOTION CONTROL
SET / MATERIAL / WEATHER / SUN / SOUND INTERACTION
CONTINUITY / EDIT / STORYBOARD / PROMPT COMPILATION
PDF / TECHVIS / EQUIPMENT DATABASE
```

名称としては **Virtual Film Production & Cinematography OS** が最も近い。


# V4 DEEP-DIVE ADDENDUM — IMPLEMENTATION-READY CINEMATOGRAPHY KNOWLEDGE

## 942. Film/Drama coverage philosophy

Drama lighting must survive blocking and coverage. Prefer motivated broad sources and zones that allow master, medium and close coverage; closeups can add negative fill and eye light without changing scene logic.

## 943. Shot/reverse-shot solver

Define line of action, eye-lines, focal family, camera heights and background screen direction. Preserve side-of-line unless an axis crossing is motivated by a neutral shot or visible camera move.

## 944. Master-to-close consistency

The closeup may be cosmetically improved, but key direction, practical motivation, time-of-day, wetness, smoke density and sun direction must remain continuous.

## 945. Multi-camera action

One-off/destructive practical events should increase simultaneous coverage score. Allocate a geography master, emotional/action medium, long-lens detail, high-speed optional, and specialist-approved remote camera when needed.

## 946. Rain visibility

Rain reads through contrast and scattering. Back/side-back sources and darker backgrounds reveal drops; long lenses compress layers and can make rainfall feel denser.

## 947. Wind continuity

Track base velocity, gust timing, direction and affected elements. Hair, wardrobe, foliage, smoke and rain direction should agree.

## 948. Smoke continuity

Track source, airflow, density and decay. Smoke must advect rather than remain static; HVAC and doors are continuity variables.

## 949. Practical fire photography

Treat flame as both subject and luminous practical. Protect highlights, track interactive light and heat distortion, and use specialist SFX for visible fire.

## 950. Explosion photography

Treat explosion as timed visual states: flash → expansion → debris/dust → smoke → aftermath. Camera coverage and exposure are cinematography decisions; construction and safety are specialist-only.

## 951. Breakaway photography

Shards/debris read with back/side light and higher fps. Use approved breakaway materials under SFX/Stunt/Props; track post-event state and duplicates.

## 952. Miniature scale illusion

Miniatures require camera height, depth of field, particle size, smoke behavior, lighting direction and temporal scaling to agree with intended full scale.

## 953. Glass dark-field

Place bright source/diffusion behind or around subject while reflecting black cards into edges. This makes transparent contours readable.

## 954. Chrome product lighting

Chrome shows the environment. Design white/black reflection geometry; adding raw frontal intensity rarely fixes an ugly chrome surface.

## 955. Wet street night

Wet-down raises specular reflections. Protect sign highlights, use haze sparingly, and maintain wetness/puddle continuity.

## 956. Skin lighting

Model diffuse and specular components separately. Broad sources make controllable highlights; negative fill restores shape in white rooms.

## 957. Food steam

Steam needs contrast and rear/side illumination. Coordinate food temperature, plume source, airflow and reset.

## 958. High-speed exposure

Exposure time = shutter_angle / 360 / fps. Raising capture fps at fixed shutter angle reduces exposure proportionally; the solver must compensate with light, aperture, EI or shutter angle.

## 959. High-speed flicker

Fixture output is insufficient as a metric. Store verified flicker behavior/PWM and dimming state; unknown practical LEDs are test-required.

## 960. Large source distance

Near large sources are soft but fall off quickly. Moving them farther makes exposure more even across blocking but decreases apparent size, so increase physical source size/output.

## 961. Negative fill

Negative fill is not “negative light”; it removes environmental bounce. Distance to subject strongly controls effect.

## 962. Lens/perspective

Perspective changes with camera position. Focal length changes framing/FOV at a fixed position; “telephoto compression” is primarily a consequence of moving farther away for equivalent framing.

## 963. Anamorphic

Store squeeze, close focus, flare, oval bokeh, edge behavior and distortion independently. Do not reduce anamorphic to blue streaks.

## 964. Macro

At high magnification, DOF is extremely shallow and vibration becomes visible. Product planning needs micro-scale flag/card positions and focus strategies.

## 965. Probe lens

Probe optics enable wide-macro perspectives from confined positions but are often light-hungry and collision-prone; include physical lens path in techvis.

## 966. Focus planning

Generate focus-distance timeline from camera and subject animation. Score difficulty from DOF, relative motion, occlusion and available light.

## 967. Dolly

Dolly motion has physical track/footprint; generate start/end positions, speed, easing and focus pull, not only “push in”.

## 968. Steadicam

Model as floating human inertia rather than perfect electronic stabilization. Include operator path envelope.

## 969. Gimbal

Model electronic stabilization with possible vertical walking signature; support low/high mode and motor payload/CG constraints.

## 970. Crane

Model pivot, arm/telescope, head pose, base footprint and collision. Telescopic reach is not equivalent to a vertical transform.

## 971. Motion control

Repeatability enables multi-pass VFX/product work. Store passes for clean plate, label, screen, reflection, particle and matte.

## 972. Drone gimbal vs FPV

Gimbal drone decouples horizon from flight attitude; FPV uses bank and pitch as part of visual language.

## 973. Drone payload

Compute body+lens+gimbal+wireless+FIZ+mount. Weight limit alone is not sufficient; CG, flight-time derating, wind and manufacturer limits matter.

## 974. Underwater

Port geometry changes FOV/focus behavior. Water absorbs red wavelengths; lighting distance and suspended particles affect backscatter.

## 975. Virtual production

Represent camera pose, lens focal/focus/iris, distortion, sync/genlock, render frustum, LED processor and off-camera reflection lighting.

## 976. VFX capture

Generate clean plate, HDRI, gray/chrome ball, color chart, lens grid, witness, LiDAR/photogrammetry requirements from shot complexity.

## 977. Color pipeline

Separate capture transform, scene-referred working space and output transform. Creative look is not the same as a LUT file.

## 978. Still flash

For motion freeze, t.1 flash duration matters more than nominal sync shutter. Store flash-energy and pulse-duration curves when available.

## 979. Focus stacking

For static macro stills, output near/far/step/count and verify subject/camera remains mechanically stable.

## 980. Cross polarization

Cross-polarized illumination suppresses many dielectric specular reflections and is useful for art/material documentation, but costs substantial light and may interact with screens/material birefringence.

## 981. Sound interaction

Fans, pumps, foggers, rain and mechanics create noise. Dialogue planner must flag MOS, wild lines, ADR or separate effects passes where relevant.

## 982. Continuity state machine

Props, liquids, ice, wardrobe, hair, wetness, damage, smoke and debris are stateful. A shot list is a sequence of state transitions, not independent frames.

## 983. Destructive reset

Destructive/high-reset events affect shooting order and multicamera value. Include reset time, duplicate props/set pieces and cleanup.

## 984. Genre as heuristic

Genre is a prior, not a rule. Horror may favor negative space and selective reveal; comedy may favor wider locked performance; user intent can override.

## 985. AI-video failure control

Split shots when branded geometry, hands, mirrors, complex liquids, long continuous paths or many simultaneous motions produce high generation risk.

## 986. Hybrid exact product

If exact packaging/logo is mandatory, recommend CG/real product plate composited with generated environment rather than relying on text/geometry persistence.

## 987. Prompt metric specificity

Translate XYZ/path data into natural language: camera height, distance, translation length, arc degrees, duration and focus target.

## 988. Lighting cue timeline

Timed lighting effects—lightning, passing car, fire flicker, explosion flash, pixel chase—should use cue nodes and be exportable to lighting-control adapters.

## 989. Live multicamera

Support tally, genlock/timecode, shading/matching, servo zoom/box lens, SMPTE-2110/network pathways and replay/high-frame-rate camera roles.

## 990. Sports

Prioritize predictable coverage and long-lens tracking, remote positions, goal/field POV, replay HFR and cable/rail systems; story grammar differs from commercial montage.

## 991. Documentary

Reliability, audio, zoom range, low-light, autofocus/manual ergonomics and rapid response may outrank shallow DOF or elaborate lighting.

## 992. Period drama

Motivate light from period-visible sources while using hidden modern fixtures; filtration/lens/production design should be separable aesthetic axes.

## 993. Rotating/tilting sets

Represent set transform separately from gravity and camera transform to simulate ship, gravity and dream effects. Specialist engineering required.

## 994. Wire work

Represent performer/object trajectory and camera/VFX visibility. Rig design and safe loads remain certified stunt/rigging responsibility.

## 995. Lightning

Film grammar usually needs a timed high-intensity lighting cue, interactive shadow change and delayed thunder; visible bolt can be VFX.

## 996. Snow

Depth comes from flake layers and backlighting. Foreground flakes should differ in scale/defocus from background snowfall.

## 997. Wetness material

Wet surfaces reduce diffuse appearance and increase specular response; update PBR material parameters and continuity state.

## 998. Haze

Haze lowers scene contrast as density rises and makes beams visible. Light aimed toward lens may veil the image; use flags and density control.

## 999. Product reflection solver

For specular materials optimize reflected white/black shapes, not simply lux at surface.

## 1000. Material-aware lighting

Diffuse: optimize irradiance; transparent: transmission/refraction; metal: environment reflection; translucent: backlighting/subsurface; skin: diffuse+specular.

## 1001. Sun engine

Use date/location for azimuth/elevation, shadow direction and golden/blue-hour windows. Never fake current legal drone status from static sun data.

## 1002. Power

Estimate current from watts/voltage but keep professional electrical distribution, load balancing, grounding and wet-set practice outside automatic DIY instruction.

## 1003. Rigging

3D scene must include rated mounting points, fixture/modifier mass, stand footprint, ballast and operator/cable paths; final rig approval belongs to qualified crew.

## 1004. Data provenance

Every measured equipment spec should carry source, verified date and confidence class. Subjective look scores must not masquerade as manufacturer facts.

## 1005. Archetype first

Model capability archetypes first, then map actual SKUs. This lets recommendations survive new releases and regional rental differences.

## 1005. Canonical shot data fields

```yaml
shot:
  id:
  role:
  purpose:
  timeline:
  scene_state:
  composition:
  camera:
  lens:
  exposure:
  focus:
  movement:
  lighting:
  grip:
  practical_fx:
  stunt_interface:
  vfx:
  audio:
  continuity:
  safety:
  equipment_requirements:
  prompt_fragments:
```

## 1006. Canonical practical FX fields

```yaml
practical_fx:
  category:
  visual_goal:
  practical_or_digital:
  safety_class:
  specialist_only:
  state_timeline:
  environmental_interaction:
  camera_dependencies:
  lighting_dependencies:
  sound_dependencies:
  continuity_keys:
  reset_class:
  vfx_capture_requirements:
```

## 1007. Canonical material fields

```yaml
material:
  base_color:
  roughness:
  metallic:
  transmission:
  ior:
  clearcoat:
  anisotropy:
  subsurface:
  wetness:
  microtexture:
```

## 1008. Product-level output bundle

Every project export should be able to produce:

1. Creative treatment
2. Shot list
3. Storyboard frames
4. Camera/lens/focus settings
5. Top/side/perspective camera diagrams
6. Lighting plot and photometric assumptions
7. Grip/camera movement plan
8. Practical FX cue and department sheet
9. Continuity sheet
10. VFX capture sheet
11. Equipment manifest with capability-first alternatives
12. Safety-class summary
13. Seedance/Veo/etc prompt pack
14. Canonical JSON project file
15. Production PDF
