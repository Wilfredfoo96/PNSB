# Fix Vercel Network Error
# Troubleshoots and fixes Cloudflare Tunnel connectivity issues

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Fix Vercel Network Error" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check tunnel service
Write-Host "Step 1: Checking Cloudflare Tunnel service..." -ForegroundColor Yellow
$tunnelService = Get-Service -Name cloudflared -ErrorAction SilentlyContinue
if ($tunnelService) {
    Write-Host "  Status: $($tunnelService.Status)" -ForegroundColor $(if ($tunnelService.Status -eq 'Running') { 'Green' } else { 'Yellow' })
    Write-Host "  StartType: $($tunnelService.StartType)" -ForegroundColor Gray
    
    if ($tunnelService.Status -ne 'Running') {
        Write-Host "  Starting service..." -ForegroundColor Gray
        Start-Service -Name cloudflared -ErrorAction Stop
        Start-Sleep -Seconds 5
        Write-Host "  [OK] Service started" -ForegroundColor Green
    }
} else {
    Write-Host "  [ERROR] Tunnel service not found!" -ForegroundColor Red
    Write-Host "  Run: .\install-tunnel-service.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Step 2: Check tunnel process
Write-Host "Step 2: Checking tunnel process..." -ForegroundColor Yellow
$tunnelProcess = Get-Process cloudflared -ErrorAction SilentlyContinue
if ($tunnelProcess) {
    Write-Host "  [OK] Tunnel process running (PID: $($tunnelProcess.Id))" -ForegroundColor Green
} else {
    Write-Host "  [!] No tunnel process found" -ForegroundColor Yellow
    Write-Host "  Restarting service..." -ForegroundColor Gray
    Restart-Service -Name cloudflared -Force
    Start-Sleep -Seconds 5
    $tunnelProcess = Get-Process cloudflared -ErrorAction SilentlyContinue
    if ($tunnelProcess) {
        Write-Host "  [OK] Tunnel process started" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] Failed to start tunnel process" -ForegroundColor Red
        Write-Host "  Check service logs in Event Viewer" -ForegroundColor Yellow
    }
}

Write-Host ""

# Step 3: Check local API
Write-Host "Step 3: Testing local API..." -ForegroundColor Yellow
try {
    $localResponse = Invoke-WebRequest -Uri "http://localhost:5001/api/v1/health" -Headers @{"X-API-Key"="0AOz200EwsMcxbQh11KjMV3QqPRgtAXv"} -UseBasicParsing -TimeoutSec 5
    Write-Host "  [OK] Local API is responding (Status: $($localResponse.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Local API not responding: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Check IIS and AutoCountApiAppPool" -ForegroundColor Yellow
}

Write-Host ""

# Step 4: Check tunnel info
Write-Host "Step 4: Checking tunnel connection..." -ForegroundColor Yellow
try {
    Push-Location "C:\cloudflared"
    $tunnelInfo = & .\cloudflared.exe tunnel info autocount-api 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Tunnel is connected" -ForegroundColor Green
        $tunnelInfo | Select-Object -First 5 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    } else {
        Write-Host "  [!] Tunnel may not be fully connected" -ForegroundColor Yellow
        Write-Host "  Output: $tunnelInfo" -ForegroundColor Gray
    }
    Pop-Location
} catch {
    Write-Host "  [!] Could not check tunnel info: $_" -ForegroundColor Yellow
    Pop-Location
}

Write-Host ""

# Step 5: Test public URL
Write-Host "Step 5: Testing public API URL..." -ForegroundColor Yellow
Write-Host "  Waiting 10 seconds for tunnel to stabilize..." -ForegroundColor Gray
Start-Sleep -Seconds 10

try {
    $publicResponse = Invoke-WebRequest -Uri "https://api.pnsbmy.com/api/v1/health" -Headers @{"X-API-Key"="0AOz200EwsMcxbQh11KjMV3QqPRgtAXv"} -UseBasicParsing -TimeoutSec 15
    Write-Host "  [OK] Public API is responding (Status: $($publicResponse.StatusCode))" -ForegroundColor Green
    Write-Host "  Response: $($publicResponse.Content)" -ForegroundColor Gray
} catch {
    $statusCode = $_.Exception.Response?.StatusCode?.value__
    Write-Host "  [ERROR] Public API not responding" -ForegroundColor Red
    Write-Host "  Status Code: $statusCode" -ForegroundColor Yellow
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Yellow
    
    if ($statusCode -eq 530) {
        Write-Host ""
        Write-Host "  530 Error = Cloudflare Tunnel not connected" -ForegroundColor Yellow
        Write-Host "  Possible fixes:" -ForegroundColor Yellow
        Write-Host "    1. Restart tunnel service: Restart-Service cloudflared" -ForegroundColor White
        Write-Host "    2. Check DNS: nslookup api.pnsbmy.com" -ForegroundColor White
        Write-Host "    3. Verify config.yml tunnel ID matches DNS CNAME" -ForegroundColor White
        Write-Host "    4. Check tunnel logs in Event Viewer" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Troubleshooting Complete" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "If issues persist:" -ForegroundColor Yellow
Write-Host "  1. Check Vercel environment variables:" -ForegroundColor White
Write-Host "     AUTOCOUNT_API_BASE_URL=https://api.pnsbmy.com" -ForegroundColor Gray
Write-Host "     AUTOCOUNT_API_KEY=0AOz200EwsMcxbQh11KjMV3QqPRgtAXv" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Verify DNS CNAME record:" -ForegroundColor White
Write-Host "     api.pnsbmy.com -> <tunnel-id>.cfargotunnel.com" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Check Cloudflare Tunnel logs:" -ForegroundColor White
Write-Host "     Event Viewer -> Windows Logs -> Application" -ForegroundColor Gray
Write-Host ""
Write-Host "Press any key to exit..."
try {
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
} catch {
    Start-Sleep -Seconds 2
}

