using MediatR;
using Microsoft.AspNetCore.Mvc;
using WorldDeciding.Application.Leaderboard.Queries.GetLeaderboard;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LeaderboardController : ControllerBase
{
    private readonly IMediator _mediator;
    public LeaderboardController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult> Get(
        [FromQuery] string metric = "views",
        [FromQuery] string window = "7d",
        [FromQuery] QuestionType? type = null,
        [FromQuery] string? q = null,
        [FromQuery] int page = 1,
        [FromQuery] int take = 20,
        CancellationToken ct = default)
    {
        var m = metric.ToLowerInvariant() switch
        {
            "views" => LeaderboardMetric.Views,
            "votes" => LeaderboardMetric.Votes,
            _ => LeaderboardMetric.Views
        };

        var w = window.ToLowerInvariant() switch
        {
            "24h" => LeaderboardWindow.H24,
            "7d" => LeaderboardWindow.D7,
            "30d" => LeaderboardWindow.D30,
            "all" => LeaderboardWindow.All,
            _ => LeaderboardWindow.D7
        };

        var result = await _mediator.Send(new GetLeaderboardQuery(m, w, type, q, page, take), ct);
        return Ok(result);
    }
}
