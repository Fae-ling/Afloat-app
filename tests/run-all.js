// Runs the browser tests with Playwright (Chromium).
//   node tests/run-all.js                 every test (smoke first)
//   node tests/run-all.js beat calm       only tests whose file name contains "beat" or "calm" (plus smoke)
//   node tests/run-all.js -j 3            three at a time (default: 2; CI uses 4)
//   node tests/run-all.js --shard 2/4     the second quarter of the tests (CI splits the suite this way)
// A test fails when it prints FAIL, an error or a timeout, exits non-zero, or doesn't end with NO PAGE ERRORS.
const { execFile } = require('child_process'), fs = require('fs'), path = require('path');
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const jobs = Math.max(1, +(opt('-j') || 2)), shard = opt('--shard');
let tests = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort();
if (args.length) tests = tests.filter(f => f === 'smoke.test.js' || args.some(a => f.includes(a)));
tests = ['smoke.test.js', ...tests.filter(f => f !== 'smoke.test.js')].filter(f => fs.existsSync(path.join(__dirname, f)));
if (shard) { const [k, n] = shard.split('/').map(Number); tests = tests.filter((_, i) => i % n === k - 1); }
const t0 = Date.now(); let failed = 0, next = 0;
const one = f => new Promise(res => {
  const s = Date.now();
  execFile(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8', timeout: 240000, maxBuffer: 1 << 24 }, (err, stdout = '', stderr = '') => {
    const out = stdout + stderr, bad = !!err || /FAIL|Error|exceeded/.test(out) || !/NO PAGE ERRORS/.test(out);
    if (bad) failed++;
    console.log(`${bad ? '✗' : '✓'} ${f} (${Math.round((Date.now() - s) / 1000)} s)`);
    if (bad) console.log(out.split('\n').filter(l => /FAIL|Error|exceeded/.test(l)).slice(0, 6).map(l => '   ' + l.slice(0, 300)).join('\n') || '   (no NO PAGE ERRORS line: the test stopped early)');
    res();
  });
});
const worker = async () => { while (next < tests.length) await one(tests[next++]); };
(async () => {
  await Promise.all(Array.from({ length: Math.min(jobs, tests.length) }, worker));
  console.log(`${tests.length - failed}/${tests.length} passed in ${Math.round((Date.now() - t0) / 1000)} s`);
  process.exit(failed ? 1 : 0);
})();
