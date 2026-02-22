using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using WorldDeciding.Application.Common.Abuse;
using WorldDeciding.Application.Common.Exceptions;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Application.Votes.Commands.CastVote;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Common.Questions.Commands.CastVote;

public class CastVoteHandler : IRequestHandler<CastVoteCommand, Unit>
{
    private readonly IAppDbContext _db;
    private readonly IClientContext _client;
    private readonly IGeoIpResolver _geo;
    private readonly IHttpContextAccessor _http;
    private readonly IIpHasher _ipHasher;
    private readonly IAppCache _cache;
    private readonly IAbuseDetector _abuse;
    private readonly IQuestionStatsWriter _statsWriter;
    private readonly IUserScoreService _score; // ✅ NEW

    // 1 gün sonra değiştirebilsin
    private static readonly TimeSpan ChangeCooldown = TimeSpan.FromDays(1);

    public CastVoteHandler(
        IAppDbContext db,
        IClientContext client,
        IGeoIpResolver geo,
        IHttpContextAccessor http,
        IIpHasher ipHasher,
        IAppCache cache,
        IAbuseDetector abuse,
        IQuestionStatsWriter statsWriter,
        IUserScoreService score) // ✅ NEW
    {
        _db = db;
        _client = client;
        _geo = geo;
        _http = http;
        _ipHasher = ipHasher;
        _cache = cache;
        _abuse = abuse;
        _statsWriter = statsWriter;
        _score = score; // ✅ NEW
    }

    public async Task<Unit> Handle(CastVoteCommand request, CancellationToken ct)
    {
        var exists = await _db.Options
            .AnyAsync(o => o.Id == request.OptionId && o.QuestionId == request.QuestionId, ct);

        if (!exists)
            throw new InvalidOperationException("Option/Question mismatch.");

        var httpContext = _http.HttpContext;
        if (httpContext?.User?.Identity is not { IsAuthenticated: true })
            throw new UnauthorizedAccessException("User must be authenticated to vote.");

        var principal = httpContext.User;
        var idClaim = principal.FindFirst(ClaimTypes.NameIdentifier)
                     ?? principal.FindFirst(JwtRegisteredClaimNames.Sub);

        if (idClaim == null || !Guid.TryParse(idClaim.Value, out var userId))
            throw new UnauthorizedAccessException("Cannot resolve user id from token.");

        var ipRaw = _client.ClientIp?.ToString() ?? "unknown";
        var ipHash = _ipHasher.Hash(ipRaw);

        var utcNow = DateTime.UtcNow;

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

        var decision = await _abuse.CheckAsync(
            AbuseAction.VoteAttempt,
            userId: userId.ToString(),
            ipHash: ipHash,
            ct);

        if (decision.Mode == AbuseMode.Throttle)
            throw new TooManyRequestsException("Too many vote attempts. Slow down.", decision.RetryAfterSeconds ?? 30);

        var existing = await _db.Votes.FirstOrDefaultAsync(v =>
            v.QuestionId == request.QuestionId &&
            v.UserId == userId, ct);

        if (existing is null)
        {
            var vote = new Vote
            {
                Id = Guid.NewGuid(),
                QuestionId = request.QuestionId,
                OptionId = request.OptionId,
                UserId = userId,
                IpHash = ipHash,

                CountryCode = finalCountry,
                CountrySource = source,
                CountryProvider = provider,
                CountryConfidence = confidence,

                CreatedAt = utcNow
            };

            _db.Votes.Add(vote);
            await _db.SaveChangesAsync(ct);

            // ✅ NEW: sadece ilk oyda +10
            await _score.AddVoteScoreAsync(userId, ct);

            // stats +1 sadece insert
            var utcDate = DateOnly.FromDateTime(utcNow);
            await _statsWriter.IncrementVotesAsync(request.QuestionId, utcDate, ct);

            await _cache.RemoveAsync($"question:{request.QuestionId}:stats", ct);
            await _cache.RemoveAsync($"question:{request.QuestionId}:stats:v2", ct);

            return Unit.Value;
        }

        if (existing.OptionId == request.OptionId)
            throw new InvalidOperationException("You have already voted for this option.");

        var last = existing.UpdatedAt ?? existing.CreatedAt;
        if (utcNow - last < ChangeCooldown)
            throw new InvalidOperationException("Vote is locked. You can change your vote only after 24 hours.");

        existing.OptionId = request.OptionId;
        existing.CountryCode = finalCountry;
        existing.CountrySource = source;
        existing.CountryProvider = provider;
        existing.CountryConfidence = confidence;
        existing.IpHash = ipHash;
        existing.UpdatedAt = utcNow;

        await _db.SaveChangesAsync(ct);

        await _cache.RemoveAsync($"question:{request.QuestionId}:stats", ct);
        await _cache.RemoveAsync($"question:{request.QuestionId}:stats:v2", ct);

        return Unit.Value;
    }
}
