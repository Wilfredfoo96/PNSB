# Plan: Populate Delivery Order Fields (Row 4 Data Population)

## Problem Analysis

### Current Situation
- **Rows 2-3 (Correct Samples)**: These are existing delivery orders in the database that have all fields populated correctly
- **Row 4 (Our Input)**: This is the delivery order we just created, but it's missing data in many columns

### Root Cause
We are **INSERTING** many fields into the database (see `CreateDraftDeliveryOrderAsync`), but we are **NOT RETRIEVING** them when querying. The SELECT queries only fetch basic fields.

### Fields We INSERT (but don't retrieve):
1. **Address Fields**: InvAddr1, InvAddr2, InvAddr3, InvAddr4
2. **Description**: "DELIVERY ORDER"
3. **Reference**: Ref
4. **Financial Fields**:
   - TotalExTax
   - NetTotal, LocalNetTotal, AnalysisNetTotal, LocalAnalysisNetTotal
   - Tax, LocalTax, TaxCurrencyTax
   - ExTax, LocalExTax
   - TaxableAmt, LocalTaxableAmt
5. **Footer Fields**: Footer1Amt, Footer2Amt, Footer3Amt (all set to 0)
6. **Settings Fields**:
   - SalesLocation ('HQ')
   - CalcDiscountOnUnitPrice ('F')
   - MultiPrice ('P1')
   - TaxEntityID
   - DisplayTerm
   - CurrencyCode, CurrencyRate, ToTaxCurrencyRate
7. **Status Fields**: PostToStock, Transferable

### Current SELECT Query (Missing Fields)
```sql
SELECT 
    DO.DocKey, DO.DocNo, DO.DocDate, 
    DO.DebtorCode, 
    ISNULL(Debtor.CompanyName, '') as DebtorName,
    DO.Total, DO.Cancelled, 
    DO.DocStatus, DO.LastModified, DO.CreatedTimeStamp
FROM DO
LEFT JOIN Debtor ON DO.DebtorCode = Debtor.AccNo
```

### Current DeliveryOrder Model (Missing Properties)
Only has: DocKey, DocNo, DocDate, DebtorCode, DebtorName, Status, Total, Lines, CreatedAt, PostedAt

---

## Implementation Plan

### Phase 1: Update Backend Model ✅
**File**: `autocount-api/AutoCountApi/Models/DeliveryOrder.cs`

Add properties to `DeliveryOrder` class:
```csharp
// Address fields
public string? InvAddr1 { get; set; }
public string? InvAddr2 { get; set; }
public string? InvAddr3 { get; set; }
public string? InvAddr4 { get; set; }

// Document fields
public string? Ref { get; set; }
public string? Description { get; set; }
public string? DisplayTerm { get; set; }

// Currency fields
public string? CurrencyCode { get; set; }
public decimal? CurrencyRate { get; set; }
public decimal? ToTaxCurrencyRate { get; set; }

// Financial fields
public decimal? TotalExTax { get; set; }
public decimal? NetTotal { get; set; }
public decimal? LocalNetTotal { get; set; }
public decimal? AnalysisNetTotal { get; set; }
public decimal? LocalAnalysisNetTotal { get; set; }
public decimal? Tax { get; set; }
public decimal? LocalTax { get; set; }
public decimal? TaxCurrencyTax { get; set; }
public decimal? ExTax { get; set; }
public decimal? LocalExTax { get; set; }
public decimal? TaxableAmt { get; set; }
public decimal? LocalTaxableAmt { get; set; }

// Footer fields
public decimal? Footer1Amt { get; set; }
public decimal? Footer2Amt { get; set; }
public decimal? Footer3Amt { get; set; }

// Settings fields
public string? SalesLocation { get; set; }
public string? CalcDiscountOnUnitPrice { get; set; }
public string? MultiPrice { get; set; }
public int? TaxEntityID { get; set; }
public string? PostToStock { get; set; }
public string? Transferable { get; set; }
```

---

### Phase 2: Update SELECT Queries ✅
**File**: `autocount-api/AutoCountApi/Services/DeliveryOrderService.cs`

#### 2.1 Update `GetDeliveryOrdersAsync` method (line ~52)
Add all fields to SELECT:
```sql
SELECT 
    DO.DocKey, DO.DocNo, DO.DocDate, 
    DO.DebtorCode, 
    ISNULL(Debtor.CompanyName, '') as DebtorName,
    DO.Ref, DO.Description,
    DO.InvAddr1, DO.InvAddr2, DO.InvAddr3, DO.InvAddr4,
    DO.DisplayTerm, DO.CurrencyCode, DO.CurrencyRate, DO.ToTaxCurrencyRate,
    DO.Total, DO.TotalExTax, DO.NetTotal, DO.LocalNetTotal, 
    DO.AnalysisNetTotal, DO.LocalAnalysisNetTotal,
    DO.Tax, DO.LocalTax, DO.TaxCurrencyTax, DO.ExTax, DO.LocalExTax,
    DO.TaxableAmt, DO.LocalTaxableAmt,
    DO.Footer1Amt, DO.Footer2Amt, DO.Footer3Amt,
    DO.SalesLocation, DO.CalcDiscountOnUnitPrice, DO.MultiPrice, DO.TaxEntityID,
    DO.PostToStock, DO.Transferable,
    DO.Cancelled, DO.DocStatus, DO.LastModified, DO.CreatedTimeStamp
FROM DO
LEFT JOIN Debtor ON DO.DebtorCode = Debtor.AccNo
```

#### 2.2 Update `GetDeliveryOrderAsync` method (line ~106)
Add same fields to SELECT query.

---

### Phase 3: Update Mapping Function ✅
**File**: `autocount-api/AutoCountApi/Services/DeliveryOrderService.cs`

#### 3.1 Update `MapDeliveryOrder` method (line ~606)
Map all new fields from DataRow to DeliveryOrder model:
```csharp
return new DeliveryOrder
{
    // Existing fields
    DocKey = Convert.ToInt64(row["DocKey"]),
    DocNo = row["DocNo"].ToString() ?? "",
    DocDate = Convert.ToDateTime(row["DocDate"]),
    DebtorCode = row["DebtorCode"].ToString() ?? "",
    DebtorName = row["DebtorName"]?.ToString(),
    Status = status,
    Total = row["Total"] != DBNull.Value ? Convert.ToDecimal(row["Total"]) : null,
    CreatedAt = row["CreatedTimeStamp"] != DBNull.Value ? Convert.ToDateTime(row["CreatedTimeStamp"]) : DateTime.MinValue,
    PostedAt = status == "Posted" && row["LastModified"] != DBNull.Value ? Convert.ToDateTime(row["LastModified"]) : null,
    
    // NEW: Address fields
    InvAddr1 = row["InvAddr1"]?.ToString(),
    InvAddr2 = row["InvAddr2"]?.ToString(),
    InvAddr3 = row["InvAddr3"]?.ToString(),
    InvAddr4 = row["InvAddr4"]?.ToString(),
    
    // NEW: Document fields
    Ref = row["Ref"]?.ToString(),
    Description = row["Description"]?.ToString(),
    DisplayTerm = row["DisplayTerm"]?.ToString(),
    
    // NEW: Currency fields
    CurrencyCode = row["CurrencyCode"]?.ToString(),
    CurrencyRate = row["CurrencyRate"] != DBNull.Value ? Convert.ToDecimal(row["CurrencyRate"]) : null,
    ToTaxCurrencyRate = row["ToTaxCurrencyRate"] != DBNull.Value ? Convert.ToDecimal(row["ToTaxCurrencyRate"]) : null,
    
    // NEW: Financial fields
    TotalExTax = row["TotalExTax"] != DBNull.Value ? Convert.ToDecimal(row["TotalExTax"]) : null,
    NetTotal = row["NetTotal"] != DBNull.Value ? Convert.ToDecimal(row["NetTotal"]) : null,
    LocalNetTotal = row["LocalNetTotal"] != DBNull.Value ? Convert.ToDecimal(row["LocalNetTotal"]) : null,
    AnalysisNetTotal = row["AnalysisNetTotal"] != DBNull.Value ? Convert.ToDecimal(row["AnalysisNetTotal"]) : null,
    LocalAnalysisNetTotal = row["LocalAnalysisNetTotal"] != DBNull.Value ? Convert.ToDecimal(row["LocalAnalysisNetTotal"]) : null,
    Tax = row["Tax"] != DBNull.Value ? Convert.ToDecimal(row["Tax"]) : null,
    LocalTax = row["LocalTax"] != DBNull.Value ? Convert.ToDecimal(row["LocalTax"]) : null,
    TaxCurrencyTax = row["TaxCurrencyTax"] != DBNull.Value ? Convert.ToDecimal(row["TaxCurrencyTax"]) : null,
    ExTax = row["ExTax"] != DBNull.Value ? Convert.ToDecimal(row["ExTax"]) : null,
    LocalExTax = row["LocalExTax"] != DBNull.Value ? Convert.ToDecimal(row["LocalExTax"]) : null,
    TaxableAmt = row["TaxableAmt"] != DBNull.Value ? Convert.ToDecimal(row["TaxableAmt"]) : null,
    LocalTaxableAmt = row["LocalTaxableAmt"] != DBNull.Value ? Convert.ToDecimal(row["LocalTaxableAmt"]) : null,
    
    // NEW: Footer fields
    Footer1Amt = row["Footer1Amt"] != DBNull.Value ? Convert.ToDecimal(row["Footer1Amt"]) : null,
    Footer2Amt = row["Footer2Amt"] != DBNull.Value ? Convert.ToDecimal(row["Footer2Amt"]) : null,
    Footer3Amt = row["Footer3Amt"] != DBNull.Value ? Convert.ToDecimal(row["Footer3Amt"]) : null,
    
    // NEW: Settings fields
    SalesLocation = row["SalesLocation"]?.ToString(),
    CalcDiscountOnUnitPrice = row["CalcDiscountOnUnitPrice"]?.ToString(),
    MultiPrice = row["MultiPrice"]?.ToString(),
    TaxEntityID = row["TaxEntityID"] != DBNull.Value ? Convert.ToInt32(row["TaxEntityID"]) : null,
    PostToStock = row["PostToStock"]?.ToString(),
    Transferable = row["Transferable"]?.ToString(),
};
```

---

### Phase 4: Verify Data Flow ✅
1. **Backend → API Route**: Ensure API route passes all fields through
2. **API Route → Frontend**: Ensure frontend receives all fields
3. **Frontend Display**: Update UI if needed to show these fields (optional, depending on Excel requirements)

---

## Summary

### What Rows 2-3 Have (Correct Samples)
- All fields populated from database because they were created with full data or imported

### What Row 4 Needs (Our Input)
- All the same fields that we're inserting but not retrieving
- Once we update SELECT queries and mapping, row 4 will have all fields populated

### Files to Modify
1. ✅ `autocount-api/AutoCountApi/Models/DeliveryOrder.cs` - Add properties
2. ✅ `autocount-api/AutoCountApi/Services/DeliveryOrderService.cs` - Update SELECT queries and MapDeliveryOrder
3. ⚠️ Frontend (if needed) - Update display if Excel requires specific field visibility

---

## Testing Checklist
- [ ] Query existing DO (row 2-3) - verify all fields are retrieved
- [ ] Query new DO (row 4) - verify all fields are retrieved
- [ ] Compare row 2-3 vs row 4 - all fields should match structure
- [ ] Verify Excel export/display shows all fields correctly
