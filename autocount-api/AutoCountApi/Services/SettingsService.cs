using AutoCountApi.Models;
using System.Data;

namespace AutoCountApi.Services;

public class SettingsService : ISettingsService
{
    private readonly IAutoCountDbService _dbService;
    private readonly ILogger<SettingsService> _logger;

    public SettingsService(IAutoCountDbService dbService, ILogger<SettingsService> logger)
    {
        _dbService = dbService;
        _logger = logger;
    }

    public async Task<List<TaxCodeDto>> GetTaxCodesAsync()
    {
        var query = @"
            SELECT 
                TaxCode, Description, TaxRate, IsActive
            FROM TaxCode
            ORDER BY TaxCode
        ";

        var result = await _dbService.ExecuteQueryAsync(query, new Dictionary<string, object>());
        var taxCodes = new List<TaxCodeDto>();

        foreach (DataRow row in result.Rows)
        {
            taxCodes.Add(new TaxCodeDto
            {
                TaxCode = row["TaxCode"].ToString() ?? string.Empty,
                Description = row["Description"]?.ToString(),
                TaxRate = row["TaxRate"] != DBNull.Value ? Convert.ToDecimal(row["TaxRate"]) : 0,
                IsActive = row["IsActive"]?.ToString() ?? "Y"
            });
        }

        return taxCodes;
    }

    public async Task<TaxCodeDto> CreateTaxCodeAsync(CreateTaxCodeRequest request)
    {
        // Check if tax code already exists
        var checkQuery = "SELECT COUNT(*) FROM TaxCode WHERE TaxCode = @TaxCode";
        var checkParams = new Dictionary<string, object> { { "TaxCode", request.TaxCode } };
        var checkResult = await _dbService.ExecuteQueryAsync(checkQuery, checkParams);
        
        if (Convert.ToInt32(checkResult.Rows[0][0]) > 0)
        {
            throw new InvalidOperationException($"Tax code '{request.TaxCode}' already exists");
        }

        // Insert new tax code
        var insertQuery = @"
            INSERT INTO TaxCode (
                TaxCode, Description, TaxRate, Inclusive, IsActive, LastUpdate,
                SupplyPurchase, IsDefault, IsZeroRate, UseTrxTaxAccNo, AccountingBasis, AddToCost, Guid
            )
            VALUES (
                @TaxCode, @Description, @TaxRate, 'N', 'Y', @LastUpdate,
                'B', 'N', 'N', 'N', 0, 'N', NEWID()
            )
        ";

        var parameters = new Dictionary<string, object>
        {
            { "TaxCode", request.TaxCode },
            { "Description", (object?)request.Description ?? DBNull.Value },
            { "TaxRate", request.TaxRate },
            { "LastUpdate", DateTimeOffset.UtcNow.ToUnixTimeSeconds() }
        };

        await _dbService.ExecuteQueryAsync(insertQuery, parameters);

        _logger.LogInformation("Created tax code: {TaxCode}", request.TaxCode);

        return new TaxCodeDto
        {
            TaxCode = request.TaxCode,
            Description = request.Description,
            TaxRate = request.TaxRate,
            IsActive = "Y"
        };
    }

    public async Task<List<ClassificationDto>> GetClassificationsAsync()
    {
        // Get unique classifications from Item table
        var query = @"
            SELECT DISTINCT
                Classification as Code,
                NULL as Description
            FROM Item
            WHERE Classification IS NOT NULL AND Classification != ''
            ORDER BY Classification
        ";

        var result = await _dbService.ExecuteQueryAsync(query, new Dictionary<string, object>());
        var classifications = new List<ClassificationDto>();

        foreach (DataRow row in result.Rows)
        {
            classifications.Add(new ClassificationDto
            {
                Code = row["Code"]?.ToString() ?? string.Empty,
                Description = row["Description"]?.ToString()
            });
        }

        return classifications;
    }

    public async Task<ClassificationDto> CreateClassificationAsync(CreateClassificationRequest request)
    {
        // Note: Classification is a field in the Item table, not a separate table
        // This method just validates the code format and returns it
        // Actual classification assignment happens when creating/updating items
        
        if (request.Code.Length > 3)
        {
            throw new InvalidOperationException("Classification code must be 3 characters or less");
        }

        _logger.LogInformation("Classification code validated: {Code}", request.Code);

        return new ClassificationDto
        {
            Code = request.Code,
            Description = request.Description
        };
    }
}
