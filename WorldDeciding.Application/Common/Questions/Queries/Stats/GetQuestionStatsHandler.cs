using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Application.Common.Models;
using WorldDeciding.Domain.Entities;
using static System.Net.Mime.MediaTypeNames;

public class GetQuestionStatsHandler : IRequestHandler<GetQuestionStatsQuery, QuestionStatsDto>
{
    private readonly IAppDbContext _db;
    private readonly IUserDemographicsReader _demo;

    public GetQuestionStatsHandler(IAppDbContext db, IUserDemographicsReader demo)
    {
        _db = db;
        _demo = demo;
    }

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

        // NEW: demografi
        var demographics = await _demo.GetByQuestionIdAsync(req.QuestionId, ct);

        // Gender
        var genderGroups = demographics
            .Where(x => x.Gender != Gender.Unknown)
            .GroupBy(x => x.Gender)
            .Select(g => new { Gender = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .ToList();

        var totalGender = genderGroups.Sum(x => x.Count);

        // Age bands
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        static int? CalculateAge(DateOnly? birthDate, DateOnly today)
        {
            if (birthDate is null) return null;
            var b = birthDate.Value;

            var age = today.Year - b.Year;
            if (today < b.AddYears(age)) age--;
            return (age < 0 || age > 120) ? null : age;
        }

        static string ToAgeBand(int age)
        {
            if (age < 18) return "<18";
            if (age <= 24) return "18-24";
            if (age <= 34) return "25-34";
            if (age <= 44) return "35-44";
            if (age <= 54) return "45-54";
            return "55+";
        }

        var ageGroups = demographics
            .Select(x => CalculateAge(x.BirthDate, today))
            .Where(a => a.HasValue)
            .Select(a => ToAgeBand(a!.Value))
            .GroupBy(b => b)
            .Select(g => new { Band = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .ToList();

        var totalAge = ageGroups.Sum(x => x.Count);

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

        foreach (var g in genderGroups)
        {
            dto.ByGender.Add(new QuestionStatsDto.GenderCount(g.Gender.ToString(), g.Count,
                totalGender == 0 ? 0 : (double)g.Count / totalGender * 100));
        }

        foreach (var a in ageGroups)
        {
            dto.ByAgeBands.Add(new QuestionStatsDto.AgeBandCount(a.Band, a.Count,
                totalAge == 0 ? 0 : (double)a.Count / totalAge * 100));
        }

        return dto;
    }
}
