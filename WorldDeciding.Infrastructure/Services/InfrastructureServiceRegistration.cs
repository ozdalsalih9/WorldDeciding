using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Infrastructure.Identity;
using WorldDeciding.Infrastructure.Persistence;

namespace WorldDeciding.Infrastructure.Services;

public static class InfrastructureServiceRegistration
{
    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration)
    {
        // Db
        services.AddDbContext<WorldDecidingDbContext>(opt =>
            opt.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));

        // IAppDbContext -> ApplicationDbContext
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<WorldDecidingDbContext>());

        // Cache (sende varsa burada)
        // services.AddScoped<IAppCache, RedisAppCache>();

        // ✅ BURASI KRİTİK: Demografi reader kaydı
        services.AddScoped<IUserDemographicsReader, UserDemographicsReader>();

        return services;
    }
}
