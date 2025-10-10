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
        if (!exists) throw new InvalidOperationException("Option/Question mismatch");

        // 2) Ülke belirleme (beyan + IP'den çıkarım)
        string? declared = _client.DeclaredCountryIso2;
        string? inferred = null;
        double confidence = 0.0;
        string provider = "Unknown";

        var ip = _client.ClientIp;
        if (ip is not null)
        {
            var res = await _geo.ResolveAsync(ip, ct);
            inferred = res.countryIso2;
            confidence = res.confidence;
            provider = res.provider;
        }

        string? finalCountry = declared ?? inferred;
        var source = declared is not null ? CountrySource.Declared
                                          : (inferred is not null ? CountrySource.Inferred : CountrySource.Unknown);

        // 3) JWT'den kullanıcı Id'si (giriş yapılmışsa)
        Guid userId = Guid.Empty;

        // DÜZELTİLMİŞ KISIM - Doğrudan Microsoft'un IHttpContextAccessor'unu kullan
        var httpContext = _http.HttpContext;
        if (httpContext != null)
        {
            var user = httpContext.User;
            if (user.Identity != null && user.Identity.IsAuthenticated)
            {
                var idClaim = user.FindFirst(ClaimTypes.NameIdentifier)
                            ?? user.FindFirst(JwtRegisteredClaimNames.Sub);

                var idStr = idClaim?.Value;

                if (!string.IsNullOrWhiteSpace(idStr) && Guid.TryParse(idStr, out var parsed))
                {
                    userId = parsed;
                }
            }
        }

        // 4) Oy kaydı
        var vote = new Vote
        {
            Id = Guid.NewGuid(),
            QuestionId = request.QuestionId,
            OptionId = request.OptionId,
            UserId = userId,
            CountryCode = finalCountry,
            CountrySource = source,
            CountryProvider = provider,
            CountryConfidence = confidence
        };

        _db.Votes.Add(vote);
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}