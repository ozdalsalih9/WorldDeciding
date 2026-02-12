using MediatR;
using WorldDeciding.Application.Common.Comments;

namespace WorldDeciding.Application.Common.Comments.Queries.ListQuestionComments;

public record ListQuestionCommentsQuery(
    Guid QuestionId,
    CommentSort Sort = CommentSort.Top,
    int Page = 1,
    int Take = 20
) : IRequest<PagedResult<CommentDto>>;
