using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Questions.Commands.RecordQuestionView;

public sealed class RecordQuestionViewHandler : IRequestHandler<RecordQuestionViewCommand>
{
    private readonly IAppDbContext _db;
    private readonly IClientContext _client;
    private readonly IIpHasher _ipHasher;
    private readonly IRateCounter _counter;
    private readonly IQuestionStatsWriter _statsWriter;

    private const int Limit = 120;
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(5);

    public RecordQuestionViewHandler(
        IAppDbContext db,
        IClientContext client,
        IIpHasher ipHasher,
        IRateCounter counter,
        IQuestionStatsWriter statsWriter)
    {
        _db = db;
        _client = client;
        _ipHasher = ipHasher;
        _counter = counter;
        _statsWriter = statsWriter;
    }

    public async Task Handle(RecordQuestionViewCommand request, CancellationToken ct)
    {
        var ipString = _client.ClientIp?.ToString() ?? "unknown";
        var ipHash = _ipHasher.Hash(ipString);
        var questionId = request.QuestionId;

        // 1) Rate limit (silent drop)
        var key = $"abuse:ViewAttempt:ip:{ipHash}";
        var count = await _counter.IncrementAsync(key, Window, ct);
        if (count > Limit) return;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // 2) Günlük tekil view kontrolü
        var exists = await _db.QuestionViews
            .AsNoTracking()
            .AnyAsync(v =>
                v.QuestionId == questionId &&
                v.ViewDate == today &&
                v.IpHash == ipHash,
                ct);

        if (exists) return; // ✅ önce return

        // 3) View kaydını ekle
        _db.QuestionViews.Add(new QuestionView
        {
            Id = Guid.NewGuid(),
            QuestionId = questionId,
            IpHash = ipHash,
            ViewDate = today
        });

        await _db.SaveChangesAsync(ct);

        // 4) ✅ SADECE ilk kez say
        await _statsWriter.IncrementViewsAsync(questionId, today, ct);
    }
}
