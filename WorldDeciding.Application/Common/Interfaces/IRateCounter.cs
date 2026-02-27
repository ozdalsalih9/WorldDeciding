namespace WorldDeciding.Application.Common.Interfaces;

public interface IRateCounter
{
    Task<long> IncrementAsync(string key, TimeSpan ttl, int limit, TimeSpan window, CancellationToken ct);

}
