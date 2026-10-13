# Changing and improving Wemazy

Wemazy Script belongs to the people who use it. Most of the language is **data**, so it can grow without touching the compiler:

1. **Language packs**: new commands, new functions, other ways to write a word.
2. **Interface translations**: the menus and windows of Wemazy in another language.
3. **The compiler and the runtimes**, for new kinds of statements.

The instructions of Wemazy Script are English words (`if`, `while`, `when`, `message`…), so code reads the same for everyone. Code can be written the C-like way (`if (x > 1) { … }`, `var`, `x++`, `name.toUpper()`, optional types like `int32`, `struct`, `class`) or with words (`if x > 1 then … end if`, `show message "Hi"`); the compiler reads both. Type names (`int32`, `class`, `public`…) are the same in every language and are not part of the packs. What gets translated is everything around the code: the interface, the descriptions of commands and functions, the Help, the error messages.

Nothing needs building: every file is plain JavaScript (or PHP) that runs as it is. Edit, reload the page, try it.

Română: [mai jos](#pe-scurt-în-română).

---

## 1. Language packs

A pack is one object. The easy way to make one is **Tools > Language Lab > New pack**: it writes the object for you, lets you try your commands, and **Download pack file** gives you a file to share. The file is plain JavaScript that also holds the pack as JSON, so it can be imported safely (Language Lab > Import pack) or dropped into `language/packs/` and added to `language/packs/list.js`.

The built-in packs are the best examples:

- `language/packs/core.js` - the words, the built-in commands and functions (described in English and Romanian)
- `language/packs/fun.js` - a community pack: commands, functions and its own runtime code

### The parts of a pack

```js
var pack = {
  id: 'weather',                 // letters, digits, . _ -
  name: 'Weather',
  version: '1.0.0',
  author: 'Your name',
  description: { en: 'What the pack adds.', ro: 'Ce adaugă pachetul.' },

  vocab: { ... },                // other ways to write the words of the language
  commands: [ ... ],             // whole-line commands
  functions: [ ... ],            // name(...) functions
  translate: { ... },            // descriptions, in other languages, of the commands and functions of another pack
  runtime: { js: '...', php: '...' }   // helper code added to the sites that use the pack
};
```

### Commands

```js
{
  id: 'weather.say',
  patterns: { en: ['say the weather in {city}', 'weather in {city}'] },
  call: ['sayWeather'],                 // also written like C: sayWeather("Cluj")
  js: 'wzWeather.say({city})',          // in the page
  php: 'wz_weather_say({city})',        // on the server (leave it out: "page only")
  async: true,                          // the js returns a Promise: wait for it
  doc: { en: 'Shows the weather of a city.', ro: 'Arată vremea dintr-un oraș.' },
  example: { en: 'sayWeather("Cluj")' }
}
```

A pattern is words and **slots**:

| Slot | Takes |
| --- | --- |
| `{name}` | any value: `"Cluj"`, `NameBox.text`, `x + 1` |
| `{name:control}` | a control of the page (`Button1`); the template gets the control's name as text |
| `{name:target}` | something to write into: a variable, `Label1.text`, `pet.name` |
| `{name:page}` | a page of the site (`About`) |
| `{name:word}` | one plain word |

A pattern must start with a word. Several patterns can mean the same command (`['throw confetti', 'confetti']`).

Two more ways to write a command, the C-like way:

| Field | Written as | Notes |
| --- | --- | --- |
| `call: ['sayWeather']` | `sayWeather("Cluj")` | the values fill the slots in order (`callArgs: ['key', 'value']` changes the order). If the pattern has a `{x:target}`, the call gives back a value: `var name = ask("Name?")` |
| `method: ['shake']` | `AnswerBox.shake()` | for commands with a `{x:control}`: the control before the dot fills it, the values in `( )` fill the other slots (`Player.move(10, 0)`) |

In the templates, `{name}` is replaced by the translated value. Templates can use the helpers of the runtime: `wz.text(v)`, `wz.num(v)`, `wz.set(control, 'visible', false)`, `wz.el(name)` (the HTML element of a control) and, in PHP, `wz_text($v)`, `wz_num($v)`, `wz_print($v)`… Look at `runtime/core.js`, `runtime/client.js` and `runtime/php.js` for the full list.

### Functions

```js
{
  id: 'weather.temp',
  names: { en: ['temperature', 'temp'] },
  methods: ['toTemperature'],           // other names after a dot (optional)
  params: ['city', 'unit?'],            // ? = can be left out; '...items' = any number
  js: 'wzWeather.temp({0}, {1})',       // {0}, {1}... are the values; {args} = all of them
  php: 'wz_weather_temp({0}, {1})',
  async: true,
  returns: 'num',                       // any | num | text | bool | list
  group: 'web',                         // text | number | list | time | web | server | other (for Help)
  doc: { en: 'The temperature in a city.', ro: 'Temperatura dintr-un oraș.' },
  example: { en: 'Label1.text = temperature("Cluj")' }
}
```

A function with only `php` runs only in **server functions**; one with only `js` runs only in the page. Wemazy explains it in plain words when someone uses it in the wrong place.

Every function with at least one value is also a **method**: `"Cluj".temperature()` is `temperature("Cluj")`. `methods` adds names that work only after a dot (the first one is the name the Help and IntelliSense show). `changes: true` means that, on a line of its own, `city.trim()` changes `city` itself (like `sort`, `trim`, `upper`).

### Other ways to write a word

`vocab.en` maps the **meaning** of each keyword to the ways people may write it. A pack can add synonyms:

```js
vocab: {
  en: {
    'print': ['print', 'write'],
    'ev.click': ['clicked', 'pressed', 'tapped']
  }
}
```

The meanings are the keys of `vocab.en` in `language/packs/core.js` (statements, operators, events like `ev.click`, properties like `prop.text`, objects like `obj.session`). Phrases can have several words (`'is not empty'`) and capital letters never matter. The first phrase is the one Wemazy writes in snippets and Help. The C-like words are there too: `'stop': ['stop', 'break']`, `'var': ['var', 'let', 'const']`.

Two rules keep the language easy:

- Don't add everyday words that people will want as names. `then`, `end`, `else`, `and`, `or`, `not`, `mod` and `is` are reserved, so their words can never be names of variables or columns.
- Other keywords are understood from their place in the line, so `set seconds to 0` still works even though `seconds` is a keyword.

### Descriptions in other languages

`doc` holds the description of a command or function in each language of the interface (`doc: { en: '…', ro: '…' }`). To describe the commands and functions of **another** pack in a new language, use `translate`:

```js
translate: {
  fr: {
    commands: { message: { doc: 'Montre un message dans une petite fenêtre.' } },
    functions: { upper: { doc: 'Le texte en MAJUSCULES.' } }
  }
}
```

### Runtime code

`runtime.js` is added to every page of the sites that use the pack, after the Wemazy runtime (so `wz` exists). `runtime.php` is added to the server code (without `<?php`). Keep names unique: start them with your pack id (`wzWeather`, `wz_weather_…`).

### Checking a pack

- **Try it** in the Language Lab shows what your code becomes, with errors underlined.
- Make a small project that uses the pack, press **F5**, and also run it **On PHP** if the pack has PHP templates.
- The commands must give the same result in the page and on the server. `tests/differential.js` shows how the built-in functions are checked.

## 2. Translating the interface

The texts of the window are in `ide/i18n.js`: an `en` block and a `ro` block with the same keys. To add a language:

1. Copy the `en` block, translate the texts (keep `{0}`, `{1}`: they are filled in), and add it as `W.i18n.strings.xx`.
2. Add the language to the language list in `ide/app.js` (`buildShell` and `optionsDialog`).
3. Translate the descriptions of commands and functions (`doc.xx`, or a pack with `translate.xx`) and the error messages (`messages` in `language/compiler.js` and `runtime/*.js`).

A missing text falls back to English, so a translation can be done a little at a time.

## 3. The compiler and the runtimes

| File | Role |
| --- | --- |
| `language/compiler.js` | lexer, parser (both ways of writing: `{ }` and `end`, with error recovery and messages in plain words), code generators for the page (JavaScript), the browser test server, and PHP; SQL for the database statements; line kinds and indentation for the editor |
| `runtime/core.js` | values, text, numbers, lists, dates, and the C types (`wz.conv`, `wz.ia`, `wz.idiv`…), structs, unions and classes: shared by the pages and the browser test server |
| `runtime/client.js` | controls, events, dialogs, navigation, talking to the server |
| `runtime/server.js` | the server inside the browser (database, sessions) used by F5 and by "data in the browser" sites |
| `runtime/php.js` | the PHP twin of `core.js`, plus the database (PDO, SQLite or MySQL) and the API the pages call |

The JavaScript and PHP runtimes must behave the same. After changing them, run:

```
node tests/differential.js      # 440 lines of Wemazy Script (with words, C-like, typed with structs and classes), JavaScript vs PHP
node tests/differential-db.js   # the database statements, browser server vs PHP + SQLite
node tests/help-examples.js     # every example of the Help and of the packs compiles
```

(PHP 8.1+ with `pdo_sqlite` must be on the PATH.)

How types work inside: the parser keeps a `TypeRef` on declarations; the generator gives every expression a type string (`int32`, `uint8`, `float32`, `char`, `string`, `S:Point`, `U:Number`, `C:Dog`, `G:Button`, `L:int32`), converts values on every store with the same `wz.conv` / `wz_conv` the runtimes share, and writes C arithmetic through `wz.ia` / `wz.imul` / `wz.idiv` / `wz.fa`. Values without a type keep Wemazy's own rules (`wz.add`…). The word operators are read by spelling (`isUpperWord` in the parser): `AND` becomes a `Bin` with op `and` (logical), `and` becomes op `band` (bit by bit; `G.bitBin` decides at compile time from the types, or at run time through `wz.bw` / `wz_bw`, whose right side is a thunk so `and` / `or` still short-circuit on conditions). Classes become `wz.def_class({...})` plus plain functions (`c1_ctor`, `c1_m_speak`); `private`/`protected` are checked at compile time and again at run time (`wz.oget(obj, "x", ctx)`), so `var` code that gets an object still obeys them.

Rules of the house:

- Error messages say what is wrong and how to fix it, in words a 12-year-old understands, in English and Romanian (`messages` in `compiler.js` and `runtime/*.js`).
- No build step and no external libraries: Wemazy must open from a USB stick with no internet.
- Classic `<script>` files, not ES modules (they don't load from `file://`).

---

## Pe scurt, în română

Limbajul Wemazy Script este făcut din **pachete de limbaj** (`language/packs/`). Instrucțiunile lui sunt cuvinte englezești (`if`, `while`, `when`…) și se pot scrie ca în C (`if (x > 1) { … }`) sau cu cuvinte (`if x > 1 then … end if`). Un pachet poate adăuga comenzi (de exemplu `message("Salut")` sau `show message "Salut"`), funcții (de exemplu `upper("salut")`, care merge și ca `"salut".upper()`) sau alte feluri de a scrie un cuvânt. Fiecare comandă și funcție spune în ce se transformă în JavaScript (în pagină) și în PHP (pe server), și are o descriere în engleză și în română.

Cel mai simplu: **Unelte > Laboratorul de limbaj > Pachet nou**. Acolo scrii comenzile și funcțiile, le încerci în fila **Încearcă** și descarci pachetul ca fișier. Oricine îl poate importa (Laboratorul de limbaj > Importă un pachet) sau îl poate pune în `language/packs/` și adăuga în `language/packs/list.js`.

Textele interfeței sunt în `ide/i18n.js` (blocurile `en` și `ro`). Testele: `node tests/differential.js`, `node tests/differential-db.js`, `node tests/help-examples.js`.
