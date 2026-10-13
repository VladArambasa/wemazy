<?php
/*
 * Wemazy - router for PHP's built-in web server (used by start-windows.cmd and
 * start-mac-linux.sh). It keeps the private folders private, like the .htaccess
 * files do on Apache, and lets PHP serve everything else.
 */
$path = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));
$path = str_replace('\\', '/', $path);

$private = preg_match('#(^|/)\.#', $path)                       // hidden files (.htaccess, .lock)
    || preg_match('#^/data(/|$)#i', $path)                         // projects kept by the IDE
    || preg_match('#^/sites/[^/]+/(data|wemazy)(/|$)#i', $path)  // databases and server code of the sites
    || preg_match('#^/server/(?!api\.php$)#i', $path)             // settings of the server
    || preg_match('#^/tests(/|$)#i', $path);

if ($private) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo "403 - private\n";
    return true;
}
return false;
