/*!
 * Wemazy IDE - the project: pages, controls, code, tables, pictures, settings.
 * A project is plain JSON, so it can be saved to a file and opened anywhere.
 */
(function (root) {
  'use strict';
  var W = root.Wemazy = root.Wemazy || {};
  var U = W.util;

  var THEMES = {
    clean: { primary: '#4338ca', onPrimary: '#ffffff', background: '#ffffff', text: '#1d2130', muted: '#5b6172', surface: '#f4f5f9', border: '#dadde6', font: 'sans', headingFont: 'sans', radius: 10 },
    ocean: { primary: '#0369a1', onPrimary: '#ffffff', background: '#f7fbfe', text: '#0f2433', muted: '#4b6577', surface: '#e8f3fa', border: '#cfe2ee', font: 'sans', headingFont: 'sans', radius: 12 },
    forest: { primary: '#2f6b3a', onPrimary: '#ffffff', background: '#fbfcf8', text: '#1f2a1c', muted: '#5a6656', surface: '#eef2e6', border: '#d6dccb', font: 'serif', headingFont: 'serif', radius: 6 },
    sunset: { primary: '#c2410c', onPrimary: '#ffffff', background: '#fffaf5', text: '#2b1d14', muted: '#76604f', surface: '#fdeedf', border: '#f0d8c2', font: 'sans', headingFont: 'display', radius: 14 },
    candy: { primary: '#be185d', onPrimary: '#ffffff', background: '#fff7fb', text: '#2d1424', muted: '#7a5a6c', surface: '#fde7f2', border: '#f3cde0', font: 'rounded', headingFont: 'rounded', radius: 18 },
    school: { primary: '#1e3a8a', onPrimary: '#ffffff', background: '#fffdf2', text: '#1b1f2e', muted: '#5c6175', surface: '#fff3c4', border: '#ecdf9f', font: 'rounded', headingFont: 'display', radius: 8 },
    paper: { primary: '#7c2d12', onPrimary: '#ffffff', background: '#f8f4ea', text: '#2a2520', muted: '#6e665b', surface: '#efe8d8', border: '#ddd3be', font: 'serif', headingFont: 'serif', radius: 4 },
    night: { primary: '#f2a93b', onPrimary: '#1b1c1f', background: '#14161b', text: '#e8eaf0', muted: '#a3a9b6', surface: '#1f232b', border: '#323844', font: 'sans', headingFont: 'sans', radius: 10 }
  };

  var P = W.Project = {
    THEMES: THEMES,

    /** opts.lang: the language of the texts of the site ('en' or 'ro'). The code is always Wemazy Script (English). */
    create: function (name, opts) {
      opts = opts || {};
      var lang = opts.lang === 'ro' ? 'ro' : 'en';
      var p = {
        format: 'wemazy', version: 1,
        id: U.uid('p'), name: name || 'My website',
        created: new Date().toISOString(), modified: new Date().toISOString(),
        template: opts.template || 'blank',
        settings: {
          packs: [],
          theme: Object.assign({ preset: 'clean', width: 1100 }, THEMES.clean),
          siteTitle: name || 'My website',
          htmlLang: lang
        },
        pages: [],
        siteCode: '',
        tables: [],
        assets: [],
        packs: {}
      };
      return p;
    },

    /** Fill in anything missing (projects from older versions, hand-made files). */
    normalize: function (p) {
      p.format = 'wemazy';
      p.version = p.version || 1;
      p.id = p.id || U.uid('p');
      p.name = p.name || 'Website';
      p.settings = p.settings || {};
      var s = p.settings;
      delete s.codeLangs;
      s.packs = s.packs || [];
      s.theme = Object.assign({ preset: 'clean', width: 1100 }, THEMES.clean, s.theme || {});
      s.siteTitle = s.siteTitle === undefined ? p.name : s.siteTitle;
      s.htmlLang = s.htmlLang || 'en';
      p.pages = (p.pages || []).map(function (pg) {
        pg.id = pg.id || U.uid('pg');
        pg.name = pg.name || 'Page';
        pg.title = pg.title === undefined ? pg.name : pg.title;
        pg.code = pg.code || '';
        pg.inMenu = pg.inMenu !== false;
        pg.root = pg.root || P.newRoot();
        pg.root.id = 'root';
        pg.root.type = 'Page';
        pg.root.props = pg.root.props || {};
        pg.root.children = pg.root.children || [];
        P.walk(pg.root, function (el) {
          el.id = el.id || U.uid('e');
          el.props = el.props || {};
          if (W.controls.isContainer(el) || el.type === 'Page') el.children = el.children || [];
        });
        return pg;
      });
      if (!p.pages.length) P.addPage(p, 'Home');
      p.siteCode = p.siteCode || '';
      p.tables = (p.tables || []).map(function (t) {
        t.id = t.id || U.uid('t');
        t.columns = (t.columns || []).filter(function (c) { return c && c.name; });
        t.rows = t.rows || [];
        return t;
      });
      p.assets = p.assets || [];
      p.packs = p.packs || {};
      return p;
    },

    newRoot: function () {
      return { id: 'root', type: 'Page', name: 'page', props: {}, children: [] };
    },

    /* ---------------- walking the tree ---------------- */

    walk: function (el, fn, parent, index) {
      if (fn(el, parent || null, index || 0) === false) return false;
      var kids = el.children || [];
      for (var i = 0; i < kids.length; i++) {
        if (P.walk(kids[i], fn, el, i) === false) return false;
      }
    },
    find: function (page, id) {
      var out = null;
      if (!page) return null;
      if (id === 'root') return { el: page.root, parent: null, index: 0 };
      P.walk(page.root, function (el, parent, index) {
        if (el.id === id) { out = { el: el, parent: parent, index: index }; return false; }
      });
      return out;
    },
    findByName: function (page, name) {
      var out = null, n = W.lang.norm(name);
      P.walk(page.root, function (el) {
        if (el !== page.root && W.lang.norm(el.name) === n) { out = el; return false; }
      });
      return out;
    },
    /** All controls of a page, for the compiler and autocomplete. */
    controlsOf: function (page) {
      var out = [];
      P.walk(page.root, function (el) {
        if (el === page.root) return;
        out.push({ name: el.name, type: el.type, id: el.id });
      });
      return out;
    },
    isInside: function (el, maybeChild) {
      var found = false;
      P.walk(el, function (x) { if (x === maybeChild) { found = true; return false; } });
      return found;
    },

    /* ---------------- names ---------------- */

    reserved: ['page', 'pagina', 'session', 'sesiune', 'wz', 'window', 'document', 'site', 'and', 'or', 'not', 'if', 'then', 'else', 'end', 'true', 'false', 'nothing', 'is', 'mod'],
    validName: function (name) {
      return /^[\p{L}_][\p{L}\p{N}_]*$/u.test(name || '');
    },
    /** Error message for a control name, or null when it is fine. */
    checkName: function (project, page, name, self) {
      if (!P.validName(name)) return W.t('err.nameChars');
      var n = W.lang.norm(name);
      if (P.reserved.indexOf(n) >= 0) return W.t('err.nameReserved', name);
      var vocab = P.vocab(project);
      var firsts = ['set', 'if', 'repeat', 'for', 'when', 'function', 'return', 'print', 'add', 'remove', 'wait', 'show', 'hide', 'find', 'count', 'delete', 'update', 'clear', 'increase', 'decrease', 'every', 'try', 'stop', 'skip'];
      for (var i = 0; i < firsts.length; i++) {
        var ph = vocab.phrases[firsts[i]] || [];
        if (ph.some(function (w) { return w.length === 1 && w[0] === n; })) return W.t('err.nameReserved', name);
      }
      if (vocab.functions[n]) return W.t('err.nameFunction', name);
      var other = P.findByName(page, name);
      if (other && other !== self) return W.t('err.nameTaken', name);
      if ((project.tables || []).some(function (t) { return W.lang.norm(t.name) === n; })) return W.t('err.nameTable', name);
      return null;
    },
    uniqueName: function (project, page, prefix) {
      var i = 1;
      var clash = function (nm) {
        var n = W.lang.norm(nm);
        return !!P.findByName(page, nm) || (project.tables || []).some(function (t) { return W.lang.norm(t.name) === n; });
      };
      while (clash(prefix + i)) i++;
      return prefix + i;
    },
    /** The start of the names of new controls: Button1, TextBox1... (English, like the language). */
    prefixFor: function (project, type) {
      var def = W.controls.get(type);
      return def && def.prefix ? (def.prefix.en || type) : type;
    },

    /** A new control (not yet placed). toolboxType may be FreePanel etc. */
    newElement: function (project, page, toolboxType) {
      var def = W.controls.get(toolboxType);
      var type = def.asType || toolboxType;
      var el = { id: U.uid('e'), type: type, name: P.uniqueName(project, page, P.prefixFor(project, toolboxType)), props: U.clone(def.defaults || {}) };
      var lang = project.settings.htmlLang === 'ro' ? 'ro' : 'en';
      var t = W.t;
      // friendlier starting texts in the language of the site
      if (lang === 'ro') {
        var ro = { Heading: { text: 'Un titlu' }, Text: { text: 'Scrie textul aici. Dă dublu clic ca să-l schimbi.' }, Button: { text: 'Buton' },
          Link: { text: 'Un link' }, TextBox: { placeholder: 'Scrie aici' }, TextArea: { placeholder: 'Scrie aici' }, CheckBox: { text: 'Da, sunt de acord' },
          RadioGroup: { label: 'Alege una', options: 'Varianta 1\nVarianta 2\nVarianta 3' }, DropDown: { options: 'Varianta 1\nVarianta 2\nVarianta 3' },
          List: { items: 'Primul\nAl doilea\nAl treilea' }, Table: { headers: 'Nume, Punctaj' }, NavBar: { brand: 'Site-ul meu' } };
        if (ro[toolboxType]) Object.assign(el.props, ro[toolboxType]);
      }
      void t;
      if (def.container) el.children = [];
      if (type === 'Columns') {
        var n = +el.props.count || 2;
        for (var i = 0; i < n; i++) el.children.push(P.newColumn(project, page, el));
      }
      return el;
    },
    newColumn: function (project, page, columns) {
      var c = { id: U.uid('e'), type: 'Column', name: '', props: { layout: 'stack', gap: 12 }, children: [] };
      // unique among the page and the columns being built
      var prefix = P.prefixFor(project, 'Column'), i = 1;
      var taken = function (nm) { return P.findByName(page, nm) || (columns.children || []).some(function (x) { return x.name === nm; }); };
      while (taken(prefix + i)) i++;
      c.name = prefix + i;
      return c;
    },
    /** Columns: make the number of Column children match the count. */
    syncColumns: function (project, page, el) {
      var n = +el.props.count || 2;
      while (el.children.length < n) el.children.push(P.newColumn(project, page, el));
      if (el.children.length > n) {
        var extra = el.children.splice(n);
        var last = el.children[el.children.length - 1];
        extra.forEach(function (c) { last.children = last.children.concat(c.children || []); });
      }
    },
    /** Copy of an element with new ids and names (paste, duplicate). */
    cloneElement: function (project, page, el) {
      var copy = U.clone(el);
      var used = {};
      P.walk(copy, function (x) {
        x.id = U.uid('e');
        var base = (x.name || 'Control').replace(/\d+$/, '');
        var i = 1;
        while (P.findByName(page, base + i) || used[W.lang.norm(base + i)]) i++;
        x.name = base + i;
        used[W.lang.norm(x.name)] = true;
      });
      return copy;
    },

    /* ---------------- pages ---------------- */

    addPage: function (project, name, opts) {
      opts = opts || {};
      var pg = { id: U.uid('pg'), name: name, title: opts.title || name, description: '', inMenu: true, root: P.newRoot(), code: '' };
      project.pages.push(pg);
      if (opts.withSection !== false) {
        var sec = P.newElement(project, pg, 'Section');
        pg.root.children.push(sec);
        if (opts.free) {
          var form = P.newElement(project, pg, 'FreePanel');
          sec.children.push(form);
        } else if (opts.heading !== false) {
          var hd = P.newElement(project, pg, 'Heading');
          hd.props.text = opts.headingText || name;
          hd.props.level = '1';
          sec.children.push(hd);
        }
      }
      return pg;
    },
    pageFile: function (project, page) {
      if (project.pages[0] === page) return 'index.html';
      var base = U.slug(page.name);
      if (base === 'index') base = 'index-2';
      // two pages with the same slug
      var same = project.pages.filter(function (p) { return p !== project.pages[0] && U.slug(p.name) === U.slug(page.name); });
      if (same.length > 1) base += '-' + (same.indexOf(page) + 1);
      return base + '.html';
    },
    pageByName: function (project, name) {
      var n = W.lang.norm(name);
      return project.pages.filter(function (p) { return W.lang.norm(p.name) === n; })[0] || null;
    },
    checkPageName: function (project, name, self) {
      if (!P.validName(name)) return W.t('err.nameChars');
      var other = P.pageByName(project, name);
      if (other && other !== self) return W.t('err.pageTaken', name);
      return null;
    },

    /* ---------------- tables ---------------- */

    checkTableName: function (project, name, self) {
      var bad = W.lang.checkSqlName(name);
      if (bad === 'letters') return W.t('err.sqlLetters');
      if (bad === 'reserved') return W.t('err.sqlReserved', name);
      var n = name.toLowerCase();
      if (project.tables.some(function (t) { return t !== self && t.name.toLowerCase() === n; })) return W.t('err.tableTaken', name);
      if (n === 'wemazy_meta') return W.t('err.sqlReserved', name);
      return null;
    },
    checkColumnName: function (table, name, self) {
      var bad = W.lang.checkSqlName(name);
      if (bad === 'letters') return W.t('err.sqlLetters');
      if (bad === 'reserved') return W.t('err.sqlReserved', name);
      if (table.columns.some(function (c) { return c !== self && c.name.toLowerCase() === name.toLowerCase(); })) return W.t('err.columnTaken', name);
      return null;
    },

    /* ---------------- assets (pictures, sounds) ---------------- */

    asset: function (project, name) {
      if (!name) return null;
      var n = String(name).toLowerCase();
      return project.assets.filter(function (a) { return a.name.toLowerCase() === n; })[0] || null;
    },
    assetName: function (project, wanted) {
      var base = String(wanted || 'file').replace(/[^\w.\-]+/g, '-').replace(/^-+/, '') || 'file';
      var dot = base.lastIndexOf('.');
      var stem = dot > 0 ? base.slice(0, dot) : base, ext = dot > 0 ? base.slice(dot) : '';
      var name = stem + ext, i = 2;
      while (P.asset(project, name)) { name = stem + '-' + i + ext; i++; }
      return name;
    },

    /* ---------------- language ---------------- */

    packIds: function (project) {
      var ids = W.lang.packOrder.filter(function (id) {
        var pk = W.lang.packs[id];
        return pk && pk.builtin;
      });
      (project.settings.packs || []).forEach(function (id) { if (W.lang.packs[id] && ids.indexOf(id) < 0) ids.push(id); });
      return ids;
    },
    vocab: function (project) {
      return W.lang.getVocab(['en'], P.packIds(project));
    },
    /** Make sure community packs used by the project are loaded (from the copy kept inside the project). */
    loadEmbeddedPacks: function (project) {
      var added = [];
      Object.keys(project.packs || {}).forEach(function (id) {
        if (!W.lang.packs[id]) { W.lang.registerPack(project.packs[id]); added.push(id); }
      });
      return added;
    },
    embedPacks: function (project) {
      var out = {};
      (project.settings.packs || []).forEach(function (id) {
        var pk = W.lang.packs[id];
        if (pk && !pk.builtin) out[id] = U.clone(pk);
      });
      project.packs = out;
    },

    /** The input of the compiler. */
    compileInput: function (project) {
      return {
        pages: project.pages.map(function (pg) { return { name: pg.name, code: pg.code || '', controls: P.controlsOf(pg) }; }),
        siteCode: project.siteCode || '',
        tables: project.tables
      };
    },
    compileOptions: function (project, debug) {
      return {
        langs: ['en'],
        packs: P.packIds(project),
        debug: !!debug,
        msgLang: W.i18n.lang,
        controlTypes: W.controls.codeTypes()
      };
    },

    /** Rename a control and the places that use it in code. */
    renameInCode: function (code, oldName, newName) {
      if (!code) return code;
      var lx = W.lang.lex(code);
      var o = W.lang.norm(oldName);
      var edits = [];
      function scan(toks) {
        toks.forEach(function (t) {
          if (t.t === 'word' && t.n === o) edits.push(t);
          if (t.t === 'str' && t.interp) t.interp.forEach(function (ip) { scan(ip.toks); });
        });
      }
      scan(lx.tokens);
      edits.sort(function (a, b) { return b.pos - a.pos; });
      edits.forEach(function (t) { code = code.slice(0, t.pos) + newName + code.slice(t.end); });
      return code;
    },

    /* ---------------- saving to a file ---------------- */

    toFile: function (project) {
      P.embedPacks(project);
      return JSON.stringify(project, null, 1);
    },
    fromFile: function (text) {
      var p = JSON.parse(text);
      if (!p || p.format !== 'wemazy') throw new Error(W.t('err.notProject'));
      return P.normalize(p);
    }
  };

  /* ---------------- undo / redo of the design (not of code) ---------------- */

  var H = W.history = {
    undoStack: [], redoStack: [], max: 120, project: null, last: null,
    reset: function (project) {
      H.project = project;
      H.undoStack = [];
      H.redoStack = [];
      H.last = H.snap();
    },
    snap: function () {
      var p = H.project;
      if (!p) return null;
      return JSON.stringify({
        pages: p.pages.map(function (pg) { return { id: pg.id, name: pg.name, title: pg.title, description: pg.description, inMenu: pg.inMenu, root: pg.root, code: pg.code }; }),
        tables: p.tables, settings: p.settings, assetNames: p.assets.map(function (a) { return a.id; })
      });
    },
    /** Call after a change of the design; label is shown in Edit > Undo. */
    commit: function (label) {
      var now = H.snap();
      if (now === H.last) return;
      H.undoStack.push({ label: label || '', state: H.last });
      if (H.undoStack.length > H.max) H.undoStack.shift();
      H.redoStack = [];
      H.last = now;
      W.bus.emit('history');
    },
    canUndo: function () { return H.undoStack.length > 0; },
    canRedo: function () { return H.redoStack.length > 0; },
    undo: function () {
      var it = H.undoStack.pop();
      if (!it) return false;
      H.redoStack.push({ label: it.label, state: H.snap() });
      H.restore(it.state);
      return it.label || true;
    },
    redo: function () {
      var it = H.redoStack.pop();
      if (!it) return false;
      H.undoStack.push({ label: it.label, state: H.snap() });
      H.restore(it.state);
      return it.label || true;
    },
    restore: function (state) {
      var p = H.project, s = JSON.parse(state);
      var byId = {};
      p.pages.forEach(function (pg) { byId[pg.id] = pg; });
      // the page objects stay the same (open documents keep them); the code is not undone here
      p.pages = s.pages.map(function (spg) {
        var cur = byId[spg.id];
        if (!cur) return spg;
        ['name', 'title', 'description', 'inMenu', 'root'].forEach(function (k) {
          if (k in spg) cur[k] = spg[k]; else delete cur[k];
        });
        return cur;
      });
      p.tables = s.tables;
      p.settings = s.settings;
      H.last = H.snap();
      W.bus.emit('history');
      W.bus.emit('project-changed', { undo: true });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
