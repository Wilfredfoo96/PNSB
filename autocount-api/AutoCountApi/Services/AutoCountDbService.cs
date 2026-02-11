using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace AutoCountApi.Services;

public class AutoCountDbService : IAutoCountDbService
{
    private readonly string _connectionString;
    private readonly ILogger<AutoCountDbService> _logger;

    public AutoCountDbService(IConfiguration configuration, ILogger<AutoCountDbService> logger)
    {
        _connectionString = configuration.GetConnectionString("AutoCountDb") 
            ?? throw new InvalidOperationException("AutoCountDb connection string is not configured");
        _logger = logger;
    }

    public async Task<DataTable> ExecuteQueryAsync(string query, Dictionary<string, object>? parameters = null)
    {
        using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        using var command = new SqlCommand(query, connection);
        
        if (parameters != null)
        {
            foreach (var param in parameters)
            {
                command.Parameters.AddWithValue(param.Key, param.Value ?? DBNull.Value);
            }
        }

        using var adapter = new SqlDataAdapter(command);
        var dataTable = new DataTable();
        adapter.Fill(dataTable);

        return dataTable;
    }

    public async Task<int> ExecuteNonQueryAsync(string query, Dictionary<string, object>? parameters = null)
    {
        using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        using var command = new SqlCommand(query, connection);
        
        if (parameters != null)
        {
            foreach (var param in parameters)
            {
                command.Parameters.AddWithValue(param.Key, param.Value ?? DBNull.Value);
            }
        }

        return await command.ExecuteNonQueryAsync();
    }

    public async Task<T?> ExecuteScalarAsync<T>(string query, Dictionary<string, object>? parameters = null)
    {
        using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();

        using var command = new SqlCommand(query, connection);
        
        if (parameters != null)
        {
            foreach (var param in parameters)
            {
                command.Parameters.AddWithValue(param.Key, param.Value ?? DBNull.Value);
            }
        }

        var result = await command.ExecuteScalarAsync();
        
        if (result == null || result == DBNull.Value)
            return default(T);

        // Handle nullable types - get the underlying type if T is nullable
        var targetType = typeof(T);
        var underlyingType = Nullable.GetUnderlyingType(targetType);
        
        if (underlyingType != null)
        {
            // T is nullable, convert to underlying type first
            var convertedValue = Convert.ChangeType(result, underlyingType);
            return (T)convertedValue;
        }
        else
        {
            // T is not nullable, convert directly
            return (T)Convert.ChangeType(result, targetType);
        }
    }

    public async Task<bool> TestConnectionAsync()
    {
        try
        {
            using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync();
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to connect to AutoCount database");
            return false;
        }
    }
}

