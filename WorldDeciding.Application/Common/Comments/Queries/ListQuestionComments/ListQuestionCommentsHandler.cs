using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Comments;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Application.Common.Profile;

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
        var userId = _currentUser.UserId
            ?? throw new UnauthorizedAccessException("Login required.");

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
        if (hasMore)
            rows.RemoveAt(rows.Count - 1);

        var commentIds = rows.Select(x => x.Id).ToArray();
        var authorIds = rows.Select(x => x.UserId).Distinct().ToArray();

        // ✅ LikedByMe
        var likedIds = await _db.CommentLikes
            .AsNoTracking()
            .Where(l => l.UserId == userId && commentIds.Contains(l.CommentId))
            .Select(l => l.CommentId)
            .ToListAsync(ct);

        var likedSet = likedIds.ToHashSet();

        // ✅ ReplyCount
        var replyCounts = await _db.Comments
            .AsNoTracking()
            .Where(r => r.ParentId != null && commentIds.Contains(r.ParentId.Value))
            .GroupBy(r => r.ParentId!.Value)
            .Select(g => new { ParentId = g.Key, Cnt = g.Count() })
            .ToListAsync(ct);

        var replyMap = replyCounts.ToDictionary(x => x.ParentId, x => x.Cnt);

        // ✅ Author bilgileri (Score DAHİL)
        var authorRows = await _db.Users
            .AsNoTracking()
            .Where(u => authorIds.Contains(u.Id))
            .Select(u => new
            {
                u.Id,
                u.DisplayName,
                u.AvatarUrl,
                u.Score
            })
            .ToListAsync(ct);

        // ✅ In-memory author map (rank + stars hesaplanıyor)
        var authorMap = authorRows.ToDictionary(
            a => a.Id,
            a =>
            {
                var name = !string.IsNullOrWhiteSpace(a.DisplayName)
                    ? a.DisplayName!
                    : "Member " + a.Id.ToString().Substring(0, 5);

                var stars = UserRankResolver.GetStars(a.Score);
                var rank = UserRankResolver.GetTag(a.Score);

                return new CommentAuthorDto(
                    a.Id,
                    name,
                    a.AvatarUrl,
                    stars,
                    rank
                );
            });

        var items = rows.Select(c =>
        {
            if (!authorMap.TryGetValue(c.UserId, out var author))
            {
                // fallback (silinmiş user vs.)
                author = new CommentAuthorDto(
                    c.UserId,
                    "Member " + c.UserId.ToString().Substring(0, 5),
                    null,
                    0,
                    "Çaylak"
                );
            }

            return new CommentDto(
                Id: c.Id,
                QuestionId: c.QuestionId,
                UserId: c.UserId,
                ParentId: c.ParentId,
                Text: c.Text,
                CreatedAt: c.CreatedAt,
                Author: author,
                LikeCount: c.LikeCount,
                LikedByMe: likedSet.Contains(c.Id),
                ReplyCount: replyMap.TryGetValue(c.Id, out var rc) ? rc : 0
            );
        }).ToList();

        return new PagedResult<CommentDto>(items, page, take, hasMore);
    }
}
