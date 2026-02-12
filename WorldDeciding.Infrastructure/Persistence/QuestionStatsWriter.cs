using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Infrastructure.Persistence;

namespace WorldDeciding.Infrastructure.Persistence;

public class QuestionStatsWriter : IQuestionStatsWriter
{
    private readonly WorldDecidingDbContext _db;

    public QuestionStatsWriter(WorldDecidingDbContext db)
    {
        _db = db;
    }

    public Task IncrementViewsAsync(Guid questionId, DateOnly utcDate, CancellationToken ct)
        => UpsertIncrementAsync(questionId, utcDate, viewsDelta: 1, votesDelta: 0, ct);

    public Task IncrementVotesAsync(Guid questionId, DateOnly utcDate, CancellationToken ct)
        => UpsertIncrementAsync(questionId, utcDate, viewsDelta: 0, votesDelta: 1, ct);

    private async Task UpsertIncrementAsync(
     Guid questionId,
     DateOnly utcDate,
     long viewsDelta,
     long votesDelta,
     CancellationToken ct)
    {
        await _db.Database.ExecuteSqlInterpolatedAsync($@"
INSERT INTO ""QuestionStatsDaily"" (""QuestionId"", ""Date"", ""Views"", ""Votes"")
VALUES ({questionId}, {utcDate}, {viewsDelta}, {votesDelta})
ON CONFLICT (""QuestionId"", ""Date"")
DO UPDATE SET
    ""Views"" = ""QuestionStatsDaily"".""Views"" + EXCLUDED.""Views"",
    ""Votes"" = ""QuestionStatsDaily"".""Votes"" + EXCLUDED.""Votes"";
", ct);
    }

}
