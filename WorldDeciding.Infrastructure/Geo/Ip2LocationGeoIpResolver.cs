using IP2Location;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Net;
using WorldDeciding.Application.Common.Interfaces;

namespace WorldDeciding.Infrastructure.Geo;

public class Ip2LocationGeoIpResolver : IGeoIpResolver
{
    private readonly ILogger<Ip2LocationGeoIpResolver> _logger;
    private readonly Component? _db;

    public Ip2LocationGeoIpResolver(IConfiguration config, ILogger<Ip2LocationGeoIpResolver> logger)
    {
        _logger = logger;

        // appsettings.json -> "GeoIp:DatabasePath": "IP2LOCATION-LITE-DB1.BIN"
        var configuredPath = config["GeoIp:DatabasePath"];
        var path = string.IsNullOrWhiteSpace(configuredPath)
            ? Path.Combine(AppContext.BaseDirectory, "IP2LOCATION-LITE-DB1.BIN")
            : configuredPath;

        if (!File.Exists(path))
        {
            _logger.LogWarning("IP2Location database file not found at {Path}. GeoIP will be disabled.", path);
            _db = null;
            return;
        }

        try
        {
            _db = new Component();
            _db.Open(path);
            _logger.LogInformation("IP2Location database loaded from {Path}", path);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load IP2Location database from {Path}", path);
            _db = null;
        }
    }

    public Task<(string? countryIso2, double confidence, string provider)>
        ResolveAsync(IPAddress ip, CancellationToken ct = default)
    {
        if (_db == null)
        {
            return Task.FromResult<(string?, double, string)>((null, 0.0, "Ip2LocationDisabled"));
        }

        try
        {
            // IP string'e
            var ipString = ip.ToString();

            // DB1 -> CountryShort (ISO2) verir
            var rec = _db.IPQuery(ipString);
            if (rec == null || rec.CountryShort == "-" || string.IsNullOrWhiteSpace(rec.CountryShort))
            {
                return Task.FromResult<(string?, double, string)>((null, 0.0, "Ip2LocationLite"));
            }

            var iso2 = rec.CountryShort; // Örn: "TR"
            return Task.FromResult<(string?, double, string)>((iso2, 0.7, "Ip2LocationLite"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "IP2Location lookup failed for IP {Ip}", ip);
            return Task.FromResult<(string?, double, string)>((null, 0.0, "Ip2LocationError"));
        }
    }
}
