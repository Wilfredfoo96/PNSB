using AutoCountApi.Models;

namespace AutoCountApi.Services;

public interface IItemService
{
    Task<Item?> GetItemAsync(string itemCode);
    Task<List<Item>> GetItemsAsync(int page = 1, int pageSize = 50, string? search = null, bool activeOnly = true);
    Task<int> GetItemCountAsync(string? search = null, bool activeOnly = true);
    Task<Item> CreateItemAsync(CreateItemRequest request);
    Task<Item> UpdateItemAsync(string itemCode, UpdateItemRequest request);
    Task<bool> DeleteItemAsync(string itemCode); // Soft delete
    Task<bool> ItemExistsAsync(string itemCode);
}

