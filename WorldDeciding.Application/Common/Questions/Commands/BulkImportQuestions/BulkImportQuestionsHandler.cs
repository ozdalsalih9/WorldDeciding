using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Admin;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Questions.Commands.BulkImportQuestions;

public class BulkImportQuestionsHandler : IRequestHandler<BulkImportQuestionsCommand, BulkImportResult>
{
    private readonly IAppDbContext _db;

    public BulkImportQuestionsHandler(IAppDbContext db)
    {
        _db = db;
    }

    public async Task<BulkImportResult> Handle(BulkImportQuestionsCommand request, CancellationToken ct)
    {
        var errors = new List<BulkImportError>();
        var inserted = 0;

        var items = request.Items ?? new List<ImportQuestionItem>();
        if (items.Count == 0)
            return new BulkImportResult(0, 0, 0, new List<BulkImportError>());

        // ✅ CategorySlug -> CategoryId map (tek query)
        var categoryMap = await _db.Categories
            .AsNoTracking()
            .ToDictionaryAsync(c => c.Slug.ToLower(), c => c.Id, ct);

        for (int i = 0; i < items.Count; i++)
        {
            var item = items[i];

            var err = Validate(item);
            if (err is not null)
            {
                errors.Add(new BulkImportError(i, err));
                continue;
            }

            var title = item.QuestionText.Trim();
            var lang = NormalizeLang(item.Language);

            // ✅ Category resolve (CategorySlug required)
            var slug = item.CategorySlug!.Trim().ToLowerInvariant();
            if (!categoryMap.TryGetValue(slug, out var categoryId))
            {
                errors.Add(new BulkImportError(i, $"Unknown CategorySlug: '{item.CategorySlug}'."));
                continue;
            }

            // Dedup: same Title + Language
            // (İstersen categoryId'yi de ekleyebiliriz ama genelde title+lang yeterli)
            var exists = await _db.Questions.AnyAsync(q =>
                q.Language == lang && q.Title == title, ct);

            if (exists)
            {
                errors.Add(new BulkImportError(i, "Duplicate question (same QuestionText/Title + Language)."));
                continue;
            }

            var question = new Question
            {
                Title = title,
                CategoryId = categoryId,               // ✅ kritik
                Type = MapType(item.Type, item.Options),
                Status = QuestionStatus.Draft,
                PublishedAt = null,
                Language = lang,
                Notes = string.IsNullOrWhiteSpace(item.Notes) ? null : item.Notes.Trim(),
                Source = string.IsNullOrWhiteSpace(item.Source) ? "admin" : item.Source.Trim(),
                TagsJson = NormalizeTagsToJson(item.Tags)
            };

            foreach (var opt in item.Options)
            {
                question.Options.Add(new Option
                {
                    Text = opt.Trim()
                });
            }

            _db.Questions.Add(question);
            inserted++;
        }

        await _db.SaveChangesAsync(ct);

        return new BulkImportResult(
            Total: items.Count,
            Inserted: inserted,
            Failed: errors.Count,
            Errors: errors
        );
    }

    private static string NormalizeLang(string? lang)
    {
        if (string.IsNullOrWhiteSpace(lang)) return "en";
        return lang.Trim().ToLowerInvariant();
    }

    private static string? NormalizeTagsToJson(List<string>? tags)
    {
        if (tags is null || tags.Count == 0) return null;

        var cleaned = tags
            .Select(t => t?.Trim())
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Select(t => t!.ToLowerInvariant())
            .Distinct()
            .ToList();

        if (cleaned.Count == 0) return null;

        return JsonSerializer.Serialize(cleaned);
    }

    private static string? Validate(ImportQuestionItem item)
    {
        if (item is null) return "Item is null.";

        if (string.IsNullOrWhiteSpace(item.QuestionText))
            return "QuestionText is required.";

        var titleLen = item.QuestionText.Trim().Length;
        if (titleLen < 6)
            return "QuestionText is too short.";
        if (titleLen > 200)
            return "QuestionText is too long (max 200).";

        if (item.Options is null || item.Options.Count < 2)
            return "At least 2 options are required.";

        // ✅ CategorySlug required
        if (string.IsNullOrWhiteSpace(item.CategorySlug))
            return "CategorySlug is required.";

        var normalizedOptions = item.Options.Select(o => o?.Trim()).ToList();
        if (normalizedOptions.Any(o => string.IsNullOrWhiteSpace(o)))
            return "Options cannot contain empty values.";

        var distinctCount = normalizedOptions
            .Select(o => o!.ToLowerInvariant())
            .Distinct()
            .Count();

        if (distinctCount != normalizedOptions.Count)
            return "Options must be unique.";

        if (normalizedOptions.Any(o => o!.Length > 80))
            return "Option text is too long (max 80 suggested).";

        return null;
    }

    private static QuestionType MapType(string? type, List<string> options)
    {
        if (!string.IsNullOrWhiteSpace(type) &&
            Enum.TryParse<QuestionType>(type.Trim(), ignoreCase: true, out var parsed))
        {
            return parsed;
        }

        var t = type?.Trim().ToLowerInvariant();
        if (t is "binary" or "yesno" or "aorb" or "truefalse")
            return QuestionType.Binary;

        if (t is "multi" or "multiple" or "multichoice" or "multi_choice")
            return QuestionType.Multi;

        return options.Count == 2 ? QuestionType.Binary : QuestionType.Multi;
    }
}