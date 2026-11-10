# Real child process checks, isolated from the user's launcher records.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../common.ps1')
$RuntimeDir = Join-Path ([IO.Path]::GetTempPath()) ('pbl517-lifecycle-' + [guid]::NewGuid())
$LogDir = Join-Path $RuntimeDir 'logs'
$ProcessDir = Join-Path $RuntimeDir 'processes'
New-Item -ItemType Directory -Force $RuntimeDir | Out-Null
$script = Join-Path $RuntimeDir 'listener.js'
'setInterval(() => {}, 1000);' | Set-Content -Encoding ASCII $script
$childId = $null
try {
    $node = (Get-Command node.exe).Source
    Start-OwnedProcess 'fixture' $node @('listener.js') $RuntimeDir
    $first = Get-OwnedProcess 'fixture'
    if (-not $first) { throw 'Child not registered.' }
    $childId = $first.Id
    Start-OwnedProcess 'fixture' $node @('listener.js') $RuntimeDir
    if ((Get-OwnedProcess 'fixture').Id -ne $childId) { throw 'Duplicate process spawned.' }
    $record = Join-Path $ProcessDir 'fixture.json'
    $valid = Get-Content -LiteralPath $record -Raw
    $stale = $valid | ConvertFrom-Json
    $stale.StartTicks = '0'
    $stale | ConvertTo-Json | Set-Content -Encoding UTF8 $record
    Stop-OwnedProcess 'fixture'
    if (-not (Get-Process -Id $childId -ErrorAction SilentlyContinue)) { throw 'Stale record killed an unrelated process.' }
    $valid | Set-Content -Encoding UTF8 $record
    Stop-OwnedProcess 'fixture'
    if (Get-Process -Id $childId -ErrorAction SilentlyContinue) { throw 'Owned child not stopped.' }
    Stop-OwnedProcess 'fixture'
    Write-Host 'PASS: start, idempotence, stale PID protection, stop, repeated stop.'
} finally {
    if ($childId -and (Get-OwnedProcess 'fixture')) { Stop-OwnedProcess 'fixture' }
    $resolved = [IO.Path]::GetFullPath($RuntimeDir)
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if (-not $resolved.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path $resolved -Leaf) -notlike 'pbl517-lifecycle-*') { throw 'Unsafe test cleanup path.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
