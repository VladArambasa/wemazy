# Wemazy

Make websites the way Visual Studio makes Windows Forms programs: drag controls onto a page, double-click a button, write what it does, press **F5**.

The code is written in **Wemazy Script**, a small language made for this program. It looks like C, C# or Java, but it is much simpler: no types, no semicolons needed, plain English for the database.

```
when SendButton clicked {
    if (NameBox.text.empty()) {
        message("Please write your name.")
        return
    }
    Guests.add({name: NameBox.text, posted: now})
    GuestTable.data = find all Guests order by id descending
}
```

Wemazy translates it into **JavaScript** (what runs in the page), **PHP** (what runs on the server) and **SQL** (the database). You can read the translation at any time in the *Translated code* window.

Română: [mai jos](#pe-scurt-în-română).

---

## Start

**Nothing to install.** Open `index.html` in Chrome, Edge or Firefox. Everything works: the designer, the code, running your sites. Projects are kept in the browser, and the database of your sites runs inside the browser too.

**With PHP 8.1 or newer** (recommended):

| Windows | macOS, Linux |
| --- | --- |
| double-click `start-windows.cmd` | run `./start-mac-linux.sh` |

Wemazy opens at <http://localhost:8790>. Projects are kept in the `data` folder, and next to **Start** you can choose **On PHP**: your site is written to `sites/<name>/` and runs with real PHP and SQLite.

**On a server** (a school server, a web host with PHP): copy the folder there and set a password in `server/config.php`. Without a password, the server part only answers on the computer it runs on.

## The window

| Part | What it does |
| --- | --- |
| Toolbox (left) | Controls to drag onto the page: texts, buttons, text boxes, tables, pictures, panels, free forms… |
| Designer (middle) | The page as it will look, on a computer, tablet or phone. Drag to move, pull the handles to resize. |
| Code (F7) | The Wemazy Script of the page, with colours, suggestions (IntelliSense), error squiggles and automatic `}` and `end` lines. |
| Solution Explorer | Pages, database tables, pictures and files of the project. |
| Properties (F4) | Everything about the selected control. The ⚡ tab lists its events: double-click one to write its code. |
| Error List, Output | Mistakes in plain words, with the line. What your code prints. |
| Translated code | The JavaScript, PHP and SQL made from your code. |

The menus and windows speak English or Romanian (the list at the top right). The code is always Wemazy Script.

Two kinds of page: a **normal page** (controls one under another, it adapts to phones by itself) and a **free form** (controls stay exactly where you drop them, with snaplines and a grid, like Windows Forms).

Examples to start from: personal site, guestbook (database), quiz game, calculator (free form), members area (accounts, passwords, server functions), class page.

## Wemazy Script in two minutes

```
var score = 0                            // a variable
Label1.text = "Hi, " + NameBox.text      // a control on the page

if (score > 10) {
    message("Well done!")
} else {
    score++
}

for (var i = 1; i <= 3; i++) {
    print "hello " + i
}

foreach (var name in ["Ana", "Ion"]) {
    List1.add(name)
}

function double(n) {
    return n * 2
}

when Button1 clicked {
    Label1.text = double(21)
    if (NameBox.text.length() > 20) NameBox.clear()
}

every 1 seconds {
    clock++
}
```

Values and controls have methods: `name.toUpper()`, `name.trim()`, `name.length`, `name.contains("an")`, `list.sort()`, `price.round(2)`, `Panel1.hide()`, `NameBox.focus()`. `x.method()` is the same as `method(x)`, so `name.toUpper()` is `upper(name)`.

The same code can also be written with words. Both ways work, even in the same project:

```
when Button1 clicked
    if score > 10 then
        show message "Well done!"
    else
        increase score by 1
    end if
end when
```

The database uses the tables of the project:

```
var rows = find all Products where price < 10 order by name
Products.add({name: "Pen", price: 2})
update Products set price = price * 2 where id == 3
delete from Orders where done == true
```

A **server function** runs on the server (PHP), so passwords and secrets never reach the browser:

```
server function signIn(who, secret) {
    var u = find first Users where name == who
    if (u.empty()) return false
    if (checkHash(secret, u.password)) {
        session.user = u.name
        return true
    }
    return false
}
```

Types are optional. Without them, values just work; with them, they follow the rules of C:

```
var int32 a = 7            // or just: int32 a = 7
var unsigned int8 b = 250
const float64 PI = 3.14159
print a / 2                // 3 - whole numbers divide to whole numbers
print b + 10               // 260 - small types become int32 in calculations
b = 300                    // 44 - it goes round, like in C
char c = 'A'
print c + 1                // 66
```

Whole numbers: `int8` `int16` `int32` `int64` (and `unsigned …`; `int`, `long`, `byte`, `short` work too). Decimals: `float16` `float32` `float64` (`float`, `double`). Also `bool`, `char`, `string`. `(int32)x` or `int32(x)` converts. `const` makes a constant.

Logic and bits use the same words in two spellings — **CAPITALS decide true or false, small letters work bit by bit**:

```
print a > 1 AND b > 1      // true or false: AND OR XOR NOT NAND NOR XNOR (also && || !)
print 6 and 3              // 2 - bit by bit: and or xor not nand nor xnor
print 1 shl 4              // 16 - shl / shr (or << / >>) move the bits
uint8 flags = 0
flags = flags or 4         // turn a bit on
print (flags and 4) != 0   // is it on?
```

A true/false value is one bit, so `if x > 1 and y < 2` is still a condition. `AND` and `OR` stop at the first side that decides, like `&&` and `||`.

Structs are copied, objects are shared, and classes work like in C# and C++:

```
struct Point { int32 x; int32 y; }

class Animal {
    public string name;
    protected int32 legs = 4;
    public Animal(string name) { this.name = name; }
    public virtual string sound() { return "..."; }
    public string speak() { return name + " says " + sound(); }
}

class Dog : Animal {
    public Dog(string name) : base(name) { }
    public override string sound() { return "woof"; }
}

Dog rex = new Dog("Rex");
print rex.speak()          // Rex says woof
Animal pet = rex;          // a Dog is also an Animal
print pet is Dog;          // true
```

`private` (the default), `public`, `protected`, `static`, `abstract`, `virtual`/`override`, `readonly`, `interface`, `union`, `sizeof`, `is`, `as` and casts all work the way C# programmers expect. Objects can travel to server functions and back.

The controls of the page are classes too: `Button`, `TextBox`, `Text`, `Panel`, `List`… and `Control` is all of them.

```
Button b = Button1;        // a control in a variable
b.text = "Press me";
b.hide();

Button nb = new Button();  // a new control, made by the code
nb.text = "New";
Panel1.add(nb);
nb.click += pressed;       // runs pressed(nb) when it is clicked

function pressed(Button sender) {
    sender.text = "Pressed!";
}
```

The whole language, every command and function, with examples, is in **Help** (F1) inside Wemazy.

Good to know:

- Names don't care about capital letters: `NameBox` and `namebox` are the same control.
- Lists and texts count from 1. `list[-1]` is the last item.
- In `"Hi, {name}!"` the value of `name` goes into the text. `'…'` texts are taken as they are.
- `+` adds numbers ("3" + 4 is 7) and joins texts; `&` always joins (so `^` is power and `&` is not "bitwise and": write `and`).
- `==` compares exactly; `contains`, `startsWith`, `endsWith` ignore capital letters.
- Types are optional: `var x = 5` keeps Wemazy's simple rules, `int32 x = 5` follows C. A `;` at the end of a line is optional.
- `int64` keeps whole numbers exact up to 9007199254740991 (2^53), like JavaScript. Lists count from 1 even with types: `int32 a[3]` has `a[1]`, `a[2]`, `a[3]`.
- On a line of its own, `list.sort()` sorts the list itself (and `name.trim()` trims `name`).

## Putting a site online

**Export** (Ctrl+E) makes a ZIP:

| Kind | For | What is inside |
| --- | --- | --- |
| Simple website | GitHub Pages, Netlify, any host, a USB stick | HTML, CSS, JavaScript |
| Website with data in the browser | sites with a database but no server | the same, plus the database running in each visitor's browser |
| Website for a PHP server | school servers, web hosts | pages + `api.php` + SQLite or MySQL (set in `config.php`), with `database-sqlite.sql` / `database-mysql.sql` |

The ZIP also holds the `.wemazy` project file, so you can open the project again on any computer.

## A language the community can change

Wemazy Script is made of **language packs**. Its words, commands and built-in functions are in `language/packs/core.js` (with descriptions in English and Romanian), and `language/packs/fun.js` is an example of a community pack (shake, spin, confetti, dice…).

In **Tools > Language Lab** you can make your own pack without touching a file: new commands and functions (each one says what it becomes in JavaScript and PHP), other ways to write a word, and runtime code. Packs are shared as one file; anyone can import it. A project keeps a copy of the packs it uses, so it opens everywhere.

See [CONTRIBUTING.md](CONTRIBUTING.md) to write packs, translate the interface or change the compiler.

## Folders

| Folder | What it holds |
| --- | --- |
| `index.html` | Wemazy itself (open it in a browser) |
| `ide/` | The window: designer, code editor, properties, panels, dialogs, help |
| `language/compiler.js` | The compiler: Wemazy Script → JavaScript, PHP, SQL |
| `language/packs/` | Language packs (`list.js` says which are loaded) |
| `runtime/` | What runs inside the sites: `core.js` (shared), `client.js` (pages), `server.js` (the browser test server), `php.js` (the PHP runtime) |
| `server/` | The optional PHP part: `api.php`, `config.php`, `router.php` |
| `tests/` | Tests run with Node: `node tests/differential.js` checks that JavaScript and PHP give the same results |
| `data/`, `sites/` | Made by the server part: projects, and sites started with "On PHP" |

Requirements: a modern browser (Chrome, Edge, Firefox, Safari). For the server part: PHP 8.1+ with `pdo_sqlite` (and `pdo_mysql` for MySQL sites).

Licence: MIT. Free to use, change and share.

---

## Pe scurt, în română

Wemazy face site-uri așa cum Visual Studio face programe Windows Forms: tragi controale pe pagină, dai dublu clic pe un buton, scrii ce face și apeși **F5**. Codul se scrie în **Wemazy Script**, care seamănă cu C, C# și Java (blocuri între `{ }`, `var`, `x++`, `NameBox.text.length()`), dar e mult mai simplu: tipurile sunt opționale (`var x = 5` sau `int32 x = 5`), `;` nu e obligatoriu. Operatorii logici se scriu cu majuscule (`AND OR XOR NOT NAND NOR XNOR`: adevărat sau fals), cei pe biți cu litere mici (`and or xor not …`, `shl`, `shr`). Cu tipuri (`int8`…`int64`, `unsigned`, `float32`, `char`, `struct`, `union`, `class` cu `public`/`private`/`protected`, moștenire, `interface`) valorile urmează regulile din C și C#; controalele paginii sunt și ele clase (`Button b = Button1`, `new Button()`). Instrucțiunile sunt în engleză; textele pe care le văd vizitatorii pot fi în orice limbă:

```
when SendButton clicked {
    if (NameBox.text.empty()) {
        message("Scrie-ți numele.")
        return
    }
    Guests.add({name: NameBox.text, posted: now})
    GuestTable.data = find all Guests order by id descending
}
```

Același cod se poate scrie și cu cuvinte (`if … then … end if`, `show message "…"`); ambele feluri merg, chiar și în același proiect.

Wemazy îl traduce în **JavaScript**, **PHP** și **SQL**.

**Fără instalare:** deschide `index.html` în Chrome, Edge sau Firefox. Proiectele sunt păstrate în browser.

**Cu PHP 8.1 sau mai nou:** dublu clic pe `start-windows.cmd` (Windows) sau `./start-mac-linux.sh` (macOS, Linux). Wemazy se deschide la <http://localhost:8790>, proiectele sunt păstrate în folderul `data`, iar lângă **Pornește** poți alege **Pe PHP**: site-ul rulează cu PHP și SQLite adevărate.

**Pe un server** (serverul școlii, o găzduire): copiază folderul și pune o parolă în `server/config.php`.

Lista de limbi din dreapta sus schimbă interfața între engleză și română. Ajutorul (F1) are tot limbajul, cu exemple și explicații în limba interfeței.

**Exportă** (Ctrl+E) face o arhivă ZIP: site simplu (orice găzduire), site cu datele în browser, sau site pentru un server PHP cu bază de date SQLite sau MySQL.

Limbajul aparține comunității: în **Unelte > Laboratorul de limbaj** poți face pachete cu comenzi și funcții noi și le poți da mai departe ca fișier. Detalii în [CONTRIBUTING.md](CONTRIBUTING.md).

Licență MIT.
