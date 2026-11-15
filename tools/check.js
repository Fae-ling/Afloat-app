// The one-second check, no browser and no installs: run it after every change, before any test.
//   node tools/check.js
// It checks that every app/*.js file is loaded by index.html and cached by sw.js, that each file and all of them together
// parse (a name defined twice across files is caught here), that meals/ and platform/ parse, and that docs/MAP.md is current.
const fs = require('fs'), path = require('path'), vm = require('vm'), { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
let bad = 0; const fail = m => { bad++; console.log('✗ ' + m); };
const html = rd('index.html'), sw = rd('sw.js'), mhtml = rd('meals/index.html');
const loaded = [...html.matchAll(/<script src="(app\/[^"]+)"/g)].map(m => m[1]);
const onDisk = fs.readdirSync(path.join(root, 'app')).filter(f => f.endsWith('.js')).map(f => 'app/' + f);
const mLoaded = [...mhtml.matchAll(/<script src="(js\/[^"]+)"/g)].map(m => 'meals/' + m[1]);
const mOnDisk = fs.readdirSync(path.join(root, 'meals', 'js')).filter(f => f.endsWith('.js')).map(f => 'meals/js/' + f);
for (const f of mOnDisk) if (!mLoaded.includes(f)) fail(`${f} is not loaded by meals/index.html`);
for (const f of mLoaded) if (!mOnDisk.includes(f)) fail(`meals/index.html loads ${f}, which doesn't exist`);
for (const f of [...mLoaded, 'meals/meals.css']) if (!sw.includes(`'./${f}'`)) fail(`sw.js doesn't cache ./${f} (add it to SHELL and bump CACHE)`);
for (const f of onDisk) if (!loaded.includes(f)) fail(`${f} is not loaded by index.html`);
for (const f of loaded) if (!onDisk.includes(f)) fail(`index.html loads ${f}, which doesn't exist`);
if (new Set(loaded).size !== loaded.length) fail('index.html loads a file twice');
for (const f of [...loaded, 'app/afloat.css']) if (!sw.includes(`'./${f}'`)) fail(`sw.js doesn't cache ./${f} (add it to SHELL and bump CACHE)`);
if (!html.includes('href="app/afloat.css"')) fail('index.html doesn\'t load app/afloat.css');
const parse = (code, name) => { try { new vm.Script(code, { filename: name }); return true; } catch (e) { fail(`${name}: ${e.message}${e.stack ? ' ' + (e.stack.split('\n')[0] || '') : ''}`); return false; } };
let all = true;
for (const f of loaded) all = parse(rd(f), f) && all;
const together = (files, label) => { /* a name defined in two files only shows up when they're parsed together; say where the second one is */
  const starts = []; let n = 1; const code = files.map(f => { const t = rd(f); starts.push([n, f]); n += t.split('\n').length + 1; return t; }).join('\n;\n');
  try { new vm.Script(code, { filename: 'all' }); } catch (e) { const ln = +((String(e.stack).match(/all:(\d+)/) || [])[1] || 0), at = starts.filter(([s]) => s <= ln).pop();
    fail(`${label}: ${e.message}${at ? ` (in ${at[1]} line ${ln - at[0] + 1}; the first one is elsewhere: grep docs/MAP.md)` : ''}`); } };
let mAll = true; for (const f of mLoaded) mAll = parse(rd(f), f) && mAll;
if (mAll) together(mLoaded, 'meals');
if (all) { /* together: a name defined in two files only shows up here; say which file the second one is in */
  const starts = []; let n = 1; const code = loaded.map(f => { const t = rd(f); starts.push([n, f]); n += t.split('\n').length + 1; return t; }).join('\n;\n');
  try { new vm.Script(code, { filename: 'all' }); } catch (e) { const ln = +((String(e.stack).match(/all:(\d+)/) || [])[1] || 0), at = starts.filter(([s]) => s <= ln).pop();
    fail(`${e.message}${at ? ` (in ${at[1]} line ${ln - at[0] + 1}; the first one is elsewhere: grep docs/MAP.md)` : ''}`); } }
for (const f of ['sw.js', ...fs.readdirSync(path.join(root, 'platform')).filter(f => f.endsWith('.js')).map(f => 'platform/' + f)]) parse(rd(f), f);
[...mhtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m, i) => parse(m[1], `meals/index.html script ${i + 1}`));
for (const f of fs.readdirSync(path.join(root, 'functions')).filter(f => f.endsWith('.js'))) parse(`(function(require,module,exports){${rd('functions/' + f)}\n})`, 'functions/' + f);
try { execFileSync(process.execPath, [path.join(__dirname, 'map.js'), '--check'], { stdio: 'pipe' }); } catch (e) { fail(String(e.stdout || e.message).trim()); }
/* the household's own details never go into the files Firebase serves to anyone (10 Nov 2026): names, places and the like
   come from the household's data. The words to look for are private too, so they aren't in the repository: the
   PRIVATE_WORDS secret on GitHub (one per line or comma-separated), or a local .private-words file (ignored by git). */
const privWords = (process.env.PRIVATE_WORDS || (fs.existsSync(path.join(root, '.private-words')) ? rd('.private-words') : '')).split(/[\n,]/).map(w => w.trim()).filter(w => w.length >= 3);
if (privWords.length) {
  const fold = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const served = [...loaded, 'app/afloat.css', 'index.html', 'sw.js', 'manifest.webmanifest', 'meals/index.html', 'meals/meals.css', ...mLoaded, ...fs.readdirSync(path.join(root, 'platform')).filter(f => /\.(js|html)$/.test(f)).map(f => 'platform/' + f)];
  const rx = new RegExp('(^|[^a-z0-9])(' + privWords.map(w => fold(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g');
  let hits = 0;
  for (const f of served) { if (!fs.existsSync(path.join(root, f))) continue; fold(rd(f)).split('\n').forEach((l, i) => { for (const m of l.matchAll(rx)) { hits++; if (hits <= (+process.env.PRIVATE_MAX || 30)) fail(`${f}:${i + 1} has a private word (“${m[2]}”): the household's details belong in its data, not in the files everyone can download`); } }); }
  if (hits > 30) fail(`…and ${hits - 30} more private words`);
}
console.log(bad ? `${bad} problem(s)` : `✓ ${loaded.length} app files, ${mLoaded.length} Meals files, sw.js, platform, functions and docs/MAP.md all fine${privWords.length ? `; no private words in the served files (${privWords.length} checked)` : ''}`);
process.exit(bad ? 1 : 0);
