# ハブハブハーブ ピンボール｜Double H 公式ミニゲーム

マングースを発射してハブ（バンパー）に当てるパチンコ/ピンボール風の販促ミニゲーム。
**1プレイ3球・合計点で景品GET**（景品はブースで配布）。Double H（HABU×HERB）。
**Let's be Crazy!!**

景品のしきい値・景品名・引換コード・公式/購入URLは `game/index.html` 冒頭の `CONFIG` で編集できます。

```
/index.html          配布用ランディング（ロゴ・QR・シェア・「遊ぶ」ボタン）
/game/index.html     ゲーム本体（単体でも動作・オフラインOK）
/game/assets/logo.png ロゴ画像（置くと全画面に自動反映 / 無い時はフォールバック表示）
```

## ローカルで遊ぶ
`game/index.html` をブラウザで開くだけ（ビルド・通信不要）。

## Web公開（QR配布）— GitHub Pages
1. GitHub の本リポジトリ → **Settings → Pages**
2. **Source: Deploy from a branch** を選択
3. Branch を公開したいブランチ（例: `main` もしくは現在の作業ブランチ）/ **`/ (root)`** に設定して Save
4. 数十秒後、次のURLで公開されます（リポジトリ名に依存・固定）:

   ```
   https://ryoheiosaka-yellow.github.io/test_test_uix/
   ```

   - ランディング: 上記URL
   - ゲーム直リンク: `.../test_test_uix/game/`
   - `index.html` 内の **QRコードはこの公開URLを指しています**（店頭POP・イベント配布用）

> 公開URLが上記と変わる場合（独自ドメイン等）は QR を再生成します。お知らせください。
