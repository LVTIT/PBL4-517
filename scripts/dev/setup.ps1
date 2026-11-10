. (Join-Path $PSScriptRoot 'common.ps1')
foreach ($component in @('web-backend','web-frontend','lab-backend','lab-frontend')) {
    if (Get-OwnedProcess $component) { throw 'Run .\dev down before setup.' }
}
foreach ($command in @('git','node','npm.cmd','python','docker')) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) { throw "Missing $command. See website/README.md." }
}
if ((& node --version) -notmatch '^v24\.') { throw 'Node.js 24 is required.' }
& docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop (Linux containers), then run .\dev setup again.' }
$savedDatabaseUrl = $env:DATABASE_URL
if (-not $env:DATABASE_URL) { $env:DATABASE_URL = 'postgresql://build:build@127.0.0.1:55432/build_only' }
try {
    foreach ($directory in @('website/backend','website/frontend')) {
        Push-Location (Join-Path $ProjectRoot $directory)
        try { Invoke-Checked 'npm.cmd' @('ci'); Invoke-Checked 'npm.cmd' @('run','build') } finally { Pop-Location }
    }
} finally { $env:DATABASE_URL = $savedDatabaseUrl }
Push-Location $ProjectRoot
try { Invoke-Checked 'node' @('scripts/dev/setup.mjs') } finally { Pop-Location }
Push-Location (Join-Path $ProjectRoot 'website/frontend')
try { Invoke-Checked 'npx.cmd' @('playwright','install','chromium') } finally { Pop-Location }
Write-Host 'Setup complete. Start API/frontend manually (website/README.md); run .\demo idor after selecting the env mode.'
