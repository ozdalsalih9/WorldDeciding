using Microsoft.AspNetCore.Http;
using System.Net;
using WorldDeciding.Application.Common.Interfaces;

namespace WorldDeciding.Services;

public class ClientContext : IClientContext
{
    private readonly IHttpContextAccessor _http;
    private readonly HashSet<string> _trustedProxies;

    public ClientContext(IHttpContextAccessor http, IConfiguration cfg)
    {
        _http = http;
        _trustedProxies = cfg.GetSection("Networking:TrustedProxies").Get<string[]>()?.ToHashSet()
                          ?? new HashSet<string>();
    }

    public IPAddress? ClientIp
    {
        get
        {
            var ctx = _http.HttpContext;
            if (ctx is null) return null;

            // Güvenilir proxy varsa X-Forwarded-For'un ilk IP'sini al
            var remoteIp = ctx.Connection.RemoteIpAddress;
            var headers = ctx.Request.Headers;

            if (remoteIp is not null && _trustedProxies.Contains(remoteIp.ToString()) &&
                headers.TryGetValue("X-Forwarded-For", out var xff))
            {
                var first = xff.ToString().Split(',').Select(s => s.Trim()).FirstOrDefault();
                if (IPAddress.TryParse(first, out var ipFromHeader))
                    return ipFromHeader;
            }

            return remoteIp;
        }
    }

    public string? DeclaredCountryIso2
    {
        get
        {
            // İleride: authenticated kullanıcıdan profil CountryCode çekilebilir.
            // Şimdilik boş (veya header ile geçici test).
            var ctx = _http.HttpContext;
            if (ctx is null) return null;

            if (ctx.Request.Headers.TryGetValue("X-User-Country", out var h))
                return h.ToString();

            return null;
        }
    }
}
