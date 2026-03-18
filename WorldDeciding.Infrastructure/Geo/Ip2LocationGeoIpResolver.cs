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

    public Ip2LocationGeoIpResolver(
        IConfiguration config,
        ILogger<Ip2LocationGeoIpResolver> logger)
    {
        _logger = logger;

        var configuredPath = config["GeoIp:DatabasePath"];
        var contentRootPath = Directory.GetCurrentDirectory();
        var path = ResolveDatabasePath(configuredPath, contentRootPath);

        if (path == null)
        {
            _logger.LogWarning(
                "IP2Location database file not found. Checked configured path '{ConfiguredPath}', content root '{ContentRoot}', and app base '{AppBase}'. GeoIP will be disabled.",
                configuredPath,
                contentRootPath,
                AppContext.BaseDirectory);
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

    public Task<(string? countryIso2, double confidence, string provider)> ResolveAsync(IPAddress ip, CancellationToken ct = default)
    {
        if (_db == null)
        {
            return Task.FromResult<(string?, double, string)>((null, 0.0, "Ip2LocationDisabled"));
        }

        try
        {
            var ipString = ip.ToString();
            var rec = _db.IPQuery(ipString);
            if (rec == null || rec.CountryShort == "-" || string.IsNullOrWhiteSpace(rec.CountryShort))
            {
                return Task.FromResult<(string?, double, string)>((null, 0.0, "Ip2LocationLite"));
            }

            return Task.FromResult<(string?, double, string)>((rec.CountryShort, 0.7, "Ip2LocationLite"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "IP2Location lookup failed for IP {Ip}", ip);
            return Task.FromResult<(string?, double, string)>((null, 0.0, "Ip2LocationError"));
        }
    }

    private static string? ResolveDatabasePath(string? configuredPath, string contentRootPath)
    {
        var candidates = new List<string>();

        if (!string.IsNullOrWhiteSpace(configuredPath))
        {
            candidates.Add(configuredPath);

            if (!Path.IsPathRooted(configuredPath))
            {
                candidates.Add(Path.Combine(contentRootPath, configuredPath));
                candidates.Add(Path.Combine(AppContext.BaseDirectory, configuredPath));
            }
        }
        else
        {
            candidates.Add(Path.Combine(contentRootPath, "IP2LOCATION-LITE-DB1", "IP2LOCATION-LITE-DB1.BIN"));
            candidates.Add(Path.Combine(AppContext.BaseDirectory, "IP2LOCATION-LITE-DB1", "IP2LOCATION-LITE-DB1.BIN"));
            candidates.Add(Path.Combine(AppContext.BaseDirectory, "IP2LOCATION-LITE-DB1.BIN"));
        }

        return candidates
            .Select(Path.GetFullPath)
            .FirstOrDefault(File.Exists);
    }
}
