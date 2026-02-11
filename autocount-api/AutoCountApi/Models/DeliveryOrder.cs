namespace AutoCountApi.Models;

public class DeliveryOrder
{
    public long DocKey { get; set; }
    public string DocNo { get; set; } = string.Empty;
    public DateTime DocDate { get; set; }
    public string DebtorCode { get; set; } = string.Empty;
    public string? DebtorName { get; set; }
    public string Status { get; set; } = "Draft"; // Draft, Posted, Void
    public decimal? Total { get; set; }
    public List<DeliveryOrderLine> Lines { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime? PostedAt { get; set; }
    
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

    // Extra fields for Linked Schema / full schema display
    public string? SalesAgent { get; set; }
    public string? BranchCode { get; set; }
    public string? Cancelled { get; set; }
    public string? DocStatus { get; set; }
    public string? Note { get; set; }
    public string? Remark1 { get; set; }
    public string? Remark2 { get; set; }
    public string? Remark3 { get; set; }
    public string? Remark4 { get; set; }
    public Guid? Guid { get; set; }
    public string? YourPONo { get; set; }
    public DateTime? YourPODate { get; set; }
    public string? ShipVia { get; set; }
    public string? ShipInfo { get; set; }
    public string? Phone1 { get; set; }
    public string? Fax1 { get; set; }
    public string? Attention { get; set; }
    public string? DeliverAddr1 { get; set; }
    public string? DeliverAddr2 { get; set; }
    public string? DeliverAddr3 { get; set; }
    public string? DeliverAddr4 { get; set; }
    public string? InclusiveTax { get; set; }
    public int? RoundingMethod { get; set; }
    public int? LastUpdate { get; set; }
    public decimal? Footer1Param { get; set; }
    public string? Footer1TaxCode { get; set; }
    public decimal? Footer2Param { get; set; }
    public string? Footer2TaxCode { get; set; }
    public decimal? Footer3Param { get; set; }
    public string? Footer3TaxCode { get; set; }
    public decimal? Footer1Tax { get; set; }
    public decimal? Footer2Tax { get; set; }
    public decimal? Footer3Tax { get; set; }
    public string? ExternalLink { get; set; }
    public string? RefDocNo { get; set; }
    public int? PrintCount { get; set; }
    public string? CreatedUserID { get; set; }
    public string? LastModifiedUserID { get; set; }
    public DateTime? LastModified { get; set; }
}

public class DeliveryOrderLine
{
    public long DtlKey { get; set; }
    public string ItemCode { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal? Discount { get; set; }
    public decimal? LineTotal { get; set; }
}

public class CreateDeliveryOrderRequest
{
    public string? IdempotencyKey { get; set; }
    public string DebtorCode { get; set; } = string.Empty;
    public DateTime DocDate { get; set; }
    public string? Ref { get; set; }
    public string? Description { get; set; }
    public List<CreateDeliveryOrderLineRequest> Lines { get; set; } = new();
    public string? Remarks { get; set; }
    public string? TaxEntityName { get; set; } // TaxEntity name to fetch TaxEntityID
    public string? BranchPrefix { get; set; } // Branch prefix for DO numbering (e.g., "SOTP1")
    public string? SalesAgent { get; set; } // Sales agent name/code (max 12 chars for FK to SalesAgent table)
}

public class CreateDeliveryOrderLineRequest
{
    public string ItemCode { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal? Discount { get; set; }
    public string? Description { get; set; }
    public string? TaxCode { get; set; } // TaxCode per line item
}

public class UpdateDeliveryOrderRequest
{
    public DateTime? DocDate { get; set; }
    public string? Ref { get; set; }
    public string? Description { get; set; }
    public List<CreateDeliveryOrderLineRequest>? Lines { get; set; }
    public string? Remarks { get; set; }
}

