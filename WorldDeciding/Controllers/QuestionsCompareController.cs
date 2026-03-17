using MediatR;
using Microsoft.AspNetCore.Mvc;
using WorldDeciding.Application.Questions.Queries.CountryCompare;

namespace WorldDeciding.Controllers;

[ApiController]
[Route("api/questions")]
public class QuestionsCompareController : ControllerBase
{
    private readonly IMediator _mediator;

    public QuestionsCompareController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet("{id:guid}/country-compare")]
    public async Task<ActionResult<CountryCompareDto>> Compare(
        Guid id,
        [FromQuery] string left,
        [FromQuery] string right,
        CancellationToken ct)
    {
        var dto = await _mediator.Send(new CountryCompareQuery(id, left, right), ct);
        return Ok(dto);
    }
}