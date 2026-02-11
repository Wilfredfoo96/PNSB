# Script to restart the AutoCount API application pool
# Run as Administrator

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Restart AutoCount API" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to exit..."
    try {
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    } catch {
        Start-Sleep -Seconds 2
    }
    exit 1
}

# Import WebAdministration module
Write-Host "Loading IIS module..." -ForegroundColor Yellow
try {
    Import-Module WebAdministration -ErrorAction Stop
    Write-Host "[OK] IIS module loaded" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Could not load WebAdministration module" -ForegroundColor Red
    Write-Host "Make sure IIS is installed" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to exit..."
    try {
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    } catch {
        Start-Sleep -Seconds 2
    }
    exit 1
}

# Restart Application Pool
Write-Host ""
Write-Host "Restarting application pool..." -ForegroundColor Yellow
$appPoolName = "AutoCountApiAppPool"

try {
    $appPool = Get-WebAppPoolState -Name $appPoolName -ErrorAction Stop
    Write-Host "  Current state: $($appPool.Value)" -ForegroundColor Gray
    
    Restart-WebAppPool -Name $appPoolName -ErrorAction Stop
    Start-Sleep -Seconds 2
    
    $appPool = Get-WebAppPoolState -Name $appPoolName -ErrorAction Stop
    Write-Host "[OK] Application pool restarted" -ForegroundColor Green
    Write-Host "  New state: $($appPool.Value)" -ForegroundColor Gray
} catch {
    Write-Host "ERROR: Could not restart application pool: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Press any key to exit..."
    try {
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    } catch {
        Start-Sleep -Seconds 2
    }
    exit 1
}

# Test API
Write-Host ""
Write-Host "Testing API..." -ForegroundColor Yellow
$healthUrl = "http://localhost:5001/api/v1/health"
try {
    $response = Invoke-WebRequest -Uri $healthUrl -TimeoutSec 10 -ErrorAction Stop
    Write-Host "[OK] API is responding" -ForegroundColor Green
    Write-Host "  Status: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "[!] API test failed" -ForegroundColor Yellow
    Write-Host "  Error: $_" -ForegroundColor Gray
    Write-Host "  Make sure appsettings.json is configured correctly" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Done!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit..."
try {
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
} catch {
    Start-Sleep -Seconds 2
}


