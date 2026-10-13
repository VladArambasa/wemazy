/*!
 * Wemazy - language packs loaded when Wemazy starts.
 *
 * core.js (the words, commands and functions of Wemazy Script) is always loaded by index.html.
 * To add a community pack: put its .js file in this folder and add its name below.
 * Packs can also be imported from the Language Lab (Tools > Language Lab), without
 * touching any file.
 */
(function (root) {
  'use strict';
  var W = root.Wemazy = root.Wemazy || {};
  W.packFiles = [
    'fun.js'
  ];
})(typeof window !== 'undefined' ? window : globalThis);
