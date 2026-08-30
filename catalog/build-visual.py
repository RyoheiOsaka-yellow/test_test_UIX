#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""8作品のスクリーンショットを XBUILD 事例集デザインの単一 HTML に組む。
画像は 大1(1600w)・中3(1100w)・小〜6(760w) に整えて JPEG data URI で埋め込む。"""
import base64, io, json, os, sys
from PIL import Image

SP = os.environ['SP']
SHOTS = os.path.join(SP, 'shots')
OUT = '/home/user/test_test_UIX/catalog/catalog-visual.html'

W_L, W_M, W_S = 1600, 1100, 760
Q_L, Q_M, Q_S = 82, 80, 78

def jpeg_uri(path, width, quality):
    im = Image.open(path).convert('RGB')
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=quality, optimize=True, progressive=True)
    ar = round(im.width / im.height, 4)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode(), ar, len(buf.getvalue())

# ---- 各作品: (id, ドメイン表記, タイトル, lead, ギャラリー, 本文, 仕様, 備考) ----
def S(work, name, cap):
    return {'f': os.path.join(SHOTS, work, name + '.png'), 'cap': cap}

CASES = [
dict(
  id='case-01', cat='表現 ／ リアルタイム流体', title='tonbo ink — 触れる流体絵画',
  lead='WebGPUのコンピュートシェーダでナビエ–ストークス方程式を解き、墨・朱・橙のインクが和紙の上で混ざり合うインタラクティブ絵画。なぞった軌跡から顔料が流れ出し、手を止めても2つの点滴が絵を描き続けます。',
  main=S('w01','idle-drips','tonbo ink｜点滴が巡る待機状態 — 橙と朱の渦'),
  mids=[S('w01','main-stroke','tonbo ink｜墨ストロークと点滴の混色'),
        S('w01','vortex','tonbo ink｜円を描くストロークによる渦'),
        S('w01','two-strokes','tonbo ink｜縦2筆 — 筆速に応じた墨の濃度')],
  smalls=[S('w01','fast-stroke','tonbo ink｜速い一筆 — 濃い墨が落ちる'),
          S('w01','early','tonbo ink｜描き始め — 顔料が広がる'),
          S('w01','mixed-long','tonbo ink｜長時間経過後の混色'),
          S('w01','zigzag','tonbo ink｜ジグザグのかき混ぜ')],
  bg='ブランドの世界観を「見る」から「触れる」に変える装置として制作。染料をRGBではなく顔料量として持ち、Beer–Lambert吸収（吸収係数＝−ln(インク色)）で紙白から減算するため、インクが重なると現実の絵具と同じように沈んで濁ります。',
  can=['なぞった軌跡に沿って墨が流れ出し、速く動かすほど濃くなる',
       '渦度閉じ込めで小さな渦を保存 — 本物のインクの巻き込みを再現',
       '放置すると2つの点滴が橙・朱を垂らし続け、絵が終わらない',
       '128×72の速度場と512×288の顔料場を毎フレームGPUで求解'],
  use='常設サイネージ、展示ブースの壁面、企業サイトのヒーロー。ここで確立した「場を解いて可視化する」GPUパイプラインは後続の現象シミュレーション・都市可視化の基盤になっています。',
  spec=[('分類','インタラクティブアート（リアルタイム流体）'),
        ('技術','WebGPU ／ WGSL compute ／ vgpu 0.3.1'),
        ('モデル','Navier–Stokes（圧力射影・渦度閉じ込め）＋ Beer–Lambert減法混色'),
        ('入力','ポインタ（速度→墨の濃度）'),
        ('動作要件','WebGPU対応ブラウザ（Chrome / Edge / Safari）'),
        ('提供形態','単一HTML（23KB）')],
  note='※ 掲載画像は、撮影環境がWebGPU非対応のため、同一アルゴリズム・同一パラメータをCPUに移植して再現したレンダリングです。',
),
dict(
  id='case-02', cat='表現 ／ ジェネラティブ', title='TESSERA — quadtree field',
  lead='画面全体をひとつの正方形として四分木で再帰分割し続けるフィールド。動きのある場所ほど細かく刻まれ、静かな場所は大きな面のまま残ります。季節が移ろい、カメラ入力による非接触操作にも対応。',
  main=S('w02','vortex','TESSERA｜円ドラッグで場を乱す — 分散フェーズ'),
  mids=[S('w02','season2','TESSERA｜季節フェーズの移ろい（1）'),
        S('w02','season3','TESSERA｜季節フェーズの移ろい（2）'),
        S('w02','cross','TESSERA｜対角2本のドラッグによる乱れ')],
  smalls=[S('w02','calm','TESSERA｜静止状態 — 大きな面が残る'),
          S('w02','stir1','TESSERA｜横切るドラッグ直後'),
          S('w02','settle1','TESSERA｜沈静化していく場'),
          S('w02','season4','TESSERA｜季節フェーズの移ろい（3）'),
          S('w02','season-wait','TESSERA｜放置後の自律的な変化'),
          S('w02','later','TESSERA｜長時間経過後のフィールド')],
  bg='「注意が集まる場所ほど解像度を上げる」という適応分割の考え方を、そのまま絵にした作品。6,000個体のエージェントが場のノイズに従って漂流し、その密度が四分木の分割深度を決めます。',
  can=['局所エネルギーに応じた適応的四分木分割（最大深度7・2,000超のリーフセル）',
       'ドラッグ／タッチで場に触れて個体を散らす',
       'ダブルタップで季節（フェーズ）を切替え、配色と挙動が変わる',
       'カメラのフレーム差分によるモーション検出で、画面に触れない操作（AIR）'],
  use='ミュージアム・商業施設・イベントの常設インタラクション。専用センサー不要でカメラだけの非接触入力が成立するため、不特定多数が通る空間に向きます。',
  spec=[('分類','ジェネラティブアート（適応分割）'),
        ('技術','Canvas 2D ／ 適応的Quadtree ／ getUserMedia'),
        ('個体数','6,000 AGENTS ／ LEAF CELLS 2,000超'),
        ('入力','ポインタ・タッチ・カメラ（モーション検出）'),
        ('動作要件','モダンブラウザ（AIRはhttps/localhostのみ）'),
        ('提供形態','単一HTML（47KB）')],
),
dict(
  id='case-03', cat='表現 ／ 数理エンジン', title='fish — 群れを泳がせる（Boids）',
  lead='結束・整列・分離の3つの操舵力だけで96匹の魚の群れを成立させるシミュレーション。全バッファを起動時に確保し、フレーム中のメモリアロケーションはゼロ。mathcatカーネルの実証デモです。',
  main=S('w03','school','fish｜96匹の群れ — 8節の体が頭を追いかける'),
  mids=[S('w03','feed','fish｜クリックで餌を落とすと群れが殺到する'),
        S('w03','cohesion','fish｜結束を最大に — 密集する群れ'),
        S('w03','separation','fish｜分離を最大に — 散開する群れ')],
  smalls=[S('w03','angle','fish｜ドラッグで視点を回転'),
          S('w03','top','fish｜俯瞰ぎみの視点'),
          S('w03','feed2','fish｜給餌直後の集合'),
          S('w03','page','fish｜デモページ全体 — パラメータと仕組みの解説')],
  bg='「個の単純なルールから全体の挙動が立ち上がる」系のシミュレーション基盤。vec3／mat4／random／easing／colorのカーネル関数だけで、操舵・積分・体の追従・カメラ・逆射影のすべてを構成しています。',
  can=['結束・整列・分離・速度の4パラメータをスライダーで操作し、群れの性格を変える',
       'クリック位置を逆射影して水槽内に餌を落とす（数秒間の殺到行動）',
       '8節の距離拘束による体の追従と、泳速に比例する尾びれの振り',
       'ゼロアロケーション設計 — GCによるカクつきが原理的に発生しない',
       'シード付き乱数 — リロードしても同じ群れが再現される'],
  use='群衆流動・交通・生態系シミュレーションの基盤。ゼロアロケーションと再現性は、サイネージや組込み機器での長時間安定動作という実務要件に直結します。',
  spec=[('分類','技術デモ（群知能・性能設計）'),
        ('技術','Canvas 2D ／ mathcatカーネル（vec3・mat4・random・easing・color）'),
        ('個体','96匹 × 8節 ／ 60fps ／ 0 allocations/frame'),
        ('入力','ドラッグ（視点）・クリック（餌）・スライダー×4'),
        ('再現性','シード付き乱数（決定論的）'),
        ('提供形態','単一HTML（29KB）')],
),
dict(
  id='case-04', cat='学び ／ 科学教材', title='PHENOMENA — 世界のしくみを、触って理解する。',
  lead='22の宇宙・332の現象を収めた実験室コレクション。二重振り子からローレンツ方程式、ライフゲーム、量子、ブラックホールまで、すべての現象がパラメータ付きで遊べる単一HTMLの教材プラットフォームです。',
  main=S('w04','pendulum','PHENOMENA｜二重振り子ラボ — プリセット・パラメータ・モデル解説'),
  mids=[S('w04','home','PHENOMENA｜ホーム — 「もし、こうしたら？」から実験室へ'),
        S('w04','lorenz','PHENOMENA｜ローレンツアトラクタ'),
        S('w04','blackhole','PHENOMENA｜ブラックホール — 光の湾曲')],
  smalls=[S('w04','life','PHENOMENA｜ライフゲーム'),
          S('w04','wave','PHENOMENA｜波の実験室'),
          S('w04','gravity','PHENOMENA｜重力・軌道'),
          S('w04','quantum','PHENOMENA｜量子の実験室'),
          S('w04','sync','PHENOMENA｜同期（蔵本モデル）'),
          S('w04','browse','PHENOMENA｜現象をさがす — 332現象の索引')],
  bg='きれいな表現を「わかる」に変えるための設計。各ラボはHOOK（問い）→TRY THIS→NOTICE→WHY→MODEL（数式と数値解法）の順に潜れる構造で、遊びが仮説検証になります。',
  can=['22宇宙・332現象すべてがプリセット・パラメータ・初期条件付きで動く',
       '「あそぶ／見る／しくみ」の3モードで段階的に深く潜れる',
       '状態をURLにシリアライズして共有 — 先生が作った初期条件をリンクで配布',
       '全ラボ動作検査（既知解との一致テスト）を内蔵 — 教材の正しさを教材自身が証明',
       'モデル欄に数式と数値解法（例: ラグランジアン→RK4, Δt=1/240s）を明記'],
  use='科学館の常設展示、学校のICT教材、企業のR&D説明資料。1ファイル配布で成立するため、ネットワーク制限の厳しい学校・自治体でも運用できます。',
  spec=[('分類','教育プラットフォーム（インタラクティブ教材）'),
        ('規模','22宇宙 ／ 332現象 ／ 単一HTML 639KB'),
        ('構成','HOOK→TRY→NOTICE→WHY→MODEL の5段階解説'),
        ('共有','URL状態シリアライズ'),
        ('品質保証','全ラボ自己診断テスト内蔵'),
        ('提供形態','単一HTML（サーバー・インストール不要）')],
),
dict(
  id='case-05', cat='建築 ／ 生成デザイン', title='SF建築 手描きドラフター',
  lead='つまみを動かすたび、鉛筆で図面が引き直される。建築・ロボット・航空機・艦船の4ジャンル×スタイルを、手描きの温度を保ったまま無限に生成するドラフターです。凡例・方位・作図記録まで図面の作法で出力します。',
  main=S('w05','sheet2','手描きドラフター｜THIN SHELL DIAGRAM — 薄殻構造のスタディ'),
  mids=[S('w05','robot','手描きドラフター｜ロボット（労働機）の機体図面'),
        S('w05','lineart','手描きドラフター｜線画モード — 塗り絵として配布可能'),
        S('w05','sheet3','手描きドラフター｜別シードの建築案')],
  smalls=[S('w05','sheet1','手描きドラフター｜初期生成の図面'),
          S('w05','sheet4','手描きドラフター｜パラメータ変更後の再生成'),
          S('w05','ship','手描きドラフター｜艦船ジャンル'),
          S('w05','aircraft','手描きドラフター｜航空機ジャンル'),
          S('w05','drawing-anim','手描きドラフター｜描画アニメ — 線が引かれていく過程')],
  bg='「10案見せてください」に数分で応えるための道具。SVGフィルタ（feTurbulence＋displacement）でペン先の揺らぎと紙の滲みを再現し、CADの冷たさを避けて初期案に「まだ決まっていない」余白を残します。',
  can=['FORM／STRUCTURE／SITE／MEDIAのつまみで即時に図面を再生成',
       '同じシードなら同じ図面 — つまみ1つの差分比較ができる乱数設計',
       '描画アニメで線が引かれる過程を見せる／線画モードで塗り絵化',
       '凡例・方位・SHEET LOG（ストローク数・パーツ数・作図時間・用紙・画材）を自動生成',
       'PNG／高解像度書き出しで印刷にも対応'],
  use='建築の初期スタディ、コンペのイメージ出し、クライアントとの発散フェーズ、子ども向けワークショップ。「大量に出して選ぶ」という設計行為を、絵の温度を落とさず自動化しています。',
  spec=[('分類','プロシージャル図面生成'),
        ('技術','SVGフィルタ（feTurbulence）／ Canvasストローク逐次描画'),
        ('ジャンル','建築・ロボット・航空機・艦船 × 各4〜8スタイル'),
        ('再現性','シードベース（同条件で同一図面）'),
        ('書き出し','PNG ／ 高解像度 ／ 線画（塗り絵）'),
        ('提供形態','単一HTML（139KB）')],
),
dict(
  id='case-06', cat='建築・製造 ／ 3Dツイン', title='FLOW·LAB 3D — 工場シミュレーション + BIM/MEP',
  lead='塗料工場の敷地から建屋内部まで踏み込める3Dツイン。第一ペイント工場の内部には分散ミル・ディスパー槽・調合槽・KVタンク・缶充填ラインが工程順に並び、ダクト・配管12系統のMEPレイヤーと干渉チェックまで検証できます。',
  main=S('w06','interior-closeup','FLOW·LAB｜第一ペイント工場 内部 — KVタンク・調合槽・KOYO缶充填機・製品置場'),
  mids=[S('w06','interior-bim','FLOW·LAB｜BIM表示 — MEP12系統（給排気ダクト・プロセス配管・電気ラック等）'),
        S('w06','interior-iso','FLOW·LAB｜建屋内部の全景 — 設備配置と工程レイアウト・現地写真参照'),
        S('w06','interior-drawing','FLOW·LAB｜図面モード — 白背景のアイソメ調表示')],
  smalls=[S('w06','interior-clash','FLOW·LAB｜干渉チェック — ダクト×配管の衝突8件を自動検出'),
          S('w06','interior-closeup2','FLOW·LAB｜設備クローズアップ — 充填ラインまわり'),
          S('w06','interior-play','FLOW·LAB｜稼働再生 — 作業者が工程間を歩行'),
          S('w06','interior-schematic','FLOW·LAB｜MEP系統図'),
          S('w06','site-iso','FLOW·LAB｜敷地全体 — 建屋配置と物流動線'),
          S('w06','site-congestion','FLOW·LAB｜混雑表示 — 動線のボトルネック')],
  bg='工場のレイアウト・移転計画で、建屋配置と設備配置が物流効率に与える影響を動かしながら定量評価するために構築。敷地全体のSLP評価と、建屋内部の設備単位の検討を同じ画面で行き来できます。',
  can=['建屋をダブルクリックして内部へ — 30種超の設備を工程順に配置した精密モデル',
       '設備をドラッグ移動すると搬送距離・動線交差・最長動線・物流工数／日を即時再計算',
       'BIM表示でMEP12系統（ダクト4種・配管5種・電気ラック・空調機械・支持架台）を重畳',
       '干渉チェックでダクト×配管などの物理衝突を列挙し、クリックでズーム',
       '現地写真パネルで実物と3Dモデルを突き合わせ',
       '図面モード・系統図・稼働再生（作業者／フォークリフト）・配置のJSON書出／読込'],
  use='製造業の設備投資判断、移転・増改築の事前検討、施工前の合意形成。生産技術・建築設計・経営が同じ画面を見ながら議論する共通言語になります。',
  spec=[('分類','3Dデジタルツイン（製造・BIM/MEP）'),
        ('技術','WebGL（three.js）／ SLP評価関数'),
        ('主要指標','搬送距離／日・動線交差・最長動線・物流工数／日（人時）'),
        ('レイヤー','設備30種超 ／ MEP12系統 ／ 干渉チェック ／ 現地写真'),
        ('モード','敷地⇄建屋内部・BIM・図面・系統図・稼働再生・生産性分析'),
        ('提供形態','単一HTML（4MB）')],
),
dict(
  id='case-07', cat='体験 ／ 什器設計・見積', title='GREEN×EXPO 2027 展示什器 3Dエディター',
  lead='2027年国際園芸博覧会へ向けた7種の展示什器を、ブラウザ上で設計・見積もるエディター。寸法・躯体素材・体験機構パーツを選ぶと、3Dモデルと概算見積（設計費・運搬施工費・税込合計）が同時に更新されます。',
  main=S('w09','carbon-iso','什器3Dエディター｜01 カーボンリサイクル体験ゾーン（鶴見区）— 構成パーツと概算見積が連動'),
  mids=[S('w09','carbon-explode','什器3Dエディター｜分解ビュー — アクリルボックス・トップサイン・機構が展開する'),
        S('w09','quiz','什器3Dエディター｜02 クイズ！みなとみらいのリサイクル — タッチパネルとステッカーディスペンサー'),
        S('w09','carbon-dims','什器3Dエディター｜寸法表示 — W900×D750×H2000を正面ビューで確認')],
  smalls=[S('w09','mizu','什器3Dエディター｜03 水運び（横浜市水道局）'),
          S('w09','wall','什器3Dエディター｜04 ウォール型什器'),
          S('w09','animal','什器3Dエディター｜05 アニマル型什器'),
          S('w09','dark','什器3Dエディター｜06 ダーク（暗所演出）什器'),
          S('w09','orbit','什器3Dエディター｜07 オービット什器'),
          S('w09','carbon-preview','什器3Dエディター｜動作プレビュー — ボール循環機構が動く')],
  bg='展示企画（鶴見区・みなとみらい21区・横浜市水道局）を什器の実施設計へ進めるための道具。提案時の「こんな什器です」を、寸法・素材・パーツ単価つきの構成としてその場で編集し、顧客と合意できます。',
  can=['7種の什器プリセット（カーボン／クイズ／水運び／ウォール／アニマル／ダーク／オービット）',
       'W・D・Hスライダーと躯体素材（リボード・木工・再生アルミ）、化粧シート／塗装色を即時反映',
       '体験機構パーツ（透明アクリルボックス・連動モニター・ハンドル発電・ワイヤートラック等）のON/OFFが見積に連動',
       '分解ビューで構成パーツを展開、寸法表示・動作プレビュー・正面／側面／背面／俯瞰・自動回転',
       '概算見積を自動計算 — 1台小計→台数→設計・デザイン費(15%)→運搬・施工費→消費税→税込合計',
       '見積CSV出力、PNG保存・4面PNG一括で提案資料用の図版を書き出し'],
  use='展示什器の実施設計・概算見積の即時提示・制作会社との仕様共有。企画書（体験デモ）から実施（寸法と金額）まで、同じブラウザの中で往復できます。',
  spec=[('分類','什器3Dエディター（設計・見積）'),
        ('対象','GREEN×EXPO 2027 展示什器 7種'),
        ('編集','寸法（W/D/H）・躯体素材・化粧色・体験機構パーツ'),
        ('ビュー','全景・正面・側面・背面・俯瞰・分解・寸法・動作プレビュー'),
        ('見積','パーツ単価連動 ／ 設計費15%・運搬施工費・税10% ／ CSV出力'),
        ('書出','PNG ／ 4面PNG一括 ／ 見積CSV'),
        ('提供形態','単一HTML（2.9MB・外部ライブラリ非依存）')],
),
dict(
  id='case-08', cat='行政 ／ 都市データ', title='羽田イノベーションシティ 3Dダッシュボード',
  lead='実在の街・羽田イノベーションシティの人流・図面ダッシュボード。IFC図面由来のフロアモデルを展開し、K-field実測位置ログ（2020/9/18–22）の人流をリプレイ。新空港線（蒲蒲線）構想の経路検索や2026年シナリオ比較まで、街の意思決定を1画面で支えます。',
  main=S('w08','floors-expanded','羽田3D｜フロア展開×3.0 — IFC図面ラインと滞留ヒートマップが層で見える'),
  mids=[S('w08','overview','羽田3D｜全景 — フロア別レイヤーと人流リプレイ'),
        S('w08','blueprint','羽田3D｜図面モード — 街全体がワイヤーフレームの姿になる'),
        S('w08','closeup','羽田3D｜HICityクローズアップ — 滞留セルと駅構造')],
  smalls=[S('w08','replay','羽田3D｜人流リプレイ — 実測ログを時刻で再生（×240）'),
          S('w08','station-rail','羽田3D｜駅構造（階層モデル）と路線'),
          S('w08','scenario','羽田3D｜2026年シナリオ（高位）— 来訪指数・平均滞在の推計'),
          S('w08','route','羽田3D｜経路検索 — 新空港線（構想）利用の有無を比較'),
          S('w08','wide-rail','羽田3D｜広域 — 大田区全域の点群・鉄道実線形・多摩川')],
  bg='エリアマネジメントとインフラ投資判断のための可視化基盤。表現（GPU描画）・学び（パラメータUI）・建築（レイヤー比較）で培った技術が、実在都市の意思決定の道具に収束した最終章です。',
  can=['IFC図面由来のフロア（B1F〜RF・5,000超セル）をスライダーで展開',
       'K-field実測位置ログ（2020/9/18–22・5日間）の人流を時刻・倍速でリプレイ',
       '滞留ヒートマップ・図面ライン・バス経路などレイヤーを個別に重畳',
       '駅構造の階層モデル・路線の高さプロファイル・駅勢圏ヒートを表示',
       '新空港線（蒲蒲線・構想）の有無を切り替えた経路検索',
       '2026年シナリオ（低・中・高）で来訪指数・平均滞在・経済波及を比較'],
  use='エリアマネジメント、テナント誘致、交通インフラの投資判断、行政オープンデータの可視化。出典と推計箇所を画面上に明示し、閉域の庁内ネットワークでも単一ファイルで動作します。',
  spec=[('分類','都市3Dダッシュボード（行政・実在エリア）'),
        ('データ','HIC建物IFC ／ K-field実測人流 ／ OpenStreetMap ／ 地理院タイル'),
        ('主要指標','来訪指数・平均滞在・年間来訪・経済波及（2026年は推計）'),
        ('レイヤー','フロア5層・滞留ヒート・バス経路・点群・鉄道・水域・空港'),
        ('機能','人流リプレイ・フロア展開・図面モード・経路検索・シナリオ比較'),
        ('提供形態','単一HTML（13.6MB）・オフライン動作')],
),
]

STEPS = [
 ('01','EXPRESSION','表現をつくる','流体・分割・群れ。触れた瞬間に応答が返る「場の計算」をリアルタイムで走らせる技術の芯を、アートとして鍛える。','case-01'),
 ('02','LEARNING','学びに変える','パラメータとモデル式を露出させ、検証テストまで内蔵する。遊びが仮説検証になり、体験が理解になる。','case-04'),
 ('03','ARCHITECTURE','建築に落とす','案を大量に出す生成側と、案を数値で採点する評価側。発散と収束のループを設計の道具にする。','case-05'),
 ('04','ENTERTAINMENT','体験にひらく','設計したものを、来場者が身体で分かる展示に翻訳する。企画書の中でプロトタイプがそのまま動く。','case-07'),
 ('05','PUBLIC DESIGN','行政をデザインする','実在都市の3Dモデルの上で、実測データと推計を重ねて合意形成する。技術が街の意思決定の道具になる。','case-08'),
]

def esc(s): return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('"','&quot;')

def fig(shot, cls, no, size):
    w, q = {'L':(W_L,Q_L),'M':(W_M,Q_M),'S':(W_S,Q_S)}[size]
    uri, ar, nbytes = jpeg_uri(shot['f'], w, q)
    fig.total += nbytes
    cap = esc(shot['cap'])
    return (f'<figure class="shot {cls}" data-no="{no:02d}" style="aspect-ratio:1.6 / 1">'
            f'<img src="{uri}" alt="{cap}" data-caption="{cap}"></figure>')
fig.total = 0

parts = []
for c in CASES:
    figs = [fig(c['main'], 'shot--main', 1, 'L')]
    subs = ''.join(fig(m, 'shot--sub', i+2, 'M') for i, m in enumerate(c['mids']))
    strip = ''.join(fig(s, 'shot--small', i+5, 'S') for i, s in enumerate(c['smalls']))
    ncols = max(4, len(c['smalls']))
    can = ''.join(f'<li>{esc(x)}</li>' for x in c['can'])
    spec = ''.join(f'<tr><th>{esc(k)}</th><td>{esc(v)}</td></tr>' for k, v in c['spec'])
    note = f'<p class="co-note">{esc(c["note"])}</p>' if c.get('note') else ''
    parts.append(f'''
  <article class="sheet" id="{c['id']}">
    <header class="head">
      <p class="eyebrow"><span>WORKS ／ {esc(c['cat'])}</span></p>
      <h1 class="title">{esc(c['title'])}</h1>
      <p class="lead">{esc(c['lead'])}</p>
    </header>
    <section class="gallery" aria-label="スクリーンショット">
      {figs[0]}
      <div class="subs">{subs}</div>
    </section>
    <div class="strip" style="grid-template-columns:repeat({ncols},minmax(0,1fr))">{strip}</div>
    <section class="detail">
      <div class="body">
        <h2 class="h2">案件背景</h2><p>{esc(c['bg'])}</p>
        <h2 class="h2">できること</h2><ul>{can}</ul>
        <h2 class="h2">活用シーン</h2><p>{esc(c['use'])}</p>
      </div>
      <aside>
        <h2 class="h2">仕様</h2>
        <table class="spec"><tbody>{spec}</tbody></table>
        {note}
      </aside>
    </section>
  </article>''')

toc = ''.join(
    f'<li class="toc__item"><a href="#{c["id"]}"><span class="toc__no">{i+1:02d}</span>'
    f'<span class="toc__cat">{esc(c["cat"].split(" ／ ")[0])}</span>'
    f'<span class="toc__name">{esc(c["title"])}</span></a></li>'
    for i, c in enumerate(CASES))
jump = ''.join(f'<li><a href="#{c["id"]}"><b>{i+1:02d}</b> {esc(c["title"])}</a></li>' for i, c in enumerate(CASES))
steps = ''.join(
    f'<a class="co-card step" href="#{sid}"><p class="co-card__no">{n} ／ {en}</p>'
    f'<h2 class="co-card__h">{esc(jp)}</h2><p class="co-card__b">{esc(body)}</p></a>'
    for n, en, jp, body, sid in STEPS)

html = '''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>触れて、わかる。｜WORKS CATALOG</title>
<style>
:root{
  --ink:#111111; --paper:#FFFFFF; --accent:#FFD400;
  --line:#E6E6E6; --field:#F5F5F5;
  --gap:12px; --pad:clamp(24px,4vw,56px); --sheet:1120px;
  --font:"Noto Sans JP","Hiragino Kaku Gothic ProN","Yu Gothic Medium","Meiryo",system-ui,sans-serif;
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--font);font-size:15px;line-height:1.75;font-feature-settings:"palt" 1}
img{display:block;width:100%;height:100%;object-fit:cover}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
.sheet{max-width:var(--sheet);margin:0 auto;padding:var(--pad) var(--pad) 96px;scroll-margin-top:24px}
.sheet+.sheet{border-top:1px solid var(--line)}
.head{margin-bottom:28px}
.eyebrow{margin:0 0 14px;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;font-variant-numeric:tabular-nums}
.eyebrow span{display:inline-block;padding-bottom:5px;box-shadow:inset 0 -6px 0 var(--accent)}
.title{margin:0;font-size:clamp(30px,4.4vw,48px);font-weight:900;line-height:1.18;letter-spacing:-.02em}
.lead{margin:16px 0 0;max-width:60ch;font-size:clamp(15px,1.5vw,17px);line-height:1.85}
/* ギャラリー: 大1（左）＋中3（右列） */
.gallery{display:grid;grid-template-columns:minmax(0,19fr) minmax(0,6fr);gap:var(--gap);align-items:start;margin:0 0 var(--gap)}
.subs{display:grid;grid-template-columns:1fr;gap:var(--gap);align-content:start}
/* 小: 横並びストリップ */
.strip{display:grid;gap:var(--gap);margin:0 0 40px}
.shot{position:relative;margin:0;overflow:hidden;background:var(--field);cursor:zoom-in}
.shot::after{content:"";position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06);transition:box-shadow .18s ease}
.shot:hover::after,.shot:focus-visible::after{box-shadow:inset 0 0 0 5px var(--accent)}
.detail{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,4fr);gap:var(--gap) 48px;border-top:1px solid var(--line);padding-top:36px}
.h2{margin:0 0 12px;font-size:13px;font-weight:800;letter-spacing:.14em}
.body>*+.h2{margin-top:34px}
.body p{margin:0;max-width:62ch}
.body ul{margin:0;padding:0;list-style:none}
.body li{position:relative;padding-left:20px;margin-bottom:8px}
.body li::before{content:"";position:absolute;left:0;top:.72em;width:9px;height:9px;background:var(--accent)}
.spec{width:100%;border-collapse:collapse;font-size:14px}
.spec th,.spec td{padding:11px 0;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}
.spec th{width:38%;font-weight:800;padding-right:12px}
.spec td{font-variant-numeric:tabular-nums}
.co-note{margin:22px 0 0;font-size:12px;line-height:1.8;padding:12px 16px;background:var(--field)}
/* 表紙・目次 */
.cover{max-width:var(--sheet);margin:0 auto;padding:clamp(48px,9vh,120px) var(--pad) clamp(28px,4vh,56px)}
.cover__eyebrow{margin:0 0 16px;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;font-variant-numeric:tabular-nums}
.cover__eyebrow span{display:inline-block;padding-bottom:5px;box-shadow:inset 0 -6px 0 var(--accent)}
.cover__title{margin:0;font-size:clamp(40px,7vw,84px);font-weight:900;line-height:1.14;letter-spacing:-.02em}
.cover__lead{margin:20px 0 0;max-width:56ch;font-size:clamp(15px,1.6vw,18px);line-height:1.85}
.cover__meta{margin:28px 0 0;font-size:13px;font-weight:800;letter-spacing:.14em;font-variant-numeric:tabular-nums}
.co-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px;margin:44px 0 0;padding-top:28px;border-top:1px solid var(--line)}
.co-stats dt{font-size:clamp(26px,3.4vw,40px);font-weight:900;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.co-stats dd{margin:10px 0 0;font-size:12px;font-weight:700;letter-spacing:.04em}
.co-cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:var(--gap)}
.co-card{background:var(--field);padding:26px 22px}
.co-card__no{margin:0 0 14px;font-size:11px;font-weight:800;letter-spacing:.1em;font-variant-numeric:tabular-nums}
.co-card__no::after{content:"";display:block;width:24px;height:4px;margin-top:8px;background:var(--accent)}
.co-card__h{margin:0 0 10px;font-size:16px;font-weight:800}
.co-card__b{margin:0;font-size:12.5px;line-height:1.8}
a.step{display:block;text-decoration:none;color:inherit;transition:background .15s}
a.step:hover{background:#efefef}
.toc{max-width:var(--sheet);margin:0 auto;padding:0 var(--pad) clamp(48px,8vh,96px)}
.toc__label{display:inline-block;margin:0 0 22px;padding-bottom:6px;font-size:13px;font-weight:800;letter-spacing:.14em;box-shadow:inset 0 -6px 0 var(--accent)}
.toc__list{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.toc__item{border-bottom:1px solid var(--line)}
.toc__item a{display:grid;grid-template-columns:52px 150px 1fr;gap:16px;align-items:baseline;padding:15px 0;text-decoration:none;color:inherit}
.toc__no{font-weight:800;font-variant-numeric:tabular-nums}
.toc__cat{font-size:12px;font-weight:800;letter-spacing:.08em}
.toc__name{font-weight:700;line-height:1.4}
.toc__item a:hover .toc__name,.toc__item a:focus-visible .toc__name{box-shadow:inset 0 -.5em 0 var(--accent)}
/* ライトボックス */
.lb[hidden]{display:none}
.lb{position:fixed;inset:0;z-index:99;background:rgba(17,17,17,.97);color:#fff;display:grid;grid-template-rows:auto 1fr auto}
.lb__bar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px clamp(16px,3vw,32px)}
.lb__count{font-size:13px;font-weight:800;letter-spacing:.14em;font-variant-numeric:tabular-nums}
.lb__count b{color:var(--accent)}
.lb__close{font-size:13px;font-weight:800;letter-spacing:.12em;padding:6px 4px}
.lb__close:hover{color:var(--accent)}
.lb__stage{position:relative;display:grid;place-items:center;padding:0 clamp(12px,6vw,80px);min-height:0}
.lb__img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain}
.lb__nav{position:absolute;top:50%;transform:translateY(-50%);width:clamp(40px,6vw,56px);height:clamp(40px,6vw,56px);display:grid;place-items:center;font-size:20px;line-height:1;border:1px solid rgba(255,255,255,.35);border-radius:50%}
.lb__nav:hover{background:var(--accent);color:var(--ink);border-color:var(--accent)}
.lb__nav--prev{left:clamp(8px,2vw,24px)}
.lb__nav--next{right:clamp(8px,2vw,24px)}
.lb__foot{padding:16px clamp(16px,3vw,32px) clamp(16px,3vw,28px)}
.lb__cap{margin:0 0 14px;font-size:14px;min-height:1.6em}
.lb__strip{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin}
.lb__thumb{flex:0 0 auto;width:66px;aspect-ratio:1/1;opacity:.45;transition:opacity .15s}
.lb__thumb[aria-current="true"]{opacity:1;box-shadow:0 0 0 2px var(--accent)}
.lb__thumb:hover{opacity:1}
/* ジャンプ */
.jump-btn{position:fixed;right:20px;bottom:20px;z-index:80;font-size:13px;font-weight:800;letter-spacing:.06em;padding:12px 18px;background:var(--ink);color:var(--paper);border:0;box-shadow:0 6px 24px rgba(0,0,0,.28)}
.jump-btn:hover{background:var(--accent);color:var(--ink)}
.jump-panel[hidden]{display:none}
.jump-panel{position:fixed;right:20px;bottom:72px;z-index:81;width:min(92vw,380px);max-height:calc(100dvh - 92px);overflow:auto;background:var(--paper);border:1px solid var(--ink);box-shadow:0 14px 44px rgba(0,0,0,.32)}
.jump-panel__head{position:sticky;top:0;display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:var(--ink);color:var(--paper);font-size:12px;font-weight:800;letter-spacing:.12em}
.jump-panel__head button{color:var(--paper);font-size:14px;font-weight:800}
.jump-list{list-style:none;margin:0;padding:4px 0}
.jump-list li{border-bottom:1px solid var(--line)}
.jump-list li:last-child{border-bottom:0}
.jump-list a{display:flex;gap:10px;padding:8px 16px;text-decoration:none;color:inherit;font-size:12.5px;line-height:1.5}
.jump-list a b{font-variant-numeric:tabular-nums}
.jump-list a:hover{background:var(--field)}
@media (max-width:900px){
  .gallery{grid-template-columns:1fr}
  .subs{grid-template-columns:repeat(3,minmax(0,1fr))}
  .strip{grid-template-columns:repeat(3,minmax(0,1fr))!important}
  .detail{grid-template-columns:1fr;gap:32px}
  .co-cards{grid-template-columns:repeat(2,minmax(0,1fr))}
  .co-stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
  .toc__item a{grid-template-columns:40px 1fr;gap:10px}
  .toc__cat{display:none}
}
@media (max-width:560px){
  .subs,.strip{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  .co-cards{grid-template-columns:1fr}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
@media print{
  .lb,.jump-btn,.jump-panel{display:none!important}
  .sheet{padding:0;max-width:none;break-before:page}
  .cover{break-after:page}
  .shot::after{display:none}
  .gallery,.detail,.strip{break-inside:avoid}
}
</style>
</head>
<body>

<header class="cover" id="intro">
  <p class="cover__eyebrow"><span>WORKS CATALOG 2026</span></p>
  <h1 class="cover__title">触れて、わかる。<br>そして、社会に置く。</h1>
  <p class="cover__lead">AIをはじめとする先端技術で、まずアート・表現・インタラクティブデザインをつくる。そこで育てた「場の計算」と「触れるUI」を、学びの教材へ、建築・製造の設計道具へ、展示体験へ、そして行政の意思決定ダッシュボードへ落とし込む。本カタログは、その一本の線を8つの実装でたどる記録です。</p>
  <p class="cover__meta">8 WORKS ／ 5 DOMAINS ／ ALL SINGLE-FILE HTML</p>
  <dl class="co-stats">
    <div><dt>8</dt><dd>WORKS</dd></div>
    <div><dt>5</dt><dd>領域（表現・学び・建築・体験・行政）</dd></div>
    <div><dt>100%</dt><dd>ブラウザのみで動作</dd></div>
    <div><dt>0</dt><dd>インストール・サーバー</dd></div>
  </dl>
</header>

<article class="sheet" id="story">
  <header class="head">
    <p class="eyebrow"><span>STORY ／ 表現から、社会実装へ</span></p>
    <h1 class="title">ひとつの技術が、5つの領域を通り抜ける。</h1>
    <p class="lead">8つの作品は独立した実験に見えて、順番があります。「おもしろい」を「役に立つ」へ翻訳していく5段階です。カードをクリックすると各章の代表作へ移動します。</p>
  </header>
  <div class="co-cards">__STEPS__</div>
</article>

<nav class="toc" aria-label="目次">
  <p class="toc__label">目次 ／ Contents</p>
  <ol class="toc__list">__TOC__</ol>
</nav>

__CASES__

<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="拡大表示" hidden>
  <div class="lb__bar">
    <p class="lb__count"><b id="lbNow">01</b> ／ <span id="lbTotal">01</span></p>
    <button class="lb__close" id="lbClose" aria-label="閉じる">CLOSE ✕</button>
  </div>
  <div class="lb__stage">
    <button class="lb__nav lb__nav--prev" id="lbPrev" aria-label="前の画像">‹</button>
    <img class="lb__img" id="lbImg" src="" alt="">
    <button class="lb__nav lb__nav--next" id="lbNext" aria-label="次の画像">›</button>
  </div>
  <div class="lb__foot">
    <p class="lb__cap" id="lbCap"></p>
    <div class="lb__strip" id="lbStrip"></div>
  </div>
</div>

<button class="jump-btn" id="jumpBtn" aria-label="作品一覧を開く">≡ 作品一覧</button>
<div class="jump-panel" id="jumpPanel" hidden>
  <div class="jump-panel__head"><span>目次 ／ 全8作品</span><button id="jumpClose" aria-label="閉じる">✕</button></div>
  <ol class="jump-list">__JUMP__</ol>
</div>

<script>
(function(){
  var lb=document.getElementById('lb'),lbImg=document.getElementById('lbImg'),
      lbCap=document.getElementById('lbCap'),lbNow=document.getElementById('lbNow'),
      lbTotal=document.getElementById('lbTotal'),strip=document.getElementById('lbStrip');
  var curImgs=[],thumbs=[],i=0,lastFocus=null;
  var pad=function(n){return String(n).padStart(2,'0');};
  function buildStrip(){
    strip.innerHTML='';
    thumbs=curImgs.map(function(img,n){
      var b=document.createElement('button');
      b.className='lb__thumb';
      b.style.background='url("'+img.getAttribute('src')+'") center/cover no-repeat #333';
      b.setAttribute('aria-label',(n+1)+'枚目を表示');
      b.addEventListener('click',function(){show(n);});
      strip.appendChild(b);return b;
    });
  }
  function show(n){
    i=(n+curImgs.length)%curImgs.length;
    var img=curImgs[i];
    lbImg.src=img.getAttribute('src');
    lbImg.alt=img.getAttribute('alt')||'';
    lbCap.textContent=img.getAttribute('data-caption')||'';
    lbNow.textContent=pad(i+1);
    thumbs.forEach(function(t,n2){t.setAttribute('aria-current',n2===i?'true':'false');});
    if(thumbs[i])thumbs[i].scrollIntoView({block:'nearest',inline:'nearest'});
  }
  function open(article,n){
    curImgs=[].slice.call(article.querySelectorAll('.shot img'));
    lbTotal.textContent=pad(curImgs.length);
    buildStrip();show(n);
    lastFocus=document.activeElement;
    lb.hidden=false;document.body.style.overflow='hidden';
    document.getElementById('lbClose').focus();
  }
  function close(){
    lb.hidden=true;document.body.style.overflow='';
    if(lastFocus)lastFocus.focus();
  }
  document.querySelectorAll('article.sheet').forEach(function(article){
    var shots=[].slice.call(article.querySelectorAll('.shot'));
    shots.forEach(function(shot,n){
      shot.setAttribute('tabindex','0');shot.setAttribute('role','button');
      var act=function(){open(article,n);};
      shot.addEventListener('click',act);
      shot.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();act();}});
    });
  });
  document.getElementById('lbClose').addEventListener('click',close);
  document.getElementById('lbPrev').addEventListener('click',function(){show(i-1);});
  document.getElementById('lbNext').addEventListener('click',function(){show(i+1);});
  lb.addEventListener('click',function(e){if(e.target===lb)close();});
  document.addEventListener('keydown',function(e){
    if(lb.hidden)return;
    if(e.key==='Escape')close();
    if(e.key==='ArrowLeft')show(i-1);
    if(e.key==='ArrowRight')show(i+1);
  });
  var jb=document.getElementById('jumpBtn'),jp=document.getElementById('jumpPanel');
  jb.addEventListener('click',function(){jp.hidden=!jp.hidden;});
  document.getElementById('jumpClose').addEventListener('click',function(){jp.hidden=true;});
  jp.addEventListener('click',function(e){if(e.target.closest('a'))jp.hidden=true;});
})();
</script>
</body>
</html>'''

html = html.replace('__STEPS__', steps).replace('__TOC__', toc).replace('__CASES__', ''.join(parts)).replace('__JUMP__', jump)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w') as f:
    f.write(html)
print(f'images total: {fig.total/1048576:.1f} MB')
print(f'html: {os.path.getsize(OUT)/1048576:.1f} MB -> {OUT}')
