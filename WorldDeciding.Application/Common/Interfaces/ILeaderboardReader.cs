using WorldDeciding.Application.Leaderboard.Queries.GetLeaderboard;

namespace WorldDeciding.Application.Common.Interfaces;

public interface ILeaderboardReader
{
    Task<IReadOnlyList<LeaderboardItemDto>> GetLeaderboardAsync(
        LeaderboardMetric metric,
        LeaderboardWindow window,
        int? typeInt,
        string? q,
        int offset,
        int take,
        CancellationToken ct);
}
