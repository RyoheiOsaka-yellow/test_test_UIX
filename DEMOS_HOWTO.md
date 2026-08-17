# パネル背景で 1枚HTML のデモを動かす

xINTERACTIVE の冒頭で動いている点群デモと同じ仕組みを、どのパネルにも置けます。
デモは 1つのパネルに複数割り当てられ、その場合は一定時間で切り替わります。

---

## 手順

### 1. HTML を置く

もらった 1枚 HTML を、わかりやすい名前で `demos/src/` に置きます。

```
demos/src/morphosis.html
demos/src/flowfield.html
demos/src/lattice.html
```

ファイル名（`.html` を除いた部分）がそのまま **デモ ID** になります。
英小文字・数字・ハイフンだけにしてください。

### 2. どのパネルで動かすか決める

`demos/demos.json` の該当スロットに ID を並べます。**並べた順に切り替わります。**

```json
{
  "cycleSec": 45,
  "slots": {
    "xbuild-hero":       ["flowfield", "lattice", "truss", "weld"],
    "xinteractive-hero": ["morphosis"],
    "xad-cap01":         []
  }
}
```

- `cycleSec` … 1つのデモを見せる秒数（既定 45秒）
- 空配列 `[]` にすると、そのパネルは**元の動画に戻ります**

使えるスロット名（全15枚）:

| ページ | スロット名 |
|---|---|
| トップ | `home-hero` `home-xbuild` `home-xad` `home-xinteractive` `home-careers` `home-contact` |
| xBUILD | `xbuild-hero` `xbuild-cap01` `xbuild-cap02` |
| xAD | `xad-hero` `xad-cap01` `xad-cap02` |
| xINTERACTIVE | `xinteractive-hero` `xinteractive-cap01` `xinteractive-cap02` |

### 3. ビルドする

```
node build-demos.js     # 1枚版 yellow_spacex_v8.html に反映
node build-static.js    # 公開用 dist/ を作り直す
```

`build-demos.js` は何度実行しても同じ結果になります。
`demos.json` を書き換えて実行し直せば、いつでも差し替え・取り消しができます。

---

## 見た目の調整（任意）

デモ側の画面表示が、サイトのヘッダーや見出しとぶつかることがあります。
その場合は同じ名前で `.css` を置くと、デモ側のスタイルの末尾に足されます。

`demos/src/morphosis.css`

```css
/* サイトの見出しとぶつかる表示を消し、計器類だけ右下に残す */
#title,#hint,#airBtn,#cam{display:none !important;}
#stats{top:auto;bottom:100px;right:32px;text-align:right;opacity:.55;}
```

**目安**

- 左下は `xINTERACTIVE` などの見出しが入るので空けておく
- 上部 78px はヘッダーが乗る
- 残すなら右側。計器表示のような「動いている証拠」は雰囲気が出るので残す価値あり
- 操作説明（「タップしてください」等）は**消す**。埋め込み時は操作できないため

負荷が高いデモは、同じ名前で `.patch.json` を置くと文字列を置換できます。

`demos/src/morphosis.patch.json`

```json
[
  ["(coarse ? 150000 : 280000)", "(coarse ? 110000 : 190000)"],
  ["Math.min(coarse ? 1.8 : 2,", "Math.min(coarse ? 1.5 : 1.75,"]
]
```

置換対象が見つからないとビルドが止まるので、書き間違いに気づけます。

---

## デモ HTML に必要なこと

| 条件 | 理由 |
|---|---|
| **1枚で完結している** | 外部の JS / CSS / 画像を読まない。CDN 参照があるとビルド時に警告が出ます |
| **操作しなくても動く** | 埋め込み時はクリックもタップも届きません。自動再生・自動遷移が必要です |
| `</template>` を含まない | 埋め込み方式の都合。含まれているとビルドが止まります |
| 背景が黒か暗い | パネルの文字が白なので、明るい背景だと読めなくなります |

**操作させたい場合**は、パネル背景ではなく事例ページの「デモを開く」ボタン（別タブ）が向いています。

---

## 仕組み（参考）

- デモは `<iframe sandbox="allow-scripts">` の中で動きます。デモ側の CSS / JS はサイトに一切影響しません
- `pointer-events:none` なので、スクロールもクリックもそのままサイト側に通ります
- **見えているパネル 1枚だけ**を動かします。他は iframe ごと破棄して GPU を解放します
- 公開版（`dist/`）ではデモが `/assets/demo/<id>.html` へ切り出され、ページ本体は軽いままです
- 単一ファイル版（`yellow_spacex_v8.html`）では `<template>` に入り、そのファイル 1つで動きます
- **出さない条件**: スマホ（幅900px以下）／省データ設定／`prefers-reduced-motion`／WebGL2 非対応
  → この場合は従来どおり静止画が出ます。静止画は `--bg` のままなので、デモを置いても差し替え不要です

---

## こちらに送るとき

HTML ファイルをそのまま送っていただければ、こちらで
「どのスロットに置くか」「HUD をどう整理するか」「負荷をどう落とすか」まで整えます。
あわせて教えていただけると早いもの:

- どのパネル（またはどの事業）で使いたいか
- そのデモで見せたいもの（画面のどこを主役にしたいか）
- 操作なしで動くか、動かない場合はどう自動化したいか
