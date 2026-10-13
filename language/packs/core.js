/*!
 * Wemazy Script - core language pack (English)
 * --------------------------------------------
 * This file IS the language: every keyword, command and built-in function of
 * Wemazy Script is described here as data. To change or extend the language,
 * edit this file or (better) make your own pack - see CONTRIBUTING.md.
 *
 * vocab      canonical word -> the phrases people may write for it
 * commands   whole-line commands. Pattern slots:
 *              {name}          any value
 *              {name:target}   something to store into (a variable, Label1.text...)
 *              {name:control}  a control on the page (Button1)
 *              {name:page}     a page of the site (About)
 *            Templates: js = in the page, php = on the server, sim = the browser test
 *            server (defaults to js). A missing php means "only in the page".
 * functions  name(...) functions. {0}, {1}... are the values given; {args} = all.
 *            params ending in ? are optional, "...name" takes any number.
 */
(function (root) {
  'use strict';
  var W = root.Wemazy = root.Wemazy || {};
  var pack = {
    id: 'core',
    name: 'Wemazy core',
    version: '1.0.0',
    author: 'Wemazy',
    builtin: true,
    description: {
      en: 'The words, commands and functions every Wemazy project uses.',
      ro: 'Cuvintele, comenzile și funcțiile folosite de orice proiect Wemazy.'
    },

    vocab: {
      en: {
        // statements
        'set': ['set'],
        'to': ['to'],
        'increase': ['increase'],
        'decrease': ['decrease'],
        'by': ['by'],
        'if': ['if'],
        'then': ['then'],
        'else': ['else', 'otherwise'],
        'end': ['end'],
        'repeat': ['repeat'],
        'do': ['do'],
        'switch': ['switch'],
        'case': ['case'],
        'default': ['default'],
        'times': ['times', 'time'],
        'while': ['while'],
        'until': ['until'],
        'forever': ['forever'],
        'for': ['for'],
        'foreach': ['foreach'],
        'each': ['each'],
        'in': ['in'],
        'from': ['from'],
        'step': ['step'],
        'function': ['function'],
        'server': ['server'],
        'return': ['return'],
        'when': ['when'],
        'every': ['every'],
        'seconds': ['seconds', 'second', 'sec'],
        'milliseconds': ['milliseconds', 'millisecond', 'ms'],
        'minutes': ['minutes', 'minute'],
        'wait': ['wait'],
        'stop': ['stop', 'break'],
        'skip': ['skip', 'continue'],
        'print': ['print'],
        'add': ['add'],
        'remove': ['remove'],
        'clear': ['clear'],
        'try': ['try'],
        'onerror': ['on error', 'if error', 'if it fails', 'catch'],
        'var': ['var', 'let', 'const'],
        // values
        'true': ['true', 'yes'],
        'false': ['false', 'no'],
        'nothing': ['nothing', 'null'],
        // operators
        // in capitals (AND, OR...) they decide true or false; in small letters (and, or...) they work bit by bit
        'and': ['and'],
        'or': ['or'],
        'not': ['not'],
        'xor': ['xor'],
        'nand': ['nand'],
        'nor': ['nor'],
        'xnor': ['xnor'],
        'shl': ['shl'],
        'shr': ['shr'],
        'mod': ['mod'],
        'is': ['is'],
        'isnot': ['is not'],
        'eq': ['is equal to', 'equals'],
        'gt': ['is greater than', 'is more than', 'is bigger than'],
        'lt': ['is less than', 'is smaller than'],
        'ge': ['is at least'],
        'le': ['is at most'],
        'contains': ['contains'],
        'startswith': ['starts with', 'begins with'],
        'endswith': ['ends with'],
        'isempty': ['is empty'],
        'isnotempty': ['is not empty'],
        // database
        'find': ['find'],
        'all': ['all'],
        'first': ['first'],
        'where': ['where'],
        'orderby': ['order by', 'sorted by', 'sort by'],
        'descending': ['descending', 'desc'],
        'ascending': ['ascending', 'asc'],
        'limit': ['limit'],
        'count': ['count'],
        'random': ['random'],
        'update': ['update'],
        'delete': ['delete'],
        // events
        'pageloads': ['page loads', 'the page loads', 'page opens', 'page is loaded'],
        'keypressed': ['key pressed', 'a key is pressed', 'key is pressed', 'any key pressed'],
        'ev.click': ['clicked', 'click'],
        'ev.dblclick': ['double clicked', 'double click'],
        'ev.change': ['changed', 'changes'],
        'ev.enter': ['enter pressed', 'enter is pressed'],
        'ev.mouseenter': ['mouse enters', 'hovered', 'mouse over'],
        'ev.mouseleave': ['mouse leaves', 'mouse out'],
        'ev.focus': ['focused', 'gets focus'],
        'ev.blur': ['unfocused', 'loses focus'],
        'ev.ended': ['ended', 'finished'],
        // special objects and variables
        'obj.page': ['page'],
        'obj.session': ['session'],
        'var.key': ['key'],
        'var.error': ['error'],
        // properties of controls (Button1.text ...)
        'prop.text': ['text'],
        'prop.visible': ['visible'],
        'prop.enabled': ['enabled'],
        'prop.color': ['color', 'colour'],
        'prop.background': ['background'],
        'prop.size': ['size', 'fontsize'],
        'prop.bold': ['bold'],
        'prop.italic': ['italic'],
        'prop.width': ['width'],
        'prop.height': ['height'],
        'prop.x': ['x', 'left'],
        'prop.y': ['y', 'top'],
        'prop.opacity': ['opacity'],
        'prop.tooltip': ['tooltip', 'hint'],
        'prop.source': ['source', 'image', 'src'],
        'prop.link': ['link', 'url', 'address'],
        'prop.value': ['value'],
        'prop.checked': ['checked'],
        'prop.selected': ['selected', 'selection'],
        'prop.index': ['index', 'selectedindex'],
        'prop.options': ['options'],
        'prop.items': ['items'],
        'prop.data': ['data', 'rows'],
        'prop.placeholder': ['placeholder'],
        'prop.min': ['min', 'minimum'],
        'prop.max': ['max', 'maximum'],
        'prop.html': ['html'],
        'prop.title': ['title'],
        'prop.name': ['name'],
        'prop.count': ['count'],
        'prop.align': ['align', 'alignment'],
        'prop.radius': ['radius', 'corners'],
        'prop.border': ['border'],
        'prop.playing': ['playing'],
        'prop.columns': ['columns']
      }
    },

    commands: [
      {
        id: 'message', patterns: { en: ['show message {text}', 'say {text}', 'alert {text}'] }, call: ['message', 'alert', 'showMessage'],
        js: 'wz.message({text})', async: true,
        doc: { en: 'Shows a message in a small window and waits until it is closed.', ro: 'Arată un mesaj într-o fereastră mică și așteaptă să fie închis.' },
        example: { en: 'message("Hello, " + NameBox.text)' }
      },
      {
        id: 'toast', patterns: { en: ['show notice {text}', 'notify {text}'] }, call: ['notice', 'toast', 'notify'],
        js: 'wz.toast({text})',
        doc: { en: 'Shows a short notice in a corner of the page for a few seconds. The code goes on at once.', ro: 'Arată câteva secunde o notificare într-un colț al paginii. Codul merge mai departe imediat.' },
        example: { en: 'notice("Saved!")' }
      },
      {
        id: 'show', patterns: { en: ['show {control:control}'] }, method: ['show'],
        js: 'wz.show({control})',
        doc: { en: 'Makes a hidden control visible again.', ro: 'Face din nou vizibil un control ascuns.' },
        example: { en: 'Panel1.show()' }
      },
      {
        id: 'hide', patterns: { en: ['hide {control:control}'] }, method: ['hide'],
        js: 'wz.hide({control})',
        doc: { en: 'Hides a control (it keeps its place in the code, you can show it again).', ro: 'Ascunde un control (îl poți arăta din nou).' },
        example: { en: 'Button1.hide()' }
      },
      {
        id: 'enable', patterns: { en: ['enable {control:control}'] }, method: ['enable'],
        js: 'wz.set({control}, "enabled", true)',
        doc: { en: 'Lets people use a control again.', ro: 'Controlul poate fi folosit din nou.' },
        example: { en: 'SendButton.enable()' }
      },
      {
        id: 'disable', patterns: { en: ['disable {control:control}'] }, method: ['disable'],
        js: 'wz.set({control}, "enabled", false)',
        doc: { en: 'Greys out a control so it cannot be clicked or typed in.', ro: 'Controlul devine gri și nu mai poate fi apăsat sau completat.' },
        example: { en: 'SendButton.disable()' }
      },
      {
        id: 'goto', patterns: { en: ['go to page {page:page}', 'open page {page:page}', 'go to {page:page}'] }, call: ['goTo', 'openPage'],
        js: 'wz.go({page})',
        doc: { en: 'Opens another page of your site.', ro: 'Deschide altă pagină a site-ului.' },
        example: { en: 'goTo("About")' }
      },
      {
        id: 'back', patterns: { en: ['go back'] }, call: ['goBack', 'back'],
        js: 'wz.back()',
        doc: { en: 'Goes back to the page you were on before.', ro: 'Revine la pagina de dinainte.' },
        example: { en: 'goBack()' }
      },
      {
        id: 'openlink', patterns: { en: ['open link {url}', 'open website {url}'] }, call: ['openLink', 'openUrl'],
        js: 'wz.open_link({url})',
        doc: { en: 'Opens a web address in a new tab.', ro: 'Deschide o adresă web într-o filă nouă.' },
        example: { en: 'openLink("https://wikipedia.org")' }
      },
      {
        id: 'ask', patterns: { en: ['ask {question} into {answer:target}', 'ask {question} and save in {answer:target}'] }, call: ['ask', 'prompt', 'input'],
        js: 'wz.ask({question})', async: true,
        doc: { en: 'Asks a question in a small window and gives back the answer.', ro: 'Pune o întrebare într-o fereastră mică și dă înapoi răspunsul.' },
        example: { en: 'var name = ask("What is your name?")' }
      },
      {
        id: 'confirm', patterns: { en: ['confirm {question} into {answer:target}'] }, call: ['confirm'],
        js: 'wz.confirm({question})', async: true,
        doc: { en: 'Asks a yes/no question. The answer is true (yes) or false (no).', ro: 'Pune o întrebare cu da/nu. Răspunsul este true (da) sau false (nu).' },
        example: { en: 'if (confirm("Delete everything?")) {\n    list.clear()\n}' }
      },
      {
        id: 'sound', patterns: { en: ['play sound {url}'] }, call: ['playSound'],
        js: 'wz.sound({url})',
        doc: { en: 'Plays a sound file (an address or an asset of your project).', ro: 'Redă un fișier audio (o adresă sau un fișier din proiect).' },
        example: { en: 'playSound("ding.mp3")' }
      },
      {
        id: 'speak', patterns: { en: ['speak {text}'] }, call: ['speak'],
        js: 'wz.speak({text})',
        doc: { en: 'Reads a text aloud with the voice of the computer.', ro: 'Citește un text cu voce tare, cu vocea calculatorului.' },
        example: { en: 'speak("Well done!")' }
      },
      {
        id: 'scroll', patterns: { en: ['scroll to {control:control}'] }, method: ['scrollTo', 'scrollIntoView'],
        js: 'wz.scroll_to({control})',
        doc: { en: 'Scrolls the page until a control is in view.', ro: 'Derulează pagina până se vede controlul.' },
        example: { en: 'ContactSection.scrollTo()' }
      },
      {
        id: 'focus', patterns: { en: ['focus on {control:control}', 'focus {control:control}'] }, method: ['focus'],
        js: 'wz.focus({control})',
        doc: { en: 'Puts the cursor in a text box (or selects a control).', ro: 'Pune cursorul într-o casetă de text.' },
        example: { en: 'NameBox.focus()' }
      },
      {
        id: 'remember', patterns: { en: ['remember {value} as {key}'] }, call: ['remember'], callArgs: ['key', 'value'],
        js: 'wz.remember({key}, {value})',
        doc: { en: 'Keeps a value in this browser under a name, even after the page is closed. Get it back with recall(name).', ro: 'Păstrează o valoare în acest browser sub un nume, chiar și după ce pagina e închisă. O iei înapoi cu recall(nume).' },
        example: { en: 'remember("best score", score)' }
      },
      {
        id: 'forget', patterns: { en: ['forget {key}'] }, call: ['forget'],
        js: 'wz.forget({key})',
        doc: { en: 'Forgets a value kept with remember.', ro: 'Uită o valoare păstrată cu remember.' },
        example: { en: 'forget("best score")' }
      }
    ],

    functions: [
      // ---- text ----
      { id: 'upper', names: { en: ['upper', 'uppercase'] }, methods: ['toUpper', 'toUpperCase'], changes: true, params: ['text'], js: 'wz.upper({0})', php: 'wz_upper({0})', returns: 'text', group: 'text',
        doc: { en: 'The text in CAPITAL letters.', ro: 'Textul cu LITERE MARI.' }, example: { en: 'upper("hello") → "HELLO"' } },
      { id: 'lower', names: { en: ['lower', 'lowercase'] }, methods: ['toLower', 'toLowerCase'], changes: true, params: ['text'], js: 'wz.lower({0})', php: 'wz_lower({0})', returns: 'text', group: 'text',
        doc: { en: 'The text in small letters.', ro: 'Textul cu litere mici.' }, example: { en: 'lower("HeLLo") → "hello"' } },
      { id: 'capitalize', names: { en: ['capitalize'] }, changes: true, params: ['text'], js: 'wz.capitalize({0})', php: 'wz_capitalize({0})', returns: 'text', group: 'text',
        doc: { en: 'The text with its first letter in capital.', ro: 'Textul cu prima literă mare.' }, example: { en: 'capitalize("ana") → "Ana"' } },
      { id: 'trim', names: { en: ['trim'] }, changes: true, params: ['text'], js: 'wz.trim({0})', php: 'wz_trim({0})', returns: 'text', group: 'text',
        doc: { en: 'The text without spaces at the start and end.', ro: 'Textul fără spațiile de la început și de la sfârșit.' }, example: { en: 'trim("  hi  ") → "hi"' } },
      { id: 'length', names: { en: ['length', 'len'] }, methods: ['length', 'size', 'count'], params: ['value'], js: 'wz.len({0})', php: 'wz_len({0})', returns: 'num', group: 'text',
        doc: { en: 'How many letters a text has, or how many items a list has.', ro: 'Câte litere are un text sau câte elemente are o listă.' }, example: { en: 'length("cat") → 3\nNameBox.text.length() → how many letters were typed' } },
      { id: 'replace', names: { en: ['replace'] }, methods: ['replace', 'replaceAll'], changes: true, params: ['text', 'find', 'with'], js: 'wz.replace({0}, {1}, {2})', php: 'wz_replace({0}, {1}, {2})', returns: 'text', group: 'text',
        doc: { en: 'The text with every "find" changed into "with".', ro: 'Textul în care fiecare „find” devine „with”.' }, example: { en: 'replace("a-b-c", "-", " ") → "a b c"' } },
      { id: 'split', names: { en: ['split'] }, params: ['text', 'separator?'], js: 'wz.split({0}, {1})', php: 'wz_split({0}, {1})', returns: 'list', group: 'text',
        doc: { en: 'Cuts a text into a list at each separator (a comma if you give none).', ro: 'Taie un text într-o listă la fiecare separator (virgulă dacă nu dai niciunul).' }, example: { en: 'split("red, green", ",") → ["red", "green"]' } },
      { id: 'join', names: { en: ['join'] }, params: ['list', 'separator?'], js: 'wz.join({0}, {1})', php: 'wz_join({0}, {1})', returns: 'text', group: 'text',
        doc: { en: 'Glues the items of a list into one text (with ", " between them if you give no separator).', ro: 'Lipește elementele unei liste într-un singur text (cu ", " între ele dacă nu dai separator).' }, example: { en: 'join(["a", "b"], " + ") → "a + b"' } },
      { id: 'part', names: { en: ['part', 'substring', 'mid'] }, methods: ['substring', 'substr'], params: ['text', 'start', 'count?'], js: 'wz.part({0}, {1}, {2})', php: 'wz_part({0}, {1}, {2})', returns: 'any', group: 'text',
        doc: { en: 'A piece of a text or list: from position start (1 = the first), count letters/items long.', ro: 'O bucată dintr-un text sau dintr-o listă: de la poziția start (1 = primul), lungă de „count”.' }, example: { en: 'part("Wemazy", 1, 2) → "We"' } },
      { id: 'position', names: { en: ['position', 'indexOf'] }, methods: ['indexOf'], params: ['where', 'what'], js: 'wz.position({0}, {1})', php: 'wz_position({0}, {1})', returns: 'num', group: 'text',
        doc: { en: 'Where something is inside a text or list (1 = first). 0 if it is not there.', ro: 'Unde se află ceva într-un text sau într-o listă (1 = primul). 0 dacă nu e acolo.' }, example: { en: 'position("banana", "n") → 3' } },
      { id: 'isempty', names: { en: ['isEmpty', 'empty'] }, methods: ['empty', 'isEmpty'], params: ['value'], js: 'wz.is_empty({0})', php: 'wz_is_empty({0})', returns: 'bool', group: 'text',
        doc: { en: 'true if a text has nothing in it (or only spaces), or if a list has no items.', ro: 'true dacă un text nu are nimic în el (sau doar spații) sau dacă o listă nu are elemente.' }, example: { en: 'if (NameBox.text.empty()) {\n    message("Write your name")\n}' } },
      { id: 'contains', names: { en: ['contains', 'includes'] }, params: ['where', 'what'], js: 'wz.contains({0}, {1})', php: 'wz_contains({0}, {1})', returns: 'bool', group: 'text',
        doc: { en: 'true if a text has another text in it (capital letters don\'t matter), or a list has an item.', ro: 'true dacă un text conține alt text (literele mari nu contează) sau o listă conține un element.' }, example: { en: '"Hello".contains("ell") → true' } },
      { id: 'startswith', names: { en: ['startsWith'] }, params: ['text', 'start'], js: 'wz.starts({0}, {1})', php: 'wz_starts({0}, {1})', returns: 'bool', group: 'text',
        doc: { en: 'true if a text starts with another one (capital letters don\'t matter).', ro: 'true dacă un text începe cu altul (literele mari nu contează).' }, example: { en: '"Wemazy".startsWith("we") → true' } },
      { id: 'endswith', names: { en: ['endsWith'] }, params: ['text', 'end'], js: 'wz.ends({0}, {1})', php: 'wz_ends({0}, {1})', returns: 'bool', group: 'text',
        doc: { en: 'true if a text ends with another one (capital letters don\'t matter).', ro: 'true dacă un text se termină cu altul (literele mari nu contează).' }, example: { en: '"photo.png".endsWith(".PNG") → true' } },
      { id: 'reverse', names: { en: ['reverse'] }, changes: true, params: ['value'], js: 'wz.reverse({0})', php: 'wz_reverse({0})', returns: 'any', group: 'text',
        doc: { en: 'A text or list backwards.', ro: 'Un text sau o listă de la coadă la cap.' }, example: { en: 'reverse("abc") → "cba"' } },
      { id: 'text', names: { en: ['text', 'totext'] }, methods: ['toString'], params: ['value'], js: 'wz.text({0})', php: 'wz_text({0})', returns: 'text', group: 'text',
        doc: { en: 'Any value written as text.', ro: 'Orice valoare scrisă ca text.' }, example: { en: 'text(3.50) → "3.5"' } },
      { id: 'format', names: { en: ['format', 'decimals'] }, methods: ['format', 'toFixed'], params: ['number', 'decimals'], js: 'wz.format({0}, {1})', php: 'wz_format({0}, {1})', returns: 'text', group: 'number',
        doc: { en: 'A number written with an exact number of decimals.', ro: 'Un număr scris cu un număr exact de zecimale.' }, example: { en: 'format(3.5, 2) → "3.50"' } },

      // ---- numbers ----
      { id: 'number', names: { en: ['number', 'tonumber'] }, methods: ['toNumber'], params: ['value'], js: 'wz.num({0})', php: 'wz_num({0})', returns: 'num', group: 'number',
        doc: { en: 'Turns a text like "12" or "3,5" into a number.', ro: 'Transformă un text ca "12" sau "3,5" în număr.' }, example: { en: 'number("12") + 1 → 13' } },
      { id: 'isnumber', names: { en: ['isNumber'] }, params: ['value'], js: 'wz.is_number({0})', php: 'wz_is_number({0})', returns: 'bool', group: 'number',
        doc: { en: 'true if the value is a number (or a text with a number in it).', ro: 'true dacă valoarea este un număr (sau un text cu un număr).' }, example: { en: 'isNumber("12") → true' } },
      { id: 'round', names: { en: ['round'] }, params: ['number', 'decimals?'], js: 'wz.round({0}, {1})', php: 'wz_round({0}, {1})', returns: 'num', group: 'number',
        doc: { en: 'Rounds a number (to whole numbers, or to some decimals).', ro: 'Rotunjește un număr (la întregi sau la câteva zecimale).' }, example: { en: 'round(3.456, 2) → 3.46' } },
      { id: 'floor', names: { en: ['floor', 'rounddown'] }, params: ['number'], js: 'wz.floor({0})', php: 'wz_floor({0})', returns: 'num', group: 'number',
        doc: { en: 'Rounds down to a whole number.', ro: 'Rotunjește în jos, la un număr întreg.' }, example: { en: 'floor(3.9) → 3' } },
      { id: 'ceil', names: { en: ['ceil', 'ceiling', 'roundup'] }, params: ['number'], js: 'wz.ceil({0})', php: 'wz_ceil({0})', returns: 'num', group: 'number',
        doc: { en: 'Rounds up to a whole number.', ro: 'Rotunjește în sus, la un număr întreg.' }, example: { en: 'ceil(3.1) → 4' } },
      { id: 'abs', names: { en: ['abs'] }, params: ['number'], js: 'wz.abs({0})', php: 'wz_abs({0})', returns: 'num', group: 'number',
        doc: { en: 'The number without its minus sign.', ro: 'Numărul fără semnul minus.' }, example: { en: 'abs(-5) → 5' } },
      { id: 'sqrt', names: { en: ['sqrt', 'squareroot'] }, params: ['number'], js: 'wz.sqrt({0})', php: 'wz_sqrt({0})', returns: 'num', group: 'number',
        doc: { en: 'The square root.', ro: 'Rădăcina pătrată.' }, example: { en: 'sqrt(16) → 4' } },
      { id: 'power', names: { en: ['power', 'pow'] }, params: ['number', 'exponent'], js: 'wz.pow({0}, {1})', php: 'wz_pow({0}, {1})', returns: 'num', group: 'number',
        doc: { en: 'A number to a power (you can also write 2 ^ 3).', ro: 'Un număr la o putere (poți scrie și 2 ^ 3).' }, example: { en: 'power(2, 3) → 8' } },
      { id: 'random', names: { en: ['random'] }, params: ['from?', 'to?'], js: 'wz.random({0}, {1})', php: 'wz_random({0}, {1})', returns: 'num', group: 'number',
        doc: { en: 'A random whole number: random(6) is 1 to 6, random(5, 10) is 5 to 10, random() is a decimal from 0 to 1.', ro: 'Un număr întreg la întâmplare: random(6) e de la 1 la 6, random(5, 10) de la 5 la 10, random() o zecimală între 0 și 1.' }, example: { en: 'random(1, 6) → 4' } },
      { id: 'min', names: { en: ['min', 'smallest'] }, params: ['...values'], js: 'wz.min({args})', php: 'wz_min({args})', returns: 'num', group: 'number',
        doc: { en: 'The smallest of some numbers, or of a list.', ro: 'Cel mai mic dintre niște numere sau dintr-o listă.' }, example: { en: 'min(4, 2, 9) → 2' } },
      { id: 'max', names: { en: ['max', 'biggest', 'largest'] }, params: ['...values'], js: 'wz.max({args})', php: 'wz_max({args})', returns: 'num', group: 'number',
        doc: { en: 'The biggest of some numbers, or of a list.', ro: 'Cel mai mare dintre niște numere sau dintr-o listă.' }, example: { en: 'max([4, 2, 9]) → 9' } },
      { id: 'pi', names: { en: ['pi'] }, params: [], js: 'Math.PI', php: 'M_PI', returns: 'num', group: 'number',
        doc: { en: 'The number π (3.14159...).', ro: 'Numărul π (3,14159...).' }, example: { en: 'pi * 2' } },

      // ---- lists ----
      { id: 'sum', names: { en: ['sum', 'total'] }, params: ['list', 'field?'], js: 'wz.sum({0}, {1})', php: 'wz_sum({0}, {1})', returns: 'num', group: 'list',
        doc: { en: 'Adds up a list of numbers (or one field of a list of records).', ro: 'Adună o listă de numere (sau un câmp dintr-o listă de înregistrări).' }, example: { en: 'sum(find all Orders, "price")' } },
      { id: 'average', names: { en: ['average', 'avg', 'mean'] }, params: ['list', 'field?'], js: 'wz.average({0}, {1})', php: 'wz_average({0}, {1})', returns: 'num', group: 'list',
        doc: { en: 'The average of a list of numbers (or of one field).', ro: 'Media unei liste de numere (sau a unui câmp).' }, example: { en: 'average([4, 6]) → 5' } },
      { id: 'first', names: { en: ['first'] }, params: ['list'], js: 'wz.first({0})', php: 'wz_first({0})', returns: 'any', group: 'list',
        doc: { en: 'The first item of a list (or letter of a text).', ro: 'Primul element al unei liste (sau prima literă a unui text).' }, example: { en: 'first(["a", "b"]) → "a"' } },
      { id: 'last', names: { en: ['last'] }, params: ['list'], js: 'wz.last({0})', php: 'wz_last({0})', returns: 'any', group: 'list',
        doc: { en: 'The last item of a list (or letter of a text).', ro: 'Ultimul element al unei liste (sau ultima literă a unui text).' }, example: { en: 'last(["a", "b"]) → "b"' } },
      { id: 'pick', names: { en: ['pick', 'randomItem'] }, params: ['list'], js: 'wz.pick({0})', php: 'wz_pick({0})', returns: 'any', group: 'list',
        doc: { en: 'One item of a list, chosen at random.', ro: 'Un element al listei, ales la întâmplare.' }, example: { en: 'pick(["rock", "paper", "scissors"])' } },
      { id: 'shuffle', names: { en: ['shuffle'] }, changes: true, params: ['list'], js: 'wz.shuffle({0})', php: 'wz_shuffle({0})', returns: 'list', group: 'list',
        doc: { en: 'The list in a random order.', ro: 'Lista în ordine întâmplătoare.' }, example: { en: 'shuffle([1, 2, 3])' } },
      { id: 'sort', names: { en: ['sort', 'sorted'] }, changes: true, params: ['list', 'field?', 'descending?'], js: 'wz.sort({0}, {1}, {2})', php: 'wz_sort({0}, {1}, {2})', returns: 'list', group: 'list',
        doc: { en: 'The list in order (A→Z, 1→9). Give a field name for records, and true to sort backwards.', ro: 'Lista în ordine (A→Z, 1→9). Dă un nume de câmp pentru înregistrări și true pentru ordine inversă.' }, example: { en: 'sort(players, "score", true)' } },
      { id: 'range', names: { en: ['range', 'numbers'] }, params: ['from', 'to'], js: 'wz.range_list({0}, {1})', php: 'wz_range_list({0}, {1})', returns: 'list', group: 'list',
        doc: { en: 'A list of whole numbers from one number to another.', ro: 'O listă de numere întregi de la un număr la altul.' }, example: { en: 'range(1, 5) → [1, 2, 3, 4, 5]' } },
      { id: 'unique', names: { en: ['unique'] }, changes: true, params: ['list'], js: 'wz.unique({0})', php: 'wz_unique({0})', returns: 'list', group: 'list',
        doc: { en: 'The list without repeated items.', ro: 'Lista fără elemente repetate.' }, example: { en: 'unique([1, 1, 2]) → [1, 2]' } },
      { id: 'keys', names: { en: ['keys', 'fields'] }, params: ['record'], js: 'wz.keys({0})', php: 'wz_keys({0})', returns: 'list', group: 'list',
        doc: { en: 'The field names of a record.', ro: 'Numele câmpurilor unei înregistrări.' }, example: { en: 'keys({name: "Ana", age: 12}) → ["name", "age"]' } },
      { id: 'has', names: { en: ['has'] }, methods: ['has', 'containsKey', 'hasKey'], params: ['record', 'field'], js: 'wz.has({0}, {1})', php: 'wz_has({0}, {1})', returns: 'bool', group: 'list',
        doc: { en: 'true if a record has a field with that name.', ro: 'true dacă înregistrarea are un câmp cu acel nume.' }, example: { en: 'has(person, "email")' } },

      // ---- date and time ----
      { id: 'now', names: { en: ['now'] }, params: [], js: 'wz.now()', php: 'wz_now()', returns: 'text', group: 'time',
        doc: { en: 'The date and time now, like "2026-10-13 08:55:12".', ro: 'Data și ora de acum, de exemplu "2026-10-13 08:55:12".' }, example: { en: 'Label1.text = now' } },
      { id: 'today', names: { en: ['today'] }, params: [], js: 'wz.today()', php: 'wz_today()', returns: 'text', group: 'time',
        doc: { en: 'Today\'s date, like "2026-10-13".', ro: 'Data de azi, de exemplu "2026-10-13".' }, example: { en: 'today' } },
      { id: 'time', names: { en: ['time', 'clock'] }, params: [], js: 'wz.time()', php: 'wz_time()', returns: 'text', group: 'time',
        doc: { en: 'The time now, like "08:55".', ro: 'Ora de acum, de exemplu "08:55".' }, example: { en: 'ClockLabel.text = time' } },
      { id: 'year', names: { en: ['year'] }, params: ['date?'], js: 'wz.date_part({0}, "y")', php: 'wz_date_part({0}, \'y\')', returns: 'num', group: 'time',
        doc: { en: 'The year of a date (of today if you give none).', ro: 'Anul unei date (al zilei de azi dacă nu dai niciuna).' }, example: { en: 'year("2026-10-13") → 2026' } },
      { id: 'month', names: { en: ['month'] }, params: ['date?'], js: 'wz.date_part({0}, "m")', php: 'wz_date_part({0}, \'m\')', returns: 'num', group: 'time',
        doc: { en: 'The month of a date, 1 to 12.', ro: 'Luna unei date, de la 1 la 12.' }, example: { en: 'month(today)' } },
      { id: 'day', names: { en: ['day'] }, params: ['date?'], js: 'wz.date_part({0}, "d")', php: 'wz_date_part({0}, \'d\')', returns: 'num', group: 'time',
        doc: { en: 'The day of the month of a date, 1 to 31.', ro: 'Ziua din lună a unei date, de la 1 la 31.' }, example: { en: 'day(today)' } },
      { id: 'weekday', names: { en: ['weekday'] }, params: ['date?'], js: 'wz.date_part({0}, "w")', php: 'wz_date_part({0}, \'w\')', returns: 'num', group: 'time',
        doc: { en: 'The day of the week, 1 (Monday) to 7 (Sunday).', ro: 'Ziua săptămânii, de la 1 (luni) la 7 (duminică).' }, example: { en: 'if (weekday(today) > 5) message("Weekend!")' } },
      { id: 'hour', names: { en: ['hour'] }, params: [], js: 'wz.date_part(null, "h")', php: 'wz_date_part(null, \'h\')', returns: 'num', group: 'time',
        doc: { en: 'The hour now, 0 to 23.', ro: 'Ora de acum, de la 0 la 23.' }, example: { en: 'if (hour < 12) message("Good morning")' } },
      { id: 'minute', names: { en: ['minute'] }, params: [], js: 'wz.date_part(null, "i")', php: 'wz_date_part(null, \'i\')', returns: 'num', group: 'time',
        doc: { en: 'The minute now, 0 to 59.', ro: 'Minutul de acum, de la 0 la 59.' }, example: { en: 'minute' } },
      { id: 'second', names: { en: ['second'] }, params: [], js: 'wz.date_part(null, "s")', php: 'wz_date_part(null, \'s\')', returns: 'num', group: 'time',
        doc: { en: 'The second now, 0 to 59.', ro: 'Secunda de acum, de la 0 la 59.' }, example: { en: 'second' } },
      { id: 'daysbetween', names: { en: ['daysBetween'] }, params: ['date1', 'date2'], js: 'wz.days_between({0}, {1})', php: 'wz_days_between({0}, {1})', returns: 'num', group: 'time',
        doc: { en: 'How many days from one date to another.', ro: 'Câte zile sunt de la o dată la alta.' }, example: { en: 'daysBetween(today, "2026-12-25")' } },
      { id: 'adddays', names: { en: ['addDays'] }, params: ['date', 'days'], js: 'wz.add_days({0}, {1})', php: 'wz_add_days({0}, {1})', returns: 'text', group: 'time',
        doc: { en: 'The date some days later (or earlier, with a minus).', ro: 'Data de peste câteva zile (sau de dinainte, cu minus).' }, example: { en: 'addDays(today, 7)' } },

      // ---- data and the web ----
      { id: 'fetch', names: { en: ['fetch', 'download'] }, params: ['address'], js: 'wz.fetch({0})', php: 'wz_fetch({0})', async: true, returns: 'any', group: 'web',
        doc: { en: 'Downloads a web address. JSON comes back as lists and records, anything else as text.', ro: 'Descarcă o adresă web. JSON-ul vine ca liste și înregistrări, orice altceva ca text.' }, example: { en: 'var data = fetch("https://api.example.com/today.json")' } },
      { id: 'tojson', names: { en: ['toJson'] }, params: ['value'], js: 'wz.to_json({0})', php: 'wz_to_json({0})', returns: 'text', group: 'web',
        doc: { en: 'A value written as JSON text.', ro: 'O valoare scrisă ca text JSON.' }, example: { en: 'toJson({a: 1}) → "{\\"a\\":1}"' } },
      { id: 'fromjson', names: { en: ['fromJson'] }, params: ['text'], js: 'wz.from_json({0})', php: 'wz_from_json({0})', returns: 'any', group: 'web',
        doc: { en: 'Reads JSON text into lists and records.', ro: 'Citește un text JSON ca liste și înregistrări.' }, example: { en: 'fromJson("[1, 2]")' } },
      { id: 'recall', names: { en: ['recall'] }, params: ['name'], js: 'wz.recall({0})', returns: 'any', group: 'web',
        doc: { en: 'A value kept in this browser with remember (nothing if there is none).', ro: 'O valoare păstrată în acest browser cu remember (nimic dacă nu există).' }, example: { en: 'var best = recall("best score")' } },

      // ---- server only ----
      { id: 'hash', names: { en: ['hash', 'hashPassword'] }, params: ['password'], sim: 'wz.hash({0})', php: 'wz_hash({0})', async: true, returns: 'text', group: 'server',
        doc: { en: 'Server only. A safe scrambled form of a password, to keep in the database instead of the password.', ro: 'Doar pe server. O formă amestecată, sigură, a unei parole, de păstrat în baza de date în locul parolei.' }, example: { en: 'Users.add({name: name, password: hash(pass)})' } },
      { id: 'checkhash', names: { en: ['checkHash', 'checkPassword'] }, params: ['password', 'hash'], sim: 'wz.check_hash({0}, {1})', php: 'wz_check_hash({0}, {1})', async: true, returns: 'bool', group: 'server',
        doc: { en: 'Server only. true if a password matches a hash made with hash(...).', ro: 'Doar pe server. true dacă parola se potrivește cu ce a făcut hash(...).' }, example: { en: 'if (checkHash(pass, user.password)) {\n    session.user = user.name\n}' } },
      { id: 'sql', names: { en: ['sql'] }, params: ['query', 'values?'], sim: 'wz.sql({0}, {1})', php: 'wz_sql({0}, {1})', returns: 'any', group: 'server',
        doc: { en: 'Server only, PHP only. Runs your own SQL. Use ? for values and give them as a list.', ro: 'Doar pe server, doar în PHP. Rulează SQL scris de tine. Pune ? pentru valori și dă-le ca listă.' }, example: { en: 'var rows = sql("SELECT * FROM Users WHERE age > ?", [12])' } }
    ]
  };

  if (W.lang && W.lang.registerPack) W.lang.registerPack(pack);
  else (W.pendingPacks = W.pendingPacks || []).push(pack);
  if (typeof module !== 'undefined' && module.exports) module.exports = pack;
})(typeof window !== 'undefined' ? window : globalThis);
