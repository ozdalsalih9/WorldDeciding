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

    public CastVoteHandler(
        IAppDbContext db,
        IClientContext client,
        IGeoIpResolver geo,
        IHttpContextAccessor http)
    {
        _db = db;
        _client = client;
        _geo = geo;
        _http = http;
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

        // 🔹 BURASI ÖNEMLİ:
        // 3) Beyan edilen ülke:
        //    Önce JWT'deki "country" claim'ini kullan,
        //    o boşsa X-Country header'ı (ClientContext.DeclaredCountryIso2) dene.
        string? declared = principal.FindFirst("country")?.Value;
        if (string.IsNullOrWhiteSpace(declared))
            declared = _client.DeclaredCountryIso2;

        if (string.IsNullOrWhiteSpace(declared))
            declared = null;

        // 4) IP'den çıkarılan ülke (GeoIP)
        string? inferred = null;
        double confidence = 0.0;
        string provider = "Unknown";

        var ip = _client.ClientIp;
        if (ip is not null)
        {
            try
            {
                var (iso2, conf, prov) = await _geo.ResolveAsync(ip, ct);
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

        // 5) Son ülke ve kaynak tipi
        var finalCountry = declared ?? inferred;
        var source = declared is not null
            ? CountrySource.Declared
            : (inferred is not null ? CountrySource.Inferred : CountrySource.Unknown);

        // 6) Aynı kullanıcı aynı soruya daha önce oy vermiş mi? (upsert)
        var existingVote = await _db.Votes
            .FirstOrDefaultAsync(v => v.UserId == userId && v.QuestionId == request.QuestionId, ct);

        if (existingVote is null)
        {
            var vote = new Vote
            {
                Id = Guid.NewGuid(),
                QuestionId = request.QuestionId,
                OptionId = request.OptionId,
                UserId = userId,
                CountryCode = finalCountry,
                CountrySource = source,
                CountryProvider = provider,
                CountryConfidence = confidence,
                CreatedAt = DateTime.UtcNow
            };

            _db.Votes.Add(vote);
        }
        else
        {
            existingVote.OptionId = request.OptionId;
            existingVote.CountryCode = finalCountry;
            existingVote.CountrySource = source;
            existingVote.CountryProvider = provider;
            existingVote.CountryConfidence = confidence;
            existingVote.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
