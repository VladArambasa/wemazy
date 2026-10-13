/*!
 * Wemazy IDE - the Database window: tables, columns, starting rows, live data.
 */
(function (root) {
  'use strict';
  var W = root.Wemazy = root.Wemazy || {};
  var U = W.util, h = U.h, P = W.Project, L = W.lang;

  function DbDesigner(app, host) {
    this.app = app;
    this.host = host;
    this.tab = 'columns';
    this.build();
    var self = this;
    W.bus.on('sim-data', U.debounce(function () { if (self.tab === 'live' && self.el.isConnected) self.render(); }, 300));
  }
  var D = DbDesigner.prototype;

  D.build = function () {
    this.el = h('div.dbd');
    this.side = h('div.dbd-side');
    this.body = h('div.dbd-body');
    this.el.appendChild(this.side);
    this.el.appendChild(this.body);
    this.host.appendChild(this.el);
  };

  D.show = function (table) {
    this.tableId = table ? table.id : (this.tableId || null);
    this.render();
  };

  D.table = function () {
    var p = this.app.project;
    var t = p.tables.filter(function (x) { return x.id === this.tableId; }, this)[0];
    if (!t && p.tables.length) { t = p.tables[0]; this.tableId = t.id; }
    return t || null;
  };

  D.render = function () {
    var self = this, app = this.app, p = app.project;
    U.clear(this.side);
    U.clear(this.body);
    if (!p) return;
    var t = this.table();
    this.side.appendChild(h('div.dbd-side-title', W.t('db.tables')));
    p.tables.forEach(function (x) {
      self.side.appendChild(h('button.dbd-tbl', { type: 'button', class: t === x ? 'on' : '', onclick: function () { self.tableId = x.id; self.render(); } },
        h('span.ic-wrap', { html: W.icons.svg('table') }), h('span', x.name), h('span.tree-badge', String((x.rows || []).length))));
    });
    this.side.appendChild(h('button.btn.small.dbd-add', { type: 'button', onclick: function () { app.cmd('addTable'); } }, '+ ' + W.t('cmd.addTable')));
    this.side.appendChild(h('p.dbd-note', W.t('db.note')));
    if (!t) {
      this.body.appendChild(h('div.dbd-empty',
        h('div.big-icon', { html: W.icons.svg('database') }),
        h('h3', W.t('db.emptyTitle')),
        h('p', W.t('db.emptyText')),
        h('button.btn.primary', { type: 'button', onclick: function () { app.cmd('addTable'); } }, W.t('cmd.addTable'))));
      return;
    }
    var head = h('div.dbd-head',
      h('h2.dbd-name', { html: W.icons.svg('table') + ' ' + U.esc(t.name) }),
      h('button.btn.small', { type: 'button', onclick: function () { app.cmd('renameTable', t); } }, W.t('cmd.rename')),
      h('button.btn.small.danger', { type: 'button', onclick: function () { app.cmd('deleteTable', t); } }, W.t('db.deleteTable')),
      h('span.grow'));
    this.body.appendChild(head);
    var tabs = h('div.seg-group', { role: 'tablist' });
    ['columns', 'rows', 'live'].forEach(function (k) {
      tabs.appendChild(h('button.seg', { type: 'button', role: 'tab', class: self.tab === k ? 'on' : '', 'aria-selected': self.tab === k ? 'true' : 'false',
        onclick: function () { self.tab = k; self.render(); } }, W.t('db.tab.' + k)));
    });
    this.body.appendChild(tabs);
    var box = h('div.dbd-content');
    this.body.appendChild(box);
    if (this.tab === 'columns') this.renderColumns(t, box);
    else if (this.tab === 'rows') this.renderRows(t, box);
    else this.renderLive(t, box);
  };

  D.renderColumns = function (t, box) {
    var self = this, app = this.app;
    box.appendChild(h('p.dbd-help', W.t('db.columnsHelp', t.name)));
    var grid = h('table.grid');
    grid.appendChild(h('thead', h('tr', h('th', W.t('db.col.name')), h('th', W.t('db.col.type')), h('th', ''))));
    var tb = h('tbody');
    tb.appendChild(h('tr.fixed', h('td', h('code', 'id')), h('td', W.t('db.idType')), h('td', '')));
    t.columns.forEach(function (c, i) {
      var name = h('input.input.small', { type: 'text', value: c.name, spellcheck: false, 'aria-label': W.t('db.col.name') });
      name.addEventListener('change', function () {
        var v = name.value.trim();
        if (v === c.name) return;
        var err = P.checkColumnName(t, v, c);
        if (err) { U.toast(err, 'bad'); name.value = c.name; return; }
        (t.rows || []).forEach(function (r) { if (r[c.name] !== undefined) { r[v] = r[c.name]; delete r[c.name]; } });
        c.name = v;
        app.changed(W.t('undo.db'));
      });
      var type = h('select.input.small', { 'aria-label': W.t('db.col.type') });
      W.lang.columnTypes.forEach(function (ty) { type.appendChild(h('option', { value: ty }, W.t('db.type.' + ty))); });
      type.value = c.type || 'text';
      type.addEventListener('change', function () { c.type = type.value; app.changed(W.t('undo.db')); });
      var del = h('button.tb-btn', { type: 'button', title: W.t('db.deleteColumn'), 'aria-label': W.t('db.deleteColumn'), html: W.icons.svg('trash'),
        onclick: function () {
          t.columns.splice(i, 1);
          (t.rows || []).forEach(function (r) { delete r[c.name]; });
          app.changed(W.t('undo.db'));
        } });
      var up = h('button.tb-btn', { type: 'button', title: W.t('ex.moveUp'), 'aria-label': W.t('ex.moveUp'), html: W.icons.svg('up'), disabled: i === 0,
        onclick: function () { t.columns.splice(i, 1); t.columns.splice(i - 1, 0, c); app.changed(W.t('undo.db')); } });
      tb.appendChild(h('tr', h('td', name), h('td', type), h('td.actions', up, del)));
    });
    grid.appendChild(tb);
    box.appendChild(grid);
    box.appendChild(h('button.btn.small', { type: 'button', onclick: function () {
      var n = 1, base = 'column';
      while (t.columns.some(function (c) { return c.name.toLowerCase() === base + n; })) n++;
      t.columns.push({ name: base + n, type: 'text' });
      app.changed(W.t('undo.db'));
      setTimeout(function () { var ins = U.$$('.dbd-content tbody input', self.el); if (ins.length) { ins[ins.length - 1].focus(); ins[ins.length - 1].select(); } }, 30);
    } }, '+ ' + W.t('db.addColumn')));
    // how to use it in code
    var vocab = P.vocab(app.project);
    var ex = 'var rows = ' + vocab.say('find') + ' ' + vocab.say('all') + ' ' + t.name;
    var cols = t.columns.slice(0, 2);
    var rec = '{' + cols.map(function (c) { return c.name + ': ' + (c.type === 'number' || c.type === 'integer' ? '1' : '"..."'); }).join(', ') + '}';
    var ex2 = t.name + '.add(' + rec + ')\nvar n = ' + t.name + '.count()';
    var pre = h('pre');
    var tbls = {};
    app.project.tables.forEach(function (x) { tbls[L.norm(x.name)] = 1; });
    pre.innerHTML = W.Editor.colorize(ex + '\n' + (cols.length ? ex2 : ''), 'wz', { vocab: vocab, tables: tbls, controls: {}, functions: {} });
    box.appendChild(h('div.dbd-code', h('div.muted', W.t('db.inCode')), pre));
  };

  function cellInput(c, value, onChange) {
    var inp;
    if (c.type === 'yesno') {
      inp = h('input', { type: 'checkbox', 'aria-label': c.name });
      inp.checked = value === true || value === 1 || value === '1' || value === 'true';
      inp.addEventListener('change', function () { onChange(inp.checked); });
      return inp;
    }
    var type = c.type === 'number' || c.type === 'integer' ? 'text' : (c.type === 'date' ? 'date' : 'text');
    inp = h('input.input.small.cell', { type: type, value: value === null || value === undefined ? '' : String(value), spellcheck: false, 'aria-label': c.name });
    if (c.type === 'number' || c.type === 'integer') inp.inputMode = 'decimal';
    inp.addEventListener('change', function () {
      var v = inp.value;
      if ((c.type === 'number' || c.type === 'integer') && v.trim() !== '' && W.runtime.core().is_number(v)) v = W.runtime.core().num(v);
      onChange(v === '' ? null : v);
    });
    return inp;
  }

  D.renderRows = function (t, box) {
    var self = this, app = this.app;
    box.appendChild(h('p.dbd-help', W.t('db.rowsHelp')));
    if (!t.columns.length) { box.appendChild(h('p.muted', W.t('db.noColumns'))); return; }
    var wrap = h('div.grid-wrap');
    var grid = h('table.grid.rows');
    grid.appendChild(h('thead', h('tr', [h('th', 'id')].concat(t.columns.map(function (c) { return h('th', c.name); }), [h('th', '')]))));
    var tb = h('tbody');
    t.rows = t.rows || [];
    t.rows.forEach(function (r, i) {
      var tr = h('tr', h('td.id', String(i + 1)));
      t.columns.forEach(function (c) {
        tr.appendChild(h('td', cellInput(c, r[c.name], function (v) {
          if (v === null) delete r[c.name]; else r[c.name] = v;
          app.changed(W.t('undo.db'));
        })));
      });
      tr.appendChild(h('td.actions', h('button.tb-btn', { type: 'button', title: W.t('db.deleteRow'), 'aria-label': W.t('db.deleteRow'), html: W.icons.svg('trash'),
        onclick: function () { t.rows.splice(i, 1); app.changed(W.t('undo.db')); } })));
      tb.appendChild(tr);
    });
    grid.appendChild(tb);
    wrap.appendChild(grid);
    box.appendChild(wrap);
    box.appendChild(h('div.row-gap',
      h('button.btn.small', { type: 'button', onclick: function () {
        t.rows.push({});
        app.changed(W.t('undo.db'));
        setTimeout(function () { var ins = U.$$('.grid.rows tbody tr:last-child input', self.el); if (ins[0]) ins[0].focus(); }, 30);
      } }, '+ ' + W.t('db.addRow')),
      h('button.btn.small', { type: 'button', onclick: function () { self.pasteRows(t); } }, W.t('db.paste'))));
  };

  /** Rows pasted from a spreadsheet (tabs) or CSV (commas or semicolons). */
  D.pasteRows = function (t) {
    var app = this.app;
    var ta = h('textarea.input.big.mono', { rows: 10, spellcheck: false, placeholder: t.columns.map(function (c) { return c.name; }).join('\t') });
    U.dialog({
      title: W.t('db.paste'), width: 560, body: h('div.no-enter', h('p.wd-hint', W.t('db.pasteHint', t.columns.map(function (c) { return c.name; }).join(', '))), ta),
      buttons: [{ label: W.t('common.cancel'), value: null }, { label: W.t('db.addRows'), primary: true, action: function () {
        var lines = ta.value.split(/\r?\n/).filter(function (l) { return l.trim(); });
        if (!lines.length) return;
        var sep = lines[0].indexOf('\t') >= 0 ? '\t' : (lines[0].indexOf(';') >= 0 ? ';' : ',');
        var first = splitLine(lines[0], sep);
        var header = first.every(function (x) { return t.columns.some(function (c) { return c.name.toLowerCase() === x.trim().toLowerCase(); }); });
        var cols = header ? first.map(function (x) { return t.columns.filter(function (c) { return c.name.toLowerCase() === x.trim().toLowerCase(); })[0]; }) : t.columns;
        var core = W.runtime.core();
        (header ? lines.slice(1) : lines).forEach(function (l) {
          var cells = splitLine(l, sep), r = {};
          cols.forEach(function (c, i) {
            if (!c || cells[i] === undefined || cells[i] === '') return;
            var v = cells[i].trim();
            if ((c.type === 'number' || c.type === 'integer') && core.is_number(v)) v = core.num(v);
            if (c.type === 'yesno') v = /^(1|true|yes|da|x|✓)$/i.test(v);
            r[c.name] = v;
          });
          t.rows.push(r);
        });
        app.changed(W.t('undo.db'));
      } }]
    });
  };
  function splitLine(l, sep) {
    var out = [], cur = '', q = false;
    for (var i = 0; i < l.length; i++) {
      var ch = l[i];
      if (q) {
        if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }

  D.renderLive = function (t, box) {
    var self = this, app = this.app;
    var server = W.store.mode === 'server';
    box.appendChild(h('p.dbd-help', W.t('db.liveHelp')));
    var bar = h('div.row-gap',
      h('button.btn.small', { type: 'button', onclick: function () { self.render(); } }, W.t('db.refresh')),
      h('button.btn.small', { type: 'button', onclick: function () { app.cmd('resetData', t); } }, W.t('db.resetTable')),
      h('button.btn.small', { type: 'button', onclick: function () { self.copyLive(t); } }, W.t('db.keepLive')));
    box.appendChild(bar);
    var wrap = h('div.grid-wrap');
    box.appendChild(wrap);
    W.store.getSim(app.project.id).then(function (data) {
      var st = data && data.tables ? (data.tables[t.name] || null) : null;
      if (!st) { wrap.appendChild(h('p.muted', W.t('db.liveNone'))); return; }
      var grid = h('table.grid.rows.ro');
      grid.appendChild(h('thead', h('tr', [h('th', 'id')].concat(t.columns.map(function (c) { return h('th', c.name); })))));
      var tb = h('tbody');
      st.rows.forEach(function (r) {
        tb.appendChild(h('tr', [h('td.id', String(r.id))].concat(t.columns.map(function (c) {
          var v = r[c.name];
          return h('td', v === true ? '✓' : v === false ? '' : (v === null || v === undefined ? '' : String(v)));
        }))));
      });
      grid.appendChild(tb);
      wrap.appendChild(grid);
      wrap.appendChild(h('p.muted', W.t('db.liveCount', st.rows.length) + (st.dirty ? ' ' + W.t('db.liveChanged') : '')));
      if (server) wrap.appendChild(h('p.muted', W.t('db.liveServerNote')));
    });
  };
  D.copyLive = function (t) {
    var app = this.app;
    W.store.getSim(app.project.id).then(function (data) {
      var st = data && data.tables ? data.tables[t.name] : null;
      if (!st) return;
      t.rows = st.rows.map(function (r) {
        var o = {};
        t.columns.forEach(function (c) { if (r[c.name] !== null && r[c.name] !== undefined) o[c.name] = r[c.name]; });
        return o;
      });
      app.changed(W.t('undo.db'));
      U.toast(W.t('db.kept', t.rows.length));
    });
  };

  W.DbDesigner = DbDesigner;
})(typeof window !== 'undefined' ? window : globalThis);
