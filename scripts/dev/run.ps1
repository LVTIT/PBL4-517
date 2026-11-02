param(
    [ValidateSet('start','stop','status')][string]$Action = 'status',
    [ValidateSet('web','bot','lab','all')][string]$Component = 'web',
    [ValidateSet('secure','idor','sqli','xss','auth')][string]$Mode = 'secure',
    [string]$DatabaseContainer = ''
)
. (Join-Path $PSScriptRoot 'common.ps1')
$names = switch ($Component) {
    'web' { @('web-backend','web-frontend') }
    'lab' { @('lab-backend','lab-frontend') }
    'bot' { @('bot') }
    'all' { @('web-backend','web-frontend','lab-backend','lab-frontend','bot') }
}
if ($Action -eq 'status') {
    foreach ($name in $names) {
        $p = Get-OwnedProcess $name
        Write-Host "$name : $(if ($p) { 'running (PID ' + $p.Id + ')' } else { 'not managed/running' })"
    }
    Write-Host 'Web: http://127.0.0.1:5173 | Lab: http://localhost:5174'
    Write-Host 'Logs: .local/runtime/logs | Scanner defaults: .local/reports/scanner/latest.html'
    return
}
if ($Action -eq 'stop') { foreach ($name in $names) { Stop-OwnedProcess $name }; return }
if ($Component -eq 'web' -and $Mode -ne 'secure') { throw 'Vulnerable modes require the lab component.' }
if ($Component -eq 'all') { throw 'Start web/lab/bot separately. Starting bot sends a ready message to the configured Telegram group.' }
$settings = @{}
$saved = @{}
try {
    if ($Component -eq 'bot') {
        $rootSettings = Read-Settings (Join-Path $ProjectRoot '.env')
        foreach ($key in @('TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID','TELEGRAM_ALLOWED_USER_IDS')) {
            if (-not $rootSettings[$key]) { throw "Missing $key in root .env/environment. See scanner/README.md." }
        }
        # Python owns monitoring configuration; do not copy secrets to process records.
        $settings['PYTHONUTF8'] = '1'
    } else {
        $envPath = if ($Component -eq 'lab') { '.local/private/lab.env' } else { 'website/backend/.env' }
        if (-not (Test-Path (Join-Path $ProjectRoot $envPath))) { throw "Missing $envPath. See scripts/dev/README.md." }
        $settings = Read-Settings (Join-Path $ProjectRoot $envPath)
        if (-not $settings.DATABASE_URL -or -not $settings.SESSION_SECRET) { throw 'DATABASE_URL and SESSION_SECRET are required.' }
        $db = [Uri]$settings.DATABASE_URL
        if ($db.Scheme -notin @('postgres','postgresql') -or $db.Host -notin @('127.0.0.1','localhost','[::1]')) { throw 'Local launcher requires a loopback PostgreSQL database.' }
        if ($Component -eq 'lab' -and $db.AbsolutePath -notmatch '(?i)(^|[/_-])lab([/_-]|$)') { throw 'Lab requires a dedicated database with a lab name segment.' }
        $rootSettings = Read-Settings (Join-Path $ProjectRoot '.env')
        if (-not $DatabaseContainer) { $DatabaseContainer = $rootSettings['LOCAL_POSTGRES_CONTAINER'] }
        if ($DatabaseContainer) { Invoke-Checked 'docker' @('start', $DatabaseContainer) }
        $settings['NODE_ENV'] = 'development'
        $settings['TRUST_PROXY'] = '0'
        $settings['APP_PROFILE'] = if ($Component -eq 'lab') { 'lab' } else { 'production' }
        $settings['LAB_DATA_ACK'] = if ($Component -eq 'lab') { 'synthetic-only' } else { '' }
        foreach ($flag in @('IDOR','SQLI','XSS','AUTH')) { $settings["VULN_${flag}_ENABLED"] = 'false' }
        if ($Component -eq 'lab' -and $Mode -ne 'secure') { $settings['VULN_' + $Mode.ToUpperInvariant() + '_ENABLED'] = 'true' }
        $apiPort = if ($Component -eq 'lab') { 3001 } elseif ($settings.PORT) { [int]$settings.PORT } else { 3000 }
        $uiPort = if ($Component -eq 'lab') { 5174 } else { 5173 }
        $settings['PORT'] = "$apiPort"
        $settings['API_PROXY_TARGET'] = "http://127.0.0.1:$apiPort"
        # Every lab start applies the requested mode to fresh processes.
        if ($Component -eq 'lab') { foreach ($name in $names) { Stop-OwnedProcess $name } }
    }
    foreach ($key in $settings.Keys) {
        $saved[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
        [Environment]::SetEnvironmentVariable($key, $settings[$key], 'Process')
    }
    if ($Component -eq 'bot') {
        Start-OwnedProcess 'bot' (Get-Command python.exe).Source @('-u','alerts/bot_listener.py') $ProjectRoot
        Start-Sleep -Seconds 2
        if (-not (Get-OwnedProcess 'bot')) { throw 'Bot exited. Inspect .local/runtime/logs/bot.error.log.' }
        Write-Host 'Bot process started; confirm the ready message and /ping in Telegram.'
    } else {
        $backend = Join-Path $ProjectRoot 'website/backend'
        $frontend = Join-Path $ProjectRoot 'website/frontend'
        Push-Location $backend
        try { Invoke-Checked 'node' @('../../scripts/dev/check-db.mjs') } finally { Pop-Location }
        if (-not (Test-Path (Join-Path $backend 'dist/server.js'))) { throw 'Build the backend first; see website/README.md.' }
        $node = (Get-Command node.exe).Source
        Start-OwnedProcess "$Component-backend" $node @('dist/server.js') $backend $apiPort
        Wait-Health "http://127.0.0.1:$apiPort/api/health"
        Start-OwnedProcess "$Component-frontend" $node @('node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',"$uiPort",'--strictPort') $frontend $uiPort
        Wait-Health "http://127.0.0.1:$uiPort/api/health"
        Write-Host "$Component ready (mode $Mode). URL: $(if ($Component -eq 'lab') { 'http://localhost:5174' } else { 'http://127.0.0.1:5173' })"
    }
} finally {
    foreach ($key in $saved.Keys) { [Environment]::SetEnvironmentVariable($key, $saved[$key], 'Process') }
}
