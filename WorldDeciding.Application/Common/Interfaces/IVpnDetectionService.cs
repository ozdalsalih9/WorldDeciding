using System.Net;

namespace WorldDeciding.Application.Common.Interfaces;

public interface IVpnDetectionService
{
    Task<VpnDetectionResult> CheckAsync(
        IPAddress? ip,
        string? userAgent,
        string? acceptLanguage,
        CancellationToken ct = default);
}

public sealed record VpnDetectionResult(
    bool IsAvailable,
    bool ShouldBlock,
    string Provider,
    string? RiskReason,
    bool Vpn = false,
    bool Proxy = false,
    bool Tor = false,
    bool Hosting = false,
    int? FraudScore = null,
    string? CountryCode = null,
    string? Message = null);
