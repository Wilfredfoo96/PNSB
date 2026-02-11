using AutoCountApi.Models;

namespace AutoCountApi.Services;

public interface IInvoiceService
{
    Task<List<Invoice>> GetInvoicesAsync(int page = 1, int pageSize = 50, string? search = null, string? status = null);
    Task<int> GetInvoiceCountAsync(string? search = null, string? status = null);
    Task<Invoice?> GetInvoiceAsync(long docKey);
    Task<Invoice?> GetInvoiceByDocNoAsync(string docNo);
    Task<Invoice> CreateDraftInvoiceAsync(CreateInvoiceRequest request);
    Task<Invoice> UpdateDraftInvoiceAsync(long docKey, UpdateInvoiceRequest request);
    Task<bool> PostInvoiceAsync(long docKey);
    Task<bool> VoidInvoiceAsync(long docKey);
    Task<bool> IsDraftAsync(long docKey);
}

