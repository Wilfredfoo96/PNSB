using AutoCountApi.Models;
using AutoCountApi.Services;
using Microsoft.AspNetCore.Mvc;

namespace AutoCountApi.Controllers;

[ApiController]
[Route("api/v1/settings")]
public class SettingsController : ControllerBase
{
    private readonly ISettingsService _settingsService;
    private readonly ILogger<SettingsController> _logger;

    public SettingsController(ISettingsService settingsService, ILogger<SettingsController> logger)
    {
        _settingsService = settingsService;
        _logger = logger;
    }

    [HttpGet("tax-codes")]
    public async Task<ActionResult<ApiResponse<List<TaxCodeDto>>>> GetTaxCodes()
    {
        try
        {
            var taxCodes = await _settingsService.GetTaxCodesAsync();
            return Ok(ApiResponse<List<TaxCodeDto>>.Ok(taxCodes));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting tax codes");
            return StatusCode(500, ApiResponse<List<TaxCodeDto>>.CreateError("Error", ex.Message));
        }
    }

    [HttpPost("tax-codes")]
    public async Task<ActionResult<ApiResponse<TaxCodeDto>>> CreateTaxCode([FromBody] CreateTaxCodeRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.TaxCode))
            {
                return BadRequest(ApiResponse<TaxCodeDto>.CreateError("Validation error", "TaxCode is required"));
            }

            var taxCode = await _settingsService.CreateTaxCodeAsync(request);
            return CreatedAtAction(nameof(GetTaxCodes), new { }, ApiResponse<TaxCodeDto>.Ok(taxCode));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse<TaxCodeDto>.CreateError("Conflict", ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating tax code");
            return StatusCode(500, ApiResponse<TaxCodeDto>.CreateError("Error", ex.Message));
        }
    }

    [HttpGet("classifications")]
    public async Task<ActionResult<ApiResponse<List<ClassificationDto>>>> GetClassifications()
    {
        try
        {
            var classifications = await _settingsService.GetClassificationsAsync();
            return Ok(ApiResponse<List<ClassificationDto>>.Ok(classifications));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting classifications");
            return StatusCode(500, ApiResponse<List<ClassificationDto>>.CreateError("Error", ex.Message));
        }
    }

    [HttpPost("classifications")]
    public async Task<ActionResult<ApiResponse<ClassificationDto>>> CreateClassification([FromBody] CreateClassificationRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Code))
            {
                return BadRequest(ApiResponse<ClassificationDto>.CreateError("Validation error", "Code is required"));
            }

            var classification = await _settingsService.CreateClassificationAsync(request);
            return CreatedAtAction(nameof(GetClassifications), new { }, ApiResponse<ClassificationDto>.Ok(classification));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse<ClassificationDto>.CreateError("Conflict", ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating classification");
            return StatusCode(500, ApiResponse<ClassificationDto>.CreateError("Error", ex.Message));
        }
    }
}
