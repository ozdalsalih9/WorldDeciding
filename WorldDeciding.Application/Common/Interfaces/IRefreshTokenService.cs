namespace WorldDeciding.Application.Common.Interfaces;

public interface IRefreshTokenService
{
    string GenerateToken();          // plaintext
    string HashToken(string token);  // db’de tutulacak
}
