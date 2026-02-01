using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Application.Common.Questions.Queries;
using WorldDeciding.Application.Questions.Commands.CreateQuestion;
using WorldDeciding.Application.Questions.Dtos;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Controllers;

[ApiController]
[Route("api/[controller]")]
public class QuestionsController : ControllerBase
{
    private readonly IMediator _mediator;
    public QuestionsController(IMediator mediator) => _mediator = mediator;

    /// <summary>
    /// Yeni soru oluşturur (Binary için tam 2 seçenek, Multi için en az 3).
    /// </summary
    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<ActionResult<QuestionDto>> Create([FromBody] CreateQuestionCommand cmd)
    {
        var result = await _mediator.Send(cmd);
        // location header için GetById varmış gibi CreatedAtAction veriyoruz; istersen aşağıdaki GetById'yı da ekledim.
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    /// <summary>
    /// Soru listesi (kategori ve tipe göre filtrelenebilir).
    /// </summary>
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
    [HttpGet("test-redis")]
    public async Task<IActionResult> TestRedis(
    [FromServices] IAppCache appCache)   // IDistributedCache de kullanabilirsin ama biz abstraction’ı kullanalım
    {
        var key = "test:hello";
        await appCache.SetAsync(key, new
        {
            Message = "Hello from WorldDeciding",
            Time = DateTime.UtcNow
        }, TimeSpan.FromMinutes(5));

        var value = await appCache.GetAsync<object>(key);
        return Ok(value);
    }
    /// <summary>
    /// Soru detayı (opsiyonel – Query handler’ını eklediysen çalışır).
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<QuestionDto>> GetById([FromRoute] Guid id)
    {
        var dto = await _mediator.Send(new GetQuestionByIdQuery(id));
        return dto is null ? NotFound() : Ok(dto);
    }

    /// <summary>
    /// Soru istatistikleri: seçenek dağılımı ve ülke kırılımı.
    /// </summary>
    [HttpGet("{id}/stats")]
    public async Task<IActionResult> GetStats(
    Guid id,
    [FromServices] IAppCache cache)
    {
        var cacheKey = $"question:{id}:stats";

        var cached = await cache.GetAsync<QuestionStatsDto>(cacheKey);
        if (cached != null)
        {
            return Ok(cached);
        }
        var result = await _mediator.Send(new GetQuestionStatsQuery(id));

        await cache.SetAsync(cacheKey, result, TimeSpan.FromMinutes(1));

        return Ok(result);
    }
    [HttpPost("{id:guid}/view")]
    [AllowAnonymous]
    public async Task<IActionResult> RecordView(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new RecordQuestionViewCommand(id), ct);
        return NoContent();
    }

}
