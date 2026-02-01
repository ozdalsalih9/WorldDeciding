using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Votes.Commands.CastVote;

public class CastVoteHandler : IRequestHandler<CastVoteCommand, Unit>
{
    private readonly IAppDbContext _db;
    private readonly IClientContext _client;
    private readonly IGeoIpResolver _geo;
    private readonly IHttpContextAccessor _http;
    private readonly IIpHasher _ipHasher;
    private readonly IAppCache _cache;

    // ✅ Değiştirme penceresi
    private static readonly TimeSpan ChangeWindow = TimeSpan.FromMinutes(10);

    public CastVoteHandler(
        IAppDbContext db,
        IClientContext client,
        IGeoIpResolver geo,
        IHttpContextAccessor http,
        IIpHasher ipHasher,
        IAppCache cache)
    {
        _db = db;
        _client = client;
        _geo = geo;
        _http = http;
        _ipHasher = ipHasher;
        _cache = cache;
    }

    public async Task<Unit> Handle(CastVoteCommand request, CancellationToken ct)
    {
        // 1) Option-Question eşleşiyor mu?
        var exists = await _db.Options
            .AnyAsync(o => o.Id == request.OptionId && o.QuestionId == request.QuestionId, ct);

        if (!exists)
            throw new InvalidOperationException("Option/Question mismatch.");

        // 2) Kullanıcı bilgisi (JWT)
        var httpContext = _http.HttpContext;
        if (httpContext?.User?.Identity is not { IsAuthenticated: true })
            throw new UnauthorizedAccessException("User must be authenticated to vote.");

        var principal = httpContext.User;

        var idClaim = principal.FindFirst(ClaimTypes.NameIdentifier)
                     ?? principal.FindFirst(JwtRegisteredClaimNames.Sub);

        if (idClaim == null || !Guid.TryParse(idClaim.Value, out var userId))
            throw new UnauthorizedAccessException("Cannot resolve user id from token.");

        // 3) IP Hash
        var ipRaw = _client.ClientIp?.ToString() ?? "unknown";
        var ipHash = _ipHasher.Hash(ipRaw);

        var utcNow = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(utcNow);

        // 4) Ülke (declared / inferred)
        string? declared = principal.FindFirst("country")?.Value;
        if (string.IsNullOrWhiteSpace(declared))
            declared = _client.DeclaredCountryIso2;
        if (string.IsNullOrWhiteSpace(declared))
            declared = null;

        string? inferred = null;
        double confidence = 0.0;
        string provider = "Unknown";

        if (_client.ClientIp is not null)
        {
            try
            {
                var (iso2, conf, prov) = await _geo.ResolveAsync(_client.ClientIp, ct);
                inferred = iso2;
                confidence = conf;
                provider = prov;
            }
            catch
            {
                inferred = null;
                confidence = 0.0;
                provider = "GeoIpError";
            }
        }

        var finalCountry = declared ?? inferred;
        var source = declared is not null
            ? CountrySource.Declared
            : (inferred is not null ? CountrySource.Inferred : CountrySource.Unknown);

        // 5) Aynı kullanıcı bu soruya bugün oy verdi mi?
        var existing = await _db.Votes.FirstOrDefaultAsync(v =>
            v.QuestionId == request.QuestionId &&
            v.UserId == userId &&
            v.VoteDate == today, ct);

        if (existing is not null)
        {
            // ✅ 10 dakikalık değişiklik penceresi
            var deadline = existing.CreatedAt.Add(ChangeWindow);
            if (utcNow > deadline)
            {
                // 10 dk geçti -> değişiklik yok
                throw new InvalidOperationException("Vote is locked. You can change your vote only within 10 minutes after voting.");
            }

            // 10 dk içindeyse update'e izin ver
            existing.OptionId = request.OptionId;
            existing.CountryCode = finalCountry;
            existing.CountrySource = source;
            existing.CountryProvider = provider;
            existing.CountryConfidence = confidence;
            existing.IpHash = ipHash;
            existing.UpdatedAt = utcNow;

            await _db.SaveChangesAsync(ct);

            // stats cache invalidate
            await _cache.RemoveAsync($"question:{request.QuestionId}:stats", ct);
            await _cache.RemoveAsync($"question:{request.QuestionId}:stats:v2", ct);

            return Unit.Value;
        }

        // 6) Kullanıcı bugün oy vermemiş => IP kontrolü (başka hesaplarla abuse engeli)
        var ipVotedToday = await _db.Votes.AnyAsync(v =>
            v.QuestionId == request.QuestionId &&
            v.VoteDate == today &&
            v.IpHash == ipHash, ct);

        if (ipVotedToday)
            throw new InvalidOperationException("Daily vote limit reached for this IP on this question.");

        // 7) Yeni vote oluştur
        var vote = new Vote
        {
            Id = Guid.NewGuid(),
            QuestionId = request.QuestionId,
            OptionId = request.OptionId,
            UserId = userId,

            VoteDate = today,
            IpHash = ipHash,

            CountryCode = finalCountry,
            CountrySource = source,
            CountryProvider = provider,
            CountryConfidence = confidence,

            CreatedAt = utcNow
        };

        _db.Votes.Add(vote);
        await _db.SaveChangesAsync(ct);

        await _cache.RemoveAsync($"question:{request.QuestionId}:stats", ct);
        await _cache.RemoveAsync($"question:{request.QuestionId}:stats:v2", ct);

        return Unit.Value;
    }
}
