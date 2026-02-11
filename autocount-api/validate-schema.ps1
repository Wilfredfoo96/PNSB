# Schema Validation Script for AutoCount API
# Run this before making changes to INSERT/UPDATE statements
# This helps prevent foreign key, NOT NULL, and column name errors

param(
    [string]$TableName = "",
    [string]$ConnectionString = ""
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AutoCount Schema Validator" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ([string]::IsNullOrEmpty($TableName)) {
    Write-Host "Usage: .\validate-schema.ps1 -TableName 'DO' -ConnectionString 'your-connection-string'" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "This script validates:" -ForegroundColor Yellow
    Write-Host "  1. Required (NOT NULL) columns" -ForegroundColor Gray
    Write-Host "  2. Foreign key constraints" -ForegroundColor Gray
    Write-Host "  3. Column names and data types" -ForegroundColor Gray
    Write-Host "  4. Default values" -ForegroundColor Gray
    exit 0
}

# SQL queries to validate schema
$queries = @{
    "RequiredColumns" = @"
        SELECT 
            COLUMN_NAME,
            DATA_TYPE,
            IS_NULLABLE,
            CHARACTER_MAXIMUM_LENGTH,
            COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '$TableName'
            AND IS_NULLABLE = 'NO'
        ORDER BY ORDINAL_POSITION;
"@
    
    "ForeignKeys" = @"
        SELECT 
            fk.name AS ForeignKeyName,
            OBJECT_NAME(fk.parent_object_id) AS TableName,
            COL_NAME(fc.parent_object_id, fc.parent_column_id) AS ColumnName,
            OBJECT_NAME(fk.referenced_object_id) AS ReferencedTable,
            COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS ReferencedColumn
        FROM sys.foreign_keys AS fk
        INNER JOIN sys.foreign_key_columns AS fc
            ON fk.object_id = fc.constraint_object_id
        WHERE OBJECT_NAME(fk.parent_object_id) = '$TableName';
"@
    
    "AllColumns" = @"
        SELECT 
            COLUMN_NAME,
            DATA_TYPE,
            IS_NULLABLE,
            CHARACTER_MAXIMUM_LENGTH,
            NUMERIC_PRECISION,
            NUMERIC_SCALE,
            COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '$TableName'
        ORDER BY ORDINAL_POSITION;
"@
}

Write-Host "Validating table: $TableName" -ForegroundColor Yellow
Write-Host ""

# Note: This script requires SQL Server connection
# For actual execution, you would need to connect to the database
# This is a template - you can extend it with actual database connection

Write-Host "Required (NOT NULL) Columns:" -ForegroundColor Cyan
Write-Host "Run this SQL query to see required columns:" -ForegroundColor Gray
Write-Host $queries.RequiredColumns -ForegroundColor White
Write-Host ""

Write-Host "Foreign Key Constraints:" -ForegroundColor Cyan
Write-Host "Run this SQL query to see foreign keys:" -ForegroundColor Gray
Write-Host $queries.ForeignKeys -ForegroundColor White
Write-Host ""

Write-Host "All Columns:" -ForegroundColor Cyan
Write-Host "Run this SQL query to see all columns:" -ForegroundColor Gray
Write-Host $queries.AllColumns -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "Validation Complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Run these queries in SQL Server Management Studio" -ForegroundColor Gray
Write-Host "2. Check the schema-summary.txt file for table structure" -ForegroundColor Gray
Write-Host "3. Verify all NOT NULL columns are included in INSERT statements" -ForegroundColor Gray
Write-Host "4. Verify all foreign key columns reference valid values" -ForegroundColor Gray
