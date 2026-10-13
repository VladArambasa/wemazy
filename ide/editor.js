/*!
 * Wemazy IDE - the code editor.
 * A textarea for typing (so undo, IME, screen readers work) over a coloured copy
 * of the code. Adds line numbers, error squiggles, IntelliSense, auto-indent,
 * automatic "end", find and replace.
 */
(function (root) {
  'use strict';
  var W = root.Wemazy = root.Wemazy || {};
  var U = W.util, h = U.h;
  var LH = 20, PADX = 12, PADY = 8, IND = '    ';

  /* ---------------- colouring other languages (for the translated code) ---------------- */

  var KW = {
    js: 'async await break case catch class const continue default delete do else export for function if in instanceof let new null of return switch this throw true false try typeof undefined var void while yield',
    php: 'abstract and array as break case catch class const continue declare default do echo else elseif empty endfor endforeach endif endwhile extends false final finally fn for foreach function global if implements include isset list namespace new null or private protected public require require_once return static switch throw true try unset use var while yield',
    sql: 'select from where and or not null is in like escape order by asc desc limit insert into values update set delete create table if exists primary key autoincrement auto_increment integer int text real double varchar tinyint date datetime default charset count names'
  };
  function simpleHighlight(src, lang) {
    var words = {};
    (KW[lang] || '').split(' ').forEach(function (w) { words[w] = 1; });
    var out = [], i = 0, n = src.length;
    var re = lang === 'sql'
      ? /(--[^\n]*)|('(?:[^'\\]|\\.|'')*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][\w]*)|(\s+)|([\s\S])/g
      : /(\/\/[^\n]*|#[^\n[]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|(\$?[A-Za-z_][\w]*)|(\s+)|([\s\S])/g;
    var m;
    while ((m = re.exec(src))) {
      var t = m[0], cls = null;
      if (m[1]) cls = 'com';
      else if (m[2]) cls = 'str';
      else if (m[3]) cls = 'num';
      else if (m[4]) {
        var lw = lang === 'sql' ? t.toLowerCase() : t;
        if (words[lw]) cls = 'kw';
        else if (/^\$/.test(t)) cls = 'var';
        else if (/^(wz|wz_\w+)$/.test(t) || /^wz_/.test(t)) cls = 'fn';
        else if (src[re.lastIndex] === '(') cls = 'fn';
      }
      out.push({ s: m.index, e: m.index + t.length, c: cls });
      void i; void n;
    }
    return out;
  }

  function render(src, spans) {
    var html = '', pos = 0;
    spans.forEach(function (sp) {
      if (sp.s < pos) return;
      if (sp.s > pos) html += U.esc(src.slice(pos, sp.s));
      var t = U.esc(src.slice(sp.s, sp.e));
      html += sp.c ? '<span class="t-' + sp.c + '">' + t + '</span>' : t;
      pos = sp.e;
    });
    if (pos < src.length) html += U.esc(src.slice(pos));
    return html + '\n';
  }

  /* ---------------- the editor ---------------- */

  /**
   * opts: { language: 'wz'|'js'|'php'|'sql', readOnly, highlightContext(), complete(info), signature(name), hover(word),
   *         onChange(value), vocab() }
   */
  function Editor(host, opts) {
    this.opts = opts || {};
    this.host = host;
    this.lang = this.opts.language || 'wz';
    this.markers = [];
    this.build();
  }
  var E = Editor.prototype;

  E.build = function () {
    var self = this;
    this.el = h('div.ed', { class: this.opts.readOnly ? 'ro' : '' });
    this.gutter = h('div.ed-gutter');
    this.lines = h('div.ed-lines');
    this.gutter.appendChild(this.lines);
    this.main = h('div.ed-main');
    this.hl = h('pre.ed-hl', { 'aria-hidden': 'true' });
    this.code = h('code');
    this.hl.appendChild(this.code);
    this.layer = h('div.ed-layer', { 'aria-hidden': 'true' });
    this.cur = h('div.ed-curline', { 'aria-hidden': 'true' });
    this.ta = h('textarea.ed-ta', { wrap: 'off', spellcheck: false, autocapitalize: 'off', autocomplete: 'off', 'aria-label': this.opts.label || W.t('ed.label') });
    this.ta.setAttribute('autocorrect', 'off');
    if (this.opts.readOnly) this.ta.readOnly = true;
    this.main.appendChild(this.cur);
    this.main.appendChild(this.hl);
    this.main.appendChild(this.layer);
    this.main.appendChild(this.ta);
    this.el.appendChild(this.gutter);
    this.el.appendChild(this.main);
    this.ac = h('div.ed-ac', { role: 'listbox' });
    this.acDoc = h('div.ed-acdoc');
    this.sig = h('div.ed-sig');
    this.tipEl = h('div.ed-tip');
    this.el.appendChild(this.ac);
    this.el.appendChild(this.acDoc);
    this.el.appendChild(this.sig);
    this.el.appendChild(this.tipEl);
    this.host.appendChild(this.el);
    this.measure();

    this.ta.addEventListener('input', function (e) { self.onInput(e); });
    this.ta.addEventListener('scroll', function () { self.sync(); });
    this.ta.addEventListener('keydown', function (e) { self.onKey(e); });
    this.ta.addEventListener('keyup', function (e) {
      if (/^(Arrow|Home|End|Page)/.test(e.key)) self.caretMoved();
    });
    this.ta.addEventListener('click', function () { self.caretMoved(); self.closeAc(); });
    this.ta.addEventListener('blur', function () { setTimeout(function () { if (document.activeElement !== self.ta) { self.closeAc(); self.sig.style.display = 'none'; } }, 150); });
    this.ta.addEventListener('paste', function (e) {
      if (self.opts.readOnly) return;
      var t = (e.clipboardData || window.clipboardData).getData('text/plain');
      if (t && /\t|\r/.test(t)) {
        e.preventDefault();
        self.insert(t.replace(/\r\n?/g, '\n').replace(/\t/g, IND));
      }
    });
    this.ta.addEventListener('mousemove', function (e) { self.onHoverMove(e); });
    this.ta.addEventListener('mouseleave', function () { self.hideTip(); });
    this.ac.addEventListener('mousedown', function (e) { e.preventDefault(); });
    this.ro = new ResizeObserver(function () { self.checkMeasure(); self.drawMarkers(); self.sync(); });
    this.ro.observe(this.main);
    this.setValue('');
  };

  /** Width of a character and height of a line (they change with the code size option). */
  E.measure = function () {
    var probe = h('span.ed-probe', 'MMMMMMMMMMMMMMMMMMMM');
    this.main.appendChild(probe);
    var w = probe.getBoundingClientRect().width / 20;
    probe.remove();
    var cs = window.getComputedStyle(this.ta);
    var lh = parseFloat(cs.lineHeight);
    this.lh = lh > 0 ? lh : 20;
    LH = this.lh;
    if (w > 0) { this.cw = w; this.measured = cs.fontSize + '|' + cs.fontFamily; }
    else if (!this.cw) this.cw = 8;
  };
  /** Measure again when the editor becomes visible or the font changed. */
  E.checkMeasure = function () {
    var cs = window.getComputedStyle(this.ta);
    if (this.measured !== cs.fontSize + '|' + cs.fontFamily || this.lh !== parseFloat(cs.lineHeight)) this.measure();
    LH = this.lh;
  };

  E.getValue = function () { return this.ta.value; };
  E.setValue = function (v, keepScroll) {
    var st = this.ta.scrollTop, sl = this.ta.scrollLeft;
    this.ta.value = (v || '').replace(/\r\n?/g, '\n');
    if (keepScroll) { this.ta.scrollTop = st; this.ta.scrollLeft = sl; }
    else { this.ta.scrollTop = 0; this.ta.scrollLeft = 0; this.ta.setSelectionRange(0, 0); }
    this.refresh();
  };
  E.focus = function () { this.ta.focus({ preventScroll: true }); };
  E.setLanguage = function (l) { this.lang = l; this.refresh(); };

  E.refresh = function () {
    this.checkMeasure();
    var src = this.ta.value;
    var spans;
    if (this.lang === 'wz') {
      var ctx = this.opts.highlightContext ? this.opts.highlightContext() : {};
      try { spans = W.lang.highlight(src, ctx); } catch (e) { spans = []; }
    } else spans = simpleHighlight(src, this.lang);
    this.code.innerHTML = render(src, spans);
    var n = src.split('\n').length;
    if (n !== this.lineCount) {
      this.lineCount = n;
      var s = '';
      for (var i = 1; i <= n; i++) s += '<div>' + i + '</div>';
      this.lines.innerHTML = s;
    }
    this.drawMarkers();
    this.sync();
  };

  E.sync = function () {
    var x = this.ta.scrollLeft, y = this.ta.scrollTop;
    this.hl.style.transform = 'translate(' + (-x) + 'px,' + (-y) + 'px)';
    this.layer.style.transform = 'translate(' + (-x) + 'px,' + (-y) + 'px)';
    this.lines.style.transform = 'translateY(' + (-y) + 'px)';
    this.drawCurLine();
  };

  E.caret = function () {
    var v = this.ta.value, p = this.ta.selectionStart;
    var before = v.slice(0, p);
    var line = before.split('\n').length - 1;
    var col = p - (before.lastIndexOf('\n') + 1);
    return { pos: p, line: line, col: col };
  };
  E.drawCurLine = function () {
    var c = this.caret();
    this.cur.style.top = (PADY + c.line * LH - this.ta.scrollTop) + 'px';
    var ln = this.lines.children;
    if (this._activeLn !== undefined && ln[this._activeLn]) ln[this._activeLn].classList.remove('on');
    if (ln[c.line]) ln[c.line].classList.add('on');
    this._activeLn = c.line;
  };
  E.caretMoved = function () {
    this.drawCurLine();
    if (this.opts.onCaret) this.opts.onCaret(this.caret());
    this.updateSignature();
  };

  /** Pixel position of a character (for popups). */
  E.coords = function (line, col) {
    return { x: PADX + col * this.cw - this.ta.scrollLeft + this.gutter.offsetWidth, y: PADY + line * LH - this.ta.scrollTop };
  };

  /* ---------------- markers (errors, warnings, search matches) ---------------- */

  E.setMarkers = function (list) {
    this.markers = list || [];
    this.drawMarkers();
  };
  E.drawMarkers = function () {
    var self = this;
    var html = '';
    var lines = this.ta.value.split('\n');
    (this.markers || []).forEach(function (m) {
      var ln = (m.line || 1) - 1, col = (m.col || 1) - 1;
      var text = lines[ln] || '';
      var len = Math.max(1, Math.min(m.len || 1, Math.max(1, text.length - col)));
      if (col >= text.length) { col = Math.max(0, text.length - 1); len = 1; }
      html += '<div class="ed-mk ' + (m.kind || 'error') + '" style="top:' + (PADY + ln * LH) + 'px;left:' + (PADX + col * self.cw) + 'px;width:' + (len * self.cw) + 'px"></div>';
    });
    (this.found || []).forEach(function (f, i) {
      html += '<div class="ed-find' + (i === self.foundIndex ? ' cur' : '') + '" style="top:' + (PADY + f.line * LH) + 'px;left:' + (PADX + f.col * self.cw) + 'px;width:' + (f.len * self.cw) + 'px"></div>';
    });
    this.layer.innerHTML = html;
    // gutter marks
    var ln = this.lines.children;
    for (var i = 0; i < ln.length; i++) { ln[i].classList.remove('err'); ln[i].classList.remove('warn'); ln[i].removeAttribute('title'); }
    (this.markers || []).forEach(function (m) {
      var d = ln[(m.line || 1) - 1];
      if (d) { d.classList.add(m.kind === 'warning' ? 'warn' : 'err'); d.title = m.msg || ''; }
    });
  };

  E.onHoverMove = function (e) {
    var r = this.ta.getBoundingClientRect();
    var x = e.clientX - r.left + this.ta.scrollLeft - PADX, y = e.clientY - r.top + this.ta.scrollTop - PADY;
    var line = Math.floor(y / LH), col = Math.floor(x / this.cw);
    var self = this;
    clearTimeout(this._hoverT);
    var hit = (this.markers || []).filter(function (m) {
      return m.line - 1 === line && col >= m.col - 1 - 1 && col <= m.col - 1 + (m.len || 1);
    })[0];
    if (hit) { this.showTip(hit.msg, e.clientX - this.el.getBoundingClientRect().left, (line + 1) * LH + PADY - this.ta.scrollTop + 4, 'error'); return; }
    this.hideTip();
    if (!this.opts.hover) return;
    this._hoverT = setTimeout(function () {
      var text = self.ta.value.split('\n')[line] || '';
      if (col < 0 || col >= text.length) return;
      var m, re = /[\p{L}_][\p{L}\p{N}_]*/gu, word = null;
      while ((m = re.exec(text))) { if (col >= m.index && col < m.index + m[0].length) { word = m; break; } }
      if (!word) return;
      var prev = text.slice(0, word.index).trimEnd();
      var html = self.opts.hover(word[0], { line: line, col: word.index, afterDot: /\.$/.test(prev), before: text.slice(0, word.index) });
      if (html) self.showTip(html, PADX + word.index * self.cw - self.ta.scrollLeft + self.gutter.offsetWidth, (line + 1) * LH + PADY - self.ta.scrollTop + 4, 'doc', true);
    }, 550);
  };
  E.showTip = function (content, x, y, kind, html) {
    var t = this.tipEl;
    if (html) t.innerHTML = content; else t.textContent = content;
    t.className = 'ed-tip ' + (kind || '');
    t.style.display = 'block';
    var max = this.el.clientWidth - 12;
    t.style.left = Math.max(4, Math.min(x, max - t.offsetWidth)) + 'px';
    t.style.top = y + 'px';
  };
  E.hideTip = function () { this.tipEl.style.display = 'none'; };

  /* ---------------- typing ---------------- */

  E.insert = function (text) {
    this.ta.focus();
    if (!document.execCommand('insertText', false, text)) {
      var s = this.ta.selectionStart, e = this.ta.selectionEnd, v = this.ta.value;
      this.ta.value = v.slice(0, s) + text + v.slice(e);
      this.ta.selectionStart = this.ta.selectionEnd = s + text.length;
      this.onInput();
    }
  };
  E.replaceRange = function (start, end, text) {
    this.ta.setSelectionRange(start, end);
    this.insert(text);
  };

  E.onInput = function () {
    var self = this;
    if (!this._raf) {
      this._raf = requestAnimationFrame(function () {
        self._raf = null;
        self.refresh();
      });
    }
    if (this.opts.onChange) this.opts.onChange(this.ta.value);
    if (this._closer) {
      this._closer = false;
      this.reindentLine(this.caret().line);
    }
    if (this._typed) {
      this._typed = false;
      this.maybeComplete();
    } else if (this._space) {
      this._space = false;
      this.maybeComplete(false, true);
    }
    this.updateSignature();
    this.drawCurLine();
  };

  E.vocab = function () { return this.opts.vocab ? this.opts.vocab() : W.lang.getVocab(['en']); };

  /** Indentation the line should have, from the blocks above it. */
  E.indentFor = function (lineIndex) {
    var v = this.ta.value.split('\n');
    var depths = W.lang.indents(v.slice(0, lineIndex + 1).join('\n'), this.vocab());
    return new Array((depths[lineIndex] || 0) + 1).join(IND);
  };
  /** Put a line at the depth its blocks give it (after typing "}" or "end if"). */
  E.reindentLine = function (lineIndex) {
    var v = this.ta.value, lines = v.split('\n');
    var line = lines[lineIndex];
    if (line === undefined || !line.trim()) return;
    var want = this.indentFor(lineIndex), have = /^ */.exec(line)[0];
    if (want === have) return;
    var ls = lines.slice(0, lineIndex).join('\n').length + (lineIndex ? 1 : 0);
    var p = this.ta.selectionStart, pe = this.ta.selectionEnd;
    this.ta.setSelectionRange(ls, ls + have.length);
    this.insert(want);
    var d = want.length - have.length;
    this.ta.setSelectionRange(Math.max(ls, p + d), Math.max(ls, pe + d));
  };

  E.onKey = function (e) {
    var self = this;
    if (this.acOpen()) {
      if (e.key === 'ArrowDown') { e.preventDefault(); this.acMove(1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); this.acMove(-1); return; }
      if (e.key === 'PageDown') { e.preventDefault(); this.acMove(8); return; }
      if (e.key === 'PageUp') { e.preventDefault(); this.acMove(-8); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); this.acAccept(); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.closeAc(); return; }
    }
    if (this.findBar && e.key === 'Escape') { e.preventDefault(); this.closeFind(); return; }
    var mod = U.mod(e);
    if (mod && (e.key === 'f' || e.key === 'F')) { e.preventDefault(); this.openFind(false); return; }
    if (mod && (e.key === 'h' || e.key === 'H')) { e.preventDefault(); this.openFind(true); return; }
    if (e.key === 'F3') { e.preventDefault(); this.findNext(e.shiftKey ? -1 : 1); return; }
    if (this.opts.readOnly) return;
    if (mod && e.key === ' ') { e.preventDefault(); this.maybeComplete(true); return; }
    if (mod && e.key === '/') { e.preventDefault(); this.toggleComment(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) this.outdent(); else this.indentSel();
      return;
    }
    if (e.key === 'Enter' && !mod && !e.altKey) {
      e.preventDefault();
      this.newline();
      return;
    }
    if (e.key === 'Backspace' && this.ta.selectionStart === this.ta.selectionEnd) {
      // remove a whole indent step
      var v = this.ta.value, p = this.ta.selectionStart;
      var ls = v.lastIndexOf('\n', p - 1) + 1;
      var before = v.slice(ls, p);
      if (before.length && /^ +$/.test(before)) {
        e.preventDefault();
        var cut = before.length % 4 || 4;
        this.ta.setSelectionRange(p - cut, p);
        this.insert('');
        return;
      }
    }
    if (e.key.length === 1 && /[\p{L}_.]/u.test(e.key) && !mod) {
      this._typed = true;
    }
    if (e.key === ' ' && !mod) this._space = true;
    if (e.key === '}' && !mod) {
      // a } typed at the start of a line goes back to the depth of its block
      var v2 = this.ta.value, p2 = this.ta.selectionStart;
      if (/^\s*$/.test(v2.slice(v2.lastIndexOf('\n', p2 - 1) + 1, p2))) this._closer = true;
    }
    if (e.key === 'Escape') { this.sig.style.display = 'none'; }
    setTimeout(function () { self.drawCurLine(); }, 0);
  };

  E.newline = function () {
    var v = this.ta.value, p = this.ta.selectionStart;
    var ls = v.lastIndexOf('\n', p - 1) + 1;
    var le = v.indexOf('\n', p); if (le < 0) le = v.length;
    var lineIndex = v.slice(0, ls).split('\n').length - 1;
    var vocab = this.vocab();
    var kinds = W.lang.lineKinds(v.slice(0, le), vocab);
    var k = kinds[lineIndex] || { kind: 'blank' };
    // put "}", "end ..." and "else" lines at the right depth
    if (k.kind === 'close' || k.kind === 'middle' || k.lead) {
      var before = this.ta.value.length;
      this.reindentLine(lineIndex);
      var d = this.ta.value.length - before;
      p += d; le += d;
      this.ta.setSelectionRange(p, p);
      v = this.ta.value;
    }
    var line = v.slice(ls, le);
    var selEnd = Math.max(p, this.ta.selectionEnd);
    var head = v.slice(ls, p), tail = v.slice(selEnd, le);
    var atEnd = tail.trim() === '';
    var indent = /^ */.exec(line)[0];
    var depthOf = function (text) {
      var d = W.lang.indents(text, vocab);
      return new Array((d[d.length - 1] || 0) + 1).join(IND);
    };
    var bodyIndent = depthOf(v.slice(0, p) + '\n');   // a new empty line here
    var htoks = W.lang.lex(head).tokens.filter(function (t) { return t.t !== 'nl' && t.t !== 'eof'; });
    var last = htoks[htoks.length - 1];
    var endsWithBrace = !!(last && last.t === 'op' && last.v === '{');
    var self = this;
    var put = function (text, caretAt) {
      // replace the selection and the spaces before the rest of the line
      var sp = atEnd ? tail.length : /^ */.exec(tail)[0].length;
      self.ta.setSelectionRange(p, selEnd + sp);
      self.insert(text);
      var np = p + caretAt;
      self.ta.setSelectionRange(np, np);
      self.onInput();
    };
    if (atEnd) {
      // close the block for you: "}" or "end if"
      var closer = null;
      if (endsWithBrace && this.braceOpen(lineIndex)) closer = '}';
      else if (k.kind === 'open' && this.needsEnd(lineIndex)) closer = W.lang.endFor(k.block, vocab);
      if (closer) { put('\n' + bodyIndent + '\n' + indent + closer, 1 + bodyIndent.length); return; }
      put('\n' + bodyIndent, 1 + bodyIndent.length);
      return;
    }
    if (endsWithBrace && /^\s*\}/.test(tail)) {
      // Enter between { and }: an empty line inside, the } below
      var closeIndent = depthOf(v.slice(0, p) + '\n\n' + tail.replace(/^\s+/, ''));
      put('\n' + bodyIndent + '\n' + closeIndent, 1 + bodyIndent.length);
      return;
    }
    var restIndent = depthOf(v.slice(0, p) + '\n' + tail.replace(/^\s+/, ''));
    put('\n' + restIndent, 1 + restIndent.length);
  };

  /** Is the { at the end of this line still missing its }? */
  E.braceOpen = function (lineIndex) {
    var lines = this.ta.value.split('\n');
    var ind = function (l) { return /^ */.exec(l)[0].length; };
    var mine = ind(lines[lineIndex]);
    var depth = 1;
    for (var i = lineIndex + 1; i < lines.length; i++) {
      var toks = W.lang.lex(lines[i]).tokens;
      var first = toks[0];
      // a } further left closes a block around this one: ours is still open
      if (first && first.t === 'op' && first.v === '}' && ind(lines[i]) < mine) return true;
      for (var j = 0; j < toks.length; j++) {
        var t = toks[j];
        if (t.t !== 'op') continue;
        if (t.v === '{') depth++;
        else if (t.v === '}' && --depth === 0) return false;
      }
    }
    return true;
  };

  /** Is the block opened on this line still missing its "end"? */
  E.needsEnd = function (lineIndex) {
    var lines = this.ta.value.split('\n');
    var kinds = W.lang.lineKinds(this.ta.value, this.vocab());
    var kind = function (b) { return b === 'while' ? 'repeat' : b; };
    var indent = function (l) { return /^ */.exec(l)[0].length; };
    var mine = indent(lines[lineIndex]);
    var stack = [kind(kinds[lineIndex].block)];
    for (var i = lineIndex + 1; i < kinds.length; i++) {
      var k = kinds[i];
      if (k.kind === 'open') { stack.push(kind(k.block)); continue; }
      if (k.kind !== 'close') continue;
      // an "end" further left closes a block around this one: ours is still open
      if (indent(lines[i]) < mine) return true;
      var b = kind(k.block);
      var j = b ? stack.lastIndexOf(b) : stack.length - 1;
      if (j < 0) return true;
      if (j === 0) return false;
      stack.length = j;
    }
    return true;
  };

  E.selLines = function () {
    var v = this.ta.value, s = this.ta.selectionStart, e = this.ta.selectionEnd;
    var ls = v.lastIndexOf('\n', s - 1) + 1;
    var le = v.indexOf('\n', e > s && v[e - 1] === '\n' ? e - 1 : e);
    if (le < 0) le = v.length;
    return { start: ls, end: le, text: v.slice(ls, le) };
  };
  E.indentSel = function () {
    var s = this.ta.selectionStart, e = this.ta.selectionEnd;
    if (s === e) {
      var v = this.ta.value, ls = v.lastIndexOf('\n', s - 1) + 1;
      var col = s - ls;
      this.insert(new Array(4 - (col % 4) + 1).join(' '));
      return;
    }
    var L = this.selLines();
    var out = L.text.split('\n').map(function (l) { return l.length ? IND + l : l; }).join('\n');
    this.ta.setSelectionRange(L.start, L.end);
    this.insert(out);
    this.ta.setSelectionRange(L.start, L.start + out.length);
  };
  E.outdent = function () {
    var L = this.selLines();
    var out = L.text.split('\n').map(function (l) { return l.replace(/^ {1,4}/, ''); }).join('\n');
    if (out === L.text) return;
    this.ta.setSelectionRange(L.start, L.end);
    this.insert(out);
    this.ta.setSelectionRange(L.start, L.start + out.length);
  };
  E.toggleComment = function () {
    var L = this.selLines();
    var ls = L.text.split('\n');
    var all = ls.filter(function (l) { return l.trim(); }).every(function (l) { return /^\s*(#|\/\/)/.test(l); });
    var out = ls.map(function (l) {
      if (!l.trim()) return l;
      return all ? l.replace(/^(\s*)(#|\/\/) ?/, '$1') : l.replace(/^(\s*)/, '$1// ');
    }).join('\n');
    this.ta.setSelectionRange(L.start, L.end);
    this.insert(out);
    this.ta.setSelectionRange(L.start, L.start + out.length);
  };
  /** Re-indent everything. */
  E.format = function () {
    var v = this.ta.value;
    var out = W.lang.format(v, this.vocab());
    if (out === v) return;
    var c = this.caret();
    this.ta.setSelectionRange(0, v.length);
    this.insert(out);
    var lines = out.split('\n');
    var line = Math.min(c.line, lines.length - 1);
    var pos = lines.slice(0, line).join('\n').length + (line ? 1 : 0) + Math.min(lines[line].length, c.col);
    this.ta.setSelectionRange(pos, pos);
  };

  /** Move the cursor to a line (1-based) and column, and show it. */
  E.reveal = function (line, col, len) {
    var v = this.ta.value.split('\n');
    line = Math.max(1, Math.min(line || 1, v.length));
    var pos = 0;
    for (var i = 0; i < line - 1; i++) pos += v[i].length + 1;
    var c = Math.max(0, Math.min((col || 1) - 1, v[line - 1].length));
    this.ta.focus({ preventScroll: true });
    this.ta.setSelectionRange(pos + c, pos + c + (len || 0));
    var top = (line - 1) * LH;
    var vis = this.ta.clientHeight;
    if (top < this.ta.scrollTop + LH || top > this.ta.scrollTop + vis - 2 * LH) this.ta.scrollTop = Math.max(0, top - vis / 3);
    var x = c * this.cw;
    if (x < this.ta.scrollLeft || x > this.ta.scrollLeft + this.ta.clientWidth - 40) this.ta.scrollLeft = Math.max(0, x - 40);
    this.sync();
    this.caretMoved();
  };

  /* ---------------- IntelliSense ---------------- */

  E.acOpen = function () { return this.ac.style.display === 'block'; };
  E.closeAc = function () { this.ac.style.display = 'none'; this.acDoc.style.display = 'none'; this.acItems = null; };

  /** What is being typed: the word before the cursor and what comes before it. */
  E.context = function () {
    var v = this.ta.value, p = this.ta.selectionStart;
    var ls = v.lastIndexOf('\n', p - 1) + 1;
    var before = v.slice(ls, p);
    var m = /[\p{L}_][\p{L}\p{N}_]*$/u.exec(before);
    var word = m ? m[0] : '';
    var wordStart = p - word.length;
    var pre = before.slice(0, before.length - word.length);
    // after a dot (not in a number like 3.5): x. / Label1.text. / "abc". / f().
    var afterDot = /\.\s*$/.test(pre) && !/(^|[^\p{L}\p{N}_.])\d+\s*\.\s*$/u.test(pre);
    var dot = afterDot ? /([\p{L}_][\p{L}\p{N}_]*)\s*\.\s*$/u.exec(pre) : null;
    var chained = afterDot && (!dot || /[.)\]"'\u201D]\s*$/.test(pre.slice(0, dot.index)));
    var inString = (before.match(/"/g) || []).length % 2 === 1 && !/\{[^}]*$/.test(before);
    var inComment = /(^|\s)(#|\/\/)/.test(before.replace(/"[^"]*"/g, ''));
    return {
      word: word, wordStart: wordStart, pos: p, lineText: v.slice(ls, v.indexOf('\n', p) < 0 ? v.length : v.indexOf('\n', p)),
      before: pre, afterDot: afterDot, object: dot ? dot[1] : null, chained: chained, line: v.slice(0, p).split('\n').length - 1,
      inString: inString, inComment: inComment, lineStart: pre.trim() === '',
      textStart: ls + /^\s*/.exec(before)[0].length
    };
  };

  /** forced: Ctrl+Space. auto: a space was typed (only lists that help, like the tables after "find all"). */
  E.maybeComplete = function (forced, auto) {
    if (!this.opts.complete || this.opts.readOnly) return;
    var c = this.context();
    c.auto = !!auto;
    if (c.inComment || (c.inString && !forced)) { this.closeAc(); return; }
    if (!forced && !auto && !c.afterDot && c.word.length < 1) { this.closeAc(); return; }
    var items = this.opts.complete(c) || [];
    var w = W.lang.norm(c.word);
    if (w) {
      var starts = [], contains = [];
      items.forEach(function (it) {
        if (it.keep) { starts.push(it); return; }
        var n = W.lang.norm(it.label);
        if (n === w && !it.snippet && !forced) return;
        if (n.indexOf(w) === 0) starts.push(it);
        else if (w.length > 1 && n.indexOf(w) > 0) contains.push(it);
      });
      items = starts.concat(contains);
    }
    if (!items.length) { this.closeAc(); return; }
    this.acItems = items.slice(0, 200);
    this.acCtx = c;
    this.acIndex = 0;
    this.drawAc();
  };
  var KIND_ICON = { kw: 'K', snippet: '▸', ctl: 'C', prop: 'P', fn: 'ƒ', var: 'V', tbl: 'T', col: '▫', ev: '⚡', page: '◱', obj: 'O', cmd: '›', type: 't' };
  E.drawAc = function () {
    var self = this;
    U.clear(this.ac);
    this.acItems.forEach(function (it, i) {
      var row = h('div.ed-acitem', { class: i === self.acIndex ? 'on' : '', role: 'option', 'aria-selected': i === self.acIndex ? 'true' : 'false',
        onmousedown: function (e) { e.preventDefault(); self.acIndex = i; self.acAccept(); } },
        h('span.k.k-' + (it.kind || 'kw'), KIND_ICON[it.kind] || '·'),
        h('span.l', it.label),
        h('span.d', it.detail || ''));
      self.ac.appendChild(row);
    });
    var c = this.acCtx;
    var pos = this.coords(c.line, Math.max(0, c.wordStart - (this.ta.value.lastIndexOf('\n', c.wordStart - 1) + 1)));
    this.ac.style.display = 'block';
    var top = pos.y + LH + 2;
    if (top + this.ac.offsetHeight > this.el.clientHeight && pos.y - this.ac.offsetHeight > 0) top = pos.y - this.ac.offsetHeight - 2;
    this.ac.style.left = Math.max(0, Math.min(pos.x, this.el.clientWidth - this.ac.offsetWidth - 4)) + 'px';
    this.ac.style.top = top + 'px';
    var on = this.ac.children[this.acIndex];
    if (on) on.scrollIntoView({ block: 'nearest' });
    this.drawAcDoc();
  };
  E.drawAcDoc = function () {
    var it = this.acItems && this.acItems[this.acIndex];
    if (!it || !it.doc) { this.acDoc.style.display = 'none'; return; }
    this.acDoc.innerHTML = it.doc;
    this.acDoc.style.display = 'block';
    var r = this.ac.getBoundingClientRect(), er = this.el.getBoundingClientRect();
    var left = r.right - er.left + 4;
    if (left + 280 > this.el.clientWidth) left = Math.max(0, r.left - er.left - 284);
    this.acDoc.style.left = left + 'px';
    this.acDoc.style.top = (r.top - er.top) + 'px';
  };
  E.acMove = function (d) {
    this.acIndex = Math.max(0, Math.min(this.acItems.length - 1, this.acIndex + d));
    U.$$('.ed-acitem', this.ac).forEach(function (r, i) { r.classList.toggle('on', i === this.acIndex); r.setAttribute('aria-selected', i === this.acIndex ? 'true' : 'false'); }, this);
    var on = this.ac.children[this.acIndex];
    if (on) on.scrollIntoView({ block: 'nearest' });
    this.drawAcDoc();
  };
  E.acAccept = function () {
    var it = this.acItems && this.acItems[this.acIndex];
    var c = this.acCtx;
    this.closeAc();
    if (!it) return;
    var text = it.insert !== undefined ? it.insert : it.label;
    var from = it.start !== undefined ? it.start : c.wordStart;
    if (it.snippet) this.snippet(from, c.pos, text);
    else {
      this.replaceRange(from, c.pos, text);
      if (it.then === 'complete') { var self = this; setTimeout(function () { self.maybeComplete(true); }, 0); }
    }
  };
  /** Insert a snippet: $1 is selected, $0 is where the cursor goes; new lines keep the indentation. */
  E.snippet = function (start, end, text) {
    var v = this.ta.value;
    var ls = v.lastIndexOf('\n', start - 1) + 1;
    var indent = /^ */.exec(v.slice(ls))[0];
    var body = text.split('\n').map(function (l, i) { return i ? indent + l : l; }).join('\n');
    var sel = null;
    var m1 = /\$\{1:([^}]*)\}/.exec(body);
    var clean = body;
    if (m1) {
      sel = { at: m1.index, len: m1[1].length };
      clean = clean.replace(m1[0], m1[1]);
    }
    clean = clean.replace(/\$\{\d+:([^}]*)\}/g, '$1');   // other places to fill: just their text
    var z = clean.indexOf('$0');
    clean = clean.replace('$0', '');
    if (sel && z >= 0 && z > sel.at) z -= 0;
    this.replaceRange(start, end, clean);
    if (sel) this.ta.setSelectionRange(start + sel.at, start + sel.at + sel.len);
    else if (z >= 0) this.ta.setSelectionRange(start + z, start + z);
    this.onInput();
  };

  E.updateSignature = function () {
    if (!this.opts.signature) return;
    var v = this.ta.value, p = this.ta.selectionStart;
    var ls = v.lastIndexOf('\n', p - 1) + 1;
    var before = v.slice(ls, p);
    // find the open "(" we are in
    var depth = 0, i, argIndex = 0;
    for (i = before.length - 1; i >= 0; i--) {
      var ch = before[i];
      if (ch === ')') depth++;
      else if (ch === '(') { if (depth === 0) break; depth--; }
      else if (ch === ',' && depth === 0) argIndex++;
    }
    if (i < 0) { this.sig.style.display = 'none'; return; }
    var m = /([\p{L}_][\p{L}\p{N}_]*)\s*$/u.exec(before.slice(0, i));
    if (!m) { this.sig.style.display = 'none'; return; }
    var isMethod = /\.\s*$/.test(before.slice(0, i - m[0].length));
    var html = this.opts.signature(m[1], argIndex, isMethod);
    if (!html) { this.sig.style.display = 'none'; return; }
    this.sig.innerHTML = html;
    this.sig.style.display = 'block';
    var line = v.slice(0, p).split('\n').length - 1;
    var pos = this.coords(line, i - m[1].length);
    this.sig.style.left = Math.max(0, pos.x) + 'px';
    this.sig.style.top = Math.max(0, pos.y - 28) + 'px';
  };

  /* ---------------- find and replace ---------------- */

  E.openFind = function (withReplace) {
    var self = this;
    if (!this.findBar) {
      this.findInput = h('input.input.small', { type: 'text', placeholder: W.t('ed.find'), 'aria-label': W.t('ed.find'),
        oninput: function () { self.doFind(); },
        onkeydown: function (e) {
          if (e.key === 'Enter') { e.preventDefault(); self.findNext(e.shiftKey ? -1 : 1); }
          if (e.key === 'Escape') { e.preventDefault(); self.closeFind(); }
        } });
      this.replInput = h('input.input.small', { type: 'text', placeholder: W.t('ed.replaceWith'), 'aria-label': W.t('ed.replaceWith'),
        onkeydown: function (e) {
          if (e.key === 'Enter') { e.preventDefault(); self.replaceOne(); }
          if (e.key === 'Escape') { e.preventDefault(); self.closeFind(); }
        } });
      this.findCount = h('span.ed-count');
      this.findBar = h('div.ed-findbar',
        h('div.row', this.findInput, this.findCount,
          h('button.tb-btn', { type: 'button', title: W.t('ed.prev'), html: W.icons.svg('up'), onclick: function () { self.findNext(-1); } }),
          h('button.tb-btn', { type: 'button', title: W.t('ed.next'), html: W.icons.svg('down'), onclick: function () { self.findNext(1); } }),
          h('button.tb-btn', { type: 'button', title: W.t('common.close'), html: W.icons.svg('close'), onclick: function () { self.closeFind(); } })),
        h('div.row.repl', this.replInput,
          h('button.btn.small', { type: 'button', onclick: function () { self.replaceOne(); } }, W.t('ed.replace')),
          h('button.btn.small', { type: 'button', onclick: function () { self.replaceAll(); } }, W.t('ed.replaceAll'))));
      this.el.appendChild(this.findBar);
    }
    this.findBar.style.display = 'block';
    this.findBar.classList.toggle('with-repl', !!withReplace && !this.opts.readOnly);
    var sel = this.ta.value.slice(this.ta.selectionStart, this.ta.selectionEnd);
    if (sel && sel.indexOf('\n') < 0) this.findInput.value = sel;
    this.findInput.focus();
    this.findInput.select();
    this.doFind();
  };
  E.closeFind = function () {
    if (this.findBar) this.findBar.style.display = 'none';
    this.found = [];
    this.drawMarkers();
    this.ta.focus();
  };
  E.doFind = function () {
    var q = this.findInput.value;
    this.found = [];
    this.foundIndex = -1;
    if (q) {
      var lines = this.ta.value.split('\n'), lq = q.toLowerCase();
      lines.forEach(function (l, i) {
        var ll = l.toLowerCase(), j = ll.indexOf(lq);
        while (j >= 0) { this.found.push({ line: i, col: j, len: q.length }); j = ll.indexOf(lq, j + Math.max(1, q.length)); }
      }, this);
    }
    this.findCount.textContent = q ? (this.found.length ? W.t('ed.matches', this.found.length) : W.t('ed.noMatch')) : '';
    this.drawMarkers();
  };
  E.findNext = function (dir) {
    if (!this.found || !this.found.length) return;
    var p = this.ta.selectionStart;
    var lines = this.ta.value.split('\n');
    var offs = [], acc = 0;
    lines.forEach(function (l) { offs.push(acc); acc += l.length + 1; });
    var idx;
    if (dir > 0) {
      idx = this.found.findIndex(function (f) { return offs[f.line] + f.col > p - (this.foundIndex >= 0 ? 0 : 1); }, this);
      if (this.foundIndex >= 0) idx = (this.foundIndex + 1) % this.found.length;
      if (idx < 0) idx = 0;
    } else {
      idx = this.foundIndex > 0 ? this.foundIndex - 1 : this.found.length - 1;
    }
    this.foundIndex = idx;
    var f = this.found[idx];
    this.reveal(f.line + 1, f.col + 1, f.len);
    this.findInput.focus();
    this.drawMarkers();
  };
  E.replaceOne = function () {
    if (this.opts.readOnly) return;
    if (this.foundIndex < 0) { this.findNext(1); return; }
    var f = this.found[this.foundIndex];
    var lines = this.ta.value.split('\n');
    var pos = 0;
    for (var i = 0; i < f.line; i++) pos += lines[i].length + 1;
    pos += f.col;
    this.replaceRange(pos, pos + f.len, this.replInput.value);
    var keep = this.foundIndex;
    this.doFind();
    if (this.found.length) { this.foundIndex = Math.min(keep, this.found.length - 1) - 1; this.findNext(1); }
  };
  E.replaceAll = function () {
    if (this.opts.readOnly) return;
    var q = this.findInput.value;
    if (!q) return;
    var re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    var v = this.ta.value;
    var out = v.replace(re, this.replInput.value.replace(/\$/g, '$$$$'));
    if (out === v) return;
    var n = (v.match(re) || []).length;
    this.ta.setSelectionRange(0, v.length);
    this.insert(out);
    this.doFind();
    U.toast(W.t('ed.replaced', n));
  };

  W.Editor = Editor;
  W.Editor.simpleHighlight = simpleHighlight;
  /** Coloured HTML of some code (for the Help and the Language Lab). */
  W.Editor.colorize = function (src, lang, ctx) {
    src = String(src || '');
    var spans;
    if (!lang || lang === 'wz') {
      try { spans = W.lang.highlight(src, ctx || { vocab: W.lang.getVocab(['en']) }); } catch (e) { spans = []; }
    } else spans = simpleHighlight(src, lang);
    return render(src, spans).replace(/\n$/, '');
  };
})(typeof window !== 'undefined' ? window : globalThis);
