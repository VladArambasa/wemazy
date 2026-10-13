/*!
 * Wemazy runtime - the browser test server
 * ----------------------------------------
 * Runs your "server function"s and database commands inside the browser, with a
 * small database kept in the browser. Used when you press Run without PHP, and by
 * sites exported as "data in each visitor's browser".
 *
 * It follows the same rules as the PHP server (runtime/php.js), so a site that
 * works here works on PHP too. Copied as text into exported sites: it must not
 * use anything from outside itself.
 */
(function (root) {
  'use strict';
  var W = root.Wemazy = root.Wemazy || {};
  W.runtime = W.runtime || {};

  /**
   * core:  the object made by Wemazy.runtime.core()
   * opts:  { schema: [{ name, columns: [{ name, type }], rows: [...] }],
   *          data: previously saved data (or null), save(data), print(text), lang }
   */
  W.runtime.server = function wemazyServer(core, opts) {
    'use strict';
    opts = opts || {};
    var wz = {};
    Object.keys(core).forEach(function (k) { wz[k] = core[k]; });
    wz.lang = opts.lang || core.lang || 'en';
    var text = wz.text;

    var MSG = {
      en: {
        noTable: "There is no table called '{0}'.",
        noColumn: "The table {0} has no column '{1}'.",
        notRecord: 'To add a row to {0}, give a record like {name: "Ana"}.',
        noFunction: "There is no server function called '{0}'.",
        noQuery: 'This page is older than the server code. Run the site again.'
      },
      ro: {
        noTable: "Nu există niciun tabel numit '{0}'.",
        noColumn: "Tabelul {0} nu are coloana '{1}'.",
        notRecord: 'Ca să adaugi un rând în {0}, dă o înregistrare ca {nume: "Ana"}.',
        noFunction: "Nu există nicio funcție de server numită '{0}'.",
        noQuery: 'Pagina este mai veche decât codul serverului. Rulează site-ul din nou.'
      }
    };
    function fail(key, args) {
      var tbl = MSG[wz.lang] || MSG.en;
      var s = (tbl[key] || MSG.en[key]).replace(/\{(\d+)\}/g, function (m, i) { return args && args[i] !== undefined ? String(args[i]) : m; });
      var e = new Error(s);
      e.wz = true;
      throw e;
    }
    function copy(v) { return v === undefined ? null : JSON.parse(JSON.stringify(v)); }
    function hashOf(v) {
      var s = JSON.stringify(v || []), h = 2166136261;
      for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
      return h.toString(16);
    }

    /* ---------------- database ---------------- */

    var schema = [];
    var data = (opts.data && opts.data.tables) ? opts.data : { format: 'wemazy-data', version: 1, tables: {} };

    function tableDef(name) {
      var n = String(name).toLowerCase();
      for (var i = 0; i < schema.length; i++) if (schema[i].name.toLowerCase() === n) return schema[i];
      fail('noTable', [name]);
    }
    function colDef(t, name) {
      var n = String(name).toLowerCase();
      if (n === 'id') return { name: 'id', type: 'integer' };
      for (var i = 0; i < t.columns.length; i++) if (t.columns[i].name.toLowerCase() === n) return t.columns[i];
      return null;
    }
    /** The value as the column keeps it (lenient, like SQLite). */
    function coerce(col, v) {
      if (v === undefined || v === null) return null;
      switch (col.type) {
        case 'number': case 'integer':
          if (typeof v === 'number') return col.type === 'integer' ? Math.round(v) : v;
          if (typeof v === 'boolean') return v ? 1 : 0;
          if (typeof v === 'string') {
            if (v.trim() === '') return null;
            if (wz.is_number(v)) { var n = wz.num(v); return col.type === 'integer' ? Math.round(n) : n; }
            return v;
          }
          return text(v);
        case 'yesno':
          if (typeof v === 'string') { var s = v.trim().toLowerCase(); return !(s === '' || s === '0' || s === 'false' || s === 'no' || s === 'fals' || s === 'nu'); }
          return wz.truthy(v);
        default:
          if (typeof v === 'string') return v;
          if (typeof v === 'object') return JSON.stringify(v);
          return text(v);
      }
    }
    function seedRows(t) {
      var rows = [], id = 0;
      (t.rows || []).forEach(function (r) {
        var row = { id: ++id };
        t.columns.forEach(function (c) { row[c.name] = coerce(c, r[c.name]); });
        rows.push(row);
      });
      return { rows: rows, nextId: id + 1, seed: hashOf(t.rows), dirty: false };
    }
    /** Make the saved data match the tables of the project. */
    function sync(newSchema) {
      schema = (newSchema || []).filter(function (t) { return t && t.name; });
      var old = data.tables || {};
      var tables = {};
      schema.forEach(function (t) {
        var key = Object.keys(old).filter(function (k) { return k.toLowerCase() === t.name.toLowerCase(); })[0];
        var cur = key ? old[key] : null;
        if (!cur || (!cur.dirty && cur.seed !== hashOf(t.rows))) {
          tables[t.name] = seedRows(t);
          return;
        }
        // keep the rows, fit them to the columns
        cur.rows = cur.rows.map(function (r) {
          var row = { id: r.id };
          t.columns.forEach(function (c) {
            var k = Object.keys(r).filter(function (x) { return x.toLowerCase() === c.name.toLowerCase(); })[0];
            row[c.name] = k ? coerce(c, r[k]) : null;
          });
          return row;
        });
        tables[t.name] = cur;
      });
      data.tables = tables;
      save();
    }
    var saveTimer = null;
    function save() {
      if (!opts.save) return;
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(function () { saveTimer = null; opts.save(data); }, 50);
    }
    function store(name) {
      var t = tableDef(name);
      if (!data.tables[t.name]) data.tables[t.name] = seedRows(t);
      return { def: t, st: data.tables[t.name] };
    }
    function shuffle(a) {
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var x = a[i]; a[i] = a[j]; a[j] = x;
      }
      return a;
    }

    var db = {
      select: function (table, params, where, order, limit, mode) {
        var s = store(table);
        var rows = s.st.rows.filter(function (r) { return !where || where(r, params); });
        if (order === 'random') shuffle(rows);
        else if (order && order.length) {
          rows = rows.map(function (r, i) { return [r, i]; }).sort(function (a, b) {
            for (var k = 0; k < order.length; k++) {
              var c = wz.cmp(nullLow(a[0][order[k][0]]), nullLow(b[0][order[k][0]]));
              if (a[0][order[k][0]] == null && b[0][order[k][0]] != null) c = -1;
              else if (a[0][order[k][0]] != null && b[0][order[k][0]] == null) c = 1;
              if (c) return order[k][1] ? -c : c;
            }
            return a[1] - b[1];
          }).map(function (p) { return p[0]; });
        }
        if (mode === 'first') limit = 1;
        if (limit !== null && limit !== undefined) rows = rows.slice(0, Math.max(0, Math.floor(wz.num(limit))));
        rows = copy(rows);
        return mode === 'first' ? (rows[0] || null) : rows;
      },
      count: function (table, params, where) {
        var s = store(table);
        return s.st.rows.filter(function (r) { return !where || where(r, params); }).length;
      },
      insert: function (table, rec) {
        var s = store(table);
        if (!rec || typeof rec !== 'object' || Array.isArray(rec)) fail('notRecord', [s.def.name]);
        var row = { id: s.st.nextId++ };
        s.def.columns.forEach(function (c) { row[c.name] = null; });
        Object.keys(rec).forEach(function (k) {
          var c = colDef(s.def, k);
          if (!c) fail('noColumn', [s.def.name, k]);
          if (c.name === 'id') return;
          row[c.name] = coerce(c, rec[k]);
        });
        s.st.rows.push(row);
        s.st.dirty = true;
        save();
        return row.id;
      },
      update: function (table, params, where, setFn) {
        var s = store(table), n = 0;
        s.st.rows.forEach(function (r) {
          if (where && !where(r, params)) return;
          var sets = setFn(copy(r), params);
          Object.keys(sets).forEach(function (k) {
            var c = colDef(s.def, k);
            if (c && c.name !== 'id') r[c.name] = coerce(c, sets[k]);
          });
          n++;
        });
        if (n) { s.st.dirty = true; save(); }
        return n;
      },
      remove: function (table, params, where) {
        var s = store(table);
        var before = s.st.rows.length;
        s.st.rows = s.st.rows.filter(function (r) { return where && !where(r, params); });
        var n = before - s.st.rows.length;
        if (n) { s.st.dirty = true; save(); }
        return n;
      }
    };
    function nullLow(v) { return v === null || v === undefined ? '' : v; }
    wz.db = db;

    /* ---------------- session ---------------- */

    var session = {};
    function skey(k) {
      var lk = String(k).toLowerCase();
      var keys = Object.keys(session);
      for (var i = 0; i < keys.length; i++) if (keys[i].toLowerCase() === lk) return keys[i];
      return String(k);
    }
    wz.sget = function (k) { var key = skey(k); return session[key] === undefined ? null : copy(session[key]); };
    wz.sset = function (k, v) { session[skey(k)] = copy(v); };
    wz.sclear = function () { session = {}; };

    /* ---------------- server-only helpers ---------------- */

    wz.print = function (v) { if (opts.print) opts.print(wz.repr(v)); else if (typeof console !== 'undefined') console.log(wz.repr(v)); };
    wz.sql = function () { wz.fail_with('sqlPhp'); };
    function hex(buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
    }
    function digest(s) {
      var c = (typeof crypto !== 'undefined') ? crypto : null;
      if (c && c.subtle && c.subtle.digest && typeof TextEncoder !== 'undefined') {
        return c.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(hex);
      }
      var h = 2166136261;
      for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
      return Promise.resolve('fnv' + h.toString(16));
    }
    wz.hash = function (p) {
      var salt = Math.random().toString(36).slice(2, 10);
      return digest(salt + text(p)).then(function (h) { return 'sim$' + salt + '$' + h; });
    };
    wz.check_hash = function (p, h) {
      var m = /^sim\$([^$]+)\$(.+)$/.exec(text(h));
      if (!m) return Promise.resolve(false);
      return digest(m[1] + text(p)).then(function (x) { return x === m[2]; });
    };
    wz.fetch = function (url) {
      return fetch(text(url)).then(function (r) {
        var ct = r.headers.get('content-type') || '';
        return /json/.test(ct) ? r.json() : r.text().then(function (t) {
          try { return JSON.parse(t); } catch (e) { return t; }
        });
      });
    };

    /* ---------------- running the compiled server code ---------------- */

    var mod = { functions: {}, queries: {} };

    return {
      wz: wz,
      db: db,
      sync: sync,
      /** Load the server code made by the compiler (result.server.js). */
      load: function (code) {
        // eslint-disable-next-line no-new-func
        mod = (new Function('return ' + code))()(wz);
      },
      /** Same as load, with the compiled module itself (exported sites). */
      use: function (fn) { mod = fn(wz); },
      call: function (name, args) {
        var fns = mod.functions, key = null;
        Object.keys(fns).forEach(function (k) { if (k.toLowerCase() === String(name).toLowerCase()) key = k; });
        if (!key) fail('noFunction', [name]);
        wz.reset_clock();
        // the classes are made again for every call (static fields start again, like on PHP)
        return Promise.resolve(mod.init ? mod.init() : null).then(function () {
          return fns[key].apply(null, wz.revive(copy(args || [])));
        }).then(copy);
      },
      query: function (id, params) {
        var q = mod.queries[id];
        if (!q) fail('noQuery', []);
        return Promise.resolve(q(copy(params || []))).then(copy);
      },
      data: function () { return data; },
      reset: function (tableName) {
        if (tableName) {
          var t = tableDef(tableName);
          data.tables[t.name] = seedRows(t);
        } else {
          data.tables = {};
          schema.forEach(function (t) { data.tables[t.name] = seedRows(t); });
        }
        save();
      },
      resetSession: function () { session = {}; },
      session: function () { return session; }
    };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = W.runtime.server;
})(typeof window !== 'undefined' ? window : globalThis);
