using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Questions.Commands.RecordQuestionView;

public class RecordQuestionViewHandler : IRequestHandler<RecordQuestionViewCommand>
{
    private readonly IAppDbContext _db;
    private readonly IHttpContextAccessor _http;
    private readonly IClientContext _client;
    private readonly IIpHasher _ipHasher;

    public RecordQuestionViewHandler(
        IAppDbContext db,
        IHttpContextAccessor http,
        IClientContext client,
        IIpHasher ipHasher)
    {
        _db = db;
        _http = http;
        _client = client;
        _ipHasher = ipHasher;
    }

    public async Task Handle(RecordQuestionViewCommand request, CancellationToken ct)
    {
        // Question var mı? (opsiyonel ama güzel)
        var questionExists = await _db.Questions.AnyAsync(q => q.Id == request.QuestionId, ct);
        if (!questionExists) return; // 404 yerine silent ignore istersen

        // UserId (varsa)
        Guid? userId = null;
        var principal = _http.HttpContext?.User;
        if (principal?.Identity is { IsAuthenticated: true })
        {
            var idClaim = principal.FindFirst(ClaimTypes.NameIdentifier)
                         ?? principal.FindFirst(JwtRegisteredClaimNames.Sub);

            if (idClaim != null && Guid.TryParse(idClaim.Value, out var uid))
                userId = uid;
        }

        // IP Hash (anon için gerekli)
        var ipRaw = _client.ClientIp?.ToString() ?? "unknown";
        var ipHash = _ipHasher.Hash(ipRaw);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var view = new QuestionView
        {
            Id = Guid.NewGuid(),
            QuestionId = request.QuestionId,
            UserId = userId,
            IpHash = ipHash,
            ViewDate = today,
            CreatedAtUtc = DateTime.UtcNow
        };

        _db.QuestionViews.Add(view);

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Unique index çakıştı → bugün zaten view atılmış, idempotent davran
        }
    }
}
