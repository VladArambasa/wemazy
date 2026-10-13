/*!
 * Wemazy IDE - where projects are kept.
 *   browser mode: IndexedDB of this browser (localStorage if IndexedDB is missing)
 *   server mode:  server/api.php (when Wemazy is opened from a PHP server)
 * Settings (theme, language...) always stay in this browser.
 */
(function (root) {
  'use strict';
  var W = root.Wemazy = root.Wemazy || {};

  /* ---------------- tiny IndexedDB wrapper ---------------- */

  var idb = null;
  function openIdb() {
    return new Promise(function (res) {
      try {
        if (!root.indexedDB) { res(null); return; }
        var rq = root.indexedDB.open('wemazy', 1);
        rq.onupgradeneeded = function () {
          var db = rq.result;
          ['projects', 'sim', 'packs', 'kv'].forEach(function (s) {
            if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
          });
        };
        rq.onsuccess = function () { res(rq.result); };
        rq.onerror = function () { res(null); };
        rq.onblocked = function () { res(null); };
        setTimeout(function () { res(null); }, 4000);
      } catch (e) { res(null); }
    });
  }
  function tx(store, mode, fn) {
    return new Promise(function (res, rej) {
      try {
        var t = idb.transaction(store, mode);
        var s = t.objectStore(store);
        var rq = fn(s);
        t.oncomplete = function () { res(rq ? rq.result : undefined); };
        t.onerror = function () { rej(t.error); };
        t.onabort = function () { rej(t.error || new Error('aborted')); };
      } catch (e) { rej(e); }
    });
  }
  var LS = 'wemazy:';
  function lsGet(k) { try { var v = root.localStorage.getItem(LS + k); return v === null ? undefined : JSON.parse(v); } catch (e) { return undefined; } }
  function lsSet(k, v) { root.localStorage.setItem(LS + k, JSON.stringify(v)); }
  function lsDel(k) { try { root.localStorage.removeItem(LS + k); } catch (e) { /* ignore */ } }

  var local = {
    get: function (store, key) {
      if (idb) return tx(store, 'readonly', function (s) { return s.get(key); });
      return Promise.resolve(lsGet(store + ':' + key));
    },
    put: function (store, key, value) {
      if (idb) return tx(store, 'readwrite', function (s) { return s.put(value, key); });
      try { lsSet(store + ':' + key, value); return Promise.resolve(); } catch (e) { return Promise.reject(e); }
    },
    del: function (store, key) {
      if (idb) return tx(store, 'readwrite', function (s) { return s.delete(key); });
      lsDel(store + ':' + key);
      return Promise.resolve();
    },
    all: function (store) {
      if (idb) {
        return new Promise(function (res, rej) {
          var out = [];
          var t = idb.transaction(store, 'readonly');
          var rq = t.objectStore(store).openCursor();
          rq.onsuccess = function () {
            var c = rq.result;
            if (c) { out.push(c.value); c.continue(); }
          };
          t.oncomplete = function () { res(out); };
          t.onerror = function () { rej(t.error); };
        });
      }
      var out = [];
      try {
        for (var i = 0; i < root.localStorage.length; i++) {
          var k = root.localStorage.key(i);
          if (k.indexOf(LS + store + ':') === 0) out.push(JSON.parse(root.localStorage.getItem(k)));
        }
      } catch (e) { /* ignore */ }
      return Promise.resolve(out);
    }
  };

  /* ---------------- server ---------------- */

  var api = 'server/api.php';
  function call(action, data) {
    var body = Object.assign({ action: action }, data || {});
    return fetch(api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.text().then(function (t) {
        var d;
        try { d = JSON.parse(t); } catch (e) { throw new Error('Server answer is not JSON (' + r.status + ')'); }
        if (!d.ok) { var er = new Error(d.error || 'Server error'); er.code = d.code; throw er; }
        return d;
      });
    });
  }

  var S = W.store = {
    mode: 'browser',
    server: null,
    backend: 'indexeddb',
    init: function () {
      return openIdb().then(function (db) {
        idb = db;
        S.backend = db ? 'indexeddb' : 'localstorage';
        if (!/^https?:$/.test(root.location.protocol)) return null;
        return call('ping').then(function (d) { return d; }, function () { return null; });
      }).then(function (info) {
        if (info && info.app === 'wemazy') {
          S.server = info;
          // a server without a password only works on its own computer
          if (!info.locked) S.mode = 'server';
        }
        return S.mode;
      });
    },
    login: function (password) { return call('login', { password: password }).then(function (d) { S.server.authed = true; return d; }); },
    logout: function () { return call('logout'); },

    /* ---- projects ---- */
    listProjects: function () {
      if (S.mode === 'server') return call('list').then(function (d) { return d.projects; });
      return local.get('kv', 'index').then(function (idx) { return idx || []; });
    },
    loadProject: function (id) {
      if (S.mode === 'server') return call('load', { id: id }).then(function (d) { return d.project; });
      return local.get('projects', id);
    },
    saveProject: function (p) {
      p.modified = new Date().toISOString();
      if (S.mode === 'server') return call('save', { project: p });
      var json = JSON.stringify(p);
      return local.put('projects', p.id, JSON.parse(json)).then(function () {
        return local.get('kv', 'index');
      }).then(function (idx) {
        idx = (idx || []).filter(function (x) { return x.id !== p.id; });
        idx.unshift({ id: p.id, name: p.name, modified: p.modified, size: json.length, template: p.template || '' });
        return local.put('kv', 'index', idx);
      });
    },
    deleteProject: function (id) {
      if (S.mode === 'server') return call('delete', { id: id });
      return local.del('projects', id).then(function () {
        return local.get('kv', 'index');
      }).then(function (idx) {
        return local.put('kv', 'index', (idx || []).filter(function (x) { return x.id !== id; }));
      }).then(function () { return local.del('sim', id); });
    },

    /* ---- data of the browser test server ---- */
    getSim: function (id) { return local.get('sim', id).catch(function () { return null; }); },
    setSim: function (id, data) { return local.put('sim', id, data).catch(function () { /* full */ }); },

    /* ---- language packs made in the Language Lab ---- */
    listPacks: function () {
      var mine = local.all('packs').catch(function () { return []; });
      if (S.mode !== 'server') return mine;
      return Promise.all([mine, call('packs').then(function (d) { return d.packs || []; }, function () { return []; })]).then(function (r) {
        var byId = {};
        r[0].concat(r[1]).forEach(function (p) { if (p && p.id) byId[p.id] = p; });
        return Object.keys(byId).map(function (k) { return byId[k]; });
      });
    },
    savePack: function (pack) {
      var job = local.put('packs', pack.id, pack);
      if (S.mode === 'server') job = job.then(function () { return call('savepack', { pack: pack }); });
      return job;
    },
    deletePack: function (id) {
      var job = local.del('packs', id);
      if (S.mode === 'server') job = job.then(function () { return call('deletepack', { id: id }); });
      return job;
    },

    /* ---- running a site on the PHP server ---- */
    deploy: function (id, files, name) { return call('deploy', { id: id, name: name || '', files: files }); },
    resetSiteData: function (id) { return call('resetdata', { id: id }); },

    /* ---- settings of this browser ---- */
    setting: function (key, def) {
      var v = lsGet('set:' + key);
      return v === undefined ? def : v;
    },
    setSetting: function (key, v) {
      try { lsSet('set:' + key, v); } catch (e) { /* ignore */ }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
