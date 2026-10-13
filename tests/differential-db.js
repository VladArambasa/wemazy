// Same database program on the browser test server and on PHP + SQLite.
//   node tests/differential-db.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const W = require('./load.js');
require('../runtime/core.js');
require('../runtime/server.js');
require('../runtime/php.js');
const L = W.lang;

const tables = [
  { name: 'Products', columns: [{ name: 'name', type: 'text' }, { name: 'price', type: 'number' }, { name: 'stock', type: 'integer' }, { name: 'onSale', type: 'yesno' }, { name: 'added', type: 'date' }],
    rows: [
      { name: 'Apple', price: 3, stock: 10, onSale: true, added: '2026-10-01' },
      { name: 'banana', price: 1.5, stock: 0, onSale: false, added: '2026-10-02' },
      { name: 'Cherry', price: '12,5', stock: 4, onSale: 'no', added: '' },
      { name: 'Date 100%', price: 7, stock: null, onSale: 1 }
    ] },
  { name: 'Orders', columns: [{ name: 'product', type: 'text' }, { name: 'qty', type: 'integer' }, { name: 'note', type: 'longtext' }], rows: [] }
];

const code = fs.readFileSync(path.join(__dirname, 'differential-db.wz'), 'utf8');

async function main() {
  const r = L.compileProject({ pages: [{ name: 'Home', code: '', controls: [] }], siteCode: code, tables }, { langs: ['en'] });
  if (r.errors.length) { console.error(r.errors); process.exit(1); }
  const jsOut = [];
  const srv = W.runtime.server(W.runtime.core(), { print: (t) => jsOut.push(t) });
  srv.sync(tables);
  srv.load(r.server.js);
  await srv.call('t', []);
  const dir = path.join(__dirname, 'tmp', 'diffdb');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'wemazy'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'wemazy', 'runtime.php'), W.runtime.php);
  fs.writeFileSync(path.join(dir, 'wemazy', 'server.php'), r.server.php + '\n' + L.phpSchema(tables) + '\n');
  fs.writeFileSync(path.join(dir, 'config.php'), "<?php return ['db' => 'sqlite', 'sqlite_file' => __DIR__ . '/data/t.sqlite', 'debug' => true];\n");
  fs.writeFileSync(path.join(dir, 'run.php'), "<?php require __DIR__ . '/wemazy/runtime.php'; require __DIR__ . '/wemazy/server.php';\n" +
    "try { f_t(); } catch (Throwable $e) { $GLOBALS['wz_log'][] = 'FATAL: ' . $e->getMessage() . ' ' . $e->getFile() . ':' . $e->getLine(); }\n" +
    "echo json_encode($GLOBALS['wz_log'], JSON_UNESCAPED_UNICODE);\n");
  const phpOut = JSON.parse(execFileSync('php', [path.join(dir, 'run.php')], { encoding: 'utf8' }));
  let bad = 0;
  const n = Math.max(jsOut.length, phpOut.length);
  for (let i = 0; i < n; i++) {
    if (jsOut[i] !== phpOut[i]) { bad++; console.log(`#${i + 1} differs:\n   JS : ${JSON.stringify(jsOut[i])}\n   PHP: ${JSON.stringify(phpOut[i])}`); }
  }
  if (process.argv.includes('-v')) jsOut.forEach((x, i) => console.log(String(i + 1).padStart(3), x));
  console.log(bad ? `${bad} of ${n} lines differ` : `All ${n} database lines are the same in JS and PHP + SQLite.`);
  process.exit(bad ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
