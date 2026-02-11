using AutoCountApi.Models;
using AutoCountApi.Services;
using Microsoft.AspNetCore.Mvc;

namespace AutoCountApi.Controllers;

[ApiController]
[Route("api/v1/items")]
public class ItemsController : ControllerBase
{
    private readonly IItemService _itemService;
    private readonly ILogger<ItemsController> _logger;

    public ItemsController(IItemService itemService, ILogger<ItemsController> logger)
    {
        _itemService = itemService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PaginatedResponse<Item>>>> GetItems(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] bool activeOnly = true)
    {
        try
        {
            var items = await _itemService.GetItemsAsync(page, pageSize, search, activeOnly);
            var total = await _itemService.GetItemCountAsync(search, activeOnly);
            var response = new PaginatedResponse<Item>
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                Total = total
            };

            return Ok(ApiResponse<PaginatedResponse<Item>>.Ok(response));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting items");
            return StatusCode(500, ApiResponse<PaginatedResponse<Item>>.CreateError("Internal server error", ex.Message));
        }
    }

    [HttpGet("{itemCode}")]
    public async Task<ActionResult<ApiResponse<Item>>> GetItem(string itemCode)
    {
        try
        {
            var item = await _itemService.GetItemAsync(itemCode);
            
            if (item == null)
            {
                return NotFound(ApiResponse<Item>.CreateError("Item not found", $"Item with ItemCode '{itemCode}' not found"));
            }

            return Ok(ApiResponse<Item>.Ok(item));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting item {ItemCode}", itemCode);
            return StatusCode(500, ApiResponse<Item>.CreateError("Internal server error", ex.Message));
        }
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<Item>>> CreateItem([FromBody] CreateItemRequest request)
    {
        try
        {
            var item = await _itemService.CreateItemAsync(request);
            return CreatedAtAction(nameof(GetItem), new { itemCode = item.ItemCode }, 
                ApiResponse<Item>.Ok(item, "Item created successfully"));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse<Item>.CreateError("Conflict", ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating item");
            return StatusCode(500, ApiResponse<Item>.CreateError("Internal server error", ex.Message));
        }
    }

    [HttpPut("{itemCode}")]
    public async Task<ActionResult<ApiResponse<Item>>> UpdateItem(string itemCode, [FromBody] UpdateItemRequest request)
    {
        try
        {
            var item = await _itemService.UpdateItemAsync(itemCode, request);
            return Ok(ApiResponse<Item>.Ok(item, "Item updated successfully"));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse<Item>.CreateError("Not found", ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating item {ItemCode}", itemCode);
            return StatusCode(500, ApiResponse<Item>.CreateError("Internal server error", ex.Message));
        }
    }

    [HttpDelete("{itemCode}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteItem(string itemCode)
    {
        try
        {
            var deleted = await _itemService.DeleteItemAsync(itemCode);
            
            if (!deleted)
            {
                return NotFound(ApiResponse<bool>.CreateError("Not found", $"Item with ItemCode '{itemCode}' not found"));
            }

            return Ok(ApiResponse<bool>.Ok(true, "Item deleted successfully"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting item {ItemCode}", itemCode);
            return StatusCode(500, ApiResponse<bool>.CreateError("Internal server error", ex.Message));
        }
    }
}

