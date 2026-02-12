using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Infrastructure.Persistence.Configurations;

public class CommentConfiguration : IEntityTypeConfiguration<Comment>
{
    public void Configure(EntityTypeBuilder<Comment> b)
    {
        b.ToTable("Comments");

        b.HasKey(x => x.Id);

        b.Property(x => x.Text)
            .IsRequired()
            .HasMaxLength(2000);

        b.Property(x => x.CreatedAt).IsRequired();
        b.Property(x => x.LikeCount).IsRequired();

        // Query patterns:
        // Root comments by question ordered by LikeCount/CreatedAt
        b.HasIndex(x => new { x.QuestionId, x.ParentId, x.LikeCount, x.CreatedAt });

        // Replies by parent ordered by CreatedAt
        b.HasIndex(x => new { x.ParentId, x.CreatedAt });

        // Optional FK (self reference)
        b.HasOne<Comment>()
            .WithMany()
            .HasForeignKey(x => x.ParentId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
