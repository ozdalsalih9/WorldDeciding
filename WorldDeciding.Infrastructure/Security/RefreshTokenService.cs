using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using WorldDeciding.Application.Common.Interfaces;

namespace WorldDeciding.Infrastructure.Security;

public sealed class RefreshTokenService : IRefreshTokenService
{
    private readonly string _pepper;

    public sealed class Options
    {
        public string Pepper { get; init; } = default!;
    }

    public RefreshTokenService(IOptions<Options> options)
    {
        _pepper = options.Value.Pepper ?? throw new InvalidOperationException("RefreshToken pepper missing");
        if (_pepper.Length < 16) throw new InvalidOperationException("Pepper too short");
    }

    public string GenerateToken()
    {
        // 64 byte random -> base64url
        Span<byte> bytes = stackalloc byte[64];
        RandomNumberGenerator.Fill(bytes);
        return Base64UrlEncode(bytes.ToArray());
    }

    public string HashToken(string token)
    {
        // SHA256(token + pepper)
        var input = Encoding.UTF8.GetBytes(token + _pepper);
        var hash = SHA256.HashData(input);
        return Convert.ToHexString(hash); // 64 hex chars
    }

    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }
}
