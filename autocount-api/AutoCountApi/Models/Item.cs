namespace AutoCountApi.Models;

public class Item
{
    public string ItemCode { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Desc2 { get; set; }
    public string? ItemType { get; set; }
    public string? ItemCategory { get; set; }
    public string? ItemBrand { get; set; }
    public string? ItemGroup { get; set; }
    public string? UOM { get; set; }
    public decimal? Cost { get; set; }
    public decimal? Price { get; set; }
    public string? IsActive { get; set; } = "Y";
    public decimal? StockQty { get; set; }
    public string? TaxCode { get; set; }
    public string? Classification { get; set; }
}

public class CreateItemRequest
{
    public string? ItemCode { get; set; }
    public string? Description { get; set; }
    public string? Desc2 { get; set; }
    public string? ItemType { get; set; }
    public string? ItemCategory { get; set; }
    public string? ItemBrand { get; set; }
    public string? ItemGroup { get; set; }
    public string? SalesUOM { get; set; }
    public string? PurchaseUOM { get; set; }
    public string? ReportUOM { get; set; }
    public string? BaseUOM { get; set; }
    public string? TaxCode { get; set; }
    public string? StockControl { get; set; } = "N";
    public string? HasSerialNo { get; set; } = "N";
    public string? HasBatchNo { get; set; } = "N";
    public string? IsActive { get; set; } = "Y";
    public decimal? Cost { get; set; }
    public decimal? Price { get; set; }
}

public class UpdateItemRequest
{
    public string? Description { get; set; }
    public string? Desc2 { get; set; }
    public string? ItemType { get; set; }
    public string? ItemCategory { get; set; }
    public string? ItemBrand { get; set; }
    public string? ItemGroup { get; set; }
    public string? UOM { get; set; }
    public decimal? Cost { get; set; }
    public decimal? Price { get; set; }
    public string? IsActive { get; set; }
}

