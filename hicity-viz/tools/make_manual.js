const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  LevelFormat, TableOfContents, PageBreak, convertInchesToTwip,
} = require('docx');
const fs = require('fs');

const ACCENT = '1C5CAB';
const RED = 'C62828';
const GRAY = '5A6472';
const TABLE_W = 9360;   // 6.5in in DXA

const P = (text, opts = {}) => new Paragraph({
  spacing: { after: opts.after ?? 120, line: 300 },
  alignment: opts.align,
  children: [new TextRun({ text, size: opts.size ?? 21, color: opts.color, bold: opts.bold, italics: opts.italics })],
});

const H1 = t => new Paragraph({ text: t, heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 160 } });
const H2 = t => new Paragraph({ text: t, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } });
const H3 = t => new Paragraph({ text: t, heading: HeadingLevel.HEADING_3, spacing: { before: 180, after: 100 } });

const BULLET = (text, level = 0) => new Paragraph({
  numbering: { reference: 'bullets', level },
  spacing: { after: 60, line: 290 },
  children: [new TextRun({ text, size: 21 })],
});

const NOTE = (title, body) => new Table({
  columnWidths: [TABLE_W],
  width: { size: TABLE_W, type: WidthType.DXA },
  borders: {
    top: { style: BorderStyle.SINGLE, size: 6, color: 'E0B4B4' },
    bottom: { style: BorderStyle.SINGLE, size: 6, color: 'E0B4B4' },
    left: { style: BorderStyle.SINGLE, size: 18, color: RED },
    right: { style: BorderStyle.SINGLE, size: 6, color: 'E0B4B4' },
    insideHorizontal: { style: BorderStyle.NONE },
    insideVertical: { style: BorderStyle.NONE },
  },
  rows: [new TableRow({
    children: [new TableCell({
      width: { size: TABLE_W, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: 'FDF3F3' },
      margins: { top: 140, bottom: 140, left: 180, right: 180 },
      children: [
        new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: title, bold: true, size: 21, color: RED })] }),
        ...body.map(t => new Paragraph({ spacing: { after: 60, line: 290 }, children: [new TextRun({ text: t, size: 20 })] })),
      ],
    })],
  })],
});

const TBL = (headers, rows, widths) => new Table({
  columnWidths: widths,
  width: { size: TABLE_W, type: WidthType.DXA },
  borders: {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'C8CDD6' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'C8CDD6' },
    left: { style: BorderStyle.SINGLE, size: 4, color: 'C8CDD6' },
    right: { style: BorderStyle.SINGLE, size: 4, color: 'C8CDD6' },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'DDE1E8' },
    insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'DDE1E8' },
  },
  rows: [
    new TableRow({
      tableHeader: true,
      children: headers.map((h, i) => new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: 'EEF3FA' },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 19, color: ACCENT })] })],
      })),
    }),
    ...rows.map(r => new TableRow({
      children: r.map((c, i) => new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: String(c).split('|').map(line => new Paragraph({
          spacing: { after: 20, line: 280 },
          children: [new TextRun({ text: line, size: 19 })],
        })),
      })),
    })),
  ],
});

const doc = new Document({
  creator: 'HICity 3D Dashboard',
  title: '羽田イノベーションシティ 3Dダッシュボード 使用マニュアル',
  numbering: {
    config: [{
      reference: 'bullets',
      levels: [
        { level: 0, format: LevelFormat.BULLET, text: '●', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: convertInchesToTwip(0.3), hanging: convertInchesToTwip(0.18) } } } },
        { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: convertInchesToTwip(0.6), hanging: convertInchesToTwip(0.18) } } } },
      ],
    }],
  },
  styles: {
    default: {
      document: { run: { font: 'Yu Gothic', size: 21 } },
      heading1: { run: { font: 'Yu Gothic', size: 30, bold: true, color: ACCENT } },
      heading2: { run: { font: 'Yu Gothic', size: 25, bold: true, color: '1A1F26' } },
      heading3: { run: { font: 'Yu Gothic', size: 22, bold: true, color: '39424F' } },
    },
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    children: [
      /* ===== 表紙 ===== */
      new Paragraph({ spacing: { before: 1400, after: 60 }, children: [
        new TextRun({ text: 'HANEDA INNOVATION CITY', size: 20, color: ACCENT, bold: true, characterSpacing: 60 })] }),
      new Paragraph({ spacing: { after: 100 }, children: [
        new TextRun({ text: '羽田イノベーションシティ', size: 44, bold: true })] }),
      new Paragraph({ spacing: { after: 300 }, children: [
        new TextRun({ text: '3Dダッシュボード 使用マニュアル', size: 36, bold: true })] }),
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 12, color: ACCENT } },
        spacing: { after: 240 }, children: [new TextRun({ text: '' })] }),
      P('人流データ・IFC図面・PLATEAU 3D都市モデルを統合した、周辺エリアを含むインタラクティブな都市デジタルツインです。単一のHTMLファイルで動作します。', { size: 22 }),
      new Paragraph({ spacing: { before: 240, after: 400 }, children: [
        new TextRun({ text: '版数: 1.0 ／ 作成: 2026年8月 ／ 対象ファイル: HICity_3Dダッシュボード.html', size: 19, color: GRAY })] }),

      NOTE('本資料および本プロダクトの位置づけ（必ずお読みください）', [
        '本プロダクトは技術検証・提案用の「デモ」です。表現力と操作性の確認を目的としており、実運用を前提とした精度・網羅性・保守性は担保していません。',
        '駅の構内配置、新空港線（蒲蒲線）の線形・駅位置、駅ビルの形状は、公開情報をもとにした想定・概形であり、実際の設計とは異なります。',
        '2026年シナリオ、経済波及効果、駅乗降人員の一部、エリア滞留人口は推計値・概算値です。実測値ではありません。',
        '所要時間、列車の運行間隔は実ダイヤを参考にした目安であり、実際の時刻表とは異なります。',
        '本資料は上記を前提とした操作説明書であり、掲載数値を業務判断の根拠として用いることは想定していません。',
      ]),

      new Paragraph({ children: [new PageBreak()] }),

      /* ===== 目次 ===== */
      H1('目次'),
      new TableOfContents('目次', { hyperlink: true, headingStyleRange: '1-3' }),
      new Paragraph({ spacing: { after: 100 }, children: [
        new TextRun({ text: '※ Wordで開いた際、目次上で右クリック→「フィールド更新」を実行するとページ番号が反映されます。', size: 18, color: GRAY })] }),

      new Paragraph({ children: [new PageBreak()] }),

      /* ===== 1 ===== */
      H1('1. はじめに'),
      H2('1.1 このプロダクトでできること'),
      P('羽田イノベーションシティ（以下HICity）を中心に、大田区全域と羽田空港を3D空間で可視化したダッシュボードです。次の4つの視点を1つの画面で行き来できます。'),
      BULLET('施設の中 — HICityの実施設計図面（IFC）をフロア別に3D表示し、実測の人流データを再生する'),
      BULLET('駅の中 — 蒲田・京急蒲田・大森・大井町・天空橋・羽田空港各駅などを階層構造モデルで表示する'),
      BULLET('街全体 — PLATEAU 3D都市モデルによる大田区約19.3万棟の建物、道路網、鉄道、水域、空港施設'),
      BULLET('時間の変化 — 時刻を進めると列車が走り、駅とエリアの人の密度が変化する'),

      H2('1.2 動作環境'),
      TBL(['項目', '内容'], [
        ['対応ブラウザ', 'Google Chrome / Microsoft Edge / Safari の最新版（WebGL2対応が必要）'],
        ['推奨環境', '独立GPU搭載のPC。ノートPCの内蔵GPUでも動作しますが、描画が重い場合はレイヤーを減らしてください'],
        ['インターネット', '不要（航空写真レイヤーを使う場合のみ必要）'],
        ['ファイル', 'HICity_3Dダッシュボード.html（約13MB、単一ファイル）'],
      ], [2600, 6760]),

      H2('1.3 起動方法'),
      P('HTMLファイルをダブルクリックするか、ブラウザにドラッグ＆ドロップしてください。インストールやサーバーは不要です。初回表示までデータ展開に数秒かかります。'),

      new Paragraph({ children: [new PageBreak()] }),

      /* ===== 2 ===== */
      H1('2. 画面構成と基本操作'),
      H2('2.1 画面の構成'),
      TBL(['エリア', '内容'], [
        ['中央（3Dビュー）', '都市・施設・駅・人流を表示するメイン画面。マウス操作で自由に視点を変えられます'],
        ['左パネル', 'すべての表示切替とシミュレーション操作。上から順にフロア／人流リプレイ／周辺エリア／駅・路線／経路検索／シナリオ／表示設定'],
        ['右下カード', '選択中のシナリオの指標（来訪指数・平均滞在・年間来訪・経済波及）'],
        ['右上テキスト', 'データ出典と注記'],
      ], [2600, 6760]),

      H2('2.2 マウス操作'),
      TBL(['操作', '動作'], [
        ['左ドラッグ', '視点の回転'],
        ['右ドラッグ', '平行移動（パン）'],
        ['ホイール', 'ズームイン／アウト'],
        ['クリック', '駅構造・駅ビル・新駅をクリックすると、その場所へカメラが移動します'],
        ['カーソルを重ねる', 'ヒートマップのセル、駅の各階、路線、エリアヒートの詳細情報が吹き出しで表示されます'],
      ], [2600, 6760]),

      new Paragraph({ children: [new PageBreak()] }),

      /* ===== 3 ===== */
      H1('3. 機能別の使い方'),

      H2('3.1 フロア（IFC図面）'),
      P('HICityの実際の設計図面（IFCモデル5棟）から抽出したフロアプランを表示します。'),
      BULLET('チェックボックス（RF／3F／2F／1F／B1F）で表示する階を切り替えます'),
      BULLET('「フロア展開」スライダーを右に動かすと階の間隔が広がり、各階の図面を上から確認できます'),
      BULLET('「図面ライン」は壁・カーテンウォール・階段の輪郭、「フロア面の塗り」は床面の表示です'),
      BULLET('「図面モード」ボタンで背景が青図調になり、図面が読みやすくなります'),

      H2('3.2 滞留ヒートマップ（施設内）'),
      P('2020年9月18日〜22日に計測されたK-field位置ログを、フロア別2mメッシュで合算した滞留マップです。カーソルを重ねると、そのセルの延べ滞在時間が表示されます。'),

      H2('3.3 人流リプレイ'),
      P('実測された人・ロボット・モビリティの動きを、時刻を進めながら再生します。'),
      TBL(['操作項目', '説明'], [
        ['日付ボタン', '9/18（金）〜9/22（火祝）の5日分を切り替え。平日と連休の違いを比較できます'],
        ['時刻スライダー', '0:00〜24:00の任意の時刻へジャンプ'],
        ['再生／一時停止', '再生の開始と停止'],
        ['×60／×240／×900', '再生速度。×900では1日を約1分半で再生します'],
        ['カテゴリ', 'スタッフ／ビジター／ロボット／モビリティの表示切替。右端の数字はその時刻に稼働中のタグ数'],
      ], [2600, 6760]),

      H2('3.4 周辺エリア（街の表示）'),
      TBL(['レイヤー', '内容'], [
        ['◆点群／航空写真／両方', '街の表示モード。「点群」は建物を点とラインで表現、「航空写真」は地理院タイル（要インターネット）'],
        ['建物点群', '高さで色分けした建物の点群表現'],
        ['建物ボリューム（LOD1）', 'PLATEAUの実測高に基づく建物のワイヤーフレーム表示'],
        ['道路網', '幹線道路・生活道路（バイオレット系）。首都高は高架＋橋脚で立体表示'],
        ['鉄道（実線形）', 'OpenStreetMapの実際の線路形状'],
        ['水域・空港・区境界', '多摩川／東京湾、滑走路・誘導路・エプロン、大田区の境界線'],
      ], [2600, 6760]),

      H2('3.5 駅構造・路線'),
      P('主要9駅を階層構造モデルで、その他24駅を簡易ホームで表示します。各階にはホーム、線路（バラスト・レール・枕木）、ホーム縁の警戒線、階段（橙）・エスカレーター（黄）・エレベーター（緑）、改札ゲートを配置しています。'),
      BULLET('「移動」ボタンで各駅へワンクリックで移動できます。赤いボタンは新空港線の新駅です'),
      BULLET('「列車運行」をONにすると、時間帯別の運転間隔（朝ラッシュは増発、深夜は運休）で列車が走ります'),
      BULLET('「駅勢圏ヒート」は駅乗降人員と時間帯を掛け合わせた人の集まり具合を表示します'),
      BULLET('「エリア滞留ヒート」は大田区15エリアの滞在人口推計を時刻連動で表示します'),

      H2('3.6 新空港線（蒲蒲線）— 赤色の構想路線'),
      P('大田区が公表している整備案をもとにモデル化した、未開業の構想路線です。実在の路線と区別するため、すべて赤系で表示し、地面越しにも見えるようにしています。'),
      TBL(['表現', '意味'], [
        ['赤の実線', '第1期（矢口渡〜東急蒲田地下駅〜京急蒲田地下駅）'],
        ['赤の破線', '第2期（京急蒲田〜糀谷付近〜大鳥居で空港線に接続）'],
        ['オレンジの筒', 'トンネル断面のイメージ'],
        ['黄色の三角', '地下化区間の坑口（矢口渡付近）'],
        ['赤い箱と停車中の列車', '新設される地下駅（東急蒲田地下駅・京急蒲田地下駅）'],
        ['白い破線・白い筒', '既存駅への連絡通路と、地上へつながる縦動線'],
      ], [2600, 6760]),

      H2('3.7 経路検索'),
      P('出発駅と到着駅を選んで「経路を表示」を押すと、経路が3Dでハイライトされ、所要時間の目安が表示されます。'),
      BULLET('鉄道区間はシアン、徒歩連絡は白の破線、新空港線区間は赤で表示されます'),
      BULLET('「新空港線（構想）を利用」のチェックを切り替えると、開業前後の所要時間を比較できます'),
      BULLET('例：蒲田→羽田空港第3ターミナルは、現行 約22分に対し、新空港線利用で約13分（−9分）と表示されます'),

      H2('3.8 シナリオ（2020／2026）'),
      P('画面右下のカードと連動し、2020年の実測値と2026年の推計3シナリオを切り替えます。'),
      TBL(['シナリオ', '来訪指数', '平均滞在', '経済波及（総合）'], [
        ['2020 実測', '100', '42.4分', '—'],
        ['2026 低位', '220（×2.2）', '55分', '約59億円/年'],
        ['2026 中位', '320（×3.2）', '64分', '約89億円/年'],
        ['2026 高位', '460（×4.6）', '76分', '約128億円/年'],
      ], [2340, 2340, 2340, 2340]),
      P('2026年シナリオを選ぶと、ビジターの粒子が推計倍率に応じて複製表示され、来訪増加のイメージを視覚化します。', { size: 20, color: GRAY }),

      new Paragraph({ children: [new PageBreak()] }),

      /* ===== 4 ===== */
      H1('4. 活用シーン別の操作例'),

      H3('例1：HICity内の混雑を確認する'),
      BULLET('「移動」→「HICity」を押す'),
      BULLET('日付を9/18（金）、再生速度を×240にして再生'),
      BULLET('「フロア展開」を2.0前後にして各階を見比べる'),
      BULLET('滞留ヒートマップにカーソルを重ね、延べ滞在時間を確認する'),

      H3('例2：新空港線の効果を説明する'),
      BULLET('「移動」→「新駅:京急蒲田地下」を押し、地下新駅の構造を見せる'),
      BULLET('経路検索で「蒲田→羽田空港第3ターミナル」を実行する'),
      BULLET('「新空港線（構想）を利用」のチェックをON/OFFして所要時間の差を示す'),

      H3('例3：街の1日の動きを見せる'),
      BULLET('ズームアウトして大田区全体を画面に収める'),
      BULLET('再生速度を×900にして再生する'),
      BULLET('朝は住宅地から人が減り商業地と物流エリアが濃くなる、夜は逆転する動きを確認する'),

      new Paragraph({ children: [new PageBreak()] }),

      /* ===== 5 ===== */
      H1('5. データの出典と精度'),
      TBL(['データ', '出典', '精度・扱い'], [
        ['施設図面', 'HIC_Building A〜E（IFCモデル5棟）', '実データ'],
        ['施設内人流', 'K-field位置ログ 2020/9/18〜22（1秒間隔・約280万件）', '実測。ただしタグ装着者（実証実験参加者・スタッフ・ロボット）のみの計測で、施設全体の来訪者数ではありません'],
        ['建物', 'PLATEAU 3D都市モデル 大田区2023年度版（CityGML）約19.3万棟', '実測高（measuredHeight）。区外はOpenStreetMapを併用'],
        ['道路・鉄道・水域・空港', 'OpenStreetMap（ODbL）', '実データ'],
        ['航空写真', '地理院タイル（シームレス空中写真）', '実データ'],
        ['駅乗降人員', '京急電鉄2024年度公表値ほか', '公表値。複合駅・他社局分は概算'],
        ['駅構内配置', '公開情報に基づく想定', '模式モデル。実際の構造とは異なります'],
        ['新空港線', '大田区公表の整備案イメージ', '想定線形。構想段階であり確定情報ではありません'],
        ['エリア滞留人口', '国勢調査等をもとにした推計', '推計値'],
        ['2026年推計・経済波及', '公開情報に基づく係数の積み上げ', '試算値。実測・公式値ではありません'],
      ], [1900, 3200, 4260]),

      H2('5.1 このデモで作り込んでいない点'),
      P('本プロダクトはデモンストレーションを目的としているため、次の点は簡略化しています。実運用に向けては、それぞれ実データへの差し替えが必要です。', { color: GRAY }),
      BULLET('駅の内部構造は、ホーム・改札・昇降設備の位置関係を示す模式モデルです。実際の通路形状や出入口の数は反映していません'),
      BULLET('列車は運転間隔による近似で、実際の時刻表・列車種別・行先は再現していません'),
      BULLET('経路検索の所要時間は距離と平均速度からの概算で、実際の乗換時間や待ち時間は含みません'),
      BULLET('人流リプレイは2020年9月の5日間のみで、季節変動や現在の状況は反映していません'),
      BULLET('建物は高さのみを持つ立体（LOD1相当）で、外観の意匠や内部構造は含みません'),
      BULLET('大量のデータを単一HTMLに埋め込んでいるため、低スペック端末では動作が重くなる場合があります'),

      new Paragraph({ children: [new PageBreak()] }),

      /* ===== 6 ===== */
      H1('6. 困ったときは'),
      TBL(['症状', '対処'], [
        ['動作が重い・カクつく', '「建物点群」または「建物ボリューム（LOD1）」のチェックを外す。滞留ヒートや駅勢圏ヒートもOFFにすると軽くなります'],
        ['航空写真が表示されない', 'インターネット接続を確認してください。地理院タイルをオンラインで取得しています'],
        ['画面が真っ暗', 'ブラウザがWebGL2に対応しているか確認してください。Chrome/Edgeの最新版を推奨します'],
        ['視点を見失った', '「視点リセット」ボタン、または「移動」→「HICity」を押してください'],
        ['列車が走らない', '再生が一時停止していないか、シミュレーション時刻が深夜帯（運休時間）になっていないか確認してください'],
        ['地下の新駅が見えない', '「新空港線 蒲蒲線」のチェックがONか確認してください。地下要素は地面越しに表示される設定です'],
      ], [2600, 6760]),

      H1('7. 収録ファイルと再構築'),
      P('本プロダクトのソースコードと生成スクリプトは、GitHubリポジトリ（ブランチ: claude/haneda-innovation-city-viz-qzst0y、ディレクトリ: hicity-viz/）に格納されています。'),
      TBL(['ファイル', '内容'], [
        ['index.html', '3Dダッシュボード本体（データ同梱の単一ファイル）'],
        ['report.html', '2D統計レポート（チャート版）'],
        ['HANDOFF.md', '技術引き継ぎ資料（座標系・ビルド手順・残タスク）'],
        ['tools/', 'アプリのソースとデータ生成スクリプト一式'],
      ], [2600, 6760]),
      P('データの更新やシナリオの変更方法は、HANDOFF.mdの「ビルドパイプライン」章を参照してください。', { size: 20, color: GRAY }),

      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: 'C8CDD6' } },
        spacing: { before: 400, after: 100 }, children: [new TextRun({ text: '' })] }),
      P('本プロダクトはデモンストレーション用途で作成されたものであり、掲載されている推計値・想定モデルを業務判断の根拠として利用することは想定していません。', { size: 18, color: GRAY }),
      P('地図データ © OpenStreetMap contributors（ODbL） ／ 3D都市モデル: Project PLATEAU（国土交通省） ／ 航空写真: 地理院タイル', { size: 18, color: GRAY }),
    ],
  }],
});

Packer.toBuffer(doc).then(b => {
  fs.writeFileSync('HICity_3Dダッシュボード_使用マニュアル.docx', b);
  console.log('written', b.length);
});
