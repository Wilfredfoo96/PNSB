# Build
cd C:\Project\PNSB\autocount-api\AutoCountApi
dotnet publish -c Release -o publish

# Deploy (run as Administrator)
cd ..\Installer
.\update-api.ps1

Unblock-File -Path .\setup.ps1 -ErrorAction SilentlyContinue; if ($?) { Write-Host "File unblocked successfully" -ForegroundColor Green } else { Write-Host "File may already be unblocked or error occurred" -ForegroundColor Yellow }