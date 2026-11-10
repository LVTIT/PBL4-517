@echo off
chcp 65001 >nul
python "%~dp0scripts\demo\cli.py" %*
exit /b %errorlevel%
