# Foreign Key Validation Implementation

## ✅ Issue Fixed

**Error**: `The INSERT statement conflicted with the FOREIGN KEY constraint "FK_DODTL_TaxCode". The conflict occurred in database "AED_TEST", table "dbo.TaxCode", column 'TaxCode'.`

## 🎯 Solution Implemented

### 1. TaxCode Validation Helper Method

Added `ValidateTaxCodeAsync()` method to check if TaxCode exists in TaxCode table before inserting into DODTL.

**Location**: `DeliveryOrderService.cs` (after `GetValidUserIDAsync` method)

**Implementation**:
```csharp
/// <summary>
/// Validates that a TaxCode exists in the TaxCode table. Returns the TaxCode if valid, otherwise returns null.
/// This prevents foreign key constraint violations.
/// </summary>
private async Task<string?> ValidateTaxCodeAsync(string? taxCode)
{
    // If TaxCode is null or empty, return null (no FK constraint violation)
    if (string.IsNullOrWhiteSpace(taxCode))
        return null;

    // Check if TaxCode exists in TaxCode table
    var query = "SELECT COUNT(*) FROM TaxCode WHERE TaxCode = @TaxCode";
    var parameters = new Dictionary<string, object> { { "TaxCode", taxCode } };
    var count = await _dbService.ExecuteScalarAsync<int>(query, parameters);

    // If TaxCode exists, return it; otherwise return null to avoid FK constraint violation
    if (count > 0)
        return taxCode;

    _logger.LogWarning("TaxCode '{TaxCode}' does not exist in TaxCode table, setting to NULL to avoid FK constraint violation", taxCode);
    return null;
}
```

### 2. Applied to Both Create and Update Methods

**Create Method** (`CreateDraftDeliveryOrderAsync`):
- Fetches `TaxCode` from Item table
- Validates it using `ValidateTaxCodeAsync()`
- Sets to NULL if invalid (prevents FK constraint violation)

**Update Method** (`UpdateDeliveryOrderAsync`):
- Same validation logic applied

## 📋 Other Foreign Key Fields in DODTL

The following fields in DODTL might have foreign key constraints but are currently not being set (NULL):

| Field | Type | Current Status | FK Constraint? |
|-------|------|----------------|----------------|
| **ItemCode** | nvarchar(30) | ✅ Validated | Already validated (item must exist) |
| **TaxCode** | nvarchar(14) | ✅ **FIXED** | ✅ Validated before insert |
| **AccNo** | nvarchar(12) | NULL (not set) | Might have FK to Account table |
| **Location** | nvarchar(8) | NULL (not set) | Might have FK to Location table |
| **ProjNo** | nvarchar(10) | NULL (not set) | Might have FK to Project table |
| **DeptNo** | nvarchar(10) | NULL (not set) | Might have FK to Department table |

### Recommendation for Future Enhancements

If you plan to set any of these fields in the future, add similar validation methods:

```csharp
// Example for Location validation
private async Task<string?> ValidateLocationAsync(string? location)
{
    if (string.IsNullOrWhiteSpace(location))
        return null;
    
    var query = "SELECT COUNT(*) FROM Location WHERE LocationCode = @Location";
    var count = await _dbService.ExecuteScalarAsync<int>(query, 
        new Dictionary<string, object> { { "Location", location } });
    
    return count > 0 ? location : null;
}
```

## ✅ Verification

- [x] TaxCode validation helper method created
- [x] Applied to Create method
- [x] Applied to Update method
- [x] Returns NULL if TaxCode doesn't exist (prevents FK violation)
- [x] Logs warning when invalid TaxCode is encountered
- [x] ItemCode already validated (item must exist before insert)
- [x] No linter errors

## 🚀 Testing

After deployment, test with:
1. Item with valid TaxCode → Should insert successfully
2. Item with invalid TaxCode → Should set TaxCode to NULL and insert successfully
3. Item with NULL TaxCode → Should insert successfully with NULL TaxCode

## 📝 Files Modified

- `autocount-api/AutoCountApi/Services/DeliveryOrderService.cs`
  - Added `ValidateTaxCodeAsync()` helper method
  - Updated `CreateDraftDeliveryOrderAsync()` to validate TaxCode
  - Updated `UpdateDeliveryOrderAsync()` to validate TaxCode
