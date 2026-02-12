using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Comments;
using WorldDeciding.Application.Common.Interfaces;

namespace WorldDeciding.Application.Comments.Queries.ListReplies;

public class ListRepliesHandler : IRequestHandler<ListRepliesQuery, PagedResult<CommentDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    public ListRepliesHandler(IAppDbContext db, IClientContext client, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
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
            .OrderBy(c => c.CreatedAt) // replies chronological
            .Skip(offset)
            .Take(take + 1)
            .ToListAsync(ct);

        var hasMore = replies.Count > take;
        if (hasMore) replies.RemoveAt(replies.Count - 1);

        var ids = replies.Select(x => x.Id).ToArray();

        var likedSet = await _db.CommentLikes
            .AsNoTracking()
            .Where(l => l.UserId == userId && ids.Contains(l.CommentId))
            .Select(l => l.CommentId)
            .ToListAsync(ct);
        var liked = likedSet.ToHashSet();

        var items = replies.Select(c => new CommentDto(
            c.Id, c.QuestionId, c.UserId, c.ParentId, c.Text, c.CreatedAt,
            c.LikeCount,
            liked.Contains(c.Id),
            ReplyCount: 0 // reply-to-reply şimdilik yok sayıyoruz
        )).ToList();

        return new PagedResult<CommentDto>(items, page, take, hasMore);
    }
}
