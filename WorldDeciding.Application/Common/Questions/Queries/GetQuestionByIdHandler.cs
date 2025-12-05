using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Application.Questions.Dtos;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Common.Questions.Queries;

public sealed class GetQuestionByIdHandler : IRequestHandler<GetQuestionByIdQuery, QuestionDto?>
{
    private readonly IAppDbContext _db;
    public GetQuestionByIdHandler(IAppDbContext db) => _db = db;

    public async Task<QuestionDto?> Handle(GetQuestionByIdQuery request, CancellationToken ct)
    {
        // Not: Include yerine projection kullanıyoruz → daha hafif.
        return await _db.Set<Question>().AsNoTracking()
            .Where(q => q.Id == request.Id)
            .Select(q => new QuestionDto
            {
                Id = q.Id,
                Title = q.Title,
                CategoryId = q.CategoryId,
                Type = q.Type, // QuestionDto'da enum veya short/int uyumlu olmalı
                Options = q.Options
                    .OrderBy(o => o.Text)
                    .Select(o => new OptionDto
                    {
                        Id = o.Id,
                        Text = o.Text
                    }).ToList()
            })
            .FirstOrDefaultAsync(ct);
    }
}
