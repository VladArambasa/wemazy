/*!
 * Wemazy IDE - the page designer (drag and drop).
 * The page is drawn inside an iframe with the real site CSS; selection handles,
 * drop lines and guides are drawn on a layer above it.
 */
(function (root) {
  'use strict';
  var W = root.Wemazy = root.Wemazy || {};
  var U = W.util, h = U.h, P = W.Project, C = W.controls;

  var DEVICES = { desktop: 1200, tablet: 768, phone: 390 };
  var GRID = 8;

  var DESIGN_CSS = [
    'html { background: transparent; }',
    'body.wz-site { min-height: 100%; }',
    'body.dz * { cursor: default; }',
    '[data-eid] { -webkit-user-select: none; user-select: none; }',
    '[contenteditable] { -webkit-user-select: text; user-select: text; cursor: text !important; outline: 2px solid #f2a93b; outline-offset: 2px; }',
    '.wz-shield { position: absolute; inset: 0; z-index: 3; }',
    '[class*="wz-anim-"] { animation: none !important; }',
    '.dz-invisible { opacity: .38; background-image: repeating-linear-gradient(135deg, rgba(120,120,140,.18) 0 6px, transparent 6px 12px); }',
    'body.dz-outlines .wz-Section, body.dz-outlines .wz-Panel, body.dz-outlines .wz-Column, body.dz-outlines .wz-Card { outline: 1px dashed rgba(128,132,150,.45); outline-offset: -1px; }',
    '.wz-stack:empty, .wz-row:empty, .wz-free-in:empty, .wz-inner:empty, .wz-Column:empty { min-height: 72px; }',
    '.wz-stack:empty::after, .wz-row:empty::after, .wz-inner:empty::after, .wz-Column:empty::after { content: var(--dz-drop); display: flex; align-items: center; justify-content: center; min-height: 72px; width: 100%; color: rgba(110,114,130,.85); font: 13px/1.3 system-ui, sans-serif; border: 1.5px dashed rgba(128,132,150,.55); border-radius: 6px; }',
    '.wz-free-in { background-image: radial-gradient(rgba(120,124,140,.45) 1px, transparent 1px); background-size: 8px 8px; outline: 1px solid rgba(128,132,150,.4); }',
    '.wz-free-in > .wz-c { cursor: move; }',
    'a, button, input, select, textarea, label { pointer-events: auto; }'
  ].join('\n');

  function Designer(app, host) {
    this.app = app;
    this.host = host;
    this.device = W.store.setting('device', 'desktop');
    this.outlines = W.store.setting('outlines', true);
    this.zoomMode = 'fit';
    this.scale = 1;
    this.page = null;
    this.hoverId = null;
    this.drag = null;
    this.editing = null;
    this.build();
  }
  var D = Designer.prototype;

  D.build = function () {
    var self = this;
    this.el = h('div.designer', { tabindex: '-1' });
    // top bar: devices, outlines, zoom
    this.bar = h('div.dz-bar');
    this.devBtns = {};
    ['desktop', 'tablet', 'phone'].forEach(function (d) {
      var b = h('button.tb-btn', { type: 'button', title: W.t('dz.' + d), 'aria-label': W.t('dz.' + d), html: W.icons.svg(d), onclick: function () { self.setDevice(d); } });
      self.devBtns[d] = b;
      self.bar.appendChild(b);
    });
    this.sizeLabel = h('span.dz-size');
    this.bar.appendChild(this.sizeLabel);
    this.bar.appendChild(h('span.grow'));
    this.outlineBtn = h('button.tb-btn.text', { type: 'button', onclick: function () { self.toggleOutlines(); } }, W.t('dz.outlines'));
    this.bar.appendChild(this.outlineBtn);
    this.zoomSel = h('select.tb-select', { 'aria-label': W.t('dz.zoom'), onchange: function () { self.zoomMode = self.zoomSel.value; self.layout(); } },
      h('option', { value: 'fit' }, W.t('dz.fit')), h('option', { value: '1' }, '100%'), h('option', { value: '0.75' }, '75%'), h('option', { value: '0.5' }, '50%'));
    this.bar.appendChild(this.zoomSel);
    // the stage
    this.viewport = h('div.dz-viewport');
    this.wrap = h('div.dz-wrap');
    this.stage = h('div.dz-stage');
    this.frame = h('iframe.dz-frame', { title: W.t('dz.frameTitle'), tabindex: '-1' });
    this.overlay = h('div.dz-overlay');
    this.stage.appendChild(this.frame);
    this.wrap.appendChild(this.stage);
    this.wrap.appendChild(this.overlay);
    this.viewport.appendChild(this.wrap);
    this.crumbs = h('div.dz-crumbs');
    this.el.appendChild(this.bar);
    this.el.appendChild(this.viewport);
    this.el.appendChild(this.crumbs);
    this.host.appendChild(this.el);

    // overlay parts
    this.hoverBox = h('div.dz-hover');
    this.hoverTag = h('div.dz-hovertag');
    this.selBox = h('div.dz-sel');
    this.selTag = h('div.dz-tag');
    this.dropLine = h('div.dz-drop');
    this.dropBox = h('div.dz-dropbox');
    this.guideX = h('div.dz-guide.v');
    this.guideY = h('div.dz-guide.h');
    this.tip = h('div.dz-tip');
    this.handles = {};
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(function (k) {
      var hd = h('div.dz-handle.' + k, { dataset: { dir: k } });
      hd.addEventListener('pointerdown', function (e) { self.startResize(e, k); });
      self.handles[k] = hd;
      self.selBox.appendChild(hd);
    });
    [this.hoverBox, this.hoverTag, this.dropLine, this.dropBox, this.guideX, this.guideY, this.selBox, this.selTag, this.tip].forEach(function (x) { self.overlay.appendChild(x); });

    this.ro = new ResizeObserver(function () { self.layout(); });
    this.ro.observe(this.viewport);
    this.viewport.addEventListener('scroll', function () { self.drawOverlay(); });
    this.viewport.addEventListener('pointerdown', function (e) {
      if (e.target === self.viewport || e.target === self.wrap) self.app.select(self.page, 'root');
    });
    this.el.addEventListener('keydown', function (e) { self.onKey(e); });
    this.setDevice(this.device, true);
    this.toggleOutlines(this.outlines);
  };

  D.setDevice = function (d, quiet) {
    this.device = d;
    W.store.setSetting('device', d);
    Object.keys(this.devBtns).forEach(function (k) { this.devBtns[k].classList.toggle('on', k === d); }, this);
    if (!quiet) this.render();
  };
  D.toggleOutlines = function (v) {
    this.outlines = v === undefined ? !this.outlines : v;
    W.store.setSetting('outlines', this.outlines);
    this.outlineBtn.classList.toggle('on', this.outlines);
    var doc = this.doc();
    if (doc && doc.body) doc.body.classList.toggle('dz-outlines', this.outlines);
  };

  D.doc = function () {
    try { return this.frame.contentDocument; } catch (e) { return null; }
  };

  /** Show a page. */
  D.show = function (page) {
    var changed = this.page !== page;
    this.page = page;
    if (changed) this.loaded = false;
    this.render();
  };

  /** Draw the page in the frame (again). */
  D.render = function () {
    var self = this, page = this.page, project = this.app.project;
    if (!page || !project) return;
    this.finishEdit(true);
    var ctx = W.build.context(project, page, { design: true, assetUrl: function (a) { return a.data; } });
    var css = W.build.themeVars(project) + '\n' + W.build.BASE_CSS + '\n' + W.build.pageCss(project, page, ctx) + '\n' + DESIGN_CSS +
      '\n:root { --dz-drop: "' + W.t('dz.drop').replace(/"/g, '') + '"; }';
    var body = W.build.bodyHtml(project, page, ctx);
    // hidden things are shown faded while designing
    body = body.replace(/ wz-hidden(?=[ "])/g, ' dz-invisible');
    if (this.device === 'phone') body = body.replace(/ wz-hide-phone(?=[ "])/g, ' dz-invisible');
    else body = body.replace(/ wz-hide-desktop(?=[ "])/g, ' dz-invisible');
    var doc = this.doc();
    if (!this.loaded || !doc || !doc.getElementById('dz-css')) {
      this.frame.srcdoc = '<!doctype html><html><head><meta charset="utf-8"><style id="dz-css"></style></head><body class="wz-site dz"></body></html>';
      this.frame.onload = function () {
        self.loaded = true;
        self.wire();
        self.fill(css, body);
      };
      return;
    }
    this.fill(css, body);
  };

  D.fill = function (css, body) {
    var doc = this.doc();
    if (!doc || !doc.body) return;
    var vp = this.viewport;
    var st = { top: vp.scrollTop, left: vp.scrollLeft };
    doc.getElementById('dz-css').textContent = css;
    doc.body.innerHTML = body;
    doc.body.classList.toggle('dz-outlines', this.outlines);
    doc.documentElement.lang = this.app.project.settings.htmlLang || 'en';
    var self = this;
    Array.prototype.forEach.call(doc.images, function (img) {
      if (!img.complete) img.addEventListener('load', function () { self.layout(); }, { once: true });
    });
    this.layout();
    vp.scrollTop = st.top;
    vp.scrollLeft = st.left;
    this.drawOverlay();
    this.drawCrumbs();
  };

  /** Size of the frame and zoom. */
  D.layout = function () {
    var doc = this.doc();
    var w = DEVICES[this.device] || 1200;
    var vpw = this.viewport.clientWidth - 48;
    var s = this.zoomMode === 'fit' ? Math.min(1, Math.max(0.25, vpw / w)) : parseFloat(this.zoomMode) || 1;
    this.scale = s;
    var vph = Math.max(200, this.viewport.clientHeight - 48);
    this.frame.style.width = w + 'px';
    var minH = Math.round(vph / s);
    if (doc && doc.body) {
      var pg = doc.getElementById('page');
      if (pg) pg.style.minHeight = minH + 'px';
      // free (Windows Forms style) panels shrink on small screens, like on the real site
      fitFree(doc, this.frame.contentWindow);
    }
    this.frame.style.height = minH + 'px';
    var hgt = doc && doc.documentElement ? Math.max(minH, doc.documentElement.scrollHeight) : minH;
    this.frame.style.height = hgt + 'px';
    this.stage.style.transform = s === 1 ? '' : 'scale(' + s + ')';
    this.wrap.style.width = Math.ceil(w * s) + 'px';
    this.wrap.style.height = Math.ceil(hgt * s) + 'px';
    this.sizeLabel.textContent = w + ' px' + (s !== 1 ? ' · ' + Math.round(s * 100) + '%' : '');
    this.drawOverlay();
  };

  function fitFree(doc, win) {
    var list = doc.querySelectorAll('.wz-free');
    for (var i = 0; i < list.length; i++) {
      var el = list[i], inner = el.firstElementChild;
      if (!inner) continue;
      var dw = parseFloat(el.getAttribute('data-dw')) || 960, dh = parseFloat(el.getAttribute('data-dh')) || 480;
      var parent = el.parentElement, cs = win.getComputedStyle(parent);
      var avail = parent.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
      var s = avail > 0 ? Math.min(1, avail / dw) : 1;
      inner.style.transform = s < 1 ? 'scale(' + s + ')' : '';
      el.style.height = s < 1 ? Math.ceil(dh * s) + 'px' : '';
      el._dzScale = s;
    }
  }

  /* ---------------- geometry ---------------- */

  /** Rectangle of an element of the frame, in overlay coordinates. */
  D.rectOf = function (node) {
    var r = node.getBoundingClientRect();
    var fr = this.frame.getBoundingClientRect(), wr = this.wrap.getBoundingClientRect();
    var s = this.scale;
    return { left: fr.left - wr.left + r.left * s, top: fr.top - wr.top + r.top * s, width: r.width * s, height: r.height * s };
  };
  D.nodeOf = function (id) {
    var doc = this.doc();
    if (!doc) return null;
    if (id === 'root') return doc.getElementById('page');
    return doc.querySelector('[data-eid="' + id + '"]');
  };
  /** Frame coordinates from a mouse event of the main window. */
  D.framePoint = function (clientX, clientY) {
    var fr = this.frame.getBoundingClientRect();
    return { x: (clientX - fr.left) / this.scale, y: (clientY - fr.top) / this.scale, inside: clientX >= fr.left && clientX <= fr.right && clientY >= fr.top && clientY <= fr.bottom };
  };
  function place(box, r) {
    box.style.left = r.left + 'px';
    box.style.top = r.top + 'px';
    box.style.width = Math.max(0, r.width) + 'px';
    box.style.height = Math.max(0, r.height) + 'px';
  }

  D.drawOverlay = function () {
    var sel = this.app.selection;
    var node = sel && sel.pageId === (this.page && this.page.id) ? this.nodeOf(sel.id) : null;
    if (node && !this.editing) {
      var r = this.rectOf(node);
      place(this.selBox, r);
      this.selBox.style.display = 'block';
      var f = P.find(this.page, sel.id);
      var el = f && f.el;
      var free = this.isFreeChild(sel.id);
      this.selBox.classList.toggle('free', !!free);
      this.selBox.classList.toggle('rootsel', sel.id === 'root');
      var resizable = el && sel.id !== 'root' && el.type !== 'Column';
      Object.keys(this.handles).forEach(function (k) {
        var show = resizable && (free || k === 'e' || k === 's' || k === 'se');
        this.handles[k].style.display = show ? 'block' : 'none';
      }, this);
      this.selTag.textContent = el ? (sel.id === 'root' ? W.t('dz.pageTag', this.page.name) : el.name + ' · ' + W.t('ctl.' + el.type)) : '';
      this.selTag.style.display = 'block';
      this.selTag.style.left = r.left + 'px';
      this.selTag.style.top = Math.max(-22, r.top - 22) + 'px';
    } else {
      this.selBox.style.display = 'none';
      this.selTag.style.display = 'none';
    }
    var hn = this.hoverId && this.hoverId !== (sel && sel.id) && !this.drag ? this.nodeOf(this.hoverId) : null;
    if (hn) {
      var hr = this.rectOf(hn);
      place(this.hoverBox, hr);
      this.hoverBox.style.display = 'block';
      var hf = P.find(this.page, this.hoverId);
      this.hoverTag.textContent = hf && hf.el ? (this.hoverId === 'root' ? this.page.name : hf.el.name) : '';
      this.hoverTag.style.left = hr.left + 'px';
      this.hoverTag.style.top = Math.max(-18, hr.top - 18) + 'px';
      this.hoverTag.style.display = this.hoverId === 'root' ? 'none' : 'block';
    } else {
      this.hoverBox.style.display = 'none';
      this.hoverTag.style.display = 'none';
    }
  };

  D.drawCrumbs = function () {
    var self = this;
    U.clear(this.crumbs);
    var sel = this.app.selection;
    if (!this.page) return;
    var chain = [];
    var id = sel && sel.pageId === this.page.id ? sel.id : 'root';
    var f = P.find(this.page, id);
    while (f && f.el) {
      chain.unshift(f.el);
      if (!f.parent) break;
      f = P.find(this.page, f.parent.id);
    }
    chain.forEach(function (el, i) {
      if (i) self.crumbs.appendChild(h('span.sep', { html: W.icons.svg('right') }));
      self.crumbs.appendChild(h('button.crumb', {
        type: 'button', onclick: function () { self.app.select(self.page, el.id); }
      }, el === self.page.root ? self.page.name : el.name));
    });
  };

  /* ---------------- events in the frame ---------------- */

  D.wire = function () {
    var self = this, doc = this.doc(), win = this.frame.contentWindow;
    if (!doc) return;
    var opts = { capture: true };
    doc.addEventListener('pointerdown', function (e) { self.onDown(e); }, opts);
    doc.addEventListener('pointermove', function (e) { self.onMove(e); }, opts);
    doc.addEventListener('pointerup', function (e) { self.onUp(e); }, opts);
    doc.addEventListener('pointercancel', function (e) { self.onUp(e, true); }, opts);
    doc.addEventListener('dblclick', function (e) { self.onDbl(e); }, opts);
    doc.addEventListener('contextmenu', function (e) { self.onContext(e); }, opts);
    doc.addEventListener('click', function (e) {
      if (self.editing && self.editing.node.contains(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    }, opts);
    doc.addEventListener('keydown', function (e) { self.onKey(e); }, opts);
    doc.addEventListener('pointerleave', function () { self.hoverId = null; self.drawOverlay(); });
    doc.addEventListener('submit', function (e) { e.preventDefault(); }, opts);
    doc.addEventListener('dragstart', function (e) { e.preventDefault(); }, opts);
    win.addEventListener('wheel', function () { /* the outer viewport scrolls */ }, { passive: true });
    new win.ResizeObserver(function () { self.layout(); }).observe(doc.documentElement);
  };

  D.idAt = function (target) {
    var n = target && target.closest ? target.closest('[data-eid]') : null;
    return n ? n.getAttribute('data-eid') : null;
  };

  D.onDown = function (e) {
    if (this.editing) {
      if (this.editing.node.contains(e.target)) return;
      this.finishEdit();
    }
    if (e.button === 2) return;
    e.preventDefault();
    this.el.focus({ preventScroll: true });
    var id = this.idAt(e.target) || 'root';
    var f = P.find(this.page, id);
    if (!f) return;
    // a Column is selected, but dragging it moves the Columns around it
    this.app.select(this.page, id);
    if (e.button !== 0 || id === 'root') return;
    var dragId = f.el.type === 'Column' ? f.parent.id : id;
    var node = this.nodeOf(dragId);
    var r = node.getBoundingClientRect();
    this.pending = { id: dragId, x: e.clientX, y: e.clientY, offX: e.clientX - r.left, offY: e.clientY - r.top, pointerId: e.pointerId, target: e.target };
    try { e.target.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  };

  D.onMove = function (e) {
    var p = { clientX: e.clientX * this.scale + this.frame.getBoundingClientRect().left, clientY: e.clientY * this.scale + this.frame.getBoundingClientRect().top };
    if (this.pending && !this.drag) {
      if (Math.abs(e.clientX - this.pending.x) + Math.abs(e.clientY - this.pending.y) > 4) {
        this.startMove(this.pending);
      }
    }
    if (this.drag) {
      this.dragMove(p.clientX, p.clientY, e.altKey, e.shiftKey);
      return;
    }
    var id = this.idAt(e.target);
    if (id !== this.hoverId) {
      this.hoverId = id;
      this.drawOverlay();
    }
  };

  D.onUp = function (e, cancel) {
    if (this.drag) {
      if (cancel) this.cancelDrag(); else this.dragDrop();
    }
    this.pending = null;
  };

  D.onDbl = function (e) {
    e.preventDefault();
    var id = this.idAt(e.target);
    if (!id || id === 'root') return;
    var f = P.find(this.page, id);
    if (!f) return;
    var def = C.get(f.el.type);
    // like Visual Studio: a button opens its code; texts are edited on the page
    if (def && def.inline && !def.codeOnDouble) { this.startEdit(f.el); return; }
    if (def && def.defaultEvent && def.events && def.events[def.defaultEvent]) {
      this.app.goToEvent(this.page, f.el, def.defaultEvent);
    }
  };

  D.onContext = function (e) {
    e.preventDefault();
    var id = this.idAt(e.target) || 'root';
    this.app.select(this.page, id);
    var fr = this.frame.getBoundingClientRect();
    this.app.contextMenu(this.page, id, fr.left + e.clientX * this.scale, fr.top + e.clientY * this.scale);
  };

  D.onKey = function (e) {
    if (this.editing) return;
    var t = e.target;
    if (t && t !== this.el && t.ownerDocument === document && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    var sel = this.app.selection;
    if (!sel || !this.page || sel.pageId !== this.page.id) return;
    var mod = U.mod(e);
    var f = P.find(this.page, sel.id);
    if (!f) return;
    var k = e.key;
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); this.app.cmd('delete'); return; }
    if (k === 'Escape') {
      e.preventDefault();
      if (f.parent) this.app.select(this.page, f.parent.type === 'Columns' && f.el.type === 'Column' ? f.parent.id : f.parent.id);
      return;
    }
    if (k === 'Enter' && sel.id !== 'root') {
      e.preventDefault();
      var def = C.get(f.el.type);
      if (def && def.inline) this.startEdit(f.el); else this.app.cmd('viewCode');
      return;
    }
    if (mod && (k === 'c' || k === 'C')) { e.preventDefault(); this.app.cmd('copy'); return; }
    if (mod && (k === 'x' || k === 'X')) { e.preventDefault(); this.app.cmd('cut'); return; }
    if (mod && (k === 'v' || k === 'V')) { e.preventDefault(); this.app.cmd('paste'); return; }
    if (mod && (k === 'd' || k === 'D')) { e.preventDefault(); this.app.cmd('duplicate'); return; }
    if (mod && (k === 'z' || k === 'Z') && !e.shiftKey) { e.preventDefault(); this.app.cmd('undo'); return; }
    if (mod && ((k === 'y' || k === 'Y') || ((k === 'z' || k === 'Z') && e.shiftKey))) { e.preventDefault(); this.app.cmd('redo'); return; }
    if (/^Arrow/.test(k) && sel.id !== 'root') {
      e.preventDefault();
      if (this.isFreeChild(sel.id)) {
        var step = e.shiftKey ? GRID : 1;
        var dx = k === 'ArrowLeft' ? -step : k === 'ArrowRight' ? step : 0;
        var dy = k === 'ArrowUp' ? -step : k === 'ArrowDown' ? step : 0;
        f.el.props.x = Math.max(0, (+f.el.props.x || 0) + dx);
        f.el.props.y = Math.max(0, (+f.el.props.y || 0) + dy);
        this.app.changed(W.t('undo.move'));
      } else if (k === 'ArrowUp' || k === 'ArrowLeft') this.app.cmd('moveUp');
      else this.app.cmd('moveDown');
    }
  };

  D.isFreeChild = function (id) {
    var f = P.find(this.page, id);
    return !!(f && f.parent && f.parent !== this.page.root && f.parent.props.layout === 'free' && f.parent.type !== 'Columns');
  };

  /* ---------------- inline text editing ---------------- */

  D.startEdit = function (el) {
    var def = C.get(el.type);
    var node = this.nodeOf(el.id);
    if (!node || !def.inline) return;
    var target = node;
    if (el.type === 'CheckBox') target = node.querySelector('span') || node;
    var raw = String(el.props[def.inline] || '');
    target.innerHTML = U.esc(raw).replace(/\n/g, '<br>');
    target.setAttribute('contenteditable', 'true');
    target.setAttribute('spellcheck', 'true');
    this.editing = { el: el, node: target, key: def.inline, multiline: !!def.multiline, before: raw };
    var self = this;
    this.drawOverlay();
    target.focus();
    var doc = this.doc(), sel = doc.getSelection(), range = doc.createRange();
    range.selectNodeContents(target);
    sel.removeAllRanges();
    sel.addRange(range);
    target.addEventListener('keydown', this._editKey = function (e) {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); self.finishEdit(true); }
      else if (e.key === 'Enter' && (!self.editing.multiline || U.mod(e))) { e.preventDefault(); self.finishEdit(); }
    });
    target.addEventListener('blur', this._editBlur = function () { self.finishEdit(); });
    target.addEventListener('paste', function (e) {
      e.preventDefault();
      var t = (e.clipboardData || window.clipboardData).getData('text/plain');
      doc.execCommand('insertText', false, t);
    });
  };
  D.finishEdit = function (cancel) {
    var ed = this.editing;
    if (!ed) return;
    this.editing = null;
    ed.node.removeEventListener('keydown', this._editKey);
    ed.node.removeEventListener('blur', this._editBlur);
    ed.node.removeAttribute('contenteditable');
    var text = ed.node.innerText.replace(/ /g, ' ').replace(/\n$/, '');
    if (!ed.multiline) text = text.replace(/\s*\n\s*/g, ' ');
    if (!cancel && text !== ed.before) {
      ed.el.props[ed.key] = text;
      this.app.changed(W.t('undo.text'));
    } else {
      this.render();
    }
  };

  /* ---------------- dragging: from the Toolbox and moving controls ---------------- */

  /** Called by the Toolbox when a new control is dragged over the page. */
  D.startNew = function (type, e) {
    this.drag = { kind: 'new', type: type, offX: 0, offY: 0 };
    this.overlay.classList.add('dragging');
    document.body.classList.add('dz-dragging');
    this.dragMove(e.clientX, e.clientY);
  };
  D.startMove = function (pd) {
    var f = P.find(this.page, pd.id);
    if (!f || f.el.type === 'Column') { this.pending = null; return; }
    this.drag = { kind: 'move', id: pd.id, el: f.el, offX: pd.offX, offY: pd.offY, free: this.isFreeChild(pd.id) };
    var node = this.nodeOf(pd.id);
    if (node) { node.style.opacity = '0.45'; this.drag.node = node; }
    this.overlay.classList.add('dragging');
  };
  D.cancelDrag = function () {
    if (this.drag && this.drag.node) this.drag.node.style.opacity = '';
    this.drag = null;
    this.hideDrop();
    this.overlay.classList.remove('dragging');
    document.body.classList.remove('dz-dragging');
  };
  D.hideDrop = function () {
    this.dropLine.style.display = 'none';
    this.dropBox.style.display = 'none';
    this.guideX.style.display = 'none';
    this.guideY.style.display = 'none';
    this.tip.style.display = 'none';
  };

  /** Where would something dropped at this point go? */
  D.dropTarget = function (x, y) {
    var doc = this.doc();
    var dragged = this.drag && this.drag.kind === 'move' ? this.drag.el : null;
    var hit = doc.elementFromPoint(x, y);
    var node = hit && hit.closest ? hit.closest('[data-eid]') : null;
    if (!node) node = doc.getElementById('page');
    var id = node.getAttribute('data-eid');
    var f = P.find(this.page, id);
    if (!f) return null;
    // never into itself
    if (dragged && (f.el === dragged || P.isInside(dragged, f.el))) {
      var fd = P.find(this.page, dragged.id);
      f = P.find(this.page, fd.parent.id);
      node = this.nodeOf(f.el.id);
    }
    var el = f.el;
    var container = null, cnode = null;
    var isCont = el === this.page.root || C.isContainer(el);
    if (isCont && el.type !== 'Columns') {
      // near the top/bottom edge of a container: drop next to it instead of into it
      var r = node.getBoundingClientRect();
      var edge = Math.min(10, r.height / 4);
      if (el !== this.page.root && el.type !== 'Column' && f.parent && el.props.layout !== 'free' && (y - r.top < edge || r.bottom - y < edge)) {
        var pf = P.find(this.page, f.parent.id);
        return this.flowTarget(pf.el, this.nodeOf(pf.el.id), x, y, f.index + (r.bottom - y < edge ? 1 : 0));
      }
      container = el;
      cnode = node;
    } else if (el.type === 'Columns') {
      // the column under the pointer
      var cols = Array.prototype.slice.call(node.children);
      var ci = 0;
      cols.forEach(function (c, i) { var cr = c.getBoundingClientRect(); if (x >= cr.left) ci = i; });
      container = el.children[ci];
      cnode = cols[ci];
      if (!container) return null;
    } else {
      container = f.parent;
      cnode = this.nodeOf(container.id);
    }
    if (!container || !cnode) return null;
    if (container.props.layout === 'free' && container.type !== 'Columns') {
      var inner = cnode.querySelector(':scope > .wz-free-in') || cnode;
      var ir = inner.getBoundingClientRect();
      var s = cnode._dzScale || 1;
      var off = this.drag ? { x: (this.drag.offX || 0) / this.scale, y: (this.drag.offY || 0) / this.scale } : { x: 0, y: 0 };
      if (this.drag && this.drag.kind === 'new') off = { x: 0, y: 0 };
      return { container: container, cnode: cnode, inner: inner, free: true, scale: s, x: (x - ir.left - off.x) / s, y: (y - ir.top - off.y) / s };
    }
    return this.flowTarget(container, cnode, x, y);
  };

  /** Insertion point among the children of a stack/row container. */
  D.flowTarget = function (container, cnode, x, y, forcedIndex) {
    var holder = container.type === 'Section' ? cnode.querySelector(':scope > .wz-inner') : cnode;
    if (!holder) holder = cnode;
    var row = container.props.layout === 'row' && container !== this.page.root;
    var dragged = this.drag && this.drag.kind === 'move' ? this.drag.el : null;
    var kids = (container.children || []).map(function (ch) { return { el: ch, node: this.nodeOf(ch.id) }; }, this)
      .filter(function (k) { return k.node && k.el !== dragged; });
    var index = kids.length;
    if (forcedIndex !== undefined) {
      // index among all children (the dragged one included)
      var all = container.children || [];
      var before = all[forcedIndex];
      index = before ? kids.findIndex(function (k) { return k.el === before; }) : kids.length;
      if (index < 0) index = kids.length;
    } else if (row) {
      var best = null;
      kids.forEach(function (k, i) {
        var r = k.node.getBoundingClientRect();
        if (y >= r.top - 6 && y <= r.bottom + 6 && x < r.left + r.width / 2 && best === null) best = i;
      });
      if (best === null) {
        kids.forEach(function (k, i) {
          var r = k.node.getBoundingClientRect();
          if (y < r.top - 6 && best === null) best = i;
        });
      }
      index = best === null ? kids.length : best;
    } else {
      for (var i = 0; i < kids.length; i++) {
        var r2 = kids[i].node.getBoundingClientRect();
        if (y < r2.top + r2.height / 2) { index = i; break; }
      }
    }
    // the line to draw
    var hr = holder.getBoundingClientRect();
    var line;
    if (!kids.length) line = { box: hr };
    else if (row) {
      var ref = kids[Math.min(index, kids.length - 1)].node.getBoundingClientRect();
      var lx = index < kids.length ? ref.left - 3 : ref.right + 3;
      line = { x: lx, y: ref.top, h: ref.height, vertical: true };
    } else {
      var ly;
      if (index < kids.length) {
        var nr = kids[index].node.getBoundingClientRect();
        var pr = index > 0 ? kids[index - 1].node.getBoundingClientRect() : null;
        ly = pr ? (pr.bottom + nr.top) / 2 : nr.top - 3;
      } else {
        var lr = kids[kids.length - 1].node.getBoundingClientRect();
        ly = lr.bottom + 3;
      }
      line = { x: hr.left, y: ly, w: hr.width };
    }
    // index among the real children
    var realIndex = index < kids.length ? container.children.indexOf(kids[index].el) : container.children.length;
    return { container: container, cnode: cnode, index: realIndex, line: line };
  };

  D.dragMove = function (clientX, clientY, noSnap) {
    var p = this.framePoint(clientX, clientY);
    this.hideDrop();
    if (!p.inside) { this.drag.target = null; return; }
    var t = this.dropTarget(p.x, p.y);
    this.drag.target = t;
    if (!t) return;
    var s = this.scale;
    var fr = this.frame.getBoundingClientRect(), wr = this.wrap.getBoundingClientRect();
    var ox = fr.left - wr.left, oy = fr.top - wr.top;
    if (t.free) {
      var gx = t.x, gy = t.y;
      var size = this.dragSize();
      var snapped = this.snap(t, gx, gy, size.w, size.h, noSnap);
      t.x = snapped.x;
      t.y = snapped.y;
      var ir = t.inner.getBoundingClientRect();
      place(this.dropBox, { left: ox + (ir.left + t.x * t.scale) * s, top: oy + (ir.top + t.y * t.scale) * s, width: size.w * t.scale * s, height: size.h * t.scale * s });
      this.dropBox.style.display = 'block';
      this.dropBox.classList.add('free');
      this.tip.textContent = Math.round(t.x) + ', ' + Math.round(t.y);
      this.tip.style.left = (ox + (ir.left + t.x * t.scale) * s) + 'px';
      this.tip.style.top = (oy + (ir.top + t.y * t.scale) * s - 22) + 'px';
      this.tip.style.display = 'block';
      return;
    }
    this.dropBox.classList.remove('free');
    var l = t.line;
    if (l.box) {
      place(this.dropBox, { left: ox + l.box.left * s, top: oy + l.box.top * s, width: l.box.width * s, height: Math.max(8, l.box.height) * s });
      this.dropBox.style.display = 'block';
    } else if (l.vertical) {
      place(this.dropLine, { left: ox + l.x * s - 1, top: oy + l.y * s, width: 3, height: l.h * s });
      this.dropLine.style.display = 'block';
    } else {
      place(this.dropLine, { left: ox + l.x * s, top: oy + l.y * s - 1, width: l.w * s, height: 3 });
      this.dropLine.style.display = 'block';
    }
  };

  D.dragSize = function () {
    if (this.drag.kind === 'move' && this.drag.node) {
      var r = this.drag.node.getBoundingClientRect();
      return { w: r.width, h: r.height };
    }
    var def = C.get(this.drag.type);
    var sizes = { Button: [120, 44], TextBox: [240, 44], Heading: [320, 48], Text: [320, 60], Image: [200, 140], CheckBox: [180, 28], Panel: [300, 200], Card: [300, 200] };
    var sz = sizes[this.drag.type] || [def && def.container ? 300 : 200, def && def.container ? 160 : 40];
    return { w: sz[0], h: sz[1] };
  };

  /** Snap to other controls (guides) or to the grid. */
  D.snap = function (t, x, y, w, hgt, noSnap) {
    if (noSnap) return { x: Math.max(0, x), y: Math.max(0, y) };
    var inner = t.inner, self = this;
    var ir = inner.getBoundingClientRect(), s = t.scale;
    var dragged = this.drag.kind === 'move' ? this.drag.el : null;
    var xs = [0, (+t.container.props.formWidth || 960) / 2, +t.container.props.formWidth || 960];
    var ys = [0, (+t.container.props.formHeight || 480) / 2, +t.container.props.formHeight || 480];
    (t.container.children || []).forEach(function (ch) {
      if (ch === dragged) return;
      var n = self.nodeOf(ch.id);
      if (!n) return;
      var r = n.getBoundingClientRect();
      var l = (r.left - ir.left) / s, tp = (r.top - ir.top) / s, rw = r.width / s, rh = r.height / s;
      xs.push(l, l + rw / 2, l + rw);
      ys.push(tp, tp + rh / 2, tp + rh);
    });
    var bestX = null, bestY = null, TH = 5;
    [[0, 'l'], [w / 2, 'c'], [w, 'r']].forEach(function (o) {
      xs.forEach(function (gx) {
        var d = Math.abs(x + o[0] - gx);
        if (d <= TH && (!bestX || d < bestX.d)) bestX = { d: d, x: gx - o[0], line: gx };
      });
    });
    [[0], [hgt / 2], [hgt]].forEach(function (o) {
      ys.forEach(function (gy) {
        var d = Math.abs(y + o[0] - gy);
        if (d <= TH && (!bestY || d < bestY.d)) bestY = { d: d, y: gy - o[0], line: gy };
      });
    });
    var nx = bestX ? bestX.x : Math.round(x / GRID) * GRID;
    var ny = bestY ? bestY.y : Math.round(y / GRID) * GRID;
    var fr = this.frame.getBoundingClientRect(), wr = this.wrap.getBoundingClientRect(), sc = this.scale;
    var ox = fr.left - wr.left, oy = fr.top - wr.top;
    if (bestX) {
      place(this.guideX, { left: ox + (ir.left + bestX.line * s) * sc, top: oy + ir.top * sc, width: 1, height: ir.height * sc });
      this.guideX.style.display = 'block';
    }
    if (bestY) {
      place(this.guideY, { left: ox + ir.left * sc, top: oy + (ir.top + bestY.line * s) * sc, width: ir.width * sc, height: 1 });
      this.guideY.style.display = 'block';
    }
    return { x: Math.max(0, nx), y: Math.max(0, ny) };
  };

  D.dragDrop = function () {
    var d = this.drag, t = d && d.target;
    if (d && d.node) d.node.style.opacity = '';
    this.drag = null;
    this.hideDrop();
    this.overlay.classList.remove('dragging');
    document.body.classList.remove('dz-dragging');
    if (!t) return;
    var app = this.app, page = this.page, project = app.project;
    var el;
    if (d.kind === 'new') {
      el = P.newElement(project, page, d.type);
    } else {
      el = d.el;
      var f = P.find(page, el.id);
      if (!f) return;
      if (!t.free && f.parent === t.container && (t.index === f.index || t.index === f.index + 1)) return;
      f.parent.children.splice(f.index, 1);
      if (f.parent === t.container && !t.free && t.index > f.index) t.index--;
    }
    if (t.free) {
      if (d.kind === 'move' && !d.free && d.node) {
        var r = d.node.getBoundingClientRect();
        el.props.width = Math.round(r.width);
        el.props.height = Math.round(r.height);
      } else if (d.kind === 'new') {
        var size = { Button: [120, 44], TextBox: [240, 44], Heading: [320, 48], Text: [320, 60], Image: [200, 140] }[el.type];
        if (size) { el.props.width = size[0]; if (el.type !== 'Text' && el.type !== 'Heading') el.props.height = size[1]; }
        if (C.isContainer(el)) { el.props.width = el.props.width || 300; el.props.height = el.props.height || 180; }
      }
      el.props.x = Math.round(t.x);
      el.props.y = Math.round(t.y);
      t.container.children.push(el);
    } else {
      if (d.kind === 'move' && d.free) {
        delete el.props.x;
        delete el.props.y;
        if (el.type === 'Text' || el.type === 'Heading' || el.type === 'TextBox') { delete el.props.width; delete el.props.height; }
      }
      t.container.children.splice(t.index, 0, el);
    }
    app.changed(d.kind === 'new' ? W.t('undo.add', W.t('ctl.' + el.type)) : W.t('undo.move'));
    app.select(page, el.id);
    this.el.focus({ preventScroll: true });
  };

  /* ---------------- resizing ---------------- */

  D.startResize = function (e, dir) {
    e.preventDefault();
    e.stopPropagation();
    var sel = this.app.selection;
    var f = P.find(this.page, sel.id);
    if (!f) return;
    var node = this.nodeOf(sel.id);
    var r = node.getBoundingClientRect();
    var free = this.isFreeChild(sel.id);
    var fscale = 1;
    if (free) { var fc = this.nodeOf(f.parent.id); fscale = (fc && fc._dzScale) || 1; }
    var st = {
      el: f.el, x: +f.el.props.x || 0, y: +f.el.props.y || 0,
      w: r.width / fscale, h: r.height / fscale, sx: e.clientX, sy: e.clientY, free: free, fscale: fscale
    };
    var self = this;
    var target = e.target;
    target.setPointerCapture(e.pointerId);
    document.body.classList.add('dragging');
    function mv(ev) {
      var k = self.scale * st.fscale;
      var dx = (ev.clientX - st.sx) / k, dy = (ev.clientY - st.sy) / k;
      var w = st.w, hh = st.h, x = st.x, y = st.y;
      if (/e/.test(dir)) w = st.w + dx;
      if (/s/.test(dir)) hh = st.h + dy;
      if (/w/.test(dir)) { w = st.w - dx; x = st.x + dx; }
      if (/n/.test(dir)) { hh = st.h - dy; y = st.y + dy; }
      if (!ev.altKey && st.free) {
        w = Math.round(w / GRID) * GRID; hh = Math.round(hh / GRID) * GRID;
        x = Math.round(x / GRID) * GRID; y = Math.round(y / GRID) * GRID;
      }
      w = Math.max(16, Math.round(w));
      hh = Math.max(8, Math.round(hh));
      if (/[ew]/.test(dir)) st.el.props.width = w;
      if (/[ns]/.test(dir)) st.el.props.height = hh;
      if (st.free) {
        if (/w/.test(dir)) st.el.props.x = Math.max(0, Math.round(x));
        if (/n/.test(dir)) st.el.props.y = Math.max(0, Math.round(y));
      }
      self.app.changedLive();
      self.tip.textContent = (st.el.props.width || Math.round(st.w)) + ' × ' + (st.el.props.height || Math.round(st.h));
      var sb = self.selBox.getBoundingClientRect(), wr = self.wrap.getBoundingClientRect();
      self.tip.style.left = (sb.left - wr.left) + 'px';
      self.tip.style.top = (sb.bottom - wr.top + 6) + 'px';
      self.tip.style.display = 'block';
    }
    function up() {
      target.removeEventListener('pointermove', mv);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      document.body.classList.remove('dragging');
      self.tip.style.display = 'none';
      self.app.changed(W.t('undo.resize'));
    }
    target.addEventListener('pointermove', mv);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };

  W.Designer = Designer;
  W.Designer.DEVICES = DEVICES;
})(typeof window !== 'undefined' ? window : globalThis);
