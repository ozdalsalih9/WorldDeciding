namespace WorldDeciding.Domain.Entities;

public class Option
{
    public Guid Id { get; set; }
    public Guid QuestionId { get; set; }
    public string Text { get; set; } = default!;
}
