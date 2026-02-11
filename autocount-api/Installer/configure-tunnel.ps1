# Configure Cloudflare Tunnel for AutoCount API
# This script helps create the config.yml file for your tunnel

param(
    [string]$TunnelName = "autocount-api",
    [string]$Hostname = "",
    [string]$ServiceUrl = "http://localhost:5001",
    [string]$ConfigPath = "C:\cloudflared\config.yml"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configure Cloudflare Tunnel" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if tunnel exists
$tunnelId = $null
$credentialsPath = $null

Write-Host "Checking for existing tunnel..." -ForegroundColor Yellow
try {
    $tunnelList = & "C:\cloudflared\cloudflared.exe" tunnel list 2>&1
    if ($tunnelList -match $TunnelName) {
        Write-Host "[OK] Tunnel '$TunnelName' found" -ForegroundColor Green
        
        # Try to extract tunnel ID (format: <id> <name> <created>)
        $lines = $tunnelList -split "`n"
        foreach ($line in $lines) {
            if ($line -match "(\S+)\s+$TunnelName") {
                $tunnelId = $matches[1]
                break
            }
        }
        
        if ($tunnelId) {
            Write-Host "  Tunnel ID: $tunnelId" -ForegroundColor Gray
            
            # Find credentials file
            $userProfile = $env:USERPROFILE
            $credentialsPath = Join-Path $userProfile ".cloudflared\$tunnelId.json"
            
            if (Test-Path $credentialsPath) {
                Write-Host "  Credentials: $credentialsPath" -ForegroundColor Gray
            } else {
                Write-Host "[!] Warning: Credentials file not found at expected location" -ForegroundColor Yellow
                Write-Host "    Expected: $credentialsPath" -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "[!] Tunnel '$TunnelName' not found" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Please create the tunnel first:" -ForegroundColor Cyan
        Write-Host "  cd C:\cloudflared" -ForegroundColor White
        Write-Host "  .\cloudflared.exe tunnel create $TunnelName" -ForegroundColor White
        Write-Host ""
        Write-Host "Then run this script again." -ForegroundColor Gray
        Write-Host ""
        Write-Host "Press any key to exit..."
        try {
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        } catch {
            Start-Sleep -Seconds 2
        }
        exit 1
    }
} catch {
    Write-Host "[ERROR] Could not check tunnel list: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure you have:" -ForegroundColor Yellow
    Write-Host "  1. Authenticated: .\cloudflared.exe tunnel login" -ForegroundColor White
    Write-Host "  2. Created tunnel: .\cloudflared.exe tunnel create $TunnelName" -ForegroundColor White
    exit 1
}

Write-Host ""

# Get hostname if not provided
if ([string]::IsNullOrWhiteSpace($Hostname)) {
    Write-Host "Hostname Configuration:" -ForegroundColor Yellow
    Write-Host "  Option 1: Use trycloudflare.com (free, temporary URL for testing)" -ForegroundColor White
    Write-Host "  Option 2: Use your custom domain (e.g., api.pnsbmy.com)" -ForegroundColor White
    Write-Host ""
    $choice = Read-Host "Enter hostname (or press Enter for trycloudflare.com)"
    
    if ([string]::IsNullOrWhiteSpace($choice)) {
        Write-Host "[INFO] Using trycloudflare.com - URL will be provided when tunnel starts" -ForegroundColor Gray
        $Hostname = ""  # Empty means use trycloudflare.com
    } else {
        $Hostname = $choice
    }
}

# Create config content
$configContent = @"
tunnel: $tunnelId
credentials-file: $credentialsPath

ingress:
"@

if ([string]::IsNullOrWhiteSpace($Hostname)) {
    # Use trycloudflare.com (no hostname specified)
    $configContent += @"

  - service: $ServiceUrl
  - service: http_status:404
"@
} else {
    # Use custom domain
    $configContent += @"

  - hostname: $Hostname
    service: $ServiceUrl
  - service: http_status:404
"@
}

# Write config file
Write-Host ""
Write-Host "Creating config file..." -ForegroundColor Yellow
try {
    # Ensure directory exists
    $configDir = Split-Path -Parent $ConfigPath
    if (-not (Test-Path $configDir)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    }
    
    $configContent | Out-File -FilePath $ConfigPath -Encoding UTF8 -NoNewline
    Write-Host "[OK] Config file created: $ConfigPath" -ForegroundColor Green
    Write-Host ""
    Write-Host "Config content:" -ForegroundColor Cyan
    Write-Host $configContent -ForegroundColor Gray
} catch {
    Write-Host "[ERROR] Failed to create config file: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configuration Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Test the tunnel:" -ForegroundColor Cyan
Write-Host "   cd C:\cloudflared" -ForegroundColor White
Write-Host "   .\cloudflared.exe tunnel run $TunnelName" -ForegroundColor White
Write-Host ""
if ([string]::IsNullOrWhiteSpace($Hostname)) {
    Write-Host "   The tunnel will provide a URL like:" -ForegroundColor Gray
    Write-Host "   https://abc123-def456.trycloudflare.com" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Copy this URL and use it in Vercel environment variables:" -ForegroundColor Yellow
    Write-Host "   AUTOCOUNT_API_BASE_URL=https://<tunnel-url>" -ForegroundColor White
} else {
    Write-Host "   Your API will be available at:" -ForegroundColor Gray
    Write-Host "   https://$Hostname" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Make sure DNS is configured to point $Hostname to Cloudflare" -ForegroundColor Yellow
    Write-Host "   Then use in Vercel environment variables:" -ForegroundColor Yellow
    Write-Host "   AUTOCOUNT_API_BASE_URL=https://$Hostname" -ForegroundColor White
}
Write-Host ""
Write-Host "2. (Optional) Install as Windows Service:" -ForegroundColor Cyan
Write-Host "   .\cloudflared.exe service install" -ForegroundColor White
Write-Host "   .\cloudflared.exe service start" -ForegroundColor White
Write-Host ""
Write-Host "3. Update IIS API appsettings.json AllowedOrigins:" -ForegroundColor Cyan
Write-Host "   Add your Vercel domain to the AllowedOrigins array" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit..."
try {
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
} catch {
    Start-Sleep -Seconds 2
}

