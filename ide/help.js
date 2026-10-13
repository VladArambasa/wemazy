/*!
 * Wemazy IDE - Help: getting started, the language reference (made from the
 * language packs; explanations in the language of the interface), shortcuts, about.
 */
(function (root) {
  'use strict';
  var W = root.Wemazy = root.Wemazy || {};
  var U = W.util, h = U.h, P = W.Project, L = W.lang;

  // The core statements: the C-like way first (syntax), the way with words after (alt).
  // {comment} is replaced by a note in the language of the interface; {/if} by "end if".
  var STATEMENTS = [
    { id: 'vars',
      syntax: 'var score = 0\nscore = score + 1\nscore++\nscore += 10\nscore--',
      alt: 'set score to 0\nincrease score by 10\ndecrease score' },
    { id: 'props',
      syntax: 'Label1.text = "Hi, " + NameBox.text\nButton1.visible = false\nPanel1.background = "#ffeeaa"',
      alt: 'set Label1.text to "Hi, " & NameBox.text\nset Button1.visible to false' },
    { id: 'if',
      syntax: 'var score = 12\nif (score > 10) {\n    print "big"\n} else if (score == 10) {\n    print "ten"\n} else {\n    print "small"\n}\nif (score > 100) print "wow"',
      alt: 'if score > 10 then\n    print "big"\nelse if score = 10 then\n    print "ten"\nelse\n    print "small"\n{/if}\nif score > 100 then print "wow"' },
    { id: 'switch',
      syntax: 'var day = 3\nswitch (day) {\n    case 6: case 7:\n        print "weekend"\n    case 1:\n        print "Monday"\n    default:\n        print "a weekday"\n}' },
    { id: 'compare',
      syntax: 'var a = 3, b = 5, name = "Ana"\nprint a == b\nprint a != b && a < b\nprint !(a > b) || a >= 3\nprint name.contains("n") && name.startsWith("a")\nprint name.empty()',
      alt: 'print a is b\nprint a is not b and a is less than b\nprint not a is greater than b\nprint name contains "n"\nprint name starts with "a"\nprint name is empty' },
    { id: 'logic',
      syntax: 'var a = 3, b = 5\n// {logicCaps}\nprint a > 1 AND b > 1      // true\nprint a > 4 OR b > 4       // true\nprint a > 1 XOR b > 1      // false\nprint NOT a > 1            // false\nprint a > 1 NAND b > 1     // false\nprint a > 4 NOR b > 4      // false\nprint a > 1 XNOR b > 1     // true\n\n// {bitsSmall}\nprint 6 and 3              // 2\nprint 6 or 3               // 7\nprint 6 xor 3              // 5\nprint not 5                // -6\nprint 1 shl 4              // 16\nprint 255 shr 4            // 15\nuint8 flags = 0\nflags = flags or 4         // {setBit}\nprint (flags and 4) != 0   // {testBit}\nflags = flags and not 4    // {clearBit}\n\n// {bitsCond}\nprint a > 1 and b > 1      // true' },
    { id: 'repeat',
      syntax: 'repeat 3 times {\n    print "hello"\n}\n\nvar x = 0\nwhile (x < 10) {\n    x++\n    if (x == 5) continue\n    if (x > 8) break\n}\n\ndo {\n    x--\n} while (x > 0)',
      alt: 'repeat 3 times\n    print "hello"\n{/repeat}\n\nset x to 0\nrepeat while x < 10\n    increase x\n    if x = 5 then skip\n    if x > 8 then stop\n{/repeat}' },
    { id: 'for',
      syntax: 'for (var i = 1; i <= 10; i++) {\n    print i\n}\n\nforeach (var name in ["Ana", "Ion"]) {\n    List1.add(name)\n}',
      alt: 'for i from 1 to 10\n    print i\n{/for}\n\nfor each name in ["Ana", "Ion"]\n    add name to List1\n{/for}' },
    { id: 'lists',
      syntax: 'var fruits = ["apple", "pear"]\nfruits.add("plum")\nfruits.remove("apple")\nprint fruits[1]\nprint fruits.length\nfruits.sort()',
      alt: 'set fruits to ["apple", "pear"]\nadd "plum" to fruits\nremove "apple" from fruits\nprint length(fruits)' },
    { id: 'records',
      syntax: 'var pet = {name: "Rex", age: 3}\nprint pet.name\npet.age = 4',
      alt: 'set pet to {name: "Rex", age: 3}\nset pet.age to 4' },
    { id: 'text',
      syntax: 'var name = "Ana"\nvar hello = "Hi, {name}!"\nvar full = name + " " + "Pop"\nprint full.toUpper()\nprint full.length\nif (NameBox.text.empty()) print "Write something"\n// {comment}\n/* {comment}:\n   on several lines */',
      alt: 'set full to name & " " & "Pop"\nprint upper(full)\nprint length(full)\n# {comment}' },
    { id: 'functions',
      syntax: 'function double(n) {\n    return n * 2\n}\n\nvar x = double(21)\nprint x.double()\n\n// {typedFn}\nint32 add(int32 a, int32 b) {\n    return a + b\n}\nvoid hello(string who) {\n    print "Hello, " + who\n}',
      alt: 'function double(n)\n    return n * 2\n{/function}\n\nset x to double(21)' },
    { id: 'types',
      syntax: 'var int32 a = 7\nvar unsigned int8 b = 200\nconst float64 PI = 3.14159\nint64 big = 1234567890123\nstring name = "Ana"\nchar c = \'A\'\nbool ok = true\nint32 marks[5]\nfloat32[] prices = [1.5, 2]\n\nprint a / 2        // 3: {intDiv}\nprint (float64)a / 2   // 3.5\nprint b + 100      // 300: {promote}\nb = 300            // {wrap}\nprint c + 1        // 66: {charCode}\nprint (char)(c + 1)    // B\nprint int32.MaxValue\nprint sizeof(int64)' },
    { id: 'struct',
      syntax: 'struct Point {\n    int32 x\n    int32 y\n}\n\nPoint p = {3, 4}\nPoint q = p          // {copied}\nq.x = 100\nprint p.x            // 3\nprint p              // {x: 3, y: 4}\n\nunion Number {\n    int32 i\n    float32 f\n}\nNumber n\nn.f = 1.0\nprint n.i            // 1065353216: {sameBytes}' },
    { id: 'class',
      syntax: 'class Animal {\n    public string name\n    protected int32 legs = 4\n    public static int32 count = 0\n\n    public Animal(string name) {\n        this.name = name\n        count++\n    }\n    public virtual string sound() { return "..." }\n    public string speak() { return name + " says " + sound() }\n}\n\nclass Dog : Animal {\n    public Dog(string name) : base(name) { }\n    public override string sound() { return "woof" }\n}\n\nDog rex = new Dog("Rex")\nprint rex.speak()        // Rex says woof\nAnimal pet = rex         // {baseRef}\nprint pet is Dog         // true\nprint Animal.count       // 1\nvar x = new Dog("Max")   // {varObj}' },
    { id: 'interface',
      syntax: 'interface IShape {\n    float64 area()\n}\n\nabstract class Shape : IShape {\n    public abstract float64 area()\n    public string show() { return "area " + area() }\n}\n\nclass Circle : Shape {\n    private float64 r\n    public Circle(float64 r) { this.r = r }\n    public override float64 area() { return 3.14159 * r * r }\n}\n\nIShape[] shapes = [new Circle(1), new Circle(2)]\nforeach (IShape s in shapes) print s.area()' },
    { id: 'guiclass',
      syntax: 'Button b = Button1          // {ctlVar}\nb.text = "Press me"\nb.hide()\n\nControl[] all = [Button1, Label1]\nforeach (Control c in all) print c.name\n\nfunction highlight(Text t) {\n    t.color = "red"\n}\nhighlight(Label1)\n\n// {ctlNew}\nButton nb = new Button()\nnb.text = "New"\nPanel1.add(nb)\nnb.click += pressed\n\nfunction pressed(Button sender) {\n    sender.text = "Pressed!"\n}' },
    { id: 'events',
      syntax: 'when Button1 clicked {\n    Label1.text = "Clicked!"\n}\n\nwhen page loads {\n    NameBox.focus()\n}',
      alt: 'when Button1 clicked\n    set Label1.text to "Clicked!"\n{/when}\n\nwhen page loads\n    focus on NameBox\n{/when}' },
    { id: 'timers',
      syntax: 'var ticks = 0\nevery 1 seconds {\n    ticks++\n}\n\nwait 2 seconds\nwait(500)   // milliseconds',
      alt: 'every 1 seconds\n    increase ticks\n{/every}\n\nwait 500 milliseconds' },
    { id: 'keys',
      syntax: 'when key pressed {\n    if (key == "left") Player.x -= 10\n    if (key == "right") Player.x += 10\n}',
      alt: 'when key pressed\n    if key = "left" then decrease Player.x by 10\n{/when}' },
    { id: 'database',
      syntax: 'var rows = find all Products where price < 10 order by name\nvar one = find first Users where email == "ana@example.com"\nvar n = Orders.count()\nProducts.add({name: "Pen", price: 2})\nupdate Products set price = price * 2 where id == 3\ndelete from Orders where done == true',
      alt: 'set n to count Orders\nadd {name: "Pen", price: 2} to Products' },
    { id: 'server',
      syntax: 'server function login(user, pass) {\n    var u = find first Users where name == user\n    if (u.empty()) return false\n    session.user = user\n    return checkHash(pass, u.password)\n}',
      alt: 'server function login(user, pass)\n    set u to find first Users where name = user\n    if u is empty then return false\n    set session.user to user\n    return checkHash(pass, u.password)\n{/function}' },
    { id: 'errors',
      syntax: 'try {\n    var data = fetch("https://example.com/data.json")\n} catch (e) {\n    message("Could not load: " + e)\n}',
      alt: 'try\n    set data to fetch("https://example.com/data.json")\non error\n    show message "Could not load: " & error\n{/try}' },
    { id: 'output',
      syntax: 'message("Hello!")\nvar name = ask("What is your name?")\nprint "You are " + name\nPanel1.hide()\ngoTo("About")',
      alt: 'show message "Hello!"\nask "What is your name?" into name\nhide Panel1\ngo to page About' }
  ];

  var STEP3 = 'when Button1 clicked {\n    Text1.text = "Hello, " + TextBox1.text + "!"\n}';
  var STEP5 = 'when Button1 clicked {\n    Messages.add({name: TextBox1.text, message: TextBox2.text})\n    Table1.data = find all Messages order by id descending\n}';

  function Help(app, host) {
    this.app = app;
    this.host = host;
    this.section = 'start';
    this.el = h('div.help');
    this.host.appendChild(this.el);
  }
  var Hp = Help.prototype;

  Hp.vocab = function () { return this.app.project ? P.vocab(this.app.project) : L.getVocab(['en']); };
  Hp.lang = function () { return 'en'; };

  /** Write a statement example in the language of the project. */
  Hp.say = function (text) {
    var v = this.vocab(), lang = this.lang();
    return text.replace(/\{(\/?[\w.]+~?(?: [\w]+)?)\}/g, function (m, k) {
      if (k === 'comment') return W.t('help.comment');
      if (/^(typedFn|intDiv|promote|wrap|charCode|copied|sameBytes|baseRef|varObj|ctlVar|ctlNew|logicCaps|bitsSmall|setBit|testBit|clearBit|bitsCond)$/.test(k)) return W.t('help.c.' + k);
      if (k.charAt(0) === '/') return L.endFor(k.slice(1), v);
      if (k.slice(-1) === '~') return v.sayShort(k.slice(0, -1), lang);
      if (k === 'show message') return (v.cmdDefs.message.patterns[lang] || v.cmdDefs.message.patterns.en)[0].replace(' {text}', '');
      if (k === 'focus') return ((v.cmdDefs.focus.patterns[lang] || v.cmdDefs.focus.patterns.en)[0] || 'focus').replace(/ \{.*$/, '');
      if (v.phrases[k]) return v.say(k, lang);
      return m;
    });
  };

  Hp.render = function () {
    var self = this;
    U.clear(this.el);
    var nav = h('nav.help-nav', { 'aria-label': W.t('help.title') });
    ['start', 'language', 'commands', 'functions', 'controls', 'shortcuts', 'about'].forEach(function (s) {
      nav.appendChild(h('button.help-link', { type: 'button', class: self.section === s ? 'on' : '', onclick: function () { self.section = s; self.render(); } }, W.t('help.s.' + s)));
    });
    this.search = h('input.input.small', { type: 'search', placeholder: W.t('help.search'), 'aria-label': W.t('help.search'), value: this.query || '',
      oninput: function () { self.query = self.search.value; self.renderBody(); } });
    nav.appendChild(this.search);
    this.body = h('div.help-body');
    this.el.appendChild(nav);
    this.el.appendChild(this.body);
    this.renderBody();
  };

  Hp.renderBody = function () {
    var b = this.body;
    U.clear(b);
    // the colours of the examples: words of the language, tables and controls of the examples
    var p = this.app.project, ctl = {};
    ['label1', 'text1', 'namebox', 'textbox1', 'textbox2', 'button1', 'panel1', 'list1', 'player', 'table1'].forEach(function (n) { ctl[n] = 1; });
    var tbl = {};
    ['products', 'users', 'orders', 'messages'].forEach(function (n) { tbl[n] = 1; });
    if (p) p.tables.forEach(function (t) { tbl[L.norm(t.name)] = 1; });
    var types = { control: 1, point: 1, number: 1, animal: 1, dog: 1, ishape: 1, shape: 1, circle: 1 };
    W.controls.list.forEach(function (c) { types[L.norm(c.type)] = 1; });
    hlCtx = { vocab: this.vocab(), controls: ctl, tables: tbl, functions: {}, types: types };
    var q = W.lang.norm(this.query || '');
    switch (this.section) {
      case 'start': this.renderStart(b); break;
      case 'language': this.renderLanguage(b, q); break;
      case 'commands': this.renderCommands(b, q); break;
      case 'functions': this.renderFunctions(b, q); break;
      case 'controls': this.renderControls(b, q); break;
      case 'shortcuts': this.renderShortcuts(b); break;
      case 'about': this.renderAbout(b); break;
    }
  };

  var hlCtx = null;
  function code(text, alt) {
    var pre = h(alt ? 'pre.help-code.alt' : 'pre.help-code');
    pre.innerHTML = W.Editor && W.Editor.colorize ? W.Editor.colorize(text, 'wz', hlCtx) : U.esc(text);
    return pre;
  }

  Hp.renderStart = function (b) {
    b.appendChild(h('h1', W.t('help.startTitle')));
    b.appendChild(h('p.lead', W.t('help.startLead')));
    var v = this.vocab(), lang = this.lang();
    var steps = [
      ['help.step1', null],
      ['help.step2', null],
      ['help.step3', this.say(STEP3)],
      ['help.step4', null],
      ['help.step5', this.say(STEP5)],
      ['help.step6', null]
    ];
    var ol = h('ol.help-steps');
    steps.forEach(function (s) {
      ol.appendChild(h('li', h('b', W.t(s[0] + 't')), h('p', W.t(s[0])), s[1] ? code(s[1]) : null));
    });
    b.appendChild(ol);
    b.appendChild(h('h2', W.t('help.twoWays')));
    b.appendChild(h('p', W.t('help.twoWaysText')));
    b.appendChild(h('h2', W.t('help.namesTitle')));
    b.appendChild(h('p', W.t('help.namesText')));
    void v; void lang;
  };

  Hp.renderLanguage = function (b, q) {
    var self = this;
    b.appendChild(h('h1', W.t('help.s.language')));
    b.appendChild(h('p.lead', W.t('help.langLead')));
    STATEMENTS.forEach(function (s) {
      var ex = self.say(s.syntax), alt = s.alt ? self.say(s.alt) : '';
      var title = W.t('help.st.' + s.id), doc = W.t('help.st.' + s.id + '.doc');
      if (q && W.lang.norm(title + ' ' + doc + ' ' + ex + ' ' + alt).indexOf(q) < 0) return;
      b.appendChild(h('section.help-item', h('h3', title), h('p', doc), code(ex),
        alt ? h('p.muted.small.help-alt', W.t('help.alsoWords')) : null, alt ? code(alt, true) : null));
    });
  };

  Hp.renderCommands = function (b, q) {
    var v = this.vocab(), lang = this.lang(), ui = W.i18n.lang;
    b.appendChild(h('h1', W.t('help.s.commands')));
    b.appendChild(h('p.lead', W.t('help.cmdLead')));
    Object.keys(v.cmdDefs).forEach(function (id) {
      var d = v.cmdDefs[id];
      var pats = d.patterns[lang] || d.patterns.en || [];
      var doc = d.doc[ui] || d.doc.en || '';
      var ex = d.example[lang] || d.example.en || '';
      var shown = pats.map(function (x) { return x.replace(/\{(\w+):\w+\}/g, '{$1}'); });   // "show {control}"
      var title = Hp.cFormOf(v, d) || shown[0] || id;
      var also = Hp.cFormsOf(v, d).slice(1).concat(shown).filter(function (x) { return x !== title; });
      if (q && W.lang.norm(title + ' ' + pats.join(' ') + ' ' + doc).indexOf(q) < 0) return;
      b.appendChild(h('section.help-item', h('h3', h('code', title)), h('p', doc),
        also.length ? h('p.muted', W.t('help.alsoWritten') + ' ', also.map(function (p) { return h('code', p); })) : null,
        ex ? code(ex) : null, h('p.muted.small', d.php ? W.t('lab.pageAndServer') : W.t('lab.pageOnly'))));
    });
  };

  Hp.renderFunctions = function (b, q) {
    var v = this.vocab(), lang = this.lang(), ui = W.i18n.lang;
    b.appendChild(h('h1', W.t('help.s.functions')));
    b.appendChild(h('p.lead', W.t('help.fnLead')));
    var groups = {};
    Object.keys(v.funcDefs).forEach(function (id) {
      var d = v.funcDefs[id];
      (groups[d.group || 'other'] || (groups[d.group || 'other'] = [])).push(d);
    });
    Object.keys(groups).forEach(function (g) {
      var items = groups[g].filter(function (d) {
        var name = L.fnName(d, lang);
        return !q || W.lang.norm(name + ' ' + (d.doc[ui] || d.doc.en || '')).indexOf(q) >= 0;
      });
      if (!items.length) return;
      b.appendChild(h('h2', W.t('help.fg.' + g)));
      items.forEach(function (d) {
        var params = (d.paramNames && d.paramNames[lang]) || d.params || [];
        var name = L.fnName(d, lang);
        // x.upper() is upper(x)
        var mname = d.methods && d.methods[0] ? d.methods[0] : name;
        var asMethod = params.length ? params[0].replace(/\?$/, '') + '.' + mname + '(' + params.slice(1).join(', ') + ')' : '';
        b.appendChild(h('section.help-item.fn', h('h3', h('code', name + '(' + params.join(', ') + ')')),
          asMethod ? h('p.muted', W.t('help.asMethod') + ' ', h('code', asMethod)) : null,
          h('p', d.doc[ui] || d.doc.en || ''),
          (d.example[lang] || d.example.en) ? code(d.example[lang] || d.example.en) : null,
          !d.js ? h('p.muted.small', W.t('lab.serverOnly')) : (!d.php ? h('p.muted.small', W.t('lab.pageOnly')) : null)));
      });
    });
  };

  Hp.renderControls = function (b, q) {
    var v = this.vocab(), lang = this.lang();
    b.appendChild(h('h1', W.t('help.s.controls')));
    b.appendChild(h('p.lead', W.t('help.ctlLead')));
    W.controls.list.forEach(function (c) {
      if (c.internal || c.toolboxOnly) return;
      var name = W.t('ctl.' + c.type);
      if (q && W.lang.norm(name + ' ' + W.t('ctldesc.' + c.type)).indexOf(q) < 0) return;
      var props = Object.keys(c.code || {}).filter(function (k) { return ['color', 'background', 'size', 'bold', 'italic', 'width', 'height', 'x', 'y', 'opacity', 'tooltip', 'align', 'radius', 'border'].indexOf(k) < 0; })
        .map(function (k) { return v.say('prop.' + k, lang); });
      var evs = Object.keys(c.events || {}).map(function (k) { return v.say('ev.' + k, lang); });
      b.appendChild(h('section.help-item', h('h3', { html: W.icons.svg(c.icon) + ' ' + U.esc(name) }),
        h('p', W.t('ctldesc.' + c.type)),
        props.length ? h('p', h('b', W.t('help.props') + ' '), props.map(function (p) { return h('code', p); }), ' ', h('span.muted', W.t('help.plusStyle'))) : null,
        evs.length ? h('p', h('b', W.t('help.events') + ' '), evs.map(function (e) { return h('code', e); })) : null));
    });
  };

  Hp.renderShortcuts = function (b) {
    b.appendChild(h('h1', W.t('help.s.shortcuts')));
    var mod = U.isMac ? '⌘' : 'Ctrl';
    var rows = [
      ['F1', 'menu.help'], ['F5', 'cmd.run'], ['Shift+F5', 'cmd.stop'], ['F7', 'cmd.viewCode'], ['Shift+F7', 'cmd.viewDesigner'], [mod + '+S', 'cmd.save'],
      [mod + '+Z', 'cmd.undo'], [mod + '+Y', 'cmd.redo'], [mod + '+C / X / V', 'help.clip'], [mod + '+D', 'cmd.duplicate'], ['Delete', 'cmd.delete'],
      ['F2', 'cmd.rename'], ['F4', 'cmd.properties'], [mod + '+Space', 'help.autocomplete'], [mod + '+/', 'help.comment2'], ['Shift+Alt+F', 'cmd.format'],
      [mod + '+F', 'help.find'], [mod + '+H', 'help.replace'], [mod + '+Shift+B', 'cmd.build'], ['Esc', 'help.selectParent'], ['↑ ↓ ← →', 'help.arrows'], ['Alt', 'help.noSnap']
    ];
    var t = h('table.grid');
    rows.forEach(function (r) { t.appendChild(h('tr', h('td', h('kbd', r[0])), h('td', W.t(r[1])))); });
    b.appendChild(t);
  };

  Hp.renderAbout = function (b) {
    b.appendChild(h('div.about-logo', { html: W.icons.logo(56) }));
    b.appendChild(h('h1', 'Wemazy ' + L.version));
    b.appendChild(h('p.lead', W.t('help.aboutLead')));
    b.appendChild(h('p', W.t('help.aboutParts')));
    b.appendChild(h('p', W.t('help.aboutCommunity')));
    b.appendChild(h('p.muted', W.t('help.aboutLicence')));
    var storage = W.store.mode === 'server' ? W.t('help.storedServer') : (W.store.backend === 'indexeddb' ? W.t('help.storedIdb') : W.t('help.storedLs'));
    b.appendChild(h('p.muted', storage));
  };

  /** The C-like ways to write a command: message(text), Control.show() */
  Hp.cFormsOf = function (v, d) {
    var c = v.cmdFirst[d.id];
    if (!c) return [];
    var slots = c.parts.filter(function (p) { return p.slot && p.kind !== 'target'; });
    var out = [];
    [].concat(d.method || []).forEach(function (m) {
      var rest = slots.filter(function (p) { return p.kind !== 'control'; }).map(function (p) { return p.slot; });
      out.push('Control.' + m + '(' + rest.join(', ') + ')');
    });
    [].concat(d.call || []).forEach(function (m) {
      var args = d.callArgs ? d.callArgs.slice() : slots.map(function (p) { return p.slot; });
      var hasValue = c.parts.some(function (p) { return p.kind === 'target'; });
      out.push((hasValue ? 'var answer = ' : '') + m + '(' + args.join(', ') + ')');
    });
    return out;
  };
  Hp.cFormOf = function (v, d) { return Hp.cFormsOf(v, d)[0] || null; };

  W.Help = Help;
  W.Help.STATEMENTS = STATEMENTS;
  W.Help.STEP3 = STEP3;
  W.Help.STEP5 = STEP5;
})(typeof window !== 'undefined' ? window : globalThis);
