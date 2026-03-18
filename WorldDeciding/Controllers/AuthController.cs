using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using WorldDeciding.Application.Auth.Commands.Refresh;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Application.Common.Models;
using WorldDeciding.Domain.Entities;
using WorldDeciding.Domain.Identity;
using WorldDeciding.Infrastructure.Security;

namespace WorldDeciding.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<AppUser> _users;
    private readonly IConfiguration _cfg;
    private readonly IMediator _mediator;

    private readonly IAppDbContext _db;
    private readonly IRefreshTokenService _refreshTokens;
    private readonly IClientContext _client;
    private readonly IGeoIpResolver _geo;
    private readonly IIpHasher _ipHasher;
    private readonly IAbuseDetector _abuse;
    private readonly IHostEnvironment _environment;
    private readonly ILogger<AuthController> _logger;
    private readonly RefreshCookieOptions _refreshCookieOptions;

    public AuthController(
        UserManager<AppUser> users,
        IConfiguration cfg,
        IMediator mediator,
        IAppDbContext db,
        IRefreshTokenService refreshTokens,
        IClientContext client,
        IGeoIpResolver geo,
        IIpHasher ipHasher,
        IAbuseDetector abuse,
        IHostEnvironment environment,
        ILogger<AuthController> logger,
        IOptions<RefreshCookieOptions> refreshCookieOptions)
    {
        _users = users;
        _cfg = cfg;
        _mediator = mediator;
        _db = db;
        _refreshTokens = refreshTokens;
        _client = client;
        _geo = geo;
        _ipHasher = ipHasher;
        _abuse = abuse;
        _environment = environment;
        _logger = logger;
        _refreshCookieOptions = refreshCookieOptions.Value;
    }

    // ==== DTOs ====

    public record RegisterReq(
        string Email,
        string Password,
        string? CountryCode,
        DateOnly? BirthDate,
        short? Gender
    );

    public record LoginReq(string Email, string Password);

    public record AuthRes(
        string AccessToken,
        string Email,
        string? CountryCode,
        DateOnly? BirthDate,
        short Gender,
        string[] Roles
    );

    public record ConfirmEmailReq(string UserId, string Token);
    public record ForgotPasswordReq(string Email);
    public record ResetPasswordReq(string Email, string Token, string NewPassword, string ConfirmNewPassword);
    public record ResendConfirmationReq(string Email);

    // ==== Endpoints ====

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<IActionResult> Register(
        [FromBody] RegisterReq req,
        [FromServices] IEmailSender emailSender,
        [FromServices] IConfiguration cfg)
    {
        if (string.IsNullOrWhiteSpace(req.Email))
            return BadRequest(new { message = "Email is required." });

        if (string.IsNullOrWhiteSpace(req.Password) || req.Password.Length < 6)
            return BadRequest(new { message = "Password must be at least 6 characters." });

        if (req.BirthDate is DateOnly dob)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var age = today.Year - dob.Year - (today < dob.AddYears(today.Year - dob.Year) ? 1 : 0);
            if (age < 13)
                return BadRequest(new { message = "Users must be 13+." });
        }

        if (req.Gender is short g && (g < 0 || g > 4))
            return BadRequest(new { message = "Invalid gender value." });

        var requestedCountryCode = NormalizeCountryCode(req.CountryCode);
        if (requestedCountryCode is null)
            return BadRequest(new { message = "Country must be a valid ISO-3166-1 alpha-2 code." });

        var countryMismatch = await ValidateRegistrationCountryAsync(requestedCountryCode, HttpContext.RequestAborted);
        if (countryMismatch is not null)
            return Conflict(countryMismatch);

        var exists = await _users.FindByEmailAsync(req.Email);
        if (exists is not null)
            return BadRequest(new { message = "Email is already in use." });

        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            UserName = req.Email,
            Email = req.Email,
            CountryCode = requestedCountryCode,
            BirthDate = req.BirthDate,
            Gender = (req.Gender is short gv) ? (Gender)gv : Gender.Unknown,
            EmailConfirmed = false
        };

        var result = await _users.CreateAsync(user, req.Password);
        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors });

        var token = await _users.GenerateEmailConfirmationTokenAsync(user);
        var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));

        var confirmUrl = BuildFrontendConfirmEmailUrl(cfg, user.Id, encodedToken);

        try
        {
            await emailSender.SendAsync(
                user.Email!,
                "Confirm your WorldDeciding account",
                BuildConfirmEmailHtml(confirmUrl));
        }
        catch
        {
            // SMTP may not be configured (e.g. placeholder values in appsettings).
            // The user is already created; they can use /resend-confirmation later.
        }

        return Ok(new { message = "Registration successful. Please check your email to confirm your account." });
    }

    [HttpPost("confirm-email")]
    [AllowAnonymous]
    public async Task<IActionResult> ConfirmEmail([FromBody] ConfirmEmailReq req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.UserId) || string.IsNullOrWhiteSpace(req.Token))
            return BadRequest(new { message = "Missing userId or token." });

        var user = await _users.FindByIdAsync(req.UserId);
        if (user is null)
            return BadRequest(new { message = "Invalid user." });

        string decodedToken;
        try
        {
            decodedToken = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(req.Token));
        }
        catch
        {
            return BadRequest(new { message = "Invalid token format." });
        }

        var result = await _users.ConfirmEmailAsync(user, decodedToken);
        if (!result.Succeeded)
        {
            var message = string.Join(" | ", result.Errors.Select(e => e.Description));
            return BadRequest(new { message = string.IsNullOrWhiteSpace(message) ? "Email confirmation failed." : message });
        }

        return Ok(new { message = "Email confirmed. You can now sign in." });
    }

    [HttpGet("confirm-email")]
    [AllowAnonymous]
    public async Task<IActionResult> ConfirmEmailGet(
        [FromQuery] string userId,
        [FromQuery] string token,
        CancellationToken ct)
    {
        var feBase = GetFrontendBaseUrl(_cfg);

        string FrontendUrl(string status, string message)
            => $"{feBase}/email-confirmed?status={Uri.EscapeDataString(status)}&message={Uri.EscapeDataString(message)}";

        try
        {
            if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(token))
                return Redirect(FrontendUrl("error", "Missing userId or token."));

            var user = await _users.FindByIdAsync(userId);
            if (user is null)
                return Redirect(FrontendUrl("error", "Invalid user."));

            string decodedToken;
            try
            {
                decodedToken = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(token));
            }
            catch
            {
                return Redirect(FrontendUrl("error", "Invalid token format."));
            }

            var result = await _users.ConfirmEmailAsync(user, decodedToken);

            if (!result.Succeeded)
            {
                var errs = string.Join(" | ", result.Errors.Select(e => $"{e.Code}:{e.Description}"));
                return Redirect(FrontendUrl("error", $"Confirm failed: {errs}"));
            }

            return Redirect(FrontendUrl("success", "Email confirmed. You can now sign in."));
        }
        catch
        {
            return Redirect(FrontendUrl("error", "Server error during email confirmation."));
        }
    }

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ForgotPassword(
        [FromBody] ForgotPasswordReq req,
        [FromServices] IEmailSender emailSender,
        [FromServices] IConfiguration cfg,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Email))
            return BadRequest(new { message = "Email is required." });

        var user = await _users.FindByEmailAsync(req.Email);

        if (user is null || !user.EmailConfirmed)
            return Ok(new { message = "If the email exists, a reset token has been sent." });

        var ip = _client.ClientIp?.ToString() ?? "unknown";
        var ipHash = _ipHasher.Hash(ip);

        var decision = await _abuse.CheckAsync(
            WorldDeciding.Application.Common.Abuse.AbuseAction.ForgotPassword,
            userId: null,
            ipHash: ipHash,
            ct);

        if (decision.Mode == WorldDeciding.Application.Common.Abuse.AbuseMode.Throttle)
            return Ok(new { message = "If the email exists, a reset token has been sent." });

        var token = await _users.GeneratePasswordResetTokenAsync(user);
        var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));

        var frontendBaseUrl = GetFrontendBaseUrl(cfg);
        var resetUrl =
            $"{frontendBaseUrl}/reset-password?email={Uri.EscapeDataString(req.Email)}&token={Uri.EscapeDataString(encodedToken)}";

        try
        {
            await emailSender.SendAsync(
                req.Email,
                "WorldDeciding password reset",
                $"""
                <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                  <h2>Password reset requested</h2>
                  <p>Use the token below in the Reset Password screen, or click the link.</p>
                  <p><b>Reset token:</b></p>
                  <pre style="padding:12px;border-radius:8px;background:#f5f5f5;white-space:pre-wrap;">{encodedToken}</pre>
                  <p><a href="{resetUrl}">Open reset page</a></p>
                  <p>If you did not request this, you can ignore this email.</p>
                </div>
                """);
        }
        catch
        {
            // SMTP may not be configured (e.g. placeholder values in appsettings).
            // Enumeration-safe: still return generic 200.
        }

        return Ok(new { message = "If the email exists, a reset token has been sent." });
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthRes>> Login([FromBody] LoginReq req, CancellationToken ct)
    {
        var ip = _client.ClientIp?.ToString() ?? "unknown";
        var ipHash = _ipHasher.Hash(ip);

        var loginDecision = await _abuse.CheckAsync(
            WorldDeciding.Application.Common.Abuse.AbuseAction.LoginAttempt,
            userId: null,
            ipHash: ipHash,
            ct: ct);

        if (loginDecision.Mode == WorldDeciding.Application.Common.Abuse.AbuseMode.Throttle)
        {
            Response.Headers["Retry-After"] = (loginDecision.RetryAfterSeconds ?? 60).ToString();
            return StatusCode(StatusCodes.Status429TooManyRequests,
                new { message = "Too many login attempts. Please try again later." });
        }

        var user = await _users.FindByEmailAsync(req.Email);

        if (user is null || !await _users.CheckPasswordAsync(user, req.Password))
        {
            await _abuse.MarkLoginFailureAsync(ipHash, ct);
            return Unauthorized(new { message = "Invalid email or password." });
        }

        if (!user.EmailConfirmed)
            return Unauthorized(new { message = "Please confirm your email first." });

        var roles = (await _users.GetRolesAsync(user)).ToArray();

        var accessToken = await GenerateJwtAsync(user, roles);

        var now = DateTimeOffset.UtcNow;
        var refreshPlain = _refreshTokens.GenerateToken();
        var refreshHash = _refreshTokens.HashToken(refreshPlain);
        var familyId = Guid.NewGuid();

        var refreshEntity = new RefreshToken(
            userId: user.Id,
            tokenHash: refreshHash,
            familyId: familyId,
            createdAt: now,
            expiresAt: now.AddDays(14),
            createdByIpHash: ipHash
        );

        _db.RefreshTokens.Add(refreshEntity);
        await _db.SaveChangesAsync(ct);

        AppendRefreshTokenCookie(refreshPlain);

        return Ok(new AuthRes(
            accessToken,
            user.Email!,
            user.CountryCode,
            user.BirthDate,
            (short)user.Gender,
            roles
        ));
    }

    [HttpPost("resend-confirmation")]
    [AllowAnonymous]
    public async Task<IActionResult> ResendConfirmation(
        [FromBody] ResendConfirmationReq req,
        [FromServices] IEmailSender emailSender,
        [FromServices] IConfiguration cfg,
        CancellationToken ct)
    {
        var email = (req.Email ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email))
            return NoContent();

        var user = await _users.FindByEmailAsync(email);
        if (user == null || user.EmailConfirmed)
            return NoContent();

        var token = await _users.GenerateEmailConfirmationTokenAsync(user);
        var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));

        var link = BuildFrontendConfirmEmailUrl(cfg, user.Id, encodedToken);

        var subject = "Confirm your WorldDeciding account";
        var html = BuildConfirmEmailHtml(link);

        try
        {
            await emailSender.SendAsync(email, subject, html, ct);
        }
        catch
        {
            // intentionally swallow for enumeration-safe behavior
        }

        return NoContent();
    }

    [AllowAnonymous]
    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh(CancellationToken ct)
    {
        if (!Request.Cookies.TryGetValue(_refreshCookieOptions.Name, out var refreshToken) ||
            string.IsNullOrWhiteSpace(refreshToken))
        {
            return Unauthorized(new { message = "Refresh token cookie missing." });
        }

        try
        {
            var result = await _mediator.Send(new RefreshCommand(refreshToken), ct);

            // refresh token rotation varsa yeni cookie yaz
            if (!string.IsNullOrWhiteSpace(result.RefreshToken))
                AppendRefreshTokenCookie(result.RefreshToken);

            // ❗ refreshToken body'de dönmüyor
            return Ok(new
            {
                accessToken = result.AccessToken
            });
        }
        catch (UnauthorizedAccessException ex)
        {
            DeleteRefreshTokenCookie();
            return Unauthorized(new { message = ex.Message });
        }
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        DeleteRefreshTokenCookie();
        return NoContent();
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordReq req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) ||
            string.IsNullOrWhiteSpace(req.Token) ||
            string.IsNullOrWhiteSpace(req.NewPassword))
            return BadRequest(new { message = "Email, token and newPassword are required." });

        if (req.NewPassword != req.ConfirmNewPassword)
            return BadRequest(new { message = "Passwords do not match." });

        var user = await _users.FindByEmailAsync(req.Email);
        if (user is null)
            return BadRequest(new { message = "Invalid request." });

        string decodedToken;
        try
        {
            decodedToken = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(req.Token));
        }
        catch
        {
            return BadRequest(new { message = "Invalid token format." });
        }

        var result = await _users.ResetPasswordAsync(user, decodedToken, req.NewPassword);

        if (!result.Succeeded)
        {
            return BadRequest(new
            {
                message = "Password reset failed.",
                errors = result.Errors.Select(e => new { e.Code, e.Description })
            });
        }

        return Ok(new { message = "Password reset successful." });
    }

    // ==== Helpers ====

    private static string GetFrontendBaseUrl(IConfiguration cfg)
    {
        var url = cfg["Frontend:BaseUrl"]?.Trim().TrimEnd('/');
        if (string.IsNullOrWhiteSpace(url))
            throw new InvalidOperationException(
                "Missing configuration: Frontend:BaseUrl. Set it in appsettings or environment variables.");

        return url;
    }

    private static string GetApiBaseUrl(IConfiguration cfg)
    {
        var url = cfg["Api:BaseUrl"]?.Trim().TrimEnd('/');
        if (string.IsNullOrWhiteSpace(url))
            throw new InvalidOperationException(
                "Missing configuration: Api:BaseUrl. Set it in appsettings or environment variables.");

        return url;
    }

    private static string BuildFrontendConfirmEmailUrl(IConfiguration cfg, Guid userId, string encodedToken)
    {
        var frontendBaseUrl = GetFrontendBaseUrl(cfg);
        return $"{frontendBaseUrl}/confirm-email?userId={Uri.EscapeDataString(userId.ToString())}&token={Uri.EscapeDataString(encodedToken)}";
    }

    private static string BuildConfirmEmailHtml(string confirmUrl)
    {
        return $"""
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Confirm your email</title>
    </head>
    <body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
        <div style="background:#ffffff;border-radius:18px;padding:40px 32px;box-shadow:0 10px 30px rgba(0,0,0,0.08);">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="display:inline-block;padding:10px 16px;border-radius:999px;background:#eef2ff;color:#4338ca;font-weight:700;font-size:13px;letter-spacing:.3px;">
              WorldDeciding
            </div>
          </div>

          <h1 style="margin:0 0 12px;font-size:28px;line-height:1.25;color:#111827;text-align:center;">
            Confirm your email
          </h1>

          <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#4b5563;text-align:center;">
            Welcome! Please confirm your email address to activate your account and start using WorldDeciding.
          </p>

          <div style="text-align:center;margin:32px 0;">
            <a href="{confirmUrl}"
               style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 24px;border-radius:12px;">
              Confirm Email
            </a>
          </div>

          <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#6b7280;">
            If the button does not work, copy and paste this link into your browser:
          </p>

          <p style="margin:0 0 24px;font-size:13px;line-height:1.8;word-break:break-all;color:#374151;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:14px;">
            {confirmUrl}
          </p>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />

          <p style="margin:0;font-size:13px;line-height:1.7;color:#9ca3af;text-align:center;">
            If you didn’t create this account, you can safely ignore this email.
          </p>
        </div>
      </div>
    </body>
    </html>
    """;
    }

    private Task<string> GenerateJwtAsync(AppUser user, string[] roles)
    {
        var jwt = _cfg.GetSection("Jwt");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var minutes = 15;
        if (int.TryParse(jwt["AccessTokenMinutes"], out var m) && m > 0)
            minutes = m;

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        if (!string.IsNullOrWhiteSpace(user.CountryCode))
            claims.Add(new Claim("country", user.CountryCode));

        if (user.BirthDate is DateOnly dob)
            claims.Add(new Claim("birthdate", dob.ToString("yyyy-MM-dd")));

        claims.Add(new Claim("gender", ((short)user.Gender).ToString()));

        foreach (var r in roles)
            claims.Add(new Claim(ClaimTypes.Role, r));

        var token = new JwtSecurityToken(
            issuer: jwt["Issuer"],
            audience: jwt["Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(minutes),
            signingCredentials: creds
        );

        return Task.FromResult(new JwtSecurityTokenHandler().WriteToken(token));
    }

    private async Task<object?> ValidateRegistrationCountryAsync(string selectedCountryCode, CancellationToken ct)
    {
        if (!IsRegisterCountryMatchEnforced())
            return null;

        var clientIp = _client.ClientIp;
        if (clientIp is null)
        {
            _logger.LogDebug("Skipping register country enforcement because client IP could not be resolved.");
            return null;
        }

        try
        {
            var (countryIso2, confidence, provider) = await _geo.ResolveAsync(clientIp, ct);
            var inferredCountryCode = NormalizeCountryCode(countryIso2);
            var minimumConfidence = GetRegisterCountryMinimumConfidence();

            if (inferredCountryCode is null)
            {
                _logger.LogInformation(
                    "Skipping register country enforcement because GeoIP returned no country. Provider={Provider} ClientIp={ClientIp}",
                    provider,
                    clientIp);
                return null;
            }

            if (confidence < minimumConfidence)
            {
                _logger.LogInformation(
                    "Skipping register country enforcement because GeoIP confidence is below threshold. Provider={Provider} Confidence={Confidence} Threshold={Threshold} ClientIp={ClientIp} Country={Country}",
                    provider,
                    confidence,
                    minimumConfidence,
                    clientIp,
                    inferredCountryCode);
                return null;
            }

            if (string.Equals(selectedCountryCode, inferredCountryCode, StringComparison.OrdinalIgnoreCase))
                return null;

            _logger.LogInformation(
                "Registration country mismatch detected. Selected={SelectedCountry} Inferred={InferredCountry} Provider={Provider} Confidence={Confidence} ClientIp={ClientIp}",
                selectedCountryCode,
                inferredCountryCode,
                provider,
                confidence,
                clientIp);

            return new
            {
                message = $"Your connection appears to be from {inferredCountryCode}. Please select that country to continue registration.",
                suggestedCountryCode = inferredCountryCode,
                detectedCountryCode = inferredCountryCode
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "GeoIP lookup failed during registration country validation for IP {ClientIp}", clientIp);
            return null;
        }
    }

    private bool IsRegisterCountryMatchEnforced()
    {
        return _cfg.GetValue<bool?>("GeoIp:EnforceCountryMatchOnRegister") ?? !_environment.IsDevelopment();
    }

    private double GetRegisterCountryMinimumConfidence()
    {
        var configured = _cfg.GetValue<double?>("GeoIp:MinimumCountryConfidence") ?? 0.6;
        return Math.Clamp(configured, 0.0, 1.0);
    }

    private static string? NormalizeCountryCode(string? countryCode)
    {
        var normalized = countryCode?.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(normalized) || normalized.Length != 2 || !normalized.All(char.IsLetter))
            return null;

        return normalized;
    }

    private void AppendRefreshTokenCookie(string refreshToken)
    {
        var cookieOptions = BuildRefreshCookieOptions();
        cookieOptions.Expires = DateTimeOffset.UtcNow.AddDays(_refreshCookieOptions.Days);
        cookieOptions.MaxAge = TimeSpan.FromDays(_refreshCookieOptions.Days);

        Response.Cookies.Append(
            _refreshCookieOptions.Name,
            refreshToken,
            cookieOptions);
    }

    private void DeleteRefreshTokenCookie()
    {
        Response.Cookies.Delete(
            _refreshCookieOptions.Name,
            BuildRefreshCookieOptions());
    }

    private CookieOptions BuildRefreshCookieOptions()
    {
        return new CookieOptions
        {
            HttpOnly = _refreshCookieOptions.HttpOnly,
            Secure = _refreshCookieOptions.Secure,
            SameSite = ParseSameSite(_refreshCookieOptions.SameSite),
            Path = _refreshCookieOptions.Path,
            IsEssential = true
        };
    }

    private static SameSiteMode ParseSameSite(string? value)
    {
        return value?.ToLowerInvariant() switch
        {
            "none" => SameSiteMode.None,
            "strict" => SameSiteMode.Strict,
            _ => SameSiteMode.Lax
        };
    }
}
