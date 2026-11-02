param(
    [ValidateSet('prepare','start','stop','status','probe','reset-order')][string]$Action = 'status',
    [ValidateSet('secure','idor','sqli','xss','auth')][string]$Mode = 'secure',
    [ValidateSet('idor','idor-update','idor-cancel','sqli','xss','auth')][string]$Scenario = 'idor',
    [ValidateSet('secure','vulnerable')][string]$Expect = 'secure'
)
. (Join-Path $PSScriptRoot '../dev/common.ps1')
$fixture = Join-Path $ProjectRoot '.local/private/lab-fixtures.json'
Push-Location $ProjectRoot
try {
    switch ($Action) {
        'prepare' { Invoke-Checked 'node' @('scripts/demo/prepare.mjs') }
        'start' { & (Join-Path $PSScriptRoot '../dev/run.ps1') -Action start -Component lab -Mode $Mode }
        'stop' { & (Join-Path $PSScriptRoot '../dev/run.ps1') -Action stop -Component lab }
        'status' { & (Join-Path $PSScriptRoot '../dev/run.ps1') -Action status -Component lab }
        'probe' {
            if (-not (Test-Path $fixture)) { throw 'Prepare lab first.' }
            $reportDir = Join-Path $ProjectRoot '.local/reports/security'
            New-Item -ItemType Directory -Force $reportDir | Out-Null
            $report = Join-Path $reportDir "$Scenario-$Expect.json"
            if ($Scenario -eq 'xss') {
                $output = & node scripts/attacker/xss.mjs --url http://127.0.0.1:5174 --fixture $fixture --expect $Expect
            } else {
                $output = & python scripts/attacker/demo.py --scenario $Scenario --url http://127.0.0.1:3001 --fixture $fixture --expect $Expect
            }
            $code = $LASTEXITCODE
            $output | Set-Content -Encoding UTF8 $report
            $output | Write-Output
            if ($code -ne 0) { throw "Probe failed/inconclusive (exit $code). See $report" }
        }
        'reset-order' {
            $settings = Read-Settings (Join-Path $ProjectRoot '.local/private/lab.env')
            $settings['APP_PROFILE'] = 'lab'; $settings['LAB_DATA_ACK'] = 'synthetic-only'
            $settings['NODE_ENV'] = 'development'
            foreach ($flag in @('IDOR','SQLI','XSS','AUTH')) { $settings["VULN_${flag}_ENABLED"] = 'false' }
            $saved = @{}
            try {
                foreach ($key in $settings.Keys) {
                    $saved[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
                    [Environment]::SetEnvironmentVariable($key, $settings[$key], 'Process')
                }
                Push-Location (Join-Path $ProjectRoot 'website/backend')
                try { Invoke-Checked 'node' @('dist/scripts/lab-fixtures.js','--reset-order',$fixture) } finally { Pop-Location }
            } finally { foreach ($key in $saved.Keys) { [Environment]::SetEnvironmentVariable($key, $saved[$key], 'Process') } }
        }
    }
} finally { Pop-Location }
