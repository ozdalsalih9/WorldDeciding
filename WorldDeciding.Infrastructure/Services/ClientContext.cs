using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using System.Net;
using System.Net.Sockets;
using WorldDeciding.Application.Common.Interfaces;

namespace WorldDeciding.Services;

public class ClientContext : IClientContext
{
    private readonly IHttpContextAccessor _http;
    private readonly IConfiguration _config;

    public ClientContext(IHttpContextAccessor http, IConfiguration config)
    {
        _http = http;
        _config = config;
    }

    public string? DeclaredCountryIso2 =>
        _http.HttpContext?.Request.Headers["X-Country"].FirstOrDefault();

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
            var forwardedIp = TryReadForwardedFor(context, remoteIp);
            return forwardedIp ?? remoteIp;
        }
    }

    private static IPAddress? TryReadForwardedFor(HttpContext? context, IPAddress? remoteIp)
    {
        if (context == null || remoteIp == null || !IsPrivateOrLoopback(remoteIp))
        {
            return null;
        }

        var forwardedFor = context.Request.Headers["X-Forwarded-For"].ToString();
        if (string.IsNullOrWhiteSpace(forwardedFor))
        {
            return null;
        }

        foreach (var candidate in forwardedFor.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (IPAddress.TryParse(candidate, out var parsedIp))
            {
                return parsedIp;
            }
        }

        return null;
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
