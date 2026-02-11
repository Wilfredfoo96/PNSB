# Quick Start: Prevent Database Errors

## 🚀 Quick Tools

### 1. Check Required Columns for Any Table
```powershell
cd autocount-api
.\check-insert-requirements.ps1 -TableName "DO"
.\check-insert-requirements.ps1 -TableName "ARInvoice"
```

This shows you all NOT NULL (required) columns that MUST be in your INSERT statement.

### 2. Verify Your INSERT Statement
```powershell
cd autocount-api
.\verify-insert-completeness.ps1 -TableName "DO"
```

This lists all required columns so you can manually verify your INSERT includes them.

### 3. Query Database Schema (SQL)
Use `get-autocount-schema.sql` in SQL Server Management Studio to:
- Get all NOT NULL columns
- Get foreign key constraints
- Verify column names and types

## 📋 Workflow Before Writing INSERT

1. **Run the PowerShell script:**
   ```powershell
   .\check-insert-requirements.ps1 -TableName "YourTable"
   ```

2. **Check the output** - Lists all required columns

3. **Write your INSERT** including ALL required columns

4. **Verify foreign keys:**
   - CreatedUserID → Query Users table
   - CurrencyCode → Query Currency table (use BankSellRate, not CurrencyRate)
   - DisplayTerm → Query Debtor table

5. **Test incrementally:**
   - Test with minimal data first
   - Check error messages for specific issues

## ✅ Current Status

### DO Table - ✅ All Required Columns Included
Your current INSERT statement includes all 22 required columns:
- DocKey, DocNo, DocDate, DebtorCode, DisplayTerm
- CurrencyCode, CurrencyRate, ToTaxCurrencyRate
- PostToStock, Transferable, Cancelled, DocStatus
- PrintCount, LastModified, LastModifiedUserID
- CreatedTimeStamp, CreatedUserID, CanSync, LastUpdate
- Guid, InclusiveTax, RoundingMethod

### ARInvoice Table - ✅ All Required Columns Included
Your current INSERT statement includes all required columns.

## 🔧 Common Fixes Applied

1. ✅ **DocKey** - Now generated manually (not IDENTITY)
2. ✅ **DisplayTerm** - Retrieved from Debtor table
3. ✅ **CurrencyCode/CurrencyRate** - Retrieved from Currency table (BankSellRate)
4. ✅ **CreatedUserID** - Retrieved from Users table (not hardcoded)
5. ✅ **All NOT NULL fields** - Included with proper defaults

## 📚 Documentation

- **`PREVENT_DATABASE_ERRORS.md`** - Complete guide
- **`INSERT_CHECKLIST.md`** - Quick checklist
- **`get-autocount-schema.sql`** - SQL queries for validation

## 🎯 Remember

- Always check schema BEFORE coding
- Never hardcode foreign key values
- Always include ALL NOT NULL columns
- Verify column names match exactly
- Use helper methods for lookups
