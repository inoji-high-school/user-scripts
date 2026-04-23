# UserScripts

このリポジトリは、ブラウザに小さな便利機能を追加する **UserScript** を配布する場所です。

Tampermonkey をブラウザ拡張として入れておけば、`.user.js` の raw URL を開くだけでインストールできます。コードを手でコピーして貼り付ける必要はありません。

## スクリプト一覧

| スクリプト | できること | 対象サイト | インストール |
| --- | --- | --- | --- |
| ノイミー盤 History Sheets | Chara-Ani の申込履歴を集計し、Google スプレッドシートに貼り付けやすい TSV をコピーできるようにします。 | `not-equal-me.chara-ani.com` / `*.chara-ani.com` | [インストール](https://github.com/inoji-high-school/user-scripts/raw/refs/heads/main/scripts/chara-ani-sheets.user.js) |
| ≠ME Mobile Host Redirect | `sp.not-equal-me.jp` を開いたとき、自動で `not-equal-me.jp` へ移動します。 | `sp.not-equal-me.jp` | [インストール](https://github.com/inoji-high-school/user-scripts/raw/refs/heads/main/scripts/not-equal-me-redirect.user.js) |
| =LOVE Mobile Host Redirect | `sp.equal-love.jp` を開いたとき、自動で `equal-love.jp` へ移動します。 | `sp.equal-love.jp` | [インストール](https://github.com/inoji-high-school/user-scripts/raw/refs/heads/main/scripts/equal-love-redirect.user.js) |
| ≒JOY Mobile Host Redirect | `sp.nearly-equal-joy.jp` を開いたとき、自動で `nearly-equal-joy.jp` へ移動します。 | `sp.nearly-equal-joy.jp` | [インストール](https://github.com/inoji-high-school/user-scripts/raw/refs/heads/main/scripts/nearly-equal-joy-redirect.user.js) |

## インストール方法

### 1. Tampermonkey を入れる

次の公式サイトから、使っているブラウザに Tampermonkey をインストールします。

https://www.tampermonkey.net/

Chrome / Edge / Firefox など、ブラウザごとの案内に従ってください。

### 2. Chrome 系ブラウザの場合だけ、ユーザー スクリプトを許可する

Chrome / Edge などでは、追加の許可が必要なことがあります。

1. ブラウザの拡張機能一覧を開きます。
2. Tampermonkey の「詳細」を開きます。
3. `ユーザー スクリプトを許可する` を ON にします。

この設定が OFF のままだと、Tampermonkey にスクリプトを入れても動かない場合があります。

### 3. 使いたいスクリプトの raw URL を開く

上の「スクリプト一覧」にある `インストール` リンクを開きます。

Tampermonkey が反応すると、スクリプトのインストール確認画面が開きます。内容を確認して `インストール` を押してください。

複数のスクリプトを使う場合は、それぞれの `インストール` リンクを開いて同じ手順で入れます。

## 更新方法

通常は何もしなくて大丈夫です。

この README の `インストール` リンクから入れたスクリプトは、Tampermonkey 側の更新チェックで自動的に最新版へ更新されます。

すぐに最新版へしたい場合だけ、Tampermonkey のダッシュボードから更新チェックを実行してください。反映されない場合は、同じ `インストール` リンクをもう一度開くと更新確認画面を出せます。

以前の README に従ってコードをコピーして入れた場合は、自動更新用の URL が登録されていないことがあります。その場合は、上の `インストール` リンクから一度入れ直してください。

## 困ったとき

### インストール画面が開かない

- Tampermonkey がブラウザに入っているか確認してください。
- Tampermonkey が無効化されていないか確認してください。
- raw URL を直接開いているか確認してください。GitHub の通常表示ページではなく、URL に `/raw/` が入っているリンクを使います。

### スクリプトが動かない

- Tampermonkey のスクリプト一覧で、対象スクリプトが ON になっているか確認してください。
- Chrome 系ブラウザの場合、拡張機能詳細の `ユーザー スクリプトを許可する` が ON か確認してください。
- 開いているサイトの URL が、スクリプトの対象サイトと合っているか確認してください。
- ページを再読み込みしてください。

## 注意

UserScript はブラウザ上で動くコードです。中身がわからないスクリプトや、信頼できない配布元のスクリプトは入れないでください。
