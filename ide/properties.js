/*!
 * Wemazy IDE - the Properties window (and its Events tab).
 */
(function (root) {
  'use strict';
  var W = root.Wemazy = root.Wemazy || {};
  var U = W.util, h = U.h, P = W.Project, C = W.controls;

  var CAT_ORDER = ['design', 'content', 'layout', 'appearance', 'behavior'];
  var STYLE_BOOLS = { bold: 1, italic: 1, underline: 1 };
  var DEFAULT_TRUE = { visible: 1, enabled: 1, showValue: 1, striped: 1, stackOnPhone: 1, sticky: 1, controls: 1, inMenu: 1 };
  var PAGE_PROPS = ['name', 'title', 'description', 'inMenu', 'background', 'bgImage', 'color', 'font', 'align', 'gap', 'padding'];

  function Props(app, host) {
    this.app = app;
    this.host = host;
    this.mode = 'props';
    this.alpha = W.store.setting('propsAlpha', false);
    this.collapsed = {};
    this.build();
  }
  var R = Props.prototype;

  R.build = function () {
    var self = this;
    this.el = h('div.props');
    this.picker = h('select.props-pick', { 'aria-label': W.t('props.pick'), onchange: function () { self.app.select(self.page, self.picker.value); } });
    this.tools = h('div.props-tools',
      this.btnCat = h('button.tb-btn', { type: 'button', title: W.t('props.categorized'), html: W.icons.svg('category'), onclick: function () { self.setAlpha(false); } }),
      this.btnAlpha = h('button.tb-btn', { type: 'button', title: W.t('props.alpha'), html: W.icons.svg('alpha'), onclick: function () { self.setAlpha(true); } }),
      h('span.sep'),
      this.btnProps = h('button.tb-btn', { type: 'button', title: W.t('props.properties'), html: W.icons.svg('props'), onclick: function () { self.setMode('props'); } }),
      this.btnEvents = h('button.tb-btn', { type: 'button', title: W.t('props.events'), html: W.icons.svg('events'), onclick: function () { self.setMode('events'); } }),
      h('span.grow'),
      this.search = h('input.input.small.props-search', { type: 'search', placeholder: W.t('props.search'), 'aria-label': W.t('props.search'), oninput: function () { self.render(); } }));
    this.grid = h('div.props-grid', { role: 'grid' });
    this.desc = h('div.props-desc');
    this.el.appendChild(this.picker);
    this.el.appendChild(this.tools);
    this.el.appendChild(this.grid);
    this.el.appendChild(this.desc);
    this.host.appendChild(this.el);
    this.setAlpha(this.alpha, true);
    this.setMode('props', true);
    this.render();
  };
  R.setAlpha = function (v, quiet) {
    this.alpha = v;
    W.store.setSetting('propsAlpha', v);
    this.btnAlpha.classList.toggle('on', v);
    this.btnCat.classList.toggle('on', !v);
    if (!quiet) this.render();
  };
  R.setMode = function (m, quiet) {
    this.mode = m;
    this.btnProps.classList.toggle('on', m === 'props');
    this.btnEvents.classList.toggle('on', m === 'events');
    this.btnCat.disabled = this.btnAlpha.disabled = m === 'events';
    if (!quiet) this.render();
  };

  /** Show the properties of an element of a page (id 'root' = the page). */
  R.show = function (page, id) {
    this.page = page;
    this.id = id;
    this.render();
  };

  R.render = function () {
    var self = this;
    U.clear(this.grid);
    U.clear(this.picker);
    var page = this.page;
    this.el.classList.toggle('none', !page || !this.app.project);
    if (!page || !this.app.project) {
      this.grid.appendChild(h('div.empty', W.t('props.none')));
      this.desc.textContent = '';
      return;
    }
    // the list of controls on the page
    var opt = h('option', { value: 'root' }, page.name + '  (' + W.t('props.page') + ')');
    this.picker.appendChild(opt);
    P.walk(page.root, function (el, parent, i) {
      if (el === page.root) return;
      var depth = 0, f = P.find(page, el.id);
      while (f && f.parent && f.parent !== page.root) { depth++; f = P.find(page, f.parent.id); }
      self.picker.appendChild(h('option', { value: el.id }, new Array(depth + 1).join('   ') + el.name + '  (' + W.t('ctl.' + el.type) + ')'));
      void i;
    });
    this.picker.value = this.id || 'root';
    var f = P.find(page, this.id || 'root');
    if (!f) return;
    this.el.classList.toggle('events', this.mode === 'events');
    if (this.mode === 'events') this.renderEvents(f.el);
    else this.renderProps(f.el);
  };

  R.renderProps = function (el) {
    var self = this, isPage = el === this.page.root;
    var found = isPage ? null : P.find(this.page, el.id);
    var keys = isPage ? PAGE_PROPS.slice() : ['name'].concat(C.propsOf(el, found && found.parent));
    var q = W.lang.norm(this.search.value || '');
    if (q) keys = keys.filter(function (k) { return W.lang.norm(W.t('prop.' + k)).indexOf(q) >= 0 || k.toLowerCase().indexOf(q) >= 0; });
    var groups = {};
    keys.forEach(function (k) {
      var cat = k === 'name' ? 'design' : (C.props[k] ? C.props[k].cat : 'content');
      if (isPage && (k === 'title' || k === 'description')) cat = 'content';
      (groups[cat] || (groups[cat] = [])).push(k);
    });
    var addRow = function (k) { self.grid.appendChild(self.row(el, k, isPage)); };
    if (this.alpha) {
      keys.slice().sort(function (a, b) { return W.t('prop.' + a).localeCompare(W.t('prop.' + b)); }).forEach(addRow);
    } else {
      CAT_ORDER.forEach(function (cat) {
        if (!groups[cat]) return;
        var closed = !!self.collapsed[cat];
        self.grid.appendChild(h('button.props-cat', { type: 'button', 'aria-expanded': closed ? 'false' : 'true',
          onclick: function () { self.collapsed[cat] = !closed; self.render(); } },
          h('span.ic-wrap', { html: W.icons.svg(closed ? 'right' : 'down') }), W.t('cat.' + cat)));
        if (!closed) groups[cat].forEach(addRow);
      });
    }
    if (!keys.length) this.grid.appendChild(h('div.empty', W.t('props.noMatch')));
    this.describe(this.focusKey && keys.indexOf(this.focusKey) >= 0 ? this.focusKey : (isPage ? 'title' : 'name'), el);
  };

  R.describe = function (k, el) {
    var type = el && el !== this.page.root ? W.t('ctl.' + el.type) : W.t('props.page');
    this.desc.innerHTML = '';
    this.desc.appendChild(h('b', W.t('prop.' + k)));
    this.desc.appendChild(h('span', ' ' + W.t('pdesc.' + k, type)));
  };

  R.commit = function (label) { this.app.changed(label || W.t('undo.prop')); };

  /** One row: label + editor. */
  R.row = function (el, k, isPage) {
    var self = this;
    var p = el.props;
    var label = h('label.props-l', { title: W.t('pdesc.' + k, '') }, W.t('prop.' + k));
    var val = h('div.props-v');
    var row = h('div.props-row', { role: 'row', dataset: { key: k } }, label, val);
    row.addEventListener('focusin', function () { self.focusKey = k; self.describe(k, el); });
    row.addEventListener('mouseenter', function () { self.describe(k, el); });
    var type = isPage ? pageType(k) : C.propType(el, k);
    var id = 'pp-' + k;
    label.setAttribute('for', id);
    var get = function () { return isPage && (k === 'name' || k === 'title' || k === 'description' || k === 'inMenu') ? self.page[k] : p[k]; };
    var set = function (v, live) {
      if (isPage && (k === 'name' || k === 'title' || k === 'description' || k === 'inMenu')) self.page[k] = v;
      else if (v === '' || v === null || v === undefined) delete p[k];
      else p[k] = v;
      if (live) self.app.changedLive(); else self.commit();
    };
    var input;
    switch (type) {
      case 'name': {
        input = h('input.input.small', { id: id, type: 'text', value: isPage ? this.page.name : el.name, spellcheck: false });
        input.addEventListener('change', function () {
          var v = input.value.trim();
          if (isPage) {
            var e1 = P.checkPageName(self.app.project, v, self.page);
            if (e1) { U.toast(e1, 'bad'); input.value = self.page.name; return; }
            self.app.renamePage(self.page, v);
            return;
          }
          if (v === el.name) return;
          var err = P.checkName(self.app.project, self.page, v, el);
          if (err) { U.toast(err, 'bad'); input.value = el.name; return; }
          self.app.renameControl(self.page, el, v);
        });
        break;
      }
      case 'text': case 'size': case 'spacing': {
        input = h('input.input.small', { id: id, type: 'text', value: get() === undefined ? '' : String(get()), spellcheck: type === 'text' });
        if (type === 'size') input.placeholder = 'auto';
        input.addEventListener('input', function () { set(type === 'text' ? input.value : sizeVal(input.value), true); });
        input.addEventListener('change', function () { self.commit(); });
        break;
      }
      case 'textarea': case 'lines': case 'code': {
        input = h('input.input.small', { id: id, type: 'text', value: oneLine(get()), spellcheck: type !== 'code' });
        if (type === 'lines' || type === 'code') input.readOnly = true;
        input.addEventListener('input', function () { set(input.value, true); });
        input.addEventListener('change', function () { self.commit(); });
        if (type !== 'textarea') input.addEventListener('dblclick', function () { more.click(); });
        var more = h('button.props-more', { type: 'button', title: W.t('props.edit'), 'aria-label': W.t('props.edit') }, '…');
        more.addEventListener('click', function () {
          self.bigEdit(W.t('prop.' + k), get() || '', type, function (v) { set(v); });
        });
        val.appendChild(input);
        val.appendChild(more);
        input = null;
        break;
      }
      case 'number': {
        input = h('input.input.small', { id: id, type: 'number', value: get() === undefined ? '' : get() });
        var def = C.props[k] || {};
        if (def.min !== undefined) input.min = def.min;
        if (def.max !== undefined) input.max = def.max;
        input.addEventListener('input', function () { set(input.value === '' ? '' : +input.value, true); });
        input.addEventListener('change', function () { self.commit(); });
        break;
      }
      case 'bool': {
        if (STYLE_BOOLS[k]) {
          input = h('select.input.small', { id: id },
            h('option', { value: '' }, W.t('props.default')), h('option', { value: 'yes' }, W.t('common.yes')), h('option', { value: 'no' }, W.t('common.no')));
          input.value = get() === true ? 'yes' : get() === false ? 'no' : '';
          input.addEventListener('change', function () { set(input.value === '' ? '' : input.value === 'yes'); });
          break;
        }
        var on = DEFAULT_TRUE[k] ? get() !== false : !!get();
        input = h('input.props-check', { id: id, type: 'checkbox' });
        input.checked = on;
        input.addEventListener('change', function () {
          var v = input.checked;
          if (DEFAULT_TRUE[k]) set(v ? (isPage ? true : '') : false);
          else set(v ? true : (isPage ? false : ''));
        });
        break;
      }
      case 'select': case 'font': {
        var opts = type === 'font' ? Object.keys(C.fonts) : (C.propOptions(el, k) || []);
        input = h('select.input.small', { id: id });
        if (type !== 'font') input.appendChild(h('option', { value: '' }, W.t('props.default')));
        opts.forEach(function (o) {
          var lab = type === 'font' ? W.t('font.' + o) : W.t('opt.' + k + '.' + o);
          if (lab === 'opt.' + k + '.' + o) lab = o;
          input.appendChild(h('option', { value: o === 'theme' ? '' : o }, lab));
        });
        input.value = get() === undefined || get() === null ? '' : String(get());
        input.addEventListener('change', function () {
          var v = input.value;
          if (v !== '' && (k === 'count')) v = String(v);
          set(v);
          if (k === 'count' && el.type === 'Columns') { P.syncColumns(self.app.project, self.page, el); self.commit(); }
          if (k === 'layout') self.render();
        });
        break;
      }
      case 'color': {
        var txt = h('input.input.small', { id: id, type: 'text', value: get() || '', placeholder: W.t('props.default'), spellcheck: false });
        var sw = h('input.props-swatch', { type: 'color', 'aria-label': W.t('prop.' + k), title: W.t('props.pickColor') });
        var hex = /^#[0-9a-f]{6}$/i.test(get() || '') ? get() : '#000000';
        sw.value = hex;
        sw.classList.toggle('empty', !get());
        sw.addEventListener('input', function () { sw.classList.remove('empty'); txt.value = sw.value; set(sw.value, true); });
        sw.addEventListener('change', function () { self.commit(); });
        txt.addEventListener('input', function () {
          var v = txt.value.trim();
          sw.classList.toggle('empty', !v);
          if (/^#[0-9a-f]{6}$/i.test(v)) sw.value = v;
          set(v, true);
        });
        txt.addEventListener('change', function () { self.commit(); });
        var pal = h('button.props-more', { type: 'button', title: W.t('props.themeColors'), 'aria-label': W.t('props.themeColors'), html: W.icons.svg('down') });
        pal.addEventListener('click', function (e) {
          var r = pal.getBoundingClientRect();
          self.palette(r.left - 180, r.bottom + 2, function (c, hex) {
            txt.value = c;
            if (/^#[0-9a-f]{6}$/i.test(hex || c)) sw.value = hex || c;
            sw.classList.toggle('empty', c === 'transparent');
            set(c);
          });
          e.stopPropagation();
        });
        val.appendChild(sw);
        val.appendChild(txt);
        val.appendChild(pal);
        input = null;
        break;
      }
      case 'image': {
        input = h('input.input.small', { id: id, type: 'text', value: get() || '', placeholder: W.t('props.imageHint'), spellcheck: false, list: 'pp-assets' });
        input.addEventListener('input', function () { set(input.value.trim(), true); });
        input.addEventListener('change', function () { self.commit(); });
        var pick = h('button.props-more', { type: 'button', title: W.t('props.pickImage'), 'aria-label': W.t('props.pickImage'), html: W.icons.svg('images') });
        pick.addEventListener('click', function () {
          self.app.pickAsset('image').then(function (name) { if (name) { input.value = name; set(name); } });
        });
        val.appendChild(input);
        val.appendChild(pick);
        val.appendChild(this.assetList());
        input = null;
        break;
      }
      case 'link': {
        input = h('input.input.small', { id: id, type: 'text', value: get() || '', placeholder: W.t('props.linkHint'), spellcheck: false, list: 'pp-pages' });
        input.addEventListener('input', function () { set(input.value.trim(), true); });
        input.addEventListener('change', function () { self.commit(); });
        val.appendChild(input);
        val.appendChild(this.pageList());
        input = null;
        break;
      }
      default: {
        input = h('input.input.small', { id: id, type: 'text', value: get() === undefined ? '' : String(get()) });
        input.addEventListener('input', function () { set(input.value, true); });
        input.addEventListener('change', function () { self.commit(); });
      }
    }
    if (input) val.appendChild(input);
    if (p[k] !== undefined && p[k] !== '' && !isPage && k !== 'name') row.classList.add('set');
    return row;
  };
  function pageType(k) {
    return { name: 'name', title: 'text', description: 'textarea', inMenu: 'bool', background: 'color', bgImage: 'image', color: 'color', font: 'font', align: 'select', gap: 'number', padding: 'number' }[k] || 'text';
  }
  function oneLine(v) { return v === undefined || v === null ? '' : String(v).replace(/\n/g, ' ⏎ '); }
  function sizeVal(v) {
    v = String(v).trim();
    if (v === '') return '';
    return /^-?\d+(\.\d+)?$/.test(v) ? +v : v;
  }

  R.assetList = function () {
    var dl = h('datalist', { id: 'pp-assets' });
    (this.app.project.assets || []).forEach(function (a) { dl.appendChild(h('option', { value: a.name })); });
    return dl;
  };
  R.pageList = function () {
    var dl = h('datalist', { id: 'pp-pages' });
    this.app.project.pages.forEach(function (pg) { dl.appendChild(h('option', { value: pg.name })); });
    return dl;
  };

  R.palette = function (x, y, pick) {
    var t = this.app.project.settings.theme;
    var colors = [
      ['theme', [['var(--wz-primary)', t.primary], ['var(--wz-text)', t.text], ['var(--wz-bg)', t.background], ['var(--wz-surface)', t.surface], ['var(--wz-border)', t.border]]],
      ['basic', [['#ffffff'], ['#000000'], ['#e11d48'], ['#f97316'], ['#facc15'], ['#16a34a'], ['#0ea5e9'], ['#4f46e5'], ['#9333ea'], ['#64748b'], ['transparent']]]
    ];
    var box = h('div.wm-menu.palette');
    colors.forEach(function (g) {
      box.appendChild(h('div.pal-title', W.t('props.pal.' + g[0])));
      var row = h('div.pal-row');
      g[1].forEach(function (c) {
        var b = h('button.pal-sw', { type: 'button', title: c[0], style: { background: c[1] || c[0] },
          onclick: function () { U.closeMenu(); pick(c[0], c[1]); } });
        row.appendChild(b);
      });
      box.appendChild(row);
    });
    var m = U.menu([], x, y, { focus: false });
    m.appendChild(box);
  };

  /** A bigger editor for long texts and lists. */
  R.bigEdit = function (title, value, type, done) {
    var ta = h('textarea.input.big', { rows: type === 'code' ? 14 : 8, spellcheck: type !== 'code', class: type === 'code' ? 'mono' : '' });
    ta.value = value;
    var hint = type === 'lines' ? h('p.wd-hint', W.t('props.linesHint')) : (type === 'textarea' ? h('p.wd-hint', W.t('props.textHint')) : null);
    U.dialog({
      title: title, width: 520, body: h('div.no-enter', hint, ta),
      buttons: [{ label: W.t('common.cancel'), value: null }, { label: W.t('common.ok'), primary: true, action: function () { done(ta.value); } }]
    });
  };

  /* ---------------- events ---------------- */

  R.renderEvents = function (el) {
    var self = this, page = this.page;
    var isPage = el === page.root;
    var vocab = P.vocab(this.app.project);
    var events = isPage ? { load: 'load' } : ((C.get(el.type) || {}).events || {});
    var keys = Object.keys(events);
    var handlers = this.app.handlersOf(page);
    if (!keys.length) { this.grid.appendChild(h('div.empty', W.t('props.noEvents'))); this.desc.textContent = ''; return; }
    keys.forEach(function (k) {
      var name = isPage ? vocab.say('pageloads') : vocab.say('ev.' + k);
      var hd = handlers.filter(function (x) {
        if (isPage) return x.ev && x.ev.kind === 'load';
        return x.ev && x.ev.kind === 'control' && W.lang.norm(x.ev.name) === W.lang.norm(el.name) && x.ev.event === k;
      })[0];
      var go = function () { self.app.goToEvent(page, isPage ? null : el, k); };
      var row = h('div.props-row.ev', { role: 'row' },
        h('span.props-l', { html: W.icons.svg('events') + ' ' + U.esc(name) }),
        h('div.props-v', h('button.ev-btn', { type: 'button', class: hd ? 'has' : '', onclick: go, title: W.t('props.goEvent') },
          hd ? W.t('props.atLine', hd.line) : W.t('props.addEvent'))));
      row.addEventListener('dblclick', go);
      row.addEventListener('mouseenter', function () {
        self.desc.innerHTML = '';
        self.desc.appendChild(h('b', name));
        self.desc.appendChild(h('span', ' ' + W.t('evdesc.' + (isPage ? 'load' : k))));
      });
      self.grid.appendChild(row);
    });
    this.desc.innerHTML = '';
    this.desc.appendChild(h('span', W.t('props.eventsHelp')));
  };

  W.Props = Props;
})(typeof window !== 'undefined' ? window : globalThis);
