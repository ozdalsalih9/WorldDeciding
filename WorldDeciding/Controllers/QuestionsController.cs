using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Application.Common.Questions.Dtos;
using WorldDeciding.Application.Common.Questions.Queries;
using WorldDeciding.Application.Questions.Commands.CreateQuestion;
using WorldDeciding.Application.Questions.Commands.RecordQuestionView;
using WorldDeciding.Application.Questions.Dtos;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Controllers;

[ApiController]
[Route("api/[controller]")]
public class QuestionsController : ControllerBase
{
    private readonly IMediator _mediator;
    public QuestionsController(IMediator mediator) => _mediator = mediator;

    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<ActionResult<QuestionDto>> Create([FromBody] CreateQuestionCommand cmd)
    {
        var result = await _mediator.Send(cmd);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<QuestionDto>>> List(
        [FromQuery] Guid? categoryId,
        [FromQuery] QuestionType? type,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _mediator.Send(new ListQuestionsQuery(categoryId, type, page, pageSize));
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<QuestionDto>> GetById([FromRoute] Guid id)
    {
        var dto = await _mediator.Send(new GetQuestionByIdQuery(id));
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpGet("{id:guid}/stats")]
    public async Task<IActionResult> GetStats(
        Guid id,
        [FromServices] IAppCache cache,
        CancellationToken ct)
    {
        var cacheKey = $"question:{id}:stats";

        var cached = await cache.GetAsync<QuestionStatsDto>(cacheKey);
        if (cached is not null) return Ok(cached);

        var result = await _mediator.Send(new GetQuestionStatsQuery(id), ct);
        await cache.SetAsync(cacheKey, result, TimeSpan.FromMinutes(1));

        return Ok(result);
    }

    /// <summary>
    /// View endpoint: "silent drop" burada olur. Her zaman 204 döner.
    /// DB'ye yazıp yazmama kararını handler verir.
    /// </summary>
    [HttpPost("{id:guid}/view")]
    [AllowAnonymous]
    public async Task<IActionResult> RecordView(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new RecordQuestionViewCommand(id), ct);
        return NoContent();
    }
    [Authorize]
    [HttpGet("{id:guid}/summary")]
    public async Task<ActionResult<QuestionSummaryDto>> GetSummary(Guid id)
    {
        var dto = await _mediator.Send(new GetQuestionSummaryQuery(id));
        return Ok(dto);
    }
}
