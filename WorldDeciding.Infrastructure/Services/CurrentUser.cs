using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using WorldDeciding.Application.Common.Interfaces;

namespace WorldDeciding.Infrastructure.Services;

public class CurrentUser : ICurrentUser
{
    private readonly IHttpContextAccessor _http;

    public CurrentUser(IHttpContextAccessor http)
    {
        _http = http;
    }

    public bool IsAuthenticated =>
        _http.HttpContext?.User?.Identity?.IsAuthenticated == true;

    public Guid? UserId
    {
        get
        {
            var user = _http.HttpContext?.User;
            if (user is null) return null;

            // JWT’de genelde sub veya NameIdentifier olur
            var idStr =
                user.FindFirstValue(ClaimTypes.NameIdentifier) ??
                user.FindFirstValue("sub") ??
                user.FindFirstValue("userId");

            return Guid.TryParse(idStr, out var id) ? id : null;
        }
    }
}
