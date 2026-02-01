using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Infrastructure.Persistence.Configurations;

public sealed class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.ToTable("refresh_tokens");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.TokenHash)
            .HasMaxLength(128)
            .IsRequired();

        builder.Property(x => x.ReplacedByTokenHash)
            .HasMaxLength(128);

        builder.Property(x => x.CreatedByIpHash)
            .HasMaxLength(128);

        builder.Property(x => x.ReasonRevoked)
            .HasMaxLength(64);

        builder.HasIndex(x => new { x.UserId, x.TokenHash }).IsUnique();
        builder.HasIndex(x => new { x.UserId, x.FamilyId });
        builder.HasIndex(x => new { x.UserId, x.ExpiresAt, x.RevokedAt });
    }
}
