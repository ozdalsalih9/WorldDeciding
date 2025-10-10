using MaxMind.GeoIP2;
using Microsoft.Extensions.Configuration;
using System.Net;
using WorldDeciding.Application.Common.Interfaces;

namespace WorldDeciding.Infrastructure.Geo;

public class MaxMindGeoIpResolver : IGeoIpResolver, IDisposable
{
    private readonly DatabaseReader _reader;

    public MaxMindGeoIpResolver(IConfiguration config)
    {
        var dbPath = config["GeoIP:DbPath"]
                     ?? throw new InvalidOperationException("GeoIP:DbPath not configured");
        _reader = new DatabaseReader(dbPath);
    }

    public Task<(string? countryIso2, double confidence, string provider)> ResolveAsync(IPAddress ip, CancellationToken ct = default)
    {
        try
        {
            var resp = _reader.Country(ip);
            var iso = resp?.Country?.IsoCode; // örn "TR"
            return Task.FromResult((iso, iso is null ? 0.0 : 0.9, "MaxMind"));
        }
        catch
        {
            return Task.FromResult<(string?, double, string)>((null, 0.0, "MaxMind"));
        }
    }

    public void Dispose() => _reader?.Dispose();
}
