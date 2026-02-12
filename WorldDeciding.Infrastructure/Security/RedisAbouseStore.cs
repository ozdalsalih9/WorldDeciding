using StackExchange.Redis;
using WorldDeciding.Application.Common.Interfaces;

namespace WorldDeciding.Infrastructure.Security;

public sealed class RedisAbuseStore : IAbuseStore
{
    private readonly IDatabase _db;

    public RedisAbuseStore(IConnectionMultiplexer mux)
    {
        _db = mux.GetDatabase();
    }

    public async Task<long> IncrementAndGetAsync(string key, TimeSpan ttl, CancellationToken ct)
    {
        // Redis INCR
        var val = await _db.StringIncrementAsync(key);

        // TTL yoksa set et (ilk kez oluştuysa)
        var currentTtl = await _db.KeyTimeToLiveAsync(key);
        if (currentTtl is null)
            await _db.KeyExpireAsync(key, ttl);

        return val;
    }
}
