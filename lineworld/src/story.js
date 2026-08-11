// Layout of the journey and every line of text in the game.

export const OWNER = { x: 128, z: 26 };

export const SITES = [
  { x: 36, z: -34 },
  { x: -84, z: -52 },
  { x: -66, z: 96 },
  { x: 98, z: 96 },
];

export const MONUMENTS = [
  { x: -14, z: -84 },
  { x: -124, z: 26 },
  { x: 16, z: 122 },
  // two that nobody asks you to visit
  { x: 62, z: -114 },
  { x: -138, z: -118 },
];

/**
 * kind: 'dig' -> site index, reveals memory index
 *       'bark' -> monument index
 *       'final' -> walk to the owner
 */
export const BEATS = [
  { kind: 'dig', target: 0, memory: 0, objective: 'obj_follow', arrive: 'arrive_dig', done: 'mem_ball' },
  { kind: 'bark', target: 0, objective: 'obj_light', arrive: 'arrive_light', done: 'after_bark1' },
  { kind: 'dig', target: 1, memory: 1, objective: 'obj_follow', arrive: 'arrive_dig', done: 'mem_leash' },
  { kind: 'bark', target: 1, objective: 'obj_light', arrive: 'arrive_light', done: 'after_bark2' },
  { kind: 'dig', target: 2, memory: 2, objective: 'obj_follow', arrive: 'arrive_dig', done: 'mem_car' },
  { kind: 'bark', target: 2, objective: 'obj_light', arrive: 'arrive_light', done: 'after_bark3' },
  { kind: 'dig', target: 3, memory: 3, objective: 'obj_follow', arrive: 'arrive_dig', done: 'mem_bench' },
  { kind: 'final', objective: 'obj_final', arrive: 'arrive_final', done: 'ending_1' },
];

export const STRINGS = {
  tagline: {
    en: 'A dog searching for its owner in a forest made of lines.<br>The world only exists where your lantern reaches.',
    ja: '線でできた森で、飼い主を探す犬の話。<br>世界は、ランタンの届くところにだけ存在する。',
  },
  credit: {
    en: 'a prototype · built with three.js · no models, no textures, no samples',
    ja: 'プロトタイプ · three.js · モデルもテクスチャも音源もなし',
  },

  ctl_move: { en: 'move', ja: '移動' },
  ctl_run: { en: 'run', ja: '走る' },
  ctl_jump: { en: 'jump', ja: 'ジャンプ' },
  ctl_sniff: { en: 'smell', ja: 'におい' },
  ctl_dig: { en: 'dig', ja: '掘る' },
  ctl_bark: { en: 'bark', ja: '吠える' },
  ctl_cam: { en: 'look / zoom', ja: '視点 / ズーム' },

  intro_1: { en: 'You wake where the light ends.', ja: '明かりの尽きるところで、目を覚ます。' },
  intro_2: { en: 'The lantern was theirs. Now it is yours to carry.', ja: 'このランタンはあの人のものだった。いまはきみが提げている。' },
  intro_3: { en: 'Nothing exists until you bring the light to it.', ja: '光を運ばないかぎり、なにも存在しない。' },

  obj_follow: { en: 'Follow the scent', ja: 'においを追う' },
  obj_light: { en: 'Answer the red light', ja: '赤い光に応える' },
  obj_final: { en: 'Go to the light that is not yours', ja: 'きみのものではない明かりへ' },

  hint_sniff: { en: 'Hold [Q] to smell the world', ja: '[Q] 長押しで、においを嗅ぐ' },
  hint_dig: { en: 'Hold [E] to dig', ja: '[E] 長押しで掘る' },
  hint_bark: { en: 'Press [F] to bark', ja: '[F] で吠える' },

  arrive_dig: { en: 'Something is buried here.', ja: 'ここに、なにかが埋まっている。' },
  arrive_light: { en: 'A red light. It has been waiting to be answered.', ja: '赤い光。ずっと、応えを待っていた。' },
  arrive_final: { en: 'A light that is not yours.', ja: 'きみのものではない、明かり。' },

  mem_ball: { en: 'The ball. You always brought it back, even when nobody asked.', ja: 'ボール。誰も頼まなくても、きみはいつも咥えて帰ってきた。' },
  mem_leash: { en: 'The leash by the door. That small sound meant the whole world.', ja: '扉のそばのリード。あの小さな音が、世界のすべてだった。' },
  mem_car: { en: 'The window, half open. Everything went past too fast, and you loved it.', ja: '半分だけ開いた窓。すべてが速すぎて、それがうれしかった。' },
  mem_bench: { en: 'The bench. You waited. They always came back.', ja: 'あのベンチ。きみは待った。あの人はいつも戻ってきた。' },

  after_bark1: { en: 'Something barked back. Far away, and not afraid.', ja: '遠くで、なにかが吠え返した。おびえてはいなかった。' },
  after_bark2: { en: 'Closer this time. The forest is listening.', ja: 'さっきより近い。森が、耳をすませている。' },
  after_bark3: { en: 'That was a voice you know.', ja: 'それは、きみの知っている声だった。' },

  ending_1: { en: 'They kneel. The lantern is set down between you.', ja: 'あの人が膝をつく。ランタンが、ふたりのあいだに置かれる。' },
  ending_2: { en: 'The forest keeps drawing itself, further than the light goes now.', ja: '森は描かれつづける。もう、光の届かない先まで。' },
  ending_3: { en: 'You are found.', ja: 'きみは、見つけてもらえた。' },
  ending_4: { en: 'Thank you for carrying the light.', ja: '光を運んでくれて、ありがとう。' },

  found: { en: 'A memory', ja: '記憶をひとつ' },
  bonus: { en: 'It answers, though nobody asked it to.', ja: '誰も頼んでいないのに、それは応えた。' },
};
