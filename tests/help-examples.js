// Every example of the Help (language page and getting started) must compile.
//   node tests/help-examples.js
const W = require('./load.js');
global.window = globalThis;
require('../language/packs/fun.js');
const L = W.lang;
// help.js needs a few IDE helpers; give it the minimum
W.util = { h: () => null, $: () => null };
W.Project = {};
require('../ide/help.js');
const ST = W.Help.STATEMENTS;

require('../ide/controls.js');
const controlTypes = W.controls.codeTypes();
const types = { Label1: 'Text', Text1: 'Text', NameBox: 'TextBox', TextBox1: 'TextBox', TextBox2: 'TextBox',
  Button1: 'Button', Panel1: 'Panel', List1: 'List', Player: 'Image', Table1: 'Table' };
const controls = Object.keys(types).map(n => ({ name: n, type: types[n] }));
const tables = [
  { name: 'Products', columns: [{ name: 'name', type: 'text' }, { name: 'price', type: 'number' }], rows: [] },
  { name: 'Users', columns: [{ name: 'name', type: 'text' }, { name: 'email', type: 'text' }, { name: 'password', type: 'text' }], rows: [] },
  { name: 'Orders', columns: [{ name: 'done', type: 'yesno' }], rows: [] },
  { name: 'Messages', columns: [{ name: 'name', type: 'text' }, { name: 'message', type: 'longtext' }], rows: [] }
];

let bad = 0;
ST.push({ id: 'step3', syntax: W.Help.STEP3 });
ST.push({ id: 'step5', syntax: W.Help.STEP5 });
for (const lang of ['en']) {
  const langs = ['en'];
  const v = L.getVocab(langs, ['core', 'fun']);
  const say = (text) => text.replace(/\{(\/?[\w.]+~?(?: [\w]+)?)\}/g, (m, k) => {
    if (k === 'comment') return 'a note';
    if (/^(typedFn|intDiv|promote|wrap|charCode|copied|sameBytes|baseRef|varObj|ctlVar|ctlNew|logicCaps|bitsSmall|setBit|testBit|clearBit|bitsCond)$/.test(k)) return 'a note';
    if (k.charAt(0) === '/') return L.endFor(k.slice(1), v);
    if (k.slice(-1) === '~') return v.sayShort(k.slice(0, -1), lang);
    if (k === 'show message') return (v.cmdDefs.message.patterns[lang] || v.cmdDefs.message.patterns.en)[0].replace(' {text}', '');
    if (k === 'focus') return ((v.cmdDefs.focus.patterns[lang] || v.cmdDefs.focus.patterns.en)[0] || 'focus').replace(/ \{.*$/, '');
    if (v.phrases[k]) return v.say(k, lang);
    return m;
  });
  for (const s of ST) {
    // the C-like example, and the example with words (after it, so it can use its variables)
    const variants = [say(s.syntax)];
    if (s.alt) variants.push(/^\s*(server\s+)?function\b/m.test(s.alt) ? say(s.alt) : say(s.syntax) + '\n' + say(s.alt));
    for (const src of variants) {
      if (process.env.SHOW) console.log('--- [' + lang + '] ' + s.id + '\n' + src);
      const isServer = s.id === 'server';
      const project = {
        pages: [{ name: 'Home', code: isServer ? '' : src, controls }, { name: 'About', code: '', controls: [] }],
        siteCode: isServer ? src : '',
        tables
      };
      const r = L.compileProject(project, { langs, packs: ['core', 'fun'], msgLang: 'en', controlTypes });
      if (!r.ok) {
        bad++;
        console.log('[' + lang + '] ' + s.id + ':\n' + project.pages[0].code + project.siteCode + '\n  -> ' + r.errors.map(e => e.line + ': ' + e.msg).join('\n  -> '));
      }
    }
  }
  // the examples of every command and function
  const exPages = [{ name: 'Home', code: '', controls }, { name: 'About', code: '', controls: [] }];
  const extra = { AnswerBox: 'TextBox', Logo: 'Image', StarImage: 'Image', ScoreLabel: 'Text', SendButton: 'Button', ContactSection: 'Section', ClockLabel: 'Text' };
  Object.keys(extra).forEach(n => exPages[0].controls.push({ name: n, type: extra[n] }));
  const defs = [].concat(Object.keys(v.cmdDefs).map(k => v.cmdDefs[k]), Object.keys(v.funcDefs).map(k => v.funcDefs[k]));
  for (const d of defs) {
    let ex = (d.example && (d.example.en || '')) || '';
    if (!ex || d.group === 'server') continue;
    // "upper("hello") → "HELLO"": only the code before the arrow, as a value
    ex = ex.split('\n').map(l => l.split(' → ')[0]).join('\n');
    if (!/^\s*(var |if |if\(|[A-Za-z_][\w.]*\s*=[^=]|[A-Za-z_][\w.]*\(.*\)\s*$|[A-Za-z_]\w*\.\w+\()/.test(ex.split('\n')[0])) ex = 'print ' + ex;
    const pre = 'var list = [1, 2]\nvar score = 1\nvar players = []\nvar person = {name: "x"}\nvar data = 0\nvar best = 0\nvar r = 1\n';
    exPages[0].code = pre + ex;
    const r = L.compileProject({ pages: exPages, siteCode: '', tables }, { langs, packs: ['core', 'fun'], msgLang: 'en', controlTypes });
    if (!r.ok) {
      bad++;
      console.log('example of ' + d.id + ':\n' + ex + '\n  -> ' + r.errors.map(e => e.line + ': ' + e.msg).join('\n  -> '));
    }
  }
}
console.log(bad ? bad + ' example(s) do not compile' : 'all help examples compile');
process.exit(bad ? 1 : 0);
