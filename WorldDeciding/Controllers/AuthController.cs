using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using WorldDeciding.Infrastructure.Identity;

namespace WorldDeciding.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<AppUser> _users;
    private readonly IConfiguration _cfg;

    public AuthController(UserManager<AppUser> users, IConfiguration cfg)
    { _users = users; _cfg = cfg; }

    public record RegisterReq(string Email, string Password, string? CountryCode);
    public record LoginReq(string Email, string Password);
    public record AuthRes(string Token, string Email, string? CountryCode);

    [HttpPost("register")]
    public async Task<ActionResult<AuthRes>> Register(RegisterReq req)
    {
        var user = new AppUser { UserName = req.Email, Email = req.Email, CountryCode = req.CountryCode };
        var result = await _users.CreateAsync(user, req.Password);
        if (!result.Succeeded) return BadRequest(result.Errors);

        return Ok(new AuthRes(GenerateJwt(user), user.Email!, user.CountryCode));
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthRes>> Login(LoginReq req)
    {
        var user = await _users.FindByEmailAsync(req.Email);
        if (user is null || !await _users.CheckPasswordAsync(user, req.Password))
            return Unauthorized();

        return Ok(new AuthRes(GenerateJwt(user), user.Email!, user.CountryCode));
    }

    private string GenerateJwt(AppUser user)
    {
        var jwt = _cfg.GetSection("Jwt");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email ?? ""),
            new("country", user.CountryCode ?? "")
        };

        var token = new JwtSecurityToken(
            issuer: jwt["Issuer"],
            audience: jwt["Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
