using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Comments.Commands.AddComment;
using WorldDeciding.Application.Common.Comments;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Application.Common.Profile;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Common.Comments.Commands.AddComment;

public sealed class AddCommentHandler : IRequestHandler<AddCommentCommand, CommentDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;

    public AddCommentHandler(IAppDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<CommentDto> Handle(AddCommentCommand request, CancellationToken ct)
    {
        var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Login required.");

        var text = (request.Text ?? "").Trim();
        if (text.Length < 1) throw new ArgumentException("Comment cannot be empty.");
        if (text.Length > 2000) throw new ArgumentException("Comment too long (max 2000).");

        if (request.ParentId.HasValue)
        {
            var ok = await _db.Comments
                .AsNoTracking()
                .AnyAsync(c => c.Id == request.ParentId.Value && c.QuestionId == request.QuestionId, ct);

            if (!ok) throw new InvalidOperationException("Parent comment not found for this question.");
        }

        var cmt = new Comment
        {
            Id = Guid.NewGuid(),
            QuestionId = request.QuestionId,
            UserId = userId,
            ParentId = request.ParentId,
            Text = text,
            CreatedAt = DateTime.UtcNow,
            LikeCount = 0
        };

        _db.Comments.Add(cmt);
        await _db.SaveChangesAsync(ct);

        // ✅ Author bilgisi (+Score)
        var u = await _db.Users
            .AsNoTracking()
            .Where(x => x.Id == userId)
            .Select(x => new { x.Id, x.DisplayName, x.AvatarUrl, x.Score })
            .SingleAsync(ct);

        var displayName = !string.IsNullOrWhiteSpace(u.DisplayName)
            ? u.DisplayName!
            : "Member " + u.Id.ToString().Substring(0, 5);

        var stars = UserRankResolver.GetStars(u.Score);
        var rank = UserRankResolver.GetTag(u.Score);

        var author = new CommentAuthorDto(u.Id, displayName, u.AvatarUrl, stars, rank);

        return new CommentDto(
            Id: cmt.Id,
            QuestionId: cmt.QuestionId,
            UserId: cmt.UserId,
            ParentId: cmt.ParentId,
            Text: cmt.Text,
            CreatedAt: cmt.CreatedAt,
            Author: author,
            LikeCount: cmt.LikeCount,
            LikedByMe: false,
            ReplyCount: 0
        );
    }
}
