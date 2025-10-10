using System.Net;

namespace WorldDeciding.Application.Common.Interfaces;

public interface IGeoIpResolver
{
    // CountryIso2, Confidence (0..1), Provider
    Task<(string? countryIso2, double confidence, string provider)> ResolveAsync(IPAddress ip, CancellationToken ct = default);
}
