namespace WorldDeciding.Application.Common.Categories.Dtos;

public sealed class CategoryDto
{
    public Guid Id { get; init; }
    public string Slug { get; init; } = default!;
    public string Name { get; init; } = default!;
}
