using Microsoft.AspNetCore.Http;
using System.Net;
using WorldDeciding.Application.Common.Interfaces;

namespace WorldDeciding.Services;

public class ClientContext : IClientContext
{
    private readonly IHttpContextAccessor _http;

    public ClientContext(IHttpContextAccessor http)
    {
        _http = http;
    }

    // Kullanıcı beyan ettiği ülke (fazla önemli değil şu an)
    public string? DeclaredCountryIso2 =>
        _http.HttpContext?.Request.Headers["X-Country"].FirstOrDefault();

    // 💡 Development ortamında fake IP, production’da gerçek IP
    public IPAddress? ClientIp
    {
        get
        {
#if DEBUG
            // Geliştirme ortamı → public bir IP döndür (ülke: US)
            return IPAddress.Parse("8.8.8.8");
#else
            // Production → gerçek kullanıcı IP'si
            return _http.HttpContext?.Connection.RemoteIpAddress;
#endif
        }
    }
}
