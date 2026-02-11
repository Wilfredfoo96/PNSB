using AutoCountApi.Models;
using System.Data;

namespace AutoCountApi.Services;

public class DebtorService : IDebtorService
{
    private readonly IAutoCountDbService _dbService;
    private readonly ILogger<DebtorService> _logger;

    public DebtorService(IAutoCountDbService dbService, ILogger<DebtorService> logger)
    {
        _dbService = dbService;
        _logger = logger;
    }

    public async Task<Debtor?> GetDebtorAsync(string accNo)
    {
        var query = @"
            SELECT 
                AccNo, CompanyName, Address1, Address2, Address3, Address4,
                Attention, Phone1, EmailAddress, DebtorType, DisplayTerm, SalesAgent,
                IsActive, CreditLimit, TaxCode, ExemptNo, RegisterNo, LastModified, CurrencyCode
            FROM Debtor
            WHERE AccNo = @AccNo
        ";

        var parameters = new Dictionary<string, object> { { "AccNo", accNo } };
        var result = await _dbService.ExecuteQueryAsync(query, parameters);

        if (result.Rows.Count == 0)
            return null;

        return MapDebtor(result.Rows[0]);
    }

    public async Task<List<Debtor>> GetDebtorsAsync(int page = 1, int pageSize = 50, string? search = null)
    {
        var offset = (page - 1) * pageSize;
        var parameters = new Dictionary<string, object>
        {
            { "Offset", offset },
            { "PageSize", pageSize }
        };

        var whereClause = "WHERE 1=1";
        if (!string.IsNullOrWhiteSpace(search))
        {
            whereClause += " AND (AccNo LIKE @Search OR CompanyName LIKE @Search)";
            parameters.Add("Search", $"%{search}%");
        }

        var query = $@"
            SELECT 
                AccNo, CompanyName, Address1, Address2, Address3, Address4,
                Attention, Phone1, EmailAddress, DebtorType, DisplayTerm, SalesAgent,
                IsActive, CreditLimit, TaxCode, ExemptNo, RegisterNo, LastModified, CurrencyCode
            FROM Debtor
            {whereClause}
            ORDER BY AccNo
            OFFSET @Offset ROWS
            FETCH NEXT @PageSize ROWS ONLY
        ";

        var result = await _dbService.ExecuteQueryAsync(query, parameters);
        return result.Rows.Cast<DataRow>().Select(MapDebtor).ToList();
    }

    public async Task<int> GetDebtorCountAsync(string? search = null)
    {
        var parameters = new Dictionary<string, object>();
        var whereClause = "WHERE 1=1";
        
        if (!string.IsNullOrWhiteSpace(search))
        {
            whereClause += " AND (AccNo LIKE @Search OR CompanyName LIKE @Search)";
            parameters.Add("Search", $"%{search}%");
        }

        var query = $@"
            SELECT COUNT(*)
            FROM Debtor
            {whereClause}
        ";

        var count = await _dbService.ExecuteScalarAsync<int>(query, parameters);
        return count;
    }

    public async Task<Debtor> CreateDebtorAsync(CreateDebtorRequest request)
    {
        // Auto-generate AccNo if not provided
        var accNo = request.AccNo;
        if (string.IsNullOrWhiteSpace(accNo))
        {
            accNo = await GenerateNextAccNoAsync();
        }

        // Check if debtor already exists
        if (await DebtorExistsAsync(accNo))
        {
            throw new InvalidOperationException($"Debtor with AccNo '{accNo}' already exists");
        }

        var now = DateTime.Now;
        
        var query = @"
            INSERT INTO Debtor (
                AccNo, CompanyName, Address1, Address2, Address3, Address4,
                Attention, Phone1, EmailAddress, DebtorType, DisplayTerm, SalesAgent,
                IsActive, CreditLimit, TaxCode, ExemptNo, RegisterNo, LastModified, CurrencyCode
            )
            VALUES (
                @AccNo, @CompanyName, @Address1, @Address2, @Address3, @Address4,
                @Attention, @Phone1, @EmailAddress, @DebtorType, @DisplayTerm, @SalesAgent,
                @IsActive, @CreditLimit, @TaxCode, @ExemptNo, @RegisterNo, @LastModified, @CurrencyCode
            )
        ";

        var parameters = new Dictionary<string, object>
        {
            { "AccNo", accNo },
            { "CompanyName", (object?)request.Name ?? DBNull.Value },
            { "Address1", (object?)request.Address1 ?? DBNull.Value },
            { "Address2", (object?)request.Address2 ?? DBNull.Value },
            { "Address3", (object?)request.Address3 ?? DBNull.Value },
            { "Address4", (object?)request.Address4 ?? DBNull.Value },
            { "Attention", (object?)request.Contact ?? DBNull.Value },
            { "Phone1", (object?)request.Phone1 ?? DBNull.Value },
            { "EmailAddress", (object?)request.Email ?? DBNull.Value },
            { "DebtorType", (object?)request.DebtorType ?? DBNull.Value },
            { "DisplayTerm", (object?)request.Terms ?? DBNull.Value },
            { "SalesAgent", (object?)request.SalesAgent ?? DBNull.Value },
            { "IsActive", "Y" },
            { "CreditLimit", (object?)request.CreditLimit ?? DBNull.Value },
            { "TaxCode", (object?)request.TaxCode ?? DBNull.Value },
            { "ExemptNo", (object?)request.TaxRegNo ?? DBNull.Value },
            { "RegisterNo", DBNull.Value }, // Not provided in request, set to NULL
            { "LastModified", now },
            { "CurrencyCode", "MYR" } // Hardcoded to MYR
        };

        await _dbService.ExecuteNonQueryAsync(query, parameters);
        _logger.LogInformation("Created debtor: {AccNo}", accNo);

        return (await GetDebtorAsync(accNo))!;
    }

    public async Task<Debtor> UpdateDebtorAsync(string accNo, UpdateDebtorRequest request)
    {
        if (!await DebtorExistsAsync(accNo))
        {
            throw new InvalidOperationException($"Debtor with AccNo '{accNo}' not found");
        }

        var setClauses = new List<string>();
        var parameters = new Dictionary<string, object> { { "AccNo", accNo } };

        if (request.Name != null) { setClauses.Add("CompanyName = @CompanyName"); parameters.Add("CompanyName", request.Name); }
        if (request.Address1 != null) { setClauses.Add("Address1 = @Address1"); parameters.Add("Address1", request.Address1); }
        if (request.Address2 != null) { setClauses.Add("Address2 = @Address2"); parameters.Add("Address2", request.Address2); }
        if (request.Address3 != null) { setClauses.Add("Address3 = @Address3"); parameters.Add("Address3", request.Address3); }
        if (request.Address4 != null) { setClauses.Add("Address4 = @Address4"); parameters.Add("Address4", request.Address4); }
        if (request.Contact != null) { setClauses.Add("Attention = @Attention"); parameters.Add("Attention", request.Contact); }
        if (request.Phone1 != null) { setClauses.Add("Phone1 = @Phone1"); parameters.Add("Phone1", request.Phone1); }
        if (request.Email != null) { setClauses.Add("EmailAddress = @EmailAddress"); parameters.Add("EmailAddress", request.Email); }
        if (request.DebtorType != null) { setClauses.Add("DebtorType = @DebtorType"); parameters.Add("DebtorType", request.DebtorType); }
        if (request.Terms != null) { setClauses.Add("DisplayTerm = @DisplayTerm"); parameters.Add("DisplayTerm", request.Terms); }
        if (request.SalesAgent != null) { setClauses.Add("SalesAgent = @SalesAgent"); parameters.Add("SalesAgent", request.SalesAgent); }
        if (request.IsActive != null) { setClauses.Add("IsActive = @IsActive"); parameters.Add("IsActive", request.IsActive); }
        if (request.CreditLimit.HasValue) { setClauses.Add("CreditLimit = @CreditLimit"); parameters.Add("CreditLimit", request.CreditLimit.Value); }
        if (request.TaxCode != null) { setClauses.Add("TaxCode = @TaxCode"); parameters.Add("TaxCode", request.TaxCode); }
        if (request.TaxRegNo != null) { setClauses.Add("ExemptNo = @ExemptNo"); parameters.Add("ExemptNo", request.TaxRegNo); }

        if (setClauses.Count == 0)
        {
            throw new InvalidOperationException("No fields to update");
        }

        var query = $@"
            UPDATE Debtor
            SET {string.Join(", ", setClauses)}
            WHERE AccNo = @AccNo
        ";

        await _dbService.ExecuteNonQueryAsync(query, parameters);
        _logger.LogInformation("Updated debtor: {AccNo}", accNo);

        return (await GetDebtorAsync(accNo))!;
    }

    public async Task<bool> DeleteDebtorAsync(string accNo)
    {
        // Soft delete - set IsActive to 'N'
        var query = @"
            UPDATE Debtor
            SET IsActive = 'N'
            WHERE AccNo = @AccNo
        ";

        var parameters = new Dictionary<string, object> { { "AccNo", accNo } };
        var rowsAffected = await _dbService.ExecuteNonQueryAsync(query, parameters);
        
        if (rowsAffected > 0)
        {
            _logger.LogInformation("Soft deleted debtor: {AccNo}", accNo);
        }

        return rowsAffected > 0;
    }

    public async Task<bool> DebtorExistsAsync(string accNo)
    {
        var query = "SELECT COUNT(*) FROM Debtor WHERE AccNo = @AccNo";
        var parameters = new Dictionary<string, object> { { "AccNo", accNo } };
        var count = await _dbService.ExecuteScalarAsync<int>(query, parameters);
        return count > 0;
    }

    private async Task<string> GenerateNextAccNoAsync()
    {
        // Find the highest numeric AccNo (5 digits)
        var query = @"
            SELECT TOP 1 AccNo
            FROM Debtor
            WHERE AccNo LIKE '[0-9][0-9][0-9][0-9][0-9]'
               AND LEN(AccNo) = 5
            ORDER BY CAST(AccNo AS INT) DESC
        ";

        var result = await _dbService.ExecuteQueryAsync(query);
        
        int nextNumber = 1;
        if (result.Rows.Count > 0)
        {
            var lastAccNo = result.Rows[0]["AccNo"].ToString();
            if (!string.IsNullOrEmpty(lastAccNo) && int.TryParse(lastAccNo, out int lastNumber))
            {
                nextNumber = lastNumber + 1;
            }
        }

        // Format as 5-digit number with leading zeros (e.g., "00001", "00002")
        return nextNumber.ToString("D5");
    }

    private static Debtor MapDebtor(DataRow row)
    {
        return new Debtor
        {
            AccNo = row["AccNo"].ToString() ?? string.Empty,
            Name = row["CompanyName"]?.ToString(),
            Address1 = row["Address1"]?.ToString(),
            Address2 = row["Address2"]?.ToString(),
            Address3 = row["Address3"]?.ToString(),
            Address4 = row["Address4"]?.ToString(),
            Contact = row["Attention"]?.ToString(),
            Phone1 = row["Phone1"]?.ToString(),
            Email = row["EmailAddress"]?.ToString(),
            DebtorType = row["DebtorType"]?.ToString(),
            Terms = row["DisplayTerm"]?.ToString(),
            SalesAgent = row["SalesAgent"]?.ToString(),
            IsActive = row["IsActive"]?.ToString(),
            CreditLimit = row["CreditLimit"] != DBNull.Value ? Convert.ToDecimal(row["CreditLimit"]) : null,
            TaxCode = row["TaxCode"]?.ToString(),
            TaxRegNo = row["ExemptNo"]?.ToString(),
            RegisterNo = row["RegisterNo"]?.ToString(),
            LastModified = row["LastModified"] != DBNull.Value ? Convert.ToDateTime(row["LastModified"]) : null,
            CurrencyCode = row["CurrencyCode"]?.ToString()
        };
    }
}

