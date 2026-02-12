using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Infrastructure.Persistence.Configurations;

public sealed class CommentLikeConfiguration : IEntityTypeConfiguration<CommentLike>
{
    public void Configure(EntityTypeBuilder<CommentLike> b)
    {
        b.ToTable("CommentLikes");

        // ✅ Composite primary key
        b.HasKey(x => new { x.CommentId, x.UserId });

        b.Property(x => x.CreatedAt).IsRequired();

        b.HasIndex(x => x.CommentId);
        b.HasIndex(x => x.UserId);
    }
}
