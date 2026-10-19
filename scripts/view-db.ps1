# Script mo Prisma Studio de xem giao dien truc quan Database
$projectRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $projectRoot "website\backend"

Write-Host "Dang khoi chay Prisma Studio..." -ForegroundColor Cyan
Write-Host "Giao dien quan ly database se tu dong mo tai: http://localhost:5555" -ForegroundColor Green
Write-Host "Nhan Ctrl + C de dong Prisma Studio khi xem xong." -ForegroundColor Yellow

Set-Location $backendDir
npm.cmd run prisma:studio
