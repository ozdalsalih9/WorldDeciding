using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Interfaces;

namespace WorldDeciding.Application.Questions.Queries.CountryCompare;

public sealed class CountryCompareHandler : IRequestHandler<CountryCompareQuery, CountryCompareDto>
{
    private readonly IAppDbContext _db;

    // privacy: bu sayının altındaysa detay göstermeyelim
    private const int MinCountToShowDetails = 20;

    public CountryCompareHandler(IAppDbContext db)
    {
        _db = db;
    }

    public async Task<CountryCompareDto> Handle(CountryCompareQuery request, CancellationToken ct)
    {
        var left = NormalizeCountry(request.LeftCountryCode);
        var right = NormalizeCountry(request.RightCountryCode);

        if (left == right)
            throw new InvalidOperationException("left and right country codes must be different.");

        // 1) left+right breakdown
        var countryRows = await _db.Votes
            .AsNoTracking()
            .Where(v => v.QuestionId == request.QuestionId &&
                        v.CountryCode != null &&
                        (v.CountryCode == left || v.CountryCode == right))
            .GroupBy(v => new { v.CountryCode, v.OptionId })
            .Select(g => new
            {
                CountryCode = g.Key.CountryCode,
                OptionId = g.Key.OptionId,
                Count = g.Count()
            })
            .ToListAsync(ct);

        // totals per country
        var leftTotal = countryRows.Where(x => x.CountryCode == left).Sum(x => x.Count);
        var rightTotal = countryRows.Where(x => x.CountryCode == right).Sum(x => x.Count);

        var leftBucket = BuildBucket(left, leftTotal, countryRows.Where(x => x.CountryCode == left));
        var rightBucket = BuildBucket(right, rightTotal, countryRows.Where(x => x.CountryCode == right));

        // 2) global breakdown (optional ama UI’da çok iyi durur)
        var globalRows = await _db.Votes
            .AsNoTracking()
            .Where(v => v.QuestionId == request.QuestionId)
            .GroupBy(v => v.OptionId)
            .Select(g => new { OptionId = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var globalTotal = globalRows.Sum(x => x.Count);
        var globalBucket = BuildBucket("GLOBAL", globalTotal, globalRows.Select(x => new { CountryCode = "GLOBAL", x.OptionId, x.Count }));

        return new CountryCompareDto(
            request.QuestionId,
            leftBucket,
            rightBucket,
            globalBucket
        );
    }

    private static string NormalizeCountry(string code)
    {
        if (string.IsNullOrWhiteSpace(code)) throw new InvalidOperationException("country code is required.");
        code = code.Trim().ToUpperInvariant();

        // basit doğrulama: 2 harf
        if (code.Length != 2 || !char.IsLetter(code[0]) || !char.IsLetter(code[1]))
            throw new InvalidOperationException($"Invalid country code '{code}'. Expected ISO-3166-1 alpha-2.");

        return code;
    }

    private static CountryBucketDto BuildBucket(string countryCode, int total, IEnumerable<dynamic> rows)
    {
        var suppressed = total > 0 && total < MinCountToShowDetails;

        if (total == 0)
        {
            return new CountryBucketDto(countryCode, 0, Array.Empty<OptionCountDto>(), false);
        }

        if (suppressed)
        {
            // sayıyı göster, detayları gizle
            return new CountryBucketDto(countryCode, total, Array.Empty<OptionCountDto>(), true);
        }

        var options = rows
            .Select(r => new OptionCountDto(
                (Guid)r.OptionId,
                (int)r.Count,
                Percentage: Math.Round(((double)r.Count / total) * 100.0, 2)
            ))
            .OrderByDescending(x => x.Count)
            .ToList();

        return new CountryBucketDto(countryCode, total, options, false);
    }
}