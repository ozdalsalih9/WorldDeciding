using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using WorldDeciding.Application.Common.Interfaces;

namespace WorldDeciding.Infrastructure.Security;

public sealed class IpQualityScoreVpnDetectionService : IVpnDetectionService
{
    public const string ProviderName = "IpQualityScore";

    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly ILogger<IpQualityScoreVpnDetectionService> _logger;

    public IpQualityScoreVpnDetectionService(
        HttpClient http,
        IConfiguration config,
        ILogger<IpQualityScoreVpnDetectionService> logger)
    {
        _http = http;
        _config = config;
        _logger = logger;
    }

    public async Task<VpnDetectionResult> CheckAsync(
        IPAddress? ip,
        string? userAgent,
        string? acceptLanguage,
        CancellationToken ct = default)
    {
        if (!IsEnabled())
        {
            return new VpnDetectionResult(false, false, "Disabled", null);
        }

        if (!string.Equals(GetProvider(), ProviderName, StringComparison.OrdinalIgnoreCase))
        {
            return new VpnDetectionResult(false, false, GetProvider(), "provider_not_configured");
        }

        if (ip is null)
        {
            return FailureResult("ip_unavailable", "Client IP could not be determined.");
        }

        var inspectedIp = ip;
        if (IsPrivateOrLoopback(ip))
        {
            if (!GetBoolConfig("VpnDetection:ResolvePublicIpForPrivateClients", false))
            {
                return new VpnDetectionResult(true, false, ProviderName, null);
            }

            var publicIp = await ResolvePublicIpAsync(ct);
            if (publicIp is null)
            {
                return FailureResult("public_ip_unavailable", "Public client IP could not be determined.");
            }

            inspectedIp = publicIp;
        }

        var apiKey = _config["VpnDetection:ApiKey"]?.Trim();
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            _logger.LogWarning("VPN detection is enabled but VpnDetection:ApiKey is missing.");
            return FailureResult("api_key_missing", "VPN detection is not configured.");
        }

        var timeoutSeconds = Math.Clamp(GetIntConfig("VpnDetection:TimeoutSeconds", 3), 1, 15);

        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));

            var strictness = Math.Clamp(GetIntConfig("VpnDetection:Strictness", 2), 0, 3);
            var url = BuildRequestUrl(apiKey, inspectedIp, userAgent, acceptLanguage, strictness);
            using var response = await _http.GetAsync(url, timeout.Token);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "IPQualityScore VPN lookup failed with status {StatusCode} for IP {Ip}.",
                    (int)response.StatusCode,
                    inspectedIp);
                return FailureResult("provider_http_error", "VPN detection provider returned an error.");
            }

            var document = await response.Content.ReadFromJsonAsync<JsonDocument>(cancellationToken: timeout.Token);
            if (document is null)
            {
                return FailureResult("provider_empty_response", "VPN detection provider returned an empty response.");
            }

            using (document)
            {
                return ParseIpQualityScoreResponse(document.RootElement, GetFraudScoreBlockThreshold());
            }
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            _logger.LogWarning("IPQualityScore VPN lookup timed out for IP {Ip}.", inspectedIp);
            return FailureResult("provider_timeout", "VPN detection provider timed out.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "IPQualityScore VPN lookup failed for IP {Ip}.", inspectedIp);
            return FailureResult("provider_error", "VPN detection provider failed.");
        }
    }

    public static VpnDetectionResult ParseIpQualityScoreResponse(JsonElement root, int fraudScoreBlockThreshold)
    {
        var success = GetBool(root, "success");
        if (success == false)
        {
            var providerMessage = GetString(root, "message");
            return new VpnDetectionResult(
                false,
                false,
                ProviderName,
                "provider_rejected",
                Message: providerMessage);
        }

        var proxy = GetBool(root, "proxy") == true;
        var vpn = GetBool(root, "vpn") == true || GetBool(root, "active_vpn") == true;
        var tor = GetBool(root, "tor") == true || GetBool(root, "active_tor") == true;
        var hosting = string.Equals(GetString(root, "connection_type"), "hosting", StringComparison.OrdinalIgnoreCase);
        var fraudScore = GetInt(root, "fraud_score");
        var countryCode = NormalizeCountryCode(GetString(root, "country_code"));

        var riskReasons = new List<string>();
        if (vpn) riskReasons.Add("vpn");
        if (proxy) riskReasons.Add("proxy");
        if (tor) riskReasons.Add("tor");
        if (hosting) riskReasons.Add("hosting");
        if (fraudScore is int score && score >= fraudScoreBlockThreshold)
        {
            riskReasons.Add("high_fraud_score");
        }

        var shouldBlock = riskReasons.Count > 0;

        return new VpnDetectionResult(
            true,
            shouldBlock,
            ProviderName,
            shouldBlock ? string.Join(",", riskReasons) : null,
            vpn,
            proxy,
            tor,
            hosting,
            fraudScore,
            countryCode);
    }

    private bool IsEnabled() => GetBoolConfig("VpnDetection:Enabled", false);

    private string GetProvider() => _config["VpnDetection:Provider"]?.Trim() ?? ProviderName;

    private int GetFraudScoreBlockThreshold()
    {
        var configured = GetIntConfig("VpnDetection:FraudScoreBlockThreshold", 85);
        return Math.Clamp(configured, 0, 100);
    }

    private VpnDetectionResult FailureResult(string riskReason, string message)
    {
        var shouldBlock = GetBoolConfig("VpnDetection:BlockOnLookupFailure", false);
        return new VpnDetectionResult(false, shouldBlock, ProviderName, riskReason, Message: message);
    }

    private bool GetBoolConfig(string key, bool fallback)
    {
        var raw = _config[key];
        return bool.TryParse(raw, out var parsed) ? parsed : fallback;
    }

    private int GetIntConfig(string key, int fallback)
    {
        var raw = _config[key];
        return int.TryParse(raw, out var parsed) ? parsed : fallback;
    }

    private static string BuildRequestUrl(
        string apiKey,
        IPAddress ip,
        string? userAgent,
        string? acceptLanguage,
        int strictness)
    {
        var query = new List<string>
        {
            $"strictness={strictness}",
            "allow_public_access_points=true",
            "lighter_penalties=false"
        };

        if (!string.IsNullOrWhiteSpace(userAgent))
        {
            query.Add($"user_agent={Uri.EscapeDataString(userAgent)}");
        }

        if (!string.IsNullOrWhiteSpace(acceptLanguage))
        {
            query.Add($"user_language={Uri.EscapeDataString(acceptLanguage)}");
        }

        return
            $"https://www.ipqualityscore.com/api/json/ip/{Uri.EscapeDataString(apiKey)}/{Uri.EscapeDataString(ip.ToString())}?{string.Join("&", query)}";
    }

    private async Task<IPAddress?> ResolvePublicIpAsync(CancellationToken ct)
    {
        var endpoint = _config["VpnDetection:PublicIpEndpoint"]?.Trim();
        if (string.IsNullOrWhiteSpace(endpoint))
        {
            endpoint = "https://api.ipify.org";
        }

        var timeoutSeconds = Math.Clamp(GetIntConfig("VpnDetection:TimeoutSeconds", 3), 1, 15);

        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));

            var raw = await _http.GetStringAsync(endpoint, timeout.Token);
            return IPAddress.TryParse(raw.Trim(), out var publicIp) && !IsPrivateOrLoopback(publicIp)
                ? publicIp
                : null;
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            _logger.LogWarning(ex, "Could not resolve public IP for VPN detection.");
            return null;
        }
    }

    private static bool? GetBool(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var value))
        {
            return null;
        }

        return value.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.String when bool.TryParse(value.GetString(), out var parsed) => parsed,
            _ => null
        };
    }

    private static int? GetInt(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var value))
        {
            return null;
        }

        if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number))
        {
            return number;
        }

        if (value.ValueKind == JsonValueKind.String && int.TryParse(value.GetString(), out var parsed))
        {
            return parsed;
        }

        return null;
    }

    private static string? GetString(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var value) || value.ValueKind == JsonValueKind.Null)
        {
            return null;
        }

        return value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : value.ToString();
    }

    private static string? NormalizeCountryCode(string? countryCode)
    {
        var normalized = countryCode?.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(normalized) || normalized.Length != 2 || !normalized.All(char.IsLetter))
        {
            return null;
        }

        return normalized;
    }

    private static bool IsPrivateOrLoopback(IPAddress address)
    {
        if (IPAddress.IsLoopback(address))
        {
            return true;
        }

        if (address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetworkV6)
        {
            return address.IsIPv6LinkLocal || address.IsIPv6SiteLocal || address.IsIPv6UniqueLocal;
        }

        var bytes = address.GetAddressBytes();
        return bytes[0] switch
        {
            10 => true,
            127 => true,
            169 when bytes[1] == 254 => true,
            172 when bytes[1] >= 16 && bytes[1] <= 31 => true,
            192 when bytes[1] == 168 => true,
            _ => false
        };
    }
}
