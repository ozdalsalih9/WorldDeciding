using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Domain.Entities;
using WorldDeciding.Infrastructure.Persistence.Configurations;
using WorldDeciding.Infrastructure.Persistence.Projections;
using WorldDeciding.Domain.Identity;

namespace WorldDeciding.Infrastructure.Persistence;

public class WorldDecidingDbContext
    : IdentityDbContext<AppUser, AppRole, Guid>, IAppDbContext

{
    public WorldDecidingDbContext(DbContextOptions<WorldDecidingDbContext> options)
        : base(options) { }

    public DbSet<Question> Questions => Set<Question>();
    public DbSet<Option> Options => Set<Option>();
    public DbSet<Vote> Votes => Set<Vote>();
    public DbSet<Comment> Comments => Set<Comment>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<QuestionStatsDaily> QuestionStatsDaily => Set<QuestionStatsDaily>();
    public DbSet<LeaderboardRow> LeaderboardRows => Set<LeaderboardRow>();
    public DbSet<CommentLike> CommentLikes => Set<CommentLike>();





    // ✅ EKLE: QuestionView DbSet
    public DbSet<QuestionView> QuestionViews => Set<QuestionView>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfiguration(new QuestionStatsDailyConfiguration());

        modelBuilder.Entity<LeaderboardRow>().HasNoKey();
        modelBuilder.Entity<CommentLike>(b =>
        {
            b.HasKey(x => new { x.CommentId, x.UserId });
            b.HasIndex(x => x.CommentId);
            b.HasIndex(x => x.UserId);
        });

        modelBuilder.Entity<Question>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Title).IsRequired().HasMaxLength(200);

            // Eğer enum'u int tutacaksan (DB'de int olur)
            b.Property(x => x.Type).HasConversion<int>();

            b.HasOne<Category>()
             .WithMany()
             .HasForeignKey(x => x.CategoryId)
             .OnDelete(DeleteBehavior.SetNull);

            b.HasMany(x => x.Options)
             .WithOne()
             .HasForeignKey(o => o.QuestionId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Option>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Text).IsRequired().HasMaxLength(120);
            b.HasIndex(x => new { x.QuestionId, x.Text }).IsUnique();
        });

        modelBuilder.Entity<Vote>(b =>
        {
            b.HasKey(x => x.Id);

            b.HasIndex(x => x.QuestionId);

            b.Property(x => x.CountryCode).HasMaxLength(2);
            b.Property(x => x.CountrySource).HasConversion<short>();
            b.Property(x => x.CountryProvider).HasMaxLength(50);

            b.Property(x => x.IpHash).HasMaxLength(64);

            // ✅ Tek aktif oy kuralı (User)
            b.HasIndex(v => new { v.QuestionId, v.UserId })
             .IsUnique();

            // ✅ IP sadece performans için index (unique değil)
            b.HasIndex(v => new { v.QuestionId, v.IpHash });
        });


        modelBuilder.Entity<Comment>(b =>
        {
            b.HasKey(x => x.Id);

            b.Property(x => x.Text).IsRequired().HasMaxLength(2000);
            b.Property(x => x.LikeCount).IsRequired();

            b.HasIndex(x => new { x.QuestionId, x.ParentId, x.LikeCount, x.CreatedAt });
            b.HasIndex(x => new { x.ParentId, x.CreatedAt });

            b.HasOne<Comment>()
             .WithMany()
             .HasForeignKey(x => x.ParentId)
             .OnDelete(DeleteBehavior.Cascade);
        });


        modelBuilder.Entity<AppUser>(b =>
        {
            b.Property(u => u.CountryCode).HasMaxLength(2);
            b.Property(u => u.BirthDate).HasColumnType("date"); // DateOnly için
            b.Property(u => u.Gender).HasConversion<short>();   // enum → short
            b.Property(u => u.DisplayName).HasMaxLength(40);
            b.Property(u => u.Bio).HasMaxLength(160);
            b.Property(u => u.AvatarUrl).HasMaxLength(300);
        });

        modelBuilder.Entity<Category>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Slug).IsRequired().HasMaxLength(50);
            b.Property(x => x.Name).IsRequired().HasMaxLength(80);
            b.HasIndex(x => x.Slug).IsUnique();
        });

        // ✅ QuestionView config + indexler (DbSet eklediğimiz için şimdi sağlam)
        modelBuilder.Entity<QuestionView>(b =>
        {
            b.HasKey(x => x.Id);

            b.Property(x => x.ViewDate).HasColumnType("date");
            b.Property(x => x.IpHash).HasMaxLength(64);

            b.HasIndex(x => new { x.QuestionId, x.UserId, x.ViewDate })
             .IsUnique();

            b.HasIndex(x => new { x.QuestionId, x.IpHash, x.ViewDate })
             .IsUnique();
        });


    }
}
