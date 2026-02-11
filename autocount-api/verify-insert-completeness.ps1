# Verify INSERT Statement Completeness
# Compares INSERT statement columns against required schema columns

param(
    [string]$TableName = "DO"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verifying INSERT Statement for: $TableName" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get required columns
$schemaFile = "..\website\autocount-schema-summary.txt"
$content = Get-Content $schemaFile

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
            break
        }
        if ($line -match "^-+$") {
            continue
        }
        if ($line.Trim() -ne "") {
            $tableContent += $line
        }
    }
}

if (-not $foundTable) {
    Write-Host "[!] ERROR: Table '$TableName' not found" -ForegroundColor Red
    exit 1
}

# Extract required columns
$requiredColumns = @()
foreach ($line in $tableContent) {
    if ($line -match "^\s+(\w+)\s+.*?\s+NOT NULL") {
        $columnName = $matches[1]
        $requiredColumns += $columnName
    }
}

Write-Host "Required columns from schema: $($requiredColumns.Count)" -ForegroundColor Yellow
Write-Host ($requiredColumns -join ", ") -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Manual Verification Steps:" -ForegroundColor Yellow
Write-Host "1. Open your INSERT statement in the code" -ForegroundColor Gray
Write-Host "2. Check that all columns above are included" -ForegroundColor Gray
Write-Host "3. Verify foreign keys reference valid values" -ForegroundColor Gray
Write-Host "4. Ensure data types match" -ForegroundColor Gray
Write-Host ""
Write-Host "Current INSERT should include these columns:" -ForegroundColor Cyan
Write-Host ($requiredColumns -join ", ") -ForegroundColor White
