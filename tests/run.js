// Minimal test runner, no dependencies. Run with: node tests/run.js
'use strict';
const util = require('util');

let pass = 0;
let fail = 0;
const t = {
  group(name) { console.log('\n' + name); },
  ok(cond, msg) {
    if (cond) { pass++; console.log('  ok   ' + msg); }
    else { fail++; console.log('  FAIL ' + msg); }
  },
  equal(actual, expected, msg) {
    const ok = actual === expected;
    t.ok(ok, ok ? msg : msg + ` (expected ${util.inspect(expected)}, got ${util.inspect(actual)})`);
  },
  deepEqual(actual, expected, msg) {
    const ok = util.isDeepStrictEqual(actual, expected);
    t.ok(ok, ok ? msg : msg + ` (expected ${util.inspect(expected)}, got ${util.inspect(actual)})`);
  },
};

const suites = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['hex', 'data', 'sim', 'build'];

for (const name of suites) {
  require('./' + name + '.test.js')(t);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
