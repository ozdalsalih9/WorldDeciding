using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Application.Common.Questions.Live;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Questions.Commands.PublishQuestion;

public class PublishQuestionHandler : IRequestHandler<PublishQuestionCommand>
{
    private readonly IAppDbContext _db;
    private readonly IAppCache _cache;

    public PublishQuestionHandler(IAppDbContext db, IAppCache cache)
    {
        _db = db;
        _cache = cache;
    }

    public async Task Handle(PublishQuestionCommand request, CancellationToken ct)
    {
        var q = await _db.Questions.FirstOrDefaultAsync(x => x.Id == request.QuestionId, ct);
        if (q is null)
            throw new KeyNotFoundException("Question not found.");

        if (q.Status == QuestionStatus.Published)
            return;

        q.Status = QuestionStatus.Published;
        q.PublishedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        await _cache.RemoveAsync(LiveQuestionCacheKeys.ForUtcNow(DateTime.UtcNow), ct);
    }
}
