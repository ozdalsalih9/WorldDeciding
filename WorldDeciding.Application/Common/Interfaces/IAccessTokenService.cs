using WorldDeciding.Application.Common.Auth.Models;

namespace WorldDeciding.Application.Common.Interfaces;

public interface IAccessTokenService
{
    // userId ile token üretmek minimum; istersen user objesi ile de yaparsın
    Task<string> CreateAccessTokenAsync(Guid userId, CancellationToken ct);
}
