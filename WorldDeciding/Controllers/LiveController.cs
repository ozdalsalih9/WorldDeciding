using MediatR;
using Microsoft.AspNetCore.Mvc;
using WorldDeciding.Infrastructure.Services;

[ApiController]
[Route("api/live")]
public class LiveController : ControllerBase
{
    private readonly ILiveQuestionService _live;
    private readonly IMediator _mediator;

    public LiveController(ILiveQuestionService live, IMediator mediator)
    {
        _live = live;
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<LiveQuestionDto>> Get(CancellationToken ct)
    {
        var dto = await _live.GetLiveQuestionAsync(ct);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    [HttpGet("stats")]
    public async Task<ActionResult<QuestionStatsDto>> GetLiveStats(CancellationToken ct)
    {
        var live = await _live.GetLiveQuestionAsync(ct);
        if (live is null) return NotFound();

        // Burada senin mevcut GetQuestionStatsQuery'ni çağır
        var dto = await _mediator.Send(new GetQuestionStatsQuery(live.QuestionId), ct);
        return Ok(dto);
    }

}
