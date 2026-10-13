/*!
 * Wemazy IDE - making and reading .zip files (no libraries).
 */
(function (root) {
  'use strict';
  var W = root.Wemazy = root.Wemazy || {};

  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function toBytes(d) {
    if (d instanceof Uint8Array) return d;
    if (d instanceof ArrayBuffer) return new Uint8Array(d);
    return new TextEncoder().encode(String(d));
  }
  function dosTime(dt) {
    return {
      time: ((dt.getHours() & 31) << 11) | ((dt.getMinutes() & 63) << 5) | ((dt.getSeconds() / 2) & 31),
      date: (((dt.getFullYear() - 1980) & 127) << 9) | (((dt.getMonth() + 1) & 15) << 5) | (dt.getDate() & 31)
    };
  }
  function deflate(bytes) {
    if (typeof CompressionStream === 'undefined') return Promise.resolve(null);
    try {
      var cs = new CompressionStream('deflate-raw');
      var stream = new Blob([bytes]).stream().pipeThrough(cs);
      return new Response(stream).arrayBuffer().then(function (b) { return new Uint8Array(b); }, function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }
  function inflate(bytes) {
    var ds = new DecompressionStream('deflate-raw');
    var stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Response(stream).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  W.zip = {
    crc32: crc32,
    /**
     * files: [{ name: 'folder/file.txt', data: string | Uint8Array }]
     * Returns a Promise of a Blob (application/zip).
     */
    create: function (files, opts) {
      opts = opts || {};
      var now = dosTime(new Date());
      var enc = new TextEncoder();
      return Promise.all(files.map(function (f) {
        var raw = toBytes(f.data);
        var small = raw.length < 64;
        var job = (opts.compress === false || small || /\.(png|jpe?g|gif|webp|mp3|mp4|ogg|zip|woff2?)$/i.test(f.name))
          ? Promise.resolve(null) : deflate(raw);
        return job.then(function (comp) {
          var use = comp && comp.length < raw.length;
          return { name: enc.encode(f.name), raw: raw, data: use ? comp : raw, method: use ? 8 : 0, crc: crc32(raw) };
        });
      })).then(function (entries) {
        var parts = [], central = [], offset = 0;
        entries.forEach(function (e) {
          var h = new DataView(new ArrayBuffer(30));
          h.setUint32(0, 0x04034b50, true);
          h.setUint16(4, 20, true);
          h.setUint16(6, 0x0800, true);
          h.setUint16(8, e.method, true);
          h.setUint16(10, now.time, true);
          h.setUint16(12, now.date, true);
          h.setUint32(14, e.crc, true);
          h.setUint32(18, e.data.length, true);
          h.setUint32(22, e.raw.length, true);
          h.setUint16(26, e.name.length, true);
          h.setUint16(28, 0, true);
          parts.push(new Uint8Array(h.buffer), e.name, e.data);
          var c = new DataView(new ArrayBuffer(46));
          c.setUint32(0, 0x02014b50, true);
          c.setUint16(4, 20, true);
          c.setUint16(6, 20, true);
          c.setUint16(8, 0x0800, true);
          c.setUint16(10, e.method, true);
          c.setUint16(12, now.time, true);
          c.setUint16(14, now.date, true);
          c.setUint32(16, e.crc, true);
          c.setUint32(20, e.data.length, true);
          c.setUint32(24, e.raw.length, true);
          c.setUint16(28, e.name.length, true);
          c.setUint32(42, offset, true);
          central.push(new Uint8Array(c.buffer), e.name);
          offset += 30 + e.name.length + e.data.length;
        });
        var cdSize = central.reduce(function (s, p) { return s + p.length; }, 0);
        var end = new DataView(new ArrayBuffer(22));
        end.setUint32(0, 0x06054b50, true);
        end.setUint16(8, entries.length, true);
        end.setUint16(10, entries.length, true);
        end.setUint32(12, cdSize, true);
        end.setUint32(16, offset, true);
        return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/zip' });
      });
    },
    /** Read a zip (ArrayBuffer) -> Promise of [{ name, data: Uint8Array }] */
    read: function (buf) {
      var b = new Uint8Array(buf), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
      var eocd = -1;
      for (var i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
        if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
      }
      if (eocd < 0) return Promise.reject(new Error('not a zip file'));
      var count = dv.getUint16(eocd + 10, true);
      var p = dv.getUint32(eocd + 16, true);
      var dec = new TextDecoder();
      var jobs = [];
      for (var n = 0; n < count; n++) {
        if (dv.getUint32(p, true) !== 0x02014b50) break;
        var method = dv.getUint16(p + 10, true);
        var csize = dv.getUint32(p + 20, true);
        var nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
        var local = dv.getUint32(p + 42, true);
        var name = dec.decode(b.subarray(p + 46, p + 46 + nlen));
        var lnlen = dv.getUint16(local + 26, true), lxlen = dv.getUint16(local + 28, true);
        var start = local + 30 + lnlen + lxlen;
        var data = b.subarray(start, start + csize);
        (function (name, method, data) {
          if (/\/$/.test(name)) return;
          jobs.push((method === 8 ? inflate(data) : Promise.resolve(data)).then(function (d) { return { name: name, data: d }; }));
        })(name, method, data);
        p += 46 + nlen + xlen + clen;
      }
      return Promise.all(jobs);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
