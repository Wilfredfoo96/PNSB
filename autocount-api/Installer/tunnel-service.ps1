# Cloudflare Tunnel Service - Master Script
# Handles installation, starting, fixing crashes, and debugging
# Usage: .\tunnel-service.ps1 [install|start|stop|restart|status|fix|debug]

param(
    [Parameter(Position=0)]
    [ValidateSet("install", "start", "stop", "restart", "status", "fix", "debug", "health")]
    [string]$Action = "status",
    
    [string]$TunnelName = "autocount-api",
    [string]$ConfigPath = "C:\cloudflared\config.yml"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Cloudflare Tunnel Service Manager" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as admin (required for most operations)
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$needsAdmin = @("install", "start", "stop", "restart", "fix")
if ($needsAdmin -contains $Action -and -not $isAdmin) {
    Write-Host "[ERROR] This action requires Administrator privileges" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

$cloudflaredExe = "C:\cloudflared\cloudflared.exe"

# ============================================================================
# STATUS - Check current status
# ============================================================================
if ($Action -eq "status" -or $Action -eq "health") {
    Write-Host "Checking service status..." -ForegroundColor Yellow
    Write-Host ""
    
    $allGood = $true
    
    # Check service
    $service = Get-Service -Name cloudflared -ErrorAction SilentlyContinue
    if ($service) {
        $statusColor = if ($service.Status -eq 'Running') { 'Green' } else { 'Yellow' }
        Write-Host "  Service Status: $($service.Status)" -ForegroundColor $statusColor
        if ($service.Status -ne 'Running') { $allGood = $false }
    } else {
        Write-Host "  Service Status: Not Installed" -ForegroundColor Red
        $allGood = $false
    }
    
    # Check process
    $processes = Get-Process cloudflared -ErrorAction SilentlyContinue
    if ($processes) {
        Write-Host "  Process: Running (PID: $($processes[0].Id))" -ForegroundColor Green
    } else {
        Write-Host "  Process: Not Running" -ForegroundColor $(if ($service -and $service.Status -eq 'Running') { 'Red' } else { 'Gray' })
        if ($service -and $service.Status -eq 'Running') { $allGood = $false }
    }
    
    # Check tunnel connections
    if (Test-Path $cloudflaredExe) {
        try {
            $tunnelList = & $cloudflaredExe tunnel list 2>&1
            if ($LASTEXITCODE -eq 0) {
                if ($tunnelList -match "CONNECTIONS\s+(\S+)") {
                    $connections = $matches[1]
                    Write-Host "  Tunnel Connections: $connections" -ForegroundColor Green
                } else {
                    Write-Host "  Tunnel Connections: None" -ForegroundColor Red
                    $allGood = $false
                }
            }
        } catch {
            Write-Host "  Tunnel Connections: Unable to check" -ForegroundColor Yellow
        }
    }
    
    # Check for crashes
    try {
        $recentCrashes = Get-EventLog -LogName System -Source "Service Control Manager" -Newest 5 -ErrorAction SilentlyContinue | 
            Where-Object { $_.Message -like "*Cloudflared agent service terminated unexpectedly*" } |
            Where-Object { $_.TimeGenerated -gt (Get-Date).AddHours(-24) }
        
        if ($recentCrashes) {
            Write-Host "  Recent Crashes: $($recentCrashes.Count) in last 24 hours" -ForegroundColor Red
            $allGood = $false
        } else {
            Write-Host "  Recent Crashes: None" -ForegroundColor Green
        }
    } catch {
        Write-Host "  Recent Crashes: Unable to check" -ForegroundColor Yellow
    }
    
    # Test API
    try {
        $response = Invoke-WebRequest -Uri "https://api.pnsbmy.com/api/v1/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        Write-Host "  API Access: OK (Status: $($response.StatusCode))" -ForegroundColor Green
    } catch {
        Write-Host "  API Access: Failed" -ForegroundColor Red
        $allGood = $false
    }
    
    Write-Host ""
    if ($allGood) {
        Write-Host "[OK] All systems operational!" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "[!] Issues detected. Run: .\tunnel-service.ps1 fix" -ForegroundColor Yellow
        exit 1
    }
}

# ============================================================================
# INSTALL - Install the service
# ============================================================================
if ($Action -eq "install") {
    Write-Host "Installing Cloudflare Tunnel Service..." -ForegroundColor Yellow
    Write-Host ""
    
    # Check prerequisites
    if (-not (Test-Path $cloudflaredExe)) {
        Write-Host "[ERROR] cloudflared.exe not found at: $cloudflaredExe" -ForegroundColor Red
        Write-Host "Run setup-cloudflare-tunnel.ps1 first" -ForegroundColor Yellow
        exit 1
    }
    
    if (-not (Test-Path $ConfigPath)) {
        Write-Host "[ERROR] Config file not found: $ConfigPath" -ForegroundColor Red
        Write-Host "Run configure-tunnel.ps1 first" -ForegroundColor Yellow
        exit 1
    }
    
    # Stop existing processes
    Write-Host "Step 1: Stopping existing processes..." -ForegroundColor Yellow
    $processes = Get-Process cloudflared -ErrorAction SilentlyContinue
    if ($processes) {
        $processes | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
    
    # Uninstall existing service
    $existingService = Get-Service -Name cloudflared -ErrorAction SilentlyContinue
    if ($existingService) {
        Write-Host "Step 2: Uninstalling existing service..." -ForegroundColor Yellow
        if ($existingService.Status -eq 'Running') {
            Stop-Service -Name cloudflared -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        }
        Push-Location "C:\cloudflared"
        & $cloudflaredExe service uninstall 2>&1 | Out-Null
        Pop-Location
        Start-Sleep -Seconds 2
    } else {
        Write-Host "Step 2: No existing service found" -ForegroundColor Gray
    }
    
    # Install service
    Write-Host "Step 3: Installing service..." -ForegroundColor Yellow
    try {
        Push-Location "C:\cloudflared"
        & $cloudflaredExe service install 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] Failed to install service" -ForegroundColor Red
            Pop-Location
            exit 1
        }
        Pop-Location
        Start-Sleep -Seconds 2
        Write-Host "  [OK] Service installed" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Exception: $_" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    
    # Configure ImagePath (CRITICAL - prevents crashes)
    Write-Host "Step 4: Configuring service (prevents crashes)..." -ForegroundColor Yellow
    try {
        $servicePath = "HKLM:\SYSTEM\CurrentControlSet\Services\cloudflared"
        $currentImagePath = (Get-ItemProperty -Path $servicePath -Name ImagePath -ErrorAction Stop).ImagePath
        
        # CRITICAL: Proper quoting prevents service crashes
        $newImagePath = "`"$currentImagePath`" tunnel --config `"$ConfigPath`" run $TunnelName"
        
        Set-ItemProperty -Path $servicePath -Name ImagePath -Value $newImagePath -ErrorAction Stop
        Write-Host "  [OK] Service configured correctly" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to configure service: $_" -ForegroundColor Red
        Write-Host "Service will crash without this configuration!" -ForegroundColor Yellow
        exit 1
    }
    
    # Set to auto-start
    Write-Host "Step 5: Setting to auto-start..." -ForegroundColor Yellow
    try {
        Set-Service -Name cloudflared -StartupType Automatic -ErrorAction Stop
        Write-Host "  [OK] Set to automatic start" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed: $_" -ForegroundColor Red
    }
    
    # Start service
    Write-Host "Step 6: Starting service..." -ForegroundColor Yellow
    try {
        Start-Service -Name cloudflared -ErrorAction Stop
        Start-Sleep -Seconds 5
        Write-Host "  [OK] Service started" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to start: $_" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "[OK] Installation complete!" -ForegroundColor Green
    Write-Host "Wait 30-60 seconds for tunnel to connect, then run: .\tunnel-service.ps1 status" -ForegroundColor Yellow
}

# ============================================================================
# START - Start the service
# ============================================================================
if ($Action -eq "start") {
    Write-Host "Starting service..." -ForegroundColor Yellow
    
    $service = Get-Service -Name cloudflared -ErrorAction SilentlyContinue
    if (-not $service) {
        Write-Host "[ERROR] Service not installed. Run: .\tunnel-service.ps1 install" -ForegroundColor Red
        exit 1
    }
    
    if ($service.Status -eq 'Running') {
        Write-Host "[OK] Service is already running" -ForegroundColor Green
        exit 0
    }
    
    try {
        Start-Service -Name cloudflared -ErrorAction Stop
        Start-Sleep -Seconds 3
        Write-Host "[OK] Service started" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to start: $_" -ForegroundColor Red
        Write-Host "Service may be crashing. Run: .\tunnel-service.ps1 fix" -ForegroundColor Yellow
        exit 1
    }
}

# ============================================================================
# STOP - Stop the service
# ============================================================================
if ($Action -eq "stop") {
    Write-Host "Stopping service..." -ForegroundColor Yellow
    
    $service = Get-Service -Name cloudflared -ErrorAction SilentlyContinue
    if (-not $service) {
        Write-Host "[OK] Service not installed" -ForegroundColor Gray
        exit 0
    }
    
    if ($service.Status -eq 'Stopped') {
        Write-Host "[OK] Service is already stopped" -ForegroundColor Green
        exit 0
    }
    
    try {
        Stop-Service -Name cloudflared -Force -ErrorAction Stop
        Start-Sleep -Seconds 2
        
        # Kill any remaining processes
        $processes = Get-Process cloudflared -ErrorAction SilentlyContinue
        if ($processes) {
            $processes | Stop-Process -Force -ErrorAction SilentlyContinue
        }
        
        Write-Host "[OK] Service stopped" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to stop: $_" -ForegroundColor Red
        exit 1
    }
}

# ============================================================================
# RESTART - Restart the service
# ============================================================================
if ($Action -eq "restart") {
    Write-Host "Restarting service..." -ForegroundColor Yellow
    
    $service = Get-Service -Name cloudflared -ErrorAction SilentlyContinue
    if (-not $service) {
        Write-Host "[ERROR] Service not installed. Run: .\tunnel-service.ps1 install" -ForegroundColor Red
        exit 1
    }
    
    try {
        if ($service.Status -eq 'Running') {
            Stop-Service -Name cloudflared -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 3
        }
        
        Start-Service -Name cloudflared -ErrorAction Stop
        Start-Sleep -Seconds 5
        Write-Host "[OK] Service restarted" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to restart: $_" -ForegroundColor Red
        exit 1
    }
}

# ============================================================================
# FIX - Fix crashing service
# ============================================================================
if ($Action -eq "fix") {
    Write-Host "Fixing service issues..." -ForegroundColor Yellow
    Write-Host ""
    
    # Stop service
    Write-Host "Step 1: Stopping service..." -ForegroundColor Yellow
    $service = Get-Service -Name cloudflared -ErrorAction SilentlyContinue
    if ($service -and $service.Status -eq 'Running') {
        Stop-Service -Name cloudflared -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 3
    }
    
    # Kill processes
    $processes = Get-Process cloudflared -ErrorAction SilentlyContinue
    if ($processes) {
        $processes | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
    
    # Check if service exists
    if (-not $service) {
        Write-Host "[INFO] Service not installed. Installing..." -ForegroundColor Yellow
        & $PSCommandPath install
        exit $LASTEXITCODE
    }
    
    # Uninstall and reinstall
    Write-Host "Step 2: Reinstalling service..." -ForegroundColor Yellow
    try {
        Push-Location "C:\cloudflared"
        & $cloudflaredExe service uninstall 2>&1 | Out-Null
        Start-Sleep -Seconds 2
        & $cloudflaredExe service install 2>&1 | Out-Null
        Start-Sleep -Seconds 2
        Pop-Location
        Write-Host "  [OK] Service reinstalled" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed: $_" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    
    # Fix ImagePath
    Write-Host "Step 3: Fixing service configuration..." -ForegroundColor Yellow
    try {
        $servicePath = "HKLM:\SYSTEM\CurrentControlSet\Services\cloudflared"
        $currentImagePath = (Get-ItemProperty -Path $servicePath -Name ImagePath -ErrorAction Stop).ImagePath
        
        # Remove quotes if present, then add proper quotes
        $basePath = $currentImagePath.Trim('"')
        $newImagePath = "`"$basePath`" tunnel --config `"$ConfigPath`" run $TunnelName"
        
        Set-ItemProperty -Path $servicePath -Name ImagePath -Value $newImagePath -ErrorAction Stop
        Write-Host "  [OK] Configuration fixed" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to fix configuration: $_" -ForegroundColor Red
        exit 1
    }
    
    # Set auto-start
    Write-Host "Step 4: Configuring auto-start..." -ForegroundColor Yellow
    try {
        Set-Service -Name cloudflared -StartupType Automatic -ErrorAction Stop
        Write-Host "  [OK] Auto-start configured" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed: $_" -ForegroundColor Red
    }
    
    # Start service
    Write-Host "Step 5: Starting service..." -ForegroundColor Yellow
    try {
        Start-Service -Name cloudflared -ErrorAction Stop
        Start-Sleep -Seconds 5
        Write-Host "  [OK] Service started" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to start: $_" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "[OK] Fix complete! Wait 30-60 seconds, then run: .\tunnel-service.ps1 status" -ForegroundColor Green
}

# ============================================================================
# DEBUG - Run tunnel manually to see errors
# ============================================================================
if ($Action -eq "debug") {
    Write-Host "Running tunnel manually to show debug output..." -ForegroundColor Yellow
    Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
    Write-Host ""
    
    # Stop service
    $service = Get-Service -Name cloudflared -ErrorAction SilentlyContinue
    if ($service -and $service.Status -eq 'Running') {
        Write-Host "Stopping service..." -ForegroundColor Yellow
        Stop-Service -Name cloudflared -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 3
    }
    
    # Kill processes
    $processes = Get-Process cloudflared -ErrorAction SilentlyContinue
    if ($processes) {
        $processes | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
    
    # Verify config
    if (-not (Test-Path $ConfigPath)) {
        Write-Host "[ERROR] Config not found: $ConfigPath" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Config file: $ConfigPath" -ForegroundColor Gray
    Write-Host "Tunnel name: $TunnelName" -ForegroundColor Gray
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Debug Output (watch for errors):" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    try {
        Push-Location "C:\cloudflared"
        & $cloudflaredExe tunnel --config $ConfigPath run $TunnelName
    } catch {
        Write-Host ""
        Write-Host "[ERROR] $_" -ForegroundColor Red
    } finally {
        Pop-Location
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "Restarting service..." -ForegroundColor Yellow
        Start-Service -Name cloudflared -ErrorAction SilentlyContinue
        Write-Host "[OK] Service restarted" -ForegroundColor Green
    }
}

Write-Host ""

