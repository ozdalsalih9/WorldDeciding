using System;

namespace WorldDeciding.Domain.Entities;

public class QuestionCommentSummary
{
    public Guid Id { get; set; }
    public Guid QuestionId { get; set; }

    public string SummaryText { get; set; } = default!;
    public int CommentCountAtGeneration { get; set; }

    public DateTime GeneratedAt { get; set; }
    public bool IsStale { get; set; }

    public string Model { get; set; } = "gemini";
    public string Language { get; set; } = "en";
}