using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Auth.Models;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Auth.Commands.Refresh;

public sealed class RefreshHandler : IRequestHandler<RefreshCommand, AuthTokensDto>
{
    private readonly IAppDbContext _db;
    private readonly IRefreshTokenService _rt;
    private readonly IAccessTokenService _accessToken;
    private readonly IClientContext _client;
    private readonly IIpHasher _ipHasher;

    public RefreshHandler(
        IAppDbContext db,
        IRefreshTokenService rt,
        IAccessTokenService accessToken,
        IClientContext client,
        IIpHasher ipHasher)
    {
        _db = db;
        _rt = rt;
        _accessToken = accessToken;
        _client = client;
        _ipHasher = ipHasher;
    }

    public async Task<AuthTokensDto> Handle(RefreshCommand request, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;

        var incomingHash = _rt.HashToken(request.RefreshToken);

        var token = await _db.RefreshTokens
            .SingleOrDefaultAsync(x => x.TokenHash == incomingHash, ct);

        if (token is null)
            throw new UnauthorizedAccessException("Invalid refresh token");

        if (!token.IsActive)
        {
            if (token.RevokedAt is not null)
            {
                await RevokeFamilyAsync(token.UserId, token.FamilyId, now, "ReuseDetected", ct);
            }

            throw new UnauthorizedAccessException("Refresh token not active");
        }

        // ROTATION
        var newPlain = _rt.GenerateToken();
        var newHash = _rt.HashToken(newPlain);

        token.Revoke(now, "Rotated", replacedByTokenHash: newHash);

        // ✅ FIX: IPAddress -> string -> hash
        string? ipHash = null;
        if (_client.ClientIp is not null)
        {
            ipHash = _ipHasher.Hash(_client.ClientIp.ToString());
        }

        var newEntity = new RefreshToken(
            userId: token.UserId,
            tokenHash: newHash,
            familyId: token.FamilyId,
            createdAt: now,
            expiresAt: now.AddDays(14),
            createdByIpHash: ipHash
        );

        _db.RefreshTokens.Add(newEntity);

        var accessToken = await _accessToken.CreateAccessTokenAsync(token.UserId, ct);

        await _db.SaveChangesAsync(ct);

        return new AuthTokensDto(accessToken, newPlain);
    }

    private async Task RevokeFamilyAsync(Guid userId, Guid familyId, DateTimeOffset now, string reason, CancellationToken ct)
    {
        var family = await _db.RefreshTokens
            .Where(x => x.UserId == userId && x.FamilyId == familyId && x.RevokedAt == null)
            .ToListAsync(ct);

        foreach (var t in family)
            t.Revoke(now, reason);

        await _db.SaveChangesAsync(ct);
    }
}
