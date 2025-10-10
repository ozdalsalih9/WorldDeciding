using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Interfaces;

public class GetQuestionStatsHandler : IRequestHandler<GetQuestionStatsQuery, QuestionStatsDto>
{
    private readonly IAppDbContext _db;
    public GetQuestionStatsHandler(IAppDbContext db) { _db = db; }

    public async Task<QuestionStatsDto> Handle(GetQuestionStatsQuery req, CancellationToken ct)
    {
        var options = await _db.Options.Where(o => o.QuestionId == req.QuestionId)
                        .Select(o => new { o.Id, o.Text }).ToListAsync(ct);

        var total = await _db.Votes.CountAsync(v => v.QuestionId == req.QuestionId, ct);
        var perOption = await _db.Votes.Where(v => v.QuestionId == req.QuestionId)
                        .GroupBy(v => v.OptionId)
                        .Select(g => new { OptionId = g.Key, Count = g.Count() })
                        .ToListAsync(ct);

        var byCountry = await _db.Votes.Where(v => v.QuestionId == req.QuestionId && v.CountryCode != null)
                          .GroupBy(v => v.CountryCode!)
                          .Select(g => new { Code = g.Key, Count = g.Count() })
                          .ToListAsync(ct);

        var dto = new QuestionStatsDto { QuestionId = req.QuestionId };
        foreach (var o in options)
        {
            var c = perOption.FirstOrDefault(x => x.OptionId == o.Id)?.Count ?? 0;
            dto.Options.Add(new QuestionStatsDto.OptionCount(o.Id, o.Text, c, total == 0 ? 0 : (double)c / total * 100));
        }
        var totalCountry = byCountry.Sum(x => x.Count);
        foreach (var c in byCountry)
        {
            dto.ByCountry.Add(new QuestionStatsDto.CountryCount(c.Code, c.Count, totalCountry == 0 ? 0 : (double)c.Count / totalCountry * 100));
        }
        return dto;
    }
}
