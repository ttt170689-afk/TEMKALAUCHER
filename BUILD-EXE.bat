@echo off
setlocal
rem ============================================================
rem  Self-logging wrapper: everything is captured to BUILD-LOG.txt
rem  so the window never closes without a trace.
rem ============================================================
if not "%~1"=="run" (
  call "%~f0" run > "%~dp0BUILD-LOG.txt" 2>&1
  type "%~dp0BUILD-LOG.txt"
  echo.
  echo  Full log saved to: %~dp0BUILD-LOG.txt
  pause
  exit /b 0
)

title TemkaLauncher - EXE build (Neutralino, no Electron)

echo.
echo ====================================================
echo  TEMKALAUNCHER - building EXE without Electron
echo  engine: Neutralino (system WebView2, about 2 MB)
echo ====================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js not found.
  echo     Install LTS from https://nodejs.org and run this file again.
  exit /b 1
)

if not exist node_modules (
  echo [0/6] First run - installing dependencies, about 1-2 minutes...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo [x] npm install failed. Check your internet connection and retry.
    exit /b 1
  )
) else (
  echo [0/6] Dependencies already installed - skipping.
)

echo [1/6] Building the launcher web part...
call npm run build
if errorlevel 1 exit /b 1

echo [2/6] Creating Neutralino project (downloads about 2 MB)...
if exist temka-build rd /s /q temka-build
call npx --yes @neutralinojs/neu create temka-build
if errorlevel 1 exit /b 1

echo [3/6] Putting the launcher into the app resources...
copy /Y dist\index.html temka-build\resources\index.html >nul
if exist dist\updates xcopy dist\updates temka-build\resources\updates\ /e /i /y >nul
rem update packages live in the project root - copy them too
if exist updates xcopy updates temka-build\resources\updates\ /e /i /y >nul
if exist version.json copy /Y version.json temka-build\resources\version.json >nul
if exist dist\icon.png copy /Y dist\icon.png temka-build\resources\icon.png >nul
if exist dist\manifest.webmanifest copy /Y dist\manifest.webmanifest temka-build\resources\ >nul
if exist dist\sw.js copy /Y dist\sw.js temka-build\resources\ >nul

echo [4/6] Setting window title and size...
powershell -NoProfile -Command "$f='temka-build\neutralino.config.json'; $j=Get-Content $f -Raw | ConvertFrom-Json; $j.applicationId='com.temka.launcher'; $j.modes.window.title='TemkaLauncher'; $j.modes.window.width=1380; $j.modes.window.height=880; $j.modes.window.minWidth=1024; $j.modes.window.minHeight=640; $j.modes.window.enableInspector=$false; $j.modes.window.exitProcessOnClose=$false; $j.enableNativeAPI=$true; $j | ConvertTo-Json -Depth 12 | Set-Content $f" >nul 2>nul

echo [5/6] Building the EXE...
cd temka-build || exit /b 1
call npx --yes @neutralinojs/neu update >nul 2>nul
call npx --yes @neutralinojs/neu build
if errorlevel 1 (
  cd ..
  exit /b 1
)
cd ..

echo [6/6] Packing the app folder...
set "APPDIR="
for /r temka-build\dist %%f in (*-win_x64.exe) do set "APPDIR=%%~dpf"
if not defined APPDIR (
  echo [x] EXE not found inside temka-build\dist
  exit /b 1
)
for %%g in ("%APPDIR%*-win_x64.exe") do ren "%%g" TemkaLauncher.exe
if exist TemkaLauncher-app rd /s /q TemkaLauncher-app
xcopy "%APPDIR%*" "TemkaLauncher-app\" /e /i /y >nul

echo.
if exist TemkaLauncher-app\TemkaLauncher.exe (
  echo ====================================================
  echo  DONE!
  echo  App folder: %cd%\TemkaLauncher-app
  echo  Run:        TemkaLauncher-app\TemkaLauncher.exe
  echo  A real launcher window will open.
  echo ====================================================
) else (
  echo [x] Something went wrong while packing - check the log above.
)
exit /b 0
