# AutoCount API Installer Script
# Run as Administrator

param(
    [string]$InstallPath = "C:\inetpub\wwwroot\AutoCountApi",
    [int]$Port = 5001,
    [string]$SiteName = "AutoCountApi",
    [string]$AppPoolName = "AutoCountApiAppPool"
)

# Set up logging
$logFile = Join-Path $env:TEMP "autocount-api-installer-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
function Write-Log {
    param([string]$Message, [string]$Color = "White")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Add-Content -Path $logFile -Value $logMessage
    Write-Host $Message -ForegroundColor $Color
}

$ErrorActionPreference = "Continue"  # Changed to Continue so we can catch errors

Write-Log "========================================" "Cyan"
Write-Log "AutoCount API Installer" "Cyan"
Write-Log "========================================" "Cyan"
Write-Log "Log file: $logFile" "Gray"
Write-Log ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Log "ERROR: This script must be run as Administrator" "Red"
    Write-Log "Right-click PowerShell and select 'Run as Administrator'" "Yellow"
    Write-Log ""
    Write-Log "Press any key to exit..."
    try {
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    } catch {
        Start-Sleep -Seconds 2
    }
    exit 1
}

# Check .NET 8.0 Runtime
Write-Log "Checking .NET 8.0 Runtime..." "Yellow"
try {
    $dotnetVersion = dotnet --version 2>&1
    if ($LASTEXITCODE -ne 0 -or $dotnetVersion -match "error") {
        throw "dotnet command failed"
    }
    Write-Log "[OK] .NET Runtime found: $dotnetVersion" "Green"
} catch {
    Write-Log "ERROR: .NET 8.0 Runtime not found. Please install from:" "Red"
    Write-Log "https://dotnet.microsoft.com/download/dotnet/8.0" "Yellow"
    Write-Log "Look for 'ASP.NET Core Runtime 8.0.x - Windows Hosting Bundle'" "Yellow"
    Write-Log ""
    Write-Log "Press any key to exit..."
    try {
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    } catch {
        Start-Sleep -Seconds 2
    }
    exit 1
}

# Enable IIS Features
Write-Log ""
Write-Log "Enabling IIS features..." "Yellow"
$features = @(
    "IIS-WebServerRole",
    "IIS-WebServer",
    "IIS-CommonHttpFeatures",
    "IIS-HttpErrors",
    "IIS-ApplicationInit",
    "IIS-NetFxExtensibility45",
    "IIS-HealthAndDiagnostics",
    "IIS-HttpLogging",
    "IIS-Security",
    "IIS-RequestFiltering",
    "IIS-Performance",
    "IIS-HttpCompressionStatic",
    "IIS-ManagementConsole"
)

$featuresEnabled = 0
foreach ($feature in $features) {
    try {
        $state = Get-WindowsOptionalFeature -Online -FeatureName $feature -ErrorAction SilentlyContinue
        if ($state -and $state.State -ne "Enabled") {
            Write-Log "  Enabling $feature..." "Gray"
            $result = Enable-WindowsOptionalFeature -Online -FeatureName $feature -NoRestart -ErrorAction Stop
            $featuresEnabled++
        }
    } catch {
        Write-Log "  Warning: Could not enable $feature - $_" "Yellow"
    }
}
if ($featuresEnabled -gt 0) {
    Write-Log "[OK] IIS features enabled ($featuresEnabled features)" "Green"
} else {
    Write-Log "[OK] IIS features already enabled" "Green"
}

# Import WebAdministration module
Write-Log "Loading IIS module..." "Yellow"
try {
    Import-Module WebAdministration -ErrorAction Stop
    Write-Log "[OK] IIS module loaded" "Green"
} catch {
    Write-Log "ERROR: Could not load WebAdministration module" "Red"
    Write-Log "Make sure IIS is installed and Management Console is enabled" "Yellow"
    Write-Log ""
    Write-Log "Press any key to exit..."
    try {
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    } catch {
        Start-Sleep -Seconds 2
    }
    exit 1
}

# Create Application Pool
Write-Log ""
Write-Log "Creating application pool..." "Yellow"
try {
    if (Test-Path "IIS:\AppPools\$AppPoolName") {
        Write-Log "  Application pool already exists, removing..." "Gray"
        Remove-WebAppPool -Name $AppPoolName -ErrorAction Stop
    }

    New-WebAppPool -Name $AppPoolName -Force -ErrorAction Stop | Out-Null
    $appPool = Get-Item "IIS:\AppPools\$AppPoolName" -ErrorAction Stop
    $appPool.managedRuntimeVersion = ""
    $appPool.processModel.identityType = "ApplicationPoolIdentity"
    $appPool | Set-Item
    Write-Log "[OK] Application pool created" "Green"
} catch {
    Write-Log "ERROR: Could not create application pool: $_" "Red"
    Write-Log ""
    Write-Log "Press any key to exit..."
    try {
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    } catch {
        Start-Sleep -Seconds 2
    }
    exit 1
}

# Create installation directory
Write-Log ""
Write-Log "Creating installation directory..." "Yellow"
if (Test-Path $InstallPath) {
    Write-Log "  Directory exists, backing up..." "Gray"
    $backupPath = "$InstallPath.backup.$(Get-Date -Format 'yyyyMMddHHmmss')"
    Move-Item -Path $InstallPath -Destination $backupPath -Force
}
New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
Write-Log "[OK] Directory created: $InstallPath" "Green"

# Copy application files
Write-Log ""
Write-Log "Copying application files..." "Yellow"
$sourcePath = Join-Path $PSScriptRoot "..\AutoCountApi\publish"
if (-not (Test-Path $sourcePath)) {
    Write-Log "ERROR: Source path not found: $sourcePath" "Red"
    Write-Log "Please build the application first:" "Yellow"
    Write-Log "  cd autocount-api\AutoCountApi" "Gray"
    Write-Log "  dotnet publish -c Release -o ./publish" "Gray"
    Write-Log ""
    Write-Log "Press any key to exit..."
    try {
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    } catch {
        Start-Sleep -Seconds 2
    }
    exit 1
}

try {
    Copy-Item -Path "$sourcePath\*" -Destination $InstallPath -Recurse -Force -ErrorAction Stop
    Write-Log "[OK] Files copied" "Green"
} catch {
    Write-Log "ERROR: Could not copy files: $_" "Red"
    Write-Log ""
    Write-Log "Press any key to exit..."
    try {
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    } catch {
        Start-Sleep -Seconds 2
    }
    exit 1
}

# Create IIS Site
Write-Log ""
Write-Log "Creating IIS site..." "Yellow"
try {
    if (Test-Path "IIS:\Sites\$SiteName") {
        Write-Log "  Site already exists, removing..." "Gray"
        Remove-Website -Name $SiteName -ErrorAction Stop
    }

    New-Website -Name $SiteName -Port $Port -PhysicalPath $InstallPath -ApplicationPool $AppPoolName -Force -ErrorAction Stop | Out-Null
    Write-Log "[OK] IIS site created on port $Port" "Green"
} catch {
    Write-Log "ERROR: Could not create IIS site: $_" "Red"
    Write-Log ""
    Write-Log "Press any key to exit..."
    try {
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    } catch {
        Start-Sleep -Seconds 2
    }
    exit 1
}

# Configure Firewall
Write-Log ""
Write-Log "Configuring firewall..." "Yellow"
try {
    $firewallRule = Get-NetFirewallRule -DisplayName "AutoCount API" -ErrorAction SilentlyContinue
    if ($firewallRule) {
        Remove-NetFirewallRule -DisplayName "AutoCount API" -ErrorAction SilentlyContinue
    }
    New-NetFirewallRule -DisplayName "AutoCount API" -Direction Inbound -LocalPort $Port -Protocol TCP -Action Allow -ErrorAction Stop | Out-Null
    Write-Log "[OK] Firewall rule created" "Green"
} catch {
    Write-Log "Warning: Could not configure firewall: $_" "Yellow"
    Write-Log "You may need to manually allow port $Port in Windows Firewall" "Gray"
}

# Start Application Pool
Write-Log ""
Write-Log "Starting application pool..." "Yellow"
try {
    Start-WebAppPool -Name $AppPoolName -ErrorAction Stop
    Start-Sleep -Seconds 2
    Write-Log "[OK] Application pool started" "Green"
} catch {
    Write-Log "Warning: Could not start application pool: $_" "Yellow"
}

# Test API
Write-Log ""
Write-Log "Testing API..." "Yellow"
$healthUrl = "http://localhost:$Port/api/v1/health"
try {
    $response = Invoke-WebRequest -Uri $healthUrl -TimeoutSec 10 -ErrorAction Stop
    Write-Log "[OK] API is responding" "Green"
    Write-Log "  Status: $($response.StatusCode)" "Gray"
} catch {
    Write-Log "[!] API test failed, but installation completed" "Yellow"
    Write-Log "  Please check configuration in appsettings.json" "Gray"
    Write-Log "  Error: $_" "Gray"
}

Write-Log ""
Write-Log "========================================" "Cyan"
Write-Log "Installation Complete!" "Green"
Write-Log "========================================" "Cyan"
Write-Log ""
Write-Log "Log file saved to: $logFile" "Gray"
Write-Log ""
Write-Log "Next steps:" "Yellow"
Write-Log "1. Edit $InstallPath\appsettings.json" "White"
Write-Log "   - Configure database connection string" "Gray"
Write-Log "   - Set a secure API key" "Gray"
Write-Log "   - Configure allowed IPs" "Gray"
Write-Log ""
Write-Log "2. Restart the application pool:" "White"
Write-Log "   Restart-WebAppPool -Name $AppPoolName" "Gray"
Write-Log ""
Write-Log "3. Test the API:" "White"
Write-Log "   http://localhost:$Port/api/v1/health" "Gray"
Write-Log "   http://localhost:$Port/swagger" "Gray"
Write-Log ""
Write-Log "Press any key to exit..."
try {
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
} catch {
    # If ReadKey fails (e.g., in non-interactive mode), just exit
    Start-Sleep -Seconds 2
}

