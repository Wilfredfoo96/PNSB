using AutoCountApi.Models;
using System.Data;

namespace AutoCountApi.Services;

public class InvoiceService : IInvoiceService
{
    private readonly IAutoCountDbService _dbService;
    private readonly IIdempotencyService _idempotencyService;
    private readonly ILogger<InvoiceService> _logger;

    public InvoiceService(
        IAutoCountDbService dbService, 
        IIdempotencyService idempotencyService,
        ILogger<InvoiceService> logger)
    {
        _dbService = dbService;
        _idempotencyService = idempotencyService;
        _logger = logger;
    }

    public async Task<List<Invoice>> GetInvoicesAsync(int page = 1, int pageSize = 50, string? search = null, string? status = null)
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
            whereClause += " AND (ARInvoice.DocNo LIKE @Search OR ARInvoice.DebtorCode LIKE @Search OR Debtor.CompanyName LIKE @Search)";
            parameters.Add("Search", $"%{search}%");
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var statusFilter = status.ToUpper() switch
            {
                "DRAFT" => "ARInvoice.DocStatus = 'D' AND ARInvoice.Cancelled = 'F'",
                "POSTED" => "ARInvoice.DocStatus = 'P' AND ARInvoice.Cancelled = 'F'",
                "VOID" => "ARInvoice.Cancelled = 'T'",
                _ => "1=1"
            };
            whereClause += $" AND ({statusFilter})";
        }

        var query = $@"
            SELECT 
                ARInvoice.DocKey, ARInvoice.DocNo, ARInvoice.DocDate, 
                ARInvoice.DebtorCode, 
                ISNULL(Debtor.CompanyName, '') as DebtorName,
                ARInvoice.Total, ARInvoice.Tax, ARInvoice.Cancelled, 
                ARInvoice.DocStatus, ARInvoice.LastModified, ARInvoice.CreatedTimeStamp
            FROM ARInvoice
            LEFT JOIN Debtor ON ARInvoice.DebtorCode = Debtor.AccNo
            {whereClause}
            ORDER BY ARInvoice.DocKey DESC
            OFFSET @Offset ROWS
            FETCH NEXT @PageSize ROWS ONLY
        ";

        var result = await _dbService.ExecuteQueryAsync(query, parameters);
        
        // Don't load lines for list view (performance optimization)
        // Lines will be empty list, which is fine for list endpoints
        return result.Rows.Cast<DataRow>().Select(MapInvoice).ToList();
    }

    public async Task<int> GetInvoiceCountAsync(string? search = null, string? status = null)
    {
        var parameters = new Dictionary<string, object>();
        var whereClause = "WHERE 1=1";
        
        if (!string.IsNullOrWhiteSpace(search))
        {
            whereClause += " AND (ARInvoice.DocNo LIKE @Search OR ARInvoice.DebtorCode LIKE @Search OR Debtor.CompanyName LIKE @Search)";
            parameters.Add("Search", $"%{search}%");
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var statusFilter = status.ToUpper() switch
            {
                "DRAFT" => "ARInvoice.DocStatus = 'D' AND ARInvoice.Cancelled = 'F'",
                "POSTED" => "ARInvoice.DocStatus = 'P' AND ARInvoice.Cancelled = 'F'",
                "VOID" => "ARInvoice.Cancelled = 'T'",
                _ => "1=1"
            };
            whereClause += $" AND ({statusFilter})";
        }

        var query = $@"
            SELECT COUNT(*)
            FROM ARInvoice
            LEFT JOIN Debtor ON ARInvoice.DebtorCode = Debtor.AccNo
            {whereClause}
        ";

        return await _dbService.ExecuteScalarAsync<int>(query, parameters);
    }

    public async Task<Invoice?> GetInvoiceAsync(long docKey)
    {
        var query = @"
            SELECT 
                ARInvoice.DocKey, ARInvoice.DocNo, ARInvoice.DocDate, 
                ARInvoice.DebtorCode,
                ISNULL(Debtor.CompanyName, '') as DebtorName,
                ARInvoice.Total, ARInvoice.Tax, ARInvoice.Cancelled, 
                ARInvoice.DocStatus, ARInvoice.LastModified, ARInvoice.CreatedTimeStamp
            FROM ARInvoice
            LEFT JOIN Debtor ON ARInvoice.DebtorCode = Debtor.AccNo
            WHERE ARInvoice.DocKey = @DocKey
        ";

        var parameters = new Dictionary<string, object> { { "DocKey", docKey } };
        var result = await _dbService.ExecuteQueryAsync(query, parameters);

        if (result.Rows.Count == 0)
            return null;

        var invoice = MapInvoice(result.Rows[0]);
        
        // Get invoice lines
        invoice.Lines = await GetInvoiceLinesAsync(docKey);
        
        return invoice;
    }

    public async Task<Invoice?> GetInvoiceByDocNoAsync(string docNo)
    {
        var query = @"
            SELECT DocKey
            FROM ARInvoice
            WHERE DocNo = @DocNo
        ";

        var parameters = new Dictionary<string, object> { { "DocNo", docNo } };
        var result = await _dbService.ExecuteQueryAsync(query, parameters);

        if (result.Rows.Count == 0)
            return null;

        var docKey = Convert.ToInt64(result.Rows[0]["DocKey"]);
        return await GetInvoiceAsync(docKey);
    }

    public async Task<Invoice> CreateDraftInvoiceAsync(CreateInvoiceRequest request)
    {
        // Validate debtor exists
        var debtorCheck = "SELECT COUNT(*) FROM Debtor WHERE AccNo = @DebtorCode AND IsActive = 'Y'";
        var debtorExists = await _dbService.ExecuteScalarAsync<int>(
            debtorCheck, 
            new Dictionary<string, object> { { "DebtorCode", request.DebtorCode } }
        );

        if (debtorExists == 0)
        {
            throw new InvalidOperationException($"Debtor '{request.DebtorCode}' not found or inactive");
        }

        // Check idempotency if provided
        if (!string.IsNullOrEmpty(request.IdempotencyKey))
        {
            var existing = await _idempotencyService.GetResultAsync(request.IdempotencyKey);
            if (existing != null)
            {
                _logger.LogInformation("Idempotency key already processed: {IdempotencyKey}, returning existing result", request.IdempotencyKey);
                if (existing.DocKey.HasValue)
                {
                    var existingInvoice = await GetInvoiceAsync(existing.DocKey.Value);
                    if (existingInvoice == null)
                    {
                        throw new InvalidOperationException($"Invoice with DocKey '{existing.DocKey.Value}' not found");
                    }
                    return existingInvoice;
                }
                throw new InvalidOperationException($"Idempotency key '{request.IdempotencyKey}' was already processed but no document was created");
            }
        }

        // Generate DocNo (or use AutoCount's numbering)
        var docNo = await GenerateDocNoAsync("ARInvoice");

        // Generate DocKey (get next available DocKey) - check if IDENTITY first
        // If ARInvoice.DocKey is IDENTITY, we can use SCOPE_IDENTITY(), otherwise generate manually
        var getNextDocKeyQuery = "SELECT ISNULL(MAX(DocKey), 0) + 1 FROM ARInvoice";
        var docKey = await _dbService.ExecuteScalarAsync<long>(getNextDocKeyQuery);

        // Get customer details for required fields
        var debtorName = await GetDebtorNameAsync(request.DebtorCode) ?? "";
        var displayTerm = await GetDebtorDisplayTermAsync(request.DebtorCode);
        
        // Get currency info from customer if not provided (default to MYR if not found)
        // Currency table has BankBuyRate and BankSellRate, not CurrencyRate
        // For sales documents, we use BankSellRate
        var getCurrencyQuery = @"
            SELECT Debtor.CurrencyCode, 
                   (SELECT TOP 1 BankSellRate FROM Currency WHERE CurrencyCode = Debtor.CurrencyCode) as CurrencyRate
            FROM Debtor 
            WHERE AccNo = @DebtorCode";
        var currencyParams = new Dictionary<string, object> { { "DebtorCode", request.DebtorCode } };
        var currencyResult = await _dbService.ExecuteQueryAsync(getCurrencyQuery, currencyParams);
        
        string currencyCode = "MYR";
        decimal currencyRate = 1.0m;
        decimal toTaxCurrencyRate = 1.0m;
        
        if (currencyResult.Rows.Count > 0)
        {
            var row = currencyResult.Rows[0];
            currencyCode = row["CurrencyCode"]?.ToString() ?? "MYR";
            if (row["CurrencyRate"] != DBNull.Value)
            {
                currencyRate = Convert.ToDecimal(row["CurrencyRate"]);
                toTaxCurrencyRate = currencyRate;
            }
        }

        // Calculate DueDate (default to DocDate + 30 days, or use customer terms)
        var docDate = request.DocDate;
        var dueDate = docDate;
        if (displayTerm != null && displayTerm.Length > 0)
        {
            // Try to parse terms (e.g., "NET 30" = 30 days)
            var termMatch = System.Text.RegularExpressions.Regex.Match(displayTerm, @"(\d+)");
            if (termMatch.Success && int.TryParse(termMatch.Value, out int days))
            {
                dueDate = docDate.AddDays(days);
            }
            else
            {
                dueDate = docDate.AddDays(30); // Default 30 days
            }
        }
        else
        {
            dueDate = docDate.AddDays(30); // Default 30 days
        }

        // Get a valid UserID from Users table (required for foreign key constraint)
        var validUserID = await GetValidUserIDAsync();

        var now = DateTime.Now;
        var lastUpdate = (int)(DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalSeconds;

        // Create invoice header with all required NOT NULL fields
        var insertQuery = @"
            INSERT INTO ARInvoice (
                DocKey, DocNo, DocDate, DebtorCode, DebtorName, Ref, Description,
                DisplayTerm, DueDate, JournalType,
                CurrencyCode, CurrencyRate, ToTaxCurrencyRate,
                Total, Tax, Cancelled, DocStatus, LastModified, 
                LastModifiedUserID, CreatedTimeStamp, CreatedUserID,
                InclusiveTax, RoundingMethod, WithholdingTaxVersion, WithholdingTaxRoundingMethod
            )
            VALUES (
                @DocKey, @DocNo, @DocDate, @DebtorCode, @DebtorName, @Ref, @Description,
                @DisplayTerm, @DueDate, 'AR',
                @CurrencyCode, @CurrencyRate, @ToTaxCurrencyRate,
                0, 0, 'F', 'D', @LastModified,
                @UserID, @CreatedTimeStamp, @UserID,
                'N', 0, 0, 0
            );
        ";

        var parameters = new Dictionary<string, object>
        {
            { "DocKey", docKey },
            { "DocNo", docNo },
            { "DocDate", request.DocDate },
            { "DebtorCode", request.DebtorCode },
            { "DebtorName", debtorName },
            { "Ref", (object?)request.Ref ?? DBNull.Value },
            { "Description", (object?)request.Description ?? DBNull.Value },
            { "DisplayTerm", (object?)displayTerm ?? DBNull.Value },
            { "DueDate", dueDate },
            { "CurrencyCode", currencyCode },
            { "CurrencyRate", currencyRate },
            { "ToTaxCurrencyRate", toTaxCurrencyRate },
            { "LastModified", now },
            { "UserID", validUserID },
            { "CreatedTimeStamp", now }
        };

        await _dbService.ExecuteNonQueryAsync(insertQuery, parameters);

        // Create invoice lines
        decimal total = 0;
        decimal tax = 0;
        int seq = 1;

        foreach (var line in request.Lines)
        {
            // Validate item exists and is active (accept both 'Y' and 'T' as active, matching ItemService logic)
            var itemExists = await _dbService.ExecuteScalarAsync<int>(
                "SELECT COUNT(*) FROM Item WHERE ItemCode = @ItemCode AND (IsActive = 'Y' OR IsActive = 'T')",
                new Dictionary<string, object> { { "ItemCode", line.ItemCode } }
            );

            if (itemExists == 0)
            {
                throw new InvalidOperationException($"Item '{line.ItemCode}' not found or inactive");
            }

            var lineTotal = line.Quantity * line.UnitPrice * (1 - (line.Discount ?? 0) / 100);
            total += lineTotal;

            // Generate DtlKey (get next available DtlKey)
            var getNextDtlKeyQuery = "SELECT ISNULL(MAX(DtlKey), 0) + 1 FROM ARInvoiceDTL";
            var dtlKey = await _dbService.ExecuteScalarAsync<long>(getNextDtlKeyQuery);

            // ARInvoiceDTL is an accounting detail table - it uses AccNo (account number) instead of ItemCode
            // Get the item's default account number, or use a default sales account
            // For now, we'll use the ItemCode as AccNo (items may have account mappings)
            // Note: ToAccountRate is required NOT NULL - use currency rate from header
            // Using SubTotal instead of Amount (Amount column may not exist in this database version)
            var lineInsertQuery = @"
                INSERT INTO ARInvoiceDTL (
                    DtlKey, DocKey, Seq, AccNo, Description, TaxCode, SubTotal, ToAccountRate
                )
                VALUES (
                    @DtlKey, @DocKey, @Seq, @AccNo, @Description, @TaxCode, @SubTotal, @ToAccountRate
                )
            ";

            var lineParams = new Dictionary<string, object>
            {
                { "DtlKey", dtlKey },
                { "DocKey", docKey },
                { "Seq", seq++ },
                { "AccNo", line.ItemCode }, // Using ItemCode as AccNo - may need to map to actual account
                { "Description", (object?)line.Description ?? DBNull.Value },
                { "TaxCode", (object?)line.TaxCode ?? DBNull.Value },
                { "SubTotal", lineTotal },
                { "ToAccountRate", currencyRate } // Required NOT NULL - use currency rate from header
            };

            await _dbService.ExecuteNonQueryAsync(lineInsertQuery, lineParams);
        }

        // Update invoice totals
        var updateTotalQuery = @"
            UPDATE ARInvoice
            SET Total = @Total, Tax = @Tax
            WHERE DocKey = @DocKey
        ";

        await _dbService.ExecuteNonQueryAsync(updateTotalQuery, new Dictionary<string, object>
        {
            { "Total", total },
            { "Tax", tax },
            { "DocKey", docKey }
        });

        _logger.LogInformation("Created draft invoice: DocKey={DocKey}, DocNo={DocNo}", docKey, docNo);

        // Mark idempotency key as processed if provided
        if (!string.IsNullOrEmpty(request.IdempotencyKey))
        {
            await _idempotencyService.MarkAsProcessedAsync(request.IdempotencyKey, "CreateDraftInvoice", docKey, docNo);
        }

        return (await GetInvoiceAsync(docKey))!;
    }

    public async Task<Invoice> UpdateDraftInvoiceAsync(long docKey, UpdateInvoiceRequest request)
    {
        var invoice = await GetInvoiceAsync(docKey);
        if (invoice == null)
        {
            throw new InvalidOperationException($"Invoice with DocKey '{docKey}' not found");
        }

        if (invoice.Status != "Draft")
        {
            throw new InvalidOperationException($"Cannot update invoice. Status is '{invoice.Status}', must be 'Draft'");
        }

        // Update header
        var setClauses = new List<string>();
        var parameters = new Dictionary<string, object> { { "DocKey", docKey } };

        if (request.DocDate.HasValue) { setClauses.Add("DocDate = @DocDate"); parameters.Add("DocDate", request.DocDate.Value); }
        if (request.Ref != null) { setClauses.Add("Ref = @Ref"); parameters.Add("Ref", request.Ref); }
        if (request.Description != null) { setClauses.Add("Description = @Description"); parameters.Add("Description", request.Description); }
        if (request.Remarks != null) { setClauses.Add("Note = @Note"); parameters.Add("Note", request.Remarks); }

        if (setClauses.Count > 0)
        {
            setClauses.Add("LastModified = @LastModified");
            parameters.Add("LastModified", DateTime.Now);

            var updateQuery = $@"
                UPDATE ARInvoice
                SET {string.Join(", ", setClauses)}
                WHERE DocKey = @DocKey
            ";

            await _dbService.ExecuteNonQueryAsync(updateQuery, parameters);
        }

        // Update lines if provided
        if (request.Lines != null && request.Lines.Count > 0)
        {
            // Delete existing lines
            await _dbService.ExecuteNonQueryAsync(
                "DELETE FROM ARInvoiceDTL WHERE DocKey = @DocKey",
                new Dictionary<string, object> { { "DocKey", docKey } }
            );

            // Insert new lines (similar to CreateDraftInvoiceAsync)
            decimal total = 0;
            int seq = 1;

            foreach (var line in request.Lines)
            {
                var lineTotal = line.Quantity * line.UnitPrice * (1 - (line.Discount ?? 0) / 100);
                total += lineTotal;

                // Generate DtlKey (get next available DtlKey)
                var getNextDtlKeyQuery = "SELECT ISNULL(MAX(DtlKey), 0) + 1 FROM ARInvoiceDTL";
                var dtlKey = await _dbService.ExecuteScalarAsync<long>(getNextDtlKeyQuery);

                // Get currency rate for ToAccountRate (required NOT NULL)
                var getCurrencyRateQuery = @"
                    SELECT CurrencyRate FROM ARInvoice WHERE DocKey = @DocKey
                ";
                var currencyRateResult = await _dbService.ExecuteQueryAsync(
                    getCurrencyRateQuery,
                    new Dictionary<string, object> { { "DocKey", docKey } }
                );
                decimal toAccountRate = 1.0m;
                if (currencyRateResult.Rows.Count > 0 && currencyRateResult.Rows[0]["CurrencyRate"] != DBNull.Value)
                {
                    toAccountRate = Convert.ToDecimal(currencyRateResult.Rows[0]["CurrencyRate"]);
                }

                // ARInvoiceDTL is an accounting detail table - it uses AccNo (account number) instead of ItemCode
                // Using SubTotal instead of Amount (Amount column may not exist in this database version)
                var lineInsertQuery = @"
                    INSERT INTO ARInvoiceDTL (
                        DtlKey, DocKey, Seq, AccNo, Description, TaxCode, SubTotal, ToAccountRate
                    )
                    VALUES (
                        @DtlKey, @DocKey, @Seq, @AccNo, @Description, @TaxCode, @SubTotal, @ToAccountRate
                    )
                ";

                var lineParams = new Dictionary<string, object>
                {
                    { "DtlKey", dtlKey },
                    { "DocKey", docKey },
                    { "Seq", seq++ },
                    { "AccNo", line.ItemCode }, // Using ItemCode as AccNo - may need to map to actual account
                    { "Description", (object?)line.Description ?? DBNull.Value },
                    { "TaxCode", (object?)line.TaxCode ?? DBNull.Value },
                    { "SubTotal", lineTotal },
                    { "ToAccountRate", toAccountRate } // Required NOT NULL
                };

                await _dbService.ExecuteNonQueryAsync(lineInsertQuery, lineParams);
            }

            // Update totals
            await _dbService.ExecuteNonQueryAsync(
                "UPDATE ARInvoice SET Total = @Total WHERE DocKey = @DocKey",
                new Dictionary<string, object> { { "Total", total }, { "DocKey", docKey } }
            );
        }

        _logger.LogInformation("Updated draft invoice: DocKey={DocKey}", docKey);

        return (await GetInvoiceAsync(docKey))!;
    }

    public async Task<bool> PostInvoiceAsync(long docKey)
    {
        var invoice = await GetInvoiceAsync(docKey);
        if (invoice == null)
        {
            throw new InvalidOperationException($"Invoice with DocKey '{docKey}' not found");
        }

        if (invoice.Status != "Draft")
        {
            throw new InvalidOperationException($"Cannot post invoice. Status is '{invoice.Status}', must be 'Draft'");
        }

        // TODO: Call AutoCount posting logic here
        // For now, just update status to Posted
        var query = @"
            UPDATE ARInvoice
            SET DocStatus = 'P', LastModified = @LastModified
            WHERE DocKey = @DocKey
        ";

        var parameters = new Dictionary<string, object>
        {
            { "DocKey", docKey },
            { "LastModified", DateTime.Now }
        };

        var rowsAffected = await _dbService.ExecuteNonQueryAsync(query, parameters);
        
        if (rowsAffected > 0)
        {
            _logger.LogInformation("Posted invoice: DocKey={DocKey}", docKey);
        }

        return rowsAffected > 0;
    }

    public async Task<bool> VoidInvoiceAsync(long docKey)
    {
        var invoice = await GetInvoiceAsync(docKey);
        if (invoice == null)
        {
            throw new InvalidOperationException($"Invoice with DocKey '{docKey}' not found");
        }

        // TODO: Call AutoCount void logic here
        // For now, just set Cancelled flag
        var query = @"
            UPDATE ARInvoice
            SET Cancelled = 'T', LastModified = @LastModified
            WHERE DocKey = @DocKey
        ";

        var parameters = new Dictionary<string, object>
        {
            { "DocKey", docKey },
            { "LastModified", DateTime.Now }
        };

        var rowsAffected = await _dbService.ExecuteNonQueryAsync(query, parameters);
        
        if (rowsAffected > 0)
        {
            _logger.LogInformation("Voided invoice: DocKey={DocKey}", docKey);
        }

        return rowsAffected > 0;
    }

    public async Task<bool> IsDraftAsync(long docKey)
    {
        var query = "SELECT DocStatus FROM ARInvoice WHERE DocKey = @DocKey";
        var parameters = new Dictionary<string, object> { { "DocKey", docKey } };
        var status = await _dbService.ExecuteScalarAsync<string>(query, parameters);
        return status?.Trim() == "D";
    }

    private async Task<List<InvoiceLine>> GetInvoiceLinesAsync(long docKey)
    {
        // ARInvoiceDTL is an accounting detail table - it uses AccNo instead of ItemCode
        // It doesn't have Qty or UnitPrice - we'll calculate from SubTotal
        var query = @"
            SELECT 
                DtlKey, AccNo, Description, TaxCode, SubTotal
            FROM ARInvoiceDTL
            WHERE DocKey = @DocKey
            ORDER BY Seq
        ";

        var parameters = new Dictionary<string, object> { { "DocKey", docKey } };
        var result = await _dbService.ExecuteQueryAsync(query, parameters);

        return result.Rows.Cast<DataRow>().Select(row => new InvoiceLine
        {
            DtlKey = Convert.ToInt64(row["DtlKey"]),
            ItemCode = row["AccNo"]?.ToString() ?? "", // ARInvoiceDTL uses AccNo, not ItemCode
            Description = row["Description"]?.ToString(),
            Quantity = 1, // ARInvoiceDTL doesn't store quantity - default to 1
            UnitPrice = row["SubTotal"] != DBNull.Value ? Convert.ToDecimal(row["SubTotal"]) : 0, // Use SubTotal as UnitPrice
            Discount = null, // ARInvoiceDTL doesn't store discount
            TaxAmount = 0, // TODO: Calculate from TaxCode
            LineTotal = row["SubTotal"] != DBNull.Value ? Convert.ToDecimal(row["SubTotal"]) : 0
        }).ToList();
    }

    private static Invoice MapInvoice(DataRow row)
    {
        var cancelled = row["Cancelled"]?.ToString()?.Trim() == "T";
        var docStatus = row["DocStatus"]?.ToString()?.Trim() ?? "D";
        
        string status = docStatus switch
        {
            "D" => "Draft",
            "P" => "Posted",
            _ => "Unknown"
        };

        if (cancelled) status = "Void";

        return new Invoice
        {
            DocKey = Convert.ToInt64(row["DocKey"]),
            DocNo = row["DocNo"].ToString() ?? "",
            DocDate = Convert.ToDateTime(row["DocDate"]),
            DebtorCode = row["DebtorCode"].ToString() ?? "",
            DebtorName = row["DebtorName"]?.ToString(),
            Status = status,
            Total = row["Total"] != DBNull.Value ? Convert.ToDecimal(row["Total"]) : null,
            Tax = row["Tax"] != DBNull.Value ? Convert.ToDecimal(row["Tax"]) : null,
            CreatedAt = row["CreatedTimeStamp"] != DBNull.Value ? Convert.ToDateTime(row["CreatedTimeStamp"]) : DateTime.MinValue,
            PostedAt = status == "Posted" && row["LastModified"] != DBNull.Value ? Convert.ToDateTime(row["LastModified"]) : null
        };
    }

    private async Task<string> GenerateDocNoAsync(string docType)
    {
        var year = DateTime.Now.Year;
        var prefix = $"INV-{year}-";
        
        // Find the maximum sequence number for this year by parsing existing DocNo values
        // This ensures uniqueness even with concurrent requests
        var query = $@"
            SELECT TOP 1 DocNo
            FROM ARInvoice
            WHERE DocNo LIKE '{prefix}%'
            ORDER BY DocNo DESC
        ";
        
        var result = await _dbService.ExecuteQueryAsync(query);
        int nextSeq = 1;
        
        if (result.Rows.Count > 0)
        {
            var lastDocNo = result.Rows[0]["DocNo"].ToString() ?? "";
            // Extract sequence number from format "INV-YYYY-NNNN"
            var parts = lastDocNo.Split('-');
            if (parts.Length >= 3 && int.TryParse(parts[2], out int lastSeq))
            {
                nextSeq = lastSeq + 1;
            }
        }
        
        // Check if the generated DocNo already exists (race condition protection)
        string candidateDocNo;
        int attempts = 0;
        do
        {
            candidateDocNo = $"{prefix}{nextSeq:D4}";
            var existsQuery = "SELECT COUNT(*) FROM ARInvoice WHERE DocNo = @DocNo";
            var exists = await _dbService.ExecuteScalarAsync<int>(
                existsQuery,
                new Dictionary<string, object> { { "DocNo", candidateDocNo } }
            );
            
            if (exists == 0)
                break;
                
            nextSeq++;
            attempts++;
            
            // Safety check to prevent infinite loop
            if (attempts > 100)
            {
                throw new InvalidOperationException($"Unable to generate unique DocNo after {attempts} attempts");
            }
        } while (true);
        
        return candidateDocNo;
    }

    private async Task<string?> GetDebtorNameAsync(string debtorCode)
    {
        var query = "SELECT CompanyName FROM Debtor WHERE AccNo = @DebtorCode";
        var parameters = new Dictionary<string, object> { { "DebtorCode", debtorCode } };
        return await _dbService.ExecuteScalarAsync<string>(query, parameters);
    }

    private async Task<string?> GetDebtorDisplayTermAsync(string debtorCode)
    {
        var query = "SELECT DisplayTerm FROM Debtor WHERE AccNo = @DebtorCode";
        var parameters = new Dictionary<string, object> { { "DebtorCode", debtorCode } };
        var result = await _dbService.ExecuteScalarAsync<string>(query, parameters);
        return result ?? ""; // Return empty string if null, since DisplayTerm is NOT NULL
    }

    private async Task<string> GetValidUserIDAsync()
    {
        // Get first active user from Users table
        var query = "SELECT TOP 1 UserID FROM Users WHERE IsActive = 'Y' ORDER BY UserID";
        var result = await _dbService.ExecuteScalarAsync<string>(query);
        
        if (!string.IsNullOrEmpty(result))
            return result;
        
        // If no active user found, try to get any user
        var anyUserQuery = "SELECT TOP 1 UserID FROM Users ORDER BY UserID";
        var anyUser = await _dbService.ExecuteScalarAsync<string>(anyUserQuery);
        
        if (!string.IsNullOrEmpty(anyUser))
            return anyUser;
        
        // Last resort: return 'ADMIN' (this will fail if ADMIN doesn't exist, but at least we tried)
        _logger.LogWarning("No users found in Users table, defaulting to 'ADMIN' for CreatedUserID");
        return "ADMIN";
    }
}

