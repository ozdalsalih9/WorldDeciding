using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Application.Common.Questions.Dtos;
using WorldDeciding.Application.Questions.Dtos;
using WorldDeciding.Domain.Entities;

public sealed class GetQuestionSummaryHandler
    : IRequestHandler<GetQuestionSummaryQuery, QuestionSummaryDto>
{
    private readonly IAppDbContext _db;
    private readonly IAiSummarizer _summarizer;
    private readonly IRateCounter _rateCounter;
    private readonly ICurrentUser _currentUser;

    public GetQuestionSummaryHandler(
        IAppDbContext db,
        IAiSummarizer summarizer,
        IRateCounter rateCounter,
        ICurrentUser currentUser)
    {
        _db = db;
        _summarizer = summarizer;
        _rateCounter = rateCounter;
        _currentUser = currentUser;
    }

    public async Task<QuestionSummaryDto> Handle(
        GetQuestionSummaryQuery request,
        CancellationToken ct)
    {
        // 🔹 Son 50 + Top 30 (like) = max 100 yorum
        var latest = _db.Comments
            .AsNoTracking()
            .Where(c => c.QuestionId == request.QuestionId)
            .OrderByDescending(c => c.CreatedAt)
            .Take(50)
            .Select(c => c.Text);

        var topLiked = _db.Comments
            .AsNoTracking()
            .Where(c => c.QuestionId == request.QuestionId)
            .OrderByDescending(c => c.LikeCount)
            .Take(30)
            .Select(c => c.Text);

        var comments = await latest
            .Concat(topLiked)
            .Distinct()
            .Take(100)
            .ToListAsync(ct);

        comments = comments
            .Where(text => !string.IsNullOrWhiteSpace(text))
            .Select(text => text.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();

        if (comments.Count == 0)
        {
            return new QuestionSummaryDto(
                request.QuestionId,
                "No comments yet for this question.",
                DateTime.UtcNow
            );
        }

        // 🔹 Cache kontrolü (ÖNCE)
        var existing = await _db.QuestionCommentSummaries
            .FirstOrDefaultAsync(x => x.QuestionId == request.QuestionId, ct);

        if (existing is not null &&
            !existing.IsStale &&
            existing.CommentCountAtGeneration == comments.Count)
        {
            return new QuestionSummaryDto(
                request.QuestionId,
                existing.SummaryText,
                existing.GeneratedAt
            );
        }

        // 🔴 Spam protection (same user + same question)
        var userId = _currentUser.UserId;

        if (userId is not null)
        {
            var key = $"ai:summary:{request.QuestionId}:{userId}";

            var count = await _rateCounter.IncrementAsync(
                key: key,
                ttl: TimeSpan.FromSeconds(30),
                limit: 1,
                window: TimeSpan.FromSeconds(30),
                ct: ct
            );

            if (count > 1)
                throw new InvalidOperationException(
                    "Please wait before requesting another summary."
                );
        }

        var questionTitle = await _db.Questions
            .Where(q => q.Id == request.QuestionId)
            .Select(q => q.Title)
            .FirstAsync(ct);

        var summary = await _summarizer.SummarizeCommentsAsync(
            questionTitle,
            comments,
            ct
        );

        if (existing is null)
        {
            existing = new QuestionCommentSummary
            {
                Id = Guid.NewGuid(),
                QuestionId = request.QuestionId
            };
            _db.QuestionCommentSummaries.Add(existing);
        }

        existing.SummaryText = summary;
        existing.GeneratedAt = DateTime.UtcNow;
        existing.CommentCountAtGeneration = comments.Count;
        existing.IsStale = false;
        existing.Model = "gemini";

        await _db.SaveChangesAsync(ct);

        return new QuestionSummaryDto(
            request.QuestionId,
            summary,
            existing.GeneratedAt
        );
    }
}
