using System.Data;

namespace AutoCountApi.Services;

public interface IAutoCountDbService
{
    Task<DataTable> ExecuteQueryAsync(string query, Dictionary<string, object>? parameters = null);
    Task<int> ExecuteNonQueryAsync(string query, Dictionary<string, object>? parameters = null);
    Task<T?> ExecuteScalarAsync<T>(string query, Dictionary<string, object>? parameters = null);
    Task<bool> TestConnectionAsync();
}

