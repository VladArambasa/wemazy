/*!
 * Wemazy IDE - the main window: menus, toolbar, panels, documents, commands.
 */
(function (root) {
  'use strict';
  var W = root.Wemazy = root.Wemazy || {};
  var U = W.util, h = U.h, P = W.Project, C = W.controls, L = W.lang;

  var app = W.app = {
    project: null,
    docs: [],
    active: null,
    selection: null,
    clipboard: null,
    runtimeErrs: []
  };

  /* =====================================================================
   * Start
   * ===================================================================== */

  app.init = function () {
    var theme = W.store.setting('theme', window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.lang = W.i18n.lang;
    document.title = 'Wemazy';
    app.buildShell();
    app.openStart();
    W.store.init().then(function (mode) {
      app.updateStatusbar();
      if (W.store.server && W.store.server.locked) U.toast(W.t('store.locked'), null, 9000);
      if (mode === 'server' && W.store.server.needsPassword && !W.store.server.authed) app.login();
      return app.loadUserPacks();
    }).then(function () {
      var last = W.store.setting('lastProject', null);
      if (last && W.store.setting('reopen', true)) {
        return W.store.loadProject(last).then(function (p) { if (p) app.load(p, true); }, function () { /* gone */ });
      }
    }).then(function () { app.renderStart(); });
    window.addEventListener('keydown', app.onKey, true);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') app.saveNow(); });
    window.addEventListener('beforeunload', function (e) {
      if (app.dirty) { app.saveNow(); e.preventDefault(); e.returnValue = ''; }
    });
    W.bus.on('project-changed', function (d) { if (d && d.undo) app.afterChange(true); });
    W.bus.on('history', function () { app.updateMenus(); });
  };

  /** Language packs made in the Language Lab of this browser or server. */
  app.loadUserPacks = function () {
    return W.store.listPacks().then(function (packs) {
      (packs || []).forEach(function (pk) {
        if (pk && pk.id && !(L.packs[pk.id] && L.packs[pk.id].builtin)) { pk.userMade = true; L.registerPack(pk); }
      });
    }, function () { /* none */ });
  };

  app.login = function () {
    var inp = h('input.input', { type: 'password', autofocus: true, autocomplete: 'current-password' });
    var err = h('div.wd-err');
    U.dialog({
      title: W.t('login.title'), width: 380,
      body: h('div', h('p.wd-text', W.t('login.text')), h('label.wd-label', W.t('login.password'), inp), err),
      buttons: [{ label: W.t('login.browser'), value: 'browser' }, { label: W.t('login.ok'), primary: true, action: function () {
        return W.store.login(inp.value).then(function () { U.toast(W.t('login.done')); return true; }, function (e) { err.textContent = e.code === 'bad_password' ? W.t('login.wrong') : e.message; inp.focus(); return false; });
      } }]
    }).then(function (v) {
      if (v === 'browser' || v === null) {
        W.store.mode = 'browser';
        app.updateStatusbar();
        U.toast(W.t('login.browserNote'));
      }
    });
  };

  /* =====================================================================
   * The window
   * ===================================================================== */

  app.buildShell = function () {
    var root = U.$('#app');
    U.clear(root);
    root.className = 'ide';
    // title bar with the menus
    var title = h('header.titlebar',
      h('div.brand', { html: W.icons.logo(20) + '<span>Wemazy</span>' }),
      app.menubar = h('nav.menubar', { role: 'menubar', 'aria-label': W.t('menu.main') }),
      app.titleText = h('div.title-project'),
      h('div.title-right',
        app.langSel = h('select.tb-select.small', { 'aria-label': W.t('opt.uiLang'), onchange: function () { app.setUiLang(app.langSel.value); } },
          h('option', { value: 'en' }, 'English'), h('option', { value: 'ro' }, 'Română')),
        h('button.tb-btn', { type: 'button', title: W.t('cmd.toggleTheme'), 'aria-label': W.t('cmd.toggleTheme'), html: W.icons.svg('moon'), onclick: function () { app.cmd('toggleTheme'); } })));
    app.langSel.value = W.i18n.lang;
    // toolbar
    app.toolbar = h('div.toolbar', { role: 'toolbar', 'aria-label': W.t('menu.toolbar') });
    // workspace
    app.left = h('aside.dock.left', { 'aria-label': W.t('panel.toolbox') });
    app.center = h('main.center');
    app.right = h('aside.dock.right');
    var splitL = h('div.splitter.v', { role: 'separator', 'aria-orientation': 'vertical' });
    var splitR = h('div.splitter.v', { role: 'separator', 'aria-orientation': 'vertical' });
    var work = h('div.workspace', app.left, splitL, app.center, splitR, app.right);
    // left: toolbox
    app.left.appendChild(panelHead(W.t('panel.toolbox'), 'left'));
    var tbHost = h('div.dock-body');
    app.left.appendChild(tbHost);
    app.toolbox = new W.panels.Toolbox(app, tbHost);
    // center: documents + bottom panels
    app.tabbar = h('div.doctabs', { role: 'tablist' });
    app.docHost = h('div.docs');
    var splitB = app.splitB = h('div.splitter.h', { role: 'separator', 'aria-orientation': 'horizontal' });
    app.bottom = h('section.bottom');
    app.center.appendChild(app.tabbar);
    app.center.appendChild(app.docHost);
    app.center.appendChild(splitB);
    app.center.appendChild(app.bottom);
    var bTabs = h('div.ptabs', { role: 'tablist' });
    var bBody = h('div.pbody');
    app.bottom.appendChild(bTabs);
    app.bottom.appendChild(bBody);
    app.bottomTabs = {};
    var errHost = h('div.ppane'), outHost = h('div.ppane'), trHost = h('div.ppane');
    [['errors', errHost], ['output', outHost], ['translation', trHost]].forEach(function (x) {
      var b = h('button.ptab', { type: 'button', role: 'tab', onclick: function () { app.showBottom(x[0]); } }, h('span.ptab-label', W.t('panel.' + x[0])), h('span.ptab-count'));
      app.bottomTabs[x[0]] = { btn: b, host: x[1] };
      bTabs.appendChild(b);
      bBody.appendChild(x[1]);
    });
    bTabs.appendChild(h('span.grow'));
    bTabs.appendChild(h('button.tb-btn', { type: 'button', title: W.t('common.collapse'), 'aria-label': W.t('common.collapse'), html: W.icons.svg('down'), onclick: function () { app.toggleBottom(); } }));
    app.errors = new W.panels.Errors(app, errHost);
    app.outputPanel = new W.panels.Output(app, outHost);
    app.translation = new W.panels.Translation(app, trHost);
    // right: explorer/outline + properties
    var rTabs = h('div.ptabs', { role: 'tablist' });
    app.rightTop = h('section.rtop', rTabs);
    var exHost = h('div.ppane'), olHost = h('div.ppane');
    var rBody = h('div.pbody', exHost, olHost);
    app.rightTop.appendChild(rBody);
    app.rightTabs = {};
    [['explorer', exHost], ['outline', olHost]].forEach(function (x) {
      var b = h('button.ptab', { type: 'button', role: 'tab', onclick: function () { app.showRight(x[0]); } }, W.t('panel.' + x[0]));
      app.rightTabs[x[0]] = { btn: b, host: x[1] };
      rTabs.appendChild(b);
    });
    var splitP = app.splitP = h('div.splitter.h', { role: 'separator', 'aria-orientation': 'horizontal' });
    app.propsBox = h('section.rprops', panelHead(W.t('panel.properties'), 'props'));
    var prHost = h('div.dock-body');
    app.propsBox.appendChild(prHost);
    app.right.appendChild(app.rightTop);
    app.right.appendChild(splitP);
    app.right.appendChild(app.propsBox);
    app.explorer = new W.panels.Explorer(app, exHost);
    app.outline = new W.panels.Outline(app, olHost);
    app.props = new W.Props(app, prHost);
    // status bar
    app.statusbar = h('footer.statusbar', { role: 'status' },
      app.statusText = h('span.st-text', W.t('status.ready')),
      app.statusErr = h('button.st-err', { type: 'button', onclick: function () { app.showBottom('errors'); } }),
      h('span.grow'),
      app.statusCaret = h('span.st-item'),
      app.statusStore = h('span.st-item'));
    root.appendChild(title);
    root.appendChild(app.toolbar);
    root.appendChild(work);
    root.appendChild(app.statusbar);
    // sizes and splitters
    var sizes = W.store.setting('layout', { left: 210, right: 300, bottom: 190, props: 0.55 });
    app.sizes = sizes;
    app.applySizes();
    U.splitter(splitL, function () { return sizes.left; }, function (dx, dy, s0) { sizes.left = U.clamp(s0 + dx, 150, 420); app.applySizes(); }, saveSizes);
    U.splitter(splitR, function () { return sizes.right; }, function (dx, dy, s0) { sizes.right = U.clamp(s0 - dx, 220, 560); app.applySizes(); }, saveSizes);
    U.splitter(splitB, function () { return sizes.bottom; }, function (dx, dy, s0) { sizes.bottom = U.clamp(s0 - dy, 60, window.innerHeight - 260); app.applySizes(); }, saveSizes);
    U.splitter(splitP, function () { return sizes.props; }, function (dx, dy, s0) {
      var hgt = app.right.clientHeight || 600;
      sizes.props = U.clamp(s0 - dy / hgt, 0.2, 0.85);
      app.applySizes();
    }, saveSizes);
    function saveSizes() { W.store.setSetting('layout', sizes); }
    app.buildMenus();
    app.buildToolbar();
    app.showBottom(W.store.setting('bottomTab', 'errors'));
    app.showRight('explorer');
    app.hidden = W.store.setting('hiddenPanels', {});
    app.applyHidden();
    app.narrowCheck();
    window.addEventListener('resize', U.debounce(app.narrowCheck, 100));
  };

  function panelHead(title, which) {
    return h('div.panel-head', h('span', title), h('span.grow'),
      h('button.tb-btn', { type: 'button', title: W.t('common.hide'), 'aria-label': W.t('common.hide') + ' ' + title, html: W.icons.svg('close'), onclick: function () { app.togglePanel(which, false); } }));
  }

  app.applySizes = function () {
    var s = app.sizes;
    app.left.style.width = s.left + 'px';
    app.right.style.width = s.right + 'px';
    app.bottom.style.height = (app.bottomCollapsed ? 30 : s.bottom) + 'px';
    app.rightTop.style.flex = (1 - s.props) + ' 1 0';
    app.propsBox.style.flex = s.props + ' 1 0';
  };
  app.toggleBottom = function () {
    app.bottomCollapsed = !app.bottomCollapsed;
    app.bottom.classList.toggle('collapsed', app.bottomCollapsed);
    app.applySizes();
  };
  app.togglePanel = function (which, show) {
    var hid = app.hidden;
    hid[which] = show === undefined ? !hid[which] : !show;
    W.store.setSetting('hiddenPanels', hid);
    app.applyHidden();
    app.updateMenus();
  };
  app.applyHidden = function () {
    var hid = app.hidden || {};
    document.body.classList.toggle('hide-left', !!hid.left);
    document.body.classList.toggle('hide-right', !!(hid.explorer && hid.props));
    app.rightTop.style.display = hid.explorer ? 'none' : '';
    app.propsBox.style.display = hid.props ? 'none' : '';
    app.splitP.style.display = hid.explorer || hid.props ? 'none' : '';
    app.bottom.style.display = hid.bottom ? 'none' : '';
    app.splitB.style.display = hid.bottom ? 'none' : '';
  };
  app.narrowCheck = function () {
    var narrow = window.innerWidth < 900;
    document.body.classList.toggle('narrow', narrow);
  };

  app.showBottom = function (k) {
    Object.keys(app.bottomTabs).forEach(function (x) {
      var t = app.bottomTabs[x];
      t.btn.classList.toggle('on', x === k);
      t.btn.setAttribute('aria-selected', x === k ? 'true' : 'false');
      t.host.style.display = x === k ? '' : 'none';
    });
    app.bottomTab = k;
    W.store.setSetting('bottomTab', k);
    if (app.bottomCollapsed) app.toggleBottom();
    if (k === 'translation') app.translation.render();
  };
  app.showRight = function (k) {
    Object.keys(app.rightTabs).forEach(function (x) {
      var t = app.rightTabs[x];
      t.btn.classList.toggle('on', x === k);
      t.btn.setAttribute('aria-selected', x === k ? 'true' : 'false');
      t.host.style.display = x === k ? '' : 'none';
    });
    app.rightTab = k;
    if (k === 'outline') app.outline.render();
  };

  /* ---------------- menus ---------------- */

  var MOD = U.isMac ? '⌘' : 'Ctrl+';
  app.menuDefs = function () {
    var p = app.project;
    var hasP = !!p;
    var doc = app.activeDoc();
    var inCode = doc && doc.kind === 'code';
    var inDesign = doc && doc.kind === 'design';
    var hid = app.hidden || {};
    return [
      ['file', [
        { label: W.t('cmd.newProject'), icon: 'new', key: MOD + 'N', action: function () { app.cmd('newProject'); } },
        { label: W.t('cmd.openProject'), icon: 'open', key: MOD + 'O', action: function () { app.cmd('openProject'); } },
        { label: W.t('cmd.openFile'), icon: 'folder', action: function () { app.cmd('openFile'); } },
        { sep: true },
        { label: W.t('cmd.save'), icon: 'save', key: MOD + 'S', disabled: !hasP, action: function () { app.cmd('save'); } },
        { label: W.t('cmd.saveFile'), icon: 'download', disabled: !hasP, action: function () { app.cmd('saveFile'); } },
        { sep: true },
        { label: W.t('cmd.export'), icon: 'export', key: MOD + 'E', disabled: !hasP, action: function () { app.cmd('export'); } },
        { sep: true },
        { label: W.t('cmd.closeProject'), icon: 'close', disabled: !hasP, action: function () { app.cmd('closeProject'); } }
      ]],
      ['edit', [
        { label: W.t('cmd.undo') + (W.history.undoStack.length ? ': ' + (W.history.undoStack[W.history.undoStack.length - 1].label || '') : ''), icon: 'undo', key: MOD + 'Z', disabled: !hasP || (!inCode && !W.history.canUndo()), action: function () { app.cmd('undo'); } },
        { label: W.t('cmd.redo'), icon: 'redo', key: MOD + 'Y', disabled: !hasP || (!inCode && !W.history.canRedo()), action: function () { app.cmd('redo'); } },
        { sep: true },
        { label: W.t('cmd.cut'), icon: 'cut', key: MOD + 'X', disabled: !inDesign, action: function () { app.cmd('cut'); } },
        { label: W.t('cmd.copy'), icon: 'copy', key: MOD + 'C', disabled: !inDesign, action: function () { app.cmd('copy'); } },
        { label: W.t('cmd.paste'), icon: 'paste', key: MOD + 'V', disabled: !inDesign || !app.clipboard, action: function () { app.cmd('paste'); } },
        { label: W.t('cmd.duplicate'), icon: 'duplicate', key: MOD + 'D', disabled: !inDesign, action: function () { app.cmd('duplicate'); } },
        { label: W.t('cmd.delete'), icon: 'trash', key: 'Del', disabled: !inDesign, action: function () { app.cmd('delete'); } },
        { sep: true },
        { label: W.t('cmd.find'), icon: 'search', key: MOD + 'F', disabled: !inCode, action: function () { doc.component.openFind(false); } },
        { label: W.t('cmd.replace'), key: MOD + 'H', disabled: !inCode, action: function () { doc.component.openFind(true); } },
        { label: W.t('cmd.format'), icon: 'format', key: 'Shift+Alt+F', disabled: !inCode, action: function () { app.cmd('format'); } }
      ]],
      ['view', [
        { label: W.t('cmd.viewDesigner'), icon: 'design', key: 'Shift+F7', disabled: !hasP, action: function () { app.cmd('viewDesigner'); } },
        { label: W.t('cmd.viewCode'), icon: 'code', key: 'F7', disabled: !hasP, action: function () { app.cmd('viewCode'); } },
        { sep: true },
        { label: W.t('panel.toolbox'), checked: !hid.left, action: function () { app.togglePanel('left'); } },
        { label: W.t('panel.explorer'), checked: !hid.explorer, action: function () { app.togglePanel('explorer', true); app.showRight('explorer'); } },
        { label: W.t('panel.outline'), action: function () { app.togglePanel('explorer', true); app.showRight('outline'); } },
        { label: W.t('panel.properties'), key: 'F4', checked: !hid.props, action: function () { app.togglePanel('props'); } },
        { label: W.t('panel.errors'), action: function () { app.togglePanel('bottom', true); app.showBottom('errors'); } },
        { label: W.t('panel.output'), action: function () { app.togglePanel('bottom', true); app.showBottom('output'); } },
        { label: W.t('panel.translation'), icon: 'translate', action: function () { app.togglePanel('bottom', true); app.showBottom('translation'); } },
        { sep: true },
        { label: W.t('cmd.startPage'), icon: 'home', action: function () { app.openStart(); } },
        { label: W.t('cmd.toggleTheme'), icon: 'moon', action: function () { app.cmd('toggleTheme'); } }
      ]],
      ['project', [
        { label: W.t('cmd.addPage'), icon: 'page', disabled: !hasP, action: function () { app.cmd('addPage'); } },
        { label: W.t('cmd.addTable'), icon: 'table', disabled: !hasP, action: function () { app.cmd('addTable'); } },
        { label: W.t('cmd.addFiles'), icon: 'images', disabled: !hasP, action: function () { app.cmd('addFiles'); } },
        { sep: true },
        { label: W.t('cmd.lab'), icon: 'lab', disabled: false, action: function () { app.cmd('lab'); } },
        { sep: true },
        { label: W.t('cmd.settings'), icon: 'settings', disabled: !hasP, action: function () { app.cmd('settings'); } }
      ]],
      ['build', [
        { label: W.t('cmd.build'), icon: 'check', key: MOD + 'Shift+B', disabled: !hasP, action: function () { app.cmd('build'); } },
        { label: W.t('cmd.export'), icon: 'export', key: MOD + 'E', disabled: !hasP, action: function () { app.cmd('export'); } },
        { label: W.t('cmd.showTranslation'), icon: 'translate', disabled: !hasP, action: function () { app.showBottom('translation'); } }
      ]],
      ['debug', [
        { label: W.t('cmd.run'), icon: 'run', key: 'F5', disabled: !hasP, action: function () { app.cmd('run'); } },
        { label: W.t('cmd.runPhp'), icon: 'server', disabled: !hasP || W.store.mode !== 'server', action: function () { app.cmd('runPhp'); } },
        { label: W.t('cmd.stop'), icon: 'stop', key: 'Shift+F5', disabled: !app.running, action: function () { app.cmd('stop'); } },
        { sep: true },
        { label: W.t('cmd.resetData'), icon: 'database', disabled: !hasP, action: function () { app.cmd('resetData'); } }
      ]],
      ['tools', [
        { label: W.t('cmd.lab'), icon: 'lab', action: function () { app.cmd('lab'); } },
        { label: W.t('cmd.options'), icon: 'settings', action: function () { app.cmd('options'); } },
        W.store.server ? { label: W.store.mode === 'server' ? W.t('cmd.useBrowser') : W.t('cmd.useServer'), icon: 'server', action: function () { app.cmd('switchStore'); } } : null
      ]],
      ['help', [
        { label: W.t('help.s.start'), icon: 'book', key: 'F1', action: function () { app.openHelp('start'); } },
        { label: W.t('help.s.language'), icon: 'code', action: function () { app.openHelp('language'); } },
        { label: W.t('help.s.functions'), action: function () { app.openHelp('functions'); } },
        { label: W.t('help.s.shortcuts'), icon: 'key', action: function () { app.openHelp('shortcuts'); } },
        { sep: true },
        { label: W.t('help.s.about'), icon: 'info', action: function () { app.openHelp('about'); } }
      ]]
    ];
  };
  app.buildMenus = function () {
    U.clear(app.menubar);
    app.menuDefs().forEach(function (m, i) {
      var b = h('button.menu-top', { type: 'button', role: 'menuitem', 'aria-haspopup': 'true' }, W.t('menu.' + m[0]));
      var open = function () {
        var defs = app.menuDefs()[i][1];
        var r = b.getBoundingClientRect();
        U.menu(defs, r.left, r.bottom);
        app.menuOpen = i;
        b.classList.add('on');
        var mo = U.$('.wm-menu');
        var obs = new MutationObserver(function () { if (!document.body.contains(mo)) { b.classList.remove('on'); app.menuOpen = null; obs.disconnect(); } });
        obs.observe(document.body, { childList: true });
      };
      b.addEventListener('click', open);
      b.addEventListener('mouseenter', function () { if (app.menuOpen !== null && app.menuOpen !== undefined && app.menuOpen !== i) open(); });
      app.menubar.appendChild(b);
    });
  };
  app.updateMenus = function () {
    if (!app.tbButtons) return;
    var hasP = !!app.project;
    var doc = app.activeDoc();
    var inCode = doc && doc.kind === 'code';
    app.tbButtons.save.disabled = !hasP;
    app.tbButtons.undo.disabled = !hasP || (!inCode && !W.history.canUndo());
    app.tbButtons.redo.disabled = !hasP || (!inCode && !W.history.canRedo());
    app.tbButtons.run.disabled = !hasP;
    app.tbButtons.stop.disabled = !app.running;
    app.tbButtons.export.disabled = !hasP;
    app.tbButtons.design.disabled = !hasP;
    app.tbButtons.code.disabled = !hasP;
    app.tbButtons.runMode.disabled = !hasP;
  };

  /* ---------------- toolbar ---------------- */

  app.buildToolbar = function () {
    var t = app.toolbar;
    U.clear(t);
    var B = app.tbButtons = {};
    function btn(key, icon, label, cmd, cls) {
      var b = h('button.tb-btn', { type: 'button', class: cls || '', title: label, 'aria-label': label, html: W.icons.svg(icon), onclick: function () { app.cmd(cmd); } });
      B[key] = b;
      t.appendChild(b);
      return b;
    }
    btn('new', 'new', W.t('cmd.newProject') + ' (' + MOD + 'N)', 'newProject');
    btn('open', 'open', W.t('cmd.openProject') + ' (' + MOD + 'O)', 'openProject');
    btn('save', 'save', W.t('cmd.save') + ' (' + MOD + 'S)', 'save');
    t.appendChild(h('span.tb-sep'));
    btn('undo', 'undo', W.t('cmd.undo') + ' (' + MOD + 'Z)', 'undo');
    btn('redo', 'redo', W.t('cmd.redo') + ' (' + MOD + 'Y)', 'redo');
    t.appendChild(h('span.tb-sep'));
    var run = h('button.tb-run', { type: 'button', title: W.t('cmd.run') + ' (F5)', onclick: function () { app.cmd(app.runMode === 'php' ? 'runPhp' : 'run'); } },
      h('span.ic-wrap', { html: W.icons.svg('run') }), h('span', W.t('tb.start')));
    B.run = run;
    t.appendChild(run);
    B.runMode = h('select.tb-select', { 'aria-label': W.t('tb.runWhere'), onchange: function () { app.runMode = B.runMode.value; W.store.setSetting('runMode', app.runMode); } },
      h('option', { value: 'browser' }, W.t('tb.inBrowser')), h('option', { value: 'php' }, W.t('tb.onPhp')));
    app.runMode = W.store.setting('runMode', 'browser');
    B.runMode.value = app.runMode;
    t.appendChild(B.runMode);
    btn('stop', 'stop', W.t('cmd.stop') + ' (Shift+F5)', 'stop', 'stop');
    t.appendChild(h('span.tb-sep'));
    btn('design', 'design', W.t('cmd.viewDesigner') + ' (Shift+F7)', 'viewDesigner');
    btn('code', 'code', W.t('cmd.viewCode') + ' (F7)', 'viewCode');
    t.appendChild(h('span.tb-sep'));
    var ex = h('button.tb-btn.text', { type: 'button', title: W.t('cmd.export') + ' (' + MOD + 'E)', onclick: function () { app.cmd('export'); } },
      h('span.ic-wrap', { html: W.icons.svg('export') }), h('span', W.t('tb.export')));
    B.export = ex;
    t.appendChild(ex);
    t.appendChild(h('span.grow'));
    var lab = h('button.tb-btn.text', { type: 'button', title: W.t('cmd.lab'), onclick: function () { app.cmd('lab'); } }, h('span.ic-wrap', { html: W.icons.svg('lab') }), h('span', W.t('tb.lab')));
    t.appendChild(lab);
    var help = h('button.tb-btn.text', { type: 'button', title: W.t('menu.help'), onclick: function () { app.openHelp('start'); } }, h('span.ic-wrap', { html: W.icons.svg('help') }), h('span', W.t('menu.help')));
    t.appendChild(help);
    app.updateMenus();
  };

  /* =====================================================================
   * Documents (the tabs in the middle)
   * ===================================================================== */

  app.activeDoc = function () {
    return app.docs.filter(function (d) { return d.key === app.active; })[0] || null;
  };
  app.findDoc = function (key) { return app.docs.filter(function (d) { return d.key === key; })[0] || null; };

  app.addDoc = function (doc) {
    var ex = app.findDoc(doc.key);
    if (ex) { app.activate(ex.key); return ex; }
    doc.host = h('div.doc', { role: 'tabpanel' });
    app.docHost.appendChild(doc.host);
    app.docs.push(doc);
    if (doc.create) doc.create(doc);
    app.renderTabs();
    app.activate(doc.key);
    return doc;
  };
  app.renderTabs = function () {
    U.clear(app.tabbar);
    app.docs.forEach(function (d) {
      var tab = h('div.doctab', { role: 'tab', tabindex: '0', class: d.key === app.active ? 'on' : '', 'aria-selected': d.key === app.active ? 'true' : 'false', title: d.title },
        h('span.ic-wrap', { html: W.icons.svg(d.icon) }), h('span.doctab-t', d.title),
        d.closable === false ? null : h('button.doctab-x', { type: 'button', 'aria-label': W.t('common.close') + ' ' + d.title, html: W.icons.svg('close'),
          onclick: function (e) { e.stopPropagation(); app.closeDoc(d.key); } }));
      tab.addEventListener('click', function () { app.activate(d.key); });
      tab.addEventListener('auxclick', function (e) { if (e.button === 1) app.closeDoc(d.key); });
      tab.addEventListener('keydown', function (e) { if (e.key === 'Enter') app.activate(d.key); });
      app.tabbar.appendChild(tab);
    });
  };
  app.activate = function (key) {
    var doc = app.findDoc(key);
    if (!doc) return;
    app.active = key;
    app.docs.forEach(function (d) { d.host.style.display = d.key === key ? '' : 'none'; });
    U.$$('.doctab', app.tabbar).forEach(function (t, i) {
      var on = app.docs[i] && app.docs[i].key === key;
      t.classList.toggle('on', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (doc.onShow) doc.onShow(doc);
    if ((doc.kind === 'design' || doc.kind === 'code') && doc.page !== undefined) {
      app.curPageId = doc.page ? doc.page.id : app.curPageId;
      if (doc.kind === 'design' && doc.page && (!app.selection || app.selection.pageId !== doc.page.id)) app.select(doc.page, 'root');
    }
    app.explorer.render();
    if (app.rightTab === 'outline') app.outline.render();
    if (app.bottomTab === 'translation') app.translation.render();
    app.updateMenus();
    app.updateStatusbar();
    document.body.classList.toggle('code-active', doc.kind === 'code');
  };
  app.closeDoc = function (key) {
    var i = app.docs.findIndex(function (d) { return d.key === key; });
    if (i < 0) return;
    var d = app.docs[i];
    if (d.onClose) d.onClose(d);
    d.host.remove();
    app.docs.splice(i, 1);
    if (app.active === key) {
      var next = app.docs[i] || app.docs[i - 1];
      app.active = null;
      if (next) app.activate(next.key);
    }
    app.renderTabs();
    app.explorer.render();
    app.updateMenus();
  };

  app.currentPage = function () {
    var p = app.project;
    if (!p) return null;
    var doc = app.activeDoc();
    if (doc && doc.page) return doc.page;
    return p.pages.filter(function (x) { return x.id === app.curPageId; })[0] || p.pages[0];
  };
  app.activeDesigner = function () {
    var d = app.activeDoc();
    return d && d.kind === 'design' ? d.component : null;
  };

  /* ---------------- the start page ---------------- */

  app.openStart = function () {
    app.addDoc({
      key: 'start', kind: 'start', title: W.t('doc.start'), icon: 'home', closable: true,
      create: function (doc) { doc.component = { el: h('div.start') }; doc.host.appendChild(doc.component.el); app.renderStart(); },
      onShow: function () { app.renderStart(); }
    });
  };
  app.renderStart = function () {
    var doc = app.findDoc('start');
    if (!doc) return;
    var el = doc.component.el;
    U.clear(el);
    var lang = W.i18n.lang;
    var hero = h('div.start-hero',
      h('div.start-mark', { html: W.icons.logo(64) }),
      h('div', h('h1', W.t('start.title')), h('p.lead', W.t('start.lead'))));
    el.appendChild(hero);
    var cols = h('div.start-cols');
    var left = h('div.start-left');
    var right = h('div.start-right');
    cols.appendChild(left);
    cols.appendChild(right);
    el.appendChild(cols);
    left.appendChild(h('h2', W.t('start.new')));
    var grid = h('div.tpl-grid');
    W.templates.order.forEach(function (id) {
      var t = W.templates.list[id];
      var card = h('button.tpl-card', { type: 'button', onclick: function () { app.newProject(id); } },
        h('div.tpl-thumb'),
        h('div.tpl-info', h('b', W.t('tpl.' + id)), h('span', W.t('tpl.' + id + '.d'))));
      grid.appendChild(card);
      // a small live picture of the template
      setTimeout(function () {
        try {
          var proj = W.templates.make(id, lang === 'ro' ? 'ro' : 'en');
          var pg = proj.pages[0];
          var ctx = W.build.context(proj, pg, { assetUrl: function (a) { return a.data; } });
          var html = '<!doctype html><html><head><meta charset="utf-8"><style>' + W.build.themeVars(proj) + W.build.BASE_CSS + W.build.pageCss(proj, pg, ctx) +
            ' body{overflow:hidden;pointer-events:none} .wz-NavBar{position:static!important}</style></head><body class="wz-site">' + W.build.bodyHtml(proj, pg, ctx) + '<script>' + 'document.querySelectorAll(".wz-free").forEach(function(e){var i=e.firstElementChild,w=+e.dataset.dw,s=Math.min(1,e.parentElement.clientWidth/w);i.style.transform="scale("+s+")";e.style.height=(+e.dataset.dh*s)+"px"});' + '</' + 'script></body></html>';
          var fr = h('iframe', { tabindex: '-1', 'aria-hidden': 'true', title: '' });
          fr.setAttribute('sandbox', 'allow-scripts');
          fr.srcdoc = html;
          U.$('.tpl-thumb', card).appendChild(fr);
        } catch (e) { /* no picture */ }
      }, 30);
      void t;
    });
    left.appendChild(grid);
    // recent projects
    right.appendChild(h('h2', W.t('start.recent')));
    var list = h('div.recent');
    right.appendChild(list);
    W.store.listProjects().then(function (items) {
      if (!items || !items.length) { list.appendChild(h('p.muted', W.t('start.noRecent'))); return; }
      items.slice(0, 12).forEach(function (it) {
        var row = h('div.recent-row',
          h('button.recent-open', { type: 'button', onclick: function () { app.openProjectId(it.id); } },
            h('span.ic-wrap', { html: W.icons.svg('site') }),
            h('span.recent-name', it.name),
            h('span.muted', fmtDate(it.modified))),
          h('button.tb-btn', { type: 'button', title: W.t('cmd.delete'), 'aria-label': W.t('cmd.delete') + ' ' + it.name, html: W.icons.svg('trash'),
            onclick: function () { app.deleteProject(it); } }));
        list.appendChild(row);
      });
    }, function () { list.appendChild(h('p.muted', W.t('start.noRecent'))); });
    right.appendChild(h('div.start-actions',
      h('button.btn', { type: 'button', onclick: function () { app.cmd('openFile'); } }, h('span.ic-wrap', { html: W.icons.svg('folder') }), W.t('cmd.openFile')),
      h('button.btn', { type: 'button', onclick: function () { app.openHelp('start'); } }, h('span.ic-wrap', { html: W.icons.svg('book') }), W.t('help.s.start'))));
    var where = W.store.mode === 'server' ? W.t('start.whereServer') : W.t('start.whereBrowser');
    right.appendChild(h('p.start-note', where));
    if (W.store.mode !== 'server' && location.protocol === 'file:') right.appendChild(h('p.start-note', W.t('start.phpHint')));
  };
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString(W.i18n.lang === 'ro' ? 'ro-RO' : 'en-GB', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString(W.i18n.lang === 'ro' ? 'ro-RO' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  /* ---------------- designer, code, database, lab, help, run ---------------- */

  app.openDesigner = function (page) {
    if (!page) return;
    var key = 'design:' + page.id;
    var ex = app.findDoc(key);
    if (ex) { app.activate(key); return ex; }
    return app.addDoc({
      key: key, kind: 'design', page: page, ref: page.id, title: page.name + ' [' + W.t('doc.design') + ']', icon: 'design',
      create: function (doc) { doc.component = new W.Designer(app, doc.host); doc.component.show(page); },
      onShow: function (doc) { doc.component.show(doc.page); doc.component.drawOverlay(); }
    });
  };

  app.openCode = function (page) {
    var key = 'code:' + (page ? page.id : 'site');
    var ex = app.findDoc(key);
    if (ex) { app.activate(key); return ex; }
    return app.addDoc({
      key: key, kind: 'code', page: page, ref: page ? page.id : 'site', title: page ? page.name + '.wz' : W.t('ex.siteCodeShort'), icon: 'code',
      create: function (doc) {
        var wrap = h('div.codedoc');
        var info = h('div.code-info');
        doc.host.appendChild(wrap);
        wrap.appendChild(info);
        var edHost = h('div.code-ed');
        wrap.appendChild(edHost);
        doc.info = info;
        doc.component = new W.Editor(edHost, {
          language: 'wz',
          label: doc.title,
          vocab: function () { return P.vocab(app.project); },
          highlightContext: function () { return app.highlightContext(doc.page); },
          complete: function (c) { return app.complete(doc.page, c); },
          signature: function (name, i, isMethod) { return app.signature(doc.page, name, i, isMethod); },
          hover: function (word, at) { return app.hover(doc.page, word, at); },
          onChange: function (v) {
            if (doc.page) doc.page.code = v; else app.project.siteCode = v;
            app.codeChanged();
          },
          onCaret: function (c) { app.statusCaret.textContent = W.t('status.caret', c.line + 1, c.col + 1); }
        });
        doc.component.setValue(page ? page.code : app.project.siteCode);
        app.renderCodeInfo(doc);
      },
      onShow: function (doc) {
        var want = doc.page ? doc.page.code : app.project.siteCode;
        if (doc.component.getValue() !== want) doc.component.setValue(want, true);
        doc.component.refresh();
        app.applyMarkers();
        app.renderCodeInfo(doc);
        setTimeout(function () { doc.component.focus(); }, 0);
      }
    });
  };
  app.renderCodeInfo = function (doc) {
    if (!doc.info) return;
    U.clear(doc.info);
    var vocab = P.vocab(app.project);
    if (doc.page) {
      doc.info.appendChild(h('span', W.t('code.pageInfo', doc.page.name)));
    } else {
      doc.info.appendChild(h('span', W.t('code.siteInfo')));
    }
    doc.info.appendChild(h('span.grow'));
    var add = h('select.tb-select.small', { 'aria-label': W.t('code.insert'), onchange: function () {
      var v = add.value;
      add.value = '';
      if (v) app.insertSnippet(doc, v);
    } }, h('option', { value: '' }, W.t('code.insert')));
    app.snippets(vocab).forEach(function (s, i) { add.appendChild(h('option', { value: String(i) }, s.label)); });
    doc.info.appendChild(add);
    doc.info.appendChild(h('button.tb-btn.text', { type: 'button', title: W.t('cmd.format') + ' (Shift+Alt+F)', onclick: function () { doc.component.format(); } },
      h('span.ic-wrap', { html: W.icons.svg('format') }), h('span', W.t('code.format'))));
    doc.info.appendChild(h('button.tb-btn.text', { type: 'button', title: W.t('help.s.language') + ' (F1)', onclick: function () { app.openHelp('language'); } },
      h('span.ic-wrap', { html: W.icons.svg('book') }), h('span', W.t('code.reference'))));
  };
  app.insertSnippet = function (doc, index) {
    var s = app.snippets(P.vocab(app.project))[+index];
    if (!s) return;
    var ed = doc.component;
    ed.focus();
    var v = ed.getValue(), p = ed.ta.selectionStart;
    var ls = v.lastIndexOf('\n', p - 1) + 1;
    var line = v.slice(ls, v.indexOf('\n', p) < 0 ? v.length : v.indexOf('\n', p));
    if (line.trim()) { ed.ta.setSelectionRange(ls + line.length, ls + line.length); ed.insert('\n' + /^ */.exec(line)[0]); }
    var at = ed.ta.selectionStart;
    ed.snippet(at, at, s.insert);
  };

  app.openDatabase = function (table) {
    var doc = app.addDoc({
      key: 'db', kind: 'db', ref: table ? table.id : null, title: W.t('doc.database'), icon: 'database',
      create: function (d) { d.component = new W.DbDesigner(app, d.host); },
      onShow: function (d) { d.component.show(null); }
    });
    if (table) { doc.ref = table.id; doc.component.show(table); }
    app.explorer.render();
    return doc;
  };
  app.openLab = function () {
    return app.addDoc({
      key: 'lab', kind: 'lab', title: W.t('doc.lab'), icon: 'lab',
      create: function (d) { d.component = new W.Lab(app, d.host); d.component.render(); },
      onShow: function (d) { d.component.render(); }
    });
  };
  app.openHelp = function (section) {
    var doc = app.addDoc({
      key: 'help', kind: 'help', title: W.t('doc.help'), icon: 'book',
      create: function (d) { d.component = new W.Help(app, d.host); },
      onShow: function (d) { d.component.render(); }
    });
    if (section) { doc.component.section = section; doc.component.render(); }
    return doc;
  };
  app.openRun = function () {
    return app.addDoc({
      key: 'run', kind: 'run', title: W.t('doc.run'), icon: 'run',
      create: function (d) { d.component = new W.Runner(app, d.host); },
      onClose: function (d) { d.component.stop(); app.running = false; app.updateMenus(); app.status(W.t('status.ready')); document.body.classList.remove('running'); }
    });
  };

  /* =====================================================================
   * Projects
   * ===================================================================== */

  app.load = function (p, quiet) {
    P.normalize(p);
    var added = P.loadEmbeddedPacks(p);
    if (added.length && !quiet) U.toast(W.t('lab.loadedFromProject', added.join(', ')));
    // close the documents of the old project
    app.docs.slice().forEach(function (d) { if (d.kind !== 'start' && d.kind !== 'help' && d.kind !== 'lab') app.closeDoc(d.key); });
    app.project = p;
    W.history.reset(p);
    app.selection = null;
    app.curPageId = p.pages[0].id;
    app.dirty = false;
    W.build.clearCache();
    W.store.setSetting('lastProject', p.id);
    app.titleText.textContent = p.name;
    document.title = p.name + ' - Wemazy';
    app.openDesigner(p.pages[0]);
    app.recompile(true);
    app.explorer.render();
    app.updateMenus();
    app.updateStatusbar();
    app.outputPanel.write(W.t('out.opened', p.name), 'info');
  };
  app.openProjectId = function (id) {
    W.store.loadProject(id).then(function (p) {
      if (!p) { U.toast(W.t('err.notFound'), 'bad'); return; }
      app.load(p);
    }, function (e) { U.alert(W.t('cmd.openProject'), e.message); });
  };
  app.deleteProject = function (it) {
    U.confirm(W.t('cmd.deleteProject'), W.t('confirm.deleteProject', it.name), W.t('cmd.delete'), true).then(function (ok) {
      if (!ok) return;
      W.store.deleteProject(it.id).then(function () {
        if (app.project && app.project.id === it.id) app.closeProject(true);
        app.renderStart();
      });
    });
  };
  app.newProject = function (template) {
    var name = h('input.input', { type: 'text', value: W.t('tpl.' + (template || 'blank')), autofocus: true, spellcheck: false });
    var tplSel = h('select.input');
    W.templates.order.forEach(function (id) { tplSel.appendChild(h('option', { value: id }, W.t('tpl.' + id))); });
    tplSel.value = template || 'blank';
    tplSel.addEventListener('change', function () { name.value = W.t('tpl.' + tplSel.value); });
    var lang = h('select.input', h('option', { value: 'en' }, 'English'), h('option', { value: 'ro' }, 'Română'));
    lang.value = W.i18n.lang === 'ro' ? 'ro' : 'en';
    U.dialog({
      title: W.t('cmd.newProject'), width: 440,
      body: h('div.form', h('label.wd-label', W.t('new.name'), name), h('label.wd-label', W.t('new.template'), tplSel),
        h('label.wd-label', W.t('new.siteLang'), lang), h('p.wd-hint', W.t('new.siteLangHint'))),
      buttons: [{ label: W.t('common.cancel'), value: null }, { label: W.t('new.create'), primary: true, value: 'ok' }]
    }).then(function (v) {
      if (v !== 'ok') return;
      var p = W.templates.make(tplSel.value, lang.value, name.value.trim() || W.t('tpl.blank'));
      p.name = name.value.trim() || p.name;
      app.load(p);
      app.dirty = true;
      app.saveNow();
      if (tplSel.value !== 'blank') U.toast(W.t('new.tip'));
    });
  };
  app.closeProject = function (skipSave) {
    if (!app.project) return;
    if (!skipSave) app.saveNow();
    app.docs.slice().forEach(function (d) { if (d.kind !== 'start' && d.kind !== 'help') app.closeDoc(d.key); });
    app.project = null;
    app.selection = null;
    W.store.setSetting('lastProject', null);
    app.titleText.textContent = '';
    document.title = 'Wemazy';
    app.props.show(null, null);
    app.explorer.render();
    app.errors.set([], []);
    app.openStart();
    app.updateMenus();
    app.updateStatusbar();
  };

  /* ---------------- saving ---------------- */

  app.scheduleSave = U.debounce(function () { app.saveNow(); }, 1200);
  app.saveNow = function () {
    var p = app.project;
    if (!p || !app.dirty) return Promise.resolve();
    app.dirty = false;
    P.embedPacks(p);
    app.status(W.t('status.saving'));
    return W.store.saveProject(p).then(function () {
      app.status(W.t('status.saved'));
      app.updateStatusbar();
    }, function (e) {
      app.dirty = true;
      var msg = /quota|full|space/i.test(String(e && (e.name + e.message))) ? W.t('err.storageFull') : W.t('err.saveFailed', e && e.message);
      app.status(msg);
      U.toast(msg, 'bad', 6000);
    });
  };

  /* =====================================================================
   * Changes
   * ===================================================================== */

  /** A change of the design (undo step). */
  app.changed = function (label) {
    if (!app.project) return;
    W.history.commit(label);
    app.afterChange();
  };
  /** A change while typing or dragging: show it, no undo step yet. */
  app.changedLive = function () {
    app.renderDesigners();
    app.dirty = true;
    app.scheduleSave();
  };
  app.afterChange = function (fromUndo) {
    app.dirty = true;
    app.scheduleSave();
    // the selection may be gone (undo, delete)
    if (app.selection) {
      var pg = app.project.pages.filter(function (x) { return x.id === app.selection.pageId; })[0];
      if (!pg || !P.find(pg, app.selection.id)) app.selection = pg ? { pageId: pg.id, id: 'root' } : null;
    }
    // pages may be gone or renamed
    app.docs.slice().forEach(function (d) {
      if (d.page) {
        var pg2 = app.project.pages.filter(function (x) { return x.id === d.page.id; })[0];
        if (!pg2) { app.closeDoc(d.key); return; }
        d.page = pg2;
        d.title = d.kind === 'design' ? pg2.name + ' [' + W.t('doc.design') + ']' : pg2.name + '.wz';
      }
    });
    app.renderTabs();
    app.renderDesigners();
    var sel = app.selection;
    var spage = sel && app.project.pages.filter(function (x) { return x.id === sel.pageId; })[0];
    app.props.show(spage || app.currentPage(), sel ? sel.id : 'root');
    app.explorer.render();
    if (app.rightTab === 'outline') app.outline.render();
    var db = app.findDoc('db');
    if (db && db.component) db.component.render();
    var lab = app.findDoc('lab');
    if (lab && lab.component && app.active === 'lab') lab.component.render();
    app.recompile();
    app.updateMenus();
    void fromUndo;
  };
  app.renderDesigners = function () {
    app.docs.forEach(function (d) {
      if (d.kind !== 'design' || !d.component) return;
      d.component.page = d.page;
      d.component.render();
    });
  };
  app.codeChanged = function () {
    app.dirty = true;
    app.scheduleSave();
    app.recompileSoon();
  };
  app.recompileSoon = U.debounce(function () { app.recompile(); }, 350);

  /** Check all the code, show errors in the Error List and in the editors. */
  app.recompile = function (quiet) {
    var p = app.project;
    if (!p) return null;
    var r;
    try { r = W.build.compile(p, false); } catch (e) {
      console.error(e);
      app.outputPanel.write('Compiler: ' + e.message, 'error');
      return null;
    }
    app.lastCompile = r;
    app.showErrors(r);
    if (app.bottomTab === 'translation') app.translation.render();
    // keep highlighting of names fresh
    app.docs.forEach(function (d) { if (d.kind === 'code' && d.component && d.key === app.active) d.component.refresh(); });
    void quiet;
    return r;
  };
  app.showErrors = function (r) {
    app.compileErrors = r.errors;
    app.compileWarnings = r.warnings;
    app.errors.set(r.errors, r.warnings, app.runtimeErrs);
    var n = r.errors.length + app.runtimeErrs.length, w = r.warnings.length;
    app.bottomTabs.errors.btn.querySelector('.ptab-count').textContent = n ? String(n) : '';
    app.statusErr.innerHTML = W.icons.svg(n ? 'error' : 'check') + ' ' + U.esc(n ? W.t('status.errors', n) : W.t('status.noErrors')) + (w ? ' · ' + U.esc(W.t('status.warnings', w)) : '');
    app.statusErr.classList.toggle('bad', n > 0);
    app.applyMarkers();
  };
  app.runtimeErrors = function (list) {
    app.runtimeErrs = list.slice(-20);
    if (app.lastCompile) app.showErrors(app.lastCompile);
    if (list.length) { app.showBottom('errors'); }
  };
  app.applyMarkers = function () {
    var errs = (app.compileErrors || []).map(function (e) { return Object.assign({ kind: 'error' }, e); })
      .concat((app.compileWarnings || []).map(function (e) { return Object.assign({ kind: 'warning', len: 1 }, e); }))
      .concat((app.runtimeErrs || []).map(function (e) { return Object.assign({ kind: 'error', len: 200, col: 1 }, e); }));
    app.docs.forEach(function (d) {
      if (d.kind !== 'code' || !d.component) return;
      var file = d.page ? d.page.name : 'Site';
      d.component.setMarkers(errs.filter(function (e) { return e.file === file; }));
    });
  };

  /* =====================================================================
   * Selection, adding controls, events
   * ===================================================================== */

  app.select = function (page, id) {
    if (!page) return;
    app.selection = { pageId: page.id, id: id || 'root' };
    app.curPageId = page.id;
    app.props.show(page, app.selection.id);
    app.docs.forEach(function (d) { if (d.kind === 'design' && d.component && d.page === page) { d.component.drawOverlay(); d.component.drawCrumbs(); } });
    if (app.rightTab === 'outline') app.outline.render();
  };

  /** Toolbox double-click: add the control into the selected container (or after the selected control). */
  app.addControl = function (type) {
    var p = app.project;
    if (!p) return;
    var page = app.currentPage();
    app.openDesigner(page);
    var sel = app.selection && app.selection.pageId === page.id ? P.find(page, app.selection.id) : null;
    var el = P.newElement(p, page, type);
    var parent = page.root, index = page.root.children.length;
    if (sel) {
      var s = sel.el;
      if (s === page.root || (C.isContainer(s) && s.type !== 'Columns')) { parent = s; index = s.children.length; }
      else if (s.type === 'Columns') { parent = s.children[0]; index = parent.children.length; }
      else if (sel.parent) { parent = sel.parent; index = sel.index + 1; }
    } else {
      // into the first section of the page
      var sec = page.root.children.filter(function (x) { return x.type === 'Section'; })[0];
      if (sec) { parent = sec; index = sec.children.length; }
    }
    if (parent.props && parent.props.layout === 'free') {
      el.props.x = 16 + 8 * (parent.children.length % 10);
      el.props.y = 16 + 8 * (parent.children.length % 10);
      var size = { Button: [120, 44], TextBox: [240, 44], Heading: [320, 48], Text: [320, 60], Image: [200, 140] }[el.type];
      if (size) { el.props.width = size[0]; if (el.type !== 'Text' && el.type !== 'Heading') el.props.height = size[1]; }
    }
    parent.children.splice(index, 0, el);
    app.changed(W.t('undo.add', W.t('ctl.' + el.type)));
    app.select(page, el.id);
  };

  app.handlersOf = function (page) {
    var r = app.lastCompile || W.build.compile(app.project, false);
    var info = r.info[page.name];
    return info ? info.handlers : [];
  };

  /** Open the code of an event, writing a new "when ... { }" if there is none. */
  app.goToEvent = function (page, el, eventKey) {
    var p = app.project;
    var vocab = P.vocab(p);
    var r = W.build.compile(p, false);
    var info = r.info[page.name] || { handlers: [] };
    var hd = info.handlers.filter(function (x) {
      if (!el) return x.ev && x.ev.kind === 'load';
      return x.ev && x.ev.kind === 'control' && L.norm(x.ev.name) === L.norm(el.name) && x.ev.event === eventKey;
    })[0];
    var doc = app.openCode(page);
    var ed = doc.component;
    if (hd) {
      var lines = page.code.split('\n');
      var line = hd.line;
      // first line inside the handler (after a { alone on its line, too)
      var target = Math.min(lines.length, line + ((lines[line] || '').trim() === '{' ? 2 : 1));
      ed.reveal(target, (lines[target - 1] || '').length + 1);
      return;
    }
    var snippet = el ? L.handlerSnippet(el.name, eventKey, vocab) : L.loadSnippet(vocab);
    var code = page.code.replace(/\s+$/, '');
    var prefix = code ? code + '\n\n' : '';
    page.code = prefix + snippet + '\n';
    ed.setValue(page.code, true);
    var lineNo = prefix.split('\n').length + 1;
    ed.reveal(lineNo, 5);
    app.codeChanged();
    app.outputPanel.write(W.t('out.newHandler', el ? el.name : page.name), 'info');
  };

  app.goToLine = function (file, line, col, len) {
    var p = app.project;
    if (!p) return;
    var page = file === 'Site' ? null : P.pageByName(p, file);
    if (file !== 'Site' && !page) return;
    var doc = app.openCode(page);
    setTimeout(function () { doc.component.reveal(line || 1, col || 1, len || 0); }, 0);
  };

  /* ---------------- right-click menu of a control ---------------- */

  app.contextMenu = function (page, id, x, y) {
    var f = P.find(page, id);
    if (!f) return;
    var el = f.el, isRoot = el === page.root;
    var def = C.get(el.type) || {};
    var free = f.parent && f.parent.props && f.parent.props.layout === 'free';
    var items = [];
    if (def.inline) items.push({ label: W.t('ctx.editText'), icon: 'rename', key: 'Enter', action: function () { var d = app.activeDesigner(); if (d) d.startEdit(el); } });
    if (!isRoot && def.events && Object.keys(def.events).length) {
      items.push({ label: W.t('ctx.viewCode'), icon: 'code', key: 'F7', action: function () { app.goToEvent(page, el, def.defaultEvent || Object.keys(def.events)[0]); } });
      items.push({ label: W.t('ctx.events'), icon: 'events', action: function () { app.props.setMode('events'); app.togglePanel('props', true); } });
    }
    if (isRoot) items.push({ label: W.t('ctx.pageCode'), icon: 'code', key: 'F7', action: function () { app.openCode(page); } });
    if (items.length) items.push({ sep: true });
    items.push({ label: W.t('cmd.cut'), icon: 'cut', key: MOD + 'X', disabled: isRoot || el.type === 'Column', action: function () { app.cmd('cut'); } });
    items.push({ label: W.t('cmd.copy'), icon: 'copy', key: MOD + 'C', disabled: isRoot || el.type === 'Column', action: function () { app.cmd('copy'); } });
    items.push({ label: W.t('cmd.paste'), icon: 'paste', key: MOD + 'V', disabled: !app.clipboard, action: function () { app.cmd('paste'); } });
    items.push({ label: W.t('cmd.duplicate'), icon: 'duplicate', key: MOD + 'D', disabled: isRoot || el.type === 'Column', action: function () { app.cmd('duplicate'); } });
    items.push({ label: W.t('cmd.delete'), icon: 'trash', key: 'Del', disabled: isRoot || el.type === 'Column', action: function () { app.cmd('delete'); } });
    items.push({ sep: true });
    if (!isRoot && el.type !== 'Column') {
      if (free) {
        items.push({ label: W.t('ctx.front'), icon: 'front', action: function () { app.cmd('bringFront'); } });
        items.push({ label: W.t('ctx.back'), icon: 'back', action: function () { app.cmd('sendBack'); } });
      } else {
        items.push({ label: W.t('ctx.moveUp'), icon: 'up', disabled: f.index === 0, action: function () { app.cmd('moveUp'); } });
        items.push({ label: W.t('ctx.moveDown'), icon: 'down', disabled: f.index >= f.parent.children.length - 1, action: function () { app.cmd('moveDown'); } });
        items.push({ label: W.t('ctx.wrap'), icon: 'c-panel', action: function () { app.cmd('wrapPanel'); } });
      }
    }
    if (f.parent) items.push({ label: W.t('ctx.selectParent'), key: 'Esc', action: function () { app.select(page, f.parent.id); } });
    items.push({ label: W.t('cmd.properties'), icon: 'props', key: 'F4', action: function () { app.togglePanel('props', true); app.props.setMode('props'); } });
    U.menu(items, x, y);
  };

  /* =====================================================================
   * IntelliSense
   * ===================================================================== */

  app.highlightContext = function (page) {
    var p = app.project;
    var ctx = { vocab: P.vocab(p), controls: {}, tables: {}, functions: {}, types: {} };
    if (page) P.controlsOf(page).forEach(function (c) { ctx.controls[L.norm(c.name)] = 1; });
    p.tables.forEach(function (t) { ctx.tables[L.norm(t.name)] = 1; });
    C.list.forEach(function (c) { if (!c.toolboxOnly) ctx.types[L.norm(c.type)] = 1; });
    ctx.types.control = 1;
    var r = app.lastCompile;
    if (r) Object.keys(r.info).forEach(function (f) {
      (r.info[f].functions || []).forEach(function (fn) { ctx.functions[L.norm(fn.name)] = 1; });
      (r.info[f].types || []).forEach(function (t) { ctx.types[L.norm(t.name)] = 1; });
    });
    return ctx;
  };

  /** The types the code can use: the built-in ones, the kinds of controls, the structs and classes of the project. */
  app.typeItems = function (page, r) {
    var items = [], file = page ? page.name : 'Site';
    var builtin = [['int32', W.t('ty.int32')], ['int64', W.t('ty.int64')], ['int8', W.t('ty.int8')], ['int16', W.t('ty.int16')],
      ['float64', W.t('ty.float64')], ['float32', W.t('ty.float32')], ['float16', W.t('ty.float16')],
      ['bool', W.t('ty.bool')], ['char', W.t('ty.char')], ['string', W.t('ty.string')]];
    builtin.forEach(function (b) { items.push({ label: b[0], kind: 'type', detail: b[1] }); });
    items.push({ label: 'unsigned', kind: 'kw', detail: W.t('ty.unsigned') });
    Object.keys(r.info).forEach(function (f) {
      if (f !== 'Site' && f !== file) return;
      (r.info[f].types || []).forEach(function (t) {
        items.push({ label: t.name, kind: 'type', detail: W.t('ty.' + t.kind), doc: U.esc(typeSummary(t)) });
      });
    });
    C.list.forEach(function (c) { if (!c.toolboxOnly && c.type !== 'Column') items.push({ label: c.type, kind: 'type', detail: W.t('ty.control') + ' - ' + W.t('ctl.' + c.type) }); });
    items.push({ label: 'Control', kind: 'type', detail: W.t('ty.anyControl') });
    return items;
  };
  function typeSummary(t) {
    var head = t.kind + ' ' + t.name + (t.base ? ' : ' + t.base : '') + (t.ifaces && t.ifaces.length ? (t.base ? ', ' : ' : ') + t.ifaces.join(', ') : '');
    var lines = t.members.filter(function (m) { return m.access !== 'private'; }).slice(0, 12).map(function (m) {
      return '  ' + (m.isStatic ? 'static ' : '') + (m.ty ? L.showType(m.ty) + ' ' : '') + m.name + (m.kind === 'method' ? '(' + (m.params || []).join(', ') + ')' : '');
    });
    return head + '\n' + lines.join('\n');
  }
  /** The type (int32, C:Dog, G:Button...) of a name at a line of a file, from the last compile. */
  app.typeOfName = function (page, r, name, line) {
    var file = page ? page.name : 'Site', n = L.norm(name);
    var info = r.info[file];
    if (!info) return null;
    var found = null;
    function look(scope) {
      if (!scope || !scope.varTypes) return;
      Object.keys(scope.varTypes).forEach(function (k) { if (L.norm(k) === n) found = scope.varTypes[k]; });
    }
    (info.functions || []).concat(info.handlers || []).forEach(function (fn) { if (line >= fn.line && line <= fn.endLine) look(fn); });
    (info.types || []).forEach(function (t) {
      (t.methods || []).forEach(function (m) { if (line >= m.line && line <= m.endLine) look(m); });
      if (!found && line >= t.line && line <= t.endLine) {
        // inside a class: its fields by name
        t.members.forEach(function (m) { if (m.kind === 'field' && L.norm(m.name) === n && m.ty) found = m.ty; });
      }
    });
    if (!found) look(info);
    if (!found && r.info.Site && file !== 'Site') look(r.info.Site);
    return found;
  };
  /** Members of an object of a class (or of a struct), for the list after a dot. */
  app.memberItems = function (r, typeName, push, statics, inside) {
    var all = [];
    Object.keys(r.info).forEach(function (f) { all = all.concat(r.info[f].types || []); });
    var ui = W.i18n.lang;
    L.membersOf(all, typeName).forEach(function (m) {
      if (statics !== undefined && !!m.isStatic !== statics) return;
      // private members only inside their class; protected ones inside the class and the classes that inherit
      if (m.access === 'private' && !(inside && L.norm(inside) === L.norm(m.owner))) return;
      if (m.access === 'protected' && !inside) return;
      var det = (m.isStatic ? 'static ' : '') + (m.ty ? L.showType(m.ty) : '') + (m.access !== 'public' ? ' (' + m.access + ')' : '');
      if (m.kind === 'method') {
        var ps = m.params || [];
        push(m.name, 'fn', det, { insert: m.name + '(' + (ps.length ? '${1:' + ps.join(', ') + '}' : '') + ')$0', snippet: true,
          doc: '<b>' + U.esc((m.ty ? L.showType(m.ty) + ' ' : '') + m.name + '(' + ps.map(function (q, i) { return (m.ptypes && m.ptypes[i] ? L.showType(m.ptypes[i]) + ' ' : '') + q; }).join(', ') + ')</b><br>' + U.esc(W.t('ac.methodOf') + ' ' + m.owner)) });
      } else {
        push(m.name, 'prop', det, { doc: U.esc(W.t('ac.fieldOf') + ' ' + m.owner + (m.konst ? ' (const)' : '')) });
      }
    });
    void ui;
  };
  /** Properties, commands and events of a kind of control (Button, TextBox...), after obj. */
  app.controlClassItems = function (v, typeName, push) {
    var lang = 'en', ui = W.i18n.lang;
    var def = C.get(typeName);
    var keys;
    if (def) keys = Object.keys(def.code || {});
    else {
      // Control: what every control has
      keys = null;
      C.list.forEach(function (c) {
        if (c.toolboxOnly || !c.code) return;
        var k = Object.keys(c.code);
        keys = keys ? keys.filter(function (x) { return k.indexOf(x) >= 0; }) : k;
      });
      keys = keys || [];
    }
    push('name', 'prop', W.t('ac.ctlName'));
    keys.forEach(function (k) { push(v.say('prop.' + k, lang), 'prop', W.t('prop.' + k) !== 'prop.' + k ? W.t('prop.' + k) : '', { doc: U.esc(W.t('cpdesc.' + k)) }); });
    Object.keys(v.cmdMethods).forEach(function (mn) {
      var d = v.cmdMethods[mn], name = [].concat(d.method)[0];
      if (L.norm(name) !== mn) return;
      var c0 = v.cmdFirst[d.id], args = c0 ? c0.parts.filter(function (x) { return x.slot && x.kind !== 'control' && x.kind !== 'target'; }).map(function (x) { return x.slot; }) : [];
      push(name, 'fn', W.t('ac.command'), { insert: name + '(' + (args.length ? '${1:' + args.join(', ') + '}' : '') + ')$0', snippet: true, doc: U.esc(d.doc[ui] || d.doc.en || '') });
    });
    var evs = def ? Object.keys(def.events || {}) : ['click'];
    evs.forEach(function (k) { push(v.say('ev.' + k, lang), 'ev', W.t('ac.event'), { insert: v.say('ev.' + k, lang) + ' += ${1:functionName}$0', snippet: true, doc: U.esc(W.t('evdesc.' + k)) }); });
    if (/^(Panel|Card|Section|Column)$/.test(typeName)) {
      push('add', 'fn', W.t('ac.command'), { insert: 'add(${1:control})$0', snippet: true, doc: U.esc(W.t('ac.panelAdd')) });
      push('remove', 'fn', W.t('ac.command'), { insert: 'remove(${1:control})$0', snippet: true, doc: U.esc(W.t('ac.panelRemove')) });
    }
  };

  /** Snippets of whole statements (in the C-like way: { } blocks). */
  app.snippets = function (v) {
    var s = function (k) { return v.say(k); };
    var tb = app.project && app.project.tables[0] ? app.project.tables[0].name : 'Table';
    return [
      { label: 'if (…) { }', insert: 'if (${1:x > 0}) {\n    $0\n}' },
      { label: 'if (…) { } else { }', insert: 'if (${1:x > 0}) {\n    $0\n} else {\n    \n}' },
      { label: 'switch (…) { case … }', insert: 'switch (${1:x}) {\n    case 1:\n        $0\n    default:\n        \n}' },
      { label: 'for (var i = 1; i <= 10; i++) { }', insert: 'for (var ${1:i} = 1; i <= 10; i++) {\n    $0\n}' },
      { label: 'foreach (var item in list) { }', insert: 'foreach (var ${1:item} in list) {\n    $0\n}' },
      { label: 'while (…) { }', insert: 'while (${1:x < 10}) {\n    $0\n}' },
      { label: s('repeat') + ' 3 ' + s('times') + ' { }', insert: s('repeat') + ' ${1:3} ' + s('times') + ' {\n    $0\n}' },
      { label: 'function name() { }', insert: 'function ${1:name}() {\n    $0\n}' },
      { label: 'server function name() { }', insert: 'server function ${1:name}() {\n    $0\n}' },
      { label: s('when') + ' Button1 ' + s('ev.click') + ' { }', insert: s('when') + ' ${1:Button1} ' + s('ev.click') + ' {\n    $0\n}' },
      { label: s('when') + ' ' + s('pageloads') + ' { }', insert: s('when') + ' ' + s('pageloads') + ' {\n    $0\n}' },
      { label: s('every') + ' 1 ' + s('seconds') + ' { }', insert: s('every') + ' ${1:1} ' + s('seconds') + ' {\n    $0\n}' },
      { label: 'try { } catch (e) { }', insert: 'try {\n    $0\n} catch (e) {\n    message("Something went wrong: " + e)\n}' },
      { label: 'var name = …', insert: 'var ${1:name} = $0' },
      { label: 'var int32 name = …', insert: 'var int32 ${1:name} = ${2:0}$0' },
      { label: 'const int32 NAME = …', insert: 'const int32 ${1:NAME} = ${2:0}$0' },
      { label: 'struct Name { … }', insert: 'struct ${1:Point} {\n    int32 ${2:x};\n    int32 ${3:y};\n}$0' },
      { label: 'class Name { … }', insert: 'class ${1:Dog} {\n    public string ${2:name};\n\n    public ${1:Dog}(string ${2:name}) {\n        this.${2:name} = ${2:name};\n    }\n\n    public void ${3:speak}() {\n        $0\n    }\n}' },
      { label: 'class Name : Base { … }', insert: 'class ${1:Dog} : ${2:Animal} {\n    public ${1:Dog}() : base() {\n        $0\n    }\n}' },
      { label: 'interface IName { … }', insert: 'interface ${1:IShape} {\n    ${2:float64} ${3:area}();\n}$0' },
      { label: 'var obj = new Class(…)', insert: 'var ${1:dog} = new ${2:Dog}($0)' },
      { label: 'Button b = new Button()', insert: 'Button ${1:b} = new Button();\n${1:b}.text = ${2:"Click"};\n${3:Panel1}.add(${1:b});$0' },
      { label: 'message("…")', insert: 'message(${1:"Hello!"})$0' },
      { label: 'var answer = ask("…")', insert: 'var ${1:answer} = ask("What is your name?")$0' },
      { label: 'goTo("…")', insert: 'goTo(${1:"Home"})$0' },
      { label: 'var rows = find all ' + tb + ' where …', insert: 'var ${1:rows} = find all ' + tb + ' where $0' },
      { label: s('print') + ' …', insert: s('print') + ' ${1:value}$0' }
    ];
  };

  /** What can come after "x." when x is a value (text, number, list, record). */
  app.valueMethods = function (v) {
    var out = [], seen = {};
    var lang = 'en', ui = W.i18n.lang;
    Object.keys(v.funcDefs).forEach(function (id) {
      var d = v.funcDefs[id];
      var ps = (d.paramNames && d.paramNames[lang]) || d.params || [];
      if (!ps.length || d.group === 'server' || d.group === 'time' && id !== 'adddays') return;
      var name = d.methods && d.methods[0] ? d.methods[0] : L.fnName(d, lang);
      if (seen[name]) return;
      seen[name] = 1;
      var rest = ps.slice(1);
      var req = rest.filter(function (x) { return !/\?$/.test(x) && !/^\.\.\./.test(x); });
      out.push({ label: name, kind: 'fn', detail: d.group ? W.t('help.fg.' + d.group) : '',
        insert: name + '(' + (req.length ? '${1:' + req.join(', ') + '}' : '') + ')$0', snippet: true,
        doc: '<b>' + U.esc('x.' + name + '(' + rest.join(', ') + ')') + '</b> = ' + U.esc(L.fnName(d, lang) + '(x' + (rest.length ? ', ' : '') + rest.join(', ') + ')') +
          '<br>' + U.esc(d.doc[ui] || d.doc.en || '') + (d.changes ? '<br><i>' + U.esc(W.t('ac.changes')) + '</i>' : '') });
    });
    out.push({ label: 'add', kind: 'fn', detail: W.t('help.fg.list'), insert: 'add(${1:item})$0', snippet: true, doc: U.esc(W.t('ac.mAdd')) });
    out.push({ label: 'remove', kind: 'fn', detail: W.t('help.fg.list'), insert: 'remove(${1:item})$0', snippet: true, doc: U.esc(W.t('ac.mRemove')) });
    out.push({ label: 'clear', kind: 'fn', detail: W.t('help.fg.list'), insert: 'clear()$0', snippet: true, doc: U.esc(W.t('ac.mClear')) });
    return out;
  };

  app.complete = function (page, c) {
    var p = app.project, v = P.vocab(p), lang = 'en', ui = W.i18n.lang;
    var items = [];
    // fresh information about names and types (the compile is cached, so this is cheap when nothing changed)
    var r = W.build.compile(p, false);
    app.lastCompile = r;
    var file = page ? page.name : 'Site';
    var info = r.info[file] || { globals: [], functions: [], handlers: [] };
    var push = function (label, kind, detail, extra) { items.push(Object.assign({ label: label, kind: kind, detail: detail || '' }, extra || {})); };
    var fnDoc = function (d) { return '<b>' + U.esc(L.fnName(d, lang)) + '(' + U.esc(((d.paramNames && d.paramNames[lang]) || d.params || []).join(', ')) + ')</b><br>' + U.esc(d.doc[ui] || d.doc.en || '') + (d.example && (d.example[lang] || d.example.en) ? '<pre>' + U.esc(d.example[lang] || d.example.en) + '</pre>' : ''); };
    var controls = page ? P.controlsOf(page) : [];
    // after a dot: properties and methods
    if (c.afterDot) {
      var on = L.norm(c.object || '');
      // a variable with a type: dog.name, b.text
      var vty = !c.chained && c.object ? app.typeOfName(page, r, c.object, c.line + 1) : null;
      var inType = null;
      (info.types || []).forEach(function (t) { if (c.line + 1 >= t.line && c.line + 1 <= t.endLine) inType = t; });
      if (vty && /^[CSU]:/.test(vty)) { app.memberItems(r, vty.slice(2), push, false, inType ? inType.name : null); return items; }
      if (vty && /^G:/.test(vty)) { app.controlClassItems(v, vty.slice(2), push); return items; }
      if (vty && /^L:/.test(vty)) { app.valueMethods(v).forEach(function (it) { items.push(it); }); push('length', 'prop', W.t('ac.lengthProp')); return items; }
      if (vty && (vty === 'string' || vty === 'char')) { app.valueMethods(v).forEach(function (it) { items.push(it); }); push('length', 'prop', W.t('ac.lengthProp')); return items; }
      if ((on === 'this' || on === 'base') && inType) {
        app.memberItems(r, on === 'base' && inType.base ? inType.base : inType.name, push, false, inType.name);
        return items;
      }
      // Dog.count: the static members of a class
      var ownType = null;
      Object.keys(r.info).forEach(function (f) { (r.info[f].types || []).forEach(function (t) { if (L.norm(t.name) === on) ownType = t; }); });
      if (!c.chained && ownType) { app.memberItems(r, ownType.name, push, true, inType ? inType.name : null); return items; }
      if (!c.chained && L.builtinTypes[on] && /^(u?int\d+|float\d+)$/.test(L.builtinTypes[on])) {
        push('MaxValue', 'prop', W.t('ac.maxValue')); push('MinValue', 'prop', W.t('ac.minValue'));
        if (/int/.test(L.builtinTypes[on])) push('parse', 'fn', W.t('ac.parse'), { insert: 'parse(${1:text})$0', snippet: true });
        return items;
      }
      var ctl = !c.chained && controls.filter(function (x) { return L.norm(x.name) === on; })[0];
      if (ctl) {
        var def = C.get(ctl.type) || {};
        var keys = Object.keys(def.code || {});
        if (def.defaultProp && keys.indexOf(def.defaultProp) > 0) keys = [def.defaultProp].concat(keys.filter(function (k) { return k !== def.defaultProp; }));
        keys.forEach(function (k) {
          push(v.say('prop.' + k, lang), 'prop', W.t('prop.' + k) !== 'prop.' + k ? W.t('prop.' + k) : '', { doc: U.esc(W.t('cpdesc.' + k)) });
        });
        // what the control can do: Panel1.show(), Player.move(10, 0)
        Object.keys(v.cmdMethods).forEach(function (mn) {
          var d = v.cmdMethods[mn];
          var name = [].concat(d.method)[0];
          if (L.norm(name) !== mn) return;
          var c0 = v.cmdFirst[d.id], args = c0 ? c0.parts.filter(function (x) { return x.slot && x.kind !== 'control' && x.kind !== 'target'; }).map(function (x) { return x.slot; }) : [];
          push(name, 'fn', W.t('ac.command'), { insert: name + '(' + (args.length ? '${1:' + args.join(', ') + '}' : '') + ')$0', snippet: true,
            doc: U.esc(d.doc[ui] || d.doc.en || '') + (d.example && d.example.en ? '<pre>' + U.esc(d.example.en) + '</pre>' : '') });
        });
        // lists of the page: List1.add("x"), List1.remove("x"), NameBox.clear()
        var hasItems = /^(List|Table|DropDown|RadioGroup)$/.test(ctl.type);
        var clears = hasItems || /^(TextBox|TextArea|CheckBox|ProgressBar|Text|Heading)$/.test(ctl.type);
        [['add', hasItems], ['remove', hasItems], ['clear', clears]].forEach(function (mm) {
          if (!mm[1]) return;
          var m = mm[0];
          push(m, 'fn', W.t('help.fg.list'), { insert: m + '(' + (m === 'clear' ? '' : '${1:item}') + ')$0', snippet: true, doc: U.esc(W.t('ac.m' + m.charAt(0).toUpperCase() + m.slice(1))) });
        });
        return items;
      }
      if (!c.chained && (v.phrases['obj.page'] || []).some(function (ph) { return ph[0] === on; })) {
        ['title', 'name', 'background', 'color'].forEach(function (k) { push(v.say('prop.' + k, lang), 'prop'); });
        return items;
      }
      var tb = !c.chained && p.tables.filter(function (t) { return L.norm(t.name) === on; })[0];
      if (tb) {
        ['id'].concat(tb.columns.map(function (x) { return x.name; })).forEach(function (n) { push(n, 'col', tb.name); });
        push('add', 'fn', W.t('ac.table'), { insert: 'add({${1:' + tb.columns.map(function (x) { return x.name + ': ' + (x.type === 'text' || x.type === 'longtext' ? '""' : '0'); }).join(', ') + '}})$0', snippet: true, doc: U.esc(W.t('ac.tAdd')) });
        push('count', 'fn', W.t('ac.table'), { insert: 'count()$0', snippet: true, doc: U.esc(W.t('ac.tCount')) });
        push('all', 'fn', W.t('ac.table'), { insert: 'all()$0', snippet: true, doc: U.esc(W.t('ac.tAll')) });
        return items;
      }
      if (!c.chained && on === 'math') {
        Object.keys(v.funcDefs).forEach(function (id) {
          var d = v.funcDefs[id];
          if (d.group !== 'number') return;
          var ps = (d.paramNames && d.paramNames[lang]) || d.params || [];
          push(L.fnName(d, lang), 'fn', W.t('help.fg.number'), { insert: L.fnName(d, lang) + '(' + (ps.length ? '${1:' + ps.join(', ') + '}' : '') + ')$0', snippet: true, doc: fnDoc(d) });
        });
        return items;
      }
      // a value: what it can do, then (for records from the database) their columns
      app.valueMethods(v).forEach(function (it) { items.push(it); });
      push('length', 'prop', W.t('ac.lengthProp'));
      var cols = {};
      p.tables.forEach(function (t) { t.columns.forEach(function (x) { cols[x.name] = t.name; }); });
      Object.keys(cols).forEach(function (n) { push(n, 'col', cols[n]); });
      push('id', 'col', '');
      return items;
    }
    var pre = c.before.trim();
    var preN = L.norm(pre);
    var says = function (k) { return (v.phrases[k] || []).map(function (ph) { return ph.join(' '); }); };
    // var int32 x / const int32 c / new Dog( / unsigned int8 / (int32)x: the types
    if (/(^|\s)(var|let|const|new|unsigned|signed|is|as|static|public|private|protected|readonly|abstract|virtual|override)$/.test(preN) || /\($/.test(pre) && /\b(sizeof|new)\s*\($/.test(pre)) {
      app.typeItems(page, r).forEach(function (it) { if (!(preN.slice(-8) === 'unsigned' && !/int/.test(it.label))) items.push(it); });
      if (preN.slice(-3) === 'new') C.list.forEach(function () {});
      if (/(var|let|const)$/.test(preN)) return items;
      if (/new$/.test(preN)) return items.map(function (it) { return it.kind === 'type' ? Object.assign({}, it, { insert: it.label + '(${1})$0', snippet: true }) : it; });
    }
    // class Dog : ... / class Dog inherits ...
    if (/^(class|interface)\s+[\p{L}_][\p{L}\p{N}_]*\s*(:|inherits|extends|implements)(\s*,\s*[\p{L}_][\p{L}\p{N}_]*)*\s*,?$/u.test(preN) || /^(class|interface)\s+[\p{L}_][\p{L}\p{N}_]*\s*(:|inherits|extends|implements)\s*$/u.test(preN)) {
      Object.keys(r.info).forEach(function (f) { (r.info[f].types || []).forEach(function (t) { if (t.kind === 'class' || t.kind === 'interface') push(t.name, 'type', W.t('ty.' + t.kind)); }); });
      return items;
    }
    var endsWith = function (k) { return says(k).some(function (ph) { return preN === ph || preN.slice(-ph.length - 1) === ' ' + ph; }); };
    // when ... : controls and the page; when Control ... : its events
    if (says('when').indexOf(preN) >= 0) {
      controls.forEach(function (x) { push(x.name, 'ctl', W.t('ctl.' + x.type)); });
      push(v.say('pageloads'), 'ev');
      push(v.say('keypressed'), 'ev');
      return items;
    }
    var whenCtl = new RegExp('^(' + says('when').map(esc).join('|') + ')\\s+([\\p{L}_][\\p{L}\\p{N}_]*)\\s*$', 'u').exec(preN);
    if (whenCtl) {
      var ct = controls.filter(function (x) { return L.norm(x.name) === whenCtl[2]; })[0];
      if (ct) {
        Object.keys((C.get(ct.type) || {}).events || {}).forEach(function (k) { push(v.say('ev.' + k), 'ev', W.t('evdesc.' + k)); });
        return items;
      }
    }
    // tables after find all / count / update / delete from / add ... to
    if (endsWith('all') || endsWith('first') || endsWith('count') || endsWith('update') || endsWith('from') || (endsWith('to') && says('add').some(function (a) { return preN.indexOf(a + ' ') === 0; })) || endsWith('in')) {
      p.tables.forEach(function (t) { push(t.name, 'tbl', W.t('ac.table'), { doc: U.esc(t.columns.map(function (x) { return x.name; }).join(', ')) }); });
      if (endsWith('all') || endsWith('first') || endsWith('count') || endsWith('update')) return items;
    }
    // inside a where: columns of the table
    var line = L.norm(c.lineText);
    var wm = says('where').map(function (w) { return line.indexOf(' ' + w + ' '); }).filter(function (i) { return i >= 0; });
    if (wm.length) {
      p.tables.forEach(function (t) {
        if (line.indexOf(L.norm(t.name)) >= 0) t.columns.forEach(function (x) { push(x.name, 'col', t.name); });
      });
    }
    // the first value of a command: "hide " -> controls, "go to page " -> pages
    Object.keys(v.cmdDefs).forEach(function (id) {
      (v.cmdDefs[id].patterns.en || []).forEach(function (pat) {
        var m = /^([^{]*)\{\w+:(control|page)\}/.exec(pat);
        if (!m || L.norm(m[1].trim()) !== preN) return;
        if (m[2] === 'control') controls.forEach(function (x) { push(x.name, 'ctl', W.t('ctl.' + x.type)); });
        else p.pages.forEach(function (pg) { push(pg.name, 'page', pg.title || ''); });
      });
    });
    // typed a space: only show a list where it really helps
    if (c.auto) return items;
    // a command being written: "show mess" -> show message …
    var typed = L.norm((c.before + c.word).trim());
    if (!c.lineStart && typed && /\s/.test(typed)) {
      Object.keys(v.cmdDefs).forEach(function (id) {
        var d = v.cmdDefs[id];
        (d.patterns[lang] || d.patterns.en || []).forEach(function (pat) {
          var lit = L.norm(pat.split(/\{/)[0].trim());
          if (!lit || lit.indexOf(typed) !== 0 || lit === typed) return;
          var first = true;
          var ins = pat.replace(/\{(\w+)(?::\w+)?\}/g, function (m, n) { if (first) { first = false; return '${1:' + n + '}'; } return n; });
          push(pat.replace(/\{(\w+)(?::\w+)?\}/g, '…'), 'cmd', W.t('ac.command'), { insert: ins, snippet: true, keep: true, start: c.textStart,
            doc: U.esc(d.doc[ui] || d.doc.en || '') + (d.example[lang] ? '<pre>' + U.esc(d.example[lang]) + '</pre>' : '') });
        });
      });
    }
    // statements at the start of a line
    if (c.lineStart) {
      app.snippets(v).forEach(function (s) { push(s.label, 'snippet', W.t('ac.snippet'), { insert: s.insert, snippet: true }); });
      Object.keys(v.cmdDefs).forEach(function (id) {
        var d = v.cmdDefs[id];
        var pat = (d.patterns[lang] || d.patterns.en || [])[0];
        if (!pat) return;
        var first = true;
        var ins = pat.replace(/\{(\w+)(?::\w+)?\}/g, function (m, n) { if (first) { first = false; return '${1:' + n + '}'; } return n; });
        push(pat.replace(/\{(\w+)(?::\w+)?\}/g, '…'), 'cmd', W.t('ac.command'), { insert: ins, snippet: true, doc: U.esc(d.doc[ui] || d.doc.en || '') + (d.example[lang] ? '<pre>' + U.esc(d.example[lang]) + '</pre>' : '') });
      });
      ['var', 'if', 'switch', 'for', 'foreach', 'while', 'repeat', 'do', 'function', 'when', 'every', 'return', 'print', 'break', 'continue', 'try', 'set', 'add', 'remove', 'clear', 'increase', 'decrease', 'wait', 'update', 'delete'].forEach(function (k) {
        push(k === 'break' || k === 'continue' ? k : v.say(k), 'kw');
      });
      ['const', 'struct', 'union', 'class', 'interface', 'abstract class'].forEach(function (k) { push(k, 'kw'); });
      app.typeItems(page, r).forEach(function (it) { if (it.kind === 'type' && /^(int32|int64|float64|bool|string|char)$/.test(it.label)) items.push(it); });
      // inside a class: public / private / static ...
      var inCls = (info.types || []).some(function (t) { return c.line + 1 > t.line && c.line + 1 <= t.endLine; });
      if (inCls) ['public', 'private', 'protected', 'static', 'virtual', 'override', 'abstract', 'readonly', 'public:', 'private:', 'protected:'].forEach(function (k) { push(k, 'kw'); });
      // commands written like C: message("Hi"), goTo("About")
      Object.keys(v.cmdCalls).forEach(function (cn) {
        var d = v.cmdCalls[cn], name = [].concat(d.call)[0];
        if (L.norm(name) !== cn) return;
        var c0 = v.cmdFirst[d.id], args = c0 ? c0.parts.filter(function (x) { return x.slot && x.kind !== 'target'; }).map(function (x) { return x.slot; }) : [];
        if (d.callArgs) args = d.callArgs.slice();
        var hasValue = c0 && c0.parts.some(function (x) { return x.kind === 'target'; });
        push(name + '(' + args.join(', ') + ')', 'fn', W.t('ac.command'), { insert: (hasValue ? 'var ${1:answer} = ' + name + '(' + (args.length ? args.join(', ') : '') + ')' : name + '(' + (args.length ? '${1:' + args.join(', ') + '}' : '') + ')') + '$0', snippet: true,
          doc: U.esc(d.doc[ui] || d.doc.en || '') + (d.example && d.example.en ? '<pre>' + U.esc(d.example.en) + '</pre>' : '') });
      });
    }
    // values
    var locals = [];
    (info.functions || []).concat(info.handlers || []).forEach(function (fn) {
      if (c.line + 1 >= fn.line && c.line + 1 <= fn.endLine) locals = locals.concat(fn.locals || []);
    });
    uniq(locals.concat(info.globals || [])).forEach(function (n) { push(n, 'var', W.t('ac.variable')); });
    controls.forEach(function (x) { push(x.name, 'ctl', W.t('ctl.' + x.type), { then: 'none' }); });
    Object.keys(r.info).forEach(function (f) {
      (r.info[f].functions || []).forEach(function (fn) {
        if (f !== 'Site' && f !== file) return;
        push(fn.name, 'fn', fn.server ? W.t('ac.serverFn') : W.t('ac.yourFn'), { insert: fn.name + '(' + (fn.params.length ? '${1:' + fn.params.join(', ') + '}' : '') + ')$0', snippet: true });
      });
    });
    Object.keys(v.funcDefs).forEach(function (id) {
      var d = v.funcDefs[id];
      var name = L.fnName(d, lang);
      var params = (d.paramNames && d.paramNames[lang]) || d.params || [];
      var req = params.filter(function (x) { return !/\?$/.test(x); });
      push(name, 'fn', d.group ? W.t('help.fg.' + d.group) : '', { insert: name + '(' + (req.length ? '${1:' + req.join(', ').replace(/^\.\.\./, '') + '}' : '') + ')$0', snippet: true, doc: fnDoc(d) });
    });
    ['true', 'false', 'nothing', 'find', 'count'].forEach(function (k) { push(v.say(k), 'kw'); });
    // AND OR NOT... decide true / false; and or not... work bit by bit
    ['and', 'or', 'xor', 'not', 'nand', 'nor', 'xnor'].forEach(function (k) {
      push(v.say(k).toUpperCase(), 'kw', W.t('ac.logicOp'));
      push(v.say(k).toLowerCase(), 'kw', W.t('ac.bitOp'));
    });
    ['shl', 'shr'].forEach(function (k) { push(v.say(k), 'kw', W.t('ac.bitOp')); });
    if (!c.lineStart) p.tables.forEach(function (t) { push(t.name, 'tbl', W.t('ac.table')); });
    var seen = {};
    return items.filter(function (it) { var k = it.kind + ':' + it.label; if (seen[k]) return false; seen[k] = 1; return true; });
  };
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function uniq(a) { var s = {}; return a.filter(function (x) { var k = L.norm(x); if (s[k]) return false; s[k] = 1; return true; }); }

  app.signature = function (page, name, index, isMethod) {
    var p = app.project, v = P.vocab(p), lang = 'en', ui = W.i18n.lang;
    var n = L.norm(name);
    var d = isMethod ? (v.methods[n] || null) : v.functions[n];
    var params, doc = '';
    // new Dog(…): its constructor; obj.method(…): a method of a class
    var r0 = app.lastCompile, allT = [];
    if (r0) Object.keys(r0.info).forEach(function (f) { allT = allT.concat(r0.info[f].types || []); });
    var ty = allT.filter(function (t) { return L.norm(t.name) === n; })[0];
    if (!isMethod && ty) {
      params = (ty.ctorParams || []).map(function (q, i) { return (ty.ctorTypes && ty.ctorTypes[i] ? L.showType(ty.ctorTypes[i]) + ' ' : '') + q; });
      name = 'new ' + ty.name;
      doc = W.t('ty.' + ty.kind);
    }
    if (isMethod && !d) {
      var mm = null;
      allT.forEach(function (t) { t.members.forEach(function (m) { if (m.kind === 'method' && L.norm(m.name) === n) mm = mm || m; }); });
      if (mm) {
        params = (mm.params || []).map(function (q, i) { return (mm.ptypes && mm.ptypes[i] ? L.showType(mm.ptypes[i]) + ' ' : '') + q; });
        doc = W.t('ac.methodOf') + ' ' + mm.owner + (mm.ty ? ' → ' + L.showType(mm.ty) : '');
      }
    }
    var cmd = !d && !params && (isMethod ? v.cmdMethods[n] : v.cmdCalls[n]);
    if (params) {
      void 0;
    } else if (d) {
      params = (d.paramNames && d.paramNames[lang]) || d.params || [];
      if (isMethod) params = params.slice(1);   // x.round(decimals): x is the first value
      doc = d.doc[ui] || d.doc.en || '';
    } else if (cmd) {
      var c0 = v.cmdFirst[cmd.id];
      params = c0 ? c0.parts.filter(function (x) { return x.slot && x.kind !== 'target' && !(isMethod && x.kind === 'control'); }).map(function (x) { return x.slot; }) : [];
      if (cmd.callArgs && !isMethod) params = cmd.callArgs.slice();
      doc = cmd.doc[ui] || cmd.doc.en || '';
    } else if (isMethod) {
      return null;
    } else {
      var r = app.lastCompile;
      if (!r) return null;
      var fn = null;
      Object.keys(r.info).forEach(function (f) { (r.info[f].functions || []).forEach(function (x) { if (L.norm(x.name) === n) fn = x; }); });
      if (!fn) return null;
      params = fn.params.map(function (q, i) { return (fn.ptypes && fn.ptypes[i] ? L.showType(fn.ptypes[i]) + ' ' : '') + q; });
      doc = (fn.server ? W.t('ac.serverFn') : W.t('ac.yourFn')) + (fn.rty ? ' → ' + L.showType(fn.rty) : '');
    }
    var parts = params.map(function (x, i) { return i === index || (/^\.\.\./.test(x) && i <= index) ? '<b>' + U.esc(x) + '</b>' : U.esc(x); });
    return '<code>' + U.esc(name) + '(' + parts.join(', ') + ')</code>' + (doc ? '<span class="sig-doc"> ' + U.esc(doc) + '</span>' : '');
  };

  app.hover = function (page, word, at) {
    var p = app.project, v = P.vocab(p), lang = 'en', ui = W.i18n.lang;
    var n = L.norm(word);
    if (at.afterDot) {
      // x.trim(): the function it stands for
      var md = v.methods[n];
      if (md) return '<b>x.' + U.esc(word) + '(' + U.esc(((md.paramNames && md.paramNames[lang]) || md.params || []).slice(1).join(', ')) + ')</b> = ' + U.esc(L.fnName(md, lang)) + '(x…)<br>' + U.esc(md.doc[ui] || md.doc.en || '');
      var cm = v.cmdMethods[n];
      if (cm) return '<b>' + U.esc(word) + '()</b><br>' + U.esc(cm.doc[ui] || cm.doc.en || '');
      return null;
    }
    var d = v.functions[n] || v.cmdCalls[n];
    if (d && !d.params) return '<b>' + U.esc(word) + '(…)</b><br>' + U.esc(d.doc[ui] || d.doc.en || '');
    if (d) return '<b>' + U.esc(L.fnName(d, lang)) + '(' + U.esc(((d.paramNames && d.paramNames[lang]) || d.params || []).join(', ')) + ')</b><br>' + U.esc(d.doc[ui] || d.doc.en || '');
    var r = app.lastCompile;
    if (r) {
      var ty = null;
      Object.keys(r.info).forEach(function (f) { (r.info[f].types || []).forEach(function (t) { if (L.norm(t.name) === n) ty = t; }); });
      if (ty) return '<b>' + U.esc(ty.kind + ' ' + ty.name) + '</b>' + (ty.base ? ' : ' + U.esc(ty.base) : '') + '<br><pre>' + U.esc(typeSummary(ty)) + '</pre>';
      if (L.builtinTypes[n]) return '<b>' + U.esc(word) + '</b> · ' + U.esc(W.t('ty.' + L.builtinTypes[n]) !== 'ty.' + L.builtinTypes[n] ? W.t('ty.' + L.builtinTypes[n]) : W.t('ty.type'));
      var vt = at.line !== undefined ? app.typeOfName(page, r, word, at.line + 1) : null;
      if (vt) return '<b>' + U.esc(L.showType(vt) + ' ' + word) + '</b>';
    }
    if (page) {
      var ctl = P.controlsOf(page).filter(function (x) { return L.norm(x.name) === n; })[0];
      if (ctl) return '<b>' + U.esc(ctl.name) + '</b> · ' + U.esc(W.t('ctl.' + ctl.type)) + '<br>' + U.esc(W.t('ctldesc.' + ctl.type));
    }
    var t = p.tables.filter(function (x) { return L.norm(x.name) === n; })[0];
    if (t) return '<b>' + U.esc(t.name) + '</b> · ' + U.esc(W.t('ac.table')) + '<br>' + U.esc(['id'].concat(t.columns.map(function (c) { return c.name + ' (' + W.t('db.type.' + c.type) + ')'; })).join(', '));
    var r = app.lastCompile;
    if (r) {
      var fn = null;
      Object.keys(r.info).forEach(function (f) { (r.info[f].functions || []).forEach(function (x) { if (L.norm(x.name) === n) fn = { f: f, x: x }; }); });
      if (fn) return '<b>' + U.esc(fn.x.name) + '(' + U.esc(fn.x.params.join(', ')) + ')</b><br>' + U.esc((fn.x.server ? W.t('ac.serverFn') : W.t('ac.yourFn')) + ' · ' + fn.f + ', ' + W.t('tr.line') + ' ' + fn.x.line);
    }
    void lang;
    return null;
  };

  /* =====================================================================
   * Commands
   * ===================================================================== */

  app.cmd = function (name) {
    var args = Array.prototype.slice.call(arguments, 1);
    var fn = COMMANDS[name];
    if (!fn) { console.warn('no command', name); return; }
    if (!app.project && NEEDS_PROJECT.indexOf(name) >= 0) return;
    return fn.apply(null, args);
  };
  var NEEDS_PROJECT = ['delete', 'copy', 'cut', 'paste', 'duplicate', 'moveUp', 'moveDown', 'viewCode', 'viewDesigner', 'addPage', 'renamePage', 'deletePage', 'duplicatePage', 'makeHome', 'movePage',
    'addTable', 'renameTable', 'deleteTable', 'addFiles', 'renameAsset', 'deleteAsset', 'settings', 'renameProject', 'run', 'runPhp', 'export', 'save', 'saveFile', 'closeProject', 'resetData', 'format',
    'build', 'wrapPanel', 'bringFront', 'sendBack'];

  function selected() {
    var s = app.selection;
    if (!s || !app.project) return null;
    var page = app.project.pages.filter(function (x) { return x.id === s.pageId; })[0];
    if (!page) return null;
    var f = P.find(page, s.id);
    return f ? { page: page, f: f } : null;
  }

  var COMMANDS = {
    newProject: function () { app.newProject('blank'); },
    openProject: function () {
      W.store.listProjects().then(function (items) {
        var list = h('div.open-list');
        if (!items.length) list.appendChild(h('p.muted', W.t('start.noRecent')));
        items.forEach(function (it) {
          list.appendChild(h('button.recent-open.wide', { type: 'button', onclick: function () { U.dialog.close(null); app.openProjectId(it.id); } },
            h('span.ic-wrap', { html: W.icons.svg('site') }), h('span.recent-name', it.name), h('span.muted', fmtDate(it.modified) + (it.size ? ' · ' + U.fmtBytes(it.size) : ''))));
        });
        U.dialog({ title: W.t('cmd.openProject'), width: 480, body: list, buttons: [{ label: W.t('cmd.openFile'), action: function () { setTimeout(function () { app.cmd('openFile'); }, 0); } }, { label: W.t('common.close'), value: null }] });
      });
    },
    openFile: function () {
      U.pickFiles({ accept: '.wemazy,.json,.zip', as: 'buffer' }).then(function (files) {
        if (!files.length) return;
        var f = files[0];
        var bytes = new Uint8Array(f.data);
        var job;
        if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
          job = W.zip.read(f.data).then(function (entries) {
            var e = entries.filter(function (x) { return /\.wemazy$/i.test(x.name); })[0];
            if (!e) throw new Error(W.t('err.noProjectInZip'));
            return new TextDecoder().decode(e.data);
          });
        } else job = Promise.resolve(new TextDecoder().decode(bytes));
        job.then(function (text) {
          var p = P.fromFile(text);
          // a copy with its own id, unless it is not in the store yet
          return W.store.listProjects().then(function (items) {
            if (items.some(function (x) { return x.id === p.id; })) p.id = U.uid('p');
            app.load(p);
            app.dirty = true;
            app.saveNow();
          });
        }).catch(function (e) { U.alert(W.t('cmd.openFile'), W.t('err.openFailed', e.message)); });
      });
    },
    save: function () {
      app.dirty = true;
      app.saveNow().then(function () { U.toast(W.t('status.saved')); });
    },
    saveFile: function () {
      var p = app.project;
      U.download(U.slug(p.name) + '.wemazy', P.toFile(p), 'application/json');
    },
    closeProject: function () { app.closeProject(); },
    renameProject: function () {
      var p = app.project;
      U.prompt(W.t('cmd.renameProject'), W.t('new.name'), p.name, function (v) { return v ? null : W.t('err.needName'); }).then(function (v) {
        if (!v) return;
        p.name = v;
        app.titleText.textContent = v;
        document.title = v + ' - Wemazy';
        app.changed(W.t('undo.rename'));
      });
    },
    undo: function () {
      var doc = app.activeDoc();
      if (doc && doc.kind === 'code') { doc.component.focus(); document.execCommand('undo'); return; }
      var l = W.history.undo();
      if (l) app.status(W.t('status.undone', l === true ? '' : l));
    },
    redo: function () {
      var doc = app.activeDoc();
      if (doc && doc.kind === 'code') { doc.component.focus(); document.execCommand('redo'); return; }
      var l = W.history.redo();
      if (l) app.status(W.t('status.redone', l === true ? '' : l));
    },
    copy: function () {
      var s = selected();
      if (!s || s.f.el === s.page.root || s.f.el.type === 'Column') return;
      app.clipboard = U.clone(s.f.el);
      U.toast(W.t('ed.copied', s.f.el.name));
      app.updateMenus();
    },
    cut: function () {
      var s = selected();
      if (!s || s.f.el === s.page.root || s.f.el.type === 'Column') return;
      app.clipboard = U.clone(s.f.el);
      s.f.parent.children.splice(s.f.index, 1);
      app.select(s.page, s.f.parent.id);
      app.changed(W.t('undo.cut'));
    },
    paste: function () {
      var s = selected();
      if (!app.clipboard) return;
      var page = s ? s.page : app.currentPage();
      var copy = P.cloneElement(app.project, page, app.clipboard);
      var parent = page.root, index = page.root.children.length;
      if (s) {
        var el = s.f.el;
        if (el === page.root || (C.isContainer(el) && el.type !== 'Columns')) { parent = el; index = el.children.length; }
        else if (s.f.parent) { parent = s.f.parent; index = s.f.index + 1; }
      }
      if (parent.type === 'Columns') { parent = parent.children[0]; index = parent.children.length; }
      if (parent.props.layout === 'free') { copy.props.x = (+copy.props.x || 0) + 16; copy.props.y = (+copy.props.y || 0) + 16; }
      parent.children.splice(index, 0, copy);
      app.changed(W.t('undo.paste'));
      app.select(page, copy.id);
    },
    duplicate: function () {
      var s = selected();
      if (!s || s.f.el === s.page.root || s.f.el.type === 'Column') return;
      var copy = P.cloneElement(app.project, s.page, s.f.el);
      if (s.f.parent.props.layout === 'free') { copy.props.x = (+copy.props.x || 0) + 16; copy.props.y = (+copy.props.y || 0) + 16; }
      s.f.parent.children.splice(s.f.index + 1, 0, copy);
      app.changed(W.t('undo.duplicate'));
      app.select(s.page, copy.id);
    },
    'delete': function () {
      var s = selected();
      if (!s || s.f.el === s.page.root) return;
      if (s.f.el.type === 'Column') { U.toast(W.t('err.columnDelete')); return; }
      var name = s.f.el.name;
      s.f.parent.children.splice(s.f.index, 1);
      var next = s.f.parent.children[s.f.index] || s.f.parent.children[s.f.index - 1];
      app.select(s.page, next ? next.id : s.f.parent.id);
      app.changed(W.t('undo.delete', name));
      // code that still uses it will show an error, which is helpful
    },
    moveUp: function () { move(-1); },
    moveDown: function () { move(1); },
    bringFront: function () {
      var s = selected();
      if (!s || !s.f.parent) return;
      s.f.parent.children.splice(s.f.index, 1);
      s.f.parent.children.push(s.f.el);
      app.changed(W.t('undo.order'));
    },
    sendBack: function () {
      var s = selected();
      if (!s || !s.f.parent) return;
      s.f.parent.children.splice(s.f.index, 1);
      s.f.parent.children.unshift(s.f.el);
      app.changed(W.t('undo.order'));
    },
    wrapPanel: function () {
      var s = selected();
      if (!s || !s.f.parent || s.f.el === s.page.root) return;
      var panel = P.newElement(app.project, s.page, 'Panel');
      s.f.parent.children.splice(s.f.index, 1, panel);
      panel.children.push(s.f.el);
      app.changed(W.t('undo.wrap'));
      app.select(s.page, panel.id);
    },
    viewCode: function () {
      var doc = app.activeDoc();
      var page = app.currentPage();
      if (doc && doc.kind === 'code') return;
      var s = selected();
      if (doc && doc.kind === 'design' && s && s.f.el !== s.page.root) {
        var def = C.get(s.f.el.type) || {};
        if (def.events && def.defaultEvent && def.events[def.defaultEvent]) {
          var hd = app.handlersOf(s.page).filter(function (x) { return x.ev && x.ev.kind === 'control' && L.norm(x.ev.name) === L.norm(s.f.el.name); })[0];
          if (hd) { app.goToLine(s.page.name, hd.line + 1, 5); return; }
        }
      }
      app.openCode(page);
    },
    viewDesigner: function () {
      var doc = app.activeDoc();
      var page = doc && doc.page ? doc.page : app.currentPage();
      if (page) app.openDesigner(page);
    },
    addPage: function () {
      var p = app.project;
      var n = p.pages.length + 1, base = 'Page';
      while (P.pageByName(p, base + n)) n++;
      var name = h('input.input', { type: 'text', value: base + n, autofocus: true, spellcheck: false });
      var kind = h('div.choice',
        h('label.wd-check', h('input', { type: 'radio', name: 'pk', value: 'flow', checked: true }), ' ' + W.t('page.flow')),
        h('label.wd-check', h('input', { type: 'radio', name: 'pk', value: 'free' }), ' ' + W.t('page.free')));
      var err = h('div.wd-err');
      U.dialog({
        title: W.t('cmd.addPage'), width: 440,
        body: h('div.form', h('label.wd-label', W.t('page.name'), name), h('p.wd-hint', W.t('page.nameHint')), kind, err),
        buttons: [{ label: W.t('common.cancel'), value: null }, { label: W.t('page.add'), primary: true, action: function () {
          var v = name.value.trim();
          var e = P.checkPageName(p, v, null);
          if (e) { err.textContent = e; return false; }
          var free = U.$('input[name=pk]:checked', kind).value === 'free';
          var pg = P.addPage(p, v, { free: free });
          app.changed(W.t('undo.addPage'));
          app.openDesigner(pg);
        } }]
      });
    },
    renamePage: function (pg) {
      pg = pg || app.currentPage();
      var p = app.project;
      U.prompt(W.t('cmd.renamePage'), W.t('page.name'), pg.name, function (v) { return P.checkPageName(p, v, pg); }).then(function (v) {
        if (v && v !== pg.name) app.renamePage(pg, v);
      });
    },
    deletePage: function (pg) {
      var p = app.project;
      if (p.pages.length < 2) { U.toast(W.t('err.lastPage'), 'bad'); return; }
      U.confirm(W.t('cmd.deletePage'), W.t('confirm.deletePage', pg.name), W.t('cmd.delete'), true).then(function (ok) {
        if (!ok) return;
        p.pages.splice(p.pages.indexOf(pg), 1);
        app.changed(W.t('undo.deletePage', pg.name));
      });
    },
    duplicatePage: function (pg) {
      var p = app.project;
      var n = 2;
      while (P.pageByName(p, pg.name + n)) n++;
      var copy = U.clone(pg);
      copy.id = U.uid('pg');
      copy.name = pg.name + n;
      copy.title = pg.title + ' ' + n;
      P.walk(copy.root, function (x) { if (x !== copy.root) x.id = U.uid('e'); });
      p.pages.splice(p.pages.indexOf(pg) + 1, 0, copy);
      app.changed(W.t('undo.addPage'));
      app.openDesigner(copy);
    },
    makeHome: function (pg) {
      var p = app.project;
      p.pages.splice(p.pages.indexOf(pg), 1);
      p.pages.unshift(pg);
      app.changed(W.t('undo.home'));
    },
    movePage: function (pg, d) {
      var p = app.project, i = p.pages.indexOf(pg), j = i + d;
      if (j < 1 || j >= p.pages.length || i < 1) return;
      p.pages.splice(i, 1);
      p.pages.splice(j, 0, pg);
      app.changed(W.t('undo.order'));
    },
    addTable: function () {
      var p = app.project;
      var n = p.tables.length + 1, base = 'Table';
      while (p.tables.some(function (t) { return t.name.toLowerCase() === (base + n).toLowerCase(); })) n++;
      U.prompt(W.t('cmd.addTable'), W.t('db.tableName'), base + n, function (v) { return P.checkTableName(p, v, null); }, W.t('db.create')).then(function (v) {
        if (!v) return;
        var t = { id: U.uid('t'), name: v, columns: [{ name: 'name', type: 'text' }], rows: [] };
        p.tables.push(t);
        app.changed(W.t('undo.addTable'));
        app.openDatabase(t);
      });
    },
    renameTable: function (t) {
      var p = app.project;
      U.prompt(W.t('cmd.renameTable'), W.t('db.tableName'), t.name, function (v) { return P.checkTableName(p, v, t); }).then(function (v) {
        if (!v || v === t.name) return;
        var old = t.name;
        p.pages.forEach(function (pg) { pg.code = P.renameInCode(pg.code, old, v); });
        p.siteCode = P.renameInCode(p.siteCode, old, v);
        t.name = v;
        app.refreshCodeDocs();
        app.changed(W.t('undo.rename'));
      });
    },
    deleteTable: function (t) {
      var p = app.project;
      U.confirm(W.t('cmd.deleteTable'), W.t('confirm.deleteTable', t.name), W.t('cmd.delete'), true).then(function (ok) {
        if (!ok) return;
        p.tables.splice(p.tables.indexOf(t), 1);
        app.changed(W.t('undo.deleteTable', t.name));
      });
    },
    addFiles: function () { app.pickAsset(null, true); },
    renameAsset: function (a) {
      var p = app.project;
      U.prompt(W.t('cmd.rename'), W.t('asset.name'), a.name, function (v) {
        if (!/^[\w.\-]+$/.test(v)) return W.t('err.assetChars');
        if (P.asset(p, v) && P.asset(p, v) !== a) return W.t('err.assetTaken', v);
        return null;
      }).then(function (v) {
        if (!v || v === a.name) return;
        var old = a.name;
        a.name = v;
        // update properties that use it
        p.pages.forEach(function (pg) { P.walk(pg.root, function (el) { Object.keys(el.props || {}).forEach(function (k) { if (el.props[k] === old) el.props[k] = v; }); }); });
        app.changed(W.t('undo.rename'));
      });
    },
    deleteAsset: function (a) {
      var p = app.project;
      U.confirm(W.t('cmd.delete'), W.t('confirm.deleteAsset', a.name), W.t('cmd.delete'), true).then(function (ok) {
        if (!ok) return;
        p.assets.splice(p.assets.indexOf(a), 1);
        app.changed(W.t('undo.delete', a.name));
      });
    },
    settings: function () { app.settingsDialog(); },
    run: function () { return app.run('browser'); },
    runPhp: function () { return app.run('php'); },
    stop: function () { app.closeDoc('run'); },
    resetData: function (table) {
      var p = app.project;
      U.confirm(W.t('cmd.resetData'), table ? W.t('confirm.resetTable', table.name) : W.t('confirm.resetData'), W.t('db.reset'), true).then(function (ok) {
        if (!ok) return;
        W.store.getSim(p.id).then(function (data) {
          var srv = W.runtime.server(W.runtime.core(), { data: data, save: function (d) { W.store.setSim(p.id, d); W.bus.emit('sim-data'); } });
          srv.sync(p.tables);
          srv.reset(table ? table.name : null);
          var run = app.findDoc('run');
          if (run && run.component.server) { run.component.server.sync(p.tables); run.component.server.reset(table ? table.name : null); run.component.server.resetSession(); }
          setTimeout(function () { W.bus.emit('sim-data'); U.toast(W.t('db.resetDone')); }, 120);
        });
        if (W.store.mode === 'server') W.store.resetSiteData(p.id).catch(function () { /* not deployed */ });
      });
    },
    'export': function () { app.exportDialog(); },
    build: function () {
      var r = app.recompile();
      if (!r) return;
      app.showBottom(r.ok ? 'output' : 'errors');
      app.outputPanel.write(r.ok ? W.t('out.buildOk', app.project.pages.length) : W.t('out.buildFail', r.errors.length), r.ok ? 'ok' : 'error');
    },
    format: function () {
      var doc = app.activeDoc();
      if (doc && doc.kind === 'code') doc.component.format();
    },
    lab: function () { app.openLab(); },
    options: function () { app.optionsDialog(); },
    toggleTheme: function () {
      var t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', t);
      W.store.setSetting('theme', t);
    },
    properties: function () { app.togglePanel('props', true); var f = U.$('.props-grid input, .props-grid select'); if (f) f.focus(); },
    switchStore: function () {
      if (W.store.mode === 'server') { W.store.mode = 'browser'; U.toast(W.t('store.nowBrowser')); }
      else { W.store.mode = 'server'; U.toast(W.t('store.nowServer')); }
      app.updateStatusbar();
      app.renderStart();
    }
  };
  function move(d) {
    var s = selected();
    if (!s || !s.f.parent || s.f.el.type === 'Column') return;
    var arr = s.f.parent.children, i = s.f.index, j = i + d;
    if (j < 0 || j >= arr.length) return;
    arr.splice(i, 1);
    arr.splice(j, 0, s.f.el);
    app.changed(W.t('undo.order'));
  }

  app.refreshCodeDocs = function () {
    app.docs.forEach(function (d) {
      if (d.kind !== 'code' || !d.component) return;
      var want = d.page ? d.page.code : app.project.siteCode;
      if (d.component.getValue() !== want) d.component.setValue(want, true);
      else d.component.refresh();
    });
  };

  app.renamePage = function (pg, v) {
    var p = app.project;
    var old = pg.name;
    // links and "go to page" in code
    p.pages.forEach(function (x) {
      P.walk(x.root, function (el) { if (el.props && el.props.href === old) el.props.href = v; });
      x.code = P.renameInCode(x.code, old, v).replace(new RegExp('(["\'])' + old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\1', 'g'), '$1' + v + '$1');
    });
    if (pg.title === old) pg.title = v;
    pg.name = v;
    app.refreshCodeDocs();
    app.changed(W.t('undo.rename'));
  };
  app.renameControl = function (page, el, v) {
    var old = el.name;
    el.name = v;
    page.code = P.renameInCode(page.code, old, v);
    app.refreshCodeDocs();
    app.changed(W.t('undo.rename'));
    if (page.code.indexOf(v) >= 0) U.toast(W.t('props.renamedInCode', old, v));
  };

  /** Choose a picture (or add new files). Resolves with the name of the asset. */
  app.pickAsset = function (kind, justAdd) {
    var p = app.project;
    return new Promise(function (resolve) {
      var add = function () {
        return U.pickFiles({ accept: kind === 'image' ? 'image/*' : 'image/*,audio/*,video/*,.pdf,.txt,.json,.csv', multiple: true, as: 'dataurl' }).then(function (files) {
          return Promise.all(files.map(function (f) {
            var tooBig = f.size > 8 * 1024 * 1024;
            if (tooBig) { U.toast(W.t('err.fileTooBig', f.name), 'bad'); return null; }
            return U.shrinkImage(f.data, 1600).then(function (data) {
              var a = { id: U.uid('a'), name: P.assetName(p, f.name), type: f.type || 'application/octet-stream', size: Math.round((data.length - data.indexOf(',') - 1) * 3 / 4), data: data };
              p.assets.push(a);
              return a;
            });
          })).then(function (list) {
            list = list.filter(Boolean);
            if (list.length) app.changed(W.t('undo.addFiles'));
            return list;
          });
        });
      };
      if (justAdd) { add().then(function (l) { resolve(l[0] ? l[0].name : null); }); return; }
      var images = p.assets.filter(function (a) { return !kind || /^image\//.test(a.type); });
      var grid = h('div.asset-grid');
      images.forEach(function (a) {
        grid.appendChild(h('button.asset-pick', { type: 'button', title: a.name, onclick: function () { U.dialog.close(a.name); } },
          /^image\//.test(a.type) ? h('img', { src: a.data, alt: '' }) : h('span.ic-wrap', { html: W.icons.svg('page') }), h('span', a.name)));
      });
      if (!images.length) grid.appendChild(h('p.muted', W.t('asset.none')));
      U.dialog({
        title: W.t('asset.pick'), width: 560, body: grid,
        buttons: [{ label: W.t('asset.upload'), action: function () { return add().then(function (l) { return l[0] ? l[0].name : null; }); } },
          { label: W.t('common.cancel'), value: null }]
      }).then(resolve);
    });
  };

  /* =====================================================================
   * Running
   * ===================================================================== */

  app.run = function (mode) {
    var p = app.project;
    app.saveNow();
    var r = W.build.compile(p, true);
    app.runtimeErrs = [];
    app.showErrors(r);
    if (!r.ok) {
      app.showBottom('errors');
      app.status(W.t('status.fixErrors'));
      U.toast(W.t('run.fixFirst', r.errors.length), 'bad');
      var e = r.errors[0];
      app.goToLine(e.file, e.line, e.col, e.len);
      return Promise.resolve(false);
    }
    if (mode === 'php' && W.store.mode !== 'server') {
      U.alert(W.t('run.phpTitle'), W.t('run.needServer'));
      return Promise.resolve(false);
    }
    var startPage = app.currentPage();
    var doc = app.openRun();
    app.running = true;
    document.body.classList.add('running');
    app.updateMenus();
    app.outputPanel.write('—', 'sep');
    return doc.component.start(mode, startPage ? startPage.name : null);
  };

  /* =====================================================================
   * Dialogs: export, settings, options
   * ===================================================================== */

  app.exportDialog = function () {
    var p = app.project;
    var r = W.build.compile(p, false);
    if (!r.ok) { app.showBottom('errors'); U.toast(W.t('run.fixFirst', r.errors.length), 'bad'); return; }
    var server = r.uses.server;
    var choice = server ? 'php' : 'static';
    var opt = function (val, title, text, disabled) {
      var inp = h('input', { type: 'radio', name: 'exm', value: val, checked: val === choice, disabled: !!disabled });
      return h('label.ex-opt', { class: disabled ? 'disabled' : '' }, inp, h('span', h('b', title), h('span.muted', text)));
    };
    var info = h('ul.ex-info',
      h('li', W.t('export.pages', p.pages.length)),
      server ? h('li', W.t('export.serverUsed', r.server.functions.length, r.server.queries.length)) : h('li', W.t('export.noServer')),
      p.tables.length ? h('li', W.t('export.tables', p.tables.map(function (t) { return t.name; }).join(', '))) : null,
      p.assets.length ? h('li', W.t('export.assets', p.assets.length)) : null);
    var body = h('div.form', info,
      opt('static', W.t('export.static'), W.t('export.staticText'), server),
      opt('local', W.t('export.local'), W.t('export.localText')),
      opt('php', W.t('export.php'), W.t('export.phpText')));
    U.dialog({
      title: W.t('cmd.export'), width: 520, body: body,
      buttons: [{ label: W.t('common.cancel'), value: null }, { label: W.t('export.download'), primary: true, action: function () {
        var mode = U.$('input[name=exm]:checked', body).value;
        return W.build.exportZip(p, mode).then(function (out) {
          U.download(out.name, out.blob);
          app.outputPanel.write(W.t('out.exported', out.name, U.fmtBytes(out.blob.size)), 'ok');
          return true;
        }, function (e) { U.alert(W.t('cmd.export'), e.message); return false; });
      } }]
    });
  };

  app.settingsDialog = function () {
    var p = app.project, s = p.settings, t = s.theme;
    var draft = U.clone(t);
    var title = h('input.input', { type: 'text', value: s.siteTitle || '' });
    var htmlLang = h('select.input', h('option', { value: 'en' }, 'English'), h('option', { value: 'ro' }, 'Română'));
    htmlLang.value = s.htmlLang || 'en';
    var presets = h('div.theme-grid');
    var fields = {};
    var preview = h('div.theme-preview');
    function drawPreview() {
      preview.style.background = draft.background;
      preview.style.color = draft.text;
      preview.style.fontFamily = C.fonts[draft.font] || C.fonts.sans;
      preview.innerHTML = '<div style="font-family:' + U.esc(C.fonts[draft.headingFont] || C.fonts.sans) + ';font-weight:800;font-size:20px">' + U.esc(W.t('settings.sample')) + '</div>' +
        '<div style="opacity:.8;margin:4px 0 10px">' + U.esc(W.t('settings.sampleText')) + '</div>' +
        '<span style="display:inline-block;padding:7px 14px;border-radius:' + (+draft.radius) + 'px;background:' + U.esc(draft.primary) + ';color:' + U.esc(draft.onPrimary) + ';font-weight:600">' + U.esc(W.t('settings.sampleButton')) + '</span>' +
        '<span style="display:inline-block;margin-left:8px;padding:7px 14px;border-radius:' + (+draft.radius) + 'px;background:' + U.esc(draft.surface) + ';border:1px solid ' + U.esc(draft.border) + '">' + U.esc(W.t('settings.sampleCard')) + '</span>';
    }
    Object.keys(P.THEMES).forEach(function (k) {
      var th = P.THEMES[k];
      var b = h('button.theme-card', { type: 'button', class: t.preset === k ? 'on' : '', onclick: function () {
        Object.assign(draft, th, { preset: k });
        U.$$('.theme-card', presets).forEach(function (x) { x.classList.toggle('on', x === b); });
        Object.keys(fields).forEach(function (f) { fields[f].value = draft[f]; });
        drawPreview();
      } }, h('span.theme-sw', { style: { background: th.background } }, h('i', { style: { background: th.primary } }), h('i', { style: { background: th.text } }), h('i', { style: { background: th.surface } })), W.t('theme.' + k));
      presets.appendChild(b);
    });
    function colorRow(k) {
      var inp = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(draft[k]) ? draft[k] : '#000000', 'aria-label': W.t('settings.c.' + k) });
      inp.addEventListener('input', function () { draft[k] = inp.value; draft.preset = 'custom'; drawPreview(); });
      fields[k] = inp;
      return h('label.color-row', inp, h('span', W.t('settings.c.' + k)));
    }
    function fontSel(k) {
      var sel = h('select.input');
      Object.keys(C.fonts).filter(function (f) { return f !== 'theme'; }).forEach(function (f) { sel.appendChild(h('option', { value: f }, W.t('font.' + f))); });
      sel.value = draft[k] || 'sans';
      sel.addEventListener('change', function () { draft[k] = sel.value; drawPreview(); });
      fields[k] = sel;
      return sel;
    }
    var radius = h('input.input', { type: 'number', min: 0, max: 40, value: draft.radius });
    radius.addEventListener('input', function () { draft.radius = +radius.value; drawPreview(); });
    fields.radius = radius;
    var width = h('input.input', { type: 'number', min: 600, max: 2400, step: 20, value: draft.width || 1100 });
    width.addEventListener('input', function () { draft.width = +width.value; });
    var fav = h('input.input', { type: 'text', value: s.favicon || '', placeholder: W.t('settings.faviconHint'), list: 'set-assets' });
    var dl = h('datalist', { id: 'set-assets' });
    p.assets.forEach(function (a) { if (/^image\//.test(a.type)) dl.appendChild(h('option', { value: a.name })); });
    drawPreview();
    var body = h('div.settings',
      h('div.set-col',
        h('h3', W.t('settings.site')),
        h('label.wd-label', W.t('settings.title'), title),
        h('label.wd-label', W.t('settings.htmlLang'), htmlLang),
        h('label.wd-label', W.t('settings.favicon'), fav, dl),
        h('label.wd-label', W.t('settings.width'), width),
        h('h3', W.t('settings.code')),
        h('p.wd-hint', W.t('settings.packsHint')),
        h('button.btn.small', { type: 'button', onclick: function () { U.dialog.close(null); app.openLab(); } }, W.t('settings.packs'))),
      h('div.set-col',
        h('h3', W.t('settings.theme')),
        presets,
        h('div.color-grid', ['primary', 'onPrimary', 'background', 'text', 'surface', 'border'].map(colorRow)),
        h('div.two', h('label.wd-label', W.t('settings.font'), fontSel('font')), h('label.wd-label', W.t('settings.headingFont'), fontSel('headingFont'))),
        h('label.wd-label', W.t('settings.radius'), radius),
        preview));
    U.dialog({
      title: W.t('cmd.settings'), width: 820, body: body,
      buttons: [{ label: W.t('common.cancel'), value: null }, { label: W.t('common.save'), primary: true, action: function () {
        s.siteTitle = title.value.trim();
        s.htmlLang = htmlLang.value;
        s.favicon = fav.value.trim() || undefined;
        draft.muted = draft.muted || t.muted;
        s.theme = draft;
        app.changed(W.t('undo.settings'));
      } }]
    });
  };

  app.optionsDialog = function () {
    var lang = h('select.input', h('option', { value: 'en' }, 'English'), h('option', { value: 'ro' }, 'Română'));
    lang.value = W.i18n.lang;
    var theme = h('select.input', h('option', { value: 'dark' }, W.t('opt.dark')), h('option', { value: 'light' }, W.t('opt.light')));
    theme.value = document.documentElement.getAttribute('data-theme') || 'dark';
    var size = h('select.input');
    [12, 13, 14, 15, 16, 18].forEach(function (n) { size.appendChild(h('option', { value: n }, n + ' px')); });
    var cur = W.store.setting('codeSize', 13);
    size.value = String([12, 13, 14, 15, 16, 18].reduce(function (a, b) { return Math.abs(b - cur) < Math.abs(a - cur) ? b : a; }));
    var reopen = h('input', { type: 'checkbox' });
    reopen.checked = W.store.setting('reopen', true);
    U.dialog({
      title: W.t('cmd.options'), width: 420,
      body: h('div.form', h('label.wd-label', W.t('opt.uiLang'), lang), h('label.wd-label', W.t('opt.theme'), theme),
        h('label.wd-label', W.t('opt.codeSize'), size), h('label.wd-check', reopen, ' ' + W.t('opt.reopen'))),
      buttons: [{ label: W.t('common.cancel'), value: null }, { label: W.t('common.save'), primary: true, action: function () {
        W.store.setSetting('reopen', reopen.checked);
        document.documentElement.setAttribute('data-theme', theme.value);
        W.store.setSetting('theme', theme.value);
        W.store.setSetting('codeSize', +size.value);
        app.applyCodeSize(+size.value);
        if (lang.value !== W.i18n.lang) app.setUiLang(lang.value);
      } }]
    });
  };

  app.setUiLang = function (lang) {
    W.store.setSetting('uiLang', lang);
    app.saveNow().then(function () { location.reload(); });
  };

  /* =====================================================================
   * Keyboard, status bar
   * ===================================================================== */

  app.onKey = function (e) {
    var mod = U.mod(e);
    var k = e.key;
    var inDialog = document.querySelector('.wd-back');
    if (inDialog) return;
    if (k === 'F5' && !e.shiftKey) { e.preventDefault(); app.cmd(app.runMode === 'php' ? 'runPhp' : 'run'); return; }
    if (k === 'F5' && e.shiftKey) { e.preventDefault(); app.cmd('stop'); return; }
    if (k === 'F7' && !e.shiftKey) { e.preventDefault(); app.cmd('viewCode'); return; }
    if (k === 'F7' && e.shiftKey) { e.preventDefault(); app.cmd('viewDesigner'); return; }
    if (k === 'F4') { e.preventDefault(); app.cmd('properties'); return; }
    if (k === 'F1') { e.preventDefault(); var ad = app.activeDoc(); app.openHelp(ad && ad.kind === 'code' ? 'language' : 'start'); return; }
    if (mod && (k === 's' || k === 'S')) { e.preventDefault(); app.cmd('save'); return; }
    if (mod && (k === 'o' || k === 'O')) { e.preventDefault(); app.cmd('openProject'); return; }
    if (mod && (k === 'n' || k === 'N') && !e.shiftKey) { e.preventDefault(); app.cmd('newProject'); return; }
    if (mod && (k === 'e' || k === 'E')) { e.preventDefault(); app.cmd('export'); return; }
    if (mod && e.shiftKey && (k === 'b' || k === 'B')) { e.preventDefault(); app.cmd('build'); return; }
    if (e.shiftKey && e.altKey && (k === 'f' || k === 'F' || e.code === 'KeyF')) { e.preventDefault(); app.cmd('format'); return; }
    var doc = app.activeDoc();
    var t = e.target;
    var typing = t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
    if (doc && doc.kind === 'design' && !typing && t.closest && !t.closest('.dock') ) {
      // keys for the designer when the focus is somewhere on the page area
      if (t === document.body || (t.closest && t.closest('.designer'))) {
        if (mod && (k === 'z' || k === 'Z') && !e.shiftKey) { e.preventDefault(); app.cmd('undo'); return; }
        if (mod && (k === 'y' || k === 'Y' || ((k === 'z' || k === 'Z') && e.shiftKey))) { e.preventDefault(); app.cmd('redo'); return; }
      }
    }
    if (!typing && mod && (k === 'z' || k === 'Z') && !e.shiftKey && doc && doc.kind !== 'code') { e.preventDefault(); app.cmd('undo'); return; }
    if (!typing && mod && (k === 'y' || k === 'Y') && doc && doc.kind !== 'code') { e.preventDefault(); app.cmd('redo'); return; }
    if (k === 'F2' && !typing && app.selection && doc && doc.kind === 'design') {
      e.preventDefault();
      var f = U.$('.props-row[data-key=name] input');
      if (f) { app.props.setMode('props'); f = U.$('.props-row[data-key=name] input'); f.focus(); f.select(); }
    }
  };

  app.status = function (text) {
    if (app.statusText) app.statusText.textContent = text;
  };
  app.output = function (text, kind, where) {
    app.outputPanel.write(text, kind, where);
    if (kind === 'error' || kind === 'print' || kind === 'server') {
      if (app.bottomTab !== 'output' && kind !== 'error') app.showBottom('output');
    }
  };
  app.updateStatusbar = function () {
    var p = app.project;
    app.statusStore.textContent = W.store.mode === 'server' ? W.t('status.storeServer') : W.t('status.storeBrowser');
    var doc = app.activeDoc();
    if (!doc || doc.kind !== 'code') app.statusCaret.textContent = '';
    if (!p) { app.statusErr.textContent = ''; }
  };

  /* =====================================================================
   * Boot
   * ===================================================================== */

  /** Size of the code in the editors (the line height follows it, in whole pixels). */
  app.applyCodeSize = function (size) {
    if (!size) return;
    var root = document.documentElement.style;
    root.setProperty('--code-size', size + 'px');
    root.setProperty('--code-lh', Math.round(size * 1.5) + 'px');
    app.docs.forEach(function (d) { if (d.kind === 'code' && d.component) d.component.refresh(); });
    if (app.translation) app.translation.editor.refresh();
  };

  W.boot = function () {
    app.applyCodeSize(W.store.setting('codeSize', null));
    app.init();
  };
})(typeof window !== 'undefined' ? window : globalThis);
