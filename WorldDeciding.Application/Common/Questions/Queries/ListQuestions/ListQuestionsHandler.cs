using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Application.Questions.Dtos;

public class ListQuestionsHandler : IRequestHandler<ListQuestionsQuery, IReadOnlyList<QuestionDto>>
{
    private readonly IAppDbContext _db;
    public ListQuestionsHandler(IAppDbContext db) { _db = db; }

    public async Task<IReadOnlyList<QuestionDto>> Handle(ListQuestionsQuery req, CancellationToken ct)
    {
        var q = _db.Questions.AsNoTracking().Include(x => x.Options).AsQueryable();
        if (req.CategoryId is not null) q = q.Where(x => x.CategoryId == req.CategoryId);
        if (req.Type is not null) q = q.Where(x => x.Type == req.Type);
        var items = await q.OrderByDescending(x => x.CreatedAt)
                           .Skip((req.Page - 1) * req.PageSize).Take(req.PageSize)
                           .Select(x => new QuestionDto
                           {
                               Id = x.Id,
                               Title = x.Title,
                               Type = x.Type,
                               CategoryId = x.CategoryId,
                               Options = x.Options.Select(o => o.Text).ToList()
                           })
                           .ToListAsync(ct);
        return items;
    }
}
