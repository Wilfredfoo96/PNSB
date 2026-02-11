# How to Prevent Database Errors in AutoCount API

This guide helps prevent common database errors like:
- Foreign key constraint violations
- NOT NULL column violations
- Invalid column names
- Missing required fields

## 1. **Check Database Schema Before Coding**

### Use the Schema Summary File
Before writing any INSERT/UPDATE statements, check:
```
website/autocount-schema-summary.txt
```

Search for your table (e.g., `Table: DO`) and note:
- All columns marked as `NOT NULL` - these MUST be included
- Foreign key relationships
- Data types and constraints

### Query Database Directly
Run these SQL queries in SQL Server Management Studio:

```sql
-- 1. Get all NOT NULL columns (required fields)
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    CHARACTER_MAXIMUM_LENGTH,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'DO'  -- Replace with your table name
    AND IS_NULLABLE = 'NO'
ORDER BY ORDINAL_POSITION;

-- 2. Get all foreign key constraints
SELECT 
    fk.name AS ForeignKeyName,
    OBJECT_NAME(fk.parent_object_id) AS TableName,
    COL_NAME(fc.parent_object_id, fc.parent_column_id) AS ColumnName,
    OBJECT_NAME(fk.referenced_object_id) AS ReferencedTable,
    COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS ReferencedColumn
FROM sys.foreign_keys AS fk
INNER JOIN sys.foreign_key_columns AS fc
    ON fk.object_id = fc.constraint_object_id
WHERE OBJECT_NAME(fk.parent_object_id) = 'DO';  -- Replace with your table name

-- 3. Get all columns with their properties
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    CHARACTER_MAXIMUM_LENGTH,
    NUMERIC_PRECISION,
    NUMERIC_SCALE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'DO'  -- Replace with your table name
ORDER BY ORDINAL_POSITION;
```

## 2. **Create a Checklist Before Writing INSERT Statements**

### ✅ Pre-INSERT Checklist

- [ ] **Required Fields (NOT NULL)**
  - [ ] List all NOT NULL columns from schema
  - [ ] Ensure each has a value or default
  - [ ] Check if any have defaults in the database

- [ ] **Foreign Keys**
  - [ ] Identify all foreign key columns
  - [ ] Verify referenced values exist in parent tables
  - [ ] Create helper methods to get valid foreign key values

- [ ] **Column Names**
  - [ ] Verify exact column names (case-sensitive in some databases)
  - [ ] Check for typos
  - [ ] Use schema file to confirm spelling

- [ ] **Data Types**
  - [ ] Match data types (string, int, decimal, datetime, etc.)
  - [ ] Check precision/scale for decimals
  - [ ] Verify date formats

- [ ] **Default Values**
  - [ ] Check if columns have database defaults
  - [ ] Provide explicit defaults if needed
  - [ ] Don't rely on database defaults if column is NOT NULL

## 3. **Best Practices in Code**

### Always Query for Foreign Key Values

```csharp
// ❌ BAD: Hardcoded value that might not exist
{ "UserID", "API" }

// ✅ GOOD: Query for valid value
private async Task<string> GetValidUserIDAsync()
{
    var query = "SELECT TOP 1 UserID FROM Users WHERE IsActive = 'Y' ORDER BY UserID";
    var result = await _dbService.ExecuteScalarAsync<string>(query);
    return result ?? "ADMIN"; // With fallback
}
```

### Always Include All NOT NULL Columns

```csharp
// ❌ BAD: Missing DisplayTerm (NOT NULL)
INSERT INTO DO (DocKey, DocNo, DocDate, DebtorCode)
VALUES (@DocKey, @DocNo, @DocDate, @DebtorCode)

// ✅ GOOD: All NOT NULL columns included
INSERT INTO DO (
    DocKey, DocNo, DocDate, DebtorCode, DisplayTerm, 
    CurrencyCode, CurrencyRate, ...
)
VALUES (
    @DocKey, @DocNo, @DocDate, @DebtorCode, @DisplayTerm,
    @CurrencyCode, @CurrencyRate, ...
)
```

### Verify Column Names from Actual Tables

```csharp
// ❌ BAD: Assuming column name
SELECT CurrencyRate FROM Currency

// ✅ GOOD: Check schema first
// Currency table has: BankBuyRate, BankSellRate (NOT CurrencyRate)
SELECT BankSellRate FROM Currency
```

### Use Helper Methods for Complex Lookups

```csharp
// ✅ GOOD: Centralized helper methods
private async Task<string?> GetDebtorDisplayTermAsync(string debtorCode)
{
    var query = "SELECT DisplayTerm FROM Debtor WHERE AccNo = @DebtorCode";
    var parameters = new Dictionary<string, object> { { "DebtorCode", debtorCode } };
    var result = await _dbService.ExecuteScalarAsync<string>(query, parameters);
    return result ?? ""; // Provide default for NOT NULL columns
}
```

## 4. **Testing Strategy**

### Test INSERT Statements Incrementally

1. **Test with minimal data first**
   ```sql
   -- Test with just required fields
   INSERT INTO DO (DocKey, DocNo, DocDate, DebtorCode, DisplayTerm, ...)
   VALUES (1, 'TEST-001', GETDATE(), 'TEST', '', ...)
   ```

2. **Verify foreign keys exist**
   ```sql
   -- Before inserting, verify:
   SELECT UserID FROM Users WHERE UserID = 'API'  -- Should return a row
   ```

3. **Check for defaults**
   ```sql
   -- See what defaults exist
   SELECT COLUMN_DEFAULT 
   FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_NAME = 'DO' AND COLUMN_DEFAULT IS NOT NULL
   ```

## 5. **Common Patterns to Follow**

### Pattern 1: Get Required Values from Related Tables

```csharp
// Get DisplayTerm from customer
var displayTerm = await GetDebtorDisplayTermAsync(request.DebtorCode);

// Get currency info from customer
var currencyCode = await GetDebtorCurrencyCodeAsync(request.DebtorCode);
var currencyRate = await GetCurrencyRateAsync(currencyCode);
```

### Pattern 2: Generate Sequential Keys

```csharp
// Generate DocKey manually if not IDENTITY
var getNextDocKeyQuery = "SELECT ISNULL(MAX(DocKey), 0) + 1 FROM DO";
var docKey = await _dbService.ExecuteScalarAsync<long>(getNextDocKeyQuery);
```

### Pattern 3: Provide Safe Defaults

```csharp
// For NOT NULL columns, always provide a default
var displayTerm = await GetDebtorDisplayTermAsync(debtorCode) ?? "";
var currencyCode = customerCurrencyCode ?? "MYR";
var currencyRate = rate ?? 1.0m;
```

## 6. **Error Prevention Checklist**

Before deploying any INSERT/UPDATE code:

- [ ] ✅ All NOT NULL columns included
- [ ] ✅ All foreign key values verified to exist
- [ ] ✅ Column names verified against schema
- [ ] ✅ Data types match schema
- [ ] ✅ Default values provided where needed
- [ ] ✅ Helper methods created for complex lookups
- [ ] ✅ Error handling for missing data
- [ ] ✅ Logging added for debugging

## 7. **Quick Reference: Common Tables**

### DO (Delivery Orders)
**Required Fields:**
- DocKey, DocNo, DocDate, DebtorCode, DisplayTerm
- CurrencyCode, CurrencyRate, ToTaxCurrencyRate
- PostToStock, Transferable, Cancelled, DocStatus
- PrintCount, LastModified, LastModifiedUserID
- CreatedTimeStamp, CreatedUserID, CanSync, LastUpdate
- Guid, InclusiveTax, RoundingMethod

**Foreign Keys:**
- CreatedUserID → Users.UserID
- LastModifiedUserID → Users.UserID

### ARInvoice (Invoices)
**Required Fields:**
- DocKey, DocNo, DocDate, DebtorCode, JournalType
- DisplayTerm, DueDate
- CurrencyCode, CurrencyRate, ToTaxCurrencyRate
- Cancelled, DocStatus
- LastModified, LastModifiedUserID
- CreatedTimeStamp, CreatedUserID
- InclusiveTax, RoundingMethod
- WithholdingTaxVersion, WithholdingTaxRoundingMethod

**Foreign Keys:**
- CreatedUserID → Users.UserID
- LastModifiedUserID → Users.UserID

## 8. **Tools and Scripts**

- Use `validate-schema.ps1` to check table structure
- Use `get-autocount-schema.sql` to query schema
- Check `autocount-schema-summary.txt` for quick reference

## 9. **When Errors Still Occur**

1. **Check the exact error message** - it tells you which column/constraint failed
2. **Query the database** to see what values actually exist
3. **Check the schema file** for the exact column definition
4. **Add logging** to see what values you're trying to insert
5. **Test the INSERT statement directly in SQL** before fixing code

## 10. **Example: Complete INSERT Pattern**

```csharp
// 1. Generate keys
var docKey = await GetNextDocKeyAsync();

// 2. Get required values from related tables
var debtorName = await GetDebtorNameAsync(request.DebtorCode) ?? "";
var displayTerm = await GetDebtorDisplayTermAsync(request.DebtorCode);
var validUserID = await GetValidUserIDAsync();
var currencyInfo = await GetCurrencyInfoAsync(request.DebtorCode);

// 3. Build INSERT with ALL required fields
var insertQuery = @"
    INSERT INTO DO (
        DocKey, DocNo, DocDate, DebtorCode, DebtorName, 
        DisplayTerm, CurrencyCode, CurrencyRate, ToTaxCurrencyRate,
        PostToStock, Transferable, Cancelled, DocStatus,
        PrintCount, LastModified, LastModifiedUserID, 
        CreatedTimeStamp, CreatedUserID,
        CanSync, LastUpdate, Guid, InclusiveTax, RoundingMethod
    )
    VALUES (
        @DocKey, @DocNo, @DocDate, @DebtorCode, @DebtorName,
        @DisplayTerm, @CurrencyCode, @CurrencyRate, @ToTaxCurrencyRate,
        'F', 'F', 'F', 'D',
        0, @LastModified, @UserID,
        @CreatedTimeStamp, @UserID,
        'Y', @LastUpdate, NEWID(), 'N', 0
    );
";

// 4. Include all parameters
var parameters = new Dictionary<string, object>
{
    { "DocKey", docKey },
    { "DocNo", docNo },
    { "DocDate", request.DocDate },
    { "DebtorCode", request.DebtorCode },
    { "DebtorName", debtorName },
    { "DisplayTerm", displayTerm },
    { "CurrencyCode", currencyInfo.Code },
    { "CurrencyRate", currencyInfo.Rate },
    { "ToTaxCurrencyRate", currencyInfo.Rate },
    { "LastModified", DateTime.Now },
    { "UserID", validUserID },
    { "CreatedTimeStamp", DateTime.Now },
    { "LastUpdate", GetUnixTimestamp() }
};
```

---

**Remember:** Always verify against the actual database schema, not assumptions!
