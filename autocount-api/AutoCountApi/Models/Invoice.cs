namespace AutoCountApi.Models;

public class Invoice
{
    public long DocKey { get; set; }
    public string DocNo { get; set; } = string.Empty;
    public DateTime DocDate { get; set; }
    public string DebtorCode { get; set; } = string.Empty;
    public string? DebtorName { get; set; }
    public string Status { get; set; } = "Draft"; // Draft, Posted, Void
    public decimal? Total { get; set; }
    public decimal? Tax { get; set; }
    public List<InvoiceLine> Lines { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime? PostedAt { get; set; }
}

public class InvoiceLine
{
    public long DtlKey { get; set; }
    public string ItemCode { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal? Discount { get; set; }
    public decimal? TaxAmount { get; set; }
    public decimal? LineTotal { get; set; }
}

public class CreateInvoiceRequest
{
    public string? IdempotencyKey { get; set; }
    public string DebtorCode { get; set; } = string.Empty;
    public DateTime DocDate { get; set; }
    public string? Ref { get; set; }
    public string? Description { get; set; }
    public List<CreateInvoiceLineRequest> Lines { get; set; } = new();
    public string? Remarks { get; set; }
}

public class CreateInvoiceLineRequest
{
    public string ItemCode { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal? Discount { get; set; }
    public string? TaxCode { get; set; }
    public string? Description { get; set; }
}

public class UpdateInvoiceRequest
{
    public DateTime? DocDate { get; set; }
    public string? Ref { get; set; }
    public string? Description { get; set; }
    public List<CreateInvoiceLineRequest>? Lines { get; set; }
    public string? Remarks { get; set; }
}

