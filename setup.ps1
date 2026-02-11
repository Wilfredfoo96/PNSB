# AutoCount Integration - Master Setup Script
# Handles all setup, installation, and management tasks
# Usage: .\setup.ps1 [action]

param(
    [Parameter(Position=0)]
    [ValidateSet(
        "check-prereqs", "install-iis", "install-api", "restart-api", "update-api",
        "find-autocount", "find-database", 
        "setup-tunnel", "configure-tunnel", "tunnel-status", "tunnel-fix", "tunnel-debug",
        "test-vercel", "help"
    )]
    [string]$Action = "help"
)

$ErrorActionPreference = "Continue"

# Helper function to check admin
function Test-Administrator {
    return ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Helper function to require admin
function Require-Administrator {
    if (-not (Test-Administrator)) {
        Write-Host "[ERROR] This action requires Administrator privileges" -ForegroundColor Red
        Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
        exit 1
    }
}

# ============================================================================
# HELP
# ============================================================================
if ($Action -eq "help") {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "AutoCount Integration - Master Setup" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\setup.ps1 [action]" -ForegroundColor White
    Write-Host ""
    Write-Host "Available Actions:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Prerequisites & Installation:" -ForegroundColor Cyan
    Write-Host "    check-prereqs      - Check prerequisites before installation" -ForegroundColor White
    Write-Host "    install-iis        - Install IIS (if not installed)" -ForegroundColor White
    Write-Host "    install-api        - Install IIS API (requires admin)" -ForegroundColor White
    Write-Host ""
    Write-Host "  API Management:" -ForegroundColor Cyan
    Write-Host "    restart-api        - Restart IIS API (requires admin)" -ForegroundColor White
    Write-Host "    update-api         - Update IIS API files (requires admin)" -ForegroundColor White
    Write-Host ""
    Write-Host "  AutoCount Discovery:" -ForegroundColor Cyan
    Write-Host "    find-autocount     - Find AutoCount installation directory" -ForegroundColor White
    Write-Host "    find-database      - Find AutoCount database connection info" -ForegroundColor White
    Write-Host ""
    Write-Host "  Cloudflare Tunnel:" -ForegroundColor Cyan
    Write-Host "    setup-tunnel       - Download and setup cloudflared" -ForegroundColor White
    Write-Host "    configure-tunnel   - Configure tunnel config.yml" -ForegroundColor White
    Write-Host "    tunnel-status      - Check tunnel service status" -ForegroundColor White
    Write-Host "    tunnel-fix         - Fix tunnel issues (requires admin)" -ForegroundColor White
    Write-Host "    tunnel-debug       - Debug tunnel manually (requires admin)" -ForegroundColor White
    Write-Host ""
    Write-Host "  Testing:" -ForegroundColor Cyan
    Write-Host "    test-vercel        - Test Vercel connection" -ForegroundColor White
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\setup.ps1 check-prereqs" -ForegroundColor Gray
    Write-Host "  .\setup.ps1 install-api" -ForegroundColor Gray
    Write-Host "  .\setup.ps1 tunnel-status" -ForegroundColor Gray
    Write-Host ""
    exit 0
}

# ============================================================================
# CHECK PREREQUISITES
# ============================================================================
if ($Action -eq "check-prereqs") {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "AutoCount API Installer - Prerequisites Check" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    $allGood = $true
    
    # Check Administrator
    Write-Host "1. Checking Administrator privileges..." -ForegroundColor Yellow
    $isAdmin = Test-Administrator
    if ($isAdmin) {
        Write-Host "   [OK] Running as Administrator" -ForegroundColor Green
    } else {
        Write-Host "   [X] NOT running as Administrator" -ForegroundColor Red
        Write-Host "     Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
        $allGood = $false
    }
    
    # Check .NET
    Write-Host ""
    Write-Host "2. Checking .NET Runtime..." -ForegroundColor Yellow
    try {
        $output = & dotnet --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   [OK] .NET Runtime found: $output" -ForegroundColor Green
        } else {
            throw "dotnet command failed"
        }
    } catch {
        Write-Host "   [X] .NET Runtime not found" -ForegroundColor Red
        Write-Host "     Download from: https://dotnet.microsoft.com/download/dotnet/8.0" -ForegroundColor Yellow
        Write-Host "     Install: ASP.NET Core Runtime 8.0.x - Windows Hosting Bundle" -ForegroundColor Yellow
        $allGood = $false
    }
    
    # Check IIS
    Write-Host ""
    Write-Host "3. Checking IIS..." -ForegroundColor Yellow
    $inetpubPath = "C:\inetpub"
    if (Test-Path $inetpubPath) {
        Write-Host "   [OK] IIS appears to be installed (inetpub folder exists)" -ForegroundColor Green
    } else {
        Write-Host "   [!] IIS not installed (inetpub folder not found)" -ForegroundColor Yellow
        Write-Host "     The installer will install IIS automatically" -ForegroundColor Gray
    }
    
    # Check publish folder
    Write-Host ""
    Write-Host "4. Checking for published application..." -ForegroundColor Yellow
    $publishPath = Join-Path $PSScriptRoot "autocount-api\AutoCountApi\publish"
    if (Test-Path $publishPath) {
        $fileCount = (Get-ChildItem -Path $publishPath -File -Recurse -ErrorAction SilentlyContinue).Count
        Write-Host "   [OK] Publish folder found: $publishPath" -ForegroundColor Green
        Write-Host "     Files: $fileCount" -ForegroundColor Gray
    } else {
        Write-Host "   [X] Publish folder not found: $publishPath" -ForegroundColor Red
        Write-Host "     Build the application first:" -ForegroundColor Yellow
        Write-Host "       cd autocount-api\AutoCountApi" -ForegroundColor Gray
        Write-Host "       dotnet publish -c Release -o ./publish" -ForegroundColor Gray
        $allGood = $false
    }
    
    # Check installer script
    Write-Host ""
    Write-Host "5. Checking installer script..." -ForegroundColor Yellow
    $installerPath = Join-Path $PSScriptRoot "autocount-api\Installer\install.ps1"
    if (Test-Path $installerPath) {
        Write-Host "   [OK] Installer script found" -ForegroundColor Green
    } else {
        Write-Host "   [X] Installer script not found: $installerPath" -ForegroundColor Red
        $allGood = $false
    }
    
    # Summary
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    if ($allGood) {
        Write-Host "[OK] All prerequisites met!" -ForegroundColor Green
        Write-Host "You can now run the installer:" -ForegroundColor Yellow
        Write-Host "  .\setup.ps1 install-api" -ForegroundColor White
    } else {
        Write-Host "[!] Some prerequisites are missing" -ForegroundColor Yellow
        Write-Host "Please fix the issues above before running the installer" -ForegroundColor Yellow
    }
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    exit $(if ($allGood) { 0 } else { 1 })
}

# ============================================================================
# INSTALL IIS
# ============================================================================
if ($Action -eq "install-iis") {
    Require-Administrator
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "IIS Installation Check" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Check if inetpub exists
    Write-Host "Checking for IIS installation..." -ForegroundColor Yellow
    if (Test-Path "C:\inetpub") {
        Write-Host "[OK] IIS appears to be installed (inetpub folder exists)" -ForegroundColor Green
    } else {
        Write-Host "✗ IIS is not installed (inetpub folder not found)" -ForegroundColor Red
        Write-Host ""
        Write-Host "Installing IIS..." -ForegroundColor Yellow
        
        # Install IIS features
        $features = @(
            "IIS-WebServerRole", "IIS-WebServer", "IIS-CommonHttpFeatures",
            "IIS-HttpErrors", "IIS-ApplicationInit", "IIS-NetFxExtensibility45",
            "IIS-HealthAndDiagnostics", "IIS-HttpLogging", "IIS-Security",
            "IIS-RequestFiltering", "IIS-Performance", "IIS-HttpCompressionStatic",
            "IIS-ManagementConsole"
        )
        
        foreach ($feature in $features) {
            Write-Host "  Installing $feature..." -ForegroundColor Gray
            Enable-WindowsOptionalFeature -Online -FeatureName $feature -NoRestart -ErrorAction SilentlyContinue | Out-Null
        }
        
        Write-Host ""
        Write-Host "[OK] IIS installation completed!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Note: You may need to restart your computer for all changes to take effect." -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Checking IIS status..." -ForegroundColor Yellow
    try {
        Import-Module WebAdministration -ErrorAction SilentlyContinue
        $iisVersion = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\InetStp\" -ErrorAction SilentlyContinue
        if ($iisVersion) {
            Write-Host "[OK] IIS Version: $($iisVersion.MajorVersion).$($iisVersion.MinorVersion)" -ForegroundColor Green
        }
        
        $w3svc = Get-Service -Name W3SVC -ErrorAction SilentlyContinue
        if ($w3svc) {
            Write-Host "[OK] IIS Service Status: $($w3svc.Status)" -ForegroundColor Green
            if ($w3svc.Status -ne "Running") {
                Write-Host "  Starting IIS service..." -ForegroundColor Yellow
                Start-Service -Name W3SVC
            }
        }
    } catch {
        Write-Host "  (Could not check IIS details)" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Next Steps" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Install .NET 8.0 Hosting Bundle:" -ForegroundColor Yellow
    Write-Host "   Download from: https://dotnet.microsoft.com/download/dotnet/8.0" -ForegroundColor White
    Write-Host "   Look for 'ASP.NET Core Runtime 8.0.x - Windows Hosting Bundle'" -ForegroundColor White
    Write-Host ""
    Write-Host "2. Run the AutoCount API installer:" -ForegroundColor Yellow
    Write-Host "   .\setup.ps1 install-api" -ForegroundColor White
    Write-Host ""
    exit 0
}

# ============================================================================
# INSTALL API
# ============================================================================
if ($Action -eq "install-api") {
    Require-Administrator
    $installerPath = Join-Path $PSScriptRoot "autocount-api\Installer\install.ps1"
    if (-not (Test-Path $installerPath)) {
        Write-Host "[ERROR] Installer not found: $installerPath" -ForegroundColor Red
        exit 1
    }
    & $installerPath
    exit $LASTEXITCODE
}

# ============================================================================
# RESTART API
# ============================================================================
if ($Action -eq "restart-api") {
    Require-Administrator
    $scriptPath = Join-Path $PSScriptRoot "autocount-api\Installer\restart-api.ps1"
    if (-not (Test-Path $scriptPath)) {
        Write-Host "[ERROR] Script not found: $scriptPath" -ForegroundColor Red
        exit 1
    }
    & $scriptPath
    exit $LASTEXITCODE
}

# ============================================================================
# UPDATE API
# ============================================================================
if ($Action -eq "update-api") {
    Require-Administrator
    $scriptPath = Join-Path $PSScriptRoot "autocount-api\Installer\update-api.ps1"
    if (-not (Test-Path $scriptPath)) {
        Write-Host "[ERROR] Script not found: $scriptPath" -ForegroundColor Red
        exit 1
    }
    & $scriptPath
    exit $LASTEXITCODE
}

# ============================================================================
# FIND AUTOCount
# ============================================================================
if ($Action -eq "find-autocount") {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "AutoCount Installation Finder" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Check common installation paths
    Write-Host "Checking common installation paths..." -ForegroundColor Yellow
    $commonPaths = @(
        "C:\Program Files\AutoCount",
        "C:\Program Files (x86)\AutoCount",
        "C:\AutoCount",
        "C:\Program Files\AutoCount Accounting",
        "C:\Program Files (x86)\AutoCount Accounting"
    )
    
    $foundPaths = @()
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            Write-Host "  Found: $path" -ForegroundColor Green
            $foundPaths += $path
        }
    }
    
    Write-Host ""
    
    # Check running processes
    Write-Host "Checking running AutoCount processes..." -ForegroundColor Yellow
    $processes = Get-Process | Where-Object { $_.ProcessName -like "*AutoCount*" -or $_.ProcessName -like "*AC*" }
    if ($processes) {
        foreach ($proc in $processes) {
            Write-Host "  Process: $($proc.ProcessName)" -ForegroundColor Green
            try {
                $procPath = $proc.Path
                $procDir = Split-Path $procPath -Parent
                Write-Host "    Location: $procDir" -ForegroundColor Cyan
                if ($procDir -and (Test-Path $procDir)) {
                    $foundPaths += $procDir
                }
            } catch {
                Write-Host "    (Cannot access process path)" -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "  No AutoCount processes found running" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Summary" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    if ($foundPaths.Count -gt 0) {
        Write-Host "Found AutoCount installation paths:" -ForegroundColor Green
        $uniquePaths = $foundPaths | Select-Object -Unique
        foreach ($path in $uniquePaths) {
            Write-Host "  $path" -ForegroundColor Yellow
        }
    } else {
        Write-Host "No AutoCount installation paths found automatically" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Manual check suggestions:" -ForegroundColor Cyan
        Write-Host "  1. Check: C:\Program Files\AutoCount" -ForegroundColor White
        Write-Host "  2. Check: C:\Program Files (x86)\AutoCount" -ForegroundColor White
        Write-Host "  3. Right-click AutoCount shortcut -> Properties -> Open File Location" -ForegroundColor White
    }
    Write-Host ""
    exit 0
}

# ============================================================================
# FIND DATABASE
# ============================================================================
if ($Action -eq "find-database") {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "AutoCount Database Connection Finder" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Check SQL Server for AutoCount databases
    Write-Host "Querying SQL Server for AutoCount databases..." -ForegroundColor Yellow
    
    $instances = @("localhost", "localhost\SQLEXPRESS", "localhost\A2006", ".", $env:COMPUTERNAME, "$env:COMPUTERNAME\A2006")
    $foundDatabases = @()
    
    foreach ($instance in $instances) {
        Write-Host "  Trying instance: $instance" -ForegroundColor Gray
        
        try {
            $query = "SELECT name, database_id FROM sys.databases WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb') ORDER BY name"
            $result = sqlcmd -S $instance -Q $query -h -1 -W 2>&1
            
            if ($LASTEXITCODE -eq 0 -and $result) {
                Write-Host "    [OK] Connected to SQL Server instance: $instance" -ForegroundColor Green
                
                $databases = $result | Where-Object { $_ -and $_ -notmatch "^-+$" -and $_ -notmatch "rows affected" } | ForEach-Object { $_.Trim() }
                
                foreach ($db in $databases) {
                    if ($db -and $db -notmatch "^\s*$") {
                        Write-Host "      Database: $db" -ForegroundColor Cyan
                        
                        if ($db -match "(?i)(autocount|ac|aed|account)") {
                            Write-Host '        [!] Likely AutoCount database!' -ForegroundColor Yellow
                            $foundDatabases += @{
                                Instance = $instance
                                Database = $db
                            }
                        }
                    }
                }
                break
            }
        } catch {
            # Continue to next instance
        }
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Summary" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    if ($foundDatabases.Count -gt 0) {
        Write-Host "AutoCount Database Information:" -ForegroundColor Green
        Write-Host ""
        foreach ($db in $foundDatabases) {
            Write-Host "  Server Instance: $($db.Instance)" -ForegroundColor Yellow
            Write-Host "  Database Name:   $($db.Database)" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "  Connection String Format:" -ForegroundColor Cyan
            Write-Host "    Server=$($db.Instance);Database=$($db.Database);User Id=sa;Password=YOUR_PASSWORD;" -ForegroundColor White
            Write-Host ""
        }
    } else {
        Write-Host '[!] Could not automatically detect AutoCount database' -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Manual steps:" -ForegroundColor Cyan
        Write-Host "  1. Open SQL Server Management Studio (SSMS)" -ForegroundColor White
        Write-Host "  2. Connect to your SQL Server instance" -ForegroundColor White
        Write-Host "  3. Look for databases with names like:" -ForegroundColor White
        Write-Host "     - AED_TEST, AED_LIVE, AutoCount, AC_*" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "Common AutoCount Database Names:" -ForegroundColor Cyan
    Write-Host "  - AED_TEST (Test/Development)" -ForegroundColor White
    Write-Host "  - AED_LIVE (Production)" -ForegroundColor White
    Write-Host "  - AutoCount" -ForegroundColor White
    Write-Host "  - AC_* (various versions)" -ForegroundColor White
    Write-Host ""
    exit 0
}

# ============================================================================
# SETUP TUNNEL
# ============================================================================
if ($Action -eq "setup-tunnel") {
    $scriptPath = Join-Path $PSScriptRoot "autocount-api\Installer\setup-cloudflare-tunnel.ps1"
    if (-not (Test-Path $scriptPath)) {
        Write-Host "[ERROR] Script not found: $scriptPath" -ForegroundColor Red
        exit 1
    }
    & $scriptPath
    exit $LASTEXITCODE
}

# ============================================================================
# CONFIGURE TUNNEL
# ============================================================================
if ($Action -eq "configure-tunnel") {
    $scriptPath = Join-Path $PSScriptRoot "autocount-api\Installer\configure-tunnel.ps1"
    if (-not (Test-Path $scriptPath)) {
        Write-Host "[ERROR] Script not found: $scriptPath" -ForegroundColor Red
        exit 1
    }
    & $scriptPath
    exit $LASTEXITCODE
}

# ============================================================================
# TUNNEL STATUS
# ============================================================================
if ($Action -eq "tunnel-status") {
    $scriptPath = Join-Path $PSScriptRoot "autocount-api\Installer\tunnel-service.ps1"
    if (-not (Test-Path $scriptPath)) {
        Write-Host "[ERROR] Script not found: $scriptPath" -ForegroundColor Red
        exit 1
    }
    & $scriptPath status
    exit $LASTEXITCODE
}

# ============================================================================
# TUNNEL FIX
# ============================================================================
if ($Action -eq "tunnel-fix") {
    Require-Administrator
    $scriptPath = Join-Path $PSScriptRoot "autocount-api\Installer\tunnel-service.ps1"
    if (-not (Test-Path $scriptPath)) {
        Write-Host "[ERROR] Script not found: $scriptPath" -ForegroundColor Red
        exit 1
    }
    & $scriptPath fix
    exit $LASTEXITCODE
}

# ============================================================================
# TUNNEL DEBUG
# ============================================================================
if ($Action -eq "tunnel-debug") {
    Require-Administrator
    $scriptPath = Join-Path $PSScriptRoot "autocount-api\Installer\tunnel-service.ps1"
    if (-not (Test-Path $scriptPath)) {
        Write-Host "[ERROR] Script not found: $scriptPath" -ForegroundColor Red
        exit 1
    }
    & $scriptPath debug
    exit $LASTEXITCODE
}

# ============================================================================
# TEST VERCEL
# ============================================================================
if ($Action -eq "test-vercel") {
    $scriptPath = Join-Path $PSScriptRoot "autocount-api\Installer\test-vercel-connection.ps1"
    if (-not (Test-Path $scriptPath)) {
        Write-Host "[ERROR] Script not found: $scriptPath" -ForegroundColor Red
        exit 1
    }
    & $scriptPath
    exit $LASTEXITCODE
}

Write-Host "[ERROR] Unknown action: $Action" -ForegroundColor Red
Write-Host "Run: .\setup.ps1 help" -ForegroundColor Yellow
exit 1

