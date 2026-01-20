using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using WorldDeciding.Application.Common.Models;
// Gender artık Domain'de
using WorldDeciding.Infrastructure.Identity;   // AppUser burada
// using WorldDeciding.Application.Common.Auth; // kullanmıyorsan kaldır

namespace WorldDeciding.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<AppUser> _users;
    private readonly IConfiguration _cfg;

    public AuthController(UserManager<AppUser> users, IConfiguration cfg)
    {
        _users = users;
        _cfg = cfg;
    }

    // ==== DTOs ====
    public record RegisterReq(
        string Email,
        string Password,
        string? CountryCode,
        DateOnly? BirthDate,     // "YYYY-MM-DD"
        short? Gender            // 0..4
    );

    public record LoginReq(string Email, string Password);

    public record AuthRes(
        string Token,
        string Email,
        string? CountryCode,
        DateOnly? BirthDate,
        short Gender,            // 0..4
        string[] Roles
    );

    // ==== Endpoints ====

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthRes>> Register([FromBody] RegisterReq req)
    {
        if (string.IsNullOrWhiteSpace(req.Email))
            return BadRequest(new { message = "Email is required." });

        if (string.IsNullOrWhiteSpace(req.Password) || req.Password.Length < 6)
            return BadRequest(new { message = "Password must be at least 6 characters." });

        // 13+ yaş kuralı
        if (req.BirthDate is DateOnly dob)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var age = today.Year - dob.Year - (today < dob.AddYears(today.Year - dob.Year) ? 1 : 0);
            if (age < 13) return BadRequest(new { message = "Users must be 13+." });
        }

        // Gender aralığı
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
            Gender = (req.Gender is short gv) ? (Gender)gv : Gender.Unknown
        };

        var result = await _users.CreateAsync(user, req.Password);
        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors });

        var roles = (await _users.GetRolesAsync(user)).ToArray();
        var token = await GenerateJwtAsync(user, roles);

        return Ok(new AuthRes(
            token,
            user.Email!,
            user.CountryCode,
            user.BirthDate,
            (short)user.Gender,
            roles
        ));
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthRes>> Login([FromBody] LoginReq req)
    {
        var user = await _users.FindByEmailAsync(req.Email);
        if (user is null || !await _users.CheckPasswordAsync(user, req.Password))
            return Unauthorized(new { message = "Invalid email or password." });

        var roles = (await _users.GetRolesAsync(user)).ToArray();
        var token = await GenerateJwtAsync(user, roles);

        return Ok(new AuthRes(
            token,
            user.Email!,
            user.CountryCode,
            user.BirthDate,
            (short)user.Gender,
            roles
        ));
    }

    // ==== Helpers ====

    private Task<string> GenerateJwtAsync(AppUser user, string[] roles)
    {
        var jwt = _cfg.GetSection("Jwt");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new("country", user.CountryCode ?? string.Empty),
        };

        if (user.BirthDate is DateOnly dob)
            claims.Add(new Claim("birthdate", dob.ToString("yyyy-MM-dd")));

        claims.Add(new Claim("gender", ((short)user.Gender).ToString()));

        foreach (var r in roles)
            claims.Add(new Claim(ClaimTypes.Role, r));

        var token = new JwtSecurityToken(
            issuer: jwt["Issuer"],
            audience: jwt["Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds
        );

        return Task.FromResult(new JwtSecurityTokenHandler().WriteToken(token));
    }
}
