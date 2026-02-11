# Test Vercel Connection
# Comprehensive test to verify the API is accessible from Vercel's perspective

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Vercel Connection Test" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$allTestsPassed = $true

# Test 1: Tunnel Service Status
Write-Host "Test 1: Cloudflare Tunnel Service" -ForegroundColor Cyan
$tunnelService = Get-Service -Name cloudflared -ErrorAction SilentlyContinue
if ($tunnelService) {
    if ($tunnelService.Status -eq 'Running') {
        Write-Host "  ✅ Service is running" -ForegroundColor Green
        Write-Host "    Status: $($tunnelService.Status)" -ForegroundColor Gray
        Write-Host "    StartType: $($tunnelService.StartType)" -ForegroundColor Gray
    } else {
        Write-Host "  ❌ Service is not running (Status: $($tunnelService.Status))" -ForegroundColor Red
        $allTestsPassed = $false
    }
} else {
    Write-Host "  ❌ Service not found" -ForegroundColor Red
    $allTestsPassed = $false
}

Write-Host ""

# Test 2: Tunnel Process
Write-Host "Test 2: Tunnel Process" -ForegroundColor Cyan
$tunnelProcess = Get-Process cloudflared -ErrorAction SilentlyContinue
if ($tunnelProcess) {
    Write-Host "  ✅ Process is running (PID: $($tunnelProcess.Id))" -ForegroundColor Green
} else {
    Write-Host "  ❌ No tunnel process found" -ForegroundColor Red
    $allTestsPassed = $false
}

Write-Host ""

# Test 3: Local API
Write-Host "Test 3: Local API (localhost:5001)" -ForegroundColor Cyan
try {
    $localResponse = Invoke-WebRequest -Uri "http://localhost:5001/api/v1/health" -Headers @{"X-API-Key"="0AOz200EwsMcxbQh11KjMV3QqPRgtAXv"} -UseBasicParsing -TimeoutSec 5
    Write-Host "  ✅ Local API is responding (Status: $($localResponse.StatusCode))" -ForegroundColor Green
    Write-Host "    Response: $($localResponse.Content)" -ForegroundColor Gray
} catch {
    Write-Host "  ❌ Local API not responding: $($_.Exception.Message)" -ForegroundColor Red
    $allTestsPassed = $false
}

Write-Host ""

# Test 4: Public API (via Cloudflare Tunnel)
Write-Host "Test 4: Public API (api.pnsbmy.com)" -ForegroundColor Cyan
Write-Host "  Testing... (this may take 15 seconds)" -ForegroundColor Gray
try {
    $publicResponse = Invoke-WebRequest -Uri "https://api.pnsbmy.com/api/v1/health" -Headers @{"X-API-Key"="0AOz200EwsMcxbQh11KjMV3QqPRgtAXv"} -UseBasicParsing -TimeoutSec 15
    Write-Host "  ✅ Public API is responding (Status: $($publicResponse.StatusCode))" -ForegroundColor Green
    Write-Host "    Response: $($publicResponse.Content)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  ✅ Vercel should be able to connect!" -ForegroundColor Green
} catch {
    $statusCode = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { "N/A" }
    Write-Host "  ❌ Public API not responding (Status: $statusCode)" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Yellow
    
    if ($statusCode -eq 530) {
        Write-Host ""
        Write-Host "  ⚠️  530 Error = Tunnel not connected" -ForegroundColor Yellow
        Write-Host "  Solution: Run reinstall-tunnel-service.ps1 as Administrator" -ForegroundColor White
    } elseif ($statusCode -eq 404) {
        Write-Host ""
        Write-Host "  ⚠️  404 Error = DNS or routing issue" -ForegroundColor Yellow
        Write-Host "  Check: nslookup api.pnsbmy.com" -ForegroundColor White
    }
    
    $allTestsPassed = $false
}

Write-Host ""

# Test 5: DNS Resolution
Write-Host "Test 5: DNS Resolution" -ForegroundColor Cyan
try {
    $dnsResult = Resolve-DnsName -Name api.pnsbmy.com -ErrorAction Stop
    Write-Host "  ✅ DNS resolves correctly" -ForegroundColor Green
    $dnsResult | Select-Object -First 3 | ForEach-Object {
        Write-Host "    $($_.Name) -> $($_.IPAddress)" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ❌ DNS resolution failed: $($_.Exception.Message)" -ForegroundColor Red
    $allTestsPassed = $false
}

Write-Host ""

# Test 6: Tunnel Connection Status
Write-Host "Test 6: Tunnel Connection Status" -ForegroundColor Cyan
try {
    cd C:\cloudflared
    $tunnelInfo = & .\cloudflared.exe tunnel info autocount-api 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Tunnel is connected" -ForegroundColor Green
        $tunnelInfo | Select-Object -First 5 | ForEach-Object {
            Write-Host "    $_" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ❌ Tunnel connection check failed" -ForegroundColor Red
        Write-Host "    $tunnelInfo" -ForegroundColor Yellow
        $allTestsPassed = $false
    }
} catch {
    Write-Host "  ⚠️  Could not check tunnel info: $_" -ForegroundColor Yellow
}

Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($allTestsPassed) {
    Write-Host "✅ ALL TESTS PASSED" -ForegroundColor Green
    Write-Host ""
    Write-Host "The API should be accessible from Vercel!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Verify in Vercel:" -ForegroundColor Yellow
    Write-Host "  1. Check environment variables are set:" -ForegroundColor White
    Write-Host "     AUTOCOUNT_API_BASE_URL=https://api.pnsbmy.com" -ForegroundColor Gray
    Write-Host "     AUTOCOUNT_API_KEY=0AOz200EwsMcxbQh11KjMV3QqPRgtAXv" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2. Check Vercel function logs for any errors" -ForegroundColor White
    Write-Host ""
    Write-Host "  3. Test from your deployed Vercel site" -ForegroundColor White
} else {
    Write-Host "❌ SOME TESTS FAILED" -ForegroundColor Red
    Write-Host ""
    Write-Host "The API is not fully accessible. Fix the issues above." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Common fixes:" -ForegroundColor Yellow
    Write-Host "  - If tunnel not connected: Run reinstall-tunnel-service.ps1" -ForegroundColor White
    Write-Host "  - If local API fails: Check IIS and AutoCountApiAppPool" -ForegroundColor White
    Write-Host "  - If DNS fails: Check Cloudflare DNS settings" -ForegroundColor White
}

Write-Host ""
Write-Host "Press any key to exit..."
try {
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
} catch {
    Start-Sleep -Seconds 2
}

