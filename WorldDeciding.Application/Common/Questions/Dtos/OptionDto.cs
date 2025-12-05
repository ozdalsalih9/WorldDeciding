namespace WorldDeciding.Application.Questions.Dtos;

public sealed class OptionDto
{
    public Guid Id { get; init; }
    public string Text { get; init; } = default!;
}
