using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Comments;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Application.Common.Profile;

namespace WorldDeciding.Application.Comments.Queries.ListReplies;

public class ListRepliesHandler : IRequestHandler<ListRepliesQuery, PagedResult<CommentDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;

    public ListRepliesHandler(IAppDbContext db, IClientContext client, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
        _ = client;
    }

    public async Task<PagedResult<CommentDto>> Handle(ListRepliesQuery request, CancellationToken ct)
    {
        var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Login required.");

        var take = Math.Clamp(request.Take, 1, 50);
        var page = request.Page < 1 ? 1 : request.Page;
        var offset = (page - 1) * take;

        var replies = await _db.Comments
            .AsNoTracking()
            .Where(c => c.ParentId == request.ParentCommentId)
            .OrderBy(c => c.CreatedAt)
            .Skip(offset)
            .Take(take + 1)
            .ToListAsync(ct);

        var hasMore = replies.Count > take;
        if (hasMore) replies.RemoveAt(replies.Count - 1);

        var ids = replies.Select(x => x.Id).ToArray();
        var authorIds = replies.Select(x => x.UserId).Distinct().ToArray();

        // LikedByMe
        var likedIds = await _db.CommentLikes
            .AsNoTracking()
            .Where(l => l.UserId == userId && ids.Contains(l.CommentId))
            .Select(l => l.CommentId)
            .ToListAsync(ct);

        var liked = likedIds.ToHashSet();

        // ✅ Author bilgileri (+Score)
        var authorRows = await _db.Users
            .AsNoTracking()
            .Where(u => authorIds.Contains(u.Id))
            .Select(u => new { u.Id, u.DisplayName, u.AvatarUrl, u.Score })
            .ToListAsync(ct);

        var authorMap = authorRows.ToDictionary(
            a => a.Id,
            a =>
            {
                var name = !string.IsNullOrWhiteSpace(a.DisplayName)
                    ? a.DisplayName!
                    : "Member " + a.Id.ToString().Substring(0, 5);

                var stars = UserRankResolver.GetStars(a.Score);
                var rank = UserRankResolver.GetTag(a.Score);

                return new CommentAuthorDto(a.Id, name, a.AvatarUrl, stars, rank);
            });

        var items = replies.Select(c =>
        {
            if (!authorMap.TryGetValue(c.UserId, out var author))
            {
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
                LikedByMe: liked.Contains(c.Id),
                ReplyCount: 0
            );
        }).ToList();

        return new PagedResult<CommentDto>(items, page, take, hasMore);
    }
}
