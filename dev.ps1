param(
    [ValidateSet('setup','up','down','status','db','bot','demo','probe','secure','reset-order')][string]$Action = 'status',
    [ValidateSet('secure','idor','sqli','xss','auth')][string]$Mode = 'secure',
    [ValidateSet('idor','idor-update','idor-cancel','sqli','xss','auth')][string]$Scenario = 'idor',
    [ValidateSet('secure','vulnerable')][string]$Expect = 'secure'
)
$ErrorActionPreference = 'Stop'
switch ($Action) {
    'setup' { & "$PSScriptRoot/scripts/dev/setup.ps1" }
    'db' { & "$PSScriptRoot/scripts/dev/database.ps1" -Action start }
    'up' { & "$PSScriptRoot/scripts/dev/database.ps1" -Action start; & "$PSScriptRoot/scripts/dev/run.ps1" -Action start -Component web }
    'down' { & "$PSScriptRoot/scripts/dev/run.ps1" -Action stop -Component all; & "$PSScriptRoot/scripts/dev/database.ps1" -Action stop }
    'status' { & "$PSScriptRoot/scripts/dev/run.ps1" -Action status -Component all; & "$PSScriptRoot/scripts/dev/database.ps1" -Action status }
    'bot' { & "$PSScriptRoot/scripts/dev/run.ps1" -Action start -Component bot }
    'demo' { & "$PSScriptRoot/scripts/dev/database.ps1" -Action start; & "$PSScriptRoot/scripts/demo/run.ps1" -Action start -Mode $Mode }
    'secure' { & "$PSScriptRoot/scripts/demo/run.ps1" -Action start -Mode secure }
    'probe' { & "$PSScriptRoot/scripts/demo/run.ps1" -Action probe -Scenario $Scenario -Expect $Expect }
    'reset-order' { & "$PSScriptRoot/scripts/demo/run.ps1" -Action reset-order }
}
