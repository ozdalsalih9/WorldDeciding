using MediatR;
using WorldDeciding.Application.Common.Interfaces;

namespace WorldDeciding.Application.Leaderboard.Queries.GetLeaderboard;

public class GetLeaderboardHandler : IRequestHandler<GetLeaderboardQuery, IReadOnlyList<LeaderboardItemDto>>
{
    private readonly ILeaderboardReader _reader;

    public GetLeaderboardHandler(ILeaderboardReader reader)
    {
        _reader = reader;
    }

    public async Task<IReadOnlyList<LeaderboardItemDto>> Handle(GetLeaderboardQuery request, CancellationToken ct)
    {
        var take = Math.Clamp(request.Take, 1, 100);
        var page = request.Page < 1 ? 1 : request.Page;
        var offset = (page - 1) * take;

        int? typeInt = request.Type.HasValue ? (int)request.Type.Value : null;
        var q = string.IsNullOrWhiteSpace(request.Q) ? null : request.Q.Trim();

        return await _reader.GetLeaderboardAsync(request.Metric, request.Window, typeInt, q, offset, take, ct);
    }
}
