import { Link } from 'react-router-dom';

interface Issue {
  title: string;
  facts: string[];
  answer: string;
  to: string;
  toLabel: string;
  sources: number[];
}

const SOURCES = [
  {
    label: '国土交通省「民間賃貸住宅の計画修繕ガイドブック(管理業者向け)」',
    url: 'https://www.mlit.go.jp/jutakukentiku/house/content/001750538.pdf',
  },
  {
    label: '日本建設業連合会 建設資材・労務費の資料(2026年7月版)',
    url: 'https://nikkenren.com/sougou/notice/pdf/Materialspamph_quarter_202607.pdf',
  },
  {
    label: '国土交通省「民間賃貸住宅の大規模修繕等に対する意識の向上に関する調査検討報告書」(2017年3月)',
    url: 'https://www.mlit.go.jp/common/001397674.pdf',
  },
  {
    label: '国土交通省「賃貸住宅の計画的な維持管理及び性能向上の推進について」(2019年3月)',
    url: 'https://www.mlit.go.jp/common/001285578.pdf',
  },
  {
    label: '国土交通省「民間賃貸住宅の計画修繕ガイドブック」',
    url: 'https://www.mlit.go.jp/common/001231406.pdf',
  },
  {
    label: '国土交通省 賃貸住宅管理業者等への立入検査結果(令和7年度)',
    url: 'https://www.mlit.go.jp/report/press/content/002004977.pdf',
  },
];

const ISSUES: Issue[] = [
  {
    title: '計画的な修繕が普及していない',
    facts: [
      '民間賃貸住宅は全国に約1,530万戸あり、住宅ストックの3割近くを占める。',
      '計画的に修繕を実施しているオーナーは約4割にとどまり、約2割は計画修繕を実施していない。',
      '背景は「必要性が理解されていない」「資金的な余裕がない」こと。',
    ],
    answer: '建物の状態を点数・配置図・写真で示し、「いつまでに・どこを・いくらで」を1画面で伝える。',
    to: '/properties/P-0001?view=owner',
    toLabel: 'オーナー向け表示を見る',
    sources: [0],
  },
  {
    title: '管理会社からの提案が、修繕実施の分かれ目になっている',
    facts: [
      '管理を委託している個人家主が修繕しない理由の最多は「管理会社等からの提案がない」(36.6%)。',
      '長期修繕計画を作成している家主は22.8%。作成している家主の修繕実施率は94.1%。',
      '計画修繕を実施していない管理業者の約4割が「提案したくてもノウハウがない」と回答。',
    ],
    answer: '類似物件との比較・修繕時期の目安・費用試算を自動で用意し、担当者の経験に頼らず同じ根拠で提案できるようにする。',
    to: '/properties/P-0001',
    toLabel: '建物カルテを見る',
    sources: [2, 0],
  },
  {
    title: '修繕が必要な時期が、部位ごとに違って把握しづらい',
    facts: [
      '一般的な目安は、外壁塗装が11〜18年目、屋根の塗装・補修が11〜15年目、防水・葺替が21〜25年目。',
      '鉄部塗装は4〜10年目、給湯器・エアコンの交換は11〜15年目、給排水管の取替は30年目。',
      '目安は建て方・資材・立地で前後するため、点検結果と合わせて判断する必要がある。',
    ],
    answer: '築年数と修繕記録を部位ごとの目安時期に重ね、「目安を過ぎているのに記録がない」部位を一目で分かるようにする。',
    to: '/properties/P-0001',
    toLabel: '修繕時期の目安を見る',
    sources: [4],
  },
  {
    title: '先送りは収益性を下げ、工事費も上がり続けている',
    facts: [
      '国交省の試算では、実質利回りは木造で計画修繕あり2.78%・なし2.13%、RC造であり2.53%・なし1.90%。',
      '建設資材物価は2021年6月比で5年間に39%上昇、直近2年でも9%上昇。',
      '「先送りで工事費が何割増えるか」の公的な実測値は見つかっておらず、画面の試算は仮定に基づく。',
    ],
    answer: '「今修繕する場合」と「放置した場合」の累積コストを並べ、前提の数値を画面上で変えて確かめられるようにする。',
    to: '/properties/P-0001',
    toLabel: '将来修繕シミュレーションを見る',
    sources: [3, 1],
  },
  {
    title: '修繕は入居率・家賃に直結する',
    facts: [
      '計画修繕を実施したオーナーの約3割が「高い入居率を確保できた」「家賃水準を維持できた」と回答。',
      '入居者の7割が、住み替え先選びで「住宅のいたみ・劣化」「維持管理」を重視。',
    ],
    answer: '修繕の履歴と前後写真を残し、「手入れされている物件」であることをオーナーにも示せるようにする。',
    to: '/records?tab=repairs',
    toLabel: '修繕履歴を見る',
    sources: [0],
  },
  {
    title: 'オーナーへの報告が抜けやすく、法令上のリスクにもなる',
    facts: [
      '管理を委託していても、修繕の実施状況を把握していない家主が12.3%いる。',
      '令和7年度の国交省の立入検査では168社中118社が是正指導を受け、定期報告義務の違反は17件。',
      '修繕履歴は少なくとも「実施期間・工事内容・金額・施工業者名」を記録することが求められている。',
    ],
    answer: '点検・提案・連絡・工事を物件ごとに1本の時系列で残し、オーナーに何を伝えたかを後から確認できるようにする。',
    to: '/properties/P-0001',
    toLabel: '連携記録を見る',
    sources: [2, 5, 0],
  },
  {
    title: '情報が分散し、対応が止まっても気づけない',
    facts: [
      '点検報告書・見積・オーナーとのやり取りが別々の場所にあると、指摘が「誰のボールか」分からなくなる。',
      'この項目を数値で示す公的・業界団体の調査は見つかっていません。プロダクトの前提としている仮説で、社内ヒアリングでの検証が必要です。',
    ],
    answer: '指摘ごとに対応状況を持たせ、停滞日数と推奨時期で並べる。',
    to: '/',
    toLabel: 'ダッシュボードを見る',
    sources: [],
  },
];

export default function Insights() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>修繕の課題と、このプロダクトの狙い</h1>
          <p className="sub">公的資料などで確認できた事実と、それに対応する画面をまとめています</p>
        </div>
      </div>

      <div className="issues">
        {ISSUES.map((it, i) => (
          <section className="card issue" key={it.title}>
            <div className="issue-no">{i + 1}</div>
            <div>
              <h2>{it.title}</h2>
              <ul>
                {it.facts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {it.sources.length > 0 && (
                <p className="src">
                  出典:{' '}
                  {it.sources.map((s) => (
                    <a key={s} href={SOURCES[s].url} target="_blank" rel="noreferrer">
                      {SOURCES[s].label}{' '}
                    </a>
                  ))}
                </p>
              )}
            </div>
            <div className="issue-answer">
              <small>このプロダクトでの対応</small>
              <p>{it.answer}</p>
              <Link to={it.to} className="btn">
                {it.toLabel}
              </Link>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
