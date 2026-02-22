namespace WorldDeciding.Domain.Entities;

public enum QuestionType { Binary = 0, Multi = 1 }

public enum QuestionStatus
{
    Draft = 0,
    Published = 1,
    Archived = 2
}
public class Question
{
    public Guid Id { get; set; }
    public string Title { get; set; } = default!;
    public QuestionType Type { get; set; } = QuestionType.Binary;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Guid? CategoryId { get; set; }
    public List<Option> Options { get; set; } = new();
    public QuestionStatus Status { get; set; } = QuestionStatus.Draft;
    public DateTime? PublishedAt { get; set; }
    public string? TagsJson { get; set; } // hızlı çözüm: JSON string (sonra normalize edersin)
    public string Language { get; set; } = "en";
    public string? Notes { get; set; }
    public string Source { get; set; } = "admin"; // ai/admin/manual
}
