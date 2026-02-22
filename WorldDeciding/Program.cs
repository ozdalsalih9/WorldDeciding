using FluentValidation;
using FluentValidation.AspNetCore;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using StackExchange.Redis;
using System.Text;

using WorldDeciding.Application;
using WorldDeciding.Application.Common.Interfaces;

using WorldDeciding.Infrastructure.Email;
using WorldDeciding.Infrastructure.Geo;
using WorldDeciding.Domain.Identity;
using WorldDeciding.Infrastructure.Persistence;
using WorldDeciding.Infrastructure.Security;
using WorldDeciding.Infrastructure.Services;

using WorldDeciding.Services;
using WorldDeciding.Infrastructure.Identity; // RateLimitExceptionMiddleware burada

var builder = WebApplication.CreateBuilder(args);

// ---- DEBUG (geçici) ----
Console.WriteLine("ENV=" + builder.Environment.EnvironmentName);
Console.WriteLine("ContentRoot=" + builder.Environment.ContentRootPath);
Console.WriteLine("Redis:Configuration=" + builder.Configuration.GetSection("Redis").GetValue<string>("Configuration"));

var pepper = builder.Configuration["RefreshToken:Pepper"];
Console.WriteLine($"[CONFIG] RefreshToken:Pepper loaded? {(string.IsNullOrWhiteSpace(pepper) ? "NO" : "YES")}");

// --- Logging ---
builder.Host.UseSerilog((ctx, lc) => lc
    .ReadFrom.Configuration(ctx.Configuration)
    .WriteTo.Console());

// --- DbContext ---
builder.Services.AddDbContext<WorldDecidingDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

//redis counter
builder.Services.AddScoped<IRedisCounter, RedisCounter>();
builder.Services.AddScoped<IRateCounter, RedisRateCounter>();


// IAppDbContext -> DbContext
builder.Services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<WorldDecidingDbContext>());

// --- HttpContext ---
builder.Services.AddHttpContextAccessor();

// --- Identity (TEK SEFER) ---
builder.Services.AddIdentityCore<AppUser>(opt =>
{
    opt.Password.RequiredLength = 10;
    opt.Password.RequireDigit = true;
    opt.Password.RequireUppercase = true;
    opt.Password.RequireLowercase = true;
    opt.Password.RequireNonAlphanumeric = true;

    opt.Lockout.MaxFailedAccessAttempts = 5;
    opt.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(10);
})
.AddRoles<AppRole>()
.AddEntityFrameworkStores<WorldDecidingDbContext>()
.AddDefaultTokenProviders();

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
            IssuerSigningKey = key,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });

// --- Forwarded headers (proxy arkasında IP doğru gelsin) ---
builder.Services.Configure<ForwardedHeadersOptions>(opts =>
{
    opts.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;

    // İstersen trusted proxy whitelist:
    // var proxies = builder.Configuration.GetSection("Networking:TrustedProxies").Get<string[]>() ?? Array.Empty<string>();
    // foreach (var p in proxies) opts.KnownProxies.Add(System.Net.IPAddress.Parse(p));
});

// -------------------------
// REDIS (tek kaynaktan)
// -------------------------
var redisCfg = builder.Configuration.GetSection("Redis").GetValue<string>("Configuration");
if (string.IsNullOrWhiteSpace(redisCfg))
{
    var env = builder.Environment.EnvironmentName;
    var root = builder.Environment.ContentRootPath;
    throw new InvalidOperationException($"Redis:Configuration missing. ENV={env} ContentRoot={root}. Check appsettings.{env}.json in startup project.");
}

// 1) Multiplexer (abuse için)
builder.Services.AddSingleton<IConnectionMultiplexer>(_ =>
{
    var opts = ConfigurationOptions.Parse(redisCfg);
    opts.AbortOnConnectFail = false;
    opts.ConnectRetry = 5;
    opts.ConnectTimeout = 5000;
    return ConnectionMultiplexer.Connect(opts);
});

// 2) IDistributedCache (live question cache için)
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = redisCfg;
    options.InstanceName = builder.Configuration.GetSection("Redis").GetValue<string>("InstanceName") ?? "WorldDeciding_";
});

// 3) AppCache abstraction
builder.Services.AddScoped<IAppCache, RedisAppCache>();

// --- Abuse services ---
builder.Services.AddScoped<IAbuseStore, RedisAbuseStore>();
builder.Services.AddScoped<IAbuseDetector, AbuseDetector>();
builder.Services.AddTransient<RateLimitExceptionMiddleware>();

// --- App services ---
builder.Services.AddSingleton<IGeoIpResolver, Ip2LocationGeoIpResolver>();

// ⚠️ ClientContext implementation Infrastructure'da olmalı. API'deki ClientContext'i SİL.
builder.Services.AddScoped<IClientContext, ClientContext>();

builder.Services.AddScoped<IUserDemographicsReader, UserDemographicsReader>();
builder.Services.AddScoped<IIpHasher, IpHasher>();
builder.Services.AddScoped<ILiveQuestionService, LiveQuestionService>();

//LeaderBoard
builder.Services.AddScoped<IQuestionStatsWriter, QuestionStatsWriter>();
builder.Services.AddScoped<ILeaderboardReader, WorldDeciding.Infrastructure.Persistence.LeaderboardReader>();

// Current User
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();

// score service
builder.Services.AddScoped<IUserScoreService, UserScoreService>();

// --- Email (SMTP) ---
builder.Services.Configure<SmtpOptions>(builder.Configuration.GetSection("Smtp"));
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();

// --- Security services ---
builder.Services.AddScoped<IAccessTokenService, AccessTokenService>();

builder.Services.Configure<RefreshTokenService.Options>(
    builder.Configuration.GetSection("RefreshToken"));
builder.Services.AddScoped<IRefreshTokenService, RefreshTokenService>();

// --- CORS ---
builder.Services.AddCors(o => o.AddPolicy("frontend", p => p
    .WithOrigins("http://localhost:5173")
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

// --- MediatR / Validators / AutoMapper ---
builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(ApplicationAssemblyMarker).Assembly));
builder.Services.AddValidatorsFromAssembly(typeof(ApplicationAssemblyMarker).Assembly);
builder.Services.AddAutoMapper(typeof(ApplicationAssemblyMarker).Assembly);

// --- Controllers ---
builder.Services.AddControllers()
    .AddJsonOptions(_ => { });

builder.Services.AddFluentValidationAutoValidation();

// --- Swagger ---
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "WorldDeciding API", Version = "v1" });

    var jwtSecurityScheme = new OpenApiSecurityScheme
    {
        Scheme = "bearer",
        BearerFormat = "JWT",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Description = "JWT token'ını gir. Örn: Bearer eyJhbGciOi...",
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

var app = builder.Build();

// --- Middleware pipeline ---
app.UseSerilogRequestLogging();

// Proxy header'ları auth öncesi okumalı
app.UseForwardedHeaders();

// 429 middleware (Controllers'tan önce)
app.UseMiddleware<RateLimitExceptionMiddleware>();

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
    await scope.ServiceProvider.EnsureSeededAsync(logger);
}

app.Run();
