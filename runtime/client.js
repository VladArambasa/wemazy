/*!
 * Wemazy runtime - web page
 * -------------------------
 * Everything the JavaScript made from your Wemazy Script needs inside a web page:
 * reading and changing controls, events, message boxes, pages, the server.
 * Copied as text into every exported site (js/wemazy.js): it must not use
 * anything from outside itself.
 */
(function (root) {
  'use strict';
  var W = root.Wemazy = root.Wemazy || {};
  W.runtime = W.runtime || {};

  W.runtime.client = function wemazyClient(window, wz) {
    'use strict';
    var document = window.document;
    var cfg = { mode: 'static', page: '', pages: {}, assets: {}, api: 'api.php', site: 'site', lang: 'en' };
    wz.config = cfg;
    var text = wz.text;

    var UI = {
      en: { ok: 'OK', cancel: 'Cancel', yes: 'Yes', no: 'No', noServer: "This website has no server, so it can't run server functions or use the database.", noPage: "There is no page called '{0}'.", noControl: "There is no control called '{0}' on this page.", noProp: "{0} has no property '{1}'.", where: '{0}, line {1}', netError: 'Could not reach the server: {0}', hasNoItems: "{0} can't take items.", notBox: "{0} can't hold controls: put them in a Panel, a Card or a Section.", noCtl: 'This value is nothing: there is no control in it.', cantMake: "This page can't make a new {0}." },
      ro: { ok: 'OK', cancel: 'Anulează', yes: 'Da', no: 'Nu', noServer: 'Site-ul acesta nu are server, deci nu poate rula funcții de server și nu poate folosi baza de date.', noPage: "Nu există nicio pagină numită '{0}'.", noControl: "Pe această pagină nu există niciun control numit '{0}'.", noProp: "{0} nu are proprietatea '{1}'.", where: '{0}, linia {1}', netError: 'Nu am putut ajunge la server: {0}', hasNoItems: '{0} nu poate primi elemente.', notBox: '{0} nu poate ține controale: pune-le într-un Panel, un Card sau o Section.', noCtl: 'Valoarea este nothing: nu conține niciun control.', cantMake: 'Pagina aceasta nu poate face un {0} nou.' }
    };
    function ui(key, args) {
      var s = (UI[wz.lang] || UI.en)[key] || UI.en[key] || key;
      return s.replace(/\{(\d+)\}/g, function (m, i) { return args && args[i] !== undefined ? String(args[i]) : m; });
    }
    function error(msg) { var e = new Error(msg); e.wz = true; return e; }

    /* ---------------- start ---------------- */

    var startFns = [], loadFns = [], timers = [], booted = false;

    wz.boot = function (c) {
      Object.keys(c || {}).forEach(function (k) { cfg[k] = c[k]; });
      wz.lang = cfg.lang || wz.lang || 'en';
      if (cfg.loopLimit) wz.loopLimit = cfg.loopLimit;
      injectStyle();
    };
    wz.start = function (fn) { startFns.push(fn); };
    wz.on_load = function (fn) { loadFns.push(fn); };

    function go() {
      if (booted) return;
      booted = true;
      fitFree();
      window.addEventListener('resize', fitFree);
      var chain = Promise.resolve();
      startFns.concat(loadFns).forEach(function (fn) {
        chain = chain.then(function () { return run(fn); });
      });
      chain.then(function () {
        timers.forEach(function (t) { t(); });
      });
    }
    function schedule() {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(go, 0); });
      else setTimeout(go, 0);
    }
    schedule();

    /** Run a handler; errors are reported, not thrown. */
    function run(fn, arg) {
      wz.reset_clock();
      var p;
      try { p = fn(arg); } catch (e) { report(e); return Promise.resolve(); }
      if (p && typeof p.then === 'function') return p.then(null, report);
      return Promise.resolve(p);
    }

    /* ---------------- errors and print ---------------- */

    function post(msg) {
      try { if (window.parent && window.parent !== window) window.parent.postMessage(msg, '*'); } catch (e) { /* ignore */ }
    }
    function report(e) {
      var message = wz.errmsg(e);
      if (cfg.mode === 'preview') {
        post({ wemazy: 'error', message: message, file: e && e.wzFile || null, line: e && e.wzLine || null, page: cfg.page });
      }
      if (window.console) console.error('Wemazy: ' + message + (e && e.wzFile ? ' (' + ui('where', [e.wzFile, e.wzLine]) + ')' : ''));
      if (cfg.mode !== 'preview') toast(message, true);
    }
    wz.report = report;
    wz.fail = function (e, file, line) { wz.trace(e, file, line); report(e); };
    wz.print = function (v) {
      var s = wz.repr(v);
      if (window.console) console.log(s);
      if (cfg.mode === 'preview') post({ wemazy: 'print', text: s, page: cfg.page });
    };

    /* ---------------- controls ---------------- */

    var made = {}, madeCount = 0;   // controls made by the code (new Button()), on the page or not yet
    function byId(name) {
      var el = document.getElementById(name);
      if (!el) {
        if (made[name]) return made[name];
        // names are not case-sensitive
        var ln = String(name).toLowerCase();
        var all = document.querySelectorAll('[data-wz]');
        for (var i = 0; i < all.length; i++) if (all[i].id.toLowerCase() === ln) return all[i];
        for (var k in made) if (k.toLowerCase() === ln) return made[k];
        throw error(ui('noControl', [name]));
      }
      return el;
    }
    wz.el = byId;
    function typeOf(el) { return el.getAttribute('data-wz') || ''; }
    function input(el) {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return el;
      return el.querySelector('input:not([type=checkbox]):not([type=radio]),textarea,select') || el.querySelector('input');
    }
    function media(el) { return /^(VIDEO|AUDIO)$/.test(el.tagName) ? el : el.querySelector('video,audio'); }
    function esc(s) {
      return text(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
    }
    function px(v) {
      if (v === null || v === undefined || v === '') return '';
      return wz.is_number(v) ? wz.num(v) + 'px' : text(v);
    }
    function unpx(s) {
      if (s === '' || s === null || s === undefined) return null;
      var m = /^(-?[\d.]+)px$/.exec(s);
      return m ? parseFloat(m[1]) : s;
    }
    /** Asset names and page names become real addresses. */
    function resolve(url) {
      var u = text(url);
      if (cfg.assets) {
        if (cfg.assets[u]) return cfg.assets[u];
        var lu = u.toLowerCase();
        for (var k in cfg.assets) if (k.toLowerCase() === lu) return cfg.assets[k];
      }
      return u;
    }
    wz.url = resolve;
    function pageFile(name) {
      var n = String(name).toLowerCase();
      for (var k in cfg.pages) if (k.toLowerCase() === n) return cfg.pages[k];
      return null;
    }
    function ytId(u) {
      var m = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/.exec(u);
      return m ? m[1] : null;
    }
    function listItems(el) {
      return Array.prototype.map.call(el.querySelectorAll(':scope > li'), function (li) { return li.textContent; });
    }
    function setListItems(el, items) {
      el.innerHTML = (wz.is_list(items) ? items : (wz.is_empty(items) ? [] : [items])).map(function (x) { return '<li>' + esc(typeof x === 'string' ? x : text(x)) + '</li>'; }).join('');
    }
    function selectOf(el) { return el.tagName === 'SELECT' ? el : el.querySelector('select'); }
    function radios(el) { return Array.prototype.slice.call(el.querySelectorAll('input[type=radio]')); }
    function optionsOf(el) {
      var t = typeOf(el);
      if (t === 'RadioGroup') return radios(el).map(function (r) { return r.parentNode.textContent.trim(); });
      var s = selectOf(el);
      return s ? Array.prototype.map.call(s.options, function (o) { return o.text; }) : [];
    }
    function setOptions(el, items) {
      var list = wz.is_list(items) ? items : (wz.is_empty(items) ? [] : wz.split(items));
      var t = typeOf(el);
      if (t === 'RadioGroup') {
        var name = el.id;
        var holder = el.querySelector('.wz-opts') || el;
        holder.innerHTML = list.map(function (x) {
          return '<label class="wz-opt"><input type="radio" name="' + esc(name) + '" value="' + esc(x) + '"><span>' + esc(x) + '</span></label>';
        }).join('');
        return;
      }
      var s = selectOf(el);
      if (s) s.innerHTML = list.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('');
    }
    function tableData(el) {
      if (el._wzData) return el._wzData;
      var heads = Array.prototype.map.call(el.querySelectorAll('thead th'), function (th) { return th.getAttribute('data-col') || th.textContent; });
      return Array.prototype.map.call(el.querySelectorAll('tbody tr'), function (tr) {
        var r = {};
        Array.prototype.forEach.call(tr.children, function (td, i) { r[heads[i] || ('c' + (i + 1))] = td.textContent; });
        return r;
      });
    }
    function renderTable(el, data) {
      var rows = wz.is_list(data) ? data : (data ? [data] : []);
      var cols = (el.getAttribute('data-columns') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      var heads = (el.getAttribute('data-headers') || '').split(',').map(function (s) { return s.trim(); });
      if (!cols.length) {
        rows.forEach(function (r) {
          if (wz.is_rec(r)) Object.keys(r).forEach(function (k) { if (k !== 'id' && cols.indexOf(k) < 0) cols.push(k); });
        });
        if (!cols.length && rows.length) cols = ['value'];
      }
      var t = el.querySelector('table') || el;
      var html = '<thead><tr>' + cols.map(function (c, i) { return '<th data-col="' + esc(c) + '">' + esc(heads[i] || c) + '</th>'; }).join('') + '</tr></thead><tbody>';
      rows.forEach(function (r, ri) {
        html += '<tr data-row="' + ri + '">' + cols.map(function (c) {
          var v = wz.is_rec(r) ? wz.dot(r, c) : (c === 'value' ? r : '');
          if (v === true) v = '✓';
          if (v === false) v = '';
          return '<td>' + esc(v) + '</td>';
        }).join('') + '</tr>';
      });
      t.innerHTML = html + '</tbody>';
      el._wzData = rows;
      el._wzSel = null;
    }
    function progress(el, v) {
      var max = wz.num(el.getAttribute('data-max') || 100) || 100;
      var x = Math.max(0, Math.min(max, wz.num(v)));
      el.setAttribute('data-value', x);
      var bar = el.querySelector('.wz-bar');
      if (bar) bar.style.width = (x / max * 100) + '%';
      var lab = el.querySelector('.wz-pct');
      if (lab) lab.textContent = Math.round(x / max * 100) + '%';
    }

    /** Read a property of a control. */
    wz.get = function (name, prop) {
      if (name === '$page') {
        switch (prop) {
          case 'title': return document.title;
          case 'name': return cfg.page;
          case 'background': return document.body.style.background;
          case 'color': return document.body.style.color;
        }
        return null;
      }
      var el = byId(name), t = typeOf(el), inp;
      switch (prop) {
        case 'text':
          if (/^(TextBox|TextArea|DatePicker|NumberBox)$/.test(t)) return input(el).value;
          if (t === 'Slider') return input(el).value;
          if (t === 'DropDown') { var s = selectOf(el); return s && s.selectedIndex >= 0 ? s.options[s.selectedIndex].text : ''; }
          if (t === 'RadioGroup') { var r = radios(el).filter(function (x) { return x.checked; })[0]; return r ? r.parentNode.textContent.trim() : ''; }
          if (t === 'CheckBox') { var sp = el.querySelector('span'); return sp ? sp.textContent : el.textContent; }
          if (t === 'List') return listItems(el).join(', ');
          if (t === 'NavBar') { var b = el.querySelector('.wz-brand'); return b ? b.textContent : ''; }
          if (t === 'ProgressBar') return wz.num(el.getAttribute('data-value') || 0);
          return el.innerText !== undefined ? el.innerText.replace(/\n$/, '') : el.textContent;
        case 'value':
          if (t === 'CheckBox') return input(el) ? !!el.querySelector('input').checked : false;
          if (t === 'Slider') return wz.num(input(el).value);
          if (t === 'ProgressBar') return wz.num(el.getAttribute('data-value') || 0);
          if (t === 'DropDown' || t === 'RadioGroup' || t === 'TextBox' || t === 'TextArea' || t === 'DatePicker' || t === 'NumberBox') return wz.get(name, 'text');
          if (t === 'Table' || t === 'List') return wz.get(name, 'selected');
          return wz.get(name, 'text');
        case 'checked': return !!(el.querySelector('input[type=checkbox]') || {}).checked;
        case 'selected':
          if (t === 'Table') return el._wzSel === undefined ? null : el._wzSel;
          if (t === 'List') return el._wzSel === undefined ? null : el._wzSel;
          return wz.get(name, 'text');
        case 'index':
          if (t === 'DropDown') { var s2 = selectOf(el); return s2 ? s2.selectedIndex + 1 : 0; }
          if (t === 'RadioGroup') { var rs = radios(el); for (var i = 0; i < rs.length; i++) if (rs[i].checked) return i + 1; return 0; }
          if (t === 'Table' || t === 'List') return el._wzSelIndex || 0;
          return 0;
        case 'options': return optionsOf(el);
        case 'items': return t === 'List' ? listItems(el) : optionsOf(el);
        case 'data': return t === 'Table' ? tableData(el) : null;
        case 'count':
          if (t === 'List') return listItems(el).length;
          if (t === 'Table') return tableData(el).length;
          return optionsOf(el).length;
        case 'visible': return !el.classList.contains('wz-hidden') && el.style.display !== 'none';
        case 'enabled': inp = input(el) || el; return !inp.disabled && !el.classList.contains('wz-disabled');
        case 'source':
          if (t === 'Image') return el.getAttribute('src') || '';
          var m = media(el); if (m) return m.getAttribute('src') || '';
          var fr = el.querySelector('iframe'); return fr ? fr.getAttribute('src') : '';
        case 'link': return el.getAttribute('href') || '';
        case 'placeholder': inp = input(el); return inp ? inp.placeholder : '';
        case 'min': inp = input(el); return t === 'ProgressBar' ? 0 : (inp ? wz.num(inp.min || 0) : 0);
        case 'max': inp = input(el); return t === 'ProgressBar' ? wz.num(el.getAttribute('data-max') || 100) : (inp ? wz.num(inp.max || 100) : 100);
        case 'playing': var md = media(el); return md ? !md.paused : false;
        case 'color': return el.style.color || window.getComputedStyle(el).color;
        case 'background': return el.style.background || window.getComputedStyle(el).backgroundColor;
        case 'size': return unpx(el.style.fontSize || window.getComputedStyle(el).fontSize);
        case 'bold': var fw = el.style.fontWeight || window.getComputedStyle(el).fontWeight; return fw === 'bold' || +fw >= 600;
        case 'italic': return (el.style.fontStyle || window.getComputedStyle(el).fontStyle) === 'italic';
        case 'width': return unpx(el.style.width) !== null ? unpx(el.style.width) : el.offsetWidth;
        case 'height': return unpx(el.style.height) !== null ? unpx(el.style.height) : el.offsetHeight;
        case 'x': return unpx(el.style.left) !== null ? unpx(el.style.left) : el.offsetLeft;
        case 'y': return unpx(el.style.top) !== null ? unpx(el.style.top) : el.offsetTop;
        case 'opacity': return parseFloat(el.style.opacity || window.getComputedStyle(el).opacity);
        case 'tooltip': return el.title || '';
        case 'align': return el.style.textAlign || window.getComputedStyle(el).textAlign;
        case 'radius': return unpx(el.style.borderRadius || window.getComputedStyle(el).borderTopLeftRadius);
        case 'border': return el.style.border || '';
        case 'html': return el.innerHTML;
        case 'columns': return (el.getAttribute('data-columns') || '').split(',').filter(Boolean);
      }
      throw error(ui('noProp', [name, prop]));
    };

    /** Change a property of a control. */
    wz.set = function (name, prop, v) {
      if (name === '$page') {
        if (prop === 'title') document.title = text(v);
        else if (prop === 'background') document.body.style.background = text(v);
        else if (prop === 'color') document.body.style.color = text(v);
        return;
      }
      var el = byId(name), t = typeOf(el), inp;
      switch (prop) {
        case 'text':
          if (/^(TextBox|TextArea|DatePicker|NumberBox|Slider)$/.test(t)) { input(el).value = text(v); if (t === 'Slider') updateOut(el); return; }
          if (t === 'DropDown' || t === 'RadioGroup') { wz.set(name, 'selected', v); return; }
          if (t === 'CheckBox') { var sp = el.querySelector('span'); if (sp) sp.textContent = text(v); return; }
          if (t === 'List') { setListItems(el, wz.is_list(v) ? v : wz.split(v)); return; }
          if (t === 'NavBar') { var b = el.querySelector('.wz-brand'); if (b) b.textContent = text(v); return; }
          if (t === 'ProgressBar') { progress(el, v); return; }
          if (t === 'Table') { renderTable(el, v); return; }
          if (el.innerText !== undefined) el.innerText = text(v); else el.textContent = text(v);
          return;
        case 'value':
          if (t === 'CheckBox') { el.querySelector('input').checked = wz.truthy(v); return; }
          if (t === 'ProgressBar') { progress(el, v); return; }
          if (t === 'Table' || t === 'List') return;
          wz.set(name, 'text', v);
          return;
        case 'checked': inp = el.querySelector('input[type=checkbox]'); if (inp) inp.checked = wz.truthy(v); return;
        case 'selected':
          if (t === 'DropDown') {
            var s = selectOf(el);
            for (var i = 0; i < s.options.length; i++) if (wz.eq(s.options[i].text, v) || wz.eq(s.options[i].value, v)) { s.selectedIndex = i; return; }
            s.selectedIndex = -1;
            return;
          }
          if (t === 'RadioGroup') { radios(el).forEach(function (r) { r.checked = wz.eq(r.value, v) || wz.eq(r.parentNode.textContent.trim(), v); }); return; }
          return;
        case 'index':
          if (t === 'DropDown') { selectOf(el).selectedIndex = Math.floor(wz.num(v)) - 1; return; }
          if (t === 'RadioGroup') { radios(el).forEach(function (r, i) { r.checked = i === Math.floor(wz.num(v)) - 1; }); return; }
          return;
        case 'options': case 'items':
          if (t === 'List') setListItems(el, v);
          else if (t === 'Table') renderTable(el, v);
          else setOptions(el, v);
          return;
        case 'data': if (t === 'Table') renderTable(el, v); else if (t === 'List') setListItems(el, v); return;
        case 'visible': el.classList.toggle('wz-hidden', !wz.truthy(v)); if (wz.truthy(v) && el.style.display === 'none') el.style.display = ''; fitFree(); return;
        case 'enabled':
          inp = input(el) || el;
          var on = wz.truthy(v);
          if ('disabled' in inp) inp.disabled = !on;
          el.querySelectorAll && Array.prototype.forEach.call(el.querySelectorAll('input,select,textarea,button'), function (x) { x.disabled = !on; });
          el.classList.toggle('wz-disabled', !on);
          return;
        case 'source': {
          var u = resolve(v);
          if (t === 'Image') { el.setAttribute('src', u); return; }
          if (t === 'Video') {
            var id = ytId(u);
            if (id) el.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + esc(id) + '" title="Video" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>';
            else el.innerHTML = '<video controls src="' + esc(u) + '"></video>';
            return;
          }
          var m = media(el); if (m) { m.setAttribute('src', u); return; }
          var fr = el.querySelector('iframe'); if (fr) fr.setAttribute('src', u);
          return;
        }
        case 'link': el.setAttribute('href', pageFile(v) || resolve(v)); return;
        case 'placeholder': inp = input(el); if (inp) inp.placeholder = text(v); return;
        case 'min': inp = input(el); if (inp) inp.min = wz.num(v); return;
        case 'max':
          if (t === 'ProgressBar') { el.setAttribute('data-max', wz.num(v)); progress(el, el.getAttribute('data-value') || 0); return; }
          inp = input(el); if (inp) inp.max = wz.num(v); return;
        case 'playing': { var md = media(el); if (md) { if (wz.truthy(v)) md.play().catch(function () {}); else md.pause(); } return; }
        case 'color': el.style.color = text(v); return;
        case 'background': {
          var bg = text(v);
          var r = resolve(bg);
          el.style.background = (r !== bg || /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(bg) || /^data:image\//.test(bg)) ? 'url("' + r + '") center/cover' : bg;
          return;
        }
        case 'size': el.style.fontSize = px(v); return;
        case 'bold': el.style.fontWeight = wz.truthy(v) ? '700' : '400'; return;
        case 'italic': el.style.fontStyle = wz.truthy(v) ? 'italic' : 'normal'; return;
        case 'width': el.style.width = px(v); return;
        case 'height': el.style.height = px(v); return;
        case 'x': el.style.left = px(v); return;
        case 'y': el.style.top = px(v); return;
        case 'opacity': { var o = wz.num(v); el.style.opacity = String(o > 1 ? o / 100 : o); return; }
        case 'tooltip': el.title = text(v); return;
        case 'align': el.style.textAlign = text(v); return;
        case 'radius': el.style.borderRadius = px(v); return;
        case 'border': el.style.border = wz.is_number(v) ? px(v) + ' solid currentColor' : text(v); return;
        case 'html': el.innerHTML = text(v); return;
        case 'columns': el.setAttribute('data-columns', wz.is_list(v) ? v.join(',') : text(v)); renderTable(el, el._wzData || []); return;
      }
      throw error(ui('noProp', [name, prop]));
    };
    function updateOut(el) {
      var o = el.querySelector('output'), i = input(el);
      if (o && i) o.textContent = i.value;
    }

    wz.show_control = function (name) { wz.set(name, 'visible', true); };
    wz.show = function (name) { wz.set(name, 'visible', true); };
    wz.hide = function (name) { wz.set(name, 'visible', false); };
    wz.focus = function (name) { var el = byId(name); var i = input(el) || el; if (i.focus) i.focus(); };
    wz.scroll_to = function (name) { byId(name).scrollIntoView({ behavior: 'smooth', block: 'start' }); };

    /* ---------------- controls as objects: var Button b = Button1; new Button() ---------------- */

    function ctlType(el) { var t = typeOf(el); return t === 'FreePanel' ? 'Panel' : t; }
    /** A control as a value you can keep in a variable */
    wz.ref = function (name) {
      var el = byId(name);
      return new wz.Ref(el.id, ctlType(el));
    };
    /** The name of a control kept in a value (or the name itself) */
    wz.cname = function (v) {
      if (wz.is_ref(v)) return v.$ctl;
      if (v === null || v === undefined) throw error(ui('noCtl'));
      return text(v);
    };
    wz.ctl_is = function (v, type) {
      if (!wz.is_ref(v)) return false;
      var el;
      try { el = byId(v.$ctl); } catch (e) { return false; }
      var t = String(type).toLowerCase();
      return t === 'control' || ctlType(el).toLowerCase() === t;
    };
    /** A value going into a variable of a control type (Button b = ...) */
    wz.to_ctl = function (v, type) {
      if (v === null || v === undefined) return null;
      var r = wz.is_ref(v) ? v : (typeof v === 'string' ? wz.ref(v) : null);
      if (!r) wz.fail_with('notControl', [text(v)]);
      if (!wz.ctl_is(r, type)) wz.fail_with('notControlOf', [r.$ctl, type]);
      return r;
    };
    /** new Button(): a new control (Panel1.add(b) puts it on the page) */
    wz.create = function (type) {
      var tpl = (cfg.templates || {})[type];
      if (!tpl) throw error(ui('cantMake', [type]));
      var name;
      do { name = type + '_' + (++madeCount); } while (document.getElementById(name) || made[name]);
      var box = document.createElement('div');
      box.innerHTML = tpl.split('__WZNEW__').join(name);
      var el = box.firstElementChild;
      made[name] = el;
      return new wz.Ref(name, type);
    };
    /** b.click += sayHi: the function gets the control */
    wz.on_ref = function (ref, ev, fn) {
      var name = wz.cname(ref);
      var el = byId(name);
      var r = new wz.Ref(el.id, ctlType(el));
      wz.on(el.id, ev, function () { return fn(r); });
    };
    function isBox(t) { return /^(Panel|Card|Section|Column|FreePanel)$/.test(t); }
    function holder(el) {
      return el.querySelector(':scope > .wz-inner') || el.querySelector(':scope > .wz-free-in') || el;
    }

    wz.add_item = function (name, item) {
      if (wz.is_ref(item)) {
        // a control into a panel (or into the page)
        var box = name === '$page' ? document.getElementById('page') : byId(name);
        if (name !== '$page' && !isBox(typeOf(box))) throw error(ui('notBox', [name]));
        holder(box).appendChild(byId(item.$ctl));
        fitFree();
        return;
      }
      var el = byId(name), t = typeOf(el);
      if (t === 'List') { el.insertAdjacentHTML('beforeend', '<li>' + esc(typeof item === 'string' ? item : text(item)) + '</li>'); return; }
      if (t === 'Table') { var d = tableData(el).slice(); d.push(item); renderTable(el, d); return; }
      if (t === 'DropDown' || t === 'RadioGroup') { var o = optionsOf(el); o.push(text(item)); setOptions(el, o); return; }
      if (/^(TextBox|TextArea)$/.test(t)) { input(el).value += text(item); return; }
      if (t === 'ProgressBar') { progress(el, wz.add(wz.num(el.getAttribute('data-value') || 0), item)); return; }
      if (t === 'Text' || t === 'Heading' || t === 'Label') { wz.set(name, 'text', wz.add(wz.get(name, 'text'), item)); return; }
      throw error(ui('hasNoItems', [name]));
    };
    wz.remove_item = function (name, item) {
      if (wz.is_ref(item)) {
        var child = byId(item.$ctl);
        if (!made[child.id]) made[child.id] = child;
        if (child.parentNode) child.parentNode.removeChild(child);
        return;
      }
      var el = byId(name), t = typeOf(el);
      if (t === 'List') { var items = listItems(el); setListItems(el, wz.pull(items, typeof item === 'string' ? item : text(item))); return; }
      if (t === 'Table') { var d = tableData(el).slice(); renderTable(el, wz.pull(d, item)); return; }
      if (t === 'DropDown' || t === 'RadioGroup') { setOptions(el, wz.pull(optionsOf(el), text(item))); return; }
      if (t === 'ProgressBar') { progress(el, wz.sub(el.getAttribute('data-value') || 0, item)); return; }
      throw error(ui('hasNoItems', [name]));
    };
    wz.clear_control = function (name) {
      var el = byId(name), t = typeOf(el);
      if (t === 'List') setListItems(el, []);
      else if (t === 'Table') renderTable(el, []);
      else if (t === 'DropDown' || t === 'RadioGroup') setOptions(el, []);
      else if (t === 'CheckBox') el.querySelector('input').checked = false;
      else if (t === 'ProgressBar') progress(el, 0);
      else if (input(el)) input(el).value = '';
      else wz.set(name, 'text', '');
    };

    /* ---------------- events ---------------- */

    wz.on = function (name, ev, fn) {
      var el;
      try { el = byId(name); } catch (e) { report(e); return; }
      var t = typeOf(el);
      if (ev === 'enter') {
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !(e.shiftKey && e.target.tagName === 'TEXTAREA')) { e.preventDefault(); run(fn); }
        });
        return;
      }
      var target = el;
      if (ev === 'ended') target = media(el) || el;
      target.addEventListener(ev, function (e) {
        if (ev === 'click' && (t === 'Table' || t === 'List')) {
          var row = e.target.closest(t === 'Table' ? 'tbody tr' : 'li');
          if (!row || !el.contains(row)) return;
          var idx = Array.prototype.indexOf.call(row.parentNode.children, row);
          Array.prototype.forEach.call(row.parentNode.children, function (x) { x.classList.toggle('wz-sel', x === row); });
          el._wzSelIndex = idx + 1;
          el._wzSel = t === 'Table' ? (tableData(el)[idx] === undefined ? null : tableData(el)[idx]) : row.textContent;
        }
        if (ev === 'click' && el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault();
        run(fn);
      });
    };
    // clicking a row of a table or list selects it, even without an event
    document.addEventListener('click', function (e) {
      var row = e.target.closest && e.target.closest('[data-wz=Table] tbody tr, [data-wz=List] > li');
      if (!row) return;
      var el = row.closest('[data-wz]');
      var idx = Array.prototype.indexOf.call(row.parentNode.children, row);
      Array.prototype.forEach.call(row.parentNode.children, function (x) { x.classList.toggle('wz-sel', x === row); });
      el._wzSelIndex = idx + 1;
      el._wzSel = el.getAttribute('data-wz') === 'Table' ? (tableData(el)[idx] === undefined ? null : tableData(el)[idx]) : row.textContent;
    }, true);

    var KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', ' ': 'space', Spacebar: 'space', Enter: 'enter', Escape: 'escape', Backspace: 'backspace', Tab: 'tab', Delete: 'delete' };
    wz.on_key = function (fn) {
      document.addEventListener('keydown', function (e) {
        var tg = e.target;
        if (tg && (/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName) || tg.isContentEditable)) return;
        var k = KEYS[e.key] || (e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key);
        if (/^(up|down|left|right|space)$/.test(k)) e.preventDefault();
        run(fn, k);
      });
    };
    wz.every = function (ms, fn) {
      var busy = false, id = null, stopped = false;
      timers.push(function () {
        id = setInterval(function () {
          if (busy || stopped) return;
          busy = true;
          run(fn).then(function () { busy = false; });
        }, Math.max(15, wz.num(ms)));
      });
      if (booted) timers[timers.length - 1]();
      return function () { stopped = true; if (id) clearInterval(id); };
    };

    /* ---------------- pages and links ---------------- */

    wz.go = function (page) {
      var p = text(page);
      var file = pageFile(p);
      if (!file) {
        if (/^(https?:|mailto:|tel:|\.?\/|[\w-]+\.html?)/i.test(p)) file = p;
        else throw error(ui('noPage', [p]));
      }
      if (cfg.mode === 'preview') { post({ wemazy: 'go', file: file, page: cfg.page }); return; }
      window.location.href = file;
    };
    wz.back = function () {
      if (cfg.mode === 'preview') { post({ wemazy: 'back' }); return; }
      window.history.back();
    };
    wz.open_link = function (url) { window.open(resolve(url), '_blank', 'noopener'); };
    // in the preview, links to other pages are opened by Wemazy
    document.addEventListener('click', function (e) {
      if (cfg.mode !== 'preview' || e.defaultPrevented) return;
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#') return;
      e.preventDefault();
      if (/^(https?:|mailto:|tel:)/i.test(href)) { window.open(href, '_blank', 'noopener'); return; }
      post({ wemazy: 'go', file: href.split('#')[0], page: cfg.page });
    });

    /* ---------------- sounds, speech, memory ---------------- */

    wz.sound = function (url) {
      try { var a = new window.Audio(resolve(url)); var p = a.play(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* no sound */ }
    };
    wz.speak = function (s) {
      try {
        var u = new window.SpeechSynthesisUtterance(text(s));
        u.lang = wz.lang === 'ro' ? 'ro-RO' : 'en-US';
        window.speechSynthesis.speak(u);
      } catch (e) { /* no voice */ }
    };
    var memory = {};
    function memKey(k) { return 'wz:' + cfg.site + ':' + text(k); }
    wz.remember = function (k, v) {
      var s = JSON.stringify(v === undefined ? null : v);
      memory[memKey(k)] = s;
      try { window.localStorage.setItem(memKey(k), s); } catch (e) { /* private window */ }
    };
    wz.recall = function (k) {
      var s = null;
      try { s = window.localStorage.getItem(memKey(k)); } catch (e) { /* private window */ }
      if (s === null || s === undefined) s = memory[memKey(k)];
      if (s === null || s === undefined) return null;
      try { return JSON.parse(s); } catch (e) { return null; }
    };
    wz.forget = function (k) {
      delete memory[memKey(k)];
      try { window.localStorage.removeItem(memKey(k)); } catch (e) { /* private window */ }
    };
    wz.fetch = function (url) {
      return window.fetch(resolve(url)).then(function (r) {
        var ct = r.headers.get('content-type') || '';
        if (/json/.test(ct)) return r.json();
        return r.text().then(function (t) { try { return JSON.parse(t); } catch (e) { return t; } });
      });
    };

    /* ---------------- message boxes ---------------- */

    var styleDone = false;
    function injectStyle() {
      if (styleDone || !document.head) return;
      styleDone = true;
      var css = '.wz-hidden{display:none!important}' +
        '.wz-dlg-back{position:fixed;inset:0;background:rgba(20,20,30,.45);display:flex;align-items:center;justify-content:center;z-index:2147483000;padding:16px}' +
        '.wz-dlg{background:#fff;color:#1c1c22;max-width:420px;width:100%;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,.3);padding:20px;font:16px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}' +
        '.wz-dlg p{margin:0 0 16px;white-space:pre-wrap;overflow-wrap:anywhere}' +
        '.wz-dlg input{display:block;width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #c5c5d0;border-radius:8px;font:inherit;margin:0 0 16px}' +
        '.wz-dlg-b{display:flex;gap:8px;justify-content:flex-end}' +
        '.wz-dlg button{font:inherit;padding:8px 18px;border-radius:8px;border:1px solid transparent;cursor:pointer;background:var(--wz-primary,#4338ca);color:#fff}' +
        '.wz-dlg button.wz-sec{background:transparent;color:inherit;border-color:#c5c5d0}' +
        '.wz-dlg button:focus-visible,.wz-dlg input:focus-visible{outline:3px solid rgba(67,56,202,.35);outline-offset:1px}' +
        '.wz-toasts{position:fixed;right:16px;bottom:16px;left:16px;display:flex;flex-direction:column;align-items:flex-end;gap:8px;z-index:2147483001;pointer-events:none}' +
        '.wz-toast{background:#1c1c22;color:#fff;padding:10px 14px;border-radius:10px;font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:340px;pointer-events:auto}' +
        '.wz-toast.wz-bad{background:#a8261b}' +
        '[data-wz=Table] tbody tr,[data-wz=List]>li{cursor:default}' +
        '[data-wz=Table] tbody tr.wz-sel{background:rgba(67,56,202,.12)}';
      var st = document.createElement('style');
      st.textContent = css;
      document.head.appendChild(st);
    }
    var queue = Promise.resolve();
    function dialog(kind, message, value) {
      injectStyle();
      var job = queue.then(function () {
        return new Promise(function (res) {
          var back = document.createElement('div');
          back.className = 'wz-dlg-back';
          var box = document.createElement('div');
          box.className = 'wz-dlg';
          box.setAttribute('role', kind === 'message' ? 'alertdialog' : 'dialog');
          box.setAttribute('aria-modal', 'true');
          var p = document.createElement('p');
          p.textContent = text(message);
          box.appendChild(p);
          var inp = null;
          if (kind === 'ask') {
            inp = document.createElement('input');
            inp.type = 'text';
            inp.value = value === undefined || value === null ? '' : text(value);
            box.appendChild(inp);
          }
          var bar = document.createElement('div');
          bar.className = 'wz-dlg-b';
          function btn(label, sec, val) {
            var b = document.createElement('button');
            b.type = 'button';
            b.textContent = label;
            if (sec) b.className = 'wz-sec';
            b.onclick = function () { done(val); };
            bar.appendChild(b);
            return b;
          }
          var prevFocus = document.activeElement;
          function done(val) {
            document.removeEventListener('keydown', onKey, true);
            back.remove();
            if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) { /* gone */ }
            wz.reset_clock();
            res(val === '__input' ? inp.value : val);
          }
          function onKey(e) {
            if (e.key === 'Escape') { e.preventDefault(); done(kind === 'confirm' ? false : (kind === 'ask' ? null : undefined)); }
            else if (e.key === 'Enter' && kind !== 'confirm') { e.preventDefault(); done(kind === 'ask' ? '__input' : undefined); }
          }
          var first;
          if (kind === 'confirm') { btn(ui('no'), true, false); first = btn(ui('yes'), false, true); }
          else if (kind === 'ask') { btn(ui('cancel'), true, null); btn(ui('ok'), false, '__input'); first = inp; }
          else first = btn(ui('ok'), false, undefined);
          box.appendChild(bar);
          back.appendChild(box);
          document.body.appendChild(back);
          document.addEventListener('keydown', onKey, true);
          setTimeout(function () { first.focus(); }, 0);
        });
      });
      queue = job.then(function () {}, function () {});
      return job;
    }
    wz.message = function (m) { return dialog('message', m); };
    wz.ask = function (q) { return dialog('ask', q); };
    wz.confirm = function (q) { return dialog('confirm', q); };
    function toast(m, bad) {
      injectStyle();
      if (!document.body) return;
      var box = document.querySelector('.wz-toasts');
      if (!box) { box = document.createElement('div'); box.className = 'wz-toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
      var t = document.createElement('div');
      t.className = 'wz-toast' + (bad ? ' wz-bad' : '');
      t.textContent = text(m);
      box.appendChild(t);
      setTimeout(function () { t.remove(); }, bad ? 7000 : 3500);
    }
    wz.toast = function (m) { toast(m, false); };

    /* ---------------- server ---------------- */

    var reqId = 0, pending = {};
    window.addEventListener('message', function (e) {
      var d = e.data;
      if (!d || d.wemazy !== 'result' || !pending[d.id]) return;
      var p = pending[d.id];
      delete pending[d.id];
      (d.log || []).forEach(function (s) { if (window.console) console.log('[server] ' + s); });
      wz.reset_clock();
      if (d.ok) p.res(d.value === undefined ? null : d.value);
      else { var er = error(d.error); er.wzFile = d.file || null; er.wzLine = d.line || null; p.rej(er); }
    });
    function transport(payload) {
      wz.reset_clock();
      if (cfg.mode === 'preview') {
        return new Promise(function (res, rej) {
          var id = ++reqId;
          pending[id] = { res: res, rej: rej };
          post({ wemazy: 'call', id: id, payload: JSON.parse(JSON.stringify(payload)), page: cfg.page });
        });
      }
      if (cfg.mode === 'local' && wz.localServer) {
        var s = wz.localServer;
        var job = payload.fn !== undefined ? s.call(payload.fn, payload.args) : s.query(payload.q, payload.args);
        return Promise.resolve(job).then(function (v) { wz.reset_clock(); return v; });
      }
      if (cfg.mode === 'php') {
        return window.fetch(cfg.api, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(payload)
        }).then(function (r) {
          return r.text().then(function (body) {
            var d;
            try { d = JSON.parse(body); } catch (e) { throw error(ui('netError', [r.status + ' ' + body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)])); }
            (d.log || []).forEach(function (s) { wz.print(s); });
            wz.reset_clock();
            if (!d.ok) { var er = error(d.error || 'Server error'); er.wzFile = d.file || null; er.wzLine = d.line || null; throw er; }
            return d.value === undefined ? null : d.value;
          });
        }, function (e) { throw error(ui('netError', [e.message])); });
      }
      return Promise.reject(error(ui('noServer')));
    }
    // objects of classes come back from the server as JSON: they become objects again
    wz.call = function (fn, args) { return transport({ fn: fn, args: args || [] }).then(wz.revive); };
    wz.query = function (id, args) { return transport({ q: id, args: args || [] }); };

    /* ---------------- free-form (Windows Forms style) panels ---------------- */

    function fitFree() {
      var list = document.querySelectorAll('.wz-free');
      for (var i = 0; i < list.length; i++) {
        var el = list[i], inner = el.firstElementChild;
        if (!inner) continue;
        var dw = parseFloat(el.getAttribute('data-dw')) || inner.offsetWidth;
        var dh = parseFloat(el.getAttribute('data-dh')) || inner.offsetHeight;
        var parent = el.parentElement;
        if (!parent) continue;
        var cs = window.getComputedStyle(parent);
        var avail = parent.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
        var s = avail > 0 ? Math.min(1, avail / dw) : 1;
        inner.style.transform = s < 1 ? 'scale(' + s + ')' : '';
        el.style.height = s < 1 ? Math.ceil(dh * s) + 'px' : '';
      }
    }
    wz.fit = fitFree;

    // sliders show their value
    document.addEventListener('input', function (e) {
      var el = e.target.closest && e.target.closest('[data-wz=Slider]');
      if (el) updateOut(el);
    });

    return wz;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = W.runtime.client;
})(typeof window !== 'undefined' ? window : globalThis);
