@echo off
setlocal
rem ============================================================
rem  Electron build - one double click.
rem  Everything is logged to BUILD-ELECTRON-LOG.txt.
rem ============================================================
if not "%~1"=="run" (
  call "%~f0" run > "%~dp0BUILD-ELECTRON-LOG.txt" 2>&1
  type "%~dp0BUILD-ELECTRON-LOG.txt"
  echo.
  echo  Full log: %~dp0BUILD-ELECTRON-LOG.txt
  pause
  exit /b 0
)

title TemkaLauncher - ELECTRON build
color 0E

echo.
echo ====================================================
echo  TEMKALAUNCHER - ELECTRON BUILD
echo  native tray, real installer, about 110 MB download
echo ====================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js not found - install LTS from https://nodejs.org
  exit /b 1
)

if not exist node_modules (
  echo [1/4] Installing base dependencies...
  call npm install --no-audit --no-fund
  if errorlevel 1 exit /b 1
) else (
  echo [1/4] Base dependencies OK.
)

if not exist node_modules\electron (
  echo [2/4] Downloading Electron, about 110 MB, once...
  call npm install --save-dev electron electron-builder --no-audit --no-fund
  if errorlevel 1 (
    echo [x] Electron download failed. Try again or use BUILD-EXE.bat.
    exit /b 1
  )
) else (
  echo [2/4] Electron already installed.
)

echo [3/4] Building the launcher...
call npm run build
if errorlevel 1 exit /b 1

echo [4/4] Packing EXE + installer...
call npm run dist
if errorlevel 1 exit /b 1

echo.
echo ====================================================
echo  DONE!
echo  release\TemkaLauncher-Setup.exe     - installer
echo  release\TemkaLauncher-Portable.exe  - no install
echo  Tray icon, close-to-tray, auto updates.
echo ====================================================
exit /b 0
