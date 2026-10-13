#!/bin/sh
# Wemazy - start it on this computer with PHP, then open it in the browser.
# Wemazy - porneste-l pe acest calculator cu PHP, apoi deschide-l in browser.
# Without PHP you can still open index.html: everything works in the browser.

cd "$(dirname "$0")" || exit 1
PORT="${PORT:-8790}"

if ! command -v php >/dev/null 2>&1; then
  echo "PHP was not found. Install PHP 8.1 or newer:"
  echo "  macOS:  brew install php"
  echo "  Ubuntu: sudo apt install php-cli php-sqlite3"
  echo "You can still use Wemazy without PHP: open index.html in your browser."
  exit 1
fi
if ! php -r 'exit(version_compare(PHP_VERSION, "8.1.0", ">=") ? 0 : 1);'; then
  echo "Wemazy needs PHP 8.1 or newer. / Wemazy are nevoie de PHP 8.1 sau mai nou."
  php -v
  exit 1
fi
if ! php -m | grep -qix "pdo_sqlite"; then
  echo "Note: pdo_sqlite is missing, so sites with a database will not run on PHP."
  echo "      Ubuntu: sudo apt install php-sqlite3"
fi

URL="http://localhost:$PORT/"
echo ""
echo "  Wemazy is running: $URL"
echo "  Ctrl+C stops it. / Ctrl+C il opreste."
echo ""
(
  sleep 1
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"
  elif command -v open >/dev/null 2>&1; then open "$URL"
  fi
) >/dev/null 2>&1 &
exec php -d post_max_size=80M -d upload_max_filesize=80M -d memory_limit=512M -S "localhost:$PORT" -t . server/router.php
