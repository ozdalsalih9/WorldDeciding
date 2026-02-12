using StackExchange.Redis;

namespace WorldDeciding.Infrastructure.Security;

public interface IRedisCounter
{
    Task<long> IncrementAsync(string key, TimeSpan ttl, CancellationToken ct);
}

public sealed class RedisCounter : IRedisCounter
{
    private readonly IConnectionMultiplexer _mux;

    public RedisCounter(IConnectionMultiplexer mux) => _mux = mux;

    public async Task<long> IncrementAsync(string key, TimeSpan ttl, CancellationToken ct)
    {
        // NOTE: StackExchange.Redis cancellation token native değil -> sadece await ile taşıyoruz 
        var db = _mux.GetDatabase();

        // INCR
        var val = await db.StringIncrementAsync(key);

        // TTL sadece ilk oluşturulduğunda (val == 1 iken) set edelim
        if (val == 1)
            await db.KeyExpireAsync(key, ttl);

        return val;
    }
}
