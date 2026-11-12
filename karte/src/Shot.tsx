import building from './assets/building.jpg';
import type { Part } from './data';

// 提供いただいた建物写真(636×482)。1枚の写真から、全景・中景・近景を切り出して表示する。
const W = 636;
const H = 482;

export const SHOT_KINDS = ['全景', '中景', '近景'] as const;
export type ShotKind = (typeof SHOT_KINDS)[number];
export const kindOf = (i: number): ShotKind => (i === 0 ? '全景' : i === 1 ? '中景' : '近景');

/** 部位ごとの注目箇所(写真上の座標)。同じ部位でも箇所が違えば別の点を使う */
const FOCUS: Record<Part, [number, number][]> = {
  外壁: [
    [232, 218],
    [415, 250],
    [250, 405],
  ],
  屋根: [
    [300, 28],
    [205, 60],
  ],
  防水: [
    [245, 268],
    [235, 108],
  ],
  構造: [
    [160, 445],
    [470, 430],
  ],
  設備: [
    [452, 275],
    [313, 122],
  ],
};

const SHIFT = [
  [0, 0],
  [0, 0],
  [0, 0],
  [55, -12],
  [-55, 18],
  [25, 45],
  [-30, -40],
  [70, 30],
  [-70, -20],
  [10, -55],
];

function cropAround(fx: number, fy: number, w: number): [number, number, number, number] {
  const h = (w * 3) / 4;
  const x = Math.min(W - w, Math.max(0, fx - w / 2));
  const y = Math.min(H - h, Math.max(0, fy - h / 2));
  return [x, y, w, h];
}

export function Shot({
  part,
  kind,
  seed,
  after,
  aged,
  index = 0,
}: {
  part: Part;
  kind: ShotKind;
  /** 指摘ごとに固定の値。同じ指摘なら全景・中景・近景が同じ箇所を指す */
  seed: number;
  /** 修繕後・問題なし: 問題箇所の印を出さない */
  after?: boolean;
  /** 修繕前のイメージ: 色あせと汚れを重ねる(デモ用の加工) */
  aged?: boolean;
  /** 近景を複数枚並べるときの通し番号。少しずつ位置をずらして別カットにする */
  index?: number;
}) {
  const list = FOCUS[part];
  const [fx, fy] = list[Math.abs(Math.round(seed)) % list.length];
  const [x, y, w, h] = kind === '全景' ? [0, 2.5, W, 477] : kind === '中景' ? cropAround(fx, fy, 290) : cropAround(fx + SHIFT[index % SHIFT.length][0], fy + SHIFT[index % SHIFT.length][1], 150);
  const id = `ag${part}${kind}${Math.round(seed)}`;
  return (
    <svg className="shot" viewBox={`${x} ${y} ${w} ${h}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={`${part}の${kind}写真`}>
      {aged && (
        <defs>
          <filter id={id}>
            <feColorMatrix type="saturate" values="0.55" />
            <feComponentTransfer>
              <feFuncR type="linear" slope="0.86" intercept="0.03" />
              <feFuncG type="linear" slope="0.84" intercept="0.03" />
              <feFuncB type="linear" slope="0.8" intercept="0.03" />
            </feComponentTransfer>
          </filter>
        </defs>
      )}
      <image href={building} width={W} height={H} filter={aged ? `url(#${id})` : undefined} />
      {aged && (
        <g fill="#2b2118" opacity="0.2">
          <path d={`M${fx - 34} ${fy - 30} q6 34 -3 70 l10 0 q7 -34 0 -70 z`} />
          <path d={`M${fx + 8} ${fy - 26} q5 28 -2 56 l8 0 q6 -28 0 -56 z`} />
          <ellipse cx={fx - 6} cy={fy + 34} rx="46" ry="10" />
        </g>
      )}
      {!after && !aged && kind === '全景' && <circle cx={fx} cy={fy} r="46" fill="none" stroke="#e11d1d" strokeWidth="5" strokeDasharray="12 7" />}
      {!after && !aged && kind === '中景' && (
        <rect x={fx - 50} y={fy - 38} width="100" height="76" fill="none" stroke="#e11d1d" strokeWidth="2.5" strokeDasharray="7 4" rx="3" />
      )}
    </svg>
  );
}
