using MediatR;

namespace WorldDeciding.Application.Comments.Commands.ToggleLike;

public record ToggleCommentLikeCommand(Guid CommentId) : IRequest<ToggleLikeResult>;

public record ToggleLikeResult(int LikeCount, bool LikedByMe);
