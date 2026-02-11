using AutoCountApi.Models;
using AutoCountApi.Services;
using Microsoft.AspNetCore.Mvc;

namespace AutoCountApi.Controllers;

[ApiController]
[Route("api/v1/debtors")]
public class DebtorsController : ControllerBase
{
    private readonly IDebtorService _debtorService;
    private readonly ILogger<DebtorsController> _logger;

    public DebtorsController(IDebtorService debtorService, ILogger<DebtorsController> logger)
    {
        _debtorService = debtorService;
        _logger = logger;
    }

    /// <summary>
    /// Get a list of debtors (customers)
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PaginatedResponse<Debtor>>>> GetDebtors(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null)
    {
        try
        {
            var debtors = await _debtorService.GetDebtorsAsync(page, pageSize, search);
            var total = await _debtorService.GetDebtorCountAsync(search);
            
            var response = new PaginatedResponse<Debtor>
            {
                Items = debtors,
                Page = page,
                PageSize = pageSize,
                Total = total
            };

            return Ok(ApiResponse<PaginatedResponse<Debtor>>.Ok(response));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting debtors");
            return StatusCode(500, ApiResponse<PaginatedResponse<Debtor>>.CreateError("Internal server error", ex.Message));
        }
    }

    /// <summary>
    /// Get a specific debtor by account number
    /// </summary>
    [HttpGet("{accNo}")]
    public async Task<ActionResult<ApiResponse<Debtor>>> GetDebtor(string accNo)
    {
        try
        {
            var debtor = await _debtorService.GetDebtorAsync(accNo);
            
            if (debtor == null)
            {
                return NotFound(ApiResponse<Debtor>.CreateError("Debtor not found", $"Debtor with AccNo '{accNo}' not found"));
            }

            return Ok(ApiResponse<Debtor>.Ok(debtor));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting debtor {AccNo}", accNo);
            return StatusCode(500, ApiResponse<Debtor>.CreateError("Internal server error", ex.Message));
        }
    }

    /// <summary>
    /// Create a new debtor
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<Debtor>>> CreateDebtor([FromBody] CreateDebtorRequest request)
    {
        try
        {
            var debtor = await _debtorService.CreateDebtorAsync(request);
            return CreatedAtAction(nameof(GetDebtor), new { accNo = debtor.AccNo }, 
                ApiResponse<Debtor>.Ok(debtor, "Debtor created successfully"));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse<Debtor>.CreateError("Conflict", ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating debtor");
            return StatusCode(500, ApiResponse<Debtor>.CreateError("Internal server error", ex.Message));
        }
    }

    /// <summary>
    /// Update an existing debtor
    /// </summary>
    [HttpPut("{accNo}")]
    public async Task<ActionResult<ApiResponse<Debtor>>> UpdateDebtor(string accNo, [FromBody] UpdateDebtorRequest request)
    {
        try
        {
            var debtor = await _debtorService.UpdateDebtorAsync(accNo, request);
            return Ok(ApiResponse<Debtor>.Ok(debtor, "Debtor updated successfully"));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse<Debtor>.CreateError("Not found", ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating debtor {AccNo}", accNo);
            return StatusCode(500, ApiResponse<Debtor>.CreateError("Internal server error", ex.Message));
        }
    }

    /// <summary>
    /// Soft delete a debtor (set inactive)
    /// </summary>
    [HttpDelete("{accNo}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteDebtor(string accNo)
    {
        try
        {
            var deleted = await _debtorService.DeleteDebtorAsync(accNo);
            
            if (!deleted)
            {
                return NotFound(ApiResponse<bool>.CreateError("Not found", $"Debtor with AccNo '{accNo}' not found"));
            }

            return Ok(ApiResponse<bool>.Ok(true, "Debtor deleted successfully"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting debtor {AccNo}", accNo);
            return StatusCode(500, ApiResponse<bool>.CreateError("Internal server error", ex.Message));
        }
    }
}

