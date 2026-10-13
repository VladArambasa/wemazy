/*!
 * Wemazy IDE - the Language Lab.
 * See every word, command and function of Wemazy Script, turn community packs
 * on and off, and make your own pack: new commands, new functions, other ways to
 * write a word. A pack is a small file you can share.
 */
(function (root) {
  'use strict';
  var W = root.Wemazy = root.Wemazy || {};
  var U = W.util, h = U.h, P = W.Project;
  var L = W.lang;

  function Lab(app, host) {
    this.app = app;
    this.host = host;
    this.packId = 'core';
    this.tab = 'commands';
    this.el = h('div.lab');
    this.host.appendChild(this.el);
  }
  var B = Lab.prototype;

  B.isMine = function (pk) { return !!(pk && pk.userMade); };

  B.render = function () {
    var self = this, app = this.app;
    U.clear(this.el);
    var side = h('div.lab-side');
    var main = h('div.lab-main');
    this.el.appendChild(side);
    this.el.appendChild(main);
    side.appendChild(h('div.dbd-side-title', W.t('lab.packs')));
    var used = (app.project && app.project.settings.packs) || [];
    L.packOrder.forEach(function (id) {
      var pk = L.packs[id];
      if (!pk) return;
      var row = h('div.lab-pack', { class: self.packId === id ? 'on' : '' });
      var check = null;
      if (!pk.builtin && app.project) {
        check = h('input', { type: 'checkbox', title: W.t('lab.useInProject'), 'aria-label': W.t('lab.useInProject') + ' ' + pk.name });
        check.checked = used.indexOf(id) >= 0;
        check.addEventListener('change', function () { self.toggleUse(id, check.checked); });
      }
      row.appendChild(check || h('span.lab-lock', { title: W.t('lab.always'), html: W.icons.svg('lock') }));
      row.appendChild(h('button.lab-pack-name', { type: 'button', onclick: function () { self.packId = id; self.render(); } },
        h('span', pk.name), h('span.muted', self.isMine(pk) ? W.t('lab.mine') : (pk.builtin ? W.t('lab.builtin') : W.t('lab.community')))));
      side.appendChild(row);
    });
    side.appendChild(h('div.row-gap.col',
      h('button.btn.small', { type: 'button', onclick: function () { self.newPack(); } }, '+ ' + W.t('lab.newPack')),
      h('button.btn.small', { type: 'button', onclick: function () { self.importPack(); } }, W.t('lab.import'))));
    side.appendChild(h('p.dbd-note', W.t('lab.note')));

    var pk = L.packs[this.packId] || L.packs.core;
    this.packId = pk.id;
    var mine = this.isMine(pk);
    var lang = W.i18n.lang;
    var head = h('div.lab-head',
      h('h2', pk.name + ' ', h('span.muted.small', 'v' + (pk.version || '1.0') + (pk.author ? ' · ' + pk.author : ''))),
      h('p', (pk.description && (pk.description[lang] || pk.description.en)) || ''),
      h('div.row-gap',
        mine ? h('button.btn.small', { type: 'button', onclick: function () { self.editInfo(pk); } }, W.t('lab.editInfo')) : null,
        h('button.btn.small', { type: 'button', onclick: function () { self.exportPack(pk); } }, W.t('lab.export')),
        mine ? h('button.btn.small.danger', { type: 'button', onclick: function () { self.deletePack(pk); } }, W.t('lab.deletePack')) : null));
    main.appendChild(head);
    var tabs = h('div.seg-group', { role: 'tablist' });
    ['commands', 'functions', 'words', 'try', 'runtime'].forEach(function (k) {
      tabs.appendChild(h('button.seg', { type: 'button', role: 'tab', class: self.tab === k ? 'on' : '', 'aria-selected': self.tab === k ? 'true' : 'false',
        onclick: function () { self.tab = k; self.render(); } }, W.t('lab.tab.' + k)));
    });
    main.appendChild(tabs);
    var box = h('div.lab-content');
    main.appendChild(box);
    if (this.tab === 'commands') this.renderCommands(pk, box, mine);
    else if (this.tab === 'functions') this.renderFunctions(pk, box, mine);
    else if (this.tab === 'words') this.renderWords(pk, box, mine);
    else if (this.tab === 'try') this.renderTry(pk, box);
    else this.renderRuntime(pk, box, mine);
  };

  B.toggleUse = function (id, on) {
    var p = this.app.project;
    var list = p.settings.packs || (p.settings.packs = []);
    var i = list.indexOf(id);
    if (on && i < 0) list.push(id);
    if (!on && i >= 0) list.splice(i, 1);
    P.embedPacks(p);
    this.app.changed(W.t('undo.packs'));
    U.toast(on ? W.t('lab.on', L.packs[id].name) : W.t('lab.off', L.packs[id].name));
  };

  /** All commands and functions of the whole language, for showing a pack's own. */
  function vocabAll() { return L.getVocab(['en'], L.packOrder); }

  B.renderCommands = function (pk, box, mine) {
    var self = this, lang = W.i18n.lang;
    var v = vocabAll();
    var ids = (pk.commands || []).map(function (c) { return c.id; });
    var trans = pk.translate ? Object.keys(pk.translate).reduce(function (acc, lg) { return acc.concat(Object.keys(pk.translate[lg].commands || {})); }, []) : [];
    box.appendChild(h('p.dbd-help', W.t('lab.commandsHelp')));
    var list = h('div.lab-list');
    uniq(ids.concat(trans)).forEach(function (id) {
      var d = v.cmdDefs[id];
      if (!d) return;
      var own = ids.indexOf(id) >= 0;
      var card = h('div.lab-card',
        h('div.lab-card-head', h('code.lab-pat', (d.patterns.en || [])[0] || id), h('span.tag', d.php ? W.t('lab.pageAndServer') : W.t('lab.pageOnly')),
          own && mine ? h('button.tb-btn', { type: 'button', title: W.t('lab.edit'), 'aria-label': W.t('lab.edit'), html: W.icons.svg('rename'), onclick: function () { self.editCommand(pk, d); } }) : null,
          own && mine ? h('button.tb-btn', { type: 'button', title: W.t('cmd.delete'), 'aria-label': W.t('cmd.delete'), html: W.icons.svg('trash'), onclick: function () { self.removeItem(pk, 'commands', id); } }) : null),
        h('div.lab-doc', d.doc[lang] || d.doc.en || ''),
        (function () {
          // the other patterns, and the C-like ways: flip(…), Logo.flip()
          var also = (d.patterns.en || []).slice(1)
            .concat([].concat(d.call || []).map(function (n) { return n + '(…)'; }))
            .concat([].concat(d.method || []).map(function (n) { return 'Control.' + n + '(…)'; }));
          return also.length ? h('div.lab-langs', h('div', h('span.lab-lg', W.t('help.alsoWritten')), also.map(function (x) { return h('code', x); }))) : null;
        })(),
        d.example && d.example.en ? h('div.lab-ex', h('code', d.example.en)) : null,
        h('details', h('summary', W.t('lab.translatesTo')),
          h('div.lab-tpl', h('span.lab-lg', 'JS'), h('code', d.js || '—')),
          h('div.lab-tpl', h('span.lab-lg', 'PHP'), h('code', d.php || W.t('lab.notOnServer')))));
      list.appendChild(card);
    });
    if (!list.children.length) list.appendChild(h('p.muted', W.t('lab.noneHere')));
    box.appendChild(list);
    if (mine) box.appendChild(h('button.btn.small.primary', { type: 'button', onclick: function () { self.editCommand(pk, null); } }, '+ ' + W.t('lab.addCommand')));
  };

  B.renderFunctions = function (pk, box, mine) {
    var self = this, lang = W.i18n.lang;
    var v = vocabAll();
    var ids = (pk.functions || []).map(function (f) { return f.id; });
    var trans = pk.translate ? Object.keys(pk.translate).reduce(function (acc, lg) { return acc.concat(Object.keys(pk.translate[lg].functions || {})); }, []) : [];
    box.appendChild(h('p.dbd-help', W.t('lab.functionsHelp')));
    var list = h('div.lab-list');
    uniq(ids.concat(trans)).forEach(function (id) {
      var d = v.funcDefs[id];
      if (!d) return;
      var own = ids.indexOf(id) >= 0;
      var others = (d.names.en || []).slice(1).map(function (x) { return x + '(' + (d.params || []).join(', ') + ')'; });
      if ((d.params || []).length) {
        // x.upper(): the name after a dot
        var mn = d.methods && d.methods[0] ? d.methods[0] : L.fnName(d, 'en');
        others.push(String(d.params[0]).replace(/[?.]/g, '') + '.' + mn + '(' + d.params.slice(1).join(', ') + ')');
      }
      var names = others.length ? h('div', h('span.lab-lg', W.t('help.alsoWritten')), others.map(function (x) { return h('code', x); })) : null;
      list.appendChild(h('div.lab-card',
        h('div.lab-card-head', h('code.lab-pat', L.fnName(d, 'en') + '(' + (d.params || []).join(', ') + ')'),
          h('span.tag', d.js && d.php ? W.t('lab.pageAndServer') : (d.js ? W.t('lab.pageOnly') : W.t('lab.serverOnly'))),
          own && mine ? h('button.tb-btn', { type: 'button', title: W.t('lab.edit'), 'aria-label': W.t('lab.edit'), html: W.icons.svg('rename'), onclick: function () { self.editFunction(pk, d); } }) : null,
          own && mine ? h('button.tb-btn', { type: 'button', title: W.t('cmd.delete'), 'aria-label': W.t('cmd.delete'), html: W.icons.svg('trash'), onclick: function () { self.removeItem(pk, 'functions', id); } }) : null),
        h('div.lab-doc', d.doc[lang] || d.doc.en || ''),
        d.example && d.example.en ? h('div.lab-ex', h('code', d.example.en)) : null,
        names ? h('div.lab-langs', names) : null,
        h('details', h('summary', W.t('lab.translatesTo')),
          h('div.lab-tpl', h('span.lab-lg', 'JS'), h('code', d.js || W.t('lab.notOnPage'))),
          h('div.lab-tpl', h('span.lab-lg', 'PHP'), h('code', d.php || W.t('lab.notOnServer'))))));
    });
    if (!list.children.length) list.appendChild(h('p.muted', W.t('lab.noneHere')));
    box.appendChild(list);
    if (mine) box.appendChild(h('button.btn.small.primary', { type: 'button', onclick: function () { self.editFunction(pk, null); } }, '+ ' + W.t('lab.addFunction')));
  };

  B.renderWords = function (pk, box, mine) {
    var self = this;
    var all = vocabAll();
    var core = (L.packs.core.vocab || {}).en || {};
    var own = (pk.vocab || {}).en || {};
    box.appendChild(h('p.dbd-help', mine ? W.t('lab.wordsHelpMine') : W.t('lab.wordsHelp')));
    var table = h('table.grid.words');
    table.appendChild(h('thead', h('tr', h('th', W.t('lab.meaning')), h('th', W.t('lab.words')), mine ? h('th', W.t('lab.extraWords')) : null)));
    var tb = h('tbody');
    var keys = Object.keys(core);
    Object.keys(all.phrases).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
    keys.forEach(function (canon) {
      var words = (all.displayAll.en || {})[canon] || core[canon] || [];
      var tr = h('tr', h('td', h('code', canon)), h('td', words.join(', ')));
      if (mine) {
        var inp = h('input.input.small', { type: 'text', value: (own[canon] || []).join(', '), spellcheck: false, 'aria-label': canon });
        inp.addEventListener('change', function () {
          pk.vocab = pk.vocab || {};
          pk.vocab.en = pk.vocab.en || {};
          var list = inp.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
          if (list.length) pk.vocab.en[canon] = list; else delete pk.vocab.en[canon];
          self.savePack(pk);
        });
        tr.appendChild(h('td', inp));
      }
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    box.appendChild(h('div.grid-wrap', table));
  };

  B.renderTry = function (pk, box) {
    var self = this, app = this.app;
    box.appendChild(h('p.dbd-help', W.t('lab.tryHelp')));
    var langs = ['en'];
    var sample = this.trySample !== undefined ? this.trySample : (function () {
      var c = (pk.commands || [])[0], f = (pk.functions || [])[0];
      var lines = [];
      if (c) lines.push((c.example && c.example.en) || (c.patterns.en || [''])[0]);
      if (f) lines.push(L.getVocab(langs).say('print') + ' ' + L.fnName(f, 'en') + '()');
      if (!lines.length) lines.push(L.getVocab(langs).say('print') + ' "Hello"');
      return lines.join('\n');
    })();
    var edHost = h('div.lab-try-ed');
    var outHost = h('div.lab-try-out');
    box.appendChild(h('div.lab-try', edHost, outHost));
    var outEd = new W.Editor(outHost, { language: 'js', readOnly: true });
    var ed = new W.Editor(edHost, {
      language: 'wz',
      vocab: function () { return L.getVocab(langs, tryPacks()); },
      highlightContext: function () { return { vocab: L.getVocab(langs, tryPacks()) }; },
      onChange: U.debounce(function (v) { self.trySample = v; run(); }, 250)
    });
    function tryPacks() {
      var ids = app.project ? P.packIds(app.project) : ['core'];
      if (ids.indexOf(pk.id) < 0) ids = ids.concat([pk.id]);
      return ids;
    }
    function run() {
      // names written with a capital letter are taken as controls of the test page
      var code = ed.getValue(), vocab = L.getVocab(langs, tryPacks()), seen = {};
      var controls = [{ name: 'Button1', type: 'Button' }, { name: 'Label1', type: 'Text' }, { name: 'TextBox1', type: 'TextBox' }];
      controls.forEach(function (c) { seen[L.norm(c.name)] = 1; });
      (code.match(/[\p{Lu}][\p{L}\p{N}_]*/gu) || []).forEach(function (n) {
        var k = L.norm(n);
        if (seen[k] || vocab.firstWords[k] || vocab.functions[k]) return;
        seen[k] = 1;
        controls.push({ name: n, type: /box/i.test(n) ? 'TextBox' : /button/i.test(n) ? 'Button' : /panel|section/i.test(n) ? 'Panel' : /image|logo|star|player|coin/i.test(n) ? 'Image' : 'Text' });
      });
      var proj = { pages: [{ name: 'Test', code: code, controls: controls }], siteCode: '', tables: [] };
      var r = L.compileProject(proj, { langs: langs, packs: tryPacks(), msgLang: W.i18n.lang, controlTypes: W.controls.codeTypes() });
      ed.setMarkers(r.errors.map(function (e) { return { line: e.line, col: e.col, len: e.len, msg: e.msg }; }));
      var js = r.pages.Test.js.split('\n').filter(function (l) { return !/^\/\//.test(l); }).join('\n');
      outEd.setValue(r.errors.length ? r.errors.map(function (e) { return '// ' + W.t('tr.line') + ' ' + e.line + ': ' + e.msg; }).join('\n') : js, true);
    }
    ed.setValue(sample);
    run();
  };

  B.renderRuntime = function (pk, box, mine) {
    var self = this;
    box.appendChild(h('p.dbd-help', W.t('lab.runtimeHelp')));
    var js = h('textarea.input.big.mono', { rows: 10, spellcheck: false, readOnly: !mine });
    js.value = (pk.runtime && pk.runtime.js) || '';
    var php = h('textarea.input.big.mono', { rows: 5, spellcheck: false, readOnly: !mine });
    php.value = (pk.runtime && pk.runtime.php) || '';
    box.appendChild(h('label.wd-label', W.t('lab.runtimeJs'), js));
    box.appendChild(h('label.wd-label', W.t('lab.runtimePhp'), php));
    if (mine) {
      box.appendChild(h('button.btn.small.primary', { type: 'button', onclick: function () {
        pk.runtime = { js: js.value, php: php.value };
        self.savePack(pk);
        U.toast(W.t('lab.saved'));
      } }, W.t('common.save')));
    }
  };

  /* ---------------- editing a pack ---------------- */

  B.savePack = function (pk) {
    pk.userMade = true;
    L.registerPack(pk);
    W.store.savePack(pk);
    if (this.app.project && (this.app.project.settings.packs || []).indexOf(pk.id) >= 0) P.embedPacks(this.app.project);
    W.build.clearCache();
    this.app.recompile();
    this.render();
  };

  B.newPack = function () {
    var self = this;
    U.prompt(W.t('lab.newPack'), W.t('lab.packName'), '', function (v) { return v ? null : W.t('lab.needName'); }).then(function (name) {
      if (!name) return;
      var id = 'my-' + U.slug(name) + '-' + Math.random().toString(36).slice(2, 6);
      var pk = { id: id, name: name, version: '1.0.0', author: '', userMade: true, description: { en: '', ro: '' }, vocab: {}, commands: [], functions: [], runtime: { js: '', php: '' } };
      self.packId = id;
      self.tab = 'commands';
      if (self.app.project) {
        self.app.project.settings.packs = (self.app.project.settings.packs || []).concat([id]);
      }
      self.savePack(pk);
    });
  };

  B.editInfo = function (pk) {
    var self = this, lang = W.i18n.lang;
    var name = h('input.input', { type: 'text', value: pk.name });
    var ver = h('input.input', { type: 'text', value: pk.version || '1.0.0' });
    var author = h('input.input', { type: 'text', value: pk.author || '' });
    var desc = h('textarea.input', { rows: 3 });
    desc.value = (pk.description && (pk.description[lang] || pk.description.en)) || '';
    U.dialog({
      title: W.t('lab.editInfo'), width: 460,
      body: h('div.form.no-enter', h('label.wd-label', W.t('lab.packName'), name), h('label.wd-label', W.t('lab.version'), ver),
        h('label.wd-label', W.t('lab.author'), author), h('label.wd-label', W.t('lab.description'), desc)),
      buttons: [{ label: W.t('common.cancel'), value: null }, { label: W.t('common.save'), primary: true, action: function () {
        pk.name = name.value.trim() || pk.name;
        pk.version = ver.value.trim();
        pk.author = author.value.trim();
        pk.description = pk.description || {};
        pk.description[lang] = desc.value.trim();
        self.savePack(pk);
      } }]
    });
  };

  B.removeItem = function (pk, kind, id) {
    var self = this;
    U.confirm(W.t('cmd.delete'), W.t('lab.confirmDelete', id), W.t('cmd.delete'), true).then(function (ok) {
      if (!ok) return;
      pk[kind] = (pk[kind] || []).filter(function (x) { return x.id !== id; });
      self.savePack(pk);
    });
  };

  function field(label, value, opts) {
    opts = opts || {};
    var inp = opts.area ? h('textarea.input' + (opts.mono ? '.mono' : ''), { rows: opts.rows || 2, spellcheck: false }) : h('input.input' + (opts.mono ? '.mono' : ''), { type: 'text', spellcheck: false });
    inp.value = value || '';
    if (opts.placeholder) inp.placeholder = opts.placeholder;
    return { el: h('label.wd-label', label, inp, opts.hint ? h('span.wd-hint', opts.hint) : null), input: inp };
  }

  B.editCommand = function (pk, d) {
    var self = this;
    var src = d ? (pk.commands || []).filter(function (c) { return c.id === d.id; })[0] : null;
    var cur = src || { id: '', patterns: { en: [] }, js: '', php: '', doc: {}, example: {} };
    var lang = W.i18n.lang;
    var pEn = field(W.t('lab.patterns'), (cur.patterns.en || []).join('\n'), { area: true, mono: true, placeholder: 'flip {control:control}', hint: W.t('lab.patternHint') });
    var js = field(W.t('lab.jsTemplate'), cur.js, { area: true, mono: true, rows: 3, placeholder: 'wz.set({control}, "visible", false)', hint: W.t('lab.jsHint') });
    var php = field(W.t('lab.phpTemplate'), cur.php || '', { area: true, mono: true, placeholder: W.t('lab.phpEmpty'), hint: W.t('lab.phpHint') });
    var asyncBox = h('input', { type: 'checkbox' });
    asyncBox.checked = !!cur.async;
    var callF = field(W.t('lab.callNames'), [].concat(cur.call || []).join(', '), { mono: true, placeholder: 'flip', hint: W.t('lab.callHint') });
    var methF = field(W.t('lab.methodNames'), [].concat(cur.method || []).join(', '), { mono: true, placeholder: 'flip', hint: W.t('lab.methodHint') });
    var doc = field(W.t('lab.description'), cur.doc[lang] || cur.doc.en || '', { area: true });
    var ex = field(W.t('lab.example'), cur.example.en || '', { mono: true });
    var err = h('div.wd-err');
    U.dialog({
      title: d ? W.t('lab.editCommand') : W.t('lab.addCommand'), width: 620,
      body: h('div.form.no-enter', pEn.el, callF.el, methF.el, js.el, php.el,
        h('label.wd-check', asyncBox, ' ' + W.t('lab.async')), doc.el, ex.el, err),
      buttons: [{ label: W.t('common.cancel'), value: null }, { label: W.t('common.save'), primary: true, action: function () {
        var c = {
          id: cur.id || (pk.id + '.' + U.slug((pEn.input.value.split('\n')[0] || 'cmd').split('{')[0]) + '-' + Math.random().toString(36).slice(2, 5)),
          patterns: { en: lines(pEn.input.value) },
          js: js.input.value.trim(), php: php.input.value.trim() || undefined,
          async: asyncBox.checked || undefined,
          doc: Object.assign({}, cur.doc), example: Object.assign({}, cur.example)
        };
        c.doc[lang] = doc.input.value.trim();
        c.example.en = ex.input.value.trim();
        var calls = csv(callF.input.value), meths = csv(methF.input.value);
        var badCall = calls.concat(meths).filter(function (n) { return !P.validName(n); })[0];
        if (badCall) { err.textContent = W.t('lab.badFnName', badCall); return false; }
        if (calls.length) c.call = calls;
        if (meths.length) {
          if (!c.patterns.en.some(function (pt) { return /\{\w+:control\}/.test(pt); })) { err.textContent = W.t('lab.methodNeedsControl'); return false; }
          c.method = meths;
        }
        if (cur.callArgs) c.callArgs = cur.callArgs;
        if (!c.patterns.en.length) { err.textContent = W.t('lab.needPattern'); return false; }
        if (!c.js && !c.php) { err.textContent = W.t('lab.needTemplate'); return false; }
        var bad = checkPatterns(c.patterns);
        if (bad) { err.textContent = bad; return false; }
        pk.commands = (pk.commands || []).filter(function (x) { return x.id !== c.id; }).concat([c]);
        self.savePack(pk);
      } }]
    });
  };
  function lines(s) { return String(s || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }
  function checkPatterns(pats) {
    var problem = null;
    Object.keys(pats).forEach(function (lg) {
      (pats[lg] || []).forEach(function (p) {
        if (/^\{/.test(p)) problem = W.t('lab.patternStartsWord', p);
        var m = p.match(/\{[^}]*\}/g) || [];
        m.forEach(function (s) { if (!/^\{\w+(:(target|control|page|word|expr))?\}$/.test(s)) problem = W.t('lab.badSlot', s); });
      });
    });
    return problem;
  }

  B.editFunction = function (pk, d) {
    var self = this;
    var src = d ? (pk.functions || []).filter(function (f) { return f.id === d.id; })[0] : null;
    var cur = src || { id: '', names: { en: [] }, params: [], js: '', php: '', doc: {}, example: {}, returns: 'any' };
    var lang = W.i18n.lang;
    var nEn = field(W.t('lab.names'), (cur.names.en || []).join(', '), { mono: true, placeholder: 'double' });
    var mEn = field(W.t('lab.fnMethods'), (cur.methods || []).join(', '), { mono: true, placeholder: 'twice', hint: W.t('lab.fnMethodsHint') });
    var params = field(W.t('lab.params'), (cur.params || []).join(', '), { mono: true, placeholder: 'number, times?', hint: W.t('lab.paramsHint') });
    var js = field(W.t('lab.jsTemplate'), cur.js || '', { area: true, mono: true, placeholder: 'wz.mul({0}, 2)', hint: W.t('lab.jsFnHint') });
    var php = field(W.t('lab.phpTemplate'), cur.php || '', { area: true, mono: true, placeholder: 'wz_mul({0}, 2)', hint: W.t('lab.phpFnHint') });
    var ret = h('select.input', { 'aria-label': W.t('lab.returns') });
    ['any', 'num', 'text', 'bool', 'list'].forEach(function (r) { ret.appendChild(h('option', { value: r }, W.t('lab.ret.' + r))); });
    ret.value = cur.returns || 'any';
    var asyncBox = h('input', { type: 'checkbox' });
    asyncBox.checked = !!cur.async;
    var doc = field(W.t('lab.description'), cur.doc[lang] || cur.doc.en || '', { area: true });
    var ex = field(W.t('lab.example'), cur.example.en || '', { mono: true });
    var err = h('div.wd-err');
    U.dialog({
      title: d ? W.t('lab.editFunction') : W.t('lab.addFunction'), width: 620,
      body: h('div.form.no-enter', nEn.el, params.el, mEn.el, js.el, php.el, h('label.wd-label', W.t('lab.returns'), ret),
        h('label.wd-check', asyncBox, ' ' + W.t('lab.asyncFn')), doc.el, ex.el, err),
      buttons: [{ label: W.t('common.cancel'), value: null }, { label: W.t('common.save'), primary: true, action: function () {
        var names = { en: csv(nEn.input.value) };
        if (!names.en.length) { err.textContent = W.t('lab.needName'); return false; }
        var badName = names.en.filter(function (n) { return !P.validName(n); })[0];
        if (badName) { err.textContent = W.t('lab.badFnName', badName); return false; }
        if (!js.input.value.trim() && !php.input.value.trim()) { err.textContent = W.t('lab.needTemplate'); return false; }
        var f = {
          id: cur.id || (pk.id + '.' + U.slug(names.en[0]) + '-' + Math.random().toString(36).slice(2, 5)),
          names: names, params: csv(params.input.value),
          js: js.input.value.trim() || undefined, php: php.input.value.trim() || undefined,
          returns: ret.value, async: asyncBox.checked || undefined,
          doc: Object.assign({}, cur.doc), example: Object.assign({}, cur.example)
        };
        f.doc[lang] = doc.input.value.trim();
        f.example.en = ex.input.value.trim();
        var ms = csv(mEn.input.value);
        var badM = ms.filter(function (n) { return !P.validName(n); })[0];
        if (badM) { err.textContent = W.t('lab.badFnName', badM); return false; }
        if (ms.length) f.methods = ms;
        if (cur.changes) f.changes = true;
        pk.functions = (pk.functions || []).filter(function (x) { return x.id !== f.id; }).concat([f]);
        self.savePack(pk);
      } }]
    });
  };
  function csv(s) { return String(s || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); }

  B.deletePack = function (pk) {
    var self = this;
    U.confirm(W.t('lab.deletePack'), W.t('lab.confirmDeletePack', pk.name), W.t('cmd.delete'), true).then(function (ok) {
      if (!ok) return;
      L.unregisterPack(pk.id);
      W.store.deletePack(pk.id);
      if (self.app.project) {
        self.app.project.settings.packs = (self.app.project.settings.packs || []).filter(function (x) { return x !== pk.id; });
        P.embedPacks(self.app.project);
        self.app.changed(W.t('undo.packs'));
      }
      self.packId = 'core';
      self.render();
    });
  };

  /* ---------------- sharing packs ---------------- */

  var MARK_A = '/*WEMAZY-PACK-JSON*/', MARK_B = '/*END-WEMAZY-PACK*/';
  /** A pack file: valid JavaScript (drop it into language/packs/) that also holds plain JSON (safe to import). */
  B.packFile = function (pk) {
    var clean = JSON.parse(JSON.stringify(pk));
    delete clean.userMade;
    delete clean.builtin;
    return '/*!\n * Wemazy Script language pack: ' + clean.name.replace(/\*\//g, '') + '\n' +
      ' * To install: Tools > Language Lab > Import pack, or put this file in language/packs/ and add its name to language/packs/list.js\n */\n' +
      '(function (root) {\n  var W = root.Wemazy = root.Wemazy || {};\n  var pack = ' + MARK_A + JSON.stringify(clean, null, 2) + MARK_B + ';\n' +
      '  if (W.lang && W.lang.registerPack) W.lang.registerPack(pack);\n  else (W.pendingPacks = W.pendingPacks || []).push(pack);\n' +
      '})(typeof window !== "undefined" ? window : globalThis);\n';
  };
  B.exportPack = function (pk) {
    U.download('wemazy-pack-' + U.slug(pk.name) + '.js', this.packFile(pk), 'text/javascript');
  };
  B.importPack = function () {
    var self = this;
    U.pickFiles({ accept: '.js,.json,.wemazypack' }).then(function (files) {
      if (!files.length) return;
      var text = files[0].data, json = text;
      var a = text.indexOf(MARK_A), b = text.indexOf(MARK_B);
      if (a >= 0 && b > a) json = text.slice(a + MARK_A.length, b);
      var pk;
      try { pk = JSON.parse(json); } catch (e) { U.alert(W.t('lab.import'), W.t('lab.importBad')); return; }
      if (!pk || !pk.id || !pk.name) { U.alert(W.t('lab.import'), W.t('lab.importBad')); return; }
      if (L.packs[pk.id] && L.packs[pk.id].builtin) { U.alert(W.t('lab.import'), W.t('lab.importBuiltin')); return; }
      U.confirm(W.t('lab.import'), W.t('lab.importTrust', pk.name), W.t('lab.importOk')).then(function (ok) {
        if (!ok) return;
        delete pk.builtin;
        self.packId = pk.id;
        self.savePack(pk);
        U.toast(W.t('lab.imported', pk.name));
      });
    });
  };

  function uniq(a) { var s = {}; return a.filter(function (x) { if (s[x]) return false; s[x] = 1; return true; }); }

  W.Lab = Lab;
})(typeof window !== 'undefined' ? window : globalThis);
