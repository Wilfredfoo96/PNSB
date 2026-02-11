-- Compare last 4 rows (our generated) with previous rows (correct way)
-- This will help identify missing fields

-- First, let's see the structure and sample of all rows
SELECT TOP 10 
    DtlKey, DocKey, Seq, ItemCode, Description, Qty, Rate, UnitPrice, UOM,
    Discount, DiscountAmt, SubTotal, SubTotalExTax, LocalSubTotal, LocalSubTotalExTax,
    TaxCode, Tax, TaxRate, TaxableAmt, LocalTax, TaxCurrencyTax,
    Location, BatchNo, AccNo, ProjNo, DeptNo,
    MainItem, TransferedQty, Transferable, PrintOut, AddToSubTotal,
    YourPONo, YourPODate, FromDocType, FromDocNo,
    SmallestQty, SubQty, SmallestUnitPrice,
    Guid
FROM DODTL
ORDER BY DtlKey DESC

-- Compare specific fields that might be missing
-- Check for NULL vs populated values in key fields
SELECT 
    'Last 4 (Our Generated)' as Source,
    COUNT(*) as RowCount,
    SUM(CASE WHEN Rate IS NULL THEN 1 ELSE 0 END) as Rate_NULL,
    SUM(CASE WHEN UOM IS NULL THEN 1 ELSE 0 END) as UOM_NULL,
    SUM(CASE WHEN TaxCode IS NULL THEN 1 ELSE 0 END) as TaxCode_NULL,
    SUM(CASE WHEN Tax IS NULL THEN 1 ELSE 0 END) as Tax_NULL,
    SUM(CASE WHEN TaxRate IS NULL THEN 1 ELSE 0 END) as TaxRate_NULL,
    SUM(CASE WHEN TaxableAmt IS NULL THEN 1 ELSE 0 END) as TaxableAmt_NULL,
    SUM(CASE WHEN SubTotalExTax IS NULL THEN 1 ELSE 0 END) as SubTotalExTax_NULL,
    SUM(CASE WHEN LocalSubTotal IS NULL THEN 1 ELSE 0 END) as LocalSubTotal_NULL,
    SUM(CASE WHEN LocalTax IS NULL THEN 1 ELSE 0 END) as LocalTax_NULL,
    SUM(CASE WHEN Location IS NULL THEN 1 ELSE 0 END) as Location_NULL,
    SUM(CASE WHEN AccNo IS NULL THEN 1 ELSE 0 END) as AccNo_NULL,
    SUM(CASE WHEN DiscountAmt IS NULL THEN 1 ELSE 0 END) as DiscountAmt_NULL
FROM (
    SELECT TOP 4 * FROM DODTL ORDER BY DtlKey DESC
) AS Last4

UNION ALL

SELECT 
    'Previous (Correct)' as Source,
    COUNT(*) as RowCount,
    SUM(CASE WHEN Rate IS NULL THEN 1 ELSE 0 END) as Rate_NULL,
    SUM(CASE WHEN UOM IS NULL THEN 1 ELSE 0 END) as UOM_NULL,
    SUM(CASE WHEN TaxCode IS NULL THEN 1 ELSE 0 END) as TaxCode_NULL,
    SUM(CASE WHEN Tax IS NULL THEN 1 ELSE 0 END) as Tax_NULL,
    SUM(CASE WHEN TaxRate IS NULL THEN 1 ELSE 0 END) as TaxRate_NULL,
    SUM(CASE WHEN TaxableAmt IS NULL THEN 1 ELSE 0 END) as TaxableAmt_NULL,
    SUM(CASE WHEN SubTotalExTax IS NULL THEN 1 ELSE 0 END) as SubTotalExTax_NULL,
    SUM(CASE WHEN LocalSubTotal IS NULL THEN 1 ELSE 0 END) as LocalSubTotal_NULL,
    SUM(CASE WHEN LocalTax IS NULL THEN 1 ELSE 0 END) as LocalTax_NULL,
    SUM(CASE WHEN Location IS NULL THEN 1 ELSE 0 END) as Location_NULL,
    SUM(CASE WHEN AccNo IS NULL THEN 1 ELSE 0 END) as AccNo_NULL,
    SUM(CASE WHEN DiscountAmt IS NULL THEN 1 ELSE 0 END) as DiscountAmt_NULL
FROM (
    SELECT * FROM DODTL 
    WHERE DtlKey NOT IN (SELECT TOP 4 DtlKey FROM DODTL ORDER BY DtlKey DESC)
    ORDER BY DtlKey DESC
) AS Previous

-- Get sample of correct row to see all populated fields
SELECT TOP 1 *
FROM DODTL
WHERE DtlKey NOT IN (SELECT TOP 4 DtlKey FROM DODTL ORDER BY DtlKey DESC)
ORDER BY DtlKey DESC

-- Check where Location might come from (Item table, DO table, or settings?)
SELECT DISTINCT Location FROM DODTL WHERE Location IS NOT NULL

-- Check where AccNo might come from (Item table?)
SELECT DISTINCT i.ItemCode, i.AccNo, d.AccNo as DODTL_AccNo
FROM Item i
LEFT JOIN DODTL d ON i.ItemCode = d.ItemCode
WHERE d.AccNo IS NOT NULL
ORDER BY i.ItemCode

-- Check TaxRate in TaxCode table vs DODTL
SELECT tc.TaxCode, tc.TaxRate, d.TaxCode, d.TaxRate
FROM TaxCode tc
LEFT JOIN DODTL d ON tc.TaxCode = d.TaxCode
WHERE d.TaxCode IS NOT NULL
ORDER BY tc.TaxCode
