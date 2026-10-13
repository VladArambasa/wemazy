/*!
 * Wemazy Script compiler
 * ----------------------
 * Translates Wemazy Script (the simple language of Wemazy) into:
 *   - JavaScript that runs in the web page          (target "js")
 *   - JavaScript that runs the in-browser test server (target "sim")
 *   - PHP that runs on a real web server             (target "php")
 *   - SQL for the database (inside the PHP and as .sql files)
 *
 * The words of the language (if, then, repeat...), its commands (show message...)
 * and its functions (upper, round...) are NOT written here: they come from
 * language packs in language/packs/. Anyone can add a pack - see CONTRIBUTING.md.
 *
 * Pipeline:  source --lex--> tokens --parse--> syntax tree --Gen--> JS / PHP / SQL
 *
 * MIT licence. Improve it, share it.
 */
(function (root) {
  'use strict';

  var W = root.Wemazy = root.Wemazy || {};
  var L = W.lang = W.lang || {};
  L.version = '1.0.0';
  L.packs = L.packs || {};
  L.packOrder = L.packOrder || [];
  L._rev = L._rev || 0;

  /* =====================================================================
   * Small helpers
   * ===================================================================== */

  /** Normal form of a word: lower case, no diacritics ("Dacă" -> "daca"). */
  function norm(s) {
    return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  L.norm = norm;

  /** A safe name for JS and PHP ("Scor" -> "scor", "mașină" -> "masina"). */
  function mangle(name) {
    var n = norm(name), out = '';
    for (var i = 0; i < n.length; i++) {
      var ch = n[i];
      if (/[a-z0-9_]/.test(ch)) out += ch;
      else out += '_' + ch.charCodeAt(0).toString(16) + '_';
    }
    return out;
  }
  L.mangle = mangle;

  function jsStr(s) {
    return JSON.stringify(String(s)).replace(/</g, '\\u003c')
      .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  }
  function phpStr(s) {
    return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  }
  function jsTplPart(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/`/g, '\\`')
      .replace(/\$\{/g, '\\${').replace(/</g, '\\u003c');
  }
  L.jsStr = jsStr;
  L.phpStr = phpStr;

  function lev(a, b) {
    if (a === b) return 0;
    var m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      var t = prev; prev = cur; cur = t;
    }
    return prev[n];
  }

  /** The closest known name, for "Did you mean ...?" */
  function suggest(name, candidates) {
    var n = norm(name), best = null, bestD = Infinity;
    var limit = Math.max(1, Math.floor(n.length / 3));
    (candidates || []).forEach(function (c) {
      if (!c) return;
      var d = lev(n, norm(c));
      if (d < bestD && d <= limit) { best = c; bestD = d; }
    });
    return best;
  }
  L.suggest = suggest;

  function uniq(arr) {
    var seen = {}, out = [];
    arr.forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.push(x); } });
    return out;
  }

  /* =====================================================================
   * Messages (errors) - English and Romanian. Packs may add languages
   * through pack.messages = { xx: { key: text } }.
   * ===================================================================== */

  L.messages = L.messages || {};
  L.messages.en = Object.assign({
    unclosedString: 'This text has no closing quote.',
    badChar: "I don't understand the character '{0}' here.",
    unclosedBrace: "The '{' inside this text has no matching '}'. To write a { in text, type \\{.",
    emptyBrace: 'Write a value between { and }, like {name}.',
    expected: 'Expected {0} here.',
    expectedValue: 'Expected a value here (a number, "text", a name...).',
    expectedValueGot: "Expected a value here, but found '{0}'.",
    expectedName: 'Expected a name here.',
    expectedNameGot: "Expected a name here, but found '{0}'.",
    expectedEnd: "The '{0}' on line {1} needs '{2}' to close it (or put its lines between { and }).",
    strayEnd: "This '{0}' doesn't close anything.",
    strayElse: "This '{0}' has no 'if' before it.",
    unclosedComment: 'This note has no */ to close it.',
    strayBrace: "This } doesn't close anything: there is no { before it.",
    expectedBrace: 'The { on line {0} needs a } to close it.',
    endInBrace: "The block that starts with { on line {1} closes with }, not with '{0}'.",
    needBrace: "Put the lines of this '{0}' between { and }.",
    mixedBlocks: "The '{0}' on line {1} doesn't use { }, so its other parts can't either. Write all of it with { }, or all of it with 'end'.",
    doWhile: 'After do { … } write while and a condition, like: } while (x < 10)',
    expectedType: "Expected a type here (int32, string, bool, float64, the name of a struct or class...), but found '{0}'.",
    badSign: "'{0}' only goes with whole-number types (int8, int16, int32, int64) and char, not with '{1}'.",
    voidVar: "A variable can't be void: void is only for functions that give back nothing.",
    constNeedsValue: "The constant {0} needs a value: const int32 {0} = …",
    nestedType: "A {0} must be written on its own, not inside another block.",
    ctorOnlyClass: "Only a class can have a constructor ({0} is not a class).",
    methodInStruct: "A {1} only holds values, so it can't have the method {0}(). Use a class for methods.",
    abstractBody: "{0}() is abstract: the classes that inherit write its lines. Leave out the { }.",
    fieldInInterface: "An interface only lists methods, so it can't have the field {0}.",
    accessors: "After a field, only { get; set; } can be written between { }.",
    baseAlone: "'{0}' is written with a dot (base.speak()), or in a constructor as base(…).",
    methodNeedsParens: "{0} is a method: write {0}() to run it.",
    typeValue: "'{0}' is a type, not a value.",
    thisOutside: "'{0}' only works inside the methods of a class.",
    thisInStatic: "A static method has no object, so it can't use '{0}'.",
    privateMember: "'{0}' is private in {1}: only the code of {1} can use it. Write public before it to use it from outside.",
    protectedMember: "'{0}' is protected in {1}: only the code of {1} and of the classes that inherit from it can use it.",
    needObjectField: "{0} belongs to each object, but here there is no object. Write object.{0}, or make {0} static.",
    needObjectMethod: "{0}() belongs to each object, but here there is no object. Call it on an object (object.{0}()), or make it static.",
    noMember: "{0} has no member '{1}'.",
    noMethodC: "{0} has no method '{1}'.",
    eventValue: "'{0}' is an event. Give it a function to run: Button1.{0} += myFunction",
    notIndexable: "A {0} has no items, so [ ] can't be used on it.",
    noBase: "{0} doesn't inherit from another class, so it has no base.",
    needNew: "To make an object of {0}, write new {0}(…).",
    baseCallFirst: "'{0}(…)' gives values to the base class: write it in a constructor, as : base(…) after its ( ), or as its first line.",
    abstractCall: "{0}() is abstract: it has no lines to run.",
    valOfType: 'a value of type {0}',
    aList: 'a list',
    aRecord: 'a record',
    thisValue: 'this value',
    cantConvert: "Type {1} can't hold {0}.",
    needCast: "{0} is not always {1}. If it is, say so with a cast: ({1})value",
    tooBig: "{0} doesn't fit in {1}: Wemazy keeps 64-bit whole numbers exactly only from -9007199254740991 to 9007199254740991.",
    notOneChar: "A char holds one character, but '{0}' is not one character.",
    unionOneField: 'A union holds one field at a time: give one value for {0}.',
    tooManyValues: '{0} has only {1} field(s).',
    newArraySize: 'Write how many items the list has, like: new {0}[10]',
    abstractNew: '{0} is abstract (or an interface): make an object of a class that inherits from it.',
    newControlServer: "A server function can't make a new {0}: the page isn't on the server.",
    expectedInits: 'After new …, write the starting values between { }, like: new Point { x = 1, y = 2 }',
    sizeofType: 'sizeof works with types of a fixed size (int32, float64, char, structs of those...), not with {0}.',
    constChange: "{0} is a constant and can't be changed.",
    readonlyField: '{0} is readonly: only the constructor of {1} can change it.',
    voidReturn: 'This function gives nothing back (void), so return has no value here.',
    needReturnValue: 'This function gives back a {0}: write the value after return.',
    eventRemove: "-= is not supported for events: '{0}' keeps its functions.",
    eventHandler: 'After {0} +=, write the name of one of your page functions (it can take one value: the control).',
    arraySize: 'Write how many items {0} has, like: {0}[10]',
    controlParamServer: "A server function can't take or give back a control ({0}): controls are on the page, not on the server.",
    typeRedeclared: '{0} was already declared as {1}. A name has one type in a function.',
    baseNeedsArgs: '{0} needs {2} value(s) to be made: give them with : base(…) after the ( ) of the constructor of {1}.',
    dupType: "There is already a type called '{0}' (in {1}, line {2}).",
    typeIsControl: "'{0}' is a kind of control (like Button). Choose another name for your type.",
    typeIsBuiltin: "'{0}' is a type of the language. Choose another name.",
    typeIsFunction: "'{0}' is a function. Choose another name for your type.",
    typeIsTable: "'{0}' is a table. Choose another name for your type.",
    typeIsControlName: "'{0}' is the name of a control. Choose another name for your type.",
    baseIsControl: "A class can't inherit from the kind of control '{0}'.",
    unknownType: "There is no class or interface called '{0}'.",
    oneBase: '{0} can inherit from only one class ({1} would be a second one). It can implement any number of interfaces.',
    sealedBase: '{0} is sealed: no class can inherit from it.',
    badBase: "{0} is a struct (or a union), so {1} can't inherit from it. Only classes and interfaces can be inherited.",
    ifaceBase: 'The interface {0} can only inherit from interfaces, and {1} is not one.',
    structBase: "A struct (or a union) like {0} can't inherit from anything.",
    notInterface: "{0} is not an interface, so it can't be implemented. To inherit from a class, write : {0}",
    inheritLoop: '{0} inherits from itself (through other classes).',
    dupCtor: '{0} already has a constructor. A class has one constructor in Wemazy.',
    staticCtor: "A constructor can't be static ({0}).",
    dupMember: "{1} already has a member called '{0}'.",
    memberIsClass: "A member can't have the name of its class ({0}). A constructor is written {0}(…) { }.",
    unionField: 'The field {0} of a union must be a number, a bool or a char, not {1}.',
    staticInStruct: "A {1} can't have the static field {0}.",
    unionDefault: "A field of a union can't have a starting value ({0}).",
    constDefault: 'The starting value of {0} must be a fixed value, like 0 or "text".',
    abstractInConcrete: '{0}() has no lines, so {1} must be abstract: write abstract class {1}.',
    abstractStatic: "A static method can't be abstract ({0}).",
    noOverride: '{0}() is marked override, but the classes {1} inherits from have no method {0}().',
    overrideParams: '{0}() must take the same values as in {1}: {2} value(s).',
    overrideStatic: '{0}() is static in {1}, so it must be static here too (or the other way round).',
    fieldHides: '{0} is already a field of {1}. Give this field another name.',
    notImplemented: '{0} must write the method {1}() of {2} (or be abstract).',
    structLoop: 'The struct {0} holds itself, so it would never end. Use a class (objects are references) instead.',
    bitsOnly: "'{0}' in small letters works bit by bit, on whole numbers (a number with decimals has no bits), not on {1}. For a condition, write it in capitals: {2}.",
    shiftOnly: "'{0}' moves the bits of a whole number, not of {1}.",
    varSelf: "'{0}' is used here before var {0} gives it a value. To change the {0} you already have, leave out var.",
    unknownMethod: "The table {1} can't do '{0}'. It can do: {2}.",
    unknownMethod2: "I don't know the method '{0}'.",
    methodIsStatement: "{0} changes something but gives nothing back. Write it on its own line.",
    noValue: "{0}(…) gives nothing back. Write it on its own line.",
    expectedControl: '{0} needs the name of a control here.',
    wrongEnd: "Expected '{0}' to close the '{1}' on line {2}, but found '{3}'.",
    extraTokens: "I didn't understand the end of this line: {0}",
    notAssignable: "You can't change this. Only variables, control properties, list items and record fields can be changed.",
    nestedFunction: 'A function must be written on its own, not inside another block.',
    nestedWhen: "'{0}' must be written on its own, not inside another block.",
    expectedEvent: "Expected an event after {0}, like: {1}.",
    badEvent: "{0} doesn't have the event '{1}'. It has: {2}.",
    unknownControl: "There is no control called '{0}' on this page.",
    unknownTable: "There is no table called '{0}'.",
    expectedTable: 'Expected a table name here. Your tables: {0}.',
    noTables: 'Expected a table name here, but the project has no tables yet. Add one in the Database window.',
    unknownColumn: "The table {0} has no column '{1}'. Its columns: {2}.",
    unknownName: "I don't know '{0}'.",
    didYouMean: " Did you mean '{0}'?",
    unknownProp: "{0} has no property '{1}'. It has: {2}.",
    readOnlyProp: "The property '{0}' can only be read, not changed.",
    pageNeedsProp: "Write a property after page, like page.title.",
    sessionNeedsKey: 'Write a name after session, like session.user.',
    unknownFunction: "There is no function called '{0}'.",
    notAFunction: "'{0}' is not a function, so it can't be called with ( ).",
    argCount: '{0} needs {1}, but got {2}.',
    nValues: '{0} value(s)',
    dupFunction: "There is already a function called '{0}' (in {1}, line {2}).",
    dupBuiltin: "'{0}' is already the name of a built-in function. Choose another name.",
    clientOnly: "'{0}' only works on the page, not inside a server function.",
    serverOnly: "'{0}' only works inside a server function.",
    clientFnInServer: "The server function can't call '{0}', because '{0}' runs on the page. Only server functions can be called here.",
    controlInServer: "A server function can't use {0}: the page isn't on the server. Give the value to the function as a parameter, or return a result and use it on the page.",
    controlInSite: "The shared Site code can't use {0}, because {0} is not on every page. Put this code in the page's own code.",
    eventInSite: "The shared Site code can only have 'when page loads' and 'every' blocks. Put events of controls in the page's own code.",
    nameIsControl: "'{0}' is the name of a control on this page. Give your variable another name.",
    nameIsFunction: "'{0}' is a function. Give your variable another name.",
    nameIsTable: "'{0}' is a table. Give your variable another name.",
    loopOnly: "'{0}' can only be used inside a loop (repeat, while, for) or a switch.",
    caseOutside: "'{0}' can only be used inside a switch.",
    caseFirst: 'Inside a switch, start with case (or default) before the lines.',
    twoDefaults: 'This switch already has a default.',
    noEffect: "This line doesn't do anything.",
    tableValue: '{0} is a table. To get its rows, write: find all {0}',
    whereFunc: "Inside 'where', a column can be compared (=, <, contains...) but not given to a function.",
    whereLike: "Inside 'where', write the column first, like: name contains \"an\".",
    sessionClient: "session only works inside a server function.",
    sqlInClient: "'{0}' only works inside a server function.",
    expectedUnit: "Expected seconds or milliseconds here.",
    missingTo: "Expected '{0}' here, like: set score to 10.",
    keyOnlyInKey: "",
    unknownStatement: "I don't know how to start a line with '{0}'.",
    pageUnknown: "There is no page called '{0}'. Your pages: {1}.",
    tooDeep: 'This code is nested too deeply.',
    returnValueInHandler: '',
    colSelf: "This compares the column {0} with itself, so it is always true. If {0} is also a variable, give the variable another name."
  }, L.messages.en || {});

  L.messages.ro = Object.assign({
    unclosedString: 'Textul acesta nu are ghilimele de închidere.',
    badChar: "Nu înțeleg caracterul '{0}' aici.",
    unclosedBrace: "Acolada '{' din text nu are pereche '}'. Ca să scrii { în text, tastează \\{.",
    emptyBrace: 'Scrie o valoare între { și }, de exemplu {nume}.',
    expected: 'Aici trebuia {0}.',
    expectedValue: 'Aici trebuia o valoare (un număr, "un text", un nume...).',
    expectedValueGot: "Aici trebuia o valoare, dar am găsit '{0}'.",
    expectedName: 'Aici trebuia un nume.',
    expectedNameGot: "Aici trebuia un nume, dar am găsit '{0}'.",
    expectedEnd: "'{0}' de pe linia {1} trebuie închis cu '{2}' (sau pune liniile lui între { și }).",
    strayEnd: "'{0}' acesta nu închide nimic.",
    strayElse: "Înainte de '{0}' nu există niciun 'if'.",
    unclosedComment: 'Nota aceasta nu are */ de închidere.',
    strayBrace: 'Acolada } nu închide nimic: înainte de ea nu există nicio {.',
    expectedBrace: 'Acolada { de pe linia {0} trebuie închisă cu }.',
    endInBrace: "Blocul care începe cu { pe linia {1} se închide cu }, nu cu '{0}'.",
    needBrace: "Pune liniile acestui '{0}' între { și }.",
    mixedBlocks: "'{0}' de pe linia {1} nu folosește { }, deci nici celelalte părți ale lui nu pot. Scrie-l tot cu { } sau tot cu 'end'.",
    doWhile: 'După do { … } scrie while și o condiție, de exemplu: } while (x < 10)',
    expectedType: "Aici trebuia un tip (int32, string, bool, float64, numele unui struct sau al unei clase...), dar am găsit '{0}'.",
    badSign: "'{0}' merge doar cu tipurile de numere întregi (int8, int16, int32, int64) și cu char, nu cu '{1}'.",
    voidVar: 'O variabilă nu poate fi void: void este doar pentru funcțiile care nu dau nimic înapoi.',
    constNeedsValue: 'Constanta {0} are nevoie de o valoare: const int32 {0} = …',
    nestedType: 'Un {0} se scrie separat, nu în interiorul altui bloc.',
    ctorOnlyClass: 'Doar o clasă poate avea constructor ({0} nu este o clasă).',
    methodInStruct: 'Un {1} ține doar valori, deci nu poate avea metoda {0}(). Folosește o clasă pentru metode.',
    abstractBody: '{0}() este abstractă: clasele care moștenesc îi scriu liniile. Lasă deoparte { }.',
    fieldInInterface: 'O interfață doar enumeră metode, deci nu poate avea câmpul {0}.',
    accessors: 'După un câmp, între { } se poate scrie doar { get; set; }.',
    baseAlone: "'{0}' se scrie cu punct (base.speak()) sau, într-un constructor, ca base(…).",
    methodNeedsParens: '{0} este o metodă: scrie {0}() ca s-o rulezi.',
    typeValue: "'{0}' este un tip, nu o valoare.",
    thisOutside: "'{0}' merge doar în metodele unei clase.",
    thisInStatic: "O metodă statică nu are obiect, deci nu poate folosi '{0}'.",
    privateMember: "'{0}' este private în {1}: doar codul lui {1} îl poate folosi. Scrie public înaintea lui ca să-l folosești din afară.",
    protectedMember: "'{0}' este protected în {1}: doar codul lui {1} și al claselor care moștenesc din ea îl poate folosi.",
    needObjectField: '{0} aparține fiecărui obiect, dar aici nu există niciun obiect. Scrie obiect.{0} sau fă-l pe {0} static.',
    needObjectMethod: '{0}() aparține fiecărui obiect, dar aici nu există niciun obiect. Apeleaz-o pe un obiect (obiect.{0}()) sau fă-o statică.',
    noMember: "{0} nu are membrul '{1}'.",
    noMethodC: "{0} nu are metoda '{1}'.",
    eventValue: "'{0}' este un eveniment. Dă-i o funcție de rulat: Button1.{0} += funcțiaMea",
    notIndexable: 'Un {0} nu are elemente, deci [ ] nu se poate folosi pe el.',
    noBase: '{0} nu moștenește din altă clasă, deci nu are base.',
    needNew: 'Ca să faci un obiect {0}, scrie new {0}(…).',
    baseCallFirst: "'{0}(…)' dă valori clasei de bază: scrie-l într-un constructor, ca : base(…) după ( ) sau ca primă linie.",
    abstractCall: '{0}() este abstractă: nu are linii de rulat.',
    valOfType: 'o valoare de tipul {0}',
    aList: 'o listă',
    aRecord: 'o înregistrare',
    thisValue: 'această valoare',
    cantConvert: 'Tipul {1} nu poate ține {0}.',
    needCast: '{0} nu este întotdeauna {1}. Dacă este, spune asta cu o conversie: ({1})valoare',
    tooBig: '{0} nu încape în {1}: Wemazy păstrează exact numerele întregi pe 64 de biți doar de la -9007199254740991 la 9007199254740991.',
    notOneChar: "Un char ține un singur caracter, dar '{0}' nu este un singur caracter.",
    unionOneField: 'Un union ține un singur câmp o dată: dă o singură valoare pentru {0}.',
    tooManyValues: '{0} are doar {1} câmp(uri).',
    newArraySize: 'Scrie câte elemente are lista, de exemplu: new {0}[10]',
    abstractNew: '{0} este abstractă (sau o interfață): fă un obiect dintr-o clasă care moștenește din ea.',
    newControlServer: 'O funcție de server nu poate face un {0} nou: pagina nu se află pe server.',
    expectedInits: 'După new …, scrie valorile de început între { }, de exemplu: new Point { x = 1, y = 2 }',
    sizeofType: 'sizeof merge cu tipuri de mărime fixă (int32, float64, char, struct-uri din acestea...), nu cu {0}.',
    constChange: '{0} este o constantă și nu poate fi schimbată.',
    readonlyField: '{0} este readonly: doar constructorul lui {1} îl poate schimba.',
    voidReturn: 'Funcția aceasta nu dă nimic înapoi (void), deci aici return nu are valoare.',
    needReturnValue: 'Funcția aceasta dă înapoi un {0}: scrie valoarea după return.',
    eventRemove: "-= nu merge pentru evenimente: '{0}' își păstrează funcțiile.",
    eventHandler: 'După {0} +=, scrie numele uneia dintre funcțiile paginii (poate primi o valoare: controlul).',
    arraySize: 'Scrie câte elemente are {0}, de exemplu: {0}[10]',
    controlParamServer: 'O funcție de server nu poate primi sau da înapoi un control ({0}): controalele sunt pe pagină, nu pe server.',
    typeRedeclared: '{0} a fost deja declarat ca {1}. Un nume are un singur tip într-o funcție.',
    baseNeedsArgs: '{0} are nevoie de {2} valoare/valori ca să fie făcut: dă-le cu : base(…) după ( ) constructorului lui {1}.',
    dupType: "Există deja un tip numit '{0}' (în {1}, linia {2}).",
    typeIsControl: "'{0}' este un fel de control (ca Button). Alege alt nume pentru tipul tău.",
    typeIsBuiltin: "'{0}' este un tip al limbajului. Alege alt nume.",
    typeIsFunction: "'{0}' este o funcție. Alege alt nume pentru tipul tău.",
    typeIsTable: "'{0}' este un tabel. Alege alt nume pentru tipul tău.",
    typeIsControlName: "'{0}' este numele unui control. Alege alt nume pentru tipul tău.",
    baseIsControl: "O clasă nu poate moșteni din felul de control '{0}'.",
    unknownType: "Nu există nicio clasă sau interfață numită '{0}'.",
    oneBase: '{0} poate moșteni dintr-o singură clasă ({1} ar fi a doua). Poate implementa oricâte interfețe.',
    sealedBase: '{0} este sealed: nicio clasă nu poate moșteni din ea.',
    badBase: '{0} este un struct (sau un union), deci {1} nu poate moșteni din el. Se pot moșteni doar clase și interfețe.',
    ifaceBase: 'Interfața {0} poate moșteni doar din interfețe, iar {1} nu este una.',
    structBase: 'Un struct (sau un union) ca {0} nu poate moșteni din nimic.',
    notInterface: '{0} nu este o interfață, deci nu poate fi implementată. Ca să moștenești dintr-o clasă, scrie : {0}',
    inheritLoop: '{0} moștenește din ea însăși (prin alte clase).',
    dupCtor: '{0} are deja un constructor. În Wemazy o clasă are un singur constructor.',
    staticCtor: 'Un constructor nu poate fi static ({0}).',
    dupMember: "{1} are deja un membru numit '{0}'.",
    memberIsClass: 'Un membru nu poate avea numele clasei lui ({0}). Un constructor se scrie {0}(…) { }.',
    unionField: 'Câmpul {0} al unui union trebuie să fie un număr, un bool sau un char, nu {1}.',
    staticInStruct: 'Un {1} nu poate avea câmpul static {0}.',
    unionDefault: 'Un câmp al unui union nu poate avea valoare de început ({0}).',
    constDefault: 'Valoarea de început a lui {0} trebuie să fie fixă, de exemplu 0 sau "text".',
    abstractInConcrete: '{0}() nu are linii, deci {1} trebuie să fie abstractă: scrie abstract class {1}.',
    abstractStatic: 'O metodă statică nu poate fi abstractă ({0}).',
    noOverride: '{0}() este marcată override, dar clasele din care moștenește {1} nu au metoda {0}().',
    overrideParams: '{0}() trebuie să primească aceleași valori ca în {1}: {2} valoare/valori.',
    overrideStatic: '{0}() este statică în {1}, deci trebuie să fie statică și aici (sau invers).',
    fieldHides: '{0} este deja un câmp al lui {1}. Dă acestui câmp alt nume.',
    notImplemented: '{0} trebuie să scrie metoda {1}() a lui {2} (sau să fie abstractă).',
    structLoop: 'Struct-ul {0} se conține pe sine, deci nu s-ar termina niciodată. Folosește o clasă (obiectele sunt referințe).',
    bitsOnly: "'{0}' cu litere mici lucrează bit cu bit, pe numere întregi (un număr cu zecimale nu are biți), nu pe {1}. Pentru o condiție, scrie-l cu majuscule: {2}.",
    shiftOnly: "'{0}' mută biții unui număr întreg, nu ai lui {1}.",
    varSelf: "'{0}' este folosit aici înainte ca var {0} să-i dea o valoare. Ca să schimbi {0} pe care îl ai deja, scrie fără var.",
    unknownMethod: "Tabelul {1} nu poate face '{0}'. Poate face: {2}.",
    unknownMethod2: "Nu cunosc metoda '{0}'.",
    methodIsStatement: '{0} schimbă ceva, dar nu dă nimic înapoi. Scrie-l pe un rând separat.',
    noValue: '{0}(…) nu dă nimic înapoi. Scrie-l pe un rând separat.',
    expectedControl: '{0} are nevoie aici de numele unui control.',
    wrongEnd: "Trebuia '{0}' ca să închidă '{1}' de pe linia {2}, dar am găsit '{3}'.",
    extraTokens: 'Nu am înțeles sfârșitul acestei linii: {0}',
    notAssignable: 'Asta nu se poate schimba. Se pot schimba doar variabile, proprietăți ale controalelor, elemente din liste și câmpuri din înregistrări.',
    nestedFunction: 'O funcție se scrie separat, nu în interiorul altui bloc.',
    nestedWhen: "'{0}' se scrie separat, nu în interiorul altui bloc.",
    expectedEvent: 'După {0} trebuia un eveniment, de exemplu: {1}.',
    badEvent: "{0} nu are evenimentul '{1}'. Are: {2}.",
    unknownControl: "Pe această pagină nu există niciun control numit '{0}'.",
    unknownTable: "Nu există niciun tabel numit '{0}'.",
    expectedTable: 'Aici trebuia numele unui tabel. Tabelele tale: {0}.',
    noTables: 'Aici trebuia numele unui tabel, dar proiectul nu are încă tabele. Adaugă unul în fereastra Bază de date.',
    unknownColumn: "Tabelul {0} nu are coloana '{1}'. Coloanele lui: {2}.",
    unknownName: "Nu cunosc '{0}'.",
    didYouMean: " Te-ai gândit la '{0}'?",
    unknownProp: "{0} nu are proprietatea '{1}'. Are: {2}.",
    readOnlyProp: "Proprietatea '{0}' poate fi doar citită, nu schimbată.",
    pageNeedsProp: 'Scrie o proprietate după page, de exemplu page.title.',
    sessionNeedsKey: 'Scrie un nume după session, de exemplu session.user.',
    unknownFunction: "Nu există nicio funcție numită '{0}'.",
    notAFunction: "'{0}' nu este o funcție, deci nu poate fi apelată cu ( ).",
    argCount: '{0} are nevoie de {1}, dar a primit {2}.',
    nValues: '{0} valoare/valori',
    dupFunction: "Există deja o funcție numită '{0}' (în {1}, linia {2}).",
    dupBuiltin: "'{0}' este deja numele unei funcții din limbaj. Alege alt nume.",
    clientOnly: "'{0}' merge doar pe pagină, nu într-o funcție de server.",
    serverOnly: "'{0}' merge doar într-o funcție de server.",
    clientFnInServer: "Funcția de server nu poate apela '{0}', pentru că '{0}' rulează pe pagină. Aici se pot apela doar funcții de server.",
    controlInServer: 'O funcție de server nu poate folosi {0}: pagina nu se află pe server. Dă valoarea funcției ca parametru sau returnează un rezultat și folosește-l pe pagină.',
    controlInSite: 'Codul comun (Site) nu poate folosi {0}, pentru că {0} nu se află pe toate paginile. Pune acest cod în codul paginii.',
    eventInSite: "Codul comun (Site) poate avea doar blocuri 'when page loads' și 'every'. Pune evenimentele controalelor în codul paginii.",
    nameIsControl: "'{0}' este numele unui control de pe această pagină. Dă variabilei alt nume.",
    nameIsFunction: "'{0}' este o funcție. Dă variabilei alt nume.",
    nameIsTable: "'{0}' este un tabel. Dă variabilei alt nume.",
    loopOnly: "'{0}' se poate folosi doar într-o buclă (repeat, while, for) sau într-un switch.",
    caseOutside: "'{0}' se poate folosi doar într-un switch.",
    caseFirst: 'Într-un switch, începe cu case (sau default) înainte de linii.',
    twoDefaults: 'Acest switch are deja un default.',
    noEffect: 'Linia aceasta nu face nimic.',
    tableValue: '{0} este un tabel. Ca să iei rândurile lui, scrie: find all {0}',
    whereFunc: "În 'where', o coloană poate fi comparată (=, <, contains...) dar nu dată unei funcții.",
    whereLike: "În 'where', scrie întâi coloana, de exemplu: name contains \"an\".",
    sessionClient: 'session merge doar într-o funcție de server.',
    sqlInClient: "'{0}' merge doar într-o funcție de server.",
    expectedUnit: 'Aici trebuia seconds sau milliseconds.',
    missingTo: "Aici trebuia '{0}', de exemplu: set score to 10.",
    unknownStatement: "Nu știu cum să încep o linie cu '{0}'.",
    pageUnknown: "Nu există nicio pagină numită '{0}'. Paginile tale: {1}.",
    tooDeep: 'Codul acesta are prea multe blocuri unul în altul.',
    colSelf: 'Aici coloana {0} este comparată cu ea însăși, deci condiția e mereu adevărată. Dacă {0} este și o variabilă, dă variabilei alt nume.'
  }, L.messages.ro || {});

  function msg(lang, key, args) {
    var tbl = L.messages[lang] || L.messages.en;
    var s = tbl[key];
    if (s === undefined || s === '') s = L.messages.en[key] || key;
    return String(s).replace(/\{(\d+)\}/g, function (m, i) {
      return args && args[i] !== undefined ? String(args[i]) : m;
    });
  }
  L.msg = msg;

  function WzError(key, args, tok, extra) {
    this.key = key;
    this.args = args || [];
    this.tok = tok;
    this.extra = extra || '';
  }

  /* =====================================================================
   * Language packs and vocabulary
   * ===================================================================== */

  /**
   * Register a language pack. See language/packs/core.js for the format.
   *   { id, name, version, author, description,
   *     vocab:     { en: { canonical: ["phrase", ...] } },
   *     commands:  [ { id, patterns: { en: ["show message {text}"] }, js, php, ... } ],
   *     functions: [ { id, names: { en: ["upper"] }, params: ["text"], js, php, ... } ],
   *     translate: { ro: { commands: { id: { doc } }, functions: { id: { doc } } } },   (descriptions in other languages)
   *     runtime:   { js: "...", php: "..." },
   *     messages:  { xx: { key: "text" } } }
   */
  L.registerPack = function (pack) {
    if (!pack || !pack.id) throw new Error('A language pack needs an id.');
    L.packs[pack.id] = pack;
    if (L.packOrder.indexOf(pack.id) < 0) L.packOrder.push(pack.id);
    if (pack.messages) {
      Object.keys(pack.messages).forEach(function (lg) {
        L.messages[lg] = Object.assign({}, L.messages[lg] || {}, pack.messages[lg]);
      });
    }
    L._rev++;
    vocabCache = {};
    return pack;
  };

  L.unregisterPack = function (id) {
    delete L.packs[id];
    var i = L.packOrder.indexOf(id);
    if (i >= 0) L.packOrder.splice(i, 1);
    L._rev++;
    vocabCache = {};
  };

  var vocabCache = {};

  function parsePhrase(p) {
    return String(p).trim().split(/\s+/).filter(Boolean).map(norm);
  }

  function parsePattern(pat) {
    var parts = [], lits = [], re = /\{(\w+)(?::(\w+))?\}|([^\s{}]+)/g, m;
    while ((m = re.exec(pat))) {
      if (m[1]) {
        if (lits.length) { parts.push({ lit: lits }); lits = []; }
        parts.push({ slot: m[1], kind: m[2] || 'expr' });
      } else {
        lits.push(norm(m[3]));
      }
    }
    if (lits.length) parts.push({ lit: lits });
    return parts;
  }

  function Vocab(langs) {
    this.langs = langs;
    this.lang = langs[0];
    this.phrases = {};      // canonical -> [[word, word], ...] (normal form, longest first)
    this.display = {};      // lang -> canonical -> original phrase text
    this.displayAll = {};   // lang -> canonical -> [every way it is written]
    this.firstWords = {};   // normal word -> true (a keyword phrase can start with it)
    this.commands = [];     // { def, parts, lang, pattern }
    this.cmdByFirst = {};
    this.functions = {};    // normal name -> def
    this.funcDefs = {};     // id -> def
    this.cmdDefs = {};      // id -> def
    this.methods = {};      // normal name -> function def, used after a dot: x.upper() is upper(x)
    this.cmdCalls = {};     // normal name -> command def written like a function: message("Hi")
    this.cmdMethods = {};   // normal name -> command def written like a method of a control: Panel1.show()
    this.cmdFirst = {};     // command id -> its first pattern
    this.eventKeys = [];    // canonical keys starting with "ev."
    this.propByWord = {};   // normal word -> prop key ("text")
    this.runtimeJs = [];
    this.runtimePhp = [];
  }
  Vocab.prototype.add = function (canon, phrase, lang) {
    var words = parsePhrase(phrase);
    if (!words.length) return;
    var list = this.phrases[canon] || (this.phrases[canon] = []);
    var key = words.join(' ');
    if (!list.some(function (w) { return w.join(' ') === key; })) list.push(words);
    this.firstWords[words[0]] = true;
    var d = this.display[lang] || (this.display[lang] = {});
    if (!d[canon]) d[canon] = String(phrase).trim();
    var da = this.displayAll[lang] || (this.displayAll[lang] = {});
    (da[canon] || (da[canon] = [])).push(String(phrase).trim());
    if (canon.indexOf('prop.') === 0 && words.length === 1) {
      if (!this.propByWord[words[0]]) this.propByWord[words[0]] = canon.slice(5);
    }
  };
  /** How a canonical word is written ("prop.text" -> "text"). */
  Vocab.prototype.say = function (canon, lang) {
    lang = lang || this.lang;
    var d = this.display[lang];
    if (d && d[canon]) return d[canon];
    for (var i = 0; i < this.langs.length; i++) {
      var d2 = this.display[this.langs[i]];
      if (d2 && d2[canon]) return d2[canon];
    }
    var ph = this.phrases[canon];
    return ph && ph[0] ? ph[0].join(' ') : canon.replace(/^\w+\./, '');
  };
  /** The shortest way to write a word (used after "end": "end repeat"). */
  Vocab.prototype.sayShort = function (canon, lang) {
    lang = lang || this.lang;
    var list = (this.displayAll[lang] || {})[canon];
    if (!list || !list.length) {
      for (var i = 0; i < this.langs.length && !(list && list.length); i++) list = (this.displayAll[this.langs[i]] || {})[canon];
    }
    if (!list || !list.length) return this.say(canon, lang);
    var best = list[0];
    list.forEach(function (x) { if (x.split(/\s+/).length < best.split(/\s+/).length) best = x; });
    return best;
  };
  Vocab.prototype.finish = function () {
    Object.keys(this.phrases).forEach(function (k) {
      this.phrases[k].sort(function (a, b) { return b.length - a.length; });
      if (k.indexOf('ev.') === 0) this.eventKeys.push(k);
    }, this);
    Object.keys(this.cmdByFirst).forEach(function (k) {
      this.cmdByFirst[k].sort(function (a, b) {
        var la = a.parts[0].lit.length, lb = b.parts[0].lit.length;
        if (lb !== la) return lb - la;
        return litCount(b.parts) - litCount(a.parts);
      });
    }, this);
  };
  function litCount(parts) {
    var n = 0;
    parts.forEach(function (p) { if (p.lit) n += p.lit.length; });
    return n;
  }

  /**
   * Build the vocabulary for some languages ("en", "ro") from the packs.
   */
  L.getVocab = function (langs, packIds) {
    langs = (langs && langs.length) ? langs.slice() : ['en'];
    packIds = packIds ? packIds.filter(function (id) { return L.packs[id]; }) : L.packOrder.slice();
    var key = langs.join(',') + '|' + packIds.join(',') + '|' + L._rev;
    if (vocabCache[key]) return vocabCache[key];
    var v = new Vocab(langs);
    var cmdDefs = {}, fnDefs = {}, cmdOrder = [], fnOrder = [];

    packIds.forEach(function (id) {
      var p = L.packs[id];
      (p.commands || []).forEach(function (c) {
        if (!c || !c.id) return;
        if (!cmdDefs[c.id]) cmdOrder.push(c.id);
        cmdDefs[c.id] = Object.assign({ pack: id }, c, {
          patterns: Object.assign({}, c.patterns || {}),
          doc: Object.assign({}, c.doc || {}),
          example: Object.assign({}, c.example || {})
        });
      });
      (p.functions || []).forEach(function (f) {
        if (!f || !f.id) return;
        if (!fnDefs[f.id]) fnOrder.push(f.id);
        fnDefs[f.id] = Object.assign({ pack: id }, f, {
          names: Object.assign({}, f.names || {}),
          doc: Object.assign({}, f.doc || {}),
          paramNames: Object.assign({}, f.paramNames || {}),
          example: Object.assign({}, f.example || {})
        });
      });
      if (p.runtime && p.runtime.js) v.runtimeJs.push(p.runtime.js);
      if (p.runtime && p.runtime.php) v.runtimePhp.push(p.runtime.php);
    });
    // translations of commands and functions into other languages
    packIds.forEach(function (id) {
      var p = L.packs[id];
      if (!p.translate) return;
      Object.keys(p.translate).forEach(function (lg) {
        var tr = p.translate[lg] || {};
        Object.keys(tr.commands || {}).forEach(function (cid) {
          var d = cmdDefs[cid], t = tr.commands[cid];
          if (!d || !t) return;
          if (t.patterns) d.patterns[lg] = (d.patterns[lg] || []).concat(t.patterns);
          if (t.doc) d.doc[lg] = t.doc;
          if (t.example) d.example[lg] = t.example;
        });
        Object.keys(tr.functions || {}).forEach(function (fid) {
          var d = fnDefs[fid], t = tr.functions[fid];
          if (!d || !t) return;
          if (t.names) d.names[lg] = (d.names[lg] || []).concat(t.names);
          if (t.doc) d.doc[lg] = t.doc;
          if (t.params) d.paramNames[lg] = t.params;
          if (t.example) d.example[lg] = t.example;
        });
      });
    });
    // words
    packIds.forEach(function (id) {
      var p = L.packs[id];
      langs.forEach(function (lg) {
        var voc = p.vocab && p.vocab[lg];
        if (!voc) return;
        Object.keys(voc).forEach(function (canon) {
          [].concat(voc[canon]).forEach(function (ph) { v.add(canon, ph, lg); });
        });
      });
    });
    // commands
    cmdOrder.forEach(function (cid) {
      var d = cmdDefs[cid];
      v.cmdDefs[cid] = d;
      langs.forEach(function (lg) {
        (d.patterns[lg] || []).forEach(function (pat) {
          var parts = parsePattern(pat);
          if (!parts.length || !parts[0].lit) return;
          var c = { def: d, parts: parts, lang: lg, pattern: pat };
          v.commands.push(c);
          if (!v.cmdFirst[cid]) v.cmdFirst[cid] = c;
          var fw = parts[0].lit[0];
          (v.cmdByFirst[fw] || (v.cmdByFirst[fw] = [])).push(c);
        });
      });
      if (!v.cmdFirst[cid]) return;
      // message("Hi") and Panel1.show(): the same commands, written like C
      [].concat(d.call || []).forEach(function (nm) { var n = norm(nm); if (!v.cmdCalls[n]) v.cmdCalls[n] = d; });
      [].concat(d.method || []).forEach(function (nm) { var n = norm(nm); if (!v.cmdMethods[n]) v.cmdMethods[n] = d; });
    });
    // functions
    fnOrder.forEach(function (fid) {
      var d = fnDefs[fid];
      v.funcDefs[fid] = d;
      langs.forEach(function (lg) {
        (d.names[lg] || []).forEach(function (nm) {
          var n = norm(nm);
          if (!v.functions[n]) v.functions[n] = d;
        });
      });
    });
    // methods: x.upper() is upper(x). The names in "methods" work only after a dot (x.toUpper()).
    fnOrder.forEach(function (fid) {
      var d = fnDefs[fid];
      if (!(d.params || []).length) return;
      [].concat(d.methods || []).forEach(function (nm) { var n = norm(nm); if (!v.methods[n]) v.methods[n] = d; });
    });
    fnOrder.forEach(function (fid) {
      var d = fnDefs[fid];
      if (!(d.params || []).length) return;
      langs.forEach(function (lg) {
        (d.names[lg] || []).forEach(function (nm) { var n = norm(nm); if (!v.methods[n]) v.methods[n] = d; });
      });
    });
    v.finish();
    vocabCache[key] = v;
    return v;
  };

  /** The name of a function in a language (for help, autocomplete, translation). */
  L.fnName = function (def, lang) {
    var names = def.names[lang] || def.names.en || [];
    return names[0] || def.id;
  };

  /* =====================================================================
   * Lexer
   * ===================================================================== */

  var DQ_OPEN = '"\u201C\u201D\u201E\u00AB';   // " “ ” „ «
  var DQ_CLOSE = '"\u201D\u201C\u00BB';        // " ” “ »
  var SQ_OPEN = "'\u2018\u2019";               // ' ‘ ’
  var SQ_CLOSE = "'\u2019\u2018";
  // === and !== are written as == and != (Wemazy has one kind of equality)
  var OPS3 = { '===': '==', '!==': '!=' };
  var OPS2 = ['<=', '>=', '<>', '!=', '==', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '<<', '>>'];
  var OPS1 = '=<>+-*/%^&()[]{},.:;!?';
  var reWordStart = /[\p{L}_]/u, reWordChar = /[\p{L}\p{N}_]/u;

  function isDigit(c) { return c >= '0' && c <= '9'; }

  /**
   * Turn source text into tokens.
   * Tokens: { t: 'word'|'num'|'str'|'op'|'nl'|'eof'|'bad', v, n, line, col, pos, end }
   * A line break is a token ('nl'), except inside ( ) and [ ]. A ';' is a line break too.
   * Braces { } don't hide line breaks: they are blocks of code, or records that the
   * parser reads across lines.
   * Options: { comments: true } also returns comment tokens (for highlighting).
   */
  function lex(src, opts) {
    opts = opts || {};
    var toks = [], errors = [], comments = [];
    var i = opts.from || 0, end = opts.to === undefined ? src.length : opts.to;
    var line = opts.line || 1, lineStart = opts.lineStart || 0;
    var stack = [];   // the open ( [ {

    function tok(t, v, start, extra) {
      var o = { t: t, v: v, line: line, col: start - lineStart + 1, pos: start, end: i };
      if (extra) Object.assign(o, extra);
      toks.push(o);
      return o;
    }
    function err(key, args, start, len) {
      errors.push({ key: key, args: args || [], line: line, col: start - lineStart + 1, pos: start, len: len || 1 });
    }
    function inParens() { var t = stack[stack.length - 1]; return t === '(' || t === '['; }
    function lineBreak(at) {
      if (inParens()) return;
      var last = toks[toks.length - 1];
      if (last && last.t !== 'nl') tok('nl', '\n', at);
    }
    /** Close the nearest open bracket of this kind (a ) never closes past a {). */
    function closeTo(open) {
      for (var k = stack.length - 1; k >= 0; k--) {
        if (stack[k] === open) { stack.length = k; return; }
        if (stack[k] === '{') return;
      }
    }

    while (i < end) {
      var c = src[i];
      if (c === '\n') {
        lineBreak(i);
        i++; line++; lineStart = i;
        continue;
      }
      if (c === ' ' || c === '\t' || c === '\r' || c === '\u00A0' || c === '\uFEFF') { i++; continue; }
      if (c === '#' || (c === '/' && src[i + 1] === '/')) {
        var cs = i;
        while (i < end && src[i] !== '\n') i++;
        if (opts.comments) comments.push({ line: line, col: cs - lineStart + 1, pos: cs, end: i });
        continue;
      }
      if (c === '/' && src[i + 1] === '*') {
        // /* a note that can take several lines */
        var bs = i, bLine = line, bCol = i - lineStart + 1, crossed = false, shut = false;
        i += 2;
        while (i < end) {
          if (src[i] === '*' && src[i + 1] === '/') { i += 2; shut = true; break; }
          if (src[i] === '\n') { crossed = true; line++; lineStart = i + 1; }
          i++;
        }
        if (!shut) errors.push({ key: 'unclosedComment', args: [], line: bLine, col: bCol, pos: bs, len: 2 });
        if (opts.comments) comments.push({ line: bLine, col: bCol, pos: bs, end: i });
        if (crossed) lineBreak(i);
        continue;
      }
      var start = i;
      if (isDigit(c)) {
        var isFloat = false;
        while (i < end && isDigit(src[i])) i++;
        if (src[i] === '.' && isDigit(src[i + 1] || '')) {
          i++;
          isFloat = true;
          while (i < end && isDigit(src[i])) i++;
        }
        // 2.0 is a float, 2 is a whole number (it matters for typed values: int32 a; a / 2.0)
        tok('num', parseFloat(src.slice(start, i)), start, isFloat ? { f: true } : null);
        continue;
      }
      var dq = DQ_OPEN.indexOf(c) >= 0, sq = !dq && SQ_OPEN.indexOf(c) >= 0;
      if (dq || sq) {
        i++;
        var closers = dq ? DQ_CLOSE : SQ_CLOSE;
        var parts = [], buf = '', closed = false, interp = [];
        while (i < end) {
          var ch = src[i];
          if (ch === '\n') break;
          if (ch === '\\' && i + 1 < end && src[i + 1] !== '\n') {
            var nx = src[i + 1];
            var map = { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'", '{': '{', '}': '}' };
            if (map[nx] !== undefined) buf += map[nx];
            else buf += ch + nx;
            i += 2;
            continue;
          }
          if (closers.indexOf(ch) >= 0) { i++; closed = true; break; }
          if (dq && ch === '{') {
            // find the matching }
            var j = i + 1, d = 1, inS = null;
            while (j < end && src[j] !== '\n') {
              var cj = src[j];
              if (inS) {
                if (cj === '\\') { j += 2; continue; }
                if (inS.indexOf(cj) >= 0) inS = null;
              } else if (DQ_OPEN.indexOf(cj) >= 0) inS = DQ_CLOSE;
              else if (SQ_OPEN.indexOf(cj) >= 0) inS = SQ_CLOSE;
              else if (cj === '{') d++;
              else if (cj === '}') { d--; if (d === 0) break; }
              j++;
            }
            if (j >= end || src[j] !== '}') {
              err('unclosedBrace', [], i, 1);
              buf += ch; i++;
              continue;
            }
            if (buf) parts.push(buf);
            buf = '';
            var inner = src.slice(i + 1, j);
            if (!inner.trim()) {
              err('emptyBrace', [], i, j - i + 1);
            } else {
              var sub = lex(src, { from: i + 1, to: j, line: line, lineStart: lineStart, inner: true });
              sub.errors.forEach(function (e) { errors.push(e); });
              var stoks = sub.tokens.filter(function (t) { return t.t !== 'nl'; });
              parts.push({ toks: stoks, pos: i, end: j + 1 });
              interp.push({ pos: i, end: j + 1, toks: stoks });
            }
            i = j + 1;
            continue;
          }
          buf += ch;
          i++;
        }
        if (!closed) err('unclosedString', [], start, i - start);
        if (buf || !parts.length) parts.push(buf);
        tok('str', null, start, { parts: parts, raw: sq, interp: interp });
        continue;
      }
      if (reWordStart.test(c)) {
        while (i < end && reWordChar.test(src[i])) i++;
        var w = src.slice(start, i);
        tok('word', w, start, { n: norm(w) });
        continue;
      }
      var three = src.substr(i, 3);
      if (OPS3[three]) {
        i += 3;
        tok('op', OPS3[three], start);
        continue;
      }
      var two = src.substr(i, 2);
      if (OPS2.indexOf(two) >= 0) {
        i += 2;
        tok('op', two, start);
        continue;
      }
      if (OPS1.indexOf(c) >= 0) {
        i++;
        if (c === ';') {
          // end of a statement; inside ( ) it separates the parts of a C-style for
          if (!inParens()) { var lt = toks[toks.length - 1]; if (lt && lt.t !== 'nl') tok('nl', ';', start); }
          else tok('op', ';', start);
          continue;
        }
        if (c === '(' || c === '[') stack.push(c);
        else if (c === ')') closeTo('(');
        else if (c === ']') closeTo('[');
        else if (c === '}') closeTo('{');
        else if (c === '{') {
          // "if (x > 1 {": a { right after a value starts a block, so a ( before it was never closed
          var pv = toks[toks.length - 1];
          if (inParens() && pv && (pv.t === 'word' || pv.t === 'num' || pv.t === 'str' || (pv.t === 'op' && (pv.v === ')' || pv.v === ']')))) {
            while (stack.length && stack[stack.length - 1] !== '{') stack.pop();
          }
          stack.push('{');
        }
        tok('op', c, start);
        continue;
      }
      i++;
      tok('bad', c, start);
      err('badChar', [c], start, 1);
    }
    if (!opts.inner) {
      var lt2 = toks[toks.length - 1];
      if (lt2 && lt2.t !== 'nl') toks.push({ t: 'nl', v: '', line: line, col: i - lineStart + 1, pos: i, end: i });
      toks.push({ t: 'eof', v: '', line: line, col: i - lineStart + 1, pos: i, end: i });
    }
    return { tokens: toks, errors: errors, comments: comments };
  }
  L.lex = lex;

  /* =====================================================================
   * Parser -> syntax tree
   *
   * Blocks can be written in two ways, and both can be mixed in a project:
   *   if (score > 10) {            if score > 10 then
   *       print "big"                  print "big"
   *   } else {                     else
   *       print "small"                print "small"
   *   }                            end if
   * A block statement can also take one statement on the same line:
   *   if (x > 0) print "yes"       if x > 0 then print "yes"
   * ===================================================================== */

  var BLOCK_END_WORDS = {
    'if': ['if'], repeat: ['repeat', 'while'], 'while': ['while', 'repeat'], 'for': ['for', 'foreach'],
    'function': ['function'], when: ['when'], every: ['every'], 'try': ['try']
  };
  var RESERVED = ['then', 'end', 'else', 'and', 'or', 'not', 'xor', 'nand', 'nor', 'xnor', 'shl', 'shr', 'mod', 'is'];
  /**
   * The word operators come in two spellings:
   *   AND OR XOR NAND NOR XNOR NOT   in capitals: LOGICAL - true or false, like && || !
   *   and or xor nand nor xnor not   in small letters: BINARY - bit by bit on whole numbers
   *                                  (a true/false value is one bit, so "x > 1 and y < 2" still works)
   */
  function isUpperWord(tok) { return tok.t === 'word' && tok.v === tok.v.toUpperCase() && tok.v !== tok.v.toLowerCase(); }
  var LOGIC_OPS = { and: 'and', or: 'or', xor: 'xor', nand: 'nand', nor: 'nor', xnor: 'xnor' };
  var BIT_OPS = { and: 'band', or: 'bor', xor: 'bxor', nand: 'bnand', nor: 'bnor', xnor: 'bxnor' };
  L.logicWords = ['and', 'or', 'xor', 'nand', 'nor', 'xnor', 'not', 'shl', 'shr'];
  var CMP_PHRASES = [
    ['isnotempty', 'notempty'], ['isempty', 'empty'],
    ['gt', '>'], ['lt', '<'], ['ge', '>='], ['le', '<='], ['eq', '='],
    ['isnot', '!='], ['startswith', 'starts'], ['endswith', 'ends'], ['contains', 'contains'], ['is', '=']
  ];
  var SYM_CMP = { '=': '=', '==': '=', '!=': '!=', '<>': '!=', '<': '<', '>': '>', '<=': '<=', '>=': '>=' };
  var ASSIGN_OPS = { '=': 1, '++': 1, '--': 1, '+=': 1, '-=': 1, '*=': 1, '/=': 1, '%=': 1, '&=': 1 };
  // the built-in types, with the other names C, C++, C# and Java give them
  var BUILTIN_TYPES = {
    bool: 'bool', boolean: 'bool', char: 'char', string: 'string',
    int8: 'int8', int16: 'int16', int32: 'int32', int64: 'int64',
    uint8: 'uint8', uint16: 'uint16', uint32: 'uint32', uint64: 'uint64',
    int: 'int32', integer: 'int32', short: 'int16', long: 'int64', sbyte: 'int8', byte: 'uint8',
    uint: 'uint32', ushort: 'uint16', ulong: 'uint64',
    float16: 'float16', float32: 'float32', float64: 'float64', half: 'float16', float: 'float32', double: 'float64',
    void: 'void', object: 'any', dynamic: 'any', auto: 'any'
  };
  L.builtinTypes = BUILTIN_TYPES;
  // words that can come before the members of a class
  var MEMBER_MODS = { 'public': 1, 'private': 1, 'protected': 1, 'internal': 1, 'static': 1, 'virtual': 1, 'override': 1,
    'abstract': 1, 'sealed': 1, 'const': 1, 'readonly': 1, 'new': 1, 'final': 1 };
  // words that can come before "class" / "struct"
  var TYPE_MODS = { 'public': 1, 'private': 1, 'internal': 1, 'abstract': 1, 'sealed': 1, 'static': 1, 'partial': 1, 'final': 1 };
  var TYPE_KINDS = { 'struct': 1, 'union': 1, 'class': 1, 'interface': 1 };
  var ACCESS = { 'public': 'public', 'private': 'private', 'protected': 'protected', 'internal': 'public' };
  // the words of types and classes (for the editor: colours and IntelliSense)
  L.typeWords = ['struct', 'union', 'class', 'interface', 'new', 'this', 'base', 'super', 'inherits', 'extends', 'implements',
    'public', 'private', 'protected', 'internal', 'static', 'virtual', 'override', 'abstract', 'sealed', 'readonly',
    'unsigned', 'signed', 'sizeof', 'constructor', 'as', 'const', 'void'];
  L.typeAccess = ACCESS;
  // methods that are statements: list.add(x), list.remove(x), list.clear()
  var STMT_METHODS = { add: 'Add', push: 'Add', append: 'Add', remove: 'Remove', clear: 'Clear' };
  // x.length (without parentheses) is the length of a text or list
  var LENGTH_WORDS = { length: 1, size: 1, count: 1 };

  function Parser(toks, ctx) {
    this.t = toks;
    this.i = 0;
    this.ctx = ctx;
    this.v = ctx.vocab;
    this.depth = 0;
    this.blocks = [];   // the blocks being read, innermost last: { brace, kind, stops }
  }
  var P = Parser.prototype;

  P.cur = function () { return this.t[this.i]; };
  P.peek = function (k) { var j = this.i + (k || 0); return this.t[j < this.t.length ? j : this.t.length - 1]; };
  P.advance = function () { var tk = this.t[this.i]; if (this.i < this.t.length - 1) this.i++; return tk; };
  P.isNL = function (k) { var tk = this.peek(k); return tk.t === 'nl' || tk.t === 'eof'; };
  P.isOp = function (v, k) { var tk = this.peek(k); return tk.t === 'op' && tk.v === v; };
  P.eatOp = function (v) { return this.isOp(v) ? this.advance() : null; };
  P.expectOp = function (v) {
    if (this.isOp(v)) return this.advance();
    this.fail('expected', ["'" + v + "'"]);
  };
  /** How many tokens a phrase of `canon` covers at offset k (0 = none). */
  P.m = function (canon, k) {
    var phrases = this.v.phrases[canon];
    if (!phrases) return 0;
    var base = this.i + (k || 0);
    outer:
    for (var p = 0; p < phrases.length; p++) {
      var ph = phrases[p];
      for (var j = 0; j < ph.length; j++) {
        var tk = this.t[base + j];
        if (!tk || tk.t !== 'word' || tk.n !== ph[j]) continue outer;
      }
      return ph.length;
    }
    return 0;
  };
  P.is = function (canon, k) { return this.m(canon, k) > 0; };
  P.eat = function (canon) {
    var n = this.m(canon);
    if (!n) return null;
    var tk = this.t[this.i];
    this.i += n;
    return tk;
  };
  P.expect = function (canon, key) {
    var tk = this.eat(canon);
    if (tk) return tk;
    this.fail(key || 'expected', ["'" + this.v.say(canon) + "'"]);
  };
  P.fail = function (key, args, tok) { throw new WzError(key, args, tok || this.cur()); };
  P.expectNL = function () {
    if (!this.isNL()) this.fail('extraTokens', [this.restText()]);
  };
  /** The end of a statement: a line break, a } (the end of a block) or, in a one-line if, else. */
  P.endAt = function (k) { return this.isNL(k) || this.isOp('}', k) || this.is('else', k); };
  P.expectEnd = function () {
    if (!this.isNL() && !this.isOp('}')) this.fail('extraTokens', [this.restText()]);
  };
  P.isAssignOp = function (k) { var tk = this.peek(k); return tk.t === 'op' && ASSIGN_OPS[tk.v] === 1; };
  /** A statement word used as a statement ("print x"), not as a name ("print = 3", "print.x"). */
  P.kw = function (canon) {
    var n = this.m(canon);
    return n > 0 && !this.isAssignOp(n) && !this.isOp('.', n);
  };
  P.restText = function () {
    var a = this.cur(), j = this.i, b = a;
    while (this.t[j] && this.t[j].t !== 'nl' && this.t[j].t !== 'eof') { b = this.t[j]; j++; }
    var src = this.ctx.src || '';
    return src.slice(a.pos, b.end).trim() || a.v;
  };
  P.skipNL = function () { while (this.cur().t === 'nl') this.advance(); };
  /**
   * Skip the rest of a line. Returns how many { it left open.
   * It stops before a } that closes a block around the line.
   */
  P.skipLineBal = function () {
    var bal = 0;
    for (;;) {
      var tk = this.cur();
      if (tk.t === 'nl' || tk.t === 'eof') break;
      if (tk.t === 'op' && tk.v === '{') bal++;
      else if (tk.t === 'op' && tk.v === '}') {
        if (bal === 0) break;
        bal--;
      }
      this.advance();
    }
    return bal;
  };
  P.skipLine = P.skipLineBal;
  /** Skip up to the } that closes `bal` open braces. */
  P.skipBraces = function (bal) {
    while (bal > 0 && this.cur().t !== 'eof') {
      var tk = this.cur();
      if (tk.t === 'op' && tk.v === '{') bal++;
      else if (tk.t === 'op' && tk.v === '}') bal--;
      this.advance();
    }
  };
  /** After skipping a broken { } block: skip its "else { }" / "catch { }" parts too. */
  P.skipElseChain = function () {
    for (;;) {
      var j = this.cur().t === 'nl' ? 1 : 0;
      if (!this.is('else', j) && !this.is('onerror', j)) return;
      if (j) this.advance();
      var bal = this.skipLineBal();
      if (bal === 0 && this.cur().t === 'nl' && this.isOp('{', 1)) { this.advance(); bal = this.skipLineBal(); }
      if (bal === 0) return;
      this.skipBraces(bal);
    }
  };
  /** A stray else / catch: skip it with its block. */
  P.recoverStray = function () {
    var bal = this.skipLineBal();
    if (bal === 0 && this.cur().t === 'nl' && this.isOp('{', 1)) { this.advance(); bal = this.skipLineBal(); }
    if (bal > 0) this.skipBraces(bal);
  };
  P.record = function (e) {
    var tk = e.tok || this.cur();
    this.ctx.errors.push({
      key: e.key, args: e.args, line: tk.line, col: tk.col, pos: tk.pos,
      len: Math.max(1, (tk.end || tk.pos + 1) - tk.pos), extra: e.extra
    });
  };
  P.reservedAt = function (k) {
    for (var r = 0; r < RESERVED.length; r++) if (this.m(RESERVED[r], k) === 1) return true;
    return false;
  };
  /** Is a { } block around the current position? (from = how many inner blocks to leave out) */
  P.insideBrace = function (from) {
    for (var k = this.blocks.length - 1 - (from || 0); k >= 0; k--) if (this.blocks[k].brace) return true;
    return false;
  };

  function node(type, tok, props) {
    var o = { type: type, line: tok ? tok.line : 0, col: tok ? tok.col : 0, pos: tok ? tok.pos : 0, end: tok ? tok.end : 0 };
    return props ? Object.assign(o, props) : o;
  }

  P.parseProgram = function () {
    var body = [];
    this.skipNL();
    while (this.cur().t !== 'eof') {
      if (this.is('end')) {
        this.record(new WzError('strayEnd', [this.cur().v], this.cur()));
        this.skipLineBal();
      } else if (this.is('else') || this.is('onerror')) {
        this.record(new WzError('strayElse', [this.cur().v], this.cur()));
        this.recoverStray();
      } else if (this.isOp('}')) {
        this.record(new WzError('strayBrace', [], this.cur()));
        this.advance();
      } else {
        this.parseStmtInto(body);
      }
      this.skipNL();
    }
    return body;
  };

  /** The kind of block statement that starts here, or null. */
  P.blockKindAt = function () {
    if (this.is('if')) return 'if';
    if (this.is('repeat')) return 'repeat';
    if (this.is('while')) return 'while';
    if (this.is('for') || this.is('foreach')) return 'for';
    if (this.is('function') || (this.is('server') && this.is('function', this.m('server')))) return 'function';
    if (this.is('when')) return 'when';
    if (this.is('every')) return 'every';
    if (this.is('try')) return 'try';
    if (this.is('do')) return 'do';
    return null;
  };

  /** Read only the header of a block statement (without its body). */
  P.parseHead = function (kind) {
    switch (kind) {
      case 'if': return this.headIf();
      case 'while': this.eat('while'); return { cond: this.parseExpr() };
      case 'repeat': return this.headRepeat();
      case 'for': return this.headFor();
      case 'function': return this.headFunction();
      case 'when': return this.headWhen();
      case 'every': return this.headEvery();
      case 'try': this.eat('try'); return {};
      case 'do': this.eat('do'); return {};
    }
    return null;
  };

  /**
   * Does the statement at token `start` open a block that is closed by "end ..."?
   * Returns its kind, or null (no block, a { } block, or a one-line statement).
   */
  P.openerAt = function (start) {
    var save = this.i, saveDepth = this.depth;
    this.i = start;
    var kind = this.blockKindAt();
    if (kind === 'do') kind = null;
    if (kind) {
      try {
        this.parseHead(kind);
        if (!this.isNL() || (this.cur().t === 'nl' && this.isOp('{', 1))) kind = null;
      } catch (e) {
        if (!(e instanceof WzError)) throw e;
        if (this.lineHasBlockBrace(start) || this.looksOneLine(start)) kind = null;
      }
    }
    this.i = save;
    this.depth = saveDepth;
    return kind;
  };
  /** The line ends with { (or the next line is a lone {). */
  P.lineHasBlockBrace = function (start) {
    var j = start, last = null;
    while (this.t[j] && this.t[j].t !== 'nl' && this.t[j].t !== 'eof') { last = this.t[j]; j++; }
    if (last && last.t === 'op' && last.v === '{') return true;
    var n1 = this.t[j], n2 = this.t[j + 1];
    return !!(n1 && n1.t === 'nl' && n2 && n2.t === 'op' && n2.v === '{');
  };
  /** A broken header that still looks like a one-line statement: "if x then y", "if (x) y". */
  P.looksOneLine = function (start) {
    var j = start, save = this.i, found = false;
    var first = this.t[start + 1];
    // "if (...) something": the ( after the keyword closes before the end of the line
    if (first && first.t === 'op' && first.v === '(') {
      var d = 0, k = start + 1;
      for (; this.t[k] && this.t[k].t !== 'nl' && this.t[k].t !== 'eof'; k++) {
        if (this.t[k].t === 'op' && this.t[k].v === '(') d++;
        else if (this.t[k].t === 'op' && this.t[k].v === ')') { d--; if (d === 0) break; }
      }
      var after = this.t[k + 1];
      if (d === 0 && after && after.t !== 'nl' && after.t !== 'eof' && !(after.t === 'op' && after.v === '{')) found = true;
    }
    while (!found && this.t[j] && this.t[j].t !== 'nl' && this.t[j].t !== 'eof') {
      this.i = j;
      var n = this.m('then');
      if (n && this.t[j + n] && this.t[j + n].t !== 'nl' && this.t[j + n].t !== 'eof') found = true;
      j++;
    }
    this.i = save;
    return found;
  };

  P.parseStmtInto = function (body) {
    var start = this.i;
    try {
      var st = this.parseStatement();
      if (st) body.push(st);
      this.expectEnd();
    } catch (e) {
      if (!(e instanceof WzError)) throw e;
      this.record(e);
      this.recover(start);
    }
  };

  /** After an error: skip the broken statement, and the block it opens, so later lines still make sense. */
  P.recover = function (start) {
    var startLine = this.t[start].line;
    var onStart = this.cur().line === startLine || this.cur().t === 'nl';
    var bal = this.skipLineBal();
    if (bal === 0 && onStart && this.cur().t === 'nl' && this.isOp('{', 1)) {
      // the { of the block is alone on the next line
      this.advance();
      bal = this.skipLineBal();
    }
    if (bal > 0) {
      this.skipBraces(bal);
      this.skipElseChain();
      return;
    }
    if (onStart) {
      var opener = this.openerAt(start);
      if (opener) this.recoverBlock(opener);
    }
  };

  /** After a broken "end"-style block header: skip its body up to its end. */
  P.recoverBlock = function (kind) {
    var depth = 1, inBrace = this.insideBrace(0);
    while (this.cur().t !== 'eof') {
      this.skipNL();
      if (this.cur().t === 'eof') return;
      if (this.isOp('}')) {
        if (inBrace) return;          // the } of a block around this one
        this.advance();
        continue;
      }
      var s = this.i;
      if (this.is('end')) {
        depth--;
        this.skipLineBal();
        if (depth === 0) return;
        continue;
      }
      if (this.openerAt(s)) depth++;
      var bal = this.skipLineBal();
      if (bal > 0) this.skipBraces(bal);
    }
    void kind;
  };

  /** An "end"-style block: the lines up to "end" (or up to one of the stop words, like else). */
  P.parseBlock = function (stops, kind, opener) {
    var body = [];
    this.depth++;
    this.blocks.push({ brace: false, kind: kind, stops: stops });
    try {
      if (this.depth > 60) this.fail('tooDeep', []);
      for (;;) {
        this.skipNL();
        var tk = this.cur();
        if (tk.t === 'eof') { this.missingEnd(kind, opener); break; }
        if (this.is('end')) break;
        var stop = false;
        for (var s = 0; s < stops.length; s++) if (this.is(stops[s])) stop = true;
        if (stop) break;
        if (this.isOp('}')) {
          // the } of a { } block around this one: this block was never closed
          if (this.insideBrace(1)) { this.missingEnd(kind, opener); break; }
          this.record(new WzError('strayBrace', [], tk));
          this.advance();
          continue;
        }
        if (this.is('else') || this.is('onerror')) {
          this.record(new WzError('strayElse', [tk.v], tk));
          this.recoverStray();
          continue;
        }
        this.parseStmtInto(body);
      }
    } finally {
      this.depth--;
      this.blocks.pop();
    }
    return body;
  };
  P.missingEnd = function (kind, opener) {
    if (opener.reported) return;
    opener.reported = true;
    this.record(new WzError('expectedEnd', [opener.v, opener.line, this.v.say('end') + ' ' + this.v.say(kind)], opener));
  };

  P.parseEnd = function (kind, opener) {
    if (opener.mixed) {
      // after a mistaken { } part (already reported): the "end" may be there or not
      var j = 0;
      while (this.peek(j).t === 'nl') j++;
      if (!this.is('end', j)) return;
      this.skipNL();
    }
    if (this.cur().t === 'eof' || this.isOp('}')) return;   // already reported
    var endTok = this.expect('end');
    var words = BLOCK_END_WORDS[kind] || [];
    var matched = false;
    for (var w = 0; w < words.length; w++) {
      if (this.eat(words[w])) { matched = true; break; }
    }
    if (!matched && !this.isNL()) {
      // 'end' followed by another block word?
      var all = Object.keys(BLOCK_END_WORDS), found = null;
      for (var a = 0; a < all.length; a++) if (this.is(all[a])) { found = all[a]; break; }
      if (found) {
        this.fail('wrongEnd', [this.v.say('end') + ' ' + this.v.say(kind), opener.v, opener.line,
          endTok.v + ' ' + this.cur().v], endTok);
      }
    }
    this.expectEnd();
  };

  /** A block between { and }. */
  P.parseBraceBlock = function (kw, kind) {
    var open = this.cur();
    this.expectOp('{');
    var body = [];
    this.depth++;
    this.blocks.push({ brace: true, kind: kind, stops: [] });
    try {
      if (this.depth > 60) this.fail('tooDeep', []);
      for (;;) {
        this.skipNL();
        var tk = this.cur();
        if (tk.t === 'eof') {
          this.record(new WzError('expectedBrace', [open.line], open));
          break;
        }
        if (this.isOp('}')) { this.advance(); break; }
        if (this.is('end')) {
          // an "end ..." where a } was expected
          if (this.endClosesOuter()) { this.record(new WzError('expectedBrace', [open.line], open)); break; }
          this.record(new WzError('endInBrace', [this.restText(), open.line], tk));
          this.skipLineBal();
          break;
        }
        if (this.is('else') || this.is('onerror')) {
          this.record(new WzError('strayElse', [tk.v], tk));
          this.recoverStray();
          continue;
        }
        this.parseStmtInto(body);
      }
    } finally {
      this.depth--;
      this.blocks.pop();
    }
    void kw;
    return body;
  };
  /** Does the "end ..." here close an end-style block around the current { } block? */
  P.endClosesOuter = function () {
    var n = this.m('end');
    for (var k = this.blocks.length - 2; k >= 0; k--) {
      var b = this.blocks[k];
      if (b.brace) continue;
      if (this.isNL(n)) return true;
      var words = BLOCK_END_WORDS[b.kind] || [];
      for (var w = 0; w < words.length; w++) if (this.is(words[w], n)) return true;
    }
    return false;
  };

  /** Is a { next (maybe alone on the next line)? Moves to it. */
  P.braceNext = function () {
    if (this.isOp('{')) return true;
    if (this.cur().t === 'nl' && this.isOp('{', 1)) { this.advance(); return true; }
    return false;
  };
  P.braceAhead = function () { return this.isOp('{') || (this.cur().t === 'nl' && this.isOp('{', 1)); };

  /**
   * The body of a block statement, after its header:
   *   { ... }                      style 'brace' (the { may be alone on the next line)
   *   line break, lines, "end ..." style 'end'   (the caller reads the end)
   *   one statement on the line    style 'single' (only when opts.single)
   */
  P.parseBody = function (kind, kw, opts) {
    opts = opts || {};
    if (this.braceNext()) return { body: this.parseBraceBlock(kw, kind), style: 'brace' };
    if (this.isNL()) {
      if (opts.noEnd) this.fail('needBrace', [kw.v], kw);
      return { body: this.parseBlock(opts.stops || [], kind, kw), style: 'end' };
    }
    if (opts.single) {
      this.depth++;
      try { return { body: [this.parseStatement()], style: 'single' }; } finally { this.depth--; }
    }
    this.fail('extraTokens', [this.restText()]);
  };

  /**
   * Is the next thing an else (or catch) of this block? On the same line ("} else {"),
   * or at the start of the next line. Inside an end-style if, an else further left
   * belongs to that if.
   */
  P.elseNext = function (canon, kw) {
    if (this.is(canon)) return true;
    if (this.cur().t !== 'nl' || !this.is(canon, 1)) return false;
    var nl = this.cur(), et = this.peek(1);
    if (et.line !== nl.line) {
      var top = this.blocks[this.blocks.length - 1];
      if (top && !top.brace && top.stops.indexOf(canon) >= 0 && et.col !== kw.col) return false;
    }
    this.advance();
    return true;
  };

  P.parseStatement = function () {
    var tk = this.cur();
    if (tk.t === 'op' && (tk.v === '++' || tk.v === '--')) return this.parseSimple();
    if (tk.t === 'word') {
      if (this.typeDeclAt() >= 0) return this.parseTypeDecl();
      if (this.is('if')) return this.parseIf();
      if (this.is('repeat')) return this.parseRepeat();
      if (this.is('while')) return this.parseWhile();
      if (this.is('for') || this.is('foreach')) return this.parseFor();
      if (this.is('do') && !this.isAssignOp(this.m('do'))) return this.parseDo();
      if (this.is('switch') && !this.isAssignOp(this.m('switch'))) return this.parseSwitch();
      if (this.is('case') || (this.is('default') && this.isOp(':', this.m('default')))) this.fail('caseOutside', [tk.v]);
      if (this.is('server') && this.is('function', this.m('server'))) return this.parseFunction(true);
      if (this.is('function')) return this.parseFunction(false);
      if (this.is('when')) return this.parseWhen();
      if (this.is('every')) return this.parseEvery();
      if (this.is('try')) return this.parseTry();
      if (this.is('var') && this.peek(this.m('var')).t === 'word') return this.parseVar();
      if (this.kw('set')) return this.parseSet();
      if ((this.is('increase') || this.is('decrease')) && !this.isAssignOp(1) && !this.isOp('.', 1)) return this.parseInc();
      if (this.is('return')) return this.parseReturn();
      if (this.is('stop') && this.endAt(this.m('stop'))) { var s1 = this.cur(); this.eat('stop'); return node('Break', s1, { tok: s1 }); }
      if (this.is('skip') && this.endAt(this.m('skip'))) { var s2 = this.cur(); this.eat('skip'); return node('Continue', s2, { tok: s2 }); }
      if (this.kw('wait')) return this.parseWait();
      if (this.kw('print')) {
        var pk = this.cur(); this.eat('print');
        return node('Print', pk, { value: this.parseExpr() });
      }
      if (this.kw('add')) return this.parseAddStmt();
      if (this.kw('remove')) return this.parseRemove();
      if (this.kw('clear')) {
        var ck = this.cur(); this.eat('clear');
        return node('Clear', ck, { target: this.parseTarget(true) });
      }
      if (this.is('update') && this.isTableAt(this.m('update'))) return this.parseUpdate();
      if (this.kw('delete')) return this.parseDelete();
      var cmd = this.tryCommand();
      if (cmd) return cmd;
    }
    return this.parseExprOrAssign();
  };

  /* ---- if ---- */

  P.headIf = function () {
    this.eat('if');
    var cond = this.parseExpr();
    this.eat('then');
    return { cond: cond };
  };

  P.parseIf = function () {
    var kw = this.cur();
    var head = this.headIf();
    var branches = [], els = null;
    var b = this.parseBody('if', kw, { single: true, stops: ['else'] });
    branches.push({ cond: head.cond, body: b.body });
    if (b.style === 'end') {
      while (this.is('else')) {
        var ek = this.cur();
        this.eat('else');
        if (this.is('if')) {
          var c2 = this.headIf().cond;
          branches.push({ cond: c2, body: this.endStyleBody(['else'], 'if', kw, ek), tok: ek });
        } else {
          els = this.endStyleBody([], 'if', kw, ek);
          break;
        }
      }
      this.parseEnd('if', kw);
      return node('If', kw, { branches: branches, els: els });
    }
    // { } blocks, or one statement on a line
    while (this.elseNext('else', kw)) {
      var ek2 = this.cur();
      this.eat('else');
      if (this.is('if')) {
        var c3 = this.headIf().cond;
        branches.push({ cond: c3, body: this.parseBody('if', ek2, { single: true, noEnd: true }).body, tok: ek2 });
      } else {
        els = this.parseBody('if', ek2, { single: true, noEnd: true }).body;
        break;
      }
    }
    return node('If', kw, { branches: branches, els: els, single: b.style === 'single' });
  };

  /**
   * The next part of an end-style if or try (after else / on error). A { here is a
   * mistake (one if can't mix the two ways): it is reported, and read anyway.
   */
  P.endStyleBody = function (stops, kind, kw, partTok) {
    if (this.braceAhead()) {
      this.record(new WzError('mixedBlocks', [kw.v, kw.line], partTok));
      kw.mixed = true;
      this.braceNext();
      return this.parseBraceBlock(partTok, kind);
    }
    this.expectNL();
    return this.parseBlock(stops, kind, kw);
  };

  /* ---- loops ---- */

  P.headRepeat = function () {
    this.eat('repeat');
    if (this.is('while') || this.is('until')) {
      var until = !this.eat('while');
      if (until) this.eat('until');
      return { mode: 'while', cond: this.parseExpr(), until: until };
    }
    if (this.eat('forever')) return { mode: 'forever' };
    if (this.braceAhead()) return { mode: 'bare' };
    var count = this.parseExpr();
    if (!this.eat('times') && !this.braceAhead()) this.expect('times');
    return { mode: 'count', count: count };
  };

  P.parseRepeat = function () {
    var kw = this.cur();
    var head = this.headRepeat();
    if (head.mode === 'bare') {
      // repeat { ... }   or   repeat { ... } while x   /   repeat { ... } until x
      this.braceNext();
      var body0 = this.parseBraceBlock(kw, 'repeat');
      if (this.is('while') || this.is('until')) {
        var until0 = !this.eat('while');
        if (until0) this.eat('until');
        return node('DoWhile', kw, { body: body0, cond: this.parseExpr(), until: until0 });
      }
      return node('While', kw, { cond: null, until: false, body: body0 });
    }
    var b = this.parseBody('repeat', kw, { single: true });
    if (b.style === 'end') this.parseEnd('repeat', kw);
    if (head.mode === 'count') return node('Repeat', kw, { count: head.count, body: b.body });
    return node('While', kw, { cond: head.mode === 'while' ? head.cond : null, until: !!head.until, body: b.body });
  };

  P.parseWhile = function () {
    var kw = this.cur();
    this.eat('while');
    var cond = this.parseExpr();
    var b = this.parseBody('while', kw, { single: true });
    if (b.style === 'end') this.parseEnd('while', kw);
    return node('While', kw, { cond: cond, until: false, body: b.body });
  };

  /** do { ... } while (x) */
  P.parseDo = function () {
    var kw = this.cur();
    this.eat('do');
    if (!this.braceNext()) this.fail('expected', ["'{'"]);
    var body = this.parseBraceBlock(kw, 'do');
    var j = this.cur().t === 'nl' && (this.is('while', 1) || this.is('until', 1)) ? 1 : 0;
    if (!this.is('while', j) && !this.is('until', j)) this.fail('doWhile', []);
    if (j) this.advance();
    var until = !this.eat('while');
    if (until) this.eat('until');
    return node('DoWhile', kw, { body: body, cond: this.parseExpr(), until: until });
  };

  P.parseName = function () {
    var tk = this.cur();
    if (tk.t !== 'word' || this.reservedAt(0)) {
      this.fail(tk.t === 'nl' || tk.t === 'eof' ? 'expectedName' : 'expectedNameGot', [tk.v]);
    }
    this.advance();
    return tk;
  };
  /* ---- types: int32, unsigned int8, long long, string[], Point, Button... ---- */

  /** Is the word at offset k this exact word (not a translated keyword: types are the same in every language)? */
  P.word = function (n, k) { var tk = this.peek(k); return tk.t === 'word' && tk.n === n; };
  P.eatWord = function (n) { return this.word(n) ? this.advance() : null; };
  /** The struct / class... called n (or a control type: Button, TextBox...), or null. */
  P.userType = function (n) { return this.ctx.typeByNorm ? this.ctx.typeByNorm(n) : null; };
  /** Does a type start at offset k? */
  P.typeStartAt = function (k) {
    var tk = this.peek(k);
    if (tk.t !== 'word') return false;
    if (tk.n === 'unsigned' || tk.n === 'signed' || BUILTIN_TYPES[tk.n] !== undefined) return true;
    // C: struct Point p;
    if ((tk.n === 'struct' || tk.n === 'union') && this.peek((k || 0) + 1).t === 'word') return !!this.userType(this.peek((k || 0) + 1).n);
    return !!this.userType(tk.n);
  };
  /** Read a type. Returns { type: 'TypeRef', name: 'int32' | 'uint8' | 'Point' | 'Button'..., dims, tok }. */
  P.parseTypeRef = function () {
    var tok = this.cur(), sign = null, signTok = null, name;
    if (tok.t === 'word' && (tok.n === 'struct' || tok.n === 'union') && this.peek(1).t === 'word' && this.userType(this.peek(1).n)) this.advance();
    if (this.cur().t === 'word' && (this.cur().n === 'unsigned' || this.cur().n === 'signed')) { signTok = this.advance(); sign = signTok.n; }
    var t = this.cur();
    if (t.t === 'word' && BUILTIN_TYPES[t.n] !== undefined) {
      this.advance();
      name = BUILTIN_TYPES[t.n];
      var nx = this.cur();
      // long long, long int, short int, long double
      if (t.n === 'long' && nx.t === 'word' && (nx.n === 'long' || nx.n === 'int')) this.advance();
      else if (t.n === 'long' && nx.t === 'word' && nx.n === 'double') { this.advance(); name = 'float64'; }
      else if (t.n === 'short' && nx.t === 'word' && nx.n === 'int') this.advance();
      if (sign) {
        // unsigned char is a small number in C (0 to 255)
        if (name === 'char') name = sign === 'unsigned' ? 'uint8' : 'int8';
        else if (/^u?int\d+$/.test(name)) name = (sign === 'unsigned' ? 'u' : '') + name.replace(/^u/, '');
        else this.fail('badSign', [signTok.v, t.v], signTok);
      }
    } else if (sign) {
      name = sign === 'unsigned' ? 'uint32' : 'int32';          // "unsigned x" is an unsigned int
    } else if (t.t === 'word' && this.userType(t.n)) {
      this.advance();
      name = this.userType(t.n).name;
    } else {
      this.fail('expectedType', [t.t === 'nl' || t.t === 'eof' ? '' : t.v]);
    }
    var dims = 0;
    while (this.isOp('[') && this.isOp(']', 1)) { this.advance(); this.advance(); dims++; }
    return { type: 'TypeRef', name: name, dims: dims, tok: tok };
  };
  /** Is "type name" next? (int32 x / unsigned int8 b / Point p / string[] names) */
  P.declTypeAhead = function () {
    if (!this.typeStartAt(0)) return false;
    var save = this.i, ok = false;
    try {
      this.parseTypeRef();
      ok = this.cur().t === 'word' && !this.reservedAt(0) && !this.is('in');
    } catch (e) { if (!(e instanceof WzError)) throw e; }
    this.i = save;
    return ok;
  };

  /** for each x in list / foreach (var x in list) / for i = 1 to 10 / for (i = 1; i <= 10; i++) */
  P.headFor = function () {
    var each = !!this.eat('foreach');
    if (!each) { this.eat('for'); each = !!this.eat('each'); }
    var paren = this.eatOp('(');
    var res;
    if (each || this.forInAhead()) {
      if (this.is('var')) this.eat('var');
      var vty = this.declTypeAhead() ? this.parseTypeRef() : null;     // foreach (int32 x in list)
      var vt = this.parseName();
      this.expect('in');
      res = { mode: 'each', nameTok: vt, iter: this.parseExpr(), tref: vty };
    } else if (paren) {
      var init = this.isOp(';') ? null : this.parseSimple();
      if (init && init.type === 'Set' && init.target.type === 'Ident' && this.is('to')) {
        // for (i = 1 to 10)
        this.eat('to');
        var to = this.parseExpr(), step = null;
        if (this.eat('step')) step = this.parseExpr();
        res = { mode: 'range', nameTok: init.target, name: init.target.name, from: init.value, to: to, step: step };
      } else {
        this.expectOp(';');
        var cond = this.isOp(';') ? null : this.parseExpr();
        this.expectOp(';');
        var stp = this.isOp(')') ? null : this.parseSimple();
        res = { mode: 'c', init: init, cond: cond, step: stp };
      }
    } else {
      var nt = this.parseName();
      if (!this.eat('from')) this.expectOp('=');
      var from = this.parseExpr();
      this.expect('to');
      var to2 = this.parseExpr(), st = null;
      if (this.eat('step')) st = this.parseExpr();
      res = { mode: 'range', nameTok: nt, name: nt.v, from: from, to: to2, step: st };
    }
    if (paren) this.expectOp(')');
    return res;
  };
  /** "x in ..." or "var x in ..." or "int32 x in ..." ahead? */
  P.forInAhead = function () {
    var k = this.is('var') ? this.m('var') : 0;
    if (this.peek(k).t === 'word' && this.is('in', k + 1)) return true;
    var save = this.i, ok = false;
    this.i += k;
    if (this.typeStartAt(0)) {
      try { this.parseTypeRef(); ok = this.cur().t === 'word' && this.is('in', 1); } catch (e) { if (!(e instanceof WzError)) throw e; }
    }
    this.i = save;
    return ok;
  };

  P.parseFor = function () {
    var kw = this.cur();
    var h = this.headFor();
    var b = this.parseBody('for', kw, { single: true });
    if (b.style === 'end') this.parseEnd('for', kw);
    if (h.mode === 'each') return node('ForEach', kw, { name: h.nameTok.v, nameTok: h.nameTok, iter: h.iter, body: b.body, tref: h.tref });
    if (h.mode === 'range') return node('ForRange', kw, { name: h.name, nameTok: h.nameTok, from: h.from, to: h.to, step: h.step, body: b.body });
    return node('CFor', kw, { init: h.init, cond: h.cond, step: h.step, body: b.body });
  };

  /**
   * switch (x) { case 1: ... case 2: case 3: ... default: ... }
   * Each case ends by itself (like in C#, no "falling through"), so break is not needed.
   */
  P.parseSwitch = function () {
    var kw = this.cur();
    this.eat('switch');
    var subject = this.parseExpr();
    if (!this.braceNext()) this.fail('expected', ["'{'"]);
    var open = this.cur();
    this.advance();
    var cases = [], def = null, part = null;
    this.depth++;
    this.blocks.push({ brace: true, kind: 'switch', stops: [] });
    try {
      for (;;) {
        this.skipNL();
        var tk = this.cur();
        if (tk.t === 'eof') { this.record(new WzError('expectedBrace', [open.line], open)); break; }
        if (this.isOp('}')) { this.advance(); break; }
        if (this.is('case')) {
          var values = [];
          // case 1: case 2:  or  case 1, 2:  - several values for the same lines
          while (this.is('case')) {
            this.eat('case');
            do { values.push(this.parseExpr()); } while (this.eatOp(','));
            this.expectOp(':');
            if (this.cur().t === 'nl' && this.is('case', 1)) this.advance();
          }
          part = { values: values, body: [], tok: tk };
          cases.push(part);
          continue;
        }
        if (this.is('default')) {
          this.eat('default');
          this.expectOp(':');
          part = { values: null, body: [], tok: tk };
          if (def) this.record(new WzError('twoDefaults', [], tk));
          def = part;
          continue;
        }
        if (!part) {
          this.record(new WzError('caseFirst', [], tk));
          this.recoverStray();
          continue;
        }
        this.parseStmtInto(part.body);
      }
    } finally {
      this.depth--;
      this.blocks.pop();
    }
    return node('Switch', kw, { subject: subject, cases: cases, def: def });
  };

  /* ---- functions and events ---- */

  /**
   * function add(a, b)  /  function int32 add(int32 a, int32 b)  /  int32 add(int32 a, int32 b)  /  void hello()
   * ("function double(n)" is a function called double: a type needs a name after it)
   */
  P.headFunction = function (noKeyword) {
    var server = !!this.eat('server');
    var rtype = null;
    if (noKeyword) rtype = this.parseTypeRef();
    else {
      this.eat('function');
      if (this.typeStartAt(0) && !this.isOp('(', 1)) rtype = this.parseTypeRef();
    }
    var nt = this.parseName();
    return { nameTok: nt, params: this.parseParams(), server: server, rtype: rtype };
  };
  /** (int32 a, string b, c) */
  P.parseParams = function () {
    var params = [];
    if (this.eatOp('(')) {
      if (!this.isOp(')')) {
        do {
          var pt = this.declTypeAhead() ? this.parseTypeRef() : null;
          var pn = this.parseName();
          if (this.isOp('[') && this.isOp(']', 1)) {
            // int32 a[]: a list
            this.advance(); this.advance();
            pt = pt ? Object.assign({}, pt, { dims: pt.dims + 1 }) : { type: 'TypeRef', name: 'any', dims: 1, tok: pn };
          }
          params.push({ tok: pn, tref: pt });
        } while (this.eatOp(','));
      }
      this.expectOp(')');
    }
    return params;
  };

  P.parseFunction = function (server, noKeyword) {
    var kw = this.cur();
    if (this.depth > 0) this.fail('nestedFunction', []);
    var h = this.headFunction(noKeyword);
    var b = this.parseBody('function', kw, {});
    if (b.style === 'end') this.parseEnd('function', kw);
    return node('Func', kw, { name: h.nameTok.v, nameTok: h.nameTok, params: h.params.map(function (p) { return p.tok.v; }),
      paramToks: h.params.map(function (p) { return p.tok; }), ptypes: h.params.map(function (p) { return p.tref; }), rtype: h.rtype,
      body: b.body, server: server });
  };

  /* ---- struct, union, class, interface ---- */

  /** Does a struct / union / class / interface start here? Returns how many modifier words come first, or -1. */
  P.typeDeclAt = function () {
    var k = 0;
    while (this.peek(k).t === 'word' && TYPE_MODS[this.peek(k).n]) k++;
    var tk = this.peek(k);
    if (tk.t !== 'word' || !TYPE_KINDS[tk.n] || this.peek(k + 1).t !== 'word') return -1;
    // "struct Point p" is a variable of the struct Point, not a new struct
    if ((tk.n === 'struct' || tk.n === 'union') && !(this.isOp('{', k + 2) || this.isNL(k + 2))) return -1;
    return k;
  };

  /**
   * struct Point { int32 x; int32 y; }
   * union Number { int32 i; float32 f; }
   * class Dog : Animal { public: Dog(string n) : base(n) { } void bark() { ... } }
   * interface IShape { float64 area(); }
   */
  P.parseTypeDecl = function () {
    var start = this.cur();
    if (this.depth > 0) this.fail('nestedType', [start.v]);
    var mods = {};
    while (this.cur().t === 'word' && TYPE_MODS[this.cur().n]) mods[this.advance().n] = true;
    var kt = this.advance(), kind = kt.n;
    var nt = this.parseName();
    var bases = [], ifaces = [];
    if (kind === 'class' || kind === 'interface') {
      // class Dog : Animal, IPet   /   class Dog inherits Animal   /   class Dog extends Animal implements IPet
      if (this.eatOp(':') || this.eatWord('inherits') || this.eatWord('extends')) {
        do { bases.push(this.parseName()); } while (this.eatOp(','));
      }
      if (this.eatWord('implements')) {
        do { ifaces.push(this.parseName()); } while (this.eatOp(','));
      }
    }
    if (!this.braceNext()) this.fail('expected', ["'{'"]);
    var open = this.advance();
    var members = [];
    // like C++ and C#: the members of a class are private unless you say otherwise; of a struct, public
    var access = kind === 'class' ? 'private' : 'public';
    this.depth++;
    this.blocks.push({ brace: true, kind: kind, stops: [] });
    try {
      for (;;) {
        this.skipNL();
        var tk = this.cur();
        if (tk.t === 'eof') { this.record(new WzError('expectedBrace', [open.line], open)); break; }
        if (this.isOp('}')) { this.advance(); break; }
        // C++: public: / private: / protected:
        if (tk.t === 'word' && ACCESS[tk.n] && this.isOp(':', 1)) { access = ACCESS[tk.n]; this.advance(); this.advance(); continue; }
        var mstart = this.i;
        try {
          this.parseMember(kind, nt, access, members, bases);
          var last = this.t[this.i - 1];
          if (!this.isNL() && !this.isOp('}') && !(last && last.t === 'op' && last.v === '}')) this.fail('extraTokens', [this.restText()]);
        } catch (e) {
          if (!(e instanceof WzError)) throw e;
          this.record(e);
          this.recover(mstart);
        }
      }
    } finally {
      this.depth--;
      this.blocks.pop();
    }
    return node('TypeDecl', start, { kind: kind, name: nt.v, nameTok: nt, mods: mods, bases: bases, ifaces: ifaces, members: members, kindTok: kt });
  };

  /**
   * One member: a field (int32 x = 0;), a method (void bark() { }), a constructor (Dog(string n) { }).
   * Modifiers: public private protected static virtual override abstract const readonly...
   */
  P.parseMember = function (kind, nameTok, access, members, bases) {
    var start = this.cur(), mods = {}, acc = null;
    while (this.cur().t === 'word' && MEMBER_MODS[this.cur().n] && !this.isOp('(', 1) && !this.isAssignOp(1) && !this.isNL(1) && !this.isOp(',', 1)) {
      var w = this.advance();
      if (ACCESS[w.n]) acc = ACCESS[w.n]; else mods[w.n] = w;
    }
    var m = { access: acc || access, isStatic: !!(mods['static'] || mods['const']), mods: mods, tok: start, line: start.line };
    if (kind === 'interface') m.access = 'public';
    // the constructor: Dog(...) or constructor(...)
    if (this.cur().t === 'word' && (this.cur().n === norm(nameTok.v) || this.cur().n === 'constructor') && this.isOp('(', 1)) {
      if (kind !== 'class') this.fail('ctorOnlyClass', [nameTok.v]);
      m.kind = 'ctor';
      m.nameTok = this.advance();
      m.name = nameTok.v;
      m.params = this.parseParams();
      m.baseArgs = null;
      m.inits = [];
      if (this.eatOp(':')) {
        // : base(n)   /   : Animal(n), legs(4)   (C++)
        do {
          var it = this.parseName();
          this.expectOp('(');
          var args = [];
          if (!this.isOp(')')) { do { args.push(this.parseExpr()); } while (this.eatOp(',')); }
          this.expectOp(')');
          var isBase = it.n === 'base' || it.n === 'super' || bases.some(function (b) { return b.n === it.n; });
          if (isBase) { m.baseArgs = args; m.baseTok = it; }
          else {
            if (args.length !== 1) this.fail('argCount', [it.v + '()', msg(this.ctx.msgLang, 'nValues', [1]), args.length], it);
            m.inits.push({ name: it.v, tok: it, value: args[0] });
          }
        } while (this.eatOp(','));
      }
      var cb = this.parseBody('function', start, {});
      if (cb.style === 'end') this.parseEnd('function', start);
      m.body = cb.body;
      members.push(m);
      return;
    }
    var tref = null, isFn = false, isVar = false;
    if (this.is('function')) {
      // function bark() / function int32 age()
      isFn = true;
      this.eat('function');
      if (this.typeStartAt(0) && !this.isOp('(', 1)) tref = this.parseTypeRef();
    } else if (this.is('var')) {
      // var int32 x = 0 / var x = 0 / const int32 MAX = 10
      isVar = true;
      if (this.cur().n === 'const') { mods['const'] = this.cur(); m.isStatic = true; }
      this.eat('var');
      if (this.declTypeAhead()) tref = this.parseTypeRef();
    } else {
      tref = this.parseTypeRef();
    }
    var nt = this.parseName();
    if (!isVar && (isFn || this.isOp('('))) {
      if (kind === 'struct' || kind === 'union') this.fail('methodInStruct', [nt.v, kind]);
      m.kind = 'method';
      m.name = nt.v;
      m.nameTok = nt;
      m.rtype = tref;
      m.params = this.parseParams();
      if (kind === 'interface' || mods['abstract']) {
        // no body: the classes that inherit write it
        if (this.braceAhead()) this.fail('abstractBody', [nt.v]);
        m.body = null;
      } else {
        var b = this.parseBody('function', start, {});
        if (b.style === 'end') this.parseEnd('function', start);
        m.body = b.body;
      }
      members.push(m);
      return;
    }
    if (kind === 'interface') this.fail('fieldInInterface', [nt.v]);
    if (tref && tref.name === 'void') this.fail('voidVar', [], tref.tok);
    for (;;) {
      var f = Object.assign({}, m, { kind: 'field', name: nt.v, nameTok: nt, tref: tref, init: null, arr: null });
      if (this.isOp('[')) {
        // int32 marks[5]: a list of 5
        var bt = this.advance();
        f.arr = { size: this.isOp(']') ? null : this.parseExpr(), tok: bt };
        this.expectOp(']');
      }
      // C#: public string Name { get; set; } is a field here
      if (this.isOp('{') && this.accessorsAhead()) this.skipAccessors();
      if (this.eatOp('=')) f.init = this.parseExpr();
      if (mods['const'] && !f.init) this.fail('constNeedsValue', [nt.v], nt);
      members.push(f);
      if (!this.eatOp(',')) break;
      nt = this.parseName();
    }
  };
  /** { get; set; } after a field name */
  P.accessorsAhead = function () {
    var j = 1;
    while (this.peek(j).t === 'nl') j++;
    return this.word('get', j) || this.word('set', j) || this.word('init', j);
  };
  P.skipAccessors = function () {
    this.advance();
    while (!this.isOp('}') && this.cur().t !== 'eof') {
      var tk = this.cur();
      if (tk.t !== 'nl' && !(tk.t === 'word' && /^(get|set|init|public|private|protected|internal)$/.test(tk.n))) this.fail('accessors', []);
      this.advance();
    }
    this.expectOp('}');
  };

  /* ---- new, casts, sizeof ---- */

  /** new Dog("Rex")  /  new Point { x = 1, y = 2 }  /  new int32[10]  /  new Button() */
  P.parseNew = function () {
    var kw = this.advance();
    var tref = this.parseTypeRef();
    if (this.isOp('[')) {
      var bt = this.advance();
      var size = this.parseExpr();
      this.expectOp(']');
      return node('NewArray', kw, { tref: tref, size: size, tok: bt });
    }
    var args = [], inits = null;
    if (this.eatOp('(')) {
      if (!this.isOp(')')) { do { args.push(this.parseExpr()); } while (this.eatOp(',')); }
      this.expectOp(')');
    }
    if (this.isOp('{')) inits = this.parsePrimary();     // C#: new Point { x = 1, y = 2 }
    return node('New', kw, { tref: tref, args: args, inits: inits });
  };
  /** Can a value start at offset k? (after the ) of a cast) */
  P.operandAt = function (k) {
    var tk = this.peek(k);
    if (tk.t === 'num' || tk.t === 'str') return true;
    if (tk.t === 'word') return !this.reservedAt(k) && !this.is('mod', k) && !this.is('contains', k) && !this.word('as', k);
    if (tk.t === 'op') return tk.v === '(' || tk.v === '[' || tk.v === '-' || tk.v === '+' || tk.v === '!';
    return false;
  };
  /** (int32)x  /  (float32)(a + b)  /  (Dog)animal: null if the ( ) is not a cast */
  P.tryCast = function () {
    var save = this.i, open = this.cur();
    this.advance();
    try {
      var tref = this.parseTypeRef();
      var builtin = BUILTIN_TYPES[norm(tref.name)] !== undefined || /^(u?int\d+|float\d+|bool|char|string|any|void)$/.test(tref.name);
      if (this.isOp(')') && this.operandAt(1) && (builtin || tref.dims || !(this.isOp('-', 1) || this.isOp('+', 1)))) {
        this.advance();
        return node('Cast', open, { tref: tref, x: this.parseUnary() });
      }
    } catch (e) { if (!(e instanceof WzError)) throw e; }
    this.i = save;
    return null;
  };
  /** sizeof(int32) / sizeof(Point) / sizeof(x) */
  P.parseSizeOf = function () {
    var kw = this.advance();
    this.expectOp('(');
    var tref = null, x = null;
    if (this.typeStartAt(0)) {
      var save = this.i;
      try { tref = this.parseTypeRef(); if (!this.isOp(')')) { tref = null; this.i = save; } } catch (e) {
        if (!(e instanceof WzError)) throw e;
        tref = null; this.i = save;
      }
    }
    if (!tref) x = this.parseExpr();
    this.expectOp(')');
    return node('SizeOf', kw, { tref: tref, x: x });
  };

  P.matchEvent = function () {
    var best = null, bestLen = 0, keys = this.v.eventKeys;
    for (var k = 0; k < keys.length; k++) {
      var n = this.m(keys[k]);
      if (n > bestLen) { best = keys[k]; bestLen = n; }
    }
    if (best) this.i += bestLen;
    return best ? best.slice(3) : null;
  };

  P.headWhen = function () {
    this.eat('when');
    if (this.is('pageloads')) { this.eat('pageloads'); return { kind: 'load' }; }
    if (this.is('keypressed')) { this.eat('keypressed'); return { kind: 'key' }; }
    var nt = this.cur();
    if (nt.t !== 'word') this.fail('expectedNameGot', [nt.v]);
    this.advance();
    this.eat('is');
    var evTok = this.cur();
    var key = this.matchEvent();
    if (!key) {
      var ctl = this.ctx.controlByNorm && this.ctx.controlByNorm(nt.n);
      var names = this.ctx.eventNamesFor ? this.ctx.eventNamesFor(ctl) : [];
      if (this.isNL() || this.isOp('{')) this.fail('expectedEvent', [nt.v, names.join(', ')], evTok);
      this.fail('badEvent', [nt.v, this.restText(), names.join(', ')], evTok);
    }
    return { kind: 'control', name: nt.v, nameTok: nt, event: key, evTok: evTok };
  };

  P.parseWhen = function () {
    var kw = this.cur();
    if (this.depth > 0) this.fail('nestedWhen', [kw.v]);
    var ev = this.headWhen();
    var b = this.parseBody('when', kw, {});
    if (b.style === 'end') this.parseEnd('when', kw);
    return node('When', kw, { ev: ev, body: b.body });
  };

  P.parseUnit = function (required) {
    if (this.eat('milliseconds')) return 1;
    if (this.eat('seconds')) return 1000;
    if (this.eat('minutes')) return 60000;
    if (required) this.fail('expectedUnit', []);
    return 0;
  };

  P.headEvery = function () {
    this.eat('every');
    var amount;
    if (this.is('seconds') || this.is('milliseconds') || this.is('minutes')) amount = node('Num', this.cur(), { v: 1 });
    else amount = this.parseExpr();
    return { amount: amount, unit: this.parseUnit(true) };
  };

  P.parseEvery = function () {
    var kw = this.cur();
    if (this.depth > 0) this.fail('nestedWhen', [kw.v]);
    var h = this.headEvery();
    var b = this.parseBody('every', kw, {});
    if (b.style === 'end') this.parseEnd('every', kw);
    return node('Every', kw, { amount: h.amount, unit: h.unit, body: b.body });
  };

  /** try { ... } catch (e) { ... }   or   try ... on error ... end try */
  P.parseTry = function () {
    var kw = this.cur();
    this.eat('try');
    var b = this.parseBody('try', kw, { stops: ['onerror'] });
    var handler = [], errTok = null;
    if (b.style === 'end') {
      if (this.is('onerror')) {
        var ok = this.cur();
        this.eat('onerror');
        errTok = this.parseCatchName();
        handler = this.endStyleBody([], 'try', kw, ok);
      }
      this.parseEnd('try', kw);
    } else if (this.elseNext('onerror', kw)) {
      var ck = this.cur();
      this.eat('onerror');
      errTok = this.parseCatchName();
      handler = this.parseBody('try', ck, { noEnd: true }).body;
    }
    return node('Try', kw, { body: b.body, handler: handler, errName: errTok ? errTok.v : null, errTok: errTok });
  };
  /** catch (e)  /  catch (Exception e): the name that holds the error message. */
  P.parseCatchName = function () {
    if (!this.eatOp('(')) return null;
    var n = this.parseName();
    if (this.cur().t === 'word') n = this.parseName();
    this.expectOp(')');
    return n;
  };

  /* ---- simple statements ---- */

  P.parseSet = function () {
    var kw = this.cur();
    this.eat('set');
    var target = this.parseTarget(false);
    if (!this.eat('to') && !this.eatOp('=')) this.fail('missingTo', [this.v.say('to')]);
    var value = this.parseExpr();
    return node('Set', kw, { target: target, value: value });
  };

  /**
   * var x = 1  /  var int32 x = 1  /  var unsigned int64 a = 34  /  const int32 c = -34
   * int32 x = 1 (C style)  /  int32 a[10] (a list of 10)  /  var a = 1, b = 2
   */
  P.parseVar = function (noKeyword) {
    var kw = this.cur(), konst = false;
    if (!noKeyword) {
      konst = kw.n === 'const';
      this.eat('var');
      if (!konst && this.cur().t === 'word' && this.cur().n === 'const') { konst = true; this.advance(); }
    }
    var tref = (this.word('unsigned') || this.word('signed') || this.declTypeAhead()) ? this.parseTypeRef() : null;
    if (tref && tref.name === 'void') this.fail('voidVar', [], tref.tok);
    var list = [];
    do {
      var nt = this.parseName();
      var arr = null;
      if (this.isOp('[')) {
        // int32 a[10]: a list of 10 items (counted from 1, like every list of Wemazy)
        var bt = this.advance();
        arr = { size: this.isOp(']') ? null : this.parseExpr(), tok: bt };
        this.expectOp(']');
      }
      var value = null;
      if (this.eatOp('=')) value = this.parseExpr();
      if (konst && !value) this.fail('constNeedsValue', [nt.v], nt);
      list.push(node('Set', kw, { target: node('Ident', nt, { name: nt.v }), value: value || node('Null', nt), decl: true,
        konst: konst, tref: tref, arr: arr, noValue: !value }));
    } while (this.eatOp(','));
    return list.length === 1 ? list[0] : node('Block', kw, { body: list });
  };

  P.parseInc = function () {
    var kw = this.cur();
    var neg = !this.eat('increase');
    if (neg) this.eat('decrease');
    var target = this.parseTarget(false);
    var by = null;
    if (this.eat('by')) by = this.parseExpr();
    return node('Inc', kw, { target: target, by: by, neg: neg });
  };

  /** x = 1, x++, x--, x += 2, ++x... (also the parts of a C-style for) */
  P.parseSimple = function () {
    var tk = this.cur();
    if (this.is('var')) return this.parseVar();
    if (this.declTypeAhead()) return this.parseVar(true);     // for (int32 i = 0; ...)
    if (this.isOp('++') || this.isOp('--')) {
      var op = this.advance();
      return node('Inc', op, { target: this.parseTarget(false), by: null, neg: op.v === '--' });
    }
    var target = this.parseTarget(false);
    return this.parseAssignOp(tk, target);
  };
  P.parseAssignOp = function (tk, target) {
    var op = this.cur();
    if (op.t === 'op') {
      switch (op.v) {
        case '=':
          this.advance();
          return node('Set', tk, { target: target, value: this.parseExpr() });
        case '++': case '--':
          this.advance();
          return node('Inc', tk, { target: target, by: null, neg: op.v === '--' });
        case '+=': case '-=':
          this.advance();
          return node('Inc', tk, { target: target, by: this.parseExpr(), neg: op.v === '-=' });
        case '*=': case '/=': case '%=': case '&=': {
          this.advance();
          var r = this.parseExpr();
          var bop = { '*=': '*', '/=': '/', '%=': 'mod', '&=': '&' }[op.v];
          return node('Set', tk, { target: target, value: node('Bin', op, { op: bop, l: target, r: r }) });
        }
      }
    }
    this.fail('expected', ["'='"]);
  };

  P.parseReturn = function () {
    var kw = this.cur();
    this.eat('return');
    var value = this.endAt() ? null : this.parseExpr();
    return node('Return', kw, { value: value });
  };

  /** wait 2 seconds / wait 500 milliseconds / wait(500) - in ( ) without a unit: milliseconds, like in C# */
  P.parseWait = function () {
    var kw = this.cur();
    this.eat('wait');
    var paren = this.isOp('(');
    var amount = this.parseExpr();
    var unit = this.parseUnit(false) || (paren ? 1 : 1000);
    return node('Wait', kw, { amount: amount, unit: unit });
  };

  P.isTableAt = function (k) {
    var tk = this.peek(k);
    if (tk.t !== 'word') return false;
    return !!(this.ctx.tableByNorm && this.ctx.tableByNorm(tk.n));
  };

  P.parseTableName = function () {
    var tk = this.cur();
    var tables = this.ctx.tables || [];
    if (tk.t !== 'word') {
      if (!tables.length) this.fail('noTables', []);
      this.fail('expectedTable', [tables.map(function (t) { return t.name; }).join(', ')]);
    }
    var tb = this.ctx.tableByNorm(tk.n);
    if (!tb) {
      var s = suggest(tk.v, tables.map(function (t) { return t.name; }));
      if (!tables.length) throw new WzError('noTables', [], tk);
      throw new WzError('unknownTable', [tk.v], tk, s ? msg(this.ctx.msgLang, 'didYouMean', [s]) : '');
    }
    this.advance();
    return { name: tb.name, def: tb, tok: tk };
  };

  P.parseAddStmt = function () {
    var kw = this.cur();
    this.eat('add');
    var item = this.parseExpr();
    this.expect('to');
    if (this.isTableAt(0) && this.endAt(1)) {
      var tb = this.parseTableName();
      return node('Insert', kw, { table: tb, record: item });
    }
    var target = this.parseTarget(true);
    return node('Add', kw, { item: item, target: target });
  };

  P.parseRemove = function () {
    var kw = this.cur();
    this.eat('remove');
    var item = this.parseExpr();
    this.expect('from');
    var target = this.parseTarget(true);
    return node('Remove', kw, { item: item, target: target });
  };

  P.parseUpdate = function () {
    var kw = this.cur();
    this.eat('update');
    var tb = this.parseTableName();
    this.expect('set');
    var sets = [];
    do {
      var ct = this.parseName();
      if (!this.eatOp('=')) this.expect('to');
      sets.push({ col: ct.v, tok: ct, value: this.parseExpr() });
    } while (this.eatOp(','));
    var where = null;
    if (this.eat('where')) where = this.parseExpr();
    return node('Update', kw, { table: tb, sets: sets, where: where });
  };

  P.parseDelete = function () {
    var kw = this.cur();
    this.eat('delete');
    this.eat('all');
    this.eat('from');
    var tb = this.parseTableName();
    var where = null;
    if (this.eat('where')) where = this.parseExpr();
    return node('Delete', kw, { table: tb, where: where });
  };

  /** Commands from language packs ("show message {text}"). */
  P.tryCommand = function () {
    var tk = this.cur();
    var list = this.v.cmdByFirst[tk.n];
    if (!list) return null;
    var start = this.i;
    for (var c = 0; c < list.length; c++) {
      var cmd = list[c];
      this.i = start;
      var slots = {}, ok = true, committed = false;
      for (var p = 0; p < cmd.parts.length; p++) {
        var part = cmd.parts[p];
        if (part.lit) {
          for (var w = 0; w < part.lit.length; w++) {
            var t2 = this.cur();
            var litOk = (t2.t === 'word' && t2.n === part.lit[w]) || (t2.t === 'op' && t2.v === part.lit[w]);
            if (!litOk) { ok = false; break; }
            this.advance();
          }
          if (!ok) break;
          committed = p > 0 || part.lit.length > 1 || cmd.parts.length === 1;
        } else {
          if (this.endAt()) { ok = false; break; }
          try {
            slots[part.slot] = this.parseSlot(part);
          } catch (e) {
            if (committed) throw e;
            ok = false;
            break;
          }
          committed = true;
        }
      }
      if (ok && !this.endAt()) ok = false;
      if (ok) return node('Command', tk, { cmd: cmd, def: cmd.def, slots: slots });
    }
    this.i = start;
    return null;
  };

  P.parseSlot = function (part) {
    var tk = this.cur();
    switch (part.kind) {
      case 'target': return this.parseTarget(false);
      case 'control': {
        // hide Panel1   or   hide(Panel1)
        if (tk.t === 'op' && tk.v === '(' && this.peek(1).t === 'word' && this.isOp(')', 2)) {
          this.advance();
          var inner = this.advance();
          this.advance();
          return node('ControlRef', inner, { name: inner.v });
        }
        if (tk.t !== 'word') this.fail('expectedNameGot', [tk.v]);
        this.advance();
        return node('ControlRef', tk, { name: tk.v });
      }
      case 'page': {
        if (tk.t === 'word' && this.ctx.pageByNorm && this.ctx.pageByNorm(tk.n) && this.endAt(1)) {
          this.advance();
          return node('Str', tk, { v: this.ctx.pageByNorm(tk.n).name });
        }
        return this.parseExpr();
      }
      case 'word': {
        if (tk.t !== 'word') this.fail('expectedNameGot', [tk.v]);
        this.advance();
        return node('Str', tk, { v: tk.v });
      }
      default:
        return this.parseExpr();
    }
  };

  P.parseTarget = function (allowControl) {
    var tk = this.cur();
    if (tk.t !== 'word' || this.reservedAt(0)) {
      this.fail(tk.t === 'nl' || tk.t === 'eof' ? 'expectedName' : 'expectedNameGot', [tk.v]);
    }
    this.advance();
    var t = node('Ident', tk, { name: tk.v });
    if (tk.n === 'this') t = node('This', tk);
    else if ((tk.n === 'base' || tk.n === 'super') && this.isOp('.')) t = node('Base', tk);
    for (;;) {
      if (this.isOp('.')) {
        this.advance();
        var nt = this.cur();
        if (nt.t !== 'word') this.fail('expectedName', []);
        this.advance();
        t = node('Member', nt, { obj: t, name: nt.v, nameTok: nt });
      } else if (this.isOp('[')) {
        var bt = this.advance();
        var idx = this.parseExpr();
        this.expectOp(']');
        t = node('Index', bt, { obj: t, index: idx });
      } else break;
    }
    return t;
  };

  P.parseExprOrAssign = function () {
    var tk = this.cur();
    if (this.isOp('++') || this.isOp('--')) return this.parseSimple();
    if (tk.t === 'word' && !this.reservedAt(0)) {
      var save = this.i, target = null;
      try { target = this.parseTarget(false); } catch (e) { if (!(e instanceof WzError)) throw e; }
      if (target && this.isAssignOp()) return this.parseAssignOp(tk, target);
      this.i = save;
      if (this.declTypeAhead() || ((this.word('unsigned') || this.word('signed')) && this.peek(1).t === 'word')) {
        // C style: int32 x = 5  /  int32 add(int32 a, int32 b) { ... }  /  void hello() { ... }
        this.parseTypeRef();
        var isFn = this.cur().t === 'word' && this.isOp('(', 1);
        this.i = save;
        if (isFn) return this.parseFunction(false, true);
        return this.parseVar(true);
      }
    }
    var ex = this.parseExpr();
    if (ex.type === 'Call') {
      var st = this.stmtFromCall(ex, tk);
      if (st) return st;
    }
    return node('ExprStmt', tk, { expr: ex });
  };

  function isTargetNode(x) {
    while (x && (x.type === 'Member' || x.type === 'Index')) x = x.obj;
    return !!x && (x.type === 'Ident' || x.type === 'This' || x.type === 'Base');
  }

  /**
   * Calls that are statements:
   *   list.add(x)  list.remove(x)  list.clear()     -> add / remove / clear
   *   Pets.add({name: "Rex"})                        -> add ... to Pets (a table)
   *   Panel1.show()  Player.move(10, 0)              -> commands of the packs
   *   list.sort()  name.trim()                       -> list = sort(list)...
   *   console.log(x)                                 -> print x
   */
  P.stmtFromCall = function (call, tk) {
    var cal = call.callee;
    if (cal.type !== 'Member') return null;
    var m = norm(cal.name), obj = cal.obj, args = call.args, self = this;
    var on = obj.type === 'Ident' ? norm(obj.name) : null;
    function argc(n) {
      if (args.length !== n) throw new WzError('argCount', [cal.name + '()', msg(self.ctx.msgLang, 'nValues', [n]), args.length], cal.nameTok || cal);
    }
    if (on === 'console' && (m === 'log' || m === 'writeline' || m === 'write')) {
      var val = args[0] || node('Str', tk, { v: '' });
      for (var a = 1; a < args.length; a++) {
        val = node('Bin', tk, { op: '&', l: node('Bin', tk, { op: '&', l: val, r: node('Str', tk, { v: ' ' }) }), r: args[a] });
      }
      return node('Print', tk, { value: val });
    }
    if (on === 'messagebox' && m === 'show' && this.v.cmdCalls.message) {
      // MessageBox.Show("Hi"), as in C# Windows Forms
      var md = this.v.cmdCalls.message, mc = this.v.cmdFirst[md.id];
      return node('Command', tk, { cmd: mc, def: md, slots: callSlots(mc, md, null, args.slice(0, 1), 'MessageBox.Show()', cal.nameTok || cal, this.ctx.msgLang), label: 'MessageBox.Show' });
    }
    var tb = on && this.ctx.tableByNorm ? this.ctx.tableByNorm(on) : null;
    if (tb && (m === 'add' || m === 'insert')) {
      argc(1);
      return node('Insert', tk, { table: { name: tb.name, def: tb, tok: obj }, record: args[0] });
    }
    var cdef = this.v.cmdMethods[m];
    if (cdef && on && this.ctx.controlByNorm && this.ctx.controlByNorm(on)) {
      var c = this.v.cmdFirst[cdef.id];
      return node('Command', tk, { cmd: c, def: cdef, slots: callSlots(c, cdef, obj, args, obj.name + '.' + cal.name + '()', cal.nameTok || cal, this.ctx.msgLang), label: cal.name });
    }
    if (STMT_METHODS[m] && isTargetNode(obj)) {
      // with another number of values it may be a method of a class: decided later
      if (STMT_METHODS[m] === 'Clear') return args.length ? null : node('Clear', tk, { target: obj, word: cal.name });
      if (args.length !== 1) return null;
      return node(STMT_METHODS[m], tk, { item: args[0], target: obj, word: cal.name });
    }
    var fd = this.v.methods[m];
    if (fd && fd.changes && isTargetNode(obj)) return node('Set', tk, { target: obj, value: call, changes: true });
    return null;
  };

  /**
   * The slots of a command written as a call: message("Hi"), Player.move(10, 0), goTo(About).
   * obj (or null) fills the first control slot; the values fill the other slots in order.
   */
  function callSlots(c, def, obj, args, label, at, msgLang) {
    var parts = c.parts.filter(function (p) { return p.slot && p.kind !== 'target'; });
    if (def.callArgs) {
      parts = def.callArgs.map(function (n) { return parts.filter(function (p) { return p.slot === n; })[0]; }).filter(Boolean);
    }
    var slots = {};
    if (obj) {
      var ci = -1;
      parts.forEach(function (p, i) { if (ci < 0 && p.kind === 'control') ci = i; });
      if (ci >= 0) {
        slots[parts[ci].slot] = obj.type === 'RefCtl' ? obj : node('ControlRef', obj, { name: obj.name });
        parts = parts.slice(0, ci).concat(parts.slice(ci + 1));
      }
    }
    if (args.length !== parts.length) {
      throw new WzError('argCount', [label, msg(msgLang, 'nValues', [parts.length]), args.length], at);
    }
    parts.forEach(function (p, i) {
      var a = args[i];
      if (p.kind === 'control') {
        if (a.type === 'Ident') a = node('ControlRef', a, { name: a.name });
        else if (a.type === 'Str') a = node('ControlRef', a, { name: a.v });
        else throw new WzError('expectedControl', [label], a);
      }
      slots[p.slot] = a;
    });
    return slots;
  }

  /* ---- expressions ---- */

  /** A value. cond ? a : b is the C way of writing "a if cond, else b". */
  P.parseExpr = function () {
    var c = this.parseOr();
    if (this.isOp('?')) {
      var q = this.advance();
      var a = this.parseExpr();
      this.expectOp(':');
      var b = this.parseExpr();
      return node('Cond', q, { cond: c, a: a, b: b });
    }
    return c;
  };

  /** Is the word operator `canon` next, written in capitals (LOGICAL) or in small letters (binary)? */
  P.opWord = function (canon, upper) {
    var tk = this.cur();
    return this.is(canon) && isUpperWord(tk) === upper;
  };
  /* OR, NOR, ||  (lowest) */
  P.parseOr = function () {
    var l = this.parseXor();
    for (;;) {
      var t = this.cur(), op = null;
      if (this.isOp('||')) op = 'or';
      else if (this.opWord('or', true)) op = 'or';
      else if (this.opWord('nor', true)) op = 'nor';
      if (!op) break;
      this.advance();
      l = node('Bin', t, { op: op, l: l, r: this.parseXor() });
    }
    return l;
  };
  /* XOR, XNOR */
  P.parseXor = function () {
    var l = this.parseAnd();
    for (;;) {
      var t = this.cur(), op = null;
      if (this.opWord('xor', true)) op = 'xor';
      else if (this.opWord('xnor', true)) op = 'xnor';
      if (!op) break;
      this.advance();
      l = node('Bin', t, { op: op, l: l, r: this.parseAnd() });
    }
    return l;
  };
  /* AND, NAND, && */
  P.parseAnd = function () {
    var l = this.parseBitOr();
    for (;;) {
      var t = this.cur(), op = null;
      if (this.isOp('&&')) op = 'and';
      else if (this.opWord('and', true)) op = 'and';
      else if (this.opWord('nand', true)) op = 'nand';
      if (!op) break;
      this.advance();
      l = node('Bin', t, { op: op, l: l, r: this.parseBitOr() });
    }
    return l;
  };
  /* or, nor (bit by bit) */
  P.parseBitOr = function () {
    var l = this.parseBitXor();
    for (;;) {
      var t = this.cur(), op = null;
      if (this.opWord('or', false)) op = 'bor';
      else if (this.opWord('nor', false)) op = 'bnor';
      if (!op) break;
      this.advance();
      l = node('Bin', t, { op: op, l: l, r: this.parseBitXor() });
    }
    return l;
  };
  /* xor, xnor (bit by bit) */
  P.parseBitXor = function () {
    var l = this.parseBitAnd();
    for (;;) {
      var t = this.cur(), op = null;
      if (this.opWord('xor', false)) op = 'bxor';
      else if (this.opWord('xnor', false)) op = 'bxnor';
      if (!op) break;
      this.advance();
      l = node('Bin', t, { op: op, l: l, r: this.parseBitAnd() });
    }
    return l;
  };
  /* and, nand (bit by bit) */
  P.parseBitAnd = function () {
    var l = this.parseNot();
    for (;;) {
      var t = this.cur(), op = null;
      if (this.opWord('and', false)) op = 'band';
      else if (this.opWord('nand', false)) op = 'bnand';
      if (!op) break;
      this.advance();
      l = node('Bin', t, { op: op, l: l, r: this.parseNot() });
    }
    return l;
  };
  /* NOT (logical) / not (bit by bit): it takes the whole comparison after it, like "not x is empty" */
  P.parseNot = function () {
    if (this.is('not') && !this.is('isnot')) {
      var t = this.cur();
      this.eat('not');
      return node('Un', t, { op: isUpperWord(t) ? 'not' : 'bnot', x: this.parseNot() });
    }
    return this.parseCmp();
  };
  P.parseCmp = function () {
    var l = this.parseCat();
    var t = this.cur();
    if (t.t === 'op' && SYM_CMP[t.v]) {
      this.advance();
      return node('Bin', t, { op: SYM_CMP[t.v], l: l, r: this.parseCat() });
    }
    var best = null, bestLen = 0;
    for (var k = 0; k < CMP_PHRASES.length; k++) {
      var n = this.m(CMP_PHRASES[k][0]);
      if (n > bestLen) { best = CMP_PHRASES[k]; bestLen = n; }
    }
    if (best) {
      this.i += bestLen;
      if (best[1] === 'empty' || best[1] === 'notempty') return node('IsEmpty', t, { x: l, neg: best[1] === 'notempty' });
      if ((best[0] === 'is' || best[0] === 'isnot') && this.typeStartAt(0) && !this.isOp('.', 1) && !this.isOp('(', 1)) {
        // pet is Dog: is the value of this type?
        return node('IsType', t, { x: l, tref: this.parseTypeRef(), neg: best[0] === 'isnot' });
      }
      return node('Bin', t, { op: best[1], l: l, r: this.parseCat() });
    }
    if (this.word('as') && this.typeStartAt(1)) {
      // pet as Dog: the value if it is a Dog, else nothing
      this.advance();
      return node('AsType', t, { x: l, tref: this.parseTypeRef() });
    }
    return l;
  };
  P.parseCat = function () {
    var l = this.parseShift();
    while (this.isOp('&')) {
      var t = this.advance();
      l = node('Bin', t, { op: '&', l: l, r: this.parseShift() });
    }
    return l;
  };
  /* x shl 2, x << 2, x shr 1, x >> 1: the bits move left or right */
  P.parseShift = function () {
    var l = this.parseAdd();
    for (;;) {
      var t = this.cur(), op = null;
      if (this.isOp('<<') || this.is('shl')) op = 'shl';
      else if (this.isOp('>>') || this.is('shr')) op = 'shr';
      if (!op) break;
      if (t.t === 'op') this.advance(); else this.eat(op);
      l = node('Bin', t, { op: op, l: l, r: this.parseAdd() });
    }
    return l;
  };
  P.parseAdd = function () {
    var l = this.parseMul();
    while (this.isOp('+') || this.isOp('-')) {
      var t = this.advance();
      l = node('Bin', t, { op: t.v, l: l, r: this.parseMul() });
    }
    return l;
  };
  P.parseMul = function () {
    var l = this.parsePow();
    for (;;) {
      var t = this.cur();
      if (this.isOp('*') || this.isOp('/') || this.isOp('%')) {
        this.advance();
        l = node('Bin', t, { op: t.v === '%' ? 'mod' : t.v, l: l, r: this.parsePow() });
      } else if (this.is('mod')) {
        this.eat('mod');
        l = node('Bin', t, { op: 'mod', l: l, r: this.parsePow() });
      } else break;
    }
    return l;
  };
  P.parsePow = function () {
    var l = this.parseUnary();
    if (this.isOp('^')) {
      var t = this.advance();
      return node('Bin', t, { op: '^', l: l, r: this.parsePow() });
    }
    return l;
  };
  P.parseUnary = function () {
    if (this.isOp('!')) {
      // !x is "not x" (as in C it goes with the value next to it: !a && b)
      var nt = this.advance();
      return node('Un', nt, { op: 'not', x: this.parseUnary() });
    }
    if (this.isOp('-')) {
      var t = this.advance();
      var x = this.parseUnary();
      if (x.type === 'Num') { x.v = -x.v; return x; }
      return node('Un', t, { op: 'neg', x: x });
    }
    if (this.isOp('+')) { this.advance(); return this.parseUnary(); }
    return this.parsePostfix();
  };
  P.parsePostfix = function () {
    var e = this.parsePrimary();
    for (;;) {
      if (this.isOp('.')) {
        this.advance();
        var nt = this.cur();
        if (nt.t !== 'word') this.fail('expectedName', []);
        this.advance();
        e = node('Member', nt, { obj: e, name: nt.v, nameTok: nt });
      } else if (this.isOp('[')) {
        var bt = this.advance();
        var idx = this.parseExpr();
        this.expectOp(']');
        e = node('Index', bt, { obj: e, index: idx });
      } else if (this.isOp('(') && (e.type === 'Ident' || e.type === 'Member' || e.type === 'Base')) {
        var pt = this.advance();
        var args = [];
        if (!this.isOp(')')) {
          do { args.push(this.parseExpr()); } while (this.eatOp(','));
        }
        this.expectOp(')');
        e = node('Call', e.type === 'Ident' ? e : pt, { callee: e, args: args });
        e.line = e.callee.line; e.col = e.callee.col; e.pos = e.callee.pos;
      } else break;
    }
    return e;
  };
  P.parsePrimary = function () {
    var t = this.cur();
    switch (t.t) {
      case 'num':
        this.advance();
        return node('Num', t, { v: t.v, f: !!t.f });
      case 'str':
        this.advance();
        return this.strNode(t);
      case 'op':
        if (t.v === '(') {
          if (this.typeStartAt(1)) { var cast = this.tryCast(); if (cast) return cast; }
          this.advance();
          var e = this.parseExpr();
          this.expectOp(')');
          return e;
        }
        if (t.v === '[') {
          this.advance();
          var items = [];
          while (!this.isOp(']')) {
            items.push(this.parseExpr());
            if (!this.eatOp(',')) break;
          }
          this.expectOp(']');
          return node('List', t, { items: items });
        }
        if (t.v === '{') {
          // a record: {name: "Rex", age: 3} - it can take several lines
          this.advance();
          var entries = [];
          this.skipNL();
          if (!this.isOp('}') && !((this.cur().t === 'word' || this.cur().t === 'str') && (this.isOp(':', 1) || this.isOp('=', 1)))) {
            // C: {1, 2, 3} - the values of an array (or of a struct, in order)
            var bitems = [];
            for (;;) {
              bitems.push(this.parseExpr());
              this.skipNL();
              if (!this.eatOp(',')) break;
              this.skipNL();
              if (this.isOp('}')) break;
            }
            this.expectOp('}');
            return node('List', t, { items: bitems, brace: true });
          }
          while (!this.isOp('}')) {
            var kt = this.cur();
            var key;
            if (kt.t === 'word') key = kt.v;
            else if (kt.t === 'str' && kt.parts.length === 1 && typeof kt.parts[0] === 'string') key = kt.parts[0];
            else this.fail('expectedName', []);
            this.advance();
            if (!this.eatOp(':')) this.expectOp('=');
            this.skipNL();
            entries.push({ key: key, tok: kt, value: this.parseExpr() });
            this.skipNL();
            if (!this.eatOp(',')) break;
            this.skipNL();
          }
          this.expectOp('}');
          return node('Record', t, { entries: entries });
        }
        this.fail('expectedValueGot', [t.v]);
        break;
      case 'word':
        if (this.is('true')) { this.eat('true'); return node('Bool', t, { v: true }); }
        if (this.is('false')) { this.eat('false'); return node('Bool', t, { v: false }); }
        if (this.is('nothing')) { this.eat('nothing'); return node('Null', t); }
        if (this.is('find')) { var q = this.tryFind(); if (q) return q; }
        if (this.is('count')) { var q2 = this.tryCount(); if (q2) return q2; }
        if (t.n === 'new' && this.typeStartAt(1)) return this.parseNew();
        if (t.n === 'this') { this.advance(); return node('This', t); }
        if ((t.n === 'base' || t.n === 'super') && (this.isOp('.', 1) || this.isOp('(', 1))) { this.advance(); return node('Base', t); }
        if (t.n === 'sizeof' && this.isOp('(', 1)) return this.parseSizeOf();
        if (this.reservedAt(0)) this.fail('expectedValueGot', [t.v]);
        this.advance();
        return node('Ident', t, { name: t.v });
      case 'nl':
      case 'eof':
        this.fail('expectedValue', []);
        break;
      default:
        this.fail('expectedValueGot', [t.v]);
    }
  };

  P.strNode = function (t) {
    var hasExpr = t.parts.some(function (p) { return typeof p !== 'string'; });
    if (!hasExpr) return node('Str', t, { v: t.parts.join(''), sq: !!t.raw });
    var self = this;
    var parts = t.parts.map(function (p) {
      if (typeof p === 'string') return p;
      var toks = p.toks.concat([{ t: 'eof', v: '', line: t.line, col: t.col, pos: p.end, end: p.end }]);
      var sub = new Parser(toks, self.ctx);
      var e = sub.parseExpr();
      if (sub.cur().t !== 'eof') sub.fail('extraTokens', [sub.cur().v]);
      return e;
    });
    return node('Tpl', t, { parts: parts });
  };

  P.tryFind = function () {
    var save = this.i, kw = this.cur();
    this.eat('find');
    var mode;
    if (this.eat('all')) mode = 'all';
    else if (this.eat('first')) mode = 'first';
    else { this.i = save; return null; }
    if (!this.eat('in')) this.eat('from');
    var tb = this.parseTableName();
    var where = null, order = null, limit = null;
    if (this.eat('where')) where = this.parseExpr();
    if (this.eat('orderby')) order = this.parseOrder();
    if (this.eat('limit')) limit = this.parseExpr();
    return node('Find', kw, { mode: mode, table: tb, where: where, order: order, limit: limit });
  };

  P.parseOrder = function () {
    if (this.eat('random')) return 'random';
    var list = [];
    do {
      var ct = this.parseName();
      var desc = false;
      if (this.eat('descending')) desc = true;
      else this.eat('ascending');
      list.push({ col: ct.v, tok: ct, desc: desc });
    } while (this.eatOp(','));
    return list;
  };

  P.tryCount = function () {
    var save = this.i, kw = this.cur();
    this.eat('count');
    if (!this.eat('in')) this.eat('from');
    if (!this.isTableAt(0)) { this.i = save; return null; }
    var tb = this.parseTableName();
    var where = null;
    if (this.eat('where')) where = this.parseExpr();
    return node('Count', kw, { table: tb, where: where });
  };

  /* =====================================================================
   * Code generation
   * ===================================================================== */

  /** Walks a block and calls fn on every statement (not into nested functions). */
  function walkStmts(body, fn) {
    (body || []).forEach(function (st) {
      if (!st) return;
      fn(st);
      switch (st.type) {
        case 'If':
          st.branches.forEach(function (b) { walkStmts(b.body, fn); });
          if (st.els) walkStmts(st.els, fn);
          break;
        case 'Repeat': case 'While': case 'ForEach': case 'ForRange': case 'DoWhile': case 'Block':
          walkStmts(st.body, fn);
          break;
        case 'CFor':
          walkStmts([st.init, st.step].filter(Boolean), fn);
          walkStmts(st.body, fn);
          break;
        case 'Switch':
          st.cases.forEach(function (c) { walkStmts(c.body, fn); });
          if (st.def) walkStmts(st.def.body, fn);
          break;
        case 'Try':
          walkStmts(st.body, fn);
          walkStmts(st.handler, fn);
          break;
      }
    });
  }

  /** Does an expression use the name n? (not inside find / count, where names can be columns) */
  function usesName(x, n) {
    if (!x || typeof x !== 'object') return false;
    if (Array.isArray(x)) return x.some(function (y) { return usesName(y, n); });
    if (x.type === 'Ident') return norm(x.name) === n;
    if (x.type === 'Find' || x.type === 'Count') return false;
    for (var k in x) {
      if (k === 'tok' || k === 'nameTok' || k === 'table' || k === 'def') continue;
      if (x[k] && typeof x[k] === 'object' && usesName(x[k], n)) return true;
    }
    return false;
  }

  /** Names a block assigns to (they become variables). */
  function assignedNames(body, out) {
    out = out || [];
    function rootName(t) {
      while (t && (t.type === 'Member' || t.type === 'Index')) t = t.obj;
      return t && t.type === 'Ident' ? t : null;
    }
    walkStmts(body, function (st) {
      switch (st.type) {
        case 'Set': case 'Inc':
          if (st.target.type === 'Ident') out.push({ name: st.target.name, tok: st.target, decl: !!st.decl });
          break;
        case 'Add': case 'Remove': case 'Clear':
          if (st.target.type === 'Ident') out.push({ name: st.target.name, tok: st.target, soft: true });
          break;
        case 'ForEach': case 'ForRange':
          out.push({ name: st.name, tok: st.nameTok, loop: true });
          break;
        case 'Command':
          Object.keys(st.slots).forEach(function (k) {
            var s = st.slots[k];
            if (s && s.type === 'Ident' && st.cmd.parts.some(function (p) { return p.slot === k && p.kind === 'target'; })) {
              out.push({ name: s.name, tok: s });
            }
          });
          break;
      }
    });
    return out;
  }

  /** The typed declarations in a block: normal name -> { ty, konst } (one name has one type). */
  function declTypes(body, specOf, onErr) {
    var out = {};
    function add(name, tok, ty, konst) {
      var n = norm(name), o = out[n];
      if (o && ty && o.ty && o.ty !== ty) { onErr(new WzError('typeRedeclared', [name, showTy(o.ty)], tok)); return; }
      if (!o) out[n] = { ty: ty || undefined, konst: !!konst };
      else {
        if (ty) o.ty = ty;
        if (konst) o.konst = true;
      }
    }
    walkStmts(body, function (st) {
      if (st.type === 'Set' && st.decl && st.target.type === 'Ident') {
        var ty = specOf(st.tref);
        if (st.arr) ty = 'L:' + (ty || 'any');
        if (ty || st.konst) add(st.target.name, st.target, ty, st.konst);
      } else if (st.type === 'ForEach' && st.tref) {
        add(st.name, st.nameTok, specOf(st.tref), false);
      }
    });
    return out;
  }

  function isCompare(op) {
    return ['=', '!=', '<', '>', '<=', '>=', 'contains', 'starts', 'ends'].indexOf(op) >= 0;
  }

  /* ---- static types: what the compiler knows about a value ----
   * A type is written as a short text:
   *   int8 ... int64, uint8 ... uint64, float16, float32, float64, bool, char, string, any
   *   S:Point (struct)  U:Number (union)  C:Dog (class or interface)  G:Button (a control of the page)
   *   L:int32 (a list of int32, int32[])
   * The same texts are used by the runtimes (wz.conv, wz.zero, wz.is_a).
   */
  var INT_BITS = { int8: [8, true], int16: [16, true], int32: [32, true], int64: [64, true],
    uint8: [8, false], uint16: [16, false], uint32: [32, false], uint64: [64, false] };
  var FLOAT_BITS = { float16: 16, float32: 32, float64: 64 };
  var SCALAR_SIZES = { bool: 1, char: 1, int8: 1, uint8: 1, int16: 2, uint16: 2, int32: 4, uint32: 4,
    int64: 8, uint64: 8, float16: 2, float32: 4, float64: 8 };
  var MAX_SAFE = 9007199254740991;
  function isIntTy(ty) { return !!INT_BITS[ty]; }
  function isFloatTy(ty) { return !!FLOAT_BITS[ty]; }
  /** In C, char and bool are numbers too ('A' + 1 is 66). */
  function isNumTy(ty) { return !!(INT_BITS[ty] || FLOAT_BITS[ty]) || ty === 'char' || ty === 'bool'; }
  function tyKind(ty) { return ty && ty.length > 2 && ty.charAt(1) === ':' ? ty.charAt(0) : ''; }
  function tyName(ty) { return ty.slice(2); }
  /** The rough kind of value the old (untyped) code paths understand. */
  function coarse(ty) {
    if (!ty) return 'any';
    if (INT_BITS[ty] || FLOAT_BITS[ty]) return 'num';
    if (ty === 'string' || ty === 'char') return 'text';
    if (ty === 'bool') return 'bool';
    var k = tyKind(ty);
    if (k === 'L') return 'list';
    if (k === 'S') return 'rec';
    return 'any';
  }
  /** A type as people write it: int32, unsigned int8, Point, int32[] */
  function showTy(ty) {
    if (!ty || ty === 'any') return 'var';
    if (INT_BITS[ty]) return INT_BITS[ty][1] ? ty : 'unsigned ' + ty.slice(1);
    var k = tyKind(ty);
    if (k === 'L') return showTy(ty.slice(2)) + '[]';
    if (k) return ty.slice(2);
    return ty;
  }
  L.showType = showTy;
  /** C: the type of a whole-number operation (int8 + int8 is an int32, int64 + uint32 an int64...). */
  function promote(a, b) {
    function p(t) { return (t === 'char' || t === 'bool' || (INT_BITS[t] && INT_BITS[t][0] < 32)) ? 'int32' : t; }
    a = p(a); b = p(b || a);
    if (a === 'uint64' || b === 'uint64') return 'uint64';
    if (a === 'int64' || b === 'int64') return 'int64';
    if (a === 'uint32' || b === 'uint32') return 'uint32';
    return 'int32';
  }
  /** A whole number kept inside a C type, at compile time (int8 200 is -56). null if it doesn't fit in 64 bits. */
  function wrapConst(v, ty) {
    var b = INT_BITS[ty], t = Math.trunc(v);
    if (Math.abs(t) > MAX_SAFE) return null;
    if (b[0] >= 64) return (!b[1] && t < 0) ? null : t;
    var m = Math.pow(2, b[0]), r = t % m;
    if (r < 0) r += m;
    if (b[1] && r >= m / 2) r -= m;
    return r === 0 ? 0 : r;
  }
  function chars(s) { return Array.from(String(s)); }

  /**
   * One generator per (target, file). Targets:
   *   js  - page JavaScript      (where = client)
   *   sim - browser test server  (where = server)
   *   php - real server          (where = server)
   */
  function Gen(C, target, where, file) {
    this.C = C;
    this.T = target;
    this.where = where;
    this.file = file;
    this.lines = [];
    this.ind = '';
    this.scope = null;
    this.special = {};
    this.brk = [];       // the loops and switches around the code: 'loop' / 'switch'
    this.tmp = 0;
    this.lastLine = 0;
    this.debug = C.debug;
    this.cls = null;     // the class whose code is being written (its methods, its constructor)
    this.isStatic = false;
    this.inCtor = false;
    this.fnRty = null;   // the type the function gives back (null: any)
  }
  var G = Gen.prototype;

  G.err = function (key, args, nd, extra) {
    throw new WzError(key, args, nd ? { line: nd.line, col: nd.col, pos: nd.pos, end: nd.end } : null, extra);
  };
  G.line = function (s) { this.lines.push(this.ind + s); };
  G.indent = function () { this.ind += '    '; };
  G.dedent = function () { this.ind = this.ind.slice(4); };
  G.V = function (name) { return (this.T === 'php' ? '$v_' : 'v_') + mangle(name); };
  G.F = function (name) { return 'f_' + mangle(name); };
  G.H = function (name, args) {
    return (this.T === 'php' ? 'wz_' + name : 'wz.' + name) + '(' + (args || []).join(', ') + ')';
  };
  G.S = function (s) { return this.T === 'php' ? phpStr(s) : jsStr(s); };
  G.tmpName = function (p) { this.tmp++; return (this.T === 'php' ? '$' : '$') + p + this.tmp; };
  G.say = function (canon) { return this.C.vocab.say(canon); };

  G.mark = function (nd) {
    if (!this.debug || !nd || !nd.line) return;
    if (this.T === 'php') this.line('wz_at(' + this.S(this.file) + ', ' + nd.line + ');');
    else this.line('$L = ' + nd.line + ';');
  };
  G.tick = function () {
    if (this.debug && this.T !== 'php') this.line('wz.tick();');
  };

  /* ---- names ---- */

  G.varInScope = function (n) {
    if (this.special[n]) return this.special[n];
    if (this.scope && this.scope.has(n)) return this.V(n);
    if (this.where === 'client' && this.C.globals.has(n) && !this.fieldOf(n)) return this.V(n);
    return null;
  };
  /** The type of a variable: { ty, konst } (null when it was made without a type). */
  G.varInfo = function (n) {
    if (this.special[n]) return null;
    var v = null;
    if (this.scope && this.scope.has(n)) v = this.scope.get(n);
    else if (this.where === 'client' && this.C.globals.has(n) && !this.fieldOf(n)) v = this.C.globals.get(n);
    return v && v !== true ? v : null;
  };
  /** Inside the code of a class: the field n of the class (written without this.), if no variable hides it. */
  G.fieldOf = function (n) {
    if (!this.cls || this.special[n] || (this.scope && this.scope.has(n))) return null;
    return this.C.findField(this.cls, n);
  };
  /** The class name the runtime uses to check private and protected (null outside classes). */
  G.ctxCode = function () { return this.cls ? this.S(this.cls.name) : 'null'; };
  /** Remember the type of an untyped variable from its value (var dog = new Dog()). */
  G.inferType = function (n, ty) {
    var e = { ty: ty, inferred: true };
    if (this.scope && this.scope.has(n)) this.scope.set(n, e);
    else if (this.where === 'client' && this.C.globals.has(n)) this.C.globals.set(n, e);
  };
  /**
   * Temp.from(212) when a variable temp exists too (names don't care about capitals): the class wins
   * unless the variable holds an object, a struct or a control of its own.
   */
  G.staticOwner = function (n) {
    var ti = this.C.typeNamed(n);
    if (!ti) return null;
    if (this.where === 'client' && this.C.control(n)) return null;
    if (!this.varInScope(n) && !this.fieldOf(n)) return ti;
    var vi = this.varInfo(n), f = this.fieldOf(n);
    if (vi && vi.inferred) return null;        // a var that held an object: it is the variable
    var ty = vi ? vi.ty : (f ? f.ty : undefined);
    return tyKind(ty) ? null : ti;
  };

  G.allNames = function () {
    var names = [];
    if (this.scope) this.scope.forEach(function (_, k) { names.push(k); });
    var self = this;
    if (this.scope && this.scope.display) names = names.map(function (k) { return self.scope.display[k] || k; });
    if (this.where === 'client') {
      this.C.globals.forEach(function (_, k) { names.push(self.C.globalDisplay[k] || k); });
      this.C.controls.forEach(function (c) { names.push(c.name); });
    }
    Object.keys(this.C.functions).forEach(function (k) { names.push(self.C.functions[k].name); });
    Object.keys(this.C.vocab.functions).forEach(function (k) { names.push(k); });
    return names;
  };

  G.unknown = function (nd, name) {
    var s = suggest(name, this.allNames());
    this.err('unknownName', [name], nd, s ? msg(this.C.msgLang, 'didYouMean', [s]) : '');
  };

  /* ---- expressions: return { c: code, t: type } ---- */

  G.e = function (nd) { return this.E(nd).c; };

  /**
   * The code of a value: { c: code, t: rough kind (num, text, bool, list, rec, any),
   *   ty: its C type when known (int32, S:Point...), lit: a literal, place: read from a variable / field / item }
   * stmt: the value is not used (a call on its own line), so a void function is fine.
   */
  G.E = function (nd, stmt) {
    var self = this;
    switch (nd.type) {
      case 'Num': return { c: String(nd.v), t: 'num', lit: true, v: nd.v, flit: !!nd.f };
      case 'Str': {
        var sr = { c: this.S(nd.v), t: 'text', lit: true, v: nd.v };
        // 'A' next to a char or a number is a char, like in C ('a' + 1, c - 'a')
        if (nd.sq && chars(nd.v).length === 1) sr.chlit = true;
        return sr;
      }
      case 'Pre': return nd.x;
      case 'Bool': return { c: nd.v ? 'true' : 'false', t: 'bool', lit: true };
      case 'Null': return { c: 'null', t: 'null', lit: true };
      case 'Tpl': {
        if (this.T === 'php') {
          var bits = nd.parts.map(function (p) {
            return typeof p === 'string' ? phpStr(p) : self.textOf(self.E(p));
          }).filter(function (b) { return b !== "''"; });
          return { c: bits.length ? '(' + bits.join(' . ') + ')' : "''", t: 'text' };
        }
        var s = '`';
        nd.parts.forEach(function (p) {
          if (typeof p === 'string') s += jsTplPart(p);
          else s += '${' + self.textOf(self.E(p)) + '}';
        });
        return { c: s + '`', t: 'text' };
      }
      case 'List': {
        return { c: '[' + nd.items.map(function (x) { return self.val(self.E(x)); }).join(', ') + ']', t: 'list' };
      }
      case 'Record': {
        if (this.T === 'php') {
          return { c: '[' + nd.entries.map(function (en) { return phpStr(en.key) + ' => ' + self.val(self.E(en.value)); }).join(', ') + ']', t: 'rec' };
        }
        return { c: '{' + nd.entries.map(function (en) { return jsStr(en.key) + ': ' + self.val(self.E(en.value)); }).join(', ') + '}', t: 'rec' };
      }
      case 'Ident': return this.ident(nd);
      case 'Member': return this.member(nd);
      case 'Index': return this.index(nd);
      case 'Call': {
        var cr = this.call(nd);
        if (cr.ty === 'void' && !stmt) this.err('noValue', [nd.callee.name || '?'], nd);
        return cr;
      }
      case 'Un': {
        var x = this.E(nd.x);
        if (nd.op === 'neg') {
          if (x.ty && isNumTy(x.ty)) {
            // C: -x keeps the type (an int8 becomes an int32 first); an unsigned number goes round
            if (isFloatTy(x.ty)) return { c: '(-' + x.c + ')', t: 'num', ty: x.ty };
            var nr = promote(x.ty), nb = INT_BITS[nr];
            return { c: this.H('ia', ['-(' + this.numCode(x) + ')', nb[0], nb[1]]), t: 'num', ty: nr };
          }
          if (x.t === 'num') return { c: '(-' + x.c + ')', t: 'num' };
          return { c: this.H('neg', [x.c]), t: 'num' };
        }
        if (nd.op === 'bnot') return this.bitNot(nd, x);
        return { c: '!' + this.truthy(x), t: 'bool' };
      }
      case 'Bin': return this.bin(nd);
      case 'IsEmpty': {
        var c = this.H('is_empty', [this.e(nd.x)]);
        return { c: nd.neg ? '!' + c : c, t: 'bool' };
      }
      case 'Find': case 'Count': return this.query(nd);
      case 'ControlRef': return { c: this.S(this.controlName(nd)), t: 'text' };
      case 'Cond': {
        var cc = this.truthy(this.E(nd.cond)), ca = this.E(nd.a), cb = this.E(nd.b);
        return { c: '(' + cc + ' ? ' + ca.c + ' : ' + cb.c + ')', t: ca.t === cb.t ? ca.t : 'any',
          ty: ca.ty && ca.ty === cb.ty ? ca.ty : undefined, place: ca.place || cb.place };
      }
      case 'This': return this.thisRef(nd);
      case 'Base': this.err('baseAlone', [nd.v || 'base'], nd); break;
      case 'New': return this.newValue(nd);
      case 'NewArray': {
        var aty = this.C.spec(nd.tref);
        var sz = this.E(nd.size);
        return { c: this.H('array', [sz.c, this.S(aty)]), t: 'list', ty: 'L:' + aty };
      }
      case 'Cast': return this.castTo(this.E(nd.x), this.C.spec(nd.tref), nd);
      case 'SizeOf': return this.sizeOf(nd);
      case 'IsType': {
        var ity = this.C.spec(nd.tref);
        var ix = this.valueAsObj(nd.x, ity);
        var ic = this.H('is_a', [ix, this.S(ity)]);
        return { c: nd.neg ? '!' + ic : ic, t: 'bool' };
      }
      case 'AsType': {
        var aty2 = this.C.spec(nd.tref);
        return { c: this.H('as_a', [this.valueAsObj(nd.x, aty2), this.S(aty2)]), t: coarse(aty2), ty: aty2 };
      }
    }
    this.err('expectedValue', [], nd);
  };

  /** The value of x to keep somewhere else: lists, records and structs are copied (in PHP they always are). */
  G.val = function (x) {
    if (this.T === 'php' || !x.place) return x.c;
    var k = tyKind(x.ty);
    if (x.ty && x.ty !== 'any' && !k) return x.c;     // numbers, text, bool, char: nothing to copy
    if (k === 'C' || k === 'G') return x.c;            // objects and controls are shared, not copied
    return this.H('val', [x.c]);
  };
  /** The C type of a value in arithmetic: its type, or for a literal the type C gives it (5 is an int32, 2.5 a float64). */
  G.opTy = function (x) {
    if (x.ty) return isNumTy(x.ty) ? x.ty : null;
    if (x.chlit) return 'char';
    if (x.lit && x.t === 'num') return Number.isInteger(x.v) && !x.flit ? (Math.abs(x.v) <= 2147483647 ? 'int32' : 'int64') : 'float64';
    if (x.lit && x.t === 'bool') return 'bool';
    return null;
  };
  /** The code of x as a number (a char is its code, true is 1). */
  G.numCode = function (x) {
    if (x.chlit) return String(chars(x.v)[0].codePointAt(0));
    if (x.ty === 'char' || x.ty === 'bool' || (x.lit && x.t === 'bool')) return this.H('code', [x.c]);
    return x.c;
  };

  G.textOf = function (x) {
    return x.t === 'text' ? x.c : this.H('text', [x.c]);
  };
  /** A list of values: the code of each one, ready to be kept (copied when needed). */
  G.vals = function (nodes) {
    var self = this;
    return nodes.map(function (x) { return self.val(self.E(x)); });
  };
  G.truthy = function (x) {
    return x.t === 'bool' ? x.c : this.H('truthy', [x.c]);
  };

  G.controlName = function (nd) {
    var n = norm(nd.name);
    if (this.where !== 'client') {
      if (this.C.anyControl(n)) this.err('controlInServer', [nd.name], nd);
    }
    var ctl = this.C.control(n);
    if (!ctl) {
      if (this.C.isSite && this.C.anyControl(n)) this.err('controlInSite', [nd.name], nd);
      var s = suggest(nd.name, this.C.controls.map(function (c) { return c.name; }));
      this.err('unknownControl', [nd.name], nd, s ? msg(this.C.msgLang, 'didYouMean', [s]) : '');
    }
    return ctl.name;
  };

  G.ident = function (nd) {
    var n = norm(nd.name);
    var v = this.varInScope(n);
    if (v) {
      var vi = this.varInfo(n), vty = vi ? vi.ty : undefined;
      return { c: v, t: coarse(vty), ty: vty, place: true };
    }
    var fi = this.fieldOf(n);
    if (fi) return this.fieldRead(fi, nd);
    if (this.cls && this.C.findMethod(this.cls, n)) this.err('methodNeedsParens', [nd.name], nd);
    if (this.where === 'client') {
      var ctl = this.C.control(n);
      if (ctl) {
        var dp = this.C.defaultProp(ctl);
        return { c: this.H('get', [this.S(ctl.name), this.S(dp)]), t: 'any' };
      }
      if (this.C.isSite && this.C.anyControl(n)) this.err('controlInSite', [nd.name], nd);
    } else if (this.C.anyControl(n) && !this.C.functions[n]) {
      this.err('controlInServer', [nd.name], nd);
    }
    if (this.C.isObj(n, 'page')) this.err('pageNeedsProp', [], nd);
    if (this.C.isObj(n, 'session')) {
      if (this.where !== 'server') this.err('sessionClient', [], nd);
      this.err('sessionNeedsKey', [], nd);
    }
    var fn = this.C.functions[n];
    if (fn) {
      if (fn.params.length === 0) return this.callUser(fn, [], nd);
      this.err('argCount', [fn.name, msg(this.C.msgLang, 'nValues', [fn.params.length]), 0], nd);
    }
    var bi = this.C.vocab.functions[n];
    if (bi && minArgs(bi) === 0) return this.callBuiltin(bi, [], nd, nd.name);
    var tb = this.C.tableByNorm(n);
    if (tb) this.err('tableValue', [tb.name], nd);
    if (this.C.typeNamed(n) || BUILTIN_TYPES[n] !== undefined) this.err('typeValue', [nd.name], nd);
    this.unknown(nd, nd.name);
  };

  /* ---- fields, methods, objects ---- */

  /** this (inside the code of a class) */
  G.thisRef = function (nd) {
    if (!this.cls) this.err('thisOutside', [nd.v || 'this'], nd);
    if (this.isStatic) this.err('thisInStatic', [nd.v || 'this'], nd);
    return { c: '$self', t: 'any', ty: 'C:' + this.cls.name };
  };
  /** Is a private / protected member allowed here? */
  G.checkAccess = function (m, nd) {
    if (m.access === 'public') return;
    var ok = false;
    if (this.cls) {
      if (m.access === 'private') ok = this.cls === m.owner;
      else for (var c = this.cls; c; c = c.base) if (c === m.owner) { ok = true; break; }
    }
    if (!ok) this.err(m.access === 'private' ? 'privateMember' : 'protectedMember', [m.name, m.owner.name], nd);
  };
  /** A field read without this. inside the class (name) */
  G.fieldRead = function (f, nd) {
    if (f.isStatic) return this.staticFieldRead(f, nd);
    if (this.isStatic) this.err('needObjectField', [f.name], nd);
    return { c: this.H('oget', ['$self', this.S(f.name), this.ctxCode()]), t: coarse(f.ty), ty: f.ty, place: true };
  };
  G.staticFieldRead = function (f, nd) {
    this.checkAccess(f, nd);
    return { c: this.H('sfget', [this.S(f.owner.name), this.S(f.name), this.ctxCode()]), t: coarse(f.ty), ty: f.ty, place: true };
  };
  /** obj.field where obj is an object of a class */
  G.objMember = function (o, nd) {
    var ti = this.C.ti(o.ty);
    var f = this.C.findField(ti, nd.name);
    if (!f) {
      if (this.C.findMethod(ti, nd.name)) this.err('methodNeedsParens', [nd.name], nd);
      var s = suggest(nd.name, this.C.memberNames(ti));
      this.err('noMember', [ti.name, nd.name], nd, s ? msg(this.C.msgLang, 'didYouMean', [s]) : '');
    }
    this.checkAccess(f, nd);
    if (f.isStatic) return this.staticFieldRead(f, nd);
    return { c: this.H('oget', [o.c, this.S(f.name), this.ctxCode()]), t: coarse(f.ty), ty: f.ty, place: true };
  };
  /** Dog.count (a static field), int32.MaxValue */
  G.staticMember = function (ti, nd) {
    var f = this.C.findField(ti, nd.name);
    if (f && f.isStatic) return this.staticFieldRead(f, nd);
    if (f) this.err('needObjectField', [f.name], nd);
    if (this.C.findMethod(ti, nd.name)) this.err('methodNeedsParens', [nd.name], nd);
    this.err('noMember', [ti.name, nd.name], nd);
  };
  /** int32.MaxValue / int32.MinValue */
  G.limitOf = function (ty, nd) {
    var w = norm(nd.name), b = INT_BITS[ty];
    var lim = null;
    if (b && (w === 'maxvalue' || w === 'max')) lim = b[0] >= 64 ? MAX_SAFE : (b[1] ? Math.pow(2, b[0] - 1) - 1 : Math.pow(2, b[0]) - 1);
    if (b && (w === 'minvalue' || w === 'min')) lim = b[0] >= 64 ? (b[1] ? -MAX_SAFE : 0) : (b[1] ? -Math.pow(2, b[0] - 1) : 0);
    if (ty === 'float32' && (w === 'maxvalue' || w === 'max')) lim = 3.4028234663852886e38;
    if (ty === 'float32' && (w === 'minvalue' || w === 'min')) lim = -3.4028234663852886e38;
    if (ty === 'float64' && (w === 'maxvalue' || w === 'max')) lim = Number.MAX_VALUE;
    if (ty === 'float64' && (w === 'minvalue' || w === 'min')) lim = -Number.MAX_VALUE;
    if (ty === 'float16' && (w === 'maxvalue' || w === 'max')) lim = 65504;
    if (ty === 'float16' && (w === 'minvalue' || w === 'min')) lim = -65504;
    if (lim === null) this.err('noMember', [showTy(ty), nd.name], nd);
    return { c: String(lim), t: 'num', ty: ty, lit: true, v: lim };
  };
  /** A property of a control held in a variable (b.text) */
  G.refMember = function (o, nd) {
    var tname = tyName(o.ty);
    if (norm(nd.name) === 'name') return { c: this.H('cname', [o.c]), t: 'text', ty: 'string' };
    var key = this.propKey(nd), props = this.C.guiProps(tname);
    if (!key || !props[key]) {
      if (this.C.guiEvent(tname, nd.name)) this.err('eventValue', [nd.name], nd);
      var names = Object.keys(props).map(function (k) { return this.say('prop.' + k); }, this);
      var s = suggest(nd.name, names);
      this.err('unknownProp', [tname, nd.name, names.join(', ')], nd, s ? msg(this.C.msgLang, 'didYouMean', [s]) : '');
    }
    return { c: this.H('dot', [o.c, this.S(key)]), t: 'any' };
  };
  /** x.name for a value whose type is known */
  G.memberOf = function (o, nd) {
    var k = tyKind(o.ty), w = norm(nd.name);
    if (k === 'C') return this.objMember(o, nd);
    if (k === 'G') return this.refMember(o, nd);
    if (k === 'S' || k === 'U') {
      var f = this.C.structField(tyName(o.ty), nd.name);
      if (!f) {
        var td = this.C.ti(o.ty);
        var s = suggest(nd.name, td ? td.fields.map(function (x) { return x.name; }) : []);
        this.err('noMember', [tyName(o.ty), nd.name], nd, s ? msg(this.C.msgLang, 'didYouMean', [s]) : '');
      }
      return { c: this.H('dot', [o.c, this.S(f.name)]), t: coarse(f.ty), ty: f.ty, place: true };
    }
    if (o.ty === 'string' || o.ty === 'char' || k === 'L') {
      if (LENGTH_WORDS[w]) return { c: this.H('len', [o.c]), t: 'num', ty: 'int32' };
      this.err('noMember', [showTy(o.ty), nd.name], nd);
    }
    if (o.ty && isNumTy(o.ty)) this.err('noMember', [showTy(o.ty), nd.name], nd);
    var args = [o.c, this.S(nd.name)];
    if (this.cls) args.push(this.ctxCode());
    return { c: this.H('dot', args), t: 'any', place: true };
  };
  /** list[i], text[i] */
  G.index = function (nd) {
    var o = this.E(nd.obj), i = this.E(nd.index);
    var ty;
    if (tyKind(o.ty) === 'L') ty = tyName(o.ty);
    else if (o.ty === 'string') ty = 'char';
    else if (o.ty && tyKind(o.ty) !== '') this.err('notIndexable', [showTy(o.ty)], nd);
    return { c: this.H('idx', [o.c, i.c]), t: coarse(ty), ty: ty, place: true };
  };

  G.propKey = function (nd) {
    var w = norm(nd.name);
    return this.C.vocab.propByWord[w] || null;
  };

  G.member = function (nd) {
    var obj = nd.obj;
    if (obj.type === 'This' || obj.type === 'Base') {
      var me = this.thisRef(obj);
      if (obj.type === 'Base' && !this.cls.base) this.err('noBase', [this.cls.name], obj);
      return this.objMember(obj.type === 'Base' ? { c: me.c, ty: 'C:' + this.cls.base.name } : me, nd);
    }
    if (obj.type === 'Ident') {
      var n = norm(obj.name);
      // Dog.count: a static field of a class
      var sown = this.staticOwner(n);
      if (sown) return this.staticMember(sown, nd);
      if (!this.varInScope(n) && !this.fieldOf(n)) {
        if (BUILTIN_TYPES[n] && !this.C.anyControl(n)) return this.limitOf(BUILTIN_TYPES[n], nd);
        // Math.PI
        if (n === 'math' && !this.C.anyControl(n) && !this.C.tableByNorm(n)) {
          var mc = this.C.vocab.functions[norm(nd.name)];
          if (mc && minArgs(mc) === 0) return this.callBuiltin(mc, [], nd, nd.name);
          this.err('unknownName', [obj.name + '.' + nd.name], nd);
        }
        if (this.where === 'client' && this.C.control(n)) {
          var ctl = this.C.control(n);
          var pk0 = this.propKey(nd);
          if (!(pk0 && this.C.controlProps(ctl)[pk0]) && LENGTH_WORDS[norm(nd.name)]) {
            // NameBox1.length: the length of its text
            return { c: this.H('len', [this.H('get', [this.S(ctl.name), this.S(this.C.defaultProp(ctl))])]), t: 'num' };
          }
          var key = this.checkProp(ctl, nd);
          return { c: this.H('get', [this.S(ctl.name), this.S(key)]), t: this.C.propType(ctl, key) };
        }
        if (this.where !== 'client' && this.C.anyControl(n)) this.err('controlInServer', [obj.name], obj);
        if (this.where === 'client' && this.C.isSite && this.C.anyControl(n)) this.err('controlInSite', [obj.name], obj);
        if (this.C.isObj(n, 'page')) {
          if (this.where !== 'client') this.err('clientOnly', [obj.name], obj);
          var pk = this.checkPageProp(nd);
          return { c: this.H('get', [this.S('$page'), this.S(pk)]), t: 'any' };
        }
        if (this.C.isObj(n, 'session')) {
          if (this.where !== 'server') this.err('sessionClient', [], obj);
          return { c: this.H('sget', [this.S(nd.name)]), t: 'any' };
        }
        var tb = this.C.tableByNorm(n);
        if (tb) this.err('tableValue', [tb.name], obj);
      }
    }
    return this.memberOf(this.E(obj), nd);
  };

  G.checkProp = function (ctl, nd) {
    var key = this.propKey(nd);
    var props = this.C.controlProps(ctl);
    if (!key || !props[key]) {
      var names = Object.keys(props).map(function (k) { return this.say('prop.' + k); }, this);
      var s = suggest(nd.name, names);
      this.err('unknownProp', [ctl.name, nd.name, names.join(', ')], nd, s ? msg(this.C.msgLang, 'didYouMean', [s]) : '');
    }
    return key;
  };
  G.checkPageProp = function (nd) {
    var key = this.propKey(nd);
    var ok = ['title', 'name', 'background', 'color'];
    if (!key || ok.indexOf(key) < 0) {
      var names = ok.map(function (k) { return this.say('prop.' + k); }, this);
      this.err('unknownProp', [this.say('obj.page'), nd.name, names.join(', ')], nd);
    }
    return key;
  };

  G.call = function (nd) {
    var callee = nd.callee;
    if (callee.type === 'Ident') {
      var n = norm(callee.name);
      if (this.varInScope(n) || this.fieldOf(n)) this.err('notAFunction', [callee.name], callee);
      // a method of this class, called without this.: speak()
      var own = this.cls ? this.C.findMethod(this.cls, n) : null;
      if (own) return this.callMethod(own, null, nd.args, nd, callee);
      var fn = this.C.functions[n];
      if (fn) return this.callUser(fn, nd.args, nd);
      var bi = this.C.vocab.functions[n];
      if (bi) return this.callBuiltin(bi, nd.args, nd, callee.name);
      var cd = this.C.vocab.cmdCalls[n];
      if (cd) return this.cmdCall(cd, nd.args, nd, callee.name, true);
      // int32(x), float32(x), string(x), char(65): a cast written like a function
      if (BUILTIN_TYPES[n] !== undefined && BUILTIN_TYPES[n] !== 'void') {
        if (nd.args.length !== 1) this.err('argCount', [callee.name + '()', msg(this.C.msgLang, 'nValues', [1]), nd.args.length], nd);
        return this.castTo(this.E(nd.args[0]), BUILTIN_TYPES[n], nd);
      }
      var cti = this.C.typeNamed(n);
      if (cti) this.err('needNew', [cti.name], callee);
      var names = Object.keys(this.C.functions).map(function (k) { return this.C.functions[k].name; }, this)
        .concat(Object.keys(this.C.vocab.functions)).concat(Object.keys(this.C.vocab.cmdCalls));
      var s = suggest(callee.name, names);
      this.err('unknownFunction', [callee.name], callee, s ? msg(this.C.msgLang, 'didYouMean', [s]) : '');
    }
    if (callee.type === 'Member') return this.methodCall(nd);
    if (callee.type === 'Base') this.err('baseCallFirst', [callee.v || 'base'], callee);
    this.err('notAFunction', [callee.name || '?'], nd);
  };

  /** The values given to a function or method with typed parameters: checked, converted, copied. */
  G.argsFor = function (ptypes, args, nd, label) {
    var self = this;
    if (args.length !== ptypes.length) {
      this.err('argCount', [label, msg(this.C.msgLang, 'nValues', [ptypes.length]), args.length], nd);
    }
    return args.map(function (a, i) { return ptypes[i] ? self.valueAs(a, ptypes[i], nd) : self.val(self.E(a)); });
  };
  /** Call a method m of a class: on obj (a value), or on this when obj is null. */
  G.callMethod = function (m, o, args, nd, at) {
    this.checkAccess(m, at || nd);
    var label = m.name + '()';
    var a = this.argsFor(m.ptypes, args, nd, label);
    var code;
    if (m.isStatic) {
      code = this.C.methodFn(m) + '(' + a.join(', ') + ')';
    } else {
      if (!o) {
        if (this.isStatic) this.err('needObjectMethod', [m.name], at || nd);
        o = { c: '$self' };
      }
      code = this.H('vcall', [o.c, this.S(m.name), '[' + a.join(', ') + ']', this.ctxCode()]);
    }
    if (this.T !== 'php') code = '(await ' + code + ')';
    return { c: code, t: coarse(m.rty), ty: m.rty || undefined, place: !m.rty || !!tyKind(m.rty) };
  };

  /**
   * x.method(...): a function of the language with x as its first value
   * ("hi".upper() is upper("hi"), list.count() is length(list)), or one of your functions.
   * Also Math.round(x), Table.count(), Table.all().
   */
  G.methodCall = function (nd) {
    var cal = nd.callee, obj = cal.obj, m = norm(cal.name), name = cal.name;
    var label = (obj.type === 'Ident' ? obj.name + '.' : '') + name + '()';
    var at = cal.nameTok || cal;
    if (obj.type === 'This') {
      var me = this.thisRef(obj);
      var mm = this.C.findMethod(this.cls, m);
      if (!mm) this.err('noMethodC', [this.cls.name, name], at);
      return this.callMethod(mm, me, nd.args, nd, at);
    }
    if (obj.type === 'Base') {
      // base.speak(): the method as the base class writes it (not the one of this class)
      this.thisRef(obj);
      if (!this.cls.base) this.err('noBase', [this.cls.name], obj);
      var bm = this.C.findMethod(this.cls.base, m);
      if (!bm) this.err('noMethodC', [this.cls.base.name, name], at);
      if (bm.abstract) this.err('abstractCall', [bm.owner.name + '.' + bm.name], at);
      this.checkAccess(bm, at);
      var ba = this.argsFor(bm.ptypes, nd.args, nd, name + '()');
      var bcode = this.C.methodFn(bm) + '(' + (bm.isStatic ? '' : '$self' + (ba.length ? ', ' : '')) + ba.join(', ') + ')';
      if (this.T !== 'php') bcode = '(await ' + bcode + ')';
      return { c: bcode, t: coarse(bm.rty), ty: bm.rty || undefined, place: true };
    }
    if (obj.type === 'Ident') {
      var on = norm(obj.name);
      // Dog.create(): a static method
      var sti = this.staticOwner(on);
      if (sti) {
        var sm = this.C.findMethod(sti, m);
        if (!sm) this.err('noMethodC', [sti.name, name], at);
        if (!sm.isStatic) this.err('needObjectMethod', [sm.name], at);
        return this.callMethod(sm, null, nd.args, nd, at);
      }
      if (!this.varInScope(on) && !this.fieldOf(on)) {
        // int32.parse("12"), int.Parse(TextBox1.text)
        if (BUILTIN_TYPES[on] && !this.C.anyControl(on) && (m === 'parse' || m === 'valueof')) {
          if (nd.args.length !== 1) this.err('argCount', [label, msg(this.C.msgLang, 'nValues', [1]), nd.args.length], nd);
          return this.castTo(this.E(nd.args[0]), BUILTIN_TYPES[on], nd);
        }
        if (on === 'math' && !this.C.anyControl(on) && !this.C.tableByNorm(on)) {
          var mf = this.C.vocab.functions[m] || this.C.vocab.methods[m];
          if (mf) return this.callBuiltin(mf, nd.args, nd, name);
          this.err('unknownFunction', [name], cal.nameTok || cal);
        }
        var tb = this.C.tableByNorm(on);
        if (tb) {
          var tref = { name: tb.name, def: tb, tok: obj };
          if (m === 'count' && !nd.args.length) return this.query(node('Count', nd, { table: tref, where: null }));
          if ((m === 'all' || m === 'rows') && !nd.args.length) return this.query(node('Find', nd, { mode: 'all', table: tref, where: null, order: null, limit: null }));
          if (m === 'add' || m === 'insert') this.err('methodIsStatement', [label], nd);
          this.err('unknownMethod', [name, tb.name, 'add(…), count(), all()'], cal.nameTok || cal);
        }
        if (this.C.anyControl(on) && this.C.vocab.cmdMethods[m]) {
          if (this.where !== 'client') this.err('controlInServer', [obj.name], obj);
          if (this.C.isSite) this.err('controlInSite', [obj.name], obj);
          this.err('methodIsStatement', [label], nd);
        }
      }
    }
    var o = this.E(obj), ok = tyKind(o.ty);
    // an object of a class: dog.bark()
    if (ok === 'C') {
      var ti = this.C.ti(o.ty);
      var om = this.C.findMethod(ti, m);
      if (!om) {
        if (this.C.findField(ti, m)) this.err('notAFunction', [name], at);
        var ss = suggest(name, this.C.memberNames(ti));
        this.err('noMethodC', [ti.name, name], at, ss ? msg(this.C.msgLang, 'didYouMean', [ss]) : '');
      }
      return this.callMethod(om, o, nd.args, nd, at);
    }
    // a control held in a variable: b.hide() is a command that gives nothing back
    if (ok === 'G') {
      if (this.C.vocab.cmdMethods[m] || STMT_METHODS[m]) this.err('methodIsStatement', [label], nd);
      this.err('noMethodC', [tyName(o.ty), name], at);
    }
    if (ok === 'S' || ok === 'U') {
      if (!this.C.vocab.methods[m] && !this.C.functions[m]) this.err('noMethodC', [tyName(o.ty), name], at);
    }
    if (STMT_METHODS[m]) {
      var need = STMT_METHODS[m] === 'Clear' ? 0 : 1;
      if (nd.args.length !== need) this.err('argCount', [label, msg(this.C.msgLang, 'nValues', [need]), nd.args.length], nd);
      this.err('methodIsStatement', [label], nd);
    }
    var pre = node('Pre', obj, { x: o });
    var def = this.C.vocab.methods[m];
    var fn = this.C.functions[m];
    // a value whose type is not known, and a class has a method with this name: decided when the code runs
    if (!o.ty && this.C.hasMethodNamed(m)) return this.dynCall(o, name, nd, def, fn);
    if (def) return this.callBuiltin(def, [pre].concat(nd.args), nd, name, true);
    if (fn) return this.callUser(fn, [pre].concat(nd.args), nd, true);
    var s = suggest(name, Object.keys(this.C.vocab.methods).concat(Object.keys(STMT_METHODS)));
    this.err('unknownMethod2', [name], at, s ? msg(this.C.msgLang, 'didYouMean', [s]) : '');
  };
  /** x.speak() where x can be anything: an object's method if x is an object, else the function of the language. */
  G.dynCall = function (o, name, nd, def, fn) {
    var self = this, n = nd.args.length + 1, ps = [];
    for (var i = 0; i < n; i++) ps.push((this.T === 'php' ? '$a' : 'a') + i);
    var fb = 'null';
    if (def) {
      var tpl = this.availability(def, name, nd);
      if (n < minArgs(def) || n > maxArgs(def)) fb = 'null';
      else if (this.T === 'php') fb = 'function (' + ps.join(', ') + ') { return ' + this.fill(tpl, ps) + '; }';
      else fb = (def.async ? 'async ' : '') + 'function (' + ps.join(', ') + ') { return ' + this.fill(tpl, ps) + '; }';
      if (def.needs) this.C.need(def.needs);
    } else if (fn && fn.params.length === n) {
      if (fn.server || this.where === 'client') {
        if (fn.server && this.where === 'client') fb = 'function () { return wz.call(' + jsStr(fn.name) + ', Array.prototype.slice.call(arguments)); }';
        else fb = this.T === 'php' ? phpStr(this.F(fn.name)) : this.F(fn.name);
      }
    }
    var a = nd.args.map(function (x) { return self.val(self.E(x)); });
    var code = this.H('vcall', [o.c, this.S(name), '[' + a.join(', ') + ']', this.ctxCode(), fb]);
    if (this.T !== 'php') code = '(await ' + code + ')';
    return { c: code, t: 'any', place: true };
  };

  /** A command written like a function: message("Hi"), ask("Name?"). asValue: its answer is used. */
  G.cmdCall = function (def, args, nd, name, asValue) {
    var c = this.C.vocab.cmdFirst[def.id];
    var slots = callSlots(c, def, null, args, name + '()', nd, this.C.msgLang);
    var st = { type: 'Command', cmd: c, def: def, slots: slots, label: name, line: nd.line, col: nd.col, pos: nd.pos, end: nd.end };
    if (!asValue) { this.command(st); return null; }
    if (!c.parts.some(function (p) { return p.kind === 'target'; })) this.err('noValue', [name], nd);
    var code = this.commandCode(st).code;
    if (def.async && this.T !== 'php') code = '(await ' + code + ')';
    return { c: code, t: 'any' };
  };

  G.callUser = function (fn, args, nd, method) {
    if (args.length !== fn.params.length) {
      var off = method ? 1 : 0;
      this.err('argCount', [fn.name, msg(this.C.msgLang, 'nValues', [fn.params.length - off]), args.length - off], nd);
    }
    var self = this;
    var ptypes = fn.ptypes || [];
    var a = args.map(function (x, i) { return ptypes[i] ? self.valueAs(x, ptypes[i], nd) : self.val(self.E(x)); });
    var rty = fn.rty || undefined;
    var res = { t: coarse(rty), ty: rty, place: !rty || !!tyKind(rty) };
    if (fn.server) {
      this.C.usesServer = true;
      if (this.where === 'client') res.c = '(await wz.call(' + jsStr(fn.name) + ', [' + a.join(', ') + ']))';
      else if (this.T === 'php') res.c = this.F(fn.name) + '(' + a.join(', ') + ')';
      else res.c = '(await ' + this.F(fn.name) + '(' + a.join(', ') + '))';
      return res;
    }
    if (this.where !== 'client') this.err('clientFnInServer', [fn.name], nd);
    res.c = '(await ' + this.F(fn.name) + '(' + a.join(', ') + '))';
    return res;
  };

  function minArgs(def) {
    return (def.params || []).filter(function (p) { return !/[?]$/.test(p) && !/^\.\.\./.test(p); }).length;
  }
  function maxArgs(def) {
    var ps = def.params || [];
    if (ps.some(function (p) { return /^\.\.\./.test(p); })) return Infinity;
    return ps.length;
  }

  /** The template of a command/function for this target (null = not available here). */
  G.template = function (def) {
    if (this.T === 'php') return def.php;
    if (this.T === 'sim') {
      if (def.php === undefined || def.php === null || def.php === false) return null;
      return def.sim !== undefined ? def.sim : def.js;
    }
    return def.js;
  };

  G.fill = function (tpl, args, named) {
    var self = this;
    var missing = this.T === 'php' ? 'null' : 'undefined';
    return tpl.replace(/\{(\w+|\.\.\.)\}/g, function (m, k) {
      if (k === 'args' || k === '...') return args.join(', ');
      if (/^\d+$/.test(k)) { var i = +k; return i < args.length ? args[i] : missing; }
      if (named && Object.prototype.hasOwnProperty.call(named, k)) return named[k];
      return m;
    });
  };

  G.availability = function (def, name, nd) {
    var tpl = this.template(def);
    if (tpl === undefined || tpl === null || tpl === false) {
      if (this.where === 'client') this.err('serverOnly', [name], nd);
      this.err('clientOnly', [name], nd);
    }
    return tpl;
  };

  G.callBuiltin = function (def, args, nd, name, method) {
    var tpl = this.availability(def, name, nd);
    var mn = minArgs(def), mx = maxArgs(def);
    if (args.length < mn || args.length > mx) {
      // for x.round(2) count only the values in ( )
      var off = method ? 1 : 0;
      mn = Math.max(0, mn - off);
      if (mx !== Infinity) mx -= off;
      var need = mn === mx ? String(mn) : (mx === Infinity ? mn + '+' : mn + '-' + mx);
      this.err('argCount', [method ? name + '()' : name, msg(this.C.msgLang, 'nValues', [need]), args.length - off], nd);
    }
    var self = this;
    var a = args.map(function (x) { return self.e(x); });
    var code = this.fill(tpl, a);
    if (def.async && this.T !== 'php') code = '(await ' + code + ')';
    if (def.needs) this.C.need(def.needs);
    var rt = def.returns || 'any';
    // first(list), last(list)... can give an item of a list: it is copied when kept
    return { c: code, t: rt, place: rt === 'any' || rt === 'list' || rt === 'rec' };
  };

  G.bin = function (nd) {
    var op = nd.op;
    if (LOGIC_OPS[op]) return this.logicBin(op, this.E(nd.l), this.E(nd.r));
    if (op === 'band' || op === 'bor' || op === 'bxor' || op === 'bnand' || op === 'bnor' || op === 'bxnor') return this.bitBin(nd, op);
    var l = this.E(nd.l), r = this.E(nd.r);
    if (op === 'shl' || op === 'shr') return this.shift(nd, op, l, r);
    var typed = this.typedBin(nd, op, l, r);
    if (typed) return typed;
    var nums = l.t === 'num' && r.t === 'num';
    var php = this.T === 'php';
    switch (op) {
      case '+':
        if (nums) return { c: '(' + l.c + ' + ' + r.c + ')', t: 'num' };
        return { c: this.H('add', [l.c, r.c]), t: (l.t === 'text' || r.t === 'text') ? 'any' : 'any' };
      case '-':
        if (nums) return { c: '(' + l.c + ' - ' + r.c + ')', t: 'num' };
        return { c: this.H('sub', [l.c, r.c]), t: 'num' };
      case '*':
        if (nums) return { c: '(' + l.c + ' * ' + r.c + ')', t: 'num' };
        return { c: this.H('mul', [l.c, r.c]), t: 'num' };
      case '/':
        if (nums && r.lit && r.v !== 0) return { c: '(' + l.c + ' / ' + r.c + ')', t: 'num' };
        return { c: this.H('div', [l.c, r.c]), t: 'num' };
      case 'mod':
        return { c: this.H('mod', [l.c, r.c]), t: 'num' };
      case '^':
        if (nums) return { c: '(' + l.c + ' ** ' + r.c + ')', t: 'num' };
        return { c: this.H('pow', [l.c, r.c]), t: 'num' };
      case '&':
        return { c: this.H('cat', [l.c, r.c]), t: 'text' };
      case '=': case '!=':
        if (nums) return { c: '(' + l.c + (op === '=' ? (php ? ' == ' : ' === ') : (php ? ' != ' : ' !== ')) + r.c + ')', t: 'bool' };
        return { c: this.H(op === '=' ? 'eq' : 'ne', [l.c, r.c]), t: 'bool' };
      case '<': case '>': case '<=': case '>=':
        if (nums) return { c: '(' + l.c + ' ' + op + ' ' + r.c + ')', t: 'bool' };
        return { c: this.H({ '<': 'lt', '>': 'gt', '<=': 'le', '>=': 'ge' }[op], [l.c, r.c]), t: 'bool' };
      case 'contains': return { c: this.H('contains', [l.c, r.c]), t: 'bool' };
      case 'starts': return { c: this.H('starts', [l.c, r.c]), t: 'bool' };
      case 'ends': return { c: this.H('ends', [l.c, r.c]), t: 'bool' };
    }
    this.err('expectedValue', [], nd);
  };

  /** AND OR XOR NAND NOR XNOR (and && ||): true or false; AND / OR / NAND / NOR stop at the first side that decides */
  G.logicBin = function (op, a, b) {
    var ta = this.truthy(a), tb = this.truthy(b), c;
    switch (op) {
      case 'and': c = '(' + ta + ' && ' + tb + ')'; break;
      case 'or': c = '(' + ta + ' || ' + tb + ')'; break;
      case 'nand': c = '!(' + ta + ' && ' + tb + ')'; break;
      case 'nor': c = '!(' + ta + ' || ' + tb + ')'; break;
      case 'xor': c = '(' + ta + (this.T === 'php' ? ' != ' : ' !== ') + tb + ')'; break;
      default: c = '(' + ta + (this.T === 'php' ? ' == ' : ' === ') + tb + ')';
    }
    return { c: c, t: 'bool', ty: 'bool' };
  };
  /**
   * What a value is in a bit operation: a whole-number type (its bits), 'cond' (a condition: true / false,
   * text, lists... are not numbers, so and / or decide true or false), or null (not known until it runs).
   * A number with decimals has no bits: a mistake.
   */
  G.bitTy = function (x, nd, word) {
    if (x.t === 'bool' && !isIntTy(x.ty)) return 'cond';
    var ty = this.opTy(x);
    if (ty && (isIntTy(ty) || ty === 'char' || ty === 'bool')) return ty;
    if (ty && isFloatTy(ty)) this.err('bitsOnly', [word, this.showVal(x), word.toUpperCase()], nd);
    if ((x.ty && x.ty !== 'any') || (x.lit && (x.t === 'text' || x.t === 'null')) || x.t === 'list' || x.t === 'rec' || x.t === 'text') return 'cond';
    return null;
  };
  /**
   * and or xor nand nor xnor in small letters: bit by bit.
   *   int32 a = 6; a and 3        -> 2       (whole numbers: their bits)
   *   x > 1 and y < 2             -> true    (true / false is one bit, so it works as a condition too)
   *   var a = 6; var b = 3; a and b   -> decided when it runs: numbers bit by bit, anything else as a condition
   */
  G.bitBin = function (nd, op) {
    var word = { band: 'and', bor: 'or', bxor: 'xor', bnand: 'nand', bnor: 'nor', bxnor: 'xnor' }[op];
    var l = this.E(nd.l), r = this.E(nd.r);
    var lt = this.bitTy(l, nd.l, word), rt = this.bitTy(r, nd.r, word);
    // a condition (or a text, a list...) on either side: it works like the logical operator
    if (lt === 'cond' || rt === 'cond') return this.logicBin(LOGIC_OPS[word], l, r);
    if (lt && rt) {
      // whole numbers on both sides: the bits, in the type C gives the result (int32 at least)
      var R = promote(lt, rt), b = INT_BITS[R];
      var a = this.numCode(l), c = this.numCode(r), code;
      switch (op) {
        case 'band': code = this.H('band', [a, c, b[0], b[1]]); break;
        case 'bor': code = this.H('bor', [a, c, b[0], b[1]]); break;
        case 'bxor': code = this.H('bxor', [a, c, b[0], b[1]]); break;
        case 'bnand': code = this.H('bnot', [this.H('band', [a, c, b[0], b[1]]), b[0], b[1]]); break;
        case 'bnor': code = this.H('bnot', [this.H('bor', [a, c, b[0], b[1]]), b[0], b[1]]); break;
        default: code = this.H('bnot', [this.H('bxor', [a, c, b[0], b[1]]), b[0], b[1]]);
      }
      return { c: code, t: 'num', ty: R };
    }
    // a value whose type is not known: decided when it runs (the right side runs only when it is needed)
    return this.bitWordRuntime(word, l, r);
  };
  G.bitWordRuntime = function (word, l, r) {
    var rc = r.c;
    if (this.T === 'php') return { c: 'wz_bw(' + phpStr(word) + ', ' + l.c + ', fn() => ' + rc + ')', t: 'any' };
    if (/\bawait\b/.test(rc)) return { c: '(await wz.bw(' + jsStr(word) + ', ' + l.c + ', async function () { return ' + rc + '; }))', t: 'any' };
    return { c: 'wz.bw(' + jsStr(word) + ', ' + l.c + ', function () { return ' + rc + '; })', t: 'any' };
  };
  /** not in small letters: the bits of a whole number turned round (~5 is -6); on true / false, the opposite */
  G.bitNot = function (nd, x) {
    var ty = this.bitTy(x, nd.x, 'not');
    if (ty === 'cond') return { c: '!' + this.truthy(x), t: 'bool', ty: 'bool' };
    if (ty) {
      var R = promote(ty), b = INT_BITS[R];
      return { c: this.H('bnot', [this.numCode(x), b[0], b[1]]), t: 'num', ty: R };
    }
    return { c: this.H('bnot1', [x.c]), t: 'any' };
  };
  /** x shl 2 / x << 2 / x shr 1 / x >> 1 */
  G.shift = function (nd, op, l, r) {
    var word = op === 'shl' ? 'shl' : 'shr';
    var lt = this.bitTy(l, nd.l, word);
    if (lt === 'cond') this.err('shiftOnly', [word, this.showVal(l)], nd.l);
    var rt = this.bitTy(r, nd.r, word);
    if (rt === 'cond') this.err('shiftOnly', [word, this.showVal(r)], nd.r);
    var n = this.numCode(r);
    if (lt) {
      var R = promote(lt), b = INT_BITS[R];
      return { c: this.H(op, [this.numCode(l), n, b[0], b[1]]), t: 'num', ty: R };
    }
    return { c: this.H(op, [l.c, n, 32, 'true']), t: 'num' };
  };

  /**
   * The rules of C for values with a type:
   *   int32 a = 7; a / 2 is 3 (whole numbers stay whole), -7 % 3 is -1
   *   uint8 b = 250; b + 10 is 260 (an int32: small types become int32 first)
   *   int32 c = 2147483647; c + 1 is -2147483648 (it goes round)
   *   float32 f = 0.1; f * 3 is a float32
   *   string s; s + 5 joins them ("x5"); char c = 'a'; c + 1 is 98
   * Values without a type keep Wemazy's own rules. null = not a typed operation.
   */
  G.typedBin = function (nd, op, l, r) {
    // 'z' - 'a' is 25, like in C (but 'a' + 'b' stays "ab": + joins texts)
    var chars2 = (l.chlit || r.chlit) && op !== '+' && (l.chlit || (l.lit && l.t === 'num')) && (r.chlit || (r.lit && r.t === 'num'));
    if (!l.ty && !r.ty && !chars2) return null;
    var lt = this.opTy(l), rt = this.opTy(r);
    var textual = function (x) { return x.ty === 'string' || (!x.ty && x.t === 'text' && !x.chlit); };
    if (op === '+' && (textual(l) || textual(r))) {
      // "Total: " + n, s + 5: text is joined, like in C# and Java
      if ((l.ty && tyKind(l.ty) === 'C') || (r.ty && tyKind(r.ty) === 'C')) return null;
      return { c: this.H('cat', [this.textOf(l), this.textOf(r)]), t: 'text', ty: 'string' };
    }
    if (op === '=' || op === '!=' || op === '<' || op === '>' || op === '<=' || op === '>=') {
      // a char compared with a number: its code ('A' == 65)
      if ((l.ty === 'char' || r.ty === 'char') && lt && rt && (lt !== 'char' || rt !== 'char')) {
        var cl = this.numCode(l), cr = this.numCode(r);
        if (op === '=') op = this.T === 'php' ? '==' : '===';
        else if (op === '!=') op = this.T === 'php' ? '!=' : '!==';
        return { c: '(' + cl + ' ' + op + ' ' + cr + ')', t: 'bool' };
      }
      return null;
    }
    if (['+', '-', '*', '/', 'mod'].indexOf(op) < 0 || !lt || !rt) return null;
    if (isFloatTy(lt) || isFloatTy(rt)) {
      // float: the biggest float type of the two (a whole number becomes that float)
      var bits = Math.max(isFloatTy(lt) ? FLOAT_BITS[lt] : 0, isFloatTy(rt) ? FLOAT_BITS[rt] : 0);
      var fty = 'float' + bits, self = this;
      var fc = function (x, t) {
        var c = self.numCode(x);
        return (bits < 64 && !isFloatTy(t)) ? self.H('fa', [c, bits]) : c;
      };
      var a = fc(l, lt), b = fc(r, rt), code;
      if (op === '/') code = this.H('fdiv', [a, b, bits]);
      else if (op === 'mod') code = this.H('fa', [this.H('irem', [a, b]), bits]);
      else {
        code = '(' + a + ' ' + op + ' ' + b + ')';
        if (bits < 64) code = this.H('fa', [code, bits]);
      }
      return { c: code, t: 'num', ty: fty };
    }
    // whole numbers: C's "usual arithmetic conversions"
    var R = promote(lt, rt), ib = INT_BITS[R], self2 = this;
    var ic = function (x, t) {
      var c = self2.numCode(x);
      // for / and % the values become the type of the result first (it matters for unsigned numbers)
      if ((op === '/' || op === 'mod') && promote(t) !== R) {
        if (x.lit && !x.chlit) { var w = wrapConst(x.v, R); if (w !== null) return String(w); }
        return self2.H('ia', [c, ib[0], ib[1]]);
      }
      return c;
    };
    var x1 = ic(l, lt), x2 = ic(r, rt), icode;
    switch (op) {
      case '+': icode = this.H('ia', [x1 + ' + ' + x2, ib[0], ib[1]]); break;
      case '-': icode = this.H('ia', [x1 + ' - ' + x2, ib[0], ib[1]]); break;
      case '*': icode = this.H('imul', [x1, x2, ib[0], ib[1]]); break;
      case '/': icode = this.H('idiv', [x1, x2, ib[0], ib[1]]); break;
      default: icode = this.H('irem', [x1, x2]);
    }
    return { c: icode, t: 'num', ty: R };
  };

  /* ---- conversions between types ---- */

  /** How a value is named in a message: "hello", 5, or "a value of type Point". */
  G.showVal = function (x) {
    if (x.lit && x.t === 'text') return '"' + x.v + '"';
    if (x.lit && x.t === 'num') return String(x.v);
    if (x.ty) return msg(this.C.msgLang, 'valOfType', [showTy(x.ty)]);
    if (x.t === 'list') return msg(this.C.msgLang, 'aList', []);
    if (x.t === 'rec') return msg(this.C.msgLang, 'aRecord', []);
    return msg(this.C.msgLang, 'thisValue', []);
  };
  /** Can x go into a place of type ty without a cast? If it surely can't, it is a mistake (like in C#). */
  G.checkAssign = function (x, ty, nd) {
    if (!ty || ty === 'any' || !x) return;
    var xt = x.ty, k = tyKind(ty), xk = tyKind(xt), self = this;
    function bad() { self.err('cantConvert', [self.showVal(x), showTy(ty)], nd); }
    if (x.t === 'null' && x.lit) {
      if (isNumTy(ty) || ty === 'string') bad();
      return;
    }
    if (isNumTy(ty) && ty !== 'bool') {
      // "hello" can't be a number; "12" can (it is checked when the code runs)
      if (x.lit && x.t === 'text' && !x.chlit && (ty === 'char' || !/^\s*[-+]?(\d+\.?\d*|\.\d+)\s*$/.test(x.v))) {
        if (ty === 'char' && chars(x.v).length === 1) return;
        bad();
      }
      if (xk || x.t === 'list' || x.t === 'rec') bad();
      return;
    }
    if (ty === 'string' || ty === 'bool') return;
    if (k === 'S' || k === 'U') {
      if ((xk && xt !== ty) || (xt && !xk) || x.lit) bad();
      return;
    }
    if (k === 'C') {
      if (xk === 'C' && !this.C.isSubclass(tyName(xt), tyName(ty))) {
        if (this.C.isSubclass(tyName(ty), tyName(xt))) this.err('needCast', [showTy(xt), showTy(ty)], nd);
        bad();
      }
      if ((xk && xk !== 'C') || (xt && !xk) || x.lit || x.t === 'list' || x.t === 'rec') bad();
      return;
    }
    if (k === 'G') {
      if (xk === 'G' && !this.C.guiIsA(tyName(xt), tyName(ty))) bad();
      if ((xk && xk !== 'G') || (xt && !xk && xt !== 'string') || x.t === 'list' || x.t === 'rec' || (x.lit && x.t === 'num')) bad();
      return;
    }
    if (k === 'L') {
      if ((xk && xk !== 'L') || (xt && !xk) || x.lit || x.t === 'rec') bad();
    }
  };
  /**
   * Convert a value to a type: a cast like (int32)x, or a value going into a typed place.
   * Whole numbers go round like C (int8 200 is -56), floats lose digits (float32), a char
   * is a number when it has to be ('A' is 65), structs and lists are checked and copied.
   */
  G.castTo = function (x, ty, nd) {
    if (!ty || ty === 'any') return { c: x.c, t: x.t, place: x.place };
    if (ty === 'void') this.err('voidVar', [], nd);
    var self = this;
    function res(c) { return { c: c, t: coarse(ty), ty: ty }; }
    var ib = INT_BITS[ty];
    if (ib) {
      if (x.chlit) return res(String(wrapConst(chars(x.v)[0].codePointAt(0), ty)));
      if (x.lit && x.t === 'num' && !x.ty) {
        var w = wrapConst(x.v, ty);
        if (w === null) this.err('tooBig', [String(x.v), showTy(ty)], nd);
        return res(String(w));
      }
      if (x.ty === ty) return res(x.c);
      if (isIntTy(x.ty)) return res(this.H('ia', [x.c, ib[0], ib[1]]));
      if (x.ty === 'char' || x.ty === 'bool' || (x.lit && x.t === 'bool')) return res(this.H('ia', [this.H('code', [x.c]), ib[0], ib[1]]));
      if (isFloatTy(x.ty)) return res(this.H('to_int', [x.c, ib[0], ib[1]]));
      return res(this.H('conv', [x.c, this.S(ty)]));
    }
    var fb = FLOAT_BITS[ty];
    if (fb) {
      if (x.chlit) return res(String(chars(x.v)[0].codePointAt(0)));
      if (x.ty === ty) return res(x.c);
      if (x.ty === 'char' || x.ty === 'bool' || (x.lit && x.t === 'bool')) return res(this.H('to_float', [this.H('code', [x.c]), fb]));
      if (fb === 64 && (isIntTy(x.ty) || isFloatTy(x.ty))) return res(x.c);
      if (fb === 64 && x.lit && x.t === 'num') return res(x.c);
      return res(this.H('to_float', [x.c, fb]));
    }
    if (ty === 'string') return res(this.textOf(x));
    if (ty === 'bool') return res(this.truthy(x));
    if (ty === 'char') {
      if (x.ty === 'char' || x.chlit) return res(x.c);
      if (x.lit && x.t === 'text' && chars(x.v).length !== 1) this.err('notOneChar', [x.v], nd);
      return res(this.H('to_char', [x.c]));
    }
    var k = tyKind(ty);
    if (k === 'C' || k === 'G') {
      if (x.lit && x.t === 'null') return res('null');
      if (x.ty === ty) return res(x.c);
      // a Dog is always an Animal: nothing to check when the code runs
      if (k === 'C' && tyKind(x.ty) === 'C' && this.C.isSubclass(tyName(x.ty), tyName(ty))) return res(x.c);
      if (k === 'G' && tyKind(x.ty) === 'G' && this.C.guiIsA(tyName(x.ty), tyName(ty))) return res(x.c);
      return res(this.H('conv', [x.c, this.S(ty)]));
    }
    // struct, union, list: checked, and copied
    if (x.ty === ty) return res(this.val(x));
    if (k === 'S' && tyKind(x.ty) === 'S') this.err('cantConvert', [this.showVal(x), showTy(ty)], nd);
    void self;
    return res(this.H('conv', [x.c, this.S(ty)]));
  };
  /** A control by its name (Label1), as an object you can keep in a variable */
  G.ctlRef = function (nd, want) {
    if (this.where !== 'client') this.err('controlInServer', [nd.name], nd);
    var name = this.controlName(nd);
    var ctl = this.C.control(norm(nd.name));
    if (want && !this.C.guiIsA(ctl.type, want)) this.err('cantConvert', [ctl.name + ' (' + this.C.guiType(ctl.type) + ')', want], nd);
    return this.H('ref', [this.S(name)]);
  };
  G.isControlIdent = function (nd) {
    if (!nd || nd.type !== 'Ident' || this.where !== 'client') return false;
    var n = norm(nd.name);
    return !this.varInScope(n) && !this.fieldOf(n) && !!this.C.control(n);
  };
  /** The code of the value of nd going into a place of type ty (checked and converted). */
  G.valueAs = function (nd, ty, at) {
    if (!ty || ty === 'any') return this.val(this.E(nd));
    var k = tyKind(ty), self = this;
    // Label1 given for a Label: the control itself, not its text
    if (k === 'G' && this.isControlIdent(nd)) return this.ctlRef(nd, tyName(ty));
    // [1, 2, 3] for an int32[]: each item becomes an int32
    if (k === 'L' && nd.type === 'List') {
      var et = tyName(ty);
      return '[' + nd.items.map(function (x) { return self.valueAs(x, et, x); }).join(', ') + ']';
    }
    // {x: 1, y: 2} for a Point: the fields must be fields of Point
    if ((k === 'S' || k === 'U') && nd.type === 'Record') {
      var sname = tyName(ty), ti = this.C.ti(ty);
      if (k === 'U' && nd.entries.length > 1) this.err('unionOneField', [sname], nd.entries[1].tok);
      nd.entries.forEach(function (en) {
        if (!self.C.structField(sname, en.key)) {
          var s = suggest(en.key, ti.fields.map(function (f) { return f.name; }));
          self.err('noMember', [sname, en.key], en.tok, s ? msg(self.C.msgLang, 'didYouMean', [s]) : '');
        }
      });
    }
    if ((k === 'S' || k === 'U') && nd.type === 'List') {
      var ti2 = this.C.ti(ty);
      if (nd.items.length > (k === 'U' ? 1 : ti2.fields.length)) this.err(k === 'U' ? 'unionOneField' : 'tooManyValues', [ti2.name, ti2.fields.length], nd);
    }
    var x = this.E(nd);
    this.checkAssign(x, ty, at || nd);
    return this.castTo(x, ty, at || nd).c;
  };
  /** The value for "x is Button" / "x as Dog" (a control by its name is the control). */
  G.valueAsObj = function (nd, ty) {
    if (tyKind(ty) === 'G' && this.isControlIdent(nd)) return this.ctlRef(nd, null);
    return this.E(nd).c;
  };

  /* ---- new, sizeof ---- */

  /** new Dog("Rex"), new Point(1, 2), new Point { x = 1 }, new Button() */
  G.newValue = function (nd) {
    var ty = this.C.spec(nd.tref), k = tyKind(ty);
    if (nd.tref.dims) this.err('newArraySize', [nd.tref.name], nd);
    if (k === 'C') {
      var ti = this.C.ti(ty);
      if (ti.kind === 'interface' || ti.abstract) this.err('abstractNew', [ti.name], nd);
      var ct = ti.ctor;
      if (ct) this.checkAccess(ct, nd);
      var a = this.argsFor(ct ? ct.ptypes : [], nd.args, nd, ti.name + '()');
      var c = this.H('construct', [this.S(ti.name), '[' + a.join(', ') + ']']);
      if (this.T !== 'php') c = '(await ' + c + ')';
      if (nd.inits) c = this.initObj(c, nd.inits, ty);
      return { c: c, t: 'any', ty: ty };
    }
    if (k === 'S' || k === 'U') {
      if (nd.inits) return { c: this.valueAs(nd.inits, ty, nd), t: 'rec', ty: ty };
      if (nd.args.length) return { c: this.valueAs(node('List', nd, { items: nd.args }), ty, nd), t: 'rec', ty: ty };
      return { c: this.H('zero', [this.S(ty)]), t: 'rec', ty: ty };
    }
    if (k === 'G') {
      var gname = tyName(ty);
      if (this.where !== 'client') this.err('newControlServer', [gname], nd);
      if (gname === 'Control') this.err('abstractNew', [gname], nd);
      if (nd.args.length) this.err('argCount', [gname + '()', msg(this.C.msgLang, 'nValues', [0]), nd.args.length], nd);
      this.C.newControl(gname);
      var gc = this.H('create', [this.S(gname)]);
      if (nd.inits) gc = this.initObj(gc, nd.inits, ty);
      return { c: gc, t: 'any', ty: ty };
    }
    if (nd.args.length) return this.castTo(this.E(nd.args[0]), ty, nd);
    return { c: this.zeroCode(ty), t: coarse(ty), ty: ty };
  };
  /** new Dog() { name = "Rex" } / new Button { text = "OK" }: fields or properties set after it is made */
  G.initObj = function (code, rec, ty) {
    var self = this, k = tyKind(ty), entries = [];
    if (rec.type !== 'Record') this.err('expectedInits', [], rec);
    rec.entries.forEach(function (en) {
      if (k === 'C') {
        var ti = self.C.ti(ty);
        var f = self.C.findField(ti, en.key);
        if (!f || f.isStatic) self.err('noMember', [ti.name, en.key], en.tok);
        self.checkAccess(f, en.tok);
        entries.push([f.name, self.valueAs(en.value, f.ty, en.value)]);
      } else {
        var props = self.C.guiProps(tyName(ty));
        var key = self.C.vocab.propByWord[norm(en.key)];
        if (!key || !props[key]) self.err('unknownProp', [tyName(ty), en.key, Object.keys(props).map(function (p) { return self.say('prop.' + p); }).join(', ')], en.tok);
        entries.push([key, self.val(self.E(en.value))]);
      }
    });
    var rc = this.T === 'php'
      ? '[' + entries.map(function (e) { return phpStr(e[0]) + ' => ' + e[1]; }).join(', ') + ']'
      : '{' + entries.map(function (e) { return jsStr(e[0]) + ': ' + e[1]; }).join(', ') + '}';
    return this.H('init_obj', [code, rc, this.ctxCode()]);
  };
  /** sizeof(int32) is 4, sizeof(Point) the bytes of its fields (like C, with padding) */
  G.sizeOf = function (nd) {
    var ty = nd.tref ? this.C.spec(nd.tref) : this.E(nd.x).ty;
    var n = ty ? this.C.sizeOfTy(ty) : null;
    if (n === null) this.err('sizeofType', [ty ? showTy(ty) : (nd.x && nd.x.name) || '?'], nd);
    return { c: String(n), t: 'num', ty: 'int32', lit: true, v: n };
  };
  /** The value a variable of a type starts with */
  G.zeroCode = function (ty) {
    if (INT_BITS[ty] || FLOAT_BITS[ty]) return '0';
    if (ty === 'bool') return 'false';
    if (ty === 'string') return this.S('');
    var k = tyKind(ty);
    if (k === 'C' || k === 'G') return 'null';
    if (k === 'L') return '[]';
    return this.H('zero', [this.S(ty)]);
  };

  /* ---- database queries ---- */

  /**
   * Compile a query into its "shape": the SQL text with ? placeholders,
   * a JavaScript version for the browser test server, and the list of values
   * (params) that must be computed before the query runs.
   */
  G.queryShape = function (nd) {
    var C = this.C, self = this;
    var tb = nd.table.def;
    var cols = {};
    tb.columns.forEach(function (c) { cols[norm(c.name)] = c; });
    cols.id = cols.id || { name: 'id', type: 'integer' };
    var params = [];           // { node, like }
    var colList = function () { return ['id'].concat(tb.columns.map(function (c) { return c.name; })).join(', '); };

    function colOf(x) {
      if (x.type === 'Ident' && cols[norm(x.name)]) return cols[norm(x.name)];
      if (x.type === 'Member' && x.obj.type === 'Ident' && norm(x.obj.name) === norm(tb.name)) {
        var c = cols[norm(x.name)];
        if (!c) self.err('unknownColumn', [tb.name, x.name, colList()], x);
        return c;
      }
      return null;
    }
    function hasCol(x) {
      if (!x || typeof x !== 'object') return false;
      if (colOf(x)) return true;
      switch (x.type) {
        case 'Bin': return hasCol(x.l) || hasCol(x.r);
        case 'Un': return hasCol(x.x);
        case 'IsEmpty': return hasCol(x.x);
        case 'Call': return x.args.some(hasCol);
        case 'List': return x.items.some(hasCol);
        case 'Record': return x.entries.some(function (e) { return hasCol(e.value); });
        case 'Tpl': return x.parts.some(function (p) { return typeof p !== 'string' && hasCol(p); });
        case 'Index': return hasCol(x.obj) || hasCol(x.index);
        case 'Member': return hasCol(x.obj);
      }
      return false;
    }
    function param(x, like) {
      params.push({ node: x, like: like || '' });
      var i = params.length - 1;
      return { sql: '?', js: 'p[' + i + ']', param: true, index: i };
    }
    function w(x) {
      var c = colOf(x);
      if (c) return { sql: c.name, js: 'r[' + jsStr(c.name) + ']', col: c };
      if (!hasCol(x)) {
        if (x.type === 'Num') return { sql: String(x.v), js: String(x.v), lit: true };
        if (x.type === 'Bool') return { sql: x.v ? '1' : '0', js: x.v ? 'true' : 'false', lit: true, bool: true };
        if (x.type === 'Null') return { sql: 'NULL', js: 'null', lit: true, nul: true };
        return param(x);
      }
      switch (x.type) {
        case 'Bin': {
          var op = x.op;
          // and / AND, or / OR...: in a where they are conditions (SQL has no bits)
          var lop = { band: 'and', bor: 'or', bxor: 'xor', bnand: 'nand', bnor: 'nor', bxnor: 'xnor' }[op] || op;
          if (lop === 'and' || lop === 'or' || lop === 'nand' || lop === 'nor') {
            var a = cond(x.l), b = cond(x.r);
            var neg = lop === 'nand' || lop === 'nor', word = (lop === 'and' || lop === 'nand') ? 'AND' : 'OR';
            var sq = '(' + a.sql + ' ' + word + ' ' + b.sql + ')', jsq = '(' + a.js + (word === 'AND' ? ' && ' : ' || ') + b.js + ')';
            return { sql: neg ? 'NOT ' + sq : sq, js: neg ? '!' + jsq : jsq, bool: true };
          }
          if (lop === 'xor' || lop === 'xnor') {
            var xa = cond(x.l), xb = cond(x.r);
            var xs = '((' + xa.sql + ' AND NOT ' + xb.sql + ') OR (NOT ' + xa.sql + ' AND ' + xb.sql + '))';
            var xj = '(' + xa.js + ' !== ' + xb.js + ')';
            return { sql: lop === 'xnor' ? 'NOT ' + xs : xs, js: lop === 'xnor' ? '!' + xj : xj, bool: true };
          }
          if (op === 'contains' || op === 'starts' || op === 'ends') {
            var lc = colOf(x.l);
            if (!lc || hasCol(x.r)) self.err('whereLike', [], x);
            var pr = param(x.r, op);
            return { sql: lc.name + " LIKE ? ESCAPE '!'", js: 'wz.' + op + '(r[' + jsStr(lc.name) + '], ' + pr.js + ')', bool: true };
          }
          var l = w(x.l), r = w(x.r);
          if (isCompare(op)) {
            if (l.col && r.col && l.col === r.col && op === '=') C.warn('colSelf', [l.col.name], x);
            if (op === '=' && (r.nul || l.nul)) {
              var side = r.nul ? l : r;
              return { sql: side.sql + ' IS NULL', js: '(' + side.js + ' == null)', bool: true };
            }
            if (op === '!=' && (r.nul || l.nul)) {
              var side2 = r.nul ? l : r;
              return { sql: side2.sql + ' IS NOT NULL', js: '(' + side2.js + ' != null)', bool: true };
            }
            var sqlop = op === '!=' ? '<>' : op;
            var fnm = { '=': 'eq', '!=': 'ne', '<': 'lt', '>': 'gt', '<=': 'le', '>=': 'ge' }[op];
            return { sql: l.sql + ' ' + sqlop + ' ' + r.sql, js: 'wz.' + fnm + '(' + l.js + ', ' + r.js + ')', bool: true };
          }
          var ar = { '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', 'mod': 'mod' }[op];
          if (ar) {
            var sop = op === 'mod' ? '%' : op;
            return { sql: '(' + l.sql + ' ' + sop + ' ' + r.sql + ')', js: 'wz.' + ar + '(' + l.js + ', ' + r.js + ')' };
          }
          self.err('whereFunc', [], x);
          break;
        }
        case 'Un': {
          if (x.op === 'not' || x.op === 'bnot') {
            var cx = cond(x.x);
            return { sql: 'NOT (' + cx.sql + ')', js: '!(' + cx.js + ')', bool: true };
          }
          var nx = w(x.x);
          return { sql: '(-' + nx.sql + ')', js: 'wz.neg(' + nx.js + ')' };
        }
        case 'IsEmpty': {
          var ec = w(x.x);
          if (!ec.col) self.err('whereFunc', [], x);
          var s = '(' + ec.sql + " IS NULL OR " + ec.sql + " = '')";
          if (x.neg) s = 'NOT ' + s;
          return { sql: s, js: (x.neg ? '!' : '') + 'wz.is_empty(' + ec.js + ')', bool: true };
        }
      }
      self.err('whereFunc', [], x);
    }
    function cond(x) {
      var r = w(x);
      if (r.bool) return r;
      if (r.col) return { sql: r.sql + ' = 1', js: 'wz.truthy(' + r.js + ')', bool: true };
      return { sql: r.sql, js: 'wz.truthy(' + r.js + ')', bool: true };
    }

    var shape = { kind: nd.type, table: tb.name, params: params, mode: nd.mode || null };
    var whereSql = '', whereJs = 'null';
    function doWhere() {
      if (nd.where) {
        var wc = cond(nd.where);
        whereSql = ' WHERE ' + wc.sql;
        whereJs = '(r, p) => ' + wc.js;
      }
    }
    if (nd.type !== 'Update' && nd.type !== 'Insert') doWhere();
    if (nd.type === 'Find') {
      var orderSql = '', orderJs = 'null';
      if (nd.order === 'random') { orderSql = ' ORDER BY {RANDOM}'; orderJs = '"random"'; }
      else if (nd.order) {
        orderSql = ' ORDER BY ' + nd.order.map(function (o) {
          var c = cols[norm(o.col)];
          if (!c) self.err('unknownColumn', [tb.name, o.col, colList()], o.tok);
          o.colName = c.name;
          return c.name + (o.desc ? ' DESC' : ' ASC');
        }).join(', ');
        orderJs = '[' + nd.order.map(function (o) { return '[' + jsStr(o.colName) + ', ' + (o.desc ? 'true' : 'false') + ']'; }).join(', ') + ']';
      }
      shape.sql = 'SELECT * FROM ' + tb.name + whereSql + orderSql;
      shape.whereJs = whereJs;
      shape.orderJs = orderJs;
      if (nd.limit) { shape.limitIndex = params.length; params.push({ node: nd.limit, like: '', limit: true }); }
    } else if (nd.type === 'Count') {
      shape.sql = 'SELECT COUNT(*) FROM ' + tb.name + whereSql;
      shape.whereJs = whereJs;
    } else if (nd.type === 'Delete') {
      shape.sql = 'DELETE FROM ' + tb.name + whereSql;
      shape.whereJs = whereJs;
    } else if (nd.type === 'Update') {
      // the SET values come first in the SQL text, so their params come first too
      var setSql = [], setJs = [];
      nd.sets.forEach(function (st) {
        var c = cols[norm(st.col)];
        if (!c || c.name === 'id') self.err('unknownColumn', [tb.name, st.col, colList()], st.tok);
        var v = w(st.value);
        if (v.param) params[v.index].col = c.name;
        setSql.push(c.name + ' = ' + v.sql);
        setJs.push(jsStr(c.name) + ': ' + v.js);
      });
      doWhere();
      shape.sql = 'UPDATE ' + tb.name + ' SET ' + setSql.join(', ') + whereSql;
      shape.whereJs = whereJs;
      shape.setJs = '(r, p) => ({' + setJs.join(', ') + '})';
    } else if (nd.type === 'Insert') {
      var rec = nd.record;
      if (rec.type === 'Record') {
        var names = [], qs = [], js = [];
        rec.entries.forEach(function (en) {
          var c = cols[norm(en.key)];
          if (!c || c.name === 'id') self.err('unknownColumn', [tb.name, en.key, colList()], en.tok);
          var pr = param(en.value);
          params[pr.index].col = c.name;
          names.push(c.name);
          qs.push('?');
          js.push(jsStr(c.name) + ': ' + pr.js);
        });
        shape.sql = 'INSERT INTO ' + tb.name + ' (' + names.join(', ') + ') VALUES (' + qs.join(', ') + ')';
        shape.recordJs = '(p) => ({' + js.join(', ') + '})';
        shape.cols = names;
        shape.literal = true;
      } else {
        param(rec);
        shape.sql = null;
        shape.recordJs = '(p) => p[0]';
        shape.literal = false;
      }
    }
    return shape;
  };

  /** Server-side code that runs a query shape, given the code of its params. */
  function queryRun(T, shape, pcodes) {
    var phpParams = function () {
      var list = [];
      shape.params.forEach(function (p, i) {
        if (p.limit) return;
        list.push(p.like ? 'wz_like(' + pcodes[i] + ', ' + phpStr(p.like) + ')' : pcodes[i]);
      });
      return '[' + list.join(', ') + ']';
    };
    var limit = shape.limitIndex !== undefined ? pcodes[shape.limitIndex] : 'null';
    var phpCols = function () {
      var cols = shape.params.filter(function (p) { return !p.limit; }).map(function (p) { return p.col ? phpStr(p.col) : 'null'; });
      return cols.some(function (c) { return c !== 'null'; }) ? ', [' + cols.join(', ') + ']' : '';
    };
    if (T === 'php') {
      switch (shape.kind) {
        case 'Find': return 'wz_select(' + phpStr(shape.table) + ', ' + phpStr(shape.sql) + ', ' + phpParams() + ', ' + phpStr(shape.mode) + ', ' + limit + ')';
        case 'Count': return 'wz_count(' + phpStr(shape.table) + ', ' + phpStr(shape.sql) + ', ' + phpParams() + ')';
        case 'Delete': case 'Update': return 'wz_exec(' + phpStr(shape.table) + ', ' + phpStr(shape.sql) + ', ' + phpParams() + phpCols() + ')';
        case 'Insert':
          if (shape.literal) return 'wz_insert_sql(' + phpStr(shape.table) + ', ' + phpStr(shape.sql) + ', ' + phpParams() + phpCols() + ')';
          return 'wz_insert(' + phpStr(shape.table) + ', ' + pcodes[0] + ')';
      }
    }
    var p = '[' + pcodes.join(', ') + ']';
    switch (shape.kind) {
      case 'Find': return 'wz.db.select(' + jsStr(shape.table) + ', ' + p + ', ' + shape.whereJs + ', ' + shape.orderJs + ', ' + limit + ', ' + jsStr(shape.mode) + ')';
      case 'Count': return 'wz.db.count(' + jsStr(shape.table) + ', ' + p + ', ' + shape.whereJs + ')';
      case 'Delete': return 'wz.db.remove(' + jsStr(shape.table) + ', ' + p + ', ' + shape.whereJs + ')';
      case 'Update': return 'wz.db.update(' + jsStr(shape.table) + ', ' + p + ', ' + shape.whereJs + ', ' + shape.setJs + ')';
      case 'Insert':
        if (shape.literal) {
          return 'wz.db.insert(' + jsStr(shape.table) + ', {' + shape.cols.map(function (c, i) { return jsStr(c) + ': ' + pcodes[i]; }).join(', ') + '})';
        }
        return 'wz.db.insert(' + jsStr(shape.table) + ', ' + pcodes[0] + ')';
    }
  }

  G.query = function (nd) {
    var shape = this.queryShape(nd);
    var self = this;
    this.C.usesDb = true;
    if (this.where === 'client') {
      // the page asks the server to run this query: compile it once for the server
      var pcodes = shape.params.map(function (p) { return self.e(p.node); });
      var id = this.C.addQuery(shape, this.file, nd.line);
      return { c: '(await wz.query(' + jsStr(id) + ', [' + pcodes.join(', ') + ']))', t: nd.type === 'Count' ? 'num' : 'any' };
    }
    var codes = shape.params.map(function (p) { return self.e(p.node); });
    var run = queryRun(this.T, shape, codes);
    if (this.T === 'php') return { c: run, t: nd.type === 'Count' ? 'num' : 'any' };
    return { c: '(await ' + run + ')', t: nd.type === 'Count' ? 'num' : 'any' };
  };

  /* ---- statements ---- */

  G.block = function (body) {
    var self = this;
    (body || []).forEach(function (st) { self.stmt(st); });
  };

  G.stmt = function (st) {
    try {
      this.stmt1(st);
    } catch (e) {
      if (!(e instanceof WzError)) throw e;
      this.C.error(e, this.file);
    }
  };

  G.read = function (t) { return this.e(t); };

  /** The type of a place (x, p.x, list[i], this.name) without writing any code. */
  G.tyOf = function (nd) {
    var n, f;
    switch (nd.type) {
      case 'Ident':
        n = norm(nd.name);
        if (this.varInScope(n)) { var vi = this.varInfo(n); return vi ? vi.ty : undefined; }
        f = this.fieldOf(n);
        return f ? f.ty : undefined;
      case 'This': return this.cls ? 'C:' + this.cls.name : undefined;
      case 'Base': return this.cls && this.cls.base ? 'C:' + this.cls.base.name : undefined;
      case 'Member': {
        var o = nd.obj;
        if (o.type === 'Ident') {
          var ti = this.staticOwner(norm(o.name));
          if (ti) { f = this.C.findField(ti, nd.name); return f ? f.ty : undefined; }
          if (!this.varInScope(norm(o.name)) && !this.fieldOf(norm(o.name))) return undefined;
        }
        var ot = this.tyOf(o), k = tyKind(ot);
        if (k === 'C') { f = this.C.findField(this.C.ti(ot), nd.name); return f ? f.ty : undefined; }
        if (k === 'S' || k === 'U') { f = this.C.structField(tyName(ot), nd.name); return f ? f.ty : undefined; }
        if ((ot === 'string' || k === 'L') && LENGTH_WORDS[norm(nd.name)]) return 'int32';
        return undefined;
      }
      case 'Index': {
        var it = this.tyOf(nd.obj);
        return tyKind(it) === 'L' ? tyName(it) : (it === 'string' ? 'char' : undefined);
      }
    }
    return undefined;
  };
  /** The field a place is, if it is one (for const and readonly) */
  G.fieldAt = function (t) {
    if (t.type === 'Ident') return this.varInScope(norm(t.name)) ? null : this.fieldOf(norm(t.name));
    if (t.type !== 'Member') return null;
    var o = t.obj;
    if (o.type === 'This' || o.type === 'Base') return this.cls ? this.C.findField(this.cls, t.name) : null;
    if (o.type === 'Ident') {
      var ti = this.staticOwner(norm(o.name));
      if (ti) return this.C.findField(ti, t.name);
      if (!this.varInScope(norm(o.name)) && !this.fieldOf(norm(o.name))) return null;
    }
    var ot = this.tyOf(o);
    return tyKind(ot) === 'C' ? this.C.findField(this.C.ti(ot), t.name) : null;
  };
  G.targetName = function (t) {
    if (t.type === 'Ident') return t.name;
    if (t.type === 'Member') return (t.obj.type === 'Ident' ? t.obj.name + '.' : (t.obj.type === 'This' ? 'this.' : '')) + t.name;
    return '?';
  };
  /** Put a value into a place, converted to the type of the place (like C). */
  G.store = function (t, vnode, nd) {
    var ty, f = this.fieldAt(t);
    if (t.type === 'Ident' && this.varInScope(norm(t.name))) {
      var vi = this.varInfo(norm(t.name));
      if (vi && vi.konst) this.err('constChange', [t.name], t);
      if (vi && vi.inferred) {
        // the variable follows its new value (it was made with var)
        var nx = this.E(vnode), nk = tyKind(nx.ty);
        this.inferType(norm(t.name), (nk === 'C' || nk === 'S' || nk === 'U' || nk === 'G') ? nx.ty : undefined);
        this.assign(t, this.val(nx), nd);
        return;
      }
      ty = vi ? vi.ty : undefined;
    } else if (f) {
      if (f.konst) this.err('constChange', [this.targetName(t)], t);
      if (f.readonly && !(this.inCtor && this.cls === f.owner)) this.err('readonlyField', [f.name, f.owner.name], t);
      ty = f.ty;
    } else {
      ty = this.tyOf(t);
    }
    this.assign(t, this.valueAs(vnode, ty, nd), nd);
  };

  /** Emit "target = value" for any kind of target (the value is already converted). */
  G.assign = function (t, valueCode, nd) {
    var self = this;
    if (t.type === 'This') this.err('notAssignable', [], t);
    if (t.type === 'Ident') {
      var n = norm(t.name);
      var v = this.varInScope(n);
      if (v) { this.line(v + ' = ' + valueCode + ';'); return; }
      var fi = this.fieldOf(n);
      if (fi) { this.setField(fi, valueCode, t); return; }
      if (this.where === 'client') {
        var ctl = this.C.control(n);
        if (ctl) {
          this.line(this.H('set', [this.S(ctl.name), this.S(this.C.defaultProp(ctl)), valueCode]) + ';');
          return;
        }
        if (this.C.isSite && this.C.anyControl(n)) this.err('controlInSite', [t.name], t);
      } else if (this.C.anyControl(n)) {
        this.err('controlInServer', [t.name], t);
      }
      if (this.C.functions[n] || this.C.vocab.functions[n]) this.err('nameIsFunction', [t.name], t);
      if (this.C.tableByNorm(n)) this.err('nameIsTable', [t.name], t);
      this.err('notAssignable', [], t);
    }
    if (t.type === 'Member') {
      var o = t.obj;
      if (o.type === 'This' || o.type === 'Base') {
        this.thisRef(o);
        var tf = this.C.findField(o.type === 'Base' ? (this.cls.base || this.cls) : this.cls, t.name);
        if (!tf) this.err('noMember', [this.cls.name, t.name], t);
        this.checkAccess(tf, t);
        this.setField(tf, valueCode, t);
        return;
      }
      var ssti = o.type === 'Ident' ? this.staticOwner(norm(o.name)) : null;
      if (ssti) {
        // Dog.count = 0
        var sf = this.C.findField(ssti, t.name);
        if (!sf) this.err('noMember', [ssti.name, t.name], t);
        if (!sf.isStatic) this.err('needObjectField', [sf.name], t);
        this.checkAccess(sf, t);
        this.setField(sf, valueCode, t);
        return;
      }
      if (o.type === 'Ident' && !this.varInScope(norm(o.name)) && !this.fieldOf(norm(o.name))) {
        var on = norm(o.name);
        var sti = null;
        if (sti) {
          var sf = this.C.findField(sti, t.name);
          if (!sf) this.err('noMember', [sti.name, t.name], t);
          if (!sf.isStatic) this.err('needObjectField', [sf.name], t);
          this.checkAccess(sf, t);
          this.setField(sf, valueCode, t);
          return;
        }
        if (this.where === 'client' && this.C.control(on)) {
          var ctl2 = this.C.control(on);
          var key = this.checkProp(ctl2, t);
          var pd = this.C.controlProps(ctl2)[key];
          if (pd && pd.readOnly) this.err('readOnlyProp', [t.name], t);
          this.line(this.H('set', [this.S(ctl2.name), this.S(key), valueCode]) + ';');
          return;
        }
        if (this.where !== 'client' && this.C.anyControl(on)) this.err('controlInServer', [o.name], o);
        if (this.where === 'client' && this.C.isSite && this.C.anyControl(on)) this.err('controlInSite', [o.name], o);
        if (this.C.isObj(on, 'page')) {
          if (this.where !== 'client') this.err('clientOnly', [o.name], o);
          var pk = this.checkPageProp(t);
          if (pk === 'name') this.err('readOnlyProp', [t.name], t);
          this.line(this.H('set', [this.S('$page'), this.S(pk), valueCode]) + ';');
          return;
        }
        if (this.C.isObj(on, 'session')) {
          if (this.where !== 'server') this.err('sessionClient', [], o);
          this.C.usesSession = true;
          this.line(this.H('sset', [this.S(t.name), valueCode]) + ';');
          return;
        }
      }
      var ot = this.tyOf(o), ok = tyKind(ot);
      if (ok === 'C') {
        var oti = this.C.ti(ot);
        var cf = this.C.findField(oti, t.name);
        if (!cf) this.err('noMember', [oti.name, t.name], t);
        this.checkAccess(cf, t);
        if (cf.isStatic) this.setField(cf, valueCode, t);
        else this.line(this.H('oset', [this.e(o), this.S(cf.name), valueCode, this.ctxCode()]) + ';');
        return;
      }
      if (ok === 'G') {
        var gk = this.propKey(t), gprops = this.C.guiProps(tyName(ot));
        if (norm(t.name) === 'name') this.err('readOnlyProp', [t.name], t);
        if (!gk || !gprops[gk]) this.err('unknownProp', [tyName(ot), t.name, Object.keys(gprops).map(function (k) { return self.say('prop.' + k); }).join(', ')], t);
        if (gprops[gk].readOnly) this.err('readOnlyProp', [t.name], t);
        this.line(this.H('set_dot', [this.e(o), this.S(gk), valueCode]) + ';');
        return;
      }
      if (ok === 'S' || ok === 'U') {
        var sfl = this.C.structField(tyName(ot), t.name);
        if (!sfl) this.err('noMember', [tyName(ot), t.name], t);
        this.line(this.H('set_dot', [this.lval(o), this.S(sfl.name), valueCode]) + ';');
        return;
      }
      var sargs = [this.lval(o), this.S(t.name), valueCode];
      if (this.cls) sargs.push(this.ctxCode());
      this.line(this.H('set_dot', sargs) + ';');
      return;
    }
    if (t.type === 'Index') {
      this.line(this.H('set_idx', [this.lval(t.obj), this.e(t.index), valueCode]) + ';');
      return;
    }
    this.err('notAssignable', [], t || nd);
  };

  /** A field of this class (or a static field) gets a new value */
  G.setField = function (f, code, nd) {
    if (f.isStatic) { this.line(this.H('sfset', [this.S(f.owner.name), this.S(f.name), code, this.ctxCode()]) + ';'); return; }
    if (this.isStatic || !this.cls) this.err('needObjectField', [f.name], nd);
    this.line(this.H('oset', ['$self', this.S(f.name), code, this.ctxCode()]) + ';');
  };

  /**
   * An expression that can be changed in place (PHP needs real variables, or references:
   * wz_lref / wz_iref / wz_oref give a reference to a field, an item, a field of an object).
   */
  G.lval = function (t) {
    if (this.T !== 'php') return this.e(t);
    var ctx = this.ctxCode();
    if (t.type === 'Ident') {
      var n = norm(t.name);
      var v = this.varInScope(n);
      if (v) return v;
      var fi = this.fieldOf(n);
      if (fi) return fi.isStatic ? 'wz_sfref(' + phpStr(fi.owner.name) + ', ' + phpStr(fi.name) + ', ' + ctx + ')' : 'wz_oref($self, ' + phpStr(fi.name) + ', ' + ctx + ')';
      return this.e(t);
    }
    if (t.type === 'This') return '$self';
    if (t.type === 'Member') {
      var o = t.obj;
      if (o.type === 'This' || o.type === 'Base') {
        this.thisRef(o);
        var f = this.C.findField(this.cls, t.name);
        if (!f) this.err('noMember', [this.cls.name, t.name], t);
        this.checkAccess(f, t);
        return f.isStatic ? 'wz_sfref(' + phpStr(f.owner.name) + ', ' + phpStr(f.name) + ', ' + ctx + ')' : 'wz_oref($self, ' + phpStr(f.name) + ', ' + ctx + ')';
      }
      if (o.type === 'Ident') {
        var ti = this.staticOwner(norm(o.name));
        if (ti) {
          var sf = this.C.findField(ti, t.name);
          if (!sf || !sf.isStatic) this.err('noMember', [ti.name, t.name], t);
          this.checkAccess(sf, t);
          return 'wz_sfref(' + phpStr(sf.owner.name) + ', ' + phpStr(sf.name) + ', ' + ctx + ')';
        }
      }
      var ot = this.tyOf(o);
      if (tyKind(ot) === 'C') {
        var cf = this.C.findField(this.C.ti(ot), t.name);
        if (!cf) this.err('noMember', [tyName(ot), t.name], t);
        this.checkAccess(cf, t);
        return 'wz_oref(' + this.e(o) + ', ' + phpStr(cf.name) + ', ' + ctx + ')';
      }
      return 'wz_lref(' + this.lval(o) + ', ' + phpStr(t.name) + ', ' + ctx + ')';
    }
    if (t.type === 'Index') return 'wz_iref(' + this.lval(t.obj) + ', ' + this.e(t.index) + ')';
    return this.e(t);
  };

  G.isControlTarget = function (t) {
    if (t.type !== 'Ident') return null;
    var n = norm(t.name);
    if (this.varInScope(n)) return null;
    if (this.where === 'client') return this.C.control(n);
    return null;
  };

  G.stmt1 = function (st) {
    var self = this;
    switch (st.type) {
      case 'Set': {
        this.mark(st);
        this.setStmt(st);
        return;
      }
      case 'Block': {
        this.block(st.body);
        return;
      }
      case 'DoWhile': {
        this.mark(st);
        this.line('do {');
        this.indent();
        this.tick();
        this.brk.push('loop');
        this.block(st.body);
        this.brk.pop();
        this.dedent();
        var dc = this.truthy(this.E(st.cond));
        if (st.until) dc = '!(' + dc + ')';
        this.line('} while (' + dc + ');');
        return;
      }
      case 'CFor': {
        // for (init; cond; step): the step goes in the for, so "skip" (continue) still runs it
        this.mark(st);
        if (st.init) this.stmt1(st.init);
        var fc = st.cond ? this.truthy(this.E(st.cond)) : '';
        var fs = st.step ? this.capture(function () { self.simple(st.step); }).map(function (l) { return l.trim().replace(/;$/, ''); }).join(', ') : '';
        this.line('for (; ' + fc + '; ' + fs + ') {');
        this.loopBody(st.body);
        return;
      }
      case 'Inc': {
        this.mark(st);
        this.incStmt(st);
        return;
      }
      case 'If': {
        this.mark(st);
        st.branches.forEach(function (b, i) {
          var c = self.truthy(self.E(b.cond));
          if (i === 0) self.line('if (' + c + ') {');
          else self.line('} ' + (self.T === 'php' ? 'elseif' : 'else if') + ' (' + c + ') {');
          self.indent();
          self.block(b.body);
          self.dedent();
        });
        if (st.els) {
          this.line('} else {');
          this.indent();
          this.block(st.els);
          this.dedent();
        }
        this.line('}');
        return;
      }
      case 'Repeat': {
        this.mark(st);
        var n = this.tmpName('n');
        var cnt = this.H('times', [this.e(st.count)]);
        if (this.T === 'php') this.line('for (' + n + ' = ' + cnt + '; ' + n + ' > 0; ' + n + '--) {');
        else this.line('for (let ' + n + ' = ' + cnt + '; ' + n + ' > 0; ' + n + '--) {');
        this.loopBody(st.body);
        return;
      }
      case 'While': {
        this.mark(st);
        var cond = st.cond ? this.truthy(this.E(st.cond)) : 'true';
        if (st.until) cond = '!(' + cond + ')';
        this.line('while (' + cond + ') {');
        this.loopBody(st.body);
        return;
      }
      case 'ForEach': {
        this.mark(st);
        var iv = this.varInScope(norm(st.name)) || this.V(st.name);
        var itx = this.E(st.iter);
        if (this.T === 'php') this.line('foreach (wz_each(' + itx.c + ') as ' + iv + ') {');
        else this.line('for (' + iv + ' of wz.each(' + itx.c + ')) {');
        // foreach (int32 x in list): each item becomes an int32
        var lty = (this.varInfo(norm(st.name)) || {}).ty;
        if (lty && !(tyKind(itx.ty) === 'L' && tyName(itx.ty) === lty)) {
          this.indent();
          this.line(iv + ' = ' + this.castTo({ c: iv, t: 'any' }, lty, st).c + ';');
          this.dedent();
        }
        this.loopBody(st.body);
        return;
      }
      case 'ForRange': {
        this.mark(st);
        var rv = this.varInScope(norm(st.name)) || this.V(st.name);
        var range = this.H('range', [this.e(st.from), this.e(st.to), st.step ? this.e(st.step) : 'null']);
        if (this.T === 'php') this.line('foreach (' + range + ' as ' + rv + ') {');
        else this.line('for (' + rv + ' of ' + range + ') {');
        this.loopBody(st.body);
        return;
      }
      case 'Break': case 'Continue': {
        var word = st.tok && st.tok.v ? st.tok.v : this.say(st.type === 'Break' ? 'stop' : 'skip');
        if (st.type === 'Break') {
          // break leaves the loop or the switch it is in
          if (!this.brk.length) this.err('loopOnly', [word], st);
          this.line('break;');
          return;
        }
        // continue goes to the next turn of the loop, even from inside a switch
        var sw = 0, k = this.brk.length - 1;
        while (k >= 0 && this.brk[k] === 'switch') { sw++; k--; }
        if (k < 0) this.err('loopOnly', [word], st);
        this.line(this.T === 'php' && sw ? 'continue ' + (sw + 1) + ';' : 'continue;');
        return;
      }
      case 'Switch': {
        // switch (x) { case 1: ... } becomes switch (true) { case eq(x, 1): ... break; }: Wemazy's == decides
        this.mark(st);
        var sv = this.tmpName('sw');
        var subj = this.e(st.subject);
        if (this.T === 'php') this.line(sv + ' = ' + subj + ';');
        else { this.line('{'); this.indent(); this.line('const ' + sv + ' = ' + subj + ';'); }
        this.line('switch (true) {');
        this.indent();
        this.brk.push('switch');
        // every case ends by itself (unless it already ends with break, continue or return)
        var ends = function (body) { var l = body[body.length - 1]; return !!l && /^(Break|Continue|Return)$/.test(l.type); };
        st.cases.forEach(function (c) {
          self.line(c.values.map(function (v) { return 'case ' + self.H('eq', [sv, self.e(v)]) + ':'; }).join(' '));
          self.indent();
          self.block(c.body);
          if (!ends(c.body)) self.line('break;');
          self.dedent();
        });
        if (st.def) {
          this.line('default:');
          this.indent();
          this.block(st.def.body);
          if (!ends(st.def.body)) this.line('break;');
          this.dedent();
        }
        this.brk.pop();
        this.dedent();
        this.line('}');
        if (this.T !== 'php') { this.dedent(); this.line('}'); }
        return;
      }
      case 'Return': {
        this.mark(st);
        var rt = this.fnRty;
        if (st.value && (rt === 'void' || this.inCtor)) this.err('voidReturn', [], st.value);
        if (!st.value && rt && rt !== 'void') this.err('needReturnValue', [showTy(rt)], st);
        var rc = st.value ? (rt && rt !== 'void' ? this.valueAs(st.value, rt, st.value) : this.val(this.E(st.value))) : null;
        this.line(rc !== null ? 'return ' + rc + ';' : (this.T === 'php' ? 'return null;' : 'return;'));
        return;
      }
      case 'Wait': {
        this.mark(st);
        var ms = st.unit === 1 ? this.e(st.amount) : this.H('mul', [this.e(st.amount), String(st.unit)]);
        if (this.T === 'php') this.line('wz_wait(' + ms + ');');
        else this.line('await wz.wait(' + ms + ');');
        return;
      }
      case 'Print': {
        this.mark(st);
        this.line(this.H('print', [this.e(st.value)]) + ';');
        return;
      }
      case 'Add': case 'Remove': {
        this.mark(st);
        var att = this.tyOf(st.target), atk = tyKind(att);
        // an object with its own add / remove method
        if (atk === 'C') { this.methodStmt(st.target, st.type === 'Add' ? (st.word || 'add') : (st.word || 'remove'), [st.item], st); return; }
        var ctl = this.isControlTarget(st.target);
        var onPage = st.target.type === 'Ident' && !this.varInScope(norm(st.target.name)) && this.C.isObj(norm(st.target.name), 'page');
        if (ctl || atk === 'G' || onPage) {
          if (onPage && this.where !== 'client') this.err('clientOnly', [st.target.name], st.target);
          // add an item to a list on the page, or a new control into a panel
          var item = this.isControlIdent(st.item) ? this.ctlRef(st.item, null) : this.val(this.E(st.item));
          var cn = onPage ? this.S('$page') : (ctl ? this.S(ctl.name) : this.H('cname', [this.e(st.target)]));
          this.line(this.H(st.type === 'Add' ? 'add_item' : 'remove_item', [cn, item]) + ';');
          return;
        }
        var item2 = atk === 'L' ? this.valueAs(st.item, tyName(att), st.item) : this.val(this.E(st.item));
        this.assign(st.target, this.H(st.type === 'Add' ? 'push' : 'pull', [this.read(st.target), item2]), st);
        return;
      }
      case 'Clear': {
        this.mark(st);
        var t = st.target;
        var ctt = this.tyOf(t);
        if (tyKind(ctt) === 'C') { this.methodStmt(t, st.word || 'clear', [], st); return; }
        if (tyKind(ctt) === 'G') { this.line(this.H('clear_control', [this.H('cname', [this.e(t)])]) + ';'); return; }
        if (t.type === 'Ident' && !this.varInScope(norm(t.name)) && this.C.isObj(norm(t.name), 'session')) {
          if (this.where !== 'server') this.err('sessionClient', [], t);
          this.C.usesSession = true;
          this.line(this.H('sclear', []) + ';');
          return;
        }
        var ctl3 = this.isControlTarget(t);
        if (ctl3) { this.line(this.H('clear_control', [this.S(ctl3.name)]) + ';'); return; }
        this.assign(t, this.H('cleared', [this.read(t)]), st);
        return;
      }
      case 'Insert': case 'Update': case 'Delete': {
        this.mark(st);
        this.line(this.query(st).c.replace(/^\(await (.*)\)$/, 'await $1') + ';');
        return;
      }
      case 'Command': {
        this.mark(st);
        this.command(st);
        return;
      }
      case 'ExprStmt': {
        this.mark(st);
        var ex = st.expr;
        if (ex.type === 'Call' && ex.callee.type === 'Ident') {
          // message("Hi"): a command written like a function
          var cn2 = norm(ex.callee.name);
          var cdef = this.C.vocab.cmdCalls[cn2];
          if (cdef && !this.varInScope(cn2) && !this.C.functions[cn2] && !this.C.vocab.functions[cn2] && !(this.cls && this.C.findMethod(this.cls, cn2))) {
            this.cmdCall(cdef, ex.args, ex, ex.callee.name, false);
            return;
          }
        }
        // b.hide(): a command on a control kept in a variable
        if (ex.type === 'Call' && ex.callee.type === 'Member' && this.refCommand(ex)) return;
        if (ex.type === 'Call' || ex.type === 'New' || (ex.type === 'Ident' && this.callableIdent(ex))) {
          var code = this.E(ex, true).c;
          code = code.replace(/^\(await (.*)\)$/, 'await $1');
          this.line(code + ';');
          return;
        }
        this.err('noEffect', [], st);
        return;
      }
      case 'Try': {
        this.mark(st);
        var ev = this.tmpName('e');
        this.line('try {');
        this.indent();
        this.block(st.body);
        this.dedent();
        var errVar = this.tmpName('err');
        if (this.T === 'php') {
          this.line('} catch (\\Throwable ' + ev + ') {');
          this.indent();
          this.line(errVar + ' = wz_errmsg(' + ev + ');');
        } else {
          this.line('} catch (' + ev + ') {');
          this.indent();
          this.line('let ' + errVar + ' = wz.errmsg(' + ev + ');');
        }
        var saved = this.special;
        this.special = Object.assign({}, saved);
        (this.C.vocab.phrases['var.error'] || [['error']]).forEach(function (ph) {
          if (ph.length === 1) self.special[ph[0]] = errVar;
        });
        // catch (e): e is the message of the error too
        if (st.errName) this.special[norm(st.errName)] = errVar;
        this.block(st.handler);
        this.special = saved;
        this.dedent();
        this.line('}');
        return;
      }
      case 'Func': case 'When': case 'Every': case 'TypeDecl':
        // handled at the top level
        return;
    }
    this.err('noEffect', [], st);
  };

  /** x = value (and var int32 x = value) */
  G.setStmt = function (st) {
    if (st.decl) { this.declare(st); return; }
    if (st.changes) {
      // name.trim() on its own line changes name - but an object's own method just runs
      var co = st.value.callee.obj;
      if (tyKind(this.tyOf(co)) === 'C' || tyKind(this.tyOf(co)) === 'G' || (!this.tyOf(co) && this.C.hasMethodNamed(norm(st.value.callee.name)))) {
        var cc = this.E(st.value, true).c.replace(/^\(await (.*)\)$/, 'await $1');
        this.line(cc + ';');
        return;
      }
    }
    this.store(st.target, st.value, st);
  };
  /** var int32 x;  int32 a[10];  const int32 c = -34; */
  G.declare = function (st) {
    var n = norm(st.target.name);
    // var temp = Temp.from(212): the class Temp is not the variable temp
    if (!st.noValue && usesName(st.value, n) && !this.C.typeNamed(n)) this.err('varSelf', [st.target.name], st.value);
    var vi = this.varInfo(n) || {};
    var ty = vi.ty, code;
    if (!ty && !st.noValue && !st.arr) {
      // var dog = new Dog(): the variable is a Dog from now on (like var in C#)
      var xv = this.E(st.value), xk = tyKind(xv.ty);
      if (xk === 'C' || xk === 'S' || xk === 'U' || xk === 'G') this.inferType(n, xv.ty);
      this.assign(st.target, this.val(xv), st);
      return;
    }
    if (st.arr) {
      var et = tyKind(ty) === 'L' ? tyName(ty) : 'any';
      if (st.noValue) {
        if (!st.arr.size) this.err('arraySize', [st.target.name], st.target);
        code = this.H('array', [this.e(st.arr.size), this.S(et)]);
      } else {
        code = this.valueAs(st.value, ty || 'L:any', st.value);
      }
    } else if (st.noValue) {
      code = ty ? this.zeroCode(ty) : 'null';
    } else {
      code = this.valueAs(st.value, ty, st.value);
    }
    this.assign(st.target, code, st);
  };
  /** x++, x += 2 (also b.click += handler: an event of a control) */
  G.incStmt = function (st) {
    if (this.eventTarget(st)) return;
    var by = st.by || node('Num', st, { v: 1 });
    var sum = this.E(node('Bin', st, { op: st.neg ? '-' : '+', l: st.target, r: by }));
    this.store(st.target, node('Pre', st, { x: sum }), st);
  };
  /** obj.add(x) on its own line, when obj is an object of a class */
  G.methodStmt = function (target, name, args, st) {
    var call = node('Call', st, { callee: node('Member', st, { obj: target, name: name, nameTok: st }), args: args });
    this.line(this.E(call, true).c.replace(/^\(await (.*)\)$/, 'await $1') + ';');
  };
  /** b.click += sayHi: run sayHi when b is clicked */
  G.eventTarget = function (st) {
    var t = st.target;
    if (t.type !== 'Member' || !st.by) return false;
    var o = t.obj, gt = null, objCode = null;
    if (this.isControlIdent(o)) {
      var ctl = this.C.control(norm(o.name));
      gt = this.C.guiType(ctl.type);
      objCode = this.H('ref', [this.S(ctl.name)]);
    } else {
      var ot = this.tyOf(o);
      if (tyKind(ot) !== 'G') return false;
      gt = tyName(ot);
    }
    var ev = this.C.guiEvent(gt, t.name);
    if (!ev) return false;
    if (st.neg) this.err('eventRemove', [t.name], st);
    if (this.where !== 'client') this.err('clientOnly', [t.name], st);
    var h = st.by, fn = h.type === 'Ident' ? this.C.functions[norm(h.name)] : null;
    if (!fn || fn.server || fn.params.length > 1) this.err('eventHandler', [t.name], h);
    this.line(this.H('on_ref', [objCode || this.e(o), this.S(ev), this.F(fn.name)]) + ';');
    return true;
  };
  /** b.hide(), b.focus(): commands of the language on a control kept in a variable */
  G.refCommand = function (ex) {
    var cal = ex.callee, m = norm(cal.name);
    var cdef = this.C.vocab.cmdMethods[m];
    var o = cal.obj;
    if (!cdef || o.type === 'This' || o.type === 'Base') return false;
    if (o.type === 'Ident' && !this.varInScope(norm(o.name)) && !this.fieldOf(norm(o.name))) return false;
    var oty = this.tyOf(o);
    if (oty === undefined && !(o.type === 'Ident' || o.type === 'Member' || o.type === 'Index')) {
      var ox = this.E(o);
      oty = ox.ty;
    }
    if (tyKind(oty) !== 'G') return false;
    var x = this.E(o);
    var c = this.C.vocab.cmdFirst[cdef.id];
    var slots = callSlots(c, cdef, node('RefCtl', o, { x: x, name: cal.name }), ex.args, cal.name + '()', cal.nameTok || cal, this.C.msgLang);
    this.command({ type: 'Command', cmd: c, def: cdef, slots: slots, label: cal.name, line: ex.line, col: ex.col, pos: ex.pos, end: ex.end });
    return true;
  };
  /** The code of the name of a control in a command: Button1, or a control kept in a variable */
  G.ctlNameCode = function (nd) {
    if (nd.type === 'RefCtl') return this.H('cname', [nd.x.c]);
    if (nd.type === 'ControlRef') {
      var n = norm(nd.name);
      if (this.varInScope(n) || this.fieldOf(n)) return this.H('cname', [this.e(node('Ident', nd, { name: nd.name }))]);
    }
    return this.S(this.controlName(nd));
  };

  G.callableIdent = function (nd) {
    var n = norm(nd.name);
    if (this.varInScope(n)) return false;
    var fn = this.C.functions[n];
    if (fn) return true;
    var bi = this.C.vocab.functions[n];
    return !!(bi && minArgs(bi) === 0);
  };

  G.loopBody = function (body) {
    this.indent();
    this.tick();
    this.brk.push('loop');
    this.block(body);
    this.brk.pop();
    this.dedent();
    this.line('}');
  };

  /** The code of a command (its template filled in), and the slot its answer goes into. */
  G.commandCode = function (st) {
    var def = st.def, self = this;
    var label = st.label || st.cmd.pattern.split('{')[0].trim() || st.cmd.pattern;
    var tpl = this.availability(def, label, st);
    var named = {};
    var assignSlot = null;
    st.cmd.parts.forEach(function (p) {
      if (!p.slot) return;
      var nd = st.slots[p.slot];
      if (p.kind === 'target') { if (nd) assignSlot = { nd: nd }; return; }
      if (!nd) { named[p.slot] = self.T === 'php' ? 'null' : 'undefined'; return; }
      if (p.kind === 'control') { named[p.slot] = self.ctlNameCode(nd); return; }
      if (p.kind === 'page') {
        // goTo(About): the name of a page
        if (nd.type === 'Ident' && !self.varInScope(norm(nd.name)) && self.C.pageByNorm(norm(nd.name))) {
          nd = node('Str', nd, { v: self.C.pageByNorm(norm(nd.name)).name });
        }
        if (nd.type === 'Str' && self.C.pages.length && !self.C.pageByNorm(norm(nd.v))) {
          self.err('pageUnknown', [nd.v, self.C.pages.map(function (pg) { return pg.name; }).join(', ')], nd);
        }
      }
      named[p.slot] = self.e(nd);
    });
    var code = this.fill(tpl, [], named);
    if (def.needs) this.C.need(def.needs);
    if (def.server) this.C.usesServer = true;
    return { code: code, assignSlot: assignSlot };
  };

  G.command = function (st) {
    var def = st.def, self = this;
    var r = this.commandCode(st), code = r.code;
    if (r.assignSlot) {
      if (def.async && this.T !== 'php') code = '(await ' + code + ')';
      this.store(r.assignSlot.nd, node('Pre', st, { x: { c: code, t: 'any' } }), st);
      return;
    }
    if (def.async && this.T !== 'php' && !/^await /.test(code)) code = 'await ' + code;
    code.split('\n').forEach(function (ln) { self.line(ln.replace(/;?\s*$/, ';')); });
  };

  /** Lines written by fn, taken out of the output (for the step of a C-style for). */
  G.capture = function (fn) {
    var saved = this.lines, savedInd = this.ind, savedDebug = this.debug;
    this.lines = [];
    this.ind = '';
    this.debug = false;
    try { fn(); } finally {
      var out = this.lines;
      this.lines = saved;
      this.ind = savedInd;
      this.debug = savedDebug;
    }
    return out;
  };
  /** x = ..., x++, x += ... without the line marker. */
  G.simple = function (st) {
    if (st.type === 'Set') { this.setStmt(st); return; }
    if (st.type === 'Inc') { this.incStmt(st); return; }
    this.err('noEffect', [], st);
  };

  /* ---- functions, handlers ---- */

  /** Run fn with these variables (names: normal names; info: name -> { ty, konst }). */
  G.withScope = function (names, display, info, fn) {
    if (typeof info === 'function') { fn = info; info = {}; }
    var saved = this.scope, savedBrk = this.brk;
    this.scope = new Map();
    this.scope.display = display || {};
    var self = this;
    names.forEach(function (n) { self.scope.set(n, (info && info[n]) || true); });
    this.brk = [];
    try { fn(); } finally {
      this.scope = saved;
      this.brk = savedBrk;
    }
  };
  /** Run fn; a mistake it finds is reported, and the rest goes on. */
  G.safe = function (fn) {
    try { fn(); } catch (e) {
      if (!(e instanceof WzError)) throw e;
      this.C.error(e, this.file);
    }
  };

  /** Variables of a function: its parameters + names it assigns (minus page globals, minus fields of its class). */
  G.localsOf = function (body, params, ptypes) {
    var self = this, display = {}, list = [], info = {};
    params.forEach(function (p, i) {
      display[norm(p)] = p;
      if (ptypes && ptypes[i]) info[norm(p)] = { ty: ptypes[i] };
    });
    var dt = declTypes(body, function (tr) { return self.C.spec(tr); }, function (e) { self.C.error(e, self.file); });
    var declared = {};
    assignedNames(body).forEach(function (a) { if (a.decl) declared[norm(a.name)] = true; });
    assignedNames(body).forEach(function (a) {
      var n = norm(a.name);
      if (params.some(function (p) { return norm(p) === n; })) return;
      // name = n inside a method changes the field name (like this.name = n)
      if (self.cls && !declared[n] && self.C.findField(self.cls, n)) return;
      // "var x" inside a function makes a new x, even if the page has an x
      if (self.where === 'client' && self.C.globals.has(n) && !declared[n]) return;
      if (self.special[n]) return;
      if (self.where === 'client' && self.C.control(n)) {
        // "set Label1 to ..." changes the control; only a loop can't use its name
        if (a.loop) self.C.error(new WzError('nameIsControl', [a.name], a.tok), self.file);
        return;
      }
      if (self.where === 'client' && self.C.isSite && self.C.anyControl(n) && !a.loop) return;
      if (self.C.isObj(n, 'session') || self.C.isObj(n, 'page')) return;
      if (self.C.functions[n]) { self.C.error(new WzError('nameIsFunction', [a.name], a.tok), self.file); return; }
      if (list.indexOf(n) < 0) { list.push(n); display[n] = a.name; }
    });
    Object.keys(dt).forEach(function (n) { if (list.indexOf(n) >= 0) info[n] = dt[n]; });
    return { list: list, display: display, info: info };
  };

  /**
   * The body of a function, a method or an event handler.
   * opts: { ptypes: [types of the parameters], paramToks, rty: the type it gives back,
   *         pre: code to write first (a constructor calls its base), handler: an event }
   */
  G.funcBody = function (body, params, label, opts) {
    var self = this;
    opts = opts || {};
    var ptypes = opts.ptypes || [];
    var loc = this.localsOf(body, params, ptypes);
    var all = params.map(norm).concat(loc.list);
    var savedRty = this.fnRty;
    this.fnRty = opts.rty || null;
    try {
      this.withScope(all, loc.display, loc.info, function () {
        if (loc.list.length) {
          var decl = loc.list.map(function (n) { return self.V(n); });
          if (self.T === 'php') decl.forEach(function (d) { self.line(d + ' = null;'); });
          else self.line('let ' + decl.join(', ') + ';');
        }
        // parameters with a type get that type when the function starts (int32 a: "12" becomes 12)
        ptypes.forEach(function (pt, i) {
          if (!pt) return;
          var pv = self.V(params[i]);
          self.safe(function () {
            if (tyKind(pt) === 'G' && self.where !== 'client') self.err('controlParamServer', [params[i]], (opts.paramToks || [])[i]);
            self.line(pv + ' = ' + self.castTo({ c: pv, t: 'any' }, pt, (opts.paramToks || [])[i]).c + ';');
          });
        });
        if (opts.pre) self.safe(opts.pre);
        if (self.debug && self.T !== 'php') {
          self.line('let $L = 0;');
          self.line('try {');
          self.indent();
          self.block(body);
          self.dedent();
          if (opts.handler) self.line('} catch ($e) { wz.fail($e, ' + jsStr(self.file) + ', $L); }');
          else self.line('} catch ($e) { throw wz.trace($e, ' + jsStr(self.file) + ', $L); }');
        } else {
          self.block(body);
        }
        // a function with a type that ends without return gives the zero of its type (0, "", ...)
        if (opts.rty && opts.rty !== 'void' && !endsWithReturn(body)) self.line('return ' + self.zeroCode(opts.rty) + ';');
      });
    } finally {
      this.fnRty = savedRty;
    }
    void label;
  };
  function endsWithReturn(body) {
    var l = body && body[body.length - 1];
    return !!l && l.type === 'Return';
  }

  /** The first line of a function: async in JavaScript, parameters that may be left out in PHP */
  G.fnHead = function (name, params, self) {
    if (this.T === 'php') {
      this.line('function ' + name + '(' + (self ? ['$self'] : []).concat(params.map(function (p) { return p + ' = null'; })).join(', ') + ') {');
    } else {
      this.line('async function ' + name + '(' + (self ? ['$self'] : []).concat(params).join(', ') + ') {');
    }
  };

  G.func = function (f) {
    var self = this;
    var params = f.params.map(function (p) { return self.V(p); });
    this.fnHead(this.F(f.name), params, false);
    this.indent();
    this.funcBody(f.body, f.params, f.name, {
      ptypes: (f.ptypes || []).map(function (t) { return self.C.spec(t); }),
      paramToks: f.paramToks, rty: this.C.spec(f.rtype)
    });
    this.dedent();
    this.line('}');
  };

  /* ---- structs, unions, classes ---- */

  /** A JavaScript object / PHP array of codes: { name: '"Dog"', ... } */
  G.obj = function (o) {
    var self = this, keys = Object.keys(o);
    if (this.T === 'php') return '[' + keys.map(function (k) { return phpStr(k) + ' => ' + o[k]; }).join(', ') + ']';
    void self;
    return '{ ' + keys.map(function (k) { return k + ': ' + o[k]; }).join(', ') + ' }';
  };
  /** A function name as a value: f in JavaScript, 'f' in PHP */
  G.fnRef = function (name) { return this.T === 'php' ? phpStr(name) : name; };
  /** wz.def_struct / def_union / def_class: what the runtime needs to know about a type */
  G.typeDef = function (ti) {
    var self = this;
    this.withType(ti, false, function () {
      if (ti.kind === 'struct' || ti.kind === 'union') {
        var fl = ti.fields.map(function (f) {
          var parts = [self.S(f.name), self.S(f.ty)];
          self.safe(function () {
            if (f.arr && f.arr.size) parts.push(self.H('array', [self.e(f.arr.size), self.S(tyName(f.ty))]));
            else if (f.init) parts.push(self.castTo(self.E(f.init), f.ty, f.init).c);
          });
          return '[' + parts.join(', ') + ']';
        });
        self.line(self.H(ti.kind === 'struct' ? 'def_struct' : 'def_union', [self.obj({ name: self.S(ti.name), fields: '[' + fl.join(', ') + ']' })]) + ';');
        return;
      }
      var fields = ti.fields.map(function (f) {
        return '[' + [self.S(f.name), self.S(f.ty), self.S(f.access), f.isStatic ? 'true' : 'false'].join(', ') + ']';
      });
      var methods = ti.methods.filter(function (m) { return !m.abstract; }).map(function (m) {
        return '[' + [self.S(m.name), self.fnRef(self.C.methodFn(m)), self.S(m.access), m.isStatic ? 'true' : 'false'].join(', ') + ']';
      });
      self.line(self.H('def_class', [self.obj({
        name: self.S(ti.name), base: ti.base ? self.S(ti.base.name) : 'null',
        abstract: ti.abstract ? 'true' : 'false', iface: ti.kind === 'interface' ? 'true' : 'false',
        ifaces: '[' + ti.ifaces.map(function (i) { return self.S(i.name); }).join(', ') + ']',
        fields: '[' + fields.join(', ') + ']', methods: '[' + methods.join(', ') + ']',
        ctor: ti.kind === 'class' ? self.fnRef(self.C.ctorFn(ti)) : 'null'
      })]) + ';');
    });
  };
  /** Write code as part of a type (its file, its class: private members are allowed) */
  G.withType = function (ti, isStatic, fn) {
    var saved = { cls: this.cls, isStatic: this.isStatic, inCtor: this.inCtor, file: this.file, cur: this.C.curFile, site: this.C.isSite };
    this.cls = ti.kind === 'class' || ti.kind === 'interface' ? ti : null;
    this.isStatic = isStatic;
    this.inCtor = false;
    this.file = ti.file;
    this.C.curFile = ti.file;
    this.C.isSite = ti.fileKind === 'site';
    try { fn(); } finally {
      this.cls = saved.cls; this.isStatic = saved.isStatic; this.inCtor = saved.inCtor;
      this.file = saved.file; this.C.curFile = saved.cur; this.C.isSite = saved.site;
    }
  };
  /** The functions of a class: its constructor, the starting values of its fields, its methods. */
  G.typeFns = function (ti) {
    var self = this, php = this.T === 'php';
    if (ti.kind !== 'class') return;
    var aw = php ? '' : 'await ';
    var hasInit = ti.fields.some(function (f) { return !f.isStatic && (f.init || (f.arr && f.arr.size)); });
    this.withType(ti, false, function () {
      self.line('// class ' + ti.name + ' (' + ti.file + ', line ' + ti.decl.line + ')');
      // the constructor: the base class first, then the fields that start with a value, then its own lines
      var ct = ti.ctor, params = ct ? ct.params : [], body = ct ? ct.body : [];
      var baseArgs = ct ? ct.baseArgs : null, baseTok = (ct && ct.baseTok) || (ct ? ct.tok : ti.decl.nameTok);
      if (body.length && body[0].type === 'ExprStmt' && body[0].expr.type === 'Call' && body[0].expr.callee.type === 'Base') {
        // Java: super(name); as the first line
        baseArgs = body[0].expr.args;
        baseTok = body[0].expr.callee;
        body = body.slice(1);
      }
      self.inCtor = true;
      self.fnHead(self.C.ctorFn(ti), params.map(function (p) { return self.V(p); }), true);
      self.indent();
      self.funcBody(body, params, ti.name, {
        ptypes: ct ? ct.ptypes : [], paramToks: ct ? ct.paramToks : [],
        pre: function () {
          if (ti.base) {
            var bct = ti.base.ctor, bp = bct ? bct.ptypes : [];
            if (!baseArgs && bp.length) self.err('baseNeedsArgs', [ti.base.name, ti.name, bp.length], baseTok);
            var a = self.argsFor(bp, baseArgs || [], baseTok, ti.base.name + '()');
            self.line(aw + self.C.ctorFn(ti.base) + '($self' + (a.length ? ', ' + a.join(', ') : '') + ');');
          } else if (baseArgs) {
            self.err('noBase', [ti.name], baseTok);
          }
          if (hasInit) self.line(aw + self.C.initFn(ti) + '($self);');
          // C++: Dog(...) : legs(4) { }
          (ct ? ct.inits : []).forEach(function (it) {
            self.safe(function () {
              var f = ti.fieldMap[norm(it.name)];
              if (!f || f.isStatic) self.err('noMember', [ti.name, it.name], it.tok);
              self.setField(f, self.valueAs(it.value, f.ty, it.value), it.tok);
            });
          });
        }
      });
      self.dedent();
      self.line('}');
      self.inCtor = false;
      if (hasInit) {
        self.fnHead(self.C.initFn(ti), [], true);
        self.indent();
        self.withScope([], {}, {}, function () {
          ti.fields.forEach(function (f) {
            if (f.isStatic) return;
            self.safe(function () {
              if (f.arr && f.arr.size) self.setField(f, self.H('array', [self.e(f.arr.size), self.S(tyName(f.ty))]), f.tok);
              else if (f.init) self.setField(f, self.valueAs(f.init, f.ty, f.init), f.tok);
            });
          });
        });
        self.dedent();
        self.line('}');
      }
      // the methods
      ti.methods.forEach(function (m) {
        if (m.abstract) return;
        self.isStatic = m.isStatic;
        self.fnHead(self.C.methodFn(m), m.params.map(function (p) { return self.V(p); }), !m.isStatic);
        self.indent();
        self.funcBody(m.body, m.params, m.name, { ptypes: m.ptypes, paramToks: m.paramToks, rty: m.rty });
        self.dedent();
        self.line('}');
      });
      self.isStatic = false;
    });
  };
  /** The static fields that start with a value: static int32 count = 0; */
  G.typeStatics = function (ti) {
    var self = this;
    if (ti.kind !== 'class') return;
    this.withType(ti, true, function () {
      self.withScope([], {}, {}, function () {
        ti.fields.forEach(function (f) {
          if (!f.isStatic || !(f.init || (f.arr && f.arr.size))) return;
          self.safe(function () {
            var v = f.arr && f.arr.size ? self.H('array', [self.e(f.arr.size), self.S(tyName(f.ty))]) : self.valueAs(f.init, f.ty, f.init);
            self.line(self.H('sfset', [self.S(ti.name), self.S(f.name), v, self.S(ti.name)]) + ';');
          });
        });
      });
    });
  };
  /** Does any of these classes have static fields with a starting value? */
  function hasStatics(tis) {
    return tis.some(function (ti) { return ti.kind === 'class' && ti.fields.some(function (f) { return f.isStatic && (f.init || (f.arr && f.arr.size)); }); });
  }

  /* =====================================================================
   * Project compiler
   * ===================================================================== */

  /**
   * Compile a whole project.
   * project = {
   *   pages:    [{ name, code, controls: [{ name, type }] }],
   *   siteCode: "...",
   *   tables:   [{ name, columns: [{ name, type }], rows: [...] }]
   * }
   * opts = { langs: ['en'], packs: [ids], debug, msgLang, controlTypes: { Button: { props, events, defaultProp } } }
   */
  L.compileProject = function (project, opts) {
    opts = opts || {};
    var vocab = L.getVocab(opts.langs || ['en'], opts.packs);
    var msgLang = opts.msgLang || 'en';
    var types = opts.controlTypes || {};
    var pages = project.pages || [];
    var tables = (project.tables || []).filter(function (t) { return t && t.name; });
    var result = {
      ok: true, errors: [], warnings: [], pages: {}, site: {},
      server: { js: '', php: '', functions: [], queries: [] },
      uses: { server: false, db: false, session: false },
      info: {}, needs: {}
    };
    var errorKeys = {};
    function addErr(list, file, e) {
      var k = file + ':' + e.line + ':' + e.col + ':' + e.key + ':' + (e.args || []).join('|');
      if (errorKeys[k]) return;
      errorKeys[k] = 1;
      list.push({
        file: file, line: e.line || 1, col: e.col || 1, pos: e.pos || 0, len: e.len || 1,
        key: e.key, msg: msg(msgLang, e.key, e.args) + (e.extra || '')
      });
    }

    function tableByNorm(n) {
      for (var i = 0; i < tables.length; i++) if (norm(tables[i].name) === n) return tables[i];
      return null;
    }
    function pageByNorm(n) {
      for (var i = 0; i < pages.length; i++) if (norm(pages[i].name) === n) return pages[i];
      return null;
    }

    // ---- 1. parse every file ----
    var files = [];
    var siteSrc = project.siteCode || '';
    var allControls = {};
    pages.forEach(function (pg) {
      (pg.controls || []).forEach(function (c) { allControls[norm(c.name)] = c; });
    });

    // the kinds of controls are classes too: Button, TextBox... (and Control, the class of all of them)
    var guiTypes = {};
    Object.keys(types).forEach(function (k) { guiTypes[norm(k)] = { name: k, kind: 'gui' }; });
    if (!guiTypes.control) guiTypes.control = { name: 'Control', kind: 'gui' };
    /** The names of the structs, unions, classes and interfaces of a file (found before reading it: "Point p" needs them). */
    function scanTypes(src) {
      var out = {}, toks = lex(src).tokens;
      for (var i = 0; i + 1 < toks.length; i++) {
        var tk = toks[i], nt = toks[i + 1];
        if (tk.t !== 'word' || !TYPE_KINDS[tk.n] || nt.t !== 'word') continue;
        var prev = toks[i - 1];
        if (prev && prev.t === 'op' && prev.v === '.') continue;
        var after = toks[i + 2];
        if ((tk.n === 'struct' || tk.n === 'union') && after && !(after.t === 'nl' || after.t === 'eof' || (after.t === 'op' && after.v === '{'))) continue;
        if (!out[nt.n]) out[nt.n] = { name: nt.v, kind: tk.n };
      }
      return out;
    }
    var siteTypeNames = scanTypes(siteSrc);

    function parseFile(name, kind, src, controls, ownTypes) {
      var ctx = {
        vocab: vocab, errors: [], src: src, msgLang: msgLang,
        tables: tables, tableByNorm: tableByNorm, pageByNorm: pageByNorm,
        typeByNorm: function (n) { return ownTypes[n] || siteTypeNames[n] || guiTypes[n] || null; },
        controlByNorm: function (n) {
          for (var i = 0; i < controls.length; i++) if (norm(controls[i].name) === n) return controls[i];
          return null;
        },
        eventNamesFor: function (ctl) {
          var t = ctl && types[ctl.type];
          var keys = t ? Object.keys(t.events || {}) : ['click'];
          return keys.map(function (k) { return vocab.say('ev.' + k); });
        }
      };
      var lx = lex(src);
      lx.errors.forEach(function (e) { ctx.errors.push(e); });
      var parser = new Parser(lx.tokens, ctx);
      var body = [];
      try { body = parser.parseProgram(); } catch (e) {
        if (!(e instanceof WzError)) throw e;
        parser.record(e);
      }
      var f = { name: name, kind: kind, src: src, body: body, controls: controls };
      ctx.errors.forEach(function (e) { addErr(result.errors, name, e); });
      return f;
    }

    var site = parseFile('Site', 'site', siteSrc, [], siteTypeNames);
    files.push(site);
    var pageFiles = pages.map(function (pg) {
      var f = parseFile(pg.name, 'page', pg.code || '', pg.controls || [], scanTypes(pg.code || ''));
      f.page = pg;
      files.push(f);
      return f;
    });

    // ---- 2. declarations: functions ----
    var functions = {};
    var builtinNames = vocab.functions;
    var compErrors = [];
    function declErr(key, args, nd, file, extra) {
      var len = nd.nameTok ? nd.nameTok.end - nd.nameTok.pos : (nd.end > nd.pos ? nd.end - nd.pos : 1);
      addErr(result.errors, file, { key: key, args: args, line: nd.line, col: nd.col, pos: nd.pos, len: len, extra: extra });
    }
    files.forEach(function (f) {
      f.body.forEach(function (st) {
        if (st.type !== 'Func') return;
        var n = norm(st.name);
        var nd = st.nameTok || st;
        if (builtinNames[n]) { declErr('dupBuiltin', [st.name], nd, f.name); return; }
        if (functions[n]) {
          var o = functions[n];
          declErr('dupFunction', [st.name, o.file, o.line], nd, f.name);
          return;
        }
        if (tableByNorm(n)) { declErr('nameIsTable', [st.name], nd, f.name); return; }
        functions[n] = { name: st.name, params: st.params, server: st.server, file: f.name, line: st.line, node: st, kind: f.kind };
        if (st.server) result.server.functions.push({ name: st.name, params: st.params, file: f.name, line: st.line });
      });
    });

    // ---- 2b. structs, unions, classes, interfaces ----
    var typeInfos = {}, typeList = [];
    var KIND_PREFIX = { struct: 'S:', union: 'U:', 'class': 'C:', 'interface': 'C:' };
    var BUILTIN_NAMES = {};
    Object.keys(BUILTIN_TYPES).forEach(function (k) { BUILTIN_NAMES[BUILTIN_TYPES[k]] = true; });
    files.forEach(function (f) {
      f.body.forEach(function (st) {
        if (st.type !== 'TypeDecl') return;
        var n = norm(st.name), nd = st.nameTok || st;
        if (typeInfos[n]) { declErr('dupType', [st.name, typeInfos[n].file, typeInfos[n].decl.line], nd, f.name); return; }
        if (guiTypes[n]) { declErr('typeIsControl', [st.name], nd, f.name); return; }
        if (BUILTIN_TYPES[n] !== undefined || BUILTIN_NAMES[n]) { declErr('typeIsBuiltin', [st.name], nd, f.name); return; }
        if (functions[n]) { declErr('typeIsFunction', [st.name], nd, f.name); return; }
        if (tableByNorm(n)) { declErr('typeIsTable', [st.name], nd, f.name); return; }
        if (allControls[n]) { declErr('typeIsControlName', [st.name], nd, f.name); return; }
        var ti = { id: typeList.length + 1, name: st.name, n: n, kind: st.kind, file: f.name, fileKind: f.kind, decl: st,
          base: null, ifaces: [], abstract: !!st.mods.abstract || st.kind === 'interface', sealed: !!(st.mods.sealed || st.mods.final),
          fields: [], methods: [], fieldMap: {}, methodMap: {}, ctor: null };
        typeInfos[n] = ti;
        typeList.push(ti);
      });
    });
    /** The type of a TypeRef as the compiler and the runtimes write it: int32, S:Point, C:Dog, G:Button, L:int32 */
    function specOf(tref) {
      if (!tref) return null;
      var nm = tref.name, n = norm(nm), base;
      if (BUILTIN_NAMES[nm]) base = nm;
      else if (typeInfos[n]) base = KIND_PREFIX[typeInfos[n].kind] + typeInfos[n].name;
      else if (guiTypes[n]) base = 'G:' + guiTypes[n].name;
      else base = 'any';
      for (var d = 0; d < (tref.dims || 0); d++) base = 'L:' + base;
      return base;
    }
    function isConstExpr(x) {
      if (!x) return true;
      switch (x.type) {
        case 'Num': case 'Str': case 'Bool': case 'Null': return true;
        case 'Un': return x.op === 'neg' && isConstExpr(x.x);
        case 'List': return x.items.every(isConstExpr);
        case 'Record': return x.entries.every(function (e) { return isConstExpr(e.value); });
        case 'Cast': return isConstExpr(x.x);
      }
      return false;
    }
    // bases and interfaces
    typeList.forEach(function (ti) {
      var st = ti.decl, file = ti.file;
      st.bases.forEach(function (bt, i) {
        var b = typeInfos[bt.n];
        if (!b) { declErr(guiTypes[bt.n] ? 'baseIsControl' : 'unknownType', [bt.v], bt, file); return; }
        if (ti.kind === 'class') {
          if (b.kind === 'class') {
            if (i > 0 || ti.base) declErr('oneBase', [ti.name, b.name], bt, file);
            else if (b.sealed) declErr('sealedBase', [b.name], bt, file);
            else ti.base = b;
          } else if (b.kind === 'interface') ti.ifaces.push(b);
          else declErr('badBase', [b.name, ti.name], bt, file);
        } else if (ti.kind === 'interface') {
          if (b.kind === 'interface') ti.ifaces.push(b);
          else declErr('ifaceBase', [ti.name, b.name], bt, file);
        } else {
          declErr('structBase', [ti.name], bt, file);
        }
      });
      st.ifaces.forEach(function (bt) {
        var b = typeInfos[bt.n];
        if (!b) { declErr('unknownType', [bt.v], bt, file); return; }
        if (b.kind !== 'interface') { declErr('notInterface', [b.name], bt, file); return; }
        ti.ifaces.push(b);
      });
    });
    typeList.forEach(function (ti) {
      var seen = {}, c = ti;
      while (c) {
        if (seen[c.n]) { declErr('inheritLoop', [ti.name], ti.decl.nameTok, ti.file); ti.base = null; break; }
        seen[c.n] = 1;
        c = c.base;
      }
    });
    // members
    typeList.forEach(function (ti) {
      var file = ti.file;
      ti.decl.members.forEach(function (m) {
        var n = norm(m.name), mods = m.mods || {};
        var ptypes = (m.params || []).map(function (p) { return specOf(p.tref); });
        var params = (m.params || []).map(function (p) { return p.tok.v; });
        var ptoks = (m.params || []).map(function (p) { return p.tok; });
        if (m.kind === 'ctor') {
          if (ti.ctor) { declErr('dupCtor', [ti.name], m.nameTok, file); return; }
          if (mods['static']) declErr('staticCtor', [ti.name], mods['static'], file);
          ti.ctor = { name: ti.name, kind: 'ctor', params: params, paramToks: ptoks, ptypes: ptypes, access: m.access, owner: ti,
            body: m.body, baseArgs: m.baseArgs, baseTok: m.baseTok, inits: m.inits, tok: m.nameTok, line: m.line };
          return;
        }
        if (ti.fieldMap[n] || ti.methodMap[n]) { declErr('dupMember', [m.name, ti.name], m.nameTok, file); return; }
        if (n === ti.n) { declErr('memberIsClass', [m.name], m.nameTok, file); return; }
        if (m.kind === 'field') {
          var fty = specOf(m.tref) || 'any';
          if (m.arr) fty = 'L:' + fty;
          if (ti.kind === 'union' && !SCALAR_SIZES[fty]) declErr('unionField', [m.name, showTy(fty)], m.nameTok, file);
          if ((ti.kind === 'struct' || ti.kind === 'union') && m.isStatic) declErr('staticInStruct', [m.name, ti.kind], m.nameTok, file);
          if (ti.kind === 'union' && m.init) declErr('unionDefault', [m.name], m.init, file);
          if (ti.kind === 'struct' && m.init && !isConstExpr(m.init)) declErr('constDefault', [m.name], m.init, file);
          if (ti.kind !== 'class' && m.arr && m.arr.size && !isConstExpr(m.arr.size)) declErr('constDefault', [m.name], m.arr.size, file);
          var f = { name: m.name, n: n, kind: 'field', ty: fty, access: m.access, isStatic: !!m.isStatic, konst: !!mods['const'],
            readonly: !!mods.readonly, init: m.init, arr: m.arr, tok: m.nameTok, owner: ti, line: m.line };
          ti.fields.push(f);
          ti.fieldMap[n] = f;
        } else {
          var meth = { name: m.name, n: n, kind: 'method', rty: specOf(m.rtype), ptypes: ptypes, params: params, paramToks: ptoks,
            access: m.access, isStatic: !!m.isStatic, virtual: !!mods.virtual, override: !!mods.override, abstract: !m.body,
            body: m.body, tok: m.nameTok, owner: ti, line: m.line };
          if (meth.abstract && ti.kind === 'class' && !ti.abstract) declErr('abstractInConcrete', [m.name, ti.name], m.nameTok, file);
          if (meth.abstract && meth.isStatic) declErr('abstractStatic', [m.name], m.nameTok, file);
          ti.methods.push(meth);
          ti.methodMap[n] = meth;
        }
      });
    });
    function findField(ti, name) {
      var n = norm(name);
      for (var c = ti; c; c = c.base) if (c.fieldMap && c.fieldMap[n]) return c.fieldMap[n];
      return null;
    }
    function findMethod(ti, name) {
      var n = norm(name), seen = {};
      for (var c = ti; c; c = c.base) if (c.methodMap && c.methodMap[n]) return c.methodMap[n];
      function inIfaces(t) {
        for (var i = 0; i < t.ifaces.length; i++) {
          var x = t.ifaces[i];
          if (seen[x.n]) continue;
          seen[x.n] = 1;
          if (x.methodMap[n]) return x.methodMap[n];
          var r = inIfaces(x);
          if (r) return r;
        }
        return null;
      }
      for (var c2 = ti; c2; c2 = c2.base) { var r2 = inIfaces(c2); if (r2) return r2; }
      return null;
    }
    /** Is a (a class name) the class b, or does it inherit from b (or implement the interface b)? */
    function isSubclass(a, b) {
      var ta = typeInfos[norm(a)], nb = norm(b), seen = {};
      function walk(t) {
        if (!t || seen[t.n]) return false;
        seen[t.n] = 1;
        if (t.n === nb) return true;
        if (walk(t.base)) return true;
        return t.ifaces.some(walk);
      }
      return walk(ta);
    }
    // inheriting: override must have something to override, a class that can be made must write every abstract method
    typeList.forEach(function (ti) {
      if (ti.kind !== 'class') return;
      ti.methods.forEach(function (m) {
        var bm = ti.base ? findMethod(ti.base, m.name) : null;
        var im = null;
        ti.ifaces.forEach(function (i) { im = im || findMethod(i, m.name); });
        if (m.override && !bm) declErr('noOverride', [m.name, ti.name], m.tok, ti.file);
        var other = bm || im;
        if (other && other.params.length !== m.params.length) declErr('overrideParams', [m.name, other.owner.name, other.params.length], m.tok, ti.file);
        if (bm && bm.isStatic !== m.isStatic) declErr('overrideStatic', [m.name, bm.owner.name], m.tok, ti.file);
      });
      ti.fields.forEach(function (f) {
        if (ti.base && findField(ti.base, f.name)) declErr('fieldHides', [f.name, ti.base.name], f.tok, ti.file);
        if (ti.base && findMethod(ti.base, f.name)) declErr('dupMember', [f.name, ti.name], f.tok, ti.file);
      });
      if (ti.abstract) return;
      var need = [], seen = {};
      function collect(t) {
        if (!t || seen[t.n]) return;
        seen[t.n] = 1;
        t.methods.forEach(function (m) { if (m.abstract) need.push(m); });
        if (t.base) collect(t.base);
        t.ifaces.forEach(collect);
      }
      collect(ti);
      var done = {};
      need.forEach(function (m) {
        if (done[m.n]) return;
        done[m.n] = 1;
        var impl = null;
        for (var c = ti; c && !impl; c = c.base) if (c.methodMap[m.n] && !c.methodMap[m.n].abstract) impl = c.methodMap[m.n];
        if (!impl) declErr('notImplemented', [ti.name, m.name, m.owner.name], ti.decl.nameTok, ti.file);
      });
    });
    // a struct can't hold itself (it would never end)
    typeList.forEach(function (ti) {
      if (ti.kind !== 'struct') return;
      var seen = {};
      (function walk(t) {
        t.fields.forEach(function (f) {
          if (tyKind(f.ty) !== 'S') return;
          var x = typeInfos[norm(tyName(f.ty))];
          if (!x) return;
          if (x === ti) { declErr('structLoop', [ti.name], f.tok, t.file); return; }
          if (!seen[x.n]) { seen[x.n] = 1; walk(x); }
        });
      })(ti);
    });
    // the order the runtime needs: structs and unions, then a base class or interface before the classes that use it
    var typeOrder = [];
    (function () {
      var done = {};
      typeList.forEach(function (ti) { if (ti.kind === 'struct' || ti.kind === 'union') { typeOrder.push(ti); done[ti.n] = 1; } });
      function add(ti) {
        if (done[ti.n]) return;
        done[ti.n] = 1;
        if (ti.base) add(ti.base);
        ti.ifaces.forEach(add);
        typeOrder.push(ti);
      }
      typeList.forEach(add);
    })();
    // the types of the parameters and results of functions
    Object.keys(functions).forEach(function (k) {
      var fn = functions[k], st = fn.node;
      fn.ptypes = (st.ptypes || []).map(specOf);
      fn.rty = specOf(st.rtype);
      if (fn.server) {
        fn.ptypes.concat([fn.rty]).forEach(function (t, i) {
          if (tyKind(t) === 'G') declErr('controlParamServer', [i < fn.params.length ? fn.params[i] : fn.name], (st.paramToks || [])[i] || st.nameTok || st, fn.file);
        });
      }
    });
    /** The structs and classes a piece of code uses (with the types those use, and the classes that inherit from them). */
    function typesUsedBy(nodes) {
      var out = [], has = {};
      function addName(name) {
        var ti = typeInfos[norm(name)];
        if (!ti || has[ti.n]) return;
        has[ti.n] = 1;
        out.push(ti);
        if (ti.base) addName(ti.base.name);
        ti.ifaces.forEach(function (i) { addName(i.name); });
        ti.fields.forEach(function (f) { addTy(f.ty); visit(f.init); visit(f.arr); });
        ti.methods.forEach(function (m) { visit(m.body); addTy(m.rty); m.ptypes.forEach(addTy); });
        if (ti.ctor) { visit(ti.ctor.body); visit(ti.ctor.baseArgs); visit(ti.ctor.inits); ti.ctor.ptypes.forEach(addTy); }
      }
      function addTy(ty) {
        while (tyKind(ty) === 'L') ty = tyName(ty);
        var k = tyKind(ty);
        if (k && k !== 'G') addName(tyName(ty));
      }
      function visit(x) {
        if (!x || typeof x !== 'object') return;
        if (Array.isArray(x)) { x.forEach(visit); return; }
        if (x.type === 'TypeRef') { addName(x.name); return; }
        if (x.type === 'Ident') addName(x.name);
        for (var k in x) {
          if (k === 'tok' || k === 'nameTok' || k === 'def' || k === 'table' || k === 'cmd' || k === 'kindTok') continue;
          var v = x[k];
          if (v && typeof v === 'object') visit(v);
        }
      }
      visit(nodes);
      // a function that takes an Animal can be given a Dog: Dog is needed too
      var grew = true;
      while (grew) {
        grew = false;
        typeList.forEach(function (ti) {
          if (has[ti.n]) return;
          if ((ti.base && has[ti.base.n]) || ti.ifaces.some(function (i) { return has[i.n]; })) { addName(ti.name); grew = true; }
        });
      }
      return typeOrder.filter(function (ti) { return has[ti.n]; });
    }

    // ---- 3. generate ----
    var queries = [];
    var C = {
      vocab: vocab, msgLang: msgLang, debug: !!opts.debug, functions: {}, tables: tables, pages: pages,
      tableByNorm: tableByNorm, pageByNorm: pageByNorm,
      controls: [], controlMap: {}, globals: new Map(), globalDisplay: {}, isSite: false,
      usesServer: false, usesDb: false, usesSession: false,
      control: function (n) { return this.isSite ? null : (this.controlMap[n] || null); },
      anyControl: function (n) { return allControls[n] || null; },
      controlProps: function (ctl) { var t = types[ctl.type]; return (t && t.props) || { text: {}, visible: {} }; },
      propType: function (ctl, key) { var p = this.controlProps(ctl)[key]; return (p && p.type) || 'any'; },
      defaultProp: function (ctl) { var t = types[ctl.type]; return (t && t.defaultProp) || 'text'; },
      isObj: function (n, which) {
        var ph = vocab.phrases['obj.' + which];
        return !!(ph && ph.some(function (p) { return p.length === 1 && p[0] === n; }));
      },
      addQuery: function (shape, file, line) {
        var id = 'q' + (queries.length + 1);
        queries.push({ id: id, shape: shape, file: file, line: line });
        return id;
      },
      need: function (what) { [].concat(what).forEach(function (w) { result.needs[w] = true; }); },
      error: function (e, file) {
        var tk = e.tok || {};
        addErr(result.errors, file, { key: e.key, args: e.args, line: tk.line, col: tk.col, pos: tk.pos, len: Math.max(1, (tk.end || 0) - (tk.pos || 0)), extra: e.extra });
      },
      warnings: [],
      warn: function (key, args, nd) {
        this.warnings.push({ key: key, args: args, line: nd.line, col: nd.col, file: this.curFile });
      },
      // ---- types ----
      spec: specOf,
      /** A type by its spec (C:Dog) or name, wherever it is written */
      ti: function (spec) { var nm = tyKind(spec) ? tyName(spec) : spec; return typeInfos[norm(nm)] || null; },
      /** A type by a name written in the code: only the types of the Site code and of this file */
      typeNamed: function (n) {
        var ti = typeInfos[n];
        if (!ti) return null;
        return (ti.fileKind === 'site' || ti.file === this.curFile) ? ti : null;
      },
      findField: findField,
      findMethod: findMethod,
      isSubclass: isSubclass,
      structField: function (name, field) { var ti = typeInfos[norm(name)]; return ti ? (ti.fieldMap[norm(field)] || null) : null; },
      memberNames: function (ti) {
        var out = [];
        for (var c = ti; c; c = c.base) {
          c.fields.forEach(function (f) { out.push(f.name); });
          c.methods.forEach(function (m) { out.push(m.name); });
        }
        return out;
      },
      hasMethodNamed: function (m) {
        var n = norm(m);
        return typeList.some(function (ti) { return ti.methodMap[n] && !ti.methodMap[n].isStatic; });
      },
      methodFn: function (m) { return 'c' + m.owner.id + '_m_' + mangle(m.name); },
      ctorFn: function (ti) { return 'c' + ti.id + '_ctor'; },
      initFn: function (ti) { return 'c' + ti.id + '_init'; },
      /** the size in bytes of a type, like C's sizeof (null: it has no fixed size) */
      sizeOfTy: function sizeOfTy(ty) {
        var al = { v: 1 };
        function sz(t, a) {
          if (SCALAR_SIZES[t]) { a.v = Math.max(a.v, SCALAR_SIZES[t]); return SCALAR_SIZES[t]; }
          var k = tyKind(t);
          if (k === 'C' || k === 'G') { a.v = Math.max(a.v, 8); return 8; }
          if (k === 'S' || k === 'U') {
            var ti = typeInfos[norm(tyName(t))], off = 0, inner = { v: 1 };
            if (!ti) return null;
            for (var i = 0; i < ti.fields.length; i++) {
              var f = ti.fields[i];
              var fa = { v: 1 }, s1 = sz(f.ty, fa);
              if (s1 === null) return null;
              inner.v = Math.max(inner.v, fa.v);
              if (k === 'U') off = Math.max(off, s1);
              else off = Math.ceil(off / fa.v) * fa.v + s1;
            }
            a.v = Math.max(a.v, inner.v);
            return Math.max(inner.v, Math.ceil(off / inner.v) * inner.v);
          }
          return null;
        }
        return sz(ty, al);
      },
      // ---- the controls as classes ----
      guiType: function (t) { return t === 'FreePanel' ? 'Panel' : t; },
      guiIsA: function (a, b) { return norm(b) === 'control' || norm(this.guiType(a)) === norm(b); },
      guiProps: function (name) {
        if (types[name]) return types[name].props || {};
        // Control: what every control has
        var keys = Object.keys(types), out = null;
        keys.forEach(function (k) {
          var p = types[k].props || {};
          if (!out) { out = Object.assign({}, p); return; }
          Object.keys(out).forEach(function (x) { if (!p[x]) delete out[x]; });
        });
        return out || { visible: {} };
      },
      /** The DOM event of an event of a kind of control (click -> 'click', TextBox changed -> 'input'), or null */
      guiEvent: function (name, word) {
        var w = norm(word), list = types[name] ? [types[name]] : Object.keys(types).map(function (k) { return types[k]; });
        for (var i = 0; i < list.length; i++) {
          var evs = list[i].events || {};
          var keys = Object.keys(evs);
          for (var j = 0; j < keys.length; j++) {
            var key = keys[j];
            if (norm(key) === w) return evs[key];
            var ph = vocab.phrases['ev.' + key] || [];
            if (ph.some(function (p) { return p.length === 1 && p[0] === w; })) return evs[key];
          }
        }
        return null;
      },
      newTypes: {},
      newControl: function (name) { this.newTypes[name] = true; }
    };
    Object.keys(functions).forEach(function (k) { C.functions[k] = functions[k]; });

    function collectGlobals(f, into, display) {
      var top = f.body.filter(function (st) { return ['Func', 'When', 'Every', 'TypeDecl'].indexOf(st.type) < 0; });
      var dt = declTypes(top, specOf, function (e) { C.error(e, f.name); });
      assignedNames(top).forEach(function (a) {
        var n = norm(a.name);
        if (C.isObj(n, 'session') || C.isObj(n, 'page')) return;
        var ctl = f.kind === 'site' ? allControls[n] : C.controlMap[n];
        if (ctl) {
          if (a.loop) C.error(new WzError('nameIsControl', [a.name], a.tok), f.name);
          return;
        }
        if (C.functions[n]) { C.error(new WzError('nameIsFunction', [a.name], a.tok), f.name); return; }
        if (!into.has(n)) { into.set(n, dt[n] || true); display[n] = a.name; }
        else if (dt[n]) {
          var old = into.get(n);
          if (old && old !== true && old.ty && dt[n].ty && old.ty !== dt[n].ty) C.error(new WzError('typeRedeclared', [a.name, showTy(old.ty)], a.tok), f.name);
          else into.set(n, dt[n]);
        }
      });
    }

    function genClient(f, g) {
      // functions
      f.body.forEach(function (st) {
        if (st.type === 'Func' && !st.server) {
          g.line('// function ' + st.name + ' (' + f.name + ', line ' + st.line + ')');
          g.func(st);
          g.line('');
        }
      });
      // events
      f.body.forEach(function (st) {
        if (st.type === 'When') {
          var ev = st.ev;
          try {
            if (ev.kind === 'control') {
              if (f.kind === 'site') { C.error(new WzError('eventInSite', [], st), f.name); return; }
              var ctl = C.control(norm(ev.name));
              if (!ctl) {
                var s = suggest(ev.name, C.controls.map(function (c) { return c.name; }));
                throw new WzError('unknownControl', [ev.name], ev.nameTok, s ? msg(msgLang, 'didYouMean', [s]) : '');
              }
              var t = types[ctl.type] || {};
              var evs = t.events || { click: 'click' };
              if (!evs[ev.event]) {
                var names = Object.keys(evs).map(function (k) { return vocab.say('ev.' + k); });
                throw new WzError('badEvent', [ctl.name, vocab.say('ev.' + ev.event), names.join(', ')], ev.evTok);
              }
              g.line('// when ' + ctl.name + ' ' + vocab.say('ev.' + ev.event, 'en') + ' (line ' + st.line + ')');
              g.line('wz.on(' + jsStr(ctl.name) + ', ' + jsStr(evs[ev.event]) + ', async function () {');
            } else if (ev.kind === 'load') {
              g.line('// when page loads (line ' + st.line + ')');
              g.line('wz.on_load(async function () {');
            } else {
              g.line('// when a key is pressed (line ' + st.line + ')');
              g.line('wz.on_key(async function ($key) {');
            }
          } catch (e) {
            if (!(e instanceof WzError)) throw e;
            C.error(e, f.name);
            return;
          }
          g.indent();
          var savedSpecial = g.special;
          if (ev.kind === 'key') {
            g.special = Object.assign({}, savedSpecial);
            (vocab.phrases['var.key'] || [['key']]).forEach(function (ph) { if (ph.length === 1) g.special[ph[0]] = '$key'; });
          }
          g.funcBody(st.body, [], 'when', { handler: true });
          g.special = savedSpecial;
          g.dedent();
          g.line('});');
          g.line('');
        } else if (st.type === 'Every') {
          var ms;
          try {
            ms = st.unit === 1 ? g.e(st.amount) : g.H('mul', [g.e(st.amount), String(st.unit)]);
          } catch (e) {
            if (!(e instanceof WzError)) throw e;
            C.error(e, f.name);
            return;
          }
          g.line('// every ... (line ' + st.line + ')');
          g.line('wz.every(' + ms + ', async function () {');
          g.indent();
          g.funcBody(st.body, [], 'every', { handler: true });
          g.dedent();
          g.line('});');
          g.line('');
        }
      });
    }

    function topLevel(f) {
      return f.body.filter(function (st) { return ['Func', 'When', 'Every', 'TypeDecl'].indexOf(st.type) < 0; });
    }
    /** structs, unions and classes: the definitions, the functions of the classes, and (statics) where static fields start */
    function genTypes(g, tis, statics) {
      if (!tis.length) return;
      tis.forEach(function (ti) { g.typeFns(ti); });
      tis.forEach(function (ti) { g.typeDef(ti); });
      if (statics && hasStatics(tis)) statics(function () { tis.forEach(function (ti) { g.typeStatics(ti); }); });
      g.line('');
    }

    // client code of each page = site code + page code
    pageFiles.forEach(function (pf) {
      C.controls = pf.controls || [];
      C.controlMap = {};
      C.controls.forEach(function (c) { C.controlMap[norm(c.name)] = c; });
      C.globals = new Map();
      C.globalDisplay = {};
      C.isSite = true;
      C.curFile = 'Site';
      collectGlobals(site, C.globals, C.globalDisplay);
      C.isSite = false;
      C.curFile = pf.name;
      collectGlobals(pf, C.globals, C.globalDisplay);

      var g = new Gen(C, 'js', 'client', pf.name);
      g.line('// ' + pf.name + ' page - JavaScript made by Wemazy from your Wemazy Script.');
      g.line('// Do not edit: Wemazy writes it again every time you run or export.');
      g.line('(function (wz) {');
      g.line('"use strict";');
      var gl = [];
      C.globals.forEach(function (_, k) { gl.push(g.V(k)); });
      if (gl.length) g.line('let ' + gl.join(', ') + ';');
      g.line('');
      // the structs and classes of the Site code and of this page
      C.newTypes = {};
      genTypes(g, typeOrder.filter(function (ti) { return ti.fileKind === 'site' || ti.file === pf.name; }), function (write) {
        g.line('wz.start(async function () {');
        g.indent();
        write();
        g.dedent();
        g.line('});');
      });
      // site part
      C.isSite = true;
      g.file = 'Site';
      C.curFile = 'Site';
      genClient(site, g);
      // page part
      C.isSite = false;
      g.file = pf.name;
      C.curFile = pf.name;
      genClient(pf, g);
      // top-level code: site then page
      var siteTop = topLevel(site), pageTop = topLevel(pf);
      if (siteTop.length || pageTop.length) {
        g.line('wz.start(async function () {');
        g.indent();
        var parts = [['Site', siteTop, true], [pf.name, pageTop, false]];
        parts.forEach(function (pp) {
          if (!pp[1].length) return;
          C.isSite = pp[2];
          g.file = pp[0];
          C.curFile = pp[0];
          if (g.debug) {
            g.line('let $L = 0;');
            g.line('try {');
            g.indent();
            g.withScope([], {}, function () { g.block(pp[1]); });
            g.dedent();
            g.line('} catch ($e) { wz.fail($e, ' + jsStr(pp[0]) + ', $L); }');
          } else {
            g.withScope([], {}, function () { g.block(pp[1]); });
          }
        });
        g.dedent();
        g.line('});');
      }
      C.isSite = false;
      g.line('})(window.wz);');
      result.pages[pf.page.name] = { js: g.lines.join('\n'), newControls: Object.keys(C.newTypes) };
      result.info[pf.page.name] = fileInfo(pf, C);
    });
    // site info (for the editor)
    C.controls = [];
    C.controlMap = {};
    C.globals = new Map();
    C.globalDisplay = {};
    collectGlobals(site, C.globals, C.globalDisplay);
    result.info.Site = fileInfo(site, C);
    if (!pageFiles.length) {
      // still check the site code
      var g0 = new Gen(C, 'js', 'client', 'Site');
      C.isSite = true;
      C.curFile = 'Site';
      genTypes(g0, typeOrder.filter(function (ti) { return ti.fileKind === 'site'; }), function (write) { write(); });
      genClient(site, g0);
      g0.withScope([], {}, function () { g0.block(topLevel(site)); });
      C.isSite = false;
    }

    // ---- server code (all server functions, then the queries the pages use) ----
    var serverFns = [];
    files.forEach(function (f) {
      f.body.forEach(function (st) { if (st.type === 'Func' && st.server) serverFns.push({ f: f, st: st }); });
    });
    C.controls = [];
    C.controlMap = {};
    C.globals = new Map();
    var gs = new Gen(C, 'sim', 'server', 'Site');
    var gp = new Gen(C, 'php', 'server', 'Site');
    gs.line('(function (wz) {');
    gs.line('"use strict";');
    gp.line('<?php');
    gp.line('// Server code made by Wemazy from your Wemazy Script.');
    gp.line('// Do not edit: Wemazy writes it again every time you run or export.');
    gp.line('');
    // the structs and classes the server functions use
    var serverTypes = typesUsedBy(serverFns.map(function (sf) { return sf.st; }));
    if (serverTypes.length) {
      // browser test server: made again before every call, like PHP does for every request
      serverTypes.forEach(function (ti) { gs.typeFns(ti); });
      gs.line('async function $types() {');
      gs.indent();
      serverTypes.forEach(function (ti) { gs.typeDef(ti); });
      serverTypes.forEach(function (ti) { gs.typeStatics(ti); });
      gs.dedent();
      gs.line('}');
      gs.line('');
      genTypes(gp, serverTypes, function (write) { write(); });
    }
    serverFns.forEach(function (sf) {
      C.curFile = sf.f.name;
      gs.file = sf.f.name;
      gp.file = sf.f.name;
      gs.line('// server function ' + sf.st.name + ' (' + sf.f.name + ', line ' + sf.st.line + ')');
      gs.func(sf.st);
      gs.line('');
      gp.line('// server function ' + sf.st.name + ' (' + sf.f.name + ', line ' + sf.st.line + ')');
      gp.func(sf.st);
      gp.line('');
    });
    if (serverFns.length) result.uses.server = true;

    // queries asked for by the pages
    gs.line('const queries = {');
    gs.indent();
    queries.forEach(function (q) {
      var pc = q.shape.params.map(function (_, i) { return 'p[' + i + ']'; });
      gs.line('// ' + q.file + ', line ' + q.line);
      gs.line(q.id + ': async function (p) { return ' + queryRun('sim', q.shape, pc) + '; },');
    });
    gs.dedent();
    gs.line('};');
    gs.line('return {');
    gs.indent();
    gs.line('functions: {' + serverFns.map(function (sf) { return jsStr(sf.st.name) + ': ' + gs.F(sf.st.name); }).join(', ') + '},');
    if (serverTypes.length) gs.line('init: $types,');
    gs.line('queries: queries');
    gs.dedent();
    gs.line('};');
    gs.line('})');

    gp.line('function wz_queries() {');
    gp.indent();
    gp.line('return [');
    gp.indent();
    queries.forEach(function (q) {
      var pc = q.shape.params.map(function (_, i) { return '$p[' + i + ']'; });
      gp.line('// ' + q.file + ', line ' + q.line);
      gp.line(phpStr(q.id) + ' => function ($p) { return ' + queryRun('php', q.shape, pc) + '; },');
    });
    gp.dedent();
    gp.line('];');
    gp.dedent();
    gp.line('}');
    gp.line('');
    gp.line('function wz_functions() {');
    gp.indent();
    gp.line('return [' + serverFns.map(function (sf) { return phpStr(sf.st.name) + ' => ' + phpStr(gp.F(sf.st.name)); }).join(', ') + '];');
    gp.dedent();
    gp.line('}');

    result.server.js = gs.lines.join('\n');
    result.server.php = gp.lines.join('\n') + '\n';
    result.server.queries = queries.map(function (q) { return { id: q.id, sql: q.shape.sql, file: q.file, line: q.line, table: q.shape.table, kind: q.shape.kind }; });
    result.uses.server = result.uses.server || queries.length > 0 || C.usesServer;
    result.uses.db = C.usesDb;
    result.uses.session = C.usesSession;
    result.warnings = C.warnings.map(function (w) {
      return { file: w.file || 'Site', line: w.line, col: w.col, msg: msg(msgLang, w.key, w.args), key: w.key };
    });
    result.errors.sort(function (a, b) { return a.file === b.file ? (a.line - b.line || a.col - b.col) : 0; });
    result.ok = result.errors.length === 0;
    result.runtimeJs = vocab.runtimeJs.join('\n');
    result.runtimePhp = vocab.runtimePhp.join('\n');
    return result;
  };

  /** What the editor needs to know about a file (for IntelliSense). */
  function fileInfo(f, C) {
    var info = { globals: [], functions: [], handlers: [], locals: [], types: [], varTypes: {} };
    var specOf = C.spec, onErr = function () {};
    C.globals.forEach(function (v, k) {
      info.globals.push(C.globalDisplay[k] || k);
      if (v && v !== true && v.ty) info.varTypes[C.globalDisplay[k] || k] = v.ty;
    });
    function locals(st, params, ptypes) {
      var loc = assignedNames(st.body).map(function (a) { return a.name; });
      var dt = declTypes(st.body, specOf, onErr), vt = {};
      Object.keys(dt).forEach(function (n) { if (dt[n].ty) vt[n] = dt[n].ty; });
      (params || []).forEach(function (p, i) { if (ptypes && ptypes[i]) vt[norm(p)] = specOf(ptypes[i]); });
      return { list: uniq((params || []).concat(loc)), types: vt };
    }
    f.body.forEach(function (st) {
      if (st.type === 'Func') {
        var l = locals(st, st.params, st.ptypes);
        info.functions.push({ name: st.name, params: st.params, ptypes: (st.ptypes || []).map(specOf), rty: specOf(st.rtype), server: st.server,
          line: st.line, endLine: lastLine(st), locals: l.list, varTypes: l.types });
      } else if (st.type === 'When' || st.type === 'Every') {
        var l2 = locals(st, [], []);
        info.handlers.push({ line: st.line, endLine: lastLine(st), locals: l2.list, varTypes: l2.types, ev: st.ev || null });
      } else if (st.type === 'TypeDecl') {
        var ti = C.ti(st.name);
        if (!ti) return;
        var members = ti.fields.map(function (fd) {
          return { name: fd.name, kind: 'field', ty: fd.ty, access: fd.access, isStatic: fd.isStatic, konst: fd.konst };
        }).concat(ti.methods.map(function (m) {
          return { name: m.name, kind: 'method', ty: m.rty, access: m.access, isStatic: m.isStatic, params: m.params, ptypes: m.ptypes, abstract: m.abstract };
        }));
        var t = { name: ti.name, kind: ti.kind, line: st.line, endLine: lastLine({ line: st.line, body: [] }), base: ti.base ? ti.base.name : null,
          ifaces: ti.ifaces.map(function (i) { return i.name; }), members: members, ctorParams: ti.ctor ? ti.ctor.params : [],
          ctorTypes: ti.ctor ? ti.ctor.ptypes : [], abstract: ti.abstract };
        var mx = st.line;
        st.members.forEach(function (m) { if (m.body) walkStmts(m.body, function (x) { if (x.line > mx) mx = x.line; }); if (m.line > mx) mx = m.line; });
        t.endLine = mx + 1;
        // the methods: where they are (for local names) and their locals
        t.methods = [];
        st.members.forEach(function (m) {
          if (!m.body) return;
          var mend = m.line;
          walkStmts(m.body, function (x) { if (x.line > mend) mend = x.line; });
          var ps = (m.params || []).map(function (q) { return q.tok.v; });
          var l3 = locals({ body: m.body }, ps, (m.params || []).map(function (q) { return q.tref; }));
          t.methods.push({ name: m.name, line: m.line, endLine: mend + 1, locals: l3.list, varTypes: l3.types });
        });
        info.types.push(t);
      }
    });
    return info;
  }
  /** The members a value of a type offers after a dot (for the editor): fields and methods, with the inherited ones. */
  L.membersOf = function (types, name) {
    var byN = {};
    (types || []).forEach(function (t) { byN[norm(t.name)] = t; });
    var out = [], seen = {}, t = byN[norm(name)];
    function add(x, fromBase) {
      if (!x || seen[norm(x.name)]) return;
      seen[norm(x.name)] = 1;
      x.members.forEach(function (m) {
        var k = m.name.toLowerCase();
        if (seen['m:' + k]) return;
        seen['m:' + k] = 1;
        if (fromBase && m.access === 'private') return;
        out.push(Object.assign({ owner: x.name }, m));
      });
      if (x.base) add(byN[norm(x.base)], true);
      (x.ifaces || []).forEach(function (i) { add(byN[norm(i)], true); });
    }
    add(t, false);
    return out;
  };
  function lastLine(st) {
    var m = st.line;
    walkStmts(st.body, function (s) { if (s.line > m) m = s.line; });
    return m + 1;
  }

  /* =====================================================================
   * SQL for the database (CREATE TABLE + starting rows)
   * ===================================================================== */

  var SQL_TYPES = {
    sqlite: { text: 'TEXT', longtext: 'TEXT', number: 'REAL', integer: 'INTEGER', yesno: 'INTEGER', date: 'TEXT', datetime: 'TEXT' },
    mysql: { text: 'VARCHAR(255)', longtext: 'TEXT', number: 'DOUBLE', integer: 'INT', yesno: 'TINYINT(1)', date: 'DATE', datetime: 'DATETIME' }
  };
  L.columnTypes = ['text', 'longtext', 'number', 'integer', 'yesno', 'date', 'datetime'];

  function sqlValue(v, type) {
    if (v === null || v === undefined || v === '') return 'NULL';
    if (type === 'number' || type === 'integer') {
      var n = Number(String(v).replace(',', '.'));
      return isFinite(n) ? String(n) : 'NULL';
    }
    if (type === 'yesno') return (v === true || v === 1 || v === '1' || v === 'true' || v === 'yes') ? '1' : '0';
    return "'" + String(v).replace(/'/g, "''") + "'";
  }

  L.schemaSql = function (tables, dialect) {
    dialect = dialect || 'sqlite';
    var T = SQL_TYPES[dialect];
    var out = [];
    out.push('-- Database made by Wemazy (' + (dialect === 'mysql' ? 'MySQL / MariaDB' : 'SQLite') + ')');
    if (dialect === 'mysql') out.push('SET NAMES utf8mb4;');
    out.push('');
    (tables || []).forEach(function (t) {
      var cols = [dialect === 'mysql' ? '    id INT AUTO_INCREMENT PRIMARY KEY' : '    id INTEGER PRIMARY KEY AUTOINCREMENT'];
      (t.columns || []).forEach(function (c) {
        cols.push('    ' + c.name + ' ' + (T[c.type] || T.text));
      });
      out.push('CREATE TABLE IF NOT EXISTS ' + t.name + ' (');
      out.push(cols.join(',\n'));
      out.push(')' + (dialect === 'mysql' ? ' DEFAULT CHARSET=utf8mb4' : '') + ';');
      out.push('');
      (t.rows || []).forEach(function (r) {
        var names = [], vals = [];
        (t.columns || []).forEach(function (c) {
          if (r[c.name] === undefined) return;
          names.push(c.name);
          vals.push(sqlValue(r[c.name], c.type));
        });
        if (names.length) out.push('INSERT INTO ' + t.name + ' (' + names.join(', ') + ') VALUES (' + vals.join(', ') + ');');
      });
      if ((t.rows || []).length) out.push('');
    });
    return out.join('\n');
  };

  function phpVal(v) {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return isFinite(v) ? String(v) : 'null';
    if (typeof v === 'object') return phpStr(JSON.stringify(v));
    return phpStr(String(v));
  }

  /** The tables as PHP (wz_schema() in wemazy/server.php). */
  L.phpSchema = function (tables) {
    var out = ['function wz_schema() {', '    return ['];
    (tables || []).forEach(function (t) {
      if (!t || !t.name) return;
      out.push('        ' + phpStr(t.name) + ' => [');
      out.push("            'columns' => [" + (t.columns || []).map(function (c) { return phpStr(c.name) + ' => ' + phpStr(c.type || 'text'); }).join(', ') + '],');
      out.push("            'rows' => [");
      (t.rows || []).forEach(function (r) {
        var cells = (t.columns || []).filter(function (c) { return r[c.name] !== undefined; })
          .map(function (c) { return phpStr(c.name) + ' => ' + phpVal(r[c.name]); });
        out.push('                [' + cells.join(', ') + '],');
      });
      out.push('            ],');
      out.push('        ],');
    });
    out.push('    ];', '}');
    return out.join('\n');
  };

  /** Names that can't be used for tables or columns (SQL keywords). */
  L.sqlReserved = ('add all alter and any as asc between by case check column constraint create cross current database default delete desc distinct drop else end escape exists fetch for foreign from full group having if in index inner insert interval into is join key left like limit match natural not null of offset on or order outer primary references replace right row rows select set table then to union unique update using values when where with id').split(' ');

  L.checkSqlName = function (name) {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(name)) return 'letters';
    if (L.sqlReserved.indexOf(name.toLowerCase()) >= 0) return 'reserved';
    return null;
  };

  /* =====================================================================
   * Highlighting (for the code editor)
   * ===================================================================== */

  /**
   * Split code into coloured pieces. Returns [{ s: start, e: end, c: class }].
   * Classes: kw, str, num, com, ctl, fn, tbl, prop, op, var, err, interp
   */
  L.highlight = function (src, ctx) {
    ctx = ctx || {};
    var vocab = ctx.vocab || L.getVocab(['en']);
    var lx = lex(src, { comments: true });
    var out = [];
    var toks = lx.tokens;
    var controls = ctx.controls || {}, tables = ctx.tables || {}, fns = ctx.functions || {};
    var userTypes = ctx.types || {};
    var typeWords = {};
    L.typeWords.forEach(function (w) { typeWords[w] = 1; });
    var phraseFirst = phraseIndex(vocab);
    var marked = {};
    function addTok(t, cls) { out.push({ s: t.pos, e: t.end, c: cls }); }
    function classify(list) {
      for (var i = 0; i < list.length; i++) {
        var t = list[i];
        if (marked[t.pos]) continue;
        if (t.t === 'num') addTok(t, 'num');
        else if (t.t === 'str') {
          if (t.interp && t.interp.length) {
            var p = t.pos;
            t.interp.forEach(function (ip) {
              if (ip.pos > p) out.push({ s: p, e: ip.pos, c: 'str' });
              out.push({ s: ip.pos, e: ip.pos + 1, c: 'interp' });
              classify(ip.toks);
              out.push({ s: ip.end - 1, e: ip.end, c: 'interp' });
              p = ip.end;
            });
            if (t.end > p) out.push({ s: p, e: t.end, c: 'str' });
          } else addTok(t, 'str');
        } else if (t.t === 'op') addTok(t, 'op');
        else if (t.t === 'bad') addTok(t, 'err');
        else if (t.t === 'word') {
          var prev = list[i - 1], next = list[i + 1];
          var called = !!(next && next.t === 'op' && next.v === '(');
          // after a dot: a method (x.trim()) or a property / field (Label1.text)
          if (prev && prev.t === 'op' && prev.v === '.') { addTok(t, called ? 'fn' : 'prop'); continue; }
          var cands = phraseFirst[t.n];
          var best = 0;
          if (cands) {
            cands.forEach(function (ph) {
              if (ph.length <= best) return;
              for (var j = 0; j < ph.length; j++) {
                var tj = list[i + j];
                if (!tj || tj.t !== 'word' || tj.n !== ph[j]) return;
              }
              best = ph.length;
            });
          }
          if (best) {
            for (var k = 0; k < best; k++) { addTok(list[i + k], 'kw'); marked[list[i + k].pos] = 1; }
            i += best - 1;
            continue;
          }
          var typeWord = BUILTIN_TYPES[t.n] !== undefined || typeWords[t.n];
          if (controls[t.n]) addTok(t, 'ctl');
          else if (tables[t.n]) addTok(t, 'tbl');
          else if (typeWord && !(prev && prev.t === 'word' && (prev.n === 'class' || prev.n === 'struct' || prev.n === 'union' || prev.n === 'interface'))) addTok(t, 'type');
          else if (userTypes[t.n] || (prev && prev.t === 'word' && (prev.n === 'class' || prev.n === 'struct' || prev.n === 'union' || prev.n === 'interface' || prev.n === 'new'))) addTok(t, 'type');
          else if (fns[t.n] || vocab.functions[t.n] || (called && vocab.cmdCalls[t.n])) addTok(t, 'fn');
          else if (vocab.cmdByFirst[t.n] && (!list[i - 1] || list[i - 1].t === 'nl')) addTok(t, 'kw');
          else addTok(t, 'var');
        }
      }
    }
    classify(toks);
    lx.comments.forEach(function (c) { out.push({ s: c.pos, e: c.end, c: 'com' }); });
    // command words (multi-word commands like "show message")
    out.sort(function (a, b) { return a.s - b.s; });
    return out;
  };

  function phraseIndex(vocab) {
    if (vocab._phraseFirst) return vocab._phraseFirst;
    var idx = {};
    Object.keys(vocab.phrases).forEach(function (canon) {
      if (canon.indexOf('prop.') === 0) return;
      if (canon.indexOf('obj.') === 0 || canon.indexOf('var.') === 0) return;
      vocab.phrases[canon].forEach(function (ph) {
        (idx[ph[0]] || (idx[ph[0]] = [])).push(ph);
      });
    });
    vocab.commands.forEach(function (c) {
      var lit = c.parts[0].lit;
      (idx[lit[0]] || (idx[lit[0]] = [])).push(lit);
      c.parts.forEach(function (p, i) {
        if (i > 0 && p.lit) (idx[p.lit[0]] || (idx[p.lit[0]] = [])).push(p.lit);
      });
    });
    vocab._phraseFirst = idx;
    return idx;
  }

  /* =====================================================================
   * Block structure (for auto-indent, auto "end", formatting)
   * ===================================================================== */

  /**
   * For each line, what it does to the blocks (for auto-indent, auto "end" / "}", formatting):
   *   kind:   'open'   opens an end-style block ("if x then", "when Button1 clicked")
   *           'close'  "end ..."
   *           'middle' "else", "else if x then", "on error": closes one part, opens the next
   *           'plain' / 'blank'
   *   block:  the kind of block it opens or closes ('if', 'repeat'...)
   *   lead:   brackets ) ] } at the start of the line (they close blocks before it)
   *   closes: brackets it closes after other text ("x = 1 }")
   *   opens:  ( [ { it leaves open at the end of the line
   *   brace:  it leaves a { open (a block in { })
   */
  L.lineKinds = function (src, vocab) {
    vocab = vocab || L.getVocab(['en']);
    var lines = src.split('\n');
    var lx = lex(src);
    var byLine = lines.map(function () { return []; });
    lx.tokens.forEach(function (t) {
      if (t.t === 'nl' || t.t === 'eof') return;
      if (byLine[t.line - 1]) byLine[t.line - 1].push(t);
    });
    // any word can be a table here: only the shape of the line matters
    var ctx = { vocab: vocab, errors: [], tables: [], tableByNorm: function (n) { return { name: n, columns: [] }; }, pageByNorm: function () { return null; } };
    var CLOSE = { ')': 1, ']': 1, '}': 1 }, OPEN = { '(': 1, '[': 1, '{': 1 };
    var kinds = byLine.map(function (toks) {
      if (!toks.length) return { kind: 'blank', lead: 0, closes: 0, opens: 0 };
      var lead = 0;
      while (lead < toks.length && toks[lead].t === 'op' && CLOSE[toks[lead].v]) lead++;
      var stack = [], closes = 0;
      for (var i = lead; i < toks.length; i++) {
        var t = toks[i];
        if (t.t !== 'op') continue;
        if (OPEN[t.v]) stack.push(t.v);
        else if (CLOSE[t.v]) { if (stack.length) stack.pop(); else closes++; }
      }
      var k = { kind: 'plain', lead: lead, closes: closes, opens: stack.length, brace: stack.indexOf('{') >= 0 };
      var rest = toks.slice(lead);
      if (!rest.length) return k;
      var hasBrace = rest.some(function (x) { return x.t === 'op' && (x.v === '{' || x.v === '}'); });
      var p = new Parser(rest.concat([{ t: 'nl', v: '', line: 0, col: 0, pos: 0, end: 0 }, { t: 'eof', v: '', line: 0, col: 0, pos: 0, end: 0 }]), ctx);
      if (p.is('end')) {
        p.eat('end');
        var kw = null;
        Object.keys(BLOCK_END_WORDS).forEach(function (b) { if (!kw && p.is(b)) kw = b; });
        if (!kw && p.is('foreach')) kw = 'for';
        k.kind = 'close';
        k.block = kw;
        return k;
      }
      if (p.is('case') || (p.is('default') && p.isOp(':', p.m('default')))) {
        // case 1: / default: - the lines after it go one step in
        k.kind = 'case';
        return k;
      }
      if (hasBrace || lead) return k;
      if (p.is('else') || p.is('onerror')) {
        // "else", "else if x then", "on error", "catch (e)": the middle of an end-style block
        var middle = false;
        try {
          if (p.is('else')) {
            p.eat('else');
            if (p.is('if')) p.headIf();
          } else {
            p.eat('onerror');
            p.parseCatchName();
          }
          middle = p.isNL();
        } catch (e) {
          if (!(e instanceof WzError)) throw e;
          middle = true;
        }
        if (middle) k.kind = 'middle';
        return k;
      }
      var opener = p.openerAt(0);
      if (opener) { k.kind = 'open'; k.block = opener; }
      return k;
    });
    // Allman style: when the { is alone on the next line, the header line doesn't open the block itself
    for (var i = 0; i < kinds.length; i++) {
      if (kinds[i].kind !== 'open' && kinds[i].kind !== 'middle') continue;
      var j = i + 1;
      while (j < kinds.length && kinds[j].kind === 'blank') j++;
      var f = byLine[j] && byLine[j][0];
      if (f && f.t === 'op' && f.v === '{') { kinds[i].kind = 'plain'; kinds[i].block = null; }
    }
    return kinds;
  };

  /** How deep each line should be indented (in steps of 4 spaces). */
  L.indents = function (src, vocab) {
    var kinds = L.lineKinds(src, vocab);
    var units = [], out = [];
    // brackets close the indent steps they opened (an end-style block left open inside closes too)
    function closeB(n) {
      while (n > 0 && units.length) {
        var u = units[units.length - 1];
        if (u.end) { units.pop(); continue; }
        u.n--;
        n--;
        if (u.n <= 0) units.pop();
      }
    }
    kinds.forEach(function (k) {
      if (k.lead) closeB(k.lead);
      if (k.kind === 'close' && units.length && units[units.length - 1].end) units.pop();
      if (k.kind === 'case' && units.length && units[units.length - 1].kase) units.pop();
      var depth = units.length;
      if (k.kind === 'middle') depth = Math.max(0, depth - 1);
      out.push(depth);
      if (k.closes) closeB(k.closes);
      if (k.opens) units.push({ n: k.opens });     // one step, however many brackets the line opens
      if (k.kind === 'open') units.push({ end: true });
      if (k.kind === 'case') units.push({ end: true, kase: true });
    });
    return out;
  };

  /** Re-indent code with 4 spaces per block. */
  L.format = function (src, vocab) {
    var depths = L.indents(src, vocab);
    var inComment = commentLines(src);
    return src.split('\n').map(function (ln, i) {
      var t = ln.trim();
      if (!t) return '';
      if (inComment[i]) return ln.replace(/\s+$/, '');   // inside a /* */ note: keep it as it is
      return new Array(depths[i] + 1).join('    ') + t;
    }).join('\n');
  };
  /** The lines that start inside a multi-line note (slash-star ... star-slash). */
  function commentLines(src) {
    var out = {}, lx = lex(src, { comments: true });
    lx.comments.forEach(function (c) {
      var first = src.slice(0, c.pos).split('\n').length - 1;
      var last = src.slice(0, c.end).split('\n').length - 1;
      for (var l = first + 1; l <= last; l++) out[l] = true;
    });
    return out;
  }

  /** The words that close a block: "end if", "end repeat"... ("}" for a { } block) */
  L.endFor = function (block, vocab) {
    if (block === 'brace') return '}';
    vocab = vocab || L.getVocab(['en']);
    var kw = block === 'while' ? 'repeat' : block;
    return vocab.say('end') + ' ' + vocab.sayShort(kw);
  };

  /* =====================================================================
   * Small API for the IDE
   * ===================================================================== */

  /** Snippet of an event handler: when Button1 clicked { ... } */
  L.handlerSnippet = function (controlName, eventKey, vocab) {
    vocab = vocab || L.getVocab(['en']);
    return vocab.say('when') + ' ' + controlName + ' ' + vocab.say('ev.' + eventKey) + ' {\n    \n}';
  };
  L.loadSnippet = function (vocab) {
    vocab = vocab || L.getVocab(['en']);
    return vocab.say('when') + ' ' + vocab.say('pageloads') + ' {\n    \n}';
  };

  // packs loaded before this file wait in Wemazy.pendingPacks
  if (W.pendingPacks) {
    W.pendingPacks.forEach(function (p) { L.registerPack(p); });
    W.pendingPacks = [];
  }

  L.Parser = Parser;
  L.WzError = WzError;
  L._internals = { lex: lex, Parser: Parser, Gen: Gen, parsePattern: parsePattern, assignedNames: assignedNames };

  if (typeof module !== 'undefined' && module.exports) module.exports = W;
})(typeof window !== 'undefined' ? window : globalThis);
