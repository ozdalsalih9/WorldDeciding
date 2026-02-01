using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using WorldDeciding.Application.Votes.Commands.CastVote;

namespace WorldDeciding.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VotesController : ControllerBase
{
    private readonly IMediator _mediator;

    public VotesController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> Cast([FromBody] CastVoteCommand command, CancellationToken ct)
    {
        try
        {
            await _mediator.Send(command, ct);
            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            var msg = ex.Message ?? "Invalid operation.";

            if (msg.Contains("locked", StringComparison.OrdinalIgnoreCase) ||
                msg.Contains("only within 10 minutes", StringComparison.OrdinalIgnoreCase) ||
                msg.Contains("Daily vote limit", StringComparison.OrdinalIgnoreCase))
            {
                return Conflict(new { message = msg });
            }

            return BadRequest(new { message = msg });
        }

        catch (DbUpdateException ex) when (ex.InnerException is PostgresException pg && pg.SqlState == "23505")
        {
            // DB unique violation - race condition vb.
            return Conflict(new { message = "Daily vote limit reached for this question." });
        }
    }
}
