using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Comments.Commands.AddComment;
using WorldDeciding.Application.Common.Comments;
using WorldDeciding.Application.Common.Interfaces;
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

        // reply ise parent bu question'a ait mi?
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

        return new CommentDto(
            cmt.Id,
            cmt.QuestionId,
            cmt.UserId,
            cmt.ParentId,
            cmt.Text,
            cmt.CreatedAt,
            cmt.LikeCount,
            false, // LikedByMe
            0      // ReplyCount
        );
    }
}
