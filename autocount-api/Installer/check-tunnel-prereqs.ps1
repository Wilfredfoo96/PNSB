# Check Prerequisites for Cloudflare Tunnel
# Verifies that IIS API is running and accessible before starting tunnel

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Cloudflare Tunnel Prerequisites Check" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Check 1: IIS API Health Endpoint
Write-Host "1. Checking IIS API health..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5001/api/v1/health" `
        -Headers @{"X-API-Key"="0AOz200EwsMcxbQh11KjMV3QqPRgtAXv"} `
        -UseBasicParsing -TimeoutSec 5
    Write-Host "   [OK] IIS API is running and responding" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "   [!] IIS API is NOT accessible" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
    $allGood = $false
}

Write-Host ""

# Check 2: IIS App Pool
Write-Host "2. Checking IIS App Pool..." -ForegroundColor Yellow
try {
    Import-Module WebAdministration -ErrorAction Stop
    $appPool = Get-WebAppPoolState -Name "AutoCountApiAppPool" -ErrorAction Stop
    
    if ($appPool.Value -eq 'Started') {
        Write-Host "   [OK] App Pool is running" -ForegroundColor Green
    } else {
        Write-Host "   [!] App Pool is NOT running (State: $($appPool.Value))" -ForegroundColor Red
        Write-Host "   Attempting to start..." -ForegroundColor Yellow
        Start-WebAppPool -Name "AutoCountApiAppPool"
        Start-Sleep -Seconds 3
        $newState = (Get-WebAppPoolState -Name "AutoCountApiAppPool").Value
        if ($newState -eq 'Started') {
            Write-Host "   [OK] App Pool started successfully" -ForegroundColor Green
        } else {
            Write-Host "   [!] Failed to start App Pool" -ForegroundColor Red
            $allGood = $false
        }
    }
} catch {
    Write-Host "   [!] Could not check App Pool: $_" -ForegroundColor Red
    $allGood = $false
}

Write-Host ""

# Check 3: Port 5001
Write-Host "3. Checking port 5001..." -ForegroundColor Yellow
try {
    $port = Get-NetTCPConnection -LocalPort 5001 -ErrorAction Stop
    Write-Host "   [OK] Port 5001 is in use" -ForegroundColor Green
    Write-Host "   State: $($port.State)" -ForegroundColor Gray
} catch {
    Write-Host "   [!] Port 5001 is NOT in use" -ForegroundColor Red
    Write-Host "   IIS API is not listening on port 5001" -ForegroundColor Yellow
    $allGood = $false
}

Write-Host ""

# Check 4: Firewall (basic check)
Write-Host "4. Checking Windows Firewall..." -ForegroundColor Yellow
try {
    $firewallRule = Get-NetFirewallRule -DisplayName "*5001*" -ErrorAction SilentlyContinue
    if ($firewallRule) {
        Write-Host "   [OK] Firewall rule found for port 5001" -ForegroundColor Green
    } else {
        Write-Host "   [!] No firewall rule found for port 5001" -ForegroundColor Yellow
        Write-Host "   (This might be OK if firewall allows localhost)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   [!] Could not check firewall: $_" -ForegroundColor Yellow
}

Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "All Checks Passed!" -ForegroundColor Green
    Write-Host "You can now start the Cloudflare Tunnel:" -ForegroundColor Cyan
    Write-Host "  cd C:\cloudflared" -ForegroundColor White
    Write-Host "  .\cloudflared.exe tunnel run autocount-api" -ForegroundColor White
} else {
    Write-Host "Some Checks Failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please fix the issues above before starting the tunnel." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Common fixes:" -ForegroundColor Cyan
    Write-Host "  1. Start IIS App Pool:" -ForegroundColor White
    Write-Host "     Start-WebAppPool -Name AutoCountApiAppPool" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2. Restart IIS:" -ForegroundColor White
    Write-Host "     iisreset" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  3. Check IIS API is deployed:" -ForegroundColor White
    Write-Host "     Test-Path C:\inetpub\wwwroot\AutoCountApi" -ForegroundColor Gray
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

