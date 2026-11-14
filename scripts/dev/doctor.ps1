. (Join-Path $PSScriptRoot 'common.ps1')
$failed = $false
foreach ($name in @('git','node','npm.cmd','python','docker')) {
    if (Get-Command $name -ErrorAction SilentlyContinue) { Write-Host "OK: $name" }
    else { Write-Host "MISSING: $name"; $failed = $true }
}
if (Get-Command node -ErrorAction SilentlyContinue) {
    $version = & node --version
    Write-Host "Node: $version (required: 24.x)"
    if ($version -notmatch '^v24\.') { $failed = $true }
}
if (Get-Command docker -ErrorAction SilentlyContinue) {
    & docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Host 'MISSING: Docker Engine. Start Docker Desktop.'; $failed = $true }
}
foreach ($file in @('website/backend/.env','.local/private/database.env','.local/private/lab-fixtures.json')) {
    if (Test-Path (Join-Path $ProjectRoot $file)) { Write-Host "OK: $file (values hidden)" }
    else { Write-Host "MISSING: $file; run .\dev setup"; $failed = $true }
}
foreach ($port in @(3000,5173,8080)) {
    $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    Write-Host "Port $port : $(if ($listener) { 'listening; check .\dev status for ownership' } else { 'available' })"
}
if (-not $failed) {
    $settings = Read-Settings (Join-Path $ProjectRoot 'website/backend/.env')
    $saved = $env:DATABASE_URL
    try {
        $env:DATABASE_URL = $settings.DATABASE_URL
        Push-Location (Join-Path $ProjectRoot 'website/backend')
        try { Invoke-Checked node @('../../scripts/dev/check-db.mjs') } finally { Pop-Location }
    } finally { $env:DATABASE_URL = $saved }
}
Write-Host 'Config: backend/.env for web; root .env for scanner/alerts. Process environment takes precedence.'
if ($failed) { throw 'Environment incomplete; fix the reported items and run .\dev setup.' }
