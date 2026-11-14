# Connect using application credentials; Docker setup needs no host psql install.
. (Join-Path $PSScriptRoot 'common.ps1')
$envFile = Join-Path $ProjectRoot 'website/backend/.env'

if (-not (Test-Path $envFile)) {
    Write-Host "Loi: Khong tim thay file $envFile" -ForegroundColor Red
    exit 1
}

$dbUrl = ""
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*DATABASE_URL\s*=\s*["'']?(.*?)["'']?\s*$') {
        $dbUrl = $matches[1]
    }
}

if (-not $dbUrl) {
    Write-Host "Loi: Khong tim thay DATABASE_URL trong $envFile" -ForegroundColor Red
    exit 1
}

$cleanUrl = $dbUrl -replace '\?.*$', ''
$connection = [Uri]$cleanUrl
$credentials = $connection.UserInfo -split ':', 2
$databaseFile = Join-Path $ProjectRoot '.local/private/database.env'
if (Test-Path -LiteralPath $databaseFile) {
    $database = Read-Settings $databaseFile
    $port = if ($database.LOCAL_DB_PORT) { [int]$database.LOCAL_DB_PORT } else { 55432 }
    if ($connection.Host -in @('127.0.0.1','localhost') -and $connection.Port -eq $port) {
        $container = if ($database.LOCAL_DB_CONTAINER) { $database.LOCAL_DB_CONTAINER } else { 'pbl517-db' }
        $interactive = if ($args.Count) { '-i' } else { '-it' }
        & docker exec $interactive $container psql -U ([Uri]::UnescapeDataString($credentials[0])) -d ([Uri]::UnescapeDataString($connection.AbsolutePath.TrimStart('/'))) @args
        if ($LASTEXITCODE -ne 0) { throw 'psql failed. Start database with dev.ps1 db.' }
        return
    }
}
$psqlPath = Join-Path $projectRoot ".local\pgsql\bin\psql.exe"

if (-not (Test-Path $psqlPath)) {
    $cmd = Get-Command psql -ErrorAction SilentlyContinue
    if ($cmd) {
        $psqlPath = "psql"
    } else {
        Write-Host "Loi: Khong tim thay psql.exe trong .local hoac he thong." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Dang ket noi toi database qua psql... (Go '\q' de thoat, '\dt' de xem cac bang)" -ForegroundColor Green
$previousPassword = $env:PGPASSWORD
try {
    $env:PGPASSWORD = if ($credentials.Length -gt 1) { [Uri]::UnescapeDataString($credentials[1]) } else { '' }
    $dbPort = if ($connection.Port -gt 0) { $connection.Port } else { 5432 }
    & $psqlPath -h $connection.Host -p $dbPort -U ([Uri]::UnescapeDataString($credentials[0])) -d ([Uri]::UnescapeDataString($connection.AbsolutePath.TrimStart('/'))) @args
} finally { $env:PGPASSWORD = $previousPassword }
