-- AutoCount Schema Discovery Queries
-- Run these to discover the actual table structures BEFORE writing INSERT/UPDATE statements
-- This helps prevent: NOT NULL violations, foreign key errors, invalid column names

-- ============================================================================
-- GENERAL TABLE SCHEMA QUERIES (Replace 'TableName' with your table)
-- ============================================================================

-- 1. Get ALL columns with full details (use this first)
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    CHARACTER_MAXIMUM_LENGTH,
    NUMERIC_PRECISION,
    NUMERIC_SCALE,
    COLUMN_DEFAULT,
    ORDINAL_POSITION
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'TableName'  -- Replace with: DO, ARInvoice, Debtor, etc.
ORDER BY ORDINAL_POSITION;

-- 2. Get ONLY REQUIRED (NOT NULL) columns - these MUST be in INSERT statements
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'TableName'  -- Replace with your table name
    AND IS_NULLABLE = 'NO'
ORDER BY ORDINAL_POSITION;

-- 3. Get FOREIGN KEY constraints - verify referenced values exist
SELECT 
    fk.name AS ForeignKeyName,
    OBJECT_NAME(fk.parent_object_id) AS TableName,
    COL_NAME(fc.parent_object_id, fc.parent_column_id) AS ColumnName,
    OBJECT_NAME(fk.referenced_object_id) AS ReferencedTable,
    COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS ReferencedColumn
FROM sys.foreign_keys AS fk
INNER JOIN sys.foreign_key_columns AS fc
    ON fk.object_id = fc.constraint_object_id
WHERE OBJECT_NAME(fk.parent_object_id) = 'TableName'  -- Replace with your table name
ORDER BY fk.name;

-- 4. Check if a column exists (to verify spelling)
SELECT 
    COLUMN_NAME,
    DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'TableName'  -- Replace with your table name
    AND COLUMN_NAME LIKE '%ColumnName%'  -- Replace with column you're looking for
ORDER BY COLUMN_NAME;

-- ============================================================================
-- SPECIFIC TABLE QUERIES
-- ============================================================================

-- DO (Delivery Orders) - Required columns
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    CHARACTER_MAXIMUM_LENGTH,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'DO'
    AND IS_NULLABLE = 'NO'
ORDER BY ORDINAL_POSITION;

-- DO - Foreign Keys
SELECT 
    fk.name AS ForeignKeyName,
    COL_NAME(fc.parent_object_id, fc.parent_column_id) AS ColumnName,
    OBJECT_NAME(fk.referenced_object_id) AS ReferencedTable,
    COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS ReferencedColumn
FROM sys.foreign_keys AS fk
INNER JOIN sys.foreign_key_columns AS fc
    ON fk.object_id = fc.constraint_object_id
WHERE OBJECT_NAME(fk.parent_object_id) = 'DO';

-- ARInvoice - Required columns
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    CHARACTER_MAXIMUM_LENGTH,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'ARInvoice'
    AND IS_NULLABLE = 'NO'
ORDER BY ORDINAL_POSITION;

-- ARInvoice - Foreign Keys
SELECT 
    fk.name AS ForeignKeyName,
    COL_NAME(fc.parent_object_id, fc.parent_column_id) AS ColumnName,
    OBJECT_NAME(fk.referenced_object_id) AS ReferencedTable,
    COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS ReferencedColumn
FROM sys.foreign_keys AS fk
INNER JOIN sys.foreign_key_columns AS fc
    ON fk.object_id = fc.constraint_object_id
WHERE OBJECT_NAME(fk.parent_object_id) = 'ARInvoice';

-- ============================================================================
-- VALIDATION QUERIES (Run before INSERT)
-- ============================================================================

-- Check if a UserID exists (for foreign key validation)
SELECT UserID, UserName, IsActive 
FROM Users 
WHERE UserID = 'API' OR UserID = 'ADMIN';  -- Check if these exist

-- Get list of valid UserIDs
SELECT TOP 10 UserID, UserName, IsActive 
FROM Users 
WHERE IsActive = 'Y'
ORDER BY UserID;

-- Check Currency table columns (to verify column names)
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Currency'
ORDER BY ORDINAL_POSITION;

-- Verify a customer exists and is active
SELECT AccNo, CompanyName, IsActive, CurrencyCode, DisplayTerm
FROM Debtor
WHERE AccNo = '300-C001';  -- Replace with actual customer code

-- ============================================================================
-- QUICK REFERENCE: Common Tables
-- ============================================================================

-- Debtor (Customers)
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Debtor'
ORDER BY ORDINAL_POSITION;

-- Item (Products)
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Item'
ORDER BY ORDINAL_POSITION;

-- Currency
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Currency'
ORDER BY ORDINAL_POSITION;

-- Users
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Users'
ORDER BY ORDINAL_POSITION;
