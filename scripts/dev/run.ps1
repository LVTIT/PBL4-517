param(
    [ValidateSet('start','stop','status')][string]$Action = 'status',
    [ValidateSet('web','bot','all')][string]$Component = 'web',
    [ValidateSet('secure','idor','sqli','xss','auth')][string]$Mode = 'secure'
)
. (Join-Path $PSScriptRoot 'common.ps1')
$names = if ($Component -eq 'all') { @('web-backend','web-frontend','lab-backend','lab-frontend','bot') } elseif ($Component -eq 'bot') { @('bot') } else { @('web-backend','web-frontend') }
$modeFile = Join-Path $RuntimeDir 'web-mode.json'
if ($Action -eq 'status') {
    foreach ($name in $names) {
        $p = Get-OwnedProcess $name
        Write-Host "$name : $(if ($p) { 'running (PID ' + $p.Id + ')' } else { 'not managed/running' })"
    }
    if (Test-Path $modeFile) { Write-Host ('Applied local mode: ' + (Get-Content $modeFile -Raw | ConvertFrom-Json).Mode) }
    Write-Host 'Website: http://127.0.0.1:5173 | Logs: .local/runtime/logs'
    return
}
if ($Action -eq 'stop') {
    foreach ($name in $names) { Stop-OwnedProcess $name }
    if ($Component -ne 'bot' -and (Test-Path $modeFile)) { Remove-Item -LiteralPath $modeFile }
    return
}
if ($Component -eq 'all') { throw 'Start web or bot explicitly.' }
$settings = @{}
$saved = @{}
try {
    if ($Component -eq 'bot') {
        $settings['PYTHONUTF8'] = '1'
    } else {
        $settings = Read-Settings (Join-Path $ProjectRoot 'website/backend/.env')
        if (-not $settings.DATABASE_URL -or -not $settings.SESSION_SECRET) { throw 'Run .\dev setup first.' }
        $db = [Uri]$settings.DATABASE_URL
        if ($db.Scheme -notin @('postgres','postgresql') -or $db.Host -notin @('127.0.0.1','localhost','[::1]') -or $db.AbsolutePath -ne '/kevilo_local_lab') {
            throw 'Launcher only accepts the synthetic kevilo_local_lab database. Run .\dev setup; see website/README.md.'
        }
        $settings['NODE_ENV'] = 'development'
        $settings['TRUST_PROXY'] = '0'
        $settings['APP_PROFILE'] = if ($Mode -eq 'secure') { 'production' } else { 'lab' }
        $settings['LAB_DATA_ACK'] = if ($Mode -eq 'secure') { '' } else { 'synthetic-only' }
        foreach ($flag in @('IDOR','SQLI','XSS','AUTH')) { $settings["VULN_${flag}_ENABLED"] = 'false' }
        if ($Mode -ne 'secure') { $settings['VULN_' + $Mode.ToUpperInvariant() + '_ENABLED'] = 'true' }
        $apiPort = if ($settings.PORT) { [int]$settings.PORT } else { 3000 }
        $settings['API_PROXY_TARGET'] = "http://127.0.0.1:$apiPort"
        # Apply configuration changes to a fresh backend; the UI URL stays fixed.
        $oldMode = if (Test-Path $modeFile) { Get-Content $modeFile -Raw | ConvertFrom-Json } else { $null }
        $fingerprint = Get-FileHash -Algorithm SHA256 (Join-Path $ProjectRoot 'website/backend/.env')
        if ($Mode -ne 'secure' -or -not $oldMode -or $oldMode.Mode -ne $Mode -or $oldMode.ConfigHash -ne $fingerprint.Hash) {
            foreach ($name in $names) { Stop-OwnedProcess $name }
        }
    }
    foreach ($key in $settings.Keys) {
        $saved[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
        [Environment]::SetEnvironmentVariable($key, $settings[$key], 'Process')
    }
    if ($Component -eq 'bot') {
        Start-OwnedProcess 'bot' (Get-Command python.exe).Source @('-u','alerts/bot_listener.py') $ProjectRoot
        Start-Sleep -Seconds 1
        if (-not (Get-OwnedProcess 'bot')) { throw 'Bot exited. Inspect .local/runtime/logs/bot.error.log privately.' }
        Write-Host 'Bot started; confirm /ping in Telegram.'
    } else {
        $backend = Join-Path $ProjectRoot 'website/backend'
        $frontend = Join-Path $ProjectRoot 'website/frontend'
        Push-Location $backend
        try { Invoke-Checked 'node' @('../../scripts/dev/check-db.mjs') } finally { Pop-Location }
        if (-not (Test-Path (Join-Path $backend 'dist/server.js'))) { throw 'Run .\dev setup first.' }
        $node = (Get-Command node.exe).Source
        Start-OwnedProcess 'web-backend' $node @('dist/server.js') $backend $apiPort
        Wait-Health "http://127.0.0.1:$apiPort/api/health"
        Start-OwnedProcess 'web-frontend' $node @('node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort') $frontend 5173
        Wait-Health 'http://127.0.0.1:5173/api/health'
        @{ Mode = $Mode; ConfigHash = $fingerprint.Hash } | ConvertTo-Json | Set-Content -Encoding UTF8 $modeFile
        Write-Host "Ready: http://127.0.0.1:5173 (mode: $Mode; database: kevilo_local_lab)."
    }
} catch {
    if ($Component -eq 'web') {
        foreach ($name in $names) { Stop-OwnedProcess $name }
        if (Test-Path $modeFile) { Remove-Item -LiteralPath $modeFile }
    }
    throw
} finally {
    foreach ($key in $saved.Keys) { [Environment]::SetEnvironmentVariable($key, $saved[$key], 'Process') }
}
