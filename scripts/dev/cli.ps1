param([ValidateSet('help','setup','up','down','status','doctor','db','bot','reset-order','ports','open-port','close-port')][string]$Action = 'help')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')
Push-Location $ProjectRoot
$lock = $null
try {
    if ($Action -eq 'help') {
        Write-Host 'Setup: .\dev setup | db | doctor'
        Write-Host 'Web:   run API/frontend manually (website/README.md), or dev up/down for managed secure mode.'
        Write-Host 'Demo:  .\demo idor (or idor-update/idor-cancel/sqli/xss/auth); terminal questions guide the probe.'
        Write-Host 'Extra: status | reset-order | ports | open-port | close-port | bot'
        exit 0
    }
    New-Item -ItemType Directory -Force $RuntimeDir | Out-Null
    try { $lock = [IO.File]::Open((Join-Path $RuntimeDir 'launcher.lock'), 'OpenOrCreate', 'ReadWrite', 'None') }
    catch { throw 'Another launcher is running; wait for it to finish.' }
    switch ($Action) {
        'setup' { & "$PSScriptRoot/setup.ps1" }
        'doctor' { & "$PSScriptRoot/doctor.ps1" }
        'db' { & "$PSScriptRoot/database.ps1" -Action start }
        'up' { & "$PSScriptRoot/database.ps1" -Action start; & "$PSScriptRoot/run.ps1" -Action start -Mode secure }
        'down' { & "$PSScriptRoot/run.ps1" -Action stop -Component all; Stop-OwnedProcess 'port-lab'; & "$PSScriptRoot/database.ps1" -Action stop }
        'status' { & "$PSScriptRoot/run.ps1" -Action status -Component all; & "$PSScriptRoot/database.ps1" -Action status }
        'bot' { & "$PSScriptRoot/run.ps1" -Action start -Component bot }
        'reset-order' {
            if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { throw 'Stop the local backend before resetting the fixture order, then restart it yourself.' }
            & "$PSScriptRoot/../demo/run.ps1" -Action reset-order
        }
        'ports' {
            & python scanner/scan.py 127.0.0.1 --ports 5173,8080 --state-file .local/runtime/local-demo.state.json --no-banner --no-alert
            if ($LASTEXITCODE -eq 1) {
                Write-Host 'Note: exit 1 = uncertain/filtered ports; incomplete result, not a scanner failure.'
            } elseif ($LASTEXITCODE -ne 0) {
                throw "python failed (exit $LASTEXITCODE)."
            }
        }
        'open-port' {
            $empty = Join-Path $ProjectRoot '.local/runtime/empty'
            New-Item -ItemType Directory -Force $empty | Out-Null
            Start-OwnedProcess 'port-lab' (Get-Command python.exe).Source @('-m','http.server','8080','--bind','127.0.0.1','--directory',('"' + $empty + '"')) $ProjectRoot 8080
        }
        'close-port' { Stop-OwnedProcess 'port-lab' }
    }
    exit 0
} catch {
    Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
} finally { if ($lock) { $lock.Dispose() }; Pop-Location }
