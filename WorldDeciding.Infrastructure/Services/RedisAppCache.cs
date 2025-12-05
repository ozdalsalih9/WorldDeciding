using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;
using WorldDeciding.Application.Common.Interfaces;

namespace WorldDeciding.Infrastructure.Services;

public class RedisAppCache : IAppCache
{
    private readonly IDistributedCache _distributedCache;
    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public RedisAppCache(IDistributedCache distributedCache)
    {
        _distributedCache = distributedCache;
    }

    public async Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default)
    {
        var data = await _distributedCache.GetStringAsync(key, cancellationToken);
        if (string.IsNullOrEmpty(data))
            return default;

        return JsonSerializer.Deserialize<T>(data, _jsonOptions);
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? ttl = null, CancellationToken cancellationToken = default)
    {
        var data = JsonSerializer.Serialize(value, _jsonOptions);

        var options = new DistributedCacheEntryOptions();
        if (ttl.HasValue)
        {
            options.SetAbsoluteExpiration(ttl.Value);
        }

        await _distributedCache.SetStringAsync(key, data, options, cancellationToken);
    }

    public async Task RemoveAsync(string key, CancellationToken cancellationToken = default)
    {
        await _distributedCache.RemoveAsync(key, cancellationToken);
    }
}
