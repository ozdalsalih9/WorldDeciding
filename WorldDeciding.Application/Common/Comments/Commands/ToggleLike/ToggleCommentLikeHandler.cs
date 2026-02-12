using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Comments.Commands.ToggleLike;

public class ToggleCommentLikeHandler : IRequestHandler<ToggleCommentLikeCommand, ToggleLikeResult>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;

    public ToggleCommentLikeHandler(IAppDbContext db, IClientContext client, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<ToggleLikeResult> Handle(ToggleCommentLikeCommand request, CancellationToken ct)
    {
        
    var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Login required.");


    // Transaction: like row + likecount together
    await using var tx = await _db.Database.BeginTransactionAsync(ct);

        var comment = await _db.Comments.FirstOrDefaultAsync(c => c.Id == request.CommentId, ct);
        if (comment is null) throw new InvalidOperationException("Comment not found.");

        var existing = await _db.CommentLikes
            .FirstOrDefaultAsync(l => l.CommentId == request.CommentId && l.UserId == userId, ct);

        bool likedByMe;
        if (existing is null)
        {
            _db.CommentLikes.Add(new CommentLike
            {
                CommentId = request.CommentId,
                UserId = userId,
                CreatedAt = DateTime.UtcNow
            });

            comment.LikeCount += 1;
            likedByMe = true;
        }
        else
        {
            _db.CommentLikes.Remove(existing);

            // güvenli decrement
            if (comment.LikeCount > 0) comment.LikeCount -= 1;
            likedByMe = false;
        }

        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new ToggleLikeResult(comment.LikeCount, likedByMe);
    }
}
