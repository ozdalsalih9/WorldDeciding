using MediatR;
using Microsoft.AspNetCore.Mvc;
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
    /// </summary>
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

    /// <summary>
    /// Soru detayı (opsiyonel – Query handler’ını eklediysen çalışır).
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<QuestionDto>> GetById([FromRoute] Guid id)
    {
        // Eğer GetQuestionByIdQuery’yi yazdıysan aç:
        // var result = await _mediator.Send(new GetQuestionByIdQuery(id));
        // return result is null ? NotFound() : Ok(result);

        // Henüz yazmadıysan şimdilik 501 döner:
        return StatusCode(501, "GetQuestionByIdQuery henüz uygulanmadı.");
    }

    /// <summary>
    /// Soru istatistikleri: seçenek dağılımı ve ülke kırılımı.
    /// </summary>
    [HttpGet("{id:guid}/stats")]
    public async Task<ActionResult<QuestionStatsDto>> Stats([FromRoute] Guid id)
    {
        var result = await _mediator.Send(new GetQuestionStatsQuery(id));
        return Ok(result);
    }


}
