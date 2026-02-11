using AutoCountApi.Models;
using AutoCountApi.Services;
using Microsoft.AspNetCore.Mvc;

namespace AutoCountApi.Controllers;

[ApiController]
[Route("api/v1/invoices")]
public class InvoicesController : ControllerBase
{
    private readonly IInvoiceService _invoiceService;
    private readonly ILogger<InvoicesController> _logger;

    public InvoicesController(IInvoiceService invoiceService, ILogger<InvoicesController> logger)
    {
        _invoiceService = invoiceService;
        _logger = logger;
    }

    /// <summary>
    /// Get a list of invoices
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PaginatedResponse<Invoice>>>> GetInvoices(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null)
    {
        try
        {
            var invoices = await _invoiceService.GetInvoicesAsync(page, pageSize, search, status);
            var total = await _invoiceService.GetInvoiceCountAsync(search, status);
            
            var response = new PaginatedResponse<Invoice>
            {
                Items = invoices,
                Page = page,
                PageSize = pageSize,
                Total = total
            };

            return Ok(ApiResponse<PaginatedResponse<Invoice>>.Ok(response));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting invoices");
            return StatusCode(500, ApiResponse<PaginatedResponse<Invoice>>.CreateError("Internal server error", ex.Message));
        }
    }

    [HttpGet("{docKey}")]
    public async Task<ActionResult<ApiResponse<Invoice>>> GetInvoice(long docKey)
    {
        try
        {
            var invoice = await _invoiceService.GetInvoiceAsync(docKey);
            
            if (invoice == null)
            {
                return NotFound(ApiResponse<Invoice>.CreateError("Invoice not found", $"Invoice with DocKey '{docKey}' not found"));
            }

            return Ok(ApiResponse<Invoice>.Ok(invoice));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting invoice {DocKey}", docKey);
            return StatusCode(500, ApiResponse<Invoice>.CreateError("Internal server error", ex.Message));
        }
    }

    [HttpGet("docno/{docNo}")]
    public async Task<ActionResult<ApiResponse<Invoice>>> GetInvoiceByDocNo(string docNo)
    {
        try
        {
            var invoice = await _invoiceService.GetInvoiceByDocNoAsync(docNo);
            
            if (invoice == null)
            {
                return NotFound(ApiResponse<Invoice>.CreateError("Invoice not found", $"Invoice with DocNo '{docNo}' not found"));
            }

            return Ok(ApiResponse<Invoice>.Ok(invoice));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting invoice {DocNo}", docNo);
            return StatusCode(500, ApiResponse<Invoice>.CreateError("Internal server error", ex.Message));
        }
    }

    [HttpPost("draft")]
    public async Task<ActionResult<ApiResponse<Invoice>>> CreateDraftInvoice([FromBody] CreateInvoiceRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.DebtorCode))
            {
                return BadRequest(ApiResponse<Invoice>.CreateError("Validation error", "DebtorCode is required"));
            }

            if (request.Lines == null || request.Lines.Count == 0)
            {
                return BadRequest(ApiResponse<Invoice>.CreateError("Validation error", "At least one line item is required"));
            }

            var invoice = await _invoiceService.CreateDraftInvoiceAsync(request);
            return CreatedAtAction(nameof(GetInvoice), new { docKey = invoice.DocKey }, 
                ApiResponse<Invoice>.Ok(invoice, "Draft invoice created successfully"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<Invoice>.CreateError("Validation error", ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating draft invoice");
            return StatusCode(500, ApiResponse<Invoice>.CreateError("Internal server error", ex.Message));
        }
    }

    [HttpPut("{docKey}")]
    public async Task<ActionResult<ApiResponse<Invoice>>> UpdateDraftInvoice(long docKey, [FromBody] UpdateInvoiceRequest request)
    {
        try
        {
            var invoice = await _invoiceService.UpdateDraftInvoiceAsync(docKey, request);
            return Ok(ApiResponse<Invoice>.Ok(invoice, "Draft invoice updated successfully"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<Invoice>.CreateError("Validation error", ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating draft invoice {DocKey}", docKey);
            return StatusCode(500, ApiResponse<Invoice>.CreateError("Internal server error", ex.Message));
        }
    }

    [HttpPost("{docKey}/post")]
    public async Task<ActionResult<ApiResponse<bool>>> PostInvoice(long docKey)
    {
        try
        {
            var posted = await _invoiceService.PostInvoiceAsync(docKey);
            
            if (!posted)
            {
                return BadRequest(ApiResponse<bool>.CreateError("Posting failed", "Invoice could not be posted"));
            }

            return Ok(ApiResponse<bool>.Ok(true, "Invoice posted successfully"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<bool>.CreateError("Validation error", ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error posting invoice {DocKey}", docKey);
            return StatusCode(500, ApiResponse<bool>.CreateError("Internal server error", ex.Message));
        }
    }

    [HttpPost("{docKey}/void")]
    public async Task<ActionResult<ApiResponse<bool>>> VoidInvoice(long docKey)
    {
        try
        {
            var voided = await _invoiceService.VoidInvoiceAsync(docKey);
            
            if (!voided)
            {
                return BadRequest(ApiResponse<bool>.CreateError("Void failed", "Invoice could not be voided"));
            }

            return Ok(ApiResponse<bool>.Ok(true, "Invoice voided successfully"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<bool>.CreateError("Validation error", ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error voiding invoice {DocKey}", docKey);
            return StatusCode(500, ApiResponse<bool>.CreateError("Internal server error", ex.Message));
        }
    }
}

