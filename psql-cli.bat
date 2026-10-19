@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\psql-cli.ps1" %*
