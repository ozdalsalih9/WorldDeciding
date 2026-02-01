using Microsoft.AspNetCore.Http;

namespace WorldDeciding.Infrastructure.Extensions;

public static class HttpContextExtensions
{
    public static string GetClientIp(this HttpContext context)
    {
        return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }
}
