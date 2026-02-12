using StackExchange.Redis;
using WorldDeciding.Application.Common.Interfaces;

namespace WorldDeciding.Infrastructure.Security;

public sealed class RedisRateCounter : IRateCounter
{
    private readonly IConnectionMultiplexer _mux;
    public RedisRateCounter(IConnectionMultiplexer mux) => _mux = mux;

    public async Task<long> IncrementAsync(string key, TimeSpan ttl, CancellationToken ct)
    {
        var db = _mux.GetDatabase();

        var val = await db.StringIncrementAsync(key);

        if (val == 1)
            await db.KeyExpireAsync(key, ttl);

        return val;
    }
}
