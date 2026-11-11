// Generates index.html (HyperFrames composition) from the scene list below.
// Edit the text/timing here, then: npm run build && npm run check && npm run render
import { writeFileSync, readFileSync, existsSync } from "node:fs";

// Narration: narration.json holds one spoken line per scene; tools/tts.py turns it into
// assets/audio/NN.mp3 + durations.json. Scenes are stretched so the narration always fits.
const AUDIO = new URL("./assets/audio/durations.json", import.meta.url);
const speech = existsSync(AUDIO) ? JSON.parse(readFileSync(AUDIO, "utf8")) : null;
const VOICE_IN = 0.6, VOICE_OUT = 1.2;

const CH = ["配信タイミング", "配信先", "件名・差出人", "デザイン", "本文", "最終確認"];

// b() marks a button / menu name exactly as it appears on screen.
const b = (s) => `<b class="ui">${s}</b>`;

const scenes = [
  { type: "title" },
  { type: "note" },
  { type: "flow" },

  { type: "chapter", ch: 1, lead: "いつ送るかを決めます" },
  { type: "step", ch: 1, n: 1, img: "61-1", page: 61, h: "「ベーシックメール」を開く",
    p: `画面上のメニューから ${b("メール配信")} → ${b("ベーシックメール")} の順にクリックします。` },
  { type: "step", ch: 1, n: 2, img: "61-2", page: 61, h: "新しいメールを作る",
    p: `${b("新規作成")} をクリックします。<br>${b("メモ")} にメールの内容を書いておくと、あとで見分けやすくなります（入力は任意です）。<br>最後に ${b("作成")} をクリックします。` },
  { type: "step", ch: 1, n: 3, img: "61-3", page: 61, h: "送る日時を決める",
    p: `「タイミング」の欄で ${b("配信日時")} を設定します。`,
    tip: ["承認設定とは？", `「ON」にして承認者を選ぶと、承認者が確認・承認してから配信されます。使う場合だけ設定します。`] },
  { type: "step", ch: 1, n: 4, img: "61-3", page: 61, h: "必要な設定をして「次へ」",
    p: `${b("送りすぎ防止")} と ${b("配信時間制限")} は、必要なときだけ ${b("設定を変更")} から設定します。<br>終わったら ${b("次へ")} をクリックします。`,
    tip: ["ことばの説明", `<b>送りすぎ防止</b>：同じ人に短い間隔で2通以上届かないよう、間隔を空ける機能<br><b>配信時間制限</b>：決めた時間帯は配信を一時中断する機能`] },

  { type: "chapter", ch: 2, lead: "だれに送るかを決めます" },
  { type: "step", ch: 2, n: 1, img: "62-1", page: 62, h: "送る相手を絞り込む",
    ol: [`${b("絞り込み条件を設定")} をクリック`, `${b("絞り込み項目の追加")} をクリック`, `条件に使う項目を選ぶ`, `${b("設定")} をクリック`] },
  { type: "step", ch: 2, n: 2, img: "62-2", page: 62, h: "行動履歴でも絞り込めます", opt: true,
    p: `「フォームに登録した人」などで絞り込みたいときは、${b("履歴型データベース/行動履歴")} をクリックし、使いたい行動履歴（例：フォーム登録履歴）を選びます。` },
  { type: "step", ch: 2, n: 3, img: "62-3", page: 62, h: "行動履歴の条件を決める", opt: true,
    ol: [`${b("絞り込み項目の追加")} をクリックし、条件に使う項目を選ぶ`, `条件に使う値を選ぶ`, `${b("設定")} をクリック`] },
  { type: "step", ch: 2, n: 4, img: "62-4", page: 62, h: "何件に届くかを確認する",
    p: `件数の横にある更新ボタン（↻）をクリックすると、現在の配信対象件数が表示されます。<br>${b("配信対象データ")} をクリックすると、送り先の一覧を確認できます（最大200件まで表示）。` },
  { type: "step", ch: 2, n: 5, img: "62-5", page: 62, h: "送り先の一覧を確認する",
    ol: [`${b("表示項目")} を指定する`, `${b("検索キーワード")} を指定する`],
    p: `指定すると、自動で結果が表示されます。` },
  { type: "step", ch: 2, n: 6, img: "62-6", page: 62, h: "確認できたら「次へ」",
    p: `必要に応じて、オプション設定の ${b("重複メールアドレス制限")} を設定します。<br>完了したら ${b("次へ")} をクリックします。`,
    tip: ["メールアドレス重複判定とは？", `メールアドレスのアルファベットの大文字と小文字を区別するかどうかの設定です。`] },

  { type: "chapter", ch: 3, lead: "メールの「顔」になる部分です" },
  { type: "step", ch: 3, n: 1, img: "63-1", page: 63, h: "件名と差出人を入力する",
    p: `${b("件名")}・${b("差出人名")}・${b("差出人メールアドレス")} を入力します。<br>入力できたら ${b("次へ")} をクリックします。` },
  { type: "step", ch: 3, n: 2, img: "63-1", page: 63, h: "開封されやすくするコツ", point: true,
    p: `<b>差出人名</b>は、読者が開封するかどうかを判断する大事なポイント。日本語で分かりやすく書きます。<br><b>件名</b>は30文字以内のキャッチコピーを意識し、伝えたいキーワードを先頭に置きます。`,
    tip: ["埋め込みコマンドとは？", `件名や本文に入れると、受信者一人ひとりの情報（氏名など）が自動で表示されます。`] },

  { type: "chapter", ch: 4, lead: "メールの見た目の作り方を選びます" },
  { type: "step", ch: 4, n: 1, img: "64-1", page: 64, h: "デザインの方法を4つから選ぶ",
    ul: [`デザインテンプレート`, `HTMLファイルアップロード`, `デザインエディタ`, `過去に作成したメール`],
    p: `このあと、それぞれの場合を順番に紹介します。` },
  { type: "step", ch: 4, n: 2, img: "64-2", page: 64, h: "デザインテンプレートを使う場合", opt: "選んだ場合",
    p: `6種類のテンプレートの中から、配信したいメールの内容に合うものを選びます。` },
  { type: "step", ch: 4, n: 3, img: "64-3", page: 64, h: "HTMLファイルを使う場合", opt: "選んだ場合",
    p: `${b("HTMLパート")} と ${b("テキストパート")} のそれぞれに、ファイルをドラッグ＆ドロップします。`,
    tip: ["ご注意", `ファイルの文字コードは <b>UTF-8</b> にします。`] },
  { type: "step", ch: 4, n: 4, img: "64-4", page: 64, h: "デザインエディタを使う場合", opt: "選んだ場合",
    p: `画面右側から ${b("コンテンツ")} や ${b("レイアウト")} を選び、ドラッグ＆ドロップで追加します。` },
  { type: "step", ch: 4, n: 5, img: "64-5", page: 64, h: "過去に作ったメールを使う場合", opt: "選んだ場合",
    p: `元にしたい過去のメールをクリックして選びます。` },

  { type: "chapter", ch: 5, lead: "本文を作り、送る前にしっかり確認します" },
  { type: "step", ch: 5, n: 1, img: "65-1", page: 65, h: "HTMLメールを作る",
    p: `${b("HTMLパート")} を選び、HTMLエディターで本文を作成します。` },
  { type: "step", ch: 5, n: 2, img: "65-2", page: 65, h: "テキストメールも作る（必須）",
    p: `${b("テキストパート")} を選び、テキストメールを作成します。<br>HTMLメールを作る場合も、テキストメールは必須です。`,
    tip: ["ポイント", `${b("HTMLから本文を抽出")} でも作れますが、レイアウトが崩れる場合があります。テキストメール用の原稿を事前に用意しておきましょう。`] },
  { type: "step", ch: 5, n: 3, img: "66-3", page: 66, h: "クリック数を計測する設定",
    p: `${b("クリックフィードバック設定")} をクリックします。<br>計測したいURLにチェックが付いていることを確認して、${b("設定")} をクリックします。`,
    tip: ["クリックフィードバックとは？", `本文に入れたURLが何回クリックされたかを計測する機能です。`] },
  { type: "step", ch: 5, n: 4, img: "66-4", page: 66, h: "プレビューで見た目を確認する",
    p: `${b("プレビュー")} をクリックして、メールの内容を確認します。` },
  { type: "step", ch: 5, n: 5, img: "67-5", page: 67, h: "テストメールを必ず送る", point: true,
    p: `${b("テストメール")} をクリックし、テストメールを送るメールアドレスを指定して ${b("送信")} をクリックします。<br>届いたメールを、実際にメールソフトで確認します。`,
    tip: ["必ず実施してください", `受信する端末やOS、メールソフトによって、表示が崩れることがあります。`] },
  { type: "step", ch: 5, n: 6, img: "67-6", page: 67, h: "問題なければ「次へ」",
    p: `メールの内容に問題がなければ、${b("次へ")} をクリックします。` },

  { type: "chapter", ch: 6, lead: "あと少しです。内容を確かめて配信します" },
  { type: "step", ch: 6, n: 1, img: "68-1", page: 68, h: "内容を確認して「設定完了」",
    p: `設定内容を確認し、問題なければ ${b("設定完了")} をクリックします。<br>（承認設定を使っている場合は ${b("承認依頼")}）`,
    tip: ["途中でやめるときは", `${b("設定を保存")} をクリックすると、設定を完了せずに保存できます。`] },
  { type: "step", ch: 6, n: 2, img: "68-2a", page: 68, h: "配信を確定する",
    p: `スケジュール・配信対象件数・対象顧客を確認します。<br>問題なければ ${b("設定")} または ${b("すぐに配信")} をクリックします。` },
  { type: "step", ch: 6, n: 3, img: "68-2b", page: 68, h: "一覧へ戻る",
    p: `「配信日時を設定しました」と表示されたら、${b("一覧へ戻る")} をクリックします。` },
  { type: "step", ch: 6, n: 4, img: "68-3", page: 68, z: [1.6, 30, 100], h: "稼働ステータスを確認する",
    p: `メール一覧の <b>稼働ステータス</b> で、配信の状況を確認できます。`,
    dl: [["配信中", "設定どおりにメールが配信されている状態"], ["予約中", "残りの表示時間が過ぎると「配信中」になります"],
         ["配信終了", "配信が終了しています"], ["編集中", "編集状態のため、メールは配信されません"]] },

  { type: "summary" },
];

// ---------- timing ----------
const plain = (s) => (s || "").replace(/<[^>]+>/g, "");
const textLen = (s) =>
  plain(s.h).length + plain(s.p).length + (s.ol || s.ul || []).join("").replace(/<[^>]+>/g, "").length +
  (s.tip ? plain(s.tip[1]).length + plain(s.tip[0]).length : 0) + (s.dl || []).flat().join("").length;
const dur = (s) => {
  if (s.type === "title") return 6;
  if (s.type === "note") return 11;
  if (s.type === "flow") return 11;
  if (s.type === "chapter") return 3.5;
  if (s.type === "summary") return 12;
  return Math.min(17, Math.max(8, Math.round((4 + textLen(s) / 9) * 2) / 2));
};
let t = 0;
scenes.forEach((s, i) => {
  s.start = t; s.dur = dur(s);
  if (speech) s.dur = Math.max(s.type === "step" ? 7 : 3.5, Math.ceil((speech[i] + VOICE_IN + VOICE_OUT) * 2) / 2);
  t += s.dur;
});
const TOTAL = t;

// ---------- markup ----------
const stepper = (ch) =>
  `<div class="stepper">${CH.map((c, i) => {
    const k = i + 1 < ch ? "done" : i + 1 === ch ? "on" : "";
    return `<div class="chip ${k}"><span class="num">${i + 1 < ch ? "✓" : i + 1}</span>${c}</div>`;
  }).join('<div class="sep"></div>')}</div>`;

const body = (s) => {
  let h = "";
  if (s.ol) h += `<ol class="ol">${s.ol.map((x, i) => `<li><span class="circ">${i + 1}</span><span>${x}</span></li>`).join("")}</ol>`;
  if (s.ul) h += `<ul class="ul">${s.ul.map((x) => `<li>${x}</li>`).join("")}</ul>`;
  if (s.p) h += `<p class="p">${s.p}</p>`;
  if (s.dl) h += `<div class="dl">${s.dl.map(([k, v]) => `<div class="dl-row"><span class="dl-k">${k}</span><span class="dl-v">${v}</span></div>`).join("")}</div>`;
  if (s.tip) h += `<div class="tip${s.point ? " warn" : ""}" id="T${s.i}"><div class="tip-h">${s.tip[0]}</div><div class="tip-b">${s.tip[1]}</div></div>`;
  return h;
};

const html = (s) => {
  const open = `<div class="scene clip ${s.type}" id="S${s.i}" data-start="${s.start}" data-duration="${s.dur}" data-track-index="10">`;
  switch (s.type) {
    case "title":
      return `${open}
        <div class="t-eyebrow" id="A${s.i}">はじめての方向け　操作ガイド</div>
        <div class="t-title" id="B${s.i}">メールマガジンの<br>配信のしかた</div>
        <div class="t-sub" id="C${s.i}">Synergy!「ベーシックメール」を、6つのステップでゆっくり解説します</div>
      </div>`;
    case "note":
      return `${open}
        <div class="n-h" id="A${s.i}">はじめる前に、2つだけ</div>
        <div class="n-cards">
          <div class="n-card" id="B${s.i}"><div class="n-k">使えるブラウザ</div>
            <div class="n-v">Google Chrome（最新版）<br>Microsoft Edge（最新版）</div></div>
          <div class="n-card stop" id="C${s.i}"><div class="n-k">やってはいけない操作</div>
            <div class="n-v">「複数タブ」で開くこと<br>ブラウザの「戻る」ボタン</div>
            <div class="n-s">画面ごとに設定内容を通信しているため、利用禁止です</div></div>
        </div>
      </div>`;
    case "flow":
      return `${open}
        <div class="n-h" id="A${s.i}">配信までの流れは、6ステップ</div>
        <div class="f-row">${CH.map((c, i) => `<div class="f-item" id="F${s.i}_${i}"><div class="f-n">${i + 1}</div><div class="f-c">${c}</div></div>`).join("")}</div>
        <div class="f-sub" id="B${s.i}">画面の下にも同じ順番で表示されるので、いまどこにいるかが分かります</div>
      </div>`;
    case "chapter":
      return `${open}${stepper(s.ch)}
        <div class="c-wrap"><div class="c-n" id="A${s.i}">STEP ${s.ch}</div>
        <div class="c-t" id="B${s.i}">${CH[s.ch - 1]}を設定する</div>
        <div class="c-l" id="C${s.i}">${s.lead}</div></div>
      </div>`;
    case "step":
      return `${open}${stepper(s.ch)}
        <div class="left" id="L${s.i}">
          <div class="badges"><span class="badge">手順 ${s.ch}-${s.n}</span>${s.opt ? `<span class="badge opt">${s.opt === true ? "必要な場合のみ" : s.opt}</span>` : ""}${s.point ? `<span class="badge pt">ここが大事</span>` : ""}</div>
          <h2 class="h">${s.h}</h2>
          ${body(s)}
        </div>
        <div class="right" id="R${s.i}">
          <div class="shot"><div class="shot-in"><img id="I${s.i}" src="assets/shots/${s.img}.png" alt="" /></div></div>
          <div class="cap">実際の画面（操作マニュアル p.${s.page} より）　赤枠がクリックする場所です</div>
        </div>
      </div>`;
    case "summary":
      return `${open}
        <div class="n-h" id="A${s.i}">おさらい</div>
        <div class="s-list">${CH.map((c, i) => `<div class="s-item" id="F${s.i}_${i}"><span class="s-n">${i + 1}</span>${c}</div>`).join("")}</div>
        <div class="s-warn" id="B${s.i}">配信の前に、<b>テストメール</b>を必ず送って確認しましょう</div>
      </div>`;
  }
};

// ---------- animation ----------
const anim = (s) => {
  const a = s.start, e = s.start + s.dur, L = [];
  const from = (sel, v, at) => L.push(`tl.from("${sel}", ${JSON.stringify(v)}, ${(a + at).toFixed(2)});`);
  from(`#S${s.i}`, { opacity: 0, duration: 0.5 }, 0);
  if (s.type === "step") {
    from(`#L${s.i}`, { x: -40, opacity: 0, duration: 0.7 }, 0.15);
    from(`#R${s.i}`, { y: 40, opacity: 0, duration: 0.8 }, 0.35);
    if (s.z) L.push(`tl.fromTo("#I${s.i}", {scale:1, transformOrigin:"${s.z[1]}% ${s.z[2]}%"}, {scale:${s.z[0]}, duration:2, ease:"power2.inOut"}, ${(a + 2.5).toFixed(2)});`);
    else L.push(`tl.fromTo("#I${s.i}", {scale:1}, {scale:1.05, duration:${(s.dur - 1).toFixed(2)}, ease:"none"}, ${(a + 0.5).toFixed(2)});`);
    if (s.tip) from(`#T${s.i}`, { y: 24, opacity: 0, duration: 0.6 }, Math.min(3, s.dur * 0.3));
  } else {
    (s.type === "flow" || s.type === "summary" ? ["A", "B"] : ["A", "B", "C"]).forEach((k, j) => from(`#${k}${s.i}`, { y: 30, opacity: 0, duration: 0.7 }, 0.2 + j * (s.type === "chapter" ? 0.25 : 0.6)));
    if (s.type === "flow" || s.type === "summary")
      CH.forEach((_, j) => from(`#F${s.i}_${j}`, { y: 30, opacity: 0, duration: 0.5 }, 1 + j * 0.45));
  }
  L.push(`tl.to("#S${s.i}", {opacity:0, duration:0.35, ease:"power1.in"}, ${(e - 0.4).toFixed(2)});`);
  L.push(`tl.set("#S${s.i}", {opacity:0}, ${e.toFixed(2)});`);
  return L.join("\n      ");
};

scenes.forEach((s, i) => (s.i = i));

const doc = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="assets/gsap.min.js"></script>
    <style>
      @font-face { font-family: "NSJ"; font-weight: 500; src: url("assets/fonts/noto-sans-jp-japanese-500-normal.woff2") format("woff2"); }
      @font-face { font-family: "NSJ"; font-weight: 700; src: url("assets/fonts/noto-sans-jp-japanese-700-normal.woff2") format("woff2"); }
      @font-face { font-family: "NSJ"; font-weight: 900; src: url("assets/fonts/noto-sans-jp-japanese-900-normal.woff2") format("woff2"); }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1920px; height: 1080px; overflow: hidden; background: #f4f7fa;
        font-family: "NSJ", sans-serif; font-weight: 500; color: #1d2b3a; -webkit-font-smoothing: antialiased; }
      #root { position: relative; width: 1920px; height: 1080px; overflow: hidden; }
      .bg { position: absolute; inset: 0; background: linear-gradient(160deg, #f8fbfd 0%, #eaf2f6 100%); }
      .scene { position: absolute; inset: 0; }
      b { font-weight: 700; }
      b.ui { display: inline-block; padding: 0 14px; margin: 0 2px; border-radius: 10px; line-height: 1.5;
        background: #dff3f6; color: #07657a; border: 2px solid #9fd8e1; font-weight: 700; white-space: nowrap; }

      /* stepper */
      .stepper { position: absolute; top: 36px; left: 80px; right: 80px; height: 64px; display: flex; align-items: center; }
      .chip { display: flex; align-items: center; gap: 12px; font-size: 28px; color: #8a97a6; white-space: nowrap; }
      .chip .num { width: 44px; height: 44px; border-radius: 50%; background: #dbe3ea; color: #6c7a89;
        display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 24px; }
      .chip.done { color: #4b6373; } .chip.done .num { background: #9fd8e1; color: #07657a; }
      .chip.on { color: #07657a; font-weight: 700; font-size: 32px; } .chip.on .num { background: #0a8ea6; color: #fff; }
      .sep { flex: 1; height: 3px; background: #dbe3ea; margin: 0 16px; min-width: 20px; }

      /* step */
      .left { position: absolute; left: 80px; top: 150px; width: 800px; }
      .badges { display: flex; gap: 14px; margin-bottom: 22px; }
      .badge { font-size: 28px; font-weight: 700; color: #fff; background: #e5372b; padding: 6px 22px; border-radius: 10px; }
      .badge.opt { background: #fff; color: #5b6b7b; border: 2px solid #b8c4cf; }
      .badge.pt { background: #f0a400; }
      .h { font-size: 58px; font-weight: 900; line-height: 1.3; margin-bottom: 30px; letter-spacing: 0.5px; }
      .p { font-size: 36px; line-height: 1.75; margin-bottom: 24px; }
      .ol, .ul { list-style: none; margin-bottom: 20px; }
      .ol li { display: flex; gap: 18px; font-size: 36px; line-height: 1.6; margin-bottom: 16px; align-items: flex-start; }
      .circ { flex: none; width: 50px; height: 50px; margin-top: 4px; border-radius: 50%; border: 4px solid #e5372b; color: #e5372b;
        font-weight: 700; font-size: 28px; display: flex; align-items: center; justify-content: center; }
      .ul li { font-size: 36px; line-height: 1.5; margin-bottom: 14px; padding: 10px 24px; background: #fff;
        border-radius: 12px; border-left: 8px solid #0a8ea6; font-weight: 700; }
      .dl-row { display: flex; align-items: baseline; gap: 20px; font-size: 30px; line-height: 1.5; margin-bottom: 14px; }
      .dl-k { flex: none; width: 170px; text-align: center; font-weight: 700; color: #07657a; background: #dff3f6; border-radius: 10px; padding: 4px 0; }
      .tip { background: #eef6fc; border-left: 10px solid #4a90d9; border-radius: 12px; padding: 20px 28px; margin-top: 6px; }
      .tip.warn { background: #fff7df; border-left-color: #f0a400; }
      .tip-h { font-size: 28px; font-weight: 700; color: #2b6cb0; margin-bottom: 6px; }
      .tip.warn .tip-h { color: #9a6700; }
      .tip-b { font-size: 29px; line-height: 1.6; }
      .tip-b b.ui { font-size: 27px; }
      .right { position: absolute; left: 930px; top: 140px; width: 910px; height: 880px; display: flex; flex-direction: column; justify-content: center; }
      .shot { width: 910px; max-height: 800px; background: #fff; border-radius: 20px; padding: 26px; overflow: hidden;
        box-shadow: 0 16px 50px rgba(20, 50, 80, 0.14); border: 2px solid #dbe3ea; display: flex; align-items: center; justify-content: center; }
      .shot-in { width: 100%; overflow: hidden; border-radius: 6px; display: flex; }
      .shot img { width: 100%; max-height: 744px; object-fit: contain; }
      .cap { margin-top: 18px; font-size: 24px; color: #6c7a89; text-align: center; }

      /* title / note / flow / chapter / summary */
      .title, .note, .flow, .summary { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
      .t-eyebrow { font-size: 36px; font-weight: 700; color: #fff; background: #0a8ea6; padding: 10px 36px; border-radius: 999px; margin-bottom: 44px; }
      .t-title { font-size: 136px; font-weight: 900; line-height: 1.2; letter-spacing: 2px; }
      .t-sub { font-size: 40px; color: #4b6373; margin-top: 48px; }
      .n-h { font-size: 76px; font-weight: 900; margin-bottom: 64px; }
      .n-cards { display: flex; gap: 48px; }
      .n-card { width: 760px; background: #fff; border-radius: 24px; padding: 44px 40px; border-top: 12px solid #0a8ea6;
        box-shadow: 0 16px 50px rgba(20, 50, 80, 0.12); }
      .n-card.stop { border-top-color: #e5372b; }
      .n-k { font-size: 32px; font-weight: 700; color: #07657a; margin-bottom: 20px; }
      .n-card.stop .n-k { color: #c22a20; }
      .n-v { font-size: 46px; font-weight: 700; line-height: 1.6; }
      .n-s { font-size: 27px; color: #5b6b7b; margin-top: 20px; }
      .f-row { display: flex; gap: 22px; }
      .f-item { width: 276px; background: #fff; border-radius: 20px; padding: 34px 10px; box-shadow: 0 12px 36px rgba(20, 50, 80, 0.12); }
      .f-n { width: 84px; height: 84px; border-radius: 50%; background: #0a8ea6; color: #fff; font-size: 46px; font-weight: 900;
        margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; }
      .f-c { font-size: 36px; font-weight: 700; }
      .f-sub { font-size: 34px; color: #4b6373; margin-top: 60px; }
      .c-wrap { position: absolute; left: 0; right: 0; top: 330px; text-align: center; }
      .c-n { display: inline-block; font-size: 44px; font-weight: 900; color: #fff; background: #e5372b; padding: 8px 40px; border-radius: 14px; letter-spacing: 4px; }
      .c-t { font-size: 112px; font-weight: 900; margin-top: 36px; }
      .c-l { font-size: 42px; color: #4b6373; margin-top: 30px; }
      .s-list { display: grid; grid-template-columns: repeat(3, 520px); gap: 24px; }
      .s-item { background: #fff; border-radius: 18px; padding: 26px 30px; font-size: 40px; font-weight: 700; text-align: left;
        display: flex; align-items: center; gap: 22px; box-shadow: 0 10px 30px rgba(20, 50, 80, 0.1); }
      .s-n { width: 60px; height: 60px; border-radius: 50%; background: #0a8ea6; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 32px; }
      .s-warn { margin-top: 60px; font-size: 44px; background: #fff7df; border: 3px solid #f0a400; border-radius: 18px; padding: 24px 48px; }
      .s-warn b { color: #c22a20; }

      .progress { position: absolute; left: 0; bottom: 0; height: 10px; width: 0; background: #0a8ea6; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="1920" data-height="1080">
      <div class="bg clip" id="bg" data-start="0" data-duration="${TOTAL}" data-track-index="0"></div>
      ${scenes.map(html).join("\n      ")}
      ${speech ? scenes.map((s, i) => `<audio class="clip" id="V${i}" src="assets/audio/${String(i).padStart(2, "0")}.mp3" data-start="${s.start + VOICE_IN}" data-duration="${speech[i]}" data-track-index="30" data-volume="1"></audio>`).join("\n      ") : ""}
      <div class="progress clip" id="progress" data-start="0" data-duration="${TOTAL}" data-track-index="20"></div>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });
      tl.to("#progress", { width: "100%", duration: ${TOTAL}, ease: "none" }, 0);
      ${scenes.map(anim).join("\n      ")}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
writeFileSync(new URL("./index.html", import.meta.url), doc);
console.log(`scenes: ${scenes.length}  total: ${TOTAL}s (${Math.floor(TOTAL / 60)}:${String(Math.round(TOTAL % 60)).padStart(2, "0")})`);
for (const s of scenes) console.log(String(s.start).padStart(6), String(s.dur).padStart(5), s.type, s.h || "");
