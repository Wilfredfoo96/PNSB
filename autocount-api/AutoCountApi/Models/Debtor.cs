namespace AutoCountApi.Models;

public class Debtor
{
    public string AccNo { get; set; } = string.Empty;
    public string? Name { get; set; }
    public string? Address1 { get; set; }
    public string? Address2 { get; set; }
    public string? Address3 { get; set; }
    public string? Address4 { get; set; }
    public string? Contact { get; set; }
    public string? Phone1 { get; set; }
    public string? Email { get; set; }
    public string? DebtorType { get; set; }
    public string? Terms { get; set; }
    public string? SalesAgent { get; set; }
    public string? IsActive { get; set; } = "Y";
    public decimal? CreditLimit { get; set; }
    public string? TaxCode { get; set; }
    public string? TaxRegNo { get; set; }
    public string? RegisterNo { get; set; }
    public DateTime? LastModified { get; set; }
    public string? CurrencyCode { get; set; }
}

public class CreateDebtorRequest
{
    public string? AccNo { get; set; }
    public string? Name { get; set; }
    public string? Address1 { get; set; }
    public string? Address2 { get; set; }
    public string? Address3 { get; set; }
    public string? Address4 { get; set; }
    public string? Contact { get; set; }
    public string? Phone1 { get; set; }
    public string? Email { get; set; }
    public string? DebtorType { get; set; }
    public string? Terms { get; set; }
    public string? SalesAgent { get; set; }
    public decimal? CreditLimit { get; set; }
    public string? TaxCode { get; set; }
    public string? TaxRegNo { get; set; }
}

public class UpdateDebtorRequest
{
    public string? Name { get; set; }
    public string? Address1 { get; set; }
    public string? Address2 { get; set; }
    public string? Address3 { get; set; }
    public string? Address4 { get; set; }
    public string? Contact { get; set; }
    public string? Phone1 { get; set; }
    public string? Email { get; set; }
    public string? DebtorType { get; set; }
    public string? Terms { get; set; }
    public string? SalesAgent { get; set; }
    public decimal? CreditLimit { get; set; }
    public string? TaxCode { get; set; }
    public string? TaxRegNo { get; set; }
    public string? IsActive { get; set; }
}

