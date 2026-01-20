using FluentValidation;
using FluentValidation.AspNetCore;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.StackExchangeRedis;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using System.Text;
using WorldDeciding.Application;                        // ApplicationAssemblyMarker
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Infrastructure.Geo;
using WorldDeciding.Infrastructure.Identity;
using WorldDeciding.Infrastructure.Persistence;
using WorldDeciding.Infrastructure.Services;
using WorldDeciding.Services;
var builder = WebApplication.CreateBuilder(args);

// --- Logging ---
builder.Host.UseSerilog((ctx, lc) => lc
    .ReadFrom.Configuration(ctx.Configuration)
    .WriteTo.Console());

// --- DbContext ---
builder.Services.AddDbContext<WorldDecidingDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

// IAppDbContext -> DbContext
builder.Services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<WorldDecidingDbContext>());

// --- Identity ---
builder.Services.AddIdentityCore<AppUser>(opt => { })
    .AddRoles<AppRole>()
    .AddEntityFrameworkStores<WorldDecidingDbContext>();

builder.Services.AddHttpContextAccessor();

// --- App services ---
builder.Services.AddSingleton<IGeoIpResolver, Ip2LocationGeoIpResolver>();

builder.Services.AddScoped<IClientContext, ClientContext>();

// --- CORS ---
builder.Services.AddCors(o => o.AddPolicy("frontend", p => p
    .WithOrigins("http://localhost:5173")
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

// --- Forwarded headers (opsiyonel) ---
builder.Services.Configure<ForwardedHeadersOptions>(opts =>
{
    opts.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
});

// --- Authentication / JWT ---
var jwt = builder.Configuration.GetSection("Jwt");
var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
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

// --- MediatR / Validators / AutoMapper ---
builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(ApplicationAssemblyMarker).Assembly));
builder.Services.AddValidatorsFromAssembly(typeof(ApplicationAssemblyMarker).Assembly);
builder.Services.AddAutoMapper(typeof(ApplicationAssemblyMarker).Assembly);

// --- Controllers + JSON options ---
builder.Services
    .AddControllers()
    .AddJsonOptions(o =>
    {
        // .NET 8'de DateOnly native; ekstra converter gerekmez.
        // .NET 7 ise burada DateOnly converter ekleyebilirsin.
    });

// --- FluentValidation (MVC otomatik) ---
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddScoped<IUserDemographicsReader, UserDemographicsReader>();
// --- Swagger ---
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "WorldDeciding API",
        Version = "v1"
    });

    var jwtSecurityScheme = new OpenApiSecurityScheme
    {
        Scheme = "bearer",
        BearerFormat = "JWT",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Description = "JWT token'ýný gir. Örn: Bearer eyJhbGciOi...",

        Reference = new OpenApiReference
        {
            Id = JwtBearerDefaults.AuthenticationScheme,
            Type = ReferenceType.SecurityScheme
        }
    };

    c.AddSecurityDefinition(jwtSecurityScheme.Reference.Id, jwtSecurityScheme);

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        { jwtSecurityScheme, Array.Empty<string>() }
    });
});

builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration["Redis:Configuration"];
    // appsettings.Development.json -> "Redis": { "Configuration": "localhost:6379" }
    options.InstanceName = "WorldDeciding_";
});
builder.Services.AddScoped<ILiveQuestionService, LiveQuestionService>();

// Uygulama içi cache abstraction
builder.Services.AddScoped<IAppCache, RedisAppCache>();
var app = builder.Build();

// --- Middleware pipeline ---
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
app.MapGet("/health", () => new { ok = true });

// --- Seed ---
using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>()
                                      .CreateLogger("Seed");
    await app.Services.EnsureSeededAsync(logger);
}

app.Run();
