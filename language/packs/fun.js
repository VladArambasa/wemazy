/*!
 * Wemazy Script - "Fun" pack (an example of a community pack)
 * ------------------------------------------------------------
 * Adds commands for games and animations: shake, spin, confetti, flash...
 * Turn it on in Tools > Language Lab (or Project > Settings > Language packs).
 *
 * Shows everything a pack can do:
 *   commands, functions (with descriptions in English and Romanian), and its own
 *   runtime code (runtime.js is added to the pages that use this pack).
 */
(function (root) {
  'use strict';
  var W = root.Wemazy = root.Wemazy || {};
  var pack = {
    id: 'fun',
    name: 'Fun',
    version: '1.0.0',
    author: 'Wemazy community',
    description: {
      en: 'Animations and little effects for games: shake, spin, bounce, confetti, flash, dice.',
      ro: 'Animații și efecte mici pentru jocuri: shake, spin, bounce, confetti, flash, dice.'
    },
    commands: [
      {
        id: 'fun.shake', patterns: { en: ['shake {control:control}'] }, method: ['shake'],
        js: 'wzFun.anim({control}, "shake")',
        doc: { en: 'Shakes a control for a moment (good for a wrong answer).', ro: 'Scutură puțin un control (bun pentru un răspuns greșit).' },
        example: { en: 'AnswerBox.shake()' }
      },
      {
        id: 'fun.spin', patterns: { en: ['spin {control:control}'] }, method: ['spin'],
        js: 'wzFun.anim({control}, "spin")',
        doc: { en: 'Turns a control once around.', ro: 'Rotește o dată un control.' },
        example: { en: 'Logo.spin()' }
      },
      {
        id: 'fun.bounce', patterns: { en: ['bounce {control:control}'] }, method: ['bounce'],
        js: 'wzFun.anim({control}, "bounce")',
        doc: { en: 'Makes a control jump.', ro: 'Face un control să sară.' },
        example: { en: 'StarImage.bounce()' }
      },
      {
        id: 'fun.flash', patterns: { en: ['flash {control:control}'] }, method: ['flash'],
        js: 'wzFun.anim({control}, "flash")',
        doc: { en: 'Makes a control blink twice.', ro: 'Face un control să clipească de două ori.' },
        example: { en: 'ScoreLabel.flash()' }
      },
      {
        id: 'fun.confetti', patterns: { en: ['throw confetti', 'confetti'] }, call: ['confetti', 'throwConfetti'],
        js: 'wzFun.confetti()',
        doc: { en: 'Confetti falls over the page. For a win!', ro: 'Cad confetti peste pagină. Pentru o victorie!' },
        example: { en: 'confetti()' }
      },
      {
        id: 'fun.move', patterns: { en: ['move {control:control} by {dx}, {dy}'] }, method: ['move', 'moveBy'],
        js: 'wzFun.move({control}, {dx}, {dy})',
        doc: { en: 'Moves a control some pixels right (dx) and down (dy). Use it in a free-form panel.', ro: 'Mută un control câțiva pixeli la dreapta (dx) și în jos (dy). Folosește-l într-un formular liber.' },
        example: { en: 'Player.move(10, 0)' }
      }
    ],
    functions: [
      { id: 'fun.dice', names: { en: ['dice'] }, params: ['sides?'], js: 'wzFun.dice({0})', php: 'wz_fun_dice({0})', returns: 'num',
        doc: { en: 'Throws a dice: a number from 1 to 6 (or to the number of sides you give).', ro: 'Aruncă un zar: un număr de la 1 la 6 (sau până la numărul de fețe dat).' },
        example: { en: 'Label1.text = dice()' } },
      { id: 'fun.touching', names: { en: ['touching'] }, params: ['control1', 'control2'], js: 'wzFun.touching({0}, {1})', returns: 'bool',
        doc: { en: 'true when two controls overlap on the screen (for games). Give their names as text.', ro: 'true când două controale se suprapun pe ecran (pentru jocuri). Dă-le numele ca text.' },
        example: { en: 'if (touching("Player", "Coin")) {\n    confetti()\n}' } }
    ],
    runtime: {
      js: [
        'window.wzFun = (function () {',
        '  var css = "@keyframes wzf-shake{0%,100%{transform:none}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}" +',
        '    "@keyframes wzf-spin{to{transform:rotate(360deg)}}@keyframes wzf-bounce{0%,100%{transform:none}40%{transform:translateY(-22px)}70%{transform:translateY(-8px)}}" +',
        '    "@keyframes wzf-flash{0%,50%,100%{opacity:1}25%,75%{opacity:.15}}" +',
        '    ".wzf-confetti{position:fixed;top:-12px;width:9px;height:14px;z-index:2147483002;pointer-events:none;animation:wzf-fall linear forwards}" +',
        '    "@keyframes wzf-fall{to{transform:translateY(110vh) rotate(720deg)}}";',
        '  var st = document.createElement("style"); st.textContent = css; (document.head || document.documentElement).appendChild(st);',
        '  function el(name) { return wz.el(name); }',
        '  return {',
        '    anim: function (name, kind) {',
        '      var e = el(name), t = { shake: ".5s", spin: ".8s", bounce: ".7s", flash: ".9s" }[kind];',
        '      e.style.animation = "none"; void e.offsetWidth; e.style.animation = "wzf-" + kind + " " + t + " ease";',
        '    },',
        '    confetti: function () {',
        '      var colors = ["#f2a93b", "#e11d48", "#16a34a", "#0ea5e9", "#9333ea", "#facc15"];',
        '      for (var i = 0; i < 90; i++) {',
        '        var c = document.createElement("div"); c.className = "wzf-confetti";',
        '        c.style.left = Math.random() * 100 + "vw"; c.style.background = colors[i % colors.length];',
        '        c.style.animationDuration = (1.8 + Math.random() * 1.6) + "s"; c.style.animationDelay = Math.random() * .6 + "s";',
        '        document.body.appendChild(c); setTimeout(function (x) { x.remove(); }.bind(null, c), 4200);',
        '      }',
        '    },',
        '    move: function (name, dx, dy) {',
        '      var e = el(name);',
        '      e.style.left = ((parseFloat(e.style.left) || e.offsetLeft) + wz.num(dx)) + "px";',
        '      e.style.top = ((parseFloat(e.style.top) || e.offsetTop) + wz.num(dy)) + "px";',
        '    },',
        '    dice: function (n) { return wz.random(n === undefined || n === null ? 6 : n); },',
        '    touching: function (a, b) {',
        '      var r1 = el(a).getBoundingClientRect(), r2 = el(b).getBoundingClientRect();',
        '      return !(r1.right < r2.left || r2.right < r1.left || r1.bottom < r2.top || r2.bottom < r1.top);',
        '    }',
        '  };',
        '})();'
      ].join('\n'),
      php: "function wz_fun_dice($n = null) { return wz_random($n === null ? 6 : $n); }"
    }
  };

  if (W.lang && W.lang.registerPack) W.lang.registerPack(pack);
  else (W.pendingPacks = W.pendingPacks || []).push(pack);
  if (typeof module !== 'undefined' && module.exports) module.exports = pack;
})(typeof window !== 'undefined' ? window : globalThis);
