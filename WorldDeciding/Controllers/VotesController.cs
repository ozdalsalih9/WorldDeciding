using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Application.Votes.Commands.CastVote;

namespace WorldDeciding.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VotesController : ControllerBase
{
    private readonly IMediator _mediator;
    public VotesController(IMediator mediator) => _mediator = mediator;

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> Cast(
    CastVoteCommand command,
    [FromServices] IAppCache cache)
    {
        await _mediator.Send(command);

        // ilgili question stats cache'ini sil
        var cacheKey = $"question:{command.QuestionId}:stats";
        await cache.RemoveAsync(cacheKey);

        return NoContent();
    }
}
