@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publish-github.ps1"
if errorlevel 1 (echo Publishing failed. See details above.)
pause
