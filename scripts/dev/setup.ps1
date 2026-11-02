. (Join-Path $PSScriptRoot 'common.ps1')
foreach ($component in @('web-backend','web-frontend','lab-backend','lab-frontend')) {
    if (Get-OwnedProcess $component) { throw 'Run dev.ps1 down before setup so dependency/build files are not in use.' }
}
$savedDatabaseUrl = $env:DATABASE_URL
# Prisma generation reads the URL even though builds do not connect to a database.
if (-not $env:DATABASE_URL) { $env:DATABASE_URL = 'postgresql://build:build@127.0.0.1:55432/build_only' }
try {
    foreach ($directory in @('website/backend','website/frontend')) {
        Push-Location (Join-Path $ProjectRoot $directory)
        try { Invoke-Checked 'npm.cmd' @('ci'); Invoke-Checked 'npm.cmd' @('run','build') } finally { Pop-Location }
    }
} finally { $env:DATABASE_URL = $savedDatabaseUrl }
Push-Location $ProjectRoot
try {
    Invoke-Checked 'node' @('scripts/dev/setup.mjs')
    Invoke-Checked 'node' @('scripts/demo/prepare.mjs')
} finally { Pop-Location }
Push-Location (Join-Path $ProjectRoot 'website/frontend')
try { Invoke-Checked 'npx.cmd' @('playwright','install','chromium') } finally { Pop-Location }
Write-Host 'Setup complete. Start web with .\dev.ps1 up; lab with .\dev.ps1 demo -Mode idor.'
