# Compatibility for start-dev.bat; canonical entry point is root dev.cmd.
& (Join-Path $PSScriptRoot 'dev/cli.ps1') up
exit $LASTEXITCODE
