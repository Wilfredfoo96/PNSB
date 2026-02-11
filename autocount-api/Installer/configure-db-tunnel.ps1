# Configure Cloudflare Tunnel for SQL Server Database
# This script helps add a database route to your existing tunnel configuration

param(
    [string]$TunnelName = "autocount-api",
    [string]$DbHostname = "",  # e.g., "sql.pnsbmy.com" or leave empty for trycloudflare.com
    [string]$ConfigPath = "C:\cloudflared\config.yml"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configure Database Tunnel Route" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script adds a database route to your EXISTING tunnel." -ForegroundColor Gray
Write-Host "It does NOT create a new tunnel - it only adds a route." -ForegroundColor Gray
Write-Host ""

# Check if config file exists
if (-not (Test-Path $ConfigPath)) {
    Write-Host "[ERROR] Config file not found: $ConfigPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run configure-tunnel.ps1 first to create the tunnel configuration." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to exit..."
    try {
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    } catch {
        Start-Sleep -Seconds 2
    }
    exit 1
}

# Read existing config
Write-Host "Reading existing tunnel configuration..." -ForegroundColor Yellow
$configContent = Get-Content $ConfigPath -Raw

# Check if tunnel ID exists
if ($configContent -notmatch "tunnel:\s*(\S+)") {
    Write-Host "[ERROR] Could not find tunnel ID in config file" -ForegroundColor Red
    exit 1
}

$tunnelId = $matches[1]
Write-Host "[OK] Found tunnel ID: $tunnelId" -ForegroundColor Green

# Check if database route already exists
if ($configContent -match "tcp://localhost:1433") {
    Write-Host "[!] Database route already exists in config" -ForegroundColor Yellow
    Write-Host ""
    $overwrite = Read-Host "Do you want to update it? (y/n)"
    if ($overwrite -ne 'y' -and $overwrite -ne 'Y') {
        Write-Host "Exiting without changes." -ForegroundColor Gray
        exit 0
    }
    
    # Remove existing database route (handle both with and without hostname)
    $configContent = $configContent -replace "(?m)^\s*-\s*hostname:.*?\r?\n\s+service:\s*tcp://localhost:1433.*?\r?\n", ""
    $configContent = $configContent -replace "(?m)^\s*-\s*service:\s*tcp://localhost:1433.*?\r?\n", ""
}

# Get database hostname if not provided
if ([string]::IsNullOrWhiteSpace($DbHostname)) {
    Write-Host ""
    Write-Host "Database Hostname Configuration:" -ForegroundColor Yellow
    Write-Host "  Option 1: Use trycloudflare.com (free, temporary URL for testing)" -ForegroundColor White
    Write-Host "  Option 2: Use your custom domain (e.g., sql.pnsbmy.com)" -ForegroundColor White
    Write-Host ""
    $choice = Read-Host "Enter database hostname (or press Enter for trycloudflare.com)"
    
    if ([string]::IsNullOrWhiteSpace($choice)) {
        Write-Host "[INFO] Using trycloudflare.com - URL will be provided when tunnel starts" -ForegroundColor Gray
        $DbHostname = ""  # Empty means use trycloudflare.com
    } else {
        $DbHostname = $choice
    }
}

# Build database route entry
$dbRoute = ""
if ([string]::IsNullOrWhiteSpace($DbHostname)) {
    # Use trycloudflare.com (no hostname specified)
    $dbRoute = @"

  - service: tcp://localhost:1433
"@
} else {
    # Use custom domain
    $dbRoute = @"

  - hostname: $DbHostname
    service: tcp://localhost:1433
"@
}

# Find the ingress section and add database route before the catch-all
if ($configContent -match "(ingress:\s*\r?\n)") {
    $ingressMatch = $matches[1]
    
    # Check if there's already a catch-all route
    if ($configContent -match "(\s+- service: http_status:404)") {
        # Insert before catch-all
        $configContent = $configContent -replace "(\s+- service: http_status:404)", "$dbRoute`$1"
    } else {
        # Append to ingress section
        $configContent = $configContent -replace "(ingress:\s*\r?\n)", "`$1$dbRoute"
    }
    
    Write-Host "[OK] Database route added to configuration" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Could not find ingress section in config" -ForegroundColor Red
    exit 1
}

# Write updated config
Write-Host ""
Write-Host "Writing updated configuration..." -ForegroundColor Yellow
try {
    $configContent | Out-File -FilePath $ConfigPath -Encoding UTF8 -NoNewline
    Write-Host "[OK] Config file updated: $ConfigPath" -ForegroundColor Green
    Write-Host ""
    Write-Host "Updated config content:" -ForegroundColor Cyan
    Write-Host $configContent -ForegroundColor Gray
} catch {
    Write-Host "[ERROR] Failed to update config file: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configuration Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Restart the Cloudflare tunnel:" -ForegroundColor Cyan
Write-Host "   Stop the current tunnel (Ctrl+C if running in terminal)" -ForegroundColor White
Write-Host "   cd C:\cloudflared" -ForegroundColor White
Write-Host "   .\cloudflared.exe tunnel run $TunnelName" -ForegroundColor White
Write-Host ""

if ([string]::IsNullOrWhiteSpace($DbHostname)) {
    Write-Host "   The tunnel will provide a URL like:" -ForegroundColor Gray
    Write-Host "   https://abc123-def456.trycloudflare.com (for API)" -ForegroundColor Gray
    Write-Host "   tcp://abc123-def456.trycloudflare.com:1433 (for database)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Copy the database URL and use it in your environment variables:" -ForegroundColor Yellow
    Write-Host "   AUTOCOUNT_DB_SERVER=<tunnel-url-without-tcp>" -ForegroundColor White
    Write-Host "   AUTOCOUNT_DB_PORT=1433" -ForegroundColor White
    Write-Host "   AUTOCOUNT_DB_ENCRYPT=true" -ForegroundColor White
} else {
    Write-Host "   Your database will be available at:" -ForegroundColor Gray
    Write-Host "   $DbHostname:1433" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Make sure DNS is configured to point $DbHostname to Cloudflare" -ForegroundColor Yellow
    Write-Host "   Then use in your environment variables:" -ForegroundColor Yellow
    Write-Host "   AUTOCOUNT_DB_SERVER=$DbHostname" -ForegroundColor White
    Write-Host "   AUTOCOUNT_DB_PORT=1433" -ForegroundColor White
    Write-Host "   AUTOCOUNT_DB_ENCRYPT=true" -ForegroundColor White
}

Write-Host ""
Write-Host "2. Update your .env.local or Vercel environment variables:" -ForegroundColor Cyan
Write-Host "   AUTOCOUNT_DB_SERVER=<tunnel-hostname>" -ForegroundColor White
Write-Host "   AUTOCOUNT_DB_NAME=AED_PNSB" -ForegroundColor White
Write-Host "   AUTOCOUNT_DB_USER=sa" -ForegroundColor White
Write-Host "   AUTOCOUNT_DB_PASSWORD=AutoCount@123" -ForegroundColor White
Write-Host "   AUTOCOUNT_DB_PORT=1433" -ForegroundColor White
Write-Host "   AUTOCOUNT_DB_ENCRYPT=true" -ForegroundColor White
Write-Host ""
Write-Host "3. Test the database connection:" -ForegroundColor Cyan
Write-Host "   Use the Database Explorer in the debugging section of your website" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit..."
try {
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
} catch {
    Start-Sleep -Seconds 2
}
