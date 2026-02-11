# Update AutoCount API
# Run this script as Administrator

param(
    [string]$SourcePath = "C:\Project\PNSB\autocount-api\AutoCountApi\publish",
    [string]$DestPath = "C:\inetpub\wwwroot\AutoCountApi",
    [string]$AppPoolName = "AutoCountApiAppPool"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Update AutoCount API" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[!] ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Load IIS module
Write-Host "Loading IIS module..." -ForegroundColor Yellow
Import-Module WebAdministration -ErrorAction Stop
Write-Host "[OK] IIS module loaded" -ForegroundColor Green

# Stop app pool
Write-Host ""
Write-Host "Stopping application pool..." -ForegroundColor Yellow
try {
    Stop-WebAppPool -Name $AppPoolName -ErrorAction Stop
    Start-Sleep -Seconds 3
    Write-Host "[OK] Application pool stopped" -ForegroundColor Green
} catch {
    Write-Host "[!] Warning: Could not stop app pool: $_" -ForegroundColor Yellow
}

# Wait for processes to release files
Write-Host ""
Write-Host "Waiting for processes to release files..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Copy files (preserve appsettings.json)
Write-Host ""
Write-Host "Copying files..." -ForegroundColor Yellow
Write-Host "  Source: $SourcePath" -ForegroundColor Gray
Write-Host "  Destination: $DestPath" -ForegroundColor Gray

# Normalize and resolve paths
$SourcePath = $SourcePath.TrimEnd('\', '/')
$DestPath = $DestPath.TrimEnd('\', '/')

# Resolve source path to absolute
if (Test-Path $SourcePath) {
    $SourcePath = (Resolve-Path $SourcePath -ErrorAction Stop).Path
} else {
    Write-Host "[!] ERROR: Source path not found: $SourcePath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please build and publish the API first:" -ForegroundColor Yellow
    Write-Host "  cd autocount-api\AutoCountApi" -ForegroundColor White
    Write-Host "  dotnet publish -c Release -o publish" -ForegroundColor White
    exit 1
}

# Ensure destination path is absolute (create if needed)
if (-not (Test-Path $DestPath)) {
    New-Item -ItemType Directory -Path $DestPath -Force | Out-Null
}
$DestPath = (Resolve-Path $DestPath -ErrorAction Stop).Path

try {
    # Copy all files except appsettings.json
    $fileCount = 0
    Get-ChildItem -Path $SourcePath -Recurse -File | ForEach-Object {
        # Calculate relative path using .NET Path methods for reliability
        $sourceFullPath = $_.FullName
        try {
            # Try .NET Core/Standard 2.1+ method (PowerShell 5.1+ with .NET 4.7.2+ or PowerShell Core)
            $relativePath = [System.IO.Path]::GetRelativePath($SourcePath, $sourceFullPath)
        } catch {
            # Fallback for older PowerShell versions
            $relativePath = $sourceFullPath.Substring($SourcePath.Length).TrimStart('\', '/')
        }
        $destFile = [System.IO.Path]::Combine($DestPath, $relativePath)
        
        # Skip appsettings.json
        if ($relativePath -eq "appsettings.json" -or $relativePath.EndsWith("\appsettings.json") -or $relativePath.EndsWith("/appsettings.json")) {
            Write-Host "  [SKIP] appsettings.json (preserved)" -ForegroundColor Gray
            return
        }
        
        # Create destination directory if needed
        $destDir = Split-Path $destFile -Parent
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        
        # Copy file
        Copy-Item -Path $_.FullName -Destination $destFile -Force -ErrorAction Stop
        $fileCount++
    }
    Write-Host "[OK] Files copied ($fileCount files)" -ForegroundColor Green
} catch {
    Write-Host "[!] ERROR: Could not copy files: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Trying alternative: Copy only DLL..." -ForegroundColor Yellow
    
    # Try copying just the main DLL
    $dllSource = Join-Path $SourcePath "AutoCountApi.dll"
    $dllDest = Join-Path $DestPath "AutoCountApi.dll"
    if (Test-Path $dllSource) {
        Copy-Item -Path $dllSource -Destination $dllDest -Force
        Write-Host "[OK] AutoCountApi.dll copied" -ForegroundColor Green
    } else {
        Write-Host "[!] ERROR: AutoCountApi.dll not found in source" -ForegroundColor Red
        exit 1
    }
}

# Start app pool
Write-Host ""
Write-Host "Starting application pool..." -ForegroundColor Yellow
try {
    Start-WebAppPool -Name $AppPoolName -ErrorAction Stop
    Start-Sleep -Seconds 3
    Write-Host "[OK] Application pool started" -ForegroundColor Green
} catch {
    Write-Host "[!] Warning: Could not start app pool: $_" -ForegroundColor Yellow
    Write-Host "Trying IIS reset..." -ForegroundColor Yellow
    iisreset
    Start-Sleep -Seconds 5
}

# Test API
Write-Host ""
Write-Host "Testing API..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
$healthUrl = "http://localhost:5001/api/v1/health"
try {
    $response = Invoke-WebRequest -Uri $healthUrl -TimeoutSec 10 -ErrorAction Stop
    Write-Host "[OK] API is responding" -ForegroundColor Green
} catch {
    Write-Host "[!] API test failed: $_" -ForegroundColor Yellow
    Write-Host "  The API may need a few more seconds to start" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Update Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to exit..."
try {
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
} catch {
    Start-Sleep -Seconds 2
}

