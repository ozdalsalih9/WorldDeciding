using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace WorldDeciding.Controllers;

[ApiController]
[Route("api/privacy")]
public class PrivacyController : ControllerBase
{
    public record ConsentReq(bool Analytics, bool Marketing);

    public record ConsentDto(bool Necessary, bool Analytics, bool Marketing, long Ts);

    private const string CookieName = "wd_consent";

    [HttpGet("consent")]
    public ActionResult<ConsentDto> GetConsent()
    {
        if (!Request.Cookies.TryGetValue(CookieName, out var raw) || string.IsNullOrWhiteSpace(raw))
            return NotFound();

        try
        {
            var dto = JsonSerializer.Deserialize<ConsentDto>(raw);
            return dto is null ? NotFound() : Ok(dto);
        }
        catch
        {
            return NotFound();
        }
    }

    [HttpPost("consent")]
    public ActionResult<ConsentDto> SetConsent([FromBody] ConsentReq req)
    {
        var dto = new ConsentDto(
            Necessary: true,
            Analytics: req.Analytics,
            Marketing: req.Marketing,
            Ts: DateTimeOffset.UtcNow.ToUnixTimeSeconds()
        );

        var json = JsonSerializer.Serialize(dto);

        // DEV/PROD cookie ayarı:
        // Prod’da (HTTPS) SameSite=None + Secure=true en sorunsuzudur (subdomain senaryosu).
        // Dev’de http/https karışık ise cookie tarayıcı tarafından bloklanabilir.
        var isDev = HttpContext.Request.Host.Host.Contains("localhost");

        var opts = new CookieOptions
        {
            Path = "/",
            HttpOnly = false,
            Secure = !isDev, // prod true
            SameSite = !isDev ? SameSiteMode.None : SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddDays(180)
        };

        Response.Cookies.Append(CookieName, json, opts);

        // ⭐ ÖNEMLİ: Cookie bloklansa bile UI çalışsın diye DTO dönüyoruz
        return Ok(dto);
    }
}