using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Application.Questions.Dtos;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Common.Categories.Queries;

public sealed class ListCategoryQuestionsHandler
    : IRequestHandler<ListCategoryQuestionsQuery, IReadOnlyList<QuestionDto>>
{
    private readonly IAppDbContext _db;
    public ListCategoryQuestionsHandler(IAppDbContext db) => _db = db;

    public async Task<IReadOnlyList<QuestionDto>> Handle(
        ListCategoryQuestionsQuery request,
        CancellationToken ct)
    {
        return await _db.Questions
            .AsNoTracking()
            .Where(q =>
                q.CategoryId == request.CategoryId &&
                q.Status == QuestionStatus.Published   // 🔴 KRİTİK
            )
            .OrderByDescending(q => q.PublishedAt ?? q.CreatedAt)
            .Select(q => new QuestionDto
            {
                Id = q.Id,
                Title = q.Title,
                Type = q.Type,
                CategoryId = q.CategoryId,
                Options = q.Options
                    .Select(o => new OptionDto
                    {
                        Id = o.Id,
                        Text = o.Text
                    })
                    .ToList()
            })
            .ToListAsync(ct);
    }
}