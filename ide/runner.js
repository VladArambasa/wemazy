/*!
 * Wemazy IDE - running the site (F5).
 *   browser: the site runs in a frame; server functions and the database run
 *            in the browser test server (runtime/server.js)
 *   php:     the site is written to sites/<name>/ on the PHP server and opened there
 */
(function (root) {
  'use strict';
  var W = root.Wemazy = root.Wemazy || {};
  var U = W.util, h = U.h, P = W.Project;

  function Runner(app, host) {
    this.app = app;
    this.host = host;
    this.history = [];
    this.device = 'desktop';
    this.server = null;
    this.mode = 'browser';
    this.runtimeErrors = [];
    this.build();
    var self = this;
    this._onMessage = function (e) { self.onMessage(e); };
    window.addEventListener('message', this._onMessage);
  }
  var R = Runner.prototype;

  R.build = function () {
    var self = this;
    this.el = h('div.runner');
    this.pageSel = h('select.tb-select', { 'aria-label': W.t('run.page'), onchange: function () { self.openPage(self.pageSel.value); } });
    this.addr = h('span.run-addr');
    this.devBtns = {};
    var bar = h('div.dz-bar.run-bar',
      h('button.tb-btn', { type: 'button', title: W.t('run.back'), 'aria-label': W.t('run.back'), html: W.icons.svg('left'), onclick: function () { self.back(); } }),
      h('button.tb-btn', { type: 'button', title: W.t('run.reload'), 'aria-label': W.t('run.reload'), html: W.icons.svg('refresh'), onclick: function () { self.reload(); } }),
      this.pageSel, this.addr, h('span.grow'));
    ['desktop', 'tablet', 'phone'].forEach(function (d) {
      var b = h('button.tb-btn', { type: 'button', title: W.t('dz.' + d), 'aria-label': W.t('dz.' + d), html: W.icons.svg(d), onclick: function () { self.setDevice(d); } });
      self.devBtns[d] = b;
      bar.appendChild(b);
    });
    this.newTabBtn = h('button.tb-btn.text', { type: 'button', onclick: function () { self.openNewTab(); } }, W.t('run.newTab'));
    bar.appendChild(this.newTabBtn);
    this.resetBtn = h('button.tb-btn.text', { type: 'button', onclick: function () { self.app.cmd('resetData'); } }, W.t('run.resetData'));
    bar.appendChild(this.resetBtn);
    this.view = h('div.run-view');
    this.frameWrap = h('div.run-wrap');
    this.view.appendChild(this.frameWrap);
    this.el.appendChild(bar);
    this.el.appendChild(this.view);
    this.host.appendChild(this.el);
    this.setDevice(W.store.setting('runDevice', 'desktop'));
  };

  R.setDevice = function (d) {
    this.device = d;
    W.store.setSetting('runDevice', d);
    Object.keys(this.devBtns).forEach(function (k) { this.devBtns[k].classList.toggle('on', k === d); }, this);
    this.frameWrap.style.width = d === 'desktop' ? '100%' : (W.Designer.DEVICES[d] + 'px');
    this.frameWrap.classList.toggle('device', d !== 'desktop');
  };

  /** Start the site. mode: 'browser' | 'php' */
  R.start = function (mode, pageName) {
    var self = this, app = this.app, p = app.project;
    this.mode = mode || 'browser';
    this.runtimeErrors = [];
    var result = W.build.compile(p, true);
    app.showErrors(result);
    if (!result.ok) return Promise.resolve(false);
    U.clear(this.pageSel);
    p.pages.forEach(function (pg) { self.pageSel.appendChild(h('option', { value: pg.name }, pg.name)); });
    this.history = [];
    this.newTabBtn.style.display = this.mode === 'php' ? '' : 'none';
    this.resetBtn.style.display = p.tables.length ? '' : 'none';
    if (this.mode === 'php') return this.startPhp(pageName);
    return this.startServer(result).then(function () {
      app.output(W.t('run.started', p.name), 'info');
      self.openPage(pageName || p.pages[0].name);
      return true;
    });
  };

  /** The browser test server, with the data kept from the last run. */
  R.startServer = function (result) {
    var self = this, p = this.app.project;
    var core = W.runtime.core();
    core.lang = W.i18n.lang;
    return W.store.getSim(p.id).then(function (data) {
      self.server = W.runtime.server(core, {
        data: data || null,
        lang: W.i18n.lang,
        print: function (t) { self.app.output(t, 'server'); },
        save: function (d) { W.store.setSim(p.id, d); W.bus.emit('sim-data'); }
      });
      self.server.sync(p.tables);
      try { self.server.load(result.server.js); } catch (e) { self.app.output('Server code: ' + e.message, 'error'); }
    });
  };

  R.startPhp = function (pageName) {
    var self = this, p = this.app.project;
    var out = W.build.siteFiles(p, 'php', { debug: true, dbName: 'site' });
    var files = {};
    out.files.forEach(function (f) {
      files[f.name] = typeof f.data === 'string' ? { text: f.data } : { b64: U.bytesToBase64(f.data) };
    });
    this.app.status(W.t('run.uploading'));
    return W.store.deploy(p.id, files, p.name).then(function (d) {
      self.siteUrl = d.url;
      self.app.output(W.t('run.startedPhp', d.url), 'info');
      self.openPage(pageName || p.pages[0].name);
      self.app.status(W.t('status.running'));
      return true;
    }, function (e) {
      self.app.output(W.t('run.phpFailed', e.message), 'error');
      U.alert(W.t('run.phpFailedTitle'), W.t('run.phpFailed', e.message));
      return false;
    });
  };

  R.openPage = function (name, fromHistory) {
    var p = this.app.project;
    var pg = P.pageByName(p, name) || p.pages[0];
    if (!pg) return;
    if (!fromHistory && this.current && this.current !== pg.name) this.history.push(this.current);
    this.current = pg.name;
    this.pageSel.value = pg.name;
    var file = P.pageFile(p, pg);
    U.clear(this.frameWrap);
    var frame = h('iframe.run-frame', { title: W.t('run.frameTitle') });
    if (this.mode === 'php') frame.setAttribute('allow', 'autoplay; fullscreen; clipboard-write');
    this.frame = frame;
    this.frameWrap.appendChild(frame);
    if (this.mode === 'php') {
      frame.src = this.siteUrl + file + '?t=' + Date.now();
      this.addr.textContent = this.siteUrl + file;
    } else {
      var result = W.build.compile(p, true);
      frame.srcdoc = W.build.previewDoc(p, pg, result);
      this.addr.textContent = file;
    }
    this.app.status(W.t('status.running'));
  };
  R.reload = function () { if (this.current) this.openPage(this.current, true); };
  R.back = function () {
    var prev = this.history.pop();
    if (prev) this.openPage(prev, true);
  };
  R.openNewTab = function () {
    if (this.mode === 'php' && this.siteUrl) {
      var pg = P.pageByName(this.app.project, this.current);
      window.open(this.siteUrl + (pg ? P.pageFile(this.app.project, pg) : ''), '_blank', 'noopener');
    }
  };
  R.stop = function () {
    window.removeEventListener('message', this._onMessage);
    U.clear(this.frameWrap);
    this.frame = null;
    this.current = null;
    this.server = null;
  };

  /** Messages from the running page (print, errors, server calls, links). */
  R.onMessage = function (e) {
    var d = e.data;
    if (!d || !d.wemazy || !this.frame || e.source !== this.frame.contentWindow) return;
    var self = this, app = this.app;
    switch (d.wemazy) {
      case 'print':
        app.output(d.text, 'print', null);
        break;
      case 'error': {
        var where = d.file ? { file: d.file, line: d.line } : null;
        app.output(d.message, 'error', where);
        this.runtimeErrors.push({ msg: d.message, file: d.file || '', line: d.line || 0, col: 1 });
        app.runtimeErrors(this.runtimeErrors);
        break;
      }
      case 'go': {
        var p = app.project;
        var pg = p.pages.filter(function (x) { return P.pageFile(p, x) === d.file || x.name === d.file; })[0];
        if (pg) this.openPage(pg.name);
        else app.output(W.t('run.noFile', d.file), 'error');
        break;
      }
      case 'back':
        this.back();
        break;
      case 'call': {
        var srv = this.server;
        var reply = function (msg) {
          try { e.source.postMessage(Object.assign({ wemazy: 'result', id: d.id }, msg), '*'); } catch (err) { /* page gone */ }
        };
        if (!srv) { reply({ ok: false, error: W.t('run.noServer') }); return; }
        var pl = d.payload || {};
        var job;
        try {
          job = pl.fn !== undefined ? srv.call(pl.fn, pl.args) : srv.query(pl.q, pl.args);
        } catch (err) { job = Promise.reject(err); }
        Promise.resolve(job).then(function (v) { reply({ ok: true, value: v === undefined ? null : v }); },
          function (err) {
            reply({ ok: false, error: srv.wz.errmsg(err), file: err && err.wzFile || null, line: err && err.wzLine || null });
          });
        void self;
        break;
      }
    }
  };

  W.Runner = Runner;
})(typeof window !== 'undefined' ? window : globalThis);
