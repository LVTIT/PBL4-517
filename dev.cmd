@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev\cli.ps1" %*
exit /b %errorlevel%
