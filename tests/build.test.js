// index.html must match what tools/build.js would produce from src/ and data/.
'use strict';
const fs = require('fs');
const { build, OUT } = require('../tools/build.js');

module.exports = function (t) {
  t.group('build: index.html');
  const html = build();
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  t.ok(current === html, 'index.html is up to date with src/ and data/ (else run: node tools/build.js)');
  t.ok(!/<script[^>]+src=/i.test(html) && !/<link[^>]+stylesheet/i.test(html), 'index.html has no external scripts or stylesheets');
  t.ok(!/fetch\(/.test(html), 'index.html loads no files at runtime (works from file://)');
};
