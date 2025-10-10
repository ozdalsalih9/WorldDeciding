using MediatR;
using Microsoft.AspNetCore.Mvc;
using WorldDeciding.Application.Votes.Commands.CastVote;

namespace WorldDeciding.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VotesController : ControllerBase
{
    private readonly IMediator _mediator;
    public VotesController(IMediator mediator) => _mediator = mediator;

    [HttpPost]
    public async Task<IActionResult> Cast([FromBody] CastVoteCommand cmd)
    {
        await _mediator.Send(cmd);
        return NoContent();
    }
}
