/*!
 * Wemazy runtime - core
 * ---------------------
 * The meaning of Wemazy Script values and operators: how + works, what "is empty"
 * means, 1-based lists, text and number conversion... Shared by web pages and by
 * the browser test server. runtime/php.js has the same rules for PHP - keep them
 * in step (tests/differential.js checks they agree).
 *
 * This function is copied as text into every exported site, so it must not use
 * anything from outside itself.
 */
(function (root) {
  'use strict';
  var W = root.Wemazy = root.Wemazy || {};
  W.runtime = W.runtime || {};

  W.runtime.core = function wemazyCore() {
    'use strict';
    var wz = {};
    wz.lang = 'en';

    var MSG = {
      en: {
        notNumber: "'{0}' is not a number.",
        emptyNotNumber: 'An empty text is not a number.',
        divZero: "You can't divide by zero.",
        noItem: 'There is no item {0} (the list has {1}).',
        noLetter: 'There is no letter {0} (the text has {1}).',
        badIndex: "'{0}' can't be used as a position. Use a whole number like 1, 2, 3.",
        nothingItems: 'This value is nothing, so it has no item {0}.',
        notList: "{0} is not a list, so it has no items.",
        nothingField: "This value is nothing, so it has no field '{0}'.",
        noField: "{0} has no field '{1}'.",
        cantSetField: "Can't put a field '{0}' into {1}: only records have fields.",
        cantSetItem: "Can't change item {0} of {1}: it is not a list.",
        loopTooLong: 'This loop has been running for too long. Does it ever stop?',
        badStep: 'The step of a for loop can not be 0.',
        notJson: "This text is not valid JSON: {0}",
        sqlPhp: 'Your own SQL - sql(...) - only works on a PHP server. Run the site on PHP, or use find / add / update / delete.',
        tooDeep: 'Too many functions inside functions (does a function call itself forever?).',
        cantAdd: "Can't add {0} to {1}.",
        badDate: "'{0}' is not a date. Write dates like 2026-10-13.",
        int64Range: "{0} doesn't fit in {1}: Wemazy keeps 64-bit whole numbers exactly only from -9007199254740991 to 9007199254740991.",
        notWhole: "{0} can't be put in {1}.",
        badCharCode: '{0} is not the code of a character.',
        notOneChar: "A char holds one character, but '{0}' is not one character.",
        noType: "There is no type called '{0}'.",
        notStruct: '{0} can\'t be put in a {1}: give a record like {x: 1}.',
        noFieldIn: "{0} has no field '{1}'.",
        tooManyValues: '{0} has only {1} field(s).',
        unionOneField: 'A union holds one field at a time: give one value for {0}.',
        notInstance: '{0} is not a {1}.',
        noMember: "{0} has no member '{1}'.",
        privateMember: "'{0}' is private in {1}: only the code of {1} can use it.",
        protectedMember: "'{0}' is protected in {1}: only the code of {1} and of the classes that inherit from it can use it.",
        noMethod: "{0} has no method '{1}'.",
        nothingMethod: "This value is nothing, so it has no method '{0}'.",
        abstractNew: '{0} is abstract: make an object of a class that inherits from it.',
        shiftRange: 'You can shift by 0 to {0} bits, not by {1}.',
        notIntBits: "'{0}' only works with whole numbers (int types).",
        constChange: "{0} is a constant and can't be changed.",
        noItem0: 'There is no item 0: the items of a list are counted from 1 (the first one is list[1]).',
        notControl: '{0} is not a control.',
        notControlOf: '{0} is not a {1}.'
      },
      ro: {
        notNumber: "'{0}' nu este un număr.",
        emptyNotNumber: 'Un text gol nu este un număr.',
        divZero: 'Nu se poate împărți la zero.',
        noItem: 'Nu există elementul {0} (lista are {1}).',
        noLetter: 'Nu există litera {0} (textul are {1}).',
        badIndex: "'{0}' nu poate fi folosit ca poziție. Folosește un număr întreg: 1, 2, 3.",
        nothingItems: 'Valoarea este nothing (goală), deci nu are elementul {0}.',
        notList: '{0} nu este o listă, deci nu are elemente.',
        nothingField: "Valoarea este nothing (goală), deci nu are câmpul '{0}'.",
        noField: "{0} nu are câmpul '{1}'.",
        cantSetField: "Nu pot pune câmpul '{0}' în {1}: doar înregistrările au câmpuri.",
        cantSetItem: 'Nu pot schimba elementul {0} din {1}: nu este o listă.',
        loopTooLong: 'Bucla aceasta rulează de prea mult timp. Se oprește vreodată?',
        badStep: 'Pasul unei bucle for nu poate fi 0.',
        notJson: 'Textul acesta nu este JSON valid: {0}',
        sqlPhp: 'SQL-ul scris de tine - sql(...) - merge doar pe un server PHP. Rulează site-ul pe PHP sau folosește find / add / update / delete.',
        tooDeep: 'Prea multe funcții una în alta (o funcție se apelează la nesfârșit?).',
        cantAdd: 'Nu pot adăuga {0} la {1}.',
        badDate: "'{0}' nu este o dată. Scrie datele așa: 2026-10-13.",
        int64Range: '{0} nu încape în {1}: Wemazy păstrează exact numerele întregi pe 64 de biți doar de la -9007199254740991 la 9007199254740991.',
        notWhole: '{0} nu poate fi pus în {1}.',
        badCharCode: '{0} nu este codul unui caracter.',
        notOneChar: "Un char ține un singur caracter, dar '{0}' nu este un singur caracter.",
        noType: "Nu există niciun tip numit '{0}'.",
        notStruct: '{0} nu poate fi pus într-un {1}: dă o înregistrare ca {x: 1}.',
        noFieldIn: "{0} nu are câmpul '{1}'.",
        tooManyValues: '{0} are doar {1} câmp(uri).',
        unionOneField: 'Un union ține un singur câmp o dată: dă o singură valoare pentru {0}.',
        notInstance: '{0} nu este un {1}.',
        noMember: "{0} nu are membrul '{1}'.",
        privateMember: "'{0}' este private în {1}: doar codul lui {1} îl poate folosi.",
        protectedMember: "'{0}' este protected în {1}: doar codul lui {1} și al claselor care moștenesc din ea îl poate folosi.",
        noMethod: "{0} nu are metoda '{1}'.",
        nothingMethod: "Valoarea este nothing (goală), deci nu are metoda '{0}'.",
        abstractNew: '{0} este abstractă: fă un obiect dintr-o clasă care moștenește din ea.',
        shiftRange: 'Poți deplasa cu 0 până la {0} biți, nu cu {1}.',
        notIntBits: "'{0}' merge doar cu numere întregi (tipuri int).",
        constChange: '{0} este o constantă și nu poate fi schimbată.',
        noItem0: 'Nu există elementul 0: elementele unei liste se numără de la 1 (primul este lista[1]).',
        notControl: '{0} nu este un control.',
        notControlOf: '{0} nu este un {1}.'
      }
    };
    wz.messages = MSG;

    function fail(key, args) {
      var tbl = MSG[wz.lang] || MSG.en;
      var s = (tbl[key] || MSG.en[key] || key).replace(/\{(\d+)\}/g, function (m, i) {
        return args && args[i] !== undefined ? String(args[i]) : m;
      });
      var e = new Error(s);
      e.wz = true;
      throw e;
    }
    wz.fail_with = fail;

    function isNothing(v) { return v === null || v === undefined || (typeof v === 'number' && isNaN(v)); }
    function isList(v) { return Array.isArray(v); }

    /** An object made from a class (new Dog()): its class and its fields. */
    function WzObj(c) { this.$c = c; this.f = {}; }
    WzObj.prototype.toJSON = function () {
      var r = { $class: this.$c }, f = this.f;
      Object.keys(f).forEach(function (k) { r[k] = f[k]; });
      return r;
    };
    wz.Obj = WzObj;
    /** A control of the page held in a variable (var Button b = Button1). */
    function WzRef(name, type) { this.$ctl = name; this.$type = type; }
    WzRef.prototype.toJSON = function () { return this.$ctl; };
    wz.Ref = WzRef;
    function isObj(v) { return v instanceof WzObj; }
    function isRef(v) { return v instanceof WzRef; }
    function isRec(v) { return v !== null && typeof v === 'object' && !Array.isArray(v) && !isObj(v) && !isRef(v); }
    wz.is_obj = isObj;
    wz.is_ref = isRef;
    wz.is_list = isList;
    wz.is_rec = isRec;

    var NUM_RE = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;
    var COMMA_RE = /^[-+]?\d+,\d+$/;
    function numLike(v) {
      if (typeof v === 'number') return isFinite(v);
      if (typeof v !== 'string') return false;
      var s = v.trim();
      return s !== '' && (NUM_RE.test(s) || COMMA_RE.test(s));
    }
    wz.is_number = function (v) { return numLike(v); };

    function fmtNum(n) {
      if (!isFinite(n)) return n > 0 ? 'Infinity' : (n < 0 ? '-Infinity' : '');
      if (Number.isInteger(n)) return Math.abs(n) < 1e21 ? String(n) : String(n);
      // a float32 (or float16) number: the shortest digits that give the same float32 (0.1, not 0.100000001490116)
      if (Math.fround(n) === n) {
        for (var p = 1; p <= 9; p++) {
          var t = parseFloat(n.toPrecision(p));
          if (Math.fround(t) === n) return String(t);
        }
      }
      return String(parseFloat(n.toPrecision(12)));
    }

    /** Any value as text. */
    wz.text = function text(v) {
      if (isNothing(v)) return '';
      switch (typeof v) {
        case 'string': return v;
        case 'number': return fmtNum(v);
        case 'boolean': return v ? 'true' : 'false';
      }
      if (isList(v)) return v.map(function (x) { return typeof x === 'string' ? x : inner(x); }).join(', ');
      if (isRec(v) || isObj(v)) return inner(v);
      if (isRef(v)) return v.$ctl;
      return String(v);
    };
    var text = wz.text;
    /** how a value looks inside a list or record */
    function inner(v) {
      if (typeof v === 'string') return '"' + v + '"';
      if (isList(v)) return '[' + v.map(inner).join(', ') + ']';
      if (isObj(v)) return v.$c + ' {' + Object.keys(v.f).map(function (k) { return k + ': ' + inner(v.f[k]); }).join(', ') + '}';
      if (isRec(v) && v.$u !== undefined && unions[String(v.$u).toLowerCase()]) {
        var ud = unions[String(v.$u).toLowerCase()];
        return '{' + ud.fields.map(function (f) { return f[0] + ': ' + inner(uget(v, f)); }).join(', ') + '}';
      }
      if (isRec(v)) return '{' + Object.keys(v).map(function (k) { return k + ': ' + inner(v[k]); }).join(', ') + '}';
      if (isNothing(v)) return 'nothing';
      return text(v);
    }

    /** Any value as a number ("3,5" works too). */
    wz.num = function (v) {
      if (typeof v === 'number') return isNaN(v) ? 0 : v;
      if (isNothing(v)) return 0;
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (typeof v === 'string') {
        var s = v.trim();
        if (s === '') fail('emptyNotNumber');
        if (COMMA_RE.test(s)) s = s.replace(',', '.');
        if (NUM_RE.test(s)) return parseFloat(s);
        fail('notNumber', [v.length > 40 ? v.slice(0, 40) + '…' : v]);
      }
      fail('notNumber', [text(v)]);
    };
    var num = wz.num;

    /** true / false of any value (nothing, 0, "" and empty lists are false). */
    wz.truthy = function (v) {
      if (isNothing(v) || v === false || v === 0 || v === '') return false;
      if (isList(v)) return v.length > 0;
      if (isRec(v)) return Object.keys(v).length > 0;
      return true;
    };

    /* ---- arithmetic ---- */

    wz.add = function (a, b) {
      if (typeof a === 'number' && typeof b === 'number') return a + b;
      if (isList(a)) return a.concat(isList(b) ? b : [b]);
      if (isNothing(a)) return numLike(b) ? num(b) : (isNothing(b) ? 0 : b);
      if (isNothing(b)) return numLike(a) ? num(a) : a;
      if (numLike(a) && numLike(b)) return num(a) + num(b);
      return text(a) + text(b);
    };
    wz.sub = function (a, b) { return num(a) - num(b); };
    wz.mul = function (a, b) { return num(a) * num(b); };
    wz.div = function (a, b) {
      var y = num(b);
      if (y === 0) fail('divZero');
      return num(a) / y;
    };
    wz.mod = function (a, b) {
      var x = num(a), y = num(b);
      if (y === 0) fail('divZero');
      var r = x % y;
      if (r !== 0 && (r < 0) !== (y < 0)) r += y;
      return r;
    };
    wz.pow = function (a, b) { return Math.pow(num(a), num(b)); };
    wz.neg = function (a) { return -num(a); };
    wz.cat = function (a, b) { return text(a) + text(b); };

    /* ---- comparing ---- */

    function deepEq(a, b) {
      if (isList(a) && isList(b)) {
        if (a.length !== b.length) return false;
        for (var i = 0; i < a.length; i++) if (!wz.eq(a[i], b[i])) return false;
        return true;
      }
      if (isRec(a) && isRec(b)) {
        var ka = Object.keys(a), kb = Object.keys(b);
        if (ka.length !== kb.length) return false;
        for (var j = 0; j < ka.length; j++) if (!wz.eq(a[ka[j]], b[ka[j]])) return false;
        return true;
      }
      return false;
    }
    wz.eq = function (a, b) {
      if (a === b) return true;
      if (isNothing(a) || isNothing(b)) return isNothing(a) && isNothing(b);
      // objects of classes are the same only if they are the very same object; controls if they have the same name
      if (isObj(a) || isObj(b)) return false;
      if (isRef(a) || isRef(b)) return isRef(a) && isRef(b) && a.$ctl.toLowerCase() === b.$ctl.toLowerCase();
      if (typeof a === 'boolean' || typeof b === 'boolean') return text(a) === text(b);
      if (numLike(a) && numLike(b)) return num(a) === num(b);
      if (typeof a === 'object' || typeof b === 'object') return deepEq(a, b);
      return text(a) === text(b);
    };
    wz.ne = function (a, b) { return !wz.eq(a, b); };
    function cmp(a, b) {
      if ((numLike(a) || isNothing(a)) && (numLike(b) || isNothing(b))) {
        var x = num(a), y = num(b);
        return x < y ? -1 : (x > y ? 1 : 0);
      }
      var s = text(a), t = text(b);
      return s < t ? -1 : (s > t ? 1 : 0);
    }
    wz.cmp = cmp;
    wz.lt = function (a, b) { return cmp(a, b) < 0; };
    wz.le = function (a, b) { return cmp(a, b) <= 0; };
    wz.gt = function (a, b) { return cmp(a, b) > 0; };
    wz.ge = function (a, b) { return cmp(a, b) >= 0; };

    function low(v) { return text(v).toLowerCase(); }
    wz.contains = function (a, b) {
      if (isNothing(a)) return false;
      if (isList(a)) return a.some(function (x) { return wz.eq(x, b); });
      if (isRec(a)) return wz.has(a, b);
      return low(a).indexOf(low(b)) >= 0;
    };
    wz.starts = function (a, b) { return !isNothing(a) && low(a).indexOf(low(b)) === 0; };
    wz.ends = function (a, b) {
      if (isNothing(a)) return false;
      var s = low(a), t = low(b);
      return s.length >= t.length && s.slice(s.length - t.length) === t;
    };
    wz.is_empty = function (v) {
      if (isNothing(v)) return true;
      if (typeof v === 'string') return v.trim() === '';
      if (isList(v)) return v.length === 0;
      if (isRec(v)) return Object.keys(v).length === 0;
      return false;
    };

    /* ---- lists, records ---- */

    function chars(s) { return Array.from(s); }
    function index(i, len) {
      if (!numLike(i)) fail('badIndex', [text(i)]);
      var n = num(i);
      if (Math.floor(n) !== n) fail('badIndex', [text(i)]);
      if (n === 0) fail('noItem0');
      if (n < 0) n = len + n + 1;
      return n;
    }
    function findKey(obj, k) {
      k = text(k);
      if (Object.prototype.hasOwnProperty.call(obj, k)) return k;
      var lk = k.toLowerCase();
      var keys = Object.keys(obj);
      for (var i = 0; i < keys.length; i++) if (keys[i].toLowerCase() === lk) return keys[i];
      return null;
    }
    /** list[i] (1 = first item), text[i], record["field"] */
    wz.idx = function (obj, i) {
      if (isNothing(obj)) fail('nothingItems', [text(i)]);
      if (isList(obj)) {
        var n = index(i, obj.length);
        if (n < 1 || n > obj.length) fail('noItem', [text(i), obj.length]);
        return obj[n - 1];
      }
      if (typeof obj === 'string') {
        var cs = chars(obj), m = index(i, cs.length);
        if (m < 1 || m > cs.length) fail('noLetter', [text(i), cs.length]);
        return cs[m - 1];
      }
      if (isRec(obj)) {
        var k = findKey(obj, i);
        return k === null ? null : obj[k];
      }
      fail('notList', [text(obj)]);
    };
    wz.set_idx = function (obj, i, v) {
      if (isList(obj)) {
        var n = index(i, obj.length);
        if (n < 1 || n > obj.length + 1) fail('noItem', [text(i), obj.length]);
        obj[n - 1] = v;
        return obj;
      }
      if (isRec(obj)) {
        var k = findKey(obj, i);
        obj[k === null ? text(i) : k] = v;
        return obj;
      }
      fail('cantSetItem', [text(i), isNothing(obj) ? 'nothing' : text(obj)]);
    };
    /** record.field */
    wz.dot = function (obj, k, ctx) {
      // x.length, x.count, x.size: how many letters or items (0 for nothing, like length(nothing))
      var lk = String(k).toLowerCase();
      var isLen = lk === 'length' || lk === 'count' || lk === 'size';
      if (isNothing(obj)) {
        if (isLen) return 0;
        fail('nothingField', [k]);
      }
      if (isObj(obj)) return wz.oget(obj, k, ctx);
      if (isRef(obj)) return wz.get(obj.$ctl, k);
      if (isRec(obj) && obj.$u !== undefined && unions[String(obj.$u).toLowerCase()]) return uget(obj, ufield(obj, k));
      if (isRec(obj)) {
        var key = findKey(obj, k);
        if (key === null && isLen) return wz.len(obj);
        return key === null ? null : obj[key];
      }
      if ((isList(obj) || typeof obj === 'string') && isLen) return wz.len(obj);
      fail('noField', [text(obj).slice(0, 40), k]);
    };
    wz.set_dot = function (obj, k, v, ctx) {
      if (isObj(obj)) { wz.oset(obj, k, v, ctx); return obj; }
      if (isRef(obj)) { wz.set(obj.$ctl, k, v); return obj; }
      if (isRec(obj) && obj.$u !== undefined && unions[String(obj.$u).toLowerCase()]) { uput(obj, ufield(obj, k), v); return obj; }
      if (isRec(obj)) {
        var key = findKey(obj, k);
        obj[key === null ? k : key] = v;
        return obj;
      }
      fail('cantSetField', [k, isNothing(obj) ? 'nothing' : text(obj).slice(0, 40)]);
    };
    wz.len = function (v) {
      if (isNothing(v)) return 0;
      if (isList(v)) return v.length;
      if (isObj(v)) return Object.keys(v.f).length;
      if (isRec(v)) return Object.keys(v).length;
      return chars(text(v)).length;
    };
    /** What "for each x in value" walks through. */
    wz.each = function (v) {
      if (isNothing(v)) return [];
      // each item is a copy (changing it doesn't change the list, like in PHP)
      if (isList(v)) return v.map(wz.val);
      if (typeof v === 'string') return chars(v);
      if (typeof v === 'number') return wz.range_list(1, v);
      if (isRec(v)) return Object.keys(v);
      return [v];
    };
    wz.range = function* (a, b, step) {
      var x = num(a), y = num(b);
      var s = isNothing(step) ? (x <= y ? 1 : -1) : num(step);
      if (s === 0) fail('badStep');
      var n = 0;
      if (s > 0) { for (var i = x; i <= y + 1e-9; i = x + (++n) * s) yield round12(i); }
      else { for (var j = x; j >= y - 1e-9; j = x + (++n) * s) yield round12(j); }
    };
    function round12(n) { return Number.isInteger(n) ? n : parseFloat(n.toPrecision(12)); }
    wz.times = function (n) { var x = Math.floor(num(n)); return x > 0 ? x : 0; };
    wz.range_list = function (a, b) {
      var out = [], it = wz.range(a, b, null), r;
      while (!(r = it.next()).done) { out.push(r.value); if (out.length > 1000000) break; }
      return out;
    };

    /** add item to target: lists get the item, numbers get bigger, texts get longer. */
    wz.push = function (target, item) {
      if (isList(target)) { target.push(item); return target; }
      if (isNothing(target)) return typeof item === 'number' ? item : [item];
      if (typeof target === 'number') return target + num(item);
      if (typeof target === 'string') {
        if (numLike(target) && numLike(item)) return num(target) + num(item);
        return target + text(item);
      }
      fail('cantAdd', [text(item), text(target)]);
    };
    /** remove item from target */
    wz.pull = function (target, item) {
      if (isList(target)) {
        for (var i = 0; i < target.length; i++) {
          if (wz.eq(target[i], item)) { target.splice(i, 1); break; }
        }
        return target;
      }
      if (isNothing(target)) return target;
      if (typeof target === 'number') return target - num(item);
      if (typeof target === 'string') {
        if (numLike(target) && numLike(item)) return num(target) - num(item);
        return target.split(text(item)).join('');
      }
      if (isRec(target)) {
        var k = findKey(target, item);
        if (k !== null) delete target[k];
        return target;
      }
      return target;
    };
    wz.cleared = function (v) {
      if (isList(v)) { v.length = 0; return v; }
      if (typeof v === 'number') return 0;
      if (isRec(v)) return {};
      if (typeof v === 'string') return '';
      return null;
    };

    /* ---- text functions ---- */

    wz.upper = function (s) { return text(s).toUpperCase(); };
    wz.lower = function (s) { return text(s).toLowerCase(); };
    wz.capitalize = function (s) { var c = chars(text(s)); if (c.length) c[0] = c[0].toUpperCase(); return c.join(''); };
    wz.trim = function (s) { return text(s).trim(); };
    wz.replace = function (s, a, b) {
      s = text(s); a = text(a);
      if (a === '') return s;
      return s.split(a).join(text(b));
    };
    wz.split = function (s, sep) {
      s = text(s);
      if (isNothing(sep)) sep = ',';
      sep = text(sep);
      if (s === '') return [];
      if (sep === '') return chars(s);
      return s.split(sep).map(function (x) { return sep.trim() === '' ? x : x.trim(); });
    };
    wz.join = function (list, sep) {
      if (!isList(list)) return text(list);
      return list.map(text).join(isNothing(sep) ? ', ' : text(sep));
    };
    wz.part = function (v, start, count) {
      var arr = isList(v) ? v : chars(text(v));
      var s = num(start);
      if (s < 0) s = arr.length + s + 1;
      if (s < 1) s = 1;
      var c = isNothing(count) ? arr.length : Math.max(0, Math.floor(num(count)));
      var out = arr.slice(s - 1, s - 1 + c);
      return isList(v) ? out : out.join('');
    };
    wz.position = function (where, what) {
      if (isList(where)) {
        for (var i = 0; i < where.length; i++) if (wz.eq(where[i], what)) return i + 1;
        return 0;
      }
      var hay = text(where), needle = text(what);
      var j = hay.indexOf(needle);
      if (j < 0 || needle === '') return 0;
      return chars(hay.slice(0, j)).length + 1;
    };
    wz.reverse = function (v) {
      if (isList(v)) return v.slice().reverse();
      return chars(text(v)).reverse().join('');
    };
    wz.format = function (n, d) {
      var x = num(n), k = Math.max(0, Math.min(20, Math.floor(num(d))));
      var r = wz.round(x, k);
      return r.toFixed(k);
    };

    /* ---- numbers ---- */

    wz.round = function (n, d) {
      var x = num(n), k = isNothing(d) ? 0 : Math.floor(num(d));
      var sign = x < 0 ? -1 : 1, ax = Math.abs(x);
      var r = Number(Math.round(Number(ax + 'e' + k)) + 'e' + (-k));
      if (!isFinite(r)) r = Math.round(ax * Math.pow(10, k)) / Math.pow(10, k);
      return sign * r || 0;
    };
    wz.floor = function (n) { return Math.floor(num(n)); };
    wz.ceil = function (n) { return Math.ceil(num(n)); };
    wz.abs = function (n) { return Math.abs(num(n)); };
    wz.sqrt = function (n) { return Math.sqrt(num(n)); };
    wz.random = function (a, b) {
      if (isNothing(a) && isNothing(b)) return Math.random();
      var lo, hi;
      if (isNothing(b)) { lo = 1; hi = Math.floor(num(a)); }
      else { lo = Math.ceil(num(a)); hi = Math.floor(num(b)); }
      if (lo > hi) { var t = lo; lo = hi; hi = t; }
      return lo + Math.floor(Math.random() * (hi - lo + 1));
    };
    function values(args) {
      if (args.length === 1 && isList(args[0])) return args[0];
      return args;
    }
    wz.min = function () {
      var v = values(Array.prototype.slice.call(arguments));
      if (!v.length) return null;
      return v.reduce(function (m, x) { return cmp(x, m) < 0 ? x : m; });
    };
    wz.max = function () {
      var v = values(Array.prototype.slice.call(arguments));
      if (!v.length) return null;
      return v.reduce(function (m, x) { return cmp(x, m) > 0 ? x : m; });
    };
    function field(x, f) { return isNothing(f) ? x : wz.dot(x, text(f)); }
    wz.sum = function (list, f) {
      if (!isList(list)) return num(list);
      return list.reduce(function (s, x) { var v = field(x, f); return isNothing(v) || v === '' ? s : s + num(v); }, 0);
    };
    wz.average = function (list, f) {
      if (!isList(list) || !list.length) return 0;
      return wz.sum(list, f) / list.length;
    };
    wz.first = function (v) {
      if (isList(v)) return v.length ? v[0] : null;
      var c = chars(text(v));
      return c.length ? c[0] : null;
    };
    wz.last = function (v) {
      if (isList(v)) return v.length ? v[v.length - 1] : null;
      var c = chars(text(v));
      return c.length ? c[c.length - 1] : null;
    };
    wz.pick = function (v) {
      var arr = isList(v) ? v : chars(text(v));
      return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
    };
    wz.shuffle = function (v) {
      var arr = isList(v) ? v.slice() : chars(text(v));
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return isList(v) ? arr : arr.join('');
    };
    wz.sort = function (v, f, desc) {
      if (!isList(v)) return chars(text(v)).sort().join('');
      var d = wz.truthy(desc) ? -1 : 1;
      return v.map(function (x, i) { return [x, i]; }).sort(function (a, b) {
        var x = field(a[0], f), y = field(b[0], f);
        var c = (typeof x === 'string' && typeof y === 'string' && !(numLike(x) && numLike(y))) ? cmp(x.toLowerCase(), y.toLowerCase()) || cmp(x, y) : cmp(x, y);
        return c ? c * d : a[1] - b[1];
      }).map(function (p) { return p[0]; });
    };
    wz.unique = function (v) {
      if (!isList(v)) return v;
      var out = [];
      v.forEach(function (x) { if (!out.some(function (y) { return wz.eq(x, y); })) out.push(x); });
      return out;
    };
    wz.keys = function (r) { return isRec(r) ? Object.keys(r) : (isList(r) ? wz.range_list(1, r.length) : []); };
    wz.has = function (r, f) { return isRec(r) && findKey(r, f) !== null; };

    /* ---- dates (text like 2026-10-13 or 2026-10-13 08:55:00) ---- */

    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function nowParts(d) {
      d = d || new Date();
      return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), i: d.getMinutes(), s: d.getSeconds() };
    }
    function parseDate(v) {
      if (isNothing(v) || v === '') return nowParts();
      var m = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(text(v));
      if (!m) {
        var m2 = /^\s*(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(text(v));
        if (!m2) fail('badDate', [text(v)]);
        return { y: +m2[3], m: +m2[2], d: +m2[1], h: 0, i: 0, s: 0, noTime: true };
      }
      return { y: +m[1], m: +m[2], d: +m[3], h: m[4] ? +m[4] : 0, i: m[5] ? +m[5] : 0, s: m[6] ? +m[6] : 0, noTime: !m[4] };
    }
    function dateText(p) { return p.y + '-' + pad(p.m) + '-' + pad(p.d); }
    wz.now = function () { var p = nowParts(); return dateText(p) + ' ' + pad(p.h) + ':' + pad(p.i) + ':' + pad(p.s); };
    wz.today = function () { return dateText(nowParts()); };
    wz.time = function () { var p = nowParts(); return pad(p.h) + ':' + pad(p.i); };
    wz.date_part = function (v, part) {
      var p = parseDate(v);
      if (part === 'w') {
        var wd = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
        return wd === 0 ? 7 : wd;
      }
      return p[part];
    };
    function dayNum(p) { return Math.round(Date.UTC(p.y, p.m - 1, p.d) / 86400000); }
    wz.days_between = function (a, b) { return dayNum(parseDate(b)) - dayNum(parseDate(a)); };
    wz.add_days = function (v, n) {
      var p = parseDate(v);
      var dt = new Date(Date.UTC(p.y, p.m - 1, p.d) + Math.round(num(n)) * 86400000);
      var q = { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
      var out = dateText(q);
      if (!p.noTime && !(isNothing(v) || v === '')) out += ' ' + pad(p.h) + ':' + pad(p.i) + ':' + pad(p.s);
      return out;
    };

    /* ---- types: var int32 x = 5 ... (the rules of C) ---- */

    var MAXSAFE = 9007199254740991;
    var INTS = { int8: [8, 1], int16: [16, 1], int32: [32, 1], int64: [64, 1], uint8: [8, 0], uint16: [16, 0], uint32: [32, 0], uint64: [64, 0] };
    var SIZES = { bool: 1, char: 1, int8: 1, uint8: 1, int16: 2, uint16: 2, int32: 4, uint32: 4, int64: 8, uint64: 8, float16: 2, float32: 4, float64: 8 };
    wz.sizes = SIZES;
    function intName(bits, signed) { return (signed ? 'int' : 'unsigned int') + bits; }

    /** Keep a whole number inside a C type, going round like C: int8 200 is -56, uint8 -1 is 255. */
    function wrap(t, bits, signed) {
      if (t > MAXSAFE || t < -MAXSAFE || (bits >= 64 && !signed && t < 0)) fail('int64Range', [fmtNum(t), intName(bits, signed)]);
      if (bits >= 64) return t === 0 ? 0 : t;
      var m = Math.pow(2, bits);
      var r = t % m;
      if (r < 0) r += m;
      if (signed && r >= m / 2) r -= m;
      return r === 0 ? 0 : r;
    }
    wz.wrap = wrap;
    /** Any value as a whole number of a C type ("12" works, 3.9 becomes 3). */
    wz.to_int = function (v, bits, signed) {
      var x = num(v);
      if (!isFinite(x)) fail('notWhole', [text(v), intName(bits, signed)]);
      return wrap(Math.trunc(x), bits, signed);
    };
    /** The nearest number of a half-precision float (float16), like the hardware does it. */
    function f16(x) {
      if (x === 0 || !isFinite(x)) return x;
      var a = Math.abs(x);
      if (a >= 65520) return x > 0 ? Infinity : -Infinity;
      var e = 0, p = 1;
      while (p * 2 <= a) { p *= 2; e++; }
      while (p > a) { p /= 2; e--; }
      if (e < -14) p = Math.pow(2, -14);
      var q = p / 1024, n = a / q, f = Math.floor(n), d = n - f;
      if (d > 0.5 || (d === 0.5 && f % 2 === 1)) f++;
      var r = f * q;
      return r === 0 ? 0 : (x < 0 ? -r : r);
    }
    wz.to_float = function (v, bits) {
      var x = num(v);
      if (bits === 32) x = Math.fround(x);
      else if (bits === 16) x = f16(x);
      return x === 0 ? 0 : x;
    };
    /** One character. A number gives the character with that code: 65 is "A". */
    wz.to_char = function (v) {
      if (typeof v === 'number' || typeof v === 'boolean') {
        var c = Math.trunc(num(v));
        if (!(c >= 0 && c <= 0x10FFFF)) fail('badCharCode', [text(v)]);
        return String.fromCodePoint(c);
      }
      if (isNothing(v)) return '\u0000';
      var cs = chars(text(v));
      if (cs.length !== 1) fail('notOneChar', [text(v).slice(0, 20)]);
      return cs[0];
    };
    /** The code of a character ('A' is 65). */
    wz.code = function (c) {
      if (typeof c === 'number') return c;
      if (typeof c === 'boolean') return c ? 1 : 0;
      var s = text(c);
      return s === '' ? 0 : s.codePointAt(0);
    };

    /* whole-number arithmetic of C: the result is an int32, unsigned int32, int64 or unsigned int64 */
    wz.ia = function (x, bits, signed) { return wrap(x, bits, signed); };
    wz.imul = function (a, b, bits, signed) {
      if (bits <= 32) return wrap(signed ? Math.imul(a, b) : Math.imul(a, b) >>> 0, bits, signed);
      return wrap(a * b, bits, signed);
    };
    wz.idiv = function (a, b, bits, signed) {
      if (b === 0) fail('divZero');
      return wrap((a - a % b) / b, bits, signed);
    };
    wz.irem = function (a, b) {
      if (b === 0) fail('divZero');
      var r = a % b;
      return r === 0 ? 0 : r;
    };
    /* bit by bit: and or xor not (in small letters), shl shr. bits / signed: the type of the result (int32 by default) */
    function big(v) {
      if (typeof v === 'boolean') return v ? 1n : 0n;
      var x = num(v);
      if (!isFinite(x) || Math.trunc(x) !== x) fail('notIntBits', [text(v)]);
      return BigInt(x);
    }
    function bigBack(b, bits, signed) { return wrap(Number(signed ? BigInt.asIntN(bits, b) : BigInt.asUintN(bits, b)), bits, signed); }
    wz.band = function (a, b, bits, signed) { return bigBack(big(a) & big(b), bits, signed); };
    wz.bor = function (a, b, bits, signed) { return bigBack(big(a) | big(b), bits, signed); };
    wz.bxor = function (a, b, bits, signed) { return bigBack(big(a) ^ big(b), bits, signed); };
    wz.bnot = function (a, bits, signed) { return bigBack(~big(a), bits, signed); };
    wz.shl = function (a, n, bits, signed) {
      n = Math.trunc(num(n));
      if (!(n >= 0 && n < bits)) fail('shiftRange', [bits - 1, fmtNum(n)]);
      return bigBack(big(a) << BigInt(n), bits, signed);
    };
    wz.shr = function (a, n, bits, signed) {
      n = Math.trunc(num(n));
      if (!(n >= 0 && n < bits)) fail('shiftRange', [bits - 1, fmtNum(n)]);
      return wrap(Math.floor(Number(big(a)) / Math.pow(2, n)), bits, signed);
    };
    /**
     * and / or / xor / nand / nor / xnor in small letters on values whose type is not known:
     * two numbers work bit by bit (as int32); anything else works as a condition (true / false),
     * and the right side (f) runs only when it is needed, like && and ||.
     */
    function bitWord(op, a, b) {
      switch (op) {
        case 'and': return wz.band(a, b, 32, true);
        case 'or': return wz.bor(a, b, 32, true);
        case 'xor': return wz.bxor(a, b, 32, true);
        case 'nand': return wz.bnot(wz.band(a, b, 32, true), 32, true);
        case 'nor': return wz.bnot(wz.bor(a, b, 32, true), 32, true);
        default: return wz.bnot(wz.bxor(a, b, 32, true), 32, true);
      }
    }
    function logicWord(op, a, b) {
      switch (op) {
        case 'and': return a && b;
        case 'or': return a || b;
        case 'xor': return a !== b;
        case 'nand': return !(a && b);
        case 'nor': return !(a || b);
        default: return a === b;
      }
    }
    wz.bw = function (op, a, f) {
      var isNum = typeof a === 'number' && isFinite(a);
      var ta = wz.truthy(a);
      // a condition that is already decided by the left side
      if (!isNum) {
        if ((op === 'and' && !ta) || (op === 'nand' && !ta)) return op === 'and' ? false : true;
        if ((op === 'or' && ta) || (op === 'nor' && ta)) return op === 'or' ? true : false;
      }
      var r = f();
      var done = function (b) {
        if (isNum && typeof b === 'number' && isFinite(b)) return bitWord(op, a, b);
        return logicWord(op, ta, wz.truthy(b));
      };
      return r && typeof r.then === 'function' ? r.then(done) : done(r);
    };
    /** not in small letters on a value whose type is not known */
    wz.bnot1 = function (a) {
      if (typeof a === 'number' && isFinite(a)) return wz.bnot(a, 32, true);
      return !wz.truthy(a);
    };
    /** float32 and float16 arithmetic keeps its precision after every step */
    wz.fa = function (x, bits) { return bits === 32 ? (Math.fround(x) || 0) : (bits === 16 ? (f16(x) || 0) : x); };
    wz.fdiv = function (a, b, bits) {
      if (b === 0) fail('divZero');
      return wz.fa(a / b, bits);
    };
    /** int32 a[10]: a list of 10 values that start at the zero of their type */
    wz.array = function (n, type) {
      var c = Math.floor(num(n)), out = [];
      if (!(c >= 0)) fail('badIndex', [text(n)]);
      for (var i = 0; i < c; i++) out.push(wz.zero(type));
      return out;
    };

    /** A copy of a value: lists, records, structs and unions are values (like in C and PHP). */
    wz.val = function val(v) {
      if (isList(v)) return v.map(val);
      if (isRec(v)) {
        var o = {};
        Object.keys(v).forEach(function (k) { o[k] = val(v[k]); });
        return o;
      }
      return v;
    };

    /** Convert a value to a type (of a variable, a field, a parameter...). */
    wz.conv = function (v, type) {
      var it = INTS[type];
      if (it) return wz.to_int(v, it[0], !!it[1]);
      switch (type) {
        case 'any': return wz.val(v);
        case 'bool': return wz.truthy(v);
        case 'char': return wz.to_char(v);
        case 'string': return text(v);
        case 'float16': return wz.to_float(v, 16);
        case 'float32': return wz.to_float(v, 32);
        case 'float64': return wz.to_float(v, 64);
      }
      var k = type.charAt(0), name = type.slice(2);
      if (k === 'S') return toStruct(v, name);
      if (k === 'U') return toUnion(v, name);
      if (k === 'C') return toObj(v, name);
      if (k === 'L') {
        if (isNothing(v)) return [];
        if (!isList(v)) fail('notList', [shortText(v)]);
        return v.map(function (x) { return wz.conv(x, name); });
      }
      if (k === 'G') return wz.to_ctl ? wz.to_ctl(v, name) : v;
      return v;
    };
    /** The value a variable of a type starts with: 0, false, "", an empty struct... */
    wz.zero = function (type) {
      if (INTS[type] || /^float/.test(type)) return 0;
      switch (type) {
        case 'bool': return false;
        case 'char': return '\u0000';
        case 'string': return '';
        case 'any': return null;
      }
      var k = type.charAt(0), name = type.slice(2);
      if (k === 'S') return toStruct(null, name);
      if (k === 'U') return toUnion(null, name);
      if (k === 'L') return [];
      return null;
    };
    /** x as Dog: x if it is a Dog, else nothing */
    wz.as_a = function (v, type) { return wz.is_a(v, type) ? v : null; };
    /** Is v of this type? (x is Dog) */
    wz.is_a = function (v, type) {
      var it = INTS[type];
      if (it) {
        if (typeof v !== 'number' || !Number.isInteger(v)) return false;
        if (it[0] >= 64) return Math.abs(v) <= MAXSAFE && (!!it[1] || v >= 0);
        return wrap(v, it[0], !!it[1]) === v;
      }
      switch (type) {
        case 'any': return true;
        case 'bool': return typeof v === 'boolean';
        case 'char': return typeof v === 'string' && chars(v).length === 1;
        case 'string': return typeof v === 'string';
        case 'float16': case 'float32': case 'float64': return typeof v === 'number';
      }
      var k = type.charAt(0), name = type.slice(2).toLowerCase();
      if (k === 'C') {
        if (!isObj(v)) return false;
        for (var c = classes[v.$c.toLowerCase()]; c; c = c.base) if (c.lname === name || c.ifaces.indexOf(name) >= 0) return true;
        return false;
      }
      if (k === 'U') return isRec(v) && String(v.$u).toLowerCase() === name;
      if (k === 'S') return isRec(v) && v.$u === undefined;
      if (k === 'L') return isList(v);
      if (k === 'G') return wz.ctl_is ? wz.ctl_is(v, name) : false;
      return false;
    };
    function shortText(v) { var s = isNothing(v) ? 'nothing' : inner(v); return s.length > 40 ? s.slice(0, 40) + '…' : s; }

    /* ---- struct: a record with fixed fields (copied when it is given to another variable) ---- */

    var structs = {};
    wz.def_struct = function (d) { structs[d.name.toLowerCase()] = d; };
    function dflt(f) { return f[2] !== undefined && f[2] !== null ? wz.conv(f[2], f[1]) : wz.zero(f[1]); }
    function toStruct(v, name) {
      var d = structs[name.toLowerCase()];
      if (!d) fail('noType', [name]);
      var out = {};
      if (isNothing(v)) { d.fields.forEach(function (f) { out[f[0]] = dflt(f); }); return out; }
      if (isList(v)) {
        // var Point p = {1, 2}: the values in the order of the fields
        if (v.length > d.fields.length) fail('tooManyValues', [d.name, d.fields.length]);
        d.fields.forEach(function (f, i) { out[f[0]] = i < v.length ? wz.conv(v[i], f[1]) : dflt(f); });
        return out;
      }
      if (!isRec(v) || v.$u !== undefined) fail('notStruct', [shortText(v), d.name]);
      Object.keys(v).forEach(function (k) {
        if (!d.fields.some(function (f) { return f[0].toLowerCase() === k.toLowerCase(); })) fail('noFieldIn', [d.name, k]);
      });
      d.fields.forEach(function (f) {
        var key = findKey(v, f[0]);
        out[f[0]] = key === null ? dflt(f) : wz.conv(v[key], f[1]);
      });
      return out;
    }

    /* ---- union: all its fields share the same bytes, like in C ---- */

    var unions = {};
    wz.def_union = function (d) {
      d.size = d.fields.reduce(function (m, f) { return Math.max(m, SIZES[f[1]] || 0); }, 1);
      unions[d.name.toLowerCase()] = d;
    };
    function ufield(u, k) {
      var d = unions[String(u.$u).toLowerCase()];
      for (var i = 0; i < d.fields.length; i++) if (d.fields[i][0].toLowerCase() === String(k).toLowerCase()) return d.fields[i];
      fail('noFieldIn', [d.name, k]);
    }
    function toUnion(v, name) {
      var d = unions[name.toLowerCase()];
      if (!d) fail('noType', [name]);
      var u = { $u: d.name, $b: [] };
      for (var i = 0; i < d.size; i++) u.$b.push(0);
      if (isNothing(v)) return u;
      if (isRec(v) && v.$u !== undefined) {
        if (String(v.$u).toLowerCase() !== d.name.toLowerCase()) fail('notInstance', [shortText(v), d.name]);
        u.$b = v.$b.slice();
        return u;
      }
      if (isList(v)) {
        if (v.length > 1) fail('unionOneField', [d.name]);
        if (v.length) uput(u, d.fields[0], v[0]);
        return u;
      }
      if (isRec(v)) {
        var ks = Object.keys(v);
        if (ks.length > 1) fail('unionOneField', [d.name]);
        if (ks.length) uput(u, ufield(u, ks[0]), v[ks[0]]);
        return u;
      }
      uput(u, d.fields[0], v);
      return u;
    }
    var dv = new DataView(new ArrayBuffer(8));
    function f16bits(x) {
      var s = x < 0 ? 0x8000 : 0, a = Math.abs(x);
      if (a === Infinity) return s | 0x7C00;
      if (a === 0) return s;
      if (a < Math.pow(2, -14)) return s | Math.round(a / Math.pow(2, -24));
      var e = 0, p = 1;
      while (p * 2 <= a) { p *= 2; e++; }
      while (p > a) { p /= 2; e--; }
      return s | ((e + 15) << 10) | Math.round((a / p - 1) * 1024);
    }
    function f16val(h) {
      var s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 0x1F, m = h & 0x3FF;
      if (e === 0) return m ? s * m * Math.pow(2, -24) : 0;
      if (e === 31) return m ? null : s * Infinity;
      return s * (1 + m / 1024) * Math.pow(2, e - 15);
    }
    /** Write a field of a union into its bytes (little-endian, like a PC). */
    function uput(u, f, value) {
      var t = f[1], v = wz.conv(value, t);
      switch (t) {
        case 'int8': dv.setInt8(0, v); break;
        case 'uint8': dv.setUint8(0, v); break;
        case 'int16': dv.setInt16(0, v, true); break;
        case 'uint16': dv.setUint16(0, v, true); break;
        case 'int32': dv.setInt32(0, v, true); break;
        case 'uint32': dv.setUint32(0, v, true); break;
        case 'int64': dv.setBigInt64(0, BigInt(v), true); break;
        case 'uint64': dv.setBigUint64(0, BigInt(v), true); break;
        case 'float16': dv.setUint16(0, f16bits(v), true); break;
        case 'float32': dv.setFloat32(0, v, true); break;
        case 'float64': dv.setFloat64(0, v, true); break;
        case 'bool': dv.setUint8(0, v ? 1 : 0); break;
        case 'char': dv.setUint8(0, wz.code(v) & 255); break;
      }
      for (var i = 0; i < (SIZES[t] || 1); i++) u.$b[i] = dv.getUint8(i);
    }
    /** Read a field of a union from its bytes. */
    function uget(u, f) {
      var t = f[1];
      for (var i = 0; i < 8; i++) dv.setUint8(i, i < u.$b.length ? u.$b[i] : 0);
      switch (t) {
        case 'int8': return dv.getInt8(0);
        case 'uint8': return dv.getUint8(0);
        case 'int16': return dv.getInt16(0, true);
        case 'uint16': return dv.getUint16(0, true);
        case 'int32': return dv.getInt32(0, true);
        case 'uint32': return dv.getUint32(0, true);
        case 'int64': return wrap(Number(dv.getBigInt64(0, true)), 64, true);
        case 'uint64': return wrap(Number(dv.getBigUint64(0, true)), 64, false);
        case 'float16': return f16val(dv.getUint16(0, true));
        case 'float32': return dv.getFloat32(0, true);
        case 'float64': return dv.getFloat64(0, true);
        case 'bool': return dv.getUint8(0) !== 0;
        case 'char': return String.fromCharCode(dv.getUint8(0));
      }
      return null;
    }

    /* ---- classes: objects with fields and methods, made with new ---- */

    var classes = {};
    wz.classes = classes;
    /**
     * d = { name, base, abstract, iface, ifaces: [names],
     *       fields: [[name, type, access, isStatic]], methods: [[name, fn, access, isStatic]] }
     * Classes come base first.
     */
    wz.def_class = function (d) {
      var c = { name: d.name, lname: d.name.toLowerCase(), base: d.base ? classes[d.base.toLowerCase()] || null : null,
        abstract: !!d.abstract, iface: !!d.iface, ifaces: [], fields: {}, flist: [], statics: {}, svals: {}, methods: {}, ctor: d.ctor || null };
      (d.ifaces || []).forEach(function (n) {
        var i = classes[n.toLowerCase()];
        c.ifaces.push(n.toLowerCase());
        if (i) i.ifaces.forEach(function (x) { if (c.ifaces.indexOf(x) < 0) c.ifaces.push(x); });
      });
      if (c.base) c.base.ifaces.forEach(function (x) { if (c.ifaces.indexOf(x) < 0) c.ifaces.push(x); });
      (d.fields || []).forEach(function (f) {
        var m = { name: f[0], type: f[1], access: f[2] || 'public', owner: c, stat: !!f[3] };
        if (m.stat) { c.statics[f[0].toLowerCase()] = m; c.svals[f[0]] = wz.zero(f[1]); }
        else { c.fields[f[0].toLowerCase()] = m; c.flist.push(m); }
      });
      (d.methods || []).forEach(function (f) {
        c.methods[f[0].toLowerCase()] = { name: f[0], fn: f[1], access: f[2] || 'public', owner: c, stat: !!f[3] };
      });
      classes[c.lname] = c;
    };
    function cls(name) {
      var c = classes[String(name).toLowerCase()];
      if (!c) fail('noType', [name]);
      return c;
    }
    /** A new object of a class, its fields at their start values (the constructor runs after). */
    wz.make = function (name) {
      var c = cls(name), chain = [];
      if (c.abstract || c.iface) fail('abstractNew', [c.name]);
      for (var x = c; x; x = x.base) chain.unshift(x);
      var o = new WzObj(c.name);
      chain.forEach(function (x) { x.flist.forEach(function (f) { o.f[f.name] = wz.zero(f.type); }); });
      return o;
    };
    function member(c, k, kind) {
      var lk = String(k).toLowerCase();
      for (var x = c; x; x = x.base) { var m = x[kind][lk]; if (m) return m; }
      return null;
    }
    function canUse(m, ctx) {
      if (m.access === 'public') return true;
      var cc = ctx ? classes[String(ctx).toLowerCase()] : null;
      if (!cc) return false;
      if (m.access === 'private') return cc === m.owner;
      for (var x = cc; x; x = x.base) if (x === m.owner) return true;
      return false;
    }
    function check(m, ctx, k) {
      if (!canUse(m, ctx)) fail(m.access === 'private' ? 'privateMember' : 'protectedMember', [k, m.owner.name]);
    }
    /** obj.field (ctx: the class whose code asks, for private and protected) */
    wz.oget = function (o, k, ctx) {
      if (isNothing(o)) fail('nothingField', [k]);
      if (!isObj(o)) return wz.dot(o, k);
      var m = member(cls(o.$c), k, 'fields');
      if (!m) fail('noMember', [o.$c, k]);
      check(m, ctx, k);
      return o.f[m.name];
    };
    wz.oset = function (o, k, v, ctx) {
      if (isNothing(o)) fail('nothingField', [k]);
      if (!isObj(o)) return wz.set_dot(o, k, v);
      var m = member(cls(o.$c), k, 'fields');
      if (!m) fail('noMember', [o.$c, k]);
      check(m, ctx, k);
      o.f[m.name] = wz.conv(v, m.type);
      return o;
    };
    /** Class.field for static fields */
    wz.sfget = function (c, k, ctx) {
      var m = member(cls(c), k, 'statics');
      if (!m) fail('noMember', [c, k]);
      check(m, ctx, k);
      return m.owner.svals[m.name];
    };
    wz.sfset = function (c, k, v, ctx) {
      var m = member(cls(c), k, 'statics');
      if (!m) fail('noMember', [c, k]);
      check(m, ctx, k);
      m.owner.svals[m.name] = wz.conv(v, m.type);
    };
    /** obj.method(...): the method of the object's own class (or of the class it inherits from). */
    wz.vcall = function (o, k, args, ctx, fallback) {
      if (isObj(o)) {
        var m = member(cls(o.$c), k, 'methods');
        if (!m || m.stat) fail('noMethod', [o.$c, k]);
        check(m, ctx, k);
        return m.fn.apply(null, [o].concat(args));
      }
      if (isRef(o) && wz.ref_call) return wz.ref_call(o, k, args);
      if (fallback) return fallback.apply(null, [o].concat(args));
      if (isNothing(o)) fail('nothingMethod', [k]);
      fail('noMethod', [shortText(o), k]);
    };
    /** base.method(...) and Class.staticMethod(...): the method as written in that class. */
    wz.scall = function (c, k, self, args, ctx) {
      var m = member(cls(c), k, 'methods');
      if (!m) fail('noMethod', [c, k]);
      check(m, ctx, k);
      return m.fn.apply(null, m.stat ? args : [self].concat(args));
    };
    function toObj(v, name) {
      if (isNothing(v)) return null;
      // an object that came from the server (or the page) as JSON becomes an object again
      if (isRec(v) && typeof v.$class === 'string') v = wz.revive(v);
      if (!wz.is_a(v, 'C:' + name)) fail('notInstance', [shortText(v), name]);
      return v;
    }
    /** new Dog("Rex"): the object, made by the constructor of its class */
    wz.construct = function (name, args) {
      var c = cls(name), o = wz.make(name);
      var r = c.ctor ? c.ctor.apply(null, [o].concat(args || [])) : null;
      return r && typeof r.then === 'function' ? r.then(function () { return o; }) : o;
    };
    /** new Point { x = 1 } / new Button { text = "OK" }: set fields (or properties) after making it */
    wz.init_obj = function (o, values, ctx) {
      var go = function (obj) {
        Object.keys(values).forEach(function (k) { wz.set_dot(obj, k, values[k], ctx); });
        return obj;
      };
      return o && typeof o.then === 'function' ? o.then(go) : go(o);
    };
    /** Objects that came as JSON ({"$class": "Dog", ...}) become objects again. */
    wz.revive = function revive(v) {
      if (isList(v)) return v.map(revive);
      if (isRec(v)) {
        if (typeof v.$class === 'string' && classes[v.$class.toLowerCase()]) {
          var o = wz.make(v.$class);
          Object.keys(v).forEach(function (k) { if (k !== '$class') { var m = member(cls(v.$class), k, 'fields'); if (m) o.f[m.name] = revive(v[k]); } });
          return o;
        }
        var r = {};
        Object.keys(v).forEach(function (k) { r[k] = revive(v[k]); });
        return r;
      }
      return v;
    };

    /* ---- JSON ---- */

    wz.to_json = function (v) { return JSON.stringify(isNothing(v) ? null : v); };
    wz.from_json = function (s) {
      try { return JSON.parse(text(s)); } catch (e) { fail('notJson', [text(s).slice(0, 40)]); }
    };

    /* ---- errors, loops ---- */

    wz.errmsg = function (e) {
      if (!e) return '';
      if (typeof e === 'string') return e;
      if (e instanceof RangeError && /call stack/i.test(e.message)) return (MSG[wz.lang] || MSG.en).tooDeep;
      return e.message || String(e);
    };
    /** Remember where (file, line) an error happened - the innermost place wins. */
    wz.trace = function (e, file, line) {
      if (e && typeof e === 'object' && !e.wzFile) { e.wzFile = file; e.wzLine = line; }
      return e;
    };
    wz._t0 = Date.now();
    wz._n = 0;
    wz.loopLimit = 8000;
    /** Called in every loop of the test build: stops loops that never end. */
    wz.tick = function () {
      if (++wz._n % 2000 === 0 && Date.now() - wz._t0 > wz.loopLimit) {
        wz._t0 = Date.now();
        fail('loopTooLong');
      }
    };
    wz.reset_clock = function () { wz._t0 = Date.now(); };
    wz.wait = function (ms) {
      return new Promise(function (res) {
        setTimeout(function () { wz.reset_clock(); res(); }, Math.max(0, num(ms)));
      });
    };
    /** How print shows a value (nothing and empty lists are visible). */
    wz.repr = function (v) {
      if (isNothing(v)) return 'nothing';
      if (isList(v) && !v.length) return '[]';
      if (isRec(v) && !Object.keys(v).length) return '{}';
      return text(v);
    };
    wz.print = function (v) { if (typeof console !== 'undefined') console.log(wz.repr(v)); };

    return wz;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = W.runtime.core;
})(typeof window !== 'undefined' ? window : globalThis);
