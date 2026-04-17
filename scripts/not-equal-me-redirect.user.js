// ==UserScript==
// @name         ≠ME Mobile Host Redirect
// @namespace    https://github.com/inoji-high-school/user-scripts
// @version      0.1.1
// @downloadURL  https://github.com/inoji-high-school/user-scripts/raw/refs/heads/main/scripts/not-equal-me-redirect.user.js
// @updateURL    https://github.com/inoji-high-school/user-scripts/raw/refs/heads/main/scripts/not-equal-me-redirect.user.js
// @description  sp.not-equal-me.jp を not-equal-me.jp にリダイレクトする
// @match        https://sp.not-equal-me.jp/*
// @match        http://sp.not-equal-me.jp/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function redirectSpNotEqualMeHost() {
  if (location.hostname !== 'sp.not-equal-me.jp') return;
  const target = new URL(location.href);
  target.hostname = 'not-equal-me.jp';
  location.replace(target.href);
}());
