using MediatR;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Leaderboard.Queries.GetLeaderboard;

public enum LeaderboardMetric { Views, Votes }
public enum LeaderboardWindow { H24, D7, D30, All }

public record GetLeaderboardQuery(
    LeaderboardMetric Metric,
    LeaderboardWindow Window,
    QuestionType? Type,   // ✅ artık enum filter
    string? Q,
    int Page = 1,
    int Take = 20
) : IRequest<IReadOnlyList<LeaderboardItemDto>>;

public record LeaderboardItemDto(
    Guid QuestionId,
    long Score,
    string Title,
    QuestionType Type,
    DateTime CreatedAt
);
