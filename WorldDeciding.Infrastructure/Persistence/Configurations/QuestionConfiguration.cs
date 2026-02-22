using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Infrastructure.Persistence.Configurations;

public class QuestionConfiguration : IEntityTypeConfiguration<Question>
{
    public void Configure(EntityTypeBuilder<Question> b)
    {
        b.ToTable("questions");

        b.HasKey(x => x.Id);

        b.Property(x => x.Title)
            .IsRequired()
            .HasMaxLength(200);

        b.Property(x => x.Type)
            .HasConversion<int>()
            .IsRequired();

        b.Property(x => x.Status)
            .HasConversion<int>()
            .HasDefaultValue(QuestionStatus.Draft)
            .IsRequired();

        b.Property(x => x.Language)
            .HasMaxLength(8)
            .HasDefaultValue("en")
            .IsRequired();

        b.Property(x => x.Source)
            .HasMaxLength(32)
            .HasDefaultValue("admin")
            .IsRequired();

        b.Property(x => x.TagsJson)
            .HasColumnType("text");

        b.Property(x => x.Notes)
            .HasColumnType("text");

        b.Property(x => x.CreatedAt)
            .HasDefaultValueSql("now() at time zone 'utc'");

        // Admin panel + dedup + search için kritik
        b.HasIndex(x => new { x.Language, x.Title });

        // Options ilişkisi (varsayılan cascade)
        b.HasMany(x => x.Options)
            .WithOne()
            .HasForeignKey("QuestionId")
            .OnDelete(DeleteBehavior.Cascade);
    }
}