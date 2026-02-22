using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WorldDeciding.Application.Common.Admin;
using WorldDeciding.Application.Common.Models;
using WorldDeciding.Application.Questions.Commands.ArchiveQuestion;
using WorldDeciding.Application.Questions.Commands.BulkImportQuestions;
using WorldDeciding.Application.Questions.Commands.PublishQuestion;
using WorldDeciding.Application.Questions.Queries.AdminGetQuestion;
using WorldDeciding.Application.Questions.Queries.AdminListQuestions;
using WorldDeciding.Domain.Entities;


namespace WorldDeciding.Controllers;

[ApiController]
[Route("api/admin/questions")]
[Authorize(Roles = "Admin")]
public class AdminQuestionsController : ControllerBase
{
    private readonly IMediator _med;

    public AdminQuestionsController(IMediator med)
    {
        _med = med;
    }

    [HttpPost("bulk-import")]
    public async Task<ActionResult<BulkImportResult>> BulkImport([FromBody] List<ImportQuestionItem> items, CancellationToken ct)
    {
        var result = await _med.Send(new BulkImportQuestionsCommand(items), ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/publish")]
    public async Task<IActionResult> Publish([FromRoute] Guid id, CancellationToken ct)
    {
        await _med.Send(new PublishQuestionCommand(id), ct);
        return NoContent();
    }

    [HttpGet]
    public async Task<ActionResult<AdminPagedResult<AdminQuestionListItemDto>>> List(
        [FromQuery] QuestionStatus? status,
        [FromQuery] string? language,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await _med.Send(new AdminListQuestionsQuery(status, language, search, page, pageSize), ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AdminQuestionDetailDto>> Get([FromRoute] Guid id, CancellationToken ct)
    {
        var result = await _med.Send(new AdminGetQuestionQuery(id), ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
    {
        await _med.Send(new ArchiveQuestionCommand(id), ct);
        return NoContent();
    }
}