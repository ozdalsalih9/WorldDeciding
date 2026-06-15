using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.Globalization;
using System.Net;
using System.Net.Sockets;
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
    private const string CountryVerificationUnavailableMessage =
        "We could not verify your country from your connection. Refresh the page and try again. If you are using a VPN or proxy, disable it first.";
    private const string CountryVerificationUnavailableSoftMessage =
        "Automatic country verification is temporarily unavailable. You can continue, but if your country can be verified during signup it must match your selection.";

    private readonly UserManager<AppUser> _users;
    private readonly IConfiguration _cfg;
    private readonly IMediator _mediator;

    private readonly IAppDbContext _db;
    private readonly IRefreshTokenService _refreshTokens;
    private readonly IClientContext _client;
    private readonly IGeoIpResolver _geo;
    private readonly IVpnDetectionService _vpnDetection;
    private readonly IIpHasher _ipHasher;
    private readonly IAbuseDetector _abuse;
    private readonly IHostEnvironment _environment;
    private readonly IHttpClientFactory _httpClientFactory;
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
        IVpnDetectionService vpnDetection,
        IIpHasher ipHasher,
        IAbuseDetector abuse,
        IHostEnvironment environment,
        IHttpClientFactory httpClientFactory,
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
        _vpnDetection = vpnDetection;
        _ipHasher = ipHasher;
        _abuse = abuse;
        _environment = environment;
        _httpClientFactory = httpClientFactory;
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
    public record RegisterCountryRes(
        string? CountryCode,
        string? CountryName,
        string? SuggestedCountryCode,
        bool EnforceCountryMatch,
        bool CanRegister,
        double Confidence,
        string Provider,
        string? Message,
        bool VpnBlocked,
        string? RiskReason
    );

    public record SiteAccessRes(
        bool Allowed,
        string? CountryCode,
        string? CountryName,
        double Confidence,
        string GeoProvider,
        bool VpnBlocked,
        string? RiskReason,
        string VpnProvider,
        string? Message
    );

    // ==== Endpoints ====

    [HttpGet("register-country")]
    [AllowAnonymous]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<ActionResult<RegisterCountryRes>> GetRegisterCountry(CancellationToken ct)
    {
        var enforcement = IsRegisterCountryMatchEnforced();
        var resolved = await ResolveCurrentCountryAsync(ct);
        var blockOnVerificationFailure = ShouldBlockOnCountryVerificationFailure();
        var vpnDecision = await CheckClientVpnAsync(ct);
        var vpnCountryCode = NormalizeCountryCode(vpnDecision.CountryCode);
        var estimatedCountryCode = resolved.countryCode ?? vpnCountryCode;
        var countryName = GetCountryName(estimatedCountryCode);

        if (vpnDecision.ShouldBlock)
        {
            return Ok(new RegisterCountryRes(
                estimatedCountryCode,
                countryName,
                estimatedCountryCode,
                enforcement,
                false,
                resolved.confidence,
                vpnDecision.Provider,
                BuildVpnBlockedMessage(vpnDecision),
                true,
                vpnDecision.RiskReason
            ));
        }

        if (enforcement && !resolved.isUsable)
        {
            return Ok(new RegisterCountryRes(
                null,
                null,
                null,
                true,
                !blockOnVerificationFailure,
                resolved.confidence,
                resolved.provider,
                blockOnVerificationFailure
                    ? CountryVerificationUnavailableMessage
                    : CountryVerificationUnavailableSoftMessage,
                false,
                null
            ));
        }

        return Ok(new RegisterCountryRes(
            estimatedCountryCode,
            countryName,
            estimatedCountryCode,
            enforcement,
            true,
            resolved.confidence,
            resolved.provider,
            estimatedCountryCode is null ? null : $"Detected country: {estimatedCountryCode}",
            false,
            vpnDecision.RiskReason
        ));
    }

    [HttpGet("access-status")]
    [AllowAnonymous]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<ActionResult<SiteAccessRes>> GetAccessStatus(CancellationToken ct)
    {
        var resolved = await ResolveCurrentCountryAsync(ct);
        var vpnDecision = await CheckClientVpnAsync(ct);
        var vpnCountryCode = NormalizeCountryCode(vpnDecision.CountryCode);
        var estimatedCountryCode = vpnCountryCode ?? resolved.countryCode;
        var estimatedCountryName = GetCountryName(estimatedCountryCode);

        if (vpnDecision.ShouldBlock)
        {
            return Ok(new SiteAccessRes(
                false,
                estimatedCountryCode,
                estimatedCountryName,
                resolved.confidence,
                resolved.provider,
                true,
                vpnDecision.RiskReason,
                vpnDecision.Provider,
                BuildSiteVpnBlockedMessage(vpnDecision, estimatedCountryCode, estimatedCountryName)
            ));
        }

        var estimatedCountryLabel = estimatedCountryName is not null && estimatedCountryCode is not null
            ? $"{estimatedCountryName} ({estimatedCountryCode})"
            : estimatedCountryCode;

        return Ok(new SiteAccessRes(
            true,
            estimatedCountryCode,
            estimatedCountryName,
            resolved.confidence,
            resolved.provider,
            false,
            vpnDecision.RiskReason,
            vpnDecision.Provider,
            estimatedCountryLabel is null ? null : $"Estimated country: {estimatedCountryLabel}"
        ));
    }

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<IActionResult> Register(
        [FromBody] RegisterReq req,
        [FromServices] IEmailSender emailSender,
        [FromServices] IConfiguration cfg)
    {
        var fieldErrors = new Dictionary<string, string[]>();
        var email = req.Email?.Trim();

        if (string.IsNullOrWhiteSpace(email))
        {
            fieldErrors["email"] = new[] { "Email is required." };
        }

        var passwordErrors = GetPasswordRequirementErrors(req.Password);
        if (passwordErrors.Length > 0)
        {
            fieldErrors["password"] = passwordErrors;
        }

        if (req.BirthDate is DateOnly dob)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var age = today.Year - dob.Year - (today < dob.AddYears(today.Year - dob.Year) ? 1 : 0);
            if (age < 13)
                fieldErrors["birthDate"] = new[] { "Users must be 13+." };
        }

        if (req.Gender is short g && (g < 0 || g > 4))
            fieldErrors["gender"] = new[] { "Invalid gender value." };

        var requestedCountryCode = NormalizeCountryCode(req.CountryCode);
        if (requestedCountryCode is null)
            fieldErrors["countryCode"] = new[] { "Country must be a valid ISO-3166-1 alpha-2 code." };

        if (fieldErrors.Count > 0)
        {
            return BadRequest(new
            {
                message = "Please fix the highlighted fields.",
                fieldErrors
            });
        }

        var vpnDecision = await CheckClientVpnAsync(HttpContext.RequestAborted);
        if (vpnDecision.ShouldBlock)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                message = BuildVpnBlockedMessage(vpnDecision),
                vpnBlocked = true,
                riskReason = vpnDecision.RiskReason,
                provider = vpnDecision.Provider
            });
        }

        var countryMismatch = await ValidateRegistrationCountryAsync(requestedCountryCode!, HttpContext.RequestAborted);
        if (countryMismatch is not null)
            return Conflict(countryMismatch);

        var exists = await _users.FindByEmailAsync(email!);
        if (exists is not null)
        {
            return BadRequest(new
            {
                message = "Email is already in use.",
                fieldErrors = new Dictionary<string, string[]>
                {
                    ["email"] = new[] { "Email is already in use." }
                }
            });
        }

        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            CountryCode = requestedCountryCode,
            BirthDate = req.BirthDate,
            Gender = (req.Gender is short gv) ? (Gender)gv : Gender.Unknown,
            EmailConfirmed = false
        };

        var result = await _users.CreateAsync(user, req.Password);
        if (!result.Succeeded)
        {
            return BadRequest(new
            {
                message = "Registration failed. Please fix the highlighted fields.",
                fieldErrors = MapIdentityErrors(result.Errors),
                errors = result.Errors.Select(e => new { e.Code, e.Description })
            });
        }

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
                BuildPasswordResetHtml(resetUrl, encodedToken));
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

    private async Task<VpnDetectionResult> CheckClientVpnAsync(CancellationToken ct)
    {
        var clientIp = _client.ClientIp;
        var userAgent = Request.Headers["User-Agent"].FirstOrDefault();
        var acceptLanguage = Request.Headers["Accept-Language"].FirstOrDefault();
        var decision = await _vpnDetection.CheckAsync(clientIp, userAgent, acceptLanguage, ct);

        if (decision.ShouldBlock)
        {
            _logger.LogInformation(
                "Registration blocked by VPN detection. Provider={Provider} Reason={Reason} FraudScore={FraudScore} ClientIp={ClientIp}",
                decision.Provider,
                decision.RiskReason,
                decision.FraudScore,
                clientIp);
        }

        return decision;
    }

    private static string BuildSiteVpnBlockedMessage(
        VpnDetectionResult decision,
        string? countryCode,
        string? countryName)
    {
        if (!decision.IsAvailable && decision.ShouldBlock)
        {
            return "Connection security verification is temporarily unavailable. Please try again later.";
        }

        var estimatedCountry = countryName is not null && countryCode is not null
            ? $"{countryName} ({countryCode})"
            : countryCode;

        if (estimatedCountry is null)
        {
            return "VPN, proxy, Tor, and hosting network access is not allowed on WorldDeciding. Disable it and try again.";
        }

        return $"VPN, proxy, Tor, and hosting network access is not allowed on WorldDeciding. Estimated country: {estimatedCountry}. Disable it and try again.";
    }

    private static string BuildVpnBlockedMessage(VpnDetectionResult decision)
    {
        if (!decision.IsAvailable && decision.ShouldBlock)
        {
            return "Registration security verification is temporarily unavailable. Please try again later.";
        }

        return "Registration is not available while using a VPN, proxy, Tor, or hosting network. Please disable it and try again.";
    }

    private static string[] GetPasswordRequirementErrors(string? password)
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(password))
        {
            return new[] { "Password is required." };
        }

        if (password.Length < 10)
            errors.Add("Password must be at least 10 characters.");
        if (!password.Any(char.IsDigit))
            errors.Add("Password must contain at least 1 digit.");
        if (!password.Any(char.IsUpper))
            errors.Add("Password must contain at least 1 uppercase letter.");
        if (!password.Any(char.IsLower))
            errors.Add("Password must contain at least 1 lowercase letter.");
        if (!password.Any(ch => !char.IsLetterOrDigit(ch)))
            errors.Add("Password must contain at least 1 symbol.");

        return errors.ToArray();
    }

    private static Dictionary<string, string[]> MapIdentityErrors(IEnumerable<IdentityError> errors)
    {
        var mapped = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);

        foreach (var error in errors)
        {
            var field = error.Code.StartsWith("Password", StringComparison.OrdinalIgnoreCase)
                ? "password"
                : error.Code.Contains("Email", StringComparison.OrdinalIgnoreCase)
                    ? "email"
                    : "form";

            if (!mapped.TryGetValue(field, out var list))
            {
                list = new List<string>();
                mapped[field] = list;
            }

            list.Add(error.Description);
        }

        return mapped.ToDictionary(pair => pair.Key, pair => pair.Value.ToArray(), StringComparer.OrdinalIgnoreCase);
    }

    private static string? GetCountryName(string? countryCode)
    {
        var normalized = NormalizeCountryCode(countryCode);
        if (normalized is null)
        {
            return null;
        }

        try
        {
            return new RegionInfo(normalized).EnglishName;
        }
        catch
        {
            return normalized;
        }
    }

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
        return BuildAccountEmailHtml(
            preheader: "Confirm your WorldDeciding email to activate your account.",
            eyebrow: "Account activation",
            title: "Confirm your email",
            lead: "Welcome to WorldDeciding. Confirm your email address to activate your account and start voting, comparing, and tracking the global pulse.",
            actionLabel: "Confirm Email",
            actionUrl: confirmUrl,
            helperTitle: "Direct confirmation link",
            helperCopy: "If the button does not open, copy and paste this link into your browser.",
            helperValue: confirmUrl,
            noteTitle: "Security note",
            noteCopy: "If you did not create a WorldDeciding account, you can safely ignore this email.",
            accentA: "#4f74e6",
            accentB: "#22d3ee");
    }

    private static string BuildPasswordResetHtml(string resetUrl, string encodedToken)
    {
        return BuildAccountEmailHtml(
            preheader: "Use this email to reset your WorldDeciding password.",
            eyebrow: "Password reset",
            title: "Reset your password",
            lead: "We received a request to reset your WorldDeciding password. Use the button below to open the reset screen, or use the secure token if you are entering it manually.",
            actionLabel: "Open Reset Page",
            actionUrl: resetUrl,
            helperTitle: "Reset token",
            helperCopy: "Paste this token into the reset form only if you are asked for it.",
            helperValue: encodedToken,
            noteTitle: "Did not request this?",
            noteCopy: "If this was not you, ignore this email. Your account stays unchanged until you complete the reset flow.",
            accentA: "#0f172a",
            accentB: "#4f74e6");
    }

    private static string BuildAccountEmailHtml(
        string preheader,
        string eyebrow,
        string title,
        string lead,
        string actionLabel,
        string actionUrl,
        string helperTitle,
        string helperCopy,
        string helperValue,
        string noteTitle,
        string noteCopy,
        string accentA,
        string accentB)
    {
        var safePreheader = WebUtility.HtmlEncode(preheader);
        var safeEyebrow = WebUtility.HtmlEncode(eyebrow);
        var safeTitle = WebUtility.HtmlEncode(title);
        var safeLead = WebUtility.HtmlEncode(lead);
        var safeActionLabel = WebUtility.HtmlEncode(actionLabel);
        var safeActionUrl = WebUtility.HtmlEncode(actionUrl);
        var safeHelperTitle = WebUtility.HtmlEncode(helperTitle);
        var safeHelperCopy = WebUtility.HtmlEncode(helperCopy);
        var safeHelperValue = WebUtility.HtmlEncode(helperValue);
        var safeNoteTitle = WebUtility.HtmlEncode(noteTitle);
        var safeNoteCopy = WebUtility.HtmlEncode(noteCopy);
        var safeAccentA = WebUtility.HtmlEncode(accentA);
        var safeAccentB = WebUtility.HtmlEncode(accentB);

        return $$"""
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{{safeTitle}}</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          background-color: #f4f7fa;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #333333;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        .header {
          background-color: {{safeAccentA}};
          padding: 24px;
          text-align: center;
          color: #ffffff;
        }
        .content {
          padding: 32px 24px;
        }
        .eyebrow {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #666666;
          margin-bottom: 8px;
        }
        h1 {
          margin: 0 0 16px 0;
          font-size: 24px;
          color: #111111;
        }
        p {
          margin: 0 0 24px 0;
          font-size: 16px;
          line-height: 1.5;
          color: #444444;
        }
        .button-container {
          text-align: center;
          margin: 32px 0;
        }
        .button {
          display: inline-block;
          padding: 14px 28px;
          background-color: {{safeAccentA}};
          color: #ffffff !important;
          text-decoration: none;
          border-radius: 6px;
          font-weight: bold;
          font-size: 16px;
        }
        .helper-box {
          background-color: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 6px;
          padding: 16px;
          margin-bottom: 24px;
        }
        .helper-title {
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
          color: #555555;
          margin-bottom: 8px;
        }
        .helper-value {
          font-family: monospace;
          font-size: 13px;
          color: #333333;
          word-break: break-all;
        }
        .footer {
          padding: 24px;
          text-align: center;
          font-size: 12px;
          color: #888888;
          background-color: transparent;
        }
        .note-title {
          font-weight: bold;
          margin-bottom: 4px;
        }
        .divider {
          margin-top: 32px; 
          padding-top: 24px; 
          border-top: 1px solid #e9ecef;
        }
        
        @media (prefers-color-scheme: dark) {
          body {
            background-color: #121212 !important;
            color: #e0e0e0 !important;
          }
          .container {
            background-color: #1e1e1e !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
          }
          .eyebrow {
            color: #aaaaaa !important;
          }
          h1 {
            color: #ffffff !important;
          }
          p {
            color: #cccccc !important;
          }
          .helper-box {
            background-color: #2c2c2c !important;
            border-color: #444444 !important;
          }
          .helper-title {
            color: #999999 !important;
          }
          .helper-value {
            color: #eeeeee !important;
          }
          .divider {
            border-top-color: #444444 !important;
          }
        }
      </style>
    </head>
    <body>
      <!-- Preheader -->
      <div style="display: none; max-height: 0px; overflow: hidden;">
        {{safePreheader}}
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; background-color: transparent;">
        <tr>
          <td align="center" style="padding: 20px 10px;">
            <table class="container" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width: 600px;">
              <tr>
                <td class="header" style="padding: 24px; text-align: center;">
                  <strong style="letter-spacing: 2px; font-size: 18px;">WORLDDECIDING</strong>
                </td>
              </tr>
              <tr>
                <td class="content" style="padding: 32px 24px;">
                  <div class="eyebrow">{{safeEyebrow}}</div>
                  <h1>{{safeTitle}}</h1>
                  <p>{{safeLead}}</p>
                  
                  <div class="button-container">
                    <a href="{{safeActionUrl}}" class="button">{{safeActionLabel}}</a>
                  </div>

                  <div class="helper-box">
                    <div class="helper-title">{{safeHelperTitle}}</div>
                    <p style="font-size: 14px; margin-bottom: 8px;">{{safeHelperCopy}}</p>
                    <div class="helper-value">{{safeHelperValue}}</div>
                  </div>

                  <div class="divider">
                    <div class="note-title">{{safeNoteTitle}}</div>
                    <p style="font-size: 13px; margin-bottom: 0;">{{safeNoteCopy}}</p>
                  </div>
                </td>
              </tr>
            </table>
            
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width: 600px;">
              <tr>
                <td class="footer">
                  WorldDeciding account security email. Please do not reply to this automated message.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
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

        try
        {
            var resolved = await ResolveCurrentCountryAsync(ct);

            if (!resolved.isUsable)
            {
                if (!ShouldBlockOnCountryVerificationFailure())
                {
                    _logger.LogWarning(
                        "Register country verification unavailable; allowing registration without hard block. Provider={Provider} Confidence={Confidence} ClientIp={ClientIp} RemoteIp={RemoteIp} HeaderCountry={HeaderCountry}",
                        resolved.provider,
                        resolved.confidence,
                        clientIp,
                        HttpContext.Connection.RemoteIpAddress,
                        GetTrustedProxyCountryHeader());
                    return null;
                }

                _logger.LogInformation(
                    "Register country enforcement blocked registration because country could not be verified. Provider={Provider} Confidence={Confidence} ClientIp={ClientIp} RemoteIp={RemoteIp} HeaderCountry={HeaderCountry}",
                    resolved.provider,
                    resolved.confidence,
                    clientIp,
                    HttpContext.Connection.RemoteIpAddress,
                    GetTrustedProxyCountryHeader());
                return new
                {
                    message = CountryVerificationUnavailableMessage,
                    countryVerificationFailed = true
                };
            }

            var inferredCountryCode = resolved.countryCode!;

            if (string.Equals(selectedCountryCode, inferredCountryCode, StringComparison.OrdinalIgnoreCase))
                return null;

            _logger.LogInformation(
                "Registration country mismatch detected. Selected={SelectedCountry} Inferred={InferredCountry} Provider={Provider} Confidence={Confidence} ClientIp={ClientIp}",
                selectedCountryCode,
                inferredCountryCode,
                resolved.provider,
                resolved.confidence,
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
            if (!ShouldBlockOnCountryVerificationFailure())
            {
                return null;
            }

            return new
            {
                message = CountryVerificationUnavailableMessage,
                countryVerificationFailed = true
            };
        }
    }

    private async Task<(string? countryCode, double confidence, string provider, bool isUsable)> ResolveCurrentCountryAsync(CancellationToken ct)
    {
        var trustedHeaderCountry = GetTrustedProxyCountryHeader();
        if (trustedHeaderCountry is not null)
        {
            _logger.LogDebug(
                "Register country resolved from trusted proxy header. Country={CountryCode} RemoteIp={RemoteIp}",
                trustedHeaderCountry,
                HttpContext.Connection.RemoteIpAddress);
            return (trustedHeaderCountry, 1.0, "TrustedProxyCountryHeader", true);
        }

        var clientIp = _client.ClientIp;
        if (clientIp is null)
        {
            _logger.LogDebug(
                "Register country resolution could not determine client IP. RemoteIp={RemoteIp}",
                HttpContext.Connection.RemoteIpAddress);
            return (null, 0.0, "ClientIpUnavailable", false);
        }

        var inspectedIp = await ResolveInspectableClientIpAsync(clientIp, ct) ?? clientIp;
        var (countryIso2, confidence, provider) = await _geo.ResolveAsync(inspectedIp, ct);
        var countryCode = NormalizeCountryCode(countryIso2);
        var minimumConfidence = GetRegisterCountryMinimumConfidence();
        var isUsable = countryCode is not null && confidence >= minimumConfidence;

        _logger.LogDebug(
            "Register country resolution result. ClientIp={ClientIp} InspectedIp={InspectedIp} RemoteIp={RemoteIp} CountryCode={CountryCode} Confidence={Confidence} Provider={Provider} IsUsable={IsUsable}",
            clientIp,
            inspectedIp,
            HttpContext.Connection.RemoteIpAddress,
            countryCode,
            confidence,
            provider,
            isUsable);

        return (countryCode, confidence, provider, isUsable);
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

    private bool ShouldBlockOnCountryVerificationFailure()
    {
        return _cfg.GetValue<bool?>("GeoIp:BlockOnVerificationFailure") ?? false;
    }

    private async Task<IPAddress?> ResolveInspectableClientIpAsync(IPAddress clientIp, CancellationToken ct)
    {
        if (!IsPrivateOrLoopback(clientIp) || !_cfg.GetValue<bool>("GeoIp:ResolvePublicIpForPrivateClients"))
        {
            return clientIp;
        }

        var endpoint = _cfg["GeoIp:PublicIpEndpoint"]?.Trim();
        if (string.IsNullOrWhiteSpace(endpoint))
        {
            endpoint = "https://api.ipify.org";
        }

        var timeoutSeconds = Math.Clamp(_cfg.GetValue<int?>("GeoIp:PublicIpTimeoutSeconds") ?? 3, 1, 15);

        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));

            var http = _httpClientFactory.CreateClient();
            var raw = await http.GetStringAsync(endpoint, timeout.Token);

            return IPAddress.TryParse(raw.Trim(), out var publicIp) && !IsPrivateOrLoopback(publicIp)
                ? publicIp
                : null;
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            _logger.LogWarning(ex, "Could not resolve public IP for country detection.");
            return null;
        }
    }

    private string? GetTrustedProxyCountryHeader()
    {
        if (!CanTrustProxyMetadata())
        {
            return null;
        }

        var headerCandidates = new[]
        {
            ("CF-IPCountry", Request.Headers["CF-IPCountry"].FirstOrDefault()),
            ("CloudFront-Viewer-Country", Request.Headers["CloudFront-Viewer-Country"].FirstOrDefault()),
            ("X-AppEngine-Country", Request.Headers["X-AppEngine-Country"].FirstOrDefault()),
            ("X-Country-Code", Request.Headers["X-Country-Code"].FirstOrDefault()),
            ("X-Country", Request.Headers["X-Country"].FirstOrDefault()),
            ("ClientContext", _client.DeclaredCountryIso2)
        };

        foreach (var (_, rawValue) in headerCandidates)
        {
            var normalized = NormalizeCountryCode(rawValue);
            if (normalized is not null)
            {
                return normalized;
            }
        }

        return null;
    }

    private bool CanTrustProxyMetadata()
    {
        var remoteIp = HttpContext.Connection.RemoteIpAddress;
        if (remoteIp is null)
        {
            return false;
        }

        if (IsPrivateOrLoopback(remoteIp))
        {
            return true;
        }

        var trustedProxies = _cfg
            .GetSection("Networking:TrustedProxies")
            .Get<string[]>()?
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value.Trim())
            .ToArray()
            ?? Array.Empty<string>();

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

        if (address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetworkV6)
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
