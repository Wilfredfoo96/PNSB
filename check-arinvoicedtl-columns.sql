-- Check ARInvoiceDTL table structure to verify column names
-- Run this in SQL Server Management Studio to see actual columns

-- 1. Get ALL columns in ARInvoiceDTL
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    CHARACTER_MAXIMUM_LENGTH,
    NUMERIC_PRECISION,
    NUMERIC_SCALE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'ARInvoiceDTL'
ORDER BY ORDINAL_POSITION;

-- 2. Check if Amount column exists
SELECT 
    COLUMN_NAME,
    DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'ARInvoiceDTL'
    AND COLUMN_NAME LIKE '%Amount%'
ORDER BY COLUMN_NAME;

-- 3. Check if SubTotal column exists
SELECT 
    COLUMN_NAME,
    DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'ARInvoiceDTL'
    AND COLUMN_NAME LIKE '%SubTotal%'
ORDER BY COLUMN_NAME;

-- 4. Check existing data in ARInvoiceDTL (sample)
SELECT TOP 5 *
FROM ARInvoiceDTL
ORDER BY DtlKey DESC;

-- 5. Check DO table DocNo format
SELECT TOP 10 DocNo, DocDate, CreatedTimeStamp
FROM DO
ORDER BY DocKey DESC;
