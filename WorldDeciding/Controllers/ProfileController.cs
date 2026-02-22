using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WorldDeciding.Application.Common.Profile;
using WorldDeciding.Application.Profile.Commands.UpdateMyProfile;
using WorldDeciding.Application.Profile.Queries.GetMyProfile;
using WorldDeciding.Application.Profile.Queries.GetPublicProfile;

namespace WorldDeciding.Controllers;

[ApiController]
[Route("api/profile")]
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly IMediator _mediator;
    public ProfileController(IMediator mediator) => _mediator = mediator;

    [HttpGet("me")]
    public async Task<ActionResult<MyProfileDto>> Me(CancellationToken ct)
        => Ok(await _mediator.Send(new GetMyProfileQuery(), ct));

    [HttpPut("me")]
    public async Task<ActionResult<MyProfileDto>> Update([FromBody] UpdateMyProfileReq req, CancellationToken ct)
        => Ok(await _mediator.Send(new UpdateMyProfileCommand(req), ct));


    [HttpGet("{userId:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublicProfile(Guid userId, CancellationToken ct)
    {
        var dto = await _mediator.Send(new GetPublicProfileQuery(userId), ct);
        return dto is null ? NotFound() : Ok(dto);
    }


}
