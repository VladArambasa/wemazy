@echo off
rem Wemazy - start it on this computer with PHP, then open it in the browser.
rem Wemazy - porneste-l pe acest calculator cu PHP, apoi deschide-l in browser.
rem Without PHP you can still open index.html: everything works in the browser.
setlocal
cd /d "%~dp0"
set PORT=8790

where php >nul 2>nul
if errorlevel 1 goto nophp
php -r "exit(version_compare(PHP_VERSION, '8.1.0', '>=') ? 0 : 1);"
if errorlevel 1 goto oldphp

rem pdo_sqlite is needed for the databases of the sites
set "EXTRA="
php -m 2>nul | findstr /i /r /c:"^pdo_sqlite" >nul
if not errorlevel 1 goto run
for %%i in (php.exe) do set "PHPDIR=%%~dp$PATH:i"
set EXTRA=-d "extension_dir=%PHPDIR%ext" -d extension=pdo_sqlite
echo pdo_sqlite was off in php.ini: Wemazy turns it on for this window.

:run
echo.
echo   Wemazy is running: http://localhost:%PORT%/
echo   Wemazy ruleaza:    http://localhost:%PORT%/
echo.
echo   Close this window to stop it. / Inchide fereastra ca sa-l opresti.
echo.
start "" /min cmd /c "ping -n 3 127.0.0.1 >nul & start "" http://localhost:%PORT%/"
php -d opcache.enable=0 -d post_max_size=80M -d upload_max_filesize=80M -d memory_limit=512M %EXTRA% -S localhost:%PORT% -t . server/router.php
pause
exit /b 0

:nophp
echo PHP was not found. Install PHP 8.1 or newer and add it to PATH: https://windows.php.net/download/
echo PHP nu a fost gasit. Instaleaza PHP 8.1 sau mai nou si adauga-l in PATH.
echo.
echo You can still use Wemazy without PHP: open index.html in your browser.
echo Poti folosi Wemazy si fara PHP: deschide index.html in browser.
pause
exit /b 1

:oldphp
echo Wemazy needs PHP 8.1 or newer. / Wemazy are nevoie de PHP 8.1 sau mai nou.
php -v
pause
exit /b 1
