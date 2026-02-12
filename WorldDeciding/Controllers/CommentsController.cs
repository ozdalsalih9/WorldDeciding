using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WorldDeciding.Application.Comments.Commands.AddComment;
using WorldDeciding.Application.Comments.Commands.ToggleLike;
using WorldDeciding.Application.Common.Comments.Queries.ListQuestionComments;
using WorldDeciding.Application.Comments.Queries.ListReplies;
using WorldDeciding.Application.Common.Comments;


namespace WorldDeciding.Controllers;

[ApiController]
[Authorize]
public class CommentsController : ControllerBase
{
    private readonly IMediator _mediator;
    public CommentsController(IMediator mediator) => _mediator = mediator;

    // GET /api/questions/{questionId}/comments?sort=top|new&page=1&take=20
    [HttpGet("api/questions/{questionId:guid}/comments")]
    public async Task<ActionResult> ListQuestionComments(
        Guid questionId,
        [FromQuery] string sort = "top",
        [FromQuery] int page = 1,
        [FromQuery] int take = 20,
        CancellationToken ct = default)
    {
        var s = sort.ToLowerInvariant() == "new" ? CommentSort.New : CommentSort.Top;
        var res = await _mediator.Send(new ListQuestionCommentsQuery(questionId, s, page, take), ct);
        return Ok(res);
    }

    public record AddCommentReq(string Text, Guid? ParentId);

    // POST /api/questions/{questionId}/comments
    [HttpPost("api/questions/{questionId:guid}/comments")]
    public async Task<ActionResult> Add(
        Guid questionId,
        [FromBody] AddCommentReq body,
        CancellationToken ct = default)
    {
        var res = await _mediator.Send(new AddCommentCommand(questionId, body.Text, body.ParentId), ct);
        return Ok(res);
    }

    // GET /api/comments/{commentId}/replies?page=1&take=20
    [HttpGet("api/comments/{commentId:guid}/replies")]
    public async Task<ActionResult> ListReplies(
        Guid commentId,
        [FromQuery] int page = 1,
        [FromQuery] int take = 20,
        CancellationToken ct = default)
    {
        var res = await _mediator.Send(new ListRepliesQuery(commentId, page, take), ct);
        return Ok(res);
    }

    // POST /api/comments/{commentId}/like
    [HttpPost("api/comments/{commentId:guid}/like")]
    public async Task<ActionResult> ToggleLike(
        Guid commentId,
        CancellationToken ct = default)
    {
        var res = await _mediator.Send(new ToggleCommentLikeCommand(commentId), ct);
        return Ok(res);
    }
}
