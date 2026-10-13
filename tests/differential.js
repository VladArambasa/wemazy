// Runs the same Wemazy Script on the browser test server (JS) and on PHP,
// and checks that both print exactly the same lines.
//   node tests/differential.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const W = require('./load.js');
require('../runtime/core.js');
require('../runtime/server.js');
require('../runtime/php.js');
const L = W.lang;

// differential.wz is written with words (if ... then ... end if),
// differential-c.wz the C-like way ({ }, var, ++, methods),
// differential-types.wz with types, structs, unions and classes.
const files = process.argv.slice(2).filter((a) => a.endsWith('.wz'));
if (!files.length) files.push('differential.wz', 'differential-c.wz', 'differential-types.wz', 'differential-types2.wz', 'differential-logic.wz');

async function runFile(file) {
  const cases = fs.readFileSync(path.isAbsolute(file) ? file : path.join(__dirname, file), 'utf8');
  const project = { pages: [{ name: 'Home', code: '', controls: [] }], siteCode: cases, tables: [] };
  const r = L.compileProject(project, { langs: ['en'], debug: false });
  if (r.errors.length) { console.error(file + ': compile errors:', r.errors); process.exit(1); }
  // --- JS (browser test server) ---
  const jsOut = [];
  const core = W.runtime.core();
  const srv = W.runtime.server(core, { print: (t) => jsOut.push(t), schema: [] });
  srv.sync([]);
  srv.load(r.server.js);
  await srv.call('t', []);
  // --- PHP ---
  const dir = path.join(__dirname, 'tmp', 'diff');
  fs.mkdirSync(path.join(dir, 'wemazy'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'wemazy', 'runtime.php'), W.runtime.php);
  fs.writeFileSync(path.join(dir, 'wemazy', 'server.php'), r.server.php + '\n' + L.phpSchema([]) + '\n');
  fs.writeFileSync(path.join(dir, 'config.php'), "<?php return ['db' => 'sqlite', 'sqlite_file' => __DIR__ . '/data/t.sqlite'];\n");
  fs.writeFileSync(path.join(dir, 'run.php'), "<?php require __DIR__ . '/wemazy/runtime.php'; require __DIR__ . '/wemazy/server.php';\n" +
    "try { f_t(); } catch (Throwable $e) { $GLOBALS['wz_log'][] = 'FATAL: ' . $e->getMessage() . ' ' . $e->getFile() . ':' . $e->getLine(); }\n" +
    "echo json_encode($GLOBALS['wz_log'], JSON_UNESCAPED_UNICODE);\n");
  const phpOut = JSON.parse(execFileSync('php', [path.join(dir, 'run.php')], { encoding: 'utf8' }));
  // --- compare ---
  const lines = cases.split('\n');
  let bad = 0;
  const n = Math.max(jsOut.length, phpOut.length);
  for (let i = 0; i < n; i++) {
    if (jsOut[i] !== phpOut[i]) {
      bad++;
      console.log(`#${i + 1} differs:\n   JS : ${JSON.stringify(jsOut[i])}\n   PHP: ${JSON.stringify(phpOut[i])}`);
    }
  }
  if (process.argv.includes('-v')) jsOut.forEach((x, i) => console.log(String(i + 1).padStart(3), x));
  console.log(file + ': ' + (bad ? `${bad} of ${n} lines differ` : `all ${n} lines are the same in JS and PHP.`));
  return bad;
}

async function main() {
  let bad = 0;
  for (const f of files) bad += await runFile(f);
  process.exit(bad ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
