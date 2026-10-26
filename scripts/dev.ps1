# Script khoi dong toan bo he thong PBL4-517
$projectRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $projectRoot "website\backend"
$frontendDir = Join-Path $projectRoot "website\frontend"
$pgBin = Join-Path $projectRoot ".local\pgsql\bin"
$pgData = Join-Path $projectRoot ".local\pgdata"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "     KHOI DONG HE THONG PBL4-517        " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Kiem tra PostgreSQL
Write-Host "`n[1/4] Kiem tra PostgreSQL (Port 5432)..." -ForegroundColor Yellow
$pgPortInUse = Get-NetTCPConnection -LocalPort 5432 -ErrorAction SilentlyContinue

if (-not $pgPortInUse) {
    if ((Test-Path "$pgBin\pg_ctl.exe") -and (Test-Path $pgData)) {
        Write-Host "PostgreSQL chua chay. Dang tu dong khoi dong PostgreSQL local..." -ForegroundColor Yellow
        & "$pgBin\pg_ctl.exe" -D $pgData -l "$projectRoot\.local\postgres.log" -w start
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Loi: Khong the khoi dong PostgreSQL local." -ForegroundColor Red
        } else {
            Write-Host "PostgreSQL local da khoi dong thanh cong!" -ForegroundColor Green
        }
    } else {
        Write-Host "Canh bao: Port 5432 chua co dich vu nao lang nghe. Hay dam bao PostgreSQL hoac Docker PostgreSQL da chay!" -ForegroundColor Magenta
    }
} else {
    Write-Host "PostgreSQL dang chay tren port 5432." -ForegroundColor Green
}

# 2. Kiem tra .env backend
Write-Host "`n[2/4] Kiem tra file cau hinh Backend (.env)..." -ForegroundColor Yellow
$envFile = Join-Path $backendDir ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "Chua co file .env, dang copy tu .env.example..." -ForegroundColor Yellow
    Copy-Item (Join-Path $backendDir ".env.example") $envFile
    $secret = [System.Guid]::NewGuid().ToString("N") + [System.Guid]::NewGuid().ToString("N")
    (Get-Content $envFile) -replace 'SESSION_SECRET=""', "SESSION_SECRET=`"$secret`"" | Set-Content $envFile
    Write-Host "Da tao file .env mau voi SESSION_SECRET ngau nhien." -ForegroundColor Green
} else {
    Write-Host "File .env da san sang." -ForegroundColor Green
}

# 3. Kiem tra node_modules
Write-Host "`n[3/4] Kiem tra dependencies..." -ForegroundColor Yellow
if (-not (Test-Path (Join-Path $backendDir "node_modules"))) {
    Write-Host "Dang cai dat dependencies backend (npm ci)..." -ForegroundColor Yellow
    Push-Location $backendDir
    npm.cmd ci
    npm.cmd run prisma:generate
    Pop-Location
}
if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
    Write-Host "Dang cai dat dependencies frontend (npm ci)..." -ForegroundColor Yellow
    Push-Location $frontendDir
    npm.cmd ci
    Pop-Location
}
Write-Host "Dependencies da day du." -ForegroundColor Green

# 4. Khoi dong Backend va Frontend trong 2 cua so rieng
Write-Host "`n[4/4] Khoi dong Backend & Frontend..." -ForegroundColor Yellow

# Chay Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendDir'; `$host.UI.RawUI.WindowTitle = 'PBL4-517 Backend (Port 3000)'; Write-Host '--- BACKEND SERVER (Port 3000) ---' -ForegroundColor Cyan; npm.cmd run dev"

Start-Sleep -Seconds 2

# Chay Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendDir'; `$host.UI.RawUI.WindowTitle = 'PBL4-517 Frontend (Port 5173)'; Write-Host '--- FRONTEND SERVER (Port 5173) ---' -ForegroundColor Green; npm.cmd run dev"

Start-Sleep -Seconds 2

# Mo trinh duyet
Start-Process "http://127.0.0.1:5173/"

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "   HE THONG DA DUOC KHOI DONG THANH CONG!        " -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host "• Frontend web : http://127.0.0.1:5173" -ForegroundColor White
Write-Host "• Backend API  : http://127.0.0.1:3000/api/health" -ForegroundColor White
Write-Host "• Xem DB (GUI) : Chay .\view-db.bat hoac 'npm run prisma:studio'" -ForegroundColor White
Write-Host "• Lenh psql    : Chay .\psql-cli.bat" -ForegroundColor White
Write-Host "• Tai khoan test: demo@example.com / DemoOnly517!" -ForegroundColor White
Write-Host "==================================================" -ForegroundColor Green
