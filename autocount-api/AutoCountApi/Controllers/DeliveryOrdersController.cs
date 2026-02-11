using AutoCountApi.Models;
using AutoCountApi.Services;
using Microsoft.AspNetCore.Mvc;

namespace AutoCountApi.Controllers;

[ApiController]
[Route("api/v1/delivery-orders")]
public class DeliveryOrdersController : ControllerBase
{
    private readonly IDeliveryOrderService _deliveryOrderService;
    private readonly ILogger<DeliveryOrdersController> _logger;

    public DeliveryOrdersController(IDeliveryOrderService deliveryOrderService, ILogger<DeliveryOrdersController> logger)
    {
        _deliveryOrderService = deliveryOrderService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PaginatedResponse<DeliveryOrder>>>> GetDeliveryOrders(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null)
    {
        try
        {
            var deliveryOrders = await _deliveryOrderService.GetDeliveryOrdersAsync(page, pageSize, search, status);
            var total = await _deliveryOrderService.GetDeliveryOrderCountAsync(search, status);
            var response = new PaginatedResponse<DeliveryOrder>
            {
                Items = deliveryOrders,
                Page = page,
                PageSize = pageSize,
                Total = total
            };
            return Ok(ApiResponse<PaginatedResponse<DeliveryOrder>>.Ok(response));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting delivery orders");
            return StatusCode(500, ApiResponse<PaginatedResponse<DeliveryOrder>>.CreateError("Internal server error", ex.Message));
        }
    }

    [HttpGet("next-number")]
    public async Task<ActionResult<ApiResponse<string>>> GetNextDeliveryOrderNumber()
    {
        try
        {
            var nextNumber = await _deliveryOrderService.GetNextDeliveryOrderNumberAsync();
            return Ok(ApiResponse<string>.Ok(nextNumber));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting next delivery order number");
            return StatusCode(500, ApiResponse<string>.CreateError("Internal server error", ex.Message));
        }
    }

    [HttpGet("{docKey}")]
    public async Task<ActionResult<ApiResponse<DeliveryOrder>>> GetDeliveryOrder(long docKey)
    {
        try
        {
            var deliveryOrder = await _deliveryOrderService.GetDeliveryOrderAsync(docKey);
            
            if (deliveryOrder == null)
            {
                return NotFound(ApiResponse<DeliveryOrder>.CreateError("Delivery order not found", $"Delivery order with DocKey '{docKey}' not found"));
            }

            return Ok(ApiResponse<DeliveryOrder>.Ok(deliveryOrder));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting delivery order {DocKey}", docKey);
            return StatusCode(500, ApiResponse<DeliveryOrder>.CreateError("Internal server error", ex.Message));
        }
    }

    [HttpGet("docno/{docNo}")]
    public async Task<ActionResult<ApiResponse<DeliveryOrder>>> GetDeliveryOrderByDocNo(string docNo)
    {
        try
        {
            var deliveryOrder = await _deliveryOrderService.GetDeliveryOrderByDocNoAsync(docNo);
            
            if (deliveryOrder == null)
            {
                return NotFound(ApiResponse<DeliveryOrder>.CreateError("Delivery order not found", $"Delivery order with DocNo '{docNo}' not found"));
            }

            return Ok(ApiResponse<DeliveryOrder>.Ok(deliveryOrder));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting delivery order {DocNo}", docNo);
            return StatusCode(500, ApiResponse<DeliveryOrder>.CreateError("Internal server error", ex.Message));
        }
    }

    [HttpPost("draft")]
    public async Task<ActionResult<ApiResponse<DeliveryOrder>>> CreateDraftDeliveryOrder([FromBody] CreateDeliveryOrderRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.DebtorCode))
            {
                return BadRequest(ApiResponse<DeliveryOrder>.CreateError("Validation error", "DebtorCode is required"));
            }

            if (request.Lines == null || request.Lines.Count == 0)
            {
                return BadRequest(ApiResponse<DeliveryOrder>.CreateError("Validation error", "At least one line item is required"));
            }

            var deliveryOrder = await _deliveryOrderService.CreateDraftDeliveryOrderAsync(request);
            return CreatedAtAction(nameof(GetDeliveryOrder), new { docKey = deliveryOrder.DocKey }, 
                ApiResponse<DeliveryOrder>.Ok(deliveryOrder, "Draft delivery order created successfully"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<DeliveryOrder>.CreateError("Validation error", ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating draft delivery order");
            return StatusCode(500, ApiResponse<DeliveryOrder>.CreateError("Internal server error", ex.Message));
        }
    }

    [HttpPut("{docKey}")]
    public async Task<ActionResult<ApiResponse<DeliveryOrder>>> UpdateDraftDeliveryOrder(long docKey, [FromBody] UpdateDeliveryOrderRequest request)
    {
        try
        {
            var deliveryOrder = await _deliveryOrderService.UpdateDraftDeliveryOrderAsync(docKey, request);
            return Ok(ApiResponse<DeliveryOrder>.Ok(deliveryOrder, "Draft delivery order updated successfully"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<DeliveryOrder>.CreateError("Validation error", ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating draft delivery order {DocKey}", docKey);
            return StatusCode(500, ApiResponse<DeliveryOrder>.CreateError("Internal server error", ex.Message));
        }
    }

    [HttpPost("{docKey}/post")]
    public async Task<ActionResult<ApiResponse<bool>>> PostDeliveryOrder(long docKey)
    {
        try
        {
            var posted = await _deliveryOrderService.PostDeliveryOrderAsync(docKey);
            
            if (!posted)
            {
                return BadRequest(ApiResponse<bool>.CreateError("Posting failed", "Delivery order could not be posted"));
            }

            return Ok(ApiResponse<bool>.Ok(true, "Delivery order posted successfully"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<bool>.CreateError("Validation error", ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error posting delivery order {DocKey}", docKey);
            return StatusCode(500, ApiResponse<bool>.CreateError("Internal server error", ex.Message));
        }
    }

    [HttpPost("{docKey}/void")]
    public async Task<ActionResult<ApiResponse<bool>>> VoidDeliveryOrder(long docKey)
    {
        try
        {
            var voided = await _deliveryOrderService.VoidDeliveryOrderAsync(docKey);
            
            if (!voided)
            {
                return BadRequest(ApiResponse<bool>.CreateError("Void failed", "Delivery order could not be voided"));
            }

            return Ok(ApiResponse<bool>.Ok(true, "Delivery order voided successfully"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<bool>.CreateError("Validation error", ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error voiding delivery order {DocKey}", docKey);
            return StatusCode(500, ApiResponse<bool>.CreateError("Internal server error", ex.Message));
        }
    }
}

