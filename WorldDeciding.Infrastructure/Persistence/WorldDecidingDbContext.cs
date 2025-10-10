using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Domain.Entities;
using WorldDeciding.Infrastructure.Identity;
using WorldDeciding.Application.Common.Interfaces;

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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Question>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Title).IsRequired().HasMaxLength(200);
            b.Property(x => x.Type).HasConversion<int>();
            b.HasOne<Category>().WithMany().HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.SetNull);
            b.HasMany(x => x.Options).WithOne().HasForeignKey(o => o.QuestionId).OnDelete(DeleteBehavior.Cascade);
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
            b.HasIndex(x => new { x.UserId, x.QuestionId }).IsUnique();
            b.HasIndex(x => x.QuestionId);

            b.Property(x => x.CountryCode).HasMaxLength(2);  // ISO2
            b.Property(x => x.CountrySource).HasConversion<short>();
            b.Property(x => x.CountryProvider).HasMaxLength(50);
        });


        modelBuilder.Entity<Comment>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Text).IsRequired().HasMaxLength(500);
            b.HasIndex(x => x.QuestionId);
        });

        modelBuilder.Entity<AppUser>(b =>
        {
            b.Property(u => u.CountryCode).HasMaxLength(2);
        });

        modelBuilder.Entity<Category>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Slug).IsRequired().HasMaxLength(50);
            b.Property(x => x.Name).IsRequired().HasMaxLength(80);
            b.HasIndex(x => x.Slug).IsUnique();
        });
    }


}
