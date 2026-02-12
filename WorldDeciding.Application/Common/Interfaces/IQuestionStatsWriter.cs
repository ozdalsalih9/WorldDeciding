namespace WorldDeciding.Application.Common.Interfaces;

public interface IQuestionStatsWriter
{
    Task IncrementViewsAsync(Guid questionId, DateOnly utcDate, CancellationToken ct);
    Task IncrementVotesAsync(Guid questionId, DateOnly utcDate, CancellationToken ct);
}
