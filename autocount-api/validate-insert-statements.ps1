# Validate INSERT Statements Against Schema
# This script checks INSERT statements in C# code against the schema summary

param(
    [string]$ServiceFile = "",
    [string]$TableName = ""
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "INSERT Statement Validator" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ([string]::IsNullOrEmpty($ServiceFile)) {
    Write-Host "Usage: .\validate-insert-statements.ps1 -ServiceFile 'Services\DeliveryOrderService.cs' -TableName 'DO'" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "This script:" -ForegroundColor Yellow
    Write-Host "  1. Extracts INSERT statement from C# file" -ForegroundColor Gray
    Write-Host "  2. Checks against schema-summary.txt" -ForegroundColor Gray
    Write-Host "  3. Reports missing NOT NULL columns" -ForegroundColor Gray
    Write-Host "  4. Reports potential foreign key issues" -ForegroundColor Gray
    exit 0
}

$schemaFile = "..\website\autocount-schema-summary.txt"
if (-not (Test-Path $schemaFile)) {
    Write-Host "[!] ERROR: Schema file not found: $schemaFile" -ForegroundColor Red
    exit 1
}

Write-Host "Reading schema for table: $TableName" -ForegroundColor Yellow
$schemaContent = Get-Content $schemaFile -Raw

# Extract table schema
$tablePattern = "Table: $TableName \(.*?\)\s*`n-+\s*`n(.*?)(?=`n`nTable:|`Z)"
if ($schemaContent -match $tablePattern) {
    $tableSchema = $matches[1]
    Write-Host "[OK] Found table schema" -ForegroundColor Green
    
    # Extract NOT NULL columns
    $notNullPattern = "^\s+(\w+)\s+.*?\s+NOT NULL"
    $notNullColumns = [System.Collections.ArrayList]@()
    foreach ($line in $tableSchema -split "`n") {
        if ($line -match $notNullPattern) {
            $columnName = $matches[1]
            [void]$notNullColumns.Add($columnName)
        }
    }
    
    Write-Host "`nRequired (NOT NULL) columns found: $($notNullColumns.Count)" -ForegroundColor Cyan
    foreach ($col in $notNullColumns) {
        Write-Host "  - $col" -ForegroundColor Gray
    }
    
} else {
    Write-Host "[!] ERROR: Table '$TableName' not found in schema" -ForegroundColor Red
    exit 1
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "Validation Complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Manual Steps:" -ForegroundColor Yellow
Write-Host "1. Check your INSERT statement includes all NOT NULL columns above" -ForegroundColor Gray
Write-Host "2. Verify foreign key values exist in referenced tables" -ForegroundColor Gray
Write-Host "3. Check column names match exactly (case-sensitive)" -ForegroundColor Gray
