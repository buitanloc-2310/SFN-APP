$ErrorActionPreference = "Stop"
Write-Host "=== SKY FIRST NETWORK — CONFIGURE CLOUDFLARE ===" -ForegroundColor Cyan
$root = Split-Path -Parent $PSScriptRoot
$config = Join-Path $root "wrangler.jsonc"
$d1 = Read-Host "Paste D1 database_id của sfn-app-db"
if ([string]::IsNullOrWhiteSpace($d1)) { throw "D1 database_id không được để trống." }
$text = Get-Content $config -Raw -Encoding UTF8
$text = $text -replace 'REPLACE_WITH_YOUR_D1_DATABASE_ID', [Regex]::Escape($d1).Replace('\\','\')
Set-Content $config $text -Encoding UTF8
Write-Host "Đã cập nhật wrangler.jsonc" -ForegroundColor Green
Write-Host "Tiếp theo chạy:" -ForegroundColor Yellow
Write-Host "  npm install"
Write-Host "  npx wrangler login"
Write-Host "  npm run db:migrate"
Write-Host "  npm run validate"
Write-Host "  npm run deploy"
