using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Application.Leaderboard.Queries.GetLeaderboard;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Infrastructure.Persistence;

public class LeaderboardReader : ILeaderboardReader
{
    private readonly WorldDecidingDbContext _db;
    public LeaderboardReader(WorldDecidingDbContext db) => _db = db;

    public async Task<IReadOnlyList<LeaderboardItemDto>> GetLeaderboardAsync(
        LeaderboardMetric metric,
        LeaderboardWindow window,
        int? typeInt,
        string? q,
        int offset,
        int take,
        CancellationToken ct)
    {
        DateOnly? startDate = window switch
        {
            LeaderboardWindow.H24 => DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)),
            LeaderboardWindow.D7  => DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-6)),
            LeaderboardWindow.D30 => DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-29)),
            LeaderboardWindow.All => null,
            _ => null
        };

        var metricExpr = metric == LeaderboardMetric.Votes
            ? "SUM(s.\"Votes\")"
            : "SUM(s.\"Views\")";

        var sql = $@"
SELECT
  s.""QuestionId"",
  {metricExpr}::bigint AS ""Score"",
  q.""Title"",
  (q.""Type"")::int AS ""Type"",
  q.""CreatedAt""
FROM ""QuestionStatsDaily"" s
JOIN ""Questions"" q ON q.""Id"" = s.""QuestionId""
WHERE
  (@startDate::date IS NULL OR s.""Date"" >= @startDate::date)
  AND (@typeInt IS NULL OR (q.""Type"")::int = @typeInt)
  AND (@q IS NULL OR q.""Title"" ILIKE ('%' || @q || '%'))
GROUP BY s.""QuestionId"", q.""Title"", q.""Type"", q.""CreatedAt""
ORDER BY ""Score"" DESC
OFFSET @offset LIMIT @take;
";

        var conn = (NpgsqlConnection)_db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open)
            await conn.OpenAsync(ct);

        await using var cmd = new NpgsqlCommand(sql, conn);

        // ✅ Typed parameters (42P08 fix)
        var pStartDate = new NpgsqlParameter("@startDate", NpgsqlDbType.Date)
        {
            Value = startDate.HasValue ? startDate.Value : DBNull.Value
        };

        var pTypeInt = new NpgsqlParameter("@typeInt", NpgsqlDbType.Integer)
        {
            Value = (object?)typeInt ?? DBNull.Value
        };

        var pQ = new NpgsqlParameter("@q", NpgsqlDbType.Text)
        {
            Value = (object?)q ?? DBNull.Value
        };

        var pOffset = new NpgsqlParameter("@offset", NpgsqlDbType.Integer) { Value = offset };
        var pTake   = new NpgsqlParameter("@take",   NpgsqlDbType.Integer) { Value = take };

        cmd.Parameters.Add(pStartDate);
        cmd.Parameters.Add(pTypeInt);
        cmd.Parameters.Add(pQ);
        cmd.Parameters.Add(pOffset);
        cmd.Parameters.Add(pTake);

        var list = new List<LeaderboardItemDto>();

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var questionId = reader.GetGuid(0);
            var score      = reader.GetInt64(1);
            var title      = reader.GetString(2);
            var type       = (QuestionType)reader.GetInt32(3);
            var createdAt  = reader.GetDateTime(4);

            list.Add(new LeaderboardItemDto(questionId, score, title, type, createdAt));
        }

        return list;
    }
}
