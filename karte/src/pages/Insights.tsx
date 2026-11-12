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
    label: '日本建設業連合会「建設資材高騰・労務費の上昇等の現状」(2026年7月版)',
    url: 'https://nikkenren.com/sougou/notice/pdf/Materialspamph_quarter_202607.pdf',
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
    title: '管理会社側に提案のノウハウが足りない',
    facts: [
      '計画修繕を実施していない管理業者が全体の約2割。',
      'その理由の約4割が「提案したくてもノウハウがない」、約3割が「必要なときに修繕すれば十分」。',
    ],
    answer: '担当者の経験に頼らず、類似物件との比較と費用試算を自動で用意し、誰でも同じ根拠で説明できるようにする。',
    to: '/properties/P-0001',
    toLabel: '建物カルテを見る',
    sources: [0],
  },
  {
    title: '先送りするほど工事費が上がる',
    facts: [
      '建設資材物価は2021年6月比で5年間に39%上昇、直近2年でも9%上昇。',
      '労務費を含めた全建設コストは、直近2年で7.3〜8.2%上昇(日建連の試算)。',
    ],
    answer: '「今修繕する場合」と「放置した場合」の累積コストを並べ、前提の数値を画面上で変えて確かめられるようにする。',
    to: '/properties/P-0001',
    toLabel: '将来修繕シミュレーションを見る',
    sources: [1],
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
    title: '情報が分散し、対応が止まっても気づけない',
    facts: [
      '点検報告書・見積・オーナーとのやり取りが別々の場所にあると、指摘が「誰のボールか」分からなくなる。',
      'この項目は公的な統計ではなく、プロダクトの前提としている仮説です(社内ヒアリングで検証が必要)。',
    ],
    answer: '指摘ごとに対応状況を持たせ、停滞日数と推奨時期で並べる。物件ごとに点検・提案・連絡・工事を1本の時系列に残す。',
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
                      {SOURCES[s].label}
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
