namespace WorldDeciding.Domain.Entities;

public class QuestionStatsDaily
{
    public Guid QuestionId { get; set; }
    public DateOnly Date { get; set; }          // UTC date
    public long Views { get; set; }
    public long Votes { get; set; }

    // navigation (opsiyonel)
    public Question? Question { get; set; }
}
