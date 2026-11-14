param(
    [ValidateSet('probe','reset-order')][string]$Action = 'probe',
    [string]$Scenario,
    [string]$Expect,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest
)
. (Join-Path $PSScriptRoot '../dev/common.ps1')
$fixture = Join-Path $ProjectRoot '.local/private/lab-fixtures.json'
if (-not (Test-Path $fixture)) { throw 'Run .\dev setup first.' }
if ($Action -eq 'probe') {
    # The interactive UX lives in cli.py; keep this wrapper for older callers.
    $cliArgs = @()
    if ($Scenario) { $cliArgs += $Scenario }
    if ($Expect) { $cliArgs += @('--expect', $Expect) }
    if ($Rest) { $cliArgs += $Rest }
    & python (Join-Path $PSScriptRoot 'cli.py') @cliArgs
    exit $LASTEXITCODE
}
$settings = Read-Settings (Join-Path $ProjectRoot 'website/backend/.env')
Push-Location $ProjectRoot
try {
    $saved = @{}
    $settings['APP_PROFILE'] = 'lab'
    $settings['LAB_DATA_ACK'] = 'synthetic-only'
    $settings['NODE_ENV'] = 'development'
    foreach ($flag in @('IDOR','SQLI','XSS','AUTH')) { $settings["VULN_${flag}_ENABLED"] = 'false' }
    try {
        foreach ($key in $settings.Keys) {
            $saved[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
            [Environment]::SetEnvironmentVariable($key, $settings[$key], 'Process')
        }
        Push-Location (Join-Path $ProjectRoot 'website/backend')
        try { Invoke-Checked node @('dist/scripts/lab-fixtures.js','--reset-order',$fixture) } finally { Pop-Location }
    } finally { foreach ($key in $saved.Keys) { [Environment]::SetEnvironmentVariable($key, $saved[$key], 'Process') } }
} finally { Pop-Location }
