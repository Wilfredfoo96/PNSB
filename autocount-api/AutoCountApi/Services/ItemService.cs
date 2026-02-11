using AutoCountApi.Models;
using System.Data;

namespace AutoCountApi.Services;

public class ItemService : IItemService
{
    private readonly IAutoCountDbService _dbService;
    private readonly ILogger<ItemService> _logger;

    public ItemService(IAutoCountDbService dbService, ILogger<ItemService> logger)
    {
        _dbService = dbService;
        _logger = logger;
    }

    public async Task<Item?> GetItemAsync(string itemCode)
    {
        var query = @"
            SELECT 
                i.ItemCode, i.Description, i.Desc2, i.ItemType, i.ItemCategory, 
                i.ItemBrand, i.ItemGroup, i.SalesUOM, i.IsActive, i.TaxCode, i.Classification,
                uom.Cost, uom.Price
            FROM Item i
            LEFT JOIN ItemUOM uom ON i.ItemCode = uom.ItemCode AND i.SalesUOM = uom.UOM
            WHERE i.ItemCode = @ItemCode
        ";

        var parameters = new Dictionary<string, object> { { "ItemCode", itemCode } };
        var result = await _dbService.ExecuteQueryAsync(query, parameters);

        if (result.Rows.Count == 0)
            return null;

        return MapItem(result.Rows[0]);
    }

    public async Task<List<Item>> GetItemsAsync(int page = 1, int pageSize = 50, string? search = null, bool activeOnly = true)
    {
        var offset = (page - 1) * pageSize;
        var parameters = new Dictionary<string, object>
        {
            { "Offset", offset },
            { "PageSize", pageSize }
        };

        var whereClause = "WHERE 1=1";
        
        if (activeOnly)
        {
            whereClause += " AND (i.IsActive = 'Y' OR i.IsActive = 'T')";
        }
        
        if (!string.IsNullOrWhiteSpace(search))
        {
            whereClause += " AND (i.ItemCode LIKE @Search OR i.Description LIKE @Search OR i.Desc2 LIKE @Search)";
            parameters.Add("Search", $"%{search}%");
        }

        var query = $@"
            SELECT 
                i.ItemCode, i.Description, i.Desc2, i.ItemType, i.ItemCategory, 
                i.ItemBrand, i.ItemGroup, i.SalesUOM, i.IsActive, i.TaxCode, i.Classification,
                uom.Cost, uom.Price
            FROM Item i
            LEFT JOIN ItemUOM uom ON i.ItemCode = uom.ItemCode AND i.SalesUOM = uom.UOM
            {whereClause}
            ORDER BY i.ItemCode
            OFFSET @Offset ROWS
            FETCH NEXT @PageSize ROWS ONLY
        ";

        var result = await _dbService.ExecuteQueryAsync(query, parameters);
        return result.Rows.Cast<DataRow>().Select(MapItem).ToList();
    }

    public async Task<int> GetItemCountAsync(string? search = null, bool activeOnly = true)
    {
        var parameters = new Dictionary<string, object>();
        var whereClause = "WHERE 1=1";
        
        if (activeOnly)
        {
            whereClause += " AND (IsActive = 'Y' OR IsActive = 'T')";
        }
        
        if (!string.IsNullOrWhiteSpace(search))
        {
            whereClause += " AND (ItemCode LIKE @Search OR Description LIKE @Search OR Desc2 LIKE @Search)";
            parameters.Add("Search", $"%{search}%");
        }

        var query = $@"
            SELECT COUNT(*)
            FROM Item
            {whereClause}
        ";

        return await _dbService.ExecuteScalarAsync<int>(query, parameters);
    }

    public async Task<Item> CreateItemAsync(CreateItemRequest request)
    {
        // Auto-generate ItemCode if not provided
        var itemCode = request.ItemCode;
        if (string.IsNullOrWhiteSpace(itemCode))
        {
            itemCode = await GenerateNextItemCodeAsync();
        }

        if (await ItemExistsAsync(itemCode))
        {
            throw new InvalidOperationException($"Item with ItemCode '{itemCode}' already exists");
        }

        // Validate required UOM fields
        if (string.IsNullOrWhiteSpace(request.SalesUOM))
        {
            throw new InvalidOperationException("SalesUOM is required");
        }
        var salesUOM = request.SalesUOM;
        var purchaseUOM = request.PurchaseUOM ?? salesUOM; // Default to SalesUOM if not provided
        var reportUOM = request.ReportUOM ?? salesUOM; // Default to SalesUOM if not provided
        var baseUOM = request.BaseUOM ?? salesUOM; // Default to SalesUOM if not provided

        // Get next AutoKey and DocKey
        var getNextAutoKeyQuery = "SELECT ISNULL(MAX(AutoKey), 0) + 1 FROM Item";
        var autoKey = await _dbService.ExecuteScalarAsync<long>(getNextAutoKeyQuery);
        
        var getNextDocKeyQuery = "SELECT ISNULL(MAX(DocKey), 0) + 1 FROM Item";
        var docKey = await _dbService.ExecuteScalarAsync<long>(getNextDocKeyQuery);
        
        var now = DateTime.Now;
        var lastUpdate = (int)(now - new DateTime(1970, 1, 1)).TotalSeconds;
        var guid = Guid.NewGuid();
        
        var query = @"
            INSERT INTO Item (
                AutoKey, ItemCode, DocKey, Description, Desc2, ItemType, ItemCategory, 
                ItemBrand, ItemGroup, SalesUOM, PurchaseUOM, ReportUOM, BaseUOM,
                TaxCode, StockControl, HasSerialNo, HasBatchNo, IsActive,
                DutyRate, CostingMethod, LastModified, LastModifiedUserID, 
                CreatedTimeStamp, CreatedUserID, LastUpdate, HasPromoter, 
                Discontinued, BackOrderControl, MustGenerateEInvoice, Guid
            )
            VALUES (
                @AutoKey, @ItemCode, @DocKey, @Description, @Desc2, @ItemType, @ItemCategory,
                @ItemBrand, @ItemGroup, @SalesUOM, @PurchaseUOM, @ReportUOM, @BaseUOM,
                @TaxCode, @StockControl, @HasSerialNo, @HasBatchNo, @IsActive,
                @DutyRate, @CostingMethod, @LastModified, @LastModifiedUserID,
                @CreatedTimeStamp, @CreatedUserID, @LastUpdate, @HasPromoter,
                @Discontinued, @BackOrderControl, @MustGenerateEInvoice, @Guid
            )
        ";

        var parameters = new Dictionary<string, object>
        {
            { "AutoKey", autoKey },
            { "ItemCode", itemCode },
            { "DocKey", docKey },
            { "Description", (object?)request.Description ?? DBNull.Value },
            { "Desc2", (object?)request.Desc2 ?? DBNull.Value },
            { "ItemType", (object?)request.ItemType ?? DBNull.Value },
            { "ItemCategory", (object?)request.ItemCategory ?? DBNull.Value },
            { "ItemBrand", (object?)request.ItemBrand ?? DBNull.Value },
            { "ItemGroup", (object?)request.ItemGroup ?? DBNull.Value },
            { "SalesUOM", salesUOM },
            { "PurchaseUOM", purchaseUOM },
            { "ReportUOM", reportUOM },
            { "BaseUOM", baseUOM },
            { "TaxCode", (object?)request.TaxCode ?? DBNull.Value },
            { "StockControl", request.StockControl ?? "N" },
            { "HasSerialNo", request.HasSerialNo ?? "N" },
            { "HasBatchNo", request.HasBatchNo ?? "N" },
            { "IsActive", request.IsActive ?? "Y" },
            { "DutyRate", 0.0m }, // Default to 0
            { "CostingMethod", 0 }, // Default to 0
            { "LastModified", now },
            { "LastModifiedUserID", "SYSTEM" },
            { "CreatedTimeStamp", now },
            { "CreatedUserID", "SYSTEM" },
            { "LastUpdate", lastUpdate },
            { "HasPromoter", "N" }, // Default to N
            { "Discontinued", "N" }, // Default to N
            { "BackOrderControl", "N" }, // Default to N
            { "MustGenerateEInvoice", false }, // Default to false
            { "Guid", guid }
        };

        await _dbService.ExecuteNonQueryAsync(query, parameters);
        _logger.LogInformation("Created item: {ItemCode}", itemCode);

        return (await GetItemAsync(itemCode))!;
    }

    public async Task<Item> UpdateItemAsync(string itemCode, UpdateItemRequest request)
    {
        if (!await ItemExistsAsync(itemCode))
        {
            throw new InvalidOperationException($"Item with ItemCode '{itemCode}' not found");
        }

        var setClauses = new List<string>();
        var parameters = new Dictionary<string, object> { { "ItemCode", itemCode } };

        if (request.Description != null) { setClauses.Add("Description = @Description"); parameters.Add("Description", request.Description); }
        if (request.Desc2 != null) { setClauses.Add("Desc2 = @Desc2"); parameters.Add("Desc2", request.Desc2); }
        if (request.ItemType != null) { setClauses.Add("ItemType = @ItemType"); parameters.Add("ItemType", request.ItemType); }
        if (request.ItemCategory != null) { setClauses.Add("ItemCategory = @ItemCategory"); parameters.Add("ItemCategory", request.ItemCategory); }
        if (request.ItemBrand != null) { setClauses.Add("ItemBrand = @ItemBrand"); parameters.Add("ItemBrand", request.ItemBrand); }
        if (request.ItemGroup != null) { setClauses.Add("ItemGroup = @ItemGroup"); parameters.Add("ItemGroup", request.ItemGroup); }
        if (request.UOM != null) { setClauses.Add("SalesUOM = @SalesUOM"); parameters.Add("SalesUOM", request.UOM); }
        if (request.IsActive != null) { setClauses.Add("IsActive = @IsActive"); parameters.Add("IsActive", request.IsActive); }

        if (setClauses.Count == 0)
        {
            throw new InvalidOperationException("No fields to update");
        }

        var query = $@"
            UPDATE Item
            SET {string.Join(", ", setClauses)}
            WHERE ItemCode = @ItemCode
        ";

        await _dbService.ExecuteNonQueryAsync(query, parameters);
        _logger.LogInformation("Updated item: {ItemCode}", itemCode);

        return (await GetItemAsync(itemCode))!;
    }

    public async Task<bool> DeleteItemAsync(string itemCode)
    {
        var query = @"
            UPDATE Item
            SET IsActive = 'N'
            WHERE ItemCode = @ItemCode
        ";

        var parameters = new Dictionary<string, object> { { "ItemCode", itemCode } };
        var rowsAffected = await _dbService.ExecuteNonQueryAsync(query, parameters);
        
        if (rowsAffected > 0)
        {
            _logger.LogInformation("Soft deleted item: {ItemCode}", itemCode);
        }

        return rowsAffected > 0;
    }

    public async Task<bool> ItemExistsAsync(string itemCode)
    {
        var query = "SELECT COUNT(*) FROM Item WHERE ItemCode = @ItemCode";
        var parameters = new Dictionary<string, object> { { "ItemCode", itemCode } };
        var count = await _dbService.ExecuteScalarAsync<int>(query, parameters);
        return count > 0;
    }

    private async Task<string> GenerateNextItemCodeAsync()
    {
        // Find the highest numeric ItemCode (5 digits)
        var query = @"
            SELECT TOP 1 ItemCode
            FROM Item
            WHERE ItemCode LIKE '[0-9][0-9][0-9][0-9][0-9]'
               AND LEN(ItemCode) = 5
            ORDER BY CAST(ItemCode AS INT) DESC
        ";

        var result = await _dbService.ExecuteQueryAsync(query);
        
        int nextNumber = 1;
        if (result.Rows.Count > 0)
        {
            var lastItemCode = result.Rows[0]["ItemCode"].ToString();
            if (!string.IsNullOrEmpty(lastItemCode) && int.TryParse(lastItemCode, out int lastNumber))
            {
                nextNumber = lastNumber + 1;
            }
        }

        // Format as 5-digit number with leading zeros (e.g., "00001", "00002")
        return nextNumber.ToString("D5");
    }

    private static Item MapItem(DataRow row)
    {
        return new Item
        {
            ItemCode = row["ItemCode"].ToString() ?? string.Empty,
            Description = row["Description"]?.ToString(),
            Desc2 = row["Desc2"]?.ToString(),
            ItemType = row["ItemType"]?.ToString(),
            ItemCategory = row["ItemCategory"]?.ToString(),
            ItemBrand = row["ItemBrand"]?.ToString(),
            ItemGroup = row["ItemGroup"]?.ToString(),
            UOM = row["SalesUOM"]?.ToString(),
            Cost = row["Cost"] != DBNull.Value ? Convert.ToDecimal(row["Cost"]) : null,
            Price = row["Price"] != DBNull.Value ? Convert.ToDecimal(row["Price"]) : null,
            IsActive = row["IsActive"]?.ToString(),
            TaxCode = row["TaxCode"]?.ToString(),
            Classification = row["Classification"]?.ToString()
        };
    }
}

