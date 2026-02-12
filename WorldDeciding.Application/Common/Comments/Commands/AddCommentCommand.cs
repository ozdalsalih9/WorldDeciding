using MediatR;
using WorldDeciding.Application.Common.Comments;

namespace WorldDeciding.Application.Comments.Commands.AddComment;

public record AddCommentCommand(
    Guid QuestionId,
    string Text,
    Guid? ParentId
) : IRequest<CommentDto>;
