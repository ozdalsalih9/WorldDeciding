using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
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
    private readonly IIpHasher _ipHasher;
    private readonly IAbuseDetector _abuse;
    private readonly RefreshCookieOptions _refreshCookieOptions;

    public AuthController(
        UserManager<AppUser> users,
        IConfiguration cfg,
        IMediator mediator,
        IAppDbContext db,
        IRefreshTokenService refreshTokens,
        IClientContext client,
        IIpHasher ipHasher,
        IAbuseDetector abuse,
        IOptions<RefreshCookieOptions> refreshCookieOptions)
    {
        _users = users;
        _cfg = cfg;
        _mediator = mediator;
        _db = db;
        _refreshTokens = refreshTokens;
        _client = client;
        _ipHasher = ipHasher;
        _abuse = abuse;
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

        var exists = await _users.FindByEmailAsync(req.Email);
        if (exists is not null)
            return BadRequest(new { message = "Email is already in use." });

        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            UserName = req.Email,
            Email = req.Email,
            CountryCode = req.CountryCode,
            BirthDate = req.BirthDate,
            Gender = (req.Gender is short gv) ? (Gender)gv : Gender.Unknown,
            EmailConfirmed = false
        };

        var result = await _users.CreateAsync(user, req.Password);
        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors });

        var token = await _users.GenerateEmailConfirmationTokenAsync(user);
        var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));

        var frontendBaseUrl = cfg["Frontend:BaseUrl"] ?? "http://localhost:5173";
        var confirmUrl = $"{frontendBaseUrl}/verify-email?userId={user.Id}&token={encodedToken}";

        try
        {
            await emailSender.SendAsync(
                user.Email!,
                "Confirm your WorldDeciding account",
                $"""
                <div style="font-family: Arial, sans-serif; line-height: 1.5;">
                  <h2>Welcome to WorldDeciding 👋</h2>
                  <p>To activate your account, please confirm your email:</p>
                  <p><a href="{confirmUrl}">Confirm Email</a></p>
                  <p>If you didn’t create this account, you can ignore this email.</p>
                </div>
                """);
        }
        catch
        {
            // SMTP may not be configured (e.g. placeholder values in appsettings).
            // The user is already created; they can use /resend-confirmation later.
        }

        return Ok(new { message = "Registration successful. Please check your email to confirm your account." });
    }

    [HttpGet("confirm-email")]
    [AllowAnonymous]
    public async Task<IActionResult> ConfirmEmailGet(
        [FromQuery] string userId,
        [FromQuery] string token,
        CancellationToken ct)
    {
        var feBase = (_cfg["Frontend:BaseUrl"] ?? "http://localhost:5173").TrimEnd('/');

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

        var frontendBaseUrl = cfg["Frontend:BaseUrl"] ?? "http://localhost:5173";
        var resetUrl = $"{frontendBaseUrl}/reset-password?email={Uri.EscapeDataString(req.Email)}&token={encodedToken}";

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

        var apiBase = cfg["Api:BaseUrl"] ?? "https://localhost:7200";
        var link = $"{apiBase.TrimEnd('/')}/api/auth/confirm-email?userId={user.Id}&token={encodedToken}";

        var subject = "Confirm your email";
        var html = $@"
<p>Confirm your email by clicking the link below:</p>
<p><a href=""{link}"">Confirm Email</a></p>
<p>If you didn't request this, you can ignore this email.</p>
";

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

    private void AppendRefreshTokenCookie(string refreshToken)
    {
        var sameSite = ParseSameSite(_refreshCookieOptions.SameSite);

        Response.Cookies.Append(
            _refreshCookieOptions.Name,
            refreshToken,
            new CookieOptions
            {
                HttpOnly = _refreshCookieOptions.HttpOnly,
                Secure = _refreshCookieOptions.Secure,
                SameSite = sameSite,
                Path = _refreshCookieOptions.Path,
                Expires = DateTimeOffset.UtcNow.AddDays(_refreshCookieOptions.Days)
            });
    }

    private void DeleteRefreshTokenCookie()
    {
        var sameSite = ParseSameSite(_refreshCookieOptions.SameSite);

        Response.Cookies.Delete(
            _refreshCookieOptions.Name,
            new CookieOptions
            {
                HttpOnly = _refreshCookieOptions.HttpOnly,
                Secure = _refreshCookieOptions.Secure,
                SameSite = sameSite,
                Path = _refreshCookieOptions.Path
            });
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