/*!
 * Wemazy runtime - PHP
 * --------------------
 * The PHP twin of runtime/core.js + runtime/server.js. Exported sites get it as
 * wemazy/runtime.php. It needs PHP 8.1+ and, for the database, PDO with SQLite
 * (default) or MySQL/MariaDB. No framework, no Composer.
 *
 * Kept as text inside a .js file so that Wemazy can copy it into exported sites
 * even when it is opened straight from a folder (file://). Edit the PHP between
 * the backticks; keep the rules the same as runtime/core.js.
 */
(function (root) {
  'use strict';
  var W = root.Wemazy = root.Wemazy || {};
  W.runtime = W.runtime || {};

  W.runtime.php = String.raw`<?php
/*
 * Wemazy runtime for PHP - made by Wemazy (https://github.com/) - MIT licence.
 * Used by api.php. You don't need to change anything here: settings are in config.php.
 */

if (defined('WZ_RUNTIME')) { return; }
define('WZ_RUNTIME', '1.0.0');

class WzError extends Exception {}

$GLOBALS['wz_log'] = [];
$GLOBALS['wz_where'] = ['', 0];

/* ------------------------------------------------------------------ settings */

function wz_config() {
    static $cfg = null;
    if ($cfg !== null) { return $cfg; }
    $cfg = [
        'db' => 'sqlite',
        'sqlite_file' => dirname(__DIR__) . '/data/site.sqlite',
        'mysql_host' => 'localhost',
        'mysql_port' => 3306,
        'mysql_database' => '',
        'mysql_user' => '',
        'mysql_password' => '',
        'debug' => false,
        'lang' => 'en',
        'timezone' => '',
    ];
    $file = dirname(__DIR__) . '/config.php';
    if (is_file($file)) {
        $user = include $file;
        if (is_array($user)) { $cfg = array_merge($cfg, $user); }
    }
    if ($cfg['timezone'] !== '') { @date_default_timezone_set($cfg['timezone']); }
    return $cfg;
}

/* ------------------------------------------------------------------ messages */

function wz_msg($key, $args = []) {
    static $M = [
        'en' => [
            'notNumber' => "'{0}' is not a number.",
            'emptyNotNumber' => 'An empty text is not a number.',
            'divZero' => "You can't divide by zero.",
            'noItem' => 'There is no item {0} (the list has {1}).',
            'noLetter' => 'There is no letter {0} (the text has {1}).',
            'badIndex' => "'{0}' can't be used as a position. Use a whole number like 1, 2, 3.",
            'nothingItems' => 'This value is nothing, so it has no item {0}.',
            'notList' => '{0} is not a list, so it has no items.',
            'nothingField' => "This value is nothing, so it has no field '{0}'.",
            'noField' => "{0} has no field '{1}'.",
            'cantSetField' => "Can't put a field '{0}' into {1}: only records have fields.",
            'cantSetItem' => "Can't change item {0} of {1}: it is not a list.",
            'badStep' => 'The step of a for loop can not be 0.',
            'notJson' => 'This text is not valid JSON: {0}',
            'cantAdd' => "Can't add {0} to {1}.",
            'badDate' => "'{0}' is not a date. Write dates like 2026-10-13.",
            'noTable' => "There is no table called '{0}'.",
            'noColumn' => "The table {0} has no column '{1}'.",
            'notRecord' => 'To add a row to {0}, give a record like {name: "Ana"}.',
            'noFunction' => "There is no server function called '{0}'.",
            'noQuery' => 'This page is older than the server code. Upload the whole site again.',
            'noPdo' => 'This server has no PDO {0} for PHP, so the database can not be used. Ask your host to turn it on, or choose another database in config.php.',
            'dbOpen' => 'The database could not be opened: {0}',
            'fetchFail' => 'Could not download {0}.',
            'serverError' => 'Something went wrong on the server.',
            'int64Range' => "{0} doesn't fit in {1}: Wemazy keeps 64-bit whole numbers exactly only from -9007199254740991 to 9007199254740991.",
            'notWhole' => "{0} can't be put in {1}.",
            'badCharCode' => '{0} is not the code of a character.',
            'notOneChar' => "A char holds one character, but '{0}' is not one character.",
            'noType' => "There is no type called '{0}'.",
            'notStruct' => "{0} can't be put in a {1}: give a record like {x: 1}.",
            'noFieldIn' => "{0} has no field '{1}'.",
            'tooManyValues' => '{0} has only {1} field(s).',
            'unionOneField' => 'A union holds one field at a time: give one value for {0}.',
            'notInstance' => '{0} is not a {1}.',
            'noMember' => "{0} has no member '{1}'.",
            'privateMember' => "'{0}' is private in {1}: only the code of {1} can use it.",
            'protectedMember' => "'{0}' is protected in {1}: only the code of {1} and of the classes that inherit from it can use it.",
            'noMethod' => "{0} has no method '{1}'.",
            'nothingMethod' => "This value is nothing, so it has no method '{0}'.",
            'abstractNew' => '{0} is abstract: make an object of a class that inherits from it.',
            'shiftRange' => 'You can shift by 0 to {0} bits, not by {1}.',
            'notIntBits' => "'{0}' only works with whole numbers (int types).",
            'constChange' => "{0} is a constant and can't be changed.",
            'noItem0' => 'There is no item 0: the items of a list are counted from 1 (the first one is list[1]).',
        ],
        'ro' => [
            'notNumber' => "'{0}' nu este un număr.",
            'emptyNotNumber' => 'Un text gol nu este un număr.',
            'divZero' => 'Nu se poate împărți la zero.',
            'noItem' => 'Nu există elementul {0} (lista are {1}).',
            'noLetter' => 'Nu există litera {0} (textul are {1}).',
            'badIndex' => "'{0}' nu poate fi folosit ca poziție. Folosește un număr întreg: 1, 2, 3.",
            'nothingItems' => 'Valoarea este nothing (goală), deci nu are elementul {0}.',
            'notList' => '{0} nu este o listă, deci nu are elemente.',
            'nothingField' => "Valoarea este nothing (goală), deci nu are câmpul '{0}'.",
            'noField' => "{0} nu are câmpul '{1}'.",
            'cantSetField' => "Nu pot pune câmpul '{0}' în {1}: doar înregistrările au câmpuri.",
            'cantSetItem' => 'Nu pot schimba elementul {0} din {1}: nu este o listă.',
            'badStep' => 'Pasul unei bucle for nu poate fi 0.',
            'notJson' => 'Textul acesta nu este JSON valid: {0}',
            'cantAdd' => 'Nu pot adăuga {0} la {1}.',
            'badDate' => "'{0}' nu este o dată. Scrie datele așa: 2026-10-13.",
            'noTable' => "Nu există niciun tabel numit '{0}'.",
            'noColumn' => "Tabelul {0} nu are coloana '{1}'.",
            'notRecord' => 'Ca să adaugi un rând în {0}, dă o înregistrare ca {nume: "Ana"}.',
            'noFunction' => "Nu există nicio funcție de server numită '{0}'.",
            'noQuery' => 'Pagina este mai veche decât codul serverului. Încarcă din nou tot site-ul.',
            'noPdo' => 'Serverul acesta nu are PDO {0} pentru PHP, deci baza de date nu poate fi folosită. Roagă firma de găzduire să-l pornească sau alege altă bază de date în config.php.',
            'dbOpen' => 'Baza de date nu a putut fi deschisă: {0}',
            'fetchFail' => 'Nu am putut descărca {0}.',
            'serverError' => 'Ceva nu a mers bine pe server.',
            'int64Range' => '{0} nu încape în {1}: Wemazy păstrează exact numerele întregi pe 64 de biți doar de la -9007199254740991 la 9007199254740991.',
            'notWhole' => '{0} nu poate fi pus în {1}.',
            'badCharCode' => '{0} nu este codul unui caracter.',
            'notOneChar' => "Un char ține un singur caracter, dar '{0}' nu este un singur caracter.",
            'noType' => "Nu există niciun tip numit '{0}'.",
            'notStruct' => '{0} nu poate fi pus într-un {1}: dă o înregistrare ca {x: 1}.',
            'noFieldIn' => "{0} nu are câmpul '{1}'.",
            'tooManyValues' => '{0} are doar {1} câmp(uri).',
            'unionOneField' => 'Un union ține un singur câmp o dată: dă o singură valoare pentru {0}.',
            'notInstance' => '{0} nu este un {1}.',
            'noMember' => "{0} nu are membrul '{1}'.",
            'privateMember' => "'{0}' este private în {1}: doar codul lui {1} îl poate folosi.",
            'protectedMember' => "'{0}' este protected în {1}: doar codul lui {1} și al claselor care moștenesc din ea îl poate folosi.",
            'noMethod' => "{0} nu are metoda '{1}'.",
            'nothingMethod' => "Valoarea este nothing (goală), deci nu are metoda '{0}'.",
            'abstractNew' => '{0} este abstractă: fă un obiect dintr-o clasă care moștenește din ea.',
            'shiftRange' => 'Poți deplasa cu 0 până la {0} biți, nu cu {1}.',
            'notIntBits' => "'{0}' merge doar cu numere întregi (tipuri int).",
            'constChange' => '{0} este o constantă și nu poate fi schimbată.',
            'noItem0' => 'Nu există elementul 0: elementele unei liste se numără de la 1 (primul este lista[1]).',
        ],
    ];
    $lang = wz_config()['lang'] ?? 'en';
    $s = $M[$lang][$key] ?? ($M['en'][$key] ?? $key);
    return preg_replace_callback('/\{(\d+)\}/', function ($m) use ($args) {
        return array_key_exists((int) $m[1], $args) ? (string) $args[(int) $m[1]] : $m[0];
    }, $s);
}

function wz_fail($key, $args = []) {
    throw new WzError(wz_msg($key, $args));
}

/* ------------------------------------------------------------------ values */

function wz_is_nothing($v) { return $v === null || (is_float($v) && is_nan($v)); }

/** An object made from a class (new Dog()): its class and its fields. */
class WzObj implements JsonSerializable {
    public $c;
    public $f = [];
    public function __construct($c) { $this->c = $c; }
    public function jsonSerialize(): mixed { return ['$class' => $this->c] + $this->f; }
}
function wz_is_obj($v) { return $v instanceof WzObj; }
function wz_is_list($v) { return is_array($v) && array_is_list($v); }
function wz_is_rec($v) { return is_array($v) && !array_is_list($v); }
function wz_is_numval($v) { return is_int($v) || is_float($v); }

function wz_num_like($v) {
    if (is_int($v)) { return true; }
    if (is_float($v)) { return is_finite($v); }
    if (!is_string($v)) { return false; }
    $s = trim($v);
    return $s !== '' && (preg_match('/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i', $s) || preg_match('/^[-+]?\d+,\d+$/', $s));
}
function wz_is_number($v) { return wz_num_like($v); }

/** A number written the way JavaScript writes it. */
function wz_js_num($r) {
    if ($r == 0.0) { return '0'; }
    $s = json_encode($r);
    if ($s === false) { return (string) $r; }
    if (stripos($s, 'e') === false) {
        if (str_ends_with($s, '.0')) { $s = substr($s, 0, -2); }
        return $s;
    }
    if (!preg_match('/^(-?)(\d+)(?:\.(\d+))?e([+-]?\d+)$/i', $s, $m)) { return $s; }
    $sign = $m[1];
    $frac = $m[3] ?? '';
    $digits = $m[2] . $frac;
    $exp = (int) $m[4] - strlen($frac);
    $trimmed = rtrim($digits, '0');
    $exp += strlen($digits) - strlen($trimmed);
    $digits = ltrim($trimmed, '0');
    if ($digits === '') { return '0'; }
    $n = strlen($digits);
    $point = $exp + $n;
    if ($point > 21 || $point < -5) {
        $e = $point - 1;
        return $sign . $digits[0] . ($n > 1 ? '.' . substr($digits, 1) : '') . 'e' . ($e >= 0 ? '+' : '-') . abs($e);
    }
    if ($point <= 0) { return $sign . '0.' . str_repeat('0', -$point) . $digits; }
    if ($point >= $n) { return $sign . $digits . str_repeat('0', $point - $n); }
    return $sign . substr($digits, 0, $point) . '.' . substr($digits, $point);
}

function wz_fmt_num($n) {
    if (is_int($n)) { return (string) $n; }
    if (is_nan($n)) { return ''; }
    if (is_infinite($n)) { return $n > 0 ? 'Infinity' : '-Infinity'; }
    if (floor($n) == $n && abs($n) < 1e15) { return $n == 0 ? '0' : sprintf('%.0f', $n); }
    if (floor($n) == $n) { return wz_js_num($n); }
    // a float32 (or float16) number: the shortest digits that give the same float32 (0.1, not 0.100000001490116)
    if (wz_f32($n) === $n) {
        for ($p = 1; $p <= 9; $p++) {
            $t = (float) sprintf('%.' . ($p - 1) . 'e', $n);
            if (wz_f32($t) === $n) { return wz_js_num($t); }
        }
    }
    return wz_js_num((float) sprintf('%.12g', $n));
}

function wz_text($v) {
    if (wz_is_nothing($v)) { return ''; }
    if (is_string($v)) { return $v; }
    if (is_int($v) || is_float($v)) { return wz_fmt_num($v); }
    if (is_bool($v)) { return $v ? 'true' : 'false'; }
    if (is_array($v)) {
        if (array_is_list($v)) {
            return implode(', ', array_map(function ($x) { return is_string($x) ? $x : wz_inner($x); }, $v));
        }
        return wz_inner($v);
    }
    if ($v instanceof WzObj) { return wz_inner($v); }
    if (is_object($v)) { return wz_inner((array) $v); }
    return (string) $v;
}
function wz_inner($v) {
    if (is_string($v)) { return '"' . $v . '"'; }
    if ($v instanceof WzObj) {
        $parts = [];
        foreach ($v->f as $k => $x) { $parts[] = $k . ': ' . wz_inner($x); }
        return $v->c . ' {' . implode(', ', $parts) . '}';
    }
    if (is_array($v) && isset($v['$u']) && isset($GLOBALS['wz_unions'][strtolower((string) $v['$u'])])) {
        $parts = [];
        foreach ($GLOBALS['wz_unions'][strtolower((string) $v['$u'])]['fields'] as $f) { $parts[] = $f[0] . ': ' . wz_inner(wz_uget($v, $f)); }
        return '{' . implode(', ', $parts) . '}';
    }
    if (is_array($v)) {
        if (array_is_list($v)) { return '[' . implode(', ', array_map('wz_inner', $v)) . ']'; }
        $parts = [];
        foreach ($v as $k => $x) { $parts[] = $k . ': ' . wz_inner($x); }
        return '{' . implode(', ', $parts) . '}';
    }
    if (wz_is_nothing($v)) { return 'nothing'; }
    return wz_text($v);
}

function wz_num($v) {
    if (is_int($v)) { return $v; }
    if (is_float($v)) { return is_nan($v) ? 0 : $v; }
    if ($v === null) { return 0; }
    if (is_bool($v)) { return $v ? 1 : 0; }
    if (is_string($v)) {
        $s = trim($v);
        if ($s === '') { wz_fail('emptyNotNumber'); }
        if (preg_match('/^[-+]?\d+,\d+$/', $s)) { $s = str_replace(',', '.', $s); }
        if (preg_match('/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i', $s)) {
            if (preg_match('/^[-+]?\d+$/', $s) && strlen($s) < 18) { return (int) $s; }
            return (float) $s;
        }
        wz_fail('notNumber', [strlen($v) > 40 ? substr($v, 0, 40) . '…' : $v]);
    }
    wz_fail('notNumber', [wz_text($v)]);
}

function wz_truthy($v) {
    if (wz_is_nothing($v) || $v === false || $v === 0 || $v === 0.0 || $v === '') { return false; }
    if (is_array($v)) { return count($v) > 0; }
    return true;
}

/* ------------------------------------------------------------------ arithmetic */

function wz_add($a, $b) {
    if (wz_is_numval($a) && wz_is_numval($b)) { return $a + $b; }
    if (wz_is_list($a)) { return array_merge($a, wz_is_list($b) ? $b : [$b]); }
    if (wz_is_nothing($a)) { return wz_num_like($b) ? wz_num($b) : (wz_is_nothing($b) ? 0 : $b); }
    if (wz_is_nothing($b)) { return wz_num_like($a) ? wz_num($a) : $a; }
    if (wz_num_like($a) && wz_num_like($b)) { return wz_num($a) + wz_num($b); }
    return wz_text($a) . wz_text($b);
}
function wz_sub($a, $b) { return wz_num($a) - wz_num($b); }
function wz_mul($a, $b) { return wz_num($a) * wz_num($b); }
function wz_div($a, $b) {
    $y = wz_num($b);
    if ($y == 0) { wz_fail('divZero'); }
    $r = wz_num($a) / $y;
    return $r;
}
function wz_mod($a, $b) {
    $x = wz_num($a); $y = wz_num($b);
    if ($y == 0) { wz_fail('divZero'); }
    if (is_int($x) && is_int($y)) {
        $r = $x % $y;
    } else {
        $r = fmod($x, $y);
    }
    if ($r != 0 && (($r < 0) !== ($y < 0))) { $r += $y; }
    return $r;
}
function wz_pow($a, $b) { return wz_num($a) ** wz_num($b); }
function wz_neg($a) { return -wz_num($a); }
function wz_cat($a, $b) { return wz_text($a) . wz_text($b); }

/* ------------------------------------------------------------------ comparing */

function wz_deep_eq($a, $b) {
    if (!is_array($a) || !is_array($b)) { return false; }
    if (array_is_list($a) !== array_is_list($b) || count($a) !== count($b)) { return false; }
    foreach ($a as $k => $v) {
        if (!array_key_exists($k, $b) || !wz_eq($v, $b[$k])) { return false; }
    }
    return true;
}
function wz_eq($a, $b) {
    if ($a instanceof WzObj || $b instanceof WzObj) { return $a === $b; }
    if ($a === $b) { return true; }
    if (wz_is_nothing($a) || wz_is_nothing($b)) { return wz_is_nothing($a) && wz_is_nothing($b); }
    if (is_bool($a) || is_bool($b)) { return wz_text($a) === wz_text($b); }
    if (wz_num_like($a) && wz_num_like($b)) { return wz_num($a) == wz_num($b); }
    if (is_array($a) || is_array($b)) { return wz_deep_eq($a, $b); }
    return wz_text($a) === wz_text($b);
}
function wz_ne($a, $b) { return !wz_eq($a, $b); }
function wz_cmp($a, $b) {
    if ((wz_num_like($a) || wz_is_nothing($a)) && (wz_num_like($b) || wz_is_nothing($b))) {
        $x = wz_num($a); $y = wz_num($b);
        return $x < $y ? -1 : ($x > $y ? 1 : 0);
    }
    $c = strcmp(wz_text($a), wz_text($b));
    return $c < 0 ? -1 : ($c > 0 ? 1 : 0);
}
function wz_lt($a, $b) { return wz_cmp($a, $b) < 0; }
function wz_le($a, $b) { return wz_cmp($a, $b) <= 0; }
function wz_gt($a, $b) { return wz_cmp($a, $b) > 0; }
function wz_ge($a, $b) { return wz_cmp($a, $b) >= 0; }

function wz_low($v) {
    $s = wz_text($v);
    return function_exists('mb_strtolower') ? mb_strtolower($s, 'UTF-8') : strtolower($s);
}
function wz_contains($a, $b) {
    if (wz_is_nothing($a)) { return false; }
    if (wz_is_list($a)) {
        foreach ($a as $x) { if (wz_eq($x, $b)) { return true; } }
        return false;
    }
    if (wz_is_rec($a)) { return wz_has($a, $b); }
    return strpos(wz_low($a), wz_low($b)) !== false;
}
function wz_starts($a, $b) { return !wz_is_nothing($a) && str_starts_with(wz_low($a), wz_low($b)); }
function wz_ends($a, $b) { return !wz_is_nothing($a) && str_ends_with(wz_low($a), wz_low($b)); }
function wz_is_empty($v) {
    if (wz_is_nothing($v)) { return true; }
    if (is_string($v)) { return trim($v) === ''; }
    if (is_array($v)) { return count($v) === 0; }
    return false;
}

/* ------------------------------------------------------------------ lists, records */

function wz_chars($s) {
    $s = wz_text($s);
    if ($s === '') { return []; }
    $r = preg_split('//u', $s, -1, PREG_SPLIT_NO_EMPTY);
    return $r === false ? str_split($s) : $r;
}
function wz_index($i, $len) {
    if (!wz_num_like($i)) { wz_fail('badIndex', [wz_text($i)]); }
    $n = wz_num($i);
    if (floor($n) != $n) { wz_fail('badIndex', [wz_text($i)]); }
    $n = (int) $n;
    if ($n === 0) { wz_fail('noItem0'); }
    if ($n < 0) { $n = $len + $n + 1; }
    return $n;
}
function wz_find_key($obj, $k) {
    $k = wz_text($k);
    if (array_key_exists($k, $obj)) { return $k; }
    $lk = wz_low($k);
    foreach ($obj as $key => $_) {
        if (wz_low((string) $key) === $lk) { return $key; }
    }
    return null;
}
function wz_i0($i) { return (int) wz_num($i) - 1; }
function wz_idx($obj, $i) {
    if (wz_is_nothing($obj)) { wz_fail('nothingItems', [wz_text($i)]); }
    if (wz_is_list($obj)) {
        $n = wz_index($i, count($obj));
        if ($n < 1 || $n > count($obj)) { wz_fail('noItem', [wz_text($i), count($obj)]); }
        return $obj[$n - 1];
    }
    if (is_string($obj)) {
        $cs = wz_chars($obj);
        $n = wz_index($i, count($cs));
        if ($n < 1 || $n > count($cs)) { wz_fail('noLetter', [wz_text($i), count($cs)]); }
        return $cs[$n - 1];
    }
    if (wz_is_rec($obj)) {
        $k = wz_find_key($obj, $i);
        return $k === null ? null : $obj[$k];
    }
    wz_fail('notList', [wz_text($obj)]);
}
function wz_set_idx(&$obj, $i, $v) {
    if (wz_is_list($obj)) {
        $n = wz_index($i, count($obj));
        if ($n < 1 || $n > count($obj) + 1) { wz_fail('noItem', [wz_text($i), count($obj)]); }
        $obj[$n - 1] = $v;
        return $obj;
    }
    if (wz_is_rec($obj)) {
        $k = wz_find_key($obj, $i);
        $obj[$k === null ? wz_text($i) : $k] = $v;
        return $obj;
    }
    wz_fail('cantSetItem', [wz_text($i), wz_is_nothing($obj) ? 'nothing' : wz_text($obj)]);
}
function wz_dot($obj, $k, $ctx = null) {
    // x.length, x.count, x.size: how many letters or items (0 for nothing, like length(nothing))
    $isLen = in_array(strtolower($k), ['length', 'count', 'size'], true);
    if (wz_is_nothing($obj)) {
        if ($isLen) { return 0; }
        wz_fail('nothingField', [$k]);
    }
    if ($obj instanceof WzObj) { return wz_oget($obj, $k, $ctx); }
    if (is_array($obj) && isset($obj['$u']) && isset($GLOBALS['wz_unions'][strtolower((string) $obj['$u'])])) { return wz_uget($obj, wz_ufield($obj, $k)); }
    if (wz_is_rec($obj) || (is_array($obj) && count($obj) === 0)) {
        $key = wz_find_key($obj, $k);
        if ($key === null && $isLen) { return wz_len($obj); }
        return $key === null ? null : $obj[$key];
    }
    if ((wz_is_list($obj) || is_string($obj)) && $isLen) { return wz_len($obj); }
    wz_fail('noField', [mb_substr_safe(wz_text($obj), 40), $k]);
}
function mb_substr_safe($s, $n) {
    return function_exists('mb_substr') ? mb_substr($s, 0, $n, 'UTF-8') : substr($s, 0, $n);
}
function wz_set_dot(&$obj, $k, $v, $ctx = null) {
    if ($obj instanceof WzObj) { wz_oset($obj, $k, $v, $ctx); return $obj; }
    if (is_array($obj) && isset($obj['$u']) && isset($GLOBALS['wz_unions'][strtolower((string) $obj['$u'])])) { wz_uput($obj, wz_ufield($obj, $k), $v); return $obj; }
    if (wz_is_rec($obj) || (is_array($obj) && count($obj) === 0)) {
        $key = wz_find_key($obj, $k);
        $obj[$key === null ? $k : $key] = $v;
        return $obj;
    }
    wz_fail('cantSetField', [$k, wz_is_nothing($obj) ? 'nothing' : mb_substr_safe(wz_text($obj), 40)]);
}
function wz_len($v) {
    if (wz_is_nothing($v)) { return 0; }
    if ($v instanceof WzObj) { return count($v->f); }
    if (is_array($v)) { return count($v); }
    return count(wz_chars(wz_text($v)));
}
function wz_each($v) {
    if (wz_is_nothing($v)) { return []; }
    if (wz_is_list($v)) { return $v; }
    if (is_string($v)) { return wz_chars($v); }
    if (wz_is_numval($v)) { return wz_range_list(1, $v); }
    if (wz_is_rec($v)) { return array_keys($v); }
    return [$v];
}
function wz_round12($n) {
    if (is_int($n)) { return $n; }
    if (floor($n) == $n && abs($n) < 1e15) { return (int) $n; }
    return (float) sprintf('%.12g', $n);
}
function wz_range($a, $b, $step = null) {
    $x = wz_num($a); $y = wz_num($b);
    $s = wz_is_nothing($step) ? ($x <= $y ? 1 : -1) : wz_num($step);
    if ($s == 0) { wz_fail('badStep'); }
    $n = 0;
    if ($s > 0) {
        for ($i = $x; $i <= $y + 1e-9; $i = $x + (++$n) * $s) { yield wz_round12($i); }
    } else {
        for ($i = $x; $i >= $y - 1e-9; $i = $x + (++$n) * $s) { yield wz_round12($i); }
    }
}
function wz_times($n) { $x = (int) floor(wz_num($n)); return $x > 0 ? $x : 0; }
function wz_range_list($a, $b) {
    $out = [];
    foreach (wz_range($a, $b) as $v) { $out[] = $v; if (count($out) > 1000000) { break; } }
    return $out;
}
function wz_push($target, $item) {
    if (wz_is_list($target)) { $target[] = $item; return $target; }
    if (wz_is_nothing($target)) { return wz_is_numval($item) ? $item : [$item]; }
    if (wz_is_numval($target)) { return $target + wz_num($item); }
    if (is_string($target)) {
        if (wz_num_like($target) && wz_num_like($item)) { return wz_num($target) + wz_num($item); }
        return $target . wz_text($item);
    }
    wz_fail('cantAdd', [wz_text($item), wz_text($target)]);
}
function wz_pull($target, $item) {
    if (wz_is_list($target)) {
        foreach ($target as $i => $x) {
            if (wz_eq($x, $item)) { array_splice($target, $i, 1); break; }
        }
        return $target;
    }
    if (wz_is_nothing($target)) { return $target; }
    if (wz_is_numval($target)) { return $target - wz_num($item); }
    if (is_string($target)) {
        if (wz_num_like($target) && wz_num_like($item)) { return wz_num($target) - wz_num($item); }
        $t = wz_text($item);
        return $t === '' ? $target : str_replace($t, '', $target);
    }
    if (wz_is_rec($target)) {
        $k = wz_find_key($target, $item);
        if ($k !== null) { unset($target[$k]); }
        return $target;
    }
    return $target;
}
function wz_cleared($v) {
    if (is_array($v)) { return []; }
    if (wz_is_numval($v)) { return 0; }
    if (is_string($v)) { return ''; }
    return null;
}

/* ------------------------------------------------------------------ text */

function wz_upper($s) { $s = wz_text($s); return function_exists('mb_strtoupper') ? mb_strtoupper($s, 'UTF-8') : strtoupper($s); }
function wz_lower($s) { return wz_low($s); }
function wz_capitalize($s) {
    $c = wz_chars($s);
    if ($c) { $c[0] = wz_upper($c[0]); }
    return implode('', $c);
}
function wz_trim($s) { return trim(wz_text($s)); }
function wz_replace($s, $a, $b) {
    $s = wz_text($s); $a = wz_text($a);
    if ($a === '') { return $s; }
    return str_replace($a, wz_text($b), $s);
}
function wz_split($s, $sep = null) {
    $s = wz_text($s);
    $sep = wz_is_nothing($sep) ? ',' : wz_text($sep);
    if ($s === '') { return []; }
    if ($sep === '') { return wz_chars($s); }
    $parts = explode($sep, $s);
    if (trim($sep) === '') { return $parts; }
    return array_map('trim', $parts);
}
function wz_join($list, $sep = null) {
    if (!wz_is_list($list)) { return wz_text($list); }
    return implode(wz_is_nothing($sep) ? ', ' : wz_text($sep), array_map('wz_text', $list));
}
function wz_part($v, $start, $count = null) {
    $isList = wz_is_list($v);
    $arr = $isList ? $v : wz_chars($v);
    $s = wz_num($start);
    if ($s < 0) { $s = count($arr) + $s + 1; }
    if ($s < 1) { $s = 1; }
    $c = wz_is_nothing($count) ? count($arr) : max(0, (int) floor(wz_num($count)));
    $out = array_slice($arr, (int) $s - 1, $c);
    return $isList ? $out : implode('', $out);
}
function wz_position($where, $what) {
    if (wz_is_list($where)) {
        foreach ($where as $i => $x) { if (wz_eq($x, $what)) { return $i + 1; } }
        return 0;
    }
    $hay = wz_text($where); $needle = wz_text($what);
    if ($needle === '') { return 0; }
    $j = strpos($hay, $needle);
    if ($j === false) { return 0; }
    return count(wz_chars(substr($hay, 0, $j))) + 1;
}
function wz_reverse($v) {
    if (wz_is_list($v)) { return array_reverse($v); }
    return implode('', array_reverse(wz_chars($v)));
}
function wz_format($n, $d) {
    $x = wz_num($n);
    $k = max(0, min(20, (int) floor(wz_num($d))));
    return number_format(wz_round($x, $k), $k, '.', '');
}

/* ------------------------------------------------------------------ numbers */

function wz_round($n, $d = null) {
    $x = wz_num($n);
    $k = wz_is_nothing($d) ? 0 : (int) floor(wz_num($d));
    $sign = $x < 0 ? -1 : 1;
    $ax = abs($x);
    $str = wz_fmt_num($ax);
    if (stripos($str, 'e') === false) {
        $shifted = (float) ($str . 'e' . $k);
        $r = (float) (sprintf('%.0f', floor($shifted + 0.5)) . 'e' . (-$k));
    } else {
        $p = 10 ** $k;
        $r = floor($ax * $p + 0.5) / $p;
    }
    $r = $sign * $r;
    if ($r == 0) { return 0; }
    if (floor($r) == $r && abs($r) < 1e15) { return (int) $r; }
    return $r;
}
function wz_floor($n) { $r = floor(wz_num($n)); return abs($r) < 1e15 ? (int) $r : $r; }
function wz_ceil($n) { $r = ceil(wz_num($n)); return abs($r) < 1e15 ? (int) $r : $r; }
function wz_abs($n) { return abs(wz_num($n)); }
function wz_sqrt($n) { $x = wz_num($n); $r = sqrt($x); return (floor($r) == $r && abs($r) < 1e15) ? (int) $r : $r; }
function wz_random($a = null, $b = null) {
    if (wz_is_nothing($a) && wz_is_nothing($b)) { return mt_rand() / mt_getrandmax(); }
    if (wz_is_nothing($b)) { $lo = 1; $hi = (int) floor(wz_num($a)); }
    else { $lo = (int) ceil(wz_num($a)); $hi = (int) floor(wz_num($b)); }
    if ($lo > $hi) { $t = $lo; $lo = $hi; $hi = $t; }
    return random_int($lo, $hi);
}
function wz_values($args) {
    if (count($args) === 1 && wz_is_list($args[0])) { return $args[0]; }
    return $args;
}
function wz_min(...$args) {
    $v = wz_values($args);
    if (!$v) { return null; }
    $m = $v[0];
    foreach ($v as $x) { if (wz_cmp($x, $m) < 0) { $m = $x; } }
    return $m;
}
function wz_max(...$args) {
    $v = wz_values($args);
    if (!$v) { return null; }
    $m = $v[0];
    foreach ($v as $x) { if (wz_cmp($x, $m) > 0) { $m = $x; } }
    return $m;
}
function wz_field($x, $f) { return wz_is_nothing($f) ? $x : wz_dot($x, wz_text($f)); }
function wz_sum($list, $f = null) {
    if (!wz_is_list($list)) { return wz_num($list); }
    $s = 0;
    foreach ($list as $x) {
        $v = wz_field($x, $f);
        if (wz_is_nothing($v) || $v === '') { continue; }
        $s += wz_num($v);
    }
    return $s;
}
function wz_average($list, $f = null) {
    if (!wz_is_list($list) || !$list) { return 0; }
    return wz_sum($list, $f) / count($list);
}
function wz_first($v) {
    if (wz_is_list($v)) { return $v ? $v[0] : null; }
    $c = wz_chars($v);
    return $c ? $c[0] : null;
}
function wz_last($v) {
    if (wz_is_list($v)) { return $v ? $v[count($v) - 1] : null; }
    $c = wz_chars($v);
    return $c ? $c[count($c) - 1] : null;
}
function wz_pick($v) {
    $arr = wz_is_list($v) ? $v : wz_chars($v);
    return $arr ? $arr[random_int(0, count($arr) - 1)] : null;
}
function wz_shuffle($v) {
    $isList = wz_is_list($v);
    $arr = $isList ? $v : wz_chars($v);
    for ($i = count($arr) - 1; $i > 0; $i--) {
        $j = random_int(0, $i);
        $t = $arr[$i]; $arr[$i] = $arr[$j]; $arr[$j] = $t;
    }
    return $isList ? $arr : implode('', $arr);
}
function wz_sort($v, $f = null, $desc = null) {
    if (!wz_is_list($v)) { $c = wz_chars($v); sort($c, SORT_STRING); return implode('', $c); }
    $d = wz_truthy($desc) ? -1 : 1;
    $pairs = [];
    foreach ($v as $i => $x) { $pairs[] = [$x, $i]; }
    usort($pairs, function ($a, $b) use ($f, $d) {
        $x = wz_field($a[0], $f); $y = wz_field($b[0], $f);
        if (is_string($x) && is_string($y) && !(wz_num_like($x) && wz_num_like($y))) {
            $c = wz_cmp(wz_low($x), wz_low($y));
            if ($c === 0) { $c = wz_cmp($x, $y); }
        } else {
            $c = wz_cmp($x, $y);
        }
        return $c ? $c * $d : $a[1] - $b[1];
    });
    return array_map(function ($p) { return $p[0]; }, $pairs);
}
function wz_unique($v) {
    if (!wz_is_list($v)) { return $v; }
    $out = [];
    foreach ($v as $x) {
        $seen = false;
        foreach ($out as $y) { if (wz_eq($x, $y)) { $seen = true; break; } }
        if (!$seen) { $out[] = $x; }
    }
    return $out;
}
function wz_keys($r) {
    if (wz_is_rec($r)) { return array_map('strval', array_keys($r)); }
    if (wz_is_list($r)) { return wz_range_list(1, count($r)); }
    return [];
}
function wz_has($r, $f) { return wz_is_rec($r) && wz_find_key($r, $f) !== null; }

/* ------------------------------------------------------------------ dates */

function wz_parse_date($v) {
    if (wz_is_nothing($v) || $v === '') {
        return ['y' => (int) date('Y'), 'm' => (int) date('n'), 'd' => (int) date('j'), 'h' => (int) date('G'), 'i' => (int) date('i'), 's' => (int) date('s'), 'noTime' => false, 'now' => true];
    }
    $t = wz_text($v);
    if (preg_match('/^\s*(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/', $t, $m)) {
        return ['y' => (int) $m[1], 'm' => (int) $m[2], 'd' => (int) $m[3],
            'h' => isset($m[4]) && $m[4] !== '' ? (int) $m[4] : 0, 'i' => isset($m[5]) && $m[5] !== '' ? (int) $m[5] : 0,
            's' => isset($m[6]) && $m[6] !== '' ? (int) $m[6] : 0, 'noTime' => !isset($m[4]) || $m[4] === '', 'now' => false];
    }
    if (preg_match('/^\s*(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/', $t, $m)) {
        return ['y' => (int) $m[3], 'm' => (int) $m[2], 'd' => (int) $m[1], 'h' => 0, 'i' => 0, 's' => 0, 'noTime' => true, 'now' => false];
    }
    wz_fail('badDate', [$t]);
}
function wz_pad($n) { return ($n < 10 ? '0' : '') . $n; }
function wz_date_text($p) { return $p['y'] . '-' . wz_pad($p['m']) . '-' . wz_pad($p['d']); }
function wz_now() { return date('Y-m-d H:i:s'); }
function wz_today() { return date('Y-m-d'); }
function wz_time() { return date('H:i'); }
function wz_date_part($v, $part) {
    $p = wz_parse_date($v);
    if ($part === 'w') { return (int) gmdate('N', gmmktime(0, 0, 0, $p['m'], $p['d'], $p['y'])); }
    return $p[$part];
}
function wz_day_num($p) { return (int) round(gmmktime(0, 0, 0, $p['m'], $p['d'], $p['y']) / 86400); }
function wz_days_between($a, $b) { return wz_day_num(wz_parse_date($b)) - wz_day_num(wz_parse_date($a)); }
function wz_add_days($v, $n) {
    $p = wz_parse_date($v);
    $ts = gmmktime(0, 0, 0, $p['m'], $p['d'], $p['y']) + (int) round(wz_num($n)) * 86400;
    $out = gmdate('Y-m-d', $ts);
    if (!$p['noTime'] && !$p['now']) { $out .= ' ' . wz_pad($p['h']) . ':' . wz_pad($p['i']) . ':' . wz_pad($p['s']); }
    return $out;
}

/* ------------------------------------------------------------------ types (the rules of C) */

const WZ_MAXSAFE = 9007199254740991;
const WZ_INTS = ['int8' => [8, true], 'int16' => [16, true], 'int32' => [32, true], 'int64' => [64, true],
    'uint8' => [8, false], 'uint16' => [16, false], 'uint32' => [32, false], 'uint64' => [64, false]];
const WZ_SIZES = ['bool' => 1, 'char' => 1, 'int8' => 1, 'uint8' => 1, 'int16' => 2, 'uint16' => 2, 'int32' => 4, 'uint32' => 4,
    'int64' => 8, 'uint64' => 8, 'float16' => 2, 'float32' => 4, 'float64' => 8];
$GLOBALS['wz_structs'] = [];
$GLOBALS['wz_unions'] = [];
$GLOBALS['wz_classes'] = [];

function wz_int_name($bits, $signed) { return ($signed ? 'int' : 'unsigned int') . $bits; }
/** Keep a whole number inside a C type, going round like C: int8 200 is -56, uint8 -1 is 255. */
function wz_wrap($t, $bits, $signed) {
    if ($t > WZ_MAXSAFE || $t < -WZ_MAXSAFE || ($bits >= 64 && !$signed && $t < 0)) { wz_fail('int64Range', [wz_fmt_num($t), wz_int_name($bits, $signed)]); }
    if ($bits >= 64) { return (int) $t; }
    $m = 2 ** $bits;
    $r = is_int($t) ? $t % $m : fmod($t, $m);
    if ($r < 0) { $r += $m; }
    if ($signed && $r >= $m / 2) { $r -= $m; }
    return (int) $r;
}
function wz_trunc($x) { return is_int($x) ? $x : ($x < 0 ? ceil($x) : floor($x)); }
function wz_to_int($v, $bits, $signed) {
    $x = wz_num($v);
    if (is_float($x) && !is_finite($x)) { wz_fail('notWhole', [wz_text($v), wz_int_name($bits, $signed)]); }
    return wz_wrap(wz_trunc($x), $bits, $signed);
}
/** The nearest number of a half-precision float (float16). */
function wz_f16($x) {
    $x = (float) $x;
    if ($x == 0 || !is_finite($x)) { return $x; }
    $a = abs($x);
    if ($a >= 65520) { return $x > 0 ? INF : -INF; }
    $p = 1.0;
    while ($p * 2 <= $a) { $p *= 2; }
    while ($p > $a) { $p /= 2; }
    if ($p < 2 ** -14) { $p = 2 ** -14; }
    $q = $p / 1024; $n = $a / $q; $f = floor($n); $d = $n - $f;
    if ($d > 0.5 || ($d == 0.5 && fmod($f, 2) == 1)) { $f++; }
    $r = $f * $q;
    return $r == 0 ? 0.0 : ($x < 0 ? -$r : $r);
}
function wz_f32($x) { return unpack('g', pack('g', (float) $x))[1]; }
function wz_to_float($v, $bits) {
    $x = (float) wz_num($v);
    if ($bits === 32) { $x = wz_f32($x); }
    elseif ($bits === 16) { $x = wz_f16($x); }
    return $x == 0 ? 0.0 : $x;
}
/** A character from its code (UTF-8), and the code of a character. */
function wz_chr($c) {
    if (function_exists('mb_chr')) { return mb_chr($c, 'UTF-8'); }
    if ($c < 0x80) { return chr($c); }
    if ($c < 0x800) { return chr(0xC0 | ($c >> 6)) . chr(0x80 | ($c & 0x3F)); }
    if ($c < 0x10000) { return chr(0xE0 | ($c >> 12)) . chr(0x80 | (($c >> 6) & 0x3F)) . chr(0x80 | ($c & 0x3F)); }
    return chr(0xF0 | ($c >> 18)) . chr(0x80 | (($c >> 12) & 0x3F)) . chr(0x80 | (($c >> 6) & 0x3F)) . chr(0x80 | ($c & 0x3F));
}
function wz_code($c) {
    if (is_int($c)) { return $c; }
    if (is_float($c)) { return (int) $c; }
    if (is_bool($c)) { return $c ? 1 : 0; }
    $s = wz_text($c);
    if ($s === '') { return 0; }
    if (function_exists('mb_ord')) { return mb_ord($s, 'UTF-8'); }
    $b = ord($s[0]);
    if ($b < 0x80) { return $b; }
    if ($b < 0xE0) { return (($b & 0x1F) << 6) | (ord($s[1]) & 0x3F); }
    if ($b < 0xF0) { return (($b & 0x0F) << 12) | ((ord($s[1]) & 0x3F) << 6) | (ord($s[2]) & 0x3F); }
    return (($b & 0x07) << 18) | ((ord($s[1]) & 0x3F) << 12) | ((ord($s[2]) & 0x3F) << 6) | (ord($s[3]) & 0x3F);
}
function wz_to_char($v) {
    if (is_int($v) || is_float($v) || is_bool($v)) {
        $c = (int) wz_trunc(wz_num($v));
        if ($c < 0 || $c > 0x10FFFF) { wz_fail('badCharCode', [wz_text($v)]); }
        return wz_chr($c);
    }
    if (wz_is_nothing($v)) { return "\0"; }
    $cs = wz_chars(wz_text($v));
    if (count($cs) !== 1) { wz_fail('notOneChar', [mb_substr_safe(wz_text($v), 20)]); }
    return $cs[0];
}

/* whole-number arithmetic of C */
function wz_ia($x, $bits, $signed) { return wz_wrap($x, $bits, $signed); }
function wz_imul($a, $b, $bits, $signed) {
    if ($bits <= 32) {
        $ua = ((int) $a) & 0xFFFFFFFF; $ub = ((int) $b) & 0xFFFFFFFF;
        $lo = (($ua & 0xFFFF) * $ub) + (((($ua >> 16) * $ub) & 0xFFFF) << 16);
        return wz_wrap($lo & 0xFFFFFFFF, $bits, $signed);
    }
    return wz_wrap($a * $b, $bits, $signed);
}
function wz_idiv($a, $b, $bits, $signed) {
    if ($b == 0) { wz_fail('divZero'); }
    $q = (is_int($a) && is_int($b)) ? intdiv($a, $b) : ($a - fmod($a, $b)) / $b;
    return wz_wrap($q, $bits, $signed);
}
function wz_irem($a, $b) {
    if ($b == 0) { wz_fail('divZero'); }
    $r = (is_int($a) && is_int($b)) ? $a % $b : fmod($a, $b);
    return $r == 0 ? 0 : $r;
}
/* bit by bit: and or xor not (in small letters), shl shr. $bits / $signed: the type of the result (int32 by default) */
function wz_bits($v) {
    if (is_bool($v)) { return $v ? 1 : 0; }
    $x = wz_num($v);
    if (is_float($x) && (!is_finite($x) || floor($x) != $x)) { wz_fail('notIntBits', [wz_text($v)]); }
    return (int) $x;
}
function wz_band($a, $b, $bits, $signed) { return wz_wrap(wz_bits($a) & wz_bits($b), $bits, $signed); }
function wz_bor($a, $b, $bits, $signed) { return wz_wrap(wz_bits($a) | wz_bits($b), $bits, $signed); }
function wz_bxor($a, $b, $bits, $signed) { return wz_wrap(wz_bits($a) ^ wz_bits($b), $bits, $signed); }
function wz_bnot($a, $bits, $signed) { return wz_wrap(~wz_bits($a), $bits, $signed); }
function wz_shl($a, $n, $bits, $signed) {
    $n = wz_bits($n);
    if (!($n >= 0 && $n < $bits)) { wz_fail('shiftRange', [$bits - 1, wz_fmt_num($n)]); }
    $r = wz_bits($a) << $n;
    if ($bits < 64) { $r = $r & ((2 ** $bits) - 1); }
    elseif (!$signed && $r < 0) { $r = $r + 18446744073709551616.0; }
    return wz_wrap($r, $bits, $signed);
}
function wz_shr($a, $n, $bits, $signed) {
    $n = wz_bits($n);
    if (!($n >= 0 && $n < $bits)) { wz_fail('shiftRange', [$bits - 1, wz_fmt_num($n)]); }
    return wz_wrap(wz_bits($a) >> $n, $bits, $signed);
}
/**
 * and / or / xor / nand / nor / xnor in small letters on values whose type is not known:
 * two numbers work bit by bit (as int32); anything else works as a condition (true / false),
 * and the right side ($f) runs only when it is needed, like && and ||.
 */
function wz_bitword($op, $a, $b) {
    switch ($op) {
        case 'and': return wz_band($a, $b, 32, true);
        case 'or': return wz_bor($a, $b, 32, true);
        case 'xor': return wz_bxor($a, $b, 32, true);
        case 'nand': return wz_bnot(wz_band($a, $b, 32, true), 32, true);
        case 'nor': return wz_bnot(wz_bor($a, $b, 32, true), 32, true);
        default: return wz_bnot(wz_bxor($a, $b, 32, true), 32, true);
    }
}
function wz_logicword($op, $a, $b) {
    switch ($op) {
        case 'and': return $a && $b;
        case 'or': return $a || $b;
        case 'xor': return $a != $b;
        case 'nand': return !($a && $b);
        case 'nor': return !($a || $b);
        default: return $a == $b;
    }
}
function wz_bw($op, $a, $f) {
    $isNum = (is_int($a) || is_float($a)) && is_finite((float) $a);
    $ta = wz_truthy($a);
    if (!$isNum) {
        if (($op === 'and' || $op === 'nand') && !$ta) { return $op === 'and' ? false : true; }
        if (($op === 'or' || $op === 'nor') && $ta) { return $op === 'or' ? true : false; }
    }
    $b = $f();
    if ($isNum && (is_int($b) || is_float($b)) && is_finite((float) $b)) { return wz_bitword($op, $a, $b); }
    return wz_logicword($op, $ta, wz_truthy($b));
}
function wz_bnot1($a) {
    if ((is_int($a) || is_float($a)) && is_finite((float) $a)) { return wz_bnot($a, 32, true); }
    return !wz_truthy($a);
}
function wz_fa($x, $bits) {
    if ($bits === 32) { $x = wz_f32($x); }
    elseif ($bits === 16) { $x = wz_f16($x); }
    return ($x == 0 || is_nan($x)) ? 0.0 : $x;
}
function wz_fdiv($a, $b, $bits) {
    if ($b == 0) { wz_fail('divZero'); }
    return wz_fa($a / $b, $bits);
}
/** int32 a[10]: a list of 10 values that start at the zero of their type */
function wz_array($n, $type) {
    $c = (int) floor(wz_num($n));
    if ($c < 0) { wz_fail('badIndex', [wz_text($n)]); }
    $out = [];
    for ($i = 0; $i < $c; $i++) { $out[] = wz_zero($type); }
    return $out;
}
function wz_as_a($v, $type) { return wz_is_a($v, $type) ? $v : null; }
/** Lists, records, structs and unions are values in PHP already. */
function wz_val($v) { return $v; }

function wz_conv($v, $type) {
    if (isset(WZ_INTS[$type])) { return wz_to_int($v, WZ_INTS[$type][0], WZ_INTS[$type][1]); }
    switch ($type) {
        case 'any': return $v;
        case 'bool': return wz_truthy($v);
        case 'char': return wz_to_char($v);
        case 'string': return wz_text($v);
        case 'float16': return wz_to_float($v, 16);
        case 'float32': return wz_to_float($v, 32);
        case 'float64': return wz_to_float($v, 64);
    }
    $k = $type[0]; $name = substr($type, 2);
    if ($k === 'S') { return wz_to_struct($v, $name); }
    if ($k === 'U') { return wz_to_union($v, $name); }
    if ($k === 'C') { return wz_to_obj($v, $name); }
    if ($k === 'L') {
        if (wz_is_nothing($v)) { return []; }
        if (!wz_is_list($v) && !(is_array($v) && count($v) === 0)) { wz_fail('notList', [wz_short($v)]); }
        return array_map(function ($x) use ($name) { return wz_conv($x, $name); }, $v);
    }
    return $v;
}
function wz_zero($type) {
    if (isset(WZ_INTS[$type])) { return 0; }
    if (str_starts_with($type, 'float')) { return 0.0; }
    switch ($type) {
        case 'bool': return false;
        case 'char': return "\0";
        case 'string': return '';
        case 'any': return null;
    }
    $k = $type[0]; $name = substr($type, 2);
    if ($k === 'S') { return wz_to_struct(null, $name); }
    if ($k === 'U') { return wz_to_union(null, $name); }
    if ($k === 'L') { return []; }
    return null;
}
function wz_is_a($v, $type) {
    if (isset(WZ_INTS[$type])) {
        [$bits, $signed] = WZ_INTS[$type];
        if (!(is_int($v) || (is_float($v) && floor($v) == $v))) { return false; }
        if ($bits >= 64) { return abs($v) <= WZ_MAXSAFE && ($signed || $v >= 0); }
        return wz_wrap($v, $bits, $signed) == $v;
    }
    switch ($type) {
        case 'any': return true;
        case 'bool': return is_bool($v);
        case 'char': return is_string($v) && count(wz_chars($v)) === 1;
        case 'string': return is_string($v);
        case 'float16': case 'float32': case 'float64': return is_int($v) || is_float($v);
    }
    $k = $type[0]; $name = strtolower(substr($type, 2));
    if ($k === 'C') {
        if (!($v instanceof WzObj)) { return false; }
        for ($c = $GLOBALS['wz_classes'][strtolower($v->c)] ?? null; $c; $c = $c['base'] ? $GLOBALS['wz_classes'][$c['base']] : null) {
            if ($c['lname'] === $name || in_array($name, $c['ifaces'], true)) { return true; }
        }
        return false;
    }
    if ($k === 'U') { return is_array($v) && isset($v['$u']) && strtolower((string) $v['$u']) === $name; }
    if ($k === 'S') { return is_array($v) && !isset($v['$u']) && !array_is_list($v); }
    if ($k === 'L') { return wz_is_list($v) || (is_array($v) && count($v) === 0); }
    return false;
}
function wz_short($v) { $s = wz_is_nothing($v) ? 'nothing' : wz_inner($v); return mb_substr_safe($s, 40) . (strlen($s) > 40 ? '…' : ''); }

/* struct: a record with fixed fields */
function wz_def_struct($d) { $GLOBALS['wz_structs'][strtolower($d['name'])] = $d; }
function wz_dflt($f) { return array_key_exists(2, $f) && $f[2] !== null ? wz_conv($f[2], $f[1]) : wz_zero($f[1]); }
function wz_to_struct($v, $name) {
    $d = $GLOBALS['wz_structs'][strtolower($name)] ?? null;
    if (!$d) { wz_fail('noType', [$name]); }
    $out = [];
    if (wz_is_nothing($v)) { foreach ($d['fields'] as $f) { $out[$f[0]] = wz_dflt($f); } return $out; }
    if (wz_is_list($v)) {
        if (count($v) > count($d['fields'])) { wz_fail('tooManyValues', [$d['name'], count($d['fields'])]); }
        foreach ($d['fields'] as $i => $f) { $out[$f[0]] = $i < count($v) ? wz_conv($v[$i], $f[1]) : wz_dflt($f); }
        return $out;
    }
    if (!is_array($v) || isset($v['$u'])) { wz_fail('notStruct', [wz_short($v), $d['name']]); }
    foreach ($v as $k => $_) {
        $ok = false;
        foreach ($d['fields'] as $f) { if (strtolower($f[0]) === strtolower((string) $k)) { $ok = true; } }
        if (!$ok) { wz_fail('noFieldIn', [$d['name'], $k]); }
    }
    foreach ($d['fields'] as $f) {
        $key = wz_find_key($v, $f[0]);
        $out[$f[0]] = $key === null ? wz_dflt($f) : wz_conv($v[$key], $f[1]);
    }
    return $out;
}

/* union: all its fields share the same bytes, like in C */
function wz_def_union($d) {
    $size = 1;
    foreach ($d['fields'] as $f) { $size = max($size, WZ_SIZES[$f[1]] ?? 0); }
    $d['size'] = $size;
    $GLOBALS['wz_unions'][strtolower($d['name'])] = $d;
}
function wz_ufield($u, $k) {
    $d = $GLOBALS['wz_unions'][strtolower((string) $u['$u'])];
    foreach ($d['fields'] as $f) { if (strtolower($f[0]) === strtolower((string) $k)) { return $f; } }
    wz_fail('noFieldIn', [$d['name'], $k]);
}
function wz_to_union($v, $name) {
    $d = $GLOBALS['wz_unions'][strtolower($name)] ?? null;
    if (!$d) { wz_fail('noType', [$name]); }
    $u = ['$u' => $d['name'], '$b' => array_fill(0, $d['size'], 0)];
    if (wz_is_nothing($v)) { return $u; }
    if (is_array($v) && isset($v['$u'])) {
        if (strtolower((string) $v['$u']) !== strtolower($d['name'])) { wz_fail('notInstance', [wz_short($v), $d['name']]); }
        $u['$b'] = $v['$b'];
        return $u;
    }
    if (wz_is_list($v)) {
        if (count($v) > 1) { wz_fail('unionOneField', [$d['name']]); }
        if (count($v)) { wz_uput($u, $d['fields'][0], $v[0]); }
        return $u;
    }
    if (is_array($v)) {
        if (count($v) > 1) { wz_fail('unionOneField', [$d['name']]); }
        foreach ($v as $k => $x) { wz_uput($u, wz_ufield($u, $k), $x); }
        return $u;
    }
    wz_uput($u, $d['fields'][0], $v);
    return $u;
}
function wz_f16bits($x) {
    $s = $x < 0 ? 0x8000 : 0; $a = abs((float) $x);
    if (is_infinite($a)) { return $s | 0x7C00; }
    if ($a == 0) { return $s; }
    if ($a < 2 ** -14) { return $s | (int) round($a / (2 ** -24)); }
    $e = 0; $p = 1.0;
    while ($p * 2 <= $a) { $p *= 2; $e++; }
    while ($p > $a) { $p /= 2; $e--; }
    return $s | (($e + 15) << 10) | (int) round(($a / $p - 1) * 1024);
}
function wz_f16val($h) {
    $s = ($h & 0x8000) ? -1 : 1; $e = ($h >> 10) & 0x1F; $m = $h & 0x3FF;
    if ($e === 0) { return $m ? $s * $m * (2 ** -24) : 0.0; }
    if ($e === 31) { return $m ? null : $s * INF; }
    return $s * (1 + $m / 1024) * (2 ** ($e - 15));
}
/** Write / read a field of a union in its bytes (little-endian, like a PC). */
function wz_uput(&$u, $f, $value) {
    $t = $f[1]; $v = wz_conv($value, $t);
    switch ($t) {
        case 'int8': case 'uint8': $bin = pack('C', $v & 0xFF); break;
        case 'int16': case 'uint16': $bin = pack('v', $v & 0xFFFF); break;
        case 'int32': case 'uint32': $bin = pack('V', $v & 0xFFFFFFFF); break;
        case 'int64': case 'uint64': $bin = pack('P', $v); break;
        case 'float16': $bin = pack('v', wz_f16bits($v)); break;
        case 'float32': $bin = pack('g', $v); break;
        case 'float64': $bin = pack('e', $v); break;
        case 'bool': $bin = pack('C', $v ? 1 : 0); break;
        default: $bin = pack('C', wz_code($v) & 255);
    }
    foreach (array_values(unpack('C*', $bin)) as $i => $b) { $u['$b'][$i] = $b; }
}
function wz_uget($u, $f) {
    $bin = '';
    for ($i = 0; $i < 8; $i++) { $bin .= chr($u['$b'][$i] ?? 0); }
    switch ($f[1]) {
        case 'int8': $x = unpack('C', $bin)[1]; return $x >= 128 ? $x - 256 : $x;
        case 'uint8': return unpack('C', $bin)[1];
        case 'int16': $x = unpack('v', $bin)[1]; return $x >= 32768 ? $x - 65536 : $x;
        case 'uint16': return unpack('v', $bin)[1];
        case 'int32': $x = unpack('V', $bin)[1]; return $x >= 2147483648 ? $x - 4294967296 : $x;
        case 'uint32': return unpack('V', $bin)[1];
        case 'int64': return wz_wrap(unpack('P', $bin)[1], 64, true);
        case 'uint64': $x = unpack('P', $bin)[1]; return wz_wrap($x < 0 ? $x + 18446744073709551616.0 : $x, 64, false);
        case 'float16': return wz_f16val(unpack('v', $bin)[1]);
        case 'float32': return unpack('g', $bin)[1];
        case 'float64': return unpack('e', $bin)[1];
        case 'bool': return unpack('C', $bin)[1] !== 0;
        case 'char': return wz_chr(unpack('C', $bin)[1]);
    }
    return null;
}

/* classes: objects with fields and methods, made with new */
function wz_def_class($d) {
    $c = ['name' => $d['name'], 'lname' => strtolower($d['name']), 'base' => isset($d['base']) && $d['base'] !== null ? strtolower($d['base']) : null,
        'abstract' => !empty($d['abstract']), 'iface' => !empty($d['iface']), 'ifaces' => [],
        'fields' => [], 'flist' => [], 'statics' => [], 'svals' => [], 'methods' => [], 'ctor' => $d['ctor'] ?? null];
    foreach ($d['ifaces'] ?? [] as $n) {
        $ln = strtolower($n);
        $c['ifaces'][] = $ln;
        foreach ($GLOBALS['wz_classes'][$ln]['ifaces'] ?? [] as $x) { if (!in_array($x, $c['ifaces'], true)) { $c['ifaces'][] = $x; } }
    }
    if ($c['base'] !== null && isset($GLOBALS['wz_classes'][$c['base']])) {
        foreach ($GLOBALS['wz_classes'][$c['base']]['ifaces'] as $x) { if (!in_array($x, $c['ifaces'], true)) { $c['ifaces'][] = $x; } }
    }
    foreach ($d['fields'] ?? [] as $f) {
        $m = ['name' => $f[0], 'type' => $f[1], 'access' => $f[2] ?? 'public', 'owner' => $c['lname'], 'stat' => !empty($f[3])];
        if ($m['stat']) { $c['statics'][strtolower($f[0])] = $m; $c['svals'][$f[0]] = wz_zero($f[1]); }
        else { $c['fields'][strtolower($f[0])] = $m; $c['flist'][] = $m; }
    }
    foreach ($d['methods'] ?? [] as $f) {
        $c['methods'][strtolower($f[0])] = ['name' => $f[0], 'fn' => $f[1], 'access' => $f[2] ?? 'public', 'owner' => $c['lname'], 'stat' => !empty($f[3])];
    }
    $GLOBALS['wz_classes'][$c['lname']] = $c;
}
function wz_cls($name) {
    $c = $GLOBALS['wz_classes'][strtolower((string) $name)] ?? null;
    if (!$c) { wz_fail('noType', [$name]); }
    return $c;
}
function wz_make($name) {
    $c = wz_cls($name);
    if ($c['abstract'] || $c['iface']) { wz_fail('abstractNew', [$c['name']]); }
    $chain = [];
    for ($x = $c; $x; $x = $x['base'] ? $GLOBALS['wz_classes'][$x['base']] : null) { array_unshift($chain, $x); }
    $o = new WzObj($c['name']);
    foreach ($chain as $x) { foreach ($x['flist'] as $f) { $o->f[$f['name']] = wz_zero($f['type']); } }
    return $o;
}
function wz_member($c, $k, $kind) {
    $lk = strtolower((string) $k);
    for ($x = $c; $x; $x = $x['base'] ? $GLOBALS['wz_classes'][$x['base']] : null) {
        if (isset($x[$kind][$lk])) { return $x[$kind][$lk]; }
    }
    return null;
}
function wz_check($m, $ctx, $k) {
    if ($m['access'] === 'public') { return; }
    $cc = $ctx !== null ? ($GLOBALS['wz_classes'][strtolower($ctx)] ?? null) : null;
    $ok = false;
    if ($cc) {
        if ($m['access'] === 'private') { $ok = $cc['lname'] === $m['owner']; }
        else { for ($x = $cc; $x; $x = $x['base'] ? $GLOBALS['wz_classes'][$x['base']] : null) { if ($x['lname'] === $m['owner']) { $ok = true; break; } } }
    }
    if (!$ok) { wz_fail($m['access'] === 'private' ? 'privateMember' : 'protectedMember', [$k, $GLOBALS['wz_classes'][$m['owner']]['name']]); }
}
function wz_oget($o, $k, $ctx = null) {
    if (wz_is_nothing($o)) { wz_fail('nothingField', [$k]); }
    if (!($o instanceof WzObj)) { return wz_dot($o, $k); }
    $m = wz_member(wz_cls($o->c), $k, 'fields');
    if (!$m) { wz_fail('noMember', [$o->c, $k]); }
    wz_check($m, $ctx, $k);
    return $o->f[$m['name']];
}
function wz_oset($o, $k, $v, $ctx = null) {
    if (wz_is_nothing($o)) { wz_fail('nothingField', [$k]); }
    $m = wz_member(wz_cls($o->c), $k, 'fields');
    if (!$m) { wz_fail('noMember', [$o->c, $k]); }
    wz_check($m, $ctx, $k);
    $o->f[$m['name']] = wz_conv($v, $m['type']);
    return $o;
}
function wz_sfget($c, $k, $ctx = null) {
    $m = wz_member(wz_cls($c), $k, 'statics');
    if (!$m) { wz_fail('noMember', [$c, $k]); }
    wz_check($m, $ctx, $k);
    return $GLOBALS['wz_classes'][$m['owner']]['svals'][$m['name']];
}
function wz_sfset($c, $k, $v, $ctx = null) {
    $m = wz_member(wz_cls($c), $k, 'statics');
    if (!$m) { wz_fail('noMember', [$c, $k]); }
    wz_check($m, $ctx, $k);
    $GLOBALS['wz_classes'][$m['owner']]['svals'][$m['name']] = wz_conv($v, $m['type']);
}
function wz_vcall($o, $k, $args, $ctx = null, $fallback = null) {
    if ($o instanceof WzObj) {
        $m = wz_member(wz_cls($o->c), $k, 'methods');
        if (!$m || $m['stat']) { wz_fail('noMethod', [$o->c, $k]); }
        wz_check($m, $ctx, $k);
        return $m['fn']($o, ...$args);
    }
    if ($fallback !== null) { return $fallback($o, ...$args); }
    if (wz_is_nothing($o)) { wz_fail('nothingMethod', [$k]); }
    wz_fail('noMethod', [wz_short($o), $k]);
}
function wz_scall($c, $k, $self, $args, $ctx = null) {
    $m = wz_member(wz_cls($c), $k, 'methods');
    if (!$m) { wz_fail('noMethod', [$c, $k]); }
    wz_check($m, $ctx, $k);
    return $m['stat'] ? $m['fn'](...$args) : $m['fn']($self, ...$args);
}
function wz_to_obj($v, $name) {
    if (wz_is_nothing($v)) { return null; }
    // an object that came from the page as JSON becomes an object again
    if (is_array($v) && isset($v['$class']) && is_string($v['$class'])) { $v = wz_revive($v); }
    if (!wz_is_a($v, 'C:' . $name)) { wz_fail('notInstance', [wz_short($v), $name]); }
    return $v;
}
/** new Dog("Rex"): the object, made by the constructor of its class */
function wz_construct($name, $args) {
    $c = wz_cls($name);
    $o = wz_make($name);
    if ($c['ctor']) { ($c['ctor'])($o, ...$args); }
    return $o;
}
/** new Point { x = 1 }: set fields after making it */
function wz_init_obj($o, $values, $ctx = null) {
    foreach ($values as $k => $v) { wz_set_dot($o, $k, $v, $ctx); }
    return $o;
}
/** References for changing a part of a value in place: obj.field.x = 1, list[2].x = 1, this.pos.x = 1 */
function &wz_lref(&$c, $k, $ctx = null) {
    if ($c instanceof WzObj) {
        $m = wz_member(wz_cls($c->c), $k, 'fields');
        if (!$m) { wz_fail('noMember', [$c->c, $k]); }
        wz_check($m, $ctx, $k);
        return $c->f[$m['name']];
    }
    if (is_array($c) && !isset($c['$u']) && (wz_is_rec($c) || count($c) === 0)) {
        $key = wz_find_key($c, $k);
        if ($key !== null) { return $c[$key]; }
    }
    $none = null;
    return $none;
}
function &wz_iref(&$c, $i) {
    if (wz_is_list($c) && count($c) > 0) {
        $n = wz_index($i, count($c));
        if ($n < 1 || $n > count($c)) { wz_fail('noItem', [wz_text($i), count($c)]); }
        return $c[$n - 1];
    }
    if (wz_is_rec($c)) {
        $key = wz_find_key($c, $i);
        if ($key !== null) { return $c[$key]; }
    }
    if (wz_is_nothing($c)) { wz_fail('nothingItems', [wz_text($i)]); }
    $none = null;
    return $none;
}
function &wz_oref($o, $k, $ctx = null) {
    if (!($o instanceof WzObj)) { wz_fail(wz_is_nothing($o) ? 'nothingField' : 'noField', wz_is_nothing($o) ? [$k] : [wz_short($o), $k]); }
    $m = wz_member(wz_cls($o->c), $k, 'fields');
    if (!$m) { wz_fail('noMember', [$o->c, $k]); }
    wz_check($m, $ctx, $k);
    return $o->f[$m['name']];
}
function &wz_sfref($c, $k, $ctx = null) {
    $m = wz_member(wz_cls($c), $k, 'statics');
    if (!$m) { wz_fail('noMember', [$c, $k]); }
    wz_check($m, $ctx, $k);
    return $GLOBALS['wz_classes'][$m['owner']]['svals'][$m['name']];
}
function wz_revive($v) {
    if (!is_array($v)) { return $v; }
    if (isset($v['$class']) && is_string($v['$class']) && isset($GLOBALS['wz_classes'][strtolower($v['$class'])])) {
        $o = wz_make($v['$class']);
        foreach ($v as $k => $x) {
            if ($k === '$class') { continue; }
            $m = wz_member(wz_cls($v['$class']), $k, 'fields');
            if ($m) { $o->f[$m['name']] = wz_revive($x); }
        }
        return $o;
    }
    return array_map('wz_revive', $v);
}

/* ------------------------------------------------------------------ JSON, web */

function wz_json_flags() { return JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE; }
function wz_to_json($v) { return json_encode($v, wz_json_flags()); }
function wz_from_json($s) {
    $r = json_decode(wz_text($s), true);
    if ($r === null && json_last_error() !== JSON_ERROR_NONE) { wz_fail('notJson', [substr(wz_text($s), 0, 40)]); }
    return $r;
}
function wz_fetch($url) {
    $url = wz_text($url);
    if (!preg_match('~^https?://~i', $url)) { wz_fail('fetchFail', [$url]); }
    $body = false;
    if (ini_get('allow_url_fopen')) {
        $ctx = stream_context_create(['http' => ['timeout' => 15, 'header' => "User-Agent: Wemazy\r\n"]]);
        $body = @file_get_contents($url, false, $ctx);
    }
    if ($body === false && function_exists('curl_init')) {
        $c = curl_init($url);
        curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 15, CURLOPT_USERAGENT => 'Wemazy']);
        $body = curl_exec($c);
    }
    if ($body === false) { wz_fail('fetchFail', [$url]); }
    $j = json_decode($body, true);
    return (json_last_error() === JSON_ERROR_NONE) ? $j : $body;
}

/* ------------------------------------------------------------------ server helpers */

function wz_repr($v) {
    if (wz_is_nothing($v)) { return 'nothing'; }
    if (is_array($v) && count($v) === 0) { return '[]'; }
    return wz_text($v);
}
function wz_print($v) { $GLOBALS['wz_log'][] = wz_repr($v); }
function wz_wait($ms) { $t = (int) wz_num($ms); if ($t > 0) { usleep(min($t, 20000) * 1000); } }
function wz_errmsg($e) { return $e instanceof Throwable ? $e->getMessage() : wz_text($e); }
function wz_at($file, $line) { $GLOBALS['wz_where'] = [$file, $line]; }
function wz_hash($p) { return password_hash(wz_text($p), PASSWORD_DEFAULT); }
function wz_check_hash($p, $h) { return password_verify(wz_text($p), wz_text($h)); }

function wz_session_start() {
    if (session_status() === PHP_SESSION_ACTIVE) { return; }
    if (headers_sent()) { return; }
    // one session per site, even when several sites live on the same server
    $path = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/') . '/';
    $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_name('wz' . substr(md5(dirname(__DIR__)), 0, 10));
    session_set_cookie_params(['lifetime' => 0, 'path' => $path, 'httponly' => true, 'samesite' => 'Lax', 'secure' => $https]);
    session_start();
}
function wz_sget($k) {
    wz_session_start();
    $s = $_SESSION['wz'] ?? [];
    $key = wz_find_key($s, $k);
    return $key === null ? null : $s[$key];
}
function wz_sset($k, $v) {
    wz_session_start();
    if (!isset($_SESSION['wz']) || !is_array($_SESSION['wz'])) { $_SESSION['wz'] = []; }
    $key = wz_find_key($_SESSION['wz'], $k);
    $_SESSION['wz'][$key === null ? $k : $key] = $v;
}
function wz_sclear() {
    wz_session_start();
    $_SESSION['wz'] = [];
}

/* ------------------------------------------------------------------ database */

function wz_db_type() { return wz_config()['db'] === 'mysql' ? 'mysql' : 'sqlite'; }

function wz_db() {
    static $pdo = null;
    if ($pdo !== null) { return $pdo; }
    $cfg = wz_config();
    $type = wz_db_type();
    if (!class_exists('PDO') || !in_array($type, PDO::getAvailableDrivers(), true)) {
        wz_fail('noPdo', [$type === 'mysql' ? 'MySQL' : 'SQLite']);
    }
    try {
        if ($type === 'mysql') {
            $dsn = 'mysql:host=' . $cfg['mysql_host'] . ';port=' . (int) $cfg['mysql_port'] . ';dbname=' . $cfg['mysql_database'] . ';charset=utf8mb4';
            $pdo = new PDO($dsn, $cfg['mysql_user'], $cfg['mysql_password'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } else {
            $file = $cfg['sqlite_file'];
            $dir = dirname($file);
            if (!is_dir($dir)) { @mkdir($dir, 0775, true); }
            $pdo = new PDO('sqlite:' . $file, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_TIMEOUT => 10,
            ]);
            $pdo->exec('PRAGMA busy_timeout = 10000');
        }
    } catch (PDOException $e) {
        $pdo = null;
        wz_fail('dbOpen', [$e->getMessage()]);
    }
    wz_schema_sync($pdo);
    return $pdo;
}

function wz_sql_type($type) {
    $mysql = wz_db_type() === 'mysql';
    $map = $mysql
        ? ['text' => 'VARCHAR(255)', 'longtext' => 'TEXT', 'number' => 'DOUBLE', 'integer' => 'INT', 'yesno' => 'TINYINT(1)', 'date' => 'DATE', 'datetime' => 'DATETIME']
        : ['text' => 'TEXT', 'longtext' => 'TEXT', 'number' => 'REAL', 'integer' => 'INTEGER', 'yesno' => 'INTEGER', 'date' => 'TEXT', 'datetime' => 'TEXT'];
    return $map[$type] ?? $map['text'];
}

function wz_meta_get($pdo, $k) {
    $st = $pdo->prepare('SELECT v FROM wemazy_meta WHERE k = ?');
    $st->execute([$k]);
    $v = $st->fetchColumn();
    return $v === false ? null : $v;
}
function wz_meta_set($pdo, $k, $v) {
    $st = $pdo->prepare('REPLACE INTO wemazy_meta (k, v) VALUES (?, ?)');
    $st->execute([$k, (string) $v]);
}
function wz_table_exists($pdo, $name) {
    if (wz_db_type() === 'mysql') {
        $st = $pdo->prepare('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?');
    } else {
        $st = $pdo->prepare("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?");
    }
    $st->execute([$name]);
    return (int) $st->fetchColumn() > 0;
}
function wz_table_columns($pdo, $name) {
    $cols = [];
    if (wz_db_type() === 'mysql') {
        foreach ($pdo->query('SHOW COLUMNS FROM ' . $name)->fetchAll() as $r) { $cols[] = strtolower($r['Field']); }
    } else {
        foreach ($pdo->query('PRAGMA table_info(' . $name . ')')->fetchAll() as $r) { $cols[] = strtolower($r['name']); }
    }
    return $cols;
}
function wz_seed_hash($rows) { return md5(json_encode($rows ?? [], wz_json_flags())); }

/** Makes the database match the tables of the project: creates tables, adds columns, fills starting rows. */
function wz_schema_sync($pdo) {
    $schema = function_exists('wz_schema') ? wz_schema() : [];
    $mysql = wz_db_type() === 'mysql';
    $pdo->exec('CREATE TABLE IF NOT EXISTS wemazy_meta (k VARCHAR(190) PRIMARY KEY, v TEXT)');
    $hash = md5(json_encode($schema, wz_json_flags()));
    if (wz_meta_get($pdo, 'schema') === $hash) { return; }
    foreach ($schema as $name => $t) {
        $existed = wz_table_exists($pdo, $name);
        if (!$existed) {
            $cols = [$mysql ? 'id INT AUTO_INCREMENT PRIMARY KEY' : 'id INTEGER PRIMARY KEY AUTOINCREMENT'];
            foreach ($t['columns'] as $c => $type) { $cols[] = $c . ' ' . wz_sql_type($type); }
            $pdo->exec('CREATE TABLE ' . $name . ' (' . implode(', ', $cols) . ')' . ($mysql ? ' DEFAULT CHARSET=utf8mb4' : ''));
        } else {
            $have = wz_table_columns($pdo, $name);
            foreach ($t['columns'] as $c => $type) {
                if (!in_array(strtolower($c), $have, true)) {
                    $pdo->exec('ALTER TABLE ' . $name . ' ADD COLUMN ' . $c . ' ' . wz_sql_type($type));
                }
            }
        }
        $seed = wz_seed_hash($t['rows'] ?? []);
        $oldSeed = wz_meta_get($pdo, 'seed:' . $name);
        $dirty = wz_meta_get($pdo, 'dirty:' . $name) === '1';
        if (!$existed || ($oldSeed !== $seed && !$dirty)) {
            if ($existed) { $pdo->exec('DELETE FROM ' . $name); }
            foreach (($t['rows'] ?? []) as $row) {
                $names = []; $vals = [];
                foreach ($t['columns'] as $c => $type) {
                    if (!array_key_exists($c, $row)) { continue; }
                    $names[] = $c;
                    $vals[] = wz_coerce($type, $row[$c]);
                }
                if ($names) {
                    $st = $pdo->prepare('INSERT INTO ' . $name . ' (' . implode(', ', $names) . ') VALUES (' . implode(', ', array_fill(0, count($names), '?')) . ')');
                    $st->execute(wz_bind($vals));
                }
            }
            wz_meta_set($pdo, 'seed:' . $name, $seed);
            wz_meta_set($pdo, 'dirty:' . $name, '0');
        }
    }
    wz_meta_set($pdo, 'schema', $hash);
}

function wz_table($name) {
    $schema = function_exists('wz_schema') ? wz_schema() : [];
    foreach ($schema as $n => $t) {
        if (strtolower($n) === strtolower($name)) { return [$n, $t]; }
    }
    wz_fail('noTable', [$name]);
}
function wz_mark_dirty($table) {
    static $done = [];
    if (isset($done[$table])) { return; }
    $done[$table] = true;
    wz_meta_set(wz_db(), 'dirty:' . $table, '1');
}

/** The value as the column keeps it (same rules as the browser test server). */
function wz_coerce($type, $v) {
    if ($v === null) { return null; }
    switch ($type) {
        case 'number':
        case 'integer':
            if (is_bool($v)) { return $v ? 1 : 0; }
            if (wz_is_numval($v)) { return $type === 'integer' ? (int) round($v) : $v; }
            if (is_string($v)) {
                if (trim($v) === '') { return null; }
                if (wz_num_like($v)) { $n = wz_num($v); return $type === 'integer' ? (int) round($n) : $n; }
                return $v;
            }
            return wz_text($v);
        case 'yesno':
            if (is_string($v)) {
                $s = strtolower(trim($v));
                return !in_array($s, ['', '0', 'false', 'no', 'fals', 'nu'], true);
            }
            return wz_truthy($v);
        default:
            if (is_string($v)) { return $v; }
            if (is_array($v)) { return json_encode($v, wz_json_flags()); }
            return wz_text($v);
    }
}
function wz_bind($params) {
    $out = [];
    foreach (array_values($params) as $v) {
        if (is_bool($v)) { $out[] = $v ? 1 : 0; }
        elseif (is_array($v)) { $out[] = json_encode($v, wz_json_flags()); }
        else { $out[] = $v; }
    }
    return $out;
}
/** Rows come back with the same types as in the browser test server. */
function wz_cast_row($t, $row) {
    $types = ['id' => 'integer'];
    foreach ($t['columns'] as $c => $type) { $types[strtolower($c)] = $type; }
    $out = [];
    foreach ($row as $k => $v) {
        $type = $types[strtolower($k)] ?? null;
        if ($v === null || $type === null) { $out[$k] = $v; continue; }
        if ($type === 'number' || $type === 'integer') {
            if (is_string($v)) {
                if ($v === '') { $out[$k] = null; continue; }
                if (!wz_num_like($v)) { $out[$k] = $v; continue; }
                $v = wz_num($v);
            }
            if (is_float($v) && floor($v) == $v && abs($v) < 1e15) { $v = (int) $v; }
            $out[$k] = $v;
        } elseif ($type === 'yesno') {
            $out[$k] = (bool) (int) $v;
        } else {
            $out[$k] = is_string($v) ? $v : wz_text($v);
        }
    }
    return $out;
}

function wz_like($v, $kind) {
    $s = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], wz_text($v));
    if ($kind === 'contains') { return '%' . $s . '%'; }
    if ($kind === 'starts') { return $s . '%'; }
    return '%' . $s;
}
function wz_prepare($sql) {
    $sql = str_replace('{RANDOM}', wz_db_type() === 'mysql' ? 'RAND()' : 'RANDOM()', $sql);
    return wz_db()->prepare($sql);
}
function wz_coerce_params($table, $params, $cols) {
    if (!$cols) { return $params; }
    [, $t] = wz_table($table);
    $types = [];
    foreach ($t['columns'] as $c => $type) { $types[strtolower($c)] = $type; }
    foreach ($params as $i => $v) {
        $c = $cols[$i] ?? null;
        if ($c !== null && isset($types[strtolower($c)])) { $params[$i] = wz_coerce($types[strtolower($c)], $v); }
    }
    return $params;
}

function wz_select($table, $sql, $params, $mode, $limit) {
    [, $t] = wz_table($table);
    if ($mode === 'first') { $limit = 1; }
    if ($limit !== null) { $sql .= ' LIMIT ' . max(0, (int) floor(wz_num($limit))); }
    $st = wz_prepare($sql);
    $st->execute(wz_bind($params));
    $rows = [];
    foreach ($st->fetchAll() as $r) { $rows[] = wz_cast_row($t, $r); }
    return $mode === 'first' ? ($rows[0] ?? null) : $rows;
}
function wz_count($table, $sql, $params) {
    wz_table($table);
    $st = wz_prepare($sql);
    $st->execute(wz_bind($params));
    return (int) $st->fetchColumn();
}
function wz_exec($table, $sql, $params, $cols = []) {
    [$name] = wz_table($table);
    $st = wz_prepare($sql);
    $st->execute(wz_bind(wz_coerce_params($table, $params, $cols)));
    $n = $st->rowCount();
    if ($n > 0) { wz_mark_dirty($name); }
    return $n;
}
function wz_insert_sql($table, $sql, $params, $cols = []) {
    [$name] = wz_table($table);
    $st = wz_prepare($sql);
    $st->execute(wz_bind(wz_coerce_params($table, $params, $cols)));
    wz_mark_dirty($name);
    return (int) wz_db()->lastInsertId();
}
function wz_insert($table, $rec) {
    [$name, $t] = wz_table($table);
    if (!wz_is_rec($rec)) { wz_fail('notRecord', [$name]); }
    $byLower = [];
    foreach ($t['columns'] as $c => $type) { $byLower[strtolower($c)] = [$c, $type]; }
    $names = []; $vals = [];
    foreach ($rec as $k => $v) {
        $lk = strtolower((string) $k);
        if ($lk === 'id') { continue; }
        if (!isset($byLower[$lk])) { wz_fail('noColumn', [$name, $k]); }
        $names[] = $byLower[$lk][0];
        $vals[] = wz_coerce($byLower[$lk][1], $v);
    }
    $sql = $names
        ? 'INSERT INTO ' . $name . ' (' . implode(', ', $names) . ') VALUES (' . implode(', ', array_fill(0, count($names), '?')) . ')'
        : (wz_db_type() === 'mysql' ? 'INSERT INTO ' . $name . ' () VALUES ()' : 'INSERT INTO ' . $name . ' DEFAULT VALUES');
    $st = wz_prepare($sql);
    $st->execute(wz_bind($vals));
    wz_mark_dirty($name);
    return (int) wz_db()->lastInsertId();
}
/** Your own SQL: sql("SELECT ...", [values]) */
function wz_sql($query, $params = null) {
    $st = wz_prepare(wz_text($query));
    $st->execute(wz_bind(wz_is_list($params) ? $params : ($params === null ? [] : [$params])));
    if ($st->columnCount() > 0) { return $st->fetchAll(); }
    return $st->rowCount();
}

/* ------------------------------------------------------------------ the API the pages call */

function wz_api() {
    $cfg = wz_config();
    ini_set('display_errors', '0');
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store');
    set_error_handler(function ($no, $str, $file, $line) {
        if (!(error_reporting() & $no)) { return false; }
        throw new ErrorException($str, 0, $no, $file, $line);
    });
    $out = function ($data, $code = 200) {
        http_response_code($code);
        $data['log'] = $GLOBALS['wz_log'];
        echo json_encode($data, wz_json_flags() | JSON_PARTIAL_OUTPUT_ON_ERROR);
    };
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { $out(['ok' => false, 'error' => 'Use POST.'], 405); return; }
    $ct = $_SERVER['CONTENT_TYPE'] ?? ($_SERVER['HTTP_CONTENT_TYPE'] ?? '');
    if (stripos($ct, 'application/json') === false) { $out(['ok' => false, 'error' => 'Send JSON.'], 415); return; }
    $body = file_get_contents('php://input', false, null, 0, 4 * 1024 * 1024);
    $in = json_decode((string) $body, true);
    if (!is_array($in)) { $out(['ok' => false, 'error' => 'Send JSON.'], 400); return; }
    try {
        // objects of classes come as JSON ({"$class": "Dog", ...}) and become objects again
        $args = isset($in['args']) && is_array($in['args']) ? wz_revive(array_values($in['args'])) : [];
        if (isset($in['fn'])) {
            $fns = wz_functions();
            $key = null;
            foreach ($fns as $name => $f) { if (strtolower($name) === strtolower((string) $in['fn'])) { $key = $name; } }
            if ($key === null) { wz_fail('noFunction', [(string) $in['fn']]); }
            $value = call_user_func_array($fns[$key], $args);
        } elseif (isset($in['q'])) {
            $qs = wz_queries();
            $q = (string) $in['q'];
            if (!isset($qs[$q])) { wz_fail('noQuery'); }
            $value = $qs[$q]($args);
        } else {
            $out(['ok' => false, 'error' => 'Nothing to do.'], 400);
            return;
        }
        $out(['ok' => true, 'value' => $value]);
    } catch (Throwable $e) {
        $where = $GLOBALS['wz_where'];
        $msg = ($e instanceof WzError || !empty($cfg['debug'])) ? $e->getMessage() : wz_msg('serverError');
        if (!($e instanceof WzError)) { error_log('Wemazy: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine()); }
        $out(['ok' => false, 'error' => $msg, 'file' => $where[0], 'line' => $where[1]]);
    }
}
`;

  if (typeof module !== 'undefined' && module.exports) module.exports = W.runtime.php;
})(typeof window !== 'undefined' ? window : globalThis);
