using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Questions.Dtos;

public class QuestionDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = default!;
    public QuestionType Type { get; set; }
    public Guid? CategoryId { get; set; }
    public List<string> Options { get; set; } = new();
}