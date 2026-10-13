/*!
 * Wemazy IDE - the controls of the Toolbox.
 * Each control says: its properties (for the Properties window), its events, what
 * Wemazy Script can read/change on it, and how it becomes HTML. The designer and
 * the exported site use the same HTML, so the design view is what you get.
 */
(function (root) {
  'use strict';
  var W = root.Wemazy = root.Wemazy || {};

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function lines(v) {
    return String(v === null || v === undefined ? '' : v).split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  /* ---------------- property definitions ---------------- */
  // type: text | textarea | number | size | color | bool | select | image | link | lines | code | font | spacing
  var PROPS = {
    name: { type: 'name', cat: 'design' },
    text: { type: 'text', cat: 'content' },
    level: { type: 'select', cat: 'content', options: ['1', '2', '3', '4'] },
    src: { type: 'image', cat: 'content' },
    alt: { type: 'text', cat: 'content' },
    fit: { type: 'select', cat: 'appearance', options: ['cover', 'contain', 'fill'] },
    href: { type: 'link', cat: 'behavior' },
    newTab: { type: 'bool', cat: 'behavior' },
    label: { type: 'text', cat: 'content' },
    placeholder: { type: 'text', cat: 'content' },
    value: { type: 'text', cat: 'content' },
    inputType: { type: 'select', cat: 'behavior', options: ['text', 'email', 'password', 'number', 'tel', 'url'] },
    rows: { type: 'number', cat: 'content', min: 1, max: 40 },
    checked: { type: 'bool', cat: 'content' },
    options: { type: 'lines', cat: 'content' },
    items: { type: 'lines', cat: 'content' },
    listStyle: { type: 'select', cat: 'appearance', options: ['bullets', 'numbers', 'none'] },
    min: { type: 'number', cat: 'content' },
    max: { type: 'number', cat: 'content' },
    step: { type: 'number', cat: 'content' },
    showValue: { type: 'bool', cat: 'appearance' },
    columns: { type: 'text', cat: 'content' },
    headers: { type: 'text', cat: 'content' },
    tableRows: { type: 'lines', cat: 'content' },
    striped: { type: 'bool', cat: 'appearance' },
    url: { type: 'text', cat: 'content' },
    address: { type: 'text', cat: 'content' },
    zoom: { type: 'number', cat: 'content', min: 1, max: 20 },
    html: { type: 'code', cat: 'content' },
    brand: { type: 'text', cat: 'content' },
    links: { type: 'lines', cat: 'content' },
    sticky: { type: 'bool', cat: 'behavior' },
    count: { type: 'select', cat: 'layout', options: ['2', '3', '4'] },
    ratio: { type: 'select', cat: 'layout', options: ['equal', '1:2', '2:1', '1:3', '3:1', '1:2:1'] },
    stackOnPhone: { type: 'bool', cat: 'layout' },
    layout: { type: 'select', cat: 'layout', options: ['stack', 'row', 'free'] },
    gap: { type: 'number', cat: 'layout', min: 0, max: 200 },
    align: { type: 'select', cat: 'layout', options: ['left', 'center', 'right', 'stretch'] },
    valign: { type: 'select', cat: 'layout', options: ['top', 'center', 'bottom', 'stretch'] },
    spread: { type: 'bool', cat: 'layout' },
    contentWidth: { type: 'select', cat: 'layout', options: ['boxed', 'narrow', 'full'] },
    formWidth: { type: 'number', cat: 'layout', min: 100, max: 4000 },
    formHeight: { type: 'number', cat: 'layout', min: 50, max: 6000 },
    width: { type: 'size', cat: 'layout' },
    height: { type: 'size', cat: 'layout' },
    minHeight: { type: 'size', cat: 'layout' },
    maxWidth: { type: 'size', cat: 'layout' },
    place: { type: 'select', cat: 'layout', options: ['auto', 'left', 'center', 'right', 'stretch'] },
    padding: { type: 'spacing', cat: 'layout' },
    margin: { type: 'spacing', cat: 'layout' },
    x: { type: 'number', cat: 'layout' },
    y: { type: 'number', cat: 'layout' },
    color: { type: 'color', cat: 'appearance' },
    background: { type: 'color', cat: 'appearance' },
    bgImage: { type: 'image', cat: 'appearance' },
    font: { type: 'font', cat: 'appearance' },
    size: { type: 'number', cat: 'appearance', min: 6, max: 200 },
    bold: { type: 'bool', cat: 'appearance' },
    italic: { type: 'bool', cat: 'appearance' },
    underline: { type: 'bool', cat: 'appearance' },
    textAlign: { type: 'select', cat: 'appearance', options: ['left', 'center', 'right', 'justify'] },
    border: { type: 'number', cat: 'appearance', min: 0, max: 40 },
    borderColor: { type: 'color', cat: 'appearance' },
    radius: { type: 'number', cat: 'appearance', min: 0, max: 400 },
    shadow: { type: 'select', cat: 'appearance', options: ['none', 'small', 'medium', 'large'] },
    opacity: { type: 'number', cat: 'appearance', min: 0, max: 100 },
    animation: { type: 'select', cat: 'appearance', options: ['none', 'fade', 'slide', 'zoom', 'bounce', 'pulse'] },
    barColor: { type: 'color', cat: 'appearance' },
    thickness: { type: 'number', cat: 'appearance', min: 1, max: 40 },
    visible: { type: 'bool', cat: 'behavior' },
    enabled: { type: 'bool', cat: 'behavior' },
    tooltip: { type: 'text', cat: 'behavior' },
    hideOnPhone: { type: 'bool', cat: 'behavior' },
    hideOnDesktop: { type: 'bool', cat: 'behavior' },
    required: { type: 'bool', cat: 'behavior' },
    autoplay: { type: 'bool', cat: 'behavior' },
    loop: { type: 'bool', cat: 'behavior' },
    controls: { type: 'bool', cat: 'behavior' },
    // page
    title: { type: 'text', cat: 'content' },
    description: { type: 'textarea', cat: 'content' },
    inMenu: { type: 'bool', cat: 'behavior' }
  };

  var FONTS = {
    'theme': '',
    'sans': 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    'serif': 'Georgia, Cambria, "Times New Roman", Times, serif',
    'rounded': 'ui-rounded, "Nunito", "Varela Round", "Segoe UI", system-ui, sans-serif',
    'mono': 'ui-monospace, "Cascadia Mono", Consolas, Menlo, monospace',
    'display': '"Arial Black", "Segoe UI Black", Impact, system-ui, sans-serif',
    'hand': '"Segoe Print", "Bradley Hand", "Comic Sans MS", "Chalkboard SE", cursive'
  };
  var SHADOWS = {
    none: 'none',
    small: '0 1px 2px rgba(0,0,0,.08), 0 2px 6px rgba(0,0,0,.06)',
    medium: '0 2px 4px rgba(0,0,0,.06), 0 8px 20px rgba(0,0,0,.10)',
    large: '0 6px 12px rgba(0,0,0,.08), 0 20px 48px rgba(0,0,0,.16)'
  };

  /* Groups of properties used by many controls */
  var TEXT_LOOK = ['color', 'background', 'font', 'size', 'bold', 'italic', 'underline', 'textAlign'];
  var BOX_LOOK = ['border', 'borderColor', 'radius', 'shadow', 'opacity', 'animation'];
  var BOX_LAYOUT = ['width', 'height', 'place', 'padding', 'margin', 'x', 'y'];
  var BEHAVE = ['visible', 'tooltip', 'hideOnPhone', 'hideOnDesktop'];
  var CONTAINER = ['layout', 'gap', 'align', 'valign', 'spread', 'formWidth', 'formHeight'];

  // What Wemazy Script may read or change (Button1.text ...)
  var CODE_COMMON = { visible: { type: 'bool' }, color: {}, background: {}, size: { type: 'num' }, bold: { type: 'bool' }, italic: { type: 'bool' },
    width: {}, height: {}, x: { type: 'num' }, y: { type: 'num' }, opacity: { type: 'num' }, tooltip: {}, align: {}, radius: {}, border: {} };
  function code(extra) { return Object.assign({}, CODE_COMMON, extra || {}); }

  var POINTER = { click: 'click', dblclick: 'dblclick', mouseenter: 'mouseenter', mouseleave: 'mouseleave' };

  /* ---------------- rendering helpers ---------------- */

  function attrs(el, ctx, cls, extra) {
    var p = el.props || {};
    var c = ['wz-c', 'wz-' + el.type];
    if (cls) c = c.concat(cls);
    if (p.visible === false) c.push('wz-hidden');
    if (p.hideOnPhone) c.push('wz-hide-phone');
    if (p.hideOnDesktop) c.push('wz-hide-desktop');
    if (p.animation && p.animation !== 'none') c.push('wz-anim-' + p.animation);
    var s = ' id="' + esc(el.name) + '" class="' + c.join(' ') + '" data-wz="' + esc(el.type === 'FreePanel' ? 'Panel' : el.type) + '"';
    if (ctx.design) s += ' data-eid="' + esc(el.id) + '"';
    if (p.tooltip) s += ' title="' + esc(p.tooltip) + '"';
    if (extra) s += ' ' + extra;
    return s;
  }
  function richText(s, ctx, inline) {
    var h = esc(s);
    h = h.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    h = h.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, function (m, label, target) {
      var raw = target.replace(/&amp;/g, '&');
      var href = ctx.pageHref ? ctx.pageHref(raw) : raw;
      var ext = /^https?:/i.test(href);
      return '<a href="' + esc(href) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + label + '</a>';
    });
    return inline ? h.replace(/\n/g, ' ') : h.replace(/\n/g, '<br>');
  }
  function hrefAttr(p, ctx) {
    if (!p.href) return '';
    var href = ctx.pageHref ? ctx.pageHref(p.href) : p.href;
    var ext = p.newTab === true || (/^https?:/i.test(href) && p.newTab !== false);
    return ' href="' + esc(href) + '"' + (ext ? ' target="_blank" rel="noopener"' : '');
  }
  function labelHtml(el, p) {
    return p.label ? '<label class="wz-label" for="' + esc(el.name) + '-i">' + esc(p.label) + '</label>' : '';
  }
  var PLACEHOLDER_IMG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300" viewBox="0 0 480 300"><rect width="480" height="300" fill="#e4e6ec"/><path d="M150 210l60-70 45 50 30-30 55 50z" fill="#b8bdc9"/><circle cx="300" cy="105" r="22" fill="#b8bdc9"/></svg>');
  W.PLACEHOLDER_IMG = PLACEHOLDER_IMG;

  function ytId(u) {
    var m = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/.exec(u || '');
    return m ? m[1] : null;
  }
  function shield(ctx) { return ctx.design ? '<div class="wz-shield"></div>' : ''; }

  /** Container markup: children inside a layout box. */
  function containerBox(el, ctx, inner, tag, extraCls) {
    var p = el.props || {};
    var layout = p.layout || 'stack';
    if (layout === 'free') {
      var fw = +p.formWidth || 960, fh = +p.formHeight || 480;
      return '<' + tag + attrs(el, ctx, ['wz-free'].concat(extraCls || []), 'data-dw="' + fw + '" data-dh="' + fh + '"') + '>' +
        '<div class="wz-free-in" style="width:' + fw + 'px;height:' + fh + 'px">' + inner + '</div></' + tag + '>';
    }
    return '<' + tag + attrs(el, ctx, layoutClasses(p).concat(extraCls || [])) + '>' + inner + '</' + tag + '>';
  }
  function layoutClasses(p, defAlign) {
    var layout = p.layout === 'row' ? 'row' : 'stack';
    var c = ['wz-' + layout];
    c.push('al-' + (p.align || defAlign || (layout === 'row' ? 'left' : 'stretch')));
    if (layout === 'row') c.push('va-' + (p.valign || 'center'));
    if (layout === 'row' && p.spread) c.push('spread');
    return c;
  }

  /* ---------------- the controls ---------------- */

  var LIST = [
    // ---- common ----
    { type: 'Heading', cat: 'common', icon: 'c-heading', prefix: { en: 'Heading' },
      defaults: { text: 'A heading', level: '2' },
      props: ['text', 'level'].concat(TEXT_LOOK, BOX_LOOK, BOX_LAYOUT, BEHAVE),
      inline: 'text',
      events: POINTER, defaultEvent: 'click',
      code: code({ text: {}, html: {} }), defaultProp: 'text',
      render: function (el, ctx) {
        var p = el.props, n = Math.min(4, Math.max(1, +p.level || 2));
        return '<h' + n + attrs(el, ctx, ['h' + n]) + '>' + richText(p.text || '', ctx) + '</h' + n + '>';
      } },
    { type: 'Text', cat: 'common', icon: 'c-text', prefix: { en: 'Text' },
      defaults: { text: 'Write your text here. Double-click to change it.' },
      props: ['text'].concat(TEXT_LOOK, BOX_LOOK, BOX_LAYOUT, BEHAVE),
      propTypes: { text: 'textarea' },
      inline: 'text', multiline: true,
      events: POINTER, defaultEvent: 'click',
      code: code({ text: {}, html: {} }), defaultProp: 'text',
      render: function (el, ctx) { return '<p' + attrs(el, ctx) + '>' + richText(el.props.text || '', ctx) + '</p>'; } },
    { type: 'Button', cat: 'common', icon: 'c-button', prefix: { en: 'Button' },
      defaults: { text: 'Button' },
      props: ['text', 'href', 'newTab'].concat(TEXT_LOOK, BOX_LOOK, BOX_LAYOUT, ['enabled'], BEHAVE),
      inline: 'text', codeOnDouble: true,
      events: POINTER, defaultEvent: 'click',
      code: code({ text: {}, enabled: { type: 'bool' }, link: {} }), defaultProp: 'text',
      render: function (el, ctx) {
        var p = el.props;
        if (p.href) return '<a' + attrs(el, ctx) + hrefAttr(p, ctx) + ' role="button">' + esc(p.text) + '</a>';
        return '<button type="button"' + attrs(el, ctx) + (p.enabled === false ? ' disabled' : '') + (ctx.design ? ' tabindex="-1"' : '') + '>' + esc(p.text) + '</button>';
      } },
    { type: 'Link', cat: 'common', icon: 'c-link', prefix: { en: 'Link' },
      defaults: { text: 'A link', href: 'https://wikipedia.org' },
      props: ['text', 'href', 'newTab'].concat(TEXT_LOOK, BOX_LOOK, BOX_LAYOUT, BEHAVE),
      inline: 'text',
      events: POINTER, defaultEvent: 'click',
      code: code({ text: {}, link: {} }), defaultProp: 'text',
      render: function (el, ctx) { return '<a' + attrs(el, ctx) + hrefAttr(el.props, ctx) + '>' + esc(el.props.text) + '</a>'; } },
    { type: 'Image', cat: 'common', icon: 'c-image', prefix: { en: 'Image' },
      defaults: { src: '', alt: '', width: '' },
      props: ['src', 'alt', 'fit', 'href', 'newTab'].concat(BOX_LOOK, BOX_LAYOUT, BEHAVE),
      events: POINTER, defaultEvent: 'click',
      code: code({ source: {} }), defaultProp: 'source',
      render: function (el, ctx) {
        var p = el.props;
        var src = p.src ? ctx.asset(p.src) : PLACEHOLDER_IMG;
        var img = '<img' + attrs(el, ctx, p.href ? [] : null) + ' src="' + esc(src) + '" alt="' + esc(p.alt || '') + '"' + (ctx.design ? ' draggable="false"' : ' loading="lazy"') + '>';
        if (p.href && !ctx.design) {
          // the link goes around the picture; the id stays on the picture
          return '<a class="wz-imglink"' + hrefAttr(p, ctx) + '>' + img + '</a>';
        }
        return img;
      } },
    { type: 'Divider', cat: 'common', icon: 'c-divider', prefix: { en: 'Divider' },
      defaults: {},
      props: ['color', 'thickness', 'width', 'place', 'margin', 'x', 'y'].concat(BEHAVE),
      events: {}, code: code(), defaultProp: 'visible',
      render: function (el, ctx) { return '<hr' + attrs(el, ctx) + '>'; } },
    { type: 'Spacer', cat: 'common', icon: 'c-spacer', prefix: { en: 'Space' },
      defaults: { height: 32 },
      props: ['height', 'width', 'x', 'y'].concat(BEHAVE),
      events: {}, code: code(), defaultProp: 'visible',
      render: function (el, ctx) { return '<div' + attrs(el, ctx) + ' aria-hidden="true"></div>'; } },

    // ---- forms ----
    { type: 'TextBox', cat: 'forms', icon: 'c-textbox', prefix: { en: 'TextBox' },
      defaults: { label: '', placeholder: 'Type here', inputType: 'text' },
      props: ['label', 'placeholder', 'value', 'inputType', 'required'].concat(TEXT_LOOK, BOX_LOOK, BOX_LAYOUT, ['enabled'], BEHAVE),
      events: { change: 'input', enter: 'enter', focus: 'focusin', blur: 'focusout', click: 'click' }, defaultEvent: 'change',
      code: code({ text: {}, value: {}, placeholder: {}, enabled: { type: 'bool' } }), defaultProp: 'text',
      render: function (el, ctx) {
        var p = el.props;
        return '<div' + attrs(el, ctx) + '>' + labelHtml(el, p) +
          '<input id="' + esc(el.name) + '-i" type="' + esc(p.inputType || 'text') + '" placeholder="' + esc(p.placeholder || '') + '" value="' + esc(p.value || '') + '"' +
          (p.required ? ' required' : '') + (p.enabled === false ? ' disabled' : '') + (ctx.design ? ' tabindex="-1" readonly' : '') + ' autocomplete="off"></div>';
      } },
    { type: 'TextArea', cat: 'forms', icon: 'c-textarea', prefix: { en: 'TextArea' },
      defaults: { label: '', placeholder: 'Write here', rows: 4 },
      props: ['label', 'placeholder', 'value', 'rows', 'required'].concat(TEXT_LOOK, BOX_LOOK, BOX_LAYOUT, ['enabled'], BEHAVE),
      propTypes: { value: 'textarea' },
      events: { change: 'input', enter: 'enter', focus: 'focusin', blur: 'focusout' }, defaultEvent: 'change',
      code: code({ text: {}, value: {}, placeholder: {}, enabled: { type: 'bool' } }), defaultProp: 'text',
      render: function (el, ctx) {
        var p = el.props;
        return '<div' + attrs(el, ctx) + '>' + labelHtml(el, p) +
          '<textarea id="' + esc(el.name) + '-i" rows="' + (+p.rows || 4) + '" placeholder="' + esc(p.placeholder || '') + '"' +
          (p.required ? ' required' : '') + (p.enabled === false ? ' disabled' : '') + (ctx.design ? ' tabindex="-1" readonly' : '') + '>' + esc(p.value || '') + '</textarea></div>';
      } },
    { type: 'CheckBox', cat: 'forms', icon: 'c-checkbox', prefix: { en: 'CheckBox' },
      defaults: { text: 'Yes, I agree', checked: false },
      props: ['text', 'checked'].concat(TEXT_LOOK, BOX_LAYOUT, ['enabled'], BEHAVE),
      inline: 'text',
      events: { change: 'change', click: 'click' }, defaultEvent: 'change',
      code: code({ text: {}, checked: { type: 'bool' }, value: { type: 'bool' }, enabled: { type: 'bool' } }), defaultProp: 'checked',
      render: function (el, ctx) {
        var p = el.props;
        return '<label' + attrs(el, ctx) + '><input type="checkbox"' + (p.checked ? ' checked' : '') + (p.enabled === false ? ' disabled' : '') +
          (ctx.design ? ' tabindex="-1"' : '') + '><span>' + esc(p.text) + '</span></label>';
      } },
    { type: 'RadioGroup', cat: 'forms', icon: 'c-radio', prefix: { en: 'Choice' },
      defaults: { label: 'Choose one', options: 'Option 1\nOption 2\nOption 3', value: '' },
      props: ['label', 'options', 'value', 'layout'].concat(TEXT_LOOK, BOX_LAYOUT, ['enabled'], BEHAVE),
      propOptions: { layout: ['stack', 'row'] },
      events: { change: 'change', click: 'click' }, defaultEvent: 'change',
      code: code({ selected: {}, value: {}, index: { type: 'num' }, options: { type: 'list' }, count: { type: 'num', readOnly: true }, text: {}, enabled: { type: 'bool' } }), defaultProp: 'selected',
      render: function (el, ctx) {
        var p = el.props;
        var opts = lines(p.options).map(function (o) {
          return '<label class="wz-opt"><input type="radio" name="' + esc(el.name) + '" value="' + esc(o) + '"' + (o === p.value ? ' checked' : '') +
            (p.enabled === false ? ' disabled' : '') + (ctx.design ? ' tabindex="-1"' : '') + '><span>' + esc(o) + '</span></label>';
        }).join('');
        return '<div' + attrs(el, ctx, p.layout === 'row' ? ['row'] : null, 'role="radiogroup"') + '>' +
          (p.label ? '<span class="wz-label">' + esc(p.label) + '</span>' : '') + '<div class="wz-opts">' + opts + '</div></div>';
      } },
    { type: 'DropDown', cat: 'forms', icon: 'c-dropdown', prefix: { en: 'DropDown' },
      defaults: { label: '', options: 'Option 1\nOption 2\nOption 3', value: '' },
      props: ['label', 'options', 'value'].concat(TEXT_LOOK, BOX_LOOK, BOX_LAYOUT, ['enabled'], BEHAVE),
      events: { change: 'change', focus: 'focusin', blur: 'focusout' }, defaultEvent: 'change',
      code: code({ selected: {}, value: {}, index: { type: 'num' }, options: { type: 'list' }, count: { type: 'num', readOnly: true }, text: {}, enabled: { type: 'bool' } }), defaultProp: 'selected',
      render: function (el, ctx) {
        var p = el.props;
        var opts = lines(p.options).map(function (o) { return '<option' + (o === p.value ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('');
        return '<div' + attrs(el, ctx) + '>' + labelHtml(el, p) + '<select id="' + esc(el.name) + '-i"' + (p.enabled === false ? ' disabled' : '') +
          (ctx.design ? ' tabindex="-1"' : '') + '>' + opts + '</select></div>';
      } },
    { type: 'Slider', cat: 'forms', icon: 'c-slider', prefix: { en: 'Slider' },
      defaults: { label: '', min: 0, max: 100, step: 1, value: 50, showValue: true },
      props: ['label', 'min', 'max', 'step', 'value', 'showValue'].concat(TEXT_LOOK, BOX_LAYOUT, ['enabled'], BEHAVE),
      propTypes: { value: 'number' },
      events: { change: 'input' }, defaultEvent: 'change',
      code: code({ value: { type: 'num' }, min: { type: 'num' }, max: { type: 'num' }, text: {}, enabled: { type: 'bool' } }), defaultProp: 'value',
      render: function (el, ctx) {
        var p = el.props;
        return '<div' + attrs(el, ctx) + '>' + labelHtml(el, p) + '<div class="wz-slide"><input id="' + esc(el.name) + '-i" type="range" min="' + (+p.min || 0) + '" max="' + (p.max === undefined ? 100 : +p.max) +
          '" step="' + (+p.step || 1) + '" value="' + (p.value === undefined ? 50 : +p.value) + '"' + (p.enabled === false ? ' disabled' : '') + (ctx.design ? ' tabindex="-1"' : '') + '>' +
          (p.showValue !== false ? '<output>' + esc(p.value === undefined ? 50 : p.value) + '</output>' : '') + '</div></div>';
      } },
    { type: 'DatePicker', cat: 'forms', icon: 'c-date', prefix: { en: 'Date' },
      defaults: { label: '', value: '' },
      props: ['label', 'value', 'required'].concat(TEXT_LOOK, BOX_LOOK, BOX_LAYOUT, ['enabled'], BEHAVE),
      events: { change: 'change' }, defaultEvent: 'change',
      code: code({ text: {}, value: {}, enabled: { type: 'bool' } }), defaultProp: 'text',
      render: function (el, ctx) {
        var p = el.props;
        return '<div' + attrs(el, ctx) + '>' + labelHtml(el, p) + '<input id="' + esc(el.name) + '-i" type="date" value="' + esc(p.value || '') + '"' +
          (p.required ? ' required' : '') + (p.enabled === false ? ' disabled' : '') + (ctx.design ? ' tabindex="-1" readonly' : '') + '></div>';
      } },

    // ---- data ----
    { type: 'List', cat: 'data', icon: 'c-list', prefix: { en: 'List' },
      defaults: { items: 'First item\nSecond item\nThird item', listStyle: 'bullets' },
      props: ['items', 'listStyle'].concat(TEXT_LOOK, BOX_LOOK, BOX_LAYOUT, BEHAVE),
      events: { click: 'click', dblclick: 'dblclick' }, defaultEvent: 'click',
      code: code({ items: { type: 'list' }, count: { type: 'num', readOnly: true }, selected: { readOnly: true }, index: { type: 'num', readOnly: true }, text: {} }), defaultProp: 'items',
      render: function (el, ctx) {
        var p = el.props, tag = p.listStyle === 'numbers' ? 'ol' : 'ul';
        return '<' + tag + attrs(el, ctx, p.listStyle === 'none' ? ['plain'] : null) + '>' + lines(p.items).map(function (i) { return '<li>' + richText(i, ctx, true) + '</li>'; }).join('') + '</' + tag + '>';
      } },
    { type: 'Table', cat: 'data', icon: 'c-table', prefix: { en: 'Table' },
      defaults: { columns: '', headers: 'Name, Score', tableRows: 'Ana, 10\nIon, 8', striped: true },
      props: ['columns', 'headers', 'tableRows', 'striped'].concat(TEXT_LOOK, BOX_LOOK, BOX_LAYOUT, BEHAVE),
      events: { click: 'click', dblclick: 'dblclick' }, defaultEvent: 'click',
      code: code({ data: { type: 'list' }, columns: { type: 'list' }, count: { type: 'num', readOnly: true }, selected: { readOnly: true }, index: { type: 'num', readOnly: true } }), defaultProp: 'data',
      render: function (el, ctx) {
        var p = el.props;
        var heads = String(p.headers || '').split(',').map(function (s) { return s.trim(); });
        var cols = String(p.columns || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        var n = Math.max(cols.length, heads.filter(Boolean).length);
        var th = '';
        for (var i = 0; i < n; i++) th += '<th data-col="' + esc(cols[i] || heads[i] || ('c' + (i + 1))) + '">' + esc(heads[i] || cols[i] || '') + '</th>';
        var body = lines(p.tableRows).map(function (r) {
          var cells = r.split(',').map(function (s) { return s.trim(); });
          var tds = '';
          for (var j = 0; j < n; j++) tds += '<td>' + esc(cells[j] || '') + '</td>';
          return '<tr>' + tds + '</tr>';
        }).join('');
        var a = (cols.length ? 'data-columns="' + esc(cols.join(',')) + '" ' : '') + 'data-headers="' + esc(heads.join(',')) + '"';
        return '<div' + attrs(el, ctx, p.striped !== false ? ['striped'] : null, a) + '><table><thead><tr>' + th + '</tr></thead><tbody>' + body + '</tbody></table></div>';
      } },
    { type: 'ProgressBar', cat: 'data', icon: 'c-progress', prefix: { en: 'Progress' },
      defaults: { value: 40, max: 100, showValue: true },
      props: ['value', 'max', 'showValue', 'barColor', 'background', 'height', 'radius', 'width', 'place', 'margin', 'x', 'y'].concat(BEHAVE),
      propTypes: { value: 'number' },
      events: { click: 'click' }, defaultEvent: 'click',
      code: code({ value: { type: 'num' }, max: { type: 'num' }, text: {} }), defaultProp: 'value',
      render: function (el, ctx) {
        var p = el.props, max = +p.max || 100, v = Math.max(0, Math.min(max, +p.value || 0));
        return '<div' + attrs(el, ctx, null, 'data-value="' + v + '" data-max="' + max + '" role="progressbar" aria-valuemin="0" aria-valuemax="' + max + '" aria-valuenow="' + v + '"') +
          '><div class="wz-bar" style="width:' + (v / max * 100) + '%"></div>' + (p.showValue !== false ? '<span class="wz-pct">' + Math.round(v / max * 100) + '%</span>' : '') + '</div>';
      } },

    // ---- layout ----
    { type: 'Section', cat: 'layout', icon: 'c-section', prefix: { en: 'Section' }, container: true,
      defaults: { layout: 'stack', align: 'stretch', gap: 16, padding: 48, contentWidth: 'boxed' },
      props: ['layout', 'gap', 'align', 'valign', 'spread', 'contentWidth', 'background', 'bgImage', 'color', 'font', 'textAlign', 'padding', 'minHeight', 'margin', 'border', 'borderColor', 'shadow', 'animation'].concat(BEHAVE),
      propOptions: { layout: ['stack', 'row'] },
      events: POINTER, defaultEvent: 'click',
      code: code({ html: {} }), defaultProp: 'visible',
      render: function (el, ctx, inner) {
        var p = el.props;
        var cw = p.contentWidth || 'boxed';
        return '<section' + attrs(el, ctx, ['cw-' + cw]) + '><div class="wz-inner ' + layoutClasses(p, 'stretch').join(' ') + '">' + inner + '</div></section>';
      } },
    { type: 'Panel', cat: 'layout', icon: 'c-panel', prefix: { en: 'Panel' }, container: true,
      defaults: { layout: 'stack', gap: 12, padding: 16 },
      props: CONTAINER.concat(['background', 'bgImage', 'color', 'font', 'textAlign'], BOX_LOOK, ['width', 'height', 'minHeight', 'maxWidth', 'place', 'padding', 'margin', 'x', 'y'], BEHAVE),
      events: POINTER, defaultEvent: 'click',
      code: code({ html: {} }), defaultProp: 'visible',
      render: function (el, ctx, inner) { return containerBox(el, ctx, inner, 'div'); } },
    { type: 'FreePanel', cat: 'layout', icon: 'c-free', prefix: { en: 'Form' }, container: true, asType: 'Panel',
      defaults: { layout: 'free', formWidth: 960, formHeight: 480, padding: 0, background: '' },
      toolboxOnly: true },
    { type: 'Card', cat: 'layout', icon: 'c-card', prefix: { en: 'Card' }, container: true,
      defaults: { layout: 'stack', gap: 10, padding: 20 },
      props: CONTAINER.concat(['background', 'bgImage', 'color', 'font', 'textAlign'], BOX_LOOK, ['width', 'height', 'minHeight', 'maxWidth', 'place', 'padding', 'margin', 'x', 'y'], BEHAVE),
      events: POINTER, defaultEvent: 'click',
      code: code({ html: {} }), defaultProp: 'visible',
      render: function (el, ctx, inner) { return containerBox(el, ctx, inner, 'div'); } },
    { type: 'Columns', cat: 'layout', icon: 'c-columns', prefix: { en: 'Columns' }, container: true, fixedChildren: 'Column',
      defaults: { count: '2', ratio: 'equal', gap: 24, stackOnPhone: true },
      props: ['count', 'ratio', 'gap', 'stackOnPhone', 'valign', 'background', 'padding', 'margin', 'width', 'maxWidth', 'place', 'x', 'y', 'radius', 'border', 'borderColor', 'shadow', 'animation'].concat(BEHAVE),
      propOptions: { valign: ['top', 'center', 'bottom', 'stretch'] },
      events: {}, code: code(), defaultProp: 'visible',
      render: function (el, ctx, inner) {
        var p = el.props;
        return '<div' + attrs(el, ctx, (p.stackOnPhone !== false ? ['stack-phone'] : []).concat(['va-' + (p.valign || 'top')])) + '>' + inner + '</div>';
      } },
    { type: 'Column', cat: null, icon: 'c-panel', prefix: { en: 'Column' }, container: true, internal: true,
      defaults: { layout: 'stack', gap: 12 },
      props: ['layout', 'gap', 'align', 'valign', 'spread', 'formWidth', 'formHeight', 'background', 'color', 'textAlign', 'padding', 'radius', 'border', 'borderColor', 'shadow'].concat(BEHAVE),
      events: POINTER, defaultEvent: 'click',
      code: code({ html: {} }), defaultProp: 'visible',
      render: function (el, ctx, inner) { return containerBox(el, ctx, inner, 'div'); } },
    { type: 'NavBar', cat: 'layout', icon: 'c-navbar', prefix: { en: 'Menu' },
      defaults: { brand: 'My website', links: '', sticky: true },
      props: ['brand', 'links', 'sticky', 'background', 'color', 'font', 'size', 'padding', 'border', 'borderColor', 'shadow'].concat(BEHAVE),
      events: { click: 'click' }, defaultEvent: 'click',
      code: code({ text: {} }), defaultProp: 'text',
      render: function (el, ctx) {
        var p = el.props;
        var custom = lines(p.links);
        var items = custom.length ? custom.map(function (l) {
          var m = /^(.*?)\s*(?:->|=>|\|)\s*(.+)$/.exec(l);
          return m ? { label: m[1], target: m[2] } : { label: l, target: l };
        }) : ctx.menuPages().map(function (pg) { return { label: pg.title || pg.name, target: pg.name }; });
        var links = items.map(function (it) {
          var href = ctx.pageHref(it.target);
          var active = ctx.page && (it.target === ctx.page.name || href === ctx.pageFile(ctx.page.name));
          return '<a href="' + esc(href) + '"' + (active ? ' class="active" aria-current="page"' : '') + (/^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(it.label) + '</a>';
        }).join('');
        var home = ctx.pageHref(ctx.homeName());
        var tid = esc(el.name) + '-t';
        return '<nav' + attrs(el, ctx, p.sticky !== false ? ['sticky'] : null) + '><a class="wz-brand" href="' + esc(home) + '">' + esc(p.brand || '') + '</a>' +
          '<input type="checkbox" id="' + tid + '" class="wz-nav-t" aria-hidden="true" tabindex="-1"><label for="' + tid + '" class="wz-burger" aria-label="Menu"><span></span><span></span><span></span></label>' +
          '<div class="wz-links">' + links + '</div></nav>';
      } },

    // ---- media ----
    { type: 'Video', cat: 'media', icon: 'c-video', prefix: { en: 'Video' },
      defaults: { url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', controls: true },
      props: ['url', 'autoplay', 'loop', 'controls'].concat(['radius', 'shadow', 'width', 'height', 'place', 'margin', 'x', 'y'], BEHAVE),
      events: { ended: 'ended' }, defaultEvent: 'ended',
      code: code({ source: {}, playing: { type: 'bool' } }), defaultProp: 'source',
      render: function (el, ctx) {
        var p = el.props, u = p.url ? ctx.asset(p.url) : '', id = ytId(u);
        var inner;
        if (id) inner = '<iframe src="https://www.youtube-nocookie.com/embed/' + esc(id) + (p.autoplay ? '?autoplay=1&mute=1' : '') + '" title="Video" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>';
        else if (u) inner = '<video src="' + esc(u) + '"' + (p.controls !== false ? ' controls' : '') + (p.autoplay ? ' autoplay muted' : '') + (p.loop ? ' loop' : '') + ' playsinline></video>';
        else inner = '<div class="wz-empty-media">Video</div>';
        return '<div' + attrs(el, ctx) + '>' + inner + shield(ctx) + '</div>';
      } },
    { type: 'Audio', cat: 'media', icon: 'c-audio', prefix: { en: 'Audio' },
      defaults: { url: '', controls: true },
      props: ['url', 'autoplay', 'loop', 'controls', 'width', 'place', 'margin', 'x', 'y'].concat(BEHAVE),
      events: { ended: 'ended' }, defaultEvent: 'ended',
      code: code({ source: {}, playing: { type: 'bool' } }), defaultProp: 'source',
      render: function (el, ctx) {
        var p = el.props, u = p.url ? ctx.asset(p.url) : '';
        return '<div' + attrs(el, ctx) + '><audio' + (u ? ' src="' + esc(u) + '"' : '') + (p.controls !== false ? ' controls' : '') + (p.autoplay ? ' autoplay' : '') + (p.loop ? ' loop' : '') + '></audio>' + shield(ctx) + '</div>';
      } },
    { type: 'Map', cat: 'media', icon: 'c-map', prefix: { en: 'Map' },
      defaults: { address: 'Piața Unirii, Cluj-Napoca', zoom: 14, height: 320 },
      props: ['address', 'zoom', 'radius', 'shadow', 'width', 'height', 'place', 'margin', 'x', 'y'].concat(BEHAVE),
      events: {}, code: code({ source: {} }), defaultProp: 'visible',
      render: function (el, ctx) {
        var p = el.props;
        var src = 'https://maps.google.com/maps?q=' + encodeURIComponent(p.address || '') + '&z=' + (+p.zoom || 14) + '&output=embed';
        return '<div' + attrs(el, ctx) + '><iframe src="' + esc(src) + '" title="Map" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>' + shield(ctx) + '</div>';
      } },
    { type: 'Embed', cat: 'media', icon: 'c-embed', prefix: { en: 'Html' },
      defaults: { html: '<p style="padding:12px;border:1px dashed #999">Your own HTML</p>' },
      props: ['html', 'width', 'height', 'place', 'margin', 'x', 'y'].concat(BEHAVE),
      events: { click: 'click' }, defaultEvent: 'click',
      code: code({ html: {} }), defaultProp: 'html',
      render: function (el, ctx) { return '<div' + attrs(el, ctx) + '>' + (el.props.html || '') + shield(ctx) + '</div>'; } }
  ];

  var BY = {};
  LIST.forEach(function (c) { BY[c.type] = c; });

  /* ---------------- CSS of one element (from its properties) ---------------- */

  function px(v) {
    if (v === '' || v === null || v === undefined) return null;
    if (typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v).trim())) return (+v) + 'px';
    return String(v).trim();
  }
  function spacing(v) {
    if (v === '' || v === null || v === undefined) return null;
    return String(v).trim().split(/\s+/).map(function (x) { return /^-?\d+(\.\d+)?$/.test(x) ? x + 'px' : x; }).join(' ');
  }
  var RATIOS = { 'equal': null, '1:2': '1fr 2fr', '2:1': '2fr 1fr', '1:3': '1fr 3fr', '3:1': '3fr 1fr', '1:2:1': '1fr 2fr 1fr' };

  /**
   * CSS rules for an element. ctx: { asset(), parentLayout: 'stack'|'row'|'free' }
   * Returns [{ sel, decl: {prop: value} }]
   */
  function elementCss(el, ctx) {
    var p = el.props || {};
    var def = BY[el.type] || {};
    var d = {}, rules = [];
    var sel = '#' + cssId(el.name);
    function set(k, v) { if (v !== null && v !== undefined && v !== '') d[k] = v; }
    var has = function (k) { return p[k] !== undefined && p[k] !== null && p[k] !== ''; };
    var isContainer = !!def.container;
    var layout = p.layout || 'stack';

    if (has('color')) set('color', p.color);
    if (has('background') && el.type !== 'ProgressBar') set('background', p.background);
    if (has('bgImage')) {
      set('background-image', 'url("' + ctx.asset(p.bgImage) + '")');
      set('background-size', 'cover');
      set('background-position', 'center');
    }
    if (has('font') && FONTS[p.font]) set('font-family', FONTS[p.font]);
    if (has('size')) set('font-size', (+p.size) + 'px');
    if (p.bold === true) set('font-weight', '700');
    if (p.bold === false) set('font-weight', '400');
    if (p.italic) set('font-style', 'italic');
    if (p.underline) set('text-decoration', 'underline');
    if (has('textAlign')) set('text-align', p.textAlign);
    if (has('border') && +p.border > 0) set('border', (+p.border) + 'px solid ' + (p.borderColor || 'currentColor'));
    else if (has('borderColor') && el.type !== 'Divider') set('border-color', p.borderColor);
    if (has('radius')) set('border-radius', (+p.radius) + 'px');
    if (has('shadow')) set('box-shadow', SHADOWS[p.shadow] || 'none');
    if (has('opacity')) set('opacity', String(Math.max(0, Math.min(100, +p.opacity)) / 100));
    if (has('padding') && el.type !== 'Section') set('padding', spacing(p.padding));
    if (has('margin')) set('margin', spacing(p.margin));
    if (has('minHeight')) set('min-height', px(p.minHeight));
    if (has('maxWidth')) set('max-width', px(p.maxWidth));

    var parentFree = ctx.parentLayout === 'free';
    if (parentFree) {
      set('left', (+p.x || 0) + 'px');
      set('top', (+p.y || 0) + 'px');
      if (has('width')) set('width', px(p.width));
      if (has('height')) set('height', px(p.height));
    } else {
      if (has('width')) set('width', px(p.width));
      if (has('height') && el.type !== 'Spacer') set('height', px(p.height));
      if (has('place') && p.place !== 'auto') {
        var map = { left: 'flex-start', center: 'center', right: 'flex-end', stretch: 'stretch' };
        set('align-self', map[p.place]);
        if (p.place === 'center') { set('margin-left', 'auto'); set('margin-right', 'auto'); }
        if (p.place === 'right') set('margin-left', 'auto');
      }
    }

    // control-specific
    switch (el.type) {
      case 'Spacer':
        if (has('height')) d.height = px(p.height);
        if (!parentFree) d['flex-shrink'] = '0';
        break;
      case 'Divider':
        if (has('color')) { delete d.color; d['border-top-color'] = p.color; }
        if (has('thickness')) d['border-top-width'] = (+p.thickness) + 'px';
        break;
      case 'Image':
        if (has('fit')) d['object-fit'] = p.fit;
        break;
      case 'ProgressBar':
        if (has('background')) d.background = p.background;
        if (has('barColor')) rules.push({ sel: sel + ' > .wz-bar', decl: { background: p.barColor } });
        break;
      case 'Section':
        if (has('padding')) d.padding = spacing(p.padding) + (/\s/.test(String(p.padding).trim()) ? '' : ' 20px');
        break;
      case 'Columns': {
        var n = +p.count || 2;
        var r = RATIOS[p.ratio];
        if (r && r.split(' ').length !== n) r = null;
        d['grid-template-columns'] = r || ('repeat(' + n + ', minmax(0, 1fr))');
        if (has('gap')) d.gap = (+p.gap) + 'px';
        break;
      }
    }
    // containers: gap on the box that holds the children
    if (isContainer && el.type !== 'Columns' && layout !== 'free') {
      var target = el.type === 'Section' ? sel + ' > .wz-inner' : sel;
      var lay = {};
      if (has('gap')) lay.gap = (+p.gap) + 'px';
      if (el.type === 'Section' && has('contentWidth') && p.contentWidth !== 'boxed' && p.contentWidth !== 'narrow' && p.contentWidth !== 'full') lay['max-width'] = px(p.contentWidth);
      if (Object.keys(lay).length) {
        if (target === sel) Object.assign(d, lay);
        else rules.push({ sel: target, decl: lay });
      }
    }
    if (isContainer && layout === 'free') {
      var fw = +p.formWidth || 960;
      d['max-width'] = fw + 'px';
    }
    rules.unshift({ sel: sel, decl: d });
    return rules.filter(function (r) { return Object.keys(r.decl).length; });
  }
  function cssId(name) {
    return String(name).replace(/([^\w-])/g, '\\$1').replace(/^(\d)/, '\\3$1 ');
  }

  /* ---------------- public API ---------------- */

  W.controls = {
    list: LIST,
    byType: BY,
    props: PROPS,
    fonts: FONTS,
    shadows: SHADOWS,
    lines: lines,
    esc: esc,
    richText: richText,
    elementCss: elementCss,
    cssId: cssId,
    categories: ['common', 'forms', 'data', 'layout', 'media'],
    get: function (type) { return BY[type] || null; },
    /** Properties shown in the Properties window for an element. */
    /** The properties shown for a control. parent (optional): the container it is in. */
    propsOf: function (el, parent) {
      var def = BY[el.type];
      if (!def) return [];
      var list = def.props || [];
      var p = el.props || {};
      var inFree = !!(parent && parent.props && parent.props.layout === 'free' && parent.type !== 'Columns');
      return list.filter(function (k) {
        if (parent && (k === 'x' || k === 'y')) return inFree;
        if (parent && k === 'place') return !inFree;
        if (k === 'formWidth' || k === 'formHeight') return p.layout === 'free';
        if (k === 'gap' || k === 'align' || k === 'valign' || k === 'spread') {
          if (p.layout === 'free') return false;
          if ((k === 'valign' || k === 'spread') && def.type !== 'Columns' && p.layout !== 'row') return false;
        }
        return true;
      });
    },
    propType: function (el, key) {
      var def = BY[el.type] || {};
      return (def.propTypes && def.propTypes[key]) || (PROPS[key] && PROPS[key].type) || 'text';
    },
    propOptions: function (el, key) {
      var def = BY[el.type] || {};
      if (def.propOptions && def.propOptions[key]) return def.propOptions[key];
      return PROPS[key] && PROPS[key].options;
    },
    /** What the compiler needs: { Button: { props, events, defaultProp } } */
    codeTypes: function () {
      var out = {};
      LIST.forEach(function (c) {
        if (c.toolboxOnly) return;
        out[c.type] = { props: c.code || {}, events: c.events || {}, defaultProp: c.defaultProp || 'text' };
      });
      return out;
    },
    isContainer: function (el) { var d = BY[el.type]; return !!(d && d.container); },
    /** Render an element (and its children) to HTML. */
    render: function render(el, ctx) {
      var def = BY[el.type];
      if (!def || !def.render) return '';
      var inner = '';
      if (def.container) {
        var childLayout = el.type === 'Columns' ? 'stack' : (el.props.layout || 'stack');
        inner = (el.children || []).map(function (ch) {
          return render(ch, Object.assign({}, ctx, { parentLayout: childLayout }));
        }).join('');
      }
      return def.render(el, ctx, inner);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
