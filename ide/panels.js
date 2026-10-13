/*!
 * Wemazy IDE - tool windows: Toolbox, Solution Explorer, Outline, Output,
 * Error List, Translation (the JavaScript / PHP / SQL made from your code).
 */
(function (root) {
  'use strict';
  var W = root.Wemazy = root.Wemazy || {};
  var U = W.util, h = U.h, P = W.Project, C = W.controls;

  /* =====================================================================
   * Toolbox
   * ===================================================================== */
  function Toolbox(app, host) {
    this.app = app;
    this.host = host;
    this.closed = W.store.setting('toolboxClosed', {});
    this.build();
  }
  Toolbox.prototype.build = function () {
    var self = this;
    this.el = h('div.toolbox');
    this.search = h('input.input.small', { type: 'search', placeholder: W.t('tb.search'), 'aria-label': W.t('tb.search'), oninput: function () { self.render(); } });
    this.list = h('div.tb-list', { role: 'listbox', 'aria-label': W.t('panel.toolbox') });
    this.el.appendChild(h('div.tb-searchrow', this.search));
    this.el.appendChild(this.list);
    this.el.appendChild(h('div.tb-hint', W.t('tb.hint')));
    this.host.appendChild(this.el);
    this.render();
  };
  Toolbox.prototype.render = function () {
    var self = this;
    U.clear(this.list);
    var q = W.lang.norm(this.search.value || '');
    C.categories.forEach(function (cat) {
      var items = C.list.filter(function (c) { return c.cat === cat && !c.internal; }).filter(function (c) {
        return !q || W.lang.norm(W.t('ctl.' + c.type)).indexOf(q) >= 0 || c.type.toLowerCase().indexOf(q) >= 0;
      });
      if (!items.length) return;
      var closed = !q && self.closed[cat];
      self.list.appendChild(h('button.tb-cat', { type: 'button', 'aria-expanded': closed ? 'false' : 'true', onclick: function () {
        self.closed[cat] = !closed;
        W.store.setSetting('toolboxClosed', self.closed);
        self.render();
      } }, h('span.ic-wrap', { html: W.icons.svg(closed ? 'right' : 'down') }), W.t('tbcat.' + cat)));
      if (closed) return;
      items.forEach(function (c) {
        var it = h('div.tb-item', { role: 'option', tabindex: '0', title: W.t('ctldesc.' + c.type), dataset: { type: c.type } },
          h('span.ic-wrap', { html: W.icons.svg(c.icon) }), h('span', W.t('ctl.' + c.type)));
        it.addEventListener('pointerdown', function (e) { self.down(e, c.type, it); });
        it.addEventListener('dblclick', function () { self.app.addControl(c.type); });
        it.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); self.app.addControl(c.type); }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            var all = U.$$('.tb-item', self.list), i = all.indexOf(it);
            var n = all[i + (e.key === 'ArrowDown' ? 1 : -1)];
            if (n) n.focus();
          }
        });
        self.list.appendChild(it);
      });
    });
  };
  Toolbox.prototype.down = function (e, type, it) {
    if (e.button !== 0) return;
    var self = this, sx = e.clientX, sy = e.clientY, started = false, ghost = null;
    it.setPointerCapture(e.pointerId);
    function mv(ev) {
      if (!started && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 5) {
        var d = self.app.activeDesigner();
        if (!d) { self.app.openDesigner(self.app.currentPage()); d = self.app.activeDesigner(); }
        if (!d) return;
        started = true;
        ghost = h('div.tb-ghost', { html: W.icons.svg(C.get(type).icon) + ' ' + U.esc(W.t('ctl.' + type)) });
        document.body.appendChild(ghost);
        d.startNew(type, ev);
      }
      if (started) {
        ghost.style.left = (ev.clientX + 12) + 'px';
        ghost.style.top = (ev.clientY + 10) + 'px';
        var d2 = self.app.activeDesigner();
        if (d2 && d2.drag) d2.dragMove(ev.clientX, ev.clientY, ev.altKey);
      }
    }
    function up() {
      it.removeEventListener('pointermove', mv);
      it.removeEventListener('pointerup', up);
      it.removeEventListener('pointercancel', cancel);
      if (ghost) ghost.remove();
      var d = self.app.activeDesigner();
      if (started && d && d.drag) d.dragDrop();
    }
    function cancel() {
      it.removeEventListener('pointermove', mv);
      it.removeEventListener('pointerup', up);
      it.removeEventListener('pointercancel', cancel);
      if (ghost) ghost.remove();
      var d = self.app.activeDesigner();
      if (d && d.drag) d.cancelDrag();
    }
    it.addEventListener('pointermove', mv);
    it.addEventListener('pointerup', up);
    it.addEventListener('pointercancel', cancel);
  };

  /* =====================================================================
   * Solution Explorer
   * ===================================================================== */
  function Explorer(app, host) {
    this.app = app;
    this.host = host;
    this.open = { pages: true, db: true, assets: true };
    this.build();
  }
  Explorer.prototype.build = function () {
    this.el = h('div.tree', { role: 'tree', 'aria-label': W.t('panel.explorer') });
    this.host.appendChild(this.el);
  };
  Explorer.prototype.item = function (opts) {
    var self = this;
    var row = h('div.tree-row', { role: 'treeitem', tabindex: '-1', class: (opts.active ? 'active ' : '') + (opts.cls || ''), style: { paddingLeft: (6 + (opts.depth || 0) * 14) + 'px' },
      title: opts.title || '' },
      opts.toggle !== undefined ? h('button.tree-tog', { type: 'button', tabindex: '-1', 'aria-label': opts.toggle ? W.t('common.collapse') : W.t('common.expand'),
        html: W.icons.svg(opts.toggle ? 'down' : 'right'), onclick: function (e) { e.stopPropagation(); opts.onToggle(); } }) : h('span.tree-sp'),
      h('span.ic-wrap', { html: W.icons.svg(opts.icon) }),
      h('span.tree-label', opts.label),
      opts.badge ? h('span.tree-badge', opts.badge) : null);
    if (opts.toggle !== undefined) row.setAttribute('aria-expanded', opts.toggle ? 'true' : 'false');
    row.addEventListener('click', function () { U.$$('.tree-row.sel', self.el).forEach(function (r) { r.classList.remove('sel'); }); row.classList.add('sel'); if (opts.onClick) opts.onClick(); });
    row.addEventListener('dblclick', function () { if (opts.onOpen) opts.onOpen(); else if (opts.onToggle) opts.onToggle(); });
    row.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); if (opts.onOpen) opts.onOpen(); else if (opts.onClick) opts.onClick(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        var rows = U.$$('.tree-row', self.el), i = rows.indexOf(row);
        var n = rows[i + (e.key === 'ArrowDown' ? 1 : -1)];
        if (n) n.focus();
      }
      if ((e.key === 'Delete') && opts.onDelete) { e.preventDefault(); opts.onDelete(); }
      if (e.key === 'F2' && opts.onRename) { e.preventDefault(); opts.onRename(); }
    });
    if (opts.menu) row.addEventListener('contextmenu', function (e) { e.preventDefault(); U.menu(opts.menu(), e.clientX, e.clientY); });
    this.el.appendChild(row);
    return row;
  };
  Explorer.prototype.render = function () {
    var self = this, app = this.app, p = app.project;
    U.clear(this.el);
    if (!p) { this.el.appendChild(h('div.empty', W.t('ex.noProject'))); return; }
    var active = app.activeDoc();
    var isActive = function (kind, id) { return active && active.kind === kind && active.ref === id; };
    this.item({ icon: 'site', label: p.name, depth: 0, cls: 'root', onOpen: function () { app.cmd('settings'); },
      menu: function () { return [{ label: W.t('cmd.settings'), icon: 'settings', action: function () { app.cmd('settings'); } }, { label: W.t('cmd.renameProject'), icon: 'rename', action: function () { app.cmd('renameProject'); } }]; } });
    this.item({ icon: 'settings', label: W.t('ex.settings'), depth: 1, onOpen: function () { app.cmd('settings'); }, onClick: function () { app.cmd('settings'); } });
    this.item({ icon: 'code', label: W.t('ex.siteCode'), depth: 1, active: isActive('code', 'site'), title: W.t('ex.siteCodeHint'),
      onClick: function () { app.openCode(null); }, onOpen: function () { app.openCode(null); } });
    // pages
    this.item({ icon: 'folder', label: W.t('ex.pages'), depth: 1, toggle: this.open.pages, onToggle: function () { self.open.pages = !self.open.pages; self.render(); },
      menu: function () { return [{ label: W.t('cmd.addPage'), icon: 'plus', action: function () { app.cmd('addPage'); } }]; } });
    if (this.open.pages) {
      p.pages.forEach(function (pg, i) {
        var pageMenu = function () {
          return [
            { label: W.t('ex.openDesign'), icon: 'design', action: function () { app.openDesigner(pg); } },
            { label: W.t('ex.openCode'), icon: 'code', key: 'F7', action: function () { app.openCode(pg); } },
            { sep: true },
            { label: W.t('cmd.rename'), icon: 'rename', key: 'F2', action: function () { app.cmd('renamePage', pg); } },
            { label: W.t('cmd.duplicate'), icon: 'duplicate', action: function () { app.cmd('duplicatePage', pg); } },
            { label: W.t('ex.makeHome'), icon: 'home', disabled: i === 0, action: function () { app.cmd('makeHome', pg); } },
            { label: W.t('ex.moveUp'), icon: 'up', disabled: i <= 1, action: function () { app.cmd('movePage', pg, -1); } },
            { label: W.t('ex.moveDown'), icon: 'down', disabled: i === 0 || i === p.pages.length - 1, action: function () { app.cmd('movePage', pg, 1); } },
            { sep: true },
            { label: W.t('cmd.delete'), icon: 'trash', disabled: p.pages.length < 2, action: function () { app.cmd('deletePage', pg); } }
          ];
        };
        self.item({ icon: i === 0 ? 'home' : 'page', label: pg.name, depth: 2, active: isActive('design', pg.id), badge: P.pageFile(p, pg),
          onClick: function () { app.openDesigner(pg); }, onOpen: function () { app.openDesigner(pg); },
          onRename: function () { app.cmd('renamePage', pg); }, onDelete: function () { app.cmd('deletePage', pg); }, menu: pageMenu });
        self.item({ icon: 'code', label: pg.name + '.wz', depth: 3, active: isActive('code', pg.id), cls: 'sub',
          onClick: function () { app.openCode(pg); }, onOpen: function () { app.openCode(pg); }, menu: pageMenu });
      });
      this.item({ icon: 'plus', label: W.t('cmd.addPage'), depth: 2, cls: 'add', onClick: function () { app.cmd('addPage'); } });
    }
    // database
    this.item({ icon: 'database', label: W.t('ex.database'), depth: 1, toggle: this.open.db, onToggle: function () { self.open.db = !self.open.db; self.render(); },
      onOpen: function () { app.openDatabase(); },
      menu: function () { return [{ label: W.t('cmd.addTable'), icon: 'plus', action: function () { app.cmd('addTable'); } }, { label: W.t('ex.openDb'), icon: 'database', action: function () { app.openDatabase(); } }]; } });
    if (this.open.db) {
      p.tables.forEach(function (t) {
        self.item({ icon: 'table', label: t.name, depth: 2, active: isActive('db', t.id), badge: String((t.rows || []).length),
          title: t.columns.map(function (c) { return c.name; }).join(', '),
          onClick: function () { app.openDatabase(t); }, onOpen: function () { app.openDatabase(t); },
          onDelete: function () { app.cmd('deleteTable', t); },
          menu: function () {
            return [{ label: W.t('ex.openTable'), icon: 'table', action: function () { app.openDatabase(t); } },
              { label: W.t('cmd.rename'), icon: 'rename', action: function () { app.cmd('renameTable', t); } },
              { label: W.t('cmd.delete'), icon: 'trash', action: function () { app.cmd('deleteTable', t); } }];
          } });
      });
      this.item({ icon: 'plus', label: W.t('cmd.addTable'), depth: 2, cls: 'add', onClick: function () { app.cmd('addTable'); } });
    }
    // assets
    this.item({ icon: 'images', label: W.t('ex.assets'), depth: 1, toggle: this.open.assets, onToggle: function () { self.open.assets = !self.open.assets; self.render(); },
      menu: function () { return [{ label: W.t('cmd.addFiles'), icon: 'upload', action: function () { app.cmd('addFiles'); } }]; } });
    if (this.open.assets) {
      p.assets.forEach(function (a) {
        var row = self.item({ icon: /^image\//.test(a.type) ? 'c-image' : (/^audio\//.test(a.type) ? 'c-audio' : 'page'), label: a.name, depth: 2, badge: U.fmtBytes(a.size || 0),
          onDelete: function () { app.cmd('deleteAsset', a); },
          menu: function () {
            return [{ label: W.t('ex.copyName'), icon: 'copy', action: function () { U.copyText('"' + a.name + '"'); U.toast(W.t('ex.copied', a.name)); } },
              { label: W.t('cmd.rename'), icon: 'rename', action: function () { app.cmd('renameAsset', a); } },
              { label: W.t('cmd.delete'), icon: 'trash', action: function () { app.cmd('deleteAsset', a); } }];
          } });
        if (/^image\//.test(a.type)) {
          row.addEventListener('mouseenter', function () {
            var r = row.getBoundingClientRect();
            self.preview = h('div.tree-preview', h('img', { src: a.data, alt: '' }));
            document.body.appendChild(self.preview);
            self.preview.style.left = Math.max(8, r.left - 190) + 'px';
            self.preview.style.top = r.top + 'px';
          });
          row.addEventListener('mouseleave', function () { if (self.preview) { self.preview.remove(); self.preview = null; } });
        }
      });
      this.item({ icon: 'plus', label: W.t('cmd.addFiles'), depth: 2, cls: 'add', onClick: function () { app.cmd('addFiles'); } });
    }
  };

  /* =====================================================================
   * Outline: the controls of the page as a tree
   * ===================================================================== */
  function Outline(app, host) {
    this.app = app;
    this.host = host;
    this.el = h('div.tree.outline', { role: 'tree', 'aria-label': W.t('panel.outline') });
    this.host.appendChild(this.el);
  }
  Outline.prototype.render = function () {
    var self = this, app = this.app;
    U.clear(this.el);
    var page = app.currentPage();
    if (!page) return;
    var sel = app.selection;
    P.walk(page.root, function (el, parent) {
      var depth = 0, f = P.find(page, el.id);
      while (f && f.parent) { depth++; f = P.find(page, f.parent.id); }
      var def = C.get(el.type);
      var row = h('div.tree-row', { role: 'treeitem', tabindex: '-1', class: sel && sel.id === el.id ? 'sel' : '', style: { paddingLeft: (6 + depth * 14) + 'px' } },
        h('span.ic-wrap', { html: W.icons.svg(el === page.root ? 'page' : (def ? def.icon : 'c-panel')) }),
        h('span.tree-label', el === page.root ? page.name : el.name),
        el === page.root ? null : h('span.tree-badge', W.t('ctl.' + el.type)));
      if (el.props && el.props.visible === false) row.classList.add('dim');
      row.addEventListener('click', function () { app.select(page, el.id); });
      row.addEventListener('dblclick', function () {
        if (el === page.root) return;
        if (def && def.events && def.defaultEvent && def.events[def.defaultEvent]) app.goToEvent(page, el, def.defaultEvent);
      });
      row.addEventListener('contextmenu', function (e) { e.preventDefault(); app.select(page, el.id); app.contextMenu(page, el.id, e.clientX, e.clientY); });
      self.el.appendChild(row);
      void parent;
    });
    var on = U.$('.tree-row.sel', this.el);
    if (on) on.scrollIntoView({ block: 'nearest' });
  };

  /* =====================================================================
   * Output
   * ===================================================================== */
  function Output(app, host) {
    var self = this;
    this.app = app;
    this.host = host;
    this.el = h('div.output');
    this.bar = h('div.panel-bar',
      h('span.muted', W.t('out.hint')),
      h('span.grow'),
      h('button.tb-btn', { type: 'button', title: W.t('out.clear'), 'aria-label': W.t('out.clear'), html: W.icons.svg('trash'), onclick: function () { self.clear(); } }));
    this.log = h('div.out-log', { role: 'log', 'aria-live': 'polite' });
    this.el.appendChild(this.bar);
    this.el.appendChild(this.log);
    this.host.appendChild(this.el);
  }
  Output.prototype.write = function (text, kind, where) {
    var t = new Date();
    var time = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0') + ':' + String(t.getSeconds()).padStart(2, '0');
    var line = h('div.out-line', { class: kind || '' }, h('span.out-time', time), h('span.out-text', text));
    if (where && where.file) {
      var app = this.app;
      var link = h('button.out-where', { type: 'button', onclick: function () { app.goToLine(where.file, where.line, where.col); } }, where.file + (where.line ? ':' + where.line : ''));
      line.appendChild(link);
    }
    this.log.appendChild(line);
    while (this.log.children.length > 1500) this.log.removeChild(this.log.firstChild);
    this.log.scrollTop = this.log.scrollHeight;
  };
  Output.prototype.clear = function () { U.clear(this.log); };

  /* =====================================================================
   * Error List
   * ===================================================================== */
  function Errors(app, host) {
    this.app = app;
    this.host = host;
    this.el = h('div.errors');
    this.table = h('div.err-table', { role: 'grid', 'aria-label': W.t('panel.errors') });
    this.el.appendChild(this.table);
    this.host.appendChild(this.el);
    this.list = [];
  }
  Errors.prototype.set = function (errors, warnings, runtime) {
    var self = this, app = this.app;
    this.list = (errors || []).map(function (e) { return Object.assign({ kind: 'error' }, e); })
      .concat((runtime || []).map(function (e) { return Object.assign({ kind: 'error', runtime: true }, e); }))
      .concat((warnings || []).map(function (e) { return Object.assign({ kind: 'warning' }, e); }));
    U.clear(this.table);
    this.table.appendChild(h('div.err-head', { role: 'row' }, h('span', ''), h('span', W.t('err.col.msg')), h('span', W.t('err.col.file')), h('span', W.t('err.col.line'))));
    if (!this.list.length) {
      this.table.appendChild(h('div.empty.ok', { html: W.icons.svg('check') + ' ' + U.esc(W.t('err.none')) }));
      return;
    }
    this.list.forEach(function (e) {
      var row = h('div.err-row', { role: 'row', tabindex: '0', class: e.kind },
        h('span.err-ic', { html: W.icons.svg(e.kind === 'warning' ? 'warning' : 'error') }),
        h('span.err-msg', (e.runtime ? W.t('err.runtime') + ' ' : '') + e.msg),
        h('span.err-file', fileLabel(e.file)),
        h('span.err-line', e.line ? String(e.line) : ''));
      var go = function () { app.goToLine(e.file, e.line, e.col, e.len); };
      row.addEventListener('dblclick', go);
      row.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') go(); });
      self.table.appendChild(row);
    });
  };
  function fileLabel(f) { return f === 'Site' ? W.t('ex.siteCodeShort') : (f || ''); }

  /* =====================================================================
   * Translation: the JavaScript, PHP and SQL made from your code
   * ===================================================================== */
  function Translation(app, host) {
    var self = this;
    this.app = app;
    this.host = host;
    this.tab = 'js';
    this.el = h('div.translation');
    this.tabs = {};
    var bar = h('div.panel-bar');
    ['js', 'php', 'sql'].forEach(function (k) {
      var b = h('button.seg', { type: 'button', onclick: function () { self.tab = k; self.render(); } }, W.t('tr.' + k));
      self.tabs[k] = b;
      bar.appendChild(b);
    });
    this.note = h('span.muted.tr-note');
    bar.appendChild(this.note);
    bar.appendChild(h('span.grow'));
    bar.appendChild(h('button.tb-btn', { type: 'button', title: W.t('tr.copy'), 'aria-label': W.t('tr.copy'), html: W.icons.svg('copy'),
      onclick: function () { U.copyText(self.editor.getValue()); U.toast(W.t('tr.copied')); } }));
    this.el.appendChild(bar);
    var edHost = h('div.tr-ed');
    this.el.appendChild(edHost);
    this.host.appendChild(this.el);
    this.editor = new W.Editor(edHost, { language: 'js', readOnly: true, label: W.t('panel.translation') });
  }
  Translation.prototype.render = function () {
    var app = this.app, p = app.project;
    Object.keys(this.tabs).forEach(function (k) { this.tabs[k].classList.toggle('on', k === this.tab); }, this);
    if (!p) { this.editor.setValue(''); return; }
    var r = W.build.compile(p, false);
    var doc = app.activeDoc();
    var page = app.currentPage();
    var text = '';
    if (this.tab === 'js') {
      this.note.textContent = W.t('tr.jsNote', page ? page.name : '');
      text = page && r.pages[page.name] ? r.pages[page.name].js : '';
    } else if (this.tab === 'php') {
      this.note.textContent = r.uses.server ? W.t('tr.phpNote') : W.t('tr.phpNone');
      text = r.uses.server ? r.server.php + '\n' + (r.runtimePhp ? r.runtimePhp + '\n\n' : '') + W.lang.phpSchema(p.tables) + '\n' : '<?php\n// ' + W.t('tr.phpNone') + '\n';
    } else {
      this.note.textContent = W.t('tr.sqlNote');
      text = W.lang.schemaSql(p.tables, 'sqlite');
      var qs = r.server.queries || [];
      if (qs.length) {
        text += '\n\n-- ' + W.t('tr.sqlQueries') + '\n';
        qs.forEach(function (q) { if (q.sql) text += '\n-- ' + q.file + ', ' + W.t('tr.line') + ' ' + q.line + '\n' + q.sql.replace('{RANDOM}', 'RANDOM()') + ';\n'; });
      }
      if (!p.tables.length) text = '-- ' + W.t('tr.sqlNone') + '\n';
    }
    void doc;
    this.editor.setLanguage(this.tab === 'sql' ? 'sql' : (this.tab === 'php' ? 'php' : 'js'));
    var same = this.editor.getValue() === text;
    if (!same) this.editor.setValue(text, true);
  };

  W.panels = { Toolbox: Toolbox, Explorer: Explorer, Outline: Outline, Output: Output, Errors: Errors, Translation: Translation };
})(typeof window !== 'undefined' ? window : globalThis);
