using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Comments;
using WorldDeciding.Application.Common.Interfaces;

namespace WorldDeciding.Application.Common.Comments.Queries.ListQuestionComments;

public sealed class ListQuestionCommentsHandler
    : IRequestHandler<ListQuestionCommentsQuery, PagedResult<CommentDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;

    public ListQuestionCommentsHandler(IAppDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<PagedResult<CommentDto>> Handle(ListQuestionCommentsQuery request, CancellationToken ct)
    {
        var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Login required.");

        var take = Math.Clamp(request.Take, 1, 50);
        var page = request.Page < 1 ? 1 : request.Page;
        var offset = (page - 1) * take;

        var baseQuery = _db.Comments
            .AsNoTracking()
            .Where(c => c.QuestionId == request.QuestionId && c.ParentId == null);

        baseQuery = request.Sort == CommentSort.New
            ? baseQuery.OrderByDescending(c => c.CreatedAt)
            : baseQuery.OrderByDescending(c => c.LikeCount).ThenByDescending(c => c.CreatedAt);

        var rows = await baseQuery
            .Skip(offset)
            .Take(take + 1)
            .ToListAsync(ct);

        var hasMore = rows.Count > take;
        if (hasMore) rows.RemoveAt(rows.Count - 1);

        var ids = rows.Select(x => x.Id).ToArray();

        var likedIds = await _db.CommentLikes
            .AsNoTracking()
            .Where(l => l.UserId == userId && ids.Contains(l.CommentId))
            .Select(l => l.CommentId)
            .ToListAsync(ct);

        var likedSet = likedIds.ToHashSet();

        var replyCounts = await _db.Comments
            .AsNoTracking()
            .Where(r => r.ParentId != null && ids.Contains(r.ParentId.Value))
            .GroupBy(r => r.ParentId!.Value)
            .Select(g => new { ParentId = g.Key, Cnt = g.Count() })
            .ToListAsync(ct);

        var replyMap = replyCounts.ToDictionary(x => x.ParentId, x => x.Cnt);

        var items = rows.Select(c => new CommentDto(
            c.Id,
            c.QuestionId,
            c.UserId,
            c.ParentId,
            c.Text,
            c.CreatedAt,
            c.LikeCount,
            likedSet.Contains(c.Id),
            replyMap.TryGetValue(c.Id, out var rc) ? rc : 0
        )).ToList();

        return new PagedResult<CommentDto>(items, page, take, hasMore);
    }
}
