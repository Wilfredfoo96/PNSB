# Quick Check: Required Columns for INSERT Statements
# Run this to see what columns are required for a table

param(
    [Parameter(Mandatory=$true)]
    [string]$TableName
)

$schemaFile = "..\website\autocount-schema-summary.txt"

if (-not (Test-Path $schemaFile)) {
    Write-Host "[!] ERROR: Schema file not found: $schemaFile" -ForegroundColor Red
    Write-Host "Make sure you're running this from the autocount-api directory" -ForegroundColor Yellow
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Required Columns for: $TableName" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$content = Get-Content $schemaFile

# Find the table section
$foundTable = $false
$tableContent = @()
$inTable = $false

foreach ($line in $content) {
    if ($line -match "^Table: $TableName \(") {
        $foundTable = $true
        $inTable = $true
        continue
    }
    
    if ($inTable) {
        if ($line -match "^Table: ") {
            # Next table found, stop
            break
        }
        if ($line -match "^-+$") {
            # Skip the separator line
            continue
        }
        if ($line.Trim() -ne "") {
            $tableContent += $line
        }
    }
}

if ($foundTable -and $tableContent.Count -gt 0) {
    
    Write-Host "NOT NULL (Required) Columns:" -ForegroundColor Yellow
    Write-Host "------------------------------" -ForegroundColor Gray
    
    $requiredColumns = @()
    $allColumns = @()
    
    foreach ($line in ($tableContent -split "`n")) {
        if ($line -match "^\s+(\w+)\s+.*?\s+(NOT NULL|NULL)") {
            $columnName = $matches[1]
            $isNullable = $matches[2]
            $allColumns += @{ Name = $columnName; IsNullable = ($isNullable -eq "NOT NULL") }
            
            if ($isNullable -eq "NOT NULL") {
                $requiredColumns += $columnName
                Write-Host "  [REQUIRED] $columnName" -ForegroundColor Red
            }
        }
    }
    
    Write-Host ""
    Write-Host "Summary:" -ForegroundColor Yellow
    Write-Host "  Total columns: $($allColumns.Count)" -ForegroundColor Gray
    Write-Host "  Required (NOT NULL): $($requiredColumns.Count)" -ForegroundColor Red
    Write-Host "  Optional (NULL): $($allColumns.Count - $requiredColumns.Count)" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "Required Columns List (for INSERT):" -ForegroundColor Yellow
    Write-Host ($requiredColumns -join ", ") -ForegroundColor White
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "1. Ensure all required columns are in your INSERT statement" -ForegroundColor Gray
    Write-Host "2. Provide values or defaults for each required column" -ForegroundColor Gray
    Write-Host "3. Check foreign keys reference valid values" -ForegroundColor Gray
    
} else {
    Write-Host "[!] ERROR: Table '$TableName' not found in schema" -ForegroundColor Red
    Write-Host ""
    Write-Host "Available tables (sample):" -ForegroundColor Yellow
    $allTables = [regex]::Matches($content, "Table: (\w+)")
    $allTables | Select-Object -First 20 | ForEach-Object {
        $tableName = $_.Groups[1].Value
        Write-Host "  - $tableName" -ForegroundColor Gray
    }
}
