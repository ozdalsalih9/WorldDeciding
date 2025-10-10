namespace WorldDeciding.Domain.Entities;

public enum QuestionType { Binary = 0, Multi = 1 }

public class Question
{
    public Guid Id { get; set; }
    public string Title { get; set; } = default!;
    public QuestionType Type { get; set; } = QuestionType.Binary;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;


    public Guid? CategoryId { get; set; }
    public List<Option> Options { get; set; } = new();
}
