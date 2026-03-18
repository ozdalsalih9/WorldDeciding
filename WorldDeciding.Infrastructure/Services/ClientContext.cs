using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using System.Net;
using System.Net.Sockets;
using WorldDeciding.Application.Common.Interfaces;

namespace WorldDeciding.Services;

public class ClientContext : IClientContext
{
    private static readonly string[] IpHeaderPriority =
    {
        "CF-Connecting-IP",
        "True-Client-IP",
        "X-Real-IP",
        "X-Forwarded-For"
    };

    private readonly IHttpContextAccessor _http;
    private readonly IConfiguration _config;

    public ClientContext(IHttpContextAccessor http, IConfiguration config)
    {
        _http = http;
        _config = config;
    }

    public string? DeclaredCountryIso2
    {
        get
        {
            var context = _http.HttpContext;
            if (!CanTrustProxyHeaders(context))
            {
                return null;
            }

            return context?.Request.Headers["X-Country"].FirstOrDefault();
        }
    }

    public IPAddress? ClientIp
    {
        get
        {
            var overrideIp = _config["GeoIp:DevelopmentIpOverride"];
            if (!string.IsNullOrWhiteSpace(overrideIp) && IPAddress.TryParse(overrideIp, out var parsedOverrideIp))
            {
                return parsedOverrideIp;
            }

            var context = _http.HttpContext;
            var remoteIp = context?.Connection.RemoteIpAddress;
            var forwardedIp = CanTrustProxyHeaders(context)
                ? TryReadProxyIp(context)
                : null;

            if (forwardedIp is not null)
            {
                return forwardedIp;
            }

            return remoteIp;
        }
    }

    private static IPAddress? TryReadProxyIp(HttpContext? context)
    {
        if (context == null)
        {
            return null;
        }

        foreach (var headerName in IpHeaderPriority)
        {
            var headerValue = context.Request.Headers[headerName].ToString();
            if (string.IsNullOrWhiteSpace(headerValue))
            {
                continue;
            }

            var parsed = ParseFirstIp(headerValue);
            if (parsed is not null)
            {
                return parsed;
            }
        }

        return null;
    }

    private static IPAddress? ParseFirstIp(string headerValue)
    {
        IPAddress? firstParsed = null;

        foreach (var rawCandidate in headerValue.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var candidate = rawCandidate.Trim();
            if (candidate.StartsWith("for=", StringComparison.OrdinalIgnoreCase))
            {
                candidate = candidate[4..].Trim('"');
            }

            if (!IPAddress.TryParse(candidate, out var parsedIp))
            {
                continue;
            }

            firstParsed ??= parsedIp;
            if (!IsPrivateOrLoopback(parsedIp))
            {
                return parsedIp;
            }
        }

        return firstParsed;
    }

    private bool CanTrustProxyHeaders(HttpContext? context)
    {
        var remoteIp = context?.Connection.RemoteIpAddress;
        if (remoteIp is null)
        {
            return false;
        }

        if (IsPrivateOrLoopback(remoteIp))
        {
            return true;
        }

        var trustedProxies = _config
            .GetSection("Networking:TrustedProxies")
            .GetChildren()
            .Select(section => section.Value)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value!.Trim())
            .ToArray();

        foreach (var trustedProxy in trustedProxies)
        {
            if (IPAddress.TryParse(trustedProxy, out var parsedProxyIp) && parsedProxyIp.Equals(remoteIp))
            {
                return true;
            }
        }

        return false;
    }

    private static bool IsPrivateOrLoopback(IPAddress address)
    {
        if (IPAddress.IsLoopback(address))
        {
            return true;
        }

        if (address.AddressFamily == AddressFamily.InterNetworkV6)
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
