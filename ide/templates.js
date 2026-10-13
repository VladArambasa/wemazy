/*!
 * Wemazy IDE - project templates (examples to start from).
 * The code is always Wemazy Script (English); the texts the visitors read are in
 * English or Romanian, like the interface.
 */
(function (root) {
  'use strict';
  var W = root.Wemazy = root.Wemazy || {};
  var U = W.util, P = W.Project;

  /** A control. name may be given (it is used by the code of the template). */
  function el(type, props, children, name) {
    var e = { id: U.uid('e'), type: type, props: props || {}, name: name || '' };
    if (W.controls.isContainer(e)) e.children = children || [];
    return e;
  }
  function cols(count, columns, props) {
    var c = el('Columns', Object.assign({ count: String(count) }, props || {}));
    c.children = columns.map(function (kids) { return el('Column', { layout: 'stack', gap: 12 }, kids); });
    return c;
  }
  /** Give names to the controls that have none. */
  function nameAll(project, page) {
    P.walk(page.root, function (x) {
      if (x === page.root || x.name) return;
      x.name = P.uniqueName(project, page, P.prefixFor(project, x.type));
    });
  }
  function page(project, name, title, children, code, extra) {
    var pg = { id: U.uid('pg'), name: name, title: title || name, description: '', inMenu: true, root: P.newRoot(), code: code || '' };
    Object.assign(pg, extra || {});
    pg.root.children = children;
    project.pages.push(pg);
    nameAll(project, pg);
    return pg;
  }
  function start(name, lang, theme) {
    var p = P.create(name, { lang: lang });
    p.settings.theme = Object.assign({ preset: theme, width: 1100 }, P.THEMES[theme]);
    return p;
  }
  /** A text in the language of the site: tr('Hello', 'Salut'). */
  function texts(lang) { return function (en, ro) { return lang === 'ro' ? ro : en; }; }
  /** A text for inside the code: "..." with the quotes escaped. */
  function q(s) { return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\{/g, '\\{') + '"'; }

  var T = {};

  T.blank = {
    icon: 'new',
    make: function (lang, name) {
      var tr = texts(lang);
      var p = start(name || tr('New website', 'Site nou'), lang, 'clean');
      page(p, 'Home', tr('Home', 'Acasă'), [
        el('Section', { layout: 'stack', gap: 16, padding: 48, align: 'left' }, [
          el('Heading', { text: tr('Welcome!', 'Bun venit!'), level: '1' }),
          el('Text', { text: tr('Drag controls from the Toolbox onto the page. Press F5 to see your site.', 'Trage controale din Trusa de instrumente pe pagină. Apasă F5 ca să vezi site-ul.') })
        ])
      ]);
      return p;
    }
  };

  T.personal = {
    icon: 'user',
    make: function (lang, name) {
      var tr = texts(lang);
      var p = start(name || tr('My page', 'Pagina mea'), lang, 'ocean');
      var nav = function () { return el('NavBar', { brand: tr('Alex Morgan', 'Ana Popescu'), sticky: true }); };
      page(p, 'Home', tr('Home', 'Acasă'), [
        nav(),
        el('Section', { layout: 'stack', gap: 20, padding: '72 20', align: 'center', background: 'var(--wz-surface)' }, [
          el('Heading', { text: tr("Hi, I'm Alex", 'Salut, eu sunt Ana'), level: '1' }),
          el('Text', { text: tr('I like astronomy, robots and drawing. These are my projects.', 'Îmi plac astronomia, robotica și desenul. Aici sunt proiectele mele.'), size: 20 }),
          el('Button', { text: tr('See my projects', 'Vezi proiectele'), href: 'Projects' })
        ]),
        el('Section', { layout: 'stack', gap: 24, padding: 56 }, [
          el('Heading', { text: tr('What I like', 'Ce îmi place'), level: '2' }),
          cols(3, [
            [el('Heading', { text: tr('Stars', 'Stele'), level: '3' }), el('Text', { text: tr('I have a small telescope and I count falling stars in August.', 'Am un telescop mic și număr stelele căzătoare în august.') })],
            [el('Heading', { text: tr('Robots', 'Roboți'), level: '3' }), el('Text', { text: tr('I build robots from LEGO parts and program them.', 'Construiesc roboți din piese LEGO și îi programez.') })],
            [el('Heading', { text: tr('Drawing', 'Desen'), level: '3' }), el('Text', { text: tr('I draw comics about my cat.', 'Desenez benzi desenate despre pisica mea.') })]
          ])
        ]),
        el('Section', { layout: 'stack', gap: 12, padding: 56, align: 'left', contentWidth: 'narrow' }, [
          el('Heading', { text: tr('Write to me', 'Scrie-mi'), level: '2' }),
          el('TextBox', { label: tr('Your name', 'Numele tău'), placeholder: tr('Name', 'Numele') }, null, 'NameBox'),
          el('TextArea', { label: tr('Message', 'Mesajul'), placeholder: tr('Write here', 'Scrie aici'), rows: 4 }, null, 'MessageBox'),
          el('Button', { text: tr('Send', 'Trimite') }, null, 'SendButton')
        ]),
        el('Section', { padding: 24, background: '#0f2433', color: '#d6e6f2', align: 'center' }, [
          el('Text', { text: tr('© 2026 Alex Morgan · Made with Wemazy', '© 2026 Ana Popescu · Făcut cu Wemazy'), size: 14 })
        ])
      ], [
        '// Code of the Home page',
        'when SendButton clicked {',
        '    if (NameBox.text.empty()) {',
        '        message(' + q(tr('Please write your name.', 'Scrie-ți numele, te rog.')) + ')',
        '        NameBox.focus()',
        '        return',
        '    }',
        '    message(' + q(tr('Thank you, ', 'Mulțumesc, ')) + ' + NameBox.text + ' + q(tr('! I got your message.', '! Am primit mesajul.')) + ')',
        '    MessageBox.clear()',
        '}'
      ].join('\n'));
      page(p, 'Projects', tr('Projects', 'Proiecte'), [
        nav(),
        el('Section', { layout: 'stack', gap: 24, padding: 56 }, [
          el('Heading', { text: tr('My projects', 'Proiectele mele'), level: '1' }),
          cols(2, [
            [el('Card', { gap: 10 }, [el('Image', { src: '', alt: '' }), el('Heading', { text: tr('The robot that avoids walls', 'Robotul care ocolește pereții'), level: '3' }), el('Text', { text: tr('It uses an ultrasonic sensor.', 'Folosește un senzor ultrasonic.') })])],
            [el('Card', { gap: 10 }, [el('Image', { src: '', alt: '' }), el('Heading', { text: tr('Sky map', 'Harta cerului'), level: '3' }), el('Text', { text: tr('The autumn constellations, drawn by me.', 'Constelațiile de toamnă, desenate de mine.') })])]
          ])
        ])
      ]);
      return p;
    }
  };

  T.guestbook = {
    icon: 'database',
    make: function (lang, name) {
      var tr = texts(lang);
      var p = start(name || tr('Guestbook', 'Carte de oaspeți'), lang, 'forest');
      p.tables.push({ id: U.uid('t'), name: 'Messages', columns: [{ name: 'name', type: 'text' }, { name: 'message', type: 'longtext' }, { name: 'posted', type: 'text' }],
        rows: [{ name: tr('Teacher', 'Profesoara'), message: tr('Welcome to our guestbook!', 'Bine ați venit în cartea noastră de oaspeți!'), posted: '2026-10-13 09:00' }] });
      page(p, 'Home', tr('Guestbook', 'Carte de oaspeți'), [
        el('Section', { layout: 'stack', gap: 14, padding: 48, contentWidth: 'narrow', align: 'stretch' }, [
          el('Heading', { text: tr('Guestbook', 'Carte de oaspeți'), level: '1' }),
          el('Text', { text: tr('Leave a message. Messages are kept in a database.', 'Lasă un mesaj. Mesajele sunt păstrate într-o bază de date.') }),
          el('TextBox', { label: tr('Name', 'Numele'), placeholder: tr('Your name', 'Numele tău') }, null, 'NameBox'),
          el('TextArea', { label: tr('Message', 'Mesajul'), rows: 3, placeholder: tr('Write something nice', 'Scrie ceva frumos') }, null, 'MessageBox'),
          el('Button', { text: tr('Sign the book', 'Semnează') }, null, 'SignButton'),
          el('Divider', {}),
          el('Heading', { text: tr('Messages', 'Mesaje'), level: '2' }),
          el('Table', { columns: 'name, message, posted', headers: tr('Name, Message, Date', 'Nume, Mesaj, Data'), tableRows: '', striped: true }, null, 'MessageTable'),
          el('Text', { text: '', color: 'var(--wz-muted)', size: 14 }, null, 'CountLabel')
        ])
      ], [
        'function showMessages() {',
        '    MessageTable.data = find all Messages order by id descending',
        '    CountLabel.text = ' + q(tr('Messages: ', 'Mesaje: ')) + ' + Messages.count()',
        '}',
        '',
        'when page loads {',
        '    showMessages()',
        '}',
        '',
        'when SignButton clicked {',
        '    if (NameBox.text.empty() || MessageBox.text.empty()) {',
        '        message(' + q(tr('Please write your name and a message.', 'Scrie numele și mesajul.')) + ')',
        '        return',
        '    }',
        '    Messages.add({name: NameBox.text, message: MessageBox.text, posted: now})',
        '    MessageBox.clear()',
        '    notice(' + q(tr('Thank you!', 'Mulțumim!')) + ')',
        '    showMessages()',
        '}'
      ].join('\n'));
      return p;
    }
  };

  T.quiz = {
    icon: 'help',
    make: function (lang, name) {
      var tr = texts(lang);
      var p = start(name || tr('Geography quiz', 'Test de geografie'), lang, 'candy');
      page(p, 'Home', tr('Quiz', 'Test'), [
        el('Section', { layout: 'stack', gap: 16, padding: 48, contentWidth: 'narrow', align: 'center' }, [
          el('Heading', { text: tr('Geography quiz', 'Test de geografie'), level: '1' }),
          el('ProgressBar', { value: 0, max: 100 }, null, 'Progress'),
          el('Heading', { text: '...', level: '2' }, null, 'Question'),
          el('Panel', { layout: 'row', gap: 10, align: 'center', padding: 0 }, [
            el('Button', { text: 'A' }, null, 'Answer1'),
            el('Button', { text: 'B' }, null, 'Answer2'),
            el('Button', { text: 'C' }, null, 'Answer3')
          ]),
          el('Text', { text: '', size: 20, bold: true }, null, 'ScoreLabel'),
          el('Button', { text: tr('Play again', 'Încă o dată'), visible: false }, null, 'AgainButton')
        ])
      ], [
        'var questions = [',
        '    {text: ' + q(tr('What is the capital of Romania?', 'Care este capitala României?')) + ', answers: ["Cluj", ' + q(tr('Bucharest', 'București')) + ', ' + q(tr('Iasi', 'Iași')) + '], good: 2},',
        '    {text: ' + q(tr('Which river flows past Galati?', 'Ce fluviu trece prin Galați?')) + ', answers: [' + q(tr('Danube', 'Dunărea')) + ', ' + q(tr('Mures', 'Mureș')) + ', "Olt"], good: 1},',
        '    {text: ' + q(tr('The highest peak in Romania?', 'Cel mai înalt vârf din România?')) + ', answers: ["Omu", ' + q(tr('Ceahlau', 'Ceahlău')) + ', "Moldoveanu"], good: 3}',
        ']',
        'var number = 1',
        'var score = 0',
        '',
        'function showQuestion() {',
        '    var q = questions[number]',
        '    Question.text = q.text',
        '    Answer1.text = q.answers[1]',
        '    Answer2.text = q.answers[2]',
        '    Answer3.text = q.answers[3]',
        '    Progress.value = (number - 1) * 100 / questions.length',
        '}',
        '',
        'function answer(chosen) {',
        '    if (chosen == questions[number].good) {',
        '        score++',
        '        notice(' + q(tr('Right!', 'Corect!')) + ')',
        '    } else {',
        '        notice(' + q(tr('Wrong...', 'Greșit...')) + ')',
        '    }',
        '    number++',
        '    if (number > questions.length) {',
        '        Progress.value = 100',
        '        Question.text = ' + q(tr('Done!', 'Gata!')),
        '        ScoreLabel.text = ' + q(tr('Score: ', 'Scor: ')) + ' + score + ' + q(tr(' of ', ' din ')) + ' + questions.length',
        '        if (score > recall("best")) remember("best", score)',
        '        Answer1.hide()',
        '        Answer2.hide()',
        '        Answer3.hide()',
        '        AgainButton.show()',
        '    } else {',
        '        showQuestion()',
        '    }',
        '}',
        '',
        'when page loads {',
        '    showQuestion()',
        '}',
        '',
        'when Answer1 clicked {',
        '    answer(1)',
        '}',
        '',
        'when Answer2 clicked {',
        '    answer(2)',
        '}',
        '',
        'when Answer3 clicked {',
        '    answer(3)',
        '}',
        '',
        'when AgainButton clicked {',
        '    number = 1',
        '    score = 0',
        '    ScoreLabel.text = ""',
        '    Answer1.show()',
        '    Answer2.show()',
        '    Answer3.show()',
        '    AgainButton.hide()',
        '    showQuestion()',
        '}'
      ].join('\n'));
      return p;
    }
  };

  T.calculator = {
    icon: 'c-free',
    make: function (lang, name) {
      var tr = texts(lang);
      var p = start(name || 'Calculator', lang, 'clean');
      var form = el('Panel', { layout: 'free', formWidth: 420, formHeight: 330, background: 'var(--wz-surface)', radius: 12, border: 1, borderColor: 'var(--wz-border)', padding: 0 }, [
        el('Heading', { text: 'Calculator', level: '3', x: 24, y: 20, width: 372 }),
        el('TextBox', { placeholder: tr('first number', 'primul număr'), x: 24, y: 72, width: 172, height: 44 }, null, 'Number1'),
        el('TextBox', { placeholder: tr('second number', 'al doilea număr'), x: 224, y: 72, width: 172, height: 44 }, null, 'Number2'),
        el('Button', { text: '+', x: 24, y: 136, width: 80, height: 48, size: 22 }, null, 'PlusButton'),
        el('Button', { text: '−', x: 120, y: 136, width: 80, height: 48, size: 22 }, null, 'MinusButton'),
        el('Button', { text: '×', x: 216, y: 136, width: 80, height: 48, size: 22 }, null, 'TimesButton'),
        el('Button', { text: '÷', x: 312, y: 136, width: 84, height: 48, size: 22 }, null, 'DivideButton'),
        el('Heading', { text: '= ?', level: '2', x: 24, y: 216, width: 372 }, null, 'Result')
      ], 'Form1');
      page(p, 'Home', 'Calculator', [
        el('Section', { layout: 'stack', gap: 16, padding: 48, align: 'center' }, [
          form,
          el('Text', { text: tr('A free-form panel, like Windows Forms: controls stay exactly where you put them.', 'Un formular liber, ca în Windows Forms: controalele stau exact unde le pui.'), color: 'var(--wz-muted)', size: 15 })
        ])
      ], [
        'function calculate(sign) {',
        '    if (!Number1.text.isNumber() || !Number2.text.isNumber()) {',
        '        Result.text = ' + q(tr('Type two numbers', 'Scrie două numere')),
        '        return',
        '    }',
        '    var a = Number1.text.toNumber()',
        '    var b = Number2.text.toNumber()',
        '    var r = 0',
        '    if (sign == "+") r = a + b',
        '    if (sign == "-") r = a - b',
        '    if (sign == "*") r = a * b',
        '    if (sign == "/") {',
        '        if (b == 0) {',
        '            Result.text = ' + q(tr("Can't divide by 0", 'Nu se împarte la 0')),
        '            return',
        '        }',
        '        r = a / b',
        '    }',
        '    Result.text = "= " + r.round(4)',
        '}',
        '',
        'when PlusButton clicked {',
        '    calculate("+")',
        '}',
        '',
        'when MinusButton clicked {',
        '    calculate("-")',
        '}',
        '',
        'when TimesButton clicked {',
        '    calculate("*")',
        '}',
        '',
        'when DivideButton clicked {',
        '    calculate("/")',
        '}'
      ].join('\n'));
      return p;
    }
  };

  T.members = {
    icon: 'lock',
    make: function (lang, name) {
      var tr = texts(lang);
      var p = start(name || tr('Members area', 'Zona membrilor'), lang, 'night');
      p.tables.push({ id: U.uid('t'), name: 'Users', columns: [{ name: 'name', type: 'text' }, { name: 'password', type: 'text' }, { name: 'joined', type: 'text' }], rows: [] });
      var navEl = function () { return el('NavBar', { brand: tr('Our club', 'Clubul nostru'), sticky: true }); };
      page(p, 'Home', tr('Sign in', 'Intră'), [
        navEl(),
        el('Section', { layout: 'stack', gap: 14, padding: 56, contentWidth: 'narrow', align: 'stretch' }, [
          el('Heading', { text: tr('Sign in to the club', 'Intră în club'), level: '1' }),
          el('TextBox', { label: tr('Name', 'Nume') }, null, 'NameBox'),
          el('TextBox', { label: tr('Password', 'Parolă'), inputType: 'password' }, null, 'PasswordBox'),
          el('Panel', { layout: 'row', gap: 10, padding: 0 }, [
            el('Button', { text: tr('Sign in', 'Intră') }, null, 'SignInButton'),
            el('Button', { text: tr('Make an account', 'Fă-ți cont'), background: 'transparent', color: 'var(--wz-primary)', border: 1, borderColor: 'var(--wz-primary)' }, null, 'SignUpButton')
          ]),
          el('Text', { text: '' }, null, 'StatusLabel')
        ])
      ], [
        '// The buttons send the name and password to the server; the server checks them.',
        'when SignUpButton clicked {',
        '    StatusLabel.text = makeAccount(NameBox.text, PasswordBox.text)',
        '}',
        '',
        'when SignInButton clicked {',
        '    if (signIn(NameBox.text, PasswordBox.text)) {',
        '        goTo("Secret")',
        '    } else {',
        '        StatusLabel.text = ' + q(tr('Wrong name or password.', 'Nume sau parolă greșită.')),
        '    }',
        '}'
      ].join('\n'));
      page(p, 'Secret', tr('Secret page', 'Pagina secretă'), [
        navEl(),
        el('Section', { layout: 'stack', gap: 14, padding: 56, contentWidth: 'narrow' }, [
          el('Heading', { text: '...', level: '1' }, null, 'Hello'),
          el('Text', { text: tr('Only members can see this page.', 'Doar membrii văd această pagină.') }),
          el('Button', { text: tr('Sign out', 'Ieși') }, null, 'SignOutButton')
        ])
      ], [
        'when page loads {',
        '    var who = whoAmI()',
        '    if (who.empty()) {',
        '        goTo("Home")',
        '    } else {',
        '        Hello.text = ' + q(tr('Hello, ', 'Salut, ')) + ' + who + "!"',
        '    }',
        '}',
        '',
        'when SignOutButton clicked {',
        '    signOut()',
        '    goTo("Home")',
        '}'
      ].join('\n'), { inMenu: false });
      p.siteCode = [
        '// Server functions run on the server (PHP), not in the page:',
        "// passwords never reach anybody else's browser.",
        '',
        'server function makeAccount(who, secret) {',
        '    if (who.empty() || secret.length < 4) {',
        '        return ' + q(tr('Choose a name and a password of at least 4 letters.', 'Alege un nume și o parolă de cel puțin 4 litere.')),
        '    }',
        '    if ((count Users where name == who) > 0) {',
        '        return ' + q(tr('That name is already taken.', 'Numele este deja folosit.')),
        '    }',
        '    Users.add({name: who, password: hash(secret), joined: today})',
        '    return ' + q(tr('Account made! Now you can sign in.', 'Cont făcut! Acum poți intra.')),
        '}',
        '',
        'server function signIn(who, secret) {',
        '    var u = find first Users where name == who',
        '    if (u.empty()) return false',
        '    if (checkHash(secret, u.password)) {',
        '        session.user = u.name',
        '        return true',
        '    }',
        '    return false',
        '}',
        '',
        'server function whoAmI() {',
        '    return session.user',
        '}',
        '',
        'server function signOut() {',
        '    session.clear()',
        '}'
      ].join('\n');
      return p;
    }
  };

  T.classpage = {
    icon: 'home',
    make: function (lang, name) {
      var tr = texts(lang);
      var p = start(name || tr('Our class', 'Pagina clasei'), lang, 'school');
      p.tables.push({ id: U.uid('t'), name: 'Pupils', columns: [{ name: 'name', type: 'text' }, { name: 'points', type: 'integer' }],
        rows: (lang === 'ro' ? ['Andrei', 'Bianca', 'Carla', 'David', 'Elena', 'Filip'] : ['Andrew', 'Bianca', 'Carla', 'David', 'Ellen', 'Philip']).map(function (n) { return { name: n, points: 0 }; }) });
      page(p, 'Home', tr('Class 6B', 'Clasa a VI-a B'), [
        el('NavBar', { brand: tr('Class 6B', 'Clasa a VI-a B'), sticky: true }),
        el('Section', { layout: 'stack', gap: 18, padding: 48, align: 'center' }, [
          el('Heading', { text: tr('Who answers now?', 'Cine răspunde acum?'), level: '1' }),
          el('Heading', { text: '?', level: '1', size: 64, color: 'var(--wz-primary)' }, null, 'PupilName'),
          el('Panel', { layout: 'row', gap: 10, align: 'center', padding: 0 }, [
            el('Button', { text: tr('Pick a pupil', 'Alege un elev') }, null, 'PickButton'),
            el('Button', { text: tr('+1 point', '+1 punct'), background: 'transparent', color: 'var(--wz-primary)', border: 1, borderColor: 'var(--wz-primary)' }, null, 'PointButton')
          ]),
          el('Table', { columns: 'name, points', headers: tr('Pupil, Points', 'Elev, Puncte'), tableRows: '', maxWidth: 480 }, null, 'PupilTable')
        ])
      ], [
        'var picked = null',
        '',
        'function showRanking() {',
        '    PupilTable.data = find all Pupils order by points descending, name',
        '}',
        '',
        'when page loads {',
        '    showRanking()',
        '}',
        '',
        'when PickButton clicked {',
        '    var pupils = find all Pupils',
        '    repeat 12 times {',
        '        PupilName.text = pupils.pick().name',
        '        wait(80)   // milliseconds',
        '    }',
        '    picked = pupils.pick()',
        '    PupilName.text = picked.name',
        '    speak(picked.name)',
        '}',
        '',
        'when PointButton clicked {',
        '    if (picked.empty()) {',
        '        message(' + q(tr('Pick a pupil first.', 'Alege întâi un elev.')) + ')',
        '        return',
        '    }',
        '    update Pupils set points = points + 1 where id == picked.id',
        '    showRanking()',
        '}'
      ].join('\n'));
      return p;
    }
  };

  W.templates = {
    order: ['blank', 'personal', 'guestbook', 'quiz', 'calculator', 'members', 'classpage'],
    list: T,
    /** lang: the language of the texts of the site ('en' or 'ro'). */
    make: function (id, lang, name) {
      var t = T[id] || T.blank;
      var p = t.make(lang === 'ro' ? 'ro' : 'en', name);
      p.template = id;
      return P.normalize(p);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
