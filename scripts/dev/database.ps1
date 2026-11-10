param([ValidateSet('start','stop','status')][string]$Action = 'status')
. (Join-Path $PSScriptRoot 'common.ps1')
$privateEnv = Join-Path $ProjectRoot '.local/private/database.env'
if (-not (Test-Path $privateEnv)) { throw 'Run .\dev setup first.' }
$composeArgs = @('compose','--env-file',$privateEnv,'-f',(Join-Path $ProjectRoot 'compose.yaml'))
$database = Read-Settings $privateEnv
$volume = if ($database.LOCAL_DB_VOLUME) { $database.LOCAL_DB_VOLUME } else { 'pbl517-local-data' }
switch ($Action) {
    'start' {
        Invoke-Checked 'docker' @('volume','create',$volume)
        Invoke-Checked 'docker' ($composeArgs + @('up','-d','--wait','db'))
    }
    'stop' { Invoke-Checked 'docker' ($composeArgs + @('stop','db')) }
    'status' { Invoke-Checked 'docker' ($composeArgs + @('ps','-a')) }
}
