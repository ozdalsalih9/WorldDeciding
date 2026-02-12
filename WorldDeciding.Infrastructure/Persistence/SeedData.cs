using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using WorldDeciding.Domain.Entities;
using WorldDeciding.Domain.Identity;

namespace WorldDeciding.Infrastructure.Persistence;

public static class SeedData
{
    private static class Ids
    {
        // Categories
        public static readonly Guid CatTech = Guid.Parse("11111111-1111-1111-1111-111111111111");
        public static readonly Guid CatLifestyle = Guid.Parse("22222222-2222-2222-2222-222222222222");
        public static readonly Guid CatPolitics = Guid.Parse("33333333-3333-3333-3333-333333333333");
        public static readonly Guid CatSports = Guid.Parse("44444444-4444-4444-4444-444444444444");

        // Questions
        public static readonly Guid QFramework = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1");
        public static readonly Guid QWork = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2");
        public static readonly Guid QSport = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3");

        // Options (framework)
        public static readonly Guid O_AspNetCore = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1");
        public static readonly Guid O_Spring = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2");
        public static readonly Guid O_Django = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3");
        public static readonly Guid O_Express = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4");

        // Options (work model)
        public static readonly Guid O_Remote = Guid.Parse("cccccccc-cccc-cccc-cccc-ccccccccccc1");
        public static readonly Guid O_Hybrid = Guid.Parse("cccccccc-cccc-cccc-cccc-ccccccccccc2");
        public static readonly Guid O_Onsite = Guid.Parse("cccccccc-cccc-cccc-cccc-ccccccccccc3");

        // Options (sports)
        public static readonly Guid O_Football = Guid.Parse("dddddddd-dddd-dddd-dddd-ddddddddddd1");
        public static readonly Guid O_Basketball = Guid.Parse("dddddddd-dddd-dddd-dddd-ddddddddddd2");
        public static readonly Guid O_Volleyball = Guid.Parse("dddddddd-dddd-dddd-dddd-ddddddddddd3");
        public static readonly Guid O_Tennis = Guid.Parse("dddddddd-dddd-dddd-dddd-ddddddddddd4");
    }

    public static async Task EnsureSeededAsync(this IServiceProvider services, ILogger logger, CancellationToken ct = default)
    {
        using var scope = services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<WorldDecidingDbContext>();

        await ctx.Database.MigrateAsync(ct);

        // 1) Categories (Slug ve Name zorunlu alanlarına dikkat)
        var catSet = ctx.Set<Category>();
        var categories = new List<Category>
        {
            new() { Id = Ids.CatTech,      Slug = "technology", Name = "Technology" },
            new() { Id = Ids.CatLifestyle, Slug = "lifestyle",  Name = "Lifestyle"  },
            new() { Id = Ids.CatPolitics,  Slug = "politics",   Name = "Politics"   },
            new() { Id = Ids.CatSports,    Slug = "sports",     Name = "Sports"     },
        };

        foreach (var cat in categories)
        {
            var exists = await catSet.AsNoTracking().AnyAsync(x => x.Id == cat.Id, ct);
            if (!exists) await catSet.AddAsync(cat, ct);
        }
        var catChanges = await ctx.SaveChangesAsync(ct);
        if (catChanges > 0) logger.LogInformation("Seed: {Count} categories inserted.", catChanges);

        // 2) Questions + Options
        // NOT: Question.Type DB'de int'e convert ediliyor → 0=SingleChoice varsayıyoruz.
        const int SingleChoice = 0;

        var questions = new List<Question>
        {
            new()
            {
                Id = Ids.QFramework,
                Title = "Which backend web framework do you prefer?",
                CategoryId = Ids.CatTech,
                Type = SingleChoice,
                Options = new List<Option>
                {
                    new() { Id = Ids.O_AspNetCore, Text = "ASP.NET Core" },
                    new() { Id = Ids.O_Spring,     Text = "Spring (Java)" },
                    new() { Id = Ids.O_Django,     Text = "Django (Python)" },
                    new() { Id = Ids.O_Express,    Text = "Express (Node.js)" },
                }
            },
            new()
            {
                Id = Ids.QWork,
                Title = "Which work arrangement do you prefer?",
                CategoryId = Ids.CatLifestyle,
                Type = SingleChoice,
                Options = new List<Option>
                {
                    new() { Id = Ids.O_Remote,  Text = "Remote"  },
                    new() { Id = Ids.O_Hybrid,  Text = "Hybrid"  },
                    new() { Id = Ids.O_Onsite,  Text = "On-site" },
                }
            },
            new()
            {
                Id = Ids.QSport,
                Title = "Which sport do you follow most during world championships?",
                CategoryId = Ids.CatSports,
                Type = SingleChoice,
                Options = new List<Option>
                {
                    new() { Id = Ids.O_Football,   Text = "Football"   },
                    new() { Id = Ids.O_Basketball, Text = "Basketball" },
                    new() { Id = Ids.O_Volleyball, Text = "Volleyball" },
                    new() { Id = Ids.O_Tennis,     Text = "Tennis"     },
                }
            }
        };

        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<AppRole>>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();

        if (!await roleManager.RoleExistsAsync("Admin"))
        {
            await roleManager.CreateAsync(new AppRole { Name = "Admin" });
        }
        if (!await roleManager.RoleExistsAsync("User"))
        {
            await roleManager.CreateAsync(new AppRole { Name = "User" });
        }

        // .env/appsettings'ten admin email+şifre almanız güzel olur; örnek sabit:
        var adminEmail = "ozdalsalih9@gmail.com";
        var admin = await userManager.FindByEmailAsync(adminEmail);
        if (admin is null)
        {
            admin = new AppUser { UserName = adminEmail, Email = adminEmail, CountryCode = "TR" };
            await userManager.CreateAsync(admin, "mstF002255.."); // güçlü bir şifre ver
        }
        if (!await userManager.IsInRoleAsync(admin, "Admin"))
        {
            await userManager.AddToRoleAsync(admin, "Admin");
        }

        // Upsert mantığı: soru yoksa ekle, varsa eksik option'ları tamamla
        var qSet = ctx.Set<Question>();
        var oSet = ctx.Set<Option>();

        foreach (var q in questions)
        {
            var exists = await qSet.AsNoTracking().AnyAsync(x => x.Id == q.Id, ct);
            if (!exists)
            {
                await qSet.AddAsync(q, ct); // Options da birlikte eklenecek
                continue;
            }

            foreach (var opt in q.Options)
            {
                var optExists = await oSet.AsNoTracking().AnyAsync(x => x.Id == opt.Id, ct);
                if (!optExists)
                {
                    opt.QuestionId = q.Id;
                    await oSet.AddAsync(opt, ct);
                }
            }
        }

        var qChanges = await ctx.SaveChangesAsync(ct);
        if (qChanges > 0) logger.LogInformation("Seed: questions/options upserted, changes={Count}.", qChanges);
        else logger.LogInformation("Seed: questions/options already up-to-date.");
    }
}
