<?php
/*
 * Wemazy - the server part (optional).
 *
 * When Wemazy is opened from a PHP server instead of as a file, the IDE uses this
 * file to keep projects on the server (data/) and to start websites with real PHP
 * and a real database (sites/<name>/).
 *
 * Settings: server/config.php. Needs PHP 8.1+ (pdo_sqlite to run sites with a database).
 *
 * Wemazy - partea de server (opțională): păstrează proiectele pe server și pornește
 * site-urile cu PHP și bază de date adevărate. Setări: server/config.php.
 */
declare(strict_types=1);

const WEMAZY_VERSION = '1.0.0';

$WZ_ROOT = dirname(__DIR__);
$WZ = [
    // Empty password: Wemazy works only on the computer it runs on (localhost).
    // Set a password to use it from other computers (for example on a school server).
    'password' => '',
    'data_dir' => $WZ_ROOT . '/data',
    'sites_dir' => $WZ_ROOT . '/sites',
    'max_mb' => 64,
];
if (is_file(__DIR__ . '/config.php')) {
    $user = include __DIR__ . '/config.php';
    if (is_array($user)) { $WZ = array_merge($WZ, $user); }
}

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
header('Referrer-Policy: same-origin');

set_error_handler(function (int $no, string $str, string $file, int $line): bool {
    if (!(error_reporting() & $no)) { return false; }
    throw new ErrorException($str, 0, $no, $file, $line);
});

/** Send an answer and stop. */
function wz_reply(array $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
function wz_fail_api(string $message, string $code = 'error', int $http = 400): never
{
    wz_reply(['ok' => false, 'error' => $message, 'code' => $code], $http);
}

/* ---------------------------------------------------------------- who may use it */

function wz_is_local(): bool
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    if ($ip === '127.0.0.1' || $ip === '::1' || str_starts_with($ip, '127.')) { return true; }
    return str_starts_with($ip, '::ffff:127.');
}
function wz_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) { return; }
    $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    $path = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/server/api.php')), '/') . '/';
    session_name('wemazy_ide');
    session_set_cookie_params(['lifetime' => 0, 'path' => $path, 'httponly' => true, 'samesite' => 'Strict', 'secure' => $https]);
    session_start();
}
function wz_password_ok(string $given, string $want): bool
{
    if ($want === '') { return false; }
    if (preg_match('/^\$(2y|2a|argon2i|argon2id)\$/', $want)) { return password_verify($given, $want); }
    return hash_equals($want, $given);
}

/* ---------------------------------------------------------------- files */

function wz_dir(string $path): string
{
    if (!is_dir($path) && !@mkdir($path, 0775, true) && !is_dir($path)) {
        wz_fail_api('Cannot create the folder ' . $path . '. Make the Wemazy folder writable for PHP.', 'not_writable', 500);
    }
    return $path;
}
function wz_protect(string $dir): void
{
    // Apache: never send these files to a browser. (start-windows.cmd uses server/router.php for that.)
    if (!is_file($dir . '/.htaccess')) { @file_put_contents($dir . '/.htaccess', "Require all denied\n"); }
    if (!is_file($dir . '/index.html')) { @file_put_contents($dir . '/index.html', ''); }
}
/** Write a file so that it is never half written. */
function wz_write(string $file, string $data): void
{
    wz_dir(dirname($file));
    $tmp = $file . '.' . bin2hex(random_bytes(4)) . '.tmp';
    if (@file_put_contents($tmp, $data, LOCK_EX) === false) {
        wz_fail_api('Cannot write ' . basename($file) . '. Is the disk full or the folder read-only?', 'not_writable', 500);
    }
    if (!@rename($tmp, $file)) {
        @unlink($file);
        if (!@rename($tmp, $file)) { @unlink($tmp); wz_fail_api('Cannot save ' . basename($file) . '.', 'not_writable', 500); }
    }
}
function wz_read_json(string $file): mixed
{
    if (!is_file($file)) { return null; }
    $t = @file_get_contents($file);
    return $t === false ? null : json_decode($t, true);
}
function wz_check_id(mixed $id): string
{
    $id = is_string($id) ? $id : '';
    if (!preg_match('/^[A-Za-z0-9_-]{1,80}$/', $id)) { wz_fail_api('Bad project id.', 'bad_id'); }
    return $id;
}
function wz_rmdir(string $dir, array $keep = []): void
{
    if (!is_dir($dir)) { return; }
    foreach (scandir($dir) ?: [] as $f) {
        if ($f === '.' || $f === '..' || in_array($f, $keep, true)) { continue; }
        $p = $dir . '/' . $f;
        if (is_dir($p) && !is_link($p)) { wz_rmdir($p); @rmdir($p); }
        else { @unlink($p); }
    }
}
/** A folder name from the name of a project: "My Site!" -> "my-site" */
function wz_slug(string $s): string
{
    $map = ['ă' => 'a', 'â' => 'a', 'î' => 'i', 'ș' => 's', 'ş' => 's', 'ț' => 't', 'ţ' => 't', 'Ă' => 'a', 'Â' => 'a', 'Î' => 'i', 'Ș' => 's', 'Ş' => 's', 'Ț' => 't', 'Ţ' => 't'];
    $s = strtr($s, $map);
    if (function_exists('iconv')) { $t = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s); if (is_string($t)) { $s = $t; } }
    $s = strtolower(preg_replace('/[^A-Za-z0-9]+/', '-', $s) ?? '');
    $s = trim($s, '-');
    return substr($s !== '' ? $s : 'site', 0, 48);
}

/* ---------------------------------------------------------------- the request */

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') { wz_fail_api('Use POST.', 'method', 405); }
$ct = $_SERVER['CONTENT_TYPE'] ?? ($_SERVER['HTTP_CONTENT_TYPE'] ?? '');
if (stripos($ct, 'application/json') === false) { wz_fail_api('Send JSON.', 'content_type', 415); }
// a page of another website must not be able to use this server
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && $origin !== 'null') {
    $host = $_SERVER['HTTP_HOST'] ?? '';
    $oh = parse_url($origin, PHP_URL_HOST) . (parse_url($origin, PHP_URL_PORT) ? ':' . parse_url($origin, PHP_URL_PORT) : '');
    if (strcasecmp($oh, $host) !== 0) { wz_fail_api('Not allowed from another website.', 'origin', 403); }
}
$len = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
$body = (string) file_get_contents('php://input');
if ($len > 0 && $body === '') {
    wz_fail_api('The project is too big for this PHP server (post_max_size is ' . ini_get('post_max_size') . '). Raise post_max_size and upload_max_filesize in php.ini, or use smaller pictures.', 'too_big', 413);
}
if (strlen($body) > (int) $WZ['max_mb'] * 1024 * 1024) { wz_fail_api('The project is bigger than ' . (int) $WZ['max_mb'] . ' MB.', 'too_big', 413); }
$in = json_decode($body, true);
if (!is_array($in)) { wz_fail_api('Send JSON.', 'bad_json'); }
$action = is_string($in['action'] ?? null) ? $in['action'] : '';

$password = (string) ($WZ['password'] ?? '');
$needsPassword = $password !== '';
$authed = false;
if ($needsPassword) {
    wz_session();
    $authed = !empty($_SESSION['wemazy_ok']);
} else {
    $authed = wz_is_local();
}

if ($action === 'ping') {
    $dataOk = is_dir($WZ['data_dir']) ? is_writable($WZ['data_dir']) : is_writable(dirname($WZ['data_dir']));
    wz_reply([
        'ok' => true,
        'app' => 'wemazy',
        'version' => WEMAZY_VERSION,
        'php' => PHP_VERSION,
        'sqlite' => extension_loaded('pdo_sqlite'),
        'mysql' => extension_loaded('pdo_mysql'),
        'writable' => $dataOk,
        'needsPassword' => $needsPassword,
        'authed' => $authed,
        'locked' => !$needsPassword && !$authed,
    ]);
}
if ($action === 'login') {
    if (!$needsPassword) { wz_reply(['ok' => true]); }
    $given = is_string($in['password'] ?? null) ? $in['password'] : '';
    if (!wz_password_ok($given, $password)) {
        usleep(400000);
        wz_fail_api('Wrong password. / Parolă greșită.', 'bad_password', 403);
    }
    session_regenerate_id(true);
    $_SESSION['wemazy_ok'] = true;
    wz_reply(['ok' => true]);
}
if ($action === 'logout') {
    if ($needsPassword) { $_SESSION = []; session_destroy(); }
    wz_reply(['ok' => true]);
}
if (!$authed) {
    if ($needsPassword) { wz_fail_api('Sign in first. / Intră întâi cu parola.', 'login', 401); }
    wz_fail_api('This Wemazy server has no password, so it only works on its own computer. Set a password in server/config.php.', 'locked', 403);
}
if ($needsPassword && session_status() === PHP_SESSION_ACTIVE) { session_write_close(); }

$data = $WZ['data_dir'];
$projects = $data . '/projects';
$packs = $data . '/packs';

/* ---------------------------------------------------------------- the actions */

/** The list of projects (kept in data/projects/index.json). */
function wz_index(string $dir): array
{
    $idx = wz_read_json($dir . '/index.json');
    if (is_array($idx)) { return $idx; }
    // rebuild it from the project files
    $out = [];
    foreach (glob($dir . '/*.json') ?: [] as $f) {
        if (basename($f) === 'index.json') { continue; }
        $p = wz_read_json($f);
        if (!is_array($p) || !isset($p['id'])) { continue; }
        $out[] = ['id' => $p['id'], 'name' => $p['name'] ?? $p['id'], 'modified' => $p['modified'] ?? date('c', (int) filemtime($f)), 'size' => (int) filesize($f), 'template' => $p['template'] ?? ''];
    }
    usort($out, fn ($a, $b) => strcmp((string) $b['modified'], (string) $a['modified']));
    return $out;
}
function wz_index_update(string $dir, callable $change): void
{
    wz_dir($dir);
    $lock = fopen($dir . '/.lock', 'c');
    if ($lock) { flock($lock, LOCK_EX); }
    try {
        $idx = $change(wz_index($dir));
        wz_write($dir . '/index.json', json_encode(array_values($idx), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
    } finally {
        if ($lock) { flock($lock, LOCK_UN); fclose($lock); }
    }
}

switch ($action) {
    case 'list':
        wz_reply(['ok' => true, 'projects' => is_dir($projects) ? wz_index($projects) : []]);

    case 'load': {
        $id = wz_check_id($in['id'] ?? null);
        $p = wz_read_json($projects . '/' . $id . '.json');
        if (!is_array($p)) { wz_fail_api('The project was not found.', 'not_found', 404); }
        wz_reply(['ok' => true, 'project' => $p]);
    }

    case 'save': {
        $p = $in['project'] ?? null;
        if (!is_array($p)) { wz_fail_api('No project.', 'bad_project'); }
        $id = wz_check_id($p['id'] ?? null);
        wz_dir($data);
        wz_protect($data);
        wz_dir($projects);
        $json = json_encode($p, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
        if ($json === false) { wz_fail_api('The project could not be saved.', 'bad_project'); }
        wz_write($projects . '/' . $id . '.json', $json);
        wz_index_update($projects, function (array $idx) use ($p, $id, $json) {
            $idx = array_values(array_filter($idx, fn ($x) => ($x['id'] ?? '') !== $id));
            array_unshift($idx, [
                'id' => $id,
                'name' => is_string($p['name'] ?? null) ? $p['name'] : $id,
                'modified' => is_string($p['modified'] ?? null) ? $p['modified'] : date('c'),
                'size' => strlen($json),
                'template' => is_string($p['template'] ?? null) ? $p['template'] : '',
            ]);
            return $idx;
        });
        wz_reply(['ok' => true]);
    }

    case 'delete': {
        $id = wz_check_id($in['id'] ?? null);
        @unlink($projects . '/' . $id . '.json');
        if (is_dir($projects)) {
            wz_index_update($projects, fn (array $idx) => array_values(array_filter($idx, fn ($x) => ($x['id'] ?? '') !== $id)));
        }
        wz_reply(['ok' => true]);
    }

    case 'packs': {
        $out = [];
        foreach (glob($packs . '/*.json') ?: [] as $f) {
            $pk = wz_read_json($f);
            if (is_array($pk) && isset($pk['id'])) { $out[] = $pk; }
        }
        wz_reply(['ok' => true, 'packs' => $out]);
    }

    case 'savepack': {
        $pk = $in['pack'] ?? null;
        if (!is_array($pk)) { wz_fail_api('No language pack.', 'bad_pack'); }
        $id = is_string($pk['id'] ?? null) ? $pk['id'] : '';
        if (!preg_match('/^[A-Za-z0-9_.-]{1,80}$/', $id) || str_contains($id, '..')) { wz_fail_api('Bad pack id.', 'bad_pack'); }
        wz_dir($data);
        wz_protect($data);
        wz_write($packs . '/' . $id . '.json', (string) json_encode($pk, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
        wz_reply(['ok' => true]);
    }

    case 'deletepack': {
        $id = is_string($in['id'] ?? null) ? $in['id'] : '';
        if (!preg_match('/^[A-Za-z0-9_.-]{1,80}$/', $id) || str_contains($id, '..')) { wz_fail_api('Bad pack id.', 'bad_pack'); }
        @unlink($packs . '/' . $id . '.json');
        wz_reply(['ok' => true]);
    }

    case 'deploy': {
        // write the files of a site to sites/<name>/ and give its address
        $id = wz_check_id($in['id'] ?? null);
        $files = $in['files'] ?? null;
        if (!is_array($files) || !$files) { wz_fail_api('No files.', 'bad_files'); }
        $sitesDir = wz_dir($WZ['sites_dir']);
        if (!is_file($sitesDir . '/index.html')) { @file_put_contents($sitesDir . '/index.html', ''); }
        $map = wz_read_json($data . '/sites.json');
        $map = is_array($map) ? $map : [];
        $slug = $map[$id] ?? null;
        if (!is_string($slug) || !preg_match('/^[a-z0-9-]{1,60}$/', $slug)) {
            $base = wz_slug(is_string($in['name'] ?? null) ? $in['name'] : 'site');
            $slug = $base;
            $n = 2;
            $taken = array_flip(array_values($map));
            while (isset($taken[$slug]) || (is_dir($sitesDir . '/' . $slug) && !in_array($slug, $map, true))) { $slug = $base . '-' . $n++; }
            $map[$id] = $slug;
            wz_dir($data);
            wz_protect($data);
            wz_write($data . '/sites.json', (string) json_encode($map, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        }
        $site = wz_dir($sitesDir . '/' . $slug);
        // the database of the site (data/) stays; everything else is written again
        wz_rmdir($site, ['data']);
        foreach ($files as $name => $f) {
            $name = (string) $name;
            if (!preg_match('#^[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)*$#', $name) || str_contains($name, '..') || strlen($name) > 200) {
                wz_fail_api('Bad file name: ' . $name, 'bad_files');
            }
            if (!is_array($f)) { continue; }
            if (isset($f['b64']) && is_string($f['b64'])) {
                $bytes = base64_decode($f['b64'], true);
                if ($bytes === false) { wz_fail_api('Bad file: ' . $name, 'bad_files'); }
            } else {
                $bytes = is_string($f['text'] ?? null) ? $f['text'] : '';
            }
            $target = $site . '/' . $name;
            // the data folder of the site keeps its database: only add missing files there
            if (str_starts_with($name, 'data/') && is_file($target)) { continue; }
            wz_dir(dirname($target));
            if (@file_put_contents($target, $bytes) === false) { wz_fail_api('Cannot write ' . $name . '.', 'not_writable', 500); }
        }
        wz_reply(['ok' => true, 'url' => 'sites/' . $slug . '/', 'folder' => $slug]);
    }

    case 'resetdata': {
        $id = wz_check_id($in['id'] ?? null);
        $map = wz_read_json($data . '/sites.json');
        $slug = is_array($map) ? ($map[$id] ?? null) : null;
        if (!is_string($slug) || !preg_match('/^[a-z0-9-]{1,60}$/', $slug)) { wz_fail_api('This project was not started on the server yet.', 'not_found', 404); }
        $dir = $WZ['sites_dir'] . '/' . $slug . '/data';
        foreach (glob($dir . '/*.sqlite*') ?: [] as $f) { @unlink($f); }
        wz_reply(['ok' => true]);
    }
}

wz_fail_api('Unknown action.', 'action');
