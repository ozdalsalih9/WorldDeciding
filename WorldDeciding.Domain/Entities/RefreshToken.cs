using WorldDeciding.Domain;

namespace WorldDeciding.Domain.Entities;

public sealed class RefreshToken 
{
    public Guid Id { get; set; }
    public Guid UserId { get; private set; }

    // DB’de plaintext yok; hash var
    public string TokenHash { get; private set; } = default!;

    public Guid FamilyId { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset ExpiresAt { get; private set; }

    public DateTimeOffset? RevokedAt { get; private set; }
    public string? ReplacedByTokenHash { get; private set; }

    public string? CreatedByIpHash { get; private set; }
    public string? ReasonRevoked { get; private set; }

    public bool IsActive => RevokedAt is null && ExpiresAt > DateTimeOffset.UtcNow;

    private RefreshToken() { } // EF

    public RefreshToken(
        Guid userId,
        string tokenHash,
        Guid familyId,
        DateTimeOffset createdAt,
        DateTimeOffset expiresAt,
        string? createdByIpHash)
    {
        Id = Guid.NewGuid();
        UserId = userId;
        TokenHash = tokenHash;
        FamilyId = familyId;
        CreatedAt = createdAt;
        ExpiresAt = expiresAt;
        CreatedByIpHash = createdByIpHash;
    }

    public void Revoke(DateTimeOffset now, string reason, string? replacedByTokenHash = null)
    {
        if (RevokedAt is not null) return;
        RevokedAt = now;
        ReasonRevoked = reason;
        ReplacedByTokenHash = replacedByTokenHash;
    }
}
