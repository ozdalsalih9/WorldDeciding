using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Interfaces;

namespace WorldDeciding.Application.Questions.Queries.CountryCompare;

public sealed class CountryCompareHandler : IRequestHandler<CountryCompareQuery, CountryCompareDto>
{
    private readonly IAppDbContext _db;
    private readonly IAiSummarizer _summarizer;
    private readonly IAppCache _cache;
    private static readonly TimeSpan CompareInsightCacheTtl = TimeSpan.FromMinutes(10);

    public CountryCompareHandler(IAppDbContext db, IAiSummarizer summarizer, IAppCache cache)
    {
        _db = db;
        _summarizer = summarizer;
        _cache = cache;
    }

    public async Task<CountryCompareDto> Handle(CountryCompareQuery request, CancellationToken ct)
    {
        var left = NormalizeCountry(request.LeftCountryCode);
        var right = NormalizeCountry(request.RightCountryCode);

        if (left == right)
            throw new InvalidOperationException("left and right country codes must be different.");

        var countryRows = await _db.Votes
            .AsNoTracking()
            .Where(v => v.QuestionId == request.QuestionId &&
                        v.CountryCode != null &&
                        (v.CountryCode == left || v.CountryCode == right))
            .GroupBy(v => new { v.CountryCode, v.OptionId })
            .Select(g => new CountryOptionRow(
                g.Key.CountryCode!,
                g.Key.OptionId,
                g.Count()))
            .ToListAsync(ct);

        var optionLabels = await _db.Options
            .AsNoTracking()
            .Where(option => option.QuestionId == request.QuestionId)
            .Select(option => new OptionLabelRow(option.Id, option.Text))
            .ToListAsync(ct);

        var leftTotal = countryRows.Where(row => row.CountryCode == left).Sum(row => row.Count);
        var rightTotal = countryRows.Where(row => row.CountryCode == right).Sum(row => row.Count);

        var leftBucket = BuildBucket(
            left,
            leftTotal,
            countryRows
                .Where(row => row.CountryCode == left)
                .Select(row => (row.OptionId, row.Count)));
        var rightBucket = BuildBucket(
            right,
            rightTotal,
            countryRows
                .Where(row => row.CountryCode == right)
                .Select(row => (row.OptionId, row.Count)));

        var globalRows = await _db.Votes
            .AsNoTracking()
            .Where(v => v.QuestionId == request.QuestionId)
            .GroupBy(v => v.OptionId)
            .Select(g => new OptionAggregateRow(g.Key, g.Count()))
            .ToListAsync(ct);

        var globalTotal = globalRows.Sum(row => row.Count);
        var globalBucket = BuildBucket(
            "GLOBAL",
            globalTotal,
            globalRows.Select(row => (row.OptionId, row.Count)));

        var cacheKey = $"question:{request.QuestionId}:country-compare:{left}:{right}:ai";
        var cachedInsight = await _cache.GetAsync<CountryCompareAiCacheEntry>(cacheKey, ct);

        string aiSummary;
        DateTime aiGeneratedAt;

        if (cachedInsight is not null)
        {
            aiSummary = cachedInsight.Summary;
            aiGeneratedAt = cachedInsight.GeneratedAt;
        }
        else
        {
            var questionTitle = await _db.Questions
                .AsNoTracking()
                .Where(question => question.Id == request.QuestionId)
                .Select(question => question.Title)
                .FirstOrDefaultAsync(ct)
                ?? "this question";

            var aiInput = BuildAiInput(
                left,
                leftTotal,
                right,
                rightTotal,
                globalTotal,
                leftBucket,
                rightBucket,
                globalBucket,
                optionLabels);

            aiSummary = await _summarizer.SummarizeCountryComparisonAsync(questionTitle, aiInput, ct);
            aiGeneratedAt = DateTime.UtcNow;

            await _cache.SetAsync(
                cacheKey,
                new CountryCompareAiCacheEntry(aiSummary, aiGeneratedAt),
                CompareInsightCacheTtl,
                ct);
        }

        return new CountryCompareDto(
            request.QuestionId,
            leftBucket,
            rightBucket,
            globalBucket,
            aiSummary,
            aiGeneratedAt
        );
    }

    private static string NormalizeCountry(string code)
    {
        if (string.IsNullOrWhiteSpace(code))
            throw new InvalidOperationException("country code is required.");

        code = code.Trim().ToUpperInvariant();

        if (code.Length != 2 || !char.IsLetter(code[0]) || !char.IsLetter(code[1]))
            throw new InvalidOperationException($"Invalid country code '{code}'. Expected ISO-3166-1 alpha-2.");

        return code;
    }

    private static CountryBucketDto BuildBucket(
        string countryCode,
        int total,
        IEnumerable<(Guid OptionId, int Count)> rows)
    {
        if (total == 0)
            return new CountryBucketDto(countryCode, 0, Array.Empty<OptionCountDto>(), false);

        var options = rows
            .Select(row => new OptionCountDto(
                row.OptionId,
                row.Count,
                Percentage: Math.Round((double)row.Count / total * 100.0, 2)))
            .OrderByDescending(option => option.Count)
            .ToList();

        return new CountryBucketDto(countryCode, total, options, false);
    }

    private static CountryComparisonSummaryInput BuildAiInput(
        string leftCountryCode,
        int leftTotal,
        string rightCountryCode,
        int rightTotal,
        int globalTotal,
        CountryBucketDto leftBucket,
        CountryBucketDto rightBucket,
        CountryBucketDto globalBucket,
        IReadOnlyList<OptionLabelRow> optionLabels)
    {
        var orderedOptionIds = optionLabels.Select(option => option.Id).ToList();
        var orderedOptionIdSet = orderedOptionIds.ToHashSet();

        foreach (var extraOptionId in leftBucket.Options
                     .Select(option => option.OptionId)
                     .Concat(rightBucket.Options.Select(option => option.OptionId))
                     .Concat(globalBucket.Options.Select(option => option.OptionId))
                     .Where(optionId => !orderedOptionIdSet.Contains(optionId))
                     .Distinct())
        {
            orderedOptionIds.Add(extraOptionId);
        }

        var labelLookup = optionLabels.ToDictionary(option => option.Id, option => option.Text);
        var leftLookup = leftBucket.Options.ToDictionary(option => option.OptionId);
        var rightLookup = rightBucket.Options.ToDictionary(option => option.OptionId);
        var globalLookup = globalBucket.Options.ToDictionary(option => option.OptionId);

        var options = orderedOptionIds
            .Select((optionId, index) =>
            {
                leftLookup.TryGetValue(optionId, out var leftOption);
                rightLookup.TryGetValue(optionId, out var rightOption);
                globalLookup.TryGetValue(optionId, out var globalOption);

                return new CountryComparisonOptionInput(
                    labelLookup.GetValueOrDefault(optionId) ?? $"Option {index + 1}",
                    leftOption?.Percentage ?? 0,
                    leftOption?.Count ?? 0,
                    rightOption?.Percentage ?? 0,
                    rightOption?.Count ?? 0,
                    globalOption?.Percentage ?? 0,
                    globalOption?.Count ?? 0);
            })
            .ToList();

        return new CountryComparisonSummaryInput(
            leftCountryCode,
            leftTotal,
            rightCountryCode,
            rightTotal,
            globalTotal,
            options);
    }

    private sealed record CountryOptionRow(string CountryCode, Guid OptionId, int Count);
    private sealed record OptionAggregateRow(Guid OptionId, int Count);
    private sealed record OptionLabelRow(Guid Id, string Text);
    private sealed record CountryCompareAiCacheEntry(string Summary, DateTime GeneratedAt);
}
