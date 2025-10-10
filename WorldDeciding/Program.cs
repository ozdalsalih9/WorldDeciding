using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using System.Text;
using WorldDeciding.Application; // Assembly marker için (birazdan ekleyeceðiz)
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Infrastructure.Geo;
using WorldDeciding.Infrastructure.Identity;
using WorldDeciding.Infrastructure.Persistence;
using WorldDeciding.Services;
using WorldDeciding.Domain.Entities;
using WorldDeciding.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

// Serilog (isteðe baðlý)
builder.Host.UseSerilog((ctx, lc) => lc
    .ReadFrom.Configuration(ctx.Configuration)
    .WriteTo.Console());

// DbContext + Npgsql
builder.Services.AddDbContext<WorldDecidingDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

// Identity
builder.Services.AddIdentityCore<AppUser>(opt => { })
    .AddRoles<AppRole>()
    .AddEntityFrameworkStores<WorldDecidingDbContext>();

builder.Services.AddDbContext<WorldDecidingDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

// IAppDbContext -> WorldDecidingDbContext baðla
builder.Services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<WorldDecidingDbContext>());

builder.Services.AddHttpContextAccessor();

// GeoIP Resolver
builder.Services.AddSingleton<IGeoIpResolver, MaxMindGeoIpResolver>();

// Client context
builder.Services.AddScoped<IClientContext, ClientContext>();

// (Redis cache'i ileride kullanacaksan)
// builder.Services.AddStackExchangeRedisCache(o => o.Configuration = builder.Configuration["Redis:Configuration"]);

// Proxy header'larýný güvenle kullanmak istersen:
builder.Services.Configure<ForwardedHeadersOptions>(opts =>
{
    opts.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // Güvenilir proxy IP'lerini istersen buraya da ekleyebilirsin
});

// JWT (ileride kullanacaðýz)
var jwt = builder.Configuration.GetSection("Jwt");
var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!));
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt["Issuer"],
            ValidAudience = jwt["Audience"],
            IssuerSigningKey = key
        };
    });

// MediatR + FluentValidation + AutoMapper
builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(ApplicationAssemblyMarker).Assembly));
builder.Services.AddValidatorsFromAssembly(typeof(ApplicationAssemblyMarker).Assembly);
builder.Services.AddAutoMapper(typeof(ApplicationAssemblyMarker).Assembly);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS (Next.js için)
builder.Services.AddCors(o => o.AddPolicy("frontend", p => p
    .WithOrigins("http://localhost:3000")
    .AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

var app = builder.Build();

app.UseSerilogRequestLogging();
app.UseForwardedHeaders();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("frontend");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
// basit health
app.MapGet("/health", () => new { ok = true });



app.Run();
