using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Domain.Entities;
using WorldDeciding.Domain;

namespace WorldDeciding.Application.Questions.Commands.PublishQuestion;

public class PublishQuestionHandler : IRequestHandler<PublishQuestionCommand>
{
    private readonly IAppDbContext _db;

    public PublishQuestionHandler(IAppDbContext db)
    {
        _db = db;
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
    }
}