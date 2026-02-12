namespace WorldDeciding.Application.Common.Interfaces;

public interface IAbuseStore
{
    Task<long> IncrementAndGetAsync(string key, TimeSpan ttl, CancellationToken ct);
}
