$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$RuntimeDir = Join-Path $ProjectRoot '.local/runtime'
$LogDir = Join-Path $RuntimeDir 'logs'
$ProcessDir = Join-Path $RuntimeDir 'processes'

function Read-Settings([string]$Path) {
    $values = @{}
    if (Test-Path -LiteralPath $Path) {
        foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
            if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
                $name = $matches[1]; $value = $matches[2].Trim()
                if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
                    $value = $value.Substring(1, $value.Length - 2)
                } else { $value = ($value -split ' #', 2)[0].TrimEnd() }
                $values[$name] = $value
            }
        }
    }
    foreach ($name in @($values.Keys)) {
        $override = [Environment]::GetEnvironmentVariable($name, 'Process')
        if ($null -ne $override) { $values[$name] = $override }
    }
    return $values
}

function Invoke-Checked([string]$Command, [string[]]$Arguments) {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Command failed (exit $LASTEXITCODE)." }
}

function Get-OwnedProcess([string]$Name) {
    $record = Join-Path $ProcessDir "$Name.json"
    if (-not (Test-Path -LiteralPath $record)) { return $null }
    $entry = Get-Content -LiteralPath $record -Raw | ConvertFrom-Json
    $process = Get-Process -Id $entry.Id -ErrorAction SilentlyContinue
    if ($process -and $process.StartTime.ToUniversalTime().Ticks.ToString() -eq $entry.StartTicks -and $process.Path -eq $entry.Executable) { return $process }
    return $null
}

function Stop-OwnedProcess([string]$Name) {
    $process = Get-OwnedProcess $Name
    if ($process) {
        Stop-Process -Id $process.Id
        $process.WaitForExit(10000) | Out-Null
        Write-Host "Stopped $Name."
    }
    $record = Join-Path $ProcessDir "$Name.json"
    if (Test-Path -LiteralPath $record) { Remove-Item -LiteralPath $record }
}

function Start-OwnedProcess([string]$Name, [string]$Executable, [string[]]$Arguments, [string]$Directory, [int]$Port = 0) {
    if (Get-OwnedProcess $Name) { Write-Host "$Name already managed."; return }
    if ($Port -and (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)) {
        throw "Port $Port is in use by an unmanaged process. Stop its original terminal before starting $Name; no process was killed."
    }
    New-Item -ItemType Directory -Force $LogDir, $ProcessDir | Out-Null
    $process = Start-Process -FilePath $Executable -ArgumentList $Arguments -WorkingDirectory $Directory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $LogDir "$Name.log") -RedirectStandardError (Join-Path $LogDir "$Name.error.log")
    if ($process.HasExited) { throw "$Name exited. Inspect .local/runtime/logs/$Name.error.log." }
    # Process.Path may be null immediately after Start-Process on Windows.
    @{ Id = $process.Id; StartTicks = $process.StartTime.ToUniversalTime().Ticks.ToString(); Executable = [IO.Path]::GetFullPath($Executable) } | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $ProcessDir "$Name.json")
}

function Wait-Health([string]$Url) {
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        try {
            $health = Invoke-RestMethod -Uri $Url -TimeoutSec 2
            if ($health.data.database -eq 'connected') { return }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    throw "Health check failed: $Url. Inspect .local/runtime/logs."
}
