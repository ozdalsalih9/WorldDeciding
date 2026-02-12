using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Infrastructure.Persistence.Configurations;

public class QuestionStatsDailyConfiguration : IEntityTypeConfiguration<QuestionStatsDaily>
{
    public void Configure(EntityTypeBuilder<QuestionStatsDaily> b)
    {
        b.ToTable("QuestionStatsDaily");

        b.Property(x => x.QuestionId).HasColumnName("QuestionId");
        b.Property(x => x.Date).HasColumnName("Date");
        b.Property(x => x.Views).HasColumnName("Views");
        b.Property(x => x.Votes).HasColumnName("Votes");

        b.ToTable("QuestionStatsDaily");

        b.HasKey(x => new { x.QuestionId, x.Date }); // composite PK => unique index zaten olur

        b.Property(x => x.Date)
            .HasColumnType("date")
            .IsRequired();

        b.Property(x => x.Views).IsRequired();
        b.Property(x => x.Votes).IsRequired();

        b.HasOne(x => x.Question)
            .WithMany() // istersen Question tarafına collection ekleyebilirsin
            .HasForeignKey(x => x.QuestionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
