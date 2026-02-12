using WorldDeciding.Application.Common.Exceptions;

namespace WorldDeciding.Services;

public sealed class RateLimitExceptionMiddleware : IMiddleware
{
    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        try
        {
            await next(context);
        }
        catch (TooManyRequestsException ex)
        {
            context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
            context.Response.Headers["Retry-After"] = ex.RetryAfterSeconds.ToString();
            await context.Response.WriteAsJsonAsync(new { message = ex.Message });
        }
    }
}
