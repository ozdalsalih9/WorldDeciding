using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WorldDeciding.Application.Common.Categories.Commands.CreateCategory;
using WorldDeciding.Application.Common.Categories.Commands.DeleteCategory;
using WorldDeciding.Application.Common.Categories.Commands.UpdateCategory;
using WorldDeciding.Application.Common.Categories.Dtos;
using WorldDeciding.Application.Common.Categories.Queries;
using WorldDeciding.Application.Questions.Dtos;

namespace WorldDeciding.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CategoriesController : ControllerBase
{
    private readonly IMediator _mediator;
    public CategoriesController(IMediator mediator) => _mediator = mediator;

    // Everyone can read
    [AllowAnonymous]
    [HttpGet]
    public async Task<ActionResult<List<CategoryDto>>> List()
        => await _mediator.Send(new ListCategoriesQuery());

    [AllowAnonymous]
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CategoryDto?>> GetById(Guid id)
    {
        var dto = await _mediator.Send(new GetCategoryByIdQuery(id));
        return dto is null ? NotFound() : Ok(dto);
    }

    // Admin only: create/update/delete
    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<ActionResult<CategoryDto>> Create([FromBody] CreateCategoryCommand cmd)
    {
        var dto = await _mediator.Send(cmd);
        return CreatedAtAction(nameof(GetById), new { id = dto.Id }, dto);
    }

    [Authorize(Roles = "Admin")]
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CategoryDto>> Update(Guid id, [FromBody] UpdateCategoryCommand body)
    {
        if (id != body.Id) return BadRequest(new { message = "Id mismatch." });
        var dto = await _mediator.Send(body);
        return Ok(dto);
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var ok = await _mediator.Send(new DeleteCategoryCommand(id));
        return ok ? NoContent() : NotFound();
    }
    [AllowAnonymous]
    [HttpGet("{id:guid}/questions")]
    public async Task<ActionResult<IReadOnlyList<QuestionDto>>> GetQuestions(Guid id)
    {
        var items = await _mediator.Send(new ListCategoryQuestionsQuery(id));
        return Ok(items);
    }
}
