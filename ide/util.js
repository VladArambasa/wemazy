/*!
 * Wemazy IDE - small helpers used everywhere: DOM building, dialogs, menus,
 * toasts, files, events.
 */
(function (root) {
  'use strict';
  var W = root.Wemazy = root.Wemazy || {};
  var U = W.util = {};

  U.$ = function (sel, el) { return (el || document).querySelector(sel); };
  U.$$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };

  /**
   * h('div.cls#id', { attr: v, onclick: fn, style: {...} }, children...)
   * children: strings, nodes, arrays, null.
   */
  U.h = function (tag, attrs) {
    var m = /^([\w-]+)?((?:[.#][\w-]+)*)$/.exec(tag) || [];
    var el = document.createElement(m[1] || 'div');
    (m[2] || '').replace(/([.#])([\w-]+)/g, function (_, k, v) {
      if (k === '.') el.classList.add(v); else el.id = v;
    });
    var kids = Array.prototype.slice.call(arguments, 2);
    if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
      kids.unshift(attrs);
      attrs = null;
    }
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'class') String(v).split(/\s+/).filter(Boolean).forEach(function (c) { el.classList.add(c); });
        else if (k === 'dataset') Object.keys(v).forEach(function (d) { el.dataset[d] = v[d]; });
        else if (k in el && k !== 'list' && k !== 'form' && typeof v !== 'string') el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    append(el, kids);
    return el;
  };
  function append(el, kids) {
    kids.forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      if (Array.isArray(c)) append(el, c);
      else if (c instanceof Node) el.appendChild(c);
      else el.appendChild(document.createTextNode(String(c)));
    });
  }
  U.clear = function (el) { while (el && el.firstChild) el.removeChild(el.firstChild); return el; };

  U.esc = function (s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  U.uid = function (p) {
    return (p || 'x') + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  };
  U.debounce = function (fn, ms) {
    var t = null;
    var d = function () {
      var args = arguments, self = this;
      if (t) clearTimeout(t);
      t = setTimeout(function () { t = null; fn.apply(self, args); }, ms);
    };
    d.flush = function () { if (t) { clearTimeout(t); t = null; fn(); } };
    d.cancel = function () { if (t) { clearTimeout(t); t = null; } };
    return d;
  };
  U.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  U.clone = function (o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); };
  U.slug = function (s) {
    var out = W.lang.norm(String(s)).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return out || 'page';
  };
  U.fmtBytes = function (n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  };
  U.isMac = /Mac|iPhone|iPad/.test(navigator.platform || '');
  U.mod = function (e) { return U.isMac ? e.metaKey : e.ctrlKey; };

  /* ---------------- events ---------------- */

  var handlers = {};
  W.bus = {
    on: function (ev, fn) { (handlers[ev] || (handlers[ev] = [])).push(fn); return function () { W.bus.off(ev, fn); }; },
    off: function (ev, fn) { handlers[ev] = (handlers[ev] || []).filter(function (f) { return f !== fn; }); },
    emit: function (ev, data) {
      (handlers[ev] || []).slice().forEach(function (fn) {
        try { fn(data); } catch (e) { console.error(e); }
      });
    }
  };

  /* ---------------- files ---------------- */

  U.download = function (name, data, type) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: type || 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = U.h('a', { href: url, download: name, style: { display: 'none' } });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 2000);
  };
  /** Ask for files. opts: { accept, multiple, as: 'text'|'dataurl'|'buffer' } -> Promise<[{name, type, size, data}]> */
  U.pickFiles = function (opts) {
    opts = opts || {};
    return new Promise(function (res) {
      var inp = U.h('input', { type: 'file', accept: opts.accept || '', style: { display: 'none' } });
      if (opts.multiple) inp.multiple = true;
      inp.addEventListener('change', function () {
        var files = Array.prototype.slice.call(inp.files || []);
        inp.remove();
        Promise.all(files.map(function (f) { return U.readFile(f, opts.as); })).then(res);
      });
      document.body.appendChild(inp);
      inp.click();
    });
  };
  U.readFile = function (f, as) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res({ name: f.name, type: f.type, size: f.size, data: r.result }); };
      r.onerror = function () { rej(r.error); };
      if (as === 'dataurl') r.readAsDataURL(f);
      else if (as === 'buffer') r.readAsArrayBuffer(f);
      else r.readAsText(f);
    });
  };
  /** Make a big photo smaller before it goes into the project (keeps projects light). */
  U.shrinkImage = function (dataUrl, maxSide, type) {
    return new Promise(function (res) {
      if (!/^data:image\/(png|jpe?g|webp)/.test(dataUrl)) { res(dataUrl); return; }
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, hgt = img.naturalHeight, m = maxSide || 1600;
        if (w <= m && hgt <= m && dataUrl.length < 600000) { res(dataUrl); return; }
        var s = Math.min(1, m / Math.max(w, hgt));
        var c = document.createElement('canvas');
        c.width = Math.round(w * s);
        c.height = Math.round(hgt * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        var png = /^data:image\/png/.test(dataUrl);
        var out = c.toDataURL(type || (png ? 'image/png' : 'image/jpeg'), 0.86);
        res(out.length < dataUrl.length ? out : dataUrl);
      };
      img.onerror = function () { res(dataUrl); };
      img.src = dataUrl;
    });
  };
  U.dataUrlToBytes = function (dataUrl) {
    var m = /^data:([^;,]*)(;base64)?,(.*)$/.exec(dataUrl);
    if (!m) return new Uint8Array(0);
    if (m[2]) {
      var bin = atob(m[3]);
      var out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return new TextEncoder().encode(decodeURIComponent(m[3]));
  };
  U.bytesToBase64 = function (bytes) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  };
  U.copyText = function (s) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(s).catch(fallback);
    fallback();
    return Promise.resolve();
    function fallback() {
      var ta = U.h('textarea', { style: { position: 'fixed', left: '-9999px' } });
      ta.value = s;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* ignore */ }
      ta.remove();
    }
  };

  /* ---------------- floating UI: menus, dialogs, toasts ---------------- */

  var openMenu = null;
  U.closeMenu = function () {
    if (openMenu) { openMenu.remove(); openMenu = null; }
    document.removeEventListener('mousedown', outside, true);
    document.removeEventListener('keydown', menuKeys, true);
  };
  function outside(e) { if (openMenu && !openMenu.contains(e.target)) U.closeMenu(); }
  function menuKeys(e) {
    if (!openMenu) return;
    var items = U.$$('.wm-item:not(.disabled)', openMenu);
    var i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); U.closeMenu(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); (items[i + 1] || items[0]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (items[i - 1] || items[items.length - 1]).focus(); }
  }
  /**
   * Show a menu at (x, y). items: [{ label, icon, key, disabled, checked, action, sep }]
   */
  U.menu = function (items, x, y, opts) {
    U.closeMenu();
    opts = opts || {};
    var m = U.h('div.wm-menu', { role: 'menu' });
    items.forEach(function (it) {
      if (!it) return;
      if (it.sep) { m.appendChild(U.h('div.wm-sep')); return; }
      var b = U.h('button.wm-item', {
        type: 'button', role: 'menuitem', disabled: !!it.disabled,
        class: it.disabled ? 'disabled' : '',
        onclick: function () { if (it.disabled) return; U.closeMenu(); if (it.action) it.action(); }
      },
        U.h('span.wm-check', it.checked ? '✓' : ''),
        U.h('span.wm-icon', { html: it.icon ? W.icons.svg(it.icon) : '' }),
        U.h('span.wm-label', it.label),
        U.h('span.wm-key', it.key || ''));
      m.appendChild(b);
    });
    document.body.appendChild(m);
    var r = m.getBoundingClientRect();
    var vw = window.innerWidth, vh = window.innerHeight;
    m.style.left = Math.max(4, Math.min(x, vw - r.width - 4)) + 'px';
    m.style.top = Math.max(4, Math.min(y, vh - r.height - 4)) + 'px';
    openMenu = m;
    setTimeout(function () {
      document.addEventListener('mousedown', outside, true);
      document.addEventListener('keydown', menuKeys, true);
      if (opts.focus !== false) { var f = U.$('.wm-item:not(.disabled)', m); if (f) f.focus(); }
    }, 0);
    return m;
  };

  /**
   * A modal dialog. opts: { title, body (node|string), buttons: [{ label, primary, danger, value, action }], width, onClose }
   * Returns a Promise of the value of the button pressed (null when closed).
   */
  U.dialog = function (opts) {
    return new Promise(function (resolve) {
      var prev = document.activeElement;
      var back = U.h('div.wd-back');
      var box = U.h('div.wd-box', { role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || '', style: { width: opts.width ? opts.width + 'px' : '' } });
      var close = function (v) {
        document.removeEventListener('keydown', onKey, true);
        back.remove();
        if (prev && prev.focus) try { prev.focus(); } catch (e) { /* gone */ }
        if (opts.onClose) opts.onClose(v);
        resolve(v === undefined ? null : v);
      };
      var head = U.h('div.wd-head', U.h('div.wd-title', opts.title || ''),
        U.h('button.wd-x', { type: 'button', 'aria-label': W.t('common.close'), html: W.icons.svg('close'), onclick: function () { close(null); } }));
      var body = U.h('div.wd-body');
      if (typeof opts.body === 'string') body.innerHTML = opts.body; else if (opts.body) body.appendChild(opts.body);
      var foot = U.h('div.wd-foot');
      (opts.buttons || [{ label: W.t('common.ok'), primary: true, value: true }]).forEach(function (b) {
        foot.appendChild(U.h('button.btn', {
          type: 'button', class: (b.primary ? 'primary' : '') + (b.danger ? ' danger' : ''),
          onclick: function () {
            if (b.action) {
              var r = b.action(body);
              if (r === false) return;
              if (r && typeof r.then === 'function') { r.then(function (x) { if (x !== false) close(b.value !== undefined ? b.value : x); }); return; }
            }
            close(b.value);
          }
        }, b.label));
      });
      box.appendChild(head);
      box.appendChild(body);
      if ((opts.buttons || [1]).length) box.appendChild(foot);
      back.appendChild(box);
      document.body.appendChild(back);
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(null); }
        else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON' && !e.target.closest('.no-enter')) {
          var p = U.$('.wd-foot .btn.primary', box);
          if (p) { e.preventDefault(); p.click(); }
        }
      }
      document.addEventListener('keydown', onKey, true);
      setTimeout(function () {
        var f = U.$('[autofocus], input, select, textarea', body) || U.$('.wd-foot .btn.primary', box);
        if (f) { f.focus(); if (f.select && f.tagName === 'INPUT') f.select(); }
      }, 0);
      U.dialog.close = close;
    });
  };
  U.alert = function (title, message) {
    return U.dialog({ title: title, body: U.h('p.wd-text', message), buttons: [{ label: W.t('common.ok'), primary: true, value: true }] });
  };
  U.confirm = function (title, message, okLabel, danger) {
    return U.dialog({
      title: title, body: U.h('p.wd-text', message),
      buttons: [{ label: W.t('common.cancel'), value: false }, { label: okLabel || W.t('common.ok'), primary: true, danger: !!danger, value: true }]
    }).then(function (v) { return v === true; });
  };
  /** Ask for a text. check(value) returns an error message or null. */
  U.prompt = function (title, label, value, check, okLabel) {
    var inp = U.h('input.input', { type: 'text', value: value || '', autofocus: true, spellcheck: false });
    var err = U.h('div.wd-err');
    var body = U.h('div', U.h('label.wd-label', label, inp), err);
    return U.dialog({
      title: title, body: body,
      buttons: [{ label: W.t('common.cancel'), value: null }, {
        label: okLabel || W.t('common.ok'), primary: true,
        action: function () {
          var v = inp.value.trim();
          var problem = check ? check(v) : null;
          if (problem) { err.textContent = problem; inp.focus(); return false; }
          return Promise.resolve(v);
        }
      }]
    });
  };

  var toastBox = null;
  U.toast = function (message, kind, ms) {
    if (!toastBox) { toastBox = U.h('div.wt-box', { 'aria-live': 'polite' }); document.body.appendChild(toastBox); }
    var t = U.h('div.wt', { class: kind || '' }, message);
    toastBox.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); }, ms || 2600);
  };

  /** Draggable splitter. el is the bar; onMove(dx, dy) is called while dragging. */
  U.splitter = function (el, onStart, onMove, onEnd) {
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      var sx = e.clientX, sy = e.clientY;
      var st = onStart ? onStart() : null;
      document.body.classList.add('dragging');
      function mv(ev) { onMove(ev.clientX - sx, ev.clientY - sy, st); }
      function up() {
        el.removeEventListener('pointermove', mv);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        document.body.classList.remove('dragging');
        if (onEnd) onEnd();
      }
      el.addEventListener('pointermove', mv);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
