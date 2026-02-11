using AutoCountApi.Models;

namespace AutoCountApi.Services;

public interface ISettingsService
{
    Task<List<TaxCodeDto>> GetTaxCodesAsync();
    Task<TaxCodeDto> CreateTaxCodeAsync(CreateTaxCodeRequest request);
    Task<List<ClassificationDto>> GetClassificationsAsync();
    Task<ClassificationDto> CreateClassificationAsync(CreateClassificationRequest request);
}
