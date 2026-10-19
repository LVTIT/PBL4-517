# Script ket noi psql toi database PBL4-517
$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot "website\backend\.env"

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
& $psqlPath -d $cleanUrl $args
