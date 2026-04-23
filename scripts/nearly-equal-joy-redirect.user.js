// ==UserScript==
// @name         ≒JOY Mobile Host Redirect
// @namespace    https://github.com/inoji-high-school/user-scripts
// @version      0.1.0
// @downloadURL  https://github.com/inoji-high-school/user-scripts/raw/refs/heads/main/scripts/nearly-equal-joy-redirect.user.js
// @updateURL    https://github.com/inoji-high-school/user-scripts/raw/refs/heads/main/scripts/nearly-equal-joy-redirect.user.js
// @description  sp.nearly-equal-joy.jp を nearly-equal-joy.jp にリダイレクトする
// @match        https://sp.nearly-equal-joy.jp/*
// @match        http://sp.nearly-equal-joy.jp/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function redirectSpNearlyEqualJoyHost() {
  if (location.hostname !== 'sp.nearly-equal-joy.jp') return;
  const target = new URL(location.href);
  target.hostname = 'nearly-equal-joy.jp';
  location.replace(target.href);
}());
