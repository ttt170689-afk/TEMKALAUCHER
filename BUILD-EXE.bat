@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (echo Install Node.js 22 LTS first. & pause & exit /b 1)
call npm ci
if errorlevel 1 goto fail
call npm test
if errorlevel 1 goto fail
call npm run dist
if errorlevel 1 goto fail
call npm run verify-release
if errorlevel 1 goto fail
echo.
echo SUCCESS. Installer and update files are in the release folder.
explorer "%CD%\release"
pause
exit /b 0
:fail
echo BUILD FAILED. Read the error above; no successful build is claimed.
pause
exit /b 1
