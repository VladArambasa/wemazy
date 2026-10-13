/*!
 * Wemazy IDE - making the website: HTML, CSS, JavaScript, PHP and SQL files,
 * for the live preview and for export (zip) or the PHP server.
 */
(function (root) {
  'use strict';
  var W = root.Wemazy = root.Wemazy || {};
  var U = W.util, C = W.controls, P = W.Project;

  /* ---------------- the base style of every Wemazy site ---------------- */

  var BASE_CSS = [
    '*, *::before, *::after { box-sizing: border-box; }',
    'html { -webkit-text-size-adjust: 100%; }',
    'body.wz-site { margin: 0; background: var(--wz-bg); color: var(--wz-text); font-family: var(--wz-font); font-size: 17px; line-height: 1.6; overflow-wrap: anywhere; }',
    '.wz-page { display: flex; flex-direction: column; min-height: 100vh; }',
    '.wz-page > .wz-c:not(.wz-Section):not(.wz-NavBar):not(.wz-hidden) { margin: 16px auto; max-width: min(calc(100% - 32px), var(--wz-width)); }',
    '.wz-page > .wz-Heading, .wz-page > .wz-Text, .wz-page > .wz-List, .wz-page > .wz-Table, .wz-page > .wz-Columns, .wz-page > .wz-Panel, .wz-page > .wz-Card, .wz-page > .wz-Divider, .wz-page > .wz-TextBox, .wz-page > .wz-TextArea, .wz-page > .wz-ProgressBar, .wz-page > .wz-Video, .wz-page > .wz-Map { width: 100%; }',
    // layouts
    '.wz-stack { display: flex; flex-direction: column; gap: 12px; min-width: 0; }',
    '.wz-row { display: flex; flex-direction: row; flex-wrap: wrap; gap: 12px; min-width: 0; }',
    '.wz-stack > *, .wz-row > * { max-width: 100%; min-width: 0; }',
    '.wz-stack.al-left { align-items: flex-start; text-align: left; }',
    '.wz-stack.al-center { align-items: center; text-align: center; }',
    '.wz-stack.al-right { align-items: flex-end; text-align: right; }',
    '.wz-stack.al-stretch { align-items: stretch; }',
    '.wz-stack.al-stretch > .wz-Button, .wz-stack.al-stretch > .wz-Image, .wz-stack.al-stretch > .wz-CheckBox, .wz-stack.al-stretch > .wz-Link { align-self: flex-start; }',
    '.wz-stack:not(.al-stretch) > .wz-Heading, .wz-stack:not(.al-stretch) > .wz-Text, .wz-stack:not(.al-stretch) > .wz-List, .wz-stack:not(.al-stretch) > .wz-Table, .wz-stack:not(.al-stretch) > .wz-Divider, .wz-stack:not(.al-stretch) > .wz-Columns, .wz-stack:not(.al-stretch) > .wz-ProgressBar, .wz-stack:not(.al-stretch) > .wz-Video, .wz-stack:not(.al-stretch) > .wz-Map, .wz-stack:not(.al-stretch) > .wz-Card, .wz-stack:not(.al-stretch) > .wz-Panel { align-self: stretch; }',
    '.wz-row.al-left { justify-content: flex-start; } .wz-row.al-center { justify-content: center; } .wz-row.al-right { justify-content: flex-end; } .wz-row.spread { justify-content: space-between; }',
    '.wz-row.va-top { align-items: flex-start; } .wz-row.va-center { align-items: center; } .wz-row.va-bottom { align-items: flex-end; } .wz-row.va-stretch { align-items: stretch; }',
    '.wz-free { position: relative; width: 100%; margin-left: auto; margin-right: auto; }',
    '.wz-free > .wz-free-in { position: relative; transform-origin: 0 0; }',
    '.wz-free-in > .wz-c { position: absolute; margin: 0; }',
    // text
    '.wz-Heading { font-family: var(--wz-heading-font); line-height: 1.15; margin: 0; letter-spacing: -0.01em; }',
    'h1.wz-Heading { font-size: clamp(2.1rem, 4.5vw + 1rem, 3.4rem); font-weight: 800; }',
    'h2.wz-Heading { font-size: clamp(1.6rem, 2.5vw + 1rem, 2.3rem); font-weight: 750; }',
    'h3.wz-Heading { font-size: 1.35rem; font-weight: 700; }',
    'h4.wz-Heading { font-size: 1.1rem; font-weight: 700; }',
    '.wz-Text { margin: 0; max-width: 72ch; }',
    '.al-center > .wz-Text { margin-left: auto; margin-right: auto; } .al-right > .wz-Text { margin-left: auto; }',
    '.wz-Text a, .wz-List a, .wz-Heading a { color: var(--wz-primary); }',
    '.wz-Link { color: var(--wz-primary); text-underline-offset: 3px; }',
    // button
    '.wz-Button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 22px; border-radius: var(--wz-radius); background: var(--wz-primary); color: var(--wz-on-primary); border: 1px solid transparent; font: inherit; font-weight: 650; line-height: 1.2; cursor: pointer; text-decoration: none; transition: filter .15s ease, transform .06s ease; }',
    '.wz-Button:hover { filter: brightness(1.08); } .wz-Button:active { transform: translateY(1px); }',
    '.wz-Button:focus-visible, .wz-Link:focus-visible, .wz-NavBar a:focus-visible { outline: 3px solid color-mix(in srgb, var(--wz-primary) 45%, transparent); outline-offset: 2px; }',
    '.wz-Button:disabled, .wz-disabled { opacity: .5; cursor: not-allowed; filter: none; }',
    // media
    '.wz-Image { display: block; max-width: 100%; height: auto; }',
    '.wz-imglink { display: contents; }',
    '.wz-Divider { border: 0; border-top: 1px solid var(--wz-border); width: 100%; margin: 4px 0; }',
    '.wz-Spacer { height: 32px; }',
    '.wz-Video { width: 100%; aspect-ratio: 16 / 9; position: relative; border-radius: var(--wz-radius); overflow: hidden; background: #000; }',
    '.wz-Video iframe, .wz-Video video { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }',
    '.wz-empty-media { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #bbb; }',
    '.wz-Audio audio { width: 100%; }',
    '.wz-Map { width: 100%; height: 320px; border-radius: var(--wz-radius); overflow: hidden; position: relative; background: var(--wz-surface); }',
    '.wz-Map iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }',
    '.wz-Embed { position: relative; }',
    // forms
    '.wz-label { display: block; font-size: .92em; font-weight: 600; margin: 0 0 5px; }',
    '.wz-TextBox, .wz-TextArea, .wz-DropDown, .wz-DatePicker, .wz-Slider { width: 100%; max-width: 100%; }',
    '.wz-TextBox input, .wz-TextArea textarea, .wz-DropDown select, .wz-DatePicker input { display: block; width: 100%; font: inherit; color: inherit; padding: 10px 12px; border: 1px solid var(--wz-border); border-radius: calc(var(--wz-radius) * .7); background: var(--wz-field); }',
    '.wz-TextArea textarea { resize: vertical; min-height: 3em; }',
    '.wz-TextBox input:focus, .wz-TextArea textarea:focus, .wz-DropDown select:focus, .wz-DatePicker input:focus { outline: none; border-color: var(--wz-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--wz-primary) 22%, transparent); }',
    '.wz-CheckBox { display: inline-flex; align-items: center; gap: 9px; cursor: pointer; }',
    '.wz-CheckBox input, .wz-RadioGroup input, .wz-Slider input { accent-color: var(--wz-primary); width: 18px; height: 18px; margin: 0; }',
    '.wz-RadioGroup .wz-opts { display: flex; flex-direction: column; gap: 6px; }',
    '.wz-RadioGroup.row .wz-opts { flex-direction: row; flex-wrap: wrap; gap: 6px 18px; }',
    '.wz-opt { display: inline-flex; align-items: center; gap: 9px; cursor: pointer; }',
    '.wz-slide { display: flex; align-items: center; gap: 12px; }',
    '.wz-Slider input[type=range] { flex: 1; width: auto; height: 22px; }',
    '.wz-Slider output { min-width: 3ch; text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }',
    // data
    '.wz-List { margin: 0; padding-left: 1.4em; } .wz-List.plain { list-style: none; padding-left: 0; } .wz-List li + li { margin-top: 4px; }',
    '.wz-Table { width: 100%; overflow-x: auto; }',
    '.wz-Table table { width: 100%; border-collapse: collapse; font-size: .95em; }',
    '.wz-Table th, .wz-Table td { padding: 9px 12px; border-bottom: 1px solid var(--wz-border); text-align: left; vertical-align: top; }',
    '.wz-Table th { font-weight: 650; background: var(--wz-surface); }',
    '.wz-Table.striped tbody tr:nth-child(even) { background: color-mix(in srgb, var(--wz-surface) 55%, transparent); }',
    '.wz-ProgressBar { position: relative; width: 100%; height: 24px; background: var(--wz-surface); border: 1px solid var(--wz-border); border-radius: 999px; overflow: hidden; }',
    '.wz-ProgressBar .wz-bar { height: 100%; background: var(--wz-primary); transition: width .3s ease; }',
    '.wz-ProgressBar .wz-pct { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: .78em; font-weight: 700; }',
    // containers
    '.wz-Section { padding: 48px 20px; }',
    '.wz-Section > .wz-inner { max-width: var(--wz-width); margin: 0 auto; }',
    '.wz-Section.cw-narrow > .wz-inner { max-width: 720px; }',
    '.wz-Section.cw-full > .wz-inner { max-width: none; }',
    '.wz-Panel { padding: 16px; }',
    '.wz-Card { padding: 20px; background: var(--wz-surface); border: 1px solid var(--wz-border); border-radius: var(--wz-radius); }',
    '.wz-Columns { display: grid; gap: 24px; width: 100%; }',
    '.wz-Columns.va-center { align-items: center; } .wz-Columns.va-bottom { align-items: end; } .wz-Columns.va-top { align-items: start; } .wz-Columns.va-stretch { align-items: stretch; }',
    '.wz-Column { min-width: 0; }',
    '@media (max-width: 720px) { .wz-Columns.stack-phone { grid-template-columns: minmax(0, 1fr) !important; } .wz-Section { padding-top: 32px; padding-bottom: 32px; } }',
    // menu
    '.wz-NavBar { display: flex; align-items: center; gap: 16px; padding: 12px 20px; background: var(--wz-bg); border-bottom: 1px solid var(--wz-border); position: relative; z-index: 50; }',
    '.wz-NavBar.sticky { position: sticky; top: 0; }',
    '.wz-brand { font-family: var(--wz-heading-font); font-weight: 800; font-size: 1.15em; color: inherit; text-decoration: none; margin-right: auto; }',
    '.wz-links { display: flex; gap: 4px; flex-wrap: wrap; }',
    '.wz-links a { padding: 7px 12px; border-radius: calc(var(--wz-radius) * .7); color: inherit; text-decoration: none; }',
    '.wz-links a:hover { background: color-mix(in srgb, var(--wz-text) 8%, transparent); }',
    '.wz-links a.active { color: var(--wz-primary); font-weight: 650; }',
    '.wz-nav-t, .wz-burger { display: none; }',
    '@media (max-width: 720px) {',
    '  .wz-burger { display: flex; flex-direction: column; justify-content: center; gap: 4px; width: 40px; height: 40px; padding: 0 9px; cursor: pointer; border-radius: 8px; }',
    '  .wz-burger span { display: block; height: 2px; background: currentColor; border-radius: 2px; }',
    '  .wz-links { display: none; position: absolute; top: 100%; left: 0; right: 0; flex-direction: column; background: inherit; padding: 8px 12px 12px; border-bottom: 1px solid var(--wz-border); box-shadow: 0 12px 24px rgba(0,0,0,.12); }',
    '  .wz-nav-t:checked ~ .wz-links { display: flex; }',
    '}',
    // states
    '.wz-hidden { display: none !important; }',
    '@media (max-width: 720px) { .wz-hide-phone { display: none !important; } }',
    '@media (min-width: 721px) { .wz-hide-desktop { display: none !important; } }',
    // animations
    '@keyframes wz-fade { from { opacity: 0; } to { opacity: 1; } }',
    '@keyframes wz-slide { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }',
    '@keyframes wz-zoom { from { opacity: 0; transform: scale(.85); } to { opacity: 1; transform: none; } }',
    '@keyframes wz-bounce { 0% { transform: translateY(-30px); opacity: 0; } 60% { transform: translateY(6px); opacity: 1; } 100% { transform: none; } }',
    '@keyframes wz-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }',
    '.wz-anim-fade { animation: wz-fade .8s ease both; }',
    '.wz-anim-slide { animation: wz-slide .7s ease both; }',
    '.wz-anim-zoom { animation: wz-zoom .6s ease both; }',
    '.wz-anim-bounce { animation: wz-bounce .8s ease both; }',
    '.wz-anim-pulse { animation: wz-pulse 1.6s ease-in-out infinite; }',
    '@media (prefers-reduced-motion: reduce) { [class*="wz-anim-"] { animation: none !important; } }'
  ].join('\n');

  /** CSS custom properties of the theme. */
  function themeVars(project) {
    var t = project.settings.theme || {};
    var f = C.fonts;
    var dark = isDark(t.background || '#ffffff');
    return ':root {\n' +
      '  --wz-primary: ' + (t.primary || '#4338ca') + ';\n' +
      '  --wz-on-primary: ' + (t.onPrimary || '#ffffff') + ';\n' +
      '  --wz-bg: ' + (t.background || '#ffffff') + ';\n' +
      '  --wz-text: ' + (t.text || '#1d2130') + ';\n' +
      '  --wz-muted: ' + (t.muted || '#5b6172') + ';\n' +
      '  --wz-surface: ' + (t.surface || '#f4f5f9') + ';\n' +
      '  --wz-border: ' + (t.border || '#dadde6') + ';\n' +
      '  --wz-field: ' + (dark ? 'rgba(255,255,255,.04)' : '#ffffff') + ';\n' +
      '  --wz-font: ' + (f[t.font] || f.sans) + ';\n' +
      '  --wz-heading-font: ' + (f[t.headingFont] || f[t.font] || f.sans) + ';\n' +
      '  --wz-radius: ' + (t.radius === undefined ? 10 : +t.radius) + 'px;\n' +
      '  --wz-width: ' + (+t.width || 1100) + 'px;\n' +
      '  color-scheme: ' + (dark ? 'dark' : 'light') + ';\n' +
      '}';
  }
  function isDark(hex) {
    var m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(hex || '');
    if (!m) return false;
    var r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) < 128;
  }

  function cssText(rules) {
    return rules.map(function (r) {
      return r.sel + ' {\n' + Object.keys(r.decl).map(function (k) { return '  ' + k + ': ' + r.decl[k] + ';'; }).join('\n') + '\n}';
    }).join('\n');
  }

  /** CSS of the controls of one page (their own colours, sizes, places). */
  function pageCss(project, page, ctx) {
    var rules = [];
    var rp = page.root.props || {};
    var body = {};
    if (rp.background) body.background = rp.background;
    if (rp.bgImage) { body['background-image'] = 'url("' + ctx.asset(rp.bgImage) + '")'; body['background-size'] = 'cover'; body['background-attachment'] = 'fixed'; }
    if (rp.color) body.color = rp.color;
    if (rp.font && C.fonts[rp.font]) body['font-family'] = C.fonts[rp.font];
    if (Object.keys(body).length) rules.push({ sel: 'body.wz-site', decl: body });
    P.walk(page.root, function (el, parent) {
      if (el === page.root) return;
      var layout = parent && parent !== page.root ? (parent.type === 'Columns' ? 'stack' : (parent.props.layout || 'stack')) : 'stack';
      rules = rules.concat(C.elementCss(el, { asset: ctx.asset, parentLayout: layout }));
    });
    return cssText(rules);
  }

  /** Everything rendering needs to know about the site. */
  function context(project, page, opts) {
    opts = opts || {};
    var assetUrl = opts.assetUrl || function (a) { return 'assets/' + a.name; };
    var ctx = {
      design: !!opts.design,
      project: project,
      page: page,
      asset: function (name) {
        var a = P.asset(project, name);
        return a ? assetUrl(a) : String(name || '');
      },
      pageFile: function (name) {
        var pg = P.pageByName(project, name);
        return pg ? P.pageFile(project, pg) : null;
      },
      pageHref: function (target) {
        var t = String(target || '').trim();
        var pg = P.pageByName(project, t);
        if (pg) return P.pageFile(project, pg);
        var a = P.asset(project, t);
        if (a) return assetUrl(a);
        return t;
      },
      menuPages: function () { return project.pages.filter(function (p) { return p.inMenu !== false; }); },
      homeName: function () { return project.pages[0] ? project.pages[0].name : ''; },
      parentLayout: 'stack'
    };
    return ctx;
  }

  function rootClasses(page) {
    var rp = page.root.props || {};
    var cls = ['wz-page', 'wz-stack', 'al-' + (rp.align || 'stretch')];
    return cls.join(' ');
  }
  function bodyHtml(project, page, ctx) {
    var rp = page.root.props || {};
    var gap = rp.gap !== undefined && rp.gap !== '' ? ' style="gap:' + (+rp.gap) + 'px' + (rp.padding ? ';padding:' + rp.padding + 'px' : '') + '"' : (rp.padding ? ' style="gap:0;padding:' + rp.padding + 'px"' : ' style="gap:0"');
    return '<main id="page" class="' + rootClasses(page) + '"' + (ctx.design ? ' data-eid="root"' : '') + gap + '>\n' +
      page.root.children.map(function (el) { return C.render(el, ctx); }).join('\n') +
      '\n</main>';
  }

  /** The HTML of the controls the code makes with new Button() (the runtime copies it, with a new name). */
  function newTemplates(page, result, ctx) {
    var out = {}, info = result.pages[page.name];
    ((info && info.newControls) || []).forEach(function (type) {
      var def = C.get(type);
      if (!def || !def.render) return;
      var el = { name: '__WZNEW__', type: type, id: '__WZNEW__', props: Object.assign({}, def.defaults || {}), children: [] };
      out[type] = C.render(el, Object.assign({}, ctx, { design: false, parentLayout: 'stack' }));
    });
    return out;
  }

  /** Map of page name -> file, for the runtime (go to page ...). */
  function pagesMap(project) {
    var m = {};
    project.pages.forEach(function (pg) { m[pg.name] = P.pageFile(project, pg); });
    return m;
  }
  function assetsMap(project, assetUrl) {
    var m = {};
    project.assets.forEach(function (a) { m[a.name] = assetUrl(a); });
    return m;
  }

  /* ---------------- compiling (with a small cache) ---------------- */

  var cache = { key: null, result: null };
  function compile(project, debug) {
    var input = P.compileInput(project);
    var opts = P.compileOptions(project, debug);
    var key = JSON.stringify([input, opts.langs, opts.packs, !!debug, opts.msgLang, W.lang._rev]);
    if (cache.key === key) return cache.result;
    var r = W.lang.compileProject(input, opts);
    cache.key = key;
    cache.result = r;
    return r;
  }

  function runtimeJs(withServer) {
    var R = W.runtime;
    var s = '/*! Wemazy runtime ' + W.lang.version + ' - made with Wemazy. MIT licence. */\n' +
      '(function () {\n"use strict";\nvar wz = (' + R.core.toString() + ')();\n(' + R.client.toString() + ')(window, wz);\nwindow.wz = wz;\n';
    if (withServer) s += 'window.wzServerRuntime = ' + R.server.toString() + ';\nwindow.wzCore = ' + R.core.toString() + ';\n';
    return s + '})();\n';
  }

  function siteConfig(project, page, mode, assetUrl, extra) {
    return Object.assign({
      mode: mode,
      page: page.name,
      pages: pagesMap(project),
      assets: assetsMap(project, assetUrl),
      api: 'api.php',
      site: project.id,
      lang: project.settings.htmlLang === 'ro' ? 'ro' : 'en'
    }, extra || {});
  }

  function headHtml(project, page, links) {
    var s = project.settings;
    var title = page.title || page.name;
    var full = s.siteTitle && s.siteTitle !== title ? title + ' - ' + s.siteTitle : title;
    var out = '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>' + U.esc(full) + '</title>\n<meta name="generator" content="Wemazy">\n';
    if (page.description) out += '<meta name="description" content="' + U.esc(page.description) + '">\n';
    return out + (links || '');
  }

  /* ---------------- preview (inside Wemazy) ---------------- */

  /**
   * One HTML document with everything inside (for the preview frame).
   * opts: { debug }
   */
  function previewDoc(project, page, result, opts) {
    opts = opts || {};
    var assetUrl = function (a) { return a.data; };
    var ctx = context(project, page, { assetUrl: assetUrl });
    var css = themeVars(project) + '\n' + BASE_CSS + '\n' + pageCss(project, page, ctx);
    var js = result.pages[page.name] ? result.pages[page.name].js : '';
    var cfg = siteConfig(project, page, 'preview', assetUrl, { loopLimit: 8000, templates: newTemplates(page, result, ctx) });
    var fav = project.settings.favicon && P.asset(project, project.settings.favicon);
    var html = '<!doctype html>\n<html lang="' + U.esc(project.settings.htmlLang || 'en') + '">\n<head>\n' + headHtml(project, page) +
      (fav ? '<link rel="icon" href="' + U.esc(fav.data) + '">\n' : '') +
      '<style>\n' + css + '\n</style>\n</head>\n<body class="wz-site">\n' + bodyHtml(project, page, ctx) + '\n' +
      '<script>\n' + runtimeJs(false).replace(/<\/script/gi, '<\\/script') + '\n</' + 'script>\n' +
      '<script>\nwz.boot(' + JSON.stringify(cfg).replace(/</g, '\\u003c') + ');\n' + (result.runtimeJs || '') + '\n</' + 'script>\n' +
      '<script>\n' + js.replace(/<\/script/gi, '<\\/script') + '\n</' + 'script>\n</body>\n</html>';
    return html;
  }

  /* ---------------- export: all the files of the site ---------------- */

  /**
   * mode: 'static' (no server), 'local' (data kept in each visitor's browser), 'php' (PHP + database)
   * Returns { files: [{ name, data }], result, warnings }
   */
  function siteFiles(project, mode, opts) {
    opts = opts || {};
    var result = compile(project, !!opts.debug);
    var files = [];
    var assetUrl = function (a) { return 'assets/' + a.name; };
    var needsServer = result.uses.server;
    if (mode === 'static' && needsServer) mode = 'local';
    var withServer = mode === 'local';
    var siteLang = project.settings.htmlLang === 'ro' ? 'ro' : 'en';

    files.push({ name: 'css/site.css', data: '/* Made with Wemazy */\n' + themeVars(project) + '\n' + BASE_CSS + '\n' });
    files.push({ name: 'js/wemazy.js', data: runtimeJs(withServer) + (result.runtimeJs ? '\n' + result.runtimeJs + '\n' : '') });
    if (withServer) {
      var schema = project.tables.map(function (t) { return { name: t.name, columns: t.columns, rows: t.rows }; });
      files.push({
        name: 'js/server.js',
        data: '/* The "server" of this site runs in the browser: data is kept in each visitor\'s browser. Made with Wemazy. */\n' +
          '(function () {\n"use strict";\nvar key = ' + JSON.stringify('wz:' + project.id + ':db') + ';\nvar data = null;\n' +
          'try { data = JSON.parse(localStorage.getItem(key)); } catch (e) { data = null; }\n' +
          'var srv = window.wzServerRuntime(window.wzCore(), { data: data, lang: ' + JSON.stringify(siteLang) + ', save: function (d) { try { localStorage.setItem(key, JSON.stringify(d)); } catch (e) { /* full */ } } });\n' +
          'srv.sync(' + JSON.stringify(schema) + ');\n' +
          'srv.use(' + result.server.js + ');\n' +
          'wz.localServer = srv;\n})();\n'
      });
    }
    project.pages.forEach(function (pg) {
      var file = P.pageFile(project, pg);
      var base = file.replace(/\.html$/, '');
      var ctx = context(project, pg, { assetUrl: assetUrl });
      var css = pageCss(project, pg, ctx);
      var cfg = siteConfig(project, pg, mode === 'php' ? 'php' : (withServer ? 'local' : 'static'), assetUrl, { templates: newTemplates(pg, result, ctx) });
      var js = '// ' + pg.name + ' - made with Wemazy\nwz.boot(' + JSON.stringify(cfg) + ');\n' + (result.pages[pg.name] ? result.pages[pg.name].js : '');
      files.push({ name: 'js/' + base + '.js', data: js });
      if (css.trim()) files.push({ name: 'css/' + base + '.css', data: css + '\n' });
      var fav = project.settings.favicon && P.asset(project, project.settings.favicon);
      var links = (fav ? '<link rel="icon" href="assets/' + U.esc(fav.name) + '">\n' : '') +
        '<link rel="stylesheet" href="css/site.css">\n' + (css.trim() ? '<link rel="stylesheet" href="css/' + base + '.css">\n' : '');
      var html = '<!doctype html>\n<html lang="' + U.esc(project.settings.htmlLang || 'en') + '">\n<head>\n' + headHtml(project, pg, links) + '</head>\n' +
        '<body class="wz-site">\n' + bodyHtml(project, pg, ctx) + '\n' +
        '<script src="js/wemazy.js"></script>\n' + (withServer ? '<script src="js/server.js"></script>\n' : '') +
        '<script src="js/' + base + '.js"></script>\n</body>\n</html>\n';
      files.push({ name: file, data: html });
    });
    project.assets.forEach(function (a) { files.push({ name: 'assets/' + a.name, data: U.dataUrlToBytes(a.data) }); });

    if (mode === 'php') {
      files.push({ name: 'api.php', data: "<?php\n// The pages of this site call this file to run server functions and use the database.\n// Made with Wemazy.\nrequire __DIR__ . '/wemazy/runtime.php';\nrequire __DIR__ . '/wemazy/server.php';\nwz_api();\n" });
      files.push({ name: 'wemazy/runtime.php', data: W.runtime.php });
      files.push({ name: 'wemazy/server.php', data: result.server.php + '\n' + (result.runtimePhp ? '// Language packs\n' + result.runtimePhp + '\n\n' : '') + W.lang.phpSchema(project.tables) + '\n' });
      files.push({ name: 'wemazy/.htaccess', data: 'Require all denied\n' });
      files.push({ name: 'config.php', data: configPhp(project, opts) });
      files.push({ name: 'data/.htaccess', data: 'Require all denied\n' });
      files.push({ name: 'data/index.html', data: '' });
      files.push({ name: 'router.php', data: "<?php\n// For PHP's own web server: php -S localhost:8000 router.php\n// It keeps data/ (the database) and wemazy/ private, like the .htaccess files do on Apache.\n$path = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));\nif (preg_match('#(^|/)(data|wemazy)(/|$)|(^|/)\\.|^/(config|router)\\.php$#i', $path)) {\n    http_response_code(403);\n    echo 'Private';\n    return true;\n}\nreturn false;\n" });
      if (project.tables.length) {
        files.push({ name: 'database-sqlite.sql', data: W.lang.schemaSql(project.tables, 'sqlite') + '\n' });
        files.push({ name: 'database-mysql.sql', data: W.lang.schemaSql(project.tables, 'mysql') + '\n' });
      }
    }
    files.push({ name: 'README.txt', data: readme(project, mode, needsServer) });
    return { files: files, result: result, mode: mode };
  }

  function configPhp(project, opts) {
    opts = opts || {};
    var rnd = opts.dbName || ('site-' + Math.random().toString(36).slice(2, 10));
    var lang = project.settings.htmlLang === 'ro' ? 'ro' : 'en';
    return "<?php\n" +
      "// Settings of this site (made with Wemazy).\n" +
      "// Setările site-ului (făcut cu Wemazy).\n" +
      "return [\n" +
      "    // The database: 'sqlite' (one file, nothing to install) or 'mysql' (MySQL / MariaDB).\n" +
      "    // Baza de date: 'sqlite' (un fișier, nimic de instalat) sau 'mysql' (MySQL / MariaDB).\n" +
      "    'db' => 'sqlite',\n" +
      "    'sqlite_file' => __DIR__ . '/data/" + rnd + ".sqlite',\n" +
      "\n" +
      "    // Only for 'mysql' / Doar pentru 'mysql':\n" +
      "    'mysql_host' => 'localhost',\n" +
      "    'mysql_port' => 3306,\n" +
      "    'mysql_database' => '',\n" +
      "    'mysql_user' => '',\n" +
      "    'mysql_password' => '',\n" +
      "\n" +
      "    // true shows the real error messages of PHP. Leave false on a public site.\n" +
      "    'debug' => " + (opts.debug ? 'true' : 'false') + ",\n" +
      "    'lang' => '" + lang + "',\n" +
      "    'timezone' => 'Europe/Bucharest',\n" +
      "];\n";
  }

  function readme(project, mode, needsServer) {
    var ro = W.i18n.lang === 'ro';
    var name = project.name;
    var L = [];
    if (ro) {
      L.push(name + ' - site făcut cu Wemazy', '');
      if (mode === 'php') {
        L.push('Acest site are nevoie de PHP 8.1 sau mai nou (și PDO SQLite sau MySQL pentru baza de date).', '',
          'Cum îl pui online:',
          '1. Încarcă tot conținutul acestui folder pe găzduirea ta (de exemplu în public_html), cu un program FTP sau din File Manager.',
          '2. Deschide adresa site-ului. Baza de date SQLite se face singură, în folderul data/.',
          '3. Pentru MySQL: creează o bază de date la firma de găzduire și completează config.php ("db" => "mysql" și datele de conectare). Tabelele se fac singure.',
          '', 'Pe calculatorul tău: în acest folder rulează  php -S localhost:8000 router.php  și deschide http://localhost:8000',
          '', 'Fișierele database-sqlite.sql și database-mysql.sql conțin tabelele, dacă vrei să le vezi sau să le importi (phpMyAdmin).',
          'Folderul data/ trebuie să poată fi scris de PHP și nu trebuie să poată fi descărcat (fișierul .htaccess îl protejează pe Apache; pe Nginx adaugă: location ~ ^/(data|wemazy)/ { deny all; }).');
      } else if (mode === 'local') {
        L.push('Site fără server: merge pe orice găzduire de fișiere (GitHub Pages, Netlify, un stick USB...).',
          'Datele (baza de date) sunt păstrate în browserul fiecărui vizitator: fiecare își vede doar datele lui.', '',
          'Deschide index.html sau încarcă tot folderul pe o găzduire.');
      } else {
        L.push('Site fără server: merge pe orice găzduire de fișiere (GitHub Pages, Netlify, un stick USB...).', '', 'Deschide index.html sau încarcă tot folderul pe o găzduire.');
      }
      L.push('', 'Fișiere: *.html = paginile, css/ = aspectul, js/ = codul tău tradus în JavaScript' + (mode === 'php' ? ', api.php + wemazy/ = codul de server tradus în PHP' : '') + ', assets/ = imaginile.');
    } else {
      L.push(name + ' - a website made with Wemazy', '');
      if (mode === 'php') {
        L.push('This site needs PHP 8.1 or newer (and PDO SQLite or MySQL for the database).', '',
          'To put it online:',
          '1. Upload everything in this folder to your web space (for example into public_html), with FTP or the File Manager of your host.',
          '2. Open the address of the site. The SQLite database makes itself, in the data/ folder.',
          '3. For MySQL: make a database at your host and fill in config.php ("db" => "mysql" and the login details). The tables make themselves.',
          '', 'On your own computer: in this folder run  php -S localhost:8000 router.php  and open http://localhost:8000',
          '', 'database-sqlite.sql and database-mysql.sql hold the tables, if you want to read them or import them (phpMyAdmin).',
          'The data/ folder must be writable by PHP and must not be downloadable (its .htaccess protects it on Apache; on Nginx add: location ~ ^/(data|wemazy)/ { deny all; }).');
      } else if (mode === 'local') {
        L.push('A site without a server: it works on any file host (GitHub Pages, Netlify, a USB stick...).',
          "Its data (the database) is kept in each visitor's browser: everyone sees only their own data.", '',
          'Open index.html, or upload the whole folder to a host.');
      } else {
        L.push('A site without a server: it works on any file host (GitHub Pages, Netlify, a USB stick...).', '', 'Open index.html, or upload the whole folder to a host.');
      }
      L.push('', 'Files: *.html = the pages, css/ = the look, js/ = your code translated to JavaScript' + (mode === 'php' ? ', api.php + wemazy/ = your server code translated to PHP' : '') + ', assets/ = the pictures.');
    }
    void needsServer;
    return L.join('\r\n') + '\r\n';
  }

  /** The zip to download: the site folder, plus the project file next to it. */
  function exportZip(project, mode) {
    var out = siteFiles(project, mode);
    var folder = U.slug(project.name) || 'website';
    var files = out.files.map(function (f) { return { name: folder + '/' + f.name, data: f.data }; });
    files.push({ name: folder + '.wemazy', data: P.toFile(project) });
    return W.zip.create(files).then(function (blob) { return { blob: blob, name: folder + (out.mode === 'php' ? '-php' : '') + '.zip', mode: out.mode, result: out.result }; });
  }

  W.build = {
    BASE_CSS: BASE_CSS,
    themeVars: themeVars,
    isDark: isDark,
    context: context,
    pageCss: pageCss,
    bodyHtml: bodyHtml,
    compile: compile,
    previewDoc: previewDoc,
    siteFiles: siteFiles,
    exportZip: exportZip,
    configPhp: configPhp,
    runtimeJs: runtimeJs,
    clearCache: function () { cache.key = null; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
