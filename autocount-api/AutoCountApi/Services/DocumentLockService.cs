using System.Data;

namespace AutoCountApi.Services;

public interface IDocumentLockService
{
    Task<bool> AcquireLockAsync(string documentType, long docKey, string lockId, TimeSpan? timeout = null);
    Task<bool> ReleaseLockAsync(string documentType, long docKey, string lockId);
    Task<bool> IsLockedAsync(string documentType, long docKey);
    Task<string?> GetLockOwnerAsync(string documentType, long docKey);
}

public class DocumentLockService : IDocumentLockService
{
    private readonly IAutoCountDbService _dbService;
    private readonly ILogger<DocumentLockService> _logger;
    private readonly TimeSpan _defaultLockTimeout = TimeSpan.FromMinutes(30);

    public DocumentLockService(IAutoCountDbService dbService, ILogger<DocumentLockService> logger)
    {
        _dbService = dbService;
        _logger = logger;
    }

    public async Task<bool> AcquireLockAsync(string documentType, long docKey, string lockId, TimeSpan? timeout = null)
    {
        await EnsureTableExistsAsync();

        var lockTimeout = timeout ?? _defaultLockTimeout;
        var expiresAt = DateTime.UtcNow.Add(lockTimeout);

        // Try to acquire lock
        var query = @"
            IF NOT EXISTS (
                SELECT 1 FROM DocumentLocks 
                WHERE DocumentType = @DocumentType 
                  AND DocKey = @DocKey 
                  AND ExpiresAt > GETUTCDATE()
            )
            BEGIN
                INSERT INTO DocumentLocks (DocumentType, DocKey, LockId, AcquiredAt, ExpiresAt)
                VALUES (@DocumentType, @DocKey, @LockId, GETUTCDATE(), @ExpiresAt)
            END
            ELSE
            BEGIN
                SELECT 0
            END
        ";

        var parameters = new Dictionary<string, object>
        {
            { "DocumentType", documentType },
            { "DocKey", docKey },
            { "LockId", lockId },
            { "ExpiresAt", expiresAt }
        };

        // Clean up expired locks first
        await CleanupExpiredLocksAsync();

        try
        {
            var result = await _dbService.ExecuteScalarAsync<int>(query, parameters);
            if (result == 0)
            {
                _logger.LogWarning("Failed to acquire lock for {DocumentType}:{DocKey}, lock already held", documentType, docKey);
                return false;
            }

            _logger.LogInformation("Acquired lock for {DocumentType}:{DocKey}, LockId: {LockId}", documentType, docKey, lockId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error acquiring lock for {DocumentType}:{DocKey}", documentType, docKey);
            return false;
        }
    }

    public async Task<bool> ReleaseLockAsync(string documentType, long docKey, string lockId)
    {
        await EnsureTableExistsAsync();

        var query = @"
            DELETE FROM DocumentLocks
            WHERE DocumentType = @DocumentType
              AND DocKey = @DocKey
              AND LockId = @LockId
        ";

        var parameters = new Dictionary<string, object>
        {
            { "DocumentType", documentType },
            { "DocKey", docKey },
            { "LockId", lockId }
        };

        var rowsAffected = await _dbService.ExecuteNonQueryAsync(query, parameters);
        
        if (rowsAffected > 0)
        {
            _logger.LogInformation("Released lock for {DocumentType}:{DocKey}, LockId: {LockId}", documentType, docKey, lockId);
        }

        return rowsAffected > 0;
    }

    public async Task<bool> IsLockedAsync(string documentType, long docKey)
    {
        await EnsureTableExistsAsync();
        await CleanupExpiredLocksAsync();

        var query = @"
            SELECT COUNT(*) 
            FROM DocumentLocks
            WHERE DocumentType = @DocumentType
              AND DocKey = @DocKey
              AND ExpiresAt > GETUTCDATE()
        ";

        var parameters = new Dictionary<string, object>
        {
            { "DocumentType", documentType },
            { "DocKey", docKey }
        };

        var count = await _dbService.ExecuteScalarAsync<int>(query, parameters);
        return count > 0;
    }

    public async Task<string?> GetLockOwnerAsync(string documentType, long docKey)
    {
        await EnsureTableExistsAsync();
        await CleanupExpiredLocksAsync();

        var query = @"
            SELECT LockId
            FROM DocumentLocks
            WHERE DocumentType = @DocumentType
              AND DocKey = @DocKey
              AND ExpiresAt > GETUTCDATE()
        ";

        var parameters = new Dictionary<string, object>
        {
            { "DocumentType", documentType },
            { "DocKey", docKey }
        };

        return await _dbService.ExecuteScalarAsync<string>(query, parameters);
    }

    private async Task CleanupExpiredLocksAsync()
    {
        var query = @"
            DELETE FROM DocumentLocks
            WHERE ExpiresAt <= GETUTCDATE()
        ";

        try
        {
            await _dbService.ExecuteNonQueryAsync(query);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error cleaning up expired locks");
        }
    }

    private async Task EnsureTableExistsAsync()
    {
        var createTableQuery = @"
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DocumentLocks]') AND type in (N'U'))
            BEGIN
                CREATE TABLE [dbo].[DocumentLocks] (
                    [DocumentType] [nvarchar](50) NOT NULL,
                    [DocKey] [bigint] NOT NULL,
                    [LockId] [nvarchar](100) NOT NULL,
                    [AcquiredAt] [datetime] NOT NULL,
                    [ExpiresAt] [datetime] NOT NULL,
                    CONSTRAINT [PK_DocumentLocks] PRIMARY KEY CLUSTERED ([DocumentType] ASC, [DocKey] ASC)
                )
                CREATE INDEX [IX_DocumentLocks_ExpiresAt] ON [dbo].[DocumentLocks] ([ExpiresAt])
            END
        ";

        try
        {
            await _dbService.ExecuteNonQueryAsync(createTableQuery);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create DocumentLocks table (may already exist)");
        }
    }
}

