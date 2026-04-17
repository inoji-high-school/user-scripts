# UserScripts

このリポジトリは、ブラウザに小さな便利機能を追加する **UserScript** を置く場所です。

UserScript は、特定のWebサイトを開いたときだけ動く小さなJavaScriptです。たとえば「ページに集計ボタンを追加する」「特定URLを自動で別URLへ移動する」といったことができます。

この README では、初めての人でも Tampermonkey に UserScript を入れられるように、セットアップ手順だけを説明します。

## 入っているスクリプト

| ファイル | できること | 対象サイト |
| --- | --- | --- |
| `scripts/chara-ani-sheets.user.js` | Chara-Ani の申込履歴を集計し、Google スプレッドシートに貼り付けやすい TSV をコピーできるようにします。 | `not-equal-me.chara-ani.com` / `*.chara-ani.com` |
| `scripts/not-equal-me-redirect.user.js` | `sp.not-equal-me.jp` を開いたとき、自動で `not-equal-me.jp` へ移動します。 | `sp.not-equal-me.jp` |

## Tampermonkey とは

Tampermonkey は、UserScript をブラウザで動かすための拡張機能です。

ブラウザに Tampermonkey を入れると、自分で登録した `.user.js` ファイルが、指定されたサイトを開いたときだけ自動で動きます。

> 注意: UserScript はブラウザ上で動くコードです。中身がわからないスクリプトや、信頼できない配布元のスクリプトは入れないでください。

## 事前準備

### 1. Tampermonkey をインストールする

次の公式サイトを開き、使っているブラウザに Tampermonkey を入れます。

```text
https://www.tampermonkey.net/
```

Chrome / Edge / Firefox など、ブラウザごとに案内があります。

### 2. Chrome で「ユーザー スクリプトを許可する」を ON にする

Chrome 系ブラウザでは、追加の許可が必要なことがあります。

1. ブラウザの拡張機能一覧を開きます。
2. Tampermonkey の「詳細」を開きます。
3. `ユーザー スクリプトを許可する` を ON にします。

この設定が OFF のままだと、Tampermonkey に保存してもスクリプトが動かない場合があります。

## UserScript の入れ方

以下は、`.user.js` ファイルの中身を Tampermonkey に貼り付けて保存する方法です。

### 1. 使いたい `.user.js` ファイルを開く

このリポジトリの `scripts/` にある、使いたいファイルを開きます。

```text
scripts/chara-ani-sheets.user.js
scripts/not-equal-me-redirect.user.js
```

両方使う場合は、2つとも同じ手順で登録します。

### 2. ファイルの中身をすべてコピーする

ファイルを開いたら、内容を最初から最後まで全部コピーします。

`// ==UserScript==` から始まる部分も必要です。消さずにコピーしてください。

### 3. Tampermonkey で新しいスクリプトを作る

1. ブラウザ右上の Tampermonkey アイコンを押します。
2. `ダッシュボード` を開きます。
3. `+` ボタン、または `新規スクリプト` を押します。
4. 最初から入っているサンプルコードを全部消します。
5. コピーした `.user.js` の中身を貼り付けます。
6. 保存します。

保存後、Tampermonkey の一覧でスクリプトが ON になっていれば準備完了です。

## 更新するとき

スクリプトの中身が更新された場合は、Tampermonkey に保存している古い内容を新しい内容で置き換えます。

1. 新しい `.user.js` ファイルの中身を全部コピーします。
2. Tampermonkey のダッシュボードで対象スクリプトを開きます。
3. 古い内容を全部消します。
4. 新しい内容を貼り付けます。
5. 保存します。

## 困ったとき

### スクリプトが動かない

- Tampermonkey のスクリプト一覧で、対象スクリプトが ON になっているか確認してください。
- Chrome 系ブラウザの場合、拡張機能詳細の `ユーザー スクリプトを許可する` が ON か確認してください。
- 対象サイトのURLが、スクリプトの対象サイトと合っているか確認してください。
- ページを再読み込みしてください。