using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Application.Common.Models;

namespace WorldDeciding.Application.Questions.Queries.AdminListQuestions;

public class AdminListQuestionsHandler : IRequestHandler<AdminListQuestionsQuery, AdminPagedResult<AdminQuestionListItemDto>>
{
    private readonly IAppDbContext _db;

    public AdminListQuestionsHandler(IAppDbContext db)
    {
        _db = db;
    }

    public async Task<AdminPagedResult<AdminQuestionListItemDto>> Handle(AdminListQuestionsQuery request, CancellationToken ct)
    {
        var page = request.Page <= 0 ? 1 : request.Page;
        var pageSize = request.PageSize is < 1 or > 200 ? 20 : request.PageSize;

        var q = _db.Questions.AsNoTracking().AsQueryable();

        if (request.Status.HasValue)
            q = q.Where(x => x.Status == request.Status.Value);

        if (!string.IsNullOrWhiteSpace(request.Language))
        {
            var lang = request.Language.Trim().ToLowerInvariant();
            q = q.Where(x => x.Language == lang);
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var s = request.Search.Trim();
            q = q.Where(x => x.Title.Contains(s));
        }

        q = q.OrderByDescending(x => x.CreatedAt);

        var total = await q.CountAsync(ct);

        var items = await q
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new AdminQuestionListItemDto(
                x.Id,
                x.Title,
                x.Status,
                x.Language,
                x.CreatedAt,
                x.PublishedAt,
                x.Type
            ))
            .ToListAsync(ct);

        return new AdminPagedResult<AdminQuestionListItemDto>(items, total, page, pageSize);
    }
}