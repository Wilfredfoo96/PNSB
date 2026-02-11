# Setup Custom Domain for Cloudflare Tunnel
# This creates a constant URL for production use

param(
    [string]$TunnelName = "autocount-api",
    [string]$Hostname = "",
    [string]$ConfigPath = "C:\cloudflared\config.yml"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Custom Domain for Tunnel" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get tunnel ID
Write-Host "Getting tunnel ID..." -ForegroundColor Yellow
try {
    $tunnelList = & "C:\cloudflared\cloudflared.exe" tunnel list 2>&1
    $lines = $tunnelList -split "`n"
    $tunnelId = $null
    foreach ($line in $lines) {
        if ($line -match "(\S+)\s+$TunnelName") {
            $tunnelId = $matches[1]
            break
        }
    }
    
    if (-not $tunnelId) {
        Write-Host "[ERROR] Tunnel '$TunnelName' not found" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "[OK] Tunnel ID: $tunnelId" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Could not get tunnel ID: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Get hostname
if ([string]::IsNullOrWhiteSpace($Hostname)) {
    Write-Host "Enter your custom domain (e.g., api.pnsbmy.com):" -ForegroundColor Cyan
    Write-Host "  - Must be a domain you own" -ForegroundColor Gray
    Write-Host "  - DNS must be managed by Cloudflare" -ForegroundColor Gray
    Write-Host ""
    $Hostname = Read-Host "Hostname"
    
    if ([string]::IsNullOrWhiteSpace($Hostname)) {
        Write-Host "[ERROR] Hostname is required" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Setting up custom domain..." -ForegroundColor Yellow
Write-Host "  Hostname: $Hostname" -ForegroundColor Gray
Write-Host "  Tunnel: $TunnelName ($tunnelId)" -ForegroundColor Gray
Write-Host ""

# Route the domain to the tunnel
Write-Host "Step 1: Routing domain to tunnel..." -ForegroundColor Yellow
try {
    $output = & "C:\cloudflared\cloudflared.exe" tunnel route dns $TunnelName $Hostname 2>&1
    $output | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Domain routed to tunnel" -ForegroundColor Green
    } else {
        Write-Host "[!] Route command may have failed. Check output above." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "You may need to:" -ForegroundColor Yellow
        Write-Host "  1. Ensure DNS is managed by Cloudflare" -ForegroundColor White
        Write-Host "  2. Run manually: .\cloudflared.exe tunnel route dns $TunnelName $Hostname" -ForegroundColor White
    }
} catch {
    Write-Host "[ERROR] Could not route domain: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try running manually:" -ForegroundColor Yellow
    Write-Host "  .\cloudflared.exe tunnel route dns $TunnelName $Hostname" -ForegroundColor White
}

Write-Host ""

# Update config.yml
Write-Host "Step 2: Updating config.yml..." -ForegroundColor Yellow
$userProfile = $env:USERPROFILE
$credentialsPath = Join-Path $userProfile ".cloudflared\$tunnelId.json"

$configContent = @"
tunnel: $tunnelId
credentials-file: $credentialsPath

ingress:
  - hostname: $Hostname
    service: http://localhost:5001
  - service: http_status:404
"@

try {
    $configContent | Out-File -FilePath $ConfigPath -Encoding UTF8 -NoNewline
    Write-Host "[OK] Config file updated" -ForegroundColor Green
    Write-Host ""
    Write-Host "Config content:" -ForegroundColor Cyan
    Write-Host $configContent -ForegroundColor Gray
} catch {
    Write-Host "[ERROR] Failed to update config: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your constant URL:" -ForegroundColor Yellow
Write-Host "  https://$Hostname" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Restart the tunnel:" -ForegroundColor White
Write-Host "     .\cloudflared.exe tunnel --config $ConfigPath run" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Test the URL:" -ForegroundColor White
Write-Host "     https://$Hostname/api/v1/health" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Use in Vercel:" -ForegroundColor White
Write-Host "     AUTOCOUNT_API_BASE_URL=https://$Hostname" -ForegroundColor Gray
Write-Host ""
Write-Host "Note: DNS propagation may take a few minutes" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to exit..."
try {
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
} catch {
    Start-Sleep -Seconds 2
}

