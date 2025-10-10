namespace WorldDeciding.Domain.Entities;

public class Category
{
    public Guid Id { get; set; }
    public string Slug { get; set; } = default!;
    public string Name { get; set; } = default!;
}
