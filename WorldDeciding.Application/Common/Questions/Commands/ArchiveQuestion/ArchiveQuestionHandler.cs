using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Application.Common.Questions.Live;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Questions.Commands.ArchiveQuestion;

public class ArchiveQuestionHandler : IRequestHandler<ArchiveQuestionCommand>
{
    private readonly IAppDbContext _db;
    private readonly IAppCache _cache;

    public ArchiveQuestionHandler(IAppDbContext db, IAppCache cache)
    {
        _db = db;
        _cache = cache;
    }

    public async Task Handle(ArchiveQuestionCommand request, CancellationToken ct)
    {
        var q = await _db.Questions.FirstOrDefaultAsync(x => x.Id == request.QuestionId, ct);
        if (q is null)
            throw new KeyNotFoundException("Question not found.");

        if (q.Status == QuestionStatus.Archived)
            return;

        q.Status = QuestionStatus.Archived;
        q.PublishedAt = null;

        await _db.SaveChangesAsync(ct);
        await _cache.RemoveAsync(LiveQuestionCacheKeys.ForUtcNow(DateTime.UtcNow), ct);
    }
}
