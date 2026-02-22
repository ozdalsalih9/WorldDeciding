using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Interfaces;

namespace WorldDeciding.Application.Questions.Queries.AdminGetQuestion;

public class AdminGetQuestionHandler : IRequestHandler<AdminGetQuestionQuery, AdminQuestionDetailDto>
{
    private readonly IAppDbContext _db;

    public AdminGetQuestionHandler(IAppDbContext db)
    {
        _db = db;
    }

    public async Task<AdminQuestionDetailDto> Handle(AdminGetQuestionQuery request, CancellationToken ct)
    {
        var q = await _db.Questions
            .AsNoTracking()
            .Include(x => x.Options)
            .FirstOrDefaultAsync(x => x.Id == request.Id, ct);

        if (q is null)
            throw new KeyNotFoundException("Question not found.");

        // Order alanı yok -> olduğu gibi listele
        var options = q.Options
            .Select(o => new AdminQuestionOptionDto(o.Text))
            .ToList();

        return new AdminQuestionDetailDto(
            q.Id,
            q.Title,
            q.Status,
            q.Language,
            q.TagsJson,
            q.Notes,
            q.Source,
            q.CreatedAt,
            q.PublishedAt,
            q.Type,
            options
        );
    }
}