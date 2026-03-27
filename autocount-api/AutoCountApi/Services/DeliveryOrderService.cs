using AutoCountApi.Models;
using System.Data;
using System.Linq;

namespace AutoCountApi.Services;

public class DeliveryOrderService : IDeliveryOrderService
{
    private readonly IAutoCountDbService _dbService;
    private readonly IIdempotencyService _idempotencyService;
    private readonly ILogger<DeliveryOrderService> _logger;

    public DeliveryOrderService(
        IAutoCountDbService dbService,
        IIdempotencyService idempotencyService,
        ILogger<DeliveryOrderService> logger)
    {
        _dbService = dbService;
        _idempotencyService = idempotencyService;
        _logger = logger;
    }

    public async Task<List<DeliveryOrder>> GetDeliveryOrdersAsync(int page = 1, int pageSize = 50, string? search = null, string? status = null)
    {
        var offset = (page - 1) * pageSize;
        var parameters = new Dictionary<string, object>
        {
            { "Offset", offset },
            { "PageSize", pageSize }
        };

        var whereClause = "WHERE 1=1";
        
        // Exclude voided orders by default (unless explicitly requesting VOID status)
        if (string.IsNullOrWhiteSpace(status) || status.ToUpper() != "VOID")
        {
            whereClause += " AND (DO.Cancelled IS NULL OR DO.Cancelled = 'F')";
        }
        
        if (!string.IsNullOrWhiteSpace(search))
        {
            whereClause += " AND (DO.DocNo LIKE @Search OR DO.DebtorCode LIKE @Search OR Debtor.CompanyName LIKE @Search)";
            parameters.Add("Search", $"%{search}%");
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var statusFilter = status.ToUpper() switch
            {
                "DRAFT" => "DO.DocStatus = 'D' AND DO.Cancelled = 'F'",
                "POSTED" => "DO.DocStatus = 'P' AND DO.Cancelled = 'F'",
                "VOID" => "DO.Cancelled = 'T'",
                _ => "1=1"
            };
            whereClause += $" AND ({statusFilter})";
        }

        var query = $@"
            SELECT 
                DO.DocKey, DO.DocNo, DO.DocDate, 
                DO.DebtorCode, 
                ISNULL(Debtor.CompanyName, '') as DebtorName,
                DO.Ref, DO.Description,
                DO.InvAddr1, DO.InvAddr2, DO.InvAddr3, DO.InvAddr4,
                DO.DisplayTerm, DO.CurrencyCode, DO.CurrencyRate, DO.ToTaxCurrencyRate,
                DO.Total, DO.TotalExTax, DO.NetTotal, DO.LocalNetTotal, 
                DO.AnalysisNetTotal, DO.LocalAnalysisNetTotal,
                DO.Tax, DO.LocalTax, DO.TaxCurrencyTax, DO.ExTax, DO.LocalExTax,
                DO.TaxableAmt, DO.LocalTaxableAmt,
                DO.Footer1Amt, DO.Footer2Amt, DO.Footer3Amt,
                DO.SalesLocation, DO.CalcDiscountOnUnitPrice, DO.MultiPrice, DO.TaxEntityID,
                DO.PostToStock, DO.Transferable,
                DO.Cancelled, DO.DocStatus, DO.LastModified, DO.CreatedTimeStamp,
                DO.SalesAgent, DO.BranchCode, DO.Note, DO.Remark1, DO.Remark2, DO.Remark3, DO.Remark4,
                DO.Guid, DO.YourPONo, DO.YourPODate, DO.ShipVia, DO.ShipInfo,
                DO.Phone1, DO.Fax1, DO.Attention,
                DO.DeliverAddr1, DO.DeliverAddr2, DO.DeliverAddr3, DO.DeliverAddr4,
                DO.InclusiveTax, DO.RoundingMethod, DO.LastUpdate,
                DO.Footer1Param, DO.Footer1TaxCode, DO.Footer2Param, DO.Footer2TaxCode, DO.Footer3Param, DO.Footer3TaxCode,
                DO.Footer1Tax, DO.Footer2Tax, DO.Footer3Tax,
                DO.ExternalLink, DO.RefDocNo, DO.PrintCount, DO.CreatedUserID, DO.LastModifiedUserID
            FROM DO
            LEFT JOIN Debtor ON DO.DebtorCode = Debtor.AccNo
            {whereClause}
            ORDER BY DO.DocKey DESC
            OFFSET @Offset ROWS
            FETCH NEXT @PageSize ROWS ONLY
        ";

        var result = await _dbService.ExecuteQueryAsync(query, parameters);
        return result.Rows.Cast<DataRow>().Select(MapDeliveryOrder).ToList();
    }

    public async Task<int> GetDeliveryOrderCountAsync(string? search = null, string? status = null)
    {
        var parameters = new Dictionary<string, object>();
        var whereClause = "WHERE 1=1";
        
        // Exclude voided orders by default (unless explicitly requesting VOID status)
        if (string.IsNullOrWhiteSpace(status) || status.ToUpper() != "VOID")
        {
            whereClause += " AND (DO.Cancelled IS NULL OR DO.Cancelled = 'F')";
        }
        
        if (!string.IsNullOrWhiteSpace(search))
        {
            whereClause += " AND (DO.DocNo LIKE @Search OR DO.DebtorCode LIKE @Search OR Debtor.CompanyName LIKE @Search)";
            parameters.Add("Search", $"%{search}%");
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var statusFilter = status.ToUpper() switch
            {
                "DRAFT" => "DO.DocStatus = 'D' AND DO.Cancelled = 'F'",
                "POSTED" => "DO.DocStatus = 'P' AND DO.Cancelled = 'F'",
                "VOID" => "DO.Cancelled = 'T'",
                _ => "1=1"
            };
            whereClause += $" AND ({statusFilter})";
        }

        var query = $@"
            SELECT COUNT(*)
            FROM DO
            LEFT JOIN Debtor ON DO.DebtorCode = Debtor.AccNo
            {whereClause}
        ";

        return await _dbService.ExecuteScalarAsync<int>(query, parameters);
    }

    public async Task<DeliveryOrder?> GetDeliveryOrderAsync(long docKey)
    {
        var query = @"
            SELECT 
                DO.DocKey, DO.DocNo, DO.DocDate, DO.DebtorCode, 
                ISNULL(Debtor.CompanyName, '') as DebtorName,
                DO.Ref, DO.Description,
                DO.InvAddr1, DO.InvAddr2, DO.InvAddr3, DO.InvAddr4,
                DO.DisplayTerm, DO.CurrencyCode, DO.CurrencyRate, DO.ToTaxCurrencyRate,
                DO.Total, DO.TotalExTax, DO.NetTotal, DO.LocalNetTotal, 
                DO.AnalysisNetTotal, DO.LocalAnalysisNetTotal,
                DO.Tax, DO.LocalTax, DO.TaxCurrencyTax, DO.ExTax, DO.LocalExTax,
                DO.TaxableAmt, DO.LocalTaxableAmt,
                DO.Footer1Amt, DO.Footer2Amt, DO.Footer3Amt,
                DO.SalesLocation, DO.CalcDiscountOnUnitPrice, DO.MultiPrice, DO.TaxEntityID,
                DO.PostToStock, DO.Transferable,
                DO.Cancelled, DO.DocStatus, DO.LastModified, DO.CreatedTimeStamp,
                DO.SalesAgent, DO.BranchCode, DO.Note, DO.Remark1, DO.Remark2, DO.Remark3, DO.Remark4,
                DO.Guid, DO.YourPONo, DO.YourPODate, DO.ShipVia, DO.ShipInfo,
                DO.Phone1, DO.Fax1, DO.Attention,
                DO.DeliverAddr1, DO.DeliverAddr2, DO.DeliverAddr3, DO.DeliverAddr4,
                DO.InclusiveTax, DO.RoundingMethod, DO.LastUpdate,
                DO.Footer1Param, DO.Footer1TaxCode, DO.Footer2Param, DO.Footer2TaxCode, DO.Footer3Param, DO.Footer3TaxCode,
                DO.Footer1Tax, DO.Footer2Tax, DO.Footer3Tax,
                DO.ExternalLink, DO.RefDocNo, DO.PrintCount, DO.CreatedUserID, DO.LastModifiedUserID
            FROM DO
            LEFT JOIN Debtor ON DO.DebtorCode = Debtor.AccNo
            WHERE DO.DocKey = @DocKey
        ";

        var parameters = new Dictionary<string, object> { { "DocKey", docKey } };
        var result = await _dbService.ExecuteQueryAsync(query, parameters);

        if (result.Rows.Count == 0)
            return null;

        var deliveryOrder = MapDeliveryOrder(result.Rows[0]);
        
        // Get delivery order lines
        deliveryOrder.Lines = await GetDeliveryOrderLinesAsync(docKey);
        
        return deliveryOrder;
    }

    public async Task<DeliveryOrder?> GetDeliveryOrderByDocNoAsync(string docNo)
    {
        var query = @"
            SELECT DocKey
            FROM DO
            WHERE DocNo = @DocNo
        ";

        var parameters = new Dictionary<string, object> { { "DocNo", docNo } };
        var result = await _dbService.ExecuteQueryAsync(query, parameters);

        if (result.Rows.Count == 0)
            return null;

        var docKey = Convert.ToInt64(result.Rows[0]["DocKey"]);
        return await GetDeliveryOrderAsync(docKey);
    }

    public async Task<DeliveryOrder> CreateDraftDeliveryOrderAsync(CreateDeliveryOrderRequest request)
    {
        // Validate debtor exists and is active (accept both 'Y' and 'T' as active, matching frontend logic)
        var debtorCheck = "SELECT COUNT(*) FROM Debtor WHERE AccNo = @DebtorCode AND (IsActive = 'Y' OR IsActive = 'T')";
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
                    var existingDO = await GetDeliveryOrderAsync(existing.DocKey.Value);
                    if (existingDO == null)
                    {
                        throw new InvalidOperationException($"Delivery order with DocKey '{existing.DocKey.Value}' not found");
                    }
                    return existingDO;
                }
                throw new InvalidOperationException($"Idempotency key '{request.IdempotencyKey}' was already processed but no document was created");
            }
        }

        // Generate DocNo with branch prefix if provided
        var branchPrefix = request.BranchPrefix;
        var docNo = await GenerateDocNoAsync(branchPrefix);

        // Generate DocKey (get next available DocKey)
        var getNextDocKeyQuery = "SELECT ISNULL(MAX(DocKey), 0) + 1 FROM DO";
        var docKey = await _dbService.ExecuteScalarAsync<long>(getNextDocKeyQuery);

        // Get customer details for required fields (including address)
        var getDebtorQuery = @"
            SELECT CompanyName, DisplayTerm, CurrencyCode, Address1, Address2, Address3, Address4, Attention,
                   (SELECT TOP 1 BankSellRate FROM Currency WHERE CurrencyCode = Debtor.CurrencyCode) as CurrencyRate
            FROM Debtor
            WHERE AccNo = @DebtorCode";
        var debtorParams = new Dictionary<string, object> { { "DebtorCode", request.DebtorCode } };
        var debtorResult = await _dbService.ExecuteQueryAsync(getDebtorQuery, debtorParams);
        
        string debtorName = "";
        string? displayTerm = null;
        string currencyCode = "MYR";
        decimal currencyRate = 1.0m;
        decimal toTaxCurrencyRate = 1.0m;
        string? invAddr1 = null;
        string? invAddr2 = null;
        string? invAddr3 = null;
        string? invAddr4 = null;
        string? debtorAttention = null;

        if (debtorResult.Rows.Count > 0)
        {
            var row = debtorResult.Rows[0];
            debtorName = row["CompanyName"]?.ToString() ?? "";
            displayTerm = row["DisplayTerm"]?.ToString();
            currencyCode = row["CurrencyCode"]?.ToString() ?? "MYR";
            if (row["CurrencyRate"] != DBNull.Value)
            {
                currencyRate = Convert.ToDecimal(row["CurrencyRate"]);
                toTaxCurrencyRate = currencyRate;
            }
            invAddr1 = row["Address1"]?.ToString();
            invAddr2 = row["Address2"]?.ToString();
            invAddr3 = row["Address3"]?.ToString();
            invAddr4 = row["Address4"]?.ToString();
            debtorAttention = row["Attention"]?.ToString();
        }
        
        // Get TaxEntityID from TaxEntity table by name (default to first active if name not provided)
        int? taxEntityID = null;
        if (!string.IsNullOrWhiteSpace(request.TaxEntityName))
        {
            var taxEntityQuery = "SELECT TaxEntityID FROM TaxEntity WHERE Name = @Name";
            var taxEntityResult = await _dbService.ExecuteScalarAsync<int?>(
                taxEntityQuery,
                new Dictionary<string, object> { { "Name", request.TaxEntityName } }
            );
            taxEntityID = taxEntityResult;
        }
        else
        {
            // Get first active TaxEntity as default
            var defaultTaxEntityQuery = "SELECT TOP 1 TaxEntityID FROM TaxEntity ORDER BY TaxEntityID";
            taxEntityID = await _dbService.ExecuteScalarAsync<int?>(defaultTaxEntityQuery);
        }

        // Get a valid UserID from Users table (required for foreign key constraint)
        var validUserID = await GetValidUserIDAsync();

        var now = DateTime.Now;
        var lastUpdate = 0; // LastUpdate should be 0

        // Calculate line totals and tax per line based on TaxCode
        decimal totalExTax = 0;
        decimal totalTax = 0;
        decimal totalTaxableAmt = 0;
        
        // Helper method to get tax rate from TaxCode
        async Task<decimal> GetTaxRateAsync(string? taxCode)
        {
            if (string.IsNullOrWhiteSpace(taxCode))
                return 0;
            
            var query = "SELECT TaxRate FROM TaxCode WHERE TaxCode = @TaxCode AND IsActive = 'Y'";
            var result = await _dbService.ExecuteScalarAsync<decimal?>(query, 
                new Dictionary<string, object> { { "TaxCode", taxCode } });
            
            return result ?? 0;
        }
        
        // Calculate totals per line (will be done in the line loop below)
        // For now, just calculate header totals from line items
        foreach (var line in request.Lines)
        {
            var lineTotal = line.Quantity * line.UnitPrice * (1 - (line.Discount ?? 0) / 100);
            totalExTax += lineTotal;
            
            // Calculate tax for this line based on TaxCode
            var lineTaxRate = await GetTaxRateAsync(line.TaxCode);
            var lineTax = lineTotal * (lineTaxRate / 100);
            totalTax += lineTax;
            
            if (lineTaxRate > 0)
                totalTaxableAmt += lineTotal;
        }

        // Calculate tax amounts from line totals
        decimal tax = totalTax;
        decimal taxCurrencyTax = totalTax;
        decimal localTax = totalTax;
        // ExTax and LocalExTax should be the tax amount (not the amount before tax)
        decimal exTax = tax;
        decimal localExTax = localTax;
        decimal taxableAmt = totalTaxableAmt;
        decimal localTaxableAmt = totalTaxableAmt;
        decimal taxCurrencyTaxableAmt = totalTaxableAmt;
        
        // Calculate net totals (amount + tax)
        decimal netTotal = totalExTax + tax;
        decimal localNetTotal = totalExTax + localTax;
        // AnalysisNetTotal and LocalAnalysisNetTotal should be WITHOUT tax (just the amount before tax)
        decimal analysisNetTotal = totalExTax;
        decimal localAnalysisNetTotal = totalExTax;

        // Store SalesAgent in Remark4 instead of SalesAgent column (avoids FK_DO_SalesAgent constraint)
        // Remark4 is nvarchar(40) - truncate if needed
        string? remark4 = null;
        if (!string.IsNullOrWhiteSpace(request.SalesAgent))
        {
            remark4 = request.SalesAgent.Length > 40
                ? request.SalesAgent.Substring(0, 40)
                : request.SalesAgent;
        }

        // Create delivery order header with all required fields
        // SalesAgent column is left NULL; user-provided value goes to Remark4
        var insertQuery = @"
            INSERT INTO DO (
                DocKey, DocNo, DocDate, DebtorCode, DebtorName, Ref, Description,
                InvAddr1, InvAddr2, InvAddr3, InvAddr4,
                DisplayTerm, CurrencyCode, CurrencyRate, ToTaxCurrencyRate,
                Total, TotalExTax, NetTotal, LocalNetTotal, AnalysisNetTotal, LocalAnalysisNetTotal,
                LocalTotalCost,
                Tax, LocalTax, TaxCurrencyTax, ExTax, LocalExTax,
                TaxableAmt, LocalTaxableAmt, TaxCurrencyTaxableAmt,
                Footer1Amt, Footer2Amt, Footer3Amt,
                PostToStock, Transferable, Cancelled, DocStatus,
                PrintCount, LastModified, LastModifiedUserID, CreatedTimeStamp, CreatedUserID,
                CanSync, LastUpdate, Guid, InclusiveTax, RoundingMethod,
                SalesLocation, CalcDiscountOnUnitPrice, MultiPrice, TaxEntityID, Remark4, Attention
            )
            VALUES (
                @DocKey, @DocNo, @DocDate, @DebtorCode, @DebtorName, @Ref, @Description,
                @InvAddr1, @InvAddr2, @InvAddr3, @InvAddr4,
                @DisplayTerm, @CurrencyCode, @CurrencyRate, @ToTaxCurrencyRate,
                @Total, @TotalExTax, @NetTotal, @LocalNetTotal, @AnalysisNetTotal, @LocalAnalysisNetTotal,
                0,
                @Tax, @LocalTax, @TaxCurrencyTax, @ExTax, @LocalExTax,
                @TaxableAmt, @LocalTaxableAmt, @TaxCurrencyTaxableAmt,
                0, 0, 0,
                'F', 'T', 'F', 'D',
                0, @LastModified, @UserID, @CreatedTimeStamp, @UserID,
                'Y', @LastUpdate, NEWID(), 'F', 4,
                'HQ', 'F', 'P1', @TaxEntityID, @Remark4, @Attention
            );
        ";

        var parameters = new Dictionary<string, object>
        {
            { "DocKey", docKey },
            { "DocNo", docNo },
            { "DocDate", request.DocDate },
            { "DebtorCode", request.DebtorCode },
            { "DebtorName", debtorName },
            { "Ref", string.IsNullOrWhiteSpace(request.Ref) ? DBNull.Value : (object)request.Ref },
            { "Description", "DELIVERY ORDER" },
            { "InvAddr1", (object?)invAddr1 ?? DBNull.Value },
            { "InvAddr2", (object?)invAddr2 ?? DBNull.Value },
            { "InvAddr3", (object?)invAddr3 ?? DBNull.Value },
            { "InvAddr4", (object?)invAddr4 ?? DBNull.Value },
            { "DisplayTerm", (object?)displayTerm ?? DBNull.Value },
            { "CurrencyCode", currencyCode },
            { "CurrencyRate", currencyRate },
            { "ToTaxCurrencyRate", toTaxCurrencyRate },
            { "Total", totalExTax }, // Total should be the amount before tax
            { "TotalExTax", totalExTax },
            { "NetTotal", netTotal },
            { "LocalNetTotal", localNetTotal },
            { "AnalysisNetTotal", analysisNetTotal },
            { "LocalAnalysisNetTotal", localAnalysisNetTotal },
            { "Tax", tax },
            { "LocalTax", localTax },
            { "TaxCurrencyTax", taxCurrencyTax },
            { "ExTax", exTax },
            { "LocalExTax", localExTax },
            { "TaxableAmt", taxableAmt },
            { "LocalTaxableAmt", localTaxableAmt },
            { "TaxCurrencyTaxableAmt", taxCurrencyTaxableAmt },
            { "TaxEntityID", (object?)taxEntityID ?? DBNull.Value },
            { "Remark4", (object?)remark4 ?? DBNull.Value },
            { "Attention", (object?)debtorAttention ?? DBNull.Value },
            { "LastModified", now },
            { "UserID", validUserID },
            { "CreatedTimeStamp", now },
            { "LastUpdate", lastUpdate }
        };

        await _dbService.ExecuteNonQueryAsync(insertQuery, parameters);

        // Create delivery order lines
        int seq = 1;

        foreach (var line in request.Lines)
        {
            // Fetch item details (UOM, TaxCode, Rate, AccNo, Location) for this line
            var getItemQuery = @"
                SELECT SalesUOM, TaxCode, ItemGroup,
                       ISNULL((SELECT TOP 1 Price FROM ItemUOM WHERE ItemCode = Item.ItemCode AND UOM = Item.SalesUOM), 0) as Rate
                FROM Item 
                WHERE ItemCode = @ItemCode AND (IsActive = 'Y' OR IsActive = 'T')
            ";
            var itemParams = new Dictionary<string, object> { { "ItemCode", line.ItemCode } };
            var itemResult = await _dbService.ExecuteQueryAsync(getItemQuery, itemParams);

            if (itemResult.Rows.Count == 0)
            {
                throw new InvalidOperationException($"Item '{line.ItemCode}' not found or inactive");
            }

            var itemRow = itemResult.Rows[0];
            string? uom = itemRow["SalesUOM"]?.ToString();
            string? itemGroup = itemRow["ItemGroup"]?.ToString();
            // Use TaxCode from request line, or fallback to item's TaxCode
            string? taxCodeRaw = !string.IsNullOrWhiteSpace(line.TaxCode) 
                ? line.TaxCode 
                : itemRow["TaxCode"]?.ToString();
            // Validate TaxCode exists in TaxCode table to prevent FK constraint violation
            string? taxCode = await ValidateTaxCodeAsync(taxCodeRaw);
            // Use Rate from ItemUOM if available, otherwise use UnitPrice from request
            decimal rate = itemRow["Rate"] != DBNull.Value && Convert.ToDecimal(itemRow["Rate"]) > 0 
                ? Convert.ToDecimal(itemRow["Rate"]) 
                : line.UnitPrice;

            // Get AccNo from ItemGroup.SalesCode (for sales documents like DO)
            string? accNo = null;
            if (!string.IsNullOrWhiteSpace(itemGroup))
            {
                var accNoQuery = @"
                    SELECT TOP 1 SalesCode FROM ItemGroup 
                    WHERE ItemGroup = @ItemGroup
                ";
                accNo = await _dbService.ExecuteScalarAsync<string>(accNoQuery,
                    new Dictionary<string, object> { { "ItemGroup", itemGroup } });
            }

            // Calculate line totals
            var lineAmountBeforeDiscount = line.Quantity * line.UnitPrice;
            var discountPercent = line.Discount ?? 0;
            var discountAmt = lineAmountBeforeDiscount * (discountPercent / 100);
            var lineSubTotal = lineAmountBeforeDiscount - discountAmt;
            var lineSubTotalExTax = lineSubTotal; // SubTotal excluding tax (same as SubTotal for now)
            
            // Calculate local currency fields (using CurrencyRate from DO)
            var localSubTotal = lineSubTotal * currencyRate;
            var localSubTotalExTax = localSubTotal;
            
            // Calculate tax per line based on TaxCode
            decimal lineTax = 0;
            decimal lineTaxableAmt = lineSubTotal; // Always set to SubTotal (even when no tax)
            decimal? lineTaxRate = null;
            if (!string.IsNullOrWhiteSpace(taxCode) && lineSubTotal > 0)
            {
                // Get tax rate from TaxCode table
                var taxRateQuery = "SELECT TaxRate FROM TaxCode WHERE TaxCode = @TaxCode AND IsActive = 'Y'";
                var taxRateResult = await _dbService.ExecuteScalarAsync<decimal?>(taxRateQuery,
                    new Dictionary<string, object> { { "TaxCode", taxCode } });
                
                if (taxRateResult.HasValue && taxRateResult.Value > 0)
                {
                    lineTaxRate = taxRateResult.Value; // Store as percentage (e.g., 6.00 for 6%)
                    decimal lineTaxRateDecimal = taxRateResult.Value / 100; // Convert percentage to decimal
                    lineTax = lineSubTotal * lineTaxRateDecimal;
                }
            }
            
            // Calculate local tax and tax currency fields (line-level variables)
            // Always calculate these fields even when tax is 0
            var lineLocalTax = lineTax * currencyRate;
            var lineTaxCurrencyTax = lineTax * toTaxCurrencyRate; // Will be 0 if no tax, not NULL
            var lineLocalTaxableAmt = lineTaxableAmt * currencyRate; // Always set
            var lineTaxCurrencyTaxableAmt = lineTaxableAmt * toTaxCurrencyRate; // Always set
            
            // Location from DO.SalesLocation (we set it to 'HQ')
            string? location = "HQ"; // From DO.SalesLocation

            // Generate DtlKey (get next available DtlKey)
            var getNextDtlKeyQuery = "SELECT ISNULL(MAX(DtlKey), 0) + 1 FROM DODTL";
            var dtlKey = await _dbService.ExecuteScalarAsync<long>(getNextDtlKeyQuery);

            var lineInsertQuery = @"
                INSERT INTO DODTL (
                    DtlKey, DocKey, Seq, ItemCode, Description, Qty, Rate, UnitPrice, UOM, UserUOM,
                    SmallestQty, Location, AccNo,
                    Discount, DiscountAmt, SubTotal, SubTotalExTax,
                    LocalSubTotal, LocalSubTotalExTax,
                    TaxCode, TaxRate, Tax, TaxableAmt,
                    LocalTax, LocalTaxableAmt,
                    TaxCurrencyTax, TaxCurrencyTaxableAmt,
                    MainItem, TransferedQty, Transferable, 
                    PrintOut, DtlType, AddToSubTotal, DeliveryDate, Guid
                )
                VALUES (
                    @DtlKey, @DocKey, @Seq, @ItemCode, @Description, @Qty, @Rate, @UnitPrice, @UOM, @UserUOM,
                    @SmallestQty, @Location, @AccNo,
                    @Discount, @DiscountAmt, @SubTotal, @SubTotalExTax,
                    @LocalSubTotal, @LocalSubTotalExTax,
                    @TaxCode, @TaxRate, @Tax, @TaxableAmt,
                    @LocalTax, @LocalTaxableAmt,
                    @TaxCurrencyTax, @TaxCurrencyTaxableAmt,
                    'T', 0, 'T', 'T', 'N', 'T', @DeliveryDate, NEWID()
                )
            ";

            var lineParams = new Dictionary<string, object>
            {
                { "DtlKey", dtlKey },
                { "DocKey", docKey },
                { "Seq", seq++ },
                { "ItemCode", line.ItemCode },
                { "Description", (object?)line.Description ?? DBNull.Value },
                { "Qty", line.Quantity },
                { "Rate", rate }, // Base rate from ItemUOM (usually 1 for conversion)
                { "UnitPrice", line.UnitPrice }, // Actual selling price from request
                { "UOM", (object?)uom ?? DBNull.Value },
                { "UserUOM", (object?)uom ?? DBNull.Value }, // UserUOM same as UOM
                { "SmallestQty", line.Quantity }, // SmallestQty same as Qty
                { "Location", location ?? "HQ" }, // Ensure Location is always set
                { "AccNo", (object?)accNo ?? DBNull.Value },
                { "Discount", (object?)line.Discount ?? DBNull.Value },
                { "DiscountAmt", discountAmt },
                { "SubTotal", lineSubTotal },
                { "SubTotalExTax", lineSubTotalExTax },
                { "LocalSubTotal", localSubTotal },
                { "LocalSubTotalExTax", localSubTotalExTax },
                { "TaxCode", (object?)taxCode ?? DBNull.Value },
                { "TaxRate", (object?)lineTaxRate ?? DBNull.Value },
                { "Tax", lineTax },
                { "TaxableAmt", lineTaxableAmt }, // Always set to SubTotal (even when no tax)
                { "LocalTax", lineLocalTax },
                { "LocalTaxableAmt", lineLocalTaxableAmt }, // Always set
                { "TaxCurrencyTax", lineTaxCurrencyTax }, // 0 when no tax, not NULL
                { "TaxCurrencyTaxableAmt", lineTaxCurrencyTaxableAmt }, // Always set
                { "DeliveryDate", request.DocDate } // Set to document date
            };

            await _dbService.ExecuteNonQueryAsync(lineInsertQuery, lineParams);
        }

        // Totals are already set in the INSERT statement, no need to update

        _logger.LogInformation("Created draft delivery order: DocKey={DocKey}, DocNo={DocNo}", docKey, docNo);

        // Mark idempotency key as processed if provided
        if (!string.IsNullOrEmpty(request.IdempotencyKey))
        {
            await _idempotencyService.MarkAsProcessedAsync(request.IdempotencyKey, "CreateDraftDeliveryOrder", docKey, docNo);
        }

        return (await GetDeliveryOrderAsync(docKey))!;
    }

    public async Task<DeliveryOrder> UpdateDraftDeliveryOrderAsync(long docKey, UpdateDeliveryOrderRequest request)
    {
        var deliveryOrder = await GetDeliveryOrderAsync(docKey);
        if (deliveryOrder == null)
        {
            throw new InvalidOperationException($"Delivery order with DocKey '{docKey}' not found");
        }

        if (deliveryOrder.Status != "Draft")
        {
            throw new InvalidOperationException($"Cannot update delivery order. Status is '{deliveryOrder.Status}', must be 'Draft'");
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
                UPDATE DO
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
                "DELETE FROM DODTL WHERE DocKey = @DocKey",
                new Dictionary<string, object> { { "DocKey", docKey } }
            );

            // Tax calculation is now per-line based on TaxCode, no need for global taxEnabled flag

            // Get currency rates from existing DO document
            var getCurrencyQuery = "SELECT CurrencyRate, ToTaxCurrencyRate, SalesLocation FROM DO WHERE DocKey = @DocKey";
            var currencyResult = await _dbService.ExecuteQueryAsync(getCurrencyQuery, new Dictionary<string, object> { { "DocKey", docKey } });
            decimal currencyRate = 1.0m;
            decimal toTaxCurrencyRate = 1.0m;
            string? location = "HQ";
            if (currencyResult.Rows.Count > 0)
            {
                var currencyRow = currencyResult.Rows[0];
                if (currencyRow["CurrencyRate"] != DBNull.Value)
                    currencyRate = Convert.ToDecimal(currencyRow["CurrencyRate"]);
                if (currencyRow["ToTaxCurrencyRate"] != DBNull.Value)
                    toTaxCurrencyRate = Convert.ToDecimal(currencyRow["ToTaxCurrencyRate"]);
                if (currencyRow["SalesLocation"] != DBNull.Value)
                    location = currencyRow["SalesLocation"]?.ToString() ?? "HQ";
            }

            // Insert new lines
            decimal total = 0;
            int seq = 1;

            foreach (var line in request.Lines)
            {
                // Fetch item details (UOM, TaxCode, Rate, ItemGroup) for this line
                var getItemQuery = @"
                    SELECT SalesUOM, TaxCode, ItemGroup,
                           ISNULL((SELECT TOP 1 Price FROM ItemUOM WHERE ItemCode = Item.ItemCode AND UOM = Item.SalesUOM), 0) as Rate
                    FROM Item 
                    WHERE ItemCode = @ItemCode AND (IsActive = 'Y' OR IsActive = 'T')
                ";
                var itemParams = new Dictionary<string, object> { { "ItemCode", line.ItemCode } };
                var itemResult = await _dbService.ExecuteQueryAsync(getItemQuery, itemParams);

                if (itemResult.Rows.Count == 0)
                {
                    throw new InvalidOperationException($"Item '{line.ItemCode}' not found or inactive");
                }

                var itemRow = itemResult.Rows[0];
                string? uom = itemRow["SalesUOM"]?.ToString();
                string? itemGroup = itemRow["ItemGroup"]?.ToString();
                // Use TaxCode from request line, or fallback to item's TaxCode
                string? taxCodeRaw = !string.IsNullOrWhiteSpace(line.TaxCode) 
                    ? line.TaxCode 
                    : itemRow["TaxCode"]?.ToString();
                // Validate TaxCode exists in TaxCode table to prevent FK constraint violation
                string? taxCode = await ValidateTaxCodeAsync(taxCodeRaw);
                // Use Rate from ItemUOM if available, otherwise use UnitPrice from request
                decimal rate = itemRow["Rate"] != DBNull.Value && Convert.ToDecimal(itemRow["Rate"]) > 0 
                    ? Convert.ToDecimal(itemRow["Rate"]) 
                    : line.UnitPrice;

                // Get AccNo from ItemGroup.SalesCode (for sales documents like DO)
                string? accNo = null;
                if (!string.IsNullOrWhiteSpace(itemGroup))
                {
                    var accNoQuery = @"
                        SELECT TOP 1 SalesCode FROM ItemGroup 
                        WHERE ItemGroup = @ItemGroup
                    ";
                    accNo = await _dbService.ExecuteScalarAsync<string>(accNoQuery,
                        new Dictionary<string, object> { { "ItemGroup", itemGroup } });
                }

                // Calculate line totals
                var lineAmountBeforeDiscount = line.Quantity * line.UnitPrice;
                var discountPercent = line.Discount ?? 0;
                var discountAmt = lineAmountBeforeDiscount * (discountPercent / 100);
                var lineSubTotal = lineAmountBeforeDiscount - discountAmt;
                var lineSubTotalExTax = lineSubTotal; // SubTotal excluding tax (same as SubTotal for now)
                total += lineSubTotal;
                
                // Calculate local currency fields (using CurrencyRate from DO)
                var localSubTotal = lineSubTotal * currencyRate;
                var localSubTotalExTax = localSubTotal;
                
                // Calculate tax per line based on TaxCode
                decimal lineTax = 0;
                decimal lineTaxableAmt = lineSubTotal; // Always set to SubTotal (even when no tax)
                decimal? lineTaxRate = null;
                if (!string.IsNullOrWhiteSpace(taxCode) && lineSubTotal > 0)
                {
                    // Get tax rate from TaxCode table
                    var taxRateQuery = "SELECT TaxRate FROM TaxCode WHERE TaxCode = @TaxCode AND IsActive = 'Y'";
                    var taxRateResult = await _dbService.ExecuteScalarAsync<decimal?>(taxRateQuery,
                        new Dictionary<string, object> { { "TaxCode", taxCode } });
                    
                    if (taxRateResult.HasValue && taxRateResult.Value > 0)
                    {
                        lineTaxRate = taxRateResult.Value; // Store as percentage (e.g., 6.00 for 6%)
                        decimal lineTaxRateDecimal = taxRateResult.Value / 100; // Convert percentage to decimal
                        lineTax = lineSubTotal * lineTaxRateDecimal;
                    }
                }
                
                // Calculate local tax and tax currency fields (line-level variables)
                // Always calculate these fields even when tax is 0
                var lineLocalTax = lineTax * currencyRate;
                var lineTaxCurrencyTax = lineTax * toTaxCurrencyRate; // Will be 0 if no tax, not NULL
                var lineLocalTaxableAmt = lineTaxableAmt * currencyRate; // Always set
                var lineTaxCurrencyTaxableAmt = lineTaxableAmt * toTaxCurrencyRate; // Always set

                // Generate DtlKey (get next available DtlKey)
                var getNextDtlKeyQuery = "SELECT ISNULL(MAX(DtlKey), 0) + 1 FROM DODTL";
                var dtlKey = await _dbService.ExecuteScalarAsync<long>(getNextDtlKeyQuery);

                var lineInsertQuery = @"
                    INSERT INTO DODTL (
                        DtlKey, DocKey, Seq, ItemCode, Description, Qty, Rate, UnitPrice, UOM, UserUOM,
                        SmallestQty, Location, AccNo,
                        Discount, DiscountAmt, SubTotal, SubTotalExTax,
                        LocalSubTotal, LocalSubTotalExTax,
                        TaxCode, TaxRate, Tax, TaxableAmt,
                        LocalTax, LocalTaxableAmt,
                        TaxCurrencyTax, TaxCurrencyTaxableAmt,
                        MainItem, TransferedQty, Transferable, 
                        PrintOut, DtlType, AddToSubTotal, DeliveryDate, Guid
                    )
                    VALUES (
                        @DtlKey, @DocKey, @Seq, @ItemCode, @Description, @Qty, @Rate, @UnitPrice, @UOM, @UserUOM,
                        @SmallestQty, @Location, @AccNo,
                        @Discount, @DiscountAmt, @SubTotal, @SubTotalExTax,
                        @LocalSubTotal, @LocalSubTotalExTax,
                        @TaxCode, @TaxRate, @Tax, @TaxableAmt,
                        @LocalTax, @LocalTaxableAmt,
                        @TaxCurrencyTax, @TaxCurrencyTaxableAmt,
                        'T', 0, 'T', 'T', 'N', 'T', @DeliveryDate, NEWID()
                    )
                ";

                // Get DocDate from DO table for DeliveryDate
                var getDocDateQuery = "SELECT DocDate FROM DO WHERE DocKey = @DocKey";
                var docDateResult = await _dbService.ExecuteScalarAsync<DateTime?>(getDocDateQuery,
                    new Dictionary<string, object> { { "DocKey", docKey } });
                var deliveryDate = docDateResult ?? DateTime.Now;

                var lineParams = new Dictionary<string, object>
                {
                    { "DtlKey", dtlKey },
                    { "DocKey", docKey },
                    { "Seq", seq++ },
                    { "ItemCode", line.ItemCode },
                    { "Description", (object?)line.Description ?? DBNull.Value },
                    { "Qty", line.Quantity },
                    { "Rate", rate }, // Base rate from ItemUOM (usually 1 for conversion)
                    { "UnitPrice", line.UnitPrice }, // Actual selling price from request
                    { "UOM", (object?)uom ?? DBNull.Value },
                    { "UserUOM", (object?)uom ?? DBNull.Value }, // UserUOM same as UOM
                    { "SmallestQty", line.Quantity }, // SmallestQty same as Qty
                    { "Location", location ?? "HQ" }, // Ensure Location is always set
                    { "AccNo", (object?)accNo ?? DBNull.Value },
                    { "Discount", (object?)line.Discount ?? DBNull.Value },
                    { "DiscountAmt", discountAmt },
                    { "SubTotal", lineSubTotal },
                    { "SubTotalExTax", lineSubTotalExTax },
                    { "LocalSubTotal", localSubTotal },
                    { "LocalSubTotalExTax", localSubTotalExTax },
                    { "TaxCode", (object?)taxCode ?? DBNull.Value },
                    { "TaxRate", (object?)lineTaxRate ?? DBNull.Value },
                    { "Tax", lineTax },
                    { "TaxableAmt", lineTaxableAmt }, // Always set to SubTotal (even when no tax)
                    { "LocalTax", lineLocalTax },
                    { "LocalTaxableAmt", lineLocalTaxableAmt }, // Always set
                    { "TaxCurrencyTax", lineTaxCurrencyTax }, // 0 when no tax, not NULL
                    { "TaxCurrencyTaxableAmt", lineTaxCurrencyTaxableAmt }, // Always set
                    { "DeliveryDate", deliveryDate } // Set to document date
                };

                await _dbService.ExecuteNonQueryAsync(lineInsertQuery, lineParams);
            }

            // Update totals
            await _dbService.ExecuteNonQueryAsync(
                "UPDATE DO SET Total = @Total WHERE DocKey = @DocKey",
                new Dictionary<string, object> { { "Total", total }, { "DocKey", docKey } }
            );
        }

        _logger.LogInformation("Updated draft delivery order: DocKey={DocKey}", docKey);

        return (await GetDeliveryOrderAsync(docKey))!;
    }

    public async Task<bool> PostDeliveryOrderAsync(long docKey)
    {
        var deliveryOrder = await GetDeliveryOrderAsync(docKey);
        if (deliveryOrder == null)
        {
            throw new InvalidOperationException($"Delivery order with DocKey '{docKey}' not found");
        }

        if (deliveryOrder.Status != "Draft")
        {
            throw new InvalidOperationException($"Cannot post delivery order. Status is '{deliveryOrder.Status}', must be 'Draft'");
        }

        // TODO: Call AutoCount posting logic here
        // For now, just update status to Posted
        var query = @"
            UPDATE DO
            SET DocStatus = 'P', PostToStock = 'T', LastModified = @LastModified
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
            _logger.LogInformation("Posted delivery order: DocKey={DocKey}", docKey);
        }

        return rowsAffected > 0;
    }

    public async Task<bool> VoidDeliveryOrderAsync(long docKey)
    {
        var deliveryOrder = await GetDeliveryOrderAsync(docKey);
        if (deliveryOrder == null)
        {
            throw new InvalidOperationException($"Delivery order with DocKey '{docKey}' not found");
        }

        // TODO: Call AutoCount void logic here
        // For now, just set Cancelled flag
        var query = @"
            UPDATE DO
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
            _logger.LogInformation("Voided delivery order: DocKey={DocKey}", docKey);
        }

        return rowsAffected > 0;
    }

    public async Task<bool> IsDraftAsync(long docKey)
    {
        var query = "SELECT DocStatus FROM DO WHERE DocKey = @DocKey";
        var parameters = new Dictionary<string, object> { { "DocKey", docKey } };
        var status = await _dbService.ExecuteScalarAsync<string>(query, parameters);
        return status?.Trim() == "D";
    }

    private async Task<List<DeliveryOrderLine>> GetDeliveryOrderLinesAsync(long docKey)
    {
        var query = @"
            SELECT 
                DtlKey, ItemCode, Description, Qty, UnitPrice, 
                Discount, SubTotal
            FROM DODTL
            WHERE DocKey = @DocKey
            ORDER BY Seq
        ";

        var parameters = new Dictionary<string, object> { { "DocKey", docKey } };
        var result = await _dbService.ExecuteQueryAsync(query, parameters);

        return result.Rows.Cast<DataRow>().Select(row => new DeliveryOrderLine
        {
            DtlKey = Convert.ToInt64(row["DtlKey"]),
            ItemCode = row["ItemCode"].ToString() ?? "",
            Description = row["Description"]?.ToString(),
            Quantity = Convert.ToDecimal(row["Qty"]),
            UnitPrice = Convert.ToDecimal(row["UnitPrice"]),
            Discount = row["Discount"] != DBNull.Value ? Convert.ToDecimal(row["Discount"]) : null,
            LineTotal = Convert.ToDecimal(row["SubTotal"])
        }).ToList();
    }

    private static DeliveryOrder MapDeliveryOrder(DataRow row)
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

        return new DeliveryOrder
        {
            // Basic fields
            DocKey = Convert.ToInt64(row["DocKey"]),
            DocNo = row["DocNo"].ToString() ?? "",
            DocDate = Convert.ToDateTime(row["DocDate"]),
            DebtorCode = row["DebtorCode"].ToString() ?? "",
            DebtorName = row["DebtorName"]?.ToString(),
            Status = status,
            Total = row["Total"] != DBNull.Value ? Convert.ToDecimal(row["Total"]) : null,
            CreatedAt = row["CreatedTimeStamp"] != DBNull.Value ? Convert.ToDateTime(row["CreatedTimeStamp"]) : DateTime.MinValue,
            PostedAt = status == "Posted" && row["LastModified"] != DBNull.Value ? Convert.ToDateTime(row["LastModified"]) : null,
            
            // Address fields
            InvAddr1 = row["InvAddr1"]?.ToString(),
            InvAddr2 = row["InvAddr2"]?.ToString(),
            InvAddr3 = row["InvAddr3"]?.ToString(),
            InvAddr4 = row["InvAddr4"]?.ToString(),
            
            // Document fields
            Ref = row["Ref"]?.ToString(),
            Description = row["Description"]?.ToString(),
            DisplayTerm = row["DisplayTerm"]?.ToString(),
            
            // Currency fields
            CurrencyCode = row["CurrencyCode"]?.ToString(),
            CurrencyRate = row["CurrencyRate"] != DBNull.Value ? Convert.ToDecimal(row["CurrencyRate"]) : null,
            ToTaxCurrencyRate = row["ToTaxCurrencyRate"] != DBNull.Value ? Convert.ToDecimal(row["ToTaxCurrencyRate"]) : null,
            
            // Financial fields
            TotalExTax = row["TotalExTax"] != DBNull.Value ? Convert.ToDecimal(row["TotalExTax"]) : null,
            NetTotal = row["NetTotal"] != DBNull.Value ? Convert.ToDecimal(row["NetTotal"]) : null,
            LocalNetTotal = row["LocalNetTotal"] != DBNull.Value ? Convert.ToDecimal(row["LocalNetTotal"]) : null,
            AnalysisNetTotal = row["AnalysisNetTotal"] != DBNull.Value ? Convert.ToDecimal(row["AnalysisNetTotal"]) : null,
            LocalAnalysisNetTotal = row["LocalAnalysisNetTotal"] != DBNull.Value ? Convert.ToDecimal(row["LocalAnalysisNetTotal"]) : null,
            Tax = row["Tax"] != DBNull.Value ? Convert.ToDecimal(row["Tax"]) : null,
            LocalTax = row["LocalTax"] != DBNull.Value ? Convert.ToDecimal(row["LocalTax"]) : null,
            TaxCurrencyTax = row["TaxCurrencyTax"] != DBNull.Value ? Convert.ToDecimal(row["TaxCurrencyTax"]) : null,
            ExTax = row["ExTax"] != DBNull.Value ? Convert.ToDecimal(row["ExTax"]) : null,
            LocalExTax = row["LocalExTax"] != DBNull.Value ? Convert.ToDecimal(row["LocalExTax"]) : null,
            TaxableAmt = row["TaxableAmt"] != DBNull.Value ? Convert.ToDecimal(row["TaxableAmt"]) : null,
            LocalTaxableAmt = row["LocalTaxableAmt"] != DBNull.Value ? Convert.ToDecimal(row["LocalTaxableAmt"]) : null,
            
            // Footer fields
            Footer1Amt = row["Footer1Amt"] != DBNull.Value ? Convert.ToDecimal(row["Footer1Amt"]) : null,
            Footer2Amt = row["Footer2Amt"] != DBNull.Value ? Convert.ToDecimal(row["Footer2Amt"]) : null,
            Footer3Amt = row["Footer3Amt"] != DBNull.Value ? Convert.ToDecimal(row["Footer3Amt"]) : null,
            
            // Settings fields
            SalesLocation = row["SalesLocation"]?.ToString(),
            CalcDiscountOnUnitPrice = row["CalcDiscountOnUnitPrice"]?.ToString(),
            MultiPrice = row["MultiPrice"]?.ToString(),
            TaxEntityID = row["TaxEntityID"] != DBNull.Value ? Convert.ToInt32(row["TaxEntityID"]) : null,
            PostToStock = row["PostToStock"]?.ToString(),
            Transferable = row["Transferable"]?.ToString(),
            SalesAgent = row["SalesAgent"]?.ToString(),
            BranchCode = row["BranchCode"]?.ToString(),
            Cancelled = row["Cancelled"]?.ToString(),
            DocStatus = row["DocStatus"]?.ToString(),
            Note = row["Note"]?.ToString(),
            Remark1 = row["Remark1"]?.ToString(),
            Remark2 = row["Remark2"]?.ToString(),
            Remark3 = row["Remark3"]?.ToString(),
            Remark4 = row["Remark4"]?.ToString(),
            Guid = row["Guid"] != DBNull.Value && row["Guid"] != null ? (Guid?)row["Guid"] : null,
            YourPONo = row["YourPONo"]?.ToString(),
            YourPODate = row["YourPODate"] != DBNull.Value ? Convert.ToDateTime(row["YourPODate"]) : null,
            ShipVia = row["ShipVia"]?.ToString(),
            ShipInfo = row["ShipInfo"]?.ToString(),
            Phone1 = row["Phone1"]?.ToString(),
            Fax1 = row["Fax1"]?.ToString(),
            Attention = row["Attention"]?.ToString(),
            DeliverAddr1 = row["DeliverAddr1"]?.ToString(),
            DeliverAddr2 = row["DeliverAddr2"]?.ToString(),
            DeliverAddr3 = row["DeliverAddr3"]?.ToString(),
            DeliverAddr4 = row["DeliverAddr4"]?.ToString(),
            InclusiveTax = row["InclusiveTax"]?.ToString(),
            RoundingMethod = row["RoundingMethod"] != DBNull.Value ? Convert.ToInt32(row["RoundingMethod"]) : null,
            LastUpdate = row["LastUpdate"] != DBNull.Value ? Convert.ToInt32(row["LastUpdate"]) : null,
            Footer1Param = row["Footer1Param"] != DBNull.Value ? Convert.ToDecimal(row["Footer1Param"]) : null,
            Footer1TaxCode = row["Footer1TaxCode"]?.ToString(),
            Footer2Param = row["Footer2Param"] != DBNull.Value ? Convert.ToDecimal(row["Footer2Param"]) : null,
            Footer2TaxCode = row["Footer2TaxCode"]?.ToString(),
            Footer3Param = row["Footer3Param"] != DBNull.Value ? Convert.ToDecimal(row["Footer3Param"]) : null,
            Footer3TaxCode = row["Footer3TaxCode"]?.ToString(),
            Footer1Tax = row["Footer1Tax"] != DBNull.Value ? Convert.ToDecimal(row["Footer1Tax"]) : null,
            Footer2Tax = row["Footer2Tax"] != DBNull.Value ? Convert.ToDecimal(row["Footer2Tax"]) : null,
            Footer3Tax = row["Footer3Tax"] != DBNull.Value ? Convert.ToDecimal(row["Footer3Tax"]) : null,
            ExternalLink = row["ExternalLink"]?.ToString(),
            RefDocNo = row["RefDocNo"]?.ToString(),
            PrintCount = row["PrintCount"] != DBNull.Value ? Convert.ToInt32(row["PrintCount"]) : null,
            CreatedUserID = row["CreatedUserID"]?.ToString(),
            LastModifiedUserID = row["LastModifiedUserID"]?.ToString(),
            LastModified = row["LastModified"] != DBNull.Value ? Convert.ToDateTime(row["LastModified"]) : null,
        };
    }

    private async Task<string> GenerateDocNoAsync(string? branchPrefix = null)
    {
        // Use branch prefix if provided, otherwise default to "DO-"
        var prefix = string.IsNullOrWhiteSpace(branchPrefix) ? "DO-" : $"{branchPrefix.Trim()}-";
        
        // Find the maximum sequence number by parsing existing DocNo values with this prefix
        // This ensures uniqueness even with concurrent requests
        var query = $@"
            SELECT DocNo
            FROM DO 
            WHERE DocNo LIKE @Pattern
            ORDER BY DocKey DESC
        ";
        
        var pattern = $"{prefix}%";
        var parameters = new Dictionary<string, object> { { "Pattern", pattern } };
        var result = await _dbService.ExecuteQueryAsync(query, parameters);
        int nextSeq = 1;
        
        // Parse all DocNo values to find the maximum sequence number
        // This handles edge cases where DocNo might not match expected format
        foreach (DataRow row in result.Rows)
        {
            var docNo = row["DocNo"].ToString() ?? "";
            if (docNo.StartsWith(prefix))
            {
                var seqPart = docNo.Substring(prefix.Length);
                // Only parse if it's purely numeric (handles "000001" but not "EST-000004" or "2026-0005")
                if (seqPart.All(char.IsDigit) && int.TryParse(seqPart, out int seq))
                {
                    if (seq >= nextSeq)
                    {
                        nextSeq = seq + 1;
                    }
                }
            }
        }
        
        // Check if the generated DocNo already exists (race condition protection)
        string candidateDocNo;
        int attempts = 0;
        do
        {
            candidateDocNo = $"{prefix}{nextSeq:D6}"; // 6 digits: SOTP1-000001 or DO-000001
            var existsQuery = "SELECT COUNT(*) FROM DO WHERE DocNo = @DocNo";
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

    public async Task<string> GetNextDeliveryOrderNumberAsync()
    {
        return await GenerateDocNoAsync(null);
    }

    public async Task<string> GetNextDeliveryOrderNumberAsync(string? branchPrefix)
    {
        return await GenerateDocNoAsync(branchPrefix);
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

    /// <summary>
    /// Validates that a TaxCode exists in the TaxCode table. Returns the TaxCode if valid, otherwise returns null.
    /// This prevents foreign key constraint violations.
    /// </summary>
    private async Task<string?> ValidateTaxCodeAsync(string? taxCode)
    {
        // If TaxCode is null or empty, return null (no FK constraint violation)
        if (string.IsNullOrWhiteSpace(taxCode))
            return null;

        // Check if TaxCode exists in TaxCode table
        var query = "SELECT COUNT(*) FROM TaxCode WHERE TaxCode = @TaxCode";
        var parameters = new Dictionary<string, object> { { "TaxCode", taxCode } };
        var count = await _dbService.ExecuteScalarAsync<int>(query, parameters);

        // If TaxCode exists, return it; otherwise return null to avoid FK constraint violation
        if (count > 0)
            return taxCode;

        _logger.LogWarning("TaxCode '{TaxCode}' does not exist in TaxCode table, setting to NULL to avoid FK constraint violation", taxCode);
        return null;
    }
}

