# Cloudflare Tunnel Setup Script for AutoCount API
# This script helps set up a Cloudflare Tunnel to expose the IIS API to the internet

param(
    [string]$TunnelName = "autocount-api",
    [string]$Hostname = "api.pnsbmy.com",
    [string]$ServiceUrl = "http://localhost:5001",
    [string]$InstallPath = "C:\cloudflared"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Cloudflare Tunnel Setup for AutoCount API" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[!] Warning: Not running as Administrator" -ForegroundColor Yellow
    Write-Host "    Some operations may require elevated privileges" -ForegroundColor Gray
    Write-Host ""
}

# Create installation directory
Write-Host "Creating installation directory..." -ForegroundColor Yellow
if (-not (Test-Path $InstallPath)) {
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
    Write-Host "[OK] Directory created: $InstallPath" -ForegroundColor Green
} else {
    Write-Host "[OK] Directory exists: $InstallPath" -ForegroundColor Green
}

# Download cloudflared
Write-Host ""
Write-Host "Downloading cloudflared..." -ForegroundColor Yellow
$cloudflaredExe = Join-Path $InstallPath "cloudflared.exe"
$downloadUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"

try {
    if (-not (Test-Path $cloudflaredExe)) {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $cloudflaredExe -UseBasicParsing
        Write-Host "[OK] cloudflared downloaded" -ForegroundColor Green
    } else {
        Write-Host "[OK] cloudflared already exists" -ForegroundColor Green
    }
} catch {
    Write-Host "[ERROR] Failed to download cloudflared: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Authenticate with Cloudflare:" -ForegroundColor Cyan
Write-Host "   cd $InstallPath" -ForegroundColor White
Write-Host "   .\cloudflared.exe tunnel login" -ForegroundColor White
Write-Host ""
Write-Host "2. Create the tunnel:" -ForegroundColor Cyan
Write-Host "   .\cloudflared.exe tunnel create $TunnelName" -ForegroundColor White
Write-Host ""
Write-Host "3. Configure the tunnel:" -ForegroundColor Cyan
Write-Host "   Create config.yml in $InstallPath with:" -ForegroundColor White
Write-Host ""
Write-Host "   tunnel: <tunnel-id>" -ForegroundColor Gray
Write-Host "   credentials-file: C:\Users\$env:USERNAME\.cloudflared\<tunnel-id>.json" -ForegroundColor Gray
Write-Host "" -ForegroundColor Gray
Write-Host "   ingress:" -ForegroundColor Gray
Write-Host "     - hostname: $Hostname" -ForegroundColor Gray
Write-Host "       service: $ServiceUrl" -ForegroundColor Gray
Write-Host "     - service: http_status:404" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Run the tunnel:" -ForegroundColor Cyan
Write-Host "   .\cloudflared.exe tunnel run $TunnelName" -ForegroundColor White
Write-Host ""
Write-Host "5. (Optional) Install as Windows Service:" -ForegroundColor Cyan
Write-Host "   .\cloudflared.exe service install" -ForegroundColor White
Write-Host "   .\cloudflared.exe service start" -ForegroundColor White
Write-Host ""
Write-Host "6. Update Vercel Environment Variables:" -ForegroundColor Cyan
Write-Host "   AUTOCOUNT_API_BASE_URL=https://$Hostname" -ForegroundColor White
Write-Host "   AUTOCOUNT_API_KEY=0AOz200EwsMcxbQh11KjMV3QqPRgtAXv" -ForegroundColor White
Write-Host ""
Write-Host "7. Update IIS API appsettings.json AllowedOrigins:" -ForegroundColor Cyan
Write-Host "   Add your Vercel domain to the AllowedOrigins array" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit..."
try {
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
} catch {
    Start-Sleep -Seconds 2
}

