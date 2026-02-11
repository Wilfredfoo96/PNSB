using System.Data;

namespace AutoCountApi.Services;

public interface IIdempotencyService
{
    Task<bool> IsProcessedAsync(string idempotencyKey);
    Task MarkAsProcessedAsync(string idempotencyKey, string operationType, long? docKey = null, string? docNo = null);
    Task<IdempotencyResult?> GetResultAsync(string idempotencyKey);
}

public class IdempotencyResult
{
    public string IdempotencyKey { get; set; } = string.Empty;
    public string OperationType { get; set; } = string.Empty;
    public long? DocKey { get; set; }
    public string? DocNo { get; set; }
    public DateTime ProcessedAt { get; set; }
}

public class IdempotencyService : IIdempotencyService
{
    private readonly IAutoCountDbService _dbService;
    private readonly ILogger<IdempotencyService> _logger;

    public IdempotencyService(IAutoCountDbService dbService, ILogger<IdempotencyService> logger)
    {
        _dbService = dbService;
        _logger = logger;
    }

    public async Task<bool> IsProcessedAsync(string idempotencyKey)
    {
        // Create table if it doesn't exist
        await EnsureTableExistsAsync();

        var query = @"
            SELECT COUNT(*) 
            FROM IdempotencyKeys 
            WHERE IdempotencyKey = @IdempotencyKey
        ";

        var parameters = new Dictionary<string, object> { { "IdempotencyKey", idempotencyKey } };
        var count = await _dbService.ExecuteScalarAsync<int>(query, parameters);
        return count > 0;
    }

    public async Task MarkAsProcessedAsync(string idempotencyKey, string operationType, long? docKey = null, string? docNo = null)
    {
        await EnsureTableExistsAsync();

        var query = @"
            IF NOT EXISTS (SELECT 1 FROM IdempotencyKeys WHERE IdempotencyKey = @IdempotencyKey)
            BEGIN
                INSERT INTO IdempotencyKeys (IdempotencyKey, OperationType, DocKey, DocNo, ProcessedAt)
                VALUES (@IdempotencyKey, @OperationType, @DocKey, @DocNo, @ProcessedAt)
            END
        ";

        var parameters = new Dictionary<string, object>
        {
            { "IdempotencyKey", idempotencyKey },
            { "OperationType", operationType },
            { "DocKey", (object?)docKey ?? DBNull.Value },
            { "DocNo", (object?)docNo ?? DBNull.Value },
            { "ProcessedAt", DateTime.UtcNow }
        };

        await _dbService.ExecuteNonQueryAsync(query, parameters);
        _logger.LogInformation("Marked idempotency key as processed: {IdempotencyKey}, Operation: {OperationType}", idempotencyKey, operationType);
    }

    public async Task<IdempotencyResult?> GetResultAsync(string idempotencyKey)
    {
        await EnsureTableExistsAsync();

        var query = @"
            SELECT IdempotencyKey, OperationType, DocKey, DocNo, ProcessedAt
            FROM IdempotencyKeys
            WHERE IdempotencyKey = @IdempotencyKey
        ";

        var parameters = new Dictionary<string, object> { { "IdempotencyKey", idempotencyKey } };
        var result = await _dbService.ExecuteQueryAsync(query, parameters);

        if (result.Rows.Count == 0)
            return null;

        var row = result.Rows[0];
        return new IdempotencyResult
        {
            IdempotencyKey = row["IdempotencyKey"].ToString() ?? "",
            OperationType = row["OperationType"].ToString() ?? "",
            DocKey = row["DocKey"] != DBNull.Value ? Convert.ToInt64(row["DocKey"]) : null,
            DocNo = row["DocNo"]?.ToString(),
            ProcessedAt = Convert.ToDateTime(row["ProcessedAt"])
        };
    }

    private async Task EnsureTableExistsAsync()
    {
        var createTableQuery = @"
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[IdempotencyKeys]') AND type in (N'U'))
            BEGIN
                CREATE TABLE [dbo].[IdempotencyKeys] (
                    [IdempotencyKey] [nvarchar](255) NOT NULL,
                    [OperationType] [nvarchar](50) NOT NULL,
                    [DocKey] [bigint] NULL,
                    [DocNo] [nvarchar](30) NULL,
                    [ProcessedAt] [datetime] NOT NULL,
                    CONSTRAINT [PK_IdempotencyKeys] PRIMARY KEY CLUSTERED ([IdempotencyKey] ASC)
                )
                CREATE INDEX [IX_IdempotencyKeys_ProcessedAt] ON [dbo].[IdempotencyKeys] ([ProcessedAt])
            END
        ";

        try
        {
            await _dbService.ExecuteNonQueryAsync(createTableQuery);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create IdempotencyKeys table (may already exist)");
        }
    }
}

