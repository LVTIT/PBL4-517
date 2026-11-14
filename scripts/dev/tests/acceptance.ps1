# Explicit isolated acceptance; never connects probes to the operator's API/DB.
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$tag = [guid]::NewGuid().ToString('N').Substring(0,8)
$workspace = Join-Path $taskRoot ".local/verification/fresh source $tag"
$container = "pbl517-test-$tag"
$volume = "pbl517-test-$tag-data"
$dbPort = 55539
$apiPort = 39039
$uiPort = 39049
foreach ($port in @($dbPort,$apiPort,$uiPort)) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "Acceptance port $port is occupied; no process was killed." }
}
New-Item -ItemType Directory -Force $workspace | Out-Null
$files = & git -C $taskRoot ls-files --cached --others --exclude-standard
foreach ($file in $files) {
    $source = Join-Path $taskRoot $file
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { continue }
    $destination = Join-Path $workspace $file
    New-Item -ItemType Directory -Force (Split-Path $destination -Parent) | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination
}
Push-Location $workspace
& git init -q
& git add --all
& git -c user.name=LocalAcceptance -c user.email=acceptance@local.test commit -qm 'Temporary source snapshot for isolated verification'
New-Item -ItemType Directory -Force .local/private,.local/test-logs | Out-Null
$secret = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
[IO.File]::WriteAllText((Join-Path $workspace '.local/private/database.env'), "POSTGRES_USER=pbl517_test_admin`nPOSTGRES_PASSWORD=$secret`nLOCAL_DB_PORT=$dbPort`nLOCAL_DB_CONTAINER=$container`nLOCAL_DB_VOLUME=$volume`nLOCAL_COMPOSE_PROJECT=pbl517test$tag`n", (New-Object Text.UTF8Encoding $false))
function Check-Exit([string]$Name) { if ($LASTEXITCODE -ne 0) { throw "$Name failed; inspect private .local/test-logs in the acceptance checkout." } }
function Invoke-Logged([scriptblock]$Task, [string]$Log) {
    $previousPreference = $ErrorActionPreference
    try { $ErrorActionPreference = 'Continue'; & $Task *> $Log; $code = $LASTEXITCODE }
    finally { $ErrorActionPreference = $previousPreference }
    if ($code -ne 0) { throw "Command failed (exit $code); inspect private log $Log" }
}
try {
    Invoke-Logged { & .\dev.cmd setup } '.local/test-logs/setup.txt'
    Check-Exit 'Fresh setup'
    Write-Host 'PASS: source-only setup in a path with spaces, fresh Docker database, migration, seed, memorable accounts.'
    $envFile = Join-Path $workspace 'website/backend/.env'
    $before = Get-FileHash .local/private/lab-fixtures.json
    Invoke-Logged { & node scripts/dev/setup.mjs } '.local/test-logs/repeat.txt'
    Check-Exit 'Repeated setup'
    if ((Get-FileHash .local/private/lab-fixtures.json).Hash -ne $before.Hash) { throw 'Repeated setup changed the fixture.' }
    Write-Host 'PASS: repeated setup retains the same fixture IDs and credentials.'
    $contents = [IO.File]::ReadAllText($envFile) -replace '(?m)^PORT=.*$', "PORT=$apiPort"
    [IO.File]::WriteAllText($envFile, $contents, (New-Object Text.UTF8Encoding $false))
    . (Join-Path $workspace 'scripts/dev/common.ps1')
    $settings = Read-Settings $envFile
    $saved = @{}
    foreach ($key in $settings.Keys) { $saved[$key] = [Environment]::GetEnvironmentVariable($key,'Process'); [Environment]::SetEnvironmentVariable($key,$settings[$key],'Process') }
    $env:LOCAL_SECURITY_LAB = '1'
    $env:TEST_API_URL = "http://127.0.0.1:$apiPort"
    $env:API_PROXY_TARGET = $env:TEST_API_URL
    $env:APP_PROFILE = 'lab'; $env:LAB_DATA_ACK = 'synthetic-only'
    $node = (Get-Command node.exe).Source
    $backendDir = Join-Path $workspace 'website/backend'
    $frontendDir = Join-Path $workspace 'website/frontend'
    foreach ($phase in @('vulnerable','secure')) {
        foreach ($flag in @('IDOR','SQLI','XSS','AUTH')) { [Environment]::SetEnvironmentVariable("VULN_${flag}_ENABLED",'false','Process') }
        if ($phase -eq 'vulnerable') { foreach ($flag in @('IDOR','SQLI','XSS','AUTH')) { [Environment]::SetEnvironmentVariable("VULN_${flag}_ENABLED",'true','Process') } }
        Start-OwnedProcess 'acceptance-api' $node @('dist/server.js') $backendDir $apiPort
        Wait-Health "http://127.0.0.1:$apiPort/api/health"
        Start-OwnedProcess 'acceptance-ui' $node @('node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',"$uiPort",'--strictPort') $frontendDir $uiPort
        Wait-Health "http://127.0.0.1:$uiPort/api/health"
        foreach ($scenario in @('idor','idor-update','idor-cancel','sqli','xss','auth')) {
            if ($scenario -like 'idor*') {
                Push-Location $backendDir
                Invoke-Logged { & node dist/scripts/lab-fixtures.js --reset-order (Join-Path $workspace '.local/private/lab-fixtures.json') } (Join-Path $workspace '.local/test-logs/reset.txt')
                Check-Exit 'Fixture reset'
                Pop-Location
            }
            $url = if ($scenario -eq 'xss') { "http://127.0.0.1:$uiPort" } else { "http://127.0.0.1:$apiPort" }
            if ($scenario -eq 'idor-update') {
                Invoke-Logged { & .\demo.cmd $scenario $phase --url $url --address "Custom manual address $phase" --non-interactive } ".local/test-logs/$scenario-$phase.txt"
            } else { Invoke-Logged { & .\demo.cmd $scenario $phase --url $url --non-interactive } ".local/test-logs/$scenario-$phase.txt" }
            Check-Exit "$scenario $phase"
            $report = Get-Content ".local/reports/security/$scenario-$phase.json" -Raw | ConvertFrom-Json
            if (-not $report.passed) { throw 'Probe incorrectly returned success.' }
            Write-Host "PASS: $scenario $phase"
        }
        Stop-OwnedProcess 'acceptance-api'
        Stop-OwnedProcess 'acceptance-ui'
    }
    foreach ($flag in @('IDOR','SQLI','XSS','AUTH')) { [Environment]::SetEnvironmentVariable("VULN_${flag}_ENABLED",'false','Process') }
    Start-OwnedProcess 'acceptance-api' $node @('dist/server.js') $backendDir $apiPort
    Wait-Health "http://127.0.0.1:$apiPort/api/health"
    Push-Location $backendDir
    Invoke-Logged { & npm.cmd run test:integration } (Join-Path $workspace '.local/test-logs/api.txt')
    Check-Exit 'API integration'
    Write-Host 'PASS: API integration against isolated PostgreSQL.'
    Invoke-Logged { & npm.cmd run test:security } (Join-Path $workspace '.local/test-logs/security.txt')
    Check-Exit 'Security lifecycle'
    Invoke-Logged { & npm.cmd audit --audit-level=high } (Join-Path $workspace '.local/test-logs/backend-audit.txt')
    Check-Exit 'Backend audit'
    Pop-Location
    Push-Location $frontendDir
    Invoke-Logged { & npm.cmd run test:e2e } (Join-Path $workspace '.local/test-logs/browser.txt')
    Check-Exit 'Browser E2E'
    Invoke-Logged { & npm.cmd audit --audit-level=high } (Join-Path $workspace '.local/test-logs/frontend-audit.txt')
    Check-Exit 'Frontend audit'
    Pop-Location
    Write-Host 'PASS: security lifecycle, browser E2E and both dependency audits.'
    Write-Host "Private verification checkout: $workspace"
} finally {
    if (Get-Command Stop-OwnedProcess -ErrorAction SilentlyContinue) {
        Stop-OwnedProcess 'acceptance-api'; Stop-OwnedProcess 'acceptance-ui'
    }
    if ($saved) { foreach ($key in $saved.Keys) { [Environment]::SetEnvironmentVariable($key,$saved[$key],'Process') } }
    Remove-Item Env:LOCAL_SECURITY_LAB,Env:TEST_API_URL,Env:API_PROXY_TARGET -ErrorAction SilentlyContinue
    # Only exact, generated acceptance resources; never prune shared Docker data.
    if ($container -notmatch '^pbl517-test-[a-f0-9]{8}$' -or $volume -ne "$container-data") { throw 'Unsafe acceptance resource cleanup.' }
    & docker rm -f $container 2>$null | Out-Null
    & docker volume rm $volume 2>$null | Out-Null
    Pop-Location
}
