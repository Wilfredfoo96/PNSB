# INSERT Statement Checklist

Use this checklist BEFORE writing any INSERT statement to prevent errors.

## ✅ Pre-Coding Checklist

### 1. Schema Research
- [ ] Open `website/autocount-schema-summary.txt`
- [ ] Find your table (e.g., `Table: DO`)
- [ ] List ALL columns marked as `NOT NULL`
- [ ] Note all foreign key relationships
- [ ] Check data types for each column

### 2. SQL Validation (Run in SSMS)
- [ ] Run: `SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'YourTable' AND IS_NULLABLE = 'NO'`
- [ ] Run: Foreign key query to see all FK constraints
- [ ] Verify column names exist (check for typos)
- [ ] Check if referenced tables/values exist

### 3. Code Preparation
- [ ] Create helper methods for foreign key lookups
- [ ] Create helper methods for required field lookups
- [ ] Plan default values for NOT NULL columns
- [ ] Plan how to generate keys (if not IDENTITY)

## ✅ INSERT Statement Checklist

### Required Fields
- [ ] All NOT NULL columns included in INSERT
- [ ] Each NOT NULL column has a value or default
- [ ] No NULL values for NOT NULL columns

### Foreign Keys
- [ ] All foreign key columns have valid values
- [ ] Values exist in referenced tables
- [ ] Helper methods query for valid FK values (not hardcoded)

### Column Names
- [ ] All column names match schema exactly
- [ ] No typos in column names
- [ ] Column names verified against schema file

### Data Types
- [ ] String values match nvarchar/varchar types
- [ ] Numeric values match decimal/int types
- [ ] Date values properly formatted
- [ ] Boolean/char values use correct format ('Y'/'N', 'T'/'F')

### Special Cases
- [ ] DocKey generated if not IDENTITY
- [ ] GUID generated if required (use NEWID())
- [ ] Timestamps set correctly
- [ ] User IDs from Users table (not hardcoded)

## ✅ Testing Checklist

- [ ] Test INSERT with minimal required fields first
- [ ] Verify foreign key values exist before inserting
- [ ] Check error messages for specific column issues
- [ ] Test with edge cases (null customer, missing currency, etc.)

## Common Mistakes to Avoid

❌ **DON'T:**
- Hardcode foreign key values (e.g., `"API"` for UserID)
- Assume column names (e.g., `CurrencyRate` when it's `BankSellRate`)
- Skip NOT NULL columns
- Use wrong data types
- Forget to generate DocKey if not IDENTITY

✅ **DO:**
- Query for valid foreign key values
- Verify column names from schema
- Include ALL NOT NULL columns
- Use helper methods for lookups
- Provide safe defaults for required fields

## Quick Reference: Common Required Fields

### DO Table
- DocKey, DocNo, DocDate, DebtorCode, DisplayTerm
- CurrencyCode, CurrencyRate, ToTaxCurrencyRate
- PostToStock, Transferable, Cancelled, DocStatus
- PrintCount, LastModified, LastModifiedUserID
- CreatedTimeStamp, CreatedUserID, CanSync, LastUpdate
- Guid, InclusiveTax, RoundingMethod

### ARInvoice Table
- DocKey, DocNo, DocDate, DebtorCode, JournalType
- DisplayTerm, DueDate
- CurrencyCode, CurrencyRate, ToTaxCurrencyRate
- Cancelled, DocStatus
- LastModified, LastModifiedUserID
- CreatedTimeStamp, CreatedUserID
- InclusiveTax, RoundingMethod
- WithholdingTaxVersion, WithholdingTaxRoundingMethod
