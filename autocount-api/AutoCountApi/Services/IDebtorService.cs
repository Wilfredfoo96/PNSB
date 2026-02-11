using AutoCountApi.Models;

namespace AutoCountApi.Services;

public interface IDebtorService
{
    Task<Debtor?> GetDebtorAsync(string accNo);
    Task<List<Debtor>> GetDebtorsAsync(int page = 1, int pageSize = 50, string? search = null);
    Task<int> GetDebtorCountAsync(string? search = null);
    Task<Debtor> CreateDebtorAsync(CreateDebtorRequest request);
    Task<Debtor> UpdateDebtorAsync(string accNo, UpdateDebtorRequest request);
    Task<bool> DeleteDebtorAsync(string accNo); // Soft delete
    Task<bool> DebtorExistsAsync(string accNo);
}

