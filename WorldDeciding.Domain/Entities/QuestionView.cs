public class QuestionView
{
    public Guid Id { get; set; }
    public Guid QuestionId { get; set; }

    public Guid? UserId { get; set; }     // login ise dolu
    public string IpHash { get; set; } = default!; // anon ise IP hash

    public DateOnly ViewDate { get; set; } // UTC gün
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
