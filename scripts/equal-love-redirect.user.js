// ==UserScript==
// @name         =LOVE Mobile Host Redirect
// @namespace    https://github.com/inoji-high-school/user-scripts
// @version      0.1.0
// @downloadURL  https://github.com/inoji-high-school/user-scripts/raw/refs/heads/main/scripts/equal-love-redirect.user.js
// @updateURL    https://github.com/inoji-high-school/user-scripts/raw/refs/heads/main/scripts/equal-love-redirect.user.js
// @description  sp.equal-love.jp を equal-love.jp にリダイレクトする
// @match        https://sp.equal-love.jp/*
// @match        http://sp.equal-love.jp/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function redirectSpEqualLoveHost() {
  if (location.hostname !== 'sp.equal-love.jp') return;
  const target = new URL(location.href);
  target.hostname = 'equal-love.jp';
  location.replace(target.href);
}());
