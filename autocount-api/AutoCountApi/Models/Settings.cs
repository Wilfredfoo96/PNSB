namespace AutoCountApi.Models;

public class TaxCodeDto
{
    public string TaxCode { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal TaxRate { get; set; }
    public string IsActive { get; set; } = "Y";
}

public class CreateTaxCodeRequest
{
    public string TaxCode { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal TaxRate { get; set; }
}

public class ClassificationDto
{
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class CreateClassificationRequest
{
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
}
