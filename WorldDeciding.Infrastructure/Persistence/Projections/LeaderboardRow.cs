using Microsoft.EntityFrameworkCore;

namespace WorldDeciding.Infrastructure.Persistence.Projections;

[Keyless]
public class LeaderboardRow
{
    public Guid QuestionId { get; set; }
    public long Score { get; set; }
    public string Text { get; set; } = default!;
    public string QuestionType { get; set; } = default!;
    public DateTime CreatedAtUtc { get; set; }
}
