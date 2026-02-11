using AutoCountApi.Models;

namespace AutoCountApi.Services;

public interface IDeliveryOrderService
{
    Task<List<DeliveryOrder>> GetDeliveryOrdersAsync(int page = 1, int pageSize = 50, string? search = null, string? status = null);
    Task<int> GetDeliveryOrderCountAsync(string? search = null, string? status = null);
    Task<DeliveryOrder?> GetDeliveryOrderAsync(long docKey);
    Task<DeliveryOrder?> GetDeliveryOrderByDocNoAsync(string docNo);
    Task<DeliveryOrder> CreateDraftDeliveryOrderAsync(CreateDeliveryOrderRequest request);
    Task<DeliveryOrder> UpdateDraftDeliveryOrderAsync(long docKey, UpdateDeliveryOrderRequest request);
    Task<bool> PostDeliveryOrderAsync(long docKey);
    Task<bool> VoidDeliveryOrderAsync(long docKey);
    Task<bool> IsDraftAsync(long docKey);
    Task<string> GetNextDeliveryOrderNumberAsync();
}

