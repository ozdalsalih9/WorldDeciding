using MediatR;
using WorldDeciding.Application.Common.Comments;


namespace WorldDeciding.Application.Comments.Queries.ListReplies;

public record ListRepliesQuery(
    Guid ParentCommentId,
    int Page = 1,
    int Take = 20
) : IRequest<PagedResult<CommentDto>>;
